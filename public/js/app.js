/* ---------------------------------------------------------------------------
   App: Hash Router + Initialization
   --------------------------------------------------------------------------- */

const ROUTES = {
  '#/add': { title: 'Add Note', view: 'note-editor' },
  '#/browse': { title: 'Browse', view: 'browse' },
  '#/review': { title: 'Review', view: 'review' },
  '#/stats': { title: 'Statistics', view: 'stats' },
  '#/settings': { title: 'Settings', view: 'settings' },
};

// Note detail is a sub-view, not a tab
// Accessed via #/note/:id

let currentRoute = null;
let currentNoteId = null;

/**
 * Navigate to a route
 */
function navigate(route) {
  if (route.startsWith('#/note/')) {
    currentNoteId = route.replace('#/note/', '');
    renderNoteDetail(currentNoteId);
    // Highlight browse tab since note detail is accessed from browse
    highlightNav('#/browse');
    document.getElementById('headerSubtitle').textContent = 'Note Detail';
    currentRoute = '#/browse';
    return;
  }

  currentNoteId = null;
  currentRoute = route;

  const routeInfo = ROUTES[route];
  if (!routeInfo) {
    navigate('#/add');
    return;
  }

  // Update header subtitle
  document.getElementById('headerSubtitle').textContent = routeInfo.title;

  // Highlight nav
  highlightNav(route);

  // Render the view
  const main = document.getElementById('mainContent');
  main.innerHTML = '';

  switch (routeInfo.view) {
    case 'note-editor': renderNoteEditor(main); break;
    case 'browse': renderBrowse(main); break;
    case 'review': renderReview(main); break;
    case 'stats': renderStats(main); break;
    case 'settings': renderSettings(main); break;
  }
}

/**
 * Highlight the active nav item
 */
function highlightNav(route) {
  document.querySelectorAll('.bottom-nav__item').forEach((item) => {
    item.classList.toggle('active', item.dataset.route === route);
  });
}

/**
 * Handle hash change
 */
function onHashChange() {
  const hash = location.hash || '#/add';
  navigate(hash);
}

/**
 * Initialize the app
 */
async function init() {
  // Apply saved theme
  const savedTheme = localStorage.getItem('engnotes_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  // Apply saved style
  const savedStyle = localStorage.getItem('engnotes_style');
  if (savedStyle) {
    document.documentElement.setAttribute('data-style', savedStyle);
  }

  try {
    // Open the database
    await openDB();
    await migrateNotes();
    console.log('IndexedDB ready');

    // Start sync engine (no-op if not paired)
    initSyncEngine();
  } catch (err) {
    console.error('Failed to open IndexedDB:', err);
    showToast('Failed to initialize local storage', 'error');
  }

  // Set up nav click handlers
  document.querySelectorAll('.bottom-nav__item').forEach((item) => {
    item.addEventListener('click', () => {
      location.hash = item.dataset.route;
    });
  });

  // Listen for hash changes
  window.addEventListener('hashchange', onHashChange);

  // Initial route
  if (location.hash && ROUTES[location.hash]) {
    navigate(location.hash);
  } else {
    location.hash = '#/add';
    navigate('#/add');
  }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
