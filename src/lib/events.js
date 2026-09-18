/**
 * Holiday & event-times panel (center column, between the parsha and the clock).
 *
 * Everything is computed locally from @hebcal/core — no Firestore data entry.
 *
 * Conventions (locked with the gabbai, Sep 2026):
 *  - Times follow the "Or Hahaim" convention used by calendar.2net.co.il
 *    (the calendar the community follows): candles = shkiah − 18 min,
 *    havdalah = shkiah + 32 min (hebcal terms; 2net's sunset runs
 *    ~2 min earlier — verified against 2net's published Netivot 5787 table).
 *    Regular fast days end at the Or Hahaim tzais (lib/zmanim.js — the left
 *    column's צאת הכוכבים); Yom Kippur ends at the havdalah instant
 *    (shkiah+32). Locked with the gabbai, Sep 14 2026.
 *  - Labels (Q8:B): הדלקת נרות / הבדלה for Shabbat, כניסת החג / יציאת החג for
 *    Yom Tov (chag label wins when a day is both).
 *  - Fast days (Q9:A): name banner + תחילת הצום + סיום הצום. Minor fasts:
 *    Or Hahaim dawn (alot) → Or Hahaim tzais. Yom Kippur starts at the erev
 *    candle-lighting time (shkiah−18), Tisha B'Av at shkiah itself. On
 *    Yom Kippur the exit line is suppressed — סיום הצום *is* the havdalah
 *    (same instant).
 *  - Fixed pair per holy period (locked "B", Sep 14 2026): see
 *    events/periodPair.js.
 *  - Jewish-day lifecycle (Q7:A + linger fix): see events/linger.js.
 *  - Banners (Q10:A): see events/banners.js.
 *  - Layout (Q4:C): banners first, then timed lines; all black.
 *
 * Unit decomposition (golden-proven byte-identical, Sep 15 2026):
 * common.js (conventions + calendar helpers) ← banners.js / fastBlock.js /
 * periodPair.js / linger.js; this file only orchestrates the day-flip and
 * composes the units.
 */
import { HDate } from '@hebcal/core';
import { dayFlipTzais } from './zmanim.js';
import {
  candlesAt, continuesRun, eventsForHDate, exitLinesOf, hasChag, holyOf, fmt,
  walkForward,
} from './events/common.js';
import { bannersOf } from './events/banners.js';
import { fastBlockOf } from './events/fastBlock.js';
import { periodPairOf } from './events/periodPair.js';
import { lingerOf } from './events/linger.js';

/**
 * Compute the event lines for the center column.
 *
 * @param {Location} gloc
 * @param {Date} now  current instant
 * @returns {{ banners: string[], timed: {label: string, time: string}[] }}
 */
export function computeEventLines(gloc, now) {
  // Display day: after tzeit the header shows tomorrow — follow it exactly.
  // dayFlipTzais (zmanim.js) is the single source locked in ADR-0001 —
  // App.jsx's header flip uses the same call, so both flip inseparably.
  const tzaisNow = dayFlipTzais(gloc, now);
  const isAfterTzais = tzaisNow && now > tzaisNow;
  const today = isAfterTzais ? new HDate(new HDate(now).abs() + 1) : new HDate(now);
  const yesterday = new HDate(today.abs() - 1); // abs()-based: hd.next(-1) is buggy in 6.6.0
  const tomorrow = new HDate(today.abs() + 1);

  const evsToday = eventsForHDate(today, gloc);
  const evsYesterday = eventsForHDate(yesterday, gloc);
  const evsTomorrow = eventsForHDate(tomorrow, gloc);

  const banners = bannersOf(evsToday);
  const timed = [];

  // ── Fast block (Q9:A) ─────────────────────────────────────────────────────
  const fastBlock = fastBlockOf(gloc, evsToday, today, yesterday);
  if (fastBlock) {
    banners.push(...fastBlock.banners);
    timed.push(...fastBlock.timed);
  }

  // ── Fixed pair per holy period (locked "B") ─────────────────────────────────
  const todayHoly = holyOf(evsToday, today);
  const todayContinues = continuesRun(evsToday);
  const yesterdayHoly = holyOf(evsYesterday, yesterday);
  const yesterdayContinues = continuesRun(evsYesterday);
  const tomorrowHoly = holyOf(evsTomorrow, tomorrow);
  const tomorrowContinues = continuesRun(evsTomorrow);

  // In-period: today is holy, or Shabbat flowing into a fast bridge (YK).
  const inPeriod = todayHoly || (today.getDay() === 6 && todayContinues);

  if (inPeriod) {
    const pair = periodPairOf(gloc, today, todayContinues, tomorrow, tomorrowHoly, tomorrowContinues);
    if (pair) timed.push(...pair.timed);
  } else {
    // ── Linger: yesterday's period pair, 1h past its exit, across the flip ──
    const linger = lingerOf(gloc, now, yesterday, yesterdayHoly, yesterdayContinues);
    if (linger) timed.push(...linger.timed);

    // ── Erev (chol today, holiness starts tonight): tonight's entry line +─
    // the period's exit line, so candle-lighting days always show both.
    // Tisha B'Av has no candles — a major fast without the chag flag is
    // excluded (YK keeps its line: it lights candles and carries CHAG).
    if (tomorrowHoly || (tomorrowContinues && hasChag(evsTomorrow))) {
      const label = hasChag(evsTomorrow) ? 'כניסת החג' : 'הדלקת נרות';
      timed.push({ label, time: fmt(candlesAt(gloc, today)) });
      // The run starting tonight may extend beyond tomorrow (Shabbat into
      // Yom Tov, multi-day chag): walkForward finds its true last member.
      const runEnd = walkForward(tomorrow, gloc);
      timed.push(...exitLinesOf(gloc, runEnd));
    }
  }

  return { banners, timed };
}