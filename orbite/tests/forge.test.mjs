// Tests de la Forge des mondes : node --test orbite/tests/forge.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const F = createRequire(import.meta.url)('../js/forge.js');

test('une graine se nourrit de plus en plus cher, jusqu’à 15 paliers', () => {
  const p = F.newPlanet(42, 0);
  assert.equal(F.check(p, { t: 'feed' }).cost, 3);
  let total = 0;
  while (F.check(p, { t: 'feed' }).ok) total += F.apply(p, { t: 'feed' }).cost;
  assert.equal(p.mass, F.MAX_MASS);
  assert.equal(total, F.FEED.reduce((s, x) => s + x, 0));
  for (let i = 1; i < F.FEED.length; i++) assert.ok(F.FEED[i] > F.FEED[i - 1]);
});

test('la première nature est offerte, la changer coûte', () => {
  const p = F.newPlanet(1, 0);
  assert.equal(F.check(p, { t: 'nature', key: 'ocean' }).ok, false, 'pas avant le premier repas');
  F.apply(p, { t: 'feed' });
  assert.equal(F.apply(p, { t: 'nature', key: 'ocean' }).cost, 0);
  assert.equal(F.check(p, { t: 'nature', key: 'lava' }).cost, 8);
  assert.equal(F.check(p, { t: 'nature', key: 'gas' }).ok, false, 'géante gazeuse dès la taille 6');
});

test('chaque palier ouvre un emplacement ; un ajout le prend', () => {
  const p = F.newPlanet(7, 0);
  for (let i = 0; i < 3; i++) F.apply(p, { t: 'feed' });
  F.apply(p, { t: 'nature', key: 'terran' });
  assert.equal(F.slotsFree(p), 3);
  assert.ok(F.apply(p, { t: 'add', part: 'ring' }).ok);
  assert.ok(F.apply(p, { t: 'add', part: 'debris' }).ok);
  assert.ok(F.apply(p, { t: 'add', part: 'shape', v: 'double' }).ok);
  assert.equal(F.slotsFree(p), 0);
  assert.equal(F.check(p, { t: 'add', part: 'facet' }).ok, false, 'plus de place');
  assert.equal(F.check(p, { t: 'add', part: 'shape', v: 'bloc' }).cost, 12, 'changer de silhouette garde la place');
  F.apply(p, { t: 'remove', part: 'ring' });
  assert.equal(F.slotsFree(p), 1);
});

test('les lunes s’ajoutent une à une, plus chères et plus tard', () => {
  const p = F.newPlanet(9, 0);
  for (let i = 0; i < 10; i++) F.apply(p, { t: 'feed' });
  F.apply(p, { t: 'nature', key: 'ice' });
  assert.deepEqual([0, 1, 2].map(() => F.apply(p, { t: 'add', part: 'moons' }).cost), [12, 20, 30]);
  assert.equal(F.check(p, { t: 'add', part: 'moons' }).ok, false);
  assert.equal(F.look(p).moons, 3);
});

test('le prix est refusé sans assez de poussières, et l’apparence suit les choix', () => {
  const p = F.newPlanet(3, 0);
  assert.equal(F.check(p, { t: 'feed' }, 2).ok, false);
  assert.equal(F.look(p).type, 'asteroid', 'une graine est un caillou');
  F.apply(p, { t: 'feed' });
  F.apply(p, { t: 'nature', key: 'desert' });
  F.apply(p, { t: 'hue', v: 120 });
  const l = F.look(p);
  assert.equal(l.type, 'desert');
  assert.equal(l.hueShift, 120);
  assert.equal(F.seedCost(0), 0);
  assert.equal(F.seedCost(F.MAX_PLANETS), null);
});

test('Mon système : s’ouvre à la taille 5, l’étoile s’allume, les mondes prennent une orbite', () => {
  const sys = { star: F.newStar(11), planets: [F.newPlanet(1, 0), F.newPlanet(2, 1)] };
  assert.equal(F.sysCheck(sys, { t: 'light' }).ok, false, 'fermé avant la taille 5');
  for (const p of sys.planets) { for (let i = 0; i < 5; i++) F.apply(p, { t: 'feed' }); F.apply(p, { t: 'nature', key: 'terran' }); }
  assert.equal(F.sysCheck(sys, { t: 'orbit', i: 0, slot: 0 }).ok, false, 'étoile éteinte');
  assert.equal(F.sysApply(sys, { t: 'light' }).cost, F.LIGHT_COST);
  F.sysApply(sys, { t: 'orbit', i: 0, slot: 0 });
  F.sysApply(sys, { t: 'orbit', i: 1, slot: 3 });
  F.sysApply(sys, { t: 'orbit', i: 1, slot: 0 });
  assert.equal(sys.planets[1].orbit, 0);
  assert.equal(sys.planets[0].orbit, 3, 'les deux mondes échangent leurs orbites');
  assert.equal(F.sysApply(sys, { t: 'starGrow' }).cost, F.STAR_GROW[0]);
  assert.equal(F.sysCheck(sys, { t: 'starClass', cls: 'géante bleue' }).cost, 25);
  assert.equal(F.starLook(sys.star).type, 'star');
});
