// Sefirat Haomer shots: Shabbat 22 Iyar 5787 (29 May 2027, ל״ז בעומר).
// tzais = 20:20, havdalah = 20:11, linger ends = 21:11.
// 1) 18:00 — BEFORE tzais: Shabbat day, omer 37, full pair.
// 2) 20:30 — AFTER tzais (linger): flipped to Sunday, omer 38, pair lingers.
// 3) 21:30 — AFTER linger expiry: banner only.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

process.env.TZ = 'Asia/Jerusalem';
const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no chromium'); process.exit(1); }

const shots = [
  { iso: '2027-05-29T18:00:00+03:00', file: 'shots/2027-05-29-omer-before-tzais.png', label: '18:00 — BEFORE tzais (Shabbat day)' },
  { iso: '2027-05-29T20:30:00+03:00', file: 'shots/2027-05-29-omer-after-tzais.png', label: '20:30 — AFTER tzais (linger window)' },
  { iso: '2027-05-29T21:30:00+03:00', file: 'shots/2027-05-29-omer-linger-expired.png', label: '21:30 — AFTER linger expiry' },
];

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
});

for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript((iso) => {
    const FIXED = Date.parse(iso);
    const RealDate = window.Date;
    class FakeDate extends RealDate {
      constructor(...args) { args.length === 0 ? super(FIXED) : super(...args); }
      static now() { return FIXED; }
    }
    window.Date = FakeDate;
  }, s.iso);
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => ({
    panel: document.querySelector('.event-panel')?.innerText.replace(/\n+/g, ' | ') ?? '(none)',
    reading: document.querySelector('.special-text')?.innerText ?? '(none)',
    header: document.querySelector('.container-fluid .h1')?.innerText ?? '',
  }));
  console.log(`${s.label}\n   panel: ${out.panel} | reading: ${out.reading} | header: ${out.header.replace(/\n/g, ' ')}`);
  await page.screenshot({ path: s.file });
  console.log(`   saved ${s.file}`);
  await ctx.close();
}
await browser.close();
console.log('DONE');