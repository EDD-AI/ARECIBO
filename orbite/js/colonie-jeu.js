/* ORBITE — la colonie d'une planète forgée : règles et simulation (pures, testables sous Node).
 * Le temps passe en sols (1 sol = 1 minute réelle), même appli fermée : on rattrape au retour.
 * Les bâtiments produisent s'ils ont des ouvriers et de l'énergie ; les colons arrivent s'il y a des
 * logements et des réserves, et repartent en cas de pénurie. La recherche débloque des paliers. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const E = require('./building-engine.js');
    for (const f of ['habitat', 'vie-energie', 'industrie-logistique', 'science-defense']) require('./batiments/' + f + '.js');
    module.exports = factory(E);
  }
  else root.OrbiteColonie = factory(root.OrbiteBuildings);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const SOL_MS = 60000;
  const MAX_CATCHUP = 60 * 24 * 3;
  const SIZE = 128;
  const BASE_CAP = 120;
  const STORE_CAP = 250;
  const LIFE = ['water', 'oxygen', 'food'];
  // Récupération par les rovers de la tour (par sol) ; navette de ravitaillement (matériaux, prix).
  const SALVAGE = 1;
  // Zone constructible : demi-côté autour du centre, agrandie par paliers (64 × 64 → 128 × 128).
  const ZONES = [32, 40, 48, 56, 64];
  const ZONE_COST = [null, { materials: 150, dust: 0 }, { materials: 250, dust: 30 }, { materials: 350, dust: 60 }, { materials: 500, dust: 120 }];
  // Rovers : vitesse en cases par seconde (temps réel), durée d'une tournée de récupération, pause au quai.
  const ROVER = { speed: 1.4, cycle: 40, wait: 3, max: 8 };
  const SUPPLY = { materials: 100, dust: 25 };
  // Verdure des pépinières : le front de la prairie avance d'une case toutes les 4 heures (240 sols)
  // jusqu'à 30 cases, soit 5 jours ; les arbres sortent 1 à 3 jours après l'herbe et mûrissent en 2 jours.
  const GREEN = { perTile: 240, radius: 30, sparse: 720, lush: 2160, treeDelay: 1440, treeSpread: 2880, treeStage: 1440 };

  // Paliers de recherche : ce qui est constructible dès le départ, puis à 40, 150 et 400 de recherche.
  const TIERS = [
    { research: 0, keys: ['tour', 'module', 'dome', 'capsules', 'solaire', 'eolienne', 'rtg', 'extracteur', 'condenseur', 'moxie', 'electrolyseur', 'serre', 'reservoir', 'batteries', 'labo', 'forage', 'piste', 'entrepot', 'rover'] },
    { research: 40, keys: ['habitat', 'immeuble', 'dortoir', 'bunker', 'ferme', 'champignonniere', 'recycleur', 'aquaculture', 'cantine', 'hopital', 'pepiniere', 'geothermie', 'methane', 'mine', 'briqueterie', 'concasseur', 'garage', 'carburant', 'antenne', 'meteo', 'relais', 'hangar', 'camion'] },
    { research: 150, keys: ['villas', 'ecole', 'parc', 'marche', 'heliostats', 'reacteur', 'usine', 'fonderie', 'chimie', 'imprimante', 'robotique', 'maglev', 'drone', 'observatoire', 'radar', 'biolabo', 'tourelle', 'blockhaus', 'enceinte'] },
    { research: 400, keys: ['arcologie', 'arene', 'fusion', 'spatioport', 'donnees', 'bouclier', 'fusee'] }
  ];
  const TIER_OF = {};
  TIERS.forEach((t, i) => t.keys.forEach((k) => { TIER_OF[k] = i; }));

  const hashTile = (seed, x, y) => {
    let h = Math.imul((seed ^ (x * 374761393) ^ (y * 668265263)) >>> 0, 1274126177);
    h ^= h >>> 13;
    return ((h >>> 0) % 10000) / 10000;
  };

  // Bruit lisse (valeurs aux nœuds d'une grille, interpolées) : des fronts de verdure irréguliers.
  function vnoise(seed, x, y, cell) {
    const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hashTile(seed, x0, y0), b = hashTile(seed, x0 + 1, y0), c = hashTile(seed, x0, y0 + 1), d = hashTile(seed, x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }

  // ─── Coût d'un bâtiment ─────────────────────────────────────
  // Matériaux selon son importance ; les paliers avancés demandent aussi des poussières d'étoiles.
  function price(key) {
    const t = E.TYPE_BY_KEY[key];
    if (!t) return { materials: 0, dust: 0 };
    const e = t.eco;
    const weight = Math.abs(e.power) + Math.abs(e.water) + Math.abs(e.oxygen) + Math.abs(e.food) + e.pop + e.research * 2 + e.materials * 2 + e.jobs;
    const tier = TIER_OF[key] || 0;
    const materials = Math.round((12 + weight * 1.4) * (1 + tier * 0.35) / 5) * 5;
    const dust = tier >= 3 ? 150 : tier === 2 ? 40 : 0;
    return { materials: key === 'tour' ? 0 : materials, dust };
  }

  // ─── Nouvelle colonie ───────────────────────────────────────
  // Le colonisateur pose 4 colons, des matériaux et des réserves ; la tour de contrôle vient en premier.
  function create(id, seed, theme, now) {
    return {
      v: 2, id: String(id), seed: seed >>> 0, theme: theme || 'mars', S: SIZE, zone: 0,
      sol: 0, last: now || 0, uid: 1,
      built: [],
      colonists: 4,
      stock: { water: 100, oxygen: 100, food: 100, materials: 400, research: 0 },
      events: [],
      storm: 0
    };
  }

  // Gisements de glace et de minerai : des taches fixes, tirées de la graine de la colonie.
  const depCache = new Map();
  function deposits(col) {
    const key = col.seed + ':' + col.S + ':' + (col.v || 1);
    if (depCache.has(key)) return depCache.get(key);
    const S = col.S, ice = new Uint8Array(S * S), ore = new Uint8Array(S * S);
    const r = E.makeRng('gisements:' + col.seed);
    // Depuis la v2, la première tache de glace et de minerai tombe dans la zone de départ.
    const near = (col.v || 1) >= 2 ? r.range(0, Math.PI * 2) : null;
    const blobs = (arr, n, turn) => {
      for (let i = 0; i < n; i++) {
        let cx, cy, rad;
        if (i === 0 && near != null) { const a = near + turn, d = r.range(19, 22); cx = S / 2 + Math.cos(a) * d; cy = S / 2 + Math.sin(a) * d; rad = r.range(7.5, 9); }
        else { cx = r.range(8, S - 8); cy = r.range(8, S - 8); rad = r.range(6, 12); }
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const d = Math.hypot(x - cx, y - cy) / rad;
          if (d < 1 - 0.35 * hashTile(col.seed + i, x, y)) arr[y * S + x] = 1;
        }
      }
    };
    blobs(ice, 6, 0);
    blobs(ore, 6, Math.PI * 0.9);
    // Le centre reste libre pour le commandement.
    for (let y = S / 2 - 12; y < S / 2 + 12; y++) for (let x = S / 2 - 12; x < S / 2 + 12; x++) { ice[y * S + x] = 0; ore[y * S + x] = 0; }
    const d = { ice, ore };
    depCache.set(key, d);
    return d;
  }

  // Emprise d'un bâtiment (taille réelle de son modèle), mise en cache par graine.
  const fpCache = new Map();
  function footprint(key, seed) {
    const k = key + ':' + seed;
    if (!fpCache.has(k)) { const b = E.TYPE_BY_KEY[key].build(E.makeRng(seed), { t: 0 }); fpCache.set(k, { X: b.X, Y: b.Y, Z: b.Z }); }
    return fpCache.get(k);
  }
  const buildSeed = (col, uid) => (col.seed * 31 + uid * 2654435761) >>> 0;

  const unlocked = (col, key) => (TIER_OF[key] != null) && col.stock.research >= TIERS[TIER_OF[key]].research;
  const hasHq = (col) => col.built.some((b) => b.key === 'tour');

  // ─── Zone de la colonie ─────────────────────────────────────
  // Palier de zone ; une colonie d'avant les zones reçoit le plus petit palier qui contient tout.
  function zoneIndex(col) {
    if (col.zone == null) {
      const c = col.S / 2;
      let need = 0;
      for (const b of col.built) {
        const f = footprint(b.key, b.seed);
        need = Math.max(need, c - b.x, c - b.y, b.x + f.X - c, b.y + f.Y - c);
      }
      const i = ZONES.findIndex((h) => h >= need + 1);
      col.zone = i < 0 ? ZONES.length - 1 : i;
    }
    return Math.max(0, Math.min(ZONES.length - 1, col.zone | 0));
  }
  const zoneHalf = (col) => Math.min(col.S / 2, ZONES[zoneIndex(col)]);
  // Bornes de la zone en cases : [x0, x1) × [y0, y1).
  function zoneBox(col) {
    const c = col.S / 2, h = zoneHalf(col);
    return { x0: Math.max(0, c - h), y0: Math.max(0, c - h), x1: Math.min(col.S, c + h), y1: Math.min(col.S, c + h), size: Math.min(col.S, h * 2) };
  }
  function nextZone(col) {
    const i = zoneIndex(col);
    if (i >= ZONES.length - 1) return null;
    return { size: Math.min(col.S, ZONES[i + 1] * 2), cost: ZONE_COST[i + 1] };
  }
  function expand(col, dust) {
    const n = nextZone(col);
    if (!n) return { ok: false, reason: 'La colonie occupe déjà tout le terrain.' };
    if (col.stock.materials < n.cost.materials) return { ok: false, reason: 'Pas assez de matériaux.' };
    if ((dust || 0) < n.cost.dust) return { ok: false, reason: 'Pas assez de poussières d’étoiles.' };
    col.stock.materials -= n.cost.materials;
    col.zone = zoneIndex(col) + 1;
    return { ok: true, size: n.size, dust: n.cost.dust };
  }
  // Masque des cases hors zone (1), pour assombrir le terrain au rendu.
  const maskCache = new Map();
  function zoneMask(col) {
    const z = zoneBox(col), key = col.S + ':' + z.x0 + ':' + z.x1;
    if (!maskCache.has(key)) {
      const m = new Uint8Array(col.S * col.S);
      for (let y = 0; y < col.S; y++) for (let x = 0; x < col.S; x++) m[y * col.S + x] = x < z.x0 || y < z.y0 || x >= z.x1 || y >= z.y1 ? 1 : 0;
      maskCache.set(key, m);
    }
    return maskCache.get(key);
  }

  // Peut-on poser ce bâtiment ici (coin x, y) ? Renvoie { ok, reason, fp }.
  function canPlace(col, key, x, y, dust) {
    const t = E.TYPE_BY_KEY[key];
    if (!t || !t.build || TIER_OF[key] == null) return { ok: false, reason: 'Bâtiment inconnu.' };
    if (!hasHq(col) && key !== 'tour') return { ok: false, reason: 'Posez d’abord la tour de contrôle.' };
    if (key === 'tour' && hasHq(col)) return { ok: false, reason: 'La colonie a déjà sa tour de contrôle.' };
    if (!unlocked(col, key)) return { ok: false, reason: 'Recherche insuffisante.' };
    const fp = footprint(key, buildSeed(col, col.uid));
    if (x < 1 || y < 1 || x + fp.X > col.S - 1 || y + fp.Y > col.S - 1) return { ok: false, reason: 'Hors du terrain.', fp };
    const zb = zoneBox(col);
    if (x < zb.x0 + 1 || y < zb.y0 + 1 || x + fp.X > zb.x1 - 1 || y + fp.Y > zb.y1 - 1) return { ok: false, reason: 'Hors de la zone de la colonie : agrandissez-la.', fp };
    for (const b of col.built) {
      const f = footprint(b.key, b.seed);
      if (x < b.x + f.X + 1 && x + fp.X + 1 > b.x && y < b.y + f.Y + 1 && y + fp.Y + 1 > b.y) return { ok: false, reason: 'La place est déjà prise.', fp };
    }
    // Extracteurs sur la glace, mines sur le minerai : au moins un quart de l'emprise.
    if (t.role === 'ice' || t.role === 'ore') {
      const dep = deposits(col)[t.role];
      let n = 0;
      for (let yy = y; yy < y + fp.Y; yy++) for (let xx = x; xx < x + fp.X; xx++) n += dep[yy * col.S + xx];
      if (n < fp.X * fp.Y * 0.25) return { ok: false, reason: t.role === 'ice' ? 'Il faut le poser sur un gisement de glace.' : 'Il faut le poser sur un gisement de minerai.', fp };
    }
    const p = price(key);
    if (col.stock.materials < p.materials) return { ok: false, reason: 'Pas assez de matériaux.', fp };
    if ((dust || 0) < p.dust) return { ok: false, reason: 'Pas assez de poussières d’étoiles.', fp };
    return { ok: true, fp, price: p };
  }

  function build(col, key, x, y, dust) {
    const c = canPlace(col, key, x, y, dust);
    if (!c.ok) return c;
    col.stock.materials -= c.price.materials;
    const b = { uid: col.uid, key, x, y, seed: buildSeed(col, col.uid), sol: col.sol };
    col.uid++;
    col.built.push(b);
    return { ok: true, b, dust: c.price.dust };
  }

  // Démolir rend la moitié des matériaux.
  function demolish(col, uid) {
    const i = col.built.findIndex((b) => b.uid === uid);
    if (i < 0) return { ok: false, reason: 'Introuvable.' };
    if (col.built[i].key === 'tour') return { ok: false, reason: 'La tour de contrôle ne se démolit pas.' };
    const b = col.built.splice(i, 1)[0];
    const back = Math.floor(price(b.key).materials / 2);
    col.stock.materials += back;
    return { ok: true, back };
  }

  // Navette de ravitaillement : 100 matériaux contre des poussières d'étoiles, dans la limite du stockage.
  function supply(col, dust) {
    const room = Math.floor(rates(col).caps.materials - col.stock.materials);
    if (room <= 0) return { ok: false, reason: 'Le stockage de matériaux est plein.' };
    if ((dust || 0) < SUPPLY.dust) return { ok: false, reason: 'Pas assez de poussières d’étoiles.' };
    const n = Math.min(SUPPLY.materials, room);
    col.stock.materials += n;
    return { ok: true, n, dust: SUPPLY.dust };
  }

  // ─── Graines de vie ─────────────────────────────────────────
  const BOOST_SOLS = 1440; // 24 h
  function boost(col, uid) {
    const b = col.built.find((q) => q.uid === uid);
    if (!b) return false;
    b.boost = Math.max(b.boost || 0, col.sol) + BOOST_SOLS;
    return true;
  }
  // Accélérer : la colonie vit n sols d'un coup (sans dépasser le rattrapage ordinaire).
  const fastForward = (col, n) => step(col, Math.min(n, MAX_CATCHUP));

  // ─── Bilan d'un sol ─────────────────────────────────────────
  // Énergie et ouvriers limitent la production. Les tempêtes de poussière voilent le solaire.
  function rates(col) {
    const R = { pop: 0, jobs: 0, powerProd: 0, powerUse: 0, water: 0, oxygen: 0, food: 0, research: 0, materials: 0, caps: { water: BASE_CAP, oxygen: BASE_CAP, food: BASE_CAP, materials: BASE_CAP * 3 } };
    const list = col.built.map((b) => E.TYPE_BY_KEY[b.key]).filter(Boolean);
    for (const t of list) {
      R.pop += t.eco.pop; R.jobs += t.eco.jobs;
      if (t.role === 'storage') { for (const k of ['water', 'oxygen', 'food']) R.caps[k] += STORE_CAP; R.caps.materials += STORE_CAP * 2; }
    }
    R.workers = Math.min(col.colonists, R.jobs);
    // Sans ouvriers, des drones font tourner les machines au ralenti (30 %) : une colonie vide peut repartir.
    R.workRatio = R.jobs ? Math.max(0.3, R.workers / R.jobs) : 1;
    const solar = (t) => /solaire|heliostats/.test(t.key);
    // Un bâtiment boosté (graine de vie) produit le double jusqu'au sol indiqué.
    const pairs = col.built.map((b) => [b, E.TYPE_BY_KEY[b.key]]).filter((x) => x[1]);
    const boostOf = (b) => (b.boost && b.boost > col.sol ? 2 : 1);
    for (const [b, t] of pairs) {
      const e = t.eco;
      if (e.power > 0) R.powerProd += e.power * boostOf(b) * (e.jobs ? R.workRatio : 1) * (col.storm > 0 && solar(t) ? 0.35 : 1);
      else R.powerUse += -e.power;
    }
    R.powerRatio = R.powerUse ? Math.min(1, R.powerProd / R.powerUse) : 1;
    for (const [b, t] of pairs) {
      const e = t.eco;
      const k = (e.jobs ? R.workRatio : 1) * (e.power < 0 ? R.powerRatio : 1) * boostOf(b);
      for (const f of ['water', 'oxygen', 'food', 'research', 'materials']) {
        const v = e[f] || 0;
        R[f] += v > 0 ? v * k : v * (e.power < 0 ? R.powerRatio : 1);
      }
    }
    // La prairie et les arbres produisent un peu d'oxygène (estimation sans parcourir le terrain).
    const gs = greenEstimate(col);
    R.green = gs;
    R.oxygen += gs.grass / 200 + gs.trees / 10;
    for (const f of LIFE) R[f] -= col.colonists;
    // Les rovers de la tour récupèrent toujours un peu de matériaux : une colonie n'est jamais bloquée.
    if (list.some((t) => t.role === 'hq')) R.materials += SALVAGE;
    R.power = R.powerProd - R.powerUse;
    return R;
  }

  // Avance la colonie de n sols ; renvoie les événements survenus (arrivées, départs, tempêtes…).
  function step(col, n) {
    const ev = [];
    for (let i = 0; i < n; i++) {
      const R = rates(col);
      // Les pépinières poussent si elles ont des bras, de l'énergie et de l'eau.
      const grow = R.workRatio * R.powerRatio * (col.stock.water > 0 ? 1 : 0);
      for (const b of col.built) if (E.TYPE_BY_KEY[b.key] && E.TYPE_BY_KEY[b.key].role === 'green') b.g = (b.g || 0) + grow;
      for (const f of LIFE) col.stock[f] = Math.max(0, Math.min(R.caps[f], col.stock[f] + R[f]));
      col.stock.materials = Math.max(0, Math.min(R.caps.materials, col.stock.materials + R.materials));
      col.stock.research += Math.max(0, R.research);
      col.sol++;
      // Pénurie : les colons repartent par les navettes, un par sol.
      const short = LIFE.find((f) => col.stock[f] <= 0 && R[f] < 0);
      if (short && col.colonists > 0) { col.colonists--; ev.push({ t: 'depart', f: short, sol: col.sol }); continue; }
      // Arrivées : il faut des logements libres et des réserves pour accueillir.
      const ports = col.built.filter((b) => E.TYPE_BY_KEY[b.key] && E.TYPE_BY_KEY[b.key].role === 'spaceport').length;
      const every = ports ? 1 : 3;
      const ready = R.pop > col.colonists && LIFE.every((f) => col.stock[f] > 10 && R[f] > -col.stock[f] / 5);
      if (ready && col.sol % every === 0) {
        const k = Math.min(R.pop - col.colonists, ports ? 2 : 1);
        col.colonists += k;
        ev.push({ t: 'arrivee', n: k, sol: col.sol });
      }
      // Tempête de poussière : rare, quelques sols, le solaire tourne au ralenti.
      if (col.storm > 0) col.storm--;
      else if (E.makeRng('tempete:' + col.seed + ':' + col.sol).chance(0.004)) { col.storm = 12; ev.push({ t: 'tempete', sol: col.sol }); }
    }
    if (ev.length) col.events = col.events.concat(ev).slice(-30);
    return ev;
  }

  // Rattrapage du temps écoulé depuis la dernière visite (plafonné à trois jours).
  function catchUp(col, now) {
    if (!col.last) { col.last = now; return []; }
    const n = Math.min(MAX_CATCHUP, Math.floor((now - col.last) / SOL_MS));
    if (n <= 0) return [];
    col.last += n * SOL_MS;
    return step(col, n);
  }

  // ─── Verdure ────────────────────────────────────────────────
  const greens = (col) => col.built.filter((b) => E.TYPE_BY_KEY[b.key] && E.TYPE_BY_KEY[b.key].role === 'green');
  // Estimation rapide (pour le bilan de chaque sol) : surface du disque atteint par chaque front.
  function greenEstimate(col) {
    let grass = 0, trees = 0;
    for (const b of greens(col)) {
      const g = b.g || 0;
      const r = Math.min(GREEN.radius, g / GREEN.perTile);
      const rt = Math.min(GREEN.radius, Math.max(0, (g - GREEN.treeDelay - GREEN.treeSpread / 2 - GREEN.treeStage * 2) / GREEN.perTile));
      grass += 0.7 * Math.PI * r * r;
      trees += 0.016 * 0.7 * Math.PI * rt * rt;
    }
    return { grass: Math.round(grass), trees: Math.round(trees) };
  }
  // Carte exacte de la verdure : niveau d'herbe par case (1 clairsemée, 2 prairie, 3 dense) et arbres
  // (stade 1 pousse, 2 jeune, 3 adulte). Ni sur la glace, ni sur le minerai, ni sous un bâtiment.
  const vegCache = new Map();
  function vegetation(col) {
    const gl = greens(col);
    const key = col.id + ':' + col.seed + ':' + col.S + ':' + col.uid + ':' + col.built.length + ':' + gl.map((b) => b.uid + '@' + Math.floor((b.g || 0) / 5)).join(',');
    const hit = vegCache.get(col.id);
    if (hit && hit.key === key) return hit.v;
    const S = col.S, lvl = new Uint8Array(S * S), age = new Float32Array(S * S).fill(-1), trees = [];
    let grass = 0;
    if (gl.length) {
      const dep = deposits(col), block = new Uint8Array(S * S);
      for (const b of col.built) {
        const f = footprint(b.key, b.seed);
        for (let y = b.y - 1; y <= b.y + f.Y; y++) for (let x = b.x - 1; x <= b.x + f.X; x++) if (x >= 0 && y >= 0 && x < S && y < S) block[y * S + x] = 1;
      }
      for (const b of gl) {
        const f = footprint(b.key, b.seed), cx = b.x + f.X / 2, cy = b.y + f.Y / 2, g = b.g || 0;
        const reach = Math.min(GREEN.radius, g / GREEN.perTile) * 1.35 + Math.max(f.X, f.Y) / 2 + 2;
        for (let y = Math.max(0, Math.floor(cy - reach)); y < Math.min(S, cy + reach); y++) for (let x = Math.max(0, Math.floor(cx - reach)); x < Math.min(S, cx + reach); x++) {
          const i = y * S + x;
          if (block[i] || dep.ice[i] || dep.ore[i]) continue;
          // Distance au bord du bâtiment, déformée par le bruit : la prairie avance en langues.
          const dx = Math.max(b.x - x, 0, x - (b.x + f.X - 1)), dy = Math.max(b.y - y, 0, y - (b.y + f.Y - 1));
          const d = Math.hypot(dx, dy) * (0.65 + 0.7 * vnoise(col.seed + 71, x, y, 9)) + (hashTile(col.seed + 5, x, y) - 0.5) * 2;
          if (d > GREEN.radius) continue;
          const a = g - Math.max(0, d) * GREEN.perTile;
          if (a > age[i]) age[i] = a;
        }
      }
      for (let i = 0; i < S * S; i++) {
        const a = age[i];
        if (a < 0) continue;
        const x = i % S, y = (i / S) | 0, h = hashTile(col.seed + 13, x, y);
        let l = 0;
        if (a < GREEN.sparse) l = h < (a / GREEN.sparse) * 0.75 ? 1 : 0;
        else if (a < GREEN.lush) l = h < 0.12 ? 1 : 2;
        else l = vnoise(col.seed + 29, x, y, 6) > 0.62 - Math.min(0.3, (a - GREEN.lush) / 14400) ? 3 : 2;
        lvl[i] = l;
        if (l) grass++;
      }
      // Arbres : un emplacement possible par carré de 4 × 4, plus serrés dans les bosquets.
      for (let cy = 0; cy < S / 4; cy++) for (let cx = 0; cx < S / 4; cx++) {
        const x = cx * 4 + Math.floor(hashTile(col.seed + 41, cx, cy) * 4), y = cy * 4 + Math.floor(hashTile(col.seed + 43, cx, cy) * 4);
        const i = y * S + x;
        if (!lvl[i] || age[i] < GREEN.treeDelay) continue;
        if (hashTile(col.seed + 47, cx, cy) > 0.04 + 0.5 * Math.max(0, vnoise(col.seed + 53, cx, cy, 3) - 0.3)) continue;
        const ta = age[i] - GREEN.treeDelay - hashTile(col.seed + 59, cx, cy) * GREEN.treeSpread;
        if (ta < 0) continue;
        trees.push({ x, y, stage: ta < GREEN.treeStage ? 1 : ta < GREEN.treeStage * 2 ? 2 : 3, h: hashTile(col.seed + 61, x, y) });
      }
    }
    const v = { lvl, trees, grass, adults: trees.filter((t) => t.stage === 3).length };
    vegCache.set(col.id, { key, v });
    return v;
  }
  // Rayon atteint par le front d'une pépinière (en cases).
  const greenRadius = (b) => Math.min(GREEN.radius, (b.g || 0) / GREEN.perTile);

  // ─── Rovers ─────────────────────────────────────────────────
  // Le rover de la tour part récupérer des matériaux dans la zone ; chaque forage, mine ou
  // extracteur a son transporteur qui fait la navette avec la tour. Ils contournent les bâtiments.
  const routeCache = new Map();
  function blockedGrid(col) {
    const S = col.S, g = new Uint8Array(S * S), z = zoneBox(col);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (x < z.x0 || y < z.y0 || x >= z.x1 || y >= z.y1) g[y * S + x] = 1;
    for (const b of col.built) {
      const f = footprint(b.key, b.seed);
      // Abords (3 cases) : praticables mais évités, pour que les rovers roulent au large des murs.
      for (let y = b.y - 3; y < b.y + f.Y + 3; y++) for (let x = b.x - 3; x < b.x + f.X + 3; x++) if (x >= 0 && y >= 0 && x < S && y < S && !g[y * S + x]) g[y * S + x] = 2;
    }
    for (const b of col.built) {
      const f = footprint(b.key, b.seed);
      for (let y = b.y; y < b.y + f.Y; y++) for (let x = b.x; x < b.x + f.X; x++) if (x >= 0 && y >= 0 && x < S && y < S) g[y * S + x] = 1;
    }
    return g;
  }
  // Case libre au bord d'un bâtiment, du côté de (tx, ty).
  function dock(col, grid, b, tx, ty) {
    const f = footprint(b.key, b.seed), S = col.S;
    let best = null, bd = Infinity;
    for (let y = b.y - 1; y <= b.y + f.Y; y++) for (let x = b.x - 1; x <= b.x + f.X; x++) {
      if (x >= b.x && x < b.x + f.X && y >= b.y && y < b.y + f.Y) continue;
      if (x < 0 || y < 0 || x >= S || y >= S || grid[y * S + x] === 1) continue;
      const d = Math.abs(x - tx) + Math.abs(y - ty);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  // Plus court chemin sur la grille, en pénalisant les virages (trajets en lignes droites).
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function findPath(col, grid, a, b) {
    const S = col.S, N = S * S * 4, cost = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1);
    const heap = [];
    const push = (st, c, g0) => { heap.push([c, st, g0]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const start = a[1] * S + a[0], goal = b[1] * S + b[0];
    for (let d = 0; d < 4; d++) { cost[start * 4 + d] = 0; push(start * 4 + d, 0, 0); }
    let end = -1;
    while (heap.length) {
      const [, st, c] = pop();
      if (c > cost[st]) continue;
      const t = st >> 2, d = st & 3;
      if (t === goal) { end = st; break; }
      const x = t % S, y = (t / S) | 0;
      for (let nd = 0; nd < 4; nd++) {
        const nx = x + DIRS[nd][0], ny = y + DIRS[nd][1];
        if (nx < 0 || ny < 0 || nx >= S || ny >= S || grid[ny * S + nx] === 1) continue;
        const ns = (ny * S + nx) * 4 + nd, nc = c + 1 + (nd === d ? 0 : 2.5) + (grid[ny * S + nx] === 2 ? 1.5 : 0);
        if (nc < cost[ns]) { cost[ns] = nc; from[ns] = st; push(ns, nc + Math.abs(nx - b[0]) + Math.abs(ny - b[1]), nc); }
      }
    }
    if (end < 0) return null;
    const pts = [];
    for (let st = end; st >= 0; st = from[st]) { const t = st >> 2; pts.push([t % S, (t / S) | 0]); }
    pts.reverse();
    // Ne garder que les coins.
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1], q = pts[i], r = pts[i + 1];
      if ((q[0] - p[0]) !== (r[0] - q[0]) || (q[1] - p[1]) !== (r[1] - q[1])) out.push(q);
    }
    if (pts.length > 1) out.push(pts[pts.length - 1]);
    let len = 0;
    for (let i = 1; i < out.length; i++) len += Math.abs(out[i][0] - out[i - 1][0]) + Math.abs(out[i][1] - out[i - 1][1]);
    return { pts: out, len };
  }
  // Position le long d'un chemin (distance d depuis le départ) : x, y et direction.
  function along(path, d) {
    let rest = Math.max(0, Math.min(path.len, d));
    for (let i = 1; i < path.pts.length; i++) {
      const p = path.pts[i - 1], q = path.pts[i], L = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);
      const dir = q[0] > p[0] ? 0 : q[1] > p[1] ? 1 : q[0] < p[0] ? 2 : 3;
      if (rest <= L || i === path.pts.length - 1) {
        const k = L ? Math.min(1, rest / L) : 0;
        return { x: p[0] + (q[0] - p[0]) * k, y: p[1] + (q[1] - p[1]) * k, dir };
      }
      rest -= L;
    }
    const p = path.pts[0];
    return { x: p[0], y: p[1], dir: 0 };
  }
  const sigOf = (col) => col.uid + ':' + col.built.length + ':' + zoneIndex(col);
  function cachedPath(col, key, make) {
    const k = col.id + ':' + sigOf(col) + ':' + key;
    if (!routeCache.has(k)) {
      if (routeCache.size > 80) routeCache.delete(routeCache.keys().next().value);
      routeCache.set(k, make());
    }
    return routeCache.get(k);
  }
  function rovers(col, clock) {
    const hq = col.built.find((b) => b.key === 'tour');
    if (!hq) return [];
    const grid = cachedPath(col, 'grille', () => blockedGrid(col));
    const fh = footprint(hq.key, hq.seed), hx = hq.x + fh.X / 2, hy = hq.y + fh.Y / 2;
    const out = [];
    const run = (path, phase, speed, cargo) => {
      const go = path.len / speed, T = 2 * go + 2 * ROVER.wait, t = ((phase % T) + T) % T;
      if (t < ROVER.wait) { const p = along(path, 0); return Object.assign(p, { cargo: null, dir: along(path, 0.5).dir }); }
      if (t < ROVER.wait + go) return Object.assign(along(path, (t - ROVER.wait) * speed), { cargo: null, moving: true });
      if (t < 2 * ROVER.wait + go) { const p = along(path, path.len); return Object.assign(p, { cargo, dir: (along(path, path.len - 0.5).dir + 2) % 4 }); }
      const p = along(path, path.len - (t - 2 * ROVER.wait - go) * speed);
      return Object.assign(p, { cargo, dir: (p.dir + 2) % 4, moving: true });
    };
    // Transporteurs : un par forage, mine ou extracteur (les plus proches d'abord).
    const prod = col.built.filter((b) => { const t = E.TYPE_BY_KEY[b.key]; return t && (t.role === 'ore' || t.role === 'ice'); })
      .sort((a, b) => Math.hypot(a.x - hx, a.y - hy) - Math.hypot(b.x - hx, b.y - hy)).slice(0, ROVER.max - 1);
    for (const b of prod) {
      const path = cachedPath(col, 'n' + b.uid, () => {
        const f = footprint(b.key, b.seed);
        const a0 = dock(col, grid, hq, b.x + f.X / 2, b.y + f.Y / 2), b0 = dock(col, grid, b, hx, hy);
        return a0 && b0 ? findPath(col, grid, a0, b0) : null;
      });
      if (!path || path.len < 2) continue;
      const r = run(path, clock + hashTile(col.seed, b.uid, 7) * 60, ROVER.speed, E.TYPE_BY_KEY[b.key].role === 'ice' ? 'ice' : 'ore');
      out.push(r);
    }
    // Rover de récupération : une destination tirée au sort à chaque tournée.
    const n = Math.floor(clock / ROVER.cycle), z = zoneBox(col);
    const path = cachedPath(col, 't' + n, () => {
      const rr = E.makeRng('recup:' + col.seed + ':' + n);
      for (let k = 0; k < 30; k++) {
        const tx = rr.int(z.x0 + 2, z.x1 - 3), ty = rr.int(z.y0 + 2, z.y1 - 3);
        if (grid[ty * col.S + tx] || Math.abs(tx - hx) + Math.abs(ty - hy) < 14) continue;
        const a0 = dock(col, grid, hq, tx, ty);
        const p = a0 && findPath(col, grid, a0, [tx, ty]);
        if (p && p.len >= 6) return p;
      }
      return null;
    });
    if (path) {
      const speed = Math.max(0.8, (2 * path.len) / (ROVER.cycle - 2 * ROVER.wait));
      out.push(run(path, clock - n * ROVER.cycle, speed, 'sand'));
    }
    return out;
  }
  // Voxels d'un rover (6 × 4, jaune chantier) tourné selon sa direction, posé à la hauteur z ;
  // en route, un peu de poussière soulevée derrière lui.
  function roverVoxels(r, z, blink) {
    const M = E.MAT, out = [];
    const cargo = r.cargo === 'ice' ? M.ICE : r.cargo === 'ore' ? M.ROCK : r.cargo === 'sand' ? M.SAND : 0;
    const add = (lx, ly, dz, k) => {
      const fx = lx - 2.5, fy = ly - 1.5;
      const [ox, oy] = r.dir === 0 ? [fx, fy] : r.dir === 1 ? [-fy, fx] : r.dir === 2 ? [-fx, -fy] : [fy, -fx];
      out.push({ x: r.x + 0.5 + ox, y: r.y + 0.5 + oy, z: z + dz, k });
    };
    // Roues, châssis et caisse.
    for (const lx of [0, 1, 4, 5]) for (const ly of [0, 3]) add(lx, ly, 0, M.DARK);
    for (let lx = 1; lx < 5; lx++) for (const ly of [1, 2]) add(lx, ly, 0, M.METAL);
    for (let lx = 0; lx < 6; lx++) for (let ly = 0; ly < 4; ly++) add(lx, ly, 1, lx >= 4 ? M.HULL : M.STRIPE);
    // Cabine vitrée à l'avant, benne à l'arrière (chargée au retour), gyrophare.
    for (const ly of [0, 3]) { add(4, ly, 2, M.HULL); add(5, ly, 2, M.HULL); }
    add(5, 1, 2, M.GLASS); add(5, 2, 2, M.GLASS); add(4, 1, 2, M.HULL); add(4, 2, 2, M.HULL);
    add(4, 1, 3, M.HULL2); add(4, 2, 3, M.HULL2); add(5, 1, 3, M.HULL2); add(5, 2, 3, M.HULL2);
    for (let lx = 0; lx < 4; lx++) { add(lx, 0, 2, M.STRIPE); add(lx, 3, 2, M.STRIPE); }
    add(0, 1, 2, M.STRIPE); add(0, 2, 2, M.STRIPE);
    if (cargo) for (let lx = 1; lx < 4; lx++) for (const ly of [1, 2]) add(lx, ly, 2, cargo);
    add(4, 1, 4, blink ? M.BEACON : M.DARK);
    if (r.moving) { const k = (Date.now() / 120) | 0; add(-1, 1 + (k & 1), 0, M.SAND); add(-2, 2 - (k & 1), 1, M.SAND); }
    return out;
  }

  // Modèle en voxels de la colonie (sol, gisements, bâtiments posés) pour le rendu.
  function scene(col, t) {
    const S = col.S;
    const m = E.model(S, S, 40);
    const r = E.makeRng('terrain:' + col.seed);
    r.seedA = r.range(0, 10); r.seedB = r.range(0, 10);
    const g = E.slab(m, r, { height: 3 });
    // Hauteur du sol nu par case, pour poser les rovers.
    const top = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let z = g + 1; while (z > 0 && !m.get(x, y, z)) z--; top[y * S + x] = z; }
    const dep = deposits(col);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (dep.ice[y * S + x]) m.set(x, y, g - 1, E.MAT.ICE);
      else if (dep.ore[y * S + x]) m.set(x, y, g - 1, E.MAT.ROCK);
    }
    // Prairie et arbres : on recolore le dessus du sol, quelques touffes, puis les arbres.
    const veg = vegetation(col);
    if (veg.grass) {
      const top = (x, y) => { for (let z = g + 1; z >= 0; z--) if (m.get(x, y, z)) return z; return -1; };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const l = veg.lvl[y * S + x];
        if (!l) continue;
        const z = top(x, y);
        if (z < 0) continue;
        m.set(x, y, z, l === 3 ? E.MAT.PLANT : E.MAT.GRASS);
        if (l === 3 && hashTile(col.seed + 17, x, y) < 0.07) m.set(x, y, z + 1, E.MAT.PLANT);
      }
      for (const tr of veg.trees) {
        const z = top(tr.x, tr.y) + 1;
        const trunk = tr.stage === 1 ? 1 : tr.stage === 2 ? 2 : 3 + (tr.h > 0.5 ? 1 : 0);
        for (let k = 0; k < trunk; k++) m.set(tr.x, tr.y, z + k, E.MAT.TRUNK);
        const cz = z + trunk;
        if (tr.stage === 1) { m.set(tr.x, tr.y, cz, E.MAT.LEAF); continue; }
        const rad = tr.stage === 2 ? 1.1 : 1.6 + tr.h * 0.6;
        for (let dz = -1; dz <= Math.ceil(rad); dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (Math.hypot(dx, dy, dz * 1.2) <= rad + 0.2 && cz + dz >= z + 1) {
            const xx = tr.x + dx, yy = tr.y + dy;
            if (!m.get(xx, yy, cz + dz)) m.set(xx, yy, cz + dz, E.MAT.LEAF);
          }
        }
      }
    }
    // Bornes lumineuses le long de la limite de la zone (juste à l'extérieur).
    const zb = zoneBox(col);
    if (zb.size < S) {
      const post = (x, y, corner) => { if (x < 0 || y < 0 || x >= S || y >= S) return; m.set(x, y, g, E.MAT.METAL); m.set(x, y, g + 1, E.MAT.METAL); m.set(x, y, g + 2, corner ? E.MAT.BEACON : E.MAT.LIGHT); };
      for (let k = zb.x0; k <= zb.x1; k += 6) { post(k, zb.y0 - 1); post(k, zb.y1); }
      for (let k = zb.y0; k <= zb.y1; k += 6) { post(zb.x0 - 1, k); post(zb.x1, k); }
      for (const [x, y] of [[zb.x0 - 1, zb.y0 - 1], [zb.x1, zb.y0 - 1], [zb.x0 - 1, zb.y1], [zb.x1, zb.y1]]) post(x, y, true);
    }
    for (const b of col.built) {
      const t0 = E.TYPE_BY_KEY[b.key];
      if (!t0) continue;
      const model = t0.build(E.makeRng(b.seed), { t: t || 0 });
      for (let y = b.y; y < b.y + model.Y; y++) for (let x = b.x; x < b.x + model.X; x++) {
        for (let z = g; z < m.Z; z++) m.set(x, y, z, 0);
        m.set(x, y, g - 1, E.MAT.PAD);
      }
      m.blit(model, b.x, b.y, g);
    }
    return { m, g, top };
  }

  return { SOL_MS, MAX_CATCHUP, BOOST_SOLS, boost, fastForward, SALVAGE, SUPPLY, supply, ZONES, ZONE_COST, zoneIndex, zoneBox, nextZone, expand, zoneMask, ROVER, rovers, roverVoxels, findPath, SIZE, TIERS, TIER_OF, LIFE, GREEN, vegetation, greenRadius, greenEstimate, create, deposits, footprint, buildSeed, price, unlocked, hasHq, canPlace, build, demolish, rates, step, catchUp, scene };
});
