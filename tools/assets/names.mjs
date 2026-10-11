import { NodeIO } from '@gltf-transform/core';
import fs from 'fs';
const io = new NodeIO(); const out = {};
for (const f of fs.readdirSync('/home/claude/rts17/assets').filter(f => f.endsWith('.glb'))) { const d = await io.read('/home/claude/rts17/assets/' + f); out[f] = d.getRoot().listNodes().map(n => n.getName()); }
console.log(JSON.stringify(out));
