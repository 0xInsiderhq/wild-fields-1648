// ================= interface, input, commands =================
const $ = s => document.querySelector(s);
const UI = { sel: [], box: null, drag: null, place: null, amode: false, groups: {}, lastGroup: { k: -1, t: 0 }, lastClick: { t: 0, id: -1 }, pings: [], lastAlert: null, mouse: { x: -1, y: -1, in: false }, keys: {}, speeds: [1, 1.5, 2, 3], speedI: 0, icons: {}, cmdSig: '', selSig: '', mid: null, tipFor: null, attackT: -99, hover: null };

function toast(msg, kind) {
  const box = $('#toasts'); if (!box) return;
  if ([...box.children].some(c => c.textContent === msg && !c.classList.contains('out'))) return;
  const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4200);
}
function showAlert(msg, x, z) {
  const a = $('#alert'); a.textContent = msg; a.hidden = false;
  clearTimeout(UI.alertT); UI.alertT = setTimeout(() => a.hidden = true, 3500);
  if (x !== undefined) { UI.pings.push({ x, z, t: G.t }); UI.lastAlert = { x, z }; }
}

// ---------- picking ----------
function pickAt(sx, sy) {
  const ppt = VH / (2 * Math.tan(camera.fov * Math.PI / 360) * CAM.dist);
  let best = null, bd = 1e9;
  for (const u of G.units) {
    if (u.team !== 0 && !visibleAt(u.x, u.z)) continue;
    if (Math.abs(u.x - CAM.tx) > CAM.dist * 1.6 + 10 || Math.abs(u.z - CAM.tz) > CAM.dist * 1.6 + 10) continue;
    const h = u.d.cls === 'cav' ? 0.5 : 0.3;
    const s = project(u.x, Math.max(heightAt(u.x, u.z), 0) + h, u.z);
    const d = hyp(s.x - sx, s.y - sy), rad = Math.max(10, u.d.r * ppt * 1.3 + 4);
    if (d < rad && d < bd) { bd = d; best = u; }
  }
  if (best) return best;
  _v2.set(sx / VW * 2 - 1, -(sy / VH) * 2 + 1); _ray.setFromCamera(_v2, camera);
  const objs = []; for (const r of BENT.values()) if (!r.dying && r.obj.visible) objs.push(r.obj);
  const hits = _ray.intersectObjects(objs, true);
  for (const h of hits) { let o = h.object; while (o && !o.userData.ent) o = o.parent; if (o && o.userData.ent.hp > 0) return o.userData.ent; }
  return null;
}
function groundTile(sx, sy) { const g = groundAt(sx, sy); if (!g) return null; return { x: g.x, z: g.z, tx: Math.floor(g.x), tz: Math.floor(g.z) }; }
function resourceAt(g) {
  if (!g || !inMap(g.tx, g.tz)) return null;
  // be generous: look at the tile and its neighbours for a tree or deposit
  let best = null, bd = 1e9;
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    const tx = g.tx + x, tz = g.tz + z; if (!inMap(tx, tz)) continue;
    const i = idx(tx, tz);
    if (G.vis[i] === 0) continue;
    if (G.tree[i] || G.dep[i]) { const d = hyp(tx + 0.5 - g.x, tz + 0.5 - g.z); if (d < bd && d < 1.1) { bd = d; best = jobFromTile(0, tx, tz); } }
  }
  return best;
}
const mine = () => UI.sel.filter(e => e.kind === 'u' && e.team === 0 && e.hp > 0);
function setSel(arr) { UI.sel = arr.filter(e => e && e.hp > 0); UI.cmdSig = ''; UI.selSig = ''; refreshPanel(true); }

// ---------- commands ----------
function smartCommand(sx, sy, shift) {
  const units = mine();
  const g = groundTile(sx, sy);
  const hit = pickAt(sx, sy);
  // a single selected building of ours: set its rally point
  if (!units.length) {
    const b = UI.sel.length === 1 && UI.sel[0].kind === 'b' && UI.sel[0].team === 0 ? UI.sel[0] : null;
    if (b && b.d.trains && g) {
      const job = resourceAt(g);
      b.rally = { x: g.x, z: g.z, job: job || (hit && hit.kind === 'b' && hit.type === 'farm' && hit.team === 0 ? { kind: 'farm', b: hit } : null), build: hit && hit.kind === 'b' && hit.team === 0 && !hit.done ? hit : null };
      markAt(g.x, g.z, '#f2d35a'); sfx('click');
    }
    return;
  }
  const workers = units.filter(u => u.d.cls === 'worker'), army = units.filter(u => u.d.cls !== 'worker');
  if (hit && hit.team !== undefined && enemies(0, hit.team)) {
    orderAttack(army.length ? army : workers, hit);
    if (army.length && workers.length) orderMove(workers, hit.x, hit.z);
    markAt(hit.x, hit.z, '#ff6a52'); sfx('order'); voice('attack'); return;
  }
  if (hit && hit.kind === 'b' && hit.team === 0) {
    if (workers.length && (!hit.done || hit.hp < hit.maxhp)) { orderBuild(workers, hit); if (army.length) orderMove(army, hit.x, hit.z + hit.h); markAt(hit.x, hit.z, '#f2d35a'); sfx('order'); voice('build'); return; }
    if (workers.length && hit.type === 'farm' && hit.done) { orderGather(workers.slice(0, 1), { kind: 'farm', b: hit }); if (workers.length > 1) orderMove(workers.slice(1), hit.x, hit.z); markAt(hit.x, hit.z, '#e8d48a'); sfx('order'); voice('gather'); return; }
    if (workers.length && hit.d.drop) { for (const u of workers) if (u.carry > 0 && u.state === 'gather') { u.sub = 'return'; u.drop = hit; } }
  }
  const job = resourceAt(g);
  if (job && workers.length) {
    orderGather(workers, job);
    if (army.length) orderMove(army, g.x, g.z, {});
    const t = job.kind === 'tree' ? { x: job.tile % N + 0.5, z: ((job.tile / N) | 0) + 0.5 } : job.dep;
    markAt(t.x, t.z, '#e8d48a'); sfx('order'); voice('gather'); return;
  }
  if (!g) return;
  orderMove(units, g.x, g.z, {});
  markAt(g.x, g.z, '#9ff5c0'); sfx('order'); voice('move');
}
function attackMoveTo(sx, sy) {
  const units = mine(); if (!units.length) return;
  const hit = pickAt(sx, sy);
  if (hit && enemies(0, hit.team)) { orderAttack(units, hit); markAt(hit.x, hit.z, '#ff6a52'); }
  else { const g = groundTile(sx, sy); if (!g) return; orderMove(units, g.x, g.z, { amove: true }); markAt(g.x, g.z, '#ff6a52'); }
  sfx('order'); voice('attack');
}
function formationPreview(a, b, commit) {
  const units = mine(); if (!units.length) return;
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, L = Math.max(0.6, hyp(b.x - a.x, b.z - a.z));
  const along = Math.atan2(b.z - a.z, b.x - a.x);
  let face = along + Math.PI / 2;
  // face away from the camera, like drawing a front line on a map
  const look = Math.atan2(-Math.cos(CAM.yaw), -Math.sin(CAM.yaw));
  if (Math.abs(angDiff(face, look)) > Math.PI / 2) face += Math.PI;
  if (commit) { orderMove(units, mx, mz, { face, width: L, amove: false }); sfx('order'); voice('move'); return; }
  const slots = formationSlots(units, mx, mz, face, L);
  for (const p of slots.values()) FX.marks.push({ x: p.x, z: p.z, col: '#9ff5c0', t0: U.time.value, slot: true });
}
function boxSelect(b, shift) {
  const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
  let got = G.units.filter(u => { if (u.team !== 0) return false; const s = project(u.x, Math.max(heightAt(u.x, u.z), 0) + 0.3, u.z); return s.z < 1 && s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1; });
  const army = got.filter(u => u.d.cls !== 'worker');
  if (army.length) got = army;
  if (shift) got = [...new Set([...mine(), ...got])];
  if (got.length) { setSel(got); sfx('select'); voice('select', got[0]); } else if (!shift) setSel([]);
}
function clickSelect(sx, sy, shift, dbl) {
  const hit = pickAt(sx, sy);
  if (!hit) {
    const g = groundTile(sx, sy), job = resourceAt(g);
    if (job && job.dep && !shift) { setSel([]); UI.inspect = job.dep; refreshPanel(true); return; }
    if (!shift) setSel([]);
    return;
  }
  UI.inspect = null;
  if (dbl && hit.kind === 'u' && hit.team === 0) {
    setSel(G.units.filter(u => u.team === 0 && u.type === hit.type && onScreen(u))); sfx('select'); voice('select', hit); return;
  }
  if (shift && hit.kind === 'u' && hit.team === 0) {
    const cur = mine();
    setSel(cur.includes(hit) ? cur.filter(u => u !== hit) : [...cur, hit]);
    return;
  }
  setSel([hit]);
  sfx('select');
  if (hit.team === 0) voice('select', hit);
}
function onScreen(u) { const s = project(u.x, heightAt(u.x, u.z) + 0.3, u.z); return s.z < 1 && s.x >= 0 && s.x <= VW && s.y >= 40 && s.y <= VH - 200; }

// ---------- building placement ----------
function startPlace(type) {
  const d = BT[type];
  if (d.needs && !G.builds.some(b => b.team === 0 && b.type === d.needs && b.done)) { toast(`Build an ${BT[d.needs].name} first`, 'warn'); sfx('no'); return; }
  if (!canAfford(0, d.cost)) { toast(needText(0, d.cost), 'warn'); sfx('no'); return; }
  UI.place = { type, tx: undefined, tz: undefined };
  UI.amode = false;
  updatePlaceFromMouse();
}
function updatePlaceFromMouse() {
  if (!UI.place) return;
  const g = groundAt(UI.mouse.x, UI.mouse.y); if (!g) return;
  const d = BT[UI.place.type];
  UI.place.tx = Math.round(g.x - d.w / 2); UI.place.tz = Math.round(g.z - d.h / 2);
}
function confirmPlace(shift) {
  const p = UI.place; if (!p || p.tx === undefined) return;
  const d = BT[p.type];
  if (!canPlace(0, p.type, p.tx, p.tz)) { toast('You cannot build there', 'warn'); sfx('no'); return; }
  if (!canAfford(0, d.cost)) { toast(needText(0, d.cost), 'warn'); sfx('no'); UI.place = null; return; }
  pay(0, d.cost);
  const b = placeBuilding(p.type, 0, p.tx, p.tz, false);
  let builders = mine().filter(u => u.d.cls === 'worker');
  if (!builders.length) builders = G.units.filter(u => u.team === 0 && u.d.cls === 'worker' && u.state === 'idle').slice(0, 1);
  if (shift) {
    // queue: idle/busy builders take sites in turn
    orderBuild(builders.slice(0, Math.max(1, Math.ceil(builders.length / 2))), b);
  } else orderBuild(builders, b);
  sfx('place'); voice('build');
  if (!shift) UI.place = null;
}

// ---------- command card ----------
const GRID_KEYS = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', 'Z', 'X', 'C', 'V', 'B'];
const BUILD_GRID = ['house', 'mill', 'farm', 'storehouse', 'townhall', 'barracks', 'stable', 'blacksmith', 'foundry', 'tower', 'church'];
function commandsFor() {
  const out = new Array(15).fill(null);
  const units = mine();
  if (units.length) {
    const workersOnly = units.every(u => u.d.cls === 'worker');
    if (workersOnly) {
      BUILD_GRID.forEach((t, i) => out[i] = { kind: 'build', id: t });
      out[14] = { kind: 'stop' };
      return out;
    }
    out[0] = { kind: 'amove' }; out[1] = { kind: 'stop' }; out[2] = { kind: 'hold' };
    out[5] = { kind: 'form', id: 'line' }; out[6] = { kind: 'form', id: 'column' }; out[7] = { kind: 'form', id: 'square' };
    return out;
  }
  const b = UI.sel.length === 1 && UI.sel[0].kind === 'b' && UI.sel[0].team === 0 ? UI.sel[0] : null;
  if (!b || !b.done) return out;
  (b.d.trains || []).forEach((t, i) => out[i] = { kind: 'train', id: t, b });
  (b.d.techs || []).forEach((t, i) => out[5 + i] = { kind: 'tech', id: t, b });
  if (b.queue.length || b.research) out[14] = { kind: 'cancel', b };
  return out;
}
function cmdIcon(c) {
  if (c.kind === 'build') return UI.icons['b_' + c.id];
  if (c.kind === 'train') return UI.icons['u_' + c.id];
  if (c.kind === 'tech') return UI.icons['t_' + c.id];
  return UI.icons['c_' + (c.kind === 'form' ? c.id : c.kind)];
}
function cmdState(c) {
  const tm = G.teams[0];
  if (c.kind === 'build') { const d = BT[c.id]; if (d.needs && !G.builds.some(b => b.team === 0 && b.type === d.needs && b.done)) return 'off'; return canAfford(0, d.cost) ? '' : 'off'; }
  if (c.kind === 'train') { const d = UT[c.id]; if (d.needs && !G.builds.some(b => b.team === 0 && b.type === d.needs && b.done)) return 'off'; return canAfford(0, d.cost) ? '' : 'off'; }
  if (c.kind === 'tech') { if (tm.techs.has(c.id)) return 'done'; if (tm.researching.has(c.id) || c.b.research) return 'off'; return canAfford(0, TECH[c.id].cost) ? '' : 'off'; }
  if (c.kind === 'amove') return UI.amode ? 'on' : '';
  return '';
}
function runCmd(c, shift) {
  if (!c) return;
  sfx('click');
  switch (c.kind) {
    case 'build': startPlace(c.id); break;
    case 'train': { const n = shift ? 5 : 1; for (let i = 0; i < n; i++) if (!queueUnit(c.b, c.id)) break; break; }
    case 'tech': if (!G.teams[0].techs.has(c.id)) startResearch(c.b, c.id); break;
    case 'cancel': if (c.b.queue.length) cancelQueue(c.b); else cancelResearch(c.b); break;
    case 'stop': orderStop(mine()); break;
    case 'hold': orderHold(mine()); break;
    case 'amove': UI.amode = !UI.amode; UI.place = null; break;
    case 'form': reform(c.id); break;
  }
  UI.cmdSig = ''; refreshPanel(true);
}
function reform(kind) {
  const units = mine(); if (!units.length) return;
  let cx = 0, cz = 0, fa = 0, fb = 0; for (const u of units) { cx += u.x; cz += u.z; fa += Math.cos(u.ang); fb += Math.sin(u.ang); }
  cx /= units.length; cz /= units.length;
  const face = Math.atan2(fb, fa);
  const n = units.length;
  const width = kind === 'line' ? Math.max(2, n * 0.62 / 2) : kind === 'column' ? 1.9 : Math.sqrt(n) * 0.62;
  orderMove(units, cx, cz, { face, width });
  sfx('order');
}
function cmdTip(c) {
  if (!c) return '';
  const tm = G.teams[0];
  const cost = arr => `<div class="cost">${arr.map((v, i) => v ? `<span class="${tm.res[i] < v ? 'no' : ''}">${v} ${RES[i]}</span>` : '').join('')}</div>`;
  const hk = c.hk ? ` <kbd style="font-size:12px">${c.hk}</kbd>` : '';
  if (c.kind === 'build') { const d = BT[c.id]; return `<h4>${d.name}${hk}</h4>${cost(d.cost)}<p>${d.desc}${d.needs ? ` Requires an ${BT[d.needs].name}.` : ''}</p>`; }
  if (c.kind === 'train') { const d = UT[c.id]; return `<h4>${d.name}${hk}</h4>${cost(d.cost)}<p>${d.desc}</p><p style="margin-top:4px">${d.hp} hp · armour ${d.armor}/${d.parmor}${d.gun ? ` · range ${d.gun.range}` : d.art ? ` · range ${d.art.range}` : ''} · ${d.time}s${d.needs ? ` · needs an ${BT[d.needs].name}` : ''}. Shift-click queues five.</p>`; }
  if (c.kind === 'tech') { const T = TECH[c.id]; return `<h4>${T.name}${hk}</h4>${tm.techs.has(c.id) ? '<div class="cost">Researched</div>' : cost(T.cost)}<p>${T.desc}</p>`; }
  const T = { stop: ['Stop', 'Drop the current order.'], hold: ['Hold ground', 'Stand fast and fire only at what comes into range.'], amove: ['Attack-move', 'Click a spot: march there and fight everything on the way. Hotkey A.'], cancel: ['Cancel', 'Cancel the last item in the queue and get the cost back.'], line: ['Line', 'Re-form in a wide line, three ranks deep. Right-drag on the ground to draw any front you like.'], column: ['Column', 'Re-form in a narrow column for roads and fords.'], square: ['Square', 'Re-form in a deep block.'] };
  const k = c.kind === 'form' ? c.id : c.kind;
  return `<h4>${T[k][0]}${hk}</h4><p>${T[k][1]}</p>`;
}
function renderCmds() {
  const cmds = commandsFor();
  const sig = JSON.stringify(cmds.map(c => c ? c.kind + (c.id || '') + cmdState(c) : '-')) + UI.sel.map(e => e.id).join(',');
  if (sig === UI.cmdSig) return;
  UI.cmdSig = sig;
  const el = $('#cmds'); el.innerHTML = '';
  $('#tip').hidden = true; UI.tipFor = null;
  cmds.forEach((c, i) => {
    const b = document.createElement('button');
    if (!c) { b.className = 'cmd'; b.style.visibility = 'hidden'; el.appendChild(b); return; }
    c.hk = GRID_KEYS[i];
    const st = cmdState(c);
    b.className = 'cmd ' + (st === 'off' ? 'off' : st === 'on' ? 'on' : st === 'done' ? 'off' : '');
    const ic = cmdIcon(c);
    b.innerHTML = `${ic ? `<img src="${ic}" alt="">` : ''}<span class="k">${GRID_KEYS[i]}</span>`;
    b.setAttribute('aria-label', (c.id ? (BT[c.id] || UT[c.id] || TECH[c.id] || { name: c.id }).name : c.kind));
    b.addEventListener('click', e => runCmd(c, e.shiftKey));
    b.addEventListener('mouseenter', () => { const t = $('#tip'); t.innerHTML = cmdTip(c); t.hidden = false; UI.tipFor = c; });
    b.addEventListener('mouseleave', () => { $('#tip').hidden = true; UI.tipFor = null; });
    el.appendChild(b);
  });
  UI.cmds = cmds;
}

// ---------- selection panel ----------
function stateText(u) {
  if (u.state === 'gather' && u.job) { const k = u.job.kind; const r = { tree: 'Chopping wood', stone: 'Quarrying stone', gold: 'Mining gold', farm: 'Farming', berry: 'Picking berries' }[k]; return u.sub === 'return' ? `Carrying ${Math.floor(u.carry)} ${RES[u.carryRes] || ''} home` : `${r}${u.carry >= 1 ? ` (${Math.floor(u.carry)}/${G.teams[u.team].mod.carry})` : ''}`; }
  if (u.state === 'build') return u.bld && u.bld.done ? 'Repairing' : 'Building';
  if (u.state === 'attack') return u.cd > 0 && (u.d.gun || u.d.art) ? 'Reloading' : 'Fighting';
  if (u.state === 'move') return u.amove ? 'Advancing' : 'Marching';
  return u.hold ? 'Holding ground' : 'Idle';
}
function refreshPanel(force) {
  UI.sel = UI.sel.filter(e => e.hp > 0);
  const sel = UI.sel;
  const sig = sel.map(e => e.id + ':' + Math.round(e.hp / 6) + ':' + (e.state || '') + (e.sub || '') + (e.queue ? e.queue.join() + Math.round(e.qt) : '') + (e.research ? e.research.id + Math.round(e.research.t) : '') + (e.prog !== undefined ? Math.round(e.prog * 50) : '') + (e.carry ? Math.floor(e.carry) : '')).join('|') + (UI.inspect ? 'i' + UI.inspect.id + Math.round(UI.inspect.amt) : '');
  if (!force && sig === UI.selSig) { renderCmds(); return; }
  UI.selSig = sig;
  const name = $('#selname'), sub = $('#selsub'), hp = $('#selhp'), stats = $('#selstats'), queue = $('#queue'), group = $('#group'), por = $('#portrait');
  queue.innerHTML = ''; group.innerHTML = ''; stats.innerHTML = '';
  if (!sel.length) {
    if (UI.inspect) {
      const d = UI.inspect, nm = { gold: 'Gold mine', stone: 'Stone quarry', berry: 'Berry bushes' }[d.type];
      name.textContent = nm; sub.textContent = `${Math.ceil(d.amt)} ${d.type === 'berry' ? 'food' : d.type} left`; hp.hidden = true;
      por.innerHTML = UI.icons['d_' + d.type] ? `<img src="${UI.icons['d_' + d.type]}" alt="">` : '';
    } else {
      name.textContent = G.teams[0] ? G.teams[0].name : ''; sub.textContent = 'Select a unit or building'; hp.hidden = true; por.innerHTML = UI.icons.crest ? `<img src="${UI.icons.crest}" alt="">` : '';
    }
    renderCmds(); return;
  }
  const e = sel[0];
  hp.hidden = false;
  if (sel.length === 1) {
    por.innerHTML = `<img src="${UI.icons[(e.kind === 'u' ? 'u_' : 'b_') + e.type] || ''}" alt="">`;
    name.textContent = e.d.name;
    hp.firstElementChild.style.width = clamp(e.hp / e.maxhp * 100, 0, 100) + '%';
    const tm = G.teams[e.team];
    if (e.kind === 'u') {
      sub.textContent = (e.team === 0 ? '' : tm.name + ' · ') + stateText(e);
      const m = tm.mod, atk = e.d.gun ? e.d.gun.dmg : e.d.art ? Math.round(e.d.art.dmg * m.cannon) : e.d.melee.dmg + (e.type === 'pikeman' ? m.pike : 0);
      const arm = e.d.armor + (e.d.cls === 'inf' ? m.infArmor : 0), parm = e.d.parmor + (e.d.cls === 'inf' ? m.infArmor : 0);
      stats.innerHTML = `<span>HP <b>${Math.ceil(e.hp)}/${e.maxhp}</b></span><span>Attack <b>${atk}</b></span><span>Armour <b>${arm}/${parm}</b></span>${e.d.gun || e.d.art ? `<span>Range <b>${attackRange(e)}</b></span>` : ''}<span>Speed <b>${e.d.speed}</b></span>`;
    } else {
      const st = !e.done ? `Under construction, ${Math.floor(e.prog * 100)}%` : e.research ? `Researching ${TECH[e.research.id].name}` : e.queue.length ? `Training ${UT[e.queue[0]].name}` : e.d.drop ? 'Takes ' + RES.filter((r, i) => e.d.drop[i]).join(', ') : e.d.pop ? `Houses ${e.d.pop}` : e.type === 'farm' ? (e.farmer ? 'Being farmed' : 'No farmer. Right-click it with a peasant') : '';
      sub.textContent = (e.team === 0 ? '' : tm.name + ' · ') + st;
      stats.innerHTML = `<span>HP <b>${Math.ceil(e.hp)}/${e.maxhp}</b></span><span>Armour <b>${e.d.armor || 0}</b></span>${e.d.gun ? `<span>Range <b>${e.d.gun.range + tm.mod.range}</b></span>` : ''}`;
      if (e.team === 0) {
        if (e.research) { const b2 = document.createElement('button'); b2.className = 'qi'; b2.title = 'Cancel research'; b2.innerHTML = `<img src="${UI.icons['t_' + e.research.id]}" alt=""><i style="width:${e.research.t / TECH[e.research.id].time * 100}%"></i>`; b2.onclick = () => { cancelResearch(e); refreshPanel(true); }; queue.appendChild(b2); }
        e.queue.forEach((t, i) => { const b2 = document.createElement('button'); b2.className = 'qi'; b2.title = 'Cancel ' + UT[t].name; b2.innerHTML = `<img src="${UI.icons['u_' + t]}" alt="">${i === 0 ? `<i style="width:${e.qt / UT[t].time * 100}%"></i>` : ''}`; b2.onclick = () => { const k = e.queue.lastIndexOf(t); if (k >= 0) { e.queue.splice(k, 1); refund(0, UT[t].cost); if (k === 0) e.qt = 0; } refreshPanel(true); }; queue.appendChild(b2); });
      }
    }
  } else {
    const counts = {}; for (const u of sel) counts[u.type] = (counts[u.type] || 0) + 1;
    por.innerHTML = `<img src="${UI.icons['u_' + e.type] || ''}" alt="">`;
    const plural = (t, n) => n === 1 ? UT[t].name : UT[t].name === 'Pikeman' ? 'Pikemen' : UT[t].name === 'Cossack Rider' ? 'Cossack Riders' : UT[t].name + 's';
    const kinds = Object.entries(counts);
    name.textContent = kinds.length === 1 ? `${kinds[0][1]} ${plural(kinds[0][0], kinds[0][1])}` : kinds.length === 2 ? kinds.map(([t, n]) => `${n} ${plural(t, n)}`).join(' and ') : `${sel.length} men`;
    sub.textContent = Object.entries(counts).map(([t, n]) => `${UT[t].name} ×${n}`).join(' · ');
    let hpS = 0, hpM = 0; for (const u of sel) { hpS += u.hp; hpM += u.maxhp; }
    hp.firstElementChild.style.width = clamp(hpS / hpM * 100, 0, 100) + '%';
    for (const u of sel.slice(0, 36)) {
      const b2 = document.createElement('button'); b2.className = 'gi'; b2.title = UT[u.type].name;
      b2.innerHTML = `<img src="${UI.icons['u_' + u.type]}" alt=""><span class="h" style="width:${u.hp / u.maxhp * 36}px"></span>`;
      b2.onclick = ev => { if (ev.shiftKey) setSel(UI.sel.filter(x => x !== u)); else setSel([u]); };
      group.appendChild(b2);
    }
  }
  renderCmds();
}
function hud() {
  const tm = G.teams[0]; if (!tm) return;
  const counts = [0, 0, 0, 0];
  let idle = 0;
  for (const u of G.units) if (u.team === 0 && u.d.cls === 'worker') { if (u.state === 'gather' && u.job) counts[RES_OF[u.job.kind]]++; else if (u.state === 'idle') idle++; }
  for (let i = 0; i < 4; i++) { const el = $('#r' + i); el.querySelector('b').textContent = Math.floor(tm.res[i]); el.querySelector('small').textContent = counts[i] ? '· ' + counts[i] : ''; el.classList.toggle('low', tm.res[i] < 50); }
  const p = $('#rp'); p.querySelector('b').textContent = `${tm.pop}/${Math.min(tm.popCap, 250)}`; p.classList.toggle('low', tm.pop >= tm.popCap);
  const m = Math.floor(G.t / 60), s = Math.floor(G.t % 60); $('#clock').textContent = `${m}:${String(s).padStart(2, '0')}`;
  $('#idle-n').textContent = idle; $('#idle-n').hidden = !idle;
}

// ---------- input ----------
function setupInput() {
  const cv = $('#game');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousemove', e => {
    UI.mouse.x = e.clientX; UI.mouse.y = e.clientY; UI.mouse.in = true;
    if (UI.mid) { CAM.tyaw -= (e.clientX - UI.mid.x) * 0.006; UI.mid.x = e.clientX; return; }
    if (UI.box) { UI.box.x1 = e.clientX; UI.box.y1 = e.clientY; if (hyp(UI.box.x1 - UI.box.x0, UI.box.y1 - UI.box.y0) > 6) UI.box.active = true; }
    if (UI.drag) { const g = groundAt(e.clientX, e.clientY); if (g) UI.drag.b = g; if (hyp(e.clientX - UI.drag.sx, e.clientY - UI.drag.sy) > 14) UI.drag.active = true; }
    if (UI.place) updatePlaceFromMouse();
  });
  cv.addEventListener('mouseleave', () => { UI.mouse.in = false; });
  cv.addEventListener('mousedown', e => {
    cv.focus();
    ensureAudio();
    if (G.over && !UI.watch) return;
    if (e.button === 1) { e.preventDefault(); UI.mid = { x: e.clientX }; return; }
    if (e.button === 0) {
      if (UI.place) { confirmPlace(e.shiftKey); return; }
      if (UI.amode) { attackMoveTo(e.clientX, e.clientY); if (!e.shiftKey) UI.amode = false; UI.cmdSig = ''; return; }
      UI.box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, active: false, shift: e.shiftKey };
    }
    if (e.button === 2) {
      if (UI.place) { UI.place = null; return; }
      if (UI.amode) { UI.amode = false; UI.cmdSig = ''; return; }
      const g = groundAt(e.clientX, e.clientY);
      UI.drag = { sx: e.clientX, sy: e.clientY, a: g, b: g, active: false };
    }
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 1) { UI.mid = null; return; }
    if (e.button === 0 && UI.box) {
      const b = UI.box; UI.box = null;
      if (b.active) boxSelect(b, b.shift);
      else {
        const now = performance.now();
        const dbl = now - UI.lastClick.t < 320 && hyp(e.clientX - UI.lastClick.x, e.clientY - UI.lastClick.y) < 8;
        UI.lastClick = { t: now, x: e.clientX, y: e.clientY };
        clickSelect(e.clientX, e.clientY, b.shift, dbl);
      }
    }
    if (e.button === 2 && UI.drag) {
      const d = UI.drag; UI.drag = null;
      if (d.active && d.a && d.b && mine().length > 1) formationPreview(d.a, d.b, true);
      else smartCommand(e.clientX, e.clientY, e.shiftKey);
    }
  });
  cv.addEventListener('wheel', e => { e.preventDefault(); CAM.tdist = clamp(CAM.tdist * (e.deltaY > 0 ? 1.13 : 0.885), CAM.minD, CAM.maxD); }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT')) return;
    UI.keys[e.key] = true;
    if ($('#start').hidden === false || (!$('#end').hidden && !UI.watch)) return;
    const k = e.key;
    if (k === 'Escape') {
      if (UI.place) UI.place = null; else if (UI.amode) { UI.amode = false; UI.cmdSig = ''; } else if (UI.sel.length) setSel([]); else togglePause(true);
      return;
    }
    if (k === 'F10') { togglePause(true); e.preventDefault(); return; }
    if (/^[0-9]$/.test(k)) {
      const n = +k;
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); UI.groups[n] = mine().map(u => u.id); toast(`Group ${n} set`, ''); return; }
      const ids = UI.groups[n]; if (!ids) return;
      const units = G.units.filter(u => ids.includes(u.id));
      if (!units.length) return;
      const now = performance.now();
      if (UI.lastGroup.k === n && now - UI.lastGroup.t < 400) { let x = 0, z = 0; for (const u of units) { x += u.x; z += u.z; } centerOn(x / units.length, z / units.length); }
      UI.lastGroup = { k: n, t: now };
      setSel(units); return;
    }
    if (k === '.') { idleNext(); return; }
    if (k === ',') { armyAll(); return; }
    if (k === ' ') { if (UI.lastAlert) centerOn(UI.lastAlert.x, UI.lastAlert.z); e.preventDefault(); return; }
    if (k === '[') { CAM.tyaw += 0.35; return; }
    if (k === ']') { CAM.tyaw -= 0.35; return; }
    if (k === '+' || k === '=') { UI.speedI = Math.min(UI.speeds.length - 1, UI.speedI + 1); setSpeed(); return; }
    if (k === '-') { UI.speedI = Math.max(0, UI.speedI - 1); setSpeed(); return; }
    if (k === 'Delete' || k === 'Insert') return;
    const up = k.toUpperCase();
    const units = mine();
    const army = units.length && !units.every(u => u.d.cls === 'worker');
    if (army && up === 'A') { UI.amode = true; UI.place = null; UI.cmdSig = ''; return; }
    if (army && up === 'S') { orderStop(units); return; }
    if (army && up === 'H') { orderHold(units); return; }
    if (up === 'H' && !units.length) { const th = G.builds.find(b => b.team === 0 && b.type === 'townhall'); if (th) { centerOn(th.x, th.z + 2); setSel([th]); } return; }
    const i = GRID_KEYS.indexOf(up);
    if (i >= 0 && UI.cmds && UI.cmds[i]) { runCmd(UI.cmds[i], e.shiftKey); }
  });
  window.addEventListener('keyup', e => { UI.keys[e.key] = false; });
  window.addEventListener('blur', () => { UI.keys = {}; UI.mouse.in = false; });
  // minimap
  const mini = $('#mini');
  const miniAct = e => { const r = mini.getBoundingClientRect(); const p = miniToWorld((e.clientX - r.left) / r.width * mini.width, (e.clientY - r.top) / r.height * mini.height); return p; };
  mini.addEventListener('contextmenu', e => e.preventDefault());
  mini.addEventListener('mousedown', e => {
    const p = miniAct(e);
    if (e.button === 0) { centerOn(p.x, p.z); UI.miniDrag = true; }
    if (e.button === 2 && mine().length) { orderMove(mine(), clamp(p.x, 1, N - 1), clamp(p.z, 1, N - 1), {}); markAt(p.x, p.z, '#9ff5c0'); sfx('order'); }
  });
  mini.addEventListener('mousemove', e => { if (UI.miniDrag && e.buttons & 1) { const p = miniAct(e); centerOn(p.x, p.z); } });
  window.addEventListener('mouseup', () => { UI.miniDrag = false; });
  $('#btn-idle').addEventListener('click', idleNext);
  $('#btn-army').addEventListener('click', armyAll);
  $('#btn-speed').addEventListener('click', () => { UI.speedI = (UI.speedI + 1) % UI.speeds.length; setSpeed(); });
  $('#btn-menu').addEventListener('click', () => togglePause(true));
}
function setSpeed() { G.speed = UI.speeds[UI.speedI]; $('#btn-speed').textContent = G.speed + '×'; }
function idleNext() {
  const idle = G.units.filter(u => u.team === 0 && u.d.cls === 'worker' && u.state === 'idle');
  if (!idle.length) { toast('Every peasant is at work'); return; }
  UI.idleI = ((UI.idleI || 0) + 1) % idle.length;
  const u = idle[UI.idleI]; setSel([u]); centerOn(u.x, u.z); sfx('select');
}
function armyAll() { const a = G.units.filter(u => u.team === 0 && u.d.cls !== 'worker'); if (a.length) { setSel(a); sfx('select'); } else toast('You have no soldiers yet. Build a Barracks'); }
function edgeScroll(dt) {
  let dx = 0, dz = 0;
  const m = UI.mouse, e = 6;
  if (UI.keys.ArrowLeft) dx -= 1; if (UI.keys.ArrowRight) dx += 1; if (UI.keys.ArrowUp) dz -= 1; if (UI.keys.ArrowDown) dz += 1;
  if (m.in && document.hasFocus() && !UI.box && !UI.mid) { if (m.x < e) dx -= 1; if (m.x > VW - e) dx += 1; if (m.y < e) dz -= 1; if (m.y > VH - e) dz += 1; }
  if (!dx && !dz) return;
  const sp = CAM.dist * 1.15 * dt;
  // screen right/up mapped to the ground through the camera yaw
  const rx = Math.cos(CAM.yaw), rz = -Math.sin(CAM.yaw), fx = -Math.sin(CAM.yaw), fz = -Math.cos(CAM.yaw);
  CAM.tx += (rx * dx - fx * dz) * sp; CAM.tz += (rz * dx - fz * dz) * sp;
  clampCam();
  if (UI.place) updatePlaceFromMouse();
}
