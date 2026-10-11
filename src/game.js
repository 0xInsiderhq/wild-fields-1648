// ================= new game =================
function newGame(opts) {
  const players = clamp(opts.players || 2, 2, 4);
  G.t = 0; G.speed = 1; G.over = false; G.winner = -1; G.paused = false;
  G.units = []; G.builds = []; G.projs = []; G.fx = []; G.corpses = []; G.nextId = 1; G.events = [];
  G.diff = opts.diff === undefined ? 1 : opts.diff;
  const seed = opts.seed || ((Date.now() % 1e6) | 0);
  const starts = genMap(seed, players);
  G.teams = [];
  for (let i = 0; i < players; i++) G.teams.push(makeTeam(i, !!(opts.allAI) || i > 0, i === 0 ? 0 : (opts.ffa ? i : 1)));
  RNG = mulberry32(seed + 99);
  starts.forEach((s, i) => {
    const tx = Math.round(s.x) - 2, tz = Math.round(s.z) - 2;
    placeBuilding('townhall', i, tx, tz, true);
    const toward = Math.atan2(64 - s.z, 64 - s.x);
    for (let k = 0; k < 6; k++) { const [fx, fz] = nearestFree(Math.round(s.x + Math.cos(toward) * 3.5) + (k % 3) - 1, Math.round(s.z + Math.sin(toward) * 3.5) + Math.floor(k / 3)); spawnUnit('peasant', i, fx + 0.5, fz + 0.5); }
    for (let k = 0; k < 2; k++) { const [fx, fz] = nearestFree(Math.round(s.x + Math.cos(toward) * 5.5) + k, Math.round(s.z + Math.sin(toward) * 5.5)); const u = spawnUnit('pikeman', i, fx + 0.5, fz + 0.5); u.ang = toward; u.face = toward; }
  });
  G.teams.forEach((tm, i) => { if (tm.ai) initAI(tm, i === 0 && opts.allAI ? (opts.p0level ?? 1) : G.diff); });
  updateFog();
  return starts;
}
