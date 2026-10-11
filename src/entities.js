// ================= units & buildings =================
const alive = e => e && e.hp > 0;
const isCav = u => u.kind === 'u' && u.d.cls === 'cav';
const isArmy = u => u.kind === 'u' && u.d.cls !== 'worker';
function rectDist(x, z, rx, rz, w, h) { const dx = Math.max(rx - x, 0, x - (rx + w)), dz = Math.max(rz - z, 0, z - (rz + h)); return hyp(dx, dz); }
const bDist = (u, b) => rectDist(u.x, u.z, b.tx, b.tz, b.w, b.h);
function edist(a, b) { return b.kind === 'b' ? bDist(a, b) : hyp(a.x - b.x, a.z - b.z) - b.d.r; }

function spawnUnit(type, t, x, z) {
  const d = UT[type], tm = G.teams[t];
  const maxhp = d.hp + (d.cls === 'cav' ? tm.mod.cavHp : 0);
  const u = {
    id: G.nextId++, kind: 'u', type, d, team: t, x, z, ang: rr(0, 6.28), hp: maxhp, maxhp,
    state: 'idle', path: null, field: null, goal: null, wp: null, face: null, target: null, amove: false, hold: false,
    cd: rr(0, 0.6), aimT: 0, fireT: -9, strikeT: -9, anim: rnd() * 10, mv: 0, carry: 0, carryRes: -1, job: null, bld: null,
    scan: rr(0, 0.5), repath: 0, lastHit: -9, stuck: 0, lastD: 1e9, run: 0, workT: 0, returnTo: null,
  };
  G.units.push(u);
  tm.pop += d.pop;
  return u;
}
function footprintOk(type, tx, tz) {
  const d = BT[type];
  if (tx < 1 || tz < 1 || tx + d.w > N - 1 || tz + d.h > N - 1) return false;
  let lo = 1e9, hi = -1e9;
  for (let z = tz; z < tz + d.h; z++) for (let x = tx; x < tx + d.w; x++) {
    const i = z * N + x;
    if (G.terr[i] >= 4 || G.tree[i] || G.dep[i] || G.bocc[i]) return false;
  }
  for (let z = tz; z <= tz + d.h; z++) for (let x = tx; x <= tx + d.w; x++) { const h = G.H[z * (N + 1) + x]; lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return hi - lo < 1.1;
}
function canPlace(t, type, tx, tz) {
  if (!footprintOk(type, tx, tz)) return false;
  const d = BT[type];
  if (!G.teams[t].ai) for (let z = tz; z < tz + d.h; z++) for (let x = tx; x < tx + d.w; x++) if (G.vis[z * N + x] === 0) return false;
  // no enemy soldiers standing on the spot
  for (const u of G.units) if (enemies(t, u.team) && u.x > tx - 0.3 && u.x < tx + d.w + 0.3 && u.z > tz - 0.3 && u.z < tz + d.h + 0.3) return false;
  return true;
}
function placeBuilding(type, t, tx, tz, done) {
  const d = BT[type];
  const b = {
    id: G.nextId++, kind: 'b', type, d, team: t, tx, tz, w: d.w, h: d.h, x: tx + d.w / 2, z: tz + d.h / 2,
    hp: done ? d.hp : Math.max(1, d.hp * 0.05), maxhp: d.hp, done: !!done, prog: done ? 1 : 0, queue: [], qt: 0, rally: null,
    research: null, rt: 0, cd: rr(0, 1), farmer: 0, seen: t === 0, anim: rnd() * 10, nb: 0, nbNext: 0, lastHit: -9, born: G.t,
  };
  // level the ground under it
  let sum = 0, n = 0;
  for (let z = tz; z <= tz + d.h; z++) for (let x = tx; x <= tx + d.w; x++) { sum += G.H[z * (N + 1) + x]; n++; }
  const avg = sum / n;
  for (let z = tz; z <= tz + d.h; z++) for (let x = tx; x <= tx + d.w; x++) G.H[z * (N + 1) + x] = avg;
  b.y = avg;
  for (let z = tz; z < tz + d.h; z++) for (let x = tx; x < tx + d.w; x++) { G.bocc[z * N + x] = b.id; if (!d.walk) G.bblock[z * N + x] = 1; }
  G.builds.push(b);
  if (done && d.pop) G.teams[t].popCap += d.pop;
  if (!d.walk) for (const u of G.units) if (u.x > tx - 0.2 && u.x < tx + d.w + 0.2 && u.z > tz - 0.2 && u.z < tz + d.h + 0.2) { const [fx, fz] = nearestFree(u.x | 0, u.z | 0); u.x = fx + 0.5; u.z = fz + 0.5; }
  HOOK.event('placed', b);
  return b;
}
function removeBuilding(b) {
  for (let z = b.tz; z < b.tz + b.h; z++) for (let x = b.tx; x < b.tx + b.w; x++) { const i = z * N + x; if (G.bocc[i] === b.id) { G.bocc[i] = 0; G.bblock[i] = 0; } }
  if (b.done && b.d.pop) G.teams[b.team].popCap -= b.d.pop;
  if (b.research) G.teams[b.team].researching.delete(b.research.id);
}

// ================= damage =================
function armorOf(t, kind) {
  if (t.kind === 'b') return t.d.armor || 0;
  const m = G.teams[t.team].mod, inf = t.d.cls === 'inf' ? m.infArmor : 0;
  return kind === 'melee' ? t.d.armor + inf : kind === 'pierce' ? t.d.parmor + inf : t.d.parmor * 0.5;
}
function bonusVs(src, t) {
  const b = src && src.d && src.d.bonus;
  if (!b) return 1;
  if (t.kind === 'b') return b.bld || 1;
  let k = 1;
  if (b.cav && t.d.cls === 'cav') k *= b.cav;
  if (b.ranged && t.d.ranged) k *= b.ranged;
  if (b.art && t.d.cls === 'art') k *= b.art;
  if (b.worker && t.d.cls === 'worker') k *= b.worker;
  return k;
}
function damage(t, dmg, src, kind) {
  if (!alive(t)) return;
  let k = bonusVs(src, t);
  if (t.kind === 'b') k *= kind === 'pierce' ? 0.12 : kind === 'melee' ? 0.45 : 1;
  const dealt = Math.max(1, dmg * k - armorOf(t, kind));
  t.hp -= dealt; t.lastHit = G.t;
  if (src && src.team !== undefined && G.teams[t.team]) {
    if (t.team === 0) HOOK.event('attacked', t);
    G.teams[t.team].lastAttacked = { t: G.t, x: t.x, z: t.z, by: src.team };
  }
  // fight back, and nearby idle friends join in
  if (t.kind === 'u' && alive(src) && src.kind === 'u') {
    if ((t.state === 'idle' || (t.state === 'move' && t.amove)) && canFight(t) && !t.hold) engage(t, src, true);
    if (t.d.cls === 'worker' && t.state !== 'attack' && G.teams[t.team].ai) t.flee = G.t;
  }
  if (t.hp <= 0) kill(t, src);
}
function canFight(u) { return u.kind === 'u' && (u.d.cls !== 'worker' || false); }
function kill(t, src) {
  t.hp = 0;
  const tm = G.teams[t.team];
  if (t.kind === 'u') {
    tm.pop -= t.d.pop; tm.stats.lost++;
    if (src && G.teams[src.team]) G.teams[src.team].stats.kills++;
    G.corpses.push({ type: t.type, team: t.team, x: t.x, z: t.z, ang: t.ang, t: G.t, id: t.id, carryRes: t.carryRes, fall: rnd() < 0.5 ? 1 : -1 });
    if (G.corpses.length > 260) G.corpses.shift();
    if (t.job && t.job.kind === 'farm' && alive(t.job.b) && t.job.b.farmer === t.id) t.job.b.farmer = 0;
    HOOK.sfx(t.d.cls === 'cav' ? 'horse' : 'die', t.x, t.z);
  } else {
    removeBuilding(t);
    if (src && G.teams[src.team]) G.teams[src.team].stats.razed++;
    G.fx.push({ t: 'collapse', x: t.x, z: t.z, w: t.w, h: t.h, life: 3, max: 3 });
    HOOK.sfx('collapse', t.x, t.z);
    HOOK.event('destroyed', t);
  }
}

// ================= orders =================
function clearOrder(u) { u.path = null; u.field = null; u.goal = null; u.wp = null; u.target = null; u.amove = false; u.job = null; u.bld = null; u.face = null; u.hold = false; u.returnTo = null; u.stuck = 0; u.flee = 0; releaseFarm(u); }
function releaseFarm(u) { if (u.job && u.job.kind === 'farm' && u.job.b && u.job.b.farmer === u.id) u.job.b.farmer = 0; }
const ROLE = u => u.d.cls === 'inf' ? (u.d.ranged ? 1 : 0) : u.d.cls === 'worker' ? 2 : u.d.cls === 'cav' ? 3 : 4;
const SPACING = [0.62, 0.62, 0.6, 1.05, 1.6];
function formationSlots(units, gx, gz, face, width) {
  const f = { x: Math.cos(face), z: Math.sin(face) }, r = { x: -f.z, z: f.x };
  const groups = [[], [], [], [], []];
  for (const u of units) groups[ROLE(u)].push(u);
  const blocks = [];
  let depth = 0;
  for (let gi = 0; gi < 5; gi++) {
    const list = groups[gi]; if (!list.length) continue;
    const sp = SPACING[gi];
    let cols = width ? Math.max(1, Math.round(width / sp)) : gi === 4 ? list.length : Math.ceil(Math.sqrt(list.length * (gi <= 1 ? 3 : 2)));
    cols = Math.min(cols, list.length);
    const rows = Math.ceil(list.length / cols);
    blocks.push({ list, sp, cols, rows, off: depth });
    depth += rows * sp + 0.5;
  }
  depth -= 0.5;
  const out = new Map();
  for (const B of blocks) {
    // frontmost units take the front row, then sort each row left to right
    const sorted = B.list.slice().sort((a, b) => (b.x * f.x + b.z * f.z) - (a.x * f.x + a.z * f.z));
    for (let row = 0; row < B.rows; row++) {
      const rowUnits = sorted.slice(row * B.cols, row * B.cols + B.cols).sort((a, b) => (a.x * r.x + a.z * r.z) - (b.x * r.x + b.z * r.z));
      const n = rowUnits.length;
      rowUnits.forEach((u, c) => {
        const lat = (c - (n - 1) / 2) * B.sp + (row % 2 ? B.sp * 0.25 : 0), back = B.off + row * B.sp - depth / 2;
        let x = gx + r.x * lat - f.x * back, z = gz + r.z * lat - f.z * back;
        if (blocked(x | 0, z | 0)) { const [fx, fz] = nearestFree(x | 0, z | 0, 6); x = fx + 0.3 + rnd() * 0.4; z = fz + 0.3 + rnd() * 0.4; }
        out.set(u, { x: clamp(x, 0.3, N - 0.3), z: clamp(z, 0.3, N - 0.3) });
      });
    }
  }
  return out;
}
function orderMove(units, gx, gz, opts = {}) {
  units = units.filter(u => u.hp > 0);
  if (!units.length) return;
  let cx = 0, cz = 0; for (const u of units) { cx += u.x; cz += u.z; } cx /= units.length; cz /= units.length;
  let face = opts.face;
  if (face === undefined) face = hyp(gx - cx, gz - cz) > 1.5 ? Math.atan2(gz - cz, gx - cx) : units[0].ang;
  const slots = units.length === 1 ? new Map([[units[0], { x: gx, z: gz }]]) : formationSlots(units, gx, gz, face, opts.width);
  const far = hyp(gx - cx, gz - cz) > 10 || units.length > 4;
  const field = far ? makeField(gx | 0, gz | 0) : null;
  for (const u of units) {
    clearOrder(u);
    u.state = 'move'; u.goal = slots.get(u); u.face = units.length > 1 ? face : null; u.amove = !!opts.amove; u.field = field;
    u.repath = 0; u.lastD = 1e9;
  }
}
function engage(u, t, auto) {
  if (!alive(t) || !canFight(u)) return;
  if (!auto) clearOrder(u);
  else if (!u.returnTo) u.returnTo = u.state === 'move' && u.goal ? { x: u.goal.x, z: u.goal.z, amove: u.amove, face: u.face } : { x: u.x, z: u.z };
  u.state = 'attack'; u.target = t; u.repath = 0; u.path = null; u.auto = !!auto;
}
function orderAttack(units, t) { for (const u of units) if (canFight(u)) engage(u, t, false); else if (u.d.cls === 'worker') engageWorker(u, t); }
function engageWorker(u, t) { clearOrder(u); u.state = 'attack'; u.target = t; u.repath = 0; }
function orderStop(units) { for (const u of units) { clearOrder(u); u.state = 'idle'; } }
function orderHold(units) { for (const u of units) { clearOrder(u); u.state = 'idle'; u.hold = true; } }
function orderGather(units, job) {
  for (const u of units) {
    if (u.d.cls !== 'worker') continue;
    clearOrder(u);
    u.state = 'gather'; u.job = Object.assign({}, job); u.sub = u.carry >= G.teams[u.team].mod.carry * 0.5 && u.carryRes !== RES_OF[job.kind] && u.carry > 0 ? 'return' : 'go';
    if (job.kind === 'farm') claimFarm(u, job.b);
    u.repath = 0; u.path = null;
  }
}
function claimFarm(u, b) {
  if (!alive(b)) return false;
  if (b.farmer && b.farmer !== u.id && G.units.some(o => o.id === b.farmer && o.hp > 0 && o.job && o.job.b === b)) {
    const other = G.builds.find(o => o.team === u.team && o.type === 'farm' && o.done && !o.farmer && hyp(o.x - b.x, o.z - b.z) < 12);
    if (!other) return false;
    b = other; u.job.b = b;
  }
  b.farmer = u.id; u.job.spot = { x: b.tx + 0.5 + rnd() * 2, z: b.tz + 0.5 + rnd() * 2 };
  return true;
}
function orderBuild(units, b) { for (const u of units) { if (u.d.cls !== 'worker') continue; clearOrder(u); u.state = 'build'; u.bld = b; u.repath = 0; } }
function jobFromTile(t, tx, tz) {
  if (!inMap(tx, tz)) return null;
  const i = idx(tx, tz);
  if (G.tree[i]) return { kind: 'tree', tile: i };
  if (G.dep[i]) { const d = G.deposits[G.dep[i] - 1]; return { kind: d.type, dep: d }; }
  return null;
}

// ================= movement =================
function speedOf(u) {
  let s = u.d.speed;
  if (u.d.cls === 'worker') s *= G.teams[u.team].mod.walk;
  const i = idx(clamp(u.x | 0, 0, N - 1), clamp(u.z | 0, 0, N - 1));
  if (G.terr[i] === 4) s *= 0.6;
  if (u.carry > 0 && u.d.cls === 'worker') s *= 0.92;
  return s;
}
// returns true when the unit reached (x,z)
function moveTo(u, x, z, dt, near = 0.1, budget = 6000) {
  const dx = x - u.x, dz = z - u.z, d = hyp(dx, dz);
  if (d <= near) { u.mv = 0; return true; }
  u.repath -= dt;
  const tx = u.x | 0, tz = u.z | 0, gx = clamp(x | 0, 0, N - 1), gz = clamp(z | 0, 0, N - 1);
  if (u.repath <= 0) {
    u.repath = 0.3 + rnd() * 0.2;
    if ((tx === gx && tz === gz) || los(tx, tz, gx, gz)) { u.wp = null; u.path = null; u.direct = true; }
    else {
      u.direct = false;
      u.wp = u.field && hyp(u.field.gx - gx, u.field.gz - gz) < 8 ? fieldStep(u.field, tx, tz) : null;
      const key = gx + gz * N;
      if (!u.wp && (!u.path || !u.path.length || u.pathGoal !== key) && (u.pathGoal !== key || G.t - (u.pathT || -9) > 1.2)) { u.path = findPath(tx, tz, gx, gz, budget); u.pathGoal = key; u.pathT = G.t; }
    }
  }
  let ax = x, az = z;
  if (!u.direct) {
    if (u.wp) { ax = u.wp.x; az = u.wp.z; if (hyp(ax - u.x, az - u.z) < 0.35) u.repath = 0; }
    else if (u.path && u.path.length) { ax = u.path[0].x; az = u.path[0].z; if (hyp(ax - u.x, az - u.z) < 0.3) { u.path.shift(); if (!u.path.length) u.repath = 0; } }
  }
  const ddx = ax - u.x, ddz = az - u.z, dd = hyp(ddx, ddz) || 1e-6;
  const sp = speedOf(u) * dt, step = Math.min(sp, d);
  const want = Math.atan2(ddz, ddx);
  u.ang = turnTo(u.ang, want, dt * (u.d.cls === 'cav' ? 6 : u.d.cls === 'art' ? 2.5 : 9));
  const k = Math.abs(angDiff(u.ang, want)) > 1.2 ? 0.35 : 1;
  const nx = u.x + ddx / dd * step * k, nz = u.z + ddz / dd * step * k;
  if (!blocked(nx | 0, nz | 0)) { u.x = nx; u.z = nz; }
  else if (!blocked(nx | 0, u.z | 0)) u.x = nx;
  else if (!blocked(u.x | 0, nz | 0)) u.z = nz;
  else u.repath = 0;
  u.mv = 1; u.anim += dt * speedOf(u) * 3.2;
  if (u.d.cls === 'cav') u.run += step;
  // stuck detection
  if (d > u.lastD - 0.01 * dt * 60) u.stuck += dt; else u.stuck = Math.max(0, u.stuck - dt);
  u.lastD = d;
  if (u.stuck > 1.2) { u.stuck = 0; u.repath = 0; u.path = null; u.wp = null; u.field = null; if (d < 1.4) return true; }
  return false;
}
function separate(dt) {
  const cell = 2, M = N / cell, grid = new Map();
  for (const u of G.units) { const k = ((u.x / cell) | 0) + ((u.z / cell) | 0) * M; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(u); }
  for (const u of G.units) {
    const cx = (u.x / cell) | 0, cz = (u.z / cell) | 0;
    for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
      const a = grid.get(cx + x + (cz + z) * M); if (!a) continue;
      for (const v of a) {
        if (v.id <= u.id) continue;
        const dx = v.x - u.x, dz = v.z - u.z, d = hyp(dx, dz) || 0.001, min = (u.d.r + v.d.r) * 0.92;
        if (d >= min) continue;
        const push = (min - d) * Math.min(1, dt * 8);
        const nx = dx / d, nz = dz / d;
        const um = u.mv ? 0.35 : 1, vm = v.mv ? 0.35 : 1, s = um + vm;
        shift(u, -nx * push * um / s, -nz * push * um / s);
        shift(v, nx * push * vm / s, nz * push * vm / s);
      }
    }
  }
}
function shift(u, dx, dz) { const nx = u.x + dx, nz = u.z + dz; if (!blocked(nx | 0, nz | 0)) { u.x = nx; u.z = nz; } }

// ================= spatial queries =================
const SH = { cell: 4, M: N / 4, cells: [] };
function buildHash() {
  const M = SH.M;
  if (!SH.cells.length) for (let i = 0; i < M * M; i++) SH.cells.push([]);
  for (const c of SH.cells) c.length = 0;
  for (const u of G.units) if (u.hp > 0) SH.cells[clamp((u.x / 4) | 0, 0, M - 1) + clamp((u.z / 4) | 0, 0, M - 1) * M].push(u);
}
function nearestEnemy(e, range, opts) {
  const M = SH.M, c0x = clamp(((e.x - range) / 4) | 0, 0, M - 1), c1x = clamp(((e.x + range) / 4) | 0, 0, M - 1), c0z = clamp(((e.z - range) / 4) | 0, 0, M - 1), c1z = clamp(((e.z + range) / 4) | 0, 0, M - 1);
  let best = null, bd = range;
  for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) for (const u of SH.cells[cx + cz * M]) {
    if (u.hp <= 0 || !enemies(e.team, u.team)) continue;
    let d = hyp(u.x - e.x, u.z - e.z);
    if (opts && opts.prefArmy && u.d.cls === 'worker') d += 2.5;
    if (d < bd) { bd = d; best = u; }
  }
  if (!best && (!opts || opts.builds !== false)) {
    for (const b of G.builds) { if (b.hp <= 0 || !enemies(e.team, b.team)) continue; const d = rectDist(e.x, e.z, b.tx, b.tz, b.w, b.h); if (d < bd) { bd = d; best = b; } }
  }
  return best;
}

// ================= unit brain =================
function attackRange(u) {
  const m = G.teams[u.team].mod;
  if (u.d.gun) return u.d.gun.range + m.range;
  if (u.d.art) return u.d.art.range + m.range;
  return u.d.melee.range;
}
function updateUnit(u, dt) {
  u.cd -= dt;
  u.mv = 0;
  switch (u.state) {
    case 'idle': {
      if (u.face !== null && u.face !== undefined) u.ang = turnTo(u.ang, u.face, dt * 4);
      if ((u.scan -= dt) <= 0) {
        u.scan = 0.45 + rnd() * 0.2;
        if (canFight(u)) {
          const t = nearestEnemy(u, u.hold ? attackRange(u) + u.d.r + 0.3 : u.d.sight, { prefArmy: true });
          if (t) engage(u, t, true);
        }
      }
      return;
    }
    case 'move': {
      if (u.amove && (u.scan -= dt) <= 0) {
        u.scan = 0.4 + rnd() * 0.2;
        const t = nearestEnemy(u, u.d.sight, { prefArmy: true });
        if (t) { engage(u, t, true); return; }
      }
      if (moveTo(u, u.goal.x, u.goal.z, dt, 0.12)) { u.state = 'idle'; u.field = null; u.path = null; }
      return;
    }
    case 'attack': return updateAttack(u, dt);
    case 'gather': return updateGather(u, dt);
    case 'build': return updateBuild(u, dt);
  }
}
function finishAttack(u) {
  const r = u.returnTo;
  u.target = null;
  if (r && u.auto) {
    u.returnTo = null; u.auto = false;
    if (hyp(r.x - u.x, r.z - u.z) > 0.6) { u.state = 'move'; u.goal = { x: r.x, z: r.z }; u.amove = !!r.amove; u.face = r.face; u.repath = 0; u.path = null; u.field = null; u.lastD = 1e9; return; }
  }
  u.state = 'idle';
}
function updateAttack(u, dt) {
  let t = u.target;
  if (!alive(t) || (t.kind === 'u' && u.team === 0 && false)) {
    const nt = (u.auto || u.amove || u.d.cls !== 'worker') ? nearestEnemy(u, u.d.sight, { prefArmy: true }) : null;
    if (nt && canFight(u)) { u.target = nt; t = nt; } else { finishAttack(u); return; }
  }
  // leash: auto-acquired units do not chase forever
  if (u.auto && u.returnTo && hyp(u.x - u.returnTo.x, u.z - u.returnTo.z) > (u.returnTo.amove ? 18 : 11)) { finishAttack(u); return; }
  const m = G.teams[u.team].mod;
  const d = edist(u, t) - u.d.r;
  const meleeR = u.d.melee ? u.d.melee.range : 0;
  const useGun = (u.d.gun || u.d.art) && !(d < 0.55 && u.d.melee);
  const rng = useGun ? attackRange(u) : meleeR;
  if (u.d.art && d < u.d.art.min) {
    // too close for the gun: look for something else in range
    const alt = nearestEnemy({ x: u.x, z: u.z, team: u.team }, attackRange(u), { prefArmy: true });
    if (alt && alt !== t && edist(u, alt) > u.d.art.min) { u.target = alt; return; }
  }
  if (d <= rng) {
    u.path = null; u.wp = null;
    const want = Math.atan2(t.z - u.z, t.x - u.x);
    u.ang = turnTo(u.ang, want, dt * (u.d.cls === 'art' ? 2 : 7));
    const facing = Math.abs(angDiff(u.ang, want)) < 0.3;
    if (useGun) {
      if (u.cd <= 0 && facing) {
        u.aimT += dt;
        if (u.aimT >= (u.d.art ? 0.6 : 0.45)) { fireGun(u, t); u.aimT = 0; u.cd = (u.d.art ? u.d.art.cd : u.d.gun.cd * m.reload) * rr(0.9, 1.1); }
      } else if (u.cd > 0) u.aimT = 0;
    } else if (u.cd <= 0 && facing) {
      let dmg = u.d.melee.dmg + (u.type === 'pikeman' ? m.pike : 0);
      if (u.d.cls === 'cav' && u.run > 3) dmg *= 1.6;
      u.run = 0;
      damage(t, dmg, u, 'melee');
      u.cd = u.d.melee.cd * rr(0.9, 1.1); u.strikeT = G.t;
      HOOK.sfx(u.d.cls === 'worker' ? 'hit' : u.type === 'pikeman' ? 'pike' : 'sabre', u.x, u.z);
    }
    return;
  }
  u.aimT = 0;
  // close in; a moving target is re-pathed every so often
  const tx = t.x, tz = t.z;
  if (t.kind === 'b') {
    const cx = clamp(u.x, t.tx, t.tx + t.w), cz = clamp(u.z, t.tz, t.tz + t.h);
    moveTo(u, cx, cz, dt, Math.max(0.05, rng * 0.8), 3500);
  } else {
    if (u.chaseT === undefined || (u.chaseT -= dt) <= 0 || hyp(tx - (u.chaseX || 0), tz - (u.chaseZ || 0)) > 2.5) { u.chaseT = 0.8; u.chaseX = tx; u.chaseZ = tz; u.repath = 0; }
    moveTo(u, tx, tz, dt, Math.max(0.05, rng * 0.85), 2500);
  }
}
function fireGun(u, t) {
  const m = G.teams[u.team].mod;
  const mh = u.d.cls === 'cav' ? 0.62 : u.d.art ? 0.32 : 0.42;
  const mx = u.x + Math.cos(u.ang) * (u.d.art ? 0.75 : 0.42), mz = u.z + Math.sin(u.ang) * (u.d.art ? 0.75 : 0.42);
  u.fireT = G.t;
  if (u.d.art) {
    launchBall(u, mx, mz, mh, t, u.d.art.dmg * m.cannon);
    G.fx.push({ t: 'cannonfire', x: mx, z: mz, h: mh, ang: u.ang, life: 0.25, max: 0.25 });
    HOOK.sfx('cannon', u.x, u.z);
    return;
  }
  shotAt(u, mx, mz, mh, t, u.d.gun.dmg, u.d.gun.acc, attackRange(u));
}
function shotAt(src, mx, mz, mh, t, dmg, acc, range) {
  const dist = edist(src, t);
  let p = acc * (1 - 0.38 * clamp(dist / range, 0, 1));
  if (t.kind === 'u' && t.mv) p *= 0.85;
  if (t.kind === 'b') p = 0.95;
  const hit = rnd() < p;
  const ang = Math.atan2(t.z - mz, t.x - mx);
  G.fx.push({ t: 'musket', x: mx, z: mz, h: mh, ang, life: 0.12, max: 0.12 });
  const hx = t.x + (hit ? rr(-0.1, 0.1) : rr(-0.8, 0.8)), hz = t.z + (hit ? rr(-0.1, 0.1) : rr(-0.8, 0.8));
  G.fx.push({ t: hit ? 'hit' : 'miss', x: hx, z: hz, h: hit ? (t.kind === 'b' ? 0.8 : 0.35) : 0.05, life: 0.3, max: 0.3, delay: dist / 70 });
  if (hit) damage(t, dmg, src, 'pierce');
  HOOK.sfx('musket', mx, mz);
}
function launchBall(u, mx, mz, mh, t, dmg) {
  const dist = hyp(t.x - mx, t.z - mz);
  const spread = dist * 0.055;
  const ax = t.x + rr(-spread, spread), az = t.z + rr(-spread, spread);
  const y0 = heightAt(mx, mz) + mh, y1 = heightAt(ax, az) + 0.25;
  const T = 0.5 + dist * 0.06, g = 9.8;
  G.projs.push({ t: 'ball', x: mx, y: y0, z: mz, vx: (ax - mx) / T, vz: (az - mz) / T, vy: (y1 - y0 + 0.5 * g * T * T) / T, team: u.team, src: u, dmg, bounce: 0, hit: new Set(), life: 6 });
}
function updateProjs(dt) {
  for (const p of G.projs) {
    p.life -= dt;
    p.vy -= 9.8 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (!inMap(p.x | 0, p.z | 0) || p.life <= 0) { p.dead = true; continue; }
    const gy = heightAt(p.x, p.z);
    // buildings stop the ball
    const bid = G.bocc[idx(p.x | 0, p.z | 0)];
    if (bid) {
      const b = G.builds.find(o => o.id === bid);
      if (b && b.hp > 0 && enemies(p.team, b.team) && !b.d.walk && p.y < gy + 1.4) {
        damage(b, p.dmg, p.src && p.src.hp > 0 ? p.src : { d: UT.cannon, team: p.team }, 'blast');
        G.fx.push({ t: 'impact', x: p.x, z: p.z, h: p.y - gy, big: 1, life: 1, max: 1 }); HOOK.sfx('crash', p.x, p.z);
        p.dead = true; continue;
      }
    }
    if (p.bounce > 0 && p.y < gy + 0.45) {
      for (const u of G.units) {
        if (u.hp <= 0 || !enemies(p.team, u.team) || p.hit.has(u.id)) continue;
        if (Math.abs(u.x - p.x) < 0.35 + u.d.r && Math.abs(u.z - p.z) < 0.35 + u.d.r) { p.hit.add(u.id); damage(u, p.dmg * 0.5, p.src && p.src.hp > 0 ? p.src : { d: UT.cannon, team: p.team }, 'blast'); }
      }
    }
    if (p.y <= gy) {
      p.y = gy;
      if (p.bounce === 0) {
        const R = UT.cannon.art.splash;
        for (const u of G.units) {
          if (u.hp <= 0 || !enemies(p.team, u.team)) continue;
          const d = hyp(u.x - p.x, u.z - p.z);
          if (d < R + u.d.r) { p.hit.add(u.id); damage(u, p.dmg * (d < 0.4 ? 1 : 0.55), p.src && p.src.hp > 0 ? p.src : { d: UT.cannon, team: p.team }, 'blast'); }
        }
        G.fx.push({ t: 'impact', x: p.x, z: p.z, h: 0, life: 1, max: 1 });
        HOOK.sfx('thud', p.x, p.z);
      } else G.fx.push({ t: 'skip', x: p.x, z: p.z, h: 0, life: 0.6, max: 0.6 });
      p.bounce++;
      const terr = G.terr[idx(p.x | 0, p.z | 0)];
      if (terr >= 4) { G.fx.push({ t: 'splash', x: p.x, z: p.z, h: 0, life: 1, max: 1 }); p.dead = true; continue; }
      p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.6; p.vz *= 0.6;
      if (p.bounce > 3 || hyp(p.vx, p.vz) < 1.2) p.dead = true;
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
}

// ================= gathering & building =================
function dropFor(u, res) {
  let best = null, bd = 1e9;
  for (const b of G.builds) if (b.team === u.team && b.done && b.hp > 0 && b.d.drop && b.d.drop[res]) { const d = bDist(u, b); if (d < bd) { bd = d; best = b; } }
  return best;
}
function findTreeNear(x, z, r, from) {
  let best = -1, bd = 1e9;
  const cx = x | 0, cz = z | 0;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const tx = cx + dx, tz = cz + dz;
    if (!inMap(tx, tz)) continue;
    const i = tz * N + tx;
    if (!G.tree[i]) continue;
    // needs an open side to stand on
    if (blocked(tx + 1, tz) && blocked(tx - 1, tz) && blocked(tx, tz + 1) && blocked(tx, tz - 1)) continue;
    const d = hyp(tx + 0.5 - from.x, tz + 0.5 - from.z) + hyp(dx, dz) * 0.5;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function findDepositNear(type, x, z, r) {
  let best = null, bd = r;
  for (const d of G.deposits) if (d.type === type && d.amt > 0) { const dd = hyp(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = d; } }
  return best;
}
function jobValid(u) {
  const j = u.job;
  if (!j) return false;
  if (j.kind === 'tree') return G.tree[j.tile] > 0;
  if (j.kind === 'farm') return alive(j.b) && j.b.done && (!j.b.farmer || j.b.farmer === u.id);
  return j.dep && j.dep.amt > 0;
}
function retarget(u) {
  const j = u.job, from = { x: u.x, z: u.z };
  if (j.kind === 'tree') { const ref = j.last || from; const t = findTreeNear(ref.x, ref.z, 9, from); if (t >= 0) { j.tile = t; return true; } return false; }
  if (j.kind === 'farm') { const b = G.builds.find(o => o.team === u.team && o.type === 'farm' && o.done && o.hp > 0 && !o.farmer && hyp(o.x - u.x, o.z - u.z) < 16); if (b) { j.b = b; b.farmer = u.id; j.spot = { x: b.tx + 0.5 + rnd() * 2, z: b.tz + 0.5 + rnd() * 2 }; return true; } return false; }
  const d = findDepositNear(j.kind, (j.dep || u).x, (j.dep || u).z, j.kind === 'berry' ? 10 : 22);
  if (d) { j.dep = d; return true; }
  return false;
}
// a free tile next to the resource, closest to the worker
function standPoint(u, rx, rz, w, h) {
  let best = null, bd = 1e9;
  for (let z = rz - 1; z <= rz + h; z++) for (let x = rx - 1; x <= rx + w; x++) {
    if (x >= rx && x < rx + w && z >= rz && z < rz + h) continue;
    if (blocked(x, z)) continue;
    const cx = clamp(x + 0.5, rx - 0.3, rx + w + 0.3), cz = clamp(z + 0.5, rz - 0.3, rz + h + 0.3);
    const d = hyp(cx - u.x, cz - u.z) + (x !== rx - 1 && x !== rx + w || z !== rz - 1 && z !== rz + h ? 0 : 0.4) + rnd() * 0.3;
    if (d < bd) { bd = d; best = { x: cx, z: cz }; }
  }
  return best;
}
function jobTarget(u) {
  const j = u.job;
  if (j.kind === 'farm') return j.spot;
  const key = j.kind === 'tree' ? j.tile : j.dep.id + 1e6;
  if (!j.stand || j.standKey !== key) {
    j.standKey = key;
    j.stand = j.kind === 'tree' ? standPoint(u, j.tile % N, (j.tile / N) | 0, 1, 1) : standPoint(u, j.dep.tx, j.dep.tz, j.dep.w, j.dep.h);
  }
  if (j.stand) return j.stand;
  return j.kind === 'tree' ? { x: j.tile % N + 0.5, z: ((j.tile / N) | 0) + 0.5 } : { x: j.dep.x, z: j.dep.z };
}
function faceTarget(u) {
  const j = u.job;
  if (j.kind === 'farm') return { x: j.spot.x + Math.cos(u.ang), z: j.spot.z + Math.sin(u.ang) };
  if (j.kind === 'tree') return { x: j.tile % N + 0.5, z: ((j.tile / N) | 0) + 0.5 };
  return { x: clamp(u.x, j.dep.tx, j.dep.tx + j.dep.w), z: clamp(u.z, j.dep.tz, j.dep.tz + j.dep.h) };
}
function jobReach(u) {
  const j = u.job;
  if (j.kind === 'tree') return rectDist(u.x, u.z, j.tile % N, (j.tile / N) | 0, 1, 1) < u.d.r + 0.35;
  if (j.kind === 'farm') return hyp(u.x - j.spot.x, u.z - j.spot.z) < 0.18;
  return rectDist(u.x, u.z, j.dep.tx, j.dep.tz, j.dep.w, j.dep.h) < u.d.r + 0.35;
}
function updateGather(u, dt) {
  const tm = G.teams[u.team], m = tm.mod, res = RES_OF[u.job.kind];
  if (u.sub === 'return') {
    const b = u.drop && alive(u.drop) && u.drop.done ? u.drop : (u.drop = dropFor(u, u.carryRes >= 0 ? u.carryRes : res));
    if (!b) { u.state = 'idle'; if (u.team === 0) HOOK.toast('Build a Storehouse or Windmill to drop off ' + RES[u.carryRes >= 0 ? u.carryRes : res], 'warn'); return; }
    if (bDist(u, b) < u.d.r + 0.35) {
      const amt = Math.floor(u.carry + 1e-6);
      if (u.carryRes >= 0) { tm.res[u.carryRes] += amt; tm.stats.gathered[u.carryRes] += amt; }
      u.carry = 0; u.carryRes = -1; u.sub = 'go'; u.path = null; u.repath = 0; u.lastD = 1e9;
      return;
    }
    const cx = clamp(u.x, b.tx, b.tx + b.w), cz = clamp(u.z, b.tz, b.tz + b.h);
    moveTo(u, cx, cz, dt, u.d.r + 0.25);
    return;
  }
  if (!jobValid(u) && !retarget(u)) {
    if (u.carry >= 1) { u.sub = 'return'; return; }
    releaseFarm(u); u.state = 'idle'; u.job = null; return;
  }
  if (u.sub === 'go') {
    if (jobReach(u)) { u.sub = 'work'; u.workT = 0; u.path = null; return; }
    const p = jobTarget(u);
    if (moveTo(u, p.x, p.z, dt, 0.12) && !jobReach(u)) {
      // could not reach this one: try a different spot next time
      u.job.stand = null;
      if (u.job.kind === 'tree') { u.job.last = { x: u.x, z: u.z }; const t = findTreeNear(u.x, u.z, 4, u); if (t >= 0 && t !== u.job.tile) u.job.tile = t; }
      u.repath = 0; u.path = null;
    }
    return;
  }
  // work
  const p = faceTarget(u);
  u.ang = turnTo(u.ang, Math.atan2(p.z - u.z, p.x - u.x), dt * 6);
  if (u.job.kind === 'farm') u.ang += 0;
  u.workT += dt; u.anim += dt * 5;
  if (u.carryRes !== res) { u.carry = 0; u.carryRes = res; }
  let rate = GATHER[u.job.kind] * m.gather * (u.job.kind === 'farm' ? m.farm : 1) * (tm.ai ? tm.aiGather || 1 : 1);
  let got = rate * dt;
  if (u.job.kind === 'tree') { const i = u.job.tile; got = Math.min(got, G.tree[i]); G.tree[i] = Math.max(0, G.tree[i] - got); u.job.last = { x: i % N + 0.5, z: ((i / N) | 0) + 0.5 }; if (G.tree[i] <= 0.0001) { G.tree[i] = 0; HOOK.event('treefall', i); } if (rnd() < dt * 1.3) HOOK.sfx('chop', u.x, u.z); }
  else if (u.job.kind !== 'farm') { const d = u.job.dep; got = Math.min(got, d.amt); d.amt -= got; if (d.amt <= 0.0001) depleteDeposit(d); if (rnd() < dt * 1.2) HOOK.sfx(u.job.kind === 'berry' ? 'rustle' : 'pick', u.x, u.z); }
  u.carry += got;
  if (u.carry >= m.carry - 1e-6 || (!jobValid(u) && u.carry >= 1)) { u.sub = 'return'; u.drop = null; u.path = null; u.repath = 0; u.lastD = 1e9; }
}
function depleteDeposit(d) {
  d.amt = 0;
  for (let z = 0; z < d.h; z++) for (let x = 0; x < d.w; x++) G.dep[idx(d.tx + x, d.tz + z)] = 0;
  HOOK.event('depleted', d);
}
function updateBuild(u, dt) {
  const b = u.bld;
  if (!alive(b) || (b.done && b.hp >= b.maxhp)) { const nb = b; u.state = 'idle'; u.bld = null; if (alive(nb)) afterBuild(u, nb); return; }
  const reach = b.d.walk ? 0.05 : u.d.r + 0.35;
  if (bDist(u, b) > reach) {
    const cx = b.d.walk ? b.x : clamp(u.x, b.tx, b.tx + b.w), cz = b.d.walk ? b.z : clamp(u.z, b.tz, b.tz + b.h);
    if (moveTo(u, cx, cz, dt, reach * 0.8) && bDist(u, b) > reach + 0.6) { u.repath = 0; u.path = null; }
    return;
  }
  u.ang = turnTo(u.ang, Math.atan2(b.z - u.z, b.x - u.x), dt * 6);
  u.workT += dt; u.anim += dt * 6;
  b.nbNext++;
  const n = Math.max(1, b.nb), k = 1 / Math.pow(n, 0.3);
  if (!b.done) {
    const step = dt / b.d.time * k * (G.teams[u.team].ai ? G.teams[u.team].aiBuild || 1 : 1);
    b.prog += step; b.hp = Math.min(b.maxhp, b.hp + b.maxhp * step * 0.95);
    if (rnd() < dt * 1.5) HOOK.sfx('hammer', u.x, u.z);
    if (b.prog >= 1) finishBuilding(b);
  } else {
    b.hp = Math.min(b.maxhp, b.hp + b.maxhp * dt / (b.d.time * 2.5) * k);
    if (rnd() < dt * 1.2) HOOK.sfx('hammer', u.x, u.z);
  }
}
function finishBuilding(b) {
  b.done = true; b.prog = 1;
  const tm = G.teams[b.team];
  if (b.d.pop) tm.popCap += b.d.pop;
  tm.stats.built++;
  HOOK.event('built', b);
}
function afterBuild(u, b) {
  if (b.type === 'farm' && !b.farmer) { orderGather([u], { kind: 'farm', b }); return; }
  if (b.type === 'storehouse' || b.type === 'mill' || b.type === 'townhall') {
    const want = b.type === 'mill' ? 'farm' : null;
    if (want) { const f = G.builds.find(o => o.team === u.team && o.type === 'farm' && o.done && !o.farmer && hyp(o.x - b.x, o.z - b.z) < 10); if (f) { orderGather([u], { kind: 'farm', b: f }); return; } }
    const t = findTreeNear(b.x, b.z, 7, b), dep = ['gold', 'stone'].map(k => findDepositNear(k, b.x, b.z, 7)).find(Boolean);
    if (dep && (!t || t < 0 || hyp(dep.x - b.x, dep.z - b.z) < 5)) orderGather([u], { kind: dep.type, dep });
    else if (t >= 0) orderGather([u], { kind: 'tree', tile: t });
    return;
  }
  // other builders look for the next unfinished site nearby
  const site = G.builds.find(o => o.team === u.team && !o.done && o.hp > 0 && hyp(o.x - u.x, o.z - u.z) < 10);
  if (site) orderBuild([u], site);
}

// ================= production & research =================
function queueUnit(b, type) {
  const d = UT[type], tm = G.teams[b.team];
  if (!b.done) return false;
  if (d.needs && !G.builds.some(o => o.team === b.team && o.type === d.needs && o.done)) { if (b.team === 0) HOOK.toast(`Build an ${BT[d.needs].name} first`, 'warn'); return false; }
  if (b.queue.length >= 8) { if (b.team === 0) HOOK.toast('The queue is full', 'warn'); return false; }
  if (!canAfford(b.team, d.cost)) { if (b.team === 0) { HOOK.toast(needText(b.team, d.cost), 'warn'); HOOK.sfx('no'); } return false; }
  pay(b.team, d.cost); b.queue.push(type);
  return true;
}
function cancelQueue(b) { if (!b.queue.length) return; const t = b.queue.pop(); refund(b.team, UT[t].cost); if (!b.queue.length) b.qt = 0; }
function startResearch(b, id) {
  const T = TECH[id], tm = G.teams[b.team];
  if (!b.done || b.research || tm.techs.has(id) || tm.researching.has(id)) return false;
  if (!canAfford(b.team, T.cost)) { if (b.team === 0) { HOOK.toast(needText(b.team, T.cost), 'warn'); HOOK.sfx('no'); } return false; }
  pay(b.team, T.cost); b.research = { id, t: 0 }; tm.researching.add(id);
  return true;
}
function cancelResearch(b) { if (!b.research) return; refund(b.team, TECH[b.research.id].cost); G.teams[b.team].researching.delete(b.research.id); b.research = null; }
function applyTech(t, id) {
  const tm = G.teams[t], m = tm.mod;
  tm.techs.add(id); tm.researching.delete(id);
  switch (id) {
    case 'tools': m.gather *= 1.2; break;
    case 'wheelbarrow': m.carry = 15; m.walk = 1.1; break;
    case 'plough': m.farm *= 1.3; break;
    case 'cartridge': m.reload *= 0.75; break;
    case 'steelpikes': m.pike += 4; break;
    case 'cuirass': m.infArmor += 1; break;
    case 'barding': m.cavHp += 25; for (const u of G.units) if (u.team === t && u.d.cls === 'cav') { u.maxhp += 25; u.hp += 25; } break;
    case 'ballistics': m.range += 1; break;
    case 'heavyshot': m.cannon *= 1.3; break;
    case 'faith': m.heal = 2; m.healR = 3; break;
  }
  if (t === 0) HOOK.event('researched', id);
}
function doorSpot(b) {
  const [fx, fz] = nearestFree(Math.round(b.x - 0.5), b.tz + b.h, 8);
  return { x: fx + 0.5 + rr(-0.2, 0.2), z: fz + 0.5 + rr(-0.2, 0.2) };
}
function updateBuilding(b, dt) {
  b.nb = b.nbNext; b.nbNext = 0;
  if (!b.done) return;
  const tm = G.teams[b.team], d = b.d;
  if (b.queue.length) {
    const ut = UT[b.queue[0]];
    if (tm.pop + ut.pop > Math.min(tm.popCap, 250)) { if (b.team === 0 && (!b.popWarn || G.t - b.popWarn > 20)) { b.popWarn = G.t; HOOK.toast(tm.popCap >= 250 ? 'Population is at the 250 limit' : 'Not enough housing. Build a House', 'warn'); } }
    else {
      b.qt += dt * (tm.ai ? tm.aiTrain || 1 : 1);
      if (b.qt >= ut.time) {
        b.qt = 0;
        const type = b.queue.shift(), p = doorSpot(b);
        const u = spawnUnit(type, b.team, p.x, p.z);
        u.ang = Math.PI / 2;
        tm.stats.trained++;
        if (b.team === 0) HOOK.event('trained', u);
        if (b.rally) {
          const r = b.rally;
          if (u.d.cls === 'worker' && r.job) orderGather([u], r.job);
          else if (u.d.cls === 'worker' && r.build && alive(r.build)) orderBuild([u], r.build);
          else orderMove([u], r.x, r.z, { amove: u.d.cls !== 'worker' });
        } else if (u.d.cls === 'worker' && !tm.ai) autoJob(u);
      }
    }
  }
  if (b.research) {
    b.research.t += dt * (tm.ai ? tm.aiTrain || 1 : 1);
    if (b.research.t >= TECH[b.research.id].time) { const id = b.research.id; b.research = null; applyTech(b.team, id); }
  }
  if (d.gun && (b.cd -= dt) <= 0) {
    const rng = d.gun.range + tm.mod.range;
    if (!alive(b.tgt) || hyp(b.tgt.x - b.x, b.tgt.z - b.z) > rng + 1) b.tgt = nearestEnemy({ x: b.x, z: b.z, team: b.team }, rng + Math.max(b.w, b.h) / 2, { builds: false });
    if (b.tgt) {
      const t = b.tgt, a = Math.atan2(t.z - b.z, t.x - b.x), off = Math.max(b.w, b.h) * 0.42;
      b.aim = a;
      shotAt({ x: b.x, z: b.z, team: b.team, d: { r: 0 }, kind: 'b' }, b.x + Math.cos(a) * off, b.z + Math.sin(a) * off, b.type === 'tower' ? 2.5 : 1.9, t, d.gun.dmg, d.gun.acc, rng);
      b.cd = d.gun.cd * tm.mod.reload * rr(0.85, 1.15);
    } else b.cd = 0.5;
  }
  if (d.heal && (b.cd -= dt) <= 0) {
    b.cd = 1;
    const r = d.heal.r + tm.mod.healR;
    for (const u of G.units) if (u.team === b.team && u.hp < u.maxhp && hyp(u.x - b.x, u.z - b.z) < r) { u.hp = Math.min(u.maxhp, u.hp + d.heal.rate * tm.mod.heal); if (rnd() < 0.3) G.fx.push({ t: 'heal', x: u.x, z: u.z, h: 0.6, life: 1, max: 1 }); }
  }
}
function autoJob(u) {
  const t = findTreeNear(u.x, u.z, 10, u);
  if (t >= 0) orderGather([u], { kind: 'tree', tile: t });
}

// ================= fog of war (player view) =================
function updateFog() {
  const V = G.vis;
  for (let i = 0; i < V.length; i++) if (V[i] === 2) V[i] = 1;
  const mark = (x, z, r) => {
    const cx = x | 0, cz = z | 0, r2 = r * r;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r2 && inMap(cx + dx, cz + dz)) V[(cz + dz) * N + cx + dx] = 2;
  };
  for (const u of G.units) if (u.team === 0 || (G.teams[u.team].side === G.teams[0].side)) mark(u.x, u.z, u.d.sight);
  for (const b of G.builds) if (b.team === 0 || G.teams[b.team].side === G.teams[0].side) mark(b.x, b.z, b.d.sight + (b.done ? 0 : -2));
  for (const b of G.builds) if (!b.seen && tileSeen(b)) b.seen = true;
  HOOK.event('fog');
}
function tileSeen(b) { for (let z = b.tz; z < b.tz + b.h; z++) for (let x = b.tx; x < b.tx + b.w; x++) if (G.vis[z * N + x] === 2) return true; return false; }
const visibleAt = (x, z) => { if (REVEAL) return true; const tx = x | 0, tz = z | 0; return inMap(tx, tz) && G.vis[tz * N + tx] === 2; };

// ================= victory =================
const KEEP_ALIVE = { townhall: 1, barracks: 1, stable: 1, foundry: 1 };
function checkTeams() {
  for (const tm of G.teams) {
    if (!tm.alive) continue;
    const ok = G.builds.some(b => b.team === tm.id && b.hp > 0 && KEEP_ALIVE[b.type]) || G.units.some(u => u.team === tm.id && u.d.cls === 'worker');
    if (!ok) {
      tm.alive = false;
      HOOK.event('eliminated', tm);
      for (const u of G.units) if (u.team === tm.id) u.hp = Math.min(u.hp, 0.01);
    }
  }
  const sides = new Set(G.teams.filter(t => t.alive).map(t => t.side));
  if (sides.size <= 1 && !G.over) { G.over = true; G.winner = [...sides][0] === undefined ? -1 : [...sides][0]; HOOK.event('over', G.winner); }
}

// ================= main step =================
let fogT = 0, checkT = 0;
function step(dt) {
  G.t += dt;
  buildHash();
  for (const u of G.units) if (u.hp > 0) updateUnit(u, dt);
  for (const b of G.builds) if (b.hp > 0) updateBuilding(b, dt);
  updateProjs(dt);
  separate(dt);
  for (const f of G.fx) f.life -= dt;
  if (G.fx.length) G.fx = G.fx.filter(f => f.life > -0.5);
  if (typeof updateAllAI === 'function') updateAllAI(dt);
  G.units = G.units.filter(u => u.hp > 0);
  if (G.builds.some(b => b.hp <= 0)) G.builds = G.builds.filter(b => b.hp > 0);
  for (const tm of G.teams) tm.stats.peak = Math.max(tm.stats.peak, tm.pop);
  if ((fogT -= dt) <= 0) { fogT = 0.25; updateFog(); }
  if ((checkT -= dt) <= 0) { checkT = 1; checkTeams(); }
}
