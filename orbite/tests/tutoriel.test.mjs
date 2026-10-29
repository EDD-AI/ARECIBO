// Duel d'entraînement des nouveaux joueurs (v97) : node --test orbite/tests/tutoriel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const R = createRequire(import.meta.url)('../js/rules.js');

// Un débutant : achète le premier astre venu, le place, ne monte jamais de niveau, ne vend rien.
function beginner(st, p) {
  if (p.relicChoice && p.relicChoice.length) R.chooseRelic(st, 0, p);
  for (let g = 0; g < 40; g++) {
    if (p.discover.length) { R.choose(st, 0, p); continue; }
    if (p.hand.length && p.board.length < R.BOARD_MAX) { R.play(st, p.hand[0].uid, p.board.length, null, p); continue; }
    const slot = p.shop.findIndex((id) => id);
    if (slot >= 0 && R.canBuy(st, slot, p).ok && p.hand.length + p.board.length < R.BOARD_MAX) { R.buy(st, slot, p); continue; }
    break;
  }
}

test('la Sentinelle : 20 PV, une loi simple, pas d’événement', () => {
  const st = R.newGame('tutoriel', 'gravite', { size: 2, tutorial: true });
  const t = st.players[1];
  assert.equal(st.tutorial, true);
  assert.equal(t.name, 'SENTINELLE');
  assert.equal(t.hp, R.TUTOR.hp);
  assert.equal(t.maxHp, 20);
  assert.ok(R.TUTOR.laws.includes(t.law));
  assert.equal(st.players[0].hp, 60, 'le joueur garde ses PV de duel');
  assert.equal(st.event, null);
  // Sans l'option, rien ne change.
  const n = R.newGame('tutoriel', 'gravite', { size: 2 });
  assert.notEqual(n.players[1].name, 'SENTINELLE');
  assert.equal(n.tutorial, undefined);
});

test('la Sentinelle reste faible : niveau 2 et 4 astres au plus ; un débutant la bat presque toujours', () => {
  let wins = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const st = R.newGame('tutoriel-' + i, 'gravite', { size: 2, tutorial: true });
    const t = st.players[1];
    for (let r = 0; r < 40 && !st.over; r++) {
      if (st.players[0].alive) beginner(st, st.players[0]);
      const res = R.endTurn(st, { observer: true });
      assert.ok(res.ok, res.error);
      assert.ok(t.tier <= R.TUTOR.tier);
      assert.ok(t.board.length + t.hand.length <= R.TUTOR.board + 1, 'au plus un astre de plus par cycle au-delà de 4');
    }
    if (st.players[0].rank === 1) wins++;
  }
  assert.ok(wins / N >= 0.8, `victoires du débutant : ${wins}/${N}`);
});
