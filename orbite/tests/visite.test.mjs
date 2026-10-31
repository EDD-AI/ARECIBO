// Tests de la visite de votre planète (js/visite.js, v124) : node --test orbite/tests/visite.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../js/visite.js');
require('../js/planet-engine.js');
require('../js/planet-renderer.js');
const V = globalThis.OrbiteVisite;
const OP = globalThis.OrbitePlanets;
const DEG = Math.PI / 180;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= (eps || 1e-9), `${msg || ''} ${a} ≠ ${b}`);
const nearV = (a, b, eps, msg) => a.forEach((x, i) => near(x, b[i], eps, msg));
// Petit générateur reproductible.
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const empty = () => V.sanitize(null);

test('réglages : trois colonies, zoom ×1 à ×5, pôles visibles jusqu’à 75°', () => {
  assert.equal(V.MAX_SITES, 3);
  assert.equal(V.ZOOM_MIN, 1);
  assert.equal(V.ZOOM_MAX, 5);
  assert.ok(V.LAND_ZOOM > 1 && V.LAND_ZOOM < V.ZOOM_MAX);
  near(V.LAT_MAX, 75 * DEG);
  assert.equal(V.clampLat(2), V.LAT_MAX);
  assert.equal(V.clampLat(-2), -V.LAT_MAX);
  assert.equal(V.clampZoom(9), 5);
  assert.equal(V.clampZoom(0.2), 1);
  assert.equal(V.KEY, 'orbite.visite', 'synchronisée en ligne avec les autres clés orbite.*');
  near(Math.abs(V.wrap(3 * Math.PI)), Math.PI, 1e-12);
  near(V.wrap(2.5 * Math.PI), 0.5 * Math.PI, 1e-12);
  near(V.wrap(-3.5 * Math.PI), 0.5 * Math.PI, 1e-12);
});

test('projection : le point (lat, lon) de l’orientation est au centre, face à nous', () => {
  for (let i = 0; i < 200; i++) {
    const o = V.orient((rnd() * 2 - 1) * V.LAT_MAX, (rnd() * 2 - 1) * Math.PI);
    nearV(V.toView(o.lat, o.lon, o), [0, 0, 1], 1e-9, 'centre');
    const c = V.fromView(0, 0, o);
    near(c.lat, o.lat, 1e-9); near(V.wrap(c.lon - o.lon), 0, 1e-9);
    // Aller-retour vue → corps → vue pour un point quelconque du disque.
    const r = Math.sqrt(rnd()) * 0.99, a = rnd() * Math.PI * 2;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    const p = V.fromView(x, y, o);
    const v = V.toView(p.lat, p.lon, o);
    near(v[0], x, 1e-9); near(v[1], y, 1e-9); assert.ok(v[2] > 0);
  }
  assert.equal(V.fromView(0.9, 0.9, V.orient(0, 0)), null, 'hors de la planète');
  // Orientation (0, 0) : l'est à droite, le nord en haut ; l'antipode est caché derrière.
  const o = V.orient(0, 0);
  const east = V.project(0, 30 * DEG, o, 100, 100, 50), north = V.project(30 * DEG, 0, o, 100, 100, 50);
  assert.ok(east.x > 100 && Math.abs(east.y - 100) < 1e-9 && east.front);
  assert.ok(north.y < 100 && Math.abs(north.x - 100) < 1e-9 && north.front);
  assert.equal(V.project(0, Math.PI, o, 100, 100, 50).front, false, 'derrière : balise cachée');
  // Le pôle nord vu de 75° : presque au centre, un peu au-dessus.
  const pole = V.project(Math.PI / 2, 0, V.orient(V.LAT_MAX, 1), 0, 0, 1);
  assert.ok(pole.front && pole.y < 0 && pole.y > -0.3);
});

test('glisser fait tourner le globe dans les deux sens, et la latitude reste bornée', () => {
  const o = V.orient(0.2, 1);
  const right = V.drag(o, 40, 0, 200);
  assert.ok(right.lon < o.lon, 'vers la droite : la longitude du centre diminue');
  // Le point qui était au centre a suivi le doigt vers la droite.
  const p = V.project(o.lat, o.lon, right, 0, 0, 200);
  assert.ok(p.x > 30 && p.x < 50, 'la surface suit le doigt au centre : ' + p.x);
  const down = V.drag(o, 0, 50, 200);
  assert.ok(down.lat > o.lat, 'vers le bas : on remonte vers le nord');
  const q = V.project(o.lat, o.lon, down, 0, 0, 200);
  assert.ok(q.y > 40 && q.y < 55, 'le point du centre descend avec le doigt : ' + q.y);
  let w = o;
  for (let i = 0; i < 50; i++) w = V.drag(w, 0, 80, 100);
  near(w.lat, V.LAT_MAX, 1e-12, 'pôle nord borné');
  for (let i = 0; i < 100; i++) w = V.drag(w, 0, -80, 100);
  near(w.lat, -V.LAT_MAX, 1e-12, 'pôle sud borné');
  for (let i = 0; i < 40; i++) w = V.drag(w, 90, 0, 100);
  assert.ok(w.lon >= -Math.PI && w.lon <= Math.PI, 'longitude ramenée dans [-π, π]');
});

test('zoomer autour du pointeur : le point visé reste sous le pointeur', () => {
  for (let i = 0; i < 300; i++) {
    const o = V.orient((rnd() * 2 - 1) * 1.1, (rnd() * 2 - 1) * Math.PI);
    const z0 = 1 + rnd() * 3, z1 = V.clampZoom(z0 * (0.6 + rnd() * 1.2));
    const u = (rnd() * 2 - 1) * 0.6, v = (rnd() * 2 - 1) * 0.6;
    if ((u * u + v * v) / (z0 * z0) >= 0.9 || (u * u + v * v) / (z1 * z1) >= 0.9) continue;
    const p = V.fromView(u / z0, v / z0, o);
    const o2 = V.zoomAt(o, z0, z1, u, v);
    if (Math.abs(o2.lat) >= V.LAT_MAX - 1e-9) continue; // bornée : la position est approchée
    const w = V.toView(p.lat, p.lon, o2);
    near(w[0], u / z1, 1e-6, 'x'); near(w[1], v / z1, 1e-6, 'y');
  }
  // Au centre, zoomer ne fait pas tourner.
  const o = V.orient(0.3, 0.4), c = V.zoomAt(o, 1, 3, 0, 0);
  near(c.lat, o.lat, 1e-9); near(c.lon, o.lon, 1e-9);
});

test('fonder : jamais sur l’océan, assez loin des autres, trois au plus', () => {
  const st = empty();
  const ocean = V.canFound(st, 0, 0, 'ocean');
  assert.equal(ocean.ok, false);
  assert.equal(ocean.why, 'ocean');
  assert.match(ocean.reason, /océan/);
  assert.equal(V.canFound(st, 0, 0, 'prairie').ok, true);
  const a = V.found(st, 0, 0, 'prairie', 1000);
  assert.equal(a.id, 'terre-1');
  assert.equal(V.nameOf(a), 'Aube');
  const close = V.canFound(st, 0.1, 0.1, 'foret');
  assert.equal(close.ok, false);
  assert.equal(close.why, 'near');
  assert.equal(close.site.id, 'terre-1');
  assert.match(close.reason, /Aube/);
  assert.equal(V.canFound(st, 0, V.MIN_DIST + 0.01, 'foret').ok, true);
  // Le réticule sur la colonie : on y retourne (siteAt), pas une de plus.
  assert.equal(V.siteAt(st, 0.05, 0.05).id, 'terre-1');
  assert.equal(V.siteAt(st, 0.2, 0.2), null);
  assert.ok(V.HOME_DIST < V.MIN_DIST);
  const b = V.found(st, 0.5, 1, 'foret', 2000);
  const c = V.found(st, -0.6, -2, 'glace', 3000);
  assert.deepEqual(st.sites.map((s) => s.id), ['terre-1', 'terre-2', 'terre-3']);
  assert.equal(new Set(st.sites.map((s) => V.nameOf(s))).size, 3, 'trois noms différents');
  assert.equal(b.g, 'foret'); assert.equal(c.g, 'glace');
  const full = V.canFound(st, 1, 2.5, 'prairie');
  assert.equal(full.ok, false);
  assert.equal(full.why, 'max');
  // Un site retiré (sauvegarde) libère son numéro et son nom.
  st.sites.splice(1, 1);
  const d = V.found(st, 1, 2.5, 'sable', 4000);
  assert.equal(d.id, 'terre-2');
  assert.equal(d.n, 1);
  assert.equal(V.nextSlot(empty()).id, 'terre-1');
});

test('le sol vu de l’espace : rangées de palette du moteur → nature du sol et sol de la colonie', () => {
  assert.deepEqual([0, 1, 2].map(V.groundOfRow), ['ocean', 'ocean', 'ocean']);
  assert.equal(V.groundOfRow(3), 'sable');
  assert.equal(V.groundOfRow(4), 'prairie');
  assert.equal(V.groundOfRow(5), 'foret');
  assert.equal(V.groundOfRow(6), 'montagne');
  assert.equal(V.groundOfRow(7), 'glace');
  assert.equal(V.groundOfRow(-1), null);
  assert.equal(V.groundOfRow(12), null);
  assert.equal(V.themeOf('prairie'), 'terre');
  assert.equal(V.themeOf('foret'), 'terre');
  assert.equal(V.themeOf('glace'), 'glace');
  assert.equal(V.themeOf('sable'), 'sable');
  // Les sols des colonies existent dans le rendu des bâtiments.
  const src = readFileSync(new URL('../js/building-renderer.js', import.meta.url), 'utf8');
  for (const g of Object.keys(V.GROUNDS)) if (g !== 'ocean') assert.match(src, new RegExp(`\\b${V.themeOf(g)}: \\['#`), 'sol ' + V.themeOf(g));
});

test('colonie d’un site : id distinct de la Forge, graine stable tirée de la planète et du site', () => {
  const st = empty();
  const s1 = V.found(st, 0.2, 0.3, 'foret', 1), s2 = V.found(st, -0.4, 2, 'glace', 2);
  const p1 = V.planetOf(5002, s1);
  assert.equal(p1.id, 'terre-1');
  assert.ok(!/^f/.test(p1.id), 'les mondes forgés ont des ids en f…');
  assert.equal(p1.theme, 'terre');
  assert.equal(V.planetOf(5002, s2).theme, 'glace');
  assert.equal(p1.seed, V.planetOf(5002, s1).seed, 'toujours la même graine');
  assert.notEqual(p1.seed, V.planetOf(5002, s2).seed);
  assert.notEqual(p1.seed, V.planetOf(5008, s1).seed, 'une autre planète, une autre colonie');
  assert.ok(Number.isInteger(p1.seed) && p1.seed >= 0 && p1.seed < 2 ** 32);
});

test('sauvegarde nettoyée : ids, nombre, angles et sols invalides', () => {
  assert.deepEqual(V.sanitize('n’importe quoi').sites, []);
  assert.deepEqual(V.sanitize({ sites: 'x' }).sites, []);
  const st = V.sanitize({
    o: { lat: 3, lon: 10 },
    sites: [
      { id: 'terre-1', n: 0, lat: 0.1, lon: 7, g: 'foret', t: 5 },
      { id: 'terre-1', n: 1, lat: 0.5, lon: 0, g: 'foret' },
      { id: 'f12ab', n: 1, lat: 0.5, lon: 0, g: 'foret' },
      { id: 'terre-2', n: 99, lat: 0.5, lon: 1, g: 'ocean' },
      { id: 'terre-3', n: 2, lat: 'x', lon: 1, g: 'glace' },
      { id: 'terre-4', n: 2, lat: 2, lon: 1, g: 'glace' },
      { id: 'terre-5', n: 2, lat: -0.3, lon: 1, g: 'lave' },
      { id: 'terre-6', n: 3, lat: -0.3, lon: 2, g: 'sable' },
      null
    ]
  });
  assert.deepEqual(st.sites.map((s) => s.id), ['terre-1', 'terre-2', 'terre-5'], 'trois au plus, sans doublon ni intrus');
  near(st.sites[0].lon, V.wrap(7), 1e-12);
  assert.equal(st.sites[1].n, 0, 'nom inconnu → premier nom');
  assert.equal(st.sites[1].g, 'prairie', 'jamais un site sur l’océan');
  assert.equal(st.sites[2].g, 'prairie', 'sol inconnu → prairie');
  near(st.o.lat, V.LAT_MAX, 1e-12);
  near(st.o.lon, V.wrap(10), 1e-12);
  assert.deepEqual(V.sanitize(JSON.parse(JSON.stringify(st))), st, 'stable');
});

// ─── Moteur : l'option orient pilote l'astre sans rien changer aux autres ──
// Faux moteur : drawSystem appelle ses passes, qu'on enregistre au lieu de dessiner.
function fakeRenderer() {
  const r = Object.create(OP.Renderer.prototype);
  const noop = () => {};
  r.gl = { viewport: noop, enable: noop, disable: noop, SCISSOR_TEST: 0 };
  r.W = 400; r.H = 400; r.bound = null;
  r.calls = [];
  r.batch = { reset: noop, push: noop };
  r.uploadBatch = noop;
  r.drawLayer = (l) => r.calls.push(['layer', l]);
  r.systemSprites = () => r.calls.push(['sprites']);
  r.bodyPass = (b, layer, P) => r.calls.push(['body', layer, P]);
  r.ringPass = (g, pass) => r.calls.push(['ring', pass]);
  r.haloPass = (mode) => r.calls.push(['halo', mode]);
  r.moonPass = () => r.calls.push(['moon']);
  return r;
}
// La formule du shader (FS_BODY) : corps = rotY(uTilt · vue, -spin), uTilt envoyé tel quel (non transposé).
function shaderBody(T, spin, pv) {
  const t = [0, 1, 2].map((i) => T[i] * pv[0] + T[3 + i] * pv[1] + T[6 + i] * pv[2]);
  const c = Math.cos(-spin), s = Math.sin(-spin);
  return [c * t[0] + s * t[2], t[1], -s * t[0] + c * t[2]];
}
const living = () => OP.livingWorld(5002, { heat: 1, air: 1, water: 1, ice: 1, clouds: 0.75, life: 1, moon: 1, ring: 1, sats: 2, halo: 1 }, { light: [-0.42, 0.5, 0.76] });

test('moteur, non-régression : sans orient, la rotation et l’axe de l’astre sont ceux d’avant', () => {
  for (const g of [OP.generate(4242, { type: 'gas', ring: true, moons: 2 }), living(), OP.generate(77, { type: 'earth', moons: 1 })]) {
    const r = fakeRenderer(), b = g.body, phase = 0.37;
    r.drawSystem(g, { cx: 200, cy: 200, R: 60, phase });
    const bodies = r.calls.filter((c) => c[0] === 'body');
    near(bodies[0][2].spin, 2 * Math.PI * b.spinCycles * phase + b.spinOffset, 1e-12, 'spin');
    assert.equal(bodies[0][2].tilt, null, 'axe propre de l’astre (b.M32)');
    assert.ok(!bodies[0][2].oct, 'octaves du relief selon la taille, comme avant');
    if (b.clouds) near(bodies[1][2].spin, 2 * Math.PI * (b.spinCycles + b.clouds.extraCycles) * phase + b.spinOffset, 1e-12, 'nuages');
    assert.equal(r.calls.filter((c) => c[0] === 'moon').length, g.moons.length, 'lunes dessinées');
    assert.equal(r.calls.filter((c) => c[0] === 'ring').length, g.ring ? 2 : 0, 'anneau dessiné');
    assert.ok(r.calls.some((c) => c[0] === 'sprites'));
  }
});

test('moteur : orient met le point (lat, lon) face à nous, comme les maths de js/visite.js', () => {
  const g = living(), b = g.body;
  for (let i = 0; i < 50; i++) {
    const o = V.orient((rnd() * 2 - 1) * V.LAT_MAX, (rnd() * 2 - 1) * Math.PI);
    for (const phase of [0, 0.5]) {
      const r = fakeRenderer();
      r.drawSystem(g, { cx: 200, cy: 200, R: 60, phase, orient: o, bare: true });
      const bodies = r.calls.filter((c) => c[0] === 'body');
      const P = bodies[0][2];
      near(P.spin, -o.lon, 1e-12, 'pas de rotation automatique');
      assert.ok(!P.oct, 'petit globe : octaves habituelles');
      assert.ok(P.tilt instanceof Float32Array);
      // Le centre de l'image montre (lat, lon), et chaque point suit la même projection que les balises.
      nearV(shaderBody(P.tilt, P.spin, [0, 0, 1]), [Math.cos(o.lat) * Math.sin(o.lon), Math.sin(o.lat), Math.cos(o.lat) * Math.cos(o.lon)], 1e-6, 'centre');
      const pv = [0.3, -0.4, Math.sqrt(1 - 0.25)];
      nearV(shaderBody(P.tilt, P.spin, pv), V.viewToBody(pv, o), 1e-6, 'point quelconque');
      // Les nuages dérivent doucement au-dessus d'un sol immobile, sur la même orientation.
      near(bodies[1][2].spin, -o.lon + 2 * Math.PI * b.clouds.extraCycles * phase, 1e-12, 'nuages');
      assert.equal(bodies[1][2].tilt, P.tilt);
      assert.equal(r.calls.filter((c) => c[0] === 'moon' || c[0] === 'ring' || c[0] === 'sprites').length, 0, 'bare : l’astre seul');
      assert.ok(r.calls.some((c) => c[0] === 'halo'), 'l’atmosphère reste');
    }
  }
  // De près, plus de détails dans le relief.
  const big = fakeRenderer();
  big.drawSystem(g, { cx: 200, cy: 200, R: 500, phase: 0, orient: V.orient(0, 0), bare: true });
  assert.equal(big.calls.find((c) => c[0] === 'body')[2].oct, 7);
  // La sonde du sol existe dans le shader et le moteur.
  const src = readFileSync(new URL('../js/planet-renderer.js', import.meta.url), 'utf8');
  assert.match(src, /uniform int uPick;/);
  assert.match(src, /if \(uPick == 1\) \{ outColor = vec4\(float\(s\.row\) \/ 255\.0/);
  assert.equal(typeof OP.Renderer.prototype.pickBody, 'function');
});

test('page : scripts chargés dans l’ordre, mis en cache hors ligne, écran et bouton présents', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const order = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  const at = (s) => { const i = order.indexOf(s); assert.ok(i >= 0, s + ' chargé'); return i; };
  assert.ok(at('js/lang/visite.js') < at('js/world.js'), 'traductions avant les textes de world.js');
  assert.ok(at('js/visite.js') < at('js/game.js'));
  assert.ok(at('js/colonie-ui.js') < at('js/visite-ui.js'));
  for (const f of ['js/visite.js', 'js/visite-ui.js', 'js/lang/visite.js']) assert.ok(sw.includes(`'./${f}'`), f + ' en cache');
  assert.match(html, /id="visite"/);
  assert.match(html, /id="mkVisit"/);
  assert.match(html, /data-planet="visite-world"[^>]*data-bare="1"/);
});
