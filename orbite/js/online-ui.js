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
    return s < 60 ? 'à l’instant' : s < 3600 ? `il y a ${Math.round(s / 60)} min` : `il y a ${Math.round(s / 3600)} h`;
  };
  const tierOrb = (p) => (p && p.placed ? `rank-${TIER_IDS[K.tierOf(p.points).idx]}` : 'rank-poussiere');
  const tierText = (p) => (p && p.placed ? `${K.tierOf(p.points).label} · ${p.points} pts` : 'non classé');
  const profileActive = () => $('profile') && $('profile').classList.contains('active');

  // ─── Carte « En ligne » (onglet Profil) ─────────────────────
  function cardHtml() {
    const s = N.state;
    if (!N.configured) return `<div class="on-card"><span class="mk-kicker">EN LIGNE</span><p>Bientôt : connexion avec Google, sauvegarde en ligne, amis et classement mondial.</p></div>`;
    if (s.status === 'signedIn') {
      return `<div class="on-card on">
        <span class="mk-kicker">EN LIGNE · ${esc(s.user.email || s.user.name)}</span>
        <div class="on-code"><span>CODE AMI</span><b>${N.myCode()}</b><button class="btn" data-on="copy">COPIER</button></div>
        <small class="on-sync">${s.syncAt ? `Progression sauvegardée en ligne ${ago(s.syncAt)}.` : 'Synchronisation…'}</small>
        ${s.error ? `<small class="on-err">${esc(s.error)}</small>` : ''}
        <button class="link" data-on="signout">Se déconnecter</button></div>`;
    }
    if (s.status === 'loading' || s.status === 'off') return `<div class="on-card"><span class="mk-kicker">EN LIGNE</span><p>Connexion au serveur…</p></div>`;
    if (s.status === 'offline') return `<div class="on-card"><span class="mk-kicker">EN LIGNE</span><p>Hors ligne : le jeu continue sur cet appareil.</p><button class="btn" data-on="retry">RÉESSAYER</button></div>`;
    return `<div class="on-card"><span class="mk-kicker">EN LIGNE</span>
      <p>Connectez-vous pour sauvegarder votre progression en ligne, la retrouver sur un autre appareil, ajouter des amis et entrer au classement mondial.</p>
      <button class="btn primary on-google" data-on="signin"><span class="on-g">G</span> SE CONNECTER AVEC GOOGLE</button>
      ${s.error ? `<small class="on-err">${esc(s.error)}</small>` : ''}</div>`;
  }
  function renderCard() { const b = $('pfOnline'); if (b) b.innerHTML = cardHtml(); }
  function needSignIn(box, what) {
    box.innerHTML = cardHtml().replace('<p>Connectez-vous', `<p>${what} Connectez-vous`);
  }

  // ─── Amis ───────────────────────────────────────────────────
  async function renderFriends() {
    const box = $('pfFriends');
    if (!box) return;
    if (N.state.status !== 'signedIn') { needSignIn(box, 'Ajoutez des amis avec leur code et visitez leurs systèmes.'); return; }
    box.innerHTML = `<div class="on-code big"><span>VOTRE CODE AMI</span><b>${N.myCode()}</b><button class="btn" data-on="copy">COPIER</button></div>
      <div class="on-add"><input id="onCode" maxlength="7" placeholder="CODE D’UN AMI" autocomplete="off" autocapitalize="characters"><button class="btn primary" data-on="add">AJOUTER</button></div>
      <div id="onFriendList">${friendsCache ? listHtml(friendsCache) : '<p class="muted">Chargement…</p>'}</div>`;
    try {
      friendsCache = await N.friends();
      const l = $('onFriendList');
      if (l) l.innerHTML = listHtml(friendsCache);
    } catch (err) { const l = $('onFriendList'); if (l) l.innerHTML = '<p class="muted">Impossible de charger vos amis pour le moment.</p>'; }
    badge();
  }
  function personRow(f, actions) {
    const p = f.profile || {};
    return `<div class="on-row">
      <span class="orb" data-planet="${tierOrb(p)}"></span>
      <span class="on-row-txt"><b>${esc(p.pseudo || 'Créateur')}<small>#${esc(p.tag || '')}</small></b><small>Niveau ${p.level || 1} · ${esc(tierText(p))}</small></span>
      <span class="on-row-act">${actions}</span></div>`;
  }
  function listHtml(list) {
    const inc = list.filter((f) => f.incoming), out = list.filter((f) => f.status === 'pending' && !f.incoming), ok = list.filter((f) => f.status === 'accepted');
    let h = '';
    if (inc.length) h += `<h4 class="fg-h">DEMANDES REÇUES</h4>` + inc.map((f) => personRow(f, `<button class="btn primary" data-on="accept" data-pair="${f.pair}">ACCEPTER</button><button class="btn ghost" data-on="remove" data-pair="${f.pair}">REFUSER</button>`)).join('');
    h += `<h4 class="fg-h">VOS AMIS <small>${ok.length}</small></h4>`;
    h += ok.length ? ok.map((f) => personRow(f, `${f.profile && f.profile.forge && f.profile.forge.star && f.profile.forge.star.lit ? `<button class="btn" data-on="visit" data-uid="${f.uid}">VISITER</button>` : ''}<button class="btn ghost on-x" data-on="remove" data-pair="${f.pair}" aria-label="Retirer">×</button>`)).join('')
      : '<p class="muted">Partagez votre code ami, ou entrez celui d’un ami ci-dessus.</p>';
    if (out.length) h += `<h4 class="fg-h">DEMANDES ENVOYÉES</h4>` + out.map((f) => personRow(f, `<button class="btn ghost" data-on="remove" data-pair="${f.pair}">ANNULER</button>`)).join('');
    return h;
  }

  // ─── Classement ─────────────────────────────────────────────
  async function renderLeader() {
    const box = $('pfLeader');
    if (!box) return;
    if (N.state.status !== 'signedIn') { needSignIn(box, 'Le classement mondial réunit tous les Créateurs connectés.'); return; }
    box.innerHTML = `<div class="on-scope">${[['monde', 'MONDE'], ['amis', 'AMIS']].map(([k, n]) => `<button class="fg-chip ${scope === k ? 'on' : ''}" data-on="scope" data-k="${k}">${n}</button>`).join('')}</div>
      <div id="onBoard">${leaderCache[scope] ? boardHtml(leaderCache[scope]) : '<p class="muted">Chargement…</p>'}</div>`;
    try {
      leaderCache[scope] = await N.leaderboard(scope);
      const b = $('onBoard');
      if (b) b.innerHTML = boardHtml(leaderCache[scope]);
    } catch (err) { const b = $('onBoard'); if (b) b.innerHTML = '<p class="muted">Classement indisponible pour le moment.</p>'; }
  }
  function boardHtml(rows) {
    const me = N.state.user && N.state.user.uid;
    if (!rows.length) return '<p class="muted">Personne n’est encore classé ici : terminez vos 5 parties de placement !</p>';
    return `<ol class="on-board">${rows.map((p, i) => `<li class="${p.uid === me ? 'me' : ''}" data-on="who" data-uid="${p.uid}">
      <span class="on-pos">${i + 1}</span><span class="orb" data-planet="${tierOrb(p)}"></span>
      <span class="on-row-txt"><b>${esc(p.pseudo)}<small>#${esc(p.tag || '')}</small></b><small>${esc(K.tierOf(p.points).label)} · niveau ${p.level}</small></span>
      <b class="on-pts">${p.points}</b></li>`).join('')}</ol>`;
  }
  async function whoSheet(uid) {
    const p = await N.profileOf(uid).catch(() => null);
    if (!p) return;
    const lit = p.forge && p.forge.star && p.forge.star.lit;
    A.openSheet(`<div class="sheet-top"><div class="orb sheet-orb" data-planet="${tierOrb(p)}"></div><div>
      <span class="fam-chip" style="--c:var(--gold)">${esc(tierText(p).toUpperCase())}</span>
      <h2>${esc(p.pseudo)}<small class="muted"> #${esc(p.tag || '')}</small></h2>
      <p class="muted">Niveau ${p.level} · ${p.games} parties · ${p.wins} victoires</p></div></div>
      <div class="sheet-actions"><button class="btn" data-act="close">FERMER</button>${lit ? `<button class="btn primary" data-on="visit" data-uid="${uid}">VISITER SON SYSTÈME</button>` : ''}</div>`);
  }

  // ─── Sauvegardes en désaccord ───────────────────────────────
  let conflictShown = false;
  function conflictSheet() {
    const c = N.state.conflict;
    if (!c || conflictShown) return;
    conflictShown = true;
    const lv = (x) => A.levelInfo(x.xp).lvl;
    const card = (t, x, v) => `<button class="on-save" data-on="pick" data-v="${v}"><span class="mk-kicker">${t}</span><b>${esc(x.pseudo)}</b><small>Niveau ${lv(x)} · ${x.dust} poussières · ${x.games} parties</small></button>`;
    A.openSheet(`<h3>DEUX SAUVEGARDES</h3><h2>Laquelle garder ?</h2>
      <p class="muted">Cet appareil et votre compte en ligne ont chacun avancé de leur côté. Choisissez la progression à conserver : l’autre sera remplacée.</p>
      <div class="on-saves">${card('CET APPAREIL', c.device, 'device')}${card('EN LIGNE', c.cloud, 'cloud')}</div>`, { locked: true });
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
    else if (k === 'signout') { await N.signOut(); friendsCache = null; leaderCache = {}; A.toast('Déconnecté : la progression reste sur cet appareil.', 2600); }
    else if (k === 'retry') { await N.boot(); }
    else if (k === 'copy') {
      try { await navigator.clipboard.writeText(N.myCode()); A.toast('Code ami copié : envoyez-le à vos amis.', 2200); }
      catch (err) { A.toast('Votre code ami : ' + N.myCode(), 3000); }
    } else if (k === 'add') {
      const v = $('onCode') ? $('onCode').value : '';
      b.disabled = true;
      const r = await N.addByCode(v).catch(() => ({ ok: false, reason: 'Le serveur ne répond pas.' }));
      b.disabled = false;
      if (!r.ok) { A.refuse(r.reason); return; }
      A.toast(r.accepted ? `Vous êtes maintenant ami avec ${r.name}.` : `Demande envoyée à ${r.name}.`, 2600);
      SFX.level();
      renderFriends();
    } else if (k === 'accept') { await N.accept(b.dataset.pair).catch(() => A.refuse('Le serveur ne répond pas.')); SFX.level(); renderFriends(); }
    else if (k === 'remove') { await N.remove(b.dataset.pair).catch(() => A.refuse('Le serveur ne répond pas.')); renderFriends(); }
    else if (k === 'visit') {
      A.closeSheet();
      const p = await N.profileOf(b.dataset.uid).catch(() => null);
      if (p) await O.forge.visit(p);
    } else if (k === 'scope') { scope = b.dataset.k; renderLeader(); }
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
})();
