/**
 * Pin src/lib/zmanim.js (Or Hahaim model) against 2net's own אור החיים
 * tables for Netivot (5 anchor dates across the year, incl. solstices).
 */
import { describe, it, expect } from 'vitest';
import { orHahaim } from '../src/lib/zmanim.js';
import { NETIVOT as loc } from './netivot.js';

// 2net אור החיים ground truth (pulled live with scripts/pull-2net-methods.mjs)
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

const TOL = 2; // minutes — accepted engine drift (2net's sun engine runs ~1–2 early)

describe.each(ANCHORS)('%s', (iso, expected) => {
  const [y, m, d] = iso.split('-').map(Number);
  const got = orHahaim(loc, new Date(y, m - 1, d, 12, 0, 0)); // midday anchor, Israel local

  it('returns a result', () => {
    expect(got).toBeTruthy();
  });

  it.each(Object.entries(expected))(`%s within ±${TOL} min of 2net %s`, (key, exp) => {
    const delta = Math.abs(toMin(fmt(got[key])) - toMin(exp));
    expect(delta, `model ${fmt(got[key])} vs 2net ${exp}`).toBeLessThanOrEqual(TOL);
  });
});
