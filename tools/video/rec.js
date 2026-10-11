// record the same seeded town in one build: frame-locked camera dolly, frames to disk as JPEG
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const [url, outDir, q = '2', nFrames = '360', W = '1080', H = '952'] = process.argv.slice(2);
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: +W, height: +H } });
  await page.addInitScript(q => { try { localStorage.setItem('wf-quality', q); } catch (_) { } window.__wfHold = true; }, q);
  page.on('pageerror', e => console.log('ERR', e.message));
  page.setDefaultTimeout(600000);
  await page.goto(url);
  await page.waitForFunction(() => { const b = document.querySelector('#btn-start'); return b && !b.disabled; });
  await page.evaluate(() => document.querySelector('#btn-start').click());
  await page.addStyleTag({ content: '#top,#bar,#toasts,#tip,#overlay,#alert,#miniwrap{display:none!important}' });
  const once = () => page.evaluate(() => new Promise(r => { window.__wfOnce = true; const chk = () => window.__wfOnce ? requestAnimationFrame(chk) : r(); requestAnimationFrame(chk); }));
  const t0 = Date.now();
  await page.evaluate(() => {
    const w = window.__wf, G = w.G;
    w.newGame({ seed: 424242, players: 2, diff: 1 });
    w.setupWorld();
    REVEAL = true; U.fogOn.value = 0;
    G.teams[0].ai = true; initAI(G.teams[0], 2); G.teams[0].res = [2000, 2000, 2000, 2000];
    for (let i = 0; i < 30 * 380; i++) { for (const u of G.units) { u.px = u.x; u.pz = u.z; u.pang = u.ang; } w.step(1 / 30); }
    G.paused = false; G.speed = 0.667;
    const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
    window.__th = { x: th.x, z: th.z };
    // a regiment marches through the town while the camera moves
    const army = [];
    const add = (t, n, x0, z0, cols) => { for (let k = 0; k < n; k++) { const x = x0 + (k % cols) * 0.6, z = z0 + Math.floor(k / cols) * 0.7; const [fx, fz] = [x, z]; army.push(w.spawnUnit(t, 0, fx, fz)); } };
    add('pikeman', 8, th.x - 7, th.z + 6.5, 4); add('musketeer', 8, th.x - 9.5, th.z + 6.5, 4); add('lighthorse', 4, th.x - 12.5, th.z + 6.8, 2);
    w.orderMove(army, th.x + 9, th.z - 1.5, { amove: false });
    // capture speed-ups that do not change the shot: drop trees far outside the frame, smaller shadow map
    const keep = (m, cx, cz, R) => { const a = m.instanceMatrix.array; let n = 0; for (let k = 0; k < m.count; k++) { const x = a[k * 16 + 12], z = a[k * 16 + 14]; if ((x - cx) ** 2 + (z - cz) ** 2 < R * R) { if (n !== k) { a.copyWithin(n * 16, k * 16, k * 16 + 16); if (m.instanceColor) m.instanceColor.array.copyWithin(n * 3, k * 3, k * 3 + 3); } n++; } } m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; };
    for (const T of WORLD.trees) for (const m of (T.parts || [T.mesh])) keep(m, th.x + 2, th.z, 26);
    WORLD.root.traverse(o => { if (o.isInstancedMesh && o.count > 300 && o !== WORLD.stumps) keep(o, th.x + 2, th.z, 26); });
    sun.shadow.mapSize.set(2048, 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  });
  console.log('sim done', (Date.now() - t0) / 1000);
  // a few warm-up frames so shaders compile and the camera settles
  const cam = k => page.evaluate(k => {
    const w = window.__wf, th = window.__th, e = k * k * (3 - 2 * k);
    w.CAM.minD = 4;
    w.CAM.yaw = w.CAM.tyaw = -0.95 + 0.55 * e;
    w.CAM.dist = w.CAM.tdist = 15 - 4.5 * e;
    w.centerOn(th.x - 2.5 + 6 * e, th.z + 3.5 - 4 * e);
  }, k);
  await cam(0); for (let i = 0; i < 4; i++) await once();
  const N = +nFrames;
  const T = +(process.env.FRAMES_SPAN || N);
  for (let f = 0; f < N; f++) {
    await cam(f / (N - 1));
    if (process.env.STEP) await page.evaluate(s => { window.__wf.G.speed = s; }, +process.env.STEP);
    await once();
    await page.screenshot({ path: `${outDir}/f${String(f).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 93 });
    if (f % 60 === 0) console.log('frame', f, (Date.now() - t0) / 1000);
  }
  await browser.close();
})();
