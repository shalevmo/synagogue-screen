import { HDate } from '@hebcal/core';
import { stripNikkud, findShabbatReading } from './reading.js';
import { orHahaim, dayFlipTzais } from './zmanim.js';
import { findActiveImage } from './imageSchedule.js';

// ─── left-column zmanim rows (Or Hahaim, locked "A" — see lib/zmanim.js) ──────

const ZMANIM_ROWS = [
  { key: 'alot',    name: 'עלות השחר' },
  { key: 'sunrise', name: 'זריחה' },
  { key: 'shmaMGA', name: 'סו״ז שמע מג״א' },
  { key: 'shmaGRA', name: 'סו״ז שמע גר״א' },
  { key: 'tefMGA',  name: 'סו״ז תפילה מג״א' },
  { key: 'tefGRA',  name: 'סו״ז תפילה גר״א' },
  { key: 'chatzot', name: 'חצות' },
  { key: 'shkiah',  name: 'שקיעה' },
  { key: 'tzais',   name: 'צאת הכוכבים' },
];

// ─── module-scope Intl formatters (hoisted: construction is expensive) ────────

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
});
const DOW_FMT = new Intl.DateTimeFormat('he', { weekday: 'short', timeZone: 'Asia/Jerusalem' });

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '';
  return TIME_FMT.format(d);
}

/**
 * Compute all date-derived display data (Hebrew date, Gregorian date,
 * zmanim, parsha/holiday reading, active image) for a given instant.
 * Pure function — called from render via useMemo, never from an effect.
 */
export function computeDisplayData(gloc, images, now) {
  const hd = new HDate(now);

  // Jewish date in header
  // Day-flip tzeit — single source (lib/zmanim.js dayFlipTzais, locked in
  // docs/adr/0001-day-flip-tzais-85.md): the same call the event panel uses,
  // so header and panel flip inseparably. NOT the displayed OH tzais.
  const tzaisAt = dayFlipTzais(gloc, now);
  const isAfterTzais = tzaisAt && now > tzaisAt;
  const displayHd = isAfterTzais
    ? new HDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    : hd;
  const prefix = isAfterTzais ? 'אור ל' : '';
  const jewishDate = (prefix + stripNikkud(displayHd.renderGematriya())).trim();

  // Day + Gregorian date
  const dow = DOW_FMT.format(now);
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dayAndDate = `${dow}\u00a0|\u00a0${dd}/${mm}/${yyyy}`;

  // Zmanim — Or Hahaim (left column follows the community's convention)
  const oh = orHahaim(gloc, now);
  const zmanimTimes = oh
    ? ZMANIM_ROWS.map(({ key, name }) => ({ name, time: fmt(oh[key]) }))
    : ZMANIM_ROWS.map(({ name }) => ({ name, time: '' }));

  // Parsha — or the holiday reading when no regular parsha is read
  // (Rosh Hashana / Yom Kippur / Sukkot / Shmini Atzeret / Pesach Shabbats).
  // On Shabbat itself (before tzais): today's reading, not next week's.
  const reading = findShabbatReading(now, gloc, tzaisAt);

  // Active image based on Hebrew date (displayHd has the correct date)
  const hMonth = displayHd.getMonth();        // hebcal index (1=Nisan, 7=Tishrei)
  const hDay   = displayHd.getDate();         // 1‑31
  const hYear  = displayHd.getFullYear();
  const activeImage = findActiveImage(images, hMonth, hDay, hYear);

  return { jewishDate, dayAndDate, zmanimTimes, reading, activeImage };
}
