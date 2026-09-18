/**
 * Shared conventions + calendar helpers for the event-times units.
 *
 * Everything here is a pure function of (gloc, hd) or (evs, hd) — the units
 * (banners / fastBlock / periodPair / linger / erev) compose them.
 */
import { HDate, HebrewCalendar, Zmanim, flags } from '@hebcal/core';
import { stripNikkud } from '../reading.js';
import { orHahaim } from '../zmanim.js';

// ─── Or Hahaim offsets (minutes, relative to @hebcal/core shkiah) ─────────────

export const CANDLE_OFFSET_MIN = -18;
export const HAVDALAH_OFFSET_MIN = 32;   // also fast end
export const LINGER_MS = 60 * 60 * 1000; // exit lines stay 1h past their time

// Named flags from @hebcal/core (verified identical to the raw hex values
// previously hardcoded: CHAG=1, MAJOR_FAST=0x4000, EREV=0x100000,
// CHOL_HAMOED=0x200000 — cross-checked against core 6.9.2's event flags)
export const FLAG_CHAG = flags.CHAG;
export const FLAG_MAJOR_FAST = flags.MAJOR_FAST;   // Yom Kippur, Tisha B'Av

/** Banner exclusions (locked with the gabbai, Sep 14 2026): very minor days
 *  tied to specific ethnic customs stay off the shul screen. חג הבנות
 *  (Eid el-Banat, 30 Kislev) is hebcal-reported but filtered on request. */
export const BANNER_EXCLUDE = new Set(['חג הבנות']);

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
});

export function fmt(d) {
  return d ? TIME_FMT.format(d) : '';
}

/** Clean Hebrew event text via hebcal's no-nikkud locale (proper ktiv male —
 *  stripping nikkud manually breaks words like סֻכּוֹת → סכות). Drops the
 *  (חוה״מ) marker as noise, keeps other parenthetical content — e.g.
 *  "סוכות ז׳ (הושענא רבה)" → "סוכות ז׳ הושענא רבה" (the name people use) —
 *  and removes trailing year numbers. */
export function cleanHebrew(ev) {
  let t = stripNikkud(ev.render('he-x-NoNikud') || ev.render('he') || '');
  t = t.replace(/\s*\(\u05D7\u05D5\u05D4\u05F4\u05DE\)/g, '');   // (חוה״מ)
  t = t.replace(/\s*\((.*?)\)/g, ' $1');                         // keep suffixes
  // Nidche Tisha B'Av: hebcal's locale string is malformed —
  // "(תשעה באב (נדחה" (two opens, no close, so the rules above miss it).
  // Gabbai decision (Sep 2026): drop the נדחה marker and any stray parens
  // entirely → plain "תשעה באב".
  t = t.replace(/\s*\u05E0\u05D3\u05D7\u05D4/g, '');              // נדחה
  t = t.replace(/[()]/g, '');
  t = t.replace(/\s*\d+\s*$/, '');
  return t.replace(/\s{2,}/g, ' ').trim();
}

// ─── calendar helpers ─────────────────────────────────────────────────────────

/** Midday local anchor for a Hebrew date (avoids DST/midnight edge cases) */
export function middayOf(hd) {
  const g = hd.greg();
  return new Date(g.getFullYear(), g.getMonth(), g.getDate(), 12, 0, 0);
}

/** hebcal events for a single Hebrew date. omer:true makes hebcal emit the
 * OmerEvent each day of Sefirat Haomer (Q10:A — "anything hebcal reports",
 * includes the omer count). */
export function eventsForHDate(hd, gloc) {
  return [...HebrewCalendar.calendar({ start: hd, end: hd, il: true, location: gloc, omer: true })];
}

/** Does this day's event list carry the CHAG flag (full Yom Tov, not CHM)? */
export function hasChag(evs) {
  return evs.some((ev) => ((ev.getFlags?.() ?? 0) & FLAG_CHAG) !== 0);
}

/** Is this day a fast day? Returns the event or null. Erev-fasts (e.g. hebcal's
 *  "Erev Tish'a B'Av" marker on 8 Av) are NOT the fast itself — excluded. */
export function fastOf(evs) {
  return evs.find((ev) => (ev.getCategories?.() ?? []).includes('fast')
    && ((ev.getFlags?.() ?? 0) & flags.EREV) === 0) || null;
}

export function shkiahOf(gloc, hd) {
  return new Zmanim(gloc, middayOf(hd)).shkiah();
}

export function candlesAt(gloc, hd) {
  return new Date(shkiahOf(gloc, hd).getTime() + CANDLE_OFFSET_MIN * 60000);
}

export function havdalahAt(gloc, hd) {
  return new Date(shkiahOf(gloc, hd).getTime() + HAVDALAH_OFFSET_MIN * 60000);
}

/** Fast end: Yom Kippur at havdalah (shkiah+32); every other fast at the
 * Or Hahaim tzais (the left column's צאת הכוכבים). */
export function fastEndAt(gloc, hd) {
  return new Date(orHahaim(gloc, middayOf(hd)).tzais.getTime());
}

/**
 * The exit line(s) of a holy run whose LAST member is runEnd — shared by
 * the in-period pair (periodPair.js) and the erev entry (events.js), so
 * candle-lighting days always show the period's exit next to its entry.
 *
 * A trailing fast bridge (Tisha B'Av after Shabbat) ends at ITS fast end
 * (OH tzais) and shows BOTH fast lines — gabbai decision (Sep 2026): the
 * days BEFORE the fast must show when it begins, never a bare end line.
 * The start follows the fast block's rule: TB begins at shkiah of the eve.
 * YK is a chag (CHAG flag) so it exits at havdalah with יציאת החג; a
 * Shabbat-only run shows הבדלה (chag label wins, Q8).
 *
 * @returns {{label: string, time: string}[]}
 */
export function exitLinesOf(gloc, runEnd) {
  const endEvs = eventsForHDate(runEnd, gloc);
  const endIsFastBridge = continuesRun(endEvs) && !hasChag(endEvs);
  if (endIsFastBridge) {
    return [
      { label: 'תחילת הצום', time: fmt(shkiahOf(gloc, new HDate(runEnd.abs() - 1))) },
      { label: 'סיום הצום', time: fmt(fastEndAt(gloc, runEnd)) },
    ];
  }
  const exitLabel = hasChag(endEvs) ? 'יציאת החג' : 'הבדלה';
  return [{ label: exitLabel, time: fmt(havdalahAt(gloc, runEnd)) }];
}

/** Minor-fast start: the Or Hahaim dawn (alot) of the fast's own day. */
export function orHahaimAlot(gloc, hd) {
  return orHahaim(gloc, middayOf(hd)).alot;
}

/** A holy day for period purposes: Shabbat ∪ CHAG ∪ CHM. */
export function holyOf(evs, hd) {
  if (hd.getDay() === 6) return true;                           // Shabbat
  if (hasChag(evs)) return true;                                 // Yom Tov
  if (evs.some((ev) => (ev.getFlags?.() ?? 0) & flags.CHOL_HAMOED)) return true;
  return false;
}

/** A major fast day (YK / Tisha B'Av) bridges a holy run without being holy. */
export function continuesRun(evs) {
  const f = fastOf(evs);
  return !!(f && ((f.getFlags?.() ?? 0) & FLAG_MAJOR_FAST) !== 0);
}

/** Walk back from hd to the run's first member (holy or fast bridge). */
export function walkBack(hd, gloc) {
  let start = hd;
  while (true) {
    const prev = new HDate(start.abs() - 1);
    const prevEvs = eventsForHDate(prev, gloc);
    if (holyOf(prevEvs, prev) || continuesRun(prevEvs)) start = prev;
    else break;
  }
  return start;
}

/** Walk forward from hd to the run's last day, INCLUDING a trailing fast
 *  bridge (Shabbat→YK: the run's exit is YK's shkiah+32). */
export function walkForward(hd, gloc) {
  let cur = hd;
  let end = hd;
  while (true) {
    const next = new HDate(cur.abs() + 1);
    const nextEvs = eventsForHDate(next, gloc);
    const curEvs = eventsForHDate(cur, gloc);
    if (holyOf(nextEvs, next)) { cur = next; end = next; }
    else if (continuesRun(nextEvs) && (holyOf(curEvs, cur) || continuesRun(curEvs))) {
      cur = next; end = next;  // fast bridge continues the run
    } else break;
  }
  return end;
}

/** Entry label of a run: what STARTED it — a chag member's first night is
 *  כניסת החג (chag label wins, Q8); a Shabbat-only run is candles. */
export function entryLabelOf(gloc, startHd) {
  return hasChag(eventsForHDate(startHd, gloc)) ? 'כניסת החג' : 'הדלקת נרות';
}