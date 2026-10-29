// Événements cosmiques, reliques et éveil des lois (v84) : node --test orbite/tests/contenu.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../js/rules.js');

function invariant(s) {
  assert.deepEqual(R.poolAudit(s), s.poolTotal, 'la réserve partagée doit être conservée');
  for (const n of Object.values(s.pool)) assert.ok(n >= 0, 'stock négatif');
  for (const p of s.players) if (p.alive) assert.ok(p.gold >= 0, 'énergie négative');
}
function offer(s, id, slot = 0, p = s.players[0]) {
  if (p.shop[slot]) s.pool[p.shop[slot]]++;
  s.pool[id]--;
  p.shop[slot] = id;
}
// Joue des cycles entiers : le joueur local joue comme un bot.
function playRounds(s, n) {
  const out = [];
  for (let i = 0; i < n && !s.over; i++) {
    R.botTurn(s, s.players[0]);
    const res = R.endTurn(s);
    assert.ok(res.ok, res.reason);
    out.push(res);
  }
  return out;
}
const t1 = (s) => Object.keys(s.pool).find((id) => R.CARD[id].tier === 1 && !R.CARD[id].legend && s.pool[id] > 0);

test('événements : tirés de la graine, les mêmes pour tous, absents sans demande', () => {
  assert.equal(R.EVENTS.length, 11);
  assert.equal(new Set(R.EVENTS.map((e) => e.id)).size, R.EVENTS.length);
  assert.equal(R.eventFor('ABC'), R.eventFor('ABC'));
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(R.eventFor('S' + i));
  assert.equal(seen.size, R.EVENTS.length, 'chaque événement peut sortir');
  assert.equal(R.newGame('X', 'symbiose').event, null);
  assert.equal(R.newGame('X', 'symbiose', { event: 'auto' }).event, R.eventFor('X'));
  assert.equal(R.newGame('X', 'symbiose', { event: 'vent' }).event, 'vent');
  assert.equal(R.newGame('X', 'symbiose', { event: 'inconnu' }).event, null);
});

test('événements de création : météores, abondance, Création féconde, recyclage, expansion, révélation', () => {
  let s = R.newGame('ev1', 'symbiose', { size: 2, event: 'meteores' });
  const id = t1(s);
  offer(s, id);
  const res = R.buy(s, 0);
  const u = s.players[0].hand.find((x) => x.uid === res.uid);
  assert.equal(u.atk, R.CARD[id].atk + 1);
  assert.equal(u.hp, R.CARD[id].hp + 1);

  s = R.newGame('ev2', 'symbiose', { size: 2, event: 'abondance' });
  assert.equal(s.players[0].gold, 4, 'premier cycle : 3 + 1');
  playRounds(s, 1);
  assert.equal(s.players[0].gold, 5, 'deuxième cycle : 4 + 1');

  s = R.newGame('ev3', 'symbiose', { size: 2, event: 'feconde' });
  assert.equal(s.players[0].shop.length, R.SHOP_SIZE[1] + 1);

  s = R.newGame('ev4', 'symbiose', { size: 2, event: 'recyclage' });
  const p = s.players[0], g = p.gold;
  assert.ok(R.sell(s, p.board[0].uid).ok);
  assert.equal(p.gold, g + 2);

  s = R.newGame('ev5', 'symbiose', { size: 2, event: 'expansion' });
  assert.equal(R.upgradeCost(s.players[0], s), R.UPGRADE[1] - 1);

  s = R.newGame('ev6', 'symbiose', { size: 2, event: 'revelation' });
  const q = s.players[0];
  const gid = t1(s);
  for (let k = 0; k < 3; k++) { q.gold = 10; offer(s, gid, 0); R.buy(s, 0); }
  const gold = q.hand.find((x) => x.golden);
  assert.ok(gold, 'trio doré');
  R.play(s, gold.uid, 0);
  assert.equal(q.discover.length, 4, 'quatre découvertes');
  R.choose(s, 0);
  invariant(s);
});

test('événements de combat : Vent solaire, Aurore et Instabilité agissent au début du combat', () => {
  const mk = (id) => ({ id, name: id, law: 'symbiose', tier: 1, board: [{ uid: 'a' + id, id: 'aube', golden: false, atk: 3, hp: 3, kw: [], att: [], row: 0 }] });
  for (const ev of ['vent', 'aurore', 'instable']) {
    const st = { seed: 'F', rc: 0, families: ['vie'], uidc: 1, pool: {}, event: ev };
    const r = R.fight(st, mk('A'), mk('B'), 't', true);
    assert.ok(r.events.some((e) => e.t === 'event' && e.id === ev), ev);
  }
  const st = { seed: 'F', rc: 0, families: ['vie'], uidc: 1, pool: {}, event: 'aurore' };
  const r = R.fight(st, mk('A'), mk('B'), 't', true);
  assert.ok(r.events.filter((e) => e.t === 'kw' && e.k === 'bouclier').length >= 2, 'un Bouclier de chaque côté');
});

test('reliques : trois proposées aux cycles 4 et 8, le combat attend le choix, les bots choisissent seuls', () => {
  const s = R.newGame('rel', 'symbiose', { size: 8 });
  playRounds(s, 3);
  assert.equal(s.round, 4);
  const me = s.players[0];
  assert.equal(me.relicChoice.length, 3);
  assert.equal(new Set(me.relicChoice).size, 3);
  for (const p of s.players.slice(1)) if (p.alive) { assert.equal(p.relics.length, 1); assert.equal(p.relicChoice.length, 0); }
  const end = R.endTurn(s);
  assert.equal(end.ok, false, 'pas de combat avant le choix');
  const pick = me.relicChoice[1];
  assert.ok(R.chooseRelic(s, 1).ok);
  assert.deepEqual(me.relics, [pick]);
  assert.equal(R.chooseRelic(s, 0).ok, false, 'un seul choix');
  playRounds(s, 4);
  if (!s.over && me.alive) {
    assert.equal(s.round, 8);
    assert.equal(me.relics.length, 1, 'en attente du second choix');
    R.botTurn(s, me);
    assert.equal(me.relics.length, 2);
    assert.notEqual(me.relics[0], me.relics[1], 'jamais deux fois la même');
  }
  invariant(s);
});

test('reliques : énergie, Création, vente, montée de niveau, et effets de combat', () => {
  const s = R.newGame('rel2', 'symbiose', { size: 2 });
  const p = s.players[0];
  p.relics = ['tresor', 'longuevue', 'comptoir', 'elan'];
  assert.equal(R.upgradeCost(p, s), R.UPGRADE[1] - 1);
  assert.equal(R.shopSize(s, p), R.SHOP_SIZE[1] + 1);
  assert.equal(R.sellGain(s, p), 2);
  playRounds(s, 1);
  assert.equal(p.gold, Math.min(R.MAX_GOLD, 4) + 1, 'Trésor : +1');
  const unit = (uid, o) => Object.assign({ uid, id: 'aube', golden: false, atk: 2, hp: 5, kw: [], att: [], row: 0 }, o || {});
  const fighter = (relics, board) => ({ id: 'x', name: 'x', law: 'symbiose', tier: 1, relics, board });
  const st = { seed: 'R', rc: 0, families: ['vie'], uidc: 1, pool: {} };
  for (const id of ['lance', 'egide', 'dard', 'braise', 'alchimie', 'bastion']) {
    const board = [unit('a', { golden: id === 'alchimie', kw: id === 'bastion' ? ['rempart'] : [] })];
    const r = R.fight(st, fighter([id], board), fighter([], [unit('b')]), 'r' + id, true);
    assert.ok(r.events.some((e) => e.t === 'relic' && e.id === id && e.side === 0), id);
  }
  const r = R.fight(st, fighter(['reserve'], [unit('a', { hp: 1, atk: 0 }), unit('c', { row: 1 })]), fighter([], [unit('b', { atk: 5 })]), 'res', true);
  assert.ok(r.events.some((e) => e.t === 'relic' && e.id === 'reserve'), 'Réserve quand l’arrière avance');
});

test('éveil : au cycle 6, chaque loi s’éveille ; passage, ingénierie et sacrifice changent', () => {
  for (const law of R.LAWS) assert.ok(typeof law.awake === 'string' && law.awake.length > 10, law.id);
  const s = R.newGame('awk', 'passage', { size: 2 });
  const res = playRounds(s, 5);
  if (s.over) return;
  assert.equal(s.round, 6);
  for (const p of s.players) if (p.alive) assert.ok(p.awake);
  assert.ok(res[res.length - 1].startEvents.some((e) => e.t === 'awake'), 'la scène d’éveil est annoncée');
  const p = s.players[0];
  p.gold = 5;
  assert.equal(R.rollCost(p), 0); R.roll(s);
  assert.equal(R.rollCost(p), 0, 'deux actualisations gratuites'); R.roll(s);
  assert.equal(R.rollCost(p), 1);
  assert.equal(p.gold, 5);
  const ing = { law: 'ingenierie', awake: true };
  assert.equal(R.powerCost(ing), 0);
  assert.equal(R.powerCost({ law: 'ingenierie', awake: false }), 1);
  // Sacrifice éveillé : 2 énergies de plus, même au maximum.
  const t = R.newGame('awk2', 'sacrifice', { size: 2 });
  playRounds(t, 12);
  if (!t.over && t.round >= 9) assert.equal(t.players[0].gold, R.MAX_GOLD + 1);
});

test('anciennes sauvegardes : sans reliques ni éveil ni événement, la partie continue', () => {
  const s = R.newGame('old', 'passage', { size: 2 });
  const old = JSON.parse(JSON.stringify(s));
  delete old.event;
  for (const p of old.players) { delete p.relics; delete p.relicChoice; delete p.awake; delete p.freeRolls; p.freeRoll = true; }
  assert.equal(R.rollCost(old.players[0]), 1, 'la gratuite déjà prise reste prise');
  playRounds(old, 8);
  invariant(old);
});

test('parties complètes avec chaque événement : réserve conservée, toujours une fin', () => {
  for (const ev of R.EVENTS) {
    for (const size of [2, 8]) {
      const s = R.newGame('full-' + ev.id + size, R.LAWS[(ev.id.length + size) % R.LAWS.length].id, { size, event: ev.id });
      let guard = 0;
      while (!s.over && guard++ < 50) { playRounds(s, 1); invariant(s); }
      assert.ok(s.over, ev.id + ' : la partie se termine');
    }
  }
});

test('multijoueur : reliques et éveil voyagent avec le plateau publié', () => {
  const s = R.newGame('mp', 'symbiose', { size: 2 });
  const p = s.players[0];
  p.relics = ['lance'];
  p.awake = true;
  const snap = R.snapshotOf(s, p);
  assert.deepEqual(snap.relics, ['lance']);
  assert.equal(snap.awake, true);
});
