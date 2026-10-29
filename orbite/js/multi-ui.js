/* ORBITE — écran Multijoueur : connexion, partie classée (recherche de créateurs de votre rang),
 * partie privée avec un code de session, salon d'attente, choix de la loi, puis la partie.
 * Le réseau et les manches sont dans multi.js. */
(function () {
  'use strict';
  const O = window.__orbite, MP = window.OrbiteMulti, ON = window.OrbiteOnline, K = window.OrbiteClassement;
  if (!O || !MP || !ON) return;
  const A = O.api, R = O.rules, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const { esc } = A;
  const st = { busy: false, law: null, lawTimer: 0, lawEnd: 0, view: 'menu', tick: 0, invite: null, target: null, pick: new Set() };
  const INVITE_KEY = 'orbite.invite';
  const dropInvite = () => { st.invite = null; try { sessionStorage.removeItem(INVITE_KEY); } catch (err) { /* sans importance */ } };
  // Le lien d'invitation : la page du jeu, avec le code de la partie après #rejoindre=.
  const inviteUrl = (code) => location.origin + location.pathname + '#rejoindre=' + code;

  function myRank() {
    try {
      const c = K.sanitize(JSON.parse(localStorage.getItem('orbite.classe') || 'null'));
      return K.placed(c) ? K.tierOf(c.points).label + ' · ' + c.points + ' pts' : tr('placement en cours');
    } catch (err) { return tr('placement en cours'); }
  }

  // Présence d'un ami : en ligne (vu il y a moins de 3 min), en partie, ou hors ligne.
  function presenceOf(p) {
    if (!p || !p.seen || Date.now() - p.seen >= 180000) return { cls: 'off', txt: tr('Hors ligne'), rank: 2 };
    if (p.where === 'multi' || p.where === 'game') return { cls: 'play', txt: tr('En partie'), rank: 1 };
    return { cls: 'on', txt: tr('En ligne'), rank: 0 };
  }
  // Défi lancé depuis la liste d'amis : il reste publié tant que notre salon attend l'ami.
  // Partie entre amis (v93) : tant que le salon attend, sa présence annonce les invitations.
  function syncInvite() {
    const m = MP.state.match;
    const open = m && m.status === 'waiting' && m.mode === 'private' && m.host === ON.uid() && m.uids.length < MP.seatsOf(m);
    const live = open && st.target;
    const group = open && !live && MP.seatsOf(m) > 2 && Array.isArray(m.invited) && m.invited.length > 0;
    if (group && ON.setGroupInvite) ON.setGroupInvite(m.code, m.invited.length);
    else if (ON.setInvite) ON.setInvite(live ? m.code : '', live ? st.target.code : '');
    // Le salon vient d'être créé et pas encore reçu : le défi attend ; il tombe quand la partie commence.
    if (!MP.state.mid || (m && m.status !== 'waiting')) st.target = null;
  }

  // Ne redessine que si le contenu change (la saisie du code n'est pas effacée).
  function render() {
    syncInvite();
    const box = $('mpBody');
    if (!box) return;
    const typed = $('mpCode') ? $('mpCode').value : '';
    // Le message en cours d'écriture survit aux nouveaux messages reçus.
    const chatIn = box.querySelector('.chat-input'), said = chatIn ? chatIn.value : '', focused = chatIn && document.activeElement === chatIn;
    const shadow = { set innerHTML(h) {
      if (h === st.last) return;
      st.last = h;
      box.innerHTML = h;
      if ($('mpCode') && typed) $('mpCode').value = typed;
      const c = box.querySelector('.chat-input');
      if (c && said) c.value = said;
      if (c && focused) c.focus();
      if (window.OrbiteChat) window.OrbiteChat.scrollDown();
    } };
    draw(shadow);
    // Invitation reçue par lien : une fois connecté et la progression en ligne réglée (sa récupération
    // recharge la page), on rejoint la partie de son ami tout seul. Le code ne quitte la session
    // qu'après la tentative : un rechargement en route la relance (rejoindre deux fois ne fait rien).
    if (st.invite && ON.configured && ON.uid() && ON.state.synced && !ON.state.conflict && !MP.state.match && !st.busy) {
      const code = st.invite;
      st.invite = null;
      act('join', { dataset: { code } }).then(dropInvite);
    }
  }
  function draw(box) {
    const m = MP.state.match;
    if (!ON.configured) { box.innerHTML = `<p class="mp-note">${tr('Le jeu en ligne n’est pas configuré sur cette version.')}</p>`; return; }
    if (!ON.uid()) {
      const loading = ON.state.status === 'loading';
      const inv = st.invite ? `<p class="mp-invite">${tr('Invitation reçue : connectez-vous pour rejoindre la partie {c}.', { c: `<b>${esc(st.invite)}</b>` })}</p>` : '';
      box.innerHTML = `<div class="mp-card"><b>${tr('JOUER EN LIGNE')}</b>${inv}<p>${tr('Connectez-vous avec votre compte Google pour affronter d’autres créateurs et jouer avec vos amis.')}</p>
        <button class="btn primary" data-mp="signin" ${loading ? 'disabled' : ''}>${loading ? tr('CONNEXION…') : tr('SE CONNECTER AVEC GOOGLE')}</button></div>`;
      return;
    }
    if (m && m.status === 'playing' && !(O.ui.state && O.ui.state.mp && O.ui.state.mp.mid === m.id)) { renderLaws(box); return; }
    if (m && m.status === 'waiting') { renderLobby(box, m); return; }
    const off = st.busy ? 'disabled' : '';
    if (st.view === 'friends') { renderFriends(box, off); return; }
    const inv = ON.invites ? ON.invites() : [];
    box.innerHTML = `
      ${inv.length ? `<div class="mp-card mp-defis"><b>${tr('DÉFIS REÇUS')}</b>${inv.map((x) => `<div class="mp-defi"><span>${inviteText(x)}</span><button class="btn primary" data-mp="join" data-code="${esc(x.code)}" ${off}>${tr('REJOINDRE')}</button></div>`).join('')}</div>` : ''}
      <div class="mp-card"><b>${tr('ENTRE AMIS')}</b>
        <button class="btn primary" data-mp="friends" ${off}>${tr('DÉFIER DES AMIS')}</button></div>
      <div class="mp-card"><b>${tr('DUEL EN LIGNE')}</b>
        <p>${tr('Un contre un, face à un créateur de votre rang. Personne au bout de 40 s ? Un univers rival prend la place.')}</p>
        <small class="mp-rank">${tr('Votre rang : {r}', { r: esc(myRank()) })}</small>
        <button class="btn primary" data-mp="ranked" data-size="2" ${off}>${tr('RECHERCHER UN DUEL')}</button></div>
      <div class="mp-card"><b>${tr('MÊLÉE À 8 EN LIGNE')}</b>
        <p>${tr('Affrontez des créateurs de votre rang. Les places libres sont tenues par des univers rivaux.')}</p>
        <button class="btn" data-mp="ranked" data-size="8" ${off}>${tr('RECHERCHER UNE MÊLÉE')}</button>
        <button class="btn" data-mp="create" data-size="8" ${off}>${tr('CRÉER UNE MÊLÉE PRIVÉE')}</button></div>
      <div class="mp-card"><b>${tr('REJOINDRE UN AMI')}</b>
        <p>${tr('Saisissez le code de sa partie. Les parties privées ne comptent pas pour le classement.')}</p>
        <div class="mp-join"><input class="code-input" id="mpCode" maxlength="7" placeholder="${tr('CODE')}" autocomplete="off" spellcheck="false" value="${esc(st.prefill || '')}">
        <button class="btn" data-mp="join" ${off}>${tr('REJOINDRE')}</button></div></div>`;
  }
  // Défier un ami : sa liste d'amis, ceux en ligne d'abord. Le lien reste possible pour les autres.
  const friendsSorted = () => (ON.friendProfiles ? ON.friendProfiles() : []).map((p) => ({ p, pr: presenceOf(p) }))
    .sort((a, b) => a.pr.rank - b.pr.rank || String(a.p.pseudo || '').localeCompare(String(b.p.pseudo || '')));
  const codeOfFriend = (p) => String(p.code || ON.codeOf(p.uid));
  // Le pseudo d'un ami dans sa police (v96).
  const pseudoOf = (p) => (A.nameHtml ? A.nameHtml(p.pseudo || tr('Créateur'), A.fontOf(p)) : esc(p.pseudo || tr('Créateur')));
  const friendRow = (p, pr, act, label, on, off) => `<button class="mp-friend ${on ? 'on' : ''}" data-mp="${act}" data-uid="${esc(p.uid)}" ${off}>
      <i class="on-dot ${pr.cls}"></i><span><b>${pseudoOf(p)}<small>#${esc(p.tag || '')}</small></b><small>${esc(pr.txt)} · ${tr('Niveau {n}', { n: p.level || 1 })}</small></span>
      <em>${label}</em></button>`;
  // Défier des amis (v93) : on en coche un ou plusieurs. Un ami : un duel ; plusieurs : une partie
  // entre amis (8 joueurs au plus). Le lien reste possible pour les autres.
  function renderFriends(box, off) {
    const list = friendsSorted();
    for (const uid of [...st.pick]) if (!list.some((x) => x.p.uid === uid)) st.pick.delete(uid);
    const rows = list.map(({ p, pr }) => friendRow(p, pr, 'pick', st.pick.has(p.uid) ? '✓' : '+', st.pick.has(p.uid), off)).join('');
    const empty = ON.friendsReady && !ON.friendsReady() ? `<p class="muted">${tr('Chargement…')}</p>`
      : `<p class="muted">${tr('Aucun ami pour l’instant. Ajoutez-en dans Profil → Amis avec leur code ami.')}</p>`;
    const n = st.pick.size;
    const go = n === 0 ? tr('CHOISISSEZ DES AMIS') : n === 1 ? tr('DUEL') : tr('PARTIE À {n} JOUEURS', { n: Math.min(8, n + 1) });
    box.innerHTML = `<div class="mp-card"><b>${tr('DÉFIER DES AMIS')}</b></div>
      <div class="mp-friends">${rows || empty}</div>
      <button class="btn primary" data-mp="inviteGo" ${n && !st.busy ? '' : 'disabled'}>${go}</button>
      <div class="sheet-actions"><button class="btn" data-mp="create" data-size="2" ${off}>${tr('PAR UN LIEN')}</button>
      <button class="btn" data-mp="menu">${tr('RETOUR')}</button></div>`;
  }
  const inviteText = (x) => {
    const f = friendOf(x.uid), name = `<b>${f ? pseudoOf(f) : esc(x.name)}</b>`;
    return x.group ? tr('{name} vous invite dans sa partie entre amis !', { name }) : tr('{name} vous défie en duel !', { name });
  };
  function renderLobby(box, m) {
    const host = m.host === ON.uid();
    const left = Math.max(0, Math.ceil((m.created + MP.WAIT_MS - Date.now()) / 1000));
    const n = MP.seatsOf(m), duel = n === 2;
    // Partie privée : les places des bots choisis par l'hôte suivent celles des joueurs.
    const nBots = m.mode === 'private' && !duel ? MP.botsOf(m) : 0;
    const seats = Array.from({ length: n }, (_, i) => {
      const s = m.seats[i];
      // Chaque créateur avec sa photo, son cadre et la police de son pseudo (v96).
      const lk = s && A.seatLook ? A.seatLook(s) : null;
      return s ? `<div class="mp-seat on">${lk ? A.framed(`<span class="orb" data-planet="${lk.avatar}"></span>`, lk.frame) : ''}<span class="mp-seat-txt"><b>${A.nameHtml ? A.nameHtml(s.name, lk && lk.font) : esc(s.name)}</b><small>${s.uid === ON.uid() ? tr('vous') : s.uid === m.host ? tr('hôte') : ''} ${s.points ? s.points + ' pts' : ''}</small></span></div>`
        : i < m.seats.length + nBots ? `<div class="mp-seat bot"><b>${tr('BOT')}</b><small>${tr('univers rival')}</small></div>`
        : `<div class="mp-seat"><b>…</b><small>${m.mode === 'ranked' ? tr('en recherche') : tr('place libre')}</small></div>`;
    }).join('');
    const head = m.mode === 'ranked'
      ? duel
        ? `<b>${tr('RECHERCHE D’UN RIVAL')}</b><p>${left > 0 ? tr('Si personne n’arrive dans {n} s, un univers rival prend la place.', { n: left }) : tr('La partie commence…')}</p>`
        : `<b>${tr('RECHERCHE DE CRÉATEURS')}</b><p>${left > 0 ? tr('Les places restantes seront tenues par des univers rivaux dans {n} s.', { n: left }) : tr('La partie commence…')}</p>`
      : host && st.target && m.uids.length < n
        ? `<b>${tr('DÉFI ENVOYÉ')}</b><p>${tr('Votre défi s’affiche dans le jeu de {name}. Lancez la partie dès son arrivée.', { name: `<b>${esc(st.target.name)}</b>` })}</p>
           ${presenceOf(friendOf(st.target.uid)).cls === 'off' ? `<p class="muted">${tr('Hors ligne pour le moment : envoyez aussi le lien.')}</p>` : ''}
           <button class="btn" data-mp="share">${tr('ENVOYER AUSSI LE LIEN')}</button>`
      : host && duel && m.uids.length >= n
        ? `<b>${tr('DUEL ENTRE AMIS')}</b><p>${tr('{name} est là : lancez la partie !', { name: `<b>${esc((m.seats.find((x) => x.uid !== ON.uid()) || {}).name || '')}</b>` })}</p>`
      : !host
        // L'invité attend : c'est l'hôte qui lance.
        ? `<b>${duel ? tr('DUEL ENTRE AMIS') : tr('CODE DE SESSION')}</b><div class="mp-code">${esc(m.code)}</div><p>${tr('En attente : {name} lance la partie.', { name: esc((m.seats.find((x) => x.uid === m.host) || {}).name || tr('l’hôte')) })}</p>`
        : `<b>${duel ? tr('DUEL ENTRE AMIS') : tr('CODE DE SESSION')}</b><div class="mp-code">${esc(m.code)}</div><p>${duel ? tr('Envoyez le lien à votre ami : il ouvre le jeu directement dans votre partie. Il peut aussi saisir le code dans Multijoueur → Rejoindre un ami.') : tr('Ou partagez ce code avec vos amis.')}</p>
         <button class="btn" data-mp="share">${tr('ENVOYER LE LIEN')}</button>`;
    // Partie entre amis à plusieurs : l'hôte invite depuis sa liste d'amis et choisit combien de bots
    // (univers rivaux) complètent la table ; les amis qui arrivent passent avant les bots.
    const group = host && m.mode === 'private' && !duel;
    const free = MP.SEATS - m.uids.length, total = m.uids.length + nBots;
    const invited = Array.isArray(m.invited) ? m.invited : [];
    const friends = group ? friendsSorted().map(({ p, pr }) => {
      const here = m.uids.includes(p.uid), sent = invited.includes(codeOfFriend(p));
      return friendRow(p, pr, here || sent ? 'noop' : 'invite', here ? tr('LÀ') : sent ? tr('INVITÉ') : tr('INVITER'), here || sent, m.uids.length >= n ? 'disabled' : '');
    }).join('') : '';
    const startLabel = group ? tr('LANCER · {n} JOUEURS', { n: total }) : `${tr('LANCER LA PARTIE')} · ${m.uids.length}/${n}`;
    box.innerHTML = `<div class="mp-card">${head}</div>
      <div class="mp-seats">${seats}</div>
      ${group ? `<div class="mp-bots"><span>${tr('BOTS')}<small>${tr('univers rivaux')}</small></span>
          <button class="btn" data-mp="botsDown" ${nBots <= 0 ? 'disabled' : ''} aria-label="−">−</button><b>${nBots}</b>
          <button class="btn" data-mp="botsUp" ${nBots >= free ? 'disabled' : ''} aria-label="+">+</button></div>
        ${friends ? `<div class="mp-card mp-invites"><b>${tr('INVITER DES AMIS')}</b><div class="mp-friends">${friends}</div></div>` : ''}` : ''}
      <div class="sheet-actions">${host && m.mode === 'private' ? `<button class="btn primary" data-mp="start" ${group && total < 2 ? 'disabled' : ''}>${startLabel}</button>` : ''}
      <button class="btn" data-mp="leave">${tr('QUITTER')}</button></div>
      ${window.OrbiteChat ? `<div class="mp-card"><b>${tr('DISCUSSION')}</b>${window.OrbiteChat.html(20)}</div>` : ''}`;
  }
  // Choix de la loi : trois lois parmi les familles de la partie, avec la forme de leur énergie comme
  // en solo ; 20 s pour choisir. La liste n'est dessinée qu'une fois : ensuite, seuls le compte à
  // rebours et la loi choisie changent (les formes animées ne repartent pas de zéro).
  function renderLaws(box) {
    // Même échéance pour tous : l'heure du lancement par l'hôte + 20 s.
    if (!st.lawEnd) { st.lawEnd = (MP.state.match.startAt || Date.now()) + MP.LAW_MS; st.law = null; SFX.level(); }
    const left = Math.max(0, Math.ceil((st.lawEnd - Date.now()) / 1000));
    const body = $('mpBody'), list = body.querySelector('.mp-laws');
    if (list && list.dataset.mid === String(MP.state.mid)) {
      body.querySelector('[data-law-left]').textContent = tr('Choisissez votre loi · {n} s', { n: left });
      for (const b of list.querySelectorAll('.mp-law')) b.classList.toggle('on', b.dataset.law === st.law);
      body.querySelector('[data-mp="go"]').disabled = !st.law;
    } else {
      box.innerHTML = `<div class="mp-card"><b>${tr('LA PARTIE COMMENCE')}</b><p data-law-left>${tr('Choisissez votre loi · {n} s', { n: left })}</p></div>
        <div class="mp-laws" data-mid="${esc(MP.state.mid)}">${MP.lawChoices().map((id) => {
          const l = R.LAW[id], f = R.FAMILIES[l.fam];
          return `<button class="mp-law ${st.law === id ? 'on' : ''}" data-mp="law" data-law="${id}" style="--c:${f.color}">
            <canvas class="sphere" data-fam="${l.fam}" aria-hidden="true"></canvas>
            <span class="mp-law-txt"><span class="fam-chip">${l.fam === 'neutre' ? tr('POINTS DE VIE') : esc(f.name.toUpperCase())}</span><b>${esc(l.name)}</b><small>${esc(l.text)}</small></span></button>`;
        }).join('')}</div>
        <button class="btn primary" data-mp="go" ${st.law ? '' : 'disabled'}>${tr('PRÊT')}</button>`;
      A.mountEnergy(body);
    }
    if (left <= 0) begin(st.law || MP.lawChoices()[0]);
  }
  async function begin(law) {
    if (O.ui.state && O.ui.state.mp && O.ui.state.mp.mid === MP.state.mid) return;
    st.lawEnd = 0;
    clearInterval(st.tick);
    O.ui.state = MP.newState(law);
    O.ui.stamp = (O.ui.stamp || 0) + 1;
    await O.show('game');
    O.renderGame(true);
    A.banner(tr('CYCLE {n}', { n: 1 }), tr('Partie en ligne : achetez vos astres avant la fin du temps.'));
    MP.startRound();
  }

  const friendOf = (uid) => (ON.friendProfiles ? ON.friendProfiles().find((p) => p.uid === uid) : null) || null;

  async function act(k, b) {
    if (st.busy && k !== 'leave') return;
    SFX.tap();
    try {
      if (k === 'signin') { await ON.signIn(); }
      else if (k === 'ranked') { st.busy = true; render(); await MP.searchRanked(Number(b.dataset.size)); }
      else if (k === 'create') { st.target = null; st.view = 'menu'; st.busy = true; render(); await MP.createPrivate(Number(b.dataset.size)); }
      else if (k === 'friends') { st.view = 'friends'; st.pick.clear(); }
      else if (k === 'pick') { const u = b.dataset.uid; if (st.pick.has(u)) st.pick.delete(u); else if (st.pick.size < 7) st.pick.add(u); }
      else if (k === 'inviteGo') {
        const picked = [...st.pick].map(friendOf).filter(Boolean);
        if (!picked.length) return;
        if (picked.length === 1) { st.pick.clear(); st.busy = false; return act('challenge', { dataset: { uid: picked[0].uid } }); }
        st.busy = true;
        render();
        if (MP.state.match && MP.state.match.status === 'waiting') await MP.leave();
        await MP.createPrivate(8);
        await MP.setBots(0);
        await MP.invite(picked.map(codeOfFriend));
        st.target = null;
        st.pick.clear();
        st.view = 'menu';
      }
      else if (k === 'invite') { const p = friendOf(b.dataset.uid); if (p) await MP.invite([codeOfFriend(p)]); }
      else if (k === 'botsUp' || k === 'botsDown') { const m = MP.state.match; if (m) await MP.setBots(MP.botsOf(m) + (k === 'botsUp' ? 1 : -1)); }
      else if (k === 'noop') { return; }
      else if (k === 'menu') { st.view = 'menu'; }
      else if (k === 'challenge') {
        const p = friendOf(b.dataset.uid);
        if (!p) return;
        st.busy = true;
        render();
        if (MP.state.match && MP.state.match.status === 'waiting') await MP.leave();
        await MP.createPrivate(2);
        st.target = { uid: p.uid, code: String(p.code || ON.codeOf(p.uid)), name: String(p.pseudo || tr('Créateur')) };
        st.view = 'menu';
      }
      else if (k === 'join') { st.view = 'menu'; st.busy = true; render(); await MP.joinCode(b.dataset.code || ($('mpCode') ? $('mpCode').value : '')); }
      else if (k === 'start') { await MP.start(); }
      else if (k === 'leave') { st.target = null; await MP.leave(); }
      else if (k === 'share') {
        const code = MP.state.match.code, url = inviteUrl(code), text = tr('Rejoins ma partie ORBITE avec le code {c}', { c: code });
        if (navigator.share) navigator.share({ title: 'ORBITE', text, url }).catch(() => {});
        else if (navigator.clipboard) { await navigator.clipboard.writeText(text + ' ' + url); A.toast(tr('Lien copié.')); }
      }
      else if (k === 'law') { st.law = b.dataset.law; if (window.OrbiteEnergy) window.OrbiteEnergy.pulse(b.querySelector('canvas.sphere')); }
      else if (k === 'go') { if (st.law) await begin(st.law); return; }
    } catch (err) {
      const denied = err && (err.code === 'permission-denied' || /permission/i.test(err.message || ''));
      A.refuse(denied ? tr('Le serveur n’autorise pas encore les parties en ligne : réessayez plus tard.') : err && err.message ? err.message : tr('Connexion impossible.'));
      // Invitation qui n'aboutit pas (partie lancée, code périmé) : le code reste affiché.
      if (k === 'join' && b.dataset.code) st.prefill = b.dataset.code;
    }
    st.busy = false;
    render();
  }

  async function open(opts) {
    if (opts && opts.code) { st.invite = String(opts.code).toUpperCase(); st.prefill = st.invite; }
    // Une partie en ligne terminée : on libère le salon avant d'en chercher un autre.
    const s = O.ui.state;
    if (MP.state.mid && (!s || !s.mp || s.over)) await MP.leave();
    await O.show('multi');
    if (ON.configured && !ON.uid()) ON.boot();
    render();
    clearInterval(st.tick);
    st.tick = setInterval(() => { if (document.getElementById('multi').classList.contains('active')) render(); }, 1000);
  }

  $('multiBack').innerHTML = A.icon('back');
  $('multiBack').addEventListener('click', async () => {
    SFX.tap();
    clearInterval(st.tick);
    st.target = null;
    st.view = 'menu';
    if (MP.state.match && MP.state.match.status === 'waiting') await MP.leave();
    syncInvite();
    await O.api.backToMenu();
  });
  $('mpBody').addEventListener('click', (e) => { const b = e.target.closest('[data-mp]'); if (b && !b.disabled) act(b.dataset.mp, b); });
  MP.state.onChange = () => { if (document.getElementById('multi').classList.contains('active')) render(); };
  MP.state.onStart = () => { if (document.getElementById('multi').classList.contains('active')) render(); };
  ON.on(() => { if (document.getElementById('multi').classList.contains('active')) render(); });
  window.addEventListener('orbite-friends', () => { if (document.getElementById('multi').classList.contains('active')) render(); popInvites(); popOnline(); });

  // ─── Un ami se connecte (v94) : une petite bulle, avec DÉFIER ───
  // On compare la présence d'avant (vu il y a plus de 3 min = hors ligne) à la nouvelle. Les amis
  // déjà en ligne quand la liste arrive ne s'annoncent pas.
  const lastSeen = {};
  function popOnline() {
    const s = O.ui.state, now = Date.now();
    for (const p of ON.friendProfiles ? ON.friendProfiles() : []) {
      const prev = lastSeen[p.uid];
      lastSeen[p.uid] = p.seen || 0;
      if (prev === undefined || !p.seen || p.seen === prev) continue;
      const was = now - prev < 180000, is = now - p.seen < 180000;
      if (was || !is) continue;
      // Pas pendant une partie en ligne : on ne la dérange pas.
      if (O.ui.screen === 'game' && s && s.mp && !s.over) continue;
      const d = document.createElement('div');
      d.className = 'ami-pop';
      d.innerHTML = `<i class="on-dot on"></i><span>${tr('{name} vient de se connecter', { name: `<b>${pseudoOf(p)}</b>` })}</span><button class="btn" data-ami="${esc(p.uid)}">${tr('DÉFIER')}</button>`;
      pops.appendChild(d);
      SFX.on();
      setTimeout(() => d.classList.add('out'), 5500);
      setTimeout(() => d.remove(), 6000);
    }
  }

  // ─── Défi reçu : une bulle en haut de l'écran, où que l'on soit (sauf en pleine partie en ligne) ───
  const pops = document.createElement('div');
  pops.className = 'defi-pops';
  document.body.appendChild(pops);
  const shown = new Set();
  function popInvites() {
    const inv = ON.invites ? ON.invites() : [];
    const m = MP.state.match;
    const codes = new Set(inv.map((x) => x.code));
    // Défi retiré (l'ami a quitté son salon) ou rejoint : la bulle s'en va.
    for (const el of [...pops.children]) if (!codes.has(el.dataset.code) || (m && m.code === el.dataset.code)) el.remove();
    const s = O.ui.state;
    if (O.ui.screen === 'game' && s && s.mp && !s.over) return;
    for (const x of inv) {
      if (shown.has(x.code) || (m && m.code === x.code)) continue;
      shown.add(x.code);
      const d = document.createElement('div');
      d.className = 'defi-pop';
      d.dataset.code = x.code;
      d.innerHTML = `<span class="defi-txt">${inviteText(x)}</span>
        <button class="btn primary" data-defi="join">${tr('REJOINDRE')}</button><button class="btn ghost" data-defi="no" aria-label="${tr('Fermer')}">×</button>`;
      pops.appendChild(d);
      SFX.level();
      if (navigator.vibrate) try { navigator.vibrate([30, 60, 30]); } catch (err) { /* sans importance */ }
    }
  }
  pops.addEventListener('click', async (e) => {
    const ami = e.target.closest('[data-ami]');
    if (ami) { ami.closest('.ami-pop').remove(); SFX.tap(); await challenge(ami.dataset.ami); return; }
    const b = e.target.closest('[data-defi]');
    if (!b) return;
    const el = b.closest('.defi-pop'), code = el.dataset.code;
    el.remove();
    SFX.tap();
    if (b.dataset.defi !== 'join') return;
    // Déjà dans un autre salon en attente : on le quitte pour rejoindre l'ami.
    if (MP.state.match && MP.state.match.status === 'waiting' && MP.state.match.code !== code) await MP.leave();
    await open({ code });
  });
  // Les défis expirent sans prévenir (ami parti, appli fermée) : on revérifie de temps en temps.
  setInterval(popInvites, 10000);

  // Défier un ami depuis le Profil (onglet Amis).
  async function challenge(friendUid) {
    await open();
    if (friendOf(friendUid)) await act('challenge', { dataset: { uid: friendUid } });
    else { st.view = 'friends'; render(); }
  }

  window.OrbiteMultiUI = { open, render, challenge };
})();
