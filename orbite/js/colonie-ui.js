/* ORBITE — écran de la colonie : descente à la surface d'une planète forgée, cinématique du
 * colonisateur, terrain isométrique, construction, réserves en temps réel et tutoriel.
 * Les règles sont dans colonie-jeu.js, les bâtiments dans building-engine.js et js/batiments/. */
(function () {
  'use strict';
  const O = window.__orbite;
  if (!O) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const E = window.OrbiteBuildings, R = window.OrbiteBuildingRenderer, C = window.OrbiteColonie;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const icon = A.icon, esc = A.esc;

  const KEY = 'orbite.colonies';
  // v2 : la cinématique est rejouée une fois pour ceux qui l'ont vue sans texte (v44-45).
  const INTRO_KEY = 'orbite.colonie.intro2';
  const TUTO_KEY = 'orbite.colonie.tuto';
  // Nature de la planète → sol de la colonie.
  const THEME = { terran: 'mars', earth: 'mars', desert: 'mars', dead: 'mars', ocean: 'glace', ice: 'glace', moon: 'lune', crystal: 'lune', toxic: 'soufre', lava: 'volcan' };
  const SURFACE_MASS = 8;

  const ui = { col: null, planet: null, scale: 2, panX: 0, panY: 0, cat: 'habitat', sel: null, ghost: null, timer: 0, anim: 0, drag: null, lastSol: -1 };

  const all = () => A.readJson(KEY, {});
  function save() {
    if (!ui.col) return;
    const a = all();
    a[ui.col.id] = ui.col;
    A.store.set(KEY, JSON.stringify(a));
  }
  const bname = (key) => tr(E.TYPE_BY_KEY[key].name);

  // ─── Rendu du terrain ───────────────────────────────────────
  let geo = null;
  function draw(t) {
    const col = ui.col;
    if (!col) return;
    const cand = ui.ghost && ui.ghost.ok ? Object.assign({}, col, { built: col.built.concat([ui.ghost.b]) }) : col;
    const sc = C.scene(cand, t || 0);
    const cv = $('colCanvas');
    R.render(sc.m, { theme: col.theme, accent: 'orange', canvas: cv, blink: (performance.now() % 1300) < 650, depth: true, dim: C.zoneMask(col) });
    geo = { W: cv.width, H: cv.height, ox: sc.m.Y * 2, oy: sc.m.Z * 2 + 2, g: sc.g, top: sc.top };
    place();
    drawGhost();
    drawRovers();
  }
  // Rovers : redessinés seuls, plusieurs fois par seconde, par-dessus le terrain (sans le recalculer).
  function drawRovers() {
    const col = ui.col;
    if (!col || !geo || !geo.top) return;
    const list = C.rovers(col, Date.now() / 1000);
    ui.roverCount = list.length;
    if (!list.length) return;
    const blink = (performance.now() % 900) < 450, S = col.S, vox = [];
    for (const r of list) {
      let z = geo.g;
      const cx = Math.round(r.x), cy = Math.round(r.y);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < S && y < S) z = Math.max(z, geo.top[y * S + x] + 1);
      }
      for (const v of C.roverVoxels(r, z, blink)) vox.push(v);
    }
    R.overlay($('colCanvas'), vox);
  }
  // Position et taille de la toile dans la vue (glisser pour se déplacer, + et − pour zoomer).
  function place() {
    if (!geo) return;
    for (const id of ['colCanvas', 'colGhost']) {
      const c = $(id);
      c.style.width = geo.W * ui.scale + 'px';
      c.style.height = geo.H * ui.scale + 'px';
      c.style.transform = `translate(${Math.round(ui.panX)}px, ${Math.round(ui.panY)}px)`;
    }
  }
  function centerOn(x, y) {
    if (!geo) return;
    const v = $('colView').getBoundingClientRect();
    const [px, py] = proj(x, y);
    ui.panX = v.width / 2 - px * ui.scale;
    ui.panY = v.height / 2 - py * ui.scale;
    place();
  }
  // Case (x, y) au sol → pixels de la toile ; et l'inverse pour un toucher.
  const proj = (x, y) => [geo.ox + (x - y) * 2 + 2, geo.oy + (x + y) - (geo.g - 1) * 2 + 1];
  function pick(cx, cy) {
    const r = $('colCanvas').getBoundingClientRect();
    const ax = (cx - r.left) / ui.scale, ay = (cy - r.top) / ui.scale;
    const a = (ax - geo.ox - 2) / 2, b = ay - geo.oy - 1 + (geo.g - 1) * 2;
    return [Math.round((a + b) / 2), Math.round((b - a) / 2)];
  }
  function drawGhost() {
    const c = $('colGhost');
    if (!geo) return;
    c.width = geo.W; c.height = geo.H;
    const x = c.getContext('2d');
    x.clearRect(0, 0, c.width, c.height);
    const gh = ui.ghost;
    // Calque masqué hors placement : certains navigateurs gardent l'ancienne image d'une toile remise à zéro.
    c.style.visibility = gh && gh.fp ? 'visible' : 'hidden';
    if (!gh || !gh.fp) return;
    const p =[[gh.x, gh.y], [gh.x + gh.fp.X, gh.y], [gh.x + gh.fp.X, gh.y + gh.fp.Y], [gh.x, gh.y + gh.fp.Y]].map(([a, b]) => proj(a - 0.5, b - 0.5));
    x.beginPath();
    p.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.closePath();
    x.fillStyle = gh.ok ? 'rgba(120,230,140,0.28)' : 'rgba(255,90,80,0.32)';
    x.fill();
    x.strokeStyle = gh.ok ? '#9ff09a' : '#ff6a5a';
    x.lineWidth = 1;
    x.stroke();
  }

  // ─── Réserves ───────────────────────────────────────────────
  const fmt = (n) => (n > 0 ? '+' : '') + (Math.abs(n) < 10 ? n.toFixed(1).replace('.0', '') : Math.round(n));
  function renderRes() {
    const col = ui.col, r = C.rates(col);
    const cell = (label, val, sub, bad, attr) => `<span class="${bad ? 'bad' : ''}" ${attr || ''}><small>${label}</small><b>${val}</b>${sub != null ? `<i>${sub}</i>` : ''}</span>`;
    $('colRes').innerHTML =
      cell(tr('COLONS'), `${col.colonists}/${r.pop}`, `${tr('emplois')} ${Math.round(r.workers)}/${r.jobs}`, r.pop === 0) +
      cell(tr('ÉNERGIE'), fmt(r.power), `${Math.round(r.powerProd)}/${Math.round(r.powerUse)}`, r.power < 0) +
      cell(tr('EAU'), Math.round(col.stock.water), fmt(r.water), r.water < 0) +
      cell(tr('OXYGÈNE'), Math.round(col.stock.oxygen), fmt(r.oxygen), r.oxygen < 0) +
      cell(tr('NOURRITURE'), Math.round(col.stock.food), fmt(r.food), r.food < 0) +
      cell(tr('MATÉRIAUX') + ' +', Math.round(col.stock.materials), fmt(r.materials), col.stock.materials < 20, 'data-col-supply role="button"') +
      cell(tr('RECHERCHE'), Math.round(col.stock.research), fmt(r.research)) +
      cell(icon('dust'), A.dust(), null);
    $('colSol').textContent = tr('SOL {n}', { n: col.sol }) + (col.storm > 0 ? ' · ' + tr('TEMPÊTE') : '');
  }

  // ─── Construction ───────────────────────────────────────────
  const thumbs = {};
  function thumb(key) {
    if (!thumbs[key]) {
      const m = E.TYPE_BY_KEY[key].build(E.makeRng('carte:' + key), { t: 0 });
      thumbs[key] = R.render(m, { theme: ui.col.theme, accent: 'orange' }).toDataURL();
    }
    return thumbs[key];
  }
  function ecoLine(key) {
    const e = E.TYPE_BY_KEY[key].eco;
    const parts = [];
    if (e.pop) parts.push(tr('{n} places', { n: e.pop }));
    for (const [f, label] of [['power', tr('énergie')], ['water', tr('eau')], ['oxygen', tr('oxygène')], ['food', tr('nourriture')], ['materials', tr('matériaux')], ['research', tr('recherche')]]) if (e[f] > 0) parts.push(`+${e[f]} ${label}`);
    if (E.TYPE_BY_KEY[key].role === 'storage') parts.push(tr('stockage'));
    if (E.TYPE_BY_KEY[key].role === 'green') parts.push(tr('prairie et arbres'));
    return parts.join(' · ');
  }
  function renderCats() {
    const cats = Object.keys(E.CATS);
    $('colCats').innerHTML = cats.map((c) => `<button class="${c === ui.cat ? 'on' : ''}" data-col-cat="${c}">${esc(tr(E.CATS[c]))}</button>`).join('');
  }
  function renderCards() {
    const col = ui.col;
    const keys = E.TYPES.filter((t) => t.cat === ui.cat && C.TIER_OF[t.key] != null).map((t) => t.key)
      .sort((a, b) => C.TIER_OF[a] - C.TIER_OF[b]);
    $('colCards').innerHTML = keys.map((k) => {
      const p = C.price(k), open = C.unlocked(col, k), tier = C.TIERS[C.TIER_OF[k]];
      const cost = `${p.materials ? `${p.materials} ${tr('mat.')}` : tr('offert')}${p.dust ? ` · ${p.dust} ${icon('dust')}` : ''}`;
      return `<button class="col-card ${ui.sel === k ? 'on' : ''} ${open ? '' : 'locked'}" data-col-card="${k}">
        <img src="${thumb(k)}" alt="">
        <b>${esc(bname(k))}</b>
        <small>${open ? cost : tr('Recherche {n}', { n: tier.research })}</small>
        <em>${esc(ecoLine(k))}</em></button>`;
    }).join('');
  }
  function select(key) {
    if (!C.unlocked(ui.col, key)) { A.refuse(tr('Il faut {n} de recherche pour ce bâtiment.', { n: C.TIERS[C.TIER_OF[key]].research })); return; }
    ui.sel = ui.sel === key ? null : key;
    ui.ghost = null;
    renderCards();
    hint();
    draw();
  }
  // À quoi sert un bâtiment : ce qu'il produit, consomme, et son rôle particulier.
  function useText(key) {
    const t = E.TYPE_BY_KEY[key], e = t.eco, out = [];
    const names = { power: tr('énergie'), water: tr('eau'), oxygen: tr('oxygène'), food: tr('nourriture'), materials: tr('matériaux'), research: tr('recherche') };
    const prod = [], use = [];
    for (const f of ['power', 'water', 'oxygen', 'food', 'materials', 'research']) {
      if (e[f] > 0) prod.push(`+${e[f]} ${names[f]}`);
      else if (e[f] < 0) use.push(`${-e[f]} ${names[f]}`);
    }
    if (e.pop) out.push(tr('Loge {n} colons.', { n: e.pop }));
    if (prod.length) out.push(tr('Produit par sol : {list}.', { list: prod.join(', ') }));
    if (use.length) out.push(tr('Consomme : {list}.', { list: use.join(', ') }));
    if (e.jobs) out.push(tr('Emplois : {n} (sans ouvriers, il tourne au ralenti).', { n: e.jobs }));
    const role = {
      hq: tr('Le cœur de la colonie, à poser en premier. Ses rovers récupèrent 1 matériau par sol.'),
      storage: tr('Agrandit les réserves maximales d’eau, d’oxygène, de nourriture et de matériaux.'),
      ice: tr('À poser sur une tache claire de glace.'),
      ore: tr('À poser sur une tache sombre de minerai.'),
      spaceport: tr('Les colons arrivent plus vite : jusqu’à 2 par sol.'),
      green: tr('Fait pousser prairie et arbres autour de lui pendant plusieurs jours ; la verdure produit de l’oxygène.'),
      vehicle: tr('Permet de partir en expédition explorer les environs.')
    }[t.role];
    if (role) out.push(role);
    if (key === 'batteries') out.push(tr('Donne aussi 40 points d’autonomie au rover d’expédition.'));
    if (e.research > 0) out.push(tr('La recherche débloque de nouveaux bâtiments.'));
    return out;
  }
  function hint() {
    const box = $('colPlace');
    if (!ui.sel) { box.hidden = true; return; }
    box.hidden = false;
    const gh = ui.ghost;
    const short = gh && gh.reason === 'Pas assez de matériaux.' ? ' ' + tr('Touchez MATÉRIAUX pour un ravitaillement.') : gh && gh.reason && gh.reason.startsWith('Hors de la zone') ? ' ⤢' : '';
    const t = E.TYPE_BY_KEY[ui.sel];
    // Sans emplacement visé : la fiche du bâtiment (ce que c'est, à quoi il sert).
    const info = gh ? '' : `<b class="col-pname">${esc(bname(ui.sel))}</b><span class="col-pdesc">${esc(tr(t.desc))}</span>
      <span class="col-puse">${useText(ui.sel).map(esc).join('<br>')}</span><span class="col-ptip">${tr('Touchez le terrain pour le placer.')}</span>`;
    $('colPlaceTxt').innerHTML = gh ? (gh.ok ? `${esc(bname(ui.sel))} · ${C.price(ui.sel).materials} ${tr('mat.')}` : `<span class="bad">${esc(tr(gh.reason) + short)}</span>`) : info;
    $('colBuild').disabled = !(gh && gh.ok);
  }
  function aim(tx, ty) {
    const col = ui.col, key = ui.sel;
    const fp = C.footprint(key, C.buildSeed(col, col.uid));
    const x = tx - Math.floor(fp.X / 2), y = ty - Math.floor(fp.Y / 2);
    const c = C.canPlace(col, key, x, y, A.dust());
    ui.ghost = { x, y, fp: c.fp || fp, ok: c.ok, reason: c.reason, b: { uid: col.uid, key, x, y, seed: C.buildSeed(col, col.uid) } };
    SFX.tap();
    hint();
    draw();
  }
  function confirmBuild() {
    const gh = ui.ghost;
    if (!gh || !gh.ok) return;
    const res = C.build(ui.col, ui.sel, gh.x, gh.y, A.dust());
    if (!res.ok) { A.refuse(tr(res.reason)); return; }
    if (res.dust) A.addDust(-res.dust);
    const key = ui.sel;
    ui.ghost = null;
    if (key === 'tour') ui.sel = null;
    save();
    SFX.place();
    setTimeout(() => SFX.buff(0, 2), 120);
    A.vibrate(15);
    draw();
    // Gerbe de chantier sur le nouveau bâtiment.
    const r = $('colCanvas').getBoundingClientRect();
    const [px, py] = proj(res.b.x + gh.fp.X / 2, res.b.y + gh.fp.Y / 2);
    const sx = r.left + px * ui.scale, sy = r.top + py * ui.scale;
    stage.burst(sx, sy, { n: 30, colors: [[255, 226, 140], [255, 255, 255], [180, 160, 140]], speed: 60, up: 30, life: 0.8 });
    A.toast(tr('{nom} construit.', { nom: bname(key) }), 1600);
    renderRes(); renderCards(); hint();
    tutoAfterBuild(key);
  }

  // Toucher un bâtiment posé : sa fiche, son rendement, la démolition.
  function inspect(tx, ty) {
    const col = ui.col;
    const b = col.built.find((q) => { const f = C.footprint(q.key, q.seed); return tx >= q.x && ty >= q.y && tx < q.x + f.X && ty < q.y + f.Y; });
    if (!b) return;
    const t = E.TYPE_BY_KEY[b.key], r = C.rates(col), e = t.eco;
    const lines = [];
    if (e.pop) lines.push(tr('{n} places de logement', { n: e.pop }));
    if (e.jobs) lines.push(tr('{n} emplois', { n: e.jobs }));
    for (const [f, label] of [['power', tr('Énergie')], ['water', tr('Eau')], ['oxygen', tr('Oxygène')], ['food', tr('Nourriture')], ['materials', tr('Matériaux')], ['research', tr('Recherche')]]) if (e[f]) lines.push(`${label} ${e[f] > 0 ? '+' : ''}${e[f]}`);
    const eff = Math.round(100 * (e.jobs ? r.workRatio : 1) * (e.power < 0 ? r.powerRatio : 1));
    // Pépinière : ce qui a poussé, et où en est le front de verdure.
    let green = '';
    if (t.role === 'green') {
      const v = C.vegetation(col), rad = C.greenRadius(b), max = C.GREEN.radius;
      const left = Math.max(0, max * C.GREEN.perTile - (b.g || 0));
      green = `<p class="muted">${tr('Prairie : {n} cases · {a} arbres', { n: v.grass, a: v.trees.length })}</p>
        <p class="muted">${tr('Front de verdure : {r} / {max} cases', { r: Math.floor(rad), max })}${left > 0 ? ' · ' + tr('pleine étendue dans {j} j environ', { j: Math.max(1, Math.round(left / 1440 / Math.max(0.3, eff / 100))) }) : ''}</p>`;
    }
    A.openSheet(`<h3>${esc(tr(E.CATS[t.cat]))}</h3><h2>${esc(bname(b.key))}</h2>
      <p class="sheet-text">${esc(tr(t.desc))}</p>
      <p class="muted">${lines.map(esc).join(' · ')}</p>
      ${green}
      ${e.jobs || e.power < 0 ? `<p class="muted">${tr('Rendement : {n} %', { n: eff })}${eff < 100 ? ' · ' + (r.workRatio < 1 && e.jobs ? tr('manque d’ouvriers') : tr('manque d’énergie')) : ''}</p>` : ''}
      <div class="sheet-actions">${b.key === 'tour' ? '' : `<button class="btn" id="colDemolish">${tr('DÉMOLIR')} (+${Math.floor(C.price(b.key).materials / 2)} ${tr('mat.')})</button>`}
      <button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
    const d = $('colDemolish');
    if (d) d.addEventListener('click', () => { C.demolish(col, b.uid); save(); A.closeSheet(); SFX.sell(); draw(); renderRes(); });
  }

  // Matériaux : d'où ils viennent, et la navette de ravitaillement.
  function supplySheet() {
    const col = ui.col, r = C.rates(col), S = C.SUPPLY;
    const room = Math.max(0, Math.floor(r.caps.materials - col.stock.materials));
    A.openSheet(`<h3>${tr('MATÉRIAUX')}</h3><h2>${Math.round(col.stock.materials)} / ${Math.round(r.caps.materials)}</h2>
      <p class="sheet-text">${tr('Les rovers de la tour de contrôle récupèrent {n} matériau par sol. Un <b>forage</b> ou une <b>mine</b> sur le minerai en produit bien plus ; démolir rend la moitié du prix.', { n: C.SALVAGE })}</p>
      <p class="muted">${tr('Navette de ravitaillement : {n} matériaux pour {d} poussières d’étoiles.', { n: S.materials, d: S.dust })}</p>
      <div class="sheet-actions"><button class="btn primary" id="colSupplyBuy" ${room > 0 && A.dust() >= S.dust ? '' : 'disabled'}>${tr('COMMANDER')} · ${S.dust} ${icon('dust')}</button>
      <button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
    $('colSupplyBuy').addEventListener('click', () => {
      const res = C.supply(ui.col, A.dust());
      if (!res.ok) { A.refuse(tr(res.reason)); return; }
      A.addDust(-res.dust);
      save();
      A.closeSheet();
      SFX.coin();
      A.toast(tr('La navette a livré {n} matériaux.', { n: res.n }), 2200);
      renderRes(); renderCards(); if (ui.ghost && ui.sel) aim(ui.ghost.x + Math.floor(ui.ghost.fp.X / 2), ui.ghost.y + Math.floor(ui.ghost.fp.Y / 2));
    });
  }

  // Zone de la colonie : sa taille, et l'agrandissement par paliers.
  function zoneSheet() {
    const col = ui.col, z = C.zoneBox(col), n = C.nextZone(col);
    const cost = n ? `${n.cost.materials} ${tr('mat.')}${n.cost.dust ? ` · ${n.cost.dust} ${icon('dust')}` : ''}` : '';
    const ok = n && col.stock.materials >= n.cost.materials && A.dust() >= n.cost.dust;
    A.openSheet(`<h3>${tr('ZONE DE LA COLONIE')}</h3><h2>${tr('{n} × {n} cases', { n: z.size })}</h2>
      <p class="sheet-text">${n ? tr('Les bornes lumineuses marquent la limite. Agrandir la zone à {m} × {m} cases ouvre de nouveaux gisements et de la place pour bâtir.', { m: n.size }) : tr('La colonie occupe déjà tout le terrain.')}</p>
      <div class="sheet-actions">${n ? `<button class="btn primary" id="colZoneBuy" ${ok ? '' : 'disabled'}>${tr('AGRANDIR')} · ${cost}</button>` : ''}
      <button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
    const b = $('colZoneBuy');
    if (b) b.addEventListener('click', () => {
      const res = C.expand(ui.col, A.dust());
      if (!res.ok) { A.refuse(tr(res.reason)); return; }
      if (res.dust) A.addDust(-res.dust);
      save();
      A.closeSheet();
      SFX.level();
      A.vibrate(20);
      draw();
      const v = $('colView').getBoundingClientRect();
      stage.ring(v.left + v.width / 2, v.top + v.height / 2, v.width * 0.4, { n: 60, colors: [[255, 226, 140], [140, 220, 255]], speed: 50, life: 0.9, flat: 0.5 });
      A.toast(tr('La zone de la colonie s’étend : {n} × {n} cases.', { n: res.size }), 2600);
      renderRes(); renderCards();
    });
  }

  // ─── Temps réel ─────────────────────────────────────────────
  function tick() {
    const col = ui.col;
    if (!col) return;
    const ev = C.catchUp(col, Date.now());
    if (ev.length) {
      const arr = ev.filter((e) => e.t === 'arrivee').reduce((n, e) => n + e.n, 0);
      const dep = ev.filter((e) => e.t === 'depart');
      if (arr) A.toast(arr > 1 ? tr('{n} colons sont arrivés.', { n: arr }) : tr('Un colon est arrivé.'), 2200);
      if (dep.length) A.toast(tr('Pénurie : {n} colon(s) repartent.', { n: dep.length }), 2600);
      if (ev.some((e) => e.t === 'tempete')) A.toast(tr('Tempête de poussière : le solaire faiblit.'), 3000);
      save();
    }
    if (col.sol !== ui.lastSol) { ui.lastSol = col.sol; renderRes(); renderCards(); }
  }

  // ─── Ouverture ──────────────────────────────────────────────
  async function open(planet, orbEl) {
    const all0 = all();
    let col = all0[planet.id];
    const fresh = !col;
    if (fresh) col = C.create(planet.id, planet.seed, THEME[planet.type] || 'mars', Date.now());
    ui.col = col; ui.planet = planet; ui.sel = null; ui.ghost = null; ui.lastSol = -1;
    // Sans tour de contrôle, on ouvre l'onglet où elle se trouve.
    if (!C.hasHq(col)) ui.cat = E.TYPE_BY_KEY.tour.cat;
    for (const k in thumbs) delete thumbs[k];
    const ev = C.catchUp(col, Date.now());
    save();
    await dive(orbEl);
    if (A.store.get(INTRO_KEY, '') !== '1') { A.store.set(INTRO_KEY, '1'); await colonizer(); }
    $('colName').textContent = planet.name;
    await A.show('colony');
    stage.sky = 0;
    renderRes(); renderCats(); renderCards(); hint();
    draw();
    const hq = col.built.find((b) => b.key === 'tour');
    if (hq) { const f = C.footprint(hq.key, hq.seed); centerOn(hq.x + f.X / 2, hq.y + f.Y / 2); } else centerOn(col.S / 2, col.S / 2);
    if (ev.length) {
      const arr = ev.filter((e) => e.t === 'arrivee').reduce((n, e) => n + e.n, 0);
      A.toast(tr('Pendant votre absence : {sols} sols, {n} arrivée(s).', { sols: ev.length ? ev[ev.length - 1].sol - (ev[0].sol - 1) : 0, n: arr }), 3200);
    }
    clearInterval(ui.timer);
    ui.timer = setInterval(tick, 1000);
    clearInterval(ui.anim);
    // Animation des bâtiments (pales, fumées…) et clignotement des balises.
    ui.anim = setInterval(() => { if (document.getElementById('colony').classList.contains('active') && !ui.drag && !document.hidden) draw((performance.now() / 3000) % 1); }, 450);
    clearInterval(ui.rov);
    ui.rov = setInterval(() => { if (ui.roverCount && document.getElementById('colony').classList.contains('active') && !document.hidden) drawRovers(); }, 90);
    if (A.store.get(TUTO_KEY, '') !== 'fini') setTimeout(tutoStart, 600);
  }
  function close() {
    clearInterval(ui.timer); clearInterval(ui.anim); clearInterval(ui.rov);
    save();
  }

  // Descente : la planète grossit jusqu'à remplir l'écran, puis le sol apparaît.
  async function dive(orbEl) {
    const veil = document.createElement('div');
    veil.className = 'col-dive';
    document.body.appendChild(veil);
    if (SFX) SFX.whoosh(0);
    if (orbEl) orbEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(9)' }], { duration: 1300, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1300, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    if (orbEl) orbEl.getAnimations().forEach((a) => a.cancel());
    setTimeout(() => veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' }).finished.then(() => veil.remove()).catch(() => veil.remove()), 350);
  }

  // Cinématique : « Créateur, on dirait qu'il y a de la vie… » puis l'arrivée du colonisateur.
  async function colonizer() {
    const orb = $('cineOrb'), line = $('cineLine');
    orb.style.display = 'none';
    const art = document.createElement('canvas');
    art.className = 'cine-art';
    const m = E.TYPE_BY_KEY.fusee.build(E.makeRng('colonisateur'), { t: 0 });
    R.render(m, { theme: ui.col.theme, accent: 'orange', canvas: art });
    art.style.width = art.width * 3 + 'px'; art.style.height = art.height * 3 + 'px';
    $('cine').appendChild(art);
    art.style.opacity = '0';
    let skip = false;
    $('cineSkip').onclick = () => { skip = true; SFX.tap(); };
    await A.show('cine');
    const say = async (text, hold) => {
      if (skip) return;
      // La cinématique de la Création laisse la ligne effacée (classe fade) : on la réaffiche.
      line.classList.remove('fade');
      line.textContent = '';
      for (const ch of text) { if (skip) break; line.textContent += ch; if (ch !== ' ') SFX.type(); await A.wait(ch === '.' || ch === '…' || ch === ',' ? 300 : 55); }
      const t0 = performance.now(); while (!skip && performance.now() - t0 < (hold || 1600)) await A.wait(50);
    };
    await say(tr('Créateur…'), 900);
    await say(tr('On dirait qu’il y a de la vie sur l’une de vos créations.'), 1800);
    if (!skip) {
      art.style.opacity = '1';
      SFX.whoosh(0);
      await art.animate([{ transform: 'translateY(-60vh)' }, { transform: 'translateY(0)' }], { duration: 2200, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.catch(() => {});
      const b = art.getBoundingClientRect();
      stage.burst(b.left + b.width / 2, b.bottom - 10, { n: 50, colors: [[255, 200, 120], [255, 255, 255], [160, 150, 140]], speed: 70, up: 10, life: 1 });
      SFX.place();
    }
    await say(tr('Un colonisateur.'), 1800);
    await say(tr('Quatre colons, des réserves et des matériaux. À vous de leur bâtir un monde.'), 2000);
    art.remove();
    orb.style.display = '';
    line.textContent = '';
  }

  // ─── Tutoriel ───────────────────────────────────────────────
  function tutoStart() {
    if (!ui.col || !document.getElementById('colony').classList.contains('active')) return;
    A.coachStart([
      { id: 'res', target: '#colRes', place: 'below', text: tr('Les réserves de votre colonie. Chaque colon consomme de l’<b>eau</b>, de l’<b>oxygène</b> et de la <b>nourriture</b> à chaque <b>sol</b> (une minute). En rouge : ce qui baisse.'), next: tr('SUIVANT') },
      { id: 'tour', target: '#colCards', place: 'top', enter: () => { ui.cat = 'services'; renderCats(); renderCards(); }, text: tr('Commencez par la <b>tour de contrôle</b>, offerte : touchez-la, puis touchez le terrain au centre, et <b>CONSTRUIRE</b>.'), next: tr('SUIVANT') },
      { id: 'vue', target: '#colView', place: 'top', text: tr('Glissez pour vous déplacer, <b>+</b> et <b>−</b> pour zoomer. Les taches claires sont de la <b>glace</b> (extracteurs d’eau), les sombres du <b>minerai</b> (forages et mines).'), next: tr('SUIVANT') },
      { id: 'vie', target: '#colCats', place: 'top', text: tr('Puis, dans l’ordre : de l’<b>énergie</b> (champ solaire), de l’<b>oxygène</b> (MOXIE), de l’<b>eau</b> (extracteur sur la glace), de la <b>nourriture</b> (serre) et des <b>logements</b> pour que d’autres colons viennent.'), next: tr('SUIVANT') },
      { id: 'recherche', target: '#colCats', place: 'top', text: tr('Un <b>laboratoire</b> produit de la recherche, qui débloque de nouveaux bâtiments. Un <b>forage</b> sur le minerai rapporte des matériaux. Les bâtiments avancés coûtent aussi des <b>poussières d’étoiles</b>.'), next: tr('SUIVANT') },
      { id: 'temps', target: '#colSol', place: 'below', text: tr('Le temps passe même appli fermée. Sans air, sans eau ou sans nourriture, les colons repartent. Les tempêtes de poussière voilent le solaire : prévoyez des batteries et d’autres énergies.'), next: tr('C’EST PARTI') }
    ], () => A.store.set(TUTO_KEY, 'fini'));
  }
  function tutoAfterBuild(key) {
    if (E.TYPE_BY_KEY[key].role === 'green') A.toast(tr('Les premières pousses sortiront dans quelques heures ; la prairie et les arbres mettront plusieurs jours à s’étendre.'), 4200);
    if (key === 'tour' && A.store.get('orbite.colonie.tuto2', '') !== '1') {
      A.store.set('orbite.colonie.tuto2', '1');
      ui.cat = 'energie'; renderCats(); renderCards();
      A.toast(tr('La colonie est fondée. Maintenant : de l’énergie et de l’oxygène.'), 3200);
    }
  }

  // ─── Événements ─────────────────────────────────────────────
  $('colCats').addEventListener('click', (e) => { const b = e.target.closest('[data-col-cat]'); if (!b) return; SFX.tap(); ui.cat = b.dataset.colCat; renderCats(); renderCards(); });
  $('colCards').addEventListener('click', (e) => { const b = e.target.closest('[data-col-card]'); if (!b) return; select(b.dataset.colCard); });
  $('colBuild').addEventListener('click', confirmBuild);
  $('colRes').addEventListener('click', (e) => { if (e.target.closest('[data-col-supply]')) { SFX.tap(); supplySheet(); } });
  $('colCancel').addEventListener('click', () => { ui.sel = null; ui.ghost = null; SFX.tap(); renderCards(); hint(); draw(); });
  $('colZoomIn').addEventListener('click', () => zoom(1.25));
  $('colZoomOut').addEventListener('click', () => zoom(0.8));
  $('colZone').addEventListener('click', () => { SFX.tap(); zoneSheet(); });
  function zoom(k) {
    const v = $('colView').getBoundingClientRect();
    const cx = v.width / 2, cy = v.height / 2;
    const ns = Math.max(1, Math.min(7, ui.scale * k));
    ui.panX = cx - (cx - ui.panX) * ns / ui.scale;
    ui.panY = cy - (cy - ui.panY) * ns / ui.scale;
    ui.scale = ns;
    SFX.tap();
    place();
  }
  const view = $('colView');
  view.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    ui.drag = { x: e.clientX, y: e.clientY, px: ui.panX, py: ui.panY, moved: false, id: e.pointerId };
  });
  view.addEventListener('pointermove', (e) => {
    const d = ui.drag;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) d.moved = true;
    if (!d.moved) return;
    ui.panX = d.px + dx; ui.panY = d.py + dy;
    place();
  });
  const up = (e) => {
    const d = ui.drag;
    ui.drag = null;
    if (!d || d.moved || !geo || !ui.col) return;
    const [tx, ty] = pick(e.clientX, e.clientY);
    if (tx < 0 || ty < 0 || tx >= ui.col.S || ty >= ui.col.S) return;
    if (ui.sel) aim(tx, ty); else inspect(tx, ty);
  };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', () => { ui.drag = null; });
  $('colBack').innerHTML = icon('back');
  $('colBack').addEventListener('click', async () => { SFX.tap(); close(); await A.openCreation(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else if (ui.col) tick(); });
  window.addEventListener('resize', () => { if (ui.col) place(); });

  const has = (id) => !!all()[id];
  // Retour d'une expédition : la colonie reprend là où on l'avait laissée.
  async function resume() {
    await A.show('colony');
    stage.sky = 0;
    renderRes(); renderCards(); hint();
    draw();
  }
  $('colExplore').addEventListener('click', () => {
    SFX.tap();
    if (window.OrbiteExplorationUI) window.OrbiteExplorationUI.open(ui.col);
  });
  window.OrbiteColonieUI = { open, close, has, save, resume, SURFACE_MASS, THEME, get state() { return ui; } };
})();
