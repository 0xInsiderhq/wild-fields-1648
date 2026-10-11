// play a real battle to the end (our side run by the AI) and check the victory screen appears and nothing throws
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/test_local.html';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
  await page.addInitScript(() => { try { localStorage.setItem('wf-quality', '0'); } catch (_) { } });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  let navs = 0; page.on('framenavigated', f => { if (f === page.mainFrame()) navs++; });
  page.setDefaultTimeout(600000);
  await page.goto(url);
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; });
  await page.evaluate(() => document.querySelector('#btn-start').click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const G = window.__wf.G; G.teams[0].ai = true; initAI(G.teams[0], 2); G.teams[0].res = [2000, 2000, 2000, 2000]; REVEAL = true; });
  const t0 = Date.now();
  for (let k = 0; k < 60; k++) {
    const r = await page.evaluate(() => {
      const w = window.__wf, G = w.G;
      for (let i = 0; i < 30 * 30 && !G.over; i++) { for (const u of G.units) { u.px = u.x; u.pz = u.z; u.pang = u.ang; } w.step(1 / 30); }
      const live = G.builds.filter(b => b.team !== 0).length;
      return { t: G.t.toFixed(0), over: G.over, winner: G.winner, enemyBuilds: live, ruins: RUINS.length, bent: w.BENT.size };
    });
    await page.waitForTimeout(1200);   // let the render loop catch up: collapses, ruins, smoke
    if (k % 4 === 0 || r.over) console.log(JSON.stringify(r));
    if (r.over) break;
  }
  await page.waitForTimeout(9000);
  const end = await page.evaluate(() => ({ endShown: !document.querySelector('#end').hidden, title: document.querySelector('#end-title').textContent, lede: document.querySelector('#end-lede').textContent, startShown: !document.querySelector('#start').hidden, ruins: RUINS.length, gcSize: Object.keys(GC).length }));
  console.log(JSON.stringify(end), 'navigations', navs, 'secs', (Date.now() - t0) / 1000);
  await page.screenshot({ path: 'out/victory.png' });
  console.log(errs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
