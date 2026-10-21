import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../js/rules.js');

function conserved(state) {
  assert.deepEqual(R.poolAudit(state), state.poolTotal, 'la réserve reste conservée');
  assert.ok(Object.values(state.pool).every((n) => Number.isFinite(n) && n >= 0));
}

// Le focal ne peut infliger de dégâts et perd sa première manche ; sa copie est conservée
// dans le plateau afin de détecter des effets de fin de tour appliqués après son élimination.
function earlyElimination(seed) {
  const state = R.newGame(seed, 'symbiose');
  const me = state.players[0];
  me.hp = 1;
  me.board[0].atk = 0;
  me.board[0].hp = 1;
  conserved(state);
  return state;
}

test('sans observation, la partie se termine toujours à la mort du joueur local', () => {
  const state = earlyElimination('observer-default');
  const result = R.endTurn(state);
  assert.equal(result.ok, true);
  assert.equal(result.over, true);
  assert.equal(state.players[0].alive, false);
  assert.equal(state.rank, 8);
  assert.equal(state.reward, 0);
  assert.equal(state.phase, 'over');
  assert.equal(R.alivePlayers(state).length, 7);
  assert.ok(R.alivePlayers(state).every((p) => p.rank === null));
  conserved(state);

  // L'option ne réouvre pas une sauvegarde terminée avec le comportement normal.
  const ended = JSON.stringify(state);
  assert.equal(R.endTurn(state, { observer: true }).ok, false);
  assert.equal(JSON.stringify(state), ended);
});

test('observation : vrais rangs jusqu’au vainqueur, réserve et focal mort inchangés', () => {
  const state = earlyElimination('observer-complete');
  const first = R.endTurn(state, { observer: true });
  assert.equal(first.ok, true);
  assert.equal(first.over, false);
  assert.equal(state.over, false);
  assert.equal(state.phase, 'shop');
  assert.equal(state.players[0].alive, false);
  assert.equal(state.players[0].rank, 8);
  assert.equal(state.round, 2);
  conserved(state);
  const focal = JSON.parse(JSON.stringify(state.players[0]));

  let last;
  for (let turn = 0; turn < 80 && !state.over; turn++) {
    last = R.endTurn(state, { observer: true });
    assert.equal(last.ok, true);
    assert.equal(last.battle, null);
    assert.deepEqual(last.endEvents, []);
    assert.deepEqual(last.startEvents || [], []);
    assert.deepEqual(state.players[0], focal, 'aucun effet ni économie du focal mort');
    conserved(state);
  }

  assert.equal(state.over, true, 'la table complète se termine');
  assert.equal(last.over, true);
  const alive = R.alivePlayers(state);
  assert.equal(alive.length, 1);
  assert.equal(alive[0].bot, true);
  assert.equal(alive[0].rank, 1);
  assert.deepEqual(state.players.map((p) => p.rank).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(state.rank, 8, 'le résultat local garde le rang du focal');
  assert.equal(state.reward, 0);
  assert.equal(Object.hasOwn(state, 'observer'), false);
});

test('une reprise JSON après élimination reste déterministe en observation', () => {
  const original = earlyElimination('observer-resume');
  R.endTurn(original, { observer: true });
  assert.equal(original.players[0].alive, false);
  const resumed = JSON.parse(JSON.stringify(original));

  for (let turn = 0; turn < 80 && !original.over; turn++) {
    const a = R.endTurn(original, { observer: true });
    const b = R.endTurn(resumed, { observer: true });
    assert.deepEqual(a, b);
    assert.deepEqual(original, resumed);
  }
  assert.equal(original.over, true);
  assert.equal(resumed.over, true);
  conserved(original);
  conserved(resumed);
});

test('l’observation exige toujours de résoudre une découverte du focal vivant', () => {
  const state = R.newGame('observer-discover', 'symbiose');
  const id = Object.keys(state.pool).find((id) => state.pool[id] > 0);
  state.pool[id]--;
  state.players[0].discover.push(id);
  conserved(state);
  const before = JSON.stringify(state);
  assert.equal(R.endTurn(state, { observer: true }).ok, false);
  assert.equal(JSON.stringify(state), before);
});

const families = ['vie', 'neant', 'envers', 'brasier', 'glace'];
const laws = ['endurance', 'phenix', 'sacrifice', 'symbiose', 'entropie', 'stase', 'combustion'];

test('botLaws initialise les vraies lois, les PV, les astres et leurs réserves', () => {
  const state = R.newGame('observer-laws', 'symbiose', { families, botLaws: laws });
  const bots = state.players.filter((p) => p.bot);
  assert.equal(bots.length, laws.length);
  for (let i = 0; i < bots.length; i++) {
    const p = bots[i], law = R.LAW[laws[i]];
    assert.equal(p.law, law.id);
    assert.equal(p.hp, law.hp || R.START_HP);
    assert.equal(p.maxHp, law.hp || R.START_HP);
    assert.equal(p.board[0].id, law.starter);
    assert.equal(p.shop.length, R.SHOP_SIZE[p.tier]);
  }
  conserved(state);
  assert.equal(Object.hasOwn(state, 'botLaws'), false);
  assert.deepEqual(laws, ['endurance', 'phenix', 'sacrifice', 'symbiose', 'entropie', 'stase', 'combustion']);
});

test('botLaws est une liste complète de lois connues, actives ou neutres', () => {
  const make = (botLaws) => R.newGame('observer-invalid-laws', 'symbiose', { families, botLaws });
  assert.throws(() => make(null), TypeError);
  assert.throws(() => make('symbiose'), TypeError);
  assert.throws(() => make(laws.slice(1)), RangeError);
  assert.throws(() => make(laws.concat('symbiose')), RangeError);
  assert.throws(() => make(['inconnue', ...laws.slice(1)]), /inconnue/);
  assert.throws(() => make(['__proto__', ...laws.slice(1)]), /inconnue/);
  assert.throws(() => make(['vents', ...laws.slice(1)]), /inactive/);
  assert.throws(() => make(new Array(7)), /inconnue/);
});

test('botLaws suit l’ordre de création après les sièges humains', () => {
  const assigned = laws.slice(0, 6);
  const state = R.newGame('observer-human-seats', 'symbiose', {
    families,
    seats: [{ id: 'rival', name: 'Rival', law: 'symbiose' }],
    botLaws: assigned,
  });
  assert.equal(state.players[1].remote, true);
  const bots = state.players.filter((p) => p.bot);
  assert.equal(bots[0].id, 'bot1');
  assert.deepEqual(bots.map((p) => p.law), assigned);
  conserved(state);
});

test('les options de mesure absentes ne changent pas l’initialisation ni le format sauvegardé', () => {
  const normal = R.newGame('observer-options-absent', 'symbiose');
  const omitted = R.newGame('observer-options-absent', 'symbiose', { botLaws: undefined });
  assert.deepEqual(normal, omitted);
  assert.equal(normal.players[0].skill, undefined);
  assert.ok(normal.players.slice(1).every((p) => p.skill === 1));
  assert.equal(normal.v, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(normal)), normal);
});
