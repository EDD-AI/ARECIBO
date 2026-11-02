// v138 : moins « mono famille ». Astres à deux familles, formations plafonnées au niveau II,
// formation Mélange, combos de placement entre familles et neutres du mélange.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../js/rules.js');

const mk = (id, extra = {}) => Object.assign({ uid: id + Math.random(), id, golden: false, atk: R.CARD[id].atk, hp: R.CARD[id].hp, kw: (R.CARD[id].kw || []).slice(), att: [] }, extra);
const side = (board) => ({ id: 'S' + Math.random(), tier: 1, law: 'symbiose', board });
const gameWith = (fam, seed) => R.newGame(seed, R.LAWS.find((l) => l.fam === fam).id);
function offer(s, id, slot = 0, p = s.players[0]) {
  if (p.shop[slot]) s.pool[p.shop[slot]]++;
  assert.ok(s.pool[id] > 0, 'plus de copie de ' + id);
  s.pool[id]--;
  p.shop[slot] = id;
}

test('astres à deux familles : chaque famille en a au moins un, et ils comptent pour les deux', () => {
  const duals = R.CARDS.filter((c) => c.fam2);
  assert.equal(duals.length, 7);
  for (const c of duals) {
    assert.notEqual(c.fam, c.fam2);
    assert.ok(R.FAMILY_KEYS.includes(c.fam) && R.FAMILY_KEYS.includes(c.fam2), c.id);
    assert.ok(R.isFam(c.id, c.fam) && R.isFam(c.id, c.fam2));
    assert.deepEqual(R.famsOf(c.id), [c.fam, c.fam2]);
  }
  for (const f of R.FAMILY_KEYS) assert.ok(duals.some((c) => c.fam === f || c.fam2 === f), 'famille sans astre double : ' + f);
  // La Comète (Glace et Comète) forme une formation avec une Glace comme avec une Comète.
  assert.deepEqual(R.formationsOf([{ id: 'comete', row: 0 }, { id: 'nive', row: 0 }]).map((f) => f.fam), ['glace']);
  assert.deepEqual(R.formationsOf([{ id: 'comete', row: 0 }, { id: 'meteore', row: 0 }]).map((f) => f.fam), ['comete']);
});

test('réserve : un astre à deux familles entre dès que l’une d’elles est en jeu', () => {
  // Europe (Lune et Vie) sans les Lunes, avec la Vie.
  const s = R.newGame('duo-reserve', R.LAWS.find((l) => l.fam === 'vie').id, { families: ['vie', 'brasier', 'glace', 'mineral', 'machine'] });
  assert.ok(s.pool.europe > 0, 'Europe dans la réserve grâce à la Vie');
  assert.ok(s.pool.comete > 0);
  assert.equal(s.pool.voile, undefined, 'Voile : ni Nébuleuse ni Tempête en jeu');
});

test('formations : niveau II au plus ; le 4e astre d’une même famille n’ajoute rien', () => {
  const four = R.formationsOf(['cendre', 'umbra', 'nyx', 'vestige'].map((id) => ({ id, row: 0 })));
  assert.deepEqual(four.map((f) => [f.fam, f.n, f.lvl]), [['neant', 4, 2]]);
  const three = R.formationsOf(['cendre', 'umbra', 'nyx'].map((id) => ({ id, row: 0 })));
  assert.equal(three[0].lvl, 2);
  assert.equal(R.FORM_LVL_MAX, 2);
});

test('Mélange : 3 familles différentes dans une rangée (II avec 4), les neutres ne comptent pas', () => {
  const lvl = (ids) => (R.formationsOf(ids.map((id) => ({ id, row: 1 }))).find((f) => f.fam === 'melange') || { lvl: 0 }).lvl;
  assert.equal(lvl(['cendre', 'aube', 'errante']), 0, 'deux familles et un neutre');
  assert.equal(lvl(['cendre', 'aube', 'braise']), 1);
  assert.equal(lvl(['cendre', 'aube', 'braise', 'nive']), 2);
  // Un astre à deux familles en apporte deux : Sol (Vie, Brasier) et la Comète (Glace, Comète).
  assert.equal(lvl(['sol', 'comete']), 2);
  assert.ok(R.formText('melange', 0, 1).includes('+1/+1'));
  // En combat, les astres de la rangée gagnent +1/+1 (Mélange I).
  const s = gameWith('vie', 'melange-combat');
  const A = side([mk('cendre', { row: 0, atk: 0, hp: 20 }), mk('aube', { row: 0, atk: 0, hp: 20 }), mk('braise', { row: 0, atk: 0, hp: 20 })]);
  const B = side([mk('errante', { row: 0, atk: 0, hp: 30 })]);
  const r = R.fight(s, A, B, 'melange', true);
  const ev = r.events.find((e) => e.t === 'formation' && e.fam === 'melange');
  assert.ok(ev && ev.lvl === 1 && ev.cids.length === 3, 'la formation Mélange s’annonce');
});

test('combos entre familles : Vapeur, Orbite basse, Pépinière', () => {
  const kinds = (front, back) => R.phenomenaOf([{ id: front, uid: 'f', row: 0 }, { id: back, uid: 'b', row: 1 }]).map((p) => p.kind);
  assert.ok(kinds('nive', 'braise').includes('vapeur'));
  assert.ok(kinds('selene', 'sonde').includes('orbitebasse'));
  assert.ok(kinds('voile', 'gaia').includes('pepiniere'));
  assert.deepEqual(kinds('braise', 'nive'), [], 'dans l’autre sens, rien');
  // Vapeur : 3 dégâts à l'ennemi en face au début du combat.
  const s = gameWith('glace', 'vapeur');
  const A = side([mk('nive', { row: 0, atk: 0, hp: 20, kw: [] }), mk('braise', { row: 1, atk: 0, hp: 20, kw: [] })]);
  const B = side([mk('errante', { row: 0, atk: 0, hp: 30 })]);
  const r = R.fight(s, A, B, 'vapeur', true);
  assert.ok(r.events.some((e) => e.t === 'phenom' && e.kind === 'vapeur'));
  assert.ok(r.events.some((e) => e.t === 'hit' && e.kind !== 'attack' && e.n >= 3));
});

test('neutres du mélange : Amas, Radiotélescope, Point de Lagrange, Constellation', () => {
  // Amas : un astre de chaque famille du système gagne +1/+1.
  const s = gameWith('vie', 'amas');
  const p = s.players[0];
  p.gold = 50;
  p.tier = 3;
  p.board = [mk('cendre', { row: 0 }), mk('umbra', { row: 0 }), mk('braise', { row: 1 })];
  p.hand = [];
  offer(s, 'amas');
  const a = R.buy(s, 0);
  assert.equal(R.play(s, a.uid, p.board.length).ok, true);
  const gained = p.board.filter((u) => u.id !== 'amas' && u.atk > R.CARD[u.id].atk).map((u) => R.famOf(u));
  assert.deepEqual(gained.sort(), ['brasier', 'neant']);
  // Radiotélescope : la découverte ne propose que des familles absentes du système.
  offer(s, 'radiotelescope');
  const t = R.buy(s, 0);
  const res = R.play(s, t.uid, 0, 1);
  assert.ok(res.ok && res.discover);
  const owned = new Set(p.board.concat(p.hand).flatMap((u) => R.famsOf(u)));
  for (const id of p.discover) assert.ok(R.CARD[id].fam !== 'neutre' && !R.famsOf(id).some((f) => owned.has(f)), id);
  assert.ok(R.choose(s, 0, p).ok);
  // Point de Lagrange : un astre d'une famille absente gagne +2/+2, pas les autres.
  const st = R.newGame('lagrange', R.LAWS.find((l) => l.fam === 'vie').id, { families: ['vie', 'neant', 'brasier', 'glace', 'lune'] });
  const me = st.players[0];
  me.gold = 50; me.tier = 4; me.hand = [];
  me.board = [mk('lagrange', { row: 1 }), mk('cendre', { row: 0 })];
  offer(st, 'umbra');
  const u1 = R.buy(st, 0);
  R.play(st, u1.uid, 1);
  assert.equal(me.board.find((u) => u.id === 'umbra').atk, R.CARD.umbra.atk, 'Néant déjà présent : rien');
  offer(st, 'braise');
  const u2 = R.buy(st, 0);
  R.play(st, u2.uid, 1);
  assert.equal(me.board.find((u) => u.id === 'braise').atk, R.CARD.braise.atk + 2, 'Brasier absent : +2/+2');
  // Constellation : +1/+1 par famille différente (4 au plus) aux autres astres.
  const c = gameWith('vie', 'constellation');
  const A = side([mk('constellation', { row: 1, atk: 0 }), mk('errante', { row: 0, atk: 0, hp: 40 }), mk('cendre', { row: 0, atk: 0, hp: 40 }), mk('aube', { row: 1, atk: 0, hp: 40 }), mk('nive', { row: 1, atk: 0, hp: 40, kw: [] })]);
  const B = side([mk('errante', { row: 0, atk: 0, hp: 60 })]);
  const r = R.fight(c, A, B, 'constellation', true);
  assert.ok(r.events.some((e) => e.t === 'buff' && e.a === 3 && e.h === 3), 'trois familles : +3/+3');
});
