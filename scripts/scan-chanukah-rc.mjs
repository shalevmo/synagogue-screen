process.env.TZ = 'Asia/Jerusalem';
// Shabbat Chanukah + Rosh Chodesh Tevet: happens when Shabbat falls on
// 30 Kislev (day 6, 30-day Kislev) or 1 Tevet (day 6 or 7). Scan 5787..5810.
import { HDate, HebrewCalendar } from '@hebcal/core';

for (let y = 5787; y <= 5810; y++) {
  const check = (hd) => {
    const g = hd.greg();
    const local = new Date(g.getFullYear(), g.getMonth(), g.getDate());
    if (local.getDay() !== 6) return null;
    const evs = [...HebrewCalendar.calendar({ start: hd, end: hd, il: true })];
    const names = evs.map((e) => e.render('he-x-NoNikud')).join(' / ');
    if (!names.includes('חנוכה') || !names.includes('ראש חודש')) return null;
    return { local, names };
  };
  // 30 Kislev exists only in 30-day-Kislev years — invalid date rolls over,
  // so verify via month before trusting it.
  const k30 = new HDate(30, 9, y);
  const k30ok = k30.getMonth() === 9;
  for (const [hd, tag] of [[k30ok ? k30 : null, '30 Kislev'], [new HDate(1, 10, y), '1 Tevet']]) {
    if (!hd) continue;
    const hit = check(hd);
    if (hit) console.log(y, tag, '→', hit.local.toISOString().slice(0, 10), '|', hit.names);
  }
}