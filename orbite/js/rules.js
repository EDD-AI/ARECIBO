/* ORBITE — règles du jeu (pures et déterministes, sans DOM).
 * Création à réserve partagée, fusion dorée + découverte, combat automatique
 * façon Champs de bataille, bots, dégâts plafonnés, classement et poussières.
 * Navigateur : window.OrbiteRules — Node : require('./rules.js'). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbiteRules = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  // Traduction (js/i18n.js dans le navigateur) ; sous Node, le français avec ses {variables} remplies.
  const tr = (typeof window !== 'undefined' && window.tr) || ((s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);

  // ─── Paramètres ─────────────────────────────────────────────
  const START_HP = 30;
  const PHENIX_HP = 15;
  const MAX_GOLD = 10;
  const BUY_COST = 3;
  const ROLL_COST = 1;
  const HAND_MAX = 10;
  const BOARD_MAX = 7;
  const PLAYERS = 8;
  const ACTIVE_FAMILIES = 5;
  const COPIES = [0, 16, 15, 13, 11, 9, 7];
  // Légendaires : chance qu'un emplacement de la Création en montre une, et qu'une découverte en propose une.
  const LEGEND_SHOP = 1 / 100;
  const LEGEND_DISCOVER = 0.07;
  const SHOP_SIZE = [0, 3, 4, 4, 5, 5, 6];
  const UPGRADE = [0, 5, 7, 8, 9, 10, 0];
  const DAMAGE_CAP = 10;
  const REWARDS = { 1: 100, 2: 60, 3: 30 };
  // Duel : le jeu principal, un contre un en plusieurs manches. La mêlée à huit reste un mode.
  // En duel, chaque univers a DUEL.hp fois plus de PV : la partie dure une douzaine de manches.
  const DUEL = { players: 2, hp: 2, rewards: { 1: 40, 2: 10 } };
  // Placement : deux rangées de ROW_MAX places. L'avant (rangée 0) attaque et encaisse ; l'arrière
  // (rangée 1) est à l'abri des attaques et avance dès que l'avant est tombé.
  const ROW_MAX = 4;
  // Formation : au moins FORM_MIN astres d'une même famille dans la même rangée. Son niveau vaut
  // leur nombre moins un (au plus 3). Chaque famille a un effet à l'avant et un autre à l'arrière ;
  // {n} = niveau, {d} = deux fois le niveau. « Ils » : les astres de la formation. front1 / back1 :
  // la phrase du niveau I quand le pluriel ne convient pas.
  const FORM_MIN = 2;
  const FORMATIONS = {
    vie: { front: 'Ils gagnent +{n}/+{n}.', back: 'Après chaque attaque de votre avant, l’attaquant récupère {d} PV.' },
    neant: { front: 'Quand l’un d’eux s’effondre, les autres gagnent +{n}/+{n}.', back: 'Quand un astre de votre avant s’effondre, ils gagnent +{n}/+{n}.' },
    envers: { front: 'Ils gagnent +{n}/+{n} ; les {n} premiers gagnent Renaissance.', front1: 'Ils gagnent +{n}/+{n} ; le premier gagne Renaissance.', back: 'Les {n} ennemis de l’avant les plus offensifs échangent leur Attaque et leurs PV (s’ils ont plus d’Attaque que de PV).', back1: 'L’ennemi de l’avant le plus offensif échange son Attaque et ses PV (s’il a plus d’Attaque que de PV).' },
    brasier: { front: 'Chacun inflige {d} dégâts à l’ennemi en face.', back: 'Inflige {d} dégâts à l’ennemi de l’avant qui a le moins de PV.' },
    glace: { front: 'Ils gagnent +{n}/+{n} ; les {n} premiers gagnent Bouclier.', front1: 'Ils gagnent +{n}/+{n} ; le premier gagne Bouclier.', back: 'Les ennemis de l’avant perdent {d} Attaque.' },
    tempete: { front: 'Ils gagnent +{n}/+{d}, puis +{n} Attaque après chacune de leurs attaques.', back: 'Vos astres de l’avant gagnent +{n}/+{d}, et le premier Rafale.' },
    mineral: { front: 'Ils gagnent +{n}/+{d} ; le plus robuste gagne Rempart.', back: 'Vos astres de l’avant gagnent +{n}/+{d}.' },
    machine: { front: 'Ils gagnent +{d} Attaque.', back: 'Chacun donne ses mots-clés et +{n}/+{n} à l’astre de l’avant juste devant lui.' },
    lune: { front: 'Leurs voisins de rangée gagnent +{n}/+{n}.', back: 'L’astre de l’avant juste devant chacune gagne +{d}/+{d}.' },
    comete: { front: 'Ils gagnent +{n} Attaque et attaquent avant le reste de l’avant.', back: 'Quand votre avant est tombé, ils avancent avec +{d}/+{n}.' },
    cristal: { front: 'Ils gagnent +{n}/+{n}, le double si l’arrière a aussi une formation de Cristal.', back: 'Tous vos Cristaux gagnent +{n}/+{n}.' },
    anomalie: { front: 'Chacun gagne {n} mots-clés aléatoires.', front1: 'Chacun gagne un mot-clé aléatoire.', back: '{n} astres de votre avant gagnent un mot-clé aléatoire.', back1: 'Un astre de votre avant gagne un mot-clé aléatoire.' }
  };

  const FAMILIES = {
    vie: { name: 'Vie', color: '#5fd35a', text: 'Les Soleils font grandir les mondes Habitables à chaque fin de cycle.' },
    neant: { name: 'Néant', color: '#9a6bff', text: 'Trous noirs et planètes mortes : chaque effondrement nourrit les autres.' },
    envers: { name: 'Envers', color: '#ff4f6d', text: 'Le monde à l’envers : Renaissance, Toxique et inversion des statistiques.' },
    brasier: { name: 'Brasier', color: '#ff8a2a', text: 'Lave et étoiles rouges : des dégâts avant même le premier coup.' },
    glace: { name: 'Glace', color: '#8be6ff', text: 'Boucliers de glace, et de la force quand ils se brisent.' },
    tempete: { name: 'Tempête', color: '#2fd6b0', text: 'Géantes gazeuses : Rafale et attaque qui monte à chaque coup.' },
    mineral: { name: 'Minéral', color: '#b8743f', text: 'Remparts de roche qui accumulent les points de vie.' },
    machine: { name: 'Machine', color: '#9fb3c8', text: 'Sondes et stations qui s’arriment les unes aux autres.' },
    lune: { name: 'Lunes', color: '#ffd447', text: 'Satellites qui renforcent leurs voisins : l’ordre du système compte.' },
    comete: { name: 'Comètes', color: '#4f7bff', text: 'Elles grandissent quand vous actualisez la Création et récompensent la vente.' },
    cristal: { name: 'Cristal', color: '#ff6fd8', text: 'Résonance : chaque Cristal joué renforce les autres.' },
    anomalie: { name: 'Anomalies', color: '#c8ff3a', text: 'Le chaos : astres aléatoires, découvertes et mots-clés imprévus.' },
    neutre: { name: 'Neutre', color: '#f2efe6', text: 'Présents dans toutes les parties.' }
  };
  const FAMILY_KEYS = ['vie', 'neant', 'envers', 'brasier', 'glace', 'tempete', 'mineral', 'machine', 'lune', 'comete', 'cristal', 'anomalie'];
  const RANDOM_KW = ['bouclier', 'rafale', 'venin', 'renaissance', 'rempart'];

  const KEYWORDS = {
    rempart: { name: 'Rempart', text: 'Les ennemis doivent l’attaquer en priorité.' },
    bouclier: { name: 'Bouclier', text: 'Ignore la première source de dégâts.' },
    rafale: { name: 'Rafale', text: 'Attaque deux fois.' },
    megarafale: { name: 'Méga-rafale', text: 'Attaque quatre fois.' },
    renaissance: { name: 'Renaissance', text: 'Revient une fois avec 1 PV après s’être effondré.' },
    venin: { name: 'Toxique', text: 'Détruit tout astre qu’il blesse en attaquant.' },
    arrimage: { name: 'Arrimage', text: 'Peut se poser sur une Machine pour lui donner ses statistiques et ses mots-clés.' },
    // Mots-clés de position (v70) : l'arrière a son rôle.
    portee: { name: 'Portée', text: 'Attaque aussi depuis l’arrière, sans subir de riposte.' },
    percee: { name: 'Percée', text: 'Frappe l’arrière ennemi en priorité, sauf si une Garde tient l’avant ennemi.' },
    garde: { name: 'Garde', text: 'Tant qu’il tient à l’avant, l’ennemi ne peut pas frapper votre arrière avec Percée.' }
  };
  // Les astres qui reçoivent un mot-clé de position (ajouté en tête de leur texte).
  const POSITION_KW = {
    portee: ['aube', 'braise', 'magma', 'geante', 'selene', 'europe', 'prisme', 'satellite', 'nimbus'],
    percee: ['meteore', 'encke', 'ison', 'spore', 'zephyr', 'eclipse'],
    garde: ['silex', 'basalte', 'monolithe', 'station', 'sentinelle', 'banquise', 'luna', 'titania']
  };

  // Phénomènes (v70) : des combinaisons de placement qui transforment un astre au début du combat.
  // « Juste derrière » : l'astre de l'arrière dans la même colonne (rangées centrées, comme à
  // l'écran) ; « entre deux » : ses deux voisins de rangée.
  const PHENOMENA = {
    accretion: { name: 'Accrétion', text: 'Un astre de l’avant avec un Minéral juste derrière lui grossit : +2/+5, ou +3/+7 si c’est aussi un Minéral.' },
    trounoir: { name: 'Trou noir', text: 'Un astre du Néant à l’avant, avec un astre du Néant juste derrière lui, s’effondre en trou noir : Rempart, et +1/+1 chaque fois qu’un astre s’effondre pendant le combat.' },
    supernova: { name: 'Supernova', text: 'Un astre du Brasier à l’avant, avec un astre du Brasier juste derrière lui, explose en s’effondrant : 4 dégâts à tous les ennemis de l’avant.' },
    eclipse: { name: 'Éclipse', text: 'Une Lune à l’avant, avec un Soleil juste derrière elle : l’ennemi en face d’elle perd la moitié de son Attaque.' },
    habitable: { name: 'Zone habitable', text: 'Un astre de Vie à l’avant, avec un Soleil juste derrière lui : +2/+3 et Renaissance.' },
    queue: { name: 'Queue de comète', text: 'Une Comète à l’avant, avec une Comète juste derrière elle : Rafale et +2 Attaque.' },
    halo: { name: 'Halo', text: 'Un astre de Glace à l’avant, avec un astre de Glace juste derrière lui : tous deux gagnent Bouclier.' },
    jumeaux: { name: 'Jumeaux', text: 'Un astre de l’Envers à l’avant, avec un astre de l’Envers juste derrière lui : tous deux gagnent Renaissance.' },
    prisme: { name: 'Prisme', text: 'Un Cristal entre deux Cristaux de sa rangée : +2/+2 par voisin et Bouclier.' },
    cyclone: { name: 'Œil du cyclone', text: 'Un astre de Tempête à l’avant, avec un astre de Tempête juste derrière lui : Rafale, ou Méga-rafale s’il l’avait déjà.' }
  };

  // ─── Catalogue ──────────────────────────────────────────────
  // Hooks de création : play (Naissance), endTurn, startTurn, buy.
  // Hooks de combat : start, attack, allyAttack, death (Effondrement), allyDeath,
  // shieldBreak, damaged, allyKill, reborn, allyReborn. m = 2 si doré.
  const CARDS = [
    // VIE
    { id: 'aube', fam: 'vie', tier: 1, atk: 1, hp: 3, name: 'Aube', sun: true, look: { type: 'star', seed: 101, starClass: 'étoile orange' },
      text: 'Soleil. Fin de cycle : un autre astre de Vie gagne +{1} PV.',
      endTurn(x, u, m) { x.buff(x.rnd(x.fam('vie', u)), 0, m); } },
    { id: 'gaia', fam: 'vie', tier: 1, atk: 2, hp: 2, name: 'Gaïa', look: { type: 'desert', seed: 404, hueShift: 70 },
      text: 'Habitable : fin de cycle, avec un Soleil, gagne +{1}/+{1}.',
      endTurn(x, u, m) { x.habitable((b) => x.buff(u, m + b, m + b)); } },
    { id: 'pelagia', fam: 'vie', tier: 2, atk: 2, hp: 4, name: 'Pélagia', look: { type: 'ocean', seed: 313 },
      text: 'Naissance : vos autres astres de Vie gagnent +{1}/+{1}.',
      play(x, u, m) { for (const v of x.fam('vie', u)) x.buff(v, m, m); } },
    { id: 'sylve', fam: 'vie', tier: 2, atk: 3, hp: 3, name: 'Sylve', look: { type: 'terran', seed: 404, hueShift: 40 },
      text: 'Habitable : fin de cycle, avec un Soleil, ses voisins de Vie gagnent +{1}/+{1}.',
      endTurn(x, u, m) { x.habitable((b) => { for (const v of x.neighbors(u)) if (famOf(v) === 'vie') x.buff(v, m + b, m + b); }); } },
    { id: 'sol', fam: 'vie', tier: 3, atk: 3, hp: 5, name: 'Sol', sun: true, look: { type: 'star', seed: 505, starClass: 'naine jaune' },
      text: 'Soleil. Vos effets Habitable donnent +{1}/+{1} de plus.' },
    { id: 'terra', fam: 'vie', tier: 3, atk: 3, hp: 4, name: 'Terra', look: { type: 'earth', seed: 606, moons: 1 },
      text: 'Habitable : fin de cycle, avec un Soleil, 2 autres astres de Vie gagnent +{1}/+{1}.',
      endTurn(x, u, m) { x.habitable((b) => { for (const v of x.pick(x.fam('vie', u), 2)) x.buff(v, m + b, m + b); }); } },
    { id: 'genese', fam: 'vie', tier: 4, atk: 3, hp: 5, name: 'Genèse', look: { type: 'ocean', seed: 707, shell: true },
      text: 'Fin de cycle : vos autres astres de Vie gagnent +{1} PV, ou +{1}/+{1} avec un Soleil.',
      endTurn(x, u, m) { const sun = x.hasSun(); for (const v of x.fam('vie', u)) x.buff(v, sun ? m : 0, m); } },
    { id: 'helios', fam: 'vie', tier: 5, atk: 6, hp: 8, name: 'Hélios', sun: true, look: { type: 'star', seed: 808, starClass: 'étoile blanche' },
      text: 'Soleil. Vos effets Habitable se déclenchent {1} fois de plus.' },
    { id: 'eden', fam: 'vie', tier: 6, atk: 7, hp: 8, name: 'Éden', look: { type: 'earth', seed: 909, shell: true, moons: 2 },
      text: 'Fin de cycle : vos astres de Vie gagnent +{1}/+{1}.',
      endTurn(x, u, m) { for (const v of x.fam('vie')) x.buff(v, m, m); } },

    // NÉANT
    { id: 'cendre', fam: 'neant', tier: 1, atk: 2, hp: 1, name: 'Cendre', look: { type: 'asteroid', seed: 115, debris: true },
      text: 'Effondrement : invoque un Débris {1}/{1}.',
      death(c, u, m, i) { c.summon(u.side, 'debris', i, m); } },
    { id: 'umbra', fam: 'neant', tier: 1, atk: 1, hp: 3, name: 'Umbra', look: { type: 'blackhole', seed: 222 },
      text: 'Quand un autre allié s’effondre, gagne +{1}/+{1} pour le combat.',
      allyDeath(c, u, m) { c.buff(u, m, m); } },
    { id: 'vestige', fam: 'neant', tier: 2, atk: 3, hp: 2, name: 'Vestige', look: { type: 'dead', seed: 333, ring: true, shape: 'brisee', coreHue: 290 },
      text: 'Effondrement : vos astres du Néant gagnent +{1} Attaque définitivement.',
      death(c, u, m) { c.permFam(u.side, 'neant', m, 0); } },
    { id: 'nyx', fam: 'neant', tier: 2, atk: 2, hp: 2, name: 'Nyx', look: { type: 'moon', seed: 444, moons: 1, light: [-0.85, -0.2, -0.45], hueShift: 230 },
      text: 'Effondrement : invoque deux Débris {1}/{1}.',
      death(c, u, m, i) { c.summon(u.side, 'debris', i, m); c.summon(u.side, 'debris', i, m); } },
    { id: 'abysse', fam: 'neant', tier: 3, atk: 3, hp: 5, name: 'Abysse', look: { type: 'blackhole', seed: 555, disk: false, lens: 1.95, hot: [[0.28, 0.13, 305], [0.48, 0.2, 300], [0.66, 0.19, 295], [0.82, 0.12, 290]] },
      text: 'Quand un autre allié s’effondre, gagne +{2}/+{1} pour le combat.',
      allyDeath(c, u, m) { c.buff(u, 2 * m, m); } },
    { id: 'eclipse', fam: 'neant', tier: 3, atk: 4, hp: 3, name: 'Éclipse', look: { type: 'eclipse', seed: 666 },
      text: 'Effondrement : un allié aléatoire gagne +{3}/+{3} pour le combat.',
      death(c, u, m) { c.buff(c.rnd(c.allies(u.side)), 3 * m, 3 * m); } },
    { id: 'ossuaire', fam: 'neant', tier: 4, atk: 3, hp: 6, name: 'Ossuaire', kw: ['rempart'], look: { type: 'dead', seed: 777, debris: true, shape: 'double' },
      text: 'Rempart. Effondrement : invoque deux Débris {2}/{2}.',
      death(c, u, m, i) { c.summon(u.side, 'debris', i, 2 * m); c.summon(u.side, 'debris', i, 2 * m); } },
    { id: 'linceul', fam: 'neant', tier: 5, atk: 5, hp: 6, name: 'Linceul', look: { type: 'dead', seed: 888, shell: true },
      text: 'Vos effets d’Effondrement se déclenchent {1} fois de plus.' },
    { id: 'neant', fam: 'neant', tier: 6, atk: 8, hp: 8, name: 'Néant', look: { type: 'blackhole', seed: 999, pitch: 0.16, diskScale: 1.5, hot: [[0.38, 0.15, 35], [0.62, 0.2, 52], [0.8, 0.17, 70], [0.95, 0.08, 88]] },
      text: 'Quand un autre allié s’effondre, gagne +{3}/+{3} pour le combat.',
      allyDeath(c, u, m) { c.buff(u, 3 * m, 3 * m); } },

    // ENVERS
    { id: 'reflet', fam: 'envers', tier: 1, atk: 3, hp: 2, name: 'Reflet', kw: ['renaissance'], look: { type: 'terran', seed: 1212, mood: 'envers', flip: true },
      text: 'Renaissance.' },
    { id: 'faille', fam: 'envers', tier: 1, atk: 1, hp: 2, name: 'Faille', look: { type: 'portal', seed: 1313, mood: 'envers', flip: true },
      text: 'Naissance : l’astre à sa gauche gagne Renaissance.',
      play(x, u) { x.kw(x.left(u), 'renaissance'); } },
    { id: 'miroir', fam: 'envers', tier: 2, atk: 3, hp: 4, name: 'Miroir', look: { type: 'crystal', seed: 1414, mood: 'envers', flip: true },
      text: 'Effondrement : l’allié à sa gauche gagne Renaissance.',
      death(c, u, m, i) { c.kw(c.sideList(u.side)[i - 1], 'renaissance'); } },
    { id: 'revenant', fam: 'envers', tier: 2, atk: 3, hp: 3, name: 'Revenant', kw: ['renaissance'], look: { type: 'dead', seed: 1515, mood: 'envers', flip: true },
      text: 'Renaissance. Quand il revient, gagne +{3}/+{3}.',
      reborn(c, u, m) { c.buff(u, 3 * m, 3 * m); } },
    { id: 'antipode', fam: 'envers', tier: 3, atk: 4, hp: 4, name: 'Antipode', look: { type: 'toxic', seed: 1616, mood: 'envers', flip: true },
      text: 'Quand un allié revient avec Renaissance, vos astres de l’Envers gagnent +{2}/+{2} pour le combat.',
      allyReborn(c, u, m) { for (const v of c.alliesFam(u.side, 'envers')) c.buff(v, 2 * m, 2 * m); } },
    { id: 'spore', fam: 'envers', tier: 3, atk: 2, hp: 4, name: 'Spore', kw: ['venin'], look: { type: 'toxic', seed: 1717, mood: 'envers', flip: true, shape: 'amas' },
      text: 'Toxique.' },
    { id: 'outremonde', fam: 'envers', tier: 4, atk: 5, hp: 6, name: 'Outremonde', look: { type: 'portal', seed: 1818, flip: true },
      text: 'Début de combat : inverse l’Attaque et les PV de l’ennemi le plus fort.',
      textGold: 'Début de combat : inverse l’Attaque et les PV des deux ennemis les plus forts.',
      start(c, u, m) { const t = c.ranked(1 - u.side).slice(0, m); for (const v of t) c.swap(v); } },
    { id: 'revers', fam: 'envers', tier: 5, atk: 6, hp: 8, name: 'Revers', look: { type: 'crystal', seed: 1919, mood: 'envers', flip: true, debris: true },
      text: 'Début de combat : vos astres de l’Envers gagnent Renaissance.',
      start(c, u) { for (const v of c.alliesFam(u.side, 'envers')) c.kw(v, 'renaissance'); } },
    { id: 'envers', fam: 'envers', tier: 6, atk: 8, hp: 10, name: 'L’Envers', look: { type: 'portal', seed: 2020, mood: 'envers', flip: true },
      text: 'Début de combat : inverse l’Attaque et les PV des ennemis qui ont plus d’Attaque que de PV.',
      start(c, u) { for (const v of c.allies(1 - u.side)) if (v.atk > v.hp) c.swap(v); } },

    // BRASIER
    { id: 'braise', fam: 'brasier', tier: 1, atk: 2, hp: 3, name: 'Braise', look: { type: 'lava', seed: 2121 },
      text: 'Début de combat : inflige {1} dégât à un ennemi aléatoire.',
      start(c, u, m) { c.dmg(u, c.rnd(c.allies(1 - u.side)), m); } },
    { id: 'scorie', fam: 'brasier', tier: 1, atk: 3, hp: 3, name: 'Scorie', look: { type: 'lava', seed: 2222, moons: 1 },
      text: 'Effondrement : inflige {2} dégâts à un ennemi aléatoire.',
      death(c, u, m) { c.dmg(u, c.rnd(c.allies(1 - u.side)), 2 * m); } },
    { id: 'vulcain', fam: 'brasier', tier: 2, atk: 3, hp: 3, name: 'Vulcain', look: { type: 'lava', seed: 2323, ring: true },
      text: 'Après son attaque : inflige {1} dégât à tous les ennemis.',
      attack(c, u, m) { for (const v of c.allies(1 - u.side)) c.dmg(u, v, m); } },
    { id: 'tison', fam: 'brasier', tier: 2, atk: 2, hp: 4, name: 'Tison', look: { type: 'star', seed: 2424, starClass: 'naine rouge', debris: true },
      text: 'Vos effets infligent +{1} dégât.' },
    { id: 'magma', fam: 'brasier', tier: 3, atk: 4, hp: 5, name: 'Magma', look: { type: 'lava', seed: 2525, moons: 1 },
      text: 'Début de combat : inflige {3} dégâts à l’ennemi le plus fort.',
      start(c, u, m) { c.dmg(u, c.ranked(1 - u.side)[0], 3 * m); } },
    { id: 'pyro', fam: 'brasier', tier: 3, atk: 3, hp: 5, name: 'Pyrosphère', look: { type: 'lava', seed: 2626, debris: true },
      text: 'Après l’attaque d’un allié de Brasier : inflige {1} dégât à un ennemi aléatoire.',
      allyAttack(c, u, m, a) { if (famOf(a) === 'brasier') c.dmg(u, c.rnd(c.allies(1 - u.side)), m); } },
    { id: 'nova', fam: 'brasier', tier: 4, atk: 5, hp: 4, name: 'Nova', look: { type: 'star', seed: 2727, starClass: 'naine jaune', shell: true },
      text: 'Effondrement : inflige {3} dégâts à tous les ennemis.',
      death(c, u, m) { for (const v of c.allies(1 - u.side)) c.dmg(u, v, 3 * m); } },
    { id: 'geante', fam: 'brasier', tier: 5, atk: 6, hp: 8, name: 'Géante rouge', look: { type: 'star', seed: 2828, starClass: 'naine rouge', hueShift: -20, moons: 2 },
      text: 'Début de combat : inflige {2} dégâts à tous les ennemis.',
      start(c, u, m) { for (const v of c.allies(1 - u.side)) c.dmg(u, v, 2 * m); } },
    { id: 'supernova', fam: 'brasier', tier: 6, atk: 8, hp: 8, name: 'Supernova', look: { type: 'star', seed: 2929, starClass: 'géante bleue', shell: true, debris: true },
      text: 'Effondrement : inflige {6} dégâts à tous les ennemis.',
      death(c, u, m) { for (const v of c.allies(1 - u.side)) c.dmg(u, v, 6 * m); } },

    // GLACE
    { id: 'nive', fam: 'glace', tier: 1, atk: 2, hp: 1, name: 'Nivé', kw: ['bouclier'], look: { type: 'ice', seed: 3131 },
      text: 'Bouclier.' },
    { id: 'givre', fam: 'glace', tier: 1, atk: 2, hp: 3, name: 'Givre', look: { type: 'ice', seed: 3232, moons: 1 },
      text: 'Naissance : l’astre à sa gauche gagne Bouclier.',
      play(x, u) { x.kw(x.left(u), 'bouclier'); } },
    { id: 'boreale', fam: 'glace', tier: 2, atk: 3, hp: 4, name: 'Boréale', look: { type: 'ice', seed: 3333 },
      text: 'Quand un Bouclier allié se brise, gagne +{2} Attaque pour le combat.',
      shieldBreak(c, u, m) { c.buff(u, 2 * m, 0); } },
    { id: 'comete', fam: 'glace', tier: 2, atk: 3, hp: 3, name: 'Comète', kw: ['bouclier'], look: { type: 'ice', seed: 3434, shape: 'double' },
      text: 'Bouclier. Effondrement : un allié aléatoire gagne Bouclier.',
      death(c, u) { c.kw(c.rnd(c.allies(u.side).filter((v) => !v.kw.includes('bouclier'))), 'bouclier'); } },
    // Sérac (v89, ex-« Cristal », trop proche de la famille Cristal) : un monde de glace fracturé au cœur
    // bleu. L'identifiant « cristal » reste pour les sauvegardes et les parties en ligne.
    { id: 'cristal', fam: 'glace', tier: 3, atk: 4, hp: 5, name: 'Sérac', kw: ['bouclier'], look: { type: 'ice', seed: 3536, shape: 'brisee', coreHue: 195 },
      text: 'Bouclier. Début de combat : vos astres de Glace gagnent +{1} Attaque.',
      start(c, u, m) { for (const v of c.alliesFam(u.side, 'glace')) c.buff(v, m, 0); } },
    { id: 'banquise', fam: 'glace', tier: 3, atk: 3, hp: 6, name: 'Banquise', kw: ['rempart', 'bouclier'], look: { type: 'ice', seed: 3636, ring: true },
      text: 'Rempart. Bouclier.' },
    { id: 'zero', fam: 'glace', tier: 4, atk: 5, hp: 6, name: 'Zéro absolu', look: { type: 'star', seed: 3737, starClass: 'étoile blanche' },
      text: 'Début de combat : vos autres astres de Glace gagnent Bouclier.',
      start(c, u) { for (const v of c.alliesFam(u.side, 'glace')) if (v !== u) c.kw(v, 'bouclier'); } },
    { id: 'aurore', fam: 'glace', tier: 5, atk: 6, hp: 7, name: 'Aurore', look: { type: 'ice', seed: 3838, moons: 2 },
      text: 'Quand un Bouclier allié se brise, vos astres de Glace gagnent +{2}/+{2} pour le combat.',
      shieldBreak(c, u, m) { for (const v of c.alliesFam(u.side, 'glace')) c.buff(v, 2 * m, 2 * m); } },
    { id: 'hiver', fam: 'glace', tier: 6, atk: 8, hp: 10, name: 'Hiver éternel', kw: ['rempart', 'bouclier'], look: { type: 'ice', seed: 3939, ring: true, moons: 1 },
      text: 'Rempart. Bouclier. Quand un allié de Glace détruit un ennemi, il regagne Bouclier.',
      allyKill(c, u, m, killer) { if (famOf(killer) === 'glace') c.kw(killer, 'bouclier'); } },

    // TEMPÊTE
    { id: 'brume', fam: 'tempete', tier: 1, atk: 2, hp: 4, name: 'Brume', look: { type: 'gas', seed: 4141, hueShift: 180 },
      text: 'Quand vous achetez un astre, gagne +{1} Attaque.',
      buy(x, u, m) { x.buff(u, m, 0); } },
    { id: 'zephyr', fam: 'tempete', tier: 1, atk: 2, hp: 3, name: 'Zéphyr', kw: ['rafale'], look: { type: 'gas', seed: 4242 },
      text: 'Rafale.' },
    { id: 'cumulus', fam: 'tempete', tier: 2, atk: 3, hp: 4, name: 'Cumulus', look: { type: 'gas', seed: 4343 },
      text: 'Naissance : vos autres astres de Tempête gagnent +{2} Attaque.',
      play(x, u, m) { for (const v of x.fam('tempete', u)) x.buff(v, 2 * m, 0); } },
    { id: 'nimbus', fam: 'tempete', tier: 2, atk: 3, hp: 4, name: 'Nimbus', look: { type: 'gas', seed: 4444, ring: true },
      text: 'Après son attaque : gagne +{2} Attaque pour le combat.',
      attack(c, u, m) { c.buff(u, 2 * m, 0); } },
    { id: 'cyclone', fam: 'tempete', tier: 3, atk: 4, hp: 6, name: 'Cyclone', kw: ['rafale'], look: { type: 'gas', seed: 4545 },
      text: 'Rafale. Après chaque attaque : gagne +{1} Attaque pour le combat.',
      attack(c, u, m) { c.buff(u, m, 0); } },
    { id: 'orage', fam: 'tempete', tier: 3, atk: 3, hp: 6, name: 'Orage', look: { type: 'gas', seed: 4646, moons: 2 },
      text: 'Quand vous achetez un astre de Tempête, vos astres de Tempête gagnent +{1}/+{1}.',
      buy(x, u, m, b) { if (famOf(b) === 'tempete') for (const v of x.fam('tempete')) x.buff(v, m, m); } },
    { id: 'titan', fam: 'tempete', tier: 4, atk: 5, hp: 7, name: 'Titan', look: { type: 'gas', seed: 4747, ring: true, moons: 1 },
      text: 'Fin de cycle : vos astres de Tempête gagnent +{2}/+{1}.',
      endTurn(x, u, m) { for (const v of x.fam('tempete')) x.buff(v, 2 * m, m); } },
    { id: 'ouragan', fam: 'tempete', tier: 5, atk: 6, hp: 9, name: 'Ouragan', kw: ['megarafale'], look: { type: 'gas', seed: 4848 },
      text: 'Méga-rafale.' },
    { id: 'tempest', fam: 'tempete', tier: 6, atk: 8, hp: 9, name: 'Tempest', look: { type: 'gas', seed: 4949, ring: true, moons: 2 },
      text: 'Début de combat : vos astres de Tempête gagnent Rafale.',
      start(c, u) { for (const v of c.alliesFam(u.side, 'tempete')) if (!v.kw.includes('megarafale')) c.kw(v, 'rafale'); } },

    // MINÉRAL
    { id: 'silex', fam: 'mineral', tier: 1, atk: 1, hp: 4, name: 'Silex', kw: ['rempart'], look: { type: 'asteroid', seed: 5151 },
      text: 'Rempart.' },
    { id: 'dune', fam: 'mineral', tier: 1, atk: 2, hp: 3, name: 'Dune', look: { type: 'desert', seed: 5252 },
      text: 'Naissance : l’astre à sa gauche gagne +{0}/+{2}.',
      play(x, u, m) { x.buff(x.left(u), 0, 2 * m); } },
    { id: 'agate', fam: 'mineral', tier: 2, atk: 2, hp: 4, name: 'Agate', kw: ['rempart'], look: { type: 'moon', seed: 5353, shape: 'double' },
      text: 'Rempart. Naissance : vos autres Remparts gagnent +{1}/+{1}.',
      play(x, u, m) { for (const v of x.board().filter((v) => v !== u && v.kw.includes('rempart'))) x.buff(v, m, m); } },
    { id: 'ocre', fam: 'mineral', tier: 2, atk: 3, hp: 3, name: 'Ocre', look: { type: 'desert', seed: 5454, moons: 1 },
      text: 'Fin de cycle : un autre allié aléatoire gagne +{1}/+{2}.',
      endTurn(x, u, m) { x.buff(x.rnd(x.others(u)), m, 2 * m); } },
    { id: 'basalte', fam: 'mineral', tier: 3, atk: 3, hp: 6, name: 'Basalte', kw: ['rempart'], look: { type: 'moon', seed: 5555, shape: 'bloc' },
      text: 'Rempart. Quand il survit à des dégâts, gagne +{2} Attaque pour le combat.',
      damaged(c, u, m) { c.buff(u, 2 * m, 0); } },
    { id: 'geode', fam: 'mineral', tier: 3, atk: 4, hp: 4, name: 'Géode', look: { type: 'moon', seed: 5656, shape: 'brisee', coreHue: 150 },
      text: 'Fin de cycle : vos Remparts gagnent +{0}/+{2}.',
      endTurn(x, u, m) { for (const v of x.board().filter((v) => v.kw.includes('rempart'))) x.buff(v, 0, 2 * m); } },
    { id: 'obsidienne', fam: 'mineral', tier: 4, atk: 4, hp: 7, name: 'Obsidienne', kw: ['rempart', 'bouclier'], look: { type: 'crystal', seed: 5757, debris: true, shape: 'amas', mood: 'obsidienne' },
      text: 'Rempart. Bouclier.' },
    { id: 'monolithe', fam: 'mineral', tier: 5, atk: 5, hp: 9, name: 'Monolithe', kw: ['rempart'], look: { type: 'desert', seed: 5858, ring: true, shape: 'monolithe' },
      text: 'Rempart. Début de combat : vos autres Remparts gagnent +{3}/+{3}.',
      start(c, u, m) { for (const v of c.allies(u.side)) if (v !== u && v.kw.includes('rempart')) c.buff(v, 3 * m, 3 * m); } },
    { id: 'colosse', fam: 'mineral', tier: 6, atk: 8, hp: 14, name: 'Colosse', kw: ['rempart'], look: { type: 'asteroid', seed: 5959, debris: true },
      text: 'Rempart. Fin de cycle : vos Remparts gagnent +{1}/+{1}.',
      endTurn(x, u, m) { for (const v of x.board().filter((v) => v.kw.includes('rempart'))) x.buff(v, m, m); } },

    // MACHINE
    { id: 'sonde', fam: 'machine', tier: 1, atk: 2, hp: 3, name: 'Sonde', kw: ['arrimage'], look: { type: 'mecha', seed: 6161, shape: 'diamant' },
      text: 'Arrimage.' },
    { id: 'relais', fam: 'machine', tier: 1, atk: 2, hp: 4, name: 'Relais', look: { type: 'mecha', seed: 6262, ring: true },
      text: 'Effondrement : invoque une Sonde {3}/{3} avec Arrimage.',
      death(c, u, m, i) { c.summon(u.side, 'sonde-t', i, m); } },
    { id: 'station', fam: 'machine', tier: 2, atk: 3, hp: 4, name: 'Station', kw: ['arrimage', 'bouclier'], look: { type: 'mecha', seed: 6363, shape: 'anneau' },
      text: 'Arrimage. Bouclier.' },
    { id: 'foreuse', fam: 'machine', tier: 2, atk: 3, hp: 4, name: 'Foreuse', look: { type: 'mecha', seed: 6464, shape: 'foret' },
      text: 'Naissance : vos autres Machines gagnent +{1}/+{2}.',
      play(x, u, m) { for (const v of x.fam('machine', u)) x.buff(v, m, 2 * m); } },
    { id: 'dyson', fam: 'machine', tier: 3, atk: 4, hp: 6, name: 'Dyson', look: { type: 'mecha', seed: 6565, shell: true },
      text: 'Début de cycle : gagnez {1} énergie.',
      startTurn(x, u, m) { x.gold(m); } },
    { id: 'arecibo', fam: 'machine', tier: 3, atk: 4, hp: 6, name: 'Arecibo', kw: ['arrimage', 'rempart'], look: { type: 'mecha', seed: 6666, shape: 'antenne' },
      text: 'Arrimage. Rempart.' },
    { id: 'sentinelle', fam: 'machine', tier: 4, atk: 5, hp: 8, name: 'Sentinelle', kw: ['arrimage', 'bouclier', 'rempart'], look: { type: 'mecha', seed: 6767, ring: true, shape: 'bloc' },
      text: 'Arrimage. Bouclier. Rempart.' },
    { id: 'forge', fam: 'machine', tier: 5, atk: 7, hp: 8, name: 'Forge stellaire', look: { type: 'mecha', seed: 6868, shape: 'brisee', coreHue: 30, moons: 1 },
      text: 'Début de combat : vos Machines gagnent Bouclier.',
      start(c, u) { for (const v of c.alliesFam(u.side, 'machine')) c.kw(v, 'bouclier'); } },
    { id: 'oeil', fam: 'machine', tier: 6, atk: 8, hp: 10, name: 'L’Œil', kw: ['arrimage', 'rafale', 'bouclier', 'venin'], look: { type: 'mecha', seed: 6969 },
      text: 'Arrimage. Rafale. Bouclier. Toxique.' },

    // NEUTRES
    { id: 'errante', fam: 'neutre', tier: 1, atk: 3, hp: 2, name: 'Errante', look: { type: 'asteroid', seed: 7171 },
      text: 'Une roche sans attache.' },
    { id: 'echo', fam: 'neutre', tier: 1, atk: 1, hp: 2, name: 'Écho', look: { type: 'asteroid', seed: 7272, shape: 'double' },
      text: 'Naissance : gagnez {1} énergie.',
      play(x, u, m) { x.gold(m); } },
    { id: 'satellite', fam: 'neutre', tier: 2, atk: 2, hp: 3, name: 'Satellite', look: { type: 'moon', seed: 7373, ring: true },
      text: 'Naissance : un autre allié aléatoire gagne +{1}/+{1}.',
      play(x, u, m) { x.buff(x.rnd(x.others(u)), m, m); } },
    { id: 'luna', fam: 'neutre', tier: 2, atk: 2, hp: 4, name: 'Luna', kw: ['rempart'], look: { type: 'moon', seed: 7474, light: [0.8, 0.3, -0.4] },
      text: 'Rempart.' },
    { id: 'pelerin', fam: 'neutre', tier: 3, atk: 3, hp: 4, name: 'Pèlerin', look: { type: 'terran', seed: 7575, ring: true },
      text: 'Fin de cycle : un autre allié aléatoire gagne +{1}/+{2}.',
      endTurn(x, u, m) { x.buff(x.rnd(x.others(u)), m, 2 * m); } },
    { id: 'pulsar', fam: 'neutre', tier: 4, atk: 4, hp: 4, name: 'Pulsar', kw: ['bouclier', 'rafale'], look: { type: 'star', seed: 7676, starClass: 'géante bleue' },
      text: 'Bouclier. Rafale.' },
    { id: 'nebuleuse', fam: 'neutre', tier: 5, atk: 4, hp: 6, name: 'Nébuleuse', look: { type: 'gas', seed: 7777, shell: true },
      text: 'Fin de cycle : vos autres astres gagnent +{1}/+{1}.',
      endTurn(x, u, m) { for (const v of x.others(u)) x.buff(v, m, m); } },
    { id: 'origine', fam: 'neutre', tier: 6, atk: 7, hp: 7, name: 'Origine', look: { type: 'crystal', seed: 7878, shell: true },
      text: 'Début de combat : vos autres astres gagnent +{2}/+{2}.',
      start(c, u, m) { for (const v of c.allies(u.side)) if (v !== u) c.buff(v, 2 * m, 2 * m); } },

    // LUNES : l'ordre compte, elles renforcent leurs voisins.
    { id: 'phobos', fam: 'lune', tier: 1, atk: 2, hp: 2, name: 'Phobos', look: { type: 'moon', seed: 9101, hueShift: 45 },
      text: 'Naissance : l’astre à sa droite gagne +{1}/+{1}.',
      play(x, u, m) { x.buff(x.right(u), m, m); } },
    { id: 'selene', fam: 'lune', tier: 1, atk: 1, hp: 3, name: 'Séléné', look: { type: 'moon', seed: 9102, hueShift: 40, light: [-0.8, 0.3, -0.42] },
      text: 'Début de combat : ses voisins gagnent +{1} Attaque pour le combat.',
      start(c, u, m) { for (const v of c.neighbors(u)) c.buff(v, m, 0); } },
    { id: 'callisto', fam: 'lune', tier: 2, atk: 3, hp: 3, name: 'Callisto', look: { type: 'moon', seed: 9103 },
      text: 'Après l’attaque d’un astre voisin : gagne +{1}/+{1} pour le combat.',
      allyAttack(c, u, m, a) { if (c.neighbors(u).includes(a)) c.buff(u, m, m); } },
    { id: 'io', fam: 'lune', tier: 2, atk: 2, hp: 4, name: 'Io', look: { type: 'lava', seed: 9104, hueShift: 30 },
      text: 'Fin de cycle : un voisin aléatoire gagne +{1}/+{1}.',
      endTurn(x, u, m) { x.buff(x.rnd(x.neighbors(u)), m, m); } },
    { id: 'titania', fam: 'lune', tier: 3, atk: 3, hp: 5, name: 'Titania', kw: ['rempart'], look: { type: 'ice', seed: 9105 },
      text: 'Rempart. Début de combat : ses voisins gagnent Bouclier.',
      start(c, u) { for (const v of c.neighbors(u)) c.kw(v, 'bouclier'); } },
    { id: 'europe', fam: 'lune', tier: 3, atk: 4, hp: 4, name: 'Europe', look: { type: 'ice', seed: 9106, hueShift: 20 },
      text: 'Fin de cycle : vos autres Lunes gagnent +{1}/+{1}.',
      endTurn(x, u, m) { for (const v of x.fam('lune', u)) x.buff(v, m, m); } },
    { id: 'ganymede', fam: 'lune', tier: 4, atk: 5, hp: 6, name: 'Ganymède', look: { type: 'moon', seed: 9107, hueShift: 200, moons: 1 },
      text: 'Début de combat : chaque Lune donne +{1}/+{1} à ses voisins pour le combat.',
      start(c, u, m) { for (const l of c.alliesFam(u.side, 'lune')) for (const v of c.neighbors(l)) c.buff(v, m, m); } },
    { id: 'maree', fam: 'lune', tier: 5, atk: 6, hp: 7, name: 'Grande Marée', look: { type: 'ocean', seed: 9108, moons: 2 },
      text: 'Fin de cycle : vos astres voisins d’une Lune gagnent +{1}/+{1}.',
      endTurn(x, u, m) { const set = new Set(); for (const l of x.fam('lune')) for (const v of x.neighbors(l)) set.add(v); for (const v of set) x.buff(v, m, m); } },
    { id: 'pleinelune', fam: 'lune', tier: 6, atk: 8, hp: 9, name: 'Pleine Lune', look: { type: 'moon', seed: 9109, shell: true },
      text: 'Début de combat : vos autres astres gagnent +{1}/+{1} par Lune (3 au plus).',
      start(c, u, m) { const n = Math.min(3, c.alliesFam(u.side, 'lune').length) * m; for (const v of c.allies(u.side)) if (v !== u) c.buff(v, n, n); } },

    // COMÈTES : elles grandissent quand vous actualisez et récompensent la vente.
    { id: 'meteore', fam: 'comete', tier: 1, atk: 2, hp: 3, name: 'Météore', look: { type: 'comet', seed: 9201, warm: true },
      text: 'Quand vous actualisez la Création, gagne +{1} Attaque.',
      roll(x, u, m) { x.buff(u, m, 0); } },
    { id: 'halley', fam: 'comete', tier: 1, atk: 2, hp: 3, name: 'Halley', look: { type: 'comet', seed: 9202 },
      text: 'Vendu : un astre aléatoire de votre système gagne +{1}/+{1}.',
      sold(x, u, m) { x.buff(x.rnd(x.others(u)), m, m); } },
    { id: 'encke', fam: 'comete', tier: 2, atk: 3, hp: 4, name: 'Encke', look: { type: 'comet', seed: 9203, hueShift: 40 },
      text: 'Quand vous actualisez : une Comète aléatoire gagne +{1}/+{1}.',
      roll(x, u, m) { x.buff(x.rnd(x.fam('comete')), m, m); } },
    { id: 'swift', fam: 'comete', tier: 2, atk: 3, hp: 3, name: 'Swift', kw: ['rafale'], look: { type: 'asteroid', seed: 9204, debris: true },
      text: 'Rafale. Quand vous actualisez, gagne +{1} PV.',
      roll(x, u, m) { x.buff(u, 0, m); } },
    { id: 'halebopp', fam: 'comete', tier: 3, atk: 4, hp: 5, name: 'Hale-Bopp', look: { type: 'comet', seed: 9205, hueShift: -60 },
      text: 'Quand vous actualisez : vos autres Comètes gagnent +{1} PV.',
      roll(x, u, m) { for (const v of x.fam('comete', u)) x.buff(v, 0, m); } },
    { id: 'tchouri', fam: 'comete', tier: 3, atk: 4, hp: 6, name: 'Tchouri', look: { type: 'asteroid', seed: 9206, shape: 'double' },
      text: 'Fin de cycle : gagne +{1}/+{1} par actualisation faite ce cycle (3 au plus).',
      endTurn(x, u, m) { const n = Math.min(3, x.p.rolls || 0) * m; if (n) x.buff(u, n, n); } },
    { id: 'ison', fam: 'comete', tier: 4, atk: 5, hp: 6, name: 'Ison', look: { type: 'comet', seed: 9213, warm: true, hueShift: -50, debris: true },
      text: 'Vendu : vos Comètes gagnent +{2}/+{2}.',
      sold(x, u, m) { for (const v of x.fam('comete', u)) x.buff(v, 2 * m, 2 * m); } },
    { id: 'perseides', fam: 'comete', tier: 5, atk: 6, hp: 8, name: 'Perséides', look: { type: 'asteroid', seed: 9208, debris: true },
      text: 'Début de combat : inflige {2} dégâts à un ennemi aléatoire pour chaque Comète.',
      start(c, u, m) { const n = c.alliesFam(u.side, 'comete').length; for (let i = 0; i < n; i++) c.dmg(u, c.rnd(c.allies(1 - u.side)), 2 * m); } },
    { id: 'hyakutake', fam: 'comete', tier: 6, atk: 8, hp: 9, name: 'Hyakutake', look: { type: 'comet', seed: 9209, hueShift: 100, debris: true },
      text: 'Quand vous actualisez : deux Comètes aléatoires gagnent +{1}/+{1}.',
      roll(x, u, m) { const l = x.fam('comete'), a = x.rnd(l); x.buff(a, m, m); x.buff(x.rnd(l.filter((v) => v !== a)), m, m); } },

    // CRISTAL : résonance, chaque Cristal joué renforce les autres. Allégés en v90 : un joueur « tout
    // Cristal » gagnait 73 % de ses duels contre l'IA experte (33 à 53 % pour les autres familles),
    // 57 % après (scratch cristal-sim : naïf une famille contre IA experte, 300 duels).
    // u.res compte les résonances déjà reçues par Quartz et Opale.
    { id: 'quartz', fam: 'cristal', tier: 1, atk: 2, hp: 2, name: 'Quartz', look: { type: 'crystal', seed: 9301, shape: 'monolithe' },
      text: 'Quand vous jouez un autre Cristal, gagne +{1}/+{1} (3 fois au plus).',
      allyPlay(x, u, m, b) { if (famOf(b) === 'cristal' && (u.res || 0) < 3) { u.res = (u.res || 0) + 1; x.buff(u, m, m); } } },
    { id: 'amethyste', fam: 'cristal', tier: 1, atk: 2, hp: 3, name: 'Améthyste', look: { type: 'crystal', seed: 9302, hueShift: 60, shape: 'amas' },
      text: 'Naissance : un autre Cristal aléatoire gagne +{1} PV.',
      play(x, u, m) { x.buff(x.rnd(x.fam('cristal', u)), 0, m); } },
    { id: 'prisme', fam: 'cristal', tier: 2, atk: 2, hp: 4, name: 'Prisme', look: { type: 'crystal', seed: 9303, shell: true, shape: 'bloc' },
      text: 'Quand vous jouez un Cristal, vos Cristaux gagnent +{1} PV.',
      allyPlay(x, u, m, b) { if (famOf(b) === 'cristal') for (const v of x.fam('cristal')) x.buff(v, 0, m); } },
    { id: 'saphir', fam: 'cristal', tier: 2, atk: 3, hp: 3, name: 'Saphir', look: { type: 'crystal', seed: 9304, hueShift: 180, shape: 'diamant' },
      text: 'Début de combat : gagne +{1}/+{1} par autre Cristal (3 au plus).',
      start(c, u, m) { const n = Math.min(3, c.alliesFam(u.side, 'cristal').length - 1) * m; if (n > 0) c.buff(u, n, n); } },
    { id: 'rubis', fam: 'cristal', tier: 3, atk: 4, hp: 4, name: 'Rubis', look: { type: 'crystal', seed: 9305, hueShift: 300 },
      text: 'Quand vous jouez un Cristal, il gagne +{1}/+{1}.',
      allyPlay(x, u, m, b) { if (famOf(b) === 'cristal') x.buff(b, m, m); } },
    { id: 'opale', fam: 'cristal', tier: 3, atk: 3, hp: 5, name: 'Opale', kw: ['bouclier'], look: { type: 'crystal', seed: 9306, shell: true },
      text: 'Bouclier. Quand vous jouez un Cristal, gagne +{1}/+{1} (4 fois au plus).',
      allyPlay(x, u, m, b) { if (famOf(b) === 'cristal' && (u.res || 0) < 4) { u.res = (u.res || 0) + 1; x.buff(u, m, m); } } },
    { id: 'emeraude', fam: 'cristal', tier: 4, atk: 5, hp: 5, name: 'Émeraude', look: { type: 'crystal', seed: 9307, hueShift: 120, shape: 'foret' },
      text: 'Quand vous jouez un Cristal, vos Cristaux gagnent +{1} Attaque.',
      allyPlay(x, u, m, b) { if (famOf(b) === 'cristal') for (const v of x.fam('cristal')) x.buff(v, m, 0); } },
    { id: 'diamant', fam: 'cristal', tier: 5, atk: 6, hp: 8, name: 'Diamant', look: { type: 'crystal', seed: 9308, ring: true, shape: 'diamant' },
      text: 'Début de combat : vos autres Cristaux gagnent +{1}/+{1}.',
      start(c, u, m) { for (const v of c.alliesFam(u.side, 'cristal')) if (v !== u) c.buff(v, m, m); } },
    { id: 'coeurcristal', fam: 'cristal', tier: 6, atk: 8, hp: 8, name: 'Cœur de cristal', look: { type: 'crystal', seed: 9309, shell: true, moons: 1 },
      text: 'Quand vous jouez un Cristal, vos Cristaux gagnent +{1}/+{1}.',
      allyPlay(x, u, m, b) { if (famOf(b) === 'cristal') for (const v of x.fam('cristal')) x.buff(v, m, m); } },

    // ANOMALIES : le hasard, des astres qui surgissent de nulle part.
    { id: 'fluctuation', fam: 'anomalie', tier: 1, atk: 2, hp: 2, name: 'Fluctuation', look: { type: 'portal', seed: 9401, hueShift: 90 },
      text: 'Naissance : ajoute un astre de niveau 1 aléatoire à votre main.',
      play(x, u, m) { for (let i = 0; i < m; i++) x.addHand(1); } },
    { id: 'paradoxe', fam: 'anomalie', tier: 1, atk: 3, hp: 2, name: 'Paradoxe', look: { type: 'toxic', seed: 9402, hueShift: 60, shape: 'anneau' },
      text: 'Effondrement : invoque un astre de niveau 1 aléatoire.',
      death(c, u, m, i) { for (let k = 0; k < m; k++) c.summonRandom(u.side, 1, i); } },
    { id: 'distorsion', fam: 'anomalie', tier: 2, atk: 3, hp: 3, name: 'Distorsion', look: { type: 'portal', seed: 9403, hueShift: 140 },
      text: 'Début de combat : un allié aléatoire gagne un mot-clé aléatoire.',
      start(c, u, m) { for (let k = 0; k < m; k++) c.randomKw(c.rnd(c.allies(u.side))); } },
    { id: 'troublanc', fam: 'anomalie', tier: 2, atk: 2, hp: 4, name: 'Trou blanc', look: { type: 'star', seed: 9404, starClass: 'étoile blanche' },
      text: 'Effondrement : invoque un astre de niveau 2 aléatoire.',
      death(c, u, m, i) { for (let k = 0; k < m; k++) c.summonRandom(u.side, 2, i); } },
    { id: 'tesseract', fam: 'anomalie', tier: 3, atk: 4, hp: 4, name: 'Tesseract', look: { type: 'mecha', seed: 9405, hueShift: 80, shape: 'bloc' },
      text: 'Naissance : découvrez un astre de votre niveau.',
      play(x, u) { u.dtier = Math.max(1, x.p.tier); } },
    { id: 'pulsation', fam: 'anomalie', tier: 3, atk: 3, hp: 5, name: 'Pulsation', look: { type: 'star', seed: 9406, starClass: 'géante bleue', shape: 'diamant' },
      text: 'Début de combat : deux alliés aléatoires gagnent un mot-clé aléatoire.',
      start(c, u, m) { for (const v of c.pickAllies(u.side, 2 * m)) c.randomKw(v); } },
    { id: 'evenement', fam: 'anomalie', tier: 4, atk: 5, hp: 6, name: 'Horizon', look: { type: 'blackhole', seed: 9407, pitch: -0.55, hot: [[0.4, 0.14, 125], [0.62, 0.2, 118], [0.8, 0.2, 112], [0.93, 0.13, 108]] },
      text: 'Effondrement : invoque un astre de niveau 4 aléatoire.',
      death(c, u, m, i) { for (let k = 0; k < m; k++) c.summonRandom(u.side, 4, i); } },
    { id: 'multivers', fam: 'anomalie', tier: 5, atk: 6, hp: 7, name: 'Multivers', look: { type: 'portal', seed: 9408, ring: true },
      text: 'Fin de cycle : ajoute un astre de niveau 3 aléatoire à votre main.',
      endTurn(x, u, m) { for (let i = 0; i < m; i++) x.addHand(3); } },
    { id: 'bigbang', fam: 'anomalie', tier: 6, atk: 8, hp: 8, name: 'Big Bang', look: { type: 'star', seed: 9409, starClass: 'géante bleue' },
      text: 'Effondrement : remplit votre système d’astres de niveau 2 aléatoires.',
      death(c, u, m, i) { for (let k = 0; k < 7; k++) if (!c.summonRandom(u.side, 2, i)) break; } },

    // JETONS (hors réserve)
    { id: 'debris', fam: 'neant', tier: 1, atk: 1, hp: 1, name: 'Débris', token: true, look: { type: 'asteroid', seed: 8181 },
      text: 'Fragment d’un monde effondré.' },
    // ─── Légendaires : une par niveau, un seul exemplaire par partie, rares dans la Création et les découvertes.
    { id: 'primordia', fam: 'vie', tier: 1, atk: 2, hp: 3, name: 'Primordia', legend: true, look: { type: 'ocean', seed: 8101, ring: true, moons: 2, hueShift: 120 },
      text: 'Fin de cycle : tous vos autres astres gagnent +{1} PV.',
      endTurn(x, u, m) { for (const v of x.others(u)) x.buff(v, 0, m); } },
    { id: 'ouroboros', fam: 'envers', tier: 2, atk: 3, hp: 3, name: 'Ouroboros', legend: true, kw: ['renaissance'], look: { type: 'portal', seed: 8202, mood: 'envers', flip: true, ring: true },
      text: 'Renaissance. Quand il revient, il gagne +{3}/+{3} et Toxique.',
      reborn(c, u, m) { c.buff(u, 3 * m, 3 * m); c.kw(u, 'venin'); } },
    { id: 'oeilvide', fam: 'neant', tier: 3, atk: 4, hp: 6, name: 'Œil du Vide', legend: true, look: { type: 'blackhole', seed: 8303, pitch: 0.5, diskScale: 1.3, hot: [[0.3, 0.14, 160], [0.52, 0.2, 170], [0.72, 0.17, 180], [0.92, 0.07, 190]] },
      text: 'Début de combat et Effondrement : anéantit l’ennemi qui a le moins de PV (99 dégâts).',
      start(c, u) { const t = c.allies(1 - u.side).slice().sort((a, b) => a.hp - b.hp)[0]; if (t) c.dmg(u, t, 99); },
      death(c, u) { const t = c.allies(1 - u.side).slice().sort((a, b) => a.hp - b.hp)[0]; if (t) c.dmg(u, t, 99); } },
    { id: 'maelstrom', fam: 'tempete', tier: 4, atk: 5, hp: 7, name: 'Maelström', legend: true, kw: ['rafale'], look: { type: 'gas', seed: 8404, ring: true, moons: 1, hueShift: 250 },
      text: 'Rafale. Après chacune de ses attaques, tous vos astres gagnent +{1}/+{1}.',
      attack(c, u, m) { for (const v of c.allies(u.side)) c.buff(v, m, m); } },
    { id: 'attracteur', fam: 'neutre', tier: 5, atk: 5, hp: 7, name: 'Grand Attracteur', legend: true, look: { type: 'star', seed: 8505, starClass: 'étoile exotique', shell: true, debris: true },
      text: 'Début de combat : chaque ennemi perd 1/1 ; le Grand Attracteur gagne tout ce qu’il a volé.',
      start(c, u) {
        let a = 0, h = 0;
        for (const v of c.allies(1 - u.side)) {
          const da = v.atk > 0 ? 1 : 0, dh = v.hp > 1 ? 1 : 0;
          c.buff(v, -da, -dh); a += da; h += dh;
        }
        c.buff(u, a, h);
      } },
    { id: 'omega', fam: 'neutre', tier: 6, atk: 7, hp: 7, name: 'Oméga', legend: true, look: { type: 'star', seed: 8606, starClass: 'étoile blanche', ring: true, moons: 3 },
      text: 'Début de combat : vos autres astres gagnent +2/+2, et les deux premiers Bouclier.',
      start(c, u) { c.allies(u.side).filter((v) => v !== u).forEach((v, i) => { c.buff(v, 2, 2); if (i < 2) c.kw(v, 'bouclier'); }); } },
    { id: 'sonde-t', fam: 'machine', tier: 1, atk: 3, hp: 3, name: 'Sonde', token: true, kw: ['arrimage'], look: { type: 'mecha', seed: 6161, shape: 'diamant' },
      text: 'Arrimage.' }
  ];
  const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));
  for (const [k, ids] of Object.entries(POSITION_KW)) {
    for (const id of ids) {
      const c = CARD[id];
      c.kw = (c.kw || []).concat([k]);
      c.text = KEYWORDS[k].name + '. ' + c.text;
    }
  }

  const LAWS = [
    { id: 'symbiose', fam: 'vie', name: 'Loi de symbiose', starter: 'aube', tagline: 'Tout commence par une étoile.', text: 'Fin de cycle : votre astre le plus faible gagne +1 PV.', awake: 'Fin de cycle : vos deux astres les plus faibles gagnent +1/+1.' },
    { id: 'entropie', fam: 'neant', name: 'Loi de l’entropie', starter: 'cendre', tagline: 'Rien ne meurt en vain.', text: 'Quand un de vos astres s’effondre, vos astres du Néant gagnent +1 Attaque pour le combat.', awake: 'Quand un de vos astres s’effondre, vos astres du Néant gagnent +1/+1 pour le combat.' },
    { id: 'renversement', fam: 'envers', name: 'Loi du renversement', starter: 'reflet', tagline: 'Le haut est en bas.', text: 'Pouvoir (gratuit, une fois par cycle) : inverse l’Attaque et les PV d’un de vos astres, puis il gagne +1/+1.', awake: 'Pouvoir (gratuit, une fois par cycle) : inverse l’Attaque et les PV d’un de vos astres, puis il gagne +2/+2.', active: { cost: 0, target: true } },
    { id: 'combustion', fam: 'brasier', name: 'Loi de combustion', starter: 'braise', tagline: 'Brûler avant de disparaître.', text: 'Début de combat : inflige 3 dégâts à un ennemi aléatoire.', awake: 'Début de combat : inflige 3 dégâts à deux ennemis aléatoires.' },
    { id: 'stase', fam: 'glace', name: 'Loi de stase', starter: 'nive', tagline: 'Le silence est une forteresse.', text: 'Début de combat : vos deux premiers astres gagnent Bouclier.', awake: 'Début de combat : vos trois premiers astres gagnent Bouclier.' },
    { id: 'vents', fam: 'tempete', name: 'Loi des vents', starter: 'brume', tagline: 'Tout ce qui bouge frappe.', text: 'Après chaque attaque, l’astre attaquant gagne +1/+1 pour le combat.', awake: 'Après chaque attaque, l’astre attaquant gagne +2/+1 pour le combat.' },
    { id: 'gravite', fam: 'mineral', name: 'Loi de gravité', starter: 'silex', tagline: 'Ce qui pèse dure.', text: 'Fin de cycle : vos Remparts gagnent +0/+1.', awake: 'Fin de cycle : vos Remparts gagnent +1/+2.' },
    { id: 'marees', fam: 'lune', name: 'Loi des marées', starter: 'phobos', tagline: 'Rien ne tourne seul.', text: 'Fin de cycle : l’astre à droite de chaque Lune gagne +1 PV.', awake: 'Fin de cycle : les deux voisins de chaque Lune gagnent +1 PV.' },
    { id: 'passage', fam: 'comete', name: 'Loi du passage', starter: 'meteore', tagline: 'Tout repasse un jour.', text: 'Votre première actualisation de chaque cycle est gratuite.', awake: 'Vos deux premières actualisations de chaque cycle sont gratuites.' },
    { id: 'resonance', fam: 'cristal', name: 'Loi de résonance', starter: 'quartz', tagline: 'Une note, et tout vibre.', text: 'Quand vous jouez un Cristal, un autre Cristal aléatoire gagne +1 PV.', awake: 'Quand vous jouez un Cristal, un autre Cristal aléatoire gagne +1/+1.' },
    { id: 'chaos', fam: 'anomalie', name: 'Loi du chaos', starter: 'fluctuation', tagline: 'Le hasard a toujours raison.', text: 'Début de combat : un allié aléatoire gagne un mot-clé aléatoire.', awake: 'Début de combat : deux alliés aléatoires gagnent un mot-clé aléatoire.' },
    { id: 'ingenierie', fam: 'machine', name: 'Loi d’ingénierie', starter: 'sonde', tagline: 'Assembler les mondes.', text: 'Pouvoir (1 énergie, une fois par cycle) : ajoute une Sonde 3/3 Arrimage à votre main.', awake: 'Pouvoir (gratuit, une fois par cycle) : ajoute une Sonde 3/3 Arrimage à votre main.', active: { cost: 1, target: false } },
    // Lois de vie : neutres, elles ne choisissent pas de famille et changent les PV de départ.
    { id: 'sacrifice', fam: 'neutre', name: 'Loi du sacrifice', starter: 'errante', hp: 22, tagline: 'Tout se paie, même l’élan.', text: 'Vous commencez avec 22 PV, mais gagnez 1 énergie de plus à chaque cycle.', awake: 'Vous gagnez 2 énergies de plus à chaque cycle, même au maximum.' },
    { id: 'endurance', fam: 'neutre', name: 'Loi d’endurance', starter: 'echo', hp: 45, tagline: 'Durer, c’est déjà vaincre.', text: 'Vous commencez avec 45 PV au lieu de 30.', awake: 'Début de combat : vos astres de l’avant gagnent +0/+2.' },
    { id: 'phenix', fam: 'neutre', name: 'Loi du phénix', starter: 'errante', hp: 25, tagline: 'Des cendres, un monde.', text: 'Vous commencez avec 25 PV. La première fois que vous tombez à 0 PV, vous renaissez avec 15 PV.', awake: 'Début de combat : votre astre le plus faible gagne Renaissance.' }
  ];
  const LAW = Object.fromEntries(LAWS.map((l) => [l.id, l]));
  // Éveil des lois (v84) : au début de ce cycle, la loi de chaque univers devient plus forte (awake).
  const AWAKE_ROUND = 6;

  // ─── Événements cosmiques (v84) ─────────────────────────────
  // Une règle spéciale par partie, la même pour tous les univers, tirée de la graine.
  const EVENTS = [
    { id: 'meteores', name: 'Pluie de météores', text: 'Les astres de niveau 1 achetés gagnent +1/+1.' },
    { id: 'abondance', name: 'Abondance', text: 'Chaque univers reçoit 1 énergie de plus à chaque cycle.' },
    { id: 'feconde', name: 'Création féconde', text: 'La Création propose un astre de plus.' },
    { id: 'recyclage', name: 'Recyclage cosmique', text: 'Vendre un astre rapporte 1 énergie de plus.' },
    { id: 'expansion', name: 'Expansion', text: 'Monter de niveau coûte 1 énergie de moins.' },
    { id: 'revelation', name: 'Révélation', text: 'Les découvertes proposent 4 astres au lieu de 3.' },
    { id: 'legendes', name: 'Ère des légendes', text: 'Les légendaires se montrent 5 fois plus souvent.' },
    { id: 'vent', name: 'Vent solaire', text: 'Début de combat : chaque camp inflige 1 dégât à tous les astres de l’avant adverse.' },
    { id: 'aurore', name: 'Aurore', text: 'Début de combat : le premier astre de chaque camp gagne Bouclier.' },
    { id: 'maree', name: 'Grande marée', text: 'Fin de cycle : l’astre le plus faible de chaque système gagne +1/+1.' },
    { id: 'instable', name: 'Instabilité', text: 'Début de combat : deux astres aléatoires de chaque camp gagnent un mot-clé aléatoire.' }
  ];
  const EVENT = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
  function eventFor(seed) {
    return EVENTS[Math.floor(mulberry(hashStr(String(seed) + '|event'))() * EVENTS.length)].id;
  }

  // ─── Reliques (v84) ─────────────────────────────────────────
  // Au début des cycles RELIC_ROUNDS, chaque univers choisit une relique parmi trois. Elle dure
  // toute la partie.
  const RELIC_ROUNDS = [4, 8];
  const RELICS = [
    { id: 'tresor', name: 'Trésor', text: 'Vous gagnez 1 énergie de plus à chaque cycle.' },
    { id: 'longuevue', name: 'Longue-vue', text: 'La Création vous propose un astre de plus.' },
    { id: 'comptoir', name: 'Comptoir', text: 'Vendre un astre rapporte 1 énergie de plus.' },
    { id: 'elan', name: 'Élan', text: 'Monter de niveau coûte 1 énergie de moins.' },
    { id: 'banniere', name: 'Bannière', text: 'Fin de cycle : un astre de votre famille la plus nombreuse gagne +1/+1.' },
    { id: 'lance', name: 'Fer de lance', text: 'Début de combat : vos astres de l’avant gagnent +1/+0.' },
    { id: 'bastion', name: 'Bastion', text: 'Début de combat : vos Remparts gagnent +0/+3.' },
    { id: 'reserve', name: 'Réserve', text: 'Quand votre arrière avance, ses astres gagnent +2/+2.' },
    { id: 'egide', name: 'Égide', text: 'Début de combat : votre premier astre gagne Bouclier.' },
    { id: 'dard', name: 'Dard', text: 'Début de combat : votre astre le plus fort gagne Toxique.' },
    { id: 'braise', name: 'Braise d’étoile', text: 'Début de combat : votre astre le plus faible gagne Renaissance.' },
    { id: 'alchimie', name: 'Alchimie', text: 'Début de combat : vos astres dorés gagnent +2/+2.' }
  ];
  const RELIC = Object.fromEntries(RELICS.map((r) => [r.id, r]));
  const hasRelic = (p, id) => !!(p && p.relics && p.relics.includes(id));

  const BOT_NAMES = ['NOX-7', 'KEPLER', 'VESPER', 'ANDROMÈDE', 'ORION', 'CASSIOPÉE', 'ATLAS', 'LYRA', 'HYDRA', 'VÉGA', 'DRACO', 'PHÉNIX'];

  // ─── Outils ─────────────────────────────────────────────────
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rngFor(state, tag) {
    state.rc = (state.rc || 0) + 1;
    return mulberry(hashStr(state.seed + '|' + tag + '|' + state.rc));
  }
  function shuffle(list, rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }
  const cardOf = (u) => CARD[typeof u === 'string' ? u : u.id];
  const famOf = (u) => cardOf(u).fam;
  const fail = (reason) => ({ ok: false, reason });
  const you = (state) => state.players[0];
  const findPlayer = (state, id) => state.players.find((p) => p.id === id);

  function cardText(id, golden) {
    const c = CARD[id];
    const m = golden ? 2 : 1;
    const src = golden && c.textGold ? c.textGold : c.text;
    return src.replace(/\{(\d+)\}/g, (_, n) => String(Number(n) * m));
  }

  function makeUnit(state, id, golden) {
    const c = CARD[id];
    const k = golden ? 2 : 1;
    return { uid: 'u' + state.uidc++, id, golden: !!golden, atk: c.atk * k, hp: c.hp * k, kw: (c.kw || []).slice(), att: [] };
  }

  // ─── Rangées et formations ──────────────────────────────────
  const rowOf = (u) => (u && u.row === 1 ? 1 : 0);
  // [avant, arrière] d'un système, sans le modifier. Au plus ROW_MAX astres par rangée : les
  // anciennes sauvegardes (sans rangée) voient leurs derniers astres passer à l'arrière.
  function layout(board) {
    const front = [], back = [];
    for (const u of board) (rowOf(u) ? back : front).push(u);
    while (front.length > ROW_MAX) back.unshift(front.pop());
    while (back.length > ROW_MAX) front.push(back.shift());
    return [front, back];
  }
  // Range le système d'un joueur : l'avant d'abord, puis l'arrière.
  function arrange(p) {
    const [front, back] = layout(p.board);
    for (const u of front) u.row = 0;
    for (const u of back) u.row = 1;
    p.board = front.concat(back);
  }
  // Les formations d'une liste d'astres déjà rangés : { fam, row, n, lvl, units }.
  function groupForms(units) {
    const out = [];
    for (const row of [0, 1]) {
      for (const fam of FAMILY_KEYS) {
        const list = units.filter((u) => rowOf(u) === row && famOf(u) === fam);
        if (list.length >= FORM_MIN) out.push({ fam, row, n: list.length, lvl: Math.min(3, list.length - 1), units: list });
      }
    }
    return out;
  }
  // Formations d'un système (pour l'écran) : { fam, row, n, lvl }.
  function formationsOf(board) {
    const [front, back] = layout(board || []);
    const ranked = front.map((u) => ({ id: u.id, row: 0 })).concat(back.map((u) => ({ id: u.id, row: 1 })));
    return groupForms(ranked).map((f) => ({ fam: f.fam, row: f.row, n: f.n, lvl: f.lvl }));
  }
  function formText(fam, row, lvl) {
    const f = FORMATIONS[fam];
    if (!f) return '';
    const text = row ? (lvl === 1 && f.back1) || f.back : (lvl === 1 && f.front1) || f.front;
    return tr(text, { n: lvl, d: 2 * lvl });
  }

  // L'astre de l'avant juste devant un astre de l'arrière : le plus proche en colonne, rangées
  // centrées ; à égalité, celui de gauche. front, back : listes dans l'ordre de l'écran.
  function aheadOf(front, back, v) {
    const xb = back.indexOf(v) - (back.length - 1) / 2;
    let best = null, bd = 9;
    front.forEach((u, i) => { const d = Math.abs(i - (front.length - 1) / 2 - xb); if (d < bd - 1e-9) { best = u; bd = d; } });
    return best;
  }
  // Phénomènes d'un système rangé : [{ kind, unit, partner }]. unit : l'astre transformé.
  function findPhenomena(front, back) {
    const out = [];
    const fam = (u) => famOf(u);
    const sun = (u) => !!cardOf(u).sun;
    const behind = (u) => back.filter((v) => aheadOf(front, back, v) === u);
    for (const u of front) {
      const bs = behind(u);
      const with_ = (test) => bs.find(test);
      let v;
      if ((v = with_((b) => fam(b) === 'mineral'))) out.push({ kind: 'accretion', unit: u, partner: v });
      if (fam(u) === 'neant' && (v = with_((b) => fam(b) === 'neant'))) out.push({ kind: 'trounoir', unit: u, partner: v });
      if (fam(u) === 'brasier' && (v = with_((b) => fam(b) === 'brasier'))) out.push({ kind: 'supernova', unit: u, partner: v });
      if (fam(u) === 'lune' && (v = with_(sun))) out.push({ kind: 'eclipse', unit: u, partner: v });
      if (fam(u) === 'vie' && !sun(u) && (v = with_(sun))) out.push({ kind: 'habitable', unit: u, partner: v });
      if (fam(u) === 'comete' && (v = with_((b) => fam(b) === 'comete'))) out.push({ kind: 'queue', unit: u, partner: v });
      if (fam(u) === 'glace' && (v = with_((b) => fam(b) === 'glace'))) out.push({ kind: 'halo', unit: u, partner: v });
      if (fam(u) === 'envers' && (v = with_((b) => fam(b) === 'envers'))) out.push({ kind: 'jumeaux', unit: u, partner: v });
      if (fam(u) === 'tempete' && (v = with_((b) => fam(b) === 'tempete'))) out.push({ kind: 'cyclone', unit: u, partner: v });
    }
    for (const row of [front, back]) {
      row.forEach((u, i) => {
        const l = row[i - 1], r = row[i + 1];
        if (!l || !r) return;
        if (fam(u) === 'cristal' && fam(l) === 'cristal' && fam(r) === 'cristal') out.push({ kind: 'prisme', unit: u, partner: l });
      });
    }
    return out;
  }
  // Phénomènes d'un système (pour l'écran) : [{ kind, uid, partner }].
  function phenomenaOf(board) {
    const [front, back] = layout(board || []);
    return findPhenomena(front, back).map((p) => ({ kind: p.kind, uid: p.unit.uid, partner: p.partner.uid }));
  }

  function copiesOf(u) {
    const list = [];
    if (!cardOf(u).token) for (let i = 0; i < (u.golden ? 3 : 1); i++) list.push(u.id);
    for (const a of u.att || []) if (!CARD[a.id].token) for (let i = 0; i < (a.golden ? 3 : 1); i++) list.push(a.id);
    return list;
  }

  function releaseUnit(state, u) {
    for (const id of copiesOf(u)) if (state.pool[id] !== undefined) state.pool[id]++;
  }

  // state : facultatif (l'événement Expansion), la relique Élan suffit sans lui.
  function upgradeCost(p, state) {
    if (p.tier >= 6) return 0;
    const off = (state && state.event === 'expansion' ? 1 : 0) + (hasRelic(p, 'elan') ? 1 : 0);
    return Math.max(0, UPGRADE[p.tier] - p.discount - off);
  }
  // Énergie de plus à chaque cycle, au-delà du maximum : événement, relique, loi éveillée.
  function bonusGold(state, p) {
    return (state.event === 'abondance' ? 1 : 0) + (hasRelic(p, 'tresor') ? 1 : 0) + (p.law === 'sacrifice' && p.awake ? 1 : 0);
  }
  const shopSize = (state, p) => Math.min(7, SHOP_SIZE[p.tier] + (state.event === 'feconde' ? 1 : 0) + (hasRelic(p, 'longuevue') ? 1 : 0));
  // Un astre doré se revend une énergie de plus (v89).
  const sellGain = (state, p, u) => 1 + (u && u.golden ? 1 : 0) + (state.event === 'recyclage' ? 1 : 0) + (hasRelic(p, 'comptoir') ? 1 : 0);
  const powerCost = (p) => (p.law === 'ingenierie' && p.awake ? 0 : (LAW[p.law].active || {}).cost || 0);

  // ─── Contexte de création ────────────────────────────────────
  function shopCtx(state, p) {
    const rng = rngFor(state, 'shop:' + p.id);
    const x = {
      p, events: [],
      board: () => p.board,
      rnd: (list) => (list && list.length ? list[Math.floor(rng() * list.length)] : null),
      pick: (list, n) => shuffle(list.slice(), rng).slice(0, n),
      fam: (f, except) => p.board.filter((v) => v !== except && famOf(v) === f),
      others: (u) => p.board.filter((v) => v !== u),
      // Gauche et droite : dans la même rangée.
      mates: (u) => p.board.filter((v) => rowOf(v) === rowOf(u)),
      left: (u) => { const l = x.mates(u); return l[l.indexOf(u) - 1] || null; },
      right: (u) => { const l = x.mates(u); return l[l.indexOf(u) + 1] || null; },
      neighbors: (u) => [x.left(u), x.right(u)].filter(Boolean),
      hasSun: () => p.board.some((v) => cardOf(v).sun),
      habitable(fn) {
        if (!x.hasSun()) return;
        const mult = (id) => p.board.filter((v) => v.id === id).reduce((s, v) => s + (v.golden ? 2 : 1), 0);
        const times = 1 + mult('helios'), bonus = mult('sol');
        for (let i = 0; i < times; i++) fn(bonus);
      },
      buff(u, a, h) {
        if (!u || (!a && !h)) return;
        u.atk = Math.max(0, u.atk + a);
        u.hp += h;
        x.events.push({ t: 'buff', uid: u.uid, a, h });
      },
      kw(u, k) {
        if (!u || u.kw.includes(k)) return;
        u.kw.push(k);
        x.events.push({ t: 'kw', uid: u.uid, k });
      },
      swap(u) {
        if (!u || u.atk <= 0) return;
        const a = u.atk;
        u.atk = u.hp; u.hp = a;
        x.events.push({ t: 'swap', uid: u.uid });
      },
      gold(n) {
        p.gold = Math.min(99, p.gold + n);
        x.events.push({ t: 'gold', n });
      },
      // Un astre du niveau donné, pris dans la réserve partagée, rejoint la main.
      addHand(tier) {
        if (p.hand.length >= HAND_MAX) return;
        const id = drawFromPool(state, tier, rng, tier);
        if (!id) return;
        const nu = makeUnit(state, id);
        p.hand.push(nu);
        x.events.push({ t: 'hand', uid: nu.uid, id });
        // Troisième exemplaire : fusion dorée, comme à l'achat.
        const triple = checkTriple(state, p, id);
        if (triple) x.events.push({ t: 'triple', id, uid: triple.uid, merged: triple.merged });
      }
    };
    return x;
  }

  function hook(u, name, x, ...args) {
    const c = cardOf(u);
    if (typeof c[name] !== 'function') return;
    x.events.push({ t: 'trigger', uid: u.uid });
    c[name](x, u, u.golden ? 2 : 1, ...args);
  }

  // ─── Réserve et création ─────────────────────────────────────
  function drawFromPool(state, maxTier, rng, exactTier) {
    const ids = Object.keys(state.pool).filter((id) => {
      const t = CARD[id].tier;
      return state.pool[id] > 0 && !CARD[id].legend && (exactTier ? t === exactTier : t <= maxTier);
    });
    const total = ids.reduce((s, id) => s + state.pool[id], 0);
    if (total <= 0) return null;
    let roll = rng() * total;
    for (const id of ids) {
      roll -= state.pool[id];
      if (roll < 0) { state.pool[id]--; return id; }
    }
    const last = ids[ids.length - 1];
    state.pool[last]--;
    return last;
  }

  // Une légendaire encore libre, de niveau au plus maxTier.
  function drawLegend(state, maxTier, rng) {
    const ids = Object.keys(state.pool).filter((id) => CARD[id].legend && state.pool[id] > 0 && CARD[id].tier <= maxTier);
    if (!ids.length) return null;
    const id = ids[Math.floor(rng() * ids.length)];
    state.pool[id]--;
    return id;
  }

  function releaseShop(state, p) {
    for (const id of p.shop) if (id) state.pool[id]++;
    p.shop = [];
  }

  function rollShop(state, p) {
    releaseShop(state, p);
    refillShop(state, p);
  }

  // Garde les astres gelés et complète les emplacements vides.
  function refillShop(state, p) {
    const rng = rngFor(state, 'roll:' + p.id);
    p.shop = p.shop.filter(Boolean);
    while (p.shop.length < shopSize(state, p)) {
      const id = (rng() < LEGEND_SHOP * (state.event === 'legendes' ? 5 : 1) && drawLegend(state, p.tier, rng)) || drawFromPool(state, p.tier, rng);
      if (!id) break;
      p.shop.push(id);
    }
  }

  // ─── Partie ─────────────────────────────────────────────────
  function lawChoices(seed) {
    const rng = mulberry(hashStr(seed + '|laws'));
    return shuffle(LAWS.slice(), rng).slice(0, 3).map((l) => l.id);
  }

  function newPlayer(state, id, name, lawId, bot) {
    const law = LAW[lawId];
    const hpMult = state.size === DUEL.players ? DUEL.hp : 1;
    const p = {
      id, name, bot, law: lawId, pref: law.fam, hpMult,
      hp: (law.hp || START_HP) * hpMult, maxHp: (law.hp || START_HP) * hpMult, tier: 1, gold: 3 + (state.event === 'abondance' ? 1 : 0), discount: 0,
      board: [], hand: [], shop: [], discover: [],
      frozen: false, powerUsed: false, alive: true, rank: null, relics: [], relicChoice: [], awake: false,
      lastOpp: null, deadRound: 0, greed: 0
    };
    const starter = makeUnit(state, law.starter);
    state.pool[law.starter]--;
    starter.row = 0;
    p.board.push(starter);
    return p;
  }

  function newGame(seed, lawId, opts) {
    seed = String(seed);
    opts = opts || {};
    const rng = mulberry(hashStr(seed + '|families'));
    const law = LAW[lawId] || LAWS[0];
    const others = shuffle(FAMILY_KEYS.filter((f) => f !== law.fam), rng);
    // Multijoueur : les familles sont celles de la partie, les mêmes pour tous.
    const families = opts.families ? opts.families.slice() : law.fam === 'neutre' ? others.slice(0, ACTIVE_FAMILIES) : [law.fam].concat(others.slice(0, ACTIVE_FAMILIES - 1));
    const seats = opts.seats || [];
    // Nombre d'univers : 2 pour un duel, 8 pour une mêlée.
    const size = Math.max(2, Math.min(PLAYERS, opts.size || PLAYERS));
    // Outils de mesure : liste complète, en ordre de création des bots (pas leurs identifiants).
    // Les lois explicites sont validées avant de créer les astres et de réserver leurs copies.
    const assignedBotLaws = opts.botLaws;
    if (assignedBotLaws !== undefined) {
      if (!Array.isArray(assignedBotLaws)) throw new TypeError('botLaws doit être une liste de lois.');
      if (assignedBotLaws.length !== size - 1 - seats.length) throw new RangeError('botLaws doit contenir une loi par bot.');
      for (const id of assignedBotLaws) {
        if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(LAW, id)) throw new RangeError('Loi de bot inconnue.');
        if (LAW[id].fam !== 'neutre' && !families.includes(LAW[id].fam)) throw new RangeError('La famille de cette loi de bot est inactive.');
      }
    }
    const state = {
      v: 1, seed, size, round: 1, phase: 'shop', rc: 0, uidc: 1,
      families, pool: {}, poolTotal: {},
      // Événement cosmique : opts.event = 'auto' (tiré de la graine), un identifiant, ou rien.
      event: opts.event === 'auto' ? eventFor(seed) : EVENT[opts.event] ? opts.event : null,
      players: [], history: [], ghost: null, over: false, rank: null, reward: 0
    };
    for (const c of CARDS) {
      if (c.token) continue;
      if (c.legend) state.pool[c.id] = 1;
      else if (c.fam === 'neutre' || families.includes(c.fam)) state.pool[c.id] = COPIES[c.tier];
    }
    state.poolTotal = Object.assign({}, state.pool);
    const you = newPlayer(state, 'you', 'VOUS', law.id, false);
    if (law.fam === 'neutre') you.pref = families[0];
    state.players.push(you);
    const botLaws = LAWS.filter((l) => families.includes(l.fam));
    // En ligne, les noms des bots ne dépendent que de la graine (pas de la loi choisie) : les mêmes
    // sur tous les téléphones.
    const names = shuffle(BOT_NAMES.slice(), opts.mp ? mulberry(hashStr(seed + '|names')) : rng);
    // Sièges des autres joueurs humains (multijoueur) : ni boutique ni décisions locales, leur
    // plateau arrive du réseau à chaque manche.
    for (const seat of seats) {
      // Loi par défaut identique sur tous les téléphones ; la vraie arrive avec son premier plateau.
      const h = newPlayer(state, seat.id, seat.name, LAW[seat.law] ? seat.law : MP_SEAT_LAW, false);
      h.remote = true;
      state.players.push(h);
    }
    for (let i = state.players.length - 1, botIndex = 0; i < size - 1; i++, botIndex++) {
      // Les bots préfèrent les familles fortes en solo (FAM_POWER), sans s'y limiter.
      let bl = LAWS[0];
      if (assignedBotLaws) bl = LAW[assignedBotLaws[botIndex]];
      else if (botLaws.length) {
        const ws = botLaws.map((l) => Math.pow(FAM_POWER[l.fam] || 0.5, BOT.famWeight));
        let x = rng() * ws.reduce((a, b) => a + b, 0);
        bl = botLaws[botLaws.length - 1];
        for (let k = 0; k < botLaws.length; k++) { if (x < ws[k]) { bl = botLaws[k]; break; } x -= ws[k]; }
      }
      const b = newPlayer(state, 'bot' + i, names[i], bl.id, true);
      b.greed = Math.floor(rng() * 4) - 1;
      b.skill = 1;
      if (rng() < BOT.randPref) b.pref = families[Math.floor(rng() * families.length)];
      // Un bot sur dix vise une Alliance de deux familles.
      const pairUp = rng() < BOT.pref2;
      const others = families.filter((f) => f !== b.pref);
      // Une famille faible seule s'allie à la plus forte de la partie.
      if ((FAM_POWER[b.pref] || 0.5) < BOT.weak) b.pref2 = others.slice().sort((x, y) => (FAM_POWER[y] || 0) - (FAM_POWER[x] || 0))[0];
      else if (pairUp) b.pref2 = others[Math.floor(rng() * others.length)];
      state.players.push(b);
    }
    for (const p of state.players) if (!p.remote) rollShop(state, p);
    if (opts.mp) state.mp = Object.assign({}, opts.mp);
    if (opts.daily) state.daily = String(opts.daily);
    state.met = {};
    ensurePlan(state);
    return state;
  }

  function alivePlayers(state) { return state.players.filter((p) => p.alive); }

  // ─── Appariements façon Battlegrounds ───────────────────────
  // Pas un tirage au hasard : à chaque cycle, les paires sont choisies pour que chacun affronte
  // d'abord ceux qu'il n'a pas croisés depuis le plus longtemps (jamais deux fois de suite tant que
  // c'est possible), puis ceux qu'il a le moins affrontés. S'il reste un univers seul, il affronte
  // le fantôme du dernier éliminé, à tour de rôle. Les paires du cycle sont fixées dès la boutique
  // (state.plan) : chacun connaît son prochain adversaire. Elles ne dépendent que de la graine, du
  // cycle, des univers en vie et des rencontres passées (state.met) : en ligne, tous les téléphones
  // trouvent les mêmes. Clés : identifiants des joueurs (identifiants globaux en ligne).
  const metKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  function pairCost(state, a, b) {
    const m = state.met && state.met[metKey(a, b)];
    // Départage stable entre paires équivalentes (moins d'une rencontre d'écart).
    const tie = hashStr(state.seed + '|pair|' + state.round + '|' + metKey(a, b)) / 4294967296;
    return m ? 1000 / Math.max(1, state.round - m.r) + 10 * m.n + tie : tie;
  }
  // La meilleure répartition en paires (au plus 8 univers : 105 possibilités, toutes essayées).
  function planPairs(state, ids) {
    const list = ids.slice().sort();
    if (list.length % 2) list.push(state.ghost ? 'ghost' : '~seul');
    let best = [], bestCost = Infinity;
    (function rec(rest, acc, cost) {
      if (cost >= bestCost) return;
      if (!rest.length) { best = acc.slice(); bestCost = cost; return; }
      for (let i = 1; i < rest.length; i++) {
        acc.push([rest[0], rest[i]]);
        rec(rest.slice(1, i).concat(rest.slice(i + 1)), acc, cost + (rest[i] === '~seul' ? 0 : pairCost(state, rest[0], rest[i])));
        acc.pop();
      }
    })(list, [], 0);
    // Le fantôme toujours en second ; un univers sans adversaire (sans fantôme) ne combat pas.
    return best.filter((pr) => pr[1] !== '~seul').map((pr) => (pr[0] === 'ghost' ? [pr[1], pr[0]] : pr));
  }
  const idsOf = (state) => alivePlayers(state).map((p) => gidOf(state, p));
  // Les paires du cycle en cours, calculées une fois (ou de nouveau si les univers en vie ont changé).
  function ensurePlan(state) {
    const ids = idsOf(state).sort();
    const planned = state.plan && state.plan.r === state.round
      ? state.plan.pairs.reduce((l, pr) => l.concat(pr), []).filter((x) => x !== 'ghost').sort() : null;
    if (!planned || planned.join('|') !== ids.join('|')) state.plan = { r: state.round, pairs: planPairs(state, ids) };
    return state.plan.pairs;
  }
  function recordMet(state, pairs) {
    state.met = state.met || {};
    for (const [a, b] of pairs) {
      const k = metKey(a, b), m = state.met[k];
      state.met[k] = { r: state.round, n: (m ? m.n : 0) + 1 };
    }
  }
  // Le prochain adversaire du joueur (un univers, le fantôme, ou personne).
  function nextOpponent(state) {
    const me = you(state);
    if (!me || !me.alive || state.over) return null;
    const mine = gidOf(state, me);
    const pr = ensurePlan(state).find((x) => x[0] === mine || x[1] === mine);
    if (!pr) return null;
    const o = pr[0] === mine ? pr[1] : pr[0];
    return o === 'ghost' ? state.ghost : state.players.find((x) => gidOf(state, x) === o) || null;
  }
  const isDuel = (state) => state.size === DUEL.players || state.players.length === DUEL.players;
  const rewardsOf = (state) => (isDuel(state) ? DUEL.rewards : REWARDS);

  // ─── Actions de création ─────────────────────────────────────
  function ownedCopies(p, id) {
    return p.board.concat(p.hand).filter((u) => u.id === id && !u.golden);
  }

  function checkTriple(state, p, id) {
    const copies = ownedCopies(p, id);
    if (copies.length < 3 || CARD[id].token) return null;
    const used = p.hand.filter((u) => u.id === id && !u.golden).concat(p.board.filter((u) => u.id === id && !u.golden)).slice(0, 3);
    const c = CARD[id];
    const gold = makeUnit(state, id, true);
    for (const u of used) {
      gold.atk += u.atk - c.atk;
      gold.hp += u.hp - c.hp;
      for (const k of u.kw) if (!gold.kw.includes(k)) gold.kw.push(k);
      gold.att = gold.att.concat(u.att || []);
    }
    const ids = new Set(used.map((u) => u.uid));
    p.board = p.board.filter((u) => !ids.has(u.uid));
    p.hand = p.hand.filter((u) => !ids.has(u.uid));
    gold.dtier = Math.min(6, p.tier + 1);
    p.hand.push(gold);
    return { uid: gold.uid, merged: [...ids] };
  }

  function canBuy(state, slot, p) {
    p = p || you(state);
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    const id = p.shop[slot];
    if (!id) return fail('Cet emplacement est vide.');
    if (p.gold < BUY_COST) return fail('Il faut 3 énergies.');
    const owned = ownedCopies(p, id);
    let handAfter = p.hand.length + 1;
    if (owned.length >= 2) handAfter = p.hand.length + 1 - Math.min(3, p.hand.filter((u) => u.id === id && !u.golden).length + 1) + 1;
    if (handAfter > HAND_MAX) return fail('Votre main est pleine.');
    return { ok: true };
  }

  function buy(state, slot, p) {
    p = p || you(state);
    const check = canBuy(state, slot, p);
    if (!check.ok) return check;
    const id = p.shop[slot];
    p.gold -= BUY_COST;
    p.shop[slot] = null;
    const u = makeUnit(state, id);
    if (state.event === 'meteores' && CARD[id].tier === 1) { u.atk++; u.hp++; }
    p.hand.push(u);
    const x = shopCtx(state, p);
    for (const v of p.board.slice()) hook(v, 'buy', x, u);
    const triple = checkTriple(state, p, id);
    return { ok: true, uid: u.uid, triple: triple ? triple.uid : null, merged: triple ? triple.merged : null, events: x.events };
  }

  function canMagnet(u, target) {
    return !!target && u.kw.includes('arrimage') && famOf(target) === 'machine' && target !== u;
  }

  // index : la place dans la rangée ; row : 0 (avant) ou 1 (arrière). Sans rangée, l'astre va à
  // l'avant s'il y a de la place, sinon à l'arrière.
  function play(state, uid, index, targetUid, p, row) {
    p = p || you(state);
    arrange(p);
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    const hi = p.hand.findIndex((u) => u.uid === uid);
    if (hi < 0) return fail('Cet astre n’est plus dans votre main.');
    const u = p.hand[hi];
    const x = shopCtx(state, p);
    const target = targetUid ? p.board.find((v) => v.uid === targetUid) : null;
    if (target && canMagnet(u, target)) {
      p.hand.splice(hi, 1);
      target.atk += u.atk;
      target.hp += u.hp;
      for (const k of u.kw) if (k !== 'arrimage' && !target.kw.includes(k)) target.kw.push(k);
      target.att = (target.att || []).concat([{ id: u.id, golden: u.golden }], u.att || []);
      x.events.push({ t: 'magnet', uid: target.uid, from: u.uid });
      let discover = false;
      if (u.dtier) { openDiscover(state, p, u.dtier); discover = p.discover.length > 0; }
      return { ok: true, magnet: target.uid, events: x.events, discover };
    }
    if (p.board.length >= BOARD_MAX) return fail('Votre système est plein : vendez un astre.');
    const count = (r) => p.board.filter((v) => rowOf(v) === r).length;
    let r = row === 0 || row === 1 ? row : count(0) < ROW_MAX ? 0 : 1;
    if (count(r) >= ROW_MAX) {
      if (row === 0 || row === 1) return fail(r ? 'L’arrière est complet.' : 'L’avant est complet.');
      r = 1 - r;
    }
    p.hand.splice(hi, 1);
    const n = count(r);
    const at = Math.max(0, Math.min(n, index == null ? n : index));
    u.row = r;
    p.board.splice((r ? count(0) : 0) + at, 0, u);
    hook(u, 'play', x, at);
    for (const v of p.board.slice()) if (v !== u) hook(v, 'allyPlay', x, u);
    if (p.law === 'resonance' && famOf(u) === 'cristal') {
      if (p.awake) x.buff(x.rnd(x.fam('cristal', u)), 1, 1);
      else x.buff(x.rnd(x.fam('cristal', u)), 0, 1);
    }
    let discover = false;
    if (u.dtier) {
      const t = u.dtier;
      delete u.dtier;
      openDiscover(state, p, t);
      discover = p.discover.length > 0;
    }
    return { ok: true, index: at, row: r, events: x.events, discover };
  }

  function sell(state, uid, p) {
    p = p || you(state);
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    const i = p.board.findIndex((u) => u.uid === uid);
    if (i < 0) return fail('Seuls les astres du système se vendent.');
    const [u] = p.board.splice(i, 1);
    const x = shopCtx(state, p);
    hook(u, 'sold', x);
    releaseUnit(state, u);
    const gain = sellGain(state, p, u);
    // L'énergie en plus d'un doré s'affiche en doré (p.goldE) tant qu'elle n'est pas dépensée :
    // on ne garde d'abord que celle qui reste, puis on ajoute la nouvelle.
    if (u.golden) p.goldE = Math.min(p.goldE || 0, p.gold) + 1;
    p.gold = Math.min(99, p.gold + gain);
    return { ok: true, events: x.events, gain, golden: !!u.golden };
  }

  function roll(state, p) {
    p = p || you(state);
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    const cost = rollCost(p);
    if (p.gold < cost) return fail('Il faut 1 énergie.');
    p.gold -= cost;
    if (p.law === 'passage' && cost === 0) p.freeRolls = freeRollsUsed(p) + 1;
    p.frozen = false;
    rollShop(state, p);
    p.rolls = (p.rolls || 0) + 1;
    const x = shopCtx(state, p);
    for (const v of p.board.slice()) hook(v, 'roll', x);
    return { ok: true, events: x.events };
  }
  // Les anciennes sauvegardes n'ont que freeRoll (vrai : la gratuite est déjà prise).
  const freeRollsUsed = (p) => (p.freeRolls != null ? p.freeRolls : p.freeRoll ? 1 : 0);
  const rollCost = (p) => (p.law === 'passage' && freeRollsUsed(p) < (p.awake ? 2 : 1) ? 0 : ROLL_COST);

  function freeze(state, p) {
    p = p || you(state);
    if (state.phase !== 'shop') return fail('Le marché est fermé.');
    p.frozen = !p.frozen;
    return { ok: true, frozen: p.frozen };
  }

  function upgrade(state, p) {
    p = p || you(state);
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.tier >= 6) return fail('Niveau maximal atteint.');
    const cost = upgradeCost(p, state);
    if (p.gold < cost) return fail(tr('Il faut {n} énergies.', { n: cost }));
    p.gold -= cost;
    p.tier++;
    p.discount = 0;
    return { ok: true, tier: p.tier };
  }

  // Déplace un astre du système vers une rangée (index : sa place dans la rangée). Si la rangée
  // visée est pleine, l'astre qui occupait cette place prend celle qu'il laisse.
  function move(state, uid, row, index, p) {
    p = p || you(state);
    if (state.phase !== 'shop') return fail('Le marché est fermé.');
    arrange(p);
    const u = p.board.find((v) => v.uid === uid);
    if (!u) return fail('Astre introuvable.');
    row = row === 1 ? 1 : 0;
    const from = rowOf(u);
    const old = p.board.filter((v) => rowOf(v) === from).indexOf(u);
    const rows = [0, 1].map((r) => p.board.filter((v) => v !== u && rowOf(v) === r));
    const dest = rows[row];
    let at = Math.max(0, Math.min(dest.length, index == null ? dest.length : index));
    let swapped = null;
    if (from !== row && dest.length >= ROW_MAX) {
      at = Math.min(at, dest.length - 1);
      swapped = dest.splice(at, 1)[0];
      rows[from].splice(old, 0, swapped);
    }
    dest.splice(at, 0, u);
    rows[0].forEach((v) => { v.row = 0; });
    rows[1].forEach((v) => { v.row = 1; });
    p.board = rows[0].concat(rows[1]);
    return { ok: true, swapped: swapped ? swapped.uid : null };
  }
  // Change la place d'un astre dans sa rangée.
  function reorder(state, uid, index, p) {
    p = p || you(state);
    const u = p.board.find((v) => v.uid === uid);
    if (!u) return fail('Astre introuvable.');
    return move(state, uid, rowOf(u), index, p);
  }

  function canUsePower(state, p) {
    p = p || you(state);
    const law = LAW[p.law];
    if (!law.active) return fail('Cette loi agit seule.');
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.powerUsed) return fail('Déjà utilisé ce cycle.');
    if (p.gold < powerCost(p)) return fail(tr('Il faut {n} énergie.', { n: powerCost(p) }));
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    return { ok: true };
  }

  function usePower(state, targetUid, p) {
    p = p || you(state);
    const check = canUsePower(state, p);
    if (!check.ok) return check;
    const x = shopCtx(state, p);
    if (p.law === 'renversement') {
      const t = p.board.find((u) => u.uid === targetUid);
      if (!t) return fail('Choisissez un astre de votre système.');
      if (t.atk <= 0) return fail('Cet astre n’a pas d’Attaque à inverser.');
      x.swap(t);
      x.buff(t, p.awake ? 2 : 1, p.awake ? 2 : 1);
    } else if (p.law === 'ingenierie') {
      if (p.hand.length >= HAND_MAX) return fail('Votre main est pleine.');
      const u = makeUnit(state, 'sonde-t');
      p.hand.push(u);
      x.events.push({ t: 'gain', uid: u.uid });
    }
    p.gold -= powerCost(p);
    p.powerUsed = true;
    return { ok: true, events: x.events };
  }

  function openDiscover(state, p, tier) {
    const rng = rngFor(state, 'discover:' + p.id);
    p.discover = [];
    // Parfois, une légendaire se glisse parmi les choix.
    const n = state.event === 'revelation' ? 4 : 3;
    if (rng() < LEGEND_DISCOVER * (state.event === 'legendes' ? 3 : 1)) { const l = drawLegend(state, tier, rng); if (l) p.discover.push(l); }
    for (let t = tier; t >= 1 && p.discover.length < n; t--) {
      while (p.discover.length < n) {
        const avail = Object.keys(state.pool).filter((id) => CARD[id].tier === t && !CARD[id].legend && state.pool[id] > 0 && !p.discover.includes(id));
        if (!avail.length) break;
        const total = avail.reduce((s, id) => s + state.pool[id], 0);
        let r = rng() * total, pick = avail[avail.length - 1];
        for (const id of avail) { r -= state.pool[id]; if (r < 0) { pick = id; break; } }
        state.pool[pick]--;
        p.discover.push(pick);
      }
    }
  }

  function choose(state, index, p) {
    p = p || you(state);
    if (!p.discover.length || index < 0 || index >= p.discover.length) return fail('Aucune découverte en cours.');
    const chosen = p.discover[index];
    p.discover.forEach((id, i) => { if (i !== index) state.pool[id]++; });
    p.discover = [];
    const u = makeUnit(state, chosen);
    let where = 'hand';
    if (p.hand.length < HAND_MAX) p.hand.push(u);
    else if (p.board.length < BOARD_MAX) {
      arrange(p);
      u.row = p.board.filter((v) => rowOf(v) === 0).length < ROW_MAX ? 0 : 1;
      p.board.push(u);
      arrange(p);
      where = 'board';
    }
    else { state.pool[chosen]++; return { ok: true, lost: true }; }
    const triple = checkTriple(state, p, chosen);
    return { ok: true, uid: u.uid, where, triple: triple ? triple.uid : null, merged: triple ? triple.merged : null };
  }

  // ─── Début et fin de cycle ──────────────────────────────────
  function startTurn(state, p) {
    p.gold = Math.min(MAX_GOLD, state.round + 2 + (p.law === 'sacrifice' ? 1 : 0));
    p.goldE = 0;
    p.discount += 1;
    p.powerUsed = false;
    p.rolls = 0;
    p.freeRoll = false;
    p.freeRolls = 0;
    const x = shopCtx(state, p);
    if (state.round === AWAKE_ROUND && !p.awake) { p.awake = true; x.events.push({ t: 'awake', law: p.law }); }
    // L'éveil de Sacrifice compte dès ce cycle.
    p.gold += bonusGold(state, p);
    if (RELIC_ROUNDS.includes(state.round)) offerRelics(state, p);
    for (const u of p.board.slice()) hook(u, 'startTurn', x);
    if (p.frozen) { p.frozen = false; refillShop(state, p); }
    else rollShop(state, p);
    return x.events;
  }

  function endTurnEffects(state, p) {
    const x = shopCtx(state, p);
    for (const u of p.board.slice()) hook(u, 'endTurn', x);
    const weakest = () => p.board.slice().sort((a, b) => a.atk + a.hp - (b.atk + b.hp));
    if (p.law === 'symbiose' && p.board.length) {
      x.events.push({ t: 'law' });
      if (p.awake) for (const u of weakest().slice(0, 2)) x.buff(u, 1, 1);
      else x.buff(weakest()[0], 0, 1);
    }
    if (p.law === 'marees') {
      const moons = p.board.filter((u) => famOf(u) === 'lune');
      if (moons.length) x.events.push({ t: 'law' });
      for (const l of moons) {
        if (p.awake) for (const v of x.neighbors(l)) x.buff(v, 0, 1);
        else x.buff(x.right(l), 0, 1);
      }
    }
    if (p.law === 'gravite') {
      const walls = p.board.filter((u) => u.kw.includes('rempart'));
      if (walls.length) x.events.push({ t: 'law' });
      for (const u of walls) x.buff(u, p.awake ? 1 : 0, p.awake ? 2 : 1);
    }
    if (hasRelic(p, 'banniere')) {
      const top = FAMILY_KEYS.map((fam) => [fam, x.fam(fam).length]).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1]) { x.events.push({ t: 'relic', id: 'banniere' }); x.buff(x.rnd(x.fam(top[0])), 1, 1); }
    }
    if (state.event === 'maree' && p.board.length) { x.events.push({ t: 'event' }); x.buff(weakest()[0], 1, 1); }
    return x.events;
  }

  // ─── Reliques : le choix ────────────────────────────────────
  function offerRelics(state, p) {
    const rng = rngFor(state, 'relic:' + p.id);
    p.relics = p.relics || [];
    p.relicChoice = shuffle(RELICS.filter((r) => !p.relics.includes(r.id)), rng).slice(0, 3).map((r) => r.id);
    // Les bots choisissent aussitôt.
    if (p.bot && p.relicChoice.length) chooseRelic(state, botRelic(p), p);
  }
  function chooseRelic(state, index, p) {
    p = p || you(state);
    const list = p.relicChoice || [];
    if (index < 0 || index >= list.length) return fail('Aucune relique à choisir.');
    const id = list[index];
    p.relics = (p.relics || []).concat([id]);
    p.relicChoice = [];
    return { ok: true, id };
  }
  // Préférences du bot tirées de 1 200 mêlées où les reliques étaient tirées au hasard (v85) :
  // Dard, Comptoir, Égide et Réserve (au cycle 4) gagnent le plus de places ; Lance, Élan et
  // Longue-vue le moins. Bastion ne vaut que si le système a déjà des Remparts.
  function botRelic(p) {
    const golden = p.board.some((u) => u.golden), walls = p.board.some((u) => u.kw.includes('rempart'));
    const late = (p.relics || []).length > 0;
    const score = (id) => ({ dard: 5, comptoir: 4.5, reserve: late ? 3 : 4.5, egide: 4, banniere: 3, braise: 3, tresor: late ? 2.5 : 3, alchimie: golden ? 4 : 2, bastion: walls ? 4.5 : late ? 2.5 : 1, lance: 2, elan: p.tier < 5 ? 2 : 0, longuevue: 1.5 }[id] || 1);
    let best = 0;
    p.relicChoice.forEach((id, i) => { if (score(id) > score(p.relicChoice[best])) best = i; });
    return best;
  }

  // ─── Combat ─────────────────────────────────────────────────
  // a, b : { id, name, tier, law, board } (joueurs ou fantôme). Les bonus
  // « définitifs » s'appliquent aux astres de a.board / b.board.
  // Placement : seul l'avant attaque, et toujours l'ennemi de l'avant le plus en face de lui
  // (les Remparts d'abord). L'arrière est à l'abri des attaques ; il avance quand l'avant est tombé.
  function fight(state, a, b, tag, keepLog) {
    const rng = rngFor(state, 'fight:' + tag);
    const players = [a, b];
    let cidc = 1;
    const ev = [];
    const log = (e) => { if (keepLog) ev.push(e); };
    const toCombat = (u, side, row) => ({
      cid: 'c' + cidc++, ref: u.uid, id: u.id, golden: !!u.golden, m: u.golden ? 2 : 1,
      atk: u.atk, hp: u.hp, maxHp: u.hp, kw: u.kw.slice(), side, row,
      dead: false, attacked: false, rebornUsed: false, killer: null, form: null
    });
    const sides = players.map((pl, s) => {
      const [front, back] = layout(pl.board);
      return front.map((u) => toCombat(u, s, 0)).concat(back.map((u) => toCombat(u, s, 1)));
    });
    const alive = (s) => sides[s].filter((u) => !u.dead && u.hp > 0);
    const inRow = (s, r) => alive(s).filter((u) => u.row === r);
    const snap = (u) => ({ cid: u.cid, id: u.id, golden: u.golden, atk: u.atk, hp: u.hp, maxHp: u.maxHp, kw: u.kw.slice(), row: u.row });
    const snapAll = () => [sides[0].filter((u) => !u.dead).map(snap), sides[1].filter((u) => !u.dead).map(snap)];
    const pendingBreak = [], pendingHurt = [];
    const countOf = (s, id) => alive(s).filter((u) => u.id === id).reduce((n, u) => n + u.m, 0);
    const forms = [[], []];
    let curRow = null;

    // Position d'un astre, en largeurs d'astre depuis le centre : les rangées sont centrées à
    // l'écran, « en face » veut donc dire ce qu'on voit.
    const xOf = (u) => { const l = inRow(u.side, u.row); const i = l.indexOf(u); return i < 0 ? 0 : i - (l.length - 1) / 2; };
    // L'astre de la liste le plus en face de u (à égalité : le moins de PV, puis le plus à gauche).
    function facing(u, list) {
      let best = null, bd = 9;
      const x = xOf(u);
      for (const v of list) {
        const d = Math.abs(xOf(v) - x);
        if (!best || d < bd - 1e-9 || (Math.abs(d - bd) < 1e-9 && v.hp < best.hp)) { best = v; bd = d; }
      }
      return best;
    }
    // L'astre le plus faible d'un camp (Attaque + PV).
    const weakestOf = (s) => alive(s).slice().sort((x, y) => x.atk + x.hp - (y.atk + y.hp))[0] || null;
    // L'astre de l'avant juste devant u (même camp).
    const ahead = (u) => facing(u, inRow(u.side, 0).filter((v) => v !== u));

    const c = {
      rnd: (list) => (list && list.length ? list[Math.floor(rng() * list.length)] : null),
      allies: (s) => alive(s),
      sideList: (s) => sides[s].filter((u) => !u.dead),
      alliesFam: (s, f) => alive(s).filter((u) => famOf(u) === f),
      front: (s) => inRow(s, 0),
      back: (s) => inRow(s, 1),
      ranked: (s) => alive(s).slice().sort((x, y) => y.atk - x.atk || y.hp - x.hp),
      neighbors(u) {
        const l = sides[u.side].filter((v) => !v.dead && v.row === u.row);
        const i = l.indexOf(u);
        return [l[i - 1], l[i + 1]].filter((v) => v && v.hp > 0);
      },
      pickAllies: (s, n) => shuffle(alive(s).slice(), rng).slice(0, n),
      randomKw(u) {
        if (!u) return;
        const k = RANDOM_KW.filter((kk) => !u.kw.includes(kk));
        if (k.length) c.kw(u, k[Math.floor(rng() * k.length)]);
      },
      // Un astre aléatoire du niveau donné, parmi les familles de la partie (hors réserve).
      summonRandom(s, tier, index) {
        const ids = CARDS.filter((cd) => !cd.token && !cd.legend && cd.tier === tier && (cd.fam === 'neutre' || state.families.includes(cd.fam))).map((cd) => cd.id);
        if (!ids.length) return null;
        return c.summon(s, ids[Math.floor(rng() * ids.length)], index, 1);
      },
      buff(u, da, dh, perm) {
        if (!u || u.dead || (!da && !dh)) return;
        u.atk = Math.max(0, u.atk + da);
        u.hp += dh;
        u.maxHp += dh;
        log({ t: 'buff', cid: u.cid, a: da, h: dh });
        if (perm) {
          const ref = players[u.side].board.find((v) => v.uid === u.ref);
          if (ref) { ref.atk = Math.max(0, ref.atk + da); ref.hp += dh; }
        }
      },
      heal(u, n) {
        if (!u || u.dead || u.hp <= 0) return;
        const k = Math.min(n, u.maxHp - u.hp);
        if (k <= 0) return;
        u.hp += k;
        log({ t: 'heal', cid: u.cid, n: k, hp: u.hp });
      },
      permFam(s, f, da, dh) {
        for (const v of players[s].board) if (famOf(v) === f) { v.atk = Math.max(0, v.atk + da); v.hp += dh; }
        for (const u of alive(s)) if (famOf(u) === f) c.buff(u, da, dh);
      },
      dmg(src, t, n) {
        if (!t || n <= 0) return;
        hit(t, n + countOf(src.side, 'tison'), src, 'effect');
      },
      kw(u, k) {
        if (!u || u.dead || u.kw.includes(k)) return;
        u.kw.push(k);
        log({ t: 'kw', cid: u.cid, k });
      },
      swap(u) {
        if (!u || u.dead) return;
        const at = u.atk;
        u.atk = Math.max(0, u.hp);
        u.hp = at;
        u.maxHp = Math.max(1, at);
        log({ t: 'swap', cid: u.cid, atk: u.atk, hp: u.hp });
      },
      // Un astre invoqué naît dans la rangée de celui qui s'effondre (sinon à l'avant).
      summon(s, id, index, mult, o) {
        o = o || {};
        if (sides[s].filter((u) => !u.dead).length >= BOARD_MAX) return null;
        const card = CARD[id];
        const k = (o.golden ? 2 : 1) * (mult || 1);
        const row = o.row != null ? o.row : curRow != null ? curRow : 0;
        const u = {
          cid: 'c' + cidc++, ref: o.ref || null, id, golden: !!o.golden, m: o.golden ? 2 : 1,
          atk: card.atk * k, hp: o.reborn ? 1 : card.hp * k, maxHp: o.reborn ? 1 : card.hp * k,
          kw: (card.kw || []).filter((kk) => !(o.reborn && kk === 'renaissance')), side: s, row,
          dead: false, attacked: false, rebornUsed: !!o.reborn, killer: null, form: null
        };
        const list = sides[s];
        let pos = 0, seen = 0;
        while (pos < list.length && seen < index) { if (!list[pos].dead) seen++; pos++; }
        list.splice(pos, 0, u);
        list.sort((x, y) => x.row - y.row);
        log({ t: 'summon', side: s, index: list.filter((v) => !v.dead).indexOf(u), row, unit: snap(u), reborn: !!o.reborn });
        return u;
      }
    };

    function fire(u, name, ...args) {
      const card = cardOf(u);
      if (typeof card[name] !== 'function') return;
      log({ t: 'fx', cid: u.cid });
      card[name](c, u, u.m, ...args);
    }

    function hit(t, n, src, kind) {
      if (!t || t.dead || t.hp <= 0 || n <= 0) return 0;
      if (t.kw.includes('bouclier')) {
        t.kw.splice(t.kw.indexOf('bouclier'), 1);
        log({ t: 'break', cid: t.cid, src: src ? src.cid : null, kind });
        pendingBreak.push(t);
        return 0;
      }
      t.hp -= n;
      log({ t: 'hit', cid: t.cid, src: src ? src.cid : null, n, kind, hp: t.hp });
      if (src && kind === 'attack' && src.kw.includes('venin') && t.hp > 0) {
        t.hp = 0;
        log({ t: 'venom', cid: t.cid });
      }
      if (t.hp <= 0) t.killer = src || null;
      else pendingHurt.push(t);
      return n;
    }

    function flush() {
      for (let guard = 0; guard < 50 && (pendingBreak.length || pendingHurt.length); guard++) {
        const breaks = pendingBreak.splice(0), hurts = pendingHurt.splice(0);
        for (const t of breaks) for (const v of alive(t.side)) fire(v, 'shieldBreak', t);
        for (const t of hurts) if (!t.dead && t.hp > 0) fire(t, 'damaged');
      }
    }

    // Formations du Néant : un membre qui tombe renforce les autres (avant) ; un astre de l'avant
    // qui tombe renforce ceux restés à l'arrière.
    function formDeath(s, u) {
      for (const f of forms[s]) {
        if (f.fam !== 'neant') continue;
        const live = f.units.filter((v) => v !== u && !v.dead && v.hp > 0);
        if (f.row === 0 && u.form === f) for (const v of live) c.buff(v, f.lvl, f.lvl);
        if (f.row === 1 && u.row === 0) for (const v of live) if (v.row === 1) c.buff(v, f.lvl, f.lvl);
      }
    }

    // L'avant est tombé : l'arrière avance (et devient la cible des attaques).
    function advance() {
      for (let s = 0; s < 2; s++) {
        if (inRow(s, 0).length || !inRow(s, 1).length) continue;
        const moved = inRow(s, 1);
        for (const u of moved) { u.row = 0; u.attacked = false; }
        log({ t: 'advance', side: s, cids: moved.map((u) => u.cid) });
        if (hasRelic(players[s], 'reserve')) { log({ t: 'relic', side: s, id: 'reserve' }); for (const u of moved) c.buff(u, 2, 2); }
        for (const f of forms[s]) {
          if (f.fam !== 'comete' || f.row !== 1) continue;
          for (const u of f.units) if (!u.dead && u.hp > 0) c.buff(u, 2 * f.lvl, f.lvl);
        }
      }
    }

    function resolveDeaths() {
      for (let loop = 0; loop < 60; loop++) {
        let found = false;
        for (let s = 0; s < 2; s++) {
          const list = sides[s];
          for (let i = 0; i < list.length; i++) {
            const u = list[i];
            if (u.dead || u.hp > 0) continue;
            found = true;
            const idx = list.slice(0, i).filter((v) => !v.dead).length;
            u.dead = true;
            list.splice(i, 1);
            i--;
            log({ t: 'die', cid: u.cid, side: s });
            const card = cardOf(u);
            curRow = u.row;
            if (typeof card.death === 'function') {
              const times = 1 + countOf(s, 'linceul');
              for (let k = 0; k < times; k++) { log({ t: 'fx', cid: u.cid }); card.death(c, u, u.m, idx); }
            }
            for (const v of alive(s)) fire(v, 'allyDeath', u);
            if (players[s].law === 'entropie') for (const v of alive(s)) if (famOf(v) === 'neant') c.buff(v, 1, players[s].awake ? 1 : 0);
            formDeath(s, u);
            // Trou noir : il grossit à chaque astre qui s'effondre, d'un camp comme de l'autre.
            for (let w = 0; w < 2; w++) for (const v of alive(w)) if (v.blackhole) c.buff(v, 1, 1);
            // Supernova : l'astre explose en s'effondrant.
            if (u.supernova) {
              log({ t: 'phenom', side: s, kind: 'explode', cid: u.cid });
              for (const t of inRow(1 - s, 0)) hit(t, 4, null, 'effect');
            }
            const k = u.killer;
            if (k && !k.dead && k.hp > 0) for (const v of alive(k.side)) fire(v, 'allyKill', k, u);
            if (u.kw.includes('renaissance') && !u.rebornUsed) {
              const r = c.summon(s, u.id, idx, 1, { reborn: true, golden: u.golden, ref: u.ref, row: u.row });
              if (r) {
                fire(r, 'reborn');
                for (const v of alive(s)) if (v !== r) fire(v, 'allyReborn', r);
              }
            }
            curRow = null;
          }
        }
        flush();
        if (!found) break;
      }
      advance();
    }

    // Cible : l'ennemi de l'avant en face (Remparts d'abord). Percée : l'arrière ennemi, sauf si une
    // Garde tient l'avant. Portée depuis l'arrière : pas de riposte.
    function attackOnce(att) {
      const foe = 1 - att.side;
      const front = inRow(foe, 0), back = inRow(foe, 1);
      const pierce = att.kw.includes('percee') && back.length && !front.some((u) => u.kw.includes('garde'));
      const enemies = pierce ? back : front.length ? front : alive(foe);
      if (!enemies.length) return;
      const walls = enemies.filter((u) => u.kw.includes('rempart'));
      const t = facing(att, walls.length ? walls : enemies);
      const ranged = att.row === 1;
      log({ t: 'attack', cid: att.cid, target: t.cid, ranged, pierce: !!pierce });
      const da = att.atk, dt = t.atk;
      hit(t, da, att, 'attack');
      if (!ranged) hit(att, dt, t, 'attack');
      flush();
      fire(att, 'attack', t);
      for (const v of alive(att.side)) fire(v, 'allyAttack', att, t);
      if (players[att.side].law === 'vents' && !att.dead) c.buff(att, players[att.side].awake ? 2 : 1, 1);
      if (!att.dead && att.hp > 0) {
        const f = att.form;
        if (f && f.fam === 'tempete' && f.row === 0) c.buff(att, f.lvl, 0);
        const vie = forms[att.side].find((g) => g.fam === 'vie' && g.row === 1);
        if (vie && att.row === 0) c.heal(att, 2 * vie.lvl);
      }
      flush();
      resolveDeaths();
    }

    // L'avant attaque de gauche à droite (une formation de Comètes passe devant), puis les astres
    // de l'arrière qui ont Portée.
    function nextAttacker(s) {
      const able = inRow(s, 0).filter((u) => u.atk > 0);
      const shooters = inRow(s, 1).filter((u) => u.atk > 0 && u.kw.includes('portee'));
      if (!able.length && !shooters.length) return null;
      const quick = (u) => u.form && u.form.fam === 'comete' && u.form.row === 0;
      const order = able.filter(quick).concat(able.filter((u) => !quick(u)), shooters);
      let cand = order.find((u) => !u.attacked);
      if (!cand) {
        for (const u of alive(s)) u.attacked = false;
        cand = order[0];
      }
      return cand;
    }

    function applyPhenomenon(s, p) {
      const u = p.unit, v = p.partner;
      if (u.dead || u.hp <= 0) return;
      log({ t: 'phenom', side: s, kind: p.kind, cid: u.cid, partner: v.cid });
      switch (p.kind) {
        case 'accretion': if (famOf(u) === 'mineral') c.buff(u, 3, 7); else c.buff(u, 2, 5); break;
        case 'trounoir': u.blackhole = true; c.kw(u, 'rempart'); break;
        case 'supernova': u.supernova = true; break;
        case 'eclipse': { const t = facing(u, inRow(1 - s, 0)); if (t && t.atk > 0) c.buff(t, -Math.ceil(t.atk / 2), 0); break; }
        case 'habitable': c.buff(u, 2, 3); c.kw(u, 'renaissance'); break;
        case 'queue': c.kw(u, 'rafale'); c.buff(u, 2, 0); break;
        case 'halo': c.kw(u, 'bouclier'); c.kw(v, 'bouclier'); break;
        case 'jumeaux': c.kw(u, 'renaissance'); c.kw(v, 'renaissance'); break;
        case 'prisme': c.buff(u, 4, 4); c.kw(u, 'bouclier'); break;
        case 'cyclone': c.kw(u, u.kw.includes('rafale') ? 'megarafale' : 'rafale'); break;
        default: break;
      }
    }

    // Effets de formation au début du combat.
    function applyForm(s, f) {
      const L = f.lvl, d = 2 * L, e = 1 - s;
      const F = f.units.filter((u) => !u.dead && u.hp > 0);
      if (!F.length) return;
      switch (f.fam + ':' + f.row) {
        case 'vie:0': for (const u of F) c.buff(u, L, L); break;
        case 'envers:0': for (const u of F) c.buff(u, L, L); for (const u of F.slice(0, L)) c.kw(u, 'renaissance'); break;
        case 'envers:1': for (const u of inRow(e, 0).filter((v) => v.atk > v.hp).sort((x, y) => y.atk - x.atk).slice(0, L)) c.swap(u); break;
        case 'brasier:0': for (const u of F) c.dmg(u, facing(u, inRow(e, 0)), d); break;
        case 'brasier:1': { const t = inRow(e, 0).sort((x, y) => x.hp - y.hp)[0]; if (t) c.dmg(F[0], t, d); break; }
        case 'glace:0': for (const u of F) c.buff(u, L, L); for (const u of F.slice(0, L)) c.kw(u, 'bouclier'); break;
        case 'glace:1': for (const u of inRow(e, 0)) if (u.atk > 0) c.buff(u, -Math.min(d, u.atk), 0); break;
        case 'tempete:1': { const fr = inRow(s, 0); for (const u of fr) c.buff(u, L, d); if (fr[0]) c.kw(fr[0], 'rafale'); break; }
        case 'mineral:0': { for (const u of F) c.buff(u, L, d); c.kw(F.slice().sort((x, y) => y.hp - x.hp)[0], 'rempart'); break; }
        case 'mineral:1': for (const u of inRow(s, 0)) c.buff(u, L, d); break;
        case 'machine:0': for (const u of F) c.buff(u, d, 0); break;
        case 'machine:1': for (const u of F) { const t = ahead(u); if (!t) continue; for (const k of u.kw) if (k !== 'arrimage') c.kw(t, k); c.buff(t, L, L); } break;
        case 'lune:0': for (const u of F) for (const v of c.neighbors(u)) c.buff(v, L, L); break;
        case 'lune:1': for (const u of F) c.buff(ahead(u), d, d); break;
        case 'comete:0': for (const u of F) c.buff(u, L, 0); break;
        case 'tempete:0': for (const u of F) c.buff(u, L, d); break;
        case 'cristal:0': { const k = forms[s].some((g) => g.fam === 'cristal' && g.row === 1) ? 2 * L : L; for (const u of F) c.buff(u, k, k); break; }
        case 'cristal:1': for (const u of c.alliesFam(s, 'cristal')) c.buff(u, L, L); break;
        case 'anomalie:0': for (const u of F) for (let i = 0; i < L; i++) c.randomKw(u); break;
        case 'anomalie:1': for (const u of shuffle(inRow(s, 0), rng).slice(0, L)) c.randomKw(u); break;
        default: break; // vie:1, neant, tempete:0 et comete:1 agissent pendant le combat.
      }
    }

    log({ t: 'start', boards: snapAll() });
    // Un système rangé tout à l'arrière avance aussitôt.
    advance();
    let turn = sides[0].length > sides[1].length ? 0 : sides[1].length > sides[0].length ? 1 : rng() < 0.5 ? 0 : 1;
    log({ t: 'first', side: turn });
    for (const s of [turn, 1 - turn]) {
      const p = players[s], first = alive(s)[0];
      if (p.law === 'combustion') {
        log({ t: 'law', side: s, law: p.law });
        const ts = p.awake ? shuffle(alive(1 - s), rng).slice(0, 2) : [c.rnd(alive(1 - s))];
        for (const t of ts) if (t) hit(t, 3 + countOf(s, 'tison'), null, 'effect');
      }
      if (p.law === 'chaos') { log({ t: 'law', side: s, law: p.law }); for (const u of p.awake ? c.pickAllies(s, 2) : [c.rnd(alive(s))]) c.randomKw(u); }
      if (p.law === 'stase' && first) { log({ t: 'law', side: s, law: p.law }); for (const u of alive(s).slice(0, p.awake ? 3 : 2)) c.kw(u, 'bouclier'); }
      if (p.law === 'endurance' && p.awake && first) { log({ t: 'law', side: s, law: p.law }); for (const u of inRow(s, 0)) c.buff(u, 0, 2); }
      if (p.law === 'phenix' && p.awake && first) { log({ t: 'law', side: s, law: p.law }); c.kw(weakestOf(s), 'renaissance'); }
      // Reliques de début de combat.
      const relic = (id, fn) => { if (hasRelic(p, id) && first) { log({ t: 'relic', side: s, id }); fn(); } };
      relic('lance', () => { for (const u of inRow(s, 0)) c.buff(u, 1, 0); });
      relic('bastion', () => { for (const u of alive(s)) if (u.kw.includes('rempart')) c.buff(u, 0, 3); });
      relic('egide', () => c.kw(alive(s)[0], 'bouclier'));
      relic('dard', () => c.kw(c.ranked(s)[0], 'venin'));
      relic('braise', () => c.kw(weakestOf(s), 'renaissance'));
      relic('alchimie', () => { for (const u of alive(s)) if (u.golden) c.buff(u, 2, 2); });
    }
    // Événement cosmique de début de combat, pour les deux camps.
    const cosmic = state.event;
    if (cosmic === 'vent' || cosmic === 'aurore' || cosmic === 'instable') {
      log({ t: 'event', id: cosmic });
      for (const s of [turn, 1 - turn]) {
        if (cosmic === 'vent') for (const t of inRow(1 - s, 0)) hit(t, 1, null, 'effect');
        if (cosmic === 'aurore') c.kw(alive(s)[0], 'bouclier');
        if (cosmic === 'instable') for (const u of c.pickAllies(s, 2)) c.randomKw(u);
      }
    }
    // Phénomènes : repérés pour les deux camps, puis ils transforment leurs astres.
    const phen = [0, 1].map((s) => findPhenomena(inRow(s, 0), inRow(s, 1)));
    for (const s of [turn, 1 - turn]) for (const p of phen[s]) applyPhenomenon(s, p);
    flush();
    resolveDeaths();
    // Les formations sont comptées pour les deux camps avant d'agir.
    for (const s of [0, 1]) {
      forms[s] = groupForms(alive(s));
      for (const f of forms[s]) for (const u of f.units) u.form = f;
    }
    for (const s of [turn, 1 - turn]) {
      for (const f of forms[s]) {
        log({ t: 'formation', side: s, fam: f.fam, row: f.row, lvl: f.lvl, cids: f.units.map((u) => u.cid) });
        applyForm(s, f);
        flush();
      }
    }
    for (const s of [turn, 1 - turn]) for (const u of alive(s)) fire(u, 'start');
    flush();
    resolveDeaths();
    log({ t: 'sync', boards: snapAll() });

    let guard = 0, idle = 0;
    while (alive(0).length && alive(1).length && guard++ < 400) {
      const att = nextAttacker(turn);
      if (!att) {
        if (++idle >= 2) break;
        turn = 1 - turn;
        continue;
      }
      idle = 0;
      const n = att.kw.includes('megarafale') ? 4 : att.kw.includes('rafale') ? 2 : 1;
      for (let k = 0; k < n; k++) {
        if (att.dead || att.hp <= 0 || !alive(1 - att.side).length) break;
        attackOnce(att);
      }
      att.attacked = true;
      log({ t: 'sync', boards: snapAll() });
      turn = 1 - turn;
    }

    const l0 = alive(0), l1 = alive(1);
    const winner = l0.length && !l1.length ? 0 : l1.length && !l0.length ? 1 : -1;
    const surv = winner === 0 ? l0 : winner === 1 ? l1 : [];
    const damage = winner < 0 ? 0 : players[winner].tier + surv.reduce((s, u) => s + cardOf(u).tier, 0);
    log({ t: 'end', winner, damage });
    return { events: ev, winner, damage, survivors: surv.length };
  }

  // ─── Bots ───────────────────────────────────────────────────
  // Les bots des parties ont skill 1 (IA experte) ; skill 0 garde l'IA de base, utile pour
  // mesurer l'écart (orbite/tools/bots-duel.js).
  const expert = (p) => p.skill > 0;
  // Réglages de l'IA experte (choisis par simulation : orbite/tools/bots-mono.js).
  const BOT = { randPref: 0, pref2: 0.1, famBase: 6, famPer: 2, levelLag: 3, sim: 2, simOpp: 3, simCand: 4, famWeight: 6, weak: 0.5 };
  // Force d'une famille jouée seule (part de victoires d'un joueur « tout dans une famille »
  // contre les bots, orbite/tools/bots-mono.js), ramenée entre 0 et 1.
  const FAM_POWER = { vie: 1, cristal: 0.8, lune: 0.8, tempete: 0.75, glace: 0.7, mineral: 0.55, neant: 0.5, brasier: 0.3, machine: 0.3, comete: 0.25, envers: 0.25, anomalie: 0.2 };
  const famBonus = (p, fam) => {
    if (fam === p.pref) return BOT.famBase + (expert(p) ? BOT.famPer * famCount(p, fam) : 0);
    if (fam === p.pref2) return BOT.famBase + (expert(p) ? BOT.famPer * 0.5 * famCount(p, fam) : 0);
    return 0;
  };
  function famCount(p, fam) { return fam === 'neutre' ? 0 : p.board.concat(p.hand).filter((u) => famOf(u) === fam).length; }
  function cardValue(p, id) {
    const c = CARD[id];
    let v = c.atk + c.hp + c.tier * 3.2 + (c.kw ? c.kw.length * 1.5 : 0);
    v += famBonus(p, c.fam);
    if (c.sun && p.board.concat(p.hand).some((u) => famOf(u) === 'vie')) v += 4;
    v += ownedCopies(p, id).length * 7;
    return v;
  }

  function unitValue(p, u) {
    const c = cardOf(u);
    return u.atk + u.hp + c.tier * 3.2 + famBonus(p, c.fam) + (u.golden ? 8 : 0) + u.kw.length * 1.5;
  }

  function botDeploy(state, p) {
    for (let guard = 0; guard < 30; guard++) {
      if (p.discover.length) {
        const best = p.discover.map((id, i) => ({ i, v: cardValue(p, id) })).sort((a, b) => b.v - a.v)[0];
        choose(state, best.i, p);
        continue;
      }
      if (!p.hand.length) break;
      const u = p.hand.slice().sort((a, b) => unitValue(p, b) - unitValue(p, a))[0];
      if (u.kw.includes('arrimage')) {
        const host = p.board.filter((v) => famOf(v) === 'machine').sort((a, b) => unitValue(p, b) - unitValue(p, a))[0];
        if (host && (p.board.length >= BOARD_MAX || unitValue(p, u) < 14)) { play(state, u.uid, null, host.uid, p); continue; }
      }
      if (p.board.length >= BOARD_MAX) {
        const weak = p.board.slice().sort((a, b) => unitValue(p, a) - unitValue(p, b))[0];
        if (!u.dtier && unitValue(p, u) <= unitValue(p, weak) + 2) break;
        sell(state, weak.uid, p);
      }
      play(state, u.uid, p.board.length, null, p);
    }
  }

  // Force d'un plateau : quelques combats simulés contre les systèmes que les rivaux ont joués au
  // dernier combat (ce que tout joueur peut voir), pas contre leur système du moment.
  function simScore(state, p, board, nOpp) {
    const opps = alivePlayers(state).filter((q) => q.id !== p.id && q.seen && q.seen.length);
    if (!opps.length || !board.length) return 0;
    let score = 0;
    for (let k = 0; k < Math.min(nOpp || BOT.simOpp, opps.length); k++) {
      const op = opps[(k + state.round) % opps.length];
      for (let t = 0; t < 2; t++) {
        const fs = { seed: state.seed, rc: 0, families: state.families, uidc: 1000000, pool: {}, event: state.event };
        const me = { id: 'sim', law: p.law, tier: p.tier, relics: p.relics, awake: p.awake, board: JSON.parse(JSON.stringify(board)) };
        const them = { id: 'opp', law: op.law, tier: op.tier, relics: op.relics, awake: op.awake, board: JSON.parse(JSON.stringify(op.seen)) };
        const r = fight(fs, me, them, 'sim:' + p.id + ':' + state.round + ':' + k + ':' + t, false);
        score += r.winner === 0 ? 1 + r.damage * 0.05 : r.winner === 1 ? -1 - r.damage * 0.05 : 0;
      }
    }
    return score;
  }
  // Achat réfléchi : chaque option est jouée sur une copie de la partie (effets à l'achat,
  // triplés, découvertes compris), puis le plateau obtenu est mis à l'épreuve.
  function simPick(state, p, opts) {
    const base = simScore(state, p, p.board);
    let best = null;
    for (const o of opts.slice(0, BOT.simCand)) {
      if (!canBuy(state, o.i, p).ok) continue;
      const sc = JSON.parse(JSON.stringify(state));
      const pc = findPlayer(sc, p.id);
      buy(sc, o.i, pc);
      botDeploy(sc, pc);
      const gain = simScore(sc, pc, pc.board) - base;
      const total = o.v + BOT.sim * gain;
      if (!best || total > best.total) best = Object.assign({}, o, { total, gain });
    }
    return best;
  }

  // ─── Placement des bots ─────────────────────────────────────
  // Ce qu'un astre apporte à l'avant : de quoi frapper et encaisser. Ceux qui grandissent quand un
  // allié tombe préfèrent l'arrière, d'où ils avancent plus forts.
  function frontValue(u) {
    const c = cardOf(u);
    let v = u.atk + u.hp * 0.8;
    if (u.kw.includes('rempart')) v += 8;
    if (u.kw.includes('bouclier')) v += 3;
    if (u.kw.includes('venin') || u.kw.includes('rafale') || u.kw.includes('megarafale')) v += 4;
    if (u.kw.includes('renaissance')) v += 2;
    if (u.kw.includes('garde')) v += 5;
    if (u.kw.includes('percee')) v += 2;
    if (u.kw.includes('portee')) v -= 9;
    if (typeof c.allyDeath === 'function') v -= 6;
    return v;
  }
  // Quelques placements candidats : les plus solides devant (pour chaque taille d'avant possible),
  // puis les deux familles les plus nombreuses regroupées devant ou derrière.
  function placements(board) {
    const n = board.length;
    const kMin = Math.max(1, n - ROW_MAX), kMax = Math.min(ROW_MAX, n);
    const order = board.slice().sort((a, b) => frontValue(b) - frontValue(a));
    const build = (pref, k) => {
      const front = pref.slice(0, k);
      for (const u of order) if (front.length < k && !front.includes(u)) front.push(u);
      return front;
    };
    const out = [];
    for (let k = kMax; k >= kMin; k--) out.push(build([], k));
    const fams = FAMILY_KEYS.map((f) => board.filter((u) => famOf(u) === f)).filter((l) => l.length >= FORM_MIN).sort((a, b) => b.length - a.length).slice(0, 2);
    for (const l of fams) {
      const mine = order.filter((u) => l.includes(u));
      out.push(build(mine, Math.max(kMin, Math.min(kMax, Math.max(mine.length, Math.ceil(n / 2))))));
      const rest = order.filter((u) => !l.includes(u));
      const k = Math.max(kMin, Math.min(kMax, n - Math.min(mine.length, ROW_MAX)));
      out.push(build(rest, k));
    }
    const seen = new Set();
    return out.filter((front) => { const key = front.map((u) => u.uid).sort().join(','); if (seen.has(key)) return false; seen.add(key); return true; })
      .map((front) => alignPhenomena(front, board.filter((u) => !front.includes(u))));
  }
  // L'ordre des deux rangées qui déclenche le plus de phénomènes (à égalité : l'ordre d'origine).
  function perms(list) {
    if (list.length <= 1) return [list.slice()];
    const out = [];
    list.forEach((x, i) => { for (const p of perms(list.slice(0, i).concat(list.slice(i + 1)))) out.push([x].concat(p)); });
    return out;
  }
  function alignPhenomena(front, back) {
    let best = [front, back], top = findPhenomena(front, back).length;
    for (const f of perms(front)) for (const b of perms(back)) {
      const n = findPhenomena(f, b).length;
      if (n > top) { top = n; best = [f, b]; }
    }
    return best;
  }
  function applyPlacement(p, place) {
    const [front, back] = place;
    for (const u of front) u.row = 0;
    for (const u of back) u.row = 1;
    p.board = front.concat(back);
  }
  // L'IA experte essaie ses placements contre les systèmes vus au dernier combat.
  function botArrange(state, p) {
    arrange(p);
    if (p.board.length <= 1) { for (const u of p.board) u.row = 0; return; }
    const cands = placements(p.board);
    let best = cands[0];
    if (expert(p) && state.round >= 2 && cands.length > 1) {
      const nOpp = state.players.length <= 2 ? 1 : 2;
      let top = -Infinity;
      for (const place of cands) {
        const [front, back] = place;
        const board = front.map((u) => Object.assign({}, u, { row: 0 })).concat(back.map((u) => Object.assign({}, u, { row: 1 })));
        const sc = simScore(state, p, board, nOpp);
        if (sc > top + 1e-9) { top = sc; best = place; }
      }
    }
    applyPlacement(p, best);
  }

  function botTurn(state, p) {
    const rng = rngFor(state, 'bot:' + p.id);
    if (p.relicChoice && p.relicChoice.length) chooseRelic(state, botRelic(p), p);
    // IA experte : suit la famille qui domine déjà son système.
    if (expert(p) && state.round >= 4) {
      const top = FAMILY_KEYS.map((f) => [f, famCount(p, f)]).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 3 && !p.pref2) p.pref = top[0];
    }
    botDeploy(state, p);
    // L'IA experte monte de niveau plus tard : elle remplit d'abord son système, puis investit
    // l'énergie restante. C'est ce qui la rend nettement plus solide en début de partie.
    const want = Math.min(6, 1 + Math.floor((state.round + p.greed - (expert(p) ? BOT.levelLag : 0)) / 2));
    if (p.tier < want && p.gold >= upgradeCost(p, state) && (state.round >= 3 || upgradeCost(p, state) <= p.gold - BUY_COST || p.gold >= 5)) upgrade(state, p);
    if (p.law === 'ingenierie' && p.gold >= 1 && p.gold % 3 === 1) usePower(state, null, p);
    if (p.law === 'renversement') {
      const t = p.board.filter((u) => u.atk > 0 && u.hp > u.atk && !u.kw.includes('rempart')).sort((a, b) => b.hp - b.atk - (a.hp - a.atk))[0];
      if (t) usePower(state, t.uid, p);
    }
    // Les Comètes grandissent à chaque actualisation : le bot en profite.
    if (rollCost(p) === 0) roll(state, p);
    const maxRolls = 3 + Math.min(3, p.board.filter((u) => famOf(u) === 'comete').length) + (expert(p) && p.tier >= 4 ? 4 : 0);
    let rolls = 0;
    for (let guard = 0; guard < 40; guard++) {
      botDeploy(state, p);
      if (p.gold < BUY_COST) break;
      const opts = p.shop.map((id, i) => (id ? { i, id, v: cardValue(p, id) + rng() * 2 } : null)).filter(Boolean).sort((a, b) => b.v - a.v);
      const thinking = expert(p) && BOT.sim > 0 && state.round >= 2 && opts.length > 1;
      const best = thinking ? simPick(state, p, opts) || opts[0] : opts[0];
      const full = p.board.length >= BOARD_MAX;
      const weak = full ? p.board.slice().sort((a, b) => unitValue(p, a) - unitValue(p, b))[0] : null;
      const bar = full ? unitValue(p, weak) + 3 : 0;
      if (!best || (best.v < bar && !(best.gain > 0.5)) || !canBuy(state, best.i, p).ok) {
        if (p.gold >= BUY_COST + ROLL_COST && rolls < maxRolls) { roll(state, p); rolls++; continue; }
        break;
      }
      buy(state, best.i, p);
    }
    botDeploy(state, p);
    if (p.gold >= 1 && p.tier < 6 && p.gold >= upgradeCost(p, state)) upgrade(state, p);
    if (expert(p) && !p.frozen) {
      // Garde le marché s'il contient une copie d'un astre déjà possédé ou un astre de sa famille.
      const keep = p.shop.some((id) => id && (ownedCopies(p, id).length >= 1 || (CARD[id].fam === p.pref && CARD[id].tier >= p.tier)));
      if (keep) freeze(state, p);
    }
    botArrange(state, p);
  }

  // ─── Fin de cycle : combats, dégâts, éliminations ───────────
  // observer : les outils peuvent suivre la table jusqu'au dernier survivant, même après
  // l'élimination du joueur local. Cette option n'est pas conservée dans les sauvegardes.
  function endTurn(state, opts) {
    const observer = !!(opts && opts.observer === true);
    const me = you(state);
    if (state.phase !== 'shop' || state.over) return fail('Le combat est déjà lancé.');
    if (me.alive && me.discover.length) return fail('Choisissez d’abord votre découverte.');
    if (me.alive && me.relicChoice && me.relicChoice.length) return fail('Choisissez d’abord votre relique.');
    const players = alivePlayers(state);
    for (const p of players) if (p.bot) botTurn(state, p);
    const myEndEvents = me.alive ? endTurnEffects(state, me) : [];
    for (const p of players) if (p.bot) endTurnEffects(state, p);
    // Les systèmes tels qu'ils combattent : chacun peut ensuite voir celui de ses rivaux.
    for (const p of players) { arrange(p); p.seen = JSON.parse(JSON.stringify(p.board)); }

    const cap = players.length > 3 ? DAMAGE_CAP : Infinity;
    // Les paires prévues dès la boutique (le joueur toujours en premier dans la sienne).
    const plan = ensurePlan(state);
    const byId = new Map(players.map((p) => [p.id, p]));
    const pairs = [];
    for (const [a, b] of plan) {
      let A = byId.get(a), B = b === 'ghost' ? state.ghost : byId.get(b);
      if (!A || !B) continue;
      if (B === me) { const t = A; A = B; B = t; }
      pairs.push([A, B]);
    }
    recordMet(state, plan);

    const results = [];
    let battle = null;
    for (const [A, B] of pairs) {
      const isMine = A === me;
      const r = fight(state, A, B, state.round + ':' + A.id + ':' + B.id, isMine);
      r.damage = Math.min(cap, r.damage);
      const res = { a: A.id, b: B.id, winner: r.winner, damage: r.damage, ghost: !!B.ghost };
      results.push(res);
      if (isMine) {
        battle = {
          events: r.events, winner: r.winner, damage: r.damage, cap: Number.isFinite(cap) ? cap : null,
          opponent: { id: B.id, name: B.name, law: B.law, tier: B.tier, hp: B.hp, ghost: !!B.ghost },
          before: { me: me.hp, opp: B.hp }
        };
        me.lastOpp = B.id;
      }
      if (r.winner === 0 && !B.ghost) B.hp -= r.damage;
      if (r.winner === 1) A.hp -= r.damage;
    }
    // Loi du phénix : la première chute ramène à la vie au lieu d'éliminer.
    for (const p of players) if (p.hp <= 0 && p.law === 'phenix' && !p.reborn) {
      p.reborn = true;
      p.hp = PHENIX_HP * (p.hpMult || 1);
      if (battle && p === me) battle.reborn = true;
    }
    if (battle) battle.after = { me: me.hp, opp: battle.opponent.ghost ? null : findPlayer(state, battle.opponent.id).hp };

    // Éliminations : les plus endettés sortent en premier.
    const fallen = players.filter((p) => p.hp <= 0).sort((x, y) => x.hp - y.hp);
    let place = players.length;
    for (const p of fallen) {
      p.alive = false;
      p.rank = place--;
      p.deadRound = state.round;
      for (const u of p.board.concat(p.hand)) releaseUnit(state, u);
      for (const id of p.discover) state.pool[id]++;
      releaseShop(state, p);
      p.discover = [];
      state.ghost = { id: 'ghost', name: p.name, law: p.law, tier: p.tier, relics: p.relics, awake: p.awake, board: JSON.parse(JSON.stringify(p.board)), ghost: true };
      p.hand = [];
    }
    const still = alivePlayers(state);
    state.history.push({ round: state.round, results, fallen: fallen.map((p) => p.id) });

    let over = false;
    if (!me.alive && !observer) over = true;
    else if (still.length <= 1) {
      const winner = observer ? still[0] : me;
      if (winner) winner.rank = 1;
      over = true;
    }
    if (over) {
      state.over = true;
      state.phase = 'over';
      state.rank = me.rank;
      state.reward = rewardsOf(state)[me.rank] || 0;
      return { ok: true, battle, results, fallen: fallen.map((p) => p.id), endEvents: myEndEvents, over: true, rank: me.rank, reward: state.reward };
    }

    state.round++;
    ensurePlan(state);
    let startEvents = [];
    for (const p of still) {
      const evs = startTurn(state, p);
      if (p === me) startEvents = evs;
    }
    return { ok: true, battle, results, fallen: fallen.map((p) => p.id), endEvents: myEndEvents, startEvents, over: false };
  }

  // ─── Multijoueur ────────────────────────────────────────────
  // Chaque téléphone joue sa boutique ; à la fin du tour il publie son plateau. L'hôte publie
  // aussi celui des bots. Une fois tous les plateaux réunis, chaque téléphone résout la manche
  // à l'identique : mêmes paires, mêmes combats (graine commune, état de combat neuf).
  function mpFamilies(seed) {
    return shuffle(FAMILY_KEYS.slice(), mulberry(hashStr(String(seed) + '|mp-families'))).slice(0, ACTIVE_FAMILIES);
  }
  function mpLawChoices(seed, families, who) {
    const ok = LAWS.filter((l) => l.fam === 'neutre' || families.includes(l.fam));
    return shuffle(ok.slice(), mulberry(hashStr(String(seed) + '|laws|' + who))).slice(0, 3).map((l) => l.id);
  }
  const MP_SEAT_LAW = LAWS.find((l) => !l.hp).id;
  const gidOf = (state, p) => (p.id === 'you' && state.mp ? state.mp.me : p.id);
  function snapshotOf(state, p) {
    return { id: gidOf(state, p), name: p.name, law: p.law, tier: p.tier, hp: p.hp, alive: p.alive, relics: (p.relics || []).slice(), awake: !!p.awake, board: JSON.parse(JSON.stringify(p.board)) };
  }
  // Fin du tour local : effets de fin de tour (et tour des bots chez l'hôte). Le plateau à publier
  // est alors figé.
  function mpLock(state, host) {
    const me = you(state);
    if (state.phase !== 'shop' || state.over) return fail('Le combat est déjà lancé.');
    if (me.discover.length) return fail('Choisissez d’abord votre découverte.');
    if (me.relicChoice && me.relicChoice.length) return fail('Choisissez d’abord votre relique.');
    const endEvents = endTurnEffects(state, me);
    if (host) for (const p of alivePlayers(state)) if (p.bot) { botTurn(state, p); endTurnEffects(state, p); }
    arrange(me);
    state.phase = 'lock';
    return { ok: true, endEvents };
  }
  // La loi d'un autre joueur (et les PV de départ qu'elle donne) : les dégâts déjà subis restent.
  function mpSeatLaw(p, law) {
    if (!p || !law || !LAW[law] || p.law === law) return;
    const mh = (LAW[law].hp || START_HP) * (p.hpMult || 1);
    p.hp += mh - p.maxHp;
    p.maxHp = mh;
    p.law = law;
  }
  // Nouvel hôte en cours de manche : il fait jouer les bots à son tour.
  function mpHostBots(state) {
    for (const p of alivePlayers(state)) if (p.bot) { botTurn(state, p); endTurnEffects(state, p); }
  }
  // Un combat retourné : le joueur se voit toujours en bas (côté 0).
  function mirror(events) {
    const sw = (s) => (s === 0 ? 1 : s === 1 ? 0 : s);
    return events.map((e) => {
      const o = Object.assign({}, e);
      if ('side' in o) o.side = sw(o.side);
      if (o.boards) o.boards = [o.boards[1], o.boards[0]];
      if (o.t === 'end') o.winner = sw(o.winner);
      return o;
    });
  }
  // Résolution d'une manche à partir des plateaux publiés (snaps : identifiant → instantané).
  function mpResolve(state, snaps, endEvents) {
    const me = you(state);
    const players = alivePlayers(state);
    const byGid = new Map(players.map((p) => [gidOf(state, p), p]));
    // Plateaux des autres (humains et bots) tels qu'ils ont été publiés.
    for (const [gid, p] of byGid) {
      if (p === me) continue;
      const sn = snaps[gid];
      if (!sn) continue;
      p.board = JSON.parse(JSON.stringify(sn.board || []));
      p.tier = sn.tier || p.tier;
      if (Array.isArray(sn.relics)) p.relics = sn.relics.filter((id) => RELIC[id]);
      p.awake = !!sn.awake;
      mpSeatLaw(p, sn.law);
    }
    for (const [gid, p] of byGid) p.seen = JSON.parse(JSON.stringify(snaps[gid] && p !== me ? snaps[gid].board || [] : p.board));
    // Les mêmes paires sur tous les téléphones, prévues dès la boutique.
    const pairs = ensurePlan(state).slice();
    recordMet(state, pairs);
    // Si l'hôte a retenu un autre plateau pour nous (publication en retard), on combat avec
    // celui-là, comme les autres téléphones.
    const mine = snaps[gidOf(state, me)];
    // Les reliques et l'éveil publiés voyagent avec ce plateau.
    const kept = (sn) => JSON.stringify([sn.board, sn.relics || [], !!sn.awake]);
    if (mine && kept(mine) !== kept(me)) {
      const proxy = Object.assign({}, me, { board: JSON.parse(JSON.stringify(mine.board)), tier: mine.tier || me.tier, relics: (mine.relics || []).slice(), awake: !!mine.awake });
      byGid.set(gidOf(state, me), proxy);
      proxy.__real = me;
    }
    const cap = players.length > 3 ? DAMAGE_CAP : Infinity;
    const results = [];
    let battle = null, myOpp = null;
    for (const [ga, gb] of pairs) {
      const A = byGid.get(ga), B = gb === 'ghost' ? state.ghost : byGid.get(gb);
      const isMe = (x) => x === me || (x && x.__real === me);
      const mineFight = isMe(A) || isMe(B);
      const fs = { seed: state.seed, rc: 0, families: state.families, uidc: 1000000, pool: {}, event: state.event };
      const r = fight(fs, A, B, state.round + ':' + ga + ':' + gb, mineFight);
      r.damage = Math.min(cap, r.damage);
      results.push({ a: ga, b: gb, winner: r.winner, damage: r.damage, ghost: !!B.ghost });
      if (mineFight) {
        const flip = isMe(B);
        const opp = flip ? A : B;
        myOpp = opp;
        battle = {
          events: flip ? mirror(r.events) : r.events,
          winner: flip ? (r.winner === 0 ? 1 : r.winner === 1 ? 0 : -1) : r.winner,
          damage: r.damage, cap: Number.isFinite(cap) ? cap : null,
          opponent: { id: opp.id, name: opp.name, law: opp.law, tier: opp.tier, hp: opp.hp, ghost: !!opp.ghost },
          before: { me: me.hp, opp: opp.hp }
        };
        me.lastOpp = opp.id;
      }
      const hurt = (x, d) => { (x.__real || x).hp -= d; };
      if (r.winner === 0 && !B.ghost) hurt(B, r.damage);
      if (r.winner === 1) hurt(A, r.damage);
    }
    for (const p of players) if (p.hp <= 0 && p.law === 'phenix' && !p.reborn) {
      p.reborn = true;
      p.hp = PHENIX_HP * (p.hpMult || 1);
      if (battle && p === me) battle.reborn = true;
    }
    if (battle) battle.after = { me: me.hp, opp: myOpp.ghost ? null : myOpp.hp };
    // Éliminations : les plus endettés d'abord, à égalité par identifiant (même ordre partout).
    const fallen = players.filter((p) => p.hp <= 0).sort((x, y) => x.hp - y.hp || (gidOf(state, x) < gidOf(state, y) ? -1 : 1));
    let place = players.length;
    for (const p of fallen) {
      p.alive = false;
      p.rank = place--;
      p.deadRound = state.round;
      for (const u of p.board.concat(p.hand)) releaseUnit(state, u);
      for (const id of p.discover) state.pool[id]++;
      releaseShop(state, p);
      p.discover = [];
      state.ghost = { id: 'ghost', name: p.name, law: p.law, tier: p.tier, relics: p.relics, awake: p.awake, board: JSON.parse(JSON.stringify(p.board)), ghost: true };
      p.hand = [];
    }
    const still = alivePlayers(state);
    state.history.push({ round: state.round, results, fallen: fallen.map((p) => gidOf(state, p)) });
    if (!me.alive || still.length <= 1) {
      if (me.alive) me.rank = 1;
      state.over = true;
      state.phase = 'over';
      state.rank = me.rank;
      state.reward = rewardsOf(state)[me.rank] || 0;
      return { ok: true, battle, results, fallen: fallen.map((p) => p.id), endEvents: endEvents || [], over: true, rank: me.rank, reward: state.reward };
    }
    state.round++;
    state.phase = 'shop';
    ensurePlan(state);
    let startEvents = [];
    for (const p of still) {
      if (p.remote) continue;
      const evs = startTurn(state, p);
      if (p === me) startEvents = evs;
    }
    return { ok: true, battle, results, fallen: fallen.map((p) => p.id), endEvents: endEvents || [], startEvents, over: false };
  }

  // ─── Contrôle (tests) ───────────────────────────────────────
  function poolAudit(state) {
    const total = Object.assign({}, state.pool);
    for (const p of state.players) {
      if (!p.alive) continue;
      for (const id of p.shop.concat(p.discover)) if (id) total[id]++;
      for (const u of p.board.concat(p.hand)) for (const id of copiesOf(u)) total[id]++;
    }
    return total;
  }

  return {
    rollCost, DUEL, isDuel, rewardsOf, ROW_MAX, FORM_MIN, FORMATIONS, formationsOf, formText, PHENOMENA, phenomenaOf, POSITION_KW, layout, arrange, rowOf, move, botArrange, LEGEND_SHOP, LEGEND_DISCOVER, START_HP, MAX_GOLD, BUY_COST, ROLL_COST, HAND_MAX, BOARD_MAX, COPIES, SHOP_SIZE, UPGRADE, DAMAGE_CAP, REWARDS,
    FAMILIES, FAMILY_KEYS, KEYWORDS, CARDS, CARD, LAWS, LAW,
    EVENTS, EVENT, eventFor, RELICS, RELIC, RELIC_ROUNDS, AWAKE_ROUND, chooseRelic, hasRelic, powerCost, sellGain, shopSize,
    cardOf, famOf, cardText, upgradeCost, lawChoices, newGame, alivePlayers,
    buy, canBuy, play, canMagnet, sell, roll, freeze, upgrade, reorder, usePower, canUsePower, choose, endTurn,
    fight, poolAudit, copiesOf, botTurn, botDeploy,
    mpFamilies, mpLawChoices, mpSeatLaw, snapshotOf, mpLock, mpHostBots, mirror, mpResolve, planPairs, nextOpponent
  };
});
