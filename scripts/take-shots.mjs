// Screenshot the kiosk page at a chosen moment, FHD.
// Uses playwright-core with the cached chromium; freezes the clock via
// page.clock (fallback: Date-constructor patch) and TZ=Asia/Jerusalem so
// the clock face reads the frozen moment like the real kiosk.
//
//   node scripts/take-shots.mjs [YYYY-MM-DD] [out.png] [--at HH:MM]
//
//   no args        → interactive default: today at 13:00 → shots/today-1300.png
//   --at 19:30     → freeze at 19:30 IDT instead of 13:00
//   multiple dates → node scripts/take-shots.mjs 2027-06-19 out.png 2027-07-03 out2.png
//                    (pairs of date+file; each may be followed by --at)
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

process.env.TZ = 'Asia/Jerusalem';

const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no cached chromium found'); process.exit(1); }

// ── Parse args: pairs of [date, file], each optionally followed by --at HH:MM.
// Legacy no-arg mode keeps the two historical anchors (RH d1 + SA/ST readings).
const argv = process.argv.slice(2);
const shots = [];
if (argv.length === 0) {
  const todayISO = new Date().toISOString().slice(0, 10);
  shots.push({ iso: `${todayISO}T13:00:00+03:00`, file: 'shots/today-1300.png', label: 'today 13:00' });
} else {
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === '--at') { i += 2; continue; } // consumed below per pair
    const date = argv[i];
    const file = argv[i + 1];
    if (!file || file === '--at') {
      console.error(`usage: node scripts/take-shots.mjs YYYY-MM-DD out.png [--at HH:MM] …`);
      process.exit(1);
    }
    i += 2;
    let hhmm = '13:00';
    if (argv[i] === '--at') { hhmm = argv[i + 1]; i += 2; }
    shots.push({
      iso: `${date}T${hhmm}:00+03:00`,
      file,
      label: `${date} ${hhmm}`,
    });
  }
}

mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
});

for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  if (page.clock?.setFixedTime) {
    await page.clock.setFixedTime(new Date(s.iso));
  } else {
    await page.addInitScript((iso) => {
      const FIXED = Date.parse(iso);
      const RealDate = window.Date;
      class FakeDate extends RealDate {
        constructor(...args) { args.length === 0 ? super(FIXED) : super(...args); }
        static now() { return FIXED; }
      }
      window.Date = FakeDate;
    }, s.iso);
  }

  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2000); // let crossfade/settle finish

  await page.screenshot({ path: s.file });
  console.log(`saved ${s.file}  (${s.label})`);
  await ctx.close();
}

await browser.close();
console.log('DONE');