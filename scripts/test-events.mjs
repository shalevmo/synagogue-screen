/**
 * Edge-case battery for src/lib/events.js — validates the locked rule set
 * against the REAL 5787 calendar (anchors derived from HDate.abs() ground
 * truth; expected times cross-checked against 2net's published Netivot
 * table and @hebcal/core's own holiday definitions).
 *
 * Run: node scripts/test-events.mjs
 */
import { Location, HDate, HebrewCalendar } from '@hebcal/core';
import { computeEventLines } from '../src/lib/events.js';

const loc = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);

/** Instant at local Israel time — machine runs UTC, so pass the UTC instant
 *  that equals the desired Israel wall-clock time (IDT=UTC+3, IST=UTC+2). */
function at(y, mo, d, h, mi = 0) {
  // Israel is UTC+3 in summer (IDT), UTC+2 in winter (IST) — build from the
  // Hebrew date's greg anchor instead: use midday to sidestep DST shifts.
  return new Date(y, mo - 1, d, h, mi, 0);
}

let failures = 0;
let checks = 0;

function check(label, cond, detail = '') {
  checks++;
  if (cond) console.log(`  ✓ ${label}`);
  else { failures++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
}

function lines(res) {
  return [
    ...res.banners.map((b) => `banner:${b}`),
    ...res.timed.map((t) => `${t.label} ${t.time}`),
  ].join(' | ');
}

const time = (res, label) => res.timed.find((t) => t.label === label)?.time;

console.log('══ 1. Regular Friday (chol, 16 Oct 2026)');
{
  const res = computeEventLines(loc, at(2026, 10, 16, 10, 0));
  console.log('   ', lines(res));
  check('הדלקת נרות shown', res.timed.some((t) => t.label === 'הדלקת נרות'));
  check('time = 17:50 (hebcal shkiah 18:08 − 18m)', time(res, 'הדלקת נרות') === '17:50');
  check('no havdalah', !res.timed.some((t) => t.label === 'הבדלה'));
}

console.log('══ 2. Regular Shabbat (chol, 17 Oct 2026) — full pair all day');
{
  const res = computeEventLines(loc, at(2026, 10, 17, 10, 0));
  console.log('   ', lines(res));
  check('הבדלה shown', res.timed.some((t) => t.label === 'הבדלה'));
  check('time = 18:39 (hebcal shkiah 18:07 + 32m)', time(res, 'הבדלה') === '18:39');
  check('candles shown too (pair, from Friday)', time(res, 'הדלקת נרות') === '17:50');
}

console.log('══ 3. Today — Tzom Gedaliah (Mon 14 Sep 2026, 3 Tishrei)');
{
  const res = computeEventLines(loc, at(2026, 9, 14, 10, 0));
  console.log('   ', lines(res));
  check('banner צום גדליה', res.banners.includes('צום גדליה'));
  check('תחילת הצום at alot', res.timed.some((t) => t.label === 'תחילת הצום'));
  check('סיום הצום = 19:21 (shkiah 18:49+32)', time(res, 'סיום הצום') === '19:21');
  check('no candles (chol)', !res.timed.some((t) => t.label === 'הדלקת נרות' || t.label === 'כניסת החג'));
}

console.log('══ 4. Erev RH ON FRIDAY (Fri 11 Sep 2026, 29 Elul)');
{
  const res = computeEventLines(loc, at(2026, 9, 11, 10, 0));
  console.log('   ', lines(res));
  check('banner ערב ראש השנה', res.banners.some((b) => b.startsWith('ערב')));
  // Shabbat + RH d1 start tonight — entry only (chag label wins, Q8).
  check('כניסת החג 18:34 (RH + Shabbat tonight)', time(res, 'כניסת החג') === '18:34');
}

console.log('══ 5. RH d1 ON SHABBAT (Sat 12 Sep 2026) — full pair (locked B)');
{
  const res = computeEventLines(loc, at(2026, 9, 12, 10, 0));
  console.log('   ', lines(res));
  check('banner ראש השנה', res.banners.some((b) => b.includes('ראש השנה')));
  check('כניסת החג 18:34 (period entry, chag label)', time(res, 'כניסת החג') === '18:34');
  check('יציאת החג 19:22 (period exit on d2)', time(res, 'יציאת החג') === '19:22');
}

console.log('══ 6. RH d2 (Sun 13 Sep 2026) — same pair as d1 (locked B)');
{
  const res = computeEventLines(loc, at(2026, 9, 13, 10, 0));
  console.log('   ', lines(res));
  check('banner ראש השנה ב׳', res.banners.some((b) => b.includes('ראש השנה')));
  check('יציאת החג shown', res.timed.some((t) => t.label === 'יציאת החג'));
  check('time = 19:22 (shkiah 18:50+32)', time(res, 'יציאת החג') === '19:22');
  check('SAME entry as d1 (fixed pair)', time(res, 'כניסת החג') === '18:34');
}

console.log('══ 7. Post-fast Monday (14 Sep, fast lines gone from the 15th)');
{
  const res = computeEventLines(loc, at(2026, 9, 15, 10, 0));
  console.log('   ', lines(res));
  check('no fast block on 4 Tishrei', !res.banners.includes('צום גדליה'));
}

console.log('══ 8. Erev YK (Sun 20 Sep 2026, Shabbat… no — Monday)');
{
  const res = computeEventLines(loc, at(2026, 9, 20, 10, 0));
  console.log('   ', lines(res));
  check('banner ערב יום כיפור', res.banners.some((b) => b.includes('ערב')));
  check('כניסת החג shown (YK tonight)', res.timed.some((t) => t.label === 'כניסת החג'));
}

console.log('══ 9. YK DAY (Mon 21 Sep 2026) — major fast + chag');
{
  const res = computeEventLines(loc, at(2026, 9, 21, 10, 0));
  console.log('   ', lines(res));
  check('banner יום כיפור', res.banners.includes('יום כיפור'));
  check('תחילת הצום at candles time (18:23 = erev shkiah−18)', time(res, 'תחילת הצום') === '18:23');
  check('סיום הצום = 19:11 (hebcal shkiah 18:39 + 32m)', time(res, 'סיום הצום') === '19:11');
  check('NO duplicate יציאת החג (suppressed)', !res.timed.some((t) => t.label === 'יציאת החג'));
}

console.log('══ 10. Shabbat Shuva (Sat 19 Sep 2026) — full pair; YK starts SUN NIGHT');
{
  const res = computeEventLines(loc, at(2026, 9, 19, 10, 0));
  console.log('   ', lines(res));
  check('banner שבת שובה', res.banners.some((b) => b.includes('שובה')));
  check('הבדלה 19:14 (Shabbat exits to chol Sunday)', time(res, 'הבדלה') === '19:14');
  check('candles 18:25 (pair entry)', time(res, 'הדלקת נרות') === '18:25');
  check('NO כניסת החג (YK is Monday, not tomorrow)', !res.timed.some((t) => t.label === 'כניסת החג'));
}

console.log('══ 11. Erev Sukkot (Fri 25 Sep 2026, 14 Tishrei)');
{
  const res = computeEventLines(loc, at(2026, 9, 25, 10, 0));
  console.log('   ', lines(res));
  check('banner ערב סוכות (ktiv male!)', res.banners.some((b) => b === 'ערב סוכות'));
  check('כניסת החג shown (Sukkot + Shabbat tonight)', res.timed.some((t) => t.label === 'כניסת החג'));
  check('time = 18:16 (2net: 18:16)', time(res, 'כניסת החג') === '18:16');
}

console.log('══ 12. Sukkot d1 ON SHABBAT (Sat 26 Sep 2026) — one pair for the whole run');
{
  const res = computeEventLines(loc, at(2026, 9, 26, 10, 0));
  console.log('   ', lines(res));
  check('banner סוכות א׳ (ktiv male!)', res.banners.includes('סוכות א׳'));
  check('כניסת החג 18:16 (period entry)', time(res, 'כניסת החג') === '18:16');
  check('יציאת החג 18:56 (period exit = SA Sunday)', time(res, 'יציאת החג') === '18:56');
}

console.log('══ 13. HR Friday (2 Oct 2026) — pair + tonight candles (existing flame)');
{
  const res = computeEventLines(loc, at(2026, 10, 2, 10, 0));
  console.log('   ', lines(res));
  check('banner סוכות ז׳ הושענא רבה (ktiv male!)', res.banners.some((b) => b.includes('סוכות ז׳') && b.includes('הושענא רבה')));
  check('pair present: כניסת החג 18:16', time(res, 'כניסת החג') === '18:16');
  check('supplementary candles 18:07 (2net SA: 18:07)', time(res, 'הדלקת נרות') === '18:07');
}

console.log('══ 14. SA + ST Shabbat (Sat 3 Oct 2026, 22 Tishrei) — final pair day');
{
  const res = computeEventLines(loc, at(2026, 10, 3, 10, 0));
  console.log('   ', lines(res));
  check('banner שמיני עצרת', res.banners.includes('שמיני עצרת'));
  check('יציאת החג 18:56 = SA shkiah 18:24+32',
    time(res, 'יציאת החג') === '18:56');
  check('כניסת החג 18:16 (same entry as d1)', time(res, 'כניסת החג') === '18:16');
}

console.log('══ 15. Post-SA linger (exit Sat 18:56 → lingers to 19:56)');
{
  const satNight = computeEventLines(loc, at(2026, 10, 3, 19, 30));
  console.log('    Sat 19:30 →', lines(satNight));
  check('pair lingering Saturday night (post-flip)', time(satNight, 'יציאת החג') === '18:56');

  const sunMorning = computeEventLines(loc, at(2026, 10, 4, 10, 0));
  console.log('    Sun 10:00 →', lines(sunMorning));
  check('pair GONE Sunday morning (linger expired Sat 19:56)', !sunMorning.timed.some((t) => t.label === 'יציאת החג'));
}

console.log('══ 16. Motzei Shabbat linger window — Sat 17 Oct, 17:10→20:00');
{
  // Shabbat 17 Oct: shkiah ≈16:38 → havdalah ≈17:10 → linger to 18:10.
  const inWindow = computeEventLines(loc, at(2026, 10, 17, 17, 30));
  console.log('    17:30 →', lines(inWindow));
  check('הבדלה shown at 17:30 (pre-tzais, full day model)', inWindow.timed.some((t) => t.label === 'הבדלה'));

  const afterFlip = computeEventLines(loc, at(2026, 10, 17, 19, 0));
  console.log('    19:00 →', lines(afterFlip));
  check('הבדלה shown at 19:00 (post-flip linger)', afterFlip.timed.some((t) => t.label === 'הבדלה'));

  const expired = computeEventLines(loc, at(2026, 10, 17, 20, 0));
  console.log('    20:00 →', lines(expired));
  check('הבדלה GONE at 20:00 (linger expired 17:10+1h=18:10)', !expired.timed.some((t) => t.label === 'הבדלה'));
}

console.log('══ 17. Rosh Chodesh (1 Cheshvan 5787 — verify date dynamically)');
{
  const hd = new HDate(1, 8, 5787);
  const g = hd.greg();
  const res = computeEventLines(loc, new Date(g.getFullYear(), g.getMonth(), g.getDate(), 10, 0));
  console.log('    1 Cheshvan =', g.toISOString().slice(0, 10), '|', lines(res));
  check('banner ראש חודש', res.banners.some((b) => b.includes('ראש חודש')));
}

console.log('══ 18. Chanukah Friday (4 Dec 2026, 25 Kislev… verify: 24 Kislev?');
{
  const hd = new HDate(new Date(2026, 11, 4));
  console.log('    4 Dec 2026 =', hd.renderGematriya());
  const res = computeEventLines(loc, at(2026, 12, 4, 10, 0));
  console.log('   ', lines(res));
  check('Chanukah banner present', res.banners.some((b) => b.includes('חנוכה')));
  check('Friday candles shown', res.timed.some((t) => t.label === 'הדלקת נרות'));
}

console.log('══ 19. Taanit Esther (13 Adar II 5787 — found via calendar search)');
{
  // 5787 IS a leap year; find Taanit Esther by scanning March 2027.
  const cal = HebrewCalendar.calendar({
    start: new HDate(new Date(2027, 2, 1)),
    end: new HDate(new Date(2027, 2, 31)),
    il: true, location: loc,
  });
  const ev = [...cal].find((e) => (e.getCategories?.() ?? []).includes('fast'));
  const g = ev.getDate().greg();
  const res = computeEventLines(loc, new Date(g.getFullYear(), g.getMonth(), g.getDate(), 10, 0));
  console.log('    fast in Mar 2027 =', ev.render('he-x-NoNikud'), 'on', g.toISOString().slice(0, 10), '|', lines(res));
  check('banner תענית אסתר', res.banners.includes('תענית אסתר'));
  check('תחילת הצום (minor fast, dawn)', res.timed.some((t) => t.label === 'תחילת הצום'));
}

console.log('══ 20. Tisha B\'Av (9 Av 5787 — dynamic anchor)');
{
  const hd = new HDate(9, 5, 5787);
  const g = hd.greg();
  const res = computeEventLines(loc, new Date(g.getFullYear(), g.getMonth(), g.getDate(), 10, 0));
  console.log('    9 Av =', g.toISOString().slice(0, 10), '|', lines(res));
  check('banner תשעה באב', res.banners.includes('תשעה באב'));
  const start = res.timed.find((t) => t.label === 'תחילת הצום')?.time;
  check('תחילת הצום present (TB starts at erev shkiah)', start != null);
  check('TB banner-only day: NO candles fabricated', !res.timed.some((t) => t.label === 'הדלקת נרות' || t.label === 'כניסת החג'));
  check('NO havdalah fabricated (fast is not holy)', !res.timed.some((t) => t.label === 'הבדלה' || t.label === 'יציאת החג'));
}

console.log('\n══════════════════════════════════════');
console.log(`${checks} checks, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);