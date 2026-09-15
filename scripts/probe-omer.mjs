process.env.TZ = 'Asia/Jerusalem';
// Probe Sefirat Haomer 5787 behavior: dates, panel lines, Omer emission.
import { Location, HDate, HebrewCalendar, Zmanim } from '@hebcal/core';
import { computeEventLines } from '../src/lib/events.js';

const loc = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);
const midday = (hd) => { const g = hd.greg(); return new Date(g.getFullYear(), g.getMonth(), g.getDate(), 12, 0, 0); };

// Sefirah stretch: 16 Nisan (day 1, night of 2nd Pesach) … 5 Sivan (day 49).
// Show a plain chol stretch AFTER Pesach CHM: pick 24..29 Nisan.
console.log('── Omer emission check (default options, 26 Nisan 5787):');
{
  const hd = new HDate(26, 1, 5787);
  const cal = [...HebrewCalendar.calendar({ start: hd, end: hd, il: true, location: loc })];
  console.log('   events:', cal.map((e) => `${e.render('he-x-NoNikud')} [${(e.getCategories?.() ?? []).join(',')}]`).join(' | ') || '(none)');
}
console.log('── Omer with omer:true:');
{
  const hd = new HDate(26, 1, 5787);
  const cal = [...HebrewCalendar.calendar({ start: hd, end: hd, il: true, location: loc, omer: true })];
  const omer = cal.filter((e) => /OmerEvent|לעומר/.test(String(e.render?.('en') ?? '')));
  console.log('   omer events:', cal.filter((e) => e.constructor?.name === 'OmerEvent').map((e) => e.render('en') + ' / ' + e.render('he-x-NoNikud')));
}

// Panel at plain chol days + Shabbat during Sefirah
const probes = [
  ['Wed 26 Nisan (chol, omer day 11)', new HDate(26, 1, 5787), 13],
  ['Fri 30 Nisan (erev Shabbat)', new HDate(30, 1, 5787), 13],
];
// Find a mid-Sefirah Shabbat away from special days: scan 21..28 Iyar for dow 6
for (let d = 21; d <= 28; d++) {
  const hd = new HDate(d, 2, 5787);
  if (midday(hd).getDay() === 6) { probes.push([`Shabbat ${d} Iyar (mid-Sefirah)`, hd, 13]); break; }
}

for (const [label, hd, hour] of probes) {
  const g = midday(hd);
  const now = new Date(g.getFullYear(), g.getMonth(), g.getDate(), hour, 0, 0);
  const r = computeEventLines(loc, now);
  const out = [...r.banners.map((b) => `[${b}]`), ...r.timed.map((t) => `${t.label} ${t.time}`)].join(' | ');
  console.log(`\n${label}:`, out || '(empty)');
  if (/Shabbat/.test(label)) {
    const z = new Zmanim(loc, midday(hd));
    const sk = z.shkiah();
    const h = new Date(sk.getTime() + 32 * 60000);
    const tz = z.tzeit();
    const f = (d) => d.toTimeString().slice(0, 5);
    console.log(`   shkiah ${f(sk)} | havdalah ${f(h)} | tzais(flip) ${f(tz)} | linger-end ${f(new Date(h.getTime() + 3600000))}`);
    console.log(`   greg: ${midday(hd).toDateString()}`);
    // after-tzais moments
    for (const [lbl2, hh] of [['after tzais, in linger window', 20], ['after linger expiry', 22]]) {
      const now2 = new Date(g.getFullYear(), g.getMonth(), g.getDate(), hh, 30, 0);
      const r2 = computeEventLines(loc, now2);
      const out2 = [...r2.banners.map((b) => `[${b}]`), ...r2.timed.map((t) => `${t.label} ${t.time}`)].join(' | ');
      console.log(`   ${hh}:30 ${lbl2}:`, out2 || '(empty)');
    }
  }
}

// Rosh Chodesh Iyar + Lag BaOmer during Sefirah
for (const [label, hd] of [['2 Iyar (Rosh Chodesh, omer day 17)', new HDate(2, 2, 5787)], ['18 Iyar (Lag BaOmer, omer day 33)', new HDate(18, 2, 5787)]]) {
  const g = midday(hd);
  const now = new Date(g.getFullYear(), g.getMonth(), g.getDate(), 13, 0, 0);
  const r = computeEventLines(loc, now);
  const out = [...r.banners.map((b) => `[${b}]`), ...r.timed.map((t) => `${t.label} ${t.time}`)].join(' | ');
  console.log(`\n${label}:`, out || '(empty)', `| greg ${g.toDateString()}`);
}