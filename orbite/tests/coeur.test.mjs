// Tests du Cœur (ère II, chapitre 2) : node --test orbite/tests/coeur.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../js/coeur.js');
const mid = (C.N - 1) / 2;

// Chauffe en spirale sur tout l'astre pendant `sec` secondes.
function heatAll(c, sec) {
  for (let t = 0; t < sec; t += 1 / 30) {
    const a = t * 2.2, r = 6 + 20 * ((t / 7) % 1);
    C.step(c, 1 / 30, { heat: true, x: mid + Math.cos(a) * r, y: mid + Math.sin(a) * r });
    c.events.length = 0;
  }
}

test('déterministe, et l’astre commence mélangé', () => {
  const a = C.newGame(9, {}), b = C.newGame(9, {});
  assert.deepEqual([...a.mat], [...b.mat]);
  assert.ok(C.score(a) < 0.2);
  const kinds = new Set(a.geo.cells.map((i) => a.mat[i]));
  for (const m of [C.GAZ, C.GLACE, C.ROCHE, C.FER]) assert.ok(kinds.has(m));
});

test('chauffer trie les couches : le fer coule au centre', () => {
  const c = C.newGame(3, { comp: { glace: 0.3, roche: 0.4, gaz: 0.1, fer: 0.2 } });
  const s0 = C.score(c), core0 = C.result(c).core;
  heatAll(c, 75);
  for (let t = 0; t < 40; t += 1 / 30) { C.step(c, 1 / 30, {}); c.events.length = 0; }
  assert.ok(C.score(c) > s0 + 0.3, `score ${C.score(c)}`);
  assert.ok(C.result(c).core > core0 + 0.2);
});

test('l’énergie du doigt s’épuise', () => {
  const c = C.newGame(3, {});
  heatAll(c, 90);
  assert.equal(c.energy, 0);
});

test('surchauffer la surface : éruptions et croûte volcanique', () => {
  const c = C.newGame(5, {});
  const edge = c.geo.cells.find((i) => c.geo.surface[i] && (c.mat[i] === C.ROCHE || c.mat[i] === C.FER));
  const x = edge % C.N, y = Math.floor(edge / C.N);
  for (let t = 0; t < 20; t += 1 / 30) { C.step(c, 1 / 30, { heat: true, x, y }); }
  assert.ok(c.stats.eruptions > 0);
  assert.ok(c.events.some((e) => e.t === 'eruption'));
});

test('les lunes chauffent le cœur par les marées', () => {
  const a = C.newGame(7, { moons: 6 }), b = C.newGame(7, { moons: 0 });
  for (let t = 0; t < 20; t += 1 / 30) { C.step(a, 1 / 30, {}); C.step(b, 1 / 30, {}); }
  assert.ok(C.meanTemp(a) > C.meanTemp(b));
});

test('bilan et sauvegarde', () => {
  const c = C.newGame(4, { comp: { glace: 0.3, roche: 0.4, gaz: 0.1, fer: 0.2 } });
  heatAll(c, 20);
  const r = C.result(c);
  for (const k of ['score', 'core', 'ocean', 'atmo', 'field', 'crustKind', 'water', 'air']) assert.ok(k in r, k);
  const d = C.restore(JSON.parse(JSON.stringify(C.serialize(c))));
  assert.deepEqual([...d.mat], [...c.mat]);
  assert.equal(d.energy, c.energy);
});
