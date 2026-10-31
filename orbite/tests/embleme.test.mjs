// Tests des emblèmes de rang (v128) : node --test orbite/tests/embleme.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/embleme.js');
const K = require('../js/classement.js');

test('un dessin 16 × 16 par rang, plus le placement, avec des couleurs connues', () => {
  assert.equal(E.IDS.length, K.TIERS.length);
  for (const id of E.IDS.concat(['placement'])) {
    const a = E.ART[id];
    assert.ok(a, id);
    assert.equal(a.rows.length, 16, id);
    a.rows.forEach((row, y) => {
      assert.equal(row.length, 16, `${id} ligne ${y}`);
      for (const ch of row) assert.ok(ch === '.' || a.pal[ch], `${id} : couleur « ${ch} » inconnue`);
    });
  }
});

test('neuf emblèmes distincts, et chaque division se voit', () => {
  const all = new Set();
  for (let i = 0; i < 9; i++) {
    const divs = i === 8 ? [''] : ['III', 'II', 'I'];
    for (const d of divs) {
      const s = E.svg(i, d);
      assert.match(s, /^<svg class="emb-svg" viewBox="0 0 26 26"/);
      assert.ok(!all.has(s), `rang ${i} ${d} identique à un autre`);
      all.add(s);
    }
    assert.notEqual(E.svg(i, null), E.svg(i, i === 8 ? '' : 'II'), 'sans losanges (échelle des rangs)');
  }
  assert.equal(all.size, 8 * 3 + 1);
  // Le médaillon s'orne avec le rang : ailes dès la Planète, couronne dès la Nébuleuse.
  const px = (s, x, y) => new RegExp(`<rect x="${x}" y="${y}"`).test(s) || [...s.matchAll(/<rect x="(\d+)" y="(\d+)" width="([\d.]+)"/g)].some((m) => +m[2] === y && +m[1] <= x && x < +m[1] + Math.floor(+m[3]));
  assert.ok(!px(E.svg(2, 'I'), 1, 11) && px(E.svg(3, 'III'), 1, 11), 'ailes à partir de la Planète');
  assert.ok(!px(E.svg(5, 'I'), 12, 0) && px(E.svg(6, 'III'), 12, 0), 'couronne à partir de la Nébuleuse');
});

test('placement : un point par partie jouée ; rang connu d’une place au salon ou d’un profil', () => {
  const ps = [0, 1, 2, 3, 4, 5].map((n) => E.placement(n));
  assert.equal(new Set(ps).size, 6);
  assert.equal(E.placement(9), E.placement(5));
  assert.deepEqual(E.infoOf({ points: 412, placed: true }), { placed: true, points: 412, idx: 1, div: 'II', label: 'Astéroïde II', id: 'asteroide' });
  assert.equal(E.infoOf({ points: 0, placed: false, pl: 3 }).done, 3);
  assert.equal(E.infoOf({ placements: [1, 2] }).done, 2, 'état local');
  assert.equal(E.infoOf({ points: 700 }).placed, true, 'ancienne place sans « placed » : des points suffisent');
  assert.equal(E.infoOf({ points: 0 }).placed, false);
  assert.equal(E.infoOf({ points: 0 }).known, false, 'sans rien savoir : un placement inconnu');
  assert.equal(E.of({ points: 2400, placed: true }), E.svg(8, ''));
  assert.equal(E.of({ points: 0, placed: false, pl: 2 }), E.placement(2));
  assert.equal(E.step(450), K.step(450));
});

test('page : emblèmes et traductions chargés et mis en cache hors ligne', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const at = (f) => html.indexOf(`src="${f}"`);
  assert.ok(at('js/classement.js') > 0 && at('js/classement.js') < at('js/embleme.js'), 'classement.js avant embleme.js');
  assert.ok(at('js/embleme.js') < at('js/game.js'), 'emblèmes avant le jeu');
  assert.ok(at('js/lang/classe.js') > 0 && at('js/lang/classe.js') < at('js/game.js'), 'traductions avant le jeu');
  for (const f of ['js/embleme.js', 'js/lang/classe.js']) assert.ok(sw.includes(`'./${f}'`), f + ' en cache');
});
