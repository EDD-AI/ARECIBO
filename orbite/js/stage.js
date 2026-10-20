/* ORBITE — scène pixel partagée du jeu.
 * Un seul canvas WebGL plein écran dessine toutes les planètes à la position
 * des éléments DOM marqués data-planet (les animations CSS les déplacent donc
 * aussi), plus les étoiles et les particules. Exposé via window.OrbiteStage. */
(function () {
  'use strict';

  const OP = window.OrbitePlanets;
  const TAU = Math.PI * 2;
  const LOOP_SECONDS = 24;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

  class Stage {
    constructor(canvas, catalog) {
      this.canvas = canvas;
      this.r = new OP.Renderer(canvas, { transparent: true });
      this.catalog = catalog;
      this.genomes = new Map();
      this.looks = {};
      this.fx = new WeakMap();
      this.particles = [];
      this.time = 0;
      this.last = performance.now();
      this.modal = false;
      this.modalEl = null;
      this.stars = OP.makeStarfield(0x0b17, 900);
      this.stars.theme = { top: [0, 0, 0], bot: [0, 0, 0], stars: [[255, 255, 255], [196, 214, 255], [255, 226, 200]] };
      // Fond sobre : des points fins et pâles, très peu d'étoiles en croix.
      this.stars.stars.forEach((st, i) => {
        if (st.kind === 3 || (st.kind === 2 && i % 4)) st.kind = 1;
        if (st.kind === 1 && i % 3) st.kind = 0;
        st.dim *= 0.75;
      });
      this.starArea = 1800;
      this.fit();
      window.addEventListener('resize', () => this.fit());
      // iOS peut retirer le contexte WebGL d'une appli passée en arrière-plan : on attend qu'il
      // revienne, puis on recrée le moteur de rendu (les apparences sont régénérées à la volée).
      this.lost = false;
      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
      canvas.addEventListener('webglcontextrestored', () => this.restore());
      requestAnimationFrame((t) => this.loop(t));
    }

    fit() {
      const dpr = window.devicePixelRatio || 1;
      const sdev = dpr >= 2.5 ? 3 : 2;
      const W = Math.ceil((window.innerWidth * dpr) / sdev);
      const H = Math.ceil((window.innerHeight * dpr) / sdev);
      this.r.resize(W, H);
      this.canvas.style.width = (W * sdev) / dpr + 'px';
      this.canvas.style.height = (H * sdev) / dpr + 'px';
      this.px = sdev / dpr;
    }

    // Apparences hors catalogue (menu, titre…) ; full = planète détaillée de décor.
    register(id, look) {
      this.looks[id] = look;
      this.genomes.delete(id);
    }

    genome(id) {
      let g = this.genomes.get(id);
      if (!g) {
        const look = this.looks[id] || (this.catalog[id] && this.catalog[id].look) || { type: 'moon', seed: OP.hashString(id) };
        if (look.living) g = OP.livingWorld(look.seed, look.living, { light: look.light });
        else g = OP.generate(look.seed, {
          type: look.type, compact: !look.full, facet: look.facet || 'off',
          ring: !!look.ring, debris: !!look.debris, moons: look.moons || 0, shell: !!look.shell,
          starClass: look.starClass, hueShift: look.hueShift, mood: look.mood,
          caps: look.caps, light: look.light, shape: look.shape || 'aucune', warm: look.warm, coreHue: look.coreHue,
          disk: look.disk, hot: look.hot, pitch: look.pitch, lens: look.lens, diskScale: look.diskScale
        });
        g.flip = !!look.flip;
        this.genomes.set(id, g);
      }
      return g;
    }

    colors(id) {
      const g = this.genome(id), P = g.body.pal;
      const acc = OP.accentOf(g);
      const rows = g.body.shader === OP.SH.GAS ? [0, 1, 2] : g.body.shader === OP.SH.STAR || g.body.shader === OP.SH.PORTAL ? [0, 0, 0] : [4, 5, 1];
      return [acc, P[rows[1]][4], P[rows[2]][5], P[rows[0]][3]];
    }

    state(el) {
      let s = this.fx.get(el);
      if (!s) { s = { flash: 0, reveal: 1, tween: null, frost: el.dataset && el.dataset.frozen === '1' ? 1 : 0 }; this.fx.set(el, s); }
      return s;
    }

    flash(el, amount) { if (el) this.state(el).flash = Math.max(this.state(el).flash, amount == null ? 0.85 : amount); }

    reveal(el, from, to, ms) {
      if (!el) return Promise.resolve();
      const s = this.state(el);
      s.reveal = from;
      return new Promise((resolve) => { s.tween = { from, to, t0: performance.now(), ms: ms || 380, resolve }; });
    }

    setReveal(el, v) { const s = this.state(el); s.reveal = v; s.tween = null; }

    // Coordonnées pixel art depuis un rectangle CSS.
    toArt(x, y) { return [x / this.px, this.r.H - y / this.px]; }
    center(el) {
      const b = el.getBoundingClientRect();
      return [b.left + b.width / 2, b.top + b.height / 2];
    }

    // ─── Particules (coordonnées CSS en entrée) ─────────────────
    burst(x, y, o) {
      o = o || {};
      const [ax, ay] = this.toArt(x, y);
      const n = o.n || 24;
      const cols = o.colors || [[255, 255, 255]];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = (o.speed || 60) * (0.35 + Math.random() * 0.9);
        const life = (o.life || 0.7) * (0.6 + Math.random() * 0.6);
        this.particles.push({
          x: ax + (o.spread ? (Math.random() - 0.5) * o.spread : 0),
          y: ay + (o.spread ? (Math.random() - 0.5) * o.spread : 0),
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up || 0),
          g: o.gravity || 0, drag: o.drag == null ? 1.8 : o.drag,
          life, max: life, size: o.size || (Math.random() < 0.3 ? 2 : 1),
          shape: o.shape || 0, col: cols[i % cols.length], shrink: o.shrink !== false
        });
      }
    }

    ring(x, y, radius, o) {
      o = o || {};
      const [ax, ay] = this.toArt(x, y);
      const n = o.n || 36;
      const r0 = radius / this.px;
      const cols = o.colors || [[255, 255, 255]];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const life = o.life || 0.55;
        this.particles.push({
          x: ax + Math.cos(a) * r0, y: ay + Math.sin(a) * r0 * (o.flat || 1),
          vx: Math.cos(a) * (o.speed || 40), vy: Math.sin(a) * (o.speed || 40) * (o.flat || 1),
          g: 0, drag: 2.5, life, max: life, size: 1, shape: 0, col: cols[i % cols.length], shrink: false
        });
      }
    }

    // Projectile d'un point à un autre ; résout à l'impact.
    beam(from, to, o) {
      o = o || {};
      const a = this.toArt(from[0], from[1]), b = this.toArt(to[0], to[1]);
      const ms = o.ms || 260;
      const col = o.color || [255, 200, 120];
      return new Promise((resolve) => {
        this.particles.push({
          beam: true, ax: a[0], ay: a[1], bx: b[0], by: b[1], t0: performance.now(), ms,
          col, life: ms / 1000 + 0.05, max: ms / 1000 + 0.05, resolve, x: a[0], y: a[1], vx: 0, vy: 0, size: 2, shape: 3, g: 0, drag: 0,
          arc: o.arc, tail: o.tail, head: o.head
        });
      });
    }

    stepParticles(dt) {
      const list = this.particles;
      const out = [];
      const now = performance.now();
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (p.beam) {
          const k = clamp((now - p.t0) / p.ms, 0, 1);
          const e = k * k * (3 - 2 * k);
          const arc = Math.sin(k * Math.PI) * (p.arc == null ? 10 : p.arc);
          p.x = p.ax + (p.bx - p.ax) * e;
          p.y = p.ay + (p.by - p.ay) * e + arc;
          for (let j = 1; j <= (p.tail || 6); j++) {
            const kk = Math.max(0, e - j * 0.035);
            out.push({ x: p.ax + (p.bx - p.ax) * kk, y: p.ay + (p.by - p.ay) * kk + Math.sin(kk * Math.PI) * (p.arc == null ? 10 : p.arc), size: 1, shape: 0, col: p.col, a: 1 - j / (p.tail || 7) });
          }
          out.push({ x: p.x, y: p.y, size: p.head || 3, shape: 1, col: [255, 255, 255], a: 1 });
          if (k >= 1) { list.splice(i, 1); if (p.resolve) p.resolve(); }
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vx *= Math.exp(-p.drag * dt);
        p.vy *= Math.exp(-p.drag * dt);
        p.vy -= p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.life / p.max;
        out.push({ x: p.x, y: p.y, size: p.shrink && k < 0.4 && p.size > 1 ? p.size - 1 : p.size, shape: p.shape, col: p.col, a: Math.min(1, k * 1.6) });
      }
      return out;
    }

    // ─── Boucle ─────────────────────────────────────────────────
    stepTween(el, now) {
      const s = this.state(el);
      if (s.tween) {
        const k = clamp((now - s.tween.t0) / s.tween.ms, 0, 1);
        s.reveal = s.tween.from + (s.tween.to - s.tween.from) * k;
        if (k >= 1) { const t = s.tween; s.tween = null; t.resolve(); }
      }
      return s;
    }

    drawEl(el, phase, dim, now, cover) {
      // Les fondus avancent même hors de l'écran (liste défilée) : sinon un changement d'écran attendrait pour rien.
      const s = this.stepTween(el, now);
      // Gel : la glace pousse en 0,7 s et fond en 0,35 s.
      const frostTo = el.dataset.frozen === '1' ? 1 : 0;
      if (s.frost !== frostTo) {
        const dtf = Math.min(0.05, (now - (s.frostT || now)) / 1000);
        s.frost = frostTo > s.frost ? Math.min(1, s.frost + dtf / 0.7) : Math.max(0, s.frost - dtf / 0.35);
      }
      s.frostT = now;
      if (el.dataset.hide === '1') return;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) return;
      if (cover && b.right > cover.left && b.left < cover.right && b.bottom > cover.top && b.top < cover.bottom) return;
      if (b.bottom < -80 || b.top > window.innerHeight + 80) return;
      if (s.reveal <= 0.01) return;
      // Dans une liste qui défile (data-clipbox), l'astre ne déborde pas sur l'en-tête ni le bas.
      const boxEl = el.closest('[data-clipbox]');
      let bound = null;
      if (boxEl) {
        const c = boxEl.getBoundingClientRect();
        if (b.bottom <= c.top || b.top >= c.bottom) return;
        const [x0, y1] = this.toArt(c.left, c.top), [x1, y0] = this.toArt(c.right, c.bottom);
        bound = [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)];
      }
      const id = el.dataset.planet;
      if (!id) return;
      const g = this.genome(id);
      const scale = parseFloat(el.dataset.scale || '1');
      const half = Math.min(b.width, b.height) / 2 / this.px;
      const fit = el.dataset.fit === 'body' ? 1 : clamp(g.extent.x, 1.12, 1.75);
      const R = Math.max(3, (half * scale) / fit);
      const [cx, cy] = this.toArt(b.left + b.width / 2, b.top + b.height / 2);
      const speed = el.dataset.speed ? parseFloat(el.dataset.speed) : 1;
      const p = speed === 1 ? phase : ((this.time * speed) / LOOP_SECONDS) % 1;
      const own = el.dataset.dim ? parseFloat(el.dataset.dim) : 1;
      this.r.bound = bound;
      if (el.dataset.glow) {
        const k = parseFloat(el.dataset.glow);
        this.r.haloPass(4, Math.round(cx), Math.round(cy), R, 1 + k, [1 + k, 0.85, 0, 0], g.body.pal, 12, g.body.seed, g.light, { reveal: s.reveal, phase: p, flash: 0, dim: dim * own, flip: 1 });
      }
      this.r.drawSystem(g, {
        cx, cy, R, phase: (p + (g.seed % 997) / 997) % 1,
        reveal: s.reveal, flash: s.flash, dim: dim * own,
        flip: g.flip, golden: el.dataset.golden === '1', legend: !!(this.catalog && this.catalog[id] && this.catalog[id].legend), shield: el.dataset.shield === '1', ghost: el.dataset.ghost === '1',
        frost: s.frost
      });
      this.r.bound = null;
      // data-clip : rien n'est dessiné sous cette ligne (l'horizon du menu), quel que soit le décor HTML.
      if (el.dataset.clip) this.clearBelow(parseFloat(el.dataset.clip));
    }

    clearBelow(y) {
      const gl = this.r.gl;
      const was = gl.isEnabled(gl.SCISSOR_TEST);
      const box = gl.getParameter(gl.SCISSOR_BOX);
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, 0, this.r.W, Math.max(0, Math.floor(this.toArt(0, y)[1])));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.scissor(box[0], box[1], box[2], box[3]);
      if (!was) gl.disable(gl.SCISSOR_TEST);
    }

    restore() {
      try {
        this.r = new OP.Renderer(this.canvas, { transparent: true });
        this.fit();
        this.lost = false;
      } catch (err) { /* contexte encore indisponible : nouvel essai au prochain retour */ }
    }

    loop(now) {
      if (this.lost || (this.r.gl && this.r.gl.isContextLost())) {
        this.lost = true;
        this.last = now;
        requestAnimationFrame((t) => this.loop(t));
        return;
      }
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      const r = this.r;
      r.clear();
      const phase = (this.time / LOOP_SECONDS) % 1;
      const dimBg = this.modal ? 0.3 : 1;
      const cover = this.modal && this.modalEl ? this.modalEl.getBoundingClientRect() : null;
      let skip = null;
      if (cover) {
        const [x0, y1] = this.toArt(cover.left, cover.top), [x1, y0] = this.toArt(cover.right, cover.bottom);
        skip = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
      }
      this.starFade = Math.max(0, Math.min(1, (this.starFade || 0) + (this.starsOn === false ? -dt : dt) * 0.7));
      // Densité fixée en pixels CSS (une étoile pour starArea px²), quelle que soit la résolution.
      // Fond animé (cosmétique) : apparaît et disparaît en fondu.
      this.skyFade = Math.max(0, Math.min(1, (this.skyFade || 0) + (this.sky ? dt : -dt) * 1.2));
      if (this.sky) this.skyMode = this.sky;
      // skyGain atténue le fond pendant le jeu ; skyOff le fait défiler (carte de campagne).
      if (this.skyFade > 0.01 && this.skyMode) r.drawSky(this.skyMode, this.time, { reveal: 1, phase, flash: 0, dim: dimBg * this.skyFade * (this.skyGain == null ? 1 : this.skyGain), flip: 1 }, this.skyOff);
      const starCount = Math.round((window.innerWidth * window.innerHeight) / this.starArea);
      if (this.starFade > 0.01) r.drawStars(this.stars, phase, { reveal: this.starFade, phase, flash: 0, dim: dimBg * (this.starDim || 0.85), flip: 1 }, starCount, skip);
      const els = document.querySelectorAll('[data-planet]');
      const top = [];
      for (const el of els) {
        const s = this.fx.get(el);
        if (s && s.flash > 0) s.flash = Math.max(0, s.flash - dt * 4);
        if (!el.getClientRects().length) { this.stepTween(el, now); continue; }
        if (this.modal && el.closest('.overlay')) { top.push(el); continue; }
        this.drawEl(el, phase, this.modal ? 0.32 : 1, now, cover);
      }
      for (const el of top) {
        if (cover) {
          const b = el.getBoundingClientRect();
          const cy = b.top + b.height / 2;
          if (cy < cover.top || cy > cover.bottom) continue;
        }
        this.drawEl(el, phase, 1, now);
      }
      const pts = this.stepParticles(dt);
      if (pts.length) r.drawPoints(pts, { reveal: 1, phase, flash: 0, dim: 1, flip: 1 });
      requestAnimationFrame((t) => this.loop(t));
    }
  }

  window.OrbiteStage = Stage;
})();
