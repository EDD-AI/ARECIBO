// Tests de la Sculpture (ère II, chapitre 3) : node --test orbite/tests/sculpture.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../js/sculpture.js');

// Lisse tout l'astre : un coup de pinceau sur une grille de points.
function smoothAll(s, sec) {
  for (let lat = -1.2; lat <= 1.21; lat += 0.4) for (let lon = -3; lon <= 3; lon += 0.45) S.apply(s, 'lisser', lon, lat, sec);
}

test('déterministe ; au départ, un rocher bosselé et cratérisé', () => {
  const a = S.newGame(5, {}), b = S.newGame(5, {});
  assert.deepEqual([...a.forme], [...b.forme]);
  assert.ok(S.roundness(a) < 0.2);
  assert.equal(S.canFinish(a), false);
});

test('lisser arrondit l’astre ; la gravité aussi, lentement', () => {
  const s = S.newGame(5, {});
  smoothAll(s, 1.5);
  assert.ok(S.roundness(s) >= S.ROUND_GOAL, 'rondeur ' + S.roundness(s));
  const t = S.newGame(5, {}), r0 = S.roundness(t);
  for (let i = 0; i < 600; i++) S.step(t, 0.1);
  assert.ok(S.roundness(t) > r0 + 0.1);
});

test('impacts : deux bassins ; soulever : des montagnes', () => {
  const s = S.newGame(6, {});
  const b0 = S.basins(s);
  S.apply(s, 'impact', 0, 0, 0); S.apply(s, 'impact', 0.1, 0.05, 0);
  S.apply(s, 'impact', 2.5, -0.4, 0); S.apply(s, 'impact', 2.6, -0.35, 0);
  assert.ok(S.basins(s) >= Math.max(2, b0));
  for (let i = 0; i < 30; i++) for (const lon of [-1.8, -1.4, -1, -0.6]) S.apply(s, 'soulever', lon, 0.5, 0.1);
  assert.ok(S.mountains(s) * 100 >= 3, 'montagnes ' + S.mountains(s));
});

test('volcans et glace selon le chemin', () => {
  const v = S.newGame(7, { core: { crustKind: 'volcanique', water: 'sec' } });
  assert.ok(S.goals(v).some((g) => g.id === 'volcans' && g.goal === 3));
  for (let i = 0; i < 4; i++) assert.ok(S.apply(v, 'volcan', i, 0.2, 0));
  assert.equal(S.avail(S.newGame(7, { core: { water: 'sec' }, nature: 'vie' })).glace, false);
  const g = S.newGame(8, { core: { water: 'oceans' } });
  assert.ok(S.goals(g).some((x) => x.id === 'glace'));
  for (let i = 0; i < 6; i++) S.apply(g, 'glace', i, 1.2, 0.2);
  assert.ok(S.iceCover(g) > 0.02);
});

test('un astre sculpté peut finir le chapitre', () => {
  const s = S.newGame(9, { core: { crustKind: 'solide', water: 'sec' } });
  smoothAll(s, 1.5);
  S.apply(s, 'impact', 0, 0, 0); S.apply(s, 'impact', 0.1, 0.05, 0);
  S.apply(s, 'impact', 2.5, -0.4, 0); S.apply(s, 'impact', 2.6, -0.35, 0);
  for (let i = 0; i < 30; i++) for (const lon of [-1.8, -1.4, -1, -0.6]) S.apply(s, 'soulever', lon, 0.5, 0.1);
  S.apply(s, 'volcan', 1, 1, 0);
  assert.deepEqual(S.goals(s).filter((g) => !g.ok).map((g) => g.id), []);
  assert.ok(S.canFinish(s));
});

test('sauvegarde et reprise', () => {
  const s = S.newGame(3, { nature: 'eau', core: { water: 'oceans' } });
  S.apply(s, 'impact', 1, 0.3, 0);
  S.apply(s, 'glace', 0, 1, 0.3);
  const t = S.restore(JSON.parse(JSON.stringify(S.serialize(s))));
  assert.ok(Math.abs(S.roundness(t) - S.roundness(s)) < 0.02);
  assert.equal(S.basins(t), S.basins(s));
  assert.equal(S.iceCover(t), S.iceCover(s));
});
