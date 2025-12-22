// standalone.js - Local execution of the scraper
require('dotenv').config();
const { runScraper } = require('./scraper');

async function main() {
    try {
        console.log('🚀 Starting Zealy Scraper...');
        
        const config = {
            TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8301228952:AAHk4m2Qf-taF_ORraRUgd73Jz01Rlzm9vo',
            TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '@taskmonitor',
            RESEND_API_KEY: process.env.RESEND_API_KEY,
            SENDER_EMAIL: process.env.SENDER_EMAIL,
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
            BROWSERLESS_TOKEN: process.env.BROWSERLESS_TOKEN
        };

        const result = await runScraper(config);
        
        console.log('✅ Scraper completed successfully');
        console.log('📊 Results:', JSON.stringify(result, null, 2));
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Scraper failed:', error);
        process.exit(1);
    }
}

main();

