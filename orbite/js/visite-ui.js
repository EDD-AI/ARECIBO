/* ORBITE — Visiter sa planète (v125), l'interface. Une fois « Visiter la planète » achetée, le bouton
 * VISITER de l'onglet MA PLANÈTE (ou la grande planète) ouvre l'écran #visite : votre monde vivant en
 * grand, qu'on fait tourner au doigt ou à la souris dans tous les sens, comme dans Spore, et dont on
 * s'approche en pinçant ou à la molette. Assez près, un réticule montre le sol sous le centre : sur la
 * terre ferme, ATTERRIR ICI fonde une colonie (trois au plus), qui se joue avec l'écran de colonie de
 * la Création (js/colonie-ui.js). Les colonies brillent ensuite sur le globe, à leur place.
 * Les règles et les maths du globe sont dans js/visite.js. */
(function () {
  'use strict';
  const O = window.__orbite;
  const V = window.OrbiteVisite;
  if (!O || !O.api || !V) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const icon = A.icon, esc = A.esc;
  if (!$('visite')) return;

  const LOOK = 'visite-world';
  // Lumière plus de face que dans la vitrine du Marché : on voit mieux le sol en se promenant.
  const LIGHT = [-0.42, 0.5, 0.76];
  const FINE = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const owned = () => A.worldList().includes('visite');
  const active = () => $('visite').classList.contains('active');

  let st = V.sanitize(null);
  // o : orientation (le point au centre) ; z : zoom ; D0 : diamètre du globe à ×1 (pixels de la vue).
  const vs = {
    o: V.orient(0.35, 0), z: 1, D0: 300, w: 0, h: 0, vel: null, anim: null, raf: 0, last: 0,
    ptrs: new Map(), g: null, lastTap: null, ground: undefined, probeKey: '', probeAt: 0, probing: false,
    busy: false, used: false, mode: '', tip: '', coach: false
  };

  const load = () => V.sanitize(A.readJson(V.KEY, null));
  function save() {
    st.o = V.orient(vs.o.lat, vs.o.lon);
    A.store.set(V.KEY, JSON.stringify(V.sanitize(st)));
  }
  const worldSeed = () => A.worldLook(A.worldList(), A.playerTag()).seed;
  const look = () => Object.assign({}, A.worldLook(A.worldList(), A.playerTag()), { light: LIGHT });

  // ─── Dessin ─────────────────────────────────────────────────
  // Le globe : sa boîte grandit avec le zoom (l'astre reste net), toujours centrée dans la vue.
  function layout() {
    const view = $('vsView'), el = $('vsPlanet');
    vs.w = view.clientWidth; vs.h = view.clientHeight;
    vs.D0 = Math.max(120, Math.min(vs.w * 0.86, vs.h * 0.8));
    const D = vs.D0 * vs.z;
    const key = D.toFixed(1) + ':' + vs.w + ':' + vs.h;
    if (el._k !== key) {
      el._k = key;
      el.style.width = el.style.height = D.toFixed(1) + 'px';
      el.style.left = ((vs.w - D) / 2).toFixed(1) + 'px';
      el.style.top = ((vs.h - D) / 2).toFixed(1) + 'px';
    }
    if (stage.orient) stage.orient(el, { lat: vs.o.lat, lon: vs.o.lon });
  }
  const radius = () => (vs.D0 * vs.z) / 2;

  // Les balises des colonies : à leur place sur le globe, cachées quand elles passent derrière.
  function renderMarks() {
    $('vsMarks').innerHTML = st.sites.map((s) => `<button class="vs-mark" type="button" data-site="${s.id}" aria-label="${esc(tr('Atterrir à {nom}', { nom: V.nameOf(s) }))}"><i></i><span>${esc(V.nameOf(s))}</span></button>`).join('');
    $('vsSub').textContent = tr('{n} / {max} colonies', { n: st.sites.length, max: V.MAX_SITES });
  }
  function placeMarks() {
    const R = radius(), cx = vs.w / 2, cy = vs.h / 2;
    for (const b of $('vsMarks').children) {
      const s = st.sites.find((x) => x.id === b.dataset.site);
      if (!s) continue;
      const p = V.project(s.lat, s.lon, vs.o, cx, cy, R);
      const vis = p.z > 0.06 && p.x > -30 && p.x < vs.w + 30 && p.y > -30 && p.y < vs.h + 30;
      b.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      b.style.opacity = vis ? Math.min(1, (p.z - 0.06) * 5).toFixed(2) : '0';
      b.style.visibility = vis ? 'visible' : 'hidden';
    }
  }

  // Le réticule, le bouton du bas et la ligne d'aide, selon le zoom et le sol visé.
  function updateBar() {
    const near = vs.z >= V.LAND_ZOOM - 0.01;
    $('vsReticle').hidden = !near;
    const mode = near ? 'land' : 'zoom';
    if (mode !== vs.mode) {
      vs.mode = mode;
      $('vsLand').innerHTML = near ? tr('ATTERRIR ICI') : tr('S’APPROCHER');
      if (!near) { vs.ground = undefined; vs.probeKey = ''; }
    }
    let tip = '', cls = '';
    const full = st.sites.length >= V.MAX_SITES;
    if (!near) tip = full ? tr('Touchez une balise pour retourner dans une colonie.') : tr('Approchez-vous d’une terre pour y fonder une colonie.');
    else if (V.siteAt(st, vs.o.lat, vs.o.lon)) { tip = tr('Votre colonie {nom} : ATTERRIR ICI pour y retourner.', { nom: V.nameOf(V.siteAt(st, vs.o.lat, vs.o.lon)) }); cls = 'good'; }
    else if (vs.ground === undefined || vs.ground === null) tip = '…';
    else {
      const c = V.canFound(st, vs.o.lat, vs.o.lon, vs.ground);
      if (c.ok) { tip = tr('{sol} : vous pouvez fonder une colonie ici.', { sol: V.GROUNDS[vs.ground].name }); cls = 'good'; }
      else { tip = c.reason; cls = 'bad'; }
    }
    const key = tip + '|' + cls + '|' + vs.ground + '|' + near;
    if (key !== vs.tip) {
      vs.tip = key;
      const t = $('vsTip');
      t.textContent = tip;
      t.className = 'vs-tip ' + cls;
      const g = vs.ground;
      $('vsGround').textContent = g ? V.GROUNDS[g].name.toUpperCase() : '';
      $('vsReticle').className = 'vs-reticle ' + (g === 'ocean' ? 'sea' : g ? 'land' : '');
      $('vsReticle').hidden = !near;
    }
  }

  // Le sol sous le réticule : le moteur relit la rangée de palette dessinée au centre (nuages exclus).
  async function probe() {
    if (!stage.probe) return -1;
    const r = $('vsView').getBoundingClientRect();
    return stage.probe($('vsPlanet'), r.left + r.width / 2, r.top + r.height / 2);
  }
  async function probeGround() {
    if (vs.probing) return;
    const key = vs.o.lat.toFixed(3) + ',' + vs.o.lon.toFixed(3) + ',' + vs.z.toFixed(2);
    if (key === vs.probeKey) return;
    vs.probing = true;
    const row = await probe();
    vs.probing = false;
    vs.probeKey = key;
    vs.ground = row < 0 ? null : V.groundOfRow(row);
  }
  // Pour atterrir : une sonde fraîche, juste au moment de décider (sans moteur 3D : la terre).
  async function groundNow() {
    if (!stage.probe) return 'prairie';
    const row = await probe();
    const g = row < 0 ? null : V.groundOfRow(row);
    return g || 'prairie';
  }

  // ─── Boucle ─────────────────────────────────────────────────
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function frame(now) {
    vs.raf = 0;
    if (!active()) return;
    const dt = Math.min(0.05, vs.last ? (now - vs.last) / 1000 : 0);
    vs.last = now;
    const a = vs.anim;
    if (a) {
      const k = clamp((now - a.t0) / a.ms, 0, 1), e = ease(k);
      vs.o = V.orient(a.from.lat + (a.to.lat - a.from.lat) * e, V.lerpLon(a.from.lon, a.to.lon, e));
      vs.z = a.from.z * Math.pow(a.to.z / a.from.z, e);
      if (k >= 1) { vs.anim = null; a.resolve(); }
    } else if (vs.vel && !vs.g) {
      // Inertie : le globe continue un peu sur sa lancée, puis s'arrête.
      vs.o = V.drag(vs.o, vs.vel[0] * dt, vs.vel[1] * dt, radius());
      const f = Math.exp(-dt * 3.2);
      vs.vel = [vs.vel[0] * f, vs.vel[1] * f];
      if (Math.hypot(vs.vel[0], vs.vel[1]) < 6) vs.vel = null;
    }
    layout();
    placeMarks();
    if (vs.z >= V.LAND_ZOOM - 0.01 && now - vs.probeAt > 160) { vs.probeAt = now; probeGround(); }
    updateBar();
    vs.raf = requestAnimationFrame(frame);
  }
  function start() { if (!vs.raf) { vs.last = 0; vs.raf = requestAnimationFrame(frame); } }

  // Tourner et zoomer en douceur vers une orientation (o : null garde le centre).
  function animateTo(o, z, ms) {
    return new Promise((resolve) => {
      if (vs.anim) vs.anim.resolve();
      vs.vel = null;
      const to = o ? V.orient(o.lat, o.lon) : vs.o;
      vs.anim = { from: { lat: vs.o.lat, lon: vs.o.lon, z: vs.z }, to: { lat: to.lat, lon: to.lon, z: V.clampZoom(z) }, t0: performance.now(), ms: ms || 420, resolve };
      start();
    });
  }
  function used() {
    if (vs.used) return;
    vs.used = true;
    $('vsHint').classList.add('gone');
  }

  // ─── Ouverture, retour ──────────────────────────────────────
  // opts.site : on revient d'une colonie, le globe se tourne vers elle.
  async function open(opts) {
    opts = opts || {};
    if (!owned()) return;
    st = load();
    vs.o = st.o; vs.z = 1;
    const back = opts.site ? st.sites.find((x) => x.id === opts.site) : null;
    // Retour d'une colonie : sa balise au centre, assez près pour la voir, sans le réticule par-dessus.
    if (back) { vs.o = V.orient(back.lat, back.lon); vs.z = 1.5; }
    vs.ptrs.clear(); vs.g = null; vs.vel = null; vs.anim = null; vs.busy = false;
    vs.ground = undefined; vs.probeKey = ''; vs.mode = ''; vs.tip = '';
    stage.register(LOOK, look());
    if (A.stopAmbient) A.stopAmbient();
    renderMarks();
    $('vsHint').textContent = FINE ? tr('Glissez pour faire tourner · molette pour zoomer') : tr('Glissez pour faire tourner · pincez pour zoomer');
    $('vsHint').classList.toggle('gone', vs.used);
    layout();
    await A.show('visite');
    stage.sky = 0;
    layout();
    start();
    if (A.store.get(V.TUTO_KEY, '') !== '1') setTimeout(tuto, 650);
  }
  async function leave() {
    if (vs.busy) return;
    SFX.tap();
    if (vs.coach && A.coachStop) A.coachStop(false);
    save();
    A.marketTab('planete');
    await A.show('market');
  }

  // Premier passage : trois bulles (tourner, s'approcher, atterrir).
  function tuto() {
    if (!active() || document.body.classList.contains('coaching')) return;
    vs.coach = true;
    A.coachStart([
      { id: 'vs-tourner', target: '#vsView', place: 'top', gesture: { drag: true }, text: tr('Glissez pour faire <b>tourner</b> votre planète dans tous les sens, jusqu’aux pôles.'), next: tr('SUIVANT') },
      { id: 'vs-zoom', target: '#vsZoom', text: FINE ? tr('La <b>molette</b>, ou + et −, vous approche de la surface. Un double clic ramène à la vue d’ensemble.') : tr('<b>Pincez</b>, ou touchez + et −, pour vous approcher de la surface. Touchez deux fois pour revenir à la vue d’ensemble.'), next: tr('SUIVANT') },
      { id: 'vs-atterrir', target: '#vsLand', text: tr('Assez près, un réticule montre le sol. Sur la terre ferme, <b>ATTERRIR ICI</b> fonde une colonie, trois au plus. Pas sur l’océan !'), next: tr('C’EST PARTI') }
    ], () => { vs.coach = false; A.store.set(V.TUTO_KEY, '1'); });
  }

  // ─── Atterrir ───────────────────────────────────────────────
  async function landHere() {
    if (vs.busy) return;
    SFX.tap();
    if (vs.z < V.LAND_ZOOM - 0.01) { used(); await animateTo(null, Math.max(V.LAND_ZOOM + 0.6, vs.z), 600); return; }
    vs.vel = null;
    const lat = vs.o.lat, lon = vs.o.lon;
    // Le réticule sur une de vos colonies : on y retourne.
    const home = V.siteAt(st, lat, lon);
    if (home) { await land(home, false, false); return; }
    const g = await groundNow();
    vs.ground = g;
    const c = V.canFound(st, lat, lon, g);
    if (!c.ok) {
      A.refuse(c.reason);
      if (c.site) { const b = $('vsMarks').querySelector(`[data-site="${c.site.id}"]`); if (b) { b.classList.remove('ping'); void b.offsetWidth; b.classList.add('ping'); } }
      return;
    }
    const slot = V.nextSlot(st);
    A.openSheet(`<h3>${tr('NOUVELLE COLONIE')}</h3><h2>${esc(slot.name)}</h2>
      <p class="sheet-text">${tr('Sol : {sol}. Un colonisateur s’y posera avec quatre colons, des réserves et des matériaux.', { sol: esc(V.GROUNDS[g].name) })}</p>
      <p class="muted">${tr('Colonie {n} sur {max} de votre planète.', { n: st.sites.length + 1, max: V.MAX_SITES })}</p>
      <div class="sheet-actions"><button class="btn primary" id="vsFound">${tr('FONDER LA COLONIE')}</button>
      <button class="btn" data-act="close">${tr('ANNULER')}</button></div>`);
    $('vsFound').addEventListener('click', async () => {
      A.closeSheet();
      if (!V.canFound(st, lat, lon, g).ok) return;
      const site = V.found(st, lat, lon, g, Date.now());
      save();
      renderMarks();
      await land(site, true, st.sites.length === 1);
    });
  }
  // Descente vers un site : le globe se tourne vers lui et s'approche, puis l'écran de la colonie.
  async function land(site, fresh, first) {
    const CU = window.OrbiteColonieUI;
    if (vs.busy || !CU) return;
    vs.busy = true;
    if (vs.coach && A.coachStop) A.coachStop(false);
    try {
      await animateTo({ lat: site.lat, lon: site.lon }, Math.max(vs.z, V.LAND_ZOOM + 0.6), 650);
      vs.o = V.orient(site.lat, site.lon);
      save();
      if (SFX.place && fresh) SFX.place();
      await CU.open(V.planetOf(worldSeed(), site), $('vsPlanet'), { from: 'visite', first: !!first });
    } finally { vs.busy = false; }
  }

  // ─── Gestes ─────────────────────────────────────────────────
  const view = $('vsView');
  const pos = (e) => {
    const r = view.getBoundingClientRect(), k = view.clientWidth / (r.width || 1);
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // Décalage d'un point de la vue depuis le centre, en rayons du globe à ×1 (y vers le haut).
  const off = (p) => [(p[0] - vs.w / 2) / (vs.D0 / 2), -(p[1] - vs.h / 2) / (vs.D0 / 2)];
  function zoomAround(p, nz) {
    nz = V.clampZoom(nz);
    const u = off(p);
    vs.o = V.zoomAt(vs.o, vs.z, nz, u[0], u[1]);
    vs.z = nz;
  }
  function begin() {
    const pts = [...vs.ptrs.values()];
    if (pts.length >= 2) vs.g = { pinch: true, d0: dist(pts[0], pts[1]) || 1, z0: vs.z, mid: mid(pts[0], pts[1]), moved: true, samples: [] };
    else if (pts.length === 1) vs.g = { pinch: false, start: pts[0], last: pts[0], moved: vs.g ? vs.g.moved : false, samples: [] };
    else vs.g = null;
  }
  view.addEventListener('pointerdown', (e) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('button') || vs.busy) return;
    try { view.setPointerCapture(e.pointerId); } catch (err) { /* pointeur déjà relâché */ }
    // Premier doigt d'un nouveau geste : on oublie ceux d'un geste interrompu (levé hors de l'écran…).
    if (e.isPrimary) vs.ptrs.clear();
    vs.ptrs.set(e.pointerId, pos(e));
    if (vs.anim) { const a = vs.anim; vs.anim = null; a.resolve(); }
    vs.vel = null;
    if (vs.ptrs.size === 1) vs.g = null;
    begin();
    start();
  });
  view.addEventListener('pointermove', (e) => {
    if (!vs.ptrs.has(e.pointerId)) return;
    vs.ptrs.set(e.pointerId, pos(e));
    const g = vs.g;
    if (!g) return;
    const pts = [...vs.ptrs.values()];
    if (g.pinch && pts.length >= 2) {
      // Pincer : le point entre les doigts reste entre les doigts ; les deux doigts ensemble font tourner.
      const m = mid(pts[0], pts[1]);
      zoomAround(g.mid, g.z0 * dist(pts[0], pts[1]) / g.d0);
      vs.o = V.drag(vs.o, m[0] - g.mid[0], m[1] - g.mid[1], radius());
      g.mid = m;
      used();
    } else if (!g.pinch && pts.length === 1) {
      const p = pts[0], dx = p[0] - g.last[0], dy = p[1] - g.last[1];
      if (!g.moved && dist(p, g.start) > 6) { g.moved = true; view.classList.add('dragging'); }
      if (g.moved) {
        vs.o = V.drag(vs.o, dx, dy, radius());
        const t = performance.now();
        g.samples.push([t, dx, dy]);
        while (g.samples.length && t - g.samples[0][0] > 90) g.samples.shift();
        used();
      }
      g.last = p;
    }
  });
  function release(e) {
    if (!vs.ptrs.has(e.pointerId)) return;
    vs.ptrs.delete(e.pointerId);
    const g = vs.g;
    // Un doigt levé pendant le pincement : l'autre continue en glissant.
    if (vs.ptrs.size) { begin(); if (vs.g) vs.g.moved = true; return; }
    view.classList.remove('dragging');
    vs.g = null;
    if (!g) return;
    if (g.moved) {
      vs.lastTap = null;
      // Lancer : la vitesse des derniers instants du glissement.
      if (!g.pinch && e.type === 'pointerup' && g.samples.length) {
        const t = performance.now(), s = g.samples;
        const span = Math.max(16, t - s[0][0] + 16);
        const vx = s.reduce((n, q) => n + q[1], 0) / span * 1000, vy = s.reduce((n, q) => n + q[2], 0) / span * 1000;
        if (t - s[s.length - 1][0] < 60 && Math.hypot(vx, vy) > 60) vs.vel = [clamp(vx, -2400, 2400), clamp(vy, -2400, 2400)];
      }
      return;
    }
    // Double toucher (ou double clic) : retour à la vue d'ensemble. L'heure de l'événement, pas celle
    // de son traitement : une image lente ne doit pas faire manquer le second toucher.
    const t = e.timeStamp || performance.now(), p = g.start;
    if (vs.lastTap && t - vs.lastTap.t < 330 && dist(p, [vs.lastTap.x, vs.lastTap.y]) < 30) {
      vs.lastTap = null;
      if (vs.z > 1.01) animateTo(null, 1, 420);
      return;
    }
    vs.lastTap = { t, x: p[0], y: p[1] };
  }
  view.addEventListener('pointerup', release);
  view.addEventListener('pointercancel', release);
  // Souris : la molette zoome autour du pointeur, sans faire défiler la page.
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (vs.busy) return;
    if (vs.anim) { const a = vs.anim; vs.anim = null; a.resolve(); }
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    zoomAround(pos(e), vs.z * Math.exp(-clamp(dy, -300, 300) * 0.0022));
    used();
    start();
  }, { passive: false });
  // Safari : pas de zoom de la page entière par-dessus.
  view.addEventListener('gesturestart', (e) => e.preventDefault());
  view.addEventListener('contextmenu', (e) => e.preventDefault());

  // Balises : toucher une colonie visible y fait atterrir.
  $('vsMarks').addEventListener('click', (e) => {
    const b = e.target.closest('[data-site]');
    if (!b || vs.busy || b.style.visibility === 'hidden') return;
    const s = st.sites.find((x) => x.id === b.dataset.site);
    if (!s) return;
    SFX.tap();
    land(s, false, false);
  });
  $('vsZoomIn').addEventListener('click', () => { if (vs.busy) return; SFX.tap(); used(); animateTo(null, vs.z * 1.6, 320); });
  $('vsZoomOut').addEventListener('click', () => { if (vs.busy) return; SFX.tap(); animateTo(null, vs.z / 1.6, 320); });
  $('vsLand').addEventListener('click', landHere);
  $('vsBack').innerHTML = icon('back');
  $('vsBack').addEventListener('click', leave);
  // Clavier (PC) : les flèches font tourner, + et − zooment.
  document.addEventListener('keydown', (e) => {
    if (!active() || vs.busy || !$('overlay').hidden || document.body.classList.contains('coaching')) return;
    const step = 0.16 / Math.sqrt(vs.z);
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      const dl = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0, dt = k === 'ArrowUp' ? step : k === 'ArrowDown' ? -step : 0;
      animateTo({ lat: vs.o.lat + dt, lon: vs.o.lon + dl }, vs.z, 180);
      used();
    } else if (k === '+' || k === '=') { e.preventDefault(); animateTo(null, vs.z * 1.4, 220); }
    else if (k === '-' || k === '_') { e.preventDefault(); animateTo(null, vs.z / 1.4, 220); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active()) save(); });

  // ─── Marché : le bouton VISITER (et la grande planète) ─────
  function fromMarket() {
    if (!owned() || vs.busy) return;
    SFX.tap();
    open();
  }
  if ($('mkVisit')) $('mkVisit').addEventListener('click', fromMarket);
  if ($('mkPlanet')) $('mkPlanet').addEventListener('click', () => { if (owned() && !$('mkVisit').hidden) fromMarket(); });

  // goto : tourner et zoomer vers un point (tests, et pour viser un site depuis le code).
  window.OrbiteVisiteUI = { open, owned, goto: (o, z, ms) => animateTo(o, z == null ? vs.z : z, ms), get state() { return { o: vs.o, z: vs.z, sites: st.sites, ground: vs.ground, busy: vs.busy }; } };
})();
