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
    hull: 69,
    fuel: 47,
    signal: 58,
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
    innocentsEjected: 0
  };

  const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

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
      img: 'assets/debris-scene/exterieur.png',
      title: 'Quelque chose a accroché la coque',
      text: 'Un choc sourd côté tribord. La moitié des capteurs du pont ne répondent plus.',
      decide: 34,
      msgs: [
        { npc: 'kessel', d: 1800, t: 'Coque à {hull}. Un panneau tribord est plié, ça siffle quelque part.', lie: 'Coque nickel, aucun dégât. Le choc venait de l’intérieur, un outil qui traînait.' },
        { npc: 'vega', d: 5200, t: 'Champ de débris droit devant. Contact dans 40 secondes si on garde ce cap.', lie: 'Route parfaitement dégagée devant nous. Aucun contact sur les scopes.' },
        { npc: 'tilt', d: 9000, t: 'Réserves à {fuel}. Si tu pousses les moteurs, on va le sentir passer.', lie: 'Les réserves débordent, cap’taine. Pousse les moteurs, aucun souci.' }
      ],
      options: [
        { label: 'Pousser les moteurs', hint: 'esquive rapide — coûte du carburant', fx: { fuel: -10 }, out: 'Les moteurs hurlent. Le champ de débris glisse sur bâbord et la chose accrochée se détache dans le sillage.' },
        { label: 'Couper les moteurs', hint: 'dérive silencieuse — risqué', fx: { hull: -8, signal: -4 }, out: 'Le MOTOMOTO dérive. Deux impacts sourds. Quelque chose raye la coque sur toute sa longueur.' },
        { label: 'Envoyer Kessel décrocher la chose', hint: 'sortie en sas', fx: { hull: 4 }, exposes: 'kessel', out: 'KESSEL sort par le sas tribord. Trois longues minutes de silence radio. Il revient avec l’objet : une plaque gravée « ARECIBO ».' }
      ],
      timeout: { fx: { hull: -10 }, out: 'Personne n’a tranché. La chose a fini par percer un caisson avant de se détacher toute seule.' }
    },
    {
      id: 'station',
      kicker: 'OPPORTUNITÉ',
      title: 'Station-service orbitale abandonnée',
      text: 'Une vieille station de ravitaillement dérive à portée. Enseigne à moitié morte : « DERNIER PLEIN AVANT LE VIDE ».',
      decide: 34,
      msgs: [
        { npc: 'tilt', d: 2000, t: 'Réserves à {fuel}. Franchement, je dirais pas non à un plein.', lie: 'On est large en carburant, pas la peine de s’arrêter dans ce piège à rats.' },
        { npc: 'vega', d: 6000, t: 'L’accostage est faisable, mais la station tourne sur elle-même. Faudra sortir à la main.', lie: 'Accostage impossible, la station tourne bien trop vite. Passe au large.' },
        { npc: 'kessel', d: 10000, t: 'Le sas tribord est opérationnel. Je peux y aller. J’ai un bon pressentiment.', lie: 'Les sas sont grippés, personne ne sort. Tant pis pour le plein.' }
      ],
      options: [
        { label: 'Accoster et envoyer Tilt', hint: 'plein complet — sortie en sas', fx: { fuel: 24 }, exposes: 'tilt', out: 'TILT revient en roulant deux bidons devant lui. Il fredonne un truc que personne ne connaît.' },
        { label: 'Siphonner à distance', hint: 'plus sûr, moins efficace', fx: { fuel: 9, signal: -5 }, out: 'Le bras télescopique racle le réservoir de la station. Quelques litres, et un paquet d’interférences.' },
        { label: 'Passer au large', hint: 'aucun risque, aucun gain', fx: {}, out: 'La station disparaît derrière vous. Sur l’enseigne, une lumière s’éteint pour de bon.' }
      ],
      timeout: { fx: {}, out: 'Le temps de se décider, la station est déjà loin derrière.' }
    },
    {
      id: 'meteores',
      kicker: 'LE JEU A TIRÉ UNE CARTE',
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
        { label: 'Envoyer Kessel fouiller', hint: 'butin possible — sortie en sas', fx: { fuel: 12 }, exposes: 'kessel', out: 'KESSEL revient avec une cellule de carburant... et une combinaison qui n’est pas la sienne. « Elle était pliée. Sur une couchette. Encore tiède. »' },
        { label: 'Passer dessous', hint: 'direct — la coque frotte', fx: { hull: -7 }, out: 'Le ventre du MOTOMOTO embrasse la carcasse dans un crissement à réveiller les morts. Mais ça passe.' },
        { label: 'Contourner', hint: 'sûr — coûte du carburant', fx: { fuel: -9 }, out: 'Vous contournez le géant mort. Par les baies éventrées, personne ne regarde passer votre vaisseau. Probablement.' }
      ],
      timeout: { fx: { hull: -6, fuel: -4 }, out: 'Indécision. Le pilote automatique choisit un compromis qui ne satisfait personne, comme tous les compromis.' }
    },
    {
      id: 'balise',
      kicker: 'NAVIGATION',
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
        { label: 'Réparation propre', hint: 'fiable — pompe sur le signal', fx: { signal: -9, hull: 3 }, out: 'KESSEL ressoude la carte mère au milligramme près. Le recycleur ronronne à nouveau comme un chat content.' },
        { label: 'Bricolage de soute', hint: 'gratuit — aléatoire', fx: { hull: -4 }, out: 'TILT enroule trois colliers de serrage et frappe deux fois. Ça marche. Personne ne demande pourquoi.' },
        { label: 'Ne rien faire', hint: 'espérer que ça tienne', fx: { hull: -8 }, out: 'Le recycleur tient... puis crache une pièce qui ricoche dans les conduits et perce un joint. Évidemment.' }
      ],
      timeout: { fx: { hull: -8 }, out: 'À force d’attendre, le recycleur a choisi tout seul : il a lâché un morceau.' }
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
      'Rappel amical : le dernier qui prend un biscuit sans le noter aura affaire à moi.'
    ]
  };

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
      img: 'assets/sas-2.png',
      caption: 'SAS TRIBORD // ZONE D’EXPOSITION',
      enter: 'Le sas tribord. La porte extérieure n’est qu’à quelques centimètres du vide.',
      flavor: [
        { npc: 'kessel', text: 'Capitaine sur le pont du sas ? Vérifie les joints tant que tu y es, j’ai un doute sur le troisième.' },
        { npc: 'vega', text: 'Je vois ta signature thermique dans le sas. Referme bien derrière toi. S’il te plaît.' }
      ],
      infectedHint: 'Une odeur, dans le sas. Douce. Organique. Personne n’en a parlé dans les comms.'
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
    setDoors(true, side);
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
      if (side === 'right' && state.infectedId && room.infectedHint) {
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

  function startEvent(evt) {
    if (state.over) return;
    state.activeEvent = evt;
    state.decideTotal = evt.decide * 1000;
    state.decideDeadline = Date.now() + state.decideTotal;

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
        btn.innerHTML = `<span class="event-option-label">${opt.label}</span><span class="event-option-hint">${opt.hint}</span>`;
        btn.addEventListener('click', () => {
          playClick();
          resolveEvent(index);
        });
        eventOptions.appendChild(btn);
      });
    }
    if (eventPanel) eventPanel.classList.add('is-visible');

    // Les infos partielles arrivent en décalé, comme sur un vrai vocal.
    evt.msgs.forEach(msg => {
      window.setTimeout(() => {
        if (state.activeEvent !== evt || state.over) return;
        const text = isLiar(msg.npc) && msg.lie ? msg.lie : msg.t;
        if (!state.ejected[msg.npc]) pushMessage(msg.npc, text);
      }, msg.d);
    });
  }

  function resolveEvent(optionIndex) {
    const evt = state.activeEvent;
    if (!evt || state.over) return;
    state.activeEvent = null;
    state.eventsResolved += 1;
    if (eventPanel) eventPanel.classList.remove('is-visible');

    let fx, out;
    if (optionIndex === -1) {
      fx = evt.timeout.fx; out = evt.timeout.out;
      pushMessage('system', 'AUCUNE DÉCISION // PROTOCOLE PAR DÉFAUT');
    } else {
      const opt = evt.options[optionIndex];
      fx = opt.fx; out = opt.out;
      if (opt.exposes && !state.ejected[opt.exposes]) handleExposure(opt.exposes);
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
    }

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
    if (crewScans) crewScans.textContent = `SCANS MÉDICAUX : ${state.scansLeft}`;
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
      if (crewScans) crewScans.textContent = `SCANS MÉDICAUX : ${state.scansLeft}`;
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
        }))
      };
    });
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

  function drawSpace(time) {
    panes.forEach(pane => {
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
  }

  function updateDecisionTimer(now) {
    if (!state.activeEvent) return;
    const remaining = Math.max(0, state.decideDeadline - now);
    if (eventCountdown) eventCountdown.textContent = String(Math.ceil(remaining / 1000));
    if (eventTimerFill) eventTimerFill.style.transform = `scaleX(${remaining / state.decideTotal})`;
    if (remaining <= 0) resolveEvent(-1);
  }

  function frame(time) {
    drawSpace(time);
    if (state.started && !state.over) {
      const now = Date.now();
      updateTimer();
      updateDecisionTimer(now);
      if (!state.activeEvent && now >= state.nextEventAt) {
        const evt = eventQueue.shift();
        if (evt) {
          startEvent(evt);
        } else {
          state.nextEventAt = now + 60000;
        }
      }
      idleTick(now);
      sabotageTick(now);
      checkVictory();
    }
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
    if (doorHotspotLeft) doorHotspotLeft.addEventListener('click', () => { playClick(); openRoom('left'); });
    if (doorHotspotRight) doorHotspotRight.addEventListener('click', () => { playClick(); openRoom('right'); });
    if (roomViewClose) roomViewClose.addEventListener('click', () => { playClick(); closeRoom(); });
    if (memberScanBtn) memberScanBtn.addEventListener('click', () => { playClick(); runScan(); });
    if (memberEjectBtn) memberEjectBtn.addEventListener('click', () => { playClick(); runEject(); });
    if (memberCloseBtn) memberCloseBtn.addEventListener('click', () => { playClick(); closeMemberModal(); });
    if (memberModalBackdrop) memberModalBackdrop.addEventListener('click', closeMemberModal);
    if (replayBtn) replayBtn.addEventListener('click', () => window.location.reload());
    if (settingsTab) settingsTab.addEventListener('click', () => (isSettingsOpen() ? closeSettings() : openSettings()));

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
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
    renderCrew();
    hydrateSettingsPanel();
    resize();
    bindUi();
    requestAnimationFrame(frame);
  }

  window.openGameSettings = openSettings;
  window.closeGameSettings = closeSettings;
  window.updateGameSlider = updateSlider;
  window.selectGamePixelDither = selectPixelDither;
  window.selectGameLang = () => {};
  window.toggleGameSwitch = node => node && node.classList.toggle('on');

  window.addEventListener('resize', () => { resize(); drawRoomSpace(); });
  window.addEventListener('arecibo-pixel-dither-change', () => syncPixelDitherButtons(settingsOverlay || document));
  init();
})();
