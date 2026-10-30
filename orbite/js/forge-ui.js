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
  let customOpen = false;
  function load() {
    try {
      const d = JSON.parse(A.store.get(KEY, 'null'));
      if (d && Array.isArray(d.planets)) {
        d.planets = d.planets.slice(0, F.MAX_PLANETS).map(F.sanitize);
        d.sel = Math.max(0, Math.min(d.sel | 0, d.planets.length - 1));
        // L'étoile de l'ancien « Mon système » (avant la v120) reste dans la sauvegarde et le profil
        // public, pour les anciens clients ; elle ne s'affiche plus.
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
  const dustHud = () => { for (const id of ['marketDust', 'creationDust']) if ($(id)) $(id).innerHTML = A.wallet(); };

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
      ${!full ? `<button class="btn fg-seedfeed" data-forge="seedfeed" ${A.seeds() < 1 ? 'disabled' : ''}>${tr('+1 TAILLE · 1')} ${icon('seed', 'seed')}</button>` : ''}
      <div class="fg-slots"><span>${tr('EMPLACEMENTS')}</span><span class="fg-pips">${pips}</span><span>${free > 1 ? tr('{n} libres', { n: free }) : tr('{n} libre', { n: free })}</span></div>
      ${surfaceRow(p)}`;
    // Personnalisation (nature, teinte, ajouts, relief) dans un volet repliable : fermé par défaut,
    // ouvert tant que la nature n'est pas choisie.
    if (p.mass >= 1) {
      const open = customOpen || !p.type;
      const parts = F.PARTS.filter((part) => (part.key === 'moons' ? p.moons > 0 : !!p[part.key])).length;
      const sum = p.type ? `${F.NATURE[p.type].name} · ${parts > 1 ? tr('{n} ajouts', { n: parts }) : tr('{n} ajout', { n: parts })}` : tr('nature à choisir');
      html += `<button class="fg-fold ${open ? 'on' : ''}" data-forge="fold" aria-expanded="${open}"><span>${tr('PERSONNALISER LA PLANÈTE')}</span><small>${esc(sum)}</small><i>${open ? '▴' : '▾'}</i></button>`;
      if (open) {
        html += '<div class="fg-custom">';
        {
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
        html += '</div>';
      }
    }
    html += `<h4 class="fg-h">${tr('VOTRE COLLECTION')} <small>${data.planets.length} / ${F.MAX_PLANETS}</small></h4>
      <div class="fg-coll">${data.planets.map((q, i) => `<button class="fg-thumb ${i === data.sel ? 'on' : ''}" data-forge="sel" data-i="${i}">
        <span class="orb" data-planet="${lookId(q)}"></span><small>${esc(q.name)}</small></button>`).join('')}
        ${data.planets.length < F.MAX_PLANETS ? `<button class="fg-thumb fg-new" data-forge="seed"><b>+</b><small>${tr('Graine · {prix}', { prix: price(F.seedCost(data.planets.length)) })}</small></button>` : ''}</div>`;
    if (p.type) swatches(p);
    box.innerHTML = html;
    // Le monde grossit en douceur jusqu'à sa nouvelle taille.
    const orb = $('fgOrb');
    const target = sizeOf(p);
    if (orb && shownSize && shownSize !== target) requestAnimationFrame(() => requestAnimationFrame(() => orb.style.setProperty('--s', target + 'px')));
    shownSize = target;
  }

  // Descente à la surface : un monde assez grand (et pas gazeux) peut accueillir une colonie.
  function surfaceRow(p) {
    const CU = window.OrbiteColonieUI;
    if (!CU || !p.type) return '';
    if (p.type === 'gas') return `<p class="fg-why fg-surface-lock">${tr('Une géante gazeuse n’a pas de sol : aucune colonie ne peut s’y poser.')}</p>`;
    if (p.mass < CU.SURFACE_MASS) return `<p class="fg-why fg-surface-lock">${tr('À la taille {n}, la vie pourrait apparaître à sa surface.', { n: CU.SURFACE_MASS })}</p>`;
    return `<button class="btn primary fg-surface" data-forge="surface">${CU.has(p.id) ? tr('MA COLONIE') : tr('DESCENDRE À LA SURFACE')}</button>`;
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
    if (k !== 'name-ok' && k !== 'shape') SFX.tap();
    if (k === 'seed') seed();
    else if (k === 'feed') act({ t: 'feed' });
    else if (k === 'seedfeed') {
      // Une graine de vie : un palier de croissance, sans poussières.
      const p = cur();
      if (!p || p.mass >= F.MAX_MASS || A.seeds() < 1) return;
      A.addSeeds(-1);
      const before = F.slotsFree(p);
      F.apply(p, { t: 'feed' });
      register(p); save(); dustHud(); render();
      SFX.level();
      burstOnOrb([[120, 230, 130], [255, 255, 255]], 36);
      A.popOn($('fgOrb'), tr('TAILLE {n}', { n: p.mass }), 'gold');
      if (F.slotsFree(p) > before) A.toast(tr('Un emplacement s’ouvre.'), 1600);
    }
    else if (k === 'nature') act({ t: 'nature', key: b.dataset.k });
    else if (k === 'hue') act({ t: 'hue', v: Number(b.dataset.v) });
    else if (k === 'relief') act({ t: 'relief' });
    else if (k === 'add') act({ t: 'add', part: b.dataset.k });
    else if (k === 'remove') act({ t: 'remove', part: b.dataset.k });
    else if (k === 'shapes') shapesSheet();
    else if (k === 'shape') { A.closeSheet(); act({ t: 'add', part: 'shape', v: b.dataset.k }); }
    else if (k === 'sel') { data.sel = Number(b.dataset.i); shownSize = 0; save(); render(); }
    else if (k === 'rename') renameSheet();
    else if (k === 'fold') { customOpen = !(customOpen || !cur().type); render(); }
    else if (k === 'surface' && window.OrbiteColonieUI) window.OrbiteColonieUI.open(cur(), $('fgOrb'));
    else if (k === 'name-ok') {
      const v = ($('fgNameIn').value || '').trim().slice(0, 18);
      if (v) { cur().name = v; save(); }
      A.closeSheet();
      render();
    }
  });

  stage.register('forge-graine', { type: 'asteroid', seed: 4711, debris: true, full: true, moons: 0 });
  O.forge = { render, get data() { return data; } };
})();
