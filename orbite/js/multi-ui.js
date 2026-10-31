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
  const st = { busy: false, law: null, lawTimer: 0, lawEnd: 0, view: 'menu', tick: 0, invite: null, target: null, pick: new Set(), search: null };
  // TROUVER UNE PARTIE (v128) : duel (2) ou mêlée (8), le dernier choix est retenu.
  const SIZE_KEY = 'orbite.trouver';
  const findSize = () => { try { return localStorage.getItem(SIZE_KEY) === '8' ? 8 : 2; } catch (err) { return 2; } };
  const setFindSize = (n) => { try { localStorage.setItem(SIZE_KEY, String(n === 8 ? 8 : 2)); } catch (err) { /* sans importance */ } };
  const E = window.OrbiteEmbleme;
  const emb = (p, cls) => (A.emblem ? A.emblem(p, cls) : '');
  const myEmb = (cls) => (A.myEmblem ? A.myEmblem(cls) : '');
  const INVITE_KEY = 'orbite.invite';
  const dropInvite = () => { st.invite = null; try { sessionStorage.removeItem(INVITE_KEY); } catch (err) { /* sans importance */ } };
  // Le lien d'invitation : la page du jeu, avec le code de la partie après #rejoindre=.
  const inviteUrl = (code) => location.origin + location.pathname + '#rejoindre=' + code;

  function myClasse() { try { return K.sanitize(JSON.parse(localStorage.getItem('orbite.classe') || 'null')); } catch (err) { return K.fresh(); } }
  // Son rang en deux lignes : le nom (Lune II) et le détail (412 pts · 12 / 100), ou le placement.
  function myRankLines() {
    const c = myClasse();
    if (!K.placed(c)) return { name: tr('PLACEMENT {a} / {b}', { a: c.placements.length, b: K.PLACEMENTS }), more: tr('Votre rang après {n} parties classées.', { n: K.PLACEMENTS }) };
    const t = K.tierOf(c.points);
    return { name: (A.tierLabel ? A.tierLabel(t) : t.label).toUpperCase(), more: tr('{n} pts', { n: c.points }) + (t.span ? ' · ' + tr('{a} / {b} vers la division suivante', { a: t.into, b: t.span }) : '') };
  }
  // Le rang d'une place au salon : son nom, ou « placement » (anciennes versions : ses points).
  function seatRank(s) {
    if (!E) return s.points ? tr('{n} pts', { n: s.points }) : '';
    const i = E.infoOf(s);
    return i.placed ? (A.tierLabel ? A.tierLabel(K.tierOf(i.points)) : i.label) : i.known ? tr('placement') : '';
  }
  const myPseudo = () => { try { return String(localStorage.getItem('orbite.pseudo') || tr('Créateur')).slice(0, 16); } catch (err) { return tr('Créateur'); } };
  const timeTxt = (ms) => { const n = Math.max(0, Math.floor(ms / 1000)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

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
    // Pendant le trou noir de l'entrée en partie (v109), l'écran aspiré ne se redessine plus.
    if (st.entering) return;
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
    if (m && m.status === 'playing' && !(O.ui.state && O.ui.state.mp && O.ui.state.mp.mid === m.id)) { st.search = null; renderLaws(box); return; }
    // Recherche classée : l'écran d'attente, du clic sur TROUVER UNE PARTIE au lancement.
    if (m && m.status === 'waiting' && m.mode === 'ranked') { renderSearch(box, m); return; }
    if (!m && st.search) { renderSearch(box, null); return; }
    if (m && m.status === 'waiting') { renderLobby(box, m); return; }
    const off = st.busy ? 'disabled' : '';
    if (st.view === 'friends') { renderFriends(box, off); return; }
    const inv = ON.invites ? ON.invites() : [];
    const size = findSize(), rk = myRankLines();
    const mode = (n, name, sub) => `<button class="mpf-mode ${size === n ? 'on' : ''}" data-mp="mode" data-size="${n}" role="radio" aria-checked="${size === n}" ${off}><b>${name}</b><small>${sub}</small></button>`;
    box.innerHTML = `
      <div class="mp-find">
        <div class="mpf-rank">${myEmb('mpf-emb')}<span class="mpf-rank-txt"><small>${tr('VOTRE RANG')}</small><b>${esc(rk.name)}</b><small>${esc(rk.more)}</small></span></div>
        <div class="mpf-play">
          <div class="mpf-modes" role="radiogroup" aria-label="${tr('Mode de jeu')}">${mode(2, tr('DUEL'), tr('1 CONTRE 1'))}${mode(8, tr('MÊLÉE'), tr('À 8 JOUEURS'))}</div>
          <button class="btn primary mpf-go" data-mp="find" ${off}><b>${tr('TROUVER UNE PARTIE')}</b><small>${size === 2 ? tr('DUEL CLASSÉ') : tr('MÊLÉE CLASSÉE')}</small></button>
          <p class="mpf-note">${tr('Face à des créateurs de votre rang. Personne au bout de 40 s ? Des univers rivaux complètent la table.')}</p>
        </div>
      </div>
      ${inv.length ? `<div class="mp-card mp-defis"><b>${tr('DÉFIS REÇUS')}</b>${inv.map((x) => `<div class="mp-defi"><span>${inviteText(x)}</span><button class="btn primary" data-mp="join" data-code="${esc(x.code)}" ${off}>${tr('REJOINDRE')}</button></div>`).join('')}</div>` : ''}
      <div class="mp-card mp-amis"><b>${tr('ENTRE AMIS')}</b>
        <p>${tr('Classé aussi entre amis, dès 2 joueurs humains. Seul face aux bots, la partie ne compte pas.')}</p>
        <div class="mp-amis-row">
          <button class="btn" data-mp="friends" ${off}>${tr('DÉFIER DES AMIS')}</button>
          <button class="btn" data-mp="create" data-size="8" ${off}>${tr('CRÉER UNE MÊLÉE PRIVÉE')}</button>
          <div class="mp-join"><input class="code-input" id="mpCode" maxlength="7" placeholder="${tr('CODE')}" autocomplete="off" spellcheck="false" value="${esc(st.prefill || '')}" aria-label="${tr('Code de sa partie')}">
          <button class="btn" data-mp="join" ${off}>${tr('REJOINDRE')}</button></div>
        </div></div>`;
  }
  // ─── Écran de recherche (v128) ──────────────────────────────
  // Le temps écoulé, son emblème au centre d'un radar, les joueurs trouvés (places remplies / total,
  // avec pseudo et emblème), le compte à rebours avant que des univers rivaux complètent, les rangs
  // acceptés (la tolérance s'élargit d'un rang toutes les 10 s), et ANNULER. Le contenu n'est
  // redessiné que s'il change (joueurs, messages) : sinon seuls les chiffres bougent, et le radar
  // tourne sans à-coups.
  function searchFacts(m) {
    const now = Date.now(), at = (st.search && st.search.at) || MP.state.searchStart || now;
    const n = m ? MP.seatsOf(m) : (st.search && st.search.size) || 2;
    const left = m ? Math.max(0, Math.ceil((m.created + MP.WAIT_MS - now) / 1000)) : Math.ceil(MP.WAIT_MS / 1000);
    const full = !!m && m.uids.length >= n;
    const note = !m ? tr('Connexion au serveur…')
      : full ? tr('Table complète : la partie commence…')
      : left > 0 ? (n === 2 ? tr('Personne dans {n} s ? Un univers rival prend la place.', { n: left }) : tr('Places libres dans {n} s ? Des univers rivaux complètent la table.', { n: left }))
      : tr('La partie commence…');
    // Rangs acceptés : le sien ± un rang par tranche de 10 s d'attente.
    const c = myClasse(), b = K.tierOf(K.placed(c) ? c.points : 0).idx, spread = Math.min(9, Math.floor((now - at) / 10000));
    const lo = Math.max(0, b - spread), hi = Math.min(K.TIERS.length - 1, b + spread);
    const range = lo === hi ? tr('Rang recherché : {a}', { a: tr(K.TIERS[lo]) }) : tr('Rangs recherchés : {a} – {b}', { a: tr(K.TIERS[lo]), b: tr(K.TIERS[hi]) });
    return { time: timeTxt(now - at), note, range, found: tr('{a} / {b}', { a: m ? m.seats.length : 1, b: n }), n };
  }
  function renderSearch(box, m) {
    const f = searchFacts(m);
    const me = ON.uid();
    const seats = Array.from({ length: f.n }, (_, i) => {
      const s = m ? m.seats[i] : i === 0 ? { uid: me, name: myPseudo() } : null;
      if (!s) return `<div class="mps-seat"><span class="mps-wait" aria-hidden="true"></span><small>${tr('en recherche')}</small></div>`;
      const mine = s.uid === me;
      const lk = A.seatLook ? A.seatLook(s) : null;
      return `<div class="mps-seat on ${mine ? 'me' : ''}">${mine ? myEmb('mps-emb') : emb(s, 'mps-emb')}<b>${A.nameHtml ? A.nameHtml(s.name, lk && lk.font) : esc(s.name)}</b><small>${mine ? tr('vous') : esc(seatRank(s))}</small></div>`;
    }).join('');
    const chat = m && window.OrbiteChat ? `<div class="mp-card mps-chat"><b>${tr('DISCUSSION')}</b>${window.OrbiteChat.html(20)}</div>` : '';
    // Clé du contenu : tout ce qui n'est pas un chiffre qui défile.
    const key = [f.n, m ? m.id : '', seats, chat].join('|');
    const body = $('mpBody'), cur = body && body.querySelector('.mp-search');
    if (cur && cur.dataset.key === String(hash(key))) {
      cur.querySelector('[data-mps-time]').textContent = f.time;
      cur.querySelector('[data-mps-note]').textContent = f.note;
      cur.querySelector('[data-mps-range]').textContent = f.range;
      cur.querySelector('[data-mps-found]').textContent = f.found;
      return;
    }
    const rk = myRankLines();
    // Deux moitiés : le temps et son rang (à gauche sur PC), les joueurs trouvés et ANNULER.
    box.innerHTML = `<div class="mp-search ${f.n === 2 ? 'duel' : 'melee'}" data-key="${hash(key)}">
        <div class="mps-side">
          <div class="mps-head"><small class="mps-kick">${f.n === 2 ? tr('DUEL CLASSÉ') : tr('MÊLÉE CLASSÉE')}</small>
            <b class="mps-title">${tr('RECHERCHE…')}</b>
            <span class="mps-time" data-mps-time>${f.time}</span></div>
          <div class="mps-radar" aria-hidden="true"><i class="mps-ring"></i><i class="mps-ring r2"></i><i class="mps-sweep"></i>${myEmb('mps-me')}</div>
          <div class="mps-rank"><b>${esc(rk.name)}</b><small data-mps-range>${f.range}</small></div>
        </div>
        <div class="mps-side">
          <div class="mps-found"><span>${tr('JOUEURS TROUVÉS')}</span><b data-mps-found>${f.found}</b></div>
          <div class="mps-seats">${seats}</div>
          <p class="mps-note" data-mps-note>${f.note}</p>
          <button class="btn mps-cancel" data-mp="cancel">${tr('ANNULER')}</button>
        </div>
      </div>${chat}`;
  }
  // Petite empreinte d'une chaîne (clé de contenu de l'écran de recherche).
  function hash(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
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
    const n = MP.seatsOf(m), duel = n === 2;
    // Partie privée : les places des bots choisis par l'hôte suivent celles des joueurs.
    const nBots = m.mode === 'private' && !duel ? MP.botsOf(m) : 0;
    const seats = Array.from({ length: n }, (_, i) => {
      const s = m.seats[i];
      // Chaque créateur avec sa photo, son cadre et la police de son pseudo (v96).
      const lk = s && A.seatLook ? A.seatLook(s) : null;
      // Et son emblème de rang (v128).
      const mine = s && s.uid === ON.uid();
      return s ? `<div class="mp-seat on">${lk ? A.framed(`<span class="orb" data-planet="${lk.avatar}"></span>`, lk.frame) : ''}<span class="mp-seat-txt"><b>${A.nameHtml ? A.nameHtml(s.name, lk && lk.font) : esc(s.name)}</b><small>${[mine ? tr('vous') : s.uid === m.host ? tr('hôte') : '', mine ? '' : esc(seatRank(s))].filter(Boolean).join(' · ')}</small></span>${mine ? myEmb('mp-seat-emb') : emb(s, 'mp-seat-emb')}</div>`
        : i < m.seats.length + nBots ? `<div class="mp-seat bot"><b>${tr('BOT')}</b><small>${tr('univers rival')}</small></div>`
        : `<div class="mp-seat"><b>…</b><small>${tr('place libre')}</small></div>`;
    }).join('');
    // (La recherche classée a son propre écran depuis la v128 : renderSearch.)
    const head = host && st.target && m.uids.length < n
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
    // Classé entre amis (v128) : dès 2 joueurs humains au salon (les bots ne comptent pas).
    const ranked = MP.rankedOf ? MP.rankedOf(m) : false;
    const rankBox = m.mode === 'private' ? `<div class="mp-ranked ${ranked ? 'on' : 'off'}">${ranked ? myEmb('mp-ranked-emb') : ''}<span><b>${ranked ? tr('PARTIE CLASSÉE') : tr('PAS ENCORE CLASSÉE')}</b><small>${ranked
      ? tr('Elle compte pour le classement de chaque joueur : points gagnés ou perdus selon la place.')
      : tr('Il faut au moins 2 joueurs humains : les bots ne comptent pas.')}</small></span></div>` : '';
    box.innerHTML = `<div class="mp-card">${head}${rankBox}</div>
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
    if (!st.lawEnd) { st.lawEnd = (MP.startBase ? MP.startBase() : (MP.state.match.startAt || Date.now())) + MP.LAW_MS; st.law = null; SFX.level(); }
    const left = Math.max(0, Math.ceil((st.lawEnd - Date.now()) / 1000));
    // Les 5 dernières secondes du choix : un tic d'horloge par seconde (v103).
    if (left > 0 && left <= 5 && st.lawTick !== left && !(O.ui.state && O.ui.state.mp && O.ui.state.mp.mid === MP.state.mid)) { st.lawTick = left; if (SFX && SFX.tick) SFX.tick(left); }
    const body = $('mpBody'), list = body.querySelector('.mp-laws');
    if (list && list.dataset.mid === String(MP.state.mid)) {
      body.querySelector('[data-law-left]').textContent = tr('Choisissez votre loi · {n} s', { n: left });
      for (const b of list.querySelectorAll('.mp-law')) b.classList.toggle('on', b.dataset.law === st.law);
      body.querySelector('[data-mp="go"]').disabled = !st.law;
    } else {
      const ranked = MP.rankedOf && MP.rankedOf(MP.state.match);
      box.innerHTML = `<div class="mp-card"><b>${tr('LA PARTIE COMMENCE')}${ranked ? ` <em class="mp-ranked-tag">${tr('PARTIE CLASSÉE')}</em>` : ''}</b><p data-law-left>${tr('Choisissez votre loi · {n} s', { n: left })}</p></div>
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
    st.entering = true;
    try { await O.portal(async () => { await O.show('game'); O.renderGame(true); }); } finally { st.entering = false; }
    A.banner(tr('CYCLE {n}', { n: 1 }), tr('Partie en ligne : achetez vos astres avant la fin du temps.'));
    MP.startRound();
  }

  const friendOf = (uid) => (ON.friendProfiles ? ON.friendProfiles().find((p) => p.uid === uid) : null) || null;

  async function act(k, b) {
    if (st.busy && k !== 'leave' && k !== 'cancel') return;
    SFX.tap();
    try {
      if (k === 'signin') { await ON.signIn(); }
      else if (k === 'mode') { setFindSize(Number(b.dataset.size)); }
      else if (k === 'find' || k === 'ranked') {
        const size = k === 'find' ? findSize() : Number(b.dataset.size) === 8 ? 8 : 2;
        st.search = { size, at: Date.now() };
        st.busy = true;
        render();
        await MP.searchRanked(size);
        if (MP.state.searchOff) st.search = null;
      }
      else if (k === 'cancel') { st.search = null; st.busy = false; await (MP.cancelSearch ? MP.cancelSearch() : MP.leave()); }
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
      else if (k === 'leave') { st.target = null; st.search = null; await (MP.cancelSearch ? MP.cancelSearch() : MP.leave()); }
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
      // Recherche impossible : retour au menu (le salon éventuellement ouvert est quitté).
      if (k === 'find' || k === 'ranked') { st.search = null; if (MP.cancelSearch) MP.cancelSearch().catch(() => {}); }
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
    // Revenir pendant une recherche l'annule (comme ANNULER).
    if (st.search || (MP.state.match && MP.state.match.status === 'waiting')) { st.search = null; await (MP.cancelSearch ? MP.cancelSearch() : MP.leave()); }
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
    let rang = false;
    for (const p of ON.friendProfiles ? ON.friendProfiles() : []) {
      const prev = lastSeen[p.uid];
      lastSeen[p.uid] = p.seen || 0;
      if (prev === undefined || !p.seen || p.seen === prev) continue;
      const was = now - prev < 180000, is = now - p.seen < 180000;
      if (was || !is) continue;
      // Pas pendant une partie en ligne : on ne la dérange pas.
      if ((O.ui.screen === 'game' || st.entering) && s && s.mp && !s.over) continue;
      const d = document.createElement('div');
      d.className = 'ami-pop';
      d.innerHTML = `<i class="on-dot on"></i><span>${tr('{name} vient de se connecter', { name: `<b>${pseudoOf(p)}</b>` })}</span><button class="btn" data-ami="${esc(p.uid)}">${tr('DÉFIER')}</button>`;
      pops.appendChild(d);
      // Un seul petit son, même si plusieurs amis arrivent en même temps.
      if (!rang) { rang = true; (SFX.friend || SFX.on)(); }
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
    if ((O.ui.screen === 'game' || st.entering) && s && s.mp && !s.over) return;
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
