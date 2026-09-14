import { HDate, HebrewCalendar } from '@hebcal/core';

/**
 * Strip nikkud/vowel points, but KEEP the maqaf (U+05BE, Hebrew hyphen) —
 * hebcal joins double parshas with it (e.g. נצבים־וילך) — and the geresh
 * (U+05F3) used for day indicators (e.g. סכות א׳).
 */
export function stripNikkud(text) {
  if (!text) return '';
  return text.replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C7]/g, '');
}

/**
 * Find the reading to display.
 *
 * On Shabbat (until tzais): TODAY's reading — the weekly parsha, or the
 * holiday's reading when no parsha is read that day (locked with the
 * gabbai, Sep 2026).
 *
 * All other days: the reading of the UPCOMING Shabbat (regular weeks: the
 * weekly parsha; holiday Shabbatot: קריאת החג).
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
      const hebrew = stripNikkud(ev.render('he') || '').trim();
      if (/^פרש[הת] /.test(hebrew)) {
        return { text: hebrew.replace(/\s*\(.*\)/, '').trim(), isHoliday: false };
      }
    }
    // Shabbat holiday with no parsha → the holiday's reading. Prefer the
    // actual holiday name over the generic label when available.
    const holiday = [...cal].find((ev) => ev.getCategories?.().includes('holiday'));
    if (holiday) {
      return { text: 'קריאת החג', isHoliday: true };
    }
    return { text: 'קריאת החג', isHoliday: true };
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
      // Don't rely on constructor.name — it is mangled by minifiers.
      // Parsha events render Hebrew text starting with 'פָּרָשַׁת' / 'פרשת'.
      const hebrew = stripNikkud(ev.render('he') || '').trim();
      if (/^פרש[הת] /.test(hebrew)) {
        return { text: hebrew.replace(/\s*\(.*\)/, '').trim(), isHoliday: false };
      }
    }
  }

  // No parsha this Shabbat — the reading is the holiday's. The header stays
  // "פרשת השבוע" (App.jsx); show just the generic holiday-reading label.
  return { text: 'קריאת החג', isHoliday: true };
}