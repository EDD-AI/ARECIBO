/* ORBITE — Mode classé : 5 parties de placement, puis des points qui montent ou descendent selon la
 * place obtenue. Neuf rangs de Poussière à Singularité, trois divisions (III, II, I) de 100 points
 * chacun, sauf la Singularité. Règles pures, testables sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteClassement = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PLACEMENTS = 5;
  // Points gagnés ou perdus selon la place (1re → 8e).
  const DELTA = [40, 28, 16, 6, -6, -14, -22, -30];
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

  // Enregistre une partie classée (rang 1 à 8 ; un abandon compte comme 8e). Renvoie le changement.
  function record(c, rank) {
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
    c.points = Math.max(0, c.points + DELTA[r - 1]);
    c.best = Math.max(c.best, c.points);
    const t0 = tierOf(before), t1 = tierOf(c.points);
    return { placement: false, points: c.points, delta: c.points - before, tier: t1, up: t1.idx > t0.idx, down: t1.idx < t0.idx };
  }

  function tierOf(points) {
    const p = Math.max(0, points | 0);
    if (p >= TOP) return { idx: TIERS.length - 1, name: TIERS[TIERS.length - 1], div: '', into: p - TOP, span: 0, label: TIERS[TIERS.length - 1] };
    const idx = Math.floor(p / TIER_SPAN);
    const d = Math.floor((p % TIER_SPAN) / 100);
    const into = p % 100;
    return { idx, name: TIERS[idx], div: DIVS[d], into, span: 100, label: `${TIERS[idx]} ${DIVS[d]}` };
  }

  return { PLACEMENTS, DELTA, TIERS, TIER_SPAN, fresh, sanitize, placed, seed, record, tierOf };
});
