// ================= building sync, construction, damage, collapse =================
const BENT = new Map();
let bRoot = null;
const MERGED = {};
function geoGroupSlice(geo, start, count) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const out = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv']) {
    const a = g.attributes[k]; if (!a) continue;
    out.setAttribute(k, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
  }
  return out;
}
function mergeList(list) {
  let total = 0; for (const it of list) total += it.geo.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const it of list) {
    const g = it.geo.clone(); g.applyMatrix4(it.matrix);
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere(); out.userData.keep = true;
  return out;
}
function collectAnimated(A) { const s = new Set(); for (const k in A) { const v = A[k]; if (v && v.isObject3D) s.add(v); } return s; }
function mergeStatic(group, key, skip) {
  const statics = group.children.filter(c => c.isMesh && !c.isInstancedMesh && !skip.has(c));
  if (statics.length < 2) return;
  let cached = MERGED[key];
  if (!cached) {
    const byMat = new Map();
    for (const m of statics) {
      m.updateMatrix();
      const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      if (Array.isArray(m.material)) {
        for (const gr of m.geometry.groups) { const mat = m.material[gr.materialIndex]; if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push({ geo: geoGroupSlice(geo, gr.start, gr.count), matrix: m.matrix }); }
      } else { if (!byMat.has(m.material)) byMat.set(m.material, []); byMat.get(m.material).push({ geo, matrix: m.matrix }); }
    }
    cached = MERGED[key] = [...byMat].map(([mat, list]) => ({ mat, geo: mergeList(list) }));
  }
  for (const m of statics) group.remove(m);
  for (const c of cached) { const m = new THREE.Mesh(c.geo, c.mat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
}
function buildingObj(b) {
  const o = makeBuilding(b.type, b.team, { scaffold: !b.done });
  const A = o.userData.anim;
  if (!BBOX[b.type]) { const bx = new THREE.Box3().setFromObject(A.core); if (isFinite(bx.min.x)) BBOX[b.type] = { x0: bx.min.x, x1: bx.max.x, z0: bx.min.z, z1: bx.max.z }; }
  mergeStatic(A.core, 'b_' + b.type, collectAnimated(A));
  if (A.scaffold) mergeStatic(A.scaffold, 'sc_' + b.type, new Set());
  o.position.set(b.x, b.y, b.z);
  o.userData.ent = b;
  return o;
}
function syncBuildings(dt, sdt) {
  if (!bRoot) { bRoot = new THREE.Group(); scene.add(bRoot); }
  const live = new Set();
  for (const b of G.builds) {
    const show = REVEAL || b.team === 0 || b.seen || G.teams[b.team].side === G.teams[0].side;
    let r = BENT.get(b.id);
    if (!r) { if (!show) continue; r = { b, obj: buildingObj(b) }; BENT.set(b.id, r); bRoot.add(r.obj); }
    live.add(b.id);
    r.obj.visible = show;
    animBuilding(r, dt, sdt);
  }
  for (const [id, r] of BENT) {
    if (live.has(id)) continue;
    r.dying = (r.dying || 0) + dt;
    const A = r.obj.userData.anim, k = r.dying;
    if (!r.boomed) { r.boomed = true; collapseFx(r.b); }
    A.core.scale.y = Math.max(0.1, 1 - k * 0.9);
    A.core.rotation.z = Math.sin(k * 9) * 0.03 * Math.max(0, 1 - k);
    r.obj.position.y = r.b.y - Math.max(0, k - 1) * 0.4;
    if (k > 2.6) { bRoot.remove(r.obj); BENT.delete(id); addRuin(r.b); }
  }
  smoulderRuins(sdt);
}
function animBuilding(r, dt, sdt) {
  const b = r.b, A = r.obj.userData.anim, t = U.time.value + b.anim;
  if (!b.done) {
    A.core.scale.y = 0.04 + 0.96 * clamp(b.prog, 0, 1);
    if (A.scaffold) A.scaffold.visible = true;
    if (A.crop) A.crop.visible = false;   // a field being laid out is bare ploughed earth until it is finished
  } else if (A.scaffold && A.scaffold.visible) { A.scaffold.visible = false; if (A.pile) A.pile.visible = false; A.core.scale.y = 1; if (A.crop) A.crop.visible = true; }
  if (A.flag) A.flag.rotation.y = Math.sin(t * 2.2) * 0.35 + Math.sin(t * 5.3) * 0.08;
  if (!r.obj.visible) return;
  if (b.done) {
    if (A.sails) A.sails.rotation.z -= dt * 1.1;
    if (A.crop) {
      // stubble -> green shoots -> tall green -> ripe gold, while a farmer works it
      const g = b.farmer ? ((G.t * 0.012 + b.anim) % 1) : 0.5;
      A.crop.scale.y = 0.18 + ss(Math.min(1, g / 0.55)) * 0.95;
      const ripe = ss((g - 0.45) / 0.4), c = A.crop.material.color;
      c.setRGB(lerp(0.42, 1.0, ripe), lerp(0.62, 0.92, ripe), lerp(0.22, 0.62, ripe));
    }
    if (A.smoke && sdt && rnd() < sdt * A.smoke.rate) emitSmoke(b.x + A.smoke.x, b.y + A.smoke.y, b.z + A.smoke.z, A.smoke.dark, A.smoke.big);
  }
  // damage: smoke then fire
  const hpk = b.hp / b.maxhp;
  if (b.done && sdt && hpk < 0.65) {
    const rate = (0.65 - hpk) * 14;
    const top = (BH[b.type] || 1.2) * 0.6;
    if (rnd() < sdt * rate) emitSmoke(b.x + rr(-0.35, 0.35) * b.w, b.y + top, b.z + rr(-0.35, 0.35) * b.h, true, true);
    if (hpk < 0.4 && rnd() < sdt * rate * 2.5) emitFire(b.x + rr(-0.35, 0.35) * b.w, b.y + top * rr(0.4, 1), b.z + rr(-0.35, 0.35) * b.h);
  }
}
const BH = { townhall: 3.5, house: 1.4, mill: 2.8, farm: 0.4, storehouse: 1.4, barracks: 1.8, stable: 1.6, blacksmith: 1.8, foundry: 2.2, tower: 3.2, church: 3.2 };
function clearBuildings() { if (bRoot) { for (const r of BENT.values()) bRoot.remove(r.obj); } BENT.clear(); if (RUINS) { for (const m of RUINS) bRoot.remove(m); RUINS.length = 0; } }
const RUINS = [], BBOX = {};
const RUIN_KIND = { tower: 'tower', foundry: 'stone', blacksmith: 'stone', house: 'house' };   // everything else is a log building
// a burnt-out building: ash and charred beams inside what is left of the walls, the way ruined villages actually look
// one-off pieces for a ruin: same texture scaling as boxGeo/cylGeo but not kept in the shared geometry cache
function rbox(w, h, d, tex = 1) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] * tex, uv.getY(i) * dims[f][1] * tex); }
  return g.toNonIndexed();
}
function rcyl(rt, rb, h, seg = 10, tex = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1), uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * Math.max(rt, rb) * tex, uv.getY(i) * h * tex);
  return g.toNonIndexed();
}
function addRuin(b) {
  if (b.type === 'farm') return;
  const M2 = bmats(), g = new THREE.Group(), R = mulberry32(b.id * 7 + 3), kind = RUIN_KIND[b.type] || 'log';
  const bb = BBOX[b.type] || { x0: -b.w * 0.36, x1: b.w * 0.36, z0: -b.h * 0.3, z1: b.h * 0.3 };
  const cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2, hx = Math.min((bb.x1 - bb.x0) / 2, b.w * 0.46), hz = Math.min((bb.z1 - bb.z0) / 2, b.h * 0.46);
  const ash = photoMat('stone', { color: '#4a4038', tag: 'ash', rep: 1.6 }) || M('ruinAsh', { color: '#2e2823', roughness: 1 }), char = M2.coal, burnt = M('ruinWood', { color: '#2a2019', roughness: 0.95 });
  const parts = [];   // [geometry, material, matrix]
  const put = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(cx + x, y, cz + z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)); parts.push([geo, mat, m]); };
  // a low lumpy mound of ash and fallen roof
  for (let k = 0; k < 3; k++) {
    // sunk into the ground so its edge is wherever the lumps meet the soil, not a clean oval
    const sx = hx * (0.6 + R() * 0.35), sz = hz * (0.6 + R() * 0.35), sy = 0.14 + R() * 0.12;
    const geo = jiggle(new THREE.SphereGeometry(1, 22, 9), 0.34, R).scale(sx, sy, sz); geo.computeVertexNormals();
    put(geo.toNonIndexed(), ash, (R() - 0.5) * hx * 0.5, -sy * 0.45, (R() - 0.5) * hz * 0.5);
  }
  // what is left of the walls, run round the footprint with gaps and a broken top
  const side = (len, fn) => { const n = Math.max(2, Math.round(len / 0.26)); for (let i = 0; i < n; i++) fn((i + 0.5) / n * len - len / 2, len / n, i / n); };
  const walls = [[hx, hz, 2 * hx, 0], [hx, -hz, 2 * hx, 0], [hz, hx, 2 * hz, 1], [hz, -hx, 2 * hz, 1]];
  if (kind === 'tower') {
    const rr0 = Math.min(hx, hz) * 0.92, n = 16;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, courses = 1 + Math.floor((0.5 + 0.5 * Math.sin(a * 2 + b.id)) * 4 + R() * 1.5);
      for (let c = 0; c < courses; c++) put(rbox(0.3, 0.15, 0.22, 1.2), M2.stone, Math.cos(a) * rr0, 0.075 + c * 0.15, Math.sin(a) * rr0, 0, -a + (R() - 0.5) * 0.12, (R() - 0.5) * 0.05);
    }
  } else if (kind === 'stone') {
    for (const [, off, len, ax] of walls) side(len, (t, w, u) => {
      if (R() < 0.2) return;
      const courses = 1 + Math.floor((0.5 + 0.5 * Math.sin(u * 5 + off * 3 + b.id)) * 3.5 + R());
      for (let c = 0; c < courses; c++) { const x = ax ? off : t, z = ax ? t : off; put(rbox(w * 0.96, 0.15, 0.2, 1.2), M2.stone, x, 0.075 + c * 0.15, z, 0, ax ? Math.PI / 2 : 0, (R() - 0.5) * 0.04); }
    });
  } else if (kind === 'house') {
    // stone footing, smoke-blackened stubs of the whitewashed corners, and the brick stove that always outlasts the fire
    for (const [, off, len, ax] of walls) side(len, (t, w) => { if (R() < 0.15) return; put(rbox(w * 0.96, 0.1, 0.16, 1.2), M2.stone, ax ? off : t, 0.05, ax ? t : off, 0, ax ? Math.PI / 2 : 0, 0); });
    const pl = M('ruinPlaster', { map: BT_TEX.plaster, color: '#9a928a', roughness: 0.95 });
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (R() < 0.35) continue;
      const h1 = 0.18 + R() * 0.32, l1 = 0.25 + R() * 0.3, l2 = 0.2 + R() * 0.3;
      put(rbox(l1, h1, 0.1), pl, sx * (hx - l1 / 2), 0.1 + h1 / 2, sz * hz);
      put(rbox(0.1, h1 * (0.6 + R() * 0.4), l2), pl, sx * hx, 0.1 + h1 * 0.4, sz * (hz - l2 / 2));
    }
    const st = 0.34 + R() * 0.08, sh = 0.55 + R() * 0.3;
    const sx0 = (R() - 0.5) * hx, sz0 = (R() - 0.5) * hz * 0.6, sr = R() * 0.2;
    put(rbox(st, sh, st), M2.brick, sx0, sh / 2, sz0, 0, sr, 0);
    if (R() < 0.6) { const ch = 0.3 + R() * 0.35; put(rbox(st * 0.5, ch, st * 0.5), M2.brick, sx0, sh + ch / 2, sz0, 0, sr, 0); }
  } else {
    // a burnt log crib: one or two courses of charred logs, broken where the fire ate through
    for (const [, off, len, ax] of walls) {
      for (let c = 0; c < 2; c++) {
        if (c && R() < 0.45) continue;
        let t0 = -len / 2 - 0.08;
        while (t0 < len / 2) {
          const l = Math.min(len / 2 + 0.08 - t0, 0.4 + R() * len * 0.6), keep = R() > 0.25 || c === 0 && l > len * 0.6;
          if (keep) { const r = 0.06 + R() * 0.015, x = ax ? off : t0 + l / 2, z = ax ? t0 + l / 2 : off; put(rcyl(r, r, l, 7), R() < 0.6 ? char : burnt, x, 0.07 + c * 0.13 + (ax ? 0.065 : 0), z, ax ? Math.PI / 2 : 0, 0, ax ? 0 : Math.PI / 2); }
          t0 += l + (R() < 0.5 ? 0.12 + R() * 0.2 : 0);
        }
      }
    }
  }
  // charred rafters fallen across the ash, a couple still leaning on the wall stubs
  const nb = 4 + Math.round((hx + hz) * 2);
  for (let k = 0; k < nb; k++) {
    const l = 0.45 + R() * Math.min(hx, hz) * 1.3, lean = k < 2 && kind !== 'tower' ? 0.35 + R() * 0.35 : (R() - 0.5) * 0.12;
    const ry = R() * TAU, x = (R() - 0.5) * hx * 1.2, z = (R() - 0.5) * hz * 1.2, y = 0.1 + Math.abs(Math.sin(lean)) * l * 0.5;
    put(rbox(0.07, 0.07, l), R() < 0.7 ? char : burnt, x, y, z, lean, ry, (R() - 0.5) * 0.1);
  }
  // a few loose stones
  const nr = 5 + Math.round((hx + hz) * 2);
  for (let k = 0; k < nr; k++) {
    const a = R() * TAU, d = 0.5 + R() * 0.65, x = Math.cos(a) * hx * d, z = Math.sin(a) * hz * d;
    if (hasAsset('stone_01')) { const m = assetMesh(ROCKS[(R() * ROCKS.length) | 0], { w: 0.08 + R() * 0.14 }); m.position.set(cx + x, 0.0, cz + z); m.rotation.y = R() * TAU; g.add(m); }
    else put(rbox(0.1, 0.07, 0.08), M2.stone, x, 0.035, z, R(), R() * 3, R());
  }
  // one mesh per material
  const byMat = new Map();
  for (const [geo, mat, mx] of parts) { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push({ geo, matrix: mx }); }
  for (const [mat, list] of byMat) { const m = new THREE.Mesh(mergeList(list), mat); m.castShadow = true; m.receiveShadow = true; m.geometry.userData.keep = false; g.add(m); }
  g.position.set(b.x, b.y, b.z);
  g.userData.t = G.t; g.userData.b = b;
  bRoot.add(g); RUINS.push(g);
  if (RUINS.length > 30) { const old = RUINS.shift(); bRoot.remove(old); old.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); }); }
  scorch(b.x, b.z, Math.max(b.w, b.h) * 0.75);
}
// ruins keep smouldering for a while after the fire
function smoulderRuins(sdt) {
  if (!sdt) return;
  for (const g of RUINS) {
    const age = G.t - g.userData.t; if (age > 50) continue;
    const b = g.userData.b, rate = 2.2 * (1 - age / 50);
    if (Math.random() < sdt * rate) emitSmoke(b.x + (Math.random() - 0.5) * b.w * 0.6, b.y + 0.15, b.z + (Math.random() - 0.5) * b.h * 0.6, true, age < 15);
  }
}
// ---------- placement hologram ----------
let GHOST = { mats: null, cache: {} };
function ghostFor(type) {
  if (!GHOST.mats) GHOST.mats = { ok: new THREE.MeshBasicMaterial({ color: '#86f0d8', transparent: true, opacity: 0.4, depthWrite: false }), bad: new THREE.MeshBasicMaterial({ color: '#ff6e52', transparent: true, opacity: 0.42, depthWrite: false }) };
  if (GHOST.cache[type]) return GHOST.cache[type];
  const o = makeBuilding(type, 0, {});
  o.traverse(m => { if (m.isMesh) { m.material = GHOST.mats.ok; m.castShadow = false; m.receiveShadow = false; } });
  const foot = new THREE.Mesh(new THREE.PlaneGeometry(BT[type].w, BT[type].h), new THREE.MeshBasicMaterial({ color: '#86f0d8', transparent: true, opacity: 0.25, depthWrite: false }));
  foot.rotation.x = -Math.PI / 2; foot.position.y = 0.04; o.add(foot); o.userData.foot = foot;
  o.visible = false; scene.add(o);
  return GHOST.cache[type] = o;
}
function updateGhost(p) {
  for (const k in GHOST.cache) GHOST.cache[k].visible = false;
  if (!p || p.tx === undefined) return;
  const d = BT[p.type], o = ghostFor(p.type), ok = canPlace(0, p.type, p.tx, p.tz);
  let h = 0, n = 0; for (let z = p.tz; z <= p.tz + d.h; z++) for (let x = p.tx; x <= p.tx + d.w; x++) { if (inMap(x, z)) { h += G.H[z * (N + 1) + x]; n++; } }
  o.position.set(p.tx + d.w / 2, h / Math.max(1, n) + 0.02, p.tz + d.h / 2);
  o.visible = true;
  const mat = ok ? GHOST.mats.ok : GHOST.mats.bad;
  o.traverse(m => { if (m.isMesh && m !== o.userData.foot) m.material = mat; });
  o.userData.foot.material.color.set(ok ? '#86f0d8' : '#ff6e52');
  GHOST.mats.ok.opacity = 0.32 + Math.sin(U.time.value * 5) * 0.08;
}
