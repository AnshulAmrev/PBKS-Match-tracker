# IPL Ticket Tracker — Punjab Kings 🏏

Monitors [District.in](https://www.district.in/events/punjab-kings-team) for Punjab Kings IPL 2026 ticket availability and sends email alerts when tickets go on sale.

## Features
- 🔄 Auto-checks District.in every 30 minutes
- 📧 Email alerts via Gmail when tickets go live
- 🔔 Browser notifications
- 🎨 Beautiful dark-mode dashboard
- 🎟️ Direct booking links to District.in

## Setup

### Local
```bash
npm install
cp .env.example .env   # Edit with your Gmail credentials
npm start              # http://localhost:3000
```

### Environment Variables
| Variable | Description |
|----------|-------------|
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Gmail App Password ([Generate here](https://myaccount.google.com/apppasswords)) |
| `ALERT_EMAIL` | Email to receive ticket alerts |
| `PORT` | Server port (default: 3000) |

### Deploy to Railway
1. Push to GitHub
2. Connect repo on [railway.app](https://railway.app)
3. Add environment variables in Railway dashboard
4. Deploy!

## Disclaimer
Unofficial tracker. Not affiliated with Zomato, District, BCCI, or Punjab Kings.
