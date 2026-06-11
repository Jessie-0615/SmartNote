/* ---------------------------------------------------------------------------
   Utility Functions
   --------------------------------------------------------------------------- */

/**
 * Generate a UUID v4 (cryptographically random)
 */
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format a timestamp as a readable date string
 */
function formatDate(ts, opts = {}) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();
  const isYesterday = d.toDateString() === new Date(now.getTime() - 86400000).toDateString();

  if (opts.relative) {
    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    if (isYesterday) return 'Yesterday';
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (year === now.getFullYear()) {
    return `${month}-${day}`;
  }
  return `${year}-${month}-${day}`;
}

/**
 * Format a timestamp as relative time (e.g., "3 days ago", "in 5 days")
 */
function relativeTime(ts) {
  const now = Date.now();
  const diff = ts - now;
  const absDays = Math.round(Math.abs(diff) / 86400000);

  if (absDays === 0) {
    if (diff < 0) return 'Today';
    return 'Today';
  }
  if (absDays === 1) {
    return diff < 0 ? 'Yesterday' : 'Tomorrow';
  }
  if (diff < 0) return `${absDays} days ago`;
  return `in ${absDays} days`;
}

/**
 * Get the start-of-day timestamp for a given date
 */
function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get the end-of-day timestamp for a given date
 */
function endOfDay(ts) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Get start of week (Monday) for a given timestamp
 */
function startOfWeek(ts) {
  const d = new Date(ts);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get start of month for a given timestamp
 */
function startOfMonth(ts) {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Get start of year for a given timestamp
 */
function startOfYear(ts) {
  const d = new Date(ts);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Debounce a function
 */
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Category display metadata
 */
const CATEGORIES = {
  word: { label: 'Word', icon: 'W', color: '#1565c0' },
  phrase: { label: 'Phrase', icon: 'P', color: '#c62828' },
  sentence_pattern: { label: 'Sentence Pattern', icon: 'S', color: '#7b1fa2' },
  idiom: { label: 'Idiom', icon: 'I', color: '#e65100' },
  common_usage: { label: 'Common Usage', icon: 'C', color: '#2e7d32' },
};

/**
 * Get display info for a category
 */
function categoryInfo(cat) {
  return CATEGORIES[cat] || { label: 'Unknown', icon: '❓', color: '#666' };
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * Show a toast notification
 */
function showToast(message, type = '', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast${type ? ' toast--' + type : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Confirm dialog (async)
 */
function confirmDialog(title, message, confirmText = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal${danger ? ' modal--danger' : ''}">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-action="cancel">Cancel</button>
          <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-action="confirm">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.dataset.action === 'cancel') {
        overlay.remove();
        resolve(false);
      }
      if (e.target.dataset.action === 'confirm') {
        overlay.remove();
        resolve(true);
      }
    });
  });
}
