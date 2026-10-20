// Tests de la Genèse (ère I, la Poussière) : node --test orbite/tests/genese.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const G = require('../js/genese.js');

// Pose un corps au contact du joueur.
function touch(g, k, s) {
  const r = G.radius(g.me.m);
  const b = { id: 999, k, x: g.me.x + r * 0.5, y: g.me.y, vx: 0, vy: 0, r: s * r, m: (s * r) ** 2, spin: 0, shape: 0, hunter: false, stun: 0 };
  g.bodies = [b];
  return b;
}

test('déterministe : même graine, même nébuleuse', () => {
  const a = G.newGame(42), b = G.newGame(42);
  assert.deepEqual(a.bodies.map((x) => [x.k, x.x.toFixed(3), x.r.toFixed(3)]), b.bodies.map((x) => [x.k, x.x.toFixed(3), x.r.toFixed(3)]));
  for (let i = 0; i < 300; i++) { G.step(a, 1 / 30, { x: 1, y: 0.3 }); G.step(b, 1 / 30, { x: 1, y: 0.3 }); }
  assert.equal(a.me.m, b.me.m);
  assert.equal(a.bodies.length, b.bodies.length);
});

test('on absorbe ce qui est plus petit : masse, composition, étincelles', () => {
  const g = G.newGame(1);
  touch(g, 'glace', 0.8);
  const m0 = g.me.m;
  G.step(g, 0.01, {});
  assert.ok(g.me.m > m0);
  assert.ok(g.comp.glace > 0);
  assert.equal(g.stats.eaten, 1);
  assert.ok(g.events.some((e) => e.t === 'eat' && e.k === 'glace'));
});

test('plus gros que soi : choc, perte de solidité, pas d’absorption', () => {
  const g = G.newGame(1);
  touch(g, 'roche', 1.5);
  G.step(g, 0.01, {});
  assert.equal(g.stats.eaten, 0);
  assert.ok(g.me.hp < G.HP);
  // Le gaz, mou, s'absorbe même un peu plus gros.
  const h = G.newGame(1);
  touch(h, 'gaz', 1.2);
  G.step(h, 0.01, {});
  assert.equal(h.stats.eaten, 1);
});

test('Éruption + Pointes brisent un astre plus gros en morceaux absorbables', () => {
  const g = G.newGame(1);
  g.owned.push('pointes');
  g.sparks = 500;
  g.lvl = 2;
  assert.ok(G.install(g, 'eruption').ok);
  assert.ok(G.install(g, 'pointes').ok);
  touch(g, 'errant', 1.8);
  G.step(g, 0.01, { x: 1, y: 0, dash: true });
  assert.equal(g.stats.shattered, 1);
  assert.equal(g.bodies.filter((b) => b.k === 'roche').length >= 5, true);
});

test('Façonnage : emplacements, prix, pièces à découvrir, remboursement complet', () => {
  const g = G.newGame(1);
  g.sparks = 100;
  assert.equal(G.canInstall(g, 'pointes').ok, false); // pas encore trouvée
  assert.ok(G.install(g, 'jets').ok);
  assert.equal(g.sparks, 80);
  assert.equal(G.install(g, 'aimant').ok, false); // un seul emplacement au départ
  g.me.m = 9;
  G.syncLevel(g);
  assert.equal(g.lvl, 1);
  assert.ok(G.install(g, 'aimant').ok);
  assert.ok(G.remove(g, 'jets').ok);
  assert.equal(g.sparks, 100 - 25);
});

test('les fragments d’astres font découvrir les pièces', () => {
  const g = G.newGame(1);
  const before = g.owned.length;
  touch(g, 'fragment', 0.6).m = 0;
  G.step(g, 0.01, {});
  assert.equal(g.owned.length, before + 1);
  assert.equal(g.stats.fragments, 1);
});

test('mort : le grain se reforme, un peu plus petit', () => {
  const g = G.newGame(1);
  g.me.m = 50;
  g.me.hp = 1;
  touch(g, 'errant', 2);
  G.step(g, 0.01, {});
  assert.equal(g.stats.deaths, 1);
  assert.ok(g.me.m < 50 && g.me.m > 40);
  assert.equal(g.me.hp, G.maxHp(g));
});

test('nature selon le régime, trait selon le style', () => {
  const g = G.newGame(1);
  g.comp = { glace: 6, roche: 2, gaz: 2 };
  assert.equal(G.nature(g), 'eau');
  g.comp = { glace: 1, roche: 1, gaz: 8 };
  assert.equal(G.nature(g), 'etoile');
  g.comp = { glace: 4, roche: 3, gaz: 3 };
  assert.equal(G.nature(g), 'vie');
  g.stats.shattered = 15;
  assert.equal(G.trait(g), 'predateur');
  g.stats.shattered = 0;
  assert.equal(G.trait(g), 'paisible');
});

test('sauvegarde et reprise', () => {
  const g = G.newGame(5);
  for (let i = 0; i < 200; i++) G.step(g, 1 / 30, { x: 0.5, y: 1 });
  const h = G.restore(JSON.parse(JSON.stringify(G.serialize(g))));
  assert.equal(h.me.m, g.me.m);
  assert.deepEqual(h.parts, g.parts);
  assert.ok(h.bodies.length > 30);
});

// Un joueur simple (file vers l'absorbable le plus proche, s'écarte des dangers) finit l'ère.
test('l’ère I se termine en un temps raisonnable', () => {
  const g = G.newGame(3);
  let t = 0;
  while (!g.done && t < 1800) {
    const me = g.me, r = G.radius(me.m);
    let best = null, bd = 1e9, fx = 0, fy = 0;
    for (const b of g.bodies) {
      const dx = b.x - me.x, dy = b.y - me.y, d = Math.hypot(dx, dy);
      if (G.edible(g, b, r)) { if (d < bd) { bd = d; best = b; } } else if (d < (b.r + r) * 2.5) { fx -= dx / d / d * r; fy -= dy / d / d * r; }
    }
    const x = best ? (best.x - me.x) / bd : 0, y = best ? (best.y - me.y) / bd : 0;
    const ev = G.step(g, 1 / 30, { x: x + fx * 6, y: y + fy * 6 });
    t += 1 / 30;
    if (ev.some((e) => e.t === 'level')) G.syncLevel(g);
    ev.length = 0;
    for (const k of ['aimant', 'jets', 'croute', 'eruption']) if (G.canInstall(g, k).ok) G.install(g, k);
  }
  assert.ok(g.done, `fini en ${(t / 60).toFixed(1)} min`);
  assert.ok(t > 120, 'pas trop court');
  assert.equal(g.lvl, G.LEVELS.length - 1);
});
