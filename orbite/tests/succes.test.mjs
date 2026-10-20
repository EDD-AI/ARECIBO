// Tests des succès : node --test orbite/tests/succes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../js/rules.js');
const K = require('../js/classement.js');

// succes.js est un script de navigateur : on lui donne un faux stockage et une fausse API.
function load() {
  const mem = {};
  let seeds = 0;
  globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  globalThis.document = { getElementById: () => null, hidden: true, createElement: () => ({ classList: { add() {} }, remove() {} }), body: { appendChild() {} } };
  globalThis.setTimeout = () => 0;
  globalThis.setInterval = () => 0;
  globalThis.window = {
    OrbiteClassement: K,
    __orbite: {
      rules: R, ui: {},
      api: { levelInfo: () => ({ lvl: 1 }), xpTotal: () => 0, addSeeds: (n) => { seeds += n; }, esc: (s) => s, icon: () => '' }
    }
  };
  delete require.cache[require.resolve('../js/succes.js')];
  require('../js/succes.js');
  return { S: window.OrbiteSucces, mem, seeds: () => seeds };
}

test('cent succès, identifiants uniques, variables valides', () => {
  const { S } = load();
  assert.equal(S.LIST.length, 100);
  assert.equal(new Set(S.LIST.map((a) => a.id)).size, 100);
  const cats = new Set(S.CATS.map(([c]) => c));
  for (const a of S.LIST) {
    assert.ok(cats.has(a.cat), a.id);
    assert.ok(a.goal >= 1 && a.seeds >= 1, a.id);
    for (const [k, v] of Object.entries(a.vars)) {
      const x = typeof v === 'function' ? v() : v;
      assert.ok(x != null && x !== '', `${a.id}.${k}`);
    }
  }
  assert.equal(Object.keys(R.LAW).length, 15);
});

test('rien de débloqué sur un appareil neuf', () => {
  const { S, mem, seeds } = load();
  S.check();
  assert.equal(seeds(), 0);
  assert.equal(mem['orbite.succes'], undefined);
});

test('fin de partie : famille, victoire, graines', () => {
  const { S, mem, seeds } = load();
  const s = R.newGame(7, 'endurance');
  const p = s.players[0];
  p.board = ['cristal', 'cristal', 'cristal', 'vie'].map((fam) => {
    const card = Object.values(R.CARD).find((c) => c.fam === fam && !c.legend);
    return { id: card.id, atk: 1, hp: 1, golden: false };
  });
  p.hp = 2;
  s.round = 10;
  s.history = [];
  mem['orbite.stats'] = JSON.stringify({ games: 1, wins: 1, top3: 1, fights: 0, goldens: 0, laws: { endurance: 1 } });
  S.record(s, 1, false);
  const c = JSON.parse(mem['orbite.succes.c']);
  assert.equal(c.famGames.cristal, 1);
  assert.equal(c.famWins.cristal, 1);
  assert.equal(c.unbeaten, 1);
  assert.equal(c.close, 1);
  assert.equal(c.fast, 1);
  S.check();
  const done = JSON.parse(mem['orbite.succes']);
  for (const id of ['parties1', 'victoires1', 'champion-cristal', 'loi-endurance', 'invaincu', 'fil', 'eclair']) assert.ok(done[id], id);
  assert.ok(!done['fidele-cristal']);
  const gained = S.LIST.filter((a) => done[a.id]).reduce((n, a) => n + a.seeds, 0);
  assert.equal(seeds(), gained);
  // Une seconde vérification ne redonne rien.
  S.check();
  assert.equal(seeds(), gained);
});
