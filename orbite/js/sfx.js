/* ORBITE — sons.
   Échantillons des packs Kenney (CC0) et sons d'ARECIBO (Studio Edda), voir audio/README.md, joués
   par WebAudio avec un léger hasard de hauteur et de volume pour qu'aucun coup ne sonne deux fois
   pareil. Une réverbération de grotte donne de la profondeur ; l'ambiance mêle un vent profond, des
   cristaux lointains et les nappes d'ARECIBO (espace, vaisseau).
   Si un fichier manque (page ouverte en file://, réseau coupé), un son synthétisé le remplace. */
(function () {
  'use strict';

  const KEY = 'orbite.mute';
  const MUSIC_KEY = 'orbite.musique';
  const MUSIC_VOL = 0.42;
  // Volumes réglés par le joueur (0 à 1) : la musique d'un côté, les effets et l'ambiance de l'autre.
  const VOL_MUSIC_KEY = 'orbite.volMusique', VOL_FX_KEY = 'orbite.volSons';
  const readVol = (k) => { try { const v = Number(localStorage.getItem(k)); return localStorage.getItem(k) == null || !Number.isFinite(v) ? 1 : Math.max(0, Math.min(1, v)); } catch (err) { return 1; } };
  let musicVol = readVol(VOL_MUSIC_KEY), fxVol = readVol(VOL_FX_KEY);
  const BASE = 'audio/';
  const NAMES = [
    'hover', 'tap', 'type', 'back', 'error', 'roll', 'confirm', 'down', 'scratch', 'coin',
    'drop1', 'drop2', 'drop3', 'pluck1', 'pluck2', 'break', 'blast', 'rise', 'wind',
    'glass1', 'glass2', 'glass3', 'glass4', 'glass5', 'glass6',
    'place1', 'place2', 'place3', 'place4', 'crumble1', 'crumble2', 'crumble3', 'crumble4',
    'click1', 'click2', 'click3', 'click4', 'click5',
    // Sons d'ARECIBO.
    'ui-click', 'ui-hover1', 'ui-hover2', 'ui-hover3', 'ui-text', 'ui-start', 'ui-on', 'ui-off', 'ui-wrong', 'jingle', 'alarm'
  ];
  const HOVERS = ['ui-hover1', 'ui-hover2', 'ui-hover3'];
  const GLASS = ['glass1', 'glass2', 'glass3', 'glass5', 'glass6'];
  const DROPS = ['drop1', 'drop2', 'drop3'];
  const PLACE = ['place1', 'place2', 'place3', 'place4'];
  const CRUMBLE = ['crumble1', 'crumble2', 'crumble3', 'crumble4'];
  // Déclics des boutons, avec leur volume (les plus secs sont joués plus bas).
  const CLICKS = { click1: 0.3, click2: 0.28, click3: 0.3, click4: 0.17, click5: 0.16 };
  let lastClick = '';

  // Ambiance par écran : niveau du vent, coupure du filtre, intervalle des cristaux (s), et nappe
  // d'ARECIBO (bed) avec son niveau.
  const MOODS = {
    off: { wind: 0, cut: 600, drips: 0 },
    wake: { wind: 0.06, cut: 420, drips: 0, bed: 'ship1', bedVol: 0.55 },
    menu: { wind: 0.32, cut: 900, drips: [2.5, 7] },
    game: { wind: 0.06, cut: 650, drips: [9, 18], bed: 'space1', bedVol: 0.5 },
    battle: { wind: 0, cut: 380, drips: 0, bed: 'space3', bedVol: 0.6 },
    end: { wind: 0.06, cut: 650, drips: [9, 18], bed: 'space2', bedVol: 0.5 },
    ship: { wind: 0, cut: 600, drips: 0, bed: 'ship3', bedVol: 0.5 },
    atelier: { wind: 0.1, cut: 700, drips: [6, 14], bed: 'ship2', bedVol: 0.45 }
  };

  let ctx = null, master, fxMaster, sfxBus, revIn, ambBus, windFilter, bedBus;
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
    // Effets, réverbération, vent et nappes passent par fxMaster (volume des effets) ; la musique,
    // par son propre gain (volume de la musique).
    fxMaster = ctx.createGain();
    fxMaster.gain.value = fxVol;
    fxMaster.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.connect(fxMaster);
    const verb = ctx.createConvolver();
    verb.buffer = impulse(3.2, 2.6);
    revIn = ctx.createGain();
    revIn.gain.value = 0.55;
    revIn.connect(verb).connect(fxMaster);
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 600;
    ambBus = ctx.createGain();
    ambBus.gain.value = 0;
    windFilter.connect(ambBus);
    ambBus.connect(fxMaster);
    bedBus = ctx.createGain();
    bedBus.gain.value = 0;
    bedBus.connect(fxMaster);
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
      if (document.hidden) { ctx.suspend(); if (musicEl) musicEl.pause(); pauseBeds(); }
      else if (!muted) { ctx.resume(); if (musicWant) setMusic(true); setBed(MOODS[mood].bed, true); }
    });
    if (musicWant) setMusic(true);
    return true;
  }

  // En HTTP(S), la musique passe par le graphe WebAudio (fondus fiables, même sur iPhone) ;
  // ouverte depuis un fichier, elle est lue directement (le navigateur refuserait le graphe).
  // Quatre morceaux qui se suivent, nommés dans le lecteur du menu (v89) : le thème d'ARECIBO
  // (l'ancien jeu), puis Odyssée, Space Marianne et Nuclear. Le morceau en cours est retenu.
  const TRACKS = [
    { file: 'arecibo1.mp3', name: 'ARECIBO' },
    { file: 'earth.mp3', name: 'Odyssée' },
    { file: 'arecibo2.mp3', name: 'Space Marianne' },
    { file: 'menu.mp3', name: 'Nuclear' }
  ];
  const TRACK_KEY = 'orbite.piste';
  let track = (() => { try { const n = Number(localStorage.getItem(TRACK_KEY)) | 0; return n >= 0 && n < TRACKS.length ? n : 0; } catch (err) { return 0; } })();
  // Le lecteur du menu suit la musique : morceau, lecture ou pause.
  const musicChanged = () => { try { window.dispatchEvent(new Event('orbite-music')); } catch (err) { /* sans importance */ } };
  function setTrack(i) {
    track = (i + TRACKS.length) % TRACKS.length;
    try { localStorage.setItem(TRACK_KEY, String(track)); } catch (err) { /* stockage indisponible */ }
    if (musicEl) {
      musicEl.src = BASE + TRACKS[track].file;
      if (musicWant && musicOn && !muted && !document.hidden) musicEl.play().catch(() => { /* reprendra au prochain toucher */ });
    }
    musicChanged();
  }
  function musicNode() {
    if (musicEl || !ctx) return musicEl;
    musicEl = new Audio(BASE + TRACKS[track].file);
    musicEl.loop = false;
    musicEl.preload = 'auto';
    musicEl.addEventListener('ended', () => setTrack(track + 1));
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
      if (musicGain) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setTargetAtTime(MUSIC_VOL * musicVol, ctx.currentTime, 1.1); }
      else fadeElement(el, MUSIC_VOL * musicVol);
    } else {
      if (musicGain) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5); }
      else fadeElement(el, 0);
      musicPause = setTimeout(() => { if (!musicWant || !musicOn || muted) el.pause(); }, 2600);
    }
    if (ambBus) setMood(mood, false);
  }
  function fadeElement(el, to) { fadeElementTo(el, to, 1500); }
  function fadeElementTo(el, to, ms) {
    const from = el.volume, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
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

  // ─── Nappes d'ARECIBO ───────────────────────────────────────
  // Espace et vaisseau : lues en continu par deux éléments audio qui se relaient en fondu avant la
  // fin du fichier (pas de couture), sans tout décoder en mémoire. Créées au premier besoin.
  const BED_X = 3; // durée du fondu enchaîné (s)
  const beds = {};
  let bedName = null;
  function bedEl(b, i) {
    if (b.els[i]) return b.els[i];
    const el = new Audio(BASE + b.name + '.mp3');
    el.preload = 'auto';
    let g = null;
    if (location.protocol !== 'file:') {
      try {
        const src = ctx.createMediaElementSource(el);
        g = ctx.createGain();
        g.gain.value = 0;
        src.connect(g).connect(bedBus);
      } catch (err) { g = null; }
    }
    if (!g) el.volume = 0;
    el.addEventListener('timeupdate', () => {
      // Le relais : l'autre lecteur part du début quand celui-ci approche de la fin.
      if (bedName !== b.name || b.cur !== i || !el.duration || el.currentTime < el.duration - BED_X) return;
      b.cur = 1 - i;
      bedFade(b, 1 - i, 1, BED_X, true);
      bedFade(b, i, 0, BED_X);
    });
    b.els[i] = el;
    b.gains[i] = g;
    return el;
  }
  // Fondu d'un lecteur vers to (0..1) ; restart : repart du début.
  function bedFade(b, i, to, sec, restart) {
    const el = bedEl(b, i), g = b.gains[i];
    clearTimeout(b.stop[i]);
    if (to > 0) {
      if (restart) { try { el.currentTime = 0; } catch (err) { /* pas encore chargé */ } }
      if (el.paused) el.play().catch(() => { /* reprendra au prochain toucher */ });
    } else b.stop[i] = setTimeout(() => el.pause(), sec * 1000 + 200);
    const level = to * (g ? 1 : bedBusLevel());
    if (g) { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setTargetAtTime(level, ctx.currentTime, sec / 3); }
    else fadeElementTo(el, level, sec * 1000);
  }
  function bedBusLevel() {
    const m = MOODS[mood];
    return (m.bedVol || 0) * (musicWant && musicOn && !muted ? 0.35 : 1);
  }
  // Passe à la nappe name (ou au silence) en fondu ; force : relance celle en cours.
  function setBed(name, force) {
    if (!ctx || muted) return;
    if (name === bedName && !force) return;
    for (const b of Object.values(beds)) if (b.name !== name) for (let i = 0; i < 2; i++) if (b.els[i]) bedFade(b, i, 0, 1.5);
    bedName = name || null;
    if (!name) return;
    const b = beds[name] || (beds[name] = { name, els: [], gains: [], stop: [], cur: 0 });
    bedFade(b, b.cur, 1, 2, !b.els[b.cur] || b.els[b.cur].paused);
  }
  function pauseBeds() { for (const b of Object.values(beds)) for (const el of b.els) if (el) el.pause(); }

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
    bedBus.gain.cancelScheduledValues(t);
    bedBus.gain.setTargetAtTime((m.bedVol || 0) * under, t, 0.9);
    setBed(m.bed, force && !document.hidden);
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

  // Chœur d'âmes : chaque note est chantée par trois voix un peu désaccordées (dents de scie) qui
  // passent par les formants d'une voyelle. La bouche s'ouvre pendant la montée (« ou » → « a »),
  // le vibrato arrive avec elle, et la fin se perd dans la réverbération.
  function choir(notes, o) {
    const a = audio();
    if (!a) return;
    o = o || {};
    const t = a.currentTime + (o.delay || 0);
    const vol = o.vol || 0.12, rise = o.rise || 0.9, hold = o.hold || 0.5, fall = o.fall || 1.6;
    const end = t + rise + hold + fall;
    const env = a.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + rise);
    env.gain.setValueAtTime(vol, t + rise + hold);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(sfxBus);
    const send = a.createGain();
    send.gain.value = o.rev == null ? 1 : o.rev;
    env.connect(send).connect(revIn);
    const voices = a.createGain();
    voices.gain.value = 1 / Math.sqrt(notes.length * 3);
    // Formants : de « ou » (300, 870, 2240 Hz) à « a » (800, 1150, 2900 Hz).
    for (const [f0, f1, lvl] of [[300, 800, 4], [870, 1150, 2], [2240, 2900, 0.7]]) {
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 8;
      bp.frequency.setValueAtTime(f0, t);
      bp.frequency.exponentialRampToValueAtTime(f1, t + rise);
      const g = a.createGain();
      g.gain.value = lvl;
      voices.connect(bp).connect(g).connect(env);
    }
    const lfo = a.createOscillator(), depth = a.createGain();
    lfo.frequency.value = 5.1;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(12, t + rise);
    lfo.connect(depth);
    lfo.start(t);
    lfo.stop(end + 0.05);
    notes.forEach((f, i) => {
      const pan = notes.length > 1 ? (i / (notes.length - 1)) * 1.2 - 0.6 : 0;
      for (const d of [-9, 0, 8]) {
        const osc = a.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = d + (Math.random() * 2 - 1) * 3;
        depth.connect(osc.detune);
        let out = osc;
        if (a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = pan + d / 40; out = osc.connect(p); }
        out.connect(voices);
        osc.start(t);
        osc.stop(end + 0.05);
      }
    });
  }

  // Souffle naturel : bruit passé dans un filtre passe-bande qui s'ouvre puis se referme.
  function swoosh(pan) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime, d = 0.22 + Math.random() * 0.1;
    const len = Math.floor(a.sampleRate * d);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    const f0 = 380 + Math.random() * 220;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.linearRampToValueAtTime(f0 * 1.6, t + d * 0.5);
    f.frequency.linearRampToValueAtTime(f0 * 0.9, t + d);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + d * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + d);
    let out = src.connect(f).connect(g);
    if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); out = out.connect(p); }
    out.connect(sfxBus);
    src.start(t);
  }

  const chime = (rates, o) => rates.forEach((r, i) => play('glass1', Object.assign({ rate: r, jit: 0.01, delay: i * (o.step || 0.07) }, o)));

  const SFX = {
    hover() {
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      play(HOVERS, { vol: 0.2, jit: 0.03 }) || play('hover', { vol: 0.1, jit: 0.08 });
    },
    // Le déclic d'ARECIBO, à hauteur à peine variable ; sinon, un déclic tiré parmi cinq, jamais
    // deux fois le même de suite, avec de temps en temps un petit caillou pour le grain naturel.
    tap() {
      if (play('ui-click', { vol: 0.36, jit: 0.03 })) return;
      const names = Object.keys(CLICKS).filter((n) => n !== lastClick && buffers[n]);
      if (!names.length) { play('tap', { vol: 0.32 }) || tone(880, 0.05, { vol: 0.03, type: 'square' }); return; }
      const n = pick(names);
      lastClick = n;
      play(n, { vol: CLICKS[n], jit: 0.1 });
      if (Math.random() < 0.3) play(PLACE, { vol: 0.06, rate: 1.7, jit: 0.15, delay: 0.005 });
    },
    type() { play('ui-text', { vol: 0.16, jit: 0.06 }) || play('type', { vol: 0.07, jit: 0.12 }) || tone(1500 + Math.random() * 300, 0.018, { vol: 0.012, type: 'triangle' }); },
    // Ouvrir ou fermer une fiche : un petit caillou posé, jamais tout à fait le même, parfois
    // un tintement de cristal très léger. Pas de balayage de hauteur (effet « laser »).
    open() {
      play(PLACE, { vol: 0.13, rate: 1.55, jit: 0.14 });
      if (Math.random() < 0.4) play(GLASS, { vol: 0.03, rate: 2.2, jit: 0.1, rev: 0.6, delay: 0.015 });
    },
    close() { play(PLACE, { vol: 0.08, rate: 1.2, jit: 0.14 }); },
    error() { play('ui-wrong', { vol: 0.34, jit: 0.02 }) || play('error', { vol: 0.22 }) || tone(220, 0.12, { vol: 0.05, type: 'triangle' }); },
    // Allumage et extinction d'un grand écran (Marché, Création, Multijoueur…), comme les consoles
    // d'ARECIBO.
    on() { play('ui-on', { vol: 0.26, jit: 0.02 }); },
    off() { play('ui-off', { vol: 0.22, jit: 0.02 }); },
    // « Touchez pour commencer » : le son de démarrage d'ARECIBO, sinon le souffle inversé.
    start() {
      if (play('ui-start', { vol: 0.55, jit: 0, rev: 0.15 })) return;
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
    slot() { play(Object.keys(CLICKS), { vol: 0.1, rate: 1.3, jit: 0.12 }); },
    sell() { play(CRUMBLE, { vol: 0.32, rate: 1.1, rev: 0.15 }) ? play('back', { vol: 0.16 }) : tone(520, 0.12, { to: 260, type: 'square' }); },
    roll() { play('roll', { vol: 0.32 }) || [0, 1, 2, 3].forEach((i) => tone(400 + i * 120, 0.05, { delay: i * 0.04, vol: 0.035, type: 'square' })); },
    freeze() {
      if (!play('glass4', { vol: 0.3, rate: 1.15, rev: 0.6 })) { tone(1400, 0.2, { to: 1900, vol: 0.05 }); return; }
      play('glass2', { vol: 0.22, rate: 1.5, delay: 0.05 });
    },
    // Une planète prise dans la glace : craquement cristallin, un peu plus aigu à chaque planète.
    frost(i) {
      play(GLASS, { vol: 0.2, rate: 1.25 + (i || 0) * 0.12, jit: 0.04, rev: 0.5 });
      play(PLACE, { vol: 0.08, rate: 2.2, jit: 0.1 });
    },
    // Dégel : la glace se brise.
    thaw() {
      if (!play(['glass5', 'glass6'], { vol: 0.32, rate: 1.3, rev: 0.3 })) { tone(1600, 0.1, { to: 700, vol: 0.05 }); return; }
      play(CRUMBLE, { vol: 0.14, rate: 1.8, delay: 0.03 });
    },
    level() {
      if (!buffers.glass1) { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { delay: i * 0.07, vol: 0.05, type: 'square' })); return; }
      chime([1, 1.26, 1.5], { vol: 0.3, rev: 0.45 });
    },
    // Légendaire : carillon montant puis grand accord qui résonne ; big = achat.
    legend(big) {
      if (!buffers.glass1) { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, 0.22, { delay: i * 0.07, type: 'triangle', vol: 0.07 })); return; }
      chime([0.75, 1, 1.26, 1.5, 2, 2.52, 3], { vol: big ? 0.34 : 0.26, rev: 0.8, step: 0.055 });
      play('glass4', { vol: 0.3, rate: 0.75, rev: 1.2, delay: 0.38 });
      if (big) { play('glass1', { vol: 0.26, rate: 0.6, rev: 1.4, delay: 0.55 }); chime([0.5, 0.75, 1], { vol: 0.22, rev: 1, delay: 0.7 }); }
    },
    // Récompense dorée (boosts, succès, campagne…) : carillon de cristal.
    golden() {
      if (!buffers.glass1) { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.16, { delay: i * 0.06, type: 'triangle', vol: 0.07 })); return; }
      chime([1, 1.26, 1.5, 2, 2.52], { vol: 0.3, rev: 0.6, step: 0.065 });
      play('glass4', { vol: 0.28, rate: 0.9, rev: 1, delay: 0.32 });
    },
    // Fusion dorée (trois exemplaires), et elle seule : un chœur d'âmes monte pendant que les trois
    // astres convergent (« ou… »), s'ouvre sur l'éclat doré (« aah ») avec une couronne de cristaux
    // et un halo aigu, puis s'éteint dans l'espace. Accord majeur sur la note du cristal (glass1 ≈
    // 1922 Hz, trois octaves plus bas).
    fusion() {
      const root = 240;
      choir([1, 1.25, 1.5, 2, 2.5].map((k) => root * k), { vol: 0.14, rise: 0.95, hold: 0.55, fall: 1.9, rev: 1.1 });
      choir([root * 4, root * 6], { vol: 0.035, delay: 0.9, rise: 0.25, hold: 0.4, fall: 1.6, rev: 1.4 });
      if (!buffers.glass1) { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.16, { delay: 0.95 + i * 0.06, type: 'triangle', vol: 0.07 })); return; }
      play('rise', { vol: 0.14, rate: 1.2, rev: 0.6, jit: 0 });
      [1, 1.26, 1.5, 2, 2.52].forEach((r, i) => play('glass1', { rate: r, jit: 0.01, vol: 0.24, rev: 0.8, delay: 0.95 + i * 0.065 }));
      play('glass4', { vol: 0.24, rate: 0.9, rev: 1.1, delay: 1.27 });
    },
    // Souffle d'une attaque : bruit filtré qui passe, à hauteur variable.
    whoosh(pan) { swoosh(pan); },
    hit(power, pan) {
      power = power || 2;
      if (!play(PLACE, { vol: Math.min(0.75, 0.45 + power * 0.04), rate: 0.7, rev: 0.2, pan })) { noise(0.09, { vol: 0.14, cut: 1400 }); tone(140, 0.08, { type: 'triangle', vol: 0.08 }); return; }
      play(CRUMBLE, { vol: 0.08, rate: 1.7, jit: 0.15, pan, delay: 0.02 });
      if (power >= 4) play(CRUMBLE, { vol: Math.min(0.45, 0.15 + power * 0.03), rate: 0.85, pan, delay: 0.02 });
    },
    shield(pan) { play(['glass5', 'glass6'], { vol: 0.42, rate: 0.95, rev: 0.35, pan }) || tone(1800, 0.12, { to: 900, vol: 0.06 }); },
    death(pan) {
      if (!play('break', { vol: 0.5, rate: 0.8, rev: 0.25, pan })) { noise(0.35, { vol: 0.2, cut: 700 }); tone(110, 0.3, { type: 'triangle', to: 50, vol: 0.12 }); return; }
      play(CRUMBLE, { vol: 0.45, rate: 0.75, pan, delay: 0.03 });
      play('blast', { vol: 0.16, rate: 0.6, rev: 0.4, pan });
    },
    // Bonus de statistiques : un tintement cristallin qui monte d'un ton à chaque astre renforcé
    // d'affilée (step), sur un petit pincement ; « tous vos astres +1 » s'entend comme une gamme.
    buff(pan, step) {
      const k = Math.min(step || 0, 7);
      const rate = 1.1 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14, 16][k] / 12);
      if (!play('glass1', { vol: 0.26, rate, rev: 0.25, jit: 0.01, pan })) { tone(880 * rate, 0.09, { vol: 0.05, type: 'triangle' }); return; }
      play(['pluck1', 'pluck2'], { vol: 0.12, jit: 0.05, pan });
    },
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
    // Le jingle d'ARECIBO : la victoire d'une partie.
    // Sons rétro du jeu caché (js/invaders.js) : bip carré et souffle, sur le bus des effets.
    chip(freq, dur, o) { tone(freq, dur, Object.assign({ type: 'square', vol: 0.03 }, o)); },
    hiss(dur, o) { noise(dur, o); },
    jingle() { if (!play('jingle', { vol: 0.5, jit: 0 })) SFX.win(); },
    // Alerte : vos PV passent sous le quart.
    alarm() { play('alarm', { vol: 0.22, jit: 0 }); },
    win() {
      if (!buffers.glass1) { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, { delay: i * 0.09, type: 'triangle', vol: 0.07 })); return; }
      chime([1, 1.26, 1.5, 2], { vol: 0.28, rev: 0.6, step: 0.09 });
      play('confirm', { vol: 0.16, delay: 0.3, rev: 0.4 });
    },
    lose() {
      if (!play('down', { vol: 0.3, rev: 0.4 })) { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, { delay: i * 0.12, type: 'triangle', vol: 0.07 })); return; }
      play(CRUMBLE, { vol: 0.28, rate: 0.6, delay: 0.1, rev: 0.4 });
    },
    // Ambiance : 'off', 'wake', 'menu', 'game', 'battle', 'end', 'ship', 'atelier'.
    ambience(name) { setMood(name); },
    // Musique du menu : true sur les écrans hors partie.
    music(on) { if (on !== musicWant) setMusic(on); },
    get musicOn() { return musicOn; },
    // Lecteur du menu : nom du morceau, morceau suivant ou précédent, lecture en cours.
    get trackName() { return TRACKS[track].name; },
    skip(dir) { setTrack(track + (dir < 0 ? -1 : 1)); },
    get musicPlaying() { return musicOn && !muted && musicVol > 0; },
    get musicVol() { return musicVol; },
    get fxVol() { return fxVol; },
    // Volume de la musique (0 à 1) : à 0, la musique s'arrête ; elle reprend dès qu'on remonte.
    setMusicVol(v) {
      musicVol = Math.max(0, Math.min(1, Number(v) || 0));
      try { localStorage.setItem(VOL_MUSIC_KEY, String(musicVol)); } catch (err) { /* stockage indisponible */ }
      if ((musicVol > 0) !== musicOn) { SFX.setMusicOn(musicVol > 0); return; }
      if (ctx && musicGain && musicWant && musicOn && !muted) { musicGain.gain.cancelScheduledValues(ctx.currentTime); musicGain.gain.setTargetAtTime(MUSIC_VOL * musicVol, ctx.currentTime, 0.08); }
      else if (musicEl && !musicGain) musicEl.volume = MUSIC_VOL * musicVol;
    },
    // Volume des effets et de l'ambiance (0 à 1).
    setFxVol(v) {
      fxVol = Math.max(0, Math.min(1, Number(v) || 0));
      try { localStorage.setItem(VOL_FX_KEY, String(fxVol)); } catch (err) { /* stockage indisponible */ }
      if (ctx && fxMaster) { fxMaster.gain.cancelScheduledValues(ctx.currentTime); fxMaster.gain.setTargetAtTime(fxVol, ctx.currentTime, 0.05); }
    },
    setMusicOn(v) {
      musicOn = !!v;
      try { localStorage.setItem(MUSIC_KEY, musicOn ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
      if (!ctx && musicOn) audio();
      setMusic(musicWant);
      musicChanged();
    },
    // Nombre d'échantillons prêts (0 tant que le premier toucher n'a pas eu lieu).
    get loaded() { return Object.keys(buffers).length; },
    get muted() { return muted; },
    setMuted(v) {
      muted = !!v;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
      if (!ctx) { if (!muted) audio(); musicChanged(); return; }
      if (muted) { ctx.suspend(); if (musicEl) musicEl.pause(); pauseBeds(); bedName = null; }
      else { ctx.resume(); setMood(mood, true); setMusic(musicWant); }
      musicChanged();
    }
  };

  window.OrbiteSfx = SFX;
})();
