// all scanned geometry in one script file (base64 typed arrays) + texture file names; loads with a plain <script>
import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const io = new NodeIO(), SRC = '/home/claude/rts17/assets_glb';
const used = ['boulder_01','namaqualand_boulder_02','rock_moss_set_01','rock_moss_set_02','rock_07','stone_01','tree_stump_01','tree_stump_02','dead_tree_trunk','shrub_02','fern_02','cannon_01','wooden_barrels_01','wine_barrel_01','wooden_crate_01','wooden_crate_02','wooden_bucket_01','wicker_basket_01','spinning_wheel_01','wooden_ladder'];
const b64 = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
const pack = { meshes: {} };
for (const id of used) {
  const doc = await io.read(`${SRC}/${id}.glb`), r = doc.getRoot();
  const texName = new Map(); r.listTextures().forEach((t, i) => texName.set(t, `${id}__t${i}.jpg`));
  for (const n of r.listNodes()) {
    const m = n.getMesh(); if (!m) continue;
    const p = m.listPrimitives()[0], mat = p.getMaterial();
    pack.meshes[n.getName()] = {
      p: b64(p.getAttribute('POSITION').getArray()), n: b64(p.getAttribute('NORMAL').getArray()), uv: b64(p.getAttribute('TEXCOORD_0').getArray()),
      i: b64(p.getIndices().getArray()), i32: p.getIndices().getArray() instanceof Uint32Array,
      m: { base: texName.get(mat.getBaseColorTexture()), nor: texName.get(mat.getNormalTexture()), mr: texName.get(mat.getMetallicRoughnessTexture()), metal: mat.getMetallicFactor(), ds: mat.getDoubleSided(), key: id + '/' + mat.getName() },
    };
  }
}
fs.writeFileSync('/home/claude/rts17/assets/scan_pack.js', 'window.WF_SCANS = ' + JSON.stringify(pack) + ';\n');
console.log(Object.keys(pack.meshes).length, 'meshes', (fs.statSync('/home/claude/rts17/assets/scan_pack.js').size / 1e6).toFixed(2), 'MB');
