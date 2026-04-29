(() => {
  const DURATION_MS = 25 * 60 * 1000;
  const params = new URLSearchParams(window.location.search);
  const sessionCode = params.get('sessionCode') || '';
  const mode = params.get('mode') || '';
  const timerKey = sessionCode ? `areciboMotomotoTimer:${sessionCode}` : '';

  const rearCanvases = [
    document.getElementById('rearCanvasLeft'),
    document.getElementById('rearCanvasCenter'),
    document.getElementById('rearCanvasRight')
  ].filter(Boolean);
  const timerValue = document.getElementById('missionTimerValue');
  const timerCaption = document.getElementById('missionTimerCaption');
  const overlay = document.getElementById('endOverlay');
  const cursor = document.getElementById('cursor');
  const bridgeShellClosed = document.getElementById('bridgeShellClosed');
  const bridgeShellOpen = document.getElementById('bridgeShellOpen');
  const bridgeDoorLeft = document.getElementById('bridgeDoorLeft');
  const bridgeDoorRight = document.getElementById('bridgeDoorRight');
  const doorHotspotLeft = document.getElementById('doorHotspotLeft');
  const doorHotspotRight = document.getElementById('doorHotspotRight');
  const doorCinematic = document.getElementById('doorCinematic');
  const doorCinematicView = document.getElementById('doorCinematicView');
  const doorCinematicPanel = document.getElementById('doorCinematicPanel');
  const doorCinematicCaption = document.getElementById('doorCinematicCaption');
  const roleOverlay = document.getElementById('roleOverlay');
  const roleDismiss = document.getElementById('roleCardDismiss');
  const activeRoleValue = document.getElementById('activeRoleValue');
  const roleCardName = document.getElementById('roleCardName');
  const roleCardSpecies = document.getElementById('roleCardSpecies');
  const roleCardProfile = document.getElementById('roleCardProfile');
  const roleCardCode = document.getElementById('roleCardCode');
  const roleCardNav = document.getElementById('roleCardNav');
  const roleCardRole = document.getElementById('roleCardRole');
  const roleCardPower = document.getElementById('roleCardPower');
  const roleCardCopyHead = document.getElementById('roleCardCopyHead');
  const roleCardCopy = document.getElementById('roleCardCopy');
  const roleCardRules = document.getElementById('roleCardRules');
  const roleCardRisk = document.getElementById('roleCardRisk');
  const roleCardPortrait = document.getElementById('roleCardPortrait');

  let panes = [];
  let ended = false;
  const doorState = { left: false, right: false };
  let cinematicTimer = 0;

  const roleKey = sessionCode ? `areciboRole:${sessionCode}` : 'areciboRole:local';
  const roleSeenKey = sessionCode ? `areciboRoleSeen:${sessionCode}` : 'areciboRoleSeen:local';
  const ROLE_DATA = {
    capitaine: {
      label: 'CAPITAINE',
      rank: 'OFFICIER',
      accent: '#fa7a2c',
      soft: 'rgba(250,122,44,0.18)',
      glow: 'rgba(250,122,44,0.42)',
      species: 'CANIDE // SURVIVANT',
      profile: 'COMMAND // AUTHORIZED',
      code: 'AR-01-CPT-1402',
      nav: 'PRIORITY ROUTE // ARECIBO',
      power: 'DECISION FINALE',
      head: 'AUTORISATION ACTIVE.',
      copy: 'Vous etes le seul membre de l equipage capable de valider la decision finale a chaque round.',
      rules: 'Ecoutez les signaux du Timonier. Ecoutez les propositions des Matelots. Gardez le cap.',
      risk: 'Si l equipage perd confiance en vous, il peut vous destituer.',
      portrait: 'assets/animals/head-03.svg'
    },
    timonier: {
      label: 'TIMONIER',
      rank: 'OFFICIER',
      accent: '#7dd9ff',
      soft: 'rgba(125,217,255,0.18)',
      glow: 'rgba(125,217,255,0.42)',
      species: 'PRIMATE // SURVIVANT',
      profile: 'SIGNAL // NAV DATA',
      code: 'AR-02-NAV-8820',
      nav: 'DISTANCE // ROUTE // DANGERS',
      power: 'LECTURE DU SIGNAL',
      head: 'ACCES NAVIGATION OUVERT.',
      copy: 'Vous voyez les donnees de navigation et l etat du signal Arecibo plus clairement que le reste de l equipage.',
      rules: 'Vous pouvez transmettre la verite ou falsifier les donnees. Personne ne sait si vous mentez.',
      risk: 'Si le Capitaine vous croit, vous pilotez le destin du vaisseau.',
      portrait: 'assets/animals/head-02.svg'
    },
    matelot: {
      label: 'MATELOT',
      rank: 'EQUIPAGE',
      accent: '#dbe79b',
      soft: 'rgba(219,231,155,0.18)',
      glow: 'rgba(219,231,155,0.38)',
      species: 'FELIDE // SURVIVANT',
      profile: 'CREW // SALVAGE',
      code: 'AR-03-CRT-5117',
      nav: 'ORDRES // DEBAT // SURVIE',
      power: 'PRESSION COLLECTIVE',
      head: 'STATUT OPERATIONNEL.',
      copy: 'Vous recevez des informations partielles sur les evenements et vous proposez vos actions au Capitaine.',
      rules: 'Debattez. Orientez les choix. Si besoin, vous pouvez voter pour destituer le Capitaine.',
      risk: 'Certains Matelots portent peut etre un role cache. Peut etre vous.',
      portrait: 'assets/animals/head-01.svg'
    }
  };

  function ensureRole() {
    const roleIds = Object.keys(ROLE_DATA);
    try {
      const existing = localStorage.getItem(roleKey);
      if (existing && ROLE_DATA[existing]) return existing;
      const picked = roleIds[Math.floor(Math.random() * roleIds.length)];
      localStorage.setItem(roleKey, picked);
      return picked;
    } catch (err) {
      return roleIds[0];
    }
  }

  const currentRoleId = ensureRole();
  const currentRole = ROLE_DATA[currentRoleId] || ROLE_DATA.capitaine;

  function syncDoorShell() {
    const anyOpen = doorState.left || doorState.right;

    if (bridgeShellClosed) bridgeShellClosed.classList.toggle('is-visible', !anyOpen);
    if (bridgeShellOpen) bridgeShellOpen.classList.toggle('is-visible', anyOpen);
    if (bridgeDoorLeft) bridgeDoorLeft.classList.toggle('is-visible', anyOpen && !doorState.left);
    if (bridgeDoorRight) bridgeDoorRight.classList.toggle('is-visible', anyOpen && !doorState.right);

    if (doorHotspotLeft) {
      doorHotspotLeft.setAttribute('aria-label', doorState.left ? 'Fermer le sas gauche' : 'Ouvrir le sas gauche');
      doorHotspotLeft.dataset.state = doorState.left ? 'open' : 'closed';
    }
    if (doorHotspotRight) {
      doorHotspotRight.setAttribute('aria-label', doorState.right ? 'Fermer le sas droit' : 'Ouvrir le sas droit');
      doorHotspotRight.dataset.state = doorState.right ? 'open' : 'closed';
    }
  }

  function hideDoorCinematic() {
    if (!doorCinematic) return;
    doorCinematic.classList.remove('is-visible', 'is-left', 'is-right', 'is-opening', 'is-closing');
    if (doorCinematicView) doorCinematicView.classList.remove('is-left', 'is-right');
    if (doorCinematicPanel) doorCinematicPanel.classList.remove('start-open');
  }

  function playDoorCinematic(side, opening) {
    if (!doorCinematic || !doorCinematicView || !doorCinematicPanel || !doorCinematicCaption) return;

    const isLeft = side === 'left';
    const panelSrc = isLeft ? 'assets/motomoto-door-left.png' : 'assets/motomoto-door-right.png';

    window.clearTimeout(cinematicTimer);
    hideDoorCinematic();

    doorCinematicPanel.src = panelSrc;
    doorCinematicView.classList.add(isLeft ? 'is-left' : 'is-right');
    doorCinematic.classList.add('is-visible', isLeft ? 'is-left' : 'is-right');
    doorCinematicCaption.textContent = `SAS ${isLeft ? 'GAUCHE' : 'DROIT'} // ${opening ? 'OUVERTURE' : 'FERMETURE'}`;

    if (!opening) {
      doorCinematicPanel.classList.add('start-open');
    }

    requestAnimationFrame(() => {
      doorCinematic.classList.add(opening ? 'is-opening' : 'is-closing');
    });

    cinematicTimer = window.setTimeout(() => {
      hideDoorCinematic();
    }, 980);
  }

  function toggleDoor(side) {
    const opening = !doorState[side];
    playDoorCinematic(side, opening);
    doorState[side] = opening;
    syncDoorShell();
  }

  function applyRoleTheme() {
    document.documentElement.style.setProperty('--role-accent', currentRole.accent);
    document.documentElement.style.setProperty('--role-accent-soft', currentRole.soft);
    document.documentElement.style.setProperty('--role-accent-glow', currentRole.glow);

    if (activeRoleValue) activeRoleValue.textContent = currentRole.label;
    if (roleCardName) roleCardName.textContent = currentRole.label;
    if (roleCardSpecies) roleCardSpecies.textContent = currentRole.species;
    if (roleCardProfile) roleCardProfile.textContent = currentRole.profile;
    if (roleCardCode) roleCardCode.textContent = currentRole.code;
    if (roleCardNav) roleCardNav.textContent = currentRole.nav;
    if (roleCardRole) roleCardRole.textContent = currentRole.label;
    if (roleCardPower) roleCardPower.textContent = currentRole.power;
    if (roleCardCopyHead) roleCardCopyHead.textContent = currentRole.head;
    if (roleCardCopy) roleCardCopy.textContent = currentRole.copy;
    if (roleCardRules) roleCardRules.textContent = currentRole.rules;
    if (roleCardRisk) roleCardRisk.textContent = currentRole.risk;
    if (roleCardPortrait) roleCardPortrait.src = currentRole.portrait;
  }

  function hideRoleOverlay() {
    if (!roleOverlay) return;
    roleOverlay.classList.remove('is-visible');
    try { localStorage.setItem(roleSeenKey, 'true'); } catch (err) {}
  }

  function maybeShowRoleOverlay() {
    if (!roleOverlay) return;
    roleOverlay.classList.add('is-visible');
  }

  function ensureStartTime() {
    const now = Date.now();
    if (!timerKey) return now;

    try {
      const existing = Number(localStorage.getItem(timerKey));
      if (Number.isFinite(existing) && existing > 0) return existing;
      localStorage.setItem(timerKey, String(now));
      return now;
    } catch (err) {
      return now;
    }
  }

  const startedAt = ensureStartTime();

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

      const starCount = Math.max(18, Math.floor((rect.width * rect.height) / 5400));
      const particleCount = Math.max(5, Math.floor(rect.width / 90));
      return {
        canvas,
        ctx,
        width: rect.width,
        height: rect.height,
        offset: index * 0.8 + Math.random() * 0.4,
        stars: Array.from({ length: starCount }, () => ({
          x: Math.random() * rect.width,
          y: Math.random() * rect.height,
          size: Math.random() > 0.88 ? 2 : Math.random() > 0.45 ? 1.4 : 1,
          alpha: 0.16 + Math.random() * 0.34,
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

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function getProgress() {
    const elapsed = Date.now() - startedAt;
    return Math.max(0, Math.min(1, elapsed / DURATION_MS));
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

  function updateTimer(progress) {
    const remaining = Math.max(0, DURATION_MS - (Date.now() - startedAt));
    if (timerValue) timerValue.textContent = formatTime(remaining);

    if (timerCaption) {
      if (remaining <= 0) {
        timerCaption.textContent = 'ABSORPTION EN COURS';
      } else if (progress > 0.74) {
        timerCaption.textContent = 'ALERTE // LE CHAMP NOIR SE REFERME';
      } else if (progress > 0.42) {
        timerCaption.textContent = 'ROUTE PRIORITAIRE // FENETRE DE SURVIE LIMITEE';
      } else {
        timerCaption.textContent = '25 MINUTES AVANT CONVERGENCE';
      }
    }
  }

  function finishGame() {
    if (ended) return;
    ended = true;
    if (overlay) overlay.classList.add('is-visible');
  }

  function frame(time) {
    const progress = getProgress();
    drawSpace(time);
    updateTimer(progress);

    if (progress >= 1) finishGame();
    requestAnimationFrame(frame);
  }

  function bindCursor() {
    window.addEventListener('mousemove', event => {
      if (!cursor) return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
  }

  function bindDoors() {
    if (doorHotspotLeft) {
      doorHotspotLeft.addEventListener('click', () => toggleDoor('left'));
    }
    if (doorHotspotRight) {
      doorHotspotRight.addEventListener('click', () => toggleDoor('right'));
    }
  }

  function bindRoleOverlay() {
    if (roleDismiss) {
      roleDismiss.addEventListener('click', hideRoleOverlay);
    }

    window.addEventListener('keydown', event => {
      if (!roleOverlay || !roleOverlay.classList.contains('is-visible')) return;
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
        event.preventDefault();
        hideRoleOverlay();
      }
    });
  }

  function init() {
    applyRoleTheme();
    syncDoorShell();
    resize();
    bindCursor();
    bindDoors();
    bindRoleOverlay();
    maybeShowRoleOverlay();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  init();
})();
