/* ORBITE — exploration de la planète autour de la colonie (pur, testable sous Node).
 * Le monde est infini et se génère par tronçons de 32 × 32 cases à partir de la graine de la
 * colonie : relief (collines, montagnes, mesas, canyons, cratères), strates, glace, minerai, et des
 * découvertes à ramasser avec le rover explorateur. La colonie occupe les cases 0 à 127. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./building-engine.js'));
  else root.OrbiteExploration = factory(root.OrbiteBuildings);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const M = E.MAT;
  const CHUNK = 32;
  const ZMAX = 28;
  const BASE = { x0: 0, y0: 0, size: 128, h: 3 };
  // Batterie : une case parcourue coûte 1 / 3 de point ; 100 points ≈ 300 cases.
  const BATTERY = { max: 100, perTile: 1 / 3 };
  const SPEED = 4.5; // cases par seconde

  // ─── Bruit ──────────────────────────────────────────────────
  const hash = (seed, x, y) => {
    let h = Math.imul((seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0, 1274126177);
    h ^= h >>> 13; h = Math.imul(h, 1103515245); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  function vnoise(seed, x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(seed, x0, y0), b = hash(seed, x0 + 1, y0), c = hash(seed, x0, y0 + 1), d = hash(seed, x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  const fbm = (seed, x, y, oct) => { let v = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { v += amp * vnoise(seed + i * 101, x * f, y * f); n += amp; amp *= 0.5; f *= 2; } return v / n; };

  // ─── Relief ─────────────────────────────────────────────────
  // Hauteur du sol (nombre de voxels pleins) en (x, y) monde. La base est plate ; le relief monte
  // doucement autour d'elle pour que le rover puisse en sortir.
  const inBase = (x, y) => x >= BASE.x0 && y >= BASE.y0 && x < BASE.x0 + BASE.size && y < BASE.y0 + BASE.size;
  function biome(seed, x, y) {
    const m = vnoise(seed + 7, x / 90, y / 90), t = vnoise(seed + 9, x / 70, y / 70);
    return m > 0.68 ? 'montagnes' : t > 0.64 ? 'mesas' : t < 0.3 ? 'dunes' : 'plaines';
  }
  function crater(seed, x, y) {
    // Un cratère au plus par cellule de 40 cases.
    const cx = Math.floor(x / 40), cy = Math.floor(y / 40);
    let dh = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      if (hash(seed + 31, gx, gy) > 0.45) continue;
      const px = gx * 40 + 6 + hash(seed + 33, gx, gy) * 28, py = gy * 40 + 6 + hash(seed + 35, gx, gy) * 28, r = 4 + hash(seed + 37, gx, gy) * 7;
      const d = Math.hypot(x - px, y - py) / r;
      if (d < 1) dh += -4 * (1 - d * d) + 1.5;
      else if (d < 1.4) dh += 2.2 * (1 - (d - 1) / 0.4);
    }
    return dh;
  }
  function rawHeight(seed, x, y) {
    const b = biome(seed, x, y);
    let h = 4 + 6 * fbm(seed, x / 48, y / 48, 3) + 2.5 * vnoise(seed + 3, x / 9, y / 9);
    const ridge = 1 - Math.abs(2 * fbm(seed + 5, x / 34, y / 34, 2) - 1);
    const mount = Math.max(0, Math.min(1, (vnoise(seed + 7, x / 90, y / 90) - 0.6) / 0.15));
    h += mount * 16 * Math.pow(ridge, 2.2);
    if (b === 'mesas') h = 4 + Math.floor((h + 2 * vnoise(seed + 11, x / 20, y / 20)) / 3.2) * 3.2;
    if (b === 'dunes') h = 3 + 2.5 * Math.sin((x + y * 0.4) / 3.5 + 3 * vnoise(seed + 13, x / 25, y / 25)) * 0.5 + 2;
    // Canyons : une rivière à sec qui serpente.
    const c = Math.abs(fbm(seed + 17, x / 60, y / 60, 2) - 0.5);
    if (c < 0.035) h -= 6 * (1 - c / 0.035);
    h += crater(seed, x, y);
    return h;
  }
  function height(world, x, y) {
    const key = x + ',' + y;
    const cache = world.hcache;
    if (cache.has(key)) return cache.get(key);
    let h;
    if (inBase(x, y)) h = BASE.h;
    else {
      // Transition douce sur 12 cases autour de la base.
      const dx = Math.max(BASE.x0 - x, 0, x - (BASE.x0 + BASE.size - 1)), dy = Math.max(BASE.y0 - y, 0, y - (BASE.y0 + BASE.size - 1));
      const k = Math.min(1, Math.hypot(dx, dy) / 12);
      h = BASE.h + (rawHeight(world.seed, x, y) - BASE.h) * k;
    }
    h = Math.max(1, Math.min(ZMAX - 4, Math.round(h)));
    if (cache.size > 200000) cache.clear();
    cache.set(key, h);
    return h;
  }

  // ─── Découvertes ────────────────────────────────────────────
  const POI_TYPES = [
    { key: 'meteorite', name: 'Météorite', text: 'Un bloc de fer tombé du ciel.', w: 5, gain: { materials: 70 } },
    { key: 'sonde', name: 'Sonde abandonnée', text: 'Une vieille sonde et ses données.', w: 4, gain: { research: 35 } },
    { key: 'geode', name: 'Géode de cristal', text: 'Des cristaux qui brillent dans la roche.', w: 3, gain: { dust: 15 } },
    { key: 'glace', name: 'Poche de glace', text: 'Une poche de glace pure sous la croûte.', w: 4, gain: { water: 60 } },
    { key: 'epave', name: 'Épave de rover', text: 'Des pièces récupérables.', w: 4, gain: { materials: 45 } },
    { key: 'ruines', name: 'Ruines anciennes', text: 'Des piliers gravés par une autre civilisation.', w: 1, gain: { research: 90, dust: 25 } }
  ];
  const POI_W = POI_TYPES.reduce((n, t) => n + t.w, 0);
  // Au plus une découverte par tronçon (une chance sur trois), jamais dans la base.
  function poi(world, cx, cy) {
    const k = cx + ',' + cy;
    if (world.pcache.has(k)) return world.pcache.get(k);
    let p = null;
    const r = E.makeRng('decouverte:' + world.seed + ':' + k);
    if (r.chance(0.34)) {
      const x = cx * CHUNK + r.int(5, CHUNK - 6), y = cy * CHUNK + r.int(5, CHUNK - 6);
      if (!inBase(x, y) && Math.abs(height(world, x + 1, y) - height(world, x - 1, y)) <= 3) {
        let w = r.range(0, POI_W), t = POI_TYPES[0];
        for (const q of POI_TYPES) { if (w < q.w) { t = q; break; } w -= q.w; }
        p = { id: k, x, y, type: t.key };
      }
    }
    world.pcache.set(k, p);
    return p;
  }
  const POI = Object.fromEntries(POI_TYPES.map((t) => [t.key, t]));

  // ─── Tronçon en voxels ──────────────────────────────────────
  // found : ensemble des découvertes déjà ramassées (on y plante un fanion).
  function chunk(world, cx, cy, found) {
    const m = E.model(CHUNK, CHUNK, ZMAX);
    const X0 = cx * CHUNK, Y0 = cy * CHUNK, seed = world.seed;
    for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
      const wx = X0 + x, wy = Y0 + y, h = height(world, wx, wy);
      if (inBase(wx, wy)) {
        for (let z = 0; z < h; z++) m.set(x, y, z, z === h - 1 ? M.GROUND : M.STRATA);
        // Dalle de la colonie autour du centre et sa tour, repère visible de loin.
        const dc = Math.max(Math.abs(wx - 63.5), Math.abs(wy - 63.5));
        if (dc < 14) m.set(x, y, h - 1, M.PAD);
        if (dc < 2) for (let z = h; z < h + 16; z++) m.set(x, y, z, z % 5 === 0 ? M.ACCENT : M.HULL);
        if (Math.abs(wx - 63.5) < 1 && Math.abs(wy - 63.5) < 1) m.set(x, y, h + 16, M.BEACON);
        continue;
      }
      const b = biome(seed, wx, wy);
      const steep = Math.max(Math.abs(height(world, wx + 1, wy) - h), Math.abs(height(world, wx, wy + 1) - h), Math.abs(height(world, wx - 1, wy) - h), Math.abs(height(world, wx, wy - 1) - h));
      const ice = vnoise(seed + 41, wx / 14, wy / 14) > 0.84 && h <= 6;
      const ore = vnoise(seed + 43, wx / 12, wy / 12) > 0.8;
      for (let z = 0; z < h; z++) {
        let k;
        if (z < h - 2) k = (z + Math.floor(vnoise(seed + 45, wx / 30, wy / 30) * 3)) % 3 === 0 ? M.ROCK : M.STRATA;
        else if (z === h - 1) k = h >= 20 + 3 * vnoise(seed + 51, wx / 8, wy / 8) ? M.ICE : ice ? M.ICE : ore ? M.ROCK : steep >= 3 ? M.ROCK : b === 'dunes' || h <= 3 ? M.SAND : M.GROUND;
        else k = steep >= 2 ? M.STRATA : M.GROUND;
        m.set(x, y, z, k);
      }
      // Cailloux épars.
      if (hash(seed + 47, wx, wy) < 0.012 && steep < 2) m.set(x, y, h, hash(seed + 49, wx, wy) < 0.5 ? M.ROCK : M.SAND);
    }
    const p = poi(world, cx, cy);
    if (p) drawPoi(m, p, p.x - X0, p.y - Y0, height(world, p.x, p.y), found && found.has(p.id));
    return m;
  }
  function drawPoi(m, p, x, y, h, taken) {
    const z = h;
    if (taken) {
      // Fanion planté : la découverte a été ramassée.
      for (let k = 0; k < 4; k++) m.set(x, y, z + k, M.METAL);
      m.set(x + 1, y, z + 3, M.ACCENT); m.set(x + 1, y, z + 2, M.ACCENT); m.set(x + 2, y, z + 3, M.ACCENT);
      return;
    }
    if (p.type === 'meteorite') {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) < 2.6) m.set(x + dx, y + dy, z - 1, M.SAND);
      for (let dz = 0; dz < 3; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.hypot(dx, dy, dz - 1) < 1.6) m.set(x + dx, y + dy, z + dz, dz === 2 ? M.COPPER : M.METAL);
      m.set(x, y, z + 2, M.LAVA);
    } else if (p.type === 'sonde') {
      m.box(x - 1, y - 1, z, x + 1, y + 1, z + 1, M.HULL);
      m.box(x + 2, y - 1, z + 1, x + 4, y + 1, z + 1, M.SOLAR);
      m.box(x - 4, y - 1, z + 1, x - 2, y + 1, z + 1, M.SOLAR);
      m.set(x, y, z + 2, M.METAL); m.set(x, y, z + 3, M.BEACON);
    } else if (p.type === 'geode') {
      for (const [dx, dy, hh] of [[0, 0, 5], [1, 0, 3], [-1, 1, 4], [0, -1, 3], [1, 1, 2], [-1, -1, 2]]) for (let k = 0; k < hh; k++) m.set(x + dx, y + dy, z + k, k === hh - 1 ? M.LIGHT : M.GLASS);
    } else if (p.type === 'glace') {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dy) < 2.7) { m.set(x + dx, y + dy, z - 1, M.ICE); if (Math.hypot(dx, dy) < 1.5) m.set(x + dx, y + dy, z, M.ICE); }
      m.set(x, y, z + 1, M.LIGHT);
    } else if (p.type === 'epave') {
      m.box(x - 2, y - 1, z, x + 1, y + 1, z, M.DARK);
      m.box(x - 1, y - 1, z + 1, x + 1, y, z + 1, M.STRIPE);
      m.set(x + 2, y + 1, z, M.METAL); m.set(x - 2, y + 1, z + 1, M.HULL2);
    } else if (p.type === 'ruines') {
      for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) for (let k = 0; k < 6; k++) m.set(x + dx, y + dy, z + k, k % 2 ? M.DARK : M.METAL);
      m.box(x - 2, y - 2, z + 6, x + 2, y - 2, z + 6, M.DARK);
      m.box(x - 1, y - 1, z, x + 1, y + 1, z, M.DARK);
      m.set(x, y, z + 1, M.LIGHT);
      for (const [dx, dy] of [[-2, -2], [2, 2]]) m.set(x + dx, y + dy, z + 3, M.LIGHT);
    }
  }

  // ─── Expédition ─────────────────────────────────────────────
  function world(seed) { return { seed: seed >>> 0, hcache: new Map(), pcache: new Map() }; }
  // Sortie de la base : bord est, au niveau du centre.
  const START = { x: BASE.size + 2, y: 64 };
  // Chemin entre deux cases : le rover monte ou descend 2 voxels au plus par case.
  function path(w, a, b, limit) {
    const max = limit || 9000;
    const key = (x, y) => x + ',' + y;
    const open = [[0, a[0], a[1]]], g = new Map([[key(a[0], a[1]), 0]]), from = new Map();
    let best = a, bestD = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), n = 0;
    while (open.length && n++ < max) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, x, y] = open[bi];
      open[bi] = open[open.length - 1]; open.pop();
      const d = Math.abs(x - b[0]) + Math.abs(y - b[1]);
      if (d < bestD) { bestD = d; best = [x, y]; }
      if (d === 0) break;
      const hx = height(w, x, y), gx = g.get(key(x, y));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, hn = height(w, nx, ny);
        if (Math.abs(hn - hx) > 2) continue;
        const ng = gx + 1 + Math.abs(hn - hx) * 0.5, k = key(nx, ny);
        if (g.has(k) && g.get(k) <= ng) continue;
        g.set(k, ng); from.set(k, [x, y]);
        open.push([ng + Math.abs(nx - b[0]) + Math.abs(ny - b[1]), nx, ny]);
      }
    }
    const out = [];
    for (let p = best; p; p = from.get(key(p[0], p[1]))) out.push(p);
    out.reverse();
    return { pts: out, reached: bestD === 0 };
  }
  // Ramasser une découverte : gains pour la colonie (matériaux, eau, recherche) et poussières.
  function collect(col, p) {
    const t = POI[p.type];
    col.explore = col.explore || { found: [], seen: [], trips: 0 };
    if (col.explore.found.includes(p.id)) return null;
    col.explore.found.push(p.id);
    const g = t.gain;
    if (g.materials) col.stock.materials += g.materials;
    if (g.water) col.stock.water += g.water;
    if (g.research) col.stock.research += g.research;
    return { type: t, gain: g };
  }

  return { CHUNK, ZMAX, BASE, BATTERY, SPEED, START, POI, POI_TYPES, world, height, biome, poi, chunk, path, collect, inBase };
});
