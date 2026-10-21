/* ORBITE — écran du Cœur (Genèse, ère II, chapitre 2). L'astre en coupe, en gros pixels : chaque
 * matière a sa couleur, la chaleur rougeoie par-dessus. Doigt posé : on chauffe à cet endroit.
 * Quand les couches sont assez rangées, on peut terminer ; le bilan prépare la suite.
 * Les règles sont dans coeur.js. */
(function () {
  'use strict';
  const O = window.__orbite, C = window.OrbiteCoeur;
  if (!O || !C) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const { esc } = A;
  const KEY = 'orbite.genese.coeur';
  const STEP = 1 / 30;
  const N = C.N;

  const ui = { c: null, raf: 0, last: 0, acc: 0, touch: null, hudAt: 0, saveAt: 0, ended: false, img: null, sfxAt: 0, from: null };

  // ─── Couleurs : quatre teintes par matière, choisies par case (grain du pixel art) ───
  const PAL = {
    1: [[120, 90, 170], [140, 106, 196], [162, 128, 214], [104, 78, 150]],
    2: [[110, 170, 225], [140, 196, 238], [180, 222, 248], [92, 150, 210]],
    3: [[112, 76, 52], [134, 92, 62], [154, 110, 74], [96, 64, 44]],
    4: [[66, 62, 70], [86, 80, 88], [108, 102, 108], [52, 48, 56]],
    5: [[150, 230, 120], [120, 210, 100], [180, 245, 150], [100, 190, 90]]
  };
  const hash = (i) => { let v = Math.imul(i ^ 0x9E3779B9, 2654435761) >>> 0; v ^= v >>> 15; return v & 3; };
  // La chaleur : rouge sombre → orange → jaune pâle.
  function heatColor(t) {
    if (t < 30) return null;
    const k = Math.min(1, (t - 30) / 80);
    return [Math.round(140 + 115 * k), Math.round(30 + 190 * k * k), Math.round(20 + 120 * k * k * k), Math.min(0.85, 0.15 + k * 0.75)];
  }

  function draw(now) {
    const c = ui.c, cv = $('coCanvas');
    if (cv.width !== N) { cv.width = N; cv.height = N; }
    const ctx = cv.getContext('2d');
    if (!ui.img) ui.img = ctx.createImageData(N, N);
    const d = ui.img.data, { inside, rel, cells } = c.geo;
    d.fill(0);
    // Lumière de l'étoile venue de la gauche : le côté droit est plus sombre.
    for (const i of cells) {
      const m = c.mat[i], x = i % N;
      let col = PAL[m] ? PAL[m][hash(i)] : [0, 0, 0];
      const shade = 1.08 - 0.32 * (x / N);
      col = col.map((v) => v * shade);
      // Grains radioactifs : ils clignotent doucement.
      if (m === C.RADIO && Math.sin(now / 200 + i) > 0.4) col = [210, 255, 180];
      const h = heatColor(c.temp[i]);
      if (h) col = col.map((v, k) => v * (1 - h[3]) + h[k] * h[3]);
      // Croûte percée par une éruption : bord sombre zébré de lave.
      if (c.erupted[i]) col = (hash(i + Math.floor(now / 300)) === 0) ? [255, 150, 60] : [60, 34, 28];
      const p = i * 4;
      d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
    }
    ctx.putImageData(ui.img, 0, 0);
    // Atmosphère : un halo violet si du gaz affleure ; vapeur et gaz qui s'échappent : quelques pixels.
    const res = ui.res || C.result(c);
    if (res.atmo > 0.3) {
      ctx.fillStyle = `rgba(170,140,230,${Math.min(0.35, res.atmo * 0.35)})`;
      for (const i of cells) if (c.geo.surface[i]) {
        const x = i % N, y = Math.floor(i / N), cx = (N - 1) / 2;
        const a = Math.atan2(y - cx, x - cx);
        ctx.fillRect(Math.round(x + Math.cos(a)), Math.round(y + Math.sin(a)), 1, 1);
      }
    }
    // Le pinceau de chaleur.
    if (ui.touch && ui.touch.g) {
      ctx.fillStyle = c.energy > 0 ? 'rgba(255,220,150,0.9)' : 'rgba(160,160,160,0.6)';
      const n = 20;
      for (let k = 0; k < n; k += 2) { const a = k / n * Math.PI * 2 + now / 400; ctx.fillRect(Math.round(ui.touch.g.x + Math.cos(a) * C.BRUSH), Math.round(ui.touch.g.y + Math.sin(a) * C.BRUSH), 1, 1); }
    }
  }

  // ─── Boucle ─────────────────────────────────────────────────
  function frame(now) {
    if (!$('coeur').classList.contains('active')) { ui.raf = 0; return; }
    ui.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - (ui.last || now)) / 1000);
    ui.last = now;
    const c = ui.c;
    if (!document.hidden && !c.done && !ui.ended) {
      ui.acc += dt;
      let n = 0;
      while (ui.acc >= STEP && n++ < 4) {
        ui.acc -= STEP;
        const g = ui.touch && ui.touch.g;
        C.step(c, STEP, g ? { heat: true, x: g.x, y: g.y } : {});
        handle(c.events.splice(0));
      }
      if (now - ui.saveAt > 5000) { ui.saveAt = now; save(); }
      if (C.cooled(c)) finish(true);
    }
    draw(now);
    if (now - ui.hudAt > 250) { ui.hudAt = now; ui.res = C.result(c); hud(); }
  }
  function handle(events) {
    const now = performance.now();
    for (const e of events) {
      if (e.t === 'eruption') {
        if (now - ui.sfxAt > 250) { ui.sfxAt = now; SFX.debris(); }
        if (A.vibrate) A.vibrate(20);
        hint('eruption');
      } else if (e.t === 'steam') {
        hint('steam');
      } else if (e.t === 'escape') {
        hint('escape');
      }
    }
  }
  const pct = (v) => Math.round(v * 100) + ' %';
  function hud() {
    const c = ui.c, r = ui.res;
    $('coScore').style.width = (r.score * 100).toFixed(1) + '%';
    $('coScore').classList.toggle('ok', C.canFinish(c));
    $('coEnergy').style.width = (c.energy / C.ENERGY * 100).toFixed(1) + '%';
    $('coScoreTxt').textContent = tr('Couches rangées : {n}', { n: pct(r.score) });
    $('coStats').innerHTML = [
      ['fer', tr('Noyau'), pct(r.core)],
      ['glace', tr('Eau en surface'), pct(r.ocean)],
      ['gaz', tr('Air en surface'), pct(r.atmo)],
      ['lave', tr('Éruptions'), String(r.eruptions)]
    ].map(([k, n, v]) => `<span class="co-chip ${k}"><i></i>${esc(n)}<b>${esc(v)}</b></span>`).join('');
    const btn = $('coDone');
    btn.disabled = !C.canFinish(c);
    btn.textContent = C.canFinish(c) ? tr('LAISSER REFROIDIR') : tr('RANGEZ LES COUCHES · {n}', { n: pct(C.SCORE_END) });
  }
  const HINTS = {
    start: 'Gardez le doigt sur l’astre pour le chauffer. Ce qui fond se range : le fer coule au centre, la glace et le gaz remontent.',
    eruption: 'Trop chaud près du bord : la roche fondue perce la croûte. Votre monde sera volcanique.',
    steam: 'La glace de surface bout : votre air y gagne, vos futurs océans y perdent.',
    escape: 'Le gaz s’échappe dans l’espace : chauffez plutôt le cœur.'
  };
  function hint(k) {
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(KEY + '.aide') || '{}'); } catch (err) { /* illisible */ }
    if (seen[k]) return;
    seen[k] = 1;
    try { localStorage.setItem(KEY + '.aide', JSON.stringify(seen)); } catch (err) { /* stockage indisponible */ }
    const el = $('coHint');
    el.textContent = tr(HINTS[k]);
    el.classList.add('show');
    clearTimeout(hint.t);
    hint.t = setTimeout(() => el.classList.remove('show'), 5600);
  }

  // ─── Bilan et fin du chapitre ───────────────────────────────
  const FIELD = { fort: 'Grand noyau de fer : un champ magnétique fort protégera votre air.', faible: 'Noyau de fer modeste : un champ magnétique faible.', aucun: 'Le fer est resté dispersé : aucun champ magnétique.' };
  const CRUST = { solide: 'Croûte solide : un sol stable où bâtir.', volcanique: 'Croûte percée : un monde de volcans et de lave.' };
  const WATER = { oceans: 'L’eau est remontée : des océans pourront naître.', 'glace profonde': 'L’eau est restée prisonnière des profondeurs.', sec: 'Presque pas d’eau : un monde sec.' };
  const AIR = { primitive: 'Le gaz forme une atmosphère primitive.', aucune: 'Aucune atmosphère pour l’instant.' };
  async function finish(auto) {
    if (ui.ended) return;
    ui.ended = true;
    const c = ui.c, r = C.result(c);
    c.done = true;
    c.result = r;
    save();
    SFX.win();
    // La coupe finale, en grand, avec le bilan.
    $('coBilan').innerHTML = `<h3>${auto ? tr('VOTRE ASTRE A REFROIDI') : tr('VOTRE ASTRE REFROIDIT')}</h3>
      <ul class="co-list"><li class="fer">${esc(tr(FIELD[r.field]))}</li><li class="lave">${esc(tr(CRUST[r.crustKind]))}</li><li class="glace">${esc(tr(WATER[r.water]))}</li><li class="gaz">${esc(tr(AIR[r.air]))}</li></ul>
      <button class="btn primary" id="coNext">${tr('CONTINUER')}</button>`;
    $('coBilan').hidden = false;
    $('coNext').addEventListener('click', () => outro(r), { once: true });
  }
  async function outro(r) {
    SFX.tap();
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    A.addSeeds(3);
    const R = window.OrbiteRecit;
    if (R) {
      await R.openStory();
      await R.wait(600);
      await R.tell([tr('Le fer a trouvé le centre. La roche s’est posée autour.'), r.field === 'fort' ? tr('Au cœur de votre astre, un champ magnétique s’éveille.') : tr('Votre astre a désormais des couches, un dedans et un dehors.')]);
      await R.title(tr('CHAPITRE 3'), tr('LA SCULPTURE · BIENTÔT'));
      await R.wait(2600);
    }
    A.toast(tr('+3 graines de vie'), 2200);
    await A.backToMenu();
  }

  // ─── Sauvegarde, ouverture ──────────────────────────────────
  function save() {
    if (!ui.c) return;
    const o = C.serialize(ui.c);
    if (ui.c.result) o.result = ui.c.result;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (err) { /* stockage indisponible */ }
  }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY));
      const c = C.restore(o);
      if (c && o.result) c.result = o.result;
      return c;
    } catch (err) { return null; }
  }
  async function open(c) {
    ui.c = c || load();
    if (!ui.c) return;
    ui.ended = false; ui.last = 0; ui.acc = 0; ui.touch = null; ui.res = null;
    $('coBilan').hidden = true;
    save();
    await A.show('coeur');
    stage.sky = 0;
    ui.res = C.result(ui.c);
    hud();
    cancelAnimationFrame(ui.raf);
    ui.raf = requestAnimationFrame(frame);
    setTimeout(() => hint('start'), 600);
  }
  async function leave() {
    SFX.tap();
    save();
    cancelAnimationFrame(ui.raf);
    ui.raf = 0;
    await A.backToMenu();
  }

  // ─── Commandes : le doigt chauffe là où il est ──────────────
  const cv = $('coCanvas');
  function toGrid(ev) {
    const b = cv.getBoundingClientRect();
    return { x: (ev.clientX - b.left) / b.width * N - 0.5, y: (ev.clientY - b.top) / b.height * N - 0.5 };
  }
  cv.addEventListener('pointerdown', (ev) => {
    if (ui.ended) return;
    ui.touch = { id: ev.pointerId, g: toGrid(ev) };
    if (ui.c && ui.c.energy > 0) SFX.charge();
  });
  window.addEventListener('pointermove', (ev) => { if (ui.touch && ev.pointerId === ui.touch.id) ui.touch.g = toGrid(ev); });
  const release = (ev) => { if (ui.touch && ev.pointerId === ui.touch.id) ui.touch = null; };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  document.addEventListener('visibilitychange', () => { if (document.hidden && ui.c && $('coeur').classList.contains('active')) save(); });
  $('coBack').innerHTML = A.icon('back');
  $('coBack').addEventListener('click', leave);
  $('coDone').addEventListener('click', () => { if (ui.c && C.canFinish(ui.c)) { SFX.tap(); finish(false); } });

  window.OrbiteCoeurUI = { open, leave, load, save, get state() { return ui; } };
})();
