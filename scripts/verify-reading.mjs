process.env.TZ = 'Asia/Jerusalem';
import { strict as assert } from 'node:assert';
import { findShabbatReading, stripNikkud } from '../src/lib/reading.js';

// ─── 1. Holiday Shabbat: RH day 2, 5787 (Sat 12 Sep 2026 — "today") ───
const rh2 = findShabbatReading(new Date('2026-09-10T12:00:00'), null);
console.log('this Shabbat (RH 2):', JSON.stringify(rh2));
assert.equal(rh2.isHoliday, true);
assert.equal(rh2.text, 'קריאת החג');

// ─── 2. Regular Shabbat (Sat 26 Sep 2026 = 15 Tishrei = Sukkot I — holiday!) ───
const sukkot1 = findShabbatReading(new Date('2026-09-24T12:00:00'), null);
console.log('Sukkot I Shabbat:', JSON.stringify(sukkot1));
assert.equal(sukkot1.isHoliday, true);
assert.equal(sukkot1.text, 'קריאת החג');

// ─── 3. Yom Kippur on Shabbat 5787 (2 Oct 2026) ───
const yk = findShabbatReading(new Date('2026-10-01T12:00:00'), null);
console.log('YK Shabbat:', JSON.stringify(yk));
assert.equal(yk.isHoliday, true);
assert.equal(yk.text, 'קריאת החג');

// ─── 4. Regular parsha Shabbat (Sat 31 Oct 2026, after the Tishrei holidays) ───
const regular = findShabbatReading(new Date('2026-10-29T12:00:00'), null);
console.log('regular Shabbat:', JSON.stringify(regular));
assert.equal(regular.isHoliday, false);
assert.ok(regular.text.startsWith('פרשת'), `expected parsha, got ${regular.text}`);

// ─── 5. Full sweep: every no-parsha Shabbat 2025–2029 ───
let d = new Date('2025-10-04T12:00:00'); // a Saturday
const end = new Date('2029-10-01T12:00:00');
let noParsha = 0;
while (d <= end) {
  const r = findShabbatReading(d, null);
  if (r.isHoliday) {
    noParsha++;
    assert.equal(r.text, 'קריאת החג', `wrong holiday text on ${d.toISOString()}`);
  } else {
    assert.ok(r.text.startsWith('פרשת'), `no parsha on ${d.toISOString()}`);
  }
  d = new Date(d.getTime() + 7 * 86400 * 1000);
}
console.log(`no-parsha holiday Shabbats 2025–2029: ${noParsha}`);
assert.equal(noParsha, 14);

// ─── 6. stripNikkud keeps maqaf & geresh ───
assert.equal(stripNikkud('נְצָבִים־וָיֵּלֶךְ'), 'נצבים־וילך');
assert.equal(stripNikkud('סֻכּוֹת א׳'), 'סכות א׳');

console.log('\nALL PASS');