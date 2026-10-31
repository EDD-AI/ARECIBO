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
  assert.equal(K.record(c, 1).delta, 32);
  assert.equal(c.points, 42);
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

test('le barème dépend du niveau de la partie : le 3e gagne peu ou rien, les derniers perdent', () => {
  assert.equal(K.deltaFor(3, 1000, 1000), 4);
  assert.equal(K.deltaFor(3, 1000, 700), 0, 'partie plus faible : rien pour le 3e');
  assert.ok(K.deltaFor(1, 1000, 1200) > K.deltaFor(1, 1000, 1000), 'battre plus fort rapporte plus');
  assert.ok(K.deltaFor(8, 1000, 1200) > K.deltaFor(8, 1000, 1000), 'perdre contre plus fort coûte moins');
  for (let r = 4; r <= 8; r++) assert.ok(K.deltaFor(r, 0, 3000) < 0, 'les places 4 à 8 perdent toujours');
  assert.ok(K.deltaFor(1, 3000, 0) > 0 && K.deltaFor(2, 3000, 0) > 0, 'les deux premiers gagnent toujours');
});

// ─── Classé entre amis et emblèmes (v128) ───────────────────
test('parties qui comptent : la recherche classée toujours, entre amis dès 2 humains', () => {
  assert.equal(K.MIN_HUMANS, 2);
  assert.ok(K.counts('ranked', 1), 'recherche classée complétée par des bots : elle compte');
  assert.ok(K.counts('ranked', 8));
  assert.ok(!K.counts('private', 1), 'seul face aux bots entre amis : rien');
  assert.ok(!K.counts('private', 0));
  assert.ok(K.counts('private', 2), 'duel entre amis');
  assert.ok(K.counts('private', 5), 'partie entre amis à plusieurs');
  assert.ok(!K.counts(undefined, 4), 'solo : jamais');
  assert.ok(!K.counts('solo', 4));
});

test('niveau de la partie : la moyenne des autres humains seulement, jamais des bots', () => {
  const seats = [{ uid: 'me', points: 900 }, { uid: 'a', points: 300 }, { uid: 'b', points: 500 }];
  assert.equal(K.lobbyOf(seats, 'me'), 400, 'sa propre place ne compte pas');
  assert.equal(K.lobbyOf([{ uid: 'me', points: 900 }], 'me'), null, 'seul humain : pas d’ajustement');
  assert.equal(K.lobbyOf([{ uid: 'me', points: 900 }, { uid: 'bot1', bot: true, points: 3000 }], 'me'), null, 'un bot ne gonfle pas la partie');
  assert.equal(K.lobbyOf([{ uid: 'me', points: 0 }, { uid: 'a', points: 1000 }, { uid: 'b', bot: true, points: 9999 }], 'me'), 1000);
  assert.equal(K.lobbyOf([{ uid: 'me' }, { uid: 'a', points: 'x' }, { uid: 'b', points: -50 }], 'me'), 0, 'points illisibles ou négatifs : zéro');
  assert.equal(K.lobbyOf(null, 'me'), null);
  // Les bots n'entrent pas dans l'ajustement : un 1er entre amis seul face à des bots « forts » ne
  // rapporterait pas plus (et la partie ne compte de toute façon pas, counts).
  assert.equal(K.deltaFor(1, 500, K.lobbyOf([{ uid: 'me', points: 500 }, { uid: 'x', bot: true, points: 2400 }], 'me')), K.DELTA[0]);
});

test('place classée : duel gagné = 2e, perdu = 6e, abandon = 8e', () => {
  assert.equal(K.placeOf(1, true, false), 2);
  assert.equal(K.placeOf(2, true, false), 6);
  assert.equal(K.placeOf(1, true, true), 8);
  assert.equal(K.placeOf(3, false, false), 3);
  assert.equal(K.placeOf(0, false, false), 8);
  assert.equal(K.placeOf(5, false, true), 8);
});

test('divisions : étapes de 0 (Poussière III) à 24 (Singularité), montée et descente signalées', () => {
  assert.equal(K.step(0), 0);
  assert.equal(K.step(99), 0);
  assert.equal(K.step(100), 1);
  assert.equal(K.step(299), 2);
  assert.equal(K.step(300), 3);
  assert.equal(K.step(2399), 23);
  assert.equal(K.step(2400), 24);
  assert.equal(K.step(9000), 24);
  let c = K.sanitize({ placements: [2, 2, 2, 2, 2], points: 190 });
  let r = K.record(c, 1, 400);
  assert.ok(r.divUp && !r.up, 'Poussière II → I : division, pas rang');
  assert.equal(r.before, 190);
  assert.equal(r.from.label, 'Poussière II');
  c = K.sanitize({ placements: [2, 2, 2, 2, 2], points: 305 });
  r = K.record(c, 6, 300);
  assert.ok(r.down && r.divDown, 'Astéroïde III → Poussière I : rang et division');
  c = K.sanitize({ placements: [2, 2, 2, 2, 2], points: 150 });
  r = K.record(c, 4, 150);
  assert.ok(!r.divUp && !r.divDown && !r.up && !r.down, 'même division');
});
