// Tests de l'Essaim (ère II, chapitre 1) : node --test orbite/tests/essaim.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../js/essaim.js');

// Un rocher posé près du joueur, sur sa propre orbite circulaire.
function rockAt(e, dx, dy, m) {
  const x = e.me.x + dx, y = e.me.y + dy, R = Math.hypot(x, y);
  const k = { id: 9999, k: 'roche', R, th: Math.atan2(y, x), w: E.vcirc(R) / R, m, r: E.radius(m), shape: 1, x, y };
  e.rocks = [k];
  return k;
}

test('déterministe, et l’orbite reste stable sans toucher l’écran', () => {
  const a = E.newGame(7), b = E.newGame(7);
  for (let i = 0; i < 1800; i++) { E.step(a, 1 / 30, {}); E.step(b, 1 / 30, {}); a.events.length = 0; b.events.length = 0; }
  assert.equal(a.me.x, b.me.x);
  const R = Math.hypot(a.me.x, a.me.y);
  assert.ok(R > 900 && R < 1100, 'rayon ' + R);
});

test('capturer : glisser à côté à la même vitesse met le rocher en orbite autour de soi', () => {
  const e = E.newGame(1);
  const r = E.radius(e.me.M);
  rockAt(e, 0, r * 2.4, 0.1);
  e.rivals.forEach((v) => { v.alive = false; });
  for (let i = 0; i < 90 && !e.sats.length; i++) E.step(e, 1 / 30, {});
  assert.equal(e.sats.length, 1);
  assert.equal(e.stats.captures, 1);
  assert.ok(e.events.some((x) => x.t === 'capture'));
});

test('percuter : foncer dans un rocher l’absorbe et chauffe', () => {
  const e = E.newGame(1);
  const cv = E.circVel(e.me.x, e.me.y);
  rockAt(e, E.radius(1) * 0.8, 0, 0.3);
  e.me.vx = cv.x + 40; e.me.vy = cv.y;
  const M0 = e.me.M;
  E.step(e, 1 / 60, {});
  assert.equal(e.stats.impacts, 1);
  assert.ok(e.me.M > M0);
  assert.ok(e.me.heat > 5);
});

test('une lune pare un choc', () => {
  const e = E.newGame(1);
  e.sats.push({ id: 's1', k: 'roche', m: 0.1, r: 2, big: false, ang: 0, w: 1, d: 0, blockAt: -99, shape: 1 });
  rockAt(e, E.radius(1) * 0.9, 0, 3);
  E.step(e, 1 / 60, {});
  assert.equal(e.me.hp, E.HP);
  assert.equal(e.stats.blocks, 1);
});

test('trop chaud : la croûte se fissure ; à bout, on perd de la masse et des lunes', () => {
  const e = E.newGame(1);
  e.me.M = 10;
  e.me.heat = 120;
  e.sats = [1, 2, 3, 4].map((i) => ({ id: 's' + i, k: 'roche', m: 0.2, r: 2, big: false, ang: i, w: 1, d: 0, blockAt: 0, shape: 1 }));
  for (let i = 0; i < 600 && !e.stats.deaths; i++) { e.me.heat = 120; e.rocks = []; e.comets = []; E.step(e, 1 / 30, {}); }
  assert.equal(e.stats.deaths, 1);
  assert.ok(e.me.M < 10);
  assert.equal(e.sats.length, 2);
});

test('rivales : plus grosse, elle blesse ; plus petite, on l’absorbe', () => {
  const e = E.newGame(1);
  e.rocks = [];
  const big = e.rivals[2];
  big.th = Math.atan2(e.me.y, e.me.x); big.R = Math.hypot(e.me.x, e.me.y);
  E.step(e, 1 / 60, {});
  assert.ok(e.me.hp < E.HP);
  const f = E.newGame(1);
  f.rocks = [];
  f.me.M = 3;
  const small = f.rivals[0];
  small.th = Math.atan2(f.me.y, f.me.x); small.R = Math.hypot(f.me.x, f.me.y);
  E.step(f, 1 / 60, {});
  assert.equal(f.stats.rivalsEaten, 1);
  assert.equal(small.alive, false);
});

test('victoire : le système (vous et vos lunes) le plus massif de la ceinture', () => {
  const e = E.newGame(1);
  e.me.M = 21;
  e.sats.push({ id: 's', k: 'glace', m: 6, r: 3, big: false, ang: 0, w: 1, d: 0, blockAt: -99, shape: 1 });
  E.step(e, 1 / 60, {});
  assert.ok(e.done);
  assert.ok(e.events.some((x) => x.t === 'end'));
});

test('trait : percuter ou capturer', () => {
  const e = E.newGame(1);
  e.stats.impactMass = 10; e.stats.captureMass = 2;
  assert.equal(E.trait(e), 'predateur');
  e.stats.impactMass = 2; e.stats.captureMass = 10;
  assert.equal(E.trait(e), 'paisible');
  e.stats.impactMass = 5; e.stats.captureMass = 5;
  assert.equal(E.trait(e), 'adaptable');
});

test('sauvegarde et reprise', () => {
  const e = E.newGame(4, { trait: 'paisible', comp: { glace: 3, roche: 1, gaz: 0 } });
  for (let i = 0; i < 300; i++) { E.step(e, 1 / 30, { x: 0.3, y: 0.2 }); e.events.length = 0; }
  const f = E.restore(JSON.parse(JSON.stringify(E.serialize(e))));
  assert.equal(f.me.M, e.me.M);
  assert.equal(f.trait1, 'paisible');
  assert.ok(f.rocks.length > 20);
});
