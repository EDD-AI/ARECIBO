/* ORBITE — Mode en ligne (Firebase) : connexion Google, sauvegarde de la progression dans le nuage,
 * profil public, amis et classement mondial.
 * Le jeu reste entièrement jouable hors ligne : le SDK Firebase n'est chargé qu'avec un réseau et
 * une configuration (js/online-config.js). Sans elle, l'interface annonce simplement « bientôt ». */
(function () {
  'use strict';

  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const CFG = window.ORBITE_FIREBASE || null;
  const EMU = window.ORBITE_FIREBASE_EMULATOR || null;
  const SYNC_KEY = 'orbite.sync';
  // Ce qui ne suit pas le joueur d'un appareil à l'autre : l'écran ouvert, la partie ou
  // l'expédition en cours, l'état de synchronisation.
  const LOCAL_ONLY = ['orbite.session', 'orbite.partie.v1', 'orbite.campagne', SYNC_KEY];

  const listeners = new Set();
  // synced : la progression en ligne est réglée (envoyée, ou récupérée, ce qui recharge la page).
  const state = { status: CFG ? 'off' : 'unconfigured', user: null, syncAt: 0, error: '', conflict: null, requests: 0, synced: false };
  let fb = null, auth = null, db = null, timer = 0, booting = null;

  const emit = () => { for (const fn of listeners) { try { fn(state); } catch (err) { console.error(err); } } };
  const set = (patch) => { Object.assign(state, patch); emit(); };

  // ─── Sauvegarde locale : instantané des clés de progression ─
  function snapshot() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('orbite.') && !LOCAL_ONLY.includes(k)) out[k] = localStorage.getItem(k);
      }
    } catch (err) { /* stockage indisponible */ }
    return out;
  }
  function hashOf(snap) {
    const s = JSON.stringify(Object.keys(snap).sort().map((k) => [k, snap[k]]));
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + ':' + s.length;
  }
  function summary(snap) {
    const n = (k) => Number(snap[k]) || 0;
    let games = 0;
    try { games = (JSON.parse(snap['orbite.stats'] || '{}').games) || 0; } catch (err) { /* illisible */ }
    return { xp: n('orbite.xp'), dust: n('orbite.poussieres'), games, pseudo: snap['orbite.pseudo'] || tr('Créateur') };
  }
  const isFresh = (snap) => { const s = summary(snap); return !s.xp && !s.games; };
  function applySnapshot(snap) {
    try {
      const keep = {};
      for (const k of LOCAL_ONLY) { const v = localStorage.getItem(k); if (v != null) keep[k] = v; }
      for (const k of Object.keys(snapshot())) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(snap)) if (k.startsWith('orbite.') && !LOCAL_ONLY.includes(k) && typeof v === 'string') localStorage.setItem(k, v);
      for (const [k, v] of Object.entries(keep)) localStorage.setItem(k, v);
    } catch (err) { /* stockage indisponible */ }
  }
  function syncInfo() { try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); } catch (err) { return {}; } }
  function setSyncInfo(o) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(o)); } catch (err) { /* indisponible */ } }

  // ─── Code ami : 6 caractères tirés de l'identifiant ──────────
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function codeOf(uid) {
    let h = 2166136261;
    for (let i = 0; i < uid.length; i++) { h ^= uid.charCodeAt(i); h = Math.imul(h, 16777619); }
    let h2 = h ^ 0x9e3779b9, out = '';
    for (let i = 0; i < 6; i++) { const v = i < 3 ? h : h2; out += ALPHA[(v >>> (i % 3 * 5 + 2)) & 31]; h2 = Math.imul(h2, 2654435761); }
    return out;
  }

  // ─── Démarrage du SDK ───────────────────────────────────────
  async function boot() {
    if (!CFG) return false;
    if (fb) return true;
    if (booting) return booting;
    booting = (async () => {
      set({ status: 'loading', error: '' });
      try {
        const [app, a, fs] = await Promise.all([
          import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')
        ]);
        fb = { app, a, fs };
        const inst = app.initializeApp(CFG);
        auth = a.getAuth(inst);
        auth.languageCode = (window.OrbiteI18n && window.OrbiteI18n.lang) || 'fr';
        db = fs.getFirestore(inst);
        if (EMU) {
          a.connectAuthEmulator(auth, EMU.auth, { disableWarnings: true });
          fs.connectFirestoreEmulator(db, EMU.host, EMU.port);
        }
        a.getRedirectResult(auth).catch((err) => set({ error: messageOf(err) }));
        a.onAuthStateChanged(auth, (u) => {
          if (u) onSignedIn(u);
          else { clearInterval(timer); stopFriends(); set({ status: 'signedOut', user: null, conflict: null, requests: 0, synced: false }); }
        });
        return true;
      } catch (err) {
        fb = null;
        set({ status: 'offline', error: tr('Mode en ligne indisponible sans réseau.') });
        return false;
      } finally { booting = null; }
    })();
    return booting;
  }

  function messageOf(err) {
    const c = (err && err.code) || '';
    if (c.includes('popup-closed') || c.includes('cancelled')) return '';
    if (c.includes('network')) return tr('Pas de réseau : réessayez plus tard.');
    if (c.includes('unauthorized-domain')) return tr('Ce site n’est pas encore autorisé dans Firebase.');
    if (c.includes('permission')) return tr('Accès refusé par le serveur.');
    return tr('Connexion impossible pour le moment.');
  }

  async function signIn() {
    if (!(await boot())) return;
    const { a } = fb;
    const provider = new a.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await a.signInWithPopup(auth, provider);
    } catch (err) {
      const c = err && err.code || '';
      // Fenêtre bloquée ou appli installée qui ne les permet pas : on passe par une redirection.
      if (c.includes('popup-blocked') || c.includes('operation-not-supported') || c.includes('web-storage-unsupported')) {
        try { await a.signInWithRedirect(auth, provider); } catch (e2) { set({ error: messageOf(e2) }); }
      } else set({ error: messageOf(err) });
    }
  }
  async function signOut() {
    if (!fb) return;
    await uploadNow().catch(() => {});
    await fb.a.signOut(auth);
  }

  // ─── Synchronisation de la progression ──────────────────────
  async function onSignedIn(u) {
    set({ status: 'signedIn', synced: false, user: { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' }, error: '' });
    try {
      await reconcile();
      set({ synced: true });
      await refreshRequests();
    } catch (err) { set({ error: messageOf(err), synced: true }); }
    watchFriends();
    clearInterval(timer);
    timer = setInterval(() => { uploadIfChanged().catch(() => {}); }, 20000);
  }

  async function reconcile() {
    const { fs } = fb;
    const uid = state.user.uid;
    const ref = fs.doc(db, 'saves', uid);
    const snap = await fs.getDoc(ref);
    const local = snapshot(), localHash = hashOf(local);
    const info = syncInfo();
    const same = info.uid === uid;
    if (!snap.exists()) { await uploadNow(); return; }
    const cloud = snap.data().data || {};
    const cloudHash = hashOf(cloud);
    if (cloudHash === localHash) { setSyncInfo({ uid, hash: localHash }); set({ syncAt: Date.now() }); await writeProfile(); return; }
    const localChanged = !same || info.hash !== localHash;
    const cloudChanged = !same || info.hash !== cloudHash;
    // Un appareil neuf, ou seule la sauvegarde en ligne a bougé : on la récupère.
    if (isFresh(local) || (same && !localChanged && cloudChanged)) { useCloud(cloud); return; }
    // Seul cet appareil a avancé : on envoie.
    if (same && localChanged && !cloudChanged) { await uploadNow(); return; }
    // Les deux ont bougé : si l'une est au moins aussi avancée sur tout (expérience, parties,
    // poussières), on la garde sans rien demander ; sinon, le joueur choisit.
    const d = summary(local), c = summary(cloud);
    const geq = (x, y) => x.xp >= y.xp && x.games >= y.games && x.dust >= y.dust;
    if (geq(d, c)) { await uploadNow(); return; }
    if (geq(c, d)) { useCloud(cloud); return; }
    set({ conflict: { device: d, cloud: c, cloudData: cloud } });
  }
  function useCloud(cloud) {
    applySnapshot(cloud);
    setSyncInfo({ uid: state.user.uid, hash: hashOf(snapshot()) });
    location.reload();
  }
  async function resolveConflict(choice) {
    const c = state.conflict;
    if (!c) return;
    set({ conflict: null });
    if (choice === 'cloud') useCloud(c.cloudData);
    else await uploadNow();
  }

  async function uploadNow() {
    if (!fb || state.status !== 'signedIn' || state.conflict) return;
    const { fs } = fb;
    const uid = state.user.uid;
    const data = snapshot();
    await fs.setDoc(fs.doc(db, 'saves', uid), { data, updatedAt: fs.serverTimestamp(), v: 1 });
    setSyncInfo({ uid, hash: hashOf(data) });
    await writeProfile();
    set({ syncAt: Date.now() });
  }
  async function uploadIfChanged() {
    if (!fb || state.status !== 'signedIn' || state.conflict) return;
    const info = syncInfo();
    if (info.uid === state.user.uid && info.hash === hashOf(snapshot())) return;
    await uploadNow();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) uploadIfChanged().catch(() => {}); });

  // ─── Profil public ──────────────────────────────────────────
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (err) { return d; } };
  function publicProfile() {
    const A = window.__orbite && window.__orbite.api;
    const xp = Number(localStorage.getItem('orbite.xp')) || 0;
    const K = window.OrbiteClassement;
    const c = K.sanitize(read('orbite.classe', null));
    const st = read('orbite.stats', {}) || {};
    const forge = read('orbite.forge', null);
    const planets = forge && Array.isArray(forge.planets) ? forge.planets.slice(0, 6).map((p) => ({
      name: String(p.name || '').slice(0, 18), seed: p.seed >>> 0, mass: p.mass | 0, type: p.type || null, hue: p.hue | 0,
      ring: !!p.ring, debris: !!p.debris, moons: p.moons | 0, shell: !!p.shell, facet: !!p.facet, shape: p.shape || null, orbit: p.orbit == null ? null : p.orbit | 0
    })) : [];
    const star = forge && forge.star ? { seed: forge.star.seed >>> 0, lit: !!forge.star.lit, cls: String(forge.star.cls || ''), size: forge.star.size | 0 } : null;
    // Le cadre de profil (v90) voyage dans « forge », que les règles Firestore laissent libre : pas
    // de règle à republier pour que les amis le voient.
    const cos = read('orbite.cosmetiques', {}) || {};
    const frame = String(cos.frame || '').slice(0, 16), avatar = String(cos.avatar || '').slice(0, 16);
    return {
      pseudo: String(localStorage.getItem('orbite.pseudo') || 'Créateur').slice(0, 16),
      tag: String(localStorage.getItem('orbite.tag') || '').slice(0, 6),
      code: codeOf(state.user.uid),
      level: A ? A.levelInfo(xp).lvl : 1,
      points: K.placed(c) ? c.points : 0,
      placed: K.placed(c),
      games: st.games | 0,
      wins: st.wins | 0,
      world: (read('orbite.monde', []) || []).slice(0, 30),
      forge: { star, planets, frame, avatar },
      seen: Date.now(),
      where: whereNow()
    };
  }
  // Présence pour les amis : où l'on est (menu, partie solo, partie en ligne), mise à jour à
  // chaque changement et au moins une fois par minute tant que l'appli est ouverte.
  function whereNow() {
    const O = window.__orbite;
    const scr = O && O.ui ? O.ui.screen : '';
    const st = O && O.ui ? O.ui.state : null;
    if ((scr === 'game' || scr === 'end') && st && st.mp && !st.over) return 'multi';
    if (scr === 'game') return 'game';
    if (scr === 'multi') return inviteTag || 'lobby';
    return 'menu';
  }
  let presence = { at: 0, where: '' };
  async function beat() {
    if (!fb || state.status !== 'signedIn' || document.hidden) return;
    const w = whereNow();
    if (w === presence.where && Date.now() - presence.at < 60000) return;
    presence = { at: Date.now(), where: w };
    try { await fb.fs.updateDoc(fb.fs.doc(db, 'profiles', state.user.uid), { seen: Date.now(), where: w }); } catch (err) { /* hors ligne */ }
  }
  setInterval(beat, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(); });
  // ─── Défis entre amis (v88) ─────────────────────────────────
  // Sans nouvelle règle Firestore : celui qui défie publie dans sa présence le code de sa partie suivi
  // du code ami de l'invité (12 caractères ; les autres présences sont des mots en minuscules). Chacun
  // suit en direct sa liste d'amis et leur profil : le défi s'affiche aussitôt chez l'invité.
  const INVITE_RE = /^[A-Z0-9]{12}$/;
  const INVITE_MS = 300000;
  let inviteTag = '';
  function setInvite(matchCode, friendCode) { setPresenceTag(matchCode && friendCode ? String(matchCode) + String(friendCode) : ''); }
  function setPresenceTag(tag) {
    if (tag === inviteTag) return;
    inviteTag = tag;
    presence.at = 0;
    beat();
  }
  // Partie entre amis (v93) : la présence de l'hôte porte « I » + le code de la partie + un compteur
  // d'invités (8 caractères). Les amis qui la voient lisent le salon et regardent si leur code ami
  // est dans sa liste d'invités ; le compteur change à chaque invitation, ce qui les fait relire.
  const GROUP_RE = /^I[A-Z0-9]{7}$/;
  const setGroupInvite = (matchCode, count) => setPresenceTag(matchCode && count ? 'I' + matchCode + (count % 36).toString(36).toUpperCase() : '');
  const groupInv = {};
  async function checkGroup(p) {
    const tag = p && typeof p.where === 'string' && GROUP_RE.test(p.where) ? p.where : '';
    const cur = groupInv[p.uid];
    if (!tag) { if (cur) { delete groupInv[p.uid]; friendsChanged(); } return; }
    if (cur && cur.tag === tag) return;
    groupInv[p.uid] = { tag, ok: false, code: tag.slice(1, 7) };
    try {
      const { fs } = fb;
      const res = await fs.getDocs(fs.query(fs.collection(db, 'matches'), fs.where('code', '==', tag.slice(1, 7)), fs.limit(1)));
      const m = res.empty ? null : res.docs[0].data();
      const g = groupInv[p.uid];
      if (g && g.tag === tag) g.ok = !!m && m.status === 'waiting' && Array.isArray(m.invited) && m.invited.includes(codeOf(state.user.uid));
    } catch (err) { /* salon illisible : pas d'invitation */ }
    friendsChanged();
  }
  const live = { q: null, docs: {}, profiles: {}, ready: false };
  const friendsChanged = () => { try { window.dispatchEvent(new Event('orbite-friends')); } catch (err) { /* sans importance */ } };
  function watchFriends() {
    if (live.q || !fb || state.status !== 'signedIn') return;
    const { fs } = fb, me = state.user.uid;
    live.q = fs.onSnapshot(fs.query(fs.collection(db, 'friends'), fs.where('members', 'array-contains', me)), (snap) => {
      const ok = new Set();
      let incoming = 0;
      snap.docs.forEach((d) => {
        const x = d.data();
        if (x.status === 'accepted') ok.add(x.members.find((m) => m !== me));
        else if (x.from !== me) incoming++;
      });
      for (const uid of Object.keys(live.docs)) if (!ok.has(uid)) { live.docs[uid](); delete live.docs[uid]; delete live.profiles[uid]; }
      for (const uid of ok) {
        if (live.docs[uid]) continue;
        live.docs[uid] = fs.onSnapshot(fs.doc(db, 'profiles', uid), (p) => {
          live.profiles[uid] = p.exists() ? Object.assign({ uid }, p.data()) : null;
          if (live.profiles[uid]) checkGroup(live.profiles[uid]);
          friendsChanged();
        }, () => {});
      }
      live.ready = true;
      if (incoming !== state.requests) set({ requests: incoming });
      friendsChanged();
    }, () => { live.ready = true; friendsChanged(); });
  }
  function stopFriends() {
    if (live.q) live.q();
    for (const u of Object.values(live.docs)) u();
    Object.assign(live, { q: null, docs: {}, profiles: {}, ready: false });
    for (const k of Object.keys(groupInv)) delete groupInv[k];
    inviteTag = '';
    friendsChanged();
  }
  // Les amis acceptés, avec leur profil public (présence comprise).
  const friendProfiles = () => Object.values(live.profiles).filter(Boolean);
  // Les défis reçus : un ami dont la présence porte notre code ami, vu il y a moins de 5 minutes.
  function invites() {
    if (!state.user) return [];
    const mine = codeOf(state.user.uid);
    const fresh = (p) => Date.now() - (p.seen || 0) < INVITE_MS;
    const duels = friendProfiles()
      .filter((p) => typeof p.where === 'string' && INVITE_RE.test(p.where) && p.where.slice(6) === mine && fresh(p))
      .map((p) => ({ uid: p.uid, name: String(p.pseudo || tr('Créateur')), code: p.where.slice(0, 6) }));
    const groups = friendProfiles()
      .filter((p) => groupInv[p.uid] && groupInv[p.uid].ok && groupInv[p.uid].tag === p.where && fresh(p))
      .map((p) => ({ uid: p.uid, name: String(p.pseudo || tr('Créateur')), code: groupInv[p.uid].code, group: true }));
    return duels.concat(groups);
  }

  async function writeProfile() {
    const { fs } = fb;
    await fs.setDoc(fs.doc(db, 'profiles', state.user.uid), Object.assign(publicProfile(), { updatedAt: fs.serverTimestamp() }));
  }

  // ─── Amis ───────────────────────────────────────────────────
  const pairOf = (a, b) => [a, b].sort().join('_');
  async function profileOf(uid) {
    const s = await fb.fs.getDoc(fb.fs.doc(db, 'profiles', uid));
    return s.exists() ? Object.assign({ uid }, s.data()) : null;
  }
  async function friends() {
    if (!fb || state.status !== 'signedIn') return [];
    const { fs } = fb;
    const me = state.user.uid;
    const q = fs.query(fs.collection(db, 'friends'), fs.where('members', 'array-contains', me));
    const res = await fs.getDocs(q);
    const list = await Promise.all(res.docs.map(async (d) => {
      const f = d.data();
      const other = f.members.find((m) => m !== me);
      return { pair: d.id, status: f.status, incoming: f.status === 'pending' && f.from !== me, profile: await profileOf(other).catch(() => null), uid: other };
    }));
    set({ requests: list.filter((f) => f.incoming).length });
    return list;
  }
  async function refreshRequests() { await friends().catch(() => {}); }
  async function addByCode(raw) {
    if (!fb || state.status !== 'signedIn') return { ok: false, reason: tr('Connectez-vous d’abord.') };
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return { ok: false, reason: tr('Un code ami compte 6 caractères.') };
    const { fs } = fb;
    const me = state.user.uid;
    if (code === codeOf(me)) return { ok: false, reason: tr('C’est votre propre code.') };
    const res = await fs.getDocs(fs.query(fs.collection(db, 'profiles'), fs.where('code', '==', code), fs.limit(1)));
    if (res.empty) return { ok: false, reason: tr('Aucun Créateur avec ce code.') };
    const other = res.docs[0].id;
    const ref = fs.doc(db, 'friends', pairOf(me, other));
    const cur = await fs.getDoc(ref);
    if (cur.exists()) {
      const f = cur.data();
      if (f.status === 'accepted') return { ok: false, reason: tr('Vous êtes déjà amis.') };
      if (f.from === me) return { ok: false, reason: tr('Demande déjà envoyée.') };
      await fs.updateDoc(ref, { status: 'accepted' });
      return { ok: true, accepted: true, name: res.docs[0].data().pseudo };
    }
    await fs.setDoc(ref, { members: [me, other].sort(), from: me, status: 'pending', at: fs.serverTimestamp() });
    return { ok: true, name: res.docs[0].data().pseudo };
  }
  async function accept(pair) { await fb.fs.updateDoc(fb.fs.doc(db, 'friends', pair), { status: 'accepted' }); await refreshRequests(); }
  async function remove(pair) { await fb.fs.deleteDoc(fb.fs.doc(db, 'friends', pair)); await refreshRequests(); }

  // ─── Classement ─────────────────────────────────────────────
  async function leaderboard(scope) {
    if (!fb || state.status !== 'signedIn') return [];
    const { fs } = fb;
    await uploadIfChanged().catch(() => {});
    let rows;
    if (scope === 'amis') {
      const list = (await friends()).filter((f) => f.status === 'accepted' && f.profile).map((f) => f.profile);
      const mine = await profileOf(state.user.uid);
      rows = list.concat(mine ? [mine] : []);
    } else {
      const res = await fs.getDocs(fs.query(fs.collection(db, 'profiles'), fs.orderBy('points', 'desc'), fs.limit(100)));
      rows = res.docs.map((d) => Object.assign({ uid: d.id }, d.data()));
    }
    return rows.filter((p) => p.placed).sort((a, b) => b.points - a.points || b.level - a.level).slice(0, 50);
  }

  // ─── Défi du jour (v84) ─────────────────────────────────────
  // daily/{date}_{uid} : un score par joueur et par jour, écrit une seule fois.
  async function dailySubmit(d, r) {
    if (!fb || state.status !== 'signedIn') return false;
    const { fs } = fb, uid = state.user.uid, pub = publicProfile();
    await fs.setDoc(fs.doc(db, 'daily', d + '_' + uid), {
      d, uid, pseudo: String(pub.pseudo || '').slice(0, 16), tag: String(pub.tag || '').slice(0, 6),
      score: Math.max(0, Math.min(5000, Math.round(r.score) || 0)), win: !!r.win,
      rounds: Math.max(1, Math.min(60, r.rounds | 0)), law: String(r.law || '').slice(0, 16), at: fs.serverTimestamp()
    });
    return true;
  }
  // Les meilleurs du jour (tri ici : pas d'index composé à créer).
  async function dailyTop(d) {
    if (!fb || state.status !== 'signedIn') return [];
    const { fs } = fb;
    const res = await fs.getDocs(fs.query(fs.collection(db, 'daily'), fs.where('d', '==', d), fs.limit(500)));
    return res.docs.map((x) => x.data()).sort((a, b) => b.score - a.score || a.rounds - b.rounds).slice(0, 50);
  }

  window.OrbiteOnline = {
    get configured() { return !!CFG; },
    state,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    boot, signIn, signOut, resolveConflict,
    syncNow: () => uploadNow(),
    myCode: () => (state.user ? codeOf(state.user.uid) : ''),
    friends, addByCode, accept, remove, leaderboard, profileOf, dailySubmit, dailyTop,
    friendProfiles, friendsReady: () => live.ready, invites, setInvite, setGroupInvite,
    codeOf,
    // Accès Firestore pour le multijoueur (js/multi.js).
    fire: () => (db && fb ? { db, fs: fb.fs } : null),
    uid: () => (state.user ? state.user.uid : null)
  };

  // Tests contre les émulateurs uniquement : connexion Google simulée, sans fenêtre.
  if (EMU) {
    window.OrbiteOnline.__emuSignIn = async (email) => {
      await boot();
      const cred = fb.a.GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-' + email, email, email_verified: true, name: email.split('@')[0] }));
      await fb.a.signInWithCredential(auth, cred);
    };
  }

  // Au lancement, la session Google éventuelle est retrouvée en arrière-plan.
  if (CFG && navigator.onLine !== false) setTimeout(() => { boot(); }, 1200);
})();
