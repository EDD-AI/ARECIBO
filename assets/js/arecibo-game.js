const cursor = document.getElementById('cursor');
const remotePresenceLayer = document.getElementById('remote-presence-layer');
let cursorNameLabel = null;
let pointerX = window.innerWidth * 0.5;
let pointerY = window.innerHeight * 0.5;
document.addEventListener('mousemove', event => {
  pointerX = event.clientX;
  pointerY = event.clientY;
  cursor.style.left = event.clientX + 'px';
  cursor.style.top = event.clientY + 'px';
  queuePresenceBroadcast();
});

function ensureLocalCursorLabel() {
  if (!cursor) return null;
  if (cursorNameLabel && cursor.contains(cursorNameLabel)) return cursorNameLabel;
  cursorNameLabel = document.createElement('div');
  cursorNameLabel.className = 'cursor-name';
  cursor.appendChild(cursorNameLabel);
  return cursorNameLabel;
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => document.getElementById('transition').classList.add('out'), 80);
});

const params = new URLSearchParams(window.location.search);
const STORY_PHASE_KEY = 'areciboStoryPhase';
const OPENING_MAIL_OPENED_KEY = 'areciboOpeningMailAutoOpened';
const PERSONAL_INVENTORY_KEY = 'areciboPersonalInventory';
const SESSION_INVENTORY_SYNC_KEY = 'arecibo:session-inventory-sync';
const requestedStoryPhase = params.get('storyPhase') || params.get('questStage');
let storyPhase = requestedStoryPhase || localStorage.getItem(STORY_PHASE_KEY) || 'opening-briefing';
function sanitizeSessionCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
}
function getRememberedSession() {
  try {
    return JSON.parse(localStorage.getItem('areciboMultiplayerSession') || 'null');
  } catch (err) {
    return null;
  }
}
const rememberedSession = getRememberedSession();
const sessionCode = sanitizeSessionCode(params.get('session') || (rememberedSession && rememberedSession.code) || '');
const storedPlayers = Number(localStorage.getItem('areciboPlayerCount'));
const requestedPlayers = Number(params.get('players'));
const playerCount = Math.max(1, Math.min(6, requestedPlayers || storedPlayers || 1));
const defaultExpeditionMinutes = storyPhase.startsWith('opening-') ? 8 : 5;
const expeditionDurationMinutes = Math.max(5, Math.min(15, Number(params.get('expeditionMinutes')) || defaultExpeditionMinutes));
const expeditionDurationMs = expeditionDurationMinutes * 60 * 1000;
const readyState = Array.from({ length: 6 }, (_, index) => index >= playerCount);
if (playerCount === 1) readyState[0] = true;
const crewEl = document.getElementById('crew-ready');
const launchBtn = document.getElementById('launch-btn');
const launchLabel = launchBtn.querySelector('.launch-label');
const launchIcon = launchBtn.querySelector('.launch-icon');
const airlockTimer = document.querySelector('.airlock-timer');
const distanceValue = document.getElementById('distance-value');
const roomCurrent = document.getElementById('room-current');
const roomState = document.getElementById('room-state');
const mapMessage = document.getElementById('map-message');
const personalWindow = document.getElementById('personal-window');
const personalTitle = personalWindow ? personalWindow.querySelector('.personal-title') : null;
const personalWindowHomeParent = personalWindow ? personalWindow.parentNode : null;
const personalWindowHomeNextSibling = personalWindow ? personalWindow.nextSibling : null;
const personalInventory = document.getElementById('personal-inventory');
const messageIndicator = personalWindow ? personalWindow.querySelector('.message-indicator') : null;
const messageCount = messageIndicator ? messageIndicator.querySelector('.message-count') : null;
const messagesTitle = document.getElementById('messages-title');
const messagesBody = document.getElementById('messages-body');
const shipScene = document.getElementById('ship-scene');
const sceneBackdrop = document.querySelector('.scene-backdrop');
const hullStatus = document.getElementById('hull-status');
const engineStatus = document.getElementById('engine-status');
const personalHudDock = document.querySelector('.personal-hud-dock');
const bridgeMeta = document.querySelector('.bridge-meta');
const pageTransition = document.getElementById('transition');
const landingSequence = document.getElementById('landing-sequence');
const landingCanvas = document.getElementById('landing-canvas');
const landingDecision = document.getElementById('landing-decision');
const landingDecisionOptions = document.getElementById('landing-decision-options');
const landingDecisionModule = document.getElementById('landing-decision-module');
const landingConsoleScroll = document.getElementById('landing-console-scroll');
const landingConsoleUp = document.getElementById('landing-console-up');
const landingConsoleDown = document.getElementById('landing-console-down');
const landingAlertText = document.getElementById('landing-alert-text');
const landingAlertCursor = document.getElementById('landing-alert-cursor');
const landingHeadText = document.getElementById('landing-head-text');
const landingHeadCursor = document.getElementById('landing-head-cursor');
const debrisStarCanvas = document.getElementById('debris-star-canvas');
const debrisParticleCanvas = document.getElementById('debris-particle-canvas');
const debrisScene = document.getElementById('debris-scene');
const expeditionTimerHud = document.getElementById('expedition-timer-hud');
const expeditionTimerValue = document.getElementById('expedition-timer-value');
const expeditionResultOverlay = document.getElementById('expedition-result-overlay');
const expeditionResultScroll = document.getElementById('expedition-result-scroll');
const expeditionResultCard = document.getElementById('expedition-result-card');
const expeditionResultBorder = document.getElementById('expedition-result-border');
const expeditionResultKicker = document.getElementById('expedition-result-kicker');
const expeditionResultReason = document.getElementById('expedition-result-reason');
const expeditionResultSeparator = document.getElementById('expedition-result-separator');
const expeditionResultAction = document.getElementById('expedition-result-action');
const expeditionResultActionBg = document.getElementById('expedition-result-action-bg');
const expeditionResultUp = document.getElementById('expedition-result-up');
const expeditionResultDown = document.getElementById('expedition-result-down');
const sasGrilleTrigger = document.getElementById('sas-grille-trigger');
const sasRepairOverlay = document.getElementById('sas-repair-overlay');
const sasRepairClose = document.getElementById('sas-repair-close');
const sasRepairCutState = document.getElementById('sas-repair-cut-state');
const sasWireHitboxes = Array.from(document.querySelectorAll('.sas-wire-hitbox'));
const personalObjectLayer = document.getElementById('personal-object-layer');
const roomNodes = Array.from(document.querySelectorAll('.room-node'));
let landingStarted = false;
let landingTypingTimers = [];
let landingSequenceTimers = [];
let landingResizeHandler = null;
let expeditionTimerInterval = 0;
let expeditionTimerDeadline = 0;
let expeditionFailing = false;
let expeditionResultPending = null;
let presenceBroadcastChannel = null;
let presenceTransport = null;
let expeditionResultHoldTimer = 0;
let presenceHeartbeatTimer = 0;
let presenceCleanupTimer = 0;
let presenceRaf = 0;
let presenceQueued = false;
let activeRepairTool = '';
let sasRepairResolving = false;
const remotePresenceMap = new Map();
const expeditionInteractiveSelector = [
  '.debris-note',
  '.debris-toolbox',
  '.decision-btn',
  '.landing-module-btn',
  '.landing-console-nav',
  '.expedition-result-action'
].join(', ');
const personalLootItems = {
  cutting_pliers: {
    label:'PINCE',
    longLabel:'Pince coupante',
    src:'assets/debris-loot/pince-coupante.png',
    type:'tool'
  },
  motomoto_message: {
    label:'MSG',
    longLabel:"Message d'instruction de mecano",
    src:'assets/debris-loot/messages.png',
    type:'note'
  }
};
const sasRepairStateKey = 'areciboSasRepairCutWire';
const sasWireCutImages = {
  red:'assets/sas-repair/tableau ouvert fil rouge coupe.png',
  orange:'assets/sas-repair/tableau ouvert fil orange coupe.png',
  yellow:'assets/sas-repair/tableau ouvert fil jaune coupe.png',
  green:'assets/sas-repair/tableau ouvert fil vert coupe.png',
  blue:'assets/sas-repair/tableau ouvert fil bleu coupe.png',
  violet:'assets/sas-repair/tableau ouvert fil violet coupe.png',
  white:'assets/sas-repair/tableau ouvert fil blanc coupe.png',
  black:'assets/sas-repair/tableau ouvert fil noir coupe.png'
};
const sasWireLabels = {
  red:'rouge',
  orange:'orange',
  yellow:'jaune',
  green:'vert',
  blue:'bleu',
  violet:'violet',
  white:'blanc',
  black:'noir'
};
const landingDecisionStages = {
  impact: {
    alert:'Votre vaisseau a percute un asteroide !',
    question:"Qu'est ce que vous souhaitez faire ?",
    choices:[
      { id:'search-life-traces', label:'chercher des traces de vies' },
      { id:'inspect-asteroid', label:'inspecter l asteroide' },
      { id:'return-ship', label:'revenir sur le vaisseau' }
    ]
  },
  followup: {
    alert:'Signal decode // capsule derelict detectee a proximite.',
    question:"Ou souhaitez-vous envoyer l'equipe ?",
    choices:[
      { id:'enter-capsule', label:'entrer dans la capsule' },
      { id:'scan-exterior', label:'inspecter l exterieur de la coque' },
      { id:'fallback-ship', label:'revenir sur le vaisseau' }
    ]
  }
};
let landingDecisionStage = 'impact';
let landingDecisionChoices = landingDecisionStages.impact.choices;
const landingVotes = Array.from({ length: 6 }, () => null);
let landingVoteCursor = 0;
let landingSignalSessionId = '';
const landingVotePreset = (params.get('vote') || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
  .slice(0, 6);

function sanitizeProfileColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color) ? color : fallback;
}

function getPlayerProfile() {
  const requestedPrimaryColor = params.get('primaryColor') || params.get('primary');
  const requestedSecondaryColor = params.get('secondaryColor') || params.get('secondary');
  if (window.AreciboPlayerProfile && typeof window.AreciboPlayerProfile.loadPlayerProfile === 'function') {
    const storedProfile = window.AreciboPlayerProfile.loadPlayerProfile();
    return {
      ...storedProfile,
      name: window.areciboPlayerName || storedProfile.name || 'COCO',
      primaryColor: sanitizeProfileColor(requestedPrimaryColor, storedProfile.primaryColor || '#fcfcfc'),
      secondaryColor: sanitizeProfileColor(requestedSecondaryColor, storedProfile.secondaryColor || '#2f2925')
    };
  }
  return {
    name: window.areciboPlayerName || 'COCO',
    headId: 1,
    primaryColor: sanitizeProfileColor(requestedPrimaryColor, '#fcfcfc'),
    secondaryColor: sanitizeProfileColor(requestedSecondaryColor, '#2f2925')
  };
}

function updateLocalCursorProfile() {
  if (!cursor) return;
  const profile = getPlayerProfile();
  const playerName = formatPlayerPackageName(profile.name || window.areciboPlayerName || 'COCO');
  const label = ensureLocalCursorLabel();
  cursor.style.setProperty('--cursor-color', profile.primaryColor || '#FA5A1F');
  cursor.setAttribute('aria-label', `Curseur de ${playerName}`);
  if (label) label.textContent = playerName;
}

async function injectPlayerAvatar(target, options = {}) {
  if (!target || !window.AreciboPlayerProfile || typeof window.AreciboPlayerProfile.renderHeadSvg !== 'function') return;
  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  target.dataset.avatarToken = token;
  const markup = await window.AreciboPlayerProfile.renderHeadSvg(getPlayerProfile(), {
    className: options.className || 'crew-slot-avatar',
    label: options.label || (window.areciboPlayerName || 'JOUEUR')
  });
  if (target.dataset.avatarToken !== token) return;
  target.innerHTML = markup;
  target.classList.add('has-avatar');
}

landingVotePreset.forEach((vote, index) => {
  if (landingDecisionStages.impact.choices.some(choice => choice.id === vote)) {
    landingVotes[index] = vote;
  }
});
const pontRepairStates = [
  {
    id:'state-05-broken-4-doors-closed',
    stage:5,
    label:'Pont critique',
    detail:'4 portes fermees',
    condition:'critical',
    hullIntegrity:18,
    image:'assets/pont-principal-state-05-broken-4-doors-closed.png'
  },
  {
    id:'state-01-repaired-4-doors-open',
    stage:1,
    label:'Pont repare',
    detail:'4 portes ouvertes',
    condition:'repaired',
    hullIntegrity:100,
    image:'assets/pont-principal-state-01-repaired-4-doors-open.png'
  }
];
let activePontRepairState = pontRepairStates[1];
const initialDistanceMillionKm = 473.65;
const distanceCountdownSeconds = 10 * 60 * 60;
const millionKmPerSecond = initialDistanceMillionKm / distanceCountdownSeconds;
const distanceStart = performance.now();

function formatPlayerPackageName(value) {
  const cleaned = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 10)
    .toUpperCase();

  return cleaned || 'COCO';
}

function initPlayerPackageName() {
  const storageKey = 'areciboPlayerName';
  const requestedName = params.get('player') || params.get('name') || params.get('pilot');
  const storedName = localStorage.getItem(storageKey);
  const playerName = formatPlayerPackageName(requestedName || storedName || 'COCO');
  const packageTitle = `>PACKAGE ${playerName}\\`;

  try { localStorage.setItem(storageKey, playerName); }
  catch (err) {}

  if (personalTitle) personalTitle.textContent = packageTitle;
  if (personalWindow) personalWindow.setAttribute('aria-label', `Package ${playerName}`);
  if (messageIndicator) messageIndicator.setAttribute('aria-label', `Ouvrir 2 messages personnels de ${playerName}`);
  if (messagesTitle) messagesTitle.textContent = `PACKAGE ${playerName} // MESSAGES //`;

  window.areciboPlayerName = playerName;
  updateLocalCursorProfile();
}

function getPresenceClientId() {
  const key = `areciboPresenceClientId:${sessionCode || 'solo'}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = `p-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, created);
    return created;
  } catch (err) {
    return `p-${Math.random().toString(36).slice(2, 10)}`;
  }
}

const presenceClientId = getPresenceClientId();

function getPresenceSceneId() {
  if (debrisScene && debrisScene.classList.contains('is-active')) return 'expedition-debris';
  if (landingSequence && landingSequence.classList.contains('is-active')) return `expedition-landing:${landingDecisionStage || 'impact'}`;
  if (shipScene && shipScene.classList.contains('is-expedition-active')) {
    return `expedition-room:${shipScene.dataset.roomScene || 'sas'}`;
  }
  return `ship-room:${shipScene ? (shipScene.dataset.roomScene || 'sas') : 'sas'}`;
}

function shouldBroadcastPresence() {
  if (!sessionCode) return false;
  return !!(
    (debrisScene && debrisScene.classList.contains('is-active')) ||
    (landingSequence && landingSequence.classList.contains('is-active')) ||
    (shipScene && shipScene.classList.contains('is-expedition-active'))
  );
}

function getExpeditionInteractiveElements() {
  const elements = [];
  if (debrisScene && debrisScene.classList.contains('is-active')) {
    elements.push(...debrisScene.querySelectorAll('.debris-note, .debris-toolbox'));
  }
  if (landingSequence && landingSequence.classList.contains('is-active')) {
    elements.push(...landingSequence.querySelectorAll('.decision-btn, .landing-module-btn, .landing-console-nav, .expedition-result-action'));
  }
  return elements.filter(element => {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function getInteractiveElementLabel(element) {
  if (!element) return '';
  return formatPlayerPackageName(
    element.dataset.noteLabel
    || element.getAttribute('aria-label')
    || element.textContent
    || ''
  );
}

function getNearestExpeditionInteractive(xNorm, yNorm) {
  const elements = getExpeditionInteractiveElements();
  if (!elements.length) return null;
  const px = Math.max(0, Math.min(1, Number(xNorm) || 0)) * window.innerWidth;
  const py = Math.max(0, Math.min(1, Number(yNorm) || 0)) * window.innerHeight;
  let nearest = null;
  let nearestDistance = Infinity;

  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = cx - px;
    const dy = cy - py;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = element;
    }
  });

  const threshold = Math.max(56, Math.min(window.innerWidth, window.innerHeight) * 0.08);
  if (!nearest || nearestDistance > threshold) return null;
  return {
    element: nearest,
    label: getInteractiveElementLabel(nearest)
  };
}

function getPresencePayload() {
  const profile = getPlayerProfile();
  const nearestObject = getNearestExpeditionInteractive(
    Math.max(0, Math.min(1, pointerX / Math.max(1, window.innerWidth))),
    Math.max(0, Math.min(1, pointerY / Math.max(1, window.innerHeight)))
  );
  return {
    type:'presence-state',
    session:sessionCode,
    clientId:presenceClientId,
    name:formatPlayerPackageName(profile.name || window.areciboPlayerName || 'COCO'),
    primaryColor:profile.primaryColor || '#FA5A1F',
    x:Math.max(0, Math.min(1, pointerX / Math.max(1, window.innerWidth))),
    y:Math.max(0, Math.min(1, pointerY / Math.max(1, window.innerHeight))),
    scene:getPresenceSceneId(),
    nearObject:Boolean(nearestObject),
    nearObjectLabel:nearestObject ? nearestObject.label : '',
    active:shouldBroadcastPresence() && !document.hidden,
    ts:Date.now()
  };
}

function ensureRemotePresenceNode(clientId) {
  let entry = remotePresenceMap.get(clientId);
  if (entry) return entry;
  if (!remotePresenceLayer) return null;

  const node = document.createElement('div');
  node.className = 'remote-cursor';
  node.setAttribute('aria-hidden', 'true');

  const halo = document.createElement('div');
  halo.className = 'remote-cursor-halo';
  node.appendChild(halo);

  const label = document.createElement('div');
  label.className = 'remote-cursor-name';
  node.appendChild(label);
  remotePresenceLayer.appendChild(node);

  entry = { node, halo, label, scene:'', lastSeen:0, interactionTimer:0 };
  remotePresenceMap.set(clientId, entry);
  return entry;
}

function removeRemotePresence(clientId) {
  const entry = remotePresenceMap.get(clientId);
  if (!entry) return;
  if (entry.interactionTimer) window.clearTimeout(entry.interactionTimer);
  entry.node.remove();
  remotePresenceMap.delete(clientId);
}

function triggerRemotePresenceInteraction(entry) {
  if (!entry) return;
  entry.node.classList.remove('is-interacting');
  void entry.node.offsetWidth;
  entry.node.classList.add('is-interacting');
  if (entry.interactionTimer) window.clearTimeout(entry.interactionTimer);
  entry.interactionTimer = window.setTimeout(() => {
    entry.node.classList.remove('is-interacting');
  }, 540);
}

function updateRemotePresence(data) {
  if (!data || !data.clientId || data.clientId === presenceClientId || data.session !== sessionCode) return;
  const entry = ensureRemotePresenceNode(data.clientId);
  if (!entry) return;

  entry.lastSeen = data.ts || Date.now();
  entry.scene = data.scene || '';
  entry.label.textContent = formatPlayerPackageName(data.name || 'JOUEUR');
  entry.node.style.setProperty('--presence-color', data.primaryColor || '#FA5A1F');
  entry.node.style.left = `${Math.max(0, Math.min(1, Number(data.x) || 0)) * window.innerWidth}px`;
  entry.node.style.top = `${Math.max(0, Math.min(1, Number(data.y) || 0)) * window.innerHeight}px`;

  const shouldShow = Boolean(data.active) && data.scene === getPresenceSceneId();
  entry.node.classList.toggle('is-visible', shouldShow);
  entry.node.classList.toggle('is-near-object', shouldShow && Boolean(data.nearObject));
}

function applyRemotePresenceInteraction(data) {
  if (!data || !data.clientId || data.clientId === presenceClientId || data.session !== sessionCode) return;
  const entry = ensureRemotePresenceNode(data.clientId);
  if (!entry) return;
  entry.lastSeen = data.ts || Date.now();
  entry.scene = data.scene || '';
  entry.label.textContent = formatPlayerPackageName(data.name || 'JOUEUR');
  entry.node.style.setProperty('--presence-color', data.primaryColor || '#FA5A1F');
  entry.node.style.left = `${Math.max(0, Math.min(1, Number(data.x) || 0)) * window.innerWidth}px`;
  entry.node.style.top = `${Math.max(0, Math.min(1, Number(data.y) || 0)) * window.innerHeight}px`;
  const shouldShow = data.scene === getPresenceSceneId();
  entry.node.classList.toggle('is-visible', shouldShow);
  entry.node.classList.toggle('is-near-object', shouldShow && Boolean(data.nearObject));
  if (shouldShow) triggerRemotePresenceInteraction(entry);
}

function handlePresenceMessage(data) {
  if (!data || data.session !== sessionCode) return;
  if (data.clientId === presenceClientId) return;
  if (data.type === 'session-inventory-consume') {
    consumePersonalLoot(data.items || [], { broadcast:false });
    return;
  }
  if (data.type === 'presence-interact') {
    applyRemotePresenceInteraction(data);
    return;
  }
  if (data.type === 'presence-state') {
    updateRemotePresence(data);
  }
}

function cleanupRemotePresence() {
  const now = Date.now();
  for (const [clientId, entry] of remotePresenceMap.entries()) {
    if (now - entry.lastSeen > 2600) removeRemotePresence(clientId);
    else {
      const visible = entry.scene === getPresenceSceneId();
      entry.node.classList.toggle('is-visible', visible);
      if (!visible) entry.node.classList.remove('is-near-object');
    }
  }
}

function sendPresenceMessage(payload) {
  if (!payload || !sessionCode) return;
  if (presenceBroadcastChannel) {
    presenceBroadcastChannel.postMessage(payload);
  }
  if (presenceTransport && typeof presenceTransport.send === 'function') {
    try { presenceTransport.send(payload); } catch (err) {}
  }
  try {
    localStorage.setItem(`arecibo:presence:${sessionCode}`, JSON.stringify({
      ...payload,
      nonce:Math.random().toString(36).slice(2, 8)
    }));
  } catch (err) {}
}

function broadcastPresenceState(force = false) {
  if (!sessionCode) return;
  const payload = getPresencePayload();
  if (!force && !payload.active && remotePresenceMap.size === 0) return;
  sendPresenceMessage(payload);
}

function queuePresenceBroadcast() {
  if (!sessionCode || presenceQueued) return;
  presenceQueued = true;
  presenceRaf = window.requestAnimationFrame(() => {
    presenceQueued = false;
    broadcastPresenceState();
  });
}

function emitPresenceInteraction(sourceElement, event) {
  if (!sessionCode || !shouldBroadcastPresence()) return;
  const profile = getPlayerProfile();
  const element = sourceElement instanceof HTMLElement ? sourceElement : null;
  const rect = element ? element.getBoundingClientRect() : null;
  const x = typeof event?.clientX === 'number'
    ? event.clientX
    : rect
      ? rect.left + rect.width * 0.5
      : pointerX;
  const y = typeof event?.clientY === 'number'
    ? event.clientY
    : rect
      ? rect.top + rect.height * 0.5
      : pointerY;
  const payload = {
    type:'presence-interact',
    session:sessionCode,
    clientId:presenceClientId,
    name:formatPlayerPackageName(profile.name || window.areciboPlayerName || 'COCO'),
    primaryColor:profile.primaryColor || '#FA5A1F',
    x:Math.max(0, Math.min(1, x / Math.max(1, window.innerWidth))),
    y:Math.max(0, Math.min(1, y / Math.max(1, window.innerHeight))),
    scene:getPresenceSceneId(),
    nearObject:true,
    nearObjectLabel:getInteractiveElementLabel(element),
    ts:Date.now()
  };
  sendPresenceMessage(payload);
}

function setPresenceTransport(transport) {
  presenceTransport = transport || null;
  if (presenceTransport && typeof presenceTransport.subscribe === 'function') {
    try {
      presenceTransport.subscribe(handlePresenceMessage);
    } catch (err) {}
  }
}

function initMultiplayerPresence() {
  if (!sessionCode || !remotePresenceLayer) return;
  if (window.AreciboPresenceTransport) setPresenceTransport(window.AreciboPresenceTransport);

  if ('BroadcastChannel' in window) {
    presenceBroadcastChannel = new BroadcastChannel(`arecibo-presence-${sessionCode}`);
    presenceBroadcastChannel.onmessage = event => handlePresenceMessage(event.data);
  }

  window.addEventListener('storage', event => {
    if (event.key !== `arecibo:presence:${sessionCode}` || !event.newValue) return;
    try {
      handlePresenceMessage(JSON.parse(event.newValue));
    } catch (err) {}
  });

  presenceHeartbeatTimer = window.setInterval(() => {
    broadcastPresenceState(true);
    cleanupRemotePresence();
  }, 900);

  presenceCleanupTimer = window.setInterval(cleanupRemotePresence, 500);

  document.addEventListener('visibilitychange', () => {
    broadcastPresenceState(true);
  });

  window.addEventListener('beforeunload', () => {
    const payload = {
      type:'presence-state',
      session:sessionCode,
      clientId:presenceClientId,
      active:false,
      scene:getPresenceSceneId(),
      ts:Date.now()
    };
    if (presenceBroadcastChannel) {
      presenceBroadcastChannel.postMessage(payload);
      presenceBroadcastChannel.close();
    }
    if (presenceTransport && typeof presenceTransport.send === 'function') {
      try { presenceTransport.send(payload); } catch (err) {}
    }
    try {
      localStorage.setItem(`arecibo:presence:${sessionCode}`, JSON.stringify({
        ...payload,
        nonce:Math.random().toString(36).slice(2, 8)
      }));
    } catch (err) {}
  });

  queuePresenceBroadcast();
}

function persistStoryPhase() {
  try { localStorage.setItem(STORY_PHASE_KEY, storyPhase); }
  catch (err) {}
}

function loadPersonalInventory() {
  try {
    const raw = JSON.parse(localStorage.getItem(PERSONAL_INVENTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(id => personalLootItems[id]) : [];
  } catch (err) {
    return [];
  }
}

function savePersonalInventory(items) {
  try {
    localStorage.setItem(PERSONAL_INVENTORY_KEY, JSON.stringify(Array.from(new Set(items))));
  } catch (err) {}
}

function closePersonalObjectPanels(itemIds = []) {
  if (!personalObjectLayer || !itemIds.length) return;
  itemIds.forEach(itemId => {
    const panel = personalObjectLayer.querySelector(`[data-personal-object="${itemId}"]`);
    if (panel) panel.remove();
  });
  if (!personalObjectLayer.querySelector('.personal-object-panel')) {
    personalObjectLayer.classList.remove('is-active');
  }
}

function broadcastInventoryConsume(items) {
  const ids = Array.from(new Set((items || []).filter(id => personalLootItems[id])));
  if (!ids.length || !sessionCode) return;

  const payload = {
    type:'session-inventory-consume',
    session:sessionCode,
    clientId:presenceClientId,
    items:ids,
    ts:Date.now()
  };
  sendPresenceMessage(payload);
  try {
    localStorage.setItem(SESSION_INVENTORY_SYNC_KEY, JSON.stringify({
      ...payload,
      nonce:Math.random().toString(36).slice(2, 8)
    }));
  } catch (err) {}
}

function consumePersonalLoot(items, options = {}) {
  const ids = Array.from(new Set((items || []).filter(id => personalLootItems[id])));
  if (!ids.length) return loadPersonalInventory();

  const current = loadPersonalInventory();
  const next = current.filter(itemId => !ids.includes(itemId));
  savePersonalInventory(next);
  if (ids.includes(activeRepairTool)) setRepairToolActive('');
  closePersonalObjectPanels(ids);
  renderPersonalInventory();

  if (options.broadcast) broadcastInventoryConsume(ids);
  return next;
}

function setRepairToolActive(toolId) {
  activeRepairTool = toolId || '';
  shipScene?.classList.toggle('is-cutting-pliers-active', activeRepairTool === 'cutting_pliers');
}

function setSasRepairCutImage(color, options = {}) {
  if (!sasRepairCutState) return;
  const src = sasWireCutImages[color];
  sasRepairCutState.classList.toggle('is-danger', Boolean(options.danger));
  if (!src) {
    sasRepairCutState.removeAttribute('src');
    sasRepairCutState.classList.remove('is-visible');
    return;
  }
  sasRepairCutState.src = src;
  sasRepairCutState.classList.add('is-visible');
}

function resetSasRepairCutState() {
  try { localStorage.removeItem(sasRepairStateKey); } catch (err) {}
  sasRepairResolving = false;
  setSasRepairCutImage('');
  shipScene?.classList.remove('is-sas-wire-repaired');
}

function isSasWireRepairComplete() {
  try { return localStorage.getItem(sasRepairStateKey) === 'green'; }
  catch (err) { return false; }
}

function applySasWireRepairSuccessState() {
  consumePersonalLoot(['cutting_pliers', 'motomoto_message']);
  setShipCondition('repaired', 100);
  setHullSystemStatus('critical');
  shipScene?.classList.add('is-sas-wire-repaired');
  setRoomNodeState('PONT PRINCIPAL', 'open');
  if (bridgeMeta) {
    bridgeMeta.textContent = 'MOTOMOTO // SAS EXPEDITION // SYSTEME DU SAS STABILISE';
  }
  if (roomState) {
    roomState.classList.remove('warn');
    roomState.classList.add('active');
    roomState.textContent = 'STABLE';
  }
  if (launchLabel) launchLabel.textContent = 'SAS REPARE';
  if (launchIcon) launchIcon.textContent = 'OK';
  if (launchBtn) {
    launchBtn.disabled = false;
    launchBtn.style.opacity = '';
    launchBtn.style.filter = '';
    launchBtn.classList.add('ready');
    launchBtn.setAttribute('aria-disabled', 'false');
  }
  syncSceneBackdropImage();
}

function syncSceneBackdropImage() {
  if (!shipScene || !sceneBackdrop) return;

  const roomScene = shipScene.dataset.roomScene || 'sas';
  let image = 'assets/sas-2.png';

  if (roomScene === 'pont') {
    image = activePontRepairState?.image || 'assets/pont-principal-state-05-broken-4-doors-closed.png';
  } else if (roomScene === 'quarters') {
    image = 'assets/quartier-fenetre.png';
  } else if (shipScene.classList.contains('is-sas-repair-ready')) {
    image = 'assets/sas-repair/sas-grille-ouverte.png';
  }

  sceneBackdrop.style.setProperty('--scene-image', `url('${image}')`);
}

function setHullSystemStatus(status = 'critical') {
  if (!hullStatus) return;
  const isCritical = status === 'critical';
  const isRepairing = status === 'repairing';
  const isStable = status === 'stable';

  hullStatus.classList.toggle('is-repairing', isRepairing);
  hullStatus.classList.toggle('is-stable', isStable);
  hullStatus.classList.toggle('hull-alert', isCritical || isRepairing);
  hullStatus.textContent = isCritical
    ? 'ENDOMMAGE - ETAT CRITIQUE'
    : isRepairing
      ? 'EN REPARATION - ETAT INSTABLE'
      : 'STABLE - ETAT NORMAL';
}

function restoreSasRepairCutState() {
  let savedColor = '';
  try { savedColor = localStorage.getItem(sasRepairStateKey) || ''; } catch (err) {}
  if (savedColor && sasWireCutImages[savedColor]) {
    setSasRepairCutImage(savedColor);
    if (savedColor === 'green') {
      applySasWireRepairSuccessState();
    } else {
      shipScene?.classList.remove('is-sas-wire-repaired');
    }
  }
}

function resetOpeningLevelAfterSasFailure() {
  try {
    localStorage.removeItem(PERSONAL_INVENTORY_KEY);
    localStorage.removeItem(sasRepairStateKey);
  } catch (err) {}
  if (typeof window.resetDebrisMissionState === 'function') {
    window.resetDebrisMissionState();
  }
  setRepairToolActive('');
  if (personalObjectLayer) {
    personalObjectLayer.innerHTML = '';
    personalObjectLayer.classList.remove('is-active');
  }
  resetSasRepairCutState();
  renderPersonalInventory();
  setStoryPhase('opening-briefing');
}

function handleSasWireCut(color) {
  if (!color || !sasWireCutImages[color] || sasRepairResolving) return;

  if (activeRepairTool !== 'cutting_pliers') {
    if (mapMessage) {
      mapMessage.classList.add('warn');
      mapMessage.textContent = 'Impossible de couper : sortez la pince coupante du package personnel.';
    }
    return;
  }

  sasRepairResolving = true;
  const isCorrect = color === 'green';
  setSasRepairCutImage(color, { danger:!isCorrect });

  if (isCorrect) {
    try { localStorage.setItem(sasRepairStateKey, color); } catch (err) {}
    applySasWireRepairSuccessState();
    broadcastInventoryConsume(['cutting_pliers', 'motomoto_message']);
    if (mapMessage) {
      mapMessage.classList.remove('warn');
      mapMessage.textContent = 'Fil vert coupe : circuit du sas stabilise, alarme coupee, pression maintenue.';
    }
    window.setTimeout(() => { sasRepairResolving = false; }, 700);
    return;
  }

  if (mapMessage) {
    mapMessage.classList.add('warn');
    mapMessage.textContent = `Mauvais fil ${sasWireLabels[color] || color} coupe : depressurisation immediate du sas.`;
  }

  window.setTimeout(() => {
    closeSasRepairOverlay();
    showExpeditionResult('failure', {
      kicker:'Game over',
      reason:'Depressurisation du sas // mauvais fil coupe',
      returnOptions:{
        message:'Le sas a ete depressurise. Tout l equipage est perdu. Redemarrage de la quete depuis le debut.',
        isFailure:true
      },
      afterReturn:resetOpeningLevelAfterSasFailure
    });
  }, 650);
}

function makeFloatingPanelDraggable(panel, handle = panel) {
  if (!panel || !handle) return;
  let drag = null;

  function clampPanel(left, top) {
    const rect = panel.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left:Math.min(Math.max(left, margin), maxLeft),
      top:Math.min(Math.max(top, margin), maxTop)
    };
  }

  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (event.target.closest('button')) return;
    const rect = panel.getBoundingClientRect();
    panel.style.transform = 'none';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    drag = {
      pointerId:event.pointerId,
      offsetX:event.clientX - rect.left,
      offsetY:event.clientY - rect.top
    };
    panel.classList.add('is-dragging');
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = clampPanel(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  function endDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    panel.classList.remove('is-dragging');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    drag = null;
  }

  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
}

function openPersonalObject(itemId) {
  if (!personalObjectLayer) return;
  const item = personalLootItems[itemId];
  if (!item) return;

  personalObjectLayer.classList.add('is-active');
  let panel = personalObjectLayer.querySelector(`[data-personal-object="${itemId}"]`);
  if (!panel) {
    panel = document.createElement('section');
    panel.className = `personal-object-panel is-${item.type || 'item'}`;
    panel.dataset.personalObject = itemId;
    panel.setAttribute('aria-label', item.longLabel);
    panel.innerHTML = `
      <header class="personal-object-header">
        <span>${item.longLabel}</span>
        <button class="personal-object-close" type="button" aria-label="Fermer ${item.longLabel}">x</button>
      </header>
      <div class="personal-object-body">
        <img src="${item.src}" alt="${item.longLabel}">
      </div>
    `;
    personalObjectLayer.appendChild(panel);

    const closeButton = panel.querySelector('.personal-object-close');
    const dragHandle = panel;
    makeFloatingPanelDraggable(panel, dragHandle);
    closeButton?.addEventListener('click', event => {
      event.stopPropagation();
      if (itemId === activeRepairTool) setRepairToolActive('');
      panel.remove();
      if (!personalObjectLayer.querySelector('.personal-object-panel')) {
        personalObjectLayer.classList.remove('is-active');
      }
    });
  }

  const index = Array.from(personalObjectLayer.querySelectorAll('.personal-object-panel')).indexOf(panel);
  panel.style.left = item.type === 'tool'
    ? `min(62vw, ${Math.max(360, window.innerWidth * 0.62)}px)`
    : `min(44vw, ${Math.max(280, window.innerWidth * 0.44)}px)`;
  panel.style.top = item.type === 'tool'
    ? `min(48vh, ${Math.max(240, window.innerHeight * 0.48)}px)`
    : `min(14vh, ${Math.max(70, window.innerHeight * 0.14)}px)`;
  panel.style.zIndex = String(990 + index);
  panel.classList.remove('is-opening');
  void panel.offsetWidth;
  panel.classList.add('is-opening');
  if (itemId === 'cutting_pliers') setRepairToolActive(itemId);

  if (mapMessage) {
    mapMessage.classList.remove('warn');
    mapMessage.textContent = item.type === 'tool'
      ? 'Pince coupante sortie du package : outil manipulable pendant la reparation.'
      : "Message d'instruction de mecano ouvert : gardez-le visible pendant le cablage.";
  }
}

function renderPersonalInventory() {
  if (!personalInventory) return;
  const items = loadPersonalInventory();
  personalInventory.innerHTML = '';
  personalWindow?.classList.toggle('has-loot', items.length > 0);

  if (!items.length) {
    const empty = document.createElement('span');
    empty.className = 'personal-inventory-empty';
    empty.textContent = 'VIDE';
    personalInventory.appendChild(empty);
    return;
  }

  items.forEach(itemId => {
    const item = personalLootItems[itemId];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'personal-item';
    button.dataset.itemId = itemId;
    button.dataset.label = item.longLabel;
    button.setAttribute('aria-label', `${item.longLabel} dans le package personnel`);

    const img = document.createElement('img');
    img.src = item.src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');

    button.appendChild(img);
    button.addEventListener('click', () => openPersonalObject(itemId));
    personalInventory.appendChild(button);
  });
}

function unlockPersonalLoot(items) {
  const current = loadPersonalInventory();
  const next = Array.from(new Set([...current, ...items.filter(id => personalLootItems[id])]));
  savePersonalInventory(next);
  renderPersonalInventory();
  return next;
}

function getStoryMessages(phase = storyPhase) {
  if (phase === 'opening-return') {
    return [
      {
        sender:'MOTOMOTO // CRIS',
        time:'MESSAGE PRIORITAIRE',
        subject:'REPARATION DU SAS',
        text:'La sortie a permis de recuperer une pince coupante et un message technique dans les debris. Utilisez ces informations pour reparer le systeme de la porte du sas avant toute nouvelle expedition.'
      },
      {
        warning:true,
        badge:'!! WARNING !!',
        time:'ALERTE ROUGE',
        subject:'STRUCTURE TOUJOURS INSTABLE',
        text:'Le vaisseau reste en etat critique. Toutes les sections demeurent verrouillees tant que la porte du sas et les circuits externes ne sont pas stabilises.'
      }
    ];
  }

  return [
    {
      sender:'MOTOMOTO // CRIS',
      time:'OUVERTURE // QUETE 001',
      subject:'SORTIE D URGENCE',
      text:'Le MOTOMOTO a heurte un champ de debris spatiaux. La coque et le systeme du sas sont severement endommages. Une sortie immediate est requise pour recuperer de quoi reparer.'
    },
    {
      warning:true,
      badge:'!! WARNING !!',
      time:'ALERTE MAXIMALE',
      subject:'SECTIONS VERROUILLEES',
      text:'Toutes les pieces restent fermees. Seul le sas expedition est accessible. Temps de sortie recommande : 08:00 avant reprise des radiations.'
    }
  ];
}

function renderMessages(messages = getStoryMessages()) {
  if (!messagesBody) return;
  messagesBody.innerHTML = '';

  messages.forEach(message => {
    const card = document.createElement('article');
    card.className = `message-card${message.warning ? ' warning' : ''}`;

    const meta = document.createElement('div');
    meta.className = 'message-meta';

    const left = document.createElement('span');
    left.className = message.warning ? 'warning-badge' : 'message-sender';
    left.textContent = message.warning ? (message.badge || '!! WARNING !!') : message.sender;

    const right = document.createElement('span');
    right.className = 'message-time';
    right.textContent = message.time;

    const subject = document.createElement('h3');
    subject.className = 'message-subject';
    subject.textContent = message.subject;

    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = message.text;

    meta.append(left, right);
    card.append(meta, subject, text);
    messagesBody.appendChild(card);
  });

  if (messageCount) {
    messageCount.textContent = String(messages.length).padStart(2, '0');
  }
  if (messageIndicator) {
    const playerName = window.areciboPlayerName || 'joueur';
    messageIndicator.setAttribute('aria-label', `Ouvrir ${messages.length} messages personnels de ${playerName}`);
  }
}

function setRoomNodeState(roomName, state) {
  roomNodes.forEach(node => {
    if ((node.dataset.room || '') !== roomName) return;
    node.dataset.state = state;
    node.classList.toggle('locked', state === 'locked');
  });
}

function applyOpeningStoryState() {
  const isReturn = storyPhase === 'opening-return';
  const isOpening = storyPhase === 'opening-briefing' || storyPhase === 'opening-expedition' || isReturn;
  const sasWireRepaired = isSasWireRepairComplete();
  if (shipScene) shipScene.classList.toggle('is-sas-repair-ready', isReturn);
  if (!isOpening) return;

  setPontRepairState('state-05-broken-4-doors-closed');
  setShipCondition(sasWireRepaired ? 'repaired' : 'critical', sasWireRepaired ? 100 : 18);

  roomNodes.forEach(node => {
    const isSas = (node.dataset.room || '') === 'SAS EXPEDITION';
    const isPont = (node.dataset.room || '') === 'PONT PRINCIPAL';
    const isUnlocked = isSas || (sasWireRepaired && isPont);
    node.dataset.state = isUnlocked ? 'open' : 'locked';
    node.classList.toggle('locked', !isUnlocked);
    node.classList.toggle('active', isSas);
  });

  setShipScene('SAS EXPEDITION');
  syncSceneBackdropImage();
  renderMessages(getStoryMessages());

  if (launchLabel) {
    launchLabel.textContent = isReturn ? 'PORTE DU SAS A REPARER' : 'SORTIR DANS LES DEBRIS';
  }
  if (launchIcon) {
    launchIcon.textContent = isReturn ? '!' : '+';
  }
  if (launchBtn) {
    launchBtn.classList.remove('ready');
    launchBtn.disabled = isReturn;
    launchBtn.style.opacity = isReturn ? '.66' : '';
    launchBtn.style.filter = isReturn ? 'saturate(.78)' : '';
    launchBtn.setAttribute('aria-disabled', String(isReturn));
  }

  if (bridgeMeta) {
    bridgeMeta.textContent = isReturn
      ? 'MOTOMOTO // SAS EXPEDITION // RETOUR MISSION // SYSTEME DU SAS ENDOMMAGE'
      : 'MOTOMOTO // SAS EXPEDITION // ALERTE MAXIMALE // RECUPERATION DE DEBRIS';
  }

  if (airlockTimer) airlockTimer.textContent = '08:00';
  if (roomCurrent) roomCurrent.textContent = 'SAS EXPEDITION';
  if (roomState) {
    roomState.classList.add('warn');
    roomState.classList.remove('active');
    roomState.textContent = 'ALERTE';
  }
  if (mapMessage) {
    mapMessage.classList.add('warn');
    mapMessage.textContent = isReturn
      ? 'Le MOTOMOTO demande une reparation du sas avec la pince coupante et le message technique recuperes.'
      : 'Le sas reste la seule sortie active. Lancez la premiere sortie de recuperation dans les debris.';
  }

  if (sasWireRepaired) {
    applySasWireRepairSuccessState();
    if (mapMessage) {
      mapMessage.classList.remove('warn');
      mapMessage.textContent = 'Le sas est stabilise : le pont principal est maintenant accessible sur la carte.';
    }
  }

  if (landingDecisionStages.impact) {
    landingDecisionStages.impact.alert = 'Le MOTOMOTO a heurte des debris spatiaux // dommages critiques detectes.';
    landingDecisionStages.impact.question = 'Tout l equipage doit partir recuperer de quoi reparer le vaisseau.';
    landingDecisionStages.impact.choices = [
      { id:'inspect-debris', label:'inspecter les debris pour trouver du materiel' }
    ];
  }
  landingDecisionChoices = landingDecisionStages.impact.choices;
}

function setStoryPhase(nextPhase, options = {}) {
  storyPhase = nextPhase;
  persistStoryPhase();
  applyOpeningStoryState();

  if (options.autoOpenMessages && nextPhase === 'opening-return') {
    try { localStorage.setItem(OPENING_MAIL_OPENED_KEY, 'true'); } catch (err) {}
    window.setTimeout(() => openMessages(), 420);
  }
}

window.setStoryPhase = setStoryPhase;

function updateDistance() {
  const elapsedSeconds = (performance.now() - distanceStart) / 1000;
  const currentDistance = Math.max(0, initialDistanceMillionKm - elapsedSeconds * millionKmPerSecond);
  distanceValue.textContent = `${currentDistance.toFixed(2)}M KM`;
  requestAnimationFrame(updateDistance);
}

function startPortholeSpace() {
  const canvas = document.getElementById('porthole-space');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stars = [];
  const dust = [];
  const debrisEvents = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let nextDebrisAt = performance.now() + 14000;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function getDebrisPalette() {
    const hullState = shipScene?.dataset.hullState || 'critical';
    if (hullState === 'stable') {
      return {
        coreA: 'rgba(225,242,255,.94)',
        coreB: 'rgba(171,214,236,.76)',
        coreC: 'rgba(26,40,54,.8)',
        stroke: 'rgba(117,216,255,.52)',
        pixelLight: 'rgba(225,244,255,.82)',
        pixelDark: 'rgba(106,145,168,.62)',
        fragmentFill: 'rgba(198,235,255,.7)',
        fragmentStroke: 'rgba(117,216,255,.35)',
        fragmentTrail: 'rgba(189,236,255,.82)',
        trailA: 'rgba(206,240,255,.22)',
        trailB: 'rgba(151,214,247,.1)',
        trailC: 'rgba(151,214,247,0)'
      };
    }
    if (hullState === 'repairing') {
      return {
        coreA: 'rgba(255,222,176,.95)',
        coreB: 'rgba(244,154,102,.78)',
        coreC: 'rgba(48,28,22,.82)',
        stroke: 'rgba(250,90,31,.52)',
        pixelLight: 'rgba(255,232,192,.84)',
        pixelDark: 'rgba(176,116,76,.62)',
        fragmentFill: 'rgba(255,205,148,.72)',
        fragmentStroke: 'rgba(250,90,31,.35)',
        fragmentTrail: 'rgba(255,220,170,.82)',
        trailA: 'rgba(255,212,162,.22)',
        trailB: 'rgba(250,140,86,.1)',
        trailC: 'rgba(250,140,86,0)'
      };
    }
    return {
      coreA: 'rgba(255,216,206,.95)',
      coreB: 'rgba(228,116,104,.76)',
      coreC: 'rgba(42,24,24,.82)',
      stroke: 'rgba(224,59,49,.52)',
      pixelLight: 'rgba(255,224,218,.82)',
      pixelDark: 'rgba(166,94,89,.62)',
      fragmentFill: 'rgba(255,198,188,.7)',
      fragmentStroke: 'rgba(224,59,49,.35)',
      fragmentTrail: 'rgba(255,214,206,.78)',
      trailA: 'rgba(255,206,198,.22)',
      trailB: 'rgba(224,98,90,.1)',
      trailC: 'rgba(224,98,90,0)'
    };
  }

  function resetStar(star, fromEdge = false) {
    star.x = fromEdge ? width + randomBetween(0, width * .18) : Math.random() * width;
    star.y = Math.random() * height;
    star.r = randomBetween(.3, 1.05);
    star.speed = randomBetween(.006, .026);
    star.alpha = randomBetween(.14, .58);
    star.twinkle = randomBetween(.0015, .006);
  }

  function resetDust(particle, fromEdge = false) {
    particle.x = fromEdge ? width + randomBetween(6, width * .2) : Math.random() * width;
    particle.y = Math.random() * height;
    particle.prevX = particle.x;
    particle.prevY = particle.y;
    particle.r = randomBetween(.55, 1.55);
    particle.speed = randomBetween(.045, .13);
    particle.drift = randomBetween(-.012, .022);
    particle.alpha = randomBetween(.12, .32);
    particle.warm = Math.random() > .9;
  }

  function createDebrisShape(points, jagged = .32) {
    const shape = [];
    for (let i = 0; i < points; i++) {
      const angle = (Math.PI * 2 * i) / points;
      shape.push({
        x: Math.cos(angle) * randomBetween(1 - jagged, 1 + jagged),
        y: Math.sin(angle) * randomBetween(1 - jagged, 1 + jagged)
      });
    }
    return shape;
  }

  function createDebrisPixels(size) {
    const pixels = [];
    const cell = Math.max(2, Math.round(size * .09));
    for (let py = -size * .34; py <= size * .34; py += cell) {
      for (let px = -size * .44; px <= size * .44; px += cell) {
        const nx = px / (size * .46);
        const ny = py / (size * .36);
        const edge = nx * nx + ny * ny;
        if (edge > randomBetween(.56, 1.05) || Math.random() < .4) continue;
        pixels.push({
          x: Math.round(px),
          y: Math.round(py),
          size: cell,
          light: Math.random() > .42
        });
      }
    }
    return pixels;
  }

  function spawnDebrisEvent(now = performance.now()) {
    const big = Math.random() > .18;
    const fromLeft = Math.random() > .5;
    const direction = fromLeft ? 1 : -1;
    const speedRoll = Math.random();
    const speed = speedRoll > .88
      ? randomBetween(2.4, 4.1)
      : speedRoll > .58
        ? randomBetween(.82, 1.45)
        : randomBetween(.34, .68);
    const size = big ? randomBetween(50, 78) : randomBetween(34, 50);
    const event = {
      x: fromLeft ? -size * randomBetween(.9, 1.7) : width + size * randomBetween(.9, 1.7),
      y: randomBetween(height * .18, height * .72),
      prevX: 0,
      prevY: 0,
      direction,
      vx: direction * speed,
      vy: randomBetween(-.055, .08),
      size,
      rotation: randomBetween(-.8, .8),
      spin: randomBetween(-.004, .004) * (speed > 2 ? 1.8 : 1),
      age: 0,
      shedRate: speed > 2 ? .92 : big ? .66 : .38,
      fragments: [],
      shape: createDebrisShape(big ? 9 : 7, big ? .34 : .25),
      pixels: createDebrisPixels(size),
      kind: 'asteroid'
    };
    event.prevX = event.x;
    event.prevY = event.y;
    debrisEvents.push(event);
    nextDebrisAt = now + randomBetween(28000, 52000);
  }

  function shedDebris(event) {
    const fragmentCount = Math.random() < event.shedRate ? Math.round(randomBetween(1, 3)) : 0;
    for (let i = 0; i < fragmentCount; i++) {
      const rearX = event.x - event.direction * event.size * randomBetween(.14, .42);
      const rearY = event.y + randomBetween(-event.size * .22, event.size * .22);
      event.fragments.push({
        x: rearX,
        y: rearY,
        prevX: rearX,
        prevY: rearY,
        vx: event.vx * randomBetween(.04, .32) - event.direction * randomBetween(.02, .2),
        vy: event.vy + randomBetween(-.16, .16),
        size: randomBetween(1.4, event.size * .08),
        rotation: randomBetween(-1.6, 1.6),
        spin: randomBetween(-.018, .018),
        alpha: randomBetween(.2, .56),
        warm: false,
        shape: createDebrisShape(Math.round(randomBetween(4, 7)), .42)
      });
    }
  }

  function drawDebrisShape(item, alpha = 1) {
    const palette = getDebrisPalette();
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);
    ctx.globalAlpha = alpha;

    const gradient = ctx.createRadialGradient(-item.size * .25, -item.size * .3, 0, 0, 0, item.size);
    gradient.addColorStop(0, palette.coreA);
    gradient.addColorStop(.42, palette.coreB);
    gradient.addColorStop(1, palette.coreC);

    ctx.fillStyle = gradient;
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(1, item.size * .035);
    ctx.beginPath();
    item.shape.forEach((point, index) => {
      const x = point.x * item.size * .5;
      const y = point.y * item.size * .38;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = alpha * .78;
    item.pixels.forEach(pixel => {
      ctx.fillStyle = pixel.light ? palette.pixelLight : palette.pixelDark;
      ctx.fillRect(pixel.x, pixel.y, pixel.size, pixel.size);
    });

    ctx.restore();
  }

  function drawFragment(fragment) {
    const palette = getDebrisPalette();
    ctx.save();
    ctx.translate(fragment.x, fragment.y);
    ctx.rotate(fragment.rotation);
    ctx.globalAlpha = fragment.alpha * .32;
    ctx.strokeStyle = palette.fragmentTrail;
    ctx.lineWidth = Math.max(1, fragment.size * .25);
    ctx.beginPath();
    ctx.moveTo(fragment.prevX - fragment.x, fragment.prevY - fragment.y);
    ctx.lineTo(0, 0);
    ctx.stroke();

    ctx.globalAlpha = fragment.alpha;
    ctx.fillStyle = palette.fragmentFill;
    ctx.strokeStyle = palette.fragmentStroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    fragment.shape.forEach((point, index) => {
      const x = point.x * fragment.size;
      const y = point.y * fragment.size * .78;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function updateDebris(now) {
    const allowDebris = false;
    if (!allowDebris) {
      debrisEvents.length = 0;
      nextDebrisAt = now + randomBetween(10000, 20000);
      return;
    }

    if (now >= nextDebrisAt && debrisEvents.length < 1) spawnDebrisEvent(now);
    const palette = getDebrisPalette();

    for (let i = debrisEvents.length - 1; i >= 0; i--) {
      const event = debrisEvents[i];
      event.age += 1;
      event.prevX = event.x;
      event.prevY = event.y;

      event.x += event.vx;
      event.y += event.vy + Math.sin(event.age * .027) * .035;
      event.rotation += event.spin;
      const stillNearView = event.direction > 0
        ? event.x < width + event.size * .8
        : event.x > -event.size * .8;
      if (stillNearView) shedDebris(event);

      const trailStartX = event.x - event.direction * event.size * .16;
      const trailEndX = event.x - event.direction * event.size * (Math.abs(event.vx) > 2 ? 3.4 : 2.35);
      const trail = ctx.createLinearGradient(trailStartX, event.y, trailEndX, event.y);
      trail.addColorStop(0, palette.trailA);
      trail.addColorStop(.28, palette.trailB);
      trail.addColorStop(1, palette.trailC);
      ctx.globalAlpha = .7;
      ctx.strokeStyle = trail;
      ctx.lineWidth = Math.max(2, event.size * (Math.abs(event.vx) > 2 ? .34 : .28));
      ctx.beginPath();
      ctx.moveTo(trailStartX, event.y);
      ctx.lineTo(trailEndX, event.y + Math.sin(event.age * .04) * event.size * .12);
      ctx.stroke();

      event.fragments.forEach(fragment => {
        fragment.prevX = fragment.x;
        fragment.prevY = fragment.y;
        fragment.x += fragment.vx;
        fragment.y += fragment.vy;
        fragment.vx *= .993;
        fragment.vy += .0015;
        fragment.rotation += fragment.spin;
        fragment.alpha *= .984;
        drawFragment(fragment);
      });
      event.fragments = event.fragments.filter(fragment =>
        fragment.alpha > .04 &&
        fragment.x > -50 &&
        fragment.x < width + 120 &&
        fragment.y > -60 &&
        fragment.y < height + 70
      );

      drawDebrisShape(event, .9);

      const leftView = event.direction > 0
        ? event.x > width + event.size * 2
        : event.x < -event.size * 2;
      if (leftView && event.fragments.length === 0) debrisEvents.splice(i, 1);
    }

    ctx.globalAlpha = 1;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    stars.length = 0;
    dust.length = 0;
    debrisEvents.length = 0;
    nextDebrisAt = performance.now() + randomBetween(10000, 20000);
    for (let i = 0; i < 54; i++) {
      const star = {};
      resetStar(star);
      stars.push(star);
    }
    for (let i = 0; i < 10; i++) {
      const particle = {};
      resetDust(particle);
      dust.push(particle);
    }
  }

  function draw(now = performance.now()) {
    ctx.fillStyle = 'rgba(0, 0, 0, .42)';
    ctx.fillRect(0, 0, width, height);

    stars.forEach(star => {
      star.x -= star.speed;
      star.alpha += star.twinkle;
      if (star.alpha > .62 || star.alpha < .12) star.twinkle *= -1;
      if (star.x < -4) resetStar(star, true);

      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = '#F7FFC3';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });

    dust.forEach(particle => {
      particle.prevX = particle.x;
      particle.prevY = particle.y;
      particle.x -= particle.speed;
      particle.y += Math.sin((particle.x + particle.y) * .014) * .045 + particle.drift;
      if (particle.x < -12 || particle.y < -10 || particle.y > height + 10) resetDust(particle, true);

      ctx.globalAlpha = particle.alpha * .36;
      ctx.strokeStyle = particle.warm ? '#FA5A1F' : '#F7FFC3';
      ctx.lineWidth = Math.max(1, particle.r * .65);
      ctx.beginPath();
      ctx.moveTo(particle.prevX + particle.r * 5, particle.prevY);
      ctx.lineTo(particle.x, particle.y);
      ctx.stroke();

      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.warm ? '#FA5A1F' : '#F7FFC3';
      ctx.fillRect(particle.x, particle.y, particle.r, particle.r);
    });

    updateDebris(now);

    ctx.globalAlpha = 1;
    if (!prefersReducedMotion) requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
}

function startAmbientDust() {
  const canvas = document.getElementById('ambient-dust');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motes = [];
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastTime = performance.now();

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function resetMote(mote, randomLife = false) {
    mote.x = randomBetween(width * .05, width * .95);
    mote.y = randomBetween(height * .08, height * .92);
    mote.baseX = mote.x;
    mote.baseY = mote.y;
    mote.size = Math.random() > .78 ? randomBetween(1.4, 2.6) : randomBetween(.7, 1.45);
    mote.life = randomLife ? randomBetween(0, 1) : 0;
    mote.lifeSpeed = randomBetween(.04, .095);
    mote.driftX = randomBetween(-1.1, 1.1);
    mote.driftY = randomBetween(-.2, .9);
    mote.flicker = randomBetween(.65, 1.25);
    mote.warm = Math.random() > .86;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    motes.length = 0;
    const count = Math.max(120, Math.round((width * height) / 7600));
    for (let i = 0; i < count; i++) {
      const mote = {};
      resetMote(mote, true);
      motes.push(mote);
    }
  }

  function draw(now = performance.now()) {
    const delta = Math.min((now - lastTime) / 1000, .05);
    lastTime = now;
    ctx.clearRect(0, 0, width, height);

    motes.forEach(mote => {
      mote.life += mote.lifeSpeed * delta;
      if (mote.life >= 1) resetMote(mote);

      const fade = Math.sin(mote.life * Math.PI);
      const ceilingGlow = 1 - Math.min(1, Math.abs(mote.x - width * .5) / (width * .28));
      const heightGlow = 1 - Math.min(1, Math.abs(mote.y - height * .2) / (height * .34));
      const lightBoost = 1 + Math.max(0, ceilingGlow * heightGlow) * 1.75;
      const shimmer = .72 + Math.sin((now * .0012 + mote.baseX * .01) * mote.flicker) * .28;
      const alpha = fade * shimmer * .31 * lightBoost;

      mote.x = mote.baseX + Math.sin(now * .00018 + mote.baseY) * 5 + mote.driftX * mote.life * 10;
      mote.y = mote.baseY + mote.driftY * mote.life * 14;

      ctx.globalAlpha = Math.min(.62, Math.max(0, alpha));
      ctx.fillStyle = mote.warm ? '#FA5A1F' : '#F7FFC3';
      ctx.fillRect(Math.round(mote.x), Math.round(mote.y), mote.size, mote.size);
    });

    ctx.globalAlpha = 1;
    if (!prefersReducedMotion) requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
}

function startRoomFly() {
  const canvas = document.getElementById('room-fly');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fly = {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    targetX: 0,
    targetY: 0,
    size: 3,
    life: 0,
    maxLife: 0,
    nextAt: performance.now() + 2200,
    buzzTick: 0,
    trail: []
  };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastTime = performance.now();

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickTarget() {
    fly.targetX = randomBetween(width * .18, width * .82);
    fly.targetY = randomBetween(height * .18, height * .7);
  }

  function spawnFly(now) {
    const fromLeft = Math.random() > .5;
    fly.active = true;
    fly.x = fromLeft ? -18 : width + 18;
    fly.y = randomBetween(height * .22, height * .68);
    fly.prevX = fly.x;
    fly.prevY = fly.y;
    fly.vx = (fromLeft ? 1 : -1) * randomBetween(52, 82);
    fly.vy = randomBetween(-18, 18);
    fly.size = randomBetween(3, 4.5);
    fly.life = 0;
    fly.maxLife = randomBetween(8, 14);
    fly.buzzTick = 0;
    fly.trail.length = 0;
    pickTarget();
    fly.nextAt = now + randomBetween(16000, 26000);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateFly(delta, now) {
    if (!fly.active) {
      if (now >= fly.nextAt) spawnFly(now);
      return;
    }

    fly.life += delta;
    fly.prevX = fly.x;
    fly.prevY = fly.y;

    if (Math.random() < .055 || Math.abs(fly.x - fly.targetX) < 22) pickTarget();

    const steerX = (fly.targetX - fly.x) * .86;
    const steerY = (fly.targetY - fly.y) * 1.15;
    const jitterX = Math.sin(now * .026) * 28 + randomBetween(-18, 18);
    const jitterY = Math.cos(now * .031) * 24 + randomBetween(-20, 20);

    fly.vx += (steerX + jitterX) * delta;
    fly.vy += (steerY + jitterY) * delta;
    fly.vx = Math.max(-120, Math.min(120, fly.vx));
    fly.vy = Math.max(-95, Math.min(95, fly.vy));

    fly.x += fly.vx * delta;
    fly.y += fly.vy * delta;
    fly.buzzTick += 1;
    const buzzLabel = fly.buzzTick % 5 === 0
      ? ['bbzzzzzzzzz', 'bzzz', 'bzz'][Math.floor((fly.buzzTick / 5) % 3)]
      : '';
    fly.trail.push({
      x: fly.prevX,
      y: fly.prevY,
      alpha: .28,
      size: fly.size,
      label: buzzLabel,
      angle: Math.atan2(fly.prevY - fly.y, fly.prevX - fly.x),
      jitter: randomBetween(-3, 3)
    });
    if (fly.trail.length > 22) fly.trail.shift();

    const leftRoom = fly.x < -34 || fly.x > width + 34 || fly.y < height * .06 || fly.y > height * .82;
    if (fly.life > fly.maxLife || leftRoom) {
      fly.active = false;
      fly.trail.length = 0;
    }
  }

  function drawFly() {
    fly.trail.forEach((point, index) => {
      point.alpha *= .86;
      const trailLife = index / Math.max(1, fly.trail.length);
      ctx.globalAlpha = point.alpha * trailLife;
      ctx.fillStyle = '#020201';
      ctx.fillRect(Math.round(point.x), Math.round(point.y), Math.max(1, point.size - 1), Math.max(1, point.size - 1));

      if (point.label) {
        ctx.save();
        ctx.translate(point.x - Math.cos(point.angle) * 8, point.y + point.jitter);
        ctx.rotate(point.angle + Math.sin(index * .7) * .08);
        ctx.globalAlpha = point.alpha * trailLife * .82;
        ctx.fillStyle = '#030301';
        ctx.font = '9px "Pixelify Sans", monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(point.label, 0, 0);
        ctx.restore();
      }
    });

    if (!fly.active) return;

    ctx.globalAlpha = .24;
    ctx.strokeStyle = '#020201';
    ctx.lineWidth = Math.max(1, fly.size * .7);
    ctx.beginPath();
    ctx.moveTo(fly.prevX, fly.prevY);
    ctx.lineTo(fly.x, fly.y);
    ctx.stroke();

    ctx.globalAlpha = .92;
    ctx.fillStyle = '#010101';
    const x = Math.round(fly.x);
    const y = Math.round(fly.y);
    const s = Math.round(fly.size);
    ctx.fillRect(x, y, s, s);
    ctx.fillRect(x - 2, y + 1, 2, 2);
    ctx.fillRect(x + s, y + 1, 2, 2);

    ctx.globalAlpha = .28;
    ctx.fillStyle = '#0b0b08';
    ctx.fillRect(x - 1, y - 2, 2, 1);
    ctx.fillRect(x + s - 1, y - 2, 2, 1);
  }

  function draw(now = performance.now()) {
    const delta = Math.min((now - lastTime) / 1000, .05);
    lastTime = now;
    ctx.clearRect(0, 0, width, height);
    updateFly(delta, now);
    drawFly();
    ctx.globalAlpha = 1;
    if (!prefersReducedMotion) requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
}

function setShipScene(room) {
  if (!shipScene) return;

  const isPont = room === 'PONT PRINCIPAL';
  const isQuarters = room === 'QUARTIERS';
  const scene = isPont ? 'pont' : isQuarters ? 'quarters' : 'sas';
  const previousScene = shipScene.dataset.roomScene || 'sas';
  const changed = previousScene !== scene;

  shipScene.dataset.roomScene = scene;
  shipScene.classList.toggle('is-room-pont', isPont);
  shipScene.classList.toggle('is-room-quarters', isQuarters);
  shipScene.classList.toggle('is-room-sas', !isPont && !isQuarters);
  syncSceneBackdropImage();
  shipScene.setAttribute(
    'aria-label',
    isPont
      ? 'Pont principal du MOTOMOTO'
      : isQuarters
        ? 'Quartiers du MOTOMOTO'
        : 'Sas expedition du MOTOMOTO'
  );

  if (bridgeMeta) {
    bridgeMeta.textContent = isPont
      ? `MOTOMOTO // PONT PRINCIPAL // ${activePontRepairState.label.toUpperCase()} // ${activePontRepairState.detail.toUpperCase()}`
      : isQuarters
        ? 'MOTOMOTO // QUARTIERS // BAIE OBSERVATION'
        : 'MOTOMOTO // SAS EXPEDITION // SALVAGE PROTOCOL';
  }

  if (changed) {
    const transitionClass = previousScene === 'pont' && scene === 'sas'
      ? 'is-stepping-forward'
      : 'is-stepping-back';
    shipScene.classList.remove('is-stepping-back');
    shipScene.classList.remove('is-stepping-forward');
    void shipScene.offsetWidth;
    shipScene.classList.add(transitionClass);
    window.setTimeout(() => shipScene.classList.remove(transitionClass), 900);
  }
  queuePresenceBroadcast();
}

function getHullState(condition, hullIntegrity) {
  const integrity = Number(hullIntegrity);
  if (condition === 'repaired' || integrity >= 85) return 'stable';
  if (condition === 'repairing' || integrity >= 35) return 'repairing';
  return 'critical';
}

function setShipCondition(condition, hullIntegrity) {
  if (!shipScene) return;
  const hullState = getHullState(condition, hullIntegrity);
  const isCritical = hullState === 'critical';
  const isRepairing = hullState === 'repairing';
  const isStable = hullState === 'stable';

  shipScene.dataset.shipCondition = hullState;
  shipScene.dataset.hullState = hullState;
  shipScene.classList.toggle('is-ship-critical', isCritical);
  shipScene.classList.toggle('is-ship-repairing', isRepairing);
  shipScene.classList.toggle('is-ship-repaired', isStable);
  if (!isCritical) shipScene.classList.remove('is-ship-shaking');

  if (hullStatus) {
    hullStatus.classList.toggle('is-repairing', isRepairing);
    hullStatus.classList.toggle('is-stable', isStable);
    hullStatus.classList.toggle('hull-alert', !isStable);
    hullStatus.textContent = isCritical
      ? 'ENDOMMAGÉ - ETAT CRITIQUE'
      : isRepairing
        ? 'EN REPARATION - ETAT INSTABLE'
        : 'STABLE - ETAT NORMAL';
  }
}

function startCriticalShipShakes() {
  if (!shipScene) return;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  function scheduleNextShake() {
    const delay = 4600 + Math.random() * 7600;
    window.setTimeout(() => {
      if (shipScene.classList.contains('is-ship-critical')) {
        shipScene.classList.remove('is-ship-shaking');
        void shipScene.offsetWidth;
        shipScene.classList.add('is-ship-shaking');
        window.setTimeout(() => shipScene.classList.remove('is-ship-shaking'), 720);
      }
      scheduleNextShake();
    }, delay);
  }

  scheduleNextShake();
}

function setPontRepairState(stateId) {
  if (!shipScene) return;
  const nextState = pontRepairStates.find(state => state.id === stateId || String(state.stage) === String(stateId));
  if (!nextState) return;

  activePontRepairState = nextState;
  shipScene.dataset.pontRepairState = nextState.id;
  shipScene.style.setProperty('--pont-scene-image', `url('${nextState.image}')`);
  syncSceneBackdropImage();
  setShipCondition(nextState.condition, nextState.hullIntegrity);

  if (shipScene.dataset.roomScene === 'pont' && bridgeMeta) {
    bridgeMeta.textContent = `MOTOMOTO // PONT PRINCIPAL // ${nextState.label.toUpperCase()} // ${nextState.detail.toUpperCase()}`;
  }
}

function initPontRepairState() {
  const params = new URLSearchParams(window.location.search);
  const requestedState = params.get('pontState') || params.get('pont');
  setPontRepairState(requestedState || activePontRepairState.id);
  window.setPontRepairState = setPontRepairState;
}

function initHudCollapse() {
  const windows = Array.from(document.querySelectorAll('[data-hud-window]'));
  const dockButtons = Array.from(document.querySelectorAll('[data-hud-dock-toggle]'));
  const storageKey = 'areciboCollapsedHud';
  let saved = {};

  try {
    saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {};
  } catch (err) {
    saved = {};
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
    catch (err) {}
  }

  function setCollapsed(panel, collapsed) {
    const id = panel.dataset.hudWindow;
    const toggle = panel.querySelector('[data-hud-toggle]');
    const dockToggle = dockButtons.find(button => button.dataset.hudDockToggle === id);
    const isMap = id === 'map';
    panel.classList.toggle('is-collapsed', collapsed);
    panel.setAttribute('aria-expanded', String(!collapsed));

    if (toggle) {
      const label = collapsed
        ? `Ouvrir ${isMap ? 'la carte du vaisseau' : 'le systeme vaisseau'}`
        : `Reduire ${isMap ? 'le plan du vaisseau' : 'systeme vaisseau'}`;
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }

    if (dockToggle) {
      const dockLabel = collapsed
        ? `Ouvrir ${isMap ? 'le plan vaisseau' : 'le systeme vaisseau'}`
        : `Reduire ${isMap ? 'le plan vaisseau' : 'le systeme vaisseau'}`;
      dockToggle.classList.toggle('is-open', !collapsed);
      dockToggle.setAttribute('aria-pressed', String(!collapsed));
      dockToggle.setAttribute('aria-label', dockLabel);
      dockToggle.title = dockLabel;
    }

    saved[id] = collapsed;
    persist();
  }

  windows.forEach(panel => {
    const id = panel.dataset.hudWindow;
    const toggle = panel.querySelector('[data-hud-toggle]');
    setCollapsed(panel, Boolean(saved[id]));

    if (toggle) {
      toggle.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        setCollapsed(panel, !panel.classList.contains('is-collapsed'));
      });
    }

    panel.addEventListener('click', event => {
      if (!panel.classList.contains('is-collapsed')) return;
      event.preventDefault();
      setCollapsed(panel, false);
    });
  });

  dockButtons.forEach(button => {
    const id = button.dataset.hudDockToggle;
    const panel = windows.find(item => item.dataset.hudWindow === id);
    if (!panel) return;

    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setCollapsed(panel, !panel.classList.contains('is-collapsed'));
    });
  });
}

function initShipMap() {
  const roomNodes = Array.from(document.querySelectorAll('.room-node'));
  const roomToHash = room => room.toLowerCase().replace(/\s+/g, '-');

  roomNodes.forEach(node => {
    node.addEventListener('click', () => {
      const room = node.dataset.room || 'ZONE INCONNUE';
      const locked = node.dataset.state === 'locked';

      roomNodes.forEach(item => item.classList.remove('warn'));

      if (locked) {
        node.classList.add('warn');
        roomState.classList.remove('active');
        roomState.classList.add('warn');
        roomState.textContent = 'BLOQUE';
        roomCurrent.textContent = room;
        mapMessage.textContent = `${room} : acces verrouille pour le prototype.`;
        mapMessage.classList.add('warn');
        return;
      }

      roomNodes.forEach(item => item.classList.remove('active'));
      node.classList.add('active');
      roomState.classList.remove('warn');
      roomState.classList.add('active');
      roomState.textContent = 'ACTIF';
      roomCurrent.textContent = room;
      mapMessage.classList.remove('warn');
      mapMessage.textContent = room === 'SAS EXPEDITION'
        ? 'Sas expedition actif : depart possible depuis le bouton central.'
        : room === 'QUARTIERS'
          ? 'Quartiers actifs : baie d observation ouverte sur le ciel etoile.'
          : `Pont principal selectionne : ${activePontRepairState.label.toLowerCase()}, ${activePontRepairState.detail}.`;
      setShipScene(room);
      window.location.hash = roomToHash(room);
    });
  });

  const initialHash = window.location.hash.replace(/^#/, '');
  if (initialHash) {
    const initialNode = roomNodes.find(node => {
      const room = node.dataset.room || '';
      return node.dataset.state !== 'locked' && roomToHash(room) === initialHash;
    });
    if (initialNode) initialNode.click();
  }
}

function initDraggablePersonalWindow() {
  if (!personalWindow || !personalTitle) return;

  const storageKey = 'areciboPersonalWindowPosition';
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let dragging = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function setPosition(left, top, save = false) {
    const rect = personalWindow.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const nextLeft = clamp(left, margin, maxLeft);
    const nextTop = clamp(top, margin, maxTop);

    personalWindow.style.left = `${nextLeft}px`;
    personalWindow.style.top = `${nextTop}px`;
    personalWindow.style.right = 'auto';
    personalWindow.style.bottom = 'auto';

    if (save) {
      localStorage.setItem(storageKey, JSON.stringify({ left: nextLeft, top: nextTop }));
    }
  }

  function restorePosition() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const position = JSON.parse(saved);
      if (Number.isFinite(position.left) && Number.isFinite(position.top)) {
        requestAnimationFrame(() => setPosition(position.left, position.top));
      }
    } catch (error) {
      localStorage.removeItem(storageKey);
    }
  }

  personalTitle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;

    const rect = personalWindow.getBoundingClientRect();
    dragging = true;
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    personalWindow.classList.add('is-dragging');
    personalTitle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  personalTitle.addEventListener('pointermove', event => {
    if (!dragging) return;
    setPosition(event.clientX - dragOffsetX, event.clientY - dragOffsetY);
  });

  function stopDragging(event) {
    if (!dragging) return;
    dragging = false;
    personalWindow.classList.remove('is-dragging');
    setPosition(personalWindow.getBoundingClientRect().left, personalWindow.getBoundingClientRect().top, true);
    if (personalTitle.hasPointerCapture(event.pointerId)) {
      personalTitle.releasePointerCapture(event.pointerId);
    }
  }

  personalTitle.addEventListener('pointerup', stopDragging);
  personalTitle.addEventListener('pointercancel', stopDragging);
  window.addEventListener('resize', () => {
    const rect = personalWindow.getBoundingClientRect();
    setPosition(rect.left, rect.top, true);
  });

  restorePosition();
}

function sanitizeSignalSession(value) {
  return String(value || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
}

function ensureLandingSignalSession() {
  if (landingSignalSessionId) return landingSignalSessionId;
  landingSignalSessionId = sanitizeSignalSession(params.get('signalSession'))
    || `impact-${Math.random().toString(36).slice(2, 8)}`;
  return landingSignalSessionId;
}

function getLandingSignalState() {
  const session = ensureLandingSignalSession();
  return localStorage.getItem(`arecibo:minigame-signal-state:${session}`) || 'idle';
}

function setLandingSignalState(state) {
  const session = ensureLandingSignalSession();
  localStorage.setItem(`arecibo:minigame-signal-state:${session}`, state);
}

function formatExpeditionTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function setExpeditionTimerDisplay(ms) {
  const display = formatExpeditionTime(ms);
  if (expeditionTimerValue) expeditionTimerValue.textContent = display;
  if (airlockTimer) airlockTimer.textContent = display;

  if (expeditionTimerHud) {
    expeditionTimerHud.classList.toggle('is-warning', ms <= 60000 && ms > 0);
  }
}

function stopExpeditionTimer(options = {}) {
  const { resetDisplay = true, keepVisible = false } = options;
  if (expeditionTimerInterval) {
    window.clearInterval(expeditionTimerInterval);
    expeditionTimerInterval = 0;
  }
  expeditionTimerDeadline = 0;

  if (expeditionTimerHud) {
    expeditionTimerHud.classList.remove('is-warning');
    expeditionTimerHud.classList.toggle('is-visible', keepVisible);
  }

  if (resetDisplay) {
    setExpeditionTimerDisplay(expeditionDurationMs);
  }
}

function clearLandingSequenceTimers() {
  landingSequenceTimers.forEach(timerId => window.clearTimeout(timerId));
  landingSequenceTimers = [];
}

function initDebrisBackdropScene() {
  if (!debrisStarCanvas || !debrisParticleCanvas || !debrisScene) return;
  const starCtx = debrisStarCanvas.getContext('2d');
  const particleCtx = debrisParticleCanvas.getContext('2d');
  if (!starCtx || !particleCtx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let particles = [];

  function resizeCanvas(canvas, ctx) {
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seedStars() {
    const count = Math.max(90, Math.round((width * height) / 8500));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.82 ? 1 : 1.6 + Math.random() * 1.8,
      alpha: .22 + Math.random() * .64,
      twinkle: .4 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - .5) * .02
    }));
  }

  function seedParticles() {
    const count = Math.max(16, Math.round((width * height) / 42000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1 + Math.random() * 2.4,
      vx: -.04 + Math.random() * .08,
      vy: -.025 + Math.random() * .05,
      alpha: .08 + Math.random() * .16,
      tone: Math.random() < .6 ? '247,255,195' : '186,162,126'
    }));
  }

  function resize() {
    const rect = debrisScene.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width || window.innerWidth));
    height = Math.max(1, Math.round(rect.height || window.innerHeight));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resizeCanvas(debrisStarCanvas, starCtx);
    resizeCanvas(debrisParticleCanvas, particleCtx);
    seedStars();
    seedParticles();
  }

  function render(now) {
    const time = now * 0.001;
    starCtx.clearRect(0, 0, width, height);
    particleCtx.clearRect(0, 0, width, height);

    for (const star of stars) {
      star.x += star.drift;
      if (star.x < -4) star.x = width + 4;
      if (star.x > width + 4) star.x = -4;

      const pulse = .76 + Math.sin(time * star.twinkle + star.phase) * .24;
      const alpha = Math.max(.08, Math.min(1, star.alpha * pulse));
      starCtx.globalAlpha = alpha;
      starCtx.fillStyle = star.size > 1.5 ? '#fff4cf' : '#f7ffc3';
      starCtx.fillRect(Math.round(star.x), Math.round(star.y), star.size, star.size);
      if (star.size > 1.5) {
        starCtx.fillRect(Math.round(star.x - 1), Math.round(star.y), 1, 1);
        starCtx.fillRect(Math.round(star.x + star.size), Math.round(star.y), 1, 1);
      }
    }

    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < -10) particle.x = width + 10;
      if (particle.x > width + 10) particle.x = -10;
      if (particle.y < -10) particle.y = height + 10;
      if (particle.y > height + 10) particle.y = -10;

      particleCtx.globalAlpha = particle.alpha;
      particleCtx.fillStyle = `rgba(${particle.tone},1)`;
      particleCtx.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
      particleCtx.fillRect(
        Math.round(particle.x - particle.vx * 22),
        Math.round(particle.y - particle.vy * 22),
        Math.max(1, particle.size - .7),
        Math.max(1, particle.size - .7)
      );
    }

    starCtx.globalAlpha = 1;
    particleCtx.globalAlpha = 1;
    requestAnimationFrame(render);
  }

  resize();
  window.addEventListener('resize', resize, { passive:true });
  requestAnimationFrame(render);
}

function openDebrisInspectionScene() {
  if (!landingSequence || !debrisScene) return;

  if (!landingStarted) {
    landingStarted = true;
    landingSequence.classList.add('is-active');
    landingSequence.setAttribute('aria-hidden', 'false');
    startExpeditionTimer();
  }

  landingSequence.classList.add('is-debris-view');
  debrisScene.classList.add('is-active');
  debrisScene.setAttribute('aria-hidden', 'false');
  if (mapMessage) {
    mapMessage.classList.remove('warn');
    mapMessage.textContent = 'Inspection des debris active : progression lente au milieu des epaves.';
  }
  queuePresenceBroadcast();
}

function closeDebrisInspectionScene() {
  if (!landingSequence || !debrisScene) return;
  landingSequence.classList.remove('is-debris-view');
  debrisScene.classList.remove('is-active');
  debrisScene.setAttribute('aria-hidden', 'true');
  queuePresenceBroadcast();
}

function hideExpeditionResult() {
  expeditionResultPending = null;
  if (!landingSequence || !expeditionResultOverlay) return;
  landingSequence.classList.remove('is-result-open');
  expeditionResultOverlay.setAttribute('aria-hidden', 'true');
}

function showExpeditionResult(state, options = {}) {
  if (!landingSequence || !expeditionResultOverlay || !expeditionResultCard) return;

  const isFailure = state === 'failure';
  const config = isFailure
    ? {
        kicker: options.kicker || 'Expedition echouee',
        reason: options.reason || 'Temps ecoule // extraction perdue',
        border:'assets/expedition-result/failure/panel-border.svg',
        separator:'assets/expedition-result/failure/separator.svg',
        buttonBg:'assets/expedition-result/failure/button-bg.svg',
        returnOptions: options.returnOptions || {
          message:'Echec extraction : recuperation impossible. Retour force au vaisseau, trouvailles perdues.',
          isFailure:true
        }
      }
    : {
        kicker: options.kicker || 'Expedition validee',
        reason: options.reason || 'Retour securise // transfert des ressources en cours',
        border:'assets/expedition-result/success/panel-border.svg',
        separator:'assets/expedition-result/success/separator.svg',
        buttonBg:'assets/expedition-result/success/button-bg.svg',
        returnOptions: options.returnOptions || {
          message:'Expedition validee : ressources chargees, retour au MOTOMOTO en cours.',
          isFailure:false
        }
      };

  stopExpeditionTimer({ resetDisplay:false, keepVisible:false });
  closeDebrisInspectionScene();
  clearLandingTypingTimers();
  clearLandingSequenceTimers();

  expeditionResultPending = {
    returnOptions:config.returnOptions,
    afterReturn:typeof options.afterReturn === 'function' ? options.afterReturn : null
  };

  landingSequence.classList.add('is-active', 'is-hovering', 'is-result-open');
  landingSequence.setAttribute('aria-hidden', 'false');
  if (landingDecision) {
    landingDecision.classList.remove('is-copy-ready', 'is-module-open');
  }

  expeditionResultCard.dataset.state = state;
  if (expeditionResultBorder) expeditionResultBorder.src = config.border;
  if (expeditionResultSeparator) expeditionResultSeparator.src = config.separator;
  if (expeditionResultActionBg) expeditionResultActionBg.src = config.buttonBg;
  if (expeditionResultKicker) expeditionResultKicker.textContent = config.kicker;
  if (expeditionResultReason) expeditionResultReason.textContent = config.reason;
  if (expeditionResultScroll) {
    expeditionResultScroll.scrollTop = 0;
    updateExpeditionResultNav();
  }
  expeditionResultOverlay.setAttribute('aria-hidden', 'false');
}

function resetLandingSequenceState() {
  clearLandingTypingTimers();
  clearLandingSequenceTimers();
  stopLandingConsoleHold();
  hideExpeditionResult();
  closeDebrisInspectionScene();

  if (landingSequence) {
    landingSequence.classList.remove('is-question-open', 'is-hovering', 'is-active', 'is-result-open');
    landingSequence.setAttribute('aria-hidden', 'true');
  }

  if (landingDecision) {
    landingDecision.classList.remove('is-copy-ready', 'is-module-open');
  }

  if (landingDecisionOptions) landingDecisionOptions.innerHTML = '';
  if (landingDecisionModule) landingDecisionModule.innerHTML = '';
  if (landingAlertText) landingAlertText.textContent = '';
  if (landingHeadText) landingHeadText.textContent = '';
  if (landingConsoleScroll) {
    landingConsoleScroll.scrollTop = 0;
    updateLandingConsoleNav();
  }

  if (landingResizeHandler) {
    window.removeEventListener('resize', landingResizeHandler);
    landingResizeHandler = null;
  }

  landingStarted = false;
  landingDecisionStage = 'impact';
  landingDecisionChoices = landingDecisionStages.impact.choices;
  resetLandingVotes();
  landingSignalSessionId = '';
  queuePresenceBroadcast();
}

function syncShipRoomState(room, message, isWarning = false) {
  const roomNodes = Array.from(document.querySelectorAll('.room-node'));
  roomNodes.forEach(node => {
    node.classList.toggle('active', (node.dataset.room || '') === room);
    node.classList.remove('warn');
  });

  if (roomCurrent) roomCurrent.textContent = room;
  if (roomState) {
    roomState.classList.toggle('warn', isWarning);
    roomState.classList.toggle('active', !isWarning);
    roomState.textContent = isWarning ? 'ALERTE' : 'ACTIF';
  }
  if (mapMessage) {
    mapMessage.classList.toggle('warn', isWarning);
    mapMessage.textContent = message;
  }
  window.location.hash = room.toLowerCase().replace(/\s+/g, '-');
}

function returnToShipFromExpedition(options = {}) {
  const {
    message = 'Sas expedition actif : depart possible depuis le bouton central.',
    isFailure = false
  } = options;

  stopExpeditionTimer();
  resetLandingSequenceState();
  setExpeditionActive(false);
  setShipScene('SAS EXPEDITION');
  syncShipRoomState('SAS EXPEDITION', message, isFailure);
  updateReadyState();
}

function openSasRepairOverlay(event) {
  if (event) event.preventDefault();
  if (!sasRepairOverlay) return;
  sasRepairOverlay.classList.add('is-open');
  sasRepairOverlay.setAttribute('aria-hidden', 'false');
  if (mapMessage) {
    mapMessage.classList.remove('warn');
    mapMessage.textContent = 'Tableau du sas ouvert : inspectez les fils et preparez la reparation.';
  }
}

function closeSasRepairOverlay(event) {
  if (!sasRepairOverlay) return;
  if (event && event.target !== sasRepairOverlay && event.target !== sasRepairClose) return;
  sasRepairOverlay.classList.remove('is-open');
  sasRepairOverlay.setAttribute('aria-hidden', 'true');
}

sasWireHitboxes.forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    handleSasWireCut(button.dataset.wireColor || '');
  });
});

function failExpeditionFromTimeout() {
  if (expeditionFailing) return;
  expeditionFailing = true;

  stopExpeditionTimer({ resetDisplay:false, keepVisible:true });
  setExpeditionTimerDisplay(0);
  showExpeditionResult('failure', {
    kicker:'Expedition echouee',
    reason:'Temps ecoule // retour d urgence vers le MOTOMOTO',
    returnOptions:{
      message:'Echec extraction : temps ecoule. Retour force au vaisseau, trouvailles perdues.',
      isFailure:true
    },
    afterReturn:() => {
      if (storyPhase === 'opening-expedition') setStoryPhase('opening-briefing');
      expeditionFailing = false;
    }
  });
}

function startExpeditionTimer(durationMs = expeditionDurationMs) {
  stopExpeditionTimer({ resetDisplay:false });
  expeditionTimerDeadline = Date.now() + durationMs;
  expeditionFailing = false;
  if (expeditionTimerHud) expeditionTimerHud.classList.add('is-visible');

  const tick = () => {
    const remaining = expeditionTimerDeadline - Date.now();
    if (remaining <= 0) {
      setExpeditionTimerDisplay(0);
      failExpeditionFromTimeout();
      return;
    }
    setExpeditionTimerDisplay(remaining);
  };

  tick();
  expeditionTimerInterval = window.setInterval(tick, 250);
}

function resetLandingVotes() {
  for (let i = 0; i < landingVotes.length; i += 1) landingVotes[i] = null;
  landingVoteCursor = 0;
}

function goToLandingDecisionStage(stageId) {
  const stage = landingDecisionStages[stageId];
  if (!stage) return;
  closeDebrisInspectionScene();
  landingDecisionStage = stageId;
  landingDecisionChoices = stage.choices;
  resetLandingVotes();
  renderLandingDecision();
  startLandingDecisionTyping();
  queuePresenceBroadcast();
}

function renderCrew() {
  crewEl.innerHTML = '';
  readyState.forEach((ready, index) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'crew-slot';
    slot.textContent = `P${index + 1}`;

    if (index >= playerCount) {
      slot.classList.add('disabled');
      slot.setAttribute('aria-disabled', 'true');
    } else {
      slot.classList.toggle('ready', ready);
      slot.setAttribute('aria-pressed', String(ready));
      slot.addEventListener('click', () => {
        readyState[index] = !readyState[index];
        updateReadyState();
      });
    }

    crewEl.appendChild(slot);
    if (index === 0 && index < playerCount) {
      injectPlayerAvatar(slot, {
        className: 'crew-slot-avatar',
        label: `profil ${window.areciboPlayerName || 'joueur'}`
      });
    }
  });
}

function updateReadyState() {
  const activeReady = readyState.slice(0, playerCount);
  const allReady = activeReady.every(Boolean);
  const isOpeningMission = storyPhase === 'opening-briefing' || storyPhase === 'opening-expedition';
  launchBtn.classList.toggle('ready', allReady && !isOpeningMission);

  if (storyPhase === 'opening-return') {
    launchIcon.textContent = '!';
    launchLabel.textContent = 'REPARER LE SAS';
    renderCrew();
    return;
  }

  if (isOpeningMission) {
    launchIcon.textContent = allReady ? 'OK' : '+';
    launchLabel.textContent = allReady ? 'SORTIR DANS LES DEBRIS' : 'SORTIE D URGENCE';
    renderCrew();
    return;
  }

  launchIcon.textContent = allReady ? 'OK' : '+';
  launchLabel.textContent = allReady ? 'EQUIPE PRETE' : 'LANCER L\'EXPEDITION';
  renderCrew();
}

function setPersonalPackageDetached(detached) {
  if (!personalWindow || !personalWindowHomeParent) return;

  if (detached) {
    if (personalWindow.parentNode !== document.body) {
      document.body.appendChild(personalWindow);
    }
    personalWindow.classList.add('is-detached');
    return;
  }

  if (personalWindow.parentNode !== personalWindowHomeParent) {
    if (personalWindowHomeNextSibling && personalWindowHomeNextSibling.parentNode === personalWindowHomeParent) {
      personalWindowHomeParent.insertBefore(personalWindow, personalWindowHomeNextSibling);
    } else {
      personalWindowHomeParent.appendChild(personalWindow);
    }
  }
  personalWindow.classList.remove('is-detached');
}

function setExpeditionActive(active) {
  if (shipScene) shipScene.classList.toggle('is-expedition-active', active);
  setPersonalPackageDetached(active);
  if (personalWindow) personalWindow.classList.toggle('is-expedition-mode', active);
  if (expeditionTimerHud && !active) expeditionTimerHud.classList.remove('is-visible', 'is-warning');

  if (personalHudDock) {
    personalHudDock.setAttribute('aria-hidden', String(active));
    personalHudDock.querySelectorAll('button').forEach(button => {
      if (active) {
        button.setAttribute('tabindex', '-1');
      } else {
        button.removeAttribute('tabindex');
      }
    });
  }

  if (messageIndicator) {
    messageIndicator.setAttribute('aria-hidden', String(active));
    if (active) {
      messageIndicator.setAttribute('tabindex', '-1');
      if (typeof closeMessages === 'function') closeMessages();
    } else {
      messageIndicator.removeAttribute('tabindex');
    }
  }
  queuePresenceBroadcast();
}

function renderLandingDecision() {
  if (!landingDecisionOptions || !landingDecision) return;
  landingDecisionOptions.innerHTML = '';

  const inspectSelected = landingDecisionStage === 'impact'
    && landingVotes.slice(0, playerCount).some(vote => vote === 'inspect-asteroid' || vote === 'inspect-debris');

  landingDecisionChoices.forEach(choice => {
    const row = document.createElement('div');
    row.className = 'decision-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'decision-btn';
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      if (choice.id === 'inspect-debris') {
        openDebrisInspectionScene();
        return;
      }
      if (playerCount <= 1) {
        landingVotes[0] = choice.id;
      } else {
        landingVotes[landingVoteCursor] = choice.id;
        landingVoteCursor = (landingVoteCursor + 1) % playerCount;
      }
      renderLandingDecision();
    });

    const votes = [];
    for (let i = 0; i < playerCount; i += 1) {
      if (landingVotes[i] === choice.id) votes.push(`P${i + 1}`);
    }

    if (votes.length) row.classList.add('has-votes');

    const voteWrap = document.createElement('div');
    voteWrap.className = 'decision-votes';
    if (!votes.length) voteWrap.classList.add('is-empty');

    votes.forEach(vote => {
      const chip = document.createElement('span');
      chip.className = 'decision-vote';
      if (vote === 'P1') {
        chip.classList.add('has-avatar');
        chip.textContent = '';
        injectPlayerAvatar(chip, {
          className: 'decision-vote-avatar',
          label: `vote ${window.areciboPlayerName || 'joueur'}`
        });
      } else {
        chip.textContent = vote;
      }
      voteWrap.appendChild(chip);
    });

    row.appendChild(button);
    row.appendChild(voteWrap);
    landingDecisionOptions.appendChild(row);
  });

  landingDecision.classList.toggle('is-module-open', inspectSelected);
  renderLandingDecisionModule(inspectSelected);
}

function renderLandingDecisionModule(isVisible) {
  if (!landingDecisionModule || !landingDecision) return;
  landingDecisionModule.innerHTML = '';

  if (!isVisible) return;

  const isOpeningDebrisMission = storyPhase === 'opening-expedition'
    && landingDecisionStage === 'impact'
    && landingVotes.slice(0, playerCount).every(vote => vote === 'inspect-debris');

  if (isOpeningDebrisMission) {
    const title = document.createElement('div');
    title.className = 'landing-module-title';
    title.textContent = 'Module extraction coop // quete 001';

    const status = document.createElement('div');
    status.className = 'landing-module-status';
    status.textContent = 'Equipe synchronisee // mini jeu de recuperation a brancher ici';

    const meta = document.createElement('div');
    meta.className = 'landing-module-meta';
    meta.textContent = 'La premiere mission doit permettre a toute l equipe de recuperer une pince et du ruban adhesif dans les debris. Le mini jeu coop 1 a 6 joueurs sera branche a cet endroit.';

    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'landing-module-btn is-primary';
    continueBtn.textContent = 'simuler le retour mission';
    continueBtn.addEventListener('click', () => {
      showExpeditionResult('success', {
        kicker:'Expedition validee',
        reason:'Materiel recupere // pince et ruban adhesif en soute',
        returnOptions:{
          message:'Retour mission valide : outils recuperes dans les debris. Consultez les messages du MOTOMOTO.',
          isFailure:false
        },
        afterReturn:() => {
          setStoryPhase('opening-return', { autoOpenMessages:true });
        }
      });
    });

    landingDecisionModule.appendChild(title);
    landingDecisionModule.appendChild(status);
    landingDecisionModule.appendChild(meta);
    landingDecisionModule.appendChild(continueBtn);
    return;
  }

  const session = ensureLandingSignalSession();
  const signalState = getLandingSignalState();
  const baseRoot = `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, '')}`;
  const operatorUrl = `${baseRoot}arecibo_minigame_scan_operator.html?session=${encodeURIComponent(session)}`;
  const partnerUrl = `${baseRoot}arecibo_minigame_scan_partner.html?session=${encodeURIComponent(session)}`;

  const title = document.createElement('div');
  title.className = 'landing-module-title';
  title.textContent = 'Module signal cooperatif // asteroid relay';

  const status = document.createElement('div');
  status.className = 'landing-module-status';
  status.textContent = signalState === 'solved'
    ? 'Signal decode // etape suivante disponible'
    : signalState === 'armed'
      ? 'Signal arme // ouvre les consoles pour synchroniser les chiffres'
      : 'Module en attente // choisis une console';
  if (signalState === 'solved') status.classList.add('is-success');

  const links = document.createElement('div');
  links.className = 'landing-module-links';

  const operatorBtn = document.createElement('button');
  operatorBtn.type = 'button';
  operatorBtn.className = 'landing-module-btn is-primary';
  operatorBtn.textContent = playerCount <= 1 ? 'ouvrir le module' : 'ouvrir module operateur';
  operatorBtn.addEventListener('click', () => {
    setLandingSignalState('armed');
    window.open(operatorUrl, '_blank', 'noopener');
    renderLandingDecisionModule(true);
  });

  const partnerBtn = document.createElement('button');
  partnerBtn.type = 'button';
  partnerBtn.className = 'landing-module-btn';
  partnerBtn.textContent = 'ouvrir relais collegue';
  partnerBtn.addEventListener('click', () => {
    window.open(partnerUrl, '_blank', 'noopener');
  });

  const rerollBtn = document.createElement('button');
  rerollBtn.type = 'button';
  rerollBtn.className = 'landing-module-btn';
  rerollBtn.textContent = 'nouvelle session';
  rerollBtn.addEventListener('click', () => {
    const previousSession = ensureLandingSignalSession();
    localStorage.removeItem(`arecibo:minigame-signal-state:${previousSession}`);
    localStorage.removeItem(`arecibo:minigame-signal:${previousSession}`);
    landingSignalSessionId = `impact-${Math.random().toString(36).slice(2, 8)}`;
    setLandingSignalState('idle');
    renderLandingDecisionModule(true);
  });

  links.appendChild(operatorBtn);
  if (playerCount > 1) links.appendChild(partnerBtn);
  links.appendChild(rerollBtn);

  const meta = document.createElement('div');
  meta.className = 'landing-module-meta';
  meta.textContent = `Session ${session.toUpperCase()} // ouvre le relais collegue si tu veux tester la version a deux ecrans.`;

  landingDecisionModule.appendChild(title);
  landingDecisionModule.appendChild(status);
  landingDecisionModule.appendChild(links);
  landingDecisionModule.appendChild(meta);

  if (signalState === 'solved') {
    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'landing-module-btn is-primary';
    continueBtn.textContent = 'passer a l etape suivante';
    continueBtn.addEventListener('click', () => {
      goToLandingDecisionStage('followup');
    });
    landingDecisionModule.appendChild(continueBtn);
  }
}

function updateLandingConsoleNav() {
  if (!landingConsoleScroll) return;
  const maxScroll = Math.max(0, landingConsoleScroll.scrollHeight - landingConsoleScroll.clientHeight);
  const top = landingConsoleScroll.scrollTop <= 2;
  const bottom = landingConsoleScroll.scrollTop >= maxScroll - 2;

  if (landingConsoleUp) landingConsoleUp.classList.toggle('is-disabled', top);
  if (landingConsoleDown) landingConsoleDown.classList.toggle('is-disabled', bottom);
}

function scrollLandingConsole(direction) {
  if (!landingConsoleScroll) return;
  landingConsoleScroll.scrollBy({
    top: direction * Math.max(52, landingConsoleScroll.clientHeight * .24),
    behavior:'smooth'
  });
}

let landingConsoleHoldTimer = 0;
function updateExpeditionResultNav() {
  if (!expeditionResultScroll) return;
  const maxScroll = Math.max(0, expeditionResultScroll.scrollHeight - expeditionResultScroll.clientHeight);
  const top = expeditionResultScroll.scrollTop <= 2;
  const bottom = expeditionResultScroll.scrollTop >= maxScroll - 2;
  if (expeditionResultUp) expeditionResultUp.classList.toggle('is-disabled', top);
  if (expeditionResultDown) expeditionResultDown.classList.toggle('is-disabled', bottom);
}

function scrollExpeditionResult(direction) {
  if (!expeditionResultScroll) return;
  expeditionResultScroll.scrollBy({
    top: direction * Math.max(52, expeditionResultScroll.clientHeight * .24),
    behavior:'smooth'
  });
}

function setExpeditionResultPressed(button, pressed) {
  if (!button) return;
  button.classList.toggle('is-pressed', pressed);
}

function stopExpeditionResultHold() {
  setExpeditionResultPressed(expeditionResultUp, false);
  setExpeditionResultPressed(expeditionResultDown, false);
  if (!expeditionResultHoldTimer) return;
  window.clearInterval(expeditionResultHoldTimer);
  expeditionResultHoldTimer = 0;
}

function startExpeditionResultHold(direction) {
  stopExpeditionResultHold();
  scrollExpeditionResult(direction);
  expeditionResultHoldTimer = window.setInterval(() => {
    scrollExpeditionResult(direction);
  }, 170);
}

function stopLandingConsoleHold() {
  setLandingConsolePressed(landingConsoleUp, false);
  setLandingConsolePressed(landingConsoleDown, false);
  if (!landingConsoleHoldTimer) return;
  window.clearInterval(landingConsoleHoldTimer);
  landingConsoleHoldTimer = 0;
}

function setLandingConsolePressed(button, pressed) {
  if (!button) return;
  button.classList.toggle('is-pressed', pressed);
}

function startLandingConsoleHold(direction) {
  stopLandingConsoleHold();
  scrollLandingConsole(direction);
  landingConsoleHoldTimer = window.setInterval(() => {
    scrollLandingConsole(direction);
  }, 170);
}

function clearLandingTypingTimers() {
  landingTypingTimers.forEach(timerId => window.clearTimeout(timerId));
  landingTypingTimers = [];
}

function scheduleLandingTyping(callback, delay) {
  const timerId = window.setTimeout(callback, delay);
  landingTypingTimers.push(timerId);
  return timerId;
}

function typeLandingLine(targetEl, cursorEl, text, startDelay, stepDelay, onComplete) {
  if (!targetEl) {
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  targetEl.textContent = '';
  if (cursorEl) cursorEl.style.opacity = '1';

  scheduleLandingTyping(() => {
    let index = 0;

    const tick = () => {
      targetEl.textContent = text.slice(0, index);
      if (index < text.length) {
        index += 1;
        scheduleLandingTyping(tick, stepDelay);
        return;
      }
      if (typeof onComplete === 'function') onComplete();
    };

    tick();
  }, startDelay);
}

function startLandingDecisionTyping() {
  if (!landingDecision) return;

  clearLandingTypingTimers();
  landingDecision.classList.remove('is-copy-ready');
  if (landingConsoleScroll) {
    landingConsoleScroll.scrollTop = 0;
    updateLandingConsoleNav();
  }

  if (landingAlertText) landingAlertText.textContent = '';
  if (landingHeadText) landingHeadText.textContent = '';

  const stage = landingDecisionStages[landingDecisionStage] || landingDecisionStages.impact;
  const alertCopy = stage.alert;
  const questionCopy = stage.question;
  const alertDuration = alertCopy.length * 24;
  const questionStartDelay = 180 + alertDuration;

  typeLandingLine(landingAlertText, landingAlertCursor, alertCopy, 0, 24);
  typeLandingLine(landingHeadText, landingHeadCursor, questionCopy, questionStartDelay, 18, () => {
    landingDecision.classList.add('is-copy-ready');
    updateLandingConsoleNav();
  });
}

function startLandingSequence() {
  if (!landingSequence || !landingCanvas || landingStarted) return;
  landingStarted = true;
  clearLandingSequenceTimers();
  ensureLandingSignalSession();
  setLandingSignalState('idle');
  startExpeditionTimer();

  landingSequence.classList.add('is-active');
  landingSequence.setAttribute('aria-hidden', 'false');

  const canvas = landingCanvas;
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dustParticles = [];
  const smokeParticles = [];
  const pixelDebris = [];
  let width = 0;
  let height = 0;
  let centerX = 0;
  let groundY = 0;
  const startTime = performance.now();
  const duration = 7600;
  const shipSettleDelay = 6200;
  const questionOpenDelay = 3350;
  landingSequenceTimers.push(window.setTimeout(() => {
    if (landingSequence) landingSequence.classList.add('is-question-open');
    renderLandingDecision();
    startLandingDecisionTyping();
  }, questionOpenDelay));
  landingSequenceTimers.push(window.setTimeout(() => {
    if (landingSequence) {
      landingSequence.classList.add('is-hovering');
    }
  }, shipSettleDelay));

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width * 0.5;
    groundY = height * 0.78;
  }
  landingResizeHandler = resize;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnSmoke(power = 1) {
    const side = Math.random() < 0.5 ? -1 : 1;
    smokeParticles.push({
      x:centerX + rand(-150, 150),
      y:groundY - rand(8, 24),
      vx:rand(.3, 2.1) * side * power,
      vy:rand(-1.6, -.22) * power,
      size:rand(28, 74) * power,
      life:rand(40, 78),
      maxLife:rand(40, 78),
      color:Math.random() < 0.6 ? '156,140,126' : '116,98,78'
    });
  }

  function spawnDust(power = 1) {
    dustParticles.push({
      x:centerX + rand(-220, 220),
      y:groundY + rand(-8, 10),
      vx:rand(-4.8, 4.8) * power,
      vy:rand(-3.4, -.8) * power,
      size:rand(2, 7),
      life:rand(24, 48),
      maxLife:rand(24, 48),
      color:Math.random() < 0.5 ? '#716457' : '#9b8a78'
    });
  }

  function spawnPixelDebris(power = 1) {
    pixelDebris.push({
      x:centerX + rand(-180, 180),
      y:groundY + rand(-14, 6),
      vx:rand(-3.2, 3.2) * power,
      vy:rand(-4.2, -.5) * power,
      size:rand(2, 6),
      life:rand(28, 54),
      maxLife:rand(28, 54),
      color:Math.random() < 0.55 ? '#c5b59b' : '#6a6258'
    });
  }

  function render(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const impact = Math.max(0, 1 - Math.abs(t - 0.78) / 0.2);
    const hovering = t >= 1;

    if (!prefersReducedMotion) {
      if (!hovering && t < 0.96) {
        const smokeRate = t < 0.5 ? 3 : t < 0.84 ? 11 : 7;
        for (let i = 0; i < smokeRate; i += 1) spawnSmoke(.72 + impact * 1.1);
        const dustRate = t > 0.42 ? Math.round(5 + impact * 12) : 2;
        for (let i = 0; i < dustRate; i += 1) spawnDust(.7 + impact * 1.2);
        const debrisRate = t > 0.5 ? Math.round(2 + impact * 8) : 0;
        for (let i = 0; i < debrisRate; i += 1) spawnPixelDebris(.75 + impact * 1.3);
      } else if (hovering) {
        for (let i = 0; i < 3; i += 1) spawnSmoke(.56 + Math.random() * .2);
        for (let i = 0; i < 2; i += 1) spawnDust(.42 + Math.random() * .18);
        if (Math.random() > .72) spawnPixelDebris(.35 + Math.random() * .14);
      }
    } else if (!smokeParticles.length && !dustParticles.length && !pixelDebris.length) {
      for (let i = 0; i < 32; i += 1) spawnSmoke(.9);
      for (let i = 0; i < 22; i += 1) spawnDust(1);
      for (let i = 0; i < 16; i += 1) spawnPixelDebris(1);
    }

    ctx.clearRect(0, 0, width, height);

    smokeParticles.forEach((particle, index) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= .986;
      particle.vy -= .006;
      particle.life -= 1;
      const alpha = Math.max(0, particle.life / particle.maxLife) * .34;
      ctx.fillStyle = `rgba(${particle.color}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (1 + (1 - particle.life / particle.maxLife) * .45), 0, Math.PI * 2);
      ctx.fill();
      if (particle.life <= 0) smokeParticles.splice(index, 1);
    });

    dustParticles.forEach((particle, index) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= .982;
      particle.vy += .04;
      particle.life -= 1;
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife) * .72;
      ctx.fillStyle = particle.color;
      ctx.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
      if (particle.life <= 0) dustParticles.splice(index, 1);
    });

    pixelDebris.forEach((particle, index) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= .99;
      particle.vy += .026;
      particle.life -= 1;
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife) * .64;
      ctx.fillStyle = particle.color;
      ctx.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
      ctx.fillRect(Math.round(particle.x - particle.vx * 1.8), Math.round(particle.y - particle.vy * 1.8), Math.max(1, particle.size - 1), Math.max(1, particle.size - 1));
      if (particle.life <= 0) pixelDebris.splice(index, 1);
    });

    ctx.globalAlpha = 1;

    if (landingSequence.classList.contains('is-active') || smokeParticles.length || dustParticles.length || pixelDebris.length) {
      requestAnimationFrame(render);
    }
  }

  resize();
  window.addEventListener('resize', resize, { passive:true });
  requestAnimationFrame(render);
}

function startOpeningDebrisMission() {
  setStoryPhase('opening-expedition');
  setExpeditionActive(true);
  if (pageTransition) pageTransition.classList.remove('out');
  window.setTimeout(() => {
    openDebrisInspectionScene();
    if (landingSequence) landingSequence.classList.add('is-question-open');
    renderLandingDecision();
    startLandingDecisionTyping();
    if (pageTransition) pageTransition.classList.add('out');
  }, 420);
}

launchBtn.addEventListener('click', () => {
  if (storyPhase === 'opening-return') {
    openMessages();
    return;
  }

  const allReady = readyState.slice(0, playerCount).every(Boolean);
  if (!allReady) {
    readyState[0] = true;
    updateReadyState();
    return;
  }

  launchIcon.textContent = 'OK';
  launchLabel.textContent = 'OUVERTURE DU SAS...';
  setExpeditionActive(true);

  if (storyPhase === 'opening-briefing') {
    startOpeningDebrisMission();
    return;
  }

  if (pageTransition) pageTransition.classList.remove('out');
  window.setTimeout(() => {
    startLandingSequence();
    if (pageTransition) pageTransition.classList.add('out');
  }, 560);
});

function goMenu() {
  stopExpeditionTimer();
  resetLandingSequenceState();
  const transition = document.getElementById('transition');
  transition.classList.remove('out');
  setTimeout(() => window.location.href = 'arecibo_menu.html?v=bridge-main', 520);
}

function openSettings(event) {
  if (event) event.preventDefault();
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  syncPixelDitherButtons(overlay);
  setTimeout(() => overlay.querySelector('.settings-panel').classList.add('visible'), 10);
}

function closeSettings() {
  const overlay = document.getElementById('settings-overlay');
  if (!overlay) return;
  const panel = overlay.querySelector('.settings-panel');
  if (panel) panel.classList.remove('visible');
  setTimeout(() => overlay.classList.remove('open'), 320);
}

function openMessages(event) {
  if (event) event.preventDefault();
  const overlay = document.getElementById('messages-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  setTimeout(() => overlay.querySelector('.messages-panel').classList.add('visible'), 10);
}

function closeMessages() {
  const overlay = document.getElementById('messages-overlay');
  if (!overlay) return;
  const panel = overlay.querySelector('.messages-panel');
  if (panel) panel.classList.remove('visible');
  setTimeout(() => overlay.classList.remove('open'), 300);
}

function updateSlider(el, valId) {
  const valueNode = document.getElementById(valId);
  if (valueNode) valueNode.textContent = el.value + '%';
}

function selectLang(btn) {
  if (!btn || btn.disabled || btn.classList.contains('disabled')) return;
  const row = btn.closest('.sp-lang-row');
  const buttons = row ? row.querySelectorAll('.lang-btn') : document.querySelectorAll('.lang-btn');
  buttons.forEach(button => button.classList.remove('sel'));
  btn.classList.add('sel');
}

function syncPixelDitherButtons(root = document) {
  const current = typeof window.getAreciboPixelDither === 'function'
    ? window.getAreciboPixelDither()
    : 'strong';
  root.querySelectorAll('[data-pixel-dither-group] .pixel-btn').forEach(btn => {
    btn.classList.toggle('sel', btn.dataset.pixelDither === current);
  });
}

function selectPixelDither(btn, mode) {
  const row = btn ? btn.closest('[data-pixel-dither-group]') : null;
  if (row) {
    row.querySelectorAll('.pixel-btn').forEach(item => item.classList.remove('sel'));
  }
  if (btn) btn.classList.add('sel');
  if (typeof window.setAreciboPixelDither === 'function') {
    window.setAreciboPixelDither(mode);
  }
}

function toggleSwitch(el) {
  el.classList.toggle('on');
}

window.addEventListener('arecibo-pixel-dither-change', () => syncPixelDitherButtons());
window.addEventListener('DOMContentLoaded', () => syncPixelDitherButtons());

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (sasRepairOverlay && sasRepairOverlay.classList.contains('is-open')) {
    closeSasRepairOverlay();
    return;
  }
  if (debrisScene && debrisScene.classList.contains('is-active')) {
    closeDebrisInspectionScene();
    return;
  }
  const messagesOverlay = document.getElementById('messages-overlay');
  if (messagesOverlay && messagesOverlay.classList.contains('open')) {
    closeMessages();
    return;
  }
  const settingsOverlay = document.getElementById('settings-overlay');
  if (settingsOverlay && settingsOverlay.classList.contains('open')) closeSettings();
});

window.addEventListener('blur', () => {
  stopLandingConsoleHold();
  stopExpeditionResultHold();
});

window.addEventListener('storage', event => {
  if (event.key === SESSION_INVENTORY_SYNC_KEY && event.newValue) {
    try {
      const payload = JSON.parse(event.newValue);
      if (payload.session === sessionCode && payload.clientId !== presenceClientId) {
        consumePersonalLoot(payload.items || [], { broadcast:false });
      }
    } catch (err) {}
    return;
  }
  const session = ensureLandingSignalSession();
  if (event.key !== `arecibo:minigame-signal-state:${session}`) return;
  if (landingDecisionStage === 'impact') renderLandingDecisionModule(true);
});

if (landingConsoleScroll) {
  landingConsoleScroll.addEventListener('scroll', updateLandingConsoleNav);
  landingConsoleScroll.addEventListener('wheel', () => {
    window.requestAnimationFrame(updateLandingConsoleNav);
  }, { passive:true });
}
if (landingConsoleUp) {
  landingConsoleUp.addEventListener('click', () => scrollLandingConsole(-1));
  landingConsoleUp.addEventListener('pointerdown', event => {
    event.preventDefault();
    setLandingConsolePressed(landingConsoleUp, true);
    startLandingConsoleHold(-1);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
    landingConsoleUp.addEventListener(type, () => {
      setLandingConsolePressed(landingConsoleUp, false);
      stopLandingConsoleHold();
    });
  });
}
if (landingConsoleDown) {
  landingConsoleDown.addEventListener('click', () => scrollLandingConsole(1));
  landingConsoleDown.addEventListener('pointerdown', event => {
    event.preventDefault();
    setLandingConsolePressed(landingConsoleDown, true);
    startLandingConsoleHold(1);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
    landingConsoleDown.addEventListener(type, () => {
      setLandingConsolePressed(landingConsoleDown, false);
      stopLandingConsoleHold();
    });
  });
}
if (expeditionResultScroll) {
  expeditionResultScroll.addEventListener('scroll', updateExpeditionResultNav);
  expeditionResultScroll.addEventListener('wheel', () => {
    window.requestAnimationFrame(updateExpeditionResultNav);
  }, { passive:true });
}
if (expeditionResultUp) {
  expeditionResultUp.addEventListener('click', () => scrollExpeditionResult(-1));
  expeditionResultUp.addEventListener('pointerdown', event => {
    event.preventDefault();
    setExpeditionResultPressed(expeditionResultUp, true);
    startExpeditionResultHold(-1);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
    expeditionResultUp.addEventListener(type, () => {
      setExpeditionResultPressed(expeditionResultUp, false);
      stopExpeditionResultHold();
    });
  });
}
if (expeditionResultDown) {
  expeditionResultDown.addEventListener('click', () => scrollExpeditionResult(1));
  expeditionResultDown.addEventListener('pointerdown', event => {
    event.preventDefault();
    setExpeditionResultPressed(expeditionResultDown, true);
    startExpeditionResultHold(1);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(type => {
    expeditionResultDown.addEventListener(type, () => {
      setExpeditionResultPressed(expeditionResultDown, false);
      stopExpeditionResultHold();
    });
  });
}
if (sasGrilleTrigger) {
  sasGrilleTrigger.addEventListener('click', openSasRepairOverlay);
}
if (sasRepairOverlay) {
  sasRepairOverlay.addEventListener('click', closeSasRepairOverlay);
}
if (sasRepairClose) {
  sasRepairClose.addEventListener('click', closeSasRepairOverlay);
}
document.addEventListener('click', event => {
  const target = event.target instanceof Element
    ? event.target.closest(expeditionInteractiveSelector)
    : null;
  if (!target) return;
  emitPresenceInteraction(target, event);
}, true);
window.addEventListener('storage', event => {
  if (event.key === 'areciboPlayerProfile' || event.key === 'areciboPlayerName') {
    updateLocalCursorProfile();
  }
});
if (expeditionResultAction) {
  expeditionResultAction.addEventListener('click', () => {
    if (!expeditionResultPending) return;
    const { returnOptions, afterReturn } = expeditionResultPending;
    if (pageTransition) pageTransition.classList.remove('out');
    window.setTimeout(() => {
      returnToShipFromExpedition(returnOptions);
      if (typeof afterReturn === 'function') afterReturn();
      if (pageTransition) pageTransition.classList.add('out');
    }, 280);
  });
}

initPlayerPackageName();
initPontRepairState();
initShipMap();
applyOpeningStoryState();
restoreSasRepairCutState();
updateReadyState();
setExpeditionTimerDisplay(expeditionDurationMs);
updateDistance();
startPortholeSpace();
startAmbientDust();
initMultiplayerPresence();
window.setAreciboPresenceTransport = setPresenceTransport;
startRoomFly();
startCriticalShipShakes();
initHudCollapse();
initDraggablePersonalWindow();
renderPersonalInventory();
initDebrisBackdropScene();
window.openDebrisInspectionScene = openDebrisInspectionScene;
window.closeDebrisInspectionScene = closeDebrisInspectionScene;
window.showExpeditionSuccessResult = (reason = 'Retour securise // transfert des ressources en cours') => {
  showExpeditionResult('success', {
    reason,
    returnOptions:{
      message:'Expedition validee : ressources chargees, retour au MOTOMOTO en cours.',
      isFailure:false
    }
  });
};
window.completeOpeningToolboxMission = () => {
  unlockPersonalLoot(['cutting_pliers', 'motomoto_message']);
  if (mapMessage) {
    mapMessage.classList.remove('warn');
    mapMessage.textContent = 'Boite a outils ouverte : pince coupante et message securises dans le package personnel.';
  }
  showExpeditionResult('success', {
    kicker:'Expedition validee',
    reason:'Boite ouverte // pince coupante et message recuperes',
    returnOptions:{
      message:'Mission reussie : pince coupante et message ajoutes au package personnel. Retour au sas.',
      isFailure:false
    },
    afterReturn:() => {
      setStoryPhase('opening-return', { autoOpenMessages:true });
      renderPersonalInventory();
    }
  });
};
window.showExpeditionFailureResult = (reason = 'Stress critique // extraction perdue') => {
  showExpeditionResult('failure', {
    reason,
    returnOptions:{
      message:'Echec extraction : equipe evacuee en urgence, trouvailles perdues.',
      isFailure:true
    },
    afterReturn:() => {
      if (storyPhase === 'opening-expedition') setStoryPhase('opening-briefing');
      expeditionFailing = false;
    }
  });
};

if (params.get('landing') === '1') {
  setExpeditionActive(true);
  startLandingSequence();
  if (pageTransition) pageTransition.classList.add('out');
}
if (params.get('debris') === '1') {
  setExpeditionActive(true);
  if (pageTransition) pageTransition.classList.add('out');
  openDebrisInspectionScene();
}
if ((storyPhase === 'opening-briefing' || storyPhase === 'opening-return') && !params.get('landing') && !params.get('debris') && !params.get('expeditionResult')) {
  const alreadyOpened = localStorage.getItem(OPENING_MAIL_OPENED_KEY) === 'true';
  if (!alreadyOpened) {
    try { localStorage.setItem(OPENING_MAIL_OPENED_KEY, 'true'); } catch (err) {}
    window.setTimeout(() => openMessages(), 520);
  }
}
if (params.get('expeditionResult')) {
  setExpeditionActive(true);
  landingStarted = true;
  landingSequence.classList.add('is-active', 'is-hovering');
  landingSequence.setAttribute('aria-hidden', 'false');
  stopExpeditionTimer({ resetDisplay:false, keepVisible:false });
  if (pageTransition) pageTransition.classList.add('out');

  const preview = params.get('expeditionResult');
  if (preview === 'success') {
    showExpeditionResult('success', {
      reason:'Retour securise // transfert des ressources en cours'
    });
  } else if (preview === 'failure-stress') {
    showExpeditionResult('failure', {
      reason:'Stress critique // extraction perdue',
      returnOptions:{
        message:'Echec extraction : surcharge mentale critique. Retour force au MOTOMOTO, trouvailles perdues.',
        isFailure:true
      },
      afterReturn:() => {
        if (storyPhase === 'opening-expedition') setStoryPhase('opening-briefing');
        expeditionFailing = false;
      }
    });
  } else {
    showExpeditionResult('failure', {
      reason:'Temps ecoule // retour d urgence vers le MOTOMOTO',
      returnOptions:{
        message:'Echec extraction : temps ecoule. Retour force au vaisseau, trouvailles perdues.',
        isFailure:true
      },
      afterReturn:() => {
        if (storyPhase === 'opening-expedition') setStoryPhase('opening-briefing');
        expeditionFailing = false;
      }
    });
  }
}

