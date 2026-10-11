// Poly Haven assets -> lean game-ready GLBs: bake node transforms, recentre, decimate, swap in small textures
import { NodeIO, Document } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';
import fs from 'fs';
await MeshoptSimplifier.ready;
const io = new NodeIO();
const RAW = '/home/claude/ph_raw/models', SMALL = '/home/claude/ph_small/models', OUT = '/home/claude/rts17/assets_glb';
fs.mkdirSync(OUT, { recursive: true });
const CFG = [
  { id: 'boulder_01', t: 1600 }, { id: 'namaqualand_boulder_02', t: 1600 },
  { id: 'rock_moss_set_01', t: 750 }, { id: 'rock_moss_set_02', t: 650 },
  { id: 'rock_07', t: 320 }, { id: 'stone_01', t: 140 },
  { id: 'tree_stump_01', t: 1000 }, { id: 'tree_stump_02', t: 1000 }, { id: 'dead_tree_trunk', t: 1100 },
  { id: 'shrub_02', t: 2200, fol: true }, { id: 'shrub_03', t: 1100, fol: true, merge: true }, { id: 'shrub_04', t: 1600, fol: true },
  { id: 'fern_02', t: 700, fol: true },
  { id: 'cannon_01', per: { cannon_01_frame: 4200, cannon_01_barrel: 1600, cannon_01_pusherblock: 120 }, t: 280, skip: /ball/ },
  { id: 'wooden_barrels_01', t: 1300, skip: /piece/ }, { id: 'wine_barrel_01', t: 1300, merge: true },
  { id: 'wooden_crate_01', t: 700, merge: true }, { id: 'wooden_crate_02', t: 700, merge: true },
  { id: 'wooden_bucket_01', t: 600, merge: true }, { id: 'wicker_basket_01', t: 1000 }, { id: 'spinning_wheel_01', t: 1600 }, { id: 'wooden_ladder', t: 500, merge: true },
];
const mul = (m, x, y, z, w) => [m[0] * x + m[4] * y + m[8] * z + m[12] * w, m[1] * x + m[5] * y + m[9] * z + m[13] * w, m[2] * x + m[6] * y + m[10] * z + m[14] * w];
function grab(nodes) {
  const P = [], Nn = [], UV = [], I = []; let base = 0, mat = null;
  for (const n of nodes) {
    const m = n.getWorldMatrix(), mesh = n.getMesh(); if (!mesh) continue;
    for (const p of mesh.listPrimitives()) {
      mat = mat || p.getMaterial();
      const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices();
      const cnt = pos.getCount(), a = [], b = [], c = [];
      for (let i = 0; i < cnt; i++) {
        pos.getElement(i, a); P.push(...mul(m, a[0], a[1], a[2], 1));
        if (nor) { nor.getElement(i, b); const v = mul(m, b[0], b[1], b[2], 0), l = Math.hypot(...v) || 1; Nn.push(v[0] / l, v[1] / l, v[2] / l); } else Nn.push(0, 1, 0);
        if (uv) { uv.getElement(i, c); UV.push(c[0], c[1]); } else UV.push(0, 0);
      }
      const ic = idx.getCount(); for (let i = 0; i < ic; i++) I.push(idx.getScalar(i) + base);
      base += cnt;
    }
  }
  return { P: new Float32Array(P), N: new Float32Array(Nn), UV: new Float32Array(UV), I: new Uint32Array(I), mat };
}
function components(I, nv) {
  const par = new Int32Array(nv).map((_, i) => i); const f = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < I.length; t += 3) { const a = f(I[t]), b = f(I[t + 1]), c = f(I[t + 2]); par[b] = a; par[f(c)] = a; }
  const groups = new Map(); for (let t = 0; t < I.length; t += 3) { const r = f(I[t]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
  return [...groups.values()];
}
function weldG(g) {
  const key = new Map(), remap = new Uint32Array(g.P.length / 3);
  const P = [], N2 = [], UV = [];
  for (let v = 0; v < remap.length; v++) {
    const k = [g.P[v * 3], g.P[v * 3 + 1], g.P[v * 3 + 2]].map(x => Math.round(x * 1e4)).join(',') + '|' + [g.UV[v * 2], g.UV[v * 2 + 1]].map(x => Math.round(x * 1e4)).join(',');
    let id = key.get(k);
    if (id === undefined) { id = P.length / 3; key.set(k, id); P.push(g.P[v * 3], g.P[v * 3 + 1], g.P[v * 3 + 2]); N2.push(g.N[v * 3], g.N[v * 3 + 1], g.N[v * 3 + 2]); UV.push(g.UV[v * 2], g.UV[v * 2 + 1]); }
    else { N2[id * 3] += g.N[v * 3]; N2[id * 3 + 1] += g.N[v * 3 + 1]; N2[id * 3 + 2] += g.N[v * 3 + 2]; }
    remap[v] = id;
  }
  for (let i = 0; i < N2.length; i += 3) { const l = Math.hypot(N2[i], N2[i + 1], N2[i + 2]) || 1; N2[i] /= l; N2[i + 1] /= l; N2[i + 2] /= l; }
  return { ...g, P: new Float32Array(P), N: new Float32Array(N2), UV: new Float32Array(UV), I: g.I.map(i => remap[i]) };
}
function reduce(g, target, fol, rnd) {
  if (!fol) g = weldG(g);
  let I = g.I;
  if (I.length / 3 > target) {
    const [out] = MeshoptSimplifier.simplify(I, g.P, 3, Math.max(3, Math.floor(target * 3)), fol ? 0.08 : 0.25, []);
    I = out;
    if (!fol && I.length / 3 > target * 1.3) { const [o2] = MeshoptSimplifier.simplifySloppy(g.I, g.P, 3, null, Math.floor(target) * 3, 0.3); I = o2; }
  }
  if (fol && I.length / 3 > target * 1.15) {
    // drop whole leaves and enlarge the survivors so the crown keeps its coverage
    const comps = components(I, g.P.length / 3);
    const keep = Math.min(1, target / (I.length / 3)), grow = Math.min(1.6, 1 / Math.sqrt(keep));
    const nI = [], P = g.P.slice();
    const moved = new Set();
    for (const tris of comps) {
      if (rnd() > keep) continue;
      let cx = 0, cy = 0, cz = 0, n = 0; const vs = new Set();
      for (const t of tris) for (let k = 0; k < 3; k++) vs.add(I[t + k]);
      for (const v of vs) { cx += g.P[v * 3]; cy += g.P[v * 3 + 1]; cz += g.P[v * 3 + 2]; n++; }
      cx /= n; cy /= n; cz /= n;
      for (const v of vs) if (!moved.has(v)) { moved.add(v); P[v * 3] = cx + (g.P[v * 3] - cx) * grow; P[v * 3 + 1] = cy + (g.P[v * 3 + 1] - cy) * grow; P[v * 3 + 2] = cz + (g.P[v * 3 + 2] - cz) * grow; }
      for (const t of tris) nI.push(I[t], I[t + 1], I[t + 2]);
    }
    g = { ...g, P }; I = new Uint32Array(nI);
  }
  // compact vertices, recentre on the ground
  const map = new Int32Array(g.P.length / 3).fill(-1), P = [], N2 = [], UV = []; let n = 0;
  const outI = new Uint32Array(I.length);
  for (let i = 0; i < I.length; i++) { const v = I[i]; if (map[v] < 0) { map[v] = n++; P.push(g.P[v * 3], g.P[v * 3 + 1], g.P[v * 3 + 2]); N2.push(g.N[v * 3], g.N[v * 3 + 1], g.N[v * 3 + 2]); UV.push(g.UV[v * 2], g.UV[v * 2 + 1]); } outI[i] = map[v]; }
  return { P: new Float32Array(P), N: new Float32Array(N2), UV: new Float32Array(UV), I: outI, mat: g.mat };
}
const log = [];
for (const c of CFG) {
  const doc = await io.read(`${RAW}/${c.id}/${c.id}_1k.gltf`);
  const src = doc.getRoot();
  const nodes = src.listNodes().filter(n => n.getMesh() && !(c.skip && c.skip.test(n.getName())));
  const groups = c.merge ? [[c.id, nodes]] : nodes.map(n => [n.getName(), [n]]);
  const out = new Document(); const buf = out.createBuffer(); const scene = out.createScene(c.id + '_scene');
  const texCache = new Map();
  const tex = (t) => {
    if (!t) return null; const uri = t.getURI(); if (texCache.has(uri)) return texCache.get(uri);
    const p = `${SMALL}/${c.id}/${uri}`; const data = fs.readFileSync(p);
    const nt = out.createTexture(uri.split('/').pop()).setImage(new Uint8Array(data)).setMimeType('image/jpeg').setURI(uri.split('/').pop());
    texCache.set(uri, nt); return nt;
  };
  const matCache = new Map();
  const mkMat = (m) => {
    if (matCache.has(m)) return matCache.get(m);
    const nm = out.createMaterial(m.getName()).setBaseColorTexture(tex(m.getBaseColorTexture())).setNormalTexture(tex(m.getNormalTexture())).setMetallicRoughnessTexture(tex(m.getMetallicRoughnessTexture()))
      .setMetallicFactor(m.getMetallicFactor()).setRoughnessFactor(m.getRoughnessFactor()).setDoubleSided(!!c.fol);
    matCache.set(m, nm); return nm;
  };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [name, ns] of groups) {
    const raw = grab(ns);
    const target = (c.per && c.per[name]) || c.t;
    const g = reduce(raw, target, c.fol, rnd);
    if (!c.per) { // recentre each standalone variant
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9;
      for (let i = 0; i < g.P.length; i += 3) { x0 = Math.min(x0, g.P[i]); x1 = Math.max(x1, g.P[i]); y0 = Math.min(y0, g.P[i + 1]); z0 = Math.min(z0, g.P[i + 2]); z1 = Math.max(z1, g.P[i + 2]); }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; for (let i = 0; i < g.P.length; i += 3) { g.P[i] -= cx; g.P[i + 1] -= y0; g.P[i + 2] -= cz; }
    }
    const prim = out.createPrimitive()
      .setAttribute('POSITION', out.createAccessor().setType('VEC3').setArray(g.P).setBuffer(buf))
      .setAttribute('NORMAL', out.createAccessor().setType('VEC3').setArray(g.N).setBuffer(buf))
      .setAttribute('TEXCOORD_0', out.createAccessor().setType('VEC2').setArray(g.UV).setBuffer(buf))
      .setIndices(out.createAccessor().setType('SCALAR').setArray(g.P.length / 3 < 65535 ? new Uint16Array(g.I) : g.I).setBuffer(buf))
      .setMaterial(mkMat(raw.mat));
    const mesh = out.createMesh(name).addPrimitive(prim);
    scene.addChild(out.createNode(name).setMesh(mesh));
    let y1 = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < g.P.length; i += 3) { y1 = Math.max(y1, g.P[i + 1]); x0 = Math.min(x0, g.P[i]); x1 = Math.max(x1, g.P[i]); z0 = Math.min(z0, g.P[i + 2]); z1 = Math.max(z1, g.P[i + 2]); }
    log.push(`${name}: ${raw.I.length / 3} -> ${g.I.length / 3} tris, ${(x1 - x0).toFixed(2)}x${y1.toFixed(2)}x${(z1 - z0).toFixed(2)}`);
  }
  await io.write(`${OUT}/${c.id}.glb`, out);
}
console.log(log.join('\n'));
