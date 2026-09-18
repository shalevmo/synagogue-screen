process.env.TZ = 'Asia/Jerusalem';
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
import { findShabbatReading } from '../src/lib/reading.js';

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
  check('havdalah shown WITH candles (exit next to entry)', res.timed.some((t) => t.label === 'הבדלה'));
  check('havdalah = 18:39 (hebcal shkiah 18:07 + 32m)', time(res, 'הבדלה') === '18:39');
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
  check('תחילת הצום at OH alot', res.timed.some((t) => t.label === 'תחילת הצום'));
  check('סיום הצום = 19:04 (OH tzais — left column צאת הכוכבים, NOT +32)', time(res, 'סיום הצום') === '19:04');
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

console.log('══ 18b. חג הבנות (30 Kislev, full-Kislev years) — FILTERED');
{
  // 30 Kislev 5787 = Thu 10 Dec 2026 (Kislev is full this year). Day 7 of
  // Chanukah + Rosh Chodesh Tevet + חג הבנות — only the first two show.
  // (greg()-based printing shows one day early — anchor from real-world
  // RC Tevet 5787 = Dec 10–11 2026.)
  const res = computeEventLines(loc, at(2026, 12, 10, 10, 0));
  console.log('   ', lines(res));
  check('NO חג הבנות banner (filtered)', !res.banners.some((b) => b.includes('חג הבנות')));
  check('Chanukah banner still shown', res.banners.some((b) => b.includes('חנוכה')));
  check('Rosh Chodesh banner still shown', res.banners.some((b) => b.includes('ראש חודש')));
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

console.log('══ 20b. Nidche Tisha B\'Av 5789 (9 Av on Shabbat → fast on Sunday 10 Av)');
{
  // Shabbat 9 Av 5789 = 21 Jul 2029. Hebcal shkiah 19:44 (2net prints 19:45 —
  // the accepted ~1-min engine drift; expectations are hebcal-based, like
  // test 20). Fast ends at Sunday's OH tzais 20:01. Gabbai decisions
  // (Sep 2026): banner shows plain "תשעה באב" on Sunday (parens + נדחה
  // stripped); Shabbat shows BOTH תחילת (eve shkiah 19:44) and סיום (20:01).
  const shabbat = computeEventLines(loc, at(2029, 7, 21, 13, 0));
  console.log('    Shabbat 9 Av 13:00 →', lines(shabbat));
  check('Shabbat banner שבת חזון', shabbat.banners.some((b) => b.includes('שבת חזון')));
  check('Shabbat candles 19:27 (pair entry)', time(shabbat, 'הדלקת נרות') === '19:27');
  check('Shabbat shows תחילת הצום 19:44 (eve shkiah)', time(shabbat, 'תחילת הצום') === '19:44');
  check('Shabbat shows סיום הצום 20:01', time(shabbat, 'סיום הצום') === '20:01');
  check('Shabbat shows NO הבדלה (fast bridges the exit)', !shabbat.timed.some((t) => t.label === 'הבדלה'));

  const sunday = computeEventLines(loc, at(2029, 7, 22, 13, 0));
  console.log('    Sunday 10 Av 13:00 →', lines(sunday));
  check('Sunday banner plain תשעה באב (no parens/נדחה)', sunday.banners.includes('תשעה באב'));
  check('Sunday NO stray parens in any banner', sunday.banners.every((b) => !/[()]/.test(b)));
  check('Sunday תחילת הצום 19:44 (erev = Motzei Shabbat shkiah)', time(sunday, 'תחילת הצום') === '19:44');
  check('Sunday סיום הצום 20:01 (OH tzais)', time(sunday, 'סיום הצום') === '20:01');

  const night = computeEventLines(loc, at(2029, 7, 22, 21, 0));
  console.log('    Sunday 21:00 (post-flip) →', lines(night));
  check('post-flip linger: entry candles still shown', night.timed.some((t) => t.label === 'הדלקת נרות'));
  check('post-flip linger: BOTH fast lines (never bare end)', night.timed.some((t) => t.label === 'תחילת הצום') && night.timed.some((t) => t.label === 'סיום הצום'));
}

console.log('══ 21. Holiday-Shabbat readings via @hebcal/leyning (not קריאת החג)');
{
  const r = (t) => findShabbatReading(t, null);
  const at10 = (y, m, d) => new Date(y, m - 1, d, 10, 0, 0);
  check('RH d1 Shabbat → ראש השנה א׳', r(at10(2026, 9, 12)).text === 'ראש השנה א׳');
  check('Sukkot d1 Shabbat → סוכות יום א׳ (ktiv male)', r(at10(2026, 9, 26)).text === 'סוכות יום א׳');
  check('SA/ST Shabbat → שמחת תורה', r(at10(2026, 10, 3)).text === 'שמחת תורה');
  check('CHM Pesach Shabbat → שבת חול המועד פסח (ktiv male)', r(at10(2027, 4, 23)).text === 'שבת חול המועד פסח');
  check('YK Shabbat (2028) → יום כיפור (ktiv male)', r(at10(2028, 9, 28)).text === 'יום כיפור');
  check('regular Shabbat stays parsha (Haazinu)', r(at10(2026, 9, 19)).text === 'פרשת האזינו');
}

console.log('══ 22. Modern holidays, winter anchors, maqaf banners, YK bridge');
{
  // ── Modern holidays (5787): banners only, no timed lines, omer co-shown.
  // Shoah 27 Nisan = Tue 4 May 2027; Zikaron 4 Iyyar = Tue 11 May; Atzmaut 5 Iyyar = Wed 12 May.
  const shoah = computeEventLines(loc, new Date(2027, 4, 4, 10, 0, 0));
  check('Yom HaShoah banner', shoah.banners[0] === 'יום השואה');
  check('Yom HaShoah: omer count co-displayed', shoah.banners.some((b) => /^י״ב בעומר$/.test(b)));
  check('Yom HaShoah: no timed lines', shoah.timed.length === 0);
  const zikaron = computeEventLines(loc, new Date(2027, 4, 11, 10, 0, 0));
  check('Yom HaZikaron banner', zikaron.banners[0] === 'יום הזכרון');
  const atzmaut = computeEventLines(loc, new Date(2027, 4, 12, 10, 0, 0));
  check('Yom HaAtzmaut banner', atzmaut.banners[0] === 'יום העצמאות');

  // ── Winter anchors (IST, UTC+2): times must format in Israel winter clock.
  // RC Tevet 5787 = 10–11 Dec 2026; both days show the banner, no timed lines.
  const rcTevet1 = computeEventLines(loc, new Date(2026, 11, 10, 10, 0, 0));
  check('RC Tevet day1: banner (Chanukah day 7)', rcTevet1.banners.includes('חנוכה: ז׳ נרות'));
  check('RC Tevet day1: RC banner', rcTevet1.banners.some((b) => b.includes('ראש חודש טבת')));
  check('RC Tevet day1: no timed lines', rcTevet1.timed.length === 0);
  const winterShabbat = computeEventLines(loc, new Date(2027, 0, 2, 10, 0, 0));
  check('winter Shabbat candles 16:31 IST', winterShabbat.timed.some((t) => t.label === 'הדלקת נרות' && t.time === '16:31'));
  check('winter Shabbat havdalah 17:22 IST', winterShabbat.timed.some((t) => t.label === 'הבדלה' && t.time === '17:22'));
  check('winter Shabbat: no banners', winterShabbat.banners.length === 0);

  // ── Maqaf banner: Nitzavim-Vayeilech (double parsha) — never a banner path,
  // but 23 Elul 5787 shows סליחות + Shabbat pair. Reading-side maqaf is
  // pinned in verify-reading.mjs (מטות־מסעי); here we pin the Selichot banner
  // and the Shabbat candles pair on a pre-RH Friday evening.
  const selichot = computeEventLines(loc, new Date(2027, 8, 25, 10, 0, 0));
  check('Selichot banner (23 Elul 5787)', selichot.banners[0] === 'סליחות');
  check('Selichot Shabbat: candles 18:18', selichot.timed.some((t) => t.label === 'הדלקת נרות' && t.time === '18:18'));

  // ── YK-on-Shabbat bridge (dead path today, live 5789): the Friday before
  // Sunday-start YK-on-Shabbat shows the chag entry (Q8:B — chag label wins
  // over Shabbat candles on a dual erev), and NO הבדלה (YK swallows the exit).
  const ykErev = computeEventLines(loc, new Date(2028, 8, 29, 10, 0, 0));
  check('erev YK-on-Shabbat: כניסת החג 18:10 (chag label wins)', ykErev.timed.some((t) => t.label === 'כניסת החג' && t.time === '18:10'));
  check('erev YK-on-Shabbat: no הבדלה (exit swallowed by YK)', !ykErev.timed.some((t) => t.label === 'הבדלה'));

  // ── Maqaf double-parsha BANNER: Nitzavim-Vayeilech 5788 (25 Elul 5788,
  // Sat 16 Sep 2028) — special Shabbatot like שבת שובה never carry maqaf,
  // but a double-parsha year's Selichot Shabbat confirms banner rendering.
  const nv5788 = computeEventLines(loc, new Date(2028, 8, 16, 10, 0, 0));
  check('Nitzavim-Vayeilech year: Selichot banner 5788', nv5788.banners[0] === 'סליחות');
}

console.log('══ 23. Candles ALWAYS paired with the exit — Shabbat/Yom Tov overlap');
{
  // ── Yom Tov run with an INNER Shabbat: Sukkot 5786 (erev Mon 6 Oct 2025,
  //    run Tue 7 Oct → ST Mon 13 Oct). The chol erev must show the CHAG
  //    exit of the run's true last day (ST, 18:10+32), NOT an imagined
  //    Friday-candles havdalah — walkForward spans the inner Shabbat.
  const erev = computeEventLines(loc, at(2025, 10, 6, 10, 0));
  console.log('    erev Sukkot-into-Shabbat (Mon 6 Oct 2025) →', lines(erev));
  check('erev: כניסת החג shown', erev.timed.some((t) => t.label === 'כניסת החג'));
  check('erev: exit is יציאת החג (chag run, not havdalah)', erev.timed.some((t) => t.label === 'יציאת החג'));
  check('erev: exit 18:42 = ST shkiah 18:10+32 (run end)', time(erev, 'יציאת החג') === '18:42');
  check('erev: NO הבדלה line', !erev.timed.some((t) => t.label === 'הבדלה'));

  // ── Chag run ENDING on Shabbat (RH 5784): d1 Friday 15 Sep 2023, d2
  //    SHABBAT 16 Sep. Erev was Thursday (chol); ON the Friday the in-period
  //    pair must show SUNDAY'S chag exit (19:17), not Saturday havdalah —
  //    the overlap case the gabbai asked about, verified both ways.
  const d1 = computeEventLines(loc, at(2023, 9, 15, 10, 0));
  console.log('    RH d1 on Friday (15 Sep 2023) →', lines(d1));
  check('RH d1 Fri: pair shows יציאת החג 19:17 (Sun d2, chag exit)',
    time(d1, 'כניסת החג') === '18:30' && time(d1, 'יציאת החג') === '19:17');

  // ── Erev YK 5787 (chol Sunday): exit = YK's own havdalah labeled
  //    יציאת החג (YK is a chag).
  const ykErev = computeEventLines(loc, at(2026, 9, 20, 10, 0));
  check('erev YK: exit יציאת החג 19:11 = YK havdalah',
    time(ykErev, 'יציאת החג') === '19:11');

  // ── No candles → no exit line either (Shabbat 9 Av 5789: fast block owns
  //    the day, no chag entry line).
  const tbShabbat = computeEventLines(loc, at(2029, 7, 21, 13, 0));
  check('Shabbat 9 Av: no entry line, fast block owns the day',
    !tbShabbat.timed.some((t) => t.label === 'כניסת החג'));
}

console.log('\n══════════════════════════════════════');
console.log(`${checks} checks, ${failures} failures`);
process.exit(failures > 0 ? 1 : 0);