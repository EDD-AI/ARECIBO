// Tests du mode classé : node --test orbite/tests/classement.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const K = createRequire(import.meta.url)('../js/classement.js');

test('5 parties de placement, puis un rang de départ selon la place moyenne', () => {
  const c = K.fresh();
  for (let i = 0; i < 4; i++) assert.equal(K.record(c, 2).done, false);
  const r = K.record(c, 2);
  assert.ok(r.done);
  assert.equal(c.points, K.seed([2, 2, 2, 2, 2]));
  assert.equal(K.tierOf(K.seed([1, 1, 1, 1, 1])).name, 'Planète');
  assert.equal(K.seed([8, 8, 8, 8, 8]), 0);
});

test('les points montent ou descendent selon la place, jamais sous zéro', () => {
  const c = K.sanitize({ placements: [4, 4, 4, 4, 4], points: 10 });
  assert.equal(K.record(c, 1).delta, 40);
  assert.equal(c.points, 50);
  K.record(c, 8);
  K.record(c, 8);
  assert.equal(c.points, 0);
});

test('rangs et divisions : III, II, I, puis la Singularité sans division', () => {
  assert.equal(K.tierOf(0).label, 'Poussière III');
  assert.equal(K.tierOf(299).label, 'Poussière I');
  assert.equal(K.tierOf(300).label, 'Astéroïde III');
  assert.equal(K.tierOf(2400).label, 'Singularité');
  const c = K.sanitize({ placements: [1, 1, 1, 1, 1], points: 290 });
  assert.ok(K.record(c, 1).up, 'passage au rang supérieur signalé');
});
