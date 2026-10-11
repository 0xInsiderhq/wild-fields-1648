import { NodeIO } from '@gltf-transform/core';
const io = new NodeIO();
for (const id of ['cannon_01', 'rock_moss_set_01', 'rock_moss_set_02', 'wooden_barrels_01', 'shrub_02', 'fern_02', 'wine_barrel_01', 'wooden_crate_01']) {
  const doc = await io.read(`/home/claude/ph_raw/models/${id}/${id}_1k.gltf`);
  const r = doc.getRoot();
  console.log('==', id, r.listTextures().map(t => t.getURI() + ' ' + t.getSize()).join(' | '));
  for (const n of r.listNodes()) { const m = n.getMesh(); let tris = 0; if (m) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3; console.log('  ', n.getName(), 't', n.getTranslation().map(v => v.toFixed(2)).join(','), 'r', n.getRotation().map(v => v.toFixed(2)).join(','), 's', n.getScale().map(v => v.toFixed(2)).join(','), 'tris', tris, 'children', n.listChildren().length); }
}
