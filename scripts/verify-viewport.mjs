// Verify the fixed 1920×1080 stage across viewport sizes:
// - stage box stays 1920×1080 everywhere
// - scale factor = min(vw/1920, vh/1080) applied via transform
// - rendered (visual) clock font stays identical to FHD proportionally
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

process.env.TZ = 'Asia/Jerusalem';
const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no chromium'); process.exit(1); }

const viewports = [
  { label: 'FHD 1920×1080 (kiosk)', w: 1920, h: 1080 },
  { label: 'HD 1366×768 (smaller screen)', w: 1366, h: 768 },
  { label: 'Laptop 1440×900', w: 1440, h: 900 },
  { label: 'Tablet-ish 1024×600', w: 1024, h: 600 },
];

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars', '--force-color-profile=srgb'],
});

for (const v of viewports) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const F = Date.parse('2026-09-19T13:00:00+03:00');
    const R = window.Date;
    class D extends R {
      constructor(...a) { a.length === 0 ? super(F) : super(...a); }
      static now() { return F; }
    }
    window.Date = D;
  });
  await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => {
    const el = document.querySelector('#content-wrapper');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const clock = document.querySelector('#clock');
    const cr = clock.getBoundingClientRect();
    const root = document.getElementById('root');
    const rr = root.getBoundingClientRect();
    return {
      stageBox: `${Math.round(r.width)}×${Math.round(r.height)}`,
      transform: cs.transform === 'none' ? '(none)' : cs.transform,
      visualBox: `${Math.round(cr.width)}×${Math.round(cr.height)}`,
      rootBox: `${Math.round(rr.width)}×${Math.round(rr.height)}`,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
      overflowY: document.documentElement.scrollHeight > window.innerHeight,
    };
  });
  const expected = Math.min(v.w / 1920, v.h / 1080).toFixed(4);
  console.log(`${v.label}: stage=${info.stageBox} | transform=${info.transform} (expect scale ~${expected}) | clockVisual=${info.visualBox} | overflow: x=${info.overflowX} y=${info.overflowY}`);
  const file = `shots/viewport-${v.w}x${v.h}.png`;
  await page.screenshot({ path: file });
  console.log(`   saved ${file}`);
  await ctx.close();
}
await browser.close();
console.log('DONE');