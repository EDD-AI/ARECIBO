// Tests de votre planète (js/world.js) : node --test orbite/tests/monde.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
createRequire(import.meta.url)('../js/world.js');
const W = globalThis.OrbiteWorld;

test('la civilisation verte (et le bouton Création) arrive avec la fin de l’ère Vie', () => {
  const before = W.UPGRADES.filter((u) => u.stage < 3).map((u) => u.id);
  assert.equal(before[before.length - 1], 'lune');
  assert.equal(W.civil([]), false);
  assert.equal(W.civil(before.slice(0, -1)), false, 'sans la Lune capturée, pas encore');
  assert.equal(W.civil(before), true);
  assert.equal(W.civil(W.UPGRADES.map((u) => u.id)), true);
  assert.equal(W.next(before).stage, 3, 'la prochaine amélioration est de la civilisation verte');
});
