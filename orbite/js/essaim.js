/* ORBITE — la Genèse, ère II « L'Astéroïde », chapitre 1 « L'Essaim » (le stade créature de Spore).
 * Le planétésimal tourne autour d'une jeune étoile, dans une ceinture de rochers qui suivent tous
 * leur orbite. Deux façons de grandir :
 *   - percuter : foncer dans un rocher plus petit l'absorbe d'un coup, mais l'impact chauffe ;
 *   - capturer : glisser à côté sans le toucher (même orbite, faible vitesse relative) le met en
 *     orbite autour de soi : il devient une lune, qui pare les chocs.
 * Trois protoplanètes rivales grandissent aussi. But : devenir le système le plus massif de la ceinture.
 * Règles pures et déterministes (graine), testées sous Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteEssaim = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Le système ─────────────────────────────────────────────
  const GM = 1.6e6; // gravité de l'étoile : orbite circulaire à 1000 → vitesse 40
  const BELT = [820, 1240]; // la ceinture
  const ICE_LINE = 1050; // au-delà, la glace domine (la « ligne des glaces »)
  const RMIN = 640, RMAX = 1420; // on ne s'éloigne pas trop de la ceinture
  const SIZE = 8; // rayon = SIZE × ∛masse (des volumes)
  const VCAP = 12; // vitesse relative sous laquelle on capture (au-dessus, on percute)
  const THRUST = 70, BOOST = 55, BOOST_CD = 4;
  const HP = 100;
  const POP = 50;
  const GOAL_MIN = 26; // masse du système (vous + vos lunes) à atteindre, au moins
  const TIERS = [1, 3, 7, 14, 26]; // paliers de caméra (masse)
  const RIVALS = [
    { name: 'Vesta', R: 900, th: 2.1, M: 0.6, max: 4, k: 'roche' },
    { name: 'Pallas', R: 1010, th: 4.0, M: 1.8, max: 9, k: 'fer' },
    { name: 'Hygie', R: 1150, th: 5.4, M: 3.2, max: 18, k: 'glace' }
  ];
  const MATTERS = ['glace', 'roche', 'gaz', 'fer'];
  const TRAIT_NAMES = {
    predateur: { name: 'Prédateur', text: 'Vous avez grandi en percutant. Votre cœur sera chaud et agité.' },
    paisible: { name: 'Paisible', text: 'Vous avez grandi en capturant. Vos lunes vous suivront.' },
    adaptable: { name: 'Adaptable', text: 'Ni tout l’un ni tout l’autre : toutes les voies restent ouvertes.' }
  };

  // ─── Hasard déterministe ────────────────────────────────────
  function rand(e) {
    e.rs = (e.rs + 0x6D2B79F5) >>> 0;
    let t = e.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const between = (e, a, b) => a + (b - a) * rand(e);
  const radius = (M) => SIZE * Math.cbrt(M);
  const vcirc = (R) => Math.sqrt(GM / R);
  // Vitesse d'une orbite circulaire (sens direct) au point (x, y).
  function circVel(x, y) {
    const R = Math.hypot(x, y) || 1, v = vcirc(R);
    return { x: -y / R * v, y: x / R * v };
  }
  const tierOf = (M) => TIERS.reduce((cur, t, i) => (M >= t ? i : cur), 0);
  const viewWidth = (e) => 24 * radius(TIERS[tierOf(e.me.M)]);

  // ─── Nouveau chapitre ───────────────────────────────────────
  // from : l'ère I terminée { comp, trait, nature } (facultatif).
  function newGame(seed, from) {
    from = from || {};
    const R0 = 1000;
    const e = {
      v: 1, seed: seed >>> 0, rs: (seed ^ 0x51ED270B) >>> 0, t: 0, uid: 1,
      me: { x: R0, y: 0, vx: 0, vy: vcirc(R0), M: 1, hp: HP, heat: 0, boostCd: 0, hitAt: -9 },
      comp: Object.assign({ glace: 0, roche: 1, gaz: 0, fer: 0 }, from.comp || {}),
      trait1: from.trait || 'adaptable', nature1: from.nature || 'vie',
      sats: [], rivals: RIVALS.map((r, i) => ({ id: 'r' + i, name: r.name, R: r.R, th: r.th, M: r.M, max: r.max, k: r.k, alive: true, x: 0, y: 0 })),
      rocks: [], comets: [], tether: null,
      stats: { impacts: 0, soft: 0, captures: 0, rivalsEaten: 0, rivalsCaptured: 0, deaths: 0, heatSum: 0, blocks: 0, impactMass: 0, captureMass: 0 },
      cometAt: 25, events: [], done: false
    };
    if (e.comp.fer == null) e.comp.fer = 0;
    placeRivals(e);
    fill(e);
    return e;
  }
  function placeRivals(e) {
    for (const r of e.rivals) { r.x = Math.cos(r.th) * r.R; r.y = Math.sin(r.th) * r.R; }
  }
  // Un rocher sur une orbite circulaire, mesuré par rapport à la masse du joueur.
  function spawnRock(e, R, th) {
    const M = e.me.M, u = rand(e), outer = R >= ICE_LINE;
    const k = outer ? (u < 0.6 ? 'glace' : u < 0.88 ? 'roche' : 'gaz') : (u < 0.62 ? 'roche' : u < 0.88 ? 'fer' : 'glace');
    const c = rand(e);
    const ratio = c < 0.7 ? between(e, 0.004, 0.04) : c < 0.9 ? between(e, 0.04, 0.22) : between(e, 1.3, 3);
    const m = ratio * M * (k === 'gaz' ? 0.6 : 1);
    const rock = { id: e.uid++, k, R, th, w: vcirc(R) / R, m, r: radius(m), shape: (rand(e) * 1e6) | 0, x: 0, y: 0 };
    rock.x = Math.cos(th) * R; rock.y = Math.sin(th) * R;
    e.rocks.push(rock);
    return rock;
  }
  // Un point de la ceinture à une distance donnée du joueur.
  function beltPoint(e, d0, d1) {
    for (let i = 0; i < 12; i++) {
      const a = rand(e) * Math.PI * 2, d = between(e, d0, d1);
      const x = e.me.x + Math.cos(a) * d, y = e.me.y + Math.sin(a) * d, R = Math.hypot(x, y);
      if (R >= BELT[0] && R <= BELT[1]) return [R, Math.atan2(y, x)];
    }
    return null;
  }
  function fill(e) {
    const V = viewWidth(e);
    let n = 0;
    while (e.rocks.length < POP && n++ < 400) {
      const p = beltPoint(e, Math.max(3 * radius(e.me.M), 0.15 * V), 1.7 * V);
      if (p) spawnRock(e, p[0], p[1]);
    }
  }
  const maxSats = (e) => Math.min(8, 2 + Math.floor(e.me.M / 2));
  const systemMass = (e) => e.me.M + e.sats.reduce((s, x) => s + x.m, 0);
  const maxRival = (e) => Math.max(0, ...e.rivals.filter((r) => r.alive).map((r) => r.M));
  const goal = (e) => Math.max(GOAL_MIN, 1.25 * maxRival(e));
  const progress = (e) => Math.min(1, systemMass(e) / goal(e));
  // Rang par masse parmi votre système et les rivales encore là (1 = le plus massif).
  const rank = (e) => 1 + e.rivals.filter((r) => r.alive && r.M > systemMass(e)).length;

  // ─── Une étape ──────────────────────────────────────────────
  // input : { x, y } direction voulue (longueur 0..1), boost : bouton.
  function step(e, dt, input) {
    if (e.done) return e.events;
    input = input || {};
    e.t += dt;
    const me = e.me, r = radius(me.M);
    const R = Math.hypot(me.x, me.y) || 1;
    // Gravité de l'étoile, et des rivales plus massives (effet de fronde).
    let ax = -GM * me.x / (R * R * R), ay = -GM * me.y / (R * R * R);
    for (const rv of e.rivals) {
      if (!rv.alive || rv.M <= me.M) continue;
      const dx = rv.x - me.x, dy = rv.y - me.y, d2 = dx * dx + dy * dy + 400, d = Math.sqrt(d2);
      const a = 2600 * rv.M / d2;
      ax += dx / d * a; ay += dy / d * a;
    }
    let ix = input.x || 0, iy = input.y || 0;
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    ax += ix * THRUST; ay += iy * THRUST;
    me.boostCd = Math.max(0, me.boostCd - dt);
    if (input.boost && me.boostCd <= 0) {
      const l = Math.hypot(ix, iy);
      let bx = ix, by = iy;
      if (l < 0.1) { const sp = Math.hypot(me.vx, me.vy) || 1; bx = me.vx / sp; by = me.vy / sp; } else { bx /= l; by /= l; }
      me.vx += bx * BOOST; me.vy += by * BOOST;
      me.boostCd = BOOST_CD;
      e.events.push({ t: 'boost' });
    }
    me.vx += ax * dt; me.vy += ay * dt;
    // Assistance d'orbite : sans le doigt, on se range doucement sur une orbite circulaire.
    const cv = circVel(me.x, me.y);
    const k = Math.min(1, (il > 0.1 ? 0.25 : 0.9) * dt);
    me.vx += (cv.x - me.vx) * k; me.vy += (cv.y - me.vy) * k;
    // Vitesse relative à l'orbite locale, bornée.
    const rvx = me.vx - cv.x, rvy = me.vy - cv.y, rs = Math.hypot(rvx, rvy), cap = 110;
    if (rs > cap) { me.vx = cv.x + rvx / rs * cap; me.vy = cv.y + rvy / rs * cap; }
    me.x += me.vx * dt; me.y += me.vy * dt;
    // On reste autour de la ceinture.
    const R2 = Math.hypot(me.x, me.y);
    if (R2 < RMIN || R2 > RMAX) {
      const target = R2 < RMIN ? RMIN : RMAX, f = target / R2;
      me.x += (me.x * f - me.x) * Math.min(1, 2 * dt); me.y += (me.y * f - me.y) * Math.min(1, 2 * dt);
    }

    // Rochers et rivales sur leurs orbites ; les lunes autour de vous.
    for (const k2 of e.rocks) { k2.th += k2.w * dt; k2.x = Math.cos(k2.th) * k2.R; k2.y = Math.sin(k2.th) * k2.R; }
    for (const rv of e.rivals) {
      if (!rv.alive) continue;
      rv.th += vcirc(rv.R) / rv.R * dt;
      rv.M = Math.min(rv.max, rv.M + 0.025 * dt);
      rv.x = Math.cos(rv.th) * rv.R; rv.y = Math.sin(rv.th) * rv.R;
    }
    e.sats.forEach((s, i) => {
      s.ang += s.w * dt;
      s.d = r * (1.8 + 0.55 * i) + s.r;
    });
    // Chaleur : elle retombe ; trop haute, la croûte se fissure.
    me.heat = Math.max(0, me.heat - 4 * dt);
    if (me.heat > 80) { me.hp -= 8 * dt * (me.heat - 80) / 20; if (rand(e) < dt * 1.5) e.events.push({ t: 'crack' }); }
    if (e.t - me.hitAt > 3 && me.heat < 60) me.hp = Math.min(HP, me.hp + (e.trait1 === 'adaptable' ? 6 : 3) * dt);

    capture(e, dt);
    collide(e);
    comets(e, dt);
    // Ménage et renouvellement des rochers hors de la vue.
    const V = viewWidth(e);
    e.rocks = e.rocks.filter((k2) => Math.hypot(k2.x - me.x, k2.y - me.y) < 2.3 * V);
    let n = 0;
    while (e.rocks.length < POP && n++ < 8) { const p = beltPoint(e, 1.15 * V, 1.7 * V); if (p) spawnRock(e, p[0], p[1]); }
    if (me.hp <= 0) die(e);
    // Victoire : le système le plus massif de la ceinture (vous et vos lunes), assez massif.
    if (systemMass(e) >= goal(e)) { e.done = true; e.events.push({ t: 'end' }); }
    return e.events;
  }

  // Capture : le corps plus petit le plus proche, à portée, presque à la même vitesse.
  function capture(e, dt) {
    const me = e.me, r = radius(me.M);
    const reach = r * (e.trait1 === 'paisible' ? 4.2 : 3.2), time = e.trait1 === 'paisible' ? 1 : 1.6;
    let best = null, bd = 1e9;
    if (e.sats.length < maxSats(e)) {
      const cands = e.rocks.filter((k) => k.m < me.M * 0.7).map((k) => ({ o: k, rival: false }))
        .concat(e.rivals.filter((rv) => rv.alive && rv.M * 1.6 < me.M).map((rv) => ({ o: rv, rival: true })));
      for (const c of cands) {
        const o = c.o, d = Math.hypot(o.x - me.x, o.y - me.y), orr = c.rival ? radius(o.M) : o.r;
        if (d > reach + orr || d < r + orr) continue;
        const ov = circVel(o.x, o.y), rel = Math.hypot(me.vx - ov.x, me.vy - ov.y);
        if (rel > VCAP) continue;
        if (d < bd) { bd = d; best = c; }
      }
    }
    if (!best) { if (e.tether) e.tether.p = Math.max(0, e.tether.p - dt * 2); if (e.tether && e.tether.p <= 0) e.tether = null; return; }
    if (!e.tether || e.tether.id !== best.o.id) e.tether = { id: best.o.id, p: 0, rival: best.rival };
    e.tether.p += dt / time;
    if (e.tether.p < 1) return;
    e.tether = null;
    const o = best.o, i = e.sats.length;
    e.stats.captureMass += best.rival ? o.M : o.m;
    if (best.rival) {
      o.alive = false;
      e.stats.rivalsCaptured++;
      e.sats.push({ id: 'm' + e.uid++, k: o.k, m: o.M, r: radius(o.M) * 0.8, big: true, name: o.name, ang: rand(e) * 6.28, w: 0.9 / (1 + i * 0.4), d: 0, blockAt: -99, shape: (rand(e) * 1e6) | 0 });
      e.events.push({ t: 'capture', big: true, name: o.name, x: o.x, y: o.y });
    } else {
      e.rocks = e.rocks.filter((k) => k !== o);
      e.stats.captures++;
      e.sats.push({ id: 's' + o.id, k: o.k, m: o.m, r: o.r, big: false, ang: Math.atan2(o.y - e.me.y, o.x - e.me.x), w: 1.4 / (1 + i * 0.4), d: 0, blockAt: -99, shape: o.shape });
      e.events.push({ t: 'capture', x: o.x, y: o.y, k: o.k });
    }
  }
  // Une lune disponible pare le choc (puis il lui faut 8 s).
  function block(e) {
    const s = e.sats.find((x) => e.t - x.blockAt >= 8);
    if (!s) return false;
    s.blockAt = e.t;
    e.stats.blocks++;
    e.events.push({ t: 'block', id: s.id });
    return true;
  }
  function hurt(e, dmg, ox, oy) {
    const me = e.me;
    const d = Math.hypot(me.x - ox, me.y - oy) || 1;
    const cv = circVel(me.x, me.y);
    me.vx = cv.x + (me.x - ox) / d * 30; me.vy = cv.y + (me.y - oy) / d * 30;
    if (e.t - me.hitAt < 0.8) return;
    me.hitAt = e.t;
    if (block(e)) return;
    me.hp -= dmg;
    e.events.push({ t: 'hit', dmg, x: ox, y: oy });
  }
  function absorb(e, m, k, rel, x, y) {
    const me = e.me, violent = rel >= VCAP;
    const gain = m * (violent ? (e.trait1 === 'predateur' ? 0.65 : 0.5) : 0.55);
    me.M += gain;
    e.comp[k] = (e.comp[k] || 0) + gain;
    if (violent) {
      // L'impact chauffe selon la vitesse et la taille de ce qu'on percute.
      const h = Math.min(45, rel * 0.9 * (0.1 + 3 * m / me.M));
      me.heat += h;
      e.stats.heatSum += h;
      e.stats.impacts++;
      e.stats.impactMass += gain;
    } else { me.heat += 1; e.stats.soft++; }
    e.events.push({ t: violent ? 'impact' : 'eat', k, x, y, m, rel });
  }
  function collide(e) {
    const me = e.me, r = radius(me.M);
    for (let i = e.rocks.length - 1; i >= 0; i--) {
      const k = e.rocks[i];
      const d = Math.hypot(k.x - me.x, k.y - me.y);
      if (d > r + k.r) continue;
      const ov = circVel(k.x, k.y), rel = Math.hypot(me.vx - ov.x, me.vy - ov.y);
      if (k.m < me.M) { e.rocks.splice(i, 1); absorb(e, k.m, k.k, rel, k.x, k.y); continue; }
      hurt(e, Math.round(12 + rel * 0.4), k.x, k.y);
    }
    // Vos lunes balaient les petits rochers qu'elles touchent : elles grossissent, sans vous chauffer.
    for (const sat of e.sats) {
      const sx = me.x + Math.cos(sat.ang) * sat.d, sy = me.y + Math.sin(sat.ang) * sat.d;
      for (let i = e.rocks.length - 1; i >= 0; i--) {
        const k = e.rocks[i];
        if (k.m >= me.M * 0.3 || sat.m >= me.M * 0.7 || Math.hypot(k.x - sx, k.y - sy) > sat.r + k.r) continue;
        e.rocks.splice(i, 1);
        const gain = k.m * 0.6;
        sat.m += gain;
        sat.r = radius(sat.m) * (sat.big ? 0.8 : 1);
        e.stats.captureMass += gain;
        e.comp[k.k] = (e.comp[k.k] || 0) + gain * 0.5;
        e.events.push({ t: 'sweep', x: k.x, y: k.y, k: k.k });
      }
    }
    for (const rv of e.rivals) {
      if (!rv.alive) continue;
      const d = Math.hypot(rv.x - me.x, rv.y - me.y);
      if (d > r + radius(rv.M)) continue;
      const ov = circVel(rv.x, rv.y), rel = Math.hypot(me.vx - ov.x, me.vy - ov.y);
      if (rv.M < me.M * 0.9) {
        rv.alive = false;
        e.stats.rivalsEaten++;
        absorb(e, rv.M, rv.k, Math.max(rel, VCAP), rv.x, rv.y);
        e.events.push({ t: 'rival', name: rv.name, x: rv.x, y: rv.y });
      } else {
        // Plus grosse que vous : elle vous arrache un peu de matière.
        const lost = me.M * 0.08;
        me.M -= lost; rv.M += lost;
        hurt(e, Math.round(18 + rel * 0.5), rv.x, rv.y);
      }
    }
  }
  // Comètes : elles traversent la ceinture en ligne droite, très vite.
  function comets(e, dt) {
    const me = e.me, r = radius(me.M);
    e.cometAt -= dt;
    if (e.cometAt <= 0) {
      e.cometAt = between(e, 28, 48);
      const V = viewWidth(e), a = rand(e) * Math.PI * 2;
      const x = me.x + Math.cos(a) * 1.2 * V, y = me.y + Math.sin(a) * 1.2 * V;
      const aim = Math.atan2(me.y - y, me.x - x) + between(e, -0.12, 0.12), sp = 160;
      e.comets.push({ id: e.uid++, x, y, vx: Math.cos(aim) * sp + me.vx, vy: Math.sin(aim) * sp + me.vy, r: r * 0.45, m: me.M * 0.06, life: 6 });
    }
    for (let i = e.comets.length - 1; i >= 0; i--) {
      const c = e.comets[i];
      c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt;
      if (c.life <= 0) { e.comets.splice(i, 1); continue; }
      if (Math.hypot(c.x - me.x, c.y - me.y) > r + c.r) continue;
      e.comets.splice(i, 1);
      if (block(e)) continue;
      // La comète apporte sa glace, mais le choc chauffe et blesse.
      absorb(e, c.m, 'glace', 60, c.x, c.y);
      hurt(e, 14, c.x, c.y);
    }
  }
  // Fissuré de part en part : on perd de la masse et la moitié de ses lunes.
  function die(e) {
    const me = e.me;
    e.stats.deaths++;
    me.M = Math.max(1, me.M * 0.85);
    me.hp = HP; me.heat = 0; me.hitAt = e.t;
    const lost = e.sats.splice(Math.ceil(e.sats.length / 2));
    for (const s of lost) if (!s.big) { const p = beltPoint(e, 1.2 * viewWidth(e), 1.6 * viewWidth(e)); if (p) spawnRock(e, p[0], p[1]); }
    e.events.push({ t: 'death', lost: lost.length });
  }

  // ─── Bilan ──────────────────────────────────────────────────
  // Trait du chapitre : la masse gagnée en percutant contre celle gagnée en capturant.
  function trait(e) {
    const hit = e.stats.impactMass || 0, cap = e.stats.captureMass || 0;
    if (hit > cap * 1.6) return 'predateur';
    if (cap > hit * 1.2) return 'paisible';
    return 'adaptable';
  }
  function shares(e) {
    const t = MATTERS.reduce((s, k) => s + (e.comp[k] || 0), 0) || 1;
    const o = {};
    for (const k of MATTERS) o[k] = (e.comp[k] || 0) / t;
    return o;
  }
  function serialize(e) {
    return { v: 1, seed: e.seed, rs: e.rs, t: e.t, uid: e.uid, me: e.me, comp: e.comp, trait1: e.trait1, nature1: e.nature1, sats: e.sats, rivals: e.rivals, stats: e.stats, cometAt: e.cometAt, done: e.done };
  }
  function restore(o) {
    if (!o || o.v !== 1) return null;
    const e = newGame(o.seed, {});
    Object.assign(e, { rs: o.rs >>> 0, t: o.t || 0, uid: o.uid || 1, comp: o.comp, trait1: o.trait1, nature1: o.nature1, sats: o.sats || [], rivals: o.rivals, stats: Object.assign(e.stats, o.stats), cometAt: o.cometAt || 25, done: !!o.done });
    Object.assign(e.me, o.me);
    e.rocks = [];
    fill(e);
    const r = radius(e.me.M);
    e.rocks = e.rocks.filter((k) => !(k.m >= e.me.M && Math.hypot(k.x - e.me.x, k.y - e.me.y) < 6 * r));
    return e;
  }

  return {
    GM, BELT, ICE_LINE, SIZE, VCAP, HP, TIERS, RIVALS, MATTERS, TRAIT_NAMES, GOAL_MIN,
    newGame, step, radius, circVel, vcirc, viewWidth, tierOf, maxSats, systemMass, maxRival, goal, progress, rank, trait, shares, serialize, restore
  };
});
