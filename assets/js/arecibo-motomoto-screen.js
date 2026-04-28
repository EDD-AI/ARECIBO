(() => {
  const DURATION_MS = 25 * 60 * 1000;
  const params = new URLSearchParams(window.location.search);
  const sessionCode = params.get('sessionCode') || '';
  const mode = params.get('mode') || '';
  const timerKey = sessionCode ? `areciboMotomotoTimer:${sessionCode}` : '';

  const canvas = document.getElementById('spaceCanvas');
  const blackHoleLayer = document.getElementById('blackHoleLayer');
  const timerValue = document.getElementById('missionTimerValue');
  const timerCaption = document.getElementById('missionTimerCaption');
  const overlay = document.getElementById('endOverlay');
  const cursor = document.getElementById('cursor');
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

  let ctx = null;
  let viewportWidth = 0;
  let viewportHeight = 0;
  let stars = [];
  let particles = [];
  let ended = false;

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
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewportWidth * ratio);
    canvas.height = Math.floor(viewportHeight * ratio);
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;
    ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    buildStars();
    buildParticles();
  }

  function buildStars() {
    const count = Math.max(70, Math.floor((viewportWidth * viewportHeight) / 26000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * viewportWidth,
      y: Math.random() * viewportHeight,
      z: 0.18 + Math.random() * 0.92,
      size: Math.random() > 0.88 ? 2.4 : Math.random() > 0.45 ? 1.6 : 1,
      alpha: 0.18 + Math.random() * 0.44,
      pulse: 1.6 + Math.random() * 4.2,
      phase: Math.random() * Math.PI * 2
    }));
  }

  function buildParticles() {
    const count = Math.max(18, Math.floor(viewportWidth / 60));
    particles = Array.from({ length: count }, () => spawnParticle(true));
  }

  function spawnParticle(initial = false) {
    const side = Math.random();
    const yBand = viewportHeight * (0.14 + Math.random() * 0.56);
    return {
      x: initial ? Math.random() * viewportWidth * 0.86 : viewportWidth * (side < 0.86 ? 1.06 : 0.92 + Math.random() * 0.12),
      y: initial ? Math.random() * viewportHeight : yBand,
      driftX: -0.18 - Math.random() * 0.38,
      driftY: -0.1 + Math.random() * 0.2,
      radius: Math.random() > 0.84 ? 2.2 : 1.1 + Math.random() * 0.9,
      alpha: 0.16 + Math.random() * 0.24,
      orbit: 40 + Math.random() * 160,
      pull: 0.0009 + Math.random() * 0.0018
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

  function drawSpace(time, progress) {
    if (!ctx) return;

    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    ctx.fillStyle = '#020201';
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    const bhX = viewportWidth * 0.5;
    const bhY = viewportHeight * 0.4;
    const pullRadius = Math.min(viewportWidth, viewportHeight) * (0.18 + progress * 0.62);

    const fog = ctx.createRadialGradient(
      bhX,
      bhY,
      0,
      bhX,
      bhY,
      pullRadius * 1.25
    );
    fog.addColorStop(0, `rgba(255, 241, 208, ${0.015 + progress * 0.12})`);
    fog.addColorStop(0.36, `rgba(255, 193, 102, ${0.02 + progress * 0.08})`);
    fog.addColorStop(0.72, `rgba(250, 90, 31, ${0.01 + progress * 0.05})`);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    stars.forEach(star => {
      const twinkle = 0.82 + Math.sin(time * 0.001 * star.pulse + star.phase) * 0.18;
      const dx = bhX - star.x;
      const dy = bhY - star.y;
      const dist = Math.hypot(dx, dy);
      const warp = Math.max(0, 1 - dist / (pullRadius * 1.55));
      const stretch = warp * progress * 16 * star.z;
      const angle = Math.atan2(dy, dx);
      const size = star.size * (1 + warp * 0.4);

      ctx.save();
      ctx.translate(star.x, star.y);
      ctx.rotate(angle);
      ctx.globalAlpha = Math.min(1, star.alpha * twinkle * (1 + warp * 0.9));
      ctx.fillStyle = 'rgba(247,255,195,1)';
      ctx.fillRect(-size * 0.5, -size * 0.5, size + stretch, size);
      ctx.restore();
    });

    particles.forEach((particle, index) => {
      const dx = bhX - particle.x;
      const dy = bhY - particle.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const force = particle.pull * (0.5 + progress * 2.4);
      particle.driftX += (dx / dist) * force * 18;
      particle.driftY += (dy / dist) * force * 18;
      particle.x += particle.driftX;
      particle.y += particle.driftY;

      const tailX = particle.x - particle.driftX * 18;
      const tailY = particle.y - particle.driftY * 18;
      const grad = ctx.createLinearGradient(particle.x, particle.y, tailX, tailY);
      grad.addColorStop(0, `rgba(247,255,195,${particle.alpha + progress * 0.08})`);
      grad.addColorStop(1, 'rgba(247,255,195,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = particle.radius;
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      ctx.globalAlpha = particle.alpha + progress * 0.1;
      ctx.fillStyle = progress > 0.62 ? 'rgba(255,226,168,1)' : 'rgba(247,255,195,1)';
      ctx.fillRect(particle.x, particle.y, particle.radius, particle.radius);
      ctx.globalAlpha = 1;

      if (dist < Math.max(18, pullRadius * 0.12) || particle.x < -40 || particle.y < -40 || particle.y > viewportHeight + 40) {
        particles[index] = spawnParticle(false);
      }
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

  function updateBlackHole(progress) {
    if (!blackHoleLayer) return;
    blackHoleLayer.style.setProperty('--bh-progress', progress.toFixed(4));
  }

  function finishGame() {
    if (ended) return;
    ended = true;
    if (overlay) overlay.classList.add('is-visible');
  }

  function frame(time) {
    const progress = getProgress();
    drawSpace(time, progress);
    updateBlackHole(progress);
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
    resize();
    bindCursor();
    bindRoleOverlay();
    maybeShowRoleOverlay();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  init();
})();
