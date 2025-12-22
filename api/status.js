module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({
        status: 'running',
        service: 'Zealy Scraper API',
        timestamp: new Date().toISOString(),
        endpoints: {
            'POST /api/trigger': 'Trigger scraper (requires x-api-key header or api_key query param)',
            'GET /api/status': 'Check service status (this endpoint)'
        },
        environment: {
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasResendKey: !!process.env.RESEND_API_KEY,
            hasBrowserlessToken: !!process.env.BROWSERLESS_TOKEN,
            hasApiKey: !!process.env.API_KEY
        }
    });
};
