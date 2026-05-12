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
  const activeRolePicto = document.getElementById('activeRolePicto');
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
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsTab = document.getElementById('arecibo-settings-tab');

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

    // Fond ouvert visible dès qu'une porte est ouverte
    if (bridgeShellOpen) bridgeShellOpen.classList.toggle('is-visible', anyOpen);

    // Écran fermé disparaît dès qu'une porte s'ouvre
    if (bridgeShellClosed) {
      bridgeShellClosed.classList.toggle('is-visible', !anyOpen);
      bridgeShellClosed.classList.toggle('is-hidden', anyOpen);
    }

    // Portes : glissent sur l'écran principal
    if (bridgeDoorLeft) {
      bridgeDoorLeft.classList.toggle('is-open', doorState.left);
      // Visible seulement si le fond ouvert est affiché (sinon inutile)
      bridgeDoorLeft.style.opacity = anyOpen ? '1' : '0';
    }
    if (bridgeDoorRight) {
      bridgeDoorRight.classList.toggle('is-open', doorState.right);
      bridgeDoorRight.style.opacity = anyOpen ? '1' : '0';
    }

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

  function toggleDoor(side) {
    doorState[side] = !doorState[side];
    syncDoorShell();
    // Plus de cinématique popup — l'animation est directement sur l'écran
  }

  const ROLE_PICTOS = {
    capitaine: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,2 14.6,9.2 22.2,9.2 16.3,13.8 18.5,21 12,16.4 5.5,21 7.7,13.8 1.8,9.2 9.4,9.2" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linejoin="round"/>
    </svg>`,
    timonier: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.3"/>
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.3"/>
      <line x1="12" y1="2.5" x2="12" y2="6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="12" y1="17.5" x2="12" y2="21.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="2.5" y1="12" x2="6.5" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="17.5" y1="12" x2="21.5" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="5.1" y1="5.1" x2="8" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="16" y1="16" x2="18.9" y2="18.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="18.9" y1="5.1" x2="16" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <line x1="8" y1="16" x2="5.1" y2="18.9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
    </svg>`,
    matelot: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="7.5" r="3.5" stroke="currentColor" stroke-width="1.3"/>
      <path d="M4.5 21c0-4.142 3.358-7.5 7.5-7.5s7.5 3.358 7.5 7.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="10.5" stroke="currentColor" stroke-width="1.1" stroke-dasharray="2 3"/>
    </svg>`
  };

  function applyRoleTheme() {
    document.documentElement.style.setProperty('--role-accent', currentRole.accent);
    document.documentElement.style.setProperty('--role-accent-soft', currentRole.soft);
    document.documentElement.style.setProperty('--role-accent-glow', currentRole.glow);

    if (activeRoleValue) activeRoleValue.textContent = currentRole.label;
    if (activeRolePicto) activeRolePicto.innerHTML = ROLE_PICTOS[currentRoleId] || ROLE_PICTOS.matelot;
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

  function isRoleOverlayVisible() {
    return !!(roleOverlay && roleOverlay.classList.contains('is-visible'));
  }

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

  function toggleSettings() {
    if (isSettingsOpen()) {
      closeSettings();
    } else {
      openSettings();
    }
  }

  function readAudioSliderValue(setting, fallback) {
    try {
      const raw = localStorage.getItem(`areciboAudioVolume:${setting}`);
      const value = Number(raw);
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
    } catch (err) {
      return fallback;
    }
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
    window.dispatchEvent(new CustomEvent('arecibo-audio-settings-change', {
      detail: { setting, value }
    }));
  }

  function selectLang(button) {
    if (!button || button.disabled || button.classList.contains('disabled')) return;
    document.querySelectorAll('#settings-overlay .lang-btn').forEach(node => node.classList.remove('sel'));
    button.classList.add('sel');
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
    if (typeof window.setAreciboPixelDither === 'function') {
      window.setAreciboPixelDither(mode);
    }
  }

  function toggleSwitch(node) {
    if (!node) return;
    node.classList.toggle('on');
  }

  function hydrateSettingsPanel() {
    if (!settingsOverlay) return;
    settingsOverlay.querySelectorAll('input[data-audio-setting]').forEach(input => {
      const fallback = Number(input.dataset.default) || Number(input.value) || 0;
      const value = readAudioSliderValue(input.dataset.audioSetting, fallback);
      input.value = value;
      const target = document.getElementById(input.dataset.valueId || '');
      if (target) target.textContent = `${value}%`;
    });
    syncPixelDitherButtons(settingsOverlay);
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

      const starCount = Math.max(32, Math.floor((rect.width * rect.height) / 2800));
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

  // ─── TROU NOIR ────────────────────────────────────────────────────
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
  }

  function bindSettings() {
    if (settingsTab) {
      settingsTab.addEventListener('click', toggleSettings);
    }

    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (isRoleOverlayVisible()) {
          hideRoleOverlay();
          return;
        }
        toggleSettings();
        return;
      }

      if (isRoleOverlayVisible() && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        hideRoleOverlay();
      }
    });
  }

  function init() {
    applyRoleTheme();
    syncDoorShell();
    hydrateSettingsPanel();
    resize();
    bindCursor();
    bindDoors();
    bindRoleOverlay();
    bindSettings();
    maybeShowRoleOverlay();
    requestAnimationFrame(frame);
  }

  window.openGameSettings = openSettings;
  window.closeGameSettings = closeSettings;
  window.updateGameSlider = updateSlider;
  window.selectGameLang = selectLang;
  window.selectGamePixelDither = selectPixelDither;
  window.toggleGameSwitch = toggleSwitch;

  window.addEventListener('resize', resize);
  window.addEventListener('arecibo-pixel-dither-change', () => syncPixelDitherButtons(settingsOverlay || document));
  init();
})();
