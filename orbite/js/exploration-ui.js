/* ORBITE — écran d'expédition : le rover explorateur sort de la colonie et le monde se génère
 * autour de lui, tronçon par tronçon (ils sortent du sol en s'élevant), avec son relief et ses
 * découvertes. Les règles sont dans exploration.js. */
(function () {
  'use strict';
  const O = window.__orbite;
  if (!O) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const E = window.OrbiteBuildings, R = window.OrbiteBuildingRenderer, X = window.OrbiteExploration, C = window.OrbiteColonie;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const { icon } = A;
  const LOAD = 3; // rayon de chargement, en tronçons
  const RISE = 420; // durée de l'apparition d'un tronçon (ms)

  const ex = { col: null, w: null, found: null, chunks: new Map(), queue: [], rover: null, path: [], bat: 0, max: 0, scale: 3, cam: null, raf: 0, last: 0, sprites: {}, hintOff: false };

  const batteryMax = (col) => X.BATTERY.max + 40 * col.built.filter((b) => b.key === 'batteries').length;
  const hasRover = (col) => col.built.some((b) => b.key === 'rover' || b.key === 'garage');

  // ─── Rendu ──────────────────────────────────────────────────
  // Rover : petit modèle rendu une fois par direction.
  function sprite(dir, cargo) {
    const k = dir + ':' + (cargo || '');
    if (!ex.sprites[k]) {
      const m = E.model(8, 8, 6);
      for (const v of C.roverVoxels({ x: 3, y: 3, dir, cargo, moving: false }, 0, true)) m.set(Math.round(v.x), Math.round(v.y), v.z, v.k);
      ex.sprites[k] = R.render(m, { theme: ex.col.theme, accent: 'orange' });
    }
    return ex.sprites[k];
  }
  function chunkCanvas(cx, cy) {
    const m = X.chunk(ex.w, cx, cy, ex.found);
    return R.render(m, { theme: ex.col.theme, accent: 'orange' });
  }
  // Charge les tronçons autour du rover, les plus proches d'abord (deux par image au plus).
  function stream(now) {
    const ccx = Math.floor(ex.rover.x / X.CHUNK), ccy = Math.floor(ex.rover.y / X.CHUNK);
    const want = [];
    for (let dy = -LOAD; dy <= LOAD; dy++) for (let dx = -LOAD; dx <= LOAD; dx++) {
      const k = (ccx + dx) + ',' + (ccy + dy);
      if (!ex.chunks.has(k)) want.push([Math.abs(dx) + Math.abs(dy), ccx + dx, ccy + dy, k]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cy, k] of want.slice(0, 2)) {
      ex.chunks.set(k, { cx, cy, cv: chunkCanvas(cx, cy), born: now });
      const seen = ex.col.explore.seen;
      if (!seen.includes(k) && seen.length < 4000) seen.push(k);
    }
    // On oublie les tronçons lointains.
    for (const [k, c] of ex.chunks) if (Math.abs(c.cx - ccx) > LOAD + 2 || Math.abs(c.cy - ccy) > LOAD + 2) ex.chunks.delete(k);
  }
  const groundZ = (x, y) => X.height(ex.w, Math.round(x), Math.round(y));
  function draw(now) {
    const cv = $('exCanvas'), v = $('exView');
    const W = Math.ceil(v.clientWidth / ex.scale), H = Math.ceil(v.clientHeight / ex.scale);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07060a';
    ctx.fillRect(0, 0, W, H);
    // Caméra : suit le rover en douceur.
    const r = ex.rover, rz = groundZ(r.x, r.y);
    const tx = (r.x - r.y) * 2 - W / 2, ty = (r.x + r.y) - 2 * rz - H / 2;
    if (!ex.cam) ex.cam = { x: tx, y: ty };
    ex.cam.x += (tx - ex.cam.x) * 0.12; ex.cam.y += (ty - ex.cam.y) * 0.12;
    const list = [...ex.chunks.values()].sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
    const ox = X.CHUNK * 2, oy = X.ZMAX * 2 + 2;
    for (const c of list) {
      const X0 = c.cx * X.CHUNK, Y0 = c.cy * X.CHUNK;
      const px = Math.round((X0 - Y0) * 2 - ox - ex.cam.x), py = Math.round((X0 + Y0) - oy - ex.cam.y);
      if (px > W || py > H || px + c.cv.width < 0 || py + c.cv.height < 0) continue;
      // Apparition : le tronçon monte du sol et s'éclaircit.
      const k = Math.min(1, (now - c.born) / RISE), e = 1 - Math.pow(1 - k, 3);
      ctx.globalAlpha = e;
      ctx.drawImage(c.cv, px, py + Math.round((1 - e) * 18));
    }
    ctx.globalAlpha = 1;
    // Le rover, puis un repère sur sa destination.
    const sp = sprite(r.dir, null);
    ctx.drawImage(sp, Math.round((r.x - r.y) * 2 - 16 - ex.cam.x), Math.round((r.x + r.y) - 7 - 2 * rz - 14 - ex.cam.y));
    const goal = ex.path[ex.path.length - 1];
    if (goal && ex.path.length) {
      const gz = groundZ(goal[0], goal[1]);
      const gx = Math.round((goal[0] - goal[1]) * 2 + 2 - ex.cam.x), gy = Math.round((goal[0] + goal[1]) - 2 * gz + 1 - ex.cam.y);
      ctx.fillStyle = (now % 600) < 300 ? '#ffe27a' : '#ff8a3a';
      ctx.fillRect(gx - 1, gy - 6, 2, 6);
      ctx.fillRect(gx - 3, gy, 6, 1);
    }
  }

  // ─── Déplacement ────────────────────────────────────────────
  function move(dt) {
    const r = ex.rover;
    let step = X.SPEED * dt;
    while (step > 0 && ex.path.length) {
      const [nx, ny] = ex.path[0];
      const dx = nx - r.x, dy = ny - r.y, d = Math.abs(dx) + Math.abs(dy);
      if (d < 1e-6) { ex.path.shift(); continue; }
      r.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
      const k = Math.min(step, d);
      r.x += dx / d * k; r.y += dy / d * k;
      step -= k;
      ex.bat -= k * X.BATTERY.perTile;
      if (d - k < 1e-6) ex.path.shift();
      if (ex.bat <= 0) { ex.bat = 0; ex.path = []; empty(); break; }
    }
  }
  function look() {
    // Découvertes à portée du rover.
    const r = ex.rover;
    for (const c of ex.chunks.values()) {
      const p = X.poi(ex.w, c.cx, c.cy);
      if (!p || ex.found.has(p.id) || Math.abs(p.x - r.x) + Math.abs(p.y - r.y) > 2.5) continue;
      const res = X.collect(ex.col, p);
      if (!res) continue;
      ex.found.add(p.id);
      if (res.gain.dust) A.addDust(res.gain.dust);
      window.OrbiteColonieUI.save();
      c.cv = chunkCanvas(c.cx, c.cy);
      const g = res.gain, parts = [];
      if (g.materials) parts.push(tr('+{n} matériaux', { n: g.materials }));
      if (g.water) parts.push(tr('+{n} eau', { n: g.water }));
      if (g.research) parts.push(tr('+{n} recherche', { n: g.research }));
      if (g.dust) parts.push(tr('+{n} poussières d’étoiles', { n: g.dust }));
      SFX.level();
      A.vibrate(25);
      const b = $('exCanvas').getBoundingClientRect();
      const sx = b.left + ((p.x - p.y) * 2 - ex.cam.x) * ex.scale, sy = b.top + ((p.x + p.y) - 2 * groundZ(p.x, p.y) - ex.cam.y) * ex.scale;
      stage.burst(sx, sy, { n: 46, colors: [[255, 226, 140], [255, 255, 255], [140, 220, 255]], speed: 70, up: 40, life: 1 });
      A.toast(`${tr(res.type.name)} · ${parts.join(' · ')}`, 3000);
      hud();
    }
  }
  function hud() {
    const r = ex.rover;
    const dist = Math.round(Math.hypot(r.x - 64, r.y - 64));
    $('exBatBar').style.width = (ex.bat / ex.max * 100).toFixed(1) + '%';
    $('exBatBar').classList.toggle('low', ex.bat < ex.max * 0.2);
    $('exBatTxt').textContent = tr('Batterie {n} %', { n: Math.round(ex.bat / ex.max * 100) });
    $('exDist').textContent = tr('{n} cases de la base', { n: dist });
    $('exFound').textContent = tr('{n} découvertes', { n: ex.col.explore.found.length });
  }
  function frame(now) {
    if (!document.getElementById('explore').classList.contains('active')) { ex.raf = 0; return; }
    const dt = Math.min(0.1, (now - (ex.last || now)) / 1000);
    ex.last = now;
    if (ex.path.length) { move(dt); look(); if (now - (ex.hudAt || 0) > 150) { ex.hudAt = now; hud(); } }
    stream(now);
    draw(now);
    ex.raf = requestAnimationFrame(frame);
  }

  // Toucher : la case visée (on corrige selon la hauteur du relief), puis le chemin du rover.
  function pick(clientX, clientY) {
    const b = $('exCanvas').getBoundingClientRect();
    const u = (clientX - b.left) / ex.scale + ex.cam.x, v = (clientY - b.top) / ex.scale + ex.cam.y;
    const d = (u - 2) / 2;
    let z = groundZ(ex.rover.x, ex.rover.y) - 1, x = 0, y = 0;
    for (let i = 0; i < 5; i++) {
      const s = v - 1 + 2 * z;
      x = Math.round((s + d) / 2); y = Math.round((s - d) / 2);
      z = X.height(ex.w, x, y) - 1;
    }
    return [x, y];
  }
  function go(clientX, clientY) {
    if (ex.bat <= 0) return;
    const [x, y] = pick(clientX, clientY);
    const from = [Math.round(ex.rover.x), Math.round(ex.rover.y)];
    const p = X.path(ex.w, from, [x, y]);
    if (p.pts.length < 2) { A.refuse(tr('Le rover ne peut pas monter jusque-là.')); return; }
    ex.path = p.pts.slice(1);
    if (!p.reached) A.toast(tr('Trop raide : le rover s’approche au plus près.'), 1800);
    SFX.tap();
    if (!ex.hintOff) { ex.hintOff = true; $('exHint').hidden = true; }
  }
  function empty() {
    SFX.sell();
    A.openSheet(`<h3>${tr('EXPÉDITION')}</h3><h2>${tr('Batterie vide')}</h2>
      <p class="sheet-text">${tr('Le rover est remorqué jusqu’à la base, où il se recharge. Des banques de batteries dans la colonie lui donnent plus d’autonomie.')}</p>
      <div class="sheet-actions"><button class="btn primary" data-act="close" id="exTow">${tr('RETOUR À LA BASE')}</button></div>`);
    $('exTow').addEventListener('click', () => setTimeout(back, 50));
  }

  // ─── Ouverture ──────────────────────────────────────────────
  async function open(col) {
    if (!hasRover(col)) { A.refuse(tr('Construisez un rover (onglet Logistique) pour explorer les environs.')); return; }
    ex.col = col;
    col.explore = col.explore || { found: [], seen: [], trips: 0 };
    if (!Array.isArray(col.explore.seen)) col.explore.seen = [];
    col.explore.trips = (col.explore.trips || 0) + 1;
    ex.w = X.world(col.seed);
    ex.found = new Set(col.explore.found);
    ex.chunks.clear();
    ex.sprites = {};
    ex.rover = { x: X.START.x, y: X.START.y, dir: 0 };
    ex.path = [];
    ex.cam = null;
    ex.max = batteryMax(col);
    ex.bat = ex.max;
    ex.last = 0;
    $('exHint').hidden = false;
    ex.hintOff = false;
    SFX.whoosh(0);
    await A.show('explore');
    stage.sky = 0;
    hud();
    cancelAnimationFrame(ex.raf);
    ex.raf = requestAnimationFrame(frame);
    if (A.store.get('orbite.expedition', '') !== '1') {
      A.store.set('orbite.expedition', '1');
      setTimeout(() => A.toast(tr('Le monde se dévoile à mesure que le rover avance. Les découvertes brillent ; la batterie se recharge à la base.'), 4200), 900);
    }
  }
  async function back() {
    cancelAnimationFrame(ex.raf);
    ex.raf = 0;
    window.OrbiteColonieUI.save();
    SFX.tap();
    await window.OrbiteColonieUI.resume();
  }

  // ─── Événements ─────────────────────────────────────────────
  $('exBack').innerHTML = icon('back');
  $('exBack').addEventListener('click', back);
  $('exHome').addEventListener('click', () => { SFX.tap(); const p = X.path(ex.w, [Math.round(ex.rover.x), Math.round(ex.rover.y)], [X.START.x, X.START.y], 20000); ex.path = p.pts.slice(1); });
  $('exZoomIn').addEventListener('click', () => { ex.scale = Math.min(6, ex.scale + 1); ex.cam = null; SFX.tap(); });
  $('exZoomOut').addEventListener('click', () => { ex.scale = Math.max(1, ex.scale - 1); ex.cam = null; SFX.tap(); });
  let down = null;
  $('exView').addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) down = { x: e.clientX, y: e.clientY }; });
  $('exView').addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 12;
    down = null;
    if (!moved) go(e.clientX, e.clientY);
  });

  window.OrbiteExplorationUI = { open, back, hasRover, get state() { return ex; } };
})();
