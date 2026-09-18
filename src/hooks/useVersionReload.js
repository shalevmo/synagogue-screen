/**
 * Deploy-version watcher — the replacement update mechanism.
 *
 * The deploy workflow bumps package.json, builds (the version is baked
 * under the clock via vite `define`) and writes the same string to
 * Firestore /version/current. The client subscribes to that doc: when it
 * differs from the build-time version, the kiosk reloads the page so the
 * new bundle is fetched. index.html is served no-cache and hashed asset
 * names change every build, so a plain reload is always sufficient.
 *
 * Reload is guarded:
 *  - only when the server version is NEWER (semver compare) — an older
 *    value (e.g. a rollback racing a deploy) must not loop the kiosk;
 *  - at most once per RELOAD_COOLDOWN_MS, so a flapping value can't
 *    reload-loop a screen no one is watching.
 */

import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';

const RELOAD_COOLDOWN_MS = 5 * 60 * 1000; // one reload attempt per 5 min

/** semver compare: >0 if a newer than b, 0 equal, <0 older; NaN on garbage */
function semverCmp(a, b) {
  const pa = String(a).split('.');
  const pb = String(b).split('.');
  for (let i = 0; i < 3; i++) {
    const na = Number.parseInt(pa[i] ?? '0', 10);
    const nb = Number.parseInt(pb[i] ?? '0', 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) return Number.NaN;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function useVersionReload() {
  useEffect(() => {
    let lastReloadAt = 0;
    const local = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;

    const unsub = onSnapshot(
      doc(db, 'version', 'current'),
      (snap) => {
        const remote = snap.exists() ? snap.data().version : null;
        if (!remote || !local) return;
        const cmp = semverCmp(remote, local);
        if (Number.isNaN(cmp) || cmp <= 0) return; // equal, older or garbage
        if (Date.now() - lastReloadAt < RELOAD_COOLDOWN_MS) return;
        console.log(`[version] ${local} → ${remote}, reloading`);
        lastReloadAt = Date.now();
        window.location.reload();
      },
      (err) => console.warn('version watch unavailable:', err.message),
    );
    return unsub;
  }, []);
}