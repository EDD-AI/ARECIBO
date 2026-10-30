/* ORBITE — entrée en partie (v109) : un trou noir s'ouvre au milieu de l'écran, aspire le menu en
   tournoyant, grossit jusqu'à tout couvrir, puis la partie s'ouvre depuis son centre. Environ 2,3 s,
   dessiné en pixel art sur une petite toile agrandie. Le changement d'écran se fait dans le noir :
   l'animation attend qu'il soit fini avant de révéler la partie. */
(function () {
  'use strict';

  // Étapes (ms) : ouverture du trou, aspiration du menu, le trou couvre l'écran, traversée, arrivée.
  const T_OPEN = 260, T_SUCK = 1150, T_FILL = 1450, T_TUNNEL = 1650, T_END = 2350;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const seg = (t, a, b) => clamp01((t - a) / (b - a));
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  const easeIn = (x) => x * x * x;
  const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
  // Bruit fixe par point : le disque garde ses filaments d'une image à l'autre.
  const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  // Matière du disque, de la plus chaude (blanche) à la plus froide (violette, la couleur du Néant).
  const HEAT = ['#5b2bc9', '#9a6bff', '#e0508a', '#ff9a3c', '#ffd27a', '#fff6e0'];
  const heat = (k) => HEAT[Math.max(0, Math.min(HEAT.length - 1, Math.floor(k * HEAT.length)))];

  let running = null;

  function play(swap) {
    const go = () => Promise.resolve().then(() => (swap ? swap() : null));
    if (running || !document.body) return go();
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    running = (calm ? fade(go) : hole(go)).then((v) => { running = null; return v; }, (e) => { running = null; throw e; });
    return running;
  }

  function overlay() {
    const cv = document.createElement('canvas');
    cv.className = 'bh-portal';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    return cv;
  }

  // Mouvement réduit (réglage du système) : un simple fondu au noir.
  function fade(go) {
    const cv = overlay();
    cv.width = cv.height = 1;
    const g = cv.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1, 1);
    cv.style.transition = 'opacity 0.18s';
    cv.style.opacity = '0';
    return new Promise((resolve) => {
      requestAnimationFrame(() => { cv.style.opacity = '1'; });
      setTimeout(() => go().catch(() => null).then(() => {
        cv.style.transition = 'opacity 0.24s';
        cv.style.opacity = '0';
        setTimeout(() => { cv.remove(); resolve(); }, 260);
      }), 200);
    });
  }

  function hole(go) {
    const W = window.innerWidth, H = window.innerHeight;
    // Taille d'un pixel : environ 200 pixels sur le petit côté de l'écran, comme les astres.
    const px = Math.max(2, Math.round(Math.min(W, H) / 200));
    const w = Math.ceil(W / px), h = Math.ceil(H / px);
    const cv = overlay();
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    const app = document.getElementById('app');
    const cx = w / 2, cy = h / 2, m = Math.min(w, h), diag = Math.hypot(w, h) / 2 + 3;
    const R0 = m * 0.05, R1 = m * 0.16;
    if (window.OrbiteSfx && window.OrbiteSfx.hole) window.OrbiteSfx.hole();

    // Poussière et étoiles aspirées : elles tournent de plus en plus vite en tombant vers le trou.
    const dust = [];
    const spawn = (d) => {
      const c = Math.random();
      dust.push({ a: Math.random() * Math.PI * 2, d: d != null ? d : diag * (0.45 + Math.random() * 0.75), v: 0,
        col: c < 0.5 ? '#ffffff' : c < 0.75 ? '#ffd27a' : c < 0.9 ? '#b9a4ff' : '#ff9a3c', big: Math.random() < 0.18 });
    };
    for (let i = 0; i < 150; i++) spawn(diag * (0.2 + Math.random()));

    // Le menu tombe dans le trou : il rétrécit en tournant et s'efface.
    const suck = (p) => {
      if (!app) return;
      app.style.transformOrigin = '50% 50%';
      app.style.transform = 'scale(' + (1 - 0.94 * p).toFixed(4) + ') rotate(' + (38 * p).toFixed(2) + 'deg)';
      app.style.opacity = String(1 - p);
    };
    const arrive = (p) => {
      if (!app) return;
      app.style.transform = p >= 1 ? '' : 'scale(' + (1.14 - 0.14 * easeOut(p)).toFixed(4) + ')';
      app.style.opacity = '';
      if (p >= 1) app.style.transformOrigin = '';
    };

    // Disque d'accrétion vu presque par la tranche : la moitié arrière passe derrière le trou, la
    // moitié avant devant ; le côté qui vient vers nous (à droite) brille davantage.
    function disk(r, spin, half, alpha) {
      const inner = r * 1.3, outer = r * 2.7, tilt = 0.26, K = 8;
      g.globalAlpha = alpha;
      for (let k = 0; k < K; k++) {
        const f = k / (K - 1), rr = inner + (outer - inner) * f;
        const n = Math.max(24, Math.round(rr * 4.4));
        const turn = spin * Math.pow(inner / rr, 1.5);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + turn;
          const s = Math.sin(a);
          if ((half < 0) !== (s < 0)) continue;
          const x = cx + Math.cos(a) * rr, y = cy + s * rr * tilt;
          if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
          const grain = hash(k, i);
          const lum = (1 - f) * 0.75 * (1 + 0.6 * Math.cos(a)) * (0.55 + 0.6 * grain);
          if (lum < 0.08) continue;
          g.fillStyle = heat(lum);
          g.fillRect(x | 0, y | 0, grain > 0.7 ? 2 : 1, 1);
        }
      }
      g.globalAlpha = 1;
    }
    // Lumière du disque arrière, courbée par le trou : un anneau au-dessus et au-dessous de l'ombre.
    function lens(r, spin, alpha) {
      g.globalAlpha = alpha;
      for (let k = 0; k < 4; k++) {
        const rr = r * (1.12 + k * 0.1), n = Math.round(rr * 6.5);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + spin * 0.6;
          const top = Math.sin(a) < 0;
          const grain = hash(k + 20, i);
          const lum = (top ? 0.95 : 0.45) * (1 - k * 0.2) * (0.5 + 0.6 * grain) * (1 + 0.35 * Math.cos(a));
          if (lum < 0.12) continue;
          g.fillStyle = heat(lum);
          g.fillRect((cx + Math.cos(a) * rr) | 0, (cy + Math.sin(a) * rr * 0.92) | 0, 1, 1);
        }
      }
      g.globalAlpha = 1;
    }
    function glow(r, alpha) {
      const gr = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 3.4);
      gr.addColorStop(0, 'rgba(255, 170, 90, ' + 0.35 * alpha + ')');
      gr.addColorStop(0.35, 'rgba(154, 107, 255, ' + 0.22 * alpha + ')');
      gr.addColorStop(1, 'rgba(40, 10, 80, 0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }
    function shadow(r) {
      g.fillStyle = '#000';
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffe9c0';
      g.globalAlpha = 0.85;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, r + 0.8, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    return new Promise((resolve) => {
      let t0 = 0, last = 0, hold = 0, swapped = null, ready = false, done = false;
      const finish = () => {
        if (done) return;
        done = true;
        arrive(1);
        cv.remove();
        resolve();
      };
      const swap = () => {
        if (!swapped) swapped = go().catch(() => null).then(() => { arrive(0); ready = true; });
        return swapped;
      };
      // En cas de pépin (erreur de dessin, onglet en arrière-plan), la partie s'affiche quand même.
      const bail = () => { swap().then(finish); };
      const frame = (now) => {
        if (done) return;
        try { step(now); } catch (err) { bail(); }
      };
      const step = (now) => {
        if (!t0) t0 = last = now;
        const dt = Math.min(50, now - last) / 1000;
        last = now;
        // Tant que la partie n'est pas prête, la traversée continue (le temps s'arrête juste avant
        // l'arrivée) ; au-delà de 5 s, on révèle quand même.
        if (!ready && now - t0 - hold > T_TUNNEL && now - t0 < 5000) hold = now - t0 - T_TUNNEL;
        const t = now - t0 - hold;
        if (t >= T_FILL && !swapped) {
          suck(1);
          swap();
        }
        g.clearRect(0, 0, w, h);
        if (t < T_FILL) {
          const r = Math.max(0.5, t < T_OPEN ? R0 * easeBack(t / T_OPEN)
            : t < T_SUCK ? R0 + (R1 - R0) * easeInOut(seg(t, T_OPEN, T_SUCK))
            : R1 + (diag * 1.15 - R1) * easeIn(seg(t, T_SUCK, T_FILL)));
          const spin = t * 0.0042;
          const pull = easeIn(seg(t, T_OPEN * 0.4, T_FILL));
          suck(pull);
          // L'écran s'assombrit autour du trou.
          const vg = g.createRadialGradient(cx, cy, r, cx, cy, diag);
          vg.addColorStop(0, 'rgba(0, 0, 0, ' + (0.15 + 0.5 * pull) + ')');
          vg.addColorStop(1, 'rgba(0, 0, 0, ' + (0.35 + 0.6 * pull) + ')');
          g.fillStyle = vg;
          g.fillRect(0, 0, w, h);
          const on = clamp01(t / T_OPEN);
          glow(r, on);
          // La poussière tombe en spirale ; celle qui passe l'horizon disparaît et revient du bord.
          for (const p of dust) {
            const ox = cx + Math.cos(p.a) * p.d, oy = cy + Math.sin(p.a) * p.d * 0.8;
            p.v += dt * (40 + 2600 / Math.max(6, p.d)) * (0.4 + 1.6 * pull);
            p.d -= p.v * dt * 3;
            p.a += dt * (0.6 + 90 / Math.max(5, p.d)) * (0.5 + pull);
            if (p.d <= r * 1.05) { p.d = diag * (0.9 + Math.random() * 0.4); p.v = 0; p.a = Math.random() * Math.PI * 2; continue; }
            const x = cx + Math.cos(p.a) * p.d, y = cy + Math.sin(p.a) * p.d * 0.8;
            g.strokeStyle = p.col;
            g.globalAlpha = 0.35 + 0.65 * on;
            g.lineWidth = p.big ? 2 : 1;
            g.beginPath();
            g.moveTo(ox | 0, oy | 0);
            g.lineTo(x | 0, y | 0);
            g.stroke();
          }
          g.globalAlpha = 1;
          disk(r, spin, -1, on);
          lens(r, spin, on);
          shadow(r);
          disk(r, spin, 1, on);
        } else if (t < T_TUNNEL || !ready) {
          // Dans le trou : des traits de lumière filent vers les bords.
          g.fillStyle = '#000';
          g.fillRect(0, 0, w, h);
          const q = (now - t0 - T_FILL) / 1000;
          for (let i = 0; i < 64; i++) {
            const a = hash(i, 3) * Math.PI * 2;
            const d = ((q * (1.4 + hash(i, 7) * 1.6) + hash(i, 9)) % 1) * diag;
            const len = 2 + d * 0.22;
            g.strokeStyle = i % 3 ? '#9a6bff' : '#ffffff';
            g.globalAlpha = Math.min(1, d / (diag * 0.3));
            g.beginPath();
            g.moveTo((cx + Math.cos(a) * d) | 0, (cy + Math.sin(a) * d) | 0);
            g.lineTo((cx + Math.cos(a) * (d + len)) | 0, (cy + Math.sin(a) * (d + len)) | 0);
            g.stroke();
          }
          g.globalAlpha = 1;
          g.fillStyle = '#fff6e0';
          const c = 1 + 2 * seg(t, T_FILL, T_TUNNEL);
          g.fillRect((cx - c / 2) | 0, (cy - c / 2) | 0, Math.ceil(c), Math.ceil(c));
        } else {
          // Arrivée : la partie s'ouvre depuis le centre, bordée d'un anneau de lumière.
          const p = seg(t, T_TUNNEL, T_END);
          const rr = 2 + diag * easeOut(p);
          arrive(p);
          g.fillStyle = '#000';
          g.fillRect(0, 0, w, h);
          g.globalCompositeOperation = 'destination-out';
          g.beginPath();
          g.arc(cx, cy, rr, 0, Math.PI * 2);
          g.fill();
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = 1 - p;
          g.lineWidth = 2;
          g.strokeStyle = '#fff6e0';
          g.beginPath();
          g.arc(cx, cy, rr, 0, Math.PI * 2);
          g.stroke();
          g.lineWidth = 1;
          g.strokeStyle = '#9a6bff';
          g.beginPath();
          g.arc(cx, cy, rr + 2, 0, Math.PI * 2);
          g.stroke();
          // Étincelles projetées vers l'extérieur.
          for (let i = 0; i < 40; i++) {
            const a = hash(i, 11) * Math.PI * 2, d = rr * (0.6 + hash(i, 13) * 0.5);
            g.fillStyle = i % 2 ? '#ffd27a' : '#ffffff';
            g.fillRect((cx + Math.cos(a) * d) | 0, (cy + Math.sin(a) * d) | 0, 1, 1);
          }
          g.globalAlpha = 1;
          if (p >= 1) { finish(); return; }
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      setTimeout(bail, 9000);
    });
  }

  window.OrbitePortal = { play };
})();
