/* ORBITE — la Genèse, campagne façon Spore : d'un grain de poussière à un système vivant.
 * Ère I, « La Poussière » (l'équivalent de l'étape cellule de Spore) : un grain dérive dans la
 * nébuleuse, absorbe ce qui est plus petit que lui et fuit ce qui est plus gros. Ce qu'il mange
 * (glace, roche, gaz) décide de sa nature future ; sa façon de jouer lui donne un trait pour
 * l'ère suivante. Règles pures et déterministes (graine), testées sous Node. Unités : le rayon
 * du joueur sert d'étalon ; tout se mesure en « rayons » (r) au moment où c'est créé. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteGenese = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Ère I : paliers de masse ───────────────────────────────
  // Chaque palier franchi ouvre le Façonnage et donne un emplacement de plus.
  const LEVELS = [
    { at: 1, name: 'Grain' },
    { at: 4, name: 'Gravier' },
    { at: 16, name: 'Caillou' },
    { at: 60, name: 'Rocher' },
    { at: 200, name: 'Bloc' }
  ];
  const END_MASS = 600; // le Bloc devient un planétésimal : fin de l'ère I
  const MATTERS = ['glace', 'roche', 'gaz'];
  const EAT_EFF = { glace: 0.21, roche: 0.2, gaz: 0.15, comete: 0.25 };
  // Densité : le gaz, gonflé, pèse bien moins que la roche à taille égale.
  const DENS = { glace: 0.9, roche: 1, gaz: 0.3, errant: 1, comete: 0.9, etincelle: 0, fragment: 0 };
  const HP = 100;

  // ─── Façonnage (l'éditeur) ──────────────────────────────────
  // Les quatre premières pièces sont connues ; les autres se trouvent dans les fragments d'astres.
  const PARTS = {
    jets: { cat: 'mouvement', name: 'Jets de gaz', text: 'Vitesse +35 %.', cost: 20, base: true },
    eruption: { cat: 'mouvement', name: 'Éruption', text: 'Bouton : une poussée fulgurante, pour fuir ou frapper.', cost: 30, base: true },
    voile: { cat: 'mouvement', name: 'Voile solaire', text: 'Vitesse +20 %, réparation deux fois plus rapide.', cost: 35 },
    aimant: { cat: 'capture', name: 'Champ magnétique', text: 'Attire la matière absorbable proche.', cost: 25, base: true },
    gravite: { cat: 'capture', name: 'Noyau dense', text: 'Attire la matière de bien plus loin, même les gros morceaux absorbables.', cost: 55 },
    croute: { cat: 'defense', name: 'Croûte épaisse', text: 'Solidité +50.', cost: 25, base: true },
    givre: { cat: 'defense', name: 'Bouclier de givre', text: 'Annule un choc toutes les 10 s.', cost: 45 },
    pointes: { cat: 'attaque', name: 'Pointes de roche', text: 'Pendant une Éruption, brise les astres jusqu’à 2,4 fois votre taille.', cost: 40 },
    decharge: { cat: 'attaque', name: 'Décharge', text: 'Bouton : repousse et étourdit tout ce qui vous entoure.', cost: 50 },
    oeil: { cat: 'sens', name: 'Œil stellaire', text: 'Voit 30 % plus loin et signale les chasseurs hors de vue.', cost: 20 }
  };
  const CATS = { mouvement: 'MOUVEMENT', capture: 'CAPTURE', defense: 'DÉFENSE', attaque: 'ATTAQUE', sens: 'SENS' };
  const slotsAt = (lvl) => 1 + lvl;

  // Nature à venir selon ce qui a été absorbé (le régime alimentaire de Spore).
  const NATURES = {
    eau: { name: 'Monde d’eau', text: 'La glace domine : votre astre deviendra un océan sans rivage.' },
    feu: { name: 'Monde de feu', text: 'La roche domine : votre astre deviendra une forge de lave.' },
    etoile: { name: 'Géante, puis étoile', text: 'Le gaz domine : votre astre pourra s’embraser et devenir un soleil.' },
    vie: { name: 'Monde vivant', text: 'Un équilibre rare de glace, de roche et de gaz : la vie pourra y naître.' }
  };
  // Trait gagné selon la façon de jouer (les « cartes de conséquence » de Spore).
  const TRAITS = {
    predateur: { name: 'Prédateur', text: 'Vous avez brisé vos rivaux. À l’ère suivante, vos impacts frappent plus fort.' },
    paisible: { name: 'Paisible', text: 'Vous avez grandi sans briser personne. À l’ère suivante, les petits astres viennent plus volontiers à vous.' },
    adaptable: { name: 'Adaptable', text: 'Ni proie ni chasseur. À l’ère suivante, vous vous réparez plus vite.' }
  };

  // ─── Hasard déterministe ────────────────────────────────────
  function rand(g) {
    g.rs = (g.rs + 0x6D2B79F5) >>> 0;
    let t = g.rs;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const between = (g, a, b) => a + (b - a) * rand(g);
  function hash2(seed, x, y) {
    let h = (seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // Bruit de valeur lissé : les régions de la nébuleuse (glacée, rocheuse, gazeuse).
  function noise(seed, x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const s = (t) => t * t * (3 - 2 * t);
    const a = hash2(seed, xi, yi), b = hash2(seed, xi + 1, yi), c = hash2(seed, xi, yi + 1), d = hash2(seed, xi + 1, yi + 1);
    return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
  }
  // Une région mesure environ ZONE rayons du grain : elle grandit avec lui, pour rester à
  // l'échelle de ce qu'il voit (quelques écrans).
  const ZONE = 30;
  function zoneAt(seed, x, y, r) {
    const z = ZONE * (r || 1);
    const w = MATTERS.map((m, i) => Math.pow(noise(seed + i * 7919, x / z, y / z), 2.2) + 0.08);
    const t = w[0] + w[1] + w[2];
    return { glace: w[0] / t, roche: w[1] / t, gaz: w[2] / t };
  }

  // ─── Nouvelle Genèse ────────────────────────────────────────
  function newGame(seed) {
    const g = {
      v: 1, era: 1, seed: seed >>> 0, rs: (seed ^ 0x9E3779B9) >>> 0, t: 0, uid: 1,
      me: { x: 0, y: 0, vx: 0, vy: 0, m: 1, hp: HP, hitAt: -9, dashT: 0, dashCd: 0, pulseCd: 0, shieldAt: -99, face: 0 },
      comp: { glace: 0, roche: 1, gaz: 0 },
      lvl: 0, sparks: 0,
      owned: Object.keys(PARTS).filter((k) => PARTS[k].base),
      parts: [],
      stats: { eaten: 0, shattered: 0, fragments: 0, deaths: 0, pulses: 0, sparks: 0 },
      bodies: [], fragAt: 40, cometAt: 30, events: [], done: false
    };
    fill(g);
    return g;
  }
  const radius = (m) => Math.sqrt(m);
  const levelOf = (m) => LEVELS.reduce((cur, l, i) => (m >= l.at ? i : cur), 0);
  const has = (g, k) => g.parts.includes(k);
  const maxHp = (g) => HP + (has(g, 'croute') ? 50 : 0);
  // La caméra reste fixe pendant un palier (on voit le grain grossir à l'écran), puis recule d'un
  // coup au palier suivant. Largeur de la vue, en unités du monde.
  const viewWidth = (g) => 30 * radius(LEVELS[levelOf(g.me.m)].at) * (has(g, 'oeil') ? 1.3 : 1);

  // Un corps céleste, mesuré par rapport au rayon du joueur.
  function spawnBody(g, x, y) {
    const r = radius(g.me.m);
    const z = zoneAt(g.seed, x, y, r);
    const u = rand(g);
    let k = u < z.glace ? 'glace' : u < z.glace + z.roche ? 'roche' : 'gaz';
    let s;
    const cls = rand(g);
    let hunter = false;
    if (k === 'gaz') s = between(g, 0.35, 1.3);
    else if (cls < 0.62) s = between(g, 0.15, 0.5);
    else if (cls < 0.76) s = between(g, 0.5, 0.9);
    else if (cls < 0.97) {
      s = between(g, 1.1, 2.6);
      // Les errants : des rocs sombres, certains chassent.
      if (rand(g) < 0.55) { k = 'errant'; hunter = rand(g) < 0.5; }
    } else { k = 'etincelle'; s = 0.35; }
    const sp = between(g, 0.2, 1.1) * r, a = rand(g) * Math.PI * 2;
    const b = { id: g.uid++, k, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: s * r, spin: rand(g) * 6.28, shape: (rand(g) * 1e6) | 0, hunter, stun: 0 };
    b.m = b.r * b.r * DENS[k];
    g.bodies.push(b);
    return b;
  }
  function ringPoint(g, r0, r1) {
    const a = rand(g) * Math.PI * 2, d = between(g, r0, r1);
    return [g.me.x + Math.cos(a) * d, g.me.y + Math.sin(a) * d];
  }
  const POP = 62;
  // Au départ (et après une renaissance), la nébuleuse est peuplée tout autour.
  function fill(g) {
    const r = radius(g.me.m), V = viewWidth(g);
    while (g.bodies.length < POP) {
      const [x, y] = ringPoint(g, Math.max(5 * r, 0.2 * V), 1.65 * V);
      spawnBody(g, x, y);
    }
  }
  function spawnFragment(g) {
    const r = radius(g.me.m);
    const V = viewWidth(g);
    const [x, y] = ringPoint(g, 1.3 * V, 1.6 * V);
    g.bodies.push({ id: g.uid++, k: 'fragment', x, y, vx: 0, vy: 0, r: 0.6 * r, m: 0, spin: 0, shape: 0 });
  }
  function spawnComet(g) {
    const r = radius(g.me.m);
    const a = rand(g) * Math.PI * 2;
    const d = 1.3 * viewWidth(g);
    const x = g.me.x + Math.cos(a) * d, y = g.me.y + Math.sin(a) * d;
    // Elle traverse en visant à peu près le joueur.
    const aim = Math.atan2(g.me.y - y, g.me.x - x) + between(g, -0.25, 0.25), sp = 13 * r;
    const s = between(g, 0.7, 1.5);
    g.bodies.push({ id: g.uid++, k: 'comete', x, y, vx: Math.cos(aim) * sp, vy: Math.sin(aim) * sp, r: s * r, m: s * s * r * r * DENS.comete, spin: 0, shape: 0, life: 9 });
  }
  const lockedParts = (g) => Object.keys(PARTS).filter((k) => !g.owned.includes(k));

  // ─── Une étape de simulation ────────────────────────────────
  // input : { x, y } direction voulue (longueur 0..1), dash, pulse : boutons.
  function step(g, dt, input) {
    if (g.done) return g.events;
    input = input || {};
    g.t += dt;
    const me = g.me, r = radius(me.m);
    // Mouvement : accélération vers la direction voulue, frottement du vide.
    const speedK = 1 + (has(g, 'jets') ? 0.35 : 0) + (has(g, 'voile') ? 0.2 : 0);
    const vmax = 7 * r * speedK;
    let ix = input.x || 0, iy = input.y || 0;
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }
    me.vx += ix * vmax * 4 * dt;
    me.vy += iy * vmax * 4 * dt;
    if (il > 0.1) me.face = Math.atan2(iy, ix);
    me.dashCd = Math.max(0, me.dashCd - dt);
    me.pulseCd = Math.max(0, me.pulseCd - dt);
    if (input.dash && has(g, 'eruption') && me.dashCd <= 0) {
      const a = il > 0.1 ? Math.atan2(iy, ix) : me.face;
      me.vx = Math.cos(a) * vmax * 3;
      me.vy = Math.sin(a) * vmax * 3;
      me.dashT = 0.4;
      me.dashCd = 3.5;
      g.events.push({ t: 'dash' });
    }
    if (input.pulse && has(g, 'decharge') && me.pulseCd <= 0) {
      me.pulseCd = 8;
      g.stats.pulses++;
      for (const b of g.bodies) {
        const dx = b.x - me.x, dy = b.y - me.y, d = Math.hypot(dx, dy) || 1;
        if (d < 8 * r) { b.vx = dx / d * 11 * r; b.vy = dy / d * 11 * r; b.stun = 3; }
      }
      g.events.push({ t: 'pulse' });
    }
    me.dashT = Math.max(0, me.dashT - dt);
    const sp = Math.hypot(me.vx, me.vy), cap = me.dashT > 0 ? vmax * 3 : vmax;
    if (sp > cap) { me.vx *= cap / sp; me.vy *= cap / sp; }
    const fr = Math.pow(0.35, dt);
    if (me.dashT <= 0) { me.vx *= fr; me.vy *= fr; }
    me.x += me.vx * dt;
    me.y += me.vy * dt;
    // Réparation lente, loin des chocs.
    if (g.t - me.hitAt > 3) me.hp = Math.min(maxHp(g), me.hp + (has(g, 'voile') ? 6 : 3) * dt);

    // Les corps : dérive, chasse, attraction.
    const pull = has(g, 'gravite') ? { d: 10 * r, v: 5 * r, s: 0.95 } : has(g, 'aimant') ? { d: 5 * r, v: 3 * r, s: 0.6 } : null;
    for (const b of g.bodies) {
      b.stun = Math.max(0, (b.stun || 0) - dt);
      const dx = me.x - b.x, dy = me.y - b.y, d = Math.hypot(dx, dy) || 1;
      if (b.hunter && !b.stun && b.r > r && d < 16 * r) {
        // Il fonce sur vous, moins vite que vous ne fuyez.
        b.vx += dx / d * 6 * r * dt;
        b.vy += dy / d * 6 * r * dt;
        const bs = Math.hypot(b.vx, b.vy), bmax = 4.6 * r;
        if (bs > bmax) { b.vx *= bmax / bs; b.vy *= bmax / bs; }
      }
      if (pull && edible(g, b, r) && b.r < r * pull.s && d < pull.d) {
        b.x += dx / d * pull.v * dt;
        b.y += dy / d * pull.v * dt;
      }
      if (b.k !== 'comete' && !b.hunter) { b.vx *= Math.pow(0.9, dt); b.vy *= Math.pow(0.9, dt); }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin += dt * 0.6;
      if (b.life != null) b.life -= dt;
    }

    // Contacts.
    for (let i = g.bodies.length - 1; i >= 0; i--) {
      const b = g.bodies[i];
      if (!b) continue;
      const dx = b.x - me.x, dy = b.y - me.y, d = Math.hypot(dx, dy);
      if (d > b.r + r) continue;
      if (b.k === 'fragment') {
        g.bodies.splice(i, 1);
        const free = lockedParts(g);
        g.stats.fragments++;
        if (free.length) {
          const k = free[Math.floor(rand(g) * free.length)];
          g.owned.push(k);
          g.events.push({ t: 'fragment', part: k, x: b.x, y: b.y });
        } else { g.sparks += 15; g.stats.sparks += 15; g.events.push({ t: 'spark', n: 15, x: b.x, y: b.y }); }
        continue;
      }
      if (b.k === 'etincelle') {
        g.bodies.splice(i, 1);
        g.sparks += 4;
        g.stats.sparks += 4;
        g.events.push({ t: 'spark', n: 4, x: b.x, y: b.y });
        continue;
      }
      if (edible(g, b, r)) { eat(g, i); continue; }
      // Plus gros que vous : on le brise (Éruption + Pointes) ou il vous heurte.
      if (me.dashT > 0 && has(g, 'pointes') && b.r < r * 2.4) { shatter(g, i); continue; }
      hit(g, b, dx, dy, d);
    }
    // Ménage : ce qui est trop loin disparaît ; de nouveaux corps arrivent par les bords.
    // Le décor se renouvelle hors de la vue (anneau autour de l'écran).
    const V = viewWidth(g), far = 2 * V;
    g.bodies = g.bodies.filter((b) => (b.life == null || b.life > 0) && Math.hypot(b.x - me.x, b.y - me.y) < (b.k === 'fragment' ? far * 1.5 : far));
    let n = 0;
    while (g.bodies.length < POP && n++ < 6) { const [x, y] = ringPoint(g, 1.25 * V, 1.65 * V); spawnBody(g, x, y); }
    g.fragAt -= dt;
    if (g.fragAt <= 0) {
      g.fragAt = between(g, 55, 85);
      if (lockedParts(g).length && !g.bodies.some((b) => b.k === 'fragment')) spawnFragment(g);
    }
    g.cometAt -= dt;
    if (g.cometAt <= 0) { g.cometAt = between(g, 22, 40); spawnComet(g); }
    // Mort : le grain se disperse puis se reforme, un peu plus petit.
    if (me.hp <= 0) {
      g.stats.deaths++;
      me.m = Math.max(1, me.m * 0.85);
      me.hp = maxHp(g);
      me.vx = me.vy = 0;
      me.hitAt = g.t;
      const rr = radius(me.m);
      g.bodies = g.bodies.filter((b) => !(b.r > rr && Math.hypot(b.x - me.x, b.y - me.y) < 14 * rr));
      g.events.push({ t: 'death' });
    }
    return g.events;
  }
  // Absorbable : plus petit que soi ; le gaz, mou, jusqu'à 1,4 fois sa taille.
  function edible(g, b, r) {
    if (b.k === 'errant' || b.k === 'fragment' || b.k === 'etincelle') return false;
    return b.r < r * (b.k === 'gaz' ? 1.4 : 0.95);
  }
  function eat(g, i) {
    const b = g.bodies[i], me = g.me;
    g.bodies.splice(i, 1);
    const ratio = b.m / me.m;
    const gain = b.m * EAT_EFF[b.k];
    const before = levelOf(me.m);
    me.m += gain;
    const mat = b.k === 'comete' ? 'glace' : b.k;
    g.comp[mat] += gain;
    const sparks = Math.round(5 * ratio + 0.35);
    g.sparks += sparks;
    g.stats.sparks += sparks;
    g.stats.eaten++;
    g.events.push({ t: 'eat', k: b.k, x: b.x, y: b.y, r: b.r, sparks });
    const after = levelOf(me.m);
    if (after > before) g.events.push({ t: 'level', lvl: after });
    if (me.m >= END_MASS) { g.done = true; g.events.push({ t: 'end' }); }
  }
  function shatter(g, i) {
    const b = g.bodies[i];
    g.bodies.splice(i, 1);
    g.stats.shattered++;
    g.sparks += 3;
    g.stats.sparks += 3;
    const kind = b.k === 'errant' ? 'roche' : b.k;
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 + rand(g), pr = b.r / Math.sqrt(5);
      g.bodies.push({ id: g.uid++, k: kind, x: b.x + Math.cos(a) * pr, y: b.y + Math.sin(a) * pr, vx: Math.cos(a) * 3 * pr, vy: Math.sin(a) * 3 * pr, r: pr, m: pr * pr * DENS[kind], spin: rand(g) * 6, shape: (rand(g) * 1e6) | 0, hunter: false, stun: 0 });
    }
    g.events.push({ t: 'shatter', x: b.x, y: b.y, r: b.r });
  }
  function hit(g, b, dx, dy, d) {
    const me = g.me, r = radius(me.m);
    d = d || 1;
    // Rebond : on sort du contact.
    const push = (b.r + r - d) + 0.01;
    me.x -= dx / d * push;
    me.y -= dy / d * push;
    me.vx = -dx / d * 6 * r;
    me.vy = -dy / d * 6 * r;
    if (g.t - me.hitAt < 0.8) return;
    me.hitAt = g.t;
    if (has(g, 'givre') && g.t - me.shieldAt >= 10) { me.shieldAt = g.t; g.events.push({ t: 'shield' }); return; }
    const dmg = Math.round((b.k === 'comete' ? 25 : 18) * Math.min(2.5, b.r / r));
    me.hp -= dmg;
    if (b.hunter) b.stun = 1.5;
    g.events.push({ t: 'hit', dmg, x: b.x, y: b.y });
  }

  // ─── Façonnage ──────────────────────────────────────────────
  function canInstall(g, k) {
    const p = PARTS[k];
    if (!p) return { ok: false, reason: 'Pièce inconnue.' };
    if (!g.owned.includes(k)) return { ok: false, reason: 'Trouvez un fragment d’astre pour la découvrir.' };
    if (has(g, k)) return { ok: false, reason: 'Déjà en place.' };
    if (g.parts.length >= slotsAt(g.lvl)) return { ok: false, reason: 'Plus de place : grandissez pour en gagner.' };
    if (g.sparks < p.cost) return { ok: false, reason: 'Pas assez d’étincelles.' };
    return { ok: true };
  }
  function install(g, k) {
    const c = canInstall(g, k);
    if (!c.ok) return c;
    g.sparks -= PARTS[k].cost;
    g.parts.push(k);
    if (k === 'croute') g.me.hp += 50;
    return { ok: true };
  }
  // Retirer une pièce rend tout son prix (comme dans Spore).
  function remove(g, k) {
    if (!has(g, k)) return { ok: false };
    g.parts = g.parts.filter((x) => x !== k);
    g.sparks += PARTS[k].cost;
    g.me.hp = Math.min(g.me.hp, maxHp(g));
    return { ok: true };
  }
  // Le palier ne monte qu'à l'ouverture du Façonnage (l'interface l'appelle à chaque « level »).
  function syncLevel(g) { g.lvl = Math.max(g.lvl, levelOf(g.me.m)); return g.lvl; }

  // ─── Bilan ──────────────────────────────────────────────────
  function shares(g) {
    const t = g.comp.glace + g.comp.roche + g.comp.gaz || 1;
    return { glace: g.comp.glace / t, roche: g.comp.roche / t, gaz: g.comp.gaz / t };
  }
  function nature(g) {
    const s = shares(g);
    if (s.glace >= 0.5) return 'eau';
    if (s.roche >= 0.5) return 'feu';
    if (s.gaz >= 0.5) return 'etoile';
    return 'vie';
  }
  function trait(g) {
    if (g.stats.shattered >= 12) return 'predateur';
    if (g.stats.shattered <= 2) return 'paisible';
    return 'adaptable';
  }
  // Progression vers le palier suivant (0..1), sur une échelle logarithmique.
  function progress(g) {
    const m = g.me.m, l = levelOf(m);
    const a = LEVELS[l].at, b = l + 1 < LEVELS.length ? LEVELS[l + 1].at : END_MASS;
    return Math.max(0, Math.min(1, Math.log(m / a) / Math.log(b / a)));
  }
  // Sauvegarde : le monde autour se régénère, seul le joueur est gardé.
  function serialize(g) {
    return { v: 1, era: g.era, seed: g.seed, rs: g.rs, t: g.t, me: { x: g.me.x, y: g.me.y, m: g.me.m, hp: g.me.hp }, comp: g.comp, lvl: g.lvl, sparks: g.sparks, owned: g.owned, parts: g.parts, stats: g.stats, done: g.done, fragAt: g.fragAt };
  }
  function restore(o) {
    if (!o || o.v !== 1) return null;
    const g = newGame(o.seed);
    Object.assign(g, { era: o.era || 1, rs: o.rs >>> 0, t: o.t || 0, comp: o.comp, lvl: o.lvl | 0, sparks: o.sparks | 0, owned: o.owned, parts: o.parts, stats: Object.assign(g.stats, o.stats), done: !!o.done, fragAt: o.fragAt || 40 });
    Object.assign(g.me, o.me);
    g.bodies = [];
    fill(g);
    g.bodies = g.bodies.filter((b) => !(b.r > radius(g.me.m) && Math.hypot(b.x - g.me.x, b.y - g.me.y) < 12 * radius(g.me.m)));
    return g;
  }

  return {
    LEVELS, END_MASS, MATTERS, PARTS, CATS, NATURES, TRAITS, HP, ZONE,
    newGame, step, edible, install, remove, canInstall, syncLevel, slotsAt, levelOf, radius, maxHp, viewWidth,
    shares, nature, trait, progress, zoneAt, noise, serialize, restore, has
  };
});
