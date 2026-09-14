// Probe @hebcal/leyning getLeyningOnDate for holiday-Shabbat anchors.
import { HDate } from '@hebcal/hdate';
import { getLeyningOnDate } from '@hebcal/leyning';

const cases = [
  ['RH d1 on Shabbat', '2026-09-12'],
  ['RH d2 (weekday)', '2026-09-13'],
  ['Shabbat Shuva', '2026-09-19'],
  ['Yom Kippur (weekday)', '2026-09-21'],
  ['Sukkot d1 on Shabbat', '2026-09-26'],
  ['Shmini Atzeret on Shabbat', '2026-10-03'],
  ['Regular Shabbat (Haazinu week)', '2026-09-12'],  // sanity dup
  ['Chanukah weekday', '2026-12-10'],
  ['Rosh Chodesh weekday', '2026-10-11'],
];

for (const [label, iso] of cases) {
  const [y, m, d] = iso.split('-').map(Number);
  const hd = new HDate(new Date(y, m - 1, d));
  const reading = getLeyningOnDate(hd, true, false, 'he');
  console.log(`── ${label} (${iso})`);
  if (!reading) { console.log('    null'); continue; }
  console.log('    name.he:', reading.name?.he ?? reading.name ?? '(none)');
  console.log('    summary:', reading.summary ?? '(none)');
  console.log('    source:', reading.sourceKey ?? reading.source ?? '(none)');
}