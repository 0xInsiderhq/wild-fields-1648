// ================= icons: 3D portraits of the real models, plus drawn emblems =================
function renderIcons() {
  const S = 128;
  const rt = new THREE.WebGLRenderTarget(S, S, { encoding: THREE.sRGBEncoding });
  rt.texture.encoding = THREE.sRGBEncoding;
  const isc = new THREE.Scene();
  isc.add(new THREE.HemisphereLight(new THREE.Color('#dfe8f5').convertSRGBToLinear(), new THREE.Color('#4a3c28').convertSRGBToLinear(), 0.9));
  const dl = new THREE.DirectionalLight(new THREE.Color('#fff0d8').convertSRGBToLinear(), 2.6); dl.position.set(4, 6, 5); isc.add(dl);
  isc.environment = scene.environment;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
  const pix = new Uint8Array(S * S * 4);
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d');
  const fogWas = U.fogOn.value; U.fogOn.value = 0;
  const prevTarget = renderer.getRenderTarget();
  const shot = (obj, dist, lookY, yaw = -0.7, pitch = 0.35) => {
    isc.add(obj);
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * (dist || 1.25);
    cam.position.set(ctr.x + Math.sin(yaw) * Math.cos(pitch) * r, ctr.y + Math.sin(pitch) * r + (lookY || 0), ctr.z + Math.cos(yaw) * Math.cos(pitch) * r);
    cam.lookAt(ctr.x, ctr.y + (lookY || 0) * 0.3, ctr.z);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(isc, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, pix);
    const img = cx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const s = ((S - 1 - y) * S + x) * 4, d = (y * S + x) * 4; img.data[d] = pix[s]; img.data[d + 1] = pix[s + 1]; img.data[d + 2] = pix[s + 2]; img.data[d + 3] = pix[s + 3]; }
    cx.clearRect(0, 0, S, S); cx.putImageData(img, 0, 0);
    isc.remove(obj);
    return cv.toDataURL();
  };
  for (const t of Object.keys(BT)) UI.icons['b_' + t] = shot(makeBuilding(t, 0, {}), t === 'farm' ? 1.0 : 1.2);
  // units: borrow the instanced rig, posed once at the origin
  scene.remove(UR.root);
  for (const t of Object.keys(UT)) {
    for (const k in UR.parts) UR.parts[k].count = 0;
    const fake = { id: 1, type: t, d: UT[t], team: 0, x: 0, z: 0, ang: 0, state: 'idle', cd: 0, fireT: -9, strikeT: -9, anim: 0, carry: 0, job: null, path: [], hp: 1, maxhp: 1, aimT: 0 };
    if (t === 'musketeer') { fake.state = 'attack'; fake.target = { hp: 1, kind: 'u', x: 3, z: 0, d: { r: 0.2 } }; fake.aimT = 0.2; }
    if (t === 'pikeman') { fake.state = 'attack'; fake.target = { hp: 1, kind: 'u', x: 1, z: 0, d: { r: 0.2 } }; }
    if (t === 'peasant') { fake.state = 'gather'; fake.sub = 'work'; fake.job = { kind: 'tree' }; fake.anim = 0.3; }
    drawUnit(fake, 0, 0, { mv: 0, ph: 0, skin: 0, horse: 0, ang: 0 }, 0);
    for (const k in UR.parts) { UR.parts[k].instanceMatrix.needsUpdate = true; if (UR.parts[k].instanceColor) UR.parts[k].instanceColor.needsUpdate = true; }
    UR.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const k in UR.parts) { const m = UR.parts[k]; if (m.count) { const b = new THREE.Box3(); const mm = new THREE.Matrix4(); for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mm); b.copy(m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox)).applyMatrix4(mm); box.union(b); } } }
    const holder = new THREE.Group(); holder.add(UR.root);
    const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const tall = t === 'pikeman' ? 0.75 : 1;
    const r = Math.max(size.x * 0.8, size.y * tall, size.z) * 1.45;
    isc.add(holder);
    cam.position.set(ctr.x + Math.sin(-0.9) * r * 0.95 + 0.0, ctr.y + r * 0.32, ctr.z + Math.cos(-0.9) * r * 0.95);
    cam.lookAt(ctr.x, ctr.y - (t === 'pikeman' ? size.y * 0.15 : 0), ctr.z);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(isc, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, S, S, pix);
    const img = cx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const s = ((S - 1 - y) * S + x) * 4, d = (y * S + x) * 4; img.data[d] = pix[s]; img.data[d + 1] = pix[s + 1]; img.data[d + 2] = pix[s + 2]; img.data[d + 3] = pix[s + 3]; }
    cx.clearRect(0, 0, S, S); cx.putImageData(img, 0, 0);
    UI.icons['u_' + t] = cv.toDataURL();
    isc.remove(holder); holder.remove(UR.root);
  }
  for (const k in UR.parts) UR.parts[k].count = 0;
  scene.add(UR.root);
  // deposits
  const savedWorld = WORLD;
  for (const type of ['gold', 'stone', 'berry']) {
    WORLD = { root: new THREE.Group(), deps: new Map() };
    depositMesh({ id: 900 + type.length, type, x: 0, z: 0, tx: 0, tz: 0, w: 2, h: 2, amt: 1, max: 1 });
    const g = WORLD.deps.values().next().value; g.position.set(0, 0, 0);
    UI.icons['d_' + type] = shot(g, 1.3);
  }
  WORLD = savedWorld;
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(0x000000, 1);
  U.fogOn.value = fogWas;
  rt.dispose();
  drawnIcons();
}
// emblems for research and orders: a brass roundel with an engraved symbol
function emblem(draw, hue = '#c19a52') {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S * 0.42, S * 0.38, 4, S / 2, S / 2, S * 0.5);
  grd.addColorStop(0, '#5a4430'); grd.addColorStop(1, '#2a1c12');
  g.fillStyle = grd; g.beginPath(); g.arc(S / 2, S / 2, S * 0.46, 0, 7); g.fill();
  g.strokeStyle = hue; g.lineWidth = 4; g.stroke();
  g.save(); g.translate(S / 2, S / 2); g.strokeStyle = '#f0dfb4'; g.fillStyle = '#f0dfb4'; g.lineWidth = 6; g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g, S);
  g.restore();
  return c.toDataURL();
}
function drawnIcons() {
  const L = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const I = UI.icons;
  I.t_tools = emblem(g => { L(g, [[-30, 30], [20, -20]]); g.fillRect(10, -34, 26, 14); L(g, [[30, 30], [-20, -20]]); L(g, [[-34, -14], [-14, -30], [-6, -22]]); });
  I.t_wheelbarrow = emblem(g => { g.beginPath(); g.arc(-18, 18, 14, 0, 7); g.stroke(); L(g, [[-30, -4], [18, -4], [30, -20]]); L(g, [[-18, 18], [-2, -4]]); L(g, [[18, -4], [30, 24]]); });
  I.t_plough = emblem(g => { L(g, [[-34, 10], [26, 10]]); L(g, [[26, 10], [10, 30], [-8, 30]]); L(g, [[-10, 10], [-24, -28]]); L(g, [[-24, -28], [-12, -32]]); });
  I.t_cartridge = emblem(g => { for (let k = -1; k <= 1; k++) { g.strokeRect(k * 18 - 6, -26, 12, 46); L(g, [[k * 18 - 6, -18], [k * 18 + 6, -18]]); } });
  I.t_steelpikes = emblem(g => { L(g, [[0, 38], [0, -10]]); g.beginPath(); g.moveTo(0, -38); g.lineTo(10, -8); g.lineTo(-10, -8); g.closePath(); g.fill(); L(g, [[-14, -6], [14, -6]]); });
  I.t_cuirass = emblem(g => { g.beginPath(); g.moveTo(-26, -24); g.quadraticCurveTo(0, -12, 26, -24); g.lineTo(22, 16); g.quadraticCurveTo(0, 34, -22, 16); g.closePath(); g.stroke(); L(g, [[0, -14], [0, 24]]); });
  I.t_barding = emblem(g => { g.beginPath(); g.arc(0, -2, 24, Math.PI * 0.85, Math.PI * 2.15); g.stroke(); for (let k = 0; k < 5; k++) { const a = Math.PI * 0.95 + k * Math.PI * 0.27; g.fillRect(Math.cos(a) * 24 - 3, Math.sin(a) * 24 - 5, 6, 6); } });
  I.t_ballistics = emblem(g => { g.setLineDash([6, 7]); g.beginPath(); g.moveTo(-34, 26); g.quadraticCurveTo(0, -46, 34, 26); g.stroke(); g.setLineDash([]); g.beginPath(); g.arc(34, 22, 7, 0, 7); g.fill(); });
  I.t_heavyshot = emblem(g => { for (const [x, y] of [[-14, 14], [14, 14], [0, -10]]) { g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); } });
  I.t_faith = emblem(g => { L(g, [[0, -36], [0, 36]]); L(g, [[-18, -18], [18, -18]]); L(g, [[-12, 14], [12, 6]]); });
  I.c_stop = emblem(g => { g.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; g.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); } g.closePath(); g.stroke(); L(g, [[-12, 0], [12, 0]]); });
  I.c_hold = emblem(g => { g.beginPath(); g.moveTo(-24, -26); g.lineTo(24, -26); g.lineTo(20, 14); g.quadraticCurveTo(0, 34, -20, 14); g.closePath(); g.stroke(); L(g, [[0, -18], [0, 18]]); L(g, [[-12, -4], [12, -4]]); });
  I.c_amove = emblem(g => { L(g, [[-30, 30], [24, -24]]); L(g, [[10, -26], [26, -26], [26, -10]]); L(g, [[30, 30], [-24, -24]]); L(g, [[-26, -10], [-26, -26], [-10, -26]]); }, '#d0603e');
  I.c_cancel = emblem(g => { L(g, [[-22, -22], [22, 22]]); L(g, [[22, -22], [-22, 22]]); }, '#d0603e');
  I.c_line = emblem(g => { for (let r = 0; r < 3; r++) for (let k = -3; k <= 3; k++) { g.beginPath(); g.arc(k * 10, -10 + r * 11, 3.5, 0, 7); g.fill(); } });
  I.c_column = emblem(g => { for (let r = 0; r < 6; r++) for (let k = -1; k <= 1; k++) { g.beginPath(); g.arc(k * 11, -28 + r * 11, 3.5, 0, 7); g.fill(); } });
  I.c_square = emblem(g => { for (let r = 0; r < 5; r++) for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(k * 11, -22 + r * 11, 3.5, 0, 7); g.fill(); } });
  I.crest = emblem(g => { L(g, [[-26, 26], [22, -22]]); L(g, [[26, 26], [-22, -22]]); g.beginPath(); g.arc(0, -30, 8, 0, 7); g.fill(); L(g, [[0, -22], [0, 34]]); g.fillStyle = '#b3262b'; g.beginPath(); g.arc(0, -30, 5, 0, 7); g.fill(); }, '#b3262b');
  // resource strip icons
  const res = [
    g => { g.strokeStyle = '#d8b04a'; g.lineWidth = 3; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(22, 40); g.quadraticCurveTo(22 + k * 4, 22, 22 + k * 7, 6); g.stroke(); g.fillStyle = '#e8c45a'; g.beginPath(); g.ellipse(22 + k * 7, 8, 3, 6, k * 0.3, 0, 7); g.fill(); } },
    g => { g.fillStyle = '#7a5434'; g.fillRect(4, 14, 36, 16); g.fillStyle = '#c89a68'; g.beginPath(); g.ellipse(40, 22, 5, 8, 0, 0, 7); g.fill(); g.strokeStyle = '#8a6a48'; g.lineWidth = 1.5; g.beginPath(); g.arc(40, 22, 3, 0, 7); g.stroke(); },
    g => { g.fillStyle = '#a8a49a'; g.beginPath(); g.moveTo(6, 34); g.lineTo(12, 12); g.lineTo(30, 8); g.lineTo(40, 26); g.lineTo(30, 38); g.closePath(); g.fill(); g.fillStyle = '#c8c4b8'; g.beginPath(); g.moveTo(12, 12); g.lineTo(30, 8); g.lineTo(26, 20); g.closePath(); g.fill(); },
    g => { g.fillStyle = '#e8b53a'; g.beginPath(); g.arc(22, 22, 15, 0, 7); g.fill(); g.strokeStyle = '#9a6a1a'; g.lineWidth = 2.5; g.beginPath(); g.arc(22, 22, 10, 0, 7); g.stroke(); },
    g => { g.fillStyle = '#e6d6b0'; g.beginPath(); g.arc(22, 12, 7, 0, 7); g.fill(); g.beginPath(); g.moveTo(10, 40); g.quadraticCurveTo(22, 14, 34, 40); g.closePath(); g.fill(); },
  ];
  ['#r0', '#r1', '#r2', '#r3', '#rp'].forEach((sel, i) => { const c = document.querySelector(sel + ' canvas'); if (c) { const g = c.getContext('2d'); g.clearRect(0, 0, 44, 44); res[i](g); } });
}
