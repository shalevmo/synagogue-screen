// Measure the real rendered geometry: column positions + font sizes,
// so the "align with the times on the right column" fix is grounded.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

process.env.TZ = 'Asia/Jerusalem';
const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no chromium'); process.exit(1); }

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();
if (page.clock?.setFixedTime) {
  await page.clock.setFixedTime(new Date('2026-09-19T13:00:00+03:00'));
} else {
  await page.addInitScript((iso) => {
    const FIXED = Date.parse(iso);
    const RealDate = window.Date;
    class FakeDate extends RealDate {
      constructor(...args) { args.length === 0 ? super(FIXED) : super(...args); }
      static now() { return FIXED; }
    }
    window.Date = FakeDate;
  }, '2026-09-19T13:00:00+03:00');
}
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle', timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const cols = [...document.querySelectorAll('.row > .col-4')].map((c, i) => {
    const r = c.getBoundingClientRect();
    const first = c.querySelector('.h1, .h2');
    return { i, text: c.innerText.slice(0, 25).replace(/\n/g, ' '), x: Math.round(r.x), w: Math.round(r.width) };
  });
  const fs = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10;
  };
  return {
    cols,
    zmanimRow: fs('.col-4 .d-flex.h1'),
    zmanimRow2: document.querySelectorAll('.col-4 .d-flex.h1')[0] ? Math.round(parseFloat(getComputedStyle(document.querySelectorAll('.col-4 .d-flex.h1')[0]).fontSize) * 10) / 10 : null,
    prayerName: fs('.col-4 .h1.mb-0'),
    prayerTime: fs('.prayer-time'),
    eventBanner: fs('.event-banner'),
    eventH2: fs('.event-line .h2'),
    clock: fs('#clock'),
    parshaTitle: fs('.h1.col-12'),
    eventPanelRect: (() => { const p = document.querySelector('.event-panel'); if (!p) return null; const r = p.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), bottom: Math.round(r.bottom) }; })(),
    clockRect: (() => { const p = document.querySelector('#clock'); if (!p) return null; const r = p.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), bottom: Math.round(r.bottom) }; })(),
  };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
await browser.close();