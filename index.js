const puppeteer = require('puppeteer-core');
const fs = require('fs');
const Mailjet = require('node-mailjet');

// --- HARDCODED SECRETS ---
const MAILJET_API_KEY = "176bbc4210cfc063e5cd785de67a7818";
const MAILJET_SECRET_KEY = "6722b4a24a9bc14726619d5f708ec958";
const BROWSERLESS_TOKEN = "2TU8b5vOv6e7eyqefe2d0ce98de5c5038fda2bf31f85075fd";

const SENDER_EMAIL = "nworahebuka.a@gmail.com"; 
const RECIPIENTS = [
    { Email: "nworahebuka360@gmail.com" }
];

const mailjet = Mailjet.apiConnect(MAILJET_API_KEY, MAILJET_SECRET_KEY);

// UPDATED CAMPAIGNS
const CAMPAIGNS = [
    { name: "WinterSupercycle", url: "https://zealy.io/cw/wintersupercycle/questboard/sprints" },
    { name: "EndlessProtocol", url: "https://zealy.io/cw/endlessprotocol/questboard/sprints" },
    { name: "Nobullies", url: "https://zealy.io/cw/nobullies/questboard/sprints" },
    { name: "DarkExGlobal", url: "https://zealy.io/cw/darkexglobal/questboard/sprints" }
];

async function run() {
    console.log("🚀 Starting Scrape for Endless & DarkEx...");
    
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
        console.log("✉️ Sending Mailjet Email...");
        try {
            await mailjet
                .post("send", { version: 'v3.1' })
                .request({
                    Messages: [{
                        From: { Email: SENDER_EMAIL, Name: "ZealyBot" },
                        To: RECIPIENTS,
                        Subject: `🚨 NEW Quests: ${updatesFound.map(u => u.name).join(', ')}`,
                        HTMLPart: updatesFound.map(p => `
                            <div style="font-family: sans-serif; border: 1px solid #602fd6; padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                                <h2 style="color: #602fd6;">${p.name}</h2>
                                <ul>${p.tasks.map(t => `<li><strong>${t}</strong></li>`).join('')}</ul>
                                <p><a href="https://zealy.io/cw/${p.name.toLowerCase()}">Go to Sprint</a></p>
                            </div>
                        `).join('')
                    }]
                });
            
            fs.writeFileSync('database.json', JSON.stringify(db, null, 2), 'utf8');
            console.log("📬 Email Sent Successfully!");
        } catch (err) {
            console.error("❌ Mailjet Error:", err.statusCode);
        }
    } else {
        console.log("✅ No new quests found.");
    }
}

run();
