// Probe TB 5787 (9 Av = Wed Aug 11 2027) with explicit UTC instants.
import { Location, HDate } from '@hebcal/core';
import { computeEventLines } from '../src/lib/events.js';

const loc = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);
// IDT = UTC+3
const idt = (y, mo, d, h, mi = 0) => new Date(Date.UTC(y, mo - 1, d, h - 3, mi));

const cases = [
  ['Erev TB daytime (Tue Aug 10 10:00)', idt(2027, 8, 10, 10)],
  ['TB night after tzais (Tue Aug 10 22:00)', idt(2027, 8, 10, 22)],
  ['TB day (Wed Aug 11 10:00)', idt(2027, 8, 11, 10)],
  ['After fast end, linger window (Wed 21:00)', idt(2027, 8, 11, 21)],
  ['Day after TB (Thu Aug 12 10:00)', idt(2027, 8, 12, 10)],
  // YK-adjacency year check: find a year where YK follows Shabbat
];

for (const [label, now] of cases) {
  const r = computeEventLines(loc, now);
  const day = new HDate(now).toString();
  const out = [...r.banners.map((b) => `[${b}]`), ...r.timed.map((t) => `${t.label} ${t.time}`)].join(' | ');
  console.log((label + ' ').padEnd(42), `(${day})`, '→', out || '(nothing)');
}