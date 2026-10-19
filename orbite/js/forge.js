/* ORBITE — Forge des mondes : une collection de planètes façonnées à la main avec les poussières d'étoiles.
 * Une graine se nourrit palier par palier (de plus en plus cher) ; chaque palier ouvre un emplacement
 * pour un ajout au choix (anneau, lunes, silhouette…), payé lui aussi. Règles pures, testables sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteForge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Prix de chaque repas : du palier k au palier k + 1. 15 paliers, 517 poussières en tout.
  const FEED = [3, 4, 5, 7, 9, 12, 16, 21, 28, 36, 46, 58, 72, 90, 110];
  const MAX_MASS = FEED.length;
  // Prix d'une nouvelle graine selon le nombre de planètes déjà forgées : la première est offerte.
  const SEED_COST = [0, 30, 80, 150, 250, 400];
  const MAX_PLANETS = SEED_COST.length;
  const HUE_COST = 2;
  const RELIEF_COST = 3;
  const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  const NATURES = [
    { key: 'terran', name: 'Tellurique', min: 1 },
    { key: 'earth', name: 'Habitable', min: 1 },
    { key: 'ocean', name: 'Océan', min: 1 },
    { key: 'ice', name: 'Glace', min: 1 },
    { key: 'desert', name: 'Désert', min: 1 },
    { key: 'lava', name: 'Lave', min: 1 },
    { key: 'moon', name: 'Lune', min: 1 },
    { key: 'dead', name: 'Morte', min: 1 },
    { key: 'toxic', name: 'Toxique', min: 1 },
    { key: 'crystal', name: 'Cristal', min: 3 },
    { key: 'gas', name: 'Géante gazeuse', min: 6 }
  ];
  const NATURE = Object.fromEntries(NATURES.map((n) => [n.key, n]));

  const SHAPES = [
    { key: 'double', name: 'Double' },
    { key: 'brisee', name: 'Brisée' },
    { key: 'amas', name: 'Amas' },
    { key: 'bloc', name: 'Bloc' },
    { key: 'monolithe', name: 'Monolithe' },
    { key: 'diamant', name: 'Diamant' },
    { key: 'anneau', name: 'Tore' }
  ];

  // Ajouts : chacun occupe un emplacement. Les lunes s'ajoutent une à une, de plus en plus cher.
  const PARTS = [
    { key: 'debris', name: 'Ceinture de débris', text: 'Des cailloux tournent autour de votre monde.', price: [10], min: [2] },
    { key: 'facet', name: 'Facettes', text: 'La surface se taille en facettes de cristal.', price: [10], min: [2] },
    { key: 'shape', name: 'Silhouette', text: 'Changez la forme du monde : double, brisée, bloc, diamant…', price: [12], min: [2] },
    { key: 'ring', name: 'Anneau', text: 'Un anneau de glace et de poussière.', price: [15], min: [3] },
    { key: 'moons', name: 'Lune', text: 'Une lune en orbite, jusqu’à trois.', price: [12, 20, 30], min: [4, 7, 10] },
    { key: 'shell', name: 'Coque de lumière', text: 'Une bulle irisée enveloppe la planète.', price: [25], min: [8] }
  ];
  const PART = Object.fromEntries(PARTS.map((p) => [p.key, p]));

  const NAMES = ['Aster', 'Lumen', 'Velia', 'Orphée', 'Nadir', 'Solenne', 'Kaïros', 'Isilde', 'Mirage', 'Ondine', 'Céleste', 'Écho'];

  function newPlanet(seed, index) {
    return {
      id: 'f' + (seed >>> 0).toString(36), name: NAMES[index % NAMES.length], seed: seed >>> 0,
      mass: 0, type: null, hue: 0, debris: false, facet: false, shape: null, ring: false, moons: 0, shell: false
    };
  }
  const seedCost = (count) => (count < MAX_PLANETS ? SEED_COST[count] : null);

  function slotsUsed(p) {
    return (p.debris ? 1 : 0) + (p.facet ? 1 : 0) + (p.shape ? 1 : 0) + (p.ring ? 1 : 0) + p.moons + (p.shell ? 1 : 0);
  }
  const slotsFree = (p) => p.mass - slotsUsed(p);
  const has = (p, key) => (key === 'moons' ? p.moons > 0 : !!p[key]);

  // Prix et conditions d'une action, sans rien changer : { ok, cost, reason }.
  function check(p, a, dust) {
    const r = quote(p, a);
    if (r.ok && dust != null && dust < r.cost) return { ok: false, cost: r.cost, reason: `Il vous manque ${r.cost - dust} poussières d’étoiles.`, short: true };
    return r;
  }
  function quote(p, a) {
    const no = (reason) => ({ ok: false, reason });
    switch (a.t) {
      case 'feed':
        if (p.mass >= MAX_MASS) return no('Votre monde a atteint sa taille maximale.');
        return { ok: true, cost: FEED[p.mass] };
      case 'nature': {
        const n = NATURE[a.key];
        if (!n) return no('Nature inconnue.');
        if (p.mass < 1) return no('Nourrissez d’abord la graine.');
        if (p.type === a.key) return no('Votre monde a déjà cette nature.');
        if (p.mass < n.min) return no(`Il faut un monde de taille ${n.min}.`);
        if (a.key === 'gas' && p.shape) return no('Une géante gazeuse n’a pas de silhouette : retirez-la d’abord.');
        return { ok: true, cost: p.type ? 6 + 2 * p.mass : 0 };
      }
      case 'hue':
        if (p.mass < 1 || !p.type) return no('Choisissez d’abord la nature de votre monde.');
        if (!HUES.includes(a.v) || a.v === p.hue) return no('Cette teinte est déjà la sienne.');
        return { ok: true, cost: HUE_COST };
      case 'relief':
        if (p.mass < 1 || !p.type) return no('Choisissez d’abord la nature de votre monde.');
        return { ok: true, cost: RELIEF_COST };
      case 'add': {
        const part = PART[a.part];
        if (!part) return no('Ajout inconnu.');
        if (!p.type) return no('Choisissez d’abord la nature de votre monde.');
        if (a.part === 'shape') {
          if (p.type === 'gas') return no('Une géante gazeuse n’a pas de silhouette.');
          if (!SHAPES.some((s) => s.key === a.v)) return no('Silhouette inconnue.');
          if (p.shape === a.v) return no('Votre monde a déjà cette silhouette.');
          // Changer de silhouette garde l'emplacement déjà pris.
          if (p.shape) return { ok: true, cost: part.price[0] };
        }
        const n = a.part === 'moons' ? p.moons : 0;
        if (a.part === 'moons' ? n >= part.price.length : has(p, a.part)) return no(a.part === 'moons' ? 'Trois lunes au plus.' : 'Déjà ajouté.');
        if (p.mass < part.min[n]) return no(`Il faut un monde de taille ${part.min[n]}.`);
        if (slotsFree(p) < 1) return no('Plus d’emplacement libre : nourrissez votre monde pour en ouvrir un.');
        return { ok: true, cost: part.price[n] };
      }
      case 'remove':
        if (!PART[a.part] || !has(p, a.part)) return no('Rien à retirer.');
        return { ok: true, cost: 0 };
      default:
        return no('Action inconnue.');
    }
  }

  // Applique une action déjà vérifiée ; renvoie son prix.
  function apply(p, a) {
    const r = quote(p, a);
    if (!r.ok) return r;
    switch (a.t) {
      case 'feed': p.mass++; break;
      case 'nature': p.type = a.key; break;
      case 'hue': p.hue = a.v; break;
      case 'relief': p.seed = (Math.imul(p.seed ^ 0x9e3779b9, 2654435761) >>> 0) || 1; break;
      case 'add':
        if (a.part === 'moons') p.moons++;
        else if (a.part === 'shape') p.shape = a.v;
        else p[a.part] = true;
        break;
      case 'remove':
        if (a.part === 'moons') p.moons--;
        else if (a.part === 'shape') p.shape = null;
        else p[a.part] = false;
        break;
    }
    return r;
  }

  // Apparence pour le moteur de rendu. Une graine est un petit caillou dans sa poussière.
  function look(p) {
    if (p.mass < 1 || !p.type) return { type: 'asteroid', seed: p.seed, debris: true, full: true, moons: 0 };
    return {
      type: p.type, seed: p.seed, full: true, hueShift: p.hue || 0,
      ring: p.ring, debris: p.debris, moons: p.moons, shell: p.shell,
      facet: p.facet ? 'on' : 'off', shape: p.shape || 'aucune'
    };
  }
  // Taille affichée : une graine minuscule, puis le monde grossit à chaque palier.
  const scale = (p) => 0.34 + 0.66 * Math.min(1, p.mass / MAX_MASS);

  function sanitize(p, i) {
    const q = Object.assign(newPlanet(Number(p && p.seed) || 1, i), p || {});
    q.mass = Math.max(0, Math.min(MAX_MASS, q.mass | 0));
    q.moons = Math.max(0, Math.min(3, q.moons | 0));
    if (q.type && !NATURE[q.type]) q.type = 'terran';
    if (!HUES.includes(q.hue)) q.hue = 0;
    if (q.shape && !SHAPES.some((s) => s.key === q.shape)) q.shape = null;
    return q;
  }

  return {
    FEED, MAX_MASS, SEED_COST, MAX_PLANETS, HUE_COST, RELIEF_COST, HUES, NATURES, NATURE, SHAPES, PARTS, PART,
    newPlanet, seedCost, slotsUsed, slotsFree, check, apply, look, scale, sanitize
  };
});
