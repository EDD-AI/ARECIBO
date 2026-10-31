/* ORBITE — Mode classé : 5 parties de placement, puis des points qui montent ou descendent selon la
 * place obtenue. Neuf rangs de Poussière à Singularité, trois divisions (III, II, I) de 100 points
 * chacun, sauf la Singularité. Règles pures, testables sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteClassement = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Traduction (js/i18n.js dans le navigateur) ; sous Node, le français avec ses {variables} remplies.
  const tr = (typeof window !== 'undefined' && window.tr) || ((s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);

  const PLACEMENTS = 5;
  // Points de base gagnés ou perdus selon la place (1re → 8e), puis ajustés selon le niveau de la
  // partie : battre des créateurs mieux classés rapporte plus, perdre contre eux coûte moins.
  const DELTA = [32, 18, 4, -6, -12, -18, -24, -30];
  const ADJ_STEP = 25; // points d'écart avec la moyenne de la partie pour 1 point d'ajustement
  const ADJ_MAX = 8;
  function deltaFor(rank, mine, lobby) {
    const base = DELTA[rank - 1];
    const adj = lobby == null ? 0 : Math.max(-ADJ_MAX, Math.min(ADJ_MAX, Math.round((lobby - mine) / ADJ_STEP)));
    if (rank === 1) return Math.max(10, base + adj);
    if (rank === 2) return Math.max(4, base + adj);
    // Le 3e gagne un peu, ou rien du tout dans une partie plus faible que lui.
    if (rank === 3) return Math.max(0, base + adj);
    return Math.min(-1, base + adj);
  }
  const TIERS = ['Poussière', 'Astéroïde', 'Lune', 'Planète', 'Géante', 'Étoile', 'Nébuleuse', 'Pulsar', 'Singularité'];
  const TIER_SPAN = 300;
  const DIVS = ['III', 'II', 'I'];
  const TOP = (TIERS.length - 1) * TIER_SPAN;

  const fresh = () => ({ placements: [], points: 0, games: 0, best: 0 });
  function sanitize(c) {
    const q = Object.assign(fresh(), c || {});
    q.placements = Array.isArray(q.placements) ? q.placements.filter((r) => r >= 1 && r <= 8).slice(0, PLACEMENTS) : [];
    q.points = Math.max(0, Math.round(Number(q.points) || 0));
    q.games = Math.max(0, q.games | 0);
    q.best = Math.max(q.points, q.best | 0);
    return q;
  }
  const placed = (c) => c.placements.length >= PLACEMENTS;

  // Point de départ après les placements : un rang moyen de 1 vaut Planète I, de 8 vaut zéro.
  function seed(placements) {
    const avg = placements.reduce((s, r) => s + r, 0) / placements.length;
    return Math.max(0, Math.min(1050, Math.round(1100 - avg * 150)));
  }

  // Enregistre une partie classée (rang 1 à 8 ; un abandon compte comme 8e). lobby : moyenne des
  // points des autres créateurs de la partie (null : pas d'ajustement). Renvoie le changement.
  function record(c, rank, lobby) {
    const r = Math.max(1, Math.min(8, rank | 0 || 8));
    const before = placed(c) ? c.points : null;
    c.games++;
    if (!placed(c)) {
      c.placements.push(r);
      if (placed(c)) {
        c.points = seed(c.placements);
        c.best = Math.max(c.best, c.points);
        return { placement: true, done: true, points: c.points, delta: null, tier: tierOf(c.points) };
      }
      return { placement: true, done: false, left: PLACEMENTS - c.placements.length };
    }
    c.points = Math.max(0, c.points + deltaFor(r, c.points, lobby));
    c.best = Math.max(c.best, c.points);
    const t0 = tierOf(before), t1 = tierOf(c.points);
    // up / down : changement de rang ; divUp / divDown : de division (III → II…), rang compris.
    const s0 = step(before), s1 = step(c.points);
    return { placement: false, points: c.points, before, delta: c.points - before, tier: t1, from: t0, up: t1.idx > t0.idx, down: t1.idx < t0.idx, divUp: s1 > s0, divDown: s1 < s0 };
  }

  // L'étape de division : 0 pour Poussière III, 1 pour Poussière II… 24 pour la Singularité.
  function step(points) {
    const t = tierOf(points);
    return t.idx * DIVS.length + (t.div ? DIVS.indexOf(t.div) : 0);
  }

  // ─── Parties qui comptent (v128) ────────────────────────────
  // La recherche classée compte toujours (les places libres y sont tenues par des univers rivaux
  // au bout de 40 s, sans qu'on les choisisse). Une partie entre amis (privée : duel, partie entre
  // amis, mêlée privée) compte aussi, à condition d'y être au moins deux créateurs humains : seul
  // face aux bots qu'on a soi-même choisis, elle ne compte pas.
  const MIN_HUMANS = 2;
  function counts(mode, humans) {
    if (mode === 'ranked') return true;
    return mode === 'private' && (humans | 0) >= MIN_HUMANS;
  }
  // Niveau de la partie pour l'ajustement : la moyenne des points des AUTRES créateurs humains. Les
  // bots n'ont pas de place au salon et n'y entrent jamais (ils ne gonflent ni ne dégonflent les
  // points). null sans autre humain : pas d'ajustement.
  function lobbyOf(seats, me) {
    const others = (Array.isArray(seats) ? seats : []).filter((x) => x && !x.bot && x.uid !== me);
    if (!others.length) return null;
    return Math.round(others.reduce((n, x) => n + Math.max(0, Math.round(Number(x.points) || 0)), 0) / others.length);
  }
  // La place classée d'une partie : un abandon vaut la 8e ; un duel gagné la 2e, perdu la 6e.
  function placeOf(rank, duel, quit) {
    if (quit) return 8;
    if (duel) return rank === 1 ? 2 : 6;
    return Math.max(1, Math.min(8, rank | 0 || 8));
  }

  function tierOf(points) {
    const p = Math.max(0, points | 0);
    if (p >= TOP) return { idx: TIERS.length - 1, name: tr(TIERS[TIERS.length - 1]), div: '', into: p - TOP, span: 0, label: tr(TIERS[TIERS.length - 1]) };
    const idx = Math.floor(p / TIER_SPAN);
    const d = Math.floor((p % TIER_SPAN) / 100);
    const into = p % 100;
    return { idx, name: tr(TIERS[idx]), div: DIVS[d], into, span: 100, label: `${tr(TIERS[idx])} ${DIVS[d]}` };
  }

  return { PLACEMENTS, DELTA, deltaFor, TIERS, TIER_SPAN, DIVS, fresh, sanitize, placed, seed, record, tierOf, step, MIN_HUMANS, counts, lobbyOf, placeOf };
});
