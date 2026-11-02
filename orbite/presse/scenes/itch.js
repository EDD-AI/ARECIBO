/* ORBITE — kit visuel, groupe « itch » : la page itch.io (agent itch).
 * Exports : presse/png/itch/.
 *   itch-couverture-630x500-<lang>        couverture (vignette des listes, lisible à 315 × 250)
 *   itch-banniere-960x300-<lang>          bannière d'en-tête (zone sûre : 80 px sur chaque bord)
 *   itch-fond-1920x1080                   fond de page, sans texte (colonne centrale de 960 px calme)
 *   itch-section-<cle>-630x90-<lang>      bandeaux de section de la description (fond transparent)
 *   itch-point-<cle>-630x260-<lang>       cartes « points forts » (achetez, placez, affrontez)
 * THEME.txt (couleurs et polices conseillées pour la page) est écrit à la main dans png/itch/.
 */
(function () {
  'use strict';
  const C = Kit.COULEURS;
  const PISTES = true; // true : ajoute les scènes d'essai (jamais exportées dans png/)
  const NB = ' ', FINE = ' ';

  // ─── Textes absents de outils/textes.js : table locale (À AJOUTER À textes.js) ──────
  // Formulations tirées des règles du jeu (js/lang/duel.js : « trois copies du même astre
  // fusionnent en un astre doré, deux fois plus fort », « deux rangées », « l’avant attaque et
  // encaisse ; l’arrière est à l’abri des attaques et avance quand l’avant est tombé »).
  const TXT = {
    genreCourt: { fr: 'AUTO-BATTLER COSMIQUE', en: 'COSMIC AUTO-BATTLER' },
    modesDeJeu: { fr: 'MODES DE JEU', en: 'GAME MODES' },
    jouerEnLigne: { fr: 'JOUER EN LIGNE', en: 'PLAY ONLINE' },
    phraseAchetez: {
      fr: 'Achetez des astres' + NB + ': planètes, lunes, comètes, étoiles, trous' + NB + 'noirs… Trois copies du même astre fusionnent en un astre doré, deux fois plus fort.',
      en: 'Buy orbs: planets, moons, comets, stars, black' + NB + 'holes… Three copies of the same orb fuse into a golden orb, twice as strong.'
    },
    phrasePlacez: {
      fr: 'Placez-les sur deux rangées. L’avant attaque et encaisse' + FINE + '; l’arrière, à l’abri, avance quand l’avant est tombé.',
      en: 'Place them on two rows. The front attacks and takes hits; the back stays safe and advances once the front has fallen.'
    },
    phraseAffrontez: {
      fr: 'Votre système affronte les systèmes rivaux, manche après manche.',
      en: 'Your system clashes with rival systems, round after round.'
    }
  };
  const t = (cle, lang) => TXT[cle][lang];

  // ─── Aides ────────────────────────────────────────────────────
  // Filet pointillé horizontal (blocs de p px), qui s'éteint vers la droite par paliers tramés.
  function filet(ctx, x0, x1, y, o) {
    o = o || {};
    const p = o.pixel || 3, pas = o.pas || 2;
    const T = Kit.tons(o.couleur || C.gris, 3, '#000000');
    const g0 = Math.ceil(x0 / p), g1 = Math.floor(x1 / p), gy = Math.floor(y / p);
    ctx.save();
    for (let gx = g0; gx <= g1; gx++) {
      if ((gx - g0) % pas) continue;
      const k = 1 - (gx - g0) / Math.max(1, g1 - g0);
      const i = Kit.palier((o.force || 0.9) * Math.pow(k, o.courbe || 0.8), 3, gx, gy);
      if (i < 0) continue;
      ctx.fillStyle = T[i];
      ctx.fillRect(gx * p, gy * p, p, p);
    }
    ctx.restore();
  }
  // Orbite : ellipse pointillée en blocs de p px (rx, ry en px ; inclinaison en radians).
  function orbite(ctx, cx, cy, rx, ry, o) {
    o = o || {};
    const p = o.pixel || 2, incl = o.inclinaison || 0;
    const n = Math.round((2 * Math.PI * Math.max(rx, ry)) / (p * (o.pas || 4)));
    const vu = new Set();
    ctx.save();
    ctx.fillStyle = o.couleur || '#2b3242';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
      const x = cx + ex * Math.cos(incl) - ey * Math.sin(incl);
      const y = cy + ex * Math.sin(incl) + ey * Math.cos(incl);
      const gx = Math.floor(x / p), gy = Math.floor(y / p), k = gx + ',' + gy;
      if (vu.has(k)) continue;
      vu.add(k);
      ctx.fillRect(gx * p, gy * p, p, p);
    }
    ctx.restore();
  }
  // Point d'une orbite (même paramétrage que orbite()).
  function surOrbite(cx, cy, rx, ry, incl, a) {
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    return [cx + ex * Math.cos(incl) - ey * Math.sin(incl), cy + ex * Math.sin(incl) + ey * Math.cos(incl)];
  }
  // Petit disque pixel (motif) : couleur pleine, ombré en bas à droite, reflet en haut à gauche.
  function pastille(ctx, x, y, r, couleur, p) {
    const T = Kit.tons(couleur, 3, '#000000');
    const c = Kit.hexRgb(couleur);
    const clair = Kit.rgbHex(c.map((v) => v + (255 - v) * 0.45));
    const gx0 = Math.floor((x - r) / p), gy0 = Math.floor((y - r) / p);
    ctx.save();
    for (let gy = gy0; gy * p <= y + r; gy++) {
      for (let gx = gx0; gx * p <= x + r; gx++) {
        const dx = (gx + 0.5) * p - x, dy = (gy + 0.5) * p - y;
        if (dx * dx + dy * dy > r * r) continue;
        const l = (-dx - dy) / (r * 1.4);
        ctx.fillStyle = l > 0.45 ? clair : l > -0.35 ? couleur : T[1];
        ctx.fillRect(gx * p, gy * p, p, p);
      }
    }
    ctx.restore();
  }

  // ─── Couverture 630 × 500 : le logo dans l'horizon d'un trou noir ─────────────
  // Lisible réduite à 315 × 250 : logo de 350 px (pixel 10) sur le noir pur du trou noir Umbra,
  // Bételgeuse (Brasier) et Pélagia (Vie) sur le disque, genre court en or en bas.
  Kit.scene({
    nom: 'itch-couverture-630x500', largeur: 630, hauteur: 500,
    titre: 'Couverture itch.io (630 × 500)',
    usage: 'Image de couverture de la page itch.io : vignette des listes (affichée à 315 × 250).',
    dessiner(ctx, s) {
      const W = s.largeur, H = s.hauteur, PX = 4, cy = 214;
      Kit.etoiles(ctx, { pixel: 2, graine: 23 });
      Kit.poser(ctx, Kit.astre('umbra', { rayonEcran: 196, pixel: PX, phase: 0.2 }), W / 2, cy);
      Kit.poser(ctx, Kit.astre('betelgeuse', { taille: 128, pixel: PX, legendaire: false }), 74, 350);
      Kit.poser(ctx, Kit.astre('pelagia', { taille: 88, pixel: PX }), 556, 82);
      Kit.tramage(ctx, 0, 405, W, H - 405, { couleur: '#000000', sens: 'bas', de: 0, a: 1, pixel: 2, courbe: 0.7 });
      Kit.poser(ctx, Kit.logo({ pixel: 10 }), W / 2, cy);
      Kit.ecrire(ctx, t('genreCourt', s.lang), W / 2, 470, { taille: 22, poids: 600, align: 'centre', espacement: 0.2, couleur: C.or });
    }
  });

  // ─── Bannière d'en-tête 960 × 300 ────────────────────────────
  // Zone sûre : rien d'important à moins de 80 px des bords (logo et accroche entre x 80–880,
  // y 80–220). Le décor (Bételgeuse, Umbra) déborde volontairement des bords.
  Kit.scene({
    nom: 'itch-banniere-960x300', largeur: 960, hauteur: 300,
    titre: 'Bannière d’en-tête itch.io (960 × 300)',
    usage: 'Bannière en haut de la page itch.io (éditeur de thème). Zone sûre : 80 px sur chaque bord.',
    dessiner(ctx, s) {
      const W = s.largeur, PX = 4;
      Kit.etoiles(ctx, { pixel: 2, graine: 31 });
      Kit.poser(ctx, Kit.astre('betelgeuse', { taille: 330, pixel: PX, legendaire: false, phase: 0.3 }), 34, 196);
      Kit.poser(ctx, Kit.astre('umbra', { rayonEcran: 112, pixel: PX, phase: 0.2 }), 930, 132);
      Kit.poser(ctx, Kit.astre('pelagia', { taille: 80, pixel: PX }), 778, 252);
      Kit.trainee(ctx, 150, 34, 292, 62, { pixel: 3, queue: Kit.couleurFamille('comete'), epaisseur: 2 });
      Kit.poser(ctx, Kit.logo({ pixel: 10 }), W / 2, 116);
      Kit.ecrire(ctx, Kit.texte('accroche', s.lang), W / 2, 204, { taille: 24, poids: 500, align: 'centre', couleur: C.blanc });
    }
  });

  // ─── Fond de page 1920 × 1080 (sans texte) ───────────────────
  // La colonne de la page itch (960 px, x 480–1440) reste calme et très sombre ; deux petits
  // systèmes avec leurs orbites sur les côtés, près des bords de la colonne (visibles dès un écran
  // de 1366 px), et tout se fond dans le noir en bas (couleur de page #000000).
  Kit.scene({
    nom: 'itch-fond-1920x1080', largeur: 1920, hauteur: 1080, langues: [],
    titre: 'Fond de page itch.io (1920 × 1080)',
    usage: 'Image de fond de la page itch.io (sans répétition, centrée en haut). Couleur de page : #000000.',
    dessiner(ctx, s) {
      const W = s.largeur, H = s.hauteur, PX = 4;
      const col0 = 480, col1 = 1440;
      Kit.etoiles(ctx, { pixel: 2, graine: 41, x: 0, y: 0, largeur: col0, hauteur: 820 });
      Kit.etoiles(ctx, { pixel: 2, graine: 42, x: col1, y: 0, largeur: W - col1, hauteur: 820 });
      Kit.etoiles(ctx, { pixel: 2, graine: 43, x: col0, y: 0, largeur: col1 - col0, hauteur: 820, densite: 0.3, eclat: 0.45, croix: false });
      // Lueur tramée très sombre en haut (le ciel s'allume vers le haut de la page).
      Kit.tramage(ctx, 0, 0, W, 300, { couleur: '#0c1328', sens: 'haut', de: 0, a: 0.55, pixel: 2, courbe: 1.6 });
      // Système de gauche : Bételgeuse, ses orbites, Pélagia (Vie) et la Lune de sang.
      const G = { x: 300, y: 300, i: -0.22 };
      orbite(ctx, G.x, G.y, 250, 92, { inclinaison: G.i, couleur: '#3a4358', pas: 3 });
      orbite(ctx, G.x, G.y, 390, 150, { inclinaison: G.i, couleur: '#2a3144', pas: 3 });
      Kit.poser(ctx, Kit.astre('betelgeuse', { rayonEcran: 132, pixel: PX, legendaire: false, phase: 0.3 }), G.x, G.y);
      const g1 = surOrbite(G.x, G.y, 250, 92, G.i, 1.15), g2 = surOrbite(G.x, G.y, 390, 150, G.i, 2.2);
      Kit.poser(ctx, Kit.astre('pelagia', { taille: 96, pixel: PX }), g1[0], g1[1]);
      Kit.poser(ctx, Kit.astre('lunesang', { taille: 64, pixel: PX, legendaire: false }), g2[0], g2[1]);
      // Système de droite : Umbra, Tempest doré sur son orbite, la nébuleuse du Crabe plus bas.
      const D = { x: 1620, y: 300, i: 0.2 };
      orbite(ctx, D.x, D.y, 300, 112, { inclinaison: D.i, couleur: '#3a4358', pas: 3 });
      Kit.poser(ctx, Kit.astre('umbra', { rayonEcran: 116, pixel: PX, phase: 0.2 }), D.x, D.y);
      const d1 = surOrbite(D.x, D.y, 300, 112, D.i, -2.05);
      Kit.poser(ctx, Kit.astre('tempest', { taille: 140, pixel: PX, dore: true }), d1[0], d1[1]);
      Kit.poser(ctx, Kit.astre('crabe', { taille: 150, pixel: PX }), 1580, 640);
      Kit.trainee(ctx, 30, 700, 200, 650, { pixel: 3, queue: Kit.couleurFamille('comete'), epaisseur: 2 });
      // Fondu tramé vers le noir de la page.
      Kit.tramage(ctx, 0, 540, W, 440, { couleur: '#000000', sens: 'bas', de: 0, a: 1, pixel: 2 });
      Kit.fond(ctx, '#000000', { x: 0, y: 980, w: W, h: H - 980 });
    }
  });

  // ─── Bandeaux de section 630 × 90 (fond transparent) ─────────
  // Petit astre à gauche, titre en Chakra Petch espacé, filet pointillé qui s'éteint à droite.
  const SECTIONS = [
    { cle: 'comment-jouer', titre: (l) => Kit.tr('COMMENT JOUER', l), astre: ['horizon', { taille: 60, pixel: 3, halo: 0 }] },
    { cle: 'familles', titre: (l) => Kit.faits.familles + NB + Kit.texte('familles', l), astre: ['piliers', { taille: 68, pixel: 3, legendaire: false }], familles: true },
    { cle: 'modes', titre: (l) => t('modesDeJeu', l), astre: ['tempest', { taille: 58, pixel: 3 }] },
    { cle: 'en-ligne', titre: (l) => t('jouerEnLigne', l), astre: ['dyson', { taille: 66, pixel: 3 }] }
  ];
  for (const S of SECTIONS) {
    Kit.scene({
      nom: 'itch-section-' + S.cle + '-630x90', largeur: 630, hauteur: 90, fond: 'transparent',
      titre: 'Bandeau de section « ' + S.titre('fr') + ' » (630 × 90)',
      usage: 'Titre de section dans la description itch.io. Fond transparent (pour une colonne sombre).',
      dessiner(ctx, s) {
        const W = s.largeur, H = s.hauteur;
        Kit.poser(ctx, Kit.astre(S.astre[0], S.astre[1]), 46, H / 2);
        const r = Kit.ecrire(ctx, S.titre(s.lang), 100, 54, { taille: 24, poids: 600, espacement: 0.26, couleur: C.blanc });
        let fin = W - 6;
        if (S.familles) {
          // Les 13 couleurs de familles, de droite à gauche.
          const F = Kit.FAMILLES, pas = 16, r0 = 5;
          const x0 = W - 12 - (F.length - 1) * pas;
          F.forEach((f, i) => pastille(ctx, x0 + i * pas, H / 2, r0, f.couleur, 2));
          fin = x0 - 22;
        }
        filet(ctx, r.x + r.w + 22, fin, H / 2, { pixel: 3, couleur: C.or });
      }
    });
  }

  // ─── Cartes « points forts » 630 × 260 ───────────────────────
  // Visuel d'astres rendus par le moteur d'un côté, verbe en or + phrase exacte de l'autre ;
  // le visuel change de côté d'une carte à l'autre (rythme dans la description).
  const PX_CARTE = 3;
  function cadreCarte(ctx, W, H, graine) {
    Kit.etoiles(ctx, { pixel: 2, graine, densite: 0.6 });
    ctx.save();
    ctx.fillStyle = '#161b27';
    ctx.fillRect(0, 0, W, 2); ctx.fillRect(0, H - 2, W, 2); ctx.fillRect(0, 0, 2, H); ctx.fillRect(W - 2, 0, 2, H);
    ctx.fillStyle = C.or;
    const L = 18, e = 3;
    for (const [x, y, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      ctx.fillRect(sx > 0 ? x : x - L, sy > 0 ? y : y - e, L, e);
      ctx.fillRect(sx > 0 ? x : x - e, sy > 0 ? y : y - L, e, L);
    }
    ctx.restore();
  }
  // Bloc de texte (numéro, verbe, phrase, ligne d'appui facultative), centré verticalement.
  function texteCarte(ctx, s, o) {
    const H = s.hauteur;
    const P = { taille: 18, poids: 400, couleur: C.blanc, largeurMax: o.largeur, interligne: 1.4 };
    const mp = Kit.mesurer(ctx, o.phrase, P);
    const hNum = 13, gNum = 22, hVerbe = 25, gVerbe = 24;
    const hPhrase = (mp.lignes.length - 1) * 18 * 1.4 + 13;
    const hAppui = o.appui ? 30 : 0;
    let y = Math.round((H - (hNum + gNum + hVerbe + gVerbe + hPhrase + hAppui)) / 2) + hNum;
    Kit.ecrire(ctx, o.num, o.x, y, { taille: 13, poids: 600, espacement: 0.3, couleur: C.gris });
    y += gNum + hVerbe;
    Kit.ecrire(ctx, o.verbe, o.x - 1, y, { taille: 34, poids: 600, espacement: 0.2, couleur: C.or });
    y += gVerbe + 13;
    Kit.ecrire(ctx, o.phrase, o.x, y, P);
    if (o.appui) Kit.ecrire(ctx, o.appui, o.x, y + hPhrase + 17, { taille: 18, poids: 600, couleur: C.or, largeurMax: o.largeur });
  }
  // Case vide d'une rangée (cadre pointillé).
  function caseVide(ctx, cx, cy, c) {
    const p = 2, h = Math.floor(c / 2);
    ctx.save();
    ctx.fillStyle = '#2a3142';
    for (let k = -h; k < h; k += 2 * p) {
      ctx.fillRect(cx + k, cy - h, p, p); ctx.fillRect(cx + k, cy + h - p, p, p);
      ctx.fillRect(cx - h, cy + k, p, p); ctx.fillRect(cx + h - p, cy + k, p, p);
    }
    ctx.restore();
  }
  // Trait de formation sous des astres d'une même famille (couleur de la famille, tramé).
  function traitFormation(ctx, x0, x1, y, fam) {
    const c = Kit.couleurFamille(fam);
    ctx.save();
    ctx.fillStyle = c;
    for (let x = Math.floor(x0 / 3) * 3; x <= x1; x += 3) if ((x / 3) % 2 === 0) ctx.fillRect(x, y, 3, 3);
    ctx.fillRect(x0, y - 3, 3, 9); ctx.fillRect(x1 - 2, y - 3, 3, 9);
    ctx.restore();
  }

  const POINTS = [
    {
      cle: 'achetez', n: 0, graine: 51,
      visuel(ctx, s) {
        // Trois copies du même astre → un astre doré.
        for (const y of [64, 130, 196]) Kit.poser(ctx, Kit.astre('tempest', { rayonEcran: 21, pixel: PX_CARTE }), 70, y);
        Kit.poser(ctx, Kit.motPixel('»', { pixel: PX_CARTE, couleur: C.or }), 142, 130);
        Kit.poser(ctx, Kit.astre('tempest', { rayonEcran: 45, pixel: PX_CARTE, dore: true }), 238, 130);
      },
      texte: { x: 348, largeur: 252 }, phrase: 'phraseAchetez'
    },
    {
      cle: 'placez', n: 1, graine: 52,
      visuel(ctx, s) {
        // Deux rangées : trois Brasier devant, deux Glace derrière (l'exemple du jeu).
        const x0 = 360, pas = 70, yAv = 96, yAr = 190, c = 58;
        const lab = { taille: 11, poids: 600, espacement: 0.3, couleur: C.gris };
        Kit.ecrire(ctx, Kit.tr('AVANT', s.lang), x0 - c / 2, yAv - c / 2 - 10, lab);
        Kit.ecrire(ctx, Kit.tr('ARRIÈRE', s.lang), x0 - c / 2, yAr - c / 2 - 10, lab);
        const avant = ['braise', 'magma', 'vulcain', 'cyclone'], arriere = ['nive', 'banquise', 'gaia', null];
        const o = { rayonEcran: 21, pixel: PX_CARTE };
        avant.forEach((id, i) => Kit.poser(ctx, Kit.astre(id, o), x0 + i * pas, yAv));
        arriere.forEach((id, i) => {
          if (id) Kit.poser(ctx, Kit.astre(id, o), x0 + i * pas, yAr);
          else caseVide(ctx, x0 + i * pas, yAr, 44);
        });
        traitFormation(ctx, x0 - 24, x0 + 2 * pas + 24, yAv + 36, 'brasier');
        traitFormation(ctx, x0 - 24, x0 + pas + 24, yAr + 36, 'glace');
      },
      texte: { x: 34, largeur: 262 }, phrase: 'phrasePlacez'
    },
    {
      cle: 'affrontez', n: 2, graine: 53, appui: 'dernierDebout',
      visuel(ctx, s) {
        // Votre système (en bas) contre un système rival (en haut).
        const haut = [['umbra', 70], ['nyx', 165], ['cendre', 260]], bas = [['nova', 70], ['tempest', 165, { dore: true }], ['magma', 260]];
        const yH = 62, yB = 198, o = { rayonEcran: 22, pixel: PX_CARTE };
        // Tirs en diagonale : de vos astres vers les astres rivaux.
        Kit.trainee(ctx, 84, yB - 24, 152, yH + 22, { pixel: PX_CARTE, couleur: '#fff2c8', queue: Kit.couleurFamille('brasier'), epaisseur: 2, tete: 0 });
        Kit.trainee(ctx, 150, yB - 26, 84, yH + 22, { pixel: PX_CARTE, couleur: '#fff2c8', queue: C.or, epaisseur: 2, tete: 0 });
        Kit.trainee(ctx, 252, yB - 24, 256, yH + 26, { pixel: PX_CARTE, couleur: '#fff2c8', queue: Kit.couleurFamille('brasier'), epaisseur: 2, tete: 0 });
        haut.forEach(([id, x, oo]) => Kit.poser(ctx, Kit.astre(id, Object.assign({}, o, oo || {})), x, yH));
        bas.forEach(([id, x, oo]) => Kit.poser(ctx, Kit.astre(id, Object.assign({}, o, oo || {})), x, yB));
        Kit.impact(ctx, 158, yH + 14, { pixel: PX_CARTE, rayon: 24, n: 20, graine: 4, couleurs: ['#ffffff', '#ffe08a', Kit.couleurFamille('brasier')] });
        Kit.impact(ctx, 80, yH + 16, { pixel: PX_CARTE, rayon: 20, n: 16, graine: 9, anneau: false, couleurs: ['#ffffff', '#ffe08a', C.or] });
      },
      texte: { x: 348, largeur: 252 }, phrase: 'phraseAffrontez'
    }
  ];
  for (const P of POINTS) {
    Kit.scene({
      nom: 'itch-point-' + P.cle + '-630x260', largeur: 630, hauteur: 260,
      titre: 'Point fort « ' + Kit.liste('verbes', 'fr')[P.n] + ' » (630 × 260)',
      usage: 'Carte dans la description itch.io (étape ' + (P.n + 1) + ' sur 3 : achetez, placez, affrontez).',
      dessiner(ctx, s) {
        cadreCarte(ctx, s.largeur, s.hauteur, P.graine);
        P.visuel(ctx, s);
        texteCarte(ctx, s, {
          x: P.texte.x, largeur: P.texte.largeur,
          num: '0' + (P.n + 1),
          verbe: Kit.liste('verbes', s.lang)[P.n],
          phrase: t(P.phrase, s.lang),
          appui: P.appui ? Kit.texte(P.appui, s.lang) : null
        });
      }
    });
  }

  if (PISTES) {
    Kit.scene({
      nom: 'piste-petits', largeur: 900, hauteur: 300, langues: [],
      dessiner(ctx, s) {
        const ids = ['braise', 'scorie', 'vulcain', 'magma', 'pyro', 'nive', 'banquise', 'boreale', 'comete', 'cendre', 'vestige', 'ossuaire', 'nyx', 'abysse', 'sylve', 'gaia', 'cumulus', 'titania'];
        ids.forEach((id, i) => {
          const x = 50 + (i % 9) * 100, y = 60 + Math.floor(i / 9) * 140;
          Kit.poser(ctx, Kit.astre(id, { rayonEcran: 21, pixel: 3, legendaire: false }), x, y);
          Kit.ecrire(ctx, id, x, y + 56, { taille: 12, align: 'centre', couleur: C.gris });
        });
      }
    });
  }
})();
