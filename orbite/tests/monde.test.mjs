// Tests de votre planète (js/world.js) : node --test orbite/tests/monde.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('../js/world.js');
const W = globalThis.OrbiteWorld;

test('la civilisation verte (et le bouton Création) arrive avec la fin de l’ère Vie', () => {
  const before = W.UPGRADES.filter((u) => u.stage < 3 && !u.bonus).map((u) => u.id);
  assert.equal(before[before.length - 1], 'lune');
  assert.equal(W.civil([]), false);
  assert.equal(W.civil(before.slice(0, -1)), false, 'sans la Lune capturée, pas encore');
  assert.equal(W.civil(before), true);
  assert.equal(W.civil(W.UPGRADES.map((u) => u.id)), true);
});

test('Visiter la planète (v124) : 530 poussières, niveau 75, juste après la Lune, avant la civilisation verte', () => {
  assert.equal(W.UPGRADES.length, 25);
  const ids = W.UPGRADES.map((u) => u.id);
  const v = W.BY_ID.visite;
  assert.ok(v, 'amélioration présente');
  assert.equal(v.price, 530);
  assert.equal(v.lvl, 75);
  assert.equal(v.stage, 2, 'dans l’ère Vie');
  assert.ok(v.name && v.text);
  assert.deepEqual(v.fx, {}, 'aucun effet sur l’apparence');
  assert.equal(ids.indexOf('visite'), ids.indexOf('lune') + 1, 'juste après la Lune capturée');
  assert.equal(W.UPGRADES[ids.indexOf('visite') + 1].stage, 3, 'la suivante ouvre la civilisation verte');
  const lastLife = W.UPGRADES.filter((u) => u.stage < 3);
  assert.equal(lastLife[lastLife.length - 1].id, 'visite', 'dernier palier avant la civilisation');
  // Niveaux et prix toujours croissants dans l'ordre d'achat.
  for (let i = 1; i < W.UPGRADES.length; i++) {
    assert.ok(W.UPGRADES[i].lvl > W.UPGRADES[i - 1].lvl, ids[i] + ' : niveau');
    assert.ok(W.UPGRADES[i].price > W.UPGRADES[i - 1].price, ids[i] + ' : prix');
  }
});

test('la Création ne dépend pas de la visite : elle s’ouvre toujours après la Lune', () => {
  const toLune = W.UPGRADES.slice(0, W.UPGRADES.findIndex((u) => u.id === 'lune') + 1).map((u) => u.id);
  assert.equal(W.civil(toLune), true, 'un nouveau joueur l’ouvre après la Lune, comme avant');
  assert.equal(W.next(toLune).id, 'visite', 'la prochaine étape est la visite');
  assert.equal(W.next(toLune.concat('visite')).stage, 3, 'puis la civilisation verte');
  // Un ancien joueur déjà plus loin (sans la visite) garde la Création et peut acheter la visite.
  const old = toLune.concat(['villages', 'solaire']);
  assert.equal(W.civil(old), true);
  assert.equal(W.next(old).id, 'visite');
  // Les canaux d'apparence ne changent pas avec la visite.
  assert.deepEqual(W.channels(toLune.concat('visite')), W.channels(toLune));
  assert.equal(W.stageName(toLune.concat('visite')), W.STAGES[2].name);
  // Un monde accompli avant la visite reste une Terre nouvelle.
  const allOld = W.UPGRADES.filter((u) => !u.bonus).map((u) => u.id);
  assert.equal(W.stageName(allOld), 'Terre nouvelle');
  assert.equal(W.stageName(allOld.concat('visite')), 'Terre nouvelle');
  assert.equal(W.next(allOld).id, 'visite', 'il peut encore acheter la visite');
});
