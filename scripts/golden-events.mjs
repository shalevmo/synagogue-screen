process.env.TZ = 'Asia/Jerusalem';
import { snapshotYear } from '../test/golden.js';

/**
 * Eyeball one day of the golden harness (test/golden.test.js pins the
 * whole year's digest): prints that day's 48 half-hour snapshots of the
 * event panel. Diff old vs new code via git stash.
 *
 *   node scripts/golden-events.mjs YYYY-MM-DD
 */

const iso = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) {
  console.error('usage: node scripts/golden-events.mjs YYYY-MM-DD');
  process.exit(2);
}
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });
for (const line of snapshotYear().text.split('\n')) {
  if (fmt.format(new Date(line.slice(0, 24))) === iso) console.log(line);
}
