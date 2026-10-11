// ================= units v2: modelled figures on a two-bone IK rig, procedural animation =================
// Figures are modelled in metres (1 tile = 2.5 m) and drawn through instanced parts. Every part carries a
// per-vertex 'tint' mask: tinted areas take the instance colour (team coat, skin, horse coat), the rest keep
// their baked colour, so one draw call can show a red coat with brass buttons and a black leather belt.
const UR = { parts: {}, root: null, cap: 0 };
const HK = 0.4;            // metres -> world units
const HS = 1.1;            // heads slightly large so faces and hats read from the RTS camera
const TAU = Math.PI * 2;
const V3 = THREE.Vector3;
const lc = hex => new THREE.Color(hex).convertSRGBToLinear();
const L3 = hex => { const c = lc(hex); return [c.r, c.g, c.b]; };
const SKIN = ['#d9a888', '#c99474', '#e0b494', '#b98466'].map(lc);
const HORSE = ['#5a3a22', '#3b2a1e', '#7a5232', '#2a2420', '#9a958a', '#6a4a30', '#4a3020'].map(lc);
const PANTS = { peasant: '#6b6553', pikeman: '#4a3a2a', musketeer: '#2c3346', lighthorse: '#3d4f86', dragoon: '#3a3a30', cuirassier: '#7a2a24', cannon: '#3a3428' };
const pantsCol = {}; for (const k in PANTS) pantsCol[k] = lc(PANTS[k]);
const LINEN = lc('#b8af96');
const teamCoat = [];
function coatColor(t) { if (!teamCoat[t]) { const c = new THREE.Color(TEAM_COLORS[t]); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s * 0.85, hsl.l * 0.9); teamCoat[t] = c.convertSRGBToLinear(); } return teamCoat[t]; }
const _white = new THREE.Color(1, 1, 1);

// ---------- geometry toolkit ----------
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3), t = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = fn(p.getX(i), p.getY(i), p.getZ(i));
    c[i * 3] = v[0]; c[i * 3 + 1] = v[1]; c[i * 3 + 2] = v[2]; t[i] = v[3] === undefined ? 1 : v[3];
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('tint', new THREE.BufferAttribute(t, 1));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const TINT = (k = 1) => () => [k, k, k, 1];
const FIX = (hex, k = 1) => { const c = L3(hex); return () => [c[0] * k, c[1] * k, c[2] * k, 0]; };
function merge(parts) {
  let total = 0; for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), tin = new Float32Array(total);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3); tin.set(g.attributes.tint.array, o);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('tint', new THREE.BufferAttribute(tin, 1));
  return out;
}
function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  g.applyMatrix4(new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz)));
  return g;
}
// profile [[r, y], ...] from bottom to top; faces point outward
function lathe(prof, seg = 10, sx = 1, sz = 1, phi0 = 0, phiL = TAU) {
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg, phi0, phiL);
  if (sx !== 1 || sz !== 1) g.scale(sx, 1, sz);
  return g;
}
function sph(r, x, y, z, sx = 1, sy = 1, sz = 1, w = 10, h = 8) { return xf(new THREE.SphereGeometry(r, w, h), x, y, z, 0, 0, 0, sx, sy, sz); }
function gBox(w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { return xf(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
function gCyl(r0, r1, h, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 8) { return xf(new THREE.CylinderGeometry(r1, r0, h, seg), x, y, z, rx, ry, rz); }
// mirror a non-indexed painted geometry so both sides render (for skirts, brims, cloth)
function dbl(g) {
  const p = g.attributes.position.array, nr = g.attributes.normal.array, c = g.attributes.color.array, t = g.attributes.tint.array;
  const n = p.length / 3, P = new Float32Array(p.length * 2), NR = new Float32Array(p.length * 2), C = new Float32Array(c.length * 2), T = new Float32Array(t.length * 2);
  P.set(p); NR.set(nr); C.set(c); T.set(t);
  for (let f = 0; f < n / 3; f++) for (let k = 0; k < 3; k++) {
    const src = f * 3 + (2 - k), dst = n + f * 3 + k;
    for (let a = 0; a < 3; a++) { P[dst * 3 + a] = p[src * 3 + a]; NR[dst * 3 + a] = -nr[src * 3 + a]; C[dst * 3 + a] = c[src * 3 + a] * 0.8; }
    T[dst] = t[src];
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(NR, 3));
  out.setAttribute('color', new THREE.BufferAttribute(C, 3)); out.setAttribute('tint', new THREE.BufferAttribute(T, 1));
  return out;
}
// a tube along a polyline; s1/s2 squash the cross-section across / along the path's bend plane
function tube(pts, rad, seg = 6, s1 = 1, s2 = 1, upHint) {
  const pos = [], nor = [], rings = [];
  const up0 = upHint || new V3(0, 1, 0);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = new V3().subVectors(b, a).normalize();
    const up = Math.abs(t.dot(up0)) > 0.92 ? new V3(1, 0, 0) : up0;
    const b1 = new V3().crossVectors(t, up).normalize(), b2 = new V3().crossVectors(b1, t).normalize();
    const ring = [];
    for (let k = 0; k < seg; k++) {
      const an = k / seg * TAU, ca = Math.cos(an), sa = Math.sin(an);
      const off = new V3().addScaledVector(b1, ca * rad[i] * s1).addScaledVector(b2, sa * rad[i] * s2);
      const nn = new V3().addScaledVector(b1, ca / s1).addScaledVector(b2, sa / s2).normalize();
      ring.push([new V3().addVectors(pts[i], off), nn]);
    }
    rings.push(ring);
  }
  const tri = (A, B, C) => { for (const v of [A, B, C]) { pos.push(v[0].x, v[0].y, v[0].z); nor.push(v[1].x, v[1].y, v[1].z); } };
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < seg; k++) {
    const k2 = (k + 1) % seg, A = rings[i][k], B = rings[i + 1][k], C = rings[i + 1][k2], D = rings[i][k2];
    tri(A, B, C); tri(A, C, D);
  }
  // caps
  const cap = (ring, ctr, n, flip) => { for (let k = 0; k < seg; k++) { const A = ring[k], B = ring[(k + 1) % seg], c = [ctr, n]; if (flip) tri([A[0], n], [B[0], n], c); else tri([B[0], n], [A[0], n], c); } };
  const t0 = new V3().subVectors(pts[0], pts[1]).normalize(), t1 = new V3().subVectors(pts[pts.length - 1], pts[pts.length - 2]).normalize();
  cap(rings[0], pts[0], t0, true); cap(rings[rings.length - 1], pts[pts.length - 1], t1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
const vv = (x, y, z) => new V3(x, y, z);
function rAt(prof, y) { for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const a = prof[i - 1], b = prof[i], k = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * k; } return prof[prof.length - 1][0]; }
function noiseK(x, y, z, amt) { const s = Math.sin(x * 91.7 + y * 47.3 + z * 63.1) * 43758.5; return 1 + (s - Math.floor(s) - 0.5) * amt; }

// ---------- the parts ----------
const TORSO = [[0, -0.19], [0.12, -0.185], [0.152, -0.14], [0.158, -0.05], [0.157, 0.04], [0.168, 0.15], [0.188, 0.26], [0.198, 0.33], [0.192, 0.385], [0.165, 0.425], [0.11, 0.455], [0.065, 0.47], [0, 0.475]];
const TSX = 0.64;
function partGeos() {
  const P = {};
  const SK = L3('#c99474'), HAIR = '#2a1d14', IRON = '#2c2a28', STEEL = '#b4b6b8', BRASS = '#b08a3a', LEATHER = '#3a2618', WOOD = '#5a3e26';
  // ---- legs: baggy sharovary over the thigh, tucked into boots ----
  P.thigh = paint(lathe([[0, -0.48], [0.05, -0.47], [0.078, -0.43], [0.092, -0.35], [0.105, -0.22], [0.108, -0.08], [0.1, 0.02], [0.075, 0.06], [0, 0.07]], 10, 1, 0.92),
    (x, y) => { const k = 0.82 + 0.18 * Math.min(1, (y + 0.48) / 0.25); return [k, k, k, 1]; });
  const shin = boot => {
    const B = L3(boot);
    const bc = (x, y) => { const k = (y > -0.14 ? 1.18 : y < -0.49 ? 0.55 : 1) * noiseK(x, y, 0, 0.06); return [B[0] * k, B[1] * k, B[2] * k, 0]; };
    const pants = paint(lathe([[0, -0.17], [0.064, -0.16], [0.074, -0.1], [0.083, -0.02], [0.08, 0.03], [0.06, 0.06], [0, 0.07]], 10), TINT(0.9));
    const shaft = paint(lathe([[0, -0.42], [0.047, -0.415], [0.05, -0.36], [0.056, -0.22], [0.062, -0.145], [0.067, -0.125], [0.061, -0.118], [0, -0.118]], 10), bc);
    const foot = sph(1, 0.052, -0.462, 0, 0.118, 0.05, 0.052, 10, 6);
    const fp = foot.attributes.position;
    for (let i = 0; i < fp.count; i++) { let x = fp.getX(i), y = fp.getY(i); y = Math.max(y, -0.506); if (x > 0.11) y += (x - 0.11) * 0.45; fp.setXY(i, x, y); }
    foot.computeVertexNormals();
    const heel = gBox(0.07, 0.03, 0.075, -0.035, -0.494, 0);
    return merge([pants, shaft, paint(foot, bc), paint(heel, FIX('#18120e'))]);
  };
  P.shinK = shin('#211a15'); P.shinR = shin('#8e2a1e'); P.shinB = shin('#4c3424');
  // ---- arms ----
  P.upper = merge([paint(sph(0.07, 0, -0.012, 0, 1, 1, 1), TINT(1)), paint(lathe([[0, -0.305], [0.048, -0.3], [0.055, -0.24], [0.06, -0.12], [0.064, -0.03], [0, 0.0]], 10, 0.95), TINT(0.97))]);
  P.fore = merge([
    paint(lathe([[0, -0.25], [0.043, -0.245], [0.047, -0.2], [0.047, -0.1], [0.054, -0.02], [0, 0.012]], 10, 0.95), TINT(0.96)),
    paint(lathe([[0.049, -0.258], [0.055, -0.25], [0.056, -0.2], [0.05, -0.19]], 10), TINT(0.72)),
    paint(gCyl(0.03, 0.032, 0.04, 0, -0.268, 0), () => [...SK, 0]),
    paint(sph(1, 0.006, -0.312, 0, 0.044, 0.056, 0.036, 8, 6), (x, y) => [SK[0] * (y < -0.33 ? 0.85 : 1), SK[1] * (y < -0.33 ? 0.85 : 1), SK[2] * (y < -0.33 ? 0.85 : 1), 0])]);
  // ---- head: skull, jaw, nose, ears, eyes, brows, a long Cossack moustache ----
  {
    const face = (x, y, z) => {
      if (x < -0.035 && y > 0.115 || (Math.abs(z) > 0.075 && y > 0.17 && x < 0.04)) return [...L3(HAIR), 0];
      let k = 1;
      if (x > 0.06 && y > 0.145 && y < 0.185 && Math.abs(z) > 0.012) k = 0.8;   // eye sockets
      if (y < 0.075) k *= 0.88;
      return [k, k, k, 1];
    };
    const parts = [
      paint(lathe([[0, -0.04], [0.05, -0.035], [0.054, 0.05], [0.05, 0.09], [0, 0.1]], 8), TINT(0.92)),
      paint(sph(1, 0, 0.155, 0, 0.108, 0.122, 0.093, 14, 10), face),
      paint(sph(1, 0.034, 0.092, 0, 0.074, 0.062, 0.07, 10, 8), TINT(0.97)),
      paint(xf(new THREE.ConeGeometry(0.021, 0.055, 6), 0.106, 0.135, 0, 0, 0, -1.91), TINT(1.02)),
      paint(sph(1, 0.0, 0.145, 0.094, 0.02, 0.03, 0.012, 6, 5), TINT(0.92)), paint(sph(1, 0.0, 0.145, -0.094, 0.02, 0.03, 0.012, 6, 5), TINT(0.92)),
      paint(sph(0.011, 0.094, 0.163, 0.034, 1, 1, 1, 6, 5), FIX('#16110d')), paint(sph(0.011, 0.094, 0.163, -0.034, 1, 1, 1, 6, 5), FIX('#16110d')),
      paint(gBox(0.014, 0.011, 0.04, 0.1, 0.183, 0.036, 0.15), FIX(HAIR)), paint(gBox(0.014, 0.011, 0.04, 0.1, 0.183, -0.036, -0.15), FIX(HAIR)),
    ];
    for (const sd of [1, -1]) parts.push(paint(tube([vv(0.113, 0.117, 0.006 * sd), vv(0.111, 0.11, 0.032 * sd), vv(0.1, 0.085, 0.056 * sd), vv(0.088, 0.048, 0.062 * sd), vv(0.082, 0.025, 0.06 * sd)], [0.006, 0.011, 0.009, 0.006, 0.002], 5), FIX('#3a2818')));
    P.head = merge(parts.map(g => xf(g, 0, 0, 0, 0, 0, 0, HS)));
  }
  // ---- hats (head frame, scaled with the head) ----
  const hat = parts => merge(parts.map(g => xf(g, 0, 0, 0, 0, 0, 0, HS)));
  {
    const straw = L3('#c3a35e');
    const st = (x, y, z) => { const k = noiseK(x, y, z, 0.18); return [straw[0] * k, straw[1] * k, straw[2] * k, 0]; };
    const brim = paint(lathe([[0.228, 0.198], [0.2, 0.208], [0.15, 0.218], [0.112, 0.226]], 18), st);
    const brimU = paint(lathe([[0.112, 0.222], [0.15, 0.214], [0.2, 0.204], [0.228, 0.195]], 18), st);
    P.hStraw = hat([brim, brimU, paint(lathe([[0.113, 0.222], [0.112, 0.24], [0.115, 0.252], [0.112, 0.262], [0, 0.262]], 14), TINT(1)), paint(lathe([[0.112, 0.255], [0.108, 0.31], [0.092, 0.33], [0, 0.336]], 14), st)]);
  }
  {
    const fur = L3('#231a14');
    const fu = (x, y, z) => { const k = noiseK(x, y, z, 0.5); return [fur[0] * k, fur[1] * k, fur[2] * k, 0]; };
    const band = paint(lathe([[0, 0.198], [0.113, 0.198], [0.124, 0.22], [0.128, 0.27], [0.125, 0.33], [0.112, 0.345], [0, 0.35]], 16), fu);
    const bag = paint(tube([vv(0.0, 0.33, 0), vv(-0.05, 0.37, 0.0), vv(-0.12, 0.36, 0.02), vv(-0.17, 0.3, 0.03), vv(-0.19, 0.23, 0.035)], [0.09, 0.085, 0.065, 0.04, 0.02], 8, 1, 0.8), TINT(1));
    const tassel = paint(sph(0.022, -0.19, 0.21, 0.035), FIX('#d0a640'));
    P.hKalpak = hat([band, bag, tassel]);
  }
  {
    const felt = FIX('#1e1a17');
    const bp = [[0.112, 0.222], [0.15, 0.214], [0.2, 0.205], [0.225, 0.2]];
    const brim = paint(lathe(bp, 20), felt), brimD = paint(lathe(bp.slice().reverse().map(([r, y]) => [r, y - 0.008]), 20), felt);
    for (const g of [brim, brimD]) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i), x = p.getX(i), up = Math.max(0, -z / 0.225); p.setY(i, p.getY(i) + up * up * 0.13 * Math.min(1, Math.hypot(x, z) / 0.15) + Math.max(0, x / 0.225) * -0.012); } g.computeVertexNormals(); }
    const crown = paint(lathe([[0.112, 0.215], [0.106, 0.29], [0.096, 0.335], [0.06, 0.348], [0, 0.35]], 14), FIX('#24201c'));
    const bandG = paint(lathe([[0.114, 0.222], [0.113, 0.248], [0, 0.248]], 14), FIX('#5a4a2a'));
    const plume = paint(tube([vv(-0.02, 0.25, -0.14), vv(-0.06, 0.32, -0.17), vv(-0.13, 0.36, -0.17), vv(-0.2, 0.33, -0.15), vv(-0.24, 0.27, -0.13)], [0.012, 0.03, 0.034, 0.025, 0.006], 6, 1, 0.35), TINT(1.15));
    P.hFelt = hat([brim, brimD, crown, bandG, plume]);
  }
  {
    const st = (x, y, z) => { const c = L3(STEEL), k = 0.9 + 0.1 * Math.sin(y * 60); return [c[0] * k, c[1] * k, c[2] * k, 0]; };
    const bowl = paint(lathe([[0.118, 0.205], [0.122, 0.26], [0.105, 0.325], [0.06, 0.358], [0, 0.364]], 16), st);
    const bp = [[0.122, 0.218], [0.16, 0.216], [0.2, 0.224], [0.215, 0.232]];
    const brim = paint(lathe(bp, 20), st), brimD = paint(lathe(bp.slice().reverse().map(([r, y]) => [r, y - 0.007]), 20), st);
    for (const g of [brim, brimD]) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), r = Math.hypot(x, p.getZ(i)); p.setY(i, p.getY(i) + Math.pow(Math.abs(x) / 0.215, 2) * 0.09 * Math.min(1, (r - 0.12) / 0.09)); } g.computeVertexNormals(); }
    const comb = paint(xf(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 18, 1, false, 0, Math.PI), 0, 0.3, 0, Math.PI / 2, 0, 0), st);
    P.hMorion = hat([bowl, brim, brimD, comb]);
  }
  {
    const st = (x, y, z) => { const c = L3('#8c8e90'); return [c[0], c[1], c[2], 0]; };
    const bowl = paint(lathe([[0.118, 0.2], [0.123, 0.255], [0.106, 0.32], [0.06, 0.352], [0, 0.358]], 16), st);
    const peak = paint(xf(lathe([[0.123, 0.2], [0.17, 0.19], [0.172, 0.188]], 12, 1, 1, Math.PI / 2 - 0.9, 1.8), 0, 0, 0), st);
    const parts = [bowl, peak, paint(gBox(0.008, 0.15, 0.014, 0.135, 0.17, 0), st), paint(gBox(0.06, 0.1, 0.006, 0.05, 0.13, 0.118, 0, 0.12), st), paint(gBox(0.06, 0.1, 0.006, 0.05, 0.13, -0.118, 0, -0.12), st)];
    for (let k = 0; k < 4; k++) parts.push(paint(lathe([[0.13 + k * 0.012, 0.165 - k * 0.04], [0.125 + k * 0.012, 0.2 - k * 0.04]], 12, 1, 1, Math.PI * 1.5 - 1.2, 2.4), st));
    P.hZisch = hat(parts.map((g, i) => i >= 5 || i === 1 ? dbl(g) : g));
  }
  P.hCap = hat([paint(lathe([[0.114, 0.198], [0.12, 0.25], [0.104, 0.3], [0.05, 0.322], [0, 0.325]], 14), FIX('#3e2e24')), paint(lathe([[0.115, 0.196], [0.124, 0.2], [0.125, 0.232], [0.116, 0.236], [0, 0.236]], 14), TINT(0.9))]);
  // ---- torsos (chest frame: origin at the waist, shoulders at y 0.39, z +/-0.2) ----
  const torsoBase = fn => paint(lathe(TORSO, 14, TSX), fn);
  const front = (y, k = 0.004) => rAt(TORSO, y) * TSX + k;
  const buttons = (col, y0, y1, n) => { const out = []; for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * i / (n - 1); out.push(paint(sph(0.011, front(y), y, 0, 1, 1, 1, 6, 4), FIX(col))); } return out; };
  const sash = (col, tint) => paint(lathe([[0.16, -0.045], [0.168, -0.04], [0.17, 0.0], [0.167, 0.05], [0.16, 0.058]], 14, TSX), tint ? TINT(1) : (x, y) => { const c = L3(col), k = 0.85 + 0.25 * (Math.sin(y * 160) > 0.3 ? 1 : 0); return [c[0] * k, c[1] * k, c[2] * k, 0]; });
  const collar = paint(lathe([[0.072, 0.44], [0.078, 0.455], [0.076, 0.49], [0.07, 0.497]], 12, 1.0), TINT(0.82));
  const coatFn = (x, y, z) => { let k = 1; if (x > 0 && Math.abs(z) < 0.012 && y < 0.43) k = 0.6; if (y < -0.1) k *= 0.85; return [k, k, k, 1]; };
  const bandolier = () => {
    const pts = [], rad = [];
    for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, zz = Math.sin(a) * 0.21, y = 0.17 - zz * 0.95; const rr0 = rAt(TORSO, y) + 0.012; pts.push(vv(Math.cos(a) * rr0 * TSX, y, Math.sin(a) * rr0)); rad.push(0.012); }
    const out = [paint(tube(pts, rad, 4, 1, 2.2), FIX('#3c2a1c'))];
    for (let i = 0; i < 6; i++) { const a = -0.95 + i * 0.32, zz = Math.sin(a) * 0.21, y = 0.17 - zz * 0.95 - 0.045, rr0 = rAt(TORSO, y) + 0.02; out.push(paint(gCyl(0.014, 0.016, 0.06, Math.cos(a) * rr0 * TSX, y, Math.sin(a) * rr0), FIX('#6a4a2a')), paint(gCyl(0.01, 0.01, 0.014, Math.cos(a) * rr0 * TSX, y + 0.035, Math.sin(a) * rr0), FIX('#151210'))); }
    return out;
  };
  P.tPeasant = merge([torsoBase((x, y, z) => {
    const ang = Math.atan2(Math.abs(z), x / TSX);   // 0 = front centre
    const vest = y > -0.06 && y < 0.4 && ang > 0.42 && !(y > 0.3 && ang > 1.25 && ang < 1.9);
    if (vest) return [...L3('#4a3626').map(c => c * noiseK(x, y, z, 0.1)), 0];
    const l = [LINEN.r, LINEN.g, LINEN.b], k = (x > 0 && Math.abs(z) < 0.01 && y > 0.25 ? 0.7 : 1) * noiseK(x, y, z, 0.05);
    return [l[0] * k, l[1] * k, l[2] * k, 0];
  }), sash(null, true), paint(lathe([[0.07, 0.44], [0.074, 0.46], [0.07, 0.49]], 12), () => [LINEN.r, LINEN.g, LINEN.b, 0])]);
  P.tCoat = merge([torsoBase(coatFn), collar, sash('#3a2618'), ...buttons(BRASS, -0.02, 0.4, 5)]);
  P.tZhupan = merge([torsoBase(coatFn), collar, sash('#c09a3a'), ...buttons('#d8b860', 0.08, 0.42, 7)]);
  P.tMusk = merge([torsoBase(coatFn), collar, sash('#3a2618'), ...buttons(BRASS, 0.1, 0.42, 5), ...bandolier()]);
  // steel breastplate with a central ridge, and pauldrons
  {
    const cp = [[0, -0.075], [0.15, -0.07], [0.172, -0.025], [0.172, 0.06], [0.183, 0.15], [0.202, 0.26], [0.212, 0.33], [0.204, 0.382], [0.175, 0.42], [0.118, 0.448], [0, 0.452]];
    const g = paint(lathe(cp, 16, TSX + 0.02), (x, y, z) => { const c = L3('#a9abae'), k = y < -0.05 || y > 0.43 ? 0.7 : 1; return [c[0] * k, c[1] * k, c[2] * k, 0]; });
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (x > 0 && y > -0.03 && y < 0.36) p.setX(i, x + 0.016 * Math.exp(-(z * z) / 0.0025) * Math.sin(Math.PI * (y + 0.03) / 0.39)); }
    g.computeVertexNormals();
    P.cuirass = g;
    P.pauldron = paint(sph(1, 0, 0.0, 0, 0.085, 0.07, 0.09, 12, 8, 0, TAU), (x, y) => { const c = L3('#a0a2a5'), k = Math.sin(y * 90) > 0.6 ? 0.7 : 1; return [c[0] * k, c[1] * k, c[2] * k, 0]; });
    xf(P.pauldron, 0, -0.035, 0);
  }
  // winged hussar frame with feathers, on the back
  {
    const parts = [];
    for (const sd of [1, -1]) {
      const pts = []; for (let i = 0; i <= 10; i++) { const s = i / 10; pts.push(vv(-0.15 - 0.16 * Math.sin(s * 2.6), -0.05 + s * 1.12, sd * (0.1 + 0.04 * s))); }
      parts.push(paint(tube(pts, pts.map((_, i) => 0.016 - i * 0.0008), 5), FIX('#6a1e16')));
      for (let i = 1; i <= 16; i++) {
        const s = i / 17, a = s * 2.6, px = -0.15 - 0.16 * Math.sin(a), py = -0.05 + s * 1.12;
        const len = 0.16 + 0.06 * Math.sin(s * Math.PI), dx = -1, dy = -0.25 + 0.75 * s, dl = Math.hypot(dx, dy);
        parts.push(paint(gBox(len, 0.034, 0.008, px + dx / dl * len * 0.5, py + dy / dl * len * 0.5, sd * (0.115 + 0.04 * s), 0, 0, Math.atan2(dy, dx)), FIX(i % 2 ? '#ecebe6' : '#c9c6bd')));
      }
    }
    P.wings = merge(parts);
  }
  // ---- hips (pelvis frame: origin at the hip joints) ----
  const seat = col => paint(lathe([[0, -0.13], [0.12, -0.12], [0.162, -0.05], [0.17, 0.04], [0.16, 0.13], [0, 0.145]], 12, 0.74), col ? FIX(col) : TINT(0.9));
  const skirt = (len, gap, flare) => {
    const prof = [[0.215 + flare, -len], [0.205 + flare * 0.6, -len * 0.6], [0.185, -0.1], [0.17, 0.05], [0.164, 0.14]];
    return dbl(paint(lathe(prof, 16, 0.78, 1, Math.PI / 2 + gap / 2, TAU - gap), (x, y) => { const k = (y < -len + 0.03 ? 0.75 : 1) * (0.88 + 0.12 * (y + len) / (len + 0.14)); return [k, k, k, 1]; }));
  };
  const scabbard = hilt => {
    const out = [paint(tube([vv(0.07, 0.05, -0.19), vv(-0.08, -0.15, -0.21), vv(-0.23, -0.36, -0.225), vv(-0.33, -0.53, -0.23)], [0.018, 0.017, 0.016, 0.01], 6, 1, 0.45, new V3(0, 0, 1)), FIX('#2a1a12')),
      paint(sph(0.02, 0.07, 0.05, -0.19), FIX(BRASS)), paint(sph(0.016, -0.33, -0.53, -0.23), FIX(BRASS))];
    if (hilt) out.push(paint(tube([vv(0.07, 0.05, -0.19), vv(0.13, 0.12, -0.19), vv(0.16, 0.14, -0.185)], [0.012, 0.012, 0.016], 5), FIX('#2a1a12')), paint(gBox(0.012, 0.012, 0.07, 0.085, 0.07, -0.19, 0, 0, 0.8), FIX(BRASS)));
    return out;
  };
  const horn = () => [paint(tube([vv(0.02, 0.0, 0.2), vv(-0.04, -0.06, 0.215), vv(-0.1, -0.08, 0.21), vv(-0.15, -0.06, 0.2)], [0.012, 0.02, 0.026, 0.02], 6), FIX('#b9a27a')), paint(sph(0.014, 0.02, 0.0, 0.2), FIX(BRASS))];
  P.hPeasant = merge([seat(PANTS.peasant), dbl(paint(lathe([[0.192, -0.13], [0.185, -0.05], [0.172, 0.06], [0.164, 0.14]], 14, 0.78), (x, y, z) => { const k = noiseK(x, y, z, 0.05) * (y < -0.11 ? 0.85 : 1); return [LINEN.r * k, LINEN.g * k, LINEN.b * k, 0]; })),
    paint(gBox(0.03, 0.16, 0.012, 0.06, -0.05, -0.17, 0, 0.4, 0.1), TINT(1)), paint(gBox(0.03, 0.13, 0.012, 0.03, -0.04, -0.18, 0, 0.3, -0.12), TINT(0.85))]);
  P.hCoat = merge([seat('#2c2622'), skirt(0.24, 0.42, 0.01), ...scabbard(false)]);
  P.hGun = merge([seat('#2c2622'), skirt(0.22, 0.42, 0.0)]);
  P.hLong = merge([seat('#2c2622'), skirt(0.37, 0.5, 0.03), ...scabbard(true), ...horn()]);
  P.hRider = merge([seat('#2c2622'), skirt(0.34, 1.7, 0.06), ...scabbard(false)]);
  // ---- weapons and tools: grip at the origin, long axis +y, edge / top along +x ----
  {
    const wood = FIX(WOOD), st = FIX(STEEL), iron = FIX(IRON);
    P.pike = merge([paint(gCyl(0.022, 0.017, 4.4, 0, 1.15, 0, 0, 0, 0, 6), (x, y) => [...L3(WOOD).map(c => c * (0.9 + 0.1 * Math.sin(y * 7))), 0]), paint(xf(new THREE.ConeGeometry(0.032, 0.28, 4), 0, 3.49, 0, 0, 0, 0, 1, 1, 0.35), st), paint(gCyl(0.02, 0.02, 0.36, 0, 3.2, 0, 0, 0, 0, 5), iron), paint(gCyl(0.024, 0.024, 0.06, 0, -1.02, 0, 0, 0, 0, 6), iron)]);
    // musket: barrel on top (+x), stock dropping below
    const stockPts = [vv(-0.085, -0.31, 0), vv(-0.07, -0.22, 0), vv(-0.045, -0.1, 0), vv(-0.028, -0.02, 0), vv(-0.016, 0.06, 0), vv(-0.012, 0.4, 0), vv(-0.01, 0.78, 0)];
    P.musket = merge([paint(tube(stockPts, [0.05, 0.045, 0.03, 0.02, 0.022, 0.018, 0.014], 7, 0.42, 1, new V3(1, 0, 0)), wood),
      paint(gCyl(0.015, 0.012, 1.2, 0.012, 0.56, 0, 0, 0, 0, 8), iron), paint(gBox(0.03, 0.1, 0.01, 0.0, 0.03, 0.022), iron), paint(gBox(0.014, 0.04, 0.012, 0.022, 0.0, 0.026, 0, 0, 0.5), iron),
      paint(gCyl(0.005, 0.005, 0.9, -0.032, 0.55, 0, 0, 0, 0, 4), FIX('#3a2a1a')), paint(xf(new THREE.TorusGeometry(0.02, 0.004, 4, 8, Math.PI), -0.03, -0.03, 0, 0, Math.PI / 2, Math.PI / 2), iron)]);
    P.ramrod = paint(gCyl(0.006, 0.006, 1.0, 0, -0.45, 0, 0, 0, 0, 4), FIX('#4a3420'));
    const bladePts = (L, c) => { const p = []; for (let i = 0; i <= 8; i++) { const s = i / 8; p.push(vv(-c * s * s, 0.06 + s * L, 0)); } return p; };
    P.sabre = merge([paint(tube(bladePts(0.82, 0.09), [0.017, 0.018, 0.017, 0.016, 0.015, 0.013, 0.011, 0.007, 0.001], 4, 1, 0.18, new V3(0, 0, 1)), st),
      paint(gCyl(0.012, 0.013, 0.1, 0, 0.0, 0, 0, 0, 0, 6), FIX('#2a1a12')), paint(gBox(0.018, 0.014, 0.075, 0, 0.055, 0), FIX(BRASS)), paint(tube([vv(0, -0.05, 0), vv(-0.02, -0.075, 0), vv(-0.035, -0.08, 0)], [0.013, 0.014, 0.008], 5), FIX('#2a1a12'))]);
    P.sword = merge([paint(tube(bladePts(0.95, 0.0), [0.019, 0.02, 0.019, 0.018, 0.017, 0.015, 0.013, 0.009, 0.001], 4, 1, 0.2, new V3(0, 0, 1)), st),
      paint(gCyl(0.013, 0.013, 0.11, 0, 0.0, 0, 0, 0, 0, 6), FIX('#1a1410')), paint(xf(new THREE.TorusGeometry(0.06, 0.006, 4, 10, Math.PI), 0, 0.02, 0, 0, Math.PI / 2, 0), st), paint(gBox(0.02, 0.016, 0.12, 0, 0.06, 0), st), paint(sph(0.02, 0, -0.065, 0), st)]);
    P.axe = merge([paint(tube([vv(0, 0, 0), vv(0.004, 0.35, 0), vv(0.0, 0.74, 0)], [0.016, 0.017, 0.019], 6), wood),
      paint(gBox(0.09, 0.075, 0.018, 0.045, 0.69, 0), iron), paint(gBox(0.022, 0.115, 0.012, 0.1, 0.69, 0), st)]);
    P.pick = merge([paint(tube([vv(0, 0, 0), vv(0, 0.4, 0), vv(0, 0.8, 0)], [0.016, 0.017, 0.02], 6), wood),
      paint(tube([vv(-0.24, 0.73, 0), vv(-0.12, 0.79, 0), vv(0, 0.8, 0), vv(0.12, 0.79, 0), vv(0.24, 0.73, 0)], [0.004, 0.016, 0.026, 0.016, 0.004], 6), iron)]);
    const arc = []; for (let i = 0; i <= 10; i++) { const a = Math.PI - i / 10 * Math.PI * 0.95; arc.push(vv(0.13 + Math.cos(a) * 0.13, 0.12 + Math.sin(a) * 0.15, 0)); }
    P.sickle = merge([paint(gCyl(0.014, 0.016, 0.13, 0, 0.055, 0, 0, 0, 0, 6), wood), paint(tube(arc, arc.map((_, i) => 0.016 - i * 0.0013), 4, 1, 0.25, new V3(0, 0, 1)), st)]);
    P.hammer = merge([paint(gCyl(0.014, 0.015, 0.36, 0, 0.17, 0, 0, 0, 0, 6), wood), paint(gBox(0.12, 0.04, 0.04, 0.0, 0.35, 0), iron)]);
    P.rammer = merge([paint(gCyl(0.02, 0.02, 2.5, 0, 0.7, 0, 0, 0, 0, 6), wood), paint(gCyl(0.06, 0.06, 0.2, 0, 1.95, 0, 0, 0, 0, 10), (x, y, z) => [...L3('#8a8070').map(c => c * noiseK(x, y, z, 0.3)), 0]), paint(gCyl(0.055, 0.055, 0.1, 0, -0.55, 0, 0, 0, 0, 10), wood)]);
    P.linstock = merge([paint(gCyl(0.016, 0.016, 1.25, 0, -0.28, 0, 0, 0, 0, 6), wood), paint(tube([vv(0, 0.32, 0), vv(0.05, 0.37, 0), vv(0.07, 0.42, 0.02)], [0.008, 0.008, 0.008], 4), iron), paint(sph(0.016, 0.07, 0.43, 0.02), FIX('#ffb050'))]);
    // carried loads
    const bark = (x, y, z) => { const ends = Math.abs(x) > 0.53; const c = ends ? L3('#b08a5a') : L3('#5a3e2a'); const k = noiseK(x, y, z, 0.3); return [c[0] * k, c[1] * k, c[2] * k, 0]; };
    P.logs = merge([[-0.02, 0, 0.07], [0.03, 0.0, -0.07], [0, 0.11, 0]].map(([x, y, z], k) => paint(gCyl(0.07 - k * 0.01, 0.07 - k * 0.01, 1.1, x, y, z, 0, 0, Math.PI / 2, 8), bark)));
    const sackG = paint(lathe([[0, -0.26], [0.13, -0.25], [0.19, -0.16], [0.205, -0.02], [0.18, 0.13], [0.1, 0.22], [0.045, 0.255], [0.05, 0.3], [0.03, 0.33], [0, 0.335]], 12, 0.72), (x, y, z) => { const c = y > 0.235 && y < 0.27 ? L3('#4a3520') : L3('#b39d74'); const k = noiseK(x, y, z, 0.12); return [c[0] * k, c[1] * k, c[2] * k, 0]; });
    P.sack = jiggleU(sackG, 0.012, mulberry32(5));
    const basket = (fill) => {
      const wk = (x, y, z) => { const c = L3('#8a6a3a'), k = 0.8 + 0.25 * (Math.sin(y * 120) * Math.sin(Math.atan2(z, x) * 14) > 0 ? 1 : 0); return [c[0] * k, c[1] * k, c[2] * k, 0]; };
      const out = [dbl(paint(lathe([[0, -0.13], [0.13, -0.125], [0.16, -0.05], [0.18, 0.06], [0.19, 0.09]], 14), wk)), paint(tube([vv(0, 0.09, -0.17), vv(0, 0.25, -0.1), vv(0, 0.29, 0), vv(0, 0.25, 0.1), vv(0, 0.09, 0.17)], [0.01, 0.01, 0.01, 0.01, 0.01], 4), FIX('#6a4a2a'))];
      const R = mulberry32(fill.length * 7);
      for (let i = 0; i < 9; i++) { const a = R() * TAU, rr0 = R() * 0.11; out.push(paint(xf(new THREE.DodecahedronGeometry(fill === 'b' ? 0.03 : 0.055, 0), Math.cos(a) * rr0, 0.07 + R() * 0.04, Math.sin(a) * rr0, R() * 3, R() * 3, R() * 3), fill === 's' ? FIX('#9a968c', 0.8 + R() * 0.4) : fill === 'g' ? (i % 3 ? FIX('#5a4a3a') : FIX('#e0b040')) : FIX('#9a1a2a', 0.8 + R() * 0.4))); }
      return merge(out);
    };
    P.basketS = basket('s'); P.basketG = basket('gg'); P.basketB = basket('b');
    P.sheaf = merge([paint(lathe([[0, -0.36], [0.07, -0.35], [0.055, -0.12], [0.045, 0.0], [0.06, 0.1], [0.12, 0.27], [0.13, 0.33], [0.09, 0.4], [0, 0.42]], 12), (x, y, z) => { const c = y > 0.24 ? L3('#9c7a34') : L3('#ad9150'); const k = noiseK(x, y, z, 0.25); return [c[0] * k, c[1] * k, c[2] * k, 0]; }),
      paint(lathe([[0.05, -0.025], [0.052, 0.0], [0.05, 0.025]], 12), FIX('#6a5030'))]);
  }
  // ---- horse (ground at y 0, nose toward +x) ----
  {
    const bodyProf = [[0, -0.9], [0.17, -0.86], [0.27, -0.78], [0.33, -0.64], [0.35, -0.46], [0.355, -0.2], [0.36, 0.05], [0.35, 0.3], [0.33, 0.5], [0.28, 0.64], [0.19, 0.73], [0, 0.78]];
    const body = lathe(bodyProf, 16); xf(body, 0, 0, 0, 0, 0, -Math.PI / 2); body.scale(1, 1, 0.72); body.translate(0, 1.17, 0);
    { const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); let dy = 0; if (y > 1.17) { const u = (y - 1.17) / 0.36; dy += u * (0.1 * Math.exp(-(((x - 0.38) / 0.16) ** 2)) + 0.05 * Math.exp(-(((x + 0.55) / 0.2) ** 2)) - 0.03 * Math.exp(-(((x + 0.05) / 0.25) ** 2))); } else { const u = (1.17 - y) / 0.36; dy -= u * 0.025 * Math.exp(-((x / 0.35) ** 2)); } p.setY(i, y + dy); } body.computeVertexNormals(); }
    const coat = (x, y) => { const k = (y < 0.95 ? 0.85 : 1) * (y > 1.45 ? 1.05 : 1); return [k, k, k, 1]; };
    const parts = [paint(body, coat),
      paint(sph(1, -0.55, 1.18, 0.12, 0.3, 0.32, 0.2, 12, 10), coat), paint(sph(1, -0.55, 1.18, -0.12, 0.3, 0.32, 0.2, 12, 10), coat),
      paint(sph(1, 0.42, 1.12, 0.12, 0.22, 0.3, 0.16, 10, 8), coat), paint(sph(1, 0.42, 1.12, -0.12, 0.22, 0.3, 0.16, 10, 8), coat),
      paint(sph(1, 0.62, 1.1, 0, 0.18, 0.24, 0.2, 10, 8), coat)];
    // saddle, girth, stirrup leathers and irons
    const lea = FIX('#3a2416');
    parts.push(paint(xf(lathe([[0.0, -0.22], [0.19, -0.2], [0.2, 0.0], [0.19, 0.2], [0, 0.22]], 12), 0.02, 1.5, 0, 0, 0, -Math.PI / 2, 0.45, 1, 0.85), lea),
      paint(gBox(0.1, 0.12, 0.26, 0.24, 1.6, 0, 0, 0, -0.3), lea), paint(gBox(0.08, 0.1, 0.3, -0.2, 1.58, 0, 0, 0, 0.35), lea),
      paint(xf(new THREE.TorusGeometry(0.335, 0.02, 4, 24), 0.12, 1.17, 0, 0, Math.PI / 2, 0, 0.8, 1.04, 1), lea));
    for (const sd of [1, -1]) {
      parts.push(paint(gBox(0.025, 0.54, 0.012, 0.08, 1.24, sd * 0.29, -sd * 0.18, 0, 0), lea), paint(xf(new THREE.TorusGeometry(0.045, 0.008, 4, 10), 0.08, 0.97, sd * 0.335, 0, 0, 0), FIX('#6a6a68')));
      parts.push(paint(gBox(0.24, 0.035, 0.012, 0.62, 1.27, sd * 0.19, 0, sd * -0.5, 0.25), lea));
    }
    P.hbody = merge(parts);
    // neck and head, one part pivoting at the neck base
    const nk = [];
    const neck = lathe([[0, -0.05], [0.21, 0.0], [0.22, 0.12], [0.19, 0.3], [0.155, 0.48], [0.13, 0.6], [0.12, 0.66], [0, 0.72]], 12, 1, 0.5); xf(neck, 0, 0, 0, 0, 0, -0.62); nk.push(paint(neck, coat));
    const hd = lathe([[0, 0], [0.105, 0.02], [0.122, 0.11], [0.112, 0.25], [0.088, 0.4], [0.078, 0.48], [0.06, 0.53], [0, 0.55]], 12, 0.85, 0.6);
    xf(hd, 0.38, 0.6, 0, 0, 0, -2.5);
    nk.push(paint(hd, (x, y) => { const k = y < 0.32 ? 0.6 : 1; return [k, k, k, 1]; }));
    for (const sd of [1, -1]) {
      nk.push(paint(xf(new THREE.ConeGeometry(0.03, 0.11, 5), 0.36, 0.74, sd * 0.055, sd * 0.25, 0, 0.3), TINT(0.9)));
      nk.push(paint(sph(0.02, 0.52, 0.48, sd * 0.068), FIX('#0e0c0a')));
      nk.push(paint(sph(0.016, 0.7, 0.17, sd * 0.03), FIX('#100c0a')));
    }
    const mane = []; for (let i = 0; i <= 8; i++) { const s = i / 8, a = s * 0.68; mane.push(vv(-0.17 + Math.sin(0.62) * a * 1.05 - (1 - s) * 0.03, 0.08 + Math.cos(0.62) * a, 0.03)); }
    nk.push(paint(tube(mane, mane.map((_, i) => 0.05 - i * 0.003), 6, 0.45, 1), TINT(0.32)));
    nk.push(paint(tube([vv(0.38, 0.66, 0), vv(0.45, 0.6, 0), vv(0.49, 0.54, 0)], [0.03, 0.035, 0.01], 5, 0.6, 1), TINT(0.32)));
    nk.push(paint(new THREE.TorusGeometry(0.085, 0.012, 4, 12).scale(0.75, 1.15, 1).rotateY(Math.PI / 2).rotateZ(-0.927).translate(0.6, 0.31, 0), lea));
    for (const sd of [1, -1]) nk.push(paint(tube([vv(0.72, 0.24, sd * 0.06), vv(0.45, 0.25, sd * 0.11), vv(0.12, 0.36, sd * 0.12), vv(-0.08, 0.46, sd * 0.05)], [0.007, 0.007, 0.007, 0.007], 4), lea));
    P.hneck = merge(nk);
    const tl = []; for (let i = 0; i <= 8; i++) { const s = i / 8; tl.push(vv(-0.05 * s - 0.16 * s * s, 0.05 - s * 0.82 + 0.1 * s * (1 - s), 0)); }
    P.htail = paint(tube(tl, [0.05, 0.065, 0.08, 0.09, 0.088, 0.08, 0.065, 0.045, 0.012], 7, 0.55, 1), TINT(0.33));
    const cloth = dbl(paint(xf(lathe([[0.385, -0.34], [0.392, -0.2], [0.395, 0.0], [0.39, 0.2], [0.38, 0.32]], 16, 1, 1, Math.PI * 1.5 - 1.75, 3.5), 0, 0, 0, 0, 0, -Math.PI / 2), (x, y) => y < -0.035 || Math.abs(x) > 0.3 ? [...L3('#c8a040'), 0] : [1, 1, 1, 1]));
    cloth.scale(1, 1, 0.74); cloth.translate(0.0, 1.17, 0);
    P.hcloth = cloth;
    const hoof = (x, y, z) => y < -0.47 ? [...L3('#1c1814'), 0] : [0.85, 0.85, 0.85, 1];
    P.hfu = paint(lathe([[0, -0.5], [0.055, -0.49], [0.06, -0.44], [0.072, -0.3], [0.092, -0.12], [0.1, 0.0], [0, 0.06]], 10, 1, 0.68), TINT(1));
    P.hfl = merge([paint(lathe([[0, -0.53], [0.058, -0.525], [0.055, -0.47], [0.046, -0.44], [0.052, -0.38], [0.042, -0.3], [0.04, -0.12], [0.052, -0.04], [0.058, 0.0], [0, 0.04]], 10, 1, 0.75), hoof)]);
    P.hhu = paint(lathe([[0, -0.52], [0.06, -0.5], [0.065, -0.44], [0.09, -0.28], [0.125, -0.1], [0.13, 0.02], [0, 0.1]], 10, 1, 0.62), TINT(1));
    P.hhl = merge([paint(lathe([[0, -0.6], [0.058, -0.595], [0.055, -0.54], [0.046, -0.51], [0.052, -0.45], [0.042, -0.36], [0.04, -0.12], [0.055, -0.03], [0.05, 0.03], [0, 0.06]], 10, 1, 0.75), (x, y) => y < -0.54 ? [...L3('#1c1814'), 0] : [0.85, 0.85, 0.85, 1]), paint(sph(0.04, -0.05, 0.0, 0, 1, 1, 0.8), TINT(0.9))]);
  }
  // ---- field gun (metres; muzzle toward +x, axle at the origin's x) ----
  {
    const wd = (x, y, z) => [...L3('#5c4128').map(c => c * noiseK(x, y, z, 0.12)), 0], ir = FIX('#262422');
    const ch = []; for (const sd of [1, -1]) { ch.push(paint(gBox(2.45, 0.22, 0.08, -0.85, 0.5, sd * 0.2, 0, 0, 0.27), wd)); ch.push(paint(gBox(0.06, 0.24, 0.085, -0.3, 0.68, sd * 0.2, 0, 0, 0.27), ir)); }
    ch.push(paint(gBox(0.14, 0.13, 1.0, 0, 0.62, 0), wd), paint(gCyl(0.035, 0.035, 0.98, 0, 0.62, 0, Math.PI / 2, 0, 0, 6), ir), paint(gBox(0.4, 0.06, 0.34, -1.95, 0.1, 0, 0, 0, 0.27), wd), paint(gBox(0.3, 0.08, 0.34, -0.8, 0.44, 0, 0, 0, 0.27), wd), paint(xf(new THREE.TorusGeometry(0.05, 0.012, 4, 10), -2.15, 0.08, 0, Math.PI / 2, 0, 0), ir));
    P.carriage = merge(ch);
    const bz = (x, y, z) => { const c = L3('#9a7438'); const k = Math.abs(Math.sin(x * 9)) > 0.97 ? 0.75 : 1; return [c[0] * k, c[1] * k, c[2] * k, 0]; };
    const bp = [[0, -0.98], [0.06, -0.97], [0.05, -0.92], [0.14, -0.9], [0.165, -0.8], [0.17, -0.55], [0.175, -0.52], [0.16, -0.5], [0.155, -0.1], [0.145, 0.3], [0.13, 0.7], [0.13, 0.95], [0.155, 1.05], [0.15, 1.15], [0.07, 1.16], [0.065, 1.0], [0, 1.0]];
    P.barrel = merge([paint(xf(lathe(bp, 14), 0, 0, 0, 0, 0, -Math.PI / 2), bz), paint(gCyl(0.05, 0.05, 0.42, 0, 0, 0, Math.PI / 2, 0, 0, 8), bz), paint(sph(0.07, -1.0, 0, 0), bz)]);
    const rim = paint(xf(new THREE.TorusGeometry(0.585, 0.04, 6, 28), 0, 0, 0, 0, 0, 0, 1, 1, 1.4), wd), tire = paint(xf(new THREE.TorusGeometry(0.625, 0.016, 4, 28), 0, 0, 0, 0, 0, 0, 1, 1, 2.6), ir);
    const wh = [rim, tire, paint(gCyl(0.09, 0.07, 0.22, 0, 0, 0, Math.PI / 2, 0, 0, 10), wd), paint(gCyl(0.05, 0.05, 0.26, 0, 0, 0, Math.PI / 2, 0, 0, 8), ir)];
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; wh.push(paint(gBox(0.032, 0.5, 0.03, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0, 0, 0, a - Math.PI / 2), wd)); }
    P.wheel = merge(wh);
  }
  for (const k in P) { P[k].userData.keep = true; P[k].computeBoundingSphere(); P[k].computeBoundingBox(); }
  return P;
}
function jiggleU(g, amt, R) {
  const p = g.attributes.position, cache = new Map();
  for (let i = 0; i < p.count; i++) { const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; let d = cache.get(key); if (!d) { d = [(R() - 0.5) * amt, (R() - 0.5) * amt, (R() - 0.5) * amt]; cache.set(key, d); } p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); }
  g.computeVertexNormals();
  return g;
}
const METAL_PARTS = new Set(['hMorion', 'hZisch', 'cuirass', 'pauldron', 'sabre', 'sword', 'barrel']);
const PART_CAP = { thigh: 2.2, shinK: 2.2, shinR: 1.1, shinB: 2.2, upper: 2.4, fore: 2.4, head: 1.2, hStraw: 1, hKalpak: 0.6, hFelt: 1.2, hMorion: 1, hZisch: 0.6, hCap: 0.4,
  tPeasant: 1, tCoat: 1.1, tZhupan: 0.6, tMusk: 1.2, cuirass: 1.2, pauldron: 1.0, wings: 0.5, hPeasant: 1, hCoat: 1.2, hGun: 0.4, hLong: 1, hRider: 0.7,
  pike: 1, musket: 1.2, ramrod: 0.8, sabre: 0.6, sword: 0.5, axe: 0.5, pick: 0.5, sickle: 0.5, hammer: 0.5, rammer: 0.2, linstock: 0.2, logs: 0.5, sack: 0.5, basketS: 0.4, basketG: 0.4, basketB: 0.4, sheaf: 0.4,
  hbody: 0.6, hneck: 0.6, htail: 0.6, hcloth: 0.6, hfu: 1.2, hfl: 1.2, hhu: 1.2, hhl: 1.2, carriage: 0.2, barrel: 0.2, wheel: 0.4, blob: 1.6 };
function tintMat(m) {
  if (m.userData.tinted) return m;
  m.userData.tinted = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    sh.vertexShader = 'attribute float tint;\n' + sh.vertexShader.replace('#include <color_vertex>', `
      #ifdef USE_COLOR
        vColor = color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        vColor.xyz *= mix(vec3(1.0), instanceColor.xyz, tint);
      #endif`);
    if (prev) prev(sh, r);
  };
  return m;
}
function blobTexture() {
  return canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.55, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }, null, false);
}
function initUnits(maxUnits = 900) {
  if (UR.root) { scene.remove(UR.root); }
  const geos = partGeos();
  UR.root = new THREE.Group(); scene.add(UR.root);
  UR.cap = maxUnits;
  const base = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });
  const metal = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.85 });
  tintMat(base); tintMat(metal);
  patchMat(base, { key: 'tint' }); patchMat(metal, { key: 'tintm' });
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  geos.blob = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); geos.blob.userData.keep = true;
  UR.ph = null;
  if (hasAsset('cannon_01_frame') && hasAsset('cannon_01_barrel') && hasAsset('cannon_01_wheel_01')) {
    // the scanned gun: muzzle turned to +x, scaled to a light field piece
    const tf = g => { const c = g.clone(); c.rotateY(Math.PI / 2); c.scale(1.15, 1.15, 1.15); c.computeBoundingBox(); c.userData.keep = true; return c; };
    geos.pcFrame = tf(ASSETS.geo.cannon_01_frame); geos.pcBarrel = tf(ASSETS.geo.cannon_01_barrel);
    if (ASSETS.geo.cannon_01_pusherblock) geos.pcPusher = tf(ASSETS.geo.cannon_01_pusherblock);
    const wheels = [];
    for (const w of ['cannon_01_wheel_01', 'cannon_01_wheel_02', 'cannon_01_wheel_03', 'cannon_01_wheel_04']) if (ASSETS.geo[w]) { const g = tf(ASSETS.geo[w]); wheels.push(g.boundingBox.getCenter(new THREE.Vector3())); if (!geos.pcWheel) { const c = wheels[0]; geos.pcWheel = g.translate(-c.x, -c.y, -c.z); geos.pcWheel.computeBoundingBox(); } }
    const bb = geos.pcBarrel.boundingBox, fb = geos.pcFrame.boundingBox;
    UR.ph = { wheels, muzzle: bb.max.x, breech: bb.min.x, axisY: (bb.min.y + bb.max.y) / 2, topY: bb.max.y, rear: fb.min.x, wr: (geos.pcWheel.boundingBox.max.y - geos.pcWheel.boundingBox.min.y) / 2 };
  }
  for (const k in geos) {
    const m = new THREE.InstancedMesh(geos[k], k === 'blob' ? blobMat : k.startsWith('pc') ? ASSETS.mat.cannon_01_frame : METAL_PARTS.has(k) ? metal : base, Math.ceil(maxUnits * (PART_CAP[k] || (k === 'pcWheel' ? 0.8 : k.startsWith('pc') ? 0.2 : 1))));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, _white);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.count = 0; m.frustumCulled = false; m.castShadow = k !== 'blob'; m.receiveShadow = k !== 'blob';
    if (k === 'blob') m.renderOrder = 1;
    m.userData.cap = m.instanceMatrix.count;
    UR.parts[k] = m; UR.root.add(m);
  }
}

// ---------- rig math ----------
const _A = new THREE.Matrix4(), _B = new THREE.Matrix4(), _T = new THREE.Matrix4(), _U = new THREE.Matrix4(), _L = new THREE.Matrix4();
const _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _P = new V3(), _S1 = new V3(1, 1, 1), _C = new THREE.Color();
const HM = { pel: new THREE.Matrix4(), chL: new THREE.Matrix4(), chW: new THREE.Matrix4(), inv: new THREE.Matrix4(), head: new THREE.Matrix4(), pelW: new THREE.Matrix4(), hand: [new THREE.Matrix4(), new THREE.Matrix4()] };
const ITM = Array.from({ length: 4 }, () => new THREE.Matrix4());
function put(part, mat, color) {
  const m = UR.parts[part];
  if (!m || m.count >= m.userData.cap) return;
  mat.toArray(m.instanceMatrix.array, m.count * 16);
  const c = color || _white, a = m.instanceColor.array, o = m.count * 3;
  a[o] = c.r; a[o + 1] = c.g; a[o + 2] = c.b;
  m.count++;
}
function putL(part, parent, local, color) { _T.multiplyMatrices(parent, local); put(part, _T, color); }
function mset(out, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, order = 'XYZ') { _E.set(rx, ry, rz, order); _Q.setFromEuler(_E); _P.set(x, y, z); _S1.set(s, s, s); return out.compose(_P, _Q, _S1); }
// segment from a to b (bone along local -y), local +x toward f; writes P * basis into out
function seg(out, P, ax, ay, az, bx, by, bz, fx, fy, fz) {
  let yx = ax - bx, yy = ay - by, yz = az - bz; const l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l;
  let d = fx * yx + fy * yy + fz * yz, xx = fx - d * yx, xy = fy - d * yy, xz = fz - d * yz, xl = Math.hypot(xx, xy, xz);
  if (xl < 1e-5) { xx = 1; xy = 0; xz = 0; d = yx; xx -= d * yx; xy -= d * yy; xz -= d * yz; xl = Math.hypot(xx, xy, xz) || 1; }
  xx /= xl; xy /= xl; xz /= xl;
  const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
  _B.set(xx, yx, zx, ax, xy, yy, zy, ay, xz, yz, zz, az, 0, 0, 0, 1);
  return out.multiplyMatrices(P, _B);
}
// two-bone IK: joint toward the pole; front=+1 makes the segment's +x face the pole (knees), -1 away (elbows)
function ik2(P, sx, sy, sz, tx, ty, tz, px, py, pz, L1, L2, outU, outL, front) {
  let dx = tx - sx, dy = ty - sy, dz = tz - sz; const D = Math.hypot(dx, dy, dz) || 1e-4;
  const Dc = clamp(D, Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.002);
  dx /= D; dy /= D; dz /= D;
  const pd = px * dx + py * dy + pz * dz; let nx = px - pd * dx, ny = py - pd * dy, nz = pz - pd * dz; let nl = Math.hypot(nx, ny, nz);
  if (nl < 1e-5) { nx = 1; ny = 0; nz = 0; nl = 1; }
  nx /= nl; ny /= nl; nz /= nl;
  const a = (L1 * L1 - L2 * L2 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const ex = sx + dx * a + nx * h, ey = sy + dy * a + ny * h, ez = sz + dz * a + nz * h;
  const hx = sx + dx * Dc, hy = sy + dy * Dc, hz = sz + dz * Dc;
  seg(outU, P, sx, sy, sz, ex, ey, ez, nx * front, ny * front, nz * front);
  seg(outL, P, ex, ey, ez, hx, hy, hz, nx * front, ny * front, nz * front);
}
// place an item: origin p, long axis d (+y), top/edge u (+x)
function place(out, px, py, pz, dx, dy, dz, ux, uy, uz) {
  let l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
  const d0 = ux * dx + uy * dy + uz * dz; ux -= d0 * dx; uy -= d0 * dy; uz -= d0 * dz; l = Math.hypot(ux, uy, uz);
  if (l < 1e-5) { ux = -dy; uy = dx; uz = 0; l = Math.hypot(ux, uy) || 1; if (l < 1e-5) { ux = 1; uy = 0; uz = 0; l = 1; } }
  ux /= l; uy /= l; uz /= l;
  const zx = uy * dz - uz * dy, zy = uz * dx - ux * dz, zz = ux * dy - uy * dx;
  return out.set(ux, dx, zx, px, uy, dy, zy, py, uz, dz, zz, pz, 0, 0, 0, 1);
}
const gp = (m, y) => { const e = m.elements; return [e[12] + e[4] * y, e[13] + e[5] * y, e[14] + e[6] * y]; };
const L3v = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const N3 = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const X3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ss = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const frac = x => x - Math.floor(x);
// chest-frame point/direction -> root frame (after rigBegin)
function c2r(p) { const e = HM.chL.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; }
function c2rD(p) { const e = HM.chL.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2], e[1] * p[0] + e[5] * p[1] + e[9] * p[2], e[2] * p[0] + e[6] * p[1] + e[10] * p[2]]; }
// a held item: blend two holds {p,d,u} and return the item matrix in the root frame
function holdM(out, A, Bh, k) {
  const p = Bh ? L3v(A.p, Bh.p, k) : A.p, d = Bh ? N3(L3v(A.d, Bh.d, k)) : A.d, u = Bh ? N3(L3v(A.u, Bh.u, k)) : A.u;
  return place(out, p[0], p[1], p[2], d[0], d[1], d[2], u[0], u[1], u[2]);
}
function blendHold(A, B, k) { return { p: L3v(A.p, B.p, k), d: N3(L3v(A.d, B.d, k)), u: N3(L3v(A.u, B.u, k)) }; }
function hc(h) { return { p: c2r(h.p), d: c2rD(h.d), u: c2rD(h.u) }; }

// pose object fields (metres, root frame unless noted):
// hx,hy,hz pelvis; yaw, pitch, roll of the pelvis; lean, twist, side of the chest; fR/fL ankle targets;
// aR/aL hand targets (root) or cR/cL (chest frame); eR/eL elbow poles (chest); kR/kL knee poles; look, nod; items [[part, m, color]]
function newPose() { return { hx: 0, hy: 0.925, hz: 0, yaw: 0, pitch: 0, roll: 0, lean: 0, twist: 0, side: 0, fR: [0.03, 0.085, 0.12], fL: [-0.02, 0.085, -0.12], aR: null, aL: null, cR: null, cL: null, eR: null, eL: null, kR: null, kL: null, look: 0, nod: 0, items: [] }; }
function rigBegin(o) {
  _E.set(o.roll, o.yaw, -o.pitch, 'YZX'); _Q.setFromEuler(_E); _P.set(o.hx, o.hy, o.hz); _S1.set(1, 1, 1);
  HM.pel.compose(_P, _Q, _S1);
  _E.set(o.side, o.twist, -o.lean, 'YZX'); _Q.setFromEuler(_E); _P.set(0, 0.12, 0);
  _A.compose(_P, _Q, _S1);
  HM.chL.multiplyMatrices(HM.pel, _A);
  HM.inv.copy(HM.chL).invert();
}
function swingArm(side, s, e, out) { // FK swing (+ forward) -> chest-frame hand point
  const sx = -0.01, sy = 0.39, sz = 0.2 * side;
  out[0] = sx + 0.29 * Math.sin(s) + 0.31 * Math.sin(s + e); out[1] = sy - 0.29 * Math.cos(s) - 0.31 * Math.cos(s + e); out[2] = sz + side * 0.045;
  return out;
}
function rigEnd(root, lk, o) {
  HM.pelW.multiplyMatrices(root, HM.pel);
  HM.chW.multiplyMatrices(root, HM.chL);
  put(lk.hips, HM.pelW, lk.coat);
  put(lk.torso, HM.chW, lk.coat);
  if (lk.armor) put('cuirass', HM.chW, _white);
  if (lk.wings) put('wings', HM.chW, _white);
  // legs, solved in the root frame
  const pe = HM.pel.elements;
  for (let sd = 1; sd >= -1; sd -= 2) {
    const hx = pe[8] * 0.1 * sd + pe[12], hy = pe[9] * 0.1 * sd + pe[13], hz = pe[10] * 0.1 * sd + pe[14];
    const f = sd > 0 ? o.fR : o.fL, kp = (sd > 0 ? o.kR : o.kL) || null;
    const px = kp ? kp[0] : Math.cos(o.yaw) * 1, py = kp ? kp[1] : 0, pz = kp ? kp[2] : -Math.sin(o.yaw) + 0.15 * sd;
    ik2(root, hx, hy, hz, f[0], f[1], f[2], px, py, pz, 0.43, 0.43, _U, _L, 1);
    put('thigh', _U, lk.pants); put(lk.shin, _L, lk.pants);
  }
  // arms, solved in the chest frame
  const ie = HM.inv.elements;
  for (let sd = 1; sd >= -1; sd -= 2) {
    let t = sd > 0 ? o.cR : o.cL;
    const ar = sd > 0 ? o.aR : o.aL;
    let tx, ty, tz;
    if (ar) { tx = ie[0] * ar[0] + ie[4] * ar[1] + ie[8] * ar[2] + ie[12]; ty = ie[1] * ar[0] + ie[5] * ar[1] + ie[9] * ar[2] + ie[13]; tz = ie[2] * ar[0] + ie[6] * ar[1] + ie[10] * ar[2] + ie[14]; }
    else { if (!t) t = [0.05, -0.19, 0.25 * sd]; tx = t[0]; ty = t[1]; tz = t[2]; }
    const ep = (sd > 0 ? o.eR : o.eL) || [-0.45, -0.55, 0.7 * sd];
    ik2(HM.chW, -0.01, 0.39, 0.2 * sd, tx, ty, tz, ep[0], ep[1], ep[2], 0.29, 0.31, _U, _L, -1);
    put('upper', _U, lk.arm); put('fore', _L, lk.arm);
    if (lk.pauldron) put('pauldron', _U, _white);
    HM.hand[sd > 0 ? 0 : 1].copy(_L);
  }
  // head
  _A.copy(mset(_A, 0, 0.455, 0, 0, o.look, -o.nod, 1, 'YZX'));
  HM.head.multiplyMatrices(HM.chW, _A);
  put('head', HM.head, lk.skin);
  if (lk.hat) put(lk.hat, HM.head, lk.hatCol || lk.coat);
  for (const it of o.items) { _T.multiplyMatrices(it[3] ? HM.chW : root, it[1]); put(it[0], _T, it[2]); }
}
// walking legs and arm swing
function gaitLegs(o, ph, mv, t, seed) {
  const qR = frac(ph / TAU), qL = frac(ph / TAU + 0.5);
  const SL = 0.27 * mv, D = 0.52, lift = 0.14 * mv;
  const foot = (q, out, sd) => {
    let x, y;
    if (q < D) { x = SL * (1 - 2 * q / D); y = 0; }
    else { const s = (q - D) / (1 - D); x = SL * (-1 + 2 * ss(s)); y = lift * Math.sin(Math.PI * s); }
    out[0] = x + 0.02; out[1] = 0.085 + y; out[2] = 0.11 * sd;
    return x;
  };
  const xr = foot(qR, o.fR, 1), xl = foot(qL, o.fL, -1);
  o.hy = 0.925 - 0.045 * mv + 0.02 * mv * Math.cos(qR * 2 * TAU) + (1 - mv) * 0.004 * Math.sin(t * 1.7 + seed);
  o.yaw = 0.08 * mv * Math.sin(qR * TAU + 1.2);
  o.twist = -o.yaw * 1.5;
  o.lean = 0.07 * mv;
  o.roll = 0.03 * mv * Math.sin(qR * TAU);
  return [-0.55 * (xr / 0.27), -0.55 * (xl / 0.27)];
}
function idleLegs(o, t, seed) {
  const w = Math.sin(t * 0.45 + seed * 3) * 0.5 + 0.5;
  o.fR = [0.04, 0.085, 0.13]; o.fL = [-0.03, 0.085, -0.12];
  o.hx = 0.0; o.hz = (w - 0.5) * 0.04; o.hy = 0.925 + 0.004 * Math.sin(t * 1.7 + seed);
  o.roll = (w - 0.5) * 0.04; o.lean = 0.01 * Math.sin(t * 1.7 + seed);
  o.look = 0.35 * Math.sin(t * 0.21 + seed * 5) * Math.sin(t * 0.13 + seed);
}
function swingBoth(o, sw, mv) {
  o.cR = swingArm(1, sw[0] * mv + 0.04, 0.3 + 0.45 * Math.max(0, sw[0]) * mv, [0, 0, 0]);
  o.cL = swingArm(-1, sw[1] * mv + 0.04, 0.3 + 0.45 * Math.max(0, sw[1]) * mv, [0, 0, 0]);
}

const RV = new Map(); // render-side state per unit id
function sm(r, key, target, rate, dt) { if (r[key] === undefined || !dt) r[key] = target; else r[key] += (target - r[key]) * Math.min(1, dt * rate); return r[key]; }
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
function rootMat(out, x, y, z, ang, tiltX = 0, tiltZ = 0, s = HK) { _E.set(tiltX, -ang, tiltZ, 'YXZ'); _Q.setFromEuler(_E); _P.set(x, y, z); _S1.set(s, s, s); out.compose(_P, _Q, _S1); return out; }
const _R0 = new THREE.Matrix4(), _R1 = new THREE.Matrix4(), _R2 = new THREE.Matrix4(), _BL = new THREE.Matrix4();
function blob(x, y, z, ang, sx, sz, a = 1) { _E.set(0, -ang, 0); _Q.setFromEuler(_E); _P.set(x, y + 0.012, z); _S1.set(sx * a, 1, sz * a); _BL.compose(_P, _Q, _S1); put('blob', _BL); }
function drawUnits(dt, alpha) {
  for (const k in UR.parts) UR.parts[k].count = 0;
  const viewR = CAM.dist * 1.25 + 8;
  const seen = new Set();
  for (const u of G.units) {
    if (u.team !== 0 && !visibleAt(u.x, u.z) && G.teams[u.team].side !== G.teams[0].side) continue;
    const x = u.px !== undefined ? lerp(u.px, u.x, alpha) : u.x, z = u.pz !== undefined ? lerp(u.pz, u.z, alpha) : u.z;
    if (Math.abs(x - CAM.tx) > viewR || Math.abs(z - CAM.tz) > viewR) continue;
    let r = RV.get(u.id);
    if (!r) { r = { lx: x, lz: z, mv: 0, ph: hash(u.id) * 10, skin: (hash(u.id * 7) * 4) | 0, horse: (hash(u.id * 13) * HORSE.length) | 0, ang: u.ang, seed: hash(u.id * 3) * 10 }; RV.set(u.id, r); }
    seen.add(u.id);
    const moved = hyp(x - r.lx, z - r.lz);
    r.lx = x; r.lz = z;
    const spd = dt > 0 ? moved / dt : 0;
    r.mv = lerp(r.mv, clamp(spd / (u.d.speed * 0.8), 0, 1), Math.min(1, dt * 8));
    r.ph += moved * (u.d.cls === 'cav' ? 4.6 : u.d.cls === 'art' ? 8 : 10.4);
    r.ang = u.pang !== undefined ? u.pang + angDiff(u.pang, u.ang) * alpha : u.ang;
    if (window.__wfMv && window.__wfMv[u.id] !== undefined) { r.mv = window.__wfMv[u.id]; if (window.__wfPh) r.ph = window.__wfPh[u.id] || r.ph; }
    drawUnit(u, x, z, r, dt);
  }
  for (const c of G.corpses) {
    const age = G.t - c.t;
    if (age > 30 || !visibleAt(c.x, c.z) && c.team !== 0) continue;
    if (Math.abs(c.x - CAM.tx) > viewR || Math.abs(c.z - CAM.tz) > viewR) continue;
    drawCorpse(c, age);
  }
  for (const k in UR.parts) { const m = UR.parts[k]; m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  if (RV.size > G.units.length + 200) for (const id of RV.keys()) if (!seen.has(id) && !G.units.some(u => u.id === id)) RV.delete(id);
}
const LOOKS = {
  peasant: { torso: 'tPeasant', hips: 'hPeasant', shin: 'shinB', hat: 'hStraw' },
  pikeman: { torso: 'tCoat', hips: 'hCoat', shin: 'shinK', hat: 'hMorion', armor: true },
  musketeer: { torso: 'tMusk', hips: 'hLong', shin: 'shinK', hat: 'hFelt' },
  lighthorse: { torso: 'tZhupan', hips: 'hRider', shin: 'shinR', hat: 'hKalpak' },
  dragoon: { torso: 'tMusk', hips: 'hRider', shin: 'shinK', hat: 'hFelt' },
  cuirassier: { torso: 'tCoat', hips: 'hRider', shin: 'shinK', hat: 'hZisch', armor: true, pauldron: true, wings: true },
  cannon: { torso: 'tCoat', hips: 'hGun', shin: 'shinK', hat: 'hCap' },
};
const _lk = {};
function lookFor(type, team, skin) {
  const L = LOOKS[type];
  Object.assign(_lk, L);
  _lk.pauldron = !!L.pauldron; _lk.armor = !!L.armor; _lk.wings = !!L.wings;
  _lk.coat = coatColor(team); _lk.arm = type === 'peasant' ? LINEN : _lk.coat; _lk.pants = pantsCol[type]; _lk.skin = SKIN[skin % 4]; _lk.hatCol = _lk.coat;
  return _lk;
}
// ----- poses -----
function chopHold(c, A, B) { // windup -> strike timeline for a two-handed tool; c in [0,1)
  let k;
  if (c < 0.55) k = 0.15 * (1 - ss(c / 0.55));
  else if (c < 0.68) k = ss((c - 0.55) / 0.13);
  else k = 1 - 0.85 * ss((c - 0.68) / 0.32);
  const nP = N3(X3(A.d, B.d));
  const p = L3v(A.p, B.p, k), d = N3(L3v(A.d, B.d, k)), u = N3(X3(nP, d));
  return { p, d, u, k };
}
function drawPeasant(u, root, r, t, dt, o, lk) {
  const kind = u.state === 'build' ? 'build' : u.job ? u.job.kind : null;
  const working = (u.state === 'gather' && u.sub === 'work') || (u.state === 'build' && r.mv < 0.3 && u.bld && bDist(u, u.bld) < 0.9);
  const fightHit = u.state === 'attack' && t - u.strikeT < 0.6;
  if (working || fightHit) {
    const K = fightHit ? 'tree' : kind;
    if (K === 'tree') {
      const c = fightHit ? clamp((t - u.strikeT) / 0.6 + 0.55, 0, 1) : frac(u.anim / 5.5);
      const h = chopHold(c, { p: [-0.06, 1.62, 0.2], d: N3([-0.55, 0.75, 0.3]) }, { p: [0.42, 1.08, 0.05], d: N3([0.85, 0.12, -0.45]) });
      o.fL = [0.2, 0.085, -0.15]; o.fR = [-0.16, 0.085, 0.17]; o.hy = 0.89; o.yaw = -0.25; o.twist = lerp(-0.35, 0.25, h.k); o.lean = lerp(-0.05, 0.28, h.k);
      place(ITM[0], ...gp(place(ITM[1], ...h.p, ...h.d, ...h.u), -0.18), ...h.d, ...h.u);
      o.aL = gp(ITM[0], 0.04); o.aR = gp(ITM[0], 0.2); o.items.push(['axe', ITM[0], _white]);
      o.eR = [-0.2, -0.6, 0.8]; o.eL = [-0.2, -0.6, -0.8];
    } else if (K === 'stone' || K === 'gold') {
      const c = frac(u.anim / 5.5);
      const h = chopHold(c, { p: [0.02, 1.72, 0.03], d: N3([-0.45, 0.9, 0.0]) }, { p: [0.5, 0.8, 0.0], d: N3([0.75, -0.65, 0.0]) });
      o.fL = [0.12, 0.085, -0.17]; o.fR = [-0.06, 0.085, 0.17]; o.hy = lerp(0.92, 0.8, h.k); o.lean = lerp(-0.1, 0.55, h.k);
      place(ITM[0], ...gp(place(ITM[1], ...h.p, ...h.d, ...h.u), -0.2), ...h.d, ...h.u);
      o.aL = gp(ITM[0], 0.05); o.aR = gp(ITM[0], 0.24); o.items.push(['pick', ITM[0], _white]);
      o.eR = [-0.3, -0.5, 0.8]; o.eL = [-0.3, -0.5, -0.8];
    } else if (K === 'farm') {
      const c = frac(u.anim / 6.5), sw = Math.sin(c * TAU);
      o.fL = [0.16, 0.085, -0.2]; o.fR = [-0.12, 0.085, 0.2]; o.hy = 0.8; o.lean = 0.78 + 0.05 * sw; o.twist = 0.15 * sw;
      const a = 0.6 + sw * 0.7;
      const hp = [0.5 + 0.06 * Math.cos(a), 0.3, 0.12 + Math.sin(a) * 0.22];
      place(ITM[0], ...hp, Math.cos(a) * 0.5, 0.75, -Math.sin(a) * 0.5 + 0.2, 0.2, 0.5, -0.8);
      o.aR = hp; o.aL = [0.56, 0.36 - 0.05 * sw, -0.12]; o.items.push(['sickle', ITM[0], _white]);
      o.eR = [-0.3, 0.2, 1]; o.eL = [-0.3, 0.2, -1];
    } else if (K === 'berry') {
      const c = frac(u.anim / 7), k = ss(c < 0.5 ? c * 2 : 2 - c * 2);
      o.fL = [0.08, 0.085, -0.17]; o.fR = [-0.02, 0.085, 0.17]; o.hy = 0.6; o.lean = 0.4; o.pitch = 0.2;
      o.aR = L3v([0.55, 0.62, 0.08], [0.22, 0.5, -0.12], k);
      place(ITM[0], 0.28, 0.08, -0.2, 0, 1, 0, 1, 0, 0); o.items.push(['basketB', ITM[0], _white]);
      o.aL = [0.48, 0.6 + 0.05 * Math.sin(t * 3), -0.1];
      o.kR = [1, 0.2, 0.5]; o.kL = [1, 0.2, -0.5];
    } else { // building: kneel and hammer, or stand at the wall
      const c = frac(u.anim / 4.2), kn = hash(u.id * 5) < 0.5;
      const k = c < 0.6 ? 1 - ss(c / 0.6) : ss((c - 0.6) / 0.15);
      if (kn) { o.hy = 0.56; o.fR = [-0.36, 0.09, 0.13]; o.fL = [0.34, 0.085, -0.14]; o.lean = 0.25; o.kR = [0.2, -1, 0.1]; }
      else { o.fL = [0.14, 0.085, -0.14]; o.fR = [-0.08, 0.085, 0.15]; o.lean = 0.08; }
      const tgt = kn ? [0.5, 0.36, 0.0] : [0.45, 1.15, 0.02], up = kn ? [0.2, 0.95, 0.2] : [0.18, 1.55, 0.22];
      const hp = L3v(up, tgt, k), dir = N3(L3v([-0.6, 0.6, 0.1], [0.4, 0.92, -0.05], k));
      place(ITM[0], ...hp, ...dir, ...N3(X3([0, 0, 1], dir)));
      o.aR = hp; o.aL = [tgt[0] + 0.02, tgt[1] + 0.02, -0.07]; o.items.push(['hammer', ITM[0], _white]);
    }
    return;
  }
  if (u.carry > 0.5) {
    const sw = gaitLegs(o, r.ph, r.mv, t, r.seed);
    const res = u.carryRes, farm = u.job && u.job.kind === 'farm', berry = u.job && u.job.kind === 'berry';
    if (res === W) { mset(ITM[0], 0.02, 0.5, 0.16, 0.06, 0, -0.12); o.items.push(['logs', ITM[0], _white, true]); o.cR = [0.16, 0.48, 0.25]; o.eR = [0, -1, 0.6]; o.cL = swingArm(-1, sw[1] * r.mv, 0.35, [0, 0, 0]); }
    else if (res === S || res === Au) { mset(ITM[0], 0.26, -0.03, 0, 0, 0, -0.05); o.items.push([res === S ? 'basketS' : 'basketG', ITM[0], _white, true]); o.cR = [0.24, 0.02, 0.18]; o.cL = [0.24, 0.02, -0.18]; o.eR = [-0.6, -0.6, 0.6]; o.eL = [-0.6, -0.6, -0.6]; o.lean -= 0.1; }
    else if (farm) { mset(ITM[0], -0.02, 0.56, -0.17, 0.25, 0, 0.75); o.items.push(['sheaf', ITM[0], _white, true]); o.cL = [0.12, 0.47, -0.24]; o.eL = [0, -1, -0.6]; o.cR = swingArm(1, sw[0] * r.mv, 0.35, [0, 0, 0]); }
    else if (berry) { o.cR = swingArm(1, 0.05, 0.3, [0, 0, 0]); mset(ITM[0], o.cR[0], o.cR[1] - 0.22, o.cR[2] + 0.02, 0, 0, 0); o.items.push(['basketB', ITM[0], _white, true]); o.cL = swingArm(-1, sw[1] * r.mv, 0.35, [0, 0, 0]); }
    else { mset(ITM[0], -0.2, 0.3, 0.04, 0.0, 0, 0.3); o.items.push(['sack', ITM[0], _white, true]); o.cR = [0.06, 0.48, 0.16]; o.eR = [0, -1, 0.6]; o.cL = swingArm(-1, sw[1] * r.mv, 0.35, [0, 0, 0]); o.lean += 0.12; }
    return;
  }
  if (r.mv > 0.05) { const sw = gaitLegs(o, r.ph, r.mv, t, r.seed); swingBoth(o, sw, r.mv); }
  else idleLegs(o, t, r.seed);
}
function drawPikeman(u, root, r, t, dt, o, fighting) {
  const lv = sm(r, 'lv', fighting ? 1 : 0, 3.5, dt);
  const sinceStrike = t - u.strikeT;
  if (r.mv > 0.05) { const sw = gaitLegs(o, r.ph, r.mv, t, r.seed); o.cL = swingArm(-1, sw[1] * r.mv * (1 - lv), 0.3, [0, 0, 0]); }
  else idleLegs(o, t, r.seed);
  if (lv > 0.01) {
    o.fL = L3v(o.fL, [0.26, 0.085, -0.13], lv); o.fR = L3v(o.fR, [-0.22, 0.085, 0.16], lv);
    o.hy = lerp(o.hy, 0.86, lv); o.yaw = lerp(o.yaw, -0.32, lv); o.twist = lerp(o.twist, 0.12, lv);
  }
  const thrust = sinceStrike < 0.45 ? Math.sin(Math.min(1, sinceStrike / 0.45) * Math.PI) * (sinceStrike < 0.12 ? 1 : 1) : 0;
  o.lean = lerp(o.lean, 0.14 + thrust * 0.2, lv);
  rigBegin(o);
  const order = { p: [0.12, 1.06, 0.25], d: N3([0.03, 1, 0.02]), u: [1, 0, 0] };
  const march = hc({ p: [0.1, 0.12, 0.23], d: N3([-0.55, 0.83, 0.06]), u: [0, 0, 1] });
  const rest = blendHold(order, march, ss((r.mv - 0.05) / 0.4));
  const charge = { p: [-0.05 + thrust * 0.28, 1.2, 0.1], d: N3([1, -0.07, -0.03]), u: [0, 1, 0] };
  holdM(ITM[0], rest, charge, ss(lv));
  o.aR = gp(ITM[0], 0); o.items.push(['pike', ITM[0], _white]);
  if (lv > 0.3) { o.aL = gp(ITM[0], 0.48); o.eL = [-0.2, -0.8, -0.6]; }
  o.eR = lv > 0.5 ? [-0.3, -0.8, 0.6] : null;
}
function drawMusketeer(u, root, r, t, dt, o, fighting, seated) {
  const g = u.d.gun, sinceFire = t - u.fireT;
  if (u.fireT !== r.lastFire) { r.lastFire = u.fireT; r.reloadTot = Math.max(1.5, u.cd + Math.max(0, sinceFire)); }
  const reloading = fighting && u.cd > 0 && sinceFire >= 0.3 && sinceFire < (r.reloadTot || g.cd) + 0.5;
  const aiming = fighting && (u.cd <= 0 || sinceFire < 0.3);
  const ak = sm(r, 'aimK', aiming ? 1 : 0, aiming ? 5 : 3, dt);
  if (!seated) {
    if (r.mv > 0.05) { const sw = gaitLegs(o, r.ph, r.mv, t, r.seed); o.cR = swingArm(1, sw[0] * r.mv, 0.35, [0, 0, 0]); }
    else idleLegs(o, t, r.seed);
    if (ak > 0.01 || reloading) {
      const k = Math.max(ak, reloading ? 1 : 0);
      o.fL = L3v(o.fL, [0.2, 0.085, -0.1], k); o.fR = L3v(o.fR, [-0.15, 0.085, 0.18], k); o.hy = lerp(o.hy, 0.9, k);
      o.yaw = lerp(o.yaw, -0.45 * ak, k); o.twist = lerp(o.twist, -0.08 * ak, k);
    }
  } else { o.yaw = -0.35 * ak; }
  const kick = sinceFire < 0.3 ? (1 - sinceFire / 0.3) ** 2 : 0;
  o.lean = lerp(o.lean, 0.05 - kick * 0.12, ak);
  o.nod = 0.18 * ak; o.look = lerp(o.look, -0.12, ak);
  rigBegin(o);
  const H = seated ? 0.68 : 0;
  const shoulder = seated ? { p: [0.3, 1.66 + 0.1, 0.22], d: N3([0.1, 1, 0.05]), u: [1, 0, 0] } : hc({ p: [0.13, 0.05, -0.2], d: N3([-0.16, 0.4, 0.01]), u: [0.92, 0.39, 0] });
  if (!seated) { const sp = shoulder.p, sd = shoulder.d; shoulder.p = [sp[0] + sd[0] * 0.3, sp[1] + sd[1] * 0.3, sp[2] + sd[2] * 0.3]; }
  const aim = { p: [0.22 - kick * 0.06, 1.47 + H, 0.05], d: N3([1, kick * 0.3, -0.05]), u: [-kick * 0.3, 1, 0] };
  let item = null, aR = null, aL = null, rod = null;
  if (reloading && !seated) {
    const p = clamp((sinceFire - 0.3) / Math.max(0.5, (r.reloadTot || g.cd) - 0.3), 0, 1);
    const vert = { p: [0.32, 0.3, -0.07], d: N3([0.06, 1, 0.05]), u: [1, 0, 0] };
    const prime = { p: [0.25, 1.15, 0.06], d: N3([1, 0.15, -0.1]), u: [0, 1, 0] };
    const muzzle = [0.32 + 0.06 * 1.16, 0.3 + 1.16, -0.07 + 0.05 * 1.16];
    if (p < 0.12) { const k = ss(p / 0.12); holdM(ITM[0], aim, vert, k); aR = L3v(gp(holdM(ITM[1], aim), 0), [0.1, 1.05, 0.2], k); }
    else if (p < 0.75) {
      holdM(ITM[0], vert);
      if (p < 0.2) aR = L3v([0.1, 1.0, 0.2], muzzle, ss((p - 0.12) / 0.08));
      else if (p < 0.27) aR = L3v(muzzle, [muzzle[0], muzzle[1] + 0.05, muzzle[2]], Math.sin((p - 0.2) / 0.07 * Math.PI));
      else if (p < 0.35) { const k = ss((p - 0.27) / 0.08); aR = [muzzle[0] + 0.02, lerp(muzzle[1] + 0.05, muzzle[1] + 0.95, k), muzzle[2]]; rod = true; }
      else if (p < 0.65) { const k = 0.5 + 0.5 * Math.cos((p - 0.35) / 0.3 * TAU * 3); aR = [muzzle[0] + 0.01, muzzle[1] + 0.12 + 0.5 * k, muzzle[2]]; rod = true; }
      else { const k = ss((p - 0.65) / 0.1); aR = [muzzle[0] + 0.02, lerp(muzzle[1] + 0.95, muzzle[1] + 0.05, k), muzzle[2]]; rod = k < 0.95; }
    } else { const k = ss((p - 0.75) / 0.15); holdM(ITM[0], vert, prime, k); aR = L3v(muzzle, gp(holdM(ITM[1], prime), 0.03), k); }
    aL = gp(ITM[0], p < 0.75 ? 0.62 : 0.4 + 0.22 * (1 - ss((p - 0.75) / 0.15)));
    o.lean = 0.08; o.nod = 0.25;
  } else {
    holdM(ITM[0], shoulder, aim, ss(ak));
    if (ak > 0.5) { aR = gp(ITM[0], 0); aL = gp(ITM[0], 0.4); }
    else { aL = gp(ITM[0], seated ? 0.0 : -0.3); if (seated) { aL = null; aR = gp(ITM[0], -0.05); } }
  }
  o.items.push(['musket', ITM[0], _white]);
  if (rod) { place(ITM[2], aR[0], aR[1], aR[2], 0, 1, 0, 1, 0, 0); o.items.push(['ramrod', ITM[2], _white]); }
  if (aR) o.aR = aR;
  if (aL) o.aL = aL;
  o.eR = ak > 0.5 ? [-0.2, -0.9, 0.5] : null; o.eL = ak > 0.5 ? [0.0, -1, -0.4] : [-0.2, -0.9, -0.5];
}
function horseGait(r, t, mv, dt) {
  // returns leg angles for FL, FR, HL, HR as [upper, lower] and body bob/pitch
  const ph = r.ph, out = r.hg || (r.hg = { legs: [[0, 0], [0, 0], [0, 0], [0, 0]], bob: 0, pitch: 0, neck: 0 });
  const gal = mv;
  const offs = [0.5, 0.62, 0.0, 0.12], duty = 0.38;
  for (let i = 0; i < 4; i++) {
    const front = i < 2, q = frac(ph / TAU - offs[i]);
    let a, b;
    if (q < duty) { a = 0.45 * (1 - 2 * q / duty); b = 0; }
    else { const s = (q - duty) / (1 - duty); a = -0.45 + 0.9 * ss(s); b = Math.sin(Math.PI * s) * (front ? -1.4 : 1.15); if (front) a += Math.sin(Math.PI * s) * 0.35; }
    const restA = front ? 0 : -0.3, restB = front ? 0 : 0.3;
    // idle: one hind leg cocked, slow weight shifts
    let ia = restA, ib = restB;
    if (i === 3) { const c = Math.sin(t * 0.2 + r.seed) > 0.2 ? 1 : 0; ib += 0.35 * c; ia += 0.05 * c; }
    out.legs[i][0] = lerp(ia, restA + a * (front ? 1 : 0.85), gal);
    out.legs[i][1] = lerp(ib, restB + b, gal);
  }
  out.bob = gal * (0.06 * Math.sin(ph * 1 + 0.6) + 0.02);
  out.pitch = gal * 0.06 * Math.sin(ph + 2.0);
  const graze = (1 - gal) * (Math.sin(t * 0.11 + r.seed * 2) > 0.55 ? 1 : 0);
  out.neck = sm(r, 'graze', graze, 0.8, dt) * -0.95 + gal * 0.12 * Math.sin(ph + 1.0) + (1 - gal) * 0.04 * Math.sin(t * 0.7 + r.seed);
  return out;
}
function drawHorse(base, r, t, mv, dt, team) {
  const hg = horseGait(r, t, mv, dt);
  const H = mset(_R1, 0, hg.bob, 0, 0, 0, hg.pitch);
  const hr = _R2.multiplyMatrices(base, H);
  const hc0 = HORSE[r.horse];
  put('hbody', hr, hc0);
  put('hcloth', hr, coatColor(team));
  putL('hneck', hr, mset(_A, 0.52, 1.32, 0, 0, 0, hg.neck), hc0);
  putL('htail', hr, mset(_A, -0.86, 1.36, 0, Math.sin(t * 2.3 + r.seed) * 0.12 * (1 - mv), 0, -(0.08 + mv * 0.75) + Math.sin(t * 1.3 + r.seed) * 0.06 + Math.sin(r.ph) * 0.1 * mv), hc0);
  const pivots = [[0.45, 1.0, -0.15], [0.45, 1.0, 0.15], [-0.55, 1.07, -0.14], [-0.55, 1.07, 0.14]];
  for (let i = 0; i < 4; i++) {
    const [px, py, pz] = pivots[i], [a, b] = hg.legs[i], front = i < 2;
    mset(_A, px, py, pz, 0, 0, a); _U.multiplyMatrices(hr, _A); put(front ? 'hfu' : 'hhu', _U, hc0);
    mset(_A, 0, front ? -0.48 : -0.5, 0, 0, 0, b); _L.multiplyMatrices(_U, _A); put(front ? 'hfl' : 'hhl', _L, hc0);
  }
  return hr;
}
function drawUnit(u, x, z, r, dt) {
  const y = Math.max(heightAt(x, z), -0.12);
  const t = G.t, d = u.d, type = u.type, team = u.team;
  if (r.seed === undefined) r.seed = 0;
  const root = rootMat(_R0, x, y, z, r.ang);
  const fighting = u.state === 'attack' && u.target && u.target.hp > 0 && edist(u, u.target) < (d.gun ? d.gun.range + 2 : d.art ? 20 : 3.5);
  const o = newPose();
  if (d.cls === 'worker' || type === 'pikeman' || type === 'musketeer') {
    const lk = lookFor(type, team, r.skin);
    if (type === 'peasant') { lk.hatCol = lk.coat; drawPeasant(u, root, r, t, dt, o, lk); rigBegin(o); }
    else if (type === 'pikeman') drawPikeman(u, root, r, t, dt, o, fighting);
    else drawMusketeer(u, root, r, t, dt, o, fighting, false);
    rigEnd(root, lk, o);
    blob(x, y, z, r.ang, 0.36, 0.32);
    return;
  }
  if (d.cls === 'cav') {
    const hr = drawHorse(root, r, t, r.mv, dt, team);
    blob(x, y, z, r.ang, 1.05, 0.5);
    const lk = lookFor(type, team, r.skin);
    o.hx = 0.02; o.hy = 1.64 + 0.02 * Math.sin(r.ph * 2) * r.mv; o.fR = [0.1, 0.99, 0.31]; o.fL = [0.1, 0.99, -0.31]; o.kR = [1, -0.1, 0.9]; o.kL = [1, -0.1, -0.9];
    o.lean = 0.06 + 0.1 * r.mv; o.look = (1 - r.mv) * 0.3 * Math.sin(t * 0.25 + r.seed);
    const reins = [0.42 + 0.05 * r.mv, 1.8 - 0.03 * r.mv, -0.05];
    if (type === 'dragoon') { drawMusketeer(u, root, r, t, dt, o, fighting, true); if (!(r.aimK > 0.5)) o.aL = reins; }
    else {
      const sinceStrike = t - u.strikeT, charging = fighting || (u.state === 'move' && u.amove && r.mv > 0.5);
      const rk = sm(r, 'raise', charging ? 1 : 0, 3, dt);
      o.lean += rk * 0.12;
      rigBegin(o);
      const rest = hc({ p: [0.16, 0.12, 0.26], d: N3([-0.25, 0.95, 0.12]), u: [1, 0, 0] });
      const high = { p: [0.32, 2.42, 0.25], d: N3([-0.55, 0.55, 0.15]), u: [0, 1, 0] };
      let h;
      if (fighting && sinceStrike < 0.5) h = chopHold(clamp(0.55 + sinceStrike / 0.5 * 0.45, 0, 1), high, { p: [0.62, 1.7, 0.42], d: N3([0.75, -0.55, 0.35]) });
      else { const p = L3v(rest.p, high.p, ss(rk)), dd = N3(L3v(rest.d, high.d, ss(rk))); h = { p, d: dd, u: N3(X3([0, 0, 1], dd)) }; }
      place(ITM[0], ...h.p, ...h.d, ...h.u);
      o.aR = h.p; o.items.push([type === 'cuirassier' ? 'sword' : 'sabre', ITM[0], _white]);
      o.eR = [-0.2, -0.5, 0.9];
      o.aL = reins;
    }
    if (type === 'dragoon') rigBegin(o);
    rigEnd(hr, lk, o);
    return;
  }
  if (type === 'cannon') {
    const sinceFire = t - u.fireT;
    const recoil = sinceFire < 0.8 ? Math.sin(Math.min(1, sinceFire / 0.12) * Math.PI / 2) * (1 - sinceFire / 0.8) * 0.45 : 0;
    const gun = _R1.multiplyMatrices(root, mset(_A, -recoil, 0, 0));
    const PH = UR.ph;
    if (PH) {
      put('pcFrame', gun); put('pcBarrel', gun); if (UR.parts.pcPusher) put('pcPusher', gun);
      const spin = -(r.ph * 1.8 - recoil / Math.max(0.05, PH.wr)) % TAU;
      for (const c of PH.wheels) putL('pcWheel', gun, mset(_A, c.x, c.y, c.z, 0, 0, spin));
    } else {
      put('carriage', gun);
      putL('barrel', gun, mset(_A, 0, 0.86, 0, 0, 0, fighting ? 0.06 : 0.02));
      const spin = -(r.ph * 0.6 - recoil * 1.6) % TAU;
      putL('wheel', gun, mset(_A, 0, 0.62, 0.44, 0, 0, spin)); putL('wheel', gun, mset(_A, 0, 0.62, -0.44, 0, 0, spin));
    }
    const MZ = PH ? PH.muzzle : 1.16, BR = PH ? PH.breech + 0.12 : -0.8, AY = PH ? PH.axisY : 0.95, TY = PH ? PH.topY : 1.02, RX = PH ? PH.rear - 0.45 : -1.95;
    blob(x, y, z, r.ang, 1.3, 0.75);
    const reloading = u.cd > 0 && sinceFire < 9 && fighting;
    const lk = lookFor('cannon', team, r.skin);
    for (let k = 0; k < 2; k++) {
      const o2 = newPose(), sd = k ? -1 : 1;
      if (r.mv > 0.2) {
        const sw = gaitLegs(o2, r.ph + k * 2, r.mv, t, r.seed + k);
        o2.hx = RX; o2.hz = sd * 0.36; o2.lean = 0.5; o2.hy -= 0.06;
        for (const f of [o2.fR, o2.fL]) { f[0] += RX - 0.1; f[2] += sd * 0.36; }
        rigBegin(o2); o2.aR = [RX + 0.32, PH ? 0.42 : 0.32, sd * 0.3 + 0.1]; o2.aL = [RX + 0.32, PH ? 0.42 : 0.32, sd * 0.3 - 0.1];
      } else if (k === 0) {
        // the loader stands forward of the muzzle and works the rammer
        o2.hx = MZ + 0.55; o2.hz = 0.62; o2.yaw = Math.PI / 2 + 0.3;
        const c = reloading ? 0.5 + 0.5 * Math.cos(t * 3.2) : 1;
        const fp = (lx, lz) => [o2.hx + Math.cos(o2.yaw) * lx + Math.sin(o2.yaw) * lz, 0.085, o2.hz - Math.sin(o2.yaw) * lx + Math.cos(o2.yaw) * lz];
        o2.fR = fp(0.12, 0.13); o2.fL = fp(-0.1, -0.13); o2.lean = reloading ? 0.2 : 0.02;
        rigBegin(o2);
        if (reloading) { place(ITM[0], MZ + 0.4 + 0.45 * c, AY, 0.1, -1, 0.0, -0.05, 0, 1, 0); o2.aR = gp(ITM[0], -0.25); o2.aL = gp(ITM[0], 0.15); }
        else { place(ITM[0], MZ + 0.62, 0.5, 0.52, 0.05, 1, -0.05, 1, 0, 0); o2.aR = gp(ITM[0], 0.4); }
        o2.items.push(['rammer', ITM[0], _white]);
      } else {
        o2.hx = BR - 0.15; o2.hz = -0.72; o2.yaw = -Math.PI / 2 + 0.35;
        const fp = (lx, lz) => [o2.hx + Math.cos(o2.yaw) * lx + Math.sin(o2.yaw) * lz, 0.085, o2.hz - Math.sin(o2.yaw) * lx + Math.cos(o2.yaw) * lz];
        o2.fR = fp(0.1, 0.13); o2.fL = fp(-0.05, -0.13);
        const touch = fighting && (u.aimT > 0 || sinceFire < 0.15);
        const tk = sm(r, 'touch', touch ? 1 : 0, 9, dt);
        o2.lean = 0.05 + tk * 0.35;
        rigBegin(o2);
        const up = { p: [BR - 0.02, 1.12, -0.5], d: N3([0.05, 1, 0.05]), u: [1, 0, 0] };
        const tp = [BR + 0.02, TY, -0.02], dd = N3([0.15, -0.6, 0.6]);
        const reach = { p: [tp[0] - dd[0] * 0.42, tp[1] - dd[1] * 0.42, tp[2] - dd[2] * 0.42], d: dd, u: [0, 1, 0] };
        holdM(ITM[1], up, reach, tk);
        o2.aR = gp(ITM[1], 0); o2.items.push(['linstock', ITM[1], _white]);
      }
      rigEnd(gun, lk, o2);
    }
    return;
  }
}
function drawCorpse(c, age) {
  const y = Math.max(heightAt(c.x, c.z), -0.12) - (age > 24 ? (age - 24) * 0.02 : 0);
  const k = Math.min(1, age / 0.6), fall = k * k;
  const d = UT[c.type];
  if (d.cls === 'cav') {
    const sg = c.fall, a = fall * Math.PI / 2;
    const root = rootMat(_R0, c.x, y, c.z, c.ang);
    const hr = _R1.multiplyMatrices(root, _A.makeTranslation(0, 0.27 * fall, -1.17 * Math.sin(a) * sg * 0.85).multiply(_B.makeRotationX(sg * a)));
    const hc0 = HORSE[(hash(c.id * 13) * HORSE.length) | 0];
    put('hbody', hr, hc0); put('hcloth', hr, coatColor(c.team));
    putL('hneck', hr, mset(_A, 0.52, 1.32, 0, 0, 0, -0.4 * fall), hc0);
    putL('htail', hr, mset(_A, -0.86, 1.36, 0, 0, 0, -0.5), hc0);
    const pv = [[0.45, 1.0, -0.15, 0.45], [0.45, 1.0, 0.15, 0.75], [-0.55, 1.07, -0.14, -0.45], [-0.55, 1.07, 0.14, -0.75]];
    for (let i = 0; i < 4; i++) { const [px, py, pz, aa] = pv[i]; mset(_A, px, py, pz, 0, 0, aa * fall); _U.multiplyMatrices(hr, _A); put(i < 2 ? 'hfu' : 'hhu', _U, hc0); mset(_A, 0, i < 2 ? -0.48 : -0.5, 0, 0, 0, (i < 2 ? -1.15 : 1.05) * fall * (i % 2 ? 1 : 0.8)); _L.multiplyMatrices(_U, _A); put(i < 2 ? 'hfl' : 'hhl', _L, hc0); }
    const off = 0.32 + 0.12 * hash(c.id * 5), along = (hash(c.id * 9) - 0.5) * 0.4;
    const rr0 = rootMat(_R2, c.x - Math.sin(c.ang) * off * sg + Math.cos(c.ang) * along, y, c.z + Math.cos(c.ang) * off * sg + Math.sin(c.ang) * along, c.ang - sg * (Math.PI / 2) + (hash(c.id * 3) - 0.5) * 0.6);
    humanCorpse(rr0, c, k, 1);
    return;
  }
  if (c.type === 'cannon') {
    const root = rootMat(_R0, c.x, y, c.z, c.ang, 0, 0.2 * k);
    if (UR.ph) { put('pcFrame', root); putL('pcBarrel', root, mset(_A, 0.1, -0.12, 0.05, 0.15, 0.1, -0.12)); for (let i = 0; i < UR.ph.wheels.length; i++) { const w = UR.ph.wheels[i]; if (i === 1) putL('pcWheel', root, mset(_A, w.x - 0.4, 0.06, w.z * 2.2, Math.PI / 2, 0, 0)); else putL('pcWheel', root, mset(_A, w.x, w.y, w.z, 0, 0, 0)); } return; }
    put('carriage', root);
    putL('barrel', root, mset(_A, 0, 0.7, 0, 0.25, 0, -0.18));
    putL('wheel', root, mset(_A, 0, 0.62, -0.44, 0, 0, 0.4));
    putL('wheel', root, mset(_A, -0.3, 0.06, 0.95, Math.PI / 2, 0, 0.3));
    return;
  }
  humanCorpse(rootMat(_R0, c.x, y, c.z, c.ang), c, k, c.fall);
}
function humanCorpse(root, c, k, sg) {
  const fall = k * k, a = fall * Math.PI / 2 * (sg > 0 ? 1 : -1);
  const lk = lookFor(c.type === 'lighthorse' || c.type === 'dragoon' || c.type === 'cuirassier' ? c.type : c.type, c.team, (hash(c.id * 7) * 4) | 0);
  // felt hats, straw hats and kalpaks come off in the fall and land in the grass by the head; helmets stay on
  const hatN = lk.hat, hatC = lk.hatCol || lk.coat, loose = (hatN === 'hFelt' || hatN === 'hStraw' || hatN === 'hKalpak') && k > 0.25;
  if (loose) lk.hat = null;
  // weapon dropped beside the body
  const wpn = c.type === 'pikeman' ? 'pike' : c.type === 'musketeer' || c.type === 'dragoon' ? 'musket' : c.type === 'lighthorse' ? 'sabre' : c.type === 'cuirassier' ? 'sword' : null;
  if (wpn) { place(ITM[3], 0.2, 0.03, 0.42 * sg, -0.3, 0.0, 1, 0, 1, 0); putL(wpn, root, ITM[3]); }
  const R = _R2 === root ? _R1 : _R2;
  R.multiplyMatrices(root, _A.makeTranslation(0, 0.14 * fall, 0).multiply(_B.makeRotationZ(a)));
  const o = newPose();
  o.hy = lerp(0.925, 0.86, k); o.lean = -0.1 * k;
  const bent = hash(c.id) < 0.5;
  o.fR = bent ? L3v([0.03, 0.085, 0.12], [0.35, 0.3, 0.14], k) : [0.03, 0.085, 0.14]; o.fL = [-0.02, 0.085, -0.16];
  o.cR = L3v([0.2, 0.0, 0.3], sg > 0 ? [0.0, 0.3, 0.62] : [0.35, 0.6, 0.3], k); o.cL = L3v([0.2, 0.0, -0.3], sg > 0 ? [0.15, 0.1, -0.6] : [0.3, 0.55, -0.32], k);
  o.look = 0.6 * k * (hash(c.id * 3) - 0.5); o.nod = -0.2 * k;
  rigBegin(o);
  rigEnd(R, lk, o);
  if (loose && hash(c.id * 17) < 0.8) {
    const sd = sg > 0 ? 1 : -1;
    putL(hatN, root, mset(_A, -sd * (1.5 + hash(c.id * 23) * 0.4), 0.03 - 0.2 * HS, (hash(c.id * 19) - 0.5) * 0.8, (hash(c.id * 29) - 0.5) * 0.35, hash(c.id * 31) * TAU, (hash(c.id * 37) - 0.5) * 0.35), hatC);
  }
}
