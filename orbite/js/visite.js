/* ORBITE — Visiter sa planète (v125), les règles (pures, testables sous Node).
 * Une fois « Visiter la planète » achetée au Marché (Ma planète), le joueur fait tourner son monde
 * vivant, s'en approche et fonde jusqu'à trois colonies sur la terre ferme. Ce fichier tient les sites
 * (nombre, écart, noms, sauvegarde) et les maths du globe : orientation, projection lat/lon ↔ écran.
 *
 * Orientation o = { lat, lon } : le point (lat, lon) de la planète est au centre de l'écran. Le moteur
 * (js/planet-renderer.js, option orient) dessine alors avec spin = -lon et l'inclinaison rotX(lat) :
 *   vue = rotX(lat) · rotY(-lon) · corps     et     corps = rotY(lon) · rotX(-lat) · vue
 * Repère de la vue : x à droite, y en haut, z vers le joueur (z > 0 : face visible). Repère du corps :
 * y vers le pôle nord, un point (lat, lon) vaut (cos lat · sin lon, sin lat, cos lat · cos lon). */
(function (root) {
  'use strict';
  const tr = (typeof window !== 'undefined' && window.tr) || ((s, v) => v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);

  const KEY = 'orbite.visite';
  const TUTO_KEY = 'orbite.visite.tuto';
  const MAX_SITES = 3;
  // Écart minimal entre deux colonies : un angle au centre de la planète (0,4 rad, environ 23°).
  const MIN_DIST = 0.4;
  // Le réticule sur une colonie (à moins de 0,12 rad, 7°) : ATTERRIR ICI y ramène.
  const HOME_DIST = 0.12;
  const DEG = Math.PI / 180;
  // On peut voir les pôles, sans basculer par-dessus : latitude du centre bornée à ±75°.
  const LAT_MAX = 75 * DEG;
  const ZOOM_MIN = 1, ZOOM_MAX = 5;
  // À partir de ce zoom, le réticule et ATTERRIR ICI apparaissent.
  const LAND_ZOOM = 2;
  // Noms simples des colonies, dans l'ordre de fondation (la sauvegarde garde leur numéro).
  const NAMES = [tr('Aube'), tr('Havre'), tr('Clairière'), tr('Rivage'), tr('Zénith'), tr('Alizé')];

  // Le sol vu de l'espace : la rangée de palette dessinée par le moteur (terranSurf) → nature du sol.
  // 0 à 2 : les eaux, 3 : sable et plages, 4 : prairies, 5 : forêts, 6 : montagnes, 7 : neige et glace.
  const ROWS = ['ocean', 'ocean', 'ocean', 'sable', 'prairie', 'foret', 'montagne', 'glace'];
  const GROUNDS = {
    ocean: { name: tr('Océan'), theme: null },
    sable: { name: tr('Sable'), theme: 'sable' },
    prairie: { name: tr('Prairie'), theme: 'terre' },
    foret: { name: tr('Forêt'), theme: 'terre' },
    montagne: { name: tr('Montagne'), theme: 'lune' },
    glace: { name: tr('Glace'), theme: 'glace' }
  };
  const groundOfRow = (row) => (Number.isInteger(row) && row >= 0 && row < ROWS.length ? ROWS[row] : null);
  const themeOf = (g) => (GROUNDS[g] && GROUNDS[g].theme) || 'terre';

  // ─── Angles ─────────────────────────────────────────────────
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  function wrap(a) {
    let x = (a + Math.PI) % (2 * Math.PI);
    if (x < 0) x += 2 * Math.PI;
    return x - Math.PI;
  }
  const clampLat = (lat) => clamp(lat, -LAT_MAX, LAT_MAX);
  const clampZoom = (z) => clamp(z, ZOOM_MIN, ZOOM_MAX);
  function orient(lat, lon) { return { lat: clampLat(Number(lat) || 0), lon: wrap(Number(lon) || 0) }; }

  // Point (lat, lon) → direction dans le repère du corps.
  const dir = (lat, lon) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  // Mêmes rotations que le moteur (rotY du shader, rotX de planet-engine.js).
  const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]]; };
  const rotX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]]; };
  const bodyToView = (p, o) => rotX(rotY(p, -o.lon), o.lat);
  const viewToBody = (v, o) => rotY(rotX(v, -o.lat), o.lon);
  const latLonOf = (p) => ({ lat: Math.asin(clamp(p[1], -1, 1)), lon: Math.atan2(p[0], p[2]) });

  // (lat, lon) → vue [x, y, z] pour l'orientation o (rayon 1).
  const toView = (lat, lon, o) => bodyToView(dir(lat, lon), o);
  // Point de la vue (x, y) sur le disque de rayon 1 → (lat, lon), ou null hors de la planète.
  function fromView(x, y, o) {
    const d = x * x + y * y;
    if (!(d <= 1)) return null;
    return latLonOf(viewToBody([x, y, Math.sqrt(1 - d)], o));
  }
  // (lat, lon) → pixels de l'écran, pour un globe de centre (cx, cy) et de rayon R (y vers le bas).
  function project(lat, lon, o, cx, cy, R) {
    const v = toView(lat, lon, o);
    return { x: cx + v[0] * R, y: cy - v[1] * R, z: v[2], front: v[2] > 0 };
  }
  // Angle au centre entre deux points de la planète.
  function angDist(lat1, lon1, lat2, lon2) {
    const a = dir(lat1, lon1), b = dir(lat2, lon2);
    return Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
  }

  // ─── Gestes ─────────────────────────────────────────────────
  // Glisser de (dx, dy) pixels sur un globe de rayon R pixels : la surface suit le doigt au centre
  // (vers la droite, la longitude du centre diminue ; vers le bas, on remonte vers le nord). Près des
  // pôles, la rotation est un peu plus rapide (sans s'emballer) pour garder la même sensation.
  function drag(o, dx, dy, R) {
    const r = Math.max(1, R);
    return orient(o.lat + dy / r, o.lon - dx / (r * Math.max(0.5, Math.cos(o.lat))));
  }
  // Zoom de z0 à z1 autour d'un point de l'écran (u, v) : décalage depuis le centre, en rayons du
  // globe à ×1 (u vers la droite, v vers le haut). Le point de la planète sous le pointeur y reste :
  // on cherche l'orientation qui le ramène sous le pointeur au nouveau zoom.
  function zoomAt(o, z0, z1, u, v) {
    const x0 = u / z0, y0 = v / z0, x1 = u / z1, y1 = v / z1;
    if (x0 * x0 + y0 * y0 >= 0.98 || x1 * x1 + y1 * y1 >= 0.98) return orient(o.lat, o.lon);
    const p = viewToBody([x0, y0, Math.sqrt(1 - x0 * x0 - y0 * y0)], o);
    return aim(p, [x1, y1, Math.sqrt(1 - x1 * x1 - y1 * y1)], o);
  }
  // Orientation (la plus proche de o) qui place le point p du corps au point w de la vue.
  function aim(p, w, o) {
    // rotX(-lat) · w doit avoir la même hauteur y que p (rotY ne change pas y).
    const A = Math.hypot(w[1], w[2]), phi = Math.atan2(w[2], w[1]);
    let lat = o.lat;
    if (A > 1e-9) {
      const k = Math.acos(clamp(p[1] / A, -1, 1));
      const c1 = wrap(phi + k), c2 = wrap(phi - k);
      lat = Math.abs(c1 - o.lat) <= Math.abs(c2 - o.lat) ? c1 : c2;
    }
    lat = clampLat(lat);
    const q = rotX(w, -lat);
    const lon = Math.atan2(p[0], p[2]) - Math.atan2(q[0], q[2]);
    return orient(lat, lon);
  }
  // Chemin le plus court d'une longitude à l'autre (animations).
  const lerpLon = (a, b, t) => wrap(a + wrap(b - a) * t);

  // ─── Sites ──────────────────────────────────────────────────
  const idOf = (n) => 'terre-' + n;
  const nameOf = (site) => NAMES[site && site.n >= 0 && site.n < NAMES.length ? site.n : 0];
  function nearest(st, lat, lon) {
    let best = null, d = Infinity;
    for (const s of st.sites) {
      const k = angDist(lat, lon, s.lat, s.lon);
      if (k < d) { d = k; best = s; }
    }
    return { site: best, d };
  }
  // La colonie sous le réticule, s'il y en a une (on y retourne au lieu d'en fonder une autre).
  function siteAt(st, lat, lon) {
    const n = nearest(st, lat, lon);
    return n.site && n.d < HOME_DIST ? n.site : null;
  }
  // Peut-on fonder une colonie ici ? ground : nature du sol sous le réticule (null : inconnue).
  function canFound(st, lat, lon, ground) {
    if (st.sites.length >= MAX_SITES) return { ok: false, why: 'max', reason: tr('Trois colonies au plus sur votre planète : touchez une balise pour y retourner.') };
    if (ground === 'ocean') return { ok: false, why: 'ocean', reason: tr('Impossible de se poser sur l’océan.') };
    const n = nearest(st, lat, lon);
    if (n.site && n.d < MIN_DIST) return { ok: false, why: 'near', site: n.site, reason: tr('Trop près de {nom} : éloignez-vous un peu.', { nom: nameOf(n.site) }) };
    return { ok: true };
  }
  // Prochain site : premier numéro et premier nom libres.
  function nextSlot(st) {
    const ids = new Set(st.sites.map((s) => s.id)), names = new Set(st.sites.map((s) => s.n));
    let k = 1;
    while (ids.has(idOf(k))) k++;
    let n = 0;
    while (names.has(n) && n < NAMES.length - 1) n++;
    return { id: idOf(k), n, name: NAMES[n] };
  }
  // Fonde le site (il faut avoir vérifié canFound).
  function found(st, lat, lon, ground, now) {
    const slot = nextSlot(st);
    const site = { id: slot.id, n: slot.n, lat: clampLat(lat), lon: wrap(lon), g: GROUNDS[ground] && ground !== 'ocean' ? ground : 'prairie', t: Math.floor(now || 0) };
    st.sites.push(site);
    return site;
  }
  // Graine de la colonie : celle de la planète et la place du site (toujours la même pour un site).
  function siteSeed(worldSeed, site) {
    let h = 2166136261 ^ (worldSeed >>> 0);
    for (const v of [Math.round(site.lat * 1000), Math.round(site.lon * 1000), site.n | 0, 124]) {
      h = Math.imul(h ^ (v & 0xffff), 16777619);
      h = Math.imul(h ^ (v >>> 16 & 0xffff), 16777619);
    }
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  // La colonie (écran de colonie-ui.js) d'un site.
  function planetOf(worldSeed, site) {
    return { id: site.id, seed: siteSeed(worldSeed, site), type: 'earth', theme: themeOf(site.g), hue: 0, name: nameOf(site), home: true };
  }

  // ─── Sauvegarde ─────────────────────────────────────────────
  // { sites: [{ id: 'terre-1', n, lat, lon, g, t }], o: { lat, lon } } : tout ce qui est illisible saute.
  function sanitize(raw) {
    const st = { sites: [], o: { lat: 0.35, lon: 0 } };
    if (!raw || typeof raw !== 'object') return st;
    const okNum = (x) => typeof x === 'number' && isFinite(x);
    if (raw.o && okNum(raw.o.lat) && okNum(raw.o.lon)) st.o = orient(raw.o.lat, raw.o.lon);
    const ids = new Set();
    for (const s of Array.isArray(raw.sites) ? raw.sites : []) {
      if (st.sites.length >= MAX_SITES) break;
      if (!s || typeof s !== 'object' || !/^terre-[1-9]$/.test(s.id) || ids.has(s.id)) continue;
      if (!okNum(s.lat) || !okNum(s.lon) || Math.abs(s.lat) > Math.PI / 2) continue;
      const n = Number.isInteger(s.n) && s.n >= 0 && s.n < NAMES.length ? s.n : 0;
      const g = typeof s.g === 'string' && GROUNDS[s.g] && s.g !== 'ocean' ? s.g : 'prairie';
      ids.add(s.id);
      st.sites.push({ id: s.id, n, lat: s.lat, lon: wrap(s.lon), g, t: okNum(s.t) && s.t > 0 ? Math.floor(s.t) : 0 });
    }
    return st;
  }

  root.OrbiteVisite = {
    KEY, TUTO_KEY, MAX_SITES, MIN_DIST, HOME_DIST, LAT_MAX, ZOOM_MIN, ZOOM_MAX, LAND_ZOOM, NAMES, ROWS, GROUNDS,
    groundOfRow, themeOf, wrap, clampLat, clampZoom, orient, dir, toView, fromView, project, angDist,
    drag, zoomAt, aim, lerpLon, idOf, nameOf, nearest, siteAt, canFound, nextSlot, found, siteSeed, planetOf, sanitize,
    bodyToView, viewToBody
  };
})(typeof window !== 'undefined' ? window : globalThis);
