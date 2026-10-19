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
    const cards = R.CARDS.filter((c) => c.fam === f && !c.token);
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

test('Alliance : deux familles de 3 astres gagnent +1/+1 au début du combat', () => {
  const s = gameWith('envers', 'al1');
  const mk = (id) => ({ uid: 'x' + Math.random(), id, golden: false, atk: R.CARD[id].atk, hp: R.CARD[id].hp, kw: (R.CARD[id].kw || []).slice(), att: [] });
  const duo = [mk('silex'), mk('agate'), mk('basalte'), mk('nive'), mk('givre'), mk('boreale'), mk('errante')];
  assert.deepEqual(R.allianceOf(duo).slice().sort(), ['glace', 'mineral']);
  assert.equal(R.allianceOf(duo.slice(0, 5)), null, 'il faut 3 astres de chaque famille');
  const A = { id: 'A', tier: 1, law: 'symbiose', board: duo };
  const B = { id: 'B', tier: 1, law: 'symbiose', board: [mk('errante')] };
  const r = R.fight(s, A, B, 'alliance', true);
  const al = r.events.find((e) => e.t === 'alliance');
  assert.ok(al && al.side === 0, 'Alliance annoncée pour le premier système');
  const i = r.events.indexOf(al);
  const buffs = r.events.slice(i + 1, i + 7).filter((e) => e.t === 'buff' && e.a === R.ALLIANCE.atk && e.h === R.ALLIANCE.hp);
  assert.equal(buffs.length, 6, 'les six astres alliés sont renforcés, pas le neutre');
});
