import { HDate, HebrewCalendar, Locale } from '@hebcal/core';
import { getLeyningOnDate } from '@hebcal/leyning';

/**
 * Strip nikkud/vowel points, but KEEP the maqaf (U+05BE, Hebrew hyphen) —
 * hebcal joins double parshas with it (e.g. נצבים־וילך) — and the geresh
 * (U+05F3) used for day indicators (e.g. סוכות א׳).
 */
export function stripNikkud(text) {
  if (!text) return '';
  return text.replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C7]/g, '');
}

/**
 * The reading to display for a holiday Shabbat (no weekly parsha read that
 * day). Uses @hebcal/leyning's getLeyningOnDate for the real reading name
 * (e.g. סוכות יום א׳) instead of the generic קריאת החג.
 *
 * Leyning hardcodes 'he' (ktiv haser) in its name builders — the language
 * param never reaches the name — but it registers its own he-x-NoNikud
 * translations into core's shared Locale registry on import. So: read the
 * en key, re-look it up in he-x-NoNikud ourselves. Falls back to leyning's
 * he name (plus stripNikkud) if the registry misses (e.g. future keys).
 *
 * The (בשבת) suffix hebcal appends when the holiday falls on Shabbat is
 * dropped — the screen shows this on Shabbat anyway, so it is redundant.
 */
function holidayReadingName(hd) {
  let reading;
  try {
    reading = getLeyningOnDate(hd, true, false, 'he');
  } catch {
    return null;
  }
  if (!reading || !reading.name || !reading.name.en) return null;
  let t = Locale.lookupTranslation(reading.name.en, 'he-x-NoNikud');
  if (!t) t = stripNikkud(reading.name.he || '');
  if (!t) return null;
  return t
    .replace(/\s*\(.*?\)\s*/g, ' ')   // (בשבת) etc.
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Find the reading to display.
 *
 * On Shabbat (until tzais): TODAY's reading — the weekly parsha, or the
 * holiday's reading when no parsha is read that day (locked with the
 * gabbai, Sep 2026). On holiday Shabbatot the actual reading name
 * (via @hebcal/leyning) shows instead of the old generic קריאת החג.
 *
 * All other days: the reading of the UPCOMING Shabbat (regular weeks: the
 * weekly parsha; holiday Shabbatot: the holiday reading name).
 *
 * @param {Date} now  reference "today"
 * @param {Location|null} gloc  optional Location (parity with old findParsha)
 * @param {Date|null} tzais  today's tzais (Shabbat end); if omitted, the
 *                          tzais check is skipped
 * @returns {{text: string, isHoliday: boolean}}
 */
export function findShabbatReading(now, gloc, tzais) {
  // On Shabbat before tzais: today's reading.
  if (now.getDay() === 6 && !(tzais && now > tzais)) {
    const hd = new HDate(now);
    const cal = HebrewCalendar.calendar({
      start: hd, end: hd,
      il: true, location: gloc, sedrot: true,
    });
    for (const ev of cal) {
      const hebrew = ev.render('he-x-NoNikud') || stripNikkud(ev.render('he') || '');
      if (/^פרש[הת] /.test(hebrew)) {
        return { text: hebrew.replace(/\s*\(.*\)/, '').trim(), isHoliday: false };
      }
    }
    // Shabbat holiday with no parsha → the holiday's reading via leyning;
    // fall back to the generic label if leyning has nothing (e.g. minor
    // special Shabbatot with no alternate reading).
    const holidayName = holidayReadingName(hd);
    return holidayName
      ? { text: holidayName, isHoliday: true }
      : { text: 'קריאת החג', isHoliday: true };
  }

  // Forward-looking: the upcoming Shabbat's reading.
  const dayOfWeek = now.getDay();
  const daysUntilShabbat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const shabbat = new Date(now);
  shabbat.setDate(shabbat.getDate() + daysUntilShabbat);
  const shabbatHd = new HDate(shabbat);

  const cal = HebrewCalendar.calendar({
    start: shabbatHd, end: shabbatHd,
    il: true, location: gloc, sedrot: true,
  });

  if (cal) {
    for (const ev of cal) {
      const hebrew = ev.render('he-x-NoNikud') || stripNikkud(ev.render('he') || '');
      if (/^פרש[הת] /.test(hebrew)) {
        return { text: hebrew.replace(/\s*\(.*\)/, '').trim(), isHoliday: false };
      }
    }
  }

  // No parsha this Shabbat — the reading is the holiday's, via leyning.
  // The header stays "פרשת השבוע" (App.jsx).
  const holidayName = holidayReadingName(shabbatHd);
  return holidayName
    ? { text: holidayName, isHoliday: true }
    : { text: 'קריאת החג', isHoliday: true };
}