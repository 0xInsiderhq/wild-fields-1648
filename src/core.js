'use strict';
// ================= constants & helpers =================
const N = 128;                       // map is N x N tiles, 1 tile = 1 world unit
const RES = ['food', 'wood', 'stone', 'gold'];
const F = 0, W = 1, S = 2, Au = 3;
let RNG = Math.random;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd = () => RNG();
const rr = (a, b) => a + (b - a) * RNG();
const ri = (a, b) => Math.floor(rr(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const hyp = Math.hypot;
const idx = (tx, tz) => tz * N + tx;
const inMap = (tx, tz) => tx >= 0 && tz >= 0 && tx < N && tz < N;
const angDiff = (a, b) => ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
const turnTo = (a, b, k) => a + clamp(angDiff(a, b), -k, k);
// hooks the renderer/UI fill in; the sim never touches the DOM
const HOOK = { toast() { }, sfx() { }, event() { } };
let REVEAL = false; // show everything (menu backdrop)

// ================= definitions =================
// cost order: food, wood, stone, gold
const UT = {
  peasant: { name: 'Peasant', cls: 'worker', hp: 45, armor: 0, parmor: 0, speed: 1.55, r: 0.2, sight: 6, pop: 1, time: 14, cost: [50, 0, 0, 0], melee: { dmg: 3, cd: 1.5, range: 0.3 }, from: 'townhall', hk: 'Q', desc: 'Gathers food, wood, stone and gold. Builds and repairs.' },
  pikeman: { name: 'Pikeman', cls: 'inf', hp: 90, armor: 2, parmor: 1, speed: 1.45, r: 0.22, sight: 6, pop: 1, time: 16, cost: [45, 35, 0, 0], melee: { dmg: 9, cd: 1.4, range: 0.65 }, bonus: { cav: 2.6 }, from: 'barracks', hk: 'Q', desc: 'Sturdy infantry with a long pike. Deals triple damage to cavalry.' },
  musketeer: { name: 'Musketeer', cls: 'inf', ranged: true, hp: 70, armor: 0, parmor: 0, speed: 1.4, r: 0.22, sight: 8, pop: 1, time: 20, cost: [50, 20, 0, 35], gun: { dmg: 24, cd: 5.2, range: 7, acc: 0.62 }, melee: { dmg: 4, cd: 1.6, range: 0.35 }, from: 'barracks', hk: 'W', desc: 'Fires a heavy musket volley, then reloads. Weak in melee.' },
  lighthorse: { name: 'Cossack Rider', cls: 'cav', hp: 125, armor: 1, parmor: 1, speed: 3.1, r: 0.36, sight: 8, pop: 2, time: 22, cost: [70, 0, 0, 40], melee: { dmg: 11, cd: 1.15, range: 0.45 }, bonus: { ranged: 1.7, art: 2.2, worker: 1.5 }, from: 'stable', hk: 'Q', desc: 'Fast sabre cavalry. Raids peasants, runs down musketeers and guns.' },
  dragoon: { name: 'Dragoon', cls: 'cav', ranged: true, hp: 110, armor: 1, parmor: 1, speed: 2.7, r: 0.36, sight: 8, pop: 2, time: 26, cost: [80, 20, 0, 70], gun: { dmg: 20, cd: 5.8, range: 6, acc: 0.55 }, melee: { dmg: 6, cd: 1.5, range: 0.45 }, from: 'stable', hk: 'W', desc: 'Mounted musketeer. Rides in, dismounts the volley, rides out.' },
  cuirassier: { name: 'Cuirassier', cls: 'cav', hp: 195, armor: 4, parmor: 3, speed: 2.35, r: 0.38, sight: 7, pop: 2, time: 30, cost: [90, 0, 0, 95], melee: { dmg: 17, cd: 1.5, range: 0.5 }, bonus: { ranged: 1.5, art: 2 }, from: 'stable', needs: 'blacksmith', hk: 'E', desc: 'Armoured heavy cavalry. Breaks infantry lines that have no pikes.' },
  cannon: { name: 'Field Gun', cls: 'art', hp: 170, armor: 3, parmor: 6, speed: 0.85, r: 0.48, sight: 9, pop: 3, time: 40, cost: [0, 150, 50, 120], art: { dmg: 55, cd: 7.5, range: 13, min: 2.5, splash: 0.95 }, bonus: { bld: 3 }, from: 'foundry', hk: 'Q', desc: 'Long-range gun. Round shot bounces through ranks and smashes buildings.' },
};
const BT = {
  townhall: { name: 'Town Hall', w: 4, h: 4, hp: 2600, armor: 3, time: 100, cost: [0, 350, 250, 150], pop: 15, sight: 11, drop: [1, 1, 1, 1], trains: ['peasant'], techs: ['tools', 'wheelbarrow'], gun: { dmg: 10, cd: 2.2, range: 7.5, acc: 0.6 }, hk: 'T', desc: 'Trains peasants and takes every resource. Its garrison fires on raiders.' },
  house: { name: 'House', w: 2, h: 2, hp: 500, armor: 1, time: 20, cost: [0, 60, 0, 0], pop: 10, sight: 4, hk: 'Q', desc: 'A whitewashed cottage. Houses 10 more people.' },
  mill: { name: 'Windmill', w: 3, h: 3, hp: 750, armor: 1, time: 30, cost: [0, 100, 0, 0], drop: [1, 0, 0, 0], sight: 5, techs: ['plough'], hk: 'W', desc: 'Takes food. Build farms around it.' },
  farm: { name: 'Farm', w: 3, h: 3, hp: 220, armor: 0, time: 12, cost: [0, 60, 0, 0], walk: true, sight: 2, hk: 'E', desc: 'A wheat field one peasant can work forever.' },
  storehouse: { name: 'Storehouse', w: 2, h: 2, hp: 650, armor: 1, time: 24, cost: [0, 100, 0, 0], drop: [0, 1, 1, 1], sight: 5, hk: 'R', desc: 'Takes wood, stone and gold. Build it by forests and mines.' },
  barracks: { name: 'Barracks', w: 4, h: 3, hp: 1400, armor: 2, time: 45, cost: [0, 160, 60, 0], trains: ['pikeman', 'musketeer'], sight: 6, hk: 'A', desc: 'Trains pikemen and musketeers.' },
  stable: { name: 'Stable', w: 4, h: 3, hp: 1300, armor: 2, time: 50, cost: [0, 160, 100, 0], trains: ['lighthorse', 'dragoon', 'cuirassier'], sight: 6, hk: 'S', desc: 'Trains Cossack riders, dragoons and cuirassiers.' },
  blacksmith: { name: 'Armoury', w: 3, h: 3, hp: 1100, armor: 2, time: 45, cost: [0, 150, 120, 0], techs: ['cartridge', 'steelpikes', 'cuirass', 'barding', 'ballistics'], sight: 5, hk: 'D', desc: 'Researches weapons and armour.' },
  foundry: { name: 'Foundry', w: 3, h: 3, hp: 1400, armor: 3, time: 60, cost: [0, 200, 180, 100], trains: ['cannon'], techs: ['heavyshot'], sight: 6, needs: 'blacksmith', hk: 'F', desc: 'Casts field guns.' },
  tower: { name: 'Watch Tower', w: 2, h: 2, hp: 1500, armor: 4, time: 45, cost: [0, 80, 180, 0], gun: { dmg: 15, cd: 1.8, range: 8.5, acc: 0.65 }, sight: 10, hk: 'Z', desc: 'Stone tower with a musket garrison.' },
  church: { name: 'Church', w: 3, h: 3, hp: 1500, armor: 2, time: 60, cost: [0, 200, 200, 100], heal: { r: 7, rate: 2 }, techs: ['faith'], sight: 6, hk: 'X', desc: 'Heals your wounded within 7 tiles.' },
};
const BUILD_MENU = ['house', 'mill', 'farm', 'storehouse', 'barracks', 'stable', 'blacksmith', 'foundry', 'tower', 'church', 'townhall'];
const TECH = {
  tools: { name: 'Iron Tools', at: 'townhall', cost: [100, 100, 0, 50], time: 30, desc: 'Peasants gather 20% faster.' },
  wheelbarrow: { name: 'Wheelbarrow', at: 'townhall', cost: [150, 100, 0, 50], time: 35, desc: 'Peasants carry 15 instead of 10 and walk 10% faster.' },
  plough: { name: 'Heavy Plough', at: 'mill', cost: [100, 150, 0, 0], time: 30, desc: 'Farms yield 30% more food.' },
  cartridge: { name: 'Paper Cartridges', at: 'blacksmith', cost: [100, 0, 0, 150], time: 40, desc: 'Muskets reload 25% faster, towers included.' },
  steelpikes: { name: 'Steel Pikeheads', at: 'blacksmith', cost: [100, 0, 50, 100], time: 35, desc: 'Pikemen deal 4 more damage.' },
  cuirass: { name: 'Breastplates', at: 'blacksmith', cost: [150, 0, 100, 100], time: 45, desc: 'Infantry gain 1 melee and 1 ranged armour.' },
  barding: { name: 'Barding', at: 'blacksmith', cost: [150, 0, 0, 150], time: 45, desc: 'Cavalry gain 25 hit points.' },
  ballistics: { name: 'Ballistics', at: 'blacksmith', cost: [0, 100, 0, 200], time: 45, desc: 'Muskets and guns reach 1 tile farther.' },
  heavyshot: { name: 'Heavy Shot', at: 'foundry', cost: [0, 150, 100, 150], time: 45, desc: 'Field guns deal 30% more damage.' },
  faith: { name: 'Sermons', at: 'church', cost: [100, 0, 0, 150], time: 40, desc: 'The church heals twice as fast and 3 tiles wider.' },
};
const GATHER = { tree: 0.62, stone: 0.5, gold: 0.5, farm: 0.45, berry: 0.7 };
const RES_OF = { tree: W, stone: S, gold: Au, farm: F, berry: F };
const TEAM_COLORS = ['#b3262b', '#2f5fa8', '#3d8a3a', '#c9a227'];
const TEAM_NAMES = ['Zaporozhian Host', 'Kingdom of the West', 'Duchy of the North', 'Sultanate of the South'];

// ================= world state =================
const G = {
  t: 0, speed: 1, paused: true, over: false, winner: -1, diff: 1, seed: 1,
  teams: [], units: [], builds: [], projs: [], fx: [], corpses: [], nextId: 1, events: [],
  H: new Float32Array((N + 1) * (N + 1)),   // corner heights
  terr: new Uint8Array(N * N),              // 0 grass 1 meadow 2 dirt 3 sand 4 shallow 5 deep
  tree: new Uint16Array(N * N),             // wood left on a tree tile
  treeKind: new Uint8Array(N * N),
  dep: new Int16Array(N * N),               // deposit index + 1
  deposits: [],
  bocc: new Int32Array(N * N),              // building id on tile
  bblock: new Uint8Array(N * N),            // building blocks movement
  vis: new Uint8Array(N * N),               // player view: 0 unexplored 1 explored 2 visible
  starts: [],
};
const blocked = (tx, tz) => !inMap(tx, tz) || G.terr[tz * N + tx] === 5 || G.tree[tz * N + tx] > 0 || G.dep[tz * N + tx] > 0 || G.bblock[tz * N + tx] > 0;
const blockedStatic = (tx, tz) => !inMap(tx, tz) || G.terr[tz * N + tx] === 5 || G.tree[tz * N + tx] > 0 || G.dep[tz * N + tx] > 0;
function heightAt(x, z) {
  x = clamp(x, 0, N - 0.001); z = clamp(z, 0, N - 0.001);
  const ix = x | 0, iz = z | 0, fx = x - ix, fz = z - iz, W1 = N + 1;
  const a = G.H[iz * W1 + ix], b = G.H[iz * W1 + ix + 1], c = G.H[(iz + 1) * W1 + ix], d = G.H[(iz + 1) * W1 + ix + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}
function team(t) { return G.teams[t]; }
function enemies(a, b) { return a !== b && G.teams[a] && G.teams[b] && G.teams[a].side !== G.teams[b].side; }
function makeTeam(id, ai, side) {
  return {
    id, ai, side, color: TEAM_COLORS[id], name: TEAM_NAMES[id], res: [300, 250, 150, 100], pop: 0, popCap: 0, alive: true,
    techs: new Set(), researching: new Set(),
    mod: { gather: 1, farm: 1, carry: 10, walk: 1, reload: 1, pike: 0, infArmor: 0, cavHp: 0, range: 0, cannon: 1, heal: 1, healR: 0 },
    stats: { trained: 0, lost: 0, kills: 0, razed: 0, gathered: [0, 0, 0, 0], built: 0, peak: 0 },
  };
}
function canAfford(t, c) { const r = G.teams[t].res; return r[0] >= c[0] && r[1] >= c[1] && r[2] >= c[2] && r[3] >= c[3]; }
function pay(t, c) { const r = G.teams[t].res; for (let i = 0; i < 4; i++) r[i] -= c[i]; }
function refund(t, c, k = 1) { const r = G.teams[t].res; for (let i = 0; i < 4; i++) r[i] += Math.floor(c[i] * k); }
function costText(c) { return c.map((v, i) => v ? `${v} ${RES[i]}` : '').filter(Boolean).join(', '); }
function needText(t, c) { const r = G.teams[t].res, miss = []; for (let i = 0; i < 4; i++) if (r[i] < c[i]) miss.push(`${Math.ceil(c[i] - r[i])} ${RES[i]}`); return 'Need ' + miss.join(' and '); }

// ================= pathfinding =================
// binary heap on parallel arrays keyed by tile index
const HEAP = { k: new Int32Array(N * N * 8), f: new Float32Array(N * N * 8), n: 0 };
function hpush(i, f) { let c = HEAP.n++; HEAP.k[c] = i; HEAP.f[c] = f; while (c > 0) { const p = (c - 1) >> 1; if (HEAP.f[p] <= HEAP.f[c]) break; const tk = HEAP.k[p], tf = HEAP.f[p]; HEAP.k[p] = HEAP.k[c]; HEAP.f[p] = HEAP.f[c]; HEAP.k[c] = tk; HEAP.f[c] = tf; c = p; } }
function hpop() { const top = HEAP.k[0]; const n = --HEAP.n; if (n > 0) { HEAP.k[0] = HEAP.k[n]; HEAP.f[0] = HEAP.f[n]; let p = 0; for (; ;) { const l = 2 * p + 1, r = l + 1; let m = p; if (l < n && HEAP.f[l] < HEAP.f[m]) m = l; if (r < n && HEAP.f[r] < HEAP.f[m]) m = r; if (m === p) break; const tk = HEAP.k[p], tf = HEAP.f[p]; HEAP.k[p] = HEAP.k[m]; HEAP.f[p] = HEAP.f[m]; HEAP.k[m] = tk; HEAP.f[m] = tf; p = m; } } return top; }
const PF = { g: new Float32Array(N * N), from: new Int32Array(N * N), stamp: new Int32Array(N * N), closed: new Int32Array(N * N), run: 0 };
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
function stepCost(i) { return G.terr[i] === 4 ? 1.7 : 1; }
function nearestFree(tx, tz, maxR = 10) {
  if (!blocked(tx, tz)) return [tx, tz];
  for (let r = 1; r <= maxR; r++) {
    let best = null, bd = 1e9;
    for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== r) continue;
      if (!blocked(tx + x, tz + z)) { const d = x * x + z * z; if (d < bd) { bd = d; best = [tx + x, tz + z]; } }
    }
    if (best) return best;
  }
  return [tx, tz];
}
function findPath(sx, sz, gx, gz, maxNodes = 7000) {
  [gx, gz] = nearestFree(gx, gz);
  if (blocked(sx, sz)) [sx, sz] = nearestFree(sx, sz, 3);
  const run = ++PF.run, s = idx(sx, sz), goal = idx(gx, gz);
  HEAP.n = 0;
  PF.stamp[s] = run; PF.g[s] = 0; PF.from[s] = -1;
  hpush(s, 0);
  let best = s, bestH = 1e9, n = 0;
  while (HEAP.n && n++ < maxNodes) {
    const cur = hpop();
    if (PF.closed[cur] === run) continue;
    PF.closed[cur] = run;
    if (cur === goal) { best = cur; break; }
    const cx = cur % N, cz = (cur / N) | 0;
    const hh = Math.max(Math.abs(cx - gx), Math.abs(cz - gz)) + 0.414 * Math.min(Math.abs(cx - gx), Math.abs(cz - gz));
    if (hh < bestH) { bestH = hh; best = cur; }
    for (const [dx, dz, c] of DIRS) {
      const nx = cx + dx, nz = cz + dz;
      if (blocked(nx, nz)) continue;
      if (dx && dz && (blocked(cx + dx, cz) || blocked(cx, cz + dz))) continue;
      const ni = nz * N + nx;
      if (PF.closed[ni] === run) continue;
      const ng = PF.g[cur] + c * stepCost(ni);
      if (PF.stamp[ni] !== run || ng < PF.g[ni]) {
        PF.stamp[ni] = run; PF.g[ni] = ng; PF.from[ni] = cur;
        const ax = Math.abs(nx - gx), az = Math.abs(nz - gz);
        hpush(ni, ng + Math.max(ax, az) + 0.414 * Math.min(ax, az));
      }
    }
  }
  const out = [];
  let c = best;
  while (c !== -1 && c !== s) { out.push(c); c = PF.from[c]; }
  out.reverse();
  return smoothPath(sx, sz, out);
}
// supercover line of sight across tiles
function los(ax, az, bx, bz) {
  let x = ax, z = az;
  const dx = Math.abs(bx - ax), dz = Math.abs(bz - az), sx = ax < bx ? 1 : -1, sz = az < bz ? 1 : -1;
  let err = dx - dz;
  for (let k = 0; k < 400; k++) {
    if (x === bx && z === bz) return true;
    const e2 = 2 * err;
    if (e2 > -dz && e2 < dx) { if (blocked(x + sx, z) || blocked(x, z + sz)) return false; }
    if (e2 > -dz) { err -= dz; x += sx; }
    if (e2 < dx) { err += dx; z += sz; }
    if (blocked(x, z)) return false;
  }
  return true;
}
function smoothPath(sx, sz, cells) {
  const out = [];
  let ax = sx, az = sz, i = 0;
  while (i < cells.length) {
    let j = Math.min(cells.length - 1, i + 24);
    while (j > i && !los(ax, az, cells[j] % N, (cells[j] / N) | 0)) j--;
    out.push({ x: cells[j] % N + 0.5, z: ((cells[j] / N) | 0) + 0.5 });
    ax = cells[j] % N; az = (cells[j] / N) | 0;
    i = j + 1;
  }
  return out;
}
// flow field: travel cost from every tile to the goal (shared by a whole group order)
function makeField(gx, gz) {
  [gx, gz] = nearestFree(gx, gz);
  const f = new Float32Array(N * N).fill(1e9);
  const g = idx(gx, gz);
  HEAP.n = 0; f[g] = 0; hpush(g, 0);
  const done = new Uint8Array(N * N);
  while (HEAP.n) {
    const cur = hpop();
    if (done[cur]) continue;
    done[cur] = 1;
    const cx = cur % N, cz = (cur / N) | 0, cv = f[cur];
    for (const [dx, dz, c] of DIRS) {
      const nx = cx + dx, nz = cz + dz;
      if (blocked(nx, nz)) continue;
      if (dx && dz && (blocked(cx + dx, cz) || blocked(cx, cz + dz))) continue;
      const ni = nz * N + nx, nv = cv + c * stepCost(cur);
      if (nv < f[ni]) { f[ni] = nv; hpush(ni, nv); }
    }
  }
  return { f, gx, gz, t: G.t };
}
function fieldStep(field, tx, tz) {
  // walk downhill a few cells and return the farthest one still in sight
  let cx = tx, cz = tz, bestX = -1, bestZ = -1;
  for (let k = 0; k < 10; k++) {
    let mv = field.f[idx(cx, cz)], nx = -1, nz = -1;
    for (const [dx, dz] of DIRS) {
      const ax = cx + dx, az = cz + dz;
      if (!inMap(ax, az)) continue;
      if (dx && dz && (blocked(cx + dx, cz) || blocked(cx, cz + dz))) continue;
      const v = field.f[idx(ax, az)];
      if (v < mv) { mv = v; nx = ax; nz = az; }
    }
    if (nx < 0) break;
    cx = nx; cz = nz;
    if (k < 1 || los(tx, tz, cx, cz)) { bestX = cx; bestZ = cz; } else break;
  }
  return bestX < 0 ? null : { x: bestX + 0.5, z: bestZ + 0.5 };
}
