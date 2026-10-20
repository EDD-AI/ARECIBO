/* ORBITE — multijoueur en ligne (Firestore).
 * Recherche classée (des créateurs de votre rang) ou partie privée avec un code de session.
 * Chaque téléphone joue sa propre boutique ; à la fin du tour il publie son plateau. L'hôte
 * rassemble les plateaux (et ceux des bots qui complètent la table) dans un document de manche,
 * écrit une seule fois ; chaque téléphone résout alors la manche à l'identique (rules.js, mpResolve).
 *
 * matches/{id}              : { mode, code, status, host, uids, seats, bracket, created, seed, beat }
 * matches/{id}/posts/{uid}  : { r, snap } — le dernier plateau publié par chaque joueur
 * matches/{id}/rounds/{r}   : { r, snaps, by } — les plateaux retenus pour la manche r */
(function () {
  'use strict';
  const O = window.__orbite, ON = window.OrbiteOnline, K = window.OrbiteClassement;
  if (!O || !ON) return;
  const R = O.rules, A = O.api;
  const tr = window.tr || ((s) => s);
  // Réglages (raccourcis par les tests via window.ORBITE_MP_FAST).
  const F = window.ORBITE_MP_FAST || {};
  const SEATS = 8;
  const WAIT_MS = F.wait || 40000; // recherche classée : délai avant de compléter avec des bots
  const shopMs = (r) => F.shop || Math.min(75000, 40000 + 5000 * r);
  const GRACE_MS = F.grace || 20000; // retard toléré après la fin du temps de boutique
  const LAW_MS = F.law || 20000; // choix de la loi
  const BATTLE_MS = F.battle || 25000; // le temps des combats, avant la boutique suivante
  const STALE_MS = F.stale || 30000; // hôte silencieux depuis : un autre prend le relais
  const BEAT_MS = 10000;
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const M = {
    mid: null, match: null, mode: null, unsub: [], beat: 0, poll: 0, onChange: null,
    started: false, posts: {}, roundDocs: {}, lastSnaps: {}, locked: null, lockAt: 0, timerRound: 0, deadline: 0, tick: 0, hostRoundStart: {}
  };
  const fire = () => { const f = ON.fire(); if (!f || !ON.uid()) throw new Error(tr('Connectez-vous avec Google pour jouer en ligne.')); return f; };
  const uid = () => ON.uid();
  const notify = () => { if (M.onChange) try { M.onChange(M); } catch (err) { console.error(err); } };
  const now = () => Date.now();
  const pseudo = () => String(localStorage.getItem('orbite.pseudo') || tr('Créateur')).slice(0, 16);
  function myPoints() { try { const c = K.sanitize(JSON.parse(localStorage.getItem('orbite.classe') || 'null')); return K.placed(c) ? c.points : 0; } catch (err) { return 0; } }
  const bracketOf = (pts) => K.tierOf(pts).idx;
  const seatOf = () => ({ uid: uid(), name: pseudo(), points: myPoints() });
  const isHost = () => M.match && M.match.host === uid();
  const ref = (...p) => { const { db, fs } = fire(); return fs.doc(db, 'matches', ...p); };

  // ─── Salon ──────────────────────────────────────────────────
  function watch(mid) {
    const { fs } = fire();
    stopWatch();
    M.mid = mid;
    M.unsub.push(fs.onSnapshot(ref(mid), (d) => {
      M.match = d.exists() ? Object.assign({ id: d.id }, d.data()) : null;
      if (M.match && M.match.status === 'playing' && !M.started) { M.started = true; if (M.onStart) M.onStart(M); }
      notify();
      if (M.started) hostCheck();
    }));
    clearInterval(M.beat);
    M.beat = setInterval(heartbeat, BEAT_MS);
    heartbeat();
  }
  function stopWatch() { for (const u of M.unsub) try { u(); } catch (err) { /* déjà arrêté */ } M.unsub = []; clearInterval(M.beat); clearInterval(M.poll); }
  async function heartbeat() {
    if (!M.mid) return;
    try { const { fs } = fire(); await fs.updateDoc(ref(M.mid), { ['beat.' + uid()]: now() }); } catch (err) { /* hors ligne : on réessaiera */ }
  }
  async function create(mode) {
    const { db, fs } = fire();
    const id = fs.doc(fs.collection(db, 'matches')).id;
    let code = '';
    for (let i = 0; i < 6; i++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    const me = seatOf();
    await fs.setDoc(ref(id), {
      mode, code, status: 'waiting', host: me.uid, uids: [me.uid], seats: [me], bracket: bracketOf(me.points),
      created: now(), seed: '', beat: { [me.uid]: now() }
    });
    M.mode = mode;
    watch(id);
    return id;
  }
  async function join(mid) {
    const { db, fs } = fire();
    const me = seatOf();
    await fs.runTransaction(db, async (t) => {
      const d = await t.get(ref(mid));
      if (!d.exists()) throw new Error(tr('Cette partie n’existe plus.'));
      const m = d.data();
      if (m.uids.includes(me.uid)) return;
      if (m.status !== 'waiting') throw new Error(tr('La partie a déjà commencé.'));
      if (m.uids.length >= SEATS) throw new Error(tr('La partie est complète.'));
      t.update(ref(mid), { uids: m.uids.concat([me.uid]), seats: m.seats.concat([me]), ['beat.' + me.uid]: now() });
    });
    watch(mid);
  }
  async function leave() {
    const mid = M.mid, m = M.match;
    stopRound();
    stopWatch();
    Object.assign(M, { mid: null, match: null, started: false, posts: {}, roundDocs: {}, lastSnaps: {}, locked: null, timerRound: 0 });
    notify();
    if (!mid || !m) return;
    try {
      const { db, fs } = fire();
      if (m.status === 'waiting') {
        await fs.runTransaction(db, async (t) => {
          const d = await t.get(ref(mid));
          if (!d.exists()) return;
          const x = d.data();
          const uids = x.uids.filter((u) => u !== uid());
          if (!uids.length) { t.delete(ref(mid)); return; }
          t.update(ref(mid), { uids, seats: x.seats.filter((s) => s.uid !== uid()), host: x.host === uid() ? uids[0] : x.host });
        });
      } else if (m.host === uid()) await handOver();
    } catch (err) { /* sans importance : le salon expirera */ }
  }

  // Recherche classée : on rejoint le plus ancien salon d'un rang proche ; sinon on ouvre le sien.
  // La tolérance de rang s'élargit avec l'attente ; au bout de 40 s, l'hôte complète avec des bots.
  async function searchRanked() {
    M.mode = 'ranked';
    M.searchStart = now();
    await findOrCreate();
    clearInterval(M.poll);
    M.poll = setInterval(() => { findOrCreate().catch(() => {}); hostStartCheck(); }, 3000);
  }
  async function findOrCreate() {
    if (M.started) { clearInterval(M.poll); return; }
    const { db, fs } = fire();
    const b = bracketOf(myPoints()), spread = Math.min(9, Math.floor((now() - M.searchStart) / 10000));
    const res = await fs.getDocs(fs.query(fs.collection(db, 'matches'), fs.where('status', '==', 'waiting'), fs.where('mode', '==', 'ranked'), fs.limit(30)));
    const ok = res.docs.map((d) => Object.assign({ id: d.id }, d.data()))
      .filter((m) => m.uids.length < SEATS && Math.abs(m.bracket - b) <= spread && now() - m.created < 120000 && now() - Math.max(...Object.values(m.beat || {}), 0) < STALE_MS)
      .sort((x, y) => x.created - y.created || (x.id < y.id ? -1 : 1));
    const best = ok[0];
    if (M.mid && best && best.id === M.mid) return;
    // Notre propre salon est plus récent qu'un autre : on le quitte pour rejoindre le plus ancien.
    if (best && (!M.mid || (M.match && M.match.uids.length === 1 && (best.created < M.match.created || (best.created === M.match.created && best.id < M.mid))))) {
      if (M.mid) await leave();
      M.mode = 'ranked';
      try { await join(best.id); return; } catch (err) { /* complet entre-temps */ }
    }
    if (!M.mid) await create('ranked');
  }
  function hostStartCheck() {
    const m = M.match;
    if (!m || m.status !== 'waiting' || m.host !== uid() || m.mode !== 'ranked') return;
    if (m.uids.length >= SEATS || now() - m.created >= WAIT_MS) start();
  }
  async function createPrivate() { M.mode = 'private'; return create('private'); }
  async function joinCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) throw new Error(tr('Le code compte 6 caractères.'));
    const { db, fs } = fire();
    const res = await fs.getDocs(fs.query(fs.collection(db, 'matches'), fs.where('code', '==', code), fs.where('status', '==', 'waiting'), fs.limit(1)));
    if (res.empty) throw new Error(tr('Aucune partie en attente avec ce code.'));
    M.mode = 'private';
    await join(res.docs[0].id);
  }
  async function start() {
    const m = M.match;
    if (!m || m.host !== uid() || m.status !== 'waiting') return;
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    const seed = 'MP' + a[0].toString(16).toUpperCase() + a[1].toString(16).toUpperCase();
    try { const { fs } = fire(); await fs.updateDoc(ref(M.mid), { status: 'playing', seed, startAt: now() }); } catch (err) { A.refuse(err.message); }
  }

  // ─── Partie ─────────────────────────────────────────────────
  // Nouvelle partie locale : les familles et la graine sont celles du salon.
  function newState(lawId) {
    const m = M.match, me = uid();
    const families = R.mpFamilies(m.seed);
    const seats = m.seats.filter((s) => s.uid !== me).map((s) => ({ id: s.uid, name: s.name, law: null }));
    // Niveau de la partie : la moyenne des points des autres créateurs (pour le barème classé).
    const others = m.seats.filter((s) => s.uid !== me);
    const lobby = others.length ? Math.round(others.reduce((n, s) => n + (s.points || 0), 0) / others.length) : null;
    const st = R.newGame(m.seed, lawId, { families, seats, mp: { me, mid: M.mid, mode: m.mode, lobby } });
    st.players[0].name = pseudo();
    M.posts = {}; M.roundDocs = {}; M.lastSnaps = {}; M.locked = null; M.timerRound = 0;
    listenPosts();
    // Sa loi est annoncée tout de suite : les autres voient ses vrais PV dès la première manche.
    try { const { fs } = fire(); fs.setDoc(ref(M.mid, 'posts', me), { r: 0, snap: R.snapshotOf(st, st.players[0]), at: now() }).catch(() => {}); } catch (err) { /* hors ligne */ }
    return st;
  }
  const lawChoices = () => R.mpLawChoices(M.match.seed, R.mpFamilies(M.match.seed), uid());
  function listenPosts() {
    const { db, fs } = fire();
    M.unsub.push(fs.onSnapshot(fs.collection(db, 'matches', M.mid, 'posts'), (q) => {
      for (const d of q.docs) M.posts[d.id] = d.data();
      const st = O.ui.state;
      if (st && st.mp && st.mp.mid === M.mid) for (const [g, p] of Object.entries(M.posts)) if (p.snap) R.mpSeatLaw(st.players.find((x) => x.id === g), p.snap.law);
      if (isHost()) assemble();
    }));
  }
  // Humains encore en lice (selon l'état local, identique partout).
  function aliveHumans(st) { return st.players.filter((p) => p.alive && !p.bot).map((p) => (p.id === 'you' ? uid() : p.id)); }

  // Fin du tour (appelée par game.js à la place de R.endTurn).
  async function endTurn(st, onWait) {
    const host = isHost();
    const lk = R.mpLock(st, host);
    if (!lk.ok) return lk;
    const r = st.round;
    M.locked = { r, st, endEvents: lk.endEvents, bots: host };
    M.lockAt = now();
    const { fs } = fire();
    try { await fs.setDoc(ref(M.mid, 'posts', uid()), { r, snap: R.snapshotOf(st, st.players[0]), at: now() }); } catch (err) { console.error(err); }
    if (onWait) onWait();
    if (host) assemble(); else hostCheck();
    const doc = await waitRound(r);
    M.locked = null;
    M.lastSnaps = Object.assign({}, M.lastSnaps, doc.snaps);
    const res = R.mpResolve(st, doc.snaps, lk.endEvents);
    if (res.over) finished();
    return res;
  }
  // L'hôte écrit la manche quand tous les humains en lice ont publié, ou à l'échéance.
  async function assemble() {
    const L = M.locked;
    if (!L || !isHost() || M.roundDocs[L.r] || L.writing) return;
    const st = L.st, r = L.r;
    const humans = aliveHumans(st);
    const ready = humans.every((g) => M.posts[g] && M.posts[g].r === r);
    if (!ready && now() < deadlineOf(r) + GRACE_MS) { clearTimeout(M.asmT); M.asmT = setTimeout(assemble, 2000); return; }
    const snaps = {};
    for (const g of humans) {
      const p = M.posts[g];
      if (p && p.r === r) snaps[g] = p.snap;
      else if (M.lastSnaps[g]) snaps[g] = M.lastSnaps[g];
    }
    snaps[uid()] = R.snapshotOf(st, st.players[0]);
    for (const p of st.players) if (p.bot && p.alive) snaps[p.id] = R.snapshotOf(st, p);
    L.writing = true;
    try {
      const { db, fs } = fire();
      // Écrite une seule fois : si un autre hôte l'a déjà fait, on garde la sienne.
      await fs.runTransaction(db, async (t) => {
        const d = await t.get(ref(M.mid, 'rounds', String(r)));
        if (!d.exists()) t.set(ref(M.mid, 'rounds', String(r)), { r, snaps, by: uid(), at: now() });
      });
    } catch (err) { console.error(err); L.writing = false; setTimeout(assemble, 3000); }
  }
  function waitRound(r) {
    const { fs } = fire();
    return new Promise((resolve) => {
      let done = false;
      const un = fs.onSnapshot(ref(M.mid, 'rounds', String(r)), (d) => {
        if (done || !d.exists()) return;
        done = true;
        M.roundDocs[r] = d.data();
        clearInterval(chk);
        un();
        resolve(d.data());
      });
      // Hôte muet trop longtemps : on reprend la main (les bots jouent alors chez nous).
      const chk = setInterval(() => { if (!done) takeOverIfStale(r); }, 5000);
    });
  }
  // Devenu hôte en cours de manche : les bots jouent chez nous avant d'écrire la manche.
  function hostCheck() {
    const L = M.locked;
    if (!L || !isHost()) return;
    if (!L.bots) { R.mpHostBots(L.st); L.bots = true; }
    assemble();
  }
  async function takeOverIfStale(r) {
    const m = M.match;
    if (!m || isHost() || !M.locked) return;
    const last = (m.beat || {})[m.host] || 0;
    if (now() - last < STALE_MS || now() < deadlineOf(r) + GRACE_MS) return;
    try {
      const { db, fs } = fire();
      let won = false;
      await fs.runTransaction(db, async (t) => {
        const d = await t.get(ref(M.mid));
        const x = d.data();
        if (x.host !== m.host || now() - ((x.beat || {})[x.host] || 0) < STALE_MS) return;
        t.update(ref(M.mid), { host: uid() });
        won = true;
      });
      if (won && M.locked && M.locked.r === r) hostCheck();
    } catch (err) { /* un autre a pris le relais */ }
  }
  // Éliminé ou parti : l'hôte passe la main au prochain humain encore présent.
  async function handOver() {
    const m = M.match;
    if (!m || m.host !== uid()) return;
    const st = O.ui.state;
    const alive = st && st.mp ? aliveHumans(st).filter((g) => g !== uid()) : [];
    const next = alive.find((g) => now() - ((m.beat || {})[g] || 0) < STALE_MS) || alive[0];
    try {
      const { fs } = fire();
      if (next) await fs.updateDoc(ref(M.mid), { host: next });
      else await fs.updateDoc(ref(M.mid), { status: 'done' });
    } catch (err) { /* sans importance */ }
  }
  // Éliminé : l'hôte passe la main à un humain encore en lice (ou clôt la partie).
  function finished() {
    stopRound();
    if (isHost()) handOver();
  }

  // Fin de la boutique de la manche r : la même pour tous (horloge de l'hôte). La manche 1 suit
  // le choix des lois ; les suivantes, le document de la manche précédente et le temps des combats.
  function deadlineOf(r) {
    if (r <= 1) return (M.match && M.match.startAt ? M.match.startAt : now()) + LAW_MS + shopMs(1);
    const prev = M.roundDocs[r - 1];
    return (prev && prev.at ? prev.at : now()) + BATTLE_MS + shopMs(r);
  }

  // ─── Minuteur de boutique ───────────────────────────────────
  // Démarre à chaque nouvelle manche ; à zéro, le tour se termine tout seul.
  function startRound() {
    clearInterval(M.tick);
    document.body.classList.add('mp-game');
    M.tick = setInterval(() => {
      const st = O.ui.state, el = document.getElementById('mpTimer'), btn = document.getElementById('fightBtn');
      if (!st || !st.mp || st.mp.mid !== M.mid) { stopRound(); return; }
      if (st.round !== M.timerRound) { M.timerRound = st.round; M.deadline = deadlineOf(st.round); }
      const left = Math.max(0, M.deadline - now());
      const txt = Math.floor(left / 60000) + ':' + String(Math.ceil(left / 1000) % 60).padStart(2, '0');
      if (el) { el.hidden = st.phase !== 'shop'; el.textContent = txt; el.classList.toggle('low', left < 10000); }
      // Le bouton de combat devient le compte à rebours : on ne peut pas finir son tour en avance.
      if (btn) { btn.disabled = true; btn.textContent = st.phase === 'shop' ? tr('COMBAT DANS {t}', { t: txt }) : tr('COMBAT'); }
      if (st.phase !== 'shop' || O.ui.busy || left > 0) return;
      const me = st.players[0];
      if (me.discover.length) R.choose(st, 0, me);
      O.ui.mpAuto = true;
      try { O.fight(); } finally { O.ui.mpAuto = false; }
    }, 250);
  }
  function stopRound() {
    clearInterval(M.tick); clearTimeout(M.asmT);
    document.body.classList.remove('mp-game');
    const el = document.getElementById('mpTimer'), btn = document.getElementById('fightBtn');
    if (el) el.hidden = true;
    if (btn) { btn.disabled = false; btn.textContent = tr('COMBATTRE'); }
  }

  window.OrbiteMulti = {
    get state() { return M; },
    searchRanked, createPrivate, joinCode, start, leave, newState, lawChoices, endTurn, startRound, stopRound, isHost,
    SEATS, WAIT_MS, LAW_MS
  };
})();
