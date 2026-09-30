import { createHash } from 'node:crypto';
import { HDate } from '@hebcal/core';
import { computeEventLines } from '../src/lib/events.js';
import { NETIVOT } from './netivot.js';

/**
 * Golden harness — regenerates every half-hour snapshot of the center
 * column's event panel across the full Jewish year 5787 (RH → RH, incl.
 * the Adar I/II leap months). Snapshots are regenerated, never stored —
 * test/golden.test.js pins only a sha256 digest of the entire run.
 */

export const YEAR = 5787;

/** abs day 719163 = 1970-01-01 (checked in test/golden.test.js) */
export const ABS_EPOCH = 719163;

export function snapshotYear() {
  const startAbs = new HDate(1, 7, YEAR).abs();          // 1 Tishrei 5787 (hebcal months are Nisan-based: Tishrei = 7)
  const endAbs = new HDate(1, 7, YEAR + 1).abs();        // 1 Tishrei 5788
  const chunks = [];
  for (let abs = startAbs; abs < endAbs; abs++) {
    const day = new Date((abs - ABS_EPOCH) * 86400000);  // UTC midnight
    for (let slot = 0; slot < 48; slot++) {
      const now = new Date(day.getTime() + slot * 30 * 60000);
      const { banners, timed } = computeEventLines(NETIVOT, now);
      const lines = [
        ...banners,
        ...timed.map(l => `${l.label} ${l.time}`),
      ];
      chunks.push(`${now.toISOString()} ${lines.join(' | ')}`);
    }
  }
  return { text: chunks.join('\n'), count: chunks.length };
}

export function digestOf(text) {
  return createHash('sha256').update(text).digest('hex');
}
