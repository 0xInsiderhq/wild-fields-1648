// ================= map generation =================
function makeNoise(seed) {
  const R = mulberry32(seed), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = R();
  const n = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = P[(ix & 255) + ((iz & 255) << 8)], b = P[((ix + 1) & 255) + ((iz & 255) << 8)], c = P[(ix & 255) + (((iz + 1) & 255) << 8)], d = P[((ix + 1) & 255) + (((iz + 1) & 255) << 8)];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  n.fbm = (x, z, oct = 4) => { let s = 0, a = 0.5, f = 1, t = 0; for (let o = 0; o < oct; o++) { s += n(x * f + o * 17.3, z * f - o * 9.1) * a; t += a; f *= 2.03; a *= 0.5; } return s / t; };
  return n;
}
const START_SPOTS = { 2: [[18, 110], [110, 18]], 3: [[18, 110], [110, 18], [18, 18]], 4: [[18, 110], [110, 18], [18, 18], [110, 110]] };
function distSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az;
  const t = clamp((wx * vx + wz * vz) / (vx * vx + vz * vz), 0, 1);
  return { d: hyp(px - ax - vx * t, pz - az - vz * t), t };
}
function genMap(seed, players) {
  G.seed = seed;
  RNG = mulberry32(seed);
  const noise = makeNoise(seed * 7 + 3), noise2 = makeNoise(seed * 13 + 11), noise3 = makeNoise(seed * 3 + 101);
  const W1 = N + 1;
  G.terr.fill(0); G.tree.fill(0); G.treeKind.fill(0); G.dep.fill(0); G.bocc.fill(0); G.bblock.fill(0); G.vis.fill(0);
  G.deposits = [];
  const starts = START_SPOTS[players].map(([x, z]) => ({ x: x + ri(-2, 2), z: z + ri(-2, 2) }));
  G.starts = starts;
  // ---- base relief: rolling steppe hills
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
    let h = 0.55 + noise.fbm(x * 0.028, z * 0.028, 5) * 2.6 + (noise2.fbm(x * 0.09, z * 0.09, 3) - 0.5) * 0.5;
    h = Math.max(0.3, h - 0.6);
    G.H[z * W1 + x] = h;
  }
  // ---- water
  const river = [];
  if (players === 2) {
    const pts = [[-3, 22], [30, 40], [52, 57], [64, 64], [77, 71], [98, 88], [131, 106]];
    for (let i = 0; i < pts.length; i++) river.push([pts[i][0] + (i > 0 && i < pts.length - 1 ? rr(-4, 4) : 0), pts[i][1] + (i > 0 && i < pts.length - 1 ? rr(-4, 4) : 0)]);
  }
  const fords = [0.24, 0.5, 0.76].map(t => t + rr(-0.05, 0.05));
  const lakes = [];
  if (players > 2) lakes.push({ x: 64 + rr(-3, 3), z: 64 + rr(-3, 3), r: rr(9, 12) });
  for (let k = 0; k < 3; k++) {
    for (let tries = 0; tries < 40; tries++) {
      const x = rr(20, 108), z = rr(20, 108);
      if (starts.some(s => hyp(s.x - x, s.z - z) < 26)) continue;
      if (players === 2 && river.length && riverDist(x, z).d < 14) continue;
      lakes.push({ x, z, r: rr(3, 5.5) }); break;
    }
  }
  function riverDist(x, z) {
    let best = { d: 1e9, t: 0 }, acc = 0, total = 0;
    const lens = []; for (let i = 0; i < river.length - 1; i++) { lens.push(hyp(river[i + 1][0] - river[i][0], river[i + 1][1] - river[i][1])); total += lens[i]; }
    for (let i = 0; i < river.length - 1; i++) {
      const r = distSeg(x, z, river[i][0], river[i][1], river[i + 1][0], river[i + 1][1]);
      if (r.d < best.d) best = { d: r.d, t: (acc + r.t * lens[i]) / total };
      acc += lens[i];
    }
    return best;
  }
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
    let h = G.H[z * W1 + x];
    if (river.length) {
      const r = riverDist(x + (noise3(x * 0.15, z * 0.15) - 0.5) * 3, z + (noise3(z * 0.15 + 9, x * 0.15) - 0.5) * 3);
      const wid = 2.6 + noise3(r.t * 8, 3) * 1.2;
      let depth = r.d < wid ? -0.75 : r.d < wid + 2.5 ? lerp(-0.75, h, (r.d - wid) / 2.5) : h;
      const nearFord = fords.some(f => Math.abs(r.t - f) < 0.022);
      if (nearFord && r.d < wid + 2) depth = Math.max(depth, -0.16);
      if (r.d < wid + 6) h = Math.min(h, Math.max(depth, r.d < wid + 3 ? depth : lerp(depth, h, (r.d - wid - 3) / 3)));
    }
    for (const L of lakes) {
      const d = hyp(x - L.x, z - L.z) / (L.r * (0.85 + noise3(x * 0.2, z * 0.2) * 0.3));
      if (d < 1.6) h = Math.min(h, d < 1 ? lerp(-0.85, -0.2, d) : lerp(-0.2, h, (d - 1) / 0.6));
    }
    G.H[z * W1 + x] = h;
  }
  // ---- flatten start plateaus
  for (const s of starts) for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
    const d = hyp(x - s.x, z - s.z);
    if (d < 13) { const k = clamp((d - 8) / 5, 0, 1); const i = z * W1 + x; G.H[i] = lerp(1.0, Math.max(G.H[i], 0.4), k * k); }
  }
  // ---- tile classes
  const tileH = (x, z) => (G.H[z * W1 + x] + G.H[z * W1 + x + 1] + G.H[(z + 1) * W1 + x] + G.H[(z + 1) * W1 + x + 1]) / 4;
  const tileMin = (x, z) => Math.min(G.H[z * W1 + x], G.H[z * W1 + x + 1], G.H[(z + 1) * W1 + x], G.H[(z + 1) * W1 + x + 1]);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const h = tileH(x, z), i = z * N + x;
    if (h < -0.28) G.terr[i] = 5;
    else if (h < 0.02) G.terr[i] = 4;
    else if (tileMin(x, z) < 0.22) G.terr[i] = 3;
    else { const m = noise2.fbm(x * 0.05 + 40, z * 0.05, 3); G.terr[i] = m > 0.6 ? 1 : (noise3.fbm(x * 0.08, z * 0.08, 3) > 0.64 ? 2 : 0); }
  }
  const nearStart = (x, z, r) => starts.some(s => hyp(s.x - x, s.z - z) < r);
  // ---- forests
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x;
    if (G.terr[i] >= 3 || nearStart(x, z, 10)) continue;
    const f = noise.fbm(x * 0.055 + 200, z * 0.055 - 50, 4);
    const edge = Math.min(x, z, N - 1 - x, N - 1 - z);
    if (f > 0.585 || (edge < 3 && rnd() < 0.8) || (f > 0.54 && rnd() < 0.25)) plantTree(x, z, noise2);
  }
  // each base gets its own wood line
  starts.forEach((s, k) => {
    const away = Math.atan2(s.z - 64, s.x - 64);
    for (const da of [-0.9, 0.9]) {
      const a = away + da, cx = s.x + Math.cos(a) * 14, cz = s.z + Math.sin(a) * 14;
      for (let z = -6; z <= 6; z++) for (let x = -6; x <= 6; x++) {
        const tx = Math.round(cx + x), tz = Math.round(cz + z);
        if (!inMap(tx, tz) || G.terr[idx(tx, tz)] >= 3 || nearStart(tx, tz, 10)) continue;
        if (hyp(x, z * 1.3) < 4.5 + noise3(tx * 0.3, tz * 0.3) * 2) plantTree(tx, tz, noise2);
      }
    }
  });
  // ---- deposits
  starts.forEach((s, k) => {
    const away = Math.atan2(s.z - 64, s.x - 64), toward = away + Math.PI;
    placeDeposit('gold', s.x + Math.cos(toward + 0.9) * 11, s.z + Math.sin(toward + 0.9) * 11, 2, 2500);
    placeDeposit('stone', s.x + Math.cos(toward - 0.9) * 11, s.z + Math.sin(toward - 0.9) * 11, 2, 2000);
    const ba = away + Math.PI * (rnd() < 0.5 ? 0.5 : -0.5), bx = s.x + Math.cos(ba) * 6.5, bz = s.z + Math.sin(ba) * 6.5;
    for (let j = 0; j < 6; j++) placeDeposit('berry', bx + (j % 3) * 1.2 - 1.2, bz + Math.floor(j / 3) * 1.3, 1, 160);
  });
  for (let k = 0; k < 10; k++) {
    for (let tries = 0; tries < 80; tries++) {
      const x = rr(14, 114), z = rr(14, 114);
      if (nearStart(x, z, 28)) continue;
      if (placeDeposit(k % 2 ? 'stone' : 'gold', x, z, 2, k % 2 ? 2400 : 3000)) break;
    }
  }
  // ---- keep start areas clear and make sure everyone can reach everyone
  for (const s of starts) for (let z = -9; z <= 9; z++) for (let x = -9; x <= 9; x++) { const tx = Math.round(s.x) + x, tz = Math.round(s.z) + z; if (inMap(tx, tz) && hyp(x, z) < 8.5 && !G.dep[idx(tx, tz)]) G.tree[idx(tx, tz)] = 0; }
  for (let k = 1; k < starts.length; k++) ensureReach(starts[0], starts[k]);
  return starts;
}
function plantTree(x, z, noise2) {
  const i = idx(x, z);
  G.tree[i] = 110 + ((rnd() * 60) | 0);
  const h = heightAt(x + 0.5, z + 0.5), n = noise2(x * 0.11, z * 0.11);
  G.treeKind[i] = h > 1.5 || n > 0.62 ? 0 : n < 0.3 ? 2 : 1;
}
function placeDeposit(type, fx, fz, size, amt) {
  const tx = Math.round(fx), tz = Math.round(fz);
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const ax = tx + x, az = tz + z;
    if (!inMap(ax, az) || ax < 2 || az < 2 || ax > N - 3 || az > N - 3) return false;
    const i = idx(ax, az);
    if (G.terr[i] >= 3 || G.dep[i]) return false;
  }
  const d = { id: G.deposits.length, type, tx, tz, w: size, h: size, x: tx + size / 2, z: tz + size / 2, amt, max: amt };
  G.deposits.push(d);
  for (let z = -1; z <= size; z++) for (let x = -1; x <= size; x++) { const ax = tx + x, az = tz + z; if (inMap(ax, az)) G.tree[idx(ax, az)] = 0; }
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) G.dep[idx(tx + x, tz + z)] = d.id + 1;
  return true;
}
function ensureReach(a, b) {
  for (let guard = 0; guard < 6; guard++) {
    const seen = new Uint8Array(N * N), q = [idx(Math.round(a.x), Math.round(a.z))];
    seen[q[0]] = 1;
    while (q.length) { const c = q.pop(), cx = c % N, cz = (c / N) | 0; for (const [dx, dz] of DIRS) { const nx = cx + dx, nz = cz + dz; if (!inMap(nx, nz) || blockedStatic(nx, nz)) continue; const ni = idx(nx, nz); if (!seen[ni]) { seen[ni] = 1; q.push(ni); } } }
    if (seen[idx(Math.round(b.x), Math.round(b.z))]) return;
    // carve a straight lane: clear trees and turn deep water into a ford
    const steps = Math.ceil(hyp(b.x - a.x, b.z - a.z));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(lerp(a.x, b.x, s / steps)), z = Math.round(lerp(a.z, b.z, s / steps));
      for (let w = -1; w <= 1; w++) for (const [ox, oz] of [[w, 0], [0, w]]) {
        const tx = x + ox, tz = z + oz; if (!inMap(tx, tz)) continue;
        const i = idx(tx, tz); G.tree[i] = 0;
        if (G.terr[i] === 5) { G.terr[i] = 4; for (const [cx, cz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = (tz + cz) * (N + 1) + tx + cx; G.H[k] = Math.max(G.H[k], -0.16); } }
      }
    }
  }
}
