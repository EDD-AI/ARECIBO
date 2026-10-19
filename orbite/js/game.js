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
    loop: ['.XXX.', 'X...X', 'X.X.X', '...X.', 'XXX..'],
    sword: ['.....XX', '....XXX', '...XXX.', 'X.XXX..', '.XXX...', '.XXX...', 'X...X..'],
    skull: ['.XXXX.', 'XXXXXX', 'X.XX.X', 'XXXXXX', '.XXXX.', '.X.X..'],
    spark: ['...X...', '...X...', '..XXX..', 'XXXXXXX', '..XXX..', '...X...', '...X...']
  };
  function icon(name, cls) {
    const g = ICONS[name];
    const w = Math.max(...g.map((r) => r.length)), h = g.length;
    let rects = '';
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`; }));
    return `<svg class="pix ${cls || ''}" viewBox="0 0 ${w} ${h}" fill="currentColor" aria-hidden="true">${rects}</svg>`;
  }
  // Les mêmes icônes en masque CSS, pour l'épée et le cœur devant chaque statistique.
  function iconUrl(name) {
    const g = ICONS[name];
    const w = Math.max(...g.map((r) => r.length)), h = g.length;
    let rects = '';
    g.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'X') rects += `<rect x='${x}' y='${y}' width='1' height='1'/>`; }));
    return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' shape-rendering='crispEdges'>${rects}</svg>`)}")`;
  }
  document.documentElement.style.setProperty('--ico-atk', iconUrl('sword'));
  document.documentElement.style.setProperty('--ico-hp', iconUrl('heart'));

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
  function refuse(text) {
    toast(text);
    SFX.error();
  }
  // Position gauche/droite d'un élément pour placer le son dans l'espace stéréo.
  const panOf = (el) => {
    if (!el) return 0;
    const b = el.getBoundingClientRect();
    return ((b.left + b.width / 2) / window.innerWidth * 2 - 1) * 0.7;
  };

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
    const marks = cardMarks(u.id);
    if (marks.death) k = `<span class="mark" title="Effondrement">${icon('skull')}</span>` + k;
    if (marks.effect) k = `<span class="mark" title="Effet">${icon('spark')}</span>` + k;
    el.querySelector('.kws').innerHTML = k;
    el.dataset.kw = u.kw.join(' ');
    el.dataset.golden = u.golden ? '1' : '0';
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
    SFX.ambience({ splash: 'off', title: 'off', wake: 'wake', game: 'game', end: 'game' }[name] || 'menu');
    // Pendant la partie, le ciel s'efface derrière les planètes pour rester lisible.
    const busySky = ['laws', 'game', 'end'].includes(name);
    stage.starArea = busySky ? 3600 : 1800;
    stage.starDim = busySky ? 0.6 : 0.85;
    [...next.querySelectorAll('[data-planet]')].forEach((o, i) => revealIn(o, 60 + i * 35));
  }

  // ─── Intro : Studio EDDA → titre → réveil → menu ────────────
  const WAKE_KEY = 'orbite.reveil';
  const HINT_KEY = 'orbite.astuce';
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
    N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
    V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
    0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
    1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
    2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
    3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
    4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
    5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
    6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
    7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
    8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
    9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
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
  // Éclipse du titre : la lune glisse devant l'étoile, la couronne s'épanouit et scintille.
  let ecl = null;
  function startEclipse() {
    stopEclipse();
    const star = $('eclStar'), moon = $('eclMoon');
    ecl = { raf: 0, t0: performance.now(), glow: 0.08, sparks: 0 };
    star.dataset.glow = '0.08';
    ecl.slide = moon.animate([{ transform: 'translate(-104px, -54px)' }, { transform: 'translate(0, 0)' }], { duration: 4300, easing: 'cubic-bezier(.3,.05,.15,1)', fill: 'forwards' });
    const tick = (now) => {
      if (!ecl) return;
      const t = (now - ecl.t0) / 1000;
      // La couronne grandit pendant la totalité, puis respire doucement.
      const total = Math.max(0, Math.min(1, (t - 3.4) / 1.6));
      ecl.glow = 0.08 + total * (0.34 + 0.05 * Math.sin(t * 1.3));
      star.dataset.glow = ecl.glow.toFixed(3);
      if (total > 0.5 && now - ecl.sparks > 260) {
        ecl.sparks = now;
        const b = star.getBoundingClientRect();
        const a = Math.random() * Math.PI * 2, r = b.width * (0.52 + Math.random() * 0.25);
        stage.burst(b.left + b.width / 2 + Math.cos(a) * r, b.top + b.height / 2 + Math.sin(a) * r, { n: 1, colors: [[255, 255, 255], [220, 232, 255]], speed: 6, life: 1.4, size: 1 });
      }
      ecl.raf = requestAnimationFrame(tick);
    };
    ecl.raf = requestAnimationFrame(tick);
  }
  function stopEclipse() {
    if (!ecl) return;
    cancelAnimationFrame(ecl.raf);
    if (ecl.slide) ecl.slide.cancel();
    ecl = null;
  }

  async function titleScreen() {
    const w = $('titleWord');
    pixelWord(w, 'ORBITE', pixelSize(8));
    stage.register('title-star', { type: 'star', seed: 4242, starClass: 'étoile blanche', full: true, moons: 0, ring: false, debris: false });
    stage.register('title-moon', { type: 'moon', seed: 31, full: true, moons: 0, ring: false, debris: false });
    for (const el of [$('eclipse'), $('eclMoon')]) el.getAnimations().forEach((a) => a.cancel());
    $('eclMoon').style.transform = 'translate(-104px, -54px)';
    await show('title');
    startEclipse();
    setTimeout(() => pixelsIn(w), 900);
    const tapped = waitTap(null, $('title'));
    setTimeout(() => $('tapHint').classList.add('show'), 2600);
    await tapped;
    SFX.start();
    vibrate(15);
    $('tapHint').classList.remove('show');
    // Anneau de diamant : la lune s'écarte d'un cheveu, un éclat jaillit au bord de l'étoile.
    const moon = $('eclMoon'), star = $('eclStar');
    if (ecl && ecl.slide) { ecl.slide.finish(); ecl.slide = null; }
    moon.animate([{ transform: 'translate(0, 0)' }, { transform: 'translate(7px, 4px)' }], { duration: 500, easing: 'ease-out', fill: 'forwards' });
    const sb = star.getBoundingClientRect(), eb = $('eclipse').getBoundingClientRect();
    const bx = sb.left + sb.width / 2 - sb.width * 0.43, by = sb.top + sb.height / 2 - sb.height * 0.26;
    const flare = $('flare');
    flare.style.left = bx - eb.left + 'px';
    flare.style.top = by - eb.top + 'px';
    flare.classList.remove('go');
    void flare.offsetWidth;
    flare.classList.add('go');
    stage.flash(star, 1);
    stage.burst(bx, by, { n: 40, colors: [[255, 255, 255], [255, 246, 226]], speed: 120, life: 0.9 });
    await wait(450);
    const [cx, cy] = center(w);
    stage.burst(cx, cy, { n: 60, colors: [[255, 255, 255], [200, 220, 255]], speed: 110, life: 1.1, spread: 40 });
    pixelsShatter(w);
    $('eclipse').animate([{ transform: 'scale(1)' }, { transform: 'scale(2.4)' }], { duration: 1200, easing: 'cubic-bezier(.5,0,.8,.4)', fill: 'forwards' });
    stage.reveal(star, 1, 0, 1100);
    stage.reveal(moon, 1, 0, 1100);
    await wait(1250);
    stopEclipse();
    flare.classList.remove('go');
  }

  async function wakeScreen() {
    await show('wake');
    await wait(1100);
    await typeLine($('wakeLine'), 'Réveillez-vous. Bonjour, créateur.', { hold: 2000, speed: 70 });
    await wait(400);
  }

  // ─── Votre planète ──────────────────────────────────────────
  // Le monde du joueur : mort au départ, il renaît avec les améliorations du Marché stellaire.
  // Lumière rasante venue du haut à gauche : le dôme s'éclaire comme dans un plan d'anime.
  const W = window.OrbiteWorld;
  const HZ_LIGHT = [-0.55, 0.62, 0.55];
  const WORLD_KEY = 'orbite.monde';
  const WORLD_SEEDS = [5002, 5008, 5016, 5045];
  const worldList = () => { try { const v = JSON.parse(store.get(WORLD_KEY, '[]')); return Array.isArray(v) ? v : []; } catch (err) { return []; } };
  const worldSeed = () => WORLD_SEEDS[Number(playerTag()) % WORLD_SEEDS.length];
  function applyWorld() {
    const look = { seed: worldSeed(), living: W.channels(worldList()), full: true, light: HZ_LIGHT };
    for (const id of ['horizon', 'world-big', 'world-mini']) stage.register(id, look);
  }

  // Les anciens horizons achetés sont remboursés une fois.
  (function migrateHorizons() {
    const raw = store.get(HZ_OWNED, '');
    if (!raw) return;
    const PRICES = { lune: 60, pourpre: 120, givre: 180, braise: 240, envers: 320 };
    let back = 0;
    try { for (const id of JSON.parse(raw)) back += PRICES[id] || 0; } catch (err) { back = 0; }
    try { localStorage.removeItem(HZ_OWNED); localStorage.removeItem(HZ_ON); } catch (err) { /* stockage indisponible */ }
    if (back) { addDust(back); setTimeout(() => toast(`Horizons remboursés : +${back} poussières d’étoiles.`, 3600), 9000); }
  })();

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
    const lv = levelInfo(xpTotal());
    $('pfName').textContent = pseudo();
    $('pfLvl').innerHTML = `NIV. ${lv.lvl}<i class="xp-mini"><i style="width:${(lv.rest / lv.need * 100).toFixed(1)}%"></i></i>`;
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
    applyWorld();
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
    applyWorld();
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
    const list = worldList(), lvl = levelInfo(xpTotal()).lvl;
    const nxt = W.next(list);
    $('marketBack').innerHTML = icon('back');
    $('marketDust').innerHTML = icon('dust') + ' ' + dust();
    $('mkStage').textContent = W.stageName(list).toUpperCase();
    $('mkProg').style.width = (list.length / W.UPGRADES.length * 100) + '%';
    $('mkCount').textContent = `${list.length} / ${W.UPGRADES.length} améliorations · niveau ${lvl}`;
    if (!nxt) {
      $('mkNext').innerHTML = '<b>Votre planète est pleinement vivante.</b><p>Elle tourne désormais au-dessus du menu comme une nouvelle Terre.</p>';
    } else {
      const st = W.STAGES[nxt.stage];
      const why = lvl < nxt.lvl ? `Atteignez le niveau ${nxt.lvl}.` : dust() < nxt.price ? `Il vous manque ${nxt.price - dust()} poussières d’étoiles.` : '';
      $('mkNext').innerHTML = `<span class="mk-kicker">PROCHAINE ÉTAPE · ${st.name.toUpperCase()}</span>
        <b>${esc(nxt.name)}</b><p>${esc(nxt.text)}</p>
        <div class="mk-req"><span>NIVEAU ${nxt.lvl}</span><span>${icon('dust')} ${nxt.price}</span></div>
        <button class="btn primary" data-up="${nxt.id}" ${why ? 'disabled' : ''}>FAIRE RENAÎTRE · ${icon('dust')} ${nxt.price}</button>
        ${why ? `<small>${why}</small>` : ''}`;
    }
    $('mkList').innerHTML = W.STAGES.map((st, i) => `<h4>${st.name.toUpperCase()}<small>${esc(st.text)}</small></h4>` +
      W.UPGRADES.filter((u) => u.stage === i).map((u) => {
        const has = list.includes(u.id), isNext = nxt && nxt.id === u.id;
        return `<div class="mk-row ${has ? 'owned' : isNext ? 'next' : lvl < u.lvl ? 'locked' : ''}">
          <i>${has ? '✓' : isNext ? '›' : ''}</i><span>${esc(u.name)}</span><small>${has ? 'FAIT' : `NIV. ${u.lvl} · ${u.price}`}</small></div>`;
      }).join('')).join('');
  }

  $('mkNext').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-up]');
    if (!b || b.disabled || ui.busy) return;
    const u = W.BY_ID[b.dataset.up], list = worldList();
    if (list.includes(u.id) || W.next(list) !== u) return;
    if (levelInfo(xpTotal()).lvl < u.lvl) { refuse(`Atteignez le niveau ${u.lvl}.`); return; }
    if (dust() < u.price) { refuse(`Il vous manque ${u.price - dust()} poussières d’étoiles.`); return; }
    ui.busy = true;
    addDust(-u.price);
    list.push(u.id);
    store.set(WORLD_KEY, JSON.stringify(list));
    // La planète se transforme dans un éclair : charge, flash, puis le monde nouveau.
    const pl = $('mkPlanet');
    const [x, y] = center(pl);
    const R = pl.getBoundingClientRect().width / 2;
    SFX.charge();
    pl.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.94)' }, { transform: 'scale(1.03)' }], { duration: 900, easing: 'ease-in' });
    await wait(850);
    stage.flash(pl, 1);
    applyWorld();
    SFX.golden();
    stage.burst(x, y, { n: 70, colors: stage.colors('world-big').concat([[255, 255, 255]]), speed: 120, life: 1, spread: R * 0.6 });
    stage.ring(x, y, R * 0.95, { n: 50, colors: [[255, 255, 255], [246, 196, 83]], speed: 90, life: 0.7 });
    pl.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
    renderMarket();
    toast(`${u.name} : ${u.text}`, 3200);
    ui.busy = false;
  });

  // ─── Profil ─────────────────────────────────────────────────
  const PSEUDO_KEY = 'orbite.pseudo', TAG_KEY = 'orbite.tag', STATS_KEY = 'orbite.stats', HIST_KEY = 'orbite.historique';
  const pseudo = () => store.get(PSEUDO_KEY, '') || 'Créateur';
  function playerTag() {
    let t = store.get(TAG_KEY, '');
    if (!/^\d{4}$/.test(t)) {
      t = String(1000 + Math.floor(Math.random() * 9000));
      store.set(TAG_KEY, t);
    }
    return t;
  }
  const readJson = (k, d) => { try { return JSON.parse(store.get(k, '')) || d; } catch (err) { return d; } };
  const stats = () => Object.assign({ games: 0, wins: 0, top3: 0, rankSum: 0, best: 0, cycles: 0, fights: 0, goldens: 0, dust: 0, laws: {} }, readJson(STATS_KEY, {}));

  // Classé : les rangs, de la Poussière à la Singularité (top 500 mondial).
  const RANKS = [
    { id: 'poussiere', name: 'Poussière', look: { type: 'asteroid', seed: 8101 } },
    { id: 'asteroide', name: 'Astéroïde', look: { type: 'asteroid', seed: 8133 } },
    { id: 'lune', name: 'Lune', look: { type: 'moon', seed: 8105 } },
    { id: 'planete', name: 'Planète', look: { type: 'terran', seed: 8107 } },
    { id: 'geante', name: 'Géante', look: { type: 'gas', seed: 8109, ring: true } },
    { id: 'etoile', name: 'Étoile', look: { type: 'star', seed: 8111, starClass: 'naine jaune' } },
    { id: 'nebuleuse', name: 'Nébuleuse', look: { type: 'crystal', seed: 8113 } },
    { id: 'pulsar', name: 'Pulsar', look: { type: 'star', seed: 8115, starClass: 'géante bleue' } },
    { id: 'singularite', name: 'Singularité', look: { type: 'blackhole', seed: 8117 } }
  ];
  RANKS.forEach((r) => stage.register('rank-' + r.id, r.look));

  function renderProfile() {
    const st = stats(), lv = levelInfo(xpTotal()), list = worldList();
    const hist = readJson(HIST_KEY, []);
    const pct = (n) => (st.games ? Math.round(n / st.games * 100) : 0) + ' %';
    const fav = Object.entries(st.laws).sort((a, b) => b[1] - a[1])[0];
    const tiles = [
      ['PARTIES', st.games], ['VICTOIRES', st.wins], ['PODIUMS', pct(st.top3)],
      ['RANG MOYEN', st.games ? (st.rankSum / st.games).toFixed(1) : '–'], ['MEILLEUR RANG', st.best ? ordinal(st.best) : '–'], ['COMBATS GAGNÉS', st.fights],
      ['ASTRES DORÉS', st.goldens], ['CYCLES JOUÉS', st.cycles], ['POUSSIÈRES GAGNÉES', st.dust]
    ];
    $('profileBack').innerHTML = icon('back');
    $('profileBody').innerHTML = `
      <div class="pf-id">
        <div class="orb pf-planet" data-planet="world-mini"></div>
        <div class="pf-who">
          <div class="pf-name-row" id="pfNameRow"><button class="pf-name" data-pf="rename">${esc(pseudo())}<span>#${playerTag()}</span></button></div>
          <span class="pf-lvl">NIVEAU ${lv.lvl} · ${esc(W.stageName(list))}</span>
          <div class="xp-bar"><i style="width:${(lv.rest / lv.need * 100).toFixed(1)}%"></i></div>
          <small>${lv.rest} / ${lv.need} XP vers le niveau ${lv.lvl + 1}</small>
        </div>
      </div>
      <h3 class="pf-h">CLASSÉ</h3>
      <div class="pf-rank">
        <div class="pf-unranked">?</div>
        <div><b>NON CLASSÉ</b><small>Le mode classé arrive avec le multijoueur : 5 parties de placement, puis un rang mondial qui monte et descend à chaque partie.</small></div>
      </div>
      <div class="pf-ladder">${RANKS.map((r, i) => `<div class="pf-tier"><div class="orb" data-planet="rank-${r.id}"></div><b>${r.name}</b><small>${i === RANKS.length - 1 ? 'Top 500 mondial' : 'I · II · III'}</small></div>`).join('')}</div>
      <p class="muted">Classement mondial : bientôt, avec les serveurs du mode en ligne.</p>
      <h3 class="pf-h">STATISTIQUES</h3>
      <div class="pf-stats">${tiles.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('')}</div>
      ${fav ? `<p class="muted">Loi favorite : <span style="color:${famColor(R.LAW[fav[0]].fam)}">${esc(R.LAW[fav[0]].name)}</span> · ${fav[1]} partie${fav[1] > 1 ? 's' : ''}</p>` : ''}
      <h3 class="pf-h">DERNIÈRES PARTIES</h3>
      <div class="pf-hist">${hist.length ? hist.map((h) => `<div class="${h.rank <= 3 ? 'podium' : ''}"><b>${h.quit ? '–' : ordinal(h.rank)}</b><span style="color:${famColor(R.LAW[h.law] ? R.LAW[h.law].fam : 'neutre')}">${esc(R.LAW[h.law] ? R.LAW[h.law].name : '')}</span><small>${h.quit ? 'abandon' : h.cycles + ' cycles'} · ${new Date(h.t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</small></div>`).join('') : '<p class="muted">Aucune partie terminée pour l’instant.</p>'}</div>`;
  }

  $('profileBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pf]');
    if (!b) return;
    if (b.dataset.pf === 'rename') {
      SFX.tap();
      $('pfNameRow').innerHTML = `<input class="pf-input" id="pfInput" maxlength="16" value="${esc(pseudo())}" aria-label="Pseudo" autocomplete="off"><button class="btn" data-pf="save">OK</button>`;
      const inp = $('pfInput');
      inp.focus();
      inp.select();
      inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') savePseudo(); });
    } else if (b.dataset.pf === 'save') savePseudo();
  });
  function savePseudo() {
    const v = ($('pfInput').value || '').replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 16);
    store.set(PSEUDO_KEY, v);
    SFX.buff();
    renderProfile();
    [...$('profileBody').querySelectorAll('[data-planet]')].forEach((o) => stage.setReveal(o, 1));
  }

  // Une partie terminée s'ajoute aux statistiques et à l'historique.
  function recordGame(s, rank, quit) {
    const st = stats();
    const p = s.players[0];
    st.games++;
    if (!quit) {
      st.rankSum += rank;
      if (rank === 1) st.wins++;
      if (rank <= 3) st.top3++;
      if (!st.best || rank < st.best) st.best = rank;
    } else st.rankSum += 8;
    st.cycles += Math.max(1, p.deadRound || s.round || 1);
    st.fights += s.fightsWon || 0;
    st.goldens += s.goldens || 0;
    st.dust += s.reward || 0;
    st.laws[p.law] = (st.laws[p.law] || 0) + 1;
    store.set(STATS_KEY, JSON.stringify(st));
    const hist = readJson(HIST_KEY, []);
    hist.unshift({ rank, law: p.law, cycles: Math.max(1, p.deadRound || s.round || 1), t: Date.now(), quit: !!quit });
    store.set(HIST_KEY, JSON.stringify(hist.slice(0, 15)));
  }

  // ─── Paramètres ─────────────────────────────────────────────
  function settingsHtml() {
    return `<h3>PARAMÈTRES</h3><div class="menu-list-sheet">
      <button class="btn" data-act="set" data-v="sound">SON : ${SFX.muted ? 'COUPÉ' : 'ACTIVÉ'}</button>
      <button class="btn" data-act="set" data-v="speed">VITESSE DES COMBATS : ×${ui.speed}</button>
      <button class="btn" data-act="set" data-v="help">COMMENT JOUER</button>
      <a class="btn" href="atelier.html">ATELIER DES PLANÈTES</a>
      <button class="btn" data-act="set" data-v="intro">REVOIR L’INTRODUCTION</button>
      <button class="btn" data-act="set" data-v="credits">CRÉDITS</button>
      <button class="btn ghost" data-act="set" data-v="reset">EFFACER LA PROGRESSION</button>
    </div><p class="muted">Poussières d’étoiles, niveau, planète et partie en cours restent sur cet appareil.</p>`;
  }

  // Crédits : qui a fait quoi, et les licences des ressources libres utilisées.
  function creditsHtml() {
    return `<h3>CRÉDITS</h3><div class="credits">
      <section><b>ORBITE</b><span>Un jeu Studio Edda</span></section>
      <section><b>PLANÈTES</b><span>Moteur de planètes d’ORBITE</span>
        <small>Pixel art calculé en direct (WebGL2) : chaque graine donne un astre unique.</small></section>
      <section><b>SONS</b><span>Kenney · kenney.nl</span>
        <small>Interface Sounds et UI Audio (CC0), sons des Starter Kits FPS et 3D Platformer (CC0) et du Starter Kit City Builder (licence MIT). Copies issues des portages de Hugo Locurcio.</small></section>
      <section><b>POLICE</b><span>Chakra Petch · Cadson Demak</span>
        <small>SIL Open Font License, servie par Google Fonts.</small></section>
      <section><b>LICENCE MIT · STARTER KIT CITY BUILDER</b>
        <small class="legal">Copyright (c) 2025 Kenney. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</small></section>
    </div>
    <div class="sheet-actions"><button class="btn" data-act="set" data-v="settings">${icon('back')} PARAMÈTRES</button></div>`;
  }

  async function settingsAction(v, btn) {
    if (v === 'sound') { SFX.setMuted(!SFX.muted); if (!SFX.muted) SFX.tap(); openSheet(settingsHtml()); }
    else if (v === 'speed') {
      ui.speed = ui.speed === 1 ? 2 : ui.speed === 2 ? 4 : 1;
      store.set(SPEED_KEY, String(ui.speed));
      openSheet(settingsHtml());
    } else if (v === 'help') openSheet(helpHtml());
    else if (v === 'credits') openSheet(creditsHtml());
    else if (v === 'settings') openSheet(settingsHtml());
    else if (v === 'intro') {
      closeSheet();
      stopAmbient();
      store.set(WAKE_KEY, '');
      boot();
    } else if (v === 'reset') {
      if (!btn.dataset.confirm) { btn.dataset.confirm = '1'; btn.textContent = 'TOUCHER ENCORE POUR CONFIRMER'; return; }
      for (const k of [SAVE_KEY, DUST_KEY, WAKE_KEY, XP_KEY, WORLD_KEY, STATS_KEY, HIST_KEY]) store.set(k, '');
      try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* stockage indisponible */ }
      closeSheet();
      applyWorld();
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
        <canvas class="sphere" data-fam="${l.fam}" aria-hidden="true"></canvas>
        <div>
          <span class="fam-chip">${f.name.toUpperCase()}</span>
          <h3>${esc(l.name)}</h3>
          <p class="tag">${esc(l.tagline)}</p>
          <p class="txt">${esc(l.text)}</p>
          <p class="starter">PREMIER ASTRE : ${esc(st.name).toUpperCase()} ${st.atk}/${st.hp}</p>
        </div>
      </button>`;
    }).join('');
    mountEnergy($('lawList'));
  }
  // Les lois sont des sphères d'énergie animées, colorées selon le pouvoir de leur famille.
  function mountEnergy(root) {
    for (const c of root.querySelectorAll('canvas.sphere:not([data-on])')) {
      c.dataset.on = '1';
      window.OrbiteEnergy.mount(c, c.dataset.fam);
    }
  }

  $('lawList').addEventListener('click', (e) => {
    const b = e.target.closest('.law');
    if (!b) return;
    SFX.tap();
    ui.lawPick = b.dataset.law;
    for (const x of $('lawList').children) x.classList.toggle('on', x === b);
    $('lawGo').disabled = false;
    window.OrbiteEnergy.pulse(b.querySelector('canvas.sphere'));
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
    if (store.get(HINT_KEY, '') !== '1') {
      store.set(HINT_KEY, '1');
      setTimeout(() => toast('Touchez un astre pour lire ce qu’il fait. Glissez-le pour l’acheter ou le placer.', 5200), 2200);
    }
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
    // Barre repliée : un menu qui se déroule, sans images.
    const alive = R.alivePlayers(s).length;
    const rank = s.players.filter((p) => p.alive).sort((a, b) => b.hp - a.hp).findIndex((p) => !p.bot) + 1;
    $('rivals').innerHTML = `<span class="rv-label">RIVAUX</span><span class="rv-info">${alive} univers en lice${me().alive ? ` · vous êtes ${ordinal(rank)}` : ''}</span><span class="rv-open">${icon('back', 'down')}</span>`;
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
    const txt = `<b>${active ? 'POUVOIR' : 'LOI'}${active && p.powerUsed ? ' · UTILISÉ' : ''}</b>${label}${cost}`;
    const cv = b.querySelector('canvas.sphere');
    if (cv && cv.dataset.fam === law.fam) b.querySelector('.power-txt').innerHTML = txt;
    else {
      b.innerHTML = `<canvas class="sphere mini" data-fam="${law.fam}" aria-hidden="true"></canvas><span class="power-txt">${txt}</span>`;
      mountEnergy(b);
    }
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
    if (!check.ok) { refuse(check.reason); return false; }
    const before = copyRects(id);
    const res = R.buy(ui.state, slot);
    if (!res.ok) { refuse(res.reason); return false; }
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
    ui.state.goldens = (ui.state.goldens || 0) + 1;
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
    if (!res.ok) { refuse(res.reason); renderHand(); return false; }
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
    if (!res.ok) { refuse(res.reason); return false; }
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
    if (!res.ok) { refuse(res.reason); return; }
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
    if (!res.ok) { refuse(res.reason); return; }
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
    if (!res.ok) { refuse(res.reason); renderPower(); return; }
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
      SFX.lift(panOf(drag.el));
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
        const index = boardIndexAt(e.clientX, drag.src === 'board' ? drag.key : null);
        if (index !== drag.index && drag.index != null) SFX.slot();
        drag.index = index;
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
    ov.classList.toggle('top', !!o.top);
    if (ov.hidden) SFX.open();
    ov.hidden = false;
    document.body.classList.add('modal');
    stage.modal = true;
    stage.modalEl = $('sheet');
    ui.sheetClose = o.onClose || null;
    ui.sheetLocked = !!o.locked;
    [...$('sheet').querySelectorAll('[data-planet]')].forEach((orb, i) => revealIn(orb, i * 60));
  }
  function closeSheet() {
    if (!$('overlay').hidden) SFX.close();
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
          ${statsHtml(u.atk, u.hp, 'sheet-stats')}
        </div>
      </div>
      ${effectHtml(u.id, u.golden, u.kw)}${att}`;
  }

  // ─── Comprendre un astre ────────────────────────────────────
  // Termes des textes, expliqués sous l'effet.
  const TERMS = {
    'Début de combat': 'Se déclenche juste avant la première attaque.',
    'Début de cycle': 'Se déclenche au début de chaque phase d’achat.',
    'Fin de cycle': 'Se déclenche quand vous lancez le combat, à la fin de vos achats.',
    'Naissance': 'Se déclenche quand vous placez l’astre dans votre système.',
    'Effondrement': 'Se déclenche quand l’astre est détruit en combat.',
    'Habitable': 'Ne fonctionne que si votre système contient un Soleil.',
    'Soleil': 'Compte comme un Soleil pour les effets Habitable.',
    'Débris': 'Petit astre de roche laissé par un monde effondré.',
    'pour le combat': 'Le bonus disparaît à la fin du combat.'
  };
  const HOOKS = ['play', 'endTurn', 'startTurn', 'buy', 'start', 'attack', 'allyAttack', 'allyDeath', 'shieldBreak', 'damaged', 'allyKill', 'reborn', 'allyReborn'];
  function cardMarks(id) {
    const c = R.CARD[id];
    return {
      death: typeof c.death === 'function',
      effect: HOOKS.some((h) => typeof c[h] === 'function') || !!c.sun || /Vos effets/.test(c.text)
    };
  }
  const KW_BY_NAME = Object.fromEntries(Object.entries(R.KEYWORDS).map(([k, v]) => [v.name, k]));
  const WORDS = [...Object.keys(TERMS), ...Object.keys(KW_BY_NAME)].sort((a, b) => b.length - a.length);
  const WORD_RE = new RegExp('(' + WORDS.map((w) => w.replace(/[-]/g, '\\-')).join('|') + ')', 'g');

  function statsHtml(atk, hp, cls) {
    return `<div class="${cls}"><span class="stat"><span class="atk">${atk}</span><small>ATTAQUE</small></span><span class="stat"><span class="hp">${hp}</span><small>PV</small></span></div>`;
  }
  function effectHtml(id, golden, kw) {
    const text = R.cardText(id, golden);
    const found = new Set();
    const rich = esc(text).replace(WORD_RE, (w) => { found.add(w); return `<b>${w}</b>`; });
    const defs = [];
    for (const w of WORDS) {
      if (!found.has(w)) continue;
      if (TERMS[w]) defs.push(`<div><b>${w.toUpperCase()}</b>${esc(TERMS[w])}</div>`);
    }
    const kws = new Set(kw);
    for (const w of found) if (KW_BY_NAME[w]) kws.add(KW_BY_NAME[w]);
    return `<p class="sheet-text">${rich}</p><div class="kw-list">${defs.join('')}${kwList([...kws])}</div>`;
  }

  // Fiche rapide : touchez un astre en combat, chez un rival ou en fin de partie.
  const peek = document.createElement('div');
  peek.className = 'peek';
  peek.hidden = true;
  document.body.appendChild(peek);
  function showPeek(el) {
    const id = el.dataset.id;
    const c = id && R.CARD[id];
    if (!c) return;
    const f = R.FAMILIES[c.fam];
    const golden = el.dataset.golden === '1';
    const orb = el.querySelector('.orb');
    const kw = new Set((el.dataset.kw || '').split(' ').filter(Boolean));
    if (orb && orb.dataset.shield === '1') kw.add('bouclier'); else if (orb && orb.dataset.shield === '0') kw.delete('bouclier');
    if (orb && orb.dataset.ghost === '1') kw.add('renaissance'); else if (orb && orb.dataset.ghost === '0') kw.delete('renaissance');
    const atk = el.querySelector('.atk') ? el.querySelector('.atk').textContent : c.atk;
    const hp = el.querySelector('.hp') ? el.querySelector('.hp').textContent : c.hp;
    peek.innerHTML = `<span class="fam-chip" style="--c:${f.color}">${f.name.toUpperCase()} · NIVEAU ${c.tier}${golden ? ' · DORÉ' : ''}</span>
      <h4>${esc(c.name)}</h4>${statsHtml(atk, hp, 'peek-stats')}${effectHtml(id, golden, [...kw])}`;
    peek.hidden = false;
    const b = el.getBoundingClientRect();
    const w = peek.offsetWidth, h = peek.offsetHeight;
    const x = Math.max(10, Math.min(window.innerWidth - w - 10, b.left + b.width / 2 - w / 2));
    const below = b.top + b.height / 2 < window.innerHeight / 2;
    const y = below ? Math.min(window.innerHeight - h - 10, b.bottom + 8) : Math.max(10, b.top - h - 8);
    peek.style.left = x + 'px';
    peek.style.top = y + 'px';
    peek.classList.remove('in');
    void peek.offsetWidth;
    peek.classList.add('in');
    SFX.tap();
    // En combat, la fiche s'efface seule pour ne pas cacher la bataille.
    clearTimeout(peek.timer);
    if (document.body.classList.contains('in-combat')) peek.timer = setTimeout(hidePeek, 3500);
  }
  function hidePeek() { clearTimeout(peek.timer); peek.hidden = true; }
  document.addEventListener('pointerdown', (e) => { if (!peek.hidden && !peek.contains(e.target)) hidePeek(); }, true);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('#enemy .unit, body.in-combat #board .unit, #endBoard .unit, .rival-board .unit');
    if (el) showPeek(el);
  });

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
    if (!res.ok) { refuse(res.reason); return; }
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
  const staticUnit = (u) => `<div class="unit" data-id="${u.id}" data-golden="${u.golden ? 1 : 0}" data-kw="${u.kw.join(' ')}"><div class="orb" data-planet="${u.id}" data-golden="${u.golden ? 1 : 0}"></div><div class="stats"><b class="atk">${u.atk}</b><b class="hp">${u.hp}</b></div></div>`;

  function openRivals() {
    const s = ui.state;
    const list = s.players.slice().sort((a, b) => (b.alive - a.alive) || (a.alive ? b.hp - a.hp : a.rank - b.rank));
    const last = me().lastOpp;
    const rows = list.map((p, i) => {
      const board = p.board.map(staticUnit).join('');
      const hp = Math.max(0, p.hp);
      const lost = ui.prevHp && ui.prevHp[p.id] != null && p.hp < ui.prevHp[p.id] ? ui.prevHp[p.id] - p.hp : 0;
      const tag = p.bot && p.id === last ? '<em>DERNIER ADVERSAIRE</em>' : '';
      return `<button class="rival-row ${p.alive ? '' : 'dead'} ${p.bot ? '' : 'me'}" data-act="rival">
          <span class="rk">${p.alive ? i + 1 : p.rank}</span>
          <span class="rv-who"><span class="n">${esc(p.name)}</span>${tag}<span class="l">niveau ${p.tier}${p.alive ? '' : ` · éliminé ${ordinal(p.rank)}`}</span></span>
          <span class="rv-hp">${lost ? `<small>−${lost}</small>` : ''}<b>${p.alive ? hp : '–'}</b><i class="hp-bar"><i style="width:${p.alive ? Math.min(100, hp / R.START_HP * 100) : 0}%"></i></i></span>
        </button>
        <div class="rival-board" hidden><p class="rv-last">${p.bot ? 'Dernier système joué' : 'Votre système'}</p><div class="row">${board || '<span class="muted">Système vide</span>'}</div></div>`;
    }).join('');
    openSheet(`<h3>UNIVERS EN LICE · ${R.alivePlayers(s).length}</h3><div class="rival-list">${rows}</div>
      <p class="muted">Touchez un univers pour voir le dernier système qu’il a joué, puis un astre pour lire ce qu’il fait. Dégâts plafonnés à ${R.DAMAGE_CAP} tant que plus de trois univers sont en vie.</p>`, { top: true });
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
      <li><b>Touchez un astre</b> pour lire ce qu’il fait, même en combat ou chez un rival. Sous chaque astre : ${icon('sword')} son <b>Attaque</b> et ${icon('heart')} ses <b>PV</b>. En haut à droite : ${icon('skull')} il a un effet d’<b>Effondrement</b> (quand il est détruit, comme laisser des Débris), ${icon('spark')} il a un autre effet.</li>
      <li><b>Trois copies</b> d’un même astre fusionnent en un <b>astre doré</b> (stats doublées). Le placer offre une <b>découverte</b> du niveau supérieur.</li>
      <li>Chaque partie active <b>5 familles</b> sur 8, plus les neutres. La réserve est <b>partagée</b> : si des rivaux jouent une famille, ses astres se font rares.</li>
      <li>Le perdant subit : niveau du gagnant + niveaux de ses astres survivants. <b>Maximum ${R.DAMAGE_CAP} dégâts</b> tant que plus de trois univers sont en vie.</li>
      <li>Seuls les <b>trois premiers</b> gagnent des poussières d’étoiles : ${R.REWARDS[1]}, ${R.REWARDS[2]} et ${R.REWARDS[3]}.</li>
      <li>Chaque partie rapporte de l’<b>expérience</b>. Les niveaux ouvrent des améliorations au <b>Marché stellaire</b> : avec vos poussières, faites renaître votre planète, celle qui tourne derrière le menu.</li>
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
      s.xpGiven = 'abandon';
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
    if (!res.ok) { refuse(res.reason); ui.busy = false; return; }
    if (res.battle && res.battle.winner === 0) ui.state.fightsWon = (ui.state.fightsWon || 0) + 1;
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
    SFX.ambience('battle');
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
    hidePeek();
    SFX.ambience('game');
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
    SFX.whoosh(panOf(a));
    const fwd = a.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${-dx * 0.07}px, ${-dy * 0.07}px) scale(1.06)`, offset: 0.35 },
      { transform: `translate(${dx}px, ${dy}px) scale(1.1)` }
    ], { duration: dur(360), easing: 'cubic-bezier(.55,0,.8,.3)', fill: 'forwards' });
    await fwd.finished.catch(() => {});
    SFX.hit(Math.max(1, ...group.filter((h) => h.t === 'hit').map((h) => h.n)), panOf(t));
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
          SFX.hit(e.n, panOf(el));
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
        SFX.shield(panOf(el));
        popOn(el, 'BOUCLIER', 'info');
        if (!quick) await sleep(240);
        break;
      }
      case 'venom': {
        const el = unitByCid(e.cid);
        if (el) {
          const [x, y] = center(el.querySelector('.orb'));
          stage.burst(x, y, { n: 18, colors: [[140, 255, 120], [60, 200, 90]], speed: 50, life: 0.6 });
          SFX.venom(panOf(el));
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
          SFX.buff(panOf(el));
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
        SFX.death(panOf(el));
        ui.lastDeath = { row: el.parentElement, x, y, t: performance.now(), colors: stage.colors(el.dataset.id) };
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
        const from = ui.lastDeath && ui.lastDeath.row === row && performance.now() - ui.lastDeath.t < 4000 / ui.time ? ui.lastDeath : null;
        if (from) {
          // Né d'un effondrement : l'astre jaillit des restes, comme un fragment projeté.
          const dx = from.x - x, dy = from.y - y;
          el.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(0.35)` },
            { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 18}px) scale(0.8)`, offset: 0.55 },
            { transform: 'translate(0, 0) scale(1)' }
          ], { duration: dur(460), easing: 'cubic-bezier(.2,.7,.3,1)' });
          stage.burst(from.x, from.y, { n: 22, colors: from.colors, speed: 70, life: 0.6, size: 2 });
          if (e.reborn) SFX.summon(panOf(el)); else SFX.debris(panOf(el));
        } else {
          SFX.summon(panOf(el));
        }
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
    const quit = s.xpGiven === 'abandon';
    const gain = quit ? { rank: 0, cycles: 0, total: 0 } : xpFor(s, rank);
    const xpFrom = xpTotal();
    let xpTo = xpFrom;
    if (!s.rewarded) {
      s.rewarded = true;
      addDust(s.reward || 0);
    }
    if (!s.recorded) {
      s.recorded = true;
      recordGame(s, rank, quit);
    }
    if (!s.xpGiven) {
      s.xpGiven = true;
      xpTo = xpFrom + gain.total;
      store.set(XP_KEY, String(xpTo));
    }
    $('end').classList.add('pending');
    const lv0 = levelInfo(xpFrom);
    $('xpLvl').textContent = lv0.lvl;
    $('xpFill').style.width = (lv0.rest / lv0.need * 100) + '%';
    $('xpGain').textContent = '+0 XP';
    $('xpDetail').textContent = quit ? 'Partie abandonnée : pas d’expérience.' : `Classement +${gain.rank} · ${gain.cycles / 5} cycles +${gain.cycles}`;
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* stockage indisponible */ }
    $('endRank').innerHTML = ordinal(rank);
    $('endRank').classList.toggle('podium', rank <= 3);
    $('endText').textContent = rank === 1 ? 'Votre système domine l’univers.'
      : rank <= 3 ? 'Sur le podium : les poussières d’étoiles sont à vous.'
        : 'Votre univers s’est éteint. Seuls les trois premiers gagnent des poussières.';
    $('endBoard').innerHTML = me().board.map(staticUnit).join('');
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
          if (Math.floor(v / 10) !== Math.floor((tick.v || 0) / 10)) SFX.coin();
          tick.v = v;
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
    await wait(250);
    await fillXp(xpFrom, xpTo);
    $('end').classList.remove('pending');
  }

  // ─── Niveau du créateur ─────────────────────────────────────
  // Chaque partie rapporte de l'expérience : selon le classement et les cycles tenus.
  const XP_KEY = 'orbite.xp';
  const RANK_XP = [0, 120, 90, 70, 55, 40, 30, 20, 10];
  const LEVEL_GIFT = 25;
  // Environ 300 parties pour atteindre le niveau 120 et une planète pleinement vivante.
  const xpNeed = (lvl) => 80 + 5 * (lvl - 1);
  const xpTotal = () => Math.max(0, Number(store.get(XP_KEY, '0')) || 0);
  function levelInfo(xp) {
    let lvl = 1, rest = xp;
    while (rest >= xpNeed(lvl)) { rest -= xpNeed(lvl); lvl++; }
    return { lvl, rest, need: xpNeed(lvl) };
  }
  function xpFor(s, rank) {
    const p = s.players[0];
    const cycles = Math.max(1, p.deadRound || s.round || 1);
    const r = RANK_XP[rank] || 10;
    return { rank: r, cycles: cycles * 5, total: r + cycles * 5 };
  }

  // La barre se remplit ; chaque niveau franchi déclenche l'explosion d'une planète.
  async function fillXp(from, to) {
    let cur = from;
    while (cur < to) {
      const lv = levelInfo(cur);
      const next = cur - lv.rest + lv.need;
      const target = Math.min(to, next);
      const a = lv.rest / lv.need, b = (target - (cur - lv.rest)) / lv.need;
      const ms = 300 + 900 * (b - a);
      const t0 = performance.now();
      await new Promise((resolve) => {
        const step = (now) => {
          const k = Math.min(1, (now - t0) / ms);
          const e = 1 - Math.pow(1 - k, 2);
          $('xpFill').style.width = ((a + (b - a) * e) * 100) + '%';
          $('xpGain').textContent = '+' + Math.round(cur - from + (target - cur) * e) + ' XP';
          if (k < 1) requestAnimationFrame(step); else resolve();
        };
        requestAnimationFrame(step);
      });
      cur = target;
      if (cur >= next) {
        addDust(LEVEL_GIFT);
        $('endTotal').innerHTML = 'Total ' + icon('dust') + ' ' + dust();
        await levelUpScene(lv.lvl + 1);
        $('xpLvl').textContent = lv.lvl + 1;
        $('xpFill').style.width = '0%';
      }
    }
    SFX.buff();
  }

  // Passage de niveau : la planète du niveau tremble, se charge, puis explose ;
  // le nouveau niveau naît de ses débris.
  const LVL_TYPES = ['lava', 'ocean', 'gas', 'ice', 'crystal', 'terran', 'toxic', 'desert', 'earth', 'mecha'];
  async function levelUpScene(lvl) {
    const ov = $('lvlup'), planet = $('lvlPlanet');
    stage.register('lvl-planet', { type: LVL_TYPES[(lvl - 2) % LVL_TYPES.length], seed: 9100 + lvl, full: true, moons: 0, ring: false, debris: false });
    pixelWord($('lvlWord'), 'NIVEAU', pixelSize(4));
    pixelWord($('lvlNum'), String(lvl), pixelSize(11));
    $('lvlNum').classList.add('gold');
    for (const r of ov.querySelectorAll('.pixel-word rect')) r.style.opacity = '0';
    const unlock = W.UPGRADES.find((u) => u.lvl === lvl);
    $('lvlGift').innerHTML = `${icon('dust')} +${LEVEL_GIFT} poussières d’étoiles` + (unlock ? `<br><span>Nouvelle amélioration au Marché : ${esc(unlock.name)}</span>` : '');
    $('lvlGift').classList.remove('show');
    $('lvlHint').classList.remove('show');
    ov.classList.remove('charging', 'boom');
    ov.hidden = false;
    const hadModal = stage.modal;
    document.body.classList.add('modal');
    stage.modal = true;
    stage.modalEl = ov;
    stage.setReveal(planet, 0);
    stage.reveal(planet, 0, 1, 600);
    planet.animate([{ transform: 'scale(0.6)' }, { transform: 'scale(1)' }], { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' });
    await wait(700);
    // Charge : la planète tremble, s'illumine par à-coups, un anneau se resserre.
    ov.classList.add('charging');
    SFX.charge();
    for (const [t, k] of [[250, 0.3], [650, 0.5], [950, 0.7], [1200, 0.9], [1400, 1]]) setTimeout(() => stage.flash(planet, k), t);
    const [cx, cy] = center(planet);
    const R = planet.getBoundingClientRect().width / 2;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const a = Math.random() * Math.PI * 2;
        stage.burst(cx + Math.cos(a) * R * 1.4, cy + Math.sin(a) * R * 1.4, { n: 4, colors: [[255, 255, 255]], speed: 12, life: 0.6, size: 1 });
      }, 200 + i * 260);
    }
    await wait(1600);
    // Explosion.
    const colors = stage.colors('lvl-planet');
    ov.classList.remove('charging');
    ov.classList.add('boom');
    SFX.explode();
    vibrate([40, 30, 70]);
    stage.flash(planet, 1);
    stage.reveal(planet, 1, 0, 160);
    stage.burst(cx, cy, { n: 150, colors: colors.concat([[255, 255, 255], [255, 220, 150]]), speed: 230, life: 1.4, size: 2, spread: R * 0.5 });
    stage.ring(cx, cy, R * 0.9, { n: 70, colors: [[255, 255, 255]], speed: 260, life: 0.7 });
    setTimeout(() => stage.ring(cx, cy, R * 0.6, { n: 50, colors: colors, speed: 160, life: 0.9 }), 120);
    for (let i = 0; i < 9; i++) {
      const c = document.createElement('div');
      c.className = 'orb lvl-chunk';
      c.dataset.planet = 'debris';
      c.dataset.fit = 'body';
      const size = 12 + Math.round(Math.random() * 16);
      c.style.cssText = `width:${size}px;height:${size}px;left:${cx - size / 2}px;top:${cy - size / 2}px`;
      ov.appendChild(c);
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, d = 130 + Math.random() * 170;
      c.animate([
        { transform: 'translate(0, 0) rotate(0deg) scale(0.4)' },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${(Math.random() - 0.5) * 540}deg) scale(1)` }
      ], { duration: 1500, easing: 'cubic-bezier(.1,.8,.3,1)', fill: 'forwards' });
      setTimeout(() => stage.reveal(c, 1, 0, 500), 1000);
      setTimeout(() => c.remove(), 1600);
    }
    await wait(420);
    // Le nouveau niveau naît des débris.
    pixelsIn($('lvlWord'));
    pixelsIn($('lvlNum'));
    SFX.golden();
    const [nx, ny] = center($('lvlNum'));
    stage.burst(nx, ny, { n: 40, colors: [[246, 196, 83], [255, 255, 255]], speed: 70, life: 1.2, spread: 30 });
    await wait(900);
    $('lvlGift').classList.add('show');
    SFX.coin();
    await wait(500);
    $('lvlHint').classList.add('show');
    await waitTap(6000, ov);
    SFX.tap();
    await ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, easing: 'ease-in' }).finished.catch(() => {});
    ov.hidden = true;
    ov.classList.remove('boom');
    stage.modal = hadModal && !$('overlay').hidden;
    stage.modalEl = stage.modal ? $('sheet') : null;
    if (!stage.modal) document.body.classList.remove('modal');
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
  $('profileBtn').addEventListener('click', async () => { SFX.tap(); stopAmbient(); renderProfile(); await show('profile'); });
  $('profileBack').addEventListener('click', async () => { SFX.tap(); await backToMenu(); });
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
    if (!can.ok) { refuse(can.reason); return; }
    if (law.active.target) {
      if (!p.board.length) { refuse('Placez d’abord un astre.'); return; }
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
  // Survol à la souris : un effleurement très discret (au doigt, le toucher suffit).
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target.closest('button:not(:disabled), a.btn, .unit');
    if (!t || (e.relatedTarget && t.contains(e.relatedTarget))) return;
    SFX.hover();
  });

  window.__orbite = { ui, rules: R, stage, show, renderGame, fight, enterMenu, backToMenu, endScreen };

  // ─── Démarrage ──────────────────────────────────────────────
  boot();

  // Certains cadres (aperçus, iframes isolées) refusent même l'accès à navigator.serviceWorker.
  try {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* hors ligne indisponible */ });
    }
  } catch (err) { /* hors ligne indisponible */ }
})();
