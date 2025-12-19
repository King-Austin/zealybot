const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { Resend } = require('resend');

const RESEND_KEY = "re_YXDS5oN1_Lat9doHJJEQJ7LHjqgF4az6U";
const BROWSERLESS_TOKEN = "2TU8b5vOv6e7eyqefe2d0ce98de5c5038fda2bf31f85075fd";
const MY_DESTINATION_EMAIL = "nworahebuka@gmail.com"; 

const resend = new Resend(RESEND_KEY);

const CAMPAIGNS = [
    { name: "WinterSupercycle", url: "https://zealy.io/cw/wintersupercycle/questboard/sprints" },
    { name: "Somnia", url: "https://zealy.io/cw/somnianetwork/questboard/sprints" }
];

async function run() {
    console.log("🚀 Starting Hardcore Scrape...");
    
    let browser;
    try {
        browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
        });
        console.log("✅ Connected to Browserless Production");
    } catch (err) {
        console.error("❌ CONNECTION FAILED:", err.message);
        return; 
    }

    // --- IMPROVED DATABASE LOADING ---
    let db = {};
    if (fs.existsSync('database.json')) {
        try {
            const rawData = fs.readFileSync('database.json', 'utf8');
            // This removes the "" and other hidden characters automatically
            const cleanData = rawData.replace(/^\uFEFF/, '').trim(); 
            db = JSON.parse(cleanData || '{}');
        } catch (e) {
            console.log("⚠️ Database file corrupted, resetting to empty...");
            db = {};
        }
    }

    let updatesFound = [];

    for (const project of CAMPAIGNS) {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        try {
            console.log(`🔍 Checking: ${project.name}`);
            await page.goto(project.url, { waitUntil: 'networkidle2', timeout: 60000 });
            
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
            console.log(`⚠️ ${project.name} error or no quests active.`);
        } finally {
            await page.close();
        }
    }

    await browser.close();

    if (updatesFound.length > 0) {
        console.log("✉️ Sending Resend Email...");
        try {
            await resend.emails.send({
                from: 'ZealyBot <onboarding@resend.dev>',
                to: [MY_DESTINATION_EMAIL],
                subject: `🚨 ${updatesFound.length} Projects Updated!`,
                html: updatesFound.map(p => `
                    <div style="font-family: sans-serif; padding: 15px; border: 1px solid #602fd6; border-radius: 10px; margin-bottom: 20px;">
                        <h2 style="color: #602fd6;">${p.name}</h2>
                        <ul style="line-height: 1.6;">${p.tasks.map(t=>`<li><strong>${t}</strong></li>`).join('')}</ul>
                    </div>
                `).join('')
            });
            // Force save as UTF-8 to prevent future '' errors
            fs.writeFileSync('database.json', JSON.stringify(db, null, 2), 'utf8');
            console.log("✅ State saved.");
        } catch (mailErr) {
            console.error("❌ Mail error:", mailErr.message);
        }
    } else {
        console.log("✅ No new quests found.");
    }
}

run().catch(console.error);