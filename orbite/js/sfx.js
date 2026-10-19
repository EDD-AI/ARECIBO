/* ORBITE — petits sons synthétisés (WebAudio), sans fichier audio. */
(function () {
  'use strict';

  const KEY = 'orbite.mute';
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (err) { muted = false; }

  function audio() {
    if (muted) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, o) {
    const a = audio();
    if (!a) return;
    o = o || {};
    const t = a.currentTime + (o.delay || 0);
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.06, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.destination);
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
    g.gain.value = o.vol || 0.12;
    src.connect(f).connect(g).connect(a.destination);
    src.start(t);
  }

  const SFX = {
    tap() { tone(880, 0.05, { vol: 0.03 }); },
    type() { tone(1500 + Math.random() * 300, 0.018, { vol: 0.012, type: 'triangle' }); },
    start() { noise(0.9, { vol: 0.08, cut: 600 }); [196, 262, 392, 523].forEach((f, i) => tone(f, 0.9, { delay: 0.12 + i * 0.1, type: 'sine', vol: 0.05 })); },
    buy() { tone(660, 0.07); tone(990, 0.1, { delay: 0.06 }); },
    place() { tone(220, 0.12, { type: 'triangle', to: 140, vol: 0.12 }); noise(0.08, { vol: 0.05, cut: 900 }); },
    sell() { tone(520, 0.12, { to: 260 }); },
    roll() { for (let i = 0; i < 4; i++) tone(400 + i * 120, 0.05, { delay: i * 0.04, vol: 0.035 }); },
    freeze() { tone(1400, 0.2, { type: 'sine', to: 1900, vol: 0.05 }); },
    level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, { delay: i * 0.07, vol: 0.05 })); },
    golden() { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.16, { delay: i * 0.06, type: 'triangle', vol: 0.07 })); },
    hit() { noise(0.09, { vol: 0.14, cut: 1400 }); tone(140, 0.08, { type: 'triangle', vol: 0.08 }); },
    shield() { tone(1800, 0.12, { type: 'sine', to: 900, vol: 0.06 }); },
    death() { noise(0.35, { vol: 0.2, cut: 700 }); tone(110, 0.3, { type: 'triangle', to: 50, vol: 0.12 }); },
    buff() { tone(1046, 0.07, { type: 'sine', vol: 0.04 }); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.18, { delay: i * 0.09, type: 'triangle', vol: 0.07 })); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, { delay: i * 0.12, type: 'triangle', vol: 0.07 })); },
    get muted() { return muted; },
    setMuted(v) {
      muted = !!v;
      try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (err) { /* stockage indisponible */ }
    }
  };

  window.OrbiteSfx = SFX;
})();
