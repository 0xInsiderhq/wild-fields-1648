// ================= vegetation and stone: leaf-card trees and bushes, smooth weathered rocks =================
const VEG = { tex: {}, geos: {}, q: -1 };
// leaf sprays drawn on canvas; alpha-tested cards carry them
function leafTex(kind) {
  if (VEG.tex[kind]) return VEG.tex[kind];
  const t = canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const R = mulberry32(kind.length * 131 + 7);
    if (kind === 'pine') {
      // a drooping spruce/pine spray: main twig left -> right, side twigs, dense needles
      const twig = (x0, y0, x1, y1, lw) => { c.strokeStyle = '#3a2a1c'; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 6, x1, y1); c.stroke(); };
      const needles = (x0, y0, x1, y1, len, n) => {
        for (let k = 0; k < n; k++) {
          const s = k / n, x = x0 + (x1 - x0) * s, y = y0 + (y1 - y0) * s + Math.sin(s * Math.PI) * 6, l = len * (1 - s * 0.55);
          for (const sd of [-1, 1]) {
            const a = Math.atan2(y1 - y0, x1 - x0) + sd * (1.05 + R() * 0.35);
            const g = 40 + R() * 40;
            c.strokeStyle = `rgb(${(g * 0.55) | 0},${(g + 30) | 0},${(g * 0.45) | 0})`; c.lineWidth = 1.6 + R();
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
          }
        }
      };
      twig(4, h * 0.5, w - 6, h * 0.55, 4);
      needles(6, h * 0.5, w - 8, h * 0.55, 46, 70);
      for (let k = 0; k < 6; k++) { const s = 0.15 + k * 0.13, x0 = 6 + (w - 14) * s, y0 = h * 0.5 + Math.sin(s * Math.PI) * 6, sd = k % 2 ? 1 : -1, x1 = x0 + 50 + R() * 30, y1 = y0 + sd * (60 + R() * 25); twig(x0, y0, x1, y1, 2); needles(x0, y0, x1, y1, 26, 26); }
    } else {
      const birch = kind === 'birch';
      const pal = birch ? [[118, 150, 52], [140, 168, 64], [96, 130, 44], [158, 176, 82]] : [[58, 92, 34], [74, 108, 40], [48, 78, 30], [92, 120, 48], [66, 98, 36]];
      c.strokeStyle = '#3a2c1e'; c.lineWidth = 3;
      for (let k = 0; k < 5; k++) { const a = R() * 6.28; c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + Math.cos(a) * w * 0.38, h / 2 + Math.sin(a) * h * 0.38); c.stroke(); }
      const n = birch ? 150 : 190;
      for (let k = 0; k < n; k++) {
        const a = R() * 6.28, r = Math.pow(R(), 0.6) * w * 0.44, x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
        const s = (birch ? 7 : 10) + R() * (birch ? 5 : 7), col = pal[(R() * pal.length) | 0], j = 0.8 + R() * 0.4;
        c.save(); c.translate(x, y); c.rotate(R() * 6.28);
        c.fillStyle = `rgb(${(col[0] * j) | 0},${(col[1] * j) | 0},${(col[2] * j) | 0})`;
        c.beginPath(); c.ellipse(0, 0, s, s * (birch ? 0.62 : 0.55), 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = `rgba(30,40,16,0.45)`; c.lineWidth = 1; c.beginPath(); c.moveTo(-s, 0); c.lineTo(s, 0); c.stroke();
        c.restore();
      }
    }
  }, null, true);
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return VEG.tex[kind] = t;
}
// a double-wound quad with a chosen (shared) normal and per-corner AO
function cardQ(A, c, a1, a2, n, ao, uvR) {
  const P = [[-1, -1], [1, -1], [1, 1], [-1, 1]], UV = uvR || [[0, 0], [1, 0], [1, 1], [0, 1]];
  const v = P.map(([s, t]) => [c.x + a1.x * s + a2.x * t, c.y + a1.y * s + a2.y * t, c.z + a1.z * s + a2.z * t]);
  for (const tri of [[0, 1, 2], [0, 2, 3], [0, 2, 1], [0, 3, 2]]) for (const k of tri) {
    A.pos.push(...v[k]); A.nor.push(n.x, n.y, n.z); A.uv.push(UV[k][0], UV[k][1]); const a = ao(v[k]); A.col.push(a[0], a[1], a[2]);
  }
}
function cardGeo(A) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  g.computeBoundingSphere(); g.userData.keep = true;
  return g;
}
const vrand = R => { const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u); return new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s); };
function barkFn(base, mark) {
  const b = L3(base);
  return (x, y, z) => { let k = noiseK(x * 3, y * 9, z * 3, 0.35); if (mark && Math.sin(y * 23 + Math.sin(x * 40) * 2) > 0.8) return [0.03, 0.03, 0.028, 1]; if (y < 0.15) k *= 0.75; return [b[0] * k, b[1] * k, b[2] * k, 1]; };
}
// trunk + limbs as tubes, canopy as leaf cards on lumpy lobes
function broadTree(R, q, birch) {
  const cards = [14, 26, 38, 46][q] * (birch ? 0.8 : 1);
  const bark = [], H = birch ? 2.05 : 1.25, lean = (R() - 0.5) * 0.15;
  const trunk = []; for (let i = 0; i <= 5; i++) { const s = i / 5; trunk.push(vv(lean * s * s + Math.sin(s * 5) * 0.02, s * H, Math.cos(s * 4) * 0.015)); }
  const tr0 = birch ? 0.065 : 0.14;
  bark.push(paint(tube(trunk, trunk.map((_, i) => tr0 * (1 - i / 5 * 0.55) * (i === 0 ? 1.35 : 1)), 7), barkFn(birch ? '#d6d0c0' : '#4a3828', birch)));
  if (!birch) for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + R(); bark.push(paint(tube([vv(0, 0.12, 0), vv(Math.cos(a) * 0.13, 0.04, Math.sin(a) * 0.13), vv(Math.cos(a) * 0.24, -0.02, Math.sin(a) * 0.24)], [0.07, 0.045, 0.02], 5), barkFn('#4a3828'))); }
  const C = new THREE.Vector3(lean, birch ? 1.7 : 1.78, 0), RX = birch ? 0.5 : 0.85 + R() * 0.12, RY = birch ? 0.8 : 0.68 + R() * 0.1;
  const limbs = birch ? 4 : 5;
  for (let k = 0; k < limbs; k++) {
    const a = k / limbs * 6.28 + R() * 0.8, y0 = H * (0.75 + R() * 0.2), out = (birch ? 0.35 : 0.6) * (0.7 + R() * 0.3);
    const p0 = vv(lean * 0.7, y0, 0), p1 = vv(lean + Math.cos(a) * out * 0.5, y0 + 0.3, Math.sin(a) * out * 0.5), p2 = vv(lean + Math.cos(a) * out, y0 + (birch ? 0.75 : 0.55), Math.sin(a) * out);
    bark.push(paint(tube([p0, p1, p2], [birch ? 0.03 : 0.06, birch ? 0.02 : 0.04, 0.012], 5), barkFn(birch ? '#d6d0c0' : '#4a3828', birch)));
  }
  // lobes give the crown an irregular silhouette
  const lobes = [{ c: C.clone(), r: 1 }];
  for (let k = 0; k < (birch ? 3 : 5); k++) { const d = vrand(R); d.y = d.y * 0.6 + 0.2; lobes.push({ c: C.clone().add(new THREE.Vector3(d.x * RX * 0.55, d.y * RY * 0.5, d.z * RX * 0.55)), r: 0.55 + R() * 0.2 }); }
  const A = { pos: [], nor: [], uv: [], col: [] };
  for (let k = 0; k < cards; k++) {
    const L = lobes[k % lobes.length], d = vrand(R);
    if (d.y < -0.6) d.y = -0.6;
    const rr0 = (0.55 + R() * 0.45) * L.r;
    const c = new THREE.Vector3(L.c.x + d.x * RX * rr0, L.c.y + d.y * RY * rr0, L.c.z + d.z * RX * rr0);
    const nrm = new THREE.Vector3().subVectors(c, C).normalize().multiplyScalar(0.65).add(d.clone().multiplyScalar(0.35)).normalize();
    nrm.y += 0.25; nrm.normalize();
    const f = birch ? new THREE.Vector3(d.x, d.y * 0.3, d.z).normalize() : d.clone();
    let a1 = new THREE.Vector3().crossVectors(f, Math.abs(f.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
    let a2 = new THREE.Vector3().crossVectors(f, a1).normalize();
    const rot = R() * 6.28, s = (birch ? 0.21 : 0.3) + R() * (birch ? 0.08 : 0.12);
    const b1 = a1.clone().multiplyScalar(Math.cos(rot)).addScaledVector(a2, Math.sin(rot)).multiplyScalar(s), b2 = a1.clone().multiplyScalar(-Math.sin(rot)).addScaledVector(a2, Math.cos(rot)).multiplyScalar(s * (birch ? 1.25 : 1));
    if (birch) b2.y -= s * 0.35;
    cardQ(A, c, b1, b2, nrm, v => { const h = clamp((v[1] - (C.y - RY)) / (RY * 2), 0, 1), dist = Math.hypot(v[0] - C.x, (v[1] - C.y) / RY * RX, v[2] - C.z) / RX; const k2 = 0.42 + 0.5 * h + 0.25 * clamp(dist, 0, 1); return [k2, k2, k2 * 0.95]; });
  }
  return { bark: merge(bark), leaves: cardGeo(A), kind: birch ? 'birch' : 'broad' };
}
function pineTree(R, q) {
  const H = 2.7 + R() * 0.3, bark = [];
  const trunk = []; for (let i = 0; i <= 5; i++) { const s = i / 5; trunk.push(vv(Math.sin(s * 3) * 0.02, s * H, 0)); }
  bark.push(paint(tube(trunk, trunk.map((_, i) => 0.1 * (1 - i / 5 * 0.8) * (i === 0 ? 1.3 : 1)), 7), barkFn('#5a3c28')));
  const whorls = [5, 7, 9, 10][q], A = { pos: [], nor: [], uv: [], col: [] };
  for (let i = 0; i < whorls; i++) {
    const s = i / (whorls - 1), y = 0.5 + s * (H - 0.75), L = 0.95 * Math.pow(1 - s, 0.85) + 0.16;
    const n = Math.max(3, Math.round(lerp(q >= 2 ? 7 : 5, 4, s))), off = R() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = off + k / n * 6.28 + (R() - 0.5) * 0.4, droop = 0.18 + 0.32 * (1 - s) + R() * 0.12, roll = (R() - 0.5) * 0.9;
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(droop), -Math.sin(droop), Math.sin(a) * Math.cos(droop));
      const side = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      side.applyAxisAngle(dir, roll);
      const w = (0.24 + L * 0.32);
      const c = new THREE.Vector3(Math.cos(a) * 0.04, y, Math.sin(a) * 0.04).addScaledVector(dir, L * 0.5);
      const nrm = new THREE.Vector3(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45).normalize();
      cardQ(A, c, dir.clone().multiplyScalar(L * 0.5), side.multiplyScalar(w * 0.5), nrm, v => { const out = Math.hypot(v[0], v[2]) / (L + 0.05), k2 = (0.5 + 0.45 * s) * (0.65 + 0.45 * clamp(out, 0, 1)); return [k2, k2, k2]; });
    }
  }
  // leader shoot
  for (const rr of [0, Math.PI / 2]) { const a1 = new THREE.Vector3(Math.cos(rr) * 0.14, 0, Math.sin(rr) * 0.14), a2 = new THREE.Vector3(0, 0.28, 0); cardQ(A, new THREE.Vector3(0, H - 0.05, 0), a2, a1, new THREE.Vector3(0, 1, 0), () => [0.95, 0.95, 0.95], [[0, 0], [0, 1], [1, 1], [1, 0]]); }
  return { bark: merge(bark), leaves: cardGeo(A), kind: 'pine' };
}
function treeSet(q) {
  if (VEG.q === q && VEG.trees) return VEG.trees;
  const R = mulberry32(4242);
  VEG.q = q;
  return VEG.trees = [pineTree(R, q), pineTree(R, q), broadTree(R, q, false), broadTree(R, q, false), broadTree(R, q, true)];
}
function leafMat(kind, plain) {
  const m = M('leaf_' + kind + (plain ? '_p' : ''), { map: leafTex(kind), alphaTest: 0.38, vertexColors: true, roughness: 0.85, metalness: 0 }, { wind: kind === 'pine' ? '0.008' : '0.014', windBase: '0.9', key: 'lf' + kind + (plain ? 'p' : '') });
  m.alphaToCoverage = true;
  if (!m.userData.depth) { m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: 0.38 }); }
  return m;
}
function buildTrees(root, R) {
  const set = treeSet(QUAL.level);
  const barkM = M('bark', { vertexColors: true, roughness: 0.95, metalness: 0 }, { wind: '0.01', windBase: '0.9', key: 'bk' });
  const lists = set.map(() => []);
  WORLD.treeRef = new Int32Array(N * N).fill(-1);
  for (let i = 0; i < N * N; i++) if (G.tree[i]) {
    const kind = G.treeKind[i];
    const v = kind === 0 ? (R() < 0.5 ? 0 : 1) : kind === 1 ? (R() < 0.5 ? 2 : 3) : 4;
    const x = i % N + 0.5 + (R() - 0.5) * 0.4, z = ((i / N) | 0) + 0.5 + (R() - 0.5) * 0.4;
    lists[v].push({ i, x, z, y: heightAt(x, z) - 0.04, s: 0.82 + R() * 0.42, ry: R() * 6.28, tint: 0.82 + R() * 0.34 });
  }
  const o = new THREE.Object3D(), col = new THREE.Color();
  WORLD.trees = lists.map((list, v) => {
    const parts = [new THREE.InstancedMesh(set[v].bark, barkM, Math.max(1, list.length)), new THREE.InstancedMesh(set[v].leaves, leafMat(set[v].kind), Math.max(1, list.length))];
    parts[1].customDepthMaterial = parts[1].material.userData.depth;
    list.forEach((t, k) => {
      o.position.set(t.x, t.y, t.z); o.rotation.set(0, t.ry, 0); o.scale.set(t.s, t.s * (0.88 + (t.tint - 0.82) * 0.5), t.s); o.updateMatrix();
      col.setRGB(t.tint, t.tint * (0.96 + (t.tint - 0.82) * 0.2), t.tint * 0.92);
      for (const m of parts) { m.setMatrixAt(k, o.matrix); m.setColorAt(k, col); }
      WORLD.treeRef[t.i] = v * 1e6 + k;
    });
    for (const m of parts) { m.count = list.length; m.castShadow = true; m.receiveShadow = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; root.add(m); }
    return { mesh: parts[1], parts, list };
  });
  const sg = paint(tube([vv(0, -0.05, 0), vv(0, 0.07, 0), vv(0, 0.09, 0)], [0.085, 0.075, 0.068], 7), (x, y) => y > 0.085 ? [...L3('#6e5c44'), 1] : [...L3('#3e3024'), 1]);
  const stumpA = hasAsset('tree_stump_01');
  WORLD.stumpS = stumpA ? 0.34 / Math.max(ASSETS.size.tree_stump_01.x, ASSETS.size.tree_stump_01.z) : 1;
  WORLD.stumps = new THREE.InstancedMesh(stumpA ? ASSETS.geo.tree_stump_01 : sg, stumpA ? ASSETS.mat.tree_stump_01 : barkM, 6000);
  WORLD.stumps.setColorAt(0, new THREE.Color(1, 1, 1)); WORLD.stumps.count = 0; WORLD.stumps.castShadow = false; WORLD.stumps.receiveShadow = true;
  root.add(WORLD.stumps);
}
function treeFell(i) {
  if (!WORLD) return;
  const ref = WORLD.treeRef[i]; if (ref < 0) return;
  WORLD.treeRef[i] = -1;
  const v = Math.floor(ref / 1e6), k = ref % 1e6, T = WORLD.trees[v], t = T.list[k];
  WORLD.falling.push({ T, k, t, a: 0, dir: rnd() * 6.28 });
  const o = new THREE.Object3D(); o.position.set(t.x, t.y, t.z); o.rotation.y = t.ry; o.scale.setScalar((0.8 + (t.s - 0.82) * 0.5) * (WORLD.stumpS || 1)); o.updateMatrix();
  if (WORLD.stumps.count < 6000) { WORLD.stumps.setColorAt(WORLD.stumps.count, new THREE.Color(0.9, 0.9, 0.9)); WORLD.stumps.setMatrixAt(WORLD.stumps.count++, o.matrix); WORLD.stumps.instanceMatrix.needsUpdate = true; WORLD.stumps.instanceColor.needsUpdate = true; }
  // the cleared spot greens up again, as a soft round patch
  const C = N * CTRL_RES, D = WORLD.ctrl.image.data, cx = (i % N + 0.5) * CTRL_RES, cz = (((i / N) | 0) + 0.5) * CTRL_RES, r = CTRL_RES * 0.85;
  for (let z = Math.max(0, Math.floor(cz - r)); z <= Math.min(C - 1, cz + r); z++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(C - 1, cx + r); x++) {
    const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / r; if (d >= 1) continue;
    const f = 1 - d * d, k = (z * C + x) * 4; D[k] = lerp(D[k], 200, f); D[k + 1] = lerp(D[k + 1], 55, f);
  }
  WORLD.ctrl.needsUpdate = true;
}
const _fo = new THREE.Object3D();
function updateFalling(dt) {
  if (!WORLD) return;
  for (const f of WORLD.falling) {
    f.a += dt * (0.5 + f.a * 3.2);
    const t = f.t, ang = Math.min(Math.PI / 2, f.a);
    _fo.position.set(t.x, t.y, t.z);
    _fo.rotation.set(0, 0, 0);
    _fo.quaternion.setFromAxisAngle(new THREE.Vector3(Math.cos(f.dir), 0, Math.sin(f.dir)), ang);
    _fo.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, t.ry, 0)));
    const s = f.a > Math.PI / 2 ? Math.max(0, 1 - (f.a - Math.PI / 2) * 1.5) : 1;
    _fo.scale.set(t.s * s, t.s * s, t.s * s);
    if (f.a > Math.PI / 2) _fo.position.y = t.y - (f.a - Math.PI / 2) * 0.3;
    _fo.updateMatrix();
    for (const m of f.T.parts) { m.setMatrixAt(f.k, _fo.matrix); m.instanceMatrix.needsUpdate = true; }
    if (s <= 0) f.done = true;
  }
  WORLD.falling = WORLD.falling.filter(f => !f.done);
}
// ---------- rocks: displaced spheres, smooth normals, lichen on top ----------
function vnoise3(seed) {
  const R = mulberry32(seed), P = new Float32Array(4096); for (let i = 0; i < 4096; i++) P[i] = R();
  const h = (x, y, z) => P[((x & 15) + ((y & 15) << 4) + ((z & 15) << 8)) & 4095];
  return (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(ix, iy, iz), h(ix + 1, iy, iz), u), l(h(ix, iy + 1, iz), h(ix + 1, iy + 1, iz), u), v), l(l(h(ix, iy, iz + 1), h(ix + 1, iy, iz + 1), u), l(h(ix, iy + 1, iz + 1), h(ix + 1, iy + 1, iz + 1), u), v), w);
  };
}
function rockGeo(seed, opt = {}) {
  const nz = vnoise3(seed), g = new THREE.SphereGeometry(1, opt.seg || 14, opt.seg ? Math.round(opt.seg * 0.7) : 10);
  const p = g.attributes.position, sq = opt.squash || 0.62, dd = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const crack = Math.pow(1 - Math.abs(nz(x * 3.1 + 2, y * 3.1, z * 3.1) * 2 - 1), 7);
    const d = 1 + (nz(x * 1.6 + 5, y * 1.6, z * 1.6) - 0.5) * 0.75 + (nz(x * 4 + 9, y * 4, z * 4) - 0.5) * 0.26 + (nz(x * 9, y * 9 + 3, z * 9) - 0.5) * 0.08 - crack * 0.09;
    dd[i] = d - crack * 0.25;
    x *= d * (opt.sx || 1); y *= d * sq; z *= d * (opt.sz || 1);
    if (y < -0.12) y = -0.12 + (y + 0.12) * 0.25;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  const n = g.attributes.normal, col = new Float32Array(p.count * 3);
  const base = L3(opt.col || '#8c877c'), moss = L3('#6b6a3a'), vein = opt.vein ? L3(opt.vein) : null;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = n.getY(i);
    let k = (0.62 + nz(x * 6, y * 6, z * 6) * 0.5) * clamp(0.55 + (dd[i] - 0.75) * 0.9, 0.35, 1.15); if (y < 0) k *= 0.7 + 0.3 * (1 + y / 0.12 * 0.5);
    let c = base.map(v => v * k);
    const m = clamp((ny - 0.55) * 2.2, 0, 1) * (nz(x * 3 + 40, y * 3, z * 3) > 0.5 ? 0.75 : 0.15) * (opt.moss === undefined ? 1 : opt.moss);
    c = c.map((v, j) => lerp(v, moss[j] * k, m));
    if (vein && Math.abs(nz(x * 2.5 + 11, y * 5, z * 2.5) - 0.5) < 0.022) c = vein.map(v => v * (0.9 + R0() * 0.3));
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.userData.keep = true;
  return g;
}
const R0 = mulberry32(1234);
function bushGeo(R, q, berry) {
  const A = { pos: [], nor: [], uv: [], col: [] }, C = new THREE.Vector3(0, 0.2, 0), RX = 0.34, RY = 0.25, n = [8, 12, 16, 18][q];
  for (let k = 0; k < n; k++) {
    const d = vrand(R); if (d.y < -0.2) d.y = -0.2 + R() * 0.2;
    const c = new THREE.Vector3(d.x * RX * (0.5 + R() * 0.5), C.y + d.y * RY * (0.5 + R() * 0.5), d.z * RX * (0.5 + R() * 0.5));
    const nrm = new THREE.Vector3().subVectors(c, C).normalize(); nrm.y += 0.4; nrm.normalize();
    const a1 = new THREE.Vector3().crossVectors(d, Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.19 + R() * 0.06);
    const a2 = new THREE.Vector3().crossVectors(d, a1).normalize().multiplyScalar(0.19 + R() * 0.06);
    cardQ(A, c, a1, a2, nrm, v => { const k2 = 0.45 + 0.6 * clamp(v[1] / 0.45, 0, 1); return [k2, k2, k2]; });
  }
  return cardGeo(A);
}
// ---------- scattered decor: rocks, bushes, reeds ----------
function buildDecor(root, R) {
  WORLD.decor = [];
  if (ASSETS.ready) return buildDecorPhoto(root, R);
  const q = QUAL.level;
  const rocks = [rockGeo(11, { seg: 12, col: '#7c776c' }), rockGeo(23, { seg: 12, squash: 0.8, sx: 1.2, col: '#77736a' }), rockGeo(37, { seg: 12, squash: 0.5, col: '#6f6a60' })];
  const bush = bushGeo(mulberry32(77), q), bush2 = bushGeo(mulberry32(78), q);
  const reedG = (() => { const parts = []; for (let k = 0; k < 7; k++) { const x = (R() - 0.5) * 0.25, z = (R() - 0.5) * 0.25, h = 0.55 + R() * 0.3; parts.push(paint(tube([vv(x, 0, z), vv(x + (R() - 0.5) * 0.05, h * 0.6, z), vv(x + (R() - 0.5) * 0.12, h, z + (R() - 0.5) * 0.06)], [0.01, 0.008, 0.002], 3), () => [...L3('#7d7a3e'), 1])); } parts.push(paint(xf(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), 0.05, 0.72, 0), () => [...L3('#5a3c22'), 1])); return merge(parts); })();
  const lists = { r0: [], r1: [], r2: [], bush: [], bush2: [], reed: [] };
  for (let i = 0; i < N * N; i++) {
    const tx = i % N, tz = (i / N) | 0, t = G.terr[i];
    if (G.tree[i] || G.dep[i] || G.bocc[i]) continue;
    if (t <= 2 && R() < 0.03) lists['r' + ((R() * 3) | 0)].push([tx + R(), tz + R(), R() * 6, 0.07 + R() * 0.12]);
    if (t <= 1 && R() < 0.022) lists[R() < 0.5 ? 'bush' : 'bush2'].push([tx + R(), tz + R(), R() * 6, 0.75 + R() * 0.6]);
    if ((t === 3 || t === 4) && R() < 0.35) { let wet = false; for (const [dx, dz] of DIRS) { const a = tx + dx, b = tz + dz; if (inMap(a, b) && G.terr[idx(a, b)] >= 4) wet = true; } if (wet) lists.reed.push([tx + R(), tz + R(), R() * 6, 0.8 + R() * 0.5]); }
  }
  // the forest edge gets undergrowth too
  for (let i = 0; i < N * N; i++) if (G.tree[i] && R() < 0.12) { const tx = i % N, tz = (i / N) | 0; lists[R() < 0.5 ? 'bush' : 'bush2'].push([tx + R(), tz + R(), R() * 6, 0.6 + R() * 0.5]); }
  const o = new THREE.Object3D(), col = new THREE.Color();
  const mk = (geo, list, mat, cast, depth) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((p, k) => { o.position.set(p[0], heightAt(p[0], p[1]) - 0.02, p[1]); o.rotation.set(0, p[2], 0); o.scale.set(p[3], p[3] * (0.8 + (k % 5) * 0.1), p[3]); o.updateMatrix(); m.setMatrixAt(k, o.matrix); const j = 0.85 + ((k * 37) % 11) / 11 * 0.3; col.setRGB(j, j, j * 0.95); m.setColorAt(k, col); });
    m.count = list.length; m.castShadow = cast; m.receiveShadow = true; if (depth) m.customDepthMaterial = depth; root.add(m); WORLD.decor.push(m); return m;
  };
  const rockM = M('decorRock2', { vertexColors: true, roughness: 0.9 });
  mk(rocks[0], lists.r0, rockM, true); mk(rocks[1], lists.r1, rockM, true); mk(rocks[2], lists.r2, rockM, true);
  const lm = leafMat('broad');
  mk(bush, lists.bush, lm, true, lm.userData.depth); mk(bush2, lists.bush2, leafMat('birch'), true, leafMat('birch').userData.depth);
  mk(reedG, lists.reed, M('decor', { vertexColors: true, roughness: 0.95 }, { wind: '0.05', windBase: '0.1' }), false);
}
// ---------- resource deposits ----------
function depositMesh(d) {
  const R = mulberry32(d.id * 31 + 7), g = new THREE.Group();
  const y = Math.max(0.05, heightAt(d.x, d.z));
  g.position.set(d.x, y, d.z);
  const parts = [];
  const rm = M('depRock', { vertexColors: true, roughness: 0.88 });
  const photo = ASSETS.ready && depositPhoto(d, g, R, parts);
  if (photo && d.type === 'stone') { /* scanned rocks only */ }
  else if (d.type === 'gold') {
    for (let k = 0; k < (photo ? 0 : 7); k++) {
      const a = k / 7 * 6.28 + R(), r = k ? 0.55 + R() * 0.3 : 0, s = 0.42 + R() * 0.28;
      const m = new THREE.Mesh(rockGeo(d.id * 13 + k, { seg: 16, squash: 0.85, col: '#4f473e', moss: 0.2, vein: '#c99a34' }), rm);
      m.position.set(Math.cos(a) * r, 0.1 + R() * 0.12, Math.sin(a) * r); m.scale.setScalar(s); m.rotation.y = R() * 6; parts.push(m);
    }
    const ore = M('goldOre', { color: '#e8b53a', roughness: 0.28, metalness: 1, emissive: '#3a2400', emissiveIntensity: 0.4 });
    for (let k = 0; k < 14; k++) { const a = R() * 6.28, r = R() * 0.95; const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.025 + R() * 0.035, 0), ore); m.position.set(Math.cos(a) * r, 0.3 + R() * 0.4, Math.sin(a) * r); m.rotation.set(R() * 3, R() * 3, R() * 3); parts.push(m); }
    const wood = M('mineWood', { color: '#6b4c30', roughness: 0.9 });
    for (const sx of [-0.35, 0.35]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 7), wood); p.position.set(sx, 0.45, 0.95); parts.push(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.12), wood); beam.position.set(0, 0.92, 0.95); parts.push(beam);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.8), M('mineDark', { color: '#0d0a08', roughness: 1 })); hole.position.set(0, 0.42, 0.9); parts.push(hole);
    const cartG = new THREE.Group(); cartG.position.set(0.75, 0, 1.25); cartG.rotation.y = 0.5;
    const cb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.28), wood); cb.position.y = 0.22; cartG.add(cb);
    for (const sx of [-0.13, 0.13]) for (const sz of [-0.15, 0.15]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 10), M('mineIron', { color: '#2a2826', roughness: 0.5, metalness: 0.7 })); w.rotation.x = Math.PI / 2; w.position.set(sx, 0.08, sz); cartG.add(w); }
    parts.push(cartG);
  } else if (d.type === 'stone') {
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * 6.28 + R(), r = k ? 0.5 + R() * 0.35 : 0, s = 0.4 + R() * 0.3;
      const m = new THREE.Mesh(rockGeo(d.id * 17 + k, { seg: 16, squash: 0.75, col: '#857f74', moss: 0.5 }), rm);
      m.position.set(Math.cos(a) * r, 0.12 + R() * 0.1, Math.sin(a) * r); m.scale.setScalar(s); m.rotation.y = R() * 6; parts.push(m);
    }
    const block = M('stoneBlock', { color: '#8e887c', roughness: 0.85 });
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24, 2, 1, 1), block); m.position.set(-0.6 + k * 0.3, 0.1 + (k === 1 || k === 3 ? 0.2 : 0), 0.95 + (k % 2) * 0.08); m.rotation.y = (R() - 0.5) * 0.3; parts.push(m); }
    for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(rockGeo(900 + k, { seg: 6, squash: 0.7, col: '#9a958a', moss: 0 }), rm); const a = R() * 6.28, r = 0.9 + R() * 0.4; m.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r); m.scale.setScalar(0.05 + R() * 0.05); parts.push(m); }
  } else {
    const lm = leafMat('broad', true);
    const bg = bushGeo(mulberry32(d.id + 5), Math.max(2, QUAL.level), true);
    // one waist-high bush and a smaller one beside it, so a patch reads as separate bushes rather than one hedge
    const berry = M('berry', { color: '#a3182a', roughness: 0.35, emissive: '#2a0006', emissiveIntensity: 0.5 });
    const bg2 = new THREE.SphereGeometry(0.019, 6, 4);
    const a0 = R() * 6.28, bushes = [[(R() - 0.5) * 0.12, (R() - 0.5) * 0.12, 0.66 + R() * 0.14], [Math.cos(a0) * 0.36, Math.sin(a0) * 0.3, 0.42 + R() * 0.12]];
    for (const [bx, bz, s] of bushes) {
      const m = new THREE.Mesh(bg, lm); m.customDepthMaterial = lm.userData.depth; m.position.set(bx, -0.02, bz); m.scale.set(s, s * (0.85 + R() * 0.2), s); m.rotation.y = R() * 6; parts.push(m);
      for (let k = 0, n = Math.round(26 * s); k < n; k++) {
        // berries sit on the outer shell where the leaves are, not buried in the middle
        const a = R() * 6.28, up = 0.15 + R() * 0.75, r = (0.25 + R() * 0.1) * Math.sqrt(1 - up * up * 0.6) * s;
        const b = new THREE.Mesh(bg2, berry); b.position.set(bx + Math.cos(a) * r, (0.16 + up * 0.32) * s, bz + Math.sin(a) * r); parts.push(b);
      }
    }
  }
  for (const m of parts) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  g.userData.parts = parts;
  WORLD.root.add(g);
  WORLD.deps.set(d.id, g);
}

function buildDecorPhoto(root, R) {
  const q = QUAL.level, S = N * TEX_PX, img = WORLD.alb.ctx.getImageData(0, 0, S, S).data;
  const dryAt = (x, z) => { const k = (Math.min(S - 1, (z * TEX_PX) | 0) * S + Math.min(S - 1, (x * TEX_PX) | 0)) * 4; return img[k] / Math.max(1, img[k + 1]); };
  const rock = ROCKS.map(() => []), shrub = SHRUBS.map(() => []), fern = FERNS.map(() => []), pebble = [], logs = [], stumps = [[], []], bush = [], bush2 = [], reed = [];
  const nearTree = (tx, tz) => { for (const [dx, dz] of DIRS) { const a = tx + dx, b = tz + dz; if (inMap(a, b) && G.tree[idx(a, b)]) return true; } return false; };
  for (let i = 0; i < N * N; i++) {
    const tx = i % N, tz = (i / N) | 0, t = G.terr[i];
    if (G.dep[i] || G.bocc[i]) continue;
    if (G.tree[i]) {
      if (R() < 0.3) fern[(R() * 4) | 0].push([tx + R(), tz + R(), R() * 6.28, 0.28 + R() * 0.22]);
      if (R() < 0.025) logs.push([tx + R(), tz + R(), R() * 6.28, 0.95 + R() * 0.4]);
      if (R() < 0.08) (R() < 0.5 ? bush : bush2).push([tx + R(), tz + R(), R() * 6, 0.6 + R() * 0.5]);
      continue;
    }
    if (t <= 2 && R() < 0.03) { const big = R() < 0.18; rock[(R() * ROCKS.length) | 0].push([tx + R(), tz + R(), R() * 6.28, big ? 0.4 + R() * 0.35 : 0.1 + R() * 0.22]); }
    if (t <= 2 && R() < (t === 2 ? 0.25 : 0.05)) pebble.push([tx + R(), tz + R(), R() * 6.28, 0.035 + R() * 0.05]);
    if (t <= 1 && R() < 0.024) { const x = tx + R(), z = tz + R(); if (dryAt(x, z) > 0.98) shrub[(R() * 4) | 0].push([x, z, R() * 6.28, 0.42 + R() * 0.32]); else (R() < 0.5 ? bush : bush2).push([x, z, R() * 6, 0.62 + R() * 0.45]); }
    if (t <= 1 && nearTree(tx, tz)) { if (R() < 0.12) fern[(R() * 4) | 0].push([tx + R(), tz + R(), R() * 6.28, 0.25 + R() * 0.2]); if (R() < 0.02) stumps[(R() * 2) | 0].push([tx + R(), tz + R(), R() * 6.28, 0.3 + R() * 0.12]); }
    if ((t === 3 || t === 4) && R() < 0.35) { let wet = false; for (const [dx, dz] of DIRS) { const a = tx + dx, b = tz + dz; if (inMap(a, b) && G.terr[idx(a, b)] >= 4) wet = true; } if (wet) reed.push([tx + R(), tz + R(), R() * 6, 0.8 + R() * 0.5]); }
  }
  const reg = m => { if (m) WORLD.decor.push(m); };
  ROCKS.forEach((n, k) => reg(assetScatter(root, n, rock[k], { sink: 0.12, tint: 0.95 })));
  SHRUBS.forEach((n, k) => reg(assetScatter(root, n, shrub[k], { sink: 0.02, tint: 1.05 })));
  FERNS.forEach((n, k) => reg(assetScatter(root, n, fern[k], { sink: 0.0, cast: q >= 2 })));
  reg(assetScatter(root, 'stone_01', pebble, { sink: 0.2, cast: false }));
  reg(assetScatter(root, 'dead_tree_trunk', logs, { sink: 0.08, tilt: 0.06 }));
  reg(assetScatter(root, 'tree_stump_01', stumps[0], { sink: 0.05 })); reg(assetScatter(root, 'tree_stump_02', stumps[1], { sink: 0.05 }));
  // green leaf-card bushes where the steppe is lush, and reeds along the water
  const o = new THREE.Object3D(), col = new THREE.Color();
  const mk = (geo, list, mat, cast, depth) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, k) => { o.position.set(p[0], heightAt(p[0], p[1]) - 0.02, p[1]); o.rotation.set(0, p[2], 0); o.scale.set(p[3], p[3] * (0.8 + (k % 5) * 0.1), p[3]); o.updateMatrix(); m.setMatrixAt(k, o.matrix); const j = 0.85 + ((k * 37) % 11) / 11 * 0.3; col.setRGB(j, j, j * 0.95); m.setColorAt(k, col); });
    m.castShadow = cast; m.receiveShadow = true; if (depth) m.customDepthMaterial = depth; root.add(m); WORLD.decor.push(m);
  };
  const lm = leafMat('broad'), lb = leafMat('birch');
  mk(bushGeo(mulberry32(77), q), bush, lm, true, lm.userData.depth); mk(bushGeo(mulberry32(78), q), bush2, lb, true, lb.userData.depth);
  const reedG = (() => { const parts = []; for (let k = 0; k < 7; k++) { const x = (R() - 0.5) * 0.25, z = (R() - 0.5) * 0.25, h = 0.55 + R() * 0.3; parts.push(paint(tube([vv(x, 0, z), vv(x + (R() - 0.5) * 0.05, h * 0.6, z), vv(x + (R() - 0.5) * 0.12, h, z + (R() - 0.5) * 0.06)], [0.01, 0.008, 0.002], 3), () => [...L3('#7d7a3e'), 1])); } parts.push(paint(xf(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 6), 0.05, 0.72, 0), () => [...L3('#5a3c22'), 1])); return merge(parts); })();
  mk(reedG, reed, M('decor', { vertexColors: true, roughness: 0.95 }, { wind: '0.05', windBase: '0.1' }), false);
}
function goldRockMat(name) {
  const key = 'goldrock_' + name; if (MATS[key]) return MATS[key];
  const s = ASSETS.mat[name];
  const m = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, roughness: 1, metalness: 0 });
  m.color.set('#6e5c48').convertSRGBToLinear();
  patchMat(m, { key }); return MATS[key] = m;
}
function depositPhoto(d, g, R, parts) {
  if (d.type === 'stone' || d.type === 'gold') {
    const gold = d.type === 'gold';
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.28 + R(), r = k ? 0.5 + R() * 0.35 : 0, n = ROCKS[(R() * ROCKS.length) | 0], size = (k ? 0.5 : 0.85) + R() * 0.35;
      const m = assetMesh(n, { w: size, mat: gold ? goldRockMat(n) : null });
      m.position.set(Math.cos(a) * r, -0.06, Math.sin(a) * r); m.rotation.y = R() * 6.28; parts.push(m);
    }
    for (let k = 0; k < 14; k++) { const a = R() * 6.28, r = 0.9 + R() * 0.5; const m = assetMesh('stone_01', { w: 0.05 + R() * 0.07 }); m.position.set(Math.cos(a) * r, -0.01, Math.sin(a) * r); m.rotation.y = R() * 6; m.castShadow = false; parts.push(m); }
    if (!gold) {
      const block = photoMat('stone', { rep: 0.6, tag: 'blk' }) || M('stoneBlock', { color: '#8e887c', roughness: 0.85 });
      for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.24, 2, 1, 1), block); m.position.set(-0.6 + k * 0.3, 0.1 + (k === 1 || k === 3 ? 0.2 : 0), 0.95 + (k % 2) * 0.08); m.rotation.y = (R() - 0.5) * 0.3; parts.push(m); }
    }
    return true;
  }
  return false;
}
