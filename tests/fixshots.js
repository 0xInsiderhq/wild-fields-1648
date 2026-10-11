// check the three fixes: berry patch scale, decor cleared under new buildings, organic dirt edges
const { chromium } = require('playwright');
(async () => {
  const url = process.argv[2] || 'http://localhost:8765/test_local.html', tag = process.argv[3] || 'after';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
  await page.addInitScript(() => { try { localStorage.setItem('wf-quality', '2'); } catch (_) { } window.__wfHold = true; });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.setDefaultTimeout(600000);
  await page.goto(url);
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; });
  await page.evaluate(() => document.querySelector('#btn-start').click());
  await page.addStyleTag({ content: '#top,#bar,#toasts,#tip,#overlay,#alert,#miniwrap,#end{display:none!important}' });
  const once = async (n = 1) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise(r => { window.__wfOnce = true; const chk = () => window.__wfOnce ? requestAnimationFrame(chk) : r(); requestAnimationFrame(chk); })); };
  const shoot = async (name, fn, arg) => { await page.evaluate(fn, arg); await once(3); await page.screenshot({ path: `out/fx_${name}_${tag}.jpg`, type: 'jpeg', quality: 90 }); console.log('shot', name); };
  // berries first, before anyone eats them
  await page.evaluate(() => { REVEAL = true; U.fogOn.value = 0; const G = window.__wf.G, th = G.builds.find(b => b.team === 0 && b.type === 'townhall'); window.__berry = G.deposits.filter(d => d.type === 'berry').sort((a, b) => Math.hypot(a.x - th.x, a.z - th.z) - Math.hypot(b.x - th.x, b.z - th.z))[0]; const p = window.__wf.spawnUnit('peasant', 0, window.__berry.x + 0.9, window.__berry.z + 0.6); p.ang = 2.4; });
  await shoot('berry', () => { const w = window.__wf, d = window.__berry; w.CAM.yaw = w.CAM.tyaw = -0.8; w.CAM.minD = 4; w.CAM.dist = w.CAM.tdist = 7; w.centerOn(d.x, d.z); });
  const info = await page.evaluate(() => {
    const w = window.__wf, G = w.G;
    REVEAL = true; U.fogOn.value = 0;
    G.teams[0].ai = true; initAI(G.teams[0], 2); G.teams[0].res = [2000, 2000, 2000, 2000];
    for (let i = 0; i < 30 * 900; i++) { for (const u of G.units) { u.px = u.x; u.pz = u.z; u.pang = u.ang; } w.step(1 / 30); }
    const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    window.__th = th;
    const pick = G.builds.find(b => b.type === 'church') || G.builds.find(b => b.type === 'tower') || th;
    window.__pick = pick;
    return { builds: G.builds.length, types: [...new Set(G.builds.map(b => b.type))], pick: pick.type, decor: (WORLD.decor || []).length };
  });
  console.log(JSON.stringify(info));
  await shoot('town', () => { const w = window.__wf, b = window.__pick; w.CAM.yaw = w.CAM.tyaw = -0.6; w.CAM.dist = w.CAM.tdist = 16; w.centerOn(b.x, b.z); });
  await shoot('wide', () => { const w = window.__wf, b = window.__th; w.CAM.yaw = w.CAM.tyaw = -0.9; w.CAM.dist = w.CAM.tdist = 30; w.centerOn(b.x + 3, b.z + 3); });
  // drop a house right on top of a bush near the town and look at it
  const placed = await page.evaluate(() => {
    const w = window.__wf, G = w.G, th = window.__th;
    let best = null;
    for (const m of WORLD.decor || []) {
      if (!m.material || !m.material.alphaTest) continue;   // leaf-card bushes
      const a = m.instanceMatrix.array;
      for (let k = 0; k < m.count; k++) {
        if (a[k * 16] === 0 && a[k * 16 + 1] === 0) continue;
        const x = a[k * 16 + 12], z = a[k * 16 + 14], d = Math.hypot(x - th.x, z - th.z);
        if (d > 30 || (best && d > best.d)) continue;
        const tx = Math.floor(x - 0.5), tz = Math.floor(z - 0.5);
        if (footprintOk('house', tx, tz)) best = { d, tx, tz, x, z };
      }
    }
    if (!best) return null;
    const before = (WORLD.decor || []).reduce((s, m) => { const a = m.instanceMatrix.array; let n = 0; for (let k = 0; k < m.count; k++) if (a[k * 16] !== 0 || a[k * 16 + 1] !== 0) n++; return s + n; }, 0);
    const b = w.placeBuilding('house', 0, best.tx, best.tz, false);
    const after = (WORLD.decor || []).reduce((s, m) => { const a = m.instanceMatrix.array; let n = 0; for (let k = 0; k < m.count; k++) if (a[k * 16] !== 0 || a[k * 16 + 1] !== 0) n++; return s + n; }, 0);
    window.__placed = b;
    return { ...best, cleared: before - after };
  });
  console.log('placed', JSON.stringify(placed));
  if (placed) await shoot('place', () => { const w = window.__wf, b = window.__placed; w.CAM.yaw = w.CAM.tyaw = -0.8; w.CAM.dist = w.CAM.tdist = 8; w.centerOn(b.x, b.z); });
  console.log(errs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
