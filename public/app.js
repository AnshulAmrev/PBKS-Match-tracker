// IPL Ticket Tracker — Punjab Kings — Client App

const STATUS_LABELS = {
  available: '🟢 Tickets On Sale!',
  coming_soon: '🟡 Coming Soon',
  listed: '🟡 Listed — No Tickets Yet',
  not_on_sale: '⚪ Not On Sale Yet',
  not_listed: '⚪ Not Listed Yet',
  sold_out: '🔴 Sold Out',
  error: '🟠 Check Failed',
  checking: '🟣 Checking...',
  unknown: '🟣 Checking...'
};

const STATUS_SHORT = {
  available: 'Sale is Live!',
  coming_soon: 'Coming Soon',
  listed: 'Listed — No Tickets',
  not_on_sale: 'Not On Sale Yet',
  not_listed: 'Not Listed Yet',
  sold_out: 'Sold Out',
  error: 'Check Failed',
  checking: 'Checking...',
  unknown: 'Checking...'
};

let notificationsEnabled = false;
let autoRefreshEnabled = true;
let refreshTimer = null;
let countdown = 1800; // 30 minutes in seconds
let previousStatuses = {};

// Format date nicely
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Format time nicely
function formatTime(timeStr) {
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h;
  return `${h12}:${minutes} ${ampm}`;
}

// Time ago
function timeAgo(isoStr) {
  if (!isoStr) return 'Never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Days until match
function daysUntil(dateStr) {
  const matchDate = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((matchDate - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Passed';
  if (diff === 0) return 'Today!';
  if (diff === 1) return 'Tomorrow!';
  return `${diff} days`;
}

// Create match card HTML
function createMatchCard(match) {
  const status = match.ticketStatus?.status || 'unknown';
  const districtUrl = match.ticketStatus?.bookingUrl || 'https://district.in/team/punjab-kings';

  return `
    <div class="match-card ${status}" data-match-id="${match.id}">
      <div class="match-header">
        <div class="match-teams">
          PBKS <span class="vs">vs</span> <span class="opponent">${match.opponentShort}</span>
        </div>
        <span class="match-number">${daysUntil(match.date)}</span>
      </div>

      <div class="match-details">
        <div class="match-detail">
          <span class="icon">📅</span>
          <span>${formatDate(match.date)}</span>
        </div>
        <div class="match-detail">
          <span class="icon">⏰</span>
          <span>${formatTime(match.time)} IST</span>
        </div>
        <div class="match-detail">
          <span class="icon">🏟️</span>
          <span>${match.venueFullName}</span>
        </div>
        ${match.ticketStatus?.priceRange ? `
        <div class="match-detail">
          <span class="icon">💰</span>
          <span>${match.ticketStatus.priceRange}</span>
        </div>` : ''}
      </div>

      <div class="ticket-status-section">
        <div class="ticket-status">
          <div class="status-dot ${status}"></div>
          <span class="status-label ${status}">${STATUS_SHORT[status] || status}</span>
        </div>
      </div>

      <div class="card-actions">
        ${status === 'available' ? `
          <a href="${districtUrl}" target="_blank" class="btn-book">🎟️ Book Now</a>
        ` : `
          <a href="https://www.district.in/events/punjab-kings-team" target="_blank" class="btn-book" style="background: var(--bg-card-hover);">View on District</a>
        `}
        <button class="btn-check" onclick="checkMatch(${match.id})" data-check-btn="${match.id}">
          ↻ Check
        </button>
      </div>

      <div class="last-checked">
        Last checked: ${timeAgo(match.ticketStatus?.lastChecked)}
        ${match.ticketStatus?.error ? ` • Error: ${match.ticketStatus.error}` : ''}
      </div>
    </div>
  `;
}

// Render all match cards
function renderMatches(matches) {
  const grid = document.getElementById('matchGrid');
  if (!matches || matches.length === 0) {
    grid.innerHTML = '<div class="loading"><p>No matches found</p></div>';
    return;
  }
  grid.innerHTML = matches.map(createMatchCard).join('');
}

// Update status banner
function updateStatusBanner(text, type = '') {
  const banner = document.getElementById('statusBanner');
  const statusText = document.getElementById('statusText');
  banner.className = `status-banner ${type}`;
  statusText.textContent = text;
}

// Fetch matches from API
async function fetchMatches() {
  try {
    const response = await fetch('/api/matches');
    const data = await response.json();

    // Check for newly available tickets
    data.matches.forEach(match => {
      const newStatus = match.ticketStatus?.status;
      const oldStatus = previousStatuses[match.id];

      if (newStatus === 'available' && oldStatus !== 'available') {
        showNotification(match);
        showToast(
          '🎟️ Tickets Available!',
          `PBKS vs ${match.opponent} — ${formatDate(match.date)} at ${match.venue}`
        );
      }
      previousStatuses[match.id] = newStatus;
    });

    renderMatches(data.matches);

    const availableCount = data.matches.filter(m => m.ticketStatus?.status === 'available').length;
    const checkedCount = data.matches.filter(m => m.ticketStatus?.lastChecked).length;

    if (availableCount > 0) {
      updateStatusBanner(
        `🎟️ ${availableCount} match${availableCount > 1 ? 'es' : ''} with tickets available! Book now on District.in`,
        'alert'
      );
    } else if (checkedCount > 0) {
      updateStatusBanner(
        `Monitoring ${data.matches.length} PBKS home matches • ${checkedCount} checked • No tickets available yet`,
        'success'
      );
    } else {
      updateStatusBanner('Initial check in progress...', '');
    }
  } catch (err) {
    updateStatusBanner(`Connection error: ${err.message}`, 'error');
  }
}

// Check a specific match
async function checkMatch(matchId) {
  const btn = document.querySelector(`[data-check-btn="${matchId}"]`);
  if (btn) {
    btn.classList.add('loading');
    btn.innerHTML = '⏳ Checking...';
  }

  try {
    const response = await fetch(`/api/check/${matchId}`, { method: 'POST' });
    const data = await response.json();
    await fetchMatches(); // Refresh all cards
  } catch (err) {
    showToast('Check Failed', err.message, true);
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.innerHTML = '↻ Check';
    }
  }
}

// Check all matches
async function checkAllMatches() {
  const btn = document.getElementById('refreshAllBtn');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="refresh-icon">↻</span> Checking...';

  try {
    await fetch('/api/check-all', { method: 'POST' });
    await fetchMatches();
    countdown = 1800; // Reset countdown
  } catch (err) {
    showToast('Check Failed', err.message, true);
  } finally {
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="refresh-icon">↻</span> Check Now';
  }
}

// Browser notifications
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Not Supported', 'Your browser doesn\'t support notifications', true);
    return;
  }

  Notification.requestPermission().then(permission => {
    const btn = document.getElementById('enableNotificationsBtn');
    if (permission === 'granted') {
      notificationsEnabled = true;
      btn.textContent = '🔔 Alerts On';
      btn.classList.add('enabled');
      showToast('Notifications Enabled', 'You\'ll be alerted when tickets go on sale!');
    } else {
      showToast('Permission Denied', 'Please allow notifications in browser settings', true);
    }
  });
}

function showNotification(match) {
  if (!notificationsEnabled || Notification.permission !== 'granted') return;

  const notification = new Notification('🏏 IPL Tickets Available!', {
    body: `PBKS vs ${match.opponent}\n${formatDate(match.date)} at ${match.venue}\nBook now on District.in!`,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏏</text></svg>',
    tag: `pbks-match-${match.id}`,
    requireInteraction: true
  });

  notification.onclick = () => {
    const url = match.ticketStatus?.bookingUrl || 'https://www.district.in/events/punjab-kings-team';
    window.open(url, '_blank');
    notification.close();
  };
}

// Toast notifications
function showToast(title, message, isError = false) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-message">${message}</div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// Countdown timer
function updateCountdown() {
  if (!autoRefreshEnabled) return;

  countdown--;
  if (countdown <= 0) {
    fetchMatches();
    countdown = 300;
  }

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  document.getElementById('refreshCountdown').textContent =
    `Next check in ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Initial fetch
  fetchMatches();

  // Refresh button
  document.getElementById('refreshAllBtn').addEventListener('click', checkAllMatches);

  // Notification button
  document.getElementById('enableNotificationsBtn').addEventListener('click', requestNotificationPermission);

  // Auto-check permission status
  if ('Notification' in window && Notification.permission === 'granted') {
    notificationsEnabled = true;
    const btn = document.getElementById('enableNotificationsBtn');
    btn.textContent = '🔔 Alerts On';
    btn.classList.add('enabled');
  }

  // Auto-refresh toggle
  document.getElementById('autoRefreshToggle').addEventListener('change', (e) => {
    autoRefreshEnabled = e.target.checked;
    if (!autoRefreshEnabled) {
      document.getElementById('refreshCountdown').textContent = 'Auto-refresh paused';
    } else {
      countdown = 1800;
    }
  });

  // Test email button
  document.getElementById('testEmailBtn').addEventListener('click', async () => {
    const btn = document.getElementById('testEmailBtn');
    btn.textContent = '📧 Sending...';
    btn.disabled = true;
    try {
      const res = await fetch('/api/test-email', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('📧 Test Email Sent', data.message);
      } else {
        showToast('❌ Email Failed', data.message, true);
      }
    } catch (err) {
      showToast('❌ Email Failed', err.message, true);
    } finally {
      btn.textContent = '📧 Test Email';
      btn.disabled = false;
    }
  });

  // Start countdown
  setInterval(updateCountdown, 1000);

  // Also refresh from server data every 30 seconds
  setInterval(fetchMatches, 30000);
});
