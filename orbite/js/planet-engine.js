/* ORBITE — génome des planètes.
 * Une graine 32 bits donne un système complet et reproductible : astre, palette,
 * nuages, atmosphère, anneaux, ceinture de débris, lunes, effets, nom et fiche.
 * Le rendu est dans planet-renderer.js. Exposé via window.OrbitePlanets. */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;

  // ─── Aléatoire déterministe ────────────────────────────────────
  function hashSeed(seed, salt) {
    let h = (seed >>> 0) ^ Math.imul((salt | 0) + 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return (h ^ (h >>> 16)) >>> 0;
  }

  function hashString(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function makeRng(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      range: (lo, hi) => lo + (hi - lo) * next(),
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      chance: (p) => next() < p,
      pick: (list) => list[Math.floor(next() * list.length)],
      sign: () => (next() < 0.5 ? -1 : 1),
      weighted(list) {
        const total = list.reduce((s, it) => s + it.w, 0);
        let roll = next() * total;
        for (const it of list) {
          roll -= it.w;
          if (roll <= 0) return it;
        }
        return list[list.length - 1];
      }
    };
  }

  // ─── Couleurs (OKLCH → sRGB, rampes à décalage de teinte) ─────
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  function oklchLinear(L, C, h) {
    const a = C * Math.cos(h * DEG), b = C * Math.sin(h * DEG);
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
  }

  const inGamut = (c) => c[0] >= -0.0005 && c[0] <= 1.0005 && c[1] >= -0.0005 && c[1] <= 1.0005 && c[2] >= -0.0005 && c[2] <= 1.0005;

  function oklch(L, C, h) {
    L = clamp(L, 0, 1);
    C = Math.max(0, C);
    h = ((h % 360) + 360) % 360;
    let lin = oklchLinear(L, C, h);
    if (!inGamut(lin)) {
      let lo = 0, hi = C;
      for (let i = 0; i < 16; i++) {
        const mid = (lo + hi) / 2;
        if (inGamut(oklchLinear(L, mid, h))) lo = mid; else hi = mid;
      }
      lin = oklchLinear(L, lo, h);
    }
    return lin.map((v) => Math.round(clamp(toSrgb(clamp(v, 0, 1)), 0, 1) * 255));
  }

  function rgbToOklch(rgb) {
    const r = toLin(rgb[0] / 255), g = toLin(rgb[1] / 255), b = toLin(rgb[2] / 255);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, Math.hypot(A, B), ((Math.atan2(B, A) / DEG) + 360) % 360];
  }

  function hueToward(h, target, amount) {
    const d = ((target - h + 540) % 360) - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), amount);
  }

  // 8 teintes, l'index 4 est la couleur de base éclairée.
  function ramp(L, C, h, o) {
    o = o || {};
    const hs = o.hs == null ? 8 : o.hs;
    const out = [];
    for (let k = 0; k < 8; k++) {
      const s = k - 4;
      const l = s <= 0 ? L * (1 + s * 0.16) : L + (1 - L) * s * 0.24;
      const c = C * (s < 0 ? 1 + s * 0.05 : 1 - s * 0.22);
      const hh = s >= 0 ? hueToward(h, 100, s * hs) : hueToward(h, 285, -s * hs);
      out.push(oklch(clamp(l, 0.08, 0.985), Math.max(0, c), hh));
    }
    return out;
  }

  // Dégradé libre sur 8 teintes à partir de points [L, C, h].
  function gradRamp(stops) {
    const out = [];
    for (let k = 0; k < 8; k++) {
      const t = (k / 7) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(t));
      const f = t - i;
      const a = stops[i], b = stops[i + 1];
      const dh = ((b[2] - a[2] + 540) % 360) - 180;
      out.push(oklch(lerp(a[0], b[0], f), lerp(a[1], b[1], f), a[2] + dh * f));
    }
    return out;
  }

  function cloudRamp(tintH, tintC, shadowH) {
    return [
      oklch(0.26, 0.05, shadowH), oklch(0.36, 0.065, shadowH), oklch(0.5, 0.07, shadowH - 4),
      oklch(0.68, 0.05, shadowH - 10), oklch(0.88, tintC * 0.9, tintH), oklch(0.95, tintC, tintH),
      oklch(0.985, tintC * 0.6, tintH), [255, 255, 255]
    ];
  }

  function rainbowRow(offset, L, C) {
    const row = [];
    for (let k = 0; k < 8; k++) row.push(oklch(L || 0.84, C || 0.11, offset + k * 45));
    return row;
  }

  function basePalette() {
    const grey = ramp(0.6, 0, 0);
    const rows = [];
    for (let i = 0; i < 16; i++) rows.push(grey);
    rows[12] = ramp(0.8, 0.08, 220);
    rows[13] = rainbowRow(0);
    rows[15] = ramp(0.96, 0.02, 95);
    return rows;
  }

  function mapPalette(rows, fn) {
    return rows.map((row) => row.map((c) => {
      const lch = rgbToOklch(c);
      const o = fn(lch[0], lch[1], lch[2]);
      return oklch(o[0], o[1], o[2]);
    }));
  }

  // ─── Matrices 3×3 (ligne par ligne) ─────────────────────────────
  function mul3(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
    return r;
  }
  const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
  const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
  const tiltMatrix = (roll, pitch) => mul3(rotZ(roll), rotX(pitch));
  const column = (m, j) => [m[j], m[3 + j], m[6 + j]];

  // ─── Natures d'astres ─────────────────────────────────────────
  const TYPES = [
    { key: 'terran', label: 'Monde tellurique', w: 12 },
    { key: 'earth', label: 'Monde habitable', w: 6 },
    { key: 'ocean', label: 'Monde océan', w: 9 },
    { key: 'ice', label: 'Monde de glace', w: 9 },
    { key: 'lava', label: 'Monde de lave', w: 8 },
    { key: 'desert', label: 'Monde désertique', w: 8 },
    { key: 'gas', label: 'Géante gazeuse', w: 12 },
    { key: 'moon', label: 'Lune rocheuse', w: 7 },
    { key: 'asteroid', label: 'Astéroïde', w: 5 },
    { key: 'star', label: 'Étoile', w: 7 },
    { key: 'crystal', label: 'Monde cristallin', w: 4 },
    { key: 'toxic', label: 'Monde toxique', w: 5 },
    { key: 'dead', label: 'Planète morte', w: 4 },
    { key: 'portal', label: 'Portail', w: 3 },
    { key: 'blackhole', label: 'Trou noir', w: 3 },
    { key: 'mecha', label: 'Sphère artificielle', w: 2 }
  ];
  const TYPE_BY_KEY = Object.fromEntries(TYPES.map((t) => [t.key, t]));
  const NO_FACET = new Set(['star', 'portal', 'blackhole', 'crystal']);

  // Identifiants des programmes de surface (doivent correspondre au shader).
  const SH = { TERRAN: 0, OCEAN: 1, ICE: 2, LAVA: 3, DESERT: 4, GAS: 5, ROCK: 6, ASTEROID: 7, STAR: 8, CRYSTAL: 9, PORTAL: 10, BLACKHOLE: 11, MECHA: 12 };

  function newBody(shader, r) {
    return {
      shader,
      pal: basePalette(),
      A: [0, 0, 0, 0], B: [0, 0, 0, 0], C: [0, 0, 0, 0], D: [0, 1, 0, 0],
      seed: [r.range(-40, 40), r.range(-40, 40), r.range(-40, 40)],
      facet: 0,
      spinCycles: 1,
      spinOffset: r.range(0, TAU),
      roll: r.range(-0.45, 0.45),
      pitch: r.range(-0.3, 0.3),
      clouds: null, atmo: null, shell: null, corona: null, lens: null,
      size: 0.9,
      bound: 1
    };
  }

  function makeClouds(r, o) {
    o = o || {};
    const storm = r.chance(o.storms == null ? 0.3 : o.storms);
    const lat = r.range(-0.6, 0.6), lon = r.range(0, TAU);
    return {
      mul: r.range(1.035, 1.07),
      A: [r.range(1.1, 1.8), r.range(0.62, 0.74) + (o.cover || 0), r.range(1.7, 2.8), r.range(0.3, 0.45)],
      B: [r.chance(0.3) ? r.range(7, 14) : 0, r.range(0.06, 0.16), r.range(3, 6), r.range(1.2, 2.4)],
      D: storm ? [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), r.range(0.25, 0.5)] : [0, 1, 0, 0],
      seed: [r.range(-40, 40), r.range(-40, 40), r.range(-40, 40)],
      extraCycles: 1
    };
  }

  function makeAtmo(r, o) {
    o = o || {};
    return { w: r.range(0.05, 0.12) * (o.wMul || 1), inner: r.range(0.3, 0.6), pow: r.range(1.5, 2.5), outer: r.range(0.6, 1) };
  }

  function bodyTerran(r, variant) {
    const toxic = variant === 'toxic';
    const ocean = variant === 'ocean' || toxic;
    const b = newBody(ocean ? SH.OCEAN : SH.TERRAN, r);
    const P = b.pal;
    const earth = variant === 'earth' || (variant === 'terran' && r.chance(0.3)) || (variant === 'ocean' && r.chance(0.35));
    let wh, lh, sh;
    if (toxic) { wh = r.pick([128, 142, 112, 160]); lh = r.pick([305, 325, 290, 15]); sh = lh + r.range(10, 40); }
    else if (earth) { wh = r.range(228, 258); lh = r.range(118, 142); sh = r.range(70, 92); }
    else { wh = r.range(0, 360); lh = wh + r.pick([60, 100, 140, 180, 220, 260, 300]) + r.range(-15, 15); sh = lh + r.range(-70, 70); }
    const wc = r.range(0.07, 0.13), lc = r.range(0.1, 0.16), deep = r.range(0.36, 0.44);
    P[0] = ramp(deep, wc * 0.85, wh + 14);
    P[1] = ramp(deep + 0.11, wc, wh);
    P[2] = ramp(deep + 0.23, wc * 0.95, wh - 16);
    P[3] = ramp(r.range(0.8, 0.88), r.range(0.05, 0.09), sh);
    P[4] = ramp(r.range(0.74, 0.83), lc, lh);
    P[5] = ramp(r.range(0.6, 0.68), lc * 0.95, lh + 12);
    P[6] = ramp(r.range(0.5, 0.58), r.range(0.025, 0.06), sh + 15);
    P[7] = ramp(0.95, 0.02, r.range(200, 240));
    P[8] = cloudRamp(r.range(85, 110), r.range(0.01, 0.035), r.range(265, 290));
    P[10] = ramp(0.87, 0.15, r.pick([75, 90, 60]));
    P[11] = ramp(0.4, 0.03, sh);
    P[12] = ramp(0.8, 0.1, wh - 20);
    if (toxic) {
      P[0] = ramp(0.52, 0.16, wh + 10);
      P[1] = ramp(0.66, 0.19, wh);
      P[2] = ramp(0.8, 0.18, wh - 12);
      P[3] = ramp(0.55, 0.05, sh);
      P[4] = ramp(0.45, 0.09, lh);
      P[5] = ramp(0.36, 0.08, lh + 10);
      P[6] = ramp(0.3, 0.04, lh);
      P[7] = ramp(0.75, 0.1, wh);
      P[8] = cloudRamp(wh - 20, 0.09, lh);
      P[12] = ramp(0.75, 0.16, wh);
    }
    b.A = [r.range(1.1, 2.0), r.range(0.3, 0.8), ocean ? r.range(0.6, 0.7) : r.range(0.45, 0.55), r.range(0.76, 0.96)];
    b.B = [r.range(1.25, 1.7), r.range(0.58, 0.75), r.range(5, 10), 0];
    const cities = !toxic && r.chance(earth ? 0.45 : 0.18);
    b.C = [cities ? r.range(0.25, 0.5) : 0, r.range(70, 120), ocean ? r.range(22, 40) : 0, toxic ? 1 : 0];
    b.clouds = r.chance(ocean ? 0.95 : 0.85) ? makeClouds(r, { storms: ocean ? 0.6 : 0.3 }) : null;
    b.atmo = r.chance(0.92) ? makeAtmo(r) : null;
    b.size = ocean ? r.range(0.9, 1) : r.range(0.82, 0.98);
    b.meta = { earth, cities };
    return b;
  }

  function bodyIce(r) {
    const b = newBody(SH.ICE, r);
    const P = b.pal;
    const h = r.chance(0.65) ? r.range(195, 245) : r.pick([330, 300, 170, 270, 20, 150]);
    P[0] = ramp(0.46, 0.1, h + 18);
    P[1] = ramp(0.68, 0.085, h);
    P[2] = ramp(0.84, 0.055, h - 10);
    P[7] = ramp(0.95, 0.022, h - 25);
    P[11] = ramp(0.62, 0.05, h + 8);
    P[8] = cloudRamp(h - 10, 0.02, h + 40);
    P[12] = ramp(0.86, 0.07, h);
    b.A = [r.range(1.4, 2.6), r.range(2.5, 5.5), 0, r.range(0.025, 0.055)];
    b.B = [r.chance(0.5) ? r.range(0.15, 0.35) : 0, r.range(0.53, 0.6), r.range(3, 6), r.range(2.5, 4.5)];
    b.clouds = r.chance(0.35) ? makeClouds(r, { cover: 0.08 }) : null;
    b.atmo = r.chance(0.55) ? makeAtmo(r, { wMul: 0.8 }) : null;
    b.size = r.range(0.78, 0.95);
    return b;
  }

  function bodyLava(r, dead) {
    const b = newBody(SH.LAVA, r);
    const P = b.pal;
    const lh = dead ? r.pick([290, 300, 190, 260]) : r.chance(0.72) ? r.range(25, 50) : r.pick([250, 140, 320, 190]);
    const ch = r.range(0, 360);
    const cc = dead ? 0.012 : 0.03;
    P[5] = ramp(dead ? 0.42 : 0.46, cc, ch);
    P[6] = ramp(dead ? 0.32 : 0.36, cc, ch);
    P[11] = ramp(dead ? 0.24 : 0.27, cc * 0.8, ch);
    P[9] = dead
      ? gradRamp([[0.2, 0.05, lh - 10], [0.36, 0.1, lh], [0.55, 0.13, lh + 10], [0.8, 0.09, lh + 25]])
      : gradRamp([[0.25, 0.09, lh - 15], [0.5, 0.18, lh], [0.72, 0.19, lh + 20], [0.97, 0.06, lh + 60]]);
    P[12] = ramp(dead ? 0.45 : 0.62, dead ? 0.06 : 0.15, lh);
    P[8] = gradRamp([[0.16, 0.02, ch], [0.28, 0.03, ch], [0.42, 0.03, ch], [0.58, 0.025, ch]]);
    b.A = [r.range(1.4, 2.4), r.range(1.4, 3), dead ? r.range(0.2, 0.28) : r.range(0.3, 0.4), dead ? r.range(0.92, 0.95) : r.range(0.88, 0.94)];
    b.B = [r.range(0.3, 0.6), r.range(3, 5), r.range(3, 5), 0];
    b.clouds = !dead && r.chance(0.35) ? makeClouds(r, { cover: 0.06 }) : null;
    b.atmo = !dead && r.chance(0.6) ? makeAtmo(r, { wMul: 0.9 }) : null;
    b.size = r.range(0.75, 0.92);
    return b;
  }

  function bodyDesert(r) {
    const b = newBody(SH.DESERT, r);
    const P = b.pal;
    const h = r.chance(0.6) ? r.range(40, 75) : r.range(0, 360);
    P[3] = ramp(0.86, 0.07, h + 20);
    P[4] = ramp(0.76, 0.12, h);
    P[5] = ramp(0.64, 0.14, h - 15);
    P[6] = ramp(0.5, 0.11, h - 25);
    P[11] = ramp(0.38, 0.08, h - 30);
    P[7] = ramp(0.95, 0.02, 220);
    P[8] = gradRamp([[0.32, 0.05, h - 30], [0.55, 0.07, h - 10], [0.78, 0.07, h], [0.95, 0.03, h + 10]]);
    P[12] = ramp(0.78, 0.08, h + 10);
    b.A = [r.range(1.3, 2.4), r.range(30, 70), r.range(0.9, 0.95), r.range(0.8, 1.2)];
    b.B = [r.chance(0.45) ? r.range(0.15, 0.35) : 0, r.range(3, 5), r.range(3, 6), 0];
    b.clouds = r.chance(0.3) ? makeClouds(r, { cover: 0.12 }) : null;
    b.atmo = r.chance(0.7) ? makeAtmo(r, { wMul: 0.8 }) : null;
    b.size = r.range(0.8, 0.95);
    return b;
  }

  const GAS_SCHEMES = [
    [[0.92, 0.04, 85], [0.8, 0.08, 70], [0.68, 0.12, 52], [0.56, 0.09, 42], [0.74, 0.11, 60], [0.86, 0.06, 78]],
    [[0.88, 0.06, 215], [0.75, 0.1, 228], [0.62, 0.12, 248], [0.5, 0.12, 262], [0.8, 0.08, 205], [0.68, 0.11, 238]],
    [[0.86, 0.1, 175], [0.78, 0.12, 182], [0.68, 0.11, 190], [0.93, 0.05, 168], [0.6, 0.09, 200], [0.82, 0.11, 160]],
    [[0.88, 0.07, 350], [0.76, 0.11, 330], [0.66, 0.12, 310], [0.92, 0.04, 30], [0.7, 0.1, 290], [0.81, 0.1, 5]],
    [[0.9, 0.05, 100], [0.8, 0.09, 120], [0.7, 0.1, 140], [0.6, 0.08, 160], [0.85, 0.07, 95]],
    [[0.84, 0.05, 280], [0.7, 0.09, 290], [0.58, 0.11, 300], [0.92, 0.03, 260], [0.76, 0.07, 270]]
  ];

  function bodyGas(r) {
    const b = newBody(SH.GAS, r);
    const P = b.pal;
    let scheme;
    if (r.chance(0.72)) {
      const shift = r.range(-12, 12);
      scheme = r.pick(GAS_SCHEMES).map((s) => [s[0], s[1], s[2] + shift]);
    } else {
      const h = r.range(0, 360), n = r.int(4, 6);
      scheme = [];
      for (let i = 0; i < n; i++) scheme.push([r.range(0.55, 0.92), r.range(0.04, 0.13), h + r.range(-40, 40)]);
    }
    scheme.forEach((s, i) => { P[i] = ramp(s[0], s[1], s[2]); });
    const base = scheme[0][2];
    const stormH = r.chance(0.5) ? r.range(15, 40) : base + 180;
    P[6] = ramp(0.62, 0.14, stormH);
    P[7] = ramp(0.84, 0.08, stormH + 20);
    P[12] = ramp(0.82, 0.07, base);
    b.A = [r.range(1.2, 2.5), r.range(5, 14), r.range(0.25, 1), 0];
    b.B = [r.int(0, 2), scheme.length, 0, 0];
    if (r.chance(0.45)) {
      const lat = r.range(-0.5, 0.5), lon = r.range(0, TAU);
      b.C = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), r.range(0.18, 0.3)];
    }
    b.spinCycles = 2;
    b.atmo = r.chance(0.5) ? makeAtmo(r, { wMul: 0.7 }) : null;
    b.size = r.range(0.92, 1);
    return b;
  }

  function bodyRock(r) {
    const b = newBody(SH.ROCK, r);
    const P = b.pal;
    const h = r.range(0, 360), c = r.chance(0.6) ? r.range(0.005, 0.03) : r.range(0.03, 0.08);
    P[5] = ramp(0.78, c, h);
    P[6] = ramp(0.64, c, h);
    P[11] = ramp(0.48, c * 1.2, h + 10);
    b.A = [r.range(1.5, 3), r.range(0.35, 0.5), r.range(2.5, 5), r.range(0.35, 0.7)];
    b.B = [r.range(2.2, 3.2), 0, r.range(3, 5), 0];
    b.size = r.range(0.65, 0.82);
    return b;
  }

  function bodyAsteroid(r) {
    const b = newBody(SH.ASTEROID, r);
    const P = b.pal;
    const h = r.range(0, 360), c = r.range(0.01, 0.05);
    P[5] = ramp(0.68, c, h);
    P[6] = ramp(0.55, c, h);
    P[11] = ramp(0.4, c * 1.2, h + 10);
    b.A = [r.range(1.5, 2.5), r.range(0.38, 0.48), r.range(2.5, 4.5), r.range(0.4, 0.7)];
    b.B = [r.range(2.2, 3), 0, r.range(3, 5), 0];
    const ax = [r.range(1, 1.35), r.range(0.68, 0.92), r.range(0.75, 1)];
    const amp = r.range(0.15, 0.3);
    b.C = [ax[0], ax[1], ax[2], 0];
    b.bound = Math.max(ax[0], ax[1], ax[2]) * (1 + amp) + 0.03;
    b.D = [amp, r.range(1.1, 1.8), b.bound, 0];
    b.roll = r.range(-1.2, 1.2);
    b.pitch = r.range(-0.9, 0.9);
    b.spinCycles = 2;
    b.size = r.range(0.5, 0.62);
    return b;
  }

  const STAR_CLASSES = [
    { label: 'naine rouge', w: 2, stops: [[0.32, 0.12, 25], [0.55, 0.19, 35], [0.75, 0.17, 55], [0.95, 0.08, 90]] },
    { label: 'étoile orange', w: 2, stops: [[0.42, 0.14, 40], [0.65, 0.18, 55], [0.84, 0.14, 75], [0.98, 0.05, 100]] },
    { label: 'naine jaune', w: 3, stops: [[0.5, 0.14, 55], [0.74, 0.16, 75], [0.9, 0.12, 95], [0.995, 0.03, 105]] },
    { label: 'étoile blanche', w: 1.5, stops: [[0.55, 0.06, 260], [0.78, 0.05, 240], [0.92, 0.03, 220], [1, 0, 0]] },
    { label: 'géante bleue', w: 1.5, stops: [[0.38, 0.14, 265], [0.6, 0.14, 255], [0.82, 0.09, 235], [0.98, 0.02, 220]] },
    { label: 'étoile exotique', w: 1, stops: null }
  ];

  function bodyStar(r, cls) {
    const b = newBody(SH.STAR, r);
    const star = cls ? STAR_CLASSES.find((s) => s.label === cls) || STAR_CLASSES[2] : r.weighted(STAR_CLASSES);
    let stops = star.stops;
    if (!stops) {
      const h = r.range(0, 360);
      stops = [[0.4, 0.14, h], [0.62, 0.18, h + 15], [0.82, 0.13, h + 35], [0.98, 0.04, h + 60]];
    }
    b.pal[0] = gradRamp(stops);
    b.A = [r.range(1.5, 2.5), r.range(0.66, 0.78), r.range(6, 12), 0];
    b.corona = { len: r.range(0.25, 0.55), freq: r.range(1.5, 3.5), power: r.range(0.9, 1.3) };
    b.size = 1;
    b.meta = { starClass: star.label };
    return b;
  }

  function bodyCrystal(r) {
    const b = newBody(SH.CRYSTAL, r);
    const P = b.pal;
    const o = r.chance(0.55) ? 0 : r.range(0, 360);
    P[0] = ramp(0.62, 0.13, 265 + o);
    P[1] = ramp(0.68, 0.13, 300 + o);
    P[2] = ramp(0.74, 0.12, 345 + o);
    P[3] = ramp(0.88, 0.06, 215 + o);
    P[9] = gradRamp([[0.35, 0.12, 330 + o], [0.6, 0.2, 335 + o], [0.8, 0.16, 350 + o], [0.97, 0.05, 20 + o]]);
    P[12] = ramp(0.85, 0.08, 300 + o);
    b.A = [r.range(3, 6), r.range(0.04, 0.09), r.range(0.04, 0.15), 0];
    b.B = [r.range(0.3, 0.7), 0, 0, 0];
    b.atmo = r.chance(0.4) ? makeAtmo(r, { wMul: 0.7 }) : null;
    b.size = r.range(0.8, 0.95);
    return b;
  }

  function bodyPortal(r) {
    const b = newBody(SH.PORTAL, r);
    const h = r.chance(0.55) ? r.range(225, 260) : r.range(0, 360);
    const Ls = [0.13, 0.2, 0.29, 0.39, 0.5, 0.62, 0.76, 0.92];
    const Cs = [0.04, 0.07, 0.1, 0.13, 0.15, 0.15, 0.13, 0.08];
    b.pal[0] = Ls.map((L, k) => oklch(L, Cs[k], h - k * 3));
    b.A = [r.range(0.5, 0.8), r.range(-0.35, 0.35), r.int(1, 4), r.range(2.5, 6) * r.sign()];
    b.B = [r.range(-0.3, 0.3), r.range(-0.15, 0.15), r.int(1, 2) * r.sign(), 0];
    b.bound = 1.25;
    b.size = 1;
    return b;
  }

  function bodyBlackHole(r) {
    const b = newBody(SH.BLACKHOLE, r);
    const choice = r.int(0, 3);
    const hot = [
      [[0.35, 0.12, 30], [0.62, 0.18, 50], [0.85, 0.13, 80], [0.99, 0.03, 100]],
      [[0.3, 0.1, 270], [0.55, 0.15, 255], [0.8, 0.09, 230], [0.98, 0.02, 210]],
      [[0.3, 0.12, 330], [0.58, 0.18, 345], [0.82, 0.12, 20], [0.98, 0.03, 70]],
      [[0.3, 0.1, 200], [0.6, 0.13, 180], [0.84, 0.1, 150], [0.98, 0.03, 110]]
    ][choice];
    b.pal[9] = gradRamp(hot);
    b.lens = { outer: r.range(1.45, 1.7), cycles: r.int(1, 2) };
    b.disk = { inner: r.range(1.6, 1.95), outer: r.range(3, 3.6), cycles: r.int(1, 2), hot };
    b.pitch = r.sign() * r.range(0.1, 0.26);
    b.roll = r.range(-0.35, 0.35);
    b.size = 0.42;
    return b;
  }

  function bodyMecha(r) {
    const b = newBody(SH.MECHA, r);
    const P = b.pal;
    const h = r.pick([250, 220, 60, 30, 0, 280]), c = r.range(0.015, 0.04);
    P[5] = ramp(0.8, c, h);
    P[6] = ramp(0.66, c, h);
    P[11] = ramp(0.36, c, h);
    const eyeH = r.pick([200, 25, 140, 300]);
    P[9] = gradRamp([[0.3, 0.1, eyeH], [0.6, 0.16, eyeH], [0.85, 0.12, eyeH + 10], [0.99, 0.03, eyeH + 20]]);
    P[10] = ramp(0.86, 0.15, 85);
    const nLon = 2 * r.int(12, 24);
    b.A = [nLon, r.int(12, 22), r.range(0.02, 0.035), 0];
    const lat = r.range(-0.35, 0.35), lon = r.range(0, TAU);
    b.C = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), r.range(0.28, 0.42)];
    b.size = r.range(0.6, 0.75);
    return b;
  }

  function buildBody(key, r, opts) {
    switch (key) {
      case 'earth': return bodyTerran(r, 'earth');
      case 'terran': return bodyTerran(r, 'terran');
      case 'ocean': return bodyTerran(r, 'ocean');
      case 'toxic': return bodyTerran(r, 'toxic');
      case 'ice': return bodyIce(r);
      case 'lava': return bodyLava(r, false);
      case 'dead': return bodyLava(r, true);
      case 'desert': return bodyDesert(r);
      case 'gas': return bodyGas(r);
      case 'moon': return bodyRock(r);
      case 'asteroid': return bodyAsteroid(r);
      case 'star': return bodyStar(r, opts && opts.starClass);
      case 'crystal': return bodyCrystal(r);
      case 'portal': return bodyPortal(r);
      case 'blackhole': return bodyBlackHole(r);
      case 'mecha': return bodyMecha(r);
      default: return bodyRock(r);
    }
  }

  // ─── Anneaux, débris, lunes, décor ────────────────────────────
  function makeRing(r, body, compact) {
    const inner = r.range(1.28, 1.55);
    const outer = inner + r.range(0.35, compact ? 0.5 : 0.95);
    const style = r.int(0, 3);
    let h = r.range(0, 360), C = r.range(0.02, 0.07), L = r.range(0.7, 0.86);
    if (style === 0) { h = r.range(200, 240); C = r.range(0.02, 0.05); L = r.range(0.8, 0.9); }
    else if (style === 1) { h = r.range(55, 85); C = r.range(0.04, 0.08); L = r.range(0.72, 0.84); }
    else if (style === 2) { h = rgbToOklch(body.pal[body.shader === SH.GAS ? 1 : 4][4])[2]; }
    const pal = basePalette();
    pal[0] = ramp(L, C, h);
    pal[1] = ramp(L - 0.08, C * 1.1, h + 12);
    pal[2] = ramp(L + 0.06, C * 0.8, h - 10);
    return { mode: 0, inner, outer, freq: r.range(5, 14), opacity: r.range(0.75, 1), colorFreq: r.range(2.5, 8), seed: r.range(0, 100), cycles: 1, pal };
  }

  function makeDebris(r, inner, outer, o) {
    o = o || {};
    const h1 = o.hue != null ? o.hue : r.range(0, 360);
    const h2 = h1 + r.pick([40, 70, 140, 180]);
    const ramps = o.ramps || [
      ramp(r.range(0.4, 0.55), r.range(0.04, 0.08), h1),
      ramp(r.range(0.55, 0.72), r.range(0.06, 0.12), h2)
    ];
    if (!o.ramps && r.chance(0.4)) ramps.push(ramp(r.range(0.72, 0.85), r.range(0.08, 0.14), r.range(0, 360)));
    const count = Math.round(r.range(o.min || 200, o.max || 520));
    const clumps = [];
    const nClumps = r.int(8, 20);
    for (let i = 0; i < nClumps; i++) clumps.push({ a: r.range(0, TAU), r: r.range(inner, outer), spread: r.range(0.15, 0.6) });
    const base = r.int(2, 3);
    const parts = [];
    for (let i = 0; i < count; i++) {
      let a, rad;
      if (r.chance(0.65)) {
        const c = r.pick(clumps);
        a = c.a + r.range(-1, 1) * c.spread;
        rad = clamp(c.r + r.range(-1, 1) * (outer - inner) * 0.25, inner, outer);
      } else {
        a = r.range(0, TAU);
        rad = r.range(inner, outer);
      }
      const roll = r.next();
      const size = roll < 0.55 ? 1 : roll < 0.85 ? 2 : roll < 0.97 ? 3 : 4;
      parts.push({
        a, r: rad,
        h: r.range(-1, 1) * (o.thick || 0.03),
        size,
        row: r.int(0, ramps.length - 1),
        shade: r.int(2, 5),
        cyc: Math.max(1, Math.round(base * Math.pow(inner / rad, 1.5)))
      });
    }
    return { inner, outer, parts, ramps, dev: r.range(-0.12, 0.12) };
  }

  const MOON_KINDS = [
    { key: 'moon', w: 6 }, { key: 'ice', w: 2.5 }, { key: 'asteroid', w: 2 },
    { key: 'lava', w: 0.8 }, { key: 'terran', w: 0.5 }, { key: 'dead', w: 0.6 }
  ];
  const STAR_PLANETS = [
    { key: 'terran', w: 2 }, { key: 'ice', w: 2 }, { key: 'lava', w: 2 }, { key: 'gas', w: 3 },
    { key: 'desert', w: 2 }, { key: 'moon', w: 1.5 }, { key: 'ocean', w: 1.5 }
  ];

  function makeMoon(r, kind, index, minA, compact, starHost) {
    const b = buildBody(kind, r);
    b.clouds = null; b.atmo = null; b.shell = null; b.corona = null;
    b.A[0] *= 0.65;
    if (b.shader <= SH.OCEAN) b.C[0] = 0;
    b.facet = 0;
    const size = starHost ? r.range(0.08, 0.14) : r.range(0.1, compact ? 0.2 : 0.24);
    const a = minA + size + index * (compact ? 0.16 : 0.38) + r.range(0, compact ? 0.08 : 0.35);
    const M = tiltMatrix(r.range(-0.35, 0.35), r.range(-0.55, 0.55));
    return {
      body: b, kind, size, a,
      U: column(M, 0), V: column(M, 2), N: column(M, 1),
      cycles: a < 2 ? r.int(1, 2) : 1,
      phase0: r.next(),
      trail: !compact && r.chance(0.35),
      M
    };
  }

  const RING_ODDS = {
    terran: [0.12, 0.15], earth: [0.08, 0.12], ocean: [0.1, 0.12], ice: [0.25, 0.2], lava: [0.08, 0.2],
    desert: [0.1, 0.2], gas: [0.6, 0.25], moon: [0.08, 0.25], asteroid: [0, 0.65], star: [0, 0.35],
    crystal: [0.1, 0.5], toxic: [0.12, 0.15], dead: [0.06, 0.4], portal: [0, 0], blackhole: [0, 0], mecha: [0.1, 0.25]
  };

  const BG_THEMES = [
    { w: 5, top: [8, 8, 12], bot: [0, 0, 0], stars: [[255, 255, 255], [207, 216, 255], [255, 233, 196]] },
    { w: 4, top: [30, 23, 34], bot: [20, 15, 24], stars: [[245, 255, 232], [211, 193, 214], [143, 122, 149]] },
    { w: 3, top: [17, 18, 44], bot: [6, 7, 20], stars: [[255, 157, 225], [196, 139, 255], [255, 255, 255]] },
    { w: 2, top: [18, 10, 30], bot: [36, 12, 36], stars: [[255, 179, 230], [255, 255, 255], [224, 140, 255]] },
    { w: 2, top: [5, 12, 16], bot: [1, 3, 6], stars: [[200, 255, 240], [255, 255, 255], [150, 200, 255]] }
  ];

  function makeStarfield(seed, count) {
    const r = makeRng(hashSeed(seed, 5));
    const theme = r.weighted(BG_THEMES);
    const stars = [];
    for (let i = 0; i < (count || 520); i++) {
      const roll = r.next();
      stars.push({
        x: r.next(), y: r.next(),
        kind: roll < 0.82 ? 0 : roll < 0.95 ? 1 : roll < 0.99 ? 2 : 3,
        col: r.int(0, theme.stars.length - 1),
        tw: r.chance(0.3) ? r.int(1, 5) : 0,
        ph: r.next(),
        dim: [0.35, 0.55, 0.75, 1][r.int(0, 3)]
      });
    }
    const nebula = r.chance(0.35) ? { strength: r.range(0.7, 1.1), scale: r.range(1.5, 3.5), thr: r.range(0.55, 0.68), a: r.range(0.06, 0.12), seed: [r.range(-30, 30), r.range(-30, 30), r.range(-30, 30)] } : null;
    return { theme, stars, nebula };
  }

  // ─── Fiche : nom, description, caractéristiques ───────────────
  const SYL_A = ['as', 'ka', 've', 'lu', 'or', 'ze', 'ny', 'ar', 'ce', 'mi', 'to', 'ra', 'xe', 'qu', 'sa', 'ul', 'be', 'dra', 'pho', 'kri', 'tha', 'vor', 'ga', 'sel', 'ty', 'mo', 'ish', 'eo', 'zan', 'ori'];
  const SYL_B = ['tro', 'bo', 'ri', 'no', 'phe', 'ga', 'lis', 'mar', 'dos', 'ten', 'vi', 'rax', 'lu', 'sha', 'dor', 'ka', 'mi', 'ros', 'tis', 'nae', 'ron', 'lia', 'ber', 'su', 'nox', 'dia', 'tar', 'vel', 'qua'];
  const SYL_C = ['s', 'x', 'n', 'r', 'a', 'is', 'on', 'os', 'ia', 'ea', 'us', 'um', 'ar', 'or', 'yx', '', '', 'e'];
  const GREEK = ['ALPHA', 'BÊTA', 'GAMMA', 'DELTA', 'EPSILON', 'ZÊTA', 'THÊTA', 'IOTA', 'KAPPA', 'LAMBDA', 'OMICRON', 'SIGMA', 'TAU', 'OMÉGA'];
  const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'XI'];

  const LORE = {
    terran: {
      places: [['Les montagnes stériles', 1], ['Les forêts du nord', 1], ['Les archipels équatoriaux', 1], ['Les grandes plaines', 1], ['Les côtes brumeuses', 1], ['Le continent austral', 0], ['La ceinture de jungle', 0]],
      beings: ['des troglodytes blancs à quatre pattes', 'un peuple nomade aux yeux phosphorescents', 'des troupeaux de bêtes à six pattes', 'des arbres qui marchent la nuit', 'des oiseaux incapables de voler', 'une civilisation qui vénère les éclipses', 'des colonies de mousses chantantes', 'les ruines d’une colonie humaine'],
      facts: ['Atmosphère respirable.', 'Les saisons y durent onze ans.', 'Des lumières scintillent sur la face nocturne.', 'Les marées y sont violentes.', 'Aucun contact établi.']
    },
    ocean: {
      places: [['Les abysses', 1], ['Les courants chauds', 1], ['Les récifs flottants', 1], ['Les fosses polaires', 1], ['Les lagons', 1], ['L’océan unique', 0]],
      beings: ['des léviathans lents comme des continents', 'des bancs de poissons lumineux', 'des cités de corail vivant', 'des méduses grandes comme des villes', 'un peuple amphibie qui chante sous l’eau', 'des forêts d’algues pensantes'],
      facts: ['Moins de 3 % de terres émergées.', 'Des tempêtes y tournent depuis des siècles.', 'Profondeur moyenne estimée : 140 km.', 'L’eau y est légèrement sucrée.']
    },
    ice: {
      places: [['Les glaciers', 1], ['Les crevasses bleues', 1], ['Les lacs gelés', 1], ['Les plaines de givre', 1], ['Le pôle éternel', 0]],
      beings: ['des mammouths à fourrure argentée', 'des vers des glaces longs de trois kilomètres', 'une station de forage abandonnée', 'des cristaux qui fredonnent la nuit', 'des chasseurs aux lances d’os'],
      facts: ['Un océan liquide dort sous 40 km de glace.', 'Les geysers y projettent de la neige en orbite.', 'Le soleil n’y est qu’une étoile parmi d’autres.']
    },
    lava: {
      places: [['Les fleuves de magma', 1], ['Les cratères actifs', 1], ['Les champs de basalte', 1], ['Les lacs de lave', 1], ['Les cheminées volcaniques', 1]],
      beings: ['des salamandres géantes', 'des créatures de silicium', 'des forges automatiques oubliées', 'des oiseaux de cendre', 'une colonie minière téméraire'],
      facts: ['La surface se renouvelle tous les mille ans.', 'Le ciel y pleut du verre.', 'Éruptions permanentes détectées.']
    },
    dead: {
      places: [['Les plaines grises', 1], ['Les cités éteintes', 1], ['Les fissures froides', 1], ['Le cœur refroidi', 0]],
      beings: ['les ossements d’un peuple disparu', 'des échos qui répètent les mêmes mots', 'des machines arrêtées en plein geste', 'une lueur qui n’appartient à rien'],
      facts: ['Toute vie y a cessé il y a deux millions d’années.', 'Le noyau ne tourne plus.', 'Aucun signal depuis sa mort.']
    },
    desert: {
      places: [['Les dunes rouges', 1], ['Les canyons', 1], ['Les mers de sel', 1], ['Les plateaux arides', 1], ['Les oasis souterraines', 1]],
      beings: ['des vers des sables colossaux', 'des caravanes de marchands nomades', 'des cités enfouies sous le sable', 'des scarabées aux carapaces de miroir', 'un peuple qui ne sort qu’à la nuit tombée'],
      facts: ['Il n’y a pas plu depuis six millénaires.', 'Les tempêtes de sable couvrent parfois toute la planète.', 'Des pyramides de verre affleurent au sud.']
    },
    gas: {
      places: [['Les bandes nuageuses', 1], ['La grande tempête', 0], ['Les couches profondes', 1], ['Les vents équatoriaux', 1], ['Les aurores polaires', 1]],
      beings: ['des baleines aériennes', 'des méduses à hydrogène', 'des stations de pompage automatisées', 'des colonies flottantes', 'des éclairs qui semblent communiquer'],
      facts: ['Vents mesurés à 1 800 km/h.', 'Aucune surface solide.', 'Une tempête y tourne depuis 300 ans.']
    },
    moon: {
      places: [['Les cratères', 1], ['Les mers de poussière', 1], ['Les failles', 1], ['La face cachée', 0], ['Les plaines grises', 1]],
      beings: ['un ancien module d’alunissage', 'des cristaux de quartz géants', 'une base minière silencieuse', 'des empreintes que personne n’explique', 'un écho radio régulier'],
      facts: ['Aucune atmosphère.', 'Toujours la même face tournée vers son astre.', 'Le sol y est plus vieux que le Soleil.']
    },
    asteroid: {
      places: [['Les cavités', 1], ['La surface fracturée', 0], ['Le noyau métallique', 0], ['Les fissures', 1]],
      beings: ['des gisements de platine', 'une sonde encastrée depuis des siècles', 'des bactéries extrêmophiles', 'un ancien avant-poste pirate'],
      facts: ['Rotation chaotique.', 'Valeur minière estimée : colossale.', 'Trop petit pour retenir une atmosphère.']
    },
    star: {
      places: [['La couronne', 0], ['Les éruptions', 1], ['La photosphère', 0], ['Les taches sombres', 1]],
      beings: ['des structures magnétiques géantes', 'des essaims de sondes solaires', 'des tempêtes plus grandes que des planètes', 'un anneau de collecteurs inachevé'],
      facts: ['Âge estimé : 4 milliards d’années.', 'Vent stellaire intense.', 'Plusieurs mondes gravitent autour.']
    },
    crystal: {
      places: [['Les plaques de cristal', 1], ['Les failles lumineuses', 1], ['Le noyau prismatique', 0], ['Les éclats en orbite', 1]],
      beings: ['une résonance qui ressemble à une voix', 'des êtres faits de lumière diffractée', 'des sondes réduites en poussière', 'des reflets qui bougent seuls'],
      facts: ['La lumière y reste piégée des années.', 'Structure d’origine inconnue.', 'Les instruments s’y dérèglent.']
    },
    toxic: {
      places: [['Les mers d’acide', 1], ['Les marais luminescents', 1], ['Les brumes vertes', 1], ['Les récifs corrodés', 1]],
      beings: ['des champignons bioluminescents', 'des créatures à carapace de chitine', 'une usine terraformante devenue folle', 'des nuées de spores dormantes'],
      facts: ['Atmosphère mortelle.', 'Les pluies y dissolvent le métal.', 'Luminescence nocturne visible depuis l’orbite.']
    },
    portal: {
      places: [['Le centre du vortex', 0], ['La bordure instable', 0], ['Le tunnel', 0]],
      beings: ['des signaux venus d’un autre temps', 'des vaisseaux disparus depuis des siècles', 'une lumière qui n’appartient à aucune étoile'],
      facts: ['Distorsion spatio-temporelle confirmée.', 'Aucune sonde n’en est revenue.', 'Ouverture imprévisible.']
    },
    blackhole: {
      places: [['Le disque d’accrétion', 0], ['L’horizon des événements', 0], ['La sphère de photons', 0]],
      beings: ['des étoiles déchiquetées', 'la lumière de mille soleils engloutis', 'une épave figée dans le temps'],
      facts: ['Le temps y ralentit jusqu’à s’arrêter.', 'Ne pas approcher.', 'Même la lumière n’en ressort pas.']
    },
    mecha: {
      places: [['Les tranchées', 1], ['Le grand œil', 0], ['Les panneaux de coque', 1], ['Les hangars', 1]],
      beings: ['des drones de maintenance', 'une intelligence endormie', 'des milliers de capsules cryogéniques', 'un arsenal d’un autre âge'],
      facts: ['Structure entièrement artificielle.', 'Émission radio : une suite de nombres premiers.', 'Origine inconnue.']
    }
  };
  const LORE_ALIAS = { earth: 'terran' };
  const VERBS = [['abritent', 'abrite'], ['cachent', 'cache'], ['accueillent', 'accueille'], ['protègent', 'protège'], ['dissimulent', 'dissimule']];

  const STATS = {
    terran: [5200, 15800, -20, 38], earth: [9000, 14000, -5, 30], ocean: [6000, 21000, 2, 30], ice: [1800, 12000, -230, -60],
    lava: [2400, 11000, 350, 1400], dead: [3000, 9000, -190, -80], desert: [3000, 13000, 20, 85], gas: [38000, 170000, -210, -90],
    moon: [300, 4200, -180, 120], asteroid: [2, 950, -200, -40], star: [200000, 9000000, 2600, 32000], crystal: [900, 7000, -150, 20],
    toxic: [4000, 14000, 30, 140], portal: [40, 900, null, null], blackhole: [8, 300, null, null], mecha: [90, 1200, -120, -20]
  };

  const fmtNum = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  function makeLore(g) {
    const r = makeRng(hashSeed(g.seed, 6));
    const base = r.pick(SYL_A) + r.pick(SYL_B) + (r.chance(0.35) ? r.pick(SYL_B) : '') + r.pick(SYL_C);
    let name = base.toUpperCase();
    const roll = r.next();
    if (roll < 0.45) name += ' ' + r.pick(GREEK);
    else if (roll < 0.7) name += ' ' + r.pick(ROMAN);
    else if (roll < 0.85) name += ' ' + r.pick(['PRIME', 'MINOR', 'MAJOR']);
    if (g.type === 'blackhole') name = 'ABÎME ' + base.toUpperCase();
    if (g.type === 'portal') name = 'ANOMALIE ' + base.toUpperCase();
    const code = 'ARC-' + String(r.int(1000, 9999)) + '-' + 'abcdefgh'[r.int(0, 7)];
    const lore = LORE[LORE_ALIAS[g.type] || g.type] || LORE.terran;
    const place = r.pick(lore.places);
    const verb = r.pick(VERBS)[place[1] ? 0 : 1];
    let desc = place[0] + ' ' + verb + ' ' + r.pick(lore.beings) + '. ' + r.pick(lore.facts);
    if (g.type === 'star' && g.body.meta) desc += ' Type : ' + g.body.meta.starClass + '.';
    const st = STATS[g.type] || STATS.terran;
    const diam = r.range(st[0], st[1]);
    const stats = [];
    if (g.type === 'blackhole') stats.push(['HORIZON', fmtNum(diam) + ' KM']);
    else stats.push(['DIAMÈTRE', fmtNum(diam) + ' KM']);
    if (st[2] != null) stats.push(['TEMPÉRATURE', (g.type === 'star' ? fmtNum(r.range(st[2], st[3])) + ' K' : Math.round(r.range(st[2], st[3])) + ' °C')]);
    if (g.type !== 'portal' && g.type !== 'blackhole' && g.type !== 'star') stats.push(['GRAVITÉ', r.range(0.05, 2.4).toFixed(2) + ' G']);
    stats.push([g.type === 'star' ? 'PLANÈTES' : 'LUNES', String(g.moons.length)]);
    stats.push(['ANNEAUX', g.ring || g.debris ? 'OUI' : 'NON']);
    const signals = [['AUCUN', 45], ['BRUIT DE FOND', 25], ['FAIBLE, IRRÉGULIER', 15], ['RÉGULIER — ARTIFICIEL ?', 10], ['MESSAGE EN BOUCLE', 5]];
    let signal = r.weighted(signals.map((s) => ({ v: s[0], w: g.type === 'mecha' ? (s[1] < 20 ? 30 : 5) : s[1] }))).v;
    stats.push(['SIGNAL', signal]);
    return { name, code, desc, stats };
  }

  // ─── Assemblage du système ───────────────────────────────────
  function computeExtent(g) {
    const b = g.body;
    let ex = b.bound, ey = b.bound;
    const grow = (x, y) => { ex = Math.max(ex, x); ey = Math.max(ey, y); };
    if (b.clouds) grow(b.clouds.mul, b.clouds.mul);
    if (b.atmo) grow(1 + b.atmo.w, 1 + b.atmo.w);
    if (b.shell) grow(b.shell.rs * (1 + b.shell.glow), b.shell.rs * (1 + b.shell.glow));
    if (b.corona) grow(1 + b.corona.len * 1.5, 1 + b.corona.len * 1.5);
    if (b.lens) grow(b.lens.outer, b.lens.outer);
    if (b.shader === SH.PORTAL) grow(1.25 * Math.max(b.A[0], 0.6), 1.25);
    const proj = (rad, N) => [rad * Math.sqrt(Math.max(0, 1 - N[0] * N[0])), rad * Math.sqrt(Math.max(0, 1 - N[1] * N[1]))];
    if (g.ring) { const e = proj(g.ring.outer, g.ringN); grow(e[0], e[1]); }
    if (b.disk) { const e = proj(b.disk.outer, g.ringN); grow(e[0], e[1]); }
    if (g.debris) { const e = proj(g.debris.outer + 0.05, g.debrisN); grow(e[0], e[1]); }
    if (g.fx.shards) grow(1.45, 1.45);
    g.coreExtent = { x: ex, y: ey };
    for (const m of g.moons) { const e = proj(m.a, m.N); grow(e[0] + m.size, e[1] + m.size); }
    for (const s of g.sats) { const e = proj(s.a, s.N); grow(e[0] + 0.05, e[1] + 0.05); }
    g.extent = { x: ex, y: ey };
  }

  function generate(seed, opts) {
    opts = opts || {};
    seed = seed >>> 0;
    const compact = !!opts.compact;
    const def = TYPE_BY_KEY[opts.type] || makeRng(hashSeed(seed, 1)).weighted(TYPES);
    const key = def.key;
    const g = { seed, type: key, label: def.label, compact, moons: [], sats: [], fx: {}, sparkles: [], comets: [] };

    const body = buildBody(key, makeRng(hashSeed(seed, 2)), opts);
    g.body = body;

    const fr = makeRng(hashSeed(seed, 8));
    const facetOn = !NO_FACET.has(key) && (opts.facet === 'on' || (opts.facet !== 'off' && fr.chance(key === 'gas' ? 0.1 : 0.22)));
    body.facet = facetOn ? fr.range(5, 11) : 0;

    const lr = makeRng(hashSeed(seed, 7));
    const crescent = !compact && lr.chance(0.1);
    const la = lr.range(110, 200) * DEG;
    const lz = crescent ? lr.range(-0.05, 0.25) : lr.range(0.42, 0.75);
    const lk = Math.sqrt(1 - lz * lz);
    g.light = [Math.cos(la) * lk, Math.sin(la) * lk, lz];

    // Sur une carte, le trou noir doit rester lisible : disque court et incliné.
    if (body.disk && compact) {
      body.disk.inner = 1.5;
      body.disk.outer = 2.35;
      body.lens.outer = 1.42;
      body.pitch = (body.pitch < 0 ? -1 : 1) * 0.42;
    }

    // Anneaux et débris : il faut incliner l'axe pour que l'ellipse se voie.
    const rr = makeRng(hashSeed(seed, 3));
    const odds = RING_ODDS[key] || [0.1, 0.15];
    const hasRing = opts.ring != null ? !!opts.ring && odds[0] > 0 : rr.chance(odds[0]);
    const hasDebris = opts.debris != null ? !!opts.debris && odds[1] > 0 : rr.chance(odds[1]);
    if ((hasRing || hasDebris) && body.shader !== SH.ASTEROID) body.pitch = rr.sign() * rr.range(0.18, 0.5);
    const M = tiltMatrix(body.roll, body.pitch);
    body.M = M;
    g.ringN = column(M, 1); g.ringU = column(M, 0); g.ringV = column(M, 2);
    let reach = 1.15;
    if (hasRing) {
      g.ring = makeRing(rr, body, compact);
      reach = g.ring.outer + 0.1;
    }
    if (body.disk) {
      const pal = basePalette();
      pal[0] = gradRamp(body.disk.hot);
      g.ring = { mode: 1, inner: body.disk.inner, outer: body.disk.outer, freq: 0, opacity: 1, colorFreq: 0, seed: rr.range(0, 100), cycles: body.disk.cycles, pal };
      reach = body.disk.outer;
    }
    if (hasDebris) {
      const inner = Math.max(reach, key === 'asteroid' ? 1.35 : 1.3) + rr.range(0, 0.15);
      const outer = inner + rr.range(0.2, compact ? 0.35 : 0.6);
      g.debris = makeDebris(rr, inner, outer, { min: key === 'asteroid' ? 120 : 200, max: key === 'asteroid' ? 260 : 520 });
      const DM = mul3(M, rotX(g.debris.dev));
      g.debrisN = column(DM, 1); g.debrisU = column(DM, 0); g.debrisV = column(DM, 2);
      reach = outer + 0.1;
    }

    // Effets propres à certaines natures.
    const xr = makeRng(hashSeed(seed, 9));
    if (key === 'crystal') {
      g.fx.shards = [];
      const n = xr.int(10, 22);
      for (let i = 0; i < n; i++) {
        const SM = tiltMatrix(xr.range(-1.2, 1.2), xr.range(-1, 1));
        g.fx.shards.push({ a: xr.range(1.06, 1.38), U: column(SM, 0), V: column(SM, 2), ph: xr.next(), cyc: xr.int(1, 2), size: xr.pick([1, 1, 2, 3]), row: xr.int(0, 3) });
      }
    }
    if (key === 'portal') {
      g.fx.sparks = [];
      const n = xr.int(18, 34);
      for (let i = 0; i < n; i++) g.fx.sparks.push({ a: xr.range(0, TAU), cyc: xr.int(1, 3), ph: xr.next(), spin: xr.range(0.6, 1.8) * xr.sign(), size: xr.pick([1, 1, 1, 2]) });
    }
    if (key === 'blackhole') {
      g.fx.infall = [];
      const n = xr.int(14, 26);
      for (let i = 0; i < n; i++) g.fx.infall.push({ a: xr.range(0, TAU), cyc: xr.int(1, 2), ph: xr.next(), size: xr.pick([1, 1, 2]) });
    }

    // Lunes (ou planètes autour d'une étoile).
    const mr = makeRng(hashSeed(seed, 4));
    let nMoons;
    if (opts.moons != null) nMoons = opts.moons;
    else if (key === 'portal' || key === 'blackhole') nMoons = 0;
    else if (key === 'star') nMoons = mr.int(0, compact ? 2 : 3);
    else if (key === 'asteroid' || key === 'moon') nMoons = mr.chance(0.3) ? 1 : 0;
    else nMoons = mr.weighted([{ v: 0, w: 30 }, { v: 1, w: 35 }, { v: 2, w: 20 }, { v: 3, w: 10 }, { v: 4, w: 5 }]).v;
    if (compact) nMoons = Math.min(nMoons, 2);
    const minA = Math.max(reach, body.bound + 0.25, body.corona ? 1.5 : 0, body.atmo ? 1.3 : 0);
    for (let i = 0; i < nMoons; i++) {
      const kind = key === 'star' ? mr.weighted(STAR_PLANETS).key : mr.weighted(MOON_KINDS).key;
      g.moons.push(makeMoon(mr, kind, i, minA, compact, key === 'star'));
    }

    // Habillage optionnel.
    const dr = makeRng(hashSeed(seed, 10));
    const shellOk = ['terran', 'earth', 'ocean', 'ice', 'toxic', 'crystal', 'moon', 'desert'].includes(key);
    if (opts.shell === true || (opts.shell == null && shellOk && dr.chance(0.1))) {
      body.shell = { rs: dr.range(1.12, 1.3), rim: dr.range(0.9, 1.4), glow: dr.range(0.06, 0.1), cycles: dr.int(1, 2) };
      body.pal[13] = rainbowRow(dr.range(0, 360));
    }
    if (!compact) {
      const satOdds = key === 'mecha' ? 0.8 : body.meta && body.meta.cities ? 0.4 : 0.06;
      if (dr.chance(satOdds)) {
        const n = dr.int(1, 4);
        for (let i = 0; i < n; i++) {
          const SM = tiltMatrix(dr.range(-0.6, 0.6), dr.range(-0.7, 0.7));
          g.sats.push({ a: Math.max(1.15, body.bound + 0.12) + dr.range(0, 0.35), U: column(SM, 0), V: column(SM, 2), N: column(SM, 1), cyc: dr.int(2, 4), ph: dr.next(), panel: oklch(0.62, 0.12, dr.pick([250, 220, 280])) });
        }
      }
      if (dr.chance(0.3)) {
        const n = dr.int(3, 8);
        for (let i = 0; i < n; i++) g.sparkles.push({ a: dr.range(0, TAU), r: dr.range(1.25, 2.3), cyc: dr.int(1, 3), ph: dr.next(), col: oklch(0.95, 0.06, dr.pick([95, 330, 200])) });
      }
      if (dr.chance(0.35)) {
        g.comets.push({ ang: dr.range(0, TAU), dir: dr.range(-0.5, 0.5), t0: dr.next(), dur: dr.range(0.12, 0.22), len: dr.int(18, 40), rainbow: dr.chance(0.45), front: dr.chance(0.4), hue: dr.range(0, 360) });
      }
      if (dr.chance(0.25)) {
        const kind = dr.weighted([{ key: 'moon', w: 2 }, { key: 'ice', w: 2 }, { key: 'gas', w: 2 }, { key: 'terran', w: 1 }]).key;
        const fb = buildBody(kind, dr);
        fb.clouds = null; fb.atmo = null; fb.A[0] *= 0.6;
        g.far = { body: fb, x: dr.chance(0.5) ? dr.range(0.1, 0.22) : dr.range(0.78, 0.9), y: dr.chance(0.5) ? dr.range(0.18, 0.3) : dr.range(0.7, 0.82), size: dr.range(0.07, 0.12) };
      }
    }

    // Transformations de palette demandées par le jeu.
    // L'Envers : ombres bleu ardoise, lumières rouges, comme un monde retourné.
    if (opts.mood === 'envers') applyMood(g, (L, C, h) => (L < 0.52 ? [L * 0.8, C * 0.45 + 0.025, hueToward(h, 250, 120)] : [L * 0.92, C * 0.7 + 0.06, hueToward(h, 18, 140)]));
    if (opts.hueShift) applyMood(g, (L, C, h) => [L, C, h + opts.hueShift]);

    // Options de décor : pas de calottes polaires, éclairage imposé.
    if (opts.caps === false && body.shader <= SH.OCEAN) body.A[3] = 3;
    if (opts.light) {
      const l = Math.hypot(opts.light[0], opts.light[1], opts.light[2]) || 1;
      g.light = opts.light.map((v) => v / l);
    }

    computeExtent(g);
    g.size = body.size;
    if (!compact) Object.assign(g, makeLore(g));
    return g;
  }

  function applyMood(g, fn) {
    const bodies = [g.body].concat(g.moons.map((m) => m.body));
    for (const b of bodies) b.pal = mapPalette(b.pal, fn);
    if (g.ring) g.ring.pal = mapPalette(g.ring.pal, fn);
    if (g.debris) g.debris.ramps = mapPalette(g.debris.ramps, fn);
  }

  function accentOf(g) {
    const P = g.body.pal;
    switch (g.body.shader) {
      case SH.STAR: case SH.PORTAL: return P[0][6];
      case SH.BLACKHOLE: return P[9][6];
      case SH.GAS: return P[0][5];
      case SH.LAVA: return P[9][6];
      case SH.CRYSTAL: return P[2][5];
      case SH.ICE: return P[2][5];
      case SH.ROCK: case SH.ASTEROID: case SH.MECHA: return P[5][5];
      case SH.DESERT: return P[4][5];
      default: return P[4][6];
    }
  }

  root.OrbitePlanets = Object.assign(root.OrbitePlanets || {}, {
    TAU, TYPES, TYPE_BY_KEY, SH, STAR_CLASSES,
    hashSeed, hashString, makeRng,
    oklch, ramp, gradRamp, rgbToOklch, mapPalette, basePalette,
    tiltMatrix, column, mul3, rotX, rotZ,
    generate, makeStarfield, accentOf
  });
})(typeof window !== 'undefined' ? window : globalThis);
