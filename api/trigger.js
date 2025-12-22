const { runScraper } = require('../scraper');

// Middleware to check API key
function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const validApiKey = process.env.API_KEY || 'your-secure-api-key';
    
    if (apiKey !== validApiKey) {
        return res.status(401).json({ 
            success: false,
            error: 'Unauthorized - Invalid API key' 
        });
    }
    next();
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false,
            error: 'Method not allowed. Use POST to trigger scraper.' 
        });
    }

    // Check authentication
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    const validApiKey = process.env.API_KEY;
    
    if (!apiKey || apiKey !== validApiKey) {
        return res.status(401).json({ 
            success: false,
            error: 'Unauthorized - Invalid or missing API key',
            hint: 'Include x-api-key in headers or api_key in query params'
        });
    }

    try {
        console.log('🚀 Scraper triggered at', new Date().toISOString());

        const config = {
            TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '8301228952:AAHk4m2Qf-taF_ORraRUgd73Jz01Rlzm9vo',
            TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '@taskmonitor',
            RESEND_API_KEY: process.env.RESEND_API_KEY,
            SENDER_EMAIL: process.env.SENDER_EMAIL,
            SUPABASE_URL: process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
            BROWSERLESS_TOKEN: process.env.BROWSERLESS_TOKEN
        };

        // Validate required config
        const missing = [];
        if (!config.RESEND_API_KEY) missing.push('RESEND_API_KEY');
        if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
        if (!config.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
        if (!config.BROWSERLESS_TOKEN) missing.push('BROWSERLESS_TOKEN');
        if (!config.SENDER_EMAIL) missing.push('SENDER_EMAIL');

        if (missing.length > 0) {
            return res.status(500).json({
                success: false,
                error: 'Missing required environment variables',
                missing: missing
            });
        }

        const result = await runScraper(config);

        return res.status(200).json({
            success: true,
            message: 'Scraper completed successfully',
            timestamp: new Date().toISOString(),
            data: result
        });

    } catch (error) {
        console.error('❌ Scraper error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};
