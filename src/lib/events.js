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
 *  - Fixed pair per holy period (locked "B", Sep 14 2026): from the first
 *    night through the whole chag/Shabbat, the panel shows ONE pair — the
 *    period's entry time (candles of its eve) and the period's final exit
 *    time (shkiah+32 of its last day). Every day of the period shows the
 *    same pair (RH d1 AND d2 both show כניסת החג + יציאת החג).
 *    A holy period = a maximal run of consecutive holy days, where holy =
 *    Shabbat ∪ CHAG ∪ CHM; a major fast day (Yom Kippur / Tisha B'Av)
 *    continues a run (Shabbat→YK suppresses Shabbat's exit) but is never a
 *    period member itself (its fast block covers it — YK's סיום הצום IS
 *    its exit).
 *  - Erev (chol daytime before holiness starts tonight) shows the entry
 *    line only; the full pair appears from the first night onward.
 *  - Shabbat eve INSIDE an active period (e.g. Hoshana Rabbah Friday) adds
 *    a supplementary הדלקת נרות line for tonight (lit from an existing
 *    flame) alongside the period pair.
 *  - Jewish-day lifecycle (Q7:A + linger fix): a line lives for its Jewish
 *    day — from the day-start tzeit (the same one the header uses) to the
 *    day-end tzeit. The period pair lingers ONE hour past the exit time
 *    after the day flips, recomputed statelessly from yesterday.
 *  - Banners (Q10:A): every event hebcal reports that Jewish day — Yom Tov,
 *    erev, CHM, special Shabbatot, Rosh Chodesh, modern holidays — as
 *    name-only lines. Fasts get their banner via the fast block instead.
 *  - Layout (Q4:C): banners first, then timed lines; all black.
 */

import { HDate, HebrewCalendar, Zmanim, flags } from '@hebcal/core';
import { stripNikkud } from './reading.js';
import { dayFlipTzais, orHahaim } from './zmanim.js';

// ─── Or Hahaim offsets (minutes, relative to @hebcal/core shkiah) ─────────────

const CANDLE_OFFSET_MIN = -18;
const HAVDALAH_OFFSET_MIN = 32;   // also fast end
const LINGER_MS = 60 * 60 * 1000; // exit lines stay 1h past their time

// Named flags from @hebcal/core (verified identical to the raw hex values
// previously hardcoded: CHAG=1, MAJOR_FAST=0x4000, EREV=0x100000,
// CHOL_HAMOED=0x200000 — cross-checked against core 6.9.2's event flags)
const FLAG_CHAG = flags.CHAG;
const FLAG_MAJOR_FAST = flags.MAJOR_FAST;   // Yom Kippur, Tisha B'Av

// ─── formatting ──────────────────────────────────────────────────────────────

/** Banner exclusions (locked with the gabbai, Sep 14 2026): very minor days
 *  tied to specific ethnic customs stay off the shul screen. חג הבנות
 *  (Eid el-Banat, 30 Kislev) is hebcal-reported but filtered on request. */
const BANNER_EXCLUDE = new Set(['חג הבנות']);

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
});

function fmt(d) {
  return d ? TIME_FMT.format(d) : '';
}

/** Clean Hebrew event text via hebcal's no-nikkud locale (proper ktiv male —
 *  stripping nikkud manually breaks words like סֻכּוֹת → סכות). Drops the
 *  (חוה״מ) marker as noise, keeps other parenthetical content — e.g.
 *  "סוכות ז׳ (הושענא רבה)" → "סוכות ז׳ הושענא רבה" (the name people use) —
 *  and removes trailing year numbers. */
function cleanHebrew(ev) {
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
function middayOf(hd) {
  const g = hd.greg();
  return new Date(g.getFullYear(), g.getMonth(), g.getDate(), 12, 0, 0);
}

/** hebcal events for a single Hebrew date. omer:true makes hebcal emit the
 * OmerEvent each day of Sefirat Haomer (Q10:A — "anything hebcal reports",
 * includes the omer count). */
function eventsForHDate(hd, gloc) {
  return [...HebrewCalendar.calendar({ start: hd, end: hd, il: true, location: gloc, omer: true })];
}

/** Does this day's event list carry the CHAG flag (full Yom Tov, not CHM)? */
function hasChag(evs) {
  return evs.some((ev) => ((ev.getFlags?.() ?? 0) & FLAG_CHAG) !== 0);
}

/** Is this day a fast day? Returns the event or null. Erev-fasts (e.g. hebcal's
 * "Erev Tish'a B'Av" marker on 8 Av) are NOT the fast itself — excluded. */
function fastOf(evs) {
  return evs.find((ev) => (ev.getCategories?.() ?? []).includes('fast')
    && ((ev.getFlags?.() ?? 0) & flags.EREV) === 0) || null;
}

function shkiahOf(gloc, hd) {
  return new Zmanim(gloc, middayOf(hd)).shkiah();
}

function candlesAt(gloc, hd) {
  return new Date(shkiahOf(gloc, hd).getTime() + CANDLE_OFFSET_MIN * 60000);
}

function havdalahAt(gloc, hd) {
  return new Date(shkiahOf(gloc, hd).getTime() + HAVDALAH_OFFSET_MIN * 60000);
}

/** Fast end: Yom Kippur at havdalah (shkiah+32); every other fast at the
 * Or Hahaim tzais (the left column's צאת הכוכבים). */
function fastEndAt(gloc, hd) {
  return new Date(orHahaim(gloc, middayOf(hd)).tzais.getTime());
}

/**
 * Compute the event lines for the center column.
 *
 * @param {Location} gloc
 * @param {Date} now  current instant
 * @returns {{ banners: string[], timed: {label: string, time: string}[] }}
 */
export function computeEventLines(gloc, now) {
  const banners = [];
  const timed = [];

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

  // ── Banners: every event hebcal reports today (Q10:A) ───────────────────
  const seen = new Set();
  for (const ev of evsToday) {
    const cats = ev.getCategories?.() ?? [];
    if (cats.includes('fast')) continue;   // fast banner comes from the fast block
    if (cats.includes('omer')) {
      const t = cleanHebrew(ev);           // Sefirat Haomer count (e.g. כ״ט בעומר)
      if (!seen.has(t)) { seen.add(t); banners.push(t); }
      continue;                           // Lag BaOmer: holiday + omer dedupe
    }
    if (cats.includes('roshchodesh') || cats.includes('holiday')) {
      const t = cleanHebrew(ev);           // Yom Tov, erev, CHM, special Shabbatot, modern
      if (BANNER_EXCLUDE.has(t)) continue; // gabbai-filtered noise (e.g. חג הבנות)
      if (!seen.has(t)) { seen.add(t); banners.push(t); }
    }
  }

  // ── Fast block (Q9:A) ─────────────────────────────────────────────────────
  const fastEv = fastOf(evsToday);
  if (fastEv) {
    const fastFlags = fastEv.getFlags?.() ?? 0;
    const isMajor = (fastFlags & FLAG_MAJOR_FAST) !== 0;
    const isYK = isMajor && hasChag(evsToday); // YK is a chag; TB is not
    banners.push(cleanHebrew(fastEv));

    if (isMajor) {
      // YK begins at the erev candle-lighting time; TB at shkiah itself.
      const start = isYK
        ? candlesAt(gloc, yesterday)
        : shkiahOf(gloc, yesterday);
      timed.push({ label: 'תחילת הצום', time: fmt(start) });
    } else {
      // Minor fasts (Tzom Gedalia, 10 Tevet, 17 Tamuz, Taanit Esther): dawn.
      // Or Hahaim alot (same model as the left column) — not hebcal's 16.1°.
      // (Unreachable-null fallback removed — orHahaim never returns null at
      // this latitude; a silent hebcal-16.1° substitution would be worse
      // than a crash on a production screen.)
      timed.push({ label: 'תחילת הצום', time: fmt(orHahaim(gloc, middayOf(today)).alot) });
    }
    timed.push({ label: 'סיום הצום', time: fmt(isYK ? havdalahAt(gloc, today) : fastEndAt(gloc, today)) });
  }

  // ── Fixed pair per holy period (locked "B") ─────────────────────────────────
  // A period is a maximal run of consecutive holy days (holy = Shabbat ∪
  // CHAG ∪ CHM; a major fast day continues a run as a "bridge" but is not a
  // member). Every in-period day shows the same pair: the period's entry
  // (candles of its eve) and its final exit (shkiah+32 of its last member).
  function holyOf(evs, hd) {
    if (hd.getDay() === 6) return true;                           // Shabbat
    if (hasChag(evs)) return true;                                 // Yom Tov
    if (evs.some((ev) => (ev.getFlags?.() ?? 0) & flags.CHOL_HAMOED)) return true;
    return false;
  }
  function continuesRun(evs) {  // major fast (YK / Tisha B'Av) bridges a run
    const f = fastOf(evs);
    return !!(f && ((f.getFlags?.() ?? 0) & FLAG_MAJOR_FAST) !== 0);
  }

  const todayHoly = holyOf(evsToday, today);
  const todayContinues = continuesRun(evsToday);
  const yesterdayHoly = holyOf(evsYesterday, yesterday);
  const yesterdayContinues = continuesRun(evsYesterday);
  const tomorrowHoly = holyOf(evsTomorrow, tomorrow);
  const tomorrowContinues = continuesRun(evsTomorrow);

  // In-period: today is holy, or Shabbat flowing into a fast bridge (YK).
  const inPeriod = todayHoly || (today.getDay() === 6 && todayContinues);

  if (inPeriod) {
    // ── Walk back to the run's first member ────────────────────────────────
    let start = today;
    while (true) {
      const prev = new HDate(start.abs() - 1);
      const prevEvs = eventsForHDate(prev, gloc);
      if (holyOf(prevEvs, prev) || continuesRun(prevEvs)) start = prev;
      else break;
    }
    // ── Walk forward to the run's last day, INCLUDING a trailing fast
    // bridge (Shabbat→YK: the run's exit is YK's shkiah+32) ──────────────
    let end = today;
    {
      let cur = today;
      while (true) {
        const next = new HDate(cur.abs() + 1);
        const nextEvs = eventsForHDate(next, gloc);
        const curEvs = eventsForHDate(cur, gloc);
        if (holyOf(nextEvs, next)) { cur = next; end = next; }
        else if (continuesRun(nextEvs) && (holyOf(curEvs, cur) || continuesRun(curEvs))) {
          cur = next; end = next;  // fast bridge continues the run
        } else break;
      }
    }

    // On a major-fast day (YK / TB) the fast block already shows both
    // instants (תחילת = entry, סיום = exit) — no period pair on top.
    if (!todayContinues) {
      const periodEve = new HDate(start.abs() - 1);

      // Entry label: what STARTED the run — a chag member's first night is
      // כניסת החג (chag label wins, Q8); a Shabbat-only run is candles.
      const entryLabel = hasChag(eventsForHDate(start, gloc))
        ? 'כניסת החג'
        : 'הדלקת נרות';
      timed.push({ label: entryLabel, time: fmt(candlesAt(gloc, periodEve)) });

      // Exit: the run's final exit instant (last member incl. bridge).
      // A trailing Tisha B'Av bridge ends at ITS fast end (OH tzais), with
      // the fast label — YK keeps יציאת החג at havdalah (it is a chag).
      // Gabbai decision (Sep 2026): a fast-bridged exit shows BOTH the
      // fast's start and end on the days BEFORE the fast (Shabbat 9 Av
      // nidche → the congregation sees when tonight's fast begins) —
      // never a bare end line. The start follows the fast block's rule:
      // TB begins at shkiah of the eve (the Motzei-Shabbat shkiah).
      const endEvs = eventsForHDate(end, gloc);
      const endIsFastBridge = continuesRun(endEvs) && !hasChag(endEvs);
      if (endIsFastBridge) {
        timed.push({ label: 'תחילת הצום', time: fmt(shkiahOf(gloc, new HDate(end.abs() - 1))) });
        timed.push({ label: 'סיום הצום', time: fmt(fastEndAt(gloc, end)) });
      } else {
        const exitLabel = hasChag(endEvs) ? 'יציאת החג' : 'הבדלה';
        timed.push({ label: exitLabel, time: fmt(havdalahAt(gloc, end)) });
      }

      // Supplementary candles: Shabbat eve INSIDE a long run (e.g. Hoshana
      // Rabbah Friday) — tonight's candles lit from an existing flame, in
      // addition to the period pair. Skipped when the run starts today
      // (tonight's candles are already the pair's entry line).
      if (today.getDay() === 5 && start.abs() < today.abs()
          && (tomorrowHoly || tomorrowContinues)) {
        timed.push({ label: 'הדלקת נרות', time: fmt(candlesAt(gloc, today)) });
      }
    }
  } else if (yesterdayHoly || yesterdayContinues) {
    // ── Linger: yesterday's period pair, 1h past its exit, across the flip ──
    let back = yesterday;
    while (true) {
      const prev = new HDate(back.abs() - 1);
      const prevEvs = eventsForHDate(prev, gloc);
      if (holyOf(prevEvs, prev) || continuesRun(prevEvs)) back = prev;
      else break;
    }
    // The linger window keys off the period's true exit instant. A TB
    // bridge ended at ITS fast end (OH tzais), not at havdalah.
    const yesterdayEndedAtFast = yesterdayContinues && !yesterdayHoly;
    const exitTime = yesterdayEndedAtFast
      ? fastEndAt(gloc, yesterday)
      : havdalahAt(gloc, yesterday);
    if (now <= new Date(exitTime.getTime() + LINGER_MS)) {
      // Standalone fast (TB with no holy neighbour): the fast block already
      // showed both instants — nothing to linger. (back === yesterday means
      // the run was the lone fast day, so there is no pair to show.)
      const standaloneFast = yesterdayContinues && back.abs() === yesterday.abs();
      if (!standaloneFast) {
        const entryLabel = hasChag(eventsForHDate(back, gloc))
          ? 'כניסת החג'
          : 'הדלקת נרות';
        const wasFastExit = yesterdayContinues && !yesterdayHoly;
        const exitLabel = wasFastExit
          ? 'סיום הצום'                       // TB bridge was the last day
          : (hasChag(evsYesterday) ? 'יציאת החג' : 'הבדלה');
        timed.push({ label: entryLabel, time: fmt(candlesAt(gloc, new HDate(back.abs() - 1))) });
        // Fast-bridged exits linger with BOTH fast lines (gabbai decision,
        // Sep 2026 — never a bare end line), same as the in-period display.
        // תחילת = shkiah of the fast's EVE (yesterday−1), matching the fast
        // block's start rule.
        if (wasFastExit) {
          timed.push({ label: 'תחילת הצום', time: fmt(shkiahOf(gloc, new HDate(yesterday.abs() - 1))) });
        }
        timed.push({ label: exitLabel, time: fmt(exitTime) });
      }
    }
  }

  // ── Erev (chol today, holiness starts tonight): tonight's entry line ────────
  // Tisha B'Av has no candles — a major fast without the chag flag is
  // excluded (YK keeps its line: it lights candles and carries CHAG).
  if (!inPeriod && (tomorrowHoly || (tomorrowContinues && hasChag(evsTomorrow)))) {
    const label = hasChag(evsTomorrow) ? 'כניסת החג' : 'הדלקת נרות';
    timed.push({ label, time: fmt(candlesAt(gloc, today)) });
  }

  return { banners, timed };
}