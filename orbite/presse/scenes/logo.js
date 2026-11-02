/* ORBITE — kit visuel, groupe « logo » (agent fondations) : logos, icône, avatar, favicon.
 * Exports : presse/png/logo/. Sans texte traduit : un seul fichier par scène (langues: []).
 */
(function () {
  'use strict';
  const C = Kit.COULEURS;
  const FONCE = '#05060a';

  // ─── Logo seul (fond transparent, au pixel près : 35 × 7 cellules) ─────────
  for (const px of [4, 8, 16]) {
    Kit.scene({
      nom: 'logo-orbite-blanc-px' + px, titre: 'Logo ORBITE blanc (pixel de ' + px + ' px)',
      usage: 'Sur fond sombre ou sur une image. Fond transparent.',
      largeur: 35 * px, hauteur: 7 * px, langues: [], fond: 'transparent',
      dessiner(ctx) { Kit.poser(ctx, Kit.logo({ pixel: px, couleur: '#ffffff' }), 0, 0, 'haut-gauche'); }
    });
  }
  for (const px of [8, 16]) {
    Kit.scene({
      nom: 'logo-orbite-fonce-px' + px, titre: 'Logo ORBITE foncé (pixel de ' + px + ' px)',
      usage: 'Pour un fond clair. Fond transparent.',
      largeur: 35 * px, hauteur: 7 * px, langues: [], fond: 'transparent',
      dessiner(ctx) { Kit.poser(ctx, Kit.logo({ pixel: px, couleur: FONCE }), 0, 0, 'haut-gauche'); }
    });
  }

  // ─── Logo + STUDIO EDDA ───────────────────────────────────────
  // Hauteur : logo (7 cellules) + écart (2,2 cellules) + capitales du sous-titre (≈ 1,5 cellule)
  // + une marge d'une demi-cellule pour les jambages de la police.
  const hStudio = (px) => Math.ceil(7 * px + Math.round(px * 2.2) + Math.round(Math.round(px * 2.1) * 0.72) + px * 0.6);
  for (const [px, variante] of [[8, 'blanc'], [16, 'blanc'], [8, 'fonce'], [16, 'fonce']]) {
    const sombre = variante === 'fonce';
    Kit.scene({
      nom: 'logo-orbite-studio-edda-' + variante + '-px' + px,
      titre: 'Logo ORBITE + STUDIO EDDA ' + (sombre ? 'foncé' : 'blanc') + ' (pixel de ' + px + ' px)',
      usage: (sombre ? 'Pour un fond clair.' : 'Sur fond sombre.') + ' Fond transparent.',
      largeur: 35 * px, hauteur: hStudio(px), langues: [], fond: 'transparent',
      dessiner(ctx) {
        const L = Kit.logoStudio({ pixel: px, couleur: sombre ? FONCE : '#ffffff', couleurSousTitre: sombre ? '#3a4252' : C.gris });
        Kit.poser(ctx, L, 35 * px / 2, 0, 'haut');
      }
    });
  }

  // ─── Icône 1024 : la planète du joueur et son anneau solaire, logo dessous ──
  Kit.scene({
    nom: 'icone-1024', titre: 'Icône carrée 1024 × 1024',
    usage: 'Icône de l’appli, page de jeu, profil. La planète du joueur (menu) et le logo.',
    largeur: 1024, hauteur: 1024, langues: [], fond: '#000000',
    dessiner(ctx) {
      Kit.etoiles(ctx, { pixel: 4, graine: 7, densite: 0.7, eviter: [{ x: 512, y: 430, r: 330 }] });
      const P = Kit.horizon({ stade: 'vie', canaux: { ring: 1, moon: 0 }, orient: { lat: 0.2, lon: 0.3 }, taille: 600, pixel: 8, phase: 0.08 });
      Kit.poser(ctx, P, 512, 432);
      Kit.poser(ctx, Kit.logo({ pixel: 20, couleur: '#ffffff' }), 512, 872);
    }
  });

  // ─── Avatar 400 (souvent recadré en rond) : la planète seule, bien au centre ──
  Kit.scene({
    nom: 'avatar-400', titre: 'Avatar 400 × 400',
    usage: 'Photo de profil des réseaux (tient dans le cercle de recadrage).',
    largeur: 400, hauteur: 400, langues: [], fond: '#000000',
    dessiner(ctx) {
      Kit.etoiles(ctx, { pixel: 2, graine: 11, densite: 0.8, eviter: [{ x: 200, y: 200, r: 150 }] });
      const P = Kit.horizon({ stade: 'vie', canaux: { moon: 0 }, taille: 252, pixel: 4, phase: 0.08 });
      Kit.poser(ctx, P, 200, 200);
    }
  });

  // ─── Favicon 512 : grille de 32 × 32 pixels agrandie 16 fois ──────────
  Kit.scene({
    nom: 'favicon-512', titre: 'Favicon 512 × 512 (32 × 32 pixels agrandis 16 fois)',
    usage: 'Favicon, icône d’onglet : réduite à 32 ou 16 px, chaque pixel reste net.',
    largeur: 512, hauteur: 512, langues: [], fond: '#000000',
    dessiner(ctx) {
      const P = Kit.horizon({ stade: 'vie', canaux: { moon: 0 }, rayon: 12, pixel: 16, phase: 0.08, halo: 0.16 });
      Kit.poser(ctx, P, 256, 256);
    }
  });
})();
