// ================= terrain, water, forests, grass, deposits =================
let WORLD = null;
const TEX_PX = 8;   // macro albedo pixels per tile
function geoColor(geo, col, jitter = 0.08, aoMin = 1, R = Math.random) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
  let y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) { y0 = Math.min(y0, p.getY(i)); y1 = Math.max(y1, p.getY(i)); }
  const base = new THREE.Color(col).convertSRGBToLinear();
  for (let i = 0; i < n; i += 3) {
    const j = 1 + (R() - 0.5) * 2 * jitter;
    for (let k = 0; k < 3; k++) {
      const ao = aoMin < 1 ? lerp(aoMin, 1, (p.getY(i + k) - y0) / Math.max(1e-3, y1 - y0)) : 1;
      c[(i + k) * 3] = base.r * j * ao; c[(i + k) * 3 + 1] = base.g * j * ao; c[(i + k) * 3 + 2] = base.b * j * ao;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
function mergeColored(parts) {
  let total = 0; for (const g of parts) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
function jiggle(geo, amt, R) {
  const p = geo.attributes.position, cache = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let d = cache.get(k); if (!d) { d = [(R() - 0.5) * amt, (R() - 0.5) * amt, (R() - 0.5) * amt]; cache.set(k, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}
const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s))); return g; };

// ---------- detail textures (one RGBA tile: grass, dirt, sand, rock) ----------
function detailAtlas() {
  const S = 256, d = new Uint8Array(S * S * 4), R = mulberry32(5);
  const nz = makeNoise(77);
  const tile = (f, x, y, p) => { // periodic fbm
    let v = 0, a = 0.5;
    for (let o = 0; o < 4; o++) { const q = p * (1 << o); v += a * lerp(lerp(nz(x / S * q, y / S * q), nz(x / S * q - q, y / S * q), x / S), lerp(nz(x / S * q, y / S * q - q), nz(x / S * q - q, y / S * q - q), x / S), y / S); a *= 0.5; }
    return v;
  };
  const grass = new Float32Array(S * S), dirt = new Float32Array(S * S), sand = new Float32Array(S * S), rock = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x;
    grass[i] = 0.5 + (tile(0, x, y, 16) - 0.5) * 0.9;
    dirt[i] = 0.45 + (tile(0, x, y, 8) - 0.5) * 0.8 + (tile(0, x + 31, y + 17, 32) - 0.5) * 0.4;
    sand[i] = 0.55 + Math.sin((y + tile(0, x, y, 4) * 60) / S * Math.PI * 2 * 14) * 0.12 + (tile(0, x, y, 32) - 0.5) * 0.3;
    const r = tile(0, x + 90, y + 40, 8); rock[i] = 0.5 + (r - 0.5) * 1.2 - Math.pow(1 - Math.abs(tile(0, x, y, 6) - 0.5) * 2, 8) * 0.35;
  }
  // grass blades and pebbles
  for (let k = 0; k < 5200; k++) { const x0 = R() * S, y0 = R() * S, len = 3 + R() * 6, a = -Math.PI / 2 + (R() - 0.5) * 0.9, v = R() < 0.5 ? 0.25 : 0.8; for (let t = 0; t < len; t++) { const x = ((x0 + Math.cos(a) * t) | 0) & (S - 1), y = ((y0 + Math.sin(a) * t) | 0) & (S - 1); grass[y * S + x] = lerp(grass[y * S + x], v, 0.6); } }
  for (let k = 0; k < 900; k++) { const cx = R() * S, cy = R() * S, r = 1 + R() * 2.5, v = R() < 0.5 ? 0.2 : 0.85; for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= r * r) { const i = (((cy + y) | 0) & (S - 1)) * S + (((cx + x) | 0) & (S - 1)); dirt[i] = lerp(dirt[i], v, 0.7); } }
  for (let i = 0; i < S * S; i++) { d[i * 4] = clamp(grass[i] * 255, 0, 255); d[i * 4 + 1] = clamp(dirt[i] * 255, 0, 255); d[i * 4 + 2] = clamp(sand[i] * 255, 0, 255); d[i * 4 + 3] = clamp(rock[i] * 255, 0, 255); }
  const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); t.needsUpdate = true;
  return t;
}
// ---------- macro albedo painted from the map ----------
function paintAlbedo() {
  const S = N * TEX_PX, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), R = mulberry32(G.seed + 5), nz = makeNoise(G.seed + 9);
  const img = g.createImageData(S, S), D = img.data;
  const C = {
    lush: [82, 112, 44], mid: [96, 120, 50], clover: [64, 92, 38], dry: [128, 128, 68], straw: [146, 138, 84], dirt: [[122, 98, 66], [108, 88, 60]],
    sand: [[160, 146, 110], [150, 137, 102]], shallow: [[104, 96, 70]], deep: [[58, 66, 54]],
  };
  const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = px / TEX_PX, z = py / TEX_PX, i = softTile(x, z);
    const t = G.terr[i];
    const n1 = nz.fbm(x * 0.09, z * 0.09, 3), n2 = nz(x * 0.6 + 50, z * 0.6), n3 = nz.fbm(x * 0.03 + 20, z * 0.03, 2), n4 = nz.fbm(x * 0.22 + 70, z * 0.22, 3), n5 = nz(x * 2.1 + 9, z * 2.1);
    let col;
    if (t >= 4) { const dpt = -heightAt(x, z); col = mix3(C.shallow[0], C.deep[0], ss((dpt - 0.06) / 0.38)); }   // the pond bed darkens smoothly with depth
    else if (t === 3) col = C.sand[n2 > 0.5 ? 0 : 1];
    else {
      col = mix3(C.lush, C.mid, ss((n1 - 0.35) * 3));
      col = mix3(col, C.clover, ss((0.42 - n4) * 6) * 0.8);
      col = mix3(col, C.dry, ss((n3 - 0.5) * 4) * 0.7);
      col = mix3(col, C.straw, ss((n3 - 0.62) * 5) * ss((n4 - 0.45) * 4) * 0.6);
      col = mix3(col, [col[0] * 0.82, col[1] * 0.86, col[2] * 0.8], ss((n5 - 0.62) * 6) * 0.6);
      if (t === 2) col = mix3(C.dirt[n2 > 0.5 ? 0 : 1], col, ss((n4 - 0.55) * 4) * 0.35);
      if (t === 1) col = [col[0] * 1.05, col[1] * 1.04, col[2] * 0.95];
    }
    const h = heightAt(x, z), j = 0.9 + n2 * 0.2 + (R() - 0.5) * 0.06;
    const k = (py * S + px) * 4;
    // a little height tint: hilltops sun-bleached, hollows richer
    const ht = clamp((h - 0.8) * 0.06, -0.06, 0.08);
    D[k] = clamp(col[0] * j * (1 + ht), 0, 255); D[k + 1] = clamp(col[1] * j * (1 + ht * 0.6), 0, 255); D[k + 2] = clamp(col[2] * j, 0, 255); D[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // soften tile edges
  g.filter = 'blur(5px)'; g.globalAlpha = 0.65; g.drawImage(c, 0, 0); g.filter = 'none'; g.globalAlpha = 1;
  // forest floor, darker under every tree and fading out
  for (let i = 0; i < N * N; i++) if (G.tree[i]) {
    const x = (i % N + 0.5) * TEX_PX, y = (((i / N) | 0) + 0.5) * TEX_PX, r = TEX_PX * 1.3;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(44,46,22,0.55)'); gr.addColorStop(1, 'rgba(44,46,22,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // wet dark rim along the shore
  for (let i = 0; i < N * N; i++) if (G.terr[i] === 3) {
    const tx = i % N, tz = (i / N) | 0; let wet = false;
    for (const [dx, dz] of DIRS) { const ax = tx + dx, az = tz + dz; if (inMap(ax, az) && G.terr[idx(ax, az)] >= 4) wet = true; }
    if (wet) { g.fillStyle = 'rgba(70,62,40,0.28)'; g.fillRect(tx * TEX_PX - 2, tz * TEX_PX - 2, TEX_PX + 4, TEX_PX + 4); }
  }
  // speckles: flowers on meadows, pebbles on dirt
  for (let k = 0; k < 9000; k++) {
    const x = R() * S, y = R() * S, i = idx((x / TEX_PX) | 0, (y / TEX_PX) | 0), t = G.terr[i];
    if (t === 1 && R() < 0.2) { g.fillStyle = ['rgba(233,227,200,0.35)', 'rgba(217,184,74,0.35)', 'rgba(154,90,168,0.3)', 'rgba(201,75,58,0.3)'][(R() * 4) | 0]; g.fillRect(x, y, 0.9, 0.9); }
    else if (t === 2 || t === 3) { g.fillStyle = 'rgba(60,48,34,0.5)'; g.fillRect(x, y, 1.5, 1.5); }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return { tex, canvas: c, ctx: g };
}
// the map's terrain classes sit on a hard tile grid; for the look, the edges between grass, worn earth and forest
// wander by up to a tile so no straight lines or stair steps show. Water keeps its exact tiles.
let _warpNz = null, _warpSeed = null;
function softTile(x, z) {
  if (_warpSeed !== G.seed) { _warpNz = makeNoise(G.seed + 77); _warpSeed = G.seed; }
  const n = _warpNz;
  const wx = (n.fbm(x * 0.3, z * 0.3, 2) - 0.5) * 2.8 + (n(x * 1.4 + 40, z * 1.4) - 0.5) * 0.5;
  const wz = (n.fbm(x * 0.3 + 91, z * 0.3 + 17, 2) - 0.5) * 2.8 + (n(x * 1.4 + 7, z * 1.4 + 60) - 0.5) * 0.5;
  const i0 = clamp(z | 0, 0, N - 1) * N + clamp(x | 0, 0, N - 1);
  const i1 = clamp((z + wz) | 0, 0, N - 1) * N + clamp((x + wx) | 0, 0, N - 1);
  return G.terr[i0] <= 3 && G.terr[i1] <= 3 ? i1 : i0;
}
const CTRL_RES = 4;   // control texels per tile
function controlMap() {
  const C = N * CTRL_RES, a = new Float32Array(C * C * 4);
  for (let pz = 0; pz < C; pz++) for (let px = 0; px < C; px++) {
    const i = softTile((px + 0.5) / CTRL_RES, (pz + 0.5) / CTRL_RES), t = G.terr[i], k = (pz * C + px) * 4;
    let gr = 0, di = 0, sa = 0;
    if (t <= 1) gr = 255; else if (t === 2) di = 255; else if (t === 3) sa = 255; else { sa = 150; di = 105; }
    if (G.tree[i]) { gr = 120; di = 135; }
    a[k] = gr; a[k + 1] = di; a[k + 2] = sa;
  }
  // a small blur so the wandering edges blend over about half a tile
  const b = new Float32Array(a.length), d = new Uint8Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    const src = pass ? b : a, dst = pass ? a : b, sx = pass ? C * 4 : 4;
    for (let pz = 0; pz < C; pz++) for (let px = 0; px < C; px++) {
      const k = (pz * C + px) * 4, lo = (pass ? pz : px) > 0, hi = (pass ? pz : px) < C - 1;
      for (let c = 0; c < 3; c++) dst[k + c] = (src[k + c] * 2 + (lo ? src[k - sx + c] : src[k + c]) + (hi ? src[k + sx + c] : src[k + c])) / 4;
    }
  }
  for (let k = 0; k < a.length; k++) d[k] = a[k];
  const t = new THREE.DataTexture(d, C, C, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
function heightTex() {
  const W1 = N + 1, d = new Uint8Array(W1 * W1 * 4);
  for (let i = 0; i < W1 * W1; i++) { const v = clamp((G.H[i] + 1.2) / 2.4 * 255, 0, 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(d, W1, W1, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

// ---------- photo ground: six scanned layers blended by terrain type, dryness, forest, fields and footpaths ----------
const LAYER_AVG = [[0.0817, 0.0491, 0.0086], [0.4255, 0.3041, 0.2019], [0.0797, 0.0484, 0.027], [0.0986, 0.0514, 0.0217], [0.1525, 0.1087, 0.0639], [0.1909, 0.1628, 0.1321]];
function groundShader(sh) {
  sh.uniforms.uCtrl = { value: WORLD.ctrl }; sh.uniforms.uWear = U.wear;
  sh.uniforms.uGD = { value: ASSETS.ground.diff }; sh.uniforms.uGN = { value: ASSETS.ground.nor };
  sh.vertexShader = 'varying vec3 vWN;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n vWN = normalize(mat3(modelMatrix) * objectNormal);');
  const lum = a => (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11).toFixed(4);
  const v3 = a => `vec3(${a.map(x => x.toFixed(4)).join(',')})`;
  const L = (i, gain, tint, hue) => `
      if (w[${i}] > 0.004) {
        vec3 ca = texture(uGD, vec3(uv1, ${i}.0)).rgb, cb = texture(uGD, vec3(uv2, ${i}.0)).rgb;
        vec3 c = pow(mix(ca, cb, 0.38), vec3(2.2)) * ${gain.toFixed(2)};
        ${hue ? `c *= mix(vec3(1.0), clamp(macro / ${v3(LAYER_AVG[i])}, vec3(0.6), vec3(2.6)), ${tint.toFixed(2)});` : `c *= mix(1.0, clamp(mlum / ${lum(LAYER_AVG[i])}, 0.55, 1.7), ${tint.toFixed(2)});`}
        col += w[${i}] * c;
        nrm += w[${i}] * (texture(uGN, vec3(uv1, ${i}.0)).xyz * 2.0 - 1.0);
      }`;
  sh.fragmentShader = 'uniform sampler2D uCtrl; uniform sampler2D uWear; uniform highp sampler2DArray uGD; uniform highp sampler2DArray uGN; varying vec3 vWN;\nvec3 gN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 texelColor = mapTexelToLinear(texture2D(map, vUv));
      vec3 macro = texelColor.rgb;
      float mlum = dot(macro, vec3(0.3, 0.59, 0.11));
      vec4 ctrl = texture2D(uCtrl, vWP.xz / ${N.toFixed(1)});
      vec4 wm = texture2D(uWear, vWP.xz / ${N.toFixed(1)});
      float slope = clamp(1.0 - vWN.y, 0.0, 1.0);
      float rockW = smoothstep(0.16, 0.34, slope);
      float dry = smoothstep(0.95, 1.3, macro.r / max(macro.g, 0.001));
      float path = smoothstep(0.15, 0.8, wm.r), forest = smoothstep(0.1, 0.7, wm.g), farm = smoothstep(0.3, 0.7, wm.b);
      float w[6];
      float green = ctrl.r * (1.0 - forest * 0.85);
      w[0] = green * (1.0 - dry); w[1] = green * dry * 0.85;
      w[2] = ctrl.g + ctrl.b * 0.7 + path * 1.6;
      w[3] = farm * 3.0;
      w[4] = forest * (ctrl.r + ctrl.g * 0.4);
      w[5] = rockW * 2.0;
      float sum = 0.0; for (int i = 0; i < 6; i++) { if (i != 3) w[i] *= (1.0 - farm); if (i != 2 && i != 3) w[i] *= (1.0 - path * 0.8); sum += w[i]; }
      for (int i = 0; i < 6; i++) w[i] /= max(sum, 0.001);
      vec2 uv1 = vWP.xz * 0.55;
      vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * vWP.xz * 0.19 + 0.37;
      vec3 col = vec3(0.0), nrm = vec3(0.0);
      ${L(0, 1.0, 0.55, true)}${L(1, 0.5, 0.4)}${L(2, 1.05, 0.3)}${L(3, 1.0, 0.2)}${L(4, 0.95, 0.3)}${L(5, 0.85, 0.25)}
      // the beaches keep their painted sand colour under the detail
      col = mix(col, macro * (col / max(dot(col, vec3(0.33)), 0.001)) * 0.33 + macro * 0.67, ctrl.b * 0.75);
      float dist = length(cameraPosition - vWP), far = smoothstep(28.0, 75.0, dist);
      col = mix(col, macro * (0.75 + 0.25 * dot(col, vec3(0.33)) / max(mlum, 0.001)), far * 0.55);
      texelColor.rgb = col;
      nrm.xy *= (1.0 - far * 0.8);
      gN = normalize(vWN * max(nrm.z, 0.3) + vec3(nrm.x, 0.0, -nrm.y) * 0.85);
      diffuseColor *= texelColor;`).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = normalize((viewMatrix * vec4(gN, 0.0)).xyz);');
}
function paintForestMask() {
  // forest floor under trees, soft-edged, into the green channel of the wear map
  const D = WEARTEX.image.data, s = WEAR_RES / N;
  for (let i = 0; i < N * N; i++) if (G.tree[i]) {
    const cx = (i % N + 0.5) * s, cz = (((i / N) | 0) + 0.5) * s, r = s * 1.25;
    for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || z < 0 || x >= WEAR_RES || z >= WEAR_RES) continue;
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / r; if (d >= 1) continue;
      const k = (z * WEAR_RES + x) * 4 + 1; D[k] = Math.max(D[k], 255 * (1 - d * d));
    }
  }
  WEARTEX.needsUpdate = true;
}
// ---------- build the whole static world ----------
function buildWorld() {
  disposeWorld();
  const root = new THREE.Group(); scene.add(root);
  WORLD = { root, falling: [], deps: new Map() };
  const R = mulberry32(G.seed + 31);
  // terrain mesh
  const SEG = N * 2;
  const geo = new THREE.PlaneGeometry(N, N, SEG, SEG);
  geo.rotateX(-Math.PI / 2); geo.translate(N / 2, 0, N / 2);
  const nz = makeNoise(G.seed + 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, heightAt(x, z) + (nz(x * 1.7, z * 1.7) - 0.5) * 0.05); }
  geo.computeVertexNormals();
  WORLD.tgeo = geo;
  const alb = paintAlbedo();
  WORLD.alb = alb;
  WORLD.ctrl = controlMap();
  WORLD.det = detailAtlas();
  const photo = ASSETS.ready && ASSETS.ground && ASSETS.ground.diff && ASSETS.ground.nor;
  paintForestMask();
  const tmat = lin(new THREE.MeshStandardMaterial({ map: alb.tex, roughness: 0.96, metalness: 0 }));
  patchMat(tmat, { key: photo ? 'terrainP' : 'terrain' });
  const prev = tmat.onBeforeCompile;
  if (photo) tmat.onBeforeCompile = (sh, r) => { prev(sh, r); groundShader(sh); };
  else tmat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.uniforms.uCtrl = { value: WORLD.ctrl }; sh.uniforms.uDet = { value: WORLD.det }; sh.uniforms.uWear = U.wear;
    sh.vertexShader = 'varying vec3 vWN;\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'uniform sampler2D uCtrl; uniform sampler2D uDet; uniform sampler2D uWear; varying vec3 vWN;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
      vec4 texelColor = texture2D(map, vUv);
      texelColor = mapTexelToLinear(texelColor);
      vec4 ctrl = texture2D(uCtrl, vWP.xz / ${N.toFixed(1)});
      float slope = clamp(1.0 - vWN.y, 0.0, 1.0);
      float rockW = smoothstep(0.16, 0.34, slope);
      vec2 suv = vec2(0.0045, 0.0031);
      vec4 det = texture2D(uDet, vWP.xz * 0.42);
      vec4 detS = texture2D(uDet, vWP.xz * 0.42 + suv);
      vec4 det2 = texture2D(uDet, vWP.xz * 0.097 + 0.37);
      vec4 det3 = texture2D(uDet, vWP.xz * 1.63 + 0.71);
      vec4 det3S = texture2D(uDet, vWP.xz * 1.63 + 0.71 + suv);
      float wr = texture2D(uWear, vWP.xz / ${N.toFixed(1)}).r;
      vec4 w = vec4(ctrl.r, ctrl.g, ctrl.b, max(ctrl.a, rockW));
      w.g = max(w.g, smoothstep(0.15, 0.8, wr));
      w /= max(dot(w, vec4(1.0)), 0.001);
      float near = 1.0 - smoothstep(14.0, 34.0, length(cameraPosition - vWP));
      float dv = dot(w, det) * 0.6 + dot(w, det2) * 0.28 + mix(0.12 * 0.5, dot(w, det3) * 0.12, near);
      // a little relief: detail read as height and lit from the sun side
      float relief = (dot(w, det) - dot(w, detS)) * 1.4 + (dot(w, det3) - dot(w, det3S)) * 0.9 * near;
      texelColor.rgb = mix(texelColor.rgb, vec3(0.2, 0.15, 0.09) * (0.75 + det.g * 0.6), smoothstep(0.15, 0.85, wr) * 0.85);
      texelColor.rgb *= (0.5 + dv) * (1.0 + clamp(relief, -0.35, 0.35));
      texelColor.rgb = mix(texelColor.rgb, vec3(0.2, 0.19, 0.17) * (0.55 + det.a * 0.9), rockW * 0.7);
      diffuseColor *= texelColor;`);
  };
  const terrain = new THREE.Mesh(geo, tmat);
  terrain.receiveShadow = true;
  root.add(terrain);
  WORLD.terrain = terrain;
  // dark land beyond the map edge
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(N * 6, N * 6), lin(new THREE.MeshBasicMaterial({ color: '#1d1a14' })));
  outer.rotation.x = -Math.PI / 2; outer.position.set(N / 2, -0.4, N / 2);
  root.add(outer);
  buildWater(root);
  buildTrees(root, R);
  buildGrass(root, R);
  buildDecor(root, R);
  for (const d of G.deposits) depositMesh(d);
}
function disposeWorld() {
  if (!WORLD) return;
  scene.remove(WORLD.root);
  WORLD.root.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });
  WORLD = null;
}

// ---------- water ----------
function buildWater(root) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: U.time, uFog: U.fog, uCloud: U.cloud, uFogOn: U.fogOn, uH: { value: heightTex() },
      uSun: { value: new THREE.Vector3(0.55, 0.62, 0.38).normalize() },
      uSky: { value: new THREE.Color('#6d93c4').convertSRGBToLinear() }, uHor: { value: new THREE.Color('#cfd3c6').convertSRGBToLinear() },
      uDeep: { value: new THREE.Color('#1f3a3c').convertSRGBToLinear() }, uShallow: { value: new THREE.Color('#5d7258').convertSRGBToLinear() },
      uFogC: { value: new THREE.Color() }, uFogN: { value: 60 }, uFogF: { value: 180 },
    },
    vertexShader: 'varying vec3 vWP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `#include <common>
      uniform float uTime; uniform sampler2D uH; uniform sampler2D uFog; uniform sampler2D uCloud; uniform float uFogOn;
      uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uHor; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFogC; uniform float uFogN; uniform float uFogF;
      varying vec3 vWP;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y); }
      float wave(vec2 p){ return sin(p.x * 1.9 + uTime * 1.2) * 0.22 + sin(p.y * 2.4 - uTime * 1.4 + p.x * 0.8) * 0.18 + sin((p.x + p.y) * 3.7 + uTime * 2.3) * 0.1 + vn(p * 2.3 + uTime * 0.35) * 0.45 + vn(p * 5.1 - uTime * 0.5) * 0.18; }
      void main(){
        vec2 p = vWP.xz;
        float h = texture2D(uH, (p + 0.5) / ${(N + 1).toFixed(1)}).r * 2.4 - 1.2;
        float depth = max(0.0, -0.04 - h);
        float e = 0.06, w0 = wave(p);
        vec3 nrm = normalize(vec3((w0 - wave(p + vec2(e, 0.0))) * 0.9, 1.0, (w0 - wave(p + vec2(0.0, e))) * 0.9));
        vec3 V = normalize(cameraPosition - vWP);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(nrm, V), 0.0), 5.0);
        vec3 Rf = reflect(-V, nrm);
        vec3 sky = mix(uHor, uSky, clamp(Rf.y * 1.4, 0.0, 1.0));
        vec3 base = mix(uShallow, uDeep, smoothstep(0.02, 0.6, depth));
        vec3 col = mix(base, sky, fres * 0.8);
        col += vec3(1.0, 0.88, 0.66) * pow(max(dot(Rf, uSun), 0.0), 220.0) * 3.0;
        float foam = (1.0 - smoothstep(0.0, 0.07, depth)) * smoothstep(0.35, 0.8, vn(p * 4.0 + vec2(uTime * 0.4, 0.0)));
        col = mix(col, vec3(0.85, 0.86, 0.8), foam * 0.6);
        float a = clamp(smoothstep(0.0, 0.12, depth) * 0.8 + fres * 0.25 + foam * 0.4, 0.0, 0.94);
        float fv = mix(1.0, texture2D(uFog, p / ${N.toFixed(1)}).r, uFogOn);
        float cl = texture2D(uCloud, p * 0.011 + vec2(uTime * 0.006, uTime * 0.0025)).r;
        col *= (1.0 - smoothstep(0.45, 0.85, cl) * 0.25);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
        float fd = length(cameraPosition - vWP);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogC, smoothstep(uFogN, uFogF, fd));
        gl_FragColor.rgb *= fv;
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(N, N, 1, 1), mat);
  water.rotation.x = -Math.PI / 2; water.position.set(N / 2, -0.04, N / 2); water.renderOrder = 2;
  root.add(water);
  WORLD.water = water;
}

// ---------- grass: thin blades in chunked instanced tufts, coloured from the ground they grow on ----------
const GRASS_CH = 16;
function tuftGeo(R, n, hMin, hMax, spread) {
  const pos = [], col = [], nor = [];
  for (let b = 0; b < n; b++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * spread, hh = hMin + R() * (hMax - hMin), w = 0.0035 + R() * 0.003;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, fa = R() * Math.PI * 2, px = -Math.sin(fa) * w, pz = Math.cos(fa) * w;
    const la = a + (R() - 0.5) * 1.2, lean = 0.15 + R() * 0.55;
    const mx = bx + Math.cos(la) * lean * hh * 0.22, mz = bz + Math.sin(la) * lean * hh * 0.22, my = hh * 0.55;
    const tx = bx + Math.cos(la) * lean * hh * 0.7, tz = bz + Math.sin(la) * lean * hh * 0.7, ty = hh * (1 - lean * 0.22);
    // two segments, both windings, normals leaning up so blades light like the ground under them
    const nx = Math.cos(la) * 0.3, nz = Math.sin(la) * 0.3, nl = Math.hypot(nx, 1, nz);
    const quad = [[bx - px, 0, bz - pz], [bx + px, 0, bz + pz], [mx + px * 0.7, my, mz + pz * 0.7], [mx - px * 0.7, my, mz - pz * 0.7]];
    const tip = [tx, ty, tz];
    const tris = [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]], [quad[3], quad[2], tip]];
    const shade = v => v[1] < 1e-6 ? 0.62 : v === tip ? 1.18 : 0.92;
    for (const t of tris) for (const order of [[0, 1, 2], [0, 2, 1]]) for (const k of order) {
      const v = t[k]; pos.push(v[0], v[1], v[2]); const c = shade(v); col.push(c, c * (v === tip ? 1.02 : 1), c * (v === tip ? 0.88 : 1)); nor.push(nx / nl, 1 / nl, nz / nl);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
function flowerGeo(R) {
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const a = R() * Math.PI * 2, r = R() * 0.03, h = 0.06 + R() * 0.05, x = Math.cos(a) * r, z = Math.sin(a) * r;
    const stem = new THREE.CylinderGeometry(0.0018, 0.0022, h, 3).translate(x, h / 2, z);
    const head = new THREE.IcosahedronGeometry(0.009 + R() * 0.004, 0).scale(1, 0.55, 1).translate(x, h, z);
    parts.push(paint(stem, () => [0.06, 0.1, 0.03, 0]), paint(head, () => [1, 1, 1, 1]));
  }
  return merge(parts);
}
function buildGrass(root, R) {
  const dens = [0, 4, 8, 13][QUAL.level];
  WORLD.grassRef = new Int32Array(N * N * 2).fill(-1);
  WORLD.grass = [];
  if (!dens) return;
  const S = N * TEX_PX, img = WORLD.alb.ctx.getImageData(0, 0, S, S).data;
  const lut = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; lut[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  const geos = [tuftGeo(R, 11, 0.035, 0.085, 0.035), tuftGeo(R, 9, 0.05, 0.11, 0.03)];
  const mat = M('grass2', { vertexColors: true, roughness: 0.95, metalness: 0 }, { wind: '3.5', windLin: '0.05', windBase: '0.0', windSpeed: '2.0', key: 'g2', wear: true });
  const fmat = M('flowers', { vertexColors: true, roughness: 0.8, metalness: 0 }, { wind: '3.0', windLin: '0.04', windBase: '0.0', windSpeed: '2.0', key: 'fl', wear: true });
  tintMat(fmat);
  const fgeo = flowerGeo(R);
  const FLOW = ['#ece7d2', '#e2c13a', '#9a6ab8', '#c8463a', '#f0f0f0'].map(c => new THREE.Color(c).convertSRGBToLinear());
  const o = new THREE.Object3D(), col = new THREE.Color();
  const nC = N / GRASS_CH;
  for (let cz = 0; cz < nC; cz++) for (let cx = 0; cx < nC; cx++) {
    const lists = [[], []], flist = [];
    for (let tz = cz * GRASS_CH; tz < (cz + 1) * GRASS_CH; tz++) for (let tx = cx * GRASS_CH; tx < (cx + 1) * GRASS_CH; tx++) {
      const i = tz * N + tx, t = G.terr[i];
      if (t > 2 || G.dep[i] || G.bocc[i]) continue;
      const cnt = G.tree[i] ? 1 : t === 2 ? 1 : dens + (t === 1 ? 2 : 0), v = t === 1 ? 1 : 0;
      const start = lists[v].length;
      for (let k = 0; k < cnt; k++) {
        const x = tx + R(), z = tz + R(), pi = (Math.min(S - 1, (z * TEX_PX) | 0) * S + Math.min(S - 1, (x * TEX_PX) | 0)) * 4;
        const j = 0.82 + R() * 0.36;
        col.setRGB(lut[img[pi]] * j * 1.04, lut[img[pi + 1]] * j * 1.08, lut[img[pi + 2]] * j * 0.9);
        lists[v].push([x, heightAt(x, z) - 0.01, z, R() * 6.28, 0.75 + R() * 0.6, col.r, col.g, col.b]);
      }
      WORLD.grassRef[i * 2] = (cz * nC + cx) * 4 + v; WORLD.grassRef[i * 2 + 1] = start * 64 + cnt;
      if (t === 1 && R() < 0.35 * dens / 6) { const x = tx + R(), z = tz + R(); flist.push([x, heightAt(x, z) - 0.01, z, R() * 6.28, 0.8 + R() * 0.5, FLOW[(R() * FLOW.length) | 0]]); }
    }
    const ctr = new THREE.Vector3((cx + 0.5) * GRASS_CH, 0.3, (cz + 0.5) * GRASS_CH), rad = GRASS_CH * 0.75;
    const ch = { ctr, meshes: [] };
    lists.forEach((list, v) => {
      if (!list.length) { ch.meshes.push(null); return; }
      const g = geos[v].clone(); g.boundingSphere = new THREE.Sphere(ctr, rad);
      const m = new THREE.InstancedMesh(g, mat, list.length);
      list.forEach((p, k) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3], 0); o.scale.set(p[4], p[4] * (0.85 + (k % 7) * 0.05), p[4]); o.updateMatrix(); m.setMatrixAt(k, o.matrix); col.setRGB(p[5], p[6], p[7]); m.setColorAt(k, col); });
      m.castShadow = false; m.receiveShadow = true;
      root.add(m); ch.meshes.push(m);
    });
    if (flist.length) {
      const g = fgeo.clone(); g.boundingSphere = new THREE.Sphere(ctr, rad);
      const m = new THREE.InstancedMesh(g, fmat, flist.length);
      flist.forEach((p, k) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3], 0); o.scale.setScalar(p[4]); o.updateMatrix(); m.setMatrixAt(k, o.matrix); m.setColorAt(k, p[5]); });
      m.castShadow = false; m.receiveShadow = true; root.add(m); ch.flowers = m;
    }
    WORLD.grass.push(ch);
  }
}
// hide grass that is far from the camera: it is sub-pixel there and only costs vertices
function updateGrass() {
  if (!WORLD || !WORLD.grass) return;
  const far = CAM.dist > 56, R2 = Math.pow(CAM.dist * 1.25 + 14, 2);
  for (const ch of WORLD.grass) {
    const vis = !far && (ch.ctr.x - CAM.tx) ** 2 + (ch.ctr.z - CAM.tz) ** 2 < R2;
    for (const m of ch.meshes) if (m) m.visible = vis;
    if (ch.flowers) ch.flowers.visible = vis;
  }
}
function clearGrass(tx, tz, w, h) {
  if (!WORLD || !WORLD.grass || !WORLD.grass.length) return;
  const z0 = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let z = tz; z < tz + h; z++) for (let x = tx; x < tx + w; x++) {
    if (!inMap(x, z)) continue;
    const i = idx(x, z), ref = WORLD.grassRef[i * 2]; if (ref < 0) continue;
    const ch = WORLD.grass[(ref / 4) | 0], m = ch && ch.meshes[ref % 4], start = (WORLD.grassRef[i * 2 + 1] / 64) | 0, n = WORLD.grassRef[i * 2 + 1] % 64;
    if (m) { for (let k = 0; k < n; k++) m.setMatrixAt(start + k, z0); m.instanceMatrix.needsUpdate = true; }
    WORLD.grassRef[i * 2] = -1;
  }
}

function updateDeposits() {
  if (!WORLD) return;
  for (const d of G.deposits) {
    const g = WORLD.deps.get(d.id); if (!g) continue;
    if (d.amt <= 0) { if (g.visible) { g.visible = false; } continue; }
    const k = 0.45 + 0.55 * clamp(d.amt / d.max, 0, 1);
    if (Math.abs(g.scale.x - k) > 0.02) g.scale.set(k, 0.4 + 0.6 * k, k);
  }
}
// a new building clears the bushes, rocks, ferns, logs and stumps standing on its plot
function clearDecor(tx, tz, w, h) {
  if (!WORLD) return;
  const list = (WORLD.decor || []).concat(WORLD.stumps ? [WORLD.stumps] : []);
  for (const m of list) {
    const a = m.instanceMatrix.array, gs = m.geometry.boundingSphere || (m.geometry.computeBoundingSphere(), m.geometry.boundingSphere), br = gs ? gs.radius : 0.5;
    let hit = false;
    for (let k = 0; k < m.count; k++) {
      const o = k * 16, sc = Math.hypot(a[o], a[o + 1], a[o + 2]); if (sc === 0) continue;
      const x = a[o + 12], z = a[o + 14], mg = Math.min(0.7, br * sc * 0.65) + 0.05;
      if (x > tx - mg && x < tx + w + mg && z > tz - mg && z < tz + h + mg) { for (let j = 0; j < 12; j++) a[o + j] = 0; hit = true; }
    }
    if (hit) m.instanceMatrix.needsUpdate = true;
  }
}
// refresh terrain heights after a building flattens the ground
function terrainFlatten(b) {
  if (!WORLD) return;
  const p = WORLD.tgeo.attributes.position, S = N * 2 + 1;
  for (let z = b.tz * 2 - 1; z <= (b.tz + b.h) * 2 + 1; z++) for (let x = b.tx * 2 - 1; x <= (b.tx + b.w) * 2 + 1; x++) {
    if (x < 0 || z < 0 || x >= S || z >= S) continue;
    const i = z * S + x, wx = x / 2, wz = z / 2;
    p.setY(i, heightAt(wx, wz) + (x >= b.tx * 2 && x <= (b.tx + b.w) * 2 && z >= b.tz * 2 && z <= (b.tz + b.h) * 2 ? -0.01 : 0));
  }
  p.needsUpdate = true;
  WORLD.tgeo.computeVertexNormals();
  clearGrass(b.tx, b.tz, b.w, b.h);
  clearDecor(b.tx, b.tz, b.w, b.h);
  // trampled earth under the footprint
  const g = WORLD.alb.ctx, s = TEX_PX;
  if (b.type === 'farm') {
    g.fillStyle = 'rgba(92,70,44,0.95)'; g.fillRect(b.tx * s + 2, b.tz * s + 2, b.w * s - 4, b.h * s - 4);
    g.strokeStyle = 'rgba(60,44,28,0.6)'; g.lineWidth = 1.2;
    for (let k = 0; k < b.w * s; k += 3) { g.beginPath(); g.moveTo(b.tx * s + k + 2, b.tz * s + 3); g.lineTo(b.tx * s + k + 2, (b.tz + b.h) * s - 3); g.stroke(); }
  } else {
    const gr = g.createRadialGradient(b.x * s, b.z * s, 0, b.x * s, b.z * s, Math.max(b.w, b.h) * s * 0.85);
    gr.addColorStop(0, 'rgba(118,96,66,0.95)'); gr.addColorStop(0.7, 'rgba(118,96,66,0.6)'); gr.addColorStop(1, 'rgba(118,96,66,0)');
    g.fillStyle = gr; g.fillRect((b.tx - 1) * s, (b.tz - 1) * s, (b.w + 2) * s, (b.h + 2) * s);
  }
  if (b.type === 'farm') { const D = WEARTEX.image.data, ws = WEAR_RES / N; for (let z = Math.floor(b.tz * ws) + 1; z < (b.tz + b.h) * ws - 1; z++) for (let x = Math.floor(b.tx * ws) + 1; x < (b.tx + b.w) * ws - 1; x++) D[(z * WEAR_RES + x) * 4 + 2] = 255; WEARTEX.needsUpdate = true; }
  if (b.type !== 'farm') { g.save(); g.filter = 'blur(3px)'; g.fillStyle = 'rgba(28,22,14,0.5)'; g.fillRect((b.tx + 0.15) * s, (b.tz + 0.15) * s, (b.w - 0.3) * s, (b.h - 0.3) * s); g.restore(); }
  else { g.save(); g.filter = 'blur(2px)'; g.strokeStyle = 'rgba(40,32,20,0.45)'; g.lineWidth = 2.5; g.strokeRect(b.tx * s + 1, b.tz * s + 1, b.w * s - 2, b.h * s - 2); g.restore(); }
  WORLD.alb.tex.needsUpdate = true;
  const D = WORLD.ctrl.image.data, C = N * CTRL_RES;
  for (let z = b.tz * CTRL_RES; z < (b.tz + b.h) * CTRL_RES; z++) for (let x = b.tx * CTRL_RES; x < (b.tx + b.w) * CTRL_RES; x++) { const i = (z * C + x) * 4; D[i] = 40; D[i + 1] = 215; D[i + 2] = 0; }
  WORLD.ctrl.needsUpdate = true;
}

// ---------- footpaths: ground wears where people and horses keep walking ----------
const WEAR = { t: 0, up: 0, dirty: false };
function resetWear() { WEARTEX.image.data.fill(0); WEARTEX.needsUpdate = true; WEAR.dirty = false; }
function updateWear(dt) {
  if (!G.units || G.paused) return;
  WEAR.t += dt; WEAR.up += dt;
  if (WEAR.t >= 0.25) {
    WEAR.t = 0;
    const D = WEARTEX.image.data, s = WEAR_RES / N;
    for (const u of G.units) {
      if (u.wx === undefined) { u.wx = u.x; u.wz = u.z; continue; }
      const d = Math.hypot(u.x - u.wx, u.z - u.wz);
      if (d < 0.08) continue;
      u.wx = u.x; u.wz = u.z;
      const amt = (u.d.cls === 'cav' ? 7 : u.d.cls === 'art' ? 9 : 4) * Math.min(1, d * 2);
      const cx = u.x * s, cz = u.z * s;
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        const px = Math.floor(cx + ox), pz = Math.floor(cz + oz); if (px < 0 || pz < 0 || px >= WEAR_RES || pz >= WEAR_RES) continue;
        const k = (pz * WEAR_RES + px) * 4, f = ox === 0 && oz === 0 ? 1 : 0.35;
        D[k] = Math.min(255, D[k] + amt * f);
      }
      WEAR.dirty = true;
    }
  }
  if (WEAR.dirty && WEAR.up > 1.5) { WEAR.up = 0; WEAR.dirty = false; WEARTEX.needsUpdate = true; }
}
