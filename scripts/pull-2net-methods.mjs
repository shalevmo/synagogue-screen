// Pull 2net Netivot times under BOTH methods (חזון שמים default + אור החיים)
// by actually operating the method dropdown in a real browser.
import { existsSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no chromium'); process.exit(1); }

const dates = process.argv.length > 2 ? process.argv.slice(2)
  : ['20261221', '20270321', '20270621', '20260919'];
const out = {};

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const d of dates) {
  out[d] = {};
  for (const method of ['חזון שמים', 'אור החיים']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`https://calendar.2net.co.il/TodayTimes.aspx?city=%D7%A0%D7%AA%D7%99%D7%91%D7%95%D7%AA&today=${d}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // The dropdown is present but hidden in this layout — set it via JS and
    // fire the change handler manually.
    await page.evaluate((m) => {
      const sel = document.querySelector('#methodDropDownList');
      sel.value = m;
      sel.onchange();
    }, method);
    await page.waitForTimeout(2500); // JS recompute + render
    const times = await page.evaluate(() => {
      const grab = (label) => {
        const cells = [...document.querySelectorAll('td, .zmanRow, tr')];
        for (const c of cells) {
          if (c.innerText && c.innerText.includes(label)) {
            const m = c.innerText.match(/([0-9]{2}:[0-9]{2})/);
            if (m) return m[1];
          }
        }
        return null;
      };
      return {
        alot: grab('עלות השחר'),
        talit: grab('טלית ותפילין'),
        sunrise: grab('זריחה מישורית'),
        shmaMGA: grab('קריאת שמע מג'),
        shmaGRA: grab('קריאת שמע גר'),
        tefMGA: grab('תפילה מג'),
        tefGRA: grab('תפילה גר'),
        chatzot: grab('חצות'),
        shkiah: grab('שקיעה מישורית'),
        tzais: grab('צאת הכוכבים'),
        candles: grab('הדלקת נרות'),
        shabbatEnd: grab('צאת השבת'),
      };
    });
    out[d][method] = times;
    console.log(d, method, JSON.stringify(times));
    await ctx.close();
  }
}
writeFileSync('/tmp/2net-methods.json', JSON.stringify(out, null, 2));
await browser.close();
console.log('saved /tmp/2net-methods.json');