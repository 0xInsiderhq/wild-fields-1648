// second round of fixes: ruins, fallen hats, pond bed, farm under construction
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
  const shoot = async (name, fn) => { await page.evaluate(fn); await once(3); await page.screenshot({ path: `out/f2_${name}_${tag}.jpg`, type: 'jpeg', quality: 90 }); console.log('shot', name); };
  const spot = await page.evaluate(() => {
    const w = window.__wf, G = w.G; REVEAL = true; U.fogOn.value = 0;
    const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    // an open patch for a row of buildings to burn
    let best = null;
    for (let z = 10; z < 118; z++) for (let x = 10; x < 110; x++) {
      let ok = true; for (let dz = 0; dz < 12 && ok; dz++) for (let dx = 0; dx < 16 && ok; dx++) { const i = (z + dz) * 128 + x + dx; if (G.tree[i] || G.terr[i] >= 3 || G.bocc[i] || G.dep[i]) ok = false; }
      if (ok) { const d = Math.hypot(x - th.x, z - th.z); if (!best || d < best.d) best = { x, z, d }; }
    }
    const list = [['house', 0, 0], ['barracks', 3, 0], ['tower', 8, 0], ['blacksmith', 11, 0], ['storehouse', 0, 4], ['church', 3, 4], ['house', 7, 4], ['stable', 11, 4]];
    window.__ruinB = list.map(([t, dx, dz]) => placeBuilding(t, 1, best.x + dx, best.z + dz, true));
    window.__spot = best;
    return best;
  });
  console.log('spot', JSON.stringify(spot));
  await once(2);   // build the meshes so each type's footprint is known
  await page.evaluate(() => {
    for (const b of window.__ruinB) kill(b, null);
    window.__wf.step(1 / 30); syncBuildings(0.016, 0); syncBuildings(3, 0);
    // a few dead musketeers and peasants beside the ruins
    const s = window.__spot, w = window.__wf, G = window.__wf.G;
    const types = ['musketeer', 'musketeer', 'pikeman', 'peasant', 'musketeer', 'lighthorse', 'dragoon', 'peasant'];
    types.forEach((t, k) => { const u = w.spawnUnit(t, 1, s.x + 2 + k * 0.7, s.z + 9.5 + (k % 2) * 0.5); u.ang = k * 0.8; kill(u, null); });
    for (const c of G.corpses) c.t = G.t - 6;
  });
  await shoot('ruins', () => { const w = window.__wf, s = window.__spot; w.CAM.yaw = w.CAM.tyaw = -0.7; w.CAM.minD = 4; w.CAM.dist = w.CAM.tdist = 15; w.centerOn(s.x + 7.5, s.z + 4); });
  await shoot('ruins_close', () => { const w = window.__wf, s = window.__spot; w.CAM.yaw = w.CAM.tyaw = -0.7; w.CAM.dist = w.CAM.tdist = 8; w.centerOn(s.x + 3, s.z + 2); });
  await shoot('corpses', () => { const w = window.__wf, s = window.__spot; w.CAM.yaw = w.CAM.tyaw = -0.7; w.CAM.dist = w.CAM.tdist = 6; w.centerOn(s.x + 4.5, s.z + 9.6); });
  // the pond nearest the town
  await shoot('pond', () => {
    const w = window.__wf, G = w.G, th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    let best = null; for (let i = 0; i < 128 * 128; i++) if (G.terr[i] === 5) { const x = i % 128, z = (i / 128) | 0; let tr = 0; for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) { const a = x + dx, b = z + dz; if (a >= 0 && b >= 0 && a < 128 && b < 128 && G.tree[b * 128 + a]) tr++; } if (!best || tr < best.tr) best = { x, z, tr }; }
    w.CAM.yaw = w.CAM.tyaw = -0.7; w.CAM.dist = w.CAM.tdist = 24; w.centerOn(best.x, best.z);
  });
  // a field being staked out
  await shoot('farm', () => {
    const w = window.__wf, G = w.G, th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    let p = null; for (let r = 5; r < 20 && !p; r++) for (let a = 0; a < 6.28 && !p; a += 0.3) { const tx = Math.round(th.x + Math.cos(a) * r), tz = Math.round(th.z + Math.sin(a) * r); if (footprintOk('farm', tx, tz)) p = [tx, tz]; }
    const b = placeBuilding('farm', 0, p[0], p[1], false); b.prog = 0.3;
    w.CAM.yaw = w.CAM.tyaw = -0.7; w.CAM.dist = w.CAM.tdist = 8; w.centerOn(b.x, b.z);
  });
  console.log(errs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
