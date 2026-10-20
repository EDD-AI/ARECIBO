/* ORBITE — bâtiments (science-defense). Voir js/building-engine.js : register, model, MAT.
 * Science : observatoire, radar, station météo, relais, laboratoire de biologie, centre de données.
 * Défense : tourelle, générateur de bouclier, bunker, poste de garde et mur d'enceinte. */
(function (E) {
  'use strict';
  const { MAT, model } = E;
  const TAU = Math.PI * 2;
  const time = (o) => (o && o.t) || 0;

  // Remplit une forme définie dans un repère local tourné de l'angle a autour de (cx, cy) :
  // chaque case de la grille est ramenée dans le repère local (pas de trou).
  function spinFill(m, cx, cy, R, z0, z1, a, fn) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let z = z0; z <= z1; z++) for (let gy = -R; gy <= R; gy++) for (let gx = -R; gx <= R; gx++) {
      const k = fn(gx * c + gy * s, -gx * s + gy * c, z);
      if (k) m.set(cx + gx, cy + gy, z, k);
    }
  }
  // Point local (lx, ly) → monde, pour une rotation a autour de (cx, cy).
  const toWorld = (cx, cy, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return (lx, ly) => [cx + lx * c - ly * s, cy + lx * s + ly * c];
  };
  // Voyants : allumés ou non selon une petite empreinte (x, z, image).
  const blinkOn = (key, x, z, frame, p) => (E.hashString(key + ':' + x + ':' + z + ':' + frame) % 1000) / 1000 < p;

  E.register([
    // ─── Science ──────────────────────────────────────────────
    {
      key: 'observatoire', cat: 'science', name: 'Observatoire',
      desc: 'Coupole à fente qui tourne lentement autour de son télescope.',
      eco: { jobs: 3, power: -2, research: 5 }, anim: true,
      build(r, o) {
        const R = r.int(4, 6), H = r.int(3, 5), S = R * 2 + 5;
        const m = model(R * 2 + 9, S, H + R + 9);
        const cx = R + 2, cy = Math.floor(S / 2);
        m.box(0, 0, 0, m.X - 1, m.Y - 1, 0, MAT.PAD);
        // Tambour cylindrique, hublots et anneau de roulement.
        m.cyl(cx, cy, 1, H, R + 0.5, MAT.HULL2);
        m.cyl(cx, cy, H, H, R + 0.5, MAT.METAL, 1);
        for (let i = 0; i < 4; i++) {
          const a = 0.35 + i * 0.42;
          m.set(cx + Math.cos(a) * (R + 0.4), cy + Math.sin(a) * (R + 0.4), 2, MAT.WINDOW);
        }
        // Bâtiment de contrôle accolé, couloir, antenne fouet.
        const ax = cx + R + 1, aw = r.int(3, 4);
        m.box(ax, cy - 2, 1, ax + aw, cy + 2, 3, MAT.HULL);
        m.box(ax, cy - 2, 4, ax + aw, cy + 2, 4, MAT.HULL2);
        for (let y = cy - 1; y <= cy + 1; y += 2) m.set(ax + aw, y, 2, MAT.WINDOW);
        m.box(ax + 1, cy + 2, 1, ax + 2, cy + 2, 2, MAT.ACCENT);
        m.line(ax + aw - 1, cy - 1, 5, ax + aw - 1, cy - 1, 8, MAT.METAL);
        m.set(ax + aw - 1, cy - 1, 9, MAT.BEACON);
        if (r.chance(0.6)) {
          // Petite coupole fixe d'un instrument secondaire.
          const sx = Math.min(m.X - 3, ax + aw - 1), sy = 2;
          m.cyl(sx, sy, 1, 2, 1.8, MAT.HULL2);
          m.dome(sx, sy, 3, 2, (x, y, z, nx, ny, nz) => (nz > 0.7 ? MAT.METAL : MAT.HULL), 1.4);
        }
        const yaw0 = r.range(0, TAU), elev = r.range(0.6, 0.95);
        // Coupole : la fente part du zénith et descend d'un côté ; elle tourne avec le temps.
        const yaw = yaw0 + time(o) * TAU, c = Math.cos(yaw), s = Math.sin(yaw);
        const z0 = H + 1;
        for (let z = z0; z <= z0 + R; z++) for (let gy = -R - 1; gy <= R + 1; gy++) for (let gx = -R - 1; gx <= R + 1; gx++) {
          const d = Math.hypot(gx, gy, z - z0);
          if (d > R + 0.3 || d <= R - 1.3) continue;
          const lx = gx * c + gy * s, ly = -gx * s + gy * c;
          if (Math.abs(ly) < 1.1 && lx > -0.6 && z > z0) continue;
          const k = Math.abs(ly) < 2.1 && lx > -1.2 ? MAT.METAL : z === z0 ? MAT.HULL2 : MAT.HULL;
          m.set(cx + gx, cy + gy, z, k);
        }
        // Télescope sur son pilier, pointé dans la fente.
        m.box(cx, cy, z0, cx, cy, z0 + 1, MAT.METAL);
        const L = R - 0.6, ce = Math.cos(elev), se = Math.sin(elev);
        const p0 = [cx - c * ce * 1.5, cy - s * ce * 1.5, z0 + 2 - se * 1.5];
        const p1 = [cx + c * ce * L, cy + s * ce * L, z0 + 2 + se * L];
        m.line(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], MAT.DARK);
        m.line(p0[0], p0[1], p0[2] + 1, p1[0], p1[1], p1[2], MAT.HULL);
        return m;
      }
    },
    {
      key: 'radar', cat: 'science', name: 'Station radar',
      desc: 'Grande antenne radar qui tourne sans fin au sommet d’une tour en treillis.',
      eco: { jobs: 2, power: -3, research: 3 }, anim: true,
      build(r, o) {
        const W = r.int(5, 7), Ht = r.int(6, 10), ph = r.int(4, 5), S = W * 2 + 9;
        const m = model(S, S, Ht + ph + 6);
        const c = Math.floor(S / 2);
        m.box(0, 0, 0, S - 1, S - 1, 0, MAT.PAD);
        // Tour en treillis : quatre montants, entretoises, plate-forme.
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.line(c + dx * 3, c + dy * 3, 1, c + dx, c + dy, Ht, MAT.METAL);
        for (let z = 3; z < Ht; z += 3) {
          const k = 1 + 2 * (1 - (z - 1) / (Ht - 1)), sq = Math.round(k);
          m.line(c - sq, c - sq, z, c + sq, c - sq, z, MAT.ACCENT); m.line(c - sq, c + sq, z, c + sq, c + sq, z, MAT.ACCENT);
          m.line(c - sq, c - sq, z, c - sq, c + sq, z, MAT.ACCENT); m.line(c + sq, c - sq, z, c + sq, c + sq, z, MAT.ACCENT);
        }
        m.box(c - 2, c - 2, Ht, c + 2, c + 2, Ht, MAT.HULL2);
        m.cyl(c, c, Ht + 1, Ht + 1, 1, MAT.DARK);
        // Abri des opérateurs au pied de la tour.
        const sw = r.int(3, 4), sx = S - 2 - sw;
        m.box(sx, S - 5, 1, S - 2, S - 2, 3, MAT.HULL);
        m.box(sx, S - 5, 4, S - 2, S - 2, 4, MAT.HULL2);
        m.set(sx + 1, S - 2, 2, MAT.WINDOW); m.set(S - 2, S - 4, 2, MAT.WINDOW);
        m.box(sx + sw - 1, S - 2, 1, sx + sw - 1, S - 2, 2, MAT.ACCENT);
        m.set(S - 2, S - 5, 5, MAT.LIGHT);
        if (r.chance(0.5)) m.box(1, S - 4, 1, 3, S - 2, 2, MAT.HULL2);
        m.line(c + 2, c + 2, 1, sx, S - 4, 1, MAT.COPPER);
        // Antenne : panneau courbe en treillis, incliné vers l'arrière, qui tourne.
        const yaw = r.range(0, TAU) + time(o) * TAU, P = toWorld(c, c, yaw);
        const zb = Ht + 2;
        for (let ly = -W; ly <= W + 0.01; ly += 0.35) for (let v = 0; v <= ph + 0.01; v += 0.35) {
          const lx = 1.2 - (ly * ly) / (W * W) * 1.6 - v * 0.45;
          const edge = Math.abs(ly) > W - 0.5 || v > ph - 0.4;
          const rib = Math.abs(ly - Math.round(ly / 3) * 3) < 0.2;
          for (const th of [0, -0.6]) {
            const [x, y] = P(lx + th, ly);
            m.set(x, y, zb + v, edge || rib ? MAT.METAL : MAT.HULL2);
          }
        }
        // Bras de support et cornet d'émission devant le panneau.
        for (const ly of [-W / 2, W / 2]) { const [a, b] = P(-1.4, ly); m.line(c, c, Ht + 1, a, b, zb + ph / 2, MAT.METAL); }
        const [fx, fy] = P(3.2, 0), [hx, hy] = P(1.4, 0);
        m.line(hx, hy, zb, fx, fy, zb + 1, MAT.DARK);
        return m;
      }
    },
    {
      key: 'meteo', cat: 'science', name: 'Station météo',
      desc: 'Mât haubané rouge et blanc, anémomètre, girouette et abri à instruments.',
      eco: { jobs: 1, power: -1, research: 3 }, anim: true,
      build(r, o) {
        const H = r.int(14, 22), S = 16;
        const m = model(S, S, H + 4);
        const mx = r.int(5, 6), my = r.int(5, 6);
        // Enclos gravillonné : dalle, poteaux et clôture basse.
        m.box(1, 1, 0, S - 2, S - 2, 0, MAT.PAD);
        for (const [x, y] of [[1, 1], [S - 2, 1], [1, S - 2], [S - 2, S - 2]]) m.box(x, y, 1, x, y, 3, MAT.METAL);
        m.line(1, S - 2, 2, S - 2, S - 2, 2, MAT.DARK); m.line(S - 2, 1, 2, S - 2, S - 2, 2, MAT.DARK);
        m.line(1, 1, 2, S - 2, 1, 2, MAT.DARK); m.line(1, 1, 2, 1, S - 2, 2, MAT.DARK);
        // Mât rayé rouge et blanc, haubans.
        m.box(mx - 1, my - 1, 1, mx + 1, my + 1, 1, MAT.HULL2);
        for (let z = 2; z <= H; z++) m.set(mx, my, z, Math.floor(z / 2) % 2 ? MAT.ACCENT : MAT.HULL);
        for (const [dx, dy] of [[-4, -4], [6, -2], [-2, 7]]) m.line(mx, my, H - 3, mx + dx, my + dy, 1, MAT.DARK);
        m.set(mx, my, H + 1, MAT.BEACON);
        // Traverse : anémomètre d'un côté, girouette de l'autre.
        m.line(mx - 2, my, H - 1, mx + 2, my, H - 1, MAT.METAL);
        m.set(mx + 2, my, H, MAT.METAL);
        const a0 = r.range(0, TAU), vane0 = r.range(0, TAU);
        const T = time(o);
        for (let k = 0; k < 3; k++) {
          const a = a0 + T * TAU + k * TAU / 3;
          const ex = mx + 2 + Math.cos(a) * 2, ey = my + Math.sin(a) * 2;
          m.line(mx + 2, my, H + 1, ex, ey, H + 1, MAT.METAL);
          m.set(ex, ey, H + 1, MAT.HULL);
        }
        const va = vane0 + 0.6 * Math.sin(T * TAU);
        m.line(mx - 2 - Math.cos(va), my - Math.sin(va), H, mx - 2 + Math.cos(va) * 2, my + Math.sin(va) * 2, H, MAT.HULL2);
        m.set(mx - 2 + Math.cos(va) * 2, my + Math.sin(va) * 2, H, MAT.ACCENT);
        // Abri à instruments à persiennes, sur pieds.
        const bx = r.int(9, 10), by = r.int(9, 10);
        for (const [x, y] of [[bx, by], [bx + 2, by], [bx, by + 2], [bx + 2, by + 2]]) m.box(x, y, 1, x, y, 2, MAT.METAL);
        for (let z = 3; z <= 5; z++) m.box(bx, by, z, bx + 2, by + 2, z, z % 2 ? MAT.HULL : MAT.HULL2);
        m.box(bx - 1, by - 1, 6, bx + 3, by + 3, 6, MAT.HULL);
        // Options : petit radôme, pluviomètre, panneau solaire.
        if (r.chance(0.6)) {
          m.box(10, 2, 1, 13, 5, 2, MAT.HULL2);
          m.dome(11.5, 3.5, 3, 2, () => MAT.HULL, 1.5);
        } else {
          m.box(10, 3, 1, 13, 5, 3, MAT.HULL);
          m.set(13, 4, 2, MAT.WINDOW);
          m.set(10, 5, 2, MAT.ACCENT);
        }
        m.cyl(3, 12, 1, 2, 0.8, MAT.COPPER);
        if (r.chance(0.7)) for (let y = 0; y < 3; y++) m.box(2, 8 + y, 1 + Math.floor(y / 2), 4, 8 + y, 1 + Math.floor(y / 2), y === 0 ? MAT.HULL2 : MAT.SOLAR);
        return m;
      }
    },
    {
      key: 'relais', cat: 'science', name: 'Relais de communication',
      desc: 'Pylône en treillis hérissé de paraboles et d’antennes, balises rouges.',
      role: 'comms', eco: { jobs: 1, power: -2, research: 2 },
      build(r) {
        const H = r.int(18, 26), S = 17;
        const m = model(S, S, H + 4);
        const c = 7;
        m.box(1, 1, 0, S - 2, S - 2, 0, MAT.PAD);
        m.box(c - 4, c - 4, 1, c + 4, c + 4, 1, MAT.HULL2);
        // Pylône effilé : montants, ceintures et croisillons.
        const half = (z) => 3 - 2 * (z - 2) / (H - 2);
        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.line(c + dx * 3, c + dy * 3, 2, c + dx, c + dy, H, MAT.METAL);
        for (let z = 2; z < H - 2; z += 4) {
          const a = half(z), b = half(z + 4);
          m.line(c - a, c + a, z, c + a, c + a, z, MAT.METAL); m.line(c + a, c - a, z, c + a, c + a, z, MAT.METAL);
          m.line(c - a, c - a, z, c + a, c - a, z, MAT.METAL); m.line(c - a, c - a, z, c - a, c + a, z, MAT.METAL);
          // Croisillons sur les deux faces visibles.
          m.line(c - a, c + a, z, c + b, c + b, z + 4, MAT.DARK);
          m.line(c + a, c - a, z, c + b, c + b, z + 4, MAT.DARK);
        }
        m.line(c, c, H, c, c, H + 2, MAT.METAL);
        m.set(c, c, H + 3, MAT.BEACON);
        const mid = Math.round(H * 0.55);
        m.set(c + Math.round(half(mid)), c + Math.round(half(mid)), mid, MAT.BEACON);
        // Antennes-panneaux près du sommet.
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          const hz = half(H - 3) + 1;
          m.box(c + dx * hz, c + dy * hz, H - 4, c + dx * hz, c + dy * hz, H - 2, MAT.HULL2);
        }
        // Paraboles à différentes hauteurs, tournées vers des directions différentes.
        const n = r.int(2, 4);
        const dirs = [[1, 0], [0, 1], [1, 0], [0, 1], [-1, 0], [0, -1]];
        for (let i = 0; i < n; i++) {
          const z = Math.round(H * (0.38 + 0.45 * i / Math.max(1, n - 1)));
          const [dx, dy] = r.pick(dirs), rr = r.pick([1.5, 2, 2.5]);
          const off = half(z) + 2;
          const ox = c + dx * off, oy = c + dy * off;
          for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) {
            const d = Math.hypot(u, v);
            if (d > rr + 0.2) continue;
            const back = d < rr - 0.8 ? 0 : 1;
            m.set(ox + dx * back + dy * u, oy + dy * back + dx * u, z + v, d > rr - 0.6 ? MAT.HULL2 : MAT.HULL);
          }
          m.set(ox - dx, oy - dy, z, MAT.METAL);
          m.set(ox + dx * 2, oy + dy * 2, z, MAT.DARK);
        }
        // Abri technique et chemin de câbles.
        const sx = r.int(11, 12);
        m.box(sx, 2, 1, S - 2, 6, 3, MAT.HULL);
        m.box(sx, 2, 4, S - 2, 6, 4, MAT.HULL2);
        m.box(S - 2, 4, 1, S - 2, 5, 2, MAT.ACCENT);
        m.set(sx + 1, 6, 2, MAT.WINDOW);
        m.line(c + 2, 4, 4, sx, 4, 4, MAT.METAL);
        if (r.chance(0.5)) m.box(10, 12, 1, 13, 14, 2, MAT.HULL2), m.set(13, 13, 3, MAT.LIGHT);
        return m;
      }
    },
    {
      key: 'biolabo', cat: 'science', name: 'Laboratoire de biologie',
      desc: 'Salle blanche à sas, tunnels de culture vitrés et chambres de test.',
      eco: { jobs: 4, power: -3, water: -2, research: 6 },
      build(r) {
        const W = r.int(15, 20), D = r.int(11, 14), cw = r.int(7, 9), ch = r.int(5, 6);
        const m = model(W + 2, D + 2, 12);
        m.box(0, 0, 0, W + 1, D + 1, 0, MAT.PAD);
        // Salle blanche : bloc blanc presque aveugle, bande de couleur, sas d'entrée.
        const hh = r.int(4, 5);
        m.box(1, 1, 1, cw, ch, hh, MAT.HULL);
        m.box(1, 1, hh + 1, cw, ch, hh + 1, MAT.HULL2);
        m.box(1, ch, 2, cw, ch, 2, MAT.ACCENT);
        m.box(cw, 1, 2, cw, ch, 2, MAT.ACCENT);
        m.set(cw, 2, 4, MAT.WINDOW); m.set(cw, 3, 4, MAT.WINDOW);
        const dx = Math.floor(cw / 2);
        m.box(dx - 1, ch + 1, 1, dx + 1, ch + 2, 3, MAT.HULL2);
        m.box(dx, ch + 2, 1, dx, ch + 2, 2, MAT.DARK);
        m.set(dx, ch + 2, 3, MAT.LIGHT);
        m.box(dx - 1, ch + 3, 0, dx + 1, ch + 3, 0, MAT.STRIPE);
        // Filtres et ventilation sur le toit.
        for (let x = 2; x + 1 < cw; x += 3) {
          m.box(x, 2, hh + 2, x + 1, 3, hh + 2, MAT.METAL);
          m.set(x, 2, hh + 3, MAT.DARK);
        }
        m.cyl(cw - 1, ch - 1, hh + 2, hh + 4, 0.8, MAT.METAL);
        // Cuve de nutriments.
        m.cyl(cw + 2, 2.5, 1, 5, 1.4, MAT.HULL2);
        m.cyl(cw + 2, 2.5, 3, 3, 1.4, MAT.COPPER, 1);
        // Tunnels de culture vitrés le long de y, cultures en rangées à l'intérieur.
        const nT = Math.max(1, Math.floor((W - cw - 2) / 5));
        for (let i = 0; i < nT; i++) {
          const tx = cw + 4 + i * 5, y0 = 5, y1 = D;
          m.box(tx - 2, y0, 1, tx + 2, y1, 1, MAT.HULL2);
          m.tube('y', y0, y1, tx, 1, 2.3, MAT.GLASS);
          m.tube('y', y0 + 1, y1 - 1, tx, 1, 1.4, MAT.EMPTY);
          m.box(tx - 1, y0 + 1, 1, tx + 1, y1 - 1, 1, MAT.DARK);
          for (let y = y0 + 1; y < y1; y++) { m.set(tx - 1, y, 2, MAT.PLANT); m.set(tx + 1, y, 2, MAT.PLANT); }
          for (let y = y0; y <= y1; y += 3) m.tube('y', y, y, tx, 1, 2.3, MAT.METAL);
          m.tube('y', y0, y0, tx, 1, 2.3, MAT.HULL2);
          m.set(tx, y1, 1, MAT.DARK); m.set(tx, y1, 2, MAT.DARK);
          m.line(tx, y0, 1, cw + 2, 4, 1, MAT.COPPER);
        }
        // Chambres de test vitrées devant la salle blanche.
        const nC = r.int(1, 2);
        for (let i = 0; i < nC; i++) {
          const x0 = 1 + i * 4, y0 = ch + 4;
          if (y0 + 3 > D) break;
          m.box(x0, y0, 1, x0 + 2, y0 + 2, 1, MAT.HULL2);
          m.box(x0, y0, 2, x0 + 2, y0 + 2, 3, MAT.GLASS);
          m.box(x0 + 1, y0 + 1, 2, x0 + 1, y0 + 1, 3, MAT.EMPTY);
          m.box(x0, y0, 4, x0 + 2, y0 + 2, 4, MAT.METAL);
          m.set(x0 + 1, y0 + 1, 2, r.chance(0.5) ? MAT.PLANT : MAT.TRUNK);
          m.box(x0 + 1, y0 + 1, 3, x0 + 1, y0 + 1, 3, MAT.EMPTY);
        }
        return m;
      }
    },
    {
      key: 'donnees', cat: 'science', name: 'Centre de données',
      desc: 'Baies de serveurs aux voyants clignotants, ventilateurs et vapeur de refroidissement.',
      eco: { jobs: 2, power: -6, research: 5 }, anim: true,
      build(r, o) {
        const W = r.int(14, 20), D = r.int(9, 12), H = r.int(4, 6);
        const m = model(W + 3, D + 3, H + 10);
        m.box(0, 0, 0, W + 2, D + 2, 0, MAT.PAD);
        // Hall des serveurs : façades en baies sombres.
        m.box(1, 1, 1, W, D, H, MAT.HULL2);
        m.box(1, 1, H, W, D, H, MAT.HULL);
        const nStacks = r.int(1, 2), seedKey = 'donnees:' + r.int(0, 1e6);
        const frame = Math.floor(time(o) * 8) % 8;
        // Baies de façade (côté y et côté x), voyants qui changent à chaque image.
        for (let x = 2; x < W; x++) {
          if (x % 4 === 1) continue;
          for (let z = 2; z < H; z++) {
            const on = blinkOn(seedKey + 'y', x, z, frame, 0.32);
            m.set(x, D, z, on ? (x + z) % 3 ? MAT.LIGHT : MAT.WINDOW : MAT.DARK);
          }
        }
        for (let y = 2; y < D - 3; y++) {
          if (y % 4 === 1) continue;
          for (let z = 2; z < H; z++) m.set(W, y, z, blinkOn(seedKey + 'x', y, z, frame, 0.3) ? MAT.LIGHT : MAT.DARK);
        }
        // Entrée et groupe électrogène.
        m.box(W, D - 2, 1, W, D - 1, 3, MAT.ACCENT);
        m.box(W + 1, D - 3, 1, W + 2, D - 3, 1, MAT.STRIPE);
        m.box(W - 4, D + 1, 1, W - 1, D + 2, 2, MAT.HULL);
        m.set(W - 1, D + 2, 3, MAT.BEACON);
        m.line(W - 4, D + 1, 1, 3, D + 1, 1, MAT.COPPER);
        // Toit : groupes froids à ventilateurs qui tournent.
        const fan = frame % 2;
        for (let x = 2; x + 2 <= W - 1; x += 4) for (let y = 2; y + 2 <= D - 1; y += 4) {
          m.box(x, y, H + 1, x + 2, y + 2, H + 1, MAT.METAL);
          m.set(x + 1, y + 1, H + 2, MAT.DARK);
          const pts = fan ? [[0, 1], [2, 1], [1, 0], [1, 2]] : [[0, 0], [2, 2], [0, 2], [2, 0]];
          for (const [dx, dy] of pts) m.set(x + dx, y + dy, H + 2, MAT.HULL2);
        }
        // Tours de refroidissement : vapeur qui s'échappe.
        for (let i = 0; i < nStacks; i++) {
          const sx = 2 + i * 4, sy = D + 1;
          m.cyl(sx, sy, 1, H + 2, 1, MAT.HULL);
          m.cyl(sx, sy, H, H, 1, MAT.ACCENT);
          E.puffs(m, seedKey + 'v' + i, sx, sy, H + 3, (time(o) + i * 0.5) % 1, { n: 4, rise: 5, spread: 1.5, wind: 1, mat: MAT.HULL });
        }
        return m;
      }
    },

    // ─── Défense ──────────────────────────────────────────────
    {
      key: 'tourelle', cat: 'defense', name: 'Tourelle de défense',
      desc: 'Socle blindé et tourelle à canon qui balaie l’horizon.',
      role: 'defense', eco: { jobs: 2, power: -4 }, anim: true,
      build(r, o) {
        const L = r.int(5, 7), Rb = r.range(3, 4.2), Hb = r.int(3, 5);
        const S = (L + 3) * 2 + 1, c = L + 3;
        const m = model(S, S, Hb + 8);
        m.box(0, 0, 0, S - 1, S - 1, 0, MAT.PAD);
        m.cyl(c, c, 0, 0, Rb + 2.2, MAT.STRIPE, 0.8);
        // Socle blindé et couronne de rotation.
        m.cyl(c, c, 1, Hb, Rb, MAT.HULL2);
        m.cyl(c, c, Hb - 1, Hb - 1, Rb, MAT.ACCENT, 1);
        m.cyl(c, c, Hb + 1, Hb + 1, Rb - 0.8, MAT.DARK);
        m.box(c - 1, Math.round(c + Rb), 1, c + 1, Math.round(c + Rb), 2, MAT.DARK);
        // Caisses de munitions dans un coin.
        if (r.chance(0.6)) m.box(S - 4, 1, 1, S - 2, 2, 2, MAT.HULL);
        const twin = r.chance(0.6), radar = r.chance(0.5);
        const base = r.range(0, TAU);
        const yaw = base + 1.1 * Math.sin(time(o) * TAU);
        const zh = Hb + 2;
        // Tourelle : caisson blindé biseauté.
        spinFill(m, c, c, 5, zh, zh + 3, yaw, (lx, ly, z) => {
          const al = Math.abs(ly);
          if (z === zh) return lx >= -3.4 && lx <= 2.4 && al <= 2.4 ? MAT.HULL2 : 0;
          if (z === zh + 1) return lx >= -3.4 && lx <= 2.4 && al <= 2.4 ? (lx < -2.6 ? MAT.METAL : al > 1.6 && lx < -1 ? MAT.ACCENT : MAT.HULL) : 0;
          if (z === zh + 2) return lx >= -2.6 && lx <= 1.4 && al <= 1.6 ? MAT.HULL : 0;
          if (z === zh + 3) return radar && lx >= -2.4 && lx <= -1.6 && ly >= 0.6 && ly <= 1.4 ? MAT.DARK : 0;
          return 0;
        });
        // Canon(s) légèrement relevé(s).
        const P = toWorld(c, c, yaw);
        for (const off of twin ? [-1, 1] : [0]) {
          const [x0, y0] = P(2.4, off), [x1, y1] = P(2.4 + L, off);
          m.line(x0, y0, zh + 1, x1, y1, zh + 2, MAT.METAL);
          m.set(x1, y1, zh + 2, MAT.DARK);
        }
        const [mx, my] = P(2.6, 0);
        m.set(mx, my, zh + 1, MAT.DARK);
        if (radar) { const [bx, by] = P(-2, 1); m.set(bx, by, zh + 4, MAT.LIGHT); }
        return m;
      }
    },
    {
      key: 'bouclier', cat: 'defense', name: 'Générateur de bouclier',
      desc: 'Pylône à anneaux et condensateurs : une onde d’énergie monte jusqu’à l’émetteur.',
      role: 'defense', eco: { jobs: 2, power: -8 }, anim: true,
      build(r, o) {
        const H = r.int(14, 20), n = r.int(3, 5), S = 15, c = 7;
        const m = model(S, S, H + 6);
        m.box(0, 0, 0, S - 1, S - 1, 0, MAT.PAD);
        m.cyl(c, c, 0, 0, 6.6, MAT.STRIPE, 0.8);
        // Socle octogonal.
        m.cyl(c, c, 1, 2, 5.2, MAT.HULL2);
        m.cyl(c, c, 2, 2, 5.2, MAT.METAL, 1);
        // Condensateurs aux quatre coins, câbles vers le pylône.
        const caps = r.chance(0.5) ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : [[1, -1], [-1, 1], [1, 1]];
        for (const [dx, dy] of caps) {
          const x = c + dx * 5, y = c + dy * 5;
          m.cyl(x, y, 1, 5, 1.2, MAT.HULL);
          m.cyl(x, y, 3, 3, 1.2, MAT.COPPER);
          m.set(x, y, 6, MAT.DARK);
          m.line(x, y, 4, c, c, 4, MAT.COPPER);
        }
        // Pylône central et ses nervures.
        m.cyl(c, c, 3, H, 1.2, MAT.HULL2);
        for (let z = 4; z < H; z += 3) m.cyl(c, c, z, z, 1.2, MAT.METAL);
        // Anneaux : une onde lumineuse les parcourt de bas en haut.
        const T = time(o);
        for (let i = 0; i < n; i++) {
          const z = Math.round(5 + i * (H - 8) / Math.max(1, n - 1));
          const rr = 3.8 - i * 0.35;
          const p = (T - i / (n + 1) + 1) % 1;
          const glow = p < 0.22;
          m.cyl(c, c, z, z, rr + (glow ? 0.6 : 0), glow ? MAT.LIGHT : MAT.ACCENT, 1);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) m.line(c + dx * 1.2, c + dy * 1.2, z, c + dx * (rr - 0.5), c + dy * (rr - 0.5), z, MAT.METAL);
        }
        // Émetteur sphérique, halo qui s'élargit.
        const zo = H + 2, pTop = (T - n / (n + 1) + 1) % 1;
        m.cyl(c, c, H + 1, H + 1, 1.6, MAT.ACCENT);
        for (let z = zo - 2; z <= zo + 2; z++) for (let y = c - 2; y <= c + 2; y++) for (let x = c - 2; x <= c + 2; x++) {
          if (Math.hypot(x - c, y - c, z - zo) <= 1.9) m.set(x, y, z, pTop < 0.25 ? MAT.LIGHT : MAT.GLASS);
        }
        const halo = 2.6 + 3.4 * ((T * 2) % 1);
        if ((T * 2) % 1 < 0.85) m.cyl(c, c, zo, zo, halo, MAT.GLASS, 0.9);
        return m;
      }
    },
    {
      key: 'bunker', cat: 'defense', name: 'Bunker de défense',
      desc: 'Bloc de béton aux flancs biseautés, meurtrières et talus de régolithe.',
      role: 'defense', eco: { jobs: 3, power: -2 },
      build(r) {
        const W = r.int(11, 16), D = r.int(8, 12), H = r.int(4, 6);
        const m = model(W + 6, D + 6, H + 7);
        const x0 = 3, y0 = 3, x1 = x0 + W - 1, y1 = y0 + D - 1;
        // Talus de régolithe tassé autour du bloc.
        const berm = r.int(2, 3);
        for (let k = 0; k < berm; k++) {
          const g = berm - k;
          m.box(x0 - g, y0 - g, k + 1, x1 + g, y1 + g, k + 1, k === berm - 1 ? MAT.SAND : MAT.ROCK);
        }
        // Bloc de béton aux arêtes biseautées.
        for (let z = 1; z <= H; z++) {
          const i = z === H ? 1 : 0;
          m.box(x0 + i, y0 + i, z, x1 - i, y1 - i, z, MAT.HULL2);
        }
        m.box(x0 + 2, y0 + 2, H + 1, x1 - 2, y1 - 2, H + 1, MAT.PAD);
        // Meurtrières sur les deux faces visibles.
        const zs = H - 1;
        for (let x = x0 + 2; x + 2 <= x1 - 1; x += 4) m.box(x, y1, zs, x + 2, y1, zs, MAT.DARK);
        for (let y = y0 + 2; y + 1 <= y1 - 3; y += 4) m.box(x1, y, zs, x1, y + 1, zs, MAT.DARK);
        // Porte blindée encadrée de bandes jaunes, dans une tranchée.
        const dxd = x0 + Math.floor(W / 2);
        m.box(dxd - 2, y1 + 1, 1, dxd + 2, y1 + berm + 1, berm + 1, MAT.EMPTY);
        m.box(dxd - 2, y1 + 1, 0, dxd + 2, y1 + berm + 1, 0, MAT.PAD);
        m.box(dxd - 2, y1 + 1, 1, dxd - 2, y1 + berm, 2, MAT.HULL2);
        m.box(dxd + 2, y1 + 1, 1, dxd + 2, y1 + berm, 2, MAT.HULL2);
        m.box(dxd - 1, y1, 1, dxd + 1, y1, 3, MAT.STRIPE);
        m.box(dxd, y1, 1, dxd, y1, 2, MAT.ACCENT);
        // Toit : coupole d'observation, périscope, aérations.
        const kx = x0 + 2 + r.int(0, 2), ky = y0 + 2;
        m.cyl(kx + 1, ky + 1, H + 2, H + 2, 1.5, MAT.HULL2);
        m.cyl(kx + 1, ky + 1, H + 3, H + 3, 1.2, MAT.DARK);
        m.cyl(kx + 1, ky + 1, H + 4, H + 4, 1.5, MAT.HULL2);
        m.line(x1 - 3, y0 + 3, H + 2, x1 - 3, y0 + 3, H + 5, MAT.METAL);
        m.set(x1 - 3, y0 + 3, H + 6, MAT.BEACON);
        for (let i = 0; i < r.int(1, 3); i++) m.box(x1 - 6 - i * 3, y1 - 3, H + 2, x1 - 5 - i * 3, y1 - 3, H + 2, MAT.METAL);
        if (r.chance(0.5)) m.box(x1 - 2, y0 + 1, H + 1, x1 - 1, y0 + 4, H + 1, MAT.SAND);
        return m;
      }
    },
    {
      key: 'enceinte', cat: 'defense', name: 'Poste de garde',
      desc: 'Mur d’enceinte, tours d’angle, portail à barrière et guérite vitrée.',
      role: 'defense', eco: { jobs: 3, power: -2 },
      build(r) {
        const L = r.int(17, 21), Hw = r.int(4, 5), Ht = Hw + r.int(3, 5);
        const ret = r.chance(0.5);
        const m = model(L + 3, 14, Ht + 4);
        const wy = 3; // mur sur y = wy..wy+1
        const mid = Math.floor((L + 2) / 2);
        // Route qui traverse le portail, marquage au sol.
        m.box(mid - 2, 0, 0, mid + 2, 13, 0, MAT.PAD);
        for (let y = 7; y <= 13; y += 3) m.set(mid, y, 0, MAT.STRIPE);
        // Mur : béton, chemin de ronde, créneaux.
        m.box(1, wy, 1, L + 1, wy + 1, Hw, MAT.HULL2);
        m.box(1, wy, Hw, L + 1, wy + 1, Hw, MAT.HULL);
        for (let x = 1; x <= L + 1; x++) if (x % 2 === 0) m.set(x, wy, Hw + 1, MAT.HULL2);
        m.box(1, wy + 1, 2, L + 1, wy + 1, 2, MAT.ACCENT);
        // Portail : ouverture, linteau, porte coulissante entrouverte.
        m.box(mid - 2, wy, 1, mid + 2, wy + 1, Hw - 2, MAT.EMPTY);
        m.box(mid - 2, wy, Hw - 1, mid + 2, wy + 1, Hw - 1, MAT.METAL);
        m.box(mid - 2, wy, 1, mid - 1, wy, Hw - 2, MAT.DARK);
        m.set(mid, wy + 1, Hw + 1, MAT.LIGHT);
        // Barrière rayée et guérite vitrée devant le portail.
        m.box(mid - 3, wy + 3, 1, mid - 3, wy + 3, 2, MAT.HULL2);
        for (let x = mid - 2; x <= mid + 2; x++) m.set(x, wy + 3, 2, x % 2 ? MAT.STRIPE : MAT.ACCENT);
        const gx = mid + 3;
        m.box(gx, wy + 3, 0, gx + 3, wy + 6, 0, MAT.PAD);
        m.box(gx, wy + 3, 1, gx + 3, wy + 6, 1, MAT.HULL);
        m.box(gx, wy + 3, 2, gx + 3, wy + 6, 3, MAT.GLASS);
        m.box(gx + 1, wy + 4, 2, gx + 2, wy + 5, 3, MAT.EMPTY);
        m.box(gx + 1, wy + 4, 1, gx + 1, wy + 4, 2, MAT.HULL2);
        m.box(gx - 1, wy + 2, 4, gx + 4, wy + 7, 4, MAT.HULL2);
        m.set(gx + 3, wy + 6, 5, MAT.LIGHT);
        // Tours d'angle : fût, poste vitré en encorbellement, projecteur et balise.
        const tower = (x0) => {
          m.box(x0, wy - 1, 1, x0 + 3, wy + 2, Ht - 3, MAT.HULL2);
          m.box(x0, wy - 1, 1, x0 + 3, wy + 2, 1, MAT.PAD);
          m.box(x0 - 1, wy - 2, Ht - 2, x0 + 4, wy + 3, Ht - 2, MAT.HULL);
          m.box(x0 - 1, wy - 2, Ht - 1, x0 + 4, wy + 3, Ht - 1, MAT.DARK);
          for (let x = x0; x <= x0 + 3; x += 2) m.set(x, wy + 3, Ht - 1, MAT.WINDOW);
          m.set(x0 + 4, wy + 1, Ht - 1, MAT.WINDOW);
          m.box(x0 - 1, wy - 2, Ht, x0 + 4, wy + 3, Ht, MAT.HULL);
          m.box(x0 + 1, wy, Ht + 1, x0 + 2, wy + 1, Ht + 1, MAT.METAL);
        };
        tower(1); tower(L - 2);
        m.set(2, wy, Ht + 2, MAT.BEACON);
        m.set(L, wy + 1, Ht + 2, MAT.LIGHT);
        // Retour du mur vers l'avant depuis une tour.
        if (ret) {
          m.box(1, wy + 3, 1, 2, 13, Hw, MAT.HULL2);
          m.box(1, wy + 3, Hw, 2, 13, Hw, MAT.HULL);
          for (let y = wy + 3; y <= 13; y++) if (y % 2 === 0) m.set(1, y, Hw + 1, MAT.HULL2);
          m.box(2, wy + 3, 2, 2, 13, 2, MAT.ACCENT);
        }
        return m;
      }
    }
  ]);
})(typeof module === 'object' && module.exports ? require('../building-engine.js') : self.OrbiteBuildings);
