/* ORBITE — générateur de bâtiments (colonies façon Surviving Mars / StarCraft).
 * Chaque bâtiment est un petit modèle en voxels, construit à partir d'une graine : la même graine
 * donne toujours le même bâtiment. Le rendu isométrique pixel art est dans building-renderer.js.
 * Pur et déterministe : utilisable sous Node (tests) comme dans le navigateur. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteBuildings = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Matériaux ──────────────────────────────────────────────
  // Chaque matériau a une rampe de 6 teintes (sombre → clair), choisie au rendu selon le thème.
  const MAT = {
    EMPTY: 0, GROUND: 1, ROCK: 2, STRATA: 3, SAND: 4,
    HULL: 5, HULL2: 6, METAL: 7, DARK: 8, GLASS: 9, PLANT: 10, SOLAR: 11,
    ACCENT: 12, COPPER: 13, PAD: 14, STRIPE: 15, LIGHT: 16, WINDOW: 17, BEACON: 18, ICE: 19, TRUNK: 20, LAVA: 21, GRASS: 22, LEAF: 23
  };
  const EMISSIVE = new Set([MAT.LIGHT, MAT.WINDOW, MAT.BEACON, MAT.LAVA]);
  const BLINK = new Set([MAT.LIGHT, MAT.BEACON]);
  const ALPHA = { [MAT.GLASS]: 0.5 };

  // ─── Hasard déterministe ────────────────────────────────────
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function makeRng(seed, state) {
    let a = state != null ? state : (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (a0, b0) => a0 + (b0 - a0) * next(),
      int: (a0, b0) => Math.floor(a0 + (b0 - a0 + 1) * next()),
      pick: (list) => list[Math.floor(next() * list.length)],
      chance: (p) => next() < p,
      // Copie qui reprend exactement la suite des tirages à partir d'ici.
      clone: () => makeRng(0, a)
    };
  }

  // ─── Modèle en voxels ───────────────────────────────────────
  function model(X, Y, Z) {
    const v = new Uint8Array(X * Y * Z);
    const m = {
      X, Y, Z, v,
      idx: (x, y, z) => (z * Y + y) * X + x,
      inside: (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < X && y < Y && z < Z,
      get(x, y, z) { x |= 0; y |= 0; z |= 0; return m.inside(x, y, z) ? v[m.idx(x, y, z)] : 0; },
      set(x, y, z, k) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (m.inside(x, y, z)) v[m.idx(x, y, z)] = k; },
      box(x0, y0, z0, x1, y1, z1, k) {
        for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.set(x, y, z, k);
      },
      // Cylindre vertical (creux si wall > 0 : seulement l'épaisseur de paroi).
      cyl(cx, cy, z0, z1, r, k, wall) {
        for (let z = z0; z <= z1; z++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d <= r + 0.25 && (!wall || d > r - wall)) m.set(x, y, z, k);
        }
      },
      // Cylindre couché le long de x (axis 'x') ou de y.
      tube(axis, a0, a1, cu, cz, r, k) {
        for (let a = a0; a <= a1; a++) for (let u = Math.floor(cu - r); u <= cu + r; u++) for (let z = Math.floor(cz - r); z <= cz + r; z++) {
          if (Math.hypot(u - cu, z - cz) <= r + 0.25) { if (axis === 'x') m.set(a, u, z, k); else m.set(u, a, z, k); }
        }
      },
      // Demi-sphère ; fn(x, y, z, nx, ny, nz) choisit le matériau de chaque voxel de la coque.
      dome(cx, cy, z0, r, fn, shell) {
        for (let z = z0; z <= z0 + r; z++) for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const d = Math.hypot(x - cx, y - cy, (z - z0) * 1.0);
          if (d <= r + 0.3 && d > r - (shell || 1.2)) { const k = fn(x, y, z, (x - cx) / r, (y - cy) / r, (z - z0) / r); if (k) m.set(x, y, z, k); }
        }
      },
      line(x0, y0, z0, x1, y1, z1, k, r) {
        const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)) * 1.5) + 1;
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
          if (r) m.box(Math.round(x - r), Math.round(y - r), Math.round(z), Math.round(x + r), Math.round(y + r), Math.round(z), k);
          else m.set(x, y, z, k);
        }
      },
      blit(src, ox, oy, oz) {
        for (let z = 0; z < src.Z; z++) for (let y = 0; y < src.Y; y++) for (let x = 0; x < src.X; x++) {
          const k = src.v[src.idx(x, y, z)];
          if (k) m.set(x + ox, y + oy, z + oz, k);
        }
      },
      count() { let n = 0; for (const k of v) if (k) n++; return n; }
    };
    return m;
  }

  // Recadre un modèle sur son contenu (les générateurs prévoient large) ; le sol (z = 0) est conservé.
  function bbox(m) {
    let x0 = m.X, y0 = m.Y, x1 = -1, y1 = -1;
    for (let z = 0; z < m.Z; z++) for (let y = 0; y < m.Y; y++) for (let x = 0; x < m.X; x++) {
      if (!m.v[m.idx(x, y, z)]) continue;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : [x0, y0, x1, y1];
  }
  // box : cadre imposé (celui de l'image t = 0 pour un bâtiment animé, pour garder la même taille).
  function trim(m, box) {
    const b = box || bbox(m);
    if (!b) return m;
    const [x0, y0, x1, y1] = b, z1 = m.Z - 1;
    const o = model(x1 - x0 + 1, y1 - y0 + 1, z1 + 1);
    for (let z = 0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) o.v[o.idx(x - x0, y - y0, z)] = m.v[m.idx(x, y, z)];
    return o;
  }

  // Sol : une dalle de terrain avec relief léger, cailloux et strates sur la tranche.
  function slab(m, r, o) {
    o = o || {};
    const h0 = o.height || 3;
    for (let y = 0; y < m.Y; y++) for (let x = 0; x < m.X; x++) {
      const bump = o.flat ? 0 : (Math.sin(x * 0.37 + r.seedA) + Math.cos(y * 0.29 + r.seedB) > 1.35 ? 1 : 0);
      const top = h0 + bump;
      for (let z = 0; z <= top; z++) m.set(x, y, z, z < top - 1 ? (z % 2 ? MAT.STRATA : MAT.ROCK) : z === top ? MAT.GROUND : MAT.STRATA);
    }
    // Cailloux et cratères.
    const rocks = Math.floor(m.X * m.Y / 70);
    for (let i = 0; i < rocks; i++) {
      const x = r.int(0, m.X - 1), y = r.int(0, m.Y - 1);
      if (r.chance(0.12)) {
        const cr = r.int(2, 4);
        for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) {
          const d = Math.hypot(dx, dy);
          if (d < cr - 0.5) m.set(x + dx, y + dy, h0, MAT.EMPTY);
          else if (d < cr + 0.6) m.set(x + dx, y + dy, h0 + 1, MAT.SAND);
        }
      } else m.set(x, y, h0 + 1, r.chance(0.5) ? MAT.ROCK : MAT.SAND);
    }
    return h0 + 1;
  }

  // ─── Bâtiments ──────────────────────────────────────────────
  // Chaque générateur reçoit (rng, base) et renvoie un modèle posé sur z = 0 (le sol est ajouté au
  // rendu ou par la colonie). Les tailles restent petites : 8 à 30 voxels de côté.

  function geoFrame(x, y, z, nx, ny, nz, freq) {
    // Treillis géodésique : lignes de latitude et méridiens décalés.
    const lat = Math.asin(Math.max(-1, Math.min(1, nz)));
    const lon = Math.atan2(ny, nx);
    const band = Math.floor(lat * freq / 1.3);
    const a = Math.abs(Math.sin(lat * freq)) < 0.22;
    const b = Math.abs(Math.sin(lon * (freq + 1) + band * 0.9)) < 0.18 * (1.1 - nz * 0.4);
    return a || b;
  }

  // Bouffées de fumée ou de vapeur qui montent et se dispersent en boucle (t de 0 à 1).
  function puffs(m, key, x, y, z, t, o) {
    o = o || {};
    const pr = makeRng('fumee:' + key);
    const n = o.n || 5, rise = o.rise || 7;
    for (let i = 0; i < n; i++) {
      const ph = (t + i / n) % 1;
      const h = ph * rise, spread = 0.4 + ph * (o.spread || 2);
      const dx = (pr.next() - 0.5) * spread * 2 + ph * (o.wind || 1.5), dy = (pr.next() - 0.5) * spread;
      const size = ph < 0.3 ? 0 : ph < 0.75 ? 1 : 0;
      const k = o.mat || MAT.HULL2;
      if (ph > 0.92) continue;
      m.box(Math.round(x + dx), Math.round(y + dy), Math.round(z + h), Math.round(x + dx + size), Math.round(y + dy), Math.round(z + h + size), k);
    }
  }

  const B = {};

  B.dome = function (r, o) {
    const R = r.int(6, 10), S = R * 2 + 5;
    const m = model(S, S, R + 4);
    const c = S / 2 - 0.5;
    m.cyl(c, c, 0, 1, R + 1.5, MAT.HULL2);
    m.cyl(c, c, 1, 1, R + 1.5, MAT.METAL, 1);
    const glassy = o.glass != null ? o.glass : r.chance(0.4);
    const freq = r.int(3, 5);
    m.dome(c, c, 2, R, (x, y, z, nx, ny, nz) => {
      if (geoFrame(x, y, z, nx, ny, nz, freq)) return MAT.METAL;
      if (glassy) return MAT.GLASS;
      return z < 4 && (x + y) % 5 === 0 ? MAT.WINDOW : (x * 7 + y * 3 + z) % 11 === 0 ? MAT.HULL2 : MAT.HULL;
    }, 1.3);
    if (glassy) {
      // Intérieur visible : sol, jardins et petits bâtiments.
      m.cyl(c, c, 2, 2, R - 1, MAT.PAD);
      for (let i = 0; i < R * 2; i++) {
        const a = r.range(0, 6.28), d = r.range(1, R - 2);
        const x = c + Math.cos(a) * d, y = c + Math.sin(a) * d;
        const h = r.int(1, 3);
        m.box(Math.round(x), Math.round(y), 3, Math.round(x), Math.round(y), 2 + h, r.chance(0.6) ? MAT.PLANT : MAT.HULL);
      }
    }
    // Sas d'entrée.
    m.box(Math.round(c) - 1, S - 3, 2, Math.round(c) + 1, S - 1, 4, MAT.HULL);
    m.box(Math.round(c), S - 1, 2, Math.round(c), S - 1, 3, MAT.DARK);
    m.set(Math.round(c) - 1, S - 1, 5, MAT.LIGHT);
    return m;
  };

  B.serre = function (r) {
    const R = r.int(6, 9);
    const m = B.dome(r, { glass: true });
    // La serre : plus de végétation, des rangées de cultures.
    const S = m.X, c = S / 2 - 0.5;
    for (let y = Math.floor(c - R + 2); y <= c + R - 2; y += 2) for (let x = Math.floor(c - R + 2); x <= c + R - 2; x++) {
      if (Math.hypot(x - c, y - c) < R - 1.5) m.set(x, y, 3, MAT.PLANT);
    }
    return m;
  };

  B.module = function (r) {
    const n = r.int(2, 4), L = r.int(7, 11), rad = r.int(2, 3);
    const W = n * (L + 3) + 2, D = rad * 2 + 7;
    const m = model(W, D, rad * 2 + 6);
    const cy = Math.floor(D / 2);
    for (let i = 0; i < n; i++) {
      const x0 = 1 + i * (L + 3);
      // Pieds, cylindre couché, hublots et bandes de couleur.
      for (const fx of [x0 + 1, x0 + L - 2]) m.box(fx, cy - rad, 0, fx, cy + rad, 1, MAT.METAL);
      m.tube('x', x0, x0 + L - 1, cy, rad + 2, rad + 0.4, MAT.HULL);
      m.tube('x', x0, x0, cy, rad + 2, rad + 0.4, MAT.HULL2);
      m.tube('x', x0 + L - 1, x0 + L - 1, cy, rad + 2, rad + 0.4, MAT.HULL2);
      for (let x = x0 + 2; x < x0 + L - 2; x += 2) m.set(x, cy + rad, rad + 2, MAT.WINDOW);
      m.box(x0 + Math.floor(L / 2), cy - rad - 1, rad + 1, x0 + Math.floor(L / 2), cy + rad + 1, rad + 3, MAT.ACCENT);
      if (r.chance(0.5)) { m.box(x0 + 2, cy - 1, rad * 2 + 3, x0 + L - 3, cy + 1, rad * 2 + 3, MAT.SOLAR); }
      // Couloir vers le module suivant.
      if (i < n - 1) m.tube('x', x0 + L, x0 + L + 2, cy, rad + 2, 1.2, MAT.HULL2);
    }
    m.set(1, cy, rad * 2 + 4, MAT.BEACON);
    return m;
  };

  B.forage = function (r, o) {
    const H = r.int(16, 26), S = 15;
    const m = model(S, S, H + 4);
    const c = 7;
    m.box(1, 1, 0, S - 2, S - 2, 1, MAT.PAD);
    m.box(1, 1, 1, S - 2, 1, 1, MAT.STRIPE);
    // Derrick en treillis : quatre montants qui se rejoignent, entretoises en X.
    const top = H;
    const corners = [[c - 4, c - 4], [c + 4, c - 4], [c - 4, c + 4], [c + 4, c + 4]];
    for (const [x, y] of corners) m.line(x, y, 2, c + Math.sign(x - c) * 1, c + Math.sign(y - c) * 1, top, MAT.METAL);
    for (let z = 4; z < top; z += 4) {
      const k = 1 - (z - 2) / (top - 2), s = 1 + 3 * k;
      m.line(c - s, c - s, z, c + s, c - s, z, MAT.ACCENT); m.line(c - s, c + s, z, c + s, c + s, z, MAT.ACCENT);
      m.line(c - s, c - s, z, c - s, c + s, z, MAT.ACCENT); m.line(c + s, c - s, z, c + s, c + s, z, MAT.ACCENT);
    }
    m.box(c - 1, c - 1, top, c + 1, c + 1, top + 1, MAT.HULL2);
    m.set(c, c, top + 2, MAT.BEACON);
    // Tige de forage, tête qui pompe de haut en bas, treuil et réservoirs.
    const T = (o && o.t) || 0;
    m.box(c, c, 2, c, c, top - 1, MAT.COPPER);
    m.box(c - 1, c - 1, 2, c + 1, c + 1, 3, MAT.DARK);
    const head = Math.round(5 + (top - 9) * (0.5 + 0.5 * Math.sin(T * 6.283)));
    m.box(c - 1, c - 1, head, c + 1, c + 1, head + 1, MAT.ACCENT);
    m.cyl(2.5, S - 3.5, 2, 6, 1.6, MAT.HULL);
    m.cyl(S - 3.5, S - 3.5, 2, 5, 1.6, MAT.HULL);
    m.line(4, S - 4, 3, c, c, 3, MAT.COPPER);
    m.box(S - 5, 2, 2, S - 2, 4, 4, MAT.HULL2);
    m.set(S - 2, 3, 5, MAT.LIGHT);
    return m;
  };

  B.reservoir = function (r) {
    const n = r.int(2, 5), S = 6 + n * 4;
    const m = model(S, S, 16);
    m.box(0, 0, 0, S - 1, S - 1, 0, MAT.PAD);
    const spots = [];
    for (let i = 0; i < n; i++) spots.push([3 + (i % 3) * 5 + (i >= 3 ? 2 : 0), 3 + Math.floor(i / 3) * 6 + r.int(0, 2)]);
    for (const [x, y] of spots) {
      const h = r.int(6, 12), rr = r.range(1.8, 2.6);
      m.cyl(x, y, 1, h, rr, MAT.HULL);
      m.cyl(x, y, h + 1, h + 1, rr - 0.8, MAT.HULL2);
      for (let z = 3; z < h; z += 4) m.cyl(x, y, z, z, rr, MAT.ACCENT, 1);
      m.line(x, y, 2, S / 2, S / 2, 2, MAT.COPPER);
    }
    m.box(Math.floor(S / 2) - 1, Math.floor(S / 2) - 1, 1, Math.floor(S / 2) + 1, Math.floor(S / 2) + 1, 3, MAT.METAL);
    return m;
  };

  B.solaire = function (r) {
    const rows = r.int(2, 4), cols = r.int(3, 6);
    const m = model(cols * 5 + 2, rows * 6 + 2, 6);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x0 = 1 + i * 5, y0 = 1 + j * 6;
      m.box(x0 + 2, y0 + 2, 0, x0 + 2, y0 + 2, 2, MAT.METAL);
      // Panneau incliné vers le soleil, cadre clair.
      for (let y = 0; y < 4; y++) m.box(x0, y0 + y, 2 + Math.floor(y / 2), x0 + 3, y0 + y, 2 + Math.floor(y / 2), y === 0 ? MAT.HULL2 : MAT.SOLAR);
    }
    return m;
  };

  B.antenne = function (r, o) {
    const R = r.int(5, 8), H = r.int(6, 10), S = R * 2 + 5;
    const m = model(S, S, H + R + 6);
    const c = Math.floor(S / 2);
    m.box(c - 2, c - 2, 0, c + 2, c + 2, 2, MAT.HULL2);
    m.box(c - 1, c - 1, 3, c + 1, c + 1, H, MAT.METAL);
    // Parabole : calotte tournée vers le ciel et un peu de côté.
    const tilt = r.range(0.25, 0.6);
    const yaw = ((o && o.t) || 0) * 6.283, cs = Math.cos(yaw), sn = Math.sin(yaw);
    // Chaque case de la grille est ramenée dans le repère de la parabole (rotation inverse) : pas de trou.
    const zAt = (gx, gy) => {
      const x = gx * cs + gy * sn, y = -gx * sn + gy * cs, d = Math.hypot(x, y);
      return d > R ? null : { z: H + 2 + Math.round((d * d) / (R * 1.6) + y * tilt), d };
    };
    for (let gy = -R; gy <= R; gy++) for (let gx = -R; gx <= R; gx++) {
      const p = zAt(gx, gy);
      if (!p) continue;
      // La coque est remplie jusqu'à ses voisines : une pente raide ne laisse pas de trou.
      let lo = p.z;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = zAt(gx + dx, gy + dy); if (q) lo = Math.min(lo, q.z + 1); }
      for (let z = Math.min(lo, p.z); z <= p.z; z++) m.set(c + gx, c + gy, z, p.d > R - 1 ? MAT.HULL2 : MAT.HULL);
    }
    m.line(c, c, H + 2, c + sn, c - cs, H + R + 2, MAT.METAL);
    m.set(c + sn, c - cs, H + R + 3, MAT.BEACON);
    m.box(c + 3, c - 2, 0, c + 5, c + 2, 3, MAT.HULL);
    m.set(c + 5, c, 2, MAT.WINDOW);
    return m;
  };

  B.fusee = function (r, o) {
    const H = r.int(20, 30), R = r.range(2.3, 3.2), S = Math.ceil(R * 2) + 9;
    const m = model(S, S, H + 4);
    const c = S / 2 - 0.5;
    const black = r.chance(0.5);
    for (let z = 0; z < H; z++) {
      const t = z / H;
      const rr = t > 0.8 ? R * Math.sqrt(Math.max(0, (1 - t) / 0.2)) : R;
      m.cyl(c, c, z + 2, z + 2, rr, black && t < 0.45 && (Math.round(c) + z) % 1 === 0 ? MAT.DARK : MAT.HULL);
    }
    // Ailerons, hublots, flammes d'appoint.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let z = 2; z < 9; z++) { const w = Math.round((9 - z) / 2.5); m.line(c + dx * R, c + dy * R, z, c + dx * (R + w + 1), c + dy * (R + w + 1), z, MAT.HULL2); }
    }
    for (let z = Math.floor(H * 0.7); z < H * 0.78; z += 2) m.set(Math.round(c), Math.round(c + R), z, MAT.WINDOW);
    m.box(Math.round(c) - 1, Math.round(c) - 1, 0, Math.round(c) + 1, Math.round(c) + 1, 1, MAT.DARK);
    m.set(Math.round(c), Math.round(c), H + 2, MAT.BEACON);
    // Vapeur des réservoirs qui s'échappe au pied du lanceur.
    const T = (o && o.t) || 0;
    puffs(m, 'fusee-a', c - R - 1, c, 1, T, { n: 4, rise: 3, spread: 2, wind: -2 });
    puffs(m, 'fusee-b', c + R + 1, c, 1, (T + 0.5) % 1, { n: 4, rise: 3, spread: 2, wind: 2 });
    return m;
  };

  B.piste = function (r, o) {
    const R = r.int(9, 12), S = R * 2 + 3;
    const withRocket = r.chance(0.6);
    const rocket = withRocket ? B.fusee(r, o) : null;
    const m = model(S, S, rocket ? rocket.Z + 2 : 6);
    const c = S / 2 - 0.5;
    m.cyl(c, c, 0, 0, R, MAT.PAD);
    m.cyl(c, c, 1, 1, R * 0.62, MAT.STRIPE, 1);
    m.cyl(c, c, 1, 1, R, MAT.STRIPE, 0.8);
    // Feux autour de la piste.
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; m.set(c + Math.cos(a) * (R - 1), c + Math.sin(a) * (R - 1), 1, MAT.LIGHT); }
    if (rocket) m.blit(rocket, Math.round(c - rocket.X / 2), Math.round(c - rocket.Y / 2), 0);
    else { m.line(c - 3, c - 3, 1, c + 3, c + 3, 1, MAT.STRIPE); m.line(c - 3, c + 3, 1, c + 3, c - 3, 1, MAT.STRIPE); }
    return m;
  };

  B.usine = function (r, o) {
    const W = r.int(16, 24), D = r.int(12, 18);
    const m = model(W, D, 30);
    m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
    // Halls, toits en dents de scie, cheminées, tuyaux.
    const h1 = r.int(5, 7);
    m.box(1, 1, 1, Math.floor(W * 0.6), D - 2, h1, MAT.HULL);
    for (let x = 2; x < W * 0.6; x += 3) m.box(x, 1, h1 + 1, x + 1, D - 2, h1 + 1, MAT.SOLAR);
    for (let x = 2; x < W * 0.6; x += 3) m.set(x, D - 2, 2, MAT.WINDOW);
    m.box(Math.floor(W * 0.6) + 2, 2, 1, W - 2, Math.floor(D / 2), 4, MAT.HULL2);
    const chim = r.int(1, 3);
    for (let i = 0; i < chim; i++) {
      const x = Math.floor(W * 0.65) + i * 3, y = D - 4, h = r.int(10, 18);
      m.cyl(x, y, 1, h, 1.2, MAT.METAL);
      m.cyl(x, y, h - 2, h - 2, 1.2, MAT.ACCENT);
      m.set(x, y, h + 1, MAT.BEACON);
      puffs(m, 'usine' + i, x, y, h + 2, (((o && o.t) || 0) + i * 0.33) % 1, { n: 5, rise: 8, mat: MAT.METAL });
    }
    m.tube('x', 1, W - 2, D - 2, 3, 0.8, MAT.COPPER);
    m.line(W - 3, 3, 5, W - 3, 3, 9, MAT.METAL);
    return m;
  };

  B.tour = function (r, o) {
    const H = r.int(14, 22), S = 13;
    const m = model(S, S, H + 8);
    const c = 6;
    m.box(c - 4, c - 4, 0, c + 4, c + 4, 2, MAT.HULL2);
    m.cyl(c, c, 3, H, 1.8, MAT.HULL);
    for (let z = 5; z < H; z += 5) m.cyl(c, c, z, z, 1.8, MAT.ACCENT);
    // Salle de contrôle vitrée en haut, antennes.
    m.cyl(c, c, H + 1, H + 3, 3.4, MAT.GLASS);
    m.cyl(c, c, H + 1, H + 1, 3.4, MAT.HULL2);
    m.cyl(c, c, H + 4, H + 4, 3.6, MAT.HULL);
    m.line(c, c, H + 5, c, c, H + 7, MAT.METAL);
    m.set(c, c, H + 8, MAT.BEACON);
    const a = ((o && o.t) || 0) * 6.283;
    m.line(c, c, H + 6, c + Math.cos(a) * 3, c + Math.sin(a) * 3, H + 6, MAT.HULL2);
    return m;
  };

  B.rover = function (r) {
    const m = model(12, 8, 7);
    m.box(2, 1, 2, 9, 6, 3, MAT.HULL);
    m.box(6, 2, 4, 9, 5, 5, MAT.GLASS);
    m.box(2, 2, 4, 5, 5, 4, r.chance(0.5) ? MAT.SOLAR : MAT.ACCENT);
    for (const x of [2, 5, 8]) for (const y of [0, 7]) m.box(x, y, 0, x + 1, y, 1, MAT.DARK);
    m.set(10, 3, 3, MAT.WINDOW); m.set(10, 4, 3, MAT.WINDOW);
    m.line(3, 3, 5, 3, 3, 6, MAT.METAL);
    m.set(3, 3, 6, MAT.BEACON);
    return m;
  };

  B.eolienne = function (r, o) {
    const H = r.int(14, 22), L = r.int(5, 8), S = L * 2 + 3;
    const m = model(S, 5, H + L + 3);
    const c = Math.floor(S / 2);
    m.box(c - 1, 1, 0, c + 1, 3, 1, MAT.PAD);
    m.box(c, 2, 2, c, 2, H, MAT.HULL);
    m.box(c - 1, 1, H, c + 1, 3, H + 1, MAT.HULL2);
    // Trois pales dans le plan face à nous.
    const a0 = r.range(0, 2.1) + ((o && o.t) || 0) * 2.094;
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * 2.094;
      m.line(c, 0, H + 1, c + Math.cos(a) * L, 0, H + 1 + Math.sin(a) * L, MAT.HULL);
    }
    m.set(c, 0, H + 1, MAT.ACCENT);
    m.set(c, 2, H + 2, MAT.BEACON);
    return m;
  };

  B.reacteur = function (r, o) {
    const R = r.int(5, 7), H = r.int(14, 20), S = R * 2 + 9;
    const m = model(S, S, H + 12);
    const c = S / 2 - 0.5;
    m.box(0, 0, 0, S - 1, S - 1, 0, MAT.PAD);
    // Tour de refroidissement : profil en sablier (hyperboloïde).
    for (let z = 1; z <= H; z++) {
      const t = (z - H * 0.65) / H;
      const rr = R * (0.72 + 1.4 * t * t);
      m.cyl(c, c, z, z, rr, z > H - 2 ? MAT.ACCENT : MAT.HULL2, 1.4);
    }
    // Vapeur légère au sommet et bâtiment du réacteur.
    for (let i = 0; i < 6; i++) m.set(c + r.range(-2, 2), c + r.range(-2, 2), H + 1 + r.int(0, 2), MAT.HULL);
    for (let k = 0; k < 3; k++) puffs(m, 'reacteur' + k, c + k - 1, c, H + 2, (((o && o.t) || 0) + k / 3) % 1, { n: 4, rise: 5, spread: 3, mat: MAT.HULL });
    m.box(S - 6, 1, 1, S - 2, 6, 5, MAT.HULL);
    m.dome(S - 4, 3.5, 6, 2, () => MAT.HULL2, 2);
    m.set(S - 2, 3, 3, MAT.WINDOW);
    m.set(c, S - 2, 2, MAT.LIGHT);
    return m;
  };

  B.hangar = function (r) {
    const L = r.int(14, 22), R = r.int(4, 6);
    const m = model(L + 2, R * 2 + 5, R + 4);
    const cy = R + 2;
    m.box(0, 0, 0, L + 1, R * 2 + 4, 0, MAT.PAD);
    // Toit en voûte, nervures, grande porte.
    for (let x = 1; x <= L; x++) for (let y = cy - R; y <= cy + R; y++) {
      const z = Math.round(Math.sqrt(Math.max(0, R * R - (y - cy) ** 2)));
      m.box(x, y, 1, x, y, z, MAT.EMPTY);
      m.set(x, y, z + 1, x % 4 === 0 ? MAT.HULL2 : MAT.HULL);
    }
    for (let y = cy - R; y <= cy + R; y++) { const z = Math.round(Math.sqrt(Math.max(0, R * R - (y - cy) ** 2))); m.box(L, y, 1, L, y, z, MAT.HULL2); m.box(1, y, 1, 1, y, z, MAT.HULL2); }
    m.box(L, cy - Math.floor(R / 2), 1, L, cy + Math.floor(R / 2), Math.floor(R * 0.8), MAT.DARK);
    m.set(L + 1, cy, Math.floor(R * 0.8) + 1, MAT.LIGHT);
    return m;
  };

  B.labo = function (r) {
    const W = r.int(10, 14), D = r.int(8, 11);
    const m = model(W + 4, D + 4, 14);
    m.box(1, 1, 0, W + 2, D + 2, 1, MAT.HULL2);
    m.box(2, 2, 2, W + 1, D + 1, 5, MAT.HULL);
    for (let x = 3; x < W + 1; x += 2) m.set(x, D + 1, 4, MAT.WINDOW);
    m.box(2, 2, 6, W + 1, D + 1, 6, MAT.HULL2);
    // Petite coupole d'observation et capteurs.
    m.dome(5, 5, 7, 3, (x, y, z, nx, ny, nz) => (nz > 0.6 ? MAT.GLASS : MAT.HULL), 1.3);
    m.line(W, 4, 7, W, 4, 12, MAT.METAL);
    m.set(W, 4, 13, MAT.BEACON);
    m.box(W - 2, D - 1, 7, W, D + 1, 7, MAT.SOLAR);
    m.box(W + 1, 4, 2, W + 3, 6, 3, MAT.ACCENT);
    return m;
  };

  B.habitat = function (r) {
    // Grappe de petits dômes reliés, façon Surviving Mars.
    const n = r.int(3, 5), S = 34;
    const m = model(S, S, 12);
    const rad = [r.int(4, 5)];
    const pts = [[17, 17]];
    // Chaque nouveau dôme se pose à côté d'un autre, sans le toucher (le couloir les relie).
    for (let i = 1, tries = 0; i < n && tries < 60; tries++) {
      const R = r.int(3, 4), j = r.int(0, pts.length - 1), a = r.range(0, 6.28), d = rad[j] + R + 3;
      const p = [Math.round(pts[j][0] + Math.cos(a) * d), Math.round(pts[j][1] + Math.sin(a) * d)];
      if (p[0] - R < 1 || p[1] - R < 1 || p[0] + R > S - 2 || p[1] + R > S - 2) continue;
      if (pts.some((q, k) => Math.hypot(q[0] - p[0], q[1] - p[1]) < rad[k] + R + 2)) continue;
      pts.push(p); rad.push(R); i++;
    }
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[Math.max(0, i - 1 - (i > 2 ? r.int(0, 1) : 0))];
      m.line(x0, y0, 1, x1, y1, 1, MAT.HULL2, 1);
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i], R = rad[i];
      m.cyl(x, y, 0, 1, R + 0.6, MAT.HULL2);
      const glassy = r.chance(0.35);
      m.dome(x, y, 2, R, (vx, vy, vz, nx, ny, nz) => (geoFrame(vx, vy, vz, nx, ny, nz, 3) ? MAT.METAL : glassy ? MAT.GLASS : MAT.HULL), 1.3);
      if (glassy) m.cyl(x, y, 2, 2, R - 1, MAT.PLANT);
      m.set(x, y + R, 2, MAT.WINDOW);
    }
    return m;
  };

  // ─── Catalogue ──────────────────────────────────────────────
  // ─── Registre ───────────────────────────────────────────────
  // Chaque bâtiment : { key, name, desc, cat, eco, role, per, build(r, o) }.
  // eco (par bâtiment) : pop (places de logement), jobs (emplois), power, water, oxygen, food,
  // research, materials : positif = production, négatif = consommation. Chaque colon consomme 1 d'eau,
  // 1 d'oxygène et 1 de nourriture. role : 'hq', 'storage', 'spaceport', 'comms', 'defense', 'vehicle',
  // 'ice' / 'ore' (posé sur un gisement). per : un exemplaire pour tant d'habitants (services).
  const CATS = {
    habitat: 'Habitat', services: 'Services', vie: 'Support vital', energie: 'Énergie',
    industrie: 'Industrie', logistique: 'Logistique', science: 'Science', defense: 'Défense'
  };
  const TYPES = [];
  const TYPE_BY_KEY = {};
  function register(list) {
    for (const t of list) {
      if (TYPE_BY_KEY[t.key]) continue;
      t.eco = Object.assign({ pop: 0, jobs: 0, power: 0, water: 0, oxygen: 0, food: 0, research: 0, materials: 0 }, t.eco || {});
      const raw = t.build;
      t.build = (r, o) => {
        if (!o || !o.t) return trim(raw(r, o));
        // Animé : même cadre qu'à t = 0, calculé avec la même suite de tirages.
        const ref = raw(r.clone(), Object.assign({}, o, { t: 0 }));
        return trim(raw(r, o), bbox(ref));
      };
      B[t.key] = t.build;
      TYPE_BY_KEY[t.key] = t;
      // La colonie reste en dernier dans la liste.
      const col = TYPES.findIndex((x) => x.key === 'colonie');
      if (col >= 0) TYPES.splice(col, 0, t); else TYPES.push(t);
    }
  }
  register([
    { key: 'dome', cat: 'habitat', name: 'Dôme d’habitat', desc: 'Coque géodésique posée sur un anneau, sas d’entrée et hublots.', eco: { pop: 10, power: -2 }, build: B.dome },
    { key: 'habitat', cat: 'habitat', name: 'Quartier résidentiel', desc: 'Une grappe de petits dômes reliés par des couloirs.', eco: { pop: 16, power: -3 }, build: B.habitat },
    { key: 'module', cat: 'habitat', name: 'Modules d’habitation', desc: 'Cylindres couchés sur pieds, reliés bout à bout.', eco: { pop: 6, power: -1 }, build: B.module },
    { key: 'serre', cat: 'vie', name: 'Serre', desc: 'Dôme de verre et ses cultures : la nourriture de la colonie.', eco: { jobs: 3, power: -2, water: -2, food: 12, oxygen: 2 }, build: B.serre },
    { key: 'reservoir', cat: 'vie', name: 'Réservoirs', desc: 'Cuves cerclées pour l’eau, l’oxygène et le carburant.', role: 'storage', eco: {}, build: B.reservoir },
    { key: 'solaire', cat: 'energie', name: 'Champ solaire', desc: 'Rangées de panneaux inclinés vers l’étoile.', eco: { power: 6 }, build: B.solaire },
    { key: 'eolienne', anim: true, cat: 'energie', name: 'Éolienne', desc: 'Mât et trois pales dans le vent fin de la planète.', eco: { power: 3 }, build: B.eolienne },
    { key: 'reacteur', anim: true, cat: 'energie', name: 'Réacteur', desc: 'Tour de refroidissement en sablier et cœur du réacteur.', eco: { jobs: 4, power: 30, water: -2 }, build: B.reacteur },
    { key: 'forage', anim: true, cat: 'industrie', name: 'Forage', desc: 'Derrick en treillis, tige de forage et réservoirs.', role: 'ore', eco: { jobs: 3, power: -3, materials: 6 }, build: B.forage },
    { key: 'usine', anim: true, cat: 'industrie', name: 'Raffinerie', desc: 'Halls, toits solaires, cheminées et conduites.', eco: { jobs: 5, power: -5, materials: 8 }, build: B.usine },
    { key: 'piste', anim: true, cat: 'logistique', name: 'Aire de lancement', desc: 'Piste circulaire balisée, parfois avec sa fusée.', role: 'spaceport', eco: { jobs: 2, power: -1, materials: 2 }, build: B.piste },
    { key: 'fusee', anim: true, cat: 'logistique', name: 'Fusée', desc: 'Lanceur dressé sur ses ailerons, prêt au départ.', role: 'vehicle', eco: {}, build: B.fusee },
    { key: 'hangar', cat: 'logistique', name: 'Hangar', desc: 'Voûte nervurée et grande porte pour les engins.', eco: { jobs: 2, power: -1 }, build: B.hangar },
    { key: 'rover', cat: 'logistique', name: 'Rover', desc: 'Engin à six roues, cabine vitrée et panneau solaire.', role: 'vehicle', eco: {}, build: B.rover },
    { key: 'tour', anim: true, cat: 'services', name: 'Tour de contrôle', desc: 'Fût élancé et salle vitrée qui surveille la colonie.', role: 'hq', eco: { jobs: 3, power: -1 }, build: B.tour },
    { key: 'labo', cat: 'science', name: 'Laboratoire', desc: 'Bloc de recherche, coupole d’observation et capteurs.', eco: { jobs: 4, power: -3, research: 6 }, build: B.labo },
    { key: 'antenne', anim: true, cat: 'science', name: 'Antenne parabolique', desc: 'Parabole tournée vers le ciel pour parler aux autres mondes.', role: 'comms', eco: { jobs: 1, power: -1, research: 1 }, build: B.antenne }
  ]);
  TYPES.push({ key: 'colonie', cat: 'colonie', name: 'Colonie', desc: 'Une colonie autonome planifiée : logements, support vital, énergie, industrie et réseaux.', eco: {} });
  TYPE_BY_KEY.colonie = TYPES[TYPES.length - 1];
  const THEMES = ['mars', 'lune', 'glace', 'soufre', 'volcan'];
  const RES = ['power', 'water', 'oxygen', 'food'];

  // ─── Planification d'une colonie ────────────────────────────
  // Bilan : production des bâtiments moins la consommation des colons.
  function balance(keys) {
    const b = { pop: 0, jobs: 0, power: 0, water: 0, oxygen: 0, food: 0, research: 0, materials: 0 };
    for (const k of keys) { const e = TYPE_BY_KEY[k].eco; for (const f in b) b[f] += e[f] || 0; }
    b.residents = b.pop;
    b.water -= b.pop; b.oxygen -= b.pop; b.food -= b.pop;
    return b;
  }
  const byCat = (cat, f) => TYPES.filter((t) => t.cat === cat && t.build && (!f || f(t)));
  // Choix : on évite de répéter le même bâtiment tant qu'il y a d'autres options.
  function choose(r, list, used) {
    if (!list.length) return null;
    const min = Math.min(...list.map((t) => used[t.key] || 0));
    const fresh = list.filter((t) => (used[t.key] || 0) === min);
    return r.pick(fresh);
  }

  // Emprise d'un bâtiment (avec ses abords), mesurée une fois par type.
  const footCache = {};
  function footprint(key) {
    if (footCache[key] == null) { const b = TYPE_BY_KEY[key].build(makeRng('emprise:' + key), { t: 0 }); footCache[key] = (b.X + 3) * (b.Y + 3); }
    return footCache[key];
  }

  // Plan d'une colonie : on dispose d'un budget de terrain ; l'essentiel d'abord (commandement, port,
  // communications), puis les logements, puis tout ce qui manque pour les faire vivre.
  function plan(r, S, place, lvl) {
    lvl = lvl == null ? 1 : lvl;
    const budget = S * S * (place ? 3 : 0.9);
    const keys = [], used = {};
    let area = 0;
    const add = (t) => {
      if (!t) return false;
      const fp = footprint(t.key);
      if (area + fp > budget) return false;
      if (place && !place(t.key)) { used[t.key] = (used[t.key] || 0) + 1; return false; }
      keys.push(t.key); used[t.key] = (used[t.key] || 0) + 1; area += fp;
      return true;
    };
    const pick = (list) => choose(r, list.filter((t) => area + footprint(t.key) <= budget), used);
    const target = Math.max(10, Math.round(S * S / 260 * lvl));
    add(TYPES.find((t) => t.role === 'hq'));
    add(pick(TYPES.filter((t) => t.role === 'spaceport' && t.build)));
    add(pick(TYPES.filter((t) => t.role === 'comms' && t.build)));
    // Comble les déficits d'oxygène, d'eau, de nourriture et d'énergie, avec ce qui tient encore.
    const supply = () => {
      const stuck = new Set();
      for (let guard = 0; guard < 60; guard++) {
        const b = balance(keys);
        const short = ['power', 'oxygen', 'water', 'food'].find((f) => b[f] < 0 && !stuck.has(f));
        if (!short) return;
        const prod = TYPES.filter((t) => t.build && t.eco[short] > 0 && (short !== 'power' || t.cat === 'energie') && (used[t.key] || 0) < 4 && area + footprint(t.key) <= budget);
        if (!prod.length) { stuck.add(short); continue; }
        // Les plus rentables pour leur taille d'abord : on garde les trois meilleurs, puis on varie.
        const eff = (t) => t.eco[short] / footprint(t.key);
        prod.sort((x, y) => eff(y) - eff(x));
        const need = -b[short];
        const fit = prod.filter((t) => t.eco[short] <= need * 2 + 8);
        if (!add(choose(r, (fit.length ? fit : prod).slice(0, 3), used))) stuck.add(short);
      }
    };
    // Logements par étapes, en assurant la survie à chaque étape.
    while (balance(keys).pop < target) {
      if (!add(pick(byCat('habitat', (t) => t.eco.pop > 0)))) break;
      supply();
    }
    const pop = () => balance(keys).pop;
    // Services : un exemplaire par tranche complète d'habitants.
    for (const t of byCat('services', (x) => x.per)) for (let n = Math.floor(pop() / t.per); (used[t.key] || 0) < n;) if (!add(t)) break;
    supply();
    add(pick(byCat('industrie', (t) => t.eco.materials > 0)));
    if (lvl >= 0.6) add(pick(byCat('science', (t) => t.eco.research > 0)));
    if (lvl >= 0.8) add(pick(byCat('defense')));
    if (S >= 112 && lvl >= 0.9) { add(pick(byCat('industrie', (t) => t.eco.materials > 0))); add(pick(byCat('science', (t) => t.eco.research > 0))); add(pick(byCat('logistique', (t) => !t.role))); }
    if (S >= 144 && lvl >= 0.9) { add(pick(byCat('defense'))); add(pick(byCat('industrie', (t) => t.eco.materials > 0))); }
    supply();
    // Trop d'emplois pour les habitants : quelques logements de plus.
    for (let i = 0; i < 6 && balance(keys).jobs > balance(keys).pop; i++) { if (!add(pick(byCat('habitat', (t) => t.eco.pop > 0)))) break; supply(); }
    const stores = TYPES.filter((t) => t.role === 'storage' && t.build);
    for (let i = 0; i < Math.min(3, Math.ceil(keys.length / 10)); i++) add(pick(stores));
    for (let i = 0; i < 3; i++) add(pick(TYPES.filter((t) => t.role === 'vehicle' && t.key !== 'fusee' && t.build)));
    return keys;
  }

  // Zones : où chaque catégorie s'installe (fractions de la dalle).
  const ZONES = {
    services: [0.5, 0.48], habitat: [0.48, 0.5], vie: [0.34, 0.66], science: [0.8, 0.2],
    energie: [0.84, 0.6], industrie: [0.16, 0.3], logistique: [0.52, 0.88], defense: [0.12, 0.86]
  };
  // Ordre de pose : la survie d'abord (énergie, support vital), puis le reste.
  const ORDER = ['services', 'habitat', 'energie', 'vie', 'industrie', 'science', 'logistique', 'defense'];

  // Colonie : planification, placement par zones, gisements, puis réseaux (routes, tubes, électricité, conduites).
  function colonyBase(seed, S, lvl) {
    const r = makeRng('colonie:' + seed);
    const m = model(S, S, 48);
    r.seedA = r.range(0, 10); r.seedB = r.range(0, 10);
    const g = slab(m, r, { height: 3 });
    const taken = new Uint8Array(S * S);
    const free = (x0, y0, w, d, pad) => {
      if (x0 < 2 || y0 < 2 || x0 + w >= S - 2 || y0 + d >= S - 2) return false;
      for (let y = y0 - pad; y < y0 + d + pad; y++) for (let x = x0 - pad; x < x0 + w + pad; x++) if (taken[y * S + x]) return false;
      return true;
    };
    const placed = [], anim = [];
    // Pose un bâtiment près de l'ancre de sa zone ; renvoie false s'il n'y a plus la place.
    const placeOne = (key) => {
      const t = TYPE_BY_KEY[key];
      const it = { key, seed: r.int(0, 1e9), cat: t.cat };
      const b = t.build(makeRng(it.seed), { t: 0 });
      if (b.X > S - 6 || b.Y > S - 6) return false;
      const z = ZONES[it.cat] || [0.5, 0.5];
      const ax = z[0] * S + r.range(-3, 3), ay = z[1] * S + r.range(-3, 3);
      const pad = t.role === 'vehicle' ? 1 : 2;
      let best = null;
      // Spirale autour du point d'ancrage de la zone : la place libre la plus proche (abords serrés en dernier recours).
      for (const pd of [pad, 1]) {
        for (let rad = 0; rad < S && !best; rad += 2) {
          for (let k = 0; k < Math.max(1, rad * 2); k++) {
            const a = k / Math.max(1, rad * 2) * 6.283 + r.next() * 0.3;
            const x0 = Math.round(ax + Math.cos(a) * rad - b.X / 2), y0 = Math.round(ay + Math.sin(a) * rad - b.Y / 2);
            if (free(x0, y0, b.X, b.Y, pd)) { best = [x0, y0]; break; }
          }
        }
        if (best) break;
      }
      if (!best) return false;
      const [x0, y0] = best;
      for (let y = y0; y < y0 + b.Y; y++) for (let x = x0; x < x0 + b.X; x++) {
        taken[y * S + x] = 1;
        for (let zz = g; zz < m.Z; zz++) m.set(x, y, zz, 0);
        m.set(x, y, g - 1, MAT.GROUND);
      }
      // Gisements : glace sous les extracteurs d'eau, minerai sous les mines et forages.
      if (t.role === 'ice' || t.role === 'ore') {
        for (let y = y0 - 3; y < y0 + b.Y + 3; y++) for (let x = x0 - 3; x < x0 + b.X + 3; x++) {
          if (!taken[y * S + x] && m.inside(x, y, g - 1) && r.chance(0.55)) m.set(x, y, g - 1, t.role === 'ice' ? MAT.ICE : MAT.ROCK);
        }
      }
      m.blit(b, x0, y0, g);
      const p = { key: it.key, cat: it.cat, role: t.role, x0, y0, X: b.X, Y: b.Y, Z: b.Z, cx: x0 + b.X / 2, cy: y0 + b.Y / 2, seed: it.seed };
      placed.push(p);
      anim.push(p);
      return true;
    };
    plan(r, S, placeOne, lvl);
    networks(m, r, g, placed, taken, S);
    const keysPlaced = placed.map((p) => p.key);
    const bal = balance(keysPlaced);
    const counts = {};
    for (const p of placed) counts[p.cat] = (counts[p.cat] || 0) + 1;
    return { m, g, anim, stats: { buildings: placed.length, counts, balance: bal, list: keysPlaced } };
  }

  // Réseaux de la colonie.
  function networks(m, r, g, placed, taken, S) {
    const hq = placed.find((p) => p.role === 'hq') || placed[0];
    if (!hq) return;
    const isFree = (x, y) => x >= 1 && y >= 1 && x < S - 1 && y < S - 1 && !taken[y * S + x];
    // Chemin en L entre deux points, en contournant ce qui est construit (on saute les cases prises).
    const path = (a, b, fn) => {
      let x = Math.round(a[0]), y = Math.round(a[1]);
      const tx = Math.round(b[0]), ty = Math.round(b[1]);
      const horizFirst = r.chance(0.5);
      for (let guard = 0; guard < S * 3 && (x !== tx || y !== ty); guard++) {
        if ((horizFirst && x !== tx) || y === ty) x += Math.sign(tx - x); else y += Math.sign(ty - y);
        if (isFree(x, y)) fn(x, y);
      }
    };
    const edgeOf = (p, q) => [Math.max(p.x0 - 1, Math.min(p.x0 + p.X, q.cx)), Math.max(p.y0 - 1, Math.min(p.y0 + p.Y, q.cy))];
    // Routes de régolithe tassé : du port spatial et de l'industrie vers la tour de contrôle.
    for (const p of placed) {
      if (p === hq || !(p.cat === 'logistique' || p.cat === 'industrie' || p.cat === 'defense')) continue;
      path(edgeOf(p, hq), edgeOf(hq, p), (x, y) => { for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) if (isFree(x + dx, y + dy)) { m.set(x + dx, y + dy, g - 1, MAT.STRATA); if (m.get(x + dx, y + dy, g)) m.set(x + dx, y + dy, g, 0); } });
    }
    // Tubes pressurisés : arbre couvrant entre habitats, services et support vital.
    const core = placed.filter((p) => p.cat === 'habitat' || p.cat === 'services' || (p.cat === 'vie' && p.role !== 'storage'));
    const linked = [core[0]].filter(Boolean);
    while (linked.length < core.length) {
      let best = null;
      for (const a of linked) for (const b of core) if (!linked.includes(b)) {
        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
        if (!best || d < best.d) best = { a, b, d };
      }
      if (!best || best.d > S * 0.6) break;
      linked.push(best.b);
      path(edgeOf(best.a, best.b), edgeOf(best.b, best.a), (x, y) => { m.set(x, y, g, MAT.HULL2); m.set(x, y, g + 1, (x + y) % 6 === 0 ? MAT.WINDOW : MAT.HULL2); });
    }
    // Lignes électriques : pylônes et câble des producteurs d'énergie vers la tour.
    for (const p of placed.filter((q) => q.cat === 'energie')) {
      const pts = [];
      path(edgeOf(p, hq), edgeOf(hq, p), (x, y) => pts.push([x, y]));
      let last = null;
      for (let i = 0; i < pts.length; i += 6) {
        const [x, y] = pts[i];
        if (!isFree(x, y)) continue;
        m.box(x, y, g, x, y, g + 5, MAT.METAL);
        m.set(x - 1, y, g + 5, MAT.METAL); m.set(x + 1, y, g + 5, MAT.METAL);
        if (last) m.line(last[0], last[1], g + 5, x, y, g + 5, MAT.DARK);
        last = [x, y];
      }
    }
    // Conduites d'eau et d'oxygène, au ras du sol, vers les réservoirs (ou la tour).
    const stores = placed.filter((p) => p.role === 'storage');
    for (const p of placed.filter((q) => q.cat === 'vie' && q.role !== 'storage')) {
      const to = stores.length ? stores.reduce((a, b) => (Math.hypot(a.cx - p.cx, a.cy - p.cy) < Math.hypot(b.cx - p.cx, b.cy - p.cy) ? a : b)) : hq;
      path(edgeOf(p, to), edgeOf(to, p), (x, y) => { if (!m.get(x, y, g)) m.set(x, y, g, MAT.COPPER); });
    }
  }

  const colonyCache = new Map();
  // Image t d'une colonie : la base est calculée une fois, seuls les bâtiments animés sont redessinés.
  function colony(seed, S, t) {
    const key = seed + ':' + S;
    let base = colonyCache.get(key);
    if (!base) {
      if (colonyCache.size > 6) colonyCache.clear();
      // Du plan le plus ambitieux au plus modeste : on garde le premier où tout le monde vit
      // (énergie, eau, oxygène, nourriture à l'équilibre, assez de bras), sinon le moins déficitaire.
      const deficit = (c) => { const b = c.stats.balance; return RES.reduce((d, f) => d + Math.max(0, -b[f]), 0) + Math.max(0, b.jobs - b.pop - 4); };
      let bestDef = Infinity;
      for (const lvl of [1, 0.85, 0.7, 0.55, 0.4]) {
        const c = colonyBase(seed, S, lvl), d = deficit(c);
        if (d < bestDef) { base = c; bestDef = d; }
        if (d === 0) break;
      }
      colonyCache.set(key, base);
    }
    if (!t) return base;
    const m = model(S, S, base.m.Z);
    m.v.set(base.m.v);
    for (const p of base.anim) {
      const b = TYPE_BY_KEY[p.key].build(makeRng(p.seed), { t });
      for (let z = base.g; z < base.g + p.Z; z++) for (let y = p.y0; y < p.y0 + p.Y; y++) for (let x = p.x0; x < p.x0 + p.X; x++) m.set(x, y, z, 0);
      m.blit(b, p.x0, p.y0, base.g);
    }
    return { m, g: base.g, anim: base.anim, stats: base.stats };
  }

  const PREFIX = ['Ares', 'Hélios', 'Tharsis', 'Olympus', 'Kepler', 'Arecibo', 'Vesta', 'Nova', 'Elysium', 'Hellas', 'Utopia', 'Cydonia', 'Gale', 'Jezero'];

  // generate(type, seed, { t, theme, size }) → { key, name, desc, cat, eco, seed, theme, model, stats }
  function generate(type, seed, opts) {
    opts = opts || {};
    const key = TYPE_BY_KEY[type] ? type : 'dome';
    const t = TYPE_BY_KEY[key];
    let mod, extra = {};
    if (key === 'colonie') {
      const c = colony(String(seed), opts.size || 112, opts.t || 0);
      mod = c.m; extra = { colony: c.stats };
    } else mod = t.build(makeRng(key + ':' + seed), { t: opts.t || 0 });
    const rn = makeRng('nom:' + seed);
    const name = `${t.name} ${rn.pick(PREFIX)}-${rn.int(1, 99)}`;
    const theme = opts.theme || THEMES[makeRng('theme:' + seed).int(0, THEMES.length - 1)];
    return { key, name, desc: t.desc, cat: t.cat, eco: t.eco, seed: String(seed), theme, model: mod, stats: Object.assign({ voxels: mod.count(), size: [mod.X, mod.Y, mod.Z] }, extra) };
  }

  return { trim, MAT, EMISSIVE, BLINK, ALPHA, CATS, TYPES, TYPE_BY_KEY, THEMES, RES, makeRng, hashString, model, slab, generate, register, balance, plan, puffs, geoFrame, builders: B };
});
