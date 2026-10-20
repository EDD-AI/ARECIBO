/* ORBITE — l'Arbre d'étoiles. Vaincre Kronos (fin de la démo de campagne) donne une graine ; elle se
 * plante au premier plan du menu, sur le sol noir devant la planète. Chaque arrosage coûte 100
 * poussières d'étoiles ; après 59 arrosages, la pousse est devenue un chêne massif.
 * Le dessin est du pixel art calculé : chaque branche dépend de son chemin dans l'arbre (pas d'un
 * tirage au hasard), si bien que l'arbre garde sa forme en grandissant. */
(function () {
  'use strict';

  const KEY = 'orbite.arbre';
  const COST = 100;
  const MAX = 59;
  // Paliers : nombre d'arrosages à partir duquel l'arbre change de nom.
  const STAGES = [
    { at: 0, name: 'Graine d’étoile' },
    { at: 1, name: 'Petite pousse' },
    { at: 6, name: 'Pousse' },
    { at: 13, name: 'Buisson' },
    { at: 21, name: 'Arbrisseau' },
    { at: 30, name: 'Petit arbre' },
    { at: 40, name: 'Arbre' },
    { at: 50, name: 'Grand arbre' },
    { at: MAX, name: 'Chêne massif' }
  ];
  const AW = 220, AH = 190;

  const O = () => window.__orbite;
  const A = () => window.__orbite.api;
  const SFX = () => window.OrbiteSfx;
  const tr = (s, v) => (window.tr ? window.tr(s, v) : s);

  function load() {
    try { return Object.assign({ has: false, planted: false, water: 0 }, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { return { has: false, planted: false, water: 0 }; }
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* stockage indisponible */ } }
  const stageOf = (w) => STAGES.reduce((cur, s, i) => (w >= s.at ? i : cur), 0);

  // ─── Dessin ─────────────────────────────────────────────────
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }
  const BARK = ['#1a0f08', '#2f1c10', '#4a2e1a', '#6e4a2a', '#8f6a3e'];
  const LEAF = ['#0b2016', '#143a22', '#1f5a2e', '#2f7f3a', '#4ea84a', '#8fd468', '#d7f59a'];
  const STAR = ['#fff6c8', '#ffe27a', '#bfe9ff'];

  // Dessin statique de l'arbre pour un nombre d'arrosages donné (mis en cache) ; les étoiles et la
  // graine qui palpite sont ajoutées à chaque image par frame().
  function build(w) {
    const cv = document.createElement('canvas');
    cv.width = AW; cv.height = AH;
    const ctx = cv.getContext('2d');
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
    const disc = (cx, cy, r, colOf) => {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) { const c = colOf(x, y, d); if (c) px(x, y, c); }
      }
    };
    const bx = AW / 2, by = AH - 4;
    const leaves = [];
    // Monticule de terre où dort la graine.
    disc(bx, by + 3, 6 + Math.min(4, w * 0.3), (x, y) => (y < by + 1 ? null : (x + y) % 3 ? '#20140c' : '#2c1d12'));
    if (w <= 0) return { cv, seed: true, ext: { top: by - 4, left: bx - 7, right: bx + 7 } };
    const g = Math.min(1, w / MAX);
    const e = 1 - Math.pow(1 - g, 1.6);
    if (w < 6) {
      // Petite pousse : une tige et deux feuilles qui s'ouvrent.
      const h = 3 + w * 2.2;
      for (let i = 0; i < h; i++) px(bx + Math.round(Math.sin(i * 0.5) * 0.6), by - i, i < h - 2 ? LEAF[3] : LEAF[4]);
      const top = by - h;
      const lw = 2 + w * 0.8;
      for (let i = 1; i <= lw; i++) { px(bx - i, top + 1 - i * 0.4, LEAF[4]); px(bx + i, top + 1 - i * 0.4, LEAF[5]); px(bx - i, top + 2 - i * 0.4, LEAF[3]); px(bx + i, top + 2 - i * 0.4, LEAF[4]); }
      return { cv, ext: { top: top - 3, left: bx - lw - 1, right: bx + lw + 1 } };
    }
    // Arbre : tronc puis branches qui se divisent ; le feuillage se pose au bout des rameaux.
    const depthMax = Math.min(6, 2 + Math.floor(e * 4.6));
    const trunkLen = 8 + e * 32;
    const trunkW = 1.4 + e * 10;
    let minY = by, minX = bx, maxX = bx;
    function line(x1, y1, x2, y2, wd) {
      const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5) + 1;
      for (let i = 0; i <= n; i++) {
        const k = i / n, x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k, r = wd / 2;
        for (let dx = -r; dx <= r; dx += 0.5) {
          const shade = dx < -r * 0.4 ? 3 : dx > r * 0.4 ? 1 : 2;
          px(x + dx, y, BARK[(Math.round(x + y) % 5 === 0 && r > 1.5) ? shade + 1 : shade]);
        }
      }
    }
    function branch(path, x, y, a, len, wd, d) {
      const bend = (hash(path + 'b') - 0.5) * 0.25;
      const x2 = x + Math.cos(a + bend) * len, y2 = y + Math.sin(a + bend) * len;
      line(x, y, x2, y2, Math.max(1, wd));
      minY = Math.min(minY, y2); minX = Math.min(minX, x2); maxX = Math.max(maxX, x2);
      if (d >= depthMax || len < 2.5) { leaves.push([x2, y2, d]); return; }
      // Le feuillage habille aussi le milieu des branches hautes : une couronne pleine.
      if (d >= Math.max(1, depthMax - 3)) { leaves.push([(x + x2) / 2, (y + y2) / 2, d]); leaves.push([x2, y2, d]); }
      const n = 2 + (hash(path + 'n') < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const spread = 0.5 + 0.3 * hash(path + i + 's') + (d === 0 ? 0.2 : 0);
        let ang = a + (i - (n - 1) / 2) * spread * 1.25 + (hash(path + i + 'j') - 0.5) * 0.3;
        // Le chêne s'étale : les branches basses s'ouvrent vers l'horizontale.
        ang += (ang < -Math.PI / 2 ? -1 : 1) * 0.12 * e * (d < 2 ? 1 : 0.4);
        // Jamais vers le bas : un chêne, pas un saule.
        ang = Math.max(-Math.PI + 0.3, Math.min(-0.3, ang));
        branch(path + i, x2, y2, ang, len * (0.68 + 0.16 * hash(path + i + 'l')), wd * 0.62, d + 1);
      }
    }
    branch('r', bx, by, -Math.PI / 2, trunkLen * (w < 13 ? 0.55 : 1), trunkW, 0);
    // Racines visibles au pied des grands arbres.
    if (e > 0.45) for (let i = -1; i <= 1; i += 2) line(bx, by - 1, bx + i * trunkW * 1.4, by + 1, Math.max(1, trunkW * 0.35));
    // Feuillage : des touffes ombrées, éclairées depuis la planète (en haut à gauche).
    const fr = 2 + e * 7.5;
    // Lumière d'ensemble : le haut de la couronne est plus clair que le dessous.
    let cy0 = 1e9, cy1 = -1e9;
    for (const [, ly] of leaves) { cy0 = Math.min(cy0, ly); cy1 = Math.max(cy1, ly); }
    const crownH = Math.max(1, cy1 - cy0);
    leaves.sort((p, q) => q[1] - p[1]);
    for (const [lx, ly, d] of leaves) {
      const r = fr * (1 - d * 0.04) * (0.7 + 0.6 * hash(lx.toFixed(1) + ly.toFixed(1)));
      const top = 1 - (ly - cy0) / crownH;
      disc(lx, ly, r, (x, y, dd) => {
        const lit = ((lx - x) + (ly - y)) / (r * 1.6) + 0.1 + top * 0.55 - dd / (r * 2.4);
        const dither = ((x * 3 + y * 5) % 4) / 8;
        const k = Math.max(0, Math.min(LEAF.length - 1, Math.floor((lit + dither + 0.6) * 3.2)));
        return LEAF[k];
      });
      minY = Math.min(minY, ly - r); minX = Math.min(minX, lx - r); maxX = Math.max(maxX, lx + r);
    }
    // Étoiles accrochées au feuillage (elles scintillent dans frame()) quand l'arbre est grand.
    const stars = [];
    if (w >= 30) {
      const n = Math.floor((w - 25) / 4);
      for (let i = 0; i < n && leaves.length; i++) {
        const [lx, ly] = leaves[Math.floor(hash('st' + i) * leaves.length)];
        stars.push([Math.round(lx + (hash('sx' + i) - 0.5) * fr), Math.round(ly + (hash('sy' + i) - 0.5) * fr), STAR[i % STAR.length]]);
      }
    }
    return { cv, stars, ext: { top: minY, left: minX, right: maxX } };
  }

  const cache = new Map();
  function tree(w) {
    const k = Math.round(w * 4) / 4;
    if (!cache.has(k)) { if (cache.size > 12) cache.clear(); cache.set(k, build(k)); }
    return cache.get(k);
  }
  function frame(cv, w, t) {
    const ctx = cv.getContext('2d');
    const tr0 = tree(w);
    ctx.clearRect(0, 0, AW, AH);
    ctx.drawImage(tr0.cv, 0, 0);
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    if (tr0.seed) {
      // La graine : un noyau doré qui palpite.
      const bx = AW / 2, by = AH - 5, on = Math.sin(t * 3) > 0;
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
        const d = Math.hypot(x, y);
        if (d <= 2.2) px(bx + x, by + y, d < 1 ? '#fff6c8' : on ? '#ffd36a' : '#e0a440');
      }
    }
    (tr0.stars || []).forEach(([sx, sy, c], i) => {
      const tw = Math.sin(t * 2.4 + i * 1.7);
      if (tw < -0.2) return;
      px(sx, sy, c);
      if (tw > 0.6) { px(sx - 1, sy, c); px(sx + 1, sy, c); px(sx, sy - 1, c); px(sx, sy + 1, c); }
    });
    return tr0.ext;
  }

  // ─── Menu ───────────────────────────────────────────────────
  const el = { cv: null, hit: null };
  let anim = 0, shownWater = 0, extent = null, sparkT = 0;

  function mount() {
    if (el.cv) return;
    const menu = document.getElementById('menu');
    el.cv = document.createElement('canvas');
    el.cv.className = 'star-tree';
    el.cv.width = AW; el.cv.height = AH;
    el.cv.setAttribute('aria-hidden', 'true');
    el.hit = document.createElement('button');
    el.hit.className = 'star-tree-hit';
    el.hit.setAttribute('aria-label', tr('Arbre d’étoiles'));
    el.hit.addEventListener('click', () => { if (SFX()) SFX().tap(); openTree(); });
    const ground = document.getElementById('menuGround');
    ground.after(el.cv, el.hit);
  }

  function layout() {
    const s = load();
    if (!el.cv) return;
    const show = s.has && s.planted;
    el.cv.hidden = !show; el.hit.hidden = !show;
    if (!show) return;
    const W = window.innerWidth, hz = O().ui.horizon || window.innerHeight * 0.55;
    const cw = Math.min(W * 0.85, 400), ch = cw * AH / AW;
    const cx = W * 0.5;
    el.cv.style.width = cw + 'px'; el.cv.style.height = ch + 'px';
    el.cv.style.left = cx - cw / 2 + 'px';
    el.cv.style.top = hz + 10 - ch + 'px';
    placeHit();
  }
  function placeHit() {
    if (!extent || !el.cv || el.cv.hidden) return;
    const b = el.cv.getBoundingClientRect(), k = b.width / AW;
    const top = b.top + extent.top * k, left = b.left + extent.left * k, right = b.left + extent.right * k;
    const w = Math.max(56, right - left + 12), h = Math.max(56, b.bottom - top + 6);
    // Coordonnées relatives à l'écran du menu (qui peut être décalé pendant son animation d'entrée).
    const m = el.hit.parentElement.getBoundingClientRect();
    Object.assign(el.hit.style, { left: (left + right) / 2 - w / 2 - m.left + 'px', top: b.bottom - h - m.top + 'px', width: w + 'px', height: h + 'px' });
  }
  function base() {
    const b = el.cv.getBoundingClientRect(), k = b.width / AW;
    return [b.left + AW / 2 * k, b.top + (AH - 5) * k, k];
  }

  function loop(now) {
    anim = 0;
    const o = O();
    if (!o || o.ui.screen !== 'menu' || !el.cv || el.cv.hidden) return;
    // Une douzaine d'images par seconde suffit au scintillement.
    if (now - (loop.t || 0) > 80) { loop.t = now; extent = frame(el.cv, shownWater, now / 1000); }
    // Quelques étincelles montent de la graine, puis du feuillage.
    if (now - sparkT > (shownWater ? 900 : 600)) {
      sparkT = now;
      const [x, y, k] = base();
      const tx = shownWater ? x + (Math.random() - 0.5) * (extent.right - extent.left) * k : x;
      const ty = shownWater ? y - (y - (el.cv.getBoundingClientRect().top + extent.top * k)) * (0.3 + Math.random() * 0.6) : y - 2 * k;
      o.stage.burst(tx, ty, { n: 1, colors: [[255, 236, 160], [190, 240, 170], [255, 255, 255]], speed: 3, up: 10 + Math.random() * 8, drag: 0.3, life: 1.8, size: 1 });
    }
    if (!placeHit.done) { placeHit(); placeHit.done = true; }
    anim = requestAnimationFrame(loop);
  }
  function start() { if (!anim) anim = requestAnimationFrame(loop); }

  // Arrivée au menu : la graine gagnée tombe et se plante, une seule fois.
  async function onMenu() {
    mount();
    // Kronos déjà vaincu avant l'arrivée de l'arbre : la graine est due quand même.
    try {
      const st = JSON.parse(localStorage.getItem('orbite.campagne.stats')) || {};
      if (st.wins > 0) grant();
    } catch (e) { /* statistiques illisibles */ }
    const s = load();
    shownWater = s.water;
    placeHit.done = false;
    layout();
    start();
    if (s.has && !s.planted) await plantScene();
  }

  async function plantScene() {
    const api = A(), o = O();
    await api.wait(1400);
    if (o.ui.screen !== 'menu') return;
    const s = load();
    s.planted = true;
    save(s);
    layout();
    start();
    el.cv.style.visibility = 'hidden';
    const [x, y] = base();
    const seed = document.createElement('div');
    seed.className = 'seed-fall';
    document.body.appendChild(seed);
    const x0 = window.innerWidth / 2, y0 = window.innerHeight * 0.12;
    if (SFX()) SFX().whoosh(0);
    await seed.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1.6)`, opacity: 0 },
      { transform: `translate(${(x0 + x) / 2}px, ${y0 - 30}px) scale(1.3)`, opacity: 1, offset: 0.35 },
      { transform: `translate(${x}px, ${y - 6}px) scale(1)`, opacity: 1 }
    ], { duration: 1500, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }).finished.catch(() => {});
    // La graine s'enfonce : la terre jaillit, puis une lumière sort du sol.
    await seed.animate([{ transform: `translate(${x}px, ${y - 6}px)` }, { transform: `translate(${x}px, ${y + 2}px) scale(0.6)`, opacity: 0 }], { duration: 380, fill: 'forwards' }).finished.catch(() => {});
    seed.remove();
    o.stage.burst(x, y, { n: 30, colors: [[60, 40, 24], [96, 66, 40], [140, 100, 60]], speed: 60, up: 40, life: 0.8, size: 2 });
    o.stage.ring(x, y, 10, { n: 40, colors: [[255, 236, 160], [190, 240, 170], [255, 255, 255]], speed: 50, life: 0.9, flat: 0.4 });
    if (SFX()) { SFX().place(); setTimeout(() => SFX().golden(), 250); }
    api.vibrate([20, 30, 20]);
    el.cv.style.visibility = '';
    placeHit.done = false;
    await api.wait(700);
    api.toast(tr('Votre graine d’étoile est plantée. Touchez-la pour l’arroser.'), 4200);
  }

  function openTree() {
    const api = A(), s = load();
    const st = stageOf(s.water), next = STAGES[st + 1];
    const full = s.water >= MAX;
    const pct = Math.round(s.water / MAX * 100);
    const have = api.dust();
    api.openSheet(`<h3>${tr('ARBRE D’ÉTOILES')}</h3><h2>${tr(STAGES[st].name)}</h2>
      <p class="muted">${full ? tr('Votre arbre est arrivé à maturité. Il veille sur votre monde.') : tr('Chaque arrosage de poussières d’étoiles le fait grandir.')}</p>
      <div class="tree-bar"><i style="width:${pct}%"></i></div>
      <p class="tree-count">${tr('{n} / {max} arrosages', { n: s.water, max: MAX })}${next ? ' · ' + tr('prochain palier : {nom} ({n})', { nom: tr(next.name), n: next.at }) : ''}</p>
      <div class="sheet-actions">
        ${full ? '' : `<button class="btn primary" id="treeWater" ${have < COST ? 'disabled' : ''}>${tr('ARROSER')} · ${COST} ${api.icon('dust')}</button>`}
        <button class="btn" id="treeClose">${tr('FERMER')}</button>
      </div>
      ${!full && have < COST ? `<p class="muted center">${tr('Il vous manque {n} poussières d’étoiles.', { n: COST - have })}</p>` : ''}`);
    const w = document.getElementById('treeWater');
    if (w) w.addEventListener('click', water);
    document.getElementById('treeClose').addEventListener('click', () => api.closeSheet());
  }

  async function water() {
    const api = A(), o = O(), s = load();
    if (s.water >= MAX || api.dust() < COST) return;
    api.addDust(-COST);
    const before = stageOf(s.water);
    s.water++;
    save(s);
    api.closeSheet();
    api.renderMenu();
    const [x, y, k] = base();
    const topY = el.cv.getBoundingClientRect().top + (extent ? extent.top : AH - 20) * k;
    // Une pluie de poussières d'étoiles tombe sur l'arbre.
    for (let i = 0; i < 6; i++) {
      const sx = x + (Math.random() - 0.5) * Math.max(30, (extent ? extent.right - extent.left : 20) * k);
      setTimeout(() => o.stage.beam([sx, topY - 70 - Math.random() * 40], [sx + (Math.random() - 0.5) * 10, Math.min(y, topY + 20)], { ms: 520, arc: 0, tail: 8, head: 2, color: [255, 226, 140] }), i * 90);
    }
    if (SFX()) SFX().roll();
    await api.wait(650);
    o.stage.burst(x, Math.min(y, topY + 20), { n: 26, colors: [[255, 236, 160], [140, 220, 255], [255, 255, 255]], speed: 45, up: 20, life: 0.8 });
    // L'arbre grandit en douceur jusqu'à son nouveau stade.
    const from = s.water - 1, t0 = performance.now();
    await new Promise((res) => {
      const step = (now) => {
        const p = Math.min(1, (now - t0) / 700);
        shownWater = p < 1 ? from + p : s.water;
        if (p < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    shownWater = s.water;
    placeHit.done = false;
    api.popAt(x, topY - 10, '+1', 'good buff');
    if (SFX()) SFX().buff(0, 2);
    const after = stageOf(s.water);
    if (after !== before) {
      o.stage.ring(x, (y + topY) / 2, 30, { n: 60, colors: [[190, 240, 170], [255, 236, 160], [255, 255, 255]], speed: 80, life: 1 });
      if (SFX()) SFX().level();
      api.banner(tr(STAGES[after].name).toUpperCase(), s.water >= MAX ? tr('Votre arbre est arrivé à maturité.') : tr('Votre arbre a grandi.'), 'win');
      api.vibrate([20, 40, 20]);
    }
  }

  // Récompense de la campagne : renvoie true si la graine vient d'être gagnée.
  function grant() {
    const s = load();
    if (s.has) return false;
    s.has = true;
    save(s);
    return true;
  }

  window.addEventListener('resize', () => { if (el.cv) { layout(); placeHit.done = false; } });
  window.OrbiteArbre = { onMenu, grant, layout, load, COST, MAX, STAGES };
})();
