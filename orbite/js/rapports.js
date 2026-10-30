/* ORBITE — Signaler un bug (v121).
 * Le bouton « ? », en bas du menu et de la partie, ouvre la fiche SIGNALER UN BUG : un message, une
 * capture d'écran facultative, et ce qui est joint d'office (version, écran, appareil, langue, taille
 * d'écran, dernières erreurs, partie en cours, pseudo, compte en ligne s'il est connecté).
 * Le rapport part dans Firestore (collection rapports) par l'API REST : ni compte ni SDK Firebase
 * nécessaires, et rien n'arrive dans le dépôt GitHub, qui est public. Sans réseau, ou si l'envoi
 * échoue, il attend sur l'appareil (3 au plus, clé non synchronisée, voir js/online.js) et repart au
 * lancement suivant ou au retour du réseau.
 * Côté créateur : le code créateur (Paramètres → Code cadeau, js/game.js) crée admins/{uid} et ajoute
 * RAPPORTS DE BUGS aux Paramètres. Claude lit les mêmes rapports avec tools/rapports.mjs.
 * Chargé tôt (avant game.js) pour noter les erreurs du jeu dès le lancement. */
(function () {
  'use strict';

  const PENDING_KEY = 'orbite.rapports';
  const LAST_KEY = 'orbite.rapports.envoi';
  const CREATOR_KEY = 'orbite.createur';
  const TEXT_MAX = 1000;
  const CAPTURE_MAX = 600000;
  const JPEG = 'data:image/jpeg;base64,';
  const SIDE_MAX = 1280;
  const PENDING_MAX = 3;
  const GAP_MS = 60000;
  const TRIES_MAX = 5;

  const $ = (id) => document.getElementById(id);
  const api = () => (window.__orbite && window.__orbite.api) || null;
  const lang = () => (window.OrbiteI18n && window.OrbiteI18n.lang) || 'fr';
  const sfx = (name) => { const S = window.OrbiteSfx; try { if (S && S[name]) S[name](); } catch (err) { /* son indisponible */ } };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (err) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (err) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (err) { /* stockage indisponible */ } }
  };
  function say(text, ms) { const A = api(); if (A) A.toast(text, ms || 3000); }
  function fail(text) { say(text, 3400); sfx('error'); }

  // ─── Les dernières erreurs du jeu ───────────────────────────
  // Une petite mémoire : les 5 dernières, une erreur répétée n'est comptée qu'une fois (×n).
  const errs = [];
  function remember(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const last = errs[errs.length - 1];
    if (last && last.t === text) { last.n++; return; }
    errs.push({ t: text, n: 1 });
    if (errs.length > 5) errs.shift();
  }
  const errList = () => errs.map((e) => e.t.slice(0, 290) + (e.n > 1 ? ' (×' + e.n + ')' : ''));
  window.addEventListener('error', (e) => {
    if (!e || !e.message) return;
    const file = e.filename ? String(e.filename).split('/').pop().split('?')[0] : '';
    remember(e.message + (file ? ' (' + file + ':' + (e.lineno || 0) + ')' : ''));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    remember('promesse : ' + String((r && (r.stack || r.message)) || r).split('\n').slice(0, 2).join(' '));
  });

  // ─── Ce qui est joint d'office ──────────────────────────────
  function version() {
    const O = window.__orbite;
    const meta = document.querySelector ? document.querySelector('meta[name="orbite-version"]') : null;
    const v = O && O.version ? O.version : Number(meta && meta.content) || 0;
    return Math.max(1, Math.min(100000, v | 0));
  }
  // Comme dans le jeu : 121 → 1.21.
  const versionName = (v) => Math.floor(v / 100) + '.' + String(v % 100).padStart(2, '0');
  function screenName() { const O = window.__orbite; return String((O && O.ui && O.ui.screen) || 'inconnu').slice(0, 24); }
  function sizeName() {
    const dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100;
    return ((window.innerWidth | 0) + 'x' + (window.innerHeight | 0) + '@' + dpr).slice(0, 40);
  }
  // Résumé court de la partie en cours : mode, cycle, PV, familles (et loi, phase, événement).
  function gameSummary() {
    const O = window.__orbite;
    const ui = O && O.ui;
    const s = ui && ui.state;
    if (!s || ui.screen !== 'game' || !Array.isArray(s.players)) return '';
    const me = s.players[0] || {};
    const mode = s.tutorial ? 'tutoriel' : s.mp ? 'en ligne ' + (s.mp.mode || '') : s.daily ? 'défi ' + s.daily : s.size === 2 ? 'duel' : 'mêlée à ' + s.size;
    const parts = [mode.trim(), 'cycle ' + s.round, me.hp + ' PV', 'familles ' + (s.families || []).join('/')];
    if (me.law) parts.push('loi ' + me.law);
    if (s.phase) parts.push('phase ' + s.phase);
    if (s.event) parts.push('événement ' + s.event);
    if (s.over) parts.push('finie');
    if (s.watching) parts.push('spectateur');
    return parts.join(' · ').slice(0, 300);
  }
  function pseudo() { const p = String(store.get('orbite.pseudo') || '').trim(); return p ? p.slice(0, 16) : ''; }
  function build(texte, capture) {
    const r = {
      texte: String(texte || '').slice(0, TEXT_MAX),
      version: version(),
      ecran: screenName(),
      langue: String(lang()).slice(0, 8),
      appareil: String(navigator.userAgent || '?').slice(0, 300),
      taille: sizeName(),
      erreurs: errList(),
      regle: false
    };
    if (capture && capture.indexOf(JPEG) === 0 && capture.length <= CAPTURE_MAX) r.capture = capture;
    const etat = gameSummary();
    if (etat) r.etat = etat;
    const p = pseudo();
    if (p) r.pseudo = p;
    return r;
  }

  // ─── Firestore par l'API REST ───────────────────────────────
  // window.ORBITE_FIREBASE (js/online-config.js) donne le projet ; window.ORBITE_FIREBASE_EMULATOR
  // ({ host, port }) envoie tout à l'émulateur local, pour les essais.
  function rest() {
    const c = window.ORBITE_FIREBASE;
    if (!c || !c.projectId) return null;
    const e = window.ORBITE_FIREBASE_EMULATOR;
    const root = e && e.host ? 'http://' + e.host + ':' + e.port : 'https://firestore.googleapis.com';
    const db = 'projects/' + c.projectId + '/databases/(default)/documents';
    const key = c.apiKey ? 'key=' + encodeURIComponent(c.apiKey) : '';
    return { db, url: (path) => root + '/v1/' + db + path + (key ? (path.indexOf('?') >= 0 ? '&' : '?') + key : '') };
  }
  async function call(method, path, body, token) {
    const r = rest();
    if (!r) { const e = new Error('configuration'); e.status = 0; throw e; }
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(r.url(path), { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    } catch (err) { const e = new Error('réseau'); e.status = 0; e.net = true; throw e; }
    let data = null;
    try { data = await res.json(); } catch (err) { data = null; }
    return { ok: res.ok, status: res.status, data };
  }
  function toValue(v) {
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(toValue) } : {} };
    if (v == null) return { nullValue: null };
    return { mapValue: { fields: toFields(v) } };
  }
  function toFields(o) {
    const f = {};
    for (const k of Object.keys(o)) if (o[k] !== undefined) f[k] = toValue(o[k]);
    return f;
  }
  function fromValue(x) {
    if (!x) return null;
    if ('stringValue' in x) return x.stringValue;
    if ('integerValue' in x) return Number(x.integerValue);
    if ('doubleValue' in x) return x.doubleValue;
    if ('booleanValue' in x) return x.booleanValue;
    if ('timestampValue' in x) return Date.parse(x.timestampValue);
    if ('arrayValue' in x) return (x.arrayValue.values || []).map(fromValue);
    if ('mapValue' in x) return fromFields(x.mapValue.fields || {});
    return null;
  }
  function fromFields(f) {
    const o = {};
    for (const k of Object.keys(f || {})) o[k] = fromValue(f[k]);
    return o;
  }
  // Création seulement (le document ne doit pas exister) ; stamp : champ mis à l'heure du serveur.
  function create(path, data, token, stamp) {
    const r = rest();
    if (!r) { const e = new Error('configuration'); e.status = 0; return Promise.reject(e); }
    const w = { update: { name: r.db + '/' + path, fields: toFields(data) }, currentDocument: { exists: false } };
    if (stamp) w.updateTransforms = [{ fieldPath: stamp, setToServerValue: 'REQUEST_TIME' }];
    return call('POST', ':commit', { writes: [w] }, token);
  }
  // Jeton du joueur connecté (js/online.js), sinon null : le rapport part sans compte.
  async function jeton() {
    const N = window.OrbiteOnline;
    if (!N || !N.idToken || !N.state || N.state.status !== 'signedIn') return null;
    try { return (await N.idToken()) || null; } catch (err) { return null; }
  }
  const myUid = () => { const N = window.OrbiteOnline; return N && N.uid ? N.uid() : null; };

  // ─── Envoi, et rapports en attente ──────────────────────────
  function newId() {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const a = new Uint8Array(20);
    try { crypto.getRandomValues(a); } catch (err) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    let s = '';
    for (let i = 0; i < a.length; i++) s += A[a[i] % A.length];
    return s;
  }
  // Un rapport garde son identifiant d'un essai à l'autre : renvoyé deux fois, il n'est créé qu'une fois
  // (le second envoi répond « existe déjà », ce qui compte comme reçu).
  async function sendOne(item) {
    let token = await jeton();
    for (let pass = 0; pass < 2; pass++) {
      const data = Object.assign({}, item.data);
      delete data.uid;
      const uid = token ? myUid() : null;
      if (uid) data.uid = uid;
      const res = await create('rapports/' + item.id, data, uid ? token : null, 'cree');
      if (res.ok || res.status === 409) return true;
      // Jeton refusé (expiré) : on renvoie sans compte.
      if (res.status === 401 && token) { token = null; continue; }
      const e = new Error('HTTP ' + res.status);
      e.status = res.status;
      throw e;
    }
    return false;
  }
  function pending() {
    try { const v = JSON.parse(store.get(PENDING_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => x && x.id && x.data) : []; } catch (err) { return []; }
  }
  // Au plus 3 rapports, et une seule capture (la plus récente) : le stockage du navigateur est petit et
  // sert d'abord aux sauvegardes du jeu. S'il est plein, on garde au moins les textes.
  function savePending(list) {
    list = list.slice(-PENDING_MAX);
    let kept = false;
    for (let i = list.length - 1; i >= 0; i--) {
      if (!list[i].data.capture) continue;
      if (kept) delete list[i].data.capture;
      kept = true;
    }
    if (!list.length) { store.del(PENDING_KEY); return true; }
    if (store.set(PENDING_KEY, JSON.stringify(list))) return true;
    for (const x of list) delete x.data.capture;
    return store.set(PENDING_KEY, JSON.stringify(list));
  }
  function queue(item) { return savePending(pending().filter((x) => x.id !== item.id).concat([item])); }
  function unqueue(id) { savePending(pending().filter((x) => x.id !== id)); }

  // Envoie un rapport tout de suite : 'envoye', ou en attente : 'attente' (pas de réseau) ou
  // 'plus-tard' (le serveur ne l'a pas pris) ; 'perdu' si l'appareil n'a même pas pu le garder.
  async function submit(texte, capture) {
    const item = { id: newId(), data: build(texte, capture), at: Date.now(), essais: 0 };
    store.set(LAST_KEY, String(Date.now()));
    if (navigator.onLine === false) return queue(item) ? 'attente' : 'perdu';
    try {
      await sendOne(item);
      setTimeout(flush, 1500);
      return 'envoye';
    } catch (err) {
      item.essais = 1;
      if (!queue(item)) return 'perdu';
      return err && err.net ? 'attente' : 'plus-tard';
    }
  }
  // Renvoie les rapports en attente (au lancement, au retour du réseau). Après 5 refus du serveur, un
  // rapport est abandonné ; une panne de réseau ne compte pas.
  let flushing = false;
  async function flush() {
    if (flushing || navigator.onLine === false || !rest()) return 0;
    const list = pending();
    if (!list.length) return 0;
    flushing = true;
    let sent = 0;
    try {
      for (const item of list) {
        try {
          await sendOne(item);
          unqueue(item.id);
          sent++;
        } catch (err) {
          if (err && err.net) break;
          const cur = pending();
          const x = cur.find((y) => y.id === item.id);
          if (!x) continue;
          x.essais = (x.essais || 0) + 1;
          savePending(x.essais >= TRIES_MAX ? cur.filter((y) => y.id !== item.id) : cur);
        }
      }
    } finally { flushing = false; }
    if (sent) say(sent > 1 ? tr('{n} rapports en attente envoyés. Merci !', { n: sent }) : tr('Rapport en attente envoyé. Merci !'), 3200);
    return sent;
  }
  window.addEventListener('online', () => { flush(); });
  setTimeout(() => { flush(); }, 6000);
  // Une fois par minute au plus : le temps qu'il reste à attendre, en millisecondes.
  function waitLeft() {
    const t = Number(store.get(LAST_KEY)) || 0;
    const left = GAP_MS - (Date.now() - t);
    return left > 0 && left <= GAP_MS ? left : 0;
  }

  // ─── Capture d'écran ────────────────────────────────────────
  // Réduite à 1280 px sur le grand côté, en JPEG ~0,7 ; recompressée (puis réduite) tant qu'elle
  // dépasse 600 000 caractères.
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve({ img, url });
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }
  async function compress(file) {
    const got = await loadImage(file);
    try {
      const img = got.img;
      const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
      if (!w0 || !h0) throw new Error('image');
      let scale = Math.min(1, SIDE_MAX / Math.max(w0, h0));
      const cv = document.createElement('canvas');
      const ctx = cv.getContext('2d');
      for (let pass = 0; pass < 8; pass++) {
        cv.width = Math.max(1, Math.round(w0 * scale));
        cv.height = Math.max(1, Math.round(h0 * scale));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        for (const q of [0.7, 0.55, 0.4]) {
          const data = cv.toDataURL('image/jpeg', q);
          if (data.indexOf(JPEG) !== 0) throw new Error('jpeg');
          if (data.length <= CAPTURE_MAX) return data;
        }
        scale *= 0.75;
      }
      throw new Error('trop grande');
    } finally { URL.revokeObjectURL(got.url); }
  }

  // ─── Le bouton « ? » ────────────────────────────────────────
  // Un rond en pixels, comme les autres pictos du jeu : X le contour, Q le point d'interrogation.
  const RING = [
    '....XXXXX....',
    '..XX.....XX..',
    '.X.........X.',
    '.X...QQQ...X.',
    'X...Q...Q...X',
    'X.......Q...X',
    'X......Q....X',
    'X.....Q.....X',
    'X...........X',
    '.X....Q....X.',
    '.X.........X.',
    '..XX.....XX..',
    '....XXXXX....'
  ];
  function bugIcon() {
    let bg = '', ring = '', q = '';
    RING.forEach((row, y) => {
      const a = row.indexOf('X'), b = row.lastIndexOf('X');
      for (let x = 0; x < row.length; x++) {
        const r = `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`;
        if (row[x] === 'X') ring += r;
        else if (row[x] === 'Q') q += r;
        else if (x > a && x < b) bg += r;
      }
    });
    return `<svg class="bug-ico" viewBox="0 0 13 13" aria-hidden="true"><g class="bug-bg">${bg}</g><g class="bug-ring">${ring}</g><g class="bug-q">${q}</g></svg>`;
  }
  function wire() {
    for (const id of ['bugMenuBtn', 'bugGameBtn']) {
      const b = $(id);
      if (!b || b.dataset.on) continue;
      b.dataset.on = '1';
      b.innerHTML = bugIcon();
      b.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); open(); });
    }
  }

  // ─── La fiche SIGNALER UN BUG ───────────────────────────────
  // Le brouillon reste en mémoire si la fiche se ferme avant l'envoi.
  const draft = { texte: '', capture: '', preparing: false };
  let sending = false;
  const signedIn = () => { const N = window.OrbiteOnline; return !!(N && N.state && N.state.status === 'signedIn'); };
  function shotHtml() {
    if (draft.preparing) return `<p class="muted rp-wait">${tr('Préparation de la capture…')}</p>`;
    if (!draft.capture) return `<button class="btn rp-add" type="button" data-rp="add">${tr('AJOUTER UNE CAPTURE')}</button><small class="rp-opt">${tr('facultatif')}</small>`;
    return `<button class="rp-mini" type="button" data-rp="view" aria-label="${esc(tr('Voir la capture'))}"><img class="rp-thumb" id="rpThumb" alt=""></button><button class="btn rp-del" type="button" data-rp="remove">${tr('RETIRER LA CAPTURE')}</button>`;
  }
  function formHtml() {
    return `<div class="rp-sheet rp-form">
      <h3>${tr('SIGNALER UN BUG')}</h3>
      <p class="rp-intro">${tr('Votre message part directement à l’équipe d’ORBITE.')}</p>
      <textarea class="rp-text" id="rpText" maxlength="${TEXT_MAX}" rows="5" placeholder="${esc(tr('Que s’est-il passé ? Que faisiez-vous ?'))}" aria-label="${esc(tr('Votre message'))}">${esc(draft.texte)}</textarea>
      <div class="rp-count"><span id="rpCount">${draft.texte.length}</span> / ${TEXT_MAX}</div>
      <div class="rp-shot" id="rpShot">${shotHtml()}</div>
      <input type="file" accept="image/*" id="rpFile" class="rp-file" tabindex="-1" aria-hidden="true">
      <p class="muted rp-joint">${signedIn()
        ? tr('Joint automatiquement : version, écran, appareil, langue, taille d’écran, dernières erreurs, partie en cours, pseudo et compte en ligne.')
        : tr('Joint automatiquement : version, écran, appareil, langue, taille d’écran, dernières erreurs, partie en cours et pseudo.')}</p>
      <div class="sheet-actions"><button class="btn primary" type="button" data-rp="send" id="rpSend">${tr('ENVOYER')}</button><button class="btn" type="button" data-rp="cancel">${tr('ANNULER')}</button></div>
    </div>`;
  }
  function paintShot() {
    const box = $('rpShot');
    if (!box) return;
    box.innerHTML = shotHtml();
    const t = $('rpThumb');
    if (t && draft.capture) t.src = draft.capture;
  }
  function open() {
    const A = api();
    if (!A) return;
    A.openSheet(formHtml());
    paintShot();
    // Au clavier et à la souris, on peut écrire tout de suite ; au doigt, le clavier attend le toucher.
    if (window.matchMedia && matchMedia('(pointer: fine)').matches) setTimeout(() => { const t = $('rpText'); if (t) t.focus(); }, 250);
  }
  async function addCapture(file) {
    if (!file) return;
    draft.preparing = true;
    paintShot();
    try { draft.capture = await compress(file); } catch (err) { draft.capture = ''; fail(tr('Image illisible : essayez une autre capture.')); }
    draft.preparing = false;
    paintShot();
  }
  async function doSend() {
    if (sending || draft.preparing) return;
    const box = $('rpText');
    const texte = String(box ? box.value : draft.texte).trim();
    if (!texte) { fail(tr('Décrivez le problème en quelques mots.')); if (box) box.focus(); return; }
    const left = waitLeft();
    if (left) { fail(tr('Un rapport par minute : réessayez dans {n} s.', { n: Math.ceil(left / 1000) })); return; }
    sending = true;
    const btn = $('rpSend');
    if (btn) { btn.disabled = true; btn.textContent = tr('ENVOI…'); }
    let res = 'plus-tard';
    try { res = await submit(texte, draft.capture); } finally { sending = false; }
    draft.texte = '';
    draft.capture = '';
    if (res === 'envoye') sfx('buff'); else sfx('tap');
    thanks(res);
  }
  function thanks(res) {
    const A = api();
    if (!A) return;
    const msg = res === 'envoye' ? tr('Votre rapport est bien parti. Il aide à corriger ORBITE.')
      : res === 'attente' ? tr('Pas de réseau pour l’instant : il partira dès que vous serez en ligne.')
        : res === 'perdu' ? tr('Envoi impossible, et cet appareil n’a pas pu le garder : réessayez plus tard.')
          : tr('Envoi impossible pour le moment : il repartira tout seul plus tard.');
    A.openSheet(`<div class="rp-sheet rp-thanks"><h3>${tr('SIGNALER UN BUG')}</h3>
      <div class="rp-merci">${bugIcon()}<h2>${res === 'perdu' ? tr('DÉSOLÉ') : tr('MERCI !')}</h2><p>${msg}</p></div>
      <div class="sheet-actions"><button class="btn primary" type="button" data-rp="close">${tr('FERMER')}</button></div></div>`, { center: true });
  }
  // Capture en grand, au toucher (fiche du joueur et vue du créateur).
  function viewImage(src) {
    if (!src || src.indexOf(JPEG) !== 0) return;
    const v = document.createElement('div');
    v.className = 'rp-full';
    v.setAttribute('role', 'dialog');
    v.setAttribute('aria-label', tr('Voir la capture'));
    const img = document.createElement('img');
    img.alt = '';
    img.src = src;
    v.appendChild(img);
    const close = () => { v.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    v.addEventListener('click', () => { sfx('tap'); close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(v);
  }

  // ─── Côté créateur ──────────────────────────────────────────
  const createur = () => !!store.get(CREATOR_KEY);
  let known = null, badgeAt = 0;
  const view = { items: [], caps: {} };
  const LIST_FIELDS = ['texte', 'version', 'ecran', 'langue', 'appareil', 'taille', 'erreurs', 'etat', 'pseudo', 'uid', 'cree', 'regle'];
  function signInHtml(text) {
    return `<p class="rp-need">${text}</p><button class="btn primary on-google" type="button" data-rp="signin"><span class="on-g">G</span> ${tr('SE CONNECTER AVEC GOOGLE')}</button>`;
  }
  // Une fois connecté au compte en ligne, on reprend ce qui attendait la connexion.
  let waiters = [], hooked = false;
  function whenSignedIn(fn) {
    const N = window.OrbiteOnline;
    if (!N || !N.on) return;
    waiters = waiters.filter((f) => f.key !== fn.key).concat([fn]);
    if (hooked) return;
    hooked = true;
    N.on((s) => {
      if (s.status !== 'signedIn' || !waiters.length) return;
      const list = waiters;
      waiters = [];
      list.forEach((f) => { try { f(); } catch (err) { console.error(err); } });
    });
  }
  async function signIn() {
    const N = window.OrbiteOnline;
    if (!N || !N.signIn) return;
    await N.signIn();
    if (!signedIn() && N.state && N.state.error) fail(N.state.error);
  }

  // Code créateur saisi (js/game.js, Code cadeau) : il faut être connecté, puis admins/{uid} est créé.
  let creatorCode = null;
  async function devenirCreateur(code) {
    const A = api(), N = window.OrbiteOnline;
    if (!A) return;
    if (!N || !N.configured) { fail(tr('Mode créateur indisponible : le jeu en ligne n’est pas configuré.')); return; }
    if (!signedIn()) {
      creatorCode = code;
      const go = () => { if (creatorCode) { const c = creatorCode; creatorCode = null; activer(c); } };
      go.key = 'createur';
      whenSignedIn(go);
      A.openSheet(`<div class="rp-sheet"><h3>${tr('MODE CRÉATEUR')}</h3>${signInHtml(tr('Code créateur reconnu. Connectez-vous au compte en ligne : le mode créateur s’activera tout seul.'))}
        <div class="sheet-actions"><button class="btn" data-act="set" data-v="settings">${A.icon('back')} ${tr('PARAMÈTRES')}</button></div></div>`);
      return;
    }
    await activer(code);
  }
  async function activer(code) {
    const A = api();
    const uid = myUid(), token = await jeton();
    if (!uid || !token) { fail(tr('Connexion au compte impossible pour le moment.')); return; }
    let res;
    try {
      // Déjà créateur (autre appareil) ? Sinon on crée admins/{uid} avec le code.
      res = await call('GET', '/admins/' + encodeURIComponent(uid), null, token);
      if (res.status === 404) res = await create('admins/' + uid, { cle: code }, token, null);
    } catch (err) { fail(tr('Pas de réseau : réessayez plus tard.')); return; }
    if (!res.ok && res.status !== 409) { fail(tr('Le serveur a refusé le mode créateur.')); return; }
    store.set(CREATOR_KEY, JSON.stringify({ uid, at: Date.now() }));
    known = null;
    badgeAt = 0;
    if (A) { A.closeSheet(); A.toast(tr('Mode créateur activé : les rapports de bugs sont dans les Paramètres.'), 4200); }
    sfx('golden');
  }

  async function count(token) {
    const res = await call('POST', ':runAggregationQuery', { structuredAggregationQuery: {
      aggregations: [{ alias: 'n', count: {} }],
      structuredQuery: { from: [{ collectionId: 'rapports' }], where: { fieldFilter: { field: { fieldPath: 'regle' }, op: 'EQUAL', value: { booleanValue: false } } } }
    } }, token);
    const row = res.ok && Array.isArray(res.data) ? res.data.find((x) => x && x.result) : null;
    if (!row) throw res;
    return Number(row.result.aggregateFields.n.integerValue) || 0;
  }
  // Le nombre de rapports à régler, à côté de RAPPORTS DE BUGS (Paramètres).
  function paintBadge() {
    const b = $('rpBadge');
    if (!b) return;
    b.textContent = known ? String(known) : '';
    b.classList.toggle('on', !!known);
  }
  async function refreshBadge() {
    paintBadge();
    if (Date.now() - badgeAt < 15000) return;
    badgeAt = Date.now();
    const token = await jeton();
    if (!token) return;
    try { known = await count(token); } catch (err) { return; }
    paintBadge();
  }
  // Rapports à régler (tous, jusqu'à 200), plus les 20 derniers, réglés compris. Sans la capture :
  // elle arrive ensuite, rapport par rapport.
  async function query(token, onlyOpen) {
    const q = { from: [{ collectionId: 'rapports' }], select: { fields: LIST_FIELDS.map((f) => ({ fieldPath: f })) } };
    if (onlyOpen) { q.where = { fieldFilter: { field: { fieldPath: 'regle' }, op: 'EQUAL', value: { booleanValue: false } } }; q.limit = 200; }
    else { q.orderBy = [{ field: { fieldPath: 'cree' }, direction: 'DESCENDING' }]; q.limit = 20; }
    const res = await call('POST', ':runQuery', { structuredQuery: q }, token);
    if (!res.ok || !Array.isArray(res.data)) throw res;
    return res.data.filter((x) => x && x.document).map((x) => Object.assign(fromFields(x.document.fields), { id: x.document.name.split('/').pop() }));
  }
  async function capture(id, token) {
    const res = await call('GET', '/rapports/' + encodeURIComponent(id) + '?mask.fieldPaths=capture', null, token);
    const f = res.ok && res.data && res.data.fields && res.data.fields.capture;
    const s = f && f.stringValue;
    return typeof s === 'string' && s.indexOf(JPEG) === 0 ? s : '';
  }
  const sorted = (items) => items.slice().sort((a, b) => (a.regle === b.regle ? (b.cree || 0) - (a.cree || 0) : a.regle ? 1 : -1));

  function adminHtml(body) {
    const A = api();
    return `<div class="rp-sheet rp-admin"><h3>${tr('RAPPORTS DE BUGS')} <small class="rp-sum" id="rpSum"></small></h3>
      <div class="rp-list" id="rpList">${body}</div>
      <div class="sheet-actions"><button class="btn" type="button" data-rp="reload">${tr('ACTUALISER')}</button><button class="btn" data-act="set" data-v="settings">${A ? A.icon('back') : ''} ${tr('PARAMÈTRES')}</button></div></div>`;
  }
  function when(ms) {
    if (!ms) return '?';
    try { return new Date(ms).toLocaleString(lang(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (err) { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); }
  }
  function itemHtml(x) {
    const cap = view.caps[x.id];
    const errsHtml = x.erreurs && x.erreurs.length ? x.erreurs.map((e) => `<div>${esc(e)}</div>`).join('') : esc(tr('aucune'));
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    return `<article class="rp-item${x.regle ? ' done' : ''}" data-id="${esc(x.id)}">
      <div class="rp-head"><b>${esc(when(x.cree))}</b><span>${esc(x.pseudo || tr('anonyme'))}</span><span>${esc(versionName(x.version | 0))}</span><span>${esc(x.ecran || '?')}</span>${x.regle ? `<em class="rp-tag">${tr('RÉGLÉ')}</em>` : ''}</div>
      <div class="rp-body">
        <p class="rp-msg">${esc(x.texte || '')}</p>
        ${cap ? `<button class="rp-mini" type="button" data-rp="full" data-id="${esc(x.id)}" aria-label="${esc(tr('Voir la capture'))}"><img alt=""></button>` : ''}
      </div>
      <details class="rp-tech"><summary>${tr('Détails techniques')}</summary><dl>
        ${row(tr('Langue'), esc(x.langue || '?'))}${row(tr('Taille d’écran'), esc(x.taille || '?'))}${row(tr('Appareil'), esc(x.appareil || '?'))}
        ${row(tr('Partie'), esc(x.etat || '—'))}${row(tr('Erreurs'), errsHtml)}${row(tr('Compte'), esc(x.uid || '—'))}${row(tr('Identifiant'), esc(x.id))}
      </dl></details>
      <div class="rp-acts">
        <button class="btn${x.regle ? '' : ' primary'}" type="button" data-rp="regle" data-id="${esc(x.id)}">${x.regle ? tr('ROUVRIR') : tr('RÉGLÉ')}</button>
        <button class="btn" type="button" data-rp="copy" data-id="${esc(x.id)}">${tr('COPIER POUR CLAUDE')}</button>
        ${cap ? `<button class="btn" type="button" data-rp="dl" data-id="${esc(x.id)}">${tr('TÉLÉCHARGER LA CAPTURE')}</button>` : ''}
      </div>
    </article>`;
  }
  function renderList() {
    const list = $('rpList');
    if (!list) return;
    const items = sorted(view.items);
    const todo = items.filter((x) => !x.regle).length;
    known = todo;
    const sum = $('rpSum');
    if (sum) sum.textContent = todo ? '· ' + tr('{n} à régler', { n: todo }) : '· ' + tr('tout est réglé');
    list.innerHTML = items.length ? items.map(itemHtml).join('') : `<p class="muted">${tr('Aucun rapport pour l’instant.')}</p>`;
    for (const b of list.querySelectorAll('.rp-mini[data-id]')) {
      const img = b.querySelector('img');
      if (img && view.caps[b.dataset.id]) img.src = view.caps[b.dataset.id];
    }
  }
  function itemOf(id) { return view.items.find((x) => x.id === id) || null; }
  async function loadCaptures(token) {
    for (const x of sorted(view.items)) {
      if (view.caps[x.id] !== undefined) continue;
      if (!$('rpList')) return;
      try { view.caps[x.id] = await capture(x.id, token); } catch (err) { return; }
      if (view.caps[x.id]) renderOne(x.id);
    }
  }
  // Redessine un seul rapport (sa capture vient d'arriver), sans toucher aux détails ouverts des autres.
  function renderOne(id) {
    const list = $('rpList');
    const x = itemOf(id);
    if (!list || !x) return;
    const el = [...list.querySelectorAll('.rp-item')].find((a) => a.dataset.id === id);
    if (!el) return;
    const wasOpen = el.querySelector('details') && el.querySelector('details').open;
    const tmp = document.createElement('div');
    tmp.innerHTML = itemHtml(x);
    const fresh = tmp.firstElementChild;
    if (wasOpen) fresh.querySelector('details').open = true;
    const img = fresh.querySelector('.rp-mini img');
    if (img) img.src = view.caps[id];
    el.replaceWith(fresh);
  }
  async function ouvrirCreateur() {
    const A = api();
    if (!A) return;
    A.openSheet(adminHtml(`<p class="muted">${tr('Chargement…')}</p>`));
    await loadReports();
  }
  async function loadReports() {
    const list = $('rpList');
    if (!list) return;
    if (!signedIn()) {
      list.innerHTML = signInHtml(tr('Connectez-vous au compte en ligne pour lire les rapports.'));
      const again = () => { if ($('rpList')) loadReports(); };
      again.key = 'lecture';
      whenSignedIn(again);
      return;
    }
    const token = await jeton();
    let items;
    try {
      if (!token) throw { status: 0 };
      const both = await Promise.all([query(token, true), query(token, false)]);
      const seen = {};
      items = [];
      for (const x of both[0].concat(both[1])) if (!seen[x.id]) { seen[x.id] = 1; items.push(x); }
    } catch (res) {
      const l = $('rpList');
      if (l) l.innerHTML = `<p class="muted">${res && res.status === 403 ? tr('Accès refusé : ce compte n’est pas celui du créateur.') : tr('Impossible de lire les rapports pour le moment.')}</p>`;
      return;
    }
    view.items = items;
    renderList();
    paintBadge();
    loadCaptures(token);
  }
  async function toggleRegle(id) {
    const x = itemOf(id);
    if (!x) return;
    const token = await jeton();
    const val = !x.regle;
    x.regle = val;
    renderList();
    let ok = false;
    try {
      const res = await call('PATCH', '/rapports/' + encodeURIComponent(id) + '?updateMask.fieldPaths=regle&currentDocument.exists=true', { fields: { regle: { booleanValue: val } } }, token);
      ok = res.ok;
    } catch (err) { ok = false; }
    if (!ok) { x.regle = !val; renderList(); fail(tr('Impossible de modifier ce rapport pour le moment.')); return; }
    sfx(val ? 'buff' : 'tap');
    badgeAt = 0;
  }
  // Tout le rapport en texte (sans l'image), à coller dans une conversation avec Claude.
  function forClaude(x) {
    const date = x.cree ? new Date(x.cree).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '?';
    const cap = view.caps[x.id];
    return ['Rapport de bug ORBITE ' + x.id,
      'Date : ' + date,
      'Version : ' + versionName(x.version | 0) + ' (' + (x.version | 0) + ')',
      'Écran : ' + (x.ecran || '?'),
      'Langue : ' + (x.langue || '?'),
      'Taille d’écran : ' + (x.taille || '?'),
      'Appareil : ' + (x.appareil || '?'),
      'Pseudo : ' + (x.pseudo || '(inconnu)'),
      'Compte : ' + (x.uid || '(sans compte)'),
      'Partie : ' + (x.etat || '(hors partie)'),
      'Erreurs : ' + (x.erreurs && x.erreurs.length ? '' : 'aucune')]
      .concat((x.erreurs || []).map((e) => '  - ' + e))
      .concat(['Capture : ' + (cap ? 'oui (non copiée : TÉLÉCHARGER LA CAPTURE, ou node orbite/tools/rapports.mjs --captures <dossier>)' : cap === '' ? 'non' : 'pas encore chargée'),
        'Réglé : ' + (x.regle ? 'oui' : 'non'),
        '',
        'Message du joueur :',
        x.texte || ''])
      .join('\n');
  }
  async function copy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; }
    } catch (err) { /* repli plus bas */ }
    try {
      const t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.style.cssText = 'position:fixed;left:0;top:0;opacity:0;user-select:text;-webkit-user-select:text';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      t.remove();
      return ok;
    } catch (err) { return false; }
  }
  async function download(id) {
    const src = view.caps[id];
    if (!src) return;
    let href = src, blobUrl = null;
    try { blobUrl = URL.createObjectURL(await (await fetch(src)).blob()); href = blobUrl; } catch (err) { /* le lien data: suffit */ }
    const a = document.createElement('a');
    a.href = href;
    a.download = 'orbite-rapport-' + id + '.jpg';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
  }

  // ─── Événements de la fiche ─────────────────────────────────
  function onSheetClick(e) {
    const b = e.target.closest('[data-rp]');
    if (!b || b.disabled) return;
    const act = b.dataset.rp, A = api();
    if (act !== 'send') sfx('tap');
    if (act === 'send') doSend();
    else if (act === 'cancel' || act === 'close') { if (A) A.closeSheet(); }
    else if (act === 'add') { const f = $('rpFile'); if (f) { f.value = ''; f.click(); } }
    else if (act === 'remove') { draft.capture = ''; paintShot(); }
    else if (act === 'view') viewImage(draft.capture);
    else if (act === 'signin') signIn();
    else if (act === 'reload') { const l = $('rpList'); if (l) l.innerHTML = `<p class="muted">${tr('Chargement…')}</p>`; view.caps = {}; badgeAt = 0; loadReports(); }
    else if (act === 'regle') toggleRegle(b.dataset.id);
    else if (act === 'full') viewImage(view.caps[b.dataset.id]);
    else if (act === 'dl') download(b.dataset.id);
    else if (act === 'copy') {
      const x = itemOf(b.dataset.id);
      if (x) copy(forClaude(x)).then((ok) => (ok ? say(tr('Copié : collez-le dans votre conversation avec Claude.'), 3000) : fail(tr('Copie impossible sur cet appareil.'))));
    }
  }
  function init() {
    wire();
    const sheet = $('sheet'), ov = $('overlay');
    if (!sheet || !ov) return;
    sheet.addEventListener('click', onSheetClick);
    sheet.addEventListener('input', (e) => {
      if (e.target.id !== 'rpText') return;
      draft.texte = e.target.value;
      const c = $('rpCount');
      if (c) c.textContent = String(e.target.value.length);
    });
    sheet.addEventListener('change', (e) => {
      if (e.target.id !== 'rpFile' || !e.target.files || !e.target.files[0]) return;
      const file = e.target.files[0];
      // Vidé aussitôt : la même image pourra être choisie de nouveau après l'avoir retirée.
      e.target.value = '';
      addCapture(file);
    });
    // Pendant la fiche, le guide du tutoriel s'efface (il reprend à la fermeture) ; dans les
    // Paramètres, le nombre de rapports à régler se met à jour.
    if (window.MutationObserver) {
      const sync = () => {
        document.body.classList.toggle('rp-open', !ov.hidden && !!sheet.querySelector('.rp-sheet'));
        if (!ov.hidden && $('rpBadge')) refreshBadge();
      };
      new MutationObserver(sync).observe(sheet, { childList: true });
      new MutationObserver(sync).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.OrbiteRapports = {
    open, createur, ouvrirCreateur, devenirCreateur,
    badge: () => (known ? String(known) : ''),
    // Pour les tests et le débogage.
    envoyer: submit, renvoyer: flush, enAttente: pending, erreurs: errList, construire: build, versionName
  };
})();
