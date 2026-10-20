// Tests du multijoueur (moteur) : node --test orbite/tests/multi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../js/rules.js');

// Une partie à plusieurs téléphones : chacun a son état ; l'hôte publie les bots. Option : un joueur
// publie en retard certaines manches (l'hôte retient alors son plateau précédent).
function play(seed, laws, late) {
  const humans = Object.keys(laws), fam = R.mpFamilies(seed);
  const states = {};
  for (const h of humans) states[h] = R.newGame(seed, laws[h], { families: fam, seats: humans.filter((x) => x !== h).map((x) => ({ id: x, name: x, law: null })), mp: { me: h } });
  let last = {}, round = 0;
  const views = [];
  while (round++ < 40) {
    const snaps = {};
    for (const h of humans) {
      const st = states[h];
      if (st.over) continue;
      R.botTurn(st, st.players[0]);
      assert.ok(R.mpLock(st, h === humans.find((x) => !states[x].over)).ok);
      snaps[h] = R.snapshotOf(st, st.players[0]);
    }
    const host = humans.find((h) => !states[h].over);
    if (!host) break;
    for (const p of states[host].players) if (p.bot && p.alive) snaps[p.id] = R.snapshotOf(states[host], p);
    if (late && round % 3 === 0 && last[late] && snaps[late]) snaps[late] = last[late];
    last = Object.assign({}, last, snaps);
    const playing = humans.filter((h) => states[h].phase === 'lock');
    for (const h of playing) assert.ok(R.mpResolve(states[h], snaps, []).ok);
    const view = (h) => states[h].players.map((p) => (p.id === 'you' ? h : p.id) + ':' + p.hp + ':' + p.alive).sort().join(' ');
    views.push(playing.map(view));
    if (humans.every((h) => states[h].over)) break;
  }
  return { states, views };
}

test('tous les téléphones voient les mêmes PV à chaque manche, même avec des lois de PV différentes', () => {
  const { states, views } = play('M1', { a: 'sacrifice', b: 'endurance', c: 'phenix' });
  for (const v of views) for (const x of v) assert.equal(x, v[0]);
  assert.ok(Object.values(states).every((s) => s.over));
  const ranks = Object.values(states).map((s) => s.rank);
  assert.equal(new Set(ranks).size, ranks.length, 'des places différentes');
});

test('un plateau publié en retard ne crée pas d’écart', () => {
  const { views } = play('M2', { a: R.LAWS[0].id, b: R.LAWS[1].id }, 'b');
  for (const v of views) for (const x of v) assert.equal(x, v[0]);
});

test('paires identiques pour tous, combats retournés pour se voir en bas', () => {
  const p1 = R.mpPairs('S', 3, ['x', 'b', 'k', 'a', 'z']), p2 = R.mpPairs('S', 3, ['a', 'z', 'x', 'k', 'b']);
  assert.deepEqual(p1, p2);
  assert.equal(p1.pairs.length, 2);
  assert.ok(p1.odd);
  const ev = [{ t: 'start', boards: [[1], [2]] }, { t: 'first', side: 0 }, { t: 'die', cid: 'c1', side: 1 }, { t: 'end', winner: 1, damage: 3 }];
  const m = R.mirror(ev);
  assert.deepEqual(m[0].boards, [[2], [1]]);
  assert.equal(m[1].side, 1);
  assert.equal(m[2].side, 0);
  assert.equal(m[3].winner, 0);
});

test('les familles et les lois proposées sont communes à la partie', () => {
  const f = R.mpFamilies('ABC');
  assert.equal(f.length, 5);
  assert.deepEqual(f, R.mpFamilies('ABC'));
  for (const id of R.mpLawChoices('ABC', f, 'u1')) assert.ok(R.LAW[id].fam === 'neutre' || f.includes(R.LAW[id].fam));
});
