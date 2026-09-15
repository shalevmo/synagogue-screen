process.env.TZ = 'Asia/Jerusalem';
// Pull 2net Netivot nidche Tisha B'Av 5789 times (9 Av = Shabbat 21 Jul 2029,
// fast observed Sunday 22 Jul) under the אור החיים method — checking what
// תחילת הצום 2net prints for the nidche case (shkiah vs tzais Motzei Shabbat).
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const exe = '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
if (!existsSync(exe)) { console.error('no chromium'); process.exit(1); }

const dates = ['20290721', '20290722'];
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

for (const d of dates) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(
    `https://calendar.2net.co.il/TodayTimes.aspx?city=%D7%A0%D7%AA%D7%99%D7%91%D7%95%D7%AA&today=${d}`,
    { waitUntil: 'domcontentloaded', timeout: 45000 },
  );
  await page.evaluate((m) => {
    const sel = document.querySelector('#methodDropDownList');
    sel.value = m;
    sel.onchange();
  }, 'אור החיים');
  await page.waitForTimeout(2500);
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
      candles: grab('הדלקת נרות'),
      shkiah: grab('שקיעה'),
      tzais: grab('צאת הכוכבים'),
      shabbatEnd: grab('צאת השבת'),
      fastStart: grab('תחילת הצום'),
      fastEnd: grab('סיום הצום'),
    };
  });
  console.log(d, JSON.stringify(times));
  await ctx.close();
}

await browser.close();
console.log('DONE');