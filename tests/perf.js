const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 640 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('wf-quality', '2'); } catch (_) { } window.__wfHold = true; });
  const page = await ctx.newPage(); page.setDefaultTimeout(300000);
  page.on('pageerror', e => console.log('PAGEERR ' + e.message));
  await page.goto('http://localhost:8765/test_local.html');
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; });
  await page.evaluate(() => document.querySelector('#btn-start').click());
  const once = () => page.evaluate(() => new Promise(r => { window.__wfOnce = true; const chk = () => window.__wfOnce ? requestAnimationFrame(chk) : r(); requestAnimationFrame(chk); }));
  const r = await page.evaluate(() => {
    const w = window.__wf, G = w.G; REVEAL = true; U.fogOn.value = 0;
    const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    const types = ['peasant', 'pikeman', 'musketeer', 'lighthorse', 'dragoon', 'cuirassier', 'cannon'];
    for (let k = 0; k < 320; k++) { const u = w.spawnUnit(types[k % 7], k % 2, th.x + 6 + (k % 20) * 0.7, th.z - 10 + Math.floor(k / 20) * 0.8); }
    w.CAM.tdist = w.CAM.dist = 40; w.centerOn(th.x + 12, th.z - 4);
    const t0 = performance.now(); for (let i = 0; i < 20; i++) drawUnits(0.016, 0.5); const du = (performance.now() - t0) / 20;
    let inst = 0; for (const k in UR.parts) inst += UR.parts[k].count;
    const t1 = performance.now(); for (let i = 0; i < 20; i++) w.step(1 / 30); const st = (performance.now() - t1) / 20;
    return { units: G.units.length, drawUnitsMs: du.toFixed(2), instances: inst, simStepMs: st.toFixed(2) };
  });
  console.log(JSON.stringify(r));
  await once(); await once();
  const info = await page.evaluate(() => { const ri = window.__wf.renderer.info; return { geos: ri.memory.geometries, tex: ri.memory.textures, progs: ri.programs.length }; });
  console.log(JSON.stringify(info));
  await page.evaluate(() => { const w = window.__wf; w.CAM.tdist = w.CAM.dist = 70; });
  await once(); await once();
  await page.screenshot({ path: 'out/perf_far.png' });
  await browser.close();
})();
