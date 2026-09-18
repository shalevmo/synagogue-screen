process.env.TZ = 'Asia/Jerusalem';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { HDate, Location } from '@hebcal/core';
import { computeEventLines } from '../src/lib/events.js';

/**
 * Golden harness — regenerates every half-hour snapshot of the center
 * column's event panel across the full Jewish year 5787 (RH → RH, incl.
 * the Adar I/II leap months) and compares a sha256 digest of the entire
 * run against the pinned value. Snapshots are regenerated, never stored —
 * the only committed artifact is the digest below.
 *
 * Any change to events.js that alters displayed output (labels, times,
 * linger windows, day-flip behavior, ktiv) changes the digest. Intended
 * changes are re-pinned explicitly; unintended ones fail loudly.
 *
 *   node scripts/golden-events.mjs            verify against PINNED
 *   node scripts/golden-events.mjs --update   re-pin after an intended change
 *   node scripts/golden-events.mjs --dump YYYY-MM-DD   eyeball one day's
 *                                             48 snapshots (diff old vs new
 *                                             code via git stash)
 */

const YEAR = 5787;
const NETIVOT = new Location(31.42215, 34.58858, true, 'Asia/Jerusalem', 0);
const PINNED = '8311baeb64f8bbfdc5a347e06d487be5b3a512a48ac286f1af4d0f4ba8164965';

/** abs day 719163 = 1970-01-01 (checked by the self-test below) */
const ABS_EPOCH = 719163;

function snapshotYear() {
  const startAbs = new HDate(1, 7, YEAR).abs();          // 1 Tishrei 5787 (hebcal months are Nisan-based: Tishrei = 7)
  const endAbs = new HDate(1, 7, YEAR + 1).abs();        // 1 Tishrei 5788
  const chunks = [];
  let count = 0;
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
      count++;
    }
  }
  return { text: chunks.join('\n'), count };
}

function digestOf(text) {
  return createHash('sha256').update(text).digest('hex');
}

// Self-test of the abs↔epoch mapping: 740165 = 28 Sivan 5787 = 2027-07-03.
{
  const probe = new HDate(new Date((740165 - ABS_EPOCH) * 86400000));
  if (probe.getMonth() !== 3 || probe.getDate() !== 28 || probe.getFullYear() !== 5787) {
    console.error(`abs↔epoch mapping broken: got ${probe.toString()}`);
    process.exit(2);
  }
}

const { text, count } = snapshotYear();
const digest = digestOf(text);

if (process.argv.includes('--update')) {
  const url = new URL(import.meta.url);
  const src = await readFile(url, 'utf8');
  await writeFile(url, src.replace(/^const PINNED = '.*';$/m, `const PINNED = '${digest}';`));
  console.log(`golden re-pinned: ${count} snapshots, sha256 ${digest}`);
} else if (process.argv.includes('--dump')) {
  const iso = process.argv[process.argv.indexOf('--dump') + 1];
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
  for (const line of text.split('\n')) {
    if (fmt.format(new Date(line.slice(0, 24))) === iso) console.log(line);
  }
} else if (digest === PINNED) {
  console.log(`golden OK: ${count} snapshots, sha256 ${digest.slice(0, 16)}…`);
} else {
  console.error(`golden MISMATCH after ${count} snapshots
  pinned: ${PINNED}
  actual: ${digest}
If this change is intended, re-pin:  node scripts/golden-events.mjs --update`);
  process.exit(1);
}