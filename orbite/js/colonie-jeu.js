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

  // Paliers de recherche : ce qui est constructible dès le départ, puis à 40, 150 et 400 de recherche.
  const TIERS = [
    { research: 0, keys: ['tour', 'module', 'dome', 'capsules', 'solaire', 'eolienne', 'rtg', 'extracteur', 'condenseur', 'moxie', 'electrolyseur', 'serre', 'reservoir', 'batteries', 'labo', 'forage', 'piste', 'entrepot', 'rover'] },
    { research: 40, keys: ['habitat', 'immeuble', 'dortoir', 'bunker', 'ferme', 'champignonniere', 'recycleur', 'aquaculture', 'cantine', 'hopital', 'geothermie', 'methane', 'mine', 'briqueterie', 'concasseur', 'garage', 'carburant', 'antenne', 'meteo', 'relais', 'hangar', 'camion'] },
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
      v: 1, id: String(id), seed: seed >>> 0, theme: theme || 'mars', S: SIZE,
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
    const key = col.seed + ':' + col.S;
    if (depCache.has(key)) return depCache.get(key);
    const S = col.S, ice = new Uint8Array(S * S), ore = new Uint8Array(S * S);
    const r = E.makeRng('gisements:' + col.seed);
    const blobs = (arr, n) => {
      for (let i = 0; i < n; i++) {
        const cx = r.range(8, S - 8), cy = r.range(8, S - 8), rad = r.range(6, 12);
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const d = Math.hypot(x - cx, y - cy) / rad;
          if (d < 1 - 0.35 * hashTile(col.seed + i, x, y)) arr[y * S + x] = 1;
        }
      }
    };
    blobs(ice, 6);
    blobs(ore, 6);
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

  // Peut-on poser ce bâtiment ici (coin x, y) ? Renvoie { ok, reason, fp }.
  function canPlace(col, key, x, y, dust) {
    const t = E.TYPE_BY_KEY[key];
    if (!t || !t.build || TIER_OF[key] == null) return { ok: false, reason: 'Bâtiment inconnu.' };
    if (!hasHq(col) && key !== 'tour') return { ok: false, reason: 'Posez d’abord la tour de contrôle.' };
    if (key === 'tour' && hasHq(col)) return { ok: false, reason: 'La colonie a déjà sa tour de contrôle.' };
    if (!unlocked(col, key)) return { ok: false, reason: 'Recherche insuffisante.' };
    const fp = footprint(key, buildSeed(col, col.uid));
    if (x < 1 || y < 1 || x + fp.X > col.S - 1 || y + fp.Y > col.S - 1) return { ok: false, reason: 'Hors du terrain.', fp };
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
    for (const t of list) {
      const e = t.eco;
      if (e.power > 0) R.powerProd += e.power * (e.jobs ? R.workRatio : 1) * (col.storm > 0 && solar(t) ? 0.35 : 1);
      else R.powerUse += -e.power;
    }
    R.powerRatio = R.powerUse ? Math.min(1, R.powerProd / R.powerUse) : 1;
    for (const t of list) {
      const e = t.eco;
      const k = (e.jobs ? R.workRatio : 1) * (e.power < 0 ? R.powerRatio : 1);
      for (const f of ['water', 'oxygen', 'food', 'research', 'materials']) {
        const v = e[f] || 0;
        R[f] += v > 0 ? v * k : v * (e.power < 0 ? R.powerRatio : 1);
      }
    }
    for (const f of LIFE) R[f] -= col.colonists;
    R.power = R.powerProd - R.powerUse;
    return R;
  }

  // Avance la colonie de n sols ; renvoie les événements survenus (arrivées, départs, tempêtes…).
  function step(col, n) {
    const ev = [];
    for (let i = 0; i < n; i++) {
      const R = rates(col);
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

  // Modèle en voxels de la colonie (sol, gisements, bâtiments posés) pour le rendu.
  function scene(col, t) {
    const S = col.S;
    const m = E.model(S, S, 40);
    const r = E.makeRng('terrain:' + col.seed);
    r.seedA = r.range(0, 10); r.seedB = r.range(0, 10);
    const g = E.slab(m, r, { height: 3 });
    const dep = deposits(col);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      if (dep.ice[y * S + x]) m.set(x, y, g - 1, E.MAT.ICE);
      else if (dep.ore[y * S + x]) m.set(x, y, g - 1, E.MAT.ROCK);
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
    return { m, g };
  }

  return { SOL_MS, MAX_CATCHUP, SIZE, TIERS, TIER_OF, LIFE, create, deposits, footprint, buildSeed, price, unlocked, hasHq, canPlace, build, demolish, rates, step, catchUp, scene };
});
