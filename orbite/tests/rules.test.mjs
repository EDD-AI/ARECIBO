import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../js/rules.js');

function invariant(s) {
  assert.deepEqual(R.poolAudit(s), s.poolTotal, 'la réserve partagée doit être conservée');
  const uids = new Set();
  for (const n of Object.values(s.pool)) assert.ok(n >= 0, 'stock négatif');
  for (const p of s.players) {
    if (!p.alive) continue;
    assert.ok(p.board.length <= R.BOARD_MAX, 'système trop grand');
    assert.ok(p.board.filter((u) => u.row !== 1).length <= R.ROW_MAX && p.board.filter((u) => u.row === 1).length <= R.ROW_MAX, 'rangée trop grande');
    assert.ok(p.hand.length <= R.HAND_MAX, 'main trop grande');
    assert.ok(p.gold >= 0, 'énergie négative');
    for (const u of p.board.concat(p.hand)) {
      assert.ok(!uids.has(u.uid), 'identifiant dupliqué');
      uids.add(u.uid);
      assert.ok(u.hp > 0, 'astre sans PV dans le système');
    }
  }
}

// Place un astre précis dans la vitrine en respectant la réserve.
function offer(s, id, slot = 0, p = s.players[0]) {
  if (p.shop[slot]) s.pool[p.shop[slot]]++;
  assert.ok(s.pool[id] > 0, 'plus de copie de ' + id);
  s.pool[id]--;
  p.shop[slot] = id;
}

function gameWith(fam, seed = 'test') {
  const law = R.LAWS.find((l) => l.fam === fam);
  return R.newGame(seed, law.id);
}

test('nouvelle partie : 8 univers, 5 familles dont celle de la loi, réserve cohérente', () => {
  const s = gameWith('vie', 'a1');
  assert.equal(s.players.length, 8);
  assert.equal(s.families.length, 5);
  assert.ok(s.families.includes('vie'));
  for (const id of Object.keys(s.pool)) {
    const c = R.CARD[id];
    if (c.legend) { assert.equal(s.poolTotal[id], 1); continue; }
    assert.ok(c.fam === 'neutre' || s.families.includes(c.fam));
    assert.equal(s.poolTotal[id], R.COPIES[c.tier]);
  }
  assert.equal(s.players[0].board[0].id, 'aube');
  assert.equal(s.players[0].gold, 3);
  assert.equal(s.players[0].shop.length, 3);
  invariant(s);
});

test('chaque famille a 9 astres répartis sur les 6 niveaux', () => {
  for (const f of R.FAMILY_KEYS) {
    const cards = R.CARDS.filter((c) => c.fam === f && !c.token && !c.legend);
    assert.equal(cards.length, 9, f);
    assert.deepEqual([...new Set(cards.map((c) => c.tier))].sort(), [1, 2, 3, 4, 5, 6]);
  }
  for (const l of R.LAWS) assert.equal(R.CARD[l.starter].tier, 1);
});

test('acheter, placer, vendre : énergie et réserve', () => {
  const s = gameWith('mineral', 'a2');
  const p = s.players[0];
  p.gold = 10;
  offer(s, 'errante');
  const b = R.buy(s, 0);
  assert.equal(b.ok, true);
  assert.equal(p.gold, 7);
  assert.equal(p.hand.length, 1);
  assert.equal(R.play(s, b.uid, 0).ok, true);
  assert.equal(p.board[0].id, 'errante');
  assert.equal(R.sell(s, b.uid).ok, true);
  assert.equal(p.gold, 8);
  invariant(s);
});

test('trois exemplaires fusionnent en un astre doré qui ouvre une découverte', () => {
  const s = gameWith('glace', 'a3');
  const p = s.players[0];
  p.gold = 30;
  for (let i = 0; i < 3; i++) {
    offer(s, 'givre');
    const r = R.buy(s, 0);
    assert.equal(r.ok, true);
    if (i < 2) assert.equal(R.play(s, r.uid, p.board.length).ok, true);
    else assert.ok(r.triple, 'la troisième copie déclenche la fusion');
  }
  const gold = p.hand.find((u) => u.golden);
  assert.ok(gold);
  assert.equal(gold.atk, 4);
  assert.equal(p.board.filter((u) => u.id === 'givre').length, 0);
  const played = R.play(s, gold.uid, 0);
  assert.equal(played.discover, true);
  assert.equal(p.discover.length, 3);
  for (const id of p.discover) assert.equal(R.CARD[id].tier, 2);
  invariant(s);
  assert.equal(R.choose(s, 1).ok, true);
  assert.equal(p.discover.length, 0);
  invariant(s);
});

test('geler : les astres restants sont gardés et les places vides complétées', () => {
  const s = gameWith('vie', 'freeze');
  const p = s.players[0];
  p.gold = 10;
  const kept = p.shop[1];
  assert.equal(R.buy(s, 0).ok, true);
  assert.equal(R.freeze(s).frozen, true);
  R.botTurn(s, p);
  p.frozen = true;
  const r = R.endTurn(s);
  assert.equal(r.ok, true);
  if (!r.over) {
    assert.equal(p.shop.length, R.SHOP_SIZE[p.tier]);
    assert.ok(p.shop.includes(kept) || p.board.concat(p.hand).some((u) => u.id === kept), 'l’astre gelé reste disponible');
    assert.equal(p.frozen, false);
  }
  invariant(s);
});

test('Arrimage : une Sonde se pose sur une Machine', () => {
  const s = gameWith('machine', 'a4');
  const p = s.players[0];
  p.gold = 20;
  offer(s, 'relais');
  const host = R.buy(s, 0);
  R.play(s, host.uid, 1);
  offer(s, 'station');
  const st = R.buy(s, 0);
  const before = p.board.length;
  const r = R.play(s, st.uid, null, host.uid);
  assert.equal(r.ok, true);
  assert.equal(p.board.length, before);
  const h = p.board.find((u) => u.uid === host.uid);
  assert.equal(h.atk, R.CARD.relais.atk + R.CARD.station.atk);
  assert.ok(h.kw.includes('bouclier'));
  invariant(s);
  assert.equal(R.sell(s, host.uid).ok, true);
  invariant(s);
});

test('mots-clés en combat : Bouclier, Venin, Renaissance, Rempart', () => {
  const s = gameWith('envers', 'a5');
  const mk = (id, extra = {}) => Object.assign({ uid: 'x' + Math.random(), id, golden: false, atk: R.CARD[id].atk, hp: R.CARD[id].hp, kw: (R.CARD[id].kw || []).slice(), att: [] }, extra);
  const A = { id: 'A', tier: 1, law: 'symbiose', board: [mk('spore')] };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [mk('colosse')] };
  const r1 = R.fight(s, A, B, 'venin', true);
  assert.ok(r1.events.some((e) => e.t === 'venom'), 'le Venin détruit le Colosse');

  const C = { id: 'C', tier: 1, law: 'symbiose', board: [mk('nive', { atk: 1, hp: 1 })] };
  const D = { id: 'D', tier: 1, law: 'symbiose', board: [mk('errante', { atk: 5, hp: 1 })] };
  const r2 = R.fight(s, C, D, 'shield', true);
  assert.ok(r2.events.some((e) => e.t === 'break'), 'le Bouclier absorbe le premier coup');

  const E = { id: 'E', tier: 1, law: 'symbiose', board: [mk('reflet')] };
  const F = { id: 'F', tier: 1, law: 'symbiose', board: [mk('silex', { atk: 1, hp: 30 })] };
  const r3 = R.fight(s, E, F, 'reborn', true);
  assert.ok(r3.events.some((e) => e.t === 'summon' && e.reborn), 'Renaissance ramène le Reflet');

  const G = { id: 'G', tier: 1, law: 'symbiose', board: [mk('errante', { atk: 1, hp: 50 })] };
  const H = { id: 'H', tier: 1, law: 'symbiose', board: [mk('errante', { atk: 0, hp: 50 }), mk('silex', { atk: 0, hp: 50 })] };
  const r4 = R.fight(s, G, H, 'taunt', true);
  const wallCid = r4.events[0].boards[1][1].cid;
  const wallDeath = r4.events.findIndex((e) => e.t === 'die' && e.cid === wallCid);
  const early = r4.events.slice(0, wallDeath < 0 ? undefined : wallDeath).filter((e) => e.t === 'attack');
  assert.ok(early.length > 0);
  for (const a of early) assert.equal(a.target, wallCid, 'le Rempart est visé tant qu’il tient');
});

test('dégâts : niveau du gagnant + niveaux des survivants, plafonnés à 10 tant que plus de 3 univers', () => {
  const s = gameWith('tempete', 'a6');
  const big = (id) => ({ uid: 'b' + Math.random(), id, golden: false, atk: 50, hp: 50, kw: [], att: [] });
  const me = s.players[0];
  me.tier = 6;
  me.board = [big('tempest'), big('ouragan'), big('titan'), big('tempest')];
  for (const p of s.players.slice(1)) { p.board = []; p.hand = []; }
  const r = R.endTurn(s);
  assert.equal(r.ok, true);
  assert.equal(r.battle.winner, 0);
  assert.equal(r.battle.damage, 10);
  assert.equal(r.battle.cap, 10);
});

test('combat déterministe pour une même graine', () => {
  const a = gameWith('brasier', 'same');
  const b = gameWith('brasier', 'same');
  for (let round = 0; round < 6; round++) {
    R.botTurn(a, a.players[0]);
    R.botTurn(b, b.players[0]);
    const ra = R.endTurn(a), rb = R.endTurn(b);
    assert.deepEqual(ra.results, rb.results);
    if (ra.over) break;
  }
});

test('parties complètes contre 7 bots : invariants, classement, poussières', () => {
  const ranks = new Map();
  let rounds = 0;
  for (let g = 0; g < 160; g++) {
    const law = R.LAWS[g % R.LAWS.length];
    const s = R.newGame('full-' + g, law.id);
    invariant(s);
    let result = null;
    for (let i = 0; i < 60 && !s.over; i++) {
      R.botTurn(s, s.players[0]);
      invariant(s);
      result = R.endTurn(s);
      assert.equal(result.ok, true);
      invariant(s);
      if (result.battle && result.battle.cap) assert.ok(result.battle.damage <= R.DAMAGE_CAP);
    }
    assert.equal(s.over, true, 'la partie se termine');
    assert.ok(s.rank >= 1 && s.rank <= 8);
    assert.equal(s.reward, R.REWARDS[s.rank] || 0);
    ranks.set(s.rank, (ranks.get(s.rank) || 0) + 1);
    rounds += s.round;
    const placed = s.players.filter((p) => p.rank != null).map((p) => p.rank);
    assert.equal(new Set(placed).size, placed.length, 'rangs distincts');
  }
  const avg = rounds / 160;
  assert.ok(avg > 6 && avg < 30, 'durée moyenne raisonnable : ' + avg.toFixed(1));
  assert.ok(ranks.size >= 5, 'le joueur-bot finit à des places variées');
});

test('textes : nombres doublés pour les dorés, pas de marqueur restant', () => {
  for (const c of R.CARDS) {
    for (const g of [false, true]) {
      const t = R.cardText(c.id, g);
      assert.ok(!/[{}]/.test(t), c.id);
    }
  }
  assert.equal(R.cardText('gaia', true), 'Habitable : fin de cycle, avec un Soleil, gagne +2/+2.');
});

const unit = (id, extra = {}) => Object.assign({ uid: 'x' + Math.random(), id, golden: false, atk: R.CARD[id].atk, hp: R.CARD[id].hp, kw: (R.CARD[id].kw || []).slice(), att: [] }, extra);

test('formations : deux astres d’une famille dans une rangée, niveau = nombre − 1', () => {
  const board = [unit('silex', { row: 0 }), unit('agate', { row: 0 }), unit('basalte', { row: 0 }), unit('nive', { row: 1 }), unit('givre', { row: 1 }), unit('errante', { row: 1 })];
  assert.deepEqual(R.formationsOf(board), [
    { fam: 'mineral', row: 0, n: 3, lvl: 2 },
    { fam: 'glace', row: 1, n: 2, lvl: 1 }
  ]);
  assert.deepEqual(R.formationsOf(board.slice(0, 1).concat(board.slice(3, 4))), [], 'un seul astre par famille : pas de formation');
  for (const f of R.FAMILY_KEYS) for (const row of [0, 1]) assert.ok(!/[{}]/.test(R.formText(f, row, 2)), f + row);
  // Au combat : la formation de Glace à l'arrière retire 1 Attaque aux ennemis de l'avant.
  const s = gameWith('envers', 'fo1');
  const A = { id: 'A', tier: 1, law: 'symbiose', board };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 4, hp: 30 }), unit('errante', { atk: 4, hp: 30 })] };
  const r = R.fight(s, A, B, 'formations', true);
  const forms = r.events.filter((e) => e.t === 'formation' && e.side === 0).map((e) => e.fam + ':' + e.row + ':' + e.lvl);
  assert.deepEqual(forms.sort(), ['glace:1:1', 'mineral:0:2']);
  const enemies = r.events[0].boards[1].map((u) => u.cid);
  for (const cid of enemies) assert.ok(r.events.some((e) => e.t === 'buff' && e.cid === cid && e.a === -2), 'gel de l’ennemi ' + cid);
});

test('placement : seul l’avant attaque ; l’arrière, à l’abri, avance quand l’avant tombe', () => {
  const s = gameWith('envers', 'pl1');
  const A = { id: 'A', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 1, hp: 2, row: 0 }), unit('errante', { atk: 9, hp: 40, row: 1 })] };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 3, hp: 40, row: 0 })] };
  const r = R.fight(s, A, B, 'rows', true);
  const [front, back] = r.events[0].boards[0].map((u) => u.cid);
  const adv = r.events.findIndex((e) => e.t === 'advance' && e.side === 0);
  assert.ok(adv > 0, 'l’arrière avance');
  const before = r.events.slice(0, adv);
  assert.ok(!before.some((e) => e.t === 'attack' && (e.cid === back || e.target === back)), 'avant l’avance, l’arrière n’attaque pas et n’est pas visé');
  assert.ok(before.some((e) => e.t === 'attack' && e.cid === front));
  assert.ok(r.events.slice(adv).some((e) => e.t === 'attack' && e.cid === back), 'puis il combat');
  assert.equal(r.winner, 0);
});

test('ciblage : chaque astre de l’avant frappe l’ennemi en face de lui', () => {
  const s = gameWith('envers', 'pl2');
  const A = { id: 'A', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 1, hp: 90 }), unit('errante', { atk: 1, hp: 90 })] };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 1, hp: 90 }), unit('errante', { atk: 1, hp: 90 })] };
  const r = R.fight(s, A, B, 'facing', true);
  const [a0, a1] = r.events[0].boards[0].map((u) => u.cid), [b0, b1] = r.events[0].boards[1].map((u) => u.cid);
  const attacks = r.events.filter((e) => e.t === 'attack');
  assert.ok(attacks.length > 8);
  for (const e of attacks) {
    if (e.cid === a0) assert.equal(e.target, b0);
    if (e.cid === a1) assert.equal(e.target, b1);
    if (e.cid === b0) assert.equal(e.target, a0);
  }
});

test('rangées : 4 places chacune, placement choisi, échange quand la rangée visée est pleine', () => {
  const s = gameWith('mineral', 'pl3');
  const p = s.players[0];
  p.board = [];
  for (let i = 0; i < 6; i++) p.hand.push(unit(i < 4 ? 'errante' : 'silex', { uid: 'h' + i }));
  for (let i = 0; i < 4; i++) assert.equal(R.play(s, 'h' + i, null, null, p).row, 0);
  assert.equal(R.play(s, 'h4', null, null, p).row, 1, 'avant complet : l’astre passe à l’arrière');
  assert.equal(R.play(s, 'h5', 0, null, p, 0).ok, false, 'l’avant est complet');
  assert.equal(R.play(s, 'h5', 0, null, p, 1).ok, true);
  assert.deepEqual(p.board.map((u) => u.row), [0, 0, 0, 0, 1, 1]);
  assert.equal(p.board[4].uid, 'h5', 'placé en tête de l’arrière');
  const r = R.move(s, 'h5', 0, 1, p);
  assert.equal(r.ok, true);
  assert.equal(r.swapped, 'h1', 'l’astre de l’avant prend la place libérée');
  assert.deepEqual(p.board.map((u) => u.uid), ['h0', 'h5', 'h2', 'h3', 'h1', 'h4']);
  assert.deepEqual(p.board.map((u) => u.row), [0, 0, 0, 0, 1, 1]);
  assert.equal(R.reorder(s, 'h3', 0, p).ok, true);
  assert.deepEqual(p.board.slice(0, 4).map((u) => u.uid), ['h3', 'h0', 'h5', 'h2']);
  // Une ancienne sauvegarde sans rangées : les astres au-delà de 4 passent à l'arrière.
  const [front, back] = R.layout([1, 2, 3, 4, 5, 6].map((i) => ({ id: 'errante', uid: 'o' + i })));
  assert.equal(front.length, 4);
  assert.equal(back.length, 2);
});

test('l’arrière : Portée tire sans riposte, Percée frappe l’arrière, Garde la bloque', () => {
  const s = gameWith('envers', 'pos1');
  // Portée : un astre de l'arrière attaque, et sa cible ne riposte pas.
  const A = { id: 'A', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 0, hp: 400, row: 0 }), unit('errante', { atk: 3, hp: 5, row: 1, kw: ['portee'] })] };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 9, hp: 60 })] };
  const r1 = R.fight(s, A, B, 'portee', true);
  const shooter = r1.events[0].boards[0][1].cid;
  const shots = r1.events.filter((e) => e.t === 'attack' && e.cid === shooter);
  assert.ok(shots.length > 0 && shots.every((e) => e.ranged), 'l’astre à Portée tire depuis l’arrière');
  assert.ok(!r1.events.some((e) => e.t === 'hit' && e.cid === shooter && e.kind === 'attack'), 'pas de riposte sur le tireur');
  // Percée : vise l'arrière ennemi…
  const C = { id: 'C', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 2, hp: 40, kw: ['percee'] })] };
  const D = { id: 'D', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 0, hp: 40, row: 0 }), unit('errante', { atk: 0, hp: 40, row: 1 })] };
  const r2 = R.fight(s, C, D, 'percee', true);
  const backCid = r2.events[0].boards[1][1].cid;
  assert.ok(r2.events.some((e) => e.t === 'attack' && e.target === backCid && e.pierce), 'la Percée frappe l’arrière');
  // … sauf si une Garde tient l'avant.
  const E = { id: 'E', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 0, hp: 40, row: 0, kw: ['garde'] }), unit('errante', { atk: 0, hp: 40, row: 1 })] };
  const r3 = R.fight(s, C, E, 'garde', true);
  const back3 = r3.events[0].boards[1][1].cid;
  const adv = r3.events.findIndex((e) => e.t === 'advance');
  assert.ok(!r3.events.slice(0, adv < 0 ? undefined : adv).some((e) => e.t === 'attack' && e.target === back3), 'la Garde protège l’arrière tant qu’elle tient');
  // Des astres du catalogue portent ces mots-clés.
  for (const k of ['portee', 'percee', 'garde']) assert.ok(R.POSITION_KW[k].every((id) => R.CARD[id].kw.includes(k)));
});

test('phénomènes : accrétion, trou noir, supernova selon qui est juste derrière qui', () => {
  const board = [unit('errante', { uid: 'f0', row: 0 }), unit('cendre', { uid: 'f1', row: 0 }), unit('silex', { uid: 'b0', row: 1 }), unit('umbra', { uid: 'b1', row: 1 })];
  const ph = R.phenomenaOf(board);
  assert.deepEqual(ph.map((p) => p.kind + ':' + p.uid + '<' + p.partner).sort(), ['accretion:f0<b0', 'trounoir:f1<b1']);
  assert.deepEqual(R.phenomenaOf([board[0], board[1], board[3], board[2]].map((u, i) => Object.assign({}, u, { row: i < 2 ? 0 : 1 }))).map((p) => p.kind).sort(), ['accretion'], 'l’ordre des colonnes compte');
  const s = gameWith('envers', 'ph1');
  const A = { id: 'A', tier: 1, law: 'symbiose', board };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 1, hp: 50 })] };
  const r = R.fight(s, A, B, 'phen', true);
  const kinds = r.events.filter((e) => e.t === 'phenom' && e.side === 0).map((e) => e.kind).sort();
  assert.deepEqual(kinds, ['accretion', 'trounoir']);
  const f0 = r.events[0].boards[0][0].cid;
  assert.ok(r.events.some((e) => e.t === 'buff' && e.cid === f0 && e.a === 2 && e.h === 5), 'l’astre grossit');
  // Supernova : deux Brasier en colonne ; l'astre de l'avant explose en s'effondrant.
  const C = { id: 'C', tier: 1, law: 'symbiose', board: [unit('scorie', { atk: 1, hp: 1, row: 0 }), unit('braise', { atk: 0, hp: 30, row: 1, kw: [] })] };
  const D = { id: 'D', tier: 1, law: 'symbiose', board: [unit('errante', { atk: 5, hp: 30 }), unit('errante', { atk: 5, hp: 30 })] };
  const r2 = R.fight(s, C, D, 'nova', true);
  assert.ok(r2.events.some((e) => e.t === 'phenom' && e.kind === 'explode'), 'la supernova explose');
  for (const t of Object.keys(R.PHENOMENA)) assert.ok(R.PHENOMENA[t].name && R.PHENOMENA[t].text);
});

test('duel : deux univers, PV doublés, une douzaine de manches, récompenses du duel', () => {
  let rounds = 0;
  const N = 24;
  for (let g = 0; g < N; g++) {
    const s = R.newGame('duel-' + g, R.LAWS[g % R.LAWS.length].id, { size: 2 });
    assert.equal(s.players.length, 2);
    assert.ok(R.isDuel(s));
    const law = R.LAW[s.players[0].law];
    assert.equal(s.players[0].hp, (law.hp || R.START_HP) * R.DUEL.hp);
    for (let i = 0; i < 60 && !s.over; i++) {
      R.botTurn(s, s.players[0]);
      invariant(s);
      const res = R.endTurn(s);
      assert.equal(res.ok, true);
      assert.ok(res.battle, 'un combat à chaque manche');
      assert.equal(res.battle.opponent.id, s.players[1].id);
      for (const p of s.players) if (p.alive) assert.deepEqual(p.seen.map((u) => u.uid), p.board.map((u) => u.uid));
    }
    assert.equal(s.over, true);
    assert.ok(s.rank === 1 || s.rank === 2);
    assert.equal(s.reward, R.DUEL.rewards[s.rank]);
    rounds += s.round;
  }
  const avg = rounds / N;
  assert.ok(avg >= 8 && avg <= 18, 'durée moyenne d’un duel : ' + avg.toFixed(1));
});

test('lois de vie : PV de départ, énergie du sacrifice, renaissance du phénix', () => {
  const e = R.newGame('vie-1', 'endurance');
  assert.equal(e.players[0].hp, 45);
  assert.ok(!e.families.includes('neutre') && e.families.length === new Set(e.families).size);
  assert.ok(e.players.slice(1).every((p) => R.LAW[p.law].fam !== 'neutre'), 'les bots gardent les lois de famille');

  const s = R.newGame('vie-2', 'sacrifice');
  assert.equal(s.players[0].hp, 22);
  assert.equal(s.players[0].gold, 3);
  R.endTurn(s);
  assert.equal(s.players[0].gold, Math.min(R.MAX_GOLD, s.round + 3));

  const f = R.newGame('vie-3', 'phenix');
  const me = f.players[0];
  assert.equal(me.hp, 25);
  me.board = [];
  me.hp = 1;
  let reborn = null;
  for (let i = 0; i < 5 && !reborn; i++) {
    const r = R.endTurn(f);
    if (me.reborn) reborn = r;
  }
  assert.ok(me.reborn && me.alive && me.hp === 15, 'renaît avec 15 PV au lieu d’être éliminé');
});

test('légendaires : une par niveau, un exemplaire, rares dans la Création et les découvertes', () => {
  const legends = R.CARDS.filter((c) => c.legend);
  assert.deepEqual(legends.map((c) => c.tier).sort(), [1, 2, 3, 4, 5, 6]);
  let seen = 0, slots = 0, disc = 0, discN = 0;
  for (let g = 0; g < 300; g++) {
    const s = R.newGame('leg-' + g, R.LAWS[g % R.LAWS.length].id);
    for (const l of legends) assert.equal(s.poolTotal[l.id], 1);
    for (const p of s.players) { slots += p.shop.length; seen += p.shop.filter((id) => R.CARD[id].legend).length; }
    invariant(s);
  }
  const rate = seen / slots;
  assert.ok(rate > 0.003 && rate < 0.06, 'taux en Création : ' + rate.toFixed(3));
  // Ouroboros renaît plus fort, avec Venin.
  const s = R.newGame('leg-ouro', 'symbiose');
  const mk = (id, extra = {}) => Object.assign({ uid: 'x' + Math.random(), id, golden: false, atk: R.CARD[id].atk, hp: R.CARD[id].hp, kw: (R.CARD[id].kw || []).slice(), att: [] }, extra);
  const A = { id: 'A', tier: 1, law: 'symbiose', board: [mk('ouroboros')] };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [mk('silex', { atk: 9, hp: 40 })] };
  const r = R.fight(s, A, B, 'ouro', true);
  assert.ok(r.events.some((e) => e.t === 'kw' && e.k === 'venin'), 'Venin gagné à la renaissance');
  // L'Œil du Vide anéantit l'ennemi le plus faible dès le début du combat.
  const C = { id: 'C', tier: 1, law: 'symbiose', board: [mk('oeilvide')] };
  const D = { id: 'D', tier: 1, law: 'symbiose', board: [mk('silex', { atk: 1, hp: 50 }), mk('errante', { atk: 1, hp: 60 })] };
  const r2 = R.fight(s, C, D, 'oeil', true);
  assert.ok(r2.events.some((e) => e.t === 'hit' && e.n >= 99), 'coup de 99');
});
