/**
 * Any change to events.js that alters displayed output (labels, times,
 * linger windows, day-flip behavior, ktiv) changes the digest. Intended
 * changes are re-pinned explicitly; unintended ones fail loudly.
 *
 *   npx vitest run -u test/golden.test.js     re-pin after an intended change
 *   node scripts/golden-events.mjs YYYY-MM-DD eyeball one day's 48 snapshots
 *                                             (diff old vs new code via git stash)
 */
import { describe, it, expect } from 'vitest';
import { HDate } from '@hebcal/core';
import { ABS_EPOCH, digestOf, snapshotYear } from './golden.js';

describe('golden event panel, year 5787', () => {
  it('abs↔epoch mapping: 740165 = 28 Sivan 5787 = 2027-07-03', () => {
    const probe = new HDate(new Date((740165 - ABS_EPOCH) * 86400000));
    expect([probe.getDate(), probe.getMonth(), probe.getFullYear()]).toEqual([28, 3, 5787]);
  });

  it('every half-hour snapshot matches the pinned digest', () => {
    const { text, count } = snapshotYear();
    expect(count).toBe(18480);
    expect(digestOf(text)).toMatchInlineSnapshot(`"881232f7fb653eb845321447b638dc396523fa5adf6c5f734950e36a360e9bba"`);
  });
});
