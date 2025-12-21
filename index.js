const puppeteer = require('puppeteer-core');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const {
    RESEND_API_KEY,
    BROWSERLESS_TOKEN,
    SENDER_EMAIL,
    SUPABASE_URL,
    SUPABASE_ANON_KEY
} = process.env;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const resend = new Resend(RESEND_API_KEY);

/**
 * Helper: Scrolls to the bottom of the page to trigger lazy-loading
 */
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
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        console.log(`🔍 Checking: ${project.name}`);
        await page.goto(project.url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for the first quest card to appear
        await page.waitForSelector('.quest-card-quest-name', { timeout: 20000 });

        // Scroll to load all lazy-loaded quests
        await autoScroll(page);
        // Small buffer for DOM to settle after scroll
        await new Promise(r => setTimeout(r, 2000)); 

        const currentTasks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.quest-card-quest-name'))
                        .map(e => e.innerText.trim());
        });

        // Fetch old data from Supabase
        const { data } = await supabase.from('quest_snapshots').select('task_list').eq('campaign_name', project.name).single();
        const oldTasks = data ? data.task_list : [];
        const newOnes = currentTasks.filter(t => !oldTasks.includes(t));

        if (newOnes.length > 0) {
            console.log(`✨ Found ${newOnes.length} NEW quests for ${project.name}`);
            // Update Supabase immediately
            await supabase.from('quest_snapshots').upsert({ 
                campaign_name: project.name, 
                task_list: currentTasks, 
                updated_at: new Date() 
            }, { onConflict: 'campaign_name' });

            return { name: project.name, tasks: newOnes, url: project.url };
        }
        return null;
    } catch (e) {
        console.error(`⚠️ Error scraping ${project.name}:`, e.message);
        return null;
    } finally {
        await page.close();
    }
}

async function run() {
    console.log("🚀 Starting Parallel Scrape...");

    const { data: CAMPAIGNS } = await supabase.from('campaigns').select('name, url').eq('active', true);
    const { data: recipientsData } = await supabase.from('recipients').select('email').eq('active', true);
    const RECIPIENTS = recipientsData?.map(r => r.email) || [];

    if (!CAMPAIGNS?.length || !RECIPIENTS.length) {
        console.log("❌ Setup incomplete. Check Supabase tables.");
        return;
    }

    let browser;
    try {
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
        });
    } catch (err) {
        console.error("❌ Browserless connection failed:", err.message);
        return;
    }

    // RUN IN PARALLEL
    // This maps every campaign to a promise and runs them all at once
    const results = await Promise.all(CAMPAIGNS.map(project => scrapeProject(browser, project)));
    const updatesFound = results.filter(r => r !== null);

    await browser.close();

    if (updatesFound.length > 0) {
        console.log("✉️ Sending Email...");
        const emailHtml = updatesFound.map(p => `
            <div style="font-family: sans-serif; border: 2px solid #602fd6; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                <h2 style="color: #602fd6; margin-top: 0;">${p.name}</h2>
                <ul>${p.tasks.map(t => `<li style="margin-bottom:8px;"><strong>${t}</strong></li>`).join('')}</ul>
                <a href="${p.url}" style="display: inline-block; padding: 10px 20px; background-color: #602fd6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Sprint</a>
            </div>
        `).join('');

        try {
            await resend.emails.send({
                from: `ZealyBot <${SENDER_EMAIL}>`,
                to: RECIPIENTS,
                subject: `🚨 NEW Quests: ${updatesFound.map(u => u.name).join(', ')}`,
                html: emailHtml,
            });
            console.log("📬 Notifications sent!");
        } catch (err) {
            console.error("❌ Resend Error:", err);
        }
    } else {
        console.log("✅ No new quests found.");
    }
}

run();
