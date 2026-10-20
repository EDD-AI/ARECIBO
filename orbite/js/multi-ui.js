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
  const st = { busy: false, law: null, lawTimer: 0, lawEnd: 0, view: 'menu', tick: 0 };

  function myRank() {
    try {
      const c = K.sanitize(JSON.parse(localStorage.getItem('orbite.classe') || 'null'));
      return K.placed(c) ? K.tierOf(c.points).label + ' · ' + c.points + ' pts' : tr('placement en cours');
    } catch (err) { return tr('placement en cours'); }
  }

  // Ne redessine que si le contenu change (la saisie du code n'est pas effacée).
  function render() {
    const box = $('mpBody');
    if (!box) return;
    const typed = $('mpCode') ? $('mpCode').value : '';
    const shadow = { set innerHTML(h) { if (h !== st.last) { st.last = h; box.innerHTML = h; if ($('mpCode') && typed) $('mpCode').value = typed; } } };
    draw(shadow);
  }
  function draw(box) {
    const m = MP.state.match;
    if (!ON.configured) { box.innerHTML = `<p class="mp-note">${tr('Le jeu en ligne n’est pas configuré sur cette version.')}</p>`; return; }
    if (!ON.uid()) {
      const loading = ON.state.status === 'loading';
      box.innerHTML = `<div class="mp-card"><b>${tr('JOUER EN LIGNE')}</b><p>${tr('Connectez-vous avec votre compte Google pour affronter d’autres créateurs et jouer avec vos amis.')}</p>
        <button class="btn primary" data-mp="signin" ${loading ? 'disabled' : ''}>${loading ? tr('CONNEXION…') : tr('SE CONNECTER AVEC GOOGLE')}</button></div>`;
      return;
    }
    if (m && m.status === 'playing' && !(O.ui.state && O.ui.state.mp && O.ui.state.mp.mid === m.id)) { renderLaws(box); return; }
    if (m && m.status === 'waiting') { renderLobby(box, m); return; }
    box.innerHTML = `
      <div class="mp-card"><b>${tr('PARTIE CLASSÉE')}</b>
        <p>${tr('Affrontez des créateurs de votre rang. Les places libres sont tenues par des univers rivaux.')}</p>
        <small class="mp-rank">${tr('Votre rang : {r}', { r: esc(myRank()) })}</small>
        <button class="btn primary" data-mp="ranked" ${st.busy ? 'disabled' : ''}>${tr('RECHERCHER UNE PARTIE')}</button></div>
      <div class="mp-card"><b>${tr('PARTIE PRIVÉE')}</b>
        <p>${tr('Créez une partie et donnez son code à vos amis. Elle ne compte pas pour le classement.')}</p>
        <button class="btn" data-mp="create" ${st.busy ? 'disabled' : ''}>${tr('CRÉER UNE PARTIE')}</button>
        <div class="mp-join"><input class="code-input" id="mpCode" maxlength="7" placeholder="${tr('CODE')}" autocomplete="off" spellcheck="false">
        <button class="btn" data-mp="join" ${st.busy ? 'disabled' : ''}>${tr('REJOINDRE')}</button></div></div>`;
  }
  function renderLobby(box, m) {
    const host = m.host === ON.uid();
    const left = Math.max(0, Math.ceil((m.created + MP.WAIT_MS - Date.now()) / 1000));
    const seats = Array.from({ length: MP.SEATS }, (_, i) => {
      const s = m.seats[i];
      return s ? `<div class="mp-seat on"><b>${esc(s.name)}</b><small>${s.uid === ON.uid() ? tr('vous') : s.uid === m.host ? tr('hôte') : ''} ${s.points ? s.points + ' pts' : ''}</small></div>`
        : `<div class="mp-seat"><b>…</b><small>${m.mode === 'ranked' ? tr('en recherche') : tr('place libre')}</small></div>`;
    }).join('');
    const head = m.mode === 'ranked'
      ? `<b>${tr('RECHERCHE DE CRÉATEURS')}</b><p>${left > 0 ? tr('Les places restantes seront tenues par des univers rivaux dans {n} s.', { n: left }) : tr('La partie commence…')}</p>`
      : `<b>${tr('CODE DE SESSION')}</b><div class="mp-code">${esc(m.code)}</div><p>${tr('Vos amis le saisissent dans Multijoueur → Rejoindre. Les places libres seront tenues par des univers rivaux.')}</p>
         <button class="btn" data-mp="share">${tr('PARTAGER LE CODE')}</button>`;
    box.innerHTML = `<div class="mp-card">${head}</div>
      <div class="mp-seats">${seats}</div>
      <div class="sheet-actions">${host && m.mode === 'private' ? `<button class="btn primary" data-mp="start">${tr('LANCER LA PARTIE')} · ${m.uids.length}/${MP.SEATS}</button>` : ''}
      <button class="btn" data-mp="leave">${tr('QUITTER')}</button></div>`;
  }
  // Choix de la loi : trois lois parmi les familles de la partie ; 20 s pour choisir.
  function renderLaws(box) {
    // Même échéance pour tous : l'heure du lancement par l'hôte + 20 s.
    if (!st.lawEnd) { st.lawEnd = (MP.state.match.startAt || Date.now()) + MP.LAW_MS; st.law = null; SFX.level(); }
    const left = Math.max(0, Math.ceil((st.lawEnd - Date.now()) / 1000));
    box.innerHTML = `<div class="mp-card"><b>${tr('LA PARTIE COMMENCE')}</b><p>${tr('Choisissez votre loi · {n} s', { n: left })}</p></div>
      <div class="mp-laws">${MP.lawChoices().map((id) => {
        const l = R.LAW[id], f = R.FAMILIES[l.fam];
        return `<button class="mp-law ${st.law === id ? 'on' : ''}" data-mp="law" data-law="${id}" style="--c:${f.color}"><span class="fam-chip">${l.fam === 'neutre' ? tr('POINTS DE VIE') : esc(f.name.toUpperCase())}</span><b>${esc(l.name)}</b><small>${esc(l.text)}</small></button>`;
      }).join('')}</div>
      <button class="btn primary" data-mp="go" ${st.law ? '' : 'disabled'}>${tr('PRÊT')}</button>`;
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

  async function act(k, b) {
    if (st.busy && k !== 'leave') return;
    SFX.tap();
    try {
      if (k === 'signin') { await ON.signIn(); }
      else if (k === 'ranked') { st.busy = true; render(); await MP.searchRanked(); }
      else if (k === 'create') { st.busy = true; render(); await MP.createPrivate(); }
      else if (k === 'join') { st.busy = true; render(); await MP.joinCode($('mpCode').value); }
      else if (k === 'start') { await MP.start(); }
      else if (k === 'leave') { await MP.leave(); }
      else if (k === 'share') {
        const code = MP.state.match.code, text = tr('Rejoins ma partie ORBITE avec le code {c}', { c: code });
        if (navigator.share) navigator.share({ text, url: location.href.split('#')[0] }).catch(() => {});
        else if (navigator.clipboard) { await navigator.clipboard.writeText(code); A.toast(tr('Code copié.')); }
      }
      else if (k === 'law') { st.law = b.dataset.law; }
      else if (k === 'go') { if (st.law) await begin(st.law); return; }
    } catch (err) {
      const denied = err && (err.code === 'permission-denied' || /permission/i.test(err.message || ''));
      A.refuse(denied ? tr('Le serveur n’autorise pas encore les parties en ligne : réessayez plus tard.') : err && err.message ? err.message : tr('Connexion impossible.'));
    }
    st.busy = false;
    render();
  }

  async function open() {
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
    if (MP.state.match && MP.state.match.status === 'waiting') await MP.leave();
    await O.api.backToMenu();
  });
  $('mpBody').addEventListener('click', (e) => { const b = e.target.closest('[data-mp]'); if (b && !b.disabled) act(b.dataset.mp, b); });
  MP.state.onChange = () => { if (document.getElementById('multi').classList.contains('active')) render(); };
  MP.state.onStart = () => { if (document.getElementById('multi').classList.contains('active')) render(); };
  ON.on(() => { if (document.getElementById('multi').classList.contains('active')) render(); });

  window.OrbiteMultiUI = { open, render };
})();
