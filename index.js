const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Resend
const resend = new Resend(RESEND_API_KEY);

// Function to fetch campaigns from Supabase
async function fetchCampaigns() {
    try {
        const { data, error } = await supabase
            .from('campaigns')
            .select('name, url')
            .eq('active', true);

        if (error) {
            console.error('Error fetching campaigns:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Failed to fetch campaigns:', err);
        return [];
    }
}

// Function to fetch email recipients from Supabase
async function fetchRecipients() {
    try {
        const { data, error } = await supabase
            .from('recipients')
            .select('email')
            .eq('active', true);

        if (error) {
            console.error('Error fetching recipients:', error);
            return [];
        }

        return data.map(recipient => ({ Email: recipient.email })) || [];
    } catch (err) {
        console.error('Failed to fetch recipients:', err);
        return [];
    }
}

async function run() {
    console.log("🚀 Starting Scrape for Endless & DarkEx...");

    // Fetch campaigns and recipients from Supabase
    const CAMPAIGNS = await fetchCampaigns();
    const RECIPIENTS = await fetchRecipients();

    if (CAMPAIGNS.length === 0) {
        console.error("❌ No campaigns found in database");
        return;
    }

    if (RECIPIENTS.length === 0) {
        console.error("❌ No recipients found in database");
        return;
    }

    console.log(`📊 Loaded ${CAMPAIGNS.length} campaigns and ${RECIPIENTS.length} recipients`);

    let browser;
    try {
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
        });
        console.log("✅ Connected to Browserless");
    } catch (err) {
        console.error("❌ Connection failed:", err.message);
        return;
    }

    let db = {};
    if (fs.existsSync('database.json')) {
        try {
            const rawData = fs.readFileSync('database.json', 'utf8');
            db = JSON.parse(rawData.replace(/^\uFEFF/, '').trim() || '{}');
        } catch (e) { db = {}; }
    }

    let updatesFound = [];

    for (const project of CAMPAIGNS) {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        try {
            console.log(`🔍 Checking: ${project.name}`);
            await page.goto(project.url, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // Zealy quest names usually use this class
            await page.waitForSelector('.quest-card-quest-name', { timeout: 20000 });

            const currentTasks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.quest-card-quest-name'))
                            .map(e => e.innerText.trim());
            });

            const oldTasks = db[project.name] || [];
            const newOnes = currentTasks.filter(t => !oldTasks.includes(t));

            if (newOnes.length > 0) {
                console.log(`✨ Found ${newOnes.length} NEW quests for ${project.name}`);
                updatesFound.push({ name: project.name, tasks: newOnes });
                db[project.name] = currentTasks;
            }
        } catch (e) {
            console.log(`⚠️ ${project.name} skip (No active quests or page error).`);
        } finally {
            await page.close();
        }
    }

    await browser.close();

    if (updatesFound.length > 0) {
        console.log("✉️ Sending Email via Resend...");
        try {
            const emailHtml = updatesFound.map(p => `
                <div style="font-family: sans-serif; border: 1px solid #602fd6; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                    <h2 style="color: #602fd6;">${p.name}</h2>
                    <ul>${p.tasks.map(t => `<li><strong>${t}</strong></li>`).join('')}</ul>
                    <p><a href="https://zealy.io/cw/${p.name.toLowerCase()}">Go to Sprint</a></p>
                </div>
            `).join('');

            const { data, error } = await resend.emails.send({
                from: `ZealyBot <${SENDER_EMAIL}>`,
                to: RECIPIENTS.map(r => r.Email), // Convert to array of email strings
                subject: `🚨 NEW Quests: ${updatesFound.map(u => u.name).join(', ')}`,
                html: emailHtml,
            });

            if (error) {
                console.error("❌ Resend Error:", error);
            } else {
                console.log("📬 Email Sent Successfully!", data);
                fs.writeFileSync('database.json', JSON.stringify(db, null, 2), 'utf8');
            }
        } catch (err) {
            console.error("❌ Email sending failed:", err);
        }
    } else {
        console.log("✅ No new quests found.");
    }
}

run();
