/* ORBITE — Forge des mondes (onglet Création du Marché stellaire).
 * Les règles sont dans js/forge.js ; ce fichier les affiche avec les outils du jeu (window.__orbite.api). */
(function () {
  'use strict';

  const O = window.__orbite;
  const F = window.OrbiteForge;
  if (!O || !O.api || !F) return;
  const A = O.api, stage = O.stage, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const { icon, esc } = A;
  const KEY = 'orbite.forge';

  function randomSeed() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] || 1;
  }
  let data = load();
  let shownSize = 0;
  function load() {
    try {
      const d = JSON.parse(A.store.get(KEY, 'null'));
      if (d && Array.isArray(d.planets)) {
        d.planets = d.planets.slice(0, F.MAX_PLANETS).map(F.sanitize);
        d.sel = Math.max(0, Math.min(d.sel | 0, d.planets.length - 1));
        d.star = F.sanitizeStar(d.star, randomSeed());
        return d;
      }
    } catch (err) { /* sauvegarde illisible */ }
    return { planets: [], sel: 0, star: F.newStar(randomSeed()) };
  }
  const save = () => A.store.set(KEY, JSON.stringify(data));
  const cur = () => data.planets[data.sel] || null;
  const lookId = (p) => 'forge-' + p.id;
  const register = (p) => stage.register(lookId(p), F.look(p));
  data.planets.forEach(register);
  const sizeOf = (p) => Math.round(250 * F.scale(p));
  const price = (n) => `${icon('dust')} ${n}`;
  // Pastilles de teinte : de vraies mini-planètes, rendues par le moteur avec chaque teinte.
  let swatchKey = '';
  function swatches(p) {
    const key = [p.type, p.seed, p.facet].join(':');
    if (key !== swatchKey) {
      swatchKey = key;
      for (const h of F.HUES) stage.register('forge-sw-' + h, Object.assign(F.look(p), { hueShift: h, ring: false, debris: false, moons: 0, shell: false, shape: 'aucune', full: false }));
    }
  }
  const dustHud = () => { $('marketDust').innerHTML = icon('dust') + ' ' + A.dust(); };

  // ─── Affichage ──────────────────────────────────────────────
  function render() {
    const box = $('forge');
    if (!box) return;
    dustHud();
    const p = cur();
    if (!p) {
      box.innerHTML = `<span class="mk-kicker">${tr('FORGE DES MONDES')}</span>
        <div class="fg-stage"><span class="orb fg-orb" data-planet="forge-graine" style="--s:90px"></span></div>
        <b class="fg-title">${tr('Votre propre monde')}</b>
        <p class="fg-intro">${tr('Semez une graine de poussière d’étoiles, nourrissez-la pour la faire grandir, puis façonnez-la comme vous le voulez : nature, teinte, anneau, lunes, silhouette… Chaque palier ouvre un emplacement de plus.')}</p>
        <button class="btn primary" data-forge="seed">${tr('SEMER UNE GRAINE · OFFERTE')}</button>`;
      return;
    }
    const dust = A.dust();
    const feed = F.check(p, { t: 'feed' }, dust);
    const full = p.mass >= F.MAX_MASS;
    const free = F.slotsFree(p);
    const pips = Array.from({ length: F.MAX_MASS }, (_, i) => `<i class="${i < F.slotsUsed(p) ? 'used' : i < p.mass ? 'open' : ''}"></i>`).join('');
    let html = `<span class="mk-kicker">${tr('FORGE DES MONDES')}</span>
      <div class="fg-stage"><span class="orb fg-orb" id="fgOrb" data-planet="${lookId(p)}" style="--s:${shownSize || sizeOf(p)}px"></span></div>
      <button class="fg-name" data-forge="rename">${esc(p.name)} <small>${tr('RENOMMER')}</small></button>
      <small class="fg-sub">${p.type ? F.NATURE[p.type].name : tr('Graine')} · ${tr('taille {n} / {max}', { n: p.mass, max: F.MAX_MASS })}</small>
      <div class="xp-bar fg-bar"><i style="width:${p.mass / F.MAX_MASS * 100}%"></i></div>
      <button class="btn primary fg-feed" data-forge="feed" ${full || !feed.ok ? 'disabled' : ''}>${full ? tr('TAILLE MAXIMALE') : tr('NOURRIR · {prix}', { prix: price(F.FEED[p.mass]) })}</button>
      ${!full && !feed.ok && feed.short ? `<small class="fg-why">${esc(feed.reason)}</small>` : ''}
      <div class="fg-slots"><span>${tr('EMPLACEMENTS')}</span><span class="fg-pips">${pips}</span><span>${free > 1 ? tr('{n} libres', { n: free }) : tr('{n} libre', { n: free })}</span></div>`;
    if (p.mass >= 1) {
      const natCost = p.type ? 6 + 2 * p.mass : 0;
      html += `<h4 class="fg-h">${tr('NATURE')} <small>${p.type ? tr('changer · {prix}', { prix: price(natCost) }) : tr('choisissez-la : offert')}</small></h4>
        <div class="fg-chips">${F.NATURES.map((n) => {
          const lock = p.mass < n.min;
          return `<button class="fg-chip ${p.type === n.key ? 'on' : ''}" data-forge="nature" data-k="${n.key}" ${lock ? 'disabled' : ''}>${esc(n.name)}${lock ? `<small>${tr('taille {n}', { n: n.min })}</small>` : ''}</button>`;
        }).join('')}</div>`;
    }
    if (p.type) {
      html += `<h4 class="fg-h">${tr('TEINTE')} <small>${price(F.HUE_COST)}</small></h4>
        <div class="fg-hues">${F.HUES.map((h) => `<button class="fg-hue ${p.hue === h ? 'on' : ''}" data-forge="hue" data-v="${h}" aria-label="${tr('Teinte {n}', { n: h })}"><span class="orb" data-planet="forge-sw-${h}"></span></button>`).join('')}</div>
        <h4 class="fg-h">${tr('AJOUTS')} <small>${tr('un emplacement chacun')}</small></h4>
        <div class="fg-parts">${F.PARTS.map((part) => partRow(p, part, dust)).join('')}</div>
        <button class="btn fg-relief" data-forge="relief">${tr('REMODELER LE RELIEF · {prix}', { prix: price(F.RELIEF_COST) })}</button>`;
    }
    html += `<h4 class="fg-h">${tr('VOTRE COLLECTION')} <small>${data.planets.length} / ${F.MAX_PLANETS}</small></h4>
      <div class="fg-coll">${data.planets.map((q, i) => `<button class="fg-thumb ${i === data.sel ? 'on' : ''}" data-forge="sel" data-i="${i}">
        <span class="orb" data-planet="${lookId(q)}"></span><small>${esc(q.name)}</small></button>`).join('')}
        ${data.planets.length < F.MAX_PLANETS ? `<button class="fg-thumb fg-new" data-forge="seed"><b>+</b><small>${tr('Graine · {prix}', { prix: price(F.seedCost(data.planets.length)) })}</small></button>` : ''}</div>
      ${F.systemOpen(data.planets)
        ? `<button class="btn primary fg-sys" data-forge="system">${data.star.lit ? tr('MON SYSTÈME') : tr('ALLUMER MON SYSTÈME')}</button>`
        : `<p class="fg-why fg-sys-lock">${tr('Mon système s’ouvrira quand un de vos mondes atteindra la taille {n} : une étoile à allumer, et vos mondes en orbite autour d’elle.', { n: F.SYSTEM_MASS })}</p>`}`;
    if (p.type) swatches(p);
    box.innerHTML = html;
    // Le monde grossit en douceur jusqu'à sa nouvelle taille.
    const orb = $('fgOrb');
    const target = sizeOf(p);
    if (orb && shownSize && shownSize !== target) requestAnimationFrame(() => requestAnimationFrame(() => orb.style.setProperty('--s', target + 'px')));
    shownSize = target;
  }

  function partRow(p, part, dust) {
    const n = part.key === 'moons' ? p.moons : 0;
    const owned = part.key === 'moons' ? p.moons > 0 : !!p[part.key];
    const label = part.key === 'moons' ? `${part.name} <small>${p.moons} / 3</small>` : part.key === 'shape' && p.shape ? `${part.name} <small>${esc(F.SHAPES.find((s) => s.key === p.shape).name)}</small>` : part.name;
    let btns = '';
    if (owned) btns += `<button class="btn ghost" data-forge="remove" data-k="${part.key}">${tr('RETIRER')}</button>`;
    const more = part.key === 'moons' ? n < part.price.length : part.key === 'shape' || !owned;
    if (more) {
      // Pour la silhouette, on teste une forme différente de l'actuelle.
      const probe = part.key === 'shape' ? { t: 'add', part: 'shape', v: F.SHAPES.find((sh) => sh.key !== p.shape).key } : { t: 'add', part: part.key };
      const r = F.check(p, probe, dust);
      const cost = part.price[Math.min(n, part.price.length - 1)];
      const word = part.key === 'shape' ? (p.shape ? tr('CHANGER') : tr('CHOISIR')) : tr('AJOUTER');
      btns += `<button class="btn primary" data-forge="${part.key === 'shape' ? 'shapes' : 'add'}" data-k="${part.key}" ${r.ok || r.short ? '' : 'disabled'}>${word} · ${price(cost)}</button>`;
      if (!r.ok && r.reason && !r.short) btns += `<small class="fg-why">${esc(r.reason)}</small>`;
    }
    return `<div class="fg-part ${owned ? 'owned' : ''}"><div class="fg-part-txt"><b>${label}</b><small>${esc(part.text)}</small></div><div class="fg-part-act">${btns}</div></div>`;
  }

  // ─── Actions ────────────────────────────────────────────────
  function burstOnOrb(colors, n) {
    const orb = $('fgOrb');
    if (!orb) return;
    const b = orb.getBoundingClientRect();
    const x = b.left + b.width / 2, y = b.top + b.height / 2;
    stage.ring(x, y, b.width * 0.42, { n: n || 40, colors, speed: 60, life: 0.7, flat: 0.5 });
    stage.burst(x, y, { n: 24, colors, speed: 70, life: 0.7 });
    stage.flash(orb, 0.7);
  }

  function act(a) {
    const p = cur();
    if (!p) return;
    const r = F.check(p, a, A.dust());
    if (!r.ok) { A.refuse(r.reason); return; }
    if (r.cost) A.addDust(-r.cost);
    const slotsBefore = F.slotsFree(p);
    F.apply(p, a);
    register(p);
    save();
    dustHud();
    render();
    A.vibrate(15);
    if (a.t === 'feed') {
      SFX.coin();
      SFX.buff(0, Math.min(7, Math.floor(p.mass / 2)));
      burstOnOrb([[246, 196, 83], [255, 255, 255]], 30);
      A.popOn($('fgOrb'), tr('TAILLE {n}', { n: p.mass }), 'gold');
      if (p.mass === 1) A.toast(tr('Votre graine prend forme : choisissez sa nature.'), 2600);
      else if (F.slotsFree(p) > slotsBefore) A.toast(tr('Un emplacement s’ouvre.'), 1600);
    } else if (a.t === 'remove') {
      SFX.tap();
    } else {
      SFX.level();
      burstOnOrb([[190, 220, 255], [255, 255, 255]], 46);
    }
  }

  function seed() {
    const cost = F.seedCost(data.planets.length);
    if (cost == null) { A.refuse(tr('Votre collection est complète.')); return; }
    if (A.dust() < cost) { A.refuse(tr('Il vous manque {n} poussières d’étoiles.', { n: cost - A.dust() })); return; }
    if (cost) A.addDust(-cost);
    const p = F.newPlanet(randomSeed(), data.planets.length);
    data.planets.push(p);
    data.sel = data.planets.length - 1;
    register(p);
    save();
    dustHud();
    shownSize = 0;
    render();
    SFX.place();
    burstOnOrb([[246, 196, 83], [255, 255, 255]], 20);
  }

  function renameSheet() {
    const p = cur();
    A.openSheet(`<h3>${tr('NOMMER VOTRE MONDE')}</h3>
      <input class="fg-input" id="fgNameIn" maxlength="18" value="${esc(p.name)}" autocomplete="off">
      <div class="sheet-actions"><button class="btn" data-act="close">${tr('ANNULER')}</button><button class="btn primary" data-forge="name-ok">${tr('VALIDER')}</button></div>`);
    setTimeout(() => { const i = $('fgNameIn'); if (i) { i.focus(); i.select(); } }, 80);
  }
  function shapesSheet() {
    const p = cur();
    const cost = F.PART.shape.price[0];
    A.openSheet(`<h3>${tr('SILHOUETTE · {prix}', { prix: price(cost) })}</h3><div class="fg-chips">${F.SHAPES.map((s) =>
      `<button class="fg-chip ${p.shape === s.key ? 'on' : ''}" data-forge="shape" data-k="${s.key}">${esc(s.name)}</button>`).join('')}</div>
      <div class="sheet-actions"><button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-forge]');
    if (!b || b.disabled) return;
    const k = b.dataset.forge;
    if (k !== 'name-ok' && k !== 'shape' && !k.startsWith('sys')) SFX.tap();
    if (k === 'seed') seed();
    else if (k === 'feed') act({ t: 'feed' });
    else if (k === 'nature') act({ t: 'nature', key: b.dataset.k });
    else if (k === 'hue') act({ t: 'hue', v: Number(b.dataset.v) });
    else if (k === 'relief') act({ t: 'relief' });
    else if (k === 'add') act({ t: 'add', part: b.dataset.k });
    else if (k === 'remove') act({ t: 'remove', part: b.dataset.k });
    else if (k === 'shapes') shapesSheet();
    else if (k === 'shape') { A.closeSheet(); act({ t: 'add', part: 'shape', v: b.dataset.k }); }
    else if (k === 'sel') { data.sel = Number(b.dataset.i); shownSize = 0; save(); render(); }
    else if (k === 'rename') renameSheet();
    else if (k === 'system') openSystem();
    else if (k.startsWith('sys')) sysAction(k, b);
    else if (k === 'name-ok') {
      const v = ($('fgNameIn').value || '').trim().slice(0, 18);
      if (v) { cur().name = v; save(); }
      A.closeSheet();
      render();
    }
  });

  // ─── Mon système ────────────────────────────────────────────
  const SYS = { raf: 0, t0: 0, phase: Object.create(null) };
  const starId = 'forge-star';
  const registerStar = () => stage.register(starId, F.starLook(data.star));
  registerStar();
  // Visite : le système d'un ami, en lecture seule (VIEW), sinon le vôtre.
  let VIEW = null;
  const src = () => VIEW || data;
  const plId = (p, i) => (VIEW ? 'visit-' + i : lookId(p));
  const curStarId = () => (VIEW ? 'visit-star' : starId);
  const starPx = () => 64 + src().star.size * 18;
  const plPx = (p) => Math.round(16 + p.mass * 2.6);
  const orbitR = (slot, W) => W * (0.2 + slot * 0.056);
  const TILT = 0.4;
  const sysDust = () => { $('sysDust').innerHTML = icon('dust') + ' ' + A.dust(); };

  async function openSystem() {
    if (!F.systemOpen(data.planets)) return;
    await A.show('system');
    renderSystem();
    loopSystem();
  }

  function renderSystem() {
    const S = src(), st = S.star;
    const starName = st.lit ? F.STAR_CLASSES.find((c) => c.key === st.cls).name : tr('étoile éteinte');
    $('sysBack').innerHTML = icon('back');
    $('sysSub').textContent = VIEW ? `${VIEW.owner} · ${starName}` : starName;
    sysDust();
    $('sysDust').hidden = !!VIEW;
    const inOrbit = S.planets.map((p, i) => ({ p, i })).filter((o) => o.p.orbit != null);
    $('sysLayer').innerHTML = `<button class="sys-star ${st.lit ? '' : 'off'}" data-forge="sysStar" style="--s:${starPx()}px"><span class="orb" data-planet="${curStarId()}" ${st.lit ? '' : 'data-dim="0.18"'}></span></button>` +
      inOrbit.map((o) => `<button class="sys-pl" data-forge="sysPlanet" data-i="${o.i}" style="--s:${plPx(o.p)}px"><span class="orb" data-planet="${plId(o.p, o.i)}"></span><small>${esc(o.p.name)}</small></button>`).join('');
    const panel = [];
    if (VIEW) {
      panel.push(`<h4 class="fg-h">${tr('MONDES DE {nom}', { nom: esc(VIEW.owner.toUpperCase()) })} <small>${tr('{n} / {max} orbites', { n: inOrbit.length, max: F.ORBITS })}</small></h4>`);
      panel.push(S.planets.map((p, i) => `<div class="sys-row sys-row-visit">
        <span class="orb" data-planet="${plId(p, i)}"></span>
        <span class="sys-row-txt"><b>${esc(p.name)}</b><small>${p.type ? `${F.NATURE[p.type].name} · ${tr('taille {n}', { n: p.mass })}` : tr('graine')} · ${p.orbit == null ? tr('hors orbite') : tr('orbite {n}', { n: p.orbit + 1 })}</small></span>
      </div>`).join('') || `<p class="muted">${tr('Aucun monde forgé pour l’instant.')}</p>`);
      $('sysPanel').innerHTML = panel.join('');
      drawOrbits();
      return;
    }
    if (!st.lit) {
      const r = F.sysCheck(data, { t: 'light' }, A.dust());
      panel.push(`<p class="sys-intro">${tr('Au centre de votre système, une étoile attend sa première lumière. Allumez-la, puis placez vos mondes en orbite autour d’elle.')}</p>
        <button class="btn primary" data-forge="sysLight" ${r.ok || r.short ? '' : 'disabled'}>${tr('ALLUMER L’ÉTOILE · {prix}', { prix: price(F.LIGHT_COST) })}</button>`);
    } else {
      panel.push(`<h4 class="fg-h">${tr('VOS MONDES')} <small>${tr('{n} / {max} orbites', { n: inOrbit.length, max: F.ORBITS })}</small></h4>`);
      panel.push(data.planets.map((p, i) => `<div class="sys-row">
        <span class="orb" data-planet="${lookId(p)}"></span>
        <span class="sys-row-txt"><b>${esc(p.name)}</b><small>${p.type ? `${F.NATURE[p.type].name} · ${tr('taille {n}', { n: p.mass })}` : tr('graine')} · ${p.orbit == null ? tr('hors orbite') : tr('orbite {n}', { n: p.orbit + 1 })}</small></span>
        ${p.type ? `<button class="btn ${p.orbit == null ? 'primary' : ''}" data-forge="sysPlace" data-i="${i}">${p.orbit == null ? tr('PLACER') : tr('DÉPLACER')}</button>` : `<small class="fg-why">${tr('à nourrir')}</small>`}
      </div>`).join(''));
    }
    panel.push(`<p class="sys-soon">${window.OrbiteOnline && window.OrbiteOnline.configured ? tr('Vos amis peuvent visiter votre système depuis leur profil, onglet Amis.') : tr('Bientôt : visitez les systèmes de vos amis, et faites visiter le vôtre.')}</p>`);
    $('sysPanel').innerHTML = panel.join('');
    drawOrbits();
  }

  function drawOrbits() {
    const v = $('sysView'), W = v.clientWidth, H = v.clientHeight;
    const used = new Set(src().planets.filter((p) => p.orbit != null).map((p) => p.orbit));
    let svg = '';
    for (let k = 0; k < F.ORBITS; k++) {
      const rx = orbitR(k, W);
      svg += `<ellipse cx="${W / 2}" cy="${H / 2}" rx="${rx.toFixed(1)}" ry="${(rx * TILT).toFixed(1)}" class="${used.has(k) ? 'used' : ''}"/>`;
    }
    $('sysOrbits').setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('sysOrbits').innerHTML = src().star.lit ? svg : '';
  }

  // Les mondes tournent : les orbites proches vont plus vite, ceux de devant passent devant l'étoile.
  function placeSystem(now) {
    const v = $('sysView'), W = v.clientWidth, H = v.clientHeight;
    const t = (now - SYS.t0) / 1000;
    const star = v.querySelector('.sys-star');
    if (star) { star.style.transform = `translate(${(W - starPx()) / 2}px, ${(H - starPx()) / 2}px)`; star.style.zIndex = '100'; }
    for (const el of v.querySelectorAll('.sys-pl')) {
      const p = src().planets[Number(el.dataset.i)];
      if (!p || p.orbit == null) continue;
      const k = p.orbit, rx = orbitR(k, W), ry = rx * TILT;
      const a0 = (p.seed % 628) / 100;
      const a = a0 + t * 0.55 / Math.pow(1 + k, 1.2);
      const depth = Math.sin(a);
      const s = plPx(p) * (1 + 0.14 * depth);
      el.style.setProperty('--s', s.toFixed(1) + 'px');
      el.style.transform = `translate(${(W / 2 + rx * Math.cos(a) - s / 2).toFixed(1)}px, ${(H / 2 + ry * depth - s / 2).toFixed(1)}px)`;
      el.style.zIndex = String(depth > 0 ? 200 + Math.round(depth * 50) : 50 + Math.round(depth * 40));
    }
  }
  function loopSystem() {
    cancelAnimationFrame(SYS.raf);
    if (!SYS.t0) SYS.t0 = performance.now();
    const step = (now) => {
      if (!document.getElementById('system').classList.contains('active')) return;
      placeSystem(now);
      SYS.raf = requestAnimationFrame(step);
    };
    SYS.raf = requestAnimationFrame(step);
  }
  window.addEventListener('resize', () => { if (document.getElementById('system').classList.contains('active')) drawOrbits(); });

  function sysDo(a, fx) {
    const r = F.sysCheck(data, a, A.dust());
    if (!r.ok) { A.refuse(r.reason); return false; }
    if (r.cost) A.addDust(-r.cost);
    F.sysApply(data, a);
    save();
    if (a.t === 'light' || a.t === 'starClass' || a.t === 'starGrow') registerStar();
    renderSystem();
    A.vibrate(15);
    if (fx !== false) {
      const el = $('sysView').querySelector(a.t === 'orbit' ? `.sys-pl[data-i="${a.i}"]` : '.sys-star');
      if (el) {
        const b = el.getBoundingClientRect();
        const x = b.left + b.width / 2, y = b.top + b.height / 2;
        const gold = [[246, 196, 83], [255, 255, 255]];
        stage.ring(x, y, b.width * 0.5, { n: a.t === 'light' ? 80 : 36, colors: gold, speed: a.t === 'light' ? 140 : 60, life: 0.8 });
        stage.burst(x, y, { n: a.t === 'light' ? 60 : 20, colors: gold, speed: 90, life: 0.8 });
      }
      if (a.t === 'light') SFX.level(); else if (a.t === 'orbit') SFX.place(); else SFX.golden ? SFX.golden() : SFX.level();
    }
    return true;
  }

  function starSheet() {
    if (VIEW) {
      const st = VIEW.star;
      A.openSheet(`<h3>${tr('L’ÉTOILE DE {nom}', { nom: esc(VIEW.owner.toUpperCase()) })}</h3><h2>${st.lit ? esc(F.STAR_CLASSES.find((c) => c.key === st.cls).name) : tr('Étoile éteinte')}</h2>
        <p class="muted">${tr('Taille {n} / {max}', { n: st.size + 1, max: F.STAR_GROW.length + 1 })}</p><div class="sheet-actions"><button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
      return;
    }
    const st = data.star;
    if (!st.lit) { A.refuse(tr('Allumez d’abord votre étoile.')); return; }
    const grow = st.size < F.STAR_GROW.length;
    A.openSheet(`<h3>${tr('VOTRE ÉTOILE')}</h3><h2>${esc(F.STAR_CLASSES.find((c) => c.key === st.cls).name)}</h2>
      <p class="muted">${tr('Changez sa lumière ou faites-la grandir.')}</p>
      <div class="fg-chips">${F.STAR_CLASSES.map((c) => `<button class="fg-chip ${c.key === st.cls ? 'on' : ''}" data-forge="sysClass" data-k="${c.key}">${esc(c.name)}<small>${c.key === st.cls ? tr('actuelle') : price(c.price)}</small></button>`).join('')}</div>
      <div class="sheet-actions"><button class="btn" data-act="close">${tr('FERMER')}</button>${grow ? `<button class="btn primary" data-forge="sysGrow">${tr('GRANDIR · {prix}', { prix: price(F.STAR_GROW[st.size]) })}</button>` : ''}</div>`);
  }
  function planetSheet(i) {
    if (VIEW) {
      const q = VIEW.planets[i];
      A.openSheet(`<div class="sheet-top"><div class="orb sheet-orb" data-planet="${plId(q, i)}"></div><div>
        <span class="fam-chip" style="--c:var(--gold)">${tr('ORBITE {n}', { n: q.orbit + 1 })}</span>
        <h2>${esc(q.name)}</h2><p class="muted">${F.NATURE[q.type].name} · ${tr('taille {n} / {max}', { n: q.mass, max: F.MAX_MASS })} · ${tr('forgé par {nom}', { nom: esc(VIEW.owner) })}</p></div></div>
        <div class="sheet-actions"><button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
      return;
    }
    const p = data.planets[i];
    A.openSheet(`<div class="sheet-top"><div class="orb sheet-orb" data-planet="${lookId(p)}"></div><div>
      <span class="fam-chip" style="--c:var(--gold)">${p.orbit == null ? tr('HORS ORBITE') : tr('ORBITE {n}', { n: p.orbit + 1 })}</span>
      <h2>${esc(p.name)}</h2><p class="muted">${F.NATURE[p.type].name} · ${tr('taille {n} / {max}', { n: p.mass, max: F.MAX_MASS })}</p></div></div>
      <div class="sheet-actions"><button class="btn" data-forge="sysForge" data-i="${i}">${tr('FAÇONNER')}</button><button class="btn primary" data-forge="sysPlace" data-i="${i}">${tr('CHANGER D’ORBITE')}</button></div>`);
  }
  function placeSheet(i) {
    const p = data.planets[i];
    const owner = (k) => data.planets.find((q) => q.orbit === k);
    A.openSheet(`<h3>${tr('ORBITE DE {nom}', { nom: esc(p.name.toUpperCase()) })}</h3><p class="muted">${tr('Les orbites proches tournent plus vite. Choisir une orbite occupée échange les deux mondes.')}</p>
      <div class="sys-slots">${Array.from({ length: F.ORBITS }, (_, k) => {
        const o = owner(k);
        return `<button class="fg-chip ${p.orbit === k ? 'on' : ''}" data-forge="sysSlot" data-i="${i}" data-k="${k}">${tr('Orbite {n}', { n: k + 1 })}<small>${o ? esc(o.name) : tr('libre')}</small></button>`;
      }).join('')}</div>
      <div class="sheet-actions">${p.orbit != null ? `<button class="btn ghost" data-forge="sysOut" data-i="${i}">${tr('RETIRER DE L’ORBITE')}</button>` : ''}<button class="btn" data-act="close">${tr('FERMER')}</button></div>`);
  }

  async function sysAction(k, b) {
    const i = Number(b.dataset.i);
    if (k === 'sysStar') { SFX.tap(); starSheet(); }
    else if (k === 'sysPlanet') { SFX.tap(); planetSheet(i); }
    else if (VIEW) return;
    else if (k === 'sysPlace') { SFX.tap(); placeSheet(i); }
    else if (k === 'sysLight') sysDo({ t: 'light' });
    else if (k === 'sysClass') { A.closeSheet(); sysDo({ t: 'starClass', cls: b.dataset.k }); }
    else if (k === 'sysGrow') { A.closeSheet(); sysDo({ t: 'starGrow' }); }
    else if (k === 'sysSlot') { A.closeSheet(); sysDo({ t: 'orbit', i, slot: Number(b.dataset.k) }); }
    else if (k === 'sysOut') { A.closeSheet(); sysDo({ t: 'orbit', i, slot: null }, false); SFX.tap(); }
    else if (k === 'sysForge') {
      A.closeSheet();
      data.sel = i;
      shownSize = 0;
      save();
      await A.show('market');
      A.marketTab('creation');
    }
  }
  $('sysBack').addEventListener('click', async () => {
    SFX.tap();
    if (VIEW) {
      VIEW = null;
      await A.show('profile');
      A.renderProfile();
      return;
    }
    await A.show('market');
    A.marketTab('creation');
  });

  // Visite du système d'un autre Créateur (profil public venu du serveur).
  async function visit(profile) {
    const f = (profile && profile.forge) || {};
    const star = F.sanitizeStar(f.star, 1);
    const planets = (Array.isArray(f.planets) ? f.planets : []).slice(0, F.MAX_PLANETS).map((p, i) => F.sanitize(Object.assign({}, p, { id: 'v' + i }), i));
    VIEW = { star, planets, owner: String(profile.pseudo || tr('Créateur')) };
    stage.register('visit-star', F.starLook(star));
    planets.forEach((p, i) => stage.register('visit-' + i, F.look(p)));
    await A.show('system');
    renderSystem();
    loopSystem();
  }

  stage.register('forge-graine', { type: 'asteroid', seed: 4711, debris: true, full: true, moons: 0 });
  O.forge = { render, visit, get data() { return data; } };
})();
