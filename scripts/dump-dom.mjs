// Extract rendered text from the live dev server (left zmanim column + center
// panel) to verify the Or Hahaim conversion against 2net's published numbers.
import { chromium } from 'playwright-core';

process.env.TZ = 'Asia/Jerusalem';
const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';

const shots = [
  { iso: '2026-09-12T13:00:00+03:00', label: 'RH d1 Shabbat (leyning reading)' },
  { iso: '2026-10-03T13:00:00+03:00', label: 'SA/ST Shabbat (leyning reading)' },
];

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
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
  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const cols = document.querySelectorAll('.bordered');
    const grab = (el) => el ? el.innerText.replace(/\n+/g, ' | ').trim() : '(missing)';
    return {
      left: grab(cols[0]),
      center: grab(cols[1]),
      right: grab(cols[2]),
    };
  });
  console.log(`══ ${s.label}`);
  console.log('  LEFT  :', data.left);
  console.log('  CENTER:', data.center);
  console.log('  RIGHT :', data.right);
  await ctx.close();
}

await browser.close();
console.log('DONE');