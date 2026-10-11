// render single frames on demand so software GL stays usable
const { chromium } = require('playwright');
(async () => {
  const q = process.argv[2] || '2', mode = process.argv[3] || 'close';
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 640 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(q => { try { localStorage.setItem('wf-quality', q); } catch (_) { } window.__wfHold = true; }, q);
  const page = await ctx.newPage(); page.setDefaultTimeout(300000);
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('http://localhost:8765/test_local.html');
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; }, null, { timeout: 300000 });
  const once = async (n = 1) => { for (let i = 0; i < n; i++) { await page.evaluate(() => new Promise(r => { window.__wfOnce = true; const chk = () => window.__wfOnce ? requestAnimationFrame(chk) : r(); requestAnimationFrame(chk); })); } };
  await page.evaluate(() => { document.querySelector('#btn-start').click(); });
  await page.evaluate(m => {
    const w = window.__wf, G = w.G;
    // run the town for a few minutes so there is something to look at
    const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    if (m !== 'start') {
      G.teams[0].ai = true; initAI(G.teams[0], 2); G.teams[0].res = [2000, 2000, 2000, 2000];
      for (let i = 0; i < 30 * (m === 'late' ? 900 : 420); i++) { for (const u of G.units) { u.px = u.x; u.pz = u.z; u.pang = u.ang; } w.step(1 / 30); }
      G.teams[0].ai = false; G.teams[0].brain = null;
    }
    w.CAM.tyaw = w.CAM.yaw = -0.8; w.CAM.tdist = w.CAM.dist = m === 'close' ? 14 : 24;
    w.centerOn(th.x + 1, th.z + 1);
    if (m === 'units') {
      REVEAL = true;
      const cx = th.x + 2, cz = th.z + 6;
      const types = ['peasant', 'pikeman', 'musketeer', 'lighthorse', 'dragoon', 'cuirassier', 'cannon'];
      types.forEach((t, k) => { const u = w.spawnUnit(t, 0, cx - 4 + k * 1.1, cz); u.ang = Math.PI / 2 + 0.6; u.state = 'idle'; const v = w.spawnUnit(t, 1, cx - 4 + k * 1.1, cz + 1.6); v.ang = -Math.PI / 2 + 0.6; });
      const p = w.spawnUnit('peasant', 0, cx - 5.5, cz + 0.8); p.carry = 8; p.carryRes = 1; p.state = 'gather'; p.sub = 'return'; p.job = { kind: 'tree', tile: 0 };
      const mk = w.spawnUnit('musketeer', 0, cx + 4, cz + 0.8); mk.state = 'attack'; mk.target = G.units.find(u => u.team === 1 && u.type === 'pikeman'); mk.aimT = 0.3; mk.cd = 0;
      w.CAM.tdist = w.CAM.dist = 7; w.CAM.tyaw = w.CAM.yaw = -0.35; w.centerOn(cx - 0.5, cz + 0.8);
      G.paused = true;
    }
    if (m === 'fight') {
      REVEAL = true;
      let cx = th.x + 14, cz = th.z - 12, best = 1e9;
      for (let z = 12; z < 116; z += 2) for (let x = 12; x < 116; x += 2) {
        let bad = 0; for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) { const i = (z + dz) * 128 + x + dx; if (G.tree[i] || G.terr[i] >= 3 || G.bocc[i] || G.dep[i]) bad++; }
        const sc = bad * 10 + Math.hypot(x - th.x, z - th.z); if (sc < best) { best = sc; cx = x; cz = z; }
      }
      const mk = (type, team, n, x0, z0) => { const out = []; for (let k = 0; k < n; k++) out.push(w.spawnUnit(type, team, x0 + (k % 8) * 0.65, z0 + Math.floor(k / 8) * 0.7)); return out; };
      const a = [...mk('pikeman', 0, 12, cx - 6, cz + 2), ...mk('musketeer', 0, 16, cx - 6, cz + 4), ...mk('lighthorse', 0, 4, cx - 9, cz + 1), ...mk('cannon', 0, 2, cx - 4, cz + 7)];
      const b = [...mk('pikeman', 1, 12, cx + 2, cz - 6), ...mk('musketeer', 1, 16, cx + 2, cz - 8), ...mk('cuirassier', 1, 5, cx + 6, cz - 4), ...mk('dragoon', 1, 4, cx + 6, cz - 10)];
      w.orderMove(a, cx, cz - 1, { amove: true }); w.orderMove(b, cx - 1, cz, { amove: true });
      for (let i = 0; i < 30 * 9; i++) { for (const u of G.units) { u.px = u.x; u.pz = u.z; u.pang = u.ang; } w.step(1 / 30); processSimFx(); updatePS(FX.soft, 1 / 30); updatePS(FX.add, 1 / 30); }
      w.CAM.tdist = w.CAM.dist = 15; w.CAM.tyaw = w.CAM.yaw = -0.5; w.centerOn(cx - 1, cz);
    }
  }, mode);
  if (mode === 'units') { await once(2); } else if (mode === 'fight') { await page.evaluate(() => { window.__wf.G.paused = false; }); for (let k = 0; k < 6; k++) await once(1); } else await once(3);
  await page.screenshot({ path: `out/shot_${mode}_q${q}.png` });
  console.log(errs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
