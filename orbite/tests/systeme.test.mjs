// Tests de Mon système (js/systeme.js) : node --test orbite/tests/systeme.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../js/systeme.js');
require('../js/planet-engine.js');
const S = globalThis.OrbiteSysteme;
const OP = globalThis.OrbitePlanets;

// Le tableau voulu : prix d'achat et améliorations (niveau, prix), dans l'ordre du système.
const TABLE = {
  soleil: [5000, [[30, 1500], [50, 2500], [75, 4000]]],
  mercure: [300, [[8, 150], [20, 250], [36, 400]]],
  venus: [350, [[10, 180], [24, 300], [40, 450]]],
  lune: [250, [[5, 120], [12, 200], [20, 320], [32, 480], [45, 700]]],
  mars: [400, [[8, 160], [18, 260], [30, 380], [48, 600]]],
  jupiter: [1200, [[15, 300], [28, 500], [44, 700], [62, 1000]]],
  saturne: [900, [[12, 250], [26, 450], [42, 650], [60, 900]]],
  uranus: [600, [[14, 250], [32, 450], [50, 650]]],
  neptune: [500, [[10, 350], [24, 550], [38, 800], [55, 1200]]],
  pluton: [150, [[6, 120], [22, 260]]]
};
const ALL = Object.fromEntries(Object.entries(TABLE).map(([id, t]) => [id, t[1].length]));

test('tous les astres du système solaire, dans l’ordre depuis le Soleil, avec leurs prix et améliorations', () => {
  assert.deepEqual(S.BODIES.map((b) => b.id), Object.keys(TABLE));
  for (const b of S.BODIES) {
    const [price, ups] = TABLE[b.id];
    assert.equal(b.price, price, `${b.id} : prix`);
    assert.deepEqual(b.ups.map((u) => [u.lvl, u.price]), ups, `${b.id} : améliorations`);
    assert.equal(new Set(b.ups.map((u) => u.id)).size, b.ups.length, b.id);
    for (let i = 1; i < b.ups.length; i++) {
      assert.ok(b.ups[i].lvl > b.ups[i - 1].lvl, `${b.id} : niveaux croissants`);
      assert.ok(b.ups[i].price > b.ups[i - 1].price, `${b.id} : prix croissants`);
    }
    for (const u of b.ups) assert.ok(u.name && u.text && u.fx && Object.keys(u.fx).length, `${b.id}.${u.id}`);
    assert.ok(b.name && b.text && /^#[0-9a-f]{6}$/.test(b.color), b.id);
  }
  // Les orbites dans l'ordre réel ; votre planète (la Terre) est sur la troisième, la Lune autour d'elle.
  const orbits = S.BODIES.filter((b) => typeof b.orbit === 'number' && b.orbit >= 0).map((b) => [b.id, b.orbit]);
  assert.deepEqual(orbits, [['mercure', 0], ['venus', 1], ['mars', 3], ['jupiter', 4], ['saturne', 5], ['uranus', 6], ['neptune', 7], ['pluton', 8]]);
  assert.equal(S.BY_ID.soleil.orbit, -1);
  assert.equal(S.BY_ID.lune.orbit, 'monde');
});

test('tailles lisibles : le Soleil, puis Jupiter et Saturne grosses, Mercure et Pluton petites', () => {
  const z = (id) => S.size(id, 0);
  assert.ok(z('soleil') > z('jupiter'));
  assert.ok(z('jupiter') > z('saturne') && z('saturne') > z('uranus') && z('uranus') > z('neptune'));
  assert.ok(z('neptune') > 1 && z('venus') < 1 && z('mars') < z('venus'));
  assert.ok(z('mercure') < z('mars') && z('pluton') < z('mercure'));
  assert.ok(S.size('soleil', 3) > S.size('soleil', 2) && S.size('soleil', 2) > S.size('soleil', 0), 'le Soleil grandit');
});

test('acheter un astre : poussières seulement, sans niveau', () => {
  const st = {};
  assert.equal(S.owned(st, 'pluton'), false);
  assert.equal(S.next(st, 'pluton'), null, 'pas d’amélioration avant l’achat');
  const no = S.check(st, 'pluton', 1, 149);
  assert.equal(no.ok, false);
  assert.equal(no.short, true);
  assert.match(no.reason, /1 poussières/);
  const r = S.apply(st, 'pluton', 1, 150);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'buy');
  assert.equal(r.cost, 150);
  assert.deepEqual(st, { pluton: 0 });
  assert.equal(S.owned(st, 'pluton'), true);
  assert.equal(S.count(st), 1);
  assert.equal(S.check(st, 'inconnu', 99, 1e9).ok, false);
  // Chaque astre s'achète à son prix, dès le niveau 1.
  for (const b of S.BODIES) {
    assert.equal(S.check({}, b.id, 1, b.price - 1).ok, false, b.id);
    assert.equal(S.check({}, b.id, 1, b.price).ok, true, b.id);
  }
});

test('améliorations dans l’ordre, chacune avec son niveau et son prix, pour chaque astre', () => {
  for (const b of S.BODIES) {
    const st = { [b.id]: 0 };
    assert.equal(S.next(st, b.id), b.ups[0]);
    // Niveau trop bas : refusé, même avec assez de poussières.
    const low = S.check(st, b.id, b.ups[0].lvl - 1, 1e6);
    assert.equal(low.ok, false);
    assert.match(low.reason, new RegExp(`niveau ${b.ups[0].lvl}`));
    assert.equal(S.apply(st, b.id, b.ups[0].lvl - 1, 1e6).ok, false);
    assert.equal(st[b.id], 0, 'rien n’a changé');
    // Pas assez de poussières.
    assert.equal(S.check(st, b.id, 99, b.ups[0].price - 1).short, true);
    // Puis toutes, une à une, dans l’ordre.
    let paid = 0;
    for (let i = 0; i < b.ups.length; i++) {
      const r = S.apply(st, b.id, 120, 1e6);
      assert.equal(r.ok, true);
      assert.equal(r.up, b.ups[i]);
      paid += r.cost;
      assert.equal(S.done(st, b.id), i + 1);
    }
    assert.equal(paid, b.ups.reduce((s, u) => s + u.price, 0));
    assert.equal(S.next(st, b.id), null);
    const end = S.check(st, b.id, 120, 1e6);
    assert.equal(end.ok, false);
    assert.equal(end.done, true);
  }
});

test('le Soleil est rouge dès l’achat et le reste : couronne, éruptions, géante rouge (plus de géante bleue)', () => {
  assert.equal(S.look('soleil', 0).type, 'star');
  assert.equal(S.look('soleil', 0).starClass, 'soleil rouge');
  assert.equal(S.look('soleil', 3).starClass, 'géante rouge');
  assert.equal(S.look('soleil', 99).starClass, 'géante rouge', 'borné au nombre d’améliorations');
  assert.ok(S.look('soleil', 1).corona > S.look('soleil', 0).corona);
  assert.ok(!S.BY_ID.soleil.ups.some((u) => /bleu/i.test(u.name + u.text)));
  for (let n = 0; n <= 3; n++) {
    const l = S.look('soleil', n);
    const g = OP.generate(l.seed, Object.assign({}, l, { compact: false }));
    // La couleur de base et la plus claire : des rouges (teinte OKLCH entre 15 et 55°), bien saturés.
    for (const k of [3, 4, 7]) {
      const [L, C, h] = OP.rgbToOklch(g.body.pal[0][k]);
      assert.ok(h > 15 && h < 55 && C > 0.08, `Soleil ${n}, teinte ${k} : ${L.toFixed(2)} ${C.toFixed(2)} ${h.toFixed(0)}°`);
    }
  }
  // Le rouge de la géante est plus profond que celui du Soleil de départ.
  const lum = (n) => { const l = S.look('soleil', n); return OP.rgbToOklch(OP.generate(l.seed, l).body.pal[0][4])[0]; };
  assert.ok(lum(3) < lum(0));
});

test('l’apparence suit les améliorations : chaque amélioration change l’astre dessiné', () => {
  // Empreinte de ce que le moteur dessine : palettes, réglages des shaders, nuages, halo, couronne,
  // anneaux, lunes, axe et rotation.
  const sig = (id, n) => {
    const l = S.look(id, n);
    const g = OP.generate(l.seed, Object.assign({}, l, { compact: !l.full }));
    const b = g.body;
    return JSON.stringify({ type: g.type, pal: b.pal, A: b.A, B: b.B, C: b.C, D: b.D, clouds: b.clouds, atmo: b.atmo, corona: b.corona, glow: b.glow,
      ring: g.ring && [g.ring.inner, g.ring.outer, g.ring.opacity, g.ring.pal[0]], moons: g.moons.map((m) => [m.kind, m.size, m.body.pal[5]]), M: b.M, spin: b.spinCycles });
  };
  for (const b of S.BODIES) {
    for (let n = 1; n <= b.ups.length; n++) assert.notEqual(sig(b.id, n), sig(b.id, n - 1), `${b.id} : « ${b.ups[n - 1].name} » se voit`);
  }
  assert.equal(S.look('pluton', 9).heart, true);
  assert.equal(S.look('vulcain', 1), null);
});

test('le moteur dessine les astres comme les vrais (couleurs, anneaux, lunes, axe)', () => {
  const gen = (id, n) => { const l = S.look(id, n); return OP.generate(l.seed, Object.assign({}, l, { compact: !l.full })); };
  const lch = (rgb) => OP.rgbToOklch(rgb);
  // Mars rouge orangé, Vénus jaune pâle, Uranus cyan pâle, Neptune bleu profond, Pluton beige.
  const [, mc, mh] = lch(gen('mars', 0).body.pal[4][4]);
  assert.ok(mh > 25 && mh < 60 && mc > 0.1, 'Mars rouge orangé');
  const [vl, , vh] = lch(gen('venus', 0).body.pal[0][4]);
  assert.ok(vl > 0.8 && vh > 70 && vh < 110, 'Vénus jaune pâle');
  const [ul, , uh] = lch(gen('uranus', 0).body.pal[0][4]);
  assert.ok(ul > 0.75 && uh > 180 && uh < 220, 'Uranus cyan pâle');
  const [nl, , nh] = lch(gen('neptune', 0).body.pal[0][4]);
  assert.ok(nl < 0.6 && nh > 230 && nh < 290, 'Neptune bleu profond');
  const [pl, pc, ph] = lch(gen('pluton', 0).body.pal[5][4]);
  assert.ok(pl > 0.6 && pc < 0.08 && ph > 40 && ph < 90, 'Pluton beige');
  // Saturne a toujours un anneau, qui s'élargit ; Jupiter n'en a qu'un fin, plus tard.
  const s0 = gen('saturne', 0), s1 = gen('saturne', 1);
  assert.ok(s0.ring && s1.ring && s1.ring.outer > s0.ring.outer + 0.3);
  assert.equal(gen('jupiter', 2).ring, undefined);
  assert.ok(gen('jupiter', 3).ring.outer < 1.8);
  // Lunes nommées : Phobos et Deimos, les quatre galiléennes dans le plan de l'équateur, Titan, Charon.
  assert.deepEqual(gen('mars', 4).moons.map((m) => m.name), ['phobos', 'deimos']);
  const jup = gen('jupiter', 4);
  assert.deepEqual(jup.moons.map((m) => m.name), ['io', 'europe', 'ganymede', 'callisto']);
  assert.deepEqual(jup.moons[0].N, jup.ringN, 'dans le plan de l’équateur');
  assert.ok(jup.moons[0].a < jup.moons[3].a && jup.moons[0].cycles > jup.moons[3].cycles, 'les plus proches vont plus vite');
  assert.equal(gen('saturne', 4).moons[0].name, 'titan');
  const plu = gen('pluton', 2);
  assert.equal(plu.moons[0].name, 'charon');
  assert.ok(plu.moons[0].size > 0.4, 'Charon, grosse lune');
  assert.equal(plu.body.spinCycles, 0, 'Pluton ne tourne pas : son cœur reste face à nous');
  assert.equal(gen('neptune', 4).moons[0].kind, 'ice', 'Triton, lune de glace');
  // Uranus couchée sur le côté : l'axe (et l'anneau) bascule.
  assert.ok(Math.abs(gen('uranus', 1).body.roll) > 1.3 && Math.abs(gen('uranus', 0).body.roll) < 0.3);
  // Pas de décor tiré au hasard autour des astres du système.
  for (const b of S.BODIES) {
    const g = gen(b.id, b.ups.length);
    assert.equal(g.sats.length + g.sparkles.length + g.comets.length, 0, b.id);
    assert.ok(!g.far, b.id);
  }
});

test('sans ces options, rien ne change pour les autres astres ni pour les cartes', () => {
  const keys = ['craters', 'maria', 'lights', 'storm', 'bands', 'corona', 'flare', 'moonKind', 'heat', 'heart', 'icecaps', 'canyons', 'dust', 'veil', 'lightning', 'volcanoes', 'aurora', 'cyan', 'ringLook', 'moonPlane', 'axis', 'spin', 'plain'];
  const blank = Object.fromEntries(keys.map((k) => [k, undefined]));
  for (const type of ['moon', 'gas', 'desert', 'star', 'ice', 'terran', 'asteroid']) {
    for (const seed of [3, 42, 1110, 90210]) {
      for (const compact of [true, false]) {
        const a = OP.generate(seed, { type, compact, ring: true, moons: 2 });
        const b = OP.generate(seed, Object.assign({ type, compact, ring: true, moons: 2 }, blank));
        assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a)), `${type} ${seed}`);
      }
    }
  }
  // Les nouvelles classes d'étoiles ne sont jamais tirées au hasard.
  for (const label of ['soleil rouge', 'géante rouge']) assert.equal(OP.STAR_CLASSES.find((c) => c.label === label).w, 0);
});

test('sanitize : seuls les astres connus, avec des entiers bornés', () => {
  assert.deepEqual(S.sanitize(null), {});
  assert.deepEqual(S.sanitize([1, 2]), {});
  assert.deepEqual(S.sanitize('lune'), {});
  assert.deepEqual(S.sanitize({ lune: 2.7, neptune: 99, soleil: -1, vulcain: 3, pluton: 7 }), { lune: 2, neptune: 4, pluton: 2 });
  assert.deepEqual(S.sanitize({ lune: '3', neptune: null, soleil: true }), { lune: 3 });
  assert.deepEqual(S.sanitize({ mercure: 0 }), { mercure: 0 }, '0 : acheté, sans amélioration');
  assert.deepEqual(S.sanitize(Object.fromEntries(S.BODIES.map((b) => [b.id, 1e9]))), ALL, 'chaque valeur bornée à son astre');
});

test('profil public : publish (tous les astres) puis fromPublic, et lecture prudente des profils d’autrui', () => {
  const st = { mercure: 3, jupiter: 2, lune: 5, soleil: 1 };
  const pub = S.publish(st);
  assert.deepEqual(pub, { mercure: 3, jupiter: 2, lune: 5, soleil: 1 });
  assert.equal('neptune' in pub, false, 'clé absente : pas acheté');
  assert.deepEqual(S.fromPublic(JSON.parse(JSON.stringify(pub))), st);
  assert.deepEqual(S.publish(ALL), ALL, 'tous les astres');
  assert.deepEqual(S.fromPublic(JSON.parse(JSON.stringify(S.publish(ALL)))), ALL);
  // Anciens clients (pas d’astres) et données douteuses.
  assert.deepEqual(S.fromPublic(undefined), {});
  assert.deepEqual(S.fromPublic('lune'), {});
  assert.deepEqual(S.fromPublic([5]), {});
  assert.deepEqual(S.fromPublic({ lune: 1e9, neptune: -2, soleil: 1.5, vulcain: 2, pluton: 3, uranus: 3 }), { lune: 5, pluton: 2, uranus: 3 });
  assert.deepEqual(S.fromPublic({ lune: '2', neptune: NaN, soleil: Infinity, mars: null, venus: true }), {});
  const proto = Object.create({ lune: 3 });
  assert.deepEqual(S.fromPublic(proto), {}, 'propriétés propres seulement');
  for (const b of S.BODIES) assert.deepEqual(S.fromPublic({ [b.id]: 99 }), { [b.id]: b.ups.length }, `${b.id} borné`);
});

test('passage de niveau : les améliorations qui s’ouvrent, pour les astres achetés', () => {
  assert.deepEqual(S.unlocks({}, 5), [], 'Lune pas achetée');
  const st = { lune: 0, neptune: 0, pluton: 0 };
  assert.deepEqual(S.unlocks(st, 5).map((x) => x.up.id), ['crateres']);
  assert.deepEqual(S.unlocks(st, 6).map((x) => x.body.id), ['pluton']);
  assert.deepEqual(S.unlocks(st, 10).map((x) => x.body.id), ['neptune']);
  assert.deepEqual(S.unlocks({ lune: 1 }, 5), [], 'déjà faite');
  assert.deepEqual(S.unlocks(st, 7), []);
  // Deux astres au même niveau : Mercure et Mars (8).
  assert.deepEqual(S.unlocks({ mercure: 0, mars: 0 }, 8).map((x) => x.body.id), ['mercure', 'mars']);
});

test('succès : « Lumière ! » avec le Soleil, « Système solaire » avec tous les astres', () => {
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
  assert.equal(orbites.goal, S.BODIES.length);
  assert.equal(orbites.goal, 10);
  assert.deepEqual(orbites.vars, { n: 10 });
  mem['orbite.systeme'] = JSON.stringify({ lune: 2 });
  assert.equal(etoile.of(Su.facts()), 0);
  assert.equal(orbites.of(Su.facts()), 1);
  mem['orbite.systeme'] = JSON.stringify({ lune: 2, neptune: 0, soleil: 0 });
  assert.equal(etoile.of(Su.facts()), 1);
  assert.ok(orbites.of(Su.facts()) < orbites.goal, 'trois astres ne suffisent plus');
  mem['orbite.systeme'] = JSON.stringify(Object.fromEntries(S.BODIES.map((b) => [b.id, 0])));
  assert.equal(orbites.of(Su.facts()), orbites.goal, 'tous les astres');
});
