// Tests du générateur de bâtiments : node --test orbite/tests/batiments.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const E = createRequire(import.meta.url)('../js/building-engine.js');

test('chaque type de bâtiment se génère, non vide et déterministe', () => {
  for (const t of E.TYPES) {
    const a = E.generate(t.key, 'graine-1'), b = E.generate(t.key, 'graine-1');
    assert.ok(a.stats.voxels > 30, t.key + ' vide');
    assert.deepEqual(a.model.v, b.model.v, t.key + ' non déterministe');
    assert.equal(a.name, b.name);
  }
});

test('graines différentes, bâtiments différents', () => {
  const a = E.generate('dome', 'x1'), b = E.generate('dome', 'x2'), c = E.generate('forage', 'x3');
  assert.ok(a.stats.voxels !== b.stats.voxels || a.model.v.some((v, i) => v !== b.model.v[i]));
  assert.ok(c.stats.size[2] > 15, 'le forage est haut');
});

test('une colonie réunit plusieurs bâtiments sur un terrain', () => {
  const g = E.generate('colonie', 'colo');
  const M = E.MAT, count = (k) => g.model.v.filter((v) => v === k).length;
  assert.ok(count(M.GROUND) > 1000, 'terrain');
  assert.ok(count(M.HULL) + count(M.HULL2) > 150, 'bâtiments');
});

test('animation : le temps change le bâtiment, pas sa taille ni la colonie', () => {
  for (const k of ['eolienne', 'antenne', 'forage', 'usine', 'reacteur', 'tour']) {
    const a = E.generate(k, 'anim', { t: 0 }), b = E.generate(k, 'anim', { t: 0.37 });
    assert.deepEqual(a.stats.size, b.stats.size, k);
    assert.ok(a.model.v.some((v, i) => v !== b.model.v[i]), k + ' immobile');
  }
  const c0 = E.generate('colonie', 'anim', { t: 0 }), c1 = E.generate('colonie', 'anim', { t: 0.5 });
  const ground = (g) => g.model.v.filter((v) => v === E.MAT.GROUND).length;
  assert.equal(ground(c0), ground(c1), 'la colonie garde sa disposition');
});
