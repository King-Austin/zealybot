module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    return res.status(200).json({
        message: 'Zealy Scraper API',
        version: '1.0.0',
        description: 'Automated Zealy quest monitoring and notification system',
        endpoints: {
            'GET /api/status': 'Check service status and configuration',
            'POST /api/trigger': 'Trigger scraper manually (requires API key authentication)'
        },
        authentication: {
            method: 'API Key',
            header: 'x-api-key',
            alternativeQueryParam: 'api_key'
        },
        documentation: 'https://github.com/yourusername/zealybot',
        timestamp: new Date().toISOString()
    });
};
