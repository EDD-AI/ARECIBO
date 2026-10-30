/* ORBITE — Mon système (v119) : autour de votre planète, trois astres à acheter puis à améliorer avec
 * les poussières d'étoiles (la Lune, Neptune, le Soleil). Comme pour votre planète, chaque amélioration
 * demande un niveau de créateur et s'achète dans l'ordre. Ce qui est acheté se voit sur l'astre, chez
 * vous (Marché stellaire, onglet Mon système) et chez ceux qui visitent votre système.
 * Règles pures, testables sous Node (comme js/world.js). État local : orbite.systeme = { lune: n, … }
 * (clé absente : astre pas acheté ; n : nombre d'améliorations faites). */
(function (root) {
  'use strict';
  // Traduction (js/i18n.js dans le navigateur) ; sous Node, le français avec ses {variables} remplies.
  const tr = (typeof window !== 'undefined' && window.tr) || ((s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);

  const KEY = 'orbite.systeme';
  // Lumière venue du haut à gauche : une face de nuit reste visible (les lumières de la base lunaire).
  const LIGHT = [-0.62, 0.5, 0.6];

  // Chaque astre : son prix, sa taille (rayon, votre planète vaut 1), son apparence de départ (look du
  // moteur, js/stage.js) et ses améliorations. fx : ce que l'amélioration change dans le look ;
  // grow : de combien l'astre grandit.
  const BODIES = [
    {
      id: 'lune', price: 250, size: 0.42, color: '#d9dde8',
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
      id: 'neptune', price: 500, size: 0.95, color: '#6f9bff',
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
      id: 'soleil', price: 5000, size: 1.4, color: '#f6c453',
      name: tr('Soleil'), text: tr('Une étoile au centre de votre système : tout tourne autour d’elle.'),
      base: { type: 'star', seed: 1040, starClass: 'naine jaune', corona: 0.12 },
      ups: [
        { id: 'couronne', lvl: 30, price: 1500, name: tr('Couronne'), text: tr('Une couronne de flammes l’entoure.'), fx: { corona: 0.55 } },
        { id: 'eruptions', lvl: 50, price: 2500, name: tr('Éruptions'), text: tr('Il grandit et brille plus fort.'), fx: { flare: true }, grow: 0.2 },
        { id: 'geante', lvl: 75, price: 4000, name: tr('Géante bleue'), text: tr('Votre soleil devient une immense géante bleue.'), fx: { starClass: 'géante bleue' }, grow: 0.3 }
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
    const l = Object.assign({ full: true, light: LIGHT, moons: 0, ring: false, debris: false, shell: false, facet: 'off', shape: 'aucune' }, b.base);
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

  // Profil public (js/online.js, dans forge.astres) : { lune: n, neptune: n, soleil: n }, astres achetés seulement.
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
