/* ORBITE — la Genèse, ère II, chapitre 2 « Le Cœur ». L'astre, vu en coupe, fond de l'intérieur.
 * Chaque case de la coupe porte une matière et une température. Le joueur chauffe au doigt ; la
 * chaleur se répand et se perd par la surface ; les éléments radioactifs chauffent seuls, et les
 * lunes (marées) aussi. Là où la matière a fondu, la plus dense coule vers le centre :
 * le fer forme le noyau, la roche le manteau, la glace et le gaz remontent. Trop de chaleur près
 * de la surface : la croûte se brise en volcans. Le bilan (noyau, croûte, eau, air) prépare la
 * suite. Règles pures et déterministes (graine), testées sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteCoeur = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const N = 64; // la coupe : N × N cases
  const RB = 29; // rayon de l'astre, en cases
  // Matières : 0 vide, 1 gaz, 2 glace, 3 roche, 4 fer, 5 radioactif.
  const GAZ = 1, GLACE = 2, ROCHE = 3, FER = 4, RADIO = 5;
  const NAMES = ['vide', 'gaz', 'glace', 'roche', 'fer', 'radio'];
  const DENS = [0, 1, 2, 3, 5, 6];
  const MELT = [0, 0, 10, 32, 42, 42]; // au-dessus, la matière coule
  const TMAX = 120;
  const ENERGY = 100; // chaleur que le doigt peut apporter
  const BRUSH = 3.5; // rayon du pinceau de chaleur, en cases
  const ERUPT = 88; // au-delà, près de la surface : éruption, ébullition ou fuite du gaz
  const SCORE_END = 0.5; // différenciation à atteindre pour pouvoir terminer

  // ─── Hasard déterministe ────────────────────────────────────
  function rand(c) {
    c.rs = (c.rs + 0x6D2B79F5) >>> 0;
    let t = c.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ─── La forme : un rocher encore irrégulier ────────────────
  function geometry(seed) {
    const ph = [seed % 628 / 100, (seed >> 4) % 628 / 100, (seed >> 8) % 628 / 100];
    const edge = (a) => RB * (1 + 0.07 * Math.sin(2 * a + ph[0]) + 0.05 * Math.sin(3 * a + ph[1]) + 0.03 * Math.sin(5 * a + ph[2]));
    const c = (N - 1) / 2;
    const inside = new Uint8Array(N * N), dist = new Float32Array(N * N), rel = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), e = edge(Math.atan2(dy, dx));
      const i = y * N + x;
      dist[i] = d;
      rel[i] = d / e; // 0 au centre, 1 au bord
      if (d <= e) inside[i] = 1;
    }
    // Pour chaque case : la voisine la plus proche du centre (la gravité tire vers elle), et si la
    // case touche le vide (surface).
    // Jusqu'à trois voisines plus proches du centre : la matière qui coule peut passer d'un chemin
    // à l'autre (sinon chaque colonne se trierait seule).
    const inward = new Int32Array(N * N * 3).fill(-1), surface = new Uint8Array(N * N), cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      if (!inside[i]) continue;
      cells.push(i);
      const cand = [];
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const xx = x + ox, yy = y + oy;
        if (xx < 0 || yy < 0 || xx >= N || yy >= N) { surface[i] = 1; continue; }
        const j = yy * N + xx;
        if (!inside[j]) { if (!ox || !oy) surface[i] = 1; continue; }
        if (dist[j] < dist[i] - 0.3) cand.push([dist[j], j]);
      }
      cand.sort((p, q) => p[0] - q[0]);
      cand.slice(0, 3).forEach(([, j], k) => { inward[i * 3 + k] = j; });
    }
    return { inside, dist, rel, inward, surface, cells };
  }

  // ─── Nouveau chapitre ───────────────────────────────────────
  // from : le bilan de l'Essaim { comp, trait, trait1, moons, heat }.
  function newGame(seed, from) {
    from = from || {};
    const geo = geometry(seed >>> 0);
    const c = {
      v: 1, seed: seed >>> 0, rs: (seed ^ 0xC0E0B0A5) >>> 0, t: 0,
      geo, mat: new Uint8Array(N * N), temp: new Float32Array(N * N),
      energy: ENERGY + (from.trait1 === 'adaptable' ? 30 : 0),
      moons: Math.min(8, from.moons | 0), trait: from.trait || 'adaptable',
      erupted: new Uint8Array(N * N), stats: { eruptions: 0, steam: 0, escape: 0, heatGiven: 0 },
      tideAt: 0, done: false, events: []
    };
    // Composition : celle de l'astre, avec un minimum de fer et de roche (et un peu de radioactif).
    const comp = Object.assign({ glace: 0.25, roche: 0.45, gaz: 0.1, fer: 0.2 }, from.comp || {});
    let tot = (comp.glace || 0) + (comp.roche || 0) + (comp.gaz || 0) + (comp.fer || 0) || 1;
    let w = { glace: comp.glace / tot, roche: comp.roche / tot, gaz: comp.gaz / tot, fer: comp.fer / tot };
    w.fer = Math.max(0.14, w.fer); w.roche = Math.max(0.3, w.roche); w.gaz = Math.min(0.12, w.gaz);
    tot = w.glace + w.roche + w.gaz + w.fer;
    for (const k in w) w[k] /= tot;
    // L'astre est un mélange : la matière y est encore répartie au hasard.
    for (const i of geo.cells) {
      const u = rand(c);
      let m = u < w.fer ? FER : u < w.fer + w.roche ? ROCHE : u < w.fer + w.roche + w.glace ? GLACE : GAZ;
      if (rand(c) < 0.018) m = RADIO;
      c.mat[i] = m;
      // Chaleur de départ : les impacts de l'Essaim ont réchauffé le cœur.
      const hot = Math.min(22, (from.heat || 0) / 60);
      c.temp[i] = 14 + hot * (1 - geo.rel[i]) + rand(c) * 4;
    }
    return c;
  }

  // ─── Une étape ──────────────────────────────────────────────
  // input : { x, y } case visée (coordonnées de la coupe, flottantes), heat : doigt posé.
  function step(c, dt, input) {
    if (c.done) return c.events;
    input = input || {};
    c.t += dt;
    const { cells, surface, inward, inside } = c.geo;
    const T = c.temp, M = c.mat;
    // Le doigt chauffe, tant qu'il reste de l'énergie.
    if (input.heat && c.energy > 0 && input.x != null) {
      const x0 = input.x, y0 = input.y, r = BRUSH;
      for (let y = Math.max(0, Math.floor(y0 - r)); y <= Math.min(N - 1, Math.ceil(y0 + r)); y++) {
        for (let x = Math.max(0, Math.floor(x0 - r)); x <= Math.min(N - 1, Math.ceil(x0 + r)); x++) {
          const i = y * N + x, d = Math.hypot(x - x0, y - y0);
          if (!inside[i] || d > r) continue;
          T[i] += 140 * dt * (1 - d / r);
        }
      }
      const spend = 1.4 * dt;
      c.energy = Math.max(0, c.energy - spend);
      c.stats.heatGiven += spend;
    }
    // Radioactivité : chaque grain chauffe ses voisins.
    for (const i of cells) if (M[i] === RADIO) T[i] += 34 * dt;
    // Marées : chaque lune chauffe un point au hasard, de temps en temps.
    if (c.moons) {
      c.tideAt -= dt;
      if (c.tideAt <= 0) {
        c.tideAt = 1.4 / c.moons;
        const i = cells[Math.floor(rand(c) * cells.length)];
        if (c.geo.rel[i] < 0.75) { T[i] += 45; c.events.push({ t: 'tide', i }); }
      }
    }
    // Diffusion de la chaleur, pertes par la surface et un peu partout.
    const k = Math.min(0.45, 7 * dt), next = new Float32Array(T);
    for (const i of cells) {
      let s = 0, n = 0;
      for (const j of [i - 1, i + 1, i - N, i + N]) if (inside[j]) { s += T[j]; n++; }
      if (n) next[i] = T[i] + k * (s / n - T[i]);
      if (surface[i]) next[i] -= 8 * dt;
      next[i] = Math.max(0, Math.min(TMAX, next[i] - 0.3 * dt));
    }
    c.temp.set(next);
    // Tri par densité : là où les deux cases ont fondu, la plus dense prend la place la plus basse.
    const order = Math.floor(rand(c) * cells.length);
    for (let n = 0; n < cells.length; n++) {
      const i = cells[(order + n * 7919) % cells.length];
      let j = inward[i * 3 + Math.floor(rand(c) * 3)];
      if (j < 0) j = inward[i * 3];
      if (j < 0) continue;
      const a = M[i], b = M[j];
      if (DENS[a] <= DENS[b]) continue;
      if (T[i] < MELT[a] || T[j] < MELT[b]) continue;
      if (rand(c) > 0.7) continue;
      M[i] = b; M[j] = a;
    }
    // Surchauffe près de la surface : selon ce qu'il y a là et juste dessous.
    //   roche fondue juste dessous → elle perce la croûte (éruption) ;
    //   glace → elle bout et devient vapeur (l'air y gagne, les océans y perdent) ;
    //   gaz → il s'échappe dans l'espace (l'atmosphère se perd).
    const rel = c.geo.rel;
    for (const i of cells) {
      if (rel[i] < 0.84 || T[i] <= ERUPT) continue;
      const j = inward[i * 3], below = j >= 0 ? M[j] : 0;
      if (M[i] === ROCHE || M[i] === FER || ((below === ROCHE || below === FER) && T[j] > MELT[below])) {
        T[i] -= 45;
        if (j >= 0) T[j] -= 20;
        c.erupted[i] = 1;
        c.stats.eruptions++;
        c.events.push({ t: 'eruption', i });
      } else if (M[i] === GLACE) {
        T[i] -= 40;
        M[i] = GAZ;
        c.stats.steam++;
        c.events.push({ t: 'steam', i });
      } else if (M[i] === GAZ) {
        T[i] -= 40;
        c.stats.escape = (c.stats.escape || 0) + 1;
        c.events.push({ t: 'escape', i });
      }
    }
    return c.events;
  }

  // ─── Mesures ────────────────────────────────────────────────
  // Différenciation : 0 = mélange au hasard, 1 = couches parfaitement rangées (dense au centre).
  // On compte les paires « plus léger plus profond que plus lourd », anneau par anneau.
  function score(c) {
    const { cells, dist } = c.geo, R = Math.ceil(RB * 1.2) + 1;
    const ring = Array.from({ length: R }, () => [0, 0, 0, 0, 0, 0]);
    for (const i of c.geo.cells) ring[Math.min(R - 1, Math.floor(dist[i]))][c.mat[i]]++;
    // Les densités en ordre : gaz, glace, roche, fer, radio (on fond fer et radio, presque égaux).
    const groups = [[GAZ], [GLACE], [ROCHE], [FER, RADIO]];
    let inv = 0, totPairs = 0;
    const below = [0, 0, 0, 0];
    for (let r = 0; r < R; r++) {
      const cnt = groups.map((g) => g.reduce((s, m) => s + ring[r][m], 0));
      // Inversions : une matière ici est plus dense qu'une matière déjà plus profonde.
      for (let a = 0; a < 4; a++) for (let b = 0; b < a; b++) inv += cnt[a] * below[b];
      for (let a = 0; a < 4; a++) below[a] += cnt[a];
    }
    const tot = below.slice();
    for (let a = 0; a < 4; a++) for (let b = 0; b < a; b++) totPairs += tot[a] * tot[b];
    if (!totPairs) return 1;
    // Au hasard, la moitié des paires sont inversées.
    return Math.max(0, Math.min(1, 1 - inv / (totPairs / 2)));
  }
  const meanTemp = (c) => c.geo.cells.reduce((s, i) => s + c.temp[i], 0) / c.geo.cells.length;
  function result(c) {
    const { cells, rel } = c.geo, M = c.mat;
    let fer = 0, ferCore = 0, glace = 0, glaceTop = 0, gaz = 0, gazTop = 0, crust = 0, crustOk = 0;
    for (const i of cells) {
      const m = M[i], r = rel[i];
      if (m === FER || m === RADIO) { fer++; if (r < 0.42) ferCore++; }
      if (m === GLACE) { glace++; if (r > 0.72) glaceTop++; }
      if (m === GAZ) { gaz++; if (r > 0.8) gazTop++; }
      // La croûte : la matière solide du bord (le gaz y forme l'atmosphère, pas la croûte).
      if (r > 0.86 && m !== GAZ) { crust++; if (!c.erupted[i]) crustOk++; }
    }
    const core = fer ? ferCore / fer : 0;
    const ocean = glace ? glaceTop / glace : 0;
    const atmo = gaz ? gazTop / gaz : 0;
    const crustIntact = crust ? crustOk / crust : 0;
    const n = cells.length;
    return {
      score: score(c), core, ocean, atmo, crustIntact, eruptions: c.stats.eruptions,
      field: core >= 0.6 ? 'fort' : core >= 0.35 ? 'faible' : 'aucun',
      crustKind: c.stats.eruptions >= 14 || crustIntact < 0.75 ? 'volcanique' : 'solide',
      water: glace / n >= 0.12 && ocean >= 0.45 ? 'oceans' : glace / n >= 0.12 ? 'glace profonde' : 'sec',
      air: gaz / n >= 0.04 && atmo >= 0.45 && (c.stats.escape || 0) < 60 ? 'primitive' : 'aucune'
    };
  }
  // Fin possible quand les couches sont assez rangées ; fin forcée quand tout a refroidi.
  const canFinish = (c) => score(c) >= SCORE_END;
  const cooled = (c) => c.t > 20 && c.energy <= 0 && meanTemp(c) < 26;

  // ─── Sauvegarde ─────────────────────────────────────────────
  function serialize(c) {
    let mat = '';
    for (const i of c.geo.cells) mat += c.mat[i];
    const temp = c.geo.cells.map((i) => Math.round(c.temp[i])).join(',');
    const er = c.geo.cells.filter((i) => c.erupted[i]).join(',');
    return { v: 1, seed: c.seed, rs: c.rs, t: c.t, energy: c.energy, moons: c.moons, trait: c.trait, stats: c.stats, done: c.done, mat, temp, er };
  }
  function restore(o) {
    if (!o || o.v !== 1) return null;
    const c = newGame(o.seed, {});
    Object.assign(c, { rs: o.rs >>> 0, t: o.t || 0, energy: o.energy, moons: o.moons | 0, trait: o.trait, stats: Object.assign(c.stats, o.stats), done: !!o.done });
    const temps = String(o.temp || '').split(',');
    c.geo.cells.forEach((i, k) => {
      c.mat[i] = Number(o.mat[k]) || ROCHE;
      c.temp[i] = Number(temps[k]) || 14;
    });
    for (const s of String(o.er || '').split(',')) if (s) c.erupted[Number(s)] = 1;
    return c;
  }

  return {
    N, RB, GAZ, GLACE, ROCHE, FER, RADIO, NAMES, DENS, MELT, TMAX, ENERGY, BRUSH, SCORE_END,
    newGame, step, score, meanTemp, result, canFinish, cooled, serialize, restore, geometry
  };
});
