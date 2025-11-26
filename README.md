# Calendly → Attio CRM Integration

Automatically sync AI-generated call summaries from Calendly Notetaker to Attio CRM.

## How It Works

```
Calendly Meeting Ends
        ↓
  Webhook Triggered
        ↓
  Poll for Transcript (with retry)
        ↓
  GPT-4o Generates Summary
        ↓
  Find/Create Person in Attio
        ↓
  Add Note to Person Record
```

## Quick Start

### 1. Install Node.js (if not installed)

**macOS:**
```bash
# Install Homebrew first (if you don't have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

**Or download directly:** https://nodejs.org/

### 2. Clone and Setup

```bash
# Clone this repo
git clone https://github.com/YOUR_USERNAME/calendly-attio-sync.git
cd calendly-attio-sync

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 3. Add Your API Keys

Edit `.env` with your keys:

```env
CALENDLY_PAT=your_calendly_token
ATTIO_API_KEY=your_attio_key
OPENAI_API_KEY=sk-your_openai_key
SLACK_WEBHOOK_URL=https://hooks.slack.com/...  # optional
```

**Where to get these:**
- **Calendly PAT:** Settings → Integrations → API & Webhooks
- **Attio API Key:** Settings → Developers → API Keys
- **OpenAI Key:** https://platform.openai.com/api-keys
- **Slack Webhook:** https://api.slack.com/messaging/webhooks

### 4. Run the Server

```bash
npm start
```

You should see:
```
✅ Environment variables validated
{"timestamp":"...","level":"info","message":"Server running on port 3000"}
```

### 5. Expose to Internet (for Calendly webhook)

Use ngrok or similar to get a public URL:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL.

### 6. Register Calendly Webhook

```bash
curl -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Authorization: Bearer YOUR_CALENDLY_PAT" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://YOUR_NGROK_URL/webhook/calendly",
    "events": ["invitee.created"],
    "organization": "https://api.calendly.com/organizations/YOUR_ORG_ID",
    "scope": "organization"
  }'
```

To find your organization ID:
```bash
curl -H "Authorization: Bearer YOUR_CALENDLY_PAT" \
  https://api.calendly.com/users/me
```

## Deployment Options

### Option A: Railway (Recommended for beginners)

1. Push code to GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Add environment variables in Railway dashboard
5. Railway gives you a public URL automatically

### Option B: Your n8n Server

```bash
# On your server
git clone https://github.com/YOUR_USERNAME/calendly-attio-sync.git
cd calendly-attio-sync
npm install

# Create .env file with your keys
nano .env

# Run with PM2 (process manager)
npm install -g pm2
pm2 start src/index.js --name calendly-attio
pm2 save
pm2 startup
```

### Option C: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
```

## Testing

```bash
# Start server in one terminal
npm start

# Send test webhook in another terminal
npm test
```

## Project Structure

```
├── src/
│   ├── index.js              # Express server entry point
│   └── services/
│       ├── config.js         # Environment validation
│       ├── logger.js         # Structured JSON logging
│       ├── webhook-handler.js # Main orchestration
│       ├── calendly.js       # Calendly API calls
│       ├── openai.js         # GPT-4o summary generation
│       ├── attio.js          # Attio CRM operations
│       └── slack.js          # Error notifications
├── test/
│   └── test-webhook.js       # Manual testing script
├── .env.example              # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Missing required environment variables` | Copy `.env.example` to `.env` and fill in keys |
| Transcript never ready | Check Calendly Notetaker is enabled for your event type |
| Attio person not found | The email must match exactly in Attio |
| OpenAI rate limit | Add retry logic or upgrade OpenAI plan |

## License

MIT
