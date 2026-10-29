// Tests des missions du jour (js/missions.js) : node --test orbite/tests/missions.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../js/missions.js');

const facts = (o) => Object.assign({ quit: false, rank: 2, duel: true, win: false, sold: 0, rolls: 0, fights: 0, goldens: 0, famCount: {}, tier: 1, damage: 0, goldenBoard: 0 }, o);

test('trois missions par jour : une facile, une moyenne, une difficile, toujours les mêmes', () => {
  const a = M.generate('2026-10-29', '4242'), b = M.generate('2026-10-29', '4242');
  assert.deepEqual(a, b);
  assert.deepEqual(a.map((m) => M.BY_ID[m.id].tier), [0, 1, 2]);
  for (const m of a) { assert.equal(m.p, 0); assert.equal(m.claimed, false); assert.ok(m.r >= 40 && m.r <= 100); }
  // D'un jour à l'autre (et d'un joueur à l'autre), le tirage change.
  const days = new Set(Array.from({ length: 30 }, (_, i) => M.generate('2026-11-' + String(i + 1).padStart(2, '0'), '4242').map((m) => m.id).join()));
  assert.ok(days.size > 5);
});

test('les missions avancent en fin de partie ; un abandon ne compte pas', () => {
  const list = [{ id: 'jouer', n: 3, r: 40, p: 0, claimed: false }, { id: 'dores', n: 2, r: 60, p: 0, claimed: false }, { id: 'gagner', n: 2, r: 90, p: 0, claimed: false }];
  assert.deepEqual(M.advance(list, facts({ quit: true, goldens: 5, win: true })), []);
  assert.deepEqual(list.map((m) => m.p), [0, 0, 0]);
  M.advance(list, facts({ goldens: 1 }));
  assert.deepEqual(list.map((m) => m.p), [1, 1, 0]);
  const done = M.advance(list, facts({ goldens: 3, win: true, rank: 1 }));
  assert.deepEqual(done.map((m) => m.id), ['dores']);
  assert.deepEqual(list.map((m) => m.p), [2, 2, 1], 'la progression ne dépasse pas le but');
  // Une victoire en mêlée ne compte pas pour « Gagner des duels ».
  M.advance(list, facts({ duel: false, win: true, rank: 1 }));
  assert.equal(list[2].p, 1);
});

test('missions « au mieux d’une partie » : famille, niveau, dorés à la victoire', () => {
  const list = [{ id: 'famille', fam: 'glace', n: 4, r: 70, p: 0, claimed: false }, { id: 'niveau', n: 5, r: 60, p: 0, claimed: false }, { id: 'dorevic', n: 2, r: 100, p: 0, claimed: false }];
  M.advance(list, facts({ famCount: { glace: 3, vie: 5 }, tier: 4, goldenBoard: 3 }));
  assert.deepEqual(list.map((m) => m.p), [3, 4, 0], 'les dorés ne comptent que pour une victoire');
  M.advance(list, facts({ famCount: { glace: 1 }, tier: 2 }));
  assert.deepEqual(list.map((m) => m.p), [3, 4, 0], 'une moins bonne partie ne fait pas reculer');
  const done = M.advance(list, facts({ famCount: { glace: 4 }, tier: 6, win: true, rank: 1, goldenBoard: 2 }));
  assert.equal(done.length, 3);
});

test('changer une mission : même niveau, jamais une mission déjà proposée', () => {
  for (let d = 1; d <= 20; d++) {
    const day = '2026-12-' + String(d).padStart(2, '0');
    const list = M.generate(day, '1234');
    for (let i = 0; i < 3; i++) {
      const nm = M.swap(list, i, day, '1234');
      assert.ok(nm);
      assert.equal(M.BY_ID[nm.id].tier, M.BY_ID[list[i].id].tier);
      assert.ok(!list.some((m) => m.id === nm.id));
    }
  }
});
