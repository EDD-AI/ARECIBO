/* ORBITE — emblèmes des rangs classés (v128). Un insigne en pixels pour chacun des neuf rangs, de la
 * Poussière à la Singularité : un médaillon dont le métal et l'ornement montent avec le rang (ailes
 * dès la Planète, couronne dès la Nébuleuse), le dessin du rang au centre, et la division en
 * dessous (III : un losange allumé, II : deux, I : trois ; la Singularité a son bandeau). Avant la
 * fin des 5 parties de placement : un « ? » et cinq points, un par placement joué.
 * Dessin en SVG (rectangles fusionnés par ligne), net à toutes les tailles ; rien que des chaînes de
 * caractères : testable sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./classement.js'));
  else root.OrbiteEmbleme = factory(root.OrbiteClassement);
})(typeof self !== 'undefined' ? self : this, function (K) {
  'use strict';
  const IDS = ['poussiere', 'asteroide', 'lune', 'planete', 'geante', 'etoile', 'nebuleuse', 'pulsar', 'singularite'];
  const SIZE = 26;

  // Métal du médaillon, par rang : contour, ombre, métal, reflet, fond.
  const METAL = [
    { k: '#221e19', s: '#5a5248', m: '#8a8173', h: '#c4baa6', bg: '#14120e' },
    { k: '#2a170a', s: '#74461f', m: '#ad723c', h: '#e2a86c', bg: '#170f08' },
    { k: '#1b222b', s: '#66778a', m: '#a6b6c8', h: '#eef4fa', bg: '#0e1218' },
    { k: '#0b2619', s: '#237048', m: '#3fb57a', h: '#a6f4c6', bg: '#08160f' },
    { k: '#311905', s: '#9a5518', m: '#e38d36', h: '#ffd395', bg: '#1b1006' },
    { k: '#372705', s: '#ad7e1c', m: '#f3c04a', h: '#fff2b8', bg: '#1c1504' },
    { k: '#2b0b33', s: '#8a3398', m: '#d46be4', h: '#fbc4ff', bg: '#16081b' },
    { k: '#06222f', s: '#1f7fae', m: '#46d2fb', h: '#d2f8ff', bg: '#05121a' },
    { k: '#0f0726', s: '#5532a8', m: '#a07aff', h: '#f1eaff', bg: '#040208' }
  ];
  const GREY = { k: '#1e1d1a', s: '#4a4740', m: '#6f6a5f', h: '#a8a291', bg: '#100f0d' };

  // Le dessin de chaque rang, 16 × 16, posé au centre du médaillon ('.' : le fond).
  const ART = {
    poussiere: {
      pal: { d: '#5f584c', a: '#9a9080', b: '#d9cfb8', c: '#e7d39e', w: '#fff6dc' },
      rows: [
        '................',
        '...........d....',
        '.....d.aab......',
        '...a..a....a....',
        '..b..a.......d..',
        '....a...cc...a..',
        '.d.a...cwwc...a.',
        '...a..cwwwc...a.',
        '...a..cwwc...a..',
        '.a..a..cc....a..',
        '....a.......a...',
        '..d..ba....a..b.',
        '.......aaba.....',
        '...b........d...',
        '........d.......',
        '................'
      ]
    },
    asteroide: {
      pal: { k: '#2a1d13', h: '#d0a47a', b: '#916a48', s: '#5c412b', c: '#71523a', d: '#3b2a1c' },
      rows: [
        '................',
        '................',
        '......kkkk......',
        '....kkhhhbkk....',
        '...khhhbbbbbk...',
        '..khhbbccbbbbk..',
        '..khbbcddbbbbsk.',
        '.khbbbbccbbbbbk.',
        '.khbbbbbbbbccbsk',
        '.kbbbbbbbbcddbsk',
        '.kbbccbbbbbccbsk',
        '..kbcddbbbbbbsk.',
        '..kbbccbbbbbssk.',
        '...ksbbbbbsssk..',
        '....kkssssskk...',
        '......kkkkk.....'
      ]
    },
    lune: {
      pal: { k: '#1c2430', h: '#f2f6fb', b: '#b9c6d6', s: '#7c8ba0', c: '#8f9db1', w: '#ffffff' },
      rows: [
        '................',
        '.....kkkk.......',
        '...kkhhhk.......',
        '..khhhhk........',
        '.khhhbk.........',
        '.khhbbk.........',
        'khhbbk.......w..',
        'khhbck..........',
        'khbbbk..........',
        'khbbbbk.....w...',
        'kbbcbbbk........',
        '.kbbbbbbkk....w.',
        '.ksbbbbbbbkkkk..',
        '..ksssbbbbbbsk..',
        '...kkksssssk....',
        '......kkkkk.....'
      ]
    },
    planete: {
      pal: { k: '#0c1630', b: '#3f7fd8', l: '#9fd0ff', s: '#24477e', g: '#5fc35a', G: '#a6e897', S: '#2f7a3a' },
      rows: [
        '................',
        '.....kkkkkk.....',
        '...kkllbbggkk...',
        '..kllbbbgGggbk..',
        '..klbggbbggbbk..',
        '.klbgGggbbbbbbk.',
        '.kbbgggbbbbgbbk.',
        '.kbbbggbbbgggsk.',
        '.kbbbbbbbggGgsk.',
        '.kbgbbbbbbggSsk.',
        '.kbggbbbbbbbssk.',
        '..kbggbbbbbssk..',
        '..kbbbbbbgsssk..',
        '...kksbbssskk...',
        '.....kkkkkk.....',
        '................'
      ]
    },
    geante: {
      pal: { k: '#3a1a06', c: '#f8dcaa', o: '#e8964a', r: '#b45a24', s: '#7e3c14', R: '#f6e0a4', q: '#a8823f' },
      rows: [
        '................',
        '................',
        '......kkkk......',
        '....kkccccsk....',
        '...kccccccosk...',
        '...kooooooosk.Rq',
        '...krrrrrrrsRRq.',
        '..kooooooooRRsk.',
        '..kccccccRRRssk.',
        '.qkoooooRRooosk.',
        'qRRRRRRRrrrssk..',
        'Rq..korrrrssk...',
        '.....kkssskk....',
        '.......kkk......',
        '................',
        '................'
      ]
    },
    etoile: {
      pal: { r: '#d0761a', o: '#f6b23c', y: '#ffe27a', w: '#ffffff' },
      rows: [
        '.......rr.......',
        '.......oo.......',
        '..r....oo....r..',
        '...o...yy...o...',
        '....o.yyyy.o....',
        '.....yywwyy.....',
        '.....ywwwwy.....',
        'roooyywwwwyyooor',
        'roooyywwwwyyooor',
        '.....ywwwwy.....',
        '.....yywwyy.....',
        '....o.yyyy.o....',
        '...o...yy...o...',
        '..r....oo....r..',
        '.......oo.......',
        '.......rr.......'
      ]
    },
    nebuleuse: {
      pal: { d: '#4a2a7a', v: '#8a5ad8', p: '#e07ae8', l: '#ffc2f6', c: '#5ee7ff', w: '#ffffff' },
      rows: [
        '................',
        '..w.......w.....',
        '......pppp......',
        '....ppllppvv....',
        '...pplllpvvvv...',
        '..ppllppvvccvv..',
        '..pplpvvvcwcvvd.',
        '.dppvvvdvvccvvd.',
        '.dpvvddddvvvppd.',
        '.dvvvdccdvvpplp.',
        '..vvdcwcdvpplp..',
        '..dvvccvvppppd..',
        '...dvvvvppppd...',
        '....ddvvvvdd..w.',
        '.w....dddd......',
        '................'
      ]
    },
    pulsar: {
      pal: { m: '#2f8fd0', b: '#7fe8ff', y: '#c8f6ff', w: '#ffffff' },
      rows: [
        '.........w......',
        '........yy......',
        '........yb......',
        '.......yb.......',
        '...mmm.yb.mmm...',
        '..m...bbbb...m..',
        '.m...bwwwwb...m.',
        '.m..bbwwwwbb..m.',
        '.m..bbwwwwbb..m.',
        '.m...bwwwwb...m.',
        '..m...bbbb...m..',
        '...mmm.by.mmm...',
        '.......by.......',
        '......by........',
        '......yy........',
        '......w.........'
      ]
    },
    singularite: {
      pal: { k: '#000000', w: '#fff6e6', y: '#ffd27a', o: '#ff8a3c', p: '#b04aff', v: '#5a2ab8' },
      rows: [
        '................',
        '................',
        '................',
        '......vvvv......',
        '....vwwwwwwv....',
        '...vwwkkkkwwv...',
        '...vwkkkkkkwoop.',
        '...wkkkkkkkkwopp',
        '..owkkkkkkkkwopp',
        '.powkkkkkkkkyoo.',
        'ppowwkkkkkwyy...',
        '.pooyywwwwkw....',
        '.....wwwwww.....',
        '................',
        '................',
        '................'
      ]
    },
    placement: {
      pal: { k: '#2a2823', w: '#d8d1bd', s: '#8e887a' },
      rows: [
        '................',
        '................',
        '.....kkkkkk.....',
        '....kwwwwwwk....',
        '...kwwkkkswwk...',
        '...kwsk..kwwk...',
        '....kk..kwwsk...',
        '.......kwwsk....',
        '......kwwsk.....',
        '......kwsk......',
        '.......kk.......',
        '......kkkk......',
        '......kwwk......',
        '......kssk......',
        '.......kk.......',
        '................'
      ]
    }
  };

  // Le médaillon : un octogone 20 × 20 (contour, puis un liseré de métal éclairé en haut à gauche).
  const FX = 3, FY = 2, FW = 20;
  const inFrame = (x, y) => {
    const dx = x - FX, dy = y - FY;
    if (dx < 0 || dy < 0 || dx >= FW || dy >= FW) return false;
    const c = 5, e = FW - 1;
    return dx + dy >= c && (e - dx) + dy >= c && dx + (e - dy) >= c && (e - dx) + (e - dy) >= c;
  };
  const edge = (x, y, f) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => !f(x + a, y + b));
  const FRAME = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!inFrame(x, y)) continue;
    const ring = edge(x, y, inFrame) ? 0 : edge(x, y, (a, b) => inFrame(a, b) && !edge(a, b, inFrame)) ? 1 : 2;
    FRAME.push([x, y, ring]);
  }
  // Ailes (dès la Planète) et couronne (dès la Nébuleuse) : [x, y, rôle] (k contour, m métal, h reflet).
  const WINGS = [];
  for (let y = 8; y <= 15; y++) { WINGS.push([2, y, y === 8 || y === 15 ? 'k' : 'm'], [23, y, y === 8 || y === 15 ? 'k' : 'm']); }
  for (let y = 10; y <= 13; y++) { WINGS.push([1, y, y === 10 || y === 13 ? 'k' : 'h'], [24, y, y === 10 || y === 13 ? 'k' : 's']); }
  WINGS.push([0, 11, 'k'], [0, 12, 'k'], [25, 11, 'k'], [25, 12, 'k']);
  const CROWN = [
    [12, 0, 'h'], [13, 0, 'h'], [11, 1, 'k'], [12, 1, 'm'], [13, 1, 'm'], [14, 1, 'k'],
    [8, 1, 'h'], [17, 1, 'h'], [7, 1, 'k'], [9, 1, 'k'], [16, 1, 'k'], [18, 1, 'k']
  ];
  // Losanges de division : trois, sous le médaillon.
  const PIP = [[1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2], [2, 2]];
  const PIP_X = [5, 11, 17], PIP_Y = 23;
  const BAND = [];
  for (let x = 4; x <= 21; x++) BAND.push([x, 24]);
  for (let x = 6; x <= 19; x++) BAND.push([x, 23], [x, 25]);

  function paint(set, x, y, col) { if (col && x >= 0 && y >= 0 && x < SIZE && y < SIZE) set[y * SIZE + x] = col; }
  function compose(metal, art, tier, pips) {
    const px = new Array(SIZE * SIZE).fill(null);
    if (tier >= 3) for (const [x, y, r] of WINGS) paint(px, x, y, metal[r]);
    if (tier >= 6) for (const [x, y, r] of CROWN) paint(px, x, y, metal[r]);
    for (const [x, y, ring] of FRAME) {
      // Liseré : reflet en haut à gauche, ombre en bas à droite.
      const lit = x + y < FX + FY + FW;
      paint(px, x, y, ring === 0 ? metal.k : ring === 1 ? (lit ? metal.h : metal.s) : metal.bg);
    }
    // Un léger halo au centre du fond.
    for (const [x, y, ring] of FRAME) if (ring === 2 && Math.hypot(x + 0.5 - 13, y + 0.5 - 12) < 5.2) paint(px, x, y, mix(metal.bg, metal.m, 0.14));
    art.rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = art.pal[row[x]]; if (c) paint(px, x + 5, y + 4, c); } });
    if (pips) pips(px);
    return px;
  }
  function mix(a, b, t) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  // Un pixel par rectangle, fusionnés en lignes de même couleur.
  function toSvg(px) {
    let rects = '';
    for (let y = 0; y < SIZE; y++) {
      let x = 0;
      while (x < SIZE) {
        const c = px[y * SIZE + x];
        if (!c) { x++; continue; }
        let n = 1;
        while (x + n < SIZE && px[y * SIZE + x + n] === c) n++;
        rects += `<rect x="${x}" y="${y}" width="${n + 0.02}" height="1.02" fill="${c}"/>`;
        x += n;
      }
    }
    return `<svg class="emb-svg" viewBox="0 0 ${SIZE} ${SIZE}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }

  const DIVS = ['III', 'II', 'I'];
  const cache = {};
  // svg(rang, division) : division 'III' | 'II' | 'I' ; '' pour la Singularité ; null : sans losanges.
  function svg(idx, div) {
    const t = Math.max(0, Math.min(IDS.length - 1, idx | 0));
    const key = t + ':' + div;
    if (cache[key]) return cache[key];
    const metal = METAL[t];
    const lit = div == null ? -1 : DIVS.indexOf(div) + 1;
    const px = compose(metal, ART[IDS[t]], t, div == null ? null : (p) => {
      if (lit <= 0) { for (const [x, y] of BAND) paint(p, x, y, y === 24 ? metal.h : metal.m); return; }
      PIP_X.forEach((x0, i) => { for (const [a, b] of PIP) paint(p, x0 + a, PIP_Y + b, i < lit ? (b === 0 ? metal.h : metal.m) : mix(metal.k, metal.s, 0.4)); });
    });
    return (cache[key] = toSvg(px));
  }
  // En placement : le « ? » et cinq points, allumés selon les parties jouées (null : inconnu).
  function placement(done) {
    const n = done == null ? -1 : Math.max(0, Math.min(5, done | 0));
    const key = 'p:' + n;
    if (cache[key]) return cache[key];
    const px = compose(GREY, ART.placement, 0, (p) => {
      for (let i = 0; i < 5; i++) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) paint(p, 4 + i * 4 + a, 23 + b, i < n ? (b === 0 ? '#ffe49a' : '#f6c453') : mix(GREY.k, GREY.s, 0.5));
    });
    return (cache[key] = toSvg(px));
  }

  // Ce qu'on sait du rang d'un créateur : { placed, points, pl? } (profil public, place au salon). Sans « placed » (anciennes versions), des points > 0 suffisent à le dire classé.
  function infoOf(p) {
    const pts = Math.max(0, Math.round(Number(p && p.points) || 0));
    const placed = p && typeof p.placed === 'boolean' ? p.placed : pts > 0 ? true : null;
    // pl : parties de placement jouées (place au salon) ; placements : la liste (état local).
    const done = !p ? null : p.pl != null ? p.pl | 0 : Array.isArray(p.placements) ? p.placements.length : null;
    if (!placed) return { placed: false, known: placed === false, done };
    const t = K.tierOf(pts);
    return { placed: true, points: pts, idx: t.idx, div: t.div, label: t.label, id: IDS[t.idx] };
  }
  function of(p) { const i = infoOf(p); return i.placed ? svg(i.idx, i.div) : placement(i.done); }
  // L'étape de division (0 : Poussière III … 24 : Singularité) : pour savoir si l'on monte ou descend.
  const step = (points) => K.step(points);

  return { IDS, SIZE, METAL, ART, svg, placement, of, infoOf, step };
});
