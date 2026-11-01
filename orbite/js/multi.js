/* ORBITE — multijoueur en ligne (Firestore).
 * Recherche classée (des créateurs de votre rang) ou partie privée avec un code de session.
 * Chaque téléphone joue sa propre boutique ; à la fin du tour il publie son plateau. L'hôte
 * rassemble les plateaux (et ceux des bots qui complètent la table) dans un document de manche,
 * écrit une seule fois ; chaque téléphone résout alors la manche à l'identique (rules.js, mpResolve).
 *
 * matches/{id}              : { mode, code, status, host, uids, seats, bracket, created, seed, beat, size }
 *                             size : 2 pour un duel (absent : mêlée à 8) ; la graine d'un duel
 *                             commence aussi par « D » (règles en ligne d'avant la v68, sans « size »)
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
  // Places d'une partie : 2 en duel, 8 en mêlée. Un duel se reconnaît à size: 2 ou, si les règles
  // publiées dans Firebase sont plus anciennes que la v68 et refusent ce champ, à sa graine en « D ».
  const DUEL_MARK = 'D';
  // Partie entre amis sans univers rivaux (v93) : la graine commence par « N » suivi du nombre de
  // joueurs (3 à 8), fixé au lancement ; les règles Firestore n'ont pas à changer.
  const seatsOf = (m) => {
    if (!m) return SEATS;
    const seed = String(m.seed || '');
    if (m.size === 2 || seed.charAt(0) === DUEL_MARK) return 2;
    const n = seed.charAt(0) === 'N' ? parseInt(seed.charAt(1), 10) : 0;
    return n >= 3 && n <= SEATS ? n : SEATS;
  };
  // Bots d'une partie privée : le nombre choisi par l'hôte (v95), borné aux places libres ; false
  // (v93) : aucun ; absent : toutes les places libres (recherche classée, mêlée privée).
  const botsOf = (m) => {
    const free = Math.max(0, SEATS - ((m && m.uids) || []).length);
    if (!m || m.bots === false) return 0;
    if (typeof m.bots === 'number') return Math.max(0, Math.min(free, Math.floor(m.bots)));
    return free;
  };
  const denied = (err) => !!err && (err.code === 'permission-denied' || /permission/i.test(err.message || ''));
  const WAIT_MS = F.wait || 40000; // recherche classée : délai avant de compléter avec des bots
  // Temps de boutique : court au début pour jouer vite (25 s, 35 s, 50 s), puis 60 s, 65 s, 70 s
  // et 75 s au plus.
  const SHOP_START = [25000, 35000, 50000];
  const shopMs = (r) => F.shop || (r <= SHOP_START.length ? SHOP_START[Math.max(1, r) - 1] : Math.min(75000, 40000 + 5000 * r));
  const GRACE_MS = F.grace || 12000; // retard toléré après la fin du temps de boutique
  const LAW_MS = F.law || 20000; // choix de la loi
  // Phase de combat commune (v127, comme TFT et Champs de bataille) : tout le monde revient en boutique
  // au même moment et a le même temps d'achat. Sa durée suit le plus long combat de la manche, en
  // étapes (R.mpResolve → longest), que tous les téléphones calculent de la même façon, avec
  // l'accélération des longs combats (game.js playBattle : ×1,5 à 8 s, ×2 à 12 s, ×3 à 16 s, résultat à
  // 22 s), plus le temps du résultat ; entre 12 s et FIGHT_MS. Qui a fini son combat plus tôt attend la
  // fin de la phase (« PROCHAIN TOUR »).
  const FIGHT_MS = F.fight || 32000;
  function fightWindow(steps) {
    if (F.fight) return F.fight;
    let t = 1200, work = (steps || 0) * 300;
    while (work > 0 && t < 22000) { const k = t >= 16000 ? 3 : t >= 12000 ? 2 : t >= 8000 ? 1.5 : 1; t += 100; work -= 100 * k; }
    return Math.max(12000, Math.min(FIGHT_MS, t + 7000));
  }
  const STALE_MS = F.stale || 30000; // hôte silencieux depuis : un autre prend le relais
  const BEAT_MS = 10000;
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const M = {
    mid: null, match: null, mode: null, unsub: [], beat: 0, poll: 0, onChange: null,
    started: false, posts: {}, roundDocs: {}, lastSnaps: {}, locked: null, lockAt: 0, timerRound: 0, deadline: 0, tick: 0, hostRoundStart: {},
    // Heures locales de réception (v126) : du lancement et de chaque manche. Les échéances partent de là
    // et non de l'horloge de l'hôte : un téléphone à l'heure fausse ne décale plus le minuteur.
    roundRecv: {}, startLocal: 0, roundWin: {},
    // Numéro de passage dans un salon (v134) : une attente de manche d'avant un départ ne compte plus,
    // même si l'on revient dans le même salon.
    gen: 0
  };
  const fire = () => { const f = ON.fire(); if (!f || !ON.uid()) throw new Error(tr('Connectez-vous avec Google pour jouer en ligne.')); return f; };
  const uid = () => ON.uid();
  const notify = () => {
    if (M.onChange) try { M.onChange(M); } catch (err) { console.error(err); }
    // La discussion (js/chat.js) suit aussi le salon.
    try { window.dispatchEvent(new Event('orbite-match')); } catch (err) { /* sans importance */ }
  };
  const now = () => Date.now();
  const pseudo = () => String(localStorage.getItem('orbite.pseudo') || tr('Créateur')).slice(0, 16);
  function myClasse() { try { return K.sanitize(JSON.parse(localStorage.getItem('orbite.classe') || 'null')); } catch (err) { return K.fresh(); } }
  function myPoints() { const c = myClasse(); return K.placed(c) ? c.points : 0; }
  const bracketOf = (pts) => K.tierOf(pts).idx;
  // Sa place au salon porte aussi sa police de pseudo, son cadre et sa photo (v96) : les autres
  // joueurs les voient au salon et en partie. Le contenu des places n'est pas contrôlé par les règles
  // Firestore : rien à republier.
  function seatOf() {
    // Son rang voyage aussi (v129) : classé ou non, et ses parties de placement jouées, pour son
    // emblème au salon et en partie.
    const c = myClasse();
    const seat = { uid: uid(), name: pseudo(), points: K.placed(c) ? c.points : 0, placed: K.placed(c), pl: c.placements.length };
    const api = O.api || {};
    const font = api.myFont ? api.myFont() : '', frame = api.myFrame ? api.myFrame() : '', avatar = api.myAvatar ? api.myAvatar() : '';
    if (font) seat.font = font;
    if (frame) seat.frame = frame;
    if (avatar) seat.avatar = avatar;
    return seat;
  }
  const isHost = () => M.match && M.match.host === uid();
  const ref = (...p) => { const { db, fs } = fire(); return fs.doc(db, 'matches', ...p); };

  // ─── Salon ──────────────────────────────────────────────────
  function watch(mid) {
    const { fs } = fire();
    stopWatch();
    M.mid = mid;
    M.unsub.push(fs.onSnapshot(ref(mid), (d) => {
      M.match = d.exists() ? Object.assign({ id: d.id }, d.data()) : null;
      if (M.match && M.match.status === 'playing' && !M.started) {
        M.started = true;
        // Lancement vu en direct : l'heure locale de réception sert de départ ; repris plus tard (rechargé),
        // on garde celle de l'hôte.
        const at = M.match.startAt || 0;
        M.startLocal = at && Math.abs(now() - at) < 15000 ? now() : at;
        if (M.onStart) M.onStart(M);
      }
      notify();
      if (M.started) hostCheck();
    }));
    clearInterval(M.beat);
    M.beat = setInterval(heartbeat, BEAT_MS);
    heartbeat();
  }
  function stopWatch() { for (const u of M.unsub) try { u(); } catch (err) { /* déjà arrêté */ } M.unsub = []; clearInterval(M.beat); stopPoll(); }
  function stopPoll() { clearInterval(M.poll); M.poll = 0; }
  async function heartbeat() {
    if (!M.mid) return;
    try { const { fs } = fire(); await fs.updateDoc(ref(M.mid), { ['beat.' + uid()]: now() }); } catch (err) { /* hors ligne : on réessaiera */ }
  }
  async function create(mode, size) {
    const { db, fs } = fire();
    const id = fs.doc(fs.collection(db, 'matches')).id;
    let code = '';
    for (let i = 0; i < 6; i++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
    const me = seatOf();
    const doc = {
      mode, code, status: 'waiting', host: me.uid, uids: [me.uid], seats: [me], bracket: bracketOf(me.points),
      created: now(), seed: '', beat: { [me.uid]: now() }
    };
    if (size === 2) { doc.size = 2; doc.seed = DUEL_MARK; }
    try { await fs.setDoc(ref(id), doc); } catch (err) {
      // Règles d'avant la v68 : sans le champ « size », la graine marque le duel.
      if (size !== 2 || !denied(err)) throw err;
      delete doc.size;
      await fs.setDoc(ref(id), doc);
    }
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
      if (m.uids.length >= seatsOf(m)) throw new Error(tr('La partie est complète.'));
      t.update(ref(mid), { uids: m.uids.concat([me.uid]), seats: m.seats.concat([me]), ['beat.' + me.uid]: now() });
    });
    watch(mid);
  }
  // Quitter le salon. En pleine partie, opts.away (v134) : on s'absente sans abandonner (la partie se
  // rejoint ensuite, rejoin) ; si l'on était l'hôte, la main passe à un créateur présent, et s'il n'y
  // en a aucun, la table attend notre retour au lieu d'être close.
  async function leave(opts) {
    const mid = M.mid, m = M.match, away = !!(opts && opts.away);
    stopRound();
    stopWatch();
    Object.assign(M, { mid: null, match: null, started: false, posts: {}, roundDocs: {}, lastSnaps: {}, locked: null, timerRound: 0, roundRecv: {}, startLocal: 0, roundWin: {}, backAt: 0, gen: M.gen + 1 });
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
      } else if (m.host === uid()) await handOver(m, mid, away);
    } catch (err) { /* sans importance : le salon expirera */ }
  }

  // Recherche classée : on rejoint le plus ancien salon d'un rang proche ; sinon on ouvre le sien.
  // La tolérance de rang s'élargit avec l'attente ; au bout de 40 s, l'hôte complète avec des bots.
  async function searchRanked(size) {
    stopPoll();
    M.searchOff = false;
    // Chaque recherche a son numéro : une recherche annulée encore en route ne peut plus ouvrir de salon.
    const gen = M.searchGen = (M.searchGen || 0) + 1;
    M.mode = 'ranked';
    M.size = size === 2 ? 2 : SEATS;
    M.searchStart = now();
    await findOrCreate(gen);
    // ANNULER pendant la toute première recherche : le salon ouvert entre-temps est quitté.
    if (M.searchOff || gen !== M.searchGen) { if (gen === M.searchGen) await leave(); return; }
    ensurePoll();
  }
  // Toutes les 3 s : chercher un salon plus ancien, et lancer la partie à l'heure si l'on est l'hôte.
  // Quitter un salon (leave) l'arrête : on la relance dans le nouveau.
  function ensurePoll() {
    if (M.poll || M.searchOff) return;
    M.poll = setInterval(() => { findOrCreate(M.searchGen).catch(() => {}); hostStartCheck(); }, 3000);
  }
  // ANNULER la recherche (v129) : plus de nouvelle recherche, et l'on quitte proprement le salon (le
  // dernier à partir le supprime). Une recherche encore en route s'arrête dès son retour.
  async function cancelSearch() {
    M.searchOff = true;
    stopPoll();
    await leave();
  }
  async function findOrCreate(gen) {
    const off = () => M.searchOff || gen !== M.searchGen;
    if (M.started || off()) { stopPoll(); return; }
    const { db, fs } = fire();
    const b = bracketOf(myPoints()), spread = Math.min(9, Math.floor((now() - M.searchStart) / 10000));
    const res = await fs.getDocs(fs.query(fs.collection(db, 'matches'), fs.where('status', '==', 'waiting'), fs.where('mode', '==', 'ranked'), fs.limit(30)));
    const ok = res.docs.map((d) => Object.assign({ id: d.id }, d.data()))
      .filter((m) => seatsOf(m) === M.size && m.uids.length < seatsOf(m) && Math.abs(m.bracket - b) <= spread && now() - m.created < 120000 && now() - Math.max(...Object.values(m.beat || {}), 0) < STALE_MS)
      .sort((x, y) => x.created - y.created || (x.id < y.id ? -1 : 1));
    const best = ok[0];
    if (M.mid && best && best.id === M.mid) return;
    // Notre propre salon est plus récent qu'un autre : on le quitte pour rejoindre le plus ancien.
    if (best && (!M.mid || (M.match && M.match.uids.length === 1 && (best.created < M.match.created || (best.created === M.match.created && best.id < M.mid))))) {
      if (M.mid) await leave();
      if (off()) return;
      M.mode = 'ranked';
      try { await join(best.id); if (off()) await leave(); else ensurePoll(); return; } catch (err) { /* complet entre-temps */ }
    }
    if (!M.mid && !off()) { await create('ranked', M.size); if (off()) await leave(); else ensurePoll(); }
  }
  function hostStartCheck() {
    const m = M.match;
    if (!m || m.status !== 'waiting' || m.host !== uid() || m.mode !== 'ranked') return;
    if (m.uids.length >= seatsOf(m) || now() - m.created >= WAIT_MS) start();
  }
  async function createPrivate(size) { M.searchOff = true; stopPoll(); M.mode = 'private'; return create('private', size === 2 ? 2 : SEATS); }
  async function joinCode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) throw new Error(tr('Le code compte 6 caractères.'));
    const { db, fs } = fire();
    const res = await fs.getDocs(fs.query(fs.collection(db, 'matches'), fs.where('code', '==', code), fs.where('status', '==', 'waiting'), fs.limit(1)));
    if (res.empty) throw new Error(tr('Aucune partie en attente avec ce code.'));
    M.searchOff = true;
    stopPoll();
    M.mode = 'private';
    await join(res.docs[0].id);
  }
  async function start() {
    const m = M.match;
    if (!m || m.host !== uid() || m.status !== 'waiting') return;
    const a = new Uint32Array(2);
    crypto.getRandomValues(a);
    // La table compte les joueurs présents et les bots choisis par l'hôte : deux places font un duel.
    const total = seatsOf(m) === 2 ? 2 : Math.min(SEATS, m.uids.length + botsOf(m));
    if (total < 2) return;
    const mark = total === 2 ? DUEL_MARK : total < SEATS ? 'N' + total : '';
    const seed = mark + 'MP' + a[0].toString(16).toUpperCase() + a[1].toString(16).toUpperCase();
    try { const { fs } = fire(); await fs.updateDoc(ref(M.mid), { status: 'playing', seed, startAt: now() }); } catch (err) { A.refuse(err.message); }
  }

  // ─── Invitations entre amis (v93) ───────────────────────────
  // Le salon garde les codes amis invités (champ invited, que ses membres peuvent modifier) et le
  // nombre de bots choisi par l'hôte (champ bots).
  async function invite(codes) {
    if (!M.mid || !codes.length) return;
    const { fs } = fire();
    await fs.updateDoc(ref(M.mid), { invited: fs.arrayUnion(...codes) });
  }
  async function setBots(n) {
    if (!M.mid) return;
    const { fs } = fire();
    await fs.updateDoc(ref(M.mid), { bots: Math.max(0, Math.min(SEATS - 1, Math.floor(Number(n) || 0))) });
  }

  // ─── Discussion ─────────────────────────────────────────────
  // Les derniers messages vivent dans le salon (champ chat), que ses membres peuvent modifier : pas
  // de nouvelle règle Firestore à publier. Un message : { id, uid, name, at, q } (message rapide,
  // affiché dans la langue de chacun) ou { …, text } (texte libre, parties privées seulement).
  const CHAT_MAX = 40;
  async function say(msg) {
    if (!M.mid) return;
    const { db, fs } = fire();
    const entry = Object.assign({ id: uid().slice(0, 6) + now().toString(36), uid: uid(), name: pseudo(), at: now() }, msg);
    await fs.runTransaction(db, async (t) => {
      const d = await t.get(ref(M.mid));
      if (!d.exists()) return;
      t.update(ref(M.mid), { chat: (d.data().chat || []).concat([entry]).slice(-CHAT_MAX) });
    });
  }

  // ─── Partie ─────────────────────────────────────────────────
  // Nouvelle partie locale : les familles et la graine sont celles du salon.
  function newState(lawId) {
    const m = M.match, me = uid();
    const families = R.mpFamilies(m.seed);
    const seats = m.seats.filter((s) => s.uid !== me).map((s) => ({ id: s.uid, name: s.name, law: null }));
    // Niveau de la partie : la moyenne des points des autres créateurs humains (pour le barème classé ;
    // les bots n'ont pas de place au salon). Classée (v129) : recherche classée, ou partie entre amis
    // à deux humains ou plus (classement.js, counts).
    const lobby = K.lobbyOf(m.seats, me);
    const humans = m.seats.length;
    // Bots (v132) : niveau de jeu selon le rang de la table, et des points proches pour leur emblème.
    const nBots = Math.max(0, seatsOf(m) - humans);
    const botSkill = K.botSkills ? K.botSkills(m.seats) : undefined;
    const botPoints = K.botPoints ? Array.from({ length: nBots }, (_, i) => K.botPoints(m.seats, m.seed, i)) : undefined;
    const st = R.newGame(m.seed, lawId, { families, seats, size: seatsOf(m), event: 'auto', botSkill, botPoints, mp: { me, mid: M.mid, mode: m.mode, lobby, humans, ranked: K.counts(m.mode, humans) } });
    st.players[0].name = pseudo();
    M.posts = {}; M.roundDocs = {}; M.lastSnaps = {}; M.locked = null; M.timerRound = 0; M.roundRecv = {}; M.roundWin = {};
    listenPosts();
    listenRounds();
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
  // Chaque manche écrite est notée dès sa réception (v134), même si l'on fait encore ses achats : un
  // téléphone en retard (revenu dans la partie, combat plus long) repart ainsi de la même heure que les
  // autres pour la phase de combat suivante, et se recale en une manche. Avant, l'heure n'était notée
  // qu'une fois son propre tour fini : un retard plus long que la tolérance de l'hôte ne se rattrapait
  // jamais.
  function listenRounds() {
    const { db, fs } = fire();
    const mid = M.mid;
    M.unsub.push(fs.onSnapshot(fs.collection(db, 'matches', mid, 'rounds'), (q) => {
      if (M.mid !== mid) return;
      for (const d of q.docs) {
        const v = d.data(), r = Number(v.r);
        if (!r) continue;
        if (!M.roundRecv[r]) M.roundRecv[r] = now();
        if (!M.roundDocs[r]) M.roundDocs[r] = v;
      }
    }));
  }
  // Humains encore en lice (selon l'état local, identique partout).
  function aliveHumans(st) { return st.players.filter((p) => p.alive && !p.bot).map((p) => (p.id === 'you' ? uid() : p.id)); }
  // Créateurs prêts (v131) : ceux qui ont déjà publié leur système de cette manche. Quand tous le sont,
  // l'hôte écrit la manche sans attendre la fin du temps (assemble).
  function readyOf(st) {
    const hs = aliveHumans(st);
    return { n: hs.filter((g) => M.posts[g] && M.posts[g].r === st.round).length, total: hs.length };
  }

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
    // Parti entre-temps (menu principal, v134) : la manche se rattrapera au retour.
    if (!doc) return { ok: false, away: true, reason: '' };
    M.lastSnaps = Object.assign({}, M.lastSnaps, doc.snaps);
    const res = R.mpResolve(st, doc.snaps, lk.endEvents);
    M.roundWin[r] = fightWindow(res.longest);
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
      // Absent dès la première manche (v134) : son plateau annoncé au départ (posts, r: 0) ; chaque
      // manche garde ainsi le système de chaque créateur, pour qu'il puisse la rattraper en revenant.
      else if (p && p.snap) snaps[g] = p.snap;
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
  // Rend null si l'on a quitté ce salon entre-temps (v134).
  function waitRound(r) {
    const { fs } = fire();
    const mid = M.mid, gen = M.gen, gone = () => M.mid !== mid || M.gen !== gen;
    return new Promise((resolve) => {
      let done = false, un = null, chk = 0, k = 0;
      const stop = (v) => { if (done) return; done = true; clearInterval(chk); if (un) un(); resolve(v); };
      un = fs.onSnapshot(ref(mid, 'rounds', String(r)), (d) => {
        if (done || !d.exists()) return;
        if (gone()) { stop(null); return; }
        M.roundDocs[r] = d.data();
        if (!M.roundRecv[r]) M.roundRecv[r] = now();
        stop(d.data());
      });
      if (done) { un(); return; }
      // Hôte muet trop longtemps : on reprend la main (les bots jouent alors chez nous).
      chk = setInterval(() => { if (gone()) stop(null); else if (++k % 5 === 0) takeOverIfStale(r); }, 1000);
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
  // Éliminé ou parti : l'hôte passe la main au prochain humain encore présent. Le salon et son
  // identifiant sont passés par leave, qui a déjà vidé l'état du module (avant la v134, la main ne
  // passait donc jamais en quittant). Absent seulement (away) : la main ne va qu'à un créateur présent ;
  // sans personne, on reste l'hôte et la table attend notre retour.
  async function handOver(mm, mid, away) {
    const m = mm || M.match, id = mid || M.mid;
    if (!m || !id || m.host !== uid()) return;
    const st = O.ui.state;
    const alive = st && st.mp ? aliveHumans(st).filter((g) => g !== uid()) : [];
    const next = alive.find((g) => now() - ((m.beat || {})[g] || 0) < STALE_MS) || (away ? null : alive[0]);
    if (!next && away) return;
    try {
      const { fs } = fire();
      if (next) await fs.updateDoc(ref(id), { host: next });
      else await fs.updateDoc(ref(id), { status: 'done' });
    } catch (err) { /* sans importance */ }
  }
  // Mode spectateur en ligne (v105) : éliminé, on suit les manches que l'hôte écrit et on les rejoue
  // ici, comme les autres téléphones. S'il ne reste plus que des bots (plus personne n'écrit de
  // manche), la suite se joue sur ce téléphone. Rend null si l'on a cessé de regarder entre-temps.
  async function watchNext(st) {
    const humans = st.players.some((p) => p.alive && p.remote);
    if (!humans || !M.mid || (M.match && M.match.status === 'done')) return R.endTurn(st, { observer: true, watch: true });
    const r = st.round;
    const doc = M.roundDocs[r] || await waitRound(r);
    if (!doc || st.over || !st.watching || st.round !== r) return null;
    M.lastSnaps = Object.assign({}, M.lastSnaps, doc.snaps);
    const res = R.mpResolve(st, doc.snaps, [], { watch: true });
    M.roundWin[r] = fightWindow(res.longest);
    return res;
  }
  // Éliminé : l'hôte passe la main à un humain encore en lice (ou clôt la partie).
  function finished() {
    stopRound();
    if (isHost()) handOver();
  }

  // ─── Reprise d'une partie (v134) ────────────────────────────
  // Parti sans le vouloir (appli fermée, plantage, réseau coupé, menu principal) : on revient avec sa
  // partie sauvegardée. Son univers a continué de se battre avec son dernier système (l'hôte le
  // garde, assemble) ; on relit les manches écrites depuis et on les rejoue ici (R.mpCatchUp), puis
  // le module repart sur ce salon comme au lancement. Rend { gone } si la partie n'existe plus pour
  // nous ; sinon { ok, rounds (manches rattrapées), over (éliminé pendant l'absence) }.
  async function peek(mid) {
    const { fs } = fire();
    const d = await fs.getDoc(ref(mid));
    return d.exists() ? Object.assign({ id: d.id }, d.data()) : null;
  }
  async function roundsFrom(mid, r0) {
    const { fs } = fire();
    const docs = {};
    // Par paquets de 4, jusqu'à la première manche pas encore écrite.
    for (let r = Math.max(1, r0); r < r0 + 120; r += 4) {
      const got = await Promise.all([0, 1, 2, 3].map((i) => fs.getDoc(ref(mid, 'rounds', String(r + i)))));
      let end = false;
      got.forEach((d, i) => { if (end || !d.exists()) { end = true; return; } docs[r + i] = d.data(); });
      if (end) break;
    }
    return docs;
  }
  async function rejoin(st) {
    const mid = st && st.mp && st.mp.mid;
    if (!mid || st.mp.me !== uid()) return { gone: 'account' };
    const m = await peek(mid);
    if (!m || !Array.isArray(m.uids) || !m.uids.includes(uid()) || !m.seed) return { gone: 'missing' };
    const docs = await roundsFrom(mid, st.round - 1);
    const caught = R.mpCatchUp(st, docs);
    stopRound();
    stopWatch();
    stopPoll();
    Object.assign(M, {
      mid, match: m, mode: m.mode, started: true, posts: {}, roundDocs: docs, lastSnaps: {}, locked: null, timerRound: 0,
      roundRecv: {}, roundWin: {}, startLocal: m.startAt || now(), searchOff: true, backAt: now(), gen: M.gen + 1
    });
    for (const r of Object.keys(docs).map(Number).sort((a, b) => a - b)) Object.assign(M.lastSnaps, docs[r].snaps || {});
    // La boutique en cours finit à la même heure pour tous : réception de la manche précédente (heure de
    // l'hôte, bornée à la nôtre) + sa phase de combat, d'après son plus long combat (gardé dans l'historique).
    const prevR = st.round - 1, prev = docs[prevR];
    if (prev) {
      const at = Number(prev.at) || 0;
      M.roundRecv[prevR] = at && now() - at < 15 * 60000 ? Math.min(at, now()) : now();
      const h = (st.history || []).find((x) => x.round === prevR);
      M.roundWin[prevR] = fightWindow(h ? h.results.reduce((a, x) => Math.max(a, x.steps || 0), 0) : 0);
    }
    watch(mid);
    listenPosts();
    listenRounds();
    if (st.over) finished();
    else if (m.status === 'done') {
      // Close alors que nous sommes encore en lice (plus aucun autre créateur) : la partie reprend avec nous.
      try { const { fs } = fire(); await fs.updateDoc(ref(mid), { status: 'playing', host: uid() }); } catch (err) { /* on jouera tout de même */ }
    }
    return { ok: true, rounds: caught.rounds, over: !!st.over };
  }

  // Fin de la boutique de la manche r : la même pour tous (v126). La manche 1 suit le choix des lois ;
  // les suivantes, la réception du document de la manche précédente (tous les téléphones le reçoivent
  // au même moment, à la latence près), plus la fenêtre de combat et le temps d'achat.
  const startBase = () => M.startLocal || (M.match && M.match.startAt) || now();
  // Retour en boutique de la manche r, le même pour tous (v127) : réception de la manche précédente +
  // durée de sa phase de combat.
  function shopStart(r) {
    if (r <= 1) return 0;
    const prev = M.roundDocs[r - 1];
    return (M.roundRecv[r - 1] || (prev && prev.at) || now()) + (M.roundWin[r - 1] || FIGHT_MS);
  }
  function deadlineOf(r) {
    if (r <= 1) return startBase() + LAW_MS + shopMs(1);
    return shopStart(r) + shopMs(r);
  }

  // ─── Minuteur de boutique ───────────────────────────────────
  // Démarre à chaque nouvelle manche ; à zéro, le tour se termine tout seul.
  function startRound() {
    clearInterval(M.tick);
    document.body.classList.add('mp-game');
    M.tick = setInterval(() => {
      const st = O.ui.state, el = document.getElementById('mpTimer'), btn = document.getElementById('fightBtn');
      if (!st || !st.mp || st.mp.mid !== M.mid) { stopRound(); return; }
      if (st.round !== M.timerRound) {
        // Le compte à rebours s'affiche quand la boutique revient à l'écran (v106) ; l'échéance est la
        // même pour tous (v126) : un combat court laisse plus de temps, un long combat accéléré moins.
        if (st.round > 1 && (O.ui.busy || document.body.classList.contains('in-combat'))) return;
        M.timerRound = st.round;
        // Garde-fou : un téléphone très lent, sorti tard de son combat, garde au moins 8 s pour acheter,
        // mais jamais au-delà de la patience de l'hôte (v134) : son système doit compter pour cette
        // manche, et il se recale ainsi sur les autres dès la suivante (sinon il restait en retard d'une
        // manche, ses achats toujours pris trop tard).
        const due = deadlineOf(st.round);
        M.deadline = st.round <= 1 ? due : Math.max(due, Math.min(now() + 8000, due + GRACE_MS - 2000));
        // De retour dans la partie (v134) : jusqu'à 10 s de plus pour se retrouver, sans dépasser la
        // tolérance de l'hôte (son système doit arriver avant que la manche ne s'écrive sans lui).
        if (M.backAt) { M.deadline = Math.max(M.deadline, Math.min(M.backAt + 10000, due + GRACE_MS - 2000)); M.backAt = 0; }
      }
      const left = Math.max(0, M.deadline - now());
      const txt = Math.floor(left / 60000) + ':' + String(Math.ceil(left / 1000) % 60).padStart(2, '0');
      // Un seul compte à rebours (v104) : en gros chiffres dans le bouton de combat. Depuis la v131, on
      // le touche (deux fois) pour être PRÊT ; le nombre de créateurs prêts s'affiche au-dessus.
      if (el) el.hidden = true;
      if (btn) {
        const count = st.phase === 'shop';
        const r = readyOf(st);
        btn.disabled = !count || !!O.ui.busy;
        btn.classList.toggle('mp-count', count);
        btn.classList.toggle('low', count && left < 10000);
        const head = tr('PRÊT ?') + (r.total > 1 && r.n ? ' · ' + r.n + '/' + r.total : '');
        const html = count ? `<small>${head}</small><b>${txt}</b>` : tr('COMBAT');
        if (btn.innerHTML !== html) btn.innerHTML = html;
      }
      // Les 5 dernières secondes : un cadre rouge léger palpite autour de l'écran, le téléphone vibre
      // et un tic d'horloge sonne à chaque seconde (v103).
      const hurry = st.phase === 'shop' && !O.ui.busy && left > 0 && left <= 5000;
      document.body.classList.toggle('mp-hurry', hurry);
      const sec = Math.ceil(left / 1000);
      if (hurry && sec !== M.hurrySec) { M.hurrySec = sec; A.vibrate(25); if (window.OrbiteSfx && window.OrbiteSfx.tick) window.OrbiteSfx.tick(sec); }
      if (st.phase !== 'shop' || O.ui.busy || left > 0) return;
      const me = st.players[0];
      if (me.discover.length) R.choose(st, 0, me);
      if (me.relicChoice && me.relicChoice.length && O.autoRelic) O.autoRelic();
      O.ui.mpAuto = true;
      try { O.fight(); } finally { O.ui.mpAuto = false; }
    }, 250);
  }
  function stopRound() {
    clearInterval(M.tick); clearTimeout(M.asmT);
    document.body.classList.remove('mp-game', 'mp-hurry');
    const el = document.getElementById('mpTimer'), btn = document.getElementById('fightBtn');
    if (el) el.hidden = true;
    if (btn) { btn.disabled = false; btn.classList.remove('mp-count', 'low'); btn.textContent = tr('COMBATTRE'); }
  }

  window.OrbiteMulti = {
    get state() { return M; },
    searchRanked, cancelSearch, createPrivate, joinCode, start, leave, invite, setBots, newState, lawChoices, endTurn, startRound, stopRound, isHost, say, watchNext, rejoin,
    SEATS, seatsOf, botsOf, WAIT_MS, LAW_MS, startBase, shopStart, fightWindow, readyOf,
    // La partie de ce salon comptera-t-elle pour le classement ? (humains présents au salon)
    rankedOf: (m) => !!m && K.counts(m.mode, (m.uids || []).length)
  };
})();
