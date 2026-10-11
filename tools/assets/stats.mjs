import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const io = new NodeIO();
const root = '/home/claude/ph_raw/models';
for (const id of fs.readdirSync(root)) {
  const f = fs.readdirSync(root + '/' + id).find(x => x.endsWith('.gltf'));
  const doc = await io.read(`${root}/${id}/${f}`);
  const r = doc.getRoot();
  let tris = 0, verts = 0;
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { const idx = p.getIndices(); const pos = p.getAttribute('POSITION'); verts += pos.getCount(); tris += (idx ? idx.getCount() : pos.getCount()) / 3; }
  // bounds
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { const pos = p.getAttribute('POSITION'); const a = pos.getMin([]), b = pos.getMax([]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[k]); mx[k] = Math.max(mx[k], b[k]); } }
  const mats = r.listMaterials().map(m => m.getName() + (m.getAlphaMode() !== 'OPAQUE' ? '(' + m.getAlphaMode() + ')' : ''));
  console.log(id.padEnd(24), 'nodes', r.listNodes().length, 'meshes', r.listMeshes().length, 'tris', Math.round(tris), 'size', mx.map((v, k) => (v - mn[k]).toFixed(2)).join('x'), 'mats', mats.join(','), 'anim', r.listAnimations().length, 'skins', r.listSkins().length);
}
