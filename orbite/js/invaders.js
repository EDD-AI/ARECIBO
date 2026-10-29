/* ORBITE — jeu caché : un Space Invaders en pixels, aux couleurs du jeu. Il s'ouvre avec le code
 * Konami, au menu comme en pleine partie :
 * - au clavier : ↑ ↑ ↓ ↓ ← → ← → B A ;
 * - au doigt : glisser vers le haut, le haut, le bas, le bas, la gauche, la droite, la gauche, la
 *   droite, puis toucher deux fois l'écran.
 * Le meilleur score est gardé dans orbite.invaders. */
(function () {
  'use strict';
  const O = window.__orbite;
  if (!O || !O.api) return;
  const A = O.api, SFX = window.OrbiteSfx || {};
  const tr = window.tr || ((s) => s);
  const BEST_KEY = 'orbite.invaders';

  // ─── Terrain (en pixels du jeu, agrandis à l'écran) ─────────
  const W = 192, H = 240;
  const GROUND = H - 11, PY = H - 20, TOP = 14;
  const COLS = 8, ROWS = 5, CELL_X = 18, CELL_Y = 14;
  const C = { ink: '#f1ecda', gold: '#f6c453', blue: '#7fd8ff', red: '#ff6f6f', green: '#9ff09a' };

  // Les sprites : X = pixel allumé. Deux images par envahisseur, pour la marche.
  const SPR = {
    squid: [
      ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '..X..X..', '.X.XX.X.', 'X.X..X.X'],
      ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X', '.X....X.']
    ],
    crab: [
      ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'],
      ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.']
    ],
    octo: [
      ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XX.XX.XX..', 'XX........XX'],
      ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '..XXX..XXX..', '.XX..XX..XX.', '..XX....XX..']
    ],
    ship: [['......X......', '.....XXX.....', '.....XXX.....', '.XXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX']],
    shipBoom: [
      ['....X....X...', '..X...X......', '.....XX.X.X..', '.X.XXXXX..X..', '..XXXXXXX....', '.XXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX'],
      ['.X.....X..X..', '...X.......X.', 'X...XX.X.....', '..XX.XXXX.X..', '.XXXXXXXXX..X', 'XXXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX']
    ],
    ufo: [['.....XXXXXX.....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '.XX.XX.XX.XX.XX.', 'XXXXXXXXXXXXXXXX', '..XXX..XX..XXX..', '...X........X...']],
    boom: [['....X...X....', '.X...X.X...X.', '..X.......X..', '...X.....X...', 'XX.........XX', '...X.....X...', '..X..X.X..X..', '.X..X...X..X.']],
    bomb: [['.X.', 'X..', '.X.', '..X', '.X.', 'X..', '.X.'], ['.X.', '..X', '.X.', 'X..', '.X.', '..X', '.X.']],
    splat: [['X.X..X', '.XXXX.', 'XXXXXX', '.XXXX.', 'X.XX.X']]
  };
  const ROW_KIND = ['squid', 'crab', 'crab', 'octo', 'octo'];
  const ROW_COLOR = [C.gold, C.blue, C.blue, C.ink, C.ink];
  const ROW_PTS = [30, 20, 20, 10, 10];
  // Chiffres 3 × 5 pour les points de la soucoupe et le tableau d'accueil.
  const DIGITS = {
    0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
    5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
    '?': '111001011000010', '=': '000111000111000'
  };
  const sprW = (k) => SPR[k][0][0].length;
  const cache = {};
  function spr(k, f, color) {
    const key = k + f + color;
    if (cache[key]) return cache[key];
    const n = SPR[k].length, rows = SPR[k][((f % n) + n) % n];
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    const x = c.getContext('2d');
    x.fillStyle = color;
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === 'X') x.fillRect(i, j, 1, 1); });
    return (cache[key] = c);
  }

  // ─── Boucliers : quatre abris qui s'effritent ───────────────
  const SH_W = 22, SH_H = 16;
  function newShield(i) {
    const bits = new Uint8Array(SH_W * SH_H);
    for (let y = 0; y < SH_H; y++) {
      for (let x = 0; x < SH_W; x++) {
        const cut = Math.max(0, 4 - y);
        const arch = (y >= 12 && x >= 6 && x < SH_W - 6) || (y === 11 && x >= 7 && x < SH_W - 7);
        if (x >= cut && x < SH_W - cut && !arch) bits[y * SH_W + x] = 1;
      }
    }
    const cv = document.createElement('canvas');
    cv.width = SH_W;
    cv.height = SH_H;
    return { x: Math.round(W * (i + 1) / 5 - SH_W / 2), y: GROUND - 30, bits, cv, dirty: true };
  }
  function paintShield(sh) {
    const x = sh.cv.getContext('2d');
    x.clearRect(0, 0, SH_W, SH_H);
    x.fillStyle = C.green;
    for (let i = 0; i < sh.bits.length; i++) if (sh.bits[i]) x.fillRect(i % SH_W, (i / SH_W) | 0, 1, 1);
    sh.dirty = false;
  }
  // Premier pixel d'abri touché par un rectangle (x, y, w, h) : [abri, px, py] ou null.
  function shieldAt(x, y, w, h, fromTop) {
    for (const sh of g.shields) {
      if (x + w <= sh.x || x >= sh.x + SH_W || y + h <= sh.y || y >= sh.y + SH_H) continue;
      const y0 = Math.max(0, Math.floor(y - sh.y)), y1 = Math.min(SH_H - 1, Math.ceil(y + h - sh.y) - 1);
      const x0 = Math.max(0, Math.floor(x - sh.x)), x1 = Math.min(SH_W - 1, Math.ceil(x + w - sh.x) - 1);
      for (let k = 0; k <= y1 - y0; k++) {
        const py = fromTop ? y0 + k : y1 - k;
        for (let px = x0; px <= x1; px++) if (sh.bits[py * SH_W + px]) return [sh, px, py];
      }
    }
    return null;
  }
  function blast(sh, cx, cy, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= SH_W || y >= SH_H || dx * dx + dy * dy > r * r + 1) continue;
        if (Math.random() < 0.82) sh.bits[y * SH_W + x] = 0;
      }
    }
    sh.dirty = true;
  }

  // ─── Partie ─────────────────────────────────────────────────
  let g = null;
  const best = () => Number(A.store.get(BEST_KEY, '0')) || 0;
  function newGame() {
    g = { state: 'title', score: 0, lives: 3, wave: 1, t: 0, px: W / 2, shot: null, bombs: [], booms: [], pops: [], ufo: null, ufoT: 20, inv: [], shields: [], ox: 0, oy: 0, dir: 1, stepT: 0, frame: 0, note: 0, bombT: 1.5, wait: 0, record: false };
    g.stars = Array.from({ length: 46 }, () => ({ x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * (GROUND - 4)), p: Math.random() * 6.28 }));
    setupWave();
  }
  function setupWave() {
    g.inv = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g.inv.push({ r, c, alive: true });
    g.ox = Math.round((W - ((COLS - 1) * CELL_X + 12)) / 2);
    g.oy = 34 + Math.min(5, g.wave - 1) * 6;
    g.dir = 1;
    g.stepT = 400;
    g.shot = null;
    g.bombs = [];
    g.ufo = null;
    g.shields = [0, 1, 2, 3].map(newShield);
  }
  const alive = () => g.inv.filter((a) => a.alive);
  const invX = (a) => g.ox + a.c * CELL_X + Math.floor((12 - sprW(ROW_KIND[a.r])) / 2);
  const invY = (a) => g.oy + a.r * CELL_Y;
  const stepMs = () => (30 + alive().length * 14) * Math.pow(0.9, Math.min(8, g.wave - 1));

  function start() {
    newGame();
    g.state = 'play';
    message();
    SFX.chip && SFX.chip(523, 0.08, { vol: 0.03 });
    SFX.chip && SFX.chip(784, 0.12, { vol: 0.03, delay: 0.08 });
  }
  // La formation avance d'un pas ; au bord, elle descend et repart dans l'autre sens.
  function march() {
    const list = alive();
    let minX = Infinity, maxX = -Infinity;
    for (const a of list) { const x = g.ox + a.c * CELL_X; if (x < minX) minX = x; if (x + 12 > maxX) maxX = x + 12; }
    if ((g.dir > 0 && maxX + 3 > W - 3) || (g.dir < 0 && minX - 3 < 3)) { g.oy += 6; g.dir = -g.dir; }
    else g.ox += 3 * g.dir;
    g.frame ^= 1;
    // Les quatre notes graves de la marche.
    if (SFX.chip) SFX.chip([98, 87, 78, 73][g.note++ % 4], 0.09, { vol: 0.045 });
    // Les envahisseurs rongent les abris qu'ils traversent, et la Terre est perdue s'ils touchent le sol.
    for (const a of list) {
      const x = invX(a), y = invY(a), w = sprW(ROW_KIND[a.r]);
      for (const sh of g.shields) {
        if (x + w <= sh.x || x >= sh.x + SH_W || y + 8 <= sh.y || y >= sh.y + SH_H) continue;
        for (let py = Math.max(0, y - sh.y); py < Math.min(SH_H, y + 8 - sh.y); py++) {
          for (let px = Math.max(0, x - sh.x); px < Math.min(SH_W, x + w - sh.x); px++) sh.bits[py * SH_W + px] = 0;
        }
        sh.dirty = true;
      }
      if (y + 8 >= PY) { g.lives = 0; die(); return; }
    }
  }
  function shoot() {
    g.shot = { x: Math.round(g.px), y: PY - 4 };
    if (SFX.chip) SFX.chip(1180, 0.07, { to: 560, vol: 0.022 });
  }
  function dropBomb() {
    const list = alive();
    if (!list.length) return;
    // Le plus bas de sa colonne tire ; souvent celui qui est au-dessus du vaisseau.
    const cols = [...new Set(list.map((a) => a.c))];
    let col = cols[Math.floor(Math.random() * cols.length)];
    if (Math.random() < 0.4) col = cols.reduce((b, c) => (Math.abs(g.ox + c * CELL_X + 6 - g.px) < Math.abs(g.ox + b * CELL_X + 6 - g.px) ? c : b), col);
    const a = list.filter((x) => x.c === col).sort((p, q) => q.r - p.r)[0];
    g.bombs.push({ x: invX(a) + Math.floor(sprW(ROW_KIND[a.r]) / 2) - 1, y: invY(a) + 8, f: 0, ft: 0 });
  }
  function boom(x, y, k, color, t) { g.booms.push({ x, y, k: k || 'boom', color: color || C.ink, t: t || 0.25 }); }
  function die() {
    g.lives = Math.max(0, g.lives - 1);
    g.state = 'dying';
    g.wait = 1.4;
    g.bombs = [];
    g.shot = null;
    if (SFX.hiss) SFX.hiss(0.7, { cut: 900, vol: 0.22 });
    if (SFX.chip) SFX.chip(320, 0.6, { to: 50, vol: 0.04 });
    A.vibrate && A.vibrate([40, 40, 80]);
  }
  function gameOver() {
    g.state = 'over';
    if (g.score > best()) { A.store.set(BEST_KEY, String(g.score)); g.record = true; }
    if (SFX.chip) [392, 330, 262, 196].forEach((f, i) => SFX.chip(f, 0.16, { vol: 0.035, delay: i * 0.14 }));
    hudUpdate();
    message();
  }

  function update(dt) {
    g.t += dt;
    g.booms = g.booms.filter((b) => (b.t -= dt) > 0);
    g.pops = g.pops.filter((p) => (p.t -= dt) > 0);
    if (g.state === 'dying') {
      g.wait -= dt;
      if (g.wait <= 0) { if (g.lives > 0) { g.state = 'play'; g.px = W / 2; } else gameOver(); }
      return;
    }
    if (g.state === 'clear') {
      g.wait -= dt;
      if (g.wait <= 0) { g.wave++; setupWave(); g.state = 'play'; message(); }
      return;
    }
    if (g.state !== 'play') return;
    // Vaisseau : flèches (ou A/Q et D), ou le doigt qui glisse.
    const mv = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    g.px = Math.max(7, Math.min(W - 7, g.px + mv * 92 * dt));
    if ((keys.fire || touch.on) && !g.shot) shoot();
    // Tir du vaisseau.
    if (g.shot) {
      const s = g.shot;
      s.y -= 230 * dt;
      let hit = false;
      for (const a of g.inv) {
        if (!a.alive) continue;
        const x = invX(a), y = invY(a), w = sprW(ROW_KIND[a.r]);
        if (s.x >= x && s.x < x + w && s.y < y + 8 && s.y + 4 > y) {
          a.alive = false;
          hit = true;
          g.score += ROW_PTS[a.r];
          boom(x + Math.floor(w / 2) - 6, y, 'boom', ROW_COLOR[a.r]);
          if (SFX.hiss) SFX.hiss(0.16, { cut: 2600, vol: 0.1 });
          if (!alive().length) { g.state = 'clear'; g.wait = 1.6; g.bombs = []; message(); if (SFX.chip) [523, 659, 784, 1047].forEach((f, i) => SFX.chip(f, 0.1, { vol: 0.03, delay: i * 0.08 })); }
          break;
        }
      }
      if (!hit && g.ufo && s.y < 27 && s.y + 4 > 20 && s.x >= g.ufo.x && s.x < g.ufo.x + 16) {
        hit = true;
        g.score += g.ufo.pts;
        g.pops.push({ x: Math.round(g.ufo.x), y: 21, txt: String(g.ufo.pts), t: 1.2 });
        boom(Math.round(g.ufo.x) + 1, 19, 'boom', C.red, 0.4);
        g.ufo = null;
        if (SFX.chip) [880, 1175, 1568].forEach((f, i) => SFX.chip(f, 0.08, { vol: 0.03, delay: i * 0.06 }));
      }
      if (!hit) {
        const b = g.bombs.findIndex((x) => Math.abs(x.x + 1 - s.x) <= 2 && s.y < x.y + 7 && s.y + 4 > x.y);
        if (b >= 0) { boom(s.x - 3, s.y - 2, 'splat', C.gold, 0.15); g.bombs.splice(b, 1); hit = true; }
      }
      if (!hit) {
        const h = shieldAt(s.x, s.y, 1, 4, false);
        if (h) { blast(h[0], h[1], h[2], 2); hit = true; }
      }
      if (!hit && s.y < TOP) { boom(s.x - 3, TOP, 'splat', C.red, 0.15); hit = true; }
      if (hit) g.shot = null;
    }
    if (g.state !== 'play') return;
    // Marche de la formation, de plus en plus rapide.
    g.stepT -= dt * 1000;
    if (g.stepT <= 0) { march(); g.stepT += stepMs(); if (g.state !== 'play') return; }
    // Bombes.
    g.bombT -= dt;
    if (g.bombT <= 0) {
      g.bombT = Math.max(0.22, 0.6 - g.wave * 0.05) + Math.random() * 0.5;
      if (g.bombs.length < Math.min(5, 2 + Math.floor(g.wave / 2))) dropBomb();
    }
    const speed = 62 + g.wave * 6;
    for (let i = g.bombs.length - 1; i >= 0; i--) {
      const b = g.bombs[i];
      b.y += speed * dt;
      if ((b.ft += dt) > 0.09) { b.ft = 0; b.f ^= 1; }
      if (b.y + 7 >= PY && b.y < PY + 8 && b.x + 3 > g.px - 6 && b.x < g.px + 7) { g.bombs.splice(i, 1); die(); return; }
      const h = shieldAt(b.x, b.y, 3, 7, true);
      if (h) { blast(h[0], h[1], h[2], 3); g.bombs.splice(i, 1); continue; }
      if (b.y + 7 >= GROUND) { boom(b.x - 1, GROUND - 5, 'splat', C.red, 0.2); g.bombs.splice(i, 1); }
    }
    // Soucoupe mystère.
    if (!g.ufo) {
      g.ufoT -= dt;
      if (g.ufoT <= 0 && alive().length > 6) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        g.ufo = { x: dir > 0 ? -16 : W, dir, pts: [50, 100, 150, 300][Math.floor(Math.random() * 4)], beep: 0 };
        g.ufoT = 18 + Math.random() * 12;
      }
    } else {
      g.ufo.x += g.ufo.dir * 44 * dt;
      if ((g.ufo.beep -= dt) <= 0) { g.ufo.beep = 0.14; if (SFX.chip) SFX.chip(g.t % 0.28 < 0.14 ? 620 : 830, 0.1, { vol: 0.016, type: 'triangle' }); }
      if (g.ufo.x < -18 || g.ufo.x > W + 2) g.ufo = null;
    }
  }

  // ─── Dessin ─────────────────────────────────────────────────
  function digits(txt, x, y, color) {
    ctx.fillStyle = color;
    for (const ch of String(txt)) {
      const d = DIGITS[ch];
      if (d) for (let i = 0; i < 15; i++) if (d[i] === '1') ctx.fillRect(x + (i % 3), y + ((i / 3) | 0), 1, 1);
      x += 4;
    }
  }
  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // Ciel étoilé, comme le fond du jeu.
    for (const st of g.stars) {
      ctx.globalAlpha = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(g.t * 1.6 + st.p));
      ctx.fillStyle = C.ink;
      ctx.fillRect(st.x, st.y, 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.green;
    ctx.fillRect(0, GROUND, W, 1);
    if (g.state !== 'title') for (const sh of g.shields) { if (sh.dirty) paintShield(sh); ctx.drawImage(sh.cv, sh.x, sh.y); }
    if (g.state === 'title') {
      // Tableau des points.
      const rows = [['ufo', C.red, '?'], ['squid', C.gold, '30'], ['crab', C.blue, '20'], ['octo', C.ink, '10']];
      rows.forEach(([k, color, pts], i) => {
        const y = 112 + i * 16;
        ctx.drawImage(spr(k, Math.floor(g.t * 2) % 2, color), 74 - Math.floor(sprW(k) / 2), y);
        digits('=' + pts, 98, y + 1, C.ink);
      });
    } else {
      for (const a of g.inv) if (a.alive) ctx.drawImage(spr(ROW_KIND[a.r], g.frame, ROW_COLOR[a.r]), invX(a), invY(a));
    }
    if (g.ufo) ctx.drawImage(spr('ufo', 0, C.red), Math.round(g.ufo.x), 20);
    if (g.state === 'dying') ctx.drawImage(spr('shipBoom', Math.floor(g.t * 10) % 2, C.ink), Math.round(g.px) - 6, PY);
    else if (g.state !== 'over') ctx.drawImage(spr('ship', 0, C.ink), Math.round(g.px) - 6, PY);
    if (g.shot) { ctx.fillStyle = C.gold; ctx.fillRect(g.shot.x, Math.round(g.shot.y), 1, 4); }
    for (const b of g.bombs) ctx.drawImage(spr('bomb', b.f, C.red), b.x, Math.round(b.y));
    for (const b of g.booms) ctx.drawImage(spr(b.k, 0, b.color), b.x, b.y);
    for (const p of g.pops) digits(p.txt, p.x, p.y, C.gold);
    // Vies : le chiffre et les vaisseaux de réserve, sous le sol.
    digits(g.lives, 4, H - 7, C.ink);
    for (let i = 0; i < Math.min(4, g.lives - 1); i++) ctx.drawImage(spr('ship', 0, C.ink), 12 + i * 16, H - 9);
  }

  // ─── Fenêtre ────────────────────────────────────────────────
  let root = null, cv = null, ctx = null, screenEl = null, msgEl = null, scale = 1, raf = 0, last = 0, isOpen = false;
  const hud = {};
  const keys = { left: false, right: false, fire: false };
  const touch = { on: false, x: 0 };
  const coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const pad = (n) => String(n).padStart(5, '0');

  function build() {
    root = document.createElement('div');
    root.className = 'inv';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'INVADERS');
    root.innerHTML = `<div class="inv-box">
      <div class="inv-hud"><span>${tr('SCORE')}<b data-inv="score">00000</b></span><span class="inv-best">${tr('MEILLEUR')}<b data-inv="best">00000</b></span><span>${tr('VAGUE')}<b data-inv="wave">1</b></span>
        <button class="inv-x" data-inv-act="close" aria-label="${tr('Fermer')}">×</button></div>
      <div class="inv-timer" data-inv="timer" hidden></div>
      <div class="inv-screen"><canvas></canvas><div class="inv-msg" hidden></div></div>
      <p class="inv-help">${coarse() ? tr('Glissez le doigt pour bouger : le tir est automatique.') : tr('← → pour bouger · Espace pour tirer · P pour la pause · Échap pour quitter')}</p>
    </div>`;
    document.body.appendChild(root);
    cv = root.querySelector('canvas');
    ctx = cv.getContext('2d');
    screenEl = root.querySelector('.inv-screen');
    msgEl = root.querySelector('.inv-msg');
    for (const k of ['score', 'best', 'wave', 'timer']) hud[k] = root.querySelector(`[data-inv="${k}"]`);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-inv-act]');
      if (!b) return;
      const k = b.dataset.invAct;
      if (SFX.tap) SFX.tap();
      if (k === 'close') close();
      else if (k === 'start') start();
      else if (k === 'resume') resume();
    });
    // Au doigt (ou à la souris) : le vaisseau suit le glissement, le tir part tout seul.
    screenEl.addEventListener('pointerdown', (e) => {
      if (!g || g.state !== 'play' || e.target.closest('button')) return;
      touch.on = true;
      touch.x = e.clientX;
      try { screenEl.setPointerCapture(e.pointerId); } catch (err) { /* sans importance */ }
    });
    screenEl.addEventListener('pointermove', (e) => {
      if (!touch.on) return;
      const css = cv.getBoundingClientRect().width / W;
      g.px = Math.max(7, Math.min(W - 7, g.px + (e.clientX - touch.x) / css));
      touch.x = e.clientX;
    });
    const up = () => { touch.on = false; };
    screenEl.addEventListener('pointerup', up);
    screenEl.addEventListener('pointercancel', up);
    window.addEventListener('resize', () => { if (isOpen) layout(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && isOpen && g && g.state === 'play') pause(); });
  }
  // Le terrain remplit la place libre ; chaque pixel du jeu vaut un nombre entier de pixels de la
  // toile, à peu près ceux de l'écran : les pixels restent nets.
  function layout() {
    const dpr = window.devicePixelRatio || 1;
    const availW = Math.min(window.innerWidth - 30, 760), availH = window.innerHeight - 130;
    const fit = Math.max(1, Math.min(availW / W, availH / H));
    scale = Math.max(1, Math.round(fit * dpr));
    cv.width = W * scale;
    cv.height = H * scale;
    cv.style.width = Math.floor(W * fit) + 'px';
    cv.style.height = Math.floor(H * fit) + 'px';
    root.querySelector('.inv-box').style.width = (Math.floor(W * fit) + 2) + 'px';
  }
  function message() {
    if (!msgEl) return;
    const st = g.state;
    msgEl.className = 'inv-msg ' + st;
    if (st === 'title') {
      msgEl.innerHTML = `<div class="inv-title"></div><p>${tr('Défendez votre système !')}</p><span class="inv-gap"></span>
        <button class="btn primary" data-inv-act="start">${tr('JOUER')}</button>`;
      // pixelWord remplace la classe de l'élément : on la remet après.
      const t = msgEl.querySelector('.inv-title');
      A.pixelWord(t, 'INVADERS', Math.max(2, Math.round(cv.getBoundingClientRect().width / 92)));
      t.classList.add('inv-title', 'shown');
    } else if (st === 'over') {
      msgEl.innerHTML = `<h3>${tr('PARTIE TERMINÉE')}</h3><p class="inv-score">${g.score}</p>${g.record ? `<p class="inv-record">${tr('NOUVEAU RECORD !')}</p>` : ''}
        <div class="inv-acts"><button class="btn primary" data-inv-act="start">${tr('REJOUER')}</button><button class="btn" data-inv-act="close">${tr('FERMER')}</button></div>`;
    } else if (st === 'pause') {
      msgEl.innerHTML = `<h3>${tr('PAUSE')}</h3><button class="btn primary" data-inv-act="resume">${tr('REPRENDRE')}</button>`;
    } else if (st === 'clear') {
      msgEl.innerHTML = `<h3>${tr('VAGUE {n}', { n: g.wave + 1 })}</h3>`;
    } else {
      msgEl.innerHTML = '';
    }
    msgEl.hidden = st === 'play' || st === 'dying';
  }
  function hudUpdate() {
    hud.score.textContent = pad(g.score);
    hud.best.textContent = pad(Math.max(best(), g.score));
    hud.wave.textContent = g.wave;
    // En partie en ligne, le temps de boutique continue de filer : on le garde sous les yeux.
    const t = document.getElementById('mpTimer');
    const on = !!t && !t.hidden && document.body.classList.contains('mp-game');
    hud.timer.hidden = !on;
    if (on) {
      const txt = tr('COMBAT DANS {t}', { t: t.textContent });
      if (hud.timer.textContent !== txt) hud.timer.textContent = txt;
      hud.timer.classList.toggle('hurry', document.body.classList.contains('mp-hurry'));
    }
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    // L'horodatage de l'image peut précéder l'ouverture : jamais de temps négatif.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    update(dt);
    draw();
    hudUpdate();
  }
  function pause() { if (g.state !== 'play') return; g.state = 'pause'; keys.left = keys.right = keys.fire = false; touch.on = false; message(); }
  function resume() { if (g.state !== 'pause') return; g.state = 'play'; message(); }
  function open() {
    if (isOpen) return;
    if (!root) build();
    isOpen = true;
    root.hidden = false;
    layout();
    newGame();
    message();
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
    if (SFX.chip) [262, 330, 392, 523, 659].forEach((f, i) => SFX.chip(f, 0.09, { vol: 0.03, delay: i * 0.07 }));
  }
  function close() {
    if (!isOpen) return;
    if (g && g.score > best()) A.store.set(BEST_KEY, String(g.score));
    isOpen = false;
    root.hidden = true;
    cancelAnimationFrame(raf);
    keys.left = keys.right = keys.fire = false;
    touch.on = false;
  }

  // Clavier : tant que le jeu est ouvert, il garde les touches pour lui.
  const KEY_LEFT = ['ArrowLeft', 'a', 'A', 'q', 'Q'], KEY_RIGHT = ['ArrowRight', 'd', 'D'], KEY_FIRE = [' ', 'ArrowUp', 'w', 'W', 'z', 'Z'];
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    const k = e.key;
    e.stopPropagation();
    if (KEY_LEFT.includes(k)) keys.left = true;
    else if (KEY_RIGHT.includes(k)) keys.right = true;
    else if (KEY_FIRE.includes(k) || k === 'Enter') {
      if (g.state === 'title' || g.state === 'over') { if (!e.repeat) start(); }
      else if (g.state === 'pause') resume();
      else if (KEY_FIRE.includes(k)) keys.fire = true;
    } else if (k === 'p' || k === 'P') { if (g.state === 'pause') resume(); else pause(); }
    else if (k === 'Escape') close();
    else return;
    e.preventDefault();
  }, true);
  window.addEventListener('keyup', (e) => {
    if (!isOpen) return;
    e.stopPropagation();
    if (KEY_LEFT.includes(e.key)) keys.left = false;
    if (KEY_RIGHT.includes(e.key)) keys.right = false;
    if (KEY_FIRE.includes(e.key)) keys.fire = false;
  }, true);

  // ─── Le code secret ─────────────────────────────────────────
  const CODE = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
  const TOUCH_CODE = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'tap', 'tap'];
  function matcher(code) {
    let seq = [], at = 0;
    return (step) => {
      const now = Date.now();
      if (now - at > 2500) seq = [];
      at = now;
      seq.push(step);
      if (seq.length > code.length) seq.shift();
      if (seq.length === code.length && seq.every((x, i) => x === code[i])) { seq = []; open(); }
    };
  }
  const keyStep = matcher(CODE), touchStep = matcher(TOUCH_CODE);
  const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', b: 'b', B: 'b', a: 'a', A: 'a' };
  document.addEventListener('keydown', (e) => {
    if (isOpen || e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    keyStep(ARROWS[e.key] || 'x');
  }, true);
  // Au doigt : on observe les glissements sans jamais les bloquer.
  let t0 = null;
  document.addEventListener('touchstart', (e) => {
    if (isOpen || e.touches.length !== 1) { t0 = null; return; }
    const p = e.touches[0];
    t0 = { x: p.clientX, y: p.clientY, at: Date.now() };
  }, { capture: true, passive: true });
  document.addEventListener('touchend', (e) => {
    if (isOpen || !t0 || !e.changedTouches.length) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - t0.x, dy = p.clientY - t0.y, dt = Date.now() - t0.at;
    t0 = null;
    if (dt > 1200) return;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax < 12 && ay < 12) touchStep('tap');
    else if (Math.max(ax, ay) >= 30 && Math.max(ax, ay) > 1.5 * Math.min(ax, ay)) touchStep(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    else touchStep('x');
  }, { capture: true, passive: true });

  window.OrbiteInvaders = { open, close, isOpen: () => isOpen };
})();
