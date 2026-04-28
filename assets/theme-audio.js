(function () {
  const theme = document.body?.dataset.themeAudio || document.documentElement.dataset.themeAudio || '';
  if (!theme) return;

  const MUTE_KEY = 'areciboAudioMuted';
  const PRIMED_KEY = 'areciboAudioPrimed';
  const TRACKS = {
    menu: ['assets/audio/music/Main Title 1.mp3', 'assets/audio/music/Main Title 2.mp3']
  };
  const AMBIENCE_TRACKS = {
    intro: {
      src: 'assets/audio/ambience/SD_AMB_SHIP_01.mp3',
      gain: 0.46
    },
    ship: {
      src: 'assets/audio/ambience/SD_AMB_SHIP_02.mp3',
      gain: 0.46
    }
  };

  const tracks = TRACKS[theme] || [];
  const ambienceConfig = AMBIENCE_TRACKS[theme] || null;
  if (!tracks.length && !ambienceConfig) return;

  const player = tracks.length ? new Audio() : null;
  const ambiencePlayer = ambienceConfig ? new Audio() : null;
  const hoverTracks = [
    'assets/audio/effects/SD_UI_HOVER_01.mp3',
    'assets/audio/effects/SD_UI_HOVER_02.mp3',
    'assets/audio/effects/SD_UI_HOVER_03.mp3'
  ];
  const clickTrack = 'assets/audio/effects/SD_UI_CLICK.mp3';
  const startTrack = 'assets/audio/effects/SD_UI_START.mp3';
  let unlocked = false;
  let trackIndex = 0;
  let activeHover = null;
  let activeClick = null;
  let activeStart = null;
  let lastHoverAt = 0;

  function readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === 'true'; }
    catch (err) { return false; }
  }

  function writeMuted(isMuted) {
    try { localStorage.setItem(MUTE_KEY, String(isMuted)); }
    catch (err) {}
  }

  function readVolume(setting, fallback) {
    try {
      const value = Number(localStorage.getItem(`areciboAudioVolume:${setting}`));
      return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function syncVolume() {
    const master = readVolume('master', 80) / 100;
    const music = readVolume('music', 60) / 100;
    const effects = readVolume('effects', 60) / 100;
    if (player) {
      player.volume = Math.max(0, Math.min(1, master * music));
    }
    if (ambiencePlayer && ambienceConfig) {
      ambiencePlayer.volume = Math.max(0, Math.min(1, master * effects * ambienceConfig.gain));
    }
  }

  function readEffectsVolume() {
    const master = readVolume('master', 80) / 100;
    const effects = readVolume('effects', 60) / 100;
    return Math.max(0, Math.min(1, master * effects));
  }

  function stopHoverSound() {
    if (!activeHover) return;
    try {
      activeHover.pause();
      activeHover.currentTime = 0;
    } catch (err) {}
    activeHover = null;
  }

  function playHoverSound() {
    if (!unlocked || readMuted() || !hoverTracks.length) return;

    const now = performance.now();
    if (now - lastHoverAt < 55) return;
    lastHoverAt = now;

    stopHoverSound();

    const src = hoverTracks[Math.floor(Math.random() * hoverTracks.length)];
    const hover = new Audio(src);
    hover.preload = 'auto';
    hover.volume = readEffectsVolume() * 0.48;
    hover.playbackRate = 0.975 + Math.random() * 0.055;
    hover.preservesPitch = false;
    activeHover = hover;

    const playPromise = hover.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }

    hover.addEventListener('ended', () => {
      if (activeHover === hover) activeHover = null;
    }, { once: true });
  }

  function stopStartSound() {
    if (!activeStart) return;
    try {
      activeStart.pause();
      activeStart.currentTime = 0;
    } catch (err) {}
    activeStart = null;
  }

  function stopClickSound() {
    if (!activeClick) return;
    try {
      activeClick.pause();
      activeClick.currentTime = 0;
    } catch (err) {}
    activeClick = null;
  }

  function playClickSound() {
    if (!unlocked || readMuted() || !clickTrack) return;

    stopClickSound();

    const click = new Audio(clickTrack);
    click.preload = 'auto';
    click.volume = Math.min(1, readEffectsVolume() * 0.72);
    click.playbackRate = 0.985 + Math.random() * 0.035;
    click.preservesPitch = false;
    activeClick = click;

    const playPromise = click.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }

    click.addEventListener('ended', () => {
      if (activeClick === click) activeClick = null;
    }, { once: true });
  }

  function playStartSound() {
    if (!unlocked || readMuted() || !startTrack) return;

    stopHoverSound();
    stopStartSound();

    const start = new Audio(startTrack);
    start.preload = 'auto';
    start.volume = Math.min(1, readEffectsVolume() * 0.84);
    start.playbackRate = 0.988 + Math.random() * 0.028;
    start.preservesPitch = false;
    activeStart = start;

    const playPromise = start.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }

    start.addEventListener('ended', () => {
      if (activeStart === start) activeStart = null;
    }, { once: true });
  }

  function syncToggleButton(isMuted) {
    const button = document.getElementById('sound-toggle');
    if (!button) return;
    button.classList.toggle('is-muted', isMuted);
    button.setAttribute('aria-pressed', String(isMuted));
    button.setAttribute('aria-label', isMuted ? 'Activer le son' : 'Couper le son');
    button.title = isMuted ? 'Activer le son' : 'Couper le son';
  }

  function broadcastMuted(isMuted) {
    document.documentElement.dataset.audioMuted = String(isMuted);
    syncToggleButton(isMuted);
    window.dispatchEvent(new CustomEvent('arecibo-audio-muted-change', {
      detail: { muted: isMuted }
    }));
  }

  function loadTrack(index) {
    if (!player || !tracks[index]) return false;
    trackIndex = index;
    player.src = tracks[index];
    player.load();
    return true;
  }

  function advanceTrack() {
    if (!tracks.length) return false;
    const nextIndex = (trackIndex + 1) % tracks.length;
    return loadTrack(nextIndex);
  }

  function playTheme() {
    if (readMuted()) {
      if (player) player.pause();
      if (ambiencePlayer) ambiencePlayer.pause();
      return;
    }
    syncVolume();
    if (player) {
      if (!player.src && !loadTrack(0)) return;
      const playPromise = player.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }
    if (ambiencePlayer && ambienceConfig) {
      if (!ambiencePlayer.src) {
        ambiencePlayer.src = ambienceConfig.src;
        ambiencePlayer.load();
      }
      ambiencePlayer.loop = true;
      const ambiencePromise = ambiencePlayer.play();
      if (ambiencePromise && typeof ambiencePromise.catch === 'function') {
        ambiencePromise.catch(() => {});
      }
    }
  }

  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    try { sessionStorage.setItem(PRIMED_KEY, 'true'); } catch (err) {}
    playTheme();
  }

  if (player) {
    player.preload = 'none';
    player.loop = false;
  }
  if (ambiencePlayer) {
    ambiencePlayer.preload = 'none';
    ambiencePlayer.loop = true;
  }
  if (player) {
    player.addEventListener('ended', () => {
      if (!advanceTrack()) return;
      if (unlocked && !readMuted()) playTheme();
    });
    player.addEventListener('error', () => {
      if (!advanceTrack()) return;
      if (unlocked && !readMuted()) playTheme();
    });
  }

  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  const hoverSelectors = [
    '.menu-item',
    '.sound-toggle',
    '.discord',
    '.multi-choice-action',
    '.multi-choice-close',
    '.sp-close',
    '.lang-btn:not(.disabled):not(:disabled)',
    '.pixel-btn',
    '.credits-close'
  ];
  const clickSelectors = [
    '.menu-item',
    '.sound-toggle',
    '.discord',
    '.multi-choice-action',
    '.multi-choice-close',
    '.sp-close',
    '.lang-btn:not(.disabled):not(:disabled)',
    '.pixel-btn',
    '.credits-close',
    '.role-card-dismiss',
    '#arecibo-settings-tab'
  ];

  function bindHoverSounds() {
    document.querySelectorAll(hoverSelectors.join(',')).forEach(node => {
      if (node.dataset.hoverSoundBound === 'true') return;
      node.dataset.hoverSoundBound = 'true';
      node.addEventListener('mouseenter', playHoverSound);
      node.addEventListener('focus', playHoverSound);
    });
  }

  function bindClickSounds() {
    document.querySelectorAll(clickSelectors.join(',')).forEach(node => {
      if (node.dataset.clickSoundBound === 'true') return;
      node.dataset.clickSoundBound = 'true';
      node.addEventListener('click', playClickSound);
    });
  }

  bindHoverSounds();
  bindClickSounds();
  document.addEventListener('mouseover', event => {
    if (!event.target || typeof event.target.closest !== 'function') return;
    const target = event.target.closest(hoverSelectors.join(','));
    if (!target) return;
    if (target.dataset.hoverSoundBound === 'true') return;
    bindHoverSounds();
  });
  document.addEventListener('click', event => {
    if (!event.target || typeof event.target.closest !== 'function') return;
    const target = event.target.closest(clickSelectors.join(','));
    if (!target) return;
    if (target.dataset.clickSoundBound === 'true') return;
    bindClickSounds();
  });

  window.addEventListener('arecibo-audio-settings-change', syncVolume);
  window.addEventListener('arecibo-audio-muted-change', event => {
    if (event.detail && event.detail.muted) {
      if (player) player.pause();
      if (ambiencePlayer) ambiencePlayer.pause();
    }
    else if (unlocked) playTheme();
    syncToggleButton(readMuted());
  });
  window.addEventListener('storage', event => {
    if (!event.key) return;
    if (event.key === MUTE_KEY) {
      const isMuted = readMuted();
      if (isMuted) {
        if (player) player.pause();
        if (ambiencePlayer) ambiencePlayer.pause();
      }
      else if (unlocked) playTheme();
      syncToggleButton(isMuted);
      return;
    }
    if (event.key.indexOf('areciboAudioVolume:') === 0) {
      syncVolume();
    }
  });

  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    soundToggle.addEventListener('click', () => {
      const muted = !soundToggle.classList.contains('is-muted');
      writeMuted(muted);
      broadcastMuted(muted);
      if (!muted && unlocked) playTheme();
    });
  }

  broadcastMuted(readMuted());
  syncVolume();
  try {
    if (sessionStorage.getItem(PRIMED_KEY) === 'true') {
      unlocked = true;
      setTimeout(() => {
        if (!readMuted()) playTheme();
      }, 60);
    }
  } catch (err) {}
  window.playAreciboStartSound = playStartSound;
  window.playAreciboClickSound = playClickSound;
})();
