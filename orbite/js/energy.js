/* ORBITE — sphères d'énergie des lois.
   Petites sphères en pixel art (canvas basse définition agrandi sans lissage), animées selon le
   pouvoir de leur famille : souffle (Vie), vortex (Néant), bascule (Envers), flammes (Brasier),
   facettes (Glace), bandes (Tempête), roche (Minéral), grille (Machine). */
(function () {
  'use strict';

  const N = 46;
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

  // Bruit de valeur 3D, léger et suffisant pour 46 × 46 pixels.
  function hash(x, y, z) {
    let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const l = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => hash(xi + i, yi + j, zi + k);
    return l(l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v), l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  const fbm = (x, y, z) => noise(x, y, z) * 0.6 + noise(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, y * 4.3, z * 4.3) * 0.1;

  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  // Rampe de 6 teintes : nuit, sombre, couleur, couleur vive, presque blanc, blanc.
  function rampOf(hex, alt) {
    const c = hexRgb(hex);
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const dark = mix([4, 4, 10], c, 0.28);
    const r = [mix([2, 2, 6], c, 0.08), dark, mix(dark, c, 0.6), c, mix(c, [255, 255, 255], 0.55), [255, 255, 255]];
    if (alt) r.alt = rampOf(alt);
    return r;
  }

  // Chaque famille : couleur, motif de surface (0 à 1) et nombre d'étincelles en orbite.
  const KINDS = {
    vie: { color: '#5fd35a', sparks: 5, surf(p, t) { const b = 0.5 + 0.5 * Math.sin(t * 1.6); return fbm(p[0] * 2.2, p[1] * 2.2 + t * 0.15, p[2] * 2.2) * 0.8 + b * 0.25; } },
    neant: { color: '#9a6bff', sparks: 7, inward: true, surf(p, t, r, a) { const s = Math.sin((a + r * 6 - t * 2.2) * 3) * 0.5 + 0.5; return Math.pow(r, 1.6) * (0.55 + 0.45 * s) + fbm(p[0] * 3, p[1] * 3, t * 0.4) * 0.15; } },
    envers: { color: '#ff4f6d', alt: '#5f7bff', sparks: 4, surf(p, t) { return fbm(p[0] * 2.4 + t * 0.3, -p[1] * 2.4, p[2] * 2.4); } },
    brasier: { color: '#ff8a2a', sparks: 6, flame: true, surf(p, t) { const f = fbm(p[0] * 3, p[1] * 3 - t * 1.4, p[2] * 3 + t * 0.2); return f * 1.15 - 0.05 + 0.18 * Math.max(0, -p[1]); } },
    glace: { color: '#8be6ff', sparks: 5, surf(p, t) { const q = p.map((v) => Math.round(v * 3) / 3); return fbm(q[0] * 2 + t * 0.12, q[1] * 2, q[2] * 2) * 0.9 + (Math.sin(t * 2 + q[0] * 9) > 0.96 ? 0.4 : 0); } },
    tempete: { color: '#2fd6b0', sparks: 6, surf(p, t) { return 0.5 + 0.45 * Math.sin(p[1] * 9 + fbm(p[0] * 2 + t * 1.2, p[1] * 2, p[2] * 2) * 5); } },
    mineral: { color: '#b8743f', sparks: 8, rocks: true, veins: 0.6, surf(p, t) { const f = fbm(p[0] * 3.2 + t * 0.15, p[1] * 3.2, p[2] * 3.2); return f > 0.55 ? f * 1.1 : f * 0.6; } },
    machine: { color: '#9fb3c8', sparks: 4, veins: 0.5, surf(p, t) { const lat = Math.asin(Math.max(-1, Math.min(1, p[1]))), lon = Math.atan2(p[0], p[2]) + t * 0.6; const g = Math.abs(Math.sin(lat * 5)) < 0.12 || Math.abs(Math.sin(lon * 4)) < 0.1; const pulse = Math.sin(lon * 4 - t * 4) > 0.8 ? 0.35 : 0; return (g ? 0.75 + pulse : 0.28) + fbm(p[0] * 4, p[1] * 4, t) * 0.12; } },
    lune: { color: '#ffd447', sparks: 2, surf(p, t) { const cr = fbm(p[0] * 3.5 + t * 0.1, p[1] * 3.5, p[2] * 3.5); const phase = 0.5 + 0.5 * Math.sin(p[0] * 2.2 + t * 0.7); return (cr > 0.62 ? 0.35 : 0.7) * (0.35 + 0.75 * phase); } },
    comete: { color: '#4f7bff', sparks: 9, surf(p, t) { const s = fbm(p[0] * 2 - t * 2.2, p[1] * 7, p[2] * 2); return s * 1.1 + Math.max(0, p[0]) * 0.25; } },
    cristal: { color: '#ff6fd8', sparks: 5, surf(p, t) { const q = p.map((v) => Math.round(v * 2.5) / 2.5); const res = 0.5 + 0.5 * Math.sin(t * 3 + (q[0] + q[1] * 2) * 4); return fbm(q[0] * 2, q[1] * 2, q[2] * 2 + t * 0.2) * 0.7 + res * 0.4; } },
    anomalie: { color: '#c8ff3a', sparks: 6, surf(p, t) { const g = Math.floor(t * 6) % 7 === 0 ? 0.4 : 0; return fbm(p[0] * 3 + g * 9, p[1] * 3 + Math.sin(t * 5) * 0.3, p[2] * 3 + t) + g; } },
    neutre: { color: '#f2efe6', sparks: 3, surf(p, t) { return fbm(p[0] * 2.5 + t * 0.2, p[1] * 2.5, p[2] * 2.5); } }
  };

  // Silhouette de chaque sphère : distance normalisée (1 = bord), pour que les lois ne soient pas toutes rondes.
  const poly = (x, y, n, rot) => {
    const a = Math.atan2(y, x) - rot, k = Math.PI * 2 / n;
    return Math.hypot(x, y) * Math.cos(((a % k) + k) % k - Math.PI / n) / Math.cos(Math.PI / n);
  };
  const SHAPES = {
    vie: (x, y) => Math.hypot(x, y) / (1 + 0.13 * Math.cos(5 * Math.atan2(y, x) + Math.PI / 2)),
    envers: (x, y) => poly(x, y, 3, Math.PI / 2) * 0.8,
    brasier: (x, y) => Math.hypot(x, y) / (1 + 0.55 * Math.pow(Math.max(0, -y / (Math.hypot(x, y) || 1)), 4)),
    glace: (x, y) => poly(x, y, 6, 0) * 0.95,
    tempete: (x, y) => Math.hypot(x / 1.2, y / 0.74),
    mineral: (x, y) => Math.pow(Math.pow(Math.abs(x * 0.97 + y * 0.12), 4) + Math.pow(Math.abs(y * 1.05 - x * 0.1), 4), 0.25) * 1.08,
    machine: (x, y) => Math.hypot(x, y) / (1 + 0.1 * (Math.cos(8 * Math.atan2(y, x)) > 0 ? 1 : -0.4)),
    comete: (x, y) => Math.hypot(x * 1.1, y * 1.1) / (1 + 1.1 * Math.pow(Math.max(0, -x / (Math.hypot(x, y) || 1)), 6)),
    cristal: (x, y) => Math.abs(x) / 0.78 + Math.abs(y) / 1.12,
    anomalie: (x, y, t) => { const a = Math.atan2(y, x); return Math.hypot(x, y) / (1 + 0.2 * Math.sin(3 * a + t * 1.3) + 0.12 * Math.sin(5 * a - t * 2.1)); }
  };
  // La Lune est un croissant : on retire un disque décalé.
  const cutOf = { lune: (x, y) => Math.hypot(x - 0.42, y + 0.18) < 0.82 };

  const items = new Set();
  let raf = 0;

  function mount(canvas, fam) {
    const k = KINDS[fam] || KINDS.neutre;
    canvas.width = N;
    canvas.height = N;
    const it = { fam, canvas, ctx: canvas.getContext('2d'), k, ramp: rampOf(k.color, k.alt), img: null, t0: Math.random() * 100, pulse: 0, seed: Math.random() * 50 };
    it.img = it.ctx.createImageData(N, N);
    items.add(it);
    canvas._energy = it;
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function pulse(canvas) { if (canvas && canvas._energy) canvas._energy.pulse = 1; }

  function draw(it, time) {
    const { k, img } = it;
    const d = img.data;
    const t = time + it.t0;
    it.pulse = Math.max(0, it.pulse - 0.025);
    const flip = k.alt && Math.sin(t * 0.9) > 0;
    const ramp = flip ? it.ramp.alt : it.ramp;
    const R = 0.6 + 0.03 * Math.sin(t * 2.2) + it.pulse * 0.08;
    const rot = t * 0.5;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    d.fill(0);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const px = (x + 0.5) / N * 2 - 1, py = (y + 0.5) / N * 2 - 1;
        const shape = SHAPES[it.fam];
        const r = shape ? shape(px / R, py / R, t) : Math.hypot(px, py) / R;
        if (cutOf[it.fam] && r < 1.65 && cutOf[it.fam](px / R, py / R)) continue;
        const th = BAYER[(y & 3) * 4 + (x & 3)];
        let level = -1, alpha = 255;
        if (r < 1) {
          const z = Math.sqrt(1 - r * r);
          const sx = px / R, sy = py / R;
          const p = [sx * cr + z * sr, sy, -sx * sr + z * cr];
          let v = k.surf(p, t, r, Math.atan2(sy, sx));
          // Énergie : cœur lumineux, bord brillant et veines électriques qui courent sur la sphère.
          const rim = Math.pow(r, 5) * 0.65;
          const core = k.inward ? 0 : Math.pow(z, 4) * 0.35;
          const n2 = noise(p[0] * 3.2 + t * 0.9, p[1] * 3.2 - t * 0.6, p[2] * 3.2 + it.seed);
          const vein = Math.abs(n2 - 0.5) < 0.035 * (k.veins == null ? 1 : k.veins) ? 0.55 : 0;
          v = v * (k.inward ? 1 : 0.62) + core + rim + vein + it.pulse * 0.5;
          level = Math.max(0, Math.min(5, Math.floor(v * 5 + th)));
          if (k.inward && r < 0.35) level = Math.min(level, r < 0.22 ? 0 : 1);
        } else if (r < 1.65) {
          // Halo tramé autour de la sphère, avec des flammèches pour le Brasier.
          let g = Math.pow(1 - (r - 1) / 0.65, 2.2) * (0.85 + 0.25 * Math.sin(t * 3 + r * 6) + it.pulse);
          if (k.flame && py < 0) g += Math.max(0, fbm(px * 4, py * 4 + t * 2, t) - 0.55) * 1.6 * (1 - (r - 1) / 0.65);
          if (g > th * 1.15) { level = g > 0.75 ? 3 : g > 0.4 ? 2 : 1; alpha = g > 0.5 ? 255 : 170; }
        }
        if (level < 0) continue;
        const c = ramp[level], o = (y * N + x) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = alpha;
      }
    }
    // Étincelles (ou roches) en orbite inclinée.
    for (let i = 0; i < k.sparks; i++) {
      const a = t * (k.inward ? -1.6 : 0.9) + i * (Math.PI * 2 / k.sparks) + it.seed;
      const rr = (k.inward ? 1.5 - ((t * 0.5 + i / k.sparks) % 1) * 0.6 : 1.32 + 0.12 * Math.sin(i * 7.1)) * R;
      const ox = Math.cos(a) * rr, oy = Math.sin(a) * rr * 0.38 - 0.06 * Math.cos(i);
      const behind = Math.sin(a) < 0 && Math.hypot(ox, oy) < R;
      if (behind) continue;
      const X = Math.floor((ox + 1) / 2 * N), Y = Math.floor((oy + 1) / 2 * N);
      const size = k.rocks ? 2 : 1;
      for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
        const xx = X + dx, yy = Y + dy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
        const c = k.rocks ? ramp[2] : ramp[5], o = (yy * N + xx) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    it.ctx.putImageData(img, 0, 0);
  }

  function loop(now) {
    raf = 0;
    const time = now / 1000;
    for (const it of items) {
      if (!it.canvas.isConnected) { items.delete(it); continue; }
      if (it.canvas.getClientRects().length) draw(it, time);
    }
    if (items.size) raf = requestAnimationFrame(loop);
  }

  window.OrbiteEnergy = { mount, pulse, KINDS };
})();
