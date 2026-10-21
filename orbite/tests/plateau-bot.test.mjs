import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../js/plateau.js');
const B = require('../js/plateau-bot.js');
const { simulatePrototypeGame, runTournament } = require('../tools/plateau-sim.js');
const clone = value => JSON.parse(JSON.stringify(value));

function game(seed = 'plateau-bot-test') {
  return P.newGame({ seed, players: [
    { id: 'a', name: 'A', kind: 'bot', family: 'vie' },
    { id: 'b', name: 'B', kind: 'bot', family: 'glace' },
  ] });
}

test('bot : préparation légale, budget respecté, destinations sans collision et ordres verrouillés', () => {
  const state = game('plateau-bot-budget');
  const result = B.prepareTurn(state, 'a');
  assert.equal(result.ok, true);
  const me = state.players.find(player => player.id === 'a');
  assert.equal(me.locked, true);
  assert.ok(me.gold >= 0);
  assert.ok(result.actions.some(command => command.type === 'buy'));
  assert.equal(result.actions.at(-1).type, 'lock');
  const destinations = Object.values(me.orders).filter(order => order.type === 'move').map(order => P.nodeKey(order.to));
  assert.equal(new Set(destinations).size, destinations.length);
  assert.ok(state.units.filter(unit => unit.owner === 'a' && unit.node).every(unit => me.orders[unit.id]));
  P.assertState(state);
  assert.deepEqual(P.poolAudit(state), state.poolTotal);
});

test('bot : mêmes informations et même politique donnent les mêmes achats et ordres', () => {
  const first = game('plateau-bot-replay');
  const replay = clone(first);
  assert.deepEqual(B.prepareTurn(first, 'a', { policy: 'balanced' }),
    B.prepareTurn(replay, 'a', { policy: 'balanced' }));
  assert.deepEqual(first, replay);
});

test('bot : boutique, réserve personnelle et ordres adverses masqués ne changent pas sa décision', () => {
  const first = game('plateau-bot-private');
  assert.equal(P.action(first, 'b', { type: 'buy', slot: 0 }).ok, true);
  first.players.find(player => player.id === 'a').gold = 0;
  const other = clone(first);
  const enemy = other.players.find(player => player.id === 'b');
  enemy.shop.reverse();
  const hiddenUnit = other.units.find(unit => unit.owner === 'b' && !unit.node);
  hiddenUnit.hp = Math.max(1, hiddenUnit.hp - 1);
  const visibleEnemy = other.units.find(unit => unit.owner === 'b' && unit.node);
  const move = P.moves(other, visibleEnemy.id)[0];
  assert.equal(P.action(other, 'b', {
    type: 'order', unitId: visibleEnemy.id, order: { type: 'move', to: move },
  }).ok, true);
  P.assertState(first);
  P.assertState(other);
  assert.deepEqual(P.view(first, 'a'), P.view(other, 'a'), 'seules les données privées diffèrent');
  const a = B.prepareTurn(first, 'a');
  const b = B.prepareTurn(other, 'a');
  assert.equal(a.ok, true);
  assert.deepEqual(a, b);
  assert.deepEqual(first.players.find(player => player.id === 'a').orders,
    other.players.find(player => player.id === 'a').orders);
});

test('politiques : agression et contrôle donnent des formations distinctes sur le même plateau', () => {
  const initial = game('plateau-bot-policies');
  initial.players.find(player => player.id === 'a').gold = 0;
  const orders = {};
  for (const policy of B.POLICIES) {
    const state = clone(initial);
    assert.equal(B.prepareTurn(state, 'a', { policy }).ok, true);
    orders[policy] = state.players.find(player => player.id === 'a').orders;
    P.assertState(state);
  }
  assert.notDeepEqual(orders.aggressive, orders.control);
  assert.notDeepEqual(orders.balanced, orders.control);
});

test('politiques : équilibré poursuit son objectif quand agressif accepte un combat de passage', () => {
  const initial = game('plateau-bot-tactical-policy');
  initial.players.find(player => player.id === 'a').gold = 0;
  const attacker = initial.units.find(unit => unit.owner === 'a' && P.CARDS[unit.cardId].role === 'frappeur');
  attacker.node = { ring: 2, sector: 4 };
  const enemy = initial.units.find(unit => unit.owner === 'b' && P.CARDS[unit.cardId].role === 'frappeur');
  enemy.node = { ring: 1, sector: 4 };
  P.assertState(initial);
  const aggressive = clone(initial), balanced = clone(initial);
  assert.equal(B.prepareTurn(aggressive, 'a', { policy: 'aggressive' }).ok, true);
  assert.equal(B.prepareTurn(balanced, 'a', { policy: 'balanced' }).ok, true);
  assert.equal(aggressive.players.find(player => player.id === 'a').orders[attacker.id].type, 'attack');
  assert.equal(balanced.players.find(player => player.id === 'a').orders[attacker.id].type, 'move');
});

test('cheminement : accepter un détour temporairement plus éloigné pour contourner des obstacles', () => {
  const state = P.newGame({ seed: 'plateau-bot-detour', players: [
    { id: 'a', kind: 'bot', family: 'vie' }, { id: 'b', kind: 'bot', family: 'mineral' },
  ] });
  state.players.find(player => player.id === 'a').gold = 0;
  const attacker = state.units.find(unit => unit.owner === 'a' && P.CARDS[unit.cardId].role === 'frappeur');
  attacker.node = { ring: 2, sector: 8 };
  const blockers = state.units.filter(unit => unit.owner === 'b');
  blockers[0].node = { ring: 2, sector: 7 };
  blockers[1].node = { ring: 2, sector: 9 };
  state.pool[blockers[1].cardId]++;
  blockers[1].cardId = 'mineral-sentinelle';
  blockers[1].hp = P.stats(state, blockers[1]).maxHp;
  state.pool[blockers[1].cardId]--;
  P.assertState(state);
  const before = P.distance(state, attacker.node, { ring: 2, sector: 6 });
  assert.equal(B.prepareTurn(state, 'a', { policy: 'aggressive' }).ok, true);
  const order = state.players.find(player => player.id === 'a').orders[attacker.id];
  assert.equal(order.type, 'move');
  assert.deepEqual(order.to, { ring: 1, sector: 8 });
  assert.ok(P.distance(state, order.to, { ring: 2, sector: 6 }) > before);
  P.assertState(state);
});

test('urgence : même agressif conteste une victoire au score au lieu de frapper une cible secondaire', () => {
  const state = game('plateau-bot-deny-score');
  state.players.find(player => player.id === 'a').gold = 0;
  state.players.find(player => player.id === 'b').score = P.LIMITS.scoreToWin - 1;
  const attacker = state.units.find(unit => unit.owner === 'a' && P.CARDS[unit.cardId].role === 'frappeur');
  attacker.node = { ring: 0, sector: 1 };
  const enemy = state.units.filter(unit => unit.owner === 'b');
  enemy[0].node = { ring: 0, sector: 3 };
  enemy[1].node = { ring: 1, sector: 1 };
  P.assertState(state);
  assert.ok(P.targets(state, attacker.id).some(target => target.id === enemy[1].id));
  assert.equal(B.prepareTurn(state, 'a', { policy: 'aggressive' }).ok, true);
  assert.deepEqual(state.players.find(player => player.id === 'a').orders[attacker.id], {
    type: 'move', to: { ring: 0, sector: 2 },
  });
  P.assertState(state);
});

test('tactique : profiter d’une étoile immédiatement prenable malgré une urgence au score', () => {
  const state = game('plateau-bot-star-win');
  state.players.find(player => player.id === 'a').gold = 0;
  const enemy = state.players.find(player => player.id === 'b');
  enemy.hp = 3;
  enemy.score = P.LIMITS.scoreToWin - 1;
  const attacker = state.units.find(unit => unit.owner === 'a' && P.CARDS[unit.cardId].role === 'frappeur');
  attacker.node = { ring: 2, sector: enemy.home };
  P.assertState(state);
  assert.equal(B.prepareTurn(state, 'a', { policy: 'balanced' }).ok, true);
  assert.deepEqual(state.players.find(player => player.id === 'a').orders[attacker.id], {
    type: 'attack', target: { type: 'star', id: 'b' },
  });
});

test('contrôle : anticiper la rotation pour occuper un relais après la dérive', () => {
  const state = game('plateau-bot-drift');
  const me = state.players.find(player => player.id === 'a');
  me.gold = 0;
  const unit = state.units.find(unit => unit.owner === 'a' && P.CARDS[unit.cardId].role === 'sentinelle');
  unit.node = { ring: 0, sector: 2 };
  const id = unit.id;
  P.assertState(state);
  assert.equal(B.prepareTurn(state, 'a', { policy: 'control' }).ok, true);
  assert.equal(state.players.find(player => player.id === 'a').orders[id].type, 'guard');
  assert.equal(P.action(state, 'b', { type: 'lock' }).ok, true);
  assert.equal(P.resolveRound(state).ok, true);
  assert.deepEqual(state.units.find(unit => unit.id === id).node, { ring: 0, sector: 3 });
  assert.ok(state.players.find(player => player.id === 'a').score >= 1);
  P.assertState(state);
});

test('défense : attaquer un astre qui menace directement son étoile', () => {
  const state = game('plateau-bot-defence');
  const me = state.players.find(player => player.id === 'a');
  me.gold = 0;
  const threat = state.units.find(unit => unit.owner === 'b' && P.CARDS[unit.cardId].role === 'frappeur');
  threat.node = { ring: 2, sector: me.home };
  const id = threat.id;
  P.assertState(state);
  assert.equal(B.prepareTurn(state, 'a').ok, true);
  const attacks = Object.values(state.players.find(player => player.id === 'a').orders)
    .filter(order => order.type === 'attack');
  assert.ok(attacks.some(order => order.target.type === 'unit' && order.target.id === id));
});

test('bot : refuser joueur humain, absent, déjà verrouillé ou politique inconnue sans mutation', () => {
  const human = P.newGame({ seed: 'plateau-bot-human', players: [
    { id: 'a', kind: 'human' }, { id: 'b', kind: 'bot' },
  ] });
  const beforeHuman = clone(human);
  assert.equal(B.prepareTurn(human, 'a').ok, false);
  assert.equal(B.prepareTurn(human, 'absent').ok, false);
  assert.equal(B.prepareTurn(human, 'b', { policy: 'inconnue' }).ok, false);
  assert.deepEqual(human, beforeHuman);
  const bot = game('plateau-bot-locked');
  assert.equal(B.prepareTurn(bot, 'a').ok, true);
  const locked = clone(bot);
  assert.equal(B.prepareTurn(bot, 'a').ok, false);
  assert.deepEqual(bot, locked);
});

test('simulation : terminer des parties réelles à deux, trois et cinq joueurs sans rompre les réserves', () => {
  for (const players of [2, 3, 5]) {
    const result = simulatePrototypeGame({ seed: 'plateau-bot-complete-' + players, players, policy: 'mixed' });
    assert.equal(result.state.phase, 'over');
    assert.ok(result.rounds >= 1 && result.rounds <= P.LIMITS.maxRounds);
    assert.equal(typeof result.result.draw, 'boolean');
    assert.ok(result.result.draw || typeof result.result.winner === 'string');
    assert.deepEqual(P.poolAudit(result.state), result.state.poolTotal);
    P.assertState(result.state);
  }
});

test('simulation : une reprise de la même graine reproduit le résultat et toutes les positions', () => {
  const options = { seed: 'plateau-bot-whole-replay', players: 2, policy: 'mixed' };
  assert.deepEqual(simulatePrototypeGame(options), simulatePrototypeGame(options));
});

test('régression : arrêter les achats lorsque la réserve personnelle est pleine', () => {
  const result = simulatePrototypeGame({ seed: 'plateau-validation-0', players: 2, policy: 'mixed' });
  assert.equal(result.state.phase, 'over');
  for (const player of result.state.players) {
    assert.ok(result.state.units.filter(unit => unit.owner === player.id && !unit.node).length <= P.LIMITS.benchCap);
  }
  P.assertState(result.state);
});

test('rapport : comptabiliser toutes les issues et limiter les intervalles aux graines indépendantes', () => {
  const report = runTournament({ games: 3, players: 2, seed: 'plateau-bot-report' });
  assert.equal(report.completed, 3);
  assert.equal(report.wins + report.draws, 3);
  assert.equal(Object.values(report.reasons).reduce((sum, n) => sum + n, 0), 3);
  assert.equal(report.games.length, 3);
  for (const record of Object.values(report.byPolicy)) assert.equal(record.winRate95, null);
  for (const record of Object.values(report.byFocalPolicy)) assert.ok(record.winRate95);
});
