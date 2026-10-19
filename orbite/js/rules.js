/* ORBITE — règles du jeu (pures et déterministes, sans DOM).
 * Taverne à réserve partagée, fusion dorée + découverte, combat automatique
 * façon Champs de bataille, bots, dégâts plafonnés, classement et poussières.
 * Navigateur : window.OrbiteRules — Node : require('./rules.js'). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbiteRules = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // ─── Paramètres ─────────────────────────────────────────────
  const START_HP = 30;
  const MAX_GOLD = 10;
  const BUY_COST = 3;
  const ROLL_COST = 1;
  const HAND_MAX = 10;
  const BOARD_MAX = 7;
  const PLAYERS = 8;
  const ACTIVE_FAMILIES = 5;
  const COPIES = [0, 16, 15, 13, 11, 9, 7];
  const SHOP_SIZE = [0, 3, 4, 4, 5, 5, 6];
  const UPGRADE = [0, 5, 7, 8, 9, 10, 0];
  const DAMAGE_CAP = 10;
  const REWARDS = { 1: 100, 2: 60, 3: 30 };

  const FAMILIES = {
    vie: { name: 'Vie', color: '#9fdc7c', text: 'Les Soleils font grandir les mondes Habitables à chaque fin de cycle.' },
    neant: { name: 'Néant', color: '#a993f2', text: 'Trous noirs et planètes mortes : chaque effondrement nourrit les autres.' },
    envers: { name: 'Envers', color: '#ff5f74', text: 'Le monde à l’envers : Renaissance, Venin et inversion des statistiques.' },
    brasier: { name: 'Brasier', color: '#ff9a4a', text: 'Lave et étoiles rouges : des dégâts avant même le premier coup.' },
    glace: { name: 'Glace', color: '#8ad8ff', text: 'Boucliers de glace, et de la force quand ils se brisent.' },
    tempete: { name: 'Tempête', color: '#5fe0c3', text: 'Géantes gazeuses : Rafale et attaque qui monte à chaque coup.' },
    mineral: { name: 'Minéral', color: '#dcbd8c', text: 'Remparts de roche qui accumulent les points de vie.' },
    machine: { name: 'Machine', color: '#b8c4d8', text: 'Sondes et stations qui s’arriment les unes aux autres.' },
    neutre: { name: 'Neutre', color: '#9aa3ad', text: 'Présents dans toutes les parties.' }
  };
  const FAMILY_KEYS = ['vie', 'neant', 'envers', 'brasier', 'glace', 'tempete', 'mineral', 'machine'];

  const KEYWORDS = {
    rempart: { name: 'Rempart', text: 'Les ennemis doivent l’attaquer en priorité.' },
    bouclier: { name: 'Bouclier', text: 'Ignore la première source de dégâts.' },
    rafale: { name: 'Rafale', text: 'Attaque deux fois.' },
    megarafale: { name: 'Méga-rafale', text: 'Attaque quatre fois.' },
    renaissance: { name: 'Renaissance', text: 'Revient une fois avec 1 PV après s’être effondré.' },
    venin: { name: 'Venin', text: 'Détruit tout astre qu’il blesse en attaquant.' },
    arrimage: { name: 'Arrimage', text: 'Peut se poser sur une Machine pour lui donner ses statistiques et ses mots-clés.' }
  };

  // ─── Catalogue ──────────────────────────────────────────────
  // Hooks de taverne : play (Naissance), endTurn, startTurn, buy.
  // Hooks de combat : start, attack, allyAttack, death (Effondrement), allyDeath,
  // shieldBreak, damaged, allyKill, reborn, allyReborn. m = 2 si doré.
  const CARDS = [
    // VIE
    { id: 'aube', fam: 'vie', tier: 1, atk: 1, hp: 3, name: 'Aube', sun: true, look: { type: 'star', seed: 101, starClass: 'étoile orange' },
      text: 'Soleil. Fin de cycle : un autre astre de Vie gagne +{1} PV.',
      endTurn(x, u, m) { x.buff(x.rnd(x.fam('vie', u)), 0, m); } },
    { id: 'gaia', fam: 'vie', tier: 1, atk: 2, hp: 2, name: 'Gaïa', look: { type: 'earth', seed: 202 },
      text: 'Habitable : fin de cycle, avec un Soleil, gagne +{1}/+{1}.',
      endTurn(x, u, m) { x.habitable((b) => x.buff(u, m + b, m + b)); } },
    { id: 'pelagia', fam: 'vie', tier: 2, atk: 2, hp: 4, name: 'Pélagia', look: { type: 'ocean', seed: 303 },
      text: 'Naissance : vos autres astres de Vie gagnent +{1}/+{1}.',
      play(x, u, m) { for (const v of x.fam('vie', u)) x.buff(v, m, m); } },
    { id: 'sylve', fam: 'vie', tier: 2, atk: 3, hp: 3, name: 'Sylve', look: { type: 'terran', seed: 404 },
      text: 'Habitable : fin de cycle, avec un Soleil, ses voisins de Vie gagnent +{1}/+{1}.',
      endTurn(x, u, m) { x.habitable((b) => { for (const v of x.neighbors(u)) if (famOf(v) === 'vie') x.buff(v, m + b, m + b); }); } },
    { id: 'sol', fam: 'vie', tier: 3, atk: 3, hp: 5, name: 'Sol', sun: true, look: { type: 'star', seed: 505, starClass: 'naine jaune' },
      text: 'Soleil. Vos effets Habitable donnent +{1}/+{1} de plus.' },
    { id: 'terra', fam: 'vie', tier: 3, atk: 4, hp: 4, name: 'Terra', look: { type: 'earth', seed: 606, moons: 1 },
      text: 'Habitable : fin de cycle, avec un Soleil, 2 autres astres de Vie gagnent +{1}/+{1}.',
      endTurn(x, u, m) { x.habitable((b) => { for (const v of x.pick(x.fam('vie', u), 2)) x.buff(v, m + b, m + b); }); } },
    { id: 'genese', fam: 'vie', tier: 4, atk: 4, hp: 6, name: 'Genèse', look: { type: 'ocean', seed: 707, shell: true },
      text: 'Fin de cycle : vos autres astres de Vie gagnent +{1} PV, ou +{1}/+{1} avec un Soleil.',
      endTurn(x, u, m) { const sun = x.hasSun(); for (const v of x.fam('vie', u)) x.buff(v, sun ? m : 0, m); } },
    { id: 'helios', fam: 'vie', tier: 5, atk: 6, hp: 8, name: 'Hélios', sun: true, look: { type: 'star', seed: 808, starClass: 'étoile blanche' },
      text: 'Soleil. Vos effets Habitable se déclenchent {1} fois de plus.' },
    { id: 'eden', fam: 'vie', tier: 6, atk: 8, hp: 9, name: 'Éden', look: { type: 'earth', seed: 909, shell: true, moons: 1 },
      text: 'Fin de cycle : vos astres de Vie gagnent +{1}/+{1}, ou +{2}/+{2} avec un Soleil.',
      endTurn(x, u, m) { const k = (x.hasSun() ? 2 : 1) * m; for (const v of x.fam('vie')) x.buff(v, k, k); } },

    // NÉANT
    { id: 'cendre', fam: 'neant', tier: 1, atk: 2, hp: 1, name: 'Cendre', look: { type: 'dead', seed: 111 },
      text: 'Effondrement : invoque un Débris {1}/{1}.',
      death(c, u, m, i) { c.summon(u.side, 'debris', i, m); } },
    { id: 'umbra', fam: 'neant', tier: 1, atk: 1, hp: 3, name: 'Umbra', look: { type: 'blackhole', seed: 222 },
      text: 'Quand un autre allié s’effondre, gagne +{1}/+{1} pour le combat.',
      allyDeath(c, u, m) { c.buff(u, m, m); } },
    { id: 'vestige', fam: 'neant', tier: 2, atk: 3, hp: 2, name: 'Vestige', look: { type: 'dead', seed: 333, ring: true },
      text: 'Effondrement : vos astres du Néant gagnent +{1} Attaque définitivement.',
      death(c, u, m) { c.permFam(u.side, 'neant', m, 0); } },
    { id: 'nyx', fam: 'neant', tier: 2, atk: 2, hp: 2, name: 'Nyx', look: { type: 'dead', seed: 444, moons: 1 },
      text: 'Effondrement : invoque deux Débris {1}/{1}.',
      death(c, u, m, i) { c.summon(u.side, 'debris', i, m); c.summon(u.side, 'debris', i, m); } },
    { id: 'abysse', fam: 'neant', tier: 3, atk: 3, hp: 5, name: 'Abysse', look: { type: 'blackhole', seed: 555 },
      text: 'Quand un autre allié s’effondre, gagne +{2}/+{1} pour le combat.',
      allyDeath(c, u, m) { c.buff(u, 2 * m, m); } },
    { id: 'eclipse', fam: 'neant', tier: 3, atk: 4, hp: 3, name: 'Éclipse', look: { type: 'dead', seed: 666, moons: 1 },
      text: 'Effondrement : un allié aléatoire gagne +{3}/+{3} pour le combat.',
      death(c, u, m) { c.buff(c.rnd(c.allies(u.side)), 3 * m, 3 * m); } },
    { id: 'ossuaire', fam: 'neant', tier: 4, atk: 3, hp: 6, name: 'Ossuaire', kw: ['rempart'], look: { type: 'dead', seed: 777, debris: true },
      text: 'Rempart. Effondrement : invoque deux Débris {2}/{2}.',
      death(c, u, m, i) { c.summon(u.side, 'debris', i, 2 * m); c.summon(u.side, 'debris', i, 2 * m); } },
    { id: 'linceul', fam: 'neant', tier: 5, atk: 5, hp: 6, name: 'Linceul', look: { type: 'dead', seed: 888, shell: true },
      text: 'Vos effets d’Effondrement se déclenchent {1} fois de plus.' },
    { id: 'neant', fam: 'neant', tier: 6, atk: 8, hp: 8, name: 'Néant', look: { type: 'blackhole', seed: 999 },
      text: 'Quand un autre allié s’effondre, gagne +{3}/+{3} pour le combat.',
      allyDeath(c, u, m) { c.buff(u, 3 * m, 3 * m); } },

    // ENVERS
    { id: 'reflet', fam: 'envers', tier: 1, atk: 3, hp: 2, name: 'Reflet', kw: ['renaissance'], look: { type: 'terran', seed: 1212, mood: 'envers', flip: true },
      text: 'Renaissance.' },
    { id: 'faille', fam: 'envers', tier: 1, atk: 1, hp: 2, name: 'Faille', look: { type: 'portal', seed: 1313, mood: 'envers', flip: true },
      text: 'Naissance : l’astre à sa gauche gagne Renaissance.',
      play(x, u) { x.kw(x.left(u), 'renaissance'); } },
    { id: 'miroir', fam: 'envers', tier: 2, atk: 3, hp: 3, name: 'Miroir', look: { type: 'crystal', seed: 1414, mood: 'envers', flip: true },
      text: 'Effondrement : l’allié à sa gauche gagne Renaissance.',
      death(c, u, m, i) { c.kw(c.sideList(u.side)[i - 1], 'renaissance'); } },
    { id: 'revenant', fam: 'envers', tier: 2, atk: 3, hp: 3, name: 'Revenant', kw: ['renaissance'], look: { type: 'dead', seed: 1515, mood: 'envers', flip: true },
      text: 'Renaissance. Quand il revient, gagne +{3}/+{3}.',
      reborn(c, u, m) { c.buff(u, 3 * m, 3 * m); } },
    { id: 'antipode', fam: 'envers', tier: 3, atk: 4, hp: 4, name: 'Antipode', look: { type: 'toxic', seed: 1616, mood: 'envers', flip: true },
      text: 'Quand un allié revient avec Renaissance, vos astres de l’Envers gagnent +{2}/+{2} pour le combat.',
      allyReborn(c, u, m) { for (const v of c.alliesFam(u.side, 'envers')) c.buff(v, 2 * m, 2 * m); } },
    { id: 'spore', fam: 'envers', tier: 3, atk: 2, hp: 3, name: 'Spore', kw: ['venin'], look: { type: 'toxic', seed: 1717, mood: 'envers', flip: true },
      text: 'Venin.' },
    { id: 'outremonde', fam: 'envers', tier: 4, atk: 5, hp: 5, name: 'Outremonde', look: { type: 'portal', seed: 1818, flip: true },
      text: 'Début de combat : inverse l’Attaque et les PV de l’ennemi le plus fort.',
      textGold: 'Début de combat : inverse l’Attaque et les PV des deux ennemis les plus forts.',
      start(c, u, m) { const t = c.ranked(1 - u.side).slice(0, m); for (const v of t) c.swap(v); } },
    { id: 'revers', fam: 'envers', tier: 5, atk: 6, hp: 6, name: 'Revers', look: { type: 'crystal', seed: 1919, mood: 'envers', flip: true, debris: true },
      text: 'Début de combat : vos astres de l’Envers gagnent Renaissance.',
      start(c, u) { for (const v of c.alliesFam(u.side, 'envers')) c.kw(v, 'renaissance'); } },
    { id: 'envers', fam: 'envers', tier: 6, atk: 8, hp: 8, name: 'L’Envers', look: { type: 'portal', seed: 2020, mood: 'envers', flip: true },
      text: 'Début de combat : inverse l’Attaque et les PV des ennemis qui ont plus d’Attaque que de PV.',
      start(c, u) { for (const v of c.allies(1 - u.side)) if (v.atk > v.hp) c.swap(v); } },

    // BRASIER
    { id: 'braise', fam: 'brasier', tier: 1, atk: 2, hp: 2, name: 'Braise', look: { type: 'lava', seed: 2121 },
      text: 'Début de combat : inflige {1} dégât à un ennemi aléatoire.',
      start(c, u, m) { c.dmg(u, c.rnd(c.allies(1 - u.side)), m); } },
    { id: 'scorie', fam: 'brasier', tier: 1, atk: 3, hp: 2, name: 'Scorie', look: { type: 'lava', seed: 2222, moons: 1 },
      text: 'Effondrement : inflige {2} dégâts à un ennemi aléatoire.',
      death(c, u, m) { c.dmg(u, c.rnd(c.allies(1 - u.side)), 2 * m); } },
    { id: 'vulcain', fam: 'brasier', tier: 2, atk: 3, hp: 3, name: 'Vulcain', look: { type: 'lava', seed: 2323, ring: true },
      text: 'Après son attaque : inflige {1} dégât à tous les ennemis.',
      attack(c, u, m) { for (const v of c.allies(1 - u.side)) c.dmg(u, v, m); } },
    { id: 'tison', fam: 'brasier', tier: 2, atk: 2, hp: 4, name: 'Tison', look: { type: 'star', seed: 2424, starClass: 'naine rouge' },
      text: 'Vos effets infligent +{1} dégât.' },
    { id: 'magma', fam: 'brasier', tier: 3, atk: 4, hp: 4, name: 'Magma', look: { type: 'lava', seed: 2525, moons: 1 },
      text: 'Début de combat : inflige {3} dégâts à l’ennemi le plus fort.',
      start(c, u, m) { c.dmg(u, c.ranked(1 - u.side)[0], 3 * m); } },
    { id: 'pyro', fam: 'brasier', tier: 3, atk: 3, hp: 5, name: 'Pyrosphère', look: { type: 'lava', seed: 2626, debris: true },
      text: 'Après l’attaque d’un allié de Brasier : inflige {1} dégât à un ennemi aléatoire.',
      allyAttack(c, u, m, a) { if (famOf(a) === 'brasier') c.dmg(u, c.rnd(c.allies(1 - u.side)), m); } },
    { id: 'nova', fam: 'brasier', tier: 4, atk: 5, hp: 4, name: 'Nova', look: { type: 'star', seed: 2727, starClass: 'étoile orange' },
      text: 'Effondrement : inflige {3} dégâts à tous les ennemis.',
      death(c, u, m) { for (const v of c.allies(1 - u.side)) c.dmg(u, v, 3 * m); } },
    { id: 'geante', fam: 'brasier', tier: 5, atk: 6, hp: 7, name: 'Géante rouge', look: { type: 'star', seed: 2828, starClass: 'naine rouge' },
      text: 'Début de combat : inflige {2} dégâts à tous les ennemis.',
      start(c, u, m) { for (const v of c.allies(1 - u.side)) c.dmg(u, v, 2 * m); } },
    { id: 'supernova', fam: 'brasier', tier: 6, atk: 8, hp: 8, name: 'Supernova', look: { type: 'star', seed: 2929, starClass: 'géante bleue' },
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
    { id: 'comete', fam: 'glace', tier: 2, atk: 3, hp: 3, name: 'Comète', kw: ['bouclier'], look: { type: 'ice', seed: 3434, moons: 0 },
      text: 'Bouclier. Effondrement : un allié aléatoire gagne Bouclier.',
      death(c, u) { c.kw(c.rnd(c.allies(u.side).filter((v) => !v.kw.includes('bouclier'))), 'bouclier'); } },
    { id: 'cristal', fam: 'glace', tier: 3, atk: 4, hp: 5, name: 'Cristal', kw: ['bouclier'], look: { type: 'crystal', seed: 3535, hueShift: -60 },
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
    { id: 'brume', fam: 'tempete', tier: 1, atk: 2, hp: 3, name: 'Brume', look: { type: 'gas', seed: 4141 },
      text: 'Quand vous achetez un astre, gagne +{1} Attaque.',
      buy(x, u, m) { x.buff(u, m, 0); } },
    { id: 'zephyr', fam: 'tempete', tier: 1, atk: 2, hp: 2, name: 'Zéphyr', kw: ['rafale'], look: { type: 'gas', seed: 4242 },
      text: 'Rafale.' },
    { id: 'cumulus', fam: 'tempete', tier: 2, atk: 3, hp: 4, name: 'Cumulus', look: { type: 'gas', seed: 4343 },
      text: 'Naissance : vos autres astres de Tempête gagnent +{2} Attaque.',
      play(x, u, m) { for (const v of x.fam('tempete', u)) x.buff(v, 2 * m, 0); } },
    { id: 'nimbus', fam: 'tempete', tier: 2, atk: 3, hp: 4, name: 'Nimbus', look: { type: 'gas', seed: 4444, ring: true },
      text: 'Après son attaque : gagne +{2} Attaque pour le combat.',
      attack(c, u, m) { c.buff(u, 2 * m, 0); } },
    { id: 'cyclone', fam: 'tempete', tier: 3, atk: 4, hp: 4, name: 'Cyclone', kw: ['rafale'], look: { type: 'gas', seed: 4545 },
      text: 'Rafale. Après chaque attaque : gagne +{1} Attaque pour le combat.',
      attack(c, u, m) { c.buff(u, m, 0); } },
    { id: 'orage', fam: 'tempete', tier: 3, atk: 3, hp: 6, name: 'Orage', look: { type: 'gas', seed: 4646, moons: 2 },
      text: 'Quand vous achetez un astre de Tempête, vos astres de Tempête gagnent +{1}/+{1}.',
      buy(x, u, m, b) { if (famOf(b) === 'tempete') for (const v of x.fam('tempete')) x.buff(v, m, m); } },
    { id: 'titan', fam: 'tempete', tier: 4, atk: 5, hp: 7, name: 'Titan', look: { type: 'gas', seed: 4747, ring: true, moons: 1 },
      text: 'Fin de cycle : vos astres de Tempête gagnent +{2} Attaque.',
      endTurn(x, u, m) { for (const v of x.fam('tempete')) x.buff(v, 2 * m, 0); } },
    { id: 'ouragan', fam: 'tempete', tier: 5, atk: 6, hp: 7, name: 'Ouragan', kw: ['megarafale'], look: { type: 'gas', seed: 4848 },
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
    { id: 'agate', fam: 'mineral', tier: 2, atk: 2, hp: 4, name: 'Agate', kw: ['rempart'], look: { type: 'moon', seed: 5353 },
      text: 'Rempart. Naissance : vos autres Remparts gagnent +{1}/+{1}.',
      play(x, u, m) { for (const v of x.board().filter((v) => v !== u && v.kw.includes('rempart'))) x.buff(v, m, m); } },
    { id: 'ocre', fam: 'mineral', tier: 2, atk: 3, hp: 3, name: 'Ocre', look: { type: 'desert', seed: 5454, moons: 1 },
      text: 'Fin de cycle : un astre Minéral aléatoire gagne +{1}/+{2}.',
      endTurn(x, u, m) { x.buff(x.rnd(x.fam('mineral')), m, 2 * m); } },
    { id: 'basalte', fam: 'mineral', tier: 3, atk: 3, hp: 6, name: 'Basalte', kw: ['rempart'], look: { type: 'moon', seed: 5555 },
      text: 'Rempart. Quand il survit à des dégâts, gagne +{2} Attaque pour le combat.',
      damaged(c, u, m) { c.buff(u, 2 * m, 0); } },
    { id: 'geode', fam: 'mineral', tier: 3, atk: 4, hp: 4, name: 'Géode', look: { type: 'crystal', seed: 5656, hueShift: 120 },
      text: 'Fin de cycle : vos Remparts gagnent +{0}/+{2}.',
      endTurn(x, u, m) { for (const v of x.board().filter((v) => v.kw.includes('rempart'))) x.buff(v, 0, 2 * m); } },
    { id: 'obsidienne', fam: 'mineral', tier: 4, atk: 4, hp: 7, name: 'Obsidienne', kw: ['rempart', 'bouclier'], look: { type: 'asteroid', seed: 5757, debris: true },
      text: 'Rempart. Bouclier.' },
    { id: 'monolithe', fam: 'mineral', tier: 5, atk: 5, hp: 9, name: 'Monolithe', kw: ['rempart'], look: { type: 'desert', seed: 5858, ring: true },
      text: 'Rempart. Début de combat : vos autres Remparts gagnent +{3}/+{3}.',
      start(c, u, m) { for (const v of c.allies(u.side)) if (v !== u && v.kw.includes('rempart')) c.buff(v, 3 * m, 3 * m); } },
    { id: 'colosse', fam: 'mineral', tier: 6, atk: 8, hp: 14, name: 'Colosse', kw: ['rempart'], look: { type: 'asteroid', seed: 5959, debris: true },
      text: 'Rempart. Fin de cycle : vos Remparts gagnent +{1}/+{2}.',
      endTurn(x, u, m) { for (const v of x.board().filter((v) => v.kw.includes('rempart'))) x.buff(v, m, 2 * m); } },

    // MACHINE
    { id: 'sonde', fam: 'machine', tier: 1, atk: 2, hp: 2, name: 'Sonde', kw: ['arrimage'], look: { type: 'mecha', seed: 6161 },
      text: 'Arrimage.' },
    { id: 'relais', fam: 'machine', tier: 1, atk: 2, hp: 3, name: 'Relais', look: { type: 'mecha', seed: 6262 },
      text: 'Effondrement : invoque une Sonde {1}/{1}.',
      death(c, u, m, i) { c.summon(u.side, 'sonde-t', i, m); } },
    { id: 'station', fam: 'machine', tier: 2, atk: 2, hp: 4, name: 'Station', kw: ['arrimage', 'bouclier'], look: { type: 'mecha', seed: 6363, ring: true },
      text: 'Arrimage. Bouclier.' },
    { id: 'foreuse', fam: 'machine', tier: 2, atk: 3, hp: 4, name: 'Foreuse', look: { type: 'mecha', seed: 6464 },
      text: 'Naissance : vos autres Machines gagnent +{1}/+{1}.',
      play(x, u, m) { for (const v of x.fam('machine', u)) x.buff(v, m, m); } },
    { id: 'dyson', fam: 'machine', tier: 3, atk: 3, hp: 5, name: 'Dyson', look: { type: 'mecha', seed: 6565, moons: 1 },
      text: 'Début de cycle : gagnez {1} énergie.',
      startTurn(x, u, m) { x.gold(m); } },
    { id: 'arecibo', fam: 'machine', tier: 3, atk: 3, hp: 5, name: 'Arecibo', kw: ['arrimage', 'rempart'], look: { type: 'mecha', seed: 6666 },
      text: 'Arrimage. Rempart.' },
    { id: 'sentinelle', fam: 'machine', tier: 4, atk: 4, hp: 6, name: 'Sentinelle', kw: ['arrimage', 'bouclier', 'rempart'], look: { type: 'mecha', seed: 6767, ring: true },
      text: 'Arrimage. Bouclier. Rempart.' },
    { id: 'forge', fam: 'machine', tier: 5, atk: 6, hp: 7, name: 'Forge stellaire', look: { type: 'mecha', seed: 6868, moons: 2 },
      text: 'Début de combat : vos Machines gagnent Bouclier.',
      start(c, u) { for (const v of c.alliesFam(u.side, 'machine')) c.kw(v, 'bouclier'); } },
    { id: 'oeil', fam: 'machine', tier: 6, atk: 7, hp: 9, name: 'L’Œil', kw: ['arrimage', 'rafale', 'bouclier', 'venin'], look: { type: 'mecha', seed: 6969 },
      text: 'Arrimage. Rafale. Bouclier. Venin.' },

    // NEUTRES
    { id: 'errante', fam: 'neutre', tier: 1, atk: 3, hp: 2, name: 'Errante', look: { type: 'asteroid', seed: 7171 },
      text: 'Une roche sans attache.' },
    { id: 'echo', fam: 'neutre', tier: 1, atk: 1, hp: 2, name: 'Écho', look: { type: 'moon', seed: 7272 },
      text: 'Naissance : gagnez {1} énergie.',
      play(x, u, m) { x.gold(m); } },
    { id: 'satellite', fam: 'neutre', tier: 2, atk: 2, hp: 3, name: 'Satellite', look: { type: 'moon', seed: 7373, ring: true },
      text: 'Naissance : un autre allié aléatoire gagne +{1}/+{1}.',
      play(x, u, m) { x.buff(x.rnd(x.others(u)), m, m); } },
    { id: 'luna', fam: 'neutre', tier: 2, atk: 2, hp: 4, name: 'Luna', kw: ['rempart'], look: { type: 'moon', seed: 7474 },
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

    // JETONS (hors réserve)
    { id: 'debris', fam: 'neant', tier: 1, atk: 1, hp: 1, name: 'Débris', token: true, look: { type: 'asteroid', seed: 8181 },
      text: 'Fragment d’un monde effondré.' },
    { id: 'sonde-t', fam: 'machine', tier: 1, atk: 2, hp: 2, name: 'Sonde', token: true, kw: ['arrimage'], look: { type: 'mecha', seed: 8282 },
      text: 'Arrimage.' }
  ];
  const CARD = Object.fromEntries(CARDS.map((c) => [c.id, c]));

  const LAWS = [
    { id: 'symbiose', fam: 'vie', name: 'Loi de symbiose', starter: 'aube', tagline: 'Tout commence par une étoile.', text: 'Fin de cycle : votre astre le plus faible gagne +1 PV, ou +1/+1 si c’est un astre de Vie.' },
    { id: 'entropie', fam: 'neant', name: 'Loi de l’entropie', starter: 'cendre', tagline: 'Rien ne meurt en vain.', text: 'Quand un de vos astres s’effondre, les autres gagnent +1 Attaque pour le combat.' },
    { id: 'renversement', fam: 'envers', name: 'Loi du renversement', starter: 'reflet', tagline: 'Le haut est en bas.', text: 'Pouvoir (gratuit, une fois par cycle) : inverse l’Attaque et les PV d’un de vos astres, puis il gagne +1/+1.', active: { cost: 0, target: true } },
    { id: 'combustion', fam: 'brasier', name: 'Loi de combustion', starter: 'braise', tagline: 'Brûler avant de disparaître.', text: 'Début de combat : inflige 3 dégâts à un ennemi aléatoire.' },
    { id: 'stase', fam: 'glace', name: 'Loi de stase', starter: 'nive', tagline: 'Le silence est une forteresse.', text: 'Début de combat : vos deux premiers astres gagnent Bouclier.' },
    { id: 'vents', fam: 'tempete', name: 'Loi des vents', starter: 'brume', tagline: 'Tout ce qui bouge frappe.', text: 'Après chaque attaque, l’astre attaquant gagne +1 Attaque pour le combat.' },
    { id: 'gravite', fam: 'mineral', name: 'Loi de gravité', starter: 'silex', tagline: 'Ce qui pèse dure.', text: 'Fin de cycle : vos Remparts gagnent +0/+2.' },
    { id: 'ingenierie', fam: 'machine', name: 'Loi d’ingénierie', starter: 'sonde', tagline: 'Assembler les mondes.', text: 'Pouvoir (1 énergie, une fois par cycle) : ajoute une Sonde 2/2 Arrimage à votre main.', active: { cost: 1, target: false } }
  ];
  const LAW = Object.fromEntries(LAWS.map((l) => [l.id, l]));

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

  function copiesOf(u) {
    const list = [];
    if (!cardOf(u).token) for (let i = 0; i < (u.golden ? 3 : 1); i++) list.push(u.id);
    for (const a of u.att || []) if (!CARD[a.id].token) for (let i = 0; i < (a.golden ? 3 : 1); i++) list.push(a.id);
    return list;
  }

  function releaseUnit(state, u) {
    for (const id of copiesOf(u)) if (state.pool[id] !== undefined) state.pool[id]++;
  }

  function upgradeCost(p) { return p.tier >= 6 ? 0 : Math.max(0, UPGRADE[p.tier] - p.discount); }

  // ─── Contexte de taverne ────────────────────────────────────
  function shopCtx(state, p) {
    const rng = rngFor(state, 'shop:' + p.id);
    const x = {
      p, events: [],
      board: () => p.board,
      rnd: (list) => (list && list.length ? list[Math.floor(rng() * list.length)] : null),
      pick: (list, n) => shuffle(list.slice(), rng).slice(0, n),
      fam: (f, except) => p.board.filter((v) => v !== except && famOf(v) === f),
      others: (u) => p.board.filter((v) => v !== u),
      left: (u) => p.board[p.board.indexOf(u) - 1] || null,
      right: (u) => p.board[p.board.indexOf(u) + 1] || null,
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

  // ─── Réserve et taverne ─────────────────────────────────────
  function drawFromPool(state, maxTier, rng, exactTier) {
    const ids = Object.keys(state.pool).filter((id) => {
      const t = CARD[id].tier;
      return state.pool[id] > 0 && (exactTier ? t === exactTier : t <= maxTier);
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
    while (p.shop.length < SHOP_SIZE[p.tier]) {
      const id = drawFromPool(state, p.tier, rng);
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
    const p = {
      id, name, bot, law: lawId, pref: law.fam,
      hp: START_HP, tier: 1, gold: 3, discount: 0,
      board: [], hand: [], shop: [], discover: [],
      frozen: false, powerUsed: false, alive: true, rank: null,
      lastOpp: null, deadRound: 0, greed: 0
    };
    const starter = makeUnit(state, law.starter);
    state.pool[law.starter]--;
    p.board.push(starter);
    return p;
  }

  function newGame(seed, lawId) {
    seed = String(seed);
    const rng = mulberry(hashStr(seed + '|families'));
    const law = LAW[lawId] || LAWS[0];
    const others = shuffle(FAMILY_KEYS.filter((f) => f !== law.fam), rng);
    const families = [law.fam].concat(others.slice(0, ACTIVE_FAMILIES - 1));
    const state = {
      v: 1, seed, round: 1, phase: 'shop', rc: 0, uidc: 1,
      families, pool: {}, poolTotal: {},
      players: [], history: [], ghost: null, over: false, rank: null, reward: 0
    };
    for (const c of CARDS) {
      if (c.token) continue;
      if (c.fam === 'neutre' || families.includes(c.fam)) state.pool[c.id] = COPIES[c.tier];
    }
    state.poolTotal = Object.assign({}, state.pool);
    state.players.push(newPlayer(state, 'you', 'VOUS', law.id, false));
    const botLaws = LAWS.filter((l) => families.includes(l.fam));
    const names = shuffle(BOT_NAMES.slice(), rng);
    for (let i = 0; i < PLAYERS - 1; i++) {
      const bl = botLaws[Math.floor(rng() * botLaws.length)];
      const b = newPlayer(state, 'bot' + i, names[i], bl.id, true);
      b.greed = Math.floor(rng() * 4) - 1;
      if (rng() < 0.3) b.pref = families[Math.floor(rng() * families.length)];
      state.players.push(b);
    }
    for (const p of state.players) rollShop(state, p);
    return state;
  }

  function alivePlayers(state) { return state.players.filter((p) => p.alive); }

  // ─── Actions de taverne ─────────────────────────────────────
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
    p.hand.push(u);
    const x = shopCtx(state, p);
    for (const v of p.board.slice()) hook(v, 'buy', x, u);
    const triple = checkTriple(state, p, id);
    return { ok: true, uid: u.uid, triple: triple ? triple.uid : null, merged: triple ? triple.merged : null, events: x.events };
  }

  function canMagnet(u, target) {
    return !!target && u.kw.includes('arrimage') && famOf(target) === 'machine' && target !== u;
  }

  function play(state, uid, index, targetUid, p) {
    p = p || you(state);
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
    p.hand.splice(hi, 1);
    const at = Math.max(0, Math.min(p.board.length, index == null ? p.board.length : index));
    p.board.splice(at, 0, u);
    hook(u, 'play', x, at);
    for (const v of p.board.slice()) if (v !== u) hook(v, 'allyPlay', x, u);
    let discover = false;
    if (u.dtier) {
      const t = u.dtier;
      delete u.dtier;
      openDiscover(state, p, t);
      discover = p.discover.length > 0;
    }
    return { ok: true, index: at, events: x.events, discover };
  }

  function sell(state, uid, p) {
    p = p || you(state);
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    const i = p.board.findIndex((u) => u.uid === uid);
    if (i < 0) return fail('Seuls les astres du système se vendent.');
    const [u] = p.board.splice(i, 1);
    releaseUnit(state, u);
    p.gold = Math.min(99, p.gold + 1);
    return { ok: true };
  }

  function roll(state, p) {
    p = p || you(state);
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    if (p.gold < ROLL_COST) return fail('Il faut 1 énergie.');
    p.gold -= ROLL_COST;
    p.frozen = false;
    rollShop(state, p);
    return { ok: true };
  }

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
    const cost = upgradeCost(p);
    if (p.gold < cost) return fail('Il faut ' + cost + ' énergies.');
    p.gold -= cost;
    p.tier++;
    p.discount = 0;
    return { ok: true, tier: p.tier };
  }

  function reorder(state, uid, index, p) {
    p = p || you(state);
    if (state.phase !== 'shop') return fail('Le marché est fermé.');
    const i = p.board.findIndex((u) => u.uid === uid);
    if (i < 0) return fail('Astre introuvable.');
    const [u] = p.board.splice(i, 1);
    p.board.splice(Math.max(0, Math.min(p.board.length, index)), 0, u);
    return { ok: true };
  }

  function canUsePower(state, p) {
    p = p || you(state);
    const law = LAW[p.law];
    if (!law.active) return fail('Cette loi agit seule.');
    if (state.phase !== 'shop' || !p.alive) return fail('Le marché est fermé.');
    if (p.powerUsed) return fail('Déjà utilisé ce cycle.');
    if (p.gold < law.active.cost) return fail('Il faut ' + law.active.cost + ' énergie.');
    if (p.discover.length) return fail('Choisissez d’abord votre découverte.');
    return { ok: true };
  }

  function usePower(state, targetUid, p) {
    p = p || you(state);
    const check = canUsePower(state, p);
    if (!check.ok) return check;
    const law = LAW[p.law];
    const x = shopCtx(state, p);
    if (p.law === 'renversement') {
      const t = p.board.find((u) => u.uid === targetUid);
      if (!t) return fail('Choisissez un astre de votre système.');
      if (t.atk <= 0) return fail('Cet astre n’a pas d’Attaque à inverser.');
      x.swap(t);
      x.buff(t, 1, 1);
    } else if (p.law === 'ingenierie') {
      if (p.hand.length >= HAND_MAX) return fail('Votre main est pleine.');
      const u = makeUnit(state, 'sonde-t');
      p.hand.push(u);
      x.events.push({ t: 'gain', uid: u.uid });
    }
    p.gold -= law.active.cost;
    p.powerUsed = true;
    return { ok: true, events: x.events };
  }

  function openDiscover(state, p, tier) {
    const rng = rngFor(state, 'discover:' + p.id);
    p.discover = [];
    for (let t = tier; t >= 1 && p.discover.length < 3; t--) {
      while (p.discover.length < 3) {
        const avail = Object.keys(state.pool).filter((id) => CARD[id].tier === t && state.pool[id] > 0 && !p.discover.includes(id));
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
    else if (p.board.length < BOARD_MAX) { p.board.push(u); where = 'board'; }
    else { state.pool[chosen]++; return { ok: true, lost: true }; }
    const triple = checkTriple(state, p, chosen);
    return { ok: true, uid: u.uid, where, triple: triple ? triple.uid : null, merged: triple ? triple.merged : null };
  }

  // ─── Début et fin de cycle ──────────────────────────────────
  function startTurn(state, p) {
    p.gold = Math.min(MAX_GOLD, state.round + 2);
    p.discount += 1;
    p.powerUsed = false;
    const x = shopCtx(state, p);
    for (const u of p.board.slice()) hook(u, 'startTurn', x);
    if (p.frozen) { p.frozen = false; refillShop(state, p); }
    else rollShop(state, p);
    return x.events;
  }

  function endTurnEffects(state, p) {
    const x = shopCtx(state, p);
    for (const u of p.board.slice()) hook(u, 'endTurn', x);
    if (p.law === 'symbiose' && p.board.length) {
      const weak = p.board.slice().sort((a, b) => a.atk + a.hp - (b.atk + b.hp))[0];
      x.events.push({ t: 'law' });
      x.buff(weak, famOf(weak) === 'vie' ? 1 : 0, 1);
    }
    if (p.law === 'gravite') {
      const walls = p.board.filter((u) => u.kw.includes('rempart'));
      if (walls.length) x.events.push({ t: 'law' });
      for (const u of walls) x.buff(u, 0, 2);
    }
    return x.events;
  }

  // ─── Combat ─────────────────────────────────────────────────
  // a, b : { id, name, tier, law, board } (joueurs ou fantôme). Les bonus
  // « définitifs » s'appliquent aux astres de a.board / b.board.
  function fight(state, a, b, tag, keepLog) {
    const rng = rngFor(state, 'fight:' + tag);
    const players = [a, b];
    let cidc = 1;
    const ev = [];
    const log = (e) => { if (keepLog) ev.push(e); };
    const toCombat = (u, side) => ({
      cid: 'c' + cidc++, ref: u.uid, id: u.id, golden: !!u.golden, m: u.golden ? 2 : 1,
      atk: u.atk, hp: u.hp, maxHp: u.hp, kw: u.kw.slice(), side,
      dead: false, attacked: false, rebornUsed: false, killer: null
    });
    const sides = [a.board.map((u) => toCombat(u, 0)), b.board.map((u) => toCombat(u, 1))];
    const alive = (s) => sides[s].filter((u) => !u.dead && u.hp > 0);
    const snap = (u) => ({ cid: u.cid, id: u.id, golden: u.golden, atk: u.atk, hp: u.hp, maxHp: u.maxHp, kw: u.kw.slice() });
    const snapAll = () => [sides[0].filter((u) => !u.dead).map(snap), sides[1].filter((u) => !u.dead).map(snap)];
    const pendingBreak = [], pendingHurt = [];
    const countOf = (s, id) => alive(s).filter((u) => u.id === id).reduce((n, u) => n + u.m, 0);

    const c = {
      rnd: (list) => (list && list.length ? list[Math.floor(rng() * list.length)] : null),
      allies: (s) => alive(s),
      sideList: (s) => sides[s].filter((u) => !u.dead),
      alliesFam: (s, f) => alive(s).filter((u) => famOf(u) === f),
      ranked: (s) => alive(s).slice().sort((x, y) => y.atk - x.atk || y.hp - x.hp),
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
      summon(s, id, index, mult, o) {
        o = o || {};
        if (sides[s].filter((u) => !u.dead).length >= BOARD_MAX) return null;
        const card = CARD[id];
        const k = (o.golden ? 2 : 1) * (mult || 1);
        const u = {
          cid: 'c' + cidc++, ref: o.ref || null, id, golden: !!o.golden, m: o.golden ? 2 : 1,
          atk: card.atk * k, hp: o.reborn ? 1 : card.hp * k, maxHp: o.reborn ? 1 : card.hp * k,
          kw: (card.kw || []).filter((kk) => !(o.reborn && kk === 'renaissance')), side: s,
          dead: false, attacked: false, rebornUsed: !!o.reborn, killer: null
        };
        const list = sides[s];
        let pos = 0, seen = 0;
        while (pos < list.length && seen < index) { if (!list[pos].dead) seen++; pos++; }
        list.splice(pos, 0, u);
        log({ t: 'summon', side: s, index: list.filter((v) => !v.dead).indexOf(u), unit: snap(u), reborn: !!o.reborn });
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
            if (typeof card.death === 'function') {
              const times = 1 + countOf(s, 'linceul');
              for (let k = 0; k < times; k++) { log({ t: 'fx', cid: u.cid }); card.death(c, u, u.m, idx); }
            }
            for (const v of alive(s)) fire(v, 'allyDeath', u);
            if (players[s].law === 'entropie') for (const v of alive(s)) c.buff(v, 1, 0);
            const k = u.killer;
            if (k && !k.dead && k.hp > 0) for (const v of alive(k.side)) fire(v, 'allyKill', k, u);
            if (u.kw.includes('renaissance') && !u.rebornUsed) {
              const r = c.summon(s, u.id, idx, 1, { reborn: true, golden: u.golden, ref: u.ref });
              if (r) {
                fire(r, 'reborn');
                for (const v of alive(s)) if (v !== r) fire(v, 'allyReborn', r);
              }
            }
          }
        }
        flush();
        if (!found) break;
      }
    }

    function attackOnce(att) {
      const enemies = alive(1 - att.side);
      if (!enemies.length) return;
      const walls = enemies.filter((u) => u.kw.includes('rempart'));
      const t = c.rnd(walls.length ? walls : enemies);
      log({ t: 'attack', cid: att.cid, target: t.cid });
      const da = att.atk, dt = t.atk;
      hit(t, da, att, 'attack');
      hit(att, dt, t, 'attack');
      flush();
      fire(att, 'attack', t);
      for (const v of alive(att.side)) fire(v, 'allyAttack', att, t);
      if (players[att.side].law === 'vents' && !att.dead) c.buff(att, 1, 0);
      flush();
      resolveDeaths();
    }

    function nextAttacker(s) {
      const able = alive(s).filter((u) => u.atk > 0);
      if (!able.length) return null;
      let cand = able.find((u) => !u.attacked);
      if (!cand) {
        for (const u of alive(s)) u.attacked = false;
        cand = able[0];
      }
      return cand;
    }

    log({ t: 'start', boards: snapAll() });
    let turn = sides[0].length > sides[1].length ? 0 : sides[1].length > sides[0].length ? 1 : rng() < 0.5 ? 0 : 1;
    log({ t: 'first', side: turn });
    for (const s of [turn, 1 - turn]) {
      const p = players[s], first = alive(s)[0];
      if (p.law === 'combustion') { log({ t: 'law', side: s, law: p.law }); const t = c.rnd(alive(1 - s)); if (t) hit(t, 3 + countOf(s, 'tison'), null, 'effect'); }
      if (p.law === 'stase' && first) { log({ t: 'law', side: s, law: p.law }); for (const u of alive(s).slice(0, 2)) c.kw(u, 'bouclier'); }
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
  function cardValue(p, id) {
    const c = CARD[id];
    let v = c.atk + c.hp + c.tier * 3.2 + (c.kw ? c.kw.length * 1.5 : 0);
    if (c.fam === p.pref) v += 6;
    if (c.sun && p.board.concat(p.hand).some((u) => famOf(u) === 'vie')) v += 4;
    v += ownedCopies(p, id).length * 7;
    return v;
  }

  function unitValue(p, u) {
    const c = cardOf(u);
    return u.atk + u.hp + c.tier * 3.2 + (c.fam === p.pref ? 6 : 0) + (u.golden ? 8 : 0) + u.kw.length * 1.5;
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

  function botTurn(state, p) {
    const rng = rngFor(state, 'bot:' + p.id);
    botDeploy(state, p);
    const want = Math.min(6, 1 + Math.floor((state.round + p.greed) / 2));
    if (p.tier < want && p.gold >= upgradeCost(p) && (state.round >= 3 || upgradeCost(p) <= p.gold - BUY_COST || p.gold >= 5)) upgrade(state, p);
    if (p.law === 'ingenierie' && p.gold >= 1 && p.gold % 3 === 1) usePower(state, null, p);
    if (p.law === 'renversement') {
      const t = p.board.filter((u) => u.atk > 0 && u.hp > u.atk && !u.kw.includes('rempart')).sort((a, b) => b.hp - b.atk - (a.hp - a.atk))[0];
      if (t) usePower(state, t.uid, p);
    }
    let rolls = 0;
    for (let guard = 0; guard < 25; guard++) {
      botDeploy(state, p);
      if (p.gold < BUY_COST) break;
      const opts = p.shop.map((id, i) => (id ? { i, id, v: cardValue(p, id) + rng() * 2 } : null)).filter(Boolean).sort((a, b) => b.v - a.v);
      const best = opts[0];
      const full = p.board.length >= BOARD_MAX;
      const weak = full ? p.board.slice().sort((a, b) => unitValue(p, a) - unitValue(p, b))[0] : null;
      const bar = full ? unitValue(p, weak) + 3 : 0;
      if (!best || best.v < bar || !canBuy(state, best.i, p).ok) {
        if (p.gold >= BUY_COST + ROLL_COST && rolls < 3) { roll(state, p); rolls++; continue; }
        break;
      }
      buy(state, best.i, p);
    }
    botDeploy(state, p);
    if (p.gold >= 1 && p.tier < 6 && p.gold >= upgradeCost(p)) upgrade(state, p);
  }

  // ─── Fin de cycle : combats, dégâts, éliminations ───────────
  function endTurn(state) {
    const me = you(state);
    if (state.phase !== 'shop' || state.over) return fail('Le combat est déjà lancé.');
    if (me.discover.length) return fail('Choisissez d’abord votre découverte.');
    const players = alivePlayers(state);
    for (const p of players) if (p.bot) botTurn(state, p);
    const myEndEvents = endTurnEffects(state, me);
    for (const p of players) if (p.bot) endTurnEffects(state, p);

    const rng = rngFor(state, 'pairs:' + state.round);
    const cap = players.length > 3 ? DAMAGE_CAP : Infinity;
    let pool = players.slice();
    const pairs = [];
    if (me.alive) {
      const others = pool.filter((p) => p !== me);
      const fresh = others.filter((p) => p.id !== me.lastOpp);
      const opp = (fresh.length ? fresh : others)[Math.floor(rng() * (fresh.length ? fresh : others).length)];
      if (opp) { pairs.push([me, opp]); pool = pool.filter((p) => p !== me && p !== opp); }
    }
    shuffle(pool, rng);
    while (pool.length >= 2) pairs.push([pool.pop(), pool.pop()]);
    if (pool.length === 1 && state.ghost) pairs.push([pool.pop(), state.ghost]);

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
      state.ghost = { id: 'ghost', name: p.name, law: p.law, tier: p.tier, board: JSON.parse(JSON.stringify(p.board)), ghost: true };
      p.hand = [];
    }
    const still = alivePlayers(state);
    state.history.push({ round: state.round, results, fallen: fallen.map((p) => p.id) });

    let over = false;
    if (!me.alive) over = true;
    else if (still.length <= 1) { me.rank = 1; over = true; }
    if (over) {
      state.over = true;
      state.phase = 'over';
      state.rank = me.rank;
      state.reward = REWARDS[me.rank] || 0;
      return { ok: true, battle, results, fallen: fallen.map((p) => p.id), endEvents: myEndEvents, over: true, rank: me.rank, reward: state.reward };
    }

    state.round++;
    let startEvents = [];
    for (const p of still) {
      const evs = startTurn(state, p);
      if (p === me) startEvents = evs;
    }
    return { ok: true, battle, results, fallen: fallen.map((p) => p.id), endEvents: myEndEvents, startEvents, over: false };
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
    START_HP, MAX_GOLD, BUY_COST, ROLL_COST, HAND_MAX, BOARD_MAX, COPIES, SHOP_SIZE, UPGRADE, DAMAGE_CAP, REWARDS,
    FAMILIES, FAMILY_KEYS, KEYWORDS, CARDS, CARD, LAWS, LAW,
    cardOf, famOf, cardText, upgradeCost, lawChoices, newGame, alivePlayers,
    buy, canBuy, play, canMagnet, sell, roll, freeze, upgrade, reorder, usePower, canUsePower, choose, endTurn,
    fight, poolAudit, copiesOf, botTurn, botDeploy
  };
});
