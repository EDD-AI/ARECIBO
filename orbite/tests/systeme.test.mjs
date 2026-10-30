// Tests de Mon système (js/systeme.js) : node --test orbite/tests/systeme.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../js/systeme.js');
const S = globalThis.OrbiteSysteme;

test('trois astres : la Lune (250), Neptune (500), le Soleil (5 000), avec 5, 4 et 3 améliorations', () => {
  assert.deepEqual(S.BODIES.map((b) => [b.id, b.price, b.ups.length]), [['lune', 250, 5], ['neptune', 500, 4], ['soleil', 5000, 3]]);
  for (const b of S.BODIES) {
    assert.equal(new Set(b.ups.map((u) => u.id)).size, b.ups.length, b.id);
    for (let i = 1; i < b.ups.length; i++) {
      assert.ok(b.ups[i].lvl > b.ups[i - 1].lvl, `${b.id} : niveaux croissants`);
      assert.ok(b.ups[i].price > b.ups[i - 1].price, `${b.id} : prix croissants`);
    }
    for (const u of b.ups) assert.ok(u.name && u.text && u.fx && Object.keys(u.fx).length, `${b.id}.${u.id}`);
  }
});

test('acheter un astre : poussières seulement, sans niveau', () => {
  const st = {};
  assert.equal(S.owned(st, 'lune'), false);
  assert.equal(S.next(st, 'lune'), null, 'pas d’amélioration avant l’achat');
  const no = S.check(st, 'lune', 1, 249);
  assert.equal(no.ok, false);
  assert.equal(no.short, true);
  assert.match(no.reason, /1 poussières/);
  const r = S.apply(st, 'lune', 1, 250);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'buy');
  assert.equal(r.cost, 250);
  assert.deepEqual(st, { lune: 0 });
  assert.equal(S.owned(st, 'lune'), true);
  assert.equal(S.count(st), 1);
  assert.equal(S.check(st, 'inconnu', 99, 1e9).ok, false);
});

test('améliorations dans l’ordre, chacune avec son niveau et son prix', () => {
  const st = { neptune: 0 };
  const b = S.BY_ID.neptune;
  assert.equal(S.next(st, 'neptune'), b.ups[0]);
  // Niveau trop bas : refusé, même avec assez de poussières.
  const low = S.check(st, 'neptune', b.ups[0].lvl - 1, 1e6);
  assert.equal(low.ok, false);
  assert.match(low.reason, new RegExp(`niveau ${b.ups[0].lvl}`));
  assert.equal(S.apply(st, 'neptune', b.ups[0].lvl - 1, 1e6).ok, false);
  assert.equal(st.neptune, 0, 'rien n’a changé');
  // Pas assez de poussières.
  assert.equal(S.check(st, 'neptune', 99, b.ups[0].price - 1).short, true);
  // Puis toutes, une à une, dans l’ordre.
  let paid = 0;
  for (let i = 0; i < b.ups.length; i++) {
    const r = S.apply(st, 'neptune', 120, 1e6);
    assert.equal(r.ok, true);
    assert.equal(r.up, b.ups[i]);
    paid += r.cost;
    assert.equal(S.done(st, 'neptune'), i + 1);
  }
  assert.equal(paid, b.ups.reduce((s, u) => s + u.price, 0));
  assert.equal(S.next(st, 'neptune'), null);
  const end = S.check(st, 'neptune', 120, 1e6);
  assert.equal(end.ok, false);
  assert.equal(end.done, true);
});

test('l’apparence suit les améliorations et se voit sur l’astre', () => {
  const lune0 = S.look('lune', 0), lune5 = S.look('lune', 5);
  assert.equal(lune0.type, 'moon');
  assert.equal(lune0.ring, false);
  assert.equal(lune5.ring, true);
  assert.equal(lune5.glow, true);
  assert.equal(lune5.lights, true);
  assert.ok(lune5.craters > lune0.craters && lune5.maria > lune0.maria);
  const nep = S.look('neptune', 4);
  assert.equal(nep.type, 'gas');
  assert.equal(nep.mood, 'neptune');
  assert.ok(nep.storm && nep.bands && nep.ring);
  assert.equal(nep.moons, 1);
  assert.equal(S.look('neptune', 0).moons, 0);
  assert.equal(S.look('soleil', 0).type, 'star');
  assert.equal(S.look('soleil', 0).starClass, 'naine jaune');
  assert.equal(S.look('soleil', 3).starClass, 'géante bleue');
  assert.ok(S.look('soleil', 1).corona > S.look('soleil', 0).corona);
  assert.ok(S.size('soleil', 3) > S.size('soleil', 1), 'le Soleil grandit');
  assert.equal(S.look('soleil', 99).starClass, 'géante bleue', 'borné au nombre d’améliorations');
  assert.equal(S.look('pluton', 1), null);
});

test('le moteur dessine les options des astres (cratères, mers, lumières, tache, bandes, couronne, Triton)', () => {
  require('../js/planet-engine.js');
  const OP = globalThis.OrbitePlanets;
  const gen = (l) => OP.generate(l.seed, Object.assign({}, l, { compact: !l.full }));
  const a = gen(S.look('lune', 0)), b = gen(S.look('lune', 4));
  assert.ok(b.body.A[3] > a.body.A[3], 'cratères plus nombreux');
  assert.ok(b.body.A[1] > a.body.A[1], 'mers plus grandes');
  assert.ok(b.body.C[0] > 0 && a.body.C[0] === 0, 'lumières de la base');
  const n0 = gen(S.look('neptune', 0)), n4 = gen(S.look('neptune', 4));
  assert.equal(n0.body.C[3], 0, 'pas de tempête au départ');
  assert.ok(n4.body.C[3] > 0, 'la Grande Tache sombre');
  assert.ok(n4.ring, 'anneaux');
  assert.equal(n4.moons.length, 1);
  assert.equal(n4.moons[0].kind, 'ice', 'Triton, lune de glace');
  const s0 = gen(S.look('soleil', 0)), s1 = gen(S.look('soleil', 1));
  assert.ok(s1.body.corona.len > s0.body.corona.len, 'la couronne s’allonge');
  // Sans ces options, un astre ordinaire ne change pas.
  const plain = OP.generate(42, { type: 'moon', compact: true });
  const again = OP.generate(42, { type: 'moon', compact: true, craters: undefined, storm: undefined });
  assert.deepEqual(plain.body.A, again.body.A);
});

test('sanitize : seuls les astres connus, avec des entiers bornés', () => {
  assert.deepEqual(S.sanitize(null), {});
  assert.deepEqual(S.sanitize([1, 2]), {});
  assert.deepEqual(S.sanitize('lune'), {});
  assert.deepEqual(S.sanitize({ lune: 2.7, neptune: 99, soleil: -1, pluton: 3 }), { lune: 2, neptune: 4 });
  assert.deepEqual(S.sanitize({ lune: '3', neptune: null, soleil: true }), { lune: 3 });
  assert.deepEqual(S.sanitize({ lune: 0 }), { lune: 0 }, '0 : acheté, sans amélioration');
});

test('profil public : publish puis fromPublic, et lecture prudente des profils d’autrui', () => {
  const st = { lune: 5, soleil: 1 };
  const pub = S.publish(st);
  assert.deepEqual(pub, { lune: 5, soleil: 1 });
  assert.equal('neptune' in pub, false, 'clé absente : pas acheté');
  assert.deepEqual(S.fromPublic(JSON.parse(JSON.stringify(pub))), st);
  // Anciens clients (pas d’astres) et données douteuses.
  assert.deepEqual(S.fromPublic(undefined), {});
  assert.deepEqual(S.fromPublic('lune'), {});
  assert.deepEqual(S.fromPublic([5]), {});
  assert.deepEqual(S.fromPublic({ lune: 1e9, neptune: -2, soleil: 1.5, pluton: 2 }), { lune: 5 });
  assert.deepEqual(S.fromPublic({ lune: '2', neptune: NaN, soleil: Infinity }), {});
  const proto = Object.create({ lune: 3 });
  assert.deepEqual(S.fromPublic(proto), {}, 'propriétés propres seulement');
});

test('passage de niveau : les améliorations qui s’ouvrent, pour les astres achetés', () => {
  assert.deepEqual(S.unlocks({}, 5), [], 'Lune pas achetée');
  const st = { lune: 0, neptune: 0 };
  assert.deepEqual(S.unlocks(st, 5).map((x) => x.up.id), ['crateres']);
  assert.deepEqual(S.unlocks(st, 10).map((x) => x.body.id), ['neptune']);
  assert.deepEqual(S.unlocks({ lune: 1 }, 5), [], 'déjà faite');
  assert.deepEqual(S.unlocks(st, 7), []);
});

test('succès : « Lumière ! » avec le Soleil, « Système solaire » avec les trois astres', () => {
  const R = require('../js/rules.js');
  const K = require('../js/classement.js');
  const mem = {};
  globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  globalThis.document = { getElementById: () => null, hidden: true, createElement: () => ({ classList: { add() {} }, remove() {} }), body: { appendChild() {} } };
  globalThis.setTimeout = () => 0;
  globalThis.setInterval = () => 0;
  globalThis.window = { OrbiteClassement: K, OrbiteSysteme: S, __orbite: { rules: R, ui: {}, api: { levelInfo: () => ({ lvl: 1 }), xpTotal: () => 0, addSeeds() {}, esc: (s) => s, icon: () => '' } } };
  delete require.cache[require.resolve('../js/succes.js')];
  require('../js/succes.js');
  const Su = globalThis.window.OrbiteSucces;
  const etoile = Su.LIST.find((a) => a.id === 'etoile'), orbites = Su.LIST.find((a) => a.id === 'orbites');
  assert.equal(orbites.goal, 3);
  mem['orbite.systeme'] = JSON.stringify({ lune: 2 });
  assert.equal(etoile.of(Su.facts()), 0);
  assert.equal(orbites.of(Su.facts()), 1);
  mem['orbite.systeme'] = JSON.stringify({ lune: 2, neptune: 0, soleil: 0 });
  assert.equal(etoile.of(Su.facts()), 1);
  assert.equal(orbites.of(Su.facts()), 3);
});
