/**
 * Fast block unit (Q9:A locked): fast banner + תחילת הצום + סיום הצום.
 *
 *  - Minor fasts (Tzom Gedalia, 10 Tevet, 17 Tamuz, Taanit Esther): start at
 *    the Or Hahaim dawn (alot — same model as the left column), end at the
 *    Or Hahaim tzais.
 *  - Yom Kippur (major fast + CHAG): starts at the erev candle-lighting time
 *    (shkiah−18) — it lights candles; ends at havdalah (shkiah+32). סיום
 *    הצום IS its exit (no separate יציאת החג).
 *  - Tisha B'Av (major fast, no CHAG): starts at shkiah of the eve, ends at
 *    the Or Hahaim tzais.
 */
import {
  cleanHebrew, fastEndAt, fastOf, hasChag, havdalahAt, candlesAt,
  shkiahOf, orHahaimAlot, FLAG_MAJOR_FAST, fmt,
} from './common.js';

/** Returns the fast block's lines for today, or null when today is not
 *  a fast day. Mutates nothing; the caller decides placement. */
export function fastBlockOf(gloc, evsToday, today, yesterday) {
  const fastEv = fastOf(evsToday);
  if (!fastEv) return null;

  const fastFlags = fastEv.getFlags?.() ?? 0;
  const isMajor = (fastFlags & FLAG_MAJOR_FAST) !== 0;
  const isYK = isMajor && hasChag(evsToday); // YK is a chag; TB is not
  const lines = [];
  const timed = [];

  lines.push(cleanHebrew(fastEv));

  if (isMajor) {
    // YK begins at the erev candle-lighting time; TB at shkiah itself.
    const start = isYK
      ? candlesAt(gloc, yesterday)
      : shkiahOf(gloc, yesterday);
    timed.push({ label: 'תחילת הצום', time: fmt(start) });
  } else {
    // Minor fasts: Or Hahaim alot (not hebcal's 16.1°).
    // (Unreachable-null fallback removed — orHahaim never returns null at
    // this latitude; a silent hebcal-16.1° substitution would be worse
    // than a crash on a production screen.)
    timed.push({ label: 'תחילת הצום', time: fmt(orHahaimAlot(gloc, today)) });
  }
  timed.push({ label: 'סיום הצום', time: fmt(isYK ? havdalahAt(gloc, today) : fastEndAt(gloc, today)) });

  return { banners: lines, timed };
}