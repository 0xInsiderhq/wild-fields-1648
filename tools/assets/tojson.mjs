// GLB -> glTF JSON with the geometry buffer embedded and textures as sibling .jpg files (all web-served types)
import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const io = new NodeIO(), SRC = '/home/claude/rts17/assets_glb', OUT = '/home/claude/rts17/assets';
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.glb'))) {
  const id = f.replace('.glb', ''), doc = await io.read(`${SRC}/${f}`);
  doc.getRoot().listTextures().forEach((t, i) => t.setURI(`${id}__t${i}.jpg`));
  const { json, resources } = await io.writeJSON(doc, { basename: id });
  for (const b of json.buffers || []) { const data = resources[b.uri]; b.uri = 'data:application/octet-stream;base64,' + Buffer.from(data).toString('base64'); }
  for (const im of json.images || []) fs.writeFileSync(`${OUT}/${im.uri}`, resources[im.uri]);
  fs.writeFileSync(`${OUT}/${id}.json`, JSON.stringify(json));
}
