# Zealy Quest Scraper

Automated Zealy quest monitoring system with Telegram and email notifications. Now deployable to Vercel as a serverless API!

## 🚀 Features

- 🔍 Scrapes multiple Zealy campaigns automatically
- 📱 Sends Telegram notifications for new quests
- 📧 Email alerts via Resend
- 💾 Stores quest history in Supabase
- 🌐 Deployable to Vercel as serverless API
- 🔐 API key authentication
- ⚡ External webhook triggering

## 📦 Deployment Options

### Option 1: Vercel (Serverless API) - **RECOMMENDED**

Perfect for external triggering from web apps, webhooks, or cron services.

**Quick Deploy:**
```bash
npm install -g vercel
vercel
```

See [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) for complete deployment guide.

**API Endpoints:**
- `GET /` - API information
- `GET /api/status` - Service status
- `POST /api/trigger` - Trigger scraper (requires API key)

**Trigger Example:**
```bash
curl -X POST https://your-app.vercel.app/api/trigger \
  -H "x-api-key: your-api-key"
```

### Option 2: Local/Standalone

Run directly on your machine or server.

```bash
# One-time run
node standalone.js

# Or use the original index.js (deprecated)
node index.js
```

## 🛠️ Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```env
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=@your_channel
RESEND_API_KEY=your_resend_key
SENDER_EMAIL=your@email.com
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_key
BROWSERLESS_TOKEN=your_browserless_token
API_KEY=your-secret-api-key
```

### 3. Setup Supabase Tables

Run the SQL in `supabase_setup.sql` in your Supabase SQL editor to create:
- `campaigns` table - Quest campaign URLs
- `recipients` table - Email recipients
- `quest_snapshots` table - Quest history tracking

## 📚 Usage

### Deploy to Vercel
```bash
vercel --prod
```

### Run Locally
```bash
node standalone.js
```

### Trigger via API
```bash
# Check status
curl https://your-app.vercel.app/api/status

# Trigger scraper
curl -X POST https://your-app.vercel.app/api/trigger \
  -H "x-api-key: your-api-key"
```

## 🔗 Integration Examples

### From Web Dashboard
```javascript
fetch('https://your-app.vercel.app/api/trigger', {
  method: 'POST',
  headers: { 'x-api-key': 'your-key' }
});
```

### From GitHub Actions
```yaml
- run: |
    curl -X POST https://your-app.vercel.app/api/trigger \
      -H "x-api-key: ${{ secrets.API_KEY }}"
```

### From Zapier/Make.com
- Webhook URL: `https://your-app.vercel.app/api/trigger`
- Method: POST
- Header: `x-api-key: your-key`

## 📁 Project Structure

```
zealybot/
├── api/                  # Vercel serverless functions
│   ├── index.js         # API home
│   ├── status.js        # Status endpoint
│   └── trigger.js       # Scraper trigger endpoint
├── scraper.js           # Core scraper logic
├── standalone.js        # Local execution script
├── index.js             # Original script (legacy)
├── vercel.json          # Vercel configuration
├── package.json         # Dependencies
├── .env                 # Environment variables (not in git)
└── VERCEL_DEPLOY.md     # Deployment guide
```

## 🔐 Security

- API key authentication required
- CORS enabled for web app integration
- Environment variables never committed
- Serverless = no persistent server to secure

## 📊 Response Format

```json
{
  "success": true,
  "message": "Scraper completed successfully",
  "timestamp": "2025-12-22T10:30:00.000Z",
  "data": {
    "totalCampaigns": 5,
    "newQuestsFound": 2,
    "results": [...]
  }
}
```

## 🆘 Support

- Check [VERCEL_DEPLOY.md](VERCEL_DEPLOY.md) for deployment help
- Review Vercel logs: `vercel logs`
- Test locally: `vercel dev`

## 📝 License

ISC

---

**Made with ❤️ for Zealy quest hunters**
