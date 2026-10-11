// ================= renderer core =================
let renderer, scene, camera, sun, hemi, composer = null, bloomPass = null, gradePass = null, skyMesh = null;
let VW = 1, VH = 1, DPR = 1;
const QUAL = { level: 2, names: ['Low', 'Medium', 'High', 'Ultra'] };
const CAM = { tx: 20, tz: 108, dist: 34, yaw: -Math.PI / 4, minD: 9, maxD: 78, pitch: 0.9, tyaw: -Math.PI / 4, tdist: 34 };
const FOGTEX = (() => { const t = new THREE.DataTexture(new Uint8Array(N * N * 4), N, N, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
const WEAR_RES = N * 4;
const WEARTEX = (() => { const t = new THREE.DataTexture(new Uint8Array(WEAR_RES * WEAR_RES * 4), WEAR_RES, WEAR_RES, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t; })();
const U = { time: { value: 0 }, fog: { value: FOGTEX }, cloud: { value: null }, fogOn: { value: 1 }, wear: { value: WEARTEX } };
const SKY = { zenith: new THREE.Color('#5d86b8'), horizon: new THREE.Color('#d9d2bd'), haze: new THREE.Color('#c9cdc4') };
const _ray = new THREE.Raycaster(), _v2 = new THREE.Vector2(), _v3 = new THREE.Vector3();

// every lit material passes through here: fog of war, cloud shadows, world position
function patchMat(mat, opt = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    sh.uniforms.uFog = U.fog; sh.uniforms.uTime = U.time; sh.uniforms.uCloud = U.cloud; sh.uniforms.uFogOn = U.fogOn; sh.uniforms.uWear = U.wear;
    sh.vertexShader = 'varying vec3 vWP;\nuniform float uTime;\nuniform sampler2D uWear;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      ${opt.wear ? `{ vec4 ip2 = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          ip2 = instanceMatrix * ip2;
        #endif
        float wr = texture2D(uWear, ip2.xz / ${N.toFixed(1)}).r; transformed *= 1.0 - smoothstep(0.2, 0.7, wr); }` : ''}
      ${opt.wind ? `{ vec4 ip = vec4(0.0,0.0,0.0,1.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix * ip;
        #endif
        float hh = max(0.0, position.y - ${opt.windBase || '0.3'});
        float w = sin(uTime * ${opt.windSpeed || '1.4'} + ip.x * 0.37 + ip.z * 0.29) * ${opt.wind} * hh * hh + sin(uTime * 3.1 + ip.x * 1.7) * ${opt.wind} * ${opt.windLin || '0.25'} * hh;
        transformed.x += w; transformed.z += w * 0.55; }` : ''}
      #include <project_vertex>
      vec4 wpp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wpp = instanceMatrix * wpp;
      #endif
      vWP = (modelMatrix * wpp).xyz;`);
    sh.fragmentShader = 'uniform sampler2D uFog; uniform sampler2D uCloud; uniform float uTime; uniform float uFogOn; varying vec3 vWP;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      float fv = mix(1.0, texture2D(uFog, vec2(vWP.x / ${N.toFixed(1)}, vWP.z / ${N.toFixed(1)})).r, uFogOn);
      float cl = texture2D(uCloud, vWP.xz * 0.011 + vec2(uTime * 0.006, uTime * 0.0025)).r;
      gl_FragColor.rgb *= fv * (1.0 - smoothstep(0.45, 0.85, cl) * 0.28);`);
    if (prev) prev(sh, r);
  };
  mat.customProgramCacheKey = () => 'p' + (opt.wind || '') + (opt.key || '') + (opt.wear ? 'w' : '') + (prev ? 'x' : '');
  return mat;
}
function lin(m) { if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; }
const MATS = {};
function M(key, opts, popt) {
  if (MATS[key]) return MATS[key];
  const o = Object.assign({ roughness: 0.85, metalness: 0.02 }, opts);
  const m = lin(new THREE.MeshStandardMaterial(o));
  if (o.flatShading) m.flatShading = true;
  patchMat(m, popt);
  return MATS[key] = m;
}
function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.encoding = THREE.sRGBEncoding;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
  return t;
}
function cloudTexture() {
  // tiling value-noise clouds
  const S = 256, R = mulberry32(17), g = new Float32Array(32 * 32);
  for (let i = 0; i < g.length; i++) g[i] = R();
  const n = (x, y, p) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const at = (a, b) => g[((a % p + p) % p) + ((b % p + p) % p) * 32]; return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v); };
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0, a = 0.55, f = 4;
    for (let o = 0; o < 4; o++) { v += n(x / S * f, y / S * f, f) * a; a *= 0.5; f *= 2; }
    const k = (y * S + x) * 4; data[k] = data[k + 1] = data[k + 2] = clamp(v * 255, 0, 255); data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

// ================= setup =================
function init3D() {
  const cv = document.getElementById('game');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY.haze.clone(), 60, 180);
  camera = new THREE.PerspectiveCamera(38, 1, 0.5, 900);
  hemi = new THREE.HemisphereLight(new THREE.Color('#bcd2ee').convertSRGBToLinear(), new THREE.Color('#5d5a3a').convertSRGBToLinear(), 0.42);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(new THREE.Color('#ffe2b8').convertSRGBToLinear(), 2.3);
  sun.castShadow = true;
  sun.shadow.bias = -0.00035; sun.shadow.normalBias = 0.035;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(new THREE.Color('#9fb7dc').convertSRGBToLinear(), 0.25); fill.position.set(-40, 30, -60); scene.add(fill);
  U.cloud.value = cloudTexture();
  // sky dome
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { zen: { value: SKY.zenith.clone().convertSRGBToLinear() }, hor: { value: SKY.horizon.clone().convertSRGBToLinear() }, sunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: '#include <common>\nuniform vec3 zen; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vD; void main(){ float h = clamp(vD.y, 0.0, 1.0); vec3 c = mix(hor, zen, pow(h, 0.55)); float s = max(dot(normalize(vD), sunDir), 0.0); c += vec3(1.0,0.85,0.6) * (pow(s, 400.0) * 3.0 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0);\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n}',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), skyMat);
  skyMesh.renderOrder = -10; skyMesh.frustumCulled = false;
  scene.add(skyMesh);
  // image-based light from the same sky
  const eq = canvasTex(256, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5f88bb'); g.addColorStop(0.45, '#d6d6c8'); g.addColorStop(0.5, '#b7ab86'); g.addColorStop(0.6, '#62653f'); g.addColorStop(1, '#2d2a1d'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,240,210,1)'; c.beginPath(); c.arc(w * 0.62, h * 0.2, 7, 0, 7); c.fill(); });
  eq.mapping = THREE.EquirectangularReflectionMapping;
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(eq).texture; pm.dispose(); } catch (_) { }
  applyQuality();
}
function applyQuality() {
  const q = QUAL.level;
  renderer.shadowMap.enabled = q > 0;
  const sz = [512, 2048, 4096, 4096][q];
  sun.shadow.mapSize.set(sz, sz);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  scene.traverse(o => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.needsUpdate = true); } });
  setupPost();
  resize();
}
function setupPost() {
  composer = null; bloomPass = null; gradePass = null;
  if (QUAL.level < 2 || !THREE.EffectComposer || !THREE.UnrealBloomPass || !THREE.ShaderPass) return;
  const isGL2 = renderer.capabilities.isWebGL2;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const RT = isGL2 && THREE.WebGLMultisampleRenderTarget ? THREE.WebGLMultisampleRenderTarget : THREE.WebGLRenderTarget;
  const rt = new RT(size.x, size.y, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat });
  if (rt.samples !== undefined) rt.samples = 4;
  rt.texture.encoding = THREE.sRGBEncoding;
  composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.82);
  composer.addPass(bloomPass);
  gradePass = new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(size.x, size.y) }, uVig: { value: 0.32 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uVig; varying vec2 vUv;
      void main(){
        vec2 px = 1.0 / uRes;
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        // light unsharp mask restores detail lost to MSAA resolve and bloom
        vec3 b = (texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb + texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb) * 0.25;
        c += (c - b) * 0.35;
        // warm, slightly faded period grade
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 0.92);
        c = c * vec3(1.03, 1.0, 0.95) + vec3(0.012, 0.008, 0.0);
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
        vec2 d = vUv - 0.5; float v = 1.0 - dot(d, d) * uVig * 2.2;
        gl_FragColor = vec4(c * v, 1.0);
      }`,
  });
  composer.addPass(gradePass);
}
function resize() {
  const cv = renderer.domElement;
  VW = cv.clientWidth || innerWidth; VH = cv.clientHeight || innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, QUAL.level >= 3 ? 2 : QUAL.level === 2 ? 1.5 : 1);
  renderer.setPixelRatio(DPR);
  renderer.setSize(VW, VH, false);
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
  if (composer) {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    composer.setSize(VW, VH); composer.setPixelRatio && composer.setPixelRatio(DPR);
    if (gradePass) gradePass.uniforms.uRes.value.set(s.x, s.y);
  }
  if (typeof resizeOverlay === 'function') resizeOverlay();
}
function updateCamera(dt) {
  CAM.dist = lerp(CAM.dist, CAM.tdist, Math.min(1, dt * 10));
  CAM.yaw = lerp(CAM.yaw, CAM.tyaw, Math.min(1, dt * 10));
  const z = (CAM.dist - CAM.minD) / (CAM.maxD - CAM.minD);
  CAM.pitch = lerp(0.6, 1.08, Math.pow(clamp(z, 0, 1), 0.7));
  const ty = heightAt(CAM.tx, CAM.tz);
  const d = CAM.dist, p = CAM.pitch;
  camera.position.set(CAM.tx + Math.sin(CAM.yaw) * Math.cos(p) * d, ty + Math.sin(p) * d, CAM.tz + Math.cos(CAM.yaw) * Math.cos(p) * d);
  camera.lookAt(CAM.tx, ty, CAM.tz);
  camera.updateMatrixWorld();
  skyMesh.position.copy(camera.position);
  // sun and its shadow box follow the view
  const span = clamp(CAM.dist * 0.95, 14, 60);
  const sd = new THREE.Vector3(0.55, 0.62, 0.38).normalize();
  sun.position.set(CAM.tx + sd.x * 90, ty + sd.y * 90, CAM.tz + sd.z * 90);
  sun.target.position.set(CAM.tx - Math.sin(CAM.yaw) * span * 0.25, ty, CAM.tz - Math.cos(CAM.yaw) * span * 0.25);
  sun.target.updateMatrixWorld();
  const sc = sun.shadow.camera; sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 20; sc.far = 220; sc.updateProjectionMatrix();
  skyMesh.material.uniforms.sunDir.value.copy(sd);
  scene.fog.near = CAM.dist * 1.6 + 10; scene.fog.far = CAM.dist * 4.5 + 60;
}
function clampCam() { CAM.tx = clamp(CAM.tx, 2, N - 2); CAM.tz = clamp(CAM.tz, 2, N - 2); CAM.tdist = clamp(CAM.tdist, CAM.minD, CAM.maxD); }
function centerOn(x, z) { CAM.tx = x; CAM.tz = z; clampCam(); }
// screen -> ground: march the ray against the height field
function groundAt(sx, sy) {
  _v2.set(sx / VW * 2 - 1, -(sy / VH) * 2 + 1);
  _ray.setFromCamera(_v2, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  if (d.y >= -0.001) return null;
  let t = (o.y - 1) / -d.y;
  for (let k = 0; k < 6; k++) { const x = o.x + d.x * t, z = o.z + d.z * t; const h = Math.max(heightAt(x, z), -0.05); t = (o.y - h) / -d.y; }
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}
function project(x, y, z) { _v3.set(x, y, z).project(camera); return { x: (_v3.x + 1) / 2 * VW, y: (1 - _v3.y) / 2 * VH, z: _v3.z }; }
function updateFogTex() {
  const d = FOGTEX.image.data, V = G.vis;
  for (let i = 0; i < N * N; i++) { const v = V[i] === 2 ? 255 : V[i] === 1 ? 118 : 16; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  FOGTEX.needsUpdate = true;
}
