/* ---------------------------------------------------------------------------
   PWA: Service Worker Registration + Install Prompt
   --------------------------------------------------------------------------- */

let deferredInstallPrompt = null;

/**
 * Register the service worker
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available — could show a "Refresh to update" prompt
              console.log('New content available — refresh to update');
            }
          });
        });
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
}

/**
 * Capture the beforeinstallprompt event
 */
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredInstallPrompt = e;
});

/**
 * Trigger the install prompt (call from a button)
 */
async function promptInstall() {
  if (!deferredInstallPrompt) {
    showToast('App installation is not available right now', 'error');
    return;
  }

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;

  if (outcome === 'accepted') {
    showToast('App installed! 🎉', 'success');
  }
}

/**
 * Check if the app is running in standalone mode (installed PWA)
 */
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

// Initialize PWA features
registerServiceWorker();
