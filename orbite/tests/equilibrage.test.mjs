import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { runBalance, dominantFamily } = require('../tools/lib/equilibrage.js');
const { parseArguments, createSimulation } = require('../tools/lib/simulation.js');
const root = fileURLToPath(new URL('../../', import.meta.url));

test('un duo de familles ne doit pas attribuer ses performances à une seule famille', () => {
  const player = { board: [...Array(3).fill({ id: 'aube' }), ...Array(3).fill({ id: 'givre' })] };
  assert.deepEqual(dominantFamily(player), { dominant: 'duo:glace+vie', count: 2 });
  assert.equal(dominantFamily({ board: player.board.slice(0, 4) }).dominant, 'vie');
  assert.equal(dominantFamily({ board: player.board.slice(1, 5) }).dominant, 'mixte');
});

test('rapport : ne compter que les vrais classements et distinguer les observations corrélées', () => {
  const options = parseArguments(['2', '--skill', '0', '--seed', 'report-fixture']);
  const report = runBalance(options);
  assert.deepEqual(report.counts, { requested: 2, completed: 2, truncated: 0, failed: 0 });
  assert.equal(Object.values(report.laws.focal).reduce((n, stats) => n + stats.n, 0), 2);
  assert.equal(Object.values(report.laws.allPlayers).reduce((n, stats) => n + stats.n, 0), 16);
  assert.equal(Object.values(report.laws.allPlayers).reduce((n, stats) => n + stats.wins, 0), 2);
  for (const stats of Object.values(report.laws.allPlayers)) assert.equal(stats.winRate95, null);
  for (const stats of Object.values(report.seats)) assert.equal(stats.n, 2);
  for (const stats of Object.values(report.laws.focal)) {
    if (stats.n) assert.ok(stats.winRate95 && stats.winRate95.high > stats.winRate95.low);
    else assert.equal(stats.winRate, null);
  }
  const replay = runBalance(options);
  delete report.durationMs;
  delete replay.durationMs;
  assert.deepEqual(replay, report);
});

test('rapport inachevé : aucun faux taux à zéro ni classement estimé', () => {
  const report = runBalance(parseArguments(['2', '--skill', '0', '--max-rounds', '1']));
  assert.deepEqual(report.counts, { requested: 2, completed: 0, truncated: 2, failed: 0 });
  assert.equal(report.meanRounds, null);
  for (const stats of Object.values(report.laws.focal)) {
    assert.equal(stats.n, 0);
    assert.equal(stats.winRate, null);
    assert.equal(stats.meanRank, null);
  }
  assert.ok(report.warnings.some(warning => warning.includes('inachevées')));
});

test('CLI : JSON exploitable et code distinct quand toutes les parties sont inachevées', () => {
  const result = spawnSync(process.execPath, ['orbite/tools/equilibrage.js', '1', '--skill', '0', '--max-rounds', '1', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.counts.completed, 0);
  assert.equal(report.counts.truncated, 1);
  assert.equal(report.truncatedGames.length, 1);
});

test('une clé héritée du prototype ne peut pas être une loi de simulation', () => {
  for (const lawId of ['toString', 'constructor', '__proto__']) {
    assert.throws(() => createSimulation({ seed: 'invalid-law', lawId }), /Loi inconnue/);
  }
});

test('l’API refuse un rapport dont les paramètres ne décrivent pas l’expérience', () => {
  const complete = parseArguments(['1', '--skill', '0', '--max-rounds', '1']);
  for (const field of ['seed', 'population', 'skill', 'maxRounds', 'games']) {
    const incomplete = { ...complete };
    delete incomplete[field];
    assert.throws(() => runBalance(incomplete), Error, field);
  }
  assert.throws(() => runBalance({ games: 1, maxRounds: 1, skill: 0 }), /graine/);
});
