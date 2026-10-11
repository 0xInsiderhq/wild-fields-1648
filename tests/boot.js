const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 640 } });
  await ctx.addInitScript(() => { window.__wfHold = true; });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 600)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 6).join('\n')));
  await page.goto('http://localhost:8765/test_local.html');
  await page.waitForTimeout(+(process.argv[2] || 40000));
  console.log(errs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
