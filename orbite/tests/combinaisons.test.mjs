// Dénombrements nominaux : node --test orbite/tests/combinaisons.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { binomial, placements, computeCombinationsReport } = require('../tools/combinaisons.js');
const R = require('../js/rules.js');
const cli = fileURLToPath(new URL('../tools/combinaisons.js', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', timeout: 10000 });

test('combinaisons sans ordre : cas limites et résultat au-delà des entiers Number exacts', () => {
  assert.equal(binomial(0, 0), 1n);
  assert.equal(binomial(5, 0), 1n);
  assert.equal(binomial(5, 5), 1n);
  assert.equal(binomial(5, 2), 10n);
  assert.equal(binomial(5, 3), 10n);
  assert.equal(binomial(3, 4), 0n);
  assert.equal(binomial(100, 50), 100891344545564193334812497256n);
});

test('placements ordonnés : petits exemples et sélection impossible', () => {
  assert.equal(placements(0, 0), 1n);
  assert.equal(placements(4, 0), 1n);
  assert.equal(placements(4, 1), 4n);
  assert.equal(placements(4, 2), 12n);
  assert.equal(placements(3, 3), 6n);
  assert.equal(placements(3, 4), 0n);
});

test('les calculs refusent les entrées négatives, fractionnaires ou inexactes', () => {
  for (const invalid of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '5', 5n]) {
    for (const fn of [binomial, placements]) {
      assert.throws(() => fn(invalid, 1), RangeError);
      assert.throws(() => fn(5, invalid), RangeError);
    }
  }
});

test('le rapport distingue les identités ordinaires, légendaires, jetons et lois du catalogue actuel', () => {
  const report = computeCombinationsReport();
  assert.deepEqual({
    total: report.catalogue.totalTypes,
    regular: report.catalogue.regularTypes,
    legendary: report.catalogue.legendaryTypes,
    tokens: report.catalogue.tokenTypes,
    families: report.catalogue.playableFamilies,
    laws: report.catalogue.laws,
    neutralRegular: report.catalogue.neutralRegularTypes,
  }, { total: 142, regular: 125, legendary: 15, tokens: 2, families: 13, laws: 16, neutralRegular: 8 });
  assert.equal(report.families.activePerGame, 5);
  assert.equal(report.families.possibleSelections, '1287');
  assert.equal(report.families.selectionsWithSpecifiedNonNeutralFamily, '495');
  assert.ok(Object.values(report.catalogue.regularTypesByFamily).every((n) => n === 9));
  assert.ok(Object.values(report.catalogue.legendaryTypesByFamily).every((n) => n === 1), 'une légendaire par famille');
  assert.equal(report.catalogue.neutralLegendaryTypes, 2);
});

test('le catalogue nominal ne garde que les légendaires des familles en jeu et exclut les jetons', () => {
  const report = computeCombinationsReport();
  const families = new Set(report.nominalPool.referenceFamilies);
  const expectedIds = R.CARDS.filter((c) => !c.token && (c.fam === 'neutre' || families.has(c.fam)));
  assert.equal(expectedIds.length, 60);
  assert.equal(report.nominalPool.totalTypes, expectedIds.length);
  assert.equal(report.nominalPool.regularTypes, 53);
  assert.equal(report.nominalPool.legendaryTypes, 7);
  assert.ok(!R.CARDS.some((c) => c.legend && report.nominalPool.referenceFamilies.length && c.fam !== 'neutre' && !families.has(c.fam) && expectedIds.includes(c)));
  assert.equal(report.nominalPool.uniformSizeAcrossFamilySelections, true);
  assert.equal(report.nominalPool.minTypesAcrossFamilySelections, 60);
  assert.equal(report.nominalPool.maxTypesAcrossFamilySelections, 60);
});

test('les dénombrements du sous-modèle à sept identités sont exacts et sérialisables', () => {
  const report = computeCombinationsReport();
  assert.equal(report.distinctIdentityModel.units, 7);
  assert.equal(report.distinctIdentityModel.unorderedSelections, '386206920');
  assert.equal(report.distinctIdentityModel.ordersPerSelection, '5040');
  assert.equal(report.distinctIdentityModel.orderedArrangements, '1946482876800');
  assert.deepEqual(JSON.parse(JSON.stringify(report)), report);
  assert.ok(report.limitations.some((s) => s.includes('états légalement atteignables')));
  assert.ok(report.limitations.some((s) => s.includes('placement')));
});

test('le modèle distingue une sélection vide, une paire et un nombre d’astres impossible', () => {
  const empty = computeCombinationsReport({ units: 0 }).distinctIdentityModel;
  assert.equal(empty.unorderedSelections, '1');
  assert.equal(empty.orderedArrangements, '1');
  const pair = computeCombinationsReport({ units: 2 }).distinctIdentityModel;
  assert.equal(pair.unorderedSelections, '1770');
  assert.equal(pair.ordersPerSelection, '2');
  assert.equal(pair.orderedArrangements, '3540');
  assert.throws(() => computeCombinationsReport({ units: R.BOARD_MAX + 1 }), RangeError);
  assert.throws(() => computeCombinationsReport({ units: -1 }), RangeError);
  assert.throws(() => computeCombinationsReport({ units: 2.5 }), RangeError);
});

test('la CLI produit du JSON seul ou un rapport humain qui annonce les limites', () => {
  const json = run('--json');
  assert.equal(json.error, undefined);
  assert.equal(json.status, 0, json.stderr);
  assert.equal(json.stderr, '');
  assert.deepEqual(JSON.parse(json.stdout), computeCombinationsReport());
  const human = run();
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /Sous-modèle : 7 identités distinctes/);
  assert.match(human.stdout, /pas des états de jeu légaux/);
  assert.match(human.stdout, /profondeur/);
  const pair = run('--units=2', '--json');
  assert.equal(pair.status, 0, pair.stderr);
  assert.equal(JSON.parse(pair.stdout).distinctIdentityModel.orderedArrangements, '3540');
});

test('la CLI refuse les options inconnues et les nombres invalides avec un statut non nul', () => {
  for (const args of [
    ['--unknown'], ['2'], ['--units'], ['--units', '-1'], ['--units', '1.5'],
    ['--units', String(R.BOARD_MAX + 1)], ['--units='], ['--units=2', '--units=3'],
  ]) {
    const result = run(...args);
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0, args.join(' '));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Erreur :/);
  }
  const help = run('--help');
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage :/);
});
