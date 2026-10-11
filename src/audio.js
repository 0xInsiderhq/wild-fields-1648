// ================= procedural sound and music =================
const AU = { ctx: null, on: true, music: true, master: null, sfxBus: null, musBus: null, recent: {}, plucks: null, nextNote: 0, step: 0, verb: null };
function ensureAudio() {
  if (AU.ctx || !AU.on) return;
  try {
    const c = AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.master = c.createGain(); AU.master.gain.value = 0.55; AU.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4; comp.connect(AU.master);
    AU.sfxBus = c.createGain(); AU.sfxBus.gain.value = 0.9; AU.sfxBus.connect(comp);
    AU.musBus = c.createGain(); AU.musBus.gain.value = AU.music ? 0.32 : 0; AU.musBus.connect(comp);
    // short room reverb for distance
    const ir = c.createBuffer(2, c.sampleRate * 1.6, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    AU.verb = c.createConvolver(); AU.verb.buffer = ir; const vg = c.createGain(); vg.gain.value = 0.35; AU.verb.connect(vg); vg.connect(comp);
    AU.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const nd = AU.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    ambience();
    buildPlucks();
  } catch (_) { AU.ctx = null; }
}
function busFor(x, z) {
  const c = AU.ctx;
  if (x === undefined) return { out: AU.sfxBus, g: 1, pan: 0 };
  const dx = x - CAM.tx, dz = z - CAM.tz, d = hyp(dx, dz);
  const reach = CAM.dist * 1.2 + 14;
  const g = clamp(1 - d / reach, 0, 1) * clamp(30 / (CAM.dist + 10), 0.35, 1);
  // pan by screen side
  const rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw);
  const pan = clamp((dx * rx + dz * rz) / (CAM.dist * 0.8 + 6), -0.9, 0.9);
  return { out: AU.sfxBus, g: g * g, pan, far: clamp(d / reach, 0, 1) };
}
function voiceOut(b) {
  const c = AU.ctx, g = c.createGain();
  let node = g;
  if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = b.pan || 0; g.connect(p); p.connect(b.out); if (b.far > 0.3) { const s = c.createGain(); s.gain.value = b.far * 0.6; p.connect(s); s.connect(AU.verb); } }
  else g.connect(b.out);
  return node;
}
function sfx(name, x, z) {
  if (!AU.ctx || !AU.on) return;
  const c = AU.ctx, now = c.currentTime;
  const lim = { musket: [0.045, 6], cannon: [0.12, 2], chop: [0.06, 3], pick: [0.06, 3], hammer: [0.07, 3], sabre: [0.06, 4], pike: [0.07, 4], hit: [0.08, 3], die: [0.1, 3], horse: [0.2, 2], thud: [0.08, 3], crash: [0.1, 2], collapse: [0.3, 2], rustle: [0.1, 2] }[name] || [0.03, 2];
  const rec = AU.recent[name] || (AU.recent[name] = []);
  while (rec.length && now - rec[0] > lim[0] * 4) rec.shift();
  if (rec.filter(t => now - t < lim[0]).length >= lim[1]) return;
  const b = busFor(x, z);
  if (b.g < 0.02) return;
  rec.push(now);
  const out = voiceOut(b);
  const env = (node, a, d, peak, delay = 0) => { const g = c.createGain(); g.gain.setValueAtTime(0.0001, now + delay); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * b.g), now + delay + a); g.gain.exponentialRampToValueAtTime(0.0001, now + delay + a + d); node.connect(g); g.connect(out); return g; };
  const noise = (dur, type, f, q, peak, dec, delay = 0, f2) => { const s = c.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = 0.8 + Math.random() * 0.4; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now + delay); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + delay + dur); fl.Q.value = q; s.connect(fl); env(fl, 0.002, dec, peak, delay); s.start(now + delay, Math.random()); s.stop(now + delay + dur + 0.05); };
  const tone = (type, f0, f1, dur, peak, delay = 0, a = 0.004) => { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, now + delay); o.frequency.exponentialRampToValueAtTime(f1, now + delay + dur); env(o, a, dur, peak, delay); o.start(now + delay); o.stop(now + delay + dur + 0.1); };
  const j = 0.85 + Math.random() * 0.3;
  switch (name) {
    case 'musket': noise(0.12, 'highpass', 900 * j, 0.7, 0.55, 0.09); noise(0.6, 'lowpass', 900 * j, 0.5, 0.35, 0.45, 0.005, 200); tone('sine', 120 * j, 45, 0.18, 0.4); break;
    case 'cannon': noise(1.6, 'lowpass', 420, 0.6, 0.9, 1.3, 0, 90); tone('sine', 70, 28, 0.9, 0.9); noise(0.15, 'highpass', 1200, 0.7, 0.4, 0.1); break;
    case 'thud': noise(0.5, 'lowpass', 260, 0.8, 0.7, 0.4); tone('sine', 90, 35, 0.3, 0.5); break;
    case 'crash': noise(0.7, 'bandpass', 700, 0.8, 0.7, 0.55); tone('triangle', 140, 60, 0.3, 0.3); break;
    case 'collapse': noise(2.4, 'lowpass', 300, 0.7, 0.9, 2.0, 0, 80); for (let k = 0; k < 6; k++) noise(0.2, 'bandpass', 1500 + Math.random() * 2000, 2, 0.25, 0.15, 0.2 + Math.random() * 1.4); break;
    case 'sabre': case 'pike': { const f = name === 'sabre' ? 1700 : 1200; tone('sine', f * j, f * j * 0.98, 0.25, 0.18); tone('sine', f * 1.55 * j, f * 1.5 * j, 0.18, 0.12); noise(0.05, 'highpass', 3000, 0.7, 0.35, 0.04); break; }
    case 'hit': noise(0.12, 'lowpass', 600, 0.8, 0.45, 0.1); break;
    case 'chop': noise(0.08, 'bandpass', 1100 * j, 2, 0.45, 0.06); tone('sine', 220 * j, 150, 0.08, 0.35); break;
    case 'pick': tone('sine', 2600 * j, 2400, 0.09, 0.18); tone('sine', 3900 * j, 3700, 0.06, 0.1); noise(0.03, 'highpass', 4000, 0.7, 0.2, 0.02); break;
    case 'hammer': tone('sine', 320 * j, 260, 0.08, 0.35); noise(0.05, 'bandpass', 900, 1.5, 0.3, 0.04); break;
    case 'rustle': noise(0.25, 'highpass', 2500, 0.6, 0.15, 0.2); break;
    case 'die': noise(0.25, 'lowpass', 400, 0.8, 0.35, 0.2); break;
    case 'horse': noise(0.4, 'lowpass', 300, 0.8, 0.45, 0.3); tone('sawtooth', 520 * j, 380, 0.35, 0.05, 0.02, 0.05); break;
    case 'click': tone('triangle', 1400, 1100, 0.03, 0.12); break;
    case 'select': tone('triangle', 900, 1100, 0.05, 0.1); break;
    case 'order': tone('triangle', 700, 900, 0.05, 0.12); tone('triangle', 1050, 1200, 0.05, 0.08, 0.06); break;
    case 'place': noise(0.2, 'lowpass', 500, 0.8, 0.5, 0.16); tone('sine', 110, 70, 0.15, 0.4); break;
    case 'no': tone('sawtooth', 160, 140, 0.18, 0.08); break;
    case 'built': [523, 659, 784].forEach((f, i) => tone('sine', f, f, 1.2, 0.12, i * 0.09, 0.005)); break;
    case 'research': [659, 784, 988, 1319].forEach((f, i) => tone('sine', f, f, 1.0, 0.1, i * 0.08, 0.005)); break;
    case 'trained': tone('sine', 180, 90, 0.12, 0.3); noise(0.06, 'bandpass', 800, 2, 0.15, 0.05); break;
    case 'horn': { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(146, now); o.frequency.linearRampToValueAtTime(155, now + 0.25); o.frequency.linearRampToValueAtTime(146, now + 1.2); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; o.connect(lp); env(lp, 0.12, 1.2, 0.25); o.start(now); o.stop(now + 1.5); break; }
    case 'victory': [[392, 0], [523, 0.25], [659, 0.5], [784, 0.75], [1046, 1.1]].forEach(([f, d]) => { tone('sawtooth', f, f, 0.9, 0.06, d, 0.02); tone('sine', f / 2, f / 2, 0.9, 0.08, d, 0.02); }); break;
    case 'defeat': [[294, 0], [262, 0.5], [220, 1.0]].forEach(([f, d]) => tone('sawtooth', f, f * 0.98, 1.2, 0.07, d, 0.05)); break;
  }
}
// spoken acknowledgements are replaced by a short drum or bell figure per unit kind
let lastVoice = 0;
function voice(kind, u) {
  if (!AU.ctx || !AU.on) return;
  const now = performance.now(); if (now - lastVoice < 250) return; lastVoice = now;
  sfx(kind === 'attack' ? 'trained' : 'click');
}
function ambience() {
  const c = AU.ctx;
  const s = c.createBufferSource(); s.buffer = AU.noise; s.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.4;
  const g = c.createGain(); g.gain.value = 0.028;
  const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 0.018; lfo.connect(lg); lg.connect(g.gain); lfo.start();
  s.connect(f); f.connect(g); g.connect(AU.sfxBus); s.start();
  const bird = () => {
    if (AU.ctx && AU.on && CAM.dist < 40) {
      const n = c.currentTime, o = c.createOscillator(), gg = c.createGain();
      o.type = 'sine'; const f0 = 2600 + Math.random() * 1800;
      for (let k = 0; k < 3 + (Math.random() * 3 | 0); k++) { o.frequency.setValueAtTime(f0, n + k * 0.12); o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * 0.4), n + k * 0.12 + 0.06); }
      gg.gain.setValueAtTime(0.0001, n); gg.gain.exponentialRampToValueAtTime(0.012, n + 0.02); gg.gain.exponentialRampToValueAtTime(0.0001, n + 0.7);
      o.connect(gg); gg.connect(AU.sfxBus); o.start(n); o.stop(n + 0.8);
    }
    setTimeout(bird, 3500 + Math.random() * 7000);
  };
  setTimeout(bird, 3000);
}
// bandura-like plucks (Karplus-Strong, rendered once) playing in the Ukrainian Dorian mode
function buildPlucks() {
  const c = AU.ctx, sr = c.sampleRate;
  const scale = [0, 2, 3, 6, 7, 9, 10]; // D Ukrainian Dorian: D E F G# A B C
  const notes = [];
  for (let oct = 0; oct < 3; oct++) for (const s of scale) notes.push(146.83 * Math.pow(2, (s + oct * 12) / 12));
  AU.plucks = notes.map(f => {
    const len = Math.floor(sr * 2.4), buf = c.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const P = Math.max(2, Math.round(sr / f)), ring = new Float32Array(P);
    for (let i = 0; i < P; i++) ring[i] = Math.random() * 2 - 1;
    let k = 0;
    for (let i = 0; i < len; i++) { const a = ring[k], b = ring[(k + 1) % P]; const v = (a + b) * 0.5 * 0.996; ring[k] = v; d[i] = a * 0.6; k = (k + 1) % P; }
    return buf;
  });
  AU.drone = notes[0] / 2;
}
const MELODY = { deg: 7, phrase: 0 };
function musicTick() {
  if (!AU.ctx || !AU.plucks || !AU.music) return;
  const c = AU.ctx, now = c.currentTime;
  if (AU.nextNote < now) AU.nextNote = now + 0.1;
  while (AU.nextNote < now + 0.4) {
    const t = AU.nextNote, beat = AU.step % 16;
    const play = (i, vol, rate = 1) => { const s = c.createBufferSource(); s.buffer = AU.plucks[clamp(i, 0, AU.plucks.length - 1)]; s.playbackRate.value = rate; const g = c.createGain(); g.gain.value = vol; s.connect(g); g.connect(AU.musBus); s.start(t); };
    // bass drone on the bar, fifth on the half
    if (beat === 0) { play(0, 0.5); play(4, 0.25); }
    if (beat === 8) play(4, 0.3);
    // melody: a wandering line that leans on the raised fourth and resolves home
    if (beat % 2 === 0 && Math.random() < (beat % 4 === 0 ? 0.95 : 0.6)) {
      const r = Math.random();
      MELODY.deg += r < 0.35 ? 1 : r < 0.7 ? -1 : r < 0.82 ? 2 : r < 0.92 ? -2 : 0;
      if (AU.step % 64 > 56) MELODY.deg += (7 - MELODY.deg) > 0 ? 1 : -1;
      MELODY.deg = clamp(MELODY.deg, 5, 18);
      play(MELODY.deg, beat % 4 === 0 ? 0.42 : 0.3);
      if (Math.random() < 0.25) { const s2 = AU.nextNote + 0.09; const s = c.createBufferSource(); s.buffer = AU.plucks[clamp(MELODY.deg + 2, 0, 20)]; const g = c.createGain(); g.gain.value = 0.18; s.connect(g); g.connect(AU.musBus); s.start(s2); }
    }
    AU.step++;
    AU.nextNote += 60 / 88 / 2;
  }
}
