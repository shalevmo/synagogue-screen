// Screenshot the holiday-times panel at two fixed clock moments, FHD.
// Uses playwright-core with the cached chromium; freezes the clock via
// page.clock (fallback: Date-constructor patch) and TZ=Asia/Jerusalem so
// the clock face reads 13:00 like the real kiosk.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

process.env.TZ = 'Asia/Jerusalem';

const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no cached chromium found'); process.exit(1); }

const shots = [
  { iso: '2026-09-12T13:00:00+03:00', file: 'shots/2026-09-12-rh-d1-shabbat-1300.png', label: 'RH d1 on Shabbat (yesterday)' },
  { iso: '2026-09-19T13:00:00+03:00', file: 'shots/2026-09-19-shabbat-shuva-1300.png', label: 'Shabbat Shuva (next Shabbat)' },
];

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