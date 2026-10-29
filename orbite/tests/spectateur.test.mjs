// Mode spectateur (v98) : node --test orbite/tests/spectateur.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const R = createRequire(import.meta.url)('../js/rules.js');

// Une mêlée où le joueur n'achète rien : il tombe vite.
function loseFast(seed) {
  const st = R.newGame(seed, 'gravite', { size: 8 });
  const me = st.players[0];
  for (let r = 0; r < 60 && !st.over; r++) {
    if (me.relicChoice && me.relicChoice.length) R.chooseRelic(st, 0, me);
    assert.ok(R.endTurn(st).ok);
  }
  return st;
}

test('éliminé d’une mêlée : on regarde la suite jusqu’au vainqueur, sans changer son classement', () => {
  for (const seed of ['spect-a', 'spect-b', 'spect-c']) {
    const st = loseFast(seed);
    const me = st.players[0];
    assert.equal(me.alive, false);
    const rank = st.rank, reward = st.reward;
    if (R.alivePlayers(st).length < 2) continue;
    assert.ok(R.spectate(st).ok);
    assert.equal(st.over, false);
    assert.equal(R.spectate(st).ok, false, 'pas deux fois');
    let shown = 0, res;
    for (let g = 0; g < 80 && !st.over; g++) {
      res = R.endTurn(st, { observer: true, watch: true });
      assert.ok(res.ok);
      assert.equal(res.battle, null, 'le joueur ne combat plus');
      if (res.watched) {
        shown++;
        assert.ok(res.watched.events.length > 0);
        assert.ok(res.watched.a.id !== 'you' && res.watched.b.id !== 'you');
      }
    }
    assert.ok(st.over);
    assert.ok(shown > 0);
    assert.equal(R.alivePlayers(st).length, 1);
    assert.equal(st.players.find((p) => p.id === res.winner).rank, 1);
    assert.equal(st.rank, rank);
    assert.equal(st.reward, reward);
    assert.equal(R.spectate(st).ok, false, 'partie finie : plus rien à regarder');
  }
});

test('rien à regarder : en vie, en duel, ou en ligne', () => {
  const alive = R.newGame('spect-d', 'gravite', { size: 8 });
  assert.equal(R.spectate(alive).ok, false);
  const duel = R.newGame('spect-e', 'gravite', { size: 2 });
  const me = duel.players[0];
  for (let r = 0; r < 80 && !duel.over; r++) { if (me.relicChoice && me.relicChoice.length) R.chooseRelic(duel, 0, me); R.endTurn(duel); }
  assert.equal(R.spectate(duel).ok, false);
});
