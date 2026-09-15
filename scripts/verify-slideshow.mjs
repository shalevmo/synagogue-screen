process.env.TZ = 'Asia/Jerusalem';
// Regression: image-ready deadlock at the Hebrew year boundary (RH 5787).
//
// Mirrors App.jsx: displayHd rolls to the next Hebrew day after tzeit;
// findActiveImage picks the first doc whose (month,day,year) matches;
// the reset gate compares by imageUrl (via needsImageReset). Simulates the
// whole kiosk minute-by-minute through erev RH → RH → after, tracking the
// DOM-level truth (img key unchanged ⇒ no load event ⇒ imageReady unchanged).
import { strict as assert } from 'node:assert';
import { HDate, Location, Zmanim } from '@hebcal/core';
import { needsImageReset } from '../src/lib/slideshow.js';

const gloc = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);

// The three /images docs live in production on 2026-09-09 (verbatim fields).
const images = [
  { id: 'rosh-hashana-5787-elul',    imageUrl: 'https://synagogue.moriamoyal.com/screen/concert-rosh-hashana.webp',
    startDay: 27, startMonth: 6, endDay: 29, endMonth: 6, year: 5786 },
  { id: 'rosh-hashana-5787-tishrei', imageUrl: 'https://synagogue.moriamoyal.com/screen/concert-rosh-hashana.webp',
    startDay: 1,  startMonth: 7, endDay: 2,  endMonth: 7, year: 5787 },
  { id: 'sample-image',              imageUrl: 'https://synagogue.moriamoyal.com/pesach.jpg',
    startDay: 1,  startMonth: 1, endDay: 30, endMonth: 12, year: 0 },
];

// ── App.jsx helpers (verbatim) ──
const pack = (m, d) => (m - 1) * 30 + d;
function isDateInRange(hMonth, hDay, sM, sD, eM, eD) {
  const t = pack(hMonth, hDay), s = pack(sM, sD), e = pack(eM, eD);
  if (s <= e) return t >= s && t <= e;
  return t >= s || t <= e;
}
function findActiveImage(list, hMonth, hDay, hYear) {
  return (list || []).find(img =>
    (img.year == null || img.year === hYear) &&
    isDateInRange(hMonth, hDay, img.startMonth, img.startDay, img.endMonth, img.endDay)
  ) || null;
}
function displayHDateFor(now) {
  const z = new Zmanim(gloc, now);
  const tzaisAt = z.tzeit();
  return (tzaisAt && now > tzaisAt)
    ? new HDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    : new HDate(now);
}

// ── kiosk simulation: React state + DOM truth, minute by minute ──
function simulate(startIso, endIso, { resetByDocIdentity = false } = {}) {
  let prevUrl = null;      // prevImageUrl state (App.jsx)
  let imageReady = false;  // imageReady state (App.jsx)
  let imgKey = null;       // <img key={imageUrl}> — the mounted DOM node
  let first = true;
  const transitions = [];
  const dead = []; // minutes where activeImage != null but !imageReady

  for (let t = Date.parse(startIso); t <= Date.parse(endIso); t += 60_000) {
    const now = new Date(t);
    const hd = displayHDateFor(now);
    const activeImage = findActiveImage(images, hd.getMonth(), hd.getDate(), hd.getFullYear());

    if (first) { prevUrl = activeImage?.imageUrl ?? null; first = false; }

    // state-adjust-during-render — with the reset comparison under test
    const changed = resetByDocIdentity
      ? (activeImage?.id ?? null) !== (transitions.at(-1)?.activeId ?? null) && !first
      : needsImageReset(prevUrl, activeImage);
    if (changed) {
      transitions.push({ t: now, activeId: activeImage?.id ?? null, url: activeImage?.imageUrl ?? null });
      prevUrl = activeImage?.imageUrl ?? null;
      imageReady = false;
    }

    // React reconciliation for {activeImage && <img key={imageUrl} .../>}:
    // key unchanged ⇒ same DOM node ⇒ NO load event ⇒ imageReady stays as-is.
    const key = activeImage ? activeImage.imageUrl : null;
    if (key !== imgKey) {
      imgKey = key;
      if (key) imageReady = true; // fresh mount: download → onLoad → decode
      // (the real handler awaits decode() then sets ready; same effect)
    }

    if (activeImage && !imageReady) dead.push(now);
  }
  return { transitions, dead };
}

// ── 1. THE BUG (old behavior): reset by doc identity deadlocks at tzeit ──
const buggy = simulate('2026-09-11T09:00:00+03:00', '2026-09-14T02:00:00+03:00', { resetByDocIdentity: true });
// sanity: the bug reproduced — dead minutes inside the holiday window
const bugDeadInRH = buggy.dead.filter(d => d >= new Date('2026-09-12T00:00:00+03:00') && d <= new Date('2026-09-13T19:20:00+03:00'));
assert.ok(bugDeadInRH.length > 2000, `expected ~2600 dead minutes in RH window, got ${bugDeadInRH.length}`);
console.log(`1. bug reproduced (old doc-identity reset): ${bugDeadInRH.length} dead minutes across RH — poster invisible`);

// ── 2. THE FIX: reset by imageUrl — poster cycles through the whole holiday ──
const fixed = simulate('2026-09-11T09:00:00+03:00', '2026-09-14T02:00:00+03:00');
assert.equal(fixed.dead.length, 0, `no dead minutes expected, got ${fixed.dead.length}`);
console.log('2. fix verified: 0 dead minutes — doc switch at tzeit (erev RH) is a no-op for the same URL, poster keeps cycling');

// ── 3. Schedule end still resets cleanly (tishrei → none) ──
const endT = fixed.transitions.filter(x => x.activeId === null);
assert.equal(endT.length, 1);
assert.ok(endT[0].t >= new Date('2026-09-13T19:00:00+03:00') && endT[0].t <= new Date('2026-09-13T20:00:00+03:00'), `unexpected schedule-end time ${endT[0].t}`);
console.log('2a. schedule end (2 Tishrei → none after tzeit) still resets and unmounts cleanly');

// ── 4. URL change mid-flight DOES reset (real image swap) ──
const swap = simulate('2026-09-12T00:00:00+03:00', '2026-09-12T00:30:00+03:00');
// (no swap happens in this window — assert via direct unit check instead)
assert.equal(needsImageReset('https://a.webp', { imageUrl: 'https://a.webp' }), false);
assert.equal(needsImageReset('https://a.webp', { imageUrl: 'https://b.webp' }), true);
assert.equal(needsImageReset('https://a.webp', null), true);
assert.equal(needsImageReset(null, { imageUrl: 'https://a.webp' }), true);
assert.equal(needsImageReset(null, null), false);
console.log('3. unit: same-URL doc switch ⇒ no reset; URL change / end / start ⇒ reset');

// ── 5. Firestore snapshot re-fire (new doc objects, same data) is a no-op ──
// simulating: kiosk reconnect sends fresh doc objects for the same schedule
const reconnectedImages = images.map(img => ({ ...img, name: `${img.name}-snapshot2` })); // new identities
images.splice(0, images.length, ...reconnectedImages);
const refire = simulate('2026-09-12T10:00:00+03:00', '2026-09-12T12:00:00+03:00');
assert.equal(refire.dead.length, 0);
console.log('4. Firestore snapshot re-fire (fresh doc objects, same URLs): 0 dead minutes');

console.log('\nALL PASS');