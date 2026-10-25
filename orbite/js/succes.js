/* ORBITE — succès : 100 objectifs répartis en 10 catégories, débloqués en jouant (parties,
 * familles, lois, légendaires, exploits, en ligne, Création, colonie, expédition, divers).
 * Chacun rapporte des graines de vie. La progression se lit dans les données du jeu ; ce qui ne
 * s'y trouve pas (familles jouées, exploits d'une partie…) est compté en fin de partie (record). */
(function () {
  'use strict';
  const O = window.__orbite;
  if (!O) return;
  const A = O.api, R = O.rules, SFX = window.OrbiteSfx, K = window.OrbiteClassement;
  const $ = (id) => document.getElementById(id);
  const tr = window.tr || ((s) => s);
  const DONE_KEY = 'orbite.succes';
  const COUNT_KEY = 'orbite.succes.c';
  const read = (k, d) => { try { return Object.assign(d, JSON.parse(localStorage.getItem(k) || '{}')); } catch (err) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (err) { /* stockage indisponible */ } };
  const counters = () => read(COUNT_KEY, { famGames: {}, famWins: {}, lawWins: {}, legends: {}, unbeaten: 0, close: 0, marathon: 0, fast: 0, fullBoard: 0, triGold: 0, alliance: 0, phenixWin: 0, mpGames: 0, mpWins: 0, private: 0 });

  // ─── Catalogue ──────────────────────────────────────────────
  const CATS = [['parties', 'AFFRONTEMENT'], ['familles', 'FAMILLES'], ['lois', 'LOIS'], ['legendes', 'LÉGENDAIRES'], ['exploits', 'EXPLOITS'], ['ligne', 'EN LIGNE'], ['creation', 'CRÉATION'], ['colonie', 'COLONIE'], ['expedition', 'EXPÉDITION'], ['divers', 'DIVERS']];
  const LIST = [];
  // name / text : clés françaises (traduites) ; vars : leurs variables ; of(f) : la valeur atteinte.
  const add = (id, cat, name, text, goal, of, seeds, vars) => LIST.push({ id, cat, name, text, goal, of, seeds, vars: vars || {} });
  const tiers = (base, cat, names, goals, text1, textN, of, seeds) => goals.forEach((g, i) => add(base + g, cat, names[i], g === 1 && text1 ? text1 : textN, g, of, seeds[i], { n: g }));

  tiers('parties', 'parties', ['Premier cycle', 'Habitué des étoiles', 'Vétéran cosmique', 'Centenaire', 'Architecte du temps', 'Éternel'], [1, 10, 50, 100, 250, 500], 'Jouer votre première partie.', 'Jouer {n} parties.', (f) => f.st.games, [1, 1, 2, 3, 4, 5]);
  tiers('victoires', 'parties', ['Première victoire', 'Conquérant', 'Dominateur', 'Souverain', 'Empereur des astres'], [1, 5, 25, 50, 100], 'Gagner une partie (1re place).', 'Gagner {n} parties (1re place).', (f) => f.st.wins, [1, 2, 3, 4, 5]);
  tiers('podiums', 'parties', ['Sur le podium', 'Habitué du podium', 'Toujours là'], [10, 50, 100], null, 'Finir {n} fois sur le podium.', (f) => f.st.top3, [1, 2, 3]);
  tiers('combats', 'parties', ['Bagarreur', 'Guerrier', 'Seigneur de guerre', 'Fléau des univers'], [25, 100, 500, 1000], null, 'Gagner {n} combats.', (f) => f.st.fights, [1, 2, 3, 4]);
  tiers('dores', 'parties', ['Premier éclat d’or', 'Orfèvre', 'Alchimiste', 'Roi Midas'], [1, 10, 50, 200], 'Former un astre doré.', 'Former {n} astres dorés.', (f) => f.st.goldens, [1, 1, 2, 4]);

  const FAMS = ['vie', 'neant', 'envers', 'brasier', 'glace', 'tempete', 'mineral', 'machine', 'lune', 'comete', 'cristal', 'anomalie'];
  for (const fam of FAMS) add('champion-' + fam, 'familles', 'Champion : {fam}', 'Gagner une partie avec une majorité de {fam}.', 1, (f) => f.c.famWins[fam] || 0, 2, { fam: () => R.FAMILIES[fam].name });
  for (const fam of FAMS) add('fidele-' + fam, 'familles', 'Fidèle : {fam}', 'Jouer {n} parties avec une majorité de {fam}.', 10, (f) => f.c.famGames[fam] || 0, 1, { n: 10, fam: () => R.FAMILIES[fam].name });

  add('lois-toutes', 'lois', 'Législateur', 'Jouer chacune des {n} lois.', 15, (f) => Object.keys(f.st.laws).length, 3, { n: 15 });
  add('lois-cinq', 'lois', 'Polyvalent', 'Gagner avec {n} lois différentes.', 5, (f) => Object.keys(f.c.lawWins).length, 2, { n: 5 });
  add('loi-sacrifice', 'lois', 'Ascète', 'Gagner avec la {law}.', 1, (f) => f.c.lawWins.sacrifice || 0, 2, { law: () => R.LAW.sacrifice.name });
  add('loi-endurance', 'lois', 'Increvable', 'Gagner avec la {law}.', 1, (f) => f.c.lawWins.endurance || 0, 2, { law: () => R.LAW.endurance.name });
  add('loi-phenix', 'lois', 'Des cendres', 'Gagner avec la {law} après être revenu à la vie.', 1, (f) => f.c.phenixWin, 3, { law: () => R.LAW.phenix.name });

  const LEGENDS = ['primordia', 'ouroboros', 'oeilvide', 'maelstrom', 'attracteur', 'omega'];
  add('legende', 'legendes', 'Légende vivante', 'Posséder un astre légendaire en fin de partie.', 1, (f) => Object.keys(f.c.legends).length, 2);
  for (const id of LEGENDS) add('legende-' + id, 'legendes', 'Gardien : {nom}', 'Posséder {nom} en fin de partie.', 1, (f) => f.c.legends[id] || 0, 2, { nom: () => R.CARD[id].name });

  add('invaincu', 'exploits', 'Invaincu', 'Gagner une partie sans perdre un seul combat.', 1, (f) => f.c.unbeaten, 4);
  add('fil', 'exploits', 'Sur le fil', 'Gagner une partie avec 3 PV ou moins.', 1, (f) => f.c.close, 2);
  add('marathon', 'exploits', 'Marathon', 'Jouer une partie de 20 cycles ou plus.', 1, (f) => f.c.marathon, 1);
  add('eclair', 'exploits', 'Éclair', 'Gagner une partie en 12 cycles ou moins.', 1, (f) => f.c.fast, 3);
  add('complet', 'exploits', 'Système complet', 'Finir une partie avec 7 astres dans votre système.', 1, (f) => f.c.fullBoard, 1);
  add('tresor', 'exploits', 'Trésor doré', 'Finir une partie avec 3 astres dorés dans votre système.', 1, (f) => f.c.triGold, 2);
  add('alliance', 'exploits', 'Double formation', 'Finir une partie avec deux formations.', 1, (f) => f.c.alliance, 1);

  add('ligne-1', 'ligne', 'Premier contact', 'Jouer une partie en ligne.', 1, (f) => f.c.mpGames, 1);
  add('ligne-gagne', 'ligne', 'Victoire en ligne', 'Gagner une partie en ligne.', 1, (f) => f.c.mpWins, 3);
  add('ligne-10', 'ligne', 'Habitué du réseau', 'Jouer {n} parties en ligne.', 10, (f) => f.c.mpGames, 2, { n: 10 });
  add('ligne-prive', 'ligne', 'Entre amis', 'Jouer une partie privée entre amis.', 1, (f) => f.c.private, 1);
  add('place', 'ligne', 'Placé', 'Terminer vos parties de placement.', 1, (f) => (f.ranked.placed ? 1 : 0), 2);
  for (const [i, name, seeds] of [[2, 'Lune montante', 2], [3, 'Planétaire', 2], [5, 'Étoile du classé', 3], [7, 'Pulsar', 4], [8, 'Singularité', 5]]) {
    add('rang-' + i, 'ligne', name, 'Atteindre le rang {rank} au classé.', 1, (f) => (f.ranked.placed && f.ranked.tier >= i ? 1 : 0), seeds, { rank: () => tr(K.TIERS[i]) });
  }

  add('creation', 'creation', 'Créateur', 'Débloquer la Création.', 1, (f) => (f.creation ? 1 : 0), 2);
  add('graines-3', 'creation', 'Jardinier cosmique', 'Semer {n} graines dans la Forge.', 3, (f) => f.forge.n, 1, { n: 3 });
  add('monde-15', 'creation', 'Monde accompli', 'Faire grandir une planète jusqu’à la taille {n}.', 15, (f) => f.forge.maxMass, 2, { n: 15 });
  add('etoile', 'creation', 'Lumière !', 'Allumer l’étoile de votre système.', 1, (f) => (f.forge.lit ? 1 : 0), 1);
  add('orbites', 'creation', 'Système solaire', 'Placer {n} mondes en orbite.', 6, (f) => f.forge.orbits, 3, { n: 6 });

  add('colonie', 'colonie', 'Premiers pas', 'Fonder une colonie (tour de contrôle).', 1, (f) => (f.col.founded ? 1 : 0), 1);
  add('bat-10', 'colonie', 'Bâtisseur', 'Construire {n} bâtiments dans une colonie.', 10, (f) => f.col.built, 1, { n: 10 });
  add('bat-25', 'colonie', 'Urbaniste', 'Construire {n} bâtiments dans une colonie.', 25, (f) => f.col.built, 2, { n: 25 });
  add('colons-10', 'colonie', 'Village', 'Accueillir {n} colons.', 10, (f) => f.col.colonists, 1, { n: 10 });
  add('colons-25', 'colonie', 'Ville', 'Accueillir {n} colons.', 25, (f) => f.col.colonists, 2, { n: 25 });
  add('colons-50', 'colonie', 'Métropole', 'Accueillir {n} colons.', 50, (f) => f.col.colonists, 3, { n: 50 });
  add('recherche', 'colonie', 'Savoir absolu', 'Atteindre {n} de recherche dans une colonie.', 400, (f) => f.col.research, 2, { n: 400 });
  add('zone', 'colonie', 'Terres lointaines', 'Agrandir une colonie à tout le terrain.', 1, (f) => (f.col.zoneMax ? 1 : 0), 2);
  add('foret', 'colonie', 'Forêt pionnière', 'Faire pousser {n} arbres autour des pépinières.', 20, (f) => f.col.trees, 2, { n: 20 });

  add('expedition', 'expedition', 'Explorateur', 'Partir en expédition.', 1, (f) => f.ex.trips, 1);
  add('decouvertes-5', 'expedition', 'Chasseur de trésors', 'Faire {n} découvertes en expédition.', 5, (f) => f.ex.found, 1, { n: 5 });
  add('decouvertes-25', 'expedition', 'Archéologue', 'Faire {n} découvertes en expédition.', 25, (f) => f.ex.found, 2, { n: 25 });
  add('ruines', 'expedition', 'Les anciens', 'Trouver des ruines anciennes.', 1, (f) => f.ex.ruins, 2);
  add('distance', 'expedition', 'Grand voyageur', 'Aller à {n} cases de la base.', 200, (f) => f.ex.maxDist, 2, { n: 200 });
  add('troncons', 'expedition', 'Cartographe', 'Explorer {n} tronçons de terrain.', 100, (f) => f.ex.seen, 2, { n: 100 });

  add('arbre', 'divers', 'Graine plantée', 'Planter la graine d’étoile.', 1, (f) => (f.tree.planted ? 1 : 0), 1);
  add('chene', 'divers', 'Chêne millénaire', 'Faire de l’arbre d’étoiles un chêne massif.', 59, (f) => f.tree.water, 3, { n: 59 });
  add('niveau-10', 'divers', 'Apprenti créateur', 'Atteindre le niveau {n}.', 10, (f) => f.lvl, 1, { n: 10 });
  add('niveau-25', 'divers', 'Maître créateur', 'Atteindre le niveau {n}.', 25, (f) => f.lvl, 2, { n: 25 });
  add('niveau-50', 'divers', 'Divinité', 'Atteindre le niveau {n}.', 50, (f) => f.lvl, 4, { n: 50 });

  // ─── État du jeu ────────────────────────────────────────────
  const json = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (err) { return d; } };
  function facts() {
    const st = Object.assign({ games: 0, wins: 0, top3: 0, fights: 0, goldens: 0, laws: {} }, json('orbite.stats', {}));
    const c = counters();
    const cl = K.sanitize(json('orbite.classe', null));
    const forge = json('orbite.forge', { planets: [] });
    const planets = Array.isArray(forge.planets) ? forge.planets : [];
    const cols = Object.values(json('orbite.colonies', {}));
    const C = window.OrbiteColonie, X = window.OrbiteExploration;
    const col = { founded: false, built: 0, colonists: 0, research: 0, zoneMax: false, trees: 0 };
    const ex = { trips: 0, found: 0, ruins: 0, maxDist: 0, seen: 0 };
    for (const k of cols) {
      if (!k || !Array.isArray(k.built)) continue;
      col.founded = col.founded || k.built.some((b) => b.key === 'tour');
      col.built = Math.max(col.built, k.built.length);
      col.colonists = Math.max(col.colonists, k.colonists | 0);
      col.research = Math.max(col.research, Math.floor((k.stock && k.stock.research) || 0));
      if (C) { col.zoneMax = col.zoneMax || C.zoneIndex(k) >= C.ZONES.length - 1; col.trees = Math.max(col.trees, C.greenEstimate(k).trees); }
      const e = k.explore;
      if (e) {
        ex.trips += e.trips | 0;
        ex.found += (e.found || []).length;
        ex.maxDist = Math.max(ex.maxDist, e.maxDist | 0);
        ex.seen += Array.isArray(e.seen) ? e.seen.length : 0;
        if (X && (e.found || []).length) {
          const w = X.world(k.seed);
          ex.ruins += e.found.filter((id) => { const [cx, cy] = id.split(',').map(Number); const p = X.poi(w, cx, cy); return p && p.type === 'ruines'; }).length;
        }
      }
    }
    const tree = Object.assign({ planted: false, water: 0 }, json('orbite.arbre', {}));
    return {
      st, c, lvl: A.levelInfo(A.xpTotal()).lvl,
      ranked: { placed: K.placed(cl), tier: K.tierOf(cl.points).idx },
      forge: { n: planets.length, maxMass: Math.max(0, ...planets.map((p) => p.mass | 0)), lit: !!(forge.star && forge.star.lit), orbits: planets.filter((p) => p.orbit != null).length },
      creation: localStorage.getItem('orbite.creation') === '1',
      col, ex, tree
    };
  }

  // ─── Fin de partie : ce que les statistiques ne gardent pas ──
  function record(s, rank, quit) {
    const c = counters(), p = s.players[0];
    const board = p.board || [];
    const n = {};
    for (const u of board) { const f = R.famOf(u); if (f !== 'neutre') n[f] = (n[f] || 0) + 1; }
    const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    const fam = top && top[1] >= 3 ? top[0] : null;
    const won = !quit && rank === 1;
    const cycles = Math.max(1, p.deadRound || s.round || 1);
    if (fam) { c.famGames[fam] = (c.famGames[fam] || 0) + 1; if (won) c.famWins[fam] = (c.famWins[fam] || 0) + 1; }
    for (const u of board.concat(p.hand || [])) if (R.CARD[u.id] && R.CARD[u.id].legend) c.legends[u.id] = 1;
    if (!quit) {
      if (cycles >= 20) c.marathon++;
      if (board.length >= 7) c.fullBoard++;
      if (board.filter((u) => u.golden).length >= 3) c.triGold++;
      if (R.formationsOf(board).length >= 2) c.alliance++;
    }
    if (won) {
      c.lawWins[p.law] = 1;
      const me = s.mp ? s.mp.me : 'you';
      const lost = (s.history || []).some((h) => (h.results || []).some((r) => (r.a === me && r.winner === 1) || (r.b === me && r.winner === 0)));
      if (!lost) c.unbeaten++;
      if (p.hp <= 3) c.close++;
      if (cycles <= 12) c.fast++;
      if (p.law === 'phenix' && p.reborn) c.phenixWin++;
    }
    if (s.mp) { c.mpGames++; if (won) c.mpWins++; if (s.mp.mode === 'private') c.private++; }
    write(COUNT_KEY, c);
    setTimeout(check, 2500);
  }

  // ─── Déblocage ──────────────────────────────────────────────
  const done = () => read(DONE_KEY, {});
  const label = (a, key) => {
    const v = {};
    for (const [k, x] of Object.entries(a.vars)) v[k] = typeof x === 'function' ? x() : x;
    return tr(a[key], v);
  };
  let queue = [], showing = false;
  function check() {
    let f;
    try { f = facts(); } catch (err) { console.error(err); return; }
    const d = done();
    let got = 0;
    for (const a of LIST) {
      if (d[a.id]) continue;
      let v = 0;
      try { v = a.of(f) || 0; } catch (err) { v = 0; }
      if (v >= a.goal) { d[a.id] = Date.now(); got += a.seeds; queue.push(a); }
    }
    if (got) { write(DONE_KEY, d); A.addSeeds(got); pump(); }
  }
  // Annonce animée, une à la fois.
  function pump() {
    if (showing || !queue.length) return;
    showing = true;
    const a = queue.shift();
    const el = document.createElement('div');
    el.className = 'succ-pop';
    el.innerHTML = `<span class="succ-medal">★</span><span><small>${tr('SUCCÈS DÉBLOQUÉ')}</small><b>${A.esc(label(a, 'name'))}</b><em>+${a.seeds} ${A.icon('seed', 'seed')}</em></span>`;
    document.body.appendChild(el);
    if (SFX) SFX.level();
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => { el.remove(); showing = false; pump(); }, 3700);
  }

  // ─── Onglet du Profil ───────────────────────────────────────
  function render(box) {
    if (!box) return;
    let f;
    try { f = facts(); } catch (err) { f = null; }
    const d = done();
    const total = LIST.filter((a) => d[a.id]).length;
    const earned = LIST.filter((a) => d[a.id]).reduce((n, a) => n + a.seeds, 0);
    box.innerHTML = `<div class="succ-head"><b>${total} / ${LIST.length}</b><small>${tr('succès débloqués')} · ${earned} ${A.icon('seed', 'seed')}</small>
      <div class="xp-bar"><i style="width:${total / LIST.length * 100}%"></i></div></div>` + CATS.map(([cat, name]) => {
      const items = LIST.filter((a) => a.cat === cat);
      const n = items.filter((a) => d[a.id]).length;
      return `<h4 class="fg-h">${tr(name)} <small>${n} / ${items.length}</small></h4><div class="succ-list">${items.map((a) => {
        const ok = !!d[a.id];
        let v = 0;
        try { v = f ? Math.min(a.goal, a.of(f) || 0) : 0; } catch (err) { v = 0; }
        return `<div class="succ ${ok ? 'ok' : ''}"><span class="succ-medal">${ok ? '★' : '☆'}</span>
          <span class="succ-txt"><b>${A.esc(label(a, 'name'))}</b><small>${A.esc(label(a, 'text'))}</small>
          ${!ok && a.goal > 1 ? `<span class="succ-bar"><i style="width:${v / a.goal * 100}%"></i></span><small class="succ-n">${Math.floor(v)} / ${a.goal}</small>` : ''}</span>
          <span class="succ-gain">+${a.seeds} ${A.icon('seed', 'seed')}</span></div>`;
      }).join('')}</div>`;
    }).join('');
  }

  // Vérification régulière (hors combats) et au lancement.
  setTimeout(check, 4000);
  setInterval(() => { if (!O.ui.busy && !document.hidden) check(); }, 8000);

  window.OrbiteSucces = { LIST, CATS, record, check, render, facts };
})();
