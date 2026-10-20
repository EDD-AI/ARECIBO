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
  col.zone = C.ZONES.length - 1;
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

test('la pépinière fait pousser la prairie puis les arbres, sur plusieurs jours', () => {
  const col = C.create('j', 77, 'mars', 1);
  col.stock.research = 100; col.stock.materials = 2000;
  for (const k of ['tour', 'solaire', 'solaire', 'condenseur', 'condenseur', 'moxie']) assert.ok(placeNear(col, k), k);
  const p = placeNear(col, 'pepiniere');
  assert.ok(p, 'pépinière posée');
  const at = (days) => { p.b.g = days * 1440; return C.vegetation(col); };
  assert.equal(at(0).grass, 0);
  const d1 = at(1), d3 = at(3), d7 = at(7);
  assert.ok(d1.grass > 0 && d1.trees.length === 0, 'au bout d’un jour : de l’herbe, pas encore d’arbres');
  assert.ok(d3.grass > d1.grass * 3, 'la prairie s’étend');
  assert.ok(d7.grass > d3.grass && d7.adults > 0, 'au bout d’une semaine : des arbres adultes');
  // Jamais sur la glace, le minerai ou sous un bâtiment.
  const dep = C.deposits(col);
  for (let i = 0; i < d7.lvl.length; i++) if (d7.lvl[i]) assert.ok(!dep.ice[i] && !dep.ore[i]);
  for (const b of col.built) {
    const f = C.footprint(b.key, b.seed);
    for (let y = b.y; y < b.y + f.Y; y++) for (let x = b.x; x < b.x + f.X; x++) assert.equal(d7.lvl[y * col.S + x], 0, b.key + ' recouvert');
  }
});

test('la pépinière ne pousse qu’avec de l’eau et de l’énergie, et donne de l’oxygène', () => {
  const col = C.create('k', 9, 'mars', 1);
  col.stock.research = 100; col.stock.materials = 2000;
  placeNear(col, 'tour');
  const p = placeNear(col, 'pepiniere');
  col.stock.water = 0;
  C.step(col, 10);
  assert.equal(p.b.g || 0, 0, 'sans eau, rien ne pousse');
  col.stock.water = 100; col.colonists = 4;
  for (const k of ['solaire', 'solaire', 'condenseur']) placeNear(col, k);
  C.step(col, 20);
  assert.ok(p.b.g > 10, 'avec eau et énergie, la croissance avance (au rythme des ouvriers)');
  const before = C.rates(col).oxygen;
  p.b.g = 7 * 1440;
  assert.ok(C.rates(col).oxygen > before + 5, 'une prairie mûre produit de l’oxygène');
});

test('sans matériaux, la colonie n’est jamais bloquée : récupération et navette', () => {
  const col = C.create('m', 21, 'mars', 1);
  placeNear(col, 'tour');
  col.stock.materials = 0;
  assert.equal(placeNear(col, 'forage'), null, 'plus de quoi construire');
  // Les rovers de la tour récupèrent 1 matériau par sol : un forage redevient possible.
  C.step(col, C.price('forage').materials);
  assert.ok(col.stock.materials >= C.price('forage').materials);
  // La navette : 100 matériaux contre 25 poussières, dans la limite du stockage.
  col.stock.materials = 0;
  assert.equal(C.supply(col, 10).ok, false);
  const s = C.supply(col, 100);
  assert.ok(s.ok && s.n === 100 && s.dust === 25);
  assert.equal(col.stock.materials, 100);
  col.stock.materials = C.rates(col).caps.materials;
  assert.equal(C.supply(col, 100).reason, 'Le stockage de matériaux est plein.');
});

test('la zone de la colonie : 64 × 64 au départ, agrandie par paliers, bâtir dehors est refusé', () => {
  const col = C.create('z', 31, 'mars', 1);
  assert.equal(C.zoneBox(col).size, 64);
  placeNear(col, 'tour');
  const z = C.zoneBox(col);
  assert.equal(C.canPlace(col, 'solaire', z.x1 + 2, 60, 0).reason, 'Hors de la zone de la colonie : agrandissez-la.');
  col.stock.materials = 0;
  assert.equal(C.expand(col, 1000).ok, false);
  col.stock.materials = 5000;
  const sizes = [];
  for (let r = C.expand(col, 1000); r.ok; r = C.expand(col, 1000)) sizes.push(r.size);
  assert.deepEqual(sizes, [80, 96, 112, 128]);
  assert.equal(C.nextZone(col), null);
  // Une colonie d'avant les zones reçoit le palier qui contient déjà tous ses bâtiments.
  const old = C.create('o', 31, 'mars', 1);
  delete old.zone;
  old.built.push({ uid: 1, key: 'tour', x: 20, y: 20, seed: 3 });
  assert.ok(C.zoneBox(old).x0 <= 20);
});

test('les rovers roulent : récupération, transporteurs, chemins qui évitent les bâtiments', () => {
  const col = C.create('rv', 1234, 'mars', 1);
  col.stock.materials = 5000; col.stock.research = 100;
  assert.deepEqual(C.rovers(col, 0), [], 'pas de rover sans tour');
  for (const k of ['tour', 'solaire', 'forage', 'extracteur', 'moxie']) assert.ok(placeNear(col, k), k);
  const a = C.rovers(col, 100), b = C.rovers(col, 104);
  assert.equal(a.length, 3, 'un rover de récupération et deux transporteurs');
  assert.ok(a.some((r, i) => Math.abs(r.x - b[i].x) + Math.abs(r.y - b[i].y) > 0.5), 'ils se déplacent');
  // Sur des milliers d'instants, jamais à l'intérieur d'un bâtiment.
  for (let t = 0; t < 400; t += 0.7) for (const r of C.rovers(col, t)) {
    for (const q of col.built) {
      const f = C.footprint(q.key, q.seed), x = Math.round(r.x), y = Math.round(r.y);
      assert.ok(!(x >= q.x && x < q.x + f.X && y >= q.y && y < q.y + f.Y), 'rover dans ' + q.key);
    }
  }
  assert.ok(C.roverVoxels(a[0], 5, true).length > 15);
});
