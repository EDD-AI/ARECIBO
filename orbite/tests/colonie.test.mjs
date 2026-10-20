// Tests de la colonie (règles et simulation) : node --test orbite/tests/colonie.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const C = require('../js/colonie-jeu.js');
const E = require('../js/building-engine.js');

// Cherche la première place libre (en spirale depuis le centre) où ce bâtiment peut se poser.
function placeNear(col, key, dust) {
  const c = col.S / 2;
  for (let r = 0; r < col.S / 2; r++) {
    for (let y = c - r; y <= c + r; y++) for (let x = c - r; x <= c + r; x++) {
      if (Math.max(Math.abs(x - c), Math.abs(y - c)) !== r) continue;
      const res = C.build(col, key, x, y, dust || 0);
      if (res.ok) return res;
    }
  }
  return null;
}

test('chaque bâtiment du catalogue de la colonie existe et a un prix', () => {
  for (const tier of C.TIERS) for (const k of tier.keys) {
    assert.ok(E.TYPE_BY_KEY[k], k + ' inconnu');
    const p = C.price(k);
    assert.ok(k === 'tour' ? p.materials === 0 : p.materials > 0, k + ' sans prix');
  }
  assert.equal(C.price('fusion').dust, 150);
  assert.equal(C.price('solaire').dust, 0);
});

test('la tour de contrôle vient en premier, puis une seule fois', () => {
  const col = C.create('a', 42, 'mars', 1);
  assert.equal(C.canPlace(col, 'solaire', 30, 30, 0).ok, false);
  assert.ok(placeNear(col, 'tour'));
  assert.equal(C.canPlace(col, 'tour', 10, 10, 0).ok, false);
  assert.ok(placeNear(col, 'solaire'));
  assert.equal(C.demolish(col, col.built[0].uid).ok, false);
});

test('deux bâtiments ne se chevauchent pas et restent sur le terrain', () => {
  const col = C.create('b', 7, 'mars', 1);
  const t = placeNear(col, 'tour');
  assert.equal(C.canPlace(col, 'solaire', t.b.x, t.b.y, 0).ok, false);
  assert.equal(C.canPlace(col, 'solaire', 0, 0, 0).ok, false);
  assert.equal(C.canPlace(col, 'solaire', col.S - 2, col.S - 2, 0).ok, false);
});

test('les extracteurs se posent sur la glace, les forages sur le minerai', () => {
  const col = C.create('c', 99, 'mars', 1);
  placeNear(col, 'tour');
  const dep = C.deposits(col);
  const c = col.S / 2;
  assert.equal(dep.ice[c * col.S + c], 0, 'le centre reste libre');
  let refused = false;
  for (let y = 2; y < col.S - 30 && !refused; y += 3) for (let x = 2; x < col.S - 30 && !refused; x += 3) refused = C.canPlace(col, 'extracteur', x, y, 0).reason === 'Il faut le poser sur un gisement de glace.';
  assert.ok(refused, 'hors de la glace, l’extracteur est refusé');
  const ex = placeNear(col, 'extracteur');
  assert.ok(ex, 'un extracteur trouve sa glace');
  const fp = C.footprint('extracteur', ex.b.seed);
  let n = 0;
  for (let y = ex.b.y; y < ex.b.y + fp.Y; y++) for (let x = ex.b.x; x < ex.b.x + fp.X; x++) n += dep.ice[y * col.S + x];
  assert.ok(n >= fp.X * fp.Y * 0.25);
});

test('la recherche débloque les paliers ; les bâtiments rares coûtent des poussières', () => {
  const col = C.create('d', 5, 'mars', 1);
  placeNear(col, 'tour');
  assert.equal(C.unlocked(col, 'ferme'), false);
  assert.equal(C.canPlace(col, 'ferme', 20, 20, 0).reason, 'Recherche insuffisante.');
  col.stock.research = 200;
  col.stock.materials = 2000;
  assert.equal(C.unlocked(col, 'usine'), true);
  assert.equal(placeNear(col, 'usine', 0), null, 'sans poussières, pas d’usine');
  const u = placeNear(col, 'usine', 1000);
  assert.ok(u && u.dust === 40);
});

test('démolir rend la moitié des matériaux', () => {
  const col = C.create('e', 3, 'mars', 1);
  placeNear(col, 'tour');
  const before = col.stock.materials;
  const s = placeNear(col, 'solaire');
  const back = C.demolish(col, s.b.uid).back;
  assert.equal(back, Math.floor(C.price('solaire').materials / 2));
  assert.equal(col.stock.materials, before - C.price('solaire').materials + back);
});

test('sans support vital, les colons repartent ; avec, la colonie grandit', () => {
  const lost = C.create('f', 11, 'mars', 1);
  placeNear(lost, 'tour');
  const ev = C.step(lost, 200);
  assert.equal(lost.colonists, 0);
  assert.ok(ev.some((e) => e.t === 'depart'));

  const col = C.create('g', 11, 'mars', 1);
  for (const k of ['tour', 'solaire', 'solaire', 'solaire', 'solaire', 'rtg', 'moxie', 'serre', 'serre', 'condenseur', 'condenseur', 'module', 'module', 'labo']) assert.ok(placeNear(col, k), k + ' posé');
  C.step(col, 120);
  assert.ok(col.colonists > 4, 'des colons sont arrivés : ' + col.colonists);
  assert.ok(col.stock.research > 0);
  for (const f of C.LIFE) assert.ok(col.stock[f] > 0, f + ' épuisé');
});

test('le temps réel est rattrapé au retour, plafonné à trois jours', () => {
  const col = C.create('h', 1, 'mars', 1000);
  assert.deepEqual(C.catchUp(col, 1000 + C.SOL_MS - 1), []);
  assert.equal(col.sol, 0);
  C.catchUp(col, 1000 + 5 * C.SOL_MS + 10);
  assert.equal(col.sol, 5);
  C.catchUp(col, col.last + 30 * 24 * 60 * C.SOL_MS);
  assert.equal(col.sol, 5 + C.MAX_CATCHUP);
});

test('la scène de la colonie se construit et contient les bâtiments', () => {
  const col = C.create('i', 8, 'lune', 1);
  const empty = C.scene(col, 0).m.v.reduce((n, v) => n + (v ? 1 : 0), 0);
  placeNear(col, 'tour');
  const full = C.scene(col, 0).m.v.reduce((n, v) => n + (v ? 1 : 0), 0);
  assert.ok(full > empty);
});
