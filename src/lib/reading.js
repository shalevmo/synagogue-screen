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
 * Find the reading for the upcoming Shabbat.
 *
 * Regular weeks: the weekly parsha.
 *
 * Holiday weeks (Rosh Hashana, Yom Kippur on Shabbat, Sukkot I / CH''M,
 * Shmini Atzeret, Pesach…): no weekly parsha is read — hebcal emits no
 * ParshaEvent for those days, but it does emit the holiday itself, so we
 * show the holiday name as the reading. All computation is local
 * (@hebcal/core), no external APIs.
 *
 * Ultimate fallback (holiday event unexpectedly missing): the holiday
 * reading is shown as "קריאת החג ראש השנה" style text — with just the
 * generic label if even the holiday name is unavailable.
 *
 * @param {Date} now  reference "today"
 * @param {Location|null} gloc  optional Location (parity with old findParsha)
 * @returns {{text: string, isHoliday: boolean}}
 */
export function findShabbatReading(now, gloc) {
  const dayOfWeek = now.getDay();
  const daysUntilShabbat = dayOfWeek === 6 ? 7 : 6 - dayOfWeek;
  const shabbat = new Date(now);
  shabbat.setDate(shabbat.getDate() + daysUntilShabbat);
  const shabbatHd = new HDate(shabbat);

  const cal = HebrewCalendar.calendar({
    start: shabbatHd, end: shabbatHd,
    il: true, location: gloc, sedrot: true,
  });

  let holidayName = '';

  if (cal) {
    for (const ev of cal) {
      // Don't rely on constructor.name — it is mangled by minifiers.
      // Parsha events render Hebrew text starting with 'פָּרָשַׁת' / 'פרשת'.
      const hebrew = stripNikkud(ev.render('he') || '').trim();
      if (/^פרש[הת] /.test(hebrew)) {
        return { text: hebrew.replace(/\s*\(.*\)/, '').trim(), isHoliday: false };
      }
      // Remember the first holiday event seen (used only if no parsha is found).
      const cats = ev.getCategories ? ev.getCategories() : [];
      if (!holidayName && cats.includes('holiday')) {
        holidayName = hebrew
          .replace(/\s*\(.*\)/, '')    // English suffixes, e.g. "(CH''M)"
          .replace(/\s*\d+\s*$/, '')   // trailing year, e.g. "ראש השנה 5787"
          .trim();
      }
    }
  }

  // No parsha this Shabbat — the reading is the holiday's. The header stays
  // "פרשת השבוע" (App.jsx); show just the generic holiday-reading label.
  return { text: 'קריאת החג', isHoliday: true };
}