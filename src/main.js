// ================= game flow & main loop =================
const SIM_DT = 1 / 30;
let lastTs = 0, acc = 0, hudT = 0, miniT = 0, fogDirty = true, attract = true;
const OPTS = { ai: 1, diff: 1 };
function wireHooks() {
  HOOK.toast = (msg, kind) => { if (!attract) toast(msg, kind); };
  HOOK.sfx = (name, x, z) => { if (x !== undefined && !visibleAt(x, z) && !attract) return; sfx(name, x, z); };
  HOOK.event = (type, d) => {
    switch (type) {
      case 'placed': if (WORLD) terrainFlatten(d); break;
      case 'treefall': treeFell(d); break;
      case 'fog': fogDirty = true; break;
      case 'depleted': if (!attract && G.vis[idx(d.tx, d.tz)]) toast(`A ${d.type === 'berry' ? 'berry patch' : d.type + (d.type === 'gold' ? ' mine' : ' quarry')} is worked out`); break;
      case 'attacked': if (attract) break;
        if (G.t - UI.attackT > 14 || !UI.lastAlert || hyp(UI.lastAlert.x - d.x, UI.lastAlert.z - d.z) > 18) {
          if (G.t - UI.attackT > 4) { UI.attackT = G.t; showAlert(d.kind === 'b' ? `${d.d.name} under attack` : d.d.cls === 'worker' ? 'Peasants under attack' : 'Our men are engaged', d.x, d.z); sfx('horn'); }
        }
        break;
      case 'built': if (!attract && d.team === 0) { toast(`${d.d.name} completed`); sfx('built'); } break;
      case 'researched': if (!attract) { toast(`${TECH[d].name} researched`); sfx('research'); } break;
      case 'trained': if (!attract) sfx('trained'); break;
      case 'destroyed': if (attract) break; if (d.team === 0) toast(`Our ${d.d.name} has been destroyed`, 'bad'); else if (d.seen) toast(`Enemy ${d.d.name} razed`); break;
      case 'eliminated': if (attract) break; if (d.id === 0) toast('Our host is broken', 'bad'); else toast(`${d.name} is defeated`); break;
      case 'aiattack': if (!attract) toast(`Scouts report ${d.size} ${G.teams[d.team].name} soldiers marching on us`, 'warn'); break;
      case 'over': if (!attract) setTimeout(showEnd, 2200); break;
    }
  };
}
function resetVisuals() {
  clearBuildings();
  RV.clear();
  if (FX.soft) { FX.soft.n = 0; FX.add.n = 0; FX.decals.length = 0; FX.marks.length = 0; }
  for (const k in GHOST.cache) GHOST.cache[k].visible = false;
}
function setupWorld() {
  resetVisuals();
  resetWear();
  buildWorld();
  for (const b of G.builds) terrainFlatten(b);
  updateFogTex(); fogDirty = false;
  MINI.dirty = true;
}
function startAttract() {
  attract = true; REVEAL = true; U.fogOn.value = 0;
  newGame({ seed: 9047, players: 2, allAI: true, diff: 1, p0level: 1 });
  // let the towns grow a little before the curtain rises
  for (let i = 0; i < 30 * 200; i++) step(SIM_DT);
  G.vis.fill(2);
  setupWorld();
  const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
  CAM.tx = th.x + 3; CAM.tz = th.z - 2; CAM.tdist = CAM.dist = 22; CAM.tyaw = CAM.yaw = -0.6;
  G.paused = false; G.speed = 1;
}
function startBattle() {
  attract = false; REVEAL = false; U.fogOn.value = 1;
  UI.sel = []; UI.groups = {}; UI.place = null; UI.amode = false; UI.pings = []; UI.lastAlert = null; UI.attackT = -99; UI.inspect = null; UI.watch = false;
  const seed = (Date.now() % 1000000) | 0;
  newGame({ seed, players: 1 + OPTS.ai, diff: OPTS.diff });
  setupWorld();
  const th = G.builds.find(b => b.team === 0 && b.type === 'townhall');
  CAM.tyaw = CAM.yaw = -Math.PI / 4; CAM.tdist = CAM.dist = 26;
  centerOn(th.x + 2, th.z - 2);
  UI.speedI = 0; setSpeed();
  $('#start').hidden = true; $('#end').hidden = true; $('#pause').hidden = true; $('#tip').hidden = true;
  $('#top').hidden = false; $('#bar').hidden = false;
  G.paused = false;
  refreshPanel(true); hud();
  toast('Set your peasants to work. Right-click a forest, the berry bushes or a mine.');
  setTimeout(() => toast('Select peasants and pick a building from the grid to build.'), 4500);
  $('#game').focus();
}
function togglePause(on) {
  if (attract || (G.over && !UI.watch)) return;
  G.paused = on;
  $('#pause').hidden = !on;
  document.querySelectorAll('#p-q button').forEach(b => b.classList.toggle('on', +b.dataset.v === QUAL.level));
}
function showEnd() {
  const win = G.winner === G.teams[0].side;
  $('#end-title').textContent = win ? 'Victory' : 'Defeat';
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60);
  $('#end-lede').textContent = win ? `The rival towns are ash. The Wild Fields are yours after ${m} minutes ${s} seconds.` : `Our town hall has fallen after ${m} minutes ${s} seconds. The steppe belongs to others now.`;
  const rows = G.teams.map(t => `<tr><td><span class="swatch" style="background:${t.color}"></span>${t.name}${t.id === 0 ? ' (you)' : ''}</td><td>${t.stats.trained}</td><td>${t.stats.lost}</td><td>${t.stats.kills}</td><td>${t.stats.razed}</td><td>${t.stats.gathered.reduce((a, b) => a + b, 0)}</td><td>${t.stats.peak}</td></tr>`).join('');
  $('#endstats').innerHTML = `<thead><tr><th>Host</th><th>Raised</th><th>Lost</th><th>Killed</th><th>Razed</th><th>Gathered</th><th>Peak pop.</th></tr></thead><tbody>${rows}</tbody>`;
  $('#end').hidden = false;
  sfx(win ? 'victory' : 'defeat');
}
function segment(sel, fn) {
  document.querySelectorAll(sel + ' button').forEach(b => b.addEventListener('click', () => { document.querySelectorAll(sel + ' button').forEach(x => x.classList.remove('on')); b.classList.add('on'); fn(+b.dataset.v); }));
}
function setQuality(v) {
  const regrow = [0, 1, 3, 5][v] !== [0, 1, 3, 5][QUAL.level];
  QUAL.level = v; applyQuality();
  if (regrow && G.teams.length) setupWorld();
  try { localStorage.setItem('wf-quality', String(v)); } catch (_) { }
}
function frame(ts) {
  if (window.__wfHold && !window.__wfOnce) { requestAnimationFrame(frame); return; }
  window.__wfOnce = false;
  const real = window.__wfHold ? 0.05 : Math.min(0.1, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  let sdt = 0;
  if (!G.paused && (!G.over || attract)) {
    acc += real * G.speed;
    let n = 0;
    while (acc >= SIM_DT && n < 8) {
      for (const u of G.units) { u.px = u.x; u.pz = u.z; u.pang = u.ang; }
      step(SIM_DT); acc -= SIM_DT; n++; sdt += SIM_DT;
    }
    if (n === 8) acc = 0;
  }
  const alpha = clamp(acc / SIM_DT, 0, 1);
  U.time.value += real;
  adaptQuality(real);
  if (attract) { CAM.tyaw += real * 0.025; }
  else edgeScroll(real);
  updateCamera(real);
  updateGrass();
  if (!attract) updateWear(real * G.speed);
  if (fogDirty) { updateFogTex(); fogDirty = false; }
  syncBuildings(real, sdt);
  drawUnits(real, alpha);
  drawFx(real, alpha);
  updateFalling(real);
  if (UI.drag && UI.drag.active && UI.drag.a && UI.drag.b) formationPreview(UI.drag.a, UI.drag.b, false);
  updateGhost(UI.place);
  if (WORLD && WORLD.water) { const w = WORLD.water.material.uniforms; w.uFogC.value.copy(scene.fog.color); w.uFogN.value = scene.fog.near; w.uFogF.value = scene.fog.far; }
  if (BM.forge) BM.forge.emissiveIntensity = 2.4 + Math.sin(U.time.value * 13) * 0.5 + Math.sin(U.time.value * 7.3) * 0.4;
  if (composer) composer.render(); else renderer.render(scene, camera);
  if (!attract) drawOverlay(alpha); else if (octx) { octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, overlay.width, overlay.height); }
  if (!attract) {
    if ((hudT -= real) <= 0) { hudT = 0.2; hud(); refreshPanel(false); updateDeposits(); }
    if ((miniT -= real) <= 0) { miniT = 0.25; drawMinimap(); }
    $('#game').style.cursor = UI.place ? 'cell' : UI.amode ? 'crosshair' : 'default';
  } else if ((hudT -= real) <= 0) { hudT = 0.5; updateDeposits(); }
  musicTick();
  requestAnimationFrame(frame);
}
// step graphics down once if this machine cannot keep a playable frame rate
const PERF = { ema: 16, slow: 0, grace: 4 };
function adaptQuality(dt) {
  if (window.__wfHold || document.hidden || dt <= 0) return;
  if ((PERF.grace -= dt) > 0) return;
  PERF.ema = PERF.ema * 0.94 + dt * 1000 * 0.06;
  PERF.slow = PERF.ema > 42 ? PERF.slow + dt : Math.max(0, PERF.slow - dt);
  if (PERF.slow > 4 && QUAL.level > 0) {
    const to = QUAL.level - 1;
    PERF.slow = 0; PERF.ema = 16; PERF.grace = 6;
    setQuality(to);
    document.querySelectorAll('#o-q button, #p-q button').forEach(b => b.classList.toggle('on', +b.dataset.v === to));
    if (!attract) toast(`Graphics lowered to ${QUAL.names[to]} to keep the battle smooth. Change it in the menu.`);
  }
}
function boot() {
  if (!window.THREE) { $('#btn-start').textContent = 'The 3D engine did not load. Check your connection and reload.'; return; }
  try { const q = +localStorage.getItem('wf-quality'); if (q >= 0 && q <= 3 && localStorage.getItem('wf-quality') !== null) QUAL.level = q; } catch (_) { }
  document.querySelectorAll('#o-q button').forEach(b => b.classList.toggle('on', +b.dataset.v === QUAL.level));
  init3D();
  overlay = $('#overlay'); octx = overlay.getContext('2d');
  MINI.cv = $('#mini'); MINI.ctx = MINI.cv.getContext('2d');
  const btn = $('#btn-start');
  loadAssets(p => { btn.textContent = `Loading the steppe… ${Math.round(p * 100)}%`; }).then(ok => {
    const cr = document.querySelector('.credit');
    if (cr) cr.textContent = ok ? `Scanned rocks, plants, props and textures: Poly Haven (CC0) · ${Object.keys(ASSETS.geo).length} models loaded` + (ASSETS.fails ? ` · ${ASSETS.fails} files missing` : '') : 'Scanned assets did not load, so the built-in look is used. Reload the page to try again.';
    boot2();
  });
}
function boot2() {
  initFx(); initUnits(1400); bmats();
  resize();
  window.addEventListener('resize', resize);
  wireHooks();
  renderIcons();
  setupInput();
  segment('#o-ai', v => OPTS.ai = v);
  segment('#o-diff', v => OPTS.diff = v);
  segment('#o-q', v => setQuality(v));
  segment('#p-q', v => setQuality(v));
  segment('#p-snd', v => { AU.on = !!v; if (AU.master) AU.master.gain.value = v ? 0.55 : 0; });
  segment('#p-mus', v => { AU.music = !!v; if (AU.musBus) AU.musBus.gain.value = v ? 0.32 : 0; });
  $('#btn-start').addEventListener('click', () => { ensureAudio(); startBattle(); });
  $('#btn-resume').addEventListener('click', () => togglePause(false));
  $('#btn-restart').addEventListener('click', () => { $('#pause').hidden = true; G.paused = false; $('#top').hidden = true; $('#bar').hidden = true; $('#start').hidden = false; startAttract(); });
  $('#btn-quit').addEventListener('click', () => { $('#pause').hidden = true; G.paused = false; for (const b of G.builds) if (b.team === 0) b.hp = 0; for (const u of G.units) if (u.team === 0) u.hp = 0; G.builds = G.builds.filter(b => b.hp > 0); G.units = G.units.filter(u => u.hp > 0); checkTeams(); });
  $('#btn-again').addEventListener('click', () => { $('#end').hidden = true; $('#top').hidden = true; $('#bar').hidden = true; $('#start').hidden = false; startAttract(); });
  $('#btn-watch').addEventListener('click', () => { $('#end').hidden = true; UI.watch = true; });
  startAttract();
  $('#btn-start').disabled = false; $('#btn-start').textContent = 'Begin';
  requestAnimationFrame(frame);
  window.__wf = { G, CAM, UI, startBattle, step, BENT, RV, renderer, orderMove, spawnUnit, placeBuilding, setSel, smartCommand, QUAL, applyQuality, pickAt, project, startPlace, confirmPlace, queueUnit, FX, newGame, setupWorld, updateFog, centerOn, renderIcons };
}
window.addEventListener('load', boot);
