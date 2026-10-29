/* ORBITE — missions du jour (v91) : chaque jour, trois missions (une facile, une moyenne, une
 * difficile) récompensées en poussières d'étoiles. Elles avancent à la fin de chaque partie
 * terminée (un abandon ne compte pas) et se récupèrent au menu. Une mission peut être changée une
 * fois par jour. Tirage propre à chaque joueur (jour + tag), nouvelles missions à minuit.
 * Le cœur (tirage, progression) est pur et testé sous Node (tests/missions.test.mjs). */
(function (root) {
  'use strict';
  const tr = (typeof window !== 'undefined' && window.tr) || ((s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s));

  // kind « sum » : on additionne ce que rapporte chaque partie ; « max » : le meilleur d'une partie.
  const LIST = [
    { id: 'jouer', tier: 0, n: 3, r: 40, kind: 'sum', text: 'Jouer {n} parties.' },
    { id: 'vendre', tier: 0, n: 8, r: 40, kind: 'sum', text: 'Vendre {n} astres.' },
    { id: 'actualiser', tier: 0, n: 10, r: 40, kind: 'sum', text: 'Actualiser la Création {n} fois.' },
    { id: 'combats', tier: 0, n: 8, r: 50, kind: 'sum', text: 'Gagner {n} combats.' },
    { id: 'dores', tier: 1, n: 2, r: 60, kind: 'sum', text: 'Faire {n} astres dorés.' },
    { id: 'famille', tier: 1, n: 4, r: 70, kind: 'max', text: 'Finir une partie avec {n} astres {fam} dans votre système.' },
    { id: 'niveau', tier: 1, n: 5, r: 60, kind: 'max', text: 'Monter la Création au niveau {n} dans une partie.' },
    { id: 'degats', tier: 1, n: 40, r: 60, kind: 'sum', text: 'Infliger {n} dégâts à vos rivaux.' },
    { id: 'gagner', tier: 2, n: 2, r: 90, kind: 'sum', text: 'Gagner {n} duels.' },
    { id: 'podium', tier: 2, n: 1, r: 80, kind: 'sum', text: 'Finir sur le podium d’une mêlée.' },
    { id: 'dorevic', tier: 2, n: 2, r: 100, kind: 'max', text: 'Gagner une partie avec {n} astres dorés dans votre système.' }
  ];
  const BY_ID = Object.fromEntries(LIST.map((m) => [m.id, m]));
  const FAMS = ['vie', 'cristal', 'lune', 'tempete', 'glace', 'mineral', 'neant', 'brasier', 'machine', 'comete', 'envers', 'anomalie'];

  // Tirage déterministe : le même jour, le même joueur retrouve les mêmes missions.
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const make = (m, rnd) => Object.assign({ id: m.id, n: m.n, r: m.r, p: 0, claimed: false }, m.id === 'famille' ? { fam: FAMS[Math.floor(rnd() * FAMS.length)] } : {});
  function generate(day, tag) {
    const rnd = rng(hash(day + '|' + (tag || '')));
    return [0, 1, 2].map((t) => { const pool = LIST.filter((m) => m.tier === t); return make(pool[Math.floor(rnd() * pool.length)], rnd); });
  }
  // Une autre mission du même niveau, différente de celles déjà proposées.
  function swap(list, i, day, tag) {
    const cur = list[i], tier = BY_ID[cur.id].tier;
    const rnd = rng(hash(day + '|swap|' + (tag || '')));
    const pool = LIST.filter((m) => m.tier === tier && !list.some((x) => x.id === m.id));
    if (!pool.length) return null;
    return make(pool[Math.floor(rnd() * pool.length)], rnd);
  }

  // Ce qu'une partie terminée apporte à chaque mission. f : faits de fin de partie.
  function gain(m, f) {
    if (f.quit) return 0;
    switch (m.id) {
      case 'jouer': return 1;
      case 'vendre': return f.sold;
      case 'actualiser': return f.rolls;
      case 'combats': return f.fights;
      case 'dores': return f.goldens;
      case 'famille': return f.famCount[m.fam] || 0;
      case 'niveau': return f.tier;
      case 'degats': return f.damage;
      case 'gagner': return f.duel && f.win ? 1 : 0;
      case 'podium': return !f.duel && f.rank <= 3 ? 1 : 0;
      case 'dorevic': return f.win ? f.goldenBoard : 0;
      default: return 0;
    }
  }
  // Fait avancer les missions ; rend celles qui viennent d'être accomplies.
  function advance(list, f) {
    const done = [];
    for (const m of list) {
      if (m.claimed || m.p >= m.n) continue;
      const g = Math.max(0, gain(m, f) | 0);
      m.p = Math.min(m.n, BY_ID[m.id].kind === 'max' ? Math.max(m.p, g) : m.p + g);
      if (m.p >= m.n) done.push(m);
    }
    return done;
  }
  // Les faits d'une partie, tirés de l'état final (R : moteur de règles).
  function factsOf(R, s, rank, quit) {
    const p = s.players[0];
    const board = p.board || [];
    const famCount = {};
    for (const u of board) { const fam = R.famOf(u); famCount[fam] = (famCount[fam] || 0) + 1; }
    const me = s.mp ? s.mp.me : 'you';
    let damage = 0;
    for (const h of s.history || []) for (const r of h.results || []) if ((r.a === me && r.winner === 0) || (r.b === me && r.winner === 1)) damage += r.damage || 0;
    return {
      quit: !!quit, rank, duel: R.isDuel(s), win: !quit && rank === 1,
      sold: s.qSold || 0, rolls: s.qRolls || 0, fights: s.fightsWon || 0, goldens: s.goldens || 0,
      famCount, tier: p.tier || 1, damage, goldenBoard: board.filter((u) => u.golden).length
    };
  }
  const textOf = (m, famName) => tr(BY_ID[m.id].text, { n: m.n, fam: famName || '' });

  const core = { LIST, BY_ID, FAMS, generate, swap, advance, gain, factsOf, textOf, hash };
  root.OrbiteMissions = core;
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  // ─── Dans le jeu ────────────────────────────────────────────
  const O = window.__orbite;
  if (!O || !O.api) return;
  const A = O.api, R = O.rules, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const KEY = 'orbite.missions';
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const tag = () => A.store.get('orbite.tag', '') || 'x';
  function load() {
    let st = null;
    try { st = JSON.parse(A.store.get(KEY, 'null')); } catch (err) { st = null; }
    const day = today();
    if (!st || st.day !== day || !Array.isArray(st.list) || st.list.length !== 3 || st.list.some((m) => !BY_ID[m.id])) {
      st = { day, list: generate(day, tag()), swapped: false };
      save(st);
    }
    return st;
  }
  function save(st) { A.store.set(KEY, JSON.stringify(st)); }
  const famName = (m) => (m.fam && R.FAMILIES[m.fam] ? R.FAMILIES[m.fam].name : '');
  const claimable = (st) => st.list.filter((m) => m.p >= m.n && !m.claimed);

  function untilMidnight() {
    const d = new Date(), m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const min = Math.max(1, Math.round((m - d) / 60000));
    return Math.floor(min / 60) ? tr('{h} h {m} min', { h: Math.floor(min / 60), m: min % 60 }) : tr('{m} min', { m: min });
  }
  // Les trois missions : texte, barre, récompense (ou RÉCUPÉRER), et « Changer » une fois par jour.
  function rowsHtml(st) {
    return st.list.map((m, i) => {
      const done = m.p >= m.n;
      const act = m.claimed ? `<span class="mi-got">${tr('REÇU')}</span>`
        : done ? `<button class="btn primary" data-mi="claim" data-i="${i}">${tr('RÉCUPÉRER')} · ${A.icon('dust')} ${m.r}</button>`
          : `<span class="mi-reward">${A.icon('dust')} ${m.r}</span>`;
      const sw = !st.swapped && !done && !m.claimed ? `<button class="link mi-swap" data-mi="swap" data-i="${i}">${tr('Changer')}</button>` : '';
      return `<div class="mi-row ${done ? 'done' : ''} ${m.claimed ? 'claimed' : ''}" style="--t:${['var(--good)', 'var(--energy)', 'var(--gold)'][BY_ID[m.id].tier]}">
        <span class="mi-txt"><b>${A.esc(textOf(m, famName(m)))}</b>
          <span class="mi-bar"><i style="width:${Math.round(m.p / m.n * 100)}%"></i></span>
          <small>${m.p} / ${m.n}${sw ? ' · ' + sw : ''}</small></span>
        <span class="mi-act">${act}</span></div>`;
    }).join('');
  }
  const head = () => `<b>${tr('MISSIONS DU JOUR')}</b><small class="mi-clock">${untilMidnight()}</small>`;
  // En haut à gauche du menu : un petit encart sur téléphone (il ouvre la feuille), les missions
  // dépliées en permanence sur PC.
  const deskMode = () => document.body.classList.contains('desk');
  function renderBox() {
    const b = $('missionsBox');
    if (!b) return;
    const st = load();
    const ready = claimable(st).length, done = st.list.filter((m) => m.claimed).length;
    const open = deskMode();
    b.classList.toggle('open', open);
    b.classList.toggle('mi-ready', ready > 0);
    b.innerHTML = open ? `<div class="mb-head">${head()}</div><div class="mi-list">${rowsHtml(st)}</div>`
      : `<b>${tr('MISSIONS')}</b><small>${done} / 3</small>`;
  }
  const sheetHtml = () => `<h3 class="mi-sheet-head">${head()}</h3><div class="mi-list">${rowsHtml(load())}</div>
      <div class="sheet-actions"><button class="btn" data-act="close">${tr('FERMER')}</button></div>`;
  const sheetOpen = () => !$('overlay').hidden && !!document.querySelector('#sheet .mi-list');
  function open() { A.openSheet(sheetHtml()); }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mi]');
    if (!b) return;
    const st = load(), i = Number(b.dataset.i), m = st.list[i];
    if (!m) return;
    if (b.dataset.mi === 'claim') {
      if (m.claimed || m.p < m.n) return;
      m.claimed = true;
      save(st);
      A.addDust(m.r);
      SFX.golden();
      const r = b.getBoundingClientRect();
      O.stage.burst(r.left + r.width / 2, r.top + r.height / 2, { n: 40, colors: [[246, 196, 83], [255, 255, 255]], speed: 90, life: 0.8 });
      A.toast(tr('+{n} poussières d’étoiles', { n: m.r }), 2000);
    } else if (b.dataset.mi === 'swap') {
      if (st.swapped || m.p >= m.n) return;
      const nm = swap(st.list, i, st.day, tag());
      if (!nm) return;
      st.list[i] = nm;
      st.swapped = true;
      save(st);
      SFX.tap();
    }
    if (sheetOpen()) A.openSheet(sheetHtml());
    renderBox();
    const md = $('menuDust');
    if (md) md.innerHTML = A.icon('dust') + ' ' + A.dust();
  });
  const box = $('missionsBox');
  if (box) box.addEventListener('click', (e) => { if (deskMode() || e.target.closest('[data-mi]')) return; SFX.tap(); open(); });
  window.addEventListener('resize', () => setTimeout(renderBox, 50));

  // Fin de partie (appelé par recordGame) : les missions avancent, une annonce par mission accomplie.
  function record(s, rank, quit) {
    const st = load();
    const done = advance(st.list, factsOf(R, s, rank, quit));
    save(st);
    done.forEach((m, k) => setTimeout(() => A.toast(tr('Mission accomplie : {t} Récompense au menu.', { t: textOf(m, famName(m)) }), 3600), 2600 + k * 3800));
    renderBox();
  }

  Object.assign(root.OrbiteMissions, { renderBox, open, record, load });
  renderBox();
})(typeof window !== 'undefined' ? window : globalThis);
