/* ORBITE — bâtiments (industrie-logistique). Voir js/building-engine.js : register, model, MAT. */
(function (E) {
  'use strict';
  const { MAT, model } = E;
  const TAU = Math.PI * 2;
  const T = (o) => (o && o.t) || 0;
  // Bruit fixe par voxel (textures de minerai, de roche) : ne consomme pas le générateur.
  const hash = (x, y, z) => {
    let h = Math.imul((x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 1274126177, 1103515245);
    h ^= h >>> 15;
    return ((h >>> 0) % 1000) / 1000;
  };
  const mod = (a, n) => ((a % n) + n) % n;

  // Tapis roulant de A vers B, deux voies de large. shift (entier) fait défiler les lattes et les
  // blocs de minerai : un tour de boucle doit avancer d'un multiple de 24 (lattes /3, blocs /4, voies alternées /8).
  function belt(m, ax, ay, az, bx, by, bz, shift, o) {
    o = o || {};
    const alongX = Math.abs(bx - ax) >= Math.abs(by - ay);
    const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    let pz = null;
    for (let i = 0; i <= n; i++) {
      const s = n ? i / n : 0;
      const x = Math.round(ax + (bx - ax) * s), y = Math.round(ay + (by - ay) * s), z = Math.round(az + (bz - az) * s);
      const lanes = alongX ? [[x, y], [x, y + 1]] : [[x, y], [x + 1, y]];
      for (const [lx, ly] of lanes) {
        if (pz != null && z - pz > 1) m.box(lx, ly, pz, lx, ly, z - 1, MAT.METAL);
        m.set(lx, ly, z, mod(i - shift, 3) === 0 ? MAT.METAL : MAT.DARK);
      }
      if (o.lumps && i < n && mod(i - shift, 4) === 0) {
        const lane = lanes[mod(Math.floor((i - shift) / 4), 2)];
        m.set(lane[0], lane[1], z + 1, o.lumpMat || MAT.ROCK);
      }
      if (o.legs && mod(i, o.legs) === Math.floor(o.legs / 2) && z > (o.z0 || 1)) {
        for (const [lx, ly] of lanes) m.box(lx, ly, o.z0 || 1, lx, ly, z - 1, MAT.METAL);
      }
      pz = z;
    }
  }

  // Sphère pleine ; fn(x, y, z, nz) choisit le matériau.
  function sphere(m, cx, cy, cz, R, fn) {
    for (let z = Math.floor(cz - R); z <= cz + R; z++) for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (Math.hypot(x - cx, y - cy, z - cz) <= R + 0.3) m.set(x, y, z, fn(x, y, z, (z - cz) / R));
    }
  }

  // Copie d'un modèle tourné d'un quart de tour : son avant (+x) regarde vers +y.
  function blitTurned(m, src, ox, oy, oz) {
    for (let z = 0; z < src.Z; z++) for (let y = 0; y < src.Y; y++) for (let x = 0; x < src.X; x++) {
      const k = src.v[src.idx(x, y, z)];
      if (k) m.set(ox + (src.Y - 1 - y), oy + x, oz + z, k);
    }
  }

  // Roue (disque de 4 × 4 aux coins arrondis) dans le plan x-z, épaisseur en y.
  function wheel(m, x0, y0, y1, z0) {
    for (let dz = 0; dz < 4; dz++) for (let dx = 0; dx < 4; dx++) {
      if ((dx === 0 || dx === 3) && (dz === 0 || dz === 3)) continue;
      m.box(x0 + dx, y0, z0 + dz, x0 + dx, y1, z0 + dz, MAT.DARK);
    }
  }

  // ─── Industrie ───────────────────────────────────────────────

  // Mine à ciel ouvert : fosse en gradins dans un merlon de déblais, excavatrice au fond.
  function mine(r) {
    const H = r.int(5, 7), rb = r.range(2.4, 3);
    const step = Math.min(r.range(1.1, 1.4), (11 - H * 0.45 - rb) / (H - 1));
    const rim = rb + step * (H - 1);
    const S = Math.min(24, 2 * Math.ceil(rim + H * 0.45) + 1);
    const m = model(S, S, H + 9);
    const c = (S - 1) / 2, p = r.range(2.6, 3.6);
    const dist = (x, y) => Math.pow(Math.pow(Math.abs(x - c), p) + Math.pow(Math.abs(y - c), p), 1 / p);
    const topAt = (x, y) => {
      const d = dist(x, y);
      if (d <= rim) return Math.min(H, 1 + Math.floor(Math.max(0, d - rb) / step));
      return H - Math.floor((d - rim) / 0.45);
    };
    const ore = r.range(0.04, 0.09);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const top = topAt(x, y);
      if (top < 1) continue;
      for (let z = 0; z <= top; z++) {
        const inPit = dist(x, y) <= rim;
        let k = z === top ? (inPit && top < H ? (top % 2 ? MAT.SAND : MAT.GROUND) : MAT.GROUND) : inPit ? MAT.ROCK : MAT.STRATA;
        if (z < top && z > 0 && hash(x, y, z) < ore) k = MAT.COPPER;
        m.set(x, y, z, k);
      }
    }
    // Fond de fosse : minerai abattu.
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (dist(x, y) < rb && hash(x, y, 7) < 0.25) m.set(x, y, 2, MAT.ROCK);
    // Excavatrice : chenilles, caisse, cabine, flèche et godet qui mord dans le gradin du fond.
    const ex = Math.round(c) + 1, ey = Math.round(c);
    const body = r.chance(0.6) ? MAT.STRIPE : MAT.ACCENT;
    m.box(ex - 2, ey - 2, 2, ex + 2, ey - 2, 2, MAT.DARK);
    m.box(ex - 2, ey + 1, 2, ex + 2, ey + 1, 2, MAT.DARK);
    m.box(ex - 1, ey - 1, 2, ex + 1, ey, 2, MAT.METAL);
    m.box(ex - 2, ey - 2, 3, ex + 2, ey + 1, 4, body);
    m.box(ex + 2, ey - 2, 3, ex + 2, ey + 1, 4, MAT.DARK);
    m.box(ex - 2, ey + 1, 5, ex - 1, ey + 1, 6, MAT.HULL);
    m.set(ex - 2, ey + 1, 6, MAT.GLASS); m.set(ex - 1, ey + 1, 6, MAT.GLASS);
    const reach = r.int(5, 6), lift = r.int(8, 9);
    const bx = ex - reach - 1, bTop = Math.max(1, topAt(bx, ey)) + 1;
    for (const yy of [ey - 1, ey]) {
      m.line(ex - 1, yy, 5, ex - reach + 1, yy, lift, body);
      m.line(ex - reach + 1, yy, lift, bx + 1, yy, bTop + 2, MAT.METAL);
    }
    m.box(bx, ey - 1, bTop, bx + 1, ey, bTop + 1, MAT.DARK);
    // Mât d'éclairage sur le bord et tas de minerai.
    const lx = Math.round(c - rim + 1), ly = Math.round(c + rim - 1), lz = topAt(lx, ly) + 1;
    m.box(lx, ly, lz, lx, ly, lz + 4, MAT.METAL);
    m.set(lx, ly, lz + 5, MAT.LIGHT); m.set(lx + 1, ly, lz + 5, MAT.LIGHT);
    const hx = Math.round(c + rim - 1), hy = Math.round(c - rim + 1.5), hz = topAt(hx, hy);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const h = 2 - Math.round(Math.hypot(dx, dy) * 0.8);
      if (h >= 0) m.box(hx + dx, hy + dy, hz + 1, hx + dx, hy + dy, hz + 1 + h, hash(dx, dy, 3) < 0.4 ? MAT.SAND : MAT.ROCK);
    }
    return m;
  }

  // Fonderie : halle, haut fourneau, coulée de métal en fusion vers le lit de coulée, cheminée qui fume.
  function fonderie(r, o) {
    const t = T(o);
    const W = r.int(18, 22), D = r.int(14, 17);
    const m = model(W, D, 30);
    m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
    const hx1 = Math.floor(W * 0.45), hh = r.int(5, 7), mid = Math.floor((D - 2) / 2);
    // Halle et son lanterneau.
    m.box(1, 1, 1, hx1, D - 3, hh, MAT.HULL2);
    m.box(1, mid - 1, hh + 1, hx1, mid + 1, hh + 1, MAT.HULL);
    for (let x = 2; x < hx1; x += 2) m.set(x, mid + 1, hh + 1, MAT.WINDOW);
    m.box(1, D - 3, hh - 1, hx1, D - 3, hh - 1, MAT.ACCENT);
    m.box(hx1, 1, hh - 1, hx1, D - 3, hh - 1, MAT.ACCENT);
    for (let x = 2; x < hx1 - 1; x += 3) m.box(x, D - 3, 2, x, D - 3, 3, MAT.WINDOW);
    m.box(hx1, mid - 1, 1, hx1, mid + 1, 4, MAT.DARK);
    m.box(hx1, mid - 1, 1, hx1, mid + 1, 1, MAT.LAVA);
    // Haut fourneau.
    const fr = r.range(2.2, 2.8), fh = r.int(8, 11);
    const fx = hx1 + 3 + Math.ceil(fr), fy = Math.ceil(fr) + 2.5;
    m.cyl(fx, fy, 1, 2, fr + 1, MAT.DARK);
    m.cyl(fx, fy, 3, fh, fr, MAT.METAL);
    m.cyl(fx, fy, Math.floor(fh * 0.55), Math.floor(fh * 0.55) + 1, fr, MAT.ACCENT);
    m.cyl(fx, fy, fh + 1, fh + 2, fr - 1, MAT.DARK);
    // Plan incliné du skip (chargement du minerai).
    for (const yy of [Math.round(fy) - 1, Math.round(fy)]) m.line(hx1 + 1, yy, hh + 1, fx - 1, yy, fh + 2, MAT.METAL);
    // Cheminée rayée qui fume.
    const cx = hx1 + 2, cy = 2, ch = r.int(17, 23);
    for (let z = 1; z <= ch; z++) m.cyl(cx, cy, z, z, 1.3, z > ch - 7 && Math.floor((ch - z) / 2) % 2 === 0 ? MAT.ACCENT : MAT.HULL);
    m.set(cx, cy, ch + 1, MAT.BEACON);
    m.line(fx, fy, fh + 2, cx, cy, fh + 2, MAT.COPPER);
    E.puffs(m, 'fonderie-a', cx, cy, ch + 2, t, { n: 5, rise: 6, spread: 2, mat: MAT.METAL });
    // Trou de coulée, rigole de fonte (le métal coule, motif qui avance) et lit de coulée.
    const tx = Math.round(fx), ty0 = Math.round(fy + fr) + 1, bedY = D - 4;
    const flow = Math.floor(t * 8);
    m.set(tx, ty0 - 1, 2, MAT.LAVA);
    let i = 0;
    for (let y = ty0; y < bedY; y++, i++) {
      m.box(tx - 1, y, 1, tx + 1, y, 2, MAT.DARK);
      m.set(tx, y, 2, MAT.EMPTY);
      m.set(tx, y, 1, mod(i - flow, 4) === 0 ? MAT.COPPER : MAT.LAVA);
    }
    m.box(hx1 + 2, bedY, 1, W - 2, D - 2, 1, MAT.DARK);
    const nIng = Math.floor((W - 3 - hx1) / 2);
    for (let k = 0; k < nIng; k++) for (let row = 0; row < 2; row++) {
      const x = hx1 + 2 + k * 2, y = bedY + row * 2;
      if (y > D - 2) continue;
      const hot = mod(k + row - Math.floor(t * nIng), nIng) < Math.ceil(nIng / 2);
      m.set(x, y, 2, hot ? MAT.LAVA : MAT.COPPER);
    }
    m.set(W - 2, 1, 1, MAT.LIGHT);
    return m;
  }

  // Imprimante 3D géante : portique sur rails qui imprime en couches un dôme de régolithe.
  function imprimante(r, o) {
    const t = T(o);
    const R = r.int(4, 5), hp = r.int(3, 6), H = hp + r.int(5, 6);
    const S = 2 * R + 9, X = S + 1, Y = S + 4;
    const m = model(X, Y, H + 4);
    const c = (S - 1) / 2 + 1, cy = c + 4;
    m.box(0, 4, 0, X - 1, Y - 1, 0, MAT.PAD);
    const rz = (z) => R * Math.cos(Math.asin(Math.min(0.95, (z - 1) / (R + 2))));
    // Coque imprimée : couches alternées, une porte face à nous.
    for (let z = 1; z <= hp; z++) m.cyl(c, cy, z, z, rz(z), z % 2 ? MAT.SAND : MAT.GROUND, 1.4);
    m.box(Math.round(c) - 1, Math.round(cy + R - 2), 1, Math.round(c) + 1, Y - 1, Math.min(3, hp), MAT.EMPTY);
    m.box(Math.round(c) - 1, Math.round(cy + R) + 1, 0, Math.round(c) + 1, Y - 1, 0, MAT.PAD);
    // Rails.
    const yA = Math.round(cy - R - 3), yB = Math.round(cy + R + 3);
    for (const yr of [yA, yB]) {
      m.box(0, yr, 1, X - 1, yr, 1, MAT.METAL);
      for (let x = 1; x < X; x += 3) m.box(x, yr - 1, 0, x, yr + 1, 0, MAT.DARK);
    }
    // Silo de régolithe derrière.
    const sx = 2.5, sy = 2.5;
    m.cyl(sx, sy, 3, H - 1, 1.8, MAT.HULL2);
    m.cyl(sx, sy, H - 3, H - 3, 1.8, MAT.ACCENT);
    m.box(1, 1, 0, 4, 4, 2, MAT.METAL);
    // Tête d'impression qui suit le bord de la couche en cours ; le portique la suit en x.
    const a = TAU * t, rr = rz(hp + 1);
    const hx = Math.round(c + rr * Math.cos(a)), hy = Math.round(cy + rr * Math.sin(a));
    for (const yr of [yA, yB]) {
      m.box(hx - 1, yr, 2, hx + 1, yr, 2, MAT.DARK);
      m.box(hx, yr, 3, hx, yr, H, MAT.METAL);
    }
    m.box(hx, yA, H, hx, yB, H, MAT.ACCENT);
    m.box(hx - 1, hy - 1, H - 1, hx + 1, hy + 1, H + 1, MAT.HULL);
    m.box(hx, hy, hp + 2, hx, hy, H - 2, MAT.METAL);
    m.set(hx, hy, hp + 1, MAT.LAVA);
    m.line(sx, sy, H, hx, yA, H + 1, MAT.COPPER);
    m.set(hx, yA, H + 2, MAT.LIGHT);
    return m;
  }

  // Usine robotique : halle et chaîne d'assemblage en plein air, bras robots qui soudent les châssis.
  function robotique(r, o) {
    const t = T(o);
    const X = r.int(18, 22), ha = r.int(5, 6);
    const ly = ha + 5, Y = ly + 6;
    const m = model(X, Y, 16);
    m.box(0, 0, 0, X - 1, Y - 1, 0, MAT.PAD);
    // Halle à toit en sheds.
    const hh = r.int(6, 7);
    m.box(1, 1, 1, X - 2, ha, hh, MAT.HULL);
    m.box(1, ha, hh - 1, X - 2, ha, hh - 1, MAT.ACCENT);
    for (let x = 1; x < X - 2; x += 3) {
      m.box(x, 1, hh + 1, x + 1, ha, hh + 1, MAT.HULL2);
      m.box(x + 1, 1, hh + 2, x + 1, ha, hh + 2, MAT.GLASS);
    }
    for (let x = 3; x < X - 3; x += 5) m.box(x, ha, 1, x + 2, ha, 4, MAT.DARK);
    m.box(1, ha + 1, 0, X - 2, ha + 1, 0, MAT.STRIPE);
    // Chaîne : le tapis et les châssis avancent d'un pas par boucle.
    const sp = 6, x0 = 1, L = Math.floor((X - 2) / sp) * sp;
    const shift = Math.floor(t * sp);
    for (let x = x0; x < x0 + L; x += 3) m.box(x, ly, 1, x, ly + 1, 1, MAT.DARK);
    belt(m, x0, ly, 2, x0 + L - 1, ly, 2, shift);
    const chassis = r.chance(0.5) ? MAT.HULL2 : MAT.HULL;
    for (let k = 0; k < L / sp; k++) {
      const x = x0 + mod(k * sp + shift, L);
      if (x + 2 >= x0 + L) continue;
      m.box(x, ly, 3, x + 2, ly + 1, 3, chassis);
      m.set(x + 1, ly, 4, MAT.ACCENT); m.set(x + 1, ly + 1, 4, MAT.ACCENT);
    }
    // Bras robots de part et d'autre.
    const n = r.int(2, 3);
    const arms = [];
    for (let i = 0; i < n; i++) arms.push({ x: Math.round(x0 + (i + 0.5) * L / n), side: i % 2 ? 1 : -1, ph: r.next() });
    for (const A of arms) {
      const by = A.side < 0 ? ly - 3 : ly + 3, bx = A.x;
      m.box(bx, by, 1, bx + 1, by + 1, 2, MAT.DARK);
      m.box(bx, by, 3, bx + 1, by + 1, 3, MAT.METAL);
      const sh = [bx + 0.5, by + 0.5, 4];
      const q = TAU * (t + A.ph);
      const yaw = (A.side < 0 ? Math.PI / 2 : -Math.PI / 2) + 0.7 * Math.sin(q);
      const e1 = 0.95 + 0.3 * Math.sin(q + 1.3), e2 = -0.85 + 0.35 * Math.sin(2 * q);
      const el = [sh[0] + 3.5 * Math.cos(e1) * Math.cos(yaw), sh[1] + 3.5 * Math.cos(e1) * Math.sin(yaw), sh[2] + 3.5 * Math.sin(e1)];
      const wr = [el[0] + 3.2 * Math.cos(e2) * Math.cos(yaw), el[1] + 3.2 * Math.cos(e2) * Math.sin(yaw), el[2] + 3.2 * Math.sin(e2)];
      m.line(sh[0], sh[1], sh[2], el[0], el[1], el[2], MAT.ACCENT);
      m.line(sh[0], sh[1], sh[2] + 1, el[0], el[1], el[2] + 1, MAT.ACCENT);
      m.line(el[0], el[1], el[2], wr[0], wr[1], wr[2], MAT.ACCENT);
      m.set(el[0], el[1], el[2] + 1, MAT.DARK);
      m.set(wr[0], wr[1], wr[2] - 1, MAT.LIGHT);
    }
    // Robots finis qui attendent, et balise.
    m.box(X - 3, Y - 3, 1, X - 2, Y - 2, 2, MAT.HULL2);
    m.set(X - 2, 1, hh + 3, MAT.BEACON);
    return m;
  }

  // Briqueterie de régolithe : trémie, presse hydraulique, tapis et palettes de briques.
  function briqueterie(r) {
    const X = r.int(15, 19), Y = r.int(13, 15);
    const m = model(X, Y, 14);
    m.box(0, 0, 0, X - 1, Y - 1, 0, MAT.PAD);
    // Presse.
    const px = 1, py = 1;
    m.box(px, py, 1, px + 4, py + 4, 2, MAT.HULL2);
    for (const [dx, dy] of [[0, 0], [4, 0], [0, 4], [4, 4]]) m.box(px + dx, py + dy, 3, px + dx, py + dy, 9, MAT.METAL);
    m.box(px, py, 10, px + 4, py + 4, 11, MAT.HULL);
    m.box(px, py + 4, 10, px + 4, py + 4, 10, MAT.ACCENT);
    m.box(px + 4, py, 10, px + 4, py + 4, 10, MAT.ACCENT);
    m.box(px + 1, py + 1, 7, px + 3, py + 3, 9, MAT.COPPER);
    m.box(px + 1, py + 1, 6, px + 3, py + 3, 6, MAT.DARK);
    m.box(px + 1, py + 1, 3, px + 3, py + 3, 3, MAT.SAND);
    // Trémie sur pieds, remplie de régolithe.
    const hx = px + 8.5, hy = py + 2;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(Math.round(hx + dx), Math.round(hy + dy), 1, Math.round(hx + dx), Math.round(hy + dy), 4, MAT.METAL);
    for (let z = 5; z <= 9; z++) m.cyl(hx, hy, z, z, 1 + (z - 5) * 0.55, MAT.HULL2, 1.1);
    m.cyl(hx, hy, 9, 9, 2.6, MAT.SAND);
    m.cyl(hx, hy, 8, 8, 2.6, MAT.ACCENT, 1);
    m.line(hx - 1, hy, 5, px + 5, py + 2, 4, MAT.COPPER);
    // Four de cuisson (selon la graine) le long du fond.
    if (X >= 17 && r.chance(0.7)) {
      m.box(px + 12, 1, 1, X - 2, 4, 4, MAT.HULL2);
      m.box(px + 12, 1, 5, X - 2, 4, 5, MAT.HULL);
      m.box(X - 2, 2, 1, X - 2, 3, 2, MAT.LAVA);
      m.cyl(X - 3, 2, 6, 9, 0.8, MAT.METAL);
    }
    // Tapis de sortie avec des briques.
    for (let y = py + 5; y <= Y - 3; y++) {
      m.box(px + 1, y, 1, px + 3, y, 1, MAT.METAL);
      m.box(px + 2, y, 2, px + 2, y, 2, (y % 3) ? MAT.DARK : MAT.SAND);
    }
    // Palettes de briques empilées par assises.
    const piles = [];
    for (let y = 7; y + 1 <= Y - 2; y += 3) for (let x = px + 6; x + 2 <= X - 2; x += 4) piles.push([x, y]);
    for (const [x, y] of piles) {
      if (r.chance(0.15)) continue;
      const h = r.int(3, 5);
      m.box(x, y, 1, x + 2, y + 1, 1, MAT.METAL);
      for (let z = 2; z < 2 + h; z++) m.box(x, y, z, x + 2, y + 1, z, z % 2 ? MAT.SAND : MAT.STRATA);
    }
    m.set(X - 2, Y - 2, 1, MAT.LIGHT);
    return m;
  }

  // Usine chimique : colonnes de distillation, cuves, rack de tuyauteries, torchère.
  function chimie(r) {
    const X = r.int(16, 20), Y = r.int(14, 17);
    const m = model(X, Y, 26);
    m.box(0, 0, 0, X - 1, Y - 1, 0, MAT.PAD);
    const rackY = Math.floor(Y / 2) - 1;
    // Colonnes de distillation au fond.
    const n = r.int(2, 3), cols = [];
    for (let i = 0; i < n; i++) {
      const x = 3 + i * 4, y = 2.5, h = r.int(13, 22) - i * 2, rr = i === 0 ? 1.6 : 1.3;
      cols.push([x, y, h]);
      m.cyl(x, y, 1, 1, rr + 0.8, MAT.DARK);
      m.cyl(x, y, 2, h, rr, MAT.HULL);
      m.cyl(x, y, h + 1, h + 1, rr - 0.6, MAT.HULL2);
      for (let z = 6; z < h; z += 5) m.cyl(x, y, z, z, rr + 1, MAT.METAL, 1);
      m.cyl(x, y, h - 2, h - 2, rr, MAT.ACCENT);
      m.box(x, Math.round(y + rr) + 1, 2, x, rackY, 2, MAT.COPPER);
      m.line(x, y + rr, h - 3, x, rackY, 6, MAT.COPPER);
    }
    // Rack de tuyaux.
    for (let x = 1; x < X - 1; x += 3) m.box(x, rackY, 1, x, rackY + 1, 5, MAT.METAL);
    m.tube('x', 1, X - 2, rackY, 6, 0.5, MAT.COPPER);
    m.tube('x', 1, X - 2, rackY + 1, 6, 0.5, MAT.HULL2);
    m.box(1, rackY, 5, X - 2, rackY + 1, 5, MAT.METAL);
    // Cuves verticales à dôme et cuve couchée.
    const tanks = r.int(2, 3);
    for (let i = 0; i < tanks; i++) {
      const rr = r.range(1.8, 2.4), x = X - 3 - i * 5, y = Y - 3.5, h = r.int(4, 7);
      if (x - rr < 1) break;
      m.cyl(x, y, 1, h, rr, MAT.HULL);
      m.cyl(x, y, 3, 3, rr, MAT.ACCENT);
      m.dome(x, y, h, rr, () => MAT.HULL2, 1.5);
      m.box(Math.round(x), rackY + 2, 1, Math.round(x), Math.round(y - rr), 1, MAT.COPPER);
    }
    const tx1 = Math.min(X - 3, 8);
    if (r.chance(0.7)) {
      m.tube('x', 2, tx1 - 3, Y - 3, 3, 1.6, MAT.HULL2);
      for (const sx of [3, tx1 - 4]) m.box(sx, Y - 4, 1, sx, Y - 2, 1, MAT.METAL);
      m.box(2, Y - 3, 3, 2, Y - 3, 3, MAT.ACCENT);
    } else {
      m.box(1, Y - 5, 1, 5, Y - 2, 3, MAT.HULL);
      m.box(1, Y - 2, 2, 5, Y - 2, 2, MAT.WINDOW);
      m.box(1, Y - 5, 4, 5, Y - 2, 4, MAT.HULL2);
    }
    // Torchère.
    if (r.chance(0.6)) {
      const fx = X - 2, fy = 2, fh = r.int(14, 18);
      m.box(fx, fy, 1, fx, fy, fh, MAT.METAL);
      m.line(fx, fy, 6, fx - 2, fy, 1, MAT.METAL);
      m.set(fx, fy, fh + 1, MAT.LAVA); m.set(fx, fy, fh + 2, MAT.LAVA);
    }
    return m;
  }

  // Concasseur : trémie sur un bâti, tapis qui montent vers les tas de minerai (tapis animés).
  // Minerai concassé : gravier gris moucheté de cuivre.
  const ORE = (x, y, z) => { const h = hash(x, y, z); return h < 0.22 ? MAT.COPPER : h < 0.6 ? MAT.METAL : MAT.HULL2; };
  function concasseur(r, o) {
    const shift = Math.floor(T(o) * 24);
    const two = r.chance(0.5);
    const X = r.int(21, 24), Y = two ? r.int(18, 21) : r.int(12, 14);
    const m = model(X, Y, 16);
    const cx = r.int(6, 7), cy = two ? 5 : Math.floor(Y / 2) - 1;
    m.box(cx - 3, cy - 3, 0, cx + 3, cy + 3, 0, MAT.PAD);
    // Bâti, corps du concasseur, trémie remplie de minerai.
    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) m.box(cx + dx, cy + dy, 1, cx + dx, cy + dy, 2, MAT.METAL);
    m.box(cx - 2, cy - 2, 3, cx + 2, cy + 2, 7, MAT.HULL2);
    m.box(cx - 2, cy + 2, 6, cx + 2, cy + 2, 6, MAT.ACCENT);
    m.box(cx + 2, cy - 2, 6, cx + 2, cy + 2, 6, MAT.ACCENT);
    m.set(cx + 2, cy, 4, MAT.WINDOW);
    for (let z = 8; z <= 10; z++) {
      const s = z === 8 ? 0 : 1;
      m.box(cx - 2 - s, cy - 2 - s, z, cx + 2 + s, cy + 2 + s, z, z === 10 ? MAT.ACCENT : MAT.HULL2);
      m.box(cx - 1 - s, cy - 1 - s, z, cx + 1 + s, cy + 1 + s, z, ORE(cx, cy, z));
    }
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (hash(x, y, 11) < 0.5) m.set(x, y, 11, ORE(x, y, 11));
    m.box(cx - 1, cy - 1, 1, cx + 1, cy + 1, 2, MAT.DARK);
    // Élévateur à godets depuis la fosse de déchargement (les godets montent).
    const ex = cx - 5;
    m.box(ex - 1, cy - 2, 0, ex + 1, cy + 2, 0, MAT.DARK);
    m.box(ex - 1, cy + 1, 1, ex + 1, cy + 2, 1, MAT.HULL2);
    m.box(ex - 1, cy - 2, 1, ex - 1, cy, 1, MAT.HULL2);
    m.box(ex, cy - 1, 1, ex, cy, 1, MAT.COPPER);
    m.box(ex, cy - 1, 1, ex + 1, cy, 13, MAT.HULL2);
    m.box(ex, cy - 1, 13, ex + 2, cy, 14, MAT.HULL);
    m.box(ex, cy, 13, ex + 2, cy, 13, MAT.ACCENT);
    for (let z = 2; z < 13; z++) if (mod(z - shift, 3) === 0) m.box(ex, cy + 1, z, ex + 1, cy + 1, z, MAT.METAL);
    m.line(ex + 2, cy, 12, cx - 1, cy, 11, MAT.COPPER);
    // Tapis de sortie vers les tas.
    const pile = (px, py, R, h) => {
      for (let y = Math.floor(py - R); y <= py + R; y++) for (let x = Math.floor(px - R); x <= px + R; x++) {
        const top = Math.round(h - Math.hypot(x - px, y - py) * h / (R + 0.5));
        for (let z = 0; z <= top; z++) m.set(x, y, z, ORE(x, y, z));
      }
    };
    const h1 = r.int(5, 6), p1x = X - 4, p1y = cy + 0.5;
    pile(p1x, p1y, 3.3, h1);
    belt(m, cx + 3, cy, 2, p1x - 1, cy, h1 + 2, shift, { lumps: true, legs: 3, lumpMat: MAT.HULL2 });
    if (two) {
      const h2 = r.int(4, 6), p2x = cx + 0.5, p2y = Y - 4;
      pile(p2x, p2y, 3.3, h2);
      belt(m, cx, cy + 3, 2, cx, p2y - 1, h2 + 2, shift, { lumps: true, legs: 3, lumpMat: MAT.HULL2 });
    }
    m.set(cx - 2, cy - 2, 11, MAT.BEACON);
    return m;
  }

  // ─── Logistique ──────────────────────────────────────────────

  // Spatioport : aire d'atterrissage carrée, tour de contrôle à radar, terminal, parfois un atterrisseur.
  function spatioport(r, o) {
    const t = T(o);
    const X = 24, Y = r.int(21, 24);
    const m = model(X, Y, 28);
    // Aire d'atterrissage surélevée (avant droit).
    const P = r.int(12, 14), px0 = X - P - 1, py0 = Y - P - 1, px1 = X - 2, py1 = Y - 2;
    const pc = [(px0 + px1) / 2, (py0 + py1) / 2];
    m.box(px0, py0, 0, px1, py1, 1, MAT.HULL2);
    m.box(px0 + 1, py0 + 1, 1, px1 - 1, py1 - 1, 1, MAT.PAD);
    m.cyl(pc[0], pc[1], 1, 1, P / 2 - 2, MAT.STRIPE, 0.8);
    m.cyl(pc[0], pc[1], 1, 1, 2.2, MAT.DARK);
    for (const [x, y] of [[px0, py0], [px1, py0], [px0, py1], [px1, py1], [Math.round(pc[0]), py1], [px1, Math.round(pc[1])]]) m.set(x, y, 2, MAT.LIGHT);
    // Atterrisseur posé (selon la graine).
    if (r.chance(0.55)) {
      const lh = r.int(7, 9), lr = 1.8;
      for (let z = 0; z < lh; z++) {
        const rr = z > lh - 3 ? lr - (z - (lh - 3)) * 0.7 : lr;
        m.cyl(pc[0], pc[1], z + 3, z + 3, rr, z === 2 ? MAT.ACCENT : MAT.HULL);
      }
      m.cyl(pc[0], pc[1], 2, 2, 1.1, MAT.DARK);
      m.set(Math.round(pc[0]), Math.round(pc[1] + lr), 7, MAT.WINDOW);
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) m.line(pc[0] + dx * 1.2, pc[1] + dy * 1.2, 5, pc[0] + dx * 3, pc[1] + dy * 3, 2, MAT.METAL);
    } else {
      m.line(pc[0] - 2, pc[1] - 2, 1, pc[0] + 2, pc[1] + 2, 1, MAT.STRIPE);
      m.line(pc[0] - 2, pc[1] + 2, 1, pc[0] + 2, pc[1] - 2, 1, MAT.STRIPE);
    }
    // Tour de contrôle (arrière gauche) et son radar qui tourne.
    const H = r.int(14, 18), tx = 3, ty = 3;
    m.box(1, 1, 0, 5, 5, 2, MAT.HULL2);
    m.cyl(tx, ty, 3, H, 1.3, MAT.HULL);
    for (let z = 7; z < H; z += 5) m.cyl(tx, ty, z, z, 1.3, MAT.ACCENT);
    m.cyl(tx, ty, H + 1, H + 1, 2.6, MAT.HULL2);
    m.cyl(tx, ty, H + 2, H + 3, 2.6, MAT.GLASS);
    m.cyl(tx, ty, H + 4, H + 4, 2.8, MAT.HULL);
    m.box(tx, ty, H + 5, tx, ty, H + 7, MAT.METAL);
    m.set(tx, ty, H + 8, MAT.BEACON);
    const a = TAU * t;
    m.line(tx - Math.cos(a) * 2.5, ty - Math.sin(a) * 2.5, H + 6, tx + Math.cos(a) * 2.5, ty + Math.sin(a) * 2.5, H + 6, MAT.HULL2);
    // Terminal le long du fond, passerelle vers l'aire.
    const th = r.int(3, 4), ty1 = Math.min(5, py0 - 2);
    m.box(7, 0, 0, X - 2, ty1, 0, MAT.PAD);
    m.box(7, 1, 1, X - 2, ty1, th, MAT.HULL);
    m.box(7, 1, th + 1, X - 2, ty1, th + 1, MAT.HULL2);
    if (r.chance(0.5)) for (let x = 8; x < X - 2; x += 3) m.box(x, 2, th + 2, x + 1, ty1 - 1, th + 2, MAT.SOLAR);
    for (let x = 8; x < X - 2; x += 2) m.set(x, ty1, th - 1, MAT.WINDOW);
    m.box(7, ty1, th, X - 2, ty1, th, MAT.ACCENT);
    const gx = Math.round(pc[0]);
    m.box(gx - 1, ty1, 1, gx + 1, ty1, 2, MAT.DARK);
    m.tube('y', ty1 + 1, py0, gx, 2, 1, MAT.HULL2);
    // Côté gauche : cuves de carburant et caisses de fret.
    m.box(1, 7, 0, px0 - 2, Y - 2, 0, MAT.PAD);
    for (let i = 0; i < 2; i++) {
      const y = 9 + i * 4;
      if (y + 2 > Y - 2) break;
      m.cyl(3, y, 1, 5, 1.5, MAT.HULL);
      m.cyl(3, y, 3, 3, 1.5, MAT.ACCENT);
    }
    for (let y = Y - 4; y <= Y - 3; y++) m.box(1, y, 1, Math.min(px0 - 3, 4), y, 1 + (y % 2), y % 2 ? MAT.COPPER : MAT.HULL2);
    m.box(6, 7, 0, 6, Y - 2, 0, MAT.STRIPE);
    return m;
  }

  // Entrepôt : conteneurs empilés en rangées et portique de manutention.
  function entrepot(r) {
    const X = r.int(16, 21), Y = r.int(12, 15);
    const m = model(X, Y, 14);
    m.box(0, 0, 0, X - 1, Y - 1, 0, MAT.PAD);
    const colors = [MAT.ACCENT, MAT.HULL2, MAT.COPPER, MAT.HULL, MAT.STRIPE, MAT.SOLAR, MAT.ACCENT, MAT.COPPER];
    for (let y0 = 1; y0 + 1 <= Y - 2; y0 += 3) for (let x0 = 1; x0 + 3 <= X - 2; x0 += 5) {
      const h = r.chance(0.12) ? 0 : r.int(1, 3);
      let prev = -1;
      for (let k = 0; k < h; k++) {
        let c = r.pick(colors);
        if (c === prev) c = colors[(colors.indexOf(c) + 1) % colors.length];
        prev = c;
        const z = 1 + k * 2;
        m.box(x0, y0, z, x0 + 3, y0 + 1, z + 1, c);
        m.box(x0 + 3, y0, z, x0 + 3, y0 + 1, z, MAT.DARK);
      }
      if (h === 0) m.box(x0, y0, 0, x0 + 3, y0, 0, MAT.STRIPE);
    }
    // Portique sur pneus qui enjambe les rangées.
    const gx = r.int(3, X - 6), gz = 9;
    for (const yy of [0, Y - 1]) {
      m.box(gx, yy, 0, gx + 2, yy, 0, MAT.DARK);
      m.box(gx, yy, 1, gx, yy, gz - 1, MAT.ACCENT);
      m.box(gx + 2, yy, 1, gx + 2, yy, gz - 1, MAT.ACCENT);
    }
    m.box(gx, 0, gz, gx + 2, Y - 1, gz, MAT.STRIPE);
    const ty = r.int(2, Y - 4);
    m.box(gx, ty, gz + 1, gx + 2, ty + 2, gz + 1, MAT.HULL);
    m.box(gx + 1, ty + 1, gz - 2, gx + 1, ty + 1, gz - 1, MAT.METAL);
    m.box(gx - 1, ty, gz - 3, gx + 3, ty + 1, gz - 3, MAT.DARK);
    m.set(gx + 1, 0, gz + 1, MAT.BEACON);
    // Poste de garde.
    m.box(X - 3, Y - 3, 1, X - 2, Y - 2, 3, MAT.HULL);
    m.set(X - 2, Y - 2, 2, MAT.WINDOW); m.set(X - 3, Y - 2, 2, MAT.WINDOW);
    return m;
  }

  // Garage de rovers : bâtiment bas, baies à portes basculantes, parfois un rover qui sort.
  function garage(r) {
    const n = r.int(2, 4), W = n * 5 + 3, Db = r.int(7, 9), Y = Db + 7, h = r.int(5, 6);
    const m = model(W, Y, h + 6);
    m.box(0, 0, 0, W - 1, Y - 1, 0, MAT.PAD);
    m.box(1, 1, 1, W - 2, Db, h, MAT.HULL2);
    m.box(1, 1, h + 1, W - 2, Db, h + 1, MAT.HULL);
    for (let x = 2; x < W - 3; x += 4) m.box(x, 2, h + 2, x + 2, Db - 2, h + 2, MAT.SOLAR);
    const out = r.int(0, n - 1), withRover = r.chance(0.6);
    for (let i = 0; i < n; i++) {
      const x0 = 2 + i * 5;
      m.box(x0 - 1, Db, h - 1, x0 + 4, Db, h - 1, MAT.ACCENT);
      const open = i === out || r.chance(0.3);
      if (open) {
        m.box(x0, Db, 1, x0 + 3, Db, 4, MAT.DARK);
        m.box(x0, Db - 2, 1, x0 + 3, Db - 1, 4, MAT.DARK);
        m.set(x0 + 1, Db - 1, 4, MAT.WINDOW); m.set(x0 + 2, Db - 1, 4, MAT.WINDOW);
      } else {
        for (let z = 1; z <= 4; z++) m.box(x0, Db, z, x0 + 3, Db, z, z % 2 ? MAT.HULL : MAT.METAL);
      }
      m.set(x0 + 1, Db, h, MAT.LIGHT);
      if (i > 0) m.box(x0 - 1, Db + 1, 0, x0 - 1, Y - 1, 0, MAT.STRIPE);
    }
    // Un rover sort de sa baie.
    if (withRover) {
      const rv = E.builders.rover(r);
      blitTurned(m, rv, 2 + out * 5 + 1.5 - rv.Y / 2 + 0.5, Db - 3, 0);
    }
    // Annexe vitrée, antenne.
    m.box(W - 2, 1, h + 2, W - 2, 1, h + 4, MAT.METAL);
    m.set(W - 2, 1, h + 5, MAT.BEACON);
    m.box(1, Db, 2, 1, Db, 3, MAT.WINDOW);
    return m;
  }

  // Dépôt de carburant : sphères de stockage sur pieds, conduites, station de pompage.
  function carburant(r) {
    const R = r.int(3, 4), n = r.int(2, 3), sp = 2 * R + 3;
    const X = Math.min(24, 2 * sp + 1), Y = Math.min(24, n === 3 ? 2 * sp + 2 : sp + 8);
    const m = model(X, Y, 2 * R + 6);
    m.box(0, 0, 0, X - 1, Y - 1, 0, MAT.PAD);
    const pts = [[R + 1.5, R + 1.5], [R + 1.5 + sp, R + 1.5]];
    if (n === 3) pts.push([R + 1.5 + sp / 2, R + 1.5 + sp]);
    const hub = n === 3 ? [Math.round(R + 1.5), Y - 3] : [Math.round(X / 2), Y - 4];
    const band = r.chance(0.5) ? MAT.ACCENT : MAT.STRIPE;
    for (const [x, y] of pts) {
      const cz = R + 2;
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) m.box(Math.round(x + dx * (R - 1) * 0.75), Math.round(y + dy * (R - 1) * 0.75), 1, Math.round(x + dx * (R - 1) * 0.75), Math.round(y + dy * (R - 1) * 0.75), cz, MAT.METAL);
      sphere(m, x, y, cz, R, (vx, vy, vz) => (vz === cz ? band : MAT.HULL));
      m.box(Math.round(x), Math.round(y), 1, Math.round(x), Math.round(y), 2, MAT.COPPER);
      m.line(x, y, 1, hub[0], hub[1], 1, MAT.COPPER);
      m.set(Math.round(x), Math.round(y), cz + R + 1, MAT.METAL);
    }
    // Station de pompage et poste de chargement.
    const [hx, hy] = hub;
    m.box(hx - 1, hy - 1, 1, hx + 2, hy + 1, 3, MAT.HULL2);
    m.box(hx - 1, hy + 1, 2, hx + 2, hy + 1, 2, MAT.WINDOW);
    m.box(hx - 1, hy - 1, 4, hx + 2, hy + 1, 4, MAT.HULL);
    m.set(hx + 2, hy - 1, 5, MAT.LIGHT);
    if (n === 2) {
      m.tube('x', 2, X - 3, Y - 2, 2, 1.2, MAT.HULL);
      m.box(2, Y - 2, 2, 2, Y - 2, 2, band);
    } else {
      for (let y = sp + 1; y < Y - 1; y += 2) m.box(X - 5, y, 0, X - 2, y, 0, MAT.STRIPE);
    }
    return m;
  }

  // Gare maglev : quai couvert sur la halle, rail surélevé, rame qui arrive, s'arrête et repart.
  function maglev(r, o) {
    const t = T(o);
    const X = 24, Y = r.int(11, 12), gz = r.int(5, 6), gy = Y - 3;
    const m = model(X, Y, gz + 10);
    // Rail surélevé sur piles.
    for (let x = 1; x < X; x += 6) {
      m.box(x - 1, gy - 1, 0, x + 2, gy + 2, 0, MAT.PAD);
      m.box(x, gy, 1, x + 1, gy + 1, gz - 2, MAT.HULL2);
    }
    m.box(0, gy, gz - 1, X - 1, gy + 1, gz, MAT.HULL2);
    m.box(0, gy, gz, X - 1, gy + 1, gz, MAT.METAL);
    // Halle et quai.
    const xs0 = 3, xs1 = X - 4;
    m.box(xs0 - 1, 0, 0, xs1 + 1, gy - 1, 0, MAT.PAD);
    m.box(xs0 + 2, 1, 1, xs1 - 2, gy - 2, gz - 2, MAT.HULL);
    for (let x = xs0 + 3; x < xs1 - 2; x += 2) m.box(x, gy - 2, 2, x, gy - 2, 3, MAT.GLASS);
    m.box(Math.floor(X / 2) - 1, gy - 2, 1, Math.floor(X / 2), gy - 2, 3, MAT.DARK);
    m.box(xs0, 1, gz - 1, xs1, gy - 1, gz, MAT.HULL2);
    m.box(xs0, gy - 1, gz, xs1, gy - 1, gz, MAT.STRIPE);
    // Auvent sur poteaux.
    const roof = r.chance(0.5) ? MAT.GLASS : MAT.HULL;
    for (let x = xs0; x <= xs1; x += 4) m.box(x, 1, gz + 1, x, 1, gz + 4, MAT.METAL);
    m.box(xs0, 1, gz + 5, xs1, gy - 2, gz + 5, roof);
    m.box(xs0, 1, gz + 5, xs1, 1, gz + 5, MAT.HULL2);
    m.box(xs0, gy - 2, gz + 5, xs1, gy - 2, gz + 5, MAT.ACCENT);
    m.box(xs0 + 1, 2, gz + 1, xs0 + 2, 2, gz + 2, MAT.HULL);
    m.set(xs1 - 1, 1, gz + 6, MAT.BEACON);
    // Escalier vers le quai.
    for (let i = 0; i < gz - 1; i++) m.box(xs1 + 1, 1 + i, 1, xs1 + 2, 1 + i, 1 + i, MAT.HULL2);
    // La rame : arrivée en douceur, arrêt à quai, départ.
    const LT = r.int(12, 15), stop = Math.round((X - LT) / 2), from = -LT - 1, to = X + 1;
    let x0;
    if (t < 0.35) { const s = t / 0.35; x0 = from + (stop - from) * (1 - (1 - s) * (1 - s)); }
    else if (t < 0.65) x0 = stop;
    else { const s = (t - 0.65) / 0.35; x0 = stop + (to - stop) * s * s; }
    x0 = Math.round(x0);
    const half = Math.floor(LT / 2);
    for (let i = 0; i < LT; i++) {
      const x = x0 + i, nose = i === 0 || i === LT - 1;
      m.box(x, gy, gz + 1, x, gy + 1, gz + 1, MAT.HULL2);
      if (nose) { m.box(x, gy, gz + 2, x, gy + 1, gz + 2, MAT.ACCENT); continue; }
      m.box(x, gy, gz + 2, x, gy + 1, gz + 2, i === half ? MAT.DARK : (i % 2 ? MAT.WINDOW : MAT.HULL));
      m.box(x, gy, gz + 3, x, gy + 1, gz + 3, i === 1 || i === LT - 2 ? MAT.ACCENT : MAT.HULL);
    }
    return m;
  }

  // Camion minier : six roues, châssis, cabine sur le pont avant, benne souvent pleine.
  function camion(r) {
    const m = model(17, 9, 10);
    const bed = r.chance(0.6) ? MAT.STRIPE : MAT.ACCENT;
    for (const x of [1, 5, 12]) { wheel(m, x, 0, 1, 0); wheel(m, x, 7, 8, 0); }
    for (const x of [2, 6, 13]) m.box(x + 0, 8, 1, x + 1, 8, 2, MAT.METAL);
    m.box(1, 2, 2, 15, 6, 3, MAT.METAL);
    // Benne.
    const bx1 = r.int(9, 10);
    m.box(1, 1, 4, bx1, 7, 4, bed);
    m.box(1, 1, 5, bx1, 1, 7, bed);
    m.box(1, 7, 5, bx1, 7, 7, bed);
    m.box(bx1, 1, 5, bx1, 7, 8, bed);
    m.box(1, 2, 5, 1, 6, 5, bed);
    m.box(bx1 + 1, 1, 8, 13, 7, 8, bed);
    for (let x = 3; x < bx1; x += 3) { m.set(x, 7, 6, MAT.DARK); }
    if (r.chance(0.75)) {
      for (let y = 2; y <= 6; y++) for (let x = 2; x < bx1; x++) {
        const top = 5 + Math.round(2.2 - Math.hypot((x - (bx1 + 1) / 2) / 2.2, (y - 4) / 1.4));
        for (let z = 5; z <= Math.min(7, top); z++) m.set(x, y, z, hash(x, y, z) < 0.35 ? MAT.SAND : MAT.ROCK);
      }
    }
    // Capot, pont, cabine.
    m.box(13, 2, 2, 15, 6, 4, MAT.HULL2);
    m.box(15, 3, 2, 15, 5, 3, MAT.DARK);
    m.set(15, 2, 4, MAT.WINDOW); m.set(15, 6, 4, MAT.WINDOW);
    m.box(11, 1, 5, 15, 7, 5, bed);
    m.box(12, 5, 6, 14, 7, 7, MAT.HULL);
    m.box(14, 5, 7, 14, 7, 7, MAT.GLASS);
    m.box(12, 7, 7, 13, 7, 7, MAT.GLASS);
    m.box(15, 1, 6, 15, 7, 6, MAT.METAL);
    if (r.chance(0.7)) m.set(12, 6, 9, MAT.BEACON);
    return m;
  }

  // Drone de livraison : flotte au-dessus de sa plateforme, quatre hélices qui tournent.
  function drone(r, o) {
    const t = T(o);
    const S = r.int(9, 11), c = (S - 1) / 2, hz0 = r.int(7, 8);
    const m = model(S, S, hz0 + 5);
    // Plateforme et balisage.
    m.box(0, 0, 0, S - 1, S - 1, 0, MAT.HULL2);
    m.box(1, 1, 0, S - 2, S - 2, 0, MAT.PAD);
    m.cyl(c, c, 0, 0, c - 1, MAT.STRIPE, 0.8);
    for (const [x, y] of [[0, 0], [S - 1, 0], [0, S - 1], [S - 1, S - 1]]) m.set(x, y, 1, MAT.LIGHT);
    m.box(S - 1, Math.round(c), 1, S - 1, Math.round(c), 3, MAT.METAL);
    m.set(S - 1, Math.round(c), 4, MAT.ACCENT);
    // Le drone, qui monte et descend d'un voxel.
    const hz = hz0 + Math.round(Math.sin(TAU * t) * 0.6);
    const bx = Math.round(c) - 1, by = Math.round(c) - 1;
    m.box(bx, by, hz, bx + 2, by + 2, hz + 1, MAT.HULL);
    m.box(bx + 1, by + 1, hz + 1, bx + 1, by + 1, hz + 1, MAT.ACCENT);
    m.set(bx + 2, by + 2, hz, MAT.WINDOW);
    m.box(bx, by + 1, hz - 1, bx + 2, by + 1, hz - 1, MAT.DARK);
    const k = 3.2;
    let i = 0;
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const rx = c + dx * k * 0.75, ry = c + dy * k * 0.75;
      m.line(c + dx, c + dy, hz + 1, rx, ry, hz + 1, MAT.METAL);
      m.set(rx, ry, hz + 2, MAT.DARK);
      const a = TAU * 2 * t * (i % 2 ? 1 : -1) + i * 0.8;
      m.line(rx - Math.cos(a) * 1.7, ry - Math.sin(a) * 1.7, hz + 2, rx + Math.cos(a) * 1.7, ry + Math.sin(a) * 1.7, hz + 2, MAT.HULL2);
      i++;
    }
    // Colis suspendu.
    if (r.chance(0.65)) {
      m.box(bx + 1, by + 1, hz - 2, bx + 1, by + 1, hz - 1, MAT.METAL);
      m.box(bx, by, hz - 4, bx + 2, by + 1, hz - 3, r.chance(0.5) ? MAT.COPPER : MAT.ACCENT);
    }
    return m;
  }

  E.register([
    { key: 'mine', cat: 'industrie', name: 'Mine à ciel ouvert', desc: 'Fosse en gradins creusée dans le régolithe, excavatrice au fond.',
      role: 'ore', eco: { jobs: 5, power: -4, materials: 10 }, anim: false, build: mine },
    { key: 'fonderie', cat: 'industrie', name: 'Fonderie', desc: 'Haut fourneau, coulée de métal en fusion et cheminée qui fume.',
      eco: { jobs: 6, power: -8, materials: 12 }, anim: true, build: fonderie },
    { key: 'imprimante', cat: 'industrie', name: 'Imprimante 3D géante', desc: 'Un portique sur rails imprime un dôme couche après couche.',
      eco: { jobs: 3, power: -6, materials: 7 }, anim: true, build: imprimante },
    { key: 'robotique', cat: 'industrie', name: 'Usine robotique', desc: 'Chaîne d’assemblage où des bras robots soudent des châssis.',
      eco: { jobs: 4, power: -7, materials: 11 }, anim: true, build: robotique },
    { key: 'briqueterie', cat: 'industrie', name: 'Briqueterie de régolithe', desc: 'Trémie, presse hydraulique et palettes de briques compressées.',
      eco: { jobs: 4, power: -3, materials: 6 }, anim: false, build: briqueterie },
    { key: 'chimie', cat: 'industrie', name: 'Usine chimique', desc: 'Colonnes de distillation, cuves et rack de tuyauteries.',
      eco: { jobs: 5, power: -6, water: -2, materials: 9 }, anim: false, build: chimie },
    { key: 'concasseur', cat: 'industrie', name: 'Concasseur', desc: 'Le minerai monte au concasseur puis repart en tapis vers les tas.',
      role: 'ore', eco: { jobs: 3, power: -5, materials: 8 }, anim: true, build: concasseur },
    { key: 'spatioport', cat: 'logistique', name: 'Spatioport', desc: 'Aire d’atterrissage balisée, tour de contrôle à radar et terminal.',
      role: 'spaceport', eco: { jobs: 6, power: -3, materials: 4 }, anim: true, build: spatioport },
    { key: 'entrepot', cat: 'logistique', name: 'Entrepôt', desc: 'Conteneurs empilés en rangées sous un portique de manutention.',
      role: 'storage', eco: {}, anim: false, build: entrepot },
    { key: 'garage', cat: 'logistique', name: 'Garage de rovers', desc: 'Bâtiment bas à baies et portes basculantes pour l’entretien des rovers.',
      eco: { jobs: 3, power: -2 }, anim: false, build: garage },
    { key: 'carburant', cat: 'logistique', name: 'Dépôt de carburant', desc: 'Sphères de stockage sur pieds, conduites et station de pompage.',
      role: 'storage', eco: {}, anim: false, build: carburant },
    { key: 'maglev', cat: 'logistique', name: 'Gare maglev', desc: 'Quai couvert et rail surélevé où la rame s’arrête puis repart.',
      eco: { jobs: 4, power: -4 }, anim: true, build: maglev },
    { key: 'camion', cat: 'logistique', name: 'Camion minier', desc: 'Tombereau à six roues, cabine perchée et benne de minerai.',
      role: 'vehicle', eco: {}, anim: false, build: camion },
    { key: 'drone', cat: 'logistique', name: 'Drone de livraison', desc: 'Quadrirotor qui flotte au-dessus de sa plateforme, colis suspendu.',
      role: 'vehicle', eco: {}, anim: true, build: drone },
  ]);
})(typeof module === 'object' && module.exports ? require('../building-engine.js') : self.OrbiteBuildings);
