/* ORBITE — le réveil. Une entité numérique faite de caractères nous parle, entourée de blocs de
 * données qui clignotent ; elle s'effondre en un point, explose en big bang numérique, et les
 * caractères retombent en une planète ASCII qui tourne : on vient de créer un monde.
 * Rendu sur un canvas 2D : une grille de petits caractères copiés depuis un atlas (rapide sur
 * téléphone). Pas de « ?. » ni de « ?? » : ce fichier se charge au lancement, même sur un vieil iPhone. */
(function () {
  'use strict';

  const CREAM = '#f1ecda';
  const MONO = 'ui-monospace, Menlo, Consolas, "Roboto Mono", "Courier New", monospace';
  // Du plus vide au plus dense : la teinte d'une case choisit son caractère.
  const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const NOISE = '01#%&@$*+=-:;<>?/\\|[]{}()!~^';
  const STARS = ".'`+*:.";
  const WORDS = ['ORBITE.SYS', 'ARECIBO//1974', 'CREATOR_ID', 'WAKE()', 'GENESIS', 'SIGNAL', 'NODE_07',
    'SYNC', 'INIT', 'MEMORY', 'ECHO', 'VOID', 'ORIGIN', 'CORE', 'SEED_0', 'COSMOS'];
  let CHARS = '';
  for (let c = 33; c < 127; c++) CHARS += String.fromCharCode(c);

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (s) => s[Math.floor(Math.random() * s.length)];
  const rampChar = (b) => RAMP[clamp(Math.floor(b * (RAMP.length - 1)), 0, RAMP.length - 1)];
  const easeIn = (k) => k * k * k;
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  function hash(x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ─── Silhouette : unions douces de capsules et d'ellipses (unité : hauteur du corps) ───
  function sdCapsule(px, py, ax, ay, bx, by, r) {
    const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
    const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
    return Math.hypot(pax - bax * h, pay - bay * h) - r;
  }
  function sdEllipse(px, py, cx, cy, rx, ry) { return (Math.hypot((px - cx) / rx, (py - cy) / ry) - 1) * Math.min(rx, ry); }
  function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
  function body(u, v) {
    const a = Math.abs(u);
    let d = sdEllipse(u, v, 0, 0.085, 0.06, 0.078);
    d = smin(d, sdCapsule(u, v, 0, 0.15, 0, 0.21, 0.026), 0.03);
    d = smin(d, sdCapsule(a, v, 0.03, 0.235, 0.125, 0.245, 0.042), 0.04);
    d = smin(d, sdEllipse(u, v, 0, 0.32, 0.125, 0.12), 0.05);
    d = smin(d, sdEllipse(u, v, 0, 0.44, 0.092, 0.09), 0.05);
    d = smin(d, sdEllipse(u, v, 0, 0.53, 0.112, 0.06), 0.04);
    d = smin(d, sdCapsule(a, v, 0.15, 0.25, 0.185, 0.4, 0.034), 0.03);
    d = smin(d, sdCapsule(a, v, 0.185, 0.4, 0.205, 0.55, 0.028), 0.02);
    d = smin(d, sdEllipse(a, v, 0.21, 0.585, 0.024, 0.036), 0.015);
    d = smin(d, sdCapsule(a, v, 0.058, 0.54, 0.07, 0.76, 0.05), 0.03);
    d = smin(d, sdCapsule(a, v, 0.07, 0.76, 0.075, 0.95, 0.036), 0.02);
    d = smin(d, sdCapsule(a, v, 0.072, 0.975, 0.1, 0.98, 0.02), 0.01);
    return d;
  }

  // Bruit de valeur 3D (continents et nuages de la planète), précalculé sur une carte lon/lat.
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const s = (t) => t * t * (3 - 2 * t);
    const u = s(x - xi), v = s(y - yi), w = s(z - zi);
    const h = (a, b, c) => hash(a * 7 + c * 131, b * 13 + c * 17);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
  }
  function fbm(x, y, z) { return noise3(x, y, z) * 0.55 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.15; }
  const MAP_W = 160, MAP_H = 80;
  let map = null;
  function planetMap() {
    if (map) return map;
    map = { land: new Float32Array(MAP_W * MAP_H), cloud: new Float32Array(MAP_W * MAP_H) };
    for (let j = 0; j < MAP_H; j++) {
      const lat = (j / (MAP_H - 1) - 0.5) * Math.PI;
      for (let i = 0; i < MAP_W; i++) {
        const lon = i / MAP_W * Math.PI * 2;
        const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
        map.land[j * MAP_W + i] = fbm(x * 1.9 + 5, y * 1.9 + 3, z * 1.9 + 1);
        map.cloud[j * MAP_W + i] = fbm(x * 3.2 + 11, y * 5 + 7, z * 3.2 + 2);
      }
    }
    return map;
  }

  function start(canvas) {
    const ctx = canvas.getContext('2d');
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    // Mesures en pixels CSS ; cw × ch : une case de la grille ; dpr : densité de l'écran.
    let W, H, dpr, cw, ch, cwPx, chPx, cols, rows, atlas, BF, occ;
    const glyph = {};
    let fig = [], halo = [], figRows = [], core = { x: 0, y: 0 };
    let blocks = [], drift = [], parts = [], sphere = [];
    let planet = { x: 0, y: 0, r: 0 };
    let ph = 'off', phT = 0;
    const appearDur = 1.8;
    let speakAmp = 0, glitch = {}, glitchUntil = 0, nextBlock = 0, bangT = -1, fade = 1, fadeFrom = 1, fadeT = -1, fadeDur = 1;
    let raf = 0, last = 0, stopped = false;
    const t0 = performance.now();
    const now = () => (performance.now() - t0) / 1000;
    const pending = [];

    function layout() {
      const r = canvas.parentElement.getBoundingClientRect();
      W = r.width || window.innerWidth;
      H = r.height || window.innerHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      // Des caractères minuscules (4 px sur un téléphone) : de loin, une matière ; de près, du texte.
      cw = clamp(Math.round(Math.min(W / 96, H / 150)), 3, 6);
      ch = Math.round(cw * 1.5);
      BF = Math.max(9, Math.round(cw * 2.4));
      cwPx = Math.max(1, Math.round(cw * dpr));
      chPx = Math.max(1, Math.round(ch * dpr));
      cols = Math.ceil(W / cw);
      rows = Math.ceil(H / ch);
      canvas.width = cols * cwPx;
      canvas.height = rows * chPx;
      canvas.style.width = cols * cw + 'px';
      canvas.style.height = rows * ch + 'px';
      occ = new Uint8Array(cols * rows);
      atlas = document.createElement('canvas');
      atlas.width = CHARS.length * cwPx;
      atlas.height = chPx;
      const a = atlas.getContext('2d');
      a.fillStyle = CREAM;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      a.font = Math.round(chPx * 0.9) + 'px ' + MONO;
      for (let i = 0; i < CHARS.length; i++) { glyph[CHARS[i]] = i; a.fillText(CHARS[i], i * cwPx + cwPx / 2, chPx * 0.55); }
      buildFigure();
      planet = { x: W / 2, y: H * 0.42, r: Math.min(W * 0.38, H * 0.23) };
    }

    // L'entité : chaque case du corps garde sa teinte (volume éclairé d'en haut à gauche, liseré à
    // droite, cœur lumineux), sa colonne de pluie de données et son seuil d'apparition. Le halo :
    // une poussière de points autour du corps. Les jambes se défont en données vers le bas.
    function buildFigure() {
      fig = []; halo = []; figRows = [];
      const FH = Math.min(H * 0.68, W * 1.7), top = H * 0.1, cx = W / 2;
      const L = [-0.5, -0.6, 0.62], ln = Math.hypot(L[0], L[1], L[2]);
      const e = 0.004, sp = 6 / cw;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const u = ((x + 0.5) * cw - cx) / FH, v = ((y + 0.5) * ch - top) / FH;
          if (v < -0.05 || v > 1.05 || Math.abs(u) > 0.32) continue;
          const d = body(u, v);
          if (d > 0.035) continue;
          if (d > 0.004) { halo.push({ x, y, k: 1 - d / 0.035, h: hash(x, y) }); continue; }
          const gx = (body(u + e, v) - body(u - e, v)) / (2 * e), gy = (body(u, v + e) - body(u, v - e)) / (2 * e);
          const t = clamp(-d / 0.04, 0, 1);
          let nx = gx * (1 - t), ny = gy * (1 - t), nz = 0.25 + t * 1.2;
          const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
          const lam = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ln);
          const rim = Math.pow(1 - t, 3) * Math.max(0, gx) * 0.7;
          const heart = Math.exp(-(u * u + (v - 0.3) * (v - 0.3)) / 0.004) * 0.45;
          const eye = sdEllipse(Math.abs(u), v, 0.023, 0.083, 0.012, 0.0065) < 0;
          const mouth = Math.abs(u) < 0.02 && Math.abs(v - 0.124) < 0.005;
          const c = { x, y, v, eye, mouth, edge: d > -0.01,
            lum: clamp(0.04 + 0.95 * Math.pow(lam, 1.35) + rim + heart, 0, 1),
            stripe: 0.72 + 0.28 * hash(x, 911), speed: (6 + hash(x, 77) * 14) * sp, len: (14 + hash(x, 5) * 26) * sp, ph: hash(x, 3) * 60,
            th: clamp((v + 0.02) / 1.04, 0, 1) * 0.7 + hash(x, y) * 0.3 };
          fig.push(c);
          (figRows[y] = figRows[y] || []).push(c);
        }
      }
      core = { x: cx / cw, y: (top + FH * 0.3) / ch };
    }

    // Un seul caractère par case et par image : pas de taches quand les particules se croisent.
    function put(c, x, y, a) {
      const g = glyph[c];
      if (g === undefined || a <= 0.02) return;
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= cols || y >= rows || occ[y * cols + x]) return;
      occ[y * cols + x] = 1;
      ctx.globalAlpha = (a > 1 ? 1 : a) * fade;
      ctx.drawImage(atlas, g * cwPx, 0, cwPx, chPx, x * cwPx, y * chPx, cwPx, chPx);
    }

    // ─── Blocs de données qui clignotent autour de l'entité (texte lisible, plus gros) ───
    function hex(n) { let s = ''; for (let i = 0; i < n; i++) s += pick('0123456789ABCDEF'); return s; }
    function bin(n) { let s = ''; for (let i = 0; i < n; i++) s += Math.random() < 0.5 ? '0' : '1'; return s; }
    function blockText() {
      const k = Math.random();
      if (k < 0.25) return [hex(4) + ' ' + hex(4), hex(4) + ' ' + hex(4), hex(4) + ' ' + hex(2)].slice(0, 1 + Math.floor(Math.random() * 3));
      if (k < 0.42) return [bin(8), bin(8), bin(4)].slice(0, 1 + Math.floor(Math.random() * 3));
      if (k < 0.72) return ['> ' + pick(WORDS), pick(['[OK]', '[..]', '[ERR]', '0x' + hex(4), '...', '>>>'])];
      if (k < 0.86) return [pick(['####==--..', '|||| || |', '=========', '# # ### #', '..--==##'])];
      return [pick(WORDS) + ':' + hex(2), '  ' + pick(WORDS)];
    }
    function spawnBlock(t) {
      const lines = blockText();
      const w = Math.max.apply(null, lines.map((l) => l.length)) * BF * 0.62;
      // Plutôt sur les côtés de l'entité, parfois par-dessus.
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = W / 2 + side * W * (0.1 + Math.random() * 0.26) - (side < 0 ? w : 0);
      const y = H * (0.07 + Math.random() * 0.68);
      blocks.push({ x: clamp(x, 8, W - w - 8), y, lines, inv: Math.random() < 0.22, t0: t, life: 0.35 + Math.random() * 1.3, slip: Math.random() < 0.3 });
    }
    function drawBlocks(t, alive) {
      if (alive && t > nextBlock && blocks.length < 7) { spawnBlock(t); nextBlock = t + 0.18 + Math.random() * (0.6 - speakAmp * 0.4); }
      blocks = blocks.filter((b) => t - b.t0 < b.life);
      if (!blocks.length) return;
      ctx.font = Math.round(BF * dpr) + 'px ' + MONO;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      const lh = BF * 1.3;
      for (const b of blocks) {
        const age = t - b.t0, shown = Math.floor(age * 70);
        const blink = age > b.life - 0.15 ? (Math.random() < 0.5 ? 0.25 : 0.9) : 1;
        b.lines.forEach((line, i) => {
          const txt = line.slice(0, Math.max(0, shown - i * 4));
          if (!txt) return;
          // Une ligne glisse parfois de côté, comme un signal mal reçu.
          const x = (b.x + (b.slip && Math.random() < 0.15 ? (Math.random() - 0.5) * BF * 2 : 0)) * dpr, y = (b.y + i * lh) * dpr;
          if (b.inv) {
            ctx.globalAlpha = 0.9 * blink * fade;
            ctx.fillStyle = CREAM;
            ctx.fillRect(x - 3 * dpr, y - 1 * dpr, ctx.measureText(txt).width + 6 * dpr, lh * dpr);
            ctx.fillStyle = '#000';
          } else {
            ctx.globalAlpha = 0.85 * blink * fade;
            ctx.fillStyle = CREAM;
          }
          ctx.fillText(txt, x, y);
        });
      }
    }

    function drawFigure(t, alive) {
      const appear = ph === 'appear' ? clamp((t - phT) / appearDur, 0, 1) * 1.08 : 2;
      const scan = ((t * 0.45) % 1.3) * rows;
      if (t > glitchUntil) glitch = {};
      speakAmp *= 0.9;
      for (const h of halo) {
        if (h.h > 0.16 * h.k || appear < 1) continue;
        put(Math.random() < 0.5 ? '.' : "'", h.x, h.y, 0.12 + 0.2 * h.k * (0.6 + 0.4 * Math.sin(t * 3 + h.h * 40)));
      }
      for (const c of fig) {
        if (c.th > appear) continue;
        if (c.edge && Math.random() < 0.25) continue;
        // Les jambes se défont : de moins en moins de caractères vers les pieds.
        if (c.v > 0.74 && Math.random() < (c.v - 0.74) * 3.2) continue;
        let lum = c.lum * c.stripe;
        const rain = (c.y + c.ph - t * c.speed) % c.len;
        const rr = rain < 0 ? rain + c.len : rain;
        if (rr < 3) lum += 0.45 * (1 - rr / 3);
        lum += 0.25 * Math.max(0, 1 - Math.abs(c.y - scan) / 2);
        let chr;
        if (appear - c.th < 0.06) { chr = pick(NOISE); lum = 1; }
        else if (c.eye) { chr = pick('@$0O#'); lum = 0.9 + 0.1 * Math.sin(t * 6); }
        else if (c.mouth && speakAmp > 0.15) { chr = pick('=~-oO0'); lum = 0.55 + speakAmp * 0.45; }
        else if (Math.random() < 0.02 + speakAmp * 0.04) chr = pick(NOISE);
        else chr = rampChar(clamp(lum, 0.03, 1));
        put(chr, c.x + (glitch[c.y] || 0), c.y, 0.12 + 0.88 * clamp(lum, 0, 1));
      }
      // Des caractères s'échappent des bords et montent en s'effaçant ; d'autres tombent des pieds.
      if (alive && fig.length) {
        for (let i = 0; i < 2; i++) {
          const c = fig[Math.floor(Math.random() * fig.length)];
          if (c.edge || c.v > 0.85) drift.push({ x: c.x, y: c.y, t0: t, c: pick(NOISE + RAMP.slice(40)), up: c.v < 0.85 });
        }
      }
      drift = drift.filter((d) => t - d.t0 < 1.6);
      for (const d of drift) {
        const a = t - d.t0;
        put(d.c, d.x + Math.sin(a * 3 + d.x) * 0.8, d.y + (d.up ? -1 : 0.7) * a * 32 / ch, 0.55 * (1 - a / 1.6));
      }
    }

    // ─── Effondrement : tout le corps tourbillonne vers le cœur ───
    function drawImplode(t) {
      const k = clamp((t - phT) / 1.4, 0, 1);
      for (const c of fig) {
        // Chaque caractère part à son heure et tourne à sa vitesse : un tourbillon, pas un bloc.
        const e = easeIn(clamp((k - c.th * 0.25) / 0.75, 0, 1));
        const dx = (c.x - core.x) * cw, dy = (c.y - core.y) * ch;
        const ang = e * (1.5 + 3.5 * hash(c.x, c.y + 7)), s = 1 - e;
        const rx = (dx * Math.cos(ang) - dy * Math.sin(ang)) * s, ry = (dx * Math.sin(ang) + dy * Math.cos(ang)) * s;
        const lum = clamp(c.lum + e * 1.2, 0, 1);
        put(Math.random() < e ? pick('@#*%&$+:') : rampChar(lum), core.x + rx / cw, core.y + ry / ch, 0.2 + 0.8 * lum);
      }
      blocks = blocks.filter(() => Math.random() > 0.06);
      drawBlocks(t, false);
    }

    // ─── Big bang : éclair, rayons de caractères et onde de choc (vitesses en px/s) ───
    const RAYS = ['-', '\\', '|', '/'];
    function makeParts() {
      parts = [];
      const n = Math.min(2600, Math.round(cols * rows * 0.16));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, fast = Math.random() < 0.22;
        const sp = fast ? 440 + Math.random() * 420 : 30 + 300 * Math.pow(Math.random(), 1.5);
        // Caractère de rayon selon la direction (l'axe y descend à l'écran).
        const dir = Math.round(((a + Math.PI * 2) % Math.PI) / (Math.PI / 4)) % 4;
        parts.push({ a, sp, fast, c: fast ? RAYS[[0, 3, 2, 1][dir]] : pick(".:*+'`"), ph: Math.random() * 6 });
      }
    }
    function partPos(p, tau) {
      const r = p.sp * (1 - Math.exp(-tau * 2.2)) / 2.2;
      return [core.x + Math.cos(p.a) * r / cw, core.y + Math.sin(p.a) * r / ch];
    }
    function drawBang(t) {
      const tau = t - bangT;
      // Onde de choc : un anneau de caractères qui s'élargit.
      const ringA = clamp(1 - tau / 1.1, 0, 1);
      for (let w = 0; w < 3 && ringA > 0; w++) {
        const R = Math.max(0, tau * 480 - w * ch);
        const steps = Math.max(24, Math.round(Math.PI * 2 * R / cw * 0.9));
        for (let i = 0; i < steps; i++) {
          const a = i / steps * Math.PI * 2;
          put(w ? pick('.:*') : pick('oO0@'), core.x + Math.cos(a) * R / cw, core.y + Math.sin(a) * R / ch, ringA * (1 - w * 0.3));
        }
      }
      for (const p of parts) {
        if (p.fast) {
          const a = clamp(1 - tau / 1.4, 0, 1);
          if (a <= 0) continue;
          for (let k = 0; k < 7; k++) {
            const b = partPos(p, Math.max(0, tau - k * 0.022));
            put(p.c, b[0], b[1], a * (1 - k * 0.13));
          }
          continue;
        }
        const xy = partPos(p, tau);
        if (p.star) put(p.c, xy[0], xy[1], 0.22 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.ph)));
        else if (!p.planet) put(p.c, xy[0], xy[1], clamp(1 - tau / 2.6, 0, 1) * 0.9);
      }
      put('@', core.x, core.y, clamp(1 - tau * 3, 0, 1));
    }

    // ─── La planète : chaque case de la sphère reçoit une particule du big bang ───
    function makeSphere(t) {
      planetMap();
      sphere = [];
      const slow = parts.filter((p) => !p.fast);
      const tau = t - bangT;
      // Quelques particules restent en étoiles éparses autour de la planète.
      for (const p of slow) if (Math.random() < 0.08) { p.star = true; p.c = pick(STARS); }
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const dx = ((x + 0.5) * cw - planet.x) / planet.r, dy = ((y + 0.5) * ch - planet.y) / planet.r;
          const d2 = dx * dx + dy * dy;
          if (d2 > 1.1) continue;
          const src = slow[Math.floor(Math.random() * slow.length)];
          if (src && !src.star) src.planet = true;
          const from = src ? partPos(src, tau) : [core.x, core.y];
          sphere.push({ x, y, nx: dx, ny: dy, nz: Math.sqrt(Math.max(0, 1 - d2)), rim: d2 > 1, fx: from[0], fy: from[1], delay: hash(x, y) * 0.7, d: hash(y, x + 99) });
        }
      }
    }
    function drawPlanet(t) {
      const k0 = t - phT, rot = t * 0.3;
      const m = map;
      const L = [-0.55, -0.5, 0.68], ln = Math.hypot(L[0], L[1], L[2]);
      const Hx = L[0] / ln, Hy = L[1] / ln, Hz = L[2] / ln + 1, hl = Math.hypot(Hx, Hy, Hz);
      for (const c of sphere) {
        const k = ph === 'planet' ? 1 : clamp((k0 - c.delay) / 1.2, 0, 1);
        const e = easeOut(k);
        const x = c.fx + (c.x - c.fx) * e, y = c.fy + (c.y - c.fy) * e;
        const lam = Math.max(0, (c.nx * L[0] + c.ny * L[1] + c.nz * L[2]) / ln);
        if (c.rim) {
          if (k >= 1 && lam > 0.04) put(pick('.:'), x, y, 0.35 * lam + 0.05);
          continue;
        }
        if (k < 1) { put(pick(NOISE), x, y, 0.5 + 0.5 * k); continue; }
        // Longitude et latitude après rotation, lues sur la carte des continents et des nuages.
        const lon = Math.atan2(c.nx, c.nz) + rot, lat = Math.asin(clamp(-c.ny, -1, 1));
        const i = (Math.floor((lon / (Math.PI * 2)) * MAP_W) % MAP_W + MAP_W) % MAP_W;
        const j = clamp(Math.floor((lat / Math.PI + 0.5) * (MAP_H - 1)), 0, MAP_H - 1);
        const land = m.land[j * MAP_W + i], cloud = m.cloud[j * MAP_W + (i + Math.floor(t * 3)) % MAP_W];
        const lit = Math.pow(lam, 0.85);
        let b;
        if (land > 0.5) b = lit * (0.82 + (land - 0.5) * 2.2);
        else {
          const spec = Math.pow(Math.max(0, (c.nx * Hx + c.ny * Hy + c.nz * Hz) / hl), 30) * 0.7;
          b = lit * 0.3 + spec;
        }
        if (cloud > 0.6) b = Math.max(b, lit * (0.85 + (cloud - 0.6) * 2));
        // Tramage : la même teinte n'aligne plus les mêmes caractères d'une ligne à l'autre.
        b = clamp(b * (0.7 + 0.3 * c.nz) + (c.d - 0.5) * 0.08, 0.03, 1);
        put(rampChar(b), x, y, 0.1 + 0.9 * b);
      }
    }

    function drawFlash(t) {
      if (bangT < 0) return;
      const tau = t - bangT;
      if (tau > 0.55) return;
      ctx.globalAlpha = (reduce ? 0.3 : 0.92) * Math.pow(1 - tau / 0.55, 2) * fade;
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function frame(ms) {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      if (ms - last < 30) return;
      last = ms;
      const t = now();
      if (fadeT >= 0) fade = fadeFrom * (1 - clamp((t - fadeT) / fadeDur, 0, 1));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      occ.fill(0);
      // Secousse pendant l'effondrement et au début du big bang.
      let shake = 0;
      if (ph === 'implode') shake = easeIn(clamp((t - phT) / 1.4, 0, 1)) * 3;
      if (ph === 'bang') shake = clamp(1 - (t - bangT) / 0.6, 0, 1) * 4;
      if (shake && !reduce) ctx.setTransform(1, 0, 0, 1, Math.round((Math.random() - 0.5) * shake) * cwPx, Math.round((Math.random() - 0.5) * shake) * chPx);
      if (ph === 'appear' || ph === 'idle') { drawFigure(t, true); drawBlocks(t, true); }
      else if (ph === 'implode') drawImplode(t);
      else if (ph === 'bang') drawBang(t);
      else if (ph === 'form' || ph === 'planet') { drawBang(t); drawPlanet(t); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawFlash(t);
      ctx.globalAlpha = 1;
    }

    // Une étape qui dure sec secondes ; cut() les termine toutes d'un coup (le joueur passe l'intro).
    function step(name, sec) {
      ph = name; phT = now();
      return new Promise((resolve) => {
        const id = setTimeout(done, sec * 1000);
        function done() { clearTimeout(id); const i = pending.indexOf(done); if (i >= 0) pending.splice(i, 1); resolve(); }
        pending.push(done);
      });
    }

    layout();
    const onResize = () => { if (ph === 'off' || ph === 'appear' || ph === 'idle') layout(); };
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    return {
      appear() { return step('appear', appearDur).then(() => { if (ph === 'appear') ph = 'idle'; }); },
      // Chaque lettre prononcée : la bouche s'anime, des lignes du corps glissent, un bloc surgit.
      speak() {
        const t = now();
        speakAmp = 1;
        if (Math.random() < 0.5) spawnBlock(t);
        if (Math.random() < 0.45) {
          const ys = Object.keys(figRows);
          const y0 = Number(ys[Math.floor(Math.random() * ys.length)]);
          for (let i = 0; i < 1 + Math.floor(Math.random() * 4); i++) glitch[y0 + i] = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 4));
          glitchUntil = t + 0.09;
        }
      },
      implode() { return step('implode', 1.4); },
      bang() { makeParts(); bangT = now(); return step('bang', 1.25); },
      form() { makeSphere(now()); return step('form', 2.3).then(() => { if (ph === 'form') ph = 'planet'; }); },
      fadeOut(ms) { fadeFrom = fade; fadeT = now(); fadeDur = (ms || 900) / 1000; return new Promise((r) => setTimeout(r, ms || 900)); },
      cut() { pending.slice().forEach((f) => f()); },
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }

  window.OrbiteEveil = { start };
})();
