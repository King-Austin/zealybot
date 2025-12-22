# Zealy Scraper - Vercel Deployment Guide

## 🚀 Quick Deploy to Vercel

This Zealy scraper is now configured as a serverless API that can be deployed to Vercel.

### Prerequisites
1. Vercel account (free tier works)
2. Vercel CLI installed: `npm i -g vercel`

### Deployment Steps

#### Option 1: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - What's your project's name? zealybot
# - In which directory is your code located? ./
# - Want to override settings? No
```

#### Option 2: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository (or upload project)
3. Configure environment variables (see below)
4. Click "Deploy"

### Environment Variables Setup

Add these in Vercel Dashboard → Settings → Environment Variables:

```env
TELEGRAM_TOKEN=8301228952:AAHk4m2Qf-taF_ORraRUgd73Jz01Rlzm9vo
TELEGRAM_CHAT_ID=@taskmonitor
RESEND_API_KEY=re_YXDS5oN1_Lat9doHJJEQJ7LHjqgF4az6U
SENDER_EMAIL=nworahebuka.a@gmail.com
SUPABASE_URL=https://tspthoncyokigxqdfoqw.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
BROWSERLESS_TOKEN=2TU8b5vOv6e7eyqefe2d0ce98de5c5038fda2bf31f85075fd
API_KEY=your-super-secret-api-key-here
```

**Important:** Change `API_KEY` to a secure random string!

### API Endpoints

Once deployed, your API will be available at:

```
https://your-project.vercel.app/
```

#### Available Endpoints:

1. **GET /** - API information
   ```bash
   curl https://your-project.vercel.app/
   ```

2. **GET /api/status** - Check service status
   ```bash
   curl https://your-project.vercel.app/api/status
   ```

3. **POST /api/trigger** - Trigger scraper (requires auth)
   ```bash
   curl -X POST https://your-project.vercel.app/api/trigger \
     -H "x-api-key: your-super-secret-api-key-here"
   ```

### Usage Examples

#### Trigger from Zapier/Make.com
- URL: `https://your-project.vercel.app/api/trigger`
- Method: POST
- Headers: `x-api-key: your-api-key`

#### Trigger from GitHub Actions
```yaml
- name: Trigger Zealy Scraper
  run: |
    curl -X POST https://your-project.vercel.app/api/trigger \
      -H "x-api-key: ${{ secrets.SCRAPER_API_KEY }}"
```

#### Trigger from Cron Job
```bash
# Add to crontab (runs every hour)
0 * * * * curl -X POST https://your-project.vercel.app/api/trigger -H "x-api-key: YOUR_KEY"
```

#### Trigger from Your Web App
```javascript
const response = await fetch('https://your-project.vercel.app/api/trigger', {
  method: 'POST',
  headers: {
    'x-api-key': 'your-api-key'
  }
});
const result = await response.json();
console.log(result);
```

### Testing Locally

```bash
# Install Vercel CLI
npm i -g vercel

# Run development server
vercel dev

# Test the endpoint
curl -X POST http://localhost:3000/api/trigger \
  -H "x-api-key: your-api-key"
```

### Response Format

**Success Response:**
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

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-12-22T10:30:00.000Z"
}
```

### Security Best Practices

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use strong API keys** - Generate random strings: `openssl rand -hex 32`
3. **Rotate keys regularly** - Update in Vercel dashboard
4. **Monitor usage** - Check Vercel dashboard for unusual activity
5. **Use HTTPS** - Vercel provides this automatically

### Vercel Limits (Free Tier)

- ⏱️ Function execution: 10 seconds max
- 📦 Deployment size: 100MB
- 🔄 Bandwidth: 100GB/month
- ⚡ Serverless function invocations: Unlimited

**Note:** For longer scraping tasks, consider:
- Optimizing scraping logic
- Using Vercel Pro ($20/month) for 60s timeout
- Or deploying to Railway/Render with longer timeouts

### Troubleshooting

**Timeout errors?**
- Reduce concurrent scraping (`pLimit(3)` → `pLimit(1)`)
- Scrape fewer campaigns per request
- Split into multiple API calls

**Environment variables not working?**
- Check Vercel Dashboard → Settings → Environment Variables
- Redeploy after adding variables
- Use `vercel env pull` to sync locally

**Scraper not working?**
- Check Vercel Function logs
- Verify all environment variables are set
- Test Browserless token is valid

### Support

For issues or questions:
- Check Vercel logs: `vercel logs`
- Test locally: `vercel dev`
- Review API responses for error details
