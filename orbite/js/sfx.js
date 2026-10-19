/* ORBITE — sons.
   Échantillons des packs Kenney (CC0, voir audio/README.md), joués par WebAudio avec un léger
   hasard de hauteur et de volume pour qu'aucun coup ne sonne deux fois pareil. Une réverbération
   de grotte donne de la profondeur ; l'ambiance mêle un vent profond et des cristaux lointains.
   Si un fichier manque (page ouverte en file://, réseau coupé), un son synthétisé le remplace. */
(function () {
  'use strict';

  const KEY = 'orbite.mute';
  const MUSIC_KEY = 'orbite.musique';
  const MUSIC_VOL = 0.42;
  const BASE = 'audio/';
  const NAMES = [
    'hover', 'tap', 'type', 'open', 'close', 'back', 'error', 'roll', 'confirm', 'down', 'scratch', 'coin',
    'drop1', 'drop2', 'drop3', 'pluck1', 'pluck2', 'break', 'blast', 'zap', 'rise', 'wind',
    'glass1', 'glass2', 'glass3', 'glass4', 'glass5', 'glass6',
    'place1', 'place2', 'place3', 'place4', 'crumble1', 'crumble2', 'crumble3', 'crumble4'
  ];
  const GLASS = ['glass1', 'glass2', 'glass3', 'glass5', 'glass6'];
  const DROPS = ['drop1', 'drop2', 'drop3'];
  const PLACE = ['place1', 'place2', 'place3', 'place4'];
  const CRUMBLE = ['crumble1', 'crumble2', 'crumble3', 'crumble4'];

  // Ambiance par écran : niveau du vent, coupure du filtre, intervalle des cristaux (s).
  const MOODS = {
    off: { wind: 0, cut: 600, drips: 0 },
    wake: { wind: 0.14, cut: 420, drips: 0 },
    menu: { wind: 0.32, cut: 900, drips: [2.5, 7] },
    game: { wind: 0.18, cut: 650, drips: [7, 15] },
    battle: { wind: 0.12, cut: 380, drips: 0 }
  };

  let ctx = null, master, sfxBus, revIn, ambBus, windFilter;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (err) { muted = false; }
  const raw = {};
  const buffers = {};
  let mood = 'off';
  let windNext = 0, windTimer = 0, dripTimer = 0;
  let lastHover = 0;
  // Musique du menu (« Orbiting Wonder ») : lue en continu par un élément audio, sans tout décoder.
  let musicOn = true;
  try { musicOn = localStorage.getItem(MUSIC_KEY) !== '0'; } catch (err) { musicOn = true; }
  let musicEl = null, musicGain = null, musicWant = false, musicPause = 0;

  // Les fichiers sont téléchargés dès le chargement ; ils seront décodés au premier toucher.
  if (typeof fetch === 'function' && location.protocol !== 'file:') {
    for (const n of NAMES) {
      raw[n] = fetch(BASE + n + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
    }
  }

  function decode(data) {
    return new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
  }

  function impulse(seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.connect(master);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(3.2, 2.6);
    revIn = ctx.createGain();
    revIn.gain.value = 0.55;
    revIn.connect(verb).connect(master);
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 600;
    ambBus = ctx.createGain();
    ambBus.gain.value = 0;
    windFilter.connect(ambBus);
    ambBus.connect(master);
    for (const n of NAMES) {
      if (!raw[n]) continue;
      raw[n].then((data) => (data ? decode(data) : null)).then((b) => {
        if (!b) return;
        buffers[n] = b;
        if (n === 'wind') setMood(mood, true);
      }).catch(() => { /* fichier illisible : le son synthétisé prendra le relais */ });
    }
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) { ctx.suspend(); if (musicEl) musicEl.pause(); }
      else if (!muted) { ctx.resume(); if (musicWant) setMusic(true); }
    });
    if (musicWant) setMusic(true);
    return true;
  }

  // En HTTP(S), la musique passe par le graphe WebAudio (fondus fiables, même sur iPhone) ;
  // ouverte depuis un fichier, elle est lue directement (le navigateur refuserait le graphe).
  function musicNode() {
    if (musicEl || !ctx) return musicEl;
    musicEl = new Audio(BASE + 'menu.mp3');
    musicEl.loop = true;
    musicEl.preload = 'auto';
    if (location.protocol !== 'file:') {
      try {
        const src = ctx.createMediaElementSource(musicEl);
        musicGain = ctx.createGain();
        musicGain.gain.value = 0;
        src.connect(musicGain).connect(master);
      } catch (err) { musicGain = null; }
    }
    if (!musicGain) musicEl.volume = 0;
    return musicEl;
  }

  function setMusic(want) {
    musicWant = !!want;
    if (!ctx) return;
    const el = musicNode();
    const play = musicWant && musicOn && !muted && !document.hidden;
    clearTimeout(musicPause);
    if (play) {
      if (el.paused) el.play().catch(() => { /* lecture refusée : elle reprendra au prochain toucher */ });
      if (musicGain) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setTargetAtTime(MUSIC_VOL, ctx.currentTime, 1.1); }
      else fadeElement(el, MUSIC_VOL);
    } else {
      if (musicGain) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5); }
      else fadeElement(el, 0);
      musicPause = setTimeout(() => { if (!musicWant || !musicOn || muted) el.pause(); }, 2600);
    }
    if (ambBus) setMood(mood, false);
  }
  function fadeElement(el, to) {
    const from = el.volume, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 1500);
      el.volume = from + (to - from) * k;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function audio() {
    if (muted) return null;
    if (!ctx && !init()) return null;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const pick = (list) => (Array.isArray(list) ? list[Math.floor(Math.random() * list.length)] : list);
  const jitter = (k) => 1 + (Math.random() * 2 - 1) * k;

  // Joue un échantillon : vol, rate (hauteur), jit (hasard de hauteur), pan (-1..1),
  // rev (envoi vers la réverbération), delay (s), bus ('amb' pour l'ambiance).
  function play(name, o) {
    const a = audio();
    if (!a) return true;
    o = o || {};
    const buf = buffers[pick(name)];
    if (!buf) return false;
    const src = a.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = (o.rate || 1) * jitter(o.jit == null ? 0.05 : o.jit);
    const g = a.createGain();
    g.gain.value = (o.vol == null ? 0.5 : o.vol) * jitter(0.08);
    src.connect(g);
    let out = g;
    if (o.pan && a.createStereoPanner) {
      const p = a.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      out = p;
    }
    out.connect(o.bus === 'amb' ? ambBus : sfxBus);
    if (o.rev) {
      const s = a.createGain();
      s.gain.value = o.rev;
      out.connect(s).connect(revIn);
    }
    src.start(a.currentTime + (o.delay || 0));
    return true;
  }

  // ─── Ambiance ───────────────────────────────────────────────
  // Le vent tourne en boucle par fondus enchaînés de 4 s, sans couture audible.
  function scheduleWind() {
    clearTimeout(windTimer);
    const buf = buffers.wind;
    if (!ctx || !buf || MOODS[mood].wind <= 0) return;
    const X = 4;
    const now = ctx.currentTime;
    if (windNext < now + 0.05) windNext = now + 0.05;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, windNext);
    g.gain.linearRampToValueAtTime(1, windNext + X);
    g.gain.setValueAtTime(1, windNext + buf.duration - X);
    g.gain.linearRampToValueAtTime(0, windNext + buf.duration);
    src.connect(g).connect(windFilter);
    src.start(windNext);
    src.stop(windNext + buf.duration + 0.1);
    windNext += buf.duration - X;
    windTimer = setTimeout(scheduleWind, Math.max(1000, (windNext - ctx.currentTime - 6) * 1000));
  }

  // Cristaux lointains : un éclat de verre ou une goutte, grave, au loin, noyé dans la réverbération.
  function scheduleDrip() {
    clearTimeout(dripTimer);
    const d = MOODS[mood].drips;
    if (!d || !ctx) return;
    dripTimer = setTimeout(() => {
      if (!document.hidden && !muted) {
        play(Math.random() < 0.7 ? GLASS : DROPS, { bus: 'amb', vol: 0.05 + Math.random() * 0.06, rate: 0.35 + Math.random() * 0.35, jit: 0, pan: Math.random() * 1.4 - 0.7, rev: 1.3 });
      }
      scheduleDrip();
    }, (d[0] + Math.random() * (d[1] - d[0])) * 1000);
  }

  function setMood(name, force) {
    if (!MOODS[name]) name = 'off';
    const changed = name !== mood;
    mood = name;
    if (!ctx) return;
    const m = MOODS[name];
    const t = ctx.currentTime;
    ambBus.gain.cancelScheduledValues(t);
    const under = musicWant && musicOn && !muted ? 0.35 : 1;
    ambBus.gain.setTargetAtTime(m.wind * under, t, 0.9);
    windFilter.frequency.setTargetAtTime(m.cut, t, 0.8);
    if (m.wind > 0 && (windNext < t + 1 || force)) scheduleWind();
    if (changed || force) scheduleDrip();
  }

  // ─── Secours synthétisés ─────────────────────────────────────
  function tone(freq, dur, o) {
    const a = audio();
    if (!a) return;
    o = o || {};
    const t = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.05, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, o) {
    const a = audio();
    if (!a) return;
    o = o || {};
    const t = a.currentTime + (o.delay || 0);
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.cut || 1800;
    const g = a.createGain();
    g.gain.value = o.vol || 0.1;
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t);
  }

  const chime = (rates, o) => rates.forEach((r, i) => play('glass1', Object.assign({ rate: r, jit: 0.01, delay: i * (o.step || 0.07) }, o)));

  const SFX = {
    hover() {
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      play('hover', { vol: 0.1, jit: 0.08 });
    },
    tap() { play('tap', { vol: 0.32 }) || tone(880, 0.05, { vol: 0.03, type: 'square' }); },
    type() { play('type', { vol: 0.07, jit: 0.12 }) || tone(1500 + Math.random() * 300, 0.018, { vol: 0.012, type: 'triangle' }); },
    open() { play('open', { vol: 0.13, rate: 0.85 }); },
    close() { play('close', { vol: 0.1, rate: 0.9 }); },
    error() { play('error', { vol: 0.22 }) || tone(220, 0.12, { vol: 0.05, type: 'triangle' }); },
    start() {
      if (!play('rise', { vol: 0.55, rev: 0.4, jit: 0 })) {
        noise(0.9, { vol: 0.08, cut: 600 });
        [196, 262, 392, 523].forEach((f, i) => tone(f, 0.9, { delay: 0.12 + i * 0.1, vol: 0.05 }));
        return;
      }
      play('glass4', { vol: 0.32, rate: 0.7, rev: 0.9, delay: 1.42, jit: 0 });
      play('blast', { vol: 0.2, rate: 0.45, rev: 0.5, delay: 1.4, jit: 0 });
    },
    buy() { play(DROPS, { vol: 0.5, rev: 0.12 }) || (tone(660, 0.07, { type: 'square' }), tone(990, 0.1, { delay: 0.06, type: 'square' })); },
    place() {
      if (!play(PLACE, { vol: 0.6, rate: 0.8, rev: 0.15 })) { tone(220, 0.12, { type: 'triangle', to: 140, vol: 0.12 }); noise(0.08, { vol: 0.05, cut: 900 }); return; }
      play(DROPS, { vol: 0.12, rate: 0.6, delay: 0.03 });
    },
    // On soulève une planète pour la glisser.
    lift(pan) { play(['pluck1', 'pluck2'], { vol: 0.12, rate: 0.7, pan }); },
    // Petit déclic quand une planète glissée change d'orbite cible.
    slot() { play('tap', { vol: 0.12, rate: 1.4, jit: 0.1 }); },
    sell() { play(CRUMBLE, { vol: 0.32, rate: 1.1, rev: 0.15 }) ? play('back', { vol: 0.16 }) : tone(520, 0.12, { to: 260, type: 'square' }); },
    roll() { play('roll', { vol: 0.32 }) || [0, 1, 2, 3].forEach((i) => tone(400 + i * 120, 0.05, { delay: i * 0.04, vol: 0.035, type: 'square' })); },
    freeze() {
      if (!play('glass4', { vol: 0.3, rate: 1.15, rev: 0.6 })) { tone(1400, 0.2, { to: 1900, vol: 0.05 }); return; }
      play('glass2', { vol: 0.22, rate: 1.5, delay: 0.05 });
    },
    level() {
      if (!buffers.glass1) { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { delay: i * 0.07, vol: 0.05, type: 'square' })); return; }
      chime([1, 1.26, 1.5], { vol: 0.3, rev: 0.45 });
    },
    golden() {
      if (!buffers.glass1) { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.16, { delay: i * 0.06, type: 'triangle', vol: 0.07 })); return; }
      chime([1, 1.26, 1.5, 2, 2.52], { vol: 0.3, rev: 0.6, step: 0.065 });
      play('glass4', { vol: 0.28, rate: 0.9, rev: 1, delay: 0.32 });
    },
    whoosh(pan) { play('open', { vol: 0.16, rate: 0.55, jit: 0.08, pan }); },
    hit(power, pan) {
      power = power || 2;
      if (!play(PLACE, { vol: Math.min(0.75, 0.45 + power * 0.04), rate: 0.7, rev: 0.2, pan })) { noise(0.09, { vol: 0.14, cut: 1400 }); tone(140, 0.08, { type: 'triangle', vol: 0.08 }); return; }
      play('zap', { vol: 0.08, rate: 0.6, pan });
      if (power >= 4) play(CRUMBLE, { vol: Math.min(0.45, 0.15 + power * 0.03), rate: 0.85, pan, delay: 0.02 });
    },
    shield(pan) { play(['glass5', 'glass6'], { vol: 0.42, rate: 0.95, rev: 0.35, pan }) || tone(1800, 0.12, { to: 900, vol: 0.06 }); },
    death(pan) {
      if (!play('break', { vol: 0.5, rate: 0.8, rev: 0.25, pan })) { noise(0.35, { vol: 0.2, cut: 700 }); tone(110, 0.3, { type: 'triangle', to: 50, vol: 0.12 }); return; }
      play(CRUMBLE, { vol: 0.45, rate: 0.75, pan, delay: 0.03 });
      play('blast', { vol: 0.16, rate: 0.6, rev: 0.4, pan });
    },
    buff(pan) { play(['pluck1', 'pluck2'], { vol: 0.16, jit: 0.1, pan }) || tone(1046, 0.07, { vol: 0.04 }); },
    venom(pan) { play('scratch', { vol: 0.14, rate: 0.7, pan }); },
    summon(pan) { play('rise', { vol: 0.24, rate: 1.6, rev: 0.5, pan, jit: 0 }); },
    // Un fragment projeté par un astre qui s'effondre (Débris, Sonde…).
    debris(pan) {
      if (!play(CRUMBLE, { vol: 0.3, rate: 1.3, pan })) { noise(0.12, { vol: 0.08, cut: 2000 }); return; }
      play(PLACE, { vol: 0.35, rate: 1.2, pan, delay: 0.38 });
    },
    coin() { play('coin', { vol: 0.1, jit: 0.12 }); },
    // Passage de niveau : la planète se charge (souffle inversé, grondement)…
    charge() {
      if (!play('rise', { vol: 0.55, rate: 0.9, rev: 0.5, jit: 0 })) { tone(80, 1.5, { to: 240, type: 'triangle', vol: 0.06 }); return; }
      play('blast', { vol: 0.18, rate: 0.35, rev: 0.6, jit: 0 });
      play(CRUMBLE, { vol: 0.2, rate: 0.5, delay: 0.6 });
    },
    // … puis explose.
    explode() {
      if (!play('blast', { vol: 0.75, rate: 0.75, rev: 0.7, jit: 0 })) { noise(0.8, { vol: 0.25, cut: 900 }); return; }
      play('break', { vol: 0.5, rate: 0.7 });
      play(CRUMBLE, { vol: 0.5, rate: 0.6, delay: 0.05 });
      play('glass4', { vol: 0.3, rate: 0.6, rev: 1, delay: 0.1, jit: 0 });
    },
    win() {
      if (!buffers.glass1) { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, { delay: i * 0.09, type: 'triangle', vol: 0.07 })); return; }
      chime([1, 1.26, 1.5, 2], { vol: 0.28, rev: 0.6, step: 0.09 });
      play('confirm', { vol: 0.16, delay: 0.3, rev: 0.4 });
    },
    lose() {
      if (!play('down', { vol: 0.3, rev: 0.4 })) { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, { delay: i * 0.12, type: 'triangle', vol: 0.07 })); return; }
      play(CRUMBLE, { vol: 0.28, rate: 0.6, delay: 0.1, rev: 0.4 });
    },
    // Ambiance : 'off', 'wake', 'menu', 'game', 'battle'.
    ambience(name) { setMood(name); },
    // Musique du menu : true sur les écrans hors partie.
    music(on) { if (on !== musicWant) setMusic(on); },
    get musicOn() { return musicOn; },
    setMusicOn(v) {
      musicOn = !!v;
      try { localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
      if (!ctx && musicOn) audio();
      setMusic(musicWant);
    },
    // Nombre d'échantillons prêts (0 tant que le premier toucher n'a pas eu lieu).
    get loaded() { return Object.keys(buffers).length; },
    get muted() { return muted; },
    setMuted(v) {
      muted = !!v;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
      if (!ctx) { if (!muted) audio(); return; }
      if (muted) { ctx.suspend(); if (musicEl) musicEl.pause(); }
      else { ctx.resume(); setMood(mood, true); setMusic(musicWant); }
    }
  };

  window.OrbiteSfx = SFX;
})();
