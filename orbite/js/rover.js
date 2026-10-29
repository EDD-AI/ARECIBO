/* ORBITE — un petit rover (v94) qui traverse très rarement l'horizon du menu, de droite à gauche :
 * une silhouette noire de robot à chenilles, deux yeux qui luisent à peine. Chaque minute passée au
 * menu, il a 0,5 % de chance de passer. window.OrbiteRover.go() le fait passer tout de suite. */
(function () {
  'use strict';
  const O = window.__orbite;
  if (!O || !O.ui) return;
  const CHANCE = 0.005, EVERY = 60000;
  // Silhouette en pixels (tournée vers la gauche) : X = coque noire, o = œil qui luit. Deux images
  // pour les chenilles.
  const BODY = [
    '....XXXX.XXXX.......',
    '...XoXXXXXoXXX......',
    '...XXXXXXXXXXX......',
    '.....XXX.XXX........',
    '........XX..........',
    '........XX..........',
    '..XXXXXXXXXXXXXX....',
    '..XXXXXXXXXXXXXX....',
    'XXXXXXXXXXXXXXXXX...',
    'X.XXXXXXXXXXXXXX.X..',
    '..XXXXXXXXXXXXXX....',
    '..XXXXXXXXXXXXXX....'
  ];
  const TRACKS = [
    ['.XXXXXXXXXXXXXXXX...', 'XX.XX.XX.XX.XX.XXX..', '.XXXXXXXXXXXXXXXX...'],
    ['.XXXXXXXXXXXXXXXX...', 'XXX.XX.XX.XX.XX.XX..', '.XXXXXXXXXXXXXXXX...']
  ];
  const rects = (rows, y0, ch, cls) => rows.map((r, y) => [...r].map((c, x) => (c === ch ? `<rect x="${x}" y="${y0 + y}" width="1" height="1"/>` : '')).join('')).join('');
  const W = BODY[0].length, H = BODY.length + TRACKS[0].length;
  const svg = `<svg viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" aria-hidden="true">
    <g class="rv-hull">${rects(BODY, 0, 'X')}</g><g class="rv-eye">${rects(BODY, 0, 'o')}</g>
    <g class="rv-tr a">${rects(TRACKS[0], BODY.length, 'X')}</g><g class="rv-tr b">${rects(TRACKS[1], BODY.length, 'X')}</g></svg>`;

  let busy = false;
  function go() {
    const menu = document.getElementById('menu');
    if (busy || !menu || O.ui.screen !== 'menu') return false;
    busy = true;
    const px = 3;
    const el = document.createElement('div');
    el.className = 'rover';
    el.innerHTML = svg;
    el.style.width = W * px + 'px';
    el.style.height = H * px + 'px';
    // Posé sur l'horizon du menu (repère du menu, agrandi sur PC comme lui).
    el.style.top = Math.round((O.ui.horizon || 300) - H * px + 3) + 'px';
    menu.appendChild(el);
    const w = menu.clientWidth || window.innerWidth;
    const anim = el.animate([{ transform: `translateX(${w + 20}px)` }, { transform: `translateX(${-W * px - 20}px)` }], { duration: 32000, easing: 'linear' });
    const end = () => { el.remove(); busy = false; };
    anim.onfinish = end;
    anim.oncancel = end;
    return true;
  }
  setInterval(() => {
    if (document.hidden || O.ui.screen !== 'menu') return;
    if (Math.random() < CHANCE) go();
  }, EVERY);
  window.OrbiteRover = { go };
})();
