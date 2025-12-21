const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const pLimit = require('p-limit'); 
require('dotenv').config();

puppeteer.use(StealthPlugin());

const {
    RESEND_API_KEY,
    BROWSERLESS_TOKEN,
    SENDER_EMAIL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const resend = new Resend(RESEND_API_KEY);
const limit = pLimit(3); // Process 3 campaigns at a time

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function scrapeProject(browser, project) {
    return limit(async () => {
        const page = await browser.newPage();
        // Optimize: Block images to save credits and speed up
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        try {
            console.log(`🔍 Checking: ${project.name}`);
            await page.goto(project.url, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // Check if page has quests
            const selector = '.quest-card-quest-name';
            const exists = await page.$(selector);

            if (!exists) {
                return { name: project.name, status: 'No Quests Found', tasks: [], url: project.url, new: [] };
            }

            await autoScroll(page);
            await new Promise(r => setTimeout(r, 2000)); 

            const currentTasks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.quest-card-quest-name'))
                            .map(e => e.innerText.trim());
            });

            const { data } = await supabase.from('quest_snapshots').select('task_list').eq('campaign_name', project.name).single();
            const oldTasks = data ? data.task_list : [];
            const newOnes = currentTasks.filter(t => !oldTasks.includes(t));

            // Sync with Supabase
            await supabase.from('quest_snapshots').upsert({ 
                campaign_name: project.name, 
                task_list: currentTasks, 
                updated_at: new Date() 
            }, { onConflict: 'campaign_name' });

            return { 
                name: project.name, 
                status: 'Active', 
                tasks: currentTasks, 
                new: newOnes, 
                url: project.url 
            };
        } catch (e) {
            console.error(`⚠️ Error ${project.name}:`, e.message);
            return { name: project.name, status: 'Error/Timeout', tasks: [], new: [], url: project.url };
        } finally {
            await page.close();
        }
    });
}

async function run() {
    const startTime = new Date().toLocaleString();
    console.log(`🚀 Run started at ${startTime}`);

    const { data: CAMPAIGNS } = await supabase.from('campaigns').select('name, url').eq('active', true);
    const { data: recipientsData } = await supabase.from('recipients').select('email').eq('active', true);
    const RECIPIENTS = recipientsData?.map(r => r.email) || [];

    if (!CAMPAIGNS?.length || !RECIPIENTS.length) return;

    let browser;
    try {
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
        });
    } catch (err) {
        console.error("❌ Connection failed", err);
        return;
    }

    const results = await Promise.all(CAMPAIGNS.map(p => scrapeProject(browser, p)));
    await browser.close();

    const anyNewUpdates = results.some(r => r.new.length > 0);
    const subject = anyNewUpdates 
        ? `🚨 NEW Quests Detected! (${results.filter(r => r.new.length > 0).map(r => r.name).join(', ')})`
        : `✅ Zealy Status: No New Quests Found`;

    // Build the Email Content
    const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
            <h1 style="color: #602fd6; text-align: center;">ZealyBot Report</h1>
            <p style="text-align: center; color: #666;">Run completed at: ${startTime}</p>
            <hr style="border: 0; border-top: 1px solid #eee;" />
            
            ${results.map(p => `
                <div style="margin-bottom: 30px; padding: 15px; border-radius: 8px; background-color: ${p.new.length > 0 ? '#fdf2ff' : '#f9f9f9'}; border-left: 5px solid ${p.new.length > 0 ? '#602fd6' : '#ccc'};">
                    <h3 style="margin-top: 0; color: #333;">${p.name} <small style="font-weight: normal; font-size: 12px; color: #666;">(${p.status})</small></h3>
                    
                    ${p.new.length > 0 ? `
                        <p style="color: #602fd6; font-weight: bold;">✨ ${p.new.length} New Tasks:</p>
                        <ul style="padding-left: 20px;">
                            ${p.new.map(t => `<li style="margin-bottom: 5px;"><strong>${t}</strong></li>`).join('')}
                        </ul>
                    ` : `<p style="color: #888; font-style: italic;">No new tasks detected.</p>`}
                    
                    <a href="${p.url}" style="font-size: 13px; color: #602fd6;">Visit Zealy Page &rarr;</a>
                </div>
            `).join('')}

            <div style="text-align: center; font-size: 11px; color: #aaa; margin-top: 20px;">
                Automated notification from your Supabase Zealy Scraper.
            </div>
        </div>
    `;

    try {
        await resend.emails.send({
            from: `ZealyBot <${SENDER_EMAIL}>`,
            to: RECIPIENTS,
            subject: subject,
            html: emailHtml,
        });
        console.log("📬 Email Sent Successfully!");
    } catch (err) {
        console.error("❌ Email failed", err);
    }
}

run();
