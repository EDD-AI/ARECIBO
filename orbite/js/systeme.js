/* ORBITE — Mon système (v120) : tout le système solaire à acheter puis à améliorer avec les poussières
 * d'étoiles, autour de votre planète qui prend la place de la Terre : le Soleil (rouge), Mercure, Vénus,
 * la Lune, Mars, Jupiter, Saturne, Uranus, Neptune et Pluton. Comme pour votre planète, chaque
 * amélioration demande un niveau de créateur et s'achète dans l'ordre. Ce qui est acheté se voit sur
 * l'astre, chez vous (Marché stellaire, onglet Mon système) et chez ceux qui visitent votre système.
 * Règles pures, testables sous Node (comme js/world.js). État local : orbite.systeme = { lune: n, … }
 * (clé absente : astre pas acheté ; n : nombre d'améliorations faites). */
(function (root) {
  'use strict';
  // Traduction (js/i18n.js dans le navigateur) ; sous Node, le français avec ses {variables} remplies.
  const tr = (typeof window !== 'undefined' && window.tr) || ((s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);

  const KEY = 'orbite.systeme';
  // Lumière venue du haut à gauche : une face de nuit reste visible (lumières, éclairs).
  const LIGHT = [-0.62, 0.5, 0.6];

  // Chaque astre, dans l'ordre du système (du Soleil vers Pluton) : son prix, sa taille (rayon, votre
  // planète vaut 1), son orbite (0 : Mercure … 8 : Pluton ; votre planète est sur la 2, la Terre ; le
  // Soleil au centre : -1 ; la Lune tourne autour de votre planète : orbit 'monde'), son apparence de
  // départ (look du moteur, js/stage.js) et ses améliorations. fx : ce que l'amélioration change dans
  // le look ; grow : de combien l'astre grandit.
  const BODIES = [
    {
      id: 'soleil', price: 5000, size: 2.6, orbit: -1, color: '#ff5b3d',
      name: tr('Soleil'), text: tr('Une étoile rouge au centre de votre système : tout tourne autour d’elle.'),
      base: { type: 'star', seed: 1040, starClass: 'soleil rouge', corona: 0.12 },
      ups: [
        { id: 'couronne', lvl: 30, price: 1500, name: tr('Couronne'), text: tr('Une couronne de flammes rouges l’entoure.'), fx: { corona: 0.55 } },
        { id: 'eruptions', lvl: 50, price: 2500, name: tr('Éruptions'), text: tr('Il grandit et ses flammes jaillissent plus fort.'), fx: { flare: true }, grow: 0.3 },
        { id: 'geante', lvl: 75, price: 4000, name: tr('Géante rouge'), text: tr('Votre soleil gonfle en une immense géante d’un rouge profond.'), fx: { starClass: 'géante rouge' }, grow: 0.6 }
      ]
    },
    {
      id: 'mercure', price: 300, size: 0.5, orbit: 0, color: '#b3a796',
      name: tr('Mercure'), text: tr('La plus petite planète, tout près du Soleil : une roche grise.'),
      base: { type: 'moon', seed: 1201, mood: 'mercure', craters: 0, maria: 0 },
      ups: [
        { id: 'crateres', lvl: 8, price: 150, name: tr('Cratères brûlés'), text: tr('Des impacts criblent sa roche brûlée par le Soleil.'), fx: { craters: 1 } },
        { id: 'lave', lvl: 20, price: 250, name: tr('Plaines de lave figée'), text: tr('De vieilles coulées de lave forment de grandes plaines sombres.'), fx: { maria: 1 } },
        { id: 'brulante', lvl: 36, price: 400, name: tr('Face brûlante'), text: tr('Le côté tourné vers la lumière rougeoie de chaleur.'), fx: { heat: true } }
      ]
    },
    {
      id: 'venus', price: 350, size: 0.92, orbit: 1, color: '#e9d39a',
      name: tr('Vénus'), text: tr('Une planète jaune pâle, cachée sous un voile de nuages.'),
      base: { type: 'gas', seed: 1302, mood: 'venus', axis: [0.08, 0.1] },
      ups: [
        { id: 'nuages', lvl: 10, price: 180, name: tr('Nuages d’acide'), text: tr('D’épais nuages d’acide tourbillonnent tout autour.'), fx: { veil: true } },
        { id: 'eclairs', lvl: 24, price: 300, name: tr('Éclairs'), text: tr('Des éclairs violets crépitent dans ses nuages.'), fx: { lightning: true } },
        { id: 'volcans', lvl: 40, price: 450, name: tr('Volcans'), text: tr('Des volcans rougeoient à travers le voile.'), fx: { volcanoes: true } }
      ]
    },
    {
      id: 'lune', price: 250, size: 0.42, orbit: 'monde', color: '#d9dde8',
      name: tr('Lune'), text: tr('Une lune de roche claire, qui tourne autour de votre planète.'),
      base: { type: 'moon', seed: 1110, mood: 'claire', craters: 0, maria: 0 },
      ups: [
        { id: 'crateres', lvl: 5, price: 120, name: tr('Cratères profonds'), text: tr('Les impacts creusent la roche : le relief se marque.'), fx: { craters: 1 } },
        { id: 'mers', lvl: 12, price: 200, name: tr('Mers sombres'), text: tr('De grandes plaines de lave figée assombrissent sa face.'), fx: { maria: 1 } },
        { id: 'lueur', lvl: 20, price: 320, name: tr('Lueur d’argent'), text: tr('Un halo blanc l’entoure, comme une pleine lune.'), fx: { glow: true } },
        { id: 'base', lvl: 32, price: 480, name: tr('Base lunaire'), text: tr('De petites lumières s’allument sur sa face de nuit.'), fx: { lights: true } },
        { id: 'anneau', lvl: 45, price: 700, name: tr('Anneau de poussière'), text: tr('Un fin anneau de poussière tourne autour d’elle.'), fx: { ring: true } }
      ]
    },
    {
      id: 'mars', price: 400, size: 0.62, orbit: 3, color: '#e0784a',
      name: tr('Mars'), text: tr('La planète rouge, couverte de poussière couleur rouille.'),
      base: { type: 'desert', seed: 1403, mood: 'mars', axis: [0.12, 0.26] },
      ups: [
        { id: 'calottes', lvl: 8, price: 160, name: tr('Calottes de glace'), text: tr('Ses pôles se couvrent de glace blanche.'), fx: { icecaps: true } },
        { id: 'canyon', lvl: 18, price: 260, name: tr('Grand canyon'), text: tr('D’immenses failles sombres fendent sa surface.'), fx: { canyons: true } },
        { id: 'tempete', lvl: 30, price: 380, name: tr('Tempête de poussière'), text: tr('Une tempête orangée balaie la planète.'), fx: { dust: true } },
        { id: 'lunes', lvl: 48, price: 600, name: tr('Phobos et Deimos'), text: tr('Deux petites lunes de roche tournent autour d’elle.'), fx: { moons: 2, moonKind: ['phobos', 'deimos'], moonPlane: true } }
      ]
    },
    {
      id: 'jupiter', price: 1200, size: 2, orbit: 4, color: '#dba574',
      name: tr('Jupiter'), text: tr('La plus grosse planète : une géante de gaz beige et orange.'),
      base: { type: 'gas', seed: 1504, mood: 'jupiter', axis: [0.06, 0.12] },
      ups: [
        { id: 'bandes', lvl: 15, price: 300, name: tr('Bandes de nuages'), text: tr('Ses nuages s’étirent en larges bandes orange et crème.'), fx: { bands: true } },
        { id: 'tache', lvl: 28, price: 500, name: tr('Grande Tache rouge'), text: tr('Une tempête rouge plus grande que la Terre tourne dans ses nuages.'), fx: { storm: true } },
        { id: 'anneau', lvl: 44, price: 700, name: tr('Anneau fin'), text: tr('Un anneau de poussière, fin et discret, l’entoure.'), fx: { ring: true, ringLook: 'jupiter' } },
        { id: 'galileennes', lvl: 62, price: 1000, name: tr('Lunes galiléennes'), text: tr('Io, Europe, Ganymède et Callisto tournent autour d’elle.'), fx: { moons: 4, moonKind: ['io', 'europe', 'ganymede', 'callisto'], moonPlane: true } }
      ]
    },
    {
      id: 'saturne', price: 900, size: 1.7, orbit: 5, color: '#e8cf8e',
      name: tr('Saturne'), text: tr('Une géante de gaz dorée, entourée d’un fin anneau.'),
      base: { type: 'gas', seed: 1605, mood: 'saturne', ring: true, ringLook: 'saturne-fin', axis: [-0.24, 0.44] },
      ups: [
        { id: 'anneaux', lvl: 12, price: 250, name: tr('Anneaux'), text: tr('Ses grands anneaux de glace se déploient.'), fx: { ringLook: 'saturne' } },
        { id: 'brillants', lvl: 26, price: 450, name: tr('Anneaux brillants'), text: tr('Ses anneaux s’élargissent et brillent comme de la glace au soleil.'), fx: { ringLook: 'saturne-brillant' } },
        { id: 'aurores', lvl: 42, price: 650, name: tr('Aurores polaires'), text: tr('Des aurores turquoise dansent autour de ses pôles.'), fx: { aurora: true } },
        { id: 'titan', lvl: 60, price: 900, name: tr('Titan'), text: tr('Une grosse lune orange, voilée de brume, tourne autour d’elle.'), fx: { moons: 1, moonKind: ['titan'] } }
      ]
    },
    {
      id: 'uranus', price: 600, size: 1.3, orbit: 6, color: '#9fe2e4',
      name: tr('Uranus'), text: tr('Une géante de glace cyan pâle, presque sans nuages.'),
      base: { type: 'gas', seed: 1706, mood: 'uranus', axis: [0.14, 0.22] },
      ups: [
        { id: 'couchee', lvl: 14, price: 250, name: tr('Couchée sur le côté'), text: tr('Elle bascule et tourne couchée : ses bandes se dressent.'), fx: { axis: [1.42, 0.3] } },
        { id: 'anneaux', lvl: 32, price: 450, name: tr('Anneaux sombres'), text: tr('De fins anneaux sombres l’entourent, debout comme elle.'), fx: { ring: true, ringLook: 'uranus' } },
        { id: 'nuages', lvl: 50, price: 650, name: tr('Nuages cyan'), text: tr('Des nuages blancs filent sur un ciel d’un cyan plus vif.'), fx: { cyan: true } }
      ]
    },
    {
      id: 'neptune', price: 500, size: 1.25, orbit: 7, color: '#6f9bff',
      name: tr('Neptune'), text: tr('Une géante de gaz bleu profond, loin dans votre système.'),
      base: { type: 'gas', seed: 1110, mood: 'neptune', moonKind: 'ice' },
      ups: [
        { id: 'tache', lvl: 10, price: 350, name: tr('Grande Tache sombre'), text: tr('Une tempête géante tourne dans ses nuages.'), fx: { storm: true } },
        { id: 'vents', lvl: 24, price: 550, name: tr('Vents supersoniques'), text: tr('Les vents les plus rapides du système creusent ses bandes.'), fx: { bands: true } },
        { id: 'anneaux', lvl: 38, price: 800, name: tr('Anneaux'), text: tr('De fins anneaux de glace l’entourent.'), fx: { ring: true } },
        { id: 'triton', lvl: 55, price: 1200, name: tr('Triton'), text: tr('Une lune de glace vient tourner autour d’elle.'), fx: { moons: 1 } }
      ]
    },
    {
      id: 'pluton', price: 150, size: 0.38, orbit: 8, color: '#dcc4a4',
      name: tr('Pluton'), text: tr('Une petite planète naine beige, tout au bout du système.'),
      base: { type: 'moon', seed: 1808, mood: 'pluton', axis: [0, 0], spin: 0 },
      ups: [
        { id: 'coeur', lvl: 6, price: 120, name: tr('Cœur de glace'), text: tr('Une grande plaine de glace en forme de cœur apparaît.'), fx: { heart: true } },
        { id: 'charon', lvl: 22, price: 260, name: tr('Charon'), text: tr('Sa grosse lune grise vient danser avec elle.'), fx: { moons: 1, moonKind: ['charon'] } }
      ]
    }
  ];
  const BY_ID = Object.fromEntries(BODIES.map((b) => [b.id, b]));

  const clampN = (b, v) => Math.max(0, Math.min(b.ups.length, Math.floor(v)));

  // État sûr : seuls les astres connus, avec un nombre d'améliorations entier et borné.
  function sanitize(state) {
    const out = {};
    if (!state || typeof state !== 'object' || Array.isArray(state)) return out;
    for (const b of BODIES) {
      if (!Object.prototype.hasOwnProperty.call(state, b.id)) continue;
      const v = Number(state[b.id]);
      if (state[b.id] !== null && state[b.id] !== '' && typeof state[b.id] !== 'boolean' && Number.isFinite(v) && v >= 0) out[b.id] = clampN(b, v);
    }
    return out;
  }
  const owned = (state, id) => !!BY_ID[id] && !!state && Object.prototype.hasOwnProperty.call(state, id) && Number.isInteger(state[id]) && state[id] >= 0;
  // Améliorations faites sur un astre (0 s'il n'est pas acheté).
  const done = (state, id) => (owned(state, id) ? Math.min(state[id], BY_ID[id].ups.length) : 0);
  // La prochaine amélioration d'un astre acheté (dans l'ordre), ou null.
  function next(state, id) {
    if (!owned(state, id)) return null;
    return BY_ID[id].ups[done(state, id)] || null;
  }
  // Nombre d'astres achetés.
  const count = (state) => BODIES.filter((b) => owned(state, b.id)).length;

  // La prochaine étape d'un astre et si on peut la payer : { ok, kind: 'buy' | 'up', cost, lvl, up, reason, short }.
  // lvl : niveau du créateur ; dust : ses poussières d'étoiles.
  function check(state, id, lvl, dust) {
    const b = BY_ID[id];
    if (!b) return { ok: false, reason: tr('Astre inconnu.') };
    const short = (cost) => tr('Il vous manque {n} poussières d’étoiles.', { n: cost - dust });
    if (!owned(state, id)) {
      if (dust != null && dust < b.price) return { ok: false, kind: 'buy', cost: b.price, lvl: 1, short: true, reason: short(b.price) };
      return { ok: true, kind: 'buy', cost: b.price, lvl: 1 };
    }
    const up = next(state, id);
    if (!up) return { ok: false, kind: 'up', done: true, reason: tr('Toutes ses améliorations sont faites.') };
    if (lvl != null && lvl < up.lvl) return { ok: false, kind: 'up', up, cost: up.price, lvl: up.lvl, reason: tr('Atteignez le niveau {n}.', { n: up.lvl }) };
    if (dust != null && dust < up.price) return { ok: false, kind: 'up', up, cost: up.price, lvl: up.lvl, short: true, reason: short(up.price) };
    return { ok: true, kind: 'up', up, cost: up.price, lvl: up.lvl };
  }
  // Achète l'astre ou sa prochaine amélioration si c'est permis ; renvoie le résultat de check.
  function apply(state, id, lvl, dust) {
    const r = check(state, id, lvl, dust);
    if (r.ok) state[id] = r.kind === 'buy' ? 0 : done(state, id) + 1;
    return r;
  }

  // Apparence pour le moteur (stage.register) avec n améliorations faites.
  function look(id, n) {
    const b = BY_ID[id];
    if (!b) return null;
    const l = Object.assign({ full: true, plain: true, light: LIGHT, moons: 0, ring: false, debris: false, shell: false, facet: 'off', shape: 'aucune' }, b.base);
    for (const u of b.ups.slice(0, clampN(b, n || 0))) Object.assign(l, u.fx);
    return l;
  }
  // Taille de l'astre (rayon, votre planète vaut 1) avec n améliorations faites.
  function size(id, n) {
    const b = BY_ID[id];
    if (!b) return 1;
    return b.ups.slice(0, clampN(b, n || 0)).reduce((s, u) => s + (u.grow || 0), b.size);
  }

  // Les améliorations qui s'ouvrent à un niveau, pour les astres déjà achetés (passage de niveau).
  function unlocks(state, lvl) {
    const out = [];
    for (const b of BODIES) if (owned(state, b.id)) for (const u of b.ups.slice(done(state, b.id))) if (u.lvl === lvl) out.push({ body: b, up: u });
    return out;
  }

  // Profil public (js/online.js, dans forge.astres) : { mercure: n, lune: n, … }, astres achetés seulement.
  const publish = (state) => sanitize(state);
  // Lecture du profil d'un autre joueur : on ne garde que des entiers bornés des astres connus.
  function fromPublic(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    for (const b of BODIES) {
      if (!Object.prototype.hasOwnProperty.call(obj, b.id)) continue;
      const v = obj[b.id];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0) out[b.id] = Math.min(v, b.ups.length);
    }
    return out;
  }

  root.OrbiteSysteme = { KEY, BODIES, BY_ID, sanitize, owned, done, next, count, check, apply, look, size, unlocks, publish, fromPublic };
})(typeof window !== 'undefined' ? window : globalThis);
