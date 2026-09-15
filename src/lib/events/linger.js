/**
 * Linger unit: yesterday's period pair, 1h past its exit, across the
 * day flip (Q7:A + the gabbai's linger amendment). A line lives for its
 * Jewish day — the period pair lingers ONE hour past the exit time after
 * the day flips, recomputed statelessly from yesterday.
 */
import { HDate } from '@hebcal/core';
import {
  candlesAt, entryLabelOf, eventsForHDate, fastEndAt,
  hasChag, havdalahAt, shkiahOf, walkBack, LINGER_MS, fmt,
} from './common.js';

/**
 * The lingering pair for the first hour after yesterday's run ended, or
 * null when yesterday wasn't a holy run, the linger window has passed,
 * or the run was a lone fast day (its fast block already showed both
 * instants — nothing to linger).
 *
 * Fast-bridged exits linger with BOTH fast lines (gabbai decision,
 * Sep 2026 — never a bare end line), same as the in-period display.
 * תחילת = shkiah of the fast's EVE (yesterday−1), matching the fast
 * block's start rule.
 *
 * @returns {{timed: {label, time}[]}|null}
 */
export function lingerOf(gloc, now, yesterday, yesterdayHoly, yesterdayContinues) {
  if (!(yesterdayHoly || yesterdayContinues)) return null;

  const back = walkBack(yesterday, gloc);

  // The linger window keys off the period's true exit instant. A TB
  // bridge ended at ITS fast end (OH tzais), not at havdalah.
  const yesterdayEndedAtFast = yesterdayContinues && !yesterdayHoly;
  const exitTime = yesterdayEndedAtFast
    ? fastEndAt(gloc, yesterday)
    : havdalahAt(gloc, yesterday);
  if (now > new Date(exitTime.getTime() + LINGER_MS)) return null;

  // Standalone fast (TB with no holy neighbour): the fast block already
  // showed both instants — nothing to linger. (back === yesterday means
  // the run was the lone fast day, so there is no pair to show.)
  const standaloneFast = yesterdayContinues && back.abs() === yesterday.abs();
  if (standaloneFast) return null;

  const timed = [];
  timed.push({ label: entryLabelOf(gloc, back), time: fmt(candlesAt(gloc, new HDate(back.abs() - 1))) });
  const wasFastExit = yesterdayContinues && !yesterdayHoly;
  const exitLabel = wasFastExit
    ? 'סיום הצום'                       // TB bridge was the last day
    : (hasChag(eventsForHDate(yesterday, gloc)) ? 'יציאת החג' : 'הבדלה');
  if (wasFastExit) {
    timed.push({ label: 'תחילת הצום', time: fmt(shkiahOf(gloc, new HDate(yesterday.abs() - 1))) });
  }
  timed.push({ label: exitLabel, time: fmt(exitTime) });
  return { timed };
}