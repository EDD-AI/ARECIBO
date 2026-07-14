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
    innocentsEjected: 0
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
        { label: 'Envoyer Kessel fouiller', hint: 'butin possible — vous incarnerez Kessel', fx: { fuel: 12 }, exposes: 'kessel', out: 'KESSEL revient avec une cellule de carburant... et une combinaison qui n’est pas la sienne. « Elle était pliée. Sur une couchette. Encore tiède. »', eva: { object: 'LA SOUTE ÉVENTRÉE', find: 'Une cellule de carburant intacte. Et une combinaison pliée sur une couchette. Vous la touchez : encore tiède.' } },
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

  const MINIGAMES = { grep: grepMinigame, wires: wiresMinigame };

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

  function buildEvaObjects(evaData) {
    if (!evaObjects) return;
    evaObjects.innerHTML = '';

    const defs = [
      {
        main: true, label: evaData.object, find: evaData.find,
        left: '58%', top: '30%', dur: '8s'
      },
      {
        img: 'assets/debris-scene/bouteille-oxygene.png', label: 'BOUTEILLE DÉRIVANTE',
        find: 'Une bouteille d’oxygène cabossée. Le manomètre indique encore un tiers. Vous la sanglez à votre harnais. [O2 +8s]',
        bonusO2: 8000, left: '26%', top: '48%', dur: '6.4s'
      },
      {
        img: 'assets/debris-loot/pince-coupante.png', label: 'OUTIL PERDU',
        find: 'Une pince coupante, gravée d’initiales inconnues. Quelqu’un, quelque part, a lâché prise.',
        left: '74%', top: '62%', dur: '7.2s'
      }
    ];

    defs.forEach(def => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eva-object';
      btn.style.left = def.left;
      btn.style.top = def.top;
      btn.style.setProperty('--float-dur', def.dur);
      btn.innerHTML = def.main
        ? `<span class="eva-object-core"></span><span class="eva-object-label">${def.label}</span>`
        : `<img src="${def.img}" alt=""><span class="eva-object-label">${def.label}</span>`;
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
    eva.onDone = null;
    if (evaOverlay) {
      evaOverlay.classList.remove('is-visible');
      evaOverlay.setAttribute('aria-hidden', 'true');
    }
    setDoors(false);
    playSfx('off', 0.7);
    if (timedOut) pushMessage('system', `RÉSERVE O2 ÉPUISÉE // RETOUR FORCÉ DE ${NPCS[eva.npc].name}`);
    if (done) done(infect);
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
        const text = pickText(isLiar(msg.npc) && msg.lie ? msg.lie : msg.t);
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
    if (eva.active) {
      eva.active = false;
      eva.onDone = null;
      if (evaOverlay) evaOverlay.classList.remove('is-visible');
    }
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

  const WALL_SCREEN_SPOTS = [
    { x: 27, y: 45, amber: false },
    { x: 66.5, y: 45, amber: true },
    { x: 27.5, y: 63, amber: true },
    { x: 66.5, y: 63, amber: false }
  ];

  const DATA_WORDS = ['NAV', 'O2', 'PWR', 'SYS', 'CRG', 'SIG', 'ENV', 'THR', 'LNK', 'BAK'];

  function dataLine() {
    const w = pick(DATA_WORDS);
    const n = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    const flag = Math.random() < 0.08 ? ' !!' : Math.random() < 0.3 ? ' OK' : '';
    return `${w}.${n} ${grepChunk(4)}${flag}`;
  }

  function buildBridgeLife() {
    if (!bridgeLife) return;
    LED_SPOTS.forEach(spot => {
      const led = document.createElement('span');
      led.className = 'bridge-led';
      led.style.left = `${spot.x}%`;
      led.style.top = `${spot.y}%`;
      led.style.setProperty('--led-color', spot.c);
      led.style.setProperty('--led-dur', `${(1.6 + Math.random() * 3.2).toFixed(2)}s`);
      led.style.setProperty('--led-delay', `${(Math.random() * 3).toFixed(2)}s`);
      bridgeLife.appendChild(led);
    });

    WALL_SCREEN_SPOTS.forEach(spot => {
      const screen = document.createElement('div');
      screen.className = 'wall-screen' + (spot.amber ? ' is-amber' : '');
      screen.style.left = `${spot.x}%`;
      screen.style.top = `${spot.y}%`;
      const inner = document.createElement('span');
      inner.className = 'wall-screen-inner';
      const lines = Array.from({ length: 6 }, dataLine);
      inner.textContent = lines.join('\n');
      screen.appendChild(inner);
      bridgeLife.appendChild(screen);
      wallScreens.push({ node: inner, lines });
    });

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

  function spawnDebris(pane) {
    const fast = Math.random() < 0.3;
    pane.debris.push({
      x: -14,
      y: Math.random() * pane.height,
      vx: fast ? rand(1.6, 3.4) : rand(0.35, 1.1),
      vy: rand(-0.25, 0.25),
      size: fast ? rand(1.5, 3) : rand(2.5, 6.5),
      rot: Math.random() * Math.PI * 2,
      vrot: rand(-0.03, 0.03),
      alpha: rand(0.25, 0.6),
      sides: 3 + Math.floor(Math.random() * 3)
    });
  }

  function drawDebris(pane, now) {
    if (now >= pane.nextDebrisAt) {
      spawnDebris(pane);
      // Parfois un petit essaim, sinon un débris isolé.
      if (Math.random() < 0.22) {
        spawnDebris(pane);
        spawnDebris(pane);
      }
      pane.nextDebrisAt = now + rand(2600, 9000);
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
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = 'rgba(200, 205, 165, 1)';
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

      drawDebris(pane, time);

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

  // La logique tourne sur un interval (fiable même en onglet inactif) ;
  // le rendu des canvas reste sur requestAnimationFrame.
  function logicTick() {
    if (!state.started || state.over) return;
    const now = Date.now();
    updateTimer();
    updateDecisionTimer(now);
    evaTick(now);
    minigameTick(now);
    if (!state.activeEvent && !eva.active && !mg.active && now >= state.nextEventAt) {
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
      wires: wiresMinigame
    };
  }

  window.openGameSettings = openSettings;
  window.closeGameSettings = closeSettings;
  window.updateGameSlider = updateSlider;
  window.selectGamePixelDither = selectPixelDither;
  window.selectGameLang = () => {};
  window.toggleGameSwitch = node => node && node.classList.toggle('on');

  window.addEventListener('resize', () => { resize(); drawRoomSpace(); if (eva.active) drawEvaStars(); });
  window.addEventListener('arecibo-pixel-dither-change', () => syncPixelDitherButtons(settingsOverlay || document));
  init();
})();
