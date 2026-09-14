import { HDate, HebrewCalendar } from '@hebcal/core';

for (let abs = new HDate(24, 9, 5787).abs(); abs <= new HDate(4, 10, 5787).abs(); abs++) {
  const hd = new HDate(abs);
  const g = hd.greg();
  const local = new Date(g.getFullYear(), g.getMonth(), g.getDate());
  const evs = [...HebrewCalendar.calendar({ start: hd, end: hd, il: true })];
  console.log(
    hd.toString().padEnd(14),
    local.toISOString().slice(0, 10),
    'dow', local.getDay(),
    '|', evs.map((e) => `flags=${(e.getFlags?.() ?? 0).toString(16)} ${(e.getCategories?.() ?? []).join(',')} ${e.render('he-x-NoNikud')}`).join('  ||  '),
  );
}