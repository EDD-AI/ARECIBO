/* ORBITE — kit visuel, groupe « affiche » : l'affiche (key art), l'image phare du jeu.
 *
 * Composition commune à tous les formats : un grand trou noir (Umbra, version carte du jeu) au
 * centre du ciel, avec le logo et l'accroche dans son ombre ; deux systèmes rivaux qui s'affrontent
 * de part et d'autre (à gauche le Maelström légendaire DORÉ, à droite le Grand Attracteur) : leurs
 * tirs se rencontrent dans une explosion ; la grande planète d'horizon du menu (génome « horizon »)
 * ferme le bas de l'image. Tout est rendu par le moteur du jeu (outils/kit.js), en pixels entiers.
 *
 * Exports (presse/png/affiche/) :
 *   affiche-1920x1080-fr.png, -en.png, affiche-1920x1080-sans-texte.png
 *   affiche-3840x2160-sans-texte.png (fond d'écran 4K)
 *   fond-ecran-telephone-1170x2532-sans-texte.png
 *   affiche-verticale-1080x1350-fr.png, -en.png
 * Exporter : node presse/outils/exporter.cjs --port 8811 --groupe affiche
 */
(function () {
  'use strict';
  const C = Kit.COULEURS;
  const fam = (f) => Kit.couleurFamille(f);

  // Planète d'horizon : le stade « vie » vu de près, peu d'atmosphère (sinon son halo tramé
  // couvre la moitié de l'image), un peu assombrie pour rester au second plan.
  const HORIZON = { stade: 'vie', dim: 0.6, halo: 0.02, canaux: { moon: 0, ice: 0, clouds: 0.3, air: 0.01 }, orient: { lat: 0.3, lon: 4.2 } };

  // ─── Aides ────────────────────────────────────────────────────

  // Grande planète d'horizon en dôme : centre (cx, cy) sous la toile, rayon R (px écran), coupée
  // au bas de la toile.
  function dome(ctx, cx, cy, R, px, o) {
    const H = ctx.canvas.height;
    const P = Kit.horizon(Object.assign({ taille: 2 * R, pixel: px, coupe: (H + 2 - cy) / R }, HORIZON, o || {}));
    Kit.poser(ctx, P, cx, cy);
    return P;
  }

  // Rayons en croix tramés (éclair de lumière) de longueur L px, du blanc vers le noir.
  function rayons(ctx, x, y, o) {
    o = o || {};
    const p = o.pixel || 4, n = 4;
    const T = Kit.tons(o.couleur || '#ffffff', n, '#000000');
    const gx = Math.floor(x / p), gy = Math.floor(y / p), m = Math.round((o.long || 120) / p);
    const branche = (dx, dy, long, f) => {
      for (let i = 1; i <= long; i++) {
        const cx = gx + dx * i, cy = gy + dy * i;
        const t = Kit.palier(Math.pow(1 - i / long, 1.6) * f, n, cx, cy);
        if (t < 0) continue;
        ctx.fillStyle = T[t];
        ctx.fillRect(cx * p, cy * p, p, p);
      }
    };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) branche(dx, dy, m, 1);
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) branche(dx, dy, Math.round(m * 0.35), 0.8);
  }

  // Tir : traînée épaisse de la couleur de la famille du tireur, tête blanche et lueur.
  function tir(ctx, t, p) {
    const k = t.k || 1;
    Kit.trainee(ctx, t.de[0], t.de[1], t.a[0], t.a[1], { pixel: p, couleur: '#ffffff', queue: fam(t.famille), epaisseur: t.epaisseur || 4, tete: 0, tons: 6 });
    Kit.halo(ctx, t.a[0], t.a[1], { pixel: p, rayon: (t.lueur || 26) * k, couleur: fam(t.famille), coeur: '#ffffff', force: 0.95, tons: 3 });
    Kit.eclat(ctx, t.a[0], t.a[1], { pixel: p, taille: 5, couleur: '#ffffff' });
    if (t.impact) {
      Kit.impact(ctx, t.a[0] + (t.impact.dx || 0), t.a[1] + (t.impact.dy || 0), {
        pixel: p, rayon: (t.impact.rayon || 46) * k, n: t.impact.n || 40, graine: t.impact.graine || 9,
        couleurs: ['#ffffff', fam(t.famille), '#ffffff'], anneau: false
      });
    }
  }

  // Explosion au point de rencontre de deux tirs : halo blanc et or, gerbe, éclair en croix.
  function explosion(ctx, e, p) {
    const r = e.rayon, cols = e.couleurs || ['#ffffff', C.or, fam('nebuleuse')];
    Kit.halo(ctx, e.x, e.y, { pixel: p, rayon: r * 1.6, couleur: cols[2], force: 0.55, tons: 3, profil: 1.6 });
    Kit.halo(ctx, e.x, e.y, { pixel: p, rayon: r, couleur: cols[1], coeur: '#ffffff', force: 1, tons: 4, profil: 1.1 });
    Kit.impact(ctx, e.x, e.y, { pixel: p, rayon: r * 1.7, couleurs: cols, n: e.n || 110, graine: e.graine || 3, anneau: false, eclat: false });
    rayons(ctx, e.x, e.y, { pixel: p, long: r * 2.6 });
    Kit.eclat(ctx, e.x, e.y, { pixel: p, taille: 9, couleur: '#ffffff', halo: cols[1] });
  }

  // Coupe une phrase en deux lignes de largeurs proches (aux espaces normales seulement : les
  // insécables du français restent collées).
  function deuxLignes(ctx, texte, o) {
    const mots = String(texte).split(' ');
    let best = null;
    for (let i = 1; i < mots.length; i++) {
      const a = mots.slice(0, i).join(' '), b = mots.slice(i).join(' ');
      const w = Math.max(Kit.mesurer(ctx, a, o).w, Kit.mesurer(ctx, b, o).w);
      if (!best || w < best.w) best = { w, l: [a, b] };
    }
    return best ? best.l : [String(texte)];
  }

  // ─── Rendu d'une composition ──────────────────────────────────
  // L : { px (pixel des astres), etoiles: { pixel, densite, graine }, trou: { x, y, r },
  //       horizon: { cx, cy, R } | null, tirs: [...], explosions: [...], astres: [{ id, x, y, taille, o }]
  //       (du fond vers l'avant), texte: { logo (pixel), logoDy, accroche (taille), accrocheDy,
  //       interligne, genre (taille), genreY } | null }
  function composer(ctx, s, L) {
    const W = s.largeur, H = s.hauteur, PX = L.px, T = L.trou;
    Kit.etoiles(ctx, Object.assign({ pixel: 2, graine: 0x0b17, eviter: [{ x: T.x, y: T.y, r: T.r + 8 }] }, L.etoiles || {}));
    if (L.horizon) dome(ctx, L.horizon.cx, L.horizon.cy, L.horizon.R, PX, L.horizon.o);
    Kit.poser(ctx, Kit.astre('umbra', { rayonEcran: T.r, pixel: PX }), T.x, T.y);
    for (const t of L.tirs || []) tir(ctx, t, PX);
    for (const e of L.explosions || []) explosion(ctx, e, PX);
    for (const a of L.astres) Kit.poser(ctx, Kit.astre(a.id, Object.assign({ taille: a.taille, pixel: PX }, a.o || {})), a.x, a.y);
    const X = L.texte;
    if (!X || !s.lang) return;
    // Logo et accroche dans l'ombre du trou noir (noir pur : contraste maximal).
    Kit.poser(ctx, Kit.logo({ pixel: X.logo }), T.x, T.y + X.logoDy);
    const oA = { taille: X.accroche, poids: 500, align: 'centre', couleur: C.blanc };
    deuxLignes(ctx, Kit.texte('accroche', s.lang), oA).forEach((l, i) => Kit.ecrire(ctx, l, T.x, T.y + X.accrocheDy + i * X.interligne, oA));
    if (X.genre) Kit.ecrire(ctx, Kit.texte('genre', s.lang), W / 2, X.genreY, { taille: X.genre, poids: 600, align: 'centre', espacement: 0.28, couleur: C.or });
  }

  // ─── Affiche 1920 × 1080 ──────────────────────────────────────
  const A1080 = {
    px: 4,
    trou: { x: 960, y: 395, r: 312 },
    horizon: { cx: 960, cy: 1080 + 2000, R: 2140 },
    tirs: [
      { de: [720, 965], a: [1200, 950], famille: 'vie', epaisseur: 3, lueur: 18, impact: { dx: 15, dy: -2, graine: 9 } },
      { de: [500, 705], a: [920, 820], famille: 'tempete' },
      { de: [1420, 715], a: [1000, 820], famille: 'nebuleuse' }
    ],
    explosions: [{ x: 960, y: 820, rayon: 64 }],
    astres: [
      { id: 'supernova', x: 150, y: 285, taille: 200 },
      { id: 'europe', x: 120, y: 985, taille: 150 },
      { id: 'eden', x: 640, y: 950, taille: 190 },
      { id: 'coeurcristal', x: 1775, y: 285, taille: 205 },
      { id: 'sentinelle', x: 1800, y: 975, taille: 160 },
      { id: 'tarentule', x: 1290, y: 950, taille: 200 },
      { id: 'attracteur', x: 1550, y: 680, taille: 430, o: { legendaire: false } },
      { id: 'maelstrom', x: 380, y: 680, taille: 470, o: { dore: true } }
    ],
    texte: { logo: 15, logoDy: -58, accroche: 36, accrocheDy: 70, interligne: 46, genre: 18, genreY: 1080 - 36 }
  };
  Kit.scene({
    nom: 'affiche-1920x1080', largeur: 1920, hauteur: 1080, langues: ['fr', 'en'],
    titre: 'Affiche 1920 × 1080', usage: 'Image phare (key art) : page du jeu, presse, bannières, vidéos.',
    dessiner: (ctx, s) => composer(ctx, s, A1080)
  });
  Kit.scene({
    nom: 'affiche-1920x1080-sans-texte', largeur: 1920, hauteur: 1080, langues: [],
    titre: 'Affiche 1920 × 1080 sans texte', usage: 'Image phare sans logo ni texte (le centre du trou noir reste libre pour un titre).',
    dessiner: (ctx, s) => composer(ctx, s, A1080)
  });
  // ─── Fond d'écran 4K 3840 × 2160 (sans texte) ─────────────────
  // Même scène que l'affiche, recomposée pour un écran : pixels plus fins (6 px au lieu de 8 pour
  // un simple agrandissement), plus d'astres, une comète au loin ; le centre du trou noir reste vide.
  const A4K = {
    px: 6,
    etoiles: { pixel: 3, densite: 1.1, graine: 0x0b17 },
    trou: { x: 1920, y: 800, r: 620 },
    horizon: { cx: 1920, cy: 2160 + 4000, R: 4280 },
    tirs: [
      { de: [3050, 370], a: [2780, 250], famille: 'anomalie', epaisseur: 3, lueur: 30, impact: null },
      { de: [1440, 1930], a: [2400, 1900], famille: 'vie', epaisseur: 3, lueur: 36, impact: { dx: 30, dy: -4, rayon: 90, n: 60, graine: 9 } },
      { de: [1010, 1410], a: [1840, 1640], famille: 'tempete', epaisseur: 5, lueur: 50 },
      { de: [2830, 1430], a: [2000, 1640], famille: 'nebuleuse', epaisseur: 5, lueur: 50 }
    ],
    explosions: [{ x: 1920, y: 1640, rayon: 130, n: 200 }],
    astres: [
      { id: 'multivers', x: 3420, y: 200, taille: 220 },
      { id: 'hyakutake', x: 520, y: 140, taille: 260, o: { legendaire: false } },
      { id: 'supernova', x: 300, y: 590, taille: 400 },
      { id: 'europe', x: 230, y: 1960, taille: 300 },
      { id: 'eden', x: 1280, y: 1900, taille: 380 },
      { id: 'coeurcristal', x: 3550, y: 590, taille: 410 },
      { id: 'sentinelle', x: 3600, y: 1950, taille: 320 },
      { id: 'tarentule', x: 2580, y: 1900, taille: 400 },
      { id: 'attracteur', x: 3100, y: 1360, taille: 860, o: { legendaire: false } },
      { id: 'maelstrom', x: 760, y: 1360, taille: 940, o: { dore: true } }
    ],
    texte: null
  };
  Kit.scene({
    nom: 'affiche-3840x2160-sans-texte', largeur: 3840, hauteur: 2160, langues: [],
    titre: 'Fond d’écran 4K 3840 × 2160', usage: 'Fond d’écran d’ordinateur, sans texte.',
    dessiner: (ctx, s) => composer(ctx, s, A4K)
  });

  // ─── Fond d'écran de téléphone 1170 × 2532 (sans texte) ───────
  // Le duel vu comme sur le téléphone : le rival en haut, le joueur en bas. Le haut (heure,
  // widgets) reste calme ; les tirs se croisent dans l'ombre du trou noir ; l'horizon en bas.
  const TEL = {
    px: 5,
    etoiles: { pixel: 3, densite: 1, graine: 0x0b17 },
    trou: { x: 585, y: 1290, r: 250 },
    horizon: { cx: 585, cy: 2532 + 1500, R: 1720 },
    tirs: [
      { de: [470, 1700], a: [575, 1350], famille: 'tempete', epaisseur: 4, lueur: 30 },
      { de: [800, 930], a: [600, 1310], famille: 'nebuleuse', epaisseur: 4, lueur: 30 },
      { de: [930, 2050], a: [960, 2400], famille: 'vie', epaisseur: 3, lueur: 18, impact: null }
    ],
    explosions: [{ x: 588, y: 1330, rayon: 72, n: 130 }],
    astres: [
      { id: 'coeurcristal', x: 200, y: 860, taille: 210 },
      { id: 'tarentule', x: 1010, y: 1610, taille: 190 },
      { id: 'attracteur', x: 860, y: 850, taille: 420, o: { legendaire: false } },
      { id: 'supernova', x: 1000, y: 2000, taille: 200 },
      { id: 'europe', x: 130, y: 2280, taille: 150 },
      { id: 'maelstrom', x: 350, y: 1860, taille: 520, o: { dore: true } }
    ],
    texte: null
  };
  Kit.scene({
    nom: 'fond-ecran-telephone-1170x2532-sans-texte', largeur: 1170, hauteur: 2532, langues: [],
    titre: 'Fond d’écran de téléphone 1170 × 2532', usage: 'Écran de verrouillage ou d’accueil (le haut reste libre pour l’heure).',
    dessiner: (ctx, s) => composer(ctx, s, TEL)
  });

  // ─── Affiche verticale 1080 × 1350 (réseaux, format 4:5) ──────
  const V45 = {
    px: 4,
    trou: { x: 540, y: 440, r: 292 },
    horizon: { cx: 540, cy: 1350 + 1500, R: 1660 },
    tirs: [
      { de: [360, 900], a: [505, 1030], famille: 'tempete', epaisseur: 4 },
      { de: [740, 890], a: [575, 1030], famille: 'nebuleuse', epaisseur: 4 }
    ],
    explosions: [{ x: 540, y: 1030, rayon: 58 }],
    astres: [
      { id: 'supernova', x: 110, y: 110, taille: 170 },
      { id: 'coeurcristal', x: 972, y: 110, taille: 175 },
      { id: 'europe', x: 90, y: 1220, taille: 130 },
      { id: 'sentinelle', x: 990, y: 1225, taille: 130 },
      { id: 'attracteur', x: 850, y: 860, taille: 360, o: { legendaire: false } },
      { id: 'maelstrom', x: 240, y: 880, taille: 400, o: { dore: true } }
    ],
    texte: { logo: 13, logoDy: -54, accroche: 32, accrocheDy: 64, interligne: 42, genre: 17, genreY: 1350 - 34 }
  };
  Kit.scene({
    nom: 'affiche-verticale-1080x1350', largeur: 1080, hauteur: 1350, langues: ['fr', 'en'],
    titre: 'Affiche verticale 1080 × 1350', usage: 'Réseaux sociaux en portrait (4:5).',
    dessiner: (ctx, s) => composer(ctx, s, V45)
  });
})();
