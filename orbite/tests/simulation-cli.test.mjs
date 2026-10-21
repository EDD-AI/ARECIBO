import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
function cli(script, args) {
  const result = spawnSync(process.execPath, ['orbite/tools/' + script + '.js', ...args], {
    cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}
function json(script, args, expectedStatus = 0) {
  const result = cli(script, [...args, '--json']);
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
function fullRanking(groups) {
  assert.equal(groups.reduce((sum, group) => sum + group.n, 0), 8);
  assert.equal(groups.reduce((sum, group) => sum + group.wins, 0), 1);
  assert.equal(groups.reduce((sum, group) => sum + group.meanRank * group.n, 0), 36);
}

test('CLI bots-duel : quatre politiques de chaque niveau et classement complet', () => {
  const report = json('bots-duel', ['1', '--seed', 'cli-regression']);
  assert.equal(report.completedGames, 1);
  assert.equal(report.truncatedGames, 0);
  assert.deepEqual(report.parameters.skills, [0, 1]);
  assert.equal(report.groups.basic.n, 4);
  assert.equal(report.groups.expert.n, 4);
  fullRanking(Object.values(report.groups));
  assert.equal(report.groups.basic.winRate95, null);
  assert.equal(report.groups.expert.winRate95, null);
});

test('CLI hybrides : groupes équilibrés, vraies familles et résultats reproductibles', () => {
  const args = ['1', '--skill', '0', '--seed', 'cli-hybrid'];
  const report = json('hybrides', args);
  assert.deepEqual(report, json('hybrides', args));
  assert.equal(report.completedGames, 1);
  assert.equal(report.groups.mono.n, 4);
  assert.equal(report.groups.duo.n, 4);
  fullRanking(Object.values(report.groups));
  assert.equal(Object.values(report.pairs).reduce((sum, pair) => sum + pair.n, 0), 4);
  assert.ok(Object.keys(report.pairs).every(pair => !pair.includes('neutre')));
  assert.ok(Object.values(report.pairs).every(pair => pair.winRate95 === null));
});

test('CLI mono : nombre par famille, un résultat focal par partie et incertitude', () => {
  const report = json('bots-mono', ['1', '--skill', '0', '--seed', 'cli-mono']);
  assert.equal(report.requestedGames, 12);
  assert.equal(report.completedGames, 12);
  assert.equal(Object.keys(report.families).length, 12);
  for (const summary of Object.values(report.families)) {
    assert.equal(summary.n, 1);
    assert.ok(summary.meanRank >= 1 && summary.meanRank <= 8);
    assert.ok(summary.winRate95.high > summary.winRate95.low);
  }
});

test('CLI : une limite atteinte est signalée, exclue des statistiques et termine avec code 2', () => {
  for (const name of ['bots-duel', 'hybrides', 'bots-mono']) {
    const args = ['1', '--max-rounds', '1', '--seed', 'cli-truncated'];
    if (name !== 'bots-duel') args.push('--skill', '0');
    const report = json(name, args, 2);
    assert.equal(report.completedGames, 0);
    assert.equal(report.truncatedGames, report.requestedGames);
    assert.equal(report.truncatedSeeds.length, report.requestedGames);
    assert.equal(report.meanRounds, null);
    const summaries = Object.values(report.groups || report.families);
    for (const summary of summaries) {
      assert.equal(summary.n, 0);
      assert.equal(summary.meanRank, null);
      assert.equal(summary.winRate, null);
    }
  }
});

test('CLI : arguments invalides rejetés et aide disponible sans simulation', () => {
  for (const name of ['bots-duel', 'hybrides', 'bots-mono']) {
    for (const args of [['0'], ['1.5'], ['2', '--population', 'inconnue'], ['1', '--max-rounds', '0'], ['1', '--option-inconnue']]) {
      const result = cli(name, args);
      assert.equal(result.status, 1);
      assert.ok(result.stderr.trim().length > 0);
    }
    const help = cli(name, ['--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Usage/);
  }
  assert.equal(cli('bots-duel', ['1', '--skill', '0']).status, 1);
});

test('CLI : la population du jeu reste explicitement accessible', () => {
  const report = json('hybrides', ['1', '--skill', '0', '--population', 'game', '--seed', 'cli-game-population']);
  assert.equal(report.parameters.population, 'game');
  assert.equal(report.completedGames, 1);
  fullRanking(Object.values(report.groups));
});
