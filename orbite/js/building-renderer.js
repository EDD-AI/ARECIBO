/* ORBITE — rendu isométrique pixel art des bâtiments (voir building-engine.js).
 * Chaque voxel est un petit cube de 4 × 4 pixels : dessus clair, flanc droit éclairé, flanc gauche
 * dans l'ombre. Le soleil vient de l'arrière droit : les ombres portées tombent vers l'avant gauche.
 * Le verre est translucide, les lumières clignotent, et la scène peut tourner d'un quart de tour. */
(function () {
  'use strict';
  const E = window.OrbiteBuildings;
  const M = E.MAT;

  const RAMPS = {
    hull: ['#4a4a4e', '#7a7a80', '#a8a8ae', '#cfcfd2', '#e8e6e2', '#fbfaf6'],
    hull2: ['#3a3c42', '#5c6068', '#80858e', '#a2a8b0', '#c4c8ce', '#dfe2e6'],
    metal: ['#18191c', '#2a2c30', '#3e4148', '#565a62', '#727780', '#9095a0'],
    dark: ['#08080a', '#121316', '#1c1e22', '#26292e', '#30343a', '#3c4048'],
    glass: ['#0e2a3a', '#1a4a64', '#2a6c8e', '#4a98b8', '#86c6dc', '#d2f0f8'],
    plant: ['#0e2410', '#16401a', '#226226', '#348a34', '#58b04a', '#94d872'],
    solar: ['#08102a', '#0e1c44', '#16285e', '#22387a', '#3a5498', '#6a86c0'],
    copper: ['#2a1608', '#4a2a10', '#6e4418', '#966226', '#ba8440', '#dcae6e'],
    pad: ['#1c1c1e', '#2c2c30', '#3e3e44', '#55555c', '#6e6e76', '#8c8c94'],
    stripe: ['#3a2c04', '#6a5208', '#a6820e', '#dcb21c', '#f4d040', '#fff0a0'],
    light: ['#0a3a4a', '#1a7090', '#3ab0d0', '#7ae0f8', '#c8f6ff', '#ffffff'],
    window: ['#3a2a08', '#7a5a10', '#c8962a', '#f4c860', '#ffe8a8', '#fffbe8'],
    beacon: ['#3a0808', '#7a1010', '#c02020', '#ff4a3a', '#ff9a8a', '#ffe0d8'],
    trunk: ['#1a0f08', '#2f1c10', '#4a2e1a', '#6e4a2a', '#8f6a3e', '#b08a5a'],
    lava: ['#4a0a02', '#8a2004', '#d0480a', '#ff7a1a', '#ffb04a', '#ffe8a0']
  };
  const ACCENTS = {
    orange: ['#3a1404', '#6a2808', '#a2420e', '#d8641a', '#f08c3a', '#ffc080'],
    rouge: ['#3a0808', '#661010', '#9a1c1c', '#cc3030', '#e8605a', '#f8a8a0'],
    sarcelle: ['#062a28', '#0c4a46', '#14706a', '#20a096', '#4cc8bc', '#a0eee4'],
    jaune: ['#3a2c04', '#6a5208', '#a6820e', '#dcb21c', '#f4d040', '#fff0a0'],
    bleu: ['#0a1838', '#122a60', '#1c4290', '#2e62c0', '#5a8ee0', '#a8c8f8']
  };
  const GROUNDS = {
    mars: ['#2a0f08', '#4a1c10', '#6e2c18', '#9a4424', '#bd6236', '#d98a58'],
    lune: ['#141416', '#26262a', '#3c3c42', '#5a5a62', '#7c7c86', '#a2a2ac'],
    glace: ['#1a2a3a', '#2e4a62', '#4c7090', '#7aa0bc', '#a8c8dc', '#dceef8'],
    soufre: ['#2a2408', '#4a4010', '#706018', '#9a8a24', '#c4b23c', '#e2d670'],
    volcan: ['#0c0a0a', '#1c1616', '#2c2222', '#403030', '#584242', '#745858']
  };
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const shift = (ramp, k) => ramp.map((_, i) => ramp[Math.max(0, Math.min(5, i + k))]);

  function palette(theme, accent) {
    const g = GROUNDS[theme] || GROUNDS.mars;
    const P = [];
    P[M.GROUND] = g; P[M.ROCK] = shift(g, -1); P[M.STRATA] = shift(g, -2); P[M.SAND] = shift(g, 1);
    P[M.HULL] = RAMPS.hull; P[M.HULL2] = RAMPS.hull2; P[M.METAL] = RAMPS.metal; P[M.DARK] = RAMPS.dark;
    P[M.GLASS] = RAMPS.glass; P[M.PLANT] = RAMPS.plant; P[M.SOLAR] = RAMPS.solar; P[M.ACCENT] = ACCENTS[accent] || ACCENTS.orange;
    P[M.COPPER] = RAMPS.copper; P[M.PAD] = RAMPS.pad; P[M.STRIPE] = RAMPS.stripe; P[M.LIGHT] = RAMPS.light;
    P[M.WINDOW] = RAMPS.window; P[M.BEACON] = RAMPS.beacon; P[M.ICE] = GROUNDS.glace; P[M.TRUNK] = RAMPS.trunk; P[M.LAVA] = RAMPS.lava;
    return P.map((r) => (r ? r.map(hex) : null));
  }

  const vhash = (x, y, z) => {
    let h = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647, 1274126177);
    h ^= h >>> 13;
    return ((h >>> 0) % 1000) / 1000;
  };

  // Ajoute une dalle de terrain sous un bâtiment seul (marge autour).
  function withGround(b, seed, margin) {
    const mg = margin == null ? 5 : margin;
    const r = E.makeRng('sol:' + seed);
    r.seedA = r.range(0, 10); r.seedB = r.range(0, 10);
    const m = E.model(b.X + mg * 2, b.Y + mg * 2, b.Z + 5);
    const g = E.slab(m, r, { height: 2 });
    for (let y = 0; y < b.Y; y++) for (let x = 0; x < b.X; x++) for (let z = g; z < m.Z; z++) m.set(x + mg, y + mg, z, 0);
    m.blit(b, mg, mg, g);
    return m;
  }

  // render(model, { theme, accent, view, blink }) → toile à la taille en pixels « art ».
  function render(mod, o) {
    o = o || {};
    const P = palette(o.theme, o.accent);
    const view = ((o.view || 0) % 4 + 4) % 4;
    const odd = view % 2 === 1;
    const X = odd ? mod.Y : mod.X, Y = odd ? mod.X : mod.Y, Z = mod.Z;
    // Accès tourné : (x, y) de la vue → coordonnées du modèle.
    const src = (x, y) => (view === 0 ? [x, y] : view === 1 ? [y, mod.Y - 1 - x] : view === 2 ? [mod.X - 1 - x, mod.Y - 1 - y] : [mod.X - 1 - y, x]);
    const get = (x, y, z) => {
      if (x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z) return 0;
      const [sx, sy] = src(x, y);
      return mod.v[(z * mod.Y + sy) * mod.X + sx];
    };
    const W = (X + Y) * 2 + 4, H = X + Y + Z * 2 + 6;
    const cv = o.canvas || document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(W, H), D = img.data;
    const ox = Y * 2, oy = Z * 2 + 2;
    const put = (x, y, c, a) => {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4;
      if (a == null || a >= 1 || !D[i + 3]) { D[i] = c[0]; D[i + 1] = c[1]; D[i + 2] = c[2]; D[i + 3] = 255; return; }
      D[i] = D[i] + (c[0] - D[i]) * a; D[i + 1] = D[i + 1] + (c[1] - D[i + 1]) * a; D[i + 2] = D[i + 2] + (c[2] - D[i + 2]) * a;
    };
    // Ombre portée : un voxel entre ce point et le soleil (arrière droit, assez haut).
    const shadowed = (x, y, z) => {
      for (let k = 1; k < Z; k++) {
        const zz = z + k;
        if (zz >= Z) return false;
        if (get(Math.round(x + k * 0.55), Math.round(y - k * 0.9), zz)) return true;
      }
      return false;
    };
    const blinkOn = o.blink !== false;
    for (let s = 0; s <= X + Y - 2; s++) {
      for (let z = 0; z < Z; z++) {
        for (let x = Math.max(0, s - Y + 1); x <= Math.min(X - 1, s); x++) {
          const y = s - x;
          const k = get(x, y, z);
          if (!k) continue;
          const ramp = P[k];
          if (!ramp) continue;
          const up = !get(x, y, z + 1), right = !get(x + 1, y, z), left = !get(x, y + 1, z);
          if (!up && !right && !left) continue;
          const px = ox + (x - y) * 2, py = oy + (x + y) - z * 2;
          const emissive = E.EMISSIVE.has(k);
          const dim = E.BLINK.has(k) && !blinkOn;
          const a = E.ALPHA[k];
          const natural = k === M.GROUND || k === M.ROCK || k === M.STRATA || k === M.SAND || k === M.PLANT;
          const n = vhash(x, y, z);
          const tone = (base) => {
            if (emissive) return dim ? ramp[1] : ramp[base >= 4 ? 5 : 4];
            let t = base;
            if (natural && n < 0.18) t -= 1; else if (natural && n > 0.9) t += 1;
            return ramp[Math.max(0, Math.min(5, t))];
          };
          if (up) {
            let t = 4;
            if (get(x - 1, y, z + 1) || get(x, y - 1, z + 1)) t -= 1;
            if (shadowed(x, y, z)) t -= 2;
            const edge = !get(x - 1, y, z) && !get(x, y - 1, z) && !get(x - 1, y, z + 1);
            put(px + 1, py, tone(edge ? t + 1 : t), a); put(px + 2, py, tone(edge ? t + 1 : t), a);
            for (let i = 0; i < 4; i++) put(px + i, py + 1, tone(t), a);
            // Verre : un reflet du ciel en diagonale.
            if (k === M.GLASS && (x + z) % 4 === 0) put(px + 1, py + 1, ramp[5], 0.7);
          }
          if (left) {
            let t = 2;
            if (shadowed(x, y + 1, z - 1)) t -= 1;
            if (z > 0 && get(x - 1, y + 1, z)) t -= 1;
            for (let r = 2; r < 4; r++) { put(px, py + r, tone(t), a); put(px + 1, py + r, tone(t), a); }
          }
          if (right) {
            let t = 3;
            if (shadowed(x + 1, y, z - 1)) t -= 1;
            for (let r = 2; r < 4; r++) { put(px + 2, py + r, tone(t), a); put(px + 3, py + r, tone(t), a); }
          }
          // Les lumières allumées débordent d'un pixel de halo.
          if (emissive && !dim && (k === M.BEACON || k === M.LIGHT)) {
            const c = ramp[3];
            for (const [dx, dy] of [[-1, 1], [4, 1], [1, -1], [2, -1]]) put(px + dx, py + dy, c, 0.45);
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  window.OrbiteBuildingRenderer = { render, withGround, palette, ACCENTS: Object.keys(ACCENTS), GROUNDS: Object.keys(GROUNDS) };
})();
