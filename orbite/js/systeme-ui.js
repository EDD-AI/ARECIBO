/* ORBITE — Mon système (v119), l'interface : l'onglet MON SYSTÈME du Marché stellaire (acheter puis
 * améliorer les astres du système solaire, avec le système qui tourne en grand) et la visite, en
 * lecture seule, du système d'un autre Créateur (écran #system, ouvert depuis ses amis ou le classement).
 * Les règles sont dans js/systeme.js ; ce fichier les affiche avec les outils du jeu (window.__orbite.api). */
(function () {
  'use strict';

  const O = window.__orbite;
  const S = window.OrbiteSysteme;
  const W = window.OrbiteWorld;
  if (!O || !O.api || !S || !W) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const { icon, esc } = A;

  function load() {
    try { return S.sanitize(JSON.parse(A.store.get(S.KEY, '{}'))); } catch (err) { return {}; }
  }
  const save = (st) => A.store.set(S.KEY, JSON.stringify(S.sanitize(st)));
  const lvlNow = () => A.levelInfo(A.xpTotal()).lvl;

  // Apparences : les vôtres (sy-*), celles du système visité (vis-*). Un astre pas encore acheté se
  // montre tel qu'il sera, éteint.
  const OWN = { world: 'world-mini' }, VIS = { world: 'vis-world' };
  for (const b of S.BODIES) { OWN[b.id] = 'sy-' + b.id; VIS[b.id] = 'vis-' + b.id; }
  function registerBodies(ids, st) {
    for (const b of S.BODIES) stage.register(ids[b.id], S.look(b.id, S.done(st, b.id)));
  }

  // ─── Le système animé ──────────────────────────────────────
  // Le Soleil au centre (ou sa place, éteinte), puis neuf orbites dans l'ordre réel : Mercure, Vénus,
  // votre planète (à la place de la Terre) et sa Lune, Mars, Jupiter, Saturne, Uranus, Neptune,
  // Pluton. Les astres achetés tournent sur leur orbite ; celle d'un astre pas encore acheté reste à
  // peine visible. Ce qui passe devant le Soleil est dessiné après lui (ordre des éléments).
  const scenes = new Map();
  let raf = 0;
  // Départ de l'horloge de chaque vue (le Marché, la visite) : à l'ouverture, les astres sont bien
  // répartis ; un achat redessine la vue sans faire sauter les astres.
  const clocks = {};
  const TILT_MIN = 0.3, TILT_MAX = 0.66;
  // Qui tourne sur chaque orbite (2 : votre planète, à la place de la Terre).
  const SLOTS = [];
  for (const b of S.BODIES) if (typeof b.orbit === 'number' && b.orbit >= 0) SLOTS[b.orbit] = b.id;
  SLOTS[2] = 'world';
  // Place que prend chaque orbite (en rayons de votre planète, anneaux et lunes compris) : l'écart
  // entre deux orbites suit la taille de leurs astres (espacement non linéaire), pour que neuf
  // orbites tiennent même sur un téléphone.
  const REACH = [0.75, 1.1, 2.5, 0.95, 2.4, 2.7, 1.8, 1.65, 1.15];
  // Vitesse (rad/s) et angle de départ de chaque orbite : les plus proches du Soleil vont plus vite.
  const SPEED = [0.5, 0.4, 0.3, 0.25, 0.19, 0.16, 0.13, 0.11, 0.095];
  const START = SLOTS.map((x, i) => -0.6 + i * 2.39);
  // Taille à l'écran (votre planète vaut 1) : les géantes un peu resserrées pour rester lisibles.
  const vsize = (id, n) => (id === 'world' ? 1 : Math.pow(S.size(id, n), 0.72));
  const SUN_MAX = vsize('soleil', S.BY_ID.soleil.ups.length);
  const RX = [SUN_MAX * 1.25 + REACH[0] + 0.5];
  for (let i = 1; i < REACH.length; i++) RX[i] = RX[i - 1] + 0.72 * (REACH[i - 1] + REACH[i]) + 0.55;
  const OUTER = RX[RX.length - 1] + REACH[REACH.length - 1];

  function bodyHtml(key, id, opts) {
    const o = opts || {};
    const tag = o.go ? 'button' : 'span';
    return `<${tag} class="sy-body sy-b-${key}" data-k="${key}" ${o.go ? `data-sy-go="${key}" aria-label="${esc(o.label || '')}"` : ''}>` +
      `<span class="orb" data-planet="${id}" data-fit="body" ${o.dim ? `data-dim="${o.dim}"` : ''}></span>` +
      `${o.cap ? `<small>${o.cap}</small>` : o.label ? `<small class="sy-name">${esc(o.label)}</small>` : ''}</${tag}>`;
  }
  // box : élément vide ; ids : apparences ; st : astres achetés ; mine : vue du Marché (astres cliquables).
  function scene(box, ids, st, mine, keepTime) {
    const key = mine ? 'own' : 'visit';
    if (!keepTime || clocks[key] == null) clocks[key] = performance.now();
    const B = S.BY_ID;
    const sun = S.owned(st, 'soleil');
    const orbits = SLOTS.map((id, i) => {
      const on = id === 'world' || S.owned(st, id);
      return `<ellipse class="${on ? 'on' : 'off'}" data-o="${i}" ${id !== 'world' && on ? `style="--oc:${B[id].color}"` : ''}/>`;
    }).join('');
    const bodies = [bodyHtml('soleil', ids.soleil, { go: mine, label: B.soleil.name, dim: sun ? '' : '0.16', cap: sun ? '' : mine ? `${esc(B.soleil.name.toUpperCase())} · ${icon('dust')} ${B.soleil.price}` : '' })];
    bodies.push(bodyHtml('world', ids.world, { go: mine, label: mine ? tr('Ma planète') : tr('Sa planète') }));
    for (const b of S.BODIES) if (b.id !== 'soleil' && S.owned(st, b.id)) bodies.push(bodyHtml(b.id, ids[b.id], { go: mine, label: b.name }));
    box.innerHTML = `<svg class="sy-orbits" aria-hidden="true">${orbits}</svg><div class="sy-layer">${bodies.join('')}</div>`;
    scenes.set(box, { ids, st, t0: clocks[key] });
    place(box, performance.now());
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    raf = 0;
    let any = false;
    for (const box of [...scenes.keys()]) {
      if (!box.isConnected) { scenes.delete(box); continue; }
      if (!box.getClientRects().length) continue;
      any = true;
      place(box, now);
    }
    if (any) raf = requestAnimationFrame(loop);
  }
  // Relance l'animation quand une vue redevient visible (changement d'onglet, d'écran).
  const wake = () => { if (!raf && scenes.size) raf = requestAnimationFrame(loop); };

  // Dans une petite vignette, l'astre rapetisse pour que ses anneaux et ses lunes tiennent dedans
  // (dans les deux sens : les anneaux d'Uranus couchée sont debout), mais il garde au moins la moitié
  // de la vignette : les lunes de Jupiter, alignées, peuvent déborder un peu sur les côtés.
  function fitScale(id) {
    let ex = 1, ey = 1;
    try { const e = stage.genome(id).extent; ex = e.x; ey = e.y; } catch (err) { /* apparence absente */ }
    const fit = Math.max(1.12, Math.min(1.75, ex));
    return Math.max(0.5 * fit, Math.min(1, (1.15 * fit) / Math.max(ex, ey))).toFixed(3);
  }
  // r : rayon de l'astre (anneaux et lunes débordent de l'élément : data-fit="body").
  function put(el, x, y, r, z) {
    const d = 2 * r;
    // La taille ne change qu'un peu (profondeur) : on ne la réécrit que si elle bouge vraiment.
    if (!(Math.abs((el._d || 0) - d) < 0.25)) { el._d = d; el.style.width = el.style.height = d.toFixed(1) + 'px'; }
    el.style.transform = `translate(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px)`;
    el._z = z;
  }
  function place(box, now) {
    const sc = scenes.get(box);
    if (!sc) return;
    const Wd = box.clientWidth, H = box.clientHeight;
    if (Wd < 10 || H < 10) return;
    const t = (now - sc.t0) / 1000;
    const cx = Wd / 2, cy = H / 2;
    const st = sc.st;
    // Rayon de votre planète (u) : tout le reste s'y rapporte ; le système tient en largeur et en hauteur.
    const padY = REACH[8] + 0.9;
    const u = Math.max(3, Math.min((Wd / 2 - 4) / OUTER, (H / 2 - 6) / (RX[8] * TILT_MIN + padY), 24));
    const tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, (H / 2 - 6 - padY * u) / (RX[8] * u)));
    const layer = box.querySelector('.sy-layer');
    if (!layer) return;
    const els = {};
    for (const el of layer.children) els[el.dataset.k] = el;
    // Le Soleil, au centre.
    if (els.soleil) put(els.soleil, cx, cy, u * vsize('soleil', S.done(st, 'soleil')), 0);
    // Les planètes sur leurs orbites.
    let wx = cx, wy = cy, wz = 0, wk = 1;
    SLOTS.forEach((id, i) => {
      const el = els[id];
      if (!el) return;
      const a = START[i] + t * SPEED[i];
      const z = Math.sin(a), k = 1 + 0.1 * z;
      const x = cx + RX[i] * u * Math.cos(a), y = cy + RX[i] * u * tilt * z;
      put(el, x, y, u * vsize(id, S.done(st, id)) * k, z);
      if (id === 'world') { wx = x; wy = y; wz = z; wk = k; }
    });
    // La Lune, autour de votre planète.
    if (els.lune) {
      const am = t * 0.9;
      const rm = u * wk * 2.1;
      const zm = Math.sin(am);
      put(els.lune, wx + rm * Math.cos(am), wy + rm * 0.42 * zm, u * vsize('lune', S.done(st, 'lune')) * wk * (1 + 0.08 * zm), wz + 0.02 * zm);
    }
    // Orbites.
    const svg = box.querySelector('.sy-orbits');
    if (svg && (svg._w !== Wd || svg._h !== H)) {
      svg._w = Wd; svg._h = H;
      svg.setAttribute('viewBox', `0 0 ${Wd} ${H}`);
      for (const e of svg.children) {
        const rx = RX[+e.dataset.o] * u;
        e.setAttribute('cx', cx); e.setAttribute('cy', cy);
        e.setAttribute('rx', rx.toFixed(1)); e.setAttribute('ry', (rx * tilt).toFixed(1));
      }
    }
    // Profondeur : derrière le Soleil d'abord, devant ensuite (le moteur dessine dans l'ordre du DOM).
    const kids = [...layer.children];
    const sorted = kids.slice().sort((a, b) => (a._z || 0) - (b._z || 0));
    if (sorted.some((el, i) => el !== kids[i])) for (const el of sorted) layer.appendChild(el);
  }

  // ─── Onglet MON SYSTÈME du Marché stellaire ────────────────
  let busy = false;
  function render(keepTime) {
    const box = $('syShop');
    if (!box) return;
    const st = load(), lvl = lvlNow(), dust = A.dust();
    registerBodies(OWN, st);
    const nOwned = S.count(st);
    const upsDone = S.BODIES.reduce((s, b) => s + S.done(st, b.id), 0);
    const upsAll = S.BODIES.reduce((s, b) => s + b.ups.length, 0);
    const steps = S.BODIES.length + upsAll, stepsDone = nOwned + upsDone;
    // Les cartes dans l'ordre du système ; votre planète prend la place de la Terre, entre Vénus et la Lune.
    const cards = [];
    for (const b of S.BODIES) {
      if (b.id === 'lune') cards.push(earthCard());
      cards.push(card(b, st, lvl, dust));
    }
    box.innerHTML = `<div class="sy-hero">
        <div class="sy-view" id="syView"></div>
        <div class="sy-state">
          <span class="mk-kicker">${tr('VOTRE SYSTÈME')}</span>
          <b>${tr('{a} / {b} astres', { a: nOwned, b: S.BODIES.length })}</b>
          <div class="xp-bar"><i style="width:${Math.round(stepsDone / steps * 100)}%"></i></div>
          <small>${tr('{a} / {b} améliorations · niveau {n}', { a: upsDone, b: upsAll, n: lvl })}</small>
        </div>
      </div>
      <p class="sy-intro">${tr('Achetez les astres du système solaire, du Soleil rouge à Pluton, puis améliorez-les. Votre planète prend la place de la Terre. Ceux qui visitent votre système les voient.')}</p>
      <div class="sy-cards">${cards.join('')}</div>`;
    scene($('syView'), OWN, st, true, keepTime === true);
  }
  // Votre planète, à la place de la Terre : ses améliorations sont dans l'onglet MA PLANÈTE.
  function earthCard() {
    const list = A.worldList ? A.worldList() : [];
    return `<section class="sy-card sy-earth owned" id="sy-card-world" style="--era:#7fd6a0">
      <div class="sy-card-head"><span class="orb sy-card-orb" data-planet="${OWN.world}" data-scale="${fitScale(OWN.world)}"></span>
        <div class="sy-card-title"><span class="mk-kicker">${tr('À LA PLACE DE LA TERRE')}</span><b>${tr('Ma planète')}</b>
          <small class="sy-text">${tr('{a} / {b} améliorations', { a: W.owned(list).length, b: W.UPGRADES.length })}</small></div></div>
      <div class="sy-act"><button class="btn" data-sy-tab="planete">${tr('VOIR MA PLANÈTE')}</button></div></section>`;
  }
  function card(b, st, lvl, dust) {
    const has = S.owned(st, b.id), n = S.done(st, b.id), nx = S.next(st, b.id);
    const r = S.check(st, b.id, lvl, dust);
    const head = (kicker, extra) => `<div class="sy-card-head"><span class="orb sy-card-orb" data-planet="${OWN[b.id]}" data-scale="${fitScale(OWN[b.id])}" ${has ? '' : 'data-dim="0.4"'}></span>
        <div class="sy-card-title"><span class="mk-kicker">${kicker}</span><b>${esc(b.name)}</b>${extra || ''}</div></div>`;
    const why = r.ok ? '' : `<small class="sy-why">${esc(r.reason)}</small>`;
    // Pas encore acheté : une carte courte (l'astre, une phrase, le prix).
    if (!has) {
      return `<section class="sy-card sy-off" id="sy-card-${b.id}" style="--era:${b.color}">
        ${head(tr('{n} AMÉLIORATIONS', { n: b.ups.length }), `<small class="sy-text">${esc(b.text)}</small>`)}
        <div class="sy-act"><button class="btn primary" data-sy-buy="${b.id}" ${r.ok ? '' : 'disabled'}>${tr('ACHETER')} · ${icon('dust')} ${b.price}</button>${why}</div></section>`;
    }
    let act;
    if (!nx) act = `<p class="sy-done">${tr('Toutes ses améliorations sont faites.')}</p>`;
    else {
      act = `<div class="sy-next"><span class="mk-kicker">${tr('PROCHAINE AMÉLIORATION')}</span>
        <b>${esc(nx.name)}</b><p>${esc(nx.text)}</p>
        <div class="mk-req"><span>${tr('NIVEAU {n}', { n: nx.lvl })}</span><span>${icon('dust')} ${nx.price}</span></div></div>
        <div class="sy-act"><button class="btn primary" data-sy-up="${b.id}" ${r.ok ? '' : 'disabled'}>${tr('AMÉLIORER')} · ${icon('dust')} ${nx.price}</button>${why}</div>`;
    }
    // Feuille de route en pastilles : pleine si c'est fait, qui clignote pour la suivante, le niveau sinon.
    const road = b.ups.map((u, i) => {
      const cls = i < n ? 'owned' : i === n ? 'next' : lvl < u.lvl ? 'locked' : '';
      return `<span class="sy-chip ${cls}"><i class="mk-pip"></i>${esc(u.name)}${i < n ? '' : `<small>${tr('NIV. {n}', { n: u.lvl })}</small>`}</span>`;
    }).join('');
    return `<section class="sy-card owned" id="sy-card-${b.id}" style="--era:${b.color}">
      ${head(tr('{a} / {b} AMÉLIORATIONS', { a: n, b: b.ups.length }))}
      ${act}
      <div class="sy-road">${road}</div></section>`;
  }

  async function buy(id) {
    if (busy) return;
    const st = load(), lvl = lvlNow(), dust = A.dust();
    const r = S.check(st, id, lvl, dust);
    if (!r.ok) { A.refuse(r.reason); return; }
    busy = true;
    try {
      A.addDust(-r.cost);
      S.apply(st, id, lvl, dust);
      save(st);
      if (A.renderMkWallet) A.renderMkWallet();
      // Même éclat que pour votre planète : charge, flash, puis l'astre nouveau.
      const card = $('sy-card-' + id);
      const orb = card && card.querySelector('.sy-card-orb');
      const b = S.BY_ID[id];
      if (orb) {
        const [x, y] = A.center(orb);
        const R = orb.getBoundingClientRect().width / 2;
        SFX.charge();
        orb.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1.06)' }], { duration: 900, easing: 'ease-in' });
        await A.wait(850);
        stage.flash(orb, 1);
        registerBodies(OWN, st);
        orb.removeAttribute('data-dim');
        orb.dataset.scale = fitScale(OWN[id]);
        SFX.golden();
        stage.burst(x, y, { n: 60, colors: stage.colors(OWN[id]).concat([[255, 255, 255]]), speed: 110, life: 1, spread: R * 0.6 });
        stage.ring(x, y, R * 1.1, { n: 46, colors: [[255, 255, 255], [246, 196, 83]], speed: 80, life: 0.7 });
        orb.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
        await A.wait(250);
      }
      A.vibrate(15);
      render(true);
      if (r.kind === 'buy') A.toast(tr('{name} rejoint votre système.', { name: b.name }), 3000);
      else A.toast(tr('{name} : {text}', { name: r.up.name, text: r.up.text }), 3200);
      // Les succès du Soleil et de tous les astres tombent tout de suite (leurs graines aussi).
      if (window.OrbiteSucces && window.OrbiteSucces.check) { window.OrbiteSucces.check(); if (A.renderMkWallet) A.renderMkWallet(); }
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sy-buy], [data-sy-up], [data-sy-go], [data-sy-tab]');
    if (!b || b.disabled) return;
    if (b.dataset.syTab) {
      // Votre planète : ses améliorations sont dans l'onglet MA PLANÈTE.
      SFX.tap();
      A.marketTab(b.dataset.syTab);
      const pane = document.querySelector(`#market .mk-pane[data-pane="${b.dataset.syTab}"]`);
      if (pane) pane.scrollTop = 0;
      return;
    }
    if (b.dataset.syGo) {
      // Toucher un astre du système amène à sa carte.
      SFX.tap();
      const c = $('sy-card-' + b.dataset.syGo);
      if (c) {
        c.scrollIntoView({ behavior: 'smooth', block: 'center' });
        c.classList.remove('flash');
        void c.offsetWidth;
        c.classList.add('flash');
      }
      return;
    }
    buy(b.dataset.syBuy || b.dataset.syUp);
  });

  // ─── Visite du système d'un autre Créateur ─────────────────
  let VIEW = null;
  async function visit(profile) {
    const p = profile || {};
    const f = p.forge && typeof p.forge === 'object' ? p.forge : {};
    // Données d'un autre joueur : lues avec prudence (anciens clients sans « astres » : sa planète seule).
    const st = S.fromPublic(f.astres);
    const list = Array.isArray(p.world) ? p.world.filter((x) => typeof x === 'string').slice(0, 30) : [];
    stage.register(VIS.world, A.worldLook(list, p.tag));
    registerBodies(VIS, st);
    VIEW = { owner: String(p.pseudo || tr('Créateur')).slice(0, 16), st, list };
    await A.show('system');
    renderVisit();
  }
  function renderVisit() {
    if (!VIEW) return;
    const { owner, st, list } = VIEW;
    $('sysBack').innerHTML = icon('back');
    // Le pseudo en titre (pas de « Système de … » : l'élision dépend du nom), le système en sous-titre.
    $('sysTitle').textContent = owner;
    $('sysSub').textContent = `${tr('SON SYSTÈME')} · ${tr('{a} / {b} astres', { a: S.count(st), b: S.BODIES.length })}`;
    scene($('sysView'), VIS, st, false);
    const owned = W.owned(list).length;
    // Dans l'ordre du système : sa planète à la place de la Terre, puis ses astres achetés.
    const planet = `<div class="sys-row">
        <span class="orb" data-planet="${VIS.world}" data-scale="${fitScale(VIS.world)}"></span>
        <span class="sys-row-txt"><b>${tr('Sa planète')}</b><small>${esc(W.stageName(list))} · ${tr('{a} / {b} améliorations', { a: owned, b: W.UPGRADES.length })}</small></span></div>`;
    const rows = [];
    for (const b of S.BODIES) {
      if (b.id === 'lune') rows.push(planet);
      if (!S.owned(st, b.id)) continue;
      const n = S.done(st, b.id);
      rows.push(`<div class="sys-row" style="--era:${b.color}">
        <span class="orb" data-planet="${VIS[b.id]}" data-scale="${fitScale(VIS[b.id])}"></span>
        <span class="sys-row-txt"><b>${esc(b.name)}</b><small>${tr('{a} / {b} améliorations', { a: n, b: b.ups.length })}</small>
          ${n ? `<span class="sys-ups">${b.ups.slice(0, n).map((u) => `<i>${esc(u.name)}</i>`).join('')}</span>` : ''}</span></div>`);
    }
    if (!S.count(st)) rows.push(`<p class="muted sys-none">${tr('{nom} n’a pas encore d’astre autour de sa planète.', { nom: esc(owner) })}</p>`);
    $('sysPanel').innerHTML = `<h4 class="fg-h">${tr('SA PLANÈTE ET SES ASTRES')}</h4>` + rows.join('');
  }
  const back = $('sysBack');
  if (back) back.addEventListener('click', async () => {
    SFX.tap();
    VIEW = null;
    await A.show('profile');
    A.renderProfile();
  });

  // Un changement d'écran ou d'onglet peut rendre une vue de nouveau visible.
  document.addEventListener('click', () => setTimeout(wake, 0), true);
  window.addEventListener('resize', wake);

  O.systeme = { render, visit, load };
})();
