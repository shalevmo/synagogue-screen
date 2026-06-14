/**
 * Service worker for synagogue-screen.
 *
 * Caches the current index.html and polls for new deployments every hour.
 * When the hashed asset filenames change, the SW updates and tells all
 * clients to reload so the display always runs the latest version.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let currentMainJs = null;
let currentMainCss = null;

/** Extract the hashed main JS and CSS filenames from index.html */
async function extractAssetHashes(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  const jsMatch = html.match(/src="\/assets\/index-[A-Za-z0-9]+\.js"/);
  const cssMatch = html.match(/href="\/assets\/index-[A-Za-z0-9]+\.css"/);
  return {
    js: jsMatch ? jsMatch[0] : null,
    css: cssMatch ? cssMatch[0] : null,
  };
}

/** Tell every controlled client to reload the page */
async function notifyClientsToReload() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
  for (const client of clients) {
    client.postMessage({ type: 'RELOAD_PAGE' });
  }
}

async function checkForUpdate() {
  try {
    const latest = await extractAssetHashes('/index.html');
    console.log('[SW] check', { current: { js: currentMainJs, css: currentMainCss }, latest });

    const hasUpdate =
      currentMainJs &&
      currentMainCss &&
      (latest.js !== currentMainJs || latest.css !== currentMainCss);

    if (hasUpdate) {
      console.log('[SW] new version detected, updating...');
      await self.skipWaiting();
      await self.clients.claim();
      await notifyClientsToReload();
    }
  } catch (err) {
    console.error('[SW] update check failed:', err);
  }
}

self.addEventListener('install', (event) => {
  console.log('[SW] install');
  event.waitUntil(
    extractAssetHashes('/index.html').then((hashes) => {
      currentMainJs = hashes.js;
      currentMainCss = hashes.css;
      console.log('[SW] cached assets', hashes);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] activate');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Start periodic update check
setInterval(checkForUpdate, CHECK_INTERVAL_MS);

// Also check whenever the SW wakes up (browser-dependent)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'version-check') {
    event.waitUntil(checkForUpdate());
  }
});
