/* ORBITE — la Genèse, ère II, chapitre 3 « La Sculpture » (l'éditeur de Spore, appliqué à un astre).
 * L'astre est une carte de hauteurs sur la sphère (longitude × latitude), en deux couches :
 *   - la forme : les grosses bosses du rocher, qui font sa silhouette ; la gravité (et l'outil
 *     Lisser) l'arrondit : c'est le passage du rocher à la planète ;
 *   - le relief : ce qu'on y sculpte (bassins, montagnes, volcans).
 * Une couche de matière (glace, lave) s'y ajoute. Les objectifs dépendent des chapitres passés.
 * Règles pures et déterministes (graine), testées sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteSculpture = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 128, H = 64; // carte équirectangulaire
  const SEA = -0.1; // sous ce relief : un bassin (où l'eau ou la lave s'accumule)
  const PEAK = 0.12; // au-dessus : une montagne
  const ROUND_GOAL = 0.85;
  const TOOLS = ['tourner', 'impact', 'soulever', 'lisser', 'volcan', 'glace'];
  const NONE = 0, ICE = 1, LAVA = 2;

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Coordonnées : case (i, j) ↔ longitude, latitude, et vecteur unitaire.
  const lonOf = (i) => ((i + 0.5) / W) * Math.PI * 2 - Math.PI;
  const latOf = (j) => Math.PI / 2 - ((j + 0.5) / H) * Math.PI;
  function vec(lon, lat) { const c = Math.cos(lat); return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)]; }
  const VEC = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) VEC.push(vec(lonOf(i), latOf(j)));
  // Poids de chaque case (les cases près des pôles sont plus petites).
  const AREA = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) AREA.push(Math.cos(latOf(j)));
  const AREA_SUM = AREA.reduce((s, a) => s + a, 0);

  // ─── Nouveau chapitre ───────────────────────────────────────
  // from : { nature (ère I), core (bilan du Cœur : field, crustKind, water, air), seed }.
  function newGame(seed, from) {
    from = from || {};
    const r = rng(seed ^ 0x5C0FFEE);
    const s = {
      v: 1, seed: seed >>> 0, t: 0,
      forme: new Float32Array(W * H), relief: new Float32Array(W * H), mat: new Uint8Array(W * H),
      volcans: [], nature: from.nature || 'vie',
      core: Object.assign({ field: 'faible', crustKind: 'solide', water: 'sec', air: 'aucune' }, from.core || {}),
      done: false, events: []
    };
    // La forme : quelques grosses bosses (le rocher n'est pas encore rond).
    const lumps = Array.from({ length: 7 }, () => ({ v: vec(r() * 6.28 - 3.14, Math.asin(r() * 2 - 1)), a: (r() - 0.4) * 0.5, w: 0.6 + r() * 0.7 }));
    // Le relief : des cratères anciens, peu profonds.
    const craters = Array.from({ length: 22 }, () => ({ v: vec(r() * 6.28 - 3.14, Math.asin(r() * 2 - 1)), rad: 0.08 + r() * 0.16, d: 0.02 + r() * 0.05 }));
    for (let k = 0; k < W * H; k++) {
      const p = VEC[k];
      let f = 0;
      for (const l of lumps) { const ang = Math.acos(Math.max(-1, Math.min(1, dot(p, l.v)))); f += l.a * Math.exp(-(ang * ang) / (l.w * l.w)); }
      s.forme[k] = f;
      let h = 0;
      for (const c of craters) {
        const ang = Math.acos(Math.max(-1, Math.min(1, dot(p, c.v)))), x = ang / c.rad;
        if (x < 1.4) h += x < 1 ? -c.d * (1 - x * x) : c.d * 0.5 * (1.4 - x) / 0.4;
      }
      s.relief[k] = h;
    }
    s.forme0 = std(s.forme);
    return s;
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function std(arr) {
    let m = 0;
    for (let k = 0; k < arr.length; k++) m += arr[k] * AREA[k];
    m /= AREA_SUM;
    let v = 0;
    for (let k = 0; k < arr.length; k++) v += (arr[k] - m) * (arr[k] - m) * AREA[k];
    return Math.sqrt(v / AREA_SUM);
  }

  // ─── Outils ─────────────────────────────────────────────────
  // Applique `fn(k, w)` à chaque case dans un rayon angulaire `rad` autour du point (lon, lat).
  function brush(lon, lat, rad, fn) {
    const c = vec(lon, lat), cr = Math.cos(rad);
    for (let k = 0; k < W * H; k++) {
      const d = dot(VEC[k], c);
      if (d < cr) continue;
      const ang = Math.acos(Math.min(1, d));
      fn(k, ang / rad);
    }
  }
  const avail = (s) => ({
    tourner: true, impact: true, soulever: true, lisser: true,
    volcan: s.core.crustKind === 'volcanique' || s.nature === 'feu' || s.volcans.length < 2,
    glace: s.core.water !== 'sec' || s.nature === 'eau'
  });
  // Un geste d'outil : tap (impact, volcan) ou maintenu (soulever, lisser, glace : dt > 0).
  function apply(s, tool, lon, lat, dt) {
    if (s.done || !avail(s)[tool]) return false;
    if (tool === 'impact') {
      // Cratère : un creux et un bourrelet ; un gros impact devient un bassin.
      const rad = 0.3;
      brush(lon, lat, rad * 1.45, (k, x) => {
        const xx = x * 1.45;
        s.relief[k] = Math.max(-0.5, s.relief[k] + (xx < 1 ? -0.2 * (1 - xx * xx) : 0.05 * (1.45 - xx) / 0.45));
        if (s.mat[k] === ICE && xx < 1) s.mat[k] = NONE;
      });
      s.events.push({ t: 'impact', lon, lat });
    } else if (tool === 'soulever') {
      brush(lon, lat, 0.2, (k, x) => { s.relief[k] = Math.min(0.4, s.relief[k] + 0.32 * dt * (1 - x * x)); });
    } else if (tool === 'lisser') {
      // La gravité rapproche la forme de la sphère et adoucit le relief extrême.
      brush(lon, lat, 0.55, (k, x) => {
        const f = Math.min(1, 1.6 * dt * (1 - x * 0.7));
        s.forme[k] *= 1 - f;
        s.relief[k] *= 1 - f * 0.08;
      });
    } else if (tool === 'volcan') {
      brush(lon, lat, 0.16, (k, x) => {
        s.relief[k] = Math.min(0.42, s.relief[k] + (x < 0.25 ? 0.12 : 0.26 * (1 - x)));
        if (x < 0.3) s.mat[k] = LAVA;
      });
      s.volcans.push([lon, lat]);
      s.events.push({ t: 'volcan', lon, lat });
    } else if (tool === 'glace') {
      brush(lon, lat, 0.18, (k, x) => { if (x < 0.9 && s.relief[k] + s.forme[k] > SEA - 0.05) s.mat[k] = ICE; });
    } else return false;
    return true;
  }
  // La gravité arrondit lentement l'astre, même sans rien faire.
  function step(s, dt) {
    if (s.done) return s.events;
    s.t += dt;
    const f = 1 - 0.004 * dt;
    for (let k = 0; k < W * H; k++) s.forme[k] *= f;
    return s.events;
  }

  // ─── Mesures ────────────────────────────────────────────────
  const roundness = (s) => Math.max(0, Math.min(1, 1 - std(s.forme) / Math.max(0.05, s.forme0)));
  // Régions connexes (en tenant compte du tour de la longitude) où test(k) est vrai : leurs aires.
  function regions(s, test) {
    const seen = new Uint8Array(W * H), out = [];
    for (let k = 0; k < W * H; k++) {
      if (seen[k] || !test(k)) continue;
      let area = 0;
      const stack = [k];
      seen[k] = 1;
      while (stack.length) {
        const q = stack.pop();
        area += AREA[q];
        const i = q % W, j = (q - i) / W;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const jj = j + dj;
          if (jj < 0 || jj >= H) continue;
          const n = jj * W + ((i + di + W) % W);
          if (!seen[n] && test(n)) { seen[n] = 1; stack.push(n); }
        }
      }
      out.push(area / AREA_SUM);
    }
    return out;
  }
  const basins = (s) => regions(s, (k) => s.relief[k] < SEA).filter((a) => a >= 0.008).length;
  const mountains = (s) => regions(s, (k) => s.relief[k] > PEAK).reduce((t, a) => t + a, 0);
  const iceCover = (s) => { let a = 0; for (let k = 0; k < W * H; k++) if (s.mat[k] === ICE) a += AREA[k]; return a / AREA_SUM; };
  // Objectifs : trois communs, un selon le chemin.
  function goals(s) {
    const g = [
      { id: 'rond', text: 'Arrondir votre astre', value: roundness(s), goal: ROUND_GOAL, pct: true },
      { id: 'bassins', text: 'Creuser deux bassins', value: basins(s), goal: 2 },
      { id: 'montagnes', text: 'Dresser des montagnes', value: Math.round(mountains(s) * 1000) / 10, goal: 3, unit: '%' }
    ];
    if (s.core.crustKind === 'volcanique' || s.nature === 'feu') g.push({ id: 'volcans', text: 'Allumer trois volcans', value: s.volcans.length, goal: 3 });
    else if (s.core.water !== 'sec' || s.nature === 'eau') g.push({ id: 'glace', text: 'Poser des calottes de glace', value: Math.round(iceCover(s) * 1000) / 10, goal: 3, unit: '%' });
    else g.push({ id: 'volcans', text: 'Allumer un volcan', value: s.volcans.length, goal: 1 });
    for (const x of g) x.ok = x.value >= x.goal;
    return g;
  }
  const canFinish = (s) => goals(s).every((x) => x.ok);
  // Ce que le monde emporte vers la suite.
  function result(s) {
    return {
      roundness: roundness(s), basins: basins(s), mountains: mountains(s), ice: iceCover(s), volcans: s.volcans.length,
      seas: s.core.water === 'oceans' ? 'eau' : s.core.crustKind === 'volcanique' ? 'lave' : 'secs'
    };
  }
  // Hauteur totale d'une case (forme + relief), pour le dessin.
  const height = (s, k) => s.forme[k] + s.relief[k];

  // ─── Sauvegarde : chaque couche en octets ───────────────────
  const enc = (arr, lo, hi) => { let o = ''; for (let k = 0; k < arr.length; k++) o += String.fromCharCode(Math.max(0, Math.min(255, Math.round((arr[k] - lo) / (hi - lo) * 255))) + 0x100); return o; };
  const dec = (str, lo, hi, out) => { for (let k = 0; k < out.length; k++) out[k] = lo + ((str.charCodeAt(k) - 0x100) / 255) * (hi - lo); };
  function serialize(s) {
    let mat = '';
    for (let k = 0; k < W * H; k++) mat += s.mat[k];
    return { v: 1, seed: s.seed, t: s.t, nature: s.nature, core: s.core, volcans: s.volcans, forme0: s.forme0, done: s.done, forme: enc(s.forme, -0.6, 0.6), relief: enc(s.relief, -0.5, 0.5), mat };
  }
  function restore(o) {
    if (!o || o.v !== 1) return null;
    const s = newGame(o.seed, { nature: o.nature, core: o.core });
    Object.assign(s, { t: o.t || 0, volcans: o.volcans || [], forme0: o.forme0 || s.forme0, done: !!o.done });
    dec(o.forme, -0.6, 0.6, s.forme);
    dec(o.relief, -0.5, 0.5, s.relief);
    for (let k = 0; k < W * H; k++) s.mat[k] = Number(o.mat[k]) || 0;
    return s;
  }

  return {
    W, H, SEA, PEAK, ROUND_GOAL, TOOLS, NONE, ICE, LAVA, VEC,
    newGame, apply, step, avail, roundness, basins, mountains, iceCover, goals, canFinish, result, height, lonOf, latOf, vec, serialize, restore
  };
});
