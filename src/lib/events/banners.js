/**
 * Banners unit — name-only lines for every event hebcal reports today
 * (Q10:A locked): Yom Tov, erev, CHM, special Shabbatot, Rosh Chodesh,
 * modern holidays, the omer count. Fasts are excluded here — the fast
 * block pushes their banner.
 */
import { BANNER_EXCLUDE, cleanHebrew } from './common.js';

/** @returns {string[]} banner lines, in hebcal's event order, deduped */
export function bannersOf(evsToday) {
  const banners = [];
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
  return banners;
}