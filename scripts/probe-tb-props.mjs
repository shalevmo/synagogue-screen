process.env.TZ = 'Asia/Jerusalem';
// Dump hebcal event properties around TB 5787 to design the erev-fast exclusion.
import { Location, HDate, HebrewCalendar } from '@hebcal/core';

const loc = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);
for (const dd of ['2027-08-10', '2027-08-11', '2027-08-12']) {
  const [y, m, d] = dd.split('-').map(Number);
  // midday local anchor (machine TZ=Asia/Jerusalem via env)
  const hd = new HDate(new Date(y, m - 1, d, 12, 0, 0));
  const evs = [...HebrewCalendar.calendar({ start: hd, end: hd, il: true, location: loc })];
  console.log(`\n${dd} → ${hd.toString()} (abs ${hd.abs()})`);
  for (const ev of evs) {
    console.log('  ', {
      he: ev.render('he-x-NoNikud'),
      flags: ev.getFlags?.().toString(16),
      cats: ev.getCategories?.(),
      basename: ev.basename?.(),
      desc: ev.render('en'),
    });
  }
}