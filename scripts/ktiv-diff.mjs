// Enumerate Shabbat-holiday readings across years: stripped-leyning name vs
// core event name (he-x-NoNikud, ktiv male). Find every ktiv divergence.
import { HDate, HebrewCalendar } from '@hebcal/core';
import { getLeyningOnDate } from '@hebcal/leyning';

const stripN = (t) => t.replace(/[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C7]/g, '');

for (let y = 5787; y <= 5800; y++) {
  // scan Tishrei..Elul via abs range of the whole year
  let hd = new HDate(1, 1, y);
  const end = new HDate(1, 1, y + 1).abs() - 1;
  for (let abs = hd.abs(); abs <= end; abs++) {
    const d = new HDate(abs);
    const g = d.greg();
    const local = new Date(g.getFullYear(), g.getMonth(), g.getDate());
    if (local.getDay() !== 6) continue;
    const cal = [...HebrewCalendar.calendar({ start: d, end: d, il: true, sedrot: true })];
    const hasParsha = cal.some((ev) => /^פרש/.test(stripN(ev.render('he') || '')));
    if (hasParsha) continue;
    const holiday = cal.find((ev) => (ev.getCategories?.() ?? []).includes('holiday'));
    if (!holiday) continue;
    const core = stripN(holiday.render('he-x-NoNikud') || '');
    const r = getLeyningOnDate(d, true, false, 'he');
    const ley = r?.name?.he ? stripN(r.name.he).replace(/\s*\(.*?\)\s*/g, ' ').trim() : '(none)';
    const mark = core === ley ? '   ' : ' ≠ ';
    if (mark !== '   ') console.log(y, local.toISOString().slice(0,10), mark, '| core:', core, '| leyning:', ley);
  }
}
console.log('scan done');