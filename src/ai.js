// ================= computer opponents =================
const AI_DIFF = {
  0: { name: 'Easy', peasants: 24, gather: 0.85, build: 0.9, train: 0.9, firstWave: 600, wave: 7, waveGrow: 3, cooldown: 200, barracksAt: 220, stableAt: 480, foundryAt: 900 },
  1: { name: 'Normal', peasants: 38, gather: 1.0, build: 1.0, train: 1.0, firstWave: 420, wave: 10, waveGrow: 4, cooldown: 150, barracksAt: 150, stableAt: 330, foundryAt: 620 },
  2: { name: 'Hard', peasants: 48, gather: 1.25, build: 1.15, train: 1.15, firstWave: 330, wave: 13, waveGrow: 5, cooldown: 120, barracksAt: 110, stableAt: 260, foundryAt: 480 },
};
function initAI(tm, level) {
  const D = AI_DIFF[level];
  tm.ai = true; tm.aiGather = D.gather; tm.aiBuild = D.build; tm.aiTrain = D.train;
  const th = G.builds.find(b => b.team === tm.id && b.type === 'townhall');
  tm.brain = { D, level, tick: rnd() * 0.5, home: { x: th.x, z: th.z }, waveN: 0, nextAttack: D.firstWave + rr(-30, 30), waves: [], regroupT: 0, lastBuild: -99, threatT: -99, rebalanceT: 30 };
}
function updateAllAI(dt) {
  for (const tm of G.teams) {
    if (!tm.ai || !tm.alive || !tm.brain) continue;
    const B = tm.brain;
    if ((B.tick -= dt) > 0) continue;
    B.tick = 0.5;
    aiThink(tm, B);
  }
}
function aiEnemyTeams(tm) { return G.teams.filter(o => o.alive && o.side !== tm.side); }
function aiThink(tm, B) {
  const me = tm.id, D = B.D;
  const units = G.units.filter(u => u.team === me);
  const builds = G.builds.filter(b => b.team === me && b.hp > 0);
  const has = (type, done = true) => builds.some(b => b.type === type && (!done || b.done));
  const count = (type, done = false) => builds.filter(b => b.type === type && (!done || b.done)).length;
  const peasants = units.filter(u => u.d.cls === 'worker');
  const army = units.filter(u => u.d.cls !== 'worker');
  const th = builds.find(b => b.type === 'townhall' && b.done) || builds.find(b => b.type === 'townhall');
  if (th) B.home = { x: th.x, z: th.z };
  const foe = aiEnemyTeams(tm);
  if (!foe.length) return;
  const foeDir = (() => { let fx = 0, fz = 0; for (const o of foe) { const s = G.starts[o.id] || { x: 64, z: 64 }; fx += s.x; fz += s.z; } return Math.atan2(fz / foe.length - B.home.z, fx / foe.length - B.home.x); })();
  B.rally = { x: B.home.x + Math.cos(foeDir) * 8, z: B.home.z + Math.sin(foeDir) * 8 };
  const r = tm.res;
  const reserve = [0, 0, 0, 0];

  // ---------- peasants ----------
  if (th && th.done && peasants.length < D.peasants && th.queue.length < 2 && r[F] >= 50 + (peasants.length > 12 ? 20 : 0)) queueUnit(th, 'peasant');
  // ---------- housing ----------
  const housing = builds.filter(b => (b.type === 'house' || b.type === 'townhall') && !b.done).length;
  if (tm.popCap < 250 && tm.pop + 5 + count('barracks', true) * 2 + count('stable', true) * 2 >= tm.popCap && housing < (tm.pop > 50 ? 2 : 1) && r[W] >= 60) aiBuild(tm, B, 'house', peasants, 1);
  // ---------- buildings ----------
  const t = G.t;
  const plan = [
    ['mill', () => t > 50 && !has('mill', false)],
    ['storehouse', () => t > 40 && aiNeedsStore(tm, 'wood')],
    ['barracks', () => t > D.barracksAt && !has('barracks', false)],
    ['storehouse', () => t > 120 && aiNeedsStore(tm, 'gold')],
    ['storehouse', () => t > 200 && aiNeedsStore(tm, 'stone')],
    ['farm', () => aiNeedsFarm(tm, peasants)],
    ['blacksmith', () => t > D.stableAt - 40 && !has('blacksmith', false)],
    ['stable', () => t > D.stableAt && !has('stable', false)],
    ['tower', () => t > D.stableAt + 60 && count('tower') < 1 + (B.level > 0 ? 1 : 0) && r[S] >= 200],
    ['foundry', () => t > D.foundryAt && has('blacksmith') && !has('foundry', false)],
    ['barracks', () => t > D.foundryAt - 100 && count('barracks') < 1 + B.level && r[W] > 300],
    ['church', () => t > D.foundryAt + 120 && !has('church', false) && r[S] > 250],
    ['stable', () => t > D.foundryAt + 200 && count('stable') < 2 && B.level === 2],
  ];
  const underway = builds.filter(b => !b.done && b.type !== 'house' && b.type !== 'farm').length;
  if (underway < 1 + (B.level === 2 ? 1 : 0)) {
    for (const [type, cond] of plan) {
      if (!cond()) continue;
      if (canAfford(me, BT[type].cost)) { aiBuild(tm, B, type, peasants, type === 'farm' ? 1 : 2); break; }
      if (type !== 'farm' && type !== 'storehouse') { for (let i = 0; i < 4; i++) reserve[i] = BT[type].cost[i]; break; }
    }
  }
  // unfinished sites with nobody on them get help
  for (const b of builds) if (!b.done && !G.units.some(u => u.bld === b)) { const w = aiPick(peasants, b, 1); orderBuild(w, b); }
  // rebuild a lost town hall
  if (!th && peasants.length && r[W] >= 350 && r[S] >= 250) aiBuild(tm, B, 'townhall', peasants, 4);

  // ---------- gather assignments ----------
  const counts = [0, 0, 0, 0];
  for (const u of peasants) if (u.state === 'gather' && u.job) counts[RES_OF[u.job.kind]]++;
  const n = peasants.length;
  const want = t < 200 ? [0.5, 0.42, 0.08, 0] : t < 600 ? [0.36, 0.38, 0.18, 0.08] : [0.32, 0.34, 0.22, 0.12];
  for (let i = 0; i < 4; i++) { const v = r[i] - reserve[i]; want[i] *= v < 120 ? 1.7 : v < 350 ? 1.2 : v < 700 ? 0.85 : v < 1400 ? 0.45 : 0.15; }
  { const s = want.reduce((a, b) => a + b, 0); for (let i = 0; i < 4; i++) want[i] /= s; }
  const idle = peasants.filter(u => u.state === 'idle');
  // fleeing peasants run home, then back to work
  for (const u of peasants) if (u.flee && t - u.flee < 1 && th) { const e = nearestEnemy(u, 5, { builds: false }); if (e && u.state !== 'move') { const job = u.job; u.prevJob = job; orderMove([u], th.x + rr(-2, 2), th.z + th.h / 2 + 1.5); } }
  for (const u of idle) {
    if (u.prevJob) { const j = u.prevJob; u.prevJob = null; if (!nearestEnemy(u, 7, { builds: false })) { orderGather([u], j); if (u.state === 'gather') continue; } }
    let best = 0, bd = -1e9;
    for (let i = 0; i < 4; i++) { const d = want[i] * Math.max(n, 6) - counts[i]; if (d > bd) { bd = d; best = i; } }
    if (aiAssign(tm, u, best)) counts[best]++;
    else for (let i = 0; i < 4; i++) if (i !== best && aiAssign(tm, u, i)) { counts[i]++; break; }
  }
  // slow rebalance of busy workers
  if ((B.rebalanceT -= 0.5) <= 0 && n > 8) {
    B.rebalanceT = 5;
    let hi = 0, lo = 0, hd = -1e9, ld = 1e9;
    for (let i = 0; i < 4; i++) { const d = counts[i] - want[i] * n; if (d > hd) { hd = d; hi = i; } if (d < ld) { ld = d; lo = i; } }
    if (hd > 2 && ld < -2) { const mover = peasants.find(u => u.state === 'gather' && u.job && RES_OF[u.job.kind] === hi && u.carry < 2); if (mover) aiAssign(tm, mover, lo); }
  }

  // ---------- research ----------
  const techPlan = [['tools', 160], ['plough', 300], ['wheelbarrow', 420], ['cartridge', 480], ['steelpikes', 560], ['cuirass', 640], ['barding', 760], ['ballistics', 820], ['heavyshot', 900], ['faith', 1000]];
  for (const [id, at] of techPlan) {
    if (t < at / (0.8 + B.level * 0.2) || tm.techs.has(id) || tm.researching.has(id)) continue;
    const b = builds.find(o => o.type === TECH[id].at && o.done && !o.research);
    if (b && canAfford(me, TECH[id].cost) && r[F] > 150) { startResearch(b, id); break; }
  }

  // ---------- army production ----------
  const armyBudget = (i) => r[i] - reserve[i] - (i === F ? 60 : 0);
  const comp = aiComposition(tm, B, army);
  for (const b of builds) {
    if (!b.done || !b.d.trains || b.type === 'townhall' || b.queue.length >= 2) continue;
    const choice = comp(b);
    if (!choice) continue;
    const c = UT[choice].cost;
    if (armyBudget(F) >= c[F] && armyBudget(W) >= c[W] && armyBudget(S) >= c[S] && armyBudget(Au) >= c[Au]) queueUnit(b, choice);
  }
  for (const b of builds) if (b.done && b.d.trains && b.type !== 'townhall' && !b.rally) b.rally = { x: B.rally.x + rr(-2, 2), z: B.rally.z + rr(-2, 2) };

  // ---------- defence ----------
  let threat = null, td = 1e9;
  for (const u of G.units) {
    if (!enemies(me, u.team)) continue;
    for (const b of builds) { const d = hyp(u.x - b.x, u.z - b.z); if (d < 13 && d < td) { td = d; threat = u; } }
  }
  const home = army.filter(u => !u.wave);
  if (threat) {
    B.threatT = t;
    for (const u of home) if (u.state === 'idle' || (u.state === 'move' && !u.amove)) engage(u, threat, true);
    // if the base is in real danger, call the attack wave back
    const near = G.units.filter(u => enemies(me, u.team) && hyp(u.x - threat.x, u.z - threat.z) < 8).length;
    if (near > home.length + 4) for (const u of army) if (u.wave && hyp(u.x - B.home.x, u.z - B.home.z) > 20) { u.wave = 0; orderMove([u], threat.x, threat.z, { amove: true }); }
  } else if ((B.regroupT -= 0.5) <= 0) {
    B.regroupT = 8;
    const strays = home.filter(u => u.state === 'idle' && hyp(u.x - B.rally.x, u.z - B.rally.z) > 6);
    if (strays.length) orderMove(strays, B.rally.x, B.rally.z, { amove: true, face: foeDir });
  }
  // ---------- attack waves ----------
  const ready = home.filter(u => u.state !== 'attack');
  const need = D.wave + B.waveN * D.waveGrow;
  if (t >= B.nextAttack && (ready.length >= need || (ready.length >= need * 0.6 && t > B.nextAttack + 180)) && !threat) {
    const target = aiTarget(tm, B, foe);
    if (target) {
      B.waveN++;
      for (const u of ready) u.wave = B.waveN;
      orderMove(ready, target.x, target.z, { amove: true });
      B.waves.push({ n: B.waveN, size: ready.length, t });
      B.nextAttack = t + D.cooldown;
      if (foe.some(o => o.id === 0)) HOOK.event('aiattack', { team: me, size: ready.length });
    }
  }
  // wave units that ran out of targets push to the next building
  for (const u of army) if (u.wave && u.state === 'idle') {
    const tgt = aiTarget(tm, B, foe, u);
    if (tgt) orderMove([u], tgt.x + rr(-1, 1), tgt.z + rr(-1, 1), { amove: true }); else u.wave = 0;
  }
}
function aiComposition(tm, B, army) {
  const n = { pikeman: 0, musketeer: 0, lighthorse: 0, dragoon: 0, cuirassier: 0, cannon: 0 };
  for (const u of army) n[u.type] = (n[u.type] || 0) + 1;
  const total = army.length || 1;
  return b => {
    if (b.type === 'barracks') {
      if (G.teams[b.team].res[Au] < 40) return 'pikeman';
      return n.pikeman / total < 0.38 ? 'pikeman' : 'musketeer';
    }
    if (b.type === 'stable') {
      const hasSmith = G.builds.some(o => o.team === b.team && o.type === 'blacksmith' && o.done);
      const cav = n.lighthorse + n.dragoon + n.cuirassier;
      if (cav / total > 0.35) return null;
      if (hasSmith && n.cuirassier < n.lighthorse * 0.6) return 'cuirassier';
      return n.dragoon < n.lighthorse * 0.5 ? 'dragoon' : 'lighthorse';
    }
    if (b.type === 'foundry') return n.cannon < 2 + B.level ? 'cannon' : null;
    return null;
  };
}
function aiTarget(tm, B, foe, from) {
  const ref = from || B.home;
  let best = null, bd = 1e9;
  for (const b of G.builds) {
    if (b.hp <= 0 || !enemies(tm.id, b.team)) continue;
    const d = hyp(b.x - ref.x, b.z - ref.z) + (b.type === 'farm' ? 6 : 0) + (b.type === 'tower' ? 4 : 0);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) for (const u of G.units) if (enemies(tm.id, u.team)) { const d = hyp(u.x - ref.x, u.z - ref.z); if (d < bd) { bd = d; best = u; } }
  return best ? { x: best.x, z: best.z } : null;
}
function aiPick(peasants, near, k) {
  const pool = peasants.filter(u => u.state !== 'build' && u.carry < 3).sort((a, b) => {
    const pa = a.state === 'idle' ? -50 : a.job && a.job.kind === 'farm' ? 30 : 0, pb = b.state === 'idle' ? -50 : b.job && b.job.kind === 'farm' ? 30 : 0;
    return pa + hyp(a.x - near.x, a.z - near.z) - pb - hyp(b.x - near.x, b.z - near.z);
  });
  return pool.slice(0, k);
}
function aiNeedsStore(tm, kind) {
  const drops = G.builds.filter(b => b.team === tm.id && b.d.drop && b.d.drop[kind === 'wood' ? W : kind === 'gold' ? Au : S]);
  const stores = G.builds.filter(b => b.team === tm.id && b.type === 'storehouse');
  if (stores.some(b => !b.done) || stores.length >= 2 + Math.floor(G.t / 300)) return false;
  if (kind === 'wood') {
    const busy = G.units.filter(u => u.team === tm.id && u.job && u.job.kind === 'tree');
    if (busy.length < 3) return false;
    let far = 0; for (const u of busy) { const d = Math.min(...drops.map(b => bDist(u.job.last || u, b))); if (d > 7) far++; }
    return busy.length >= 4 && far >= busy.length * 0.5;
  }
  const dep = findDepositNear(kind, tm.brain.home.x, tm.brain.home.z, 95);
  if (!dep) return false;
  return !drops.some(b => rectDist(dep.x, dep.z, b.tx, b.tz, b.w, b.h) < 6);
}
function aiNeedsFarm(tm, peasants) {
  const berries = findDepositNear('berry', tm.brain.home.x, tm.brain.home.z, 16);
  const onFood = peasants.filter(u => u.job && RES_OF[u.job.kind] === F).length;
  const farms = G.builds.filter(b => b.team === tm.id && b.type === 'farm');
  const free = farms.filter(b => !b.farmer || !b.done).length;
  if (free > 0) return false;
  if (berries && onFood <= 6) return false;
  return farms.length < 10 + Math.floor(peasants.length / 3) && G.builds.some(b => b.team === tm.id && (b.type === 'mill' || b.type === 'townhall') && b.done);
}
function aiAssign(tm, u, res) {
  const home = tm.brain.home;
  if (res === F) {
    const berry = findDepositNear('berry', home.x, home.z, 16);
    if (berry && G.units.filter(o => o.job && o.job.dep === berry).length < 3) { orderGather([u], { kind: 'berry', dep: berry }); return true; }
    const berry2 = findDepositNear('berry', home.x, home.z, 16);
    const farm = G.builds.filter(b => b.team === tm.id && b.type === 'farm' && b.done && !b.farmer).sort((a, b) => hyp(a.x - u.x, a.z - u.z) - hyp(b.x - u.x, b.z - u.z))[0];
    if (farm) { orderGather([u], { kind: 'farm', b: farm }); return u.state === 'gather'; }
    if (berry2) { orderGather([u], { kind: 'berry', dep: berry2 }); return true; }
    return false;
  }
  if (res === W) {
    const drops = G.builds.filter(b => b.team === tm.id && b.done && b.d.drop && b.d.drop[W]);
    let best = -1, bd = 1e9;
    for (const b of drops) { const t = findTreeNear(b.x, b.z, 14, b); if (t >= 0) { const d = hyp(t % N - b.x, ((t / N) | 0) - b.z) + (b.type === 'townhall' ? 2 : 0); if (d < bd) { bd = d; best = t; } } }
    if (best < 0) best = findTreeNear(u.x, u.z, 30, u);
    if (best < 0) best = findTreeNear(home.x, home.z, 60, home);
    if (best >= 0) { orderGather([u], { kind: 'tree', tile: best }); return true; }
    return false;
  }
  const kind = res === Au ? 'gold' : 'stone';
  const dep = findDepositNear(kind, home.x, home.z, 95);
  if (dep) { orderGather([u], { kind, dep }); return true; }
  return false;
}
function aiBuild(tm, B, type, peasants, k) {
  if (!canAfford(tm.id, BT[type].cost)) return null;
  const spot = aiSpot(tm, B, type);
  if (!spot) return null;
  pay(tm.id, BT[type].cost);
  const b = placeBuilding(type, tm.id, spot[0], spot[1], false);
  const w = aiPick(peasants, b, k);
  if (w.length) orderBuild(w, b);
  B.lastBuild = G.t;
  return b;
}
function aiSpot(tm, B, type) {
  const d = BT[type], home = B.home;
  let ax = home.x, az = home.z, r0 = 5, r1 = 14;
  const foeAng = Math.atan2((B.rally ? B.rally.z : 64) - home.z, (B.rally ? B.rally.x : 64) - home.x);
  let pref = null;
  if (type === 'farm') {
    const mill = G.builds.filter(b => b.team === tm.id && b.type === 'mill').sort((a, b) => hyp(a.x - home.x, a.z - home.z) - hyp(b.x - home.x, b.z - home.z))[0] || G.builds.find(b => b.team === tm.id && b.type === 'townhall');
    if (mill) { ax = mill.x; az = mill.z; r0 = 2.5; r1 = 9; }
  } else if (type === 'storehouse') {
    const want = ['wood', 'gold', 'stone'].find(k => aiNeedsStore(tm, k)) || 'wood';
    if (want === 'wood') {
      const busy = G.units.filter(u => u.team === tm.id && u.job && u.job.kind === 'tree');
      const ref = busy.length ? busy[(rnd() * busy.length) | 0].job.last || busy[0] : home;
      const t = findTreeNear(ref.x, ref.z, 12, ref);
      if (t >= 0) { ax = t % N + 0.5; az = ((t / N) | 0) + 0.5; r0 = 1.5; r1 = 7; }
    } else {
      const dep = findDepositNear(want, home.x, home.z, 95);
      if (dep) { ax = dep.x; az = dep.z; r0 = 2.5; r1 = 7; }
    }
  } else if (type === 'mill') { r0 = 6; r1 = 12; pref = foeAng + Math.PI; }
  else if (type === 'tower') { r0 = 6; r1 = 10; pref = foeAng + rr(-0.6, 0.6); }
  else if (type === 'house') { r0 = 5; r1 = 16; pref = foeAng + Math.PI + rr(-1.2, 1.2); }
  else if (type === 'barracks' || type === 'stable' || type === 'foundry') { r0 = 7; r1 = 16; pref = foeAng + rr(-0.8, 0.8); }
  else if (type === 'townhall') { r0 = 0; r1 = 14; }
  const cands = [];
  for (let rad = r0; rad <= r1; rad += 1) {
    const steps = Math.max(8, Math.ceil(rad * 6));
    for (let k = 0; k < steps; k++) {
      const a = k / steps * Math.PI * 2;
      const tx = Math.round(ax + Math.cos(a) * rad - d.w / 2), tz = Math.round(az + Math.sin(a) * rad - d.h / 2);
      cands.push([tx, tz, rad + (pref !== null ? Math.abs(angDiff(a, pref)) * 2.2 : 0) + rnd() * 1.5]);
    }
  }
  cands.sort((a, b) => a[2] - b[2]);
  for (const [tx, tz] of cands) if (canPlace(tm.id, type, tx, tz) && aiMargin(type, tx, tz)) return [tx, tz];
  return null;
}
function aiMargin(type, tx, tz) {
  const d = BT[type], m = 1;
  for (let z = tz - m; z < tz + d.h + m; z++) for (let x = tx - m; x < tx + d.w + m; x++) {
    if (x >= tx && x < tx + d.w && z >= tz && z < tz + d.h) continue;
    if (!inMap(x, z)) return false;
    const i = idx(x, z);
    if ((G.bblock[i] && type !== 'farm') || G.dep[i]) return false;
    if (G.bocc[i] && type !== 'farm') return false;
    if (type !== 'storehouse' && G.tree[i]) return false;
  }
  return true;
}
