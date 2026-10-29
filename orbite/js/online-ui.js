/* ORBITE — interface du mode en ligne, dans le Profil : connexion Google, sauvegarde, amis,
 * classement mondial et visites. La logique serveur est dans js/online.js. */
(function () {
  'use strict';

  const O = window.__orbite;
  const N = window.OrbiteOnline;
  if (!O || !O.api || !N) return;
  const A = O.api, SFX = window.OrbiteSfx, K = window.OrbiteClassement;
  const $ = (id) => document.getElementById(id);
  const { icon, esc } = A;
  const TIER_IDS = ['poussiere', 'asteroide', 'lune', 'planete', 'geante', 'etoile', 'nebuleuse', 'pulsar', 'singularite'];
  let tab = 'profil', scope = 'monde', friendsCache = null, leaderCache = {};

  const ago = (t) => {
    const s = Math.round((Date.now() - t) / 1000);
    return s < 60 ? tr('à l’instant') : s < 3600 ? tr('il y a {n} min', { n: Math.round(s / 60) }) : tr('il y a {n} h', { n: Math.round(s / 3600) });
  };
  const tierOrb = (p) => (p && p.placed ? `rank-${TIER_IDS[K.tierOf(p.points).idx]}` : 'rank-poussiere');
  const tierText = (p) => (p && p.placed ? `${K.tierOf(p.points).label} · ${tr('{n} pts', { n: p.points })}` : tr('non classé'));
  const profileActive = () => $('profile') && $('profile').classList.contains('active');

  // ─── Carte « En ligne » (onglet Profil) ─────────────────────
  // pre : phrase ajoutée devant l'invitation à se connecter (onglets Amis et Classement).
  function cardHtml(pre) {
    const s = N.state;
    if (!N.configured) return `<div class="on-card"><span class="mk-kicker">${tr('EN LIGNE')}</span><p>${tr('Bientôt : connexion avec Google, sauvegarde en ligne, amis et classement mondial.')}</p></div>`;
    if (s.status === 'signedIn') {
      return `<div class="on-card on">
        <span class="mk-kicker">${tr('EN LIGNE')} · ${esc(s.user.email || s.user.name)}</span>
        <div class="on-code"><span>${tr('CODE AMI')}</span><b>${N.myCode()}</b><button class="btn" data-on="copy">${tr('COPIER')}</button></div>
        <small class="on-sync">${s.syncAt ? tr('Progression sauvegardée en ligne {quand}.', { quand: ago(s.syncAt) }) : tr('Synchronisation…')}</small>
        ${s.error ? `<small class="on-err">${esc(s.error)}</small>` : ''}
        <button class="link" data-on="signout">${tr('Se déconnecter')}</button></div>`;
    }
    if (s.status === 'loading' || s.status === 'off') return `<div class="on-card"><span class="mk-kicker">${tr('EN LIGNE')}</span><p>${tr('Connexion au serveur…')}</p></div>`;
    if (s.status === 'offline') return `<div class="on-card"><span class="mk-kicker">${tr('EN LIGNE')}</span><p>${tr('Hors ligne : le jeu continue sur cet appareil.')}</p><button class="btn" data-on="retry">${tr('RÉESSAYER')}</button></div>`;
    return `<div class="on-card"><span class="mk-kicker">${tr('EN LIGNE')}</span>
      <p>${pre ? pre + ' ' : ''}${tr('Connectez-vous pour sauvegarder votre progression en ligne, la retrouver sur un autre appareil, ajouter des amis et entrer au classement mondial.')}</p>
      <button class="btn primary on-google" data-on="signin"><span class="on-g">G</span> ${tr('SE CONNECTER AVEC GOOGLE')}</button>
      ${s.error ? `<small class="on-err">${esc(s.error)}</small>` : ''}</div>`;
  }
  function renderCard() { const b = $('pfOnline'); if (b) b.innerHTML = cardHtml(); }
  function needSignIn(box, what) {
    box.innerHTML = cardHtml(what);
  }

  // ─── Amis ───────────────────────────────────────────────────
  async function renderFriends() {
    const box = $('pfFriends');
    if (!box) return;
    if (N.state.status !== 'signedIn') { needSignIn(box, tr('Ajoutez des amis avec leur code et visitez leurs systèmes.')); return; }
    box.innerHTML = `<div class="on-code big"><span>${tr('VOTRE CODE AMI')}</span><b>${N.myCode()}</b><button class="btn" data-on="copy">${tr('COPIER')}</button></div>
      <div class="on-add"><input id="onCode" maxlength="7" placeholder="${tr('CODE D’UN AMI')}" autocomplete="off" autocapitalize="characters"><button class="btn primary" data-on="add">${tr('AJOUTER')}</button></div>
      <div id="onFriendList">${friendsCache ? listHtml(friendsCache) : `<p class="muted">${tr('Chargement…')}</p>`}</div>`;
    try {
      friendsCache = await N.friends();
      const l = $('onFriendList');
      if (l) l.innerHTML = listHtml(friendsCache);
    } catch (err) { const l = $('onFriendList'); if (l) l.innerHTML = `<p class="muted">${tr('Impossible de charger vos amis pour le moment.')}</p>`; }
    badge();
  }
  // Présence d'un ami : en ligne (moins de 3 min), en partie, ou vu il y a un moment.
  function presenceOf(p) {
    if (!p || !p.seen) return null;
    const ago = Date.now() - p.seen;
    if (ago < 180000) {
      if (p.where === 'multi') return { cls: 'play', txt: tr('En partie en ligne') };
      if (p.where === 'game') return { cls: 'play', txt: tr('En partie') };
      return { cls: 'on', txt: tr('En ligne') };
    }
    const min = Math.round(ago / 60000), h = Math.round(ago / 3600000), d = Math.round(ago / 86400000);
    return { cls: 'off', txt: min < 60 ? tr('Vu il y a {n} min', { n: min }) : h < 24 ? tr('Vu il y a {n} h', { n: h }) : tr('Vu il y a {n} j', { n: d }) };
  }
  function personRow(f, actions) {
    const p = f.profile || {};
    const pr = f.status === 'accepted' ? presenceOf(p) : null;
    return `<div class="on-row">
      <span class="orb" data-planet="${tierOrb(p)}"></span>
      <span class="on-row-txt"><b>${pr ? `<i class="on-dot ${pr.cls}"></i>` : ''}${esc(p.pseudo || tr('Créateur'))}<small>#${esc(p.tag || '')}</small></b><small>${pr && pr.cls !== 'off' ? `<em class="on-pres ${pr.cls}">${esc(pr.txt)}</em> · ` : ''}${tr('Niveau {n}', { n: p.level || 1 })} · ${esc(tierText(p))}${pr && pr.cls === 'off' ? ' · ' + esc(pr.txt) : ''}</small></span>
      <span class="on-row-act">${actions}</span></div>`;
  }
  function listHtml(list) {
    const inc = list.filter((f) => f.incoming), out = list.filter((f) => f.status === 'pending' && !f.incoming), ok = list.filter((f) => f.status === 'accepted');
    let h = '';
    if (inc.length) h += `<h4 class="fg-h">${tr('DEMANDES REÇUES')}</h4>` + inc.map((f) => personRow(f, `<button class="btn primary" data-on="accept" data-pair="${f.pair}">${tr('ACCEPTER')}</button><button class="btn ghost" data-on="remove" data-pair="${f.pair}">${tr('REFUSER')}</button>`)).join('');
    h += `<h4 class="fg-h">${tr('VOS AMIS')} <small>${ok.length}</small></h4>`;
    h += ok.length ? ok.map((f) => personRow(f, `${window.OrbiteMultiUI ? `<button class="btn" data-on="duel" data-uid="${f.uid}">${tr('DÉFIER')}</button>` : ''}${f.profile && f.profile.forge && f.profile.forge.star && f.profile.forge.star.lit ? `<button class="btn" data-on="visit" data-uid="${f.uid}">${tr('VISITER')}</button>` : ''}<button class="btn ghost on-x" data-on="remove" data-pair="${f.pair}" aria-label="${tr('Retirer')}">×</button>`)).join('')
      : `<p class="muted">${tr('Partagez votre code ami, ou entrez celui d’un ami ci-dessus.')}</p>`;
    if (out.length) h += `<h4 class="fg-h">${tr('DEMANDES ENVOYÉES')}</h4>` + out.map((f) => personRow(f, `<button class="btn ghost" data-on="remove" data-pair="${f.pair}">${tr('ANNULER')}</button>`)).join('');
    return h;
  }

  // ─── Classement ─────────────────────────────────────────────
  async function renderLeader() {
    const box = $('pfLeader');
    if (!box) return;
    if (N.state.status !== 'signedIn') { needSignIn(box, tr('Le classement mondial réunit tous les Créateurs connectés.')); return; }
    box.innerHTML = `<div class="on-scope">${[['monde', tr('MONDE')], ['amis', tr('AMIS')]].map(([k, n]) => `<button class="fg-chip ${scope === k ? 'on' : ''}" data-on="scope" data-k="${k}">${n}</button>`).join('')}</div>
      <div id="onBoard">${leaderCache[scope] ? boardHtml(leaderCache[scope]) : `<p class="muted">${tr('Chargement…')}</p>`}</div>`;
    try {
      leaderCache[scope] = await N.leaderboard(scope);
      const b = $('onBoard');
      if (b) b.innerHTML = boardHtml(leaderCache[scope]);
    } catch (err) { const b = $('onBoard'); if (b) b.innerHTML = `<p class="muted">${tr('Classement indisponible pour le moment.')}</p>`; }
  }
  function boardHtml(rows) {
    const me = N.state.user && N.state.user.uid;
    if (!rows.length) return `<p class="muted">${tr('Personne n’est encore classé ici : terminez vos 5 parties de placement !')}</p>`;
    return `<ol class="on-board">${rows.map((p, i) => `<li class="${p.uid === me ? 'me' : ''}" data-on="who" data-uid="${p.uid}">
      <span class="on-pos">${i + 1}</span><span class="orb" data-planet="${tierOrb(p)}"></span>
      <span class="on-row-txt"><b>${esc(p.pseudo)}<small>#${esc(p.tag || '')}</small></b><small>${esc(K.tierOf(p.points).label)} · ${tr('niveau {n}', { n: p.level })}</small></span>
      <b class="on-pts">${p.points}</b></li>`).join('')}</ol>`;
  }
  async function whoSheet(uid) {
    const p = await N.profileOf(uid).catch(() => null);
    if (!p) return;
    const lit = p.forge && p.forge.star && p.forge.star.lit;
    A.openSheet(`<div class="sheet-top"><div class="orb sheet-orb" data-planet="${tierOrb(p)}"></div><div>
      <span class="fam-chip" style="--c:var(--gold)">${esc(tierText(p).toUpperCase())}</span>
      <h2>${esc(p.pseudo)}<small class="muted"> #${esc(p.tag || '')}</small></h2>
      <p class="muted">${tr('Niveau {n} · {p} parties · {v} victoires', { n: p.level, p: p.games, v: p.wins })}</p></div></div>
      <div class="sheet-actions"><button class="btn" data-act="close">${tr('FERMER')}</button>${lit ? `<button class="btn primary" data-on="visit" data-uid="${uid}">${tr('VISITER SON SYSTÈME')}</button>` : ''}</div>`);
  }

  // ─── Sauvegardes en désaccord ───────────────────────────────
  let conflictShown = false;
  function conflictSheet() {
    const c = N.state.conflict;
    if (!c || conflictShown) return;
    conflictShown = true;
    const lv = (x) => A.levelInfo(x.xp).lvl;
    const card = (t, x, v) => `<button class="on-save" data-on="pick" data-v="${v}"><span class="mk-kicker">${t}</span><b>${esc(x.pseudo)}</b><small>${tr('Niveau {n} · {d} poussières · {p} parties', { n: lv(x), d: x.dust, p: x.games })}</small></button>`;
    A.openSheet(`<h3>${tr('DEUX SAUVEGARDES')}</h3><h2>${tr('Laquelle garder ?')}</h2>
      <p class="muted">${tr('Cet appareil et votre compte en ligne ont chacun avancé de leur côté. Choisissez la progression à conserver : l’autre sera remplacée.')}</p>
      <div class="on-saves">${card(tr('CET APPAREIL'), c.device, 'device')}${card(tr('EN LIGNE'), c.cloud, 'cloud')}</div>`, { locked: true });
  }

  function badge() {
    const n = N.state.requests || 0;
    const b = $('pfBadge');
    if (b) { b.hidden = !n; b.textContent = n; }
    const pb = $('profileBtn');
    if (pb) pb.classList.toggle('has-req', n > 0);
  }

  // ─── Actions ────────────────────────────────────────────────
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-on]');
    if (!b) return;
    const k = b.dataset.on;
    if (k !== 'who') SFX.tap();
    if (k === 'signin') { await N.signIn(); }
    else if (k === 'signout') { await N.signOut(); friendsCache = null; leaderCache = {}; A.toast(tr('Déconnecté : la progression reste sur cet appareil.'), 2600); }
    else if (k === 'retry') { await N.boot(); }
    else if (k === 'copy') {
      try { await navigator.clipboard.writeText(N.myCode()); A.toast(tr('Code ami copié : envoyez-le à vos amis.'), 2200); }
      catch (err) { A.toast(tr('Votre code ami : {code}', { code: N.myCode() }), 3000); }
    } else if (k === 'add') {
      const v = $('onCode') ? $('onCode').value : '';
      b.disabled = true;
      const r = await N.addByCode(v).catch(() => ({ ok: false, reason: tr('Le serveur ne répond pas.') }));
      b.disabled = false;
      if (!r.ok) { A.refuse(r.reason); return; }
      A.toast(r.accepted ? tr('Vous êtes maintenant ami avec {nom}.', { nom: r.name }) : tr('Demande envoyée à {nom}.', { nom: r.name }), 2600);
      SFX.level();
      renderFriends();
    } else if (k === 'accept') { await N.accept(b.dataset.pair).catch(() => A.refuse(tr('Le serveur ne répond pas.'))); SFX.level(); renderFriends(); }
    else if (k === 'remove') { await N.remove(b.dataset.pair).catch(() => A.refuse(tr('Le serveur ne répond pas.'))); renderFriends(); }
    else if (k === 'visit') {
      A.closeSheet();
      const p = await N.profileOf(b.dataset.uid).catch(() => null);
      if (p) await O.forge.visit(p);
    } else if (k === 'duel') { if (window.OrbiteMultiUI) await window.OrbiteMultiUI.challenge(b.dataset.uid); }
    else if (k === 'scope') { scope = b.dataset.k; renderLeader(); }
    else if (k === 'who') { SFX.tap(); whoSheet(b.dataset.uid); }
    else if (k === 'pick') { A.closeSheet(); conflictShown = false; await N.resolveConflict(b.dataset.v); }
  });

  N.on(() => {
    if (N.state.conflict) conflictSheet();
    badge();
    if (profileActive()) {
      renderCard();
      if (tab === 'amis' && !$('onCode')) renderFriends();
      if (tab === 'classement' && !$('onBoard')) renderLeader();
    }
  });

  O.onlineUI = {
    renderProfile(t) {
      tab = t;
      renderCard();
      if (t === 'amis') renderFriends();
      if (t === 'classement') renderLeader();
      badge();
    }
  };
  // La présence des amis se rafraîchit toute seule tant que l'onglet Amis est ouvert.
  setInterval(() => {
    const prof = document.getElementById('profile');
    if (tab === 'amis' && prof && prof.classList.contains('active') && !document.hidden && N.state.status === 'signedIn' && !$('onCode')) renderFriends();
  }, 30000);
})();
