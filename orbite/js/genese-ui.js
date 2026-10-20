/* ORBITE — écran de la Genèse, ère I « La Poussière » : le grain dérive dans la nébuleuse (vue du
 * dessus, pixel art), on le guide au doigt, il absorbe la matière plus petite que lui, fuit les
 * astres cerclés de rouge, et grossit palier après palier. Entre deux paliers, le Façonnage
 * (l'éditeur, comme dans Spore) lui ajoute des pièces. Les règles sont dans genese.js. */
(function () {
  'use strict';
  const O = window.__orbite, G = window.OrbiteGenese;
  if (!O || !G) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const { esc } = A;
  const KEY = 'orbite.genese';
  const PX = 3; // pixels d'écran par pixel du jeu
  const STEP = 1 / 60;

  const ui = { g: null, raf: 0, last: 0, acc: 0, cam: null, scale: 0, input: { x: 0, y: 0 }, stick: null, keys: {}, dash: false, pulse: false,
    parts: [], motes: [], shake: 0, flash: 0, paused: false, editor: false, hudAt: 0, saveAt: 0, sprites: new Map(), rings: [], ended: false };

  // ─── Couleurs ───────────────────────────────────────────────
  const RAMP = {
    glace: ['#16305a', '#2f68b0', '#6fb4ec', '#d8f2ff'],
    roche: ['#33201a', '#704630', '#b07448', '#e6b482'],
    gaz: ['#2e1850', '#5e3896', '#9a74d6', '#e2ccff'],
    errant: ['#151014', '#352a2e', '#5e4e50', '#8e7a7c'],
    comete: ['#1e3a66', '#4a8ad0', '#a8dcff', '#ffffff']
  };
  const TINT = { glace: [58, 123, 213], roche: [192, 96, 58], gaz: [138, 79, 208] };
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  // Le grain prend la couleur de ce qu'il a absorbé.
  function playerRamp(g) {
    const s = G.shares(g);
    return [0, 1, 2, 3].map((i) => rgbHex([0, 1, 2].map((c) => hexRgb(RAMP.glace[i])[c] * s.glace + hexRgb(RAMP.roche[i])[c] * s.roche + hexRgb(RAMP.gaz[i])[c] * s.gaz)));
  }

  // ─── Sprites : astres irréguliers ombrés, tramés ─────────────
  const BAYER = [[0, 2], [3, 1]];
  function shapeFn(seed, amp) {
    const ph = [seed % 628 / 100, (seed >> 3) % 628 / 100, (seed >> 6) % 628 / 100];
    return (a) => 1 + amp * (0.5 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(3 * a + ph[1]) + 0.2 * Math.sin(5 * a + ph[2]));
  }
  function makeSprite(R, ramp, seed, amp, o) {
    o = o || {};
    const S = Math.ceil(R * (1 + amp) + 2) * 2 + 1, c = (S - 1) / 2;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const f = shapeFn(seed, amp);
    const cols = ramp.map(hexRgb);
    const img = ctx.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const edge = R * f(a);
      if (d > edge + 0.5) continue;
      const k = d / Math.max(0.5, edge);
      // Lumière venue du haut à gauche, sur une sphère approximative.
      const nz = Math.sqrt(Math.max(0, 1 - k * k));
      let l = (-dx * 0.55 - dy * 0.65) / Math.max(1, edge) + nz * 0.75;
      if (o.gas) l = 0.55 + nz * 0.5 - k * 0.3;
      const t = l + (BAYER[y & 1][x & 1] - 1.5) * 0.12;
      const idx = t < 0.15 ? 0 : t < 0.5 ? 1 : t < 0.85 ? 2 : 3;
      let alpha = 255;
      if (o.gas) {
        if (k > 0.55 && (BAYER[y & 1][x & 1] + Math.floor(k * 8)) % 3 === 0) continue;
        alpha = k > 0.8 ? 150 : 225;
      }
      const p = (y * S + x) * 4, col = (o.rim && d > edge - 1.2) ? hexRgb(o.rim) : cols[idx];
      img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  function sprite(key, R, ramp, seed, amp, o) {
    const k = key + ':' + R + ':' + seed;
    let s = ui.sprites.get(k);
    if (!s) {
      if (ui.sprites.size > 600) ui.sprites.clear();
      s = makeSprite(R, ramp, seed, amp, o);
      ui.sprites.set(k, s);
    }
    return s;
  }
  const ROUND = [0.34, 0.24, 0.15, 0.09, 0.05];

  // ─── Fond : nébuleuse teintée par la région, étoiles en parallaxe ─
  const NEB = 96;
  let nebula = null;
  function nebulaTiles() {
    if (nebula) return nebula;
    nebula = {};
    for (const [k, c] of Object.entries(TINT)) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = NEB;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(NEB, NEB);
      for (let y = 0; y < NEB; y++) for (let x = 0; x < NEB; x++) {
        // Bruit périodique (le motif se répète sans couture).
        const n = 0.6 * tile(x / NEB * 4, y / NEB * 4, 4, 11) + 0.4 * tile(x / NEB * 8, y / NEB * 8, 8, 23);
        let a = Math.max(0, n - 0.38) * 1.9;
        a = a + (BAYER[y & 1][x & 1] - 1.5) * 0.06;
        const p = (y * NEB + x) * 4;
        img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = Math.max(0, Math.min(1, a)) * 92;
      }
      ctx.putImageData(img, 0, 0);
      nebula[k] = cv;
    }
    return nebula;
  }
  function tile(x, y, P, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const h = (a, b) => { let v = (Math.imul((a % P + P) % P, 374761393) ^ Math.imul((b % P + P) % P, 668265263) ^ seed) >>> 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
    const s = (t) => t * t * (3 - 2 * t);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
  }
  const starHash = (x, y, l) => { let v = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(l + 1, 83492791)) >>> 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };

  // ─── Dessin d'une image ─────────────────────────────────────
  function draw(now) {
    const g = ui.g, cv = $('gnCanvas'), v = $('gnView');
    const W = Math.ceil(v.clientWidth / PX), H = Math.ceil(v.clientHeight / PX);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const me = g.me, r = G.radius(me.m);
    // Échelle : la largeur de l'écran couvre viewWidth rayons ; elle suit la croissance en douceur.
    const want = W / G.viewWidth(g);
    ui.scale = ui.scale ? ui.scale + (want - ui.scale) * 0.06 : want;
    const s = ui.scale;
    if (!ui.cam) ui.cam = { x: me.x, y: me.y };
    ui.cam.x += (me.x + me.vx * 0.25 - ui.cam.x) * 0.12;
    ui.cam.y += (me.y + me.vy * 0.25 - ui.cam.y) * 0.12;
    let shx = 0, shy = 0;
    if (ui.shake > 0) { shx = (Math.random() - 0.5) * ui.shake; shy = (Math.random() - 0.5) * ui.shake; }
    const sx = (x) => Math.round((x - ui.cam.x) * s + W / 2 + shx), sy = (y) => Math.round((y - ui.cam.y) * s + H / 2 + shy);

    // Fond.
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, W, H);
    const z = G.zoneAt(g.seed, me.x, me.y, r), neb = nebulaTiles();
    const px = ui.cam.x * s * 0.12, py = ui.cam.y * s * 0.12;
    for (const k of G.MATTERS) {
      ctx.globalAlpha = Math.min(1, 0.25 + z[k] * 1.1);
      const ox = -((px + (k === 'roche' ? 40 : k === 'gaz' ? 70 : 0)) % NEB + NEB) % NEB, oy = -((py + (k === 'gaz' ? 30 : 0)) % NEB + NEB) % NEB;
      for (let y = oy; y < H; y += NEB) for (let x = ox; x < W; x += NEB) ctx.drawImage(neb[k], x, y);
    }
    ctx.globalAlpha = 1;
    for (const [l, par, cell] of [[0, 0.03, 14], [1, 0.09, 22], [2, 0.2, 34]]) {
      const ox = ui.cam.x * s * par, oy = ui.cam.y * s * par;
      const c0 = Math.floor(ox / cell), r0 = Math.floor(oy / cell);
      for (let cy = r0; cy <= r0 + Math.ceil(H / cell) + 1; cy++) for (let cx = c0; cx <= c0 + Math.ceil(W / cell) + 1; cx++) {
        const h = starHash(cx, cy, l);
        if (h > 0.55) continue;
        const x = Math.round(cx * cell - ox + h * cell * 1.7), y = Math.round(cy * cell - oy + starHash(cy, cx, l) * cell);
        const tw = l === 2 && Math.sin(now / 300 + h * 40) > 0.6;
        ctx.fillStyle = l === 0 ? '#3c3850' : l === 1 ? '#7a7690' : tw ? '#ffffff' : '#c8c4dc';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Poussières fines : elles filent à contresens, on sent la vitesse.
    if (!ui.motes.length) for (let i = 0; i < 46; i++) ui.motes.push({ x: Math.random() * W, y: Math.random() * H, d: 0.3 + Math.random() * 0.7 });
    ctx.fillStyle = 'rgba(220,210,190,0.45)';
    for (const m of ui.motes) {
      m.x -= me.vx * s * 0.016 * m.d; m.y -= me.vy * s * 0.016 * m.d;
      m.x = (m.x % W + W) % W; m.y = (m.y % H + H) % H;
      ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }

    // Champ d'attraction.
    const pull = G.has(g, 'gravite') ? 10 : G.has(g, 'aimant') ? 5 : 0;
    if (pull) {
      ctx.fillStyle = 'rgba(140,220,255,0.35)';
      const R = pull * r * s;
      for (let i = 0; i < 28; i++) {
        const a = i / 28 * Math.PI * 2 + now / 1800;
        ctx.fillRect(Math.round(W / 2 + shx + (me.x - ui.cam.x) * s + Math.cos(a) * R), Math.round(H / 2 + shy + (me.y - ui.cam.y) * s + Math.sin(a) * R), 1, 1);
      }
    }

    // Corps célestes.
    const hunters = [];
    for (const b of g.bodies) {
      const x = sx(b.x), y = sy(b.y), R = Math.max(1, Math.round(b.r * s));
      if (x < -R * 2 - 4 || y < -R * 2 - 4 || x > W + R * 2 + 4 || y > H + R * 2 + 4) {
        if (b.hunter && b.r > r && Math.hypot(b.x - me.x, b.y - me.y) < 18 * r) hunters.push(b);
        continue;
      }
      if (b.k === 'fragment') { drawFragment(ctx, x, y, now); continue; }
      if (b.k === 'etincelle') { drawSpark(ctx, x, y, now, b.id); continue; }
      if (b.k === 'comete') {
        const sp = Math.hypot(b.vx, b.vy) || 1;
        for (let i = 1; i < 18; i++) {
          ctx.fillStyle = `rgba(170,220,255,${0.5 * (1 - i / 18)})`;
          const w = Math.max(1, Math.round(R * (1 - i / 18)));
          ctx.fillRect(Math.round(x - b.vx / sp * i * R * 0.7) - (w >> 1), Math.round(y - b.vy / sp * i * R * 0.7) - (w >> 1), w, w);
        }
      }
      const amp = b.k === 'gaz' ? 0.12 : b.k === 'glace' ? 0.18 : 0.3;
      const spr = sprite(b.k, R, RAMP[b.k] || RAMP.roche, b.shape, amp, { gas: b.k === 'gaz' });
      ctx.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1));
      // Plus gros que vous : un cercle rouge (pulsant s'il chasse).
      if (!G.edible(g, b, r) && b.r > r * 0.95) dangerRing(ctx, x, y, R, b.hunter, now);
    }

    // Traînées et particules.
    for (let i = ui.parts.length - 1; i >= 0; i--) {
      const p = ui.parts[i];
      p.life -= 1 / 60;
      if (p.life <= 0) { ui.parts.splice(i, 1); continue; }
      if (p.to) { p.x += (me.x - p.x) * 0.16; p.y += (me.y - p.y) * 0.16; } else { p.x += p.vx / 60; p.y += p.vy / 60; }
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillRect(sx(p.x), sy(p.y), p.size || 1, p.size || 1);
    }
    ctx.globalAlpha = 1;
    // Anneaux (palier franchi, décharge).
    for (let i = ui.rings.length - 1; i >= 0; i--) {
      const q = ui.rings[i];
      q.t += 1 / 60;
      if (q.t > q.d) { ui.rings.splice(i, 1); continue; }
      const k = q.t / q.d, R = q.r0 + (q.r1 - q.r0) * k;
      ctx.fillStyle = q.c;
      ctx.globalAlpha = 1 - k;
      const n = Math.max(16, Math.round(R * 1.5));
      for (let j = 0; j < n; j++) { const a = j / n * Math.PI * 2; ctx.fillRect(Math.round(W / 2 + (me.x - ui.cam.x) * s + Math.cos(a) * R), Math.round(H / 2 + (me.y - ui.cam.y) * s + Math.sin(a) * R), 1, 1); }
      ctx.globalAlpha = 1;
    }

    // Le grain.
    drawPlayer(ctx, sx(me.x), sy(me.y), Math.max(2, Math.round(r * s)), now, true);

    // Chasseurs hors de vue (Œil stellaire) et fragment hors de vue.
    if (G.has(g, 'oeil')) for (const b of hunters) edgeArrow(ctx, W, H, b.x - me.x, b.y - me.y, '#ff5a4a', now);
    const fr = g.bodies.find((b) => b.k === 'fragment');
    if (fr) {
      const x = sx(fr.x), y = sy(fr.y);
      if (x < 0 || y < 0 || x > W || y > H) edgeArrow(ctx, W, H, fr.x - me.x, fr.y - me.y, '#ffd770', now);
    }
    // Éclair rouge quand on est heurté.
    if (ui.flash > 0) { ctx.fillStyle = `rgba(255,60,40,${ui.flash * 0.22})`; ctx.fillRect(0, 0, W, H); ui.flash = Math.max(0, ui.flash - 0.05); }
    ui.shake = Math.max(0, ui.shake - 0.5);
  }
  function dangerRing(ctx, x, y, R, hunter, now) {
    const pulse = hunter ? 0.6 + 0.4 * Math.sin(now / 150) : 0.75;
    ctx.fillStyle = `rgba(255,72,56,${pulse})`;
    const rr = R + 2.5, n = Math.max(24, Math.round(rr * 6.3));
    const rot = now / (hunter ? 500 : 3000);
    for (let j = 0; j < n; j++) {
      // Tirets : trois points allumés, deux éteints.
      if ((j % 5) > 2) continue;
      const a = j / n * Math.PI * 2 + rot;
      ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 1);
    }
  }
  function drawFragment(ctx, x, y, now) {
    const k = Math.floor(now / 120) % 4, R = 3 + (k === 1 || k === 3 ? 1 : 0);
    ctx.fillStyle = 'rgba(255,215,112,0.25)';
    ctx.fillRect(x - R - 2, y - 1, R * 2 + 5, 3); ctx.fillRect(x - 1, y - R - 2, 3, R * 2 + 5);
    ctx.fillStyle = '#ffd770';
    for (let i = -R; i <= R; i++) { const w = R - Math.abs(i); ctx.fillRect(x - w, y + i, w * 2 + 1, 1); }
    ctx.fillStyle = '#fff6d0';
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }
  function drawSpark(ctx, x, y, now, id) {
    const on = Math.sin(now / 140 + id) > -0.2;
    ctx.fillStyle = on ? '#ffffff' : '#a8b4ff';
    ctx.fillRect(x, y, 1, 1);
    if (on) { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
  }
  function edgeArrow(ctx, W, H, dx, dy, col, now) {
    const a = Math.atan2(dy, dx), m = 8;
    const t = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-3), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-3));
    const x = Math.round(W / 2 + Math.cos(a) * t), y = Math.round(H / 2 + Math.sin(a) * t);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 200);
    for (let i = 0; i < 4; i++) for (let j = -i; j <= i; j++) {
      const px = x - Math.cos(a) * (4 - i) - Math.sin(a) * j * 0.8, py = y - Math.sin(a) * (4 - i) + Math.cos(a) * j * 0.8;
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  // Le grain et ses pièces (aussi dessiné en grand dans le Façonnage).
  function drawPlayer(ctx, x, y, R, now, live) {
    const g = ui.g, me = g.me;
    const ramp = playerRamp(g);
    const rim = G.has(g, 'croute') ? '#2a1c14' : null;
    // Halo.
    const glow = ctx.createRadialGradient(x, y, R * 0.5, x, y, R * 2.4);
    glow.addColorStop(0, 'rgba(255,240,200,0.18)');
    glow.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - R * 3, y - R * 3, R * 6, R * 6);
    if (live && me.dashT > 0) {
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.25 / i;
        const spr = sprite('me' + ramp.join() + rim, R, ramp, 4242, ROUND[g.lvl] || 0.05, { rim });
        ctx.drawImage(spr, x - (spr.width >> 1) - Math.round(me.vx * 0.012 * i * ui.scale), y - (spr.height >> 1) - Math.round(me.vy * 0.012 * i * ui.scale));
      }
      ctx.globalAlpha = 1;
    }
    if (G.has(g, 'pointes')) {
      ctx.fillStyle = '#e6b482';
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * Math.PI * 2 + (live ? me.face : now / 2000);
        for (let k = 0; k < Math.max(2, Math.round(R * 0.35)); k++) ctx.fillRect(Math.round(x + Math.cos(a) * (R + k)), Math.round(y + Math.sin(a) * (R + k)), 1, 1);
      }
    }
    const spr = sprite('me' + ramp.join() + rim, R, ramp, 4242, ROUND[g.lvl] || 0.05, { rim });
    ctx.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1));
    if (G.has(g, 'givre') && (!live || g.t - me.shieldAt >= 10)) {
      ctx.fillStyle = 'rgba(190,235,255,0.75)';
      const n = Math.max(18, Math.round(R * 6));
      for (let j = 0; j < n; j += 2) { const a = j / n * Math.PI * 2 - now / 1500; ctx.fillRect(Math.round(x + Math.cos(a) * (R + 3)), Math.round(y + Math.sin(a) * (R + 3)), 1, 1); }
    }
    if (G.has(g, 'oeil')) { ctx.fillStyle = '#fff8d8'; ctx.fillRect(Math.round(x + Math.cos(me.face) * R * 0.45), Math.round(y + Math.sin(me.face) * R * 0.45), 1, 1); }
    if (live && Math.hypot(me.vx, me.vy) > 2 * G.radius(me.m) && (G.has(g, 'jets') || G.has(g, 'voile'))) {
      const col = G.has(g, 'voile') ? '#ffe9a8' : '#bfe8ff';
      ui.parts.push({ x: me.x - me.vx * 0.02 + (Math.random() - 0.5) * G.radius(me.m), y: me.y - me.vy * 0.02 + (Math.random() - 0.5) * G.radius(me.m), vx: -me.vx * 0.3, vy: -me.vy * 0.3, life: 0.4, c: col });
    }
  }

  // ─── Boucle ─────────────────────────────────────────────────
  function frame(now) {
    if (!$('genese').classList.contains('active')) { ui.raf = 0; return; }
    ui.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - (ui.last || now)) / 1000);
    ui.last = now;
    const g = ui.g;
    if (!ui.paused && !ui.editor && !document.hidden && !g.done) {
      ui.acc += dt;
      let n = 0;
      while (ui.acc >= STEP && n++ < 6) {
        ui.acc -= STEP;
        const k = ui.keys;
        const kx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.q || k.a ? 1 : 0), ky = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.z || k.w ? 1 : 0);
        const input = { x: ui.input.x + kx, y: ui.input.y + ky, dash: ui.dash, pulse: ui.pulse };
        ui.dash = ui.pulse = false;
        G.step(g, STEP, input);
        handle(g.events.splice(0));
        if (ui.editor || g.done) break;
      }
      if (now - ui.saveAt > 5000) { ui.saveAt = now; save(); }
    }
    draw(now);
    if (now - ui.hudAt > 120) { ui.hudAt = now; hud(); }
  }
  let eatSfx = 0;
  function handle(events) {
    const g = ui.g, me = g.me, r = G.radius(me.m);
    for (const e of events) {
      if (e.t === 'eat') {
        const col = (RAMP[e.k] || RAMP.roche)[2];
        for (let i = 0; i < 6; i++) ui.parts.push({ x: e.x + (Math.random() - 0.5) * e.r * 2, y: e.y + (Math.random() - 0.5) * e.r * 2, to: true, life: 0.5, c: col });
        if (performance.now() - eatSfx > 90) { eatSfx = performance.now(); SFX.place(); }
        if (e.sparks) $('gnSparks').classList.add('pop');
      } else if (e.t === 'spark') {
        for (let i = 0; i < 10; i++) ui.parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 8 * r, vy: (Math.random() - 0.5) * 8 * r, life: 0.6, c: '#ffffff' });
        SFX.coin();
        $('gnSparks').classList.add('pop');
      } else if (e.t === 'hit') {
        ui.shake = 6; ui.flash = 1;
        SFX.hit(Math.min(3, e.dmg / 10));
        A.vibrate && A.vibrate(40);
        hint('hit');
      } else if (e.t === 'shield') {
        ui.rings.push({ t: 0, d: 0.5, r0: r * ui.scale, r1: r * ui.scale * 2.5, c: '#bfeaff' });
        SFX.freeze();
      } else if (e.t === 'shatter') {
        ui.shake = 4;
        for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, v = (2 + Math.random() * 6) * r; ui.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, c: '#e6b482', size: 1 }); }
        SFX.debris();
      } else if (e.t === 'dash') {
        SFX.whoosh(0);
      } else if (e.t === 'pulse') {
        ui.rings.push({ t: 0, d: 0.6, r0: r * ui.scale, r1: r * ui.scale * 8, c: '#9fe0ff' });
        SFX.charge();
      } else if (e.t === 'fragment') {
        SFX.golden();
        ui.rings.push({ t: 0, d: 0.8, r0: r * ui.scale, r1: r * ui.scale * 5, c: '#ffd770' });
        banner(tr('FRAGMENT D’ASTRE'), tr('Vous découvrez : {p}', { p: tr(G.PARTS[e.part].name) }), 'win');
        $('gnEdit').classList.add('new');
      } else if (e.t === 'death') {
        ui.shake = 10; ui.flash = 1;
        SFX.death(0);
        for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, v = (3 + Math.random() * 9) * r; ui.parts.push({ x: me.x, y: me.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c: playerRamp(g)[2], size: 1 }); }
        banner(tr('VOTRE GRAIN SE DISPERSE'), tr('…puis se reforme, un peu plus petit.'), 'lose');
      } else if (e.t === 'level') {
        levelUp(e.lvl);
      } else if (e.t === 'end') {
        endEra();
      }
    }
  }
  async function levelUp(lvl) {
    const g = ui.g, r = G.radius(g.me.m);
    G.syncLevel(g);
    SFX.level();
    ui.rings.push({ t: 0, d: 1, r0: r * ui.scale, r1: r * ui.scale * 6, c: '#ffffff' });
    banner(tr(G.LEVELS[lvl].name).toUpperCase(), tr('Un emplacement de plus dans le Façonnage.'), 'win');
    save();
    ui.paused = true;
    await A.wait(1300);
    ui.paused = false;
    openEditor();
  }

  // ─── Interface ──────────────────────────────────────────────
  // Bandeau propre à l'écran (celui du jeu vit dans l'écran de partie). Durée un peu plus longue.
  function banner(title, sub, cls) {
    const b = $('gnBanner');
    b.className = 'banner gn-banner';
    void b.offsetWidth;
    b.innerHTML = `<h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}`;
    b.classList.add('show');
    if (cls) b.classList.add(cls);
    b.style.animationDuration = '2200ms';
  }
  function hud() {
    const g = ui.g;
    if (!g) return;
    const lvl = G.levelOf(g.me.m);
    $('gnLevel').textContent = tr(G.LEVELS[lvl].name).toUpperCase();
    $('gnNext').textContent = lvl + 1 < G.LEVELS.length ? tr(G.LEVELS[lvl + 1].name) : tr('Planétésimal');
    $('gnProg').style.width = (G.progress(g) * 100).toFixed(1) + '%';
    $('gnHp').style.width = (Math.max(0, g.me.hp) / G.maxHp(g) * 100).toFixed(1) + '%';
    $('gnHp').classList.toggle('low', g.me.hp < G.maxHp(g) * 0.3);
    $('gnSparks').innerHTML = `<i class="gn-star">✦</i>${g.sparks}`;
    setTimeout(() => $('gnSparks').classList.remove('pop'), 200);
    const sh = G.shares(g), nat = G.nature(g);
    $('gnDiet').innerHTML = G.MATTERS.map((k) => `<span class="gn-mat ${k}"><i style="height:${Math.round(sh[k] * 100)}%"></i></span>`).join('') +
      `<small>${tr('Vers')}<b>${esc(tr(G.NATURES[nat].name))}</b></small>`;
    const dash = $('gnDash'), pulse = $('gnPulse');
    dash.hidden = !G.has(g, 'eruption');
    pulse.hidden = !G.has(g, 'decharge');
    dash.style.setProperty('--cd', (g.me.dashCd / 3.5).toFixed(2));
    pulse.style.setProperty('--cd', (g.me.pulseCd / 8).toFixed(2));
  }
  // Conseils, une seule fois chacun.
  const HINTS = {
    start: 'Glissez le doigt pour guider le grain. Absorbez tout ce qui est plus petit que vous.',
    hit: 'Les astres cerclés de rouge sont plus gros que vous : fuyez-les, ou grossissez d’abord.',
    diet: 'Glace, roche ou gaz : ce que vous absorbez décide de ce que deviendra votre astre.',
    edit: 'Les étincelles ✦ servent au Façonnage : ajoutez des pièces à votre grain.'
  };
  function hint(k) {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(KEY + '.aide') || '{}'); } catch (err) { /* illisible */ }
    if (seen[k]) return;
    seen[k] = 1;
    try { localStorage.setItem(KEY + '.aide', JSON.stringify(seen)); } catch (err) { /* stockage indisponible */ }
    const el = $('gnHint');
    el.textContent = tr(HINTS[k]);
    el.classList.add('show');
    clearTimeout(hint.t);
    hint.t = setTimeout(() => el.classList.remove('show'), 5200);
  }

  // ─── Façonnage ──────────────────────────────────────────────
  function openEditor() {
    if (!ui.g || ui.g.done) return;
    ui.editor = true;
    $('gnEdit').classList.remove('new');
    SFX.open();
    renderEditor();
    $('gnEditor').hidden = false;
    requestAnimationFrame(() => $('gnEditor').classList.add('show'));
    editorLoop();
  }
  function closeEditor() {
    ui.editor = false;
    SFX.close();
    $('gnEditor').classList.remove('show');
    setTimeout(() => { if (!ui.editor) $('gnEditor').hidden = true; }, 250);
    save();
    hud();
  }
  function renderEditor() {
    const g = ui.g, lvl = G.syncLevel(g), slots = G.slotsAt(lvl);
    $('gnEdHead').innerHTML = `<b>${tr('FAÇONNAGE')}</b><small>${esc(tr(G.LEVELS[lvl].name))} · ${tr('{a} / {b} emplacements', { a: g.parts.length, b: slots })}</small><span class="gn-ed-sparks">✦ ${g.sparks}</span>`;
    $('gnEdSlots').innerHTML = Array.from({ length: G.LEVELS.length }, (_, i) => `<i class="${i < g.parts.length ? 'used' : i < slots ? 'open' : ''}"></i>`).join('');
    $('gnEdList').innerHTML = Object.entries(G.CATS).map(([cat, name]) => {
      const rows = Object.entries(G.PARTS).filter(([, p]) => p.cat === cat).map(([k, p]) => {
        const on = G.has(g, k), known = g.owned.includes(k), can = G.canInstall(g, k);
        if (!known) return `<div class="gn-part locked"><span class="gn-part-ico">?</span><span class="gn-part-txt"><b>???</b><small>${tr('Trouvez un fragment d’astre pour la découvrir.')}</small></span></div>`;
        return `<div class="gn-part ${on ? 'on' : ''}"><span class="gn-part-ico">${partIcon(k)}</span><span class="gn-part-txt"><b>${esc(tr(p.name))}</b><small>${esc(tr(p.text))}</small></span>
          ${on ? `<button class="btn" data-gn-rm="${k}">${tr('RETIRER')} · ✦${p.cost}</button>` : `<button class="btn primary" data-gn-add="${k}" ${can.ok ? '' : 'disabled'}>✦ ${p.cost}</button>`}</div>`;
      }).join('');
      return `<h4 class="fg-h">${tr(name)}</h4>${rows}`;
    }).join('');
  }
  const PART_ICON = { jets: '»', eruption: '⇶', voile: '◇', aimant: '◎', gravite: '◉', croute: '▣', givre: '❄', pointes: '✶', decharge: 'ϟ', oeil: '◐' };
  const partIcon = (k) => PART_ICON[k] || '·';
  // Aperçu du grain qui tourne doucement.
  function editorLoop() {
    if (!ui.editor) return;
    const cv = $('gnEdView'), ctx = cv.getContext('2d');
    const W = 72, H = 72;
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    const now = performance.now();
    ui.g.me.face = now / 1600;
    drawPlayer(ctx, W >> 1, H >> 1, 18, now, false);
    requestAnimationFrame(editorLoop);
  }

  // ─── Fin de l'ère I ─────────────────────────────────────────
  async function endEra() {
    if (ui.ended) return;
    ui.ended = true;
    const g = ui.g;
    save();
    SFX.win();
    await A.wait(900);
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    const nat = G.nature(g), tra = G.trait(g);
    g.result = { nature: nat, trait: tra };
    save();
    A.addSeeds(3);
    const R = window.OrbiteRecit;
    if (R) {
      const look = { eau: { type: 'ice', seed: 5101 }, feu: { type: 'lava', seed: 5103 }, etoile: { type: 'gas', seed: 5107 }, vie: { type: 'terran', seed: 5109 } }[nat];
      stage.register('genese-end', look);
      await R.openStory();
      await R.wait(700);
      await R.tell([tr('Votre grain a tant grossi qu’il attire la matière par sa seule gravité.'), tr('Ce n’est plus une poussière. C’est un planétésimal.')]);
      await R.reveal('genese-end');
      await R.tell([tr(G.NATURES[nat].text), tr('Trait gagné : {t}. {d}', { t: tr(G.TRAITS[tra].name), d: tr(G.TRAITS[tra].text) })]);
      await R.title(tr('ÈRE II'), tr('L’ASTÉROÏDE · BIENTÔT'));
      await R.wait(2600);
    }
    A.toast(tr('+3 graines de vie'), 2200);
    await A.backToMenu();
  }

  // ─── Sauvegarde, ouverture ──────────────────────────────────
  function save() {
    if (!ui.g) return;
    const o = G.serialize(ui.g);
    if (ui.g.result) o.result = ui.g.result;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (err) { /* stockage indisponible */ }
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      const g = G.restore(o);
      if (g && o.result) g.result = o.result;
      return g;
    } catch (err) { return null; }
  }
  async function open(g) {
    ui.g = g || load() || G.newGame((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    ui.cam = null; ui.scale = 0; ui.parts = []; ui.rings = []; ui.motes = []; ui.ended = false; ui.editor = false; ui.paused = false;
    ui.input = { x: 0, y: 0 }; ui.last = 0; ui.acc = 0;
    $('gnEditor').hidden = true;
    $('gnEditor').classList.remove('show');
    save();
    await A.show('genese');
    stage.sky = 0;
    hud();
    cancelAnimationFrame(ui.raf);
    ui.raf = requestAnimationFrame(frame);
    setTimeout(() => hint('start'), 600);
    setTimeout(() => hint('diet'), 16000);
    setTimeout(() => hint('edit'), 32000);
  }
  async function leave() {
    SFX.tap();
    save();
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    await A.backToMenu();
  }

  // ─── Commandes ──────────────────────────────────────────────
  const view = $('gnView');
  // Joystick virtuel : on pose le doigt n'importe où et on glisse.
  view.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || ui.editor) return;
    ui.stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
    const st = $('gnStick');
    st.style.left = e.clientX + 'px';
    st.style.top = e.clientY + 'px';
    st.classList.add('on');
    st.firstElementChild.style.transform = 'translate(-50%,-50%)';
  });
  window.addEventListener('pointermove', (e) => {
    if (!ui.stick || e.pointerId !== ui.stick.id) return;
    const dx = e.clientX - ui.stick.x, dy = e.clientY - ui.stick.y, d = Math.hypot(dx, dy), R = 44;
    const k = d > R ? R / d : 1, l = Math.min(1, d / R);
    ui.input = d ? { x: dx / d * l, y: dy / d * l } : { x: 0, y: 0 };
    $('gnStick').firstElementChild.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
  });
  const release = (e) => {
    if (!ui.stick || e.pointerId !== ui.stick.id) return;
    ui.stick = null;
    ui.input = { x: 0, y: 0 };
    $('gnStick').classList.remove('on');
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', (e) => {
    if (!$('genese').classList.contains('active')) return;
    ui.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = true;
    if (e.key === ' ') { ui.dash = true; e.preventDefault(); }
    if (e.key === 'e' || e.key === 'E') ui.pulse = true;
  });
  window.addEventListener('keyup', (e) => { ui.keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.g && $('genese').classList.contains('active')) save(); });

  $('gnBack').innerHTML = A.icon('back');
  $('gnBack').addEventListener('click', leave);
  $('gnDash').addEventListener('pointerdown', (e) => { e.stopPropagation(); ui.dash = true; });
  $('gnPulse').addEventListener('pointerdown', (e) => { e.stopPropagation(); ui.pulse = true; });
  $('gnEdit').addEventListener('click', () => openEditor());
  $('gnEdDone').addEventListener('click', closeEditor);
  $('gnEdList').addEventListener('click', (e) => {
    const add = e.target.closest('[data-gn-add]'), rm = e.target.closest('[data-gn-rm]');
    if (add && !add.disabled) {
      const res = G.install(ui.g, add.dataset.gnAdd);
      if (res.ok) { SFX.buy(); } else A.refuse(tr(res.reason));
    } else if (rm) { G.remove(ui.g, rm.dataset.gnRm); SFX.sell(); } else return;
    renderEditor();
  });

  const has = () => !!load();
  window.OrbiteGeneseUI = { open, leave, load, has, save, get state() { return ui; } };
})();
