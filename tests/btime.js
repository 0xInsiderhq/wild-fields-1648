const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  await page.addInitScript(() => { window.__wfHold = true; });
  const t0 = Date.now();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto(process.argv[2]);
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; }, null, { timeout: 600000, polling: 500 });
  console.log('ready', (Date.now() - t0) / 1000, await page.evaluate(() => document.querySelector('.credit').textContent));
  await browser.close();
})();
