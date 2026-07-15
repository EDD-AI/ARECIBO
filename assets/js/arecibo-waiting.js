/* ─── ARECIBO — SALLE D'EMBARQUEMENT ──────────────────────────────
   Démo de la frame 6 du Figma : le joueur (profil) + de faux joueurs
   qui se connectent un à un, badges wait./Prêt, puis lancement.
   Flow : arecibo_character.html?next=host → ici → arecibo_demo.html */

(() => {
  const api = window.AreciboPlayerProfile;
  const params = new URLSearchParams(window.location.search);
  const sessionCode = params.get('sessionCode') || 'KHSD';

  const $ = id => document.getElementById(id);
  const playersRoot = $('waitingPlayers');
  const logRoot = $('waitingLog');
  const sessionLabel = $('waitingSession');
  const launchBtn = $('waitingLaunch');
  const backBtn = $('waitingBack');
  const transition = $('transition');
  const cursor = $('cursor');
  const starsCanvas = $('waitingStars');

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const rand = (a, b) => a + Math.random() * (b - a);

  const profile = api ? api.loadPlayerProfile() : { name: 'COCO', headId: 1, primaryColor: '#fcfcfc', secondaryColor: '#2f2925' };

  // Les faux joueurs de la frame 6 : vibes, buuters, wendy.
  const FAKE_PLAYERS = [
    { name: 'vibes', color: '#ff4b33', headId: 7, primaryColor: '#f1b9aa', secondaryColor: '#7c2620', joinAfter: 2600, readyAfter: 4200 },
    { name: 'buuters', color: '#ffe75a', headId: 12, primaryColor: '#ffd487', secondaryColor: '#6e4f13', joinAfter: 5600, readyAfter: 3400 },
    { name: 'wendy', color: '#f7ffc3', headId: 19, primaryColor: '#bdf0da', secondaryColor: '#214c39', joinAfter: 9200, readyAfter: 5200 }
  ];

  const JOIN_LINES = [
    '{name} a rejoint le vaisseau.',
    '{name} est monté à bord. Le sas se referme.',
    'Signal de {name} détecté. Bienvenue à bord.'
  ];

  const READY_LINES = [
    '{name} est prêt.',
    '{name} a bouclé son harnais.',
    '{name} confirme : paré au départ.'
  ];

  const slots = [];

  function playClick() {
    if (typeof window.playAreciboClickSound === 'function') window.playAreciboClickSound();
  }

  function log(text) {
    if (!logRoot) return;
    const line = document.createElement('div');
    line.className = 'waiting-log-line';
    line.textContent = text;
    logRoot.appendChild(line);
    while (logRoot.children.length > 3) logRoot.removeChild(logRoot.firstChild);
    if (typeof window.playAreciboClickSound === 'function') {
      // léger tick de connexion
    }
  }

  function makeSlot(name, color, isYou) {
    const node = document.createElement('div');
    node.className = 'waiting-player';
    node.style.setProperty('--p-color', color);
    node.style.setProperty('--bob-delay', `${rand(0, 2).toFixed(2)}s`);
    node.innerHTML = `
      <span class="waiting-player-head"></span>
      <span class="waiting-player-name">${name}${isYou ? ' (vous)' : ''}</span>
      <span class="waiting-player-halo"></span>
      <span class="waiting-player-badge is-wait">wait.</span>`;
    playersRoot.appendChild(node);
    return { node, badge: node.querySelector('.waiting-player-badge'), head: node.querySelector('.waiting-player-head'), ready: false };
  }

  function setReady(slot, name) {
    slot.ready = true;
    slot.badge.textContent = 'Prêt';
    slot.badge.classList.remove('is-wait');
    log(pick(READY_LINES).replace('{name}', name));
    checkAllReady();
  }

  function checkAllReady() {
    if (!slots.every(s => s.ready)) return;
    if (launchBtn) {
      launchBtn.disabled = false;
      launchBtn.textContent = 'LANCER LA PARTIE >';
      launchBtn.classList.add('is-ready');
    }
    log('Équipage au complet. Le Capitaine peut lancer la partie.');
    if (typeof window.playAreciboStartSound === 'function') window.playAreciboStartSound();
  }

  function renderHead(slot, headProfile, label) {
    if (!api) {
      slot.head.textContent = label.slice(0, 1).toUpperCase();
      return;
    }
    api.renderHeadSvg(headProfile, { label }).then(svg => {
      slot.head.innerHTML = svg;
    }).catch(() => {});
  }

  function connectYou() {
    const slot = makeSlot(profile.name.toLowerCase(), '#fa7a2c', true);
    slots.push(slot);
    renderHead(slot, profile, profile.name);
    window.setTimeout(() => {
      slot.node.classList.add('is-connected');
      log(pick(JOIN_LINES).replace('{name}', profile.name.toLowerCase()));
      // Vous êtes prêt d'office : c'est vous le Capitaine.
      window.setTimeout(() => setReady(slot, profile.name.toLowerCase()), 1500);
    }, 600);
  }

  function connectFakes() {
    let delay = 0;
    FAKE_PLAYERS.forEach(fake => {
      delay += fake.joinAfter;
      const slot = makeSlot(fake.name, fake.color, false);
      slots.push(slot);
      renderHead(slot, { name: fake.name, headId: fake.headId, primaryColor: fake.primaryColor, secondaryColor: fake.secondaryColor }, fake.name);
      window.setTimeout(() => {
        slot.node.classList.add('is-connected');
        log(pick(JOIN_LINES).replace('{name}', fake.name));
        window.setTimeout(() => setReady(slot, fake.name), fake.readyAfter);
      }, delay);
    });
  }

  function navigateOut(url) {
    if (transition) transition.classList.add('active');
    window.setTimeout(() => { window.location.href = url; }, 420);
  }

  function drawStars() {
    if (!starsCanvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    starsCanvas.width = width * ratio;
    starsCanvas.height = height * ratio;
    const ctx = starsCanvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const count = Math.floor((width * height) / 5800);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = 0.14 + Math.random() * 0.5;
      ctx.fillStyle = '#f7ffc3';
      const size = Math.random() > 0.86 ? 2 : 1;
      ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function init() {
    if (sessionLabel) sessionLabel.textContent = `SESSION ${sessionCode}`;
    if (backBtn) backBtn.addEventListener('click', () => { playClick(); navigateOut('arecibo_menu.html'); });
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        playClick();
        log('Mise sous tension du MOTOMOTO...');
        navigateOut(`arecibo_demo.html?sessionCode=${encodeURIComponent(sessionCode)}`);
      });
    }
    window.addEventListener('mousemove', event => {
      if (!cursor) return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
    drawStars();
    log(`Session ${sessionCode} ouverte. En attente de l'équipage...`);
    connectYou();
    connectFakes();
  }

  window.addEventListener('resize', drawStars);
  init();
})();
