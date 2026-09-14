process.env.TZ = 'Asia/Jerusalem';
import { strict as assert } from 'node:assert';
import { HDate, HebrewCalendar, Locale } from '@hebcal/core';
import { getLeyningOnDate } from '@hebcal/leyning';
import { findShabbatReading, stripNikkud } from '../src/lib/reading.js';

/**
 * The reading.js pipeline: leyning's en key re-looked up in the shared
 * he-x-NoNikud registry (leyning registers it on import), paren-suffix
 * strip, whitespace normalize. Registry is the source of truth — not the
 * hand-maintained ktiv-male regex list this test used to carry.
 */
function expectedFromLeyning(hd) {
  const raw = getLeyningOnDate(hd, true, false, 'he');
  assert.ok(raw && raw.name && raw.name.en, `leyning empty on ${hd}`);
  let t = Locale.lookupTranslation(raw.name.en, 'he-x-NoNikud');
  if (!t) t = stripNikkud(raw.name.he || '');
  return t
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── 1. RH day 1 on Shabbat, 5787 (Sat 12 Sep 2026) ───
const rh1 = findShabbatReading(new Date('2026-09-12T12:00:00'), null);
console.log('RH d1 Shabbat:', JSON.stringify(rh1));
assert.equal(rh1.isHoliday, true);
assert.equal(rh1.text, 'ראש השנה א׳');

// ─── 2. Sukkot day 1 on Shabbat (Sat 26 Sep 2026) ───
const sukkot1 = findShabbatReading(new Date('2026-09-26T12:00:00'), null);
console.log('Sukkot I Shabbat:', JSON.stringify(sukkot1));
assert.equal(sukkot1.isHoliday, true);
assert.equal(sukkot1.text, 'סוכות יום א׳'); // raw haser סכות → male סוכות

// ─── 3. Shmini Atzeret/Simchat Torah Shabbat (Sat 3 Oct 2026) ───
const st = findShabbatReading(new Date('2026-10-03T12:00:00'), null);
console.log('Simchat Torah Shabbat:', JSON.stringify(st));
assert.equal(st.isHoliday, true);
assert.equal(st.text, 'שמחת תורה');

// ─── 4. YK on Shabbat (Sat 30 Sep 2028, 10 Tishrei 5789) ───
const yk = findShabbatReading(new Date('2028-09-30T12:00:00'), null);
console.log('YK Shabbat:', JSON.stringify(yk));
assert.equal(yk.isHoliday, true);
assert.equal(yk.text, 'יום כיפור'); // raw haser כפור → male כיפור

// ─── 5. CHM Shabbat: the reading matches raw leyning modulo the display pipeline ───
const chm = findShabbatReading(new Date('2027-10-16T12:00:00'), null);
const chmRaw = getLeyningOnDate(new HDate(new Date('2027-10-16T12:00:00')), true, false, 'he');
console.log('CHM Sukkot Shabbat:', JSON.stringify(chm), 'raw:', chmRaw.name.he);
assert.equal(chm.text, 'סוכות יום א׳');

// ─── 6. Regular parsha Shabbat (Sat 31 Oct 2026, after the Tishrei holidays) ───
const regular = findShabbatReading(new Date('2026-10-31T12:00:00'), null);
console.log('regular Shabbat:', JSON.stringify(regular));
assert.equal(regular.isHoliday, false);
assert.equal(regular.text, 'פרשת וירא');

// ─── 7. Forward-looking (Thu → upcoming Shabbat's reading) ───
const fwd = findShabbatReading(new Date('2026-10-29T12:00:00'), null);
console.log('Thursday looks ahead:', JSON.stringify(fwd));
assert.equal(fwd.text, 'פרשת וירא');

// ─── 8. Full sweep 2025–2029: every no-parsha Shabbat matches leyning truth ───
let d = new Date('2025-10-04T12:00:00'); // a Saturday
const end = new Date('2029-10-01T12:00:00');
let noParsha = 0;
while (d <= end) {
  const r = findShabbatReading(d, null);
  if (r.isHoliday) {
    noParsha++;
    assert.equal(
      r.text, expectedFromLeyning(new HDate(d)),
      `display vs leyning on ${d.toISOString()}`,
    );
  } else {
    assert.ok(r.text.startsWith('פרשת'), `no parsha on ${d.toISOString()}`);
  }
  d = new Date(d.getTime() + 7 * 86400 * 1000);
}
console.log(`no-parsha holiday Shabbats 2025–2029: ${noParsha}`);
assert.equal(noParsha, 14);

// ─── 8b. Parsha ktiv-male pins: the haser forms the regex list used to miss ───
// Korach 5787 (Sat 3 Jul 2027, 28 Sivan) — he locale renders קֹרַח,
// stripNikkud alone leaves קרח; NoNikud registry gives קורח.
const korach = findShabbatReading(new Date('2027-07-03T12:00:00'), null);
console.log('Korach 5787:', JSON.stringify(korach));
assert.equal(korach.isHoliday, false);
assert.equal(korach.text, 'פרשת קורח');

// Chukkat 5787 (Sat 10 Jul 2027, 5 Tamuz) — חֻקַּת → NoNikud חוקת.
const chukkat = findShabbatReading(new Date('2027-07-10T12:00:00'), null);
console.log('Chukkat 5787:', JSON.stringify(chukkat));
assert.equal(chukkat.text, 'פרשת חוקת');

// CHM Pesach Shabbat (Sat 24 Apr 2027, 17 Nisan) — the חל→חול fix.
const chmPesach = findShabbatReading(new Date('2027-04-24T12:00:00'), null);
console.log('CHM Pesach Shabbat:', JSON.stringify(chmPesach));
assert.equal(chmPesach.isHoliday, true);
assert.equal(chmPesach.text, 'שבת חול המועד פסח');

// Double parsha keeps the maqaf under NoNikud (Matot-Masei, 26 Tamuz 5787).
const dbl = findShabbatReading(new Date('2027-07-31T12:00:00'), null);
console.log('double parsha:', JSON.stringify(dbl));
assert.equal(dbl.isHoliday, false);
assert.equal(dbl.text, 'פרשת מטות־מסעי');

// ─── 9. stripNikkud keeps maqaf & geresh ───
assert.equal(stripNikkud('נְצָבִים־וָיֵּלֶךְ'), 'נצבים־וילך');
assert.equal(stripNikkud('סֻכּוֹת א׳'), 'סכות א׳');

console.log('\nALL PASS');