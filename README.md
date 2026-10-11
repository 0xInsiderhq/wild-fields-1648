# Wild Fields 1648

A real-time strategy game set on the Ukrainian steppe in 1648, written by Claude Opus 5.5 and played in one browser tab. Raise a Cossack town, farm, fell forests, quarry stone, mine gold, train pikemen, musketeers, Cossack horse and field guns, and burn the rival town halls before they burn yours.

**Play:** https://0xinsiderhq.github.io/wild-fields-1648/ (desktop, give it a few seconds to load the scans)

![v1 vs v3](media/post_before_after.jpg)

## What is in it

- People on a jointed rig with two-bone IK, foot planting, gaits for walking, running and galloping horses, corpses that fall the right way
- Wheat that grows and ripens, paths that wear into the ground where peasants keep walking, trees that fall and leave stumps
- 25 photo-scanned models and PBR textures from Poly Haven (CC0), cut 40 to 60 times, 112 MB of downloads down to about 9 MB
- AI opponents that build, gather, research and attack; a 20 minute AI vs AI match runs without errors
- Burnt buildings leave ruins (log cribs, stone walls, a brick stove), new buildings clear the bushes on their plot
- Sound synthesised in code, no samples

## Run it locally

The page loads `assets/` with plain script and image tags, so any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

`dist/Wild_Fields_1648_offline.html` is the same game as one 12 MB file with every scan and texture inline. It opens straight from disk.

## Build

```bash
python3 build.py
```

`src/` holds the game as plain JavaScript modules (`core`, `map`, `entities`, `ai`, `game` for the simulation, `r_*` for rendering, `ui`, `audio`, `main`). `build.py` concatenates them in a fixed order into `src/shell.html` and writes `index.html` and the offline file. three.js r128 comes from cdnjs.

## Tools

- `tools/assets/` the Poly Haven pipeline: weld, simplify with meshoptimizer, drop foliage cards, pack every mesh into `assets/scan_pack.js` (gltf-transform). Paths in these scripts point at the original workspace and need adjusting.
- `tools/video/` how the comparison videos are made: `rec.js` records a seeded match frame by frame in headless Chromium, `interp.py` doubles the frame rate with optical flow, `compose.py` stacks two builds into a 1080x1920 video with labels.
- `tests/` Playwright scripts used while building: boot, a long AI vs AI match, performance, a full match to the victory screen, screenshot sets.

## Credits

- Code written by Claude Opus 5.5 (Anthropic), directed by [@0xInsiderf5](https://x.com/0xInsiderf5)
- 3D models and textures: [Poly Haven](https://polyhaven.com), CC0. See [CREDITS.md](CREDITS.md)
- [three.js](https://threejs.org) r128, MIT
- Fonts: IM Fell English SC, Spectral (Google Fonts, SIL Open Font License)

## License

Code is MIT, see [LICENSE](LICENSE). Poly Haven assets stay CC0.
