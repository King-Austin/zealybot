const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { Resend } = require('resend');

// --- HARDCODED SECRETS ---
const RESEND_KEY = "re_YXDS5oN1_Lat9doHJJEQJ7LHjqgF4az6U";
const BROWSERLESS_TOKEN = "2TU8b5vOv6e7eyqefe2d0ce98de5c5038fda2bf31f85075fd";
const MY_DESTINATION_EMAIL = "PASTE_YOUR_EMAIL_HERE@example.com"; 

const resend = new Resend(RESEND_KEY);

const CAMPAIGNS = [
    { name: "WinterSupercycle", url: "https://zealy.io/cw/wintersupercycle/questboard/sprints" },
    { name: "Somnia", url: "https://zealy.io/cw/somnianetwork/questboard/sprints" }
];

async function run() {
    console.log("🚀 Starting Hardcore Scrape...");
    const browser = await puppeteer.connect({
        browserWSEndpoint: `ws://lesson.browserless.io?token=${BROWSERLESS_TOKEN}`
    });

    let db = {};
    if (fs.existsSync('database.json')) {
        db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
    }

    let updatesFound = [];

    for (const project of CAMPAIGNS) {
        const page = await browser.newPage();
        try {
            console.log(`🔍 Checking: ${project.name}`);
            await page.goto(project.url, { waitUntil: 'networkidle2', timeout: 60000 });
            await page.waitForSelector('.quest-card-quest-name', { timeout: 15000 });

            const currentTasks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.quest-card-quest-name'))
                            .map(e => e.innerText.trim());
            });

            const oldTasks = db[project.name] || [];
            const newOnes = currentTasks.filter(t => !oldTasks.includes(t));

            if (newOnes.length > 0) {
                updatesFound.push({ name: project.name, tasks: newOnes });
                db[project.name] = currentTasks;
            }
        } catch (e) {
            console.log(`⚠️ ${project.name} failed: ${e.message}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();

    if (updatesFound.length > 0) {
        console.log("✉️ Sending Resend Email...");
        await resend.emails.send({
            from: 'ZealyBot <onboarding@resend.dev>',
            to: [MY_DESTINATION_EMAIL],
            subject: `🚨 ${updatesFound.length} Projects Updated!`,
            html: updatesFound.map(p => `<h3>${p.name}</h3><ul>${p.tasks.map(t=>`<li>${t}</li>`).join('')}</ul>`).join('')
        });
        fs.writeFileSync('database.json', JSON.stringify(db, null, 2));
    } else {
        console.log("✅ Everything up to date. No new quests.");
    }
}

run();