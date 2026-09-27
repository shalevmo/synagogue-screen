process.env.TZ = 'Asia/Jerusalem';
/**
 * Regression suite for holyOf() in src/lib/events/common.js — the Shabbat ∪
 * Yom Tov classifier every event-panel period is built on. Chol HaMoed is
 * NOT holy (gabbai request, Sep 27 2026): no candles or havdalah on CHM, so
 * Sukkot/Pesach split into separate runs.
 *
 * Two layers:
 *   1. Named anchors (Sep 2026 – Oct 2027): each Yom Tov day, Shabbat
 *      (incl. Shabbat inside CHM), and look-alike days that must stay NOT
 *      holy (weekday CHM, erev, Chanukah, Purim, fasts, Rosh Chodesh …).
 *   2. Full sweep, 1 Sep 2026 → 31 Oct 2027: every day is compared to an
 *      independent spec written as Hebrew dates (Israel calendar), so a
 *      hebcal flag change or a classifier edit that moves ANY day fails.
 *
 * Run: node scripts/test-holy.mjs
 */
import { Location, HDate, months } from '@hebcal/core';
import { eventsForHDate, holyOf } from '../src/lib/events/common.js';

const loc = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);

let failures = 0;
let checks = 0;

function check(label, cond, detail = '') {
  checks++;
  if (cond) console.log(`  ✓ ${label}`);
  else { failures++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

const hdOf = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new HDate(new Date(y, m - 1, d, 12, 0, 0));
};
const isHoly = (hd) => holyOf(eventsForHDate(hd, loc), hd);

/** The spec, independent of hebcal's flags: Israel Yom Tov by Hebrew date.
 *  YK counts (it is a chag); CHM does not; Shabbat is added separately. */
const HOLY_HEBREW = {
  [months.TISHREI]: [1, 2, 10, 15, 22], // RH, YK, Sukkot I, Shmini Atzeret
  [months.NISAN]: [15, 21],             // Pesach I, Pesach VII
  [months.SIVAN]: [6],                  // Shavuot (one day in Israel)
};
const specHoly = (hd) => hd.getDay() === 6
  || (HOLY_HEBREW[hd.getMonth()] ?? []).includes(hd.getDate());

console.log('══ 1. Yom Tov (5787 / 5788)');
for (const [iso, name] of [
  ['2026-09-13', 'Rosh Hashana II 5787 (Sun)'],
  ['2026-09-21', 'Yom Kippur 5787 (Mon)'],
  ['2026-10-03', 'Shmini Atzeret 5787 (Sat)'],
  ['2027-04-22', 'Pesach I (Thu)'],
  ['2027-04-28', 'Pesach VII (Wed)'],
  ['2027-06-11', 'Shavuot (Fri)'],
  ['2027-10-02', 'Rosh Hashana I 5788 (Sat)'],
  ['2027-10-03', 'Rosh Hashana II 5788 (Sun)'],
  ['2027-10-11', 'Yom Kippur 5788 (Mon)'],
  ['2027-10-16', 'Sukkot I 5788 (Sat)'],
  ['2027-10-23', 'Shmini Atzeret 5788 (Sat)'],
]) check(`${iso} ${name} → holy`, isHoly(hdOf(iso)));

console.log('══ 2. Chol HaMoed — weekday CHM is NOT holy; Shabbat inside CHM is');
for (const [iso, name] of [
  ['2026-09-27', 'Sukkot CHM day 1 (Sun)'],
  ['2026-10-01', 'Sukkot CHM (Thu)'],
  ['2026-10-02', 'Hoshana Raba (Fri)'],
  ['2027-04-23', 'Pesach CHM day 1 (Fri)'],
  ['2027-04-25', 'Pesach CHM (Sun)'],
  ['2027-04-27', 'Pesach CHM last (Tue)'],
  ['2027-10-17', 'Sukkot CHM 5788 (Sun)'],
  ['2027-10-22', 'Hoshana Raba 5788 (Fri)'],
]) check(`${iso} ${name} → not holy`, !isHoly(hdOf(iso)));
check('2027-04-24 Shabbat Chol HaMoed Pesach → holy (as Shabbat)', isHoly(hdOf('2027-04-24')));

console.log('══ 3. Plain Shabbat');
for (const iso of ['2026-10-17', '2026-12-05', '2027-02-13', '2027-07-24', '2027-09-25']) {
  check(`${iso} Shabbat → holy`, isHoly(hdOf(iso)));
}

console.log('══ 4. Ordinary and look-alike days → NOT holy');
for (const [iso, name] of [
  ['2026-09-11', 'Erev Rosh Hashana 5787 (Fri)'],
  ['2026-09-20', 'Erev Yom Kippur (Sun)'],
  ['2026-09-15', 'Tzom Gedaliah (Tue)'],
  ['2026-10-04', 'Isru Chag, Sun after Shmini Atzeret'],
  ['2026-10-14', 'ordinary Wednesday'],
  ['2026-10-16', 'ordinary Friday'],
  ['2026-12-07', 'Chanukah (Mon)'],
  ['2027-03-23', 'Purim (Tue)'],
  ['2027-03-24', 'Shushan Purim (Wed)'],
  ['2027-04-08', 'Rosh Chodesh Nisan (Thu)'],
  ['2027-04-21', 'Erev Pesach (Wed)'],
  ['2027-04-29', 'Isru Chag Pesach (Thu)'],
  ['2027-05-12', 'Yom HaAtzmaut (Wed)'],
  ['2027-05-25', 'Lag BaOmer (Tue)'],
  ['2027-06-10', 'Erev Shavuot (Thu)'],
  ['2027-06-12', 'day after Shavuot — Shabbat, holy only as Shabbat'],
  ['2027-08-12', "Tisha B'Av (Thu) — a fast bridge, not holy"],
  ['2027-10-01', 'Erev Rosh Hashana 5788 (Fri)'],
  ['2027-10-10', 'Erev Yom Kippur 5788 (Sun)'],
]) {
  const hd = hdOf(iso);
  // The Shabbat-after-Shavuot row documents that it IS holy (as Shabbat),
  // not as a second Yom Tov day — Israel keeps one day.
  const expect = hd.getDay() === 6;
  check(`${iso} ${name} → ${expect ? 'holy' : 'not holy'}`, isHoly(hd) === expect);
}

console.log('══ 5. Sweep 2026-09-01 → 2027-10-31 vs Hebrew-date spec');
{
  const start = hdOf('2026-09-01').abs();
  const end = hdOf('2027-10-31').abs();
  const mismatches = [];
  let holyDays = 0;
  for (let abs = start; abs <= end; abs++) {
    const hd = new HDate(abs);
    const got = isHoly(hd);
    if (got) holyDays++;
    if (got !== specHoly(hd)) {
      const g = hd.greg();
      mismatches.push(`${g.getFullYear()}-${g.getMonth() + 1}-${g.getDate()} (${hd.toString()}) got ${got}`);
    }
  }
  check(`${end - start + 1} days match the spec`, mismatches.length === 0,
    mismatches.slice(0, 10).join('; '));
  console.log(`    (${holyDays} holy days in range)`);
}

console.log(failures === 0
  ? `\nAll ${checks} checks passed ✓`
  : `\n${failures}/${checks} checks failed ✗`);
process.exit(failures > 0 ? 1 : 0);
