/**
 * Or Hahaim (Chida) zmanim — the convention the community follows
 * (calendar.2net.co.il, method "אור החיים").
 *
 * Locked with the gabbai, Sep 14 2026: the LEFT zmanim column follows this
 * model instead of @hebcal/core's defaults (which mix Baal-Hatanya tzais and
 * MGA-16.1° sof zmanim). The fast-day start (תחילת הצום of minor fasts)
 * uses the same Or Hahaim alot for consistency.
 *
 * Model — reverse-engineered from 2net's own אור החיים daily tables for
 * Netivot (anchors 2026-09-14, 2026-09-19, 2026-12-21, 2027-03-21, 2027-06-21,
 * pulled via scripts/pull-2net-methods.mjs; every value matches within the
 * accepted 1–2 min engine drift, most within 1 min — pinned by
 * scripts/test-zmanim.mjs):
 *
 *   standard hour      h = (shkiah − sunrise) / 12
 *   עלות השחר           alot = sunrise − 1.25·h          (72 zmanit minutes)
 *   OH seasonal hour    H = (chatzot − alot) / 6           (the dawn→noon
 *                       hour — Or Hahaim's distinctive shaot zmaniyot)
 *   שמע מג״א            alot + 3·H   (= sunrise + 2.375·h)
 *   תפילה מג״א          alot + 4·H   (= sunrise + 3.583·h)
 *   שמע / תפילה גר״א    sunrise + 3·h / + 4·h              (unchanged —
 *                       identical to hebcal's defaults)
 *   צאת הכוכבים         shkiah + 0.25·h                    (locked "A":
 *                       2net's daily-table tzais. The center panel's havdalah
 *                       deliberately stays shkiah+32 — chosen separately.)
 *
 * זריחה, חצות and שקיעה are convention-independent (identical in any
 * system) and pass through from hebcal unchanged.
 */
import { Zmanim } from '@hebcal/core';

/**
 * @param {Location} gloc
 * @param {Date} t   any instant of the civil day to compute for
 * @returns {null | {
 *   sunrise: Date, shkiah: Date, chatzot: Date,
 *   alot: Date, shmaMGA: Date, tefMGA: Date,
 *   shmaGRA: Date, tefGRA: Date, tzais: Date,
 * }}  null when the sun never rises or sets that day (not our latitude)
 */
export function orHahaim(gloc, t) {
  const z = new Zmanim(gloc, t);
  const sunrise = z.sunrise();
  const shkiah = z.shkiah();
  if (!sunrise || !shkiah) return null;
  const chatzot = z.chatzot();
  const hourMs = (shkiah.getTime() - sunrise.getTime()) / 12;
  const alot = new Date(sunrise.getTime() - 1.25 * hourMs);
  const ohHourMs = (chatzot.getTime() - alot.getTime()) / 6;
  return {
    sunrise,
    shkiah,
    chatzot,
    alot,
    shmaMGA: new Date(alot.getTime() + 3 * ohHourMs),
    tefMGA: new Date(alot.getTime() + 4 * ohHourMs),
    shmaGRA: z.sofZmanShma(),
    tefGRA: z.sofZmanTfilla(),
    tzais: new Date(shkiah.getTime() + 0.25 * hourMs),
  };
}