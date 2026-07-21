/* ─── ARECIBO — DÉMO JOUABLE SOLO ─────────────────────────────────
   Le joueur est le CAPITAINE. L'équipage (VEGA, KESSEL, TILT) est
   simulé : il transmet ses informations partielles dans les comms,
   comme le feraient de vrais joueurs sur Discord.
   Boucle : événement → infos par rôle → décision du Capitaine →
   conséquences sur les jauges. Infection possible en cours de run. */

(() => {
  // Paramètres de test : ?t=90 (durée en secondes), ?xeno=1 / ?xeno=0
  // (forcer / interdire l'infection sur ce run).
  const params = new URLSearchParams(window.location.search);
  const paramDuration = Number(params.get('t'));
  const DURATION_MS = paramDuration > 0 ? paramDuration * 1000 : 8 * 60 * 1000;

  // ─── DOM ────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const rearCanvases = [$('rearCanvasLeft'), $('rearCanvasCenter'), $('rearCanvasRight')].filter(Boolean);
  const timerValue = $('missionTimerValue');
  const cursor = $('cursor');
  const consoleHull = $('consoleHull');
  const consoleFuel = $('consoleFuel');
  const consoleSignal = $('consoleSignal');
  const consoleSignalFill = $('consoleSignalFill');
  const consoleFootnote = $('consoleFootnote');
  const consoleDistance = $('consoleDistance');
  const commsFeed = $('commsFeed');
  const crewList = $('crewList');
  const crewScans = $('crewScans');
  const eventPanel = $('eventPanel');
  const eventKicker = $('eventKicker');
  const eventTitle = $('eventTitle');
  const eventText = $('eventText');
  const eventOptions = $('eventOptions');
  const eventCountdown = $('eventCountdown');
  const eventTimerFill = $('eventTimerFill');
  const memberModal = $('memberModal');
  const memberModalBackdrop = $('memberModalBackdrop');
  const memberPortrait = $('memberPortrait');
  const memberName = $('memberName');
  const memberRole = $('memberRole');
  const memberStatus = $('memberStatus');
  const memberScanBtn = $('memberScanBtn');
  const memberEjectBtn = $('memberEjectBtn');
  const memberCloseBtn = $('memberCloseBtn');
  const endOverlay = $('endOverlay');
  const endKicker = $('endKicker');
  const endTitle = $('endTitle');
  const endCopy = $('endCopy');
  const replayBtn = $('replayBtn');
  const roleOverlay = $('roleOverlay');
  const roleDismiss = $('roleCardDismiss');
  const activeRolePicto = $('activeRolePicto');
  const bridgeShellOpen = $('bridgeShellOpen');
  const bridgeShellClosed = $('bridgeShellClosed');
  const bridgeDoorLeft = $('bridgeDoorLeft');
  const bridgeDoorRight = $('bridgeDoorRight');
  const settingsOverlay = $('settings-overlay');
  const settingsTab = $('arecibo-settings-tab');
  const doorHotspotLeft = $('doorHotspotLeft');
  const doorHotspotRight = $('doorHotspotRight');
  const roomView = $('roomView');
  const roomViewImg = $('roomViewImg');
  const roomViewCaption = $('roomViewCaption');
  const roomViewClose = $('roomViewClose');
  const roomSpaceCanvas = $('roomSpaceCanvas');
  const eventVisual = $('eventVisual');
  const eventVisualImg = $('eventVisualImg');
  const endVisual = $('endVisual');

  // ─── AUDIO (respecte les volumes des settings) ─────────────────
  const SFX_PATHS = {
    alarm: 'assets/audio/effects/SD_AMB_ALARM.mp3',
    text: 'assets/audio/effects/SD_UI_TEXT.mp3',
    wrong: 'assets/audio/effects/SD_UI_WRONG.mp3',
    on: 'assets/audio/effects/SD_UI_TurnON.mp3',
    off: 'assets/audio/effects/SD_UI_TurnOFF.mp3',
    jingle: 'assets/audio/effects/SD_Jingle_Moto.mp3'
  };

  function readVolume(setting, fallback) {
    try {
      const raw = Number(localStorage.getItem(`areciboAudioVolume:${setting}`));
      return Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function sfxVolume() {
    return (readVolume('master', 80) / 100) * (readVolume('effects', 60) / 100);
  }

  function playSfx(name, scale = 1) {
    const src = SFX_PATHS[name];
    if (!src) return;
    const vol = sfxVolume() * scale;
    if (vol <= 0.001) return;
    try {
      const audio = new Audio(src);
      audio.volume = Math.max(0, Math.min(1, vol));
      audio.play().catch(() => {});
    } catch (err) {}
  }

  function playClick() {
    if (typeof window.playAreciboClickSound === 'function') window.playAreciboClickSound();
  }

  // ─── ÉQUIPAGE ───────────────────────────────────────────────────
  const NPCS = {
    vega: {
      name: 'VEGA', role: 'TIMONIER', short: 'NAV',
      color: 'var(--npc-vega)', portrait: 'assets/animals/head-02.svg'
    },
    kessel: {
      name: 'KESSEL', role: 'MATELOT // PONT', short: 'PONT',
      color: 'var(--npc-kessel)', portrait: 'assets/animals/head-01.svg'
    },
    tilt: {
      name: 'TILT', role: 'MATELOT // SOUTE', short: 'SOUTE',
      color: 'var(--npc-tilt)', portrait: 'assets/animals/head-04.svg'
    }
  };

  // ─── ÉTAT ───────────────────────────────────────────────────────
  const state = {
    started: false,
    over: false,
    startedAt: 0,
    hull: 60 + Math.floor(Math.random() * 16),
    fuel: 42 + Math.floor(Math.random() * 13),
    signal: 50 + Math.floor(Math.random() * 15),
    infectionRun: params.get('xeno') === '1' ? true : params.get('xeno') === '0' ? false : Math.random() < 0.65,
    infectedId: null,
    infectedSince: 0,
    ejected: { vega: false, kessel: false, tilt: false },
    scansLeft: 2,
    scanning: false,
    eventsResolved: 0,
    activeEvent: null,
    decideDeadline: 0,
    decideTotal: 0,
    nextEventAt: 0,
    nextIdleAt: 0,
    nextSabotageAt: 0,
    modalTarget: null,
    ejectArmed: false,
    ultrasonUsed: false,
    xenoEjected: false,
    innocentsEjected: 0,
    trust: 62 + Math.floor(Math.random() * 18),
    trustReprieveArmed: true,
    eventVotes: null,
    distanceStart: 3800 + Math.floor(Math.random() * 2600),
    distanceDrift: 0,
    alienActive: false,
    alienDone: false,
    alienStep: 0,
    alienDeadline: 0
  };

  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  // Les textes d'événements acceptent une chaîne OU un tableau de
  // variantes : le tableau est tiré au sort à chaque partie.
  const pickText = v => (Array.isArray(v) ? pick(v) : v);

  function aliveNpcs() {
    return Object.keys(NPCS).filter(id => !state.ejected[id]);
  }

  function isLiar(id) {
    return state.infectedId === id;
  }

  // ─── COMMS ──────────────────────────────────────────────────────
  function fillTemplate(text) {
    return text
      .replaceAll('{hull}', `${clamp(state.hull)}%`)
      .replaceAll('{fuel}', `${clamp(state.fuel)}%`)
      .replaceAll('{signal}', `${clamp(state.signal)}%`);
  }

  function pushMessage(author, text, cls = '') {
    if (!commsFeed || state.over) return;
    const node = document.createElement('div');
    node.className = `comms-msg ${cls}`.trim();
    const head = document.createElement('div');
    head.className = 'comms-msg-author';
    const body = document.createElement('div');
    body.className = 'comms-msg-text';
    body.textContent = fillTemplate(text);

    if (author === 'system') {
      head.innerHTML = '__SYS__';
      node.classList.add('is-system');
    } else if (author === 'player') {
      node.classList.add('is-player');
      node.style.setProperty('--msg-color', '#fa7a2c');
      head.innerHTML = `${playerName} <small>// CAPITAINE</small>`;
    } else {
      const npc = NPCS[author];
      node.style.setProperty('--msg-color', npc.color);
      head.innerHTML = `${npc.name} <small>// ${npc.role}</small>`;
    }

    node.appendChild(head);
    node.appendChild(body);
    commsFeed.appendChild(node);
    while (commsFeed.children.length > 46) commsFeed.removeChild(commsFeed.firstChild);
    commsFeed.scrollTop = commsFeed.scrollHeight;
    playSfx('text', author === 'system' ? 0.16 : 0.28);
  }

  function npcSay(id, text, delayMs = 0) {
    if (state.ejected[id]) return;
    window.setTimeout(() => {
      if (!state.over && !state.ejected[id]) pushMessage(id, text);
    }, delayMs);
  }

  // ─── JAUGES ─────────────────────────────────────────────────────
  function applyEffects(fx = {}, silent = false) {
    const parts = [];
    if (fx.hull) { state.hull = clamp(state.hull + fx.hull); parts.push(`COQUE ${fx.hull > 0 ? '+' : ''}${fx.hull}`); }
    if (fx.fuel) { state.fuel = clamp(state.fuel + fx.fuel); parts.push(`CARBURANT ${fx.fuel > 0 ? '+' : ''}${fx.fuel}`); }
    if (fx.signal) { state.signal = clamp(state.signal + fx.signal); parts.push(`SIGNAL ${fx.signal > 0 ? '+' : ''}${fx.signal}`); }
    updateConsole();
    if (fx.hull && fx.hull < 0) state.distanceDrift += Math.abs(fx.hull) * 22;
    if (fx.hull && fx.hull <= -5) shakeScene();
    if (!silent && parts.length) pushMessage('system', parts.join(' // '));
    checkDefeat();
  }

  function shakeScene() {
    const scene = document.querySelector('.motomoto-scene');
    if (!scene) return;
    scene.classList.remove('is-shaking');
    void scene.offsetWidth;
    scene.classList.add('is-shaking');
    window.setTimeout(() => scene.classList.remove('is-shaking'), 620);
  }

  function updateConsole() {
    if (consoleHull) {
      consoleHull.textContent = `${clamp(state.hull)}%`;
      consoleHull.classList.toggle('warning', state.hull < 40);
    }
    if (consoleFuel) {
      consoleFuel.textContent = `${clamp(state.fuel)}%`;
      consoleFuel.classList.toggle('warning', state.fuel < 25);
    }
    if (consoleSignal) {
      const s = state.signal;
      consoleSignal.textContent = s > 60 ? 'STABLE' : s > 30 ? 'INSTABLE' : 'CRITIQUE';
      consoleSignal.classList.toggle('warning', s <= 30);
    }
    if (consoleSignalFill) consoleSignalFill.style.width = `${Math.max(4, clamp(state.signal))}%`;
  }

  // ─── BANQUE D'ÉVÉNEMENTS ───────────────────────────────────────
  // Chaque PNJ ne décrit que SON axe : VEGA la route, KESSEL le pont
  // et la coque, TILT la soute et les réserves. `lie` remplace `t`
  // si le PNJ est infecté.
  const EVENTS = [
    {
      id: 'accroche',
      kicker: 'ALERTE PROXIMITÉ',
      scene: 'debris',
      img: 'assets/debris-scene/exterieur.png',
      title: 'Quelque chose a accroché la coque',
      text: 'Un choc sourd côté tribord. La moitié des capteurs du pont ne répondent plus.',
      decide: 34,
      msgs: [
        { npc: 'kessel', d: 1800, t: ['Coque à {hull}. Un panneau tribord est plié, ça siffle quelque part.', 'Coque à {hull}. Je sens la vibration jusque dans mes dents, c’est jamais bon signe.', 'Coque à {hull}. Ce truc est accroché juste au-dessus du réservoir, capitaine.'], lie: ['Coque nickel, aucun dégât. Le choc venait de l’intérieur, un outil qui traînait.', 'Rien à signaler sur la coque. Tu as dû rêver ce choc, capitaine.'] },
        { npc: 'vega', d: 5200, t: 'Champ de débris droit devant. Contact dans 40 secondes si on garde ce cap.', lie: 'Route parfaitement dégagée devant nous. Aucun contact sur les scopes.' },
        { npc: 'tilt', d: 9000, t: 'Réserves à {fuel}. Si tu pousses les moteurs, on va le sentir passer.', lie: 'Les réserves débordent, cap’taine. Pousse les moteurs, aucun souci.' }
      ],
      options: [
        { label: 'Pousser les moteurs', hint: 'esquive rapide — coûte du carburant', fx: { fuel: -10 }, out: 'Les moteurs hurlent. Le champ de débris glisse sur bâbord et la chose accrochée se détache dans le sillage.' },
        { label: 'Couper les moteurs', hint: 'dérive silencieuse — risqué', fx: { hull: -8, signal: -4 }, out: 'Le MOTOMOTO dérive. Deux impacts sourds. Quelque chose raye la coque sur toute sa longueur.' },
        { label: 'Envoyer Kessel décrocher la chose', hint: 'sortie en sas — vous incarnerez Kessel', fx: { hull: 4 }, exposes: 'kessel', out: 'KESSEL sort par le sas tribord. Trois longues minutes de silence radio. Il revient avec l’objet : une plaque gravée « ARECIBO ».', eva: { object: 'LA CHOSE ACCROCHÉE', find: 'Une plaque de coque gravée : « ARECIBO ». Elle est tiède. Les plaques ne devraient pas être tièdes.' } }
      ],
      timeout: { fx: { hull: -10 }, out: 'Personne n’a tranché. La chose a fini par percer un caisson avant de se détacher toute seule.' }
    },
    {
      id: 'station',
      kicker: 'OPPORTUNITÉ',
      scene: 'station',
      title: 'Station-service orbitale abandonnée',
      text: 'Une vieille station de ravitaillement dérive à portée. Enseigne à moitié morte : « DERNIER PLEIN AVANT LE VIDE ».',
      decide: 34,
      msgs: [
        { npc: 'tilt', d: 2000, t: ['Réserves à {fuel}. Franchement, je dirais pas non à un plein.', 'Réserves à {fuel}. Une station-service au milieu de nulle part, c’est louche OU c’est un miracle.', '{fuel} de carburant restant. Je dis ça, je dis rien. Mais je le redirai.'], lie: ['On est large en carburant, pas la peine de s’arrêter dans ce piège à rats.', 'Nos réserves débordent, cette station ne vaut pas le détour. Continue.'] },
        { npc: 'vega', d: 6000, t: 'L’accostage est faisable, mais la station tourne sur elle-même. Faudra sortir à la main.', lie: 'Accostage impossible, la station tourne bien trop vite. Passe au large.' },
        { npc: 'kessel', d: 10000, t: 'Le sas tribord est opérationnel. Je peux y aller. J’ai un bon pressentiment.', lie: 'Les sas sont grippés, personne ne sort. Tant pis pour le plein.' }
      ],
      options: [
        { label: 'Accoster et envoyer Tilt', hint: 'plein complet — vous incarnerez Tilt', fx: { fuel: 24 }, exposes: 'tilt', out: 'TILT revient en roulant deux bidons devant lui. Il fredonne un truc que personne ne connaît.', eva: { object: 'LES CUVES DE LA STATION', find: 'Deux bidons pleins. Sur la cuve, une inscription à la craie : « SERVEZ-VOUS. ON N’EN AURA PLUS BESOIN. »' } },
        { label: 'Siphonner à distance', hint: 'plus sûr, moins efficace', fx: { fuel: 9, signal: -5 }, out: 'Le bras télescopique racle le réservoir de la station. Quelques litres, et un paquet d’interférences.' },
        { label: 'Passer au large', hint: 'aucun risque, aucun gain', fx: {}, out: 'La station disparaît derrière vous. Sur l’enseigne, une lumière s’éteint pour de bon.' }
      ],
      timeout: { fx: {}, out: 'Le temps de se décider, la station est déjà loin derrière.' }
    },
    {
      id: 'meteores',
      kicker: 'LE JEU A TIRÉ UNE CARTE',
      scene: 'meteors',
      title: 'PLUIE DE MÉTÉORES',
      text: '« Le ciel vous tombe dessus. Reculer est impossible. » La carte s’est affichée toute seule sur la console.',
      decide: 30,
      msgs: [
        { npc: 'vega', d: 2000, t: 'Deux couloirs possibles : tout droit c’est court mais dense, le contournement est long et bouffe du carburant.', lie: 'Le couloir direct est quasiment vide. Fonce tout droit, fais-moi confiance.' },
        { npc: 'kessel', d: 6500, t: 'La coque est à {hull}. Elle peut encaisser quelques impacts, pas une averse entière.', lie: 'La coque encaissera tout, elle est comme neuve. Prends au plus court.' },
        { npc: 'tilt', d: 10500, t: 'Il y a une épave de cargo à deux clics, on peut se planquer derrière en coupant tout.', lie: 'Aucun abri dans le coin, faut traverser, y a pas le choix.' }
      ],
      options: [
        { label: 'Traverser tout droit', hint: 'rapide — la coque encaisse', fx: { hull: -14 }, out: 'Trois impacts. Le vaisseau sonne comme une cloche. Mais vous êtes passés.' },
        { label: 'Contourner le champ', hint: 'long — coûte du carburant', fx: { fuel: -12 }, out: 'Le détour est interminable. Les météores défilent au loin comme un feu d’artifice auquel personne ne veut assister.' },
        { label: 'Se planquer derrière l’épave', hint: 'tout couper et attendre', fx: { signal: -6, hull: -3 }, out: 'Moteurs coupés, lumières éteintes. L’épave prend les impacts à votre place. Un fragment ricoche quand même.' }
      ],
      timeout: { fx: { hull: -16 }, out: 'Aucun ordre. Le MOTOMOTO traverse l’averse en aveugle et le regrette aussitôt.' }
    },
    {
      id: 'soute',
      kicker: 'ANOMALIE INTERNE',
      title: 'Ça gratte dans la soute',
      text: 'TILT jure avoir entendu gratter derrière la cloison 4. Personne ne veut y aller. Tout le monde vous regarde.',
      decide: 32,
      msgs: [
        { npc: 'tilt', d: 1500, t: 'Je te promets que ça a gratté. Deux fois. Un truc lourd. Je dors plus jamais en bas.', lie: 'Oublie, c’était la ventilation. Rien du tout en soute, inutile d’aller vérifier.' },
        { npc: 'kessel', d: 5500, t: 'Les relevés de pression de la cloison 4 sont bizarres depuis une heure. Ça mérite un œil.', lie: 'Les relevés de la cloison 4 sont parfaitement normaux. Tilt a rêvé.' },
        { npc: 'vega', d: 9500, t: 'Je peux balancer une impulsion ultrason dans la soute depuis ici. Ça coûtera du signal.', lie: 'L’ultrason grillerait la moitié de mes instruments. Très mauvaise idée.' }
      ],
      options: [
        { label: 'Envoyer Kessel armé', hint: 'inspection directe — risqué', fx: {}, exposes: 'kessel', out: 'KESSEL descend, une clé à molette dans chaque main. Il remonte pâle : « Rien. Mais la cloison est tiède. »' },
        { label: 'Impulsion ultrason', hint: 'révèle une présence — coûte du signal', fx: { signal: -7 }, special: 'ultrason', out: 'L’impulsion balaie la soute, ponts 3 et 4.' },
        { label: 'Verrouiller la soute', hint: 'on condamne et on avance', fx: { fuel: -3 }, out: 'La cloison 4 est condamnée. Si quelque chose vit derrière, c’est désormais chez lui.' }
      ],
      timeout: { fx: { signal: -4 }, out: 'Personne n’a bougé. Le grattement s’est arrêté tout seul. C’est presque pire.' }
    },
    {
      id: 'cassette',
      kicker: 'DÉCOUVERTE',
      title: 'MIX INTERSTELLAIRE VOL.7',
      text: 'Le vieux lecteur de la console recrache une cassette poussiéreuse, étiquetée à la main. Personne à bord ne se souvient de l’avoir vue.',
      decide: 26,
      msgs: [
        { npc: 'kessel', d: 2000, t: 'VOL.7 ? Il y a écrit « pour tenir jusqu’au bout » au dos. C’est pas mon écriture.', lie: 'Jette ce truc, il grésille. Ça pourrait endommager la console.' },
        { npc: 'tilt', d: 6000, t: 'Mets-la. S’il te plaît. Ça fait six jours qu’on écoute le bruit du recycleur d’air.', lie: 'Pas de musique. J’ai besoin de silence pour surveiller la soute.' },
        { npc: 'vega', d: 9500, t: 'Aucune objection technique. Et statistiquement, un équipage qui chante tient plus longtemps.', lie: 'La lecture parasiterait mes instruments. Débarrasse-t’en.' }
      ],
      options: [
        { label: 'La jouer plein volume', hint: 'moral de l’équipage', fx: { signal: 5, hull: 2 }, out: 'Un vieux morceau sature les haut-parleurs. TILT danse avec un extincteur. Même le vaisseau semble vibrer plus droit.' },
        { label: 'L’analyser d’abord', hint: 'prudence', fx: { fuel: -2 }, out: 'L’analyse ne révèle rien : c’est juste de la musique. Très bonne, d’ailleurs.' },
        { label: 'La jeter par le sas', hint: 'zéro risque, zéro fun', fx: { signal: -4 }, out: 'La cassette tournoie dans le vide. L’équipage vous regarde comme si vous aviez éjecté un membre de la famille.' }
      ],
      timeout: { fx: {}, out: 'La cassette reste posée sur la console. Elle attendra. Elle a l’habitude.' }
    },
    {
      id: 'gravite',
      kicker: 'LE JEU A TIRÉ UNE CARTE',
      title: 'LA GRAVITÉ S’INVERSE',
      text: '« Le haut devient le bas pendant dix secondes. Accrochez-vous. » Tout ce qui n’est pas vissé commence à flotter.',
      decide: 24,
      msgs: [
        { npc: 'tilt', d: 1500, t: 'LES BIDONS FLOTTENT. Je répète : LES BIDONS FLOTTENT.', lie: 'Tout est arrimé en soute, aucun souci. Laisse flotter, c’est rigolo.' },
        { npc: 'kessel', d: 5000, t: 'Si tout retombe d’un coup, ça va cabosser du monde et du matériel. Compense ou attache tout.', lie: 'Rien à craindre à la retombée, le pont est vide. Économise les moteurs.' },
        { npc: 'vega', d: 8500, t: 'Je peux lisser la retombée avec les propulseurs d’attitude. Ça consomme, mais c’est propre.', lie: 'Ne touche pas aux propulseurs, tu déstabiliserais tout le vaisseau.' }
      ],
      options: [
        { label: 'Compenser aux propulseurs', hint: 'propre — coûte du carburant', fx: { fuel: -8 }, out: 'La gravité revient en douceur. Les bidons se reposent délicatement, comme si de rien n’était.' },
        { label: 'Laisser retomber', hint: 'gratuit — ça va cogner', fx: { hull: -6, signal: -3 }, out: 'Tout retombe en même temps. Le fracas est indescriptible. Une antenne interne est pliée.' }
      ],
      timeout: { fx: { hull: -7 }, out: 'Dix secondes plus tard, la pluie d’objets s’abat. TILT était sous les bidons.' }
    },
    {
      id: 'detresse',
      kicker: 'TRANSMISSION ENTRANTE',
      scene: 'beacon',
      img: 'assets/debris-loot/messages.png',
      title: 'Une voix connue dans le signal',
      text: 'Une balise de détresse répète un message. Le timbre de la voix vous est étrangement familier. Impossible de savoir d’où.',
      decide: 30,
      msgs: [
        { npc: 'vega', d: 2000, t: 'La source est à 2 clics, dans un nuage de ferraille. Répondre nous coûtera de la bande passante.', lie: 'La source est juste à côté, zone parfaitement dégagée. Répondre ne coûte rien.' },
        { npc: 'kessel', d: 6000, t: 'Cette voix... on dirait la mienne. C’est pas possible, hein ? Dites-moi que c’est pas possible.', lie: 'C’est une boucle automatique sans intérêt. Coupe ce truc, il me donne mal au crâne.' },
        { npc: 'tilt', d: 10000, t: 'Les histoires de vaisseaux qui répondent aux voix connues finissent toujours pareil, cap’taine.', lie: 'Fonce, il y a sûrement des survivants à sauver. On regrettera toute notre vie sinon.' }
      ],
      options: [
        { label: 'Répondre à la balise', hint: 'coûte du signal — peut rapporter', fx: { signal: -8, fuel: 7 }, out: 'La « voix » était l’écho dégradé d’un manifeste de cargaison. À la source : un module de carburant intact.' },
        { label: 'Enregistrer et tracer', hint: 'ni oui ni non', fx: { signal: -3 }, out: 'Le message est archivé. La voix continue de répéter sa phrase, quelque part derrière vous, pour personne.' },
        { label: 'Couper la réception', hint: 'on n’écoute pas les fantômes', fx: {}, out: 'Silence radio. L’équipage ne parle pas pendant deux bonnes minutes. La voix, elle, parle peut-être encore.' }
      ],
      timeout: { fx: { signal: -5 }, out: 'La balise a fini par se lasser. Le doute, lui, reste à bord.' }
    },
    {
      id: 'cargo',
      kicker: 'CONTACT',
      scene: 'hulk',
      img: 'assets/ship-launch-detourer-crop.png',
      title: 'Un cargo fantôme en travers de la route',
      text: 'Un transporteur éventré dérive lentement, feux morts, soutes ouvertes. Il bloque le couloir le plus direct vers ARECIBO.',
      decide: 32,
      msgs: [
        { npc: 'vega', d: 2000, t: 'Passer dessous est jouable mais ça frottera. Le contourner nous coûte du temps et du carburant.', lie: 'Passe dessous sans crainte, il y a une marge énorme. Aucun frottement possible.' },
        { npc: 'kessel', d: 6500, t: 'Ses soutes sont ouvertes. Il reste peut-être du carburant à bord. Je peux traverser en propulseur.', lie: 'Ce cargo est vide, tout a été pillé depuis des années. Sauter dessus serait du suicide.' },
        { npc: 'tilt', d: 10000, t: 'Nos réserves sont à {fuel}. Un détour de plus et je commence à pédaler.', lie: 'Le détour ne coûte presque rien, on a tout le carburant qu’il faut. Prends le chemin long et sûr.' }
      ],
      options: [
        { label: 'Envoyer Kessel fouiller', hint: 'butin possible — vous incarnerez Kessel', fx: { fuel: 12 }, exposes: 'kessel', out: 'KESSEL revient avec une cellule de carburant... et une combinaison qui n’est pas la sienne. « Elle était pliée. Sur une couchette. Encore tiède. »', eva: { object: 'LA SOUTE ÉVENTRÉE', find: 'Une cellule de carburant intacte. Et une combinaison pliée sur une couchette. Vous la touchez : encore tiède.' } },
        { label: 'Passer dessous', hint: 'direct — la coque frotte', fx: { hull: -7 }, out: 'Le ventre du MOTOMOTO embrasse la carcasse dans un crissement à réveiller les morts. Mais ça passe.' },
        { label: 'Contourner', hint: 'sûr — coûte du carburant', fx: { fuel: -9 }, out: 'Vous contournez le géant mort. Par les baies éventrées, personne ne regarde passer votre vaisseau. Probablement.' }
      ],
      timeout: { fx: { hull: -6, fuel: -4 }, out: 'Indécision. Le pilote automatique choisit un compromis qui ne satisfait personne, comme tous les compromis.' }
    },
    {
      id: 'balise',
      kicker: 'NAVIGATION',
      scene: 'beacon',
      img: 'assets/backgrounds/menu-planet-2.png',
      title: 'Une balise ARECIBO. Ou presque.',
      text: 'Un émetteur diffuse la signature d’approche d’ARECIBO. Mais le préfixe date d’un protocole abandonné. Vraie balise fatiguée, ou leurre ?',
      decide: 30,
      msgs: [
        { npc: 'vega', d: 2000, t: 'Si elle est authentique, se caler dessus stabiliserait beaucoup notre signal. Si c’est un leurre, on dévie plein vide.', lie: 'C’est un leurre grossier, ignore-la. Notre cap actuel est excellent.' },
        { npc: 'kessel', d: 6500, t: 'Le boîtier a l’air d’époque. Ces vieilles balises rendent l’âme mais mentent rarement.', lie: 'Ce boîtier est une contrefaçon récente, ça se voit d’ici. Quelqu’un veut nous attirer.' },
        { npc: 'tilt', d: 10000, t: 'Un scan complet coûterait un peu de carburant mais lèverait le doute une bonne fois.', lie: 'Pas de scan, on n’a plus une goutte à gaspiller pour ces bêtises.' }
      ],
      options: [
        { label: 'Se caler sur la balise', hint: 'confiance — gros gain de signal si vraie', fx: { signal: 13 }, out: 'La balise est authentique. Le signal d’ARECIBO s’éclaircit d’un coup, comme une radio qu’on règle enfin.' },
        { label: 'Scanner avant tout', hint: 'prudence — coûte du carburant', fx: { fuel: -4, signal: 7 }, out: 'Scan formel : balise authentique, protocole v1. Vous vous calez dessus avec un peu de retard.' },
        { label: 'L’ignorer', hint: 'zéro confiance', fx: { signal: -4 }, out: 'Vous passez au large. Si elle était vraie, elle continuera d’appeler des vaisseaux qui ne répondent jamais.' }
      ],
      timeout: { fx: { signal: -4 }, out: 'La fenêtre de calage est passée. La balise clignote tristement dans le rétroviseur.' }
    },
    {
      id: 'surtension',
      kicker: 'AVARIE',
      title: 'Surtension : le recycleur d’air tousse',
      text: 'Un claquement électrique, une odeur d’ozone. Le recycleur d’air repart, mais il tousse comme un vieux moteur au petit matin.',
      decide: 28,
      msgs: [
        { npc: 'kessel', d: 2000, t: 'Je peux le réparer proprement mais il me faut du courant : ça pompera sur l’antenne signal.', lie: 'Aucune réparation nécessaire, il toussote toujours comme ça. Garde ton courant.' },
        { npc: 'tilt', d: 6000, t: 'Ou alors je le bricole avec ce qu’on a en soute. C’est moche mais ça tient. En général.', lie: 'Le bricolage est la seule option viable, fais-moi confiance, j’ai vu pire.' },
        { npc: 'vega', d: 9500, t: 'Sans intervention, il lâchera avant l’arrivée. Mathématiquement, c’est un mauvais pari.', lie: 'Il tiendra sans problème jusqu’à ARECIBO, mes courbes sont formelles. N’y touche pas.' }
      ],
      options: [
        { label: 'Réparation au panneau', hint: 'mini-jeu — coupez le bon fil', minigame: 'wires', success: { fx: { hull: 5, signal: -3 }, out: 'Le bon fil. Le recycleur repart en ronronnant comme un chat content. KESSEL siffle, admiratif.' }, fail: { fx: { hull: -8 }, out: 'Mauvais fil. La moitié du pont s’éteint et quelque chose claque très fort en soute. Personne n’en parlera.' } },
        { label: 'Bricolage de soute', hint: 'gratuit — aléatoire', fx: { hull: -4 }, out: 'TILT enroule trois colliers de serrage et frappe deux fois. Ça marche. Personne ne demande pourquoi.' },
        { label: 'Ne rien faire', hint: 'espérer que ça tienne', fx: { hull: -8 }, out: 'Le recycleur tient... puis crache une pièce qui ricoche dans les conduits et perce un joint. Évidemment.' }
      ],
      timeout: { fx: { hull: -8 }, out: 'À force d’attendre, le recycleur a choisi tout seul : il a lâché un morceau.' }
    },
    {
      id: 'archives',
      kicker: 'SYSTÈME DE BORD',
      title: 'L’ordinateur exige un opérateur',
      text: 'Le vieil OS du MOTOMOTO verrouille la navigation : il veut qu’une main vivante retrouve un fichier dans ses archives. Il dit que c’est « une question de confiance ».',
      decide: 30,
      msgs: [
        { npc: 'vega', d: 2000, t: 'Sans ce fichier, je navigue à l’estime. Et mon estime est mauvaise.', lie: 'Ignore cette machine sénile, je peux naviguer sans fichier. Fais-moi confiance.' },
        { npc: 'kessel', d: 6000, t: 'Cet OS a survécu à trois équipages. Il fait ça quand il s’ennuie. Ou quand il a peur.', lie: 'Débranche ce terminal, il nous fait perdre du temps. Arrache la prise.' },
        { npc: 'tilt', d: 10000, t: 'Les archives médicales sont dedans aussi. On pourrait... jeter un œil, pendant qu’on y est.', lie: 'Surtout ne fouille pas les archives, c’est un nid à virus. N’ouvre RIEN.' }
      ],
      options: [
        { label: 'Faire la recherche', hint: 'mini-jeu — retrouvez la séquence', minigame: 'grep', success: { fx: { signal: 10 }, out: 'Le fichier se décompresse. L’OS ronronne et déverrouille la navigation. Les archives médicales défilent au passage...' }, fail: { fx: { signal: -8 }, out: 'L’OS soupire électroniquement et se verrouille pour bouder. Navigation en mode dégradé.' } },
        { label: 'Débrancher le terminal', hint: 'brutal — l’OS s’en souviendra', fx: { signal: -4, hull: -2 }, out: 'Vous débranchez. Toutes les portes du bord claquent en même temps. Coïncidence, sûrement.' }
      ],
      timeout: { fx: { signal: -6 }, out: 'L’OS a attendu. Personne n’est venu. Il a mis la navigation en mode « vexé ».' }
    },
    {
      id: 'pirates',
      kicker: 'CONTACT HOSTILE',
      scene: 'ship',
      img: 'assets/ship-launch-detourer-crop.png',
      title: 'Un vaisseau pirate se colle à votre sillage',
      text: 'Ses tourelles s’orientent vers vous. Un message crypté clignote en boucle sur la console : « CARBURANT OU CARCASSE. »',
      decide: 26,
      msgs: [
        { npc: 'kessel', d: 1800, t: 'Je peux tenir la tourelle dorsale. Elle est rouillée mais elle répond encore.', lie: 'La tourelle dorsale est morte depuis des mois. Inutile d’y penser.' },
        { npc: 'tilt', d: 5800, t: 'On a {fuel} de réserves. Payer leur tribut, ça va faire mal.', lie: 'On a largement de quoi payer leur tribut sans problème, capitaine.' },
        { npc: 'vega', d: 9800, t: 'Je peux tenter une fuite, mais leur coque a l’air plus rapide que la nôtre.', lie: 'Leur vaisseau est lent, la fuite est sans risque. Fonce.' }
      ],
      options: [
        { label: 'Défendre la tourelle dorsale', hint: 'mini-jeu — repoussez les vagues de mines', minigame: 'invaders', success: { fx: { hull: -3 }, out: 'La dernière mine explose en confettis de métal. Le vaisseau pirate vire de bord, dégoûté par si peu de butin.' }, fail: { fx: { hull: -16, fuel: -6 }, out: 'Ils abordent par la coque. Ce qu’ils prennent, on ne le revoit jamais. La tourelle fume encore, vide.' } },
        { label: 'Payer le tribut demandé', hint: 'perte de carburant garantie', fx: { fuel: -18 }, out: 'Une cellule de carburant part par le sas de largage. Le vaisseau pirate l’attrape au vol et disparaît sans un mot.' },
        { label: 'Pousser les moteurs à fond', hint: 'fuite risquée', fx: { fuel: -10, signal: -6 }, out: 'La fuite dure une éternité de trois minutes. Ils finissent par lâcher prise, ou par se lasser. Personne ne sait lequel.' }
      ],
      timeout: { fx: { hull: -10, fuel: -8 }, out: 'Le temps de se décider, ils sont déjà à quai. Le pillage est rapide, méthodique, et terriblement silencieux.' }
    }
  ];

  // ─── PAPOTAGE (entre les événements) ────────────────────────────
  const IDLE_LINES = {
    vega: [
      'Cap stable. ARECIBO répond toutes les 40 secondes, comme une horloge fatiguée.',
      'J’ai recalculé la route trois fois. Trois résultats différents. J’ai gardé le plus optimiste.',
      'Une étoile vient de disparaître du scope. Probablement rien. Probablement.',
      'Si quelqu’un veut apprendre à lire une carte stellaire, c’est le moment ou jamais.'
    ],
    kessel: [
      'Ronde du pont terminée. Tout est normal, si on accepte une définition large de « normal ».',
      'J’ai regraissé les gonds du sas tribord. On ne sait jamais qui devra sortir en vitesse.',
      'Quelqu’un a déplacé ma clé de 12. C’est forcément l’un de vous.',
      'La plaque « ARECIBO SALVAGE PROTOCOL » se décolle du mur. Je la revisse ou c’est un signe ?'
    ],
    tilt: [
      'Inventaire de soute refait. Il nous reste onze rations et un paquet de biscuits contesté.',
      'Il fait froid en bas. Le genre de froid qui a une opinion.',
      'Je chantonne pour la cloison 4. Au cas où quelque chose écouterait, autant que ce soit poli.',
      'Rappel amical : le dernier qui prend un biscuit sans le noter aura affaire à moi.',
      'La cloison 4 est silencieuse depuis une heure. Je sais pas si c’est mieux.',
      'J’ai réparé le monte-charge. Enfin, il descend. C’est déjà la moitié du travail.',
      'Quelqu’un d’autre trouve que le vaisseau sent différent depuis tout à l’heure ?'
    ]
  };

  IDLE_LINES.vega.push(
    'Correction de trajectoire de 0,4 degré. Vous n’avez rien senti ? Parfait. C’est mon travail.',
    'ARECIBO a « cligné » deux fois sur le scope. Les planètes ne clignent pas. Je note quand même.',
    'Si mes calculs sont bons, on arrive. Si mes calculs sont mauvais, on arrive quelque part.'
  );
  IDLE_LINES.kessel.push(
    'Le hublot tribord a une nouvelle rayure. Elle est de l’intérieur. Bref.',
    'J’ai resserré 34 boulons aujourd’hui. Le 35e a refusé. Je respecte ça.',
    'Rien à signaler sur le pont. C’est bien ça qui m’inquiète.'
  );

  const INFECTED_IDLE_LINES = [
    'Tout va bien ici. Tout va parfaitement bien.',
    'Je me sens... mieux que jamais, en fait. Étrangement bien.',
    'Vous n’avez jamais trouvé que le vaisseau était trop éclairé ?',
    'Inutile de vérifier derrière moi. Je viens de le faire.'
  ];

  // ─── PIÈCES LATÉRALES ───────────────────────────────────────────
  const ROOMS = {
    left: {
      img: 'assets/quartier-fenetre.png',
      caption: 'QUARTIERS DE L’ÉQUIPAGE // BÂBORD',
      enter: 'Vous passez la tête dans les quartiers. Les couchettes sont vides, la plante tient bon.',
      flavor: [
        { npc: 'tilt', text: 'Si tu cherches mes biscuits dans les quartiers, c’est trop tard, je les ai déménagés.' },
        { npc: 'kessel', text: 'La radio des quartiers capte encore un vieux canal. Personne ne parle dessus. Normalement.' }
      ]
    },
    right: {
      img: 'assets/sas-3.png',
      caption: 'SAS TRIBORD // ZONE D’EXPOSITION',
      enter: 'Le sas tribord. La porte extérieure n’est qu’à quelques centimètres du vide.',
      flavor: [
        { npc: 'kessel', text: 'Capitaine sur le pont du sas ? Vérifie les joints tant que tu y es, j’ai un doute sur le troisième.' },
        { npc: 'vega', text: 'Je vois ta signature thermique dans le sas. Referme bien derrière toi. S’il te plaît.' }
      ],
      infectedHint: 'Une odeur, dans le sas. Douce. Organique. Personne n’en a parlé dans les comms.'
    },
    soute: {
      img: 'assets/soute.png',
      caption: 'SOUTE // PONT INFÉRIEUR',
      enter: 'La soute. Des caisses jusqu’au plafond, et la cloison 4 quelque part dans l’ombre, au fond.',
      flavor: [
        { npc: 'tilt', text: 'Hé ! C’est MA soute. Touche pas aux caisses de la rangée trois, elles sont... classées.' },
        { npc: 'tilt', text: 'Si tu descends en soute, tape deux coups sur la cloison en arrivant. C’est la politesse, ici.' },
        { npc: 'kessel', text: 'La caisse marquée M contient les pièces détachées. Enfin, contenait. On va dire contenait.' }
      ],
      infectedHint: 'La cloison 4 est tiède sous la main. Les cloisons ne devraient pas être tièdes. Personne ne le sait encore.'
    }
  };

  let roomOpen = null;
  let roomStars = null;

  function drawRoomSpace() {
    if (!roomSpaceCanvas || !roomOpen) return;
    const rect = roomSpaceCanvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = window.devicePixelRatio || 1;
    roomSpaceCanvas.width = Math.floor(rect.width * ratio);
    roomSpaceCanvas.height = Math.floor(rect.height * ratio);
    const ctx = roomSpaceCanvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#020201';
    ctx.fillRect(0, 0, rect.width, rect.height);
    if (!roomStars) {
      roomStars = Array.from({ length: 130 }, () => ({
        x: Math.random(), y: Math.random(),
        size: Math.random() > 0.85 ? 2.4 : Math.random() > 0.4 ? 1.7 : 1,
        alpha: 0.3 + Math.random() * 0.55
      }));
    }
    roomStars.forEach(star => {
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = 'rgba(247,255,195,1)';
      ctx.fillRect(star.x * rect.width, star.y * rect.height, star.size, star.size);
    });
    ctx.globalAlpha = 1;
  }

  function openRoom(side) {
    if (state.over || roomOpen) return;
    const room = ROOMS[side];
    if (!room) return;
    roomOpen = side;
    if (side !== 'soute') setDoors(true, side); // la soute s'atteint par la trappe, pas par les portes latérales
    playSfx('on', 0.7);
    if (roomViewImg) roomViewImg.src = room.img;
    if (roomViewCaption) roomViewCaption.textContent = room.caption;
    window.setTimeout(() => {
      if (roomOpen !== side) return;
      if (roomView) {
        roomView.classList.add('is-visible');
        roomView.setAttribute('aria-hidden', 'false');
      }
      drawRoomSpace();
      pushMessage('system', room.enter);
      if (state.infectedId && room.infectedHint) {
        window.setTimeout(() => {
          if (roomOpen === side && !state.over) pushMessage('system', room.infectedHint, 'is-glitch');
        }, 2600);
      } else if (Math.random() < 0.6) {
        const alive = room.flavor.filter(f => !state.ejected[f.npc]);
        if (alive.length) {
          const pickled = pick(alive);
          npcSay(pickled.npc, pickled.text, 2200);
        }
      }
    }, 560);
  }

  function closeRoom() {
    if (!roomOpen) return;
    roomOpen = null;
    if (roomView) {
      roomView.classList.remove('is-visible');
      roomView.setAttribute('aria-hidden', 'true');
    }
    setDoors(false);
    playSfx('off', 0.7);
  }

  // ─── PORTES (visuel sortie en sas) ──────────────────────────────
  function setDoors(open, side = 'right') {
    if (bridgeShellOpen) bridgeShellOpen.classList.toggle('is-visible', open);
    if (bridgeShellClosed) {
      bridgeShellClosed.classList.toggle('is-visible', !open);
      bridgeShellClosed.classList.toggle('is-hidden', open);
    }
    [bridgeDoorLeft, bridgeDoorRight].forEach(door => {
      if (!door) return;
      door.style.opacity = open ? '1' : '0';
      door.classList.remove('is-open');
    });
    if (open) {
      const door = side === 'left' ? bridgeDoorLeft : bridgeDoorRight;
      if (door) door.classList.add('is-open');
    }
  }

  function playAirlockSequence() {
    if (roomOpen) return; // déjà dans une pièce : pas de conflit de portes
    playSfx('on', 0.7);
    setDoors(true, 'right');
    window.setTimeout(() => {
      if (!state.over && !roomOpen) {
        setDoors(false);
        playSfx('off', 0.7);
      }
    }, 4200);
  }

  // ─── INFECTION ──────────────────────────────────────────────────
  function infect(npcId) {
    if (!state.infectionRun || state.infectedId || state.over) return;
    if (state.ejected[npcId]) return;
    state.infectedId = npcId;
    state.infectedSince = Date.now();
    state.nextSabotageAt = Date.now() + 30000;
  }

  function handleExposure(npcId) {
    playAirlockSequence();
    if (state.infectionRun && !state.infectedId) {
      // La première sortie contamine. Silencieusement.
      window.setTimeout(() => infect(npcId), 4600);
    }
  }

  function sabotageTick(now) {
    if (!state.infectedId || state.over) return;
    if (now < state.nextSabotageAt) return;
    state.nextSabotageAt = now + rand(34000, 48000);
    const gauge = pick(['hull', 'fuel', 'signal']);
    const fx = {}; fx[gauge] = -2;
    applyEffects(fx, true);
    if (Math.random() < 0.4) {
      pushMessage('system', pick([
        'relevé capteur incohérent // recalibrage',
        'micro-chute de pression détectée // source inconnue',
        'parasites sur le bus interne // origine non identifiée'
      ]), 'is-glitch');
    }
  }

  // ─── MINI-JEUX : FENÊTRE TERMINAL CRT ───────────────────────────
  const minigameOverlay = $('minigameOverlay');
  const crtWindow = $('crtWindow');
  const crtTitle = $('crtTitle');
  const crtSubbar = $('crtSubbar');
  const crtBody = $('crtBody');
  const crtTimer = $('crtTimer');
  const crtTimerFill = $('crtTimerFill');
  const crtStatusLeft = $('crtStatusLeft');
  const crtResult = $('crtResult');

  const mg = { active: false, done: false, deadline: 0, total: 0, onEnd: null };

  function startMinigame(def, onEnd) {
    mg.active = true;
    mg.done = false;
    mg.onEnd = onEnd;
    mg.total = def.seconds * 1000;
    mg.deadline = Date.now() + mg.total;
    if (crtWindow) crtWindow.classList.toggle('is-orange', !!def.orange);
    if (crtTitle) crtTitle.textContent = def.title;
    if (crtSubbar) crtSubbar.textContent = def.subtitle;
    if (crtStatusLeft) crtStatusLeft.textContent = 'READY_';
    if (crtResult) {
      crtResult.classList.remove('is-visible', 'is-fail');
      crtResult.textContent = '';
    }
    if (crtBody) {
      crtBody.innerHTML = '';
      def.build(crtBody);
    }
    if (minigameOverlay) {
      minigameOverlay.classList.add('is-visible');
      minigameOverlay.setAttribute('aria-hidden', 'false');
    }
    playSfx('on', 0.6);
  }

  function endMinigame(success, message) {
    if (!mg.active || mg.done) return;
    mg.done = true;
    if (crtResult) {
      crtResult.textContent = message || (success ? 'ACCÈS ACCORDÉ' : 'ÉCHEC // VERROUILLAGE');
      crtResult.classList.add('is-visible');
      crtResult.classList.toggle('is-fail', !success);
    }
    playSfx(success ? 'on' : 'wrong', 0.75);
    window.setTimeout(() => {
      mg.active = false;
      if (minigameOverlay) {
        minigameOverlay.classList.remove('is-visible');
        minigameOverlay.setAttribute('aria-hidden', 'true');
      }
      const cb = mg.onEnd;
      mg.onEnd = null;
      if (cb) cb(success);
    }, 1900);
  }

  function minigameTick(now) {
    if (!mg.active || mg.done) return;
    const remaining = Math.max(0, mg.deadline - now);
    if (crtTimer) {
      crtTimer.textContent = String(Math.ceil(remaining / 1000));
      crtTimer.classList.toggle('is-low', remaining < 6000);
    }
    if (crtTimerFill) crtTimerFill.style.transform = `scaleX(${remaining / mg.total})`;
    if (remaining <= 0) endMinigame(false, 'TEMPS ÉCOULÉ');
  }

  // Mini-jeu 1 : GREP // ARCHIVES — retrouver une séquence dans des
  // centaines de fichiers avant la fin du temps. 3 erreurs = échec.
  const GREP_PREFIXES = ['LOG', 'MED', 'NAV', 'SYS', 'CRG', 'O2', 'BAK', 'ENV', 'COM', 'PWR'];
  const GREP_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function grepChunk(len) {
    let out = '';
    for (let i = 0; i < len; i++) out += GREP_CHARS[Math.floor(Math.random() * GREP_CHARS.length)];
    return out;
  }

  function grepMinigame(onEnd) {
    const seq = `${grepChunk(2)}-${grepChunk(4)}`;
    let wrongs = 0;

    startMinigame({
      title: 'MOTOMOTO OS v0.9 — /archives',
      subtitle: 'RECHERCHE MANUELLE // LE MOTEUR D’INDEXATION EST MORT EN 2214',
      seconds: 30,
      build(body) {
        const head = document.createElement('div');
        head.className = 'grep-target';
        head.innerHTML = `SÉQUENCE RECHERCHÉE : <strong>${seq}</strong> — 3 ERREURS = VERROUILLAGE`;
        body.appendChild(head);

        const grid = document.createElement('div');
        grid.className = 'grep-grid';
        const total = 180;
        const targetIndex = 30 + Math.floor(Math.random() * (total - 40));

        for (let i = 0; i < total; i++) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'grep-file';
          const prefix = pick(GREP_PREFIXES);
          const body1 = grepChunk(2) + '-' + grepChunk(4);
          const isTarget = i === targetIndex;
          btn.textContent = `${prefix}_${isTarget ? seq : body1}.dat`;
          btn.addEventListener('click', () => {
            if (isTarget) {
              endMinigame(true, 'FICHIER TROUVÉ // DÉCRYPTAGE...');
            } else {
              btn.classList.add('is-wrong');
              wrongs += 1;
              playSfx('wrong', 0.4);
              if (crtStatusLeft) crtStatusLeft.textContent = `ERREURS : ${wrongs}/3_`;
              if (wrongs >= 3) endMinigame(false, 'VERROUILLAGE // TROP D’ERREURS');
            }
          });
          grid.appendChild(btn);
        }
        body.appendChild(grid);
      }
    }, onEnd);
  }

  // Mini-jeu 2 : COUPE-CIRCUIT — couper le bon fil, un seul essai.
  // Réutilise les visuels sas-repair de la V1.
  const WIRES = [
    { id: 'ROUGE', color: '#ff5340', img: 'assets/sas-repair/tableau ouvert fil rouge coupe.png' },
    { id: 'BLEU', color: '#5aa8ff', img: 'assets/sas-repair/tableau ouvert fil bleu coupe.png' },
    { id: 'VERT', color: '#7dff7a', img: 'assets/sas-repair/tableau ouvert fil vert coupe.png' },
    { id: 'JAUNE', color: '#ffe75a', img: 'assets/sas-repair/tableau ouvert fil jaune coupe.png' },
    { id: 'ORANGE', color: '#ff9c40', img: 'assets/sas-repair/tableau ouvert fil orange coupe.png' },
    { id: 'VIOLET', color: '#c58aff', img: 'assets/sas-repair/tableau ouvert fil violet coupe.png' }
  ];

  function wiresMinigame(onEnd) {
    const target = pick(WIRES);
    let cut = false;

    startMinigame({
      orange: true,
      title: 'PANNEAU DE DÉRIVATION // PONT INFÉRIEUR',
      subtitle: 'UN SEUL FIL. UN SEUL ESSAI. PAS DE PRESSION.',
      seconds: 14,
      build(body) {
        const stage = document.createElement('div');
        stage.className = 'wires-stage';
        stage.innerHTML = `
          <div class="wires-instruction">VEGA : « Coupe le fil <strong style="color:${target.color}">${target.id}</strong>. Enfin... je crois. »</div>
          <div class="wires-board"><img id="wiresImg" src="assets/sas-repair/tableau-ouvert.png" alt="Tableau électrique ouvert"></div>
          <div class="wires-buttons"></div>`;
        const buttons = stage.querySelector('.wires-buttons');
        WIRES.forEach(wire => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'wire-btn';
          btn.style.setProperty('--wire', wire.color);
          btn.textContent = wire.id;
          btn.addEventListener('click', () => {
            if (cut) return;
            cut = true;
            const img = stage.querySelector('#wiresImg');
            if (img) img.src = wire.img;
            playClick();
            window.setTimeout(() => {
              endMinigame(wire.id === target.id,
                wire.id === target.id ? 'DÉRIVATION STABILISÉE' : 'MAUVAIS FIL // SURCHARGE');
            }, 1000);
          });
          buttons.appendChild(btn);
        });
        body.appendChild(stage);
      }
    }, onEnd);
  }

  // Mini-jeu 3 : DÉFENSE DORSALE — repousser des mines pirates par
  // vagues (repris de l'ancien prototype de défense d'astéroïdes,
  // en plus compact). Souris ou flèches pour viser, clic ou espace
  // pour tirer. Pas de tir ennemi : le danger, c'est ce qui passe.
  function invadersMinigame(onEnd) {
    let raf = null;
    let cleaned = false;
    const keys = {};

    function onKeyDown(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') e.preventDefault();
      keys[e.key] = true;
    }
    function onKeyUp(e) { keys[e.key] = false; }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }

    startMinigame({
      title: 'TOURELLE DORSALE // DÉFENSE ANTI-MINES',
      subtitle: '← → OU SOURIS POUR VISER — ESPACE OU CLIC POUR TIRER',
      seconds: 34,
      build(body) {
        const wrap = document.createElement('div');
        wrap.className = 'invaders-wrap';
        const canvas = document.createElement('canvas');
        canvas.className = 'invaders-canvas';
        wrap.appendChild(canvas);
        body.appendChild(wrap);

        const W = canvas.width = Math.max(320, Math.min(680, body.clientWidth - 4 || 640));
        const H = canvas.height = 300;
        const ctx = canvas.getContext('2d');

        const WAVES = [5, 7, 9];
        let waveIndex = 0;
        let toSpawn = 0;
        let spawnTimer = 0;

        const player = { x: W / 2, w: 26, h: 16 };
        const mines = [];
        const bullets = [];
        const particles = [];
        let lives = 3;
        let lastShot = 0;
        let finished = false;
        let waveBanner = '';
        let waveBannerUntil = 0;

        function announceWave() {
          waveBanner = `VAGUE ${waveIndex + 1}/${WAVES.length}`;
          waveBannerUntil = performance.now() + 1400;
          if (crtSubbar) crtSubbar.textContent = `${waveBanner} // ${WAVES[waveIndex]} MINES EN APPROCHE`;
          toSpawn = WAVES[waveIndex];
          spawnTimer = 0;
        }
        announceWave();

        function spawnMine() {
          const speed = 0.55 + waveIndex * 0.22 + Math.random() * 0.3;
          mines.push({
            x: 24 + Math.random() * (W - 48),
            y: -16,
            r: 8 + Math.random() * 5,
            speed,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 1.4 + Math.random() * 1.4,
            wobbleAmp: 10 + Math.random() * 18
          });
        }

        function burst(x, y) {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            particles.push({ x, y, vx: Math.cos(a) * 1.8, vy: Math.sin(a) * 1.8, life: 1 });
          }
        }

        function shoot(t) {
          if (t - lastShot < 240) return;
          lastShot = t;
          bullets.push({ x: player.x, y: H - 30 });
        }

        canvas.addEventListener('mousemove', e => {
          const rect = canvas.getBoundingClientRect();
          const scaleX = W / rect.width; // le canvas peut être affiché à une taille CSS différente de sa résolution interne
          const localX = (e.clientX - rect.left) * scaleX;
          player.x = Math.max(player.w, Math.min(W - player.w, localX));
        });
        canvas.addEventListener('click', () => shoot(performance.now()));

        function finish(success, msg) {
          if (finished) return;
          finished = true;
          cleanup();
          endMinigame(success, msg);
        }

        let lastT = null;

        function loop(t) {
          if (mg.done) { cleanup(); return; }
          raf = requestAnimationFrame(loop);

          // Delta-time (comme l'ancien prototype de défense) : le jeu
          // reste correct quel que soit le taux de rafraîchissement.
          if (lastT === null) lastT = t;
          const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
          lastT = t;

          if (keys.ArrowLeft) player.x = Math.max(player.w, player.x - 260 * dt);
          if (keys.ArrowRight) player.x = Math.min(W - player.w, player.x + 260 * dt);
          if (keys[' ']) shoot(t);

          // tirage de la vague en cours
          if (toSpawn > 0) {
            spawnTimer -= dt * 1000;
            if (spawnTimer <= 0) {
              spawnMine();
              toSpawn -= 1;
              spawnTimer = 480 - waveIndex * 60;
            }
          }

          // fin de vague : plus rien à l'écran ni à tirer
          if (toSpawn === 0 && mines.length === 0 && bullets.length === 0) {
            waveIndex += 1;
            if (waveIndex >= WAVES.length) { finish(true, 'CHAMP DE MINES NEUTRALISÉ'); return; }
            announceWave();
          }

          mines.forEach(m => {
            m.y += m.speed * 60 * dt;
            m.wobble += 1.2 * m.wobbleSpeed * dt;
            m.x += Math.sin(m.wobble) * 21 * dt;
          });
          bullets.forEach(b => { b.y -= 384 * dt; });
          particles.forEach(p => { p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.life -= 3 * dt; });
          for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
          for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].y < -10) bullets.splice(i, 1);

          for (let i = mines.length - 1; i >= 0; i--) {
            const m = mines[i];
            if (m.y - m.r > H) {
              mines.splice(i, 1);
              lives -= 1;
              playSfx('wrong', 0.3);
              if (crtStatusLeft) crtStatusLeft.textContent = `VIES : ${'X '.repeat(Math.max(0, lives)).trim()}`;
              if (lives <= 0) { finish(false, 'MINES PASSÉES // COQUE PERCÉE'); return; }
            }
          }

          for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            for (let mi = mines.length - 1; mi >= 0; mi--) {
              const m = mines[mi];
              const dx = b.x - m.x, dy = b.y - m.y;
              if (dx * dx + dy * dy <= (m.r + 3) * (m.r + 3)) {
                burst(m.x, m.y);
                playSfx('on', 0.1);
                mines.splice(mi, 1);
                bullets.splice(bi, 1);
                break;
              }
            }
          }

          ctx.clearRect(0, 0, W, H);
          ctx.fillStyle = '#9dffa0';
          mines.forEach(m => {
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
            ctx.fill();
          });
          particles.forEach(p => {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = '#f7ffc3';
            ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
          });
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#fa5a1f';
          ctx.beginPath();
          ctx.moveTo(player.x, H - 30);
          ctx.lineTo(player.x - player.w / 2, H - 14);
          ctx.lineTo(player.x + player.w / 2, H - 14);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#f7ffc3';
          bullets.forEach(b => ctx.fillRect(b.x - 1, b.y - 6, 2, 8));

          if (t < waveBannerUntil) {
            ctx.fillStyle = 'rgba(157,255,160,0.9)';
            ctx.font = '16px "Pixelify Sans", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(waveBanner, W / 2, H / 2);
          }
        }

        if (crtStatusLeft) crtStatusLeft.textContent = 'VIES : X X X';
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        raf = requestAnimationFrame(loop);
      }
    }, success => { cleanup(); onEnd(success); });
  }

  const MINIGAMES = { grep: grepMinigame, wires: wiresMinigame, invaders: invadersMinigame };

  // Fouiller les archives peut révéler le xénomorphe : c'est le vrai
  // butin du mini-jeu GREP quand une infection est en cours.
  function revealArchiveIntel() {
    window.setTimeout(() => {
      if (state.over) return;
      if (state.infectedId) {
        const npc = NPCS[state.infectedId];
        pushMessage('system', `ARCHIVES MÉDICALES // ANOMALIE : le dossier de ${npc.name} a été modifié il y a 12 minutes. Auteur de la modification : ${npc.name}.`, 'is-glitch');
        playSfx('wrong', 0.5);
      } else {
        pushMessage('system', 'ARCHIVES MÉDICALES // Tous les dossiers concordent. Pour l’instant, vous êtes seuls à bord.');
      }
    }, 2400);
  }

  // ─── SORTIE EVA (le joueur incarne le membre exposé) ────────────
  const evaOverlay = $('evaOverlay');
  const evaStars = $('evaStars');
  const evaBannerName = $('evaBannerName');
  const evaObjects = $('evaObjects');
  const evaHudFeed = $('evaHudFeed');
  const evaO2Fill = $('evaO2Fill');
  const evaO2Value = $('evaO2Value');
  const evaReturnBtn = $('evaReturnBtn');
  const evaFlashlight = $('evaFlashlight');
  const evaGlitch = $('evaGlitch');

  const EVA_DURATION_MS = 45000;
  const eva = {
    active: false,
    npc: null,
    onDone: null,
    deadline: 0,
    inspectedMain: false,
    beatDone: false,
    willInfect: false
  };

  function evaHudLine(text, danger = false) {
    if (!evaHudFeed) return;
    const line = document.createElement('div');
    line.className = 'eva-hud-line' + (danger ? ' is-danger' : '');
    line.textContent = text;
    evaHudFeed.appendChild(line);
    while (evaHudFeed.children.length > 3) evaHudFeed.removeChild(evaHudFeed.firstChild);
  }

  function drawEvaStars() {
    if (!evaStars) return;
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    evaStars.width = width * ratio;
    evaStars.height = height * ratio;
    const ctx = evaStars.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#010101';
    ctx.fillRect(0, 0, width, height);
    const count = Math.floor((width * height) / 3400);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = 0.18 + Math.random() * 0.6;
      ctx.fillStyle = '#f7ffc3';
      const size = Math.random() > 0.86 ? 2.2 : 1.2;
      ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Objets secondaires : un tirage différent à chaque sortie, jamais
  // garanti. Positions piochées séparément pour éviter les chevauchements.
  const EVA_EXTRAS = [
    {
      img: 'assets/debris-scene/bouteille-oxygene.png', label: 'BOUTEILLE DÉRIVANTE',
      find: 'Une bouteille d’oxygène cabossée. Le manomètre indique encore un tiers. Vous la sanglez à votre harnais. [O2 +8s]',
      bonusO2: 8000
    },
    {
      img: 'assets/debris-loot/pince-coupante.png', label: 'OUTIL PERDU',
      find: 'Une pince coupante, gravée d’initiales inconnues. Quelqu’un, quelque part, a lâché prise.'
    },
    {
      label: 'DÉBRIS INCONNU',
      find: 'Un fragment de coque qui n’appartient à aucun vaisseau que vous connaissez. Vous le laissez filer.'
    },
    {
      label: 'GANT DÉCHIRÉ',
      find: 'Un gant de combinaison, déchiré à la paume. Vide, heureusement. Vous préférez ne pas y penser davantage.'
    },
    {
      label: 'BALISE MORTE',
      find: 'Une balise de détresse, froide et silencieuse depuis longtemps. Le nom gravé dessus ne vous dit rien.'
    },
    {
      label: 'PAGE DE CARNET',
      find: 'Une page arrachée, couverte de givre. L’écriture est illisible. Vous la glissez dans une poche, par réflexe.'
    }
  ];

  const EVA_EXTRA_SPOTS = [
    { left: '26%', top: '48%', dur: '6.4s' },
    { left: '74%', top: '62%', dur: '7.2s' },
    { left: '20%', top: '68%', dur: '7.8s' },
    { left: '80%', top: '32%', dur: '6.8s' }
  ];

  function shuffled(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function buildEvaObjects(evaData) {
    if (!evaObjects) return;
    evaObjects.innerHTML = '';

    const defs = [
      {
        main: true, label: evaData.object, find: evaData.find,
        left: '58%', top: '30%', dur: '8s'
      }
    ];

    // 0, 1 ou 2 objets secondaires — jamais garantis, jamais les mêmes.
    const extraCount = pick([0, 1, 1, 2]);
    const extras = shuffled(EVA_EXTRAS).slice(0, extraCount);
    const spots = shuffled(EVA_EXTRA_SPOTS);
    extras.forEach((extra, index) => defs.push({ ...extra, ...spots[index] }));

    defs.forEach(def => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eva-object';
      btn.style.left = def.left;
      btn.style.top = def.top;
      btn.style.setProperty('--float-dur', def.dur);
      btn.innerHTML = def.main
        ? `<span class="eva-object-core"></span><span class="eva-object-label">${def.label}</span>`
        : def.img
          ? `<img src="${def.img}" alt=""><span class="eva-object-label">${def.label}</span>`
          : `<span class="eva-object-core eva-object-core-dim"></span><span class="eva-object-label">${def.label}</span>`;
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-done')) return;
        btn.classList.add('is-done');
        playClick();
        evaHudLine(def.find);
        if (def.bonusO2) eva.deadline += def.bonusO2;
        if (def.main) eva.inspectedMain = true;
      });
      evaObjects.appendChild(btn);
    });
  }

  function evaInfectionBeat() {
    if (eva.beatDone || !eva.active) return;
    eva.beatDone = true;
    if (eva.willInfect) {
      if (evaGlitch) {
        evaGlitch.classList.remove('is-active');
        void evaGlitch.offsetWidth;
        evaGlitch.classList.add('is-active');
      }
      playSfx('wrong', 0.7);
      window.setTimeout(() => {
        if (!eva.active) return;
        evaHudLine('Quelque chose vous a effleuré. Votre combinaison n’a rien enregistré.', true);
        window.setTimeout(() => {
          if (eva.active) evaHudLine(`SEUL ${NPCS[eva.npc].name} A VÉCU CET INSTANT. À vous de décider ce que vous en dites.`, true);
        }, 2600);
      }, 1500);
    } else {
      evaHudLine('Une ombre passe entre les étoiles. Probablement la vôtre. Probablement.');
    }
  }

  function startEva(npcId, evaData, onDone) {
    eva.active = true;
    eva.npc = npcId;
    eva.onDone = onDone;
    eva.deadline = Date.now() + EVA_DURATION_MS;
    eva.inspectedMain = false;
    eva.beatDone = false;
    eva.willInfect = state.infectionRun && !state.infectedId;

    const npc = NPCS[npcId];
    if (evaBannerName) evaBannerName.textContent = `VOUS INCARNEZ ${npc.name} // ${npc.role}`;
    if (evaOverlay) {
      evaOverlay.style.setProperty('--eva-color', npc.color);
      evaOverlay.classList.add('is-visible');
      evaOverlay.setAttribute('aria-hidden', 'false');
    }
    if (evaReturnBtn) evaReturnBtn.classList.add('is-visible');
    if (evaHudFeed) evaHudFeed.innerHTML = '';
    drawEvaStars();
    buildEvaObjects(evaData);
    setDoors(true, 'right');
    playSfx('on', 0.7);
    evaHudLine('Le sas se referme derrière vous. Votre respiration est le seul bruit de l’univers.');

    // Le moment privé arrive au coeur de la sortie.
    window.setTimeout(evaInfectionBeat, 14000 + Math.random() * 6000);
  }

  function finishEva(timedOut = false) {
    if (!eva.active) return;
    eva.active = false;
    const infect = eva.willInfect && eva.beatDone;
    const done = eva.onDone;
    const npcId = eva.npc;
    eva.onDone = null;
    if (evaOverlay) {
      evaOverlay.classList.remove('is-visible');
      evaOverlay.setAttribute('aria-hidden', 'true');
    }
    playSfx('off', 0.7);
    if (timedOut) pushMessage('system', `RÉSERVE O2 ÉPUISÉE // RETOUR FORCÉ DE ${NPCS[npcId].name}`);
    enterAirlockAfterEva(npcId);
    if (done) done(infect);
  }

  // Au retour de sortie, on ne revient pas directement au poste : on
  // arrive d'abord dans le sas tribord (même vue que la pièce
  // latérale), le temps que le cycle de pressurisation se termine.
  function enterAirlockAfterEva(npcId) {
    const room = ROOMS.right;
    roomOpen = 'right';
    setDoors(true, 'right');
    if (roomViewImg) roomViewImg.src = room.img;
    if (roomViewCaption) roomViewCaption.textContent = room.caption;
    if (roomView) {
      roomView.classList.add('is-visible');
      roomView.setAttribute('aria-hidden', 'false');
    }
    drawRoomSpace();
    pushMessage('system', `${NPCS[npcId].name} REGAGNE LE SAS // CYCLE DE PRESSURISATION EN COURS`);
    window.setTimeout(() => {
      if (roomOpen === 'right' && !state.over) closeRoom();
    }, 3200);
  }

  function evaTick(now) {
    if (!eva.active) return;
    const remaining = Math.max(0, eva.deadline - now);
    if (evaO2Value) evaO2Value.textContent = String(Math.ceil(remaining / 1000));
    if (evaO2Fill) evaO2Fill.style.transform = `scaleX(${Math.min(1, remaining / EVA_DURATION_MS)})`;
    if (remaining <= 0) finishEva(true);
  }

  // ─── ÉVÉNEMENTS : DÉROULEMENT ───────────────────────────────────
  let eventQueue = [];

  function buildQueue() {
    const all = EVENTS.slice();
    // Les deux premiers événements offrent une option de sortie en sas,
    // pour que l'infection puisse démarrer tôt si le joueur s'expose.
    const openers = all.filter(e => e.options.some(o => o.exposes));
    const rest = all.filter(e => !e.options.some(o => o.exposes));
    openers.sort(() => Math.random() - 0.5);
    rest.sort(() => Math.random() - 0.5);
    eventQueue = [openers[0], ...[...openers.slice(1), ...rest].sort(() => Math.random() - 0.5)];
  }

  // ─── VOTE DE L'ÉQUIPAGE ─────────────────────────────────────────
  // Chaque PNJ vote pour l'option qu'il juge la moins risquée, selon
  // les jauges qu'elle affecte. Un PNJ infecté vote À L'INVERSE (il
  // pousse discrètement vers la pire option) — son vote peut donc
  // trahir un mensonge tenu dans ses messages.
  function optionRiskScore(opt) {
    const fx = opt.fx || (opt.success ? opt.success.fx : null) || {};
    let score = (fx.hull || 0) + (fx.fuel || 0) + (fx.signal || 0);
    if (opt.exposes) score -= 3;
    if (opt.minigame) score -= 1;
    return score;
  }

  function weightedPick(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return Math.floor(Math.random() * weights.length);
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return weights.length - 1;
  }

  function computeVotes(evt) {
    const scores = evt.options.map(optionRiskScore);
    const votes = {};
    aliveNpcs().forEach(npc => {
      const infected = isLiar(npc);
      const weights = scores.map(s => Math.exp((infected ? -s : s) / 5));
      votes[npc] = weightedPick(weights);
    });
    return votes;
  }

  function renderVoteMark(npc, optionIndex) {
    const row = eventOptions ? eventOptions.querySelectorAll('.event-option-votes')[optionIndex] : null;
    if (!row) return;
    const mark = document.createElement('span');
    mark.className = 'vote-mark';
    mark.style.setProperty('--vote-color', NPCS[npc].color);
    mark.textContent = NPCS[npc].name.slice(0, 1);
    mark.title = NPCS[npc].name;
    row.appendChild(mark);
  }

  function startEvent(evt) {
    if (state.over) return;
    state.activeEvent = evt;
    state.decideTotal = evt.decide * 1000;
    state.decideDeadline = Date.now() + state.decideTotal;
    state.eventVotes = computeVotes(evt);
    setSceneFx(evt.scene || null);

    playSfx('on', 0.55);
    pushMessage('system', `ÉVÉNEMENT // ${evt.title.toUpperCase()}`, 'is-event');

    if (eventKicker) eventKicker.textContent = evt.kicker;
    if (eventTitle) eventTitle.textContent = evt.title;
    if (eventText) eventText.textContent = evt.text;
    if (eventVisual && eventVisualImg) {
      if (evt.img) {
        eventVisualImg.src = evt.img;
        eventVisual.classList.add('is-visible');
      } else {
        eventVisual.classList.remove('is-visible');
        eventVisualImg.removeAttribute('src');
      }
    }
    if (eventOptions) {
      eventOptions.innerHTML = '';
      evt.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'event-option';
        btn.innerHTML = `<span class="event-option-label">${opt.label}</span><span class="event-option-hint">${opt.hint}</span><span class="event-option-votes" aria-hidden="true"></span>`;
        btn.addEventListener('click', () => {
          playClick();
          resolveEvent(index);
        });
        eventOptions.appendChild(btn);
      });
    }
    if (eventPanel) eventPanel.classList.add('is-visible');

    // Les infos partielles arrivent en décalé, comme sur un vrai vocal.
    // Le vote de chacun s'affiche juste après son message.
    evt.msgs.forEach(msg => {
      window.setTimeout(() => {
        if (state.activeEvent !== evt || state.over) return;
        const text = pickText(isLiar(msg.npc) && msg.lie ? msg.lie : msg.t);
        if (!state.ejected[msg.npc]) pushMessage(msg.npc, text);
        if (state.eventVotes && state.eventVotes[msg.npc] !== undefined) {
          window.setTimeout(() => {
            if (state.activeEvent === evt) renderVoteMark(msg.npc, state.eventVotes[msg.npc]);
          }, 700);
        }
      }, msg.d);
    });

    // PNJ sans message dédié pour cet événement : vote quand même,
    // avec un léger délai aléatoire.
    Object.keys(state.eventVotes).forEach(npc => {
      if (evt.msgs.some(m => m.npc === npc)) return;
      window.setTimeout(() => {
        if (state.activeEvent === evt) renderVoteMark(npc, state.eventVotes[npc]);
      }, rand(2000, evt.decide * 700));
    });
  }

  function tallyMajority(votes) {
    const counts = {};
    Object.values(votes).forEach(idx => { counts[idx] = (counts[idx] || 0) + 1; });
    let bestIdx = null, bestCount = 0;
    Object.entries(counts).forEach(([idx, count]) => {
      if (count > bestCount) { bestCount = count; bestIdx = Number(idx); }
    });
    const total = Object.keys(votes).length;
    const tie = Object.values(counts).filter(c => c === bestCount).length > 1;
    return { bestIdx, bestCount, total, tie };
  }

  function applyDecisionTrust(evt, optionIndex) {
    const votes = state.eventVotes;
    if (!votes || Object.keys(votes).length === 0) return;
    const { bestIdx, bestCount, total, tie } = tallyMajority(votes);

    if (optionIndex === -1) {
      state.trust = clamp(state.trust - 5);
      return;
    }

    const supporters = Object.entries(votes).filter(([, idx]) => idx === optionIndex).map(([npc]) => NPCS[npc].name);

    if (supporters.length === total && total > 0) {
      state.trust = clamp(state.trust + 6);
      pushMessage('system', `DÉCISION UNANIME SUIVIE (${total}/${total}).`);
    } else if (!tie && optionIndex === bestIdx) {
      state.trust = clamp(state.trust + 4);
      pushMessage('system', `VOUS AVEZ SUIVI LA MAJORITÉ (${bestCount}/${total}) : ${supporters.join(', ')}.`);
    } else if (supporters.length > 0) {
      state.trust = clamp(state.trust - 4);
      pushMessage('system', `DÉCISION MINORITAIRE. Soutenue par ${supporters.join(', ')} seulement.`);
    } else {
      state.trust = clamp(state.trust - 9);
      const majOpt = evt.options[bestIdx];
      pushMessage('system', `VOUS ÊTES ALLÉ CONTRE L'AVIS DE L'ÉQUIPAGE. Personne n'avait voté pour ce choix (majorité : « ${majOpt ? majOpt.label : '—'} »).`, 'is-glitch');
    }

    updateTrustDisplay();
    if (state.trust <= 20 && state.trustReprieveArmed && !state.over && !tribunal.active) {
      startNoConfidenceVote();
    }
  }

  // ─── MOTION DE DÉFIANCE (destitution jouable) ───────────────────
  // Plutôt qu'une fin silencieuse quand la confiance s'effondre,
  // l'équipage se réunit et vote à voix haute. Le Capitaine a un
  // dernier mot pour infléchir le résultat, puis chaque PNJ révèle
  // sa position un par un — un vrai moment « tout le monde se
  // regarde » plutôt qu'un simple seuil technique.
  const tribunal = { active: false };

  const TRIBUNAL_DEFENSES = [
    { label: 'Rappeler froidement les faits', hint: 'sobre — la meilleure chance', delta: -0.16 },
    { label: 'En appeler à la loyauté de l’équipage', hint: 'jouer l’affect — plus risqué', delta: -0.07 },
    { label: 'Ne rien dire, assumer', hint: 'aucun filet', delta: 0 }
  ];

  const TRIBUNAL_AGAINST = {
    vega: 'Je suis désolée, capitaine. Je vote pour vous démettre.',
    kessel: 'On ne peut plus se permettre vos erreurs. Contre vous.',
    tilt: 'J’aurais préféré ne pas avoir à le dire. Contre.'
  };
  const TRIBUNAL_FOR = {
    vega: 'Vous avez encore ma confiance.',
    kessel: 'On reste avec vous, capitaine. Pour l’instant.',
    tilt: 'Je vote pour vous. On n’abandonne pas.'
  };

  function startNoConfidenceVote() {
    if (tribunal.active || state.over) return;
    tribunal.active = true;
    state.trustReprieveArmed = false;
    if (state.activeEvent) { state.activeEvent = null; }
    playSfx('wrong', 0.5);
    pushMessage('system', 'L’ÉQUIPAGE SE RÉUNIT // MOTION DE DÉFIANCE CONTRE LE CAPITAINE', 'is-glitch');

    if (eventKicker) eventKicker.textContent = 'TRIBUNAL DE BORD';
    if (eventTitle) eventTitle.textContent = 'L’équipage doute de vous.';
    if (eventText) eventText.textContent = 'Trop de décisions contestées. Avant le vote, vous avez droit à un dernier mot.';
    if (eventVisual) eventVisual.classList.remove('is-visible');
    if (eventOptions) {
      eventOptions.innerHTML = '';
      TRIBUNAL_DEFENSES.forEach(def => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'event-option event-option-tribunal';
        btn.innerHTML = `<span class="event-option-label">${def.label}</span><span class="event-option-hint">${def.hint}</span>`;
        btn.addEventListener('click', () => { playClick(); resolveTribunalDefense(def.delta); });
        eventOptions.appendChild(btn);
      });
    }
    if (eventPanel) {
      eventPanel.classList.add('is-visible');
      eventPanel.classList.add('is-tribunal');
    }
  }

  function resolveTribunalDefense(delta) {
    if (eventPanel) {
      eventPanel.classList.remove('is-visible');
      eventPanel.classList.remove('is-tribunal');
    }
    const alive = aliveNpcs();
    const votes = {};
    alive.forEach(npc => {
      let p = Math.max(0, Math.min(1, (45 - state.trust) / 45)) + delta;
      if (isLiar(npc)) p += 0.25; // l'infecté pousse discrètement à la destitution
      votes[npc] = Math.random() < Math.max(0.05, Math.min(0.92, p));
    });
    window.setTimeout(() => revealTribunalVotes(alive, votes, 0), 900);
  }

  function revealTribunalVotes(alive, votes, index) {
    if (state.over) return;
    if (index >= alive.length) {
      window.setTimeout(() => finishTribunal(votes), 900);
      return;
    }
    const npc = alive[index];
    const against = votes[npc];
    pushMessage(npc, against ? TRIBUNAL_AGAINST[npc] : TRIBUNAL_FOR[npc], against ? 'is-glitch' : '');
    playSfx(against ? 'wrong' : 'on', 0.4);
    window.setTimeout(() => revealTribunalVotes(alive, votes, index + 1), 1500);
  }

  function finishTribunal(votes) {
    tribunal.active = false;
    if (state.over) return;
    const total = Object.keys(votes).length;
    const against = Object.values(votes).filter(Boolean).length;
    if (total > 0 && against > total / 2) {
      endGame(false, 'DESTITUÉ<br>PAR L’ÉQUIPAGE', 'Le vote est net. VEGA prend la barre. Vous n’êtes plus le capitaine de ce vaisseau — vous n’êtes plus qu’un passager, jusqu’à ARECIBO.');
      return;
    }
    state.trust = 38;
    pushMessage('system', `MOTION REJETÉE (${total - against}/${total}). Vous restez capitaine. De justesse.`);
    updateTrustDisplay();
  }

  function updateTrustDisplay() {
    if (state.trust > 45) state.trustReprieveArmed = true;
    if (crewScans) {
      const scanLine = `SCANS MÉDICAUX : ${state.scansLeft}`;
      crewScans.innerHTML = `${scanLine}<br>CONFIANCE : <span class="${state.trust < 35 ? 'trust-low' : ''}">${state.trust}%</span>`;
    }
  }

  function resolveEvent(optionIndex) {
    const evt = state.activeEvent;
    if (!evt || state.over) return;
    state.activeEvent = null;
    state.eventsResolved += 1;
    if (eventPanel) eventPanel.classList.remove('is-visible');
    // La scène du hublot s'éteint en fondu quelques secondes après la
    // décision : on laisse le temps de voir la conséquence.
    window.setTimeout(clearSceneFx, 5000);
    applyDecisionTrust(evt, optionIndex);
    if (state.over) return;

    const finish = (fx, out) => {
      window.setTimeout(() => {
        if (state.over) return;
        pushMessage('system', out, 'is-event');
        applyEffects(fx);
      }, 900);

      // Infection garantie de démarrer si le run la prévoit mais que le
      // joueur n'a exposé personne : une brèche silencieuse s'en charge.
      if (state.infectionRun && !state.infectedId && state.eventsResolved >= 3) {
        window.setTimeout(() => {
          if (state.over || state.infectedId) return;
          pushMessage('system', 'micro-brèche détectée pont inférieur // colmatage automatique', 'is-glitch');
          infect(pick(aliveNpcs()));
        }, 6000);
      }

      state.nextEventAt = Date.now() + rand(26000, 38000);
      state.nextIdleAt = Date.now() + rand(9000, 14000);
    };

    if (optionIndex === -1) {
      pushMessage('system', 'AUCUNE DÉCISION // PROTOCOLE PAR DÉFAUT');
      finish(evt.timeout.fx, evt.timeout.out);
      return;
    }

    const opt = evt.options[optionIndex];

    if (opt.special === 'ultrason') {
      state.ultrasonUsed = true;
      window.setTimeout(() => {
        if (state.over) return;
        if (state.infectedId) {
          pushMessage('system', 'ULTRASON // RÉPONSE BIOLOGIQUE INCONNUE À BORD // LOCALISATION IMPOSSIBLE', 'is-glitch');
          playSfx('wrong', 0.6);
        } else if (state.infectionRun) {
          pushMessage('system', 'ULTRASON // AUCUN ÉCHO BIOLOGIQUE ANORMAL... POUR L’INSTANT');
        } else {
          pushMessage('system', 'ULTRASON // AUCUN ÉCHO BIOLOGIQUE ANORMAL');
        }
      }, 2600);
    }

    // Tâche manuelle : mini-jeu à temps limité au terminal.
    if (opt.minigame && MINIGAMES[opt.minigame]) {
      pushMessage('system', 'TÂCHE MANUELLE REQUISE // UN OPÉRATEUR AU TERMINAL', 'is-event');
      MINIGAMES[opt.minigame](success => {
        const res = success ? opt.success : opt.fail;
        if (opt.minigame === 'grep' && success) revealArchiveIntel();
        finish(res.fx, res.out);
      });
      return;
    }

    // Sortie en sas : le joueur incarne le membre exposé, en direct.
    if (opt.eva && opt.exposes && !state.ejected[opt.exposes]) {
      pushMessage('system', `${NPCS[opt.exposes].name.toUpperCase()} PASSE LE SAS // TRANSFERT DE POINT DE VUE`, 'is-event');
      startEva(opt.exposes, opt.eva, gotInfected => {
        if (gotInfected) infect(opt.exposes);
        finish(opt.fx, opt.out);
      });
      return;
    }

    if (opt.exposes && !state.ejected[opt.exposes]) handleExposure(opt.exposes);
    finish(opt.fx, opt.out);
  }

  function idleTick(now) {
    if (state.activeEvent || state.over || now < state.nextIdleAt) return;
    state.nextIdleAt = now + rand(16000, 26000);
    const npcId = pick(aliveNpcs());
    if (!npcId) return;
    if (isLiar(npcId) && Math.random() < 0.45) {
      pushMessage(npcId, pick(INFECTED_IDLE_LINES));
    } else {
      pushMessage(npcId, pick(IDLE_LINES[npcId]));
    }
  }

  // ─── ÉQUIPAGE : ROSTER + FICHE MEMBRE ───────────────────────────
  function renderCrew() {
    if (!crewList) return;
    crewList.innerHTML = '';
    Object.entries(NPCS).forEach(([id, npc]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crew-member';
      btn.style.setProperty('--member-color', npc.color);
      btn.disabled = state.ejected[id];
      btn.innerHTML = `
        <img class="crew-member-portrait" src="${npc.portrait}" alt="">
        <span>
          <span class="crew-member-name">${npc.name}</span><br>
          <span class="crew-member-role">${npc.role}</span>
          ${state.ejected[id] ? '<br><span class="crew-member-state">ÉJECTÉ</span>' : ''}
        </span>`;
      btn.addEventListener('click', () => {
        playClick();
        openMemberModal(id);
      });
      crewList.appendChild(btn);
    });
    updateTrustDisplay();
  }

  function openMemberModal(id) {
    if (state.over || state.ejected[id]) return;
    state.modalTarget = id;
    state.ejectArmed = false;
    const npc = NPCS[id];
    if (memberPortrait) memberPortrait.src = npc.portrait;
    if (memberName) memberName.textContent = npc.name;
    if (memberRole) memberRole.textContent = npc.role;
    if (memberStatus) {
      memberStatus.textContent = 'STATUT : À BORD';
      memberStatus.className = 'member-card-status';
    }
    if (memberScanBtn) {
      memberScanBtn.disabled = state.scansLeft <= 0 || state.fuel <= 8;
      memberScanBtn.innerHTML = state.scansLeft <= 0
        ? 'SCANNER <span class="member-btn-cost">ÉPUISÉ</span>'
        : (state.fuel <= 8
          ? 'SCANNER <span class="member-btn-cost">CARBURANT INSUFFISANT</span>'
          : 'SCANNER <span class="member-btn-cost">− 8 CARBURANT</span>');
    }
    if (memberEjectBtn) {
      memberEjectBtn.textContent = 'ÉJECTER PAR LE SAS';
      memberEjectBtn.classList.remove('is-armed');
    }
    if (memberModal) {
      memberModal.classList.add('is-visible');
      memberModal.setAttribute('aria-hidden', 'false');
    }
  }

  function closeMemberModal() {
    state.modalTarget = null;
    state.ejectArmed = false;
    state.scanning = false;
    if (memberModal) {
      memberModal.classList.remove('is-visible');
      memberModal.setAttribute('aria-hidden', 'true');
    }
  }

  function runScan() {
    const id = state.modalTarget;
    if (!id || state.scanning || state.scansLeft <= 0 || state.fuel <= 8) return;
    state.scanning = true;
    state.scansLeft -= 1;
    applyEffects({ fuel: -8 }, true);
    pushMessage('system', `SCAN MÉDICAL EN COURS // ${NPCS[id].name}`);
    if (memberScanBtn) memberScanBtn.disabled = true;
    if (memberStatus) {
      memberStatus.textContent = 'ANALYSE BIOLOGIQUE EN COURS...';
      memberStatus.className = 'member-card-status is-scanning';
    }
    window.setTimeout(() => {
      state.scanning = false;
      if (state.over || state.modalTarget !== id) return;
      const infected = state.infectedId === id;
      if (memberStatus) {
        memberStatus.textContent = infected
          ? 'ORGANISME ÉTRANGER DÉTECTÉ // CE N’EST PLUS ' + NPCS[id].name
          : 'AUCUNE ANOMALIE // ' + NPCS[id].name + ' EST ' + NPCS[id].name;
        memberStatus.className = 'member-card-status ' + (infected ? 'is-alien' : 'is-clear');
      }
      pushMessage('system', infected
        ? `SCAN // ${NPCS[id].name} : ORGANISME ÉTRANGER DÉTECTÉ`
        : `SCAN // ${NPCS[id].name} : RAS`, infected ? 'is-glitch' : '');
      playSfx(infected ? 'wrong' : 'on', 0.7);
      updateTrustDisplay();
    }, 3400);
  }

  function runEject() {
    const id = state.modalTarget;
    if (!id || state.scanning) return;
    if (!state.ejectArmed) {
      state.ejectArmed = true;
      if (memberEjectBtn) {
        memberEjectBtn.textContent = 'CONFIRMER L’ÉJECTION ?';
        memberEjectBtn.classList.add('is-armed');
      }
      playSfx('wrong', 0.4);
      return;
    }

    const npc = NPCS[id];
    state.ejected[id] = true;
    closeMemberModal();
    playAirlockSequence();
    playSfx('wrong', 0.55);

    if (state.infectedId === id) {
      state.infectedId = null;
      state.xenoEjected = true;
      window.setTimeout(() => {
        pushMessage('system', `${npc.name} A ÉTÉ ÉJECTÉ PAR LE SAS TRIBORD`, 'is-event');
        pushMessage('system', 'Dans le vide, la silhouette se tord. Ce qui flotte dehors n’a plus rien de ' + npc.name + '.', 'is-glitch');
        applyEffects({ signal: 6 });
        const others = aliveNpcs();
        if (others.length) npcSay(others[0], 'C’était... c’était pas lui depuis le début, hein ? Dites-moi qu’on a bien fait.', 2600);
      }, 1200);
    } else {
      state.innocentsEjected += 1;
      window.setTimeout(() => {
        pushMessage('system', `${npc.name} A ÉTÉ ÉJECTÉ PAR LE SAS TRIBORD`, 'is-event');
        pushMessage('system', npc.name + ' était parfaitement sain. Son poste restera vide jusqu’à ARECIBO.', '');
        applyEffects({ signal: -10 });
        const others = aliveNpcs();
        if (others.length) npcSay(others[others.length - 1], 'Il hurlait qu’il était innocent, capitaine. On l’entendra longtemps, celui-là.', 2800);
      }, 1200);
    }
    renderCrew();
  }

  // ─── FIN DE PARTIE ──────────────────────────────────────────────
  function endGame(win, title, copy, arrival = false) {
    if (state.over) return;
    state.over = true;
    state.activeEvent = null;
    if (eventPanel) eventPanel.classList.remove('is-visible');
    closeMemberModal();
    closeRoom();
    if (eva.active) {
      eva.active = false;
      eva.onDone = null;
      if (evaOverlay) evaOverlay.classList.remove('is-visible');
    }
    state.alienActive = false;
    tribunal.active = false;
    clearSceneFx();
    if (endVisual) endVisual.classList.toggle('is-visible', arrival);
    if (endKicker) endKicker.textContent = win ? 'MOTOMOTO // TRANSMISSION FINALE' : 'MOTOMOTO // DERNIERE TRANSMISSION';
    if (endTitle) {
      endTitle.innerHTML = title;
      endTitle.classList.toggle('is-win', win);
    }
    if (endCopy) endCopy.textContent = copy;
    if (endOverlay) endOverlay.classList.add('is-visible');
    playSfx(win ? 'jingle' : 'wrong', 0.8);
  }

  function checkDefeat() {
    if (state.over) return;
    if (state.hull <= 0) {
      endGame(false, 'COQUE<br>ROMPUE', 'Le MOTOMOTO se déchire en silence. Dans l’espace, personne ne vous entendra bricoler.');
    } else if (state.fuel <= 0) {
      endGame(false, 'RÉSERVES<br>À SEC', 'Les moteurs s’éteignent un à un. Le vaisseau dérive, parfaitement intact, parfaitement perdu.');
    } else if (state.signal <= 0) {
      endGame(false, 'SIGNAL<br>PERDU', 'ARECIBO s’est tue. Sans elle, l’espace n’a plus de direction. Vous naviguez nulle part, pour toujours.');
    }
  }

  function checkVictory() {
    if (state.over) return;
    const elapsed = Date.now() - state.startedAt;
    if (elapsed < DURATION_MS) return;

    if (state.infectedId) {
      endGame(false, 'ARECIBO<br>EN VUE', 'Le MOTOMOTO se pose. L’équipage descend, épuisé, soulagé. L’un d’eux sourit un peu trop longtemps. Quelque chose est arrivé à ARECIBO avec vous.', true);
      return;
    }

    if (state.xenoEjected) {
      endGame(true, 'ARECIBO<br>EN VUE', 'Le signal devient une voix, la voix devient une lumière. Vous avez regardé le monstre dans les yeux, et c’est lui qui flotte dehors. Bienvenue à ARECIBO.', true);
    } else if (state.innocentsEjected > 0) {
      endGame(true, 'ARECIBO<br>EN VUE', 'Vous êtes arrivés. Le poste vide dans le cockpit pèse plus lourd que le vaisseau. Il n’y avait peut-être jamais eu de monstre à bord. À part le doute.', true);
    } else {
      endGame(true, 'ARECIBO<br>EN VUE', 'Le voyage s’achève dans le bruit, le doute et la mauvaise musique. L’équipage est entier, le vaisseau tient debout. ARECIBO vous ouvre ses portes.', true);
    }
  }

  // ─── RENCONTRE RARE : LE CONTACT ────────────────────────────────
  // ~5% de chance à chaque tirage d'événement (après un minimum de
  // rounds pour la pacing). Cinq choix d'affilée, un seul juste par
  // round : au premier faux pas, silence total. Les cinq bons choix
  // ouvrent la seule vraie fin « parfaite » du jeu.
  const ALIEN_CHANCE = 0.05;
  const ALIEN_ROUND_MS = 16000;

  const ALIEN_ROUNDS = [
    {
      kicker: 'CONTACT // SÉQUENCE 1/5',
      title: 'Ça frappe au sas, en rythme.',
      text: 'Trois coups. Une pause. Trois coups. Ce n’est pas un débris. Ce n’est pas un membre de l’équipage.',
      options: [
        { label: 'Répondre : trois coups, une pause', correct: true },
        { label: 'Répondre par un signal aléatoire', correct: false },
        { label: 'Ne pas répondre', correct: false }
      ]
    },
    {
      kicker: 'CONTACT // SÉQUENCE 2/5',
      title: 'Une carte s’allume sur vos écrans.',
      text: 'Un tracé de lumière, au-delà de tout ce que vos instruments connaissent. Ils veulent vous montrer quelque chose.',
      options: [
        { label: 'Suivre exactement le tracé', correct: true },
        { label: 'Suivre en gardant une marge de sécurité', correct: false },
        { label: 'Couper la navigation', correct: false }
      ]
    },
    {
      kicker: 'CONTACT // SÉQUENCE 3/5',
      title: 'Leur monde meurt.',
      text: 'Une planète grise, craquelée, sous un ciel d’une couleur qui ne devrait pas exister. Ils vous montrent ce qui pompe leur lumière.',
      options: [
        { label: 'Offrir votre énergie de bord, sans hésiter', correct: true },
        { label: 'Négocier avant de donner quoi que ce soit', correct: false },
        { label: 'Leur montrer votre propre détresse d’abord', correct: false }
      ]
    },
    {
      kicker: 'CONTACT // SÉQUENCE 4/5',
      title: 'Ils vous tendent quelque chose.',
      text: 'Une forme, ni main ni outil. Elle attend, immobile. Le moindre geste peut tout changer.',
      options: [
        { label: 'La saisir sans hésiter', correct: true },
        { label: 'L’examiner avant de toucher', correct: false },
        { label: 'Reculer, par réflexe', correct: false }
      ]
    },
    {
      kicker: 'CONTACT // SÉQUENCE 5/5',
      title: 'La dernière question.',
      text: 'Une pensée s’installe dans votre tête, sans mot : « Pourquoi devrions-nous vous sauver ? »',
      options: [
        { label: '« Parce qu’on a essayé de vous comprendre. »', correct: true },
        { label: '« Parce qu’on est plus forts ensemble. »', correct: false },
        { label: 'Ne rien répondre', correct: false }
      ]
    }
  ];

  function maybeStartAlienEncounter() {
    if (state.alienDone || state.alienActive || state.eventsResolved < 2) return false;
    if (Math.random() >= ALIEN_CHANCE) return false;
    startAlienEncounter();
    return true;
  }

  function startAlienEncounter() {
    state.alienActive = true;
    state.alienStep = 0;
    setSceneFx('alien');
    pushMessage('system', 'SIGNAL INCONNU // CONTACT AU SAS TRIBORD', 'is-event');
    playSfx('alarm', 0.4);
    renderAlienRound();
  }

  function renderAlienRound() {
    const round = ALIEN_ROUNDS[state.alienStep];
    state.alienDeadline = Date.now() + ALIEN_ROUND_MS;

    if (eventKicker) eventKicker.textContent = round.kicker;
    if (eventTitle) eventTitle.textContent = round.title;
    if (eventText) eventText.textContent = round.text;
    if (eventVisual) eventVisual.classList.remove('is-visible');
    if (eventOptions) {
      eventOptions.innerHTML = '';
      round.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'event-option event-option-alien';
        btn.innerHTML = `<span class="event-option-label">${opt.label}</span>`;
        btn.addEventListener('click', () => {
          playClick();
          resolveAlienChoice(opt.correct);
        });
        eventOptions.appendChild(btn);
      });
    }
    if (eventPanel) eventPanel.classList.add('is-visible');
  }

  function resolveAlienChoice(correct) {
    if (!state.alienActive) return;
    if (eventPanel) eventPanel.classList.remove('is-visible');

    if (!correct) {
      state.alienActive = false;
      state.alienDone = true;
      window.setTimeout(() => {
        endGame(false, 'SILENCE<br>TOTAL', 'Le mauvais geste, le mauvais mot, le mauvais rythme. Le sas ne s’ouvre plus jamais. Il ne reste personne pour raconter ce qui s’est passé ce jour-là.');
      }, 700);
      return;
    }

    state.alienStep += 1;
    if (state.alienStep >= ALIEN_ROUNDS.length) {
      state.alienActive = false;
      state.alienDone = true;
      window.setTimeout(() => {
        endGame(true, 'CONTACT<br>TRANSCENDANT', 'Le monde gris reprend des couleurs devant vos yeux. Une pensée calme et immense s’installe en vous : vous savez, désormais, tout ce qu’il y a à savoir. Le MOTOMOTO reprend sa route vers ARECIBO — mais plus rien, à bord, ne sera tout à fait pareil.', true);
      }, 900);
      return;
    }

    window.setTimeout(renderAlienRound, 1100);
  }

  function alienTick(now) {
    if (!state.alienActive) return;
    const remaining = Math.max(0, state.alienDeadline - now);
    if (eventCountdown) eventCountdown.textContent = String(Math.ceil(remaining / 1000));
    if (eventTimerFill) eventTimerFill.style.transform = `scaleX(${remaining / ALIEN_ROUND_MS})`;
    if (remaining <= 0) resolveAlienChoice(false);
  }

  // ─── VIE DU COCKPIT : LEDS + ÉCRANS MURAUX ─────────────────────
  // Positions en % de l'écran → suivent le redimensionnement.
  const bridgeLife = $('bridgeLife');
  const wallScreens = [];

  const LED_SPOTS = [
    { x: 7.2, y: 47, c: '#fa5a1f' }, { x: 8.6, y: 52, c: '#f7ffc3' },
    { x: 6.4, y: 57, c: '#dbe79b' }, { x: 9.4, y: 62, c: '#fa5a1f' },
    { x: 92.4, y: 47, c: '#f7ffc3' }, { x: 91, y: 52, c: '#fa5a1f' },
    { x: 93.4, y: 57, c: '#dbe79b' }, { x: 90.2, y: 62, c: '#fa5a1f' },
    { x: 30, y: 68, c: '#fa5a1f' }, { x: 70, y: 68, c: '#f7ffc3' }
  ];

  // Coordonnées relevées sur motomoto-screen-01.png : les deux petits
  // écrans noirs peints sur les consoles latérales.
  const WALL_SCREEN_SPOTS = [
    { x: 27.3, y: 41.8, w: 4.6, h: 4.6, amber: false },
    { x: 68.2, y: 41.8, w: 4.6, h: 4.6, amber: true }
  ];

  const DATA_WORDS = ['NAV', 'O2', 'PWR', 'SYS', 'CRG', 'SIG', 'ENV', 'THR', 'LNK', 'BAK'];

  function dataLine() {
    const w = pick(DATA_WORDS);
    const n = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    const flag = Math.random() < 0.08 ? ' !!' : Math.random() < 0.3 ? ' OK' : '';
    return `${w}.${n} ${grepChunk(4)}${flag}`;
  }

  // L'image du cockpit (1920x1080) est affichée en object-fit: cover :
  // on convertit les % de l'IMAGE en pixels écran pour que LEDs et
  // écrans restent calés sur le décor à n'importe quelle taille.
  const BRIDGE_RATIO = 1920 / 1080;
  const lifeNodes = [];

  function positionBridgeLife() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.max(vw / 1920, vh / 1080);
    const dw = 1920 * scale;
    const dh = 1080 * scale;
    const ox = (vw - dw) / 2;
    const oy = (vh - dh) / 2;
    lifeNodes.forEach(item => {
      item.node.style.left = `${ox + (item.x / 100) * dw}px`;
      item.node.style.top = `${oy + (item.y / 100) * dh}px`;
      if (item.w) item.node.style.width = `${(item.w / 100) * dw}px`;
      if (item.h) item.node.style.height = `${(item.h / 100) * dh}px`;
    });
  }

  function buildBridgeLife() {
    if (!bridgeLife) return;
    LED_SPOTS.forEach(spot => {
      const led = document.createElement('span');
      led.className = 'bridge-led';
      led.style.setProperty('--led-color', spot.c);
      led.style.setProperty('--led-dur', `${(1.6 + Math.random() * 3.2).toFixed(2)}s`);
      led.style.setProperty('--led-delay', `${(Math.random() * 3).toFixed(2)}s`);
      bridgeLife.appendChild(led);
      lifeNodes.push({ node: led, x: spot.x, y: spot.y });
    });

    WALL_SCREEN_SPOTS.forEach(spot => {
      const screen = document.createElement('div');
      screen.className = 'wall-screen' + (spot.amber ? ' is-amber' : '');
      const inner = document.createElement('span');
      inner.className = 'wall-screen-inner';
      const lines = Array.from({ length: 6 }, dataLine);
      inner.textContent = lines.join('\n');
      screen.appendChild(inner);
      bridgeLife.appendChild(screen);
      wallScreens.push({ node: inner, lines });
      lifeNodes.push({ node: screen, x: spot.x, y: spot.y, w: spot.w, h: spot.h });
    });
    positionBridgeLife();

    // Les écrans « reçoivent » une nouvelle ligne de données
    // régulièrement, chacun à son rythme.
    window.setInterval(() => {
      const target = pick(wallScreens);
      if (!target) return;
      target.lines.push(dataLine());
      while (target.lines.length > 6) target.lines.shift();
      target.node.textContent = target.lines.join('\n');
    }, 700);
  }

  // ─── DÉCOR (canvas espace, repris de l'écran MOTOMOTO) ──────────
  let panes = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    panes = rearCanvases.map((canvas, index) => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const starCount = Math.max(32, Math.floor((rect.width * rect.height) / 2800));
      const particleCount = Math.max(5, Math.floor(rect.width / 90));
      return {
        ctx,
        width: rect.width,
        height: rect.height,
        // Position du hublot à l'écran : permet de dessiner des objets
        // en coordonnées globales qui traversent les trois vitres.
        screenX: rect.left,
        screenY: rect.top,
        offset: index * 0.8 + Math.random() * 0.4,
        stars: Array.from({ length: starCount }, () => ({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          size: Math.random() > 0.82 ? 2.2 : Math.random() > 0.4 ? 1.6 : 1,
          alpha: 0.32 + Math.random() * 0.52,
          pulse: 1.6 + Math.random() * 3.8,
          phase: Math.random() * Math.PI * 2
        })),
        particles: Array.from({ length: particleCount }, () => ({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          vx: 0.08 + Math.random() * 0.16,
          vy: -0.06 + Math.random() * 0.12,
          size: 1 + Math.random() * 1.3,
          alpha: 0.08 + Math.random() * 0.12
        })),
        debris: [],
        nextDebrisAt: performance.now() + rand(1500, 6000)
      };
    });
  }

  function spawnDebris(pane, meteor = false) {
    const fast = meteor || Math.random() < 0.3;
    pane.debris.push({
      x: -14,
      y: Math.random() * pane.height * (meteor ? 0.7 : 1),
      vx: meteor ? rand(4, 7.5) : fast ? rand(1.6, 3.4) : rand(0.35, 1.1),
      vy: meteor ? rand(0.9, 2) : rand(-0.25, 0.25),
      size: fast ? rand(1.5, 3) : rand(2.5, 6.5),
      rot: Math.random() * Math.PI * 2,
      vrot: rand(-0.03, 0.03),
      alpha: meteor ? rand(0.5, 0.9) : rand(0.25, 0.6),
      sides: 3 + Math.floor(Math.random() * 3),
      meteor
    });
  }

  function drawDebris(pane, now, fxAlpha = 0) {
    if (now >= pane.nextDebrisAt) {
      spawnDebris(pane);
      // Parfois un petit essaim, sinon un débris isolé.
      if (Math.random() < 0.22) {
        spawnDebris(pane);
        spawnDebris(pane);
      }
      pane.nextDebrisAt = now + rand(2600, 9000);
    }

    // Scène « pluie de météores » : le champ s'intensifie brutalement.
    if (sceneFx.mode === 'meteors' && fxAlpha > 0.2) {
      if (!pane.nextMeteorAt || now >= pane.nextMeteorAt) {
        spawnDebris(pane, true);
        if (Math.random() < 0.35) spawnDebris(pane, true);
        pane.nextMeteorAt = now + rand(160, 520);
      }
    }

    // Scène « champ de débris » : plus dense que la normale, sans furie.
    if (sceneFx.mode === 'debris' && fxAlpha > 0.2) {
      if (!pane.nextMeteorAt || now >= pane.nextMeteorAt) {
        spawnDebris(pane);
        pane.nextMeteorAt = now + rand(500, 1300);
      }
    }

    const { ctx } = pane;
    for (let i = pane.debris.length - 1; i >= 0; i--) {
      const d = pane.debris[i];
      d.x += d.vx;
      d.y += d.vy;
      d.rot += d.vrot;
      if (d.x > pane.width + 20 || d.y < -20 || d.y > pane.height + 20) {
        pane.debris.splice(i, 1);
        continue;
      }
      // Traînée incandescente derrière les météores.
      if (d.meteor) {
        const tailX = d.x - d.vx * 7;
        const tailY = d.y - d.vy * 7;
        const grad = ctx.createLinearGradient(d.x, d.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 190, 120, ${d.alpha * 0.8})`);
        grad.addColorStop(1, 'rgba(255, 190, 120, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = d.size * 0.9;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.meteor ? 'rgba(235, 210, 170, 1)' : 'rgba(200, 205, 165, 1)';
      ctx.beginPath();
      for (let s = 0; s < d.sides; s++) {
        const angle = (s / d.sides) * Math.PI * 2;
        const radius = d.size * (0.7 + ((s * 37) % 10) / 22);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function respawnParticle(pane, index) {
    pane.particles[index] = {
      x: -8 - Math.random() * 18,
      y: Math.random() * pane.height,
      vx: 0.08 + Math.random() * 0.16,
      vy: -0.06 + Math.random() * 0.12,
      size: 1 + Math.random() * 1.3,
      alpha: 0.08 + Math.random() * 0.12
    };
  }

  // ─── SCÈNES RÉACTIVES DANS LES HUBLOTS ─────────────────────────
  // Chaque événement peut déclarer une `scene` : les hublots arrière
  // la jouent en direct (silhouette pirate, pluie de météores,
  // carcasse à la dérive, balise au loin...), avec fondu d'entrée
  // et de sortie. Même décor, dix fois plus de choses à regarder.
  const sceneFx = { mode: null, start: 0, fadeAt: 0, progress: 0 };

  const shipSilhouette = new Image();
  shipSilhouette.src = 'assets/vaisseau.png';

  function setSceneFx(mode) {
    if (!mode) { clearSceneFx(); return; }
    sceneFx.mode = mode;
    sceneFx.start = performance.now();
    sceneFx.fadeAt = 0;
  }

  function clearSceneFx() {
    if (sceneFx.mode && !sceneFx.fadeAt) sceneFx.fadeAt = performance.now();
  }

  function sceneAlpha(time) {
    if (!sceneFx.mode) return 0;
    let alpha = Math.min(1, (time - sceneFx.start) / 1600);
    if (sceneFx.fadeAt) {
      alpha *= Math.max(0, 1 - (time - sceneFx.fadeAt) / 2200);
      if (alpha <= 0) { sceneFx.mode = null; sceneFx.fadeAt = 0; return 0; }
    }
    return alpha;
  }

  // ─── LE CHAMP NOIR SE RAPPROCHE ────────────────────────────────
  // Croissance LINÉAIRE et continue : un point minuscule au début de
  // la partie, il grossit régulièrement jusqu'à devenir immense quand
  // il reste 30 s, puis achève d'avaler l'écran dans les 30 dernières
  // secondes (l'overlay ABSORPTION prend alors le relais).
  function blackHoleState() {
    if (!state.started) return null;
    const elapsed = Date.now() - state.startedAt;
    const big = Math.max(window.innerWidth, window.innerHeight);
    const immenseAt = Math.max(1000, DURATION_MS - 30000); // 30 s avant la fin
    const immenseR = big * 0.92;
    let r;
    if (elapsed <= immenseAt) {
      r = 3 + (elapsed / immenseAt) * immenseR; // montée régulière, continue
    } else {
      const p2 = Math.min(1, (elapsed - immenseAt) / 30000);
      r = immenseR + p2 * (big * 1.35 - immenseR);
    }
    // La lueur monte doucement sur les premières secondes.
    const visib = Math.min(1, elapsed / 8000 + 0.05);
    return { r, visib };
  }

  function drawBlackHole(pane, time, hole) {
    if (!hole || hole.r <= 3) return;
    const { ctx } = pane;
    const { r, visib } = hole;
    const gx = window.innerWidth * 0.5 - pane.screenX;
    const gy = window.innerHeight * 0.16 - pane.screenY;

    // Disque d'accrétion : halo orange qui respire lentement.
    const breathe = 1 + Math.sin(time * 0.0011) * 0.04;
    const glowR = r * 1.55 * breathe;
    const glow = ctx.createRadialGradient(gx, gy, Math.max(1, r * 0.9), gx, gy, glowR);
    glow.addColorStop(0, `rgba(255, 196, 120, ${0.5 * visib})`);
    glow.addColorStop(0.35, `rgba(250, 90, 31, ${0.22 * visib})`);
    glow.addColorStop(1, 'rgba(250, 90, 31, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, pane.width, pane.height);

    // Liseré incandescent au bord de l'horizon.
    ctx.save();
    ctx.strokeStyle = `rgba(255, 214, 150, ${0.75 * visib})`;
    ctx.lineWidth = Math.max(1.2, r * 0.015);
    ctx.shadowColor = 'rgba(255, 190, 110, 0.9)';
    ctx.shadowBlur = 10 + r * 0.04;
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Le cœur : un noir parfait qui avale les étoiles.
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSceneFx(pane, paneIndex, time, alpha) {
    const { ctx, width, height } = pane;
    const mode = sceneFx.mode;
    const t = (time - sceneFx.start) / 1000;

    // Silhouette du vaisseau (pirate ou carcasse) : positionnée en
    // coordonnées GLOBALES d'écran, puis dessinée dans chaque hublot —
    // elle traverse ainsi les trois vitres, pas seulement le centre.
    if ((mode === 'ship' || mode === 'hulk') && shipSilhouette.complete && shipSilhouette.naturalWidth) {
      const imgRatio = shipSilhouette.naturalHeight / shipSilhouette.naturalWidth;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      ctx.save();
      if (mode === 'ship') {
        // Un vaisseau qui glisse lentement près des hublots, de droite
        // à gauche, en traversant les trois vitres. Assez éclairé pour
        // qu'on reconnaisse un vaisseau, pas un rectangle sombre.
        const w = vw * 0.34;
        const h = w * imgRatio;
        const span = vw + w * 2;
        // +5 s d'avance pour qu'il soit déjà en vue à l'ouverture.
        const gx = vw + w - (((t + 5) * (vw / 22)) % span);
        const gy = vh * 0.11 + Math.sin(t * 0.4) * 7;
        const lx = gx - pane.screenX;
        const ly = gy - pane.screenY;
        ctx.globalAlpha = alpha;
        ctx.filter = 'brightness(0.72) contrast(1.08)';
        ctx.drawImage(shipSilhouette, lx, ly, w, h);
        ctx.filter = 'none';
        // Feu de position rouge qui clignote, à l'avant du vaisseau.
        const blink = Math.sin(t * 5) > 0 ? 1 : 0.2;
        ctx.globalAlpha = alpha * blink;
        ctx.fillStyle = '#ff3b26';
        ctx.shadowColor = '#ff3b26';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(lx + w * 0.12, ly + h * 0.52, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        // Carcasse : vaisseau mort, sombre, quasi immobile, qui tangue.
        const w = vw * 0.4;
        const h = w * imgRatio;
        const gx = vw * 0.34 + Math.sin(t * 0.18) * 5;
        const gy = vh * 0.12 + Math.cos(t * 0.14) * 6;
        const lx = gx - pane.screenX;
        const ly = gy - pane.screenY;
        ctx.globalAlpha = alpha * 0.9;
        ctx.filter = 'brightness(0.32) contrast(0.95)';
        ctx.translate(lx + w / 2, ly + h / 2);
        ctx.rotate(-0.1 + Math.sin(t * 0.1) * 0.02);
        ctx.drawImage(shipSilhouette, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    }

    // Balise en détresse : point orange qui pulse au loin.
    if (mode === 'beacon' && paneIndex === (sceneFx.beaconPane ?? 2)) {
      const bx = width * 0.62;
      const by = height * 0.38;
      const pulse = (Math.sin(t * 2.4) + 1) / 2;
      const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 26 + pulse * 18);
      glow.addColorStop(0, `rgba(250, 90, 31, ${alpha * (0.35 + pulse * 0.4)})`);
      glow.addColorStop(1, 'rgba(250, 90, 31, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(bx - 50, by - 50, 100, 100);
      ctx.globalAlpha = alpha * (0.5 + pulse * 0.5);
      ctx.fillStyle = '#ffcf9e';
      ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
      ctx.globalAlpha = 1;
    }

    // Station : silhouette anguleuse + enseigne qui grésille.
    if (mode === 'station' && paneIndex === 1) {
      const sx = width * 0.6 + Math.sin(t * 0.12) * 3;
      const sy = height * 0.3;
      const s = Math.min(width, height) / 90;
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = '#141210';
      ctx.strokeStyle = 'rgba(200,205,165,0.28)';
      ctx.lineWidth = 1;
      ctx.translate(sx, sy);
      ctx.rotate(0.08);
      ctx.fillRect(-9 * s, -3 * s, 18 * s, 6 * s);
      ctx.strokeRect(-9 * s, -3 * s, 18 * s, 6 * s);
      ctx.fillRect(-2 * s, -7 * s, 4 * s, 4 * s);
      ctx.strokeRect(-2 * s, -7 * s, 4 * s, 4 * s);
      ctx.beginPath();
      ctx.moveTo(0, -7 * s);
      ctx.lineTo(0, -11 * s);
      ctx.stroke();
      // L'enseigne : elle clignote mal, évidemment.
      const flicker = Math.random() < 0.86 ? 1 : 0.2;
      ctx.globalAlpha = alpha * 0.75 * flicker;
      ctx.fillStyle = '#fa5a1f';
      ctx.fillRect(-6 * s, -1.4 * s, 5 * s, 1.6 * s);
      ctx.restore();
    }

    // Contact : lueur verte irréelle + trois lumières en formation.
    if (mode === 'alien') {
      const glow = ctx.createRadialGradient(width * 0.5, height * 1.1, 0, width * 0.5, height * 1.1, height * 1.3);
      glow.addColorStop(0, `rgba(120, 255, 170, ${alpha * 0.13})`);
      glow.addColorStop(1, 'rgba(120, 255, 170, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      if (paneIndex === 1) {
        for (let i = 0; i < 3; i++) {
          const angle = t * 0.5 + (i / 3) * Math.PI * 2;
          const lx = width * 0.5 + Math.cos(angle) * width * 0.18;
          const ly = height * 0.42 + Math.sin(angle * 1.4) * height * 0.14;
          ctx.globalAlpha = alpha * (0.5 + Math.sin(t * 3 + i) * 0.3);
          ctx.fillStyle = '#9dffd0';
          ctx.fillRect(lx - 1.5, ly - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawSpace(time) {
    const fxAlpha = sceneAlpha(time);
    const hole = blackHoleState();
    panes.forEach((pane, paneIndex) => {
      const { ctx, width, height, stars, particles, offset } = pane;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#020201';
      ctx.fillRect(0, 0, width, height);

      const haze = ctx.createRadialGradient(width * 0.56, height * 0.52, 0, width * 0.56, height * 0.52, Math.max(width, height) * 0.78);
      haze.addColorStop(0, 'rgba(247,255,195,0.02)');
      haze.addColorStop(0.55, 'rgba(250,90,31,0.015)');
      haze.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);

      stars.forEach(star => {
        const twinkle = 0.82 + Math.sin(time * 0.001 * star.pulse + star.phase + offset) * 0.18;
        ctx.globalAlpha = Math.min(1, star.alpha * twinkle);
        ctx.fillStyle = 'rgba(247,255,195,1)';
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });
      ctx.globalAlpha = 1;

      drawBlackHole(pane, time, hole);

      if (fxAlpha > 0) drawSceneFx(pane, paneIndex, time, fxAlpha);

      drawDebris(pane, time, fxAlpha);

      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        const tailX = particle.x - particle.vx * 20;
        const tailY = particle.y - particle.vy * 20;
        const grad = ctx.createLinearGradient(particle.x, particle.y, tailX, tailY);
        grad.addColorStop(0, `rgba(247,255,195,${particle.alpha})`);
        grad.addColorStop(1, 'rgba(247,255,195,0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = particle.size;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.globalAlpha = particle.alpha;
        ctx.fillStyle = 'rgba(247,255,195,1)';
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        if (particle.x > width + 30 || particle.y < -30 || particle.y > height + 30) {
          respawnParticle(pane, index);
        }
      });

      ctx.globalAlpha = 1;
    });
  }

  // ─── TIMER + BOUCLE PRINCIPALE ─────────────────────────────────
  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function updateTimer() {
    if (!state.started || state.over) return;
    const remaining = Math.max(0, DURATION_MS - (Date.now() - state.startedAt));
    if (timerValue) timerValue.textContent = formatTime(remaining);
    if (consoleFootnote) consoleFootnote.textContent = `PRIORITE // TENIR ${formatTime(remaining)}`;
    updateDistance(remaining);
  }

  // La coque encaissée dévie la trajectoire (le drift se résorbe
  // peu à peu, comme une correction de cap) : la distance affichée
  // n'est donc jamais une simple ligne droite vers zéro.
  function updateDistance(remaining) {
    if (!consoleDistance) return;
    state.distanceDrift *= 0.992;
    const progress = 1 - remaining / DURATION_MS;
    const base = state.distanceStart * (1 - progress) + state.distanceDrift;
    const wobble = Math.sin(Date.now() / 1400) * Math.min(3, base * 0.004);
    const ua = Math.max(0, Math.round(base + wobble));
    consoleDistance.textContent = `${ua.toLocaleString('fr-FR')} UA`;
    consoleDistance.classList.toggle('warning', state.distanceDrift > 40);
  }

  function updateDecisionTimer(now) {
    if (!state.activeEvent) return;
    const remaining = Math.max(0, state.decideDeadline - now);
    if (eventCountdown) eventCountdown.textContent = String(Math.ceil(remaining / 1000));
    if (eventTimerFill) eventTimerFill.style.transform = `scaleX(${remaining / state.decideTotal})`;
    if (remaining <= 0) resolveEvent(-1);
  }

  // La logique tourne sur un interval (fiable même en onglet inactif) ;
  // le rendu des canvas reste sur requestAnimationFrame.
  function logicTick() {
    if (!state.started || state.over) return;
    const now = Date.now();
    updateTimer();
    updateDecisionTimer(now);
    evaTick(now);
    minigameTick(now);
    alienTick(now);
    if (!state.activeEvent && !eva.active && !mg.active && !state.alienActive && !tribunal.active && now >= state.nextEventAt) {
      if (!maybeStartAlienEncounter()) {
        const evt = eventQueue.shift();
        if (evt) {
          startEvent(evt);
        } else {
          state.nextEventAt = now + 60000;
        }
      }
    }
    if (!state.alienActive && !tribunal.active) {
      idleTick(now);
      sabotageTick(now);
    }
    checkVictory();
  }

  function frame(time) {
    drawSpace(time);
    requestAnimationFrame(frame);
  }

  // ─── SETTINGS (repris de l'écran MOTOMOTO) ─────────────────────
  function isSettingsOpen() {
    return !!(settingsOverlay && settingsOverlay.classList.contains('open'));
  }

  function openSettings() {
    if (!settingsOverlay) return;
    settingsOverlay.classList.add('open');
    syncPixelDitherButtons(settingsOverlay);
    window.setTimeout(() => {
      const panel = settingsOverlay.querySelector('.settings-panel');
      if (panel) panel.classList.add('visible');
    }, 10);
  }

  function closeSettings() {
    if (!settingsOverlay) return;
    const panel = settingsOverlay.querySelector('.settings-panel');
    if (panel) panel.classList.remove('visible');
    window.setTimeout(() => settingsOverlay.classList.remove('open'), 320);
  }

  function updateSlider(input, valueId) {
    const value = Math.max(0, Math.min(100, Number(input.value) || 0));
    const targetId = valueId || input.dataset.valueId;
    input.value = value;
    if (targetId) {
      const target = document.getElementById(targetId);
      if (target) target.textContent = `${value}%`;
    }
    const setting = input.dataset.audioSetting;
    if (!setting) return;
    try { localStorage.setItem(`areciboAudioVolume:${setting}`, String(value)); } catch (err) {}
    window.dispatchEvent(new CustomEvent('arecibo-audio-settings-change', { detail: { setting, value } }));
  }

  function syncPixelDitherButtons(root = document) {
    const current = typeof window.getAreciboPixelDither === 'function'
      ? window.getAreciboPixelDither()
      : 'strong';
    root.querySelectorAll('[data-pixel-dither-group] .pixel-btn').forEach(btn => {
      btn.classList.toggle('sel', btn.dataset.pixelDither === current);
    });
  }

  function selectPixelDither(button, mode) {
    const row = button ? button.closest('[data-pixel-dither-group]') : null;
    if (row) row.querySelectorAll('.pixel-btn').forEach(node => node.classList.remove('sel'));
    if (button) button.classList.add('sel');
    if (typeof window.setAreciboPixelDither === 'function') window.setAreciboPixelDither(mode);
  }

  function hydrateSettingsPanel() {
    if (!settingsOverlay) return;
    settingsOverlay.querySelectorAll('input[data-audio-setting]').forEach(input => {
      const fallback = Number(input.dataset.default) || Number(input.value) || 0;
      const value = readVolume(input.dataset.audioSetting, fallback);
      input.value = value;
      const target = document.getElementById(input.dataset.valueId || '');
      if (target) target.textContent = `${value}%`;
    });
    syncPixelDitherButtons(settingsOverlay);
  }

  // ─── DÉMARRAGE ─────────────────────────────────────────────────
  const CAPTAIN_PICTO = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="12,2 14.6,9.2 22.2,9.2 16.3,13.8 18.5,21 12,16.4 5.5,21 7.7,13.8 1.8,9.2 9.4,9.2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/>
  </svg>`;

  let playerName = 'CAPITAINE';

  function applyPlayerProfile() {
    const api = window.AreciboPlayerProfile;
    if (!api) return;
    const profile = api.loadPlayerProfile();
    playerName = profile.name;
    const frame = document.querySelector('.role-card-portrait-frame');
    if (frame) {
      api.renderHeadSvg(profile, { className: 'role-card-portrait role-card-portrait-player', label: profile.name })
        .then(svg => { frame.innerHTML = svg; })
        .catch(() => {});
    }
    const metaValues = document.querySelectorAll('.role-card-meta-value');
    if (metaValues[2]) metaValues[2].textContent = `AR-01-CPT // ${profile.name}`;
  }

  function startGame() {
    if (state.started) return;
    state.started = true;
    state.startedAt = Date.now();
    state.nextEventAt = state.startedAt + 7000;
    state.nextIdleAt = state.startedAt + 3500;
    buildQueue();
    if (typeof window.playAreciboStartSound === 'function') window.playAreciboStartSound();

    pushMessage('system', `LIAISON COMMS ÉTABLIE // COMMANDANT ${playerName} SUR LE PONT`);
    npcSay('vega', 'Timonier en poste. Cap sur ARECIBO, huit minutes de route si tout va bien. Rien ne va jamais bien.', 1600);
    npcSay('kessel', 'Pont sécurisé, capitaine. Enfin, « sécurisé »... les boulons tiennent.', 4200);
    npcSay('tilt', 'Soute paré. Si quelqu’un entend gratter, c’est PAS moi.', 7200);
  }

  function bindUi() {
    if (roleDismiss) {
      roleDismiss.addEventListener('click', () => {
        playClick();
        if (roleOverlay) roleOverlay.classList.remove('is-visible');
        startGame();
      });
    }
    if (evaReturnBtn) evaReturnBtn.addEventListener('click', () => { playClick(); finishEva(false); });
    if (evaOverlay) {
      evaOverlay.addEventListener('mousemove', event => {
        if (!evaFlashlight) return;
        evaFlashlight.style.setProperty('--torch-x', `${event.clientX}px`);
        evaFlashlight.style.setProperty('--torch-y', `${event.clientY}px`);
      });
    }
    if (doorHotspotLeft) doorHotspotLeft.addEventListener('click', () => { playClick(); openRoom('left'); });
    if (doorHotspotRight) doorHotspotRight.addEventListener('click', () => { playClick(); openRoom('right'); });
    const souteHotspot = $('souteHotspot');
    if (souteHotspot) souteHotspot.addEventListener('click', () => { playClick(); openRoom('soute'); });
    if (roomViewClose) roomViewClose.addEventListener('click', () => { playClick(); closeRoom(); });
    const commsForm = $('commsForm');
    const commsField = $('commsField');
    if (commsForm && commsField) {
      commsForm.addEventListener('submit', event => {
        event.preventDefault();
        const text = commsField.value.trim();
        if (!text) return;
        pushMessage('player', text);
        commsField.value = '';
      });
    }

    if (memberScanBtn) memberScanBtn.addEventListener('click', () => { playClick(); runScan(); });
    if (memberEjectBtn) memberEjectBtn.addEventListener('click', () => { playClick(); runEject(); });
    if (memberCloseBtn) memberCloseBtn.addEventListener('click', () => { playClick(); closeMemberModal(); });
    if (memberModalBackdrop) memberModalBackdrop.addEventListener('click', closeMemberModal);
    if (replayBtn) replayBtn.addEventListener('click', () => window.location.reload());
    if (settingsTab) settingsTab.addEventListener('click', () => (isSettingsOpen() ? closeSettings() : openSettings()));

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        if (document.activeElement === commsField) {
          commsField.blur();
          return;
        }
        event.preventDefault();
        if (roomOpen) {
          closeRoom();
          return;
        }
        if (memberModal && memberModal.classList.contains('is-visible')) {
          closeMemberModal();
          return;
        }
        if (roleOverlay && roleOverlay.classList.contains('is-visible')) {
          roleOverlay.classList.remove('is-visible');
          startGame();
          return;
        }
        isSettingsOpen() ? closeSettings() : openSettings();
      }
    });

    window.addEventListener('mousemove', event => {
      if (!cursor) return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
  }

  function init() {
    if (activeRolePicto) activeRolePicto.innerHTML = CAPTAIN_PICTO;
    applyPlayerProfile();
    document.documentElement.style.setProperty('--role-accent', '#fa7a2c');
    document.documentElement.style.setProperty('--role-accent-soft', 'rgba(250,122,44,0.18)');
    document.documentElement.style.setProperty('--role-accent-glow', 'rgba(250,122,44,0.42)');
    updateConsole();
    updateDistance(DURATION_MS);
    renderCrew();
    hydrateSettingsPanel();
    resize();
    buildBridgeLife();
    bindUi();
    window.setInterval(logicTick, 250);
    requestAnimationFrame(frame);
  }

  // Outils de test : actifs uniquement avec ?debug=1 dans l'URL.
  if (params.get('debug') === '1') {
    window.__areciboDemo = {
      startEventById(id) {
        const evt = EVENTS.find(e => e.id === id);
        if (evt && !state.activeEvent) startEvent(evt);
      },
      state,
      grep: grepMinigame,
      wires: wiresMinigame,
      startAlien() { if (!state.alienActive && !state.activeEvent) startAlienEncounter(); },
      startTribunal() { state.trust = 15; state.trustReprieveArmed = true; startNoConfidenceVote(); },
      scene: setSceneFx,
      clearScene: clearSceneFx
    };
  }

  window.openGameSettings = openSettings;
  window.closeGameSettings = closeSettings;
  window.updateGameSlider = updateSlider;
  window.selectGamePixelDither = selectPixelDither;
  window.selectGameLang = () => {};
  window.toggleGameSwitch = node => node && node.classList.toggle('on');

  window.addEventListener('resize', () => { resize(); drawRoomSpace(); positionBridgeLife(); if (eva.active) drawEvaStars(); });
  window.addEventListener('arecibo-pixel-dither-change', () => syncPixelDitherButtons(settingsOverlay || document));
  init();
})();
