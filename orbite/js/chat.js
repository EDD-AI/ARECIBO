/* ORBITE — discussion des parties en ligne : dans le salon d'attente et pendant la partie (bouton
 * bulle en haut de l'écran). Messages rapides partout, affichés dans la langue de chacun ; texte
 * libre seulement entre amis (parties privées). Les messages vivent dans le salon (js/multi.js). */
(function () {
  'use strict';
  const O = window.__orbite, MP = window.OrbiteMulti, ON = window.OrbiteOnline;
  if (!O || !MP || !ON) return;
  const A = O.api, SFX = window.OrbiteSfx;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const esc = A.esc;
  // L'ordre compte : un message rapide est enregistré par son numéro.
  const QUICK = ['Bonne chance !', 'Bien joué !', 'Aïe !', 'Joli combo !', 'GG', 'Revanche ?'];
  const st = { mid: null, seen: new Set(), unread: 0, lastSent: 0 };

  const match = () => MP.state.match;
  const msgs = () => (match() && Array.isArray(match().chat) ? match().chat : []);
  const free = () => !!match() && match().mode === 'private';
  const textOf = (m) => (m.q != null && QUICK[m.q] ? tr(QUICK[m.q]) : String(m.text || ''));
  // Le nom de l'auteur dans la police de son pseudo, lue à sa place du salon (v96).
  const who = (m) => {
    const seat = match() && Array.isArray(match().seats) ? match().seats.find((x) => x && x.uid === m.uid) : null;
    return seat && A.seatLook ? A.nameHtml(m.name || '?', A.seatLook(seat).font) : esc(m.name || '?');
  };
  const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

  function listHtml(n) {
    const list = msgs().slice(-n);
    if (!list.length) return `<p class="chat-empty">${tr('Aucun message pour l’instant.')}</p>`;
    return list.map((m) => `<p class="chat-msg ${m.uid === ON.uid() ? 'me' : ''}"><b>${who(m)}</b> ${esc(textOf(m))}</p>`).join('');
  }
  // Le bloc complet : la liste, les messages rapides et, entre amis, la saisie libre.
  function html(n) {
    return `<div class="chat" data-chat-box>
      <div class="chat-list">${listHtml(n || 30)}</div>
      <div class="chat-quick">${QUICK.map((q, i) => `<button class="chip" type="button" data-chat="${i}">${esc(tr(q))}</button>`).join('')}</div>
      ${free()
        ? `<form class="chat-form" data-chat-form><input class="chat-input" maxlength="120" placeholder="${tr('Écrire un message…')}" autocomplete="off" enterkeyhint="send"><button class="btn" type="submit">${tr('ENVOYER')}</button></form>`
        : `<p class="chat-note">${tr('En partie classée, seuls les messages rapides sont proposés.')}</p>`}
    </div>`;
  }
  const scrollDown = () => { for (const l of document.querySelectorAll('.chat-list')) l.scrollTop = l.scrollHeight; };

  async function send(msg) {
    // Un message par seconde au plus.
    if (Date.now() - st.lastSent < 1000) return;
    st.lastSent = Date.now();
    SFX.tap();
    try { await MP.say(msg); } catch (err) { A.toast(tr('Message non envoyé.')); }
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-chat]');
    if (b) { e.preventDefault(); send({ q: Number(b.dataset.chat) }); }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-chat-form]');
    if (!f) return;
    e.preventDefault();
    const input = f.querySelector('.chat-input');
    const text = clean(input.value);
    if (!text || !free()) return;
    input.value = '';
    send({ text });
  });

  // ─── Pendant la partie : bouton bulle, pastille, aperçu des messages reçus ───
  const sheetOpen = () => !!document.querySelector('#sheet [data-chat-box]') && !$('overlay').hidden;
  function badge() {
    const b = $('chatBtn');
    if (!b) return;
    b.innerHTML = A.icon('chat') + (st.unread ? `<i class="chat-dot">${Math.min(9, st.unread)}</i>` : '');
  }
  function open() {
    st.unread = 0;
    badge();
    A.openSheet(`<h3>${tr('DISCUSSION')}</h3>${html(30)}`);
    scrollDown();
  }
  const btn = $('chatBtn');
  if (btn) btn.addEventListener('click', () => { SFX.tap(); open(); });

  // Les messages reçus s'affichent en grand en haut de l'écran, pour qu'on voie tout de suite qu'un
  // ami nous parle ; toucher une bulle ouvre la discussion.
  const pops = document.createElement('div');
  pops.className = 'chat-pops';
  document.body.appendChild(pops);
  pops.addEventListener('click', (e) => { if (e.target.closest('.chat-pop')) { pops.innerHTML = ''; open(); } });
  function popMsg(m) {
    const d = document.createElement('div');
    d.className = 'chat-pop';
    d.innerHTML = `<b>${who(m)}</b><span>${esc(textOf(m))}</span>`;
    pops.appendChild(d);
    while (pops.children.length > 3) pops.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 4500);
    setTimeout(() => d.remove(), 5000);
  }

  window.addEventListener('orbite-match', () => {
    const m = match();
    if (!m) { st.mid = null; st.seen = new Set(); st.unread = 0; badge(); return; }
    // Nouveau salon : les messages déjà là ne s'annoncent pas.
    if (m.id !== st.mid) { st.mid = m.id; st.seen = new Set(msgs().map((x) => x.id)); st.unread = 0; badge(); return; }
    const fresh = msgs().filter((x) => !st.seen.has(x.id));
    if (!fresh.length) return;
    for (const x of fresh) st.seen.add(x.id);
    const others = fresh.filter((x) => x.uid !== ON.uid());
    if (sheetOpen()) {
      const list = document.querySelector('#sheet .chat-list');
      if (list) list.innerHTML = listHtml(30);
      scrollDown();
    } else if (others.length && (O.ui.screen === 'game' || (O.ui.screen === 'multi' && !document.querySelector('#mpBody .chat-list')))) {
      st.unread += others.length;
      badge();
      for (const x of others.slice(-3)) popMsg(x);
    }
    if (others.length) SFX.type();
    // Dans le salon, la liste est redessinée par multi-ui.js ; on garde le bas en vue.
    setTimeout(scrollDown, 0);
  });
  badge();

  window.OrbiteChat = { html, open, scrollDown };
})();
