/* ORBITE — Campagne : règles pures, sans affichage (testables sous Node).
 * Un Créateur façonne un monde en jouant des cartes de création, traverse une carte de chemins
 * (affrontements, astres puissants, mystères, sanctuaires) et affronte Kronos au bout de l'acte I.
 * Combat au tour par tour : 3 énergies, 5 cartes en main, intentions ennemies visibles.
 * Toutes les fonctions qui jouent renvoient une liste d'événements que l'interface anime. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteCampagne = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Hasard reproductible (état sauvegardable dans la partie) ───
  function rand(run) {
    run.rng = (run.rng + 0x6d2b79f5) >>> 0;
    let t = run.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rint = (run, a, b) => a + Math.floor(rand(run) * (b - a + 1));
  const pick = (run, list) => list[Math.floor(rand(run) * list.length)];
  function shuffle(run, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(run) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ─── Statuts ────────────────────────────────────────────────
  const STATUS = {
    masse: { name: 'Masse', text: 'Chaque coup inflige autant de dégâts en plus.', good: true },
    fissure: { name: 'Fissure', text: 'Subit 50 % de dégâts en plus. Diminue à chaque tour.' },
    erosion: { name: 'Érosion', text: 'Inflige 25 % de dégâts en moins. Diminue à chaque tour.' },
    brulure: { name: 'Brûlure', text: 'Perd autant de PV au début de son tour, puis diminue de 1.' }
  };
  const POWERS = {
    noyau: { name: 'Noyau en fusion', text: 'Début de tour : {n} dégâts à tous les ennemis.' },
    champ: { name: 'Champ magnétique', text: 'Début de tour : +{n} Bouclier.' },
    foret: { name: 'Forêt primaire', text: 'Fin de tour : soigne {n} PV.' },
    genese: { name: 'Genèse', text: 'Début de tour : +{n} énergie.' }
  };

  // ─── Cartes de création ─────────────────────────────────────
  // ops : dmg (n, hits), dmgAll, dmgBlock (bonus), abysse, block, apply (st, n), draw, heal, energy, power (key, n).
  // Chaque valeur est une paire [normale, améliorée]. el = famille de couleur (sphère d'énergie).
  const CARDS = {
    impact: { name: 'Impact', cost: 1, type: 'attaque', el: 'mineral', rar: 'depart', target: true, text: 'Inflige {6|9} dégâts.', ops: [['dmg', [6, 9]]] },
    atmosphere: { name: 'Atmosphère', cost: 1, type: 'defense', el: 'tempete', rar: 'depart', text: 'Gagne {5|8} Bouclier.', ops: [['block', [5, 8]]] },
    gravite: { name: 'Gravité', cost: 1, type: 'attaque', el: 'neant', rar: 'depart', target: true, text: 'Inflige {4|6} dégâts. Applique {2|3} Fissure.', ops: [['dmg', [4, 6]], ['apply', 'fissure', [2, 3]]] },

    meteores: { name: 'Pluie de météores', cost: 1, type: 'attaque', el: 'mineral', rar: 'commune', target: true, text: 'Inflige {3|4} dégâts 3 fois.', ops: [['dmg', [3, 4], 3]] },
    eruption: { name: 'Éruption', cost: 2, type: 'attaque', el: 'brasier', rar: 'commune', target: true, text: 'Inflige {14|19} dégâts.', ops: [['dmg', [14, 19]]] },
    lave: { name: 'Coulée de lave', cost: 1, type: 'attaque', el: 'brasier', rar: 'commune', target: true, text: 'Inflige {4|6} dégâts. Applique {4|6} Brûlure.', ops: [['dmg', [4, 6]], ['apply', 'brulure', [4, 6]]] },
    ocean: { name: 'Océan', cost: 1, type: 'defense', el: 'glace', rar: 'commune', text: 'Gagne {5|7} Bouclier. Piochez 1 carte.', ops: [['block', [5, 7]], ['draw', [1, 1]]] },
    croute: { name: 'Croûte', cost: 1, type: 'defense', el: 'mineral', rar: 'commune', text: 'Gagne {8|11} Bouclier.', ops: [['block', [8, 11]]] },
    vent: { name: 'Vent solaire', cost: 0, type: 'attaque', el: 'tempete', rar: 'commune', target: true, text: 'Inflige {3|5} dégâts. Piochez 1 carte.', ops: [['dmg', [3, 5]], ['draw', [1, 1]]] },
    brume: { name: 'Brume', cost: 1, type: 'defense', el: 'tempete', rar: 'commune', target: true, text: 'Gagne {4|6} Bouclier. Applique {2|3} Érosion.', ops: [['block', [4, 6]], ['apply', 'erosion', [2, 3]]] },
    seisme: { name: 'Séisme', cost: 1, type: 'attaque', el: 'mineral', rar: 'commune', text: 'Inflige {5|7} dégâts à tous les ennemis.', ops: [['dmgAll', [5, 7]]] },
    photosynthese: { name: 'Photosynthèse', cost: 1, type: 'creation', el: 'vie', rar: 'commune', exhaust: true, text: 'Soigne {5|8} PV. Épuisée.', ops: [['heal', [5, 8]]] },
    aurore: { name: 'Aurore', cost: 1, type: 'creation', el: 'tempete', rar: 'commune', text: 'Piochez {2|3} cartes.', ops: [['draw', [2, 3]]] },

    noyau: { name: 'Noyau en fusion', cost: 1, type: 'pouvoir', el: 'brasier', rar: 'peu', text: 'Au début de chaque tour, inflige {3|5} dégâts à tous les ennemis.', ops: [['power', 'noyau', [3, 5]]] },
    champ: { name: 'Champ magnétique', cost: 1, type: 'pouvoir', el: 'machine', rar: 'peu', text: 'Au début de chaque tour, gagne {3|5} Bouclier.', ops: [['power', 'champ', [3, 5]]] },
    tectonique: { name: 'Tectonique', cost: 1, type: 'pouvoir', el: 'mineral', rar: 'peu', text: 'Gagne {2|3} Masse : chaque coup inflige autant de dégâts en plus.', ops: [['apply', 'masse', [2, 3], 'self']] },
    foret: { name: 'Forêt primaire', cost: 2, type: 'pouvoir', el: 'vie', rar: 'peu', text: 'À la fin de chaque tour, soigne {2|3} PV.', ops: [['power', 'foret', [2, 3]]] },
    lune: { name: 'Lune gardienne', cost: 2, type: 'defense', el: 'lune', rar: 'peu', text: 'Gagne {13|17} Bouclier.', ops: [['block', [13, 17]]] },
    effondrement: { name: 'Effondrement', cost: 1, type: 'attaque', el: 'neant', rar: 'peu', target: true, text: 'Inflige autant de dégâts que votre Bouclier{| +4}.', ops: [['dmgBlock', [0, 4]]] },
    abysse: { name: 'Abysse', cost: 2, type: 'attaque', el: 'neant', rar: 'peu', target: true, text: 'Inflige {8|11} dégâts, doublés si l’ennemi a Fissure.', ops: [['abysse', [8, 11]]] },
    maree: { name: 'Marée', cost: 0, type: 'defense', el: 'glace', rar: 'peu', text: 'Gagne {3|5} Bouclier.', ops: [['block', [3, 5]]] },

    supernova: { name: 'Supernova', cost: 3, type: 'attaque', el: 'brasier', rar: 'rare', target: true, exhaust: true, text: 'Inflige {32|42} dégâts. Épuisée.', ops: [['dmg', [32, 42]]] },
    etincelle: { name: 'Étincelle de vie', cost: 0, type: 'creation', el: 'vie', rar: 'rare', exhaust: true, text: 'Gagnez {2|3} énergies. Épuisée.', ops: [['energy', [2, 3]]] },
    genese: { name: 'Genèse', cost: 3, upCost: 2, type: 'pouvoir', el: 'vie', rar: 'rare', text: 'Au début de chaque tour, gagnez 1 énergie.', ops: [['power', 'genese', [1, 1]]] }
  };
  const TYPE_NAME = { attaque: 'ATTAQUE', defense: 'DÉFENSE', creation: 'CRÉATION', pouvoir: 'POUVOIR' };
  const STARTER = ['impact', 'impact', 'impact', 'impact', 'impact', 'atmosphere', 'atmosphere', 'atmosphere', 'atmosphere', 'gravite'];

  const costOf = (card) => { const c = CARDS[card.id]; return card.up && c.upCost != null ? c.upCost : c.cost; };
  const val = (pair, up) => (Array.isArray(pair) ? pair[up ? 1 : 0] : pair);
  // Texte d'une carte : {a|b} devient a, ou b si la carte est améliorée.
  function cardText(card) {
    return CARDS[card.id].text.replace(/\{([^|}]*)\|([^}]*)\}/g, (_, a, b) => (card.up ? b : a));
  }
  const cardName = (card) => CARDS[card.id].name + (card.up ? '+' : '');

  // ─── Astres ennemis ─────────────────────────────────────────
  // moves : liste d'actions ; mode 'cycle' (dans l'ordre) ou 'hasard' (jamais 3 fois la même).
  // Action : atk (par coup), hits, def, buff {statut: n} sur soi, debuff {statut: n} sur le joueur,
  // summon (id, nombre), devour (Kronos). look : apparence pixel art.
  const ENEMIES = {
    poussiere: { name: 'Poussière errante', hp: [12, 15], look: { type: 'asteroid', seed: 31001 }, mode: 'cycle', moves: [{ n: 'Choc', atk: 6 }, { n: 'Rebond', atk: 4, def: 4 }] },
    caillou: { name: 'Caillou', hp: [7, 9], look: { type: 'asteroid', seed: 31011 }, mode: 'hasard', moves: [{ n: 'Ricochet', atk: 3 }, { n: 'Ricochet', atk: 4 }, { n: 'Agglomérat', def: 4 }] },
    comete: { name: 'Comète vagabonde', hp: [20, 23], look: { type: 'comet', seed: 31021 }, mode: 'cycle', moves: [{ n: 'Accélère', buff: { masse: 2 } }, { n: 'Percute', atk: 6 }, { n: 'Percute', atk: 6 }] },
    lunemorte: { name: 'Lune morte', hp: [32, 36], look: { type: 'moon', seed: 31031 }, mode: 'hasard', moves: [{ n: 'Chute de roches', atk: 9 }, { n: 'Carapace', def: 10 }, { n: 'Ombre froide', atk: 5, debuff: { erosion: 2 } }] },
    meteore: { name: 'Météore enflammé', hp: [24, 27], look: { type: 'comet', seed: 31041, warm: true }, mode: 'cycle', moves: [{ n: 'Embrase', atk: 3, debuff: { brulure: 4 } }, { n: 'Impact brûlant', atk: 10 }] },
    naine: { name: 'Planète naine glacée', hp: [40, 44], look: { type: 'ice', seed: 31051 }, mode: 'cycle', moves: [{ n: 'Givre', debuff: { fissure: 2 }, def: 6 }, { n: 'Avalanche', atk: 12 }, { n: 'Grêle', atk: 4, hits: 2 }] },
    geante: { name: 'Géante rouge', elite: true, hp: [78, 82], look: { type: 'star', seed: 31061, starClass: 'naine rouge' }, mode: 'cycle', moves: [{ n: 'Éruption solaire', atk: 13 }, { n: 'Pulsation', buff: { masse: 2 }, debuff: { brulure: 3 } }, { n: 'Vents stellaires', atk: 6, hits: 2 }] },
    jumeau: { name: 'Astéroïde jumeau', elite: true, hp: [36, 40], look: { type: 'asteroid', seed: 31071, shape: 'double' }, mode: 'hasard', moves: [{ n: 'Collision', atk: 9 }, { n: 'Alignement', def: 8, atk: 4 }], twin: true },
    kronos: { name: 'Kronos', boss: true, hp: [120, 120], look: { type: 'gas', seed: 31081, ring: true, full: true }, mode: 'cycle', moves: [{ n: 'Appel des lunes', summon: ['lunekronos', 2], def: 8 }, { n: 'Écrasement', atk: 12 }, { n: 'Dévorer', devour: true }, { n: 'Tempête de Kronos', atk: 4, hits: 3 }] },
    lunekronos: { name: 'Lune de Kronos', minion: true, hp: [9, 11], look: { type: 'moon', seed: 31091 }, mode: 'cycle', moves: [{ n: 'Orbite basse', atk: 3 }] }
  };
  const GROUPS = {
    faible: [['poussiere'], ['caillou', 'caillou', 'caillou'], ['comete']],
    moyen: [['lunemorte'], ['meteore'], ['naine'], ['caillou', 'comete'], ['meteore', 'caillou']],
    elite: [['geante'], ['jumeau', 'jumeau']],
    boss: [['kronos']]
  };

  // ─── Vestiges (reliques) ────────────────────────────────────
  const RELICS = {
    anneau: { name: 'Anneau de poussière', text: 'Début de combat : gagne 8 Bouclier.' },
    coeur: { name: 'Cœur de fer', text: '+10 PV max.' },
    graine: { name: 'Graine primordiale', text: 'Fin de combat : soigne 5 PV.' },
    dense: { name: 'Noyau dense', text: 'Début de combat : gagne 1 Masse.' },
    eclat: { name: 'Éclat d’aube', text: 'Premier tour de chaque combat : +1 énergie.' },
    premierelune: { name: 'Première lune', text: 'Début de combat : inflige 5 dégâts à tous les ennemis.' }
  };

  // ─── Mystères (événements racontés) ─────────────────────────
  const EVENTS = {
    comete: {
      title: 'La comète porteuse d’eau',
      text: 'Une comète de glace frôle votre monde. Sa longue queue scintille de cristaux d’eau gelée.',
      choices: [
        { label: 'La capturer', text: 'Gagnez la carte Océan. L’eau ruisselle sur votre monde.', fx: [['card', 'ocean'], ['world', 'water', 0.35]] },
        { label: 'La fracasser', text: 'Gagnez la carte Pluie de météores.', fx: [['card', 'meteores']] }
      ]
    },
    etincelle: {
      title: 'L’étincelle',
      text: 'Un éclair déchire votre jeune atmosphère. Au fond d’une flaque tiède, quelque chose frémit.',
      choices: [
        { label: 'Nourrir l’étincelle', text: 'Perdez 6 PV. Gagnez la carte Étincelle de vie : la vie apparaît.', fx: [['hp', -6], ['card', 'etincelle'], ['world', 'life', 0.15]] },
        { label: 'La laisser s’éteindre', text: 'Soignez 12 PV.', fx: [['hp', 12]] }
      ]
    },
    vestige: {
      title: 'Le vestige d’un monde mort',
      text: 'Les restes d’une planète dérivent près de vous. Son cœur bat encore, faiblement.',
      choices: [
        { label: 'Absorber son cœur', text: 'Perdez 8 PV. Gagnez un vestige.', fx: [['hp', -8], ['relic']] },
        { label: 'Lui offrir le repos', text: 'Retirez une carte de votre création.', fx: [['remove']] }
      ]
    },
    murmure: {
      title: 'Le monde éteint',
      scene: 'ancien',
      text: 'L’Ancien vous tend ce qui lui reste : son savoir, ou la dernière chaleur de son cœur.',
      choices: [
        { label: 'Recevoir son savoir', text: 'Deux cartes au hasard sont améliorées.', fx: [['upgradeRandom', 2]] },
        { label: 'Prendre sa chaleur', text: '+6 PV max.', fx: [['maxHp', 6]] }
      ]
    }
  };

  // ─── Carte des chemins ──────────────────────────────────────
  const ROWS = 9; // + la rangée du boss
  const COLS = 3;
  function makeMap(run) {
    const rows = Array.from({ length: ROWS }, () => []);
    const edges = new Set();
    const at = (r, c) => rows[r].find((n) => n.col === c);
    const add = (r, c) => { let n = at(r, c); if (!n) { n = { id: `n${r}-${c}`, row: r, col: c, next: [] }; rows[r].push(n); } return n; };
    const crosses = (r, a, b) => [...edges].some((k) => { const [rr, x, y] = k.split(':').map(Number); return rr === r && ((x < a && y > b) || (x > a && y < b)); });
    for (const start of [0, 1, 2, rint(run, 0, 2)]) {
      let c = start;
      add(0, c);
      for (let r = 0; r < ROWS - 1; r++) {
        let nc = Math.max(0, Math.min(COLS - 1, c + rint(run, -1, 1)));
        if (crosses(r, c, nc)) nc = c;
        edges.add(`${r}:${c}:${nc}`);
        add(r + 1, nc);
        const n = at(r, c);
        if (!n.next.includes(`n${r + 1}-${nc}`)) n.next.push(`n${r + 1}-${nc}`);
        c = nc;
      }
    }
    for (const row of rows) row.sort((a, b) => a.col - b.col);
    const boss = { id: 'boss', row: ROWS, col: 1, type: 'boss', group: 0, next: [] };
    for (const n of rows[ROWS - 1]) n.next = ['boss'];
    // Types : 2 premiers affrontements faciles, un mystère garanti au milieu, sanctuaire avant le boss.
    for (const row of rows) {
      for (const n of row) {
        const r = n.row;
        if (r <= 1) n.type = 'combat';
        else if (r === ROWS - 1) n.type = 'rest';
        else if (r === 4) n.type = rand(run) < 0.5 ? 'event' : 'combat';
        else {
          const x = rand(run);
          n.type = r >= 3 && x < 0.16 ? 'elite' : r >= 3 && x < 0.3 ? 'rest' : x < 0.46 ? 'event' : 'combat';
        }
        if (n.type === 'combat') n.group = r <= 1 ? rint(run, 0, GROUPS.faible.length - 1) : rint(run, 0, GROUPS.moyen.length - 1);
        if (n.type === 'elite') n.group = rint(run, 0, GROUPS.elite.length - 1);
      }
    }
    // Au moins un astre puissant accessible : sinon, on en place un au rang 5.
    if (!rows.some((row) => row.some((n) => n.type === 'elite'))) { const n = rows[5][0]; n.type = 'elite'; n.group = 0; }
    return { rows, boss };
  }
  const allNodes = (run) => run.map.rows.flat().concat([run.map.boss]);
  const nodeById = (run, id) => allNodes(run).find((n) => n.id === id);
  function choices(run) {
    if (!run.node) return run.map.rows[0].map((n) => n.id);
    const n = nodeById(run, run.node);
    return n ? n.next : [];
  }

  // ─── Partie ─────────────────────────────────────────────────
  function newRun(seed) {
    const run = { v: 1, seed: seed >>> 0, rng: seed >>> 0, hp: 60, maxHp: 60, deck: [], relics: [], node: null, path: [], floor: 0, uid: 1, world: { water: 0, life: 0 }, seen: [], stats: { fights: 0, elites: 0, cards: 0 }, combat: null, over: false, won: false };
    for (const id of STARTER) run.deck.push({ uid: 'c' + run.uid++, id, up: false });
    run.map = makeMap(run);
    return run;
  }
  function addCard(run, id, up) { const c = { uid: 'c' + run.uid++, id, up: !!up }; run.deck.push(c); run.stats.cards++; return c; }
  function addRelic(run, id) {
    if (!id || run.relics.includes(id)) return null;
    run.relics.push(id);
    if (id === 'coeur') { run.maxHp += 10; run.hp += 10; }
    return id;
  }
  function randomRelic(run) {
    const free = Object.keys(RELICS).filter((k) => !run.relics.includes(k));
    return free.length ? pick(run, free) : null;
  }

  // Le joueur choisit sa prochaine étape sur la carte.
  function enter(run, id) {
    if (!choices(run).includes(id)) return { ok: false };
    const n = nodeById(run, id);
    run.node = id;
    run.path.push(id);
    run.floor = n.row + 1;
    if (n.type === 'combat' || n.type === 'elite' || n.type === 'boss') {
      const pool = n.type === 'boss' ? GROUPS.boss : n.type === 'elite' ? GROUPS.elite : n.row <= 1 ? GROUPS.faible : GROUPS.moyen;
      startCombat(run, pool[n.group || 0], n.type);
      return { ok: true, kind: 'combat', node: n };
    }
    if (n.type === 'event') {
      const left = Object.keys(EVENTS).filter((k) => !run.seen.includes(k));
      const ev = left.length ? pick(run, left) : pick(run, Object.keys(EVENTS));
      run.seen.push(ev);
      run.event = ev;
      return { ok: true, kind: 'event', node: n, event: ev };
    }
    return { ok: true, kind: 'rest', node: n };
  }

  // ─── Combat ─────────────────────────────────────────────────
  function makeEnemy(run, id) {
    const e = ENEMIES[id];
    const hp = rint(run, e.hp[0], e.hp[1]);
    const u = { uid: 'e' + run.uid++, id, hp, maxHp: hp, block: 0, st: {}, step: 0, hist: [] };
    return u;
  }
  function chooseIntent(run, u) {
    const e = ENEMIES[u.id];
    let i;
    if (e.mode === 'cycle') { i = u.step % e.moves.length; u.step++; }
    else {
      const ok = e.moves.map((_, k) => k).filter((k) => !(u.hist.length >= 2 && u.hist[u.hist.length - 1] === k && u.hist[u.hist.length - 2] === k));
      i = pick(run, ok);
    }
    u.hist.push(i);
    u.intent = i;
  }
  function startCombat(run, group, kind) {
    const c = { kind, turn: 0, energy: 0, maxEnergy: 3, hand: [], draw: [], discard: [], exhaust: [], block: 0, st: {}, powers: {}, enemies: [], log: [] };
    run.combat = c;
    c.enemies = group.map((id) => makeEnemy(run, id));
    c.draw = shuffle(run, run.deck.map((d) => ({ uid: d.uid, id: d.id, up: d.up })));
    for (const u of c.enemies) chooseIntent(run, u);
    const ev = [];
    if (run.relics.includes('anneau')) { c.block += 8; ev.push({ t: 'block', who: 'p', n: 8, src: 'anneau' }); }
    if (run.relics.includes('dense')) { c.st.masse = (c.st.masse || 0) + 1; ev.push({ t: 'status', who: 'p', st: 'masse', n: 1 }); }
    if (run.relics.includes('premierelune')) for (const u of c.enemies) ev.push(...hurt(run, u, 5, { direct: true }));
    c.startEvents = ev;
    startTurn(run, ev);
    return ev;
  }

  function drawCards(run, n, ev) {
    const c = run.combat;
    for (let k = 0; k < n; k++) {
      if (c.hand.length >= 10) break;
      if (!c.draw.length) {
        if (!c.discard.length) break;
        c.draw = shuffle(run, c.discard);
        c.discard = [];
        ev.push({ t: 'reshuffle' });
      }
      const card = c.draw.pop();
      c.hand.push(card);
      ev.push({ t: 'draw', uid: card.uid });
    }
  }

  const alive = (c) => c.enemies.filter((u) => u.hp > 0);
  // Dégâts d'une attaque : Masse de l'attaquant, Érosion (−25 %), Fissure de la cible (+50 %).
  function attackValue(base, src, dst) {
    let n = base + ((src && src.st.masse) || 0);
    if (src && src.st.erosion > 0) n = Math.floor(n * 0.75);
    if (dst && dst.st.fissure > 0) n = Math.floor(n * 1.5);
    return Math.max(0, n);
  }
  // Inflige n à une cible (u ennemi, ou 'p' le joueur) : le Bouclier absorbe d'abord.
  function hurt(run, target, n, o) {
    const c = run.combat;
    o = o || {};
    const ev = [];
    const isP = target === 'p';
    const holder = isP ? c : target;
    let blocked = 0;
    if (!o.ignoreBlock) { blocked = Math.min(holder.block, n); holder.block -= blocked; }
    const lost = n - blocked;
    if (isP) run.hp = Math.max(0, run.hp - lost); else target.hp = Math.max(0, target.hp - lost);
    ev.push({ t: 'hit', who: isP ? 'p' : target.uid, n, blocked, lost, hp: isP ? run.hp : target.hp, kind: o.kind || 'attaque', src: o.src || null });
    if (!isP && target.hp <= 0) ev.push(...kill(run, target));
    return ev;
  }
  function kill(run, u) {
    const c = run.combat;
    const ev = [{ t: 'die', uid: u.uid }];
    const e = ENEMIES[u.id];
    // Quand Kronos tombe, ses lunes s'enfuient ; un jumeau survivant entre en fureur.
    if (e.boss) for (const o of c.enemies) if (o !== u && o.hp > 0) { o.hp = 0; ev.push({ t: 'flee', uid: o.uid }); }
    if (e.twin) for (const o of c.enemies) if (o !== u && o.hp > 0 && ENEMIES[o.id].twin) { o.st.masse = (o.st.masse || 0) + 4; ev.push({ t: 'status', who: o.uid, st: 'masse', n: 4, why: 'Fureur' }); }
    return ev;
  }
  function applyStatus(run, who, st, n) {
    const c = run.combat;
    const holder = who === 'p' ? c : who;
    holder.st[st] = (holder.st[st] || 0) + n;
    return { t: 'status', who: who === 'p' ? 'p' : who.uid, st, n };
  }
  function gainBlock(run, n) { run.combat.block += n; return { t: 'block', who: 'p', n }; }

  function startTurn(run, ev) {
    const c = run.combat;
    c.turn++;
    c.block = 0;
    c.energy = c.maxEnergy + (c.powers.genese || 0) + (c.turn === 1 && run.relics.includes('eclat') ? 1 : 0);
    ev.push({ t: 'turn', n: c.turn, energy: c.energy });
    if (c.st.brulure > 0) { ev.push(...hurt(run, 'p', c.st.brulure, { ignoreBlock: true, kind: 'brulure' })); c.st.brulure--; }
    if (run.hp <= 0) return ev;
    if (c.powers.champ) ev.push(gainBlock(run, c.powers.champ));
    if (c.powers.noyau) for (const u of alive(c)) ev.push(...hurt(run, u, c.powers.noyau, { direct: true, kind: 'noyau' }));
    if (c.powers.genese) ev.push({ t: 'energy', n: c.powers.genese });
    if (!alive(c).length) return ev;
    drawCards(run, 5, ev);
    return ev;
  }

  // Effets d'une carte. target : uid d'un ennemi (pour les cartes ciblées).
  function canPlay(run, uid) {
    const c = run.combat;
    if (!c || run.over) return { ok: false, reason: 'Pas de combat.' };
    const card = c.hand.find((x) => x.uid === uid);
    if (!card) return { ok: false, reason: 'Carte introuvable.' };
    if (costOf(card) > c.energy) return { ok: false, reason: 'Pas assez d’énergie.' };
    return { ok: true, card };
  }
  function play(run, uid, targetUid) {
    const chk = canPlay(run, uid);
    if (!chk.ok) return chk;
    const c = run.combat;
    const card = chk.card;
    const def = CARDS[card.id];
    let target = null;
    if (def.target) {
      target = c.enemies.find((u) => u.uid === targetUid && u.hp > 0) || alive(c)[0];
      if (!target) return { ok: false, reason: 'Aucune cible.' };
    }
    c.energy -= costOf(card);
    c.hand = c.hand.filter((x) => x !== card);
    const ev = [{ t: 'play', uid: card.uid, id: card.id, target: target ? target.uid : null, cost: costOf(card) }];
    const up = card.up;
    const me = { st: c.st };
    for (const op of def.ops) {
      const [k] = op;
      if (k === 'dmg') {
        const hits = op[2] || 1;
        for (let h = 0; h < hits && target && target.hp > 0; h++) ev.push(...hurt(run, target, attackValue(val(op[1], up), me, target), { src: card.id }));
      } else if (k === 'dmgAll') {
        for (const u of alive(c)) ev.push(...hurt(run, u, attackValue(val(op[1], up), me, u), { src: card.id }));
      } else if (k === 'dmgBlock') {
        ev.push(...hurt(run, target, attackValue(c.block + val(op[1], up), me, target), { src: card.id }));
      } else if (k === 'abysse') {
        const base = val(op[1], up) * (target.st.fissure > 0 ? 2 : 1);
        ev.push(...hurt(run, target, attackValue(base, me, target), { src: card.id }));
      } else if (k === 'block') ev.push(gainBlock(run, val(op[1], up)));
      else if (k === 'apply') {
        if (op[3] === 'self') ev.push(applyStatus(run, 'p', op[1], val(op[2], up)));
        else if (target && target.hp > 0) ev.push(applyStatus(run, target, op[1], val(op[2], up)));
      } else if (k === 'draw') drawCards(run, val(op[1], up), ev);
      else if (k === 'heal') { const n = Math.min(val(op[1], up), run.maxHp - run.hp); run.hp += n; ev.push({ t: 'heal', n, hp: run.hp }); }
      else if (k === 'energy') { c.energy += val(op[1], up); ev.push({ t: 'energy', n: val(op[1], up) }); }
      else if (k === 'power') { c.powers[op[1]] = (c.powers[op[1]] || 0) + val(op[2], up); ev.push({ t: 'power', key: op[1], n: c.powers[op[1]] }); }
    }
    if (def.exhaust) { c.exhaust.push(card); ev.push({ t: 'exhaust', uid: card.uid }); }
    else if (def.type === 'pouvoir') ev.push({ t: 'consume', uid: card.uid });
    else c.discard.push(card);
    checkEnd(run, ev);
    return { ok: true, events: ev };
  }

  function checkEnd(run, ev) {
    const c = run.combat;
    if (run.hp <= 0 && !run.over) {
      run.over = true;
      run.won = false;
      ev.push({ t: 'defeat' });
    } else if (c && !alive(c).length && !c.done) {
      c.done = true;
      run.stats.fights++;
      if (c.kind === 'elite') run.stats.elites++;
      if (run.relics.includes('graine')) { const n = Math.min(5, run.maxHp - run.hp); run.hp += n; ev.push({ t: 'heal', n, hp: run.hp, src: 'graine' }); }
      if (c.kind === 'boss') { run.over = true; run.won = true; run.world.life = Math.max(run.world.life, 0.6); }
      ev.push({ t: 'victory', kind: c.kind });
    }
  }

  // Valeur annoncée par une intention (après Masse, Érosion et Fissure du joueur).
  function intentOf(run, u) {
    const c = run.combat;
    const m = ENEMIES[u.id].moves[u.intent];
    const out = { name: m.n, kinds: [] };
    if (m.atk) { out.kinds.push('atk'); out.atk = attackValue(m.atk, u, c); out.hits = m.hits || 1; }
    if (m.def) out.kinds.push('def');
    if (m.buff) out.kinds.push('buff');
    if (m.debuff) out.kinds.push('debuff');
    if (m.summon) out.kinds.push('summon');
    if (m.devour) {
      const moons = c.enemies.filter((o) => o.hp > 0 && ENEMIES[o.id].minion);
      if (moons.length) out.kinds.push('devour');
      else { out.kinds.push('atk', 'def'); out.atk = attackValue(10, u, c); out.hits = 1; }
    }
    return out;
  }

  function endTurn(run) {
    const c = run.combat;
    if (!c || run.over || c.done) return { ok: false };
    const ev = [{ t: 'endTurn' }];
    while (c.hand.length) c.discard.push(c.hand.pop());
    ev.push({ t: 'discardHand' });
    if (c.powers.foret) { const n = Math.min(c.powers.foret, run.maxHp - run.hp); if (n > 0) { run.hp += n; ev.push({ t: 'heal', n, hp: run.hp, src: 'foret' }); } }
    for (const k of ['fissure', 'erosion']) if (c.st[k] > 0) c.st[k]--;
    // Tour des astres ennemis, dans l'ordre.
    ev.push({ t: 'foes' });
    for (const u of c.enemies.slice()) {
      if (u.hp <= 0) continue;
      u.block = 0;
      if (u.st.brulure > 0) { ev.push(...hurt(run, u, u.st.brulure, { ignoreBlock: true, kind: 'brulure' })); u.st.brulure--; if (u.hp <= 0) continue; }
      const m = ENEMIES[u.id].moves[u.intent];
      ev.push({ t: 'act', uid: u.uid, name: m.n });
      if (m.devour) {
        const moon = c.enemies.find((o) => o.hp > 0 && ENEMIES[o.id].minion);
        if (moon) {
          moon.hp = 0;
          ev.push({ t: 'devour', uid: u.uid, moon: moon.uid });
          const heal = Math.min(12, u.maxHp - u.hp);
          u.hp += heal;
          u.st.masse = (u.st.masse || 0) + 2;
          ev.push({ t: 'foeHeal', uid: u.uid, n: heal, hp: u.hp }, { t: 'status', who: u.uid, st: 'masse', n: 2 });
        } else {
          u.block += 12;
          ev.push({ t: 'foeBlock', uid: u.uid, n: 12 });
          ev.push(...hurt(run, 'p', attackValue(10, u, c), { src: u.uid }));
        }
      }
      if (m.def) { u.block += m.def; ev.push({ t: 'foeBlock', uid: u.uid, n: m.def }); }
      if (m.buff) for (const [k, n] of Object.entries(m.buff)) ev.push(applyStatus(run, u, k, n));
      if (m.atk) for (let h = 0; h < (m.hits || 1) && run.hp > 0; h++) ev.push(...hurt(run, 'p', attackValue(m.atk, u, c), { src: u.uid }));
      if (m.debuff) for (const [k, n] of Object.entries(m.debuff)) ev.push(applyStatus(run, 'p', k, n));
      if (m.summon) {
        const [id, k] = m.summon;
        for (let i = 0; i < k && alive(c).length < 4; i++) {
          const s = makeEnemy(run, id);
          chooseIntent(run, s);
          c.enemies.push(s);
          ev.push({ t: 'summon', uid: s.uid, id, by: u.uid });
        }
      }
      for (const k of ['fissure', 'erosion']) if (u.st[k] > 0) u.st[k]--;
      if (run.hp <= 0) break;
    }
    c.enemies = c.enemies.filter((u) => u.hp > 0);
    checkEnd(run, ev);
    if (!run.over && !c.done) {
      for (const u of c.enemies) chooseIntent(run, u);
      ev.push({ t: 'intents' });
      startTurn(run, ev);
      checkEnd(run, ev);
    }
    return { ok: true, events: ev };
  }

  // ─── Récompenses ────────────────────────────────────────────
  const RARITY = { commune: 60, peu: 32, rare: 8 };
  function cardChoices(run, elite) {
    const pool = Object.keys(CARDS).filter((k) => CARDS[k].rar !== 'depart');
    const out = [];
    const w = elite ? { commune: 40, peu: 42, rare: 18 } : RARITY;
    while (out.length < 3) {
      const x = rand(run) * 100;
      const rar = x < w.commune ? 'commune' : x < w.commune + w.peu ? 'peu' : 'rare';
      const list = pool.filter((k) => CARDS[k].rar === rar && !out.includes(k));
      if (list.length) out.push(pick(run, list));
    }
    return out;
  }
  // Après un combat : choix de cartes (et vestige pour un astre puissant).
  function rewards(run) {
    const c = run.combat;
    const r = { cards: cardChoices(run, c.kind === 'elite'), relic: c.kind === 'elite' ? randomRelic(run) : null };
    if (r.relic) addRelic(run, r.relic);
    run.combat = null;
    run.reward = r;
    return r;
  }
  function takeCard(run, id) { run.reward = null; return id ? addCard(run, id) : null; }

  function upgradable(run) { return run.deck.filter((d) => !d.up); }
  function upgrade(run, uid) { const d = run.deck.find((x) => x.uid === uid && !x.up); if (d) d.up = true; return d; }
  function removeCard(run, uid) { const i = run.deck.findIndex((x) => x.uid === uid); if (i >= 0) return run.deck.splice(i, 1)[0]; return null; }

  function rest(run, choice) {
    if (choice === 'repos') { const n = Math.min(Math.round(run.maxHp * 0.3), run.maxHp - run.hp); run.hp += n; return { heal: n }; }
    return { upgrade: true };
  }

  // Effets d'un choix de mystère ; renvoie ce qui reste à faire côté interface (choisir une carte).
  function resolveEvent(run, k) {
    const ev = EVENTS[run.event];
    const ch = ev.choices[k];
    const out = { cards: [], relic: null, pending: null, upgraded: [] };
    for (const fx of ch.fx) {
      if (fx[0] === 'card') out.cards.push(addCard(run, fx[1]));
      else if (fx[0] === 'world') run.world[fx[1]] = Math.min(1, (run.world[fx[1]] || 0) + fx[2]);
      else if (fx[0] === 'hp') run.hp = Math.max(1, Math.min(run.maxHp, run.hp + fx[1]));
      else if (fx[0] === 'maxHp') { run.maxHp += fx[1]; run.hp += fx[1]; }
      else if (fx[0] === 'relic') out.relic = addRelic(run, randomRelic(run));
      else if (fx[0] === 'remove') out.pending = 'remove';
      else if (fx[0] === 'upgradeRandom') {
        const list = shuffle(run, upgradable(run).slice()).slice(0, fx[1]);
        for (const d of list) { d.up = true; out.upgraded.push(d); }
      }
    }
    run.event = null;
    return out;
  }

  // Apparence du monde du joueur : elle suit ses cartes (magma, eau, nuages, vie).
  function worldChannels(run) {
    const n = (el) => run.deck.filter((d) => CARDS[d.id].el === el).length;
    const k = (x, s) => Math.min(1, x * s);
    const life = Math.min(1, run.world.life + k(n('vie'), 0.12));
    return {
      rock: Math.min(1, 0.6 + k(n('mineral'), 0.04)),
      heat: Math.min(1, 0.25 + k(n('brasier'), 0.18)),
      air: Math.min(1, k(n('tempete'), 0.1)),
      clouds: Math.min(1, k(n('tempete'), 0.06) + (run.world.water > 0 ? 0.15 : 0)),
      water: Math.min(1, run.world.water + k(n('glace'), 0.15)),
      ice: Math.min(1, k(n('glace'), 0.1)),
      life,
      cities: 0, moon: run.won ? 1 : 0, sats: 0, ring: 0, halo: 0
    };
  }

  // XP et poussières d'étoiles rapportées au Créateur à la fin d'une expédition.
  function payout(run) {
    const floors = Math.max(0, run.floor - (run.won ? 0 : 1));
    const xp = floors * 12 + run.stats.elites * 20 + (run.won ? 150 : 0);
    const dust = run.stats.elites * 15 + (run.won ? 80 : 0) + Math.floor(floors / 3) * 5;
    return { xp, dust, floors };
  }

  return {
    CARDS, TYPE_NAME, STATUS, POWERS, ENEMIES, GROUPS, RELICS, EVENTS, STARTER, ROWS,
    newRun, enter, choices, nodeById, allNodes, play, canPlay, endTurn, intentOf, rewards, takeCard,
    upgrade, upgradable, removeCard, rest, resolveEvent, worldChannels, payout, cardText, cardName, costOf, alive, addRelic
  };
});
