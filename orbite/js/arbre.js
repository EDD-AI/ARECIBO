/* ORBITE — l'Arbre d'étoiles. Vaincre Kronos (fin de la démo de campagne) donne une graine ; elle se
 * plante au premier plan du menu, sur le sol noir devant la planète. Chaque arrosage coûte 100
 * poussières d'étoiles ; après 59 arrosages, la pousse est devenue un chêne massif.
 * Silhouette noire comme le sol, à contre-jour devant la planète : tronc noueux, branches qui se
 * tordent, feuillage au contour déchiqueté. Chaque branche dépend de son chemin dans l'arbre (pas
 * d'un tirage au hasard), si bien que l'arbre garde sa forme en grandissant. */
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
  // Silhouette noire comme le sol, avec un fin liseré de lumière venu de la planète derrière.
  const INK = [0, 0, 1];
  const HALO = [[20, 24, 31], [30, 35, 45]];
  const RIM = [[44, 50, 62], [86, 96, 112]];
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => hash(a + ',' + b);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u;
    const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
    return a + (b - a) * v;
  }

  // Dessin de l'arbre pour un nombre d'arrosages donné (mis en cache) ; la graine qui palpite est
  // ajoutée à chaque image par frame().
  function build(w) {
    const cv = document.createElement('canvas');
    cv.width = AW; cv.height = AH;
    const ctx = cv.getContext('2d');
    // Masque : 1 là où l'arbre (ou la terre) est noir.
    const M = new Uint8Array(AW * AH);
    const set = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < AW && y < AH) M[y * AW + x] = 1; };
    const blob = (cx, cy, r, rag) => {
      for (let y = Math.floor(cy - r * 1.3); y <= cy + r * 1.3; y++) for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.3; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.15);
        // Bord déchiqueté : le contour suit un bruit, et des feuilles isolées dépassent.
        const edge = r * (0.72 + 0.5 * noise2(x * 0.45 + cx, y * 0.45 + cy));
        if (d < edge || (rag && d < r * 1.25 && hash(x + ':' + y) < 0.16)) set(x, y);
      }
    };
    const bx = AW / 2, by = AH - 4;
    // Monticule de terre.
    for (let y = by; y < AH; y++) for (let x = bx - 9; x <= bx + 9; x++) if (Math.abs(x - bx) < 9 - (y - by) * -0.5 + 1) set(x, y);
    let ext;
    if (w <= 0) {
      ext = { top: by - 4, left: bx - 7, right: bx + 7 };
      paint();
      return { cv, seed: true, ext };
    }
    const g = Math.min(1, w / MAX);
    const e = 1 - Math.pow(1 - g, 1.5);
    let minY = by, minX = bx, maxX = bx;
    const grow = (x, y) => { minY = Math.min(minY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); };
    // Une branche : plusieurs segments qui se tordent un peu, de plus en plus fins.
    function limb(path, x, y, a, len, w0, w1) {
      const segs = Math.max(2, Math.round(len / 5));
      let px = x, py = y, ang = a;
      for (let s = 0; s < segs; s++) {
        ang += (hash(path + 'w' + s) - 0.5) * 0.45;
        ang = Math.max(-Math.PI + 0.2, Math.min(-0.2, ang));
        const nx = px + Math.cos(ang) * len / segs, ny = py + Math.sin(ang) * len / segs;
        const n = Math.ceil(Math.hypot(nx - px, ny - py) * 2) + 1;
        for (let i = 0; i <= n; i++) {
          const k = i / n, cx = px + (nx - px) * k, cy = py + (ny - py) * k;
          const r = (w0 + (w1 - w0) * ((s + k) / segs)) / 2;
          for (let dx = -r; dx <= r; dx += 0.5) for (let dy = -r; dy <= r; dy += 0.5) if (dx * dx + dy * dy <= r * r) set(cx + dx, cy + dy);
        }
        px = nx; py = ny; grow(px, py);
      }
      return [px, py, ang];
    }
    const leaves = [];
    if (w < 6) {
      // Petite pousse : une tige fine et deux feuilles.
      const h = 3 + w * 2.2;
      const [tx, ty] = limb('p', bx, by, -Math.PI / 2, h, 1, 1);
      const lw = 1.5 + w * 0.7;
      blob(tx - lw, ty + 1, lw * 0.8, false); blob(tx + lw, ty, lw * 0.8, false);
      grow(tx - lw * 2, ty - lw); grow(tx + lw * 2, ty - lw);
    } else {
      const depthMax = Math.min(6, 2 + Math.floor(e * 4.6));
      const trunkLen = 8 + e * 26;
      const trunkW = 1.6 + e * 11;
      function branch(path, x, y, a, len, wd, d) {
        const [x2, y2, a2] = limb(path, x, y, a, len, wd, wd * 0.72);
        if (d >= depthMax || len < 3) { leaves.push([x2, y2, d]); return; }
        if (d >= Math.max(1, depthMax - 3)) leaves.push([(x + x2) / 2, (y + y2) / 2, d]);
        // Le chêne se divise tôt en grosses branches qui s'étalent.
        const n = d === 0 ? 3 : 2 + (hash(path + 'n') < 0.45 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const spread = (d === 0 ? 0.75 : 0.5) + 0.3 * hash(path + i + 's');
          let ang = a2 + (i - (n - 1) / 2) * spread + (hash(path + i + 'j') - 0.5) * 0.35;
          ang += (ang < -Math.PI / 2 ? -1 : 1) * 0.18 * e * (d < 2 ? 1 : 0.3);
          branch(path + i, x2, y2, ang, len * (0.66 + 0.18 * hash(path + i + 'l')), wd * 0.6, d + 1);
        }
      }
      branch('r', bx, by, -Math.PI / 2, trunkLen * (w < 13 ? 0.6 : 1), trunkW, 0);
      // Racines et base évasée.
      if (e > 0.25) {
        for (let i = -1; i <= 1; i += 2) for (let k = 0; k < 2; k++) limb('rt' + i + k, bx + i * trunkW * 0.2, by - 2, i > 0 ? -0.15 - k * 0.2 : -Math.PI + 0.15 + k * 0.2, trunkW * (0.9 + k * 0.5), trunkW * 0.45, 1);
      }
      // Feuillage : des touffes au contour déchiqueté.
      const fr = 2 + e * 7.5;
      for (const [lx, ly, d] of leaves) {
        const r = fr * (0.65 + 0.6 * hash(lx.toFixed(1) + ly.toFixed(1))) * (1 - d * 0.03);
        blob(lx, ly, r, true);
        grow(lx - r * 1.25, ly - r * 1.25); grow(lx + r * 1.25, ly);
      }
      // Quelques trouées dans la couronne, comme dans un vrai feuillage.
      if (e > 0.5) for (let i = 0; i < 6 + e * 10; i++) {
        const [lx, ly] = leaves[Math.floor(hash('tr' + i) * leaves.length)];
        const r = 0.8 + hash('tq' + i) * fr * 0.25;
        for (let y = Math.floor(ly - r); y <= ly + r; y++) for (let x = Math.floor(lx - r); x <= lx + r; x++) {
          if (Math.hypot(x - lx, y - ly) <= r && x >= 0 && y >= 0 && x < AW && y < AH) M[y * AW + x] = 0;
        }
      }
    }
    ext = { top: minY, left: minX, right: maxX };
    paint();
    return { cv, ext };

    // Encre noire ; un pixel du bord exposé vers le haut reçoit un reflet discret de la planète.
    function paint() {
      const img = ctx.createImageData(AW, AH), D = img.data;
      const at = (x, y) => (x >= 0 && y >= 0 && x < AW && y < AH ? M[y * AW + x] : 0);
      // Rien au-dessus sur 12 pixels : on est sur le contour extérieur (pas dans une trouée).
      const sky = (x, y) => { for (let k = 1; k <= 12; k++) if (at(x, y - k)) return false; return true; };
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        if (!M[y * AW + x]) {
          // Halo de contre-jour : la lumière de la planète déborde autour de la silhouette.
          if (y >= by - 1) continue;
          let near = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (at(x + dx, y + dy)) near = Math.max(near, 3 - Math.max(Math.abs(dx), Math.abs(dy)));
          if (!near || !sky(x, y + 1) || ((x + y) & 1 && near < 2)) continue;
          const c = HALO[near > 1 ? 1 : 0], o = (y * AW + x) * 4;
          D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
          continue;
        }
        let c = INK;
        if (y < by - 1 && sky(x, y)) c = RIM[hash('r' + x + ',' + y) < 0.35 ? 1 : 0];
        const o = (y * AW + x) * 4;
        D[o] = c[0]; D[o + 1] = c[1]; D[o + 2] = c[2]; D[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
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
    return tr0.ext;
  }

  // ─── Menu ───────────────────────────────────────────────────
  const el = { cv: null, hit: null, mirror: null };
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
    if (!o || o.ui.screen !== 'menu' || !el.cv || el.cv.hidden) { if (el.mirror) el.mirror.hidden = true; return; }
    // Une douzaine d'images par seconde suffit au scintillement.
    if (now - (loop.t || 0) > 80) { loop.t = now; extent = frame(el.cv, shownWater, now / 1000); }
    mirror();
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
  // Fiche ouverte : la toile 3D passe au-dessus de toute la page pour que la planète du fond reste
  // visible ; l'arbre, dessiné dans la page, serait caché derrière. On en montre alors une copie
  // au-dessus de la toile 3D, atténuée comme le reste du fond et coupée là où commence la fiche.
  function mirror() {
    const modal = document.body.classList.contains('modal');
    if (!modal) { if (el.mirror) el.mirror.hidden = true; return; }
    if (!el.mirror) {
      el.mirror = document.createElement('canvas');
      el.mirror.className = 'star-tree-mirror';
      el.mirror.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el.mirror);
    }
    const m = el.mirror, b = el.cv.getBoundingClientRect(), sh = document.getElementById('sheet').getBoundingClientRect();
    if (m.width !== el.cv.width || m.height !== el.cv.height) { m.width = el.cv.width; m.height = el.cv.height; }
    const ctx = m.getContext('2d');
    ctx.clearRect(0, 0, m.width, m.height);
    ctx.drawImage(el.cv, 0, 0);
    Object.assign(m.style, { left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
    const cut = Math.max(0, Math.ceil(b.bottom - sh.top));
    m.style.clipPath = cut ? `inset(0 0 ${cut}px 0)` : '';
    m.hidden = false;
  }

  // Arrivée au menu : la graine gagnée tombe et se plante, une seule fois.
  async function onMenu() {
    mount();
    // Kronos vaincu (ancienne campagne) ou ère I de la Genèse accomplie, même avant l'arrivée de
    // l'arbre : la graine est due.
    try {
      const st = JSON.parse(localStorage.getItem('orbite.campagne.stats')) || {};
      const gen = JSON.parse(localStorage.getItem('orbite.genese')) || {};
      if (st.wins > 0 || gen.done || (gen.era || 1) > 1) grant();
    } catch (e) { /* sauvegardes illisibles */ }
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
        ${full ? '' : `<button class="btn" id="treeSeed" ${api.seeds() < 1 ? 'disabled' : ''}>${tr('ARROSER ×{n}', { n: SEED_WATER })} · 1 ${api.icon('seed', 'seed')}</button>`}
        <button class="btn" id="treeClose">${tr('FERMER')}</button>
      </div>
      ${!full && have < COST ? `<p class="muted center">${tr('Il vous manque {n} poussières d’étoiles.', { n: COST - have })}</p>` : ''}`);
    const w = document.getElementById('treeWater');
    if (w) w.addEventListener('click', () => water(false));
    const ws = document.getElementById('treeSeed');
    if (ws) ws.addEventListener('click', () => water(true));
    document.getElementById('treeClose').addEventListener('click', () => api.closeSheet());
  }

  // Une graine de vie vaut plusieurs arrosages d'un coup.
  const SEED_WATER = 5;
  async function water(bySeed) {
    const api = A(), o = O(), s = load();
    if (s.water >= MAX) return;
    if (bySeed ? api.seeds() < 1 : api.dust() < COST) return;
    if (bySeed) api.addSeeds(-1); else api.addDust(-COST);
    const before = stageOf(s.water);
    const gain = bySeed ? Math.min(SEED_WATER, MAX - s.water) : 1;
    s.water += gain;
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
    const from = s.water - gain, t0 = performance.now();
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

  // Récompense de la campagne (ère I de la Genèse) : renvoie true si la graine vient d'être gagnée.
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
