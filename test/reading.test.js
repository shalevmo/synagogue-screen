/**
 * The reading.js pipeline: leyning's en key re-looked up in the shared
 * he-x-NoNikud registry (leyning registers it on import), paren-suffix
 * strip, whitespace normalize. Registry is the source of truth — not a
 * hand-maintained ktiv-male regex list.
 */
import { describe, it, expect } from 'vitest';
import { HDate, Locale } from '@hebcal/core';
import { getLeyningOnDate } from '@hebcal/leyning';
import { findShabbatReading, stripNikkud } from '../src/lib/reading.js';

function expectedFromLeyning(hd) {
  const raw = getLeyningOnDate(hd, true, false, 'he');
  expect(raw?.name?.en, `leyning empty on ${hd}`).toBeTruthy();
  let t = Locale.lookupTranslation(raw.name.en, 'he-x-NoNikud');
  if (!t) t = stripNikkud(raw.name.he || '');
  return t
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const reading = (iso) => findShabbatReading(new Date(`${iso}T12:00:00`), null);

describe('holiday Shabbatot', () => {
  it.each([
    ['RH d1 on Shabbat 5787', '2026-09-12', 'ראש השנה א׳'],
    ['Sukkot d1 on Shabbat (raw haser סכות → male סוכות)', '2026-09-26', 'סוכות יום א׳'],
    ['Shmini Atzeret/Simchat Torah Shabbat', '2026-10-03', 'שמחת תורה'],
    ['YK on Shabbat 5789 (raw haser כפור → male כיפור)', '2028-09-30', 'יום כיפור'],
    ['CHM Pesach Shabbat (the חל→חול fix)', '2027-04-24', 'שבת חול המועד פסח'],
  ])('%s', (_label, iso, text) => {
    expect(reading(iso)).toMatchObject({ isHoliday: true, text });
  });

  it('Sukkot I 5788 on Shabbat matches raw leyning modulo the display pipeline', () => {
    expect(reading('2027-10-16').text).toBe('סוכות יום א׳');
  });
});

describe('parsha Shabbatot', () => {
  it.each([
    ['regular Shabbat after the Tishrei holidays', '2026-10-31', 'פרשת וירא'],
    // he locale renders קֹרַח; stripNikkud alone leaves קרח; NoNikud gives קורח
    ['Korach 5787 (ktiv male)', '2027-07-03', 'פרשת קורח'],
    ['double parsha keeps the maqaf (Matot-Masei 5787)', '2027-07-31', 'פרשת מטות־מסעי'],
  ])('%s', (_label, iso, text) => {
    expect(reading(iso)).toMatchObject({ isHoliday: false, text });
  });

  it('Chukkat 5787 (חֻקַּת → NoNikud חוקת)', () => {
    expect(reading('2027-07-10').text).toBe('פרשת חוקת');
  });

  it('Thursday looks ahead to the upcoming Shabbat', () => {
    expect(reading('2026-10-29').text).toBe('פרשת וירא');
  });
});

describe('full sweep 2025–2029', () => {
  it('every no-parsha Shabbat matches leyning truth', () => {
    let d = new Date('2025-10-04T12:00:00'); // a Saturday
    const end = new Date('2029-10-01T12:00:00');
    let noParsha = 0;
    while (d <= end) {
      const r = findShabbatReading(d, null);
      if (r.isHoliday) {
        noParsha++;
        expect(r.text, `display vs leyning on ${d.toISOString()}`).toBe(expectedFromLeyning(new HDate(d)));
      } else {
        expect(r.text.startsWith('פרשת'), `no parsha on ${d.toISOString()}`).toBe(true);
      }
      d = new Date(d.getTime() + 7 * 86400 * 1000);
    }
    expect(noParsha).toBe(14);
  });
});

describe('stripNikkud', () => {
  it('keeps maqaf', () => expect(stripNikkud('נְצָבִים־וָיֵּלֶךְ')).toBe('נצבים־וילך'));
  it('keeps geresh', () => expect(stripNikkud('סֻכּוֹת א׳')).toBe('סכות א׳'));
});
