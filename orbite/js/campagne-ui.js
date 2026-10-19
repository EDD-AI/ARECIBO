/* ORBITE — Campagne : récit, carte des chemins, combats de cartes, récompenses et fin d'expédition.
 * Les règles sont dans js/campagne.js ; ce fichier les anime avec les outils du jeu (window.__orbite.api). */
(function () {
  'use strict';

  const O = window.__orbite;
  const C = window.OrbiteCampagne;
  if (!O || !O.api || !C) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const { icon, esc, wait, center } = A;

  const RUN_KEY = 'orbite.campagne';
  const STATS_KEY = 'orbite.campagne.stats';
  const INTRO_KEY = 'orbite.campagne.intro';
  const TUTO_KEY = 'orbite.campagne.tuto';
  const VELA_KEY = 'orbite.campagne.vela';
  const BOSS_KEY = 'orbite.campagne.kronos';
  const LIGHT = [-0.55, 0.62, 0.55];
  let run = null;
  const ui = { busy: false, sel: null, first: false };

  // ─── Sauvegarde ─────────────────────────────────────────────
  function save() {
    try {
      if (run && !run.over) localStorage.setItem(RUN_KEY, JSON.stringify(run));
      else localStorage.removeItem(RUN_KEY);
    } catch (err) { /* stockage indisponible */ }
  }
  function load() {
    try { const r = JSON.parse(localStorage.getItem(RUN_KEY)); if (r && r.v === 1 && !r.over) return r; } catch (err) { /* illisible */ }
    return null;
  }
  function stats() { try { return Object.assign({ runs: 0, wins: 0, best: 0 }, JSON.parse(A.store.get(STATS_KEY, '{}'))); } catch (err) { return { runs: 0, wins: 0, best: 0 }; } }

  // ─── Apparences ─────────────────────────────────────────────
  // Le monde du joueur suit ses cartes ; les ennemis ont chacun leur astre.
  function lookWorld() {
    stage.register('camp-world', { seed: 7001 + (run.seed % 4000), living: C.worldChannels(run), full: true, light: LIGHT });
  }
  for (const id of Object.keys(C.ENEMIES)) stage.register('foe-' + id, Object.assign({}, C.ENEMIES[id].look));

  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const elColor = (el) => hexRgb(A.famColor(el));

  // ─── Récit ──────────────────────────────────────────────────
  const story = { skip: false, typing: false, next: null };
  $('cStory').addEventListener('pointerdown', (e) => {
    if (e.target.closest('#csSkip')) return;
    if (story.typing) story.fast = true;
    else if (story.next) story.next();
  });
  $('csSkip').addEventListener('click', () => { story.skip = true; if (story.next) story.next(); });
  async function say(text, o) {
    o = o || {};
    if (story.skip) return;
    const el = $('csLine');
    el.classList.remove('fade');
    el.innerHTML = '<span></span><span class="caret">_</span>';
    const span = el.firstChild;
    story.typing = true;
    story.fast = false;
    for (const ch of text) {
      if (story.skip) break;
      if (story.fast) { span.textContent = text; break; }
      span.textContent += ch;
      if (ch !== ' ') SFX.type();
      await wait(',.…!?'.includes(ch) ? 300 : o.speed || 46);
    }
    story.typing = false;
    // Un toucher passe à la suite ; sinon la phrase reste le temps de la lire.
    await new Promise((res) => { story.next = res; setTimeout(res, o.hold || Math.max(1600, text.length * 55)); });
    story.next = null;
    el.classList.add('fade');
    await wait(story.skip ? 0 : 550);
    el.innerHTML = '';
  }
  async function tell(lines) { for (const l of lines) await say(l); }
  function storyTitle(word, sub) {
    A.pixelWord($('csTitle'), word, A.pixelSize(5));
    $('csTitle').classList.add('shown');
    $('csSub').textContent = sub || '';
    $('cStory').classList.add('titled');
  }
  async function openStory() {
    story.skip = false;
    $('cStory').classList.remove('titled');
    $('csTitle').innerHTML = '';
    $('csSub').textContent = '';
    $('csLine').innerHTML = '';
    const orb = $('csOrb');
    delete orb.dataset.planet;
    await A.show('cStory');
  }
  // La poussière converge du bord de l'écran et forme le monde.
  async function gatherWorld() {
    const orb = $('csOrb');
    const [cx, cy] = center(orb);
    const W = window.innerWidth, H = window.innerHeight;
    SFX.charge();
    for (let i = 0; i < 28 && !story.skip; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.max(W, H) * 0.6;
      stage.beam([cx + Math.cos(a) * r, cy + Math.sin(a) * r], [cx, cy], { ms: 700 + Math.random() * 400, color: [200, 190, 170], arc: (Math.random() - 0.5) * 60, tail: 8, head: 2 });
      await wait(45);
    }
    await wait(story.skip ? 0 : 900);
    orb.dataset.planet = 'camp-world';
    stage.setReveal(orb, 0);
    stage.flash(orb, 1);
    SFX.golden();
    stage.burst(cx, cy, { n: 60, colors: [[255, 255, 255], [220, 200, 160]], speed: 110, life: 0.9 });
    await stage.reveal(orb, 0, 1, 900);
  }

  const INTRO = [
    '…',
    'Une pensée. La toute première.',
    'Vous ouvrez les yeux sur le vide.',
    'Rien n’existe encore. Il y a tout à faire.',
    'Vous êtes un Créateur. Et un Créateur doit créer.',
    'Rassemblez la poussière.'
  ];
  const INTRO_AFTER = [
    'Voici votre premier monde. Petit. Fragile.',
    'D’autres astres errent dans cette nébuleuse. Ils ne vous laisseront pas grandir.',
    'Façonnez votre monde. Faites-le survivre.',
    'Puis, faites-y naître la vie.'
  ];
  const AGAIN = ['Vous rouvrez les yeux. Le vide vous attendait.', 'Rassemblez la poussière.'];
  const BOSS = [
    'Une ombre immense masque les étoiles.',
    'Kronos. La géante qui dévore ses propres lunes.',
    'Elle règne sur cette nébuleuse depuis le commencement.',
    'Votre monde est prêt. Il doit l’être.'
  ];
  const WIN = [
    'Kronos s’effondre sur lui-même.',
    'Ses lunes, libérées, se mettent à tourner autour de votre monde.',
    'Et à sa surface, pour la première fois…',
    '…quelque chose bouge. La vie.'
  ];
  const LOSE = [
    'Votre monde se fissure, puis se disloque.',
    'Sa poussière retourne au vide.',
    'Mais un Créateur ne disparaît jamais vraiment.',
    'Il recommence.'
  ];
  const ELITE_LINE = {
    geante: 'Une étoile mourante gonfle devant vous. Sa chaleur fait fondre la roche.',
    jumeau: 'Deux astéroïdes tournent l’un autour de l’autre. Frappez l’un, et l’autre enrage.'
  };


  // ─── Dialogues entre Créateurs ──────────────────────────────
  // Silhouettes pixel art générées : capuche, épaules, manteau qui s'évase. Une lumière venue du
  // centre de l'écran dessine un liseré sur le côté qui fait face à l'autre ; le nôtre n'a ni yeux
  // ni couleur : on ne sait pas qui nous sommes.
  function figureSvg(o) {
    const W = 40, H = 64;
    const m = Array.from({ length: H }, () => new Array(W).fill(0));
    const set = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H) m[y][x] = 1; };
    const cx = 20 + (o.lean || 0), r = o.hood || 6, hy = 4 + r + (o.bow || 0);
    const span = (y, x0, x1) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) set(x, y); };
    // Tête et capuche.
    for (let y = hy - r; y <= hy + r; y++) { const w = Math.sqrt(Math.max(0, r * r - (y - hy) ** 2)); span(y, cx - w, cx + w); }
    if (o.peak) { set(cx, hy - r - 1); set(cx + o.dir, hy - r - 1); set(cx + o.dir * 2, hy - r); }
    // Longue chevelure qui flotte derrière (côté opposé à la lumière).
    if (o.hair) for (let y = hy - 2; y < hy + o.hair; y++) {
      const reach = r + 2 + (y - hy + 2) / 3 + Math.sin(y * 0.5) * 1.2;
      const a = cx - o.dir * (r - 3), b = cx - o.dir * reach;
      span(y, Math.min(a, b), Math.max(a, b));
    }
    // Épaules puis manteau.
    const ys = hy + r - 1;
    const sh = o.shoulder || 11, fl = o.flare || 15;
    for (let y = ys; y < H; y++) {
      const t = (y - ys) / (H - ys);
      const hunch = (o.hunch || 0) * Math.max(0, 1 - t * 1.6);
      const w = y < ys + 5 ? r + (sh - r) * ((y - ys) / 5) : sh + (fl - sh) * Math.pow(t, 1.3);
      const sway = Math.sin(y * 0.35 + (o.seed || 0)) * 0.6;
      span(y, cx - w + hunch * o.dir + sway, cx + w + hunch * o.dir + sway);
    }
    // Bas du manteau effiloché.
    for (let x = 0; x < W; x++) if (m[H - 1][x] && (x * 7 + (o.seed || 0)) % 5 < 2) { m[H - 1][x] = 0; if ((x * 3) % 4 === 0) m[H - 2][x] = 0; }
    if (o.staff) { const sx = cx + o.dir * (fl + 1); for (let y = hy - 4; y < H; y++) set(sx, y); span(hy - 5, sx - 1, sx + 1); span(hy - 6, sx - 1, sx + 1); }
    let body = '', rim = '';
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!m[y][x]) continue;
      body += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
      // Liseré : pixel de bord tourné vers la lumière (dir : +1 vers la droite, −1 vers la gauche).
      const lit = !(m[y][x + o.dir]) || (y > 0 && !m[y - 1][x] && (x - cx) * o.dir >= -2);
      if (lit) rim += `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
    }
    let eyes = '';
    // Couronne d'étoiles : trois points lumineux au-dessus de la tête.
    if (o.crown) eyes += [[0, -r - 3], [-3, -r - 1], [3, -r - 1], [-5, -r + 2], [5, -r + 2]].map(([dx, dy]) => `<rect x="${cx + dx}" y="${hy + dy}" width="1" height="1"/>`).join('');
    if (o.eyes) {
      const ey = hy + 1, ex = cx + o.dir * 2;
      eyes += `<rect x="${ex}" y="${ey}" width="1" height="1"/><rect x="${ex + o.dir * 3}" y="${ey}" width="1" height="1"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" preserveAspectRatio="xMidYMax meet">
      <g fill="#000">${body}</g><g fill="${o.rim}" opacity="${o.rimA || 0.85}">${rim}</g><g class="ct-eyes" fill="${o.eye || o.rim}">${eyes}</g></svg>`;
  }
  const CAST = {
    moi: { name: '???', color: '#f1ecda', fig: { dir: 1, hood: 6, peak: true, shoulder: 10, flare: 15, rim: 'rgba(241,236,218,0.75)', rimA: 0.7, seed: 1 } },
    vela: { name: 'VELA', color: '#c9a8ff', fig: { dir: -1, hood: 5, hair: 26, shoulder: 8, flare: 13, rim: '#b48cff', eyes: true, crown: true, eye: '#f0e4ff', seed: 3, lean: -2 } },
    ancien: { name: 'L’ANCIEN', color: '#f6c453', fig: { dir: -1, hood: 6, peak: true, hunch: 4, bow: 3, shoulder: 12, flare: 16, staff: true, rim: '#f6c453', eyes: true, eye: '#ffe6a0', seed: 5, lean: 2 } }
  };
  const SCENES = {
    vela1: [
      ['vela', 'Tiens. Un nouveau.'],
      ['vela', 'Ça faisait des éons qu’aucune étincelle ne s’était allumée dans cette nébuleuse.'],
      ['moi', '…'],
      ['vela', 'Tu ne sais pas qui tu es. Aucun de nous ne le savait, au début.'],
      ['vela', 'Moi, c’est Vela. Je tisse des étoiles, là-bas, vers le bord.'],
      ['vela', 'Chaque astre que tu vaincs t’apprend une forme nouvelle. Garde celles qui te ressemblent.'],
      ['moi', 'Et après ?'],
      ['vela', 'Après, il y a Kronos. Elle a déjà dévoré plus de Créateurs que tu ne peux l’imaginer.'],
      ['vela', 'Grandis vite, petit monde.']
    ],
    ancien: [
      ['ancien', 'Approche… N’aie pas peur d’un vieux monde éteint.'],
      ['ancien', 'J’ai été un Créateur, moi aussi. J’avais des océans. Des forêts.'],
      ['moi', 'Que s’est-il passé ?'],
      ['ancien', 'Kronos. Elle a mangé mes lunes, une à une. Puis elle m’a mangé, moi.'],
      ['ancien', 'Écoute bien : quand elle s’apprête à dévorer, frappe ses lunes d’abord.'],
      ['ancien', 'Il ne me reste presque rien. Prends-le.']
    ],
    avantKronos: [
      ['vela', 'Te voilà donc. Je n’y croyais pas.'],
      ['vela', 'Kronos t’a senti venir. Elle a faim.'],
      ['moi', 'Moi aussi.'],
      ['vela', '… Alors va. Et reviens entier.']
    ],
    avantKronosCourt: [
      ['vela', 'Encore toi. Tu apprends vite.'],
      ['moi', 'Cette fois, je sais où frapper.']
    ],
    apresKronos: [
      ['vela', 'Kronos… tombée. Toute la nébuleuse l’a senti.'],
      ['vela', 'Les autres Créateurs vont venir te voir. Certains pour t’aider.'],
      ['vela', 'D’autres pour te prendre ce que tu as fait naître.'],
      ['moi', 'Qu’ils viennent.'],
      ['vela', 'Bienvenue parmi nous, Créateur.']
    ]
  };
  const talkState = { skip: false, fast: false, typing: false, next: null };
  $('cTalk').addEventListener('pointerdown', (e) => {
    if (e.target.closest('#ctSkip')) return;
    if (talkState.typing) talkState.fast = true;
    else if (talkState.next) talkState.next();
  });
  $('ctSkip').addEventListener('click', () => { talkState.skip = true; if (talkState.next) talkState.next(); });
  async function talk(id) {
    const lines = SCENES[id];
    const other = lines.find((l) => l[0] !== 'moi')[0];
    $('ctLeft').innerHTML = figureSvg(CAST.moi.fig);
    $('ctRight').innerHTML = figureSvg(CAST[other].fig);
    $('ctRight').style.setProperty('--glow', CAST[other].fig.rim);
    $('cTalk').classList.remove('on');
    $('ctName').textContent = '';
    $('ctText').textContent = '';
    talkState.skip = false;
    await A.show('cTalk');
    await wait(80);
    $('cTalk').classList.add('on');
    SFX.summon(0);
    await wait(900);
    for (const [who, text] of lines) {
      if (talkState.skip) break;
      const c = CAST[who];
      $('cTalk').dataset.speaker = who === 'moi' ? 'left' : 'right';
      $('ctName').textContent = c.name;
      $('ctName').style.color = c.color;
      const p = $('ctText');
      p.textContent = '';
      talkState.typing = true;
      talkState.fast = false;
      for (const ch of text) {
        if (talkState.skip) break;
        if (talkState.fast) { p.textContent = text; break; }
        p.textContent += ch;
        if (ch !== ' ') SFX.type();
        await wait(',.…!?'.includes(ch) ? 260 : 34);
      }
      p.textContent = text;
      talkState.typing = false;
      $('ctBox').classList.add('ready');
      await new Promise((res) => { talkState.next = res; });
      talkState.next = null;
      $('ctBox').classList.remove('ready');
      SFX.tap();
    }
    $('cTalk').classList.remove('on');
    await wait(500);
  }

  // ─── Entrée depuis le menu ──────────────────────────────────
  $('campBtn').addEventListener('click', () => {
    SFX.tap();
    const saved = load();
    if (!saved) { newRun(); return; }
    A.openSheet(`<h3>CAMPAGNE</h3><h2>Une expédition vous attend</h2>
      <p class="muted">Étage ${saved.floor} · ${saved.hp} / ${saved.maxHp} PV · ${saved.deck.length} cartes</p>
      <div class="sheet-actions"><button class="btn primary" data-camp="resume">REPRENDRE</button><button class="btn" data-camp="new">NOUVELLE</button></div>`);
  });

  async function newRun() {
    A.closeSheet();
    A.stopAmbient();
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    run = C.newRun(seed);
    lookWorld();
    save();
    const st = stats();
    st.runs++;
    A.store.set(STATS_KEY, JSON.stringify(st));
    await openStory();
    const first = A.store.get(INTRO_KEY, '') !== '1';
    await wait(900);
    await tell(first ? INTRO : AGAIN);
    await gatherWorld();
    await wait(400);
    if (first) await tell(INTRO_AFTER);
    A.store.set(INTRO_KEY, '1');
    if (!story.skip) { storyTitle('ACTE I', 'LA NÉBULEUSE NATALE'); SFX.level(); await wait(2600); }
    await openMap();
  }
  async function resume() {
    A.closeSheet();
    A.stopAmbient();
    run = load();
    if (!run) return newRun();
    lookWorld();
    if (run.combat && !run.combat.done) return enterFight();
    if (run.reward) return showReward(run.reward);
    if (run.event) return showEvent();
    await openMap();
  }

  // ─── Carte des chemins : un ciel en perspective ──────────────
  // Les étapes sont posées dans un espace 3D : chaque rangée s'éloigne vers l'horizon où attend
  // Kronos, chaque astre flotte à sa propre hauteur, des galaxies et des planètes peuplent les
  // côtés. La caméra avance d'astre en astre ; on glisse pour regarder plus loin.
  const MAP = { cam: -0.6, camX: 0, target: null, vel: 0, raf: 0, run: null, pos: null, decor: null, me: null, moving: false, drag: null };
  const LABEL = { combat: 'AFFRONTEMENT', elite: 'ASTRE PUISSANT', event: 'MYSTÈRE', rest: 'SANCTUAIRE', boss: 'KRONOS' };
  const DECOR_LOOKS = {
    'map-gal-0': { type: 'portal', seed: 41001 },
    'map-gal-1': { type: 'portal', seed: 41007 },
    'map-giant': { type: 'gas', seed: 41013, ring: true, full: true },
    'map-ice': { type: 'ice', seed: 41021 },
    'map-moon': { type: 'moon', seed: 41027 },
    'map-ast': { type: 'asteroid', seed: 41033 },
    'map-ast2': { type: 'asteroid', seed: 41039, shape: 'double' },
    'map-lava': { type: 'lava', seed: 41045 },
    'map-star': { type: 'star', seed: 41051, starClass: 'géante bleue' }
  };
  for (const [id, look] of Object.entries(DECOR_LOOKS)) stage.register(id, look);
  stage.register('cn-rest', { type: 'star', seed: 41061, starClass: 'étoile orange' });
  for (let k = 0; k < 4; k++) stage.register('cn-event-' + k, { type: 'portal', seed: 41071 + k * 13 });

  function seededRand(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function worldLayout() {
    if (MAP.run === run && MAP.pos) return;
    const rnd = seededRand(run.seed ^ 0x9e3779b9);
    MAP.pos = {};
    for (const n of C.allNodes(run)) {
      MAP.pos[n.id] = n.type === 'boss'
        ? { X: 0, Y: C.ROWS + 1.6, Z: 2.6, size: 5.5 }
        : { X: (n.col - 1) * 1.15 + (rnd() - 0.5) * 0.45, Y: n.row + (rnd() - 0.5) * 0.3, Z: (rnd() - 0.5) * 0.9, size: n.type === 'elite' ? 1.15 : n.type === 'rest' ? 0.7 : n.type === 'event' ? 0.85 : 0.92 };
    }
    const side = ['map-moon', 'map-ast', 'map-ice', 'map-ast2', 'map-lava', 'map-moon', 'map-ast', 'map-star'];
    MAP.decor = [
      { id: 'map-gal-0', X: -3.4, Y: C.ROWS + 7, Z: 4.2, size: 4.5 },
      { id: 'map-gal-1', X: 3.8, Y: C.ROWS + 11, Z: 6.5, size: 5.5 },
      { id: 'map-giant', X: 3.6, Y: C.ROWS + 4.5, Z: 2.4, size: 4.2 }
    ];
    for (let k = 0; k < 9; k++) {
      MAP.decor.push({ id: side[k % side.length], X: (k % 2 ? 1 : -1) * (2.3 + rnd() * 1.4), Y: k * 1.15 + rnd() * 0.8 - 0.3, Z: rnd() * 1.8 - 0.5, size: 0.35 + rnd() * 0.65 });
    }
    MAP.run = run;
  }
  const curPos = () => (run.node ? MAP.pos[run.node] : { X: 0, Y: -0.75, Z: -0.1 });
  const camFor = (p) => p.Y + 0.15;
  const camXFor = (p) => p.X * 0.55;
  // Notre monde se pose juste devant l'astre visité, un peu plus bas.
  const mePos = (p) => ({ X: p.X + 0.12, Y: p.Y - 0.05, Z: p.Z - 0.1, size: 0.62 });

  function view() { const v = $('cmView'); return { W: v.clientWidth || 390, H: v.clientHeight || 700 }; }
  function project(p, V) {
    const camY = MAP.cam - 1.6;
    const d = p.Y - camY;
    if (d < 0.32) return null;
    const F = V.H * 0.7, s = 1 / d;
    return { x: V.W / 2 + (p.X - MAP.camX) * F * s * 0.5, y: V.H * 0.12 + (2.4 - p.Z) * F * s * 0.45, s, d, px: (p.size || 1) * F * s * 0.3 };
  }
  function renderTop() {
    $('cmBack').innerHTML = icon('back');
    $('cmHp').innerHTML = `${icon('heart')} ${run.hp}<small>/${run.maxHp}</small>`;
    $('cmDeck').innerHTML = `CRÉATION · ${run.deck.length} cartes`;
    const rel = run.relics.map((k) => `<button class="relic" data-relic="${k}" aria-label="${esc(C.RELICS[k].name)}">${icon('spark')}</button>`).join('');
    $('cmRelics').innerHTML = rel;
    $('cfRelics').innerHTML = rel;
  }
  function buildMap() {
    worldLayout();
    renderTop();
    const nodes = C.allNodes(run);
    const open = new Set(C.choices(run));
    const done = new Set(run.path);
    const body = (n) => {
      if (n.type === 'event') return `<span class="orb cn-orb" data-planet="cn-event-${(n.row + n.col) % 4}"></span><span class="cn-badge">${icon('ask')}</span>`;
      if (n.type === 'rest') return `<span class="orb cn-orb" data-planet="cn-rest"></span><span class="cn-badge rest">${icon('flame')}</span>`;
      const pool = n.type === 'boss' ? C.GROUPS.boss : n.type === 'elite' ? C.GROUPS.elite : n.row <= 1 ? C.GROUPS.faible : C.GROUPS.moyen;
      return `<span class="orb cn-orb" data-planet="foe-${pool[n.group || 0][0]}"></span>`;
    };
    $('cmMap').innerHTML =
      MAP.decor.map((d, k) => `<span class="cdecor" data-decor="${k}"><span class="orb cn-orb" data-planet="${d.id}"></span></span>`).join('') +
      nodes.map((n) => {
        const st = done.has(n.id) ? 'done' : open.has(n.id) ? 'open' : 'far';
        return `<button class="cnode t-${n.type} ${st}" data-node="${n.id}" aria-label="${LABEL[n.type]}">${body(n)}<b class="cn-label">${LABEL[n.type]}</b></button>`;
      }).join('') + '<span class="cnode cm-me" id="cmMe"><span class="orb cn-orb" data-planet="camp-world"></span></span>';
    MAP.me = mePos(curPos());
  }
  function placeMap() {
    if (!run || !MAP.pos) return;
    const V = view();
    const open = new Set(C.choices(run));
    const done = new Set(run.path);
    const put = (el, p, extraDim) => {
      const q = project(p, V);
      if (!q || q.y - q.px > V.H + 40 || q.px < 3) { el.style.display = 'none'; return null; }
      el.style.display = '';
      el.style.transform = `translate(${(q.x - q.px / 2).toFixed(1)}px, ${(q.y - q.px / 2).toFixed(1)}px)`;
      el.style.width = el.style.height = q.px.toFixed(1) + 'px';
      el.style.zIndex = String(Math.max(1, Math.round(2000 - q.d * 100)));
      el.classList.toggle('tiny', q.px < 30);
      const fog = Math.min(1, Math.max(0.3, Math.min(1, 1.25 - q.d * 0.075)) * (extraDim || 1));
      const orb = el.querySelector('.orb');
      if (orb) orb.dataset.dim = fog.toFixed(2);
      el.style.setProperty('--fog', fog.toFixed(2));
      return q;
    };
    MAP.decor.forEach((d, k) => put($('cmMap').querySelector(`[data-decor="${k}"]`), d, 0.75));
    const pts = {};
    for (const el of $('cmMap').querySelectorAll('.cnode[data-node]')) {
      const id = el.dataset.node;
      pts[id] = put(el, MAP.pos[id], done.has(id) && id !== run.node ? 0.45 : id === 'boss' ? 3 : 1);
    }
    put($('cmMe'), MAP.me, 1);
    // Routes : lignes en pointillés, épaisses près de nous, fines au loin ; les routes ouvertes brillent.
    let lines = '';
    for (const n of C.allNodes(run)) {
      for (const id of n.next) {
        const a = MAP.pos[n.id], b = MAP.pos[id];
        const pa = project(a, V), pb = project(b, V);
        if (!pa || !pb) continue;
        const walked = done.has(n.id) && done.has(id);
        const live = (n.id === run.node || (!run.node && false)) && open.has(id);
        const w = Math.max(0.6, Math.min(3.5, (pa.s + pb.s) * 1.6));
        lines += `<line x1="${pa.x.toFixed(1)}" y1="${pa.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" stroke-width="${w.toFixed(2)}" class="${walked ? 'walked' : live ? 'live' : ''}" style="opacity:${Math.max(0.15, Math.min(1, 1.2 - Math.max(pa.d, pb.d) * 0.07)).toFixed(2)}"/>`;
      }
    }
    if (!run.node) {
      const pm = project(MAP.me, V);
      for (const id of open) { const pb = project(MAP.pos[id], V); if (pm && pb) lines += `<line x1="${pm.x.toFixed(1)}" y1="${pm.y.toFixed(1)}" x2="${pb.x.toFixed(1)}" y2="${pb.y.toFixed(1)}" stroke-width="2.2" class="live"/>`; }
    }
    $('cmLines').setAttribute('viewBox', `0 0 ${V.W} ${V.H}`);
    $('cmLines').innerHTML = lines;
    stage.skyOff = [0, MAP.cam * 0.06];
  }
  function mapLoop() {
    cancelAnimationFrame(MAP.raf);
    const step = () => {
      if (MAP.target != null && !MAP.drag && !MAP.moving) {
        MAP.cam += (MAP.target - MAP.cam) * 0.1;
        if (Math.abs(MAP.target - MAP.cam) < 0.002) MAP.target = null;
      } else if (!MAP.drag && !MAP.moving && Math.abs(MAP.vel) > 0.0005) {
        MAP.cam = clampCam(MAP.cam + MAP.vel);
        MAP.vel *= 0.92;
      }
      placeMap();
      if (A && document.getElementById('cMap').classList.contains('active')) MAP.raf = requestAnimationFrame(step);
    };
    MAP.raf = requestAnimationFrame(step);
  }
  const clampCam = (c) => Math.max(camFor(curPos()) - 0.4, Math.min(C.ROWS + 0.6, c));

  async function openMap() {
    worldLayout();
    MAP.cam = camFor(curPos());
    MAP.camX = camXFor(curPos());
    MAP.vel = 0;
    buildMap();
    $('cmHint').classList.toggle('gone', A.store.get(GLIDE_KEY, '') === '1');
    await A.show('cMap');
    buildMap();
    placeMap();
    mapLoop();
    if (A.store.get(MAP_TUTO_KEY, '') !== 'fini') setTimeout(() => A.coachStart(MAP_STEPS, () => A.store.set(MAP_TUTO_KEY, 'fini')), 700);
  }
  $('cmBack').addEventListener('click', async () => { SFX.tap(); save(); await A.backToMenu(); });
  $('cmDeck').addEventListener('click', () => { SFX.tap(); deckSheet('VOTRE CRÉATION', run.deck, null); });
  document.addEventListener('click', (e) => {
    const r = e.target.closest('[data-relic]');
    if (!r || !run) return;
    const k = C.RELICS[r.dataset.relic];
    A.toast(`${k.name} : ${k.text}`, 3200);
  });

  // Glisser vers le haut : la caméra avance pour regarder plus loin ; un toucher choisit un astre.
  $('cmView').addEventListener('pointerdown', (e) => {
    if (!run || MAP.moving) return;
    MAP.drag = { y0: e.clientY, cam0: MAP.cam, t: performance.now(), last: e.clientY, moved: false, id: e.pointerId };
    MAP.vel = 0;
    MAP.target = null;
  });
  $('cmView').addEventListener('pointermove', (e) => {
    const d = MAP.drag;
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 8) d.moved = true;
    if (!d.moved) return;
    const k = 1 / (view().H * 0.16);
    MAP.cam = clampCam(d.cam0 - dy * k);
    MAP.vel = -(e.clientY - d.last) * k * 0.9;
    d.last = e.clientY;
    if (dy < -40) { $('cmHint').classList.add('gone'); A.store.set(GLIDE_KEY, '1'); }
  });
  const endDrag = async (e) => {
    const d = MAP.drag;
    if (!d || e.pointerId !== d.id) return;
    MAP.drag = null;
    if (d.moved) { A.tuto('campRegarde'); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const b = el && el.closest('.cnode[data-node]');
    if (b) await goNode(b.dataset.node);
  };
  $('cmView').addEventListener('pointerup', endDrag);
  $('cmView').addEventListener('pointercancel', () => { MAP.drag = null; });

  async function goNode(id) {
    if (ui.busy || !run) return;
    if (!C.choices(run).includes(id)) {
      const n = C.nodeById(run, id);
      SFX.error();
      A.toast(n && n.type === 'boss' ? 'Kronos vous attend au bout du chemin.' : 'Suivez une route reliée à votre monde.', 1800);
      return;
    }
    ui.busy = true;
    A.tuto('campVoyage');
    SFX.place();
    // Voyage : notre monde file le long de la route, la caméra le suit.
    const from = Object.assign({}, MAP.me), to = mePos(MAP.pos[id]);
    const c0 = MAP.cam, c1 = camFor(MAP.pos[id]), x0 = MAP.camX, x1 = camXFor(MAP.pos[id]);
    MAP.moving = true;
    SFX.whoosh(0);
    const t0 = performance.now(), ms = 1150;
    await new Promise((res) => {
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        MAP.me.X = from.X + (to.X - from.X) * e;
        MAP.me.Y = from.Y + (to.Y - from.Y) * e;
        MAP.me.Z = from.Z + (to.Z - from.Z) * e + Math.sin(k * Math.PI) * 0.35;
        MAP.cam = c0 + (c1 - c0) * e;
        MAP.camX = x0 + (x1 - x0) * e;
        const el = $('cmMe');
        if (el && Math.random() < 0.6) {
          const [x, y] = center(el);
          stage.burst(x, y, { n: 2, colors: [[200, 220, 255], [255, 255, 255]], speed: 14, life: 0.5, drag: 3 });
        }
        if (k < 1) requestAnimationFrame(tick); else res();
      };
      requestAnimationFrame(tick);
    });
    MAP.moving = false;
    const res = C.enter(run, id);
    save();
    const el = $('cmMap').querySelector(`[data-node="${id}"] .orb`);
    if (el) stage.flash(el, 0.8);
    await wait(250);
    ui.busy = false;
    if (res.kind === 'combat') await startFight(res.node);
    else if (res.kind === 'event') showEvent();
    else showRest();
  }

  // Tutoriel de la carte (première visite).
  const MAP_TUTO_KEY = 'orbite.campagne.carte';
  const GLIDE_KEY = 'orbite.campagne.glisse';
  const MAP_STEPS = [
    { id: 'carte', text: 'Voici la <b>Nébuleuse natale</b>. Chaque astre est une étape : votre monde voyage d’astre en astre, jusqu’à <b>Kronos</b>, tout au fond du ciel.', next: 'SUIVANT', delay: 0, y: 0.08 },
    { id: 'routes', target: () => document.querySelector('#cmMap .cnode.open'), text: 'Les routes lumineuses partent de votre monde. Les astres entourés d’un cercle sont vos <b>prochaines étapes possibles</b>.', next: 'SUIVANT' },
    { id: 'types', text: '<b>Planète ennemie</b> : un affrontement. <b>Cercle rouge</b> : un astre puissant, plus dur, mais il donne un vestige. <b>Tourbillon</b> : un mystère. <b>Petite étoile</b> : un sanctuaire pour soigner ou améliorer une carte.', next: 'SUIVANT', y: 0.08 },
    { id: 'regarder', target: '#cmView', pad: -30, dim: false, text: '<b>Glissez vers le haut</b> pour regarder plus loin et choisir votre route. Les routes se séparent et se rejoignent : à vous de tracer la vôtre.', gesture: { from: '#cmView', drag: '#cmHp', at: 0.75 }, wait: ['campRegarde'], y: 0.08 },
    { id: 'creation', target: '#cmDeck', text: 'Ici, <b>votre création</b> : toutes vos cartes.', next: 'SUIVANT' },
    { id: 'partir', enter: () => { MAP.target = camFor(curPos()); }, delay: 700, target: () => document.querySelector('#cmMap .cnode.open'), text: 'À vous. <b>Touchez un astre entouré</b> pour y voyager.', gesture: { tap: () => document.querySelector('#cmMap .cnode.open'), at: 0.5 }, wait: ['campVoyage'] }
  ];

  // ─── Cartes ─────────────────────────────────────────────────
  function cardHtml(card, o) {
    o = o || {};
    const d = C.CARDS[card.id];
    const attrs = o.attrs || `data-uid="${card.uid || ''}"`;
    return `<button class="ccard t-${d.type}${card.up ? ' up' : ''}${o.cls ? ' ' + o.cls : ''}" ${attrs} style="--c:${A.famColor(d.el)}">
      <span class="cc-cost">${C.costOf(card)}</span>
      <canvas class="sphere cc-sph" data-fam="${d.el}"></canvas>
      <b class="cc-name">${esc(C.cardName(card))}</b>
      <small class="cc-type">${C.TYPE_NAME[d.type]}</small>
      <span class="cc-text">${esc(C.cardText(card))}</span>
    </button>`;
  }
  function deckSheet(title, cards, pickAttr, preview) {
    const sorted = cards.slice().sort((a, b) => (C.CARDS[a.id].type > C.CARDS[b.id].type ? 1 : -1) || a.id.localeCompare(b.id));
    A.openSheet(`<h3>${title}</h3><div class="cc-grid">${sorted.map((k) => {
      const shown = preview ? Object.assign({}, k, { up: true }) : k;
      return cardHtml(shown, { attrs: pickAttr ? `data-camp="${pickAttr}" data-card="${k.uid}"` : 'data-camp="noop"', cls: 'mini' });
    }).join('')}</div>` + (pickAttr ? '' : '<div class="sheet-actions"><button class="btn" data-act="close">FERMER</button></div>'), { locked: !!pickAttr });
    A.mountEnergy($('sheet'));
  }

  // ─── Combat ─────────────────────────────────────────────────
  async function startFight(node) {
    if (node.type === 'boss') {
      const seen = A.store.get(BOSS_KEY, '') === '1';
      A.store.set(BOSS_KEY, '1');
      await talk(seen ? 'avantKronosCourt' : 'avantKronos');
      await openStory();
      $('csOrb').dataset.planet = 'foe-kronos';
      stage.setReveal($('csOrb'), 0);
      await wait(600);
      stage.reveal($('csOrb'), 0, 1, 2400);
      await tell(BOSS);
    }
    await enterFight();
    if (node.type === 'elite') {
      const id = run.combat.enemies[0].id;
      hint(ELITE_LINE[id] || 'Un astre puissant se dresse devant vous.', 3600);
      A.banner('ASTRE PUISSANT', esc(C.ENEMIES[id].name), 'lose');
    } else if (node.type === 'boss') A.banner('KRONOS', 'la géante dévoreuse', 'lose');
  }
  async function enterFight() {
    ui.sel = null;
    renderFight(true);
    await A.show('cFight');
    renderFight(true);
    const c = run.combat;
    if (c.startEvents && c.startEvents.length) {
      await animate(c.startEvents.filter((e) => e.t !== 'draw' && e.t !== 'turn'));
      c.startEvents = null;
      save();
    }
    if (A.store.get(TUTO_KEY, '') !== 'fini') setTimeout(() => A.coachStart(CAMP_STEPS, () => A.store.set(TUTO_KEY, 'fini')), 900);
  }

  function hint(text, ms) {
    const h = $('cfHint');
    h.textContent = text || '';
    h.classList.toggle('show', !!text);
    clearTimeout(hint.t);
    if (text && ms) hint.t = setTimeout(() => h.classList.remove('show'), ms);
  }

  function renderFight(fresh) {
    if (!run || !run.combat) return;
    $('cfFloor').textContent = `ÉTAGE ${run.floor} · ACTE I`;
    renderTop();
    renderFoes(fresh);
    renderMe();
    renderHand(fresh);
    renderBar();
  }
  function renderBar() {
    const c = run.combat;
    $('cfEnergy').innerHTML = `<b>${c.energy}</b><small>/${c.maxEnergy + (c.powers.genese || 0)}</small>`;
    $('cfDraw').innerHTML = `<b>${c.draw.length}</b><small>PIOCHE</small>`;
    $('cfDisc').innerHTML = `<b>${c.discard.length}</b><small>DÉFAUSSE</small>`;
    $('cfEnd').disabled = ui.busy;
  }
  function hpBar(hp, max, block) {
    return `<i style="width:${Math.max(0, hp / max * 100).toFixed(1)}%"></i><span>${block ? `<em>${icon('shield')}${block}</em>` : ''}${hp} / ${max}</span>`;
  }
  function badges(st, powers) {
    let h = '';
    for (const [k, n] of Object.entries(st || {})) if (n > 0 && C.STATUS[k]) h += `<span class="cf-st st-${k}" title="${esc(C.STATUS[k].text)}">${esc(C.STATUS[k].name)} ${n}</span>`;
    for (const [k, n] of Object.entries(powers || {})) if (n > 0) h += `<span class="cf-st st-power">${esc(C.POWERS[k].name)}</span>`;
    return h;
  }
  function renderMe() {
    const c = run.combat;
    $('cfMeHp').innerHTML = hpBar(run.hp, run.maxHp, c.block);
    $('cfMeBadges').innerHTML = badges(c.st, c.powers);
    $('cfMeOrb').dataset.shield = c.block > 0 ? '1' : '0';
  }
  function intentHtml(u) {
    const i = C.intentOf(run, u);
    let h = '';
    if (i.kinds.includes('atk')) h += `<span class="ci atk">${icon('sword')}${i.atk}${i.hits > 1 ? '×' + i.hits : ''}</span>`;
    if (i.kinds.includes('def')) h += `<span class="ci def">${icon('shield')}</span>`;
    if (i.kinds.includes('buff')) h += `<span class="ci buff">${icon('up')}</span>`;
    if (i.kinds.includes('debuff')) h += `<span class="ci debuff">${icon('drop')}</span>`;
    if (i.kinds.includes('summon')) h += `<span class="ci summon">${icon('moon')}</span>`;
    if (i.kinds.includes('devour')) h += `<span class="ci devour">${icon('skull')}</span>`;
    return h + `<small class="ci-name">${esc(i.name)}</small>`;
  }
  function renderFoes(fresh) {
    const c = run.combat;
    const box = $('cfFoes');
    const list = c.enemies.filter((u) => u.hp > 0);
    const have = new Map([...box.children].map((el) => [el.dataset.uid, el]));
    const n = list.length;
    for (const u of list) {
      let el = have.get(u.uid);
      if (!el) {
        el = document.createElement('div');
        el.className = 'cfoe';
        el.dataset.uid = u.uid;
        el.innerHTML = `<div class="cf-intent"></div><div class="orb cfoe-orb" data-planet="foe-${u.id}"></div><div class="cf-hpbar"></div><div class="cf-badges"></div><b class="cf-name">${esc(C.ENEMIES[u.id].name)}</b>`;
        box.appendChild(el);
        if (!fresh) A.revealIn(el.querySelector('.orb'), 0);
      }
      have.delete(u.uid);
      const e = C.ENEMIES[u.id];
      el.classList.toggle('boss', !!e.boss);
      el.classList.toggle('elite', !!e.elite);
      el.style.setProperty('--s', (e.boss ? 150 : n === 1 ? 118 : n === 2 ? 96 : 74) + 'px');
      el.querySelector('.cf-intent').innerHTML = intentHtml(u);
      el.querySelector('.cf-hpbar').innerHTML = hpBar(u.hp, u.maxHp, u.block);
      el.querySelector('.cf-badges').innerHTML = badges(u.st);
      el.querySelector('.orb').dataset.shield = u.block > 0 ? '1' : '0';
    }
    for (const el of have.values()) el.remove();
    box.classList.toggle('targeting', !!(ui.sel && C.CARDS[cardBy(ui.sel).id].target && n > 1));
  }
  const cardBy = (uid) => run.combat.hand.find((k) => k.uid === uid) || { id: 'impact' };
  function renderHand(fresh) {
    const c = run.combat;
    const box = $('cfHand');
    const have = new Map([...box.children].map((el) => [el.dataset.uid, el]));
    const n = c.hand.length;
    // Marge pour la pastille de coût et l'éventail : aucune carte ne sort de l'écran.
    const W = Math.min((box.clientWidth || window.innerWidth - 20) - 24, 480);
    // Jusqu'à 5 cartes, elles tiennent côte à côte ; au-delà, elles se chevauchent en éventail.
    const cw = Math.max(70, Math.min(96, W / Math.max(1, Math.min(n, 5)) - 3));
    const step = n > 1 ? Math.min(cw + 6, (W - cw) / (n - 1)) : 0;
    const x0 = 12 + (W - (cw + step * (n - 1))) / 2;
    c.hand.forEach((card, i) => {
      let el = have.get(card.uid);
      if (!el) {
        const t = document.createElement('div');
        t.innerHTML = cardHtml(card);
        el = t.firstElementChild;
        box.appendChild(el);
        if (!fresh) el.animate([{ transform: 'translate(-60vw, 40px) rotate(-20deg)', opacity: 0 }, { opacity: 1 }], { duration: 320, delay: i * 40, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      }
      have.delete(card.uid);
      const mid = (n - 1) / 2;
      el.style.setProperty('--x', x0 + i * step + 'px');
      el.style.setProperty('--r', ((i - mid) * 2.2).toFixed(1) + 'deg');
      el.style.setProperty('--y', (Math.abs(i - mid) * 3).toFixed(0) + 'px');
      el.style.setProperty('--w', cw + 'px');
      el.style.zIndex = ui.sel === card.uid ? 50 : i + 1;
      el.classList.toggle('sel', ui.sel === card.uid);
      el.classList.toggle('poor', C.costOf(card) > c.energy);
    });
    for (const el of have.values()) el.remove();
    A.mountEnergy(box);
  }

  // Toucher une carte la sélectionne ; la toucher de nouveau la joue (ou toucher un astre ciblé).
  $('cfHand').addEventListener('click', (e) => {
    const el = e.target.closest('.ccard');
    if (!el || ui.busy || !run || !run.combat) return;
    const card = run.combat.hand.find((k) => k.uid === el.dataset.uid);
    if (!card) return;
    if (C.costOf(card) > run.combat.energy) { A.refuse('Pas assez d’énergie.'); el.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 220 }); return; }
    const d = C.CARDS[card.id];
    const foes = C.alive(run.combat);
    if (ui.sel === card.uid) {
      if (!d.target || foes.length === 1) { playCard(card.uid, foes[0] && foes[0].uid); return; }
    }
    ui.sel = card.uid;
    SFX.lift();
    hint(d.target && foes.length > 1 ? 'Touchez l’astre à viser.' : 'Touchez de nouveau la carte pour la jouer.');
    renderHand();
    renderFoes();
  });
  $('cfFoes').addEventListener('click', (e) => {
    const el = e.target.closest('.cfoe');
    if (!el || ui.busy || !run || !run.combat) return;
    const u = run.combat.enemies.find((k) => k.uid === el.dataset.uid);
    if (!u) return;
    if (ui.sel && C.CARDS[cardBy(ui.sel).id].target) { playCard(ui.sel, u.uid); return; }
    if (ui.sel) { playCard(ui.sel, u.uid); return; }
    foeSheet(u);
  });
  $('cfMe').addEventListener('click', () => {
    if (ui.busy || !run || !run.combat) return;
    if (ui.sel && !C.CARDS[cardBy(ui.sel).id].target) { playCard(ui.sel, null); return; }
    const c = run.combat;
    const st = Object.entries(c.st).filter(([, n]) => n > 0).map(([k, n]) => `<div><b>${esc(C.STATUS[k].name.toUpperCase())} ${n}</b>${esc(C.STATUS[k].text)}</div>`).join('');
    const pw = Object.entries(c.powers).filter(([, n]) => n > 0).map(([k, n]) => `<div><b>${esc(C.POWERS[k].name.toUpperCase())}</b>${esc(C.POWERS[k].text.replace('{n}', n))}</div>`).join('');
    A.openSheet(`<h3>VOTRE MONDE</h3><h2>${run.hp} / ${run.maxHp} PV</h2><p class="muted">Bouclier : ${c.block}. Il absorbe les dégâts jusqu’à votre prochain tour.</p><div class="kw-list">${st}${pw}</div>`);
  });
  function foeSheet(u) {
    const e = C.ENEMIES[u.id], i = C.intentOf(run, u), m = e.moves[u.intent];
    const parts = [];
    if (i.kinds.includes('atk')) parts.push(`attaque ${i.atk}${i.hits > 1 ? ' × ' + i.hits : ''}`);
    if (i.kinds.includes('def')) parts.push(`se protège (${m.def || 12} Bouclier)`);
    if (m.buff) parts.push('se renforce : ' + Object.entries(m.buff).map(([k, n]) => `${C.STATUS[k].name} +${n}`).join(', '));
    if (m.debuff) parts.push('vous affaiblit : ' + Object.entries(m.debuff).map(([k, n]) => `${C.STATUS[k].name} ${n}`).join(', '));
    if (m.summon) parts.push('appelle des lunes');
    if (i.kinds.includes('devour')) parts.push('dévore une lune : soigne 12 PV et gagne 2 Masse');
    const st = Object.entries(u.st).filter(([, n]) => n > 0).map(([k, n]) => `<div><b>${esc(C.STATUS[k].name.toUpperCase())} ${n}</b>${esc(C.STATUS[k].text)}</div>`).join('');
    A.openSheet(`<div class="sheet-top"><div class="orb sheet-orb" data-planet="foe-${u.id}"></div><div><span class="fam-chip" style="--c:${e.boss ? '#ff6b6b' : e.elite ? '#f6c453' : '#9aa3ad'}">${e.boss ? 'BOSS' : e.elite ? 'ASTRE PUISSANT' : 'ASTRE ERRANT'}</span><h2>${esc(e.name)}</h2><p class="muted">${u.hp} / ${u.maxHp} PV${u.block ? ' · Bouclier ' + u.block : ''}</p></div></div>
      <div class="power-box" style="--c:#ff7a59"><span class="power-label">PROCHAINE ACTION · ${esc(m.n.toUpperCase())}</span><p class="sheet-text">${esc(parts.join(' · ') || '…')}</p></div><div class="kw-list">${st}</div>`);
  }

  async function playCard(uid, target) {
    const c = run.combat;
    const el = $('cfHand').querySelector(`.ccard[data-uid="${uid}"]`);
    const card = c.hand.find((k) => k.uid === uid);
    const r = C.play(run, uid, target);
    if (!r.ok) { A.refuse(r.reason); return; }
    ui.busy = true;
    ui.sel = null;
    hint('');
    A.tuto('campJouer');
    const d = C.CARDS[card.id];
    // La carte s'envole vers sa cible puis se dissout dans une lumière de sa couleur.
    if (el) {
      const tEl = target ? document.querySelector(`.cfoe[data-uid="${target}"] .orb`) : $('cfMeOrb');
      const b = el.getBoundingClientRect();
      const [tx, ty] = tEl ? center(tEl) : [window.innerWidth / 2, window.innerHeight / 2];
      el.classList.add('flying');
      SFX.whoosh(0);
      await el.animate([{ transform: el.style.transform || 'none', opacity: 1 }, { transform: `translate(${tx - b.left - b.width / 2}px, ${ty - b.top - b.height / 2}px) scale(.35)`, opacity: 0 }], { duration: 300, easing: 'cubic-bezier(.5,0,.5,1)', fill: 'forwards' }).finished.catch(() => {});
      el.remove();
    }
    ui.color = elColor(d.el);
    renderBar();
    renderHand();
    await animate(r.events.filter((e) => e.t !== 'play'));
    ui.busy = false;
    renderFight();
    save();
    await afterAction();
  }

  $('cfEnd').addEventListener('click', async () => {
    if (ui.busy || !run || !run.combat || run.over) return;
    SFX.tap();
    A.tuto('campFinTour');
    ui.busy = true;
    ui.sel = null;
    hint('');
    renderBar();
    const r = C.endTurn(run);
    await animate(r.events);
    ui.busy = false;
    renderFight();
    save();
    await afterAction();
  });

  async function afterAction() {
    if (!run) return;
    if (run.over || (run.combat && run.combat.done)) A.coachStop(true);
    if (run.over && !run.won) { await defeat(); return; }
    if (run.combat && run.combat.done) await victory();
  }

  // ─── Animations des événements ──────────────────────────────
  const foeEl = (uid) => document.querySelector(`.cfoe[data-uid="${uid}"]`);
  const orbOf = (who) => (who === 'p' ? $('cfMeOrb') : foeEl(who) && foeEl(who).querySelector('.orb'));
  function shake(el, k) {
    if (!el) return;
    const d = 4 + (k || 0);
    el.animate([{ transform: 'none' }, { transform: `translate(${-d}px, 1px)` }, { transform: `translate(${d}px, -1px)` }, { transform: 'none' }], { duration: 260 });
  }
  async function animate(events) {
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      switch (e.t) {
        case 'hit': await hitAnim(e); break;
        case 'block': {
          const o = $('cfMeOrb');
          A.popOn(o, `+${e.n} ${icon('shield')}`, 'energy');
          SFX.shield();
          o.dataset.shield = '1';
          renderMe();
          await wait(220);
          break;
        }
        case 'foeBlock': { const o = orbOf(e.uid); A.popOn(o, `+${e.n} ${icon('shield')}`, 'energy'); renderFoes(); await wait(200); break; }
        case 'status': {
          const o = orbOf(e.who);
          const good = C.STATUS[e.st].good;
          A.popOn(o, `${e.why ? e.why.toUpperCase() + ' · ' : ''}${C.STATUS[e.st].name.toUpperCase()} ${e.n > 0 ? '+' : ''}${e.n}`, good ? 'gold' : 'bad');
          if (e.st === 'brulure') SFX.venom(); else SFX.buff();
          if (e.who === 'p') renderMe(); else renderFoes();
          await wait(260);
          break;
        }
        case 'heal': { A.popOn($('cfMeOrb'), `+${e.n} PV`, 'good'); SFX.buff(); renderMe(); await wait(200); break; }
        case 'foeHeal': { A.popOn(orbOf(e.uid), `+${e.n} PV`, 'good'); renderFoes(); await wait(200); break; }
        case 'energy': { A.popOn($('cfEnergy'), `+${e.n}`, 'energy'); renderBar(); await wait(160); break; }
        case 'power': { A.popOn($('cfMeOrb'), C.POWERS[e.key].name.toUpperCase(), 'gold'); SFX.level(); renderMe(); await wait(300); break; }
        case 'die': await dieAnim(e.uid); break;
        case 'flee': {
          const el = foeEl(e.uid);
          if (el) { await stage.reveal(el.querySelector('.orb'), 1, 0, 500); el.remove(); }
          break;
        }
        case 'summon': {
          renderFoes();
          const o = orbOf(e.uid), by = orbOf(e.by);
          if (o && by) stage.beam(center(by), center(o), { ms: 360, color: [220, 214, 190], arc: 10 });
          SFX.summon(0);
          await wait(380);
          break;
        }
        case 'devour': {
          const moon = orbOf(e.moon), k = orbOf(e.uid);
          if (moon && k) {
            A.popOn(k, 'DÉVORE UNE LUNE', 'bad');
            SFX.death(0);
            stage.beam(center(moon), center(k), { ms: 420, color: [200, 200, 220], arc: 20, head: 4 });
            await stage.reveal(moon, 1, 0, 400);
            const el = foeEl(e.moon);
            if (el) el.remove();
            stage.flash(k, 0.9);
          }
          await wait(200);
          break;
        }
        case 'act': {
          const el = foeEl(e.uid);
          if (el) {
            A.popOn(el.querySelector('.orb'), e.name.toUpperCase(), 'info');
            el.animate([{ transform: 'none' }, { transform: 'translateY(14px) scale(1.05)' }, { transform: 'none' }], { duration: 360, easing: 'ease-in-out' });
          }
          await wait(330);
          break;
        }
        case 'discardHand': await discardAnim(); break;
        case 'foes': setBanner('TOUR ADVERSE'); await wait(500); break;
        case 'turn': if (e.n > 1) { setBanner('VOTRE TOUR'); } break;
        case 'intents': renderFoes(); break;
        case 'reshuffle': A.popOn($('cfDraw'), 'MÉLANGE', 'info'); break;
        case 'draw': {
          // Les cartes piochées arrivent ensemble à la fin.
          while (i + 1 < events.length && events[i + 1].t === 'draw') i++;
          renderBar();
          renderHand();
          SFX.place();
          await wait(260);
          break;
        }
        case 'exhaust': case 'consume': break;
        default: break;
      }
    }
  }
  function setBanner(text) {
    const b = $('cfBanner');
    b.className = 'banner';
    void b.offsetWidth;
    b.innerHTML = `<h3>${text}</h3>`;
    b.classList.add('show', 'small');
    b.style.animationDuration = '1100ms';
  }
  async function hitAnim(e) {
    const toMe = e.who === 'p';
    const target = orbOf(e.who);
    if (!target) return;
    const [tx, ty] = center(target);
    if (e.kind === 'brulure') {
      A.popOn(target, `−${e.lost}`, 'bad');
      stage.burst(tx, ty, { n: 12, colors: [[255, 140, 60], [255, 220, 120]], speed: 50, up: 30, life: 0.6 });
      SFX.venom();
    } else if (e.kind === 'noyau') {
      stage.beam(center($('cfMeOrb')), [tx, ty], { ms: 260, color: [255, 140, 60], arc: 6, tail: 5 });
      await wait(260);
    } else {
      const src = toMe ? orbOf(e.src) : $('cfMeOrb');
      const from = src ? center(src) : [window.innerWidth / 2, window.innerHeight * 0.7];
      if (toMe && src) foeEl(e.src).animate([{ transform: 'none' }, { transform: 'translateY(22px) scale(1.08)' }, { transform: 'none' }], { duration: 300 });
      SFX.whoosh(0);
      await stage.beam(from, [tx, ty], { ms: 230, color: toMe ? [255, 110, 110] : ui.color || [255, 214, 120], arc: toMe ? -14 : 14, tail: 7, head: 3 });
    }
    stage.flash(target, toMe ? 0.6 : 0.8);
    if (e.blocked) A.popAt(tx, ty - 26, `${icon('shield')} ${e.blocked}`, 'energy');
    if (e.lost > 0 || !e.blocked) A.popOn(target, `−${e.lost}`, toMe ? 'bad' : 'gold');
    if (e.kind !== 'brulure') SFX.hit(Math.min(6, Math.ceil(e.n / 3)), 0);
    stage.burst(tx, ty, { n: 6 + Math.min(20, e.n), colors: toMe ? [[255, 120, 120], [255, 255, 255]] : [[255, 220, 150], [255, 255, 255]], speed: 70, life: 0.5 });
    if (toMe) {
      shake($('cFight'), Math.min(6, e.lost / 3));
      if (e.lost >= 8) { const v = document.createElement('div'); v.className = 'vignette'; document.body.appendChild(v); setTimeout(() => v.remove(), 950); A.vibrate([20, 30, 20]); }
      $('cfMeHp').innerHTML = hpBar(e.hp, run.maxHp, Math.max(0, run.combat ? run.combat.block : 0));
    } else {
      shake(foeEl(e.who), Math.min(6, e.lost / 3));
      const u = run.combat.enemies.find((k) => k.uid === e.who);
      const el = foeEl(e.who);
      if (el && u) el.querySelector('.cf-hpbar').innerHTML = hpBar(e.hp, u.maxHp, u.block);
    }
    await wait(140);
  }
  async function dieAnim(uid) {
    const el = foeEl(uid);
    if (!el) return;
    const orb = el.querySelector('.orb');
    const [x, y] = center(orb);
    const w = orb.getBoundingClientRect().width;
    SFX.death(0);
    stage.flash(orb, 1);
    stage.burst(x, y, { n: 50, colors: stage.colors(orb.dataset.planet), speed: 110, life: 0.9, size: 2, spread: w * 0.3 });
    stage.ring(x, y, w * 0.3, { n: 28, colors: [[255, 255, 255]], speed: 90, life: 0.4 });
    await stage.reveal(orb, 1, 0, 320);
    el.classList.add('gone');
    await wait(200);
    el.remove();
  }
  async function discardAnim() {
    const cards = [...$('cfHand').children];
    const [dx, dy] = center($('cfDisc'));
    await Promise.all(cards.map((el, i) => {
      const b = el.getBoundingClientRect();
      return el.animate([{ opacity: 1 }, { transform: `translate(${dx - b.left - b.width / 2}px, ${dy - b.top - b.height / 2}px) scale(.2) rotate(30deg)`, opacity: 0 }], { duration: 300, delay: i * 30, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    }));
    $('cfHand').innerHTML = '';
    renderBar();
  }

  // ─── Fin de combat ──────────────────────────────────────────
  async function victory() {
    const kind = run.combat.kind;
    if (kind === 'boss') { await bossWin(); return; }
    SFX.win();
    A.banner('VICTOIRE', kind === 'elite' ? 'Un astre puissant est tombé' : '', 'win');
    await wait(1200);
    const r = C.rewards(run);
    save();
    showReward(r);
  }
  function showReward(r) {
    const rel = r.relic ? `<div class="power-box" style="--c:#f6c453"><span class="power-label">VESTIGE OBTENU</span><p class="sheet-text"><b>${esc(C.RELICS[r.relic].name)}</b> : ${esc(C.RELICS[r.relic].text)}</p></div>` : '';
    A.openSheet(`<h3>VICTOIRE</h3>${rel}<h2>Choisissez une carte</h2><p class="muted">Elle rejoint votre création. Votre monde change avec elle.</p>
      <div class="cc-row">${r.cards.map((id) => cardHtml({ id, up: false }, { attrs: `data-camp="take" data-card="${id}"` })).join('')}</div>
      <div class="sheet-actions"><button class="btn" data-camp="take" data-card="">PASSER</button></div>`, { locked: true, center: true });
    A.mountEnergy($('sheet'));
  }
  async function afterReward(id) {
    const before = JSON.stringify(C.worldChannels(run));
    C.takeCard(run, id || null);
    lookWorld();
    save();
    A.closeSheet();
    // Première victoire : Vela vient voir le nouveau Créateur.
    if (A.store.get(VELA_KEY, '') !== '1') { A.store.set(VELA_KEY, '1'); await talk('vela1'); }
    if (id && JSON.stringify(C.worldChannels(run)) !== before) setTimeout(() => A.toast('Votre monde se transforme.', 2200), 900);
    await openMap();
  }

  // ─── Mystères et sanctuaires ────────────────────────────────
  async function showEvent() {
    const ev = C.EVENTS[run.event];
    if (ev.scene && !run.talked) { run.talked = true; save(); await talk(ev.scene); await A.show('cMap'); }
    run.talked = false;
    A.openSheet(`<h3>MYSTÈRE</h3><h2>${esc(ev.title)}</h2><p class="cs-story">${esc(ev.text)}</p>
      <div class="ce-choices">${ev.choices.map((ch, k) => `<button class="btn ce-choice" data-camp="choice" data-k="${k}"><b>${esc(ch.label)}</b><small>${esc(ch.text)}</small></button>`).join('')}</div>`, { locked: true, center: true });
  }
  async function resolveChoice(k) {
    const out = C.resolveEvent(run, k);
    lookWorld();
    save();
    if (out.pending === 'remove') { deckSheet('RETIREZ UNE CARTE', run.deck, 'remove'); return; }
    const lines = [];
    for (const c of out.cards) lines.push(`Nouvelle carte : <b>${esc(C.cardName(c))}</b>.`);
    if (out.relic) lines.push(`Vestige : <b>${esc(C.RELICS[out.relic].name)}</b>, ${esc(C.RELICS[out.relic].text)}`);
    for (const c of out.upgraded) lines.push(`Améliorée : <b>${esc(C.cardName(c))}</b>.`);
    lines.push(`${run.hp} / ${run.maxHp} PV.`);
    SFX.golden();
    A.openSheet(`<h3>MYSTÈRE</h3><p class="cs-story">${lines.join('<br>')}</p><div class="sheet-actions"><button class="btn primary" data-camp="tomap">CONTINUER</button></div>`, { locked: true, center: true });
  }
  function showRest() {
    const heal = Math.min(Math.round(run.maxHp * 0.3), run.maxHp - run.hp);
    A.openSheet(`<h3>SANCTUAIRE</h3><h2>Le silence</h2><p class="cs-story">Votre monde tourne doucement sur lui-même. Ici, rien ne vous menace.</p>
      <div class="ce-choices">
        <button class="btn ce-choice" data-camp="rest" data-k="repos"><b>Se reposer</b><small>Soignez ${heal} PV (${run.hp} / ${run.maxHp}).</small></button>
        <button class="btn ce-choice" data-camp="rest" data-k="faconner" ${C.upgradable(run).length ? '' : 'disabled'}><b>Façonner</b><small>Améliorez une carte de votre création.</small></button>
      </div>`, { locked: true, center: true });
  }

  $('sheet').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-camp]');
    if (!b || b.disabled || !run) return;
    const act = b.dataset.camp;
    if (act === 'noop') return;
    SFX.tap();
    if (act === 'resume') resume();
    else if (act === 'new') { try { localStorage.removeItem(RUN_KEY); } catch (err) { /* indisponible */ } newRun(); }
    else if (act === 'take') afterReward(b.dataset.card);
    else if (act === 'choice') resolveChoice(Number(b.dataset.k));
    else if (act === 'tomap') { A.closeSheet(); await openMap(); }
    else if (act === 'rest') {
      if (b.dataset.k === 'repos') {
        const r = C.rest(run, 'repos');
        save();
        A.closeSheet();
        SFX.buff();
        A.toast(`Votre monde se repose : +${r.heal} PV.`, 2200);
        await openMap();
      } else deckSheet('FAÇONNEZ UNE CARTE', C.upgradable(run), 'up', true);
    } else if (act === 'up') {
      const d = C.upgrade(run, b.dataset.card);
      save();
      A.closeSheet();
      SFX.golden();
      if (d) A.toast(`${C.cardName(d)} : ${C.cardText(d)}`, 3000);
      await openMap();
    } else if (act === 'remove') {
      const d = C.removeCard(run, b.dataset.card);
      lookWorld();
      save();
      A.closeSheet();
      if (d) A.toast(`${C.CARDS[d.id].name} retourne au vide.`, 2400);
      await openMap();
    }
  });
  // Le menu de reprise s'ouvre avant qu'une expédition ne soit chargée.
  $('sheet').addEventListener('click', (e) => {
    const b = e.target.closest('[data-camp]');
    if (!b || run) return;
    if (b.dataset.camp === 'resume') resume();
    else if (b.dataset.camp === 'new') { try { localStorage.removeItem(RUN_KEY); } catch (err) { /* indisponible */ } newRun(); }
  });

  // ─── Fin d'expédition ───────────────────────────────────────
  async function bossWin() {
    lookWorld();
    await wait(600);
    await openStory();
    $('csOrb').dataset.planet = 'camp-world';
    stage.setReveal($('csOrb'), 0);
    stage.reveal($('csOrb'), 0, 1, 1600);
    await tell(WIN);
    await talk('apresKronos');
    await openStory();
    $('csOrb').dataset.planet = 'camp-world';
    if (!story.skip) { storyTitle('FIN', 'DE L’ACTE I'); SFX.win(); await wait(2600); }
    await endScreen(true);
  }
  async function defeat() {
    SFX.lose();
    const o = $('cfMeOrb');
    const [x, y] = center(o);
    stage.flash(o, 1);
    stage.burst(x, y, { n: 80, colors: stage.colors('camp-world'), speed: 120, life: 1.2, size: 2 });
    await stage.reveal(o, 1, 0, 900);
    await openStory();
    await tell(LOSE);
    await endScreen(false);
  }
  async function endScreen(won) {
    const pay = C.payout(run);
    const st = stats();
    if (won) st.wins++;
    st.best = Math.max(st.best, run.floor);
    A.store.set(STATS_KEY, JSON.stringify(st));
    const r = run;
    run.over = true;
    save();
    $('ceKicker').textContent = won ? 'ACTE I · TERMINÉ' : 'EXPÉDITION TERMINÉE';
    $('ceTitle').textContent = won ? 'Kronos est tombé' : `Étage ${r.floor}`;
    $('ceText').textContent = won ? 'Ses lunes tournent désormais autour de votre monde, et la vie y est apparue. La suite de l’aventure arrive bientôt.' : 'Votre monde s’est disloqué. Chaque expédition est différente : recommencez, avec d’autres cartes et d’autres chemins.';
    $('ceStats').innerHTML = `<span><b>${r.floor}</b>étages</span><span><b>${r.stats.fights}</b>combats gagnés</span><span><b>${r.stats.elites}</b>astres puissants</span><span><b>${r.deck.length}</b>cartes</span>`;
    $('ceGain').innerHTML = `<b>+${pay.xp} XP</b>${pay.dust ? ` · ${icon('dust')} +${pay.dust}` : ''}`;
    $('cEnd').classList.toggle('won', won);
    await A.show('cEnd');
    if (!r.paid) {
      r.paid = true;
      if (pay.dust) A.addDust(pay.dust);
      await wait(700);
      await A.giveXp(pay.xp);
    }
    run = null;
  }
  $('ceAgain').addEventListener('click', () => { SFX.tap(); newRun(); });
  $('ceHome').addEventListener('click', async () => { SFX.tap(); await A.backToMenu(); });

  // ─── Tutoriel du premier combat ─────────────────────────────
  const CAMP_STEPS = [
    { id: 'ennemi', target: '.cfoe', text: 'Un astre errant. Au-dessus de lui, son <b>intention</b> : ce qu’il fera à la fin de votre tour. L’épée annonce une attaque et ses dégâts.', next: 'SUIVANT', delay: 0 },
    { id: 'energie', target: '#cfEnergy', text: 'Votre <b>énergie</b> : 3 à chaque tour. Le chiffre en haut à gauche d’une carte est son coût.', next: 'SUIVANT' },
    { id: 'jouer', target: '#cfHand', place: 'top', text: 'Votre main. <b>Touchez une carte</b>, puis <b>touchez-la de nouveau</b> pour la jouer (ou touchez l’astre à viser).', gesture: { tap: '#cfHand .ccard', at: 0.4 }, wait: ['campJouer'] },
    { id: 'bouclier', target: '#cfMe', text: 'Les cartes de <b>défense</b> donnent du <b>Bouclier</b> à votre monde : il absorbe les dégâts jusqu’à votre prochain tour.', next: 'SUIVANT' },
    { id: 'fin', target: '#cfEnd', text: 'Plus d’énergie ? <b>Terminez votre tour</b>. Les astres agissent, puis vous piochez 5 nouvelles cartes.', gesture: { tap: '#cfEnd', at: 0.5 }, wait: ['campFinTour'] },
    { id: 'suite', text: 'Chaque victoire ajoute une carte à votre création, et votre monde change avec elle. Si votre monde tombe, recommencez : chaque expédition est différente.', next: 'C’EST PARTI', delay: 2600 }
  ];

  O.campagne = { get run() { return run; }, newRun, resume, talk, C, save, has: () => !!load() };
})();
