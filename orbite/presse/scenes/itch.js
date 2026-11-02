/* ORBITE — kit visuel, groupe « itch » : la page itch.io (brouillon d'exploration). */
(function () {
  'use strict';
  const C = Kit.COULEURS;
  const PISTES = true;

  // Textes absents de outils/textes.js (À AJOUTER À textes.js) — table locale.
  const TXT = {
    genreCourt: { fr: 'AUTO-BATTLER COSMIQUE', en: 'COSMIC AUTO-BATTLER' }
  };
  const t = (cle, lang) => TXT[cle][lang];

  if (PISTES) {
    // Piste A : horizon du menu en bas, logo dans le ciel, une légendaire.
    Kit.scene({
      nom: 'piste-couv-a', largeur: 630, hauteur: 500,
      async dessiner(ctx, s) {
        const W = s.largeur, H = s.hauteur, PX = 4;
        const hz = 430;
        Kit.etoiles(ctx, { pixel: 2, graine: 21 });
        const P = Kit.horizon({ taille: 1000, pixel: PX, coupe: 0.52, orient: null });
        Kit.poser(ctx, P, W / 2, hz + 0.52 * P.kit.rayonEcran);
        Kit.sol(ctx, { y: hz, pixel: 2 });
        const B = Kit.astre('oeilvide', { taille: 170, pixel: PX, legendaire: false, complet: true });
        Kit.poser(ctx, B, 520, 175);
        Kit.poser(ctx, Kit.logo({ pixel: 12, lueur: true }), W / 2, 92);
        Kit.ecrire(ctx, t('genreCourt', s.lang), W / 2, 162, { taille: 20, poids: 600, align: 'centre', espacement: 0.22, couleur: C.or });
      }
    });
    // Piste B : deux astres qui s'affrontent (doré contre légendaire), logo en haut.
    Kit.scene({
      nom: 'piste-couv-b', largeur: 630, hauteur: 500,
      async dessiner(ctx, s) {
        const W = s.largeur, H = s.hauteur, PX = 4;
        Kit.etoiles(ctx, { pixel: 2, graine: 22 });
        const A = Kit.astre('betelgeuse', { taille: 330, pixel: PX, legendaire: false, phase: 0.3 });
        const T = Kit.astre('tempest', { taille: 300, pixel: PX, dore: true, phase: 0.1 });
        Kit.poser(ctx, A, 150, 360);
        Kit.poser(ctx, T, 470, 330);
        Kit.trainee(ctx, 230, 330, 380, 310, { pixel: 3, queue: Kit.couleurFamille('brasier'), couleur: '#ffe2b0', epaisseur: 2 });
        Kit.tramage(ctx, 0, 0, W, 200, { couleur: '#000000', sens: 'haut', de: 0, a: 0.85, pixel: 2 });
        Kit.poser(ctx, Kit.logo({ pixel: 12 }), W / 2, 78);
        Kit.ecrire(ctx, t('genreCourt', s.lang), W / 2, 148, { taille: 20, poids: 600, align: 'centre', espacement: 0.22, couleur: C.or });
      }
    });
    // Piste C : le logo DANS un trou noir.
    Kit.scene({
      nom: 'piste-couv-c', largeur: 630, hauteur: 500,
      async dessiner(ctx, s) {
        const W = s.largeur, H = s.hauteur, PX = 4;
        const cy = 228;
        Kit.etoiles(ctx, { pixel: 2, graine: 23 });
        const B = Kit.astre('umbra', { rayonEcran: 196, pixel: PX, phase: 0.2 });
        Kit.poser(ctx, B, W / 2, cy);
        Kit.poser(ctx, Kit.logo({ pixel: 10 }), W / 2, cy);
        Kit.ecrire(ctx, t('genreCourt', s.lang), W / 2, 470, { taille: 20, poids: 600, align: 'centre', espacement: 0.22, couleur: C.or });
      }
    });
    Kit.scene({
      nom: 'piste-couv-d', largeur: 630, hauteur: 500,
      async dessiner(ctx, s) {
        const W = s.largeur, H = s.hauteur, PX = 4;
        const cy = 235;
        Kit.etoiles(ctx, { pixel: 2, graine: 24 });
        const B = Kit.astre('oeilvide', { rayonEcran: 200, pixel: PX, phase: 0.2, legendaire: false, complet: true });
        Kit.poser(ctx, B, W / 2, cy);
        Kit.poser(ctx, Kit.logo({ pixel: 10 }), W / 2, cy);
        Kit.ecrire(ctx, t('genreCourt', s.lang), W / 2, 470, { taille: 20, poids: 600, align: 'centre', espacement: 0.22, couleur: C.or });
      }
    });

    // Pistes C1–C3 : logo dans le trou noir + petits astres.
    const variantesC = {
      c1: { trou: 'umbra', r: 176, autres: [['betelgeuse', 150, 92, 408], ['pelagia', 92, 540, 92]] },
      c2: { trou: 'oeilvide', r: 176, autres: [['betelgeuse', 150, 92, 408], ['tempest', 110, 545, 95, { dore: true }]] },
      c3: { trou: 'umbra', r: 168, autres: [['tempest', 150, 96, 400, { dore: true }], ['lunesang', 84, 548, 86]] },
      c4: { trou: 'umbra', r: 196, cy: 216, autres: [['betelgeuse', 128, 74, 352], ['pelagia', 88, 556, 84]] },
      c5: { trou: 'umbra', r: 196, cy: 216, autres: [['betelgeuse', 150, 64, 64], ['pelagia', 84, 574, 420]] },
      c6: { trou: 'umbra', r: 196, cy: 216, autres: [['betelgeuse', 128, 74, 352], ['tempest', 110, 556, 84, { dore: true }]] }
    };
    for (const k in variantesC) {
      const v = variantesC[k];
      Kit.scene({
        nom: 'piste-couv-' + k, largeur: 630, hauteur: 500,
        async dessiner(ctx, s) {
          const W = s.largeur, H = s.hauteur, PX = 4;
          const cy = v.cy || 222;
          Kit.etoiles(ctx, { pixel: 2, graine: 23 });
          const B = Kit.astre(v.trou, { rayonEcran: v.r, pixel: PX, phase: 0.2, legendaire: false });
          Kit.poser(ctx, B, W / 2, cy);
          for (const [id, taille, x, y, o] of v.autres) Kit.poser(ctx, Kit.astre(id, Object.assign({ taille, pixel: PX, legendaire: false }, o || {})), x, y);
          Kit.poser(ctx, Kit.logo({ pixel: 10 }), W / 2, cy);
          Kit.ecrire(ctx, t('genreCourt', s.lang), W / 2, 466, { taille: 22, poids: 600, align: 'centre', espacement: 0.2, couleur: C.or });
        }
      });
    }
  }
})();
