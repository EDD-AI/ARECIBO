/* ORBITE — page Bâtisseur : génère des bâtiments de colonie en pixel art, une graine à la fois. */
(function () {
  'use strict';
  const E = window.OrbiteBuildings, R = window.OrbiteBuildingRenderer;
  const $ = (id) => document.getElementById(id);
  const THEME_NAMES = { mars: 'Mars', lune: 'Lune', glace: 'Glace', soufre: 'Soufre', volcan: 'Volcan' };
  const ACCENT_NAMES = { orange: 'Orange', rouge: 'Rouge', sarcelle: 'Sarcelle', jaune: 'Jaune', bleu: 'Bleu' };

  const state = { type: 'random', theme: 'auto', accent: 'auto', view: 0, blink: true, history: [], at: -1, cur: null, scene: null };
  const rndSeed = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');

  // Sélecteurs.
  $('typeSelect').innerHTML = '<option value="random">Au hasard</option>' + E.TYPES.map((t) => `<option value="${t.key}">${t.name}</option>`).join('');
  $('themeSelect').innerHTML = '<option value="auto">Auto</option>' + R.GROUNDS.map((k) => `<option value="${k}">${THEME_NAMES[k] || k}</option>`).join('');
  $('accentSelect').innerHTML = '<option value="auto">Auto</option>' + R.ACCENTS.map((k) => `<option value="${k}">${ACCENT_NAMES[k] || k}</option>`).join('');

  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), ms || 1800);
  }

  // Une entrée : type tiré (si « au hasard »), graine, thème et couleur dérivés de la graine.
  function entryFor(seed) {
    const pick = E.makeRng('choix:' + seed);
    const keys = E.TYPES.map((t) => t.key);
    const type = state.type === 'random' ? keys[pick.int(0, keys.length - 1)] : state.type;
    return { seed, type };
  }

  function build(entry, t) {
    const g = E.generate(entry.type, entry.seed, { theme: state.theme === 'auto' ? null : state.theme, t: t || 0 });
    const pick = E.makeRng('couleur:' + entry.seed);
    g.accent = state.accent === 'auto' ? R.ACCENTS[pick.int(0, R.ACCENTS.length - 1)] : state.accent;
    g.scene = g.key === 'colonie' ? g.model : R.withGround(g.model, entry.seed);
    return g;
  }

  function show(entry, push) {
    state.cur = build(entry);
    if (push !== false) { state.history = state.history.slice(0, state.at + 1); state.history.push(entry); state.at = state.history.length - 1; }
    const g = state.cur;
    $('name').textContent = g.name;
    $('type').textContent = (E.TYPE_BY_KEY[g.key].name + ' · ' + (THEME_NAMES[g.theme] || g.theme)).toUpperCase();
    $('desc').textContent = g.desc;
    $('stats').innerHTML = `<dt>Voxels</dt><dd>${g.stats.voxels}</dd><dt>Taille</dt><dd>${g.stats.size.join(' × ')}</dd><dt>Couleur</dt><dd>${ACCENT_NAMES[g.accent] || g.accent}</dd>`;
    $('seed').textContent = entry.seed;
    draw();
    const params = new URLSearchParams({ type: entry.type, graine: entry.seed });
    if (state.theme !== 'auto') params.set('sol', state.theme);
    history.replaceState(null, '', '#' + params);
  }

  function draw() {
    const g = state.cur;
    if (!g) return;
    const cv = $('scene');
    R.render(g.scene, { theme: g.theme, accent: g.accent, view: state.view, blink: state.blink, canvas: cv });
    // Agrandissement entier pour des pixels nets, en gardant de la place pour les commandes.
    const availW = window.innerWidth * 0.94, availH = window.innerHeight * 0.62;
    const k = Math.max(1, Math.floor(Math.min(availW / cv.width, availH / cv.height)));
    cv.style.width = cv.width * k + 'px';
    cv.style.height = cv.height * k + 'px';
    cv.style.left = Math.round((window.innerWidth - cv.width * k) / 2) + 'px';
    cv.style.top = Math.round(window.innerHeight * 0.44 - cv.height * k / 2) + 'px';
  }

  // Ciel étoilé discret derrière la scène.
  function sky() {
    const c = $('sky'), W = c.width = Math.ceil(window.innerWidth / 3), H = c.height = Math.ceil(window.innerHeight / 3);
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.7);
    gr.addColorStop(0, '#120c0a'); gr.addColorStop(1, '#000');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    const r = E.makeRng('ciel');
    for (let i = 0; i < W * H / 90; i++) { x.fillStyle = r.chance(0.15) ? '#cfd6e4' : '#5a6070'; x.fillRect(Math.floor(r.next() * W), Math.floor(r.next() * H), 1, 1); }
  }

  function generate() { show(entryFor(rndSeed())); }
  function prev() { if (state.at > 0) { state.at--; show(state.history[state.at], false); } }
  function next() { if (state.at < state.history.length - 1) { state.at++; show(state.history[state.at], false); } else generate(); }

  function gallery(open) {
    const el = $('gallery');
    el.hidden = !open;
    if (!open) return;
    el.innerHTML = '';
    for (const t of E.TYPES) {
      const entry = { seed: rndSeed(), type: t.key };
      const g = build(entry);
      const b = document.createElement('button');
      const cv = R.render(g.scene, { theme: g.theme, accent: g.accent });
      b.appendChild(cv);
      b.insertAdjacentText('beforeend', t.name.toUpperCase());
      b.addEventListener('click', () => { gallery(false); show(entry); });
      el.appendChild(b);
    }
  }

  $('generate').addEventListener('click', generate);
  $('prev').addEventListener('click', prev);
  $('next').addEventListener('click', next);
  $('rotate').addEventListener('click', () => { state.view = (state.view + 1) % 4; draw(); });
  $('galleryBtn').addEventListener('click', () => gallery($('gallery').hidden));
  $('typeSelect').addEventListener('change', (e) => { state.type = e.target.value; generate(); });
  $('themeSelect').addEventListener('change', (e) => { state.theme = e.target.value; if (state.history[state.at]) show(state.history[state.at], false); });
  $('accentSelect').addEventListener('change', (e) => { state.accent = e.target.value; if (state.history[state.at]) show(state.history[state.at], false); });
  $('png').addEventListener('click', () => {
    // Export agrandi ×4, pixels nets.
    const src = $('scene'), k = 4, out = document.createElement('canvas');
    out.width = src.width * k; out.height = src.height * k;
    const x = out.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, out.width, out.height);
    const a = document.createElement('a');
    a.download = `orbite-${state.cur.key}-${state.cur.seed}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  });
  $('link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Lien copié'); } catch (e) { toast(location.href, 4000); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === ' ' || e.key === 'Enter') generate();
    else if (e.key === 'r' || e.key === 'R') { state.view = (state.view + 1) % 4; draw(); }
  });
  window.addEventListener('resize', () => { sky(); draw(); });
  // Animation : pales, parabole, forage, fumées (boucle de 3 s) ; les balises clignotent.
  const ANIMATED = new Set(['eolienne', 'antenne', 'forage', 'usine', 'reacteur', 'fusee', 'piste', 'tour', 'colonie']);
  let last = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const g = state.cur;
    if (!g || state.paused) return;
    const every = g.key === 'colonie' ? 160 : 100;
    if (now - last < every) return;
    last = now;
    const blink = now % 1300 < 650;
    if (ANIMATED.has(g.key)) {
      const entry = state.history[state.at];
      const next = build(entry, (now / 3000) % 1);
      next.accent = g.accent;
      state.cur = next;
      state.blink = blink;
      draw();
    } else if (blink !== state.blink) { state.blink = blink; draw(); }
  }
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => { state.paused = document.hidden; });

  sky();
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('sol')) { state.theme = params.get('sol'); $('themeSelect').value = state.theme; }
  if (params.get('type') && E.TYPE_BY_KEY[params.get('type')]) { state.type = params.get('type'); $('typeSelect').value = state.type; }
  show({ seed: params.get('graine') || rndSeed(), type: state.type === 'random' ? entryFor(rndSeed()).type : state.type });
  window.__batisseur = { state, show, build };
})();
