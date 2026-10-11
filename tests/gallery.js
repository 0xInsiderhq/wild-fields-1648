// close-up unit gallery: poses frozen at chosen times, rendered from a low RTS camera
const { chromium } = require('playwright');
(async () => {
  const mode = process.argv[2] || 'inf', q = process.argv[3] || '3', dist = +(process.argv[4] || 5.5), yaw = +(process.argv[5] || -0.5);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 640 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(q => { try { localStorage.setItem('wf-quality', q); } catch (_) { } window.__wfHold = true; }, q);
  const page = await ctx.newPage(); page.setDefaultTimeout(300000);
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 300)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 5).join('\n')));
  await page.goto('http://localhost:8765/test_local.html');
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; }, null, { timeout: 300000 });
  const once = async (n = 1) => { for (let i = 0; i < n; i++) { await page.evaluate(() => new Promise(r => { window.__wfOnce = true; const chk = () => window.__wfOnce ? requestAnimationFrame(chk) : r(); requestAnimationFrame(chk); })); } };
  await page.evaluate(() => { document.querySelector('#btn-start').click(); });
  const times = await page.evaluate(([m, dist, yaw]) => {
    const w = window.__wf, G = w.G; REVEAL = true; U.fogOn.value = 0;
    const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    // find open flat ground near the town hall
    let cx = th.x + 8, cz = th.z + 8, best = 1e9;
    for (let z = 10; z < 118; z++) for (let x = 10; x < 118; x++) {
      let bad = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -6; dx <= 6; dx++) { const i = (z + dz) * 128 + x + dx; if (G.tree[i] || G.terr[i] >= 3 || G.bocc[i] || G.dep[i]) bad++; }
      const sc = bad * 50 + Math.hypot(x - th.x, z - th.z); if (sc < best) { best = sc; cx = x + 0.5; cz = z + 0.5; }
    }
    for (const u of G.units.slice()) if (Math.hypot(u.x - cx, u.z - cz) < 8) { u.x += 20; }
    window.__wfMv = {}; window.__wfPh = {};
    const sp = (t, team, x, z, ang, f) => { const u = w.spawnUnit(t, team, cx + x, cz + z); u.ang = ang; u.state = 'idle'; u.path = []; if (f) f(u); return u; };
    const face = -Math.PI / 2 + yaw - 0.9;
    const foe = sp('pikeman', 1, 0, -30, 0);
    if (m === 'inf') {
      const k = 0.85;
      sp('peasant', 0, -3 * k, 0, face, u => { });
      sp('peasant', 0, -2 * k, 0, face, u => { window.__wfMv[u.id] = 1; window.__wfPh[u.id] = 1.0; });
      sp('peasant', 0, -1 * k, 0, face, u => { u.carry = 8; u.carryRes = 1; u.state = 'gather'; u.sub = 'return'; u.job = { kind: 'tree' }; window.__wfMv[u.id] = 1; window.__wfPh[u.id] = 2.5; });
      sp('pikeman', 0, 0, 0, face);
      sp('pikeman', 0, 1 * k, 0, face, u => { window.__wfMv[u.id] = 1; window.__wfPh[u.id] = 4; });
      sp('pikeman', 0, 2 * k, 0, face, u => { u.state = 'attack'; foe.x = cx + 2 * k + 1; foe.z = cz; u.target = foe; u.strikeT = -9; });
      sp('musketeer', 0, -3 * k, 1.3, face);
      sp('musketeer', 0, -2 * k, 1.3, face, u => { window.__wfMv[u.id] = 1; window.__wfPh[u.id] = 0.5; });
      sp('musketeer', 0, -1 * k, 1.3, face, u => { u.state = 'attack'; u.target = foe; u.cd = 0; u.aimT = 0.2; });
      sp('musketeer', 0, 0, 1.3, face, u => { u.state = 'attack'; u.target = foe; u.cd = 3; u.fireT = -1.2; });
      sp('musketeer', 0, 1 * k, 1.3, face, u => { u.state = 'attack'; u.target = foe; u.cd = 2; u.fireT = -2.4; });
      sp('musketeer', 0, 2 * k, 1.3, face, u => { u.state = 'attack'; u.target = foe; u.cd = 0.8; u.fireT = -4.2; });
      sp('cannon', 0, 0.5, 3.4, face);
    }
    if (m === 'work') {
      const k = 1.0;
      const tr = (() => { for (let r = 1; r < 40; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const i = (Math.floor(cz) + dz) * 128 + Math.floor(cx) + dx; if (G.tree[i]) return i; } return -1; })();
      sp('peasant', 0, -2 * k, 0, face, u => { u.state = 'gather'; u.sub = 'work'; u.job = { kind: 'tree' }; u.anim = 0; });
      sp('peasant', 0, -1 * k, 0, face, u => { u.state = 'gather'; u.sub = 'work'; u.job = { kind: 'tree' }; u.anim = 3.1; });
      sp('peasant', 0, 0, 0, face, u => { u.state = 'gather'; u.sub = 'work'; u.job = { kind: 'stone' }; u.anim = 0.5; });
      sp('peasant', 0, 1 * k, 0, face, u => { u.state = 'gather'; u.sub = 'work'; u.job = { kind: 'gold' }; u.anim = 3.3; });
      sp('peasant', 0, 2 * k, 0, face, u => { u.state = 'gather'; u.sub = 'work'; u.job = { kind: 'farm' }; u.anim = 1; });
      sp('peasant', 0, -2 * k, 1.4, face, u => { u.state = 'gather'; u.sub = 'work'; u.job = { kind: 'berry' }; u.anim = 1; });
      sp('peasant', 0, -1 * k, 1.4, face, u => { u.carry = 8; u.carryRes = 0; u.state = 'gather'; u.sub = 'return'; u.job = { kind: 'farm' }; window.__wfMv[u.id] = 1; });
      sp('peasant', 0, 0, 1.4, face, u => { u.carry = 8; u.carryRes = 2; u.state = 'gather'; u.sub = 'return'; u.job = { kind: 'stone' }; window.__wfMv[u.id] = 1; });
      sp('peasant', 0, 1 * k, 1.4, face, u => { u.carry = 8; u.carryRes = 0; u.state = 'gather'; u.sub = 'return'; u.job = { kind: 'berry' }; window.__wfMv[u.id] = 0.6; });
      sp('peasant', 0, 2 * k, 1.4, face, u => { u.carry = 8; u.carryRes = 0; u.state = 'gather'; u.sub = 'return'; u.job = { kind: 'fish' }; window.__wfMv[u.id] = 1; });
    }
    if (m === 'pike') {
      const a = sp('pikeman', 0, 0, 0, face), b = sp('pikeman', 0, 0.55, 0.45, face), c = sp('musketeer', 0, -0.7, 0.5, face), d = sp('pikeman', 0, 0.9, -0.5, face);
      w.setSel([a, b, c, d]);
    }
    if (m === 'cav') {
      sp('lighthorse', 0, -3, 0, face);
      sp('lighthorse', 0, -1.4, 0, face, u => { window.__wfMv[u.id] = 1; window.__wfPh[u.id] = 1; });
      sp('cuirassier', 0, 0.3, 0, face, u => { window.__wfMv[u.id] = 1; window.__wfPh[u.id] = 3; u.state = 'move'; u.amove = true; });
      sp('dragoon', 0, 2.0, 0, face);
      sp('dragoon', 0, -2.2, 1.8, face, u => { u.state = 'attack'; u.target = foe; u.cd = 0; u.aimT = 0.2; });
      sp('cuirassier', 0, -0.4, 1.8, face, u => { u.state = 'attack'; foe.x = cx - 0.4 + 1; foe.z = cz + 1.8; u.target = foe; u.strikeT = -0.18; });
      sp('cannon', 0, 2.2, 2.0, face, u => { u.state = 'attack'; u.target = foe; u.cd = 3; u.fireT = -1; });
    }
    G.paused = true;
    w.CAM.minD = 2.5; w.CAM.tdist = w.CAM.dist = dist; w.CAM.tyaw = w.CAM.yaw = yaw; w.centerOn(cx - 0.2, cz + 0.8);
    return G.t;
  }, [mode, dist, yaw]);
  await once(3);
  await page.screenshot({ path: `out/gal_${mode}.png` });
  if (mode === 'work') { await page.evaluate(() => { window.__wf.G.t += 0; for (const u of window.__wf.G.units) u.anim += 1.4; }); await once(1); await page.screenshot({ path: `out/gal_${mode}_b.png` }); }
  const perf = await page.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 20; i++) drawUnits(0.016, 0.5); return (performance.now() - t0) / 20; });
  console.log('drawUnits ms', perf.toFixed(2));
  console.log(errs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
