/* ORBITE — atelier : génère une planète à chaque clic, export PNG / GIF. */
(function () {
  'use strict';

  const OP = window.OrbitePlanets;
  const LOOP_SECONDS = 24;
  const PIXEL_TARGET = { fin: 380, normal: 280, gros: 200 };
  const $ = (id) => document.getElementById(id);
  const canvas = $('scene');

  let renderer;
  try {
    renderer = new OP.Renderer(canvas, { preserve: false });
  } catch (err) {
    document.body.insertAdjacentHTML('beforeend', '<p class="toast show">WebGL2 est nécessaire pour l’atelier.</p>');
    console.error(err);
    return;
  }

  const state = {
    history: [],
    index: -1,
    type: 'random',
    facet: 'auto',
    pixel: 'normal',
    paused: false,
    time: 0,
    last: performance.now(),
    revealAt: 0,
    g: null,
    field: null,
    layout: null,
    cssPerPx: 1,
    busy: false
  };

  const typeSelect = $('typeSelect');
  typeSelect.innerHTML = '<option value="random">Aléatoire</option>' + OP.TYPES.map((t) => `<option value="${t.key}">${t.label}</option>`).join('');

  function randomSeed() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  }

  const hex = (n) => (n >>> 0).toString(16).toUpperCase().padStart(8, '0');

  function toast(text, ms) {
    const t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toast.timer);
    if (ms !== 0) toast.timer = setTimeout(() => t.classList.remove('show'), ms || 1600);
  }

  // ─── Taille du canvas : pixels entiers en pixels physiques ─────
  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.max(1, Math.round((vh * dpr) / PIXEL_TARGET[state.pixel]));
    const W = Math.ceil((vw * dpr) / scale), H = Math.ceil((vh * dpr) / scale);
    renderer.resize(W, H);
    canvas.style.width = (W * scale) / dpr + 'px';
    canvas.style.height = (H * scale) / dpr + 'px';
    state.cssPerPx = scale / dpr;
    layout();
  }

  function layout() {
    const g = state.g;
    if (!g) return;
    const W = renderer.W, H = renderer.H;
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const bottom = Math.ceil((window.innerHeight - bar.top + 8) / state.cssPerPx);
    const narrow = window.innerWidth < 640;
    const top = Math.ceil((narrow ? 150 : 24) / state.cssPerPx);
    const availH = Math.max(40, H - bottom - top), availW = W;
    const cx = Math.round(W / 2), cy = Math.round(bottom + availH / 2);
    const halfW = availW / 2, halfH = availH / 2;
    let R = Math.min(halfH * 0.5 * (0.85 + g.size * 0.25), (halfW * 0.95) / g.coreExtent.x, (halfH * 0.95) / g.coreExtent.y);
    const fit = Math.min((halfW * 0.97) / g.extent.x, (halfH * 0.97) / g.extent.y);
    R = Math.max(Math.min(R, fit), R * 0.55, 6);
    const ex = Math.ceil(g.extent.x * R) + 6, ey = Math.ceil(g.extent.y * R) + 6;
    const crop = {
      x: Math.max(0, cx - ex), y: Math.max(0, cy - ey),
      w: Math.min(W, cx + ex) - Math.max(0, cx - ex),
      h: Math.min(H, cy + ey) - Math.max(0, cy - ey)
    };
    state.layout = { cx, cy, R, crop, starCount: Math.round((W * H) / 250) };
  }

  // ─── Navigation ───────────────────────────────────────────────
  function load(entry) {
    state.g = OP.generate(entry.seed, { type: entry.type === 'random' ? null : entry.type, facet: state.facet });
    state.field = OP.makeStarfield(entry.seed, 900);
    layout();
    renderInfo();
    state.revealAt = performance.now();
    const params = new URLSearchParams({ graine: hex(entry.seed) });
    if (entry.type !== 'random') params.set('nature', entry.type);
    if (state.facet !== 'auto') params.set('rendu', state.facet);
    history.replaceState(null, '', '#' + params.toString());
  }

  function push(entry) {
    state.history = state.history.slice(0, state.index + 1);
    state.history.push(entry);
    state.index = state.history.length - 1;
    load(entry);
  }

  function generate() { push({ seed: randomSeed(), type: state.type }); }

  function step(delta) {
    const i = state.index + delta;
    if (i < 0) return;
    if (i >= state.history.length) { generate(); return; }
    state.index = i;
    load(state.history[i]);
  }

  function renderInfo() {
    const g = state.g;
    const acc = OP.accentOf(g);
    document.documentElement.style.setProperty('--accent', `rgb(${acc[0]},${acc[1]},${acc[2]})`);
    $('name').textContent = g.name;
    $('type').textContent = g.label.toUpperCase() + ' · ' + g.code.toUpperCase();
    $('desc').textContent = g.desc;
    $('stats').innerHTML = g.stats.map((s) => `<dt>${s[0]}</dt><dd>${s[1]}</dd>`).join('');
    $('seed').textContent = hex(g.seed);
  }

  // ─── Boucle ──────────────────────────────────────────────────
  function frame(now) {
    const dt = Math.min(0.1, (now - state.last) / 1000);
    state.last = now;
    if (!state.paused) state.time += dt;
    if (state.g && state.layout && !state.busy) {
      const phase = (state.time / LOOP_SECONDS) % 1;
      const reveal = Math.min(1, (now - state.revealAt) / 450);
      renderer.drawScene(state.g, state.field, state.layout, phase, reveal);
    }
    requestAnimationFrame(frame);
  }

  // ─── Exports ─────────────────────────────────────────────────
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  const fileName = (ext) => state.g.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '-' + hex(state.g.seed) + '.' + ext;

  function exportPng() {
    const c = state.layout.crop, scale = 4;
    renderer.drawScene(state.g, state.field, state.layout, (state.time / LOOP_SECONDS) % 1, 1);
    const px = renderer.readRect(c.x, c.y, c.w, c.h);
    const small = document.createElement('canvas');
    small.width = c.w; small.height = c.h;
    small.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer), c.w, c.h), 0, 0);
    const big = document.createElement('canvas');
    big.width = c.w * scale; big.height = c.h * scale;
    const ctx = big.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, big.width, big.height);
    big.toBlob((b) => { download(b, fileName('png')); toast('PNG ENREGISTRÉ'); }, 'image/png');
  }

  async function exportGif() {
    if (state.busy) return;
    state.busy = true;
    const c = state.layout.crop, frames = [], n = 150;
    try {
      for (let i = 0; i < n; i++) {
        renderer.drawScene(state.g, state.field, state.layout, i / n, 1);
        frames.push(renderer.readRect(c.x, c.y, c.w, c.h));
        if (i % 15 === 0) { toast('CAPTURE ' + Math.round((i / n) * 100) + ' %', 0); await new Promise((r) => setTimeout(r, 0)); }
      }
      const scale = Math.max(1, Math.min(3, Math.floor(480 / Math.max(c.w, c.h))));
      const blob = await OP.encodeGif(frames, c.w, c.h, { scale, delay: 8, onProgress: (p) => toast('ENCODAGE ' + Math.round(p * 100) + ' %', 0) });
      download(blob, fileName('gif'));
      toast('GIF ENREGISTRÉ');
    } catch (err) {
      console.error(err);
      toast('EXPORT IMPOSSIBLE');
    } finally {
      state.busy = false;
    }
  }

  // ─── Commandes ───────────────────────────────────────────────
  $('generate').addEventListener('click', generate);
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  typeSelect.addEventListener('change', () => { state.type = typeSelect.value; generate(); });
  $('facetSelect').addEventListener('change', (e) => { state.facet = e.target.value; if (state.index >= 0) load(state.history[state.index]); });
  $('pixelSelect').addEventListener('change', (e) => { state.pixel = e.target.value; fitCanvas(); });
  $('pause').addEventListener('click', () => { state.paused = !state.paused; $('pause').textContent = state.paused ? 'LECTURE' : 'PAUSE'; });
  $('png').addEventListener('click', exportPng);
  $('gif').addEventListener('click', exportGif);
  $('link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('LIEN COPIÉ'); }
    catch (err) { toast('LIEN DANS LA BARRE D’ADRESSE'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT') return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); generate(); }
    else if (e.code === 'ArrowLeft') step(-1);
    else if (e.code === 'ArrowRight') step(1);
    else if (e.code === 'KeyP') $('pause').click();
  });
  window.addEventListener('resize', fitCanvas);

  // ─── Démarrage : graine depuis le lien si présente ────────────
  const params = new URLSearchParams(location.hash.slice(1));
  const seedParam = parseInt(params.get('graine') || '', 16);
  const typeParam = params.get('nature');
  if (typeParam && OP.TYPE_BY_KEY[typeParam]) { state.type = typeParam; typeSelect.value = typeParam; }
  if (['on', 'off'].includes(params.get('rendu'))) { state.facet = params.get('rendu'); $('facetSelect').value = state.facet; }
  fitCanvas();
  if (Number.isFinite(seedParam)) push({ seed: seedParam >>> 0, type: state.type });
  else generate();
  requestAnimationFrame(frame);

  window.__atelier = { state, renderer, load, generate };
})();
