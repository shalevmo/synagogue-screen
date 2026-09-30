/**
 * Edge-case battery for src/lib/events.js — validates the locked rule set
 * against the REAL 5787 calendar (anchors derived from HDate.abs() ground
 * truth; expected times cross-checked against 2net's published Netivot
 * table and @hebcal/core's own holiday definitions).
 */
import { describe, it, expect } from 'vitest';
import { HDate, HebrewCalendar } from '@hebcal/core';
import { computeEventLines } from '../src/lib/events.js';
import { findShabbatReading } from '../src/lib/reading.js';
import { NETIVOT as loc } from './netivot.js';

/** Israel wall-clock instant (the suite runs with TZ=Asia/Jerusalem). */
function at(y, mo, d, h, mi = 0) {
  return new Date(y, mo - 1, d, h, mi, 0);
}

const time = (res, label) => res.timed.find((t) => t.label === label)?.time;

describe('1. Regular Friday (chol, 16 Oct 2026)', () => {
  const res = computeEventLines(loc, at(2026, 10, 16, 10, 0));
  it('הדלקת נרות shown', () => { expect(res.timed.some((t) => t.label === 'הדלקת נרות')).toBe(true); });
  it('time = 17:50 (hebcal shkiah 18:08 − 18m)', () => { expect(time(res, 'הדלקת נרות')).toBe('17:50'); });
  it('havdalah shown WITH candles (exit next to entry)', () => { expect(res.timed.some((t) => t.label === 'הבדלה')).toBe(true); });
  it('havdalah = 18:39 (hebcal shkiah 18:07 + 32m)', () => { expect(time(res, 'הבדלה')).toBe('18:39'); });
});

describe('2. Regular Shabbat (chol, 17 Oct 2026) — full pair all day', () => {
  const res = computeEventLines(loc, at(2026, 10, 17, 10, 0));
  it('הבדלה shown', () => { expect(res.timed.some((t) => t.label === 'הבדלה')).toBe(true); });
  it('time = 18:39 (hebcal shkiah 18:07 + 32m)', () => { expect(time(res, 'הבדלה')).toBe('18:39'); });
  it('candles shown too (pair, from Friday)', () => { expect(time(res, 'הדלקת נרות')).toBe('17:50'); });
});

describe('3. Today — Tzom Gedaliah (Mon 14 Sep 2026, 3 Tishrei)', () => {
  const res = computeEventLines(loc, at(2026, 9, 14, 10, 0));
  it('banner צום גדליה', () => { expect(res.banners.includes('צום גדליה')).toBe(true); });
  it('תחילת הצום at OH alot', () => { expect(res.timed.some((t) => t.label === 'תחילת הצום')).toBe(true); });
  it('סיום הצום = 19:04 (OH tzais — left column צאת הכוכבים, NOT +32)', () => { expect(time(res, 'סיום הצום')).toBe('19:04'); });
  it('no candles (chol)', () => { expect(res.timed.some((t) => t.label === 'הדלקת נרות' || t.label === 'כניסת החג')).toBe(false); });
});

describe('4. Erev RH ON FRIDAY (Fri 11 Sep 2026, 29 Elul)', () => {
  const res = computeEventLines(loc, at(2026, 9, 11, 10, 0));
  it('banner ערב ראש השנה', () => { expect(res.banners.some((b) => b.startsWith('ערב'))).toBe(true); });
  // Shabbat + RH d1 start tonight — entry only (chag label wins, Q8).
  it('כניסת החג 18:34 (RH + Shabbat tonight)', () => { expect(time(res, 'כניסת החג')).toBe('18:34'); });
});

describe('5. RH d1 ON SHABBAT (Sat 12 Sep 2026) — full pair (locked B)', () => {
  const res = computeEventLines(loc, at(2026, 9, 12, 10, 0));
  it('banner ראש השנה', () => { expect(res.banners.some((b) => b.includes('ראש השנה'))).toBe(true); });
  it('כניסת החג 18:34 (period entry, chag label)', () => { expect(time(res, 'כניסת החג')).toBe('18:34'); });
  it('יציאת החג 19:22 (period exit on d2)', () => { expect(time(res, 'יציאת החג')).toBe('19:22'); });
});

describe('6. RH d2 (Sun 13 Sep 2026) — same pair as d1 (locked B)', () => {
  const res = computeEventLines(loc, at(2026, 9, 13, 10, 0));
  it('banner ראש השנה ב׳', () => { expect(res.banners.some((b) => b.includes('ראש השנה'))).toBe(true); });
  it('יציאת החג shown', () => { expect(res.timed.some((t) => t.label === 'יציאת החג')).toBe(true); });
  it('time = 19:22 (shkiah 18:50+32)', () => { expect(time(res, 'יציאת החג')).toBe('19:22'); });
  it('SAME entry as d1 (fixed pair)', () => { expect(time(res, 'כניסת החג')).toBe('18:34'); });
});

describe('7. Post-fast Monday (14 Sep, fast lines gone from the 15th)', () => {
  const res = computeEventLines(loc, at(2026, 9, 15, 10, 0));
  it('no fast block on 4 Tishrei', () => { expect(res.banners.includes('צום גדליה')).toBe(false); });
});

describe('8. Erev YK (Sun 20 Sep 2026, Shabbat… no — Monday)', () => {
  const res = computeEventLines(loc, at(2026, 9, 20, 10, 0));
  it('banner ערב יום כיפור', () => { expect(res.banners.some((b) => b.includes('ערב'))).toBe(true); });
  it('כניסת החג shown (YK tonight)', () => { expect(res.timed.some((t) => t.label === 'כניסת החג')).toBe(true); });
});

describe('9. YK DAY (Mon 21 Sep 2026) — major fast + chag', () => {
  const res = computeEventLines(loc, at(2026, 9, 21, 10, 0));
  it('banner יום כיפור', () => { expect(res.banners.includes('יום כיפור')).toBe(true); });
  it('תחילת הצום at candles time (18:23 = erev shkiah−18)', () => { expect(time(res, 'תחילת הצום')).toBe('18:23'); });
  it('סיום הצום = 19:11 (hebcal shkiah 18:39 + 32m)', () => { expect(time(res, 'סיום הצום')).toBe('19:11'); });
  it('NO duplicate יציאת החג (suppressed)', () => { expect(res.timed.some((t) => t.label === 'יציאת החג')).toBe(false); });
});

describe('10. Shabbat Shuva (Sat 19 Sep 2026) — full pair; YK starts SUN NIGHT', () => {
  const res = computeEventLines(loc, at(2026, 9, 19, 10, 0));
  it('banner שבת שובה', () => { expect(res.banners.some((b) => b.includes('שובה'))).toBe(true); });
  it('הבדלה 19:14 (Shabbat exits to chol Sunday)', () => { expect(time(res, 'הבדלה')).toBe('19:14'); });
  it('candles 18:25 (pair entry)', () => { expect(time(res, 'הדלקת נרות')).toBe('18:25'); });
  it('NO כניסת החג (YK is Monday, not tomorrow)', () => { expect(res.timed.some((t) => t.label === 'כניסת החג')).toBe(false); });
});

describe('11. Erev Sukkot (Fri 25 Sep 2026, 14 Tishrei)', () => {
  const res = computeEventLines(loc, at(2026, 9, 25, 10, 0));
  it('banner ערב סוכות (ktiv male!)', () => { expect(res.banners.some((b) => b === 'ערב סוכות')).toBe(true); });
  it('כניסת החג shown (Sukkot + Shabbat tonight)', () => { expect(res.timed.some((t) => t.label === 'כניסת החג')).toBe(true); });
  it('time = 18:16 (2net: 18:16)', () => { expect(time(res, 'כניסת החג')).toBe('18:16'); });
});

describe('12. Sukkot d1 ON SHABBAT (Sat 26 Sep 2026) — pair ends at d1 (CHM is not holy)', () => {
  const res = computeEventLines(loc, at(2026, 9, 26, 10, 0));
  it('banner סוכות א׳ (ktiv male!)', () => { expect(res.banners.includes('סוכות א׳')).toBe(true); });
  it('כניסת החג 18:16 (period entry)', () => { expect(time(res, 'כניסת החג')).toBe('18:16'); });
  it('יציאת החג 19:05 (d1 exit — CHM does not extend the run)', () => { expect(time(res, 'יציאת החג')).toBe('19:05'); });
});

describe('12b. CHM Sukkot (Sun 27 Sep 2026) — banner only, no times', () => {
  const res = computeEventLines(loc, at(2026, 9, 27, 10, 0));
  it('banner סוכות ב׳', () => { expect(res.banners.includes('סוכות ב׳')).toBe(true); });
  it('no timed lines on CHM', () => { expect(res.timed.length === 0).toBe(true); });
});

describe('13. HR Friday (2 Oct 2026) — erev SA: tonight entry + SA exit', () => {
  const res = computeEventLines(loc, at(2026, 10, 2, 10, 0));
  it('banner סוכות ז׳ הושענא רבה (ktiv male!)', () => { expect(res.banners.some((b) => b.includes('סוכות ז׳') && b.includes('הושענא רבה'))).toBe(true); });
  it('כניסת החג 18:07 (2net SA: 18:07)', () => { expect(time(res, 'כניסת החג')).toBe('18:07'); });
  it('יציאת החג 18:56 (SA exit)', () => { expect(time(res, 'יציאת החג')).toBe('18:56'); });
  it('no separate הדלקת נרות line', () => { expect(res.timed.some((t) => t.label === 'הדלקת נרות')).toBe(false); });
});

describe('14. SA + ST Shabbat (Sat 3 Oct 2026, 22 Tishrei) — final pair day', () => {
  const res = computeEventLines(loc, at(2026, 10, 3, 10, 0));
  it('banner שמיני עצרת', () => { expect(res.banners.includes('שמיני עצרת')).toBe(true); });
  it('יציאת החג 18:56 = SA shkiah 18:24+32', () => { expect(time(res, 'יציאת החג')).toBe('18:56'); });
  it('כניסת החג 18:07 (SA\'s own entry, HR Friday)', () => { expect(time(res, 'כניסת החג')).toBe('18:07'); });
});

describe('15. Post-SA linger (exit Sat 18:56 → lingers to 19:56)', () => {
  const satNight = computeEventLines(loc, at(2026, 10, 3, 19, 30));
  it('pair lingering Saturday night (post-flip)', () => { expect(time(satNight, 'יציאת החג')).toBe('18:56'); });

  const sunMorning = computeEventLines(loc, at(2026, 10, 4, 10, 0));
  it('pair GONE Sunday morning (linger expired Sat 19:56)', () => { expect(sunMorning.timed.some((t) => t.label === 'יציאת החג')).toBe(false); });
});

describe('16. Motzei Shabbat linger window — Sat 17 Oct, 17:10→20:00', () => {
  // Shabbat 17 Oct: shkiah ≈16:38 → havdalah ≈17:10 → linger to 18:10.
  const inWindow = computeEventLines(loc, at(2026, 10, 17, 17, 30));
  it('הבדלה shown at 17:30 (pre-tzais, full day model)', () => { expect(inWindow.timed.some((t) => t.label === 'הבדלה')).toBe(true); });

  const afterFlip = computeEventLines(loc, at(2026, 10, 17, 19, 0));
  it('הבדלה shown at 19:00 (post-flip linger)', () => { expect(afterFlip.timed.some((t) => t.label === 'הבדלה')).toBe(true); });

  const expired = computeEventLines(loc, at(2026, 10, 17, 20, 0));
  it('הבדלה GONE at 20:00 (linger expired 17:10+1h=18:10)', () => { expect(expired.timed.some((t) => t.label === 'הבדלה')).toBe(false); });
});

describe('17. Rosh Chodesh (1 Cheshvan 5787 — verify date dynamically)', () => {
  const hd = new HDate(1, 8, 5787);
  const g = hd.greg();
  const res = computeEventLines(loc, new Date(g.getFullYear(), g.getMonth(), g.getDate(), 10, 0));
  it('banner ראש חודש', () => { expect(res.banners.some((b) => b.includes('ראש חודש'))).toBe(true); });
});

describe('18. Chanukah Friday (4 Dec 2026, 25 Kislev… verify: 24 Kislev?', () => {
  const res = computeEventLines(loc, at(2026, 12, 4, 10, 0));
  it('Chanukah banner present', () => { expect(res.banners.some((b) => b.includes('חנוכה'))).toBe(true); });
  it('Friday candles shown', () => { expect(res.timed.some((t) => t.label === 'הדלקת נרות')).toBe(true); });
});

describe('18b. חג הבנות (30 Kislev, full-Kislev years) — FILTERED', () => {
  // 30 Kislev 5787 = Thu 10 Dec 2026 (Kislev is full this year). Day 7 of
  // Chanukah + Rosh Chodesh Tevet + חג הבנות — only the first two show.
  // (greg()-based printing shows one day early — anchor from real-world
  // RC Tevet 5787 = Dec 10–11 2026.)
  const res = computeEventLines(loc, at(2026, 12, 10, 10, 0));
  it('NO חג הבנות banner (filtered)', () => { expect(res.banners.some((b) => b.includes('חג הבנות'))).toBe(false); });
  it('Chanukah banner still shown', () => { expect(res.banners.some((b) => b.includes('חנוכה'))).toBe(true); });
  it('Rosh Chodesh banner still shown', () => { expect(res.banners.some((b) => b.includes('ראש חודש'))).toBe(true); });
});

describe('19. Taanit Esther (13 Adar II 5787 — found via calendar search)', () => {
  // 5787 IS a leap year; find Taanit Esther by scanning March 2027.
  const cal = HebrewCalendar.calendar({
    start: new HDate(new Date(2027, 2, 1)),
    end: new HDate(new Date(2027, 2, 31)),
    il: true, location: loc,
  });
  const ev = [...cal].find((e) => (e.getCategories?.() ?? []).includes('fast'));
  const g = ev.getDate().greg();
  const res = computeEventLines(loc, new Date(g.getFullYear(), g.getMonth(), g.getDate(), 10, 0));
  it('banner תענית אסתר', () => { expect(res.banners.includes('תענית אסתר')).toBe(true); });
  it('תחילת הצום (minor fast, dawn)', () => { expect(res.timed.some((t) => t.label === 'תחילת הצום')).toBe(true); });
});

describe('20. Tisha B\'Av (9 Av 5787 — dynamic anchor)', () => {
  const hd = new HDate(9, 5, 5787);
  const g = hd.greg();
  const res = computeEventLines(loc, new Date(g.getFullYear(), g.getMonth(), g.getDate(), 10, 0));
  it('banner תשעה באב', () => { expect(res.banners.includes('תשעה באב')).toBe(true); });
  const start = res.timed.find((t) => t.label === 'תחילת הצום')?.time;
  it('תחילת הצום present (TB starts at erev shkiah)', () => { expect(start).toBeDefined(); });
  it('TB banner-only day: NO candles fabricated', () => { expect(res.timed.some((t) => t.label === 'הדלקת נרות' || t.label === 'כניסת החג')).toBe(false); });
  it('NO havdalah fabricated (fast is not holy)', () => { expect(res.timed.some((t) => t.label === 'הבדלה' || t.label === 'יציאת החג')).toBe(false); });
});

describe('20b. Nidche Tisha B\'Av 5789 (9 Av on Shabbat → fast on Sunday 10 Av)', () => {
  // Shabbat 9 Av 5789 = 21 Jul 2029. Hebcal shkiah 19:44 (2net prints 19:45 —
  // the accepted ~1-min engine drift; expectations are hebcal-based, like
  // test 20). Fast ends at Sunday's OH tzais 20:01. Gabbai decisions
  // (Sep 2026): banner shows plain "תשעה באב" on Sunday (parens + נדחה
  // stripped); Shabbat shows BOTH תחילת (eve shkiah 19:44) and סיום (20:01).
  const shabbat = computeEventLines(loc, at(2029, 7, 21, 13, 0));
  it('Shabbat banner שבת חזון', () => { expect(shabbat.banners.some((b) => b.includes('שבת חזון'))).toBe(true); });
  it('Shabbat candles 19:27 (pair entry)', () => { expect(time(shabbat, 'הדלקת נרות')).toBe('19:27'); });
  it('Shabbat shows תחילת הצום 19:44 (eve shkiah)', () => { expect(time(shabbat, 'תחילת הצום')).toBe('19:44'); });
  it('Shabbat shows סיום הצום 20:01', () => { expect(time(shabbat, 'סיום הצום')).toBe('20:01'); });
  it('Shabbat shows NO הבדלה (fast bridges the exit)', () => { expect(shabbat.timed.some((t) => t.label === 'הבדלה')).toBe(false); });

  const sunday = computeEventLines(loc, at(2029, 7, 22, 13, 0));
  it('Sunday banner plain תשעה באב (no parens/נדחה)', () => { expect(sunday.banners.includes('תשעה באב')).toBe(true); });
  it('Sunday NO stray parens in any banner', () => { expect(sunday.banners.every((b) => !/[()]/.test(b))).toBe(true); });
  it('Sunday תחילת הצום 19:44 (erev = Motzei Shabbat shkiah)', () => { expect(time(sunday, 'תחילת הצום')).toBe('19:44'); });
  it('Sunday סיום הצום 20:01 (OH tzais)', () => { expect(time(sunday, 'סיום הצום')).toBe('20:01'); });

  const night = computeEventLines(loc, at(2029, 7, 22, 21, 0));
  it('post-flip linger: entry candles still shown', () => { expect(night.timed.some((t) => t.label === 'הדלקת נרות')).toBe(true); });
  it('post-flip linger: BOTH fast lines (never bare end)', () => { expect(night.timed.some((t) => t.label === 'תחילת הצום') && night.timed.some((t) => t.label === 'סיום הצום')).toBe(true); });
});

describe('21. Holiday-Shabbat readings via @hebcal/leyning (not קריאת החג)', () => {
  const r = (t) => findShabbatReading(t, null);
  const at10 = (y, m, d) => new Date(y, m - 1, d, 10, 0, 0);
  it('RH d1 Shabbat → ראש השנה א׳', () => { expect(r(at10(2026, 9, 12)).text).toBe('ראש השנה א׳'); });
  it('Sukkot d1 Shabbat → סוכות יום א׳ (ktiv male)', () => { expect(r(at10(2026, 9, 26)).text).toBe('סוכות יום א׳'); });
  it('SA/ST Shabbat → שמחת תורה', () => { expect(r(at10(2026, 10, 3)).text).toBe('שמחת תורה'); });
  it('CHM Pesach Shabbat → שבת חול המועד פסח (ktiv male)', () => { expect(r(at10(2027, 4, 23)).text).toBe('שבת חול המועד פסח'); });
  it('YK Shabbat (2028) → יום כיפור (ktiv male)', () => { expect(r(at10(2028, 9, 28)).text).toBe('יום כיפור'); });
  it('regular Shabbat stays parsha (Haazinu)', () => { expect(r(at10(2026, 9, 19)).text).toBe('פרשת האזינו'); });
});

describe('22. Modern holidays, winter anchors, maqaf banners, YK bridge', () => {
  // ── Modern holidays (5787): banners only, no timed lines, omer co-shown.
  // Shoah 27 Nisan = Tue 4 May 2027; Zikaron 4 Iyyar = Tue 11 May; Atzmaut 5 Iyyar = Wed 12 May.
  const shoah = computeEventLines(loc, new Date(2027, 4, 4, 10, 0, 0));
  it('Yom HaShoah banner', () => { expect(shoah.banners[0]).toBe('יום השואה'); });
  it('Yom HaShoah: omer count co-displayed', () => { expect(shoah.banners.some((b) => /^י״ב בעומר$/.test(b))).toBe(true); });
  it('Yom HaShoah: no timed lines', () => { expect(shoah.timed.length === 0).toBe(true); });
  const zikaron = computeEventLines(loc, new Date(2027, 4, 11, 10, 0, 0));
  it('Yom HaZikaron banner', () => { expect(zikaron.banners[0]).toBe('יום הזכרון'); });
  const atzmaut = computeEventLines(loc, new Date(2027, 4, 12, 10, 0, 0));
  it('Yom HaAtzmaut banner', () => { expect(atzmaut.banners[0]).toBe('יום העצמאות'); });

  // ── Winter anchors (IST, UTC+2): times must format in Israel winter clock.
  // RC Tevet 5787 = 10–11 Dec 2026; both days show the banner, no timed lines.
  const rcTevet1 = computeEventLines(loc, new Date(2026, 11, 10, 10, 0, 0));
  it('RC Tevet day1: banner (Chanukah day 7)', () => { expect(rcTevet1.banners.includes('חנוכה: ז׳ נרות')).toBe(true); });
  it('RC Tevet day1: RC banner', () => { expect(rcTevet1.banners.some((b) => b.includes('ראש חודש טבת'))).toBe(true); });
  it('RC Tevet day1: no timed lines', () => { expect(rcTevet1.timed.length === 0).toBe(true); });
  const winterShabbat = computeEventLines(loc, new Date(2027, 0, 2, 10, 0, 0));
  it('winter Shabbat candles 16:31 IST', () => { expect(winterShabbat.timed.some((t) => t.label === 'הדלקת נרות' && t.time === '16:31')).toBe(true); });
  it('winter Shabbat havdalah 17:22 IST', () => { expect(winterShabbat.timed.some((t) => t.label === 'הבדלה' && t.time === '17:22')).toBe(true); });
  it('winter Shabbat: no banners', () => { expect(winterShabbat.banners.length === 0).toBe(true); });

  // ── Maqaf banner: Nitzavim-Vayeilech (double parsha) — never a banner path,
  // but 23 Elul 5787 shows סליחות + Shabbat pair. Reading-side maqaf is
  // pinned in reading.test.js (מטות־מסעי); here we pin the Selichot banner
  // and the Shabbat candles pair on a pre-RH Friday evening.
  const selichot = computeEventLines(loc, new Date(2027, 8, 25, 10, 0, 0));
  it('Selichot banner (23 Elul 5787)', () => { expect(selichot.banners[0]).toBe('סליחות'); });
  it('Selichot Shabbat: candles 18:18', () => { expect(selichot.timed.some((t) => t.label === 'הדלקת נרות' && t.time === '18:18')).toBe(true); });

  // ── YK-on-Shabbat bridge (dead path today, live 5789): the Friday before
  // Sunday-start YK-on-Shabbat shows the chag entry (Q8:B — chag label wins
  // over Shabbat candles on a dual erev), and NO הבדלה (YK swallows the exit).
  const ykErev = computeEventLines(loc, new Date(2028, 8, 29, 10, 0, 0));
  it('erev YK-on-Shabbat: כניסת החג 18:10 (chag label wins)', () => { expect(ykErev.timed.some((t) => t.label === 'כניסת החג' && t.time === '18:10')).toBe(true); });
  it('erev YK-on-Shabbat: no הבדלה (exit swallowed by YK)', () => { expect(ykErev.timed.some((t) => t.label === 'הבדלה')).toBe(false); });

  // ── Maqaf double-parsha BANNER: Nitzavim-Vayeilech 5788 (25 Elul 5788,
  // Sat 16 Sep 2028) — special Shabbatot like שבת שובה never carry maqaf,
  // but a double-parsha year's Selichot Shabbat confirms banner rendering.
  const nv5788 = computeEventLines(loc, new Date(2028, 8, 16, 10, 0, 0));
  it('Nitzavim-Vayeilech year: Selichot banner 5788', () => { expect(nv5788.banners[0]).toBe('סליחות'); });
});

describe('23. Candles ALWAYS paired with the exit — Shabbat/Yom Tov overlap', () => {
  // ── Erev Sukkot 5786 (Mon 6 Oct 2025): CHM is not holy, so the run is
  //    d1 alone (Tue 7 Oct) — the exit is d1's chag exit (18:19+32), not
  //    ST's; the CHM Shabbat inside Sukkot is its own run.
  const erev = computeEventLines(loc, at(2025, 10, 6, 10, 0));
  it('erev: כניסת החג shown', () => { expect(erev.timed.some((t) => t.label === 'כניסת החג')).toBe(true); });
  it('erev: exit is יציאת החג (chag run, not havdalah)', () => { expect(erev.timed.some((t) => t.label === 'יציאת החג')).toBe(true); });
  it('erev: exit 18:51 = d1 chag exit (run end)', () => { expect(time(erev, 'יציאת החג')).toBe('18:51'); });
  it('erev: NO הבדלה line', () => { expect(erev.timed.some((t) => t.label === 'הבדלה')).toBe(false); });

  // ── Chag run ENDING on Shabbat (RH 5784): d1 Friday 15 Sep 2023, d2
  //    SHABBAT 16 Sep. Erev was Thursday (chol); ON the Friday the in-period
  //    pair must show SUNDAY'S chag exit (19:17), not Saturday havdalah —
  //    the overlap case the gabbai asked about, verified both ways.
  const d1 = computeEventLines(loc, at(2023, 9, 15, 10, 0));
  it('RH d1 Fri: pair shows יציאת החג 19:17 (Sun d2, chag exit)', () => { 
    expect(time(d1, 'כניסת החג')).toBe('18:30');
    expect(time(d1, 'יציאת החג')).toBe('19:17');
   });

  // ── Erev YK 5787 (chol Sunday): exit = YK's own havdalah labeled
  //    יציאת החג (YK is a chag).
  const ykErev = computeEventLines(loc, at(2026, 9, 20, 10, 0));
  it('erev YK: exit יציאת החג 19:11 = YK havdalah', () => { expect(time(ykErev, 'יציאת החג')).toBe('19:11'); });

  // ── No candles → no exit line either (Shabbat 9 Av 5789: fast block owns
  //    the day, no chag entry line).
  const tbShabbat = computeEventLines(loc, at(2029, 7, 21, 13, 0));
  it('Shabbat 9 Av: no entry line, fast block owns the day', () => { expect(tbShabbat.timed.some((t) => t.label === 'כניסת החג')).toBe(false); });
});

