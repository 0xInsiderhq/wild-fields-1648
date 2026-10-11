#!/usr/bin/env python3
"""Build Wild Fields 1648 from src/.

  python3 build.py          -> index.html (three.js from CDN, assets/ next to it)
                               dist/Wild_Fields_1648_offline.html (every scan and texture inline, opens from disk)

The game is plain JavaScript split into modules that are concatenated in a fixed order
into the page shell. No bundler, no dependencies at runtime besides three.js r128.
"""
import base64, json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
ORDER = ['core', 'map', 'entities', 'ai', 'game', 'r_core', 'r_assets', 'r_terrain', 'r_build',
         'r_units', 'r_veg', 'r_ents', 'r_fx', 'icons', 'ui', 'audio', 'main']

js = '\n'.join(open(os.path.join(ROOT, 'src', n + '.js'), encoding='utf-8').read() for n in ORDER)
shell = open(os.path.join(ROOT, 'src', 'shell.html'), encoding='utf-8').read()
out = shell.replace('/*JS*/', js)
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out) // 1024, 'KB')

# offline single file: the scan pack and all textures go inline as data URIs
assets = os.path.join(ROOT, 'assets')
emb = {f: 'data:image/jpeg;base64,' + base64.b64encode(open(os.path.join(assets, f), 'rb').read()).decode()
       for f in sorted(os.listdir(assets)) if f.endswith('.jpg')}
pack = open(os.path.join(assets, 'scan_pack.js'), encoding='utf-8').read()
i = out.find("<script>\n'use strict';")
off = out[:i] + '<script>window.WF_EMBED = ' + json.dumps(emb) + ';\n' + pack + '</script>\n' + out[i:]
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist', 'Wild_Fields_1648_offline.html'), 'w', encoding='utf-8').write(off)
print('dist/Wild_Fields_1648_offline.html', round(len(off) / 1e6, 1), 'MB')
