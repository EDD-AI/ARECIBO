import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  R, parseArguments, createSimulation, auditState, historyDiagnostics, simulateGame,
} = require('../tools/lib/simulation.js');

test('arguments : conserver les réglages explicites et les modes de sortie', () => {
  const args = parseArguments([
    '24', '--seed', 'essai reproductible', '--max-rounds', '40',
    '--population', 'game', '--skill', '0', '--json', '--detail',
  ], { detail: true });
  assert.deepEqual(args, {
    games: 24, seed: 'essai reproductible', maxRounds: 40,
    population: 'game', skill: 0, json: true, detail: true, help: false,
  });
  assert.equal(parseArguments(['--help']).help, true);
  assert.equal(parseArguments(['-h']).help, true);
  assert.equal(parseArguments([], { defaultGames: 18 }).games, 18);
});

test('arguments invalides : ne pas lancer silencieusement un tournoi différent', () => {
  const invalid = [
    ['0'], ['-1'], ['1.5'], ['Infinity'], ['NaN'], [''], ['3', '4'],
    ['--inconnu'], ['--detail'], ['--seed'], ['--seed', '--json'], ['--seed', ' '],
    ['--max-rounds'], ['--max-rounds', '0'], ['--max-rounds', '1.5'],
    ['--population', 'autre'], ['--skill', '2'], ['--skill', '1.0'],
  ];
  for (const argv of invalid) {
    assert.throws(() => parseArguments(argv), Error, JSON.stringify(argv));
  }
});

test('population équilibrée : même IA et absence de tempérament ou de seconde préférence imposée', () => {
  const state = createSimulation({ seed: 'simulation-fair', lawId: 'symbiose' });
  assert.equal(state.players.length, 8);
  assert.ok(state.players.every(p => p.skill === 1));
  assert.ok(state.players.every(p => p.greed === 0));
  assert.ok(state.players.every(p => p.pref2 === null));
  for (const p of state.players) {
    const family = R.LAW[p.law].fam;
    assert.ok(family === 'neutre' || state.families.includes(family));
    assert.ok(state.families.includes(p.pref));
    if (family !== 'neutre') assert.equal(p.pref, family);
  }
  // La population de mesure parcourt les lois disponibles, au lieu de tirer
  // plusieurs fois une famille favorisée par FAM_POWER.
  const opponentLaws = state.players.slice(1).map(p => p.law);
  assert.equal(new Set(opponentLaws).size, opponentLaws.length);
  auditState(state);
});

test('population du jeu : corriger aussi l’IA du focal tout en conservant ses adversaires', () => {
  const original = R.newGame('simulation-population-game', 'symbiose');
  const measured = createSimulation({
    seed: 'simulation-population-game', lawId: 'symbiose', population: 'game',
  });
  assert.equal(original.players[0].skill, undefined, 'le biais de départ existe dans le jeu');
  assert.ok(measured.players.every(p => p.skill === 1));
  for (let i = 0; i < original.players.length; i++) {
    const before = original.players[i], after = measured.players[i];
    assert.equal(after.law, before.law);
    assert.equal(after.greed, before.greed);
    assert.equal(after.pref, before.pref);
    assert.equal(after.pref2, before.pref2);
  }
  auditState(measured);
});

test('initialisation : rejeter une expérience sans graine, loi ou population valide', () => {
  for (const overrides of [
    { seed: '' }, { seed: null }, { lawId: 'inconnue' },
    { population: 'inconnue' }, { skill: 2 },
  ]) {
    assert.throws(() => createSimulation({
      seed: 'simulation-invalid', lawId: 'symbiose', ...overrides,
    }), Error);
  }
  assert.throws(() => simulateGame({
    seed: 'simulation-invalid-limit', lawId: 'symbiose', maxRounds: 0,
  }), RangeError);
});

test('tournoi reproductible : terminer la table avec huit rangs réels et une réserve conservée', () => {
  const options = { seed: 'simulation-complete', lawId: 'symbiose', skill: 0 };
  const first = simulateGame(options);
  const replay = simulateGame(options);
  assert.equal(first.completed, true);
  assert.equal(first.reason, 'finished');
  assert.equal(first.state.over, true);
  const survivors = R.alivePlayers(first.state);
  assert.equal(survivors.length, 1);
  assert.equal(survivors[0].rank, 1);
  assert.deepEqual(first.state.players.map(p => p.rank).sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(first.rounds > 1 && first.rounds <= 80);
  assert.equal(first.rounds, first.state.history.length);
  auditState(first.state);
  assert.deepEqual(replay, first, 'mêmes entrées, mêmes décisions et mêmes résultats');
});

test('limite atteinte : déclarer la partie incomplète sans inventer de rangs aux survivants', () => {
  const result = simulateGame({
    seed: 'simulation-round-limit', lawId: 'symbiose', skill: 0, maxRounds: 1,
  });
  assert.equal(result.rounds, 1);
  assert.equal(result.completed, false);
  assert.equal(result.reason, 'round-limit');
  assert.equal(result.state.over, false);
  assert.ok(R.alivePlayers(result.state).length > 1);
  assert.ok(R.alivePlayers(result.state).every(p => p.rank === null));
  assert.deepEqual(result.diagnostics, historyDiagnostics(result.state.history));
  assert.equal(Object.hasOwn(result.state, 'diagnostics'), false, 'les diagnostics ne changent pas la sauvegarde');
  auditState(result.state);
});

test('diagnostic vide : ne pas inventer d’égalité ou de dernière manche décisive', () => {
  assert.deepEqual(historyDiagnostics([]), {
    consecutiveDrawRounds: 0, drawRounds: 0, drawCombats: 0, decisiveCombats: 0,
    lastDecisiveCombatRound: null, lastEliminationRound: null,
  });
  assert.throws(() => historyDiagnostics(null), TypeError);
});

test('diagnostic : une manche décisive interrompt la série d’égalités', () => {
  const history = [
    { round: 1, results: [{ winner: -1, damage: 0 }], fallen: [] },
    { round: 2, results: [{ winner: 1, damage: 4 }], fallen: [] },
    { round: 3, results: [{ winner: -1, damage: 0 }, { winner: -1, damage: 0 }], fallen: [] },
    { round: 4, results: [{ winner: -1, damage: 0 }], fallen: [] },
  ];
  const before = JSON.stringify(history);
  assert.deepEqual(historyDiagnostics(history), {
    consecutiveDrawRounds: 2, drawRounds: 3, drawCombats: 4, decisiveCombats: 1,
    lastDecisiveCombatRound: 2, lastEliminationRound: null,
  });
  assert.equal(JSON.stringify(history), before);
});

test('diagnostic : les combats mixtes, les dégâts et les morts ne sont pas une manche d’égalité', () => {
  const history = [
    { round: 8, results: [{ winner: -1, damage: 0 }], fallen: [] },
    { round: 9, results: [{ winner: -1, damage: 0 }, { winner: 0, damage: 6 }], fallen: ['bot'] },
  ];
  assert.deepEqual(historyDiagnostics(history), {
    consecutiveDrawRounds: 0, drawRounds: 1, drawCombats: 2, decisiveCombats: 1,
    lastDecisiveCombatRound: 9, lastEliminationRound: 9,
  });

  // Des données contradictoires ne doivent pas être présentées comme une
  // absence de progression sur la seule base du champ winner.
  assert.equal(historyDiagnostics([
    { round: 1, results: [{ winner: -1, damage: 3 }], fallen: [] },
  ]).drawRounds, 0);
  assert.equal(historyDiagnostics([
    { round: 1, results: [{ winner: -1, damage: 0 }], fallen: ['bot'] },
  ]).consecutiveDrawRounds, 0);
});

test('diagnostic : une manche sans combat n’est pas déclarée nulle', () => {
  const result = historyDiagnostics([
    { round: 1, results: [{ winner: -1, damage: 0 }], fallen: [] },
    { round: 2, results: [], fallen: [] },
  ]);
  assert.equal(result.drawRounds, 1);
  assert.equal(result.consecutiveDrawRounds, 0);
  assert.equal(result.lastDecisiveCombatRound, null);
});

test('audit : détecter un stock négatif et deux astres partageant réellement le même identifiant', () => {
  const stock = createSimulation({ seed: 'simulation-stock', lawId: 'symbiose', skill: 0 });
  auditState(stock);
  const id = Object.keys(stock.pool).find(id => stock.pool[id] >= 0);
  stock.pool[id] = -1;
  assert.throws(() => auditState(stock), assert.AssertionError);

  const duplicate = createSimulation({ seed: 'simulation-duplicate', lawId: 'symbiose', skill: 0 });
  auditState(duplicate);
  duplicate.players[1].board[0].uid = duplicate.players[0].board[0].uid;
  // Le stock de copies est intact : c'est bien l'unicité des unités que
  // l'audit doit contrôler, et non seulement le total de la réserve.
  assert.deepEqual(R.poolAudit(duplicate), duplicate.poolTotal);
  assert.throws(() => auditState(duplicate), /Identifiant d’astre dupliqué/);
});

test('échec d’une règle : conserver la graine et la manche dans le diagnostic', () => {
  assert.throws(() => simulateGame({
    seed: 'simulation-reproduce-error', lawId: 'symbiose', skill: 0,
    setup(state) { state.players[0].gold = -1; },
  }), /graine=simulation-reproduce-error, manche=1.*Énergie invalide/);
});
