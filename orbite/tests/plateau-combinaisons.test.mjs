import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { computePlateauCombinations } = require('../tools/plateau-combinaisons.js');
const root = fileURLToPath(new URL('../../', import.meta.url));

test('plateau : séparer compositions et placements sans prétendre compter des états accessibles', () => {
  const report = computePlateauCombinations({ players: 2, units: 2 });
  assert.deepEqual(report.board, { rings: 3, sectors: 12, cells: 36 });
  assert.equal(report.catalogue.totalTypes, 36);
  assert.equal(report.catalogue.nominalTypesPerGame, 15);
  assert.equal(report.distinctArmyModel.unorderedTypeSelections, '105');
  assert.equal(report.distinctArmyModel.placementsPerSelection, '1260');
  assert.equal(report.distinctArmyModel.nominalArrangements, '132300');
  assert.ok(report.limitations.some(text => text.includes('équilibrage')));
  for (const row of report.openingPlans) {
    assert.equal(row.perUnit.length, 2);
    assert.ok(BigInt(row.orderCombinations) >= 1n);
  }
});

test('plateau : armée vide et grands arrangements restent exacts et sérialisables', () => {
  const empty = computePlateauCombinations({ units: 0 });
  assert.equal(empty.distinctArmyModel.nominalArrangements, '1');
  const large = computePlateauCombinations({ players: 6, units: 7 });
  assert.equal(large.board.cells, 108);
  assert.equal(large.distinctArmyModel.unorderedTypeSelections, '6435');
  assert.ok(BigInt(large.distinctArmyModel.nominalArrangements) > BigInt(Number.MAX_SAFE_INTEGER));
  assert.doesNotThrow(() => JSON.stringify(large));
});

test('plateau : un dénombrement invalide échoue explicitement', () => {
  for (const options of [{ players: 1 }, { players: 7 }, { units: -1 }, { units: 8 }, { units: 1.5 }, { seed: '' }]) assert.throws(() => computePlateauCombinations(options));
  const result = spawnSync(process.execPath, ['orbite/tools/plateau-combinaisons.js', '--players', '2', '--units', '2', '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).distinctArmyModel.nominalArrangements, '132300');
});
