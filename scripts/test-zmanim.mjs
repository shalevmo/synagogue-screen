/**
 * Pin scripts/src/lib/zmanim.js (Or Hahaim model) against 2net's own אור החיים
 * tables for Netivot (5 anchor dates across the year, incl. solstices).
 *
 * Run: node scripts/test-zmanim.mjs
 */
import { Location } from '@hebcal/core';
import { orHahaim } from '../src/lib/zmanim.js';

const loc = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);

// 2net אור החיים ground truth (from /tmp/2net-methods.json, pulled live)
const ANCHORS = [
  // [date, {zman: 'HH:MM'}]
  ['2026-09-14', { alot: '05:09', shmaMGA: '08:53', tefMGA: '10:07', shmaGRA: '09:30', tefGRA: '10:32', tzais: '19:05' }],
  ['2026-09-19', { alot: '05:12', shmaMGA: '08:54', tefMGA: '10:08', shmaGRA: '09:31', tefGRA: '10:32', tzais: '18:58' }],
  ['2026-12-21', { alot: '05:33', shmaMGA: '08:36', tefMGA: '09:37', shmaGRA: '09:07', tefGRA: '09:58', tzais: '16:56' }],
  ['2027-03-21', { alot: '04:30', shmaMGA: '08:09', tefMGA: '09:23', shmaGRA: '08:46', tefGRA: '09:47', tzais: '18:09' }],
  ['2027-06-21', { alot: '04:10', shmaMGA: '08:27', tefMGA: '09:52', shmaGRA: '09:09', tefGRA: '10:21', tzais: '20:07' }],
];

const FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
});
const fmt = (d) => FMT.format(d);
const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3);

let failures = 0;
const TOL = 2; // minutes — accepted engine drift (2net's sun engine runs ~1–2 early)

for (const [iso, expect] of ANCHORS) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d, 12, 0, 0); // midday anchor, Israel local
  const got = orHahaim(loc, t);
  if (!got) { console.log(`✗ ${iso}: null result`); failures++; continue; }
  console.log(`── ${iso}`);
  for (const [key, exp] of Object.entries(expect)) {
    const delta = Math.abs(toMin(fmt(got[key])) - toMin(exp));
    const ok = delta <= TOL;
    if (!ok) failures++;
    console.log(`  ${ok ? '✓' : '✗'} ${key.padEnd(8)} model ${fmt(got[key])}  2net ${exp}  Δ${delta}m`);
  }
}

// GRA row must also be internally consistent (same formula both engines)
console.log(failures === 0
  ? `\nAll anchors within ±${TOL} min — Or Hahaim model pinned ✓`
  : `\n${failures} anchor mismatches ✗`);
process.exit(failures > 0 ? 1 : 0);