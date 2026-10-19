/* ORBITE — interface du jeu (téléphone d'abord).
 * Accueil → choix de la loi → cycles taverne / combat → classement.
 * Les règles sont dans rules.js ; ce fichier ne fait que montrer et animer. */
(function () {
  'use strict';

  const R = window.OrbiteRules;
  const SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const SAVE_KEY = 'orbite.partie.v1';
  const DUST_KEY = 'orbite.poussieres';
  const SPEED_KEY = 'orbite.vitesse';

  const ui = {
    state: null, screen: null, lawPick: null, lawOptions: [], busy: false,
    speed: 1, time: 1, skip: false, targeting: false, stamp: 1, prevHp: null
  };
  try { ui.speed = [1, 2, 4].includes(Number(localStorage.getItem(SPEED_KEY))) ? Number(localStorage.getItem(SPEED_KEY)) : 1; } catch (err) { ui.speed = 1; }

  let stage;
  try {
    stage = new window.OrbiteStage($('gl'), R.CARD);
  } catch (err) {
    console.error(err);
    $('nogl').hidden = false;
    const done = () => Promise.resolve();
    stage = { modal: false, flash() {}, reveal: done, setReveal() {}, burst() {}, ring() {}, beam: done, register() {}, colors: () => [[255, 255, 255]] };
  }

  // ─── Icônes pixel ───────────────────────────────────────────
  const ICONS = {
    heart: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    bolt: ['...XX', '..XX.', '.XXXX', '...X.', '..X..', '.X...'],
    up: ['...X...', '..XXX..', '.XXXXX.', '...X...', '...X...', '...X...'],
    roll: ['..XXX..', '.X...X.', 'X.....X', 'X...XXX', 'X....X.', '.X.....', '..XXX..'],
    snow: ['..X.X..', 'X..X..X', '.X.X.X.', '..XXX..', '.X.X.X.', 'X..X..X', '..X.X..'],
    menu: ['XXXXXXX', '.......', 'XXXXXXX', '.......', 'XXXXXXX'],
    back: ['...X...', '..X....', '.XXXXXX', '..X....', '...X...'],
    soundOn: ['...X...', '..XX.X.', 'XXXX..X', 'XXXX..X', '..XX.X.', '...X...'],
    soundOff: ['...X....', '..XX....', 'XXXX.X.X', 'XXXX..X.', '..XX.X.X', '...X....'],
    dust: ['...X...', '...X...', '..XXX..', 'XXXXXXX', '..XXX..', '...X...', '...X...'],
    wall: ['XXXXX', 'X...X', 'X...X', '.X.X.', '..X..'],
    wind: ['XX..XX..', '.XX..XX.', '..XX..XX', '.XX..XX.', 'XX..XX..'],
    drop: ['..X..', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'],
    magnet: ['X...X', 'X...X', 'X...X', 'XX.XX', '.XXX.'],
    loop: ['.XXX.', 'X...X', 'X.X.X', '...X.', 'XXX..']
  };
  function icon(name, cls) {
    const g = ICONS[name];
    const w = Math.max(...g.map((r) => r.length)), h = g.length;
    let rects = '';
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`; }));
    return `<svg class="pix ${cls || ''}" viewBox="0 0 ${w} ${h}" fill="currentColor" aria-hidden="true">${rects}</svg>`;
  }

  // ─── Outils ─────────────────────────────────────────────────
  const me = () => ui.state.players[0];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms / ui.time));
  const dur = (ms) => ms / ui.time;
  const center = (el) => { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; };
  const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (err) { /* pas de vibreur */ } };
  const famColor = (f) => R.FAMILIES[f].color;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ordinal = (n) => n + '<sup>' + (n === 1 ? 'er' : 'e') + '</sup>';

  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), ms || 1900);
  }

  function popAt(x, y, text, cls) {
    const d = document.createElement('div');
    d.className = 'pop ' + (cls || '');
    d.innerHTML = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.animationDuration = dur(900) + 'ms';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), dur(950));
  }
  function popOn(el, text, cls) {
    if (!el) return;
    const b = el.getBoundingClientRect();
    popAt(b.left + b.width / 2, b.top + b.height * 0.25, text, cls);
  }

  function banner(title, sub, cls, hold) {
    const b = $('banner');
    b.className = 'banner';
    void b.offsetWidth;
    b.innerHTML = `<h3>${title}</h3>${sub ? `<p>${sub}</p>` : ''}`;
    b.classList.add(hold ? 'hold' : 'show');
    if (cls) b.classList.add(cls);
    b.style.animationDuration = hold ? '' : dur(1500) + 'ms';
  }
  const clearBanner = () => { $('banner').className = 'banner'; };

  // ─── Sauvegarde et poussières ───────────────────────────────
  function saveGame() {
    if (!ui.state) return;
    try {
      if (ui.state.over) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(ui.state));
    } catch (err) { /* stockage indisponible */ }
  }
  function loadGame() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.v === 1 && Array.isArray(s.players) && !s.over && s.phase === 'shop') return s;
    } catch (err) { /* sauvegarde illisible */ }
    return null;
  }
  function dust() { try { return Number(localStorage.getItem(DUST_KEY)) || 0; } catch (err) { return 0; } }
  function addDust(n) { try { localStorage.setItem(DUST_KEY, String(dust() + n)); } catch (err) { /* stockage indisponible */ } }

  // ─── Éléments d'astre ───────────────────────────────────────
  function shopUnit(id) {
    const c = R.CARD[id];
    return { id, golden: false, atk: c.atk, hp: c.hp, kw: (c.kw || []).slice(), att: [] };
  }

  function makeUnit(u, where) {
    const el = document.createElement('div');
    el.className = 'unit ' + where;
    el.innerHTML = (where === 'shop' ? '<div class="tierdots"></div>' : '') +
      '<div class="orb"></div><div class="stats"><b class="atk"></b><b class="hp"></b></div><div class="fam"></div><div class="kws"></div>';
    updateUnit(el, u, where);
    return el;
  }

  function updateUnit(el, u, where) {
    const c = R.CARD[u.id];
    const orb = el.querySelector('.orb');
    orb.dataset.planet = u.id;
    orb.dataset.golden = u.golden ? '1' : '0';
    orb.dataset.shield = u.kw.includes('bouclier') ? '1' : '0';
    orb.dataset.ghost = u.kw.includes('renaissance') ? '1' : '0';
    el.classList.toggle('golden', !!u.golden);
    el.classList.toggle('wall', u.kw.includes('rempart'));
    el.querySelector('.atk').textContent = u.atk;
    el.querySelector('.hp').textContent = u.hp;
    el.style.setProperty('--fam', famColor(c.fam));
    let k = '';
    if (u.kw.includes('megarafale')) k += icon('wind') + icon('wind');
    else if (u.kw.includes('rafale')) k += icon('wind');
    if (u.kw.includes('venin')) k += `<span style="color:${famColor('envers')}">${icon('drop')}</span>`;
    if (u.kw.includes('arrimage') && (where === 'shop' || where === 'hand')) k += icon('magnet');
    el.querySelector('.kws').innerHTML = k;
    if (where === 'shop') el.querySelector('.tierdots').innerHTML = '<i></i>'.repeat(c.tier);
    el.dataset.id = u.id;
    if (u.uid) el.dataset.uid = u.uid;
    if (u.cid) el.dataset.cid = u.cid;
  }

  function setStats(el, atk, hp, flashUp) {
    if (!el) return;
    const a = el.querySelector('.atk'), h = el.querySelector('.hp');
    if (flashUp) {
      for (const [node, val] of [[a, atk], [h, hp]]) {
        if (String(val) !== node.textContent) { node.classList.remove('up'); void node.offsetWidth; node.classList.add('up'); }
      }
    }
    a.textContent = atk;
    h.textContent = hp;
  }

  function syncList(container, items, keyOf, make, update) {
    const existing = new Map([...container.children].map((el) => [el.dataset.key, el]));
    const used = new Set();
    let prev = null;
    items.forEach((it, i) => {
      const k = keyOf(it, i);
      let el = existing.get(k);
      if (!el) { el = make(it, i); el.dataset.key = k; }
      else if (update) update(el, it, i);
      used.add(k);
      const ref = prev ? prev.nextSibling : container.firstChild;
      if (el !== ref) container.insertBefore(el, ref);
      prev = el;
    });
    for (const [k, el] of existing) if (!used.has(k)) el.remove();
  }

  function rects(container) {
    const m = new Map();
    for (const el of container.children) m.set(el.dataset.key, el.getBoundingClientRect());
    return m;
  }

  function flipFrom(container, before, skip) {
    for (const el of container.children) {
      const k = el.dataset.key;
      if (skip && skip.has(k)) continue;
      const b = before.get(k);
      if (!b) continue;
      const a = el.getBoundingClientRect();
      const dx = b.left - a.left, dy = b.top - a.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: dur(300), easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }

  function flyFrom(el, from, o) {
    o = o || {};
    if (!el || !from) return Promise.resolve();
    const to = el.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const s = Math.max(0.3, Math.min(3, from.width / Math.max(1, to.width)));
    const lift = o.lift == null ? -46 : o.lift;
    return el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
      { transform: `translate(${dx * 0.42}px, ${dy * 0.42 + lift}px) scale(${((s + 1) / 2) * 1.14})`, offset: 0.55 },
      { transform: 'translate(0, 0) scale(1)' }
    ], { duration: dur(o.ms || 460), easing: 'cubic-bezier(.3,.7,.3,1)' }).finished.catch(() => {});
  }

  function tempOrb(id, rect, golden) {
    const d = document.createElement('div');
    d.className = 'orb temp-orb';
    d.dataset.planet = id;
    d.dataset.golden = golden ? '1' : '0';
    d.style.width = rect.width + 'px';
    d.style.height = rect.width + 'px';
    d.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    document.body.appendChild(d);
    return d;
  }

  function revealIn(el, delay) {
    const orb = el.querySelector('.orb') || el;
    stage.setReveal(orb, 0);
    setTimeout(() => stage.reveal(orb, 0, 1, 420), delay || 0);
  }

  const elByUid = (uid) => document.querySelector(`#board .unit[data-uid="${uid}"], #hand .unit[data-uid="${uid}"]`);

  // ─── Écrans ─────────────────────────────────────────────────
  async function show(name) {
    const cur = document.querySelector('.screen.active');
    if (cur && cur.id !== name) {
      const orbs = [...cur.querySelectorAll('[data-planet]')];
      await Promise.all(orbs.map((o) => stage.reveal(o, 1, 0, 200)));
      cur.classList.remove('active');
    }
    const next = $(name);
    next.classList.add('active');
    ui.screen = name;
    stage.starsOn = !['splash', 'title', 'wake'].includes(name);
    // Pendant la partie, le ciel s'efface derrière les planètes pour rester lisible.
    const busySky = ['laws', 'game', 'end'].includes(name);
    stage.starArea = busySky ? 3600 : 1800;
    stage.starDim = busySky ? 0.6 : 0.85;
    [...next.querySelectorAll('[data-planet]')].forEach((o, i) => revealIn(o, 60 + i * 35));
  }

  // ─── Intro : Studio EDDA → titre → réveil → menu ────────────
  const WAKE_KEY = 'orbite.reveil';
  const HZ_OWNED = 'orbite.horizons';
  const HZ_ON = 'orbite.horizon';
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (err) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (err) { /* stockage indisponible */ } }
  };

  // Police pixel 5 × 7 pour les grands titres.
  const GLYPHS = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    ' ': ['000', '000', '000', '000', '000', '000', '000']
  };

  function pixelWord(el, text, px) {
    let x = 0;
    const cells = [];
    for (const ch of text) {
      const g = GLYPHS[ch] || GLYPHS[' '];
      g.forEach((row, y) => [...row].forEach((b, i) => { if (b === '1') cells.push([x + i, y]); }));
      x += g[0].length + 1;
    }
    const w = x - 1, h = 7;
    el.className = 'pixel-word';
    el.innerHTML = `<svg width="${w * px}" height="${h * px}" viewBox="0 0 ${w} ${h}">` + cells.map(([cx, cy]) => {
      const d = Math.round(Math.random() * 700);
      const dx = ((cx - w / 2) * 0.7 + (Math.random() - 0.5) * 12).toFixed(2);
      const dy = ((cy - 3.5) * 0.9 + (Math.random() - 0.5) * 12 - 3).toFixed(2);
      return `<rect x="${cx}" y="${cy}" width="1.04" height="1.04" style="--d:${d}ms;--dx:${dx}px;--dy:${dy}px"/>`;
    }).join('') + '</svg>';
  }
  // Chaque pixel s'allume (ou s'éteint) à son propre instant.
  const pixelDelay = (r) => parseInt(r.style.getPropertyValue('--d'), 10) || 0;
  function pixelsIn(el) {
    el.classList.remove('shatter', 'go', 'shown');
    for (const r of el.querySelectorAll('rect')) {
      r.style.opacity = '0';
      setTimeout(() => { r.style.opacity = '1'; }, pixelDelay(r));
    }
  }
  function pixelsOut(el) {
    for (const r of el.querySelectorAll('rect')) setTimeout(() => { r.style.opacity = '0'; }, pixelDelay(r));
  }
  function pixelsShatter(el) {
    for (const r of el.querySelectorAll('rect')) r.style.opacity = '';
    el.classList.add('shatter');
    void el.offsetWidth;
    el.classList.add('go');
  }
  const pixelSize = (base) => Math.max(2, Math.round(base * Math.min(1.6, Math.min(window.innerWidth, 640) / 390)));

  function waitTap(ms, el) {
    return new Promise((resolve) => {
      const target = el || document;
      let t = null;
      const done = () => { clearTimeout(t); target.removeEventListener('pointerdown', done); resolve(); };
      if (ms != null) t = setTimeout(done, ms);
      target.addEventListener('pointerdown', done);
    });
  }

  async function typeLine(el, text, o) {
    o = o || {};
    el.classList.remove('fade');
    el.innerHTML = '<span></span><span class="caret">_</span>';
    const span = el.firstChild;
    for (const ch of text) {
      span.textContent += ch;
      if (ch !== ' ') SFX.type();
      await wait(ch === ',' || ch === '.' || ch === '…' ? 320 : o.speed || 60);
    }
    await wait(o.hold || 1700);
    el.classList.add('fade');
    await wait(1000);
    el.innerHTML = '';
  }

  async function splash() {
    const w = $('studioWord');
    pixelWord(w, 'STUDIO EDDA', pixelSize(4));
    await show('splash');
    await wait(350);
    pixelsIn(w);
    await waitTap(2300, $('splash'));
    pixelsOut(w);
    await wait(950);
  }

  // Astéroïde en orbite autour du titre : plus gros quand il passe devant.
  let rock = null;
  function startRock() {
    const el = $('titleRock');
    rock = { a: -1.2, leaving: 0, raf: 0 };
    let last = performance.now();
    const tick = (now) => {
      if (!rock) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rock.a += dt * (rock.leaving ? 5 : 0.85);
      const wrap = $('titleWrap').getBoundingClientRect();
      const rx = wrap.width * 0.66 + 18, ry = Math.max(52, wrap.height * 1.35);
      const depth = Math.sin(rock.a);
      const tilt = -0.12;
      const ox = Math.cos(rock.a) * rx, oy = Math.sin(rock.a) * ry;
      const x = wrap.width / 2 + ox * Math.cos(tilt) - oy * Math.sin(tilt);
      const y = wrap.height / 2 + ox * Math.sin(tilt) + oy * Math.cos(tilt);
      let s = 0.62 + 0.5 * (depth + 1) / 2;
      if (rock.leaving) s *= 1 + Math.pow((now - rock.leaving) / 900, 2) * 7;
      el.style.transform = `translate(${x - 23}px, ${y - 23}px) scale(${s.toFixed(3)})`;
      el.dataset.dim = (0.45 + 0.55 * (depth + 1) / 2).toFixed(2);
      rock.raf = requestAnimationFrame(tick);
    };
    rock.raf = requestAnimationFrame(tick);
  }
  function stopRock() { if (rock) cancelAnimationFrame(rock.raf); rock = null; }

  async function titleScreen() {
    const w = $('titleWord');
    pixelWord(w, 'ORBITE', pixelSize(8));
    stage.register('title-rock', { type: 'asteroid', seed: 7171 });
    await show('title');
    startRock();
    pixelsIn(w);
    const tapped = waitTap(null, $('title'));
    setTimeout(() => $('tapHint').classList.add('show'), 1100);
    await tapped;
    SFX.start();
    vibrate(15);
    $('tapHint').classList.remove('show');
    const [cx, cy] = center(w);
    stage.burst(cx, cy, { n: 60, colors: [[255, 255, 255], [200, 220, 255]], speed: 110, life: 1.1, spread: 40 });
    pixelsShatter(w);
    rock.leaving = performance.now();
    stage.reveal($('titleRock'), 1, 0, 1100);
    await wait(1500);
    stopRock();
  }

  async function wakeScreen() {
    await show('wake');
    await wait(1100);
    await typeLine($('wakeLine'), 'Réveillez-vous. Bonjour, créateur.', { hold: 2000, speed: 70 });
    await wait(400);
  }

  // ─── Menu : horizon, planète géante, silhouette ─────────────
  // Lumière rasante venue du haut à gauche : le dôme s'éclaire comme dans un plan d'anime.
  const HZ_LIGHT = [-0.55, 0.62, 0.55];
  const hz = (look) => Object.assign({ full: true, moons: 0, caps: false, light: HZ_LIGHT }, look);
  const HORIZONS = [
    { id: 'aube', name: 'Aube bleue', price: 0, look: hz({ type: 'ocean', seed: 5002 }) },
    { id: 'lune', name: 'Lune pâle', price: 60, look: hz({ type: 'moon', seed: 5202 }) },
    { id: 'pourpre', name: 'Géante pourpre', price: 120, look: hz({ type: 'gas', seed: 5037 }) },
    { id: 'givre', name: 'Monde de givre', price: 180, look: hz({ type: 'ice', seed: 5006 }) },
    { id: 'braise', name: 'Cœur de braise', price: 240, look: hz({ type: 'lava', seed: 5002 }) },
    { id: 'envers', name: 'L’Envers', price: 320, look: hz({ type: 'terran', seed: 5606, mood: 'envers', flip: true }) }
  ];
  HORIZONS.forEach((h) => stage.register('hz-' + h.id, h.look));
  const ownedHorizons = () => { try { return JSON.parse(store.get(HZ_OWNED, '["aube"]')); } catch (err) { return ['aube']; } };
  const currentHorizon = () => HORIZONS.find((h) => h.id === store.get(HZ_ON, 'aube')) || HORIZONS[0];
  function applyHorizon() { stage.register('horizon', currentHorizon().look); }

  function layoutMenu() {
    const W = window.innerWidth, H = window.innerHeight;
    const horizon = Math.round(H * (W > H ? 0.66 : 0.6));
    const R = Math.round(Math.min(W * 0.82, H * 0.6));
    const cy = horizon + R * 0.3;
    const pl = $('menuPlanet');
    pl.style.width = pl.style.height = 2 * R + 'px';
    pl.style.left = W / 2 - R + 'px';
    pl.style.top = cy - R + 'px';
    pl.dataset.clip = horizon + 5;
    ui.menuR = R;
    ui.horizon = horizon;
    const g = stage.genome ? stage.genome('horizon') : null;
    const rim = g ? g.body.pal[12][3] : [40, 80, 110];
    const step = 3;
    const gh = H - horizon + 8;
    let y = 4, path = `M0,${gh} V${y}`;
    let rims = '';
    const half = Math.sqrt(Math.max(0, R * R - (R * 0.3) ** 2));
    for (let x = 0; x < W + step; x += step) {
      if (Math.random() < 0.35) y = Math.max(1, Math.min(8, y + (Math.random() < 0.5 ? -1 : 1)));
      const yy = y;
      path += ` H${x} V${yy}`;
      const lit = Math.max(0, 1 - Math.abs(x - W / 2) / half);
      if (lit > 0.05) rims += `<rect x="${x}" y="${yy}" width="${step}" height="1" fill="rgb(${rim.join(',')})" opacity="${(lit * 0.9).toFixed(2)}"/>`;
    }
    path += ` H${W} V${gh} Z`;
    const ground = $('menuGround');
    // Étiré sur toute la largeur et jusqu'en bas, même si l'écran change de taille.
    ground.setAttribute('viewBox', `0 0 ${W} ${gh}`);
    ground.setAttribute('preserveAspectRatio', 'none');
    ground.style.top = horizon - 4 + 'px';
    ground.style.height = gh + 'px';
    ground.innerHTML = `<path d="${path}" fill="#020407"/>${rims}`;
    $('menuList').style.top = horizon + Math.max(18, (H - horizon) * 0.12) + 'px';
  }

  function renderMenu() {
    $('menuDust').innerHTML = icon('dust') + ' ' + dust();
    pixelWord($('menuWord'), 'ORBITE', pixelSize(4));
    $('menuWord').classList.add('shown');
  }

  let ambient = null;
  function startAmbient() {
    stopAmbient();
    let n = 0;
    ambient = setInterval(() => {
      if (ui.screen !== 'menu' || !$('overlay').hidden) return;
      const W = window.innerWidth;
      const x = W * (0.15 + Math.random() * 0.7);
      stage.burst(x, ui.horizon + 2, { n: 1, colors: [[210, 235, 255], [255, 255, 255]], speed: 4, up: 14 + Math.random() * 10, drag: 0.2, life: 2.6 + Math.random() * 2, size: 1 });
      if (++n % 34 === 0) {
        const y0 = window.innerHeight * (0.05 + Math.random() * 0.2);
        const x0 = W * (Math.random() * 0.5);
        stage.beam([x0, y0], [x0 + W * 0.45, y0 + window.innerHeight * 0.12], { ms: 750, arc: 0, tail: 14, head: 1, color: [210, 225, 255] });
      }
    }, 240);
  }
  function stopAmbient() { if (ambient) clearInterval(ambient); ambient = null; }

  async function enterMenu(first) {
    applyHorizon();
    renderMenu();
    layoutMenu();
    $('menuLine').innerHTML = '';
    document.querySelectorAll('.menu-item').forEach((b) => b.classList.remove('show'));
    $('menuWord').parentElement.classList.add('menu-fade');
    $('menuGround').style.opacity = 0;
    await show('menu');
    const pl = $('menuPlanet');
    pl.animate([{ transform: `translateY(${Math.round(ui.menuR * 0.8)}px)` }, { transform: 'translateY(0)' }], { duration: first ? 5200 : 2400, easing: 'cubic-bezier(.16,.7,.2,1)' });
    $('menuGround').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: 'forwards' });
    startAmbient();
    if (first) {
      await wait(3000);
      await typeLine($('menuLine'), 'Voilà votre terrain de jeu.', { hold: 1700, speed: 65 });
      store.set(WAKE_KEY, '1');
    } else {
      await wait(900);
    }
    $('menuWord').parentElement.classList.remove('menu-fade');
    const items = [...document.querySelectorAll('.menu-item')];
    for (const b of items) { b.classList.add('show'); await wait(120); }
  }

  async function backToMenu() {
    renderMenu();
    applyHorizon();
    layoutMenu();
    await show('menu');
    $('menuWord').parentElement.classList.remove('menu-fade');
    $('menuGround').style.opacity = 1;
    document.querySelectorAll('.menu-item').forEach((b) => b.classList.add('show'));
    startAmbient();
  }

  async function boot() {
    try {
      await splash();
      await titleScreen();
      const first = store.get(WAKE_KEY, '') !== '1';
      if (first) await wakeScreen();
      await enterMenu(first);
    } catch (err) {
      console.error(err);
      await enterMenu(false);
    }
  }

  // ─── Marché stellaire ───────────────────────────────────────
  function renderMarket() {
    const owned = ownedHorizons(), on = currentHorizon().id;
    $('marketBack').innerHTML = icon('back');
    $('marketDust').innerHTML = icon('dust') + ' ' + dust();
    $('marketGrid').innerHTML = HORIZONS.map((h) => {
      const has = owned.includes(h.id);
      const state = h.id === on ? 'ÉQUIPÉ' : has ? 'ÉQUIPER' : `${icon('dust')} ${h.price}`;
      return `<button class="market-item ${has ? 'owned' : ''} ${h.id === on ? 'on' : ''} ${!has && dust() < h.price ? 'locked' : ''}" data-hz="${h.id}">
        <div class="orb" data-planet="hz-${h.id}"></div><b>${esc(h.name)}</b><span>${state}</span></button>`;
    }).join('');
  }

  $('marketGrid').addEventListener('click', (e) => {
    const b = e.target.closest('.market-item');
    if (!b) return;
    const h = HORIZONS.find((x) => x.id === b.dataset.hz);
    const owned = ownedHorizons();
    if (!owned.includes(h.id)) {
      if (dust() < h.price) { toast(`Il vous manque ${h.price - dust()} poussières d’étoiles.`); SFX.tap(); return; }
      addDust(-h.price);
      owned.push(h.id);
      store.set(HZ_OWNED, JSON.stringify(owned));
      SFX.golden();
      const [x, y] = center(b.querySelector('.orb'));
      stage.burst(x, y, { n: 40, colors: [[246, 196, 83], [255, 255, 255]], speed: 80, life: 0.8 });
      toast(`${h.name} rejoint votre univers.`);
    } else SFX.tap();
    store.set(HZ_ON, h.id);
    applyHorizon();
    renderMarket();
    [...$('marketGrid').querySelectorAll('[data-planet]')].forEach((o) => stage.setReveal(o, 1));
  });

  // ─── Paramètres ─────────────────────────────────────────────
  function settingsHtml() {
    return `<h3>PARAMÈTRES</h3><div class="menu-list-sheet">
      <button class="btn" data-act="set" data-v="sound">SON : ${SFX.muted ? 'COUPÉ' : 'ACTIVÉ'}</button>
      <button class="btn" data-act="set" data-v="speed">VITESSE DES COMBATS : ×${ui.speed}</button>
      <button class="btn" data-act="set" data-v="help">COMMENT JOUER</button>
      <a class="btn" href="atelier.html">ATELIER DES PLANÈTES</a>
      <button class="btn" data-act="set" data-v="intro">REVOIR L’INTRODUCTION</button>
      <button class="btn ghost" data-act="set" data-v="reset">EFFACER LA PROGRESSION</button>
    </div><p class="muted">Poussières d’étoiles, horizons et partie en cours restent sur cet appareil.</p>`;
  }

  async function settingsAction(v, btn) {
    if (v === 'sound') { SFX.setMuted(!SFX.muted); if (!SFX.muted) SFX.tap(); openSheet(settingsHtml()); }
    else if (v === 'speed') {
      ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 4 : 1;
      store.set(SPEED_KEY, String(ui.speed));
      openSheet(settingsHtml());
    } else if (v === 'help') openSheet(helpHtml());
    else if (v === 'intro') {
      closeSheet();
      stopAmbient();
      store.set(WAKE_KEY, '');
      boot();
    } else if (v === 'reset') {
      if (!btn.dataset.confirm) { btn.dataset.confirm = '1'; btn.textContent = 'TOUCHER ENCORE POUR CONFIRMER'; return; }
      for (const k of [SAVE_KEY, DUST_KEY, HZ_OWNED, HZ_ON, WAKE_KEY]) store.set(k, '');
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* stockage indisponible */ }
      closeSheet();
      applyHorizon();
      renderMenu();
      toast('Progression effacée.');
    }
  }

  // ─── Choix de la loi ────────────────────────────────────────
  function randomSeed() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0].toString(16).toUpperCase().padStart(8, '0');
  }

  function renderLaws() {
    ui.seed = randomSeed();
    ui.lawOptions = R.lawChoices(ui.seed);
    ui.lawPick = null;
    $('lawGo').disabled = true;
    $('lawsBack').innerHTML = icon('back');
    $('lawList').innerHTML = ui.lawOptions.map((id) => {
      const l = R.LAW[id], st = R.CARD[l.starter], f = R.FAMILIES[l.fam];
      return `<button class="law" data-law="${id}" style="--c:${f.color}">
        <div class="orb" data-planet="${l.starter}"></div>
        <div>
          <span class="fam-chip">${f.name.toUpperCase()}</span>
          <h3>${esc(l.name)}</h3>
          <p class="tag">${esc(l.tagline)}</p>
          <p class="txt">${esc(l.text)}</p>
          <p class="starter">PREMIER ASTRE : ${esc(st.name).toUpperCase()} ${st.atk}/${st.hp}</p>
        </div>
      </button>`;
    }).join('');
  }

  $('lawList').addEventListener('click', (e) => {
    const b = e.target.closest('.law');
    if (!b) return;
    SFX.tap();
    ui.lawPick = b.dataset.law;
    for (const x of $('lawList').children) x.classList.toggle('on', x === b);
    $('lawGo').disabled = false;
    stage.flash(b.querySelector('.orb'), 0.5);
  });

  $('lawGo').addEventListener('click', async () => {
    if (!ui.lawPick) return;
    SFX.level();
    ui.state = R.newGame(ui.seed, ui.lawPick);
    ui.stamp++;
    saveGame();
    await show('game');
    renderGame(true);
    banner('CYCLE 1', 'Achetez des astres, puis lancez le combat.');
  });

  // ─── Rendu de la partie ─────────────────────────────────────
  function renderHud() {
    const p = me();
    $('hudHp').innerHTML = icon('heart') + `<b>${Math.max(0, p.hp)}</b>`;
    $('hudRound').textContent = 'CYCLE ' + ui.state.round;
    $('famsBtn').innerHTML = ui.state.families.map((f) => `<span style="--c:${famColor(f)}"></span>`).join('');
    $('menuBtn').innerHTML = icon('menu');
  }

  function renderRivals() {
    const s = ui.state;
    $('rivals').innerHTML = s.players.map((p) => {
      const lost = ui.prevHp && ui.prevHp[p.id] != null && p.hp < ui.prevHp[p.id];
      return `<span class="rival ${p.bot ? '' : 'me'} ${p.alive ? '' : 'dead'} ${lost ? 'lost' : ''}">
        <span class="orb" data-planet="${R.LAW[p.law].starter}"></span><b>${p.alive ? Math.max(0, p.hp) : p.rank + 'e'}</b></span>`;
    }).join('');
  }

  function renderTavernHead(pop) {
    const p = me();
    const pips = Array.from({ length: 6 }, (_, i) => `<i class="${i < p.tier ? 'on' : ''}"></i>`).join('');
    $('tier').innerHTML = `NIVEAU <span class="pips">${pips}</span>`;
    $('tier').classList.toggle('pop', !!pop);
    const cost = R.upgradeCost(p);
    $('upBtn').innerHTML = p.tier >= 6 ? 'MAX' : `${icon('up')} <i>${cost}</i>`;
    $('upBtn').disabled = p.tier >= 6 || p.gold < cost;
    $('rollBtn').innerHTML = `${icon('roll')} <i>1</i>`;
    $('rollBtn').disabled = p.gold < R.ROLL_COST;
    $('freezeBtn').innerHTML = icon('snow');
    $('freezeBtn').classList.toggle('on', p.frozen);
  }

  function renderShop(reveal) {
    const p = me();
    const items = p.shop.map((id, slot) => (id ? { id, slot } : null)).filter(Boolean);
    let n = 0;
    syncList($('shop'), items, (it) => 's' + ui.stamp + '-' + it.slot, (it) => {
      const el = makeUnit(shopUnit(it.id), 'shop');
      el.dataset.src = 'shop';
      el.dataset.slot = it.slot;
      if (reveal) revealIn(el, 80 + n++ * 70);
      return el;
    }, (el, it) => { el.dataset.slot = it.slot; });
    sizeRow($('shop'), 'shop', 92);
    $('shop').classList.toggle('frozen', p.frozen);
  }

  // Taille des astres selon leur nombre : peu d'astres = grandes planètes.
  const SIZE = {
    shop: [0.24, 0.24, 0.24, 0.24, 0.2, 0.17, 0.152],
    board: [0.22, 0.22, 0.22, 0.2, 0.18, 0.162, 0.14, 0.126],
    hand: [0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.12, 0.11, 0.1, 0.094, 0.088]
  };
  function sizeRow(container, kind, cap) {
    const n = container.children.length;
    const col = Math.min(window.innerWidth, 520) - 20;
    const k = SIZE[kind][Math.min(n, SIZE[kind].length - 1)];
    container.style.setProperty('--u', Math.round(Math.min(cap, col * k)) + 'px');
  }

  function arc(container) {
    const kids = [...container.children];
    const n = kids.length;
    kids.forEach((el, i) => {
      const d = i - (n - 1) / 2;
      el.style.setProperty('--arc', Math.round(d * d * 2.2) + 'px');
    });
  }

  function renderBoard() {
    const p = me();
    syncList($('board'), p.board, (u) => u.uid, (u) => {
      const el = makeUnit(u, 'board');
      el.dataset.src = 'board';
      return el;
    }, (el, u) => { updateUnit(el, u, 'board'); el.dataset.src = 'board'; });
    sizeRow($('board'), 'board', 88);
    arc($('board'));
  }

  function renderHand() {
    const p = me();
    syncList($('hand'), p.hand, (u) => u.uid, (u) => {
      const el = makeUnit(u, 'hand');
      el.dataset.src = 'hand';
      return el;
    }, (el, u) => updateUnit(el, u, 'hand'));
    sizeRow($('hand'), 'hand', 54);
  }

  function renderEnergy(spent) {
    const p = me();
    const max = Math.min(R.MAX_GOLD, ui.state.round + 2);
    const shown = Math.max(max, Math.min(p.gold, 12));
    let html = '';
    for (let i = 0; i < shown; i++) {
      const on = i < p.gold;
      const wasOn = spent && i >= p.gold && i < p.gold + spent;
      html += `<i class="${on ? 'on' : ''} ${wasOn ? 'spent' : ''}"></i>`;
    }
    $('energy').innerHTML = icon('bolt') + html + `<b>${p.gold}</b>`;
  }

  function renderPower() {
    const p = me(), law = R.LAW[p.law];
    const b = $('powerBtn');
    b.style.setProperty('--c', famColor(law.fam));
    const active = !!law.active;
    const can = active && R.canUsePower(ui.state).ok;
    b.classList.toggle('active', can);
    b.classList.toggle('armed', ui.targeting);
    const label = p.law === 'renversement' ? 'INVERSER' : p.law === 'ingenierie' ? '+ SONDE' : law.name.toUpperCase();
    const cost = active ? ` · ${law.active.cost} ${icon('bolt')}` : '';
    b.innerHTML = `<span class="fam-dot"></span><span><b>${active ? 'POUVOIR' : 'LOI'}${active && p.powerUsed ? ' · UTILISÉ' : ''}</b>${label}${cost}</span>`;
  }

  function renderFight() {
    const p = me();
    const ready = p.gold < R.BUY_COST && !p.hand.length;
    $('fightBtn').classList.toggle('ready', ready);
  }

  function renderGame(reveal) {
    if (!ui.state) return;
    renderHud();
    renderRivals();
    renderTavernHead();
    renderShop(reveal);
    renderEnergy();
    renderBoard();
    renderHand();
    renderPower();
    renderFight();
    $('speedBtn').textContent = '×' + ui.speed;
    if (reveal) {
      [...$('board').children, ...$('hand').children].forEach((el, i) => revealIn(el, 40 + i * 40));
      [...$('rivals').querySelectorAll('.orb')].forEach((o, i) => revealIn(o, i * 30));
    }
  }

  // ─── Effets de taverne (buffs, mots-clés…) ──────────────────
  async function playShopEvents(events, model) {
    const units = model || null;
    for (const e of events || []) {
      if (e.t === 'trigger') {
        const el = elByUid(e.uid);
        if (el) {
          el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 260 });
          const [x, y] = center(el.querySelector('.orb'));
          stage.burst(x, y, { n: 10, colors: [[255, 255, 255], hexRgb(famColor(R.CARD[el.dataset.id].fam))], speed: 50, life: 0.45 });
        }
        await sleep(120);
      } else if (e.t === 'buff') {
        const el = elByUid(e.uid);
        if (el) {
          const atk = Number(el.querySelector('.atk').textContent) + e.a;
          const hp = Number(el.querySelector('.hp').textContent) + e.h;
          setStats(el, Math.max(0, atk), hp, true);
          popOn(el, `+${e.a}/+${e.h}`, 'good');
          const [x, y] = center(el.querySelector('.orb'));
          stage.burst(x, y, { n: 14, colors: [[159, 240, 154], [255, 255, 255]], speed: 40, up: 30, life: 0.6 });
          SFX.buff();
        }
        if (units) { const u = units.find((v) => v.uid === e.uid); if (u) { u.atk += e.a; u.hp += e.h; } }
        await sleep(170);
      } else if (e.t === 'kw') {
        const el = elByUid(e.uid);
        if (el) {
          const orb = el.querySelector('.orb');
          if (e.k === 'bouclier') orb.dataset.shield = '1';
          if (e.k === 'renaissance') orb.dataset.ghost = '1';
          if (e.k === 'rempart') el.classList.add('wall');
          popOn(el, R.KEYWORDS[e.k].name.toUpperCase(), 'info');
          stage.flash(orb, 0.6);
        }
        await sleep(200);
      } else if (e.t === 'swap') {
        const el = elByUid(e.uid);
        if (el) {
          await el.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg) scale(1.1)' }, { transform: 'rotateY(0)' }], { duration: 420 }).finished.catch(() => {});
          const a = el.querySelector('.atk').textContent, h = el.querySelector('.hp').textContent;
          setStats(el, h, a, true);
          popOn(el, 'INVERSÉ', 'info');
        }
      } else if (e.t === 'gold') {
        popOn($('energy'), `+${e.n} ${icon('bolt')}`, 'energy');
        await sleep(200);
      } else if (e.t === 'law') {
        const b = $('powerBtn');
        b.animate([{ borderColor: 'var(--ink)' }, { borderColor: 'var(--faint)' }], { duration: 600 });
      }
    }
  }

  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ─── Actions de taverne ─────────────────────────────────────
  function copyRects(id) {
    return [...document.querySelectorAll(`#board .unit[data-id="${id}"], #hand .unit[data-id="${id}"]`)]
      .filter((el) => !el.classList.contains('golden'))
      .map((el) => el.querySelector('.orb').getBoundingClientRect());
  }

  async function doBuy(slot, fromRect, playAt) {
    const p = me();
    const id = p.shop[slot];
    const check = R.canBuy(ui.state, slot);
    if (!check.ok) { toast(check.reason); return false; }
    const before = copyRects(id);
    const res = R.buy(ui.state, slot);
    if (!res.ok) { toast(res.reason); return false; }
    SFX.buy();
    vibrate(8);
    renderEnergy(R.BUY_COST);
    renderTavernHead();
    renderShop();
    renderHand();
    renderPower();
    renderFight();
    if (res.triple) {
      renderBoard();
      const shopRect = fromRect || before[0];
      await fusion(id, before.concat([shopRect]), res.triple);
    } else {
      const el = elByUid(res.uid);
      if (el && fromRect) {
        const [x, y] = [fromRect.left + fromRect.width / 2, fromRect.top + fromRect.height / 2];
        stage.burst(x, y, { n: 12, colors: [[127, 216, 255], [255, 255, 255]], speed: 45, life: 0.5 });
        await flyFrom(el, fromRect, { ms: 420 });
      }
    }
    await playShopEvents(res.events);
    renderBoard();
    renderHand();
    saveGame();
    if (playAt != null && !res.triple && me().board.length < R.BOARD_MAX) {
      const el = elByUid(res.uid);
      await doPlay(res.uid, playAt, el ? el.getBoundingClientRect() : null);
    }
    return true;
  }

  async function fusion(id, sources, goldUid) {
    SFX.golden();
    vibrate([12, 40, 12]);
    const goldEl = elByUid(goldUid);
    const goldOrb = goldEl ? goldEl.querySelector('.orb') : null;
    if (goldOrb) stage.setReveal(goldOrb, 0);
    const cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
    const size = Math.min(window.innerWidth * 0.34, 150);
    const temps = sources.filter(Boolean).slice(0, 3).map((r) => tempOrb(id, r, false));
    await Promise.all(temps.map((t, i) => {
      const r = sources[i];
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      const ox = cx + Math.cos(a) * size * 0.55 - r.width / 2, oy = cy + Math.sin(a) * size * 0.55 - r.width / 2;
      const a2 = a + 2.2;
      const ox2 = cx + Math.cos(a2) * size * 0.2 - r.width / 2, oy2 = cy + Math.sin(a2) * size * 0.2 - r.width / 2;
      return t.animate([
        { transform: `translate(${r.left}px, ${r.top}px) scale(1)` },
        { transform: `translate(${ox}px, ${oy}px) scale(1.25)`, offset: 0.45 },
        { transform: `translate(${ox2}px, ${oy2}px) scale(0.7)`, offset: 0.85 },
        { transform: `translate(${cx - r.width / 2}px, ${cy - r.width / 2}px) scale(0.2)` }
      ], { duration: 950, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'forwards' }).finished.catch(() => {});
    }));
    temps.forEach((t) => t.remove());
    const gold = [[246, 196, 83], [255, 236, 170], [255, 255, 255], [214, 150, 60]];
    stage.burst(cx, cy, { n: 70, colors: gold, speed: 120, life: 0.9, size: 2 });
    stage.ring(cx, cy, 10, { n: 48, colors: gold, speed: 90, life: 0.7 });
    const big = tempOrb(id, { left: cx - size / 2, top: cy - size / 2, width: size }, true);
    stage.setReveal(big, 0);
    stage.flash(big, 1);
    stage.reveal(big, 0, 1, 380);
    popAt(cx, cy - size * 0.62, 'ASTRE DORÉ', 'gold');
    await sleep(900);
    if (goldEl) {
      const to = goldEl.querySelector('.orb').getBoundingClientRect();
      await big.animate([
        { transform: `translate(${cx - size / 2}px, ${cy - size / 2}px) scale(1)` },
        { transform: `translate(${to.left + to.width / 2 - size / 2}px, ${to.top + to.height / 2 - size / 2}px) scale(${to.width / size})` }
      ], { duration: 520, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' }).finished.catch(() => {});
      stage.setReveal(goldOrb, 1);
      stage.flash(goldOrb, 0.8);
      const [x, y] = center(goldOrb);
      stage.burst(x, y, { n: 16, colors: gold, speed: 40, life: 0.5 });
    }
    big.remove();
  }

  async function doPlay(uid, index, fromRect, targetUid) {
    const res = R.play(ui.state, uid, index, targetUid);
    if (!res.ok) { toast(res.reason); renderHand(); return false; }
    SFX.place();
    vibrate(12);
    const before = rects($('board'));
    renderHand();
    renderBoard();
    const landed = res.magnet ? elByUid(res.magnet) : elByUid(uid);
    if (!res.magnet) flipFrom($('board'), before, new Set([uid]));
    if (landed && fromRect && !res.magnet) await flyFrom(landed, fromRect, { ms: 420, lift: -30 });
    if (landed) {
      const orb = landed.querySelector('.orb');
      const [x, y] = center(orb);
      const b = orb.getBoundingClientRect();
      stage.flash(orb, res.magnet ? 0.9 : 0.55);
      stage.ring(x, y, b.width * 0.42, { n: 40, colors: [hexRgb(famColor(R.CARD[landed.dataset.id].fam)), [255, 255, 255]], speed: 55, life: 0.55, flat: 0.45 });
      if (res.magnet) { popOn(landed, 'ARRIMAGE', 'info'); setStats(landed, me().board.find((u) => u.uid === res.magnet).atk, me().board.find((u) => u.uid === res.magnet).hp, true); }
    }
    await playShopEvents(res.events);
    renderBoard();
    renderHand();
    renderEnergy();
    renderTavernHead();
    renderPower();
    renderFight();
    saveGame();
    if (res.discover) await openDiscover();
    return true;
  }

  async function doSell(uid, fromRect) {
    const el = elByUid(uid);
    const rect = fromRect || (el && el.querySelector('.orb').getBoundingClientRect());
    const id = el ? el.dataset.id : null;
    const golden = el ? el.classList.contains('golden') : false;
    const res = R.sell(ui.state, uid);
    if (!res.ok) { toast(res.reason); return false; }
    SFX.sell();
    vibrate(6);
    const before = rects($('board'));
    renderBoard();
    flipFrom($('board'), before);
    renderEnergy();
    renderTavernHead();
    renderPower();
    renderFight();
    if (rect && id) {
      const t = tempOrb(id, rect, golden);
      const shop = $('shop').getBoundingClientRect();
      const tx = shop.left + shop.width / 2 - rect.width / 2, ty = shop.top + shop.height / 2 - rect.width / 2;
      stage.reveal(t, 1, 0, 420);
      popAt(rect.left + rect.width / 2, rect.top, `+1 ${icon('bolt')}`, 'energy');
      await t.animate([
        { transform: `translate(${rect.left}px, ${rect.top}px) scale(1)` },
        { transform: `translate(${tx}px, ${ty}px) scale(0.5)` }
      ], { duration: 420, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' }).finished.catch(() => {});
      t.remove();
    }
    saveGame();
    return true;
  }

  async function doRoll() {
    const res = R.roll(ui.state);
    if (!res.ok) { toast(res.reason); return; }
    SFX.roll();
    const old = [...$('shop').children].map((el) => ({ id: el.dataset.id, r: el.querySelector('.orb').getBoundingClientRect() }));
    const temps = old.map((o) => tempOrb(o.id, o.r, false));
    temps.forEach((t) => stage.reveal(t, 1, 0, 260));
    setTimeout(() => temps.forEach((t) => t.remove()), 300);
    ui.stamp++;
    renderEnergy(1);
    renderTavernHead();
    renderShop(true);
    renderPower();
    renderFight();
    saveGame();
  }

  async function doUpgrade() {
    const res = R.upgrade(ui.state);
    if (!res.ok) { toast(res.reason); return; }
    SFX.level();
    vibrate([8, 30, 8]);
    renderEnergy(1);
    renderTavernHead(true);
    const [x, y] = center($('tier'));
    stage.burst(x, y, { n: 30, colors: [[255, 255, 255], [246, 196, 83]], speed: 70, life: 0.7 });
    popOn($('tier'), 'NIVEAU ' + res.tier, 'gold');
    renderPower();
    renderFight();
    saveGame();
  }

  function doFreeze() {
    const res = R.freeze(ui.state);
    if (!res.ok) return;
    if (res.frozen) {
      SFX.freeze();
      const b = $('shop').getBoundingClientRect();
      for (let i = 0; i < 4; i++) stage.burst(b.left + (b.width * (i + 0.5)) / 4, b.top + b.height * 0.4, { n: 8, colors: [[190, 235, 255], [255, 255, 255]], speed: 30, gravity: 20, life: 0.8 });
    }
    renderShop();
    renderTavernHead();
    saveGame();
  }

  async function doPower(targetUid) {
    const res = R.usePower(ui.state, targetUid);
    ui.targeting = false;
    document.querySelectorAll('#board .unit.target').forEach((el) => el.classList.remove('target'));
    if (!res.ok) { toast(res.reason); renderPower(); return; }
    SFX.level();
    renderEnergy(R.LAW[me().law].active.cost);
    renderHand();
    if (me().law === 'ingenierie') {
      const el = document.querySelector('#hand .unit:last-child');
      if (el) await flyFrom(el, $('powerBtn').getBoundingClientRect(), { ms: 420 });
    }
    await playShopEvents(res.events);
    renderBoard();
    renderHand();
    renderPower();
    renderTavernHead();
    renderFight();
    saveGame();
  }

  // ─── Glisser-déposer tactile ────────────────────────────────
  let drag = null;

  function zoneAt(x, y) {
    const inside = (el, pad) => {
      const b = el.getBoundingClientRect();
      return x >= b.left - (pad || 0) && x <= b.right + (pad || 0) && y >= b.top && y <= b.bottom;
    };
    if (inside($('tavern'), 8)) return 'tavern';
    if (inside($('handZone'), 8)) return 'hand';
    if (inside($('systemZone'), 8)) return 'board';
    return null;
  }

  function boardIndexAt(x, skip) {
    let i = 0;
    for (const el of $('board').children) {
      if (el.dataset.key === skip) continue;
      const b = el.getBoundingClientRect();
      if (x > b.left + b.width / 2) i++;
    }
    return i;
  }

  function magnetTargetAt(x, y, unit) {
    if (!unit || !unit.kw.includes('arrimage')) return null;
    for (const el of $('board').children) {
      const u = me().board.find((v) => v.uid === el.dataset.uid);
      if (!u || !R.canMagnet(unit, u)) continue;
      const b = el.getBoundingClientRect();
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return el;
    }
    return null;
  }

  function previewBoard(index, skip) {
    const kids = [...$('board').children].filter((el) => el.dataset.key !== skip);
    const room = me().board.length < R.BOARD_MAX || drag.src === 'board';
    $('board').classList.add('previewing');
    kids.forEach((el, i) => {
      const w = el.getBoundingClientRect().width;
      el.style.setProperty('--sx', index == null || !room ? '0px' : (i < index ? -w * 0.32 : w * 0.32) + 'px');
    });
  }
  function clearPreview() {
    for (const el of $('board').children) el.style.removeProperty('--sx');
    $('board').classList.remove('previewing');
    document.querySelectorAll('.unit.magnet').forEach((el) => el.classList.remove('magnet'));
    $('systemZone').classList.remove('drop');
    $('tavern').classList.remove('drop');
    $('handZone').classList.remove('drop');
  }

  document.addEventListener('pointerdown', (e) => {
    if (ui.screen !== 'game' || ui.busy || drag || document.body.classList.contains('in-combat')) return;
    if (!$('overlay').hidden) return;
    const el = e.target.closest('.unit[data-src]');
    if (ui.targeting) {
      if (el && el.dataset.src === 'board') doPower(el.dataset.uid);
      else { ui.targeting = false; document.querySelectorAll('#board .unit.target').forEach((u) => u.classList.remove('target')); renderPower(); }
      return;
    }
    if (!el) return;
    drag = { el, src: el.dataset.src, key: el.dataset.key, x0: e.clientX, y0: e.clientY, moved: false, id: e.pointerId };
  });

  document.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 9) return;
      drag.moved = true;
      const b = drag.el.getBoundingClientRect();
      drag.w = b.width;
      drag.h = b.height;
      drag.from = drag.el.querySelector('.orb').getBoundingClientRect();
      const g = drag.el.cloneNode(true);
      g.classList.add('ghost');
      g.classList.remove('lifted');
      g.style.width = b.width + 'px';
      g.style.setProperty('--u', b.width + 'px');
      document.body.appendChild(g);
      drag.ghost = g;
      drag.el.classList.add('lifted');
      drag.el.querySelector('.orb').dataset.hide = '1';
      drag.unit = drag.src === 'hand' ? me().hand.find((u) => u.uid === drag.key) : null;
      SFX.tap();
    }
    const scale = drag.src === 'hand' ? 1.35 : 1.12;
    drag.ghost.style.transform = `translate(${e.clientX - drag.w / 2}px, ${e.clientY - drag.h * 0.42}px) scale(${scale})`;
    const zone = zoneAt(e.clientX, e.clientY);
    clearPreview();
    drag.zone = zone;
    drag.magnet = null;
    if (zone === 'board') {
      const m = drag.src === 'hand' ? magnetTargetAt(e.clientX, e.clientY, drag.unit) : null;
      if (m) { m.classList.add('magnet'); drag.magnet = m.dataset.uid; }
      else {
        drag.index = boardIndexAt(e.clientX, drag.src === 'board' ? drag.key : null);
        previewBoard(drag.index, drag.src === 'board' ? drag.key : null);
        $('systemZone').classList.add('drop');
      }
    } else if (zone === 'tavern' && drag.src === 'board') {
      $('tavern').classList.add('drop');
    } else if (zone === 'hand' && drag.src === 'shop') {
      $('handZone').classList.add('drop');
    }
  });

  async function endDrag(e, cancelled) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag;
    drag = null;
    clearPreview();
    if (!d.moved) {
      if (!cancelled) openDetail(d.src, d.el);
      return;
    }
    const ghostRect = d.ghost.querySelector('.orb').getBoundingClientRect();
    const finish = () => { d.ghost.remove(); d.el.classList.remove('lifted'); delete d.el.querySelector('.orb').dataset.hide; };
    let acted = false;
    ui.busy = true;
    try {
      if (!cancelled) {
        if (d.src === 'shop' && (d.zone === 'hand' || d.zone === 'board')) {
          finish();
          acted = await doBuy(Number(d.el.dataset.slot), ghostRect, d.zone === 'board' ? d.index : null);
        } else if (d.src === 'hand' && d.zone === 'board') {
          finish();
          acted = await doPlay(d.key, d.index, ghostRect, d.magnet);
        } else if (d.src === 'board' && d.zone === 'tavern') {
          finish();
          acted = await doSell(d.key, ghostRect);
        } else if (d.src === 'board' && d.zone === 'board') {
          const before = rects($('board'));
          R.reorder(ui.state, d.key, d.index);
          finish();
          renderBoard();
          flipFrom($('board'), before, new Set([d.key]));
          const el = elByUid(d.key);
          if (el) await flyFrom(el, ghostRect, { ms: 260, lift: 0 });
          SFX.place();
          saveGame();
          acted = true;
        }
      }
      if (!acted && d.ghost.isConnected) {
        const back = d.from;
        await d.ghost.animate([
          { transform: d.ghost.style.transform },
          { transform: `translate(${back.left - (d.w - back.width) / 2}px, ${back.top - 2}px) scale(1)` }
        ], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => {});
        finish();
      }
    } finally {
      ui.busy = false;
    }
  }

  document.addEventListener('pointerup', (e) => endDrag(e, false));
  document.addEventListener('pointercancel', (e) => endDrag(e, true));

  // ─── Feuilles ───────────────────────────────────────────────
  function openSheet(html, o) {
    o = o || {};
    const ov = $('overlay');
    $('sheet').innerHTML = html;
    ov.classList.toggle('center', !!o.center);
    ov.hidden = false;
    document.body.classList.add('modal');
    stage.modal = true;
    stage.modalEl = $('sheet');
    ui.sheetClose = o.onClose || null;
    ui.sheetLocked = !!o.locked;
    [...$('sheet').querySelectorAll('[data-planet]')].forEach((orb, i) => revealIn(orb, i * 60));
  }
  function closeSheet() {
    $('overlay').hidden = true;
    document.body.classList.remove('modal');
    stage.modal = false;
    const cb = ui.sheetClose;
    ui.sheetClose = null;
    if (cb) cb();
  }
  $('overlay').addEventListener('click', (e) => {
    if (e.target === $('overlay') && !ui.sheetLocked) { SFX.tap(); closeSheet(); }
  });

  function kwList(kw) {
    return kw.filter((k) => R.KEYWORDS[k]).map((k) => `<div><b>${R.KEYWORDS[k].name.toUpperCase()}</b>${esc(R.KEYWORDS[k].text)}</div>`).join('');
  }

  function openDetail(src, el) {
    const p = me();
    let u, actions = '';
    if (src === 'shop') {
      const slot = Number(el.dataset.slot);
      u = shopUnit(p.shop[slot]);
      const can = R.canBuy(ui.state, slot);
      actions = `<button class="btn primary" data-act="buy" data-slot="${slot}" ${can.ok ? '' : 'disabled'}>ACHETER · 3 ${icon('bolt')}</button>`;
      if (!can.ok) actions += `<p class="muted">${esc(can.reason)}</p>`;
    } else if (src === 'hand') {
      u = p.hand.find((v) => v.uid === el.dataset.uid);
      const full = p.board.length >= R.BOARD_MAX;
      actions = `<button class="btn primary" data-act="play" data-uid="${u.uid}" ${full ? 'disabled' : ''}>PLACER DANS LE SYSTÈME</button>`;
      for (const h of p.board.filter((v) => R.canMagnet(u, v))) actions += `<button class="btn" data-act="magnet" data-uid="${u.uid}" data-target="${h.uid}">ARRIMER À ${esc(R.CARD[h.id].name).toUpperCase()}</button>`;
      if (full) actions += '<p class="muted">Votre système est plein : vendez un astre.</p>';
    } else {
      u = p.board.find((v) => v.uid === el.dataset.uid);
      const i = p.board.indexOf(u);
      actions = `<button class="btn" data-act="left" data-uid="${u.uid}" ${i === 0 ? 'disabled' : ''}>${icon('back')}</button>
        <button class="btn primary" data-act="sell" data-uid="${u.uid}">VENDRE · +1 ${icon('bolt')}</button>
        <button class="btn" data-act="right" data-uid="${u.uid}" ${i === p.board.length - 1 ? 'disabled' : ''}><span style="display:inline-block;transform:scaleX(-1)">${icon('back')}</span></button>`;
    }
    if (!u) return;
    SFX.tap();
    openSheet(unitSheet(u) + `<div class="sheet-actions">${actions}</div>`);
  }

  function unitSheet(u) {
    const c = R.CARD[u.id], f = R.FAMILIES[c.fam];
    const att = (u.att || []).length ? `<p class="muted">Arrimés : ${u.att.map((a) => esc(R.CARD[a.id].name)).join(', ')}</p>` : '';
    return `<div class="sheet-top">
        <div class="orb sheet-orb" data-planet="${u.id}" data-golden="${u.golden ? 1 : 0}" data-shield="${u.kw.includes('bouclier') ? 1 : 0}" data-ghost="${u.kw.includes('renaissance') ? 1 : 0}"></div>
        <div>
          <span class="fam-chip" style="--c:${f.color}">${f.name.toUpperCase()} · NIVEAU ${c.tier}${u.golden ? ' · DORÉ' : ''}</span>
          <h2>${esc(c.name)}</h2>
          <div class="sheet-stats"><span class="atk">${u.atk}</span><span class="hp">${u.hp}</span></div>
        </div>
      </div>
      <p class="sheet-text">${esc(R.cardText(u.id, u.golden))}</p>
      <div class="kw-list">${kwList(u.kw)}</div>${att}`;
  }

  $('sheet').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (ui.busy && act !== 'choose' && act !== 'close' && act !== 'rival') return;
    if (act === 'buy') {
      const slot = Number(b.dataset.slot);
      const el = [...$('shop').children].find((x) => Number(x.dataset.slot) === slot);
      const r = el ? el.querySelector('.orb').getBoundingClientRect() : null;
      closeSheet();
      ui.busy = true;
      await doBuy(slot, r).finally(() => { ui.busy = false; });
    } else if (act === 'play' || act === 'magnet') {
      const el = elByUid(b.dataset.uid);
      const r = el ? el.querySelector('.orb').getBoundingClientRect() : null;
      closeSheet();
      ui.busy = true;
      await doPlay(b.dataset.uid, me().board.length, r, act === 'magnet' ? b.dataset.target : null).finally(() => { ui.busy = false; });
    } else if (act === 'sell') {
      closeSheet();
      ui.busy = true;
      await doSell(b.dataset.uid).finally(() => { ui.busy = false; });
    } else if (act === 'left' || act === 'right') {
      const p = me(), i = p.board.findIndex((u) => u.uid === b.dataset.uid);
      const before = rects($('board'));
      R.reorder(ui.state, b.dataset.uid, i + (act === 'left' ? -1 : 1));
      renderBoard();
      flipFrom($('board'), before);
      SFX.tap();
      saveGame();
      closeSheet();
    } else if (act === 'choose') {
      await chooseDiscover(Number(b.dataset.i), b);
    } else if (act === 'close') {
      closeSheet();
    } else if (act === 'menu') {
      menuAction(b.dataset.v);
    } else if (act === 'set') {
      const v = b.dataset.v;
      if (v === 'resume') { closeSheet(); await resumeGame(); }
      else if (v === 'new') { closeSheet(); await newGameFlow(); }
      else await settingsAction(v, b);
    } else if (act === 'rival') {
      const row = b.nextElementSibling;
      if (row && row.classList.contains('rival-board')) row.hidden = !row.hidden;
    }
  });

  // ─── Découverte (astre doré placé) ──────────────────────────
  function openDiscover() {
    const p = me();
    if (!p.discover.length) return Promise.resolve();
    return new Promise((resolve) => {
      ui.discoverDone = resolve;
      const items = p.discover.map((id, i) => {
        const c = R.CARD[id];
        return `<button class="discover-item" data-act="choose" data-i="${i}">
          <div class="orb" data-planet="${id}"></div>
          <b>${esc(c.name)}</b>
          <span class="s"><span class="atk">${c.atk}</span> · <span class="hp">${c.hp}</span></span>
          <small>${esc(R.cardText(id, false))}</small>
        </button>`;
      }).join('');
      openSheet(`<h3>DÉCOUVERTE · NIVEAU ${R.CARD[p.discover[0]].tier}</h3><h2>Choisissez un astre</h2><div class="discover-list">${items}</div>`, { center: true, locked: true });
    });
  }

  async function chooseDiscover(i, btn) {
    const r = btn.querySelector('.orb').getBoundingClientRect();
    const id = me().discover[i];
    const prior = copyRects(id);
    const res = R.choose(ui.state, i);
    closeSheet();
    if (!res.ok) { toast(res.reason); return; }
    SFX.buy();
    renderHand();
    renderBoard();
    if (res.lost) toast('Plus de place : l’astre retourne à la réserve.');
    else if (res.triple) await fusion(id, prior.concat([r]), res.triple);
    else {
      const el = elByUid(res.uid);
      if (el) await flyFrom(el, r, { ms: 520 });
    }
    renderHand();
    renderBoard();
    saveGame();
    if (ui.discoverDone) { const d = ui.discoverDone; ui.discoverDone = null; d(); }
  }

  // ─── Rivaux, familles, menu, aide ───────────────────────────
  function openRivals() {
    const s = ui.state;
    const list = s.players.slice().sort((a, b) => (b.alive - a.alive) || (a.alive ? b.hp - a.hp : a.rank - b.rank));
    const rows = list.map((p, i) => {
      const law = R.LAW[p.law];
      const board = p.board.map((u) => `<div class="unit"><div class="orb" data-planet="${u.id}" data-golden="${u.golden ? 1 : 0}"></div><div class="stats"><b class="atk">${u.atk}</b><b class="hp">${u.hp}</b></div></div>`).join('');
      return `<button class="rival-row ${p.alive ? '' : 'dead'}" data-act="rival">
          <span class="rk">${p.alive ? i + 1 : p.rank}</span>
          <span class="orb" data-planet="${law.starter}"></span>
          <span><span class="n">${esc(p.name)}</span><br><span class="l" style="color:${famColor(law.fam)}">${esc(law.name)} · niveau ${p.tier}</span></span>
          <span class="h">${p.alive ? Math.max(0, p.hp) : 'éliminé'}</span>
        </button>
        <div class="row rival-board" hidden>${board || '<span class="muted">Système vide</span>'}</div>`;
    }).join('');
    openSheet(`<h3>UNIVERS EN LICE · ${R.alivePlayers(s).length}</h3><div class="rival-list">${rows}</div>
      <p class="muted">Touchez un univers pour voir son dernier système. Les dégâts sont plafonnés à ${R.DAMAGE_CAP} tant que plus de trois univers sont en vie.</p>`);
  }

  function openFamilies() {
    const p = me();
    const items = ui.state.families.concat(['neutre']).map((f) => {
      const n = p.board.filter((u) => R.famOf(u) === f).length;
      return `<div class="fam-item" style="--c:${famColor(f)}"><b>${R.FAMILIES[f].name.toUpperCase()}</b> <small>· ${n} dans votre système</small><p>${esc(R.FAMILIES[f].text)}</p></div>`;
    }).join('');
    const law = R.LAW[p.law];
    openSheet(`<h3>FAMILLES DE CET UNIVERS</h3><div class="fam-list">${items}</div>
      <h3 style="margin-top:18px">VOTRE LOI</h3><div class="fam-item" style="--c:${famColor(law.fam)}"><b>${esc(law.name).toUpperCase()}</b><p>${esc(law.text)}</p></div>`);
  }

  function openMenu() {
    openSheet(`<h3>MENU</h3><div class="menu-list-sheet">
      <button class="btn" data-act="menu" data-v="sound">${SFX.muted ? 'ACTIVER LE SON' : 'COUPER LE SON'}</button>
      <button class="btn" data-act="menu" data-v="help">COMMENT JOUER</button>
      <button class="btn" data-act="menu" data-v="home">MENU PRINCIPAL (PARTIE SAUVEGARDÉE)</button>
      <button class="btn ghost" data-act="menu" data-v="quit">ABANDONNER LA PARTIE</button>
    </div>`);
  }

  function helpHtml() {
    return `<h3>COMMENT JOUER</h3><ul class="help">
      <li>Vous affrontez <b>sept univers</b>. Chaque cycle : vous achetez, puis votre système combat seul un rival.</li>
      <li><b>Acheter</b> coûte 3 énergies (glissez un astre vers votre main ou directement dans le système). <b>Vendre</b> rend 1 énergie (glissez un astre du système vers la taverne). <b>Actualiser</b> coûte 1.</li>
      <li><b>Geler</b> garde la vitrine pour le cycle suivant. <b>Monter de niveau</b> débloque des astres plus puissants ; le prix baisse à chaque cycle.</li>
      <li>Votre système compte <b>7 orbites</b>, votre main 10 astres. Les astres attaquent de gauche à droite : l’ordre compte.</li>
      <li><b>Trois copies</b> d’un même astre fusionnent en un <b>astre doré</b> (stats doublées). Le placer offre une <b>découverte</b> du niveau supérieur.</li>
      <li>Chaque partie active <b>5 familles</b> sur 8, plus les neutres. La réserve est <b>partagée</b> : si des rivaux jouent une famille, ses astres se font rares.</li>
      <li>Le perdant subit : niveau du gagnant + niveaux de ses astres survivants. <b>Maximum ${R.DAMAGE_CAP} dégâts</b> tant que plus de trois univers sont en vie.</li>
      <li>Seuls les <b>trois premiers</b> gagnent des poussières d’étoiles : ${R.REWARDS[1]}, ${R.REWARDS[2]} et ${R.REWARDS[3]}.</li>
    </ul><div class="sheet-actions"><button class="btn primary" data-act="close">COMPRIS</button></div>`;
  }

  async function menuAction(v) {
    if (v === 'sound') { SFX.setMuted(!SFX.muted); closeSheet(); toast(SFX.muted ? 'Son coupé' : 'Son activé'); }
    else if (v === 'help') openSheet(helpHtml());
    else if (v === 'home') { closeSheet(); saveGame(); await backToMenu(); }
    else if (v === 'quit') {
      closeSheet();
      const s = ui.state;
      const p = me();
      p.alive = false;
      p.rank = R.alivePlayers(s).length + 1;
      s.over = true;
      s.phase = 'over';
      s.rank = p.rank;
      s.reward = 0;
      s.rewarded = true;
      saveGame();
      await endScreen();
    }
  }

  // ─── Combat ─────────────────────────────────────────────────
  async function fight() {
    if (ui.busy || !ui.state || ui.state.phase !== 'shop') return;
    const p = me();
    if (p.discover.length) { await openDiscover(); return; }
    ui.busy = true;
    SFX.tap();
    ui.prevHp = Object.fromEntries(ui.state.players.map((x) => [x.id, x.hp]));
    const res = R.endTurn(ui.state);
    if (!res.ok) { toast(res.reason); ui.busy = false; return; }
    try {
      await playShopEvents(res.endEvents);
      await sleep(250);
      if (res.battle) await playBattle(res.battle);
      await afterBattle(res);
    } catch (err) {
      console.error(err);
    } finally {
      ui.time = 1;
      ui.busy = false;
    }
  }

  function combatRowEl(side) { return side === 0 ? $('board') : $('enemy'); }

  function buildCombatRows(boards) {
    const make = (u) => { const el = makeUnit(u, 'combat'); return el; };
    syncList($('board'), boards[0], (u) => u.cid, make, (el, u) => updateUnit(el, u, 'combat'));
    syncList($('enemy'), boards[1], (u) => u.cid, make, (el, u) => updateUnit(el, u, 'combat'));
    sizeRow($('board'), 'board', 92);
    sizeRow($('enemy'), 'board', 92);
    arc($('board'));
    arc($('enemy'));
    for (const el of $('enemy').children) el.style.setProperty('--arc', (-parseFloat(el.style.getPropertyValue('--arc')) || 0) + 'px');
  }

  const unitByCid = (cid) => document.querySelector(`#board .unit[data-cid="${cid}"], #enemy .unit[data-cid="${cid}"]`);

  async function playBattle(b) {
    ui.time = ui.speed;
    ui.skip = false;
    const opp = b.opponent;
    ui.opp = opp;
    $('oppName').textContent = opp.name + (opp.ghost ? ' · FANTÔME' : '');
    $('oppHp').innerHTML = opp.ghost ? '' : icon('heart') + ' ' + Math.max(0, b.before.opp);
    document.body.classList.add('in-combat');
    const evs = b.events;
    buildCombatRows(evs[0].boards);
    [...$('enemy').children].forEach((el, i) => revealIn(el, 60 + i * 70));
    $('enemy').animate([{ transform: 'translateY(-30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 400, easing: 'ease-out' });
    await sleep(700);
    let i = 1;
    while (i < evs.length && !ui.skip) {
      const e = evs[i];
      if (e.t === 'attack') {
        const group = [];
        let j = i + 1;
        while (j < evs.length && (evs[j].t === 'venom' || ((evs[j].t === 'hit' || evs[j].t === 'break') && evs[j].kind === 'attack'))) group.push(evs[j++]);
        await animateAttack(e, group);
        i = j;
        continue;
      }
      await combatEvent(e);
      i++;
    }
    if (ui.skip) {
      const last = evs.slice().reverse().find((e) => e.t === 'sync');
      if (last) buildCombatRows(last.boards);
    }
    ui.time = 1;
    const won = b.winner === 0, lost = b.winner === 1;
    if (won) {
      SFX.win();
      banner('VICTOIRE', b.damage ? `${b.damage} dégâts infligés à ${esc(opp.name)}` : 'Le rival est un fantôme', 'win');
      for (const el of $('board').children) stage.flash(el.querySelector('.orb'), 0.4);
    } else if (lost) {
      SFX.lose();
      banner('DÉFAITE', `−${b.damage} ${icon('heart')}`, 'lose');
    } else {
      banner('ÉGALITÉ', 'Aucun dégât');
    }
    await sleep(900);
    if (lost && b.damage) {
      const [x, y] = center($('banner').querySelector('p') || $('banner'));
      const target = $('hudHp');
      const d = document.createElement('div');
      d.className = 'pop bad';
      d.innerHTML = `−${b.damage}`;
      d.style.cssText = `left:${x}px;top:${y}px;animation:none;opacity:1`;
      document.body.appendChild(d);
      const [tx, ty] = center(target);
      await d.animate([{ left: x + 'px', top: y + 'px' }, { left: tx + 'px', top: ty + 'px', transform: 'translate(-50%,-50%) scale(.6)' }], { duration: 520, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' }).finished.catch(() => {});
      d.remove();
      renderHud();
      target.classList.remove('hurt');
      void target.offsetWidth;
      target.classList.add('hurt');
      const v = document.createElement('div');
      v.className = 'vignette';
      document.body.appendChild(v);
      setTimeout(() => v.remove(), 950);
      vibrate([30, 40, 30]);
      SFX.hit();
    }
    await sleep(900);
  }

  async function animateAttack(e, group) {
    const a = unitByCid(e.cid), t = unitByCid(e.target);
    if (!a || !t) { for (const h of group) await combatEvent(h); return; }
    const [ax, ay] = center(a), [tx, ty] = center(t);
    const dx = (tx - ax) * 0.8, dy = (ty - ay) * 0.8;
    a.style.zIndex = 5;
    const fwd = a.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${-dx * 0.07}px, ${-dy * 0.07}px) scale(1.06)`, offset: 0.35 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.1)` }
    ], { duration: dur(360), easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'forwards' });
    await fwd.finished.catch(() => {});
    SFX.hit();
    vibrate(6);
    const tOrb = t.querySelector('.orb');
    stage.flash(tOrb, 0.9);
    stage.flash(a.querySelector('.orb'), 0.4);
    stage.burst(ax + dx, ay + dy, { n: 14, colors: [[255, 255, 255], [255, 220, 150]], speed: 70, life: 0.35 });
    t.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: dur(220) });
    for (const h of group) await combatEvent(h, true);
    const back = a.animate([{ transform: `translate(${dx}px, ${dy}px) scale(1.1)` }, { transform: 'translate(0, 0) scale(1)' }], { duration: dur(300), easing: 'cubic-bezier(.2,.8,.2,1)' });
    fwd.cancel();
    await back.finished.catch(() => {});
    a.style.zIndex = '';
    await sleep(140);
  }

  async function combatEvent(e, quick) {
    switch (e.t) {
      case 'first': {
        banner(e.side === 0 ? 'VOUS ATTAQUEZ' : esc(ui.opp.name), e.side === 0 ? 'en premier' : 'attaque en premier');
        await sleep(900);
        break;
      }
      case 'law': {
        const law = R.LAW[e.side === 0 ? me().law : ui.opp.law];
        popOn(combatRowEl(e.side), law.name.toUpperCase(), 'info');
        await sleep(450);
        break;
      }
      case 'fx': {
        const el = unitByCid(e.cid);
        if (el) {
          el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)' }, { transform: 'scale(1)' }], { duration: dur(300) });
          const [x, y] = center(el.querySelector('.orb'));
          stage.burst(x, y, { n: 12, colors: [hexRgb(famColor(R.CARD[el.dataset.id].fam)), [255, 255, 255]], speed: 55, life: 0.45 });
        }
        await sleep(240);
        break;
      }
      case 'hit': {
        const el = unitByCid(e.cid);
        if (!el) break;
        if (e.kind === 'effect') {
          const src = e.src ? unitByCid(e.src) : null;
          const from = src ? center(src) : [window.innerWidth / 2, el.getBoundingClientRect().top < window.innerHeight / 2 ? window.innerHeight : 0];
          SFX.tap();
          await stage.beam(from, center(el), { ms: dur(300), color: [255, 160, 80] });
          stage.flash(el.querySelector('.orb'), 0.8);
          SFX.hit();
        }
        el.querySelector('.hp').textContent = Math.max(0, e.hp);
        el.querySelector('.hp').classList.add('hurt');
        setTimeout(() => el.querySelector('.hp').classList.remove('hurt'), 300);
        popOn(el, '−' + e.n, 'bad');
        if (!quick) await sleep(200);
        break;
      }
      case 'break': {
        const el = unitByCid(e.cid);
        if (!el) break;
        if (e.kind === 'effect' && e.src) {
          const src = unitByCid(e.src);
          if (src) await stage.beam(center(src), center(el), { ms: dur(300), color: [255, 160, 80] });
        }
        const orb = el.querySelector('.orb');
        orb.dataset.shield = '0';
        const [x, y] = center(orb);
        const b = orb.getBoundingClientRect();
        stage.ring(x, y, b.width * 0.5, { n: 30, colors: [[255, 255, 255], [190, 235, 255], [255, 190, 240]], speed: 70, life: 0.5 });
        SFX.shield();
        popOn(el, 'BOUCLIER', 'info');
        if (!quick) await sleep(240);
        break;
      }
      case 'venom': {
        const el = unitByCid(e.cid);
        if (el) {
          const [x, y] = center(el.querySelector('.orb'));
          stage.burst(x, y, { n: 18, colors: [[140, 255, 120], [60, 200, 90]], speed: 50, life: 0.6 });
          popOn(el, 'VENIN', 'good');
        }
        break;
      }
      case 'buff': {
        const el = unitByCid(e.cid);
        if (el) {
          const atk = Number(el.querySelector('.atk').textContent) + e.a;
          const hp = Number(el.querySelector('.hp').textContent) + e.h;
          setStats(el, Math.max(0, atk), hp, true);
          popOn(el, `+${e.a}/+${e.h}`, 'good');
          SFX.buff();
        }
        await sleep(160);
        break;
      }
      case 'kw': {
        const el = unitByCid(e.cid);
        if (el) {
          const orb = el.querySelector('.orb');
          if (e.k === 'bouclier') orb.dataset.shield = '1';
          if (e.k === 'renaissance') orb.dataset.ghost = '1';
          if (e.k === 'rafale' || e.k === 'venin') updateKwIcons(el, e.k);
          stage.flash(orb, 0.5);
          popOn(el, R.KEYWORDS[e.k].name.toUpperCase(), 'info');
        }
        await sleep(200);
        break;
      }
      case 'swap': {
        const el = unitByCid(e.cid);
        if (el) {
          await el.animate([{ transform: 'rotateX(0)' }, { transform: 'rotateX(90deg)' }, { transform: 'rotateX(0)' }], { duration: dur(380) }).finished.catch(() => {});
          setStats(el, e.atk, e.hp, true);
          popOn(el, 'INVERSÉ', 'info');
        }
        await sleep(120);
        break;
      }
      case 'die': {
        const el = unitByCid(e.cid);
        if (!el) break;
        const orb = el.querySelector('.orb');
        const [x, y] = center(orb);
        const b = orb.getBoundingClientRect();
        SFX.death();
        stage.flash(orb, 1);
        stage.burst(x, y, { n: 46, colors: stage.colors(el.dataset.id), speed: 95, life: 0.85, size: 2, spread: b.width * 0.3 });
        stage.ring(x, y, b.width * 0.25, { n: 24, colors: [[255, 255, 255]], speed: 80, life: 0.35 });
        await stage.reveal(orb, 1, 0, dur(240));
        const row = el.parentElement;
        const before = rects(row);
        el.remove();
        sizeRow(row, 'board', 92);
        arc(row);
        if (row === $('enemy')) for (const k of row.children) k.style.setProperty('--arc', (-parseFloat(k.style.getPropertyValue('--arc')) || 0) + 'px');
        flipFrom(row, before);
        await sleep(160);
        break;
      }
      case 'summon': {
        const row = combatRowEl(e.side);
        const before = rects(row);
        const el = makeUnit(e.unit, 'combat');
        el.dataset.key = e.unit.cid;
        const kids = [...row.children];
        row.insertBefore(el, kids[e.index] || null);
        sizeRow(row, 'board', 92);
        arc(row);
        if (row === $('enemy')) for (const k of row.children) k.style.setProperty('--arc', (-parseFloat(k.style.getPropertyValue('--arc')) || 0) + 'px');
        flipFrom(row, before);
        const orb = el.querySelector('.orb');
        stage.setReveal(orb, 0);
        stage.reveal(orb, 0, 1, dur(360));
        const [x, y] = center(orb);
        stage.burst(x, y, { n: 16, colors: e.reborn ? [[220, 190, 255], [255, 255, 255]] : [[255, 255, 255]], speed: 40, life: 0.5 });
        if (e.reborn) popOn(el, 'RENAISSANCE', 'info');
        await sleep(300);
        break;
      }
      case 'sync':
        reconcile(e.boards);
        break;
      default:
        break;
    }
  }

  function updateKwIcons(el, k) {
    const kws = el.querySelector('.kws');
    if (k === 'rafale' && !kws.innerHTML.includes('wind')) kws.insertAdjacentHTML('beforeend', icon('wind'));
    if (k === 'venin') kws.insertAdjacentHTML('beforeend', icon('drop'));
  }

  function reconcile(boards) {
    for (let s = 0; s < 2; s++) {
      for (const u of boards[s]) {
        const el = unitByCid(u.cid);
        if (!el) continue;
        setStats(el, u.atk, u.hp, false);
        const orb = el.querySelector('.orb');
        orb.dataset.shield = u.kw.includes('bouclier') ? '1' : '0';
        orb.dataset.ghost = u.kw.includes('renaissance') ? '1' : '0';
      }
    }
  }

  async function afterBattle(res) {
    // Retour à la taverne : on efface le combat, on montre les rivaux.
    const out = [...$('enemy').children, ...$('board').children].map((el) => stage.reveal(el.querySelector('.orb'), 1, 0, 260));
    await Promise.all(out);
    clearBanner();
    document.body.classList.remove('in-combat');
    $('enemy').innerHTML = '';
    $('board').innerHTML = '';
    renderRivals();
    for (const id of res.fallen || []) {
      const p = ui.state.players.find((x) => x.id === id);
      if (p && p.bot) toast(`${p.name} est éliminé · ${p.rank}e`, 2200);
    }
    if (res.over) {
      saveGame();
      await endScreen();
      return;
    }
    ui.stamp++;
    renderGame(true);
    banner('CYCLE ' + ui.state.round, `${me().gold} énergies`);
    await sleep(400);
    await playShopEvents(res.startEvents);
    renderEnergy();
    saveGame();
  }

  // ─── Fin de partie ──────────────────────────────────────────
  async function endScreen() {
    const s = ui.state;
    const rank = s.rank || me().rank || 8;
    if (!s.rewarded) {
      s.rewarded = true;
      addDust(s.reward || 0);
    }
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* stockage indisponible */ }
    $('endRank').innerHTML = ordinal(rank);
    $('endRank').classList.toggle('podium', rank <= 3);
    $('endText').textContent = rank === 1 ? 'Votre système domine l’univers.'
      : rank <= 3 ? 'Sur le podium : les poussières d’étoiles sont à vous.'
        : 'Votre univers s’est éteint. Seuls les trois premiers gagnent des poussières.';
    $('endBoard').innerHTML = me().board.map((u) => `<div class="unit"><div class="orb" data-planet="${u.id}" data-golden="${u.golden ? 1 : 0}"></div><div class="stats"><b class="atk">${u.atk}</b><b class="hp">${u.hp}</b></div></div>`).join('');
    $('endDust').textContent = '+0';
    $('endTotal').innerHTML = 'Total ' + icon('dust') + ' ' + (dust() - (s.reward || 0));
    await show('end');
    if (rank <= 3) SFX.win(); else SFX.lose();
    const reward = s.reward || 0;
    if (reward) {
      const t0 = performance.now();
      const base = dust() - reward;
      await new Promise((resolve) => {
        const tick = (now) => {
          const k = Math.min(1, (now - t0) / 1400);
          const v = Math.round(reward * k);
          $('endDust').textContent = '+' + v;
          $('endTotal').innerHTML = 'Total ' + icon('dust') + ' ' + (base + v);
          if (Math.random() < 0.5) {
            const [x, y] = center($('endDust'));
            stage.burst(x, y, { n: 3, colors: [[246, 196, 83], [255, 255, 255]], speed: 80, up: 40, life: 0.8 });
          }
          if (k < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
    }
  }

  // ─── Commandes ──────────────────────────────────────────────
  const guard = (fn) => async () => {
    if (ui.busy) return;
    ui.busy = true;
    try { await fn(); } finally { ui.busy = false; }
  };

  async function newGameFlow() { stopAmbient(); renderLaws(); await show('laws'); }
  async function resumeGame() {
    const s = loadGame();
    if (!s) return;
    stopAmbient();
    ui.state = s;
    ui.stamp++;
    await show('game');
    renderGame(true);
  }
  $('soloBtn').addEventListener('click', () => {
    SFX.tap();
    const s = loadGame();
    if (!s) { newGameFlow(); return; }
    openSheet(`<h3>JOUER SOLO</h3><h2>Une partie vous attend</h2>
      <p class="muted">Cycle ${s.round} · ${Math.max(0, s.players[0].hp)} PV · ${R.alivePlayers(s).length} univers en lice</p>
      <div class="sheet-actions"><button class="btn primary" data-act="set" data-v="resume">REPRENDRE</button><button class="btn" data-act="set" data-v="new">NOUVELLE PARTIE</button></div>`);
  });
  $('multiBtn').addEventListener('click', () => {
    SFX.tap();
    openSheet(`<h3>MULTIJOUEUR</h3><h2>Bientôt</h2>
      <p>Les parties contre d’autres créateurs arriveront dans une prochaine version. En attendant, sept univers vous attendent en solo.</p>
      <div class="sheet-actions"><button class="btn primary" data-act="set" data-v="new">JOUER SOLO</button><button class="btn" data-act="close">FERMER</button></div>`);
  });
  $('marketBtn').addEventListener('click', async () => { SFX.tap(); stopAmbient(); renderMarket(); await show('market'); });
  $('marketBack').addEventListener('click', async () => { SFX.tap(); await backToMenu(); });
  $('settingsBtn').addEventListener('click', () => { SFX.tap(); openSheet(settingsHtml()); });
  $('lawsBack').addEventListener('click', async () => { SFX.tap(); await backToMenu(); });
  $('upBtn').addEventListener('click', guard(doUpgrade));
  $('rollBtn').addEventListener('click', guard(doRoll));
  $('freezeBtn').addEventListener('click', () => { if (!ui.busy) doFreeze(); });
  $('fightBtn').addEventListener('click', fight);
  $('rivals').addEventListener('click', () => { if (!ui.busy) { SFX.tap(); openRivals(); } });
  $('famsBtn').addEventListener('click', () => { SFX.tap(); openFamilies(); });
  $('menuBtn').addEventListener('click', () => { SFX.tap(); openMenu(); });
  $('powerBtn').addEventListener('click', () => {
    if (ui.busy) return;
    const p = me(), law = R.LAW[p.law];
    if (!law.active) { openFamilies(); return; }
    const can = R.canUsePower(ui.state);
    if (!can.ok) { toast(can.reason); return; }
    if (law.active.target) {
      if (!p.board.length) { toast('Placez d’abord un astre.'); return; }
      ui.targeting = !ui.targeting;
      document.querySelectorAll('#board .unit').forEach((el) => el.classList.toggle('target', ui.targeting));
      if (ui.targeting) toast('Touchez un astre de votre système.');
      renderPower();
    } else {
      guard(() => doPower(null))();
    }
  });
  $('speedBtn').addEventListener('click', () => {
    ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 4 : 1;
    ui.time = ui.speed;
    $('speedBtn').textContent = '×' + ui.speed;
    try { localStorage.setItem(SPEED_KEY, String(ui.speed)); } catch (err) { /* stockage indisponible */ }
  });
  $('skipBtn').addEventListener('click', () => { ui.skip = true; });
  $('againBtn').addEventListener('click', async () => { SFX.tap(); renderLaws(); await show('laws'); });
  $('endHome').addEventListener('click', async () => { SFX.tap(); await backToMenu(); });

  window.addEventListener('resize', () => {
    if (ui.screen === 'menu') layoutMenu();
    if (ui.screen === 'game' && ui.state && !document.body.classList.contains('in-combat') && !drag) renderGame(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('overlay').hidden && !ui.sheetLocked) closeSheet();
  });

  // Hooks de test / débogage.
  window.__orbite = { ui, rules: R, stage, show, renderGame, fight, enterMenu, backToMenu };

  // ─── Démarrage ──────────────────────────────────────────────
  boot();

  // Certains cadres (aperçus, iframes isolées) refusent même l'accès à navigator.serviceWorker.
  try {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
    }
  } catch (err) { /* hors ligne indisponible */ }
})();
