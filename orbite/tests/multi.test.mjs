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
    // La réserve partagée reste conservée sur chaque téléphone (v106) : plateaux des autres compris.
    for (const h of playing) assert.deepEqual(R.poolAudit(states[h]), states[h].poolTotal, 'réserve de ' + h + ', manche ' + round);
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

test('réserve partagée en ligne (v106) : les astres des autres sortent de la réserve de chaque téléphone', () => {
  const seed = 'POOL1', fam = R.mpFamilies(seed);
  const law = R.LAWS.find((l) => fam.includes(l.fam)).id;
  const mk = (me, other) => R.newGame(seed, law, { families: fam, seats: [{ id: other, name: other, law: null }], mp: { me } });
  const a = mk('a', 'b'), b = mk('b', 'a');
  // a garde quatre copies d'un astre de niveau 1 (un doré et un simple) ; b ne l'a jamais vu.
  const starters = new Set(R.LAWS.map((l) => l.starter));
  const id = Object.keys(a.pool).find((k) => R.CARD[k].tier === 1 && !R.CARD[k].legend && !starters.has(k));
  // Copies encore disponibles chez b : réserve + vitrines (les vitrines se renouvellent à la manche).
  const avail = (st) => st.pool[id] + st.players.reduce((n, p) => n + p.shop.concat(p.discover).filter((x) => x === id).length, 0);
  const before = avail(b);
  a.pool[id] -= 4;
  a.players[0].board = [{ uid: 'x1', id, golden: true, atk: 4, hp: 4, kw: [], att: [], row: 0 }, { uid: 'x2', id, golden: false, atk: 2, hp: 2, kw: [], att: [], row: 0 }];
  for (const st of [a, b]) assert.ok(R.mpLock(st, st === a).ok);
  const snaps = { a: R.snapshotOf(a, a.players[0]), b: R.snapshotOf(b, b.players[0]) };
  for (const p of a.players) if (p.bot && p.alive) snaps[p.id] = R.snapshotOf(a, p);
  assert.ok(R.mpResolve(b, snaps, []).ok);
  assert.equal(avail(b), before - 4, 'les 4 copies de a ne sont plus disponibles chez b');
  assert.deepEqual(R.poolAudit(b), b.poolTotal);
  const held = b.players.find((p) => p.id === 'a').board.reduce((n, u) => n + R.copiesOf(u).filter((x) => x === id).length, 0);
  assert.equal(held, 4, 'le plateau de a compte 4 copies chez b');
});

test('un plateau publié en retard ne crée pas d’écart', () => {
  const { views } = play('M2', { a: R.LAWS[0].id, b: R.LAWS[1].id }, 'b');
  for (const v of views) for (const x of v) assert.equal(x, v[0]);
});

test('paires identiques pour tous, combats retournés pour se voir en bas', () => {
  const st = { seed: 'S', round: 3, met: { 'a|b': { r: 2, n: 1 } }, ghost: { id: 'ghost' } };
  const p1 = R.planPairs(st, ['x', 'b', 'k', 'a', 'z']), p2 = R.planPairs(st, ['a', 'z', 'x', 'k', 'b']);
  assert.deepEqual(p1, p2);
  assert.equal(p1.length, 3, 'deux paires et un univers contre le fantôme');
  assert.ok(p1.some((pr) => pr[1] === 'ghost'));
  assert.ok(!p1.some((pr) => pr.includes('a') && pr.includes('b')), 'pas de revanche immédiate');
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

test('spectateur en ligne (v105) : l’éliminé rejoue les manches et voit les mêmes PV que les autres', () => {
  const seed = 'M-spect', laws = { a: R.LAWS[0].id, b: R.LAWS[1].id, c: R.LAWS[2].id };
  const humans = Object.keys(laws), fam = R.mpFamilies(seed);
  const states = {};
  for (const h of humans) states[h] = R.newGame(seed, laws[h], { families: fam, seats: humans.filter((x) => x !== h).map((x) => ({ id: x, name: x, law: null })), mp: { me: h } });
  // « a » ne joue pas : il tombe le premier, puis regarde.
  states.a.players[0].hp = 1;
  for (const h of humans.slice(1)) states[h].players.find((p) => p.id === 'a').hp = 1;
  let watchedFights = 0, compared = 0;
  for (let round = 0; round < 60; round++) {
    const snaps = {};
    const alive = humans.filter((h) => !states[h].over && !states[h].watching);
    if (!alive.length) break;
    for (const h of alive) {
      const st = states[h];
      if (h !== 'a') R.botTurn(st, st.players[0]);
      else st.players[0].board = [];
      assert.ok(R.mpLock(st, h === alive[0]).ok);
      snaps[h] = R.snapshotOf(st, st.players[0]);
    }
    const host = alive[0];
    for (const p of states[host].players) if (p.bot && p.alive) snaps[p.id] = R.snapshotOf(states[host], p);
    for (const h of alive) assert.ok(R.mpResolve(states[h], snaps, []).ok);
    const sa = states.a;
    if (sa.watching && !sa.over) {
      const res = R.mpResolve(sa, snaps, [], { watch: true });
      assert.ok(res.ok);
      if (res.watched) { watchedFights++; assert.ok(res.watched.events.length > 0); }
      // Le spectateur voit les mêmes PV que les joueurs encore en lice.
      const ref = states[alive.find((h) => h !== 'a')];
      if (ref) {
        const hp = (st, id) => { const p = st.players.find((x) => (x.id === 'you' ? st.mp.me : x.id) === id); return p ? p.hp : null; };
        for (const id of ['b', 'c']) assert.equal(hp(sa, id), hp(ref, id), 'PV de ' + id);
        compared++;
      }
    } else if (sa.over && !sa.watching && R.alivePlayers(sa).length >= 2) {
      assert.ok(R.spectate(sa).ok);
    }
  }
  assert.ok(states.a.watching, 'a a regardé la suite');
  assert.ok(watchedFights > 0 && compared > 0);
});
