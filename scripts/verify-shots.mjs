// Verify what the event panel actually renders at the two frozen moments.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

process.env.TZ = 'Asia/Jerusalem';
const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no chromium'); process.exit(1); }

const shots = [
  { iso: '2026-09-12T13:00:00+03:00', label: 'RH d1 on Shabbat' },
  { iso: '2026-09-19T13:00:00+03:00', label: 'Shabbat Shuva' },
];

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
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
  await page.waitForTimeout(1500);
  const out = await page.evaluate(() => {
    const panel = document.querySelector('.event-panel');
    const clock = document.querySelector('#clock');
    return {
      panel: panel ? panel.innerText.replace(/\n+/g, ' | ') : '(no .event-panel in DOM)',
      clock: clock ? clock.innerText.trim() : '(no #clock)',
    };
  });
  console.log(`\n=== ${s.label} (${s.iso}) ===`);
  console.log(`event panel: ${out.panel}`);
  console.log(`clock: ${out.clock}`);
  await ctx.close();
}
await browser.close();