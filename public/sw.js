/**
 * Service worker for synagogue-screen.
 *
 * Polls for new deployments: fetches index.html from the origin (cache:
 * no-store, with a cache-busting query), compares the hashed asset
 * filenames, and when they change the SW updates and tells all clients
 * to reload so the display always runs the latest version.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let currentMainJs = null;
let currentMainCss = null;

/** Extract the hashed main JS and CSS filenames from index.html */
async function extractAssetHashes(url) {
  // cache-busting query: bypass any intermediate cache (CloudFront, proxies)
  const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
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
      // Refresh our baseline BEFORE skipWaiting(): after the old SW dies and
      // this one takes over, we compare against the NEW hashes, not the ones
      // cached at install time (which may have been read from a stale edge).
      currentMainJs = latest.js;
      currentMainCss = latest.css;
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
  // Re-read the hashes on activation too — install-time fetches can be
  // served from a stale CloudFront edge cache right after a deploy.
  event.waitUntil(
    extractAssetHashes('/index.html').then((hashes) => {
      currentMainJs = hashes.js;
      currentMainCss = hashes.css;
      self.clients.claim();
    })
  );
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