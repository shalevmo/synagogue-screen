// E2E: Firestore-driven deploy reload (replacement update mechanism).
//
// Against the Firestore emulator:
//   1. Seed /version/current == build-time version → no reload.
//   2. Bump to a NEWER semver → the client must reload the page.
//   3. Write an OLDER semver → must NOT reload (rollback guard).
//   4. Garbage value → must NOT reload.
//   5. Newer again → reloads (cooldown window elapsed in test terms —
//      each reload resets the page, so lastReloadAt resets too).
//
// Run: node scripts/verify-version-reload.mjs   (emulator on :8080,
//      preview build with VITE_FIREBASE_EMULATOR=true on :5199)
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no cached chromium found'); process.exit(1); }

const EMU = 'http://localhost:8080';
const APP = 'http://localhost:5199/';

async function setVersion(doc, version) {
  // Emulator bypass for rules enforcement: the "owner" token is the
  // emulator's admin credential (same one the Admin SDK uses; the deploy
  // workflow's publish script uses Admin and is never rules-gated).
  const res = await fetch(`${EMU}/v1/projects/synagogue-screen/databases/(default)/documents/version/current`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: JSON.stringify({
      fields: {
        version: { stringValue: version },
        deployedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) throw new Error(`seed failed HTTP ${res.status}: ${await res.text()}`);
}

let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  ✓ ${label}`);
  else { failures++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

console.log('══ 1. Equal version → no reload');
{
  await setVersion('current', '1.0.0'); // build-time package.json version
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // app mount + Firestore listener attach
  const marker = await page.evaluate(() => { window.__no_reload_marker = 42; return window.__no_reload_marker; });
  await setVersion('current', '1.0.0'); // same value written again
  await page.waitForTimeout(3000);
  const kept = await page.evaluate(() => window.__no_reload_marker ?? null);
  check('marker survives equal version', kept === 42, `got ${kept}`);
  await ctx.close();
}

console.log('══ 2. Newer version → reload');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // app mount + Firestore listener attach
  await page.evaluate(() => { window.__no_reload_marker = 42; });
  let reloaded = false;
  page.once('load', () => { reloaded = true; });
  await setVersion('current', '1.0.1');
  // The reload may land mid-poll; race-proof: marker read is try/catch'd.
  await page.waitForTimeout(5000);
  let marker = 'navigation';
  try { marker = await page.evaluate(() => window.__no_reload_marker ?? null); }
  catch { /* context destroyed by the reload itself — that IS the pass */ }
  check('page reloaded on newer version', reloaded || marker === null,
    `reloaded=${reloaded} marker=${marker}`);
  const version = await page.evaluate(() => document.querySelector('#version')?.innerText ?? '');
  check('version text under clock reads v1.0.0', version.includes('1.0.0'), `got "${version}"`);
  await ctx.close();
}

console.log('══ 3. Older version → NO reload (rollback guard)');
{
  await setVersion('current', '0.9.9');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // app mount + Firestore listener attach
  await page.evaluate(() => { window.__no_reload_marker = 42; });
  await page.waitForTimeout(3000);
  const kept = await page.evaluate(() => window.__no_reload_marker ?? null);
  check('no reload for older version', kept === 42, `got ${kept}`);
  await ctx.close();
}

console.log('══ 4. Garbage value → NO reload');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // app mount + Firestore listener attach
  await page.evaluate(() => { window.__no_reload_marker = 42; });
  await setVersion('current', 'banana');
  await page.waitForTimeout(3000);
  const kept = await page.evaluate(() => window.__no_reload_marker ?? null);
  check('no reload for garbage', kept === 42, `got ${kept}`);
  await ctx.close();
}

console.log('══ 5. Newer again (after cooldown/page reset) → reload');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // app mount + Firestore listener attach
  await page.evaluate(() => { window.__no_reload_marker = 42; });
  let reloaded = false;
  page.once('load', () => { reloaded = true; });
  await setVersion('current', '1.2.0');
  await page.waitForTimeout(5000);
  let marker = 'navigation';
  try { marker = await page.evaluate(() => window.__no_reload_marker ?? null); }
  catch { /* context destroyed by the reload itself — that IS the pass */ }
  check('reload after previous garbage', reloaded || marker === null, `reloaded=${reloaded} marker=${marker}`);
  await ctx.close();
}

await browser.close();
console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURES`}`);
process.exit(failures > 0 ? 1 : 0);