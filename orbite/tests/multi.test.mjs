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
    // Phase de combat commune (v127) : chaque téléphone trouve le même plus long combat de la manche.
    const longest = new Set();
    for (const h of playing) { const res = R.mpResolve(states[h], snaps, []); assert.ok(res.ok); longest.add(res.longest); }
    assert.ok(longest.size <= 1, 'plus long combat différent selon le téléphone, manche ' + round + ' : ' + [...longest].join(', '));
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

// ─── Reprise d'une partie en ligne (v134) ───────────────────────
// Une table de téléphones ; à chaque manche, ceux qui sont là jouent et publient ; un absent garde son
// dernier système publié (l'hôte le retient). Les documents de manche sont gardés comme dans Firestore.
function table(seed, laws) {
  const humans = Object.keys(laws), fam = R.mpFamilies(seed), states = {};
  for (const h of humans) states[h] = R.newGame(seed, laws[h], { families: fam, seats: humans.filter((x) => x !== h).map((x) => ({ id: x, name: x, law: null })), mp: { me: h } });
  return { humans, states, docs: {}, last: {} };
}
function playRound(t, present) {
  const { states, humans, last } = t;
  const live = present.filter((h) => !states[h].over);
  if (!live.length) return null;
  const host = live[0], r = states[host].round, snaps = {};
  for (const h of live) {
    const st = states[h];
    R.botTurn(st, st.players[0]);
    assert.ok(R.mpLock(st, h === host).ok);
    snaps[h] = R.snapshotOf(st, st.players[0]);
  }
  for (const p of states[host].players) if (p.bot && p.alive) snaps[p.id] = R.snapshotOf(states[host], p);
  for (const h of humans) if (!snaps[h] && last[h]) snaps[h] = last[h];
  Object.assign(last, snaps);
  t.docs[r] = { r, snaps: JSON.parse(JSON.stringify(snaps)) };
  for (const h of live) assert.ok(R.mpResolve(states[h], snaps, []).ok);
  return host;
}
const viewOf = (st) => st.players.map((p) => (p.id === 'you' ? st.mp.me : p.id) + ':' + p.hp + ':' + p.alive).sort().join(' ');

test('reprise en ligne (v134) : parti trois manches, on rattrape et on voit les mêmes PV que les autres', () => {
  const t = table('BACK1', { a: 'sacrifice', b: 'endurance', c: 'phenix' });
  for (let i = 0; i < 2; i++) playRound(t, ['a', 'b', 'c']);
  // c ferme l'appli au début de sa boutique : sa partie sauvegardée est celle-ci.
  const saved = JSON.stringify(t.states.c);
  for (let i = 0; i < 3; i++) playRound(t, ['a', 'b']);
  const back = JSON.parse(saved);
  const res = R.mpCatchUp(back, t.docs);
  assert.equal(res.rounds, 3);
  assert.equal(back.round, t.states.a.round, 'même manche que les autres');
  assert.equal(back.phase, 'shop');
  assert.equal(viewOf(back), viewOf(t.states.a), 'mêmes PV après le rattrapage');
  assert.deepEqual(R.poolAudit(back), back.poolTotal, 'réserve conservée après le rattrapage');
  // Revenu, c joue normalement : tout le monde reste d'accord jusqu'à la fin.
  t.states.c = back;
  for (let i = 0; i < 40 && !['a', 'b', 'c'].every((h) => t.states[h].over); i++) {
    playRound(t, ['a', 'b', 'c']);
    const live = ['a', 'b', 'c'].filter((h) => t.states[h].phase === 'shop' && !t.states[h].over);
    for (const h of live) assert.equal(viewOf(t.states[h]), viewOf(t.states[live[0]]));
  }
});

test('reprise en ligne (v134) : éliminé pendant l’absence, on retrouve sa vraie place', () => {
  const t = table('BACK2', { a: 'sacrifice', b: 'endurance', c: 'sacrifice' });
  playRound(t, ['a', 'b', 'c']);
  const saved = JSON.stringify(t.states.c);
  let rank = null;
  for (let i = 0; i < 60 && rank == null; i++) {
    const host = playRound(t, ['a', 'b']);
    if (!host) break;
    const pc = t.states[host].players.find((p) => p.id === 'c');
    if (!pc.alive) rank = pc.rank;
  }
  assert.ok(rank != null, 'c est tombé pendant son absence');
  const back = JSON.parse(saved);
  // Une découverte était en attente au moment du départ : elle prend le premier choix.
  const ids = Object.keys(back.pool).filter((k) => back.pool[k] > 0 && R.CARD[k].tier === 1).slice(0, 3);
  for (const id of ids) back.pool[id]--;
  back.players[0].discover = ids;
  const res = R.mpCatchUp(back, t.docs);
  assert.equal(back.players[0].discover.length, 0);
  assert.ok(res.rounds > 0 && back.over && res.last.over, 'la partie est finie pour c');
  assert.equal(back.rank, rank, 'même place que sur les autres téléphones');
});

test('reprise en ligne (v134) : parti juste après PRÊT (système déjà verrouillé), rien n’est joué deux fois', () => {
  const t = table('BACK3', { a: 'endurance', b: 'phenix' });
  playRound(t, ['a', 'b']);
  // b verrouille son tour et publie, puis l'appli se ferme pendant l'attente.
  const st = t.states.b;
  R.botTurn(st, st.players[0]);
  assert.ok(R.mpLock(st, false).ok);
  const saved = JSON.stringify(st);
  t.last.b = R.snapshotOf(st, st.players[0]);
  playRound(t, ['a']);
  playRound(t, ['a']);
  const back = JSON.parse(saved);
  const res = R.mpCatchUp(back, t.docs);
  assert.equal(res.rounds, 2);
  assert.equal(viewOf(back), viewOf(t.states.a));
});
