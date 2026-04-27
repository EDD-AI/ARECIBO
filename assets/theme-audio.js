(function () {
  const theme = document.body?.dataset.themeAudio || document.documentElement.dataset.themeAudio || '';
  if (!theme) return;

  const MUTE_KEY = 'areciboAudioMuted';
  const TRACKS = {
    menu: ['assets/audio/music/Main Title 1.mp3', 'assets/audio/music/Main Title 2.mp3'],
    lobby: ['assets/audio/music/Main Title 2.mp3'],
    ship: ['assets/audio/music/Main Title 2.mp3'],
    settings: ['assets/audio/music/Main Title 1.mp3']
  };

  const tracks = TRACKS[theme];
  if (!tracks || !tracks.length) return;

  const player = new Audio();
  let unlocked = false;
  let trackIndex = 0;

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
    player.volume = Math.max(0, Math.min(1, master * music));
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
    if (!tracks[index]) return false;
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
      player.pause();
      return;
    }
    syncVolume();
    if (!player.src && !loadTrack(0)) return;
    const playPromise = player.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  }

  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    playTheme();
  }

  player.preload = 'none';
  player.loop = false;
  player.addEventListener('ended', () => {
    if (!advanceTrack()) return;
    if (unlocked && !readMuted()) playTheme();
  });
  player.addEventListener('error', () => {
    if (!advanceTrack()) return;
    if (unlocked && !readMuted()) playTheme();
  });

  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  window.addEventListener('arecibo-audio-settings-change', syncVolume);
  window.addEventListener('arecibo-audio-muted-change', event => {
    if (event.detail && event.detail.muted) player.pause();
    else if (unlocked) playTheme();
    syncToggleButton(readMuted());
  });
  window.addEventListener('storage', event => {
    if (!event.key) return;
    if (event.key === MUTE_KEY) {
      const isMuted = readMuted();
      if (isMuted) player.pause();
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
})();
