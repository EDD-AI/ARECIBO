/* ORBITE — écran de l'Essaim (Genèse, ère II, chapitre 1). Le planétésimal tourne autour d'une
 * jeune étoile, vue du dessus en pixel art. Sans doigt, il suit son orbite ; doigt posé, il se
 * propulse vers lui. Glisser à côté d'un rocher le capture (un lien se tisse) ; foncer dedans
 * l'absorbe et chauffe. Les règles sont dans essaim.js ; le dessin réutilise celui de la Genèse. */
(function () {
  'use strict';
  const O = window.__orbite, E = window.OrbiteEssaim, GU = window.OrbiteGeneseUI;
  if (!O || !E || !GU || !GU.gfx) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const { esc } = A;
  const { PX, RAMP, makeSprite, landmark, starHash } = GU.gfx;
  const KEY = 'orbite.genese.essaim';
  const STEP = 1 / 60;

  const ui = { e: null, raf: 0, last: 0, acc: 0, cam: null, scale: 0, par: { x: 0, y: 0 }, input: { x: 0, y: 0 }, touch: null, keys: {}, boost: false,
    parts: [], rings: [], shake: 0, flash: 0, hudAt: 0, saveAt: 0, ended: false, sprites: new Map(), dust: null, started: 0 };

  // ─── Sprites éclairés par l'étoile ──────────────────────────
  // La lumière vient toujours du centre du système : on range l'angle en 16 directions.
  function lit(key, R, ramp, seed, amp, x, y, o) {
    const a = Math.atan2(-y, -x), q = ((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16;
    const k = key + ':' + R + ':' + seed + ':' + q;
    let s = ui.sprites.get(k);
    if (!s) {
      if (ui.sprites.size > 900) ui.sprites.clear();
      const qa = q * Math.PI / 8;
      s = makeSprite(R, ramp, seed, amp, Object.assign({ lx: Math.cos(qa) * 0.85, ly: Math.sin(qa) * 0.85 }, o || {}));
      ui.sprites.set(k, s);
    }
    return s;
  }
  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const rgbHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function myRamp(e) {
    const s = E.shares(e);
    return [0, 1, 2, 3].map((i) => rgbHex([0, 1, 2].map((c) => E.MATTERS.reduce((t, k) => t + hexRgb(RAMP[k][i])[c] * s[k], 0))));
  }
  const RIVAL_RAMP = { roche: RAMP.roche, fer: RAMP.fer, glace: RAMP.glace };

  // Poussière de la ceinture (décor) : des grains qui tournent avec elle.
  function beltDust() {
    if (ui.dust) return ui.dust;
    const d = [];
    for (let i = 0; i < 900; i++) {
      const R = E.BELT[0] - 40 + starHash(i, 1, 3) * (E.BELT[1] - E.BELT[0] + 80);
      d.push({ R, th: starHash(i, 2, 3) * Math.PI * 2, w: E.vcirc(R) / R, b: starHash(i, 3, 3) });
    }
    return (ui.dust = d);
  }

  // ─── Dessin ─────────────────────────────────────────────────
  function draw(now) {
    const e = ui.e, cv = $('esCanvas'), v = $('esView');
    const W = Math.ceil(v.clientWidth / PX), H = Math.ceil(v.clientHeight / PX);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const me = e.me, r = E.radius(me.M);
    const want = W / E.viewWidth(e);
    ui.scale = ui.scale ? ui.scale + (want - ui.scale) * 0.035 : want;
    const s = ui.scale;
    if (!ui.cam) ui.cam = { x: me.x, y: me.y };
    const ocx = ui.cam.x, ocy = ui.cam.y;
    ui.cam.x += (me.x - ui.cam.x) * 0.2;
    ui.cam.y += (me.y - ui.cam.y) * 0.2;
    ui.par.x += (ui.cam.x - ocx) * s;
    ui.par.y += (ui.cam.y - ocy) * s;
    let shx = 0, shy = 0;
    if (ui.shake > 0) { shx = (Math.random() - 0.5) * ui.shake; shy = (Math.random() - 0.5) * ui.shake; }
    const sx = (x) => Math.round((x - ui.cam.x) * s + W / 2 + shx), sy = (y) => Math.round((y - ui.cam.y) * s + H / 2 + shy);

    // Fond étoilé et repères lointains.
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, W, H);
    for (const [l, par, cell] of [[0, 0.02, 14], [1, 0.05, 22], [2, 0.1, 34]]) {
      const ox = ui.par.x * par, oy = ui.par.y * par;
      const c0 = Math.floor(ox / cell), r0 = Math.floor(oy / cell);
      for (let cy = r0; cy <= r0 + Math.ceil(H / cell) + 1; cy++) for (let cx = c0; cx <= c0 + Math.ceil(W / cell) + 1; cx++) {
        const h = starHash(cx, cy, l);
        if (h > 0.5) continue;
        ctx.fillStyle = l === 0 ? '#3c3850' : l === 1 ? '#7a7690' : '#c8c4dc';
        ctx.fillRect(Math.round(cx * cell - ox + h * cell * 1.7), Math.round(cy * cell - oy + starHash(cy, cx, l) * cell), 1, 1);
      }
    }
    const LC = 150, lox = ui.par.x * 0.03, loy = ui.par.y * 0.03;
    for (let cy = Math.floor(loy / LC) - 1; cy <= Math.floor((loy + H) / LC) + 1; cy++) for (let cx = Math.floor(lox / LC) - 1; cx <= Math.floor((lox + W) / LC) + 1; cx++) {
      const h = starHash(cx, cy, 7);
      if (h > 0.35) continue;
      // Au loin, seulement des amas et des galaxies : rien qu'on prenne pour un astre du jeu.
      const lm = landmark(1 + Math.floor(starHash(cy, cx, 8) * 2), Math.floor(h * 1e6));
      ctx.globalAlpha = 0.28;
      ctx.drawImage(lm, Math.round(cx * LC - lox + starHash(cx, cy, 9) * LC * 0.6 - lm.width / 2), Math.round(cy * LC - loy + starHash(cy, cx, 9) * LC * 0.6 - lm.height / 2));
    }
    ctx.globalAlpha = 1;

    // L'étoile : à l'écran, ou sa lueur sur le bord qui lui fait face.
    const stx = sx(0), sty = sy(0), SR = 70 * s;
    if (stx > -SR * 3 && sty > -SR * 3 && stx < W + SR * 3 && sty < H + SR * 3) {
      const gl = ctx.createRadialGradient(stx, sty, SR * 0.4, stx, sty, SR * 3);
      gl.addColorStop(0, 'rgba(255,236,190,0.9)'); gl.addColorStop(0.35, 'rgba(255,200,120,0.25)'); gl.addColorStop(1, 'rgba(255,180,100,0)');
      ctx.fillStyle = gl; ctx.fillRect(stx - SR * 3, sty - SR * 3, SR * 6, SR * 6);
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath(); ctx.arc(stx, sty, SR, 0, Math.PI * 2); ctx.fill();
    } else {
      const a = Math.atan2(sty - H / 2, stx - W / 2);
      const t = Math.min((W / 2) / Math.abs(Math.cos(a) || 1e-3), (H / 2) / Math.abs(Math.sin(a) || 1e-3));
      const ex = W / 2 + Math.cos(a) * t, ey = H / 2 + Math.sin(a) * t;
      const gl = ctx.createRadialGradient(ex, ey, 0, ex, ey, H * 0.55);
      gl.addColorStop(0, 'rgba(255,214,150,0.22)'); gl.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      const ix = Math.round(W / 2 + Math.cos(a) * (t - 12)), iy = Math.round(H / 2 + Math.sin(a) * (t - 12));
      ctx.fillRect(ix - 1, iy - 1, 3, 3); ctx.fillRect(ix - 3, iy, 7, 1); ctx.fillRect(ix, iy - 3, 1, 7);
    }
    // Poussière de la ceinture.
    const tt = e.t;
    for (const d of beltDust()) {
      const th = d.th + d.w * tt, x = sx(Math.cos(th) * d.R), y = sy(Math.sin(th) * d.R);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      ctx.fillStyle = d.b < 0.3 ? 'rgba(200,180,150,0.5)' : 'rgba(150,140,130,0.3)';
      ctx.fillRect(x, y, 1, 1);
    }
    // Votre orbite actuelle, en pointillé.
    const Rme = Math.hypot(me.x, me.y), thMe = Math.atan2(me.y, me.x), span = (E.viewWidth(e) * 1.6) / Rme;
    ctx.fillStyle = 'rgba(255,240,200,0.32)';
    for (let a = thMe - span; a < thMe + span; a += 5 / (Rme * s)) {
      if (Math.round((a - thMe) * Rme * s / 5) % 2) continue;
      ctx.fillRect(sx(Math.cos(a) * Rme), sy(Math.sin(a) * Rme), 1, 1);
    }

    // Rochers.
    for (const k of e.rocks) {
      const x = sx(k.x), y = sy(k.y), R = Math.max(1, Math.round(k.r * s));
      if (x < -R * 2 || y < -R * 2 || x > W + R * 2 || y > H + R * 2) continue;
      const spr = lit(k.k, R, RAMP[k.k] || RAMP.roche, k.shape, k.k === 'gaz' ? 0.12 : 0.3, k.x, k.y, { gas: k.k === 'gaz' });
      ctx.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1));
      if (k.m >= me.M) ring(ctx, x, y, R + 2.5, 'rgba(255,72,56,0.75)', now / 3000);
    }
    // Lien de capture.
    if (e.tether) {
      const o = e.rocks.find((k) => k.id === e.tether.id) || e.rivals.find((rv) => rv.id === e.tether.id);
      if (o) {
        const x0 = sx(me.x), y0 = sy(me.y), x1 = sx(o.x), y1 = sy(o.y), n = Math.max(4, Math.hypot(x1 - x0, y1 - y0) / 3);
        ctx.fillStyle = 'rgba(160,230,255,0.85)';
        for (let i = 0; i <= n; i++) if ((i + Math.floor(now / 90)) % 3) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 1, 1);
        const orr = (o.r || E.radius(o.M)) * s + 3;
        ctx.fillStyle = '#bff0ff';
        const steps = Math.max(16, Math.round(orr * 6.3));
        for (let j = 0; j < steps * Math.min(1, e.tether.p); j++) { const a = -Math.PI / 2 + j / steps * Math.PI * 2; ctx.fillRect(Math.round(x1 + Math.cos(a) * orr), Math.round(y1 + Math.sin(a) * orr), 1, 1); }
      }
    }
    // Rivales.
    const tags = [];
    for (const rv of e.rivals) {
      if (!rv.alive) continue;
      const x = sx(rv.x), y = sy(rv.y), R = Math.max(2, Math.round(E.radius(rv.M) * s));
      const bigger = rv.M >= me.M * 0.9;
      if (x < -R || y < -R || x > W + R || y > H + R) {
        edgeArrow(ctx, W, H, rv.x - me.x, rv.y - me.y, bigger ? '#ff5a4a' : '#7ee08a', now);
        continue;
      }
      const spr = lit('rv' + rv.k, R, RIVAL_RAMP[rv.k], 7000 + rv.id.charCodeAt(1), 0.18, rv.x, rv.y);
      ctx.drawImage(spr, x - (spr.width >> 1), y - (spr.height >> 1));
      ring(ctx, x, y, R + 3, bigger ? `rgba(255,72,56,${0.55 + 0.35 * Math.sin(now / 200)})` : 'rgba(126,224,138,0.7)', now / 2500);
      tags.push({ name: tr(rv.name), x: x * PX, y: (y - R - 6) * PX, bigger });
    }
    // Comètes.
    for (const c of e.comets) {
      const x = sx(c.x), y = sy(c.y), R = Math.max(1, Math.round(c.r * s)), sp = Math.hypot(c.vx - me.vx, c.vy - me.vy) || 1;
      for (let i = 1; i < 16; i++) {
        ctx.fillStyle = `rgba(170,220,255,${0.5 * (1 - i / 16)})`;
        const w = Math.max(1, Math.round(R * (1 - i / 16)));
        ctx.fillRect(Math.round(x - (c.vx - me.vx) / sp * i * R) - (w >> 1), Math.round(y - (c.vy - me.vy) / sp * i * R) - (w >> 1), w, w);
      }
      ctx.fillStyle = '#eaf8ff'; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    }
    // Particules.
    for (let i = ui.parts.length - 1; i >= 0; i--) {
      const p = ui.parts[i];
      p.life -= 1 / 60;
      if (p.life <= 0) { ui.parts.splice(i, 1); continue; }
      if (p.to) { p.x += (me.x - p.x) * 0.16; p.y += (me.y - p.y) * 0.16; } else { p.x += (p.vx + me.vx) / 60; p.y += (p.vy + me.vy) / 60; }
      ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillRect(sx(p.x), sy(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    for (let i = ui.rings.length - 1; i >= 0; i--) {
      const q = ui.rings[i];
      q.t += 1 / 60;
      if (q.t > q.d) { ui.rings.splice(i, 1); continue; }
      const k = q.t / q.d;
      ctx.globalAlpha = 1 - k;
      ring(ctx, q.x != null ? sx(q.x) : sx(me.x), q.y != null ? sy(q.y) : sy(me.y), q.r0 + (q.r1 - q.r0) * k, q.c, 0, true);
      ctx.globalAlpha = 1;
    }

    // Vos lunes, puis vous.
    const px = sx(me.x), py = sy(me.y), PR = Math.max(3, Math.round(r * s));
    for (const sat of e.sats) {
      const wx = me.x + Math.cos(sat.ang) * sat.d, wy = me.y + Math.sin(sat.ang) * sat.d;
      const R = Math.max(1, Math.round(sat.r * s));
      const spr = lit('sat' + sat.k, R, RAMP[sat.k] || RAMP.roche, sat.shape, sat.big ? 0.12 : 0.28, wx, wy);
      ctx.drawImage(spr, sx(wx) - (spr.width >> 1), sy(wy) - (spr.height >> 1));
      if (e.t - sat.blockAt < 0.4) ring(ctx, sx(wx), sy(wy), R + 3, '#bff0ff', 0, true);
    }
    const heat = Math.min(1, me.heat / 100);
    if (heat > 0.05) {
      const gl = ctx.createRadialGradient(px, py, PR * 0.8, px, py, PR * 2.6);
      gl.addColorStop(0, `rgba(255,120,40,${0.55 * heat})`); gl.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = gl; ctx.fillRect(px - PR * 3, py - PR * 3, PR * 6, PR * 6);
    }
    const amp = Math.max(0.06, 0.3 - 0.012 * me.M);
    const ramp = myRamp(e);
    const spr = lit('me' + ramp.join(), PR, ramp, e.seed % 9973, amp, me.x, me.y);
    ctx.drawImage(spr, px - (spr.width >> 1), py - (spr.height >> 1));
    if (me.heat > 70) {
      // La croûte se fissure : des veines de lave clignotent.
      ctx.fillStyle = Math.sin(now / 90) > 0 ? '#ffb040' : '#ff6a20';
      for (let i = 0; i < 9; i++) { const a = i * 2.39 + e.seed, d = (0.2 + (i % 4) * 0.18) * PR; ctx.fillRect(Math.round(px + Math.cos(a) * d), Math.round(py + Math.sin(a) * d), 1, 1); }
    }
    if (ui.flash > 0) { ctx.fillStyle = `rgba(255,60,40,${ui.flash * 0.22})`; ctx.fillRect(0, 0, W, H); ui.flash = Math.max(0, ui.flash - 0.05); }
    ui.shake = Math.max(0, ui.shake - 0.5);
    placeTags(tags);
  }
  function ring(ctx, x, y, R, col, rot, solid) {
    ctx.fillStyle = col;
    const n = Math.max(20, Math.round(R * 6.3));
    for (let j = 0; j < n; j++) {
      if (!solid && (j % 5) > 2) continue;
      const a = j / n * Math.PI * 2 + (rot || 0);
      ctx.fillRect(Math.round(x + Math.cos(a) * R), Math.round(y + Math.sin(a) * R), 1, 1);
    }
  }
  function edgeArrow(ctx, W, H, dx, dy, col, now) {
    const a = Math.atan2(dy, dx), m = 8;
    const t = Math.min((W / 2 - m) / Math.abs(Math.cos(a) || 1e-3), (H / 2 - m) / Math.abs(Math.sin(a) || 1e-3));
    const x = Math.round(W / 2 + Math.cos(a) * t), y = Math.round(H / 2 + Math.sin(a) * t);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 200);
    for (let i = 0; i < 4; i++) for (let j = -i; j <= i; j++) ctx.fillRect(Math.round(x - Math.cos(a) * (4 - i) - Math.sin(a) * j * 0.8), Math.round(y - Math.sin(a) * (4 - i) + Math.cos(a) * j * 0.8), 1, 1);
    ctx.globalAlpha = 1;
  }
  // Étiquettes des rivales (texte net, au-dessus du canevas).
  function placeTags(tags) {
    const box = $('esTags');
    while (box.children.length < tags.length) box.appendChild(document.createElement('span'));
    [...box.children].forEach((el, i) => {
      const t = tags[i];
      if (!t) { el.hidden = true; return; }
      el.hidden = false;
      el.className = 'es-tag ' + (t.bigger ? 'big' : 'small');
      if (el.dataset.n !== t.name + t.bigger) { el.dataset.n = t.name + t.bigger; el.textContent = t.name + (t.bigger ? ' · ' + tr('plus grosse') : ' · ' + tr('à votre portée')); }
      // L'étiquette reste dans l'écran, même si la rivale touche le bord.
      const half = (el.offsetWidth || 120) / 2, Wv = box.clientWidth || 390;
      const x = Math.max(half + 6, Math.min(Wv - half - 6, t.x));
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(24, t.y))}px) translate(-50%, -100%)`;
    });
  }

  // ─── Boucle ─────────────────────────────────────────────────
  function frame(now) {
    if (!$('essaim').classList.contains('active')) { ui.raf = 0; return; }
    ui.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - (ui.last || now)) / 1000);
    ui.last = now;
    const e = ui.e;
    if (!document.hidden && !e.done) {
      steer();
      ui.acc += dt;
      let n = 0;
      while (ui.acc >= STEP && n++ < 6) {
        ui.acc -= STEP;
        const k = ui.keys;
        const kx = (k.ArrowRight || k.d ? 1 : 0) - (k.ArrowLeft || k.q || k.a ? 1 : 0), ky = (k.ArrowDown || k.s ? 1 : 0) - (k.ArrowUp || k.z || k.w ? 1 : 0);
        E.step(e, STEP, { x: ui.input.x + kx, y: ui.input.y + ky, boost: ui.boost });
        ui.boost = false;
        handle(e.events.splice(0));
        if (e.done) break;
      }
      if (now - ui.saveAt > 5000) { ui.saveAt = now; save(); }
      if (now - ui.started > 9000) hint('capture');
      if (now - ui.started > 26000) hint('rivals');
    }
    draw(now);
    if (now - ui.hudAt > 120) { ui.hudAt = now; hud(); }
  }
  // Doigt posé : poussée vers lui (pleine au-delà de 60 px d'écran).
  function steer() {
    if (!ui.touch || !ui.cam) { ui.input = { x: 0, y: 0 }; return; }
    const b = $('esView').getBoundingClientRect(), cv = $('esCanvas');
    const tx = ((ui.touch.x - b.left) / PX - cv.width / 2) / ui.scale + ui.cam.x, ty = ((ui.touch.y - b.top) / PX - cv.height / 2) / ui.scale + ui.cam.y;
    const dx = tx - ui.e.me.x, dy = ty - ui.e.me.y, d = Math.hypot(dx, dy), l = Math.min(1, d * ui.scale * PX / 60);
    ui.input = d ? { x: dx / d * l, y: dy / d * l } : { x: 0, y: 0 };
  }
  let eatSfx = 0;
  function handle(events) {
    const e = ui.e, me = e.me, r = E.radius(me.M);
    for (const ev of events) {
      if (ev.t === 'eat' || ev.t === 'impact') {
        const col = (RAMP[ev.k] || RAMP.roche)[2];
        for (let i = 0; i < (ev.t === 'impact' ? 12 : 6); i++) ui.parts.push({ x: ev.x, y: ev.y, to: ev.t === 'eat', vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.6, c: col });
        if (ev.t === 'impact') { ui.shake = Math.min(8, 2 + ev.m / me.M * 30); SFX.hit(1); hint('impact'); } else if (performance.now() - eatSfx > 90) { eatSfx = performance.now(); SFX.place(); }
      } else if (ev.t === 'sweep') {
        for (let i = 0; i < 5; i++) ui.parts.push({ x: ev.x, y: ev.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.5, c: '#bff0ff' });
      } else if (ev.t === 'capture') {
        SFX.golden();
        ui.rings.push({ t: 0, d: 0.7, r0: 2, r1: r * ui.scale * 3, c: '#bff0ff', x: ev.x, y: ev.y });
        if (ev.big) banner(tr('{n} CAPTURÉE', { n: tr(ev.name).toUpperCase() }), tr('Elle devient votre grande lune.'), 'win');
        else A.toast(tr('Nouvelle lune'), 1200);
      } else if (ev.t === 'block') {
        SFX.freeze();
        hint('moons');
      } else if (ev.t === 'hit') {
        ui.shake = 6; ui.flash = 1;
        SFX.hit(Math.min(3, ev.dmg / 10));
        if (A.vibrate) A.vibrate(40);
      } else if (ev.t === 'crack') {
        SFX.debris();
        hint('heat');
      } else if (ev.t === 'rival') {
        ui.shake = 10;
        SFX.explode();
        banner(tr('{n} ABSORBÉE', { n: tr(ev.name).toUpperCase() }), tr('Sa masse est désormais la vôtre.'), 'win');
      } else if (ev.t === 'boost') {
        SFX.whoosh(0);
      } else if (ev.t === 'death') {
        ui.shake = 10; ui.flash = 1;
        SFX.death(0);
        banner(tr('VOTRE CROÛTE SE FEND'), ev.lost === 1 ? tr('Vous perdez de la masse et une lune.') : ev.lost ? tr('Vous perdez de la masse et {n} lunes.', { n: ev.lost }) : tr('Vous perdez de la masse.'), 'lose');
      } else if (ev.t === 'end') {
        endChapter();
      }
    }
  }
  function banner(title, sub, cls) {
    const b = $('esBanner');
    b.className = 'banner gn-banner';
    void b.offsetWidth;
    b.innerHTML = `<h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}`;
    b.classList.add('show');
    if (cls) b.classList.add(cls);
    b.style.animationDuration = '2200ms';
  }
  function hud() {
    const e = ui.e;
    if (!e) return;
    const rk = E.rank(e), alive = 1 + e.rivals.filter((v) => v.alive).length;
    $('esRank').textContent = rk === 1 ? tr('1er de la ceinture') : tr('{n}e de la ceinture', { n: rk });
    $('esProg').style.width = (E.progress(e) * 100).toFixed(1) + '%';
    $('esHp').style.width = (Math.max(0, e.me.hp) / E.HP * 100).toFixed(1) + '%';
    $('esHp').classList.toggle('low', e.me.hp < E.HP * 0.3);
    $('esHeat').style.width = Math.min(100, e.me.heat).toFixed(1) + '%';
    $('esHeat').classList.toggle('hot', e.me.heat > 70);
    $('esMass').innerHTML = `<i class="gn-star">◉</i>${E.systemMass(e).toFixed(1)}<small> / ${Math.ceil(E.goal(e))}</small>`;
    const max = E.maxSats(e);
    $('esMoons').innerHTML = `<span class="es-moon-row">${Array.from({ length: max }, (_, i) => `<i class="${i < e.sats.length ? 'on' : ''}"></i>`).join('')}</span><small>${tr('Lunes')}<b>${e.sats.length} / ${max}</b></small>`;
    $('esBoost').style.setProperty('--cd', (e.me.boostCd / 4).toFixed(2));
    $('esTitle').textContent = alive > 1 ? tr('L’ESSAIM') : tr('SEUL MAÎTRE');
  }
  const HINTS = {
    start: 'Sans toucher l’écran, vous suivez votre orbite. Gardez le doigt posé pour vous propulser vers lui.',
    capture: 'Glissez à côté d’un rocher plus petit, sans le toucher : un lien se tisse et il devient votre lune.',
    impact: 'Foncer dans un rocher l’absorbe d’un coup, mais chaque impact vous chauffe.',
    heat: 'Trop chaud ! Laissez-vous refroidir, ou votre croûte va se fendre.',
    rivals: 'Vesta, Pallas et Hygie grandissent aussi. Devenez le système le plus massif de la ceinture, vous et vos lunes.',
    moons: 'Vos lunes parent les chocs à votre place.'
  };
  function hint(k) {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(KEY + '.aide') || '{}'); } catch (err) { /* illisible */ }
    if (seen[k]) return;
    seen[k] = 1;
    try { localStorage.setItem(KEY + '.aide', JSON.stringify(seen)); } catch (err) { /* stockage indisponible */ }
    const el = $('esHint');
    el.textContent = tr(HINTS[k]);
    el.classList.add('show');
    clearTimeout(hint.t);
    hint.t = setTimeout(() => el.classList.remove('show'), 5600);
  }

  // ─── Fin du chapitre ────────────────────────────────────────
  async function endChapter() {
    if (ui.ended) return;
    ui.ended = true;
    const e = ui.e;
    e.result = { trait: E.trait(e), moons: e.sats.length, big: e.sats.filter((x) => x.big).map((x) => x.name), heat: Math.round(e.stats.heatSum) };
    save();
    SFX.win();
    await A.wait(1000);
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    A.addSeeds(3);
    const R = window.OrbiteRecit, t = e.result.trait;
    if (R) {
      const mood = { eau: 'p-glace', feu: 'p-roche', etoile: 'p-gaz', vie: 'p-mixte' }[e.nature1] || 'p-mixte';
      stage.register('essaim-end', { type: 'asteroid', seed: 6100 + (e.seed % 9000), full: true, mood, moons: Math.min(3, e.sats.length) });
      await R.openStory();
      await R.wait(700);
      await R.tell([tr('La ceinture tourne désormais autour de vous.'), e.sats.length === 1 ? tr('Une lune vous accompagne.') : e.sats.length ? tr('{n} lunes vous accompagnent.', { n: e.sats.length }) : tr('Vous avez tout absorbé : aucune lune ne vous suit.')]);
      await R.reveal('essaim-end');
      await R.tell([tr('Trait gagné : {t}. {d}', { t: tr(E.TRAIT_NAMES[t].name), d: tr(E.TRAIT_NAMES[t].text) })]);
      await R.title(tr('CHAPITRE 2'), tr('LE CŒUR · BIENTÔT'));
      await R.wait(2600);
    }
    A.toast(tr('+3 graines de vie'), 2200);
    await A.backToMenu();
  }

  // ─── Sauvegarde, ouverture ──────────────────────────────────
  function save() {
    if (!ui.e) return;
    const o = E.serialize(ui.e);
    if (ui.e.result) o.result = ui.e.result;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (err) { /* stockage indisponible */ }
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      const e = E.restore(o);
      if (e && o.result) e.result = o.result;
      return e;
    } catch (err) { return null; }
  }
  async function open(e) {
    ui.e = e || load();
    if (!ui.e) return;
    ui.cam = null; ui.scale = 0; ui.parts = []; ui.rings = []; ui.ended = false; ui.input = { x: 0, y: 0 }; ui.last = 0; ui.acc = 0;
    ui.started = performance.now();
    save();
    await A.show('essaim');
    stage.sky = 0;
    hud();
    cancelAnimationFrame(ui.raf);
    ui.raf = requestAnimationFrame(frame);
    setTimeout(() => hint('start'), 700);
  }
  async function leave() {
    SFX.tap();
    save();
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    await A.backToMenu();
  }

  // ─── Commandes ──────────────────────────────────────────────
  const view = $('esView');
  view.addEventListener('pointerdown', (ev) => {
    if (ev.target.closest('button')) return;
    ui.touch = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
  });
  window.addEventListener('pointermove', (ev) => { if (ui.touch && ev.pointerId === ui.touch.id) { ui.touch.x = ev.clientX; ui.touch.y = ev.clientY; } });
  const release = (ev) => { if (ui.touch && ev.pointerId === ui.touch.id) ui.touch = null; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('keydown', (ev) => {
    if (!$('essaim').classList.contains('active')) return;
    ui.keys[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key] = true;
    if (ev.key === ' ') { ui.boost = true; ev.preventDefault(); }
  });
  window.addEventListener('keyup', (ev) => { ui.keys[ev.key.length === 1 ? ev.key.toLowerCase() : ev.key] = false; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.e && $('essaim').classList.contains('active')) save(); });
  $('esBack').innerHTML = A.icon('back');
  $('esBack').addEventListener('click', leave);
  $('esBoost').addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ui.boost = true; });

  window.OrbiteEssaimUI = { open, leave, load, save, get state() { return ui; } };
})();
