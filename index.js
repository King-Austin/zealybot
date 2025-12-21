const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const TelegramBot = require('node-telegram-bot-api');
const { Resend } = require('resend');
const { createClient } = require('@supabase/supabase-js');
const pLimit = require('p-limit');
require('dotenv').config();

puppeteer.use(StealthPlugin());

// Config
const TELEGRAM_TOKEN = '8301228952:AAHk4m2Qf-taF_ORraRUgd73Jz01Rlzm9vo';
const TELEGRAM_CHAT_ID = '@taskmonitor'; // Public channel username
const bot = new TelegramBot(TELEGRAM_TOKEN);
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const limit = pLimit(3);

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0, distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight) { clearInterval(timer); resolve(); }
            }, 100);
        });
    });
}

async function scrapeProject(browser, project) {
    return limit(async () => {
        const page = await browser.newPage();
        try {
            console.log(`🔍 Checking: ${project.name}`);
            await page.goto(project.url, { waitUntil: 'networkidle2', timeout: 60000 });
            const exists = await page.$('.quest-card-quest-name');
            if (!exists) return { name: project.name, status: 'No Quests', new: [], url: project.url };

            await autoScroll(page);
            await new Promise(r => setTimeout(r, 2000));

            const currentTasks = await page.evaluate(() => 
                Array.from(document.querySelectorAll('.quest-card-quest-name')).map(e => e.innerText.trim())
            );

            const { data } = await supabase.from('quest_snapshots').select('task_list').eq('campaign_name', project.name).single();
            const oldTasks = data ? data.task_list : [];
            const newOnes = currentTasks.filter(t => !oldTasks.includes(t));

            await supabase.from('quest_snapshots').upsert({ 
                campaign_name: project.name, task_list: currentTasks, updated_at: new Date() 
            }, { onConflict: 'campaign_name' });

            return { name: project.name, status: 'Active', new: newOnes, url: project.url };
        } catch (e) {
            return { name: project.name, status: 'Error', new: [], url: project.url };
        } finally { await page.close(); }
    });
}

async function run() {
    const { data: CAMPAIGNS } = await supabase.from('campaigns').select('name, url').eq('active', true);
    const { data: recs } = await supabase.from('recipients').select('email').eq('active', true);
    const RECIPIENTS = recs?.map(r => r.email) || [];

    const browser = await puppeteer.connect({ browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}` });
    const results = await Promise.all(CAMPAIGNS.map(p => scrapeProject(browser, p)));
    await browser.close();

    const updates = results.filter(r => r.new.length > 0);
    
    // 1. Prepare Telegram Message
    let teleMsg = updates.length > 0 
        ? `🚨 *NEW ZEALY QUESTS DETECTED*\n\n` 
        : `✅ *Zealy Status: No New Quests*\n\n`;

    results.forEach(p => {
        teleMsg += `🔹 *${p.name}* (${p.status})\n`;
        if (p.new.length > 0) {
            p.new.forEach(t => teleMsg += `  • ${t}\n`);
            teleMsg += `🔗 [Join Sprint](${p.url})\n`;
        }
        teleMsg += `\n`;
    });

    // 2. Send Telegram
    try {
        await bot.sendMessage(TELEGRAM_CHAT_ID, teleMsg, { parse_mode: 'Markdown' });
        console.log("📱 Telegram Sent!");
    } catch (e) { console.error("❌ Telegram Fail:", e.message); }

    // 3. Send Email (Always)
    const emailHtml = `<h1>Zealy Report</h1>` + results.map(p => `
        <div style="border-left: 4px solid ${p.new.length ? '#602fd6' : '#ccc'}; padding: 10px; margin: 10px 0;">
            <b>${p.name}</b>: ${p.new.length ? p.new.join(', ') : 'No new tasks'}
        </div>
    `).join('');

    await resend.emails.send({
        from: `ZealyBot <${process.env.SENDER_EMAIL}>`,
        to: RECIPIENTS,
        subject: updates.length ? `🚨 New Quests found!` : `✅ Status: All quiet`,
        html: emailHtml
    });
}

run();
