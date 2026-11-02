/* ORBITE — kit visuel, groupe « affiche » : brouillons (pistes de composition). */
(function () {
  'use strict';
  const C = Kit.COULEURS;
  const fam = (f) => Kit.couleurFamille(f);

  // Grande planète d'horizon en dôme, coupée au bas de la toile.
  function dome(ctx, cx, cy, R, o) {
    o = o || {};
    const H = ctx.canvas.height;
    const P = Kit.horizon(Object.assign({
      taille: 2 * R, pixel: o.pixel || 4, coupe: (H + 2 - cy) / R,
      orient: { lat: -0.2, lon: 1.4 }, stade: 'civil', canaux: { moon: 0, ice: 0.2, sats: 0, ring: 0 }, dim: 0.6
    }, o.astre || {}));
    Kit.poser(ctx, P, cx, cy);
    return P;
  }

  // Tir : traînée épaisse de la couleur de la famille, tête blanche.
  function tir(ctx, a, b, o) {
    o = o || {};
    const p = o.pixel || 4;
    Kit.trainee(ctx, a[0], a[1], b[0], b[1], { pixel: p, couleur: o.tete || '#ffffff', queue: o.couleur, epaisseur: o.epaisseur || 3, tete: 0, tons: 6 });
    Kit.halo(ctx, b[0], b[1], { pixel: p, rayon: o.lueur || 22, couleur: o.couleur, coeur: '#ffffff', force: 0.9, tons: 3 });
    Kit.eclat(ctx, b[0], b[1], { pixel: p, taille: 5, couleur: '#ffffff' });
  }

  // Explosion au point de rencontre de deux tirs.
  function explosion(ctx, x, y, o) {
    o = o || {};
    const p = o.pixel || 4, r = o.rayon || 90;
    const cols = o.couleurs || ['#ffffff', C.or, '#ff8a2a'];
    Kit.halo(ctx, x, y, { pixel: p, rayon: r, couleur: cols[1], coeur: '#ffffff', force: 1, tons: 4, profil: 1.3 });
    Kit.impact(ctx, x, y, { pixel: p, rayon: r * 1.5, couleurs: cols, n: o.n || 90, graine: o.graine || 3, anneau: true, eclat: false });
    Kit.impact(ctx, x, y, { pixel: p, rayon: r * 0.9, couleurs: ['#ffffff', cols[1]], n: 40, graine: (o.graine || 3) + 7, anneau: false, eclat: false });
    Kit.eclat(ctx, x, y, { pixel: p, taille: 9, couleur: '#ffffff', halo: cols[1] });
  }

  function poser(ctx, id, xy, o) {
    const a = Kit.astre(id, Object.assign({ pixel: 4 }, o || {}));
    Kit.poser(ctx, a, xy[0], xy[1]);
    return a;
  }

  // ─── Piste A : horizon en bas, deux camps dans le ciel, logo en haut ─────
  Kit.scene({
    nom: 'essai-a', largeur: 1920, hauteur: 1080, langues: ['fr'],
    async dessiner(ctx, s) {
      const W = s.largeur, H = s.hauteur, PX = 4;
      Kit.etoiles(ctx, { pixel: 2, graine: 0x0b17 });
      dome(ctx, W / 2, H + 1300, 1640, { pixel: PX });
      // Camp du joueur (gauche) / camp rival (droite)
      const J = { maelstrom: [500, 600], supernova: [200, 360], eden: [180, 800], pleinelune: [690, 330] };
      const V = { attracteur: [1440, 560], coeurcristal: [1740, 330], tarentule: [1730, 790], sentinelle: [1210, 330] };
      tir(ctx, [610, 560], [930, 560], { couleur: fam('tempete') });
      tir(ctx, [1320, 580], [990, 570], { couleur: fam('nebuleuse') });
      explosion(ctx, 960, 566, { pixel: PX, rayon: 80, couleurs: ['#ffffff', C.or, fam('nebuleuse')] });
      tir(ctx, [300, 400], [1130, 340], { couleur: fam('brasier'), epaisseur: 2 });
      tir(ctx, [1640, 740], [330, 780], { couleur: fam('cristal'), epaisseur: 2 });
      poser(ctx, 'supernova', J.supernova, { taille: 210 });
      poser(ctx, 'eden', J.eden, { taille: 230 });
      poser(ctx, 'pleinelune', J.pleinelune, { taille: 150 });
      poser(ctx, 'sentinelle', V.sentinelle, { taille: 190 });
      poser(ctx, 'coeurcristal', V.coeurcristal, { taille: 230 });
      poser(ctx, 'tarentule', V.tarentule, { taille: 250 });
      poser(ctx, 'attracteur', V.attracteur, { taille: 420, legendaire: false });
      poser(ctx, 'maelstrom', J.maelstrom, { taille: 440, dore: true });
      Kit.tramage(ctx, 0, 0, W, 300, { couleur: '#000000', sens: 'haut', de: 0, a: 0.9, pixel: PX });
      Kit.poser(ctx, Kit.logo({ pixel: 16 }), W / 2, 110);
      Kit.ecrire(ctx, Kit.texte('accroche', s.lang), W / 2, 225, { taille: 34, poids: 500, align: 'centre' });
      Kit.ecrire(ctx, Kit.texte('genre', s.lang), W / 2, 272, { taille: 18, poids: 600, align: 'centre', espacement: 0.28, couleur: C.or });
    }
  });

  // ─── Piste B : grand trou noir au centre, logo dans son ombre ─────
  Kit.scene({
    nom: 'essai-b', largeur: 1920, hauteur: 1080, langues: ['fr'],
    async dessiner(ctx, s) {
      const W = s.largeur, H = s.hauteur, PX = 4;
      Kit.etoiles(ctx, { pixel: 2, graine: 0x0b17 });
      const T = Kit.astre('umbra', { rayonEcran: 280, pixel: PX });
      Kit.poser(ctx, T, W / 2, 420);
      const J = { maelstrom: [360, 660], supernova: [150, 330], eden: [620, 930] };
      const V = { attracteur: [1580, 650], coeurcristal: [1780, 330], tarentule: [1320, 930] };
      tir(ctx, [470, 640], [920, 800], { couleur: fam('tempete') });
      tir(ctx, [1470, 660], [1000, 800], { couleur: fam('nebuleuse') });
      explosion(ctx, 960, 800, { pixel: PX, rayon: 70, couleurs: ['#ffffff', C.or, fam('nebuleuse')] });
      poser(ctx, 'supernova', J.supernova, { taille: 210 });
      poser(ctx, 'eden', J.eden, { taille: 220 });
      poser(ctx, 'coeurcristal', V.coeurcristal, { taille: 220 });
      poser(ctx, 'tarentule', V.tarentule, { taille: 230 });
      poser(ctx, 'attracteur', V.attracteur, { taille: 400, legendaire: false });
      poser(ctx, 'maelstrom', J.maelstrom, { taille: 440, dore: true });
      Kit.poser(ctx, Kit.logo({ pixel: 13 }), W / 2, 420);
      Kit.ecrire(ctx, Kit.texte('accroche', s.lang), W / 2, 1000, { taille: 34, poids: 500, align: 'centre' });
      Kit.ecrire(ctx, Kit.texte('genre', s.lang), W / 2, 1044, { taille: 18, poids: 600, align: 'centre', espacement: 0.28, couleur: C.or });
    }
  });
})();
