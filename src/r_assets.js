// ================= photo-scanned assets (Poly Haven, CC0): rocks, plants, props, a cannon, PBR textures =================
// Everything here is optional: if a file fails to load the game keeps its procedural look.
const ASSETS = { ready: false, geo: {}, mat: {}, size: {}, tex: {}, ground: null };
const ASSET_FILES = ['boulder_01', 'namaqualand_boulder_02', 'rock_moss_set_01', 'rock_moss_set_02', 'rock_07', 'stone_01', 'tree_stump_01', 'tree_stump_02', 'dead_tree_trunk',
  'shrub_02', 'fern_02', 'cannon_01', 'wooden_barrels_01', 'wine_barrel_01', 'wooden_crate_01', 'wooden_crate_02', 'wooden_bucket_01', 'wicker_basket_01', 'spinning_wheel_01', 'wooden_ladder'];
const ASSET_TEX = ['thatch', 'plaster', 'planks', 'stone', 'bark'];
const GROUND_LAYERS = 6; // sparse grass, withered grass, stony dirt, farm soil, forest floor, gravel
const FOLIAGE = /shrub|fern/;
const assetURL = f => (window.WF_EMBED && window.WF_EMBED[f]) || 'assets/' + f;   // the offline build carries every file inline
function loadAssets(onProgress) {
  // geometry comes in one plain script tag (no fetch, no blob or data URLs); textures are ordinary images
  return new Promise(resolve => {
    const tl = new THREE.TextureLoader(), aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    let total = 1 + ASSET_TEX.length * 3 + 2, done = 0, finished = false;
    ASSETS.fails = 0;
    const finish = () => { if (finished) return; finished = true; ASSETS.ready = Object.keys(ASSETS.geo).length > 10; resolve(ASSETS.ready); };
    const tick = ok => { done++; if (ok === false) ASSETS.fails++; if (onProgress) onProgress(Math.min(1, done / total)); if (done >= total) finish(); };
    setTimeout(finish, 60000);
    const texCache = new Map();
    const tex = (file, srgb) => {
      if (!file) return null;
      if (texCache.has(file)) return texCache.get(file);
      total++;
      const t = tl.load(assetURL(file), () => tick(true), undefined, () => tick(false));
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.flipY = false; if (srgb) t.encoding = THREE.sRGBEncoding;
      texCache.set(file, t); return t;
    };
    const dec = (b, T) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
    const onPack = () => {
      try {
        const mats = new Map();
        for (const [name, d] of Object.entries(window.WF_SCANS.meshes)) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.BufferAttribute(dec(d.p, Float32Array), 3));
          g.setAttribute('normal', new THREE.BufferAttribute(dec(d.n, Float32Array), 3));
          g.setAttribute('uv', new THREE.BufferAttribute(dec(d.uv, Float32Array), 2));
          g.setIndex(new THREE.BufferAttribute(dec(d.i, d.i32 ? Uint32Array : Uint16Array), 1));
          g.computeBoundingBox(); g.computeBoundingSphere(); g.userData.keep = true;
          let m = mats.get(d.m.key);
          if (!m) {
            const fol = FOLIAGE.test(name), mr = tex(d.m.mr, false);
            m = new THREE.MeshStandardMaterial({ map: tex(d.m.base, true), normalMap: tex(d.m.nor, false), roughnessMap: mr, metalnessMap: d.m.metal > 0 ? mr : null, metalness: d.m.metal || 0, roughness: 1, side: fol || d.m.ds ? THREE.DoubleSide : THREE.FrontSide });
            patchMat(m, fol ? { wind: '0.05', windBase: '0.15', key: 'as_' + d.m.key } : { key: 'as_' + d.m.key });
            mats.set(d.m.key, m);
          }
          ASSETS.geo[name] = g; ASSETS.mat[name] = m; ASSETS.size[name] = g.boundingBox.getSize(new THREE.Vector3());
        }
        delete window.WF_SCANS;
        tick(true);
      } catch (e) { console.warn('scan pack', e); tick(false); }
    };
    if (window.WF_SCANS) setTimeout(onPack, 0);
    else { const sc = document.createElement('script'); sc.src = 'assets/scan_pack.js'; sc.onload = onPack; sc.onerror = () => tick(false); document.head.appendChild(sc); }
    for (const k of ASSET_TEX) for (const ch of ['diff', 'nor', 'arm']) tl.load(assetURL(`${k}_${ch}.jpg`), t => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (ch === 'diff') t.encoding = THREE.sRGBEncoding;
      (ASSETS.tex[k] = ASSETS.tex[k] || {})[ch] = t; tick(true);
    }, undefined, () => tick(false));
    // ground layers arrive as vertical strips and become two texture arrays
    const strip = (url, size, cb) => { const img = new Image(); img.onload = () => { try { const c = document.createElement('canvas'); c.width = size; c.height = size * GROUND_LAYERS; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0); cb(x.getImageData(0, 0, size, size * GROUND_LAYERS).data); tick(true); } catch (e) { tick(false); } }; img.onerror = () => tick(false); img.src = url; };
    const mkArr = (data, size) => {
      const t = new THREE.DataTexture2DArray(new Uint8Array(data.buffer), size, size, GROUND_LAYERS);
      t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = aniso; t.needsUpdate = true;
      return t;
    };
    ASSETS.ground = {};
    strip(assetURL('ground_diff.jpg'), 1024, d => { ASSETS.ground.diff = mkArr(d, 1024); });
    strip(assetURL('ground_nor.jpg'), 512, d => { ASSETS.ground.nor = mkArr(d, 512); });
  });
}
function hasAsset(n) { return ASSETS.ready && !!ASSETS.geo[n]; }
// a clone-free mesh of an asset, scaled so its largest horizontal side is `w` world units (or scaled by `s`)
function assetMesh(name, opts = {}) {
  const geo = ASSETS.geo[name], mat = ASSETS.mat[name], sz = ASSETS.size[name];
  const m = new THREE.Mesh(geo, opts.mat || mat);
  const s = opts.s || (opts.w ? opts.w / Math.max(sz.x, sz.z) : opts.h ? opts.h / sz.y : 1);
  m.scale.setScalar(s);
  if (opts.x !== undefined) m.position.set(opts.x, opts.y || 0, opts.z);
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.rx) m.rotation.x = opts.rx;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// instanced scatter of an asset: list of [x, z, rotY, size] with size in world units across
function assetScatter(root, name, list, opts = {}) {
  if (!list.length || !hasAsset(name)) return null;
  const geo = ASSETS.geo[name], sz = ASSETS.size[name], base = Math.max(sz.x, sz.z);
  const m = new THREE.InstancedMesh(geo, opts.mat || ASSETS.mat[name], list.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  list.forEach((p, k) => {
    const s = p[3] / base;
    o.position.set(p[0], heightAt(p[0], p[1]) - (opts.sink || 0.01) * p[3], p[1]); o.rotation.set(opts.tilt ? (hash(k * 7 + 3) - 0.5) * opts.tilt : 0, p[2], opts.tilt ? (hash(k * 11 + 5) - 0.5) * opts.tilt : 0); o.scale.set(s, s * (opts.sy || 1) * (0.85 + hash(k * 13) * 0.3), s); o.updateMatrix();
    m.setMatrixAt(k, o.matrix);
    const j = (opts.tint || 1) * (0.82 + hash(k * 31 + 1) * 0.36); col.setRGB(j, j * (opts.g || 1), j * (opts.b || 1)); m.setColorAt(k, col);
  });
  m.castShadow = opts.cast !== false; m.receiveShadow = true;
  root.add(m);
  return m;
}
const ROCKS = ['rock_moss_set_01_rock01', 'rock_moss_set_01_rock02', 'rock_moss_set_01_rock03', 'rock_moss_set_01_rock04', 'rock_moss_set_01_rock05', 'rock_moss_set_01_rock06', 'rock_moss_set_02_rock07', 'rock_moss_set_02_rock08', 'rock_moss_set_02_rock09', 'rock_moss_set_02_rock10', 'rock_moss_set_02_rock11', 'rock_moss_set_02_rock12', 'rock_moss_set_02_rock13', 'boulder_01', 'boulder_02'];
const SHRUBS = ['shrub_02_a', 'shrub_02_b', 'shrub_02_c', 'shrub_02_d'];
const FERNS = ['fern_02_a', 'fern_02_b', 'fern_02_c', 'fern_02_d'];
// photo textures for buildings: real-world size of one texture tile, in world units
const TEX_TILE = { thatch: 0.8, plaster: 0.9, planks: 0.8, stone: 0.9, bark: 0.6 };
function photoMat(key, opts = {}) {
  const t = ASSETS.tex[key]; if (!ASSETS.ready || !t || !t.diff) return null;
  const rep = 1 / (TEX_TILE[key] || 1) * (opts.rep || 1);
  const cl = x => { if (!x) return null; const c = x.clone(); c.needsUpdate = true; c.repeat.set(rep, rep); return c; };
  return M('ph_' + key + (opts.tag || ''), { map: cl(t.diff), normalMap: cl(t.nor), roughnessMap: cl(t.arm), roughness: 1, metalness: 0, color: opts.color || '#ffffff', normalScale: new THREE.Vector2(opts.ns || 1, opts.ns || 1) });
}
