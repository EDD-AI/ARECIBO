/* ORBITE — Mon système (v119), l'interface : l'onglet MON SYSTÈME du Marché stellaire (acheter puis
 * améliorer la Lune, Neptune et le Soleil, avec le système qui tourne en grand) et la visite, en lecture
 * seule, du système d'un autre Créateur (écran #system, ouvert depuis ses amis ou le classement).
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
  const OWN = { world: 'world-mini', lune: 'sy-lune', neptune: 'sy-neptune', soleil: 'sy-soleil' };
  const VIS = { world: 'vis-world', lune: 'vis-lune', neptune: 'vis-neptune', soleil: 'vis-soleil' };
  function registerBodies(ids, st) {
    for (const b of S.BODIES) stage.register(ids[b.id], S.look(b.id, S.done(st, b.id)));
  }

  // ─── Le système animé ──────────────────────────────────────
  // Le Soleil au centre (ou sa place, éteinte), votre planète en orbite avec la Lune autour d'elle,
  // Neptune plus loin. Ce qui passe devant le Soleil est dessiné après lui (ordre des éléments).
  const scenes = new Map();
  let raf = 0;
  // Départ de l'horloge de chaque vue (le Marché, la visite) : à l'ouverture, les astres sont bien
  // répartis ; un achat redessine la vue sans faire sauter les astres.
  const clocks = {};
  const TILT_MIN = 0.3, TILT_MAX = 0.56;

  function bodyHtml(key, id, opts) {
    const o = opts || {};
    const tag = o.go ? 'button' : 'span';
    return `<${tag} class="sy-body sy-b-${key}" data-k="${key}" ${o.go ? `data-sy-go="${key}" aria-label="${esc(o.label || '')}"` : ''}>` +
      `<span class="orb" data-planet="${id}" ${o.dim ? `data-dim="${o.dim}"` : ''}></span>${o.cap ? `<small>${o.cap}</small>` : ''}</${tag}>`;
  }
  // box : élément vide ; ids : apparences ; st : astres achetés ; mine : vue du Marché (astres cliquables).
  function scene(box, ids, st, mine, keepTime) {
    const key = mine ? 'own' : 'visit';
    if (!keepTime || clocks[key] == null) clocks[key] = performance.now();
    const sun = S.owned(st, 'soleil'), lune = S.owned(st, 'lune'), nep = S.owned(st, 'neptune');
    const B = S.BY_ID;
    box.innerHTML = `<svg class="sy-orbits" aria-hidden="true"><ellipse class="sy-o-world"/><ellipse class="sy-o-nep ${nep ? 'on' : ''}"/></svg>
      <div class="sy-layer">
        ${bodyHtml('soleil', ids.soleil, { go: mine, label: B.soleil.name, dim: sun ? '' : '0.14', cap: sun ? '' : mine ? `${esc(B.soleil.name.toUpperCase())} · ${icon('dust')} ${B.soleil.price}` : '' })}
        ${bodyHtml('world', ids.world, {})}
        ${lune ? bodyHtml('lune', ids.lune, { go: mine, label: B.lune.name }) : ''}
        ${nep ? bodyHtml('neptune', ids.neptune, { go: mine, label: B.neptune.name }) : ''}
      </div>`;
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

  // Taille d'un élément pour que l'astre (sans ses anneaux ni ses lunes) ait le rayon r : le moteur
  // réduit l'astre pour faire tenir anneaux et lunes dans l'élément (js/stage.js, drawEl).
  function boxFor(id, r) {
    let ext = 1.12;
    try { ext = Math.max(1.12, Math.min(1.75, stage.genome(id).extent.x)); } catch (err) { /* apparence absente */ }
    return 2 * r * ext;
  }
  // Dans une petite vignette, l'astre rapetisse pour que ses anneaux et ses lunes tiennent dedans.
  function fitScale(id) {
    let ext = 1;
    try { ext = stage.genome(id).extent.x; } catch (err) { /* apparence absente */ }
    return ext > 2 ? (2 / ext).toFixed(3) : '1';
  }
  function put(el, x, y, d, z) {
    // La taille ne change qu'un peu (profondeur) : on ne la réécrit que si elle bouge vraiment.
    if (!(Math.abs((el._d || 0) - d) < 0.25)) { el._d = d; el.style.width = el.style.height = d.toFixed(1) + 'px'; }
    el.style.transform = `translate(${(x - d / 2).toFixed(1)}px, ${(y - d / 2).toFixed(1)}px)`;
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
    // Rayon de votre planète : tout le reste s'y rapporte.
    const r1 = Math.max(10, Math.min(Wd * 0.062, H * 0.09, 46));
    // Neptune (et ses anneaux) reste dans le cadre.
    const rN0 = r1 * S.size('neptune', S.done(st, 'neptune'));
    const rxN = Math.max(Wd * 0.3, Math.min(Wd * 0.44, Wd / 2 - rN0 * 1.9));
    const rxW = Math.min(Wd * 0.29, rxN * 0.66);
    const tilt = Math.max(TILT_MIN, Math.min(TILT_MAX, (H / 2 - r1 * 1.6) / rxN));
    const layer = box.querySelector('.sy-layer');
    if (!layer) return;
    const els = {};
    for (const el of layer.children) els[el.dataset.k] = el;
    // Le Soleil, au centre.
    const rs = r1 * S.size('soleil', S.done(st, 'soleil'));
    if (els.soleil) put(els.soleil, cx, cy, boxFor(sc.ids.soleil, rs), 0);
    // Votre planète et sa Lune.
    const aw = -0.6 + t * 0.26;
    const xw = cx + rxW * Math.cos(aw), yw = cy + rxW * tilt * Math.sin(aw), zw = Math.sin(aw);
    const kw = 1 + 0.1 * zw;
    if (els.world) put(els.world, xw, yw, boxFor(sc.ids.world, r1 * kw), zw);
    if (els.lune) {
      const am = t * 0.9;
      const rm = r1 * kw * 2.1;
      const rl = r1 * S.size('lune', S.done(st, 'lune')) * kw;
      const zm = Math.sin(am);
      put(els.lune, xw + rm * Math.cos(am), yw + rm * 0.42 * zm, boxFor(sc.ids.lune, rl * (1 + 0.08 * zm)), zw + 0.02 * zm);
    }
    if (els.neptune) {
      const an = 3.0 + t * 0.11;
      const zn = Math.sin(an);
      const rn = rN0 * (1 + 0.1 * zn);
      put(els.neptune, cx + rxN * Math.cos(an), cy + rxN * tilt * zn, boxFor(sc.ids.neptune, rn), zn);
    }
    // Orbites.
    const svg = box.querySelector('.sy-orbits');
    if (svg && (svg._w !== Wd || svg._h !== H)) {
      svg._w = Wd; svg._h = H;
      svg.setAttribute('viewBox', `0 0 ${Wd} ${H}`);
      const [ow, on] = svg.children;
      for (const [e, rx] of [[ow, rxW], [on, rxN]]) {
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
    box.innerHTML = `<div class="sy-hero">
        <div class="sy-view" id="syView"></div>
        <div class="sy-state">
          <span class="mk-kicker">${tr('VOTRE SYSTÈME')}</span>
          <b>${tr('{a} / {b} astres', { a: nOwned, b: S.BODIES.length })}</b>
          <div class="xp-bar"><i style="width:${Math.round(stepsDone / steps * 100)}%"></i></div>
          <small>${tr('{a} / {b} améliorations · niveau {n}', { a: upsDone, b: upsAll, n: lvl })}</small>
        </div>
      </div>
      <p class="sy-intro">${tr('Autour de votre planète, achetez la Lune, Neptune et le Soleil, puis améliorez-les. Ceux qui visitent votre système les voient.')}</p>
      <div class="sy-cards">${S.BODIES.map((b) => card(b, st, lvl, dust)).join('')}</div>`;
    scene($('syView'), OWN, st, true, keepTime === true);
  }
  function card(b, st, lvl, dust) {
    const has = S.owned(st, b.id), n = S.done(st, b.id), nx = S.next(st, b.id);
    const r = S.check(st, b.id, lvl, dust);
    let act;
    if (!has) {
      act = `<p class="sy-text">${esc(b.text)}</p>
        <div class="sy-act"><button class="btn primary" data-sy-buy="${b.id}" ${r.ok ? '' : 'disabled'}>${tr('ACHETER')} · ${icon('dust')} ${b.price}</button>
        ${r.ok ? '' : `<small class="sy-why">${esc(r.reason)}</small>`}</div>`;
    } else if (!nx) {
      act = `<p class="sy-done">${tr('Toutes ses améliorations sont faites.')}</p>`;
    } else {
      act = `<div class="sy-next"><span class="mk-kicker">${tr('PROCHAINE AMÉLIORATION')}</span>
        <b>${esc(nx.name)}</b><p>${esc(nx.text)}</p>
        <div class="mk-req"><span>${tr('NIVEAU {n}', { n: nx.lvl })}</span><span>${icon('dust')} ${nx.price}</span></div></div>
        <div class="sy-act"><button class="btn primary" data-sy-up="${b.id}" ${r.ok ? '' : 'disabled'}>${tr('AMÉLIORER')} · ${icon('dust')} ${nx.price}</button>
        ${r.ok ? '' : `<small class="sy-why">${esc(r.reason)}</small>`}</div>`;
    }
    // Feuille de route : un carré plein pour ce qui est fait, qui clignote pour la prochaine étape.
    const road = b.ups.map((u, i) => {
      const cls = has && i < n ? 'owned' : has && i === n ? 'next' : lvl < u.lvl ? 'locked' : '';
      return `<div class="mk-row ${cls}"><i class="mk-pip"></i><span>${esc(u.name)}</span><small>${has && i < n ? tr('FAIT') : `${tr('NIV. {n}', { n: u.lvl })} · ${u.price}`}</small></div>`;
    }).join('');
    return `<section class="sy-card ${has ? 'owned' : ''}" id="sy-card-${b.id}" style="--era:${b.color}">
      <div class="sy-card-head"><span class="orb sy-card-orb" data-planet="${OWN[b.id]}" data-scale="${fitScale(OWN[b.id])}" ${has ? '' : 'data-dim="0.35"'}></span>
        <div class="sy-card-title"><span class="mk-kicker">${has ? tr('{a} / {b} AMÉLIORATIONS', { a: n, b: b.ups.length }) : tr('PAS ENCORE À VOUS')}</span><b>${esc(b.name)}</b></div></div>
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
      // Les succès du Soleil et des trois astres tombent tout de suite (leurs graines aussi).
      if (window.OrbiteSucces && window.OrbiteSucces.check) { window.OrbiteSucces.check(); if (A.renderMkWallet) A.renderMkWallet(); }
    } finally {
      busy = false;
    }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sy-buy], [data-sy-up], [data-sy-go]');
    if (!b || b.disabled) return;
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
    const rows = [`<div class="sys-row">
        <span class="orb" data-planet="${VIS.world}"></span>
        <span class="sys-row-txt"><b>${tr('Sa planète')}</b><small>${esc(W.stageName(list))} · ${tr('{a} / {b} améliorations', { a: owned, b: W.UPGRADES.length })}</small></span></div>`];
    for (const b of S.BODIES) {
      if (!S.owned(st, b.id)) continue;
      const n = S.done(st, b.id);
      rows.push(`<div class="sys-row" style="--era:${b.color}">
        <span class="orb" data-planet="${VIS[b.id]}"></span>
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
