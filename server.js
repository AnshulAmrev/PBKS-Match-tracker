const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Send email alert when tickets go on sale
async function sendTicketAlert(match) {
  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail || !process.env.GMAIL_APP_PASSWORD) {
    console.log('   ⚠️  Email not configured — skipping alert');
    return;
  }

  const districtUrl = match.bookingUrl || DISTRICT_TEAM_URL;

  const mailOptions = {
    from: `"🏏 IPL Ticket Tracker" <${process.env.GMAIL_USER}>`,
    to: alertEmail,
    subject: `🎟️ TICKETS LIVE: PBKS vs ${match.opponent} — ${match.date}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0F172A; color: #F8FAFC; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #DC2626, #B91C1C); padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">🏏 Ticket Sale is LIVE!</h1>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #FCD34D; margin-top: 0;">Punjab Kings vs ${match.opponent}</h2>
          <table style="width: 100%; color: #94A3B8; font-size: 15px;">
            <tr><td style="padding: 8px 0;">📅 Date</td><td style="padding: 8px 0; color: #F8FAFC; font-weight: bold;">${match.date}</td></tr>
            <tr><td style="padding: 8px 0;">⏰ Time</td><td style="padding: 8px 0; color: #F8FAFC; font-weight: bold;">${match.time}</td></tr>
            <tr><td style="padding: 8px 0;">🏟️ Venue</td><td style="padding: 8px 0; color: #F8FAFC; font-weight: bold;">${match.venueFullName}</td></tr>
          </table>
          <div style="text-align: center; margin-top: 24px;">
            <a href="${districtUrl}" style="display: inline-block; background: linear-gradient(135deg, #22C55E, #16A34A); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: bold;">
              🎟️ Book Tickets Now on District.in
            </a>
          </div>
          <p style="color: #64748B; font-size: 12px; margin-top: 24px; text-align: center;">
            Sent by IPL Ticket Tracker • <a href="http://localhost:${PORT}" style="color: #F59E0B;">Open Dashboard</a>
          </p>
        </div>
      </div>
    `,
    text: `🎟️ TICKETS LIVE: PBKS vs ${match.opponent}\n\n📅 ${match.date}\n⏰ ${match.time}\n🏟️ ${match.venueFullName}\n\n🔗 Book now: ${districtUrl}`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`   📧 Email alert sent to ${alertEmail} (${info.messageId})`);
  } catch (err) {
    console.error(`   ❌ Failed to send email: ${err.message}`);
  }
}

// District.in URLs
const DISTRICT_TEAM_URL = 'https://www.district.in/events/punjab-kings-team';

// Punjab Kings IPL 2026 match schedule — from District.in
const PBKS_MATCHES = [
  {
    id: 1,
    opponent: "Rajasthan Royals",
    opponentShort: "RR",
    date: "2026-04-28",
    time: "14:00",
    venue: "Mohali",
    venueFullName: "New International Cricket Stadium, Mohali",
    isHome: true
  },
  {
    id: 2,
    opponent: "Delhi Capitals",
    opponentShort: "DC",
    date: "2026-05-11",
    time: "14:00",
    venue: "Dharamshala",
    venueFullName: "Himachal Pradesh Cricket Association Stadium, Dharamshala",
    isHome: true
  },
  {
    id: 3,
    opponent: "Mumbai Indians",
    opponentShort: "MI",
    date: "2026-05-14",
    time: "14:00",
    venue: "Dharamshala",
    venueFullName: "Himachal Pradesh Cricket Association Stadium, Dharamshala",
    isHome: true
  },
  {
    id: 4,
    opponent: "Royal Challengers Bangalore",
    opponentShort: "RCB",
    date: "2026-05-17",
    time: "10:00",
    venue: "Dharamshala",
    venueFullName: "Himachal Pradesh Cricket Association Stadium, Dharamshala",
    isHome: true
  }
];

// Store ticket availability status
const ticketStatus = new Map();

// Initialize all matches as "checking"
PBKS_MATCHES.forEach(match => {
  ticketStatus.set(match.id, {
    status: 'checking',
    lastChecked: null,
    bookingUrl: DISTRICT_TEAM_URL,
    priceRange: null,
    error: null
  });
});

// Parse the team page and extract per-match ticket status
async function checkAllTickets() {
  console.log(`[${new Date().toLocaleTimeString()}] Checking ticket availability for all PBKS matches...`);

  try {
    const response = await fetch(DISTRICT_TEAM_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 15000
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style tags before extracting text
    $('script, style, noscript').remove();

    // Extract clean text from body (strips all HTML tags)
    const cleanText = $('body').text().replace(/\s+/g, ' ').toLowerCase();

    console.log('   [DEBUG] Clean text length:', cleanText.length);
    // Log a snippet for debugging
    const saleIdx = cleanText.indexOf('sale is live');
    if (saleIdx >= 0) {
      console.log('   [DEBUG] Found "sale is live" at index', saleIdx, ':', cleanText.substring(Math.max(0, saleIdx - 80), saleIdx + 80));
    }
    const comingIdx = cleanText.indexOf('coming soon');
    if (comingIdx >= 0) {
      console.log('   [DEBUG] Found "coming soon" at index', comingIdx, ':', cleanText.substring(Math.max(0, comingIdx - 80), comingIdx + 80));
    }

    PBKS_MATCHES.forEach((match, idx) => {
      const opponentLower = match.opponent.toLowerCase();
      const previousStatus = ticketStatus.get(match.id)?.status;

      // Find where "punjab kings vs <opponent>" appears
      const matchPhrase = `punjab kings vs ${opponentLower}`;
      const opponentIndex = cleanText.indexOf(matchPhrase);
      let status = 'not_listed';
      let bookingUrl = DISTRICT_TEAM_URL;

      if (opponentIndex === -1) {
        status = 'not_listed';
      } else {
        // Find the NEXT match listing to bound our search
        const searchStart = opponentIndex + matchPhrase.length;
        let searchEnd = cleanText.length;

        // Look for the next "punjab kings vs" to find where this match's section ends
        const nextMatchIndex = cleanText.indexOf('punjab kings vs', searchStart);
        if (nextMatchIndex !== -1) {
          searchEnd = nextMatchIndex;
        }

        // Only look at text BETWEEN this match and the next match
        const context = cleanText.substring(searchStart, searchEnd);

        console.log(`   [DEBUG] vs ${match.opponentShort} section: "${context.substring(0, 100)}..."`);

        if (context.includes('sale is live') || context.includes('book tickets') || context.includes('book now') || context.includes('buy tickets')) {
          status = 'available';
        } else if (context.includes('sold out') || context.includes('housefull')) {
          status = 'sold_out';
        } else if (context.includes('coming soon')) {
          status = 'coming_soon';
        } else if (context.includes('notify me') || context.includes('notify')) {
          status = 'coming_soon';
        } else {
          status = 'listed';
        }
      }

      // Try to find direct booking links from the HTML
      const opponentSlug = match.opponent.toLowerCase().replace(/\s+/g, '-');
      $(`a[href*="${opponentSlug}"]`).each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href) {
          bookingUrl = href.startsWith('http') ? href : `https://www.district.in${href}`;
        }
      });

      ticketStatus.set(match.id, {
        status,
        lastChecked: new Date().toISOString(),
        bookingUrl,
        priceRange: null,
        error: null
      });

      if (status === 'available' && previousStatus !== 'available') {
        console.log(`🎟️  TICKETS ON SALE: PBKS vs ${match.opponent} on ${match.date} at ${match.venue}!`);
        sendTicketAlert(match);
      }

      console.log(`   Match ${match.id} (vs ${match.opponentShort}): ${status}`);
    });

  } catch (err) {
    console.error(`[${new Date().toLocaleTimeString()}] Error checking tickets:`, err.message);
    PBKS_MATCHES.forEach(match => {
      ticketStatus.set(match.id, {
        status: 'error',
        lastChecked: new Date().toISOString(),
        bookingUrl: DISTRICT_TEAM_URL,
        priceRange: null,
        error: err.message
      });
    });
  }

  console.log(`[${new Date().toLocaleTimeString()}] Check complete.`);
}

// API: Get all matches with their ticket status
app.get('/api/matches', (req, res) => {
  const matches = PBKS_MATCHES.map(match => ({
    ...match,
    ticketStatus: ticketStatus.get(match.id)
  }));
  res.json({ matches, lastGlobalCheck: new Date().toISOString() });
});

// API: Force refresh all matches (single page fetch)
app.post('/api/check/:matchId', async (req, res) => {
  await checkAllTickets();
  const matchId = parseInt(req.params.matchId);
  const match = PBKS_MATCHES.find(m => m.id === matchId);
  if (!match) return res.status(404).json({ error: 'Match not found' });
  res.json({ match, ticketStatus: ticketStatus.get(match.id) });
});

// API: Force refresh all matches
app.post('/api/check-all', async (req, res) => {
  await checkAllTickets();
  const matches = PBKS_MATCHES.map(match => ({
    ...match,
    ticketStatus: ticketStatus.get(match.id)
  }));
  res.json({ matches });
});

// Start periodic checking (every 30 minutes)
const CHECK_INTERVAL = 30 * 60 * 1000;
setInterval(checkAllTickets, CHECK_INTERVAL);

// Initial check on startup
setTimeout(checkAllTickets, 3000);

// API: Test email delivery
app.post('/api/test-email', async (req, res) => {
  const testMatch = PBKS_MATCHES[0];
  const alertEmail = process.env.ALERT_EMAIL;

  if (!alertEmail || !process.env.GMAIL_APP_PASSWORD || !process.env.GMAIL_USER) {
    return res.json({
      success: false,
      message: `Missing env vars — GMAIL_USER: ${process.env.GMAIL_USER ? 'set' : 'MISSING'}, GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? 'set' : 'MISSING'}, ALERT_EMAIL: ${alertEmail || 'MISSING'}`
    });
  }

  try {
    const info = await transporter.sendMail({
      from: `"🏏 IPL Ticket Tracker" <${process.env.GMAIL_USER}>`,
      to: alertEmail,
      subject: `🎟️ TEST: PBKS vs ${testMatch.opponent} — ${testMatch.date}`,
      html: `<div style="font-family:Arial;padding:20px;background:#0F172A;color:#F8FAFC;border-radius:12px;">
        <h2 style="color:#FCD34D;">✅ Test Email Working!</h2>
        <p>This confirms your IPL Ticket Tracker email alerts are configured correctly.</p>
        <p>You'll receive an email like this when tickets for <b>PBKS vs ${testMatch.opponent}</b> go on sale.</p>
        <p><a href="https://www.district.in/events/punjab-kings-team" style="color:#22C55E;">View on District.in</a></p>
      </div>`,
      text: `Test email working! You'll be notified when PBKS tickets go on sale.`,
    });
    res.json({ success: true, message: `Test email sent to ${alertEmail} (${info.messageId})` });
  } catch (err) {
    console.error('Test email error:', err.message);
    res.json({ success: false, message: `Email failed: ${err.message}` });
  }
});

// API: Check email config status (no secrets exposed)
app.get('/api/email-status', (req, res) => {
  res.json({
    gmail_user: process.env.GMAIL_USER ? process.env.GMAIL_USER : 'NOT SET',
    gmail_password: process.env.GMAIL_APP_PASSWORD ? '****SET****' : 'NOT SET',
    alert_email: process.env.ALERT_EMAIL ? process.env.ALERT_EMAIL : 'NOT SET',
  });
});

app.listen(PORT, () => {
  console.log(`\n🏏 IPL Ticket Tracker — Punjab Kings`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`🔄 Auto-checking every ${CHECK_INTERVAL / 60000} minutes`);
  console.log(`📧 Email alerts: ${process.env.ALERT_EMAIL || 'NOT CONFIGURED'}`);
  console.log(`📡 Monitoring ${PBKS_MATCHES.length} home matches on District.in\n`);
});
