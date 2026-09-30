/**
 * Pin src/lib/imageSchedule.js — which /images doc the kiosk shows on a
 * given Hebrew date (ranges, wrap-around, year pinning, first-match order).
 */
import { describe, it, expect } from 'vitest';
import { HDate, months } from '@hebcal/core';
import { isDateInRange, isImageActive, findActiveImage } from '../src/lib/imageSchedule.js';

describe('month numbering matches hebcal (schedules are written in hebcal indexes)', () => {
  it('Nisan is 1', () => expect(new HDate(15, months.NISAN, 5787).getMonth()).toBe(1));
  it('Tishrei is 7', () => expect(new HDate(1, months.TISHREI, 5787).getMonth()).toBe(7));
  it('Adar II is 13', () => expect(new HDate(14, months.ADAR_II, 5787).getMonth()).toBe(13));
});

describe('isDateInRange', () => {
  it.each([
    // plain range, inclusive at both ends
    ['inside', [7, 10, 7, 1, 7, 22], true],
    ['start day inclusive', [7, 1, 7, 1, 7, 22], true],
    ['end day inclusive', [7, 22, 7, 1, 7, 22], true],
    ['day before start', [6, 29, 7, 1, 7, 22], false],
    ['day after end', [7, 23, 7, 1, 7, 22], false],
    ['single day', [9, 25, 9, 25, 9, 25], true],
    // Elul → Tishrei is NOT a wrap in hebcal numbering (6 < 7)
    ['27 Elul in Elul→Tishrei', [6, 27, 6, 27, 7, 2], true],
    ['2 Tishrei in Elul→Tishrei', [7, 2, 6, 27, 7, 2], true],
    ['3 Tishrei outside', [7, 3, 6, 27, 7, 2], false],
    // Adar → Nisan wraps (12 > 1)
    ['wrap: Adar side', [12, 20, 12, 15, 1, 15], true],
    ['wrap: Adar II side', [13, 1, 12, 15, 1, 15], true],
    ['wrap: Nisan side', [1, 15, 12, 15, 1, 15], true],
    ['wrap: excluded middle', [7, 1, 12, 15, 1, 15], false],
    ['wrap: day after end', [1, 16, 12, 15, 1, 15], false],
  ])('%s', (_label, args, expected) => {
    expect(isDateInRange(...args)).toBe(expected);
  });
});

describe('isImageActive: year pinning', () => {
  const everyYear = { startMonth: 7, startDay: 1, endMonth: 7, endDay: 2, year: null };
  const pinned = { ...everyYear, year: 5787 };
  it('year null = every year', () => expect(isImageActive(everyYear, 7, 1, 5790)).toBe(true));
  it('year omitted = every year', () => expect(isImageActive({ ...everyYear, year: undefined }, 7, 1, 5790)).toBe(true));
  it('pinned year matches', () => expect(isImageActive(pinned, 7, 1, 5787)).toBe(true));
  it('pinned year differs', () => expect(isImageActive(pinned, 7, 1, 5786)).toBe(false));
  it('pinned year, date outside', () => expect(isImageActive(pinned, 7, 3, 5787)).toBe(false));
  // year: 0 is a real year value, not "every year" — such a doc never shows
  it('year 0 never matches', () => expect(isImageActive({ ...everyYear, year: 0 }, 7, 1, 5787)).toBe(false));
});

describe('findActiveImage: empty input and first-match order', () => {
  const a = { id: 'a', startMonth: 7, startDay: 1, endMonth: 7, endDay: 10, year: null };
  const b = { id: 'b', startMonth: 7, startDay: 5, endMonth: 7, endDay: 20, year: null };
  it('null list', () => expect(findActiveImage(null, 7, 1, 5787)).toBeNull());
  it('empty list', () => expect(findActiveImage([], 7, 1, 5787)).toBeNull());
  it('only a', () => expect(findActiveImage([a, b], 7, 2, 5787)?.id).toBe('a'));
  it('overlap: first in list wins', () => expect(findActiveImage([a, b], 7, 7, 5787)?.id).toBe('a'));
  it('overlap: order matters', () => expect(findActiveImage([b, a], 7, 7, 5787)?.id).toBe('b'));
  it('only b', () => expect(findActiveImage([a, b], 7, 15, 5787)?.id).toBe('b'));
  it('none', () => expect(findActiveImage([a, b], 8, 1, 5787)).toBeNull());
});

describe('the production RH 5787 split (see test/slideshow.test.js)', () => {
  const rh = [
    { id: 'elul', startMonth: 6, startDay: 27, endMonth: 6, endDay: 29, year: 5786 },
    { id: 'tishrei', startMonth: 7, startDay: 1, endMonth: 7, endDay: 2, year: 5787 },
  ];
  const pick = (hd) => findActiveImage(rh, hd.getMonth(), hd.getDate(), hd.getFullYear())?.id ?? null;
  it.each([
    ['26 Elul 5786', new HDate(26, months.ELUL, 5786), null],
    ['29 Elul 5786', new HDate(29, months.ELUL, 5786), 'elul'],
    ['1 Tishrei 5787', new HDate(1, months.TISHREI, 5787), 'tishrei'],
    ['3 Tishrei 5787', new HDate(3, months.TISHREI, 5787), null],
    ['29 Elul 5787 (next year)', new HDate(29, months.ELUL, 5787), null],
  ])('%s', (_label, hd, expected) => {
    expect(pick(hd)).toBe(expected);
  });
});
