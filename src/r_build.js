// ================= building models =================
let BT_TEX = null;
function makeBuildTextures() {
  const R = mulberry32(91);
  const T = {};
  T.thatch = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#8a7244'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 4200; k++) { const x = R() * w, y = R() * h, l = 10 + R() * 22; const v = R(); c.strokeStyle = v < 0.3 ? 'rgba(70,52,28,0.55)' : v < 0.7 ? 'rgba(186,156,96,0.6)' : 'rgba(214,186,124,0.5)'; c.lineWidth = 1 + R(); c.beginPath(); c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 3, y + l); c.stroke(); }
    for (let y = 0; y < h; y += 32) { c.fillStyle = 'rgba(50,36,18,0.25)'; c.fillRect(0, y + 28, w, 4); }
  }, [1, 1]);
  T.plaster = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ece6d6'; c.fillRect(0, 0, w, h);
    for (let k = 0; k < 900; k++) { const v = 200 + R() * 40; c.fillStyle = `rgba(${v},${v * 0.97},${v * 0.9},0.35)`; c.beginPath(); c.arc(R() * w, R() * h, 2 + R() * 9, 0, 7); c.fill(); }
    const g = c.createLinearGradient(0, h * 0.7, 0, h); g.addColorStop(0, 'rgba(120,100,70,0)'); g.addColorStop(1, 'rgba(120,100,70,0.35)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, [1, 1]);
  T.logs = canvasTex(256, 256, (c, w, h) => {
    for (let y = 0; y < h; y += 32) {
      const g = c.createLinearGradient(0, y, 0, y + 32);
      const b = 0.85 + R() * 0.3;
      g.addColorStop(0, `rgb(${60 * b},${42 * b},${26 * b})`); g.addColorStop(0.25, `rgb(${128 * b},${94 * b},${60 * b})`); g.addColorStop(0.6, `rgb(${112 * b},${80 * b},${50 * b})`); g.addColorStop(1, `rgb(${46 * b},${32 * b},${20 * b})`);
      c.fillStyle = g; c.fillRect(0, y, w, 32);
      for (let k = 0; k < 40; k++) { c.strokeStyle = 'rgba(40,26,14,0.35)'; c.lineWidth = 1; const x = R() * w; c.beginPath(); c.moveTo(x, y + 6 + R() * 20); c.lineTo(x + 20 + R() * 40, y + 6 + R() * 20); c.stroke(); }
    }
  }, [1, 1]);
  T.planks = canvasTex(256, 256, (c, w, h) => {
    for (let x = 0; x < w; x += 21) { const b = 0.8 + R() * 0.35; c.fillStyle = `rgb(${120 * b},${92 * b},${62 * b})`; c.fillRect(x, 0, 21, h); c.fillStyle = 'rgba(30,20,10,0.6)'; c.fillRect(x, 0, 2, h); for (let k = 0; k < 8; k++) { c.fillStyle = 'rgba(50,34,20,0.3)'; c.fillRect(x + 4 + R() * 14, R() * h, 1, 18 + R() * 40); } }
  }, [1, 1]);
  T.shingle = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5b5248'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 12; x < w + 24; x += 24) { const b = 0.75 + R() * 0.45; c.fillStyle = `rgb(${110 * b},${98 * b},${84 * b})`; c.fillRect(x - 11, y, 22, 15); c.fillStyle = 'rgba(20,16,12,0.5)'; c.fillRect(x - 11, y + 13, 22, 3); }
  }, [1, 1]);
  T.tiles = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#6e2e1e'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 18) for (let x = (y / 18 % 2) * 14; x < w + 28; x += 28) { const b = 0.8 + R() * 0.35; const g = c.createLinearGradient(x - 13, 0, x + 13, 0); g.addColorStop(0, `rgb(${120 * b},${48 * b},${30 * b})`); g.addColorStop(0.5, `rgb(${172 * b},${78 * b},${48 * b})`); g.addColorStop(1, `rgb(${110 * b},${44 * b},${28 * b})`); c.fillStyle = g; c.fillRect(x - 13, y, 26, 17); c.fillStyle = 'rgba(30,10,6,0.55)'; c.fillRect(x - 13, y + 15, 26, 3); }
  }, [1, 1]);
  T.stone = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5e5a52'; c.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) { const rh = 18 + R() * 16; let x = -R() * 30; while (x < w) { const rw = 26 + R() * 34, b = 0.75 + R() * 0.4; c.fillStyle = `rgb(${150 * b},${144 * b},${132 * b})`; c.fillRect(x + 2, y + 2, rw - 3, rh - 3); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + 2, y + 2, rw - 3, 3); x += rw; } y += rh; }
  }, [1, 1]);
  T.brick = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5a4a40'; c.fillRect(0, 0, w, h);
    for (let y = 0, r = 0; y < h; y += 12, r++) for (let x = (r % 2) * 16 - 16; x < w; x += 32) { const b = 0.75 + R() * 0.4; c.fillStyle = `rgb(${150 * b},${70 * b},${50 * b})`; c.fillRect(x + 1, y + 1, 30, 10); }
  }, [1, 1]);
  T.cloth = canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < w; i += 3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); } }, [1, 1]);
  T.wheat = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#b8963c'; c.fillRect(0, 0, w, h); for (let k = 0; k < 700; k++) { c.strokeStyle = R() < 0.5 ? 'rgba(232,200,110,0.8)' : 'rgba(140,108,40,0.7)'; c.beginPath(); const x = R() * w, y = R() * h; c.moveTo(x, y); c.lineTo(x + (R() - 0.5) * 2, y + 6 + R() * 8); c.stroke(); } }, [1, 1]);
  return T;
}
const BM = {}; // building materials, built after textures
function bmats() {
  if (BM.ready) return BM;
  BT_TEX = makeBuildTextures();
  const T = BT_TEX;
  Object.assign(BM, {
    thatch: photoMat('thatch', { color: '#d8c49a', ns: 1.2 }) || M('b_thatch', { map: T.thatch, roughness: 1 }),
    plaster: (ASSETS.ready && ASSETS.tex.plaster && ASSETS.tex.plaster.nor) ? M('b_plasterN', { map: T.plaster, normalMap: (() => { const t = ASSETS.tex.plaster.nor.clone(); t.needsUpdate = true; t.repeat.set(1.1, 1.1); return t; })(), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95 }) : M('b_plaster', { map: T.plaster, roughness: 0.95 }),
    logs: M('b_logs', { map: T.logs, roughness: 0.92 }),
    planks: photoMat('planks', { color: '#d8c0a0' }) || M('b_planks', { map: T.planks, roughness: 0.9 }),
    darkPlanks: photoMat('planks', { color: '#9a8470', tag: 'd' }) || M('b_dplanks', { map: T.planks, color: '#7d6a58', roughness: 0.9 }),
    shingle: M('b_shingle', { map: T.shingle, roughness: 0.9 }),
    tiles: M('b_tiles', { map: T.tiles, roughness: 0.75 }),
    stone: photoMat('stone', { ns: 1.3 }) || M('b_stone', { map: T.stone, roughness: 0.9 }),
    brick: M('b_brick', { map: T.brick, roughness: 0.88 }),
    wood: M('b_wood', { color: '#6b4c32', roughness: 0.88 }),
    darkWood: M('b_dwood', { color: '#3e2c1e', roughness: 0.9 }),
    ochre: M('b_ochre', { color: '#9c6a3a', roughness: 0.95 }),
    blue: M('b_blue', { color: '#3d6a9c', roughness: 0.7 }),
    window: M('b_window', { color: '#1c2228', roughness: 0.25, metalness: 0.4 }),
    glow: (() => { const m = lin(new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ffb050', emissiveIntensity: 1.4 })); patchMat(m); return m; })(),
    forge: (() => { const m = lin(new THREE.MeshStandardMaterial({ color: '#ff8a30', emissive: '#ff5a10', emissiveIntensity: 3 })); patchMat(m); return m; })(),
    gold: M('b_gold', { color: '#d9a63a', roughness: 0.25, metalness: 1 }),
    copper: M('b_copper', { color: '#5f9a7e', roughness: 0.5, metalness: 0.6 }),
    iron: M('b_iron', { color: '#3a3a3c', roughness: 0.45, metalness: 0.85 }),
    bronze: M('b_bronze', { color: '#8a6a3a', roughness: 0.35, metalness: 0.9 }),
    straw: M('b_straw', { color: '#c9a856', roughness: 1 }),
    hay: photoMat('thatch', { color: '#f0d890', tag: 'hay', rep: 1.4 }) || M('b_hay', { map: T.thatch, color: '#e0c070', roughness: 1 }),
    wheat: M('b_wheat', { map: T.wheat, roughness: 1 }, { wind: '0.25', windBase: '0.0', windSpeed: '2.0' }),
    wheatI: tintMat(M('b_wheatI', { vertexColors: true, roughness: 0.9 }, { wind: '1.6', windLin: '0.05', windBase: '0.05', windSpeed: '1.7', key: 'wh' })),
    stem: M('b_stem', { color: '#4a6a2a', roughness: 1 }),
    sunflower: M('b_sunfl', { color: '#e8b820', roughness: 0.8 }),
    clay: M('b_clay', { color: '#a5603a', roughness: 0.85 }),
    water: M('b_water', { color: '#2a4048', roughness: 0.1, metalness: 0.3 }),
    sail: M('b_sail', { map: T.cloth, color: '#e8e0cc', roughness: 1, side: THREE.DoubleSide }, { wind: '0.0' }),
    white: M('b_white', { color: '#e8e4da', roughness: 0.8 }),
    rope: M('b_rope', { color: '#a08a60', roughness: 1 }),
    burlap: M('b_burlap', { map: T.cloth, color: '#b39d72', roughness: 1 }),
    dirt: M('b_dirt', { color: '#5a4630', roughness: 1 }),
    coal: M('b_coal', { color: '#18161a', roughness: 0.6 }),
    scaffold: M('b_scaf', { color: '#a68450', roughness: 0.9 }),
  });
  BM.ready = true;
  return BM;
}
const TEAM_MATS = {};
function teamMat(t) { if (!TEAM_MATS[t]) TEAM_MATS[t] = M('team' + t, { color: TEAM_COLORS[t], roughness: 0.75, side: THREE.DoubleSide }, { wind: '0.0' }); return TEAM_MATS[t]; }

// ---------- primitive helpers with world-scaled UVs ----------
const GC = {};
function boxGeo(w, h, d, tex = 1) {
  const key = `b${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}_${tex}`;
  if (GC[key]) return GC[key];
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] * tex, uv.getY(i) * dims[f][1] * tex); }
  g.userData.keep = true;
  return GC[key] = g;
}
function cylGeo(rt, rb, h, seg = 10, tex = 1, open = false) {
  const key = `c${rt}_${rb}_${h}_${seg}_${tex}_${open}`;
  if (GC[key]) return GC[key];
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(rt, rb) * tex, uv.getY(i) * h * tex);
  g.userData.keep = true;
  return GC[key] = g;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; return m; }
function box(g, w, h, d, mat, x, y, z, ry = 0, tex = 1) { const m = mesh(boxGeo(w, h, d, tex), mat, x, y, z, 0, ry, 0); g.add(m); return m; }
function cyl(g, rt, rb, h, mat, x, y, z, seg = 10, rx = 0, rz = 0, tex = 1) { const m = mesh(cylGeo(rt, rb, h, seg, tex), mat, x, y, z, rx, 0, rz); g.add(m); return m; }
// gable roof: ridge along x, slopes toward +z and -z
function gableGeo(w, d, h, over = 0.12) {
  const key = `gable${w}_${d}_${h}_${over}`;
  if (GC[key]) return GC[key];
  const W = w / 2 + over, D = d / 2 + over, t = 0.06;
  const P = [], UV = [];
  const quad = (a, b, c, d2, uw, uh) => { P.push(...a, ...b, ...c, ...a, ...c, ...d2); UV.push(0, 0, uw, 0, uw, uh, 0, 0, uw, uh, 0, uh); };
  const sl = hyp(D, h);
  quad([-W, -t, D], [W, -t, D], [W, h, 0], [-W, h, 0], w * 1.2, sl * 1.2);
  quad([W, -t, -D], [-W, -t, -D], [-W, h, 0], [W, h, 0], w * 1.2, sl * 1.2);
  // underside
  quad([W, -t, D], [-W, -t, D], [-W, -t - 0.001, -D], [W, -t - 0.001, -D], 1, 1);
  // gable ends (triangles)
  P.push(-W + over, -t, D - over, -W + over, -t, -D + over, -W + over, h - over * 0.6, 0); UV.push(0, 0, d, 0, d / 2, h);
  P.push(W - over, -t, -D + over, W - over, -t, D - over, W - over, h - over * 0.6, 0); UV.push(0, 0, d, 0, d / 2, h);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.computeVertexNormals();
  g.addGroup(0, 18, 0); g.addGroup(18, 6, 1);
  g.userData.keep = true;
  return GC[key] = g;
}
function gable(g, w, d, h, roofMat, wallMat, x, y, z, ry = 0, over) {
  const m = new THREE.Mesh(gableGeo(w, d, h, over), [roofMat, wallMat]);
  m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
}
// hip roof: four slopes up to a short ridge (ridge along x)
function hipGeo(w, d, h, ridge, over = 0.15) {
  const key = `hip${w}_${d}_${h}_${ridge}_${over}`;
  if (GC[key]) return GC[key];
  const W = w / 2 + over, D = d / 2 + over, r = ridge / 2;
  const P = [], UV = [];
  const tri = (a, b, c, ua, ub, uc) => { P.push(...a, ...b, ...c); UV.push(...ua, ...ub, ...uc); };
  const A = [-W, 0, D], B = [W, 0, D], C = [W, 0, -D], Dd = [-W, 0, -D], E = [-r, h, 0], F = [r, h, 0];
  const s = 1.3;
  tri(A, B, F, [0, 0], [2 * W * s, 0], [(W + r) * s, h * s * 1.4]); tri(A, F, E, [0, 0], [(W + r) * s, h * s * 1.4], [(W - r) * s, h * s * 1.4]);
  tri(C, Dd, E, [0, 0], [2 * W * s, 0], [(W + r) * s, h * s * 1.4]); tri(C, E, F, [0, 0], [(W + r) * s, h * s * 1.4], [(W - r) * s, h * s * 1.4]);
  tri(B, C, F, [0, 0], [2 * D * s, 0], [D * s, h * s * 1.4]);
  tri(Dd, A, E, [0, 0], [2 * D * s, 0], [D * s, h * s * 1.4]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.computeVertexNormals();
  g.userData.keep = true;
  return GC[key] = g;
}
function hip(g, w, d, h, ridge, mat, x, y, z, ry = 0, over) { const m = mesh(hipGeo(w, d, h, ridge, over), mat, x, y, z, 0, ry); g.add(m); return m; }
function domeGeo(r, h, kind) {
  const key = `dome${r}_${h}_${kind}`;
  if (GC[key]) return GC[key];
  const pts = [];
  if (kind === 'onion') {
    const prof = [[1, 0], [1.08, 0.12], [1.18, 0.28], [1.12, 0.45], [0.88, 0.62], [0.55, 0.78], [0.25, 0.9], [0.1, 0.97], [0.06, 1.05], [0, 1.1]];
    for (const [a, b] of prof) pts.push(new THREE.Vector2(a * r, b * h));
  } else if (kind === 'tent') { pts.push(new THREE.Vector2(r, 0), new THREE.Vector2(r * 0.15, h), new THREE.Vector2(0, h * 1.02)); }
  else { for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * h)); } }
  const g = new THREE.LatheGeometry(pts, kind === 'tent' ? 8 : 16);
  g.userData.keep = true;
  return GC[key] = g;
}
function cross(g, x, y, z, s = 1) { const M2 = bmats(); box(g, 0.025 * s, 0.32 * s, 0.025 * s, M2.gold, x, y + 0.16 * s, z); box(g, 0.18 * s, 0.025 * s, 0.025 * s, M2.gold, x, y + 0.22 * s, z); box(g, 0.1 * s, 0.02 * s, 0.025 * s, M2.gold, x, y + 0.08 * s, z, 0.4); }
function flag(g, t, x, y, z, h = 1.2, size = 0.42) {
  const M2 = bmats();
  cyl(g, 0.018, 0.024, h, M2.darkWood, x, y + h / 2, z, 6);
  const f = new THREE.Group(); f.position.set(x, y + h - size * 0.32, z);
  const cloth = mesh(new THREE.PlaneGeometry(size, size * 0.62, 6, 2), teamMat(t), size / 2, 0, 0);
  cloth.castShadow = true; f.add(cloth);
  g.add(f);
  return f;
}
function windowAt(g, x, y, z, ry, w = 0.18, h = 0.22) {
  const M2 = bmats();
  box(g, w + 0.05, h + 0.05, 0.03, M2.darkWood, x, y, z, ry);
  const s = Math.sin(ry), c = Math.cos(ry);
  box(g, w, h, 0.02, M2.window, x + s * 0.012, y, z + c * 0.012, ry);
}
function fenceRun(g, x0, z0, x1, z1, M2, wattle) {
  const L = hyp(x1 - x0, z1 - z0), n = Math.max(2, Math.round(L / 0.35)), ang = Math.atan2(z1 - z0, x1 - x0);
  for (let k = 0; k <= n; k++) { const x = lerp(x0, x1, k / n), z = lerp(z0, z1, k / n); cyl(g, 0.018, 0.022, 0.42, M2.darkWood, x, 0.21, z, 5); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (wattle) for (let k = 0; k < 4; k++) { const m = box(g, L, 0.05, 0.035, M2.straw, cx, 0.12 + k * 0.07, cz, -ang); m.material = M2.wood; }
  else for (const y of [0.16, 0.32]) box(g, L, 0.035, 0.03, M2.wood, cx, y, cz, -ang);
}
function sunflower(g, x, z, h, M2) { cyl(g, 0.012, 0.016, h, M2.stem, x, h / 2, z, 5); const head = mesh(cylGeo(0.07, 0.07, 0.025, 10), M2.sunflower, x, h, z + 0.02, 1.2, 0, 0); g.add(head); const c = mesh(cylGeo(0.035, 0.035, 0.03, 8), M2.darkWood, x, h + 0.01, z + 0.04, 1.2, 0, 0); g.add(c); }
function barrel(g, x, z, M2, y = 0) { if (hasAsset('wine_barrel_01')) { const n = ['wine_barrel_01', 'wooden_barrels_01_barrel01', 'wooden_barrels_01_barrel02'][Math.floor(Math.abs(Math.sin(x * 12.9 + z * 78.2)) * 3)]; g.add(assetMesh(n, { h: 0.34, x, y, z, ry: x * 7 + z * 3 })); return; } cyl(g, 0.11, 0.1, 0.28, M2.wood, x, y + 0.14, z, 10); cyl(g, 0.115, 0.115, 0.03, M2.iron, x, y + 0.06, z, 10); cyl(g, 0.115, 0.115, 0.03, M2.iron, x, y + 0.22, z, 10); }
function crate(g, x, z, s, M2, y = 0, ry = 0) { if (hasAsset('wooden_crate_02')) { g.add(assetMesh(Math.sin(x * 9 + z * 5) > 0 ? 'wooden_crate_02' : 'wooden_crate_01', { w: 0.34 * s, x, y, z, ry })); return; } box(g, 0.26 * s, 0.26 * s, 0.26 * s, M2.planks, x, y + 0.13 * s, z, ry, 2); }
function logPile(g, x, z, M2, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry;
  for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - r; k++) { const m = mesh(cylGeo(0.075, 0.075, 0.8, 8, 2), M2.wood, (k - (2 - r) / 2) * 0.16, 0.075 + r * 0.13, 0, 0, 0, Math.PI / 2); m.rotation.set(0, 0, Math.PI / 2); m.rotation.y = 0; p.add(m); }
  g.add(p);
}
let SACK_GEO = null;
function sackGeo() {
  if (SACK_GEO) return SACK_GEO;
  const pts = [[0, 0], [0.09, 0.005], [0.125, 0.04], [0.135, 0.12], [0.12, 0.2], [0.07, 0.26], [0.035, 0.285], [0.04, 0.31], [0.025, 0.335], [0, 0.34]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 12); g.scale(1, 1, 0.75);
  const p = g.attributes.position, R = mulberry32(3);
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.02 && y < 0.3) { const k = 1 + (Math.sin(p.getX(i) * 40 + y * 30) * 0.03 + (R() - 0.5) * 0.02); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } }
  g.computeVertexNormals(); g.userData.keep = true;
  return SACK_GEO = g;
}
function cart(g, x, z, ry, M2) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
  box(c, 0.7, 0.05, 0.42, M2.planks, 0, 0.3, 0);
  for (const sd of [1, -1]) { box(c, 0.7, 0.12, 0.03, M2.planks, 0, 0.38, sd * 0.2); const w = mesh(cylGeo(0.19, 0.19, 0.04, 12), M2.darkWood, -0.05, 0.19, sd * 0.25, Math.PI / 2, 0, 0); c.add(w); }
  const sh = mesh(cylGeo(0.02, 0.025, 0.9, 5), M2.wood, 0.75, 0.22, 0, 0, 0, Math.PI / 2 - 0.18); c.add(sh);
  for (let k = 0; k < 3; k++) { const s = mesh(sackGeo(), M2.burlap, -0.18 + k * 0.18, 0.33, (k - 1) * 0.04, Math.PI / 2 - 0.2, 0, 0.1 * k); c.add(s); }
}
function well(g, x, z, M2) {
  if (hasAsset('wooden_bucket_01')) g.add(assetMesh('wooden_bucket_01', { h: 0.17, x: x + 0.12, y: 0.3, z: z + 0.2, ry: 0.4 }));
  cyl(g, 0.22, 0.24, 0.3, M2.stone, x, 0.15, z, 12, 0, 0, 2);
  cyl(g, 0.17, 0.17, 0.02, M2.water, x, 0.28, z, 12);
  // shadoof: a long sweep on a post
  cyl(g, 0.03, 0.04, 1.0, M2.darkWood, x + 0.45, 0.5, z, 6);
  const sweep = mesh(cylGeo(0.018, 0.025, 2.1, 6), M2.wood, x + 0.45, 1.0, z, 0, 0, 0); sweep.rotation.set(0, 0, 1.15); g.add(sweep);
  cyl(g, 0.006, 0.006, 0.7, M2.rope, x + 0.02, 0.85, z, 4);
  cyl(g, 0.05, 0.045, 0.1, M2.wood, x + 0.02, 0.5, z, 8);
}

// ---------- a wheat field: instanced tufts of stalks with ears, planted in rows ----------
let WHEAT_GEO = null;
function wheatGeo() {
  if (WHEAT_GEO) return WHEAT_GEO;
  const R = mulberry32(99), parts = [];
  for (let k = 0; k < 6; k++) {
    const a = R() * Math.PI * 2, r = R() * 0.022, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 0.3 + R() * 0.09;
    const lx = (R() - 0.5) * 0.05, lz = (R() - 0.5) * 0.05;
    const stem = tube([new THREE.Vector3(x, 0, z), new THREE.Vector3(x + lx * 0.4, h * 0.5, z + lz * 0.4), new THREE.Vector3(x + lx, h, z + lz)], [0.0032, 0.0028, 0.0024], 3);
    parts.push(paint(stem, (px, py) => { const k2 = 0.55 + 0.5 * py / h; return [0.62 * k2, 0.6 * k2, 0.34 * k2, 1]; }));
    // the ear: a slim spindle bowing a little, with whiskered awns
    const ear = new THREE.SphereGeometry(1, 6, 5).scale(0.011, 0.04, 0.009).rotateZ((R() - 0.5) * 0.5).translate(x + lx * 1.15, h + 0.035, z + lz * 1.15);
    parts.push(paint(ear, () => [1.05, 0.88, 0.5, 1]));
    for (let w = 0; w < 3; w++) { const aw = new THREE.CylinderGeometry(0.0006, 0.0012, 0.05, 3).rotateZ((R() - 0.5) * 0.7).rotateX((R() - 0.5) * 0.7).translate(x + lx * 1.2, h + 0.08, z + lz * 1.2); parts.push(paint(aw, () => [1.0, 0.86, 0.5, 1])); }
    // a leaf or two lower down
    const lf = tube([new THREE.Vector3(x, h * 0.25, z), new THREE.Vector3(x + Math.cos(a) * 0.03, h * 0.33, z + Math.sin(a) * 0.03), new THREE.Vector3(x + Math.cos(a) * 0.055, h * 0.28, z + Math.sin(a) * 0.055)], [0.004, 0.005, 0.001], 3, 1, 0.25);
    parts.push(paint(lf, () => [0.5, 0.52, 0.28, 1]));
  }
  WHEAT_GEO = merge(parts); WHEAT_GEO.userData.keep = true; WHEAT_GEO.computeBoundingSphere();
  return WHEAT_GEO;
}
function wheatField(size, q) {
  const rows = [8, 12, 17, 21][q], per = [12, 18, 26, 32][q];
  const R = mulberry32(7), geo = wheatGeo();
  const mat = bmats().wheatI.clone();
  const m = new THREE.InstancedMesh(geo, mat, rows * per);
  const o = new THREE.Object3D(); let n = 0;
  for (let r = 0; r < rows; r++) for (let k = 0; k < per; k++) {
    const x = -size / 2 + (k + 0.5) / per * size + (R() - 0.5) * 0.05, z = -size / 2 + (r + 0.5) / rows * size + (R() - 0.5) * 0.025;
    if (Math.hypot(x - 0.3, z - 0.2) < 0.22) continue;   // the scarecrow stands in a clearing
    o.position.set(x, 0, z); o.rotation.set((R() - 0.5) * 0.08, R() * 6.28, (R() - 0.5) * 0.08); o.scale.set(1, 0.85 + R() * 0.3, 1); o.updateMatrix();
    m.setMatrixAt(n++, o.matrix);
  }
  m.count = n; m.castShadow = q >= 2; m.receiveShadow = true;
  m.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.2, 0), size * 0.8);
  m.userData.wheat = true;
  return m;
}
// ---------- the buildings ----------
function makeBuilding(type, team, opts = {}) {
  const M2 = bmats(), g = new THREE.Group(), A = {};
  const d = BT[type];
  switch (type) {
    case 'house': {
      // whitewashed khata under a thatched hip roof
      box(g, 1.55, 0.14, 1.15, M2.ochre, 0, 0.07, 0.02);
      box(g, 1.45, 0.72, 1.05, M2.plaster, 0, 0.5, 0);
      hip(g, 1.45, 1.05, 0.82, 0.6, M2.thatch, 0, 0.86, 0, 0, 0.2);
      box(g, 0.28, 0.6, 0.03, M2.planks, -0.38, 0.44, 0.53); box(g, 0.33, 0.05, 0.04, M2.darkWood, -0.38, 0.76, 0.53);
      for (const x of [0.05, 0.42]) { windowAt(g, x, 0.58, 0.53, 0); box(g, 0.07, 0.24, 0.02, M2.blue, x - 0.13, 0.58, 0.54); box(g, 0.07, 0.24, 0.02, M2.blue, x + 0.13, 0.58, 0.54); }
      windowAt(g, 0.73, 0.58, 0.1, Math.PI / 2);
      box(g, 0.16, 0.42, 0.16, M2.clay, 0.32, 1.5, -0.1);
      A.smoke = { x: 0.32, y: 1.75, z: -0.1, dark: false, rate: 0.6 };
      fenceRun(g, -0.95, 0.95, 0.2, 0.95, M2, true);
      fenceRun(g, -0.95, 0.95, -0.95, -0.5, M2, true);
      sunflower(g, -0.7, 0.8, 0.62, M2); sunflower(g, -0.48, 0.82, 0.55, M2); sunflower(g, 0.05, 0.8, 0.68, M2);
      if (hasAsset('wicker_basket_01')) { g.add(assetMesh('wicker_basket_01', { w: 0.16, x: 0.3, y: 0, z: 0.72, ry: 0.5 })); g.add(assetMesh('wooden_bucket_01', { h: 0.15, x: -0.15, y: 0, z: 0.7, ry: 1.1 })); }
      cyl(g, 0.05, 0.035, 0.1, M2.clay, -0.95, 0.47, 0.95, 8);
      A.flag = flag(g, team, 0.88, 0, 0.88, 0.95, 0.28);
      break;
    }
    case 'townhall': {
      // stone footing, log hall with shingled hip roof, front tower with onion cupola
      box(g, 3.5, 0.24, 2.7, M2.stone, 0, 0.12, -0.15, 0, 1.2);
      box(g, 3.2, 1.25, 2.3, M2.logs, 0, 0.86, -0.15, 0, 1.4);
      hip(g, 3.2, 2.3, 1.15, 1.6, M2.shingle, 0, 1.48, -0.15, 0, 0.22);
      // gallery with posts across the front
      box(g, 3.2, 0.08, 0.55, M2.planks, 0, 0.3, 1.2);
      for (let k = 0; k < 7; k++) cyl(g, 0.04, 0.045, 0.95, M2.wood, -1.5 + k * 0.5, 0.78, 1.42, 7);
      box(g, 3.35, 0.06, 0.7, M2.shingle, 0, 1.28, 1.2, 0, 1.5).rotation.x = 0.18;
      for (const x of [-1.1, -0.55, 0.55, 1.1]) windowAt(g, x, 0.95, 0.96, 0, 0.22, 0.3);
      box(g, 0.42, 0.7, 0.04, M2.darkPlanks, 0, 0.66, 0.97);
      // tower
      box(g, 0.74, 1.55, 0.74, M2.logs, 0, 1.92, 0.25, 0, 1.4);
      box(g, 0.84, 0.08, 0.84, M2.planks, 0, 2.73, 0.25);
      for (const [x, z] of [[-0.33, -0.08], [0.33, -0.08], [-0.33, 0.58], [0.33, 0.58]]) cyl(g, 0.035, 0.035, 0.42, M2.wood, x, 2.98, z, 6);
      box(g, 0.82, 0.08, 0.82, M2.planks, 0, 3.22, 0.25);
      const bell = mesh(domeGeo(0.12, 0.19, 'round'), M2.bronze, 0, 2.9, 0.25, Math.PI, 0, 0); bell.position.y = 3.15; g.add(bell);
      cyl(g, 0.34, 0.34, 0.2, M2.planks, 0, 3.36, 0.25, 8, 0, 0, 2);
      g.add(mesh(domeGeo(0.34, 0.62, 'onion'), M2.copper, 0, 3.46, 0.25));
      cross(g, 0, 4.15, 0.25, 0.8);
      // clock face
      cyl(g, 0.16, 0.16, 0.03, M2.white, 0, 2.38, 0.63, 16, Math.PI / 2);
      box(g, 0.015, 0.11, 0.02, M2.iron, 0, 2.42, 0.65); box(g, 0.08, 0.015, 0.02, M2.iron, 0.03, 2.38, 0.65);
      well(g, -1.45, 1.75, M2);
      barrel(g, 1.45, 1.65, M2); barrel(g, 1.62, 1.45, M2); crate(g, 1.25, 1.8, 1, M2);
      A.flag = flag(g, team, 1.75, 0, -1.3, 2.4, 0.6);
      A.smoke = { x: -1.0, y: 2.6, z: -0.6, rate: 0.5 };
      box(g, 0.2, 0.5, 0.2, M2.brick, -1.0, 2.35, -0.6);
      break;
    }
    case 'mill': {
      // post windmill on a trestle
      // trestle: two crossed sills on stone piers, four quarter-bars braced up to the post
      for (const [x, z] of [[-0.95, 0], [0.95, 0], [0, -0.95], [0, 0.95]]) box(g, 0.26, 0.2, 0.26, M2.stone, x, 0.1, z, 0.3, 2);
      box(g, 2.0, 0.12, 0.13, M2.darkWood, 0, 0.26, 0); box(g, 0.13, 0.12, 2.0, M2.darkWood, 0, 0.27, 0);
      for (const [x, z] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const m = cyl(g, 0.045, 0.055, 1.05, M2.wood, x * 0.45, 0.66, z * 0.45, 6); m.rotation.set(z * 0.78, 0, -x * 0.78); }
      cyl(g, 0.12, 0.14, 1.3, M2.darkWood, 0, 0.9, 0, 8);
      const body = new THREE.Group(); body.position.set(0, 1.45, 0); g.add(body);
      box(body, 1.05, 1.25, 1.2, M2.planks, 0, 0.62, 0, 0, 1.6);
      gable(body, 1.05, 1.2, 0.55, M2.shingle, M2.planks, 0, 1.25, 0, Math.PI / 2, 0.08);
      box(body, 0.32, 0.55, 0.04, M2.darkPlanks, 0, 0.33, -0.61);
      windowAt(body, 0.53, 0.75, 0.1, Math.PI / 2, 0.16, 0.18);
      // tail pole and steps
      const tail = mesh(cylGeo(0.03, 0.04, 1.8, 6), M2.wood, 0, -0.35, -1.0, 0.95, 0, 0); body.add(tail);
      const sails = new THREE.Group(); sails.position.set(0, 1.0, 0.72); body.add(sails);
      sails.add(mesh(cylGeo(0.07, 0.07, 0.3, 8), M2.darkWood, 0, 0, 0, Math.PI / 2, 0, 0));
      for (let k = 0; k < 4; k++) {
        const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; sails.add(arm);
        arm.add(mesh(boxGeo(0.06, 1.75, 0.05), M2.wood, 0, 0.9, 0.08));
        for (let j = 0; j < 6; j++) arm.add(mesh(boxGeo(0.34, 0.025, 0.025), M2.wood, 0.12, 0.35 + j * 0.27, 0.1));
        const cl = mesh(new THREE.PlaneGeometry(0.3, 1.35), M2.sail, 0.13, 1.05, 0.1); arm.add(cl);
      }
      A.sails = sails;
      for (let k = 0; k < 4; k++) { const s = mesh(sackGeo(), M2.burlap, 0.82 + (k % 2) * 0.24, 0.0, 0.62 + Math.floor(k / 2) * 0.22, 0, k * 1.3, (k === 3 ? 1.35 : 0)); if (k === 3) s.position.y = 0.09; g.add(s); }
      cart(g, 1.1, 1.2, -0.6, M2);
      A.flag = flag(g, team, -1.1, 0, 0.9, 1.0, 0.3);
      break;
    }
    case 'farm': {
      // fenced wheat field with a scarecrow
      const crop = wheatField(2.62, QUAL.level); g.add(crop);
      A.crop = crop;
      fenceRun(g, -1.45, 1.45, 1.45, 1.45, M2); fenceRun(g, -1.45, -1.45, 1.45, -1.45, M2);
      fenceRun(g, -1.45, -1.45, -1.45, 1.45, M2); fenceRun(g, 1.45, -1.45, 1.45, 0.4, M2);
      cyl(g, 0.02, 0.025, 1.0, M2.darkWood, 0.3, 0.5, 0.2, 5); box(g, 0.5, 0.03, 0.03, M2.darkWood, 0.3, 0.75, 0.2);
      box(g, 0.2, 0.28, 0.12, M2.straw, 0.3, 0.75, 0.2); g.add(mesh(new THREE.SphereGeometry(0.08, 8, 6), M2.straw, 0.3, 0.97, 0.2));
      g.add(mesh(cylGeo(0.13, 0.13, 0.02, 10), M2.straw, 0.3, 1.04, 0.2)); g.add(mesh(cylGeo(0.06, 0.08, 0.08, 10), M2.straw, 0.3, 1.08, 0.2));
      break;
    }
    case 'storehouse': {
      box(g, 1.55, 0.95, 1.2, M2.logs, 0, 0.48, -0.15, 0, 1.4);
      gable(g, 1.55, 1.2, 0.62, M2.shingle, M2.planks, 0, 0.95, -0.15, 0, 0.16);
      box(g, 0.55, 0.62, 0.04, M2.darkPlanks, -0.15, 0.32, 0.46);
      logPile(g, 0.5, 0.75, M2, 0.1);
      barrel(g, -0.75, 0.68, M2); crate(g, -0.5, 0.78, 1, M2, 0, 0.3); crate(g, -0.5, 0.78, 0.8, M2, 0.26, 0.6);
      for (let k = 0; k < 3; k++) box(g, 0.26, 0.18, 0.22, M2.stone, 0.85, 0.09 + (k === 2 ? 0.18 : 0), -0.6 + (k % 2) * 0.24, 0.2);
      A.flag = flag(g, team, -0.85, 0, -0.8, 1.2, 0.3);
      break;
    }
    case 'barracks': {
      box(g, 3.3, 0.16, 1.6, M2.stone, 0, 0.08, -0.45, 0, 1.2);
      box(g, 3.1, 1.0, 1.4, M2.logs, 0, 0.66, -0.45, 0, 1.4);
      gable(g, 3.1, 1.4, 0.75, M2.shingle, M2.logs, 0, 1.16, -0.45, 0, 0.18);
      for (const x of [-1.1, -0.4, 0.4, 1.1]) windowAt(g, x, 0.8, 0.26, 0, 0.2, 0.24);
      box(g, 0.36, 0.62, 0.04, M2.darkPlanks, 0, 0.47, 0.27);
      // drill yard: pike rack, straw targets, palisade corner
      for (let k = 0; k < 6; k++) { const m = cyl(g, 0.012, 0.012, 1.8, M2.wood, -1.3 + k * 0.08, 0.85, 0.75, 4); m.rotation.z = -0.18; }
      box(g, 0.6, 0.04, 0.05, M2.darkWood, -1.1, 0.5, 0.78);
      for (const x of [0.6, 1.1]) { cyl(g, 0.02, 0.02, 0.8, M2.darkWood, x, 0.4, 0.85, 5); g.add(mesh(cylGeo(0.14, 0.14, 0.06, 12), M2.straw, x, 0.72, 0.85, Math.PI / 2, 0, 0)); g.add(mesh(cylGeo(0.06, 0.06, 0.065, 10), M2.clay, x, 0.72, 0.86, Math.PI / 2, 0, 0)); }
      for (let k = 0; k < 9; k++) { const m = cyl(g, 0.05, 0.06, 0.9 + (k % 2) * 0.12, M2.wood, 1.95, 0.45, -1.2 + k * 0.17, 6); m.position.y = 0.48; }
      A.flag = flag(g, team, -1.75, 0, 1.05, 2.1, 0.62);
      A.smoke = { x: 1.1, y: 1.9, z: -0.7, rate: 0.4 };
      box(g, 0.18, 0.45, 0.18, M2.brick, 1.1, 1.65, -0.7);
      break;
    }
    case 'stable': {
      box(g, 3.2, 0.12, 1.6, M2.dirt, 0, 0.06, -0.4);
      box(g, 3.0, 1.0, 0.22, M2.planks, 0, 0.55, -1.08, 0, 1.6);
      for (const x of [-1.5, 1.5]) box(g, 0.12, 1.0, 1.3, M2.planks, x, 0.55, -0.5, 0, 1.6);
      for (let k = 0; k <= 5; k++) { cyl(g, 0.045, 0.05, 1.05, M2.wood, -1.5 + k * 0.6, 0.55, 0.12, 6); if (k > 0 && k < 5) box(g, 0.06, 0.55, 0.9, M2.darkPlanks, -1.5 + k * 0.6, 0.32, -0.55); }
      gable(g, 3.15, 1.6, 0.7, M2.thatch, M2.planks, 0, 1.07, -0.45, 0, 0.18);
      // hay and trough, a paddock rail
      for (let k = 0; k < 3; k++) box(g, 0.34, 0.22, 0.24, M2.hay, -1.25 + k * 0.38, 0.11 + (k === 1 ? 0.22 : 0), 0.62, (k - 1) * 0.2);
      box(g, 0.8, 0.16, 0.22, M2.planks, 0.85, 0.12, 0.62); box(g, 0.72, 0.02, 0.15, M2.water, 0.85, 0.2, 0.62);
      fenceRun(g, -1.95, 1.05, 1.95, 1.05, M2);
      A.flag = flag(g, team, 1.85, 0, -1.25, 1.8, 0.5);
      break;
    }
    case 'blacksmith': {
      box(g, 2.2, 0.55, 1.7, M2.stone, 0, 0.28, -0.2, 0, 1.3);
      box(g, 2.2, 0.6, 1.7, M2.plaster, 0, 0.85, -0.2);
      for (const x of [-1.05, -0.35, 0.35, 1.05]) box(g, 0.08, 0.6, 0.06, M2.darkWood, x, 0.85, 0.66);
      box(g, 2.25, 0.07, 0.06, M2.darkWood, 0, 0.58, 0.66); box(g, 2.25, 0.07, 0.06, M2.darkWood, 0, 1.13, 0.66);
      gable(g, 2.2, 1.7, 0.75, M2.tiles, M2.plaster, 0, 1.15, -0.2, 0, 0.16);
      // open forge
      box(g, 0.7, 0.55, 0.05, M2.coal, -0.55, 0.32, 0.67);
      A.forge = box(g, 0.5, 0.18, 0.06, M2.forge, -0.55, 0.22, 0.68);
      box(g, 0.28, 1.1, 0.28, M2.brick, -0.75, 1.7, -0.5);
      A.smoke = { x: -0.75, y: 2.3, z: -0.5, dark: true, rate: 1.2 };
      // anvil, grindstone, weapons rack
      box(g, 0.24, 0.1, 0.12, M2.iron, 0.25, 0.32, 0.95); box(g, 0.12, 0.25, 0.1, M2.darkWood, 0.25, 0.13, 0.95);
      if (hasAsset('wooden_bucket_01')) { g.add(assetMesh('wooden_bucket_01', { h: 0.16, x: -0.06, y: 0, z: 1.0 })); barrel(g, 1.0, 0.95, M2); }
      g.add(mesh(cylGeo(0.16, 0.16, 0.06, 14), M2.stone, 0.75, 0.3, 0.95, 0, 0, Math.PI / 2));
      for (let k = 0; k < 4; k++) { const m = box(g, 0.025, 0.65, 0.02, M2.iron, 0.55 + k * 0.08, 0.38, 0.72); m.rotation.z = -0.15; }
      A.flag = flag(g, team, 1.2, 0, 1.15, 1.4, 0.35);
      break;
    }
    case 'foundry': {
      box(g, 2.4, 1.25, 1.9, M2.brick, 0, 0.63, -0.25, 0, 1.4);
      gable(g, 2.4, 1.9, 0.6, M2.tiles, M2.brick, 0, 1.25, -0.25, 0, 0.12);
      cyl(g, 0.24, 0.3, 3.0, M2.brick, 0.75, 1.7, -0.65, 10, 0, 0, 1.4);
      cyl(g, 0.27, 0.27, 0.12, M2.stone, 0.75, 3.2, -0.65, 10);
      A.smoke = { x: 0.75, y: 3.35, z: -0.65, dark: true, rate: 2.2, big: true };
      box(g, 0.8, 0.85, 0.05, M2.coal, -0.3, 0.43, 0.71);
      A.forge = box(g, 0.6, 0.35, 0.06, M2.forge, -0.3, 0.3, 0.72);
      // finished barrels cooling on cradles
      for (let k = 0; k < 3; k++) { box(g, 0.08, 0.12, 0.3, M2.darkWood, -0.95 + k * 0.32, 0.06, 1.1); const b = mesh(cylGeo(0.06, 0.09, 0.95, 10), M2.bronze, -0.95 + k * 0.32, 0.18, 1.0, Math.PI / 2, 0, 0); g.add(b); }
      for (let k = 0; k < 6; k++) { const s = mesh(new THREE.SphereGeometry(0.06, 8, 6), M2.iron, 0.6 + (k % 3) * 0.13, 0.06 + (k > 2 ? 0.1 : 0), 0.95 + (k > 2 ? 0.06 : 0)); g.add(s); }
      g.add(mesh(new THREE.ConeGeometry(0.35, 0.3, 8), M2.coal, 1.0, 0.15, 0.4));
      A.flag = flag(g, team, -1.3, 0, 1.25, 1.6, 0.4);
      break;
    }
    case 'tower': {
      cyl(g, 0.78, 0.86, 0.3, M2.stone, 0, 0.15, 0, 14, 0, 0, 1.2);
      cyl(g, 0.68, 0.76, 2.3, M2.stone, 0, 1.4, 0, 14, 0, 0, 1.2);
      cyl(g, 0.8, 0.8, 0.12, M2.stone, 0, 2.6, 0, 14);
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; cyl(g, 0.04, 0.04, 0.55, M2.wood, Math.cos(a) * 0.72, 2.92, Math.sin(a) * 0.72, 5); }
      box(g, 1.5, 0.05, 0.05, M2.wood, 0, 2.85, 0.72); box(g, 1.5, 0.05, 0.05, M2.wood, 0, 2.85, -0.72);
      g.add(mesh(domeGeo(0.98, 1.0, 'tent'), M2.shingle, 0, 3.18, 0));
      box(g, 0.3, 0.55, 0.05, M2.darkPlanks, 0, 0.55, 0.74);
      for (const a of [0.6, 2.2, 3.8, 5.0]) box(g, 0.06, 0.22, 0.05, M2.window, Math.cos(a) * 0.7, 1.6, Math.sin(a) * 0.7, -a + Math.PI / 2);
      A.flag = flag(g, team, 0, 4.1, 0, 0.8, 0.35);
      A.gunner = true;
      break;
    }
    case 'church': {
      // three log frames stepping up to the centre, each under a pear-shaped dome
      box(g, 2.6, 0.18, 1.3, M2.stone, 0, 0.09, 0, 0, 1.2);
      box(g, 1.0, 1.7, 1.0, M2.logs, 0, 1.0, 0, 0, 1.4);
      box(g, 0.8, 1.2, 0.85, M2.logs, -0.92, 0.75, 0, 0, 1.4);
      box(g, 0.8, 1.2, 0.85, M2.logs, 0.92, 0.75, 0, 0, 1.4);
      hip(g, 0.8, 0.85, 0.35, 0.0, M2.shingle, -0.92, 1.35, 0, 0, 0.12);
      hip(g, 0.8, 0.85, 0.35, 0.0, M2.shingle, 0.92, 1.35, 0, 0, 0.12);
      hip(g, 1.0, 1.0, 0.45, 0.0, M2.shingle, 0, 1.85, 0, 0, 0.14);
      cyl(g, 0.34, 0.38, 0.55, M2.logs, 0, 2.45, 0, 8, 0, 0, 1.4);
      cyl(g, 0.42, 0.42, 0.06, M2.shingle, 0, 2.74, 0, 8);
      g.add(mesh(domeGeo(0.36, 0.75, 'onion'), M2.gold, 0, 2.78, 0));
      cross(g, 0, 3.6, 0, 1.2);
      for (const x of [-0.92, 0.92]) { cyl(g, 0.2, 0.22, 0.3, M2.logs, x, 1.7, 0, 8, 0, 0, 1.4); g.add(mesh(domeGeo(0.22, 0.48, 'onion'), M2.copper, x, 1.86, 0)); cross(g, x, 2.38, 0, 0.8); }
      box(g, 0.32, 0.6, 0.05, M2.darkPlanks, 0.92, 0.45, 0.44);
      windowAt(g, 0, 1.2, 0.51, 0, 0.16, 0.3); windowAt(g, -0.92, 0.8, 0.44, 0, 0.14, 0.22);
      // small bell frame
      for (const x of [-1.15, -0.75]) cyl(g, 0.03, 0.035, 1.0, M2.darkWood, x, 0.5, 1.0, 6);
      box(g, 0.5, 0.05, 0.06, M2.darkWood, -0.95, 1.0, 1.0);
      g.add(mesh(domeGeo(0.09, 0.14, 'round'), M2.bronze, -0.95, 0.96, 1.0, Math.PI, 0, 0));
      A.flag = flag(g, team, 1.35, 0, 1.1, 1.3, 0.32);
      break;
    }
  }
  const root = new THREE.Group(); root.add(g); A.core = g;
  if (opts.scaffold && type === 'farm') {
    // a new field is staked out and ploughed, not scaffolded: corner stakes and a bundle of fence rails
    const sc = new THREE.Group(), hw = d.w / 2 - 0.05, hd = d.h / 2 - 0.05;
    for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) sc.add(mesh(cylGeo(0.022, 0.026, 0.34, 5), M2.wood, x, 0.17, z, 0.08, 0, -0.06));
    for (let k = 0; k < 5; k++) sc.add(mesh(boxGeo(1.1, 0.035, 0.035), M2.wood, hw + 0.25, 0.02 + (k % 2) * 0.035, -0.4 + k * 0.05, 0, 1.5 + k * 0.03, 0));
    root.add(sc); A.scaffold = sc;
  } else if (opts.scaffold) {
    const sc = new THREE.Group(), hw = d.w / 2 - 0.1, hd = d.h / 2 - 0.1, H = Math.min(2.2, 0.8 + d.w * 0.35);
    for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd], [0, hd], [0, -hd]]) sc.add(mesh(boxGeo(0.05, H, 0.05), M2.scaffold, x, H / 2, z));
    for (let y = 0.45; y < H; y += 0.55) { sc.add(mesh(boxGeo(d.w - 0.2, 0.04, 0.04), M2.scaffold, 0, y, hd)); sc.add(mesh(boxGeo(d.w - 0.2, 0.04, 0.04), M2.scaffold, 0, y, -hd)); sc.add(mesh(boxGeo(0.04, 0.04, d.h - 0.2), M2.scaffold, hw, y, 0)); sc.add(mesh(boxGeo(0.04, 0.04, d.h - 0.2), M2.scaffold, -hw, y, 0)); }
    sc.add(mesh(boxGeo(d.w - 0.1, 0.06, d.h - 0.1), M2.planks, 0, 0.03, 0));
    root.add(sc); A.scaffold = sc;
    const lp = new THREE.Group(); logPile(lp, hw + 0.35, hd + 0.3, M2, 0.3); root.add(lp); A.pile = lp;
  }
  root.userData.anim = A;
  return root;
}
