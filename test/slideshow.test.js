// Regression: image-ready deadlock at the Hebrew year boundary (RH 5787).
//
// Mirrors lib/displayData.js + hooks/useSlideshow.js: displayHd rolls to the next Hebrew day after tzeit;
// findActiveImage picks the first doc whose (month,day,year) matches;
// the reset gate compares by imageUrl (via needsImageReset). Simulates the
// whole kiosk minute-by-minute through erev RH → RH → after, tracking the
// DOM-level truth (img key unchanged ⇒ no load event ⇒ imageReady unchanged).
import { describe, it, expect } from 'vitest';
import { HDate, Zmanim } from '@hebcal/core';
import { needsImageReset } from '../src/lib/slideshow.js';
import { findActiveImage } from '../src/lib/imageSchedule.js';
import { NETIVOT } from './netivot.js';

// The three /images docs live in production on 2026-09-09 (verbatim fields).
const images = [
  { id: 'rosh-hashana-5787-elul',    imageUrl: 'https://synagogue.moriamoyal.com/screen/concert-rosh-hashana.webp',
    startDay: 27, startMonth: 6, endDay: 29, endMonth: 6, year: 5786 },
  { id: 'rosh-hashana-5787-tishrei', imageUrl: 'https://synagogue.moriamoyal.com/screen/concert-rosh-hashana.webp',
    startDay: 1,  startMonth: 7, endDay: 2,  endMonth: 7, year: 5787 },
  { id: 'sample-image',              imageUrl: 'https://synagogue.moriamoyal.com/pesach.jpg',
    startDay: 1,  startMonth: 1, endDay: 30, endMonth: 12, year: 0 },
];

function displayHDateFor(now) {
  const tzaisAt = new Zmanim(NETIVOT, now).tzeit();
  return (tzaisAt && now > tzaisAt)
    ? new HDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    : new HDate(now);
}

// ── kiosk simulation: React state + DOM truth, minute by minute ──
function simulate(docs, startIso, endIso, { resetByDocIdentity = false } = {}) {
  let prevUrl = null;      // prevImageUrl state (useSlideshow)
  let imageReady = false;  // imageReady state (useSlideshow)
  let imgKey = null;       // <img key={imageUrl}> — the mounted DOM node
  let first = true;
  const transitions = [];
  const dead = []; // minutes where activeImage != null but !imageReady

  for (let t = Date.parse(startIso); t <= Date.parse(endIso); t += 60_000) {
    const now = new Date(t);
    const hd = displayHDateFor(now);
    const activeImage = findActiveImage(docs, hd.getMonth(), hd.getDate(), hd.getFullYear());

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

describe('RH 5787 year boundary', () => {
  it('reproduces the old bug: reset by doc identity deadlocks at tzeit', () => {
    const buggy = simulate(images, '2026-09-11T09:00:00+03:00', '2026-09-14T02:00:00+03:00', { resetByDocIdentity: true });
    const deadInRH = buggy.dead.filter((d) =>
      d >= new Date('2026-09-12T00:00:00+03:00') && d <= new Date('2026-09-13T19:20:00+03:00'));
    // ~2600 dead minutes across RH — poster invisible
    expect(deadInRH.length).toBeGreaterThan(2000);
  });

  const fixed = simulate(images, '2026-09-11T09:00:00+03:00', '2026-09-14T02:00:00+03:00');

  it('reset by imageUrl: poster cycles through the whole holiday', () => {
    // the doc switch at tzeit (erev RH) is a no-op for the same URL
    expect(fixed.dead).toHaveLength(0);
  });

  it('schedule end (2 Tishrei → none after tzeit) still resets once', () => {
    const endT = fixed.transitions.filter((x) => x.activeId === null);
    expect(endT).toHaveLength(1);
    expect(endT[0].t >= new Date('2026-09-13T19:00:00+03:00')).toBe(true);
    expect(endT[0].t <= new Date('2026-09-13T20:00:00+03:00')).toBe(true);
  });

  it('Firestore snapshot re-fire (fresh doc objects, same URLs) is a no-op', () => {
    const reconnected = images.map((img) => ({ ...img, name: `${img.id}-snapshot2` })); // new identities
    expect(simulate(reconnected, '2026-09-12T10:00:00+03:00', '2026-09-12T12:00:00+03:00').dead).toHaveLength(0);
  });
});

describe('needsImageReset', () => {
  it.each([
    ['same URL ⇒ no reset', 'https://a.webp', { imageUrl: 'https://a.webp' }, false],
    ['URL change ⇒ reset', 'https://a.webp', { imageUrl: 'https://b.webp' }, true],
    ['schedule end ⇒ reset', 'https://a.webp', null, true],
    ['schedule start ⇒ reset', null, { imageUrl: 'https://a.webp' }, true],
    ['nothing before or after', null, null, false],
  ])('%s', (_label, prev, active, expected) => {
    expect(needsImageReset(prev, active)).toBe(expected);
  });
});
