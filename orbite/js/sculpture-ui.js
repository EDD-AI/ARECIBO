/* ORBITE — écran de la Sculpture (Genèse, ère II, chapitre 3). L'astre, en grand et en pixel art,
 * tourne sur lui-même : silhouette bosselée tant qu'il n'est pas rond, relief éclairé, mers d'eau
 * ou de lave, glace, volcans, nuages. Un outil à la fois, au doigt. Les règles sont dans sculpture.js. */
(function () {
  'use strict';
  const O = window.__orbite, S = window.OrbiteSculpture;
  if (!O || !S) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const { esc } = A;
  const KEY = 'orbite.genese.sculpture';
  const PX = 112, R = 44, CX = PX / 2, CY = PX / 2;
  const { W, H } = S;

  const ui = { s: null, raf: 0, last: 0, yaw: 0, tilt: 0.32, tool: 'tourner', touch: null, hudAt: 0, saveAt: 0, ended: false,
    img: null, hbuf: new Float32Array(PX * PX), mbuf: new Int16Array(PX * PX), parts: [], flash: 0 };

  // ─── Couleurs selon la nature de l'astre (ère I) ────────────
  const ROCK = {
    eau: [[54, 62, 76], [84, 96, 112], [122, 134, 150], [170, 180, 194]],
    feu: [[48, 30, 28], [84, 50, 40], [124, 76, 56], [168, 112, 80]],
    etoile: [[58, 46, 74], [88, 72, 108], [124, 104, 146], [166, 148, 186]],
    vie: [[64, 48, 36], [104, 80, 56], [146, 116, 80], [190, 160, 116]]
  };
  const WATER = [[18, 40, 90], [30, 70, 140], [52, 110, 190]];
  const LAVA = [[150, 40, 20], [230, 100, 30], [255, 190, 80]];
  const ICE = [[170, 200, 225], [215, 235, 248], [250, 254, 255]];
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

  // Rotation : vue → monde (inclinaison puis lacet), et l'inverse.
  function toWorld(x, y, z) {
    const ct = Math.cos(ui.tilt), st = Math.sin(ui.tilt);
    const y1 = y * ct - z * st, z1 = y * st + z * ct;
    const cy = Math.cos(ui.yaw), sy = Math.sin(ui.yaw);
    return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
  }
  const cellOf = (p) => {
    const lon = Math.atan2(p[0], p[2]), lat = Math.asin(Math.max(-1, Math.min(1, p[1])));
    const i = Math.min(W - 1, Math.max(0, Math.floor((lon + Math.PI) / (Math.PI * 2) * W)));
    const j = Math.min(H - 1, Math.max(0, Math.floor((Math.PI / 2 - lat) / Math.PI * H)));
    return { k: j * W + i, lon, lat };
  };
  // Silhouette : rayon du bord selon l'angle (bosselé tant que l'astre n'est pas rond).
  function limbs() {
    const s = ui.s, out = new Float32Array(96);
    for (let a = 0; a < 96; a++) {
      const th = a / 96 * Math.PI * 2;
      const c = cellOf(toWorld(Math.cos(th), Math.sin(th), 0));
      out[a] = Math.max(0.78, Math.min(1.24, 1 + 1.1 * s.forme[c.k] + 0.15 * s.relief[c.k]));
    }
    return out;
  }

  function draw(now) {
    const s = ui.s, cv = $('scCanvas');
    if (cv.width !== PX) { cv.width = PX; cv.height = PX; }
    const ctx = cv.getContext('2d');
    if (!ui.img) ui.img = ctx.createImageData(PX, PX);
    const d = ui.img.data;
    d.fill(0);
    const lim = limbs(), rock = ROCK[s.nature] || ROCK.vie;
    const seas = S.result(s).seas;
    const L = [-0.62, 0.5, 0.6]; // lumière (vue) : de gauche, un peu d'en haut
    const hb = ui.hbuf, mb = ui.mbuf;
    // Première passe : hauteur et case visée par chaque pixel.
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
      const p = y * PX + x, dx = (x + 0.5 - CX) / R, dy = (y + 0.5 - CY) / R, dd = Math.hypot(dx, dy);
      let a = Math.round((Math.atan2(-dy, dx) / (Math.PI * 2)) * 96);
      a = ((a % 96) + 96) % 96;
      const lm = lim[a];
      if (dd > lm) { mb[p] = -1; continue; }
      const u = dx / lm, v = dy / lm, z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      const c = cellOf(toWorld(u, -v, z));
      mb[p] = c.k;
      hb[p] = S.height(s, c.k);
    }
    // Seconde passe : couleur, éclairage du relief (différences entre pixels voisins), tramage.
    const clouds = s.core.air === 'primitive';
    for (let y = 0; y < PX; y++) for (let x = 0; x < PX; x++) {
      const p = y * PX + x, k = mb[p];
      if (k < 0) continue;
      const dx = (x + 0.5 - CX) / R, dy = (y + 0.5 - CY) / R;
      const u = dx, v = dy, z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
      let lam = Math.max(0, u * L[0] - v * L[1] + z * L[2]);
      const hx = (mb[p + 1] >= 0 ? hb[p + 1] : hb[p]) - (mb[p - 1] >= 0 ? hb[p - 1] : hb[p]);
      const hy = (mb[p + PX] >= 0 ? hb[p + PX] : hb[p]) - (mb[p - PX] >= 0 ? hb[p - PX] : hb[p]);
      lam = Math.max(0, Math.min(1.2, lam + (-hx * L[0] * 6 + hy * L[1] * 6)));
      const relief = s.relief[k], mat = s.mat[k];
      let col;
      if (mat === S.LAVA) col = LAVA[(Math.floor(now / 160) + k) % 3];
      else if (relief < S.SEA && seas === 'eau') col = mix(WATER[0], WATER[2], Math.max(0, Math.min(1, (relief + 0.5) / 0.4)));
      else if (relief < S.SEA && seas === 'lave') col = LAVA[relief < -0.2 ? 1 : 0];
      else if (mat === S.ICE) col = ICE[lam > 0.7 ? 2 : lam > 0.35 ? 1 : 0];
      else {
        const h = hb[p] + 0.25, band = h < 0.18 ? 0 : h < 0.3 ? 1 : h < 0.45 ? 2 : 3;
        col = rock[band];
      }
      const t = lam + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.18;
      const shade = t < 0.18 ? 0.35 : t < 0.42 ? 0.6 : t < 0.72 ? 0.85 : 1.05;
      let r = col[0] * shade, g = col[1] * shade, b = col[2] * shade;
      // Lave et mers de lave luisent dans l'ombre.
      if (mat === S.LAVA || (relief < S.SEA && seas === 'lave')) { r = Math.max(r, col[0] * 0.8); g = Math.max(g, col[1] * 0.6); }
      // Nuages : des bancs qui dérivent (seulement avec une atmosphère).
      if (clouds) {
        const c = cellOf(toWorld(u, -v, z));
        const n = Math.sin(c.lon * 3 + now / 4000) * Math.cos(c.lat * 4 + now / 7000) + Math.sin(c.lon * 7 - now / 3000) * 0.4;
        if (n > 0.75) { const a = Math.min(0.7, (n - 0.75) * 2.4) * (0.4 + 0.6 * lam); r += (240 - r) * a; g += (245 - g) * a; b += (255 - b) * a; }
      }
      const q = p * 4;
      d[q] = r; d[q + 1] = g; d[q + 2] = b; d[q + 3] = 255;
    }
    ctx.putImageData(ui.img, 0, 0);
    // Halo d'atmosphère (une fois l'astre presque rond).
    if (s.core.air === 'primitive' && S.roundness(s) > 0.6) {
      ctx.strokeStyle = 'rgba(150,190,255,0.35)';
      ctx.beginPath(); ctx.arc(CX, CY, R + 2.5, Math.PI * 0.55, Math.PI * 1.55); ctx.stroke();
    }
    // Éclats d'impact.
    for (let i = ui.parts.length - 1; i >= 0; i--) {
      const q = ui.parts[i];
      q.life -= 1 / 60;
      if (q.life <= 0) { ui.parts.splice(i, 1); continue; }
      q.x += q.vx / 60; q.y += q.vy / 60; q.vy += 20 / 60;
      ctx.fillStyle = q.c;
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillRect(Math.round(q.x), Math.round(q.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    if (ui.flash > 0) { ctx.fillStyle = `rgba(255,240,200,${ui.flash * 0.4})`; ctx.fillRect(0, 0, PX, PX); ui.flash = Math.max(0, ui.flash - 0.06); }
    // Le pinceau.
    if (ui.touch && ui.touch.in && ui.tool !== 'tourner') {
      const rad = { impact: 0.3, soulever: 0.2, lisser: 0.55, volcan: 0.16, glace: 0.18 }[ui.tool] * R;
      ctx.fillStyle = 'rgba(255,240,200,0.8)';
      for (let k = 0; k < 24; k += 2) { const a = k / 24 * Math.PI * 2 + now / 500; ctx.fillRect(Math.round(ui.touch.px + Math.cos(a) * rad), Math.round(ui.touch.py + Math.sin(a) * rad), 1, 1); }
    }
  }

  // ─── Boucle ─────────────────────────────────────────────────
  function frame(now) {
    if (!$('sculpture').classList.contains('active')) { ui.raf = 0; return; }
    ui.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - (ui.last || now)) / 1000);
    ui.last = now;
    const s = ui.s;
    if (!document.hidden && !ui.ended) {
      S.step(s, dt);
      if (!ui.touch) ui.yaw += dt * 0.12;
      // Outils maintenus : on sculpte tant que le doigt reste sur l'astre.
      if (ui.touch && ui.touch.in && ['soulever', 'lisser', 'glace'].includes(ui.tool)) {
        if (S.apply(s, ui.tool, ui.touch.lon, ui.touch.lat, dt) && now - (ui.sfxAt || 0) > 400) { ui.sfxAt = now; SFX.place(); }
      }
      s.events.length = 0;
      if (now - ui.saveAt > 5000) { ui.saveAt = now; save(); }
    }
    draw(now);
    if (now - ui.hudAt > 300) { ui.hudAt = now; hud(); }
  }
  const TOOL_INFO = {
    tourner: ['✋', 'Tourner'], impact: ['☄', 'Impact'], soulever: ['⛰', 'Soulever'], lisser: ['〰', 'Lisser'], volcan: ['🜂', 'Volcan'], glace: ['❄', 'Glace']
  };
  function tools() {
    const av = S.avail(ui.s);
    $('scTools').innerHTML = S.TOOLS.map((t) => `<button class="sc-tool ${ui.tool === t ? 'on' : ''}" data-tool="${t}" ${av[t] ? '' : 'disabled'}><span>${TOOL_INFO[t][0]}</span><small>${esc(tr(TOOL_INFO[t][1]))}</small></button>`).join('');
  }
  function hud() {
    const s = ui.s, g = S.goals(s);
    $('scGoals').innerHTML = g.map((x) => `<li class="${x.ok ? 'ok' : ''}"><i>${x.ok ? '✓' : ''}</i><span>${esc(tr(x.text))}</span><b>${x.pct ? Math.round(x.value * 100) + ' / ' + Math.round(x.goal * 100) + ' %' : x.value + (x.unit || '') + ' / ' + x.goal + (x.unit || '')}</b></li>`).join('');
    const done = S.canFinish(s);
    $('scDone').disabled = !done;
    $('scDone').textContent = done ? tr('C’EST UNE PLANÈTE') : tr('ATTEIGNEZ LES OBJECTIFS');
    const av = S.avail(s);
    for (const b of $('scTools').children) b.disabled = !av[b.dataset.tool];
  }

  // ─── Bilan et fin du chapitre ───────────────────────────────
  async function finish() {
    if (ui.ended) return;
    ui.ended = true;
    const s = ui.s, r = S.result(s);
    s.done = true;
    s.result = r;
    save();
    SFX.win();
    const seasTxt = { eau: 'Ses bassins deviendront des mers.', lave: 'Ses bassins sont des mers de lave.', secs: 'Ses bassins restent secs, pour l’instant.' }[r.seas];
    $('scBilan').innerHTML = `<h3>${tr('VOTRE ASTRE EST UNE PLANÈTE')}</h3>
      <ul class="co-list"><li class="glace">${esc(tr('Elle est ronde : la gravité a gagné.'))}</li><li class="fer">${esc(tr(seasTxt))}</li>
      <li class="lave">${esc(r.volcans ? tr('Volcans : {n}', { n: r.volcans }) : tr('Aucun volcan.'))}</li></ul>
      <button class="btn primary" id="scNext">${tr('CONTINUER')}</button>`;
    $('scBilan').hidden = false;
    $('scNext').addEventListener('click', outro, { once: true });
  }
  async function outro() {
    SFX.tap();
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    A.addSeeds(3);
    const Rc = window.OrbiteRecit;
    if (Rc) {
      await Rc.openStory();
      await Rc.wait(600);
      await Rc.tell([tr('Le rocher s’est arrondi. Ses bassins attendent, ses montagnes veillent.'), tr('Mais au loin, quelque chose de très grand approche.')]);
      await Rc.title(tr('CHAPITRE 4'), tr('LE GRAND IMPACT · BIENTÔT'));
      await Rc.wait(2600);
    }
    A.toast(tr('+3 graines de vie'), 2200);
    await A.backToMenu();
  }

  // ─── Sauvegarde, ouverture ──────────────────────────────────
  function save() {
    if (!ui.s) return;
    const o = S.serialize(ui.s);
    if (ui.s.result) o.result = ui.s.result;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (err) { /* stockage indisponible */ }
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      const s = S.restore(o);
      if (s && o.result) s.result = o.result;
      return s;
    } catch (err) { return null; }
  }
  async function open(s) {
    ui.s = s || load();
    if (!ui.s) return;
    ui.ended = false; ui.last = 0; ui.touch = null; ui.tool = 'tourner'; ui.parts = [];
    $('scBilan').hidden = true;
    save();
    await A.show('sculpture');
    stage.sky = 0;
    tools();
    hud();
    cancelAnimationFrame(ui.raf);
    ui.raf = requestAnimationFrame(frame);
    setTimeout(() => hint('start'), 600);
  }
  async function leave() {
    SFX.tap();
    save();
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    await A.backToMenu();
  }
  const HINTS = {
    start: 'Choisissez un outil en bas, puis touchez l’astre. ✋ le fait tourner pour atteindre l’autre face.',
    lisser: 'Lisser : la gravité rapproche votre rocher de la sphère. Passez sur toute sa surface.'
  };
  function hint(k) {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(KEY + '.aide') || '{}'); } catch (err) { /* illisible */ }
    if (seen[k]) return;
    seen[k] = 1;
    try { localStorage.setItem(KEY + '.aide', JSON.stringify(seen)); } catch (err) { /* stockage indisponible */ }
    const el = $('scHint');
    el.textContent = tr(HINTS[k]);
    el.classList.add('show');
    clearTimeout(hint.t);
    hint.t = setTimeout(() => el.classList.remove('show'), 5600);
  }

  // ─── Commandes ──────────────────────────────────────────────
  const cv = $('scCanvas');
  // Point de l'écran → pixel de la toile → point de l'astre (ou rien, hors de la sphère).
  function pick(ev) {
    const b = cv.getBoundingClientRect();
    const px = (ev.clientX - b.left) / b.width * PX, py = (ev.clientY - b.top) / b.height * PX;
    const u = (px - CX) / R, v = (py - CY) / R, dd = Math.hypot(u, v);
    if (dd > 1) return { px, py, in: false };
    const z = Math.sqrt(1 - dd * dd), c = cellOf(toWorld(u, -v, z));
    return { px, py, in: true, lon: c.lon, lat: c.lat };
  }
  cv.addEventListener('pointerdown', (ev) => {
    if (ui.ended) return;
    const p = pick(ev);
    ui.touch = Object.assign({ id: ev.pointerId, x: ev.clientX, y: ev.clientY }, p);
    if (!p.in || ui.tool === 'tourner') return;
    if (ui.tool === 'impact' || ui.tool === 'volcan') {
      if (S.apply(ui.s, ui.tool, p.lon, p.lat, 0)) {
        ui.flash = ui.tool === 'impact' ? 1 : 0.5;
        if (ui.tool === 'impact') SFX.hit(2); else SFX.explode();
        if (A.vibrate) A.vibrate(30);
        for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, sp = 10 + Math.random() * 30; ui.parts.push({ x: p.px, y: p.py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, life: 0.8, c: ui.tool === 'volcan' ? '#ffb040' : '#d8c8b0' }); }
        hud();
      }
    }
  });
  window.addEventListener('pointermove', (ev) => {
    if (!ui.touch || ev.pointerId !== ui.touch.id) return;
    if (ui.tool === 'tourner') {
      ui.yaw -= (ev.clientX - ui.touch.x) * 0.012;
      ui.tilt = Math.max(-1, Math.min(1, ui.tilt + (ev.clientY - ui.touch.y) * 0.01));
      ui.touch.x = ev.clientX; ui.touch.y = ev.clientY;
      return;
    }
    Object.assign(ui.touch, pick(ev), { x: ev.clientX, y: ev.clientY });
  });
  const release = (ev) => { if (ui.touch && ev.pointerId === ui.touch.id) ui.touch = null; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.s && $('sculpture').classList.contains('active')) save(); });
  $('scTools').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tool]');
    if (!b || b.disabled) return;
    SFX.tap();
    ui.tool = b.dataset.tool;
    if (ui.tool === 'lisser') hint('lisser');
    tools();
  });
  $('scBack').innerHTML = A.icon('back');
  $('scBack').addEventListener('click', leave);
  $('scDone').addEventListener('click', () => { if (ui.s && S.canFinish(ui.s)) { SFX.tap(); finish(); } });

  window.OrbiteSculptureUI = { open, leave, load, save, get state() { return ui; } };
})();
