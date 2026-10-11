const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('wf-quality', '0'); } catch (_) { } window.__wfHold = true; });
  const page = await ctx.newPage(); page.setDefaultTimeout(600000);
  const errs = []; page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto('http://localhost:8765/test_local.html');
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; });
  const once = async () => page.evaluate(() => new Promise(r => { window.__wfOnce = true; const chk = () => window.__wfOnce ? requestAnimationFrame(chk) : r(); requestAnimationFrame(chk); }));
  await page.evaluate(() => { document.querySelectorAll('#o-ai button')[1].click(); document.querySelector('#btn-start').click(); });
  await page.evaluate(() => { const w = window.__wf; w.G.teams[0].ai = true; initAI(w.G.teams[0], 1); });
  for (let k = 0; k < 40; k++) {
    const r = await page.evaluate(() => {
      const w = window.__wf, G = w.G;
      for (let i = 0; i < 30 * 30; i++) { for (const u of G.units) { u.px = u.x; u.pz = u.z; u.pang = u.ang; } w.step(1 / 30); if (i % 3 === 0) { processSimFx(); updatePS(FX.soft, 0.1); updatePS(FX.add, 0.1); syncBuildings(0.1, 0.1); updateFalling(0.1); } }
      // look at the busiest fight, if any
      const fighting = G.units.filter(u => u.state === 'attack');
      if (fighting.length) { const u = fighting[0]; w.centerOn(u.x, u.z); }
      refreshPanel(true); hud(); drawMinimap();
      return { t: (G.t / 60).toFixed(1), units: G.units.length, builds: G.builds.length, fight: fighting.length, over: G.over, alive: G.teams.map(t => t.alive ? 1 : 0).join(''), corpses: G.corpses.length, ps: FX.soft.n + FX.add.n, bent: BENT.size };
    });
    await once();
    if (k % 5 === 0 || r.over) console.log(JSON.stringify(r));
    if (r.over) break;
  }
  await page.screenshot({ path: 'out/long_end.png' });
  console.log(errs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
