/* ORBITE — bâtiments (habitat et services). Voir js/building-engine.js : register, model, MAT.
 * Repère : la caméra regarde depuis le coin +x +y ; les façades x max (flanc droit, éclairé) et
 * y max (flanc gauche, ombre) sont celles que l'on voit : portes et fenêtres y vont d'abord. */
(function (E) {
  'use strict';
  const { MAT, model } = E;
  const TAU = Math.PI * 2;
  const tOf = (o) => (o && o.t) || 0;

  // Ellipsoïde plein ; fn(x, y, z, nx, ny, nz) choisit le matériau (0 = rien).
  function ellipsoid(m, cx, cy, cz, rx, ry, rz, fn) {
    for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry, nz = (z - cz) / rz;
      if (nx * nx + ny * ny + nz * nz <= 1.05) { const k = fn(x, y, z, nx, ny, nz); if (k) m.set(x, y, z, k); }
    }
  }

  // Arbre : tronc et houppier arrondi.
  function tree(m, x, y, z, h, cr) {
    m.box(x, y, z, x, y, z + h - 1, MAT.TRUNK);
    ellipsoid(m, x, y, z + h + cr * 0.4, cr, cr, cr * 0.85, () => MAT.PLANT);
  }

  // Drapeau sur un mât : l'étoffe (le long de x) ondule en y avec t (boucle parfaite).
  function flag(m, x, y, z0, h, len, t, mat) {
    m.box(x, y, z0, x, y, z0 + h, MAT.METAL);
    for (let i = 1; i <= len; i++) {
      const dy = Math.round(Math.sin(t * TAU - i * 1.2) * (0.25 + i / len));
      m.set(x + i, y + dy, z0 + h, mat);
      m.set(x + i, y + dy, z0 + h - 1, mat);
    }
  }

  // Fenêtres sur la couche z : chaque voxel de façade (un voisin horizontal vide) de la zone
  // devient k (WINDOW par défaut) si f(x, y) ; only : ne remplace que ce matériau.
  function facade(m, z, x0, y0, x1, y1, f, k, only) {
    const pts = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = m.get(x, y, z);
      if (!v || (only && v !== only)) continue;
      if (m.get(x + 1, y, z) && m.get(x - 1, y, z) && m.get(x, y + 1, z) && m.get(x, y - 1, z)) continue;
      if (f(x, y)) pts.push([x, y]);
    }
    for (const [x, y] of pts) m.set(x, y, z, k || MAT.WINDOW);
  }

  // ─── Habitat ────────────────────────────────────────────────

  // Immeuble : modules rectangulaires empilés en quinconce autour d'une cage d'escalier.
  function immeuble(r) {
    const m = model(24, 24, 24);
    const c = 12;
    const n = r.int(3, 5), alongX0 = r.chance(0.5);
    let top = 1;
    const mods = [];
    for (let i = 0; i < n; i++) {
      const L = r.int(9, 13), w = r.int(4, 6), ox = r.int(-2, 2), oy = r.int(-2, 2);
      const alongX = (i % 2 === 0) === alongX0;
      const [lx, ly] = alongX ? [L, w] : [w, L];
      const x0 = c - Math.floor(lx / 2) + ox, y0 = c - Math.floor(ly / 2) + oy;
      mods.push({ x0, y0, x1: x0 + lx - 1, y1: y0 + ly - 1, z0: 1 + i * 3, alongX, alt: r.chance(0.25) });
    }
    const ext = (f, k) => f(...mods.map((q) => q[k]));
    m.box(ext(Math.min, 'x0') - 1, ext(Math.min, 'y0') - 1, 0, ext(Math.max, 'x1') + 1, ext(Math.max, 'y1') + 2, 0, MAT.PAD);
    for (const q of mods) {
      const { x0, y0, x1, y1, z0 } = q;
      // Pilotis sous les porte-à-faux (seulement s'ils descendent jusqu'au sol sans rien traverser).
      if (z0 > 1) for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
        let clear = true;
        for (let z = 1; z < z0; z++) if (m.get(px, py, z)) clear = false;
        if (clear) m.box(px, py, 1, px, py, z0 - 1, MAT.METAL);
      }
      m.box(x0, y0, z0, x1, y1, z0 + 2, q.alt ? MAT.HULL2 : MAT.HULL);
      m.box(x0, y0, z0 + 2, x1, y1, z0 + 2, MAT.HULL2);
      // Fenêtres sur les longs côtés, bande de couleur sur les pignons.
      for (let x = x0 + 1; x < x1; x += 2) if (q.alongX) { m.set(x, y1, z0 + 1, MAT.WINDOW); m.set(x, y0, z0 + 1, MAT.WINDOW); }
      for (let y = y0 + 1; y < y1; y += 2) if (!q.alongX) { m.set(x1, y, z0 + 1, MAT.WINDOW); m.set(x0, y, z0 + 1, MAT.WINDOW); }
      if (q.alongX) { m.box(x0, y0, z0 + 1, x0, y1, z0 + 1, MAT.ACCENT); m.box(x1, y0, z0 + 1, x1, y1, z0 + 1, MAT.ACCENT); }
      else { m.box(x0, y0, z0 + 1, x1, y0, z0 + 1, MAT.ACCENT); m.box(x0, y1, z0 + 1, x1, y1, z0 + 1, MAT.ACCENT); }
      top = z0 + 3;
    }
    // Cage d'escalier qui dépasse du toit.
    m.box(c - 1, c - 1, 1, c, c, top, MAT.METAL);
    m.box(c - 1, c - 1, top, c, c, top, MAT.HULL2);
    // Équipement du toit (dernier module).
    const q = mods[mods.length - 1];
    const roof = r.pick(['solaire', 'citerne', 'antenne']);
    if (roof === 'solaire') {
      for (let y = q.y0 + 1; y < q.y1; y += 2) for (let x = q.x0 + 1; x < q.x1; x++) if (x < c - 1 || x > c) m.set(x, y, top, MAT.SOLAR);
    } else if (roof === 'citerne') {
      const tx = q.x1 - 2, ty = q.y0 + 2;
      m.cyl(tx, ty, top, top + 2, 1.3, MAT.HULL2);
      m.cyl(tx, ty, top + 1, top + 1, 1.3, MAT.ACCENT);
    }
    m.line(c, c, top + 1, c, c, top + 3, MAT.METAL);
    if (roof === 'antenne') { m.line(c - 1, c - 1, top + 1, c - 1, c - 1, top + 5, MAT.METAL); m.set(c - 1, c - 1, top + 6, MAT.BEACON); }
    // Porte d'entrée au pied de la cage.
    m.box(c + 1, c, 1, c + 1, c, 2, MAT.DARK);
    return m;
  }

  // Capsules : pods ronds sur pilotis autour d'une tour d'accès, reliés par des passerelles.
  function capsules(r) {
    const m = model(24, 24, 16);
    const c = 11.5, n = r.int(3, 5), ring = n <= 3 ? 5.5 : 6.5, a0 = r.range(0, TAU);
    const pods = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + i * TAU / n;
      pods.push({ x: Math.round(c + Math.cos(a) * ring), y: Math.round(c + Math.sin(a) * ring), zs: r.int(2, 5), R: r.range(2.4, 3.0), extra: r.pick(['', '', 'solaire', 'antenne']) });
    }
    const hub = Math.max(...pods.map((p) => p.zs)) + 2;
    // Tour d'accès centrale (escalier) et sa dalle.
    m.box(Math.round(c) - 2, Math.round(c) - 2, 0, Math.round(c) + 1, Math.round(c) + 1, 0, MAT.PAD);
    m.cyl(c, c, 1, hub, 1.3, MAT.HULL2);
    for (let z = 2; z < hub; z += 3) m.cyl(c, c, z, z, 1.3, MAT.WINDOW, 1);
    m.cyl(c, c, hub + 1, hub + 1, 1.6, MAT.HULL);
    m.set(c + 0.5, c + 0.5, hub + 2, MAT.LIGHT);
    for (const p of pods) {
      const { x, y, zs, R } = p;
      const cz = zs + 3;
      // Pilotis et semelles.
      m.box(x - 2, y - 2, 0, x + 2, y + 2, 0, MAT.PAD);
      for (const [dx, dy] of [[-2, -1], [1, -2], [2, 1], [-1, 2]]) m.box(x + dx, y + dy, 1, x + dx, y + dy, zs, MAT.METAL);
      // Passerelle vers la tour.
      m.line(x, y, zs + 1, c, c, zs + 1, MAT.METAL, 0.5);
      ellipsoid(m, x, y, cz, R, R, 2.6, (vx, vy, vz) => {
        if (vz === cz) return MAT.ACCENT;
        if (vz === cz + 1) return (vx + vy) % 2 ? MAT.WINDOW : MAT.HULL;
        if (vz > cz + 1) return MAT.HULL;
        return MAT.HULL2;
      });
      if (p.extra === 'solaire') m.box(x - 1, y - 1, cz + 3, x + 1, y + 1, cz + 3, MAT.SOLAR);
      if (p.extra === 'antenne') { m.line(x, y, cz + 3, x, y, cz + 5, MAT.METAL); m.set(x, y, cz + 6, MAT.BEACON); }
    }
    return m;
  }

  // Habitat semi-enterré : butte de régolithe sur les logements, façade vitrée dégagée à l'avant,
  // puits de lumière sur le dessus, cour d'entrée en contrebas.
  function bunker(r) {
    const m = model(24, 24, 12);
    const rx = r.int(8, 10), ry = r.int(7, 9), H = r.int(5, 6);
    const cx = 11.5, cy = 8.5, yf = Math.round(cy + ry * 0.45);
    const hAt = (x, y) => {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      return d > 1 || y > yf ? -1 : Math.round(Math.min(H, H * (1 - d) * 3.2));
    };
    for (let y = 0; y < m.Y; y++) for (let x = 0; x < m.X; x++) {
      const h = hAt(x, y);
      if (h < 0) continue;
      for (let z = 0; z <= h; z++) m.set(x, y, z, z < h ? MAT.ROCK : h >= H ? (r.chance(0.15) ? MAT.SAND : MAT.GROUND) : MAT.GROUND);
    }
    // Façade avant (y max) : béton, bandeau vitré éclairé, porte et linteau coloré.
    let fx0 = m.X, fx1 = -1;
    for (let x = 0; x < m.X; x++) if (hAt(x, yf) >= 2) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
    for (let x = fx0; x <= fx1; x++) {
      const h = hAt(x, yf);
      m.box(x, yf, 0, x, yf, h, MAT.HULL2);
      if (h >= 4 && x > fx0 && x < fx1 && (x - fx0) % 3) m.box(x, yf, 2, x, yf, 3, MAT.WINDOW);
      if (h >= 5) m.set(x, yf, 4, MAT.ACCENT);
    }
    const ex = Math.round(cx);
    m.box(ex - 1, yf, 1, ex, yf, 2, MAT.DARK);
    m.set(ex + 1, yf, 2, MAT.HULL2);
    m.box(ex - 2, yf + 1, 3, ex + 1, yf + 2, 3, MAT.HULL2);
    m.set(ex + 1, yf + 2, 4, MAT.LIGHT);
    // Cour d'entrée en contrebas : dalle, murets, marquage.
    const cy1 = Math.min(m.Y - 1, yf + 4);
    m.box(fx0, yf + 1, 0, fx1, cy1, 0, MAT.PAD);
    m.box(fx0, yf + 1, 1, fx0, cy1, 1, MAT.HULL2);
    m.box(fx1, yf + 1, 1, fx1, cy1, 1, MAT.HULL2);
    m.box(ex - 1, yf + 2, 0, ex, cy1, 0, MAT.STRIPE);
    // Puits de lumière : cadre en béton, verrière au-dessus d'une pièce éclairée.
    const spots = [[-0.55, -0.35], [-0.15, -0.45], [0.3, -0.35], [-0.4, 0.05], [0.05, -0.05], [0.45, 0.05]];
    const nw = r.int(2, 4);
    const used = [];
    for (let i = 0, k = r.int(0, 5); i < nw; i++, k = (k + 1 + r.int(0, 1)) % spots.length) {
      const wx = Math.round(cx + spots[k][0] * rx), wy = Math.round(cy + spots[k][1] * ry);
      if ([[-1, -1], [2, -1], [-1, 2], [2, 2]].some(([dx, dy]) => hAt(wx + dx, wy + dy) < H)) continue;
      if (used.some(([ux, uy]) => Math.abs(ux - wx) < 5 && Math.abs(uy - wy) < 5)) continue;
      used.push([wx, wy]);
      m.box(wx - 1, wy - 1, H + 1, wx + 2, wy + 2, H + 1, MAT.HULL2);
      m.box(wx, wy, H + 1, wx + 1, wy + 1, H + 1, MAT.GLASS);
      m.box(wx, wy, H, wx + 1, wy + 1, H, MAT.WINDOW);
    }
    // Évents et antenne.
    const vx = Math.round(cx + rx * 0.5), vy = Math.round(cy - ry * 0.45);
    if (hAt(vx, vy) >= 2) {
      const vz = hAt(vx, vy);
      m.box(vx, vy, vz, vx, vy, vz + 2, MAT.METAL);
      m.box(vx - 1, vy, vz + 3, vx + 1, vy, vz + 3, MAT.HULL2);
    }
    if (r.chance(0.6)) { const ax = Math.round(cx - rx * 0.6), ay = Math.round(cy - ry * 0.1); const az = Math.max(1, hAt(ax, ay)); m.line(ax, ay, az + 1, ax, ay, az + 4, MAT.METAL); m.set(ax, ay, az + 5, MAT.BEACON); }
    return m;
  }

  // Arcologie : tour d'habitation à gradins, jardins suspendus, ascenseur extérieur animé.
  function arcologie(r, o) {
    const T = tOf(o);
    const m = model(22, 22, 30);
    const c = 10.5;
    m.box(1, 1, 0, 20, 20, 0, MAT.PAD);
    m.box(3, 3, 1, 18, 18, 3, MAT.HULL2);
    m.box(3, 3, 3, 18, 18, 3, MAT.HULL);
    facade(m, 2, 3, 3, 18, 18, (x, y) => (x + y) % 3 !== 0);
    const H = r.int(20, 23);
    const R1 = r.range(4.6, 5.3), R2 = R1 - r.range(1.0, 1.4), R3 = R2 - r.range(0.9, 1.2);
    const z1 = 4 + Math.floor((H - 4) * r.range(0.4, 0.5)), z2 = z1 + Math.floor((H - z1) * 0.55);
    const seg = r.int(10, 16);
    const Rz = (z) => (z <= z1 ? R1 : z <= z2 ? R2 : R3);
    for (let z = 4; z <= H; z++) {
      const R = Rz(z), band = (z - 4) % 3;
      for (let y = Math.floor(c - R); y <= c + R; y++) for (let x = Math.floor(c - R); x <= c + R; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d > R + 0.25) continue;
        let k = MAT.HULL;
        if (d > R - 1) {
          if (band === 0) k = MAT.HULL2;
          else if (band === 1) k = Math.floor((Math.atan2(y - c, x - c) + Math.PI) / TAU * seg) % 2 ? MAT.WINDOW : MAT.HULL;
        }
        m.set(x, y, z, k);
      }
    }
    // Jardins suspendus sur les gradins.
    for (const [zt, Ra, Rb] of [[z1 + 1, R2, R1], [z2 + 1, R3, R2]]) {
      for (let y = Math.floor(c - Rb); y <= c + Rb; y++) for (let x = Math.floor(c - Rb); x <= c + Rb; x++) {
        const d = Math.hypot(x - c, y - c);
        if (d > Ra + 0.4 && d <= Rb - 0.6 && !m.get(x, y, zt) && m.get(x, y, zt - 1)) m.set(x, y, zt, MAT.PLANT);
      }
    }
    // Couronne vitrée, toit et mât.
    m.cyl(c, c, H + 1, H + 2, R3 - 0.3, MAT.GLASS);
    m.cyl(c, c, H + 1, H + 2, R3 - 1.5, MAT.WINDOW);
    m.cyl(c, c, H + 3, H + 3, R3, MAT.HULL2);
    m.line(c - 0.5, c - 0.5, H + 4, c - 0.5, c - 0.5, H + 5, MAT.METAL);
    m.set(c - 0.5, c - 0.5, H + 6, MAT.BEACON);
    // Ascenseur extérieur (façade x max) : deux rails, des attaches, la cabine qui monte et descend.
    const ex = Math.round(c + R1) + 1, ey = Math.round(c) - 1;
    const zb = 4, zt = z2;
    for (const yy of [ey - 1, ey + 2]) m.box(ex, yy, zb, ex, yy, zt + 1, MAT.METAL);
    for (let z = zb + 2; z <= zt; z += 5) for (const yy of [ey - 1, ey + 2]) m.line(ex, yy, z, Math.round(c + Rz(z)) - 1, yy, z, MAT.METAL);
    m.box(ex, ey - 1, zt + 2, ex + 1, ey + 2, zt + 3, MAT.HULL2);
    const cz = zb + Math.round((zt - zb - 2) * (0.5 - 0.5 * Math.cos(T * TAU)));
    m.box(ex, ey, cz, ex + 1, ey + 1, cz + 1, MAT.ACCENT);
    m.box(ex + 1, ey, cz + 1, ex + 1, ey + 1, cz + 1, MAT.WINDOW);
    // Entrée principale.
    m.box(Math.round(c) - 1, 18, 1, Math.round(c) + 1, 19, 2, MAT.HULL2);
    m.box(Math.round(c) - 1, 19, 1, Math.round(c), 19, 2, MAT.DARK);
    return m;
  }

  // Dortoir : longues barres de modules à étages, reliées par des passerelles couvertes.
  function dortoir(r) {
    const m = model(24, 24, 14);
    const nb = r.int(2, 3), w = 4, gap = 3;
    const depth = nb * w + (nb - 1) * gap;
    const yStart = Math.floor((24 - depth) / 2);
    m.box(1, yStart - 2, 0, 22, yStart + depth + 1, 0, MAT.PAD);
    const bars = [];
    for (let b = 0; b < nb; b++) {
      const L = r.int(14, 19), off = r.int(-2, 2);
      const xb = Math.max(1, Math.min(22 - L, Math.floor((24 - L) / 2) + off));
      bars.push({ xb, xe: xb + L - 1, yb: yStart + b * (w + gap), st: r.int(1, 3), roof: r.pick(['clim', 'solaire', 'clim']) });
    }
    for (const q of bars) {
      const { xb, xe, yb } = q, ye = yb + w - 1, top = 1 + q.st * 3;
      m.box(xb, yb, 1, xe, ye, top, MAT.HULL);
      m.box(xb, yb, 1, xe, ye, 1, MAT.HULL2);
      for (let s = 0; s < q.st; s++) {
        const z = 3 + s * 3;
        if (s > 0) facade(m, z - 2, xb, yb, xe, ye, () => true, MAT.HULL2);
        facade(m, z, xb, yb, xe, ye, (x, y) => (y === yb || y === ye) && (x - xb) % 5 >= 2 && (x - xb) % 5 <= 3);
      }
      // Joints des modules (nervures verticales), pignon coloré et porte.
      for (let x = xb + 5; x < xe; x += 5) { m.box(x, yb, 2, x, yb, top - 1, MAT.HULL2); m.box(x, ye, 2, x, ye, top - 1, MAT.HULL2); }
      m.box(xe, yb, 2, xe, ye, top, MAT.ACCENT);
      m.box(xe, yb + 1, 2, xe, yb + 2, 3, MAT.DARK);
      m.box(xb, yb, top, xe, ye, top, MAT.HULL2);
      if (q.roof === 'solaire') m.box(xb + 1, yb + 1, top + 1, xe - 1, ye - 1, top + 1, MAT.SOLAR);
      else for (let x = xb + 2; x < xe - 2; x += 4) { m.box(x, yb + 1, top + 1, x + 1, yb + 2, top + 1, MAT.METAL); m.set(x, yb + 1, top + 2, MAT.DARK); }
    }
    // Passerelles couvertes entre barres voisines.
    for (let b = 0; b + 1 < bars.length; b++) {
      const p = bars[b], q = bars[b + 1];
      const lo = Math.max(p.xb, q.xb) + 1, hi = Math.min(p.xe, q.xe) - 2;
      const xs = [r.int(lo, Math.max(lo, hi))];
      if (hi - lo > 8 && r.chance(0.6)) xs.push(xs[0] + 5 > hi ? xs[0] - 5 : xs[0] + 5);
      for (const x of xs) {
        m.box(x, p.yb + w, 2, x + 1, q.yb - 1, 4, MAT.HULL2);
        m.box(x + 1, p.yb + w, 3, x + 1, q.yb - 1, 3, MAT.WINDOW);
      }
    }
    m.set(bars[0].xb, bars[0].yb, 2 + bars[0].st * 3, MAT.LIGHT);
    return m;
  }

  // Villas : petites maisons sous des dômes privés, avec pelouse, arbre et bassin.
  function villas(r) {
    const m = model(24, 22, 12);
    const homes = [];
    let x = 1;
    for (let i = 0; i < 3; i++) {
      let R = r.int(4, 5);
      if (x + R * 2 + 1 > 23) R = 4;
      if (x + R * 2 + 1 > 23) break;
      homes.push({ x: x + R + 0.5, y: 9.5 + r.int(-1, 1), R, tree: r.chance(0.8), pool: r.chance(0.6), flip: r.chance(0.5), roof: r.pick([MAT.ACCENT, MAT.HULL2, MAT.COPPER]) });
      x += R * 2 + 2;
    }
    // Allée commune devant les villas.
    m.box(0, 17, 0, Math.min(23, Math.round(x)), 18, 0, MAT.PAD);
    for (const h of homes) {
      const { R } = h, cx = h.x, cy = h.y;
      m.cyl(cx, cy, 0, 0, R + 0.7, MAT.HULL2);
      m.cyl(cx, cy, 1, 1, R + 0.7, MAT.METAL, 1);
      m.cyl(cx, cy, 1, 1, R - 0.4, MAT.PLANT);
      // Haie basse autour du jardin privé.
      for (let a = 0; a < 40; a++) {
        const an = a / 40 * TAU, hx = Math.round(cx + Math.cos(an) * (R + 1.8)), hy = Math.round(cy + Math.sin(an) * (R + 1.8));
        if (Math.abs(an - Math.PI / 2) > 0.45 && hx >= 0 && hx < m.X) m.set(hx, hy, 0, MAT.PLANT);
      }
      // Maisonnette, toit coloré et fenêtres.
      const hx = Math.round(cx) + (h.flip ? 0 : -2), hy = Math.round(cy) - 2;
      m.box(hx, hy, 2, hx + 2, hy + 2, 3, MAT.HULL);
      m.box(hx, hy, 4, hx + 2, hy + 2, 4, h.roof);
      m.set(hx + 2, hy + 1, 3, MAT.WINDOW); m.set(hx + 1, hy + 2, 3, MAT.WINDOW);
      m.set(hx + 2, hy + 2, 2, MAT.DARK);
      if (h.tree) tree(m, Math.round(cx) + (h.flip ? -2 : 2), Math.round(cy) - 1, 2, 1, 1.2);
      if (h.pool) m.box(Math.round(cx) - 1, Math.round(cy) + 2, 1, Math.round(cx) + 1, Math.round(cy) + 2, 1, MAT.ICE);
      // Dôme presque entièrement vitré : quelques méridiens.
      m.dome(cx, cy, 2, R, (vx, vy, vz, nx, ny, nz) => {
        if (nz < 0.2) return MAT.HULL2;
        const lon = Math.atan2(ny, nx);
        return Math.abs(Math.sin(lon * 3)) < 0.2 || Math.abs(nz - 0.7) < 0.08 ? MAT.METAL : MAT.GLASS;
      }, 1.2);
      // Sas et chemin jusqu'à l'allée.
      const sx = Math.round(cx);
      m.box(sx - 1, Math.round(cy + R), 1, sx + 1, Math.round(cy + R) + 1, 3, MAT.HULL);
      m.box(sx, Math.round(cy + R) + 1, 1, sx, Math.round(cy + R) + 1, 2, MAT.DARK);
      m.box(sx, Math.round(cy + R) + 2, 0, sx, 16, 0, MAT.PAD);
      m.set(sx + 1, Math.round(cy + R) + 1, 4, MAT.WINDOW);
    }
    return m;
  }

  // ─── Services ───────────────────────────────────────────────

  // Hôpital : bloc blanc, croix sur le toit, aile haute avec héliport, sas d'ambulance.
  function hopital(r) {
    const m = model(22, 22, 18);
    const W = r.int(14, 17), D = r.int(9, 11), h = r.int(4, 5);
    const x1 = 1 + W, y1 = 1 + D;
    m.box(0, 0, 0, x1 + 2, y1 + 6, 0, MAT.PAD);
    m.box(2, 2, 1, x1, y1, h, MAT.HULL);
    m.box(2, 2, 1, x1, y1, 1, MAT.HULL2);
    for (let z = 2; z < h; z += 2) facade(m, z, 2, 2, x1, y1, (x, y) => (x + y) % 2 === 0);
    m.box(2, 2, h, x1, y1, h, MAT.HULL2);
    // Aile haute et héliport.
    const tw = r.int(5, 6), H2 = h + r.int(4, 6);
    m.box(2, 2, h + 1, 1 + tw, 1 + tw, H2, MAT.HULL);
    for (let z = h + 2; z < H2; z += 2) facade(m, z, 2, 2, 1 + tw, 1 + tw, (x, y) => (x + y) % 2 === 1);
    m.box(1, 1, H2 + 1, 2 + tw, 2 + tw, H2 + 1, MAT.PAD);
    const hc = Math.round(1.5 + tw / 2);
    m.box(hc - 1, hc - 1, H2 + 1, hc - 1, hc + 1, H2 + 1, MAT.STRIPE);
    m.box(hc + 1, hc - 1, H2 + 1, hc + 1, hc + 1, H2 + 1, MAT.STRIPE);
    m.set(hc, hc, H2 + 1, MAT.STRIPE);
    m.set(1, 1, H2 + 2, MAT.BEACON);
    // Grande croix sur le toit du bloc bas.
    const cxx = Math.round((3 + tw + x1) / 2), cyy = Math.round((2 + y1) / 2);
    const arm = Math.min(3, Math.floor((x1 - tw - 3) / 2));
    m.box(cxx - arm, cyy, h + 1, cxx + arm, cyy + 1, h + 1, MAT.ACCENT);
    m.box(cxx, cyy - arm + 1, h + 1, cxx + 1, cyy + arm, h + 1, MAT.ACCENT);
    // Croix sur la façade x max.
    if (h >= 5) { m.box(x1, cyy - 1, 3, x1, cyy + 1, 3, MAT.ACCENT); m.box(x1, cyy, 2, x1, cyy, 4, MAT.ACCENT); }
    // Sas d'ambulance (façade y max) : avancée, auvent sur poteaux, marquage et ambulance.
    const ax = r.int(tw + 3, Math.max(tw + 3, x1 - 7));
    m.box(ax, y1 + 1, 1, ax + 4, y1 + 2, 3, MAT.HULL2);
    m.box(ax + 1, y1 + 2, 1, ax + 3, y1 + 2, 3, MAT.DARK);
    m.box(ax, y1 + 3, 1, ax + 4, y1 + 4, 0 + 1, MAT.EMPTY);
    m.box(ax - 1, y1 + 1, 4, ax + 5, y1 + 5, 4, MAT.HULL);
    m.box(ax - 1, y1 + 1, 4, ax + 5, y1 + 1, 4, MAT.ACCENT);
    m.box(ax - 1, y1 + 5, 1, ax - 1, y1 + 5, 3, MAT.METAL);
    m.box(ax + 5, y1 + 5, 1, ax + 5, y1 + 5, 3, MAT.METAL);
    m.box(ax - 1, y1 + 6, 0, ax + 5, y1 + 6, 0, MAT.STRIPE);
    if (r.chance(0.75)) {
      const bx = ax + 1, by = y1 + 3;
      m.box(bx, by, 1, bx + 3, by + 1, 2, MAT.HULL);
      m.box(bx, by, 2, bx + 3, by + 1, 2, MAT.ACCENT);
      m.box(bx + 3, by, 2, bx + 3, by + 1, 2, MAT.GLASS);
      m.set(bx + 1, by, 3, MAT.LIGHT);
    }
    return m;
  }

  // École / académie : bâtiment en U autour d'une cour, planétarium sur le toit, drapeau qui flotte.
  function ecole(r, o) {
    const T = tOf(o);
    const m = model(22, 22, 18);
    const W = r.int(15, 18), D = r.int(12, 15), wg = 4, st = r.int(1, 2), hz = st * 3 + 1;
    const x0 = 2, y0 = 2, x1 = x0 + W - 1, y1 = y0 + D - 1;
    m.box(x0 - 1, y0 - 1, 0, x1 + 1, y1 + 2, 0, MAT.PAD);
    m.box(x0, y0, 1, x1, y0 + wg - 1, hz, MAT.HULL);
    m.box(x0, y0, 1, x0 + wg - 1, y1, hz, MAT.HULL);
    m.box(x1 - wg + 1, y0, 1, x1, y1, hz, MAT.HULL);
    m.box(x0, y0, 1, x1, y1, 1, MAT.EMPTY);
    m.box(x0, y0, 1, x1, y0 + wg - 1, 1, MAT.HULL2);
    m.box(x0, y0, 1, x0 + wg - 1, y1, 1, MAT.HULL2);
    m.box(x1 - wg + 1, y0, 1, x1, y1, 1, MAT.HULL2);
    for (let s = 0; s < st; s++) facade(m, 2 + s * 3 + (s ? 0 : 0), x0, y0, x1, y1, (x, y) => (x + y) % 2 === 0, MAT.WINDOW, MAT.HULL);
    for (let s = 0; s < st; s++) facade(m, 3 + s * 3, x0, y0, x1, y1, (x, y) => (x + y) % 2 === 0, MAT.WINDOW, MAT.HULL);
    // Corniche colorée, toits.
    facade(m, hz, x0, y0, x1, y1, () => true, MAT.ACCENT);
    // Cour : dalle, pelouse, arbres.
    m.box(x0 + wg, y0 + wg, 0, x1 - wg, y1, 0, MAT.PAD);
    m.box(x0 + wg + 1, y0 + wg + 1, 1, x1 - wg - 1, y0 + wg + 2, 1, MAT.PLANT);
    if (r.chance(0.7)) tree(m, x0 + wg + 1, y0 + wg + 1, 1, 2, 1.2);
    if (r.chance(0.7)) tree(m, x1 - wg - 1, y0 + wg + 1, 1, 2, 1.2);
    // Entrées au bout des ailes.
    m.box(x0 + 1, y1, 1, x0 + 2, y1, 2, MAT.DARK);
    m.box(x1 - 2, y1, 1, x1 - 1, y1, 2, MAT.DARK);
    // Planétarium sur l'aile droite, panneaux solaires sur l'aile du fond.
    const px = x1 - wg / 2 + 0.5, py = y0 + wg + 3.5;
    m.cyl(px, py, hz + 1, hz + 1, 2.4, MAT.HULL2);
    m.dome(px, py, hz + 2, 2.2, (x, y, z, nx, ny, nz) => (Math.abs(nx + ny) < 0.35 && nz > 0.2 ? MAT.DARK : MAT.HULL), 1.5);
    for (let x = x0 + wg + 1; x < x1 - wg; x += 2) m.box(x, y0 + 1, hz + 1, x, y0 + wg - 2, hz + 1, MAT.SOLAR);
    // Drapeau dans la cour.
    const fx = Math.round((x0 + x1) / 2) - 2, fy = y1 - 1;
    m.box(fx - 1, fy - 1, 1, fx + 1, fy + 1, 1, MAT.HULL2);
    flag(m, fx, fy, 2, hz + 3, 4, T, MAT.ACCENT);
    return m;
  }

  // Cantine / mess : pavillon rond vitré, cuisine attenante et sa cheminée qui fume.
  function cantine(r, o) {
    const T = tOf(o);
    const m = model(22, 22, 24);
    const R = r.int(5, 6), cx = 13.5, cy = 10.5, hz = 4;
    m.box(0, 3, 0, 21, 19, 0, MAT.PAD);
    // Cuisine (côté x min) et sa cheminée.
    const kx1 = 8, ky0 = Math.round(cy) - 4, ky1 = Math.round(cy) + 3;
    m.box(1, ky0, 1, kx1, ky1, 5, MAT.HULL);
    m.box(1, ky0, 5, kx1, ky1, 5, MAT.HULL2);
    facade(m, 3, 1, ky0, kx1, ky1, (x, y) => y === ky1 && x % 3 === 0);
    const ch = r.int(11, 14);
    m.cyl(3, ky0 + 2, 1, ch, 1.2, MAT.METAL);
    m.cyl(3, ky0 + 2, ch - 2, ch - 2, 1.3, MAT.ACCENT);
    m.cyl(3, ky0 + 2, ch, ch, 1.4, MAT.DARK);
    E.puffs(m, 'cantine-cheminee', 3, ky0 + 2, ch + 1, T, { n: 6, rise: 8, spread: 2, wind: 1.5, mat: MAT.HULL });
    // Hottes d'extraction sur le toit de la cuisine.
    const nf = r.int(1, 2);
    for (let i = 0; i < nf; i++) { const fx = 5 + i * 2, fy = ky1 - 2; m.box(fx, fy, 6, fx + 1, fy + 1, 6, MAT.METAL); m.set(fx, fy, 7, MAT.DARK); }
    // Quai de livraison et caisses.
    m.box(1, ky1 + 1, 0, 6, ky1 + 3, 1, MAT.HULL2);
    m.box(2, ky1, 1, 4, ky1, 3, MAT.DARK);
    const nc = r.int(1, 3);
    for (let i = 0; i < nc; i++) m.box(1 + i * 2, ky1 + 2, 2, 1 + i * 2, ky1 + 3, 2 + (i % 2), r.pick([MAT.ACCENT, MAT.COPPER, MAT.HULL]));
    // Pavillon de la salle à manger : bandeau vitré éclairé, meneaux, toit en débord.
    const seg = r.int(14, 20);
    for (let z = 1; z <= hz; z++) for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R + 0.25) continue;
      let k = MAT.HULL;
      if (z === 1) k = MAT.HULL2;
      else if (d > R - 1 && z <= 3) k = Math.floor((Math.atan2(y - cy, x - cx) + Math.PI) / TAU * seg) % 3 ? MAT.WINDOW : MAT.HULL2;
      m.set(x, y, z, k);
    }
    m.cyl(cx, cy, hz + 1, hz + 1, R + 0.9, MAT.HULL2);
    m.cyl(cx, cy, hz + 1, hz + 1, R + 0.9, MAT.ACCENT, 0.8);
    m.dome(cx, cy, hz + 2, 2.4, () => MAT.GLASS, 1.5);
    m.cyl(cx, cy, hz + 2, hz + 2, 1.5, MAT.WINDOW);
    // Entrée (façade y max) sous un auvent.
    const ex = Math.round(cx);
    m.box(ex - 1, Math.round(cy + R), 1, ex + 1, Math.round(cy + R) + 2, 3, MAT.HULL);
    m.box(ex, Math.round(cy + R) + 2, 1, ex, Math.round(cy + R) + 2, 2, MAT.DARK);
    m.box(ex - 2, Math.round(cy + R) + 1, 4, ex + 2, Math.round(cy + R) + 3, 4, MAT.ACCENT);
    // Terrasse : quelques tables.
    if (r.chance(0.6)) for (let i = 0; i < 2; i++) { const tx = Math.round(cx + R) + 1 + i * 0, ty = Math.round(cy) - 2 + i * 4; m.set(tx + 1, ty, 1, MAT.HULL2); m.set(tx + 1, ty, 2, MAT.HULL); }
    return m;
  }

  // Parc sous dôme : pelouse, arbres, bassin et fontaine.
  function parc(r, o) {
    const T = tOf(o);
    const R = r.int(9, 10), S = R * 2 + 4;
    const m = model(S, S, R + 4);
    const c = S / 2 - 0.5;
    m.cyl(c, c, 0, 0, R + 1.2, MAT.HULL2);
    m.cyl(c, c, 1, 1, R - 0.5, MAT.PLANT);
    m.cyl(c, c, 1, 2, R + 1.2, MAT.METAL, 1.6);
    // Bassin et sa plage.
    const px = Math.round(c + r.range(-2.5, 1)), py = Math.round(c + r.range(-2.5, 0)), pr = r.range(2.4, 3.2);
    m.cyl(px, py, 1, 1, pr + 1, MAT.SAND);
    m.cyl(px, py, 1, 1, pr, MAT.ICE);
    m.cyl(px, py, 1, 2, 0.6, MAT.HULL2);
    E.puffs(m, 'parc-fontaine', px, py, 3, T, { n: 4, rise: 3, spread: 1.4, wind: 0, mat: MAT.ICE });
    m.set(px, py, 3, MAT.ICE);
    // Allée vers l'entrée (y max).
    for (let y = py + Math.ceil(pr) + 1; y <= c + R; y++) m.box(Math.round(c), y, 1, Math.round(c) + 1, y, 1, MAT.SAND);
    // Arbres : uniquement là où ils tiennent sous la coupole et hors du bassin.
    const trees = [];
    const nt = r.int(6, 10);
    for (let k = 0; k < 60 && trees.length < nt; k++) {
      const a = r.range(0, TAU), d = r.range(2, R - 2.5);
      const tx = Math.round(c + Math.cos(a) * d), ty = Math.round(c + Math.sin(a) * d);
      const h = r.int(2, 3), cr = r.range(1.4, 2.1);
      const room = Math.sqrt(Math.max(0, R * R - (d + cr) ** 2)) + 2;
      if (2 + h + cr * 1.3 > room - 1) continue;
      if (Math.hypot(tx - px, ty - py) < pr + cr + 0.8) continue;
      if (Math.abs(tx - c - 0.5) < 1.5 && ty > py) continue;
      if (trees.some((q) => Math.hypot(q[0] - tx, q[1] - ty) < cr + q[2] + 0.3)) continue;
      trees.push([tx, ty, cr, h]);
    }
    for (const [tx, ty, cr, h] of trees) tree(m, tx, ty, 2, h, cr);
    // Bancs.
    m.box(Math.round(c) + 2, Math.round(c + R) - 3, 2, Math.round(c) + 3, Math.round(c + R) - 3, 2, MAT.HULL2);
    // Coupole vitrée à méridiens.
    m.dome(c, c, 3, R, (x, y, z, nx, ny, nz) => {
      const lon = Math.atan2(ny, nx);
      return Math.abs(Math.sin(lon * 3)) < 0.07 * (1.6 - nz) || Math.abs(nz - 0.55) < 0.04 ? MAT.METAL : MAT.GLASS;
    }, 1.2);
    // Sas d'entrée.
    m.box(Math.round(c) - 1, S - 3, 1, Math.round(c) + 2, S - 1, 4, MAT.HULL);
    m.box(Math.round(c), S - 1, 1, Math.round(c) + 1, S - 1, 3, MAT.DARK);
    m.box(Math.round(c) - 1, S - 1, 4, Math.round(c) + 2, S - 1, 4, MAT.ACCENT);
    return m;
  }

  // Centre sportif / arène : gradins elliptiques, terrain, projecteurs et drapeaux.
  function arene(r, o) {
    const T = tOf(o);
    const rx = r.int(9, 10), ry = r.int(7, 9);
    const m = model(rx * 2 + 4, ry * 2 + 4, 18);
    const cx = rx + 1.5, cy = ry + 1.5;
    const fieldR = r.range(0.45, 0.55), steps = 4;
    const turf = r.chance(0.6) ? MAT.PLANT : MAT.SAND;
    const gates = r.int(2, 4);
    for (let y = 0; y < m.Y; y++) for (let x = 0; x < m.X; x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry, d = Math.hypot(nx, ny);
      if (d > 1.02) continue;
      const ang = Math.atan2(ny, nx);
      if (d < fieldR) {
        m.set(x, y, 0, MAT.PAD);
        const fd = d / fieldR;
        const line = Math.abs(x - cx) < 0.6 || Math.abs(fd - 0.35) < 0.08 || fd > 0.9;
        m.set(x, y, 1, line ? MAT.STRIPE : turf);
      } else if (d < 0.9) {
        const step = Math.min(steps - 1, Math.floor((d - fieldR) / (0.9 - fieldR) * steps));
        const top = 2 + step;
        m.box(x, y, 0, x, y, top - 1, MAT.HULL2);
        m.set(x, y, top, step % 2 ? MAT.ACCENT : MAT.HULL);
      } else {
        // Mur extérieur, bandeau coloré et portes.
        const gate = Math.abs(Math.sin(ang * gates)) < 0.18 && Math.abs(Math.cos(ang * gates)) > 0;
        m.box(x, y, 0, x, y, 6, MAT.HULL);
        m.set(x, y, 4, MAT.ACCENT);
        if (gate && ny > -0.3) m.box(x, y, 1, x, y, 3, MAT.DARK);
        if ((x + y) % 4 === 0 && !gate) m.set(x, y, 2, MAT.WINDOW);
      }
    }
    // Projecteurs aux quatre coins.
    const H = r.int(12, 15);
    // (pas de mât au coin avant : il masquerait le terrain)
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1]]) {
      const x = Math.round(cx + sx * (rx + 0.5) * 0.86), y = Math.round(cy + sy * (ry + 0.5) * 0.86);
      m.box(x, y, 1, x, y, H, MAT.METAL);
      m.box(x - (sx < 0 ? 0 : 1), y, H + 1, x + (sx < 0 ? 1 : 0), y, H + 2, MAT.WINDOW);
      m.box(x - 1, y, H + 3, x + 1, y, H + 3, MAT.METAL);
    }
    // Drapeaux au sommet du mur du fond (y min).
    const nfl = r.int(2, 3);
    for (let i = 0; i < nfl; i++) {
      const x = Math.round(cx + (i - (nfl - 1) / 2) * 5) - 2;
      const y = Math.round(cy - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)) * 0.95);
      flag(m, x, y, 7, 3, 3, (T + i * 0.33) % 1, i % 2 ? MAT.STRIPE : MAT.ACCENT);
    }
    // Écran géant du côté du fond.
    const by = Math.round(cy - ry * 0.75);
    m.box(Math.round(cx) - 2, by, 6, Math.round(cx) + 2, by, 9, MAT.DARK);
    m.box(Math.round(cx) - 1, by, 7, Math.round(cx) + 1, by, 8, MAT.WINDOW);
    m.box(Math.round(cx), by, 1, Math.round(cx), by, 5, MAT.METAL);
    return m;
  }

  // Marché / centre d'échanges : halle à verrière, étals colorés, enseigne lumineuse, conteneurs.
  function marche(r, o) {
    const T = tOf(o);
    const m = model(24, 22, 14);
    const W = r.int(12, 15), D = r.int(11, 13), hz = 5;
    const x0 = 2, y0 = 2, x1 = x0 + W - 1, y1 = y0 + D - 1, cy = (y0 + y1) / 2;
    m.box(x0 - 1, y0 - 1, 0, x1 + 6, y1 + 3, 0, MAT.PAD);
    // Étals sous la halle : comptoir, marchandises, auvent rayé.
    const goods = [MAT.PLANT, MAT.COPPER, MAT.ICE, MAT.ACCENT, MAT.HULL, MAT.STRIPE];
    for (const sy of [y0 + 1, y1 - 2]) for (let x = x0 + 1; x + 1 < x1; x += 3) {
      m.box(x, sy, 1, x + 1, sy + 1, 1, MAT.HULL2);
      m.box(x, sy, 2, x + 1, sy, 2, r.pick(goods));
      m.box(x, sy, 3, x + 1, sy + 1, 3, (x / 3) % 2 < 1 ? MAT.ACCENT : MAT.HULL);
    }
    // Piliers et verrière à deux pans, nervures métalliques.
    for (let x = x0; x <= x1; x += 4) for (const y of [y0, y1]) m.box(x, y, 1, x, y, hz - 1, MAT.METAL);
    for (const y of [y0, y1]) m.box(x1, y, 1, x1, y, hz - 1, MAT.METAL);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const zr = hz + Math.min(3, Math.floor(Math.min(y - y0, y1 - y) / 2));
      const edge = y === y0 || y === y1 || x === x0 || x === x1;
      m.set(x, y, zr, edge ? MAT.HULL2 : (x - x0) % 4 === 0 ? MAT.METAL : MAT.GLASS);
    }
    m.box(x0, Math.floor(cy), hz + 3, x1, Math.ceil(cy), hz + 3, MAT.HULL2);
    // Enseigne lumineuse sur la façade avant : points qui défilent.
    const sx0 = x0 + 2, sx1 = x1 - 2, shift = Math.floor(T * 8);
    m.box(sx0 - 1, y1, hz + 1, sx1 + 1, y1, hz + 1, MAT.DARK);
    for (let x = sx0; x <= sx1; x++) if ((x + shift) % 4 < 2) m.set(x, y1, hz + 1, MAT.WINDOW);
    m.box(sx0 - 1, y1, hz + 2, sx1 + 1, y1, hz + 2, MAT.ACCENT);
    // Conteneurs empilés côté x max.
    const cols = [MAT.ACCENT, MAT.COPPER, MAT.HULL2, MAT.STRIPE];
    const ns = r.int(2, 3);
    for (let i = 0; i < ns; i++) {
      const bx = x1 + 2, by = y0 + i * 5, hh = r.int(1, 2);
      for (let k = 0; k < hh; k++) {
        const col = r.pick(cols);
        m.box(bx, by, 1 + k * 2, bx + 2, by + 3, 2 + k * 2, col);
        m.box(bx + 2, by, 1 + k * 2, bx + 2, by + 3, 1 + k * 2, MAT.METAL);
      }
    }
    m.set(x1 + 3, y1 + 2, 1, MAT.STRIPE);
    return m;
  }

  E.register([
    { key: 'immeuble', cat: 'habitat', name: 'Immeuble modulaire', desc: 'Modules d’habitation empilés en quinconce autour d’une cage d’escalier.',
      eco: { pop: 12, power: -2 }, anim: false, build: immeuble },
    { key: 'capsules', cat: 'habitat', name: 'Capsules d’habitation', desc: 'Pods ronds sur pilotis, reliés par des passerelles à une tour d’accès.',
      eco: { pop: 8, power: -1 }, anim: false, build: capsules },
    { key: 'bunker', cat: 'habitat', name: 'Habitat semi-enterré', desc: 'Logements protégés sous une butte de régolithe, éclairés par des puits de lumière.',
      eco: { pop: 10, power: -2 }, anim: false, build: bunker },
    { key: 'arcologie', cat: 'habitat', name: 'Arcologie', desc: 'Tour d’habitation à gradins et jardins suspendus, ascenseur extérieur.',
      eco: { pop: 24, power: -4 }, anim: true, build: arcologie },
    { key: 'dortoir', cat: 'habitat', name: 'Dortoir', desc: 'Longues barres de modules à étages reliées par des passerelles couvertes.',
      eco: { pop: 16, power: -3 }, anim: false, build: dortoir },
    { key: 'villas', cat: 'habitat', name: 'Villas sous dôme', desc: 'Maisonnettes sous de petits dômes vitrés privés, avec pelouse, arbre et bassin.',
      eco: { pop: 6, power: -2 }, anim: false, build: villas },
    { key: 'hopital', cat: 'services', name: 'Hôpital', desc: 'Bloc médical marqué d’une croix, héliport et sas d’ambulance.',
      eco: { jobs: 6, power: -3 }, per: 60, anim: false, build: hopital },
    { key: 'ecole', cat: 'services', name: 'Académie', desc: 'École en U autour d’une cour, planétarium sur le toit et drapeau.',
      eco: { jobs: 4, power: -2 }, per: 50, anim: true, build: ecole },
    { key: 'cantine', cat: 'services', name: 'Cantine', desc: 'Pavillon rond vitré pour les repas, cuisine attenante et cheminée qui fume.',
      eco: { jobs: 3, power: -2 }, per: 40, anim: true, build: cantine },
    { key: 'parc', cat: 'services', name: 'Parc sous dôme', desc: 'Pelouse, arbres et bassin à fontaine sous une grande coupole vitrée.',
      eco: { jobs: 2, power: -1 }, per: 50, anim: true, build: parc },
    { key: 'arene', cat: 'services', name: 'Arène sportive', desc: 'Gradins elliptiques autour d’un terrain, projecteurs, écran géant et drapeaux.',
      eco: { jobs: 5, power: -3 }, per: 80, anim: true, build: arene },
    { key: 'marche', cat: 'services', name: 'Marché', desc: 'Halle à verrière et étals colorés, enseigne lumineuse et conteneurs d’échange.',
      eco: { jobs: 5, power: -2 }, per: 70, anim: true, build: marche }
  ]);
})(typeof module === 'object' && module.exports ? require('../building-engine.js') : self.OrbiteBuildings);
