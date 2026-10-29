/* ORBITE — interface du jeu (téléphone d'abord).
 * Accueil → choix de la loi → cycles création / combat → classement.
 * Les règles sont dans rules.js ; ce fichier ne fait que montrer et animer. */
(function () {
  'use strict';

  // Version du jeu : à augmenter à chaque mise en ligne, avec version.json, le cache de sw.js et la
  // balise orbite-version d'index.html.
  const VERSION = 107;
  // Une page index.html restée en cache (navigateur, appli installée) avec des scripts plus récents :
  // on recharge une fois la page à jour, au lieu de planter sur un élément qui lui manque.
  const PAGE_VERSION = Number((document.querySelector('meta[name="orbite-version"]') || {}).content) || 0;
  if (PAGE_VERSION !== VERSION && location.protocol !== 'file:') {
    let again = false;
    try { again = sessionStorage.getItem('orbite.page') === String(VERSION); sessionStorage.setItem('orbite.page', String(VERSION)); } catch (err) { again = true; }
    if (!again) { location.replace(location.pathname + '?v=' + VERSION + location.hash); return; }
  }

  const R = window.OrbiteRules;
  const SFX = window.OrbiteSfx;
  const I18N = window.OrbiteI18n;
  // Astres dont le texte parle de « Vos effets » : repérés en français, avant la traduction.
  const FX_TEXT = new Set(R.CARDS.filter((c) => /Vos effets/.test(c.text || '')).map((c) => c.id));
  // Les données des règles (astres, lois, familles, mots-clés) passent dans la langue choisie.
  I18N.localize(R.CARDS, ['name', 'text', 'textGold']);
  I18N.localize(R.LAWS, ['name', 'tagline', 'text', 'awake']);
  I18N.localize(R.EVENTS, ['name', 'text']);
  I18N.localize(R.RELICS, ['name', 'text']);
  I18N.localize(R.FAMILIES, ['name', 'text']);
  I18N.localize(R.KEYWORDS, ['name', 'text']);
  const $ = (id) => document.getElementById(id);
  // Écouteur posé seulement si l'élément existe (une page plus ancienne restée en cache peut ne pas
  // l'avoir). Pas de « ?. » dans ce fichier : un iPhone resté sous iOS 12 ou 13 ne le lirait plus.
  function listen(id, type, fn, opts) { const el = $(id); if (el) el.addEventListener(type, fn, opts); }
  const SAVE_KEY = 'orbite.partie.v1';
  // Le jeu est en pré-alpha : le numéro s'affiche toujours « PRE.ALPHA n ».
  const VERSION_LABEL = 'PRE.ALPHA ' + VERSION;
  const DUST_KEY = 'orbite.poussieres';

  const ui = {
    state: null, screen: null, lawPick: null, lawOptions: [], busy: false,
    time: 1, skip: false, targeting: false, stamp: 1, prevHp: null, desk: false, z: 1
  };

  // ─── Écran de PC ────────────────────────────────────────────
  // Sur un grand écran horizontal (PC, tablette en largeur), le jeu passe en 16:9 et grossit : les
  // écrans sont agrandis d'un même zoom (--z, pour une hauteur virtuelle de 800 px) et la partie
  // s'étale en largeur (css/desk.css). Les tailles calculées pour un écran zoomé se comptent en
  // pixels virtuels : viewW() × viewH().
  function deskFit() {
    const W = window.innerWidth, H = window.innerHeight;
    ui.desk = W >= 900 && H >= 540 && W >= H * 1.2;
    ui.z = ui.desk ? Math.max(1, Math.min(2.4, H / 800)) : 1;
    document.body.classList.toggle('desk', ui.desk);
    document.documentElement.style.setProperty('--z', String(Math.round(ui.z * 1000) / 1000));
  }
  deskFit();
  const viewW = () => window.innerWidth / ui.z;
  const viewH = () => window.innerHeight / ui.z;
  // Un élément posé sur la page (bulle, chiffre qui s'envole) : même zoom, coordonnées converties.
  function placeAt(el, x, y) {
    el.style.zoom = ui.z === 1 ? '' : String(ui.z);
    el.style.left = x / ui.z + 'px';
    el.style.top = y / ui.z + 'px';
  }

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
    seed: ['....XX', '...XX.', '.XXX..', 'XXXXX.', 'XXXXX.', '.XXX..'],
    wall: ['XXXXX', 'X...X', 'X...X', '.X.X.', '..X..'],
    wind: ['XX..XX..', '.XX..XX.', '..XX..XX', '.XX..XX.', 'XX..XX..'],
    drop: ['..X..', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.'],
    magnet: ['X...X', 'X...X', 'X...X', 'XX.XX', '.XXX.'],
    loop: ['.XXX.', 'X...X', 'X.X.X', '...X.', 'XXX..'],
    sword: ['.....XX', '....XXX', '...XXX.', 'X.XXX..', '.XXX...', '.XXX...', 'X...X..'],
    skull: ['.XXXX.', 'XXXXXX', 'X.XX.X', 'XXXXXX', '.XXXX.', '.X.X..'],
    spark: ['...X...', '...X...', '..XXX..', 'XXXXXXX', '..XXX..', '...X...', '...X...'],
    shield: ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
    ask: ['.XXX.', 'X...X', '...X.', '..X..', '.....', '..X..'],
    moon: ['..XXX.', '.XX...', 'XX....', 'XX....', '.XX...', '..XXX.'],
    flame: ['..X...', '..XX..', '.XXX.X', '.XXXXX', 'XXXXXX', '.XXXX.'],
    // Mots-clés de position : Portée (une cible), Percée (une flèche qui plonge), Garde (une tour).
    range: ['..X..', '.X.X.', 'X.X.X', '.X.X.', '..X..'],
    pierce: ['..X..', '..X..', 'X.X.X', '.XXX.', '..X..'],
    guard: ['X.X.X', 'XXXXX', 'X...X', 'XX.XX', 'XXXXX'],
    chat: ['.XXXXX.', 'X.....X', 'X.X.X.X', 'X.....X', '.XXXXX.', '.X.....', 'X......']
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
  // Nombres ordinaux (1er, 2e…) selon la langue ; plain = sans balise (pour un toast).
  function ordinal(n, plain) {
    const L = I18N.lang;
    let suf;
    if (L === 'en') {
      const t = n % 100, u = n % 10;
      suf = t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th';
    } else if (L === 'es') suf = '.º';
    else if (L === 'de') return n + '.';
    else if (L === 'pt') suf = 'º';
    else suf = n === 1 ? 'er' : 'e';
    return plain ? n + suf : n + '<sup>' + suf + '</sup>';
  }
  // Rang classé traduit : « Poussière III ».
  const tierLabel = (t) => tr(t.name) + (t.div ? ' ' + t.div : '');

  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), ms || 1900);
  }
  function refuse(text) {
    // Une découverte en attente bloque tout : on la rouvre au lieu d'un simple refus.
    if (ui.state && ui.screen === 'game' && me() && me().discover.length && !ui.discoverDone) { openDiscover(); return; }
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
    placeAt(d, x, y);
    const ms = /\bbuff\b/.test(cls || '') ? 1300 : 900;
    d.style.animationDuration = dur(ms) + 'ms';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), dur(ms + 50));
  }
  function popOn(el, text, cls) {
    if (!el) return;
    const b = el.getBoundingClientRect();
    popAt(b.left + b.width / 2, b.top + b.height * 0.25, text, cls);
  }

  // ─── Légendaires ────────────────────────────────────────────
  const RAINBOW = [[255, 90, 120], [255, 190, 80], [250, 240, 120], [110, 240, 160], [100, 210, 255], [170, 130, 255], [255, 120, 230]];
  // Une légendaire apparaît dans la Création : éclat prismatique, carillon, « LÉGENDAIRE ! ».
  function legendArrive(el, delay) {
    setTimeout(() => {
      const orb = el.querySelector('.orb');
      if (!orb || !orb.isConnected) return;
      const [x, y] = center(orb);
      const r = orb.getBoundingClientRect().width / 2;
      stage.ring(x, y, r * 1.1, { n: 60, colors: RAINBOW, speed: 80, life: 0.9 });
      stage.burst(x, y, { n: 40, colors: RAINBOW, speed: 70, life: 0.8 });
      stage.flash(orb, 0.9);
      SFX.legend();
      vibrate([15, 30, 15]);
      popOn(orb, tr('LÉGENDAIRE !'), 'legend');
      el.classList.remove('legend-in');
      void el.offsetWidth;
      el.classList.add('legend-in');
    }, delay || 0);
  }
  // Acheter une légendaire : l'écran s'illumine, la bannière annonce son nom.
  function legendClaim(id, fromRect) {
    const fl = document.createElement('div');
    fl.className = 'legend-flash';
    document.body.appendChild(fl);
    setTimeout(() => fl.remove(), 1200);
    const x = fromRect ? fromRect.left + fromRect.width / 2 : window.innerWidth / 2;
    const y = fromRect ? fromRect.top + fromRect.height / 2 : window.innerHeight / 3;
    for (let i = 0; i < 3; i++) setTimeout(() => stage.ring(x, y, 20 + i * 30, { n: 70, colors: RAINBOW, speed: 120 + i * 30, life: 1 }), i * 140);
    stage.burst(x, y, { n: 80, colors: RAINBOW, speed: 130, life: 1.1 });
    SFX.legend(true);
    vibrate([30, 40, 30, 40, 60]);
    banner(tr('LÉGENDAIRE'), esc(R.CARD[id].name), 'legend');
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
      // Une partie finie reste sauvegardée tant que ses récompenses n'ont pas été données :
      // si l'appli est fermée pendant le dernier combat, l'écran de fin s'ouvre au retour.
      // Mode spectateur : la partie du joueur est finie, rien à reprendre.
      if ((ui.state.over && ui.state.xpGiven) || ui.state.watching) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(ui.state));
    } catch (err) { /* stockage indisponible */ }
  }
  function loadGame() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.v === 1 && Array.isArray(s.players) && !s.over && s.phase === 'shop' && !s.mp && !s.watching) return s;
    } catch (err) { /* sauvegarde illisible */ }
    return null;
  }
  function loadFinished() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && s.v === 1 && Array.isArray(s.players) && s.over && !s.xpGiven) return s;
    } catch (err) { /* sauvegarde illisible */ }
    return null;
  }
  function dust() { try { return Number(localStorage.getItem(DUST_KEY)) || 0; } catch (err) { return 0; } }
  function addDust(n) { try { localStorage.setItem(DUST_KEY, String(dust() + n)); } catch (err) { /* stockage indisponible */ } }
  // Graines de vie : la monnaie rare. Elles se gagnent (1re place, niveaux, ruines, succès) ou
  // s'achètent ; elles accélèrent la création et paient les cosmétiques, jamais la force en partie.
  const SEED_KEY = 'orbite.graines';
  function seeds() { try { return Number(localStorage.getItem(SEED_KEY)) || 0; } catch (err) { return 0; } }
  function addSeeds(n) { try { localStorage.setItem(SEED_KEY, String(Math.max(0, seeds() + n))); } catch (err) { /* stockage indisponible */ } }
  // Les deux monnaies côte à côte (en-têtes du Marché et de la Création).
  const wallet = () => `${icon('dust')} ${dust()} <span class="wallet-seed">${icon('seed', 'seed')} ${seeds()}</span>`;

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
    el.classList.toggle('legend', !!c.legend);
    el.classList.toggle('wall', u.kw.includes('rempart'));
    el.querySelector('.atk').textContent = u.atk;
    el.querySelector('.hp').textContent = u.hp;
    el.style.setProperty('--fam', famColor(c.fam));
    let k = '';
    if (u.kw.includes('megarafale')) k += icon('wind') + icon('wind');
    else if (u.kw.includes('rafale')) k += icon('wind');
    if (u.kw.includes('venin')) k += `<span style="color:${famColor('envers')}">${icon('drop')}</span>`;
    if (u.kw.includes('voldevie')) k += `<span style="color:${famColor('nebuleuse')}" title="${tr('Vol de vie')}">${icon('heart')}</span>`;
    if (u.kw.includes('arrimage') && (where === 'shop' || where === 'hand')) k += icon('magnet');
    if (u.kw.includes('portee')) k += `<span class="kw-pos" title="${tr('Portée')}">${icon('range')}</span>`;
    if (u.kw.includes('percee')) k += `<span class="kw-pos" title="${tr('Percée')}">${icon('pierce')}</span>`;
    if (u.kw.includes('garde')) k += `<span class="kw-pos" title="${tr('Garde')}">${icon('guard')}</span>`;
    const marks = cardMarks(u.id);
    if (marks.death) k = `<span class="mark" title="${tr('Effondrement')}">${icon('skull')}</span>` + k;
    if (marks.effect) k = `<span class="mark" title="${tr('Effet')}">${icon('spark')}</span>` + k;
    el.querySelector('.kws').innerHTML = k;
    el.dataset.kw = u.kw.join(' ');
    el.dataset.golden = u.golden ? '1' : '0';
    if (where === 'shop') el.querySelector('.tierdots').innerHTML = '<i></i>'.repeat(c.tier);
    el.dataset.id = u.id;
    if (u.uid) el.dataset.uid = u.uid;
    if (u.cid) el.dataset.cid = u.cid;
    if (where === 'board' || where === 'combat') el.dataset.row = u.row === 1 ? '1' : '0';
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
    rememberScreen(name);
    if (name !== 'menu') menuPage('main', true);
    // Une mise à jour en attente ne recharge la page qu'au retour au menu : jamais pendant une partie,
    // une campagne ou l'écran de fin (gain d'expérience, passage de niveau).
    if (ui.updatePending && name === 'menu') { saveGame(); ui.updatePending = false; setTimeout(() => updateReady(true), 0); }
    // Fonds : le cosmétique équipé pendant les parties (atténué pour la lisibilité), le ciel de la
    // Nébuleuse natale derrière la carte de campagne.
    stage.sky = name === 'game' || name === 'cFight' ? equippedSky() : name === 'cMap' ? 7 : name === 'system' ? 3 : 0;
    // En partie, le fond animé s'assombrit et pâlit : les astres et les textes restent lisibles.
    const inPlay = name === 'game' || name === 'cFight';
    stage.skyGain = name === 'cMap' ? 0.9 : name === 'system' ? 0.45 : inPlay ? 0.3 : 0.6;
    stage.skySat = inPlay ? 0.45 : 1;
    stage.skyOff = name === 'cMap' ? stage.skyOff : null;
    if (coach.steps === GAME_STEPS && name !== 'game') coachStop(false);
    if (coach.steps === LAW_STEPS && name !== 'laws') coachStop(false);
    if (coach.steps && coach.steps.menu && name !== 'menu') coachStop(true);
    const cur = document.querySelector('.screen.active');
    if (cur && cur.id !== name) {
      const orbs = [...cur.querySelectorAll('[data-planet]')];
      await Promise.all(orbs.map((o) => stage.reveal(o, 1, 0, 200)));
      cur.classList.remove('active');
    }
    const next = $(name);
    next.classList.add('active');
    // Un écran s'affiche : le filet de secours d'index.html n'a plus à intervenir.
    window.__orbiteUp = true;
    // Les grands écrans s'allument et s'éteignent comme les consoles d'ARECIBO.
    const PANELS = ['market', 'creation', 'multi', 'profile', 'colony', 'explore', 'system'];
    if (ui.screen === 'menu' && PANELS.includes(name)) SFX.on();
    else if (name === 'menu' && PANELS.includes(ui.screen)) SFX.off();
    ui.screen = name;
    stage.starsOn = !['splash', 'title', 'wake', 'cStory'].includes(name);
    SFX.ambience({ splash: 'off', title: 'off', wake: 'wake', game: 'game', end: 'end', cStory: 'wake', genese: 'wake', essaim: 'wake', coeur: 'wake', sculpture: 'wake', cFight: 'battle', cEnd: 'game', multi: 'ship', creation: 'atelier', colony: 'atelier', explore: 'atelier', system: 'atelier' }[name] || 'menu');
    SFX.music(['title', 'wake', 'menu', 'market', 'creation', 'colony', 'explore', 'genese', 'essaim', 'coeur', 'sculpture', 'multi', 'profile', 'laws', 'cMap', 'system'].includes(name));
    // Pendant la partie, le ciel s'efface derrière les planètes pour rester lisible.
    const busySky = ['laws', 'game', 'end', 'cFight'].includes(name);
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
    C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
    F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
    G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
    H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
    J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
    X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
    Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
    Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
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
      const g = GLYPHS[ch] || GLYPHS[ch.normalize('NFD')[0]] || GLYPHS[' '];
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
    // o.onChar : appelé à chaque lettre ; o.stop() : vrai quand le joueur passe la scène.
    const stop = () => o.stop && o.stop();
    for (const ch of text) {
      if (stop()) break;
      span.textContent += ch;
      if (ch !== ' ') { SFX.type(); if (o.onChar) o.onChar(ch); }
      await wait(ch === ',' || ch === '.' || ch === '…' ? 320 : o.speed || 60);
    }
    if (stop()) { el.innerHTML = ''; return; }
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

  // Le réveil : une entité numérique faite de caractères nous parle, puis s'effondre et explose en
  // big bang numérique ; les caractères retombent en planète (js/eveil.js). Toucher l'écran passe.
  async function wakeScreen() {
    await show('wake');
    const fx = window.OrbiteEveil ? window.OrbiteEveil.start($('wakeCanvas')) : null;
    const run = { off: false, t0: performance.now(), wake: null };
    const pause = (ms) => (run.off ? Promise.resolve() : new Promise((r) => { const id = setTimeout(r, ms); run.wake = () => { clearTimeout(id); r(); }; }));
    const skip = () => {
      if (run.off || performance.now() - run.t0 < 1500) return;
      run.off = true;
      if (run.wake) run.wake();
      if (fx) fx.cut();
    };
    $('wake').addEventListener('pointerdown', skip);
    const say = (text, o) => (run.off ? null : typeLine($('wakeLine'), text, Object.assign({ stop: () => run.off }, o)));
    try {
      await pause(500);
      if (fx && !run.off) await fx.appear();
      await pause(500);
      await say(tr('Réveillez-vous. Bonjour, créateur.'), { hold: 1500, speed: 70, onChar: () => fx && fx.speak() });
      if (fx && !run.off) {
        SFX.charge();
        await fx.implode();
        if (!run.off) { SFX.explode(); vibrate([30, 40, 60]); }
        if (!run.off) await fx.bang();
        if (!run.off) await fx.form();
        await pause(300);
        await say(tr('Vous venez de créer un monde.'), { hold: 1600, speed: 65 });
      }
      await pause(200);
    } finally {
      $('wake').removeEventListener('pointerdown', skip);
      $('wakeLine').innerHTML = '';
      if (fx) { await fx.fadeOut(run.off ? 300 : 900); fx.stop(); }
    }
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
    if (back) { addDust(back); setTimeout(() => toast(tr('Horizons remboursés : +{n} poussières d’étoiles.', { n: back }), 3600), 9000); }
  })();

  function layoutMenu() {
    const W = viewW(), H = viewH();
    // L'horizon remonte si besoin pour que tous les boutons du menu tiennent sous lui.
    // Place réservée au dépliage de « Jouer solo » (une ligne de plus).
    const listH = ($('menuList').offsetHeight || 260) + 52;
    const horizon = Math.round(Math.min(H * (W > H ? 0.66 : 0.6), H - listH - 100));
    const R = Math.round(Math.min(W * 0.82, H * 0.6));
    const cy = horizon + R * 0.3;
    const pl = $('menuPlanet');
    pl.style.width = pl.style.height = 2 * R + 'px';
    pl.style.left = W / 2 - R + 'px';
    pl.style.top = cy - R + 'px';
    // La toile 3D compte en pixels réels : l'horizon (en pixels virtuels) suit le zoom du PC.
    pl.dataset.clip = (horizon + 5) * ui.z;
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
    $('menuList').style.top = horizon + Math.max(14, Math.min((H - horizon) * 0.12, H - horizon - listH - 76)) + 'px';
  }

  // ─── Lecteur de musique du menu (v89) ───────────────────────
  // Des icônes en pixels, comme le reste du jeu.
  const pixIcon = (rows) => `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${rows.map((r, y) => [...r].map((c, x) => (c === '1' ? `<rect x="${x}" y="${y}" width="1" height="1"/>` : '')).join('')).join('')}</svg>`;
  const MUS_ICONS = {
    prev: ['0011', '0110', '1100', '0110', '0011'],
    next: ['1100', '0110', '0011', '0110', '1100'],
    play: ['1000', '1100', '1110', '1100', '1000'],
    pause: ['11011', '11011', '11011', '11011', '11011']
  };
  function renderMusicBar() {
    const bar = $('musicBar');
    if (!bar) return;
    const on = SFX.musicPlaying;
    bar.classList.toggle('on', on);
    bar.innerHTML = `<button class="mus-btn" data-mus="prev" aria-label="${tr('Morceau précédent')}">${pixIcon(MUS_ICONS.prev)}</button>
      <button class="mus-btn mus-play" data-mus="play" aria-label="${on ? tr('Pause') : tr('Lecture')}">${pixIcon(on ? MUS_ICONS.pause : MUS_ICONS.play)}</button>
      <span class="mus-name"><i class="mus-eq"><i></i><i></i><i></i></i>${esc(SFX.trackName)}</span>
      <button class="mus-btn" data-mus="next" aria-label="${tr('Morceau suivant')}">${pixIcon(MUS_ICONS.next)}</button>`;
  }
  listen('musicBar', 'click', (e) => {
    const b = e.target.closest('[data-mus]');
    if (!b) return;
    const k = b.dataset.mus;
    if (k === 'prev' || k === 'next') { SFX.skip(k === 'prev' ? -1 : 1); if (!SFX.musicPlaying) SFX.tap(); }
    else if (SFX.musicPlaying) SFX.setMusicOn(false);
    else {
      // Lecture : on rallume le son s'il était coupé, et la musique à mi-volume si elle était à zéro.
      if (SFX.muted) SFX.setMuted(false);
      if (SFX.musicVol === 0) SFX.setMusicVol(0.6);
      else SFX.setMusicOn(true);
    }
    renderMusicBar();
  });
  window.addEventListener('orbite-music', renderMusicBar);

  function renderMenu() {
    renderMusicBar();
    if (window.OrbiteMissions && window.OrbiteMissions.renderBox) window.OrbiteMissions.renderBox();
    applyFrame($('profileBtn'), myFrame());
    const pfa = document.querySelector('#profileBtn .pf-avatar');
    if (pfa) pfa.dataset.planet = myAvatar() || 'world-mini';
    $('menuDust').innerHTML = icon('dust') + ' ' + dust();
    if (typeof renderCreationBtn === 'function') renderCreationBtn();
    const lv = levelInfo(xpTotal());
    $('pfName').innerHTML = nameHtml(pseudo(), myFont());
    $('pfLvl').innerHTML = `${tr('NIV. {n}', { n: lv.lvl })}<i class="xp-mini"><i style="width:${(lv.rest / lv.need * 100).toFixed(1)}%"></i></i>`;
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
      stage.burst(x, (ui.horizon + 2) * ui.z, { n: 1, colors: [[210, 235, 255], [255, 255, 255]], speed: 4, up: 14 + Math.random() * 10, drag: 0.2, life: 2.6 + Math.random() * 2, size: 1 });
      if (++n % 34 === 0) {
        const y0 = window.innerHeight * (0.05 + Math.random() * 0.2);
        const x0 = W * (Math.random() * 0.5);
        stage.beam([x0, y0], [x0 + W * 0.45, y0 + window.innerHeight * 0.12], { ms: 750, arc: 0, tail: 14, head: 1, color: [210, 225, 255] });
      }
    }, 240);
  }
  function stopAmbient() { if (ambient) clearInterval(ambient); ambient = null; }

  async function enterMenu(first) {
    // Au menu, aucune action de partie n'est en cours (une partie en ligne coupée en plein combat
    // ne doit pas bloquer les boutons des Paramètres).
    ui.busy = false;
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
      await typeLine($('menuLine'), tr('Voilà votre terrain de jeu.'), { hold: 1700, speed: 65 });
      store.set(WAKE_KEY, '1');
    } else {
      await wait(900);
    }
    $('menuWord').parentElement.classList.remove('menu-fade');
    // Les boutons de la page visible s'allument un à un ; ceux des autres pages sont prêts d'emblée.
    const items = [...document.querySelectorAll('#menuList .menu-page.on .menu-item')];
    document.querySelectorAll('.menu-item').forEach((b) => { if (!items.includes(b)) b.classList.add('show'); });
    for (const b of items) { b.classList.add('show'); await wait(120); }
    if (needTuto() && ui.screen === 'menu') {
      // Le guide du menu attend la fin du duel d'entraînement : d'abord, JOUER.
      await wait(500);
      if (ui.screen === 'menu' && !coach.steps) coachStart(TUTO_INVITE);
    } else if (store.get(MENU_GUIDE_KEY, '') !== '1' && ui.screen === 'menu') {
      await wait(500);
      if (ui.screen === 'menu' && !coach.steps) coachStart(menuSteps(), () => store.set(MENU_GUIDE_KEY, '1'));
    }
  }

  async function backToMenu() {
    ui.busy = false;
    renderMenu();
    applyWorld();
    layoutMenu();
    await show('menu');
    $('menuWord').parentElement.classList.remove('menu-fade');
    $('menuGround').style.opacity = 1;
    document.querySelectorAll('.menu-item').forEach((b) => b.classList.add('show'));
    startAmbient();
  }

  // Numéro de version visible au lancement (écran-titre) et en bas du menu.
  $('titleVersion').textContent = tr('VERSION {n}', { n: VERSION_LABEL });
  $('menuFoot').textContent = 'STUDIO EDDA · ' + tr('VERSION {n}', { n: VERSION_LABEL });

  // ─── Reprise rapide ─────────────────────────────────────────
  // Sur iPhone, une appli web installée est souvent fermée par le système quand on passe à une
  // autre appli. On note l'écran ouvert et on sauvegarde tout en quittant ; si le jeu redémarre
  // dans la demi-heure, il reprend directement là où l'on était, sans l'introduction.
  const SESSION_KEY = 'orbite.session';
  const RESUME_MS = 30 * 60 * 1000;
  function rememberScreen(name) {
    if (['splash', 'title', 'wake'].includes(name)) return;
    store.set(SESSION_KEY, JSON.stringify({ s: name, t: Date.now() }));
  }
  function saveAll() {
    if (ui.state && ui.screen === 'game') saveGame();
    const camp = window.__orbite && window.__orbite.campagne;
    if (camp && camp.run) camp.save();
    if (ui.screen && !['splash', 'title', 'wake'].includes(ui.screen)) rememberScreen(ui.screen);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveAll(); });
  window.addEventListener('pagehide', saveAll);

  // Invitation d'un ami : le lien …/orbite/#rejoindre=CODE ouvre le Multijoueur sur ce code, qui se
  // rejoint seul une fois connecté. Le code attend dans la session (la connexion Google peut
  // recharger la page) jusqu'à ce que le Multijoueur le prenne.
  const INVITE_KEY = 'orbite.invite';
  function readInvite() {
    const m = /[#&]rejoindre=([A-Za-z0-9]{6})\b/.exec(location.hash);
    if (!m) return;
    try { sessionStorage.setItem(INVITE_KEY, m[1].toUpperCase()); } catch (err) { /* stockage indisponible */ }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* sans importance */ }
  }
  readInvite();
  function openInvite() {
    let code = null;
    try { code = sessionStorage.getItem(INVITE_KEY); } catch (err) { /* stockage indisponible */ }
    if (code && ui.screen === 'menu' && window.OrbiteMultiUI) { stopAmbient(); window.OrbiteMultiUI.open({ code }); }
  }
  window.addEventListener('hashchange', () => { readInvite(); if (!ui.busy) openInvite(); });

  async function quickResume() {
    let ses = null;
    try { ses = JSON.parse(store.get(SESSION_KEY, 'null')); } catch (err) { /* illisible */ }
    if (!ses || Date.now() - ses.t > RESUME_MS || store.get(WAKE_KEY, '') !== '1') return false;
    const fin = loadFinished();
    if (fin) { ui.state = fin; await endScreen(); return true; }
    if (ses.s === 'game' && loadGame()) { await resumeGame(); return true; }
    // Campagne bloquée pendant sa refonte : on ne la reprend plus au lancement.
    await backToMenu();
    return true;
  }

  async function boot(full) {
    try {
      // Attend que tous les scripts (dont la Campagne) soient chargés avant de reprendre.
      if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
      if (!full && await quickResume()) { openInvite(); return; }
      await splash();
      await titleScreen();
      const first = store.get(WAKE_KEY, '') !== '1';
      if (first) await wakeScreen();
      await enterMenu(first);
      // Une partie terminée pendant que l'appli était fermée : ses récompenses attendent.
      const fin = loadFinished();
      if (fin && ui.screen === 'menu') { ui.state = fin; await endScreen(); }
      openInvite();
    } catch (err) {
      console.error(err);
      try { await enterMenu(false); } catch (err2) {
        // Même le menu ne s'ouvre pas : l'écran de secours propose de réparer.
        console.error(err2);
        if (window.__orbiteRescue) window.__orbiteRescue(err2);
      }
    }
  }

  // ─── Marché stellaire ───────────────────────────────────────
  function renderMarket() {
    const list = worldList(), lvl = levelInfo(xpTotal()).lvl;
    const nxt = W.next(list);
    $('marketBack').innerHTML = icon('back');
    $('marketDust').innerHTML = wallet();
    $('mkStage').textContent = W.stageName(list).toUpperCase();
    $('mkProg').style.width = (list.length / W.UPGRADES.length * 100) + '%';
    $('mkCount').textContent = tr('{a} / {b} améliorations · niveau {n}', { a: list.length, b: W.UPGRADES.length, n: lvl });
    if (!nxt) {
      $('mkNext').innerHTML = tr('<b>Votre planète est pleinement vivante.</b><p>Elle tourne désormais au-dessus du menu comme une nouvelle Terre.</p>');
    } else {
      const st = W.STAGES[nxt.stage];
      const why = lvl < nxt.lvl ? tr('Atteignez le niveau {n}.', { n: nxt.lvl }) : dust() < nxt.price ? tr('Il vous manque {n} poussières d’étoiles.', { n: nxt.price - dust() }) : '';
      $('mkNext').innerHTML = `<span class="mk-kicker">${tr('PROCHAINE ÉTAPE')} · ${st.name.toUpperCase()}</span>
        <b>${esc(nxt.name)}</b><p>${esc(nxt.text)}</p>
        <div class="mk-req"><span>${tr('NIVEAU {n}', { n: nxt.lvl })}</span><span>${icon('dust')} ${nxt.price}</span></div>
        <button class="btn primary" data-up="${nxt.id}" ${why ? 'disabled' : ''}>${tr('FAIRE RENAÎTRE')} · ${icon('dust')} ${nxt.price}</button>
        ${why ? `<small>${why}</small>` : ''}`;
    }
    // Chaque ère a sa couleur : lave, eau, vie, lumière des villes. Un carré pixel plein marque ce
    // qui est fait, un carré qui clignote la prochaine étape, un carré vide le reste.
    const ERA = ['#ff8a3d', '#5fb8ff', '#8fdc6e', '#f6c453'];
    $('mkList').innerHTML = W.STAGES.map((st, i) => `<h4 style="--era:${ERA[i]}">${st.name.toUpperCase()}<small>${esc(st.text)}</small>${st.id === 'civil' ? `<small class="mk-unlock">${tr('Ouvre la Création au menu.')}</small>` : ''}</h4>` +
      W.UPGRADES.filter((u) => u.stage === i).map((u) => {
        const has = list.includes(u.id), isNext = nxt && nxt.id === u.id;
        return `<div class="mk-row ${has ? 'owned' : isNext ? 'next' : lvl < u.lvl ? 'locked' : ''}" style="--era:${ERA[u.stage]}">
          <i class="mk-pip"></i><span>${esc(u.name)}</span><small>${has ? tr('FAIT') : `${tr('NIV. {n}', { n: u.lvl })} · ${u.price}`}</small></div>`;
      }).join('')).join('');
  }

  listen('mkNext', 'click', async (e) => {
    const b = e.target.closest('[data-up]');
    if (!b || b.disabled || ui.busy) return;
    const u = W.BY_ID[b.dataset.up], list = worldList();
    if (list.includes(u.id) || W.next(list) !== u) return;
    if (levelInfo(xpTotal()).lvl < u.lvl) { refuse(tr('Atteignez le niveau {n}.', { n: u.lvl })); return; }
    if (dust() < u.price) { refuse(tr('Il vous manque {n} poussières d’étoiles.', { n: u.price - dust() })); return; }
    ui.busy = true;
    const wasCivil = W.civil(list);
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
    // Arrivée à la civilisation verte : la Création apparaît au menu.
    if (!wasCivil && W.civil(list)) toast(tr('La Création est ouverte : bâtissez votre civilisation depuis le menu.'), 4200);
    else toast(tr('{name} : {text}', { name: u.name, text: u.text }), 3200);
    ui.busy = false;
  });


  // ─── Cosmétiques : fonds animés de partie ────────────────────
  const COS_KEY = 'orbite.cosmetiques';
  // Prix d'un cosmétique : 2 000 poussières, ou en graines de vie 25 pour un fond animé, 15 pour
  // un cadre de profil (v91) et 10 pour une police de pseudo (v96).
  const COS_PRICE = 2000;
  const SKY_SEEDS = 25, FRAME_SEEDS = 15, FONT_SEEDS = 10;
  const seedPrice = (k) => (k.seeds ? k.seeds : k.frame ? FRAME_SEEDS : k.font ? FONT_SEEDS : SKY_SEEDS);
  // Les cadres premium (v100) coûtent plus cher en poussières aussi.
  const dustPrice = (k) => k.dust || COS_PRICE;
  const SKIES = [
    { id: 'nebuleuse', mode: 1, name: tr('Nébuleuse pourpre'), text: tr('Des nuages roses et violets traversés de filaments sombres, autour d’un cœur brûlant.'), c: ['#c2457f', '#2a0a3c'] },
    { id: 'aurore', mode: 2, name: tr('Aurore boréale'), text: tr('Des voiles verts et roses dansent au-dessus des montagnes et se reflètent dans un lac.'), c: ['#2fd18a', '#071a22'] },
    { id: 'galaxie', mode: 3, name: tr('Galaxie spirale'), text: tr('Une galaxie tourne lentement, son cœur doré au milieu de bras bleus et roses.'), c: ['#e8c48a', '#2a3e9e'] },
    { id: 'filantes', mode: 4, name: tr('Voie lactée'), text: tr('La voie lactée traverse le ciel ; des étoiles filantes jaillissent d’un même point.'), c: ['#c9b08a', '#0b1030'] },
    { id: 'abysse', mode: 5, name: tr('Trou noir'), text: tr('Un disque d’accrétion brûlant s’enroule autour de l’horizon, la lumière se courbe.'), c: ['#ffd38a', '#2a0c02'] },
    { id: 'piliers', mode: 6, name: tr('Piliers de la création'), text: tr('Des colonnes de gaz sombre aux bords embrasés, dans un ciel d’or et de turquoise.'), c: ['#e8a44a', '#0f4a50'] }
  ];
  const SKY_BY_ID = Object.fromEntries(SKIES.map((k) => [k.id, k]));
  // Cadres de profil (v90) : un contour animé et des rivets en pixels autour de l'avatar et du nom,
  // au menu, au profil, et chez vos amis (publié dans forge.frame du profil public, js/online.js).
  const FRAMES = [
    { id: 'cadre-or', frame: true, name: tr('Couronne d’or'), text: tr('Un cadre doré qui scintille, avec ses rivets en pixels.') },
    { id: 'cadre-aurore', frame: true, name: tr('Aurore'), text: tr('Les couleurs d’une aurore boréale glissent tout autour.') },
    { id: 'cadre-braise', frame: true, name: tr('Braises'), text: tr('Un cadre de feu qui crépite et rougeoie.') },
    { id: 'cadre-givre', frame: true, name: tr('Givre'), text: tr('Un cadre de glace bleue, nimbé de froid.') },
    { id: 'cadre-neant', frame: true, name: tr('Néant'), text: tr('Une ombre violette qui respire autour de vous.') },
    { id: 'cadre-cosmos', frame: true, name: tr('Cosmos'), text: tr('Toutes les couleurs de l’univers, qui tournent sans fin.') },
    // Cadres premium (v100) : des particules en pixels tout autour, plus chers.
    { id: 'cadre-p-feu', frame: true, premium: true, dust: 6000, seeds: 40, name: tr('Flammes éternelles'), text: tr('Des braises montent sans fin autour de vous.') },
    { id: 'cadre-p-brume', frame: true, premium: true, dust: 6000, seeds: 40, name: tr('Brume'), text: tr('Une brume pâle qui dérive lentement.') },
    { id: 'cadre-p-orage', frame: true, premium: true, dust: 6000, seeds: 40, name: tr('Orage'), text: tr('Des éclairs crépitent tout autour.') },
    { id: 'cadre-p-etoiles', frame: true, premium: true, dust: 6000, seeds: 40, name: tr('Pluie d’étoiles'), text: tr('Des étoiles qui scintillent et tombent doucement.') }
  ];
  const FRAME_BY_ID = Object.fromEntries(FRAMES.map((k) => [k.id, k]));
  // Photos de profil (v92) : des astres achetés en graines de vie, de 5 à 650. Sans photo, l'avatar
  // est votre planète. Publiée dans forge.avatar du profil public, comme le cadre.
  const AVATARS = [
    { id: 'av-asteroide', avatar: true, seeds: 5, name: tr('Astéroïde'), look: { type: 'asteroid', seed: 6101 } },
    { id: 'av-lune', avatar: true, seeds: 10, name: tr('Lune grise'), look: { type: 'moon', seed: 6102 } },
    { id: 'av-desert', avatar: true, seeds: 20, name: tr('Planète désertique'), look: { type: 'desert', seed: 6103, moons: 1 } },
    { id: 'av-tellurique', avatar: true, seeds: 30, name: tr('Monde tellurique'), look: { type: 'terran', seed: 6104 } },
    { id: 'av-ocean', avatar: true, seeds: 50, name: tr('Monde océan'), look: { type: 'ocean', seed: 6105 } },
    { id: 'av-glace', avatar: true, seeds: 75, name: tr('Monde de glace'), look: { type: 'ice', seed: 6106, ring: true } },
    { id: 'av-gazeuse', avatar: true, seeds: 110, name: tr('Géante gazeuse'), look: { type: 'gas', seed: 6107, ring: true, moons: 1 } },
    { id: 'av-lave', avatar: true, seeds: 160, name: tr('Monde de lave'), look: { type: 'lava', seed: 6108 } },
    { id: 'av-terre', avatar: true, seeds: 230, name: tr('Monde habitable'), look: { type: 'earth', seed: 6109, moons: 1 } },
    { id: 'av-cristal', avatar: true, seeds: 320, name: tr('Monde cristallin'), look: { type: 'crystal', seed: 6110, ring: true } },
    { id: 'av-etoile', avatar: true, seeds: 450, name: tr('Géante bleue'), look: { type: 'star', seed: 6111, starClass: 'géante bleue' } },
    { id: 'av-eclipse', avatar: true, seeds: 550, name: tr('Éclipse'), look: { type: 'eclipse', seed: 6112 } },
    { id: 'av-trou-noir', avatar: true, seeds: 650, name: tr('Trou noir'), look: { type: 'blackhole', seed: 6113 } }
  ];
  const AVATAR_BY_ID = Object.fromEntries(AVATARS.map((k) => [k.id, k]));
  // Compact : anneaux et disques restent près de l'astre, qui tient dans un petit avatar.
  for (const a of AVATARS) stage.register(a.id, a.look);
  const myAvatar = () => { const a = cosmetics().avatar; return AVATAR_BY_ID[a] ? a : ''; };
  const avatarOf = (p) => { const a = p && p.forge && p.forge.avatar; return AVATAR_BY_ID[a] ? a : ''; };
  // Polices du pseudo (v96) : des polices pixel (css/fonts.css), au menu, au profil, en partie, et
  // chez les autres joueurs (forge.font du profil public, et la place de chacun au salon en ligne).
  const FONTS = [
    { id: 'arcade', font: true, name: tr('Arcade'), text: tr('Les grosses lettres carrées des bornes d’arcade.') },
    { id: 'terminal', font: true, name: tr('Terminal'), text: tr('Un vieil écran vert de console.') },
    { id: 'serigraphie', font: true, name: tr('Sérigraphie'), text: tr('Des capitales nettes et serrées.') },
    { id: 'pixel', font: true, name: tr('Pixel'), text: tr('Des lettres rondes, en gros pixels.') },
    { id: 'stade', font: true, name: tr('Stade'), text: tr('Comme un nom floqué sur un maillot.') },
    { id: 'mini', font: true, name: tr('Minuscule'), text: tr('De petits pixels bien alignés.') },
    { id: 'matrice', font: true, name: tr('Matrice'), text: tr('Des points lumineux, comme un panneau d’affichage.') },
    { id: 'cathode', font: true, name: tr('Cathodique'), text: tr('Les lignes d’un écran à tube.') }
  ];
  const FONT_BY_ID = Object.fromEntries(FONTS.map((k) => [k.id, k]));
  const myFont = () => { const f = cosmetics().font; return FONT_BY_ID[f] ? f : ''; };
  const fontOf = (p) => { const f = p && p.forge && p.forge.font; return FONT_BY_ID[f] ? f : ''; };
  // Un pseudo dans sa police ; texte échappé, sans police : le texte seul.
  const nameHtml = (name, f) => (FONT_BY_ID[f] ? `<span class="nf" data-nf="${f}">${esc(name)}</span>` : esc(name));
  const cosItem = (id) => SKY_BY_ID[id] || FRAME_BY_ID[id] || AVATAR_BY_ID[id] || FONT_BY_ID[id] || null;
  // Le cadre porté par un joueur (le nôtre, ou celui du profil public d'un ami) ; '' sans cadre.
  const myFrame = () => { const f = cosmetics().frame; return FRAME_BY_ID[f] ? f : ''; };
  const frameOf = (p) => { const f = p && p.forge && p.forge.frame; return FRAME_BY_ID[f] ? f : ''; };
  // Un avatar entouré du cadre (span.pfw), pour les listes d'amis et le classement.
  const framed = (inner, f) => (f ? `<span class="pfw pframe" data-frame="${f}">${inner}</span>` : inner);
  function applyFrame(el, f) {
    if (!el) return;
    el.classList.toggle('pframe', !!f);
    if (f) el.dataset.frame = f; else delete el.dataset.frame;
  }
  function cosmetics() {
    try { const c = JSON.parse(store.get(COS_KEY, '')); if (c && Array.isArray(c.owned)) return c; } catch (err) { /* aucun achat */ }
    return { owned: [], on: '' };
  }
  function saveCosmetics(c) { store.set(COS_KEY, JSON.stringify(c)); }
  const equippedSky = () => { const c = cosmetics(); return SKY_BY_ID[c.on] ? SKY_BY_ID[c.on].mode : 0; };

  function renderCosmetics() {
    const c = cosmetics();
    const buyBtn = (k) => `<span class="cos-buy"><button class="btn primary" data-cos-buy="${k.id}" ${dust() < dustPrice(k) ? 'disabled' : ''}>${icon('dust')} ${dustPrice(k)}</button><button class="btn" data-cos-buy="${k.id}" data-seed="1" ${seeds() < seedPrice(k) ? 'disabled' : ''}>${icon('seed', 'seed')} ${seedPrice(k)}</button></span>`;
    // Un cadre : aperçu sur une petite planète, puis acheter, équiper, ou « équipé ».
    const frameRow = (k) => {
      const owned = !k.id || c.owned.includes(k.id), on = (c.frame || '') === (k.id || '');
      const btn = on ? `<span class="cos-on">${tr('ÉQUIPÉ')}</span>` : owned ? `<button class="btn" data-cos-equip="${k.id || ''}" data-kind="frame">${tr('ÉQUIPER')}</button>` : buyBtn(k);
      return `<div class="cos-row cos-frame-row ${k.premium ? 'premium' : ''}">
        <span class="cos-fr"><i class="${k.id ? 'pframe' : ''}" ${k.id ? `data-frame="${k.id}"` : ''}></i></span>
        <span class="cos-txt"><b>${esc(k.name)}${k.premium ? ` <em class="cos-prem">${tr('PREMIUM')}</em>` : ''}</b><small>${esc(k.text)}</small></span>${btn}</div>`;
    };
    // Une photo de profil : l'astre lui-même, puis acheter (graines), équiper, ou « équipé ».
    const avatarRow = (k) => {
      const owned = !k.id || c.owned.includes(k.id), on = (c.avatar || '') === (k.id || '');
      const btn = on ? `<span class="cos-on">${tr('ÉQUIPÉ')}</span>` : owned ? `<button class="btn" data-cos-equip="${k.id || ''}" data-kind="avatar">${tr('ÉQUIPER')}</button>`
        : `<span class="cos-buy"><button class="btn primary" data-cos-buy="${k.id}" data-seed="1" ${seeds() < k.seeds ? 'disabled' : ''}>${icon('seed', 'seed')} ${k.seeds}</button></span>`;
      return `<div class="cos-row cos-avatar-row ${k.seeds >= 450 ? 'rare' : ''}">
        <span class="cos-av"><span class="orb" data-planet="${k.id || 'world-mini'}"></span></span>
        <span class="cos-txt"><b>${esc(k.name)}</b>${k.id ? '' : `<small>${tr('Votre planète, celle du Marché stellaire.')}</small>`}</span>${btn}</div>`;
    };
    // Une police : votre pseudo écrit avec elle, puis acheter, équiper, ou « équipé ».
    const fontRow = (k) => {
      const owned = !k.id || c.owned.includes(k.id), on = (c.font || '') === (k.id || '');
      const btn = on ? `<span class="cos-on">${tr('ÉQUIPÉ')}</span>` : owned ? `<button class="btn" data-cos-equip="${k.id || ''}" data-kind="font">${tr('ÉQUIPER')}</button>` : buyBtn(k);
      return `<div class="cos-row cos-font-row">
        <span class="cos-txt"><b class="cos-font-name">${nameHtml(pseudo(), k.id)}</b><small>${esc(k.name)} · ${esc(k.text)}</small></span>${btn}</div>`;
    };
    const row = (k) => {
      const owned = !k.id || c.owned.includes(k.id), on = (c.on || '') === (k.id || ''), sel = ui.cosPick === (k.id || '');
      let btn;
      if (on) btn = `<span class="cos-on">${tr('ÉQUIPÉ')}</span>`;
      else if (owned) btn = `<button class="btn" data-cos-equip="${k.id || ''}">${tr('ÉQUIPER')}</button>`;
      else btn = buyBtn(k);
      const sw = k.id ? `background:radial-gradient(circle at 30% 35%, ${k.c[0]}, transparent 70%), radial-gradient(circle at 75% 70%, ${k.c[1]}, #000 80%)` : 'background:#000';
      return `<div class="cos-row ${sel ? 'sel' : ''}" data-cos="${k.id || ''}">
        <span class="cos-sw" style="${sw}"></span>
        <span class="cos-txt"><b>${esc(k.name)}</b><small>${esc(k.text)}</small></span>${btn}</div>`;
    };
    $('cosList').innerHTML = `<h4>${tr('FONDS ANIMÉS')}</h4>` + row({ id: '', name: tr('Noir'), text: tr('Le fond sobre d’origine.') }) + SKIES.map(row).join('') +
      `<h4>${tr('CADRES DE PROFIL')}</h4><p class="mk-note cos-note">${tr('Autour de votre avatar et de votre nom, au menu, au profil et chez vos amis.')}</p>` +
      frameRow({ id: '', name: tr('Sans cadre'), text: tr('Votre profil tel qu’au premier jour.') }) + FRAMES.map(frameRow).join('') +
      `<h4>${tr('PHOTOS DE PROFIL')}</h4><p class="mk-note cos-note">${tr('Un astre à la place de votre planète, au menu, au profil et chez vos amis. En graines de vie seulement.')}</p>` +
      avatarRow({ id: '', name: tr('Ma planète') }) + AVATARS.map(avatarRow).join('') +
      `<h4>${tr('POLICES DU PSEUDO')}</h4><p class="mk-note cos-note">${tr('Votre pseudo écrit en pixels, au menu, au profil, en partie, et chez les autres joueurs.')}</p>` +
      fontRow({ id: '', name: tr('Classique'), text: tr('La police du jeu.') }) + FONTS.map(fontRow).join('') +
      (dust() < COS_PRICE ? `<p class="mk-note">${tr('Vous avez {n} poussières d’étoiles. Un duel gagné ou un podium en rapporte.', { n: dust() })}</p>` : '');
  }
  // Aperçu de l'onglet Création : une planète détaillée qui change à chaque visite.
  stage.register('atelier-apercu', { type: 'terran', seed: (Date.now() % 100000) + 1, full: true, ring: true, moons: 1 });
  function marketTab(tab) {
    ui.mkTab = tab;
    for (const b of $('mkTabs').children) b.classList.toggle('on', b.dataset.tab === tab);
    for (const p of document.querySelectorAll('#market .mk-pane')) p.hidden = p.dataset.pane !== tab;
    if (tab === 'cosmetiques') { ui.cosPick = cosmetics().on || ''; renderCosmetics(); }
    if (tab === 'creation' && window.__orbite.forge) window.__orbite.forge.render();
    if (tab === 'graines') renderSeedShop();
    stage.sky = tab === 'cosmetiques' && SKY_BY_ID[ui.cosPick] ? SKY_BY_ID[ui.cosPick].mode : 0;
    stage.skyGain = 1;
  }
  // Boutique des graines de vie : vitrine, offre de bienvenue, quatre paquets illustrés (de la graine
  // à l'arbre), ce qu'elles permettent et comment en gagner.
  const SEED_ART_PAL = { d: '#2f7a3a', g: '#4fbf5f', l: '#9df0a8', w: '#e6ffe9', b: '#4a3220', B: '#7a5634', t: '#6b4426', y: '#ffe08a' };
  const SEED_STAMP = ['....ll', '...ll.', '.lgg..', 'lgwgd.', 'gggdd.', '.gdd..'];
  // Petites scènes 16 × 16 : chaque lettre est une couleur de SEED_ART_PAL.
  const SEED_ART = {
    graine: ['..........llll..', '.........lllll..', '........llwl....', '.......lll......', '.....llggg......', '...lggwwggg.....', '..lgwwgggggd....', '.lggwggggggdd...', '.lgggggggggddd..', '.ggggggggggddd..', '.gggggggggdddd..', '..gggggggdddd...', '...ggggdddddd...', '....dddddddd....', '......dddd......', ''],
    poignee: (() => {
      const g = Array.from({ length: 16 }, () => Array(16).fill('.'));
      for (const [ox, oy] of [[5, 3], [1, 9], [9, 9]]) SEED_STAMP.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') g[oy + y][ox + x] = c; }));
      return g.map((r) => r.join(''));
    })(),
    bourgeon: ['', '', '', '..ll........ll..', '.lggl......lggl.', '.lgwgl....lgwgl.', '..lgggl..lgggl..', '...ddggllggdd...', '.....ddggdd.....', '.......gg.......', '.......gd.......', '.......gd.......', '....bBBgdBBb....', '..bBBBBBBBBBBb..', '.bbbbbbbbbbbbbb.', ''],
    jardin: ['', '.......l........', '......lgl.......', '.....lgwgl......', '..l...lgl...l...', '.lgl...g...lgl..', 'lgwgl..g..lgwgl.', '.lgl...g...lgl..', '..g....gd...g...', '..g....gd...g...', '..gd...gd...gd..', '..gd...gd...gd..', 'bBgdBBBgdBBBgdBb', 'bBBBBBBBBBBBBBBb', 'bbbbbbbbbbbbbbbb', ''],
    foret: ['.....y..........', '......lllll...y.', '....llgwgggll...', '...lggggggggdl..', '..lgggglggggddl.', '..lggglllgggddl.', '.lggggggggggdddl', '.lgggggggggdddd.', '..dggggggggddd..', 'y..dddgttdddd...', '......ttt.....y.', '......ttt.......', '.....tttt.......', '...bBBtttBBb....', '.bBBBBBBBBBBBBb.', 'bbbbbbbbbbbbbbbb']
  };
  function seedArt(name, cls) {
    let rects = '';
    SEED_ART[name].forEach((row, y) => [...row].forEach((c, x) => { if (SEED_ART_PAL[c]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${SEED_ART_PAL[c]}"/>`; }));
    return `<svg class="seed-art ${cls || ''}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  const SEED_BASE = 0.099; // prix d'une graine dans le plus petit paquet, pour afficher la valeur des offres
  const SEED_STARTER = { n: 40, price: 1.99 };
  const SEED_PACKS = [
    { n: 10, price: 0.99, name: 'Poignée', art: 'poignee' },
    { n: 55, price: 4.99, name: 'Bourgeon', art: 'bourgeon', bonus: 10, badge: 'POPULAIRE' },
    { n: 120, price: 9.99, name: 'Jardin', art: 'jardin', bonus: 20 },
    { n: 260, price: 19.99, name: 'Forêt sacrée', art: 'foret', bonus: 30, badge: 'MEILLEURE OFFRE', best: true }
  ];
  const euro = (v) => v.toLocaleString(I18N.lang, { style: 'currency', currency: 'EUR' });
  function renderSeedShop() {
    const n = seeds();
    const starterValue = SEED_STARTER.n * SEED_BASE;
    $('seedShop').innerHTML = `
      <div class="seed-hero">
        <div class="seed-orb"><i class="seed-halo"></i>${[0, 1, 2, 3, 4, 5].map((i) => `<i class="seed-spark" style="--i:${i}"></i>`).join('')}${seedArt('graine', 'seed-hero-art')}</div>
        <b>${n}</b><small>${tr('graines de vie')}</small>
        <p>${tr('La sève de vos mondes : elle fait pousser, construire et voyager plus vite.')}</p>
      </div>
      <button class="seed-starter" data-pack="starter">
        <span class="seed-starter-tag">${tr('OFFRE DE BIENVENUE')} · ${tr('UNE SEULE FOIS')}</span>
        <span class="seed-starter-body">${seedArt('graine', 'seed-starter-ico')}
          <span class="seed-starter-txt"><b>${tr('{n} graines', { n: SEED_STARTER.n })}</b><small>${tr('Le double d’un paquet classique, pour bien démarrer.')}</small></span>
          <span class="seed-price"><s>${euro(starterValue)}</s>${euro(SEED_STARTER.price)}</span></span>
      </button>
      <div class="seed-packs">${SEED_PACKS.map((p, i) => `
        <button class="seed-pack ${p.best ? 'best' : ''}" data-pack="${i}" style="--d:${i * 70}ms">
          ${p.badge ? `<span class="seed-badge">${tr(p.badge)}</span>` : ''}
          ${p.bonus ? `<span class="seed-bonus">+${p.bonus} %</span>` : ''}
          <span class="seed-pack-art">${seedArt(p.art)}</span>
          <span class="seed-pack-name">${tr(p.name)}</span>
          <b>${icon('seed', 'seed')}${p.n}</b>
          <span class="seed-price">${euro(p.price)}</span>
        </button>`).join('')}</div>
      <h4 class="fg-h">${tr('EN GAGNER EN JOUANT')}</h4>
      <div class="seed-earn">
        <span><b>+1</b>${tr('par victoire')}</span><span><b>+2</b>${tr('tous les 5 niveaux')}</span>
        <span><b>+1</b>${tr('ruines anciennes')}</span><span><b>${window.OrbiteSucces ? window.OrbiteSucces.LIST.reduce((t, a) => t + a.seeds, 0) : 200}</b>${tr('dans les succès')}</span>
      </div>
      <p class="mk-note">${tr('Jamais pour être plus fort en partie : l’Affrontement reste équitable.')}</p>`;
  }
  listen('seedShop', 'click', (e) => {
    const b = e.target.closest('[data-pack]');
    if (!b) return;
    SFX.tap();
    const r = b.getBoundingClientRect();
    stage.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 34, colors: [[126, 224, 138], [190, 255, 200], [255, 236, 160]], speed: 70, up: 30, life: 0.9 });
    // Le paiement réel demande un prestataire (Stripe, Google Play) et un serveur qui crédite les
    // graines : tant qu'il n'est pas branché, la boutique l'annonce honnêtement.
    openSheet(`<h3>${tr('BOUTIQUE')}</h3><h2>${tr('Bientôt disponible')}</h2>
      <p class="sheet-text">${tr('L’achat de graines de vie arrive dans une prochaine version. En attendant, gagnez-en en jouant : victoires, niveaux, expéditions et succès.')}</p>
      <div class="sheet-actions"><button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
  });
  listen('mkTabs', 'click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b || b.classList.contains('on')) return;
    SFX.tap();
    marketTab(b.dataset.tab);
  });
  listen('cosList', 'click', (e) => {
    const buy = e.target.closest('[data-cos-buy]'), eq = e.target.closest('[data-cos-equip]'), row = e.target.closest('[data-cos]');
    const c = cosmetics();
    if (buy) {
      if (buy.disabled) return;
      const k = cosItem(buy.dataset.cosBuy);
      if (!k || c.owned.includes(k.id)) return;
      if (buy.dataset.seed) {
        if (seeds() < seedPrice(k)) { refuse(tr('Il vous manque {n} graines de vie.', { n: seedPrice(k) - seeds() })); return; }
        addSeeds(-seedPrice(k));
      } else if (k.avatar) {
        return;
      } else {
        if (dust() < dustPrice(k)) { refuse(tr('Il vous manque {n} poussières d’étoiles.', { n: dustPrice(k) - dust() })); return; }
        addDust(-dustPrice(k));
      }
      c.owned.push(k.id);
      if (k.avatar) c.avatar = k.id; else if (k.frame) c.frame = k.id; else if (k.font) c.font = k.id; else c.on = k.id;
      saveCosmetics(c);
      SFX.golden();
      const [x, y] = center(buy);
      stage.burst(x, y, { n: 40, colors: [[246, 196, 83], [255, 255, 255]], speed: 90, life: 0.8 });
      $('marketDust').innerHTML = wallet();
      toast(k.avatar ? tr('{name} : votre nouvelle photo de profil.', { name: k.name }) : k.frame ? tr('{name} : votre nouveau cadre.', { name: k.name })
        : k.font ? tr('{name} : la nouvelle police de votre pseudo.', { name: k.name }) : tr('{name} : équipé pour vos parties.', { name: k.name }), 2600);
      if (k.frame || k.avatar || k.font) { renderCosmetics(); $('marketDust').innerHTML = wallet(); return; }
    } else if (eq) {
      SFX.place();
      if (eq.dataset.kind === 'avatar') {
        c.avatar = eq.dataset.cosEquip;
        saveCosmetics(c);
        toast(c.avatar ? tr('{name} : équipé.', { name: AVATAR_BY_ID[c.avatar].name }) : tr('Votre planète redevient votre photo.'), 2000);
        renderCosmetics();
        return;
      }
      if (eq.dataset.kind === 'frame') {
        c.frame = eq.dataset.cosEquip;
        saveCosmetics(c);
        toast(c.frame ? tr('{name} : équipé.', { name: FRAME_BY_ID[c.frame].name }) : tr('Cadre retiré.'), 2000);
        renderCosmetics();
        return;
      }
      if (eq.dataset.kind === 'font') {
        c.font = eq.dataset.cosEquip;
        saveCosmetics(c);
        toast(c.font ? tr('{name} : équipé.', { name: FONT_BY_ID[c.font].name }) : tr('Votre pseudo reprend la police du jeu.'), 2000);
        renderCosmetics();
        return;
      }
      c.on = eq.dataset.cosEquip;
      saveCosmetics(c);
      toast(c.on ? tr('{name} : équipé.', { name: SKY_BY_ID[c.on].name }) : tr('Fond noir équipé.'), 2000);
    } else if (row) {
      SFX.tap();
    } else return;
    ui.cosPick = row ? row.dataset.cos : ui.cosPick;
    stage.sky = SKY_BY_ID[ui.cosPick] ? SKY_BY_ID[ui.cosPick].mode : 0;
    stage.skyGain = 1;
    renderCosmetics();
  });

  // ─── Profil ─────────────────────────────────────────────────
  const PSEUDO_KEY = 'orbite.pseudo', TAG_KEY = 'orbite.tag', STATS_KEY = 'orbite.stats', HIST_KEY = 'orbite.historique';
  const pseudo = () => store.get(PSEUDO_KEY, '') || tr('Créateur');
  function playerTag() {
    let t = store.get(TAG_KEY, '');
    if (!/^\d{4}$/.test(t)) {
      t = String(1000 + Math.floor(Math.random() * 9000));
      store.set(TAG_KEY, t);
    }
    return t;
  }
  // ─── Classé ─────────────────────────────────────────────────
  const K = window.OrbiteClassement;
  const CLASSE_KEY = 'orbite.classe';
  const classe = () => K.sanitize(readJson(CLASSE_KEY, null));
  function rankedLine(r) {
    if (!r) return '';
    if (r.placement && !r.done) return tr('CLASSÉ · placement {a} / {b}', { a: K.PLACEMENTS - r.left, b: K.PLACEMENTS });
    if (r.placement) return tr('CLASSÉ · placé en <b>{rank}</b>', { rank: esc(tierLabel(r.tier)) });
    const sign = r.delta >= 0 ? '+' : '';
    return `${tr('CLASSÉ')} · <b class="${r.delta >= 0 ? 'up' : 'down'}">${tr('{n} points', { n: sign + r.delta })}</b> · ${esc(tierLabel(r.tier))}${r.up ? ` · <b class="up">${tr('RANG SUPÉRIEUR !')}</b>` : r.down ? ' · ' + tr('rang inférieur') : ''}`;
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

  // Votre style (v102) : la famille la plus jouée, celle qui gagne le plus, et le combo gagnant.
  function styleHtml(st) {
    const fams = famStats(st), combos = st.combos || {};
    const best = (o, k) => Object.entries(o).filter(([, v]) => v[k] > 0).sort((a, b) => b[1][k] - a[1][k] || b[1].g - a[1].g || (a[0] < b[0] ? -1 : 1))[0];
    const chip = (f) => `<span class="fam-chip" style="--c:${famColor(f)}">${famName(f)}</span>`;
    const games = (n) => (n > 1 ? tr('{n} parties', { n }) : tr('{n} partie', { n }));
    const winsOf = (v) => (v.g <= 1 ? tr('{w} victoire sur {g} partie', { w: v.w, g: v.g }) : v.w <= 1 ? tr('{w} victoire sur {g} parties', { w: v.w, g: v.g }) : tr('{w} victoires sur {g} parties', { w: v.w, g: v.g }));
    const rows = [];
    const played = best(fams, 'g'), winner = best(fams, 'w');
    if (played) rows.push([tr('Famille la plus jouée'), chip(played[0]), games(played[1].g)]);
    if (winner) rows.push([tr('Famille qui gagne le plus'), chip(winner[0]), winsOf(winner[1])]);
    const cw = best(combos, 'w'), cg = cw || best(combos, 'g');
    if (cg) rows.push([cw ? tr('Combo le plus gagnant') : tr('Combo le plus joué'), cg[0].split('+').map(chip).join('<i class="pf-plus">+</i>'), cw ? winsOf(cg[1]) : games(cg[1].g)]);
    if (!rows.length) return '';
    return `<h3 class="pf-h">${tr('VOTRE STYLE')}</h3><div class="pf-style">${rows.map(([k, v, n]) => `<div><small>${k}</small><span>${v}</span><em>${n}</em></div>`).join('')}</div>`;
  }
  function renderProfile() {
    const st = stats(), lv = levelInfo(xpTotal()), list = worldList();
    const hist = readJson(HIST_KEY, []);
    // Podiums et rang moyen : ceux des mêlées (les duels ont leur propre ligne).
    const melee = st.games - (st.duels || 0);
    const pct = (n) => tr('{n} %', { n: melee ? Math.round(n / melee * 100) : 0 });
    const fav = Object.entries(st.laws).sort((a, b) => b[1] - a[1])[0];
    const tiles = [
      [tr('PARTIES'), st.games], [tr('VICTOIRES'), st.wins], [tr('DUELS GAGNÉS'), `${st.duelWins || 0} / ${st.duels || 0}`],
      [tr('PODIUMS'), pct(st.top3)], [tr('RANG MOYEN'), melee ? (st.rankSum / melee).toFixed(1) : '–'], [tr('COMBATS GAGNÉS'), st.fights],
      [tr('ASTRES DORÉS'), st.goldens], [tr('CYCLES JOUÉS'), st.cycles], [tr('POUSSIÈRES GAGNÉES'), st.dust]
    ];
    $('profileBack').innerHTML = icon('back');
    const tab = ui.pfTab || 'profil';
    $('profileBody').innerHTML = `
      <nav class="mk-tabs pf-tabs" role="tablist">${[['profil', tr('PROFIL')], ['succes', tr('SUCCÈS')], ['amis', tr('AMIS')], ['classement', tr('CLASSEMENT')]].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-pf="tab" data-tab="${k}" role="tab">${n}${k === 'amis' ? '<i class="pf-badge" id="pfBadge" hidden></i>' : ''}</button>`).join('')}</nav>
      <div class="pf-pane" data-pfpane="amis" id="pfFriends" ${tab === 'amis' ? '' : 'hidden'}></div>
      <div class="pf-pane" data-pfpane="classement" id="pfLeader" ${tab === 'classement' ? '' : 'hidden'}></div>
      <div class="pf-pane" data-pfpane="succes" id="pfSucces" ${tab === 'succes' ? '' : 'hidden'}></div>
      <div class="pf-pane" data-pfpane="profil" ${tab === 'profil' ? '' : 'hidden'}>
      <div id="pfOnline"></div>
      <div class="pf-id ${myFrame() ? 'pframe' : ''}" ${myFrame() ? `data-frame="${myFrame()}"` : ''}>
        <div class="orb pf-planet" data-planet="${myAvatar() || 'world-mini'}"></div>
        <div class="pf-who">
          <div class="pf-name-row" id="pfNameRow"><button class="pf-name" data-pf="rename">${nameHtml(pseudo(), myFont())}<span>#${playerTag()}</span></button></div>
          <span class="pf-lvl">${tr('NIVEAU {n}', { n: lv.lvl })} · ${esc(W.stageName(list))}</span>
          <div class="xp-bar"><i style="width:${(lv.rest / lv.need * 100).toFixed(1)}%"></i></div>
          <small>${tr('{a} / {b} XP vers le niveau {n}', { a: lv.rest, b: lv.need, n: lv.lvl + 1 })}</small>
        </div>
      </div>
      <h3 class="pf-h">${tr('CLASSÉ')}</h3>
      ${(() => {
        const c = classe();
        // Toucher la carte de rang déplie ou replie l'échelle des rangs et le barème.
        const fold = `<i class="pf-fold">${ui.pfRanks ? '▴' : '▾'}</i>`;
        if (!K.placed(c)) return `<button class="pf-rank" data-pf="ranks" aria-expanded="${!!ui.pfRanks}"><div class="pf-unranked">?</div><div><b>${tr('PLACEMENT · {a} / {b}', { a: c.placements.length, b: K.PLACEMENTS })}</b><small>${tr('Seules les parties classées en ligne (Multijoueur) comptent. Après {n} parties de placement, votre rang monte à chaque podium et descend dans les dernières places.', { n: K.PLACEMENTS })}</small></div>${fold}</button>`;
        const t = K.tierOf(c.points);
        return `<button class="pf-rank" data-pf="ranks" aria-expanded="${!!ui.pfRanks}"><div class="orb pf-rank-orb" data-planet="rank-${RANKS[t.idx].id}"></div><div><b>${esc(tierLabel(t)).toUpperCase()}</b><small>${tr('{n} points', { n: c.points })}${t.span ? ' · ' + tr('{a} / {b} vers la division suivante', { a: t.into, b: t.span }) : ''} · ${tr('record {n}', { n: c.best })}</small><div class="xp-bar"><i style="width:${t.span ? t.into : 100}%"></i></div></div>${fold}</button>`;
      })()}
      ${ui.pfRanks ? `<div class="pf-ladder">${RANKS.map((r, i) => `<div class="pf-tier ${K.placed(classe()) && K.tierOf(classe().points).idx === i ? 'on' : ''}"><div class="orb" data-planet="rank-${r.id}"></div><b>${tr(r.name)}</b><small>${i === RANKS.length - 1 ? tr('dès {n} points', { n: K.TIER_SPAN * (RANKS.length - 1) }) : 'III · II · I'}</small></div>`).join('')}</div>
      <p class="muted">${tr('Points par place : {list}, ajustés selon le niveau de la partie (plus de points en battant des créateurs mieux classés, moins de pertes contre eux).', { list: K.DELTA.map((d) => (d > 0 ? '+' : '') + d).join(' · ') })}</p>` : ''}
      <h3 class="pf-h">${tr('STATISTIQUES')}</h3>
      <div class="pf-stats">${tiles.map(([k, v]) => `<div><b>${v}</b><small>${k}</small></div>`).join('')}</div>
      ${fav ? `<p class="muted">${tr('Loi favorite :')} <span style="color:${famColor(R.LAW[fav[0]].fam)}">${esc(R.LAW[fav[0]].name)}</span> · ${fav[1] > 1 ? tr('{n} parties', { n: fav[1] }) : tr('{n} partie', { n: fav[1] })}</p>` : ''}
      ${styleHtml(st)}
      <h3 class="pf-h">${tr('DERNIÈRES PARTIES')}</h3>
      <div class="pf-hist">${hist.length ? hist.map((h) => `<div class="${(h.duel ? h.rank === 1 : h.rank <= 3) ? 'podium' : ''}"><b>${h.quit ? '–' : h.duel ? (h.rank === 1 ? tr('V') : tr('D')) : ordinal(h.rank)}</b><span style="color:${famColor(R.LAW[h.law] ? R.LAW[h.law].fam : 'neutre')}">${esc(R.LAW[h.law] ? R.LAW[h.law].name : '')}</span><small>${h.quit ? tr('abandon') : tr('{n} cycles', { n: h.cycles })} · ${new Date(h.t).toLocaleDateString(I18N.lang, { day: '2-digit', month: '2-digit' })}</small></div>`).join('') : `<p class="muted">${tr('Aucune partie terminée pour l’instant.')}</p>`}</div>
      </div>`;
    if (tab === 'succes' && window.OrbiteSucces) window.OrbiteSucces.render($('pfSucces'));
    if (window.__orbite.onlineUI) window.__orbite.onlineUI.renderProfile(tab);
  }

  listen('profileBody', 'click', (e) => {
    const b = e.target.closest('[data-pf]');
    if (!b) return;
    if (b.dataset.pf === 'tab') { SFX.tap(); ui.pfTab = b.dataset.tab; renderProfile(); return; }
    if (b.dataset.pf === 'ranks') { SFX.tap(); ui.pfRanks = !ui.pfRanks; renderProfile(); return; }
    if (b.dataset.pf === 'rename') {
      SFX.tap();
      $('pfNameRow').innerHTML = `<input class="pf-input" id="pfInput" maxlength="16" value="${esc(pseudo())}" aria-label="${tr('Pseudo')}" autocomplete="off"><button class="btn" data-pf="save">OK</button>`;
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
  // Le style d'une partie (v102) : la famille principale du système final (au moins 2 astres), et le
  // combo, ses deux familles principales (au moins 2 astres chacune).
  function styleOf(board) {
    const n = {};
    for (const u of board || []) { const f = R.CARD[u.id] ? R.famOf(u) : null; if (f && f !== 'neutre') n[f] = (n[f] || 0) + 1; }
    const top = Object.entries(n).filter((e) => e[1] >= 2).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    return { fam: top[0] ? top[0][0] : null, combo: top.length >= 2 ? [top[0][0], top[1][0]].sort().join('+') : null };
  }
  // Parties et victoires par famille principale ; avant la v102, on part des compteurs des succès
  // (parties avec une majorité d'une famille).
  function famStats(st) {
    if (st.fams) return st.fams;
    const c = readJson('orbite.succes.c', {}) || {}, o = {};
    for (const [f, g] of Object.entries(c.famGames || {})) if (R.FAMILIES[f]) o[f] = { g: g | 0, w: (c.famWins || {})[f] | 0 };
    return o;
  }
  function recordGame(s, rank, quit) {
    const st = stats();
    const p = s.players[0];
    const duel = R.isDuel(s);
    st.games++;
    const sty = styleOf(p.board), won = !quit && rank === 1;
    st.fams = famStats(st);
    st.combos = st.combos || {};
    for (const [o, k] of [[st.fams, sty.fam], [st.combos, sty.combo]]) {
      if (!k) continue;
      const e = o[k] || (o[k] = { g: 0, w: 0 });
      e.g++;
      if (won) e.w++;
    }
    if (duel) {
      // Les duels comptent dans les parties et les victoires ; rang moyen et podiums restent ceux
      // des mêlées.
      st.duels = (st.duels || 0) + 1;
      if (!quit && rank === 1) { st.wins++; st.duelWins = (st.duelWins || 0) + 1; }
    } else if (!quit) {
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
    hist.unshift({ rank, law: p.law, cycles: Math.max(1, p.deadRound || s.round || 1), t: Date.now(), quit: !!quit, duel, fam: sty.fam, combo: sty.combo });
    store.set(HIST_KEY, JSON.stringify(hist.slice(0, 15)));
    if (window.OrbiteSucces) window.OrbiteSucces.record(s, rank, quit);
    if (window.OrbiteMissions && window.OrbiteMissions.record) window.OrbiteMissions.record(s, rank, quit);
  }

  // ─── Paramètres ─────────────────────────────────────────────
  // Curseurs de volume : la musique, et les effets (sons du jeu et ambiance), de 0 à 100 %.
  function volumesHtml() {
    const row = (k, label, v) => {
      const p = Math.round(v * 100);
      return `<label class="vol"><span>${label}</span><input type="range" min="0" max="100" step="5" value="${p}" data-vol="${k}" style="--p:${p}%" aria-label="${label}"><b>${p} %</b></label>`;
    };
    return `<div class="vols">${row('music', tr('MUSIQUE'), SFX.musicOn ? SFX.musicVol : 0)}${row('fx', tr('EFFETS'), SFX.fxVol)}</div>`;
  }
  function settingsHtml() {
    return `<h3>${tr('PARAMÈTRES')}</h3><div class="menu-list-sheet">
      <button class="btn" data-act="set" data-v="sound">${SFX.muted ? tr('SON : COUPÉ') : tr('SON : ACTIVÉ')}</button>
      ${volumesHtml()}
      <button class="btn" data-act="set" data-v="lang">${tr('LANGUE : {lang}', { lang: I18N.LANGS.find((l) => l.id === I18N.lang).name.toUpperCase() })}</button>
      <button class="btn" data-act="set" data-v="tutos">${tr('TUTORIELS ET AIDE')}</button>
      ${installed() ? '' : `<button class="btn" data-act="set" data-v="install">${tr('INSTALLER SUR LE TÉLÉPHONE')}</button>`}
      <button class="btn" data-act="set" data-v="code">${tr('CODE CADEAU')}</button>
      <button class="btn" data-act="set" data-v="credits">${tr('CRÉDITS')}</button>
    </div><p class="muted">${tr('Poussières d’étoiles, niveau, planète et partie en cours restent sur cet appareil.')}</p>
    <p class="muted version">${tr('ORBITE · version {n}', { n: VERSION_LABEL })}</p>`;
  }

  // Langue du jeu : le choix est enregistré et le jeu redémarre dans la nouvelle langue.
  function langHtml() {
    return `<h3>${tr('LANGUE')}</h3><div class="menu-list-sheet">
      ${I18N.LANGS.map((l) => `<button class="btn ${l.id === I18N.lang ? 'primary' : ''}" data-act="set" data-v="lang:${l.id}">${l.name.toUpperCase()}</button>`).join('')}
    </div><div class="sheet-actions"><button class="btn" data-act="set" data-v="settings">${icon('back')} ${tr('PARAMÈTRES')}</button></div>`;
  }

  // Codes cadeaux : seule l'empreinte SHA-256 de chaque code est publiée ; chacun ne sert qu'une fois par appareil.
  const GIFTS = {
    '69c6a9d25df079588239c63c3a69003d4e26fc55ca5ea4d72977649b42944415': { id: 'test-10k', dust: 10000 }
  };
  const GIFT_KEY = 'orbite.cadeaux';
  function openCode() {
    openSheet(`<h3>${tr('CODE CADEAU')}</h3><p class="muted">${tr('Entrez un code pour recevoir sa récompense.')}</p>
      <input class="code-input" id="giftCode" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40">
      <div class="sheet-actions"><button class="btn primary" id="giftGo">${tr('VALIDER')}</button>
      <button class="btn" data-act="set" data-v="settings">${icon('back')} ${tr('PARAMÈTRES')}</button></div>`);
    const go = async () => {
      const code = $('giftCode').value.trim().toUpperCase();
      if (!code) return;
      let hex = '';
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
        hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (err) { refuse(tr('Codes indisponibles sur cet appareil.')); return; }
      const gift = GIFTS[hex];
      const used = readJson(GIFT_KEY, []);
      if (!gift) { refuse(tr('Ce code n’existe pas.')); return; }
      if (used.includes(gift.id)) { refuse(tr('Ce code a déjà été utilisé.')); return; }
      used.push(gift.id);
      store.set(GIFT_KEY, JSON.stringify(used));
      addDust(gift.dust);
      closeSheet();
      renderMenu();
      SFX.golden();
      const [x, y] = center($('menuDust'));
      stage.ring(x, y, 20, { n: 60, colors: [[255, 226, 140], [255, 255, 255]], speed: 90, life: 1 });
      popOn($('menuDust'), `+${gift.dust} ${icon('dust')}`, 'gold');
      toast(tr('Code accepté : +{n} poussières d’étoiles.', { n: gift.dust }), 3200);
    };
    listen('giftGo', 'click', go);
    listen('giftCode', 'keydown', (e) => { if (e.key === 'Enter') go(); });
    setTimeout(() => $('giftCode').focus(), 200);
  }

  // Tous les tutoriels et l'aide sont rangés derrière un seul bouton des Paramètres.
  function tutosHtml() {
    return `<h3>${tr('TUTORIELS ET AIDE')}</h3><div class="menu-list-sheet">
      <button class="btn" data-act="set" data-v="help">${tr('COMMENT JOUER')}</button>
      <button class="btn" data-act="set" data-v="guide">${tr('GUIDE DU MENU')}</button>
      <button class="btn" data-act="set" data-v="tuto">${tutoDone() ? tr('REFAIRE LE TUTORIEL DE PARTIE') : tr('TUTORIEL : PROCHAINE PARTIE')}</button>
      <button class="btn" data-act="set" data-v="tutoCamp">${tr('TUTORIELS DE CAMPAGNE')}</button>
      <button class="btn" data-act="set" data-v="intro">${tr('REVOIR L’INTRODUCTION')}</button>
    </div><div class="sheet-actions"><button class="btn" data-act="set" data-v="settings">${icon('back')} ${tr('PARAMÈTRES')}</button></div>`;
  }

  // Installation : le jeu s'ajoute à l'écran d'accueil et se joue ensuite hors ligne.
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
  window.addEventListener('appinstalled', () => { installPrompt = null; toast(tr('ORBITE est installé')); });
  function installed() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  async function install() {
    if (installPrompt) {
      const p = installPrompt;
      installPrompt = null;
      closeSheet();
      p.prompt();
      return;
    }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const steps = ios
      ? [tr('Ouvrez cette page dans <b>Safari</b>.'), tr('Touchez le bouton <b>Partager</b> (le carré avec une flèche).'), tr('Choisissez <b>Sur l’écran d’accueil</b>, puis <b>Ajouter</b>.')]
      : [tr('Ouvrez cette page dans <b>Chrome</b>.'), tr('Touchez le menu <b>⋮</b> en haut à droite.'), tr('Choisissez <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>).')];
    openSheet(`<h3>${tr('INSTALLER ORBITE')}</h3><ol class="install-steps">${steps.map((t) => `<li>${t}</li>`).join('')}</ol>
      <p class="muted">${tr('Lancez ensuite ORBITE depuis son icône : le jeu, la musique et les sons restent disponibles sans réseau, en mode avion compris.')}</p>
      <div class="sheet-actions"><button class="btn" data-act="set" data-v="settings">${icon('back')} ${tr('PARAMÈTRES')}</button></div>`);
  }

  // Crédits aux couleurs d'ORBITE : ciel animé, titre en pixels comme sur l'écran titre, l'équipe,
  // la musique et la technique, puis une seconde page pour les licences. Rien ne défile.
  const MIT_KENNEY = `Copyright (c) 2025 Kenney. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
  const credits = { raf: 0, stars: [], dust: [], w: 0, h: 0 };
  function creditsLines() {
    const item = (label, value) => `<div class="cr-item"><small>${label}</small><span>${value}</span></div>`;
    const group = (title, items, cls) => `<section class="cr-group ${cls}"><h4>${title}</h4><div class="cr-grid">${items.join('')}</div></section>`;
    return group(tr('Équipe'), [
      item(tr('Direction'), 'Studio EDDA'),
      item(tr('Design'), 'Corentin Flatres'),
      item(tr('Sound design'), 'Victor Desrat'),
      item(tr('Compositeur'), 'Victor Desrat')
    ], 'team') + `<div class="cr-cols">${group(tr('Musique et son'), [
      item(tr('Archives'), tr('Musiques, nappes et sons d’ARECIBO // Salvage Protocol')),
      item(tr('Thèmes du menu'), '« Distant Earth », « Orbiting Wonder » · Studio EDDA (Suno)'),
      item(tr('Bruitages'), 'Kenney · kenney.nl · CC0, MIT')
    ], 'list')}${group(tr('Technique'), [
      item(tr('Planètes'), tr('Moteur de planètes d’ORBITE, pixel art calculé en direct (WebGL2)')),
      item(tr('Police'), 'Chakra Petch · Cadson Demak · SIL Open Font License')
    ], 'list')}</div>`;
  }
  function openCredits() {
    closeSheet();
    const ov = $('credits');
    $('creditsClose').innerHTML = icon('back');
    $('creditsContent').innerHTML = `<div class="cr-page" data-cr-page="credits">
        <header class="cr-head"><div id="creditsWord"></div>
          <p class="cr-sub">ORBITE · ${tr('prototype jouable en construction')} · ${VERSION_LABEL}</p></header>
        ${creditsLines()}
        <p class="cr-note">${tr('Cette fenêtre recevra les crédits complets, les contributeurs et les archives du projet au fil du développement.')}</p>
        <button class="btn cr-switch" type="button" data-cr="licences">${tr('LICENCES')}</button>
      </div>
      <div class="cr-page" data-cr-page="licences" hidden>
        <section class="cr-group"><h4>${tr('LICENCES')}</h4>
          <p>${tr('Interface Sounds et UI Audio (CC0), sons des Starter Kits FPS et 3D Platformer (CC0) et du Starter Kit City Builder (licence MIT). Copies issues des portages de Hugo Locurcio.')}</p>
          <p>${tr('SIL Open Font License, embarquée dans le jeu.')}</p>
          <p class="cr-mit"><b>${tr('LICENCE MIT · STARTER KIT CITY BUILDER')}</b><br>${MIT_KENNEY}</p></section>
        <button class="btn cr-switch" type="button" data-cr="credits">${icon('back')} ${tr('CRÉDITS')}</button>
      </div>`;
    creditsTitle();
    ov.hidden = false;
    document.body.classList.add('credits-open');
    SFX.on();
    creditsFit();
    requestAnimationFrame(() => { ov.classList.add('visible'); pixelsIn($('creditsWord')); });
    creditsSpace(true);
  }
  // Le titre en pixels suit la largeur de l'écran (recalculé quand la fenêtre change de taille).
  function creditsTitle(shown) {
    const w = $('creditsWord');
    if (!w) return;
    pixelWord(w, tr('CRÉDITS'), pixelSize(5));
    if (shown) w.classList.add('shown');
  }
  function creditsPage(name) {
    for (const p of $('creditsContent').querySelectorAll('.cr-page')) p.hidden = p.dataset.crPage !== name;
    creditsFit();
  }
  // Jamais de barre de défilement : si la page dépasse (petit téléphone, texte traduit plus long),
  // elle se réduit juste assez pour tenir.
  function creditsFit() {
    const box = $('creditsContent'), page = box.querySelector('.cr-page:not([hidden])');
    if (!page) return;
    page.style.transform = '';
    const k = Math.min(1, box.clientHeight / page.offsetHeight, box.clientWidth / page.offsetWidth);
    if (k < 1) page.style.transform = `scale(${Math.floor(k * 1000) / 1000})`;
  }
  function closeCredits() {
    const ov = $('credits');
    if (ov.hidden) return;
    SFX.off();
    ov.classList.remove('visible');
    creditsSpace(false);
    setTimeout(() => { ov.hidden = true; document.body.classList.remove('credits-open'); }, 300);
  }
  // Le ciel des crédits : étoiles qui scintillent et poussières qui montent, comme dans ARECIBO.
  function creditsSpace(on) {
    cancelAnimationFrame(credits.raf);
    const cv = $('creditsSpace');
    if (!on || !cv) return;
    const g = cv.getContext('2d');
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.floor(r.width * dpr));
    cv.height = Math.max(1, Math.floor(r.height * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    credits.w = r.width; credits.h = r.height;
    const mote = (y) => ({ x: Math.random() * r.width, y: y == null ? Math.random() * r.height : y, size: Math.random() > 0.86 ? 2 : 1, vx: (Math.random() - 0.5) * 0.05, vy: -0.035 - Math.random() * 0.18, alpha: 0.08 + Math.random() * 0.28, phase: Math.random() * Math.PI * 2 });
    credits.stars = Array.from({ length: 118 }, (_, i) => ({ x: Math.random() * r.width, y: Math.random() * r.height, size: i < 18 ? 2 : i < 58 ? 1.45 : 1, alpha: 0.26 + Math.random() * 0.68, phase: Math.random() * Math.PI * 2, pulse: 0.45 + Math.random() * 1.4 }));
    credits.dust = Array.from({ length: 86 }, () => mote());
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = (t) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, credits.w, credits.h);
      g.save();
      g.globalCompositeOperation = 'screen';
      for (const st of credits.stars) {
        const tw = 0.62 + Math.sin(t * 0.001 * st.pulse + st.phase) * 0.38;
        g.globalAlpha = Math.max(0.12, st.alpha * tw);
        g.fillStyle = '#f4f7ff';
        g.fillRect(Math.round(st.x), Math.round(st.y), st.size, st.size);
        if (st.size > 1.5) {
          g.globalAlpha *= 0.24;
          g.fillRect(Math.round(st.x - 1), Math.round(st.y), st.size + 2, 1);
          g.fillRect(Math.round(st.x), Math.round(st.y - 1), 1, st.size + 2);
        }
      }
      for (const d of credits.dust) {
        const px = d.x, py = d.y;
        d.x += d.vx + Math.sin(t * 0.0008 + d.phase) * 0.035;
        d.y += d.vy;
        if (d.y < -8 || d.x < -8 || d.x > credits.w + 8) Object.assign(d, mote(credits.h + Math.random() * 28));
        g.globalAlpha = d.alpha;
        g.fillStyle = '#eef4ff';
        g.fillRect(Math.round(d.x), Math.round(d.y), d.size, d.size);
        g.globalAlpha = d.alpha * 0.18;
        g.fillRect(Math.round(px), Math.round(py + 2), 1, 4);
      }
      g.restore();
      if (!still && !$('credits').hidden) credits.raf = requestAnimationFrame(draw);
    };
    draw(0);
  }
  listen('creditsClose', 'click', () => closeCredits());
  listen('creditsContent', 'click', (e) => {
    const b = e.target.closest('[data-cr]');
    if (b) { SFX.tap(); creditsPage(b.dataset.cr); }
  });
  window.addEventListener('resize', () => { if (!$('credits').hidden) { creditsTitle(true); creditsFit(); creditsSpace(true); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCredits(); });

  async function settingsAction(v, btn) {
    if (v === 'sound') { SFX.setMuted(!SFX.muted); if (!SFX.muted) SFX.tap(); openSheet(settingsHtml()); }
    else if (v === 'music') { SFX.setMusicOn(!SFX.musicOn); SFX.tap(); openSheet(settingsHtml()); }
    else if (v === 'tutos') openSheet(tutosHtml());
    else if (v === 'lang') openSheet(langHtml());
    else if (v.startsWith('lang:')) I18N.setLang(v.slice(5));
    else if (v === 'help') openSheet(helpHtml(true));
    else if (v === 'credits') openCredits();
    else if (v === 'code') openCode();
    else if (v === 'install') install();
    else if (v === 'guide') {
      closeSheet();
      if (ui.screen === 'menu') setTimeout(() => coachStart(menuSteps(), () => store.set(MENU_GUIDE_KEY, '1')), 250);
    } else if (v === 'tuto') {
      store.set(TUTO_KEY, '');
      closeSheet();
      if (ui.screen === 'menu') startTutorial();
      else toast(tr('Votre prochaine partie sera guidée pas à pas.'), 3000);
    } else if (v === 'tutoCamp') {
      for (const k of ['orbite.campagne.tuto', 'orbite.campagne.carte', 'orbite.campagne.glisse']) store.set(k, '');
      closeSheet();
      toast(tr('La campagne vous guidera de nouveau : premier combat et carte.'), 3000);
    }
    else if (v === 'settings') openSheet(settingsHtml());
    else if (v === 'intro') {
      closeSheet();
      stopAmbient();
      store.set(WAKE_KEY, '');
      boot(true);
    }
  }

  // ─── Choix de la loi ────────────────────────────────────────
  function randomSeed() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0].toString(16).toUpperCase().padStart(8, '0');
  }

  function renderLaws(seed) {
    ui.seed = seed || randomSeed();
    ui.lawOptions = R.lawChoices(ui.seed);
    ui.lawPick = null;
    $('lawGo').disabled = true;
    $('lawsBack').innerHTML = icon('back');
    $('lawList').innerHTML = ui.lawOptions.map((id) => {
      const l = R.LAW[id], st = R.CARD[l.starter], f = R.FAMILIES[l.fam];
      return `<button class="law" data-law="${id}" style="--c:${f.color}">
        <canvas class="sphere" data-fam="${l.fam}" aria-hidden="true"></canvas>
        <div>
          <span class="fam-chip">${l.fam === 'neutre' ? tr('POINTS DE VIE') : f.name.toUpperCase()}</span>
          <h3>${esc(l.name)}</h3>
          <p class="tag">${esc(l.tagline)}</p>
          <p class="txt">${esc(l.text)}</p>
          <p class="awk"><b>${tr('ÉVEIL AU CYCLE {n}', { n: R.AWAKE_ROUND })}</b> ${esc(l.awake)}</p>
          <p class="starter">${tr('PREMIER ASTRE : {name}', { name: esc(st.name).toUpperCase() })} ${st.atk}/${st.hp} · ${tr('{n} PV', { n: (l.hp || R.START_HP) * (ui.size === 8 ? 1 : R.DUEL.hp) })}</p>
        </div>
      </button>`;
    }).join('');
    mountEnergy($('lawList'));
    // L'événement cosmique de la partie est connu dès le choix de la loi (il vient de la graine).
    const ev = R.EVENT[R.eventFor(ui.seed)];
    $('lawEvent').hidden = false;
    $('lawEvent').innerHTML = `${ui.daily ? `<span class="law-daily">${tr('DÉFI DU JOUR · {d}', { d: esc(dailyLabel(ui.daily)) })}</span>` : ''}${eventHtml(ev.id)}`;
  }
  // Les lois sont des sphères d'énergie animées, colorées selon le pouvoir de leur famille.
  function mountEnergy(root) {
    for (const c of root.querySelectorAll('canvas.sphere:not([data-on])')) {
      c.dataset.on = '1';
      window.OrbiteEnergy.mount(c, c.dataset.fam);
    }
  }

  listen('lawList', 'click', (e) => {
    const b = e.target.closest('.law');
    if (!b) return;
    SFX.tap();
    ui.lawPick = b.dataset.law;
    for (const x of $('lawList').children) x.classList.toggle('on', x === b);
    $('lawGo').disabled = false;
    window.OrbiteEnergy.pulse(b.querySelector('canvas.sphere'));
    tuto('loi');
  });

  listen('lawGo', 'click', async () => {
    if (!ui.lawPick) return;
    SFX.level();
    ui.state = R.newGame(ui.seed, ui.lawPick, { size: ui.size || 2, event: 'auto', daily: ui.daily || undefined });
    if (ui.daily) dailyStart(ui.daily);
    ui.daily = null;
    codexMark([R.LAW[ui.lawPick].starter]);
    ui.stamp++;
    saveGame();
    await show('game');
    renderGame(true);
    if (ui.state.event) await new Promise((done) => openEventCard(done));
    banner(R.isDuel(ui.state) ? tr('DUEL · {name}', { name: esc(ui.state.players[1].name) }) : tr('CYCLE {n}', { n: 1 }), tr('Achetez des astres, placez-les, puis lancez le combat.'));
    if (!tutoDone()) {
      store.set(HINT_KEY, '1');
      coachStop(false);
      setTimeout(() => coachStart(GAME_STEPS, () => store.set(TUTO_KEY, 'fini')), 1600);
    } else if (store.get(HINT_KEY, '') !== '1') {
      store.set(HINT_KEY, '1');
      setTimeout(() => toast(tr('Touchez un astre pour lire ce qu’il fait. Glissez-le pour l’acheter ou le placer.'), 5200), 2200);
    }
  });


  // ─── Tutoriel : un coach met en lumière ce qu'il faut toucher ──
  // Chaque étape éclaire une cible, montre le geste (toucher ou glisser) et attend l'action du
  // joueur, ou son « SUIVANT ». Le jeu signale ses actions par tuto('achat'), tuto('combat')…
  const TUTO_KEY = 'orbite.tuto';
  const MENU_GUIDE_KEY = 'orbite.guide';
  const tutoDone = () => store.get(TUTO_KEY, '') === 'fini';
  const coach = { steps: null, i: -1, raf: 0, onEnd: null };
  const coachEl = document.createElement('div');
  coachEl.className = 'coach';
  coachEl.hidden = true;
  coachEl.innerHTML = '<div class="coach-hole"></div><div class="coach-finger"></div><div class="coach-bubble" role="dialog"><span class="coach-count"></span><p></p><div class="coach-actions"></div></div>';
  document.body.appendChild(coachEl);
  const coachQ = (sel) => (typeof sel === 'function' ? sel() : sel ? document.querySelector(sel) : null);

  function coachStart(steps, onEnd) {
    coach.steps = steps;
    coach.onEnd = onEnd || null;
    coachGo(0);
  }
  function coachStop(finished) {
    if (!coach.steps) return;
    const cb = coach.onEnd;
    coach.steps = null;
    coach.i = -1;
    clearTimeout(coach.timer);
    cancelAnimationFrame(coach.raf);
    coachEl.hidden = true;
    document.body.classList.remove('coaching');
    if (cb) cb(finished);
  }
  function coachGo(i) {
    const steps = coach.steps;
    if (!steps) return;
    while (i < steps.length && steps[i].when && !steps[i].when()) i++;
    if (i >= steps.length) { coachStop(true); return; }
    coach.i = i;
    const st = steps[i];
    const total = steps.filter((x) => !x.extra).length;
    const n = steps.slice(0, i + 1).filter((x) => !x.extra).length;
    coachEl.hidden = false;
    document.body.classList.add('coaching');
    coachEl.className = 'coach' + (st.dim === false ? ' nodim' : '') + (st.target ? '' : ' nohole') + (st.soft ? ' soft' : '');
    const bubble = coachEl.querySelector('.coach-bubble');
    bubble.querySelector('p').innerHTML = st.text;
    bubble.querySelector('.coach-count').textContent = st.extra ? '' : `${n} / ${total}`;
    const last = i === steps.length - 1;
    bubble.querySelector('.coach-actions').innerHTML =
      (last || steps.locked ? '<span></span>' : `<button class="link" data-coach="skip">${tr('Passer le tutoriel')}</button>`) +
      (st.next ? `<button class="btn primary" data-coach="next">${st.next}</button>` : '');
    bubble.classList.remove('in');
    void bubble.offsetWidth;
    bubble.classList.add('in');
    const finger = coachEl.querySelector('.coach-finger');
    finger.className = 'coach-finger' + (st.gesture ? ' ' + (st.gesture.drag ? 'drag' : 'tap') : '');
    cancelAnimationFrame(coach.raf);
    const follow = () => { coachPlace(st); coach.raf = requestAnimationFrame(follow); };
    follow();
    if (st.enter) st.enter();
  }
  function coachPlace(st) {
    const hole = coachEl.querySelector('.coach-hole');
    const bubble = coachEl.querySelector('.coach-bubble');
    const finger = coachEl.querySelector('.coach-finger');
    const t = coachQ(st.target);
    const H = window.innerHeight;
    if (t && t.getClientRects().length) {
      const r = t.getBoundingClientRect();
      const pad = st.pad == null ? 6 : st.pad;
      Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      bubble.style.zoom = ui.z === 1 ? '' : String(ui.z);
      const bh = bubble.offsetHeight * ui.z;
      const below = st.place ? st.place === 'below' : r.top + r.height / 2 < H * 0.5;
      let y = st.place === 'top' ? 12 : below ? r.bottom + pad + 14 : r.top - pad - 14 - bh;
      y = Math.max(10, Math.min(H - bh - 10, y));
      bubble.style.top = y / ui.z + 'px';
    } else {
      Object.assign(hole.style, { left: '50%', top: '50%', width: '0px', height: '0px' });
      bubble.style.zoom = ui.z === 1 ? '' : String(ui.z);
      bubble.style.top = Math.round(H * (st.y || 0.36)) / ui.z + 'px';
    }
    if (st.gesture) {
      const a = coachQ(st.gesture.from || st.gesture.tap || st.target);
      const b = st.gesture.drag ? coachQ(st.gesture.drag) : null;
      if (a && a.getClientRects().length) {
        const ra = a.getBoundingClientRect();
        finger.style.setProperty('--x0', ra.left + ra.width / 2 + 'px');
        finger.style.setProperty('--y0', ra.top + ra.height * (st.gesture.at || 0.45) + 'px');
        if (b) {
          const rb = b.getBoundingClientRect();
          finger.style.setProperty('--x1', rb.left + rb.width / 2 + 'px');
          finger.style.setProperty('--y1', rb.top + rb.height / 2 + 'px');
        }
        finger.hidden = false;
      } else finger.hidden = true;
    } else finger.hidden = true;
  }
  // Le jeu signale une action ; l'étape en cours avance si elle l'attendait, ou saute ailleurs.
  function tuto(ev) {
    const steps = coach.steps;
    if (!steps || coach.i < 0) return;
    const st = steps[coach.i];
    let k = -1;
    if (st.wait && st.wait.includes(ev)) k = coach.i + 1;
    else if (st.jump && st.jump[ev]) k = steps.findIndex((x) => x.id === st.jump[ev]);
    if (k < 0) return;
    // La dernière action l'emporte : un achat qui ferme la fiche n'y renvoie pas.
    clearTimeout(coach.timer);
    coach.timer = setTimeout(() => { if (coach.steps === steps) coachGo(k); }, steps[Math.min(k, steps.length - 1)].delay == null ? 300 : steps[Math.min(k, steps.length - 1)].delay);
  }
  coachEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-coach]');
    if (!b) return;
    SFX.tap();
    if (b.dataset.coach === 'skip') { coachStop(false); store.set(TUTO_KEY, 'fini'); toast(tr('Tutoriel passé. Paramètres → Refaire le tutoriel pour le revoir.'), 3600); }
    else { clearTimeout(coach.timer); coachGo(coach.i + 1); }
  });

  // Étapes de la première partie.
  const LAW_STEPS = [
    { id: 'loi', target: '#lawList', place: 'below', pad: 4, text: tr('Choisissez une <b>loi</b>. Elle régit votre univers : elle vous donne un <b>pouvoir</b> et votre <b>premier astre</b>. Touchez une sphère.'), gesture: { tap: '#lawList .law' }, wait: ['loi'] },
    { id: 'creer', target: '#lawGo', text: tr('Parfait. Touchez <b>CRÉER MON UNIVERS</b> pour commencer la partie.'), gesture: { tap: '#lawGo' }, wait: ['partie'] }
  ];
  const GAME_STEPS = [
    { id: 'bienvenue', text: tr('Bienvenue dans votre premier <b>duel</b> ! Un seul rival, plusieurs cycles. À chaque <b>cycle</b>, vous achetez des astres, vous les placez, puis votre système <b>combat tout seul</b>. Le premier à 0 PV perd.'), next: tr('SUIVANT'), delay: 0 },
    { id: 'pv', target: '#hudHp', text: tr('Vos <b>points de vie</b>. Un combat perdu vous en retire. À 0, vous êtes éliminé.'), next: tr('SUIVANT') },
    { id: 'energie', target: '#energy', text: tr('Votre <b>énergie</b> : 3 au premier cycle, une de plus à chaque cycle. Un astre coûte <b>3</b>.'), next: tr('SUIVANT') },
    { id: 'creation', target: '#tavern', text: tr('Voici la <b>Création</b> : c’est là que naissent les astres qu’on vous propose. <b>Touchez-en un</b> pour lire ce qu’il fait.'), gesture: { tap: '#shop .unit', at: 0.35 }, wait: ['fiche'], jump: { achat: 'main', combat: 'regard' } },
    { id: 'fiche', target: '#sheet [data-act="buy"]', dim: false, place: 'top', text: tr('Sa fiche : <b>attaque</b>, <b>PV</b> et <b>pouvoir</b>. Touchez <b>ACHETER</b>.'), gesture: { tap: '#sheet [data-act="buy"]', at: 0.5 }, wait: ['achat'], jump: { fermer: 'creation' } },
    { id: 'main', target: '#handZone', text: tr('L’astre attend dans votre <b>main</b>. <b>Glissez-le</b> vers votre système : en haut l’<b>avant</b>, en bas l’<b>arrière</b>.'), gesture: { from: '#hand .unit', drag: '#systemZone', at: 0.35 }, wait: ['placer'], when: () => me().hand.length > 0, jump: { combat: 'regard' } },
    { id: 'systeme', target: '#systemZone', pad: -10, text: tr('Deux rangées de 4. L’<b>avant</b> attaque et encaisse ; l’<b>arrière</b> reste à l’abri et avance quand l’avant tombe. Chaque astre de l’avant frappe l’ennemi <b>en face</b> de lui : glissez vos astres pour les placer.'), next: tr('SUIVANT') },
    { id: 'combat', target: '#fightBtn', text: tr('Plus assez d’énergie ? Lancez le <b>combat</b> ! Il se joue tout seul.'), gesture: { tap: '#fightBtn', at: 0.5 }, wait: ['combat'] },
    { id: 'regard', soft: true, dim: false, y: 0.76, extra: true, text: tr('Vos astres (en bas) frappent ceux du rival (en haut) : seul l’avant attaque, chacun l’ennemi en face. Les survivants du gagnant infligent des dégâts au perdant.'), wait: ['cycle'] },
    { id: 'degats', text: tr('Le perdant perd des PV : <b>niveau de création du gagnant + niveaux de ses astres survivants</b>. Nouveau cycle, nouvelle énergie !'), next: tr('SUIVANT'), delay: 600 },
    { id: 'formation', target: '#systemZone', pad: -10, text: tr('<b>Formation</b> : deux astres d’une même famille dans la même rangée donnent un bonus au début du combat. Chaque famille a le sien, à l’avant comme à l’arrière. Touchez l’étiquette des familles pour les lire.'), next: tr('SUIVANT') },
    { id: 'actualiser', target: '#rollBtn', text: tr('<b>Actualiser</b> (1 énergie) : la Création fait naître d’autres astres.'), next: tr('SUIVANT') },
    { id: 'geler', target: '#freezeBtn', text: tr('<b>Geler</b> : les astres proposés restent les mêmes au prochain cycle. Pratique pour garder un astre que vous ne pouvez pas encore payer.'), next: tr('SUIVANT') },
    { id: 'niveau', target: '#upBtn', text: tr('<b>Monter de niveau</b> : la Création fait naître des astres plus puissants. Le prix baisse à chaque cycle.'), next: tr('SUIVANT') },
    { id: 'vendre', target: '#systemZone', pad: -10, text: tr('Pour <b>vendre</b> un astre (+1 énergie), glissez-le de votre système vers la Création.'), next: tr('SUIVANT') },
    { id: 'pouvoir', target: '#powerBtn', text: tr('Le <b>pouvoir</b> de votre loi : touchez-le pour l’utiliser. Il coûte de l’énergie.'), next: tr('SUIVANT') },
    { id: 'rivaux', target: '#rivals', text: tr('Votre <b>rival</b> : touchez ici pour voir le système qu’il a joué au dernier combat, et placez vos astres pour le contrer.'), next: tr('SUIVANT') },
    { id: 'fin', text: tr('Dernier secret : <b>trois copies</b> du même astre fusionnent en un astre <b>doré</b>, deux fois plus fort. Gagnez le duel pour remporter des poussières d’étoiles. À vous !'), next: tr('JOUER') }
  ];
  // Duel d'entraînement (v97) : un nouveau joueur (aucune partie jouée, tutoriel pas fini) le joue
  // avant tout le reste, contre la Sentinelle (20 PV, js/rules.js TUTOR). Le guide ne se passe pas.
  const TUTO_LAW = 'gravite';
  const needTuto = () => !tutoDone() && stats().games === 0;
  const TUTO_INVITE = Object.assign([
    { id: 'premier', target: '#playBtn', text: tr('Votre premier <b>duel</b> vous attend : touchez <b>JOUER</b>.'), gesture: { tap: '#playBtn', at: 0.5 }, wait: ['jouer'], delay: 0 }
  ], { locked: true, menu: true });
  const TUTO_STEPS = () => Object.assign([
    { id: 'bienvenue', text: tr('<b>Duel d’entraînement</b> contre la <b>Sentinelle</b> : elle n’a que <b>20 PV</b>, vous en avez 60. À chaque <b>cycle</b>, vous achetez des astres, vous les placez, puis votre système <b>combat tout seul</b>. Suivez le guide pour la battre !'), next: tr('SUIVANT'), delay: 0 }
  ].concat(GAME_STEPS.slice(1)), { locked: true });
  // Un conseil (texte simple, pour toast) au début de chaque cycle du duel d'entraînement, une fois
  // le guide terminé.
  const TUTO_TIPS = {
    3: tr('Conseil : montez de niveau (la flèche de la Création) pour faire naître des astres plus forts.'),
    4: tr('Conseil : trois copies du même astre fusionnent en un astre doré, deux fois plus fort.'),
    5: tr('Conseil : à l’avant, vos astres les plus solides : ils frappent et encaissent ; l’arrière prend le relais quand ils tombent.'),
    6: tr('Conseil : système plein ? Vendez un astre faible (glissez-le vers la Création) pour en placer un meilleur.'),
    7: tr('Conseil : touchez la Sentinelle en haut pour voir son système, et placez-vous pour la contrer.')
  };
  async function startTutorial() {
    coachStop(false);
    closeSheet();
    ui.daily = null;
    ui.size = 2;
    ui.seed = 'tutoriel';
    ui.state = R.newGame('tutoriel', TUTO_LAW, { size: 2, tutorial: true });
    codexMark([R.LAW[TUTO_LAW].starter]);
    ui.stamp++;
    saveGame();
    await show('game');
    renderGame(true);
    banner(tr('DUEL D’ENTRAÎNEMENT'), tr('Battez la Sentinelle : elle n’a que 20 PV.'));
    store.set(HINT_KEY, '1');
    setTimeout(() => { if (ui.state && ui.state.tutorial) coachStart(TUTO_STEPS(), () => store.set(TUTO_KEY, 'fini')); }, 1600);
  }
  const MENU_STEPS = [
    { id: 'jouer', target: '#playBtn', text: tr('<b>Jouer</b> : en <b>solo</b> contre l’IA (duel, mêlée contre sept univers, défi du jour) ou en <b>multijoueur</b>, en ligne et entre amis.'), next: tr('SUIVANT'), delay: 0 },
    { id: 'missions', target: '#missionsBox', text: tr('Les <b>missions du jour</b> : trois objectifs chaque jour, récompensés en <b>poussières d’étoiles</b>. Récupérez la récompense ici quand une mission est accomplie.'), next: tr('SUIVANT') },
    { id: 'codex', target: '#codexBtn', text: tr('Le <b>Codex</b> : tous les astres, lois, reliques et événements du jeu. Ceux que vous avez croisés en partie s’y dévoilent.'), next: tr('SUIVANT') },
    { id: 'creation', target: '#creationBtn', text: tr('La <b>Création</b> : votre planète a atteint la civilisation verte. Bâtissez-y votre civilisation : faites grandir des mondes, descendez à leur surface et fondez une colonie.'), next: tr('SUIVANT') },
    { id: 'marche', target: '#marketBtn', text: tr('Le <b>Marché stellaire</b> : dépensez vos <b>poussières d’étoiles</b> (gagnées en duel et sur le podium). <b>Ma planète</b> : faites renaître le monde qui tourne derrière le menu. <b>Cosmétiques</b> : des fonds animés pour vos parties.'), next: tr('SUIVANT') },
    { id: 'profil', target: '#profileBtn', text: tr('Votre <b>profil</b> : pseudo, niveau, statistiques et historique. Chaque partie rapporte de l’expérience.'), next: tr('SUIVANT') },
    { id: 'reglages', target: '#settingsBtn', text: tr('<b>Paramètres</b> : son, musique, règles du jeu, et ce guide si vous voulez le revoir.'), next: tr('C’EST PARTI') }
  ];
  // Le bouton Création n'est présenté que s'il est au menu (civilisation verte atteinte).
  const menuSteps = () => Object.assign(MENU_STEPS.filter((st) => st.id !== 'creation' || !$('creationBtn').hidden), { menu: true });

  // ─── Rendu de la partie ─────────────────────────────────────
  function renderHud() {
    const p = me();
    $('hudHp').innerHTML = icon('heart') + `<b>${Math.max(0, p.hp)}</b>`;
    $('hudRound').textContent = tr('CYCLE {n}', { n: ui.state.round });
    $('famsBtn').innerHTML = ui.state.families.map((f) => `<span style="--c:${famColor(f)}"></span>`).join('');
    $('cosmosBtn').innerHTML = `<span class="cz-ev">${ui.state.event ? eventIcon(ui.state.event) : '✺'}</span>${(p.relics || []).map((id) => `<i>${RELIC_GLYPH[id] || '✦'}</i>`).join('')}`;
    $('menuBtn').innerHTML = icon('menu');
  }

  // Cosmétiques d'un joueur de la partie (v96) : les nôtres, ou ceux qu'un créateur en ligne a
  // apportés à sa place du salon (seatOf, js/multi.js). Les bots et les fantômes n'en ont pas.
  function lookOf(p) {
    if (!p || p.bot || p.ghost) return null;
    // Nous-mêmes : comme les autres nous voient (sans photo, l'astre de notre rang).
    if (p.id === 'you') { const c = classe(); return seatLook({ font: myFont(), frame: myFrame(), avatar: myAvatar(), points: K.placed(c) ? c.points : 0 }); }
    const MP = window.OrbiteMulti, m = MP && MP.state.match;
    const seat = p.remote && m && Array.isArray(m.seats) ? m.seats.find((x) => x && x.uid === p.id) : null;
    return seat ? seatLook(seat) : null;
  }
  // Les cosmétiques d'une place du salon, vérifiés ; sans photo, l'astre de son rang classé.
  function seatLook(seat) {
    return {
      font: FONT_BY_ID[seat.font] ? seat.font : '',
      frame: FRAME_BY_ID[seat.frame] ? seat.frame : '',
      avatar: AVATAR_BY_ID[seat.avatar] ? seat.avatar : 'rank-' + RANKS[seat.points > 0 ? K.tierOf(seat.points).idx : 0].id
    };
  }
  // Le nom d'un joueur dans sa police, et sa photo dans son cadre (rien pour un bot).
  const playerName = (p, label) => { const l = lookOf(p); return nameHtml(label == null ? p.name : label, l ? l.font : ''); };
  const playerAv = (p) => { const l = lookOf(p); return l ? framed(`<span class="orb" data-planet="${l.avatar}"></span>`, l.frame) : ''; };

  // PC : la colonne de gauche montre les rivaux en permanence, comme le classement de Battlegrounds,
  // avec le système du rival (duel) ou du prochain adversaire (mêlée) sous les yeux.
  function rivalsPanel(s) {
    const duel = R.isDuel(s);
    const nx = s.phase === 'shop' ? R.nextOpponent(s) : null;
    const last = me().lastOpp;
    const list = s.players.slice().sort((a, b) => (b.alive - a.alive) || (a.alive ? b.hp - a.hp : a.rank - b.rank));
    const rows = list.map((p, i) => {
      const mine = p === me(), isNext = !duel && !!nx && nx === p;
      const hp = Math.max(0, p.hp);
      // En duel, le rival est toujours le même : pas d'étiquette.
      const tag = duel ? '' : isNext ? tr('PROCHAIN ADVERSAIRE') : !mine && p.id === last ? tr('DERNIER ADVERSAIRE') : '';
      return `<span class="dr-row ${mine ? 'me' : ''} ${isNext ? 'next' : ''} ${p.alive ? '' : 'dead'}">
        <i class="dr-rk">${p.alive ? i + 1 : p.rank}</i>${s.mp ? `<span class="pl-av">${playerAv(p)}</span>` : ''}
        <span class="dr-who"><b>${playerName(p, mine ? tr('VOUS') : p.name)}</b>${tag ? `<em>${tag}</em>` : `<small>${tr('niveau {n}', { n: p.tier })}</small>`}</span>
        <span class="dr-hp"><b>${p.alive ? hp : '–'}</b><i class="hp-bar"><i style="width:${p.alive ? Math.min(100, hp / (p.maxHp || R.START_HP) * 100) : 0}%"></i></i></span>
      </span>`;
    }).join('');
    const opp = duel ? s.players[1] : nx;
    const scout = opp && s.round > 1
      ? `<span class="dr-scout"><small>${duel ? tr('Système joué au dernier combat') : tr('Prochain adversaire : {name}', { name: esc(opp.ghost ? tr('{name} (fantôme)', { name: opp.name }) : opp.name) })}</small>${staticRows(opp.ghost ? opp.board : opp.seen || [])}</span>`
      : '';
    return `<span class="dr-head">${duel ? tr('DUEL') : tr('UNIVERS EN LICE · {n}', { n: R.alivePlayers(s).length })}</span>
      <span class="dr-list ${s.mp ? 'av' : ''}">${rows}</span>${scout}<span class="dr-more">${tr('Touchez pour les détails')}</span>`;
  }

  function renderRivals() {
    const s = ui.state;
    if (ui.desk) { $('rivals').innerHTML = rivalsPanel(s); return; }
    // Barre repliée : un menu qui se déroule, sans images.
    const alive = R.alivePlayers(s).length;
    const rank = s.players.filter((p) => p.alive).sort((a, b) => b.hp - a.hp).indexOf(me()) + 1;
    if (R.isDuel(s)) {
      // Duel : le rival, ses PV, et son dernier système d'un geste.
      const o = s.players[1];
      $('rivals').innerHTML = `<span class="rv-label">${tr('DUEL')}</span><span class="rv-info"><b>${playerName(o)}</b> · ${icon('heart')} ${Math.max(0, o.hp)}${s.round > 1 ? ' · ' + tr('voir son système') : ''}</span><span class="rv-open">${icon('back', 'down')}</span>`;
      return;
    }
    // Mêlée : le prochain adversaire est connu dès la boutique, comme dans Battlegrounds.
    const nx = s.phase === 'shop' ? R.nextOpponent(s) : null;
    const info = nx
      ? tr('Prochain : {name}', { name: `<b>${nx.ghost ? esc(tr('{name} (fantôme)', { name: nx.name })) : playerName(nx)}</b>` }) + ' · ' + tr('vous êtes {rank}', { rank: ordinal(rank) })
      : tr('{n} univers en lice', { n: alive }) + (me().alive ? ' · ' + tr('vous êtes {rank}', { rank: ordinal(rank) }) : '');
    $('rivals').innerHTML = `<span class="rv-label">${tr('RIVAUX')}</span><span class="rv-info">${info}</span><span class="rv-open">${icon('back', 'down')}</span>`;
  }

  function renderTavernHead(pop) {
    const p = me();
    // Au passage de niveau, seul le nouveau pion s'allume en grand (la classe « pop » est réservée
    // aux textes flottants : posée ici, elle faisait glisser toute la ligne vers la gauche).
    const pips = Array.from({ length: 6 }, (_, i) => `<i class="${i < p.tier ? 'on' : ''}${pop && i === p.tier - 1 ? ' new' : ''}"></i>`).join('');
    $('tier').innerHTML = `${tr('CRÉATION')} <span class="pips">${pips}</span>`;
    const cost = R.upgradeCost(p, ui.state);
    $('upBtn').innerHTML = p.tier >= 6 ? tr('MAX') : `${icon('up')} <i>${cost}</i>`;
    $('upBtn').disabled = p.tier >= 6 || p.gold < cost;
    const rc = R.rollCost(p);
    $('rollBtn').innerHTML = `${icon('roll')} <i>${rc}</i>`;
    $('rollBtn').disabled = p.gold < rc;
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
      if (R.CARD[it.id].legend) legendArrive(el, reveal ? 80 + n * 70 + 350 : 200);
      return el;
    }, (el, it) => { el.dataset.slot = it.slot; });
    sizeRow($('shop'), 'shop', 92);
    codexMark(p.shop);
    $('shop').classList.toggle('frozen', p.frozen);
    if (!ui.frostStagger) for (const orb of $('shop').querySelectorAll('.orb')) orb.dataset.frozen = p.frozen ? '1' : '0';
    markTriples();
  }

  // Petites étoiles sur les astres de la Création qui feraient une fusion : on en possède déjà deux.
  function markTriples() {
    const p = me();
    if (!p) return;
    for (const el of $('shop').children) {
      const id = el.dataset.id;
      const ready = !!id && !R.CARD[id].token && p.board.concat(p.hand).filter((u) => u.id === id && !u.golden).length >= 2;
      let sp = el.querySelector('.triple-spark');
      if (ready && !sp) {
        sp = document.createElement('span');
        sp.className = 'triple-spark';
        sp.setAttribute('aria-label', tr('Fusion possible'));
        sp.innerHTML = '<i>✦</i><i>✦</i><i>✦</i>';
        el.appendChild(sp);
      } else if (!ready && sp) sp.remove();
    }
  }

  // Taille des astres selon leur nombre : peu d'astres = grandes planètes.
  const SIZE = {
    shop: [0.24, 0.24, 0.24, 0.24, 0.2, 0.17, 0.152],
    board: [0.22, 0.22, 0.22, 0.2, 0.18, 0.162, 0.14, 0.126],
    hand: [0.13, 0.13, 0.13, 0.13, 0.13, 0.13, 0.12, 0.11, 0.1, 0.094, 0.088]
  };
  // Largeur utile d'une rangée : la colonne du téléphone, ou la colonne centrale sur PC.
  const colOf = (container) => (ui.desk ? Math.max(320, (container.parentElement && container.parentElement.clientWidth) || 640) - 10 : Math.min(window.innerWidth, 520) - 20);
  function sizeRow(container, kind, cap) {
    const n = container.children.length;
    const col = colOf(container);
    const k = SIZE[kind][Math.min(n, SIZE[kind].length - 1)];
    container.style.setProperty('--u', Math.round(Math.min(ui.desk ? cap * 1.2 : cap, col * k)) + 'px');
  }

  // ─── Rangées : l'avant face au rival, l'arrière à l'abri ─────
  // Grille de demi-colonnes : chaque astre en prend deux et chaque rangée est centrée, comme dans
  // les règles (« en face », c'est ce qu'on voit). L'avant regarde le rival : en haut pour vous,
  // en bas pour lui.
  function layoutRows(container, enemy) {
    const kids = [...container.children].filter((el) => el.classList.contains('unit'));
    const rows = [kids.filter((el) => el.dataset.row !== '1'), kids.filter((el) => el.dataset.row === '1')];
    const width = Math.max(R.ROW_MAX, rows[0].length, rows[1].length);
    const col = colOf(container);
    container.style.setProperty('--cols', width * 2);
    const u = ui.desk ? Math.min(100, viewH() * 0.13, col / (width + 0.7)) : Math.min(70, window.innerHeight * 0.095, col / (width + 0.7));
    container.style.setProperty('--u', Math.round(u) + 'px');
    rows.forEach((list, r) => list.forEach((el, i) => {
      el.style.gridRow = String(enemy ? 2 - r : r + 1);
      el.style.gridColumn = `${width - list.length + 2 * i + 1} / span 2`;
      const d = i - (list.length - 1) / 2;
      el.style.setProperty('--arc', Math.round(d * d * 1.6 * (enemy ? -1 : 1)) + 'px');
    }));
  }
  const rowOfEl = (el) => (el.dataset.row === '1' ? 1 : 0);

  function renderBoard() {
    const p = me();
    // Anciennes sauvegardes : au-delà de 4 astres, les derniers passent à l'arrière.
    R.arrange(p);
    markTriples();
    syncList($('board'), p.board, (u) => u.uid, (u) => {
      const el = makeUnit(u, 'board');
      el.dataset.src = 'board';
      return el;
    }, (el, u) => { updateUnit(el, u, 'board'); el.dataset.src = 'board'; });
    $('board').dataset.front = tr('AVANT');
    $('board').dataset.back = tr('ARRIÈRE');
    layoutRows($('board'));
    renderFormations();
    markDocks();
  }

  // Arrimage (v101) : tant qu'un astre Arrimage attend en main, chaque Machine du système où il
  // peut s'aimanter montre un petit aimant qui rebondit. Sinon, personne ne devine qu'on les cumule.
  function markDocks() {
    const p = me();
    if (!p || document.body.classList.contains('in-combat')) return;
    const docks = p.hand.filter((u) => u.kw.includes('arrimage'));
    for (const el of $('board').children) {
      const u = p.board.find((v) => v.uid === el.dataset.uid);
      const on = !!u && docks.some((d) => R.canMagnet(d, u));
      el.classList.toggle('can-dock', on);
      // La première fois, un mot d'explication.
      if (on && store.get('orbite.aimant', '') !== '1' && !coach.steps) {
        store.set('orbite.aimant', '1');
        setTimeout(() => toast(tr('Aimant : glissez votre astre Arrimage sur une Machine, il s’y colle et lui donne ses statistiques.'), 5600), 900);
      }
      let tag = el.querySelector('.dock-tag');
      if (on && !tag) { tag = document.createElement('i'); tag.className = 'dock-tag'; tag.innerHTML = icon('magnet'); el.appendChild(tag); }
      else if (!on && tag) tag.remove();
    }
  }

  // Formations : deux astres (ou plus) d'une même famille dans la même rangée.
  const FORM_KEY = 'orbite.formation';
  const famName = (f) => R.FAMILIES[f].name.toUpperCase();
  const kwName = (k) => R.KEYWORDS[k].name.toUpperCase();
  const ROMAN = ['', 'I', 'II', 'III'];
  const rowName = (row) => (row ? tr('ARRIÈRE') : tr('AVANT'));
  const formLabel = (f) => `<b style="color:${famColor(f.fam)}">${famName(f.fam)} ${ROMAN[f.lvl]}</b> · ${rowName(f.row)}`;
  // Marque les astres d'une formation (un trait de la couleur de leur famille).
  function markForms(container, forms) {
    for (const el of container.querySelectorAll('.unit')) {
      const fam = R.CARD[el.dataset.id] && R.CARD[el.dataset.id].fam;
      const f = forms.find((g) => g.fam === fam && g.row === rowOfEl(el));
      el.classList.toggle('in-form', !!f);
      if (f) el.style.setProperty('--fc', famColor(f.fam));
    }
  }
  function renderFormations() {
    const tag = $('allianceTag');
    if (!tag || !ui.state) return;
    const forms = R.formationsOf(me().board);
    markForms($('board'), forms);
    // Phénomènes : un éclat doré sur les astres concernés, et leur nom dans l'étiquette.
    const phen = R.phenomenaOf(me().board);
    for (const el of $('board').querySelectorAll('.unit')) el.classList.toggle('in-phen', phen.some((p) => p.uid === el.dataset.uid || p.partner === el.dataset.uid));
    const key = forms.map((f) => f.fam + f.row + f.lvl).concat(phen.map((p) => p.kind + p.uid)).join('|');
    tag.hidden = !forms.length && !phen.length;
    tag.innerHTML = forms.map((f) => `<i style="--c:${famColor(f.fam)}">${famName(f.fam)} ${ROMAN[f.lvl]}</i>`).join('') +
      [...new Set(phen.map((p) => p.kind))].map((k) => `<i class="ph">✦ ${esc(tr(R.PHENOMENA[k].name)).toUpperCase()}</i>`).join('');
    if (key && key !== ui.formKey && ui.formKey !== undefined && forms.length + phen.length >= (ui.formCount || 0)) {
      tag.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1 }, { transform: 'scale(1)' }], { duration: 520, easing: 'ease-out' });
      SFX.golden();
      if (store.get(FORM_KEY, '') !== '1') {
        store.set(FORM_KEY, '1');
        toast(tr('Formation ! Deux astres d’une même famille dans la même rangée : un bonus au début de chaque combat. Touchez l’étiquette pour le lire.'), 4600);
      }
    }
    ui.formKey = key;
    ui.formCount = forms.length + phen.length;
  }
  listen('allianceTag', 'click', () => { SFX.tap(); openFamilies(); });

  function renderHand() {
    const p = me();
    markTriples();
    syncList($('hand'), p.hand, (u) => u.uid, (u) => {
      const el = makeUnit(u, 'hand');
      el.dataset.src = 'hand';
      return el;
    }, (el, u) => updateUnit(el, u, 'hand'));
    sizeRow($('hand'), 'hand', 54);
    markDocks();
  }

  function renderEnergy(spent) {
    const p = me();
    const max = Math.min(R.MAX_GOLD, ui.state.round + 2);
    const shown = Math.max(max, Math.min(p.gold, 12));
    // L'énergie gagnée en vendant un doré brille en doré ; dépensée, elle s'en va la première.
    p.goldE = Math.min(p.goldE || 0, p.gold);
    let html = '';
    for (let i = 0; i < shown; i++) {
      const on = i < p.gold;
      const wasOn = spent && i >= p.gold && i < p.gold + spent;
      const gold = on && i >= p.gold - p.goldE;
      html += `<i class="${on ? 'on' : ''} ${gold ? 'gold' : ''} ${wasOn ? 'spent' : ''}"></i>`;
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
    b.classList.toggle('awake', !!p.awake);
    const label = p.law === 'renversement' ? tr('INVERSER') : p.law === 'ingenierie' ? tr('+ SONDE') : law.name.toUpperCase();
    const cost = active ? ` · ${R.powerCost(p)} ${icon('bolt')}` : '';
    const txt = `<b>${active ? tr('POUVOIR') : tr('LOI')}${active && p.powerUsed ? ' · ' + tr('UTILISÉ') : p.awake ? ' · ' + tr('ÉVEILLÉE') : ''}</b>${label}${cost}`;
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
    if (reveal) {
      [...$('board').children, ...$('hand').children].forEach((el, i) => revealIn(el, 40 + i * 40));
      [...$('rivals').querySelectorAll('.orb')].forEach((o, i) => revealIn(o, i * 30));
    }
  }

  // ─── Effets pendant la création (buffs, mots-clés…) ──────────────────
  // Texte d'un bonus : « +1 ⚔ +1 ♥ », en vert (ou en rouge s'il retire quelque chose).
  function buffText(a, h) {
    const part = (n, ic) => (n ? `<span>${n > 0 ? '+' : ''}${n}${icon(ic)}</span>` : '');
    return part(a, 'sword') + part(h, 'heart');
  }

  async function playShopEvents(events, model, pre) {
    const units = model || null;
    const list = events || [];
    // Les chiffres affichés repartent de l'état d'avant les effets, puis montent à chaque bonus
    // (le système a parfois déjà été redessiné avec les valeurs finales) : chaque +1 se voit.
    const shown = new Map();
    if (!units && ui.state) {
      const p = me();
      for (const u of p.board.concat(p.hand)) shown.set(u.uid, { atk: u.atk, hp: u.hp });
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i], st = shown.get(e.uid);
        if (!st) continue;
        if (e.t === 'buff') { st.atk -= e.a; st.hp -= e.h; }
        else if (e.t === 'swap') { const t = st.atk; st.atk = st.hp; st.hp = t; }
      }
      const touched = new Set(list.filter((e) => e.t === 'buff' || e.t === 'swap').map((e) => e.uid));
      for (const uid of touched) { const st = shown.get(uid); if (st) setStats(elByUid(uid), Math.max(0, st.atk), st.hp, false); }
    }
    let streak = 0;
    for (const e of list) {
      if (e.t !== 'buff') streak = 0;
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
        const st = shown.get(e.uid);
        if (st) { st.atk = Math.max(0, st.atk + e.a); st.hp += e.h; }
        if (el) {
          const atk = st ? st.atk : Math.max(0, Number(el.querySelector('.atk').textContent) + e.a);
          const hp = st ? st.hp : Number(el.querySelector('.hp').textContent) + e.h;
          setStats(el, atk, hp, true);
          const good = e.a + e.h >= 0;
          popOn(el, buffText(e.a, e.h), good ? 'good buff' : 'bad buff');
          const orb = el.querySelector('.orb');
          const [x, y] = center(orb);
          const r = orb.getBoundingClientRect().width * 0.45;
          const col = good ? [159, 240, 154] : [255, 120, 120];
          stage.ring(x, y, r, { n: 26, colors: [col, [255, 255, 255]], speed: 30, life: 0.5, flat: 0.5 });
          stage.burst(x, y, { n: 14, colors: [col, [255, 255, 255]], speed: 40, up: 30, life: 0.6 });
          el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 280, easing: 'ease-out' });
          SFX.buff(panOf(el), streak);
        }
        streak++;
        if (units) { const u = units.find((v) => v.uid === e.uid); if (u) { u.atk += e.a; u.hp += e.h; } }
        await sleep(streak > 3 ? 120 : 190);
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
          const st = shown.get(e.uid);
          if (st) { const t = st.atk; st.atk = st.hp; st.hp = t; setStats(el, st.atk, st.hp, true); }
          else { const a = el.querySelector('.atk').textContent, h = el.querySelector('.hp').textContent; setStats(el, h, a, true); }
          popOn(el, tr('INVERSÉ'), 'info');
        }
      } else if (e.t === 'gold') {
        popOn($('energy'), `+${e.n} ${icon('bolt')}`, 'energy');
        await sleep(200);
      } else if (e.t === 'law') {
        const b = $('powerBtn');
        b.animate([{ borderColor: 'var(--ink)' }, { borderColor: 'var(--faint)' }], { duration: 600 });
      } else if (e.t === 'awake') {
        await awakenScene();
      } else if (e.t === 'relic' || e.t === 'event') {
        const item = e.t === 'relic' ? R.RELIC[e.id] : R.EVENT[ui.state.event];
        if (item) popOn($('cosmosBtn'), item.name.toUpperCase(), 'info');
        await sleep(300);
      } else if (e.t === 'triple' && !units) {
        // Un astre ajouté à la main (Fluctuation, Multivers) complète un trio : fusion dorée.
        renderBoard();
        renderHand();
        const h = $('hand').getBoundingClientRect(), w = 54;
        const fallback = { left: h.left + h.width / 2 - w / 2, top: h.top + h.height / 2 - w / 2, width: w, height: w };
        const sources = e.merged.map((uid) => (pre && pre.get(uid)) || fallback);
        await fusion(e.id, sources, e.uid);
      }
    }
  }

  // Position des astres affichés, avant une action qui pourrait les fusionner.
  function uidRects() {
    const m = new Map();
    for (const el of document.querySelectorAll('#board .unit, #hand .unit')) if (el.dataset.uid) m.set(el.dataset.uid, el.querySelector('.orb').getBoundingClientRect());
    return m;
  }

  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ─── Actions de création ─────────────────────────────────────
  function copyRects(id) {
    return [...document.querySelectorAll(`#board .unit[data-id="${id}"], #hand .unit[data-id="${id}"]`)]
      .filter((el) => !el.classList.contains('golden'))
      .map((el) => el.querySelector('.orb').getBoundingClientRect());
  }

  async function doBuy(slot, fromRect, playAt) {
    const p = me();
    const id = p.shop[slot];
    const check = R.canBuy(ui.state, slot);
    if (!check.ok) { refuse(tr(check.reason)); return false; }
    const before = copyRects(id);
    const res = R.buy(ui.state, slot);
    if (!res.ok) { refuse(tr(res.reason)); return false; }
    tuto('achat');
    SFX.buy();
    vibrate(8);
    if (R.CARD[id].legend) legendClaim(id, fromRect);
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
    SFX.fusion();
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
    popAt(cx, cy - size * 0.62, tr('ASTRE DORÉ'), 'gold');
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

  // slot : { row, index } choisi en glissant, ou rien (l'avant s'il y a de la place).
  async function doPlay(uid, slot, fromRect, targetUid) {
    const pre = uidRects();
    const res = R.play(ui.state, uid, slot ? slot.index : null, targetUid, undefined, slot ? slot.row : undefined);
    if (!res.ok) { refuse(tr(res.reason)); renderHand(); return false; }
    tuto('placer');
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
      if (res.magnet) {
        stage.burst(x, y, { n: 46, colors: [[127, 216, 255], [200, 240, 255], [255, 255, 255]], speed: 110, life: 0.6 });
        landed.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-4deg)' }, { transform: 'scale(0.94) rotate(3deg)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
        SFX.golden();
        vibrate([14, 30, 14]);
      }
      if (res.magnet) { popOn(landed, kwName('arrimage'), 'info'); setStats(landed, me().board.find((u) => u.uid === res.magnet).atk, me().board.find((u) => u.uid === res.magnet).hp, true); }
    }
    await playShopEvents(res.events, null, pre);
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
    if (!res.ok) { refuse(tr(res.reason)); return false; }
    ui.state.qSold = (ui.state.qSold || 0) + 1;
    SFX.sell();
    vibrate(6);
    const before = rects($('board'));
    renderBoard();
    flipFrom($('board'), before);
    renderEnergy();
    renderTavernHead();
    renderPower();
    renderFight();
    // Bonus déclenchés par la vente (Comètes…) : visibles comme les autres.
    if (res.events && res.events.length) playShopEvents(res.events).then(() => renderBoard());
    if (rect && id) {
      const t = tempOrb(id, rect, golden);
      const shop = $('shop').getBoundingClientRect();
      const tx = shop.left + shop.width / 2 - rect.width / 2, ty = shop.top + shop.height / 2 - rect.width / 2;
      stage.reveal(t, 1, 0, 420);
      popAt(rect.left + rect.width / 2, rect.top, `+${res.gain || 1} ${icon('bolt')}`, res.golden ? 'energy gold' : 'energy');
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
    if (!res.ok) { refuse(tr(res.reason)); return; }
    ui.state.qRolls = (ui.state.qRolls || 0) + 1;
    SFX.roll();
    const old = [...$('shop').children].map((el) => ({ id: el.dataset.id, r: el.querySelector('.orb').getBoundingClientRect() }));
    const temps = old.map((o) => tempOrb(o.id, o.r, false));
    temps.forEach((t) => stage.reveal(t, 1, 0, 260));
    setTimeout(() => temps.forEach((t) => t.remove()), 300);
    ui.stamp++;
    renderEnergy(1);
    renderTavernHead();
    renderShop(true);
    renderBoard();
    renderPower();
    renderFight();
    saveGame();
    // Les Comètes grandissent à chaque actualisation : chaque +1 s'affiche, avec son carillon.
    await playShopEvents(res.events);
    renderBoard();
  }

  async function doUpgrade() {
    const res = R.upgrade(ui.state);
    if (!res.ok) { refuse(tr(res.reason)); return; }
    SFX.level();
    vibrate([8, 30, 8]);
    renderEnergy(1);
    renderTavernHead(true);
    const [x, y] = center($('tier'));
    stage.burst(x, y, { n: 30, colors: [[255, 255, 255], [246, 196, 83]], speed: 70, life: 0.7 });
    popOn($('tier'), tr('NIVEAU {n}', { n: res.tier }), 'gold');
    renderPower();
    renderFight();
    saveGame();
  }

  function doFreeze() {
    const res = R.freeze(ui.state);
    if (!res.ok) return;
    const orbs = [...$('shop').querySelectorAll('.orb')];
    ui.frostStagger = true;
    renderShop();
    renderTavernHead();
    ui.frostStagger = false;
    if (res.frozen) {
      // La glace prend une planète après l'autre, de gauche à droite, avec un craquement à chaque fois.
      SFX.freeze();
      orbs.forEach((orb, i) => setTimeout(() => {
        if (!orb.isConnected || !me().frozen) return;
        orb.dataset.frozen = '1';
        SFX.frost(i);
        const [x, y] = stage.center(orb);
        const w = orb.getBoundingClientRect().width;
        stage.burst(x, y + w * 0.45, { n: 14, colors: [[190, 235, 255], [255, 255, 255], [120, 190, 255]], speed: 34, up: 26, gravity: 18, life: 0.9, spread: w * 0.6 });
      }, 90 + i * 140));
      const b = $('shop').getBoundingClientRect();
      for (let i = 0; i < 18; i++) {
        setTimeout(() => stage.burst(b.left + Math.random() * b.width, b.top + Math.random() * 10, { n: 1, colors: [[230, 245, 255]], speed: 6, gravity: 14, drag: 0.4, life: 1.8, size: 1 }), i * 70);
      }
    } else {
      // Dégel : la glace éclate en éclats bleus.
      SFX.thaw();
      orbs.forEach((orb) => {
        orb.dataset.frozen = '0';
        const [x, y] = stage.center(orb);
        const w = orb.getBoundingClientRect().width;
        stage.burst(x, y, { n: 22, colors: [[200, 240, 255], [255, 255, 255], [120, 190, 255]], speed: 90, gravity: 60, life: 0.7, spread: w * 0.5, shape: 3, size: 2 });
      });
    }
    saveGame();
  }

  async function doPower(targetUid) {
    const res = R.usePower(ui.state, targetUid);
    ui.targeting = false;
    document.querySelectorAll('#board .unit.target').forEach((el) => el.classList.remove('target'));
    if (!res.ok) { refuse(tr(res.reason)); renderPower(); return; }
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

  // La place visée dans le système : la rangée (moitié haute = avant), puis le rang dans la rangée.
  function boardSlotAt(x, y, skip) {
    const box = $('board').getBoundingClientRect();
    const row = y < box.top + box.height / 2 ? 0 : 1;
    let index = 0;
    for (const el of $('board').children) {
      if (el.dataset.key === skip || rowOfEl(el) !== row) continue;
      const b = el.getBoundingClientRect();
      if (x > b.left + b.width / 2) index++;
    }
    return { row, index };
  }

  // La Machine où l'astre Arrimage glissé s'aimante : la plus proche, à moins d'une largeur d'astre
  // de son centre (l'aimant l'attire, inutile de viser juste).
  function magnetTargetAt(x, y, unit) {
    if (!unit || !unit.kw.includes('arrimage')) return null;
    let best = null, bd = Infinity;
    for (const el of $('board').children) {
      const u = me().board.find((v) => v.uid === el.dataset.uid);
      if (!u || !R.canMagnet(unit, u)) continue;
      const b = el.querySelector('.orb').getBoundingClientRect();
      const d = Math.hypot(x - (b.left + b.width / 2), y - (b.top + b.height / 2));
      if (d < Math.max(b.width, 40) * 1.05 && d < bd) { best = el; bd = d; }
    }
    return best;
  }

  // Aperçu de la pose : la rangée visée s'éclaire et ses astres s'écartent. Rangée pleine : un
  // astre déplacé échange sa place avec celui qu'il vise ; un nouvel astre est refusé.
  function previewBoard(slot, skip) {
    const p = me();
    const moving = drag.src === 'board' ? p.board.find((u) => u.uid === skip) : null;
    const count = p.board.filter((u) => u !== moving && R.rowOf(u) === slot.row).length;
    const swap = !!moving && R.rowOf(moving) !== slot.row && count >= R.ROW_MAX;
    const room = swap || (count < R.ROW_MAX && (moving || p.board.length < R.BOARD_MAX));
    const board = $('board');
    board.classList.add('previewing', 'drop-' + slot.row);
    board.classList.toggle('cant', !room);
    const kids = [...board.children].filter((el) => el.dataset.key !== skip && rowOfEl(el) === slot.row);
    kids.forEach((el, i) => {
      const w = el.getBoundingClientRect().width;
      el.style.setProperty('--sx', !room || swap ? '0px' : (i < slot.index ? -w * 0.3 : w * 0.3) + 'px');
      el.classList.toggle('swap', swap && i === Math.min(slot.index, kids.length - 1));
    });
  }
  function clearPreview() {
    for (const el of $('board').children) { el.style.removeProperty('--sx'); el.classList.remove('swap'); }
    $('board').classList.remove('previewing', 'drop-0', 'drop-1', 'cant');
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
      if (drag.unit && drag.unit.kw.includes('arrimage')) {
        for (const el of $('board').children) {
          const u = me().board.find((v) => v.uid === el.dataset.uid);
          if (u && R.canMagnet(drag.unit, u)) el.classList.add('magnetable');
        }
      }
      SFX.tap();
    }
    const scale = drag.src === 'hand' ? 1.35 : 1.12;
    let gx = e.clientX, gy = e.clientY;
    const pull = drag.src === 'hand' ? magnetTargetAt(e.clientX, e.clientY, drag.unit) : null;
    if (pull) {
      // L'aimant attire l'astre : il glisse à mi-chemin vers le centre de la Machine.
      const b = pull.querySelector('.orb').getBoundingClientRect();
      gx += (b.left + b.width / 2 - gx) * 0.55;
      gy += (b.top + b.height / 2 - drag.h * 0.08 - gy) * 0.55;
      if (drag.pulled !== pull.dataset.uid) { drag.pulled = pull.dataset.uid; SFX.slot(); vibrate(8); }
    } else drag.pulled = null;
    drag.ghost.classList.toggle('pulled', !!pull);
    drag.ghost.style.transform = `translate(${gx - drag.w / 2}px, ${gy - drag.h * 0.42}px) scale(${scale})`;
    const zone = zoneAt(e.clientX, e.clientY);
    clearPreview();
    drag.zone = zone;
    drag.magnet = null;
    if (zone === 'board') {
      const m = drag.src === 'hand' ? magnetTargetAt(e.clientX, e.clientY, drag.unit) : null;
      if (m) { m.classList.add('magnet'); drag.magnet = m.dataset.uid; }
      else {
        const slot = boardSlotAt(e.clientX, e.clientY, drag.src === 'board' ? drag.key : null);
        if (drag.slot && (slot.row !== drag.slot.row || slot.index !== drag.slot.index)) SFX.slot();
        drag.slot = slot;
        previewBoard(slot, drag.src === 'board' ? drag.key : null);
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
    document.querySelectorAll('.unit.magnetable').forEach((el) => el.classList.remove('magnetable'));
    if (!d.moved) {
      // La fiche s'ouvre au « click » qui suit : l'ouvrir dès le relâchement laisserait ce click
      // tomber sur le fond de la feuille (et la refermer aussitôt) ou sur l'un de ses boutons.
      if (!cancelled) tap = { src: d.src, el: d.el, t: performance.now() };
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
          acted = await doBuy(Number(d.el.dataset.slot), ghostRect, d.zone === 'board' ? d.slot : null);
        } else if (d.src === 'hand' && d.zone === 'board') {
          finish();
          acted = await doPlay(d.key, d.slot, ghostRect, d.magnet);
        } else if (d.src === 'board' && d.zone === 'tavern') {
          finish();
          acted = await doSell(d.key, ghostRect);
        } else if (d.src === 'board' && d.zone === 'board') {
          const before = rects($('board'));
          const mv = R.move(ui.state, d.key, d.slot.row, d.slot.index);
          if (mv.ok) tuto('rangee');
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

  let tap = null;
  document.addEventListener('click', (e) => {
    const t = tap;
    tap = null;
    if (!t || performance.now() - t.t > 800 || !t.el.isConnected || !t.el.contains(e.target)) return;
    if (ui.screen === 'game' && !ui.busy && $('overlay').hidden) openDetail(t.src, t.el);
  });
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
    tuto('fermer');
  }
  // Les curseurs de volume agissent pendant qu'on les fait glisser ; lâcher celui des effets fait
  // entendre le nouveau niveau.
  listen('sheet', 'input', (e) => {
    const r = e.target.closest('[data-vol]');
    if (!r) return;
    const v = Number(r.value) / 100;
    if (r.dataset.vol === 'music') SFX.setMusicVol(v); else SFX.setFxVol(v);
    r.style.setProperty('--p', r.value + '%');
    const out = r.parentElement.querySelector('b');
    if (out) out.textContent = r.value + ' %';
  });
  listen('sheet', 'change', (e) => { if (e.target.closest('[data-vol="fx"]')) SFX.tap(); });

  listen('overlay', 'click', (e) => {
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
      actions = `<button class="btn primary" data-act="buy" data-slot="${slot}" ${can.ok ? '' : 'disabled'}>${tr('ACHETER')} · 3 ${icon('bolt')}</button>`;
      if (!can.ok) actions += `<p class="muted">${esc(tr(can.reason))}</p>`;
    } else if (src === 'hand') {
      u = p.hand.find((v) => v.uid === el.dataset.uid);
      const full = p.board.length >= R.BOARD_MAX;
      actions = `<button class="btn primary" data-act="play" data-uid="${u.uid}" ${full ? 'disabled' : ''}>${tr('PLACER DANS LE SYSTÈME')}</button>`;
      for (const h of p.board.filter((v) => R.canMagnet(u, v))) actions += `<button class="btn" data-act="magnet" data-uid="${u.uid}" data-target="${h.uid}">${tr('ARRIMER À {name}', { name: esc(R.CARD[h.id].name).toUpperCase() })}</button>`;
      if (full) actions += `<p class="muted">${tr('Votre système est plein : vendez un astre.')}</p>`;
    } else {
      u = p.board.find((v) => v.uid === el.dataset.uid);
      const mates = p.board.filter((v) => R.rowOf(v) === R.rowOf(u));
      const i = mates.indexOf(u);
      const other = p.board.filter((v) => R.rowOf(v) !== R.rowOf(u)).length;
      actions = `<button class="btn" data-act="left" data-uid="${u.uid}" ${i === 0 ? 'disabled' : ''}>${icon('back')}</button>
        <button class="btn primary ${u.golden ? 'sell-gold' : ''}" data-act="sell" data-uid="${u.uid}">${tr('VENDRE')} · +${R.sellGain(ui.state, p, u)} ${icon('bolt')}</button>
        <button class="btn" data-act="right" data-uid="${u.uid}" ${i === mates.length - 1 ? 'disabled' : ''}><span style="display:inline-block;transform:scaleX(-1)">${icon('back')}</span></button>
        <button class="btn wide" data-act="row" data-uid="${u.uid}">${R.rowOf(u) ? tr('PASSER À L’AVANT') : tr('PASSER À L’ARRIÈRE')}${other >= R.ROW_MAX ? ' · ' + tr('ÉCHANGE') : ''}</button>`;
    }
    if (!u) return;
    SFX.tap();
    openSheet(unitSheet(u) + `<div class="sheet-actions">${actions}</div>`);
    tuto('fiche');
  }

  function unitSheet(u) {
    const c = R.CARD[u.id], f = R.FAMILIES[c.fam];
    const att = (u.att || []).length ? `<p class="muted">${tr('Arrimés : {list}', { list: u.att.map((a) => esc(R.CARD[a.id].name)).join(', ') })}</p>` : '';
    return `<div class="sheet-top">
        <div class="orb sheet-orb" data-planet="${u.id}" data-golden="${u.golden ? 1 : 0}" data-shield="${u.kw.includes('bouclier') ? 1 : 0}" data-ghost="${u.kw.includes('renaissance') ? 1 : 0}"></div>
        <div>
          <span class="fam-chip" style="--c:${f.color}">${c.legend ? tr('LÉGENDAIRE') + ' · ' : ''}${f.name.toUpperCase()} · ${tr('NIVEAU {n}', { n: c.tier })}${u.golden ? ' · ' + tr('DORÉ') : ''}</span>
          <h2>${esc(c.name)}</h2>
          ${statsHtml(u.atk, u.hp, 'sheet-stats')}
        </div>
      </div>
      ${effectHtml(u.id, u.golden, u.kw)}${att}`;
  }

  // ─── Comprendre un astre ────────────────────────────────────
  // Termes des textes, expliqués sous l'effet.
  const TERMS_FR = {
    'Début de combat': 'Se déclenche juste avant la première attaque.',
    'Début de cycle': 'Se déclenche au début de chaque phase d’achat.',
    'Fin de cycle': 'Se déclenche quand vous lancez le combat, à la fin de vos achats.',
    'Naissance': 'Se déclenche quand vous placez l’astre dans votre système.',
    'Effondrement': 'Se déclenche quand l’astre est détruit en combat.',
    'Habitable': 'Ne fonctionne que si votre système contient un Soleil.',
    'Soleil': 'Compte comme un Soleil pour les effets Habitable.',
    'Débris': 'Petit astre de roche laissé par un monde effondré.',
    'pour le combat': 'Le bonus disparaît à la fin du combat.',
    'Vendu': 'Se déclenche quand vous vendez l’astre.',
    'actualisez': 'Faire naître de nouveaux astres dans la Création avec le bouton d’actualisation.',
    'actualisation': 'Faire naître de nouveaux astres dans la Création avec le bouton d’actualisation.',
    'découvrez': 'Choisissez un astre parmi trois.',
    'mot-clé aléatoire': 'Bouclier, Rafale, Toxique, Renaissance ou Rempart.',
    'voisins': 'Les astres juste à sa gauche et à sa droite.',
    'voisin': 'Un astre juste à sa gauche ou à sa droite.'
  };
  const TERMS = Object.fromEntries(Object.entries(TERMS_FR).map(([k, v]) => [tr(k), tr(v)]));
  const HOOKS = ['play', 'endTurn', 'startTurn', 'buy', 'start', 'attack', 'allyAttack', 'allyDeath', 'shieldBreak', 'damaged', 'allyKill', 'reborn', 'allyReborn', 'allyPlay', 'roll', 'sold'];
  function cardMarks(id) {
    const c = R.CARD[id];
    return {
      death: typeof c.death === 'function',
      effect: HOOKS.some((h) => typeof c[h] === 'function') || !!c.sun || FX_TEXT.has(id)
    };
  }
  const KW_BY_NAME = Object.fromEntries(Object.entries(R.KEYWORDS).map(([k, v]) => [v.name, k]));
  const WORDS = [...Object.keys(TERMS), ...Object.keys(KW_BY_NAME)].sort((a, b) => b.length - a.length);
  const WORD_RE = new RegExp('(' + WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|') + ')', 'g');

  function statsHtml(atk, hp, cls) {
    return `<div class="${cls}"><span class="stat"><span class="atk">${atk}</span><small>${tr('ATTAQUE')}</small></span><span class="stat"><span class="hp">${hp}</span><small>${tr('PV')}</small></span></div>`;
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
    const kwHtml = defs.join('') + kwList([...kws]);
    const power = text ? `<p class="sheet-text">${rich}</p>` : `<p class="sheet-text plain">${tr('Aucun pouvoir : un astre simple, sans effet.')}</p>`;
    return `<div class="power-box" style="--c:${R.FAMILIES[R.CARD[id].fam].color}"><span class="power-label">${tr('POUVOIR')}</span>${power}</div>${kwHtml ? `<div class="kw-list">${kwHtml}</div>` : ''}`;
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
    peek.innerHTML = `<span class="fam-chip" style="--c:${f.color}">${c.legend ? tr('LÉGENDAIRE') + ' · ' : ''}${f.name.toUpperCase()} · ${tr('NIVEAU {n}', { n: c.tier })}${golden ? ' · ' + tr('DORÉ') : ''}</span>
      <h4>${esc(c.name)}</h4>${statsHtml(atk, hp, 'peek-stats')}${effectHtml(id, golden, [...kw])}`;
    peek.hidden = false;
    peek.style.zoom = ui.z === 1 ? '' : String(ui.z);
    const b = el.getBoundingClientRect();
    const w = peek.offsetWidth * ui.z, h = peek.offsetHeight * ui.z;
    const x = Math.max(10, Math.min(window.innerWidth - w - 10, b.left + b.width / 2 - w / 2));
    const below = b.top + b.height / 2 < window.innerHeight / 2;
    const y = below ? Math.min(window.innerHeight - h - 10, b.bottom + 8) : Math.max(10, b.top - h - 8);
    placeAt(peek, x, y);
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

  listen('sheet', 'click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const act = b.dataset.act;
    // Pendant un combat (en ligne, on ne peut pas le passer), le son et l'aide restent accessibles ;
    // quitter la partie attend la fin du combat. Les Paramètres ne dépendent jamais d'une partie.
    const anytime = act === 'choose' || act === 'relic' || act === 'close' || act === 'rival' || act === 'set' || (act === 'menu' && (b.dataset.v === 'sound' || b.dataset.v === 'help'));
    if (ui.busy && !anytime) { if (act === 'menu') toast(tr('Possible à la fin du combat.'), 1800); return; }
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
      await doPlay(b.dataset.uid, null, r, act === 'magnet' ? b.dataset.target : null).finally(() => { ui.busy = false; });
    } else if (act === 'sell') {
      closeSheet();
      ui.busy = true;
      await doSell(b.dataset.uid).finally(() => { ui.busy = false; });
    } else if (act === 'left' || act === 'right' || act === 'row') {
      const p = me(), u = p.board.find((v) => v.uid === b.dataset.uid);
      const i = p.board.filter((v) => R.rowOf(v) === R.rowOf(u)).indexOf(u);
      const before = rects($('board'));
      if (act === 'row') { R.move(ui.state, u.uid, 1 - R.rowOf(u), null); tuto('rangee'); }
      else R.reorder(ui.state, u.uid, i + (act === 'left' ? -1 : 1));
      renderBoard();
      flipFrom($('board'), before);
      SFX.tap();
      saveGame();
      closeSheet();
    } else if (act === 'choose') {
      await chooseDiscover(Number(b.dataset.i), b);
    } else if (act === 'relic') {
      pickRelic(Number(b.dataset.i), b);
    } else if (act === 'close') {
      closeSheet();
    } else if (act === 'menu') {
      menuAction(b.dataset.v);
    } else if (act === 'set') {
      const v = b.dataset.v;
      if (v === 'resume') { closeSheet(); await resumeGame(); }
      else if (v === 'daily-go') { closeSheet(); await dailyGo(); }
      else if (v === 'daily-board') { await openDailyBoard(); }
      else if (v === 'new') { closeSheet(); await newGameFlow(Number(b.dataset.size) || 2); }
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
    codexMark(p.discover);
    return new Promise((resolve) => {
      ui.discoverDone = resolve;
      const items = p.discover.map((id, i) => {
        const c = R.CARD[id], f = R.FAMILIES[c.fam];
        // La couleur de la famille encadre l'astre ; on rappelle combien de ses cousins sont déjà là.
        const kin = c.fam === 'neutre' ? 0 : p.board.concat(p.hand).filter((u) => R.famOf(u) === c.fam).length;
        const mine = R.LAW[p.law].fam === c.fam;
        return `<button class="discover-item${mine ? ' mine' : ''}${c.legend ? ' legend' : ''}" data-act="choose" data-i="${i}" style="--c:${f.color}">
          <span class="fam-chip">${c.legend ? tr('LÉGENDAIRE') + ' · ' : ''}${f.name.toUpperCase()}</span>
          <div class="orb" data-planet="${id}"></div>
          <b>${esc(c.name)}</b>
          <em class="kin">${mine ? tr('Famille de votre loi') : kin ? tr('{n} dans votre système', { n: kin }) : '&nbsp;'}</em>
          <span class="s"><span class="atk">${c.atk}</span> · <span class="hp">${c.hp}</span></span>
          <small>${esc(R.cardText(id, false))}</small>
        </button>`;
      }).join('');
      openSheet(`<h3>${tr('DÉCOUVERTE · NIVEAU {n}', { n: R.CARD[p.discover[0]].tier })}</h3><h2>${tr('Choisissez un astre')}</h2><div class="discover-list${p.discover.length > 3 ? ' four' : ''}">${items}</div>`, { center: true, locked: true });
    });
  }

  async function chooseDiscover(i, btn) {
    const r = btn.querySelector('.orb').getBoundingClientRect();
    const id = me().discover[i];
    const prior = copyRects(id);
    const res = R.choose(ui.state, i);
    closeSheet();
    if (!res.ok) { refuse(tr(res.reason)); return; }
    SFX.buy();
    renderHand();
    renderBoard();
    if (res.lost) toast(tr('Plus de place : l’astre retourne à la réserve.'));
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
  // Un système vu de loin (rival, fin de partie) : l'avant au-dessus, l'arrière dessous.
  function staticRows(board) {
    const [front, back] = R.layout(board || []);
    if (!front.length && !back.length) return `<span class="muted">${tr('Système vide')}</span>`;
    const line = (list, row) => `<div class="srow"><small>${rowName(row)}</small><div class="row">${list.map(staticUnit).join('') || '<span class="muted">–</span>'}</div></div>`;
    return `<div class="static-rows">${line(front, 0)}${back.length ? line(back, 1) : ''}</div>`;
  }
  const staticUnit = (u) => `<div class="unit" data-id="${u.id}" data-golden="${u.golden ? 1 : 0}" data-kw="${u.kw.join(' ')}"><div class="orb" data-planet="${u.id}" data-golden="${u.golden ? 1 : 0}"></div><div class="stats"><b class="atk">${u.atk}</b><b class="hp">${u.hp}</b></div></div>`;

  function openRivals() {
    const s = ui.state;
    const duel = R.isDuel(s);
    const list = s.players.slice().sort((a, b) => (b.alive - a.alive) || (a.alive ? b.hp - a.hp : a.rank - b.rank));
    const last = me().lastOpp;
    const nx = !duel && s.phase === 'shop' ? R.nextOpponent(s) : null;
    const rows = list.map((p, i) => {
      // En ligne, les autres créateurs ne sont pas des bots : seul le joueur lui-même est « VOUS ».
      const mine = p === me();
      const isNext = !!nx && nx === p;
      const board = staticRows(p.bot || p.remote ? p.seen || [] : p.board);
      const hp = Math.max(0, p.hp);
      const lost = ui.prevHp && ui.prevHp[p.id] != null && p.hp < ui.prevHp[p.id] ? ui.prevHp[p.id] - p.hp : 0;
      const tag = isNext ? `<em class="next">${tr('PROCHAIN ADVERSAIRE')}</em>` : !mine && p.id === last ? `<em>${tr('DERNIER ADVERSAIRE')}</em>` : '';
      return `<button class="rival-row ${p.alive ? '' : 'dead'} ${mine ? 'me' : ''} ${isNext ? 'next' : ''}" data-act="rival">
          <span class="rk">${p.alive ? i + 1 : p.rank}</span>${s.mp ? `<span class="pl-av">${playerAv(p)}</span>` : ''}
          <span class="rv-who"><span class="n">${playerName(p, mine ? tr('VOUS') : p.name)}</span>${tag}<span class="l">${tr('niveau {n}', { n: p.tier })}${p.alive ? '' : ' · ' + tr('éliminé {rank}', { rank: ordinal(p.rank) })}</span></span>
          <span class="rv-hp">${lost ? `<small>−${lost}</small>` : ''}<b>${p.alive ? hp : '–'}</b><i class="hp-bar"><i style="width:${p.alive ? Math.min(100, hp / (p.maxHp || R.START_HP) * 100) : 0}%"></i></i></span>
        </button>
        <div class="rival-board" ${(duel && p !== me()) || isNext ? '' : 'hidden'}><p class="rv-last">${p.bot || p.remote ? tr('Système joué au dernier combat') : tr('Votre système')}</p>${board}</div>`;
    }).join('');
    const note = duel
      ? tr('Voici le système que votre rival a joué au dernier combat. Préparez votre placement : chaque astre de l’avant frappe celui d’en face.')
      : tr('Vous affrontez d’abord ceux que vous n’avez pas croisés depuis le plus longtemps, jamais deux fois de suite : votre prochain adversaire est annoncé pendant la boutique, son dernier système est déjà ouvert. Touchez un univers pour voir le sien. Dégâts plafonnés à {n} tant que plus de trois univers sont en vie.', { n: R.DAMAGE_CAP });
    const ghostNext = nx && nx.ghost ? `<p class="rv-ghost">${tr('Prochain adversaire : {name}', { name: `<b>${esc(tr('{name} (fantôme)', { name: nx.name }))}</b>` })}</p>${staticRows(nx.board)}` : '';
    openSheet(`<h3>${duel ? tr('DUEL') : tr('UNIVERS EN LICE · {n}', { n: R.alivePlayers(s).length })}</h3>${ghostNext}<div class="rival-list ${s.mp ? 'av' : ''}">${rows}</div>
      <p class="muted">${note}</p>`, { top: true });
    tuto('repere');
  }

  function openFamilies() {
    const p = me();
    const items = ui.state.families.concat(['neutre']).map((f) => {
      const n = p.board.filter((u) => R.famOf(u) === f).length;
      // Chaque famille : son effet propre, puis ses formations à l'avant et à l'arrière (niveau I).
      const forms = f === 'neutre' ? '' : `<p class="fam-form"><b>${tr('AVANT')}</b> ${esc(R.formText(f, 0, 1))}</p><p class="fam-form"><b>${tr('ARRIÈRE')}</b> ${esc(R.formText(f, 1, 1))}</p>`;
      return `<div class="fam-item" style="--c:${famColor(f)}"><b>${R.FAMILIES[f].name.toUpperCase()}</b> <small>· ${tr('{n} dans votre système', { n })}</small><p>${esc(R.FAMILIES[f].text)}</p>${forms}</div>`;
    }).join('');
    const law = R.LAW[p.law];
    const active = R.formationsOf(p.board);
    const now = active.length
      ? active.map((f) => `<div class="fam-item" style="--c:${famColor(f.fam)}"><b>${formLabel(f)}</b> <small>· ${tr('{n} astres', { n: f.n })}</small><p>${esc(R.formText(f.fam, f.row, f.lvl))}</p></div>`).join('')
      : `<p class="muted">${tr('Aucune formation pour l’instant.')}</p>`;
    const phen = R.phenomenaOf(p.board).map((x) => x.kind);
    const phenHtml = Object.entries(R.PHENOMENA).map(([k, ph]) => `<div class="fam-item ph-item ${phen.includes(k) ? 'on' : ''}"><b>✦ ${esc(tr(ph.name)).toUpperCase()}</b>${phen.includes(k) ? ` <small>· ${tr('actif')}</small>` : ''}<p>${esc(tr(ph.text))}</p></div>`).join('');
    const posHtml = ['portee', 'percee', 'garde'].map((k) => `<div class="fam-item" style="--c:var(--ink)"><b>${icon({ portee: 'range', percee: 'pierce', garde: 'guard' }[k])} ${esc(R.KEYWORDS[k].name).toUpperCase()}</b><p>${esc(R.KEYWORDS[k].text)}</p></div>`).join('');
    openSheet(`<h3>${tr('VOS FORMATIONS')}</h3>${now}
      <p class="muted">${tr('Deux astres d’une même famille dans la même rangée forment une formation : niveau I à 2 astres, II à 3, III à 4. Chaque famille a un bonus à l’avant et un autre à l’arrière, au début du combat.')}</p>
      <h3 style="margin-top:18px">${tr('PHÉNOMÈNES')}</h3>
      <p class="muted">${tr('Des combinaisons de placement qui transforment un astre au début du combat. « Juste derrière » : l’astre de l’arrière dans la même colonne.')}</p>
      <div class="fam-list">${phenHtml}</div>
      <h3 style="margin-top:18px">${tr('L’ARRIÈRE AU COMBAT')}</h3><div class="fam-list">${posHtml}</div>
      <h3 style="margin-top:18px">${tr('FAMILLES DE CET UNIVERS')}</h3><div class="fam-list">${items}</div>
      <h3 style="margin-top:18px">${tr('VOTRE LOI')}</h3>${lawHtml(p)}`);
  }

  // ─── Événement cosmique, reliques, éveil des lois (v84) ─────
  const RELIC_GLYPH = { tresor: '◆', longuevue: '◎', comptoir: '⇄', elan: '⇑', banniere: '⚑', lance: '➶', bastion: '▣', reserve: '⇡', egide: '⬡', dard: '✶', braise: '✹', alchimie: '✦' };
  // tag : 'button' pour un choix (attrs : data-act…), sinon une simple fiche.
  function relicHtml(id, attrs) {
    const r = R.RELIC[id], tag = attrs ? 'button' : 'div';
    return `<${tag} class="relic-item" ${attrs || ''}><span class="relic-glyph">${RELIC_GLYPH[id] || '✦'}</span><span><b>${esc(r.name).toUpperCase()}</b><p>${esc(r.text)}</p></span></${tag}>`;
  }
  // Pictos des événements cosmiques (v98) : un dessin en pixels 12 × 12 par événement.
  const EVENT_ART = {
    meteores: { pal: { w: '#ffffff', y: '#ffe08a', o: '#ff9a3c', r: '#b8432c' }, rows: ['............', '..........rr', '.........oo.', '........oo..', '.....rywo...', '....rrww....', '...oo.....rr', '..oo.....rr.', 'ywo.....oo..', 'ww.....oo...', '.....ywo....', '.....ww.....'] },
    abondance: { pal: { c: '#5ee7ff', w: '#ffffff', s: '#b8f6ff' }, rows: ['......cc....', '.s...cw.....', '....cc......', '...ccwwcc...', '......cc....', '.....cc.....', '....wc......', '...cc....s..', '..cc....s.s.', '.........s..', '............', '............'] },
    feconde: { pal: { g: '#5fd35a', d: '#2f7a3a', l: '#b6f5a8', y: '#ffd447' }, rows: ['............', '.........y..', '........yyy.', '....gg...y..', '..gglggg....', '..glgggg....', '.ggggggdd...', '.gggggddd...', '..gggddd....', '..ggdddd....', '....dd......', '............'] },
    recyclage: { pal: { g: '#3fbf7f', l: '#a8ffcf' }, rows: ['............', '....gggg....', '...gg..gg...', '..g......g..', '.gg.....llll', '.l.......ll.', '.ll.......l.', 'llll.....gg.', '..g......g..', '...gg..gg...', '....gggg....', '............'] },
    expansion: { pal: { y: '#ffd447', w: '#fff6c8', o: '#f0a830', r: '#a8661a' }, rows: ['.....ww.....', '....yyyy....', '...yyyyyy...', '..yyyyyyyy..', '.yyyyyyyyyy.', '....yyyy....', '....yyyy....', '....yyyy....', '....yyyy....', '..oooooooo..', '.rrrrrrrrrr.', '.rrrrrrrrrr.'] },
    revelation: { pal: { v: '#b48cff', c: '#5ee7ff', k: '#1a1030', w: '#ffffff' }, rows: ['............', '............', '............', '....vvvv....', '..vv.cc.vv..', '.v..ckkw..v.', 'v...ckkc...v', '.v..cccc..v.', '..vv.cc.vv..', '....vvvv....', '............', '............'] },
    legendes: { pal: { y: '#ffd447', o: '#c98a1a', r: '#ff5a7a', b: '#5ee7ff', g: '#7dff8a' }, rows: ['............', '............', '.....bb.....', '.r........g.', '.y...yy...y.', '.y...yy...y.', '.yy.yyyy.yy.', '.yyyyyyyyyy.', '.yyyyyyyyyy.', '.yyryybygyy.', '.oooooooooo.', '............'] },
    vent: { pal: { y: '#fff2a8', o: '#ffb347', p: '#ffe08a', w: '#ffffff' }, rows: ['............', '............', '......ppppw.', '............', '..oyo.......', '.oyyyo.ppppw', '.oyyyo......', '..oyo.......', '......pppw..', '............', '.....pppw...', '............'] },
    aurore: { pal: { e: '#e6ffff', g: '#2fd18a', p: '#c2457f', c: '#7fd8ff' }, rows: ['............', '.eeeeeeeeee.', '.egcggppgce.', '.ecggppgcge.', '.eggppgcgge.', '.egppgcggpe.', '..epgcggpe..', '...ecggpe...', '....egpe....', '.....ee.....', '............', '............'] },
    maree: { pal: { b: '#2f6fd6', l: '#7fd8ff', w: '#ffffff' }, rows: ['............', '............', '............', '......ww....', '.....lll....', '....lbbblw..', '...lbbbll...', '..wlbbl....l', 'l...bbbl..lb', 'blllbbbbllbb', 'bbbbbbbbbbbb', 'bbbbbbbbbbbb'] },
    instable: { pal: { l: '#c8ff3a', m: '#ff4fd8', c: '#5ee7ff' }, rows: ['............', '.m........m.', '..mllllllc..', '...mllllllc.', '...mllllllc.', '.mllllllc...', '....mllllllc', '..mllllllc..', 'mllllllc....', '...mllllllc.', 'm..........m', '......m.....'] }
  };
  function eventIcon(id, cls) {
    const a = EVENT_ART[id];
    if (!a) return `<span class="ev-ico ${cls || ''}">✺</span>`;
    let rects = '';
    a.rows.forEach((row, y) => [...row].forEach((c, x) => { if (a.pal[c]) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${a.pal[c]}"/>`; }));
    return `<svg class="ev-ico ${cls || ''}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }
  function eventHtml(id) {
    const e = R.EVENT[id];
    return e ? `<div class="event-item"><span class="event-glyph">${eventIcon(id)}</span><span><small>${tr('ÉVÉNEMENT COSMIQUE')}</small><b>${esc(e.name).toUpperCase()}</b><p>${esc(e.text)}</p></span></div>` : '';
  }
  function lawHtml(p) {
    const law = R.LAW[p.law];
    const body = p.awake
      ? `<p class="awk on"><b>${tr('ÉVEILLÉE')}</b> ${esc(law.awake)}</p>`
      : `<p>${esc(law.text)}</p><p class="awk"><b>${tr('ÉVEIL AU CYCLE {n}', { n: R.AWAKE_ROUND })}</b> ${esc(law.awake)}</p>`;
    return `<div class="fam-item${p.awake ? ' awake' : ''}" style="--c:${famColor(law.fam)}"><b>${esc(law.name).toUpperCase()}</b>${body}</div>`;
  }
  // Le bouton ✺ du haut : l'événement de la partie, vos reliques (et celles du rival en duel), votre loi.
  function openCosmos() {
    const s = ui.state, p = me();
    const list = (rels) => `<div class="relic-list">${rels.map((id) => relicHtml(id)).join('')}</div>`;
    const mine = (p.relics || []).length ? list(p.relics)
      : `<p class="muted">${tr('Aucune relique pour l’instant. Vous en choisirez une au début des cycles {a} et {b}.', { a: R.RELIC_ROUNDS[0], b: R.RELIC_ROUNDS[1] })}</p>`;
    const rival = R.isDuel(s) ? s.players[1] : null;
    const theirs = rival && (rival.relics || []).length ? `<h3 style="margin-top:18px">${tr('RELIQUES DE {name}', { name: esc(rival.name) })}</h3>${list(rival.relics)}` : '';
    openSheet(`${s.event ? eventHtml(s.event) : `<h3>${tr('ÉVÉNEMENT COSMIQUE')}</h3><p class="muted">${tr('Aucun événement dans cette partie.')}</p>`}
      <h3 style="margin-top:18px">${tr('VOS RELIQUES')}</h3>${mine}${theirs}
      <h3 style="margin-top:18px">${tr('VOTRE LOI')}</h3>${lawHtml(p)}`);
  }
  // Au début de la partie : l'événement cosmique, en grand.
  function openEventCard(done) {
    const e = R.EVENT[ui.state.event];
    SFX.legend(false);
    openSheet(`<div class="event-card"><span class="event-glyph big">${eventIcon(ui.state.event)}</span><h3>${tr('ÉVÉNEMENT COSMIQUE')}</h3><h2>${esc(e.name)}</h2><p>${esc(e.text)}</p>
      <p class="muted">${tr('Il s’applique à tous les univers, pendant toute la partie.')}</p>
      <div class="sheet-actions"><button class="btn primary" data-act="close">${tr('C’EST PARTI')}</button></div></div>`, { center: true, onClose: done });
  }
  // Début des cycles 4 et 8 : une relique parmi trois.
  function openRelics() {
    const p = me();
    if (!p.relicChoice || !p.relicChoice.length) return Promise.resolve();
    return new Promise((resolve) => {
      ui.relicDone = resolve;
      const items = p.relicChoice.map((id, i) => relicHtml(id, `data-act="relic" data-i="${i}"`)).join('');
      openSheet(`<h3>${tr('RELIQUE · CYCLE {n}', { n: ui.state.round })}</h3><h2>${tr('Choisissez une relique')}</h2><p class="muted">${tr('Elle reste avec vous jusqu’à la fin de la partie.')}</p><div class="relic-list pick">${items}</div>`, { center: true, locked: true });
    });
  }
  function pickRelic(i, btn) {
    const res = R.chooseRelic(ui.state, i);
    if (!res.ok) { closeSheet(); return; }
    if (btn) { const [x, y] = center(btn); stage.burst(x, y, { n: 26, colors: [[255, 226, 140], [255, 255, 255]], speed: 90, life: 0.6 }); }
    SFX.golden();
    closeSheet();
    toast(tr('Relique : {name}', { name: R.RELIC[res.id].name }), 2200);
    renderHud();
    renderTavernHead();
    renderEnergy();
    saveGame();
    const done = ui.relicDone;
    ui.relicDone = null;
    if (done) done();
  }
  // En ligne, la fin du temps choisit la première relique.
  function autoRelic() {
    const p = me();
    if (!p || !p.relicChoice || !p.relicChoice.length) return;
    pickRelic(0, null);
  }
  // Cycle 6 : la loi s'éveille.
  async function awakenScene() {
    const p = me(), law = R.LAW[p.law];
    renderPower();
    const b = $('powerBtn');
    const [x, y] = center(b);
    stage.burst(x, y, { n: 46, colors: [hexRgb(famColor(law.fam)), [255, 255, 255]], speed: 130, life: 0.9 });
    b.animate([{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.18)', filter: 'brightness(2.2)' }, { transform: 'scale(1)', filter: 'brightness(1)' }], { duration: 1000, easing: 'cubic-bezier(.2,.8,.2,1)' });
    SFX.level();
    banner(tr('LOI ÉVEILLÉE'), `<b>${esc(law.name)}</b> · ${esc(law.awake)}`, 'awake', true);
    await sleep(2800);
    clearBanner();
  }

  function openMenu() {
    openSheet(`<h3>${tr('MENU')}</h3><div class="menu-list-sheet">
      <button class="btn" data-act="menu" data-v="sound">${SFX.muted ? tr('ACTIVER LE SON') : tr('COUPER LE SON')}</button>
      ${volumesHtml()}
      <button class="btn" data-act="menu" data-v="help">${tr('COMMENT JOUER')}</button>
      <button class="btn" data-act="menu" data-v="home">${tr('MENU PRINCIPAL (PARTIE SAUVEGARDÉE)')}</button>
      <button class="btn ghost" data-act="menu" data-v="quit">${tr('ABANDONNER LA PARTIE')}</button>
    </div>`);
  }

  function helpHtml(fromSettings) {
    const ic = { sword: icon('sword'), heart: icon('heart'), skull: icon('skull'), spark: icon('spark') };
    return `<h3>${tr('COMMENT JOUER')}</h3><ul class="help">
      <li>${tr('En <b>duel</b>, vous affrontez un seul rival, cycle après cycle. Chaque cycle : vous achetez, vous placez, puis votre système combat seul. Le premier à 0 PV perd. La <b>mêlée à 8</b> (Multijoueur) suit les mêmes règles contre sept univers.')}</li>
      <li>${tr('<b>Acheter</b> coûte 3 énergies (glissez un astre vers votre main ou directement dans le système). <b>Vendre</b> rend 1 énergie, 2 pour un astre doré (glissez un astre du système vers la Création). <b>Actualiser</b> coûte 1.')}</li>
      <li>${tr('<b>Geler</b> garde les astres proposés pour le cycle suivant. <b>Monter de niveau</b> débloque des astres plus puissants ; le prix baisse à chaque cycle.')}</li>
      <li>${tr('Votre système a <b>deux rangées de 4</b> (7 astres au plus). L’<b>avant</b> attaque et encaisse ; l’<b>arrière</b> est à l’abri des attaques et <b>avance</b> quand l’avant est tombé. Les effets des astres agissent depuis les deux rangées.')}</li>
      <li>${tr('Chaque astre de l’avant frappe l’ennemi <b>en face</b> de lui (les Remparts d’abord), de gauche à droite. Aucun hasard dans les cibles : votre placement décide.')}</li>
      <li>${tr('<b>Formation</b> : deux astres d’une même famille dans la même rangée. Chaque famille a un bonus à l’avant et un autre à l’arrière, plus fort à 3 et 4 astres. Mélangez : trois Brasier devant, deux Glace derrière…')}</li>
      <li>${tr('L’arrière a son rôle : <b>Portée</b> attaque depuis l’arrière sans riposte ; <b>Percée</b> frappe l’arrière ennemi ; <b>Garde</b>, à l’avant, protège votre arrière de la Percée.')}</li>
      <li>${tr('<b>Phénomènes</b> : certaines combinaisons de placement transforment un astre au début du combat. Un Minéral juste derrière un astre le fait grossir ; deux Néant l’un derrière l’autre forment un trou noir ; deux Brasier, une supernova… La liste est dans la fiche des familles.')}</li>
      <li>${tr('Touchez la barre du rival pour voir le <b>système qu’il a joué</b> au dernier combat, et adaptez votre placement.')}</li>
      <li>${tr('<b>Touchez un astre</b> pour lire ce qu’il fait, même en combat ou chez un rival. Sous chaque astre : {sword} son <b>Attaque</b> et {heart} ses <b>PV</b>. En haut à droite : {skull} il a un effet d’<b>Effondrement</b> (quand il est détruit, comme laisser des Débris), {spark} il a un autre effet.', ic)}</li>
      <li>${tr('<b>Trois copies</b> d’un même astre fusionnent en un <b>astre doré</b> (stats doublées). Le placer offre une <b>découverte</b> du niveau supérieur.')}</li>
      <li>${tr('Chaque partie active <b>5 familles</b> sur 12, plus les neutres. La réserve est <b>partagée</b> : si des rivaux jouent une famille, ses astres se font rares.')}</li>
      <li>${tr('Le perdant subit : niveau du gagnant + niveaux de ses astres survivants. En duel, chacun commence avec <b>deux fois plus de PV</b>. En mêlée, <b>maximum {n} dégâts</b> tant que plus de trois univers sont en vie.', { n: R.DAMAGE_CAP })}</li>
      <li>${tr('Un duel gagné rapporte {d} poussières d’étoiles. En mêlée, seuls les <b>trois premiers</b> en gagnent : {a}, {b} et {c}.', { d: R.DUEL.rewards[1], a: R.REWARDS[1], b: R.REWARDS[2], c: R.REWARDS[3] })}</li>
      <li>${tr('Chaque partie rapporte de l’<b>expérience</b>. Les niveaux ouvrent des améliorations au <b>Marché stellaire</b> : avec vos poussières, faites renaître votre planète, celle qui tourne derrière le menu, ou achetez des <b>fonds animés</b> ({n}) pour vos parties.', { n: COS_PRICE })}</li>
    </ul><div class="sheet-actions">${fromSettings ? `<button class="btn" data-act="set" data-v="tutos">${icon('back')} ${tr('TUTORIELS')}</button>` : ''}<button class="btn primary" data-act="close">${tr('COMPRIS')}</button></div>`;
  }

  async function menuAction(v) {
    if (v === 'sound') { SFX.setMuted(!SFX.muted); closeSheet(); toast(SFX.muted ? tr('Son coupé') : tr('Son activé')); }
    else if (v === 'help') openSheet(helpHtml());
    else if ((v === 'home' || v === 'quit') && ui.state && ui.state.watching) { closeSheet(); ui.watchStop = true; ui.skip = true; if (ui.watchAbort) ui.watchAbort(); }
    else if (v === 'home' && !(ui.state && ui.state.mp)) { closeSheet(); saveGame(); await backToMenu(); }
    else if (v === 'quit' || v === 'home') {
      closeSheet();
      const s = ui.state;
      if (s.mp && window.OrbiteMulti) window.OrbiteMulti.leave();
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
    if (ui.busy || !ui.state || ui.state.phase !== 'shop' || ui.state.watching) return;
    // En ligne, personne ne passe : c'est le minuteur commun qui termine le tour.
    if (ui.state.mp && !ui.mpAuto) { toast(tr('En ligne, le tour se termine pour tous à la fin du temps.'), 1800); return; }
    const p = me();
    if (p.discover.length) { await openDiscover(); return; }
    if (p.relicChoice && p.relicChoice.length) { await openRelics(); return; }
    ui.busy = true;
    SFX.tap();
    ui.prevHp = Object.fromEntries(ui.state.players.map((x) => [x.id, x.hp]));
    // Multijoueur : on publie son plateau et on attend ceux des autres créateurs.
    const MP = ui.state.mp && window.OrbiteMulti;
    const pre = uidRects();
    let res;
    try {
      res = MP ? await MP.endTurn(ui.state, () => banner(tr('EN ATTENTE'), tr('Les autres créateurs terminent leur tour…'))) : R.endTurn(ui.state);
    } catch (err) {
      console.error(err);
      res = { ok: false, reason: tr('Connexion perdue avec la partie en ligne.') };
    }
    if (MP) clearBanner();
    if (!res.ok) { refuse(tr(res.reason)); ui.busy = false; return; }
    tuto('combat');
    if (res.battle && res.battle.winner === 0) ui.state.fightsWon = (ui.state.fightsWon || 0) + 1;
    try {
      await playShopEvents(res.endEvents, null, pre);
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
    codexMark(boards[1].map((u) => u.id));
    const make = (u) => { const el = makeUnit(u, 'combat'); return el; };
    syncList($('board'), boards[0], (u) => u.cid, make, (el, u) => updateUnit(el, u, 'combat'));
    syncList($('enemy'), boards[1], (u) => u.cid, make, (el, u) => updateUnit(el, u, 'combat'));
    layoutRows($('board'));
    layoutRows($('enemy'), true);
    const forms = (b) => R.formationsOf(b.map((u) => ({ id: u.id, row: u.row })));
    markForms($('board'), forms(boards[0]));
    markForms($('enemy'), forms(boards[1]));
  }
  const relayout = (row) => layoutRows(row, row === $('enemy'));

  const unitByCid = (cid) => document.querySelector(`#board .unit[data-cid="${cid}"], #enemy .unit[data-cid="${cid}"]`);
  // En ligne contre de vrais joueurs, les combats ne se passent pas (v106) : PASSER disparaît pour toute
  // la partie, y compris au combat qui vous élimine et en regardant la suite (la classe mp-game tombe
  // dès l'élimination, avant ce dernier combat).
  const noSkipOnline = () => document.body.classList.toggle('no-skip', !!(ui.state && ui.state.mp));

  async function playBattle(b) {
    ui.time = 1;
    ui.skip = false;
    const opp = b.opponent;
    ui.opp = opp;
    $('oppName').innerHTML = opp.ghost ? esc(opp.name + ' · ' + tr('FANTÔME')) : playerName(ui.state.players.find((x) => x.id === opp.id) || opp, opp.name);
    $('oppHp').innerHTML = opp.ghost ? '' : icon('heart') + ' ' + Math.max(0, b.before.opp);
    document.body.classList.add('in-combat');
    noSkipOnline();
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
    if (b.watch) {
      // Spectateur : le vainqueur et les dégâts, sans la scène des comètes.
      const win = b.winner === 0 ? b.a : b.winner === 1 ? b.opponent : null;
      const lose = b.winner === 0 ? b.opponent : b.winner === 1 ? b.a : null;
      if (win) { SFX.win(); banner(tr('{name} L’EMPORTE', { name: esc(win.name) }), b.damage && !lose.ghost ? tr('{name} perd {n} PV', { name: esc(lose.name), n: b.damage }) : ''); }
      else banner(tr('ÉGALITÉ'), tr('Aucun dégât'));
      await sleep(ui.skip ? 500 : 1500);
      return;
    }
    const won = b.winner === 0, lost = b.winner === 1;
    if (won) {
      SFX.win();
      banner(tr('VICTOIRE'), b.damage ? '' : tr('Le rival est un fantôme'), 'win');
      for (const el of $('board').children) stage.flash(el.querySelector('.orb'), 0.4);
    } else if (lost) {
      SFX.lose();
      banner(tr('DÉFAITE'), '', 'lose');
    } else {
      banner(tr('ÉGALITÉ'), tr('Aucun dégât'));
    }
    await sleep(700);
    if ((won && !opp.ghost && b.damage) || (lost && b.damage)) await damageScene(b, won, opp);
    await sleep(500);
  }

  // Dégâts de fin de combat : chaque astre survivant du vainqueur tire une comète sur le perdant ;
  // un compteur grimpe à chaque impact, puis les PV de la cible descendent.
  async function damageScene(b, won, opp) {
    const side = won ? $('board') : $('enemy');
    const target = won ? $('oppHp') : $('hudHp');
    const winnerTier = won ? me().tier : opp.tier;
    const shooters = [...side.children].filter((el) => el.dataset.id && R.CARD[el.dataset.id]);
    const shots = shooters.map((el) => ({ el, n: R.CARD[el.dataset.id].tier }));
    shots.push({ el: null, n: winnerTier });
    // Sablier (v107) : les PV volés par vos Nébuleuses reviennent à votre univers avant les dégâts.
    if (b.heal) popOn($('hudHp'), tr('UNIVERS +{n} PV', { n: b.heal }), 'good');
    const hpFrom = won ? Math.max(0, b.before.opp) : Math.max(0, Math.min(me().maxHp || Infinity, b.before.me + (b.heal || 0)));
    // Loi du phénix : les PV tombent d'abord à zéro, la renaissance vient après.
    const hpTo = won ? Math.max(0, b.after.opp) : b.reborn ? 0 : Math.max(0, b.after.me);

    const box = document.createElement('div');
    box.className = 'dmg-count ' + (won ? 'good' : 'bad low');
    box.innerHTML = `<b>0</b><small>${won ? tr('DÉGÂTS INFLIGÉS À {name}', { name: esc(opp.name).toUpperCase() }) : tr('DÉGÂTS SUBIS')}</small>`;
    $('game').appendChild(box);
    const num = box.querySelector('b');
    const [tx, ty] = center(target);
    let total = 0;
    const hit = (n) => {
      const add = Math.min(n, b.damage - total);
      if (add <= 0) return;
      total += add;
      num.textContent = total;
      num.classList.remove('bump');
      void num.offsetWidth;
      num.classList.add('bump');
      target.classList.remove('struck');
      void target.offsetWidth;
      target.classList.add('struck');
      stage.burst(tx, ty, { n: 10 + add * 3, colors: won ? [[255, 220, 140], [255, 255, 255]] : [[255, 90, 90], [255, 255, 255]], speed: 70, life: 0.5 });
      SFX.hit(Math.min(6, add + 1), 0);
      vibrate(won ? 12 : [20, 20]);
    };
    const step = ui.skip ? 60 : dur(260);
    const flights = shots.map((s, i) => sleep(i * step).then(async () => {
      let from;
      if (s.el && s.el.isConnected) {
        from = center(s.el.querySelector('.orb'));
        stage.flash(s.el.querySelector('.orb'), 0.7);
        s.el.animate([{ transform: 'none' }, { transform: `translateY(${won ? -8 : 8}px) scale(1.08)` }, { transform: 'none' }], { duration: 260 });
      } else {
        // Le niveau de création du vainqueur frappe en dernier, depuis le compteur.
        from = center(box);
        popOn(box, tr('+{n} NIVEAU DE CRÉATION', { n: s.n }), 'info');
      }
      SFX.whoosh(0);
      await stage.beam(from, [tx, ty], { ms: dur(440), color: won ? [255, 214, 120] : [255, 110, 110], arc: 18 + i * 4, tail: 9, head: 3 });
      hit(s.n);
    }));
    await Promise.all(flights);
    await sleep(dur(450));
    // Les PV de la cible défilent jusqu'à leur nouvelle valeur.
    const t0 = performance.now(), ms = dur(650);
    await new Promise((res) => {
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const v = Math.round(hpFrom + (hpTo - hpFrom) * k);
        if (won) target.innerHTML = icon('heart') + ' ' + v;
        else target.innerHTML = icon('heart') + `<b>${v}</b>`;
        if (k < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    // Alerte : vos PV passent sous le quart (une fois par partie).
    if (!won && !b.reborn && hpTo > 0 && hpTo <= (me().maxHp || R.START_HP) * 0.25 && !ui.state.alarmed) {
      ui.state.alarmed = true;
      SFX.alarm();
    }
    if (!won) {
      const v = document.createElement('div');
      v.className = 'vignette';
      document.body.appendChild(v);
      setTimeout(() => v.remove(), 950);
      $('hudHp').classList.remove('hurt');
      void $('hudHp').offsetWidth;
      $('hudHp').classList.add('hurt');
      vibrate([30, 40, 30]);
    }
    if (!won && b.reborn) {
      await sleep(dur(500));
      const [hx, hy] = center($('hudHp'));
      stage.burst(hx, hy, { n: 40, colors: [[255, 170, 60], [255, 230, 140], [255, 255, 255]], speed: 110, life: 0.9 });
      SFX.buff(0, 4);
      $('hudHp').innerHTML = icon('heart') + `<b>${b.after.me}</b>`;
      popOn($('hudHp'), tr('+{n} PV', { n: b.after.me }), 'buff');
      toast(tr('{law} : votre univers renaît de ses cendres.', { law: R.LAW.phenix.name }), 3200);
      await sleep(dur(900));
    }
    box.classList.add('out');
    await sleep(dur(500));
    box.remove();
    renderHud();
  }

  async function animateAttack(e, group) {
    const a = unitByCid(e.cid), t = unitByCid(e.target);
    if (!a || !t) { for (const h of group) await combatEvent(h); return; }
    if (e.ranged) {
      // Portée : un tir depuis l'arrière, sans riposte.
      SFX.whoosh(panOf(a));
      stage.flash(a.querySelector('.orb'), 0.5);
      await stage.beam(center(a.querySelector('.orb')), center(t.querySelector('.orb')), { ms: dur(380), color: hexRgb(famColor(R.CARD[a.dataset.id].fam)), arc: 26, tail: 10, head: 3 });
      SFX.hit(Math.max(1, ...group.filter((h) => h.t === 'hit').map((h) => h.n)), panOf(t));
      stage.flash(t.querySelector('.orb'), 0.9);
      t.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: dur(220) });
      for (const h of group) await combatEvent(h, true);
      await sleep(160);
      return;
    }
    if (e.pierce) popOn(a, kwName('percee'), 'info');
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
        if (ui.state && ui.state.watching) banner(esc(e.side === 0 ? (ui.watchA || '') : ui.opp.name), tr('attaque en premier'));
        else banner(e.side === 0 ? tr('VOUS ATTAQUEZ') : esc(ui.opp.name), e.side === 0 ? tr('en premier') : tr('attaque en premier'));
        await sleep(900);
        break;
      }
      case 'formation': {
        // La formation s'annonce au-dessus de ses astres, qui s'allument de la couleur de leur famille.
        const els = e.cids.map(unitByCid).filter(Boolean);
        if (!els.length) break;
        const c = hexRgb(famColor(e.fam));
        const xs = els.map((el) => center(el.querySelector('.orb')));
        const top = Math.min(...els.map((el) => el.getBoundingClientRect().top));
        popAt(xs.reduce((n, p) => n + p[0], 0) / xs.length, top + 6, `${famName(e.fam)} ${ROMAN[e.lvl]} · ${rowName(e.row)}`, 'gold');
        SFX.golden();
        for (const el of els) {
          const orb = el.querySelector('.orb');
          const [x, y] = center(orb);
          stage.ring(x, y, orb.getBoundingClientRect().width * 0.45, { n: 22, colors: [c, [255, 255, 255]], speed: 40, life: 0.6, flat: 0.5 });
        }
        await sleep(650);
        break;
      }
      case 'phenom': {
        const el = unitByCid(e.cid);
        if (!el) break;
        const orb = el.querySelector('.orb');
        const [x, y] = center(orb);
        const w = orb.getBoundingClientRect().width;
        if (e.kind === 'explode') {
          // Supernova : l'astre explose en s'effondrant.
          SFX.explode();
          stage.burst(x, y, { n: 90, colors: [[255, 140, 60], [255, 220, 140], [255, 255, 255]], speed: 160, life: 1, size: 2 });
          stage.ring(x, y, w * 0.4, { n: 60, colors: [[255, 160, 80], [255, 255, 255]], speed: 150, life: 0.7 });
          popAt(x, y - w * 0.6, tr('SUPERNOVA'), 'gold');
          await sleep(500);
          break;
        }
        const partner = unitByCid(e.partner);
        if (partner) await stage.beam(center(partner.querySelector('.orb')), [x, y], { ms: dur(360), color: [246, 196, 83], arc: 10, tail: 8, head: 2 });
        popAt(x, y - w * 0.62, '✦ ' + tr(R.PHENOMENA[e.kind].name).toUpperCase(), 'gold');
        SFX.golden();
        stage.ring(x, y, w * 0.45, { n: 30, colors: [[246, 196, 83], [255, 255, 255]], speed: 50, life: 0.7, flat: 0.5 });
        if (e.kind === 'accretion') el.style.setProperty('--grow', '1.22');
        if (e.kind === 'trounoir') { orb.dataset.planet = 'neant'; el.classList.add('blackhole'); }
        if (e.kind === 'supernova') el.classList.add('nova');
        await sleep(dur(520));
        break;
      }
      case 'advance': {
        // L'avant est tombé : l'arrière avance d'un pas, face au rival.
        const row = combatRowEl(e.side);
        const before = rects(row);
        for (const cid of e.cids) { const el = unitByCid(cid); if (el) el.dataset.row = '0'; }
        relayout(row);
        flipFrom(row, before);
        SFX.whoosh(0);
        popOn(row, e.side === 0 ? tr('VOTRE ARRIÈRE AVANCE') : tr('SON ARRIÈRE AVANCE'), 'info');
        await sleep(520);
        break;
      }
      case 'heal': {
        const el = unitByCid(e.cid);
        if (el) {
          el.querySelector('.hp').textContent = e.hp;
          popOn(el, tr('+{n} PV', { n: e.n }), 'good');
          SFX.buff(panOf(el));
        }
        await sleep(160);
        break;
      }
      // Nébuleuses (v107) : un filet de lumière violette part de la victime vers la Nébuleuse qui lui
      // vole des PV (ou de l'Attaque) ; la suite (dégât, bonus) arrive avec les événements hit et buff.
      case 'drain': {
        const from = unitByCid(e.from), to = unitByCid(e.cid);
        if (!from || !to) break;
        const a = center(from.querySelector('.orb')), b = center(to.querySelector('.orb'));
        SFX.buff(panOf(to));
        await stage.beam(a, b, { ms: dur(300), color: e.atk ? [255, 190, 120] : [229, 139, 255], arc: 14, tail: 10, head: 2 });
        stage.burst(b[0], b[1], { n: 14, colors: [[229, 139, 255], [255, 255, 255]], speed: 40, life: 0.5 });
        popOn(to, e.atk ? tr('+{n} ATTAQUE VOLÉE', { n: e.n }) : tr('+{n} PV VOLÉS', { n: e.n }), 'good');
        break;
      }
      case 'keep': {
        const el = unitByCid(e.cid);
        if (el) popOn(el, tr('GARDÉS POUR TOUJOURS'), 'info');
        await sleep(dur(160));
        break;
      }
      case 'uheal': {
        // Sablier : l'univers récupère des PV (comptés après le combat).
        popOn(combatRowEl(e.side), tr('UNIVERS +{n} PV', { n: e.n }), 'good');
        await sleep(dur(220));
        break;
      }
      case 'law': {
        const law = R.LAW[e.side === 0 ? me().law : ui.opp.law];
        popOn(combatRowEl(e.side), law.name.toUpperCase(), 'info');
        await sleep(450);
        break;
      }
      case 'relic': {
        if (R.RELIC[e.id]) popOn(combatRowEl(e.side), (RELIC_GLYPH[e.id] || '✦') + ' ' + R.RELIC[e.id].name.toUpperCase(), 'info');
        await sleep(380);
        break;
      }
      case 'event': {
        if (R.EVENT[e.id]) popOn($('versus'), '✺ ' + R.EVENT[e.id].name.toUpperCase(), 'info');
        await sleep(480);
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
        popOn(el, kwName('bouclier'), 'info');
        if (!quick) await sleep(240);
        break;
      }
      case 'venom': {
        const el = unitByCid(e.cid);
        if (el) {
          const [x, y] = center(el.querySelector('.orb'));
          stage.burst(x, y, { n: 18, colors: [[140, 255, 120], [60, 200, 90]], speed: 50, life: 0.6 });
          SFX.venom(panOf(el));
          popOn(el, kwName('venin'), 'good');
        }
        break;
      }
      case 'buff': {
        const el = unitByCid(e.cid);
        if (el) {
          const atk = Number(el.querySelector('.atk').textContent) + e.a;
          const hp = Number(el.querySelector('.hp').textContent) + e.h;
          setStats(el, Math.max(0, atk), hp, true);
          const sg = (n) => (n < 0 ? '−' + -n : '+' + n);
          popOn(el, `${sg(e.a)}/${sg(e.h)}`, e.a < 0 || e.h < 0 ? 'bad' : 'good');
          if (e.a >= 0 && e.h >= 0) SFX.buff(panOf(el));
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
          popOn(el, tr('INVERSÉ'), 'info');
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
        relayout(row);
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
        relayout(row);
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
        if (e.reborn) popOn(el, kwName('renaissance'), 'info');
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
    // Retour à la création : on efface le combat, on montre les rivaux.
    const out = [...$('enemy').children, ...$('board').children].map((el) => stage.reveal(el.querySelector('.orb'), 1, 0, 260));
    await Promise.all(out);
    clearBanner();
    document.body.classList.remove('in-combat');
    $('enemy').innerHTML = '';
    $('board').innerHTML = '';
    renderRivals();
    for (const id of res.fallen || []) {
      const p = ui.state.players.find((x) => x.id === id);
      if (p && p.bot) toast(tr('{name} est éliminé · {rank}', { name: p.name, rank: ordinal(p.rank, true) }), 2200);
    }
    if (res.over) {
      saveGame();
      await endScreen();
      return;
    }
    ui.stamp++;
    renderGame(true);
    banner(tr('CYCLE {n}', { n: ui.state.round }), tr('{n} énergies', { n: me().gold }));
    await sleep(400);
    await playShopEvents(res.startEvents);
    renderEnergy();
    saveGame();
    tuto('cycle');
    if (ui.state.tutorial && !coach.steps && TUTO_TIPS[ui.state.round]) setTimeout(() => toast(TUTO_TIPS[ui.state.round], 6000), 1200);
    if (me().relicChoice && me().relicChoice.length) await openRelics();
  }

  // ─── Mode spectateur (v98) ──────────────────────────────────
  // Éliminé d'une mêlée solo, on peut regarder la suite : la table continue sans nous (R.spectate),
  // un combat par cycle (celui du meneur), les rivaux et leurs PV à jour, puis le vainqueur. Rien
  // n'est sauvegardé ni compté de plus.
  // En ligne aussi (v105) : on suit les manches des autres créateurs (OrbiteMulti.watchNext).
  const canWatch = (s) => !!s && s.over && (!s.mp || !!window.OrbiteMulti) && !s.watching && !s.tutorial && s.xpGiven !== 'abandon' && !R.isDuel(s) && !me().alive && R.alivePlayers(s).length >= 2;
  async function startWatching() {
    const s = ui.state;
    if (!canWatch(s) || !R.spectate(s).ok) return;
    SFX.tap();
    ui.busy = true;
    ui.watchStop = false;
    document.body.classList.add('watching');
    noSkipOnline();
    await show('game');
    for (const id of ['shop', 'hand', 'board', 'enemy']) $(id).innerHTML = '';
    renderHud();
    renderRivals();
    banner(tr('SPECTATEUR'), tr('La partie continue sans vous.'));
    await sleep(1600);
    await watchLoop();
  }
  async function watchLoop() {
    const MPx = ui.state && ui.state.mp && window.OrbiteMulti;
    while (ui.state && ui.state.watching && !ui.state.over) {
      // Quitter : en solo, la fin se joue d'un coup, pour connaître le vainqueur ; en ligne, on
      // cesse simplement de regarder.
      if (ui.watchStop) {
        if (MPx) { ui.state.over = true; ui.state.phase = 'over'; }
        else for (let g = 0; g < 80 && !ui.state.over; g++) if (!R.endTurn(ui.state, { observer: true }).ok) break;
        break;
      }
      ui.prevHp = Object.fromEntries(ui.state.players.map((x) => [x.id, x.hp]));
      let res;
      if (MPx) {
        // En ligne : on attend la manche des autres créateurs (QUITTER interrompt l'attente).
        banner(tr('MANCHE EN COURS'), tr('Les autres créateurs jouent leur tour…'), null, true);
        res = await Promise.race([MPx.watchNext(ui.state), new Promise((ok) => { ui.watchAbort = () => ok(null); })]);
        ui.watchAbort = null;
        clearBanner();
        if (!res) continue;
      } else res = R.endTurn(ui.state, { observer: true, watch: true });
      if (!res.ok) break;
      if (res.watched && !ui.watchStop) {
        const w = res.watched;
        $('sysName').innerHTML = playerName(ui.state.players.find((x) => x.id === w.a.id) || w.a, w.a.name);
        ui.watchA = w.a.name;
        await playBattle({ watch: true, events: w.events, winner: w.winner, damage: w.damage, a: w.a, opponent: w.b, before: { opp: w.b.hp } });
      }
      const out = [...$('enemy').children, ...$('board').children].map((el) => stage.reveal(el.querySelector('.orb'), 1, 0, 260));
      await Promise.all(out);
      clearBanner();
      document.body.classList.remove('in-combat');
      $('enemy').innerHTML = '';
      $('board').innerHTML = '';
      renderHud();
      renderRivals();
      for (const id of res.fallen || []) {
        const p = ui.state.players.find((x) => x.id === id);
        if (p && p.bot) toast(tr('{name} est éliminé · {rank}', { name: p.name, rank: ordinal(p.rank, true) }), 2200);
      }
      if (res.over || ui.watchStop) continue;
      banner(tr('CYCLE {n}', { n: ui.state.round }), tr('{n} univers en lice', { n: R.alivePlayers(ui.state).length }));
      await sleep(1200);
    }
    document.body.classList.remove('watching', 'in-combat');
    ui.busy = false;
    if (ui.state && ui.state.over) await endScreen();
  }
  listen('watchBtn', 'click', () => startWatching());
  listen('watchEndBtn', 'click', () => { ui.watchStop = true; ui.skip = true; if (ui.watchAbort) ui.watchAbort(); });

  // ─── Fin de partie ──────────────────────────────────────────
  async function endScreen() {
    const s = ui.state;
    const rank = s.rank || me().rank || 8;
    const quit = s.xpGiven === 'abandon';
    const gain = quit ? { rank: 0, cycles: 0, total: 0 } : xpFor(s, rank);
    const xpFrom = xpTotal();
    let xpTo = xpFrom;
    // Défi du jour : un score unique, et un bonus de poussières (victoire 50, sinon 10).
    if (s.daily && s.dailyScore == null) {
      s.dailyScore = dailyScore(s, rank, quit);
      s.reward = (s.reward || 0) + (rank === 1 && !quit ? DAILY_WIN : DAILY_PLAY);
      dailyFinish(s, rank, quit);
    }
    if (!s.rewarded) {
      s.rewarded = true;
      addDust(s.reward || 0);
    }
    if (!s.recorded) {
      s.recorded = true;
      recordGame(s, rank, quit);
    }
    // Classement : seules les parties classées en ligne comptent (un abandon vaut la 8e place) ;
    // le solo contre les univers rivaux et les parties privées n'y touchent pas.
    if (!s.rankedDone) {
      s.rankedDone = true;
      const c = K.sanitize(readJson(CLASSE_KEY, null));
      if (!s.mp || s.mp.mode !== 'ranked') s.rankedRes = null;
      // Un duel classé compte comme une 2e place (victoire) ou une 6e (défaite) : ±18 points.
      else { s.rankedRes = K.record(c, quit ? 8 : R.isDuel(s) ? (rank === 1 ? 2 : 6) : rank, s.mp.lobby); store.set(CLASSE_KEY, JSON.stringify(c)); }
    }
    $('endRanked').innerHTML = rankedLine(s.rankedRes) + dailyLine(s);
    if (!s.xpGiven) {
      s.xpGiven = true;
      xpTo = xpFrom + gain.total;
      store.set(XP_KEY, String(xpTo));
      // Le cadeau de chaque niveau franchi est versé tout de suite : l'animation qui suit ne fait
      // que l'afficher, rien n'est perdu si l'appli se ferme pendant l'écran de fin.
      s.levelGift = (levelInfo(xpTo).lvl - levelInfo(xpFrom).lvl) * LEVEL_GIFT;
      if (s.levelGift) addDust(s.levelGift);
      // Graines de vie : 1 pour une victoire, 2 à chaque niveau multiple de 5 franchi.
      let sg = !quit && rank === 1 ? 1 : 0;
      for (let l = levelInfo(xpFrom).lvl + 1; l <= levelInfo(xpTo).lvl; l++) if (l % 5 === 0) sg += 2;
      s.seedGift = sg;
      if (sg) addSeeds(sg);
    }
    if (s.seedGift && !s.seedShown) { s.seedShown = true; setTimeout(() => toast(tr('+{n} graine(s) de vie', { n: s.seedGift }), 2600), 1800); }
    const gift = s.levelGift || 0;
    $('end').classList.add('pending');
    const lv0 = levelInfo(xpFrom);
    $('xpLvl').textContent = lv0.lvl;
    $('xpFill').style.width = (lv0.rest / lv0.need * 100) + '%';
    $('xpGain').textContent = '+0 XP';
    $('xpDetail').textContent = quit ? tr('Partie abandonnée : pas d’expérience.') : tr('Classement +{r} · {c} cycles +{x}', { r: gain.rank, c: gain.cycles / 5, x: gain.cycles });
    try { localStorage.removeItem(SAVE_KEY); } catch (err) { /* stockage indisponible */ }
    const duel = R.isDuel(s);
    const good = duel ? rank === 1 : rank <= 3;
    $('endRank').innerHTML = duel ? (rank === 1 ? tr('VICTOIRE') : tr('DÉFAITE')) : ordinal(rank);
    $('endRank').classList.toggle('podium', good);
    $('endRank').classList.toggle('duel', duel);
    $('watchBtn').hidden = !canWatch(s);
    const champ = s.watching ? s.players.find((p) => p.rank === 1) : null;
    $('endText').textContent = champ
      ? tr('{name} remporte la partie. Vous finissez {rank}.', { name: champ.name, rank: ordinal(rank, true) })
      : s.tutorial
      ? (rank === 1 ? tr('Bravo, la Sentinelle est vaincue ! Le vrai jeu commence : duels, mêlées et parties en ligne vous attendent.') : tr('La Sentinelle a tenu bon. Rejouez le duel d’entraînement : le guide vous attend.'))
      : duel
      ? (rank === 1 ? tr('Votre système l’emporte sur {name}.', { name: s.players[1].name }) : tr('{name} l’emporte cette fois. Regardez son système et préparez la revanche.', { name: s.players[1].name }))
      : rank === 1 ? tr('Votre système domine l’univers.')
        : rank <= 3 ? tr('Sur le podium : les poussières d’étoiles sont à vous.')
          : tr('Votre univers s’est éteint. Seuls les trois premiers gagnent des poussières.');
    $('endBoard').innerHTML = staticRows(me().board);
    $('endDust').textContent = '+0';
    $('endTotal').innerHTML = tr('Total') + ' ' + icon('dust') + ' ' + (dust() - (s.reward || 0) - gift);
    await show('end');
    if (rank === 1 && !quit) SFX.jingle(); else if (good) SFX.win(); else SFX.lose();
    const reward = s.reward || 0;
    if (reward) {
      const t0 = performance.now();
      const base = dust() - reward - gift;
      await new Promise((resolve) => {
        const tick = (now) => {
          const k = Math.min(1, (now - t0) / 1400);
          const v = Math.round(reward * k);
          if (Math.floor(v / 10) !== Math.floor((tick.v || 0) / 10)) SFX.coin();
          tick.v = v;
          $('endDust').textContent = '+' + v;
          $('endTotal').innerHTML = tr('Total') + ' ' + icon('dust') + ' ' + (base + v);
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
    await fillXp(xpFrom, xpTo, dust() - gift);
    $('end').classList.remove('pending');
  }

  // ─── Niveau du créateur ─────────────────────────────────────
  // Chaque partie rapporte de l'expérience : selon le classement et les cycles tenus.
  const XP_KEY = 'orbite.xp';
  const RANK_XP = [0, 120, 90, 70, 55, 40, 30, 20, 10];
  const DUEL_XP = { win: 80, loss: 25 };
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
    const r = R.isDuel(s) ? (rank === 1 ? DUEL_XP.win : DUEL_XP.loss) : RANK_XP[rank] || 10;
    return { rank: r, cycles: cycles * 5, total: r + cycles * 5 };
  }

  // Expérience gagnée hors d'une partie classique (Campagne) : chaque niveau franchi a sa scène.
  async function giveXp(n) {
    const from = xpTotal(), to = from + Math.max(0, n);
    store.set(XP_KEY, String(to));
    const a = levelInfo(from).lvl, b = levelInfo(to).lvl;
    for (let l = a + 1; l <= b; l++) { addDust(LEVEL_GIFT); await levelUpScene(l); }
    return { from, to, before: a, after: b };
  }

  // La barre se remplit ; chaque niveau franchi déclenche l'explosion d'une planète.
  async function fillXp(from, to, shown) {
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
        shown += LEVEL_GIFT;
        $('endTotal').innerHTML = tr('Total') + ' ' + icon('dust') + ' ' + shown;
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
    pixelWord($('lvlWord'), tr('NIVEAU'), pixelSize(4));
    pixelWord($('lvlNum'), String(lvl), pixelSize(11));
    $('lvlNum').classList.add('gold');
    for (const r of ov.querySelectorAll('.pixel-word rect')) r.style.opacity = '0';
    const unlock = W.UPGRADES.find((u) => u.lvl === lvl);
    $('lvlGift').innerHTML = `${icon('dust')} ${tr('+{n} poussières d’étoiles', { n: LEVEL_GIFT })}` + (unlock ? `<br><span>${tr('Nouvelle amélioration au Marché : {name}', { name: esc(unlock.name) })}</span>` : '');
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

  // ─── Défi du jour (v84) ─────────────────────────────────────
  // La même partie pour tous, un jour : même graine (familles, lois proposées, rival, événement).
  // Une seule tentative par jour ; le score part au classement du jour si l'on est connecté.
  const DAILY_KEY = 'orbite.defi';
  const DAILY_WIN = 50, DAILY_PLAY = 10;
  function dailyKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const dailySeed = (d) => 'DEFI-' + d;
  function dailyLabel(d) {
    try { return new Date(d + 'T12:00:00').toLocaleDateString(document.documentElement.lang || 'fr', { day: 'numeric', month: 'long' }); } catch (err) { return d; }
  }
  const dailyRec = () => readJson(DAILY_KEY, {});
  function dailyStart(d) { store.set(DAILY_KEY, JSON.stringify({ d, started: true })); }
  // Victoire : 1000 + 5 par PV restant + 10 par cycle d'avance sur le 30e. Défaite : 20 par cycle
  // tenu + 3 par PV pris au rival.
  function dailyScore(s, rank, quit) {
    const mine = s.players[0], opp = s.players[1];
    if (rank === 1 && !quit) return 1000 + 5 * Math.max(0, mine.hp) + 10 * Math.max(0, 30 - s.round);
    return 20 * s.round + 3 * Math.max(0, opp.maxHp - Math.max(0, opp.hp));
  }
  function dailyFinish(s, rank, quit) {
    const rec = { d: s.daily, started: true, done: true, score: s.dailyScore, win: rank === 1 && !quit, rounds: s.round, law: s.players[0].law, sent: false };
    store.set(DAILY_KEY, JSON.stringify(rec));
    dailySend();
  }
  // Envoie le score du jour (une fois) ; hors ligne, il repartira à la prochaine ouverture du défi.
  async function dailySend() {
    const rec = dailyRec(), ON = window.OrbiteOnline;
    if (!rec.done || rec.sent || rec.d !== dailyKey() || !ON || !ON.dailySubmit) return;
    try {
      if (await ON.dailySubmit(rec.d, rec)) { rec.sent = true; store.set(DAILY_KEY, JSON.stringify(rec)); }
    } catch (err) {
      // Déjà enregistré (une seule tentative) : rien à renvoyer.
      if (err && err.code === 'permission-denied') { rec.sent = true; store.set(DAILY_KEY, JSON.stringify(rec)); }
    }
  }
  function dailyLine(s) {
    if (!s.daily || s.dailyScore == null) return '';
    return `<span class="end-daily">${tr('DÉFI DU JOUR · {n} points', { n: s.dailyScore })}</span><button class="link" data-daily-board>${tr('Classement du jour')}</button>`;
  }
  async function openDaily() {
    SFX.tap();
    const d = dailyKey(), rec = dailyRec(), s = loadGame();
    if (s && s.daily === d && !s.over) {
      openSheet(`<h3>${tr('DÉFI DU JOUR')}</h3><h2>${tr('Votre défi vous attend')}</h2><p class="muted">${tr('Cycle {c} · {hp} PV', { c: s.round, hp: Math.max(0, s.players[0].hp) })}</p>
        <div class="sheet-actions"><button class="btn primary" data-act="set" data-v="resume">${tr('REPRENDRE')}</button></div>`);
      return;
    }
    if (rec.d === d && rec.started) { await openDailyBoard(); return; }
    const ev = R.EVENT[R.eventFor(dailySeed(d))];
    const warn = s && !s.over ? `<p class="muted">${tr('Une partie solo est en cours : le défi la remplacera.')}</p>` : '';
    openSheet(`<h3>${tr('DÉFI DU JOUR · {d}', { d: esc(dailyLabel(d)) })}</h3><h2>${tr('La même partie pour tous')}</h2>
      <p>${tr('Mêmes familles, mêmes lois proposées, même rival et même événement pour tous les créateurs aujourd’hui. Une seule tentative.')}</p>
      ${eventHtml(ev.id)}
      <p class="muted">${tr('Victoire : +{a} poussières · sinon +{b}. Votre score rejoint le classement du jour si vous êtes connecté.', { a: DAILY_WIN, b: DAILY_PLAY })}</p>${warn}
      <div class="sheet-actions"><button class="btn primary" data-act="set" data-v="daily-go">${tr('RELEVER LE DÉFI')}</button><button class="btn" data-act="set" data-v="daily-board">${tr('CLASSEMENT')}</button></div>`);
  }
  async function dailyGo() {
    ui.size = 2;
    ui.daily = dailyKey();
    stopAmbient();
    renderLaws(dailySeed(ui.daily));
    await show('laws');
  }
  async function openDailyBoard() {
    const d = dailyKey(), rec = dailyRec();
    const mine = rec.d === d && rec.done
      ? `<p class="daily-mine"><b>${tr('{n} points', { n: rec.score })}</b> · ${rec.win ? tr('VICTOIRE') : tr('DÉFAITE')} · ${tr('{n} cycles', { n: rec.rounds })}</p>`
      : rec.d === d && rec.started ? `<p class="muted">${tr('Défi abandonné aujourd’hui.')}</p>` : '';
    const later = rec.d === d && rec.started ? `<p class="muted">${tr('Un nouveau défi vous attend demain.')}</p>` : '';
    openSheet(`<h3>${tr('DÉFI DU JOUR · {d}', { d: esc(dailyLabel(d)) })}</h3><h2>${tr('Classement du jour')}</h2>${mine}<div class="daily-board" id="dailyBoard"><p class="muted">${tr('Chargement…')}</p></div>${later}`);
    const box = () => document.getElementById('dailyBoard');
    const ON = window.OrbiteOnline;
    if (!ON || !ON.dailyTop || !ON.state || ON.state.status !== 'signedIn') {
      if (box()) box().innerHTML = `<p class="muted">${tr('Connectez-vous avec Google (Multijoueur) pour voir le classement du jour.')}</p>`;
      return;
    }
    await dailySend();
    let rows = null;
    try { rows = await ON.dailyTop(d); } catch (err) { rows = null; }
    if (!box()) return;
    if (!rows) { box().innerHTML = `<p class="muted">${tr('Classement indisponible pour le moment.')}</p>`; return; }
    if (!rows.length) { box().innerHTML = `<p class="muted">${tr('Personne n’a encore relevé le défi aujourd’hui.')}</p>`; return; }
    const me_ = ON.uid && ON.uid();
    box().innerHTML = rows.map((r, i) => `<div class="daily-row${r.uid === me_ ? ' me' : ''}"><i>${i + 1}</i><b>${esc(r.pseudo || '?')}</b><span>${r.win ? '✦' : ''} ${r.score}</span></div>`).join('');
  }

  // ─── Codex (v84) ────────────────────────────────────────────
  // Tous les astres (ceux déjà croisés se dévoilent), les lois, les reliques et les événements.
  const CODEX_KEY = 'orbite.codex';
  let codexSet = null;
  function codexSeen() {
    if (!codexSet) { const raw = readJson(CODEX_KEY, []); codexSet = new Set(Array.isArray(raw) ? raw : []); }
    return codexSet;
  }
  function codexMark(ids) {
    const seen = codexSeen(), n = seen.size;
    for (const id of ids || []) if (id && R.CARD[id] && !R.CARD[id].token) seen.add(id);
    if (seen.size !== n) store.set(CODEX_KEY, JSON.stringify([...seen]));
  }
  const codexCards = () => R.CARDS.filter((c) => !c.token);
  async function openCodex() {
    SFX.tap();
    stopAmbient();
    $('codexBack').innerHTML = icon('back');
    ui.cxTab = ui.cxTab || 'astres';
    ui.cxFam = ui.cxFam || R.FAMILY_KEYS[0];
    renderCodex();
    await show('codex');
  }
  function renderCodex() {
    const tab = ui.cxTab || 'astres', seen = codexSeen(), cards = codexCards();
    for (const b of $('codexTabs').children) b.classList.toggle('on', b.dataset.cx === tab);
    $('codexCount').textContent = tr('{a} / {b}', { a: cards.filter((c) => seen.has(c.id)).length, b: cards.length });
    $('codexFams').hidden = tab !== 'astres';
    let html = '';
    if (tab === 'astres') {
      const g = ui.cxFam;
      const groups = R.FAMILY_KEYS.concat(['neutre', 'legend']);
      $('codexFams').innerHTML = groups.map((k) => {
        const list = cards.filter((c) => (k === 'legend' ? c.legend : c.fam === k && !c.legend));
        const got = list.filter((c) => seen.has(c.id)).length;
        const name = k === 'legend' ? tr('LÉGENDAIRES') : R.FAMILIES[k].name.toUpperCase();
        return `<button class="cx-fam${k === g ? ' on' : ''}" data-cxf="${k}" style="--c:${k === 'legend' ? '#ffe28c' : famColor(k)}"><span>${name}</span><small>${got}/${list.length}</small></button>`;
      }).join('');
      const list = cards.filter((c) => (g === 'legend' ? c.legend : c.fam === g && !c.legend)).sort((a, b) => a.tier - b.tier || (a.name < b.name ? -1 : 1));
      const about = g === 'legend' ? tr('Un seul exemplaire par partie, et rares : 1 chance sur 100 par emplacement de la Création.') : R.FAMILIES[g].text;
      html = `<p class="muted cx-about">${esc(about)}</p><div class="cx-grid">${list.map((c) => (seen.has(c.id)
        ? `<button class="cx-card" data-cxid="${c.id}" style="--c:${famColor(c.fam)}"><div class="orb" data-planet="${c.id}"></div><b>${esc(c.name)}</b><small>${tr('NIVEAU {n}', { n: c.tier })} · ${c.atk}/${c.hp}</small></button>`
        : `<div class="cx-card unknown"><div class="cx-q">?</div><b>???</b><small>${tr('NIVEAU {n}', { n: c.tier })}</small></div>`)).join('')}</div>
        <p class="muted cx-hint">${tr('Les astres se dévoilent quand vous les croisez en partie : dans la Création, une découverte ou chez un rival.')}</p>`;
    } else if (tab === 'lois') {
      html = `<div class="fam-list">${R.LAWS.map((l) => {
        const st = R.CARD[l.starter];
        return `<div class="fam-item" style="--c:${famColor(l.fam)}"><b>${esc(l.name).toUpperCase()}</b> <small>· ${l.fam === 'neutre' ? tr('POINTS DE VIE') : R.FAMILIES[l.fam].name.toUpperCase()}</small><p>${esc(l.text)}</p><p class="awk"><b>${tr('ÉVEIL AU CYCLE {n}', { n: R.AWAKE_ROUND })}</b> ${esc(l.awake)}</p><p class="muted">${tr('PREMIER ASTRE : {name}', { name: esc(st.name).toUpperCase() })}</p></div>`;
      }).join('')}</div>`;
    } else if (tab === 'reliques') {
      html = `<p class="muted">${tr('Au début des cycles {a} et {b}, chaque univers choisit une relique parmi trois. Elle dure toute la partie.', { a: R.RELIC_ROUNDS[0], b: R.RELIC_ROUNDS[1] })}</p><div class="relic-list">${R.RELICS.map((r) => relicHtml(r.id)).join('')}</div>`;
    } else {
      html = `<p class="muted">${tr('Chaque partie tire un événement cosmique. Il s’applique à tous les univers, du premier au dernier cycle.')}</p><div class="relic-list">${R.EVENTS.map((e) => eventHtml(e.id)).join('')}</div>`;
    }
    $('codexBody').innerHTML = html;
    $('codexBody').scrollTop = 0;
    [...$('codexBody').querySelectorAll('[data-planet]')].forEach((orb, i) => revealIn(orb, i * 40));
  }

  // ─── Commandes ──────────────────────────────────────────────
  const guard = (fn) => async () => {
    if (ui.busy) return;
    ui.busy = true;
    try { await fn(); } finally { ui.busy = false; }
  };

  async function newGameFlow(size) {
    ui.size = size === 8 ? 8 : 2;
    ui.daily = null;
    stopAmbient();
    renderLaws();
    await show('laws');
    if (!tutoDone()) coachStart(LAW_STEPS);
  }
  async function resumeGame() {
    const s = loadGame();
    if (!s) return;
    stopAmbient();
    ui.state = s;
    ui.stamp++;
    await show('game');
    renderGame(true);
    // Partie reprise au milieu d'une découverte : elle revient tout de suite.
    if (me() && me().discover.length) setTimeout(() => { if (!ui.discoverDone) openDiscover(); }, 700);
    else if (me() && me().relicChoice && me().relicChoice.length) setTimeout(() => { if (!ui.relicDone) openRelics(); }, 700);
  }
  // Jouer : le duel contre l'IA, le cœur du jeu. La mêlée à 8 est rangée dans Multijoueur.
  // Une seule partie solo à la fois : celle en cours se reprend, quel que soit son mode.
  function openMode(size) {
    SFX.tap();
    const s = loadGame();
    if (!s) { newGameFlow(size); return; }
    const duel = R.isDuel(s);
    const info = duel
      ? tr('Duel contre {name} · cycle {c} · {hp} PV', { name: esc(s.players[1].name), c: s.round, hp: Math.max(0, s.players[0].hp) })
      : tr('Mêlée · cycle {c} · {hp} PV · {n} univers en lice', { c: s.round, hp: Math.max(0, s.players[0].hp), n: R.alivePlayers(s).length });
    openSheet(`<h3>${size === 2 ? tr('DUEL') : tr('MÊLÉE À 8')}</h3><h2>${tr('Une partie vous attend')}</h2>
      <p class="muted">${info}</p>
      <div class="sheet-actions"><button class="btn primary" data-act="set" data-v="resume">${tr('REPRENDRE')}</button><button class="btn" data-act="set" data-v="new" data-size="${size}">${size === 2 ? tr('NOUVEAU DUEL') : tr('NOUVELLE MÊLÉE')}</button></div>`);
  }
  // Le menu se range en pages : principal → Jouer (solo ou multijoueur) → modes solo.
  function menuPage(name, quiet) {
    const list = $('menuList');
    if (!list) return;
    for (const pg of list.querySelectorAll('.menu-page')) {
      const on = pg.dataset.page === name;
      pg.classList.toggle('enter', on && !quiet && !pg.classList.contains('on'));
      pg.classList.toggle('on', on);
    }
    list.dataset.page = name;
    // Le focus suit la page (clavier), sans faire défiler l'écran du menu.
    if (!quiet) { const first = list.querySelector('.menu-page.on .menu-item'); if (first) first.focus({ preventScroll: true }); }
    $('menu').scrollTop = 0;
  }
  // La planète du menu déborde en bas : l'écran ne doit jamais défiler (focus, clavier).
  listen('menu', 'scroll', () => { if ($('menu').scrollTop) $('menu').scrollTop = 0; });
  // Nouveau joueur : JOUER lance d'abord le duel d'entraînement (v97).
  listen('playBtn', 'click', () => { SFX.tap(); if (needTuto()) { startTutorial(); return; } menuPage('play'); });
  listen('soloBtn', 'click', () => { SFX.tap(); menuPage('solo'); });
  listen('menuList', 'click', (e) => {
    const b = e.target.closest('[data-menu-back]');
    if (!b) return;
    SFX.tap();
    menuPage(b.dataset.menuBack);
  });
  listen('duelBtn', 'click', () => openMode(2));
  listen('dailyBtn', 'click', () => openDaily());
  listen('codexBtn', 'click', () => openCodex());
  listen('codexBack', 'click', async () => { SFX.tap(); await backToMenu(); });
  listen('codexTabs', 'click', (e) => { const b = e.target.closest('[data-cx]'); if (!b) return; SFX.tap(); ui.cxTab = b.dataset.cx; renderCodex(); });
  listen('codexFams', 'click', (e) => { const b = e.target.closest('[data-cxf]'); if (!b) return; SFX.tap(); ui.cxFam = b.dataset.cxf; renderCodex(); });
  listen('codexBody', 'click', (e) => { const b = e.target.closest('[data-cxid]'); if (!b) return; SFX.tap(); openSheet(unitSheet(shopUnit(b.dataset.cxid))); });
  listen('endRanked', 'click', (e) => { if (e.target.closest('[data-daily-board]')) { SFX.tap(); openDailyBoard(); } });
  listen('quickBtn', 'click', () => openMode(8));
  listen('multiBtn', 'click', async () => {
    SFX.tap();
    if (window.OrbiteMultiUI) { stopAmbient(); window.OrbiteMultiUI.open(); return; }
    stopAmbient();
    await show('multi');
    $('mpBody').innerHTML = `<p class="muted">${tr('Les salons en ligne sont indisponibles. La mêlée à 8 reste jouable hors ligne.')}</p>`;
  });
  listen('multiBack', 'click', async () => {
    if (window.OrbiteMultiUI) return;
    SFX.tap();
    await backToMenu();
  });
  listen('marketBtn', 'click', async () => { SFX.tap(); stopAmbient(); renderMarket(); marketTab('planete'); await show('market'); });
  // Création : Forge des mondes, Atelier des planètes, Bâtisseur de colonies.
  async function openCreation() {
    stopAmbient();
    $('creationDust').innerHTML = wallet();
    stage.sky = 0;
    stage.skyGain = 1;
    await show('creation');
    if (window.__orbite.forge) window.__orbite.forge.render();
  }
  // La Création n'apparaît au menu qu'une fois la planète arrivée à la civilisation verte (Marché
  // stellaire). La première visite passe par une cinématique.
  const CREATION_KEY = 'orbite.creation';
  const creationOpen = () => store.get(CREATION_KEY, '') === '1';
  const creationReady = () => W.civil(worldList());
  function renderCreationBtn() {
    const b = $('creationBtn');
    if (!b) return;
    b.hidden = !creationReady();
    b.innerHTML = tr('CRÉATION') + (creationOpen() ? '' : `<small>${tr('NOUVEAU')}</small>`);
  }
  // Cinématique : le vide, une étincelle qui devient un monde, et l'appel au Créateur.
  stage.register('cine-graine', { type: 'star', seed: 7777, starClass: 'naine jaune', compact: true });
  async function creationCinematic() {
    stopAmbient();
    const orb = $('cineOrb'), line = $('cineLine');
    let skip = false;
    $('cineSkip').onclick = () => { skip = true; SFX.tap(); };
    const pause = async (ms) => { const t0 = performance.now(); while (!skip && performance.now() - t0 < ms) await wait(50); };
    orb.style.transform = 'scale(0.08)';
    stage.setReveal(orb, 0);
    await show('cine');
    SFX.music(false);
    const say = async (text) => { if (!skip) await Promise.race([typeLine(line, text, { hold: 1500, speed: 55 }), (async () => { while (!skip) await wait(60); })()]); line.innerHTML = ''; };
    await pause(700);
    await say(tr('Au commencement, il n’y avait que le vide.'));
    if (!skip) {
      stage.reveal(orb, 0, 1, 1400);
      SFX.golden();
      const [x, y] = center(orb);
      stage.burst(x, y, { n: 30, colors: [[255, 236, 160], [255, 255, 255]], speed: 40, life: 1 });
    }
    await say(tr('Puis une étincelle : la vôtre.'));
    if (!skip) {
      orb.animate([{ transform: 'scale(0.08)' }, { transform: 'scale(1)' }], { duration: 2600, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'forwards' });
      await pause(1400);
    }
    await say(tr('Créateur, des mondes n’attendent que vous.'));
    if (!skip) {
      const [x, y] = center(orb);
      stage.ring(x, y, 30, { n: 80, colors: [[255, 236, 160], [140, 220, 255], [255, 255, 255]], speed: 120, life: 1.2 });
      SFX.level();
      vibrate([20, 40, 20]);
      await pause(1200);
    }
    orb.getAnimations().forEach((a) => a.cancel());
    orb.style.transform = '';
    SFX.music(true);
  }
  listen('creationBtn', 'click', async () => {
    if (!creationReady()) return;
    SFX.tap();
    if (!creationOpen()) {
      store.set(CREATION_KEY, '1');
      renderMenu();
      await creationCinematic();
    }
    await openCreation();
  });
  $('creationBack').innerHTML = icon('back');
  listen('creationBack', 'click', async () => { SFX.tap(); await backToMenu(); });
  listen('marketBack', 'click', async () => { SFX.tap(); await backToMenu(); });
  listen('profileBtn', 'click', async () => { SFX.tap(); stopAmbient(); renderProfile(); await show('profile'); });
  listen('profileBack', 'click', async () => { SFX.tap(); await backToMenu(); });
  listen('settingsBtn', 'click', () => { SFX.tap(); openSheet(settingsHtml()); });
  listen('lawsBack', 'click', async () => { SFX.tap(); ui.daily = null; await backToMenu(); });
  listen('upBtn', 'click', guard(doUpgrade));
  listen('rollBtn', 'click', guard(doRoll));
  listen('freezeBtn', 'click', () => { if (!ui.busy) doFreeze(); });
  listen('fightBtn', 'click', fight);
  listen('rivals', 'click', () => { if (!ui.busy) { SFX.tap(); openRivals(); } });
  listen('famsBtn', 'click', () => { SFX.tap(); openFamilies(); });
  listen('menuBtn', 'click', () => { SFX.tap(); openMenu(); });
  listen('cosmosBtn', 'click', () => { if (ui.state) { SFX.tap(); openCosmos(); } });
  listen('powerBtn', 'click', () => {
    if (ui.busy) return;
    const p = me(), law = R.LAW[p.law];
    if (!law.active) { openFamilies(); return; }
    const can = R.canUsePower(ui.state);
    if (!can.ok) { refuse(tr(can.reason)); return; }
    if (law.active.target) {
      if (!p.board.length) { refuse(tr('Placez d’abord un astre.')); return; }
      ui.targeting = !ui.targeting;
      document.querySelectorAll('#board .unit').forEach((el) => el.classList.toggle('target', ui.targeting));
      if (ui.targeting) toast(tr('Touchez un astre de votre système.'));
      renderPower();
    } else {
      guard(() => doPower(null))();
    }
  });
  listen('skipBtn', 'click', () => { if (!(ui.state && ui.state.mp)) ui.skip = true; });
  listen('againBtn', 'click', async () => { SFX.tap(); if (ui.state && ui.state.tutorial) { startTutorial(); return; } ui.size = ui.state && !R.isDuel(ui.state) ? 8 : 2; ui.daily = null; renderLaws(); await show('laws'); });
  listen('endHome', 'click', async () => { SFX.tap(); await backToMenu(); });

  window.addEventListener('resize', () => {
    deskFit();
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

  window.__orbite = { ui, rules: R, stage, show, renderGame, fight, enterMenu, backToMenu, endScreen, autoRelic };
  // Outils partagés avec le mode Campagne (js/campagne-ui.js).
  window.__orbite.api = {
    show, openSheet, closeSheet, toast, refuse, popAt, popOn, banner, clearBanner, icon, esc, center, sleep, wait, waitTap, vibrate,
    pixelWord, pixelSize, mountEnergy, revealIn, store, dust, addDust, giveXp, levelInfo, xpTotal, backToMenu, stopAmbient, viewW, viewH, frameOf, framed, avatarOf, fontOf, nameHtml, myFont, myFrame, myAvatar, seatLook,
    coachStart, coachStop, tuto, famColor, renderMenu, marketTab, renderProfile, readJson, openCreation,
    seeds, addSeeds, wallet
  };

  // ─── Démarrage ──────────────────────────────────────────────
  boot();

  // Certains cadres (aperçus, iframes isolées) refusent même l'accès à navigator.serviceWorker.
  let swReg = null;
  try {
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => { swReg = r; }).catch(() => { /* hors ligne indisponible */ });
    }
  } catch (err) { /* hors ligne indisponible */ }

  // Mises à jour : une appli installée qu'on rouvre est souvent juste réveillée, sans recharger la
  // page. À chaque retour au premier plan (et toutes les 15 min), on compare la version en ligne à
  // celle-ci ; si elle est plus récente, la page se recharge tout de suite si l'on est au menu,
  // sinon au prochain retour au menu (la partie en cours est sauvegardée).
  async function checkUpdate() {
    if (!location.protocol.startsWith('http')) return;
    try { if (swReg) swReg.update(); } catch (err) { /* sans importance */ }
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const v = Number((await r.json()).v);
      if (v > VERSION) updateReady();
    } catch (err) { /* hors ligne : on garde cette version */ }
  }
  function updateReady(force) {
    // Garde-fou : pas plus d'un rechargement automatique toutes les deux minutes.
    let last = 0;
    try { last = Number(sessionStorage.getItem('orbite.maj')) || 0; } catch (err) { /* indisponible */ }
    if (Date.now() - last < 120000) return;
    if (!force && (ui.screen !== 'menu' || ui.busy || document.querySelector('.coach:not([hidden])'))) { ui.updatePending = true; return; }
    try { sessionStorage.setItem('orbite.maj', String(Date.now())); } catch (err) { /* indisponible */ }
    location.reload();
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
  setTimeout(checkUpdate, 4000);
  setInterval(checkUpdate, 15 * 60 * 1000);
})();
