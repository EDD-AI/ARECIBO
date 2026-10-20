/* ORBITE — bâtiments (vie-energie). Voir js/building-engine.js : register, model, MAT.
 * Support vital (nourriture, eau, oxygène) et énergie. */
(function (E) {
  'use strict';
  const { MAT, model } = E;
  const TAU = Math.PI * 2;
  const tOf = (o) => (o && o.t) || 0;

  // Sphère pleine ; k est un matériau ou une fonction (x, y, z, nz) → matériau.
  function ball(m, cx, cy, cz, rad, k) {
    for (let z = Math.floor(cz - rad); z <= cz + rad; z++) for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if (Math.hypot(x - cx, y - cy, z - cz) <= rad + 0.2) m.set(x, y, z, typeof k === 'function' ? k(x, y, z, (z - cz) / rad) : k);
    }
  }
  // Toit de cuve : cône aplati.
  function cone(m, cx, cy, z, rad, k) {
    for (let i = 0; rad - i * 1.1 > 0.3; i++) m.cyl(cx, cy, z + i, z + i, rad - i * 1.1, k);
  }
  const posMod = (a, n) => ((a % n) + n) % n;

  E.register([
    // ─── Support vital ─────────────────────────────────────────
    {
      key: 'ferme', cat: 'vie', name: 'Ferme verticale', desc: 'Tour hydroponique : étages vitrés de cultures sous lampes, cuve d’eau sur le toit.',
      eco: { jobs: 4, power: -4, water: -3, food: 26 }, anim: false,
      build(r) {
        const W = r.int(8, 11), D = r.int(7, 9), floors = r.int(4, 6), fh = 3, H = floors * fh + 1;
        const stepped = r.chance(0.5), shaftFront = r.chance(0.5), roofTank = r.chance(0.65), annex = r.chance(0.6);
        const m = model(W + 10, D + 10, Math.min(30, H + 7));
        const x0 = 3, y0 = 3, x1 = x0 + W - 1, y1 = y0 + D - 1, half = Math.ceil(floors / 2);
        m.box(1, 1, 0, x1 + 3, y1 + 3, 0, MAT.PAD);
        const insOf = (f) => (stepped && f >= half ? 1 : 0);
        for (let z = 1; z <= H; z++) {
          const f = Math.floor((z - 1) / fh), lvl = (z - 1) % fh;
          // Une dalle couvre tout l'étage du dessous ; les étages hauts sont en retrait.
          const ins = lvl === 0 ? insOf(f - 1) : insOf(f);
          const a0 = x0 + ins, a1 = x1 - ins, b0 = y0 + ins, b1 = y1 - ins;
          for (let y = b0; y <= b1; y++) for (let x = a0; x <= a1; x++) {
            const ex = x === a0 || x === a1, ey = y === b0 || y === b1;
            const dep = Math.min(x - a0, a1 - x, y - b0, b1 - y);
            let k;
            if (ex && ey) k = MAT.METAL;
            else if (lvl === 0) k = dep === 0 ? MAT.HULL2 : MAT.HULL;
            else if (dep === 0) k = MAT.GLASS;
            else if (dep === 1) k = lvl === 2 && (x + y) % 3 === 0 ? MAT.WINDOW : MAT.PLANT;
            else k = MAT.HULL2;
            m.set(x, y, z, k);
          }
          // Jardinières sur la terrasse du retrait.
          if (stepped && lvl === 1 && f === half) {
            for (let x = x0 + 1; x < x1; x += 2) { m.set(x, y1, z, MAT.PLANT); }
            for (let y = y0 + 1; y < y1; y += 2) { m.set(x1, y, z, MAT.PLANT); }
          }
        }
        const ti = insOf(floors), ta0 = x0 + ti, ta1 = x1 - ti, tb0 = y0 + ti, tb1 = y1 - ti;
        // Cage d'ascenseur.
        if (shaftFront) {
          const sx = x1 - 3;
          m.box(sx, y1 + 1, 1, sx + 1, y1 + 2, H + 1, MAT.HULL);
          for (let z = 3; z <= H; z += 3) m.set(sx + 1, y1 + 2, z, MAT.WINDOW);
          m.box(sx, y1 + 1, H + 1, sx + 1, y1 + 2, H + 1, MAT.ACCENT);
        } else {
          const sy = Math.floor((y0 + y1) / 2);
          m.box(x1 + 1, sy - 1, 1, x1 + 2, sy, H + 1, MAT.HULL);
          for (let z = 3; z <= H; z += 3) m.set(x1 + 2, sy, z, MAT.WINDOW);
          m.box(x1 + 1, sy - 1, H + 1, x1 + 2, sy, H + 1, MAT.ACCENT);
        }
        // Toit : cuve d'eau ou panneaux, ventilation, balise.
        const cx = Math.floor((ta0 + ta1) / 2), cy = Math.floor((tb0 + tb1) / 2);
        if (roofTank) {
          m.cyl(cx - 0.5, cy, H + 1, H + 3, 1.8, MAT.HULL);
          m.cyl(cx - 0.5, cy, H + 2, H + 2, 1.8, MAT.ACCENT);
          m.cyl(cx - 0.5, cy, H + 4, H + 4, 0.9, MAT.HULL2);
        } else {
          m.box(ta0 + 1, tb0 + 1, H + 1, ta1 - 2, tb1 - 1, H + 1, MAT.METAL);
          m.box(ta0 + 1, tb0 + 1, H + 2, ta1 - 2, tb1 - 1, H + 2, MAT.SOLAR);
        }
        m.box(ta1 - 1, tb0 + 1, H + 1, ta1 - 1, tb0 + 2, H + 2, MAT.METAL);
        m.set(ta0, tb1, H + 1, MAT.BEACON);
        // Annexe d'entrée.
        if (annex) {
          m.box(x0, y1 + 1, 1, x0 + 3, y1 + 2, 3, MAT.HULL);
          m.box(x0, y1 + 1, 4, x0 + 3, y1 + 2, 4, MAT.HULL2);
          m.box(x0 + 1, y1 + 2, 1, x0 + 2, y1 + 2, 2, MAT.DARK);
          m.box(x0 + 1, y1 + 2, 3, x0 + 2, y1 + 2, 3, MAT.ACCENT);
        }
        return m;
      }
    },
    {
      key: 'aquaculture', cat: 'vie', name: 'Bassins d’aquaculture', desc: 'Bassins de poissons et d’algues sous serres en tunnel, brassés par des roues à aubes.',
      eco: { jobs: 3, power: -3, water: -4, food: 20 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const n = r.int(2, 3), bl = r.int(9, 13), pitch = 6;
        const W = bl + 9, D = n * pitch + 4;
        const m = model(W, D, 12);
        const wheel = [], phase = [];
        for (let j = 0; j < n; j++) { wheel.push(r.int(2, Math.floor(bl / 2) - 1)); phase.push(r.next()); }
        const silo = r.chance(0.6);
        m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
        const xb = 1, xe = xb + bl - 1;
        for (let j = 0; j < n; j++) {
          const yb = 2 + j * pitch, ye = yb + 4, cy = yb + 2;
          m.box(xb, yb, 1, xe, ye, 2, MAT.HULL2);
          m.box(xb + 1, yb + 1, 1, xe - 1, ye - 1, 1, MAT.ICE);
          m.box(xb + 1, yb + 1, 2, xe - 1, ye - 1, 2, MAT.EMPTY);
          // Serre en tunnel à deux pans, nervures métalliques.
          for (let x = xb; x <= xe; x++) {
            const rib = (x - xb) % 3 === 0 ? MAT.METAL : MAT.GLASS;
            m.set(x, yb, 3, rib); m.set(x, ye, 3, rib);
            m.set(x, yb + 1, 4, rib); m.set(x, ye - 1, 4, rib);
            m.set(x, cy, 5, x === xb || x === xe ? MAT.METAL : rib === MAT.METAL ? MAT.METAL : MAT.GLASS);
          }
          for (const x of [xb, xe]) { m.box(x, yb, 3, x, ye, 3, MAT.GLASS); m.box(x, yb + 1, 4, x, ye - 1, 4, MAT.GLASS); m.set(x, yb, 3, MAT.METAL); m.set(x, ye, 3, MAT.METAL); }
          // Roues à aubes (deux par bassin) : axe le long de y, quatre pales qui tournent.
          for (const px of [xb + wheel[j], xe - wheel[j]]) {
            const a0 = (T + phase[j]) * TAU;
            for (let y = yb + 1; y <= ye - 1; y++) {
              for (let k = 0; k < 4; k++) {
                const a = a0 + k * Math.PI / 2;
                m.line(px, y, 2, px + Math.cos(a) * 1.4, y, 2 + Math.sin(a) * 1.4, MAT.HULL);
              }
              m.set(px, y, 2, MAT.DARK);
            }
            m.set(px, ye, 2, MAT.ACCENT);
          }
          m.set(xe + 1, cy, 1, MAT.COPPER);
        }
        // Station de pompage et d'alimentation.
        const hx0 = xe + 2, hx1 = W - 2, hy1 = silo ? D - 6 : D - 3;
        m.box(hx0, 2, 1, hx1, hy1, 4, MAT.HULL);
        m.box(hx0, 2, 5, hx1, hy1, 5, MAT.HULL2);
        for (let y = 3; y < hy1; y += 2) m.set(hx1, y, 3, MAT.WINDOW);
        m.box(hx0 + 1, hy1, 1, hx0 + 2, hy1, 2, MAT.DARK);
        m.box(hx0 + 1, hy1, 3, hx0 + 2, hy1, 3, MAT.ACCENT);
        m.box(hx0, 2, 1, hx0, hy1, 1, MAT.COPPER);
        m.box(hx1 - 1, 3, 6, hx1 - 1, 4, 7, MAT.METAL);
        if (silo) {
          const sx = hx0 + 2.5, sy = D - 3;
          m.cyl(sx, sy, 1, 6, 1.6, MAT.HULL2);
          m.cyl(sx, sy, 4, 4, 1.6, MAT.ACCENT);
          cone(m, sx, sy, 7, 1.6, MAT.HULL);
        }
        return m;
      }
    },
    {
      key: 'electrolyseur', cat: 'vie', name: 'Électrolyseur d’oxygène', desc: 'Piles d’électrolyse qui séparent l’eau en oxygène et hydrogène, cuves et redresseur.',
      eco: { jobs: 2, power: -6, water: -3, oxygen: 28 }, anim: false,
      build(r) {
        const nc = r.int(3, 4), cl = r.int(7, 9), oh = r.int(8, 12), hh = r.int(5, 7);
        const D = nc * 3 + 5, xr = 2 + cl + 1, xt = xr + 6, W = xt + 4;
        const m = model(W, D, oh + 5);
        m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
        m.box(0, D - 1, 0, W - 1, D - 1, 0, MAT.STRIPE);
        // Piles d'électrolyse couchées, plaques d'extrémité colorées.
        for (let i = 0; i < nc; i++) {
          const y = 2 + i * 3;
          for (const sx of [3, 2 + cl - 2]) m.box(sx, y - 1, 1, sx, y + 1, 1, MAT.METAL);
          m.tube('x', 2, 2 + cl - 1, y, 2.5, 1.1, MAT.HULL);
          m.tube('x', 2, 2, y, 2.5, 1.2, MAT.ACCENT);
          m.tube('x', 2 + cl - 1, 2 + cl - 1, y, 2.5, 1.2, MAT.ACCENT);
          for (let x = 4; x < 2 + cl - 2; x += 2) m.set(x, y, 4, MAT.HULL2);
        }
        const bx = 2 + Math.floor(cl / 2);
        m.box(bx, 1, 5, bx, 2 + (nc - 1) * 3 + 1, 5, MAT.COPPER);
        // Redresseur : armoire sombre et isolateurs.
        m.box(xr, 1, 1, xr + 3, 5, 4, MAT.DARK);
        m.box(xr, 1, 5, xr + 3, 5, 5, MAT.HULL2);
        for (const y of [2, 4]) m.box(xr + 1, y, 6, xr + 1, y, 7, MAT.COPPER);
        m.set(xr + 3, 3, 3, MAT.LIGHT);
        m.line(xr, 3, 5, bx, 3, 5, MAT.COPPER);
        // Cuve d'oxygène (haute, cerclée) et cuve d'hydrogène.
        m.cyl(xt, 3.5, 1, oh, 2.2, MAT.HULL);
        for (let z = 3; z < oh; z += 3) m.cyl(xt, 3.5, z, z, 2.2, MAT.ACCENT, 1);
        m.dome(xt, 3.5, oh + 1, 2, () => MAT.HULL, 2);
        const hy = D - 4;
        m.cyl(xt, hy, 1, hh, 1.6, MAT.HULL2);
        m.dome(xt, hy, hh + 1, 1.5, () => MAT.HULL2, 2);
        m.cyl(xt, hy, 2, 2, 1.6, MAT.METAL);
        // Conduites des piles vers les cuves.
        m.line(2 + cl, 2, 2, xt - 2, 3, 2, MAT.COPPER);
        m.line(2 + cl, D - 4, 2, xt - 2, hy, 2, MAT.COPPER);
        m.box(xr + 1, D - 4, 1, xr + 3, D - 2, 2, MAT.HULL2);
        return m;
      }
    },
    {
      key: 'extracteur', cat: 'vie', name: 'Extracteur de glace', desc: 'Vis de forage sur trépied, tapis roulant chargé de glace et cuve de fusion.',
      role: 'ice', eco: { jobs: 3, power: -4, water: 28 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const H = r.int(11, 15), tankR = r.range(2.2, 2.8), tankH = r.int(6, 8), L = r.int(4, 6);
        const dx = 5, dy = 6, xt = 9 + L + Math.ceil(tankR) + 1, W = xt + Math.ceil(tankR) + 1, D = 13;
        const cabin = r.chance(0.6);
        const m = model(W, D, H + 4);
        m.box(0, 1, 0, W - 1, D - 2, 0, MAT.PAD);
        // Plateforme et trépied de forage.
        m.box(dx - 3, dy - 3, 1, dx + 3, dy + 3, 1, MAT.HULL2);
        m.box(dx - 3, dy + 3, 1, dx + 3, dy + 3, 1, MAT.STRIPE);
        for (const [lx, ly] of [[dx - 3, dy - 3], [dx + 3, dy - 3], [dx - 3, dy + 3], [dx + 3, dy + 3]]) m.line(lx, ly, 2, dx + Math.sign(lx - dx), dy + Math.sign(ly - dy), H - 1, MAT.METAL);
        m.box(dx - 1, dy - 1, H, dx + 1, dy + 1, H + 1, MAT.HULL);
        m.box(dx - 1, dy + 1, H, dx + 1, dy + 1, H, MAT.ACCENT);
        m.set(dx, dy, H + 2, MAT.BEACON);
        // Vis sans fin : hélice qui tourne autour de l'axe.
        for (let z = 2; z < H; z++) {
          m.set(dx, dy, z, MAT.DARK);
          if (z < H - 1) {
            const a = z * 1.05 - T * TAU;
            m.set(dx + Math.cos(a) * 1.2, dy + Math.sin(a) * 1.2, z, MAT.HULL);
            m.set(dx - Math.cos(a) * 1.2, dy - Math.sin(a) * 1.2, z, MAT.ACCENT);
          }
        }
        // Trémie de glace.
        m.box(dx + 4, dy - 1, 2, dx + 6, dy + 2, 4, MAT.HULL2);
        m.box(dx + 5, dy, 4, dx + 5, dy + 1, 4, MAT.ICE);
        // Tapis roulant incliné jusqu'au sommet de la cuve, morceaux de glace qui avancent.
        const xs = dx + 7, xe = xt - Math.ceil(tankR), z0 = 3, z1 = tankH + 1, Lc = xe - xs;
        const shift = Math.floor(T * 9);
        let prev = z0;
        for (let x = xs; x <= xe; x++) {
          const zc = Math.round(z0 + (z1 - z0) * (x - xs) / Lc);
          for (let z = Math.min(prev, zc); z <= zc; z++) { m.set(x, dy, z, MAT.METAL); m.set(x, dy + 1, z, MAT.METAL); }
          m.set(x, dy, zc + 1, MAT.DARK); m.set(x, dy + 1, zc + 1, MAT.DARK);
          if (posMod(x - xs - shift, 3) === 0 && x < xe) { m.set(x, dy, zc + 2, MAT.ICE); m.set(x, dy + 1, zc + 2, MAT.ICE); }
          if ((x - xs) % 3 === 1) m.box(x, dy + 1, 1, x, dy + 1, zc - 1, MAT.METAL);
          prev = zc;
        }
        m.box(xs - 1, dy, 2, xs, dy + 1, 3, MAT.HULL2);
        // Cuve de fusion, conduite de sortie, vapeur.
        const ty = dy + 0.5;
        m.cyl(xt, ty, 1, tankH, tankR, MAT.HULL);
        m.cyl(xt, ty, 3, 3, tankR, MAT.ACCENT, 1);
        m.cyl(xt, ty, tankH, tankH, tankR, MAT.HULL2, 1);
        cone(m, xt, ty, tankH + 1, tankR - 0.6, MAT.HULL2);
        m.line(xt, ty + tankR + 1, 1, xt, D - 2, 1, MAT.COPPER);
        m.box(xt - 1, D - 3, 1, xt + 1, D - 2, 2, MAT.METAL);
        E.puffs(m, 'extracteur-vap', xt, ty, tankH + 3, T, { n: 4, rise: 5, spread: 1.4, wind: 1, mat: MAT.HULL });
        if (cabin) {
          m.box(1, D - 4, 1, 3, D - 2, 3, MAT.HULL);
          m.set(3, D - 3, 2, MAT.WINDOW); m.set(2, D - 2, 2, MAT.WINDOW);
          m.box(1, D - 4, 4, 3, D - 2, 4, MAT.HULL2);
        }
        return m;
      }
    },
    {
      key: 'recycleur', cat: 'vie', name: 'Recycleur d’eau', desc: 'Bassins de décantation à pont racleur tournant et colonnes de filtration par osmose.',
      eco: { jobs: 2, power: -3, water: 18 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const two = r.chance(0.5), R = two ? r.int(3, 4) : r.int(4, 5), bw = r.int(5, 6), cols = r.int(2, 3);
        const D = two ? 4 * R + 8 : Math.max(2 * R + 5, 14);
        const bx0 = 2 * R + 5, bx1 = bx0 + bw - 1, W = bx1 + 3;
        const m = model(W, D, 12);
        m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
        const centers = two ? [[R + 2, R + 2], [R + 2, 3 * R + 5]] : [[R + 2, (D - 1) / 2]];
        const ph = centers.map(() => r.next());
        centers.forEach(([cx, cy], j) => {
          m.cyl(cx, cy, 1, 2, R, MAT.HULL2, 1.1);
          m.cyl(cx, cy, 1, 1, R - 1, MAT.ICE);
          m.cyl(cx, cy, 1, 1, 1.4, MAT.HULL2);
          m.box(cx, cy, 1, cx, cy, 3, MAT.METAL);
          // Pont racleur qui tourne.
          const a = (T + ph[j]) * TAU;
          m.line(cx, cy, 3, cx + Math.cos(a) * R, cy + Math.sin(a) * R, 3, MAT.METAL);
          m.line(cx, cy, 2, cx + Math.cos(a) * (R - 1.4), cy + Math.sin(a) * (R - 1.4), 2, MAT.DARK);
          m.set(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 4, MAT.ACCENT);
          m.set(cx, cy, 4, MAT.HULL);
          m.line(cx + R + 1, cy, 1, bx0 - 1, cy, 1, MAT.COPPER);
        });
        // Bâtiment de filtration et colonnes d'osmose inverse.
        const by1 = D - 6;
        m.box(bx0, 2, 1, bx1, by1, 4, MAT.HULL);
        m.box(bx0, 2, 5, bx1, by1, 5, MAT.HULL2);
        m.box(bx0 + 1, 3, 6, bx1 - 1, by1 - 1, 6, MAT.HULL2);
        for (let y = 3; y < by1; y += 2) m.set(bx1, y, 3, MAT.WINDOW);
        m.box(bx1 - 2, by1, 1, bx1 - 1, by1, 2, MAT.DARK);
        m.box(bx1 - 2, by1, 3, bx1 - 1, by1, 3, MAT.ACCENT);
        for (let i = 0; i < cols; i++) {
          const x = bx0 + 1 + i * 2;
          m.box(x, D - 4, 1, x, D - 3, 6, MAT.HULL2);
          m.box(x, D - 4, 7, x, D - 3, 7, MAT.ACCENT);
          m.set(x, D - 3, 2, MAT.COPPER);
        }
        m.box(bx0, D - 2, 1, bx1, D - 2, 1, MAT.COPPER);
        return m;
      }
    },
    {
      key: 'moxie', cat: 'vie', name: 'Générateur MOXIE', desc: 'Électrolyse du CO₂ de l’atmosphère : grilles d’admission, cœur doré et sphère d’oxygène.',
      eco: { jobs: 2, power: -5, oxygen: 20 }, anim: false,
      build(r) {
        const w = r.int(6, 8), h = r.int(5, 7), stacks = r.int(1, 2), solarTop = r.chance(0.5), sph = r.range(2, 2.6);
        const S = w + 9;
        const m = model(S, S, h + 8);
        m.box(0, 0, 0, S - 1, S - 1, 0, MAT.PAD);
        const x0 = 2, y0 = 2, x1 = x0 + w - 1, y1 = y0 + w - 1;
        m.box(x0, y0, 1, x1, y1, h, MAT.HULL);
        // Grilles d'admission sur les deux faces visibles.
        for (let z = 2; z < h; z++) {
          for (let x = x0 + 1; x < x1; x++) m.set(x, y1, z, x % 2 ? MAT.DARK : MAT.METAL);
          for (let y = y0 + 1; y < y1; y++) m.set(x1, y, z, y % 2 ? MAT.DARK : MAT.METAL);
        }
        m.box(x0, y0, h + 1, x1, y1, h + 1, MAT.HULL2);
        m.box(x0, y1, h, x1, y1, h, MAT.ACCENT);
        m.box(x1, y0, h, x1, y1, h, MAT.ACCENT);
        // Cœur doré (électrolyse à oxyde solide) sur le toit.
        if (solarTop) {
          m.box(x0 + 1, y0 + 1, h + 2, x0 + 3, y0 + 3, h + 3, MAT.COPPER);
          m.box(x0 + 4, y0 + 1, h + 2, x1 - 1, y1 - 1, h + 2, MAT.SOLAR);
        } else m.box(x0 + 1, y0 + 1, h + 2, x1 - 1, y1 - 1, h + 3, MAT.COPPER);
        // Cheminées d'admission à chapeau.
        for (let i = 0; i < stacks; i++) {
          const sx = i ? x1 - 1 : x0 + 1;
          m.cyl(sx, y0, 1, h + 4, 1, MAT.HULL2);
          m.cyl(sx, y0, h + 5, h + 5, 1.6, MAT.METAL);
        }
        // Sphère d'oxygène sur pieds.
        const scx = S - 3.5, scy = S - 3.5, scz = sph + 2;
        for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(Math.round(scx + ax * 1.3), Math.round(scy + ay * 1.3), 1, Math.round(scx + ax * 1.3), Math.round(scy + ay * 1.3), 2, MAT.METAL);
        ball(m, scx, scy, scz, sph, (x, y, z) => (Math.abs(z - scz) < 0.5 ? MAT.ACCENT : MAT.HULL));
        m.line(x1 + 1, y1 - 1, 2, scx - 1, scy - 2, 2, MAT.COPPER);
        m.set(x0, y1, h + 2, MAT.LIGHT);
        return m;
      }
    },
    {
      key: 'champignonniere', cat: 'vie', name: 'Champignonnière', desc: 'Galeries enterrées sous un tertre de régolithe : cultures de champignons à l’abri des radiations.',
      eco: { jobs: 4, power: -3, water: -2, food: 20 }, anim: false,
      build(r) {
        const L = r.int(12, 17), R = r.int(4, 6), Hm = r.int(4, 6), nv = Math.min(r.int(2, 3), Math.floor((L - 4) / 5));
        const W = L + 5, cy = R + 2, D = cy + R + 7;
        const m = model(W, D, Hm + 6);
        const cx = (W - 1) / 2;
        const hAt = (x, y) => {
          const u = (x - cx) / (L / 2), v = (y - cy) / R, q = 1 - v * v - u * u * u * u;
          return q <= 0 ? -1 : Math.max(0, Math.round(Hm * Math.sqrt(q)));
        };
        for (let y = cy - R; y <= cy + R; y++) for (let x = 0; x < W; x++) {
          const h = hAt(x, y);
          for (let z = 0; z <= h; z++) m.set(x, y, z, z === h ? MAT.SAND : MAT.ROCK);
          // Mur de soutènement en béton au pied du tertre.
          if (h >= 0 && (hAt(x + 1, y) < 0 || hAt(x - 1, y) < 0 || hAt(x, y + 1) < 0 || hAt(x, y - 1) < 0)) m.set(x, y, 0, MAT.HULL2);
        }
        // Blocs de régolithe et sacs de protection.
        for (let i = 0; i < L; i++) {
          const x = Math.round(r.range(cx - L / 2 + 1, cx + L / 2 - 1)), y = Math.round(r.range(cy - R + 1, cy + R - 1)), h = hAt(x, y);
          if (h > 0) m.set(x, y, h + 1, MAT.ROCK);
        }
        // Ventilations.
        for (let i = 0; i < nv; i++) {
          const x = Math.round(cx - L / 2 + 2 + (L - 4) * (i + 0.5) / nv), y = cy - 1, h = hAt(x, y);
          m.box(x, y, h, x + 1, y + 1, h + 2, MAT.METAL);
          m.box(x - 1, y - 1, h + 3, x + 2, y + 2, h + 3, MAT.HULL2);
          m.box(x, y, h + 3, x + 1, y + 1, h + 3, MAT.DARK);
        }
        // Portail d'entrée en béton sur la face avant, rampe balisée.
        const px = Math.round(cx), fy = cy + R;
        m.box(px - 2, fy - 2, 0, px + 2, fy + 2, 4, MAT.HULL);
        m.box(px - 2, fy + 2, 4, px + 2, fy + 2, 4, MAT.ACCENT);
        m.box(px - 1, fy + 2, 0, px + 1, fy + 2, 2, MAT.DARK);
        m.set(px + 2, fy + 2, 2, MAT.WINDOW);
        m.set(px - 2, fy + 2, 5, MAT.LIGHT);
        m.box(px - 2, fy + 3, 0, px + 2, fy + 5, 0, MAT.PAD);
        m.box(px - 2, fy + 3, 0, px - 2, fy + 5, 0, MAT.STRIPE);
        m.box(px + 2, fy + 3, 0, px + 2, fy + 5, 0, MAT.STRIPE);
        // Cuve d'humidification sur un côté.
        const tx = r.chance(0.5) ? 2 : W - 3;
        m.cyl(tx, fy + 3, 0, 4, 1.5, MAT.HULL2);
        m.cyl(tx, fy + 3, 2, 2, 1.5, MAT.ACCENT);
        m.line(tx, fy + 1, 1, tx, fy - 1, 1, MAT.COPPER);
        return m;
      }
    },
    {
      key: 'condenseur', cat: 'vie', name: 'Condenseur atmosphérique', desc: 'Tours de captation en treillis : leurs ventilateurs condensent l’humidité de l’air.',
      eco: { jobs: 1, power: -3, water: 12 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const n = r.int(3, 5), rot = r.range(0, TAU), c = 10;
        const hs = [], ph = [];
        for (let i = 0; i < n; i++) { hs.push(r.int(9, 14)); ph.push(r.next()); }
        const m = model(21, 21, 20);
        m.cyl(c, c, 0, 0, 9.5, MAT.PAD);
        // Collecteur central.
        m.cyl(c, c, 1, 5, 2.4, MAT.HULL);
        m.cyl(c, c, 3, 3, 2.4, MAT.ACCENT);
        m.cyl(c, c, 6, 6, 1.4, MAT.HULL2);
        m.set(c, c, 7, MAT.LIGHT);
        for (let i = 0; i < n; i++) {
          const a = rot + i * TAU / n, tx = Math.round(c + Math.cos(a) * 6.3), ty = Math.round(c + Math.sin(a) * 6.3), h = hs[i];
          m.line(tx, ty, 1, c, c, 1, MAT.COPPER);
          m.box(tx - 1, ty - 1, 1, tx + 1, ty + 1, 1, MAT.HULL2);
          // Fût en treillis garni de filets de captation.
          for (let z = 2; z <= h; z++) for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) {
            const corner = x !== tx && y !== ty;
            if (x === tx && y === ty) continue;
            m.set(x, y, z, corner ? MAT.METAL : (z + x + y) % 2 ? MAT.DARK : MAT.HULL2);
          }
          // Couronne du ventilateur, pales qui tournent.
          m.cyl(tx, ty, h + 1, h + 2, 2.6, MAT.HULL2, 0.9);
          m.cyl(tx, ty, h + 1, h + 1, 1.8, MAT.DARK);
          const b0 = (T + ph[i]) * TAU;
          m.line(tx - Math.cos(b0) * 1.6, ty - Math.sin(b0) * 1.6, h + 2, tx + Math.cos(b0) * 1.6, ty + Math.sin(b0) * 1.6, h + 2, MAT.HULL);
          m.set(tx, ty, h + 2, MAT.ACCENT);
        }
        return m;
      }
    },

    // ─── Énergie ───────────────────────────────────────────────
    {
      key: 'geothermie', cat: 'energie', name: 'Centrale géothermique', desc: 'Têtes de puits, conduites de vapeur à lyres de dilatation, salle des turbines et panaches.',
      eco: { jobs: 3, power: 20 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const hw = r.int(8, 10), hh = r.int(4, 6), wells = r.int(1, 2), stacks = r.int(2, 3);
        const W = hw + 11, D = 16;
        const m = model(W, D, 24);
        m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
        // Salle des turbines.
        const hx0 = 1, hx1 = hx0 + hw - 1, hy0 = 7, hy1 = D - 2;
        m.box(hx0, hy0, 1, hx1, hy1, hh, MAT.HULL);
        for (let y = hy0; y <= hy1; y++) {
          const z = hh + 1 + Math.min(y - hy0, hy1 - y, 2);
          m.box(hx0, y, hh + 1, hx1, y, z, MAT.HULL2);
        }
        for (let x = hx0 + 1; x < hx1; x += 2) m.set(x, hy1, hh - 1, MAT.WINDOW);
        m.box(hx1, hy1 - 3, 1, hx1, hy1 - 1, 3, MAT.DARK);
        m.box(hx1, hy1 - 3, 4, hx1, hy1 - 1, 4, MAT.ACCENT);
        // Têtes de puits et séparateurs à l'arrière.
        for (let i = 0; i < wells; i++) {
          const wx = 2 + i * 5, wy = 2;
          m.box(wx - 1, wy - 1, 1, wx + 1, wy + 1, 1, MAT.METAL);
          m.box(wx, wy, 2, wx, wy, 4, MAT.COPPER);
          m.box(wx - 1, wy, 3, wx + 1, wy, 3, MAT.ACCENT);
          m.cyl(wx + 2.5, wy + 1, 1, 6, 1.2, MAT.HULL2);
          m.set(wx + 2.5, wy + 1, 7, MAT.HULL);
          // Conduite surélevée vers la salle, avec une lyre de dilatation.
          const px = wx + 2;
          m.box(px, wy + 2, 4, px, hy0 - 1, 4, MAT.COPPER);
          m.box(px, wy + 3, 5, px, wy + 3, 6, MAT.COPPER); m.box(px, wy + 4, 6, px, wy + 4, 6, MAT.COPPER); m.box(px, wy + 5, 5, px, wy + 5, 6, MAT.COPPER);
          m.set(px, wy + 4, 4, MAT.EMPTY);
          for (let y = wy + 2; y < hy0; y += 3) m.box(px, y, 1, px, y, 3, MAT.METAL);
          E.puffs(m, 'geo-puits' + i, wx, wy, 5, (T + i * 0.5) % 1, { n: 3, rise: 3, spread: 1, wind: 0.6, mat: MAT.HULL });
        }
        // Condenseur et cheminées de vapeur sur la droite.
        const cx0 = hx1 + 3, cx1 = W - 2;
        m.box(cx0, 3, 1, cx1, D - 3, 5, MAT.HULL2);
        for (let y = 4; y < D - 3; y += 2) m.box(cx1, y, 2, cx1, y, 4, MAT.DARK);
        m.line(hx1 + 1, hy0 + 2, 3, cx0 - 1, hy0 + 2, 3, MAT.COPPER);
        for (let i = 0; i < stacks; i++) {
          const sx = Math.round((cx0 + cx1) / 2), sy = 4 + i * 3;
          m.cyl(sx, sy + 0.5, 6, 8, 1.4, MAT.HULL, 0.9);
          m.cyl(sx, sy + 0.5, 8, 8, 1.4, MAT.ACCENT, 0.9);
          for (let k = 0; k < 2; k++) E.puffs(m, 'geo-tour' + i + k, sx + k * 0.5, sy + 0.5, 9, (T + i * 0.37 + k * 0.5) % 1, { n: 6, rise: 11, spread: 2.6, wind: 1.2, mat: MAT.HULL });
        }
        return m;
      }
    },
    {
      key: 'fusion', cat: 'energie', name: 'Centrale à fusion', desc: 'Tokamak : anneau de confinement cerclé de bobines, plasma qui circule, cuves cryogéniques.',
      eco: { jobs: 6, power: 60, water: -2 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const R = r.int(5, 6), a = 2.3, S = 23, c = 11;
        const nbi = r.int(1, 2), tanks = r.int(2, 4), nCoil = r.pick([8, 10]);
        const m = model(S, S, 18);
        const pr = R + a + 1.4;
        m.cyl(c, c, 0, 0, pr + 0.4, MAT.PAD);
        m.cyl(c, c, 1, 1, pr, MAT.HULL2);
        m.cyl(c, c, 1, 1, pr, MAT.STRIPE, 0.7);
        const zc = 2 + a + 0.6;
        // Tore : coque, bande vitrée sur le dessus, bobines toroïdales, plasma.
        const pulse = (phi) => {
          for (let k = 0; k < 3; k++) {
            let d = posMod(phi - (T + k / 3) * TAU, TAU);
            if (d > Math.PI) d -= TAU;
            if (Math.abs(d) < 0.45) return true;
          }
          return false;
        };
        for (let z = 2; z <= Math.ceil(zc + a + 1.5); z++) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const rho = Math.hypot(x - c, y - c), phi = Math.atan2(y - c, x - c);
          const d = Math.hypot(rho - R, z - zc);
          const ang = phi * nCoil / TAU, frac = Math.abs(ang - Math.round(ang)) * TAU / nCoil * rho;
          if (d <= a + 0.3) {
            if (d > a - 0.9) m.set(x, y, z, z - zc > a * 0.35 ? MAT.GLASS : Math.abs(z - zc) < 0.5 ? MAT.HULL2 : MAT.HULL);
            else if (d < 1.0) m.set(x, y, z, pulse(phi) ? MAT.WINDOW : MAT.LIGHT);
            else m.set(x, y, z, MAT.DARK);
          } else if (d <= a + 1.0 && frac < 0.55) m.set(x, y, z, z - zc > a * 0.6 ? MAT.ACCENT : MAT.METAL);
        }
        // Solénoïde central.
        m.cyl(c, c, 2, Math.round(zc + a + 3), 1.6, MAT.HULL2);
        m.cyl(c, c, Math.round(zc + a + 3), Math.round(zc + a + 3), 1.6, MAT.ACCENT);
        m.set(c, c, Math.round(zc + a + 4), MAT.BEACON);
        // Injecteurs de neutres : caissons radiaux.
        for (let i = 0; i < nbi; i++) {
          const ang = (i ? 0.9 : 0.15) * Math.PI / 2 + (i ? Math.PI * 0.75 : 0);
          for (let s = R + a + 0.5; s <= R + a + 4; s += 0.5) {
            const x = c + Math.cos(ang) * s, y = c + Math.sin(ang) * s;
            m.box(Math.round(x), Math.round(y), 2, Math.round(x), Math.round(y), 4, s > R + a + 3 ? MAT.ACCENT : MAT.HULL);
          }
        }
        // Cuves cryogéniques aux angles.
        const corners = [[2, 2], [S - 3, 2], [2, S - 3], [S - 3, S - 3]];
        for (let i = 0; i < tanks; i++) {
          const [tx, ty] = corners[(i + 1) % 4];
          m.cyl(tx, ty, 0, 5, 1.5, MAT.HULL);
          m.cyl(tx, ty, 6, 6, 0.8, MAT.HULL2);
          m.cyl(tx, ty, 2, 2, 1.5, MAT.ACCENT);
          { const dd = Math.hypot(tx - c, ty - c); m.line(tx, ty, 1, c + (tx - c) / dd * pr, c + (ty - c) / dd * pr, 1, MAT.COPPER); }
        }
        return m;
      }
    },
    {
      key: 'heliostats', cat: 'energie', name: 'Tour solaire', desc: 'Champ d’héliostats qui suivent le soleil et renvoient sa lumière vers le récepteur de la tour.',
      eco: { jobs: 2, power: 15 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const H = r.int(15, 21), two = r.chance(0.6), n1 = r.int(6, 7), n2 = r.int(10, 12);
        const az0 = r.range(-0.4, 0.4), off = r.range(0, 1);
        const R1 = 5.5, R2 = two ? 9 : R1, S = Math.ceil(R2 * 2) + 5, c = (S - 1) / 2;
        const m = model(S, S, H + 4);
        m.cyl(c, c, 0, 0, R2 + 2, MAT.PAD);
        // Tour et récepteur incandescent.
        m.cyl(c, c, 1, 2, 2.2, MAT.HULL2);
        m.cyl(c, c, 3, H - 3, 1.2, MAT.HULL);
        for (let z = 6; z < H - 3; z += 5) m.cyl(c, c, z, z, 1.2, MAT.ACCENT);
        m.cyl(c, c, H - 2, H, 1.8, MAT.WINDOW);
        m.cyl(c, c, H - 3, H - 3, 2.2, MAT.HULL2);
        m.cyl(c, c, H + 1, H + 1, 2.2, MAT.HULL2);
        m.set(c, c, H + 2, MAT.METAL);
        m.set(c, c, H + 3, MAT.BEACON);
        m.box(Math.round(c) + 1, Math.round(c) + 2, 1, Math.round(c) + 2, Math.round(c) + 2, 2, MAT.DARK);
        // Le soleil balaie le ciel d'est en ouest puis revient (boucle).
        const az = az0 + 1.0 * Math.sin(T * TAU), el = 0.75;
        const sun = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
        const mirror = (mx, my) => {
          m.box(Math.round(mx), Math.round(my), 1, Math.round(mx), Math.round(my), 2, MAT.METAL);
          const tw = [c - mx, c - my, H - 1 - 3];
          const tl = Math.hypot(...tw);
          let nx = sun[0] + tw[0] / tl, ny = sun[1] + tw[1] / tl, nz = sun[2] + tw[2] / tl;
          const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
          // Panneau de 3 × 2 : tourné selon la normale, le rang côté soleil plus haut s'il est bien incliné.
          const hl = Math.hypot(nx, ny) || 1, hx = nx / hl, hy = ny / hl;
          const step = hl > 0.6 ? 1 : 0;
          for (let u = -1; u <= 1; u++) for (let v = 0; v <= 1; v++) {
            const vv = v - 0.5;
            m.set(mx - hy * u * 1.05 - hx * vv, my + hx * u * 1.05 - hy * vv, 3 + (v === 1 ? step : 0), MAT.ICE);
          }
        };
        for (let i = 0; i < n1; i++) { const a = (i + off) * TAU / n1; mirror(c + Math.cos(a) * R1, c + Math.sin(a) * R1); }
        if (two) for (let i = 0; i < n2; i++) { const a = (i + off + 0.5) * TAU / n2; mirror(c + Math.cos(a) * R2, c + Math.sin(a) * R2); }
        return m;
      }
    },
    {
      key: 'batteries', cat: 'energie', name: 'Banque de batteries', desc: 'Conteneurs d’accumulateurs alignés et poste de transformation : l’énergie de la nuit.',
      role: 'storage', eco: {}, anim: false,
      build(r) {
        const rows = r.int(2, 3), per = r.int(2, 3), cl = per === 3 ? 4 : r.int(4, 6);
        const W = per * (cl + 1) + 7, D = rows * 5 + 3;
        const m = model(W, D, 10);
        m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
        m.box(0, D - 1, 0, W - 1, D - 1, 0, MAT.STRIPE);
        for (let j = 0; j < rows; j++) for (let i = 0; i < per; i++) {
          const x0 = 1 + i * (cl + 1), x1 = x0 + cl - 1, y0 = 1 + j * 5, y1 = y0 + 2;
          m.box(x0, y0, 1, x1, y1, 3, MAT.HULL2);
          m.box(x0, y0, 4, x1, y1, 4, MAT.HULL);
          for (let x = x0 + 1; x < x1; x += 2) m.set(x, y1, 2, MAT.DARK);
          m.box(x1, y0, 1, x1, y1, 3, MAT.HULL);
          m.box(x0, y1, 3, x0 + 1, y1, 3, MAT.ACCENT);
          if (i === per - 1) m.set(x1, y1, 2, MAT.LIGHT);
          // Câbles vers le poste.
          m.box(x1 + 1, y0 + 1, 1, x1 + 1, y0 + 1, 1, MAT.COPPER);
        }
        // Poste de transformation : transformateur, isolateurs, portique.
        const sx = per * (cl + 1) + 2, sy = Math.floor(D / 2) - 1;
        m.box(sx, sy - 1, 1, sx + 2, sy + 2, 3, MAT.DARK);
        for (let y = sy - 1; y <= sy + 2; y += 1) m.set(sx + 3, y, 2, MAT.METAL);
        for (const y of [sy - 1, sy + 1]) m.box(sx + 1, y, 4, sx + 1, y, 5, MAT.COPPER);
        m.box(sx + 1, sy, 4, sx + 1, sy, 4, MAT.HULL);
        m.box(sx + 4, 1, 1, sx + 4, 1, 7, MAT.METAL); m.box(sx + 4, D - 2, 1, sx + 4, D - 2, 7, MAT.METAL);
        m.box(sx + 4, 1, 7, sx + 4, D - 2, 7, MAT.METAL);
        m.line(sx + 1, sy - 1, 6, sx + 4, 2, 7, MAT.DARK);
        m.line(sx, 2, 1, sx, D - 3, 1, MAT.COPPER);
        return m;
      }
    },
    {
      key: 'rtg', cat: 'energie', name: 'Générateur RTG', desc: 'Générateur à radio-isotopes à ailettes, sans pièce mobile, derrière un périmètre balisé.',
      eco: { power: 5 }, anim: false,
      build(r) {
        const n = r.int(1, 2), h = r.int(4, 6), cab = r.chance(0.7);
        const W = n === 2 ? 15 : 11, D = 11;
        const m = model(W, D, h + 4);
        m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
        // Périmètre balisé et poteaux.
        for (let x = 0; x < W; x++) for (const y of [0, D - 1]) m.set(x, y, 0, MAT.STRIPE);
        for (let y = 0; y < D; y++) for (const x of [0, W - 1]) m.set(x, y, 0, MAT.STRIPE);
        for (const [x, y] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) m.box(x, y, 1, x, y, 2, MAT.METAL);
        m.set(W - 1, D - 1, 3, MAT.BEACON);
        for (let i = 0; i < n; i++) {
          const cx = 4 + i * 5, cy = 4;
          m.box(cx - 1, cy - 1, 1, cx + 1, cy + 1, 1, MAT.HULL2);
          m.cyl(cx, cy, 2, h + 1, 1, MAT.HULL);
          // Ailettes radiales.
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m.box(cx + dx * 2, cy + dy * 2, 2, cx + dx * 3, cy + dy * 3, h - 1, MAT.METAL);
          for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) m.box(cx + dx * 2, cy + dy * 2, 3, cx + dx * 2, cy + dy * 2, h - 1, MAT.METAL);
          m.cyl(cx, cy, h + 2, h + 2, 1, MAT.ACCENT);
          m.line(cx, cy + 2, 1, cx, D - 3, 1, MAT.COPPER);
        }
        if (cab) {
          m.box(W - 4, D - 4, 1, W - 3, D - 3, 2, MAT.HULL);
          m.set(W - 3, D - 3, 2, MAT.LIGHT);
          m.box(2, D - 3, 1, W - 5, D - 3, 1, MAT.COPPER);
        }
        return m;
      }
    },
    {
      key: 'methane', cat: 'energie', name: 'Centrale au méthane', desc: 'Turbines à méthane de synthèse : salle des machines, sphères de gaz et cheminées rayées.',
      eco: { jobs: 3, power: 18, oxygen: -2 }, anim: true,
      build(r, o) {
        const T = tOf(o);
        const nch = r.int(2, 3), chH = r.int(14, 19), nsp = r.int(1, 2), hh = r.int(4, 6);
        const W = 19, D = 17;
        const m = model(W, D, 30);
        m.box(0, 0, 0, W - 1, D - 1, 0, MAT.PAD);
        // Salle des machines.
        m.box(1, 6, 1, 9, D - 2, hh, MAT.HULL);
        m.box(1, 6, hh + 1, 9, D - 2, hh + 1, MAT.HULL2);
        for (let x = 2; x < 9; x += 2) m.set(x, D - 2, hh - 1, MAT.WINDOW);
        m.box(9, D - 5, 1, 9, D - 3, 3, MAT.DARK);
        m.box(9, D - 5, 4, 9, D - 3, 4, MAT.ACCENT);
        m.box(3, 8, hh + 2, 6, 10, hh + 2, MAT.METAL);
        // Cheminées rayées, fumée.
        for (let i = 0; i < nch; i++) {
          const x = 3 + i * 4, y = 3, ch = chH - i * 2;
          m.cyl(x, y, 1, ch, 1.3, MAT.HULL);
          for (let z = 1; z <= ch; z++) if (Math.floor((ch - z) / 3) % 2 === 0) m.cyl(x, y, z, z, 1.3, MAT.ACCENT);
          m.cyl(x, y, ch + 1, ch + 1, 1.3, MAT.METAL, 0.8);
          m.line(x, y + 1, 2, x, 6, 2, MAT.COPPER);
          E.puffs(m, 'methane' + i, x, y, ch + 2, (T + i * 0.31) % 1, { n: 5, rise: 8, spread: 2, wind: 1.6, mat: MAT.HULL2 });
        }
        m.set(4, 3, chH, MAT.BEACON);
        // Sphères de méthane sur pieds.
        for (let i = 0; i < nsp; i++) {
          const sx = 14, sy = nsp === 2 ? 8 + i * 6 : 11, rad = 2.6, sz = 2 + rad;
          for (const [ax, ay] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.box(sx + ax * 2, sy + ay * 2, 1, sx + ax * 2, sy + ay * 2, 3, MAT.METAL);
          ball(m, sx, sy, sz, rad, (x, y, z) => (Math.abs(z - sz) < 0.5 ? MAT.HULL2 : MAT.HULL));
          m.line(sx - 3, sy, 1, 10, sy, 1, MAT.COPPER);
        }
        return m;
      }
    }
  ]);
})(typeof module === 'object' && module.exports ? require('../building-engine.js') : self.OrbiteBuildings);
