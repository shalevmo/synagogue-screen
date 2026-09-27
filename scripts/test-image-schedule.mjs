/**
 * Pin src/lib/imageSchedule.js — which /images doc the kiosk shows on a
 * given Hebrew date (ranges, wrap-around, year pinning, first-match order).
 *
 * Run: node scripts/test-image-schedule.mjs
 */
import { strict as assert } from 'node:assert';
import { HDate, months } from '@hebcal/core';
import { isDateInRange, isImageActive, findActiveImage } from '../src/lib/imageSchedule.js';

let n = 0;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  n++;
}

// ── month numbering matches hebcal (schedules are written in hebcal indexes) ──
check('Nisan is 1', new HDate(15, months.NISAN, 5787).getMonth(), 1);
check('Tishrei is 7', new HDate(1, months.TISHREI, 5787).getMonth(), 7);
check('Adar II is 13', new HDate(14, months.ADAR_II, 5787).getMonth(), 13);

// ── isDateInRange: plain range, inclusive at both ends ──
check('inside', isDateInRange(7, 10, 7, 1, 7, 22), true);
check('start day inclusive', isDateInRange(7, 1, 7, 1, 7, 22), true);
check('end day inclusive', isDateInRange(7, 22, 7, 1, 7, 22), true);
check('day before start', isDateInRange(6, 29, 7, 1, 7, 22), false);
check('day after end', isDateInRange(7, 23, 7, 1, 7, 22), false);
check('single day', isDateInRange(9, 25, 9, 25, 9, 25), true);

// ── Elul → Tishrei is NOT a wrap in hebcal numbering (6 < 7) ──
check('27 Elul in Elul→Tishrei', isDateInRange(6, 27, 6, 27, 7, 2), true);
check('2 Tishrei in Elul→Tishrei', isDateInRange(7, 2, 6, 27, 7, 2), true);
check('3 Tishrei outside', isDateInRange(7, 3, 6, 27, 7, 2), false);

// ── Adar → Nisan wraps (12 > 1) ──
check('wrap: Adar side', isDateInRange(12, 20, 12, 15, 1, 15), true);
check('wrap: Adar II side', isDateInRange(13, 1, 12, 15, 1, 15), true);
check('wrap: Nisan side', isDateInRange(1, 15, 12, 15, 1, 15), true);
check('wrap: excluded middle', isDateInRange(7, 1, 12, 15, 1, 15), false);
check('wrap: day after end', isDateInRange(1, 16, 12, 15, 1, 15), false);

// ── isImageActive: year pinning ──
const everyYear = { startMonth: 7, startDay: 1, endMonth: 7, endDay: 2, year: null };
const pinned = { ...everyYear, year: 5787 };
check('year null = every year', isImageActive(everyYear, 7, 1, 5790), true);
check('year omitted = every year', isImageActive({ ...everyYear, year: undefined }, 7, 1, 5790), true);
check('pinned year matches', isImageActive(pinned, 7, 1, 5787), true);
check('pinned year differs', isImageActive(pinned, 7, 1, 5786), false);
check('pinned year, date outside', isImageActive(pinned, 7, 3, 5787), false);
// year: 0 is a real year value, not "every year" — such a doc never shows
check('year 0 never matches', isImageActive({ ...everyYear, year: 0 }, 7, 1, 5787), false);

// ── findActiveImage: empty input and first-match order ──
check('null list', findActiveImage(null, 7, 1, 5787), null);
check('empty list', findActiveImage([], 7, 1, 5787), null);
const a = { id: 'a', startMonth: 7, startDay: 1, endMonth: 7, endDay: 10, year: null };
const b = { id: 'b', startMonth: 7, startDay: 5, endMonth: 7, endDay: 20, year: null };
check('only a', findActiveImage([a, b], 7, 2, 5787)?.id, 'a');
check('overlap: first in list wins', findActiveImage([a, b], 7, 7, 5787)?.id, 'a');
check('overlap: order matters', findActiveImage([b, a], 7, 7, 5787)?.id, 'b');
check('only b', findActiveImage([a, b], 7, 15, 5787)?.id, 'b');
check('none', findActiveImage([a, b], 8, 1, 5787), null);

// ── the production RH 5787 split (see scripts/verify-slideshow.mjs) ──
const rh = [
  { id: 'elul', startMonth: 6, startDay: 27, endMonth: 6, endDay: 29, year: 5786 },
  { id: 'tishrei', startMonth: 7, startDay: 1, endMonth: 7, endDay: 2, year: 5787 },
];
const pick = (hd) => findActiveImage(rh, hd.getMonth(), hd.getDate(), hd.getFullYear())?.id ?? null;
check('26 Elul 5786', pick(new HDate(26, months.ELUL, 5786)), null);
check('29 Elul 5786', pick(new HDate(29, months.ELUL, 5786)), 'elul');
check('1 Tishrei 5787', pick(new HDate(1, months.TISHREI, 5787)), 'tishrei');
check('3 Tishrei 5787', pick(new HDate(3, months.TISHREI, 5787)), null);
check('29 Elul 5787 (next year)', pick(new HDate(29, months.ELUL, 5787)), null);

console.log(`imageSchedule: ${n} checks passed`);
