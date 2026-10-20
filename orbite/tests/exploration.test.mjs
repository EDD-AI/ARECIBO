// Tests de l'exploration : node --test orbite/tests/exploration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const X = require('../js/exploration.js');
const C = require('../js/colonie-jeu.js');

test('le monde est déterministe, infini et en relief', () => {
  const a = X.world(42), b = X.world(42), c = X.world(43);
  for (const [x, y] of [[300, 10], [-500, 900], [10000, -10000]]) assert.equal(X.height(a, x, y), X.height(b, x, y));
  let diff = 0, lo = 99, hi = 0;
  for (let y = -400; y < 400; y += 7) for (let x = -400; x < 400; x += 7) {
    const h = X.height(a, x, y);
    lo = Math.min(lo, h); hi = Math.max(hi, h);
    if (h !== X.height(c, x, y)) diff++;
  }
  assert.ok(hi - lo >= 12, 'du relief : ' + lo + ' → ' + hi);
  assert.ok(diff > 1000, 'une autre graine, un autre monde');
  assert.equal(X.height(a, 64, 64), X.BASE.h, 'la base est plate');
});

test('un tronçon se génère : plein, déterministe, dans les limites', () => {
  const w = X.world(7);
  const m1 = X.chunk(w, 5, -3, new Set()), m2 = X.chunk(X.world(7), 5, -3, new Set());
  assert.deepEqual(m1.v, m2.v);
  assert.equal(m1.X, X.CHUNK);
  assert.ok(m1.count() > X.CHUNK * X.CHUNK);
});

test('découvertes : environ un tronçon sur trois, jamais dans la base, ramassées une seule fois', () => {
  const w = X.world(99);
  let n = 0;
  for (let cy = -15; cy < 15; cy++) for (let cx = -15; cx < 15; cx++) {
    const p = X.poi(w, cx, cy);
    if (p) { n++; assert.ok(!X.inBase(p.x, p.y)); assert.ok(X.POI[p.type]); }
  }
  assert.ok(n > 200 && n < 400, n + ' découvertes sur 900 tronçons');
  const col = C.create('e', 99, 'mars', 1);
  const p = { id: 't', x: 0, y: 0, type: 'meteorite' };
  const m0 = col.stock.materials;
  assert.ok(X.collect(col, p));
  assert.equal(col.stock.materials, m0 + 70);
  assert.equal(X.collect(col, p), null, 'déjà ramassée');
});

test('le rover trouve son chemin sans gravir de falaise', () => {
  const w = X.world(1234);
  const r = X.path(w, [X.START.x, X.START.y], [X.START.x + 50, X.START.y + 25]);
  assert.ok(r.pts.length > 50);
  for (let i = 1; i < r.pts.length; i++) {
    const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i];
    assert.equal(Math.abs(ax - bx) + Math.abs(ay - by), 1);
    assert.ok(Math.abs(X.height(w, ax, ay) - X.height(w, bx, by)) <= 2);
  }
});
