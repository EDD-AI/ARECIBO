// Tests de la campagne : node --test orbite/tests/campagne.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../js/campagne.js');

test('une expédition commence avec 10 cartes, 60 PV et une carte menant au boss', () => {
  const run = C.newRun(42);
  assert.equal(run.deck.length, 10);
  assert.equal(run.hp, 60);
  assert.equal(run.map.rows.length, C.ROWS);
  assert.ok(run.map.rows[0].length >= 2, 'plusieurs départs');
  for (const n of run.map.rows[C.ROWS - 1]) assert.deepEqual(n.next, ['boss']);
  for (const row of run.map.rows.slice(0, -1)) for (const n of row) assert.ok(n.next.length >= 1, 'chaque étape mène quelque part');
  assert.ok(run.map.rows.every((row, r) => r < 2 ? row.every((n) => n.type === 'combat') : true));
});

test('une carte d’attaque blesse, le Bouclier absorbe, la Fissure amplifie', () => {
  const run = C.newRun(7);
  C.enter(run, run.map.rows[0][0].id);
  const c = run.combat;
  const foe = C.alive(c)[0];
  foe.block = 2;
  c.hand.unshift({ uid: 'x1', id: 'impact', up: false });
  const hp0 = foe.hp;
  const r = C.play(run, 'x1', foe.uid);
  assert.ok(r.ok);
  assert.equal(foe.hp, Math.max(0, hp0 - 4), '6 dégâts dont 2 absorbés');
  foe.st.fissure = 1;
  c.energy = 3;
  c.hand.unshift({ uid: 'x2', id: 'impact', up: true });
  const hp1 = foe.hp;
  C.play(run, 'x2', foe.uid);
  assert.equal(foe.hp, Math.max(0, hp1 - 13), '9 × 1,5 = 13');
});

test('l’énergie limite les cartes jouées', () => {
  const run = C.newRun(9);
  C.enter(run, run.map.rows[0][0].id);
  const c = run.combat;
  c.energy = 1;
  c.hand.unshift({ uid: 'y', id: 'eruption', up: false });
  assert.equal(C.play(run, 'y', C.alive(c)[0].uid).ok, false);
});

test('fin de tour : les ennemis agissent, une nouvelle main est piochée', () => {
  const run = C.newRun(11);
  C.enter(run, run.map.rows[0][0].id);
  const r = C.endTurn(run);
  assert.ok(r.ok);
  assert.ok(r.events.some((e) => e.t === 'act'));
  if (!run.over) {
    assert.equal(run.combat.turn, 2);
    assert.equal(run.combat.hand.length, 5);
    assert.equal(run.combat.energy, 3);
  }
});

test('Kronos appelle ses lunes ; quand il tombe, elles s’enfuient', () => {
  const run = C.newRun(13);
  run.node = run.map.rows[C.ROWS - 1][0].id;
  C.enter(run, 'boss');
  const c = run.combat;
  C.endTurn(run);
  assert.ok(c.enemies.some((u) => u.id === 'lunekronos'), 'lunes appelées');
  const k = c.enemies.find((u) => u.id === 'kronos');
  k.hp = 3; k.block = 0;
  c.energy = 3;
  c.hand.unshift({ uid: 'z', id: 'impact', up: false });
  const r = C.play(run, 'z', k.uid);
  assert.ok(r.events.some((e) => e.t === 'flee'));
  assert.ok(run.won && run.over);
});

test('une partie sauvegardée en JSON reprend à l’identique', () => {
  const a = C.newRun(99);
  C.enter(a, a.map.rows[0][0].id);
  const b = JSON.parse(JSON.stringify(a));
  C.endTurn(a); C.endTurn(b);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('récompenses : trois cartes différentes, un vestige pour un astre puissant', () => {
  const run = C.newRun(21);
  C.enter(run, run.map.rows[0][0].id);
  run.combat.kind = 'elite';
  const r = C.rewards(run);
  assert.equal(new Set(r.cards).size, 3);
  assert.ok(r.relic && run.relics.includes(r.relic));
});

test('chaque carte se joue sans erreur, normale et améliorée', () => {
  for (const id of Object.keys(C.CARDS)) {
    for (const up of [false, true]) {
      const run = C.newRun(5);
      C.enter(run, run.map.rows[0][0].id);
      const c = run.combat;
      c.energy = 9;
      c.hand.unshift({ uid: 'k', id, up });
      const r = C.play(run, 'k', C.alive(c)[0].uid);
      assert.ok(r.ok, id);
      assert.ok(!C.cardText({ id, up }).includes('{'), 'texte résolu');
    }
  }
});
