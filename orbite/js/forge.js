/* ORBITE — Forge des mondes : une collection de planètes façonnées à la main avec les poussières d'étoiles.
 * Une graine se nourrit palier par palier (de plus en plus cher) ; chaque palier ouvre un emplacement
 * pour un ajout au choix (anneau, lunes, silhouette…), payé lui aussi. Règles pures, testables sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteForge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Traduction (js/i18n.js dans le navigateur) ; sous Node, le français avec ses {variables} remplies.
  const tr = (typeof window !== 'undefined' && window.tr) || ((s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);

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
    { key: 'terran', name: tr('Tellurique'), min: 1 },
    { key: 'earth', name: tr('Habitable'), min: 1 },
    { key: 'ocean', name: tr('Océan'), min: 1 },
    { key: 'ice', name: tr('Glace'), min: 1 },
    { key: 'desert', name: tr('Désert'), min: 1 },
    { key: 'lava', name: tr('Lave'), min: 1 },
    { key: 'moon', name: tr('Lune'), min: 1 },
    { key: 'dead', name: tr('Morte'), min: 1 },
    { key: 'toxic', name: tr('Toxique'), min: 1 },
    { key: 'crystal', name: tr('Cristal'), min: 3 },
    { key: 'gas', name: tr('Géante gazeuse'), min: 6 }
  ];
  const NATURE = Object.fromEntries(NATURES.map((n) => [n.key, n]));

  const SHAPES = [
    { key: 'double', name: tr('Double') },
    { key: 'brisee', name: tr('Brisée') },
    { key: 'amas', name: tr('Amas') },
    { key: 'bloc', name: tr('Bloc') },
    { key: 'monolithe', name: tr('Monolithe') },
    { key: 'diamant', name: tr('Diamant') },
    { key: 'anneau', name: tr('Tore') },
    { key: 'antenne', name: tr('Antenne') }
  ];

  // Ajouts : chacun occupe un emplacement. Les lunes s'ajoutent une à une, de plus en plus cher.
  const PARTS = [
    { key: 'debris', name: tr('Ceinture de débris'), text: tr('Des cailloux tournent autour de votre monde.'), price: [10], min: [2] },
    { key: 'facet', name: tr('Facettes'), text: tr('La surface se taille en facettes de cristal.'), price: [10], min: [2] },
    { key: 'shape', name: tr('Silhouette'), text: tr('Changez la forme du monde : double, brisée, bloc, diamant, antenne…'), price: [12], min: [2] },
    { key: 'ring', name: tr('Anneau'), text: tr('Un anneau de glace et de poussière.'), price: [15], min: [3] },
    { key: 'moons', name: tr('Lune'), text: tr('Une lune en orbite, jusqu’à trois.'), price: [12, 20, 30], min: [4, 7, 10] },
    { key: 'shell', name: tr('Coque de lumière'), text: tr('Une bulle irisée enveloppe la planète.'), price: [25], min: [8] }
  ];
  const PART = Object.fromEntries(PARTS.map((p) => [p.key, p]));

  // ─── Mon système : une étoile et ses mondes en orbite ─────────
  // Il s'ouvre quand un monde atteint la taille 5. L'étoile s'allume, change de classe, grandit ;
  // chaque monde forgé peut prendre une des six orbites.
  const SYSTEM_MASS = 5;
  const ORBITS = 6;
  const LIGHT_COST = 40;
  const STAR_CLASSES = [
    { key: 'naine rouge', name: tr('Naine rouge'), price: 15 },
    { key: 'étoile orange', name: tr('Étoile orange'), price: 15 },
    { key: 'naine jaune', name: tr('Naine jaune'), price: 15 },
    { key: 'étoile blanche', name: tr('Étoile blanche'), price: 15 },
    { key: 'géante bleue', name: tr('Géante bleue'), price: 25 },
    { key: 'étoile exotique', name: tr('Étoile exotique'), price: 30 }
  ];
  const STAR_GROW = [25, 50, 90, 150];

  function newStar(seed) { return { seed: seed >>> 0, lit: false, cls: 'naine jaune', size: 0, name: 'Soleil' }; }
  const systemOpen = (planets) => planets.some((p) => p.mass >= SYSTEM_MASS);

  // Actions sur le système : { t: 'light' | 'starClass' | 'starGrow' | 'orbit', … }.
  function sysCheck(sys, a, dust) {
    const r = sysQuote(sys, a);
    if (r.ok && dust != null && dust < r.cost) return { ok: false, cost: r.cost, reason: tr('Il vous manque {n} poussières d’étoiles.', { n: r.cost - dust }), short: true };
    return r;
  }
  function sysQuote(sys, a) {
    const no = (reason) => ({ ok: false, reason });
    if (!systemOpen(sys.planets)) return no(tr('Un de vos mondes doit atteindre la taille {n}.', { n: SYSTEM_MASS }));
    const st = sys.star;
    switch (a.t) {
      case 'light':
        if (st.lit) return no(tr('Votre étoile brille déjà.'));
        return { ok: true, cost: LIGHT_COST };
      case 'starClass': {
        const c = STAR_CLASSES.find((k) => k.key === a.cls);
        if (!st.lit) return no(tr('Allumez d’abord votre étoile.'));
        if (!c || c.key === st.cls) return no(tr('Votre étoile a déjà cette lumière.'));
        return { ok: true, cost: c.price };
      }
      case 'starGrow':
        if (!st.lit) return no(tr('Allumez d’abord votre étoile.'));
        if (st.size >= STAR_GROW.length) return no(tr('Votre étoile a atteint sa taille maximale.'));
        return { ok: true, cost: STAR_GROW[st.size] };
      case 'orbit': {
        const p = sys.planets[a.i];
        if (!st.lit) return no(tr('Allumez d’abord votre étoile.'));
        if (!p) return no(tr('Monde introuvable.'));
        if (a.slot == null) return p.orbit == null ? no(tr('Ce monde n’est pas en orbite.')) : { ok: true, cost: 0 };
        if (!p.type) return no(tr('Ce monde n’est encore qu’une graine : nourrissez-le.'));
        if (a.slot < 0 || a.slot >= ORBITS) return no(tr('Orbite inconnue.'));
        if (p.orbit === a.slot) return no(tr('Ce monde y tourne déjà.'));
        return { ok: true, cost: 0 };
      }
      default:
        return no(tr('Action inconnue.'));
    }
  }
  function sysApply(sys, a) {
    const r = sysQuote(sys, a);
    if (!r.ok) return r;
    const st = sys.star;
    if (a.t === 'light') st.lit = true;
    else if (a.t === 'starClass') st.cls = a.cls;
    else if (a.t === 'starGrow') st.size++;
    else if (a.t === 'orbit') {
      const p = sys.planets[a.i];
      if (a.slot != null) {
        // L'orbite visée est libérée : son monde prend l'ancienne place de celui qu'on déplace.
        const other = sys.planets.find((q) => q !== p && q.orbit === a.slot);
        if (other) other.orbit = p.orbit == null ? null : p.orbit;
      }
      p.orbit = a.slot;
    }
    return r;
  }
  const starLook = (st) => ({ type: 'star', seed: st.seed, starClass: st.cls, full: true, moons: 0, ring: false, debris: false });

  const NAMES = ['Aster', 'Lumen', 'Velia', 'Orphée', 'Nadir', 'Solenne', 'Kaïros', 'Isilde', 'Mirage', 'Ondine', 'Céleste', 'Écho'];

  function newPlanet(seed, index) {
    return {
      id: 'f' + (seed >>> 0).toString(36), name: NAMES[index % NAMES.length], seed: seed >>> 0,
      mass: 0, type: null, hue: 0, debris: false, facet: false, shape: null, ring: false, moons: 0, shell: false, orbit: null
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
    if (r.ok && dust != null && dust < r.cost) return { ok: false, cost: r.cost, reason: tr('Il vous manque {n} poussières d’étoiles.', { n: r.cost - dust }), short: true };
    return r;
  }
  function quote(p, a) {
    const no = (reason) => ({ ok: false, reason });
    switch (a.t) {
      case 'feed':
        if (p.mass >= MAX_MASS) return no(tr('Votre monde a atteint sa taille maximale.'));
        return { ok: true, cost: FEED[p.mass] };
      case 'nature': {
        const n = NATURE[a.key];
        if (!n) return no(tr('Nature inconnue.'));
        if (p.mass < 1) return no(tr('Nourrissez d’abord la graine.'));
        if (p.type === a.key) return no(tr('Votre monde a déjà cette nature.'));
        if (p.mass < n.min) return no(tr('Il faut un monde de taille {n}.', { n: n.min }));
        if (a.key === 'gas' && p.shape) return no(tr('Une géante gazeuse n’a pas de silhouette : retirez-la d’abord.'));
        return { ok: true, cost: p.type ? 6 + 2 * p.mass : 0 };
      }
      case 'hue':
        if (p.mass < 1 || !p.type) return no(tr('Choisissez d’abord la nature de votre monde.'));
        if (!HUES.includes(a.v) || a.v === p.hue) return no(tr('Cette teinte est déjà la sienne.'));
        return { ok: true, cost: HUE_COST };
      case 'relief':
        if (p.mass < 1 || !p.type) return no(tr('Choisissez d’abord la nature de votre monde.'));
        return { ok: true, cost: RELIEF_COST };
      case 'add': {
        const part = PART[a.part];
        if (!part) return no(tr('Ajout inconnu.'));
        if (!p.type) return no(tr('Choisissez d’abord la nature de votre monde.'));
        if (a.part === 'shape') {
          if (p.type === 'gas') return no(tr('Une géante gazeuse n’a pas de silhouette.'));
          if (!SHAPES.some((s) => s.key === a.v)) return no(tr('Silhouette inconnue.'));
          if (p.shape === a.v) return no(tr('Votre monde a déjà cette silhouette.'));
          // Changer de silhouette garde l'emplacement déjà pris.
          if (p.shape) return { ok: true, cost: part.price[0] };
        }
        const n = a.part === 'moons' ? p.moons : 0;
        if (a.part === 'moons' ? n >= part.price.length : has(p, a.part)) return no(a.part === 'moons' ? tr('Trois lunes au plus.') : tr('Déjà ajouté.'));
        if (p.mass < part.min[n]) return no(tr('Il faut un monde de taille {n}.', { n: part.min[n] }));
        if (slotsFree(p) < 1) return no(tr('Plus d’emplacement libre : nourrissez votre monde pour en ouvrir un.'));
        return { ok: true, cost: part.price[n] };
      }
      case 'remove':
        if (!PART[a.part] || !has(p, a.part)) return no(tr('Rien à retirer.'));
        return { ok: true, cost: 0 };
      default:
        return no(tr('Action inconnue.'));
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
    if (!(q.orbit >= 0 && q.orbit < ORBITS) || !q.type) q.orbit = null;
    return q;
  }
  function sanitizeStar(st, seed) {
    const q = Object.assign(newStar(seed), st || {});
    if (!STAR_CLASSES.some((k) => k.key === q.cls)) q.cls = 'naine jaune';
    q.size = Math.max(0, Math.min(STAR_GROW.length, q.size | 0));
    q.lit = !!q.lit;
    return q;
  }

  return {
    FEED, MAX_MASS, SEED_COST, MAX_PLANETS, HUE_COST, RELIEF_COST, HUES, NATURES, NATURE, SHAPES, PARTS, PART,
    newPlanet, seedCost, slotsUsed, slotsFree, check, apply, look, scale, sanitize,
    SYSTEM_MASS, ORBITS, LIGHT_COST, STAR_CLASSES, STAR_GROW, newStar, systemOpen, sysCheck, sysApply, starLook, sanitizeStar
  };
});
