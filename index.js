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

// Function to get quest history from Supabase
async function getQuestHistory(campaignName) {
    try {
        const { data, error } = await supabase
            .from('quest_history')
            .select('quest_names')
            .eq('campaign_name', campaignName)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return []; // No rows found
            console.error('Error fetching quest history:', error);
            return [];
        }
        return data?.quest_names || [];
    } catch (err) {
        console.error('Failed to fetch quest history:', err);
        return [];
    }
}

// Function to update quest history in Supabase
async function updateQuestHistory(campaignName, questNames) {
    const { error } = await supabase
        .from('quest_history')
        .upsert({
            campaign_name: campaignName,
            quest_names: questNames
        }, {
            onConflict: 'campaign_name'
        });

    if (error) {
        console.error('❌ Error updating quest history:', error);
    }
}

// Function to update campaign last checked time and new quests count
async function updateCampaignLastChecked(campaignName, newQuestsCount = 0) {
    const { error } = await supabase
        .from('campaigns')
        .update({
            last_checked: new Date().toISOString(),
            new_quests_count: newQuestsCount
        })
        .eq('name', campaignName);

    if (error) {
        console.error('❌ Error updating campaign last checked:', error);
    }
}

// Function to create a scraper run record
async function createScraperRun() {
    const { data, error } = await supabase
        .from('scraper_runs')
        .insert({
            status: 'running'
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Error creating scraper run:', error);
        return null;
    }

    return data.id;
}

// Function to update scraper run status
async function updateScraperRun(runId, updates) {
    const { error } = await supabase
        .from('scraper_runs')
        .update({
            ...updates,
            completed_at: new Date().toISOString()
        })
        .eq('id', runId);

    if (error) {
        console.error('❌ Error updating scraper run:', error);
    }
}

async function run() {
    console.log("🚀 Starting Zealy Quest Scraper...");

    // Create scraper run record
    const runId = await createScraperRun();
    const startTime = Date.now();

    try {
        // Fetch campaigns and recipients from Supabase
        const CAMPAIGNS = await fetchCampaigns();
        const RECIPIENTS = await fetchRecipients();

        if (CAMPAIGNS.length === 0) {
            console.error("❌ No campaigns found in database");
            await updateScraperRun(runId, { status: 'failed', error_message: 'No campaigns found' });
            return;
        }

        if (RECIPIENTS.length === 0) {
            console.error("❌ No recipients found in database");
            await updateScraperRun(runId, { status: 'failed', error_message: 'No recipients found' });
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
            await updateScraperRun(runId, { status: 'failed', error_message: `Browser connection failed: ${err.message}` });
            return;
        }

        let updatesFound = [];
        let totalNewQuests = 0;

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

                const oldTasks = await getQuestHistory(project.name);
                const newOnes = currentTasks.filter(t => !oldTasks.includes(t));

                if (newOnes.length > 0) {
                    console.log(`✨ Found ${newOnes.length} NEW quests for ${project.name}`);
                    updatesFound.push({ name: project.name, tasks: newOnes });
                    totalNewQuests += newOnes.length;

                    // Update quest history in Supabase
                    await updateQuestHistory(project.name, currentTasks);
                }

                // Update campaign last checked time and new quests count
                await updateCampaignLastChecked(project.name, newOnes.length);

            } catch (e) {
                console.log(`⚠️ ${project.name} skip (No active quests or page error).`);
                // Still update last checked time even on error
                await updateCampaignLastChecked(project.name, 0);
            } finally {
                await page.close();
            }
        }

        await browser.close();

        // Update scraper run with results
        const duration = Math.round((Date.now() - startTime) / 1000);
        await updateScraperRun(runId, {
            status: 'completed',
            campaigns_checked: CAMPAIGNS.length,
            total_new_quests: totalNewQuests,
            duration_seconds: duration
        });

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
                    to: RECIPIENTS.map(r => r.Email),
                    subject: `🚨 NEW Quests: ${updatesFound.map(u => u.name).join(', ')}`,
                    html: emailHtml,
                });

                if (error) {
                    console.error("❌ Resend Error:", error);
                    await updateScraperRun(runId, { emails_sent: false, error_message: error.message });
                } else {
                    console.log("📬 Email Sent Successfully!", data);
                    await updateScraperRun(runId, { emails_sent: true });
                }
            } catch (err) {
                console.error("❌ Email sending failed:", err);
                await updateScraperRun(runId, { emails_sent: false, error_message: err.message });
            }
        } else {
            console.log("✅ No new quests found.");
        }

    } catch (error) {
        console.error("❌ Scraper failed:", error);
        await updateScraperRun(runId, {
            status: 'failed',
            error_message: error.message,
            duration_seconds: Math.round((Date.now() - startTime) / 1000)
        });
}

run();
