// ================= particles, projectiles, decals, markers, overlay, minimap =================
const FX = { root: null };
function softTex(kind) {
  return canvasTex(64, 64, (c, w, h) => {
    if (kind === 'smoke') {
      const R = mulberry32(3);
      for (let i = 0; i < 22; i++) { const x = 18 + R() * 28, y = 18 + R() * 28, r = 8 + R() * 16; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    } else { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }
  }, null, false);
}
function makePS(max, tex, blending, order) {
  const g = new THREE.BufferGeometry();
  const at = (n, s) => { const a = new THREE.BufferAttribute(new Float32Array(max * s), s); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(n, a); return a; };
  at('position', 3); at('color', 4); at('size', 1); at('rot', 1);
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, uScale: { value: 800 }, uFog: U.fog, uFogOn: U.fogOn },
    vertexShader: `attribute float size; attribute float rot; attribute vec4 color; uniform float uScale; varying vec4 vC; varying float vR; varying vec3 vW;
      void main(){ vC = color; vR = rot; vW = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * uScale / max(0.5, -mv.z), 512.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform sampler2D uFog; uniform float uFogOn; varying vec4 vC; varying float vR; varying vec3 vW;
      void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
        vec4 t = texture2D(map, p); float fv = mix(1.0, texture2D(uFog, vW.xz / ${N.toFixed(1)}).r, uFogOn);
        gl_FragColor = vec4(vC.rgb * t.rgb * fv, t.a * vC.a); }`,
    transparent: true, depthWrite: false, blending,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = order;
  const S = { pts, g, m, max, n: 0, d: new Float32Array(max * 16) };
  FX.root.add(pts);
  return S;
}
// particle record: x y z vx vy vz life max s0 s1 r g b a grav drag
function spawn(S, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0) {
  if (S.n >= S.max) return;
  const o = S.n++ * 16, d = S.d;
  d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz; d[o + 6] = life; d[o + 7] = life;
  d[o + 8] = s0; d[o + 9] = s1; d[o + 10] = r; d[o + 11] = g; d[o + 12] = b; d[o + 13] = a; d[o + 14] = grav; d[o + 15] = drag;
}
const WIND = { x: 0.22, z: 0.09 };
function updatePS(S, dt) {
  const d = S.d, P = S.g.attributes.position.array, C = S.g.attributes.color.array, Z = S.g.attributes.size.array, RT = S.g.attributes.rot.array;
  let w = 0;
  for (let i = 0; i < S.n; i++) {
    const o = i * 16;
    d[o + 6] -= dt;
    if (d[o + 6] <= 0) continue;
    const drag = Math.max(0, 1 - d[o + 15] * dt);
    d[o + 3] = d[o + 3] * drag + WIND.x * dt * (d[o + 15] > 0 ? 0.6 : 0); d[o + 5] = d[o + 5] * drag + WIND.z * dt * (d[o + 15] > 0 ? 0.6 : 0);
    d[o + 4] = d[o + 4] * drag - d[o + 14] * dt;
    d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
    if (d[o + 14] > 0) { const gy = heightAt(d[o], d[o + 2]); if (d[o + 1] < gy) { d[o + 1] = gy; d[o + 4] *= -0.25; d[o + 3] *= 0.5; d[o + 5] *= 0.5; } }
    if (w !== i) for (let k = 0; k < 16; k++) d[w * 16 + k] = d[o + k];
    const q = w * 16, k = 1 - d[q + 6] / d[q + 7];
    P[w * 3] = d[q]; P[w * 3 + 1] = d[q + 1]; P[w * 3 + 2] = d[q + 2];
    C[w * 4] = d[q + 10]; C[w * 4 + 1] = d[q + 11]; C[w * 4 + 2] = d[q + 12];
    C[w * 4 + 3] = d[q + 13] * Math.min(1, k * 8) * (1 - k) * (1 - k * 0.3);
    Z[w] = lerp(d[q + 8], d[q + 9], Math.sqrt(k));
    RT[w] = (q * 0.37 + k * 0.6) % 6.28;
    w++;
  }
  S.n = w;
  S.g.setDrawRange(0, w);
  for (const k of ['position', 'color', 'size', 'rot']) S.g.attributes[k].needsUpdate = true;
  S.m.uniforms.uScale.value = VH * DPR / (2 * Math.tan(camera.fov * Math.PI / 360));
}
function initFx() {
  if (FX.root) scene.remove(FX.root);
  FX.root = new THREE.Group(); scene.add(FX.root);
  FX.soft = makePS(7000, softTex('smoke'), THREE.NormalBlending, 6);
  FX.add = makePS(2500, softTex('glow'), THREE.AdditiveBlending, 7);
  // cannonballs
  FX.balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.065, 8, 6), M('ball', { color: '#1d1c1b', roughness: 0.4, metalness: 0.7 }), 200);
  FX.balls.count = 0; FX.balls.frustumCulled = false; FX.balls.castShadow = true; FX.root.add(FX.balls);
  // scorch decals
  const st = canvasTex(128, 128, (c, w, h) => { const R = mulberry32(9); for (let i = 0; i < 18; i++) { const x = 64 + (R() - 0.5) * 40, y = 64 + (R() - 0.5) * 40, r = 14 + R() * 28; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(24,18,12,0.26)'); g.addColorStop(1, 'rgba(24,18,12,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); } c.fillStyle = 'rgba(20,14,10,0.3)'; for (let i = 0; i < 70; i++) { const a = R() * 6.28, d = R() * 40; c.beginPath(); c.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d * 0.9, 0.8 + R() * 1.8, 0, 6.28); c.fill(); } }, null, true);
  FX.decal = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 240);
  FX.decal.count = 0; FX.decal.frustumCulled = false; FX.decal.renderOrder = 1; FX.root.add(FX.decal);
  FX.decals = [];
  // selection and order markers
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  FX.rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.84, 1, 36).rotateX(-Math.PI / 2), ringMat, 1200);
  FX.rings.setColorAt(0, new THREE.Color(1, 1, 1)); FX.rings.count = 0; FX.rings.frustumCulled = false; FX.rings.renderOrder = 3; FX.root.add(FX.rings);
  FX.squares = new THREE.InstancedMesh(new THREE.RingGeometry(0.95, 1, 4, 1).rotateZ(Math.PI / 4).rotateX(-Math.PI / 2), ringMat, 120);
  FX.squares.setColorAt(0, new THREE.Color(1, 1, 1)); FX.squares.count = 0; FX.squares.frustumCulled = false; FX.squares.renderOrder = 3; FX.root.add(FX.squares);
  FX.marks = [];
  // rally flag and line
  const fg = new THREE.Group();
  fg.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 5), new THREE.MeshBasicMaterial({ color: '#e8e2d4' }), 0, 0.5, 0));
  FX.rallyCloth = mesh(new THREE.PlaneGeometry(0.4, 0.26), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[0], side: THREE.DoubleSide }), 0.2, 0.85, 0);
  fg.add(FX.rallyCloth); fg.visible = false; FX.rally = fg; FX.root.add(fg);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  FX.rallyLine = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: '#f0e6c8', dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.8, depthWrite: false }));
  FX.rallyLine.frustumCulled = false; FX.rallyLine.visible = false; FX.root.add(FX.rallyLine);
}
// ---------- emitters ----------
const SMOKE_C = [0.86, 0.85, 0.82];
function emitSmoke(x, y, z, dark, big) {
  const c = dark ? 0.16 + rnd() * 0.06 : 0.62 + rnd() * 0.1;
  spawn(FX.soft, x + rr(-0.05, 0.05), y, z + rr(-0.05, 0.05), rr(-0.05, 0.05), big ? rr(0.5, 0.8) : rr(0.35, 0.55), rr(-0.05, 0.05), big ? rr(4, 6) : rr(3, 4.5), big ? 0.5 : 0.25, big ? 2.6 : 1.3, c, c * 0.97, c * 0.93, dark ? 0.55 : 0.4, 0, 0.15);
}
function emitFire(x, y, z) {
  spawn(FX.add, x, y, z, rr(-0.1, 0.1), rr(0.6, 1.1), rr(-0.1, 0.1), rr(0.4, 0.8), rr(0.3, 0.55), 0.1, 1, rr(0.45, 0.7), 0.15, 0.85, 0, 0.5);
  if (rnd() < 0.3) spawn(FX.add, x, y, z, rr(-0.3, 0.3), rr(1, 2), rr(-0.3, 0.3), 0.9, 0.05, 0.02, 1, 0.7, 0.3, 1, 0.5, 0.2);
}
function gunSmoke(x, y, z, ang, k = 1) {
  const fx = Math.cos(ang), fz = Math.sin(ang);
  spawn(FX.add, x + fx * 0.08, y, z + fz * 0.08, fx * 0.5, 0, fz * 0.5, 0.09, 0.45 * k, 0.6 * k, 1, 0.75, 0.35, 1, 0, 0);
  spawn(FX.add, x, y, z, 0, 0, 0, 0.06, 0.25 * k, 0.3 * k, 1, 0.95, 0.75, 1, 0, 0);
  const n = Math.round(3 * k);
  for (let i = 0; i < n; i++) {
    const s = rr(0.4, 1.4);
    spawn(FX.soft, x + fx * 0.1 * i, y + rr(-0.03, 0.05), z + fz * 0.1 * i, fx * s + rr(-0.15, 0.15), rr(0.04, 0.16), fz * s + rr(-0.15, 0.15), rr(3.5, 6) * (k > 1 ? 1.3 : 1), 0.18 * k, rr(1.1, 1.8) * k, SMOKE_C[0], SMOKE_C[1], SMOKE_C[2], 0.5, 0, 1.6);
  }
}
function dirtBurst(x, z, k = 1) {
  const y = Math.max(heightAt(x, z), 0);
  for (let i = 0; i < 10 * k; i++) { const a = rr(0, 6.28), v = rr(0.6, 2.4) * k; spawn(FX.soft, x, y + 0.05, z, Math.cos(a) * v, rr(1.5, 4) * k, Math.sin(a) * v, rr(0.6, 1.1), 0.08, 0.06, 0.18, 0.13, 0.09, 1, 9.8, 0); }
  for (let i = 0; i < 5 * k; i++) spawn(FX.soft, x + rr(-0.2, 0.2), y + 0.1, z + rr(-0.2, 0.2), rr(-0.4, 0.4), rr(0.3, 0.9), rr(-0.4, 0.4), rr(1.5, 2.8), 0.4 * k, 1.6 * k, 0.48, 0.4, 0.3, 0.55, 0, 0.8);
}
function collapseFx(b) {
  for (let i = 0; i < 26; i++) spawn(FX.soft, b.x + rr(-0.5, 0.5) * b.w, b.y + rr(0.1, 1.2), b.z + rr(-0.5, 0.5) * b.h, rr(-0.8, 0.8), rr(0.3, 1.2), rr(-0.8, 0.8), rr(2.5, 4.5), 0.6, 2.4, 0.52, 0.46, 0.38, 0.6, 0, 0.6);
  for (let i = 0; i < 18; i++) emitFire(b.x + rr(-0.4, 0.4) * b.w, b.y + rr(0.1, 1), b.z + rr(-0.4, 0.4) * b.h);
  for (let i = 0; i < 20; i++) { const a = rr(0, 6.28), v = rr(1, 3); spawn(FX.soft, b.x, b.y + 0.8, b.z, Math.cos(a) * v, rr(2, 5), Math.sin(a) * v, 1.2, 0.12, 0.1, 0.22, 0.16, 0.1, 1, 9.8, 0); }
}
function scorch(x, z, r) {
  FX.decals.push({ x, z, r, t: G.t, rot: rnd() * 6.28 });
  if (FX.decals.length > 220) FX.decals.shift();
}
function processSimFx() {
  for (const f of G.fx) {
    if (f.done) continue;
    if (f.delay && f.max - f.life < f.delay) continue;
    f.done = true;
    if (!visibleAt(f.x, f.z) && f.t !== 'collapse') continue;
    const gy = Math.max(heightAt(f.x, f.z), 0), y = gy + (f.h || 0);
    switch (f.t) {
      case 'musket': gunSmoke(f.x, y, f.z, f.ang, 1); break;
      case 'cannonfire': gunSmoke(f.x, y, f.z, f.ang, 2.6); for (let i = 0; i < 8; i++) { const a = rr(0, 6.28); spawn(FX.soft, f.x, gy + 0.05, f.z, Math.cos(a) * 1.2, 0.05, Math.sin(a) * 1.2, 1.4, 0.3, 1.1, 0.6, 0.53, 0.42, 0.4, 0, 1.2); } break;
      case 'hit': spawn(FX.soft, f.x, y, f.z, 0, 0.3, 0, 0.5, 0.12, 0.35, 0.42, 0.24, 0.2, 0.7, 0, 1); spawn(FX.add, f.x, y, f.z, 0, 0, 0, 0.06, 0.12, 0.16, 1, 0.8, 0.5, 0.8, 0, 0); break;
      case 'miss': spawn(FX.soft, f.x, gy + 0.05, f.z, 0, 0.4, 0, 0.6, 0.08, 0.3, 0.5, 0.42, 0.32, 0.55, 0, 1); break;
      case 'impact': dirtBurst(f.x, f.z, f.big ? 1.4 : 1.2); spawn(FX.add, f.x, y + 0.1, f.z, 0, 0.5, 0, 0.18, 0.6, 1.0, 1, 0.6, 0.25, 0.9, 0, 0); if (!f.big) scorch(f.x, f.z, 0.55); break;
      case 'skip': dirtBurst(f.x, f.z, 0.5); break;
      case 'splash': for (let i = 0; i < 16; i++) { const a = rr(0, 6.28), v = rr(0.2, 1); spawn(FX.soft, f.x, 0.02, f.z, Math.cos(a) * v, rr(2, 4), Math.sin(a) * v, 0.9, 0.08, 0.14, 0.85, 0.9, 0.92, 0.8, 9.8, 0); } break;
      case 'heal': spawn(FX.add, f.x + rr(-0.15, 0.15), y, f.z + rr(-0.15, 0.15), 0, 0.5, 0, 1, 0.1, 0.05, 1, 0.85, 0.4, 0.8, 0, 0); break;
    }
  }
}
// ---------- per frame ----------
const _o3 = new THREE.Object3D(), _col = new THREE.Color();
function drawFx(dt, alpha) {
  processSimFx();
  updatePS(FX.soft, dt); updatePS(FX.add, dt);
  // cannonballs with a smoky trail
  let n = 0;
  for (const p of G.projs) {
    if (n >= 200) break;
    _o3.position.set(p.x, p.y, p.z); _o3.rotation.set(0, 0, 0); _o3.scale.setScalar(1); _o3.updateMatrix();
    FX.balls.setMatrixAt(n++, _o3.matrix);
    if (visibleAt(p.x, p.z) && rnd() < 0.6) spawn(FX.soft, p.x, p.y, p.z, 0, 0.05, 0, 0.7, 0.06, 0.3, 0.75, 0.74, 0.72, 0.35, 0, 1);
  }
  FX.balls.count = n; FX.balls.instanceMatrix.needsUpdate = true;
  // decals
  let k = 0;
  for (const d of FX.decals) {
    const age = G.t - d.t; if (age > 120) continue;
    _o3.position.set(d.x, Math.max(heightAt(d.x, d.z), 0) + 0.03, d.z); _o3.rotation.set(0, d.rot, 0); _o3.scale.set(d.r * 2.4, 1, d.r * 2.4); _o3.updateMatrix();
    FX.decal.setMatrixAt(k++, _o3.matrix);
  }
  FX.decal.count = k; FX.decal.instanceMatrix.needsUpdate = true;
  drawMarkers(dt, alpha);
}
function drawMarkers(dt, alpha) {
  let n = 0, q = 0;
  const pulse = 0.85 + Math.sin(U.time.value * 6) * 0.1;
  for (const e of UI.sel) {
    if (e.hp <= 0) continue;
    _col.set(e.team === 0 ? '#9ff5c0' : enemies(0, e.team) ? '#ff6a52' : '#f2d35a');
    if (e.kind === 'b') {
      if (q >= 120) continue;
      _o3.position.set(e.x, e.y + 0.06, e.z); _o3.rotation.set(0, 0, 0); _o3.scale.set((e.w / 2 + 0.2) * Math.SQRT2, 1, (e.h / 2 + 0.2) * Math.SQRT2); _o3.updateMatrix();
      FX.squares.setMatrixAt(q, _o3.matrix); FX.squares.setColorAt(q, _col); q++;
    } else {
      if (n >= 1150) continue;
      const x = e.px !== undefined ? lerp(e.px, e.x, alpha) : e.x, z = e.pz !== undefined ? lerp(e.pz, e.z, alpha) : e.z;
      _o3.position.set(x, Math.max(heightAt(x, z), -0.1) + 0.04, z); _o3.rotation.set(0, 0, 0); _o3.scale.setScalar(e.d.r + 0.1); _o3.updateMatrix();
      FX.rings.setMatrixAt(n, _o3.matrix); FX.rings.setColorAt(n, _col); n++;
    }
  }
  // order markers and formation preview
  FX.marks = FX.marks.filter(m => U.time.value - m.t0 < (m.slot ? 0.05 : 0.7));
  for (const m of FX.marks) {
    if (n >= 1195) break;
    const k = m.slot ? 0 : (U.time.value - m.t0) / 0.7;
    _col.set(m.col).multiplyScalar(m.slot ? 0.9 : 1 - k);
    _o3.position.set(m.x, Math.max(heightAt(m.x, m.z), -0.1) + 0.05, m.z); _o3.rotation.set(0, 0, 0); _o3.scale.setScalar(m.slot ? 0.14 : 0.25 + k * 0.4); _o3.updateMatrix();
    FX.rings.setMatrixAt(n, _o3.matrix); FX.rings.setColorAt(n, _col); n++;
  }
  FX.rings.count = n; FX.squares.count = q;
  FX.rings.instanceMatrix.needsUpdate = true; FX.squares.instanceMatrix.needsUpdate = true;
  if (FX.rings.instanceColor) FX.rings.instanceColor.needsUpdate = true;
  if (FX.squares.instanceColor) FX.squares.instanceColor.needsUpdate = true;
  // rally point of a single selected building
  const b = UI.sel.length === 1 && UI.sel[0].kind === 'b' && UI.sel[0].team === 0 && UI.sel[0].rally ? UI.sel[0] : null;
  FX.rally.visible = FX.rallyLine.visible = !!b;
  if (b) {
    const r = b.rally, ry = Math.max(heightAt(r.x, r.z), 0);
    FX.rally.position.set(r.x, ry, r.z); FX.rallyCloth.rotation.y = Math.sin(U.time.value * 3) * 0.3;
    const a = FX.rallyLine.geometry.attributes.position.array; a[0] = b.x; a[1] = b.y + 0.15; a[2] = b.z; a[3] = r.x; a[4] = ry + 0.15; a[5] = r.z;
    FX.rallyLine.geometry.attributes.position.needsUpdate = true; FX.rallyLine.computeLineDistances();
  }
}
function markAt(x, z, col) { FX.marks.push({ x, z, col, t0: U.time.value }); }

// ---------- 2D overlay: health bars, box, formation line ----------
let overlay = null, octx = null;
function resizeOverlay() { if (!overlay) return; overlay.width = Math.round(VW * DPR); overlay.height = Math.round(VH * DPR); }
function drawOverlay(alpha) {
  const c = octx; if (!c) return;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, overlay.width, overlay.height);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const ppt = VH / (2 * Math.tan(camera.fov * Math.PI / 360) * CAM.dist);
  const bar = (x, y, w, k, col2) => { c.fillStyle = 'rgba(10,8,6,0.72)'; c.fillRect(x - w / 2 - 1, y - 1, w + 2, 5); c.fillStyle = col2 || (k > 0.6 ? '#7ccf5a' : k > 0.3 ? '#e2b33c' : '#d4523a'); c.fillRect(x - w / 2, y, w * k, 3); };
  const show = new Set(UI.sel);
  for (const u of G.units) {
    if (!(show.has(u) || (u.hp < u.maxhp && G.t - u.lastHit < 3))) continue;
    if (u.team !== 0 && !visibleAt(u.x, u.z)) continue;
    const x = u.px !== undefined ? lerp(u.px, u.x, alpha) : u.x, z = u.pz !== undefined ? lerp(u.pz, u.z, alpha) : u.z;
    const s = project(x, Math.max(heightAt(x, z), 0) + (u.d.cls === 'cav' ? 1.18 : u.d.cls === 'art' ? 0.8 : 0.86), z);
    if (s.z > 1 || s.x < -40 || s.x > VW + 40 || s.y < -40 || s.y > VH + 40) continue;
    bar(s.x, s.y, Math.max(16, Math.min(34, ppt * 0.6)), clamp(u.hp / u.maxhp, 0, 1));
  }
  for (const b of G.builds) {
    const sel = show.has(b), building = b.team === 0 && !b.done, prod = b.team === 0 && (b.queue.length || b.research);
    if (!(sel || building || (b.hp < b.maxhp && G.t - b.lastHit < 4) || (prod && sel))) continue;
    if (b.team !== 0 && !b.seen) continue;
    const s = project(b.x, b.y + (b.done ? BH[b.type] || 1.5 : (BH[b.type] || 1.5) * Math.max(0.3, b.prog)) + 0.35, b.z);
    if (s.z > 1 || s.x < -80 || s.x > VW + 80 || s.y < -40 || s.y > VH + 40) continue;
    const w = clamp(b.w * ppt * 0.7, 40, 110);
    bar(s.x, s.y, w, clamp(b.hp / b.maxhp, 0, 1));
    if (building) bar(s.x, s.y + 6, w, clamp(b.prog, 0, 1), '#e8d48a');
    else if (b.team === 0 && b.queue.length) bar(s.x, s.y + 6, w, clamp(b.qt / UT[b.queue[0]].time, 0, 1), '#8fc2f0');
    else if (b.team === 0 && b.research) bar(s.x, s.y + 6, w, clamp(b.research.t / TECH[b.research.id].time, 0, 1), '#c9a4f0');
  }
  if (UI.box) {
    const b = UI.box, x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
    c.fillStyle = 'rgba(232,214,160,0.1)'; c.strokeStyle = 'rgba(240,226,180,0.9)'; c.lineWidth = 1.2;
    c.fillRect(x, y, w, h); c.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  if (UI.drag && UI.drag.active) {
    const a = project(UI.drag.a.x, heightAt(UI.drag.a.x, UI.drag.a.z), UI.drag.a.z), b = project(UI.drag.b.x, heightAt(UI.drag.b.x, UI.drag.b.z), UI.drag.b.z);
    c.strokeStyle = 'rgba(159,245,192,0.9)'; c.lineWidth = 2; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
  }
}

// ---------- minimap ----------
let MINI = { base: null, cv: null, ctx: null, size: 200 };
function miniBase() {
  const S = N * 2, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  const col = { 0: [92, 112, 52], 1: [136, 134, 70], 2: [116, 94, 64], 3: [170, 152, 112], 4: [74, 98, 96], 5: [40, 62, 72] };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = ((y >> 1) * N + (x >> 1)), k = (y * S + x) * 4;
    let cc = col[G.terr[i]];
    if (G.tree[i]) cc = [36, 62, 32];
    const h = heightAt(x / 2, y / 2), shade = 0.86 + clamp(h * 0.08, -0.1, 0.2);
    img.data[k] = cc[0] * shade; img.data[k + 1] = cc[1] * shade; img.data[k + 2] = cc[2] * shade; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}
function drawMinimap() {
  const M2 = MINI; if (!M2.ctx) return;
  if (!M2.base || M2.dirty) { M2.base = miniBase(); M2.dirty = false; }
  if (!M2.work) { M2.work = document.createElement('canvas'); M2.work.width = M2.work.height = N * 2; }
  const w = M2.work.getContext('2d');
  w.drawImage(M2.base, 0, 0);
  for (const d of G.deposits) if (d.amt > 0 && G.vis[idx(d.tx, d.tz)]) { w.fillStyle = d.type === 'gold' ? '#f0c040' : d.type === 'stone' ? '#c8c4b8' : '#c03050'; w.fillRect(d.tx * 2, d.tz * 2, d.w * 2, d.h * 2); }
  for (const b of G.builds) { if (b.team !== 0 && !b.seen) continue; w.fillStyle = TEAM_COLORS[b.team]; w.fillRect(b.tx * 2, b.tz * 2, b.w * 2, b.h * 2); w.strokeStyle = 'rgba(0,0,0,0.5)'; w.strokeRect(b.tx * 2 + 0.5, b.tz * 2 + 0.5, b.w * 2 - 1, b.h * 2 - 1); }
  for (const u of G.units) { if (u.team !== 0 && !visibleAt(u.x, u.z)) continue; w.fillStyle = u.team === 0 ? '#ffd8d0' : TEAM_COLORS[u.team]; w.fillRect(u.x * 2 - 1, u.z * 2 - 1, 2.5, 2.5); }
  // fog
  const img = w.getImageData(0, 0, N * 2, N * 2), D = img.data;
  for (let y = 0; y < N * 2; y++) for (let x = 0; x < N * 2; x++) { const v = G.vis[(y >> 1) * N + (x >> 1)]; if (v === 2) continue; const k = (y * N * 2 + x) * 4, f = v === 1 ? 0.5 : 0.08; D[k] *= f; D[k + 1] *= f; D[k + 2] *= f; }
  w.putImageData(img, 0, 0);
  for (const p of UI.pings) { const a = 1 - (G.t - p.t) / 3; if (a <= 0) continue; w.strokeStyle = `rgba(255,80,60,${a})`; w.lineWidth = 2; w.beginPath(); w.arc(p.x * 2, p.z * 2, 6 + (1 - a) * 14, 0, 7); w.stroke(); }
  // draw rotated so screen-up matches the camera
  const c = M2.ctx, S = M2.cv.width;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, S, S);
  c.translate(S / 2, S / 2); c.rotate(CAM.yaw); const sc = S / (N * 2) / Math.SQRT2 * 0.98; c.scale(sc, sc); c.translate(-N, -N);
  c.imageSmoothingEnabled = true; c.drawImage(M2.work, 0, 0);
  // view footprint
  const pts = [[0, 0], [VW, 0], [VW, VH], [0, VH]].map(([x, y]) => groundAt(x, y) || null);
  c.strokeStyle = 'rgba(255,248,230,0.95)'; c.lineWidth = 1.5 / sc;
  c.beginPath();
  pts.forEach((p, i) => { const q = p || { x: CAM.tx, z: CAM.tz }; i ? c.lineTo(q.x * 2, q.z * 2) : c.moveTo(q.x * 2, q.z * 2); });
  c.closePath(); c.stroke();
  c.setTransform(1, 0, 0, 1, 0, 0);
}
function miniToWorld(mx, my) {
  const S = MINI.cv.width, sc = S / (N * 2) / Math.SQRT2 * 0.98;
  let x = (mx - S / 2) / sc, y = (my - S / 2) / sc;
  const c = Math.cos(-CAM.yaw), s = Math.sin(-CAM.yaw);
  const rx = x * c - y * s, ry = x * s + y * c;
  return { x: (rx + N) / 2, z: (ry + N) / 2 };
}
