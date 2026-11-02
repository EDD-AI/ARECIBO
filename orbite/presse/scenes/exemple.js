/* ORBITE — kit visuel, groupe « exemple » (agent fondations) : MODÈLE à copier.
 *
 * Un fichier de scènes = presse/scenes/<groupe>.js, chargé par outils/rendu.html après le moteur
 * du jeu, rules.js, world.js, glyphes.js, textes.js et kit.js. Il enregistre ses scènes avec
 * Kit.scene({ … }). Exporter :
 *   node presse/outils/exporter.cjs --port <p> --groupe exemple            (toutes, FR et EN)
 *   node presse/outils/exporter.cjs --port <p> --groupe exemple --scene exemple-banniere-1200x630 --lang en
 * Aperçu dans un navigateur : http://localhost:<p>/presse/outils/rendu.html?groupe=exemple
 */
(function () {
  'use strict';
  const C = Kit.COULEURS;

  // ─── Une bannière 1200 × 630 (format des aperçus de liens), en français et en anglais ──
  Kit.scene({
    nom: 'exemple-banniere-1200x630',          // fichier : exemple-banniere-1200x630-fr.png / -en.png
    titre: 'Exemple : bannière 1200 × 630',
    usage: 'Démonstration du kit (fond étoilé, trois astres, logo, accroche).',
    largeur: 1200, hauteur: 630,
    langues: ['fr', 'en'],                       // [] = un seul fichier sans suffixe de langue
    fond: '#000000',                             // 'transparent' possible (PNG avec alpha)
    async dessiner(ctx, s) {
      const W = s.largeur, H = s.hauteur;
      const PX = 4; // un seul pixel d'astre pour toute la scène : 4 px d'écran

      // 1. Fond étoilé du jeu (pixels fins de 2 px), sans étoiles derrière les grands astres.
      const pos = { brasier: [205, 410], tempete: [600, 440], neb: [1000, 405] };
      Kit.etoiles(ctx, { pixel: 2, graine: 42, eviter: [{ x: pos.tempete[0], y: pos.tempete[1], r: 150 }] });

      // 2. Trois astres de trois familles : Bételgeuse (Brasier, légendaire), Tempest (Tempête)
      //    DORÉ au centre, le Grand Attracteur (Nébuleuses, légendaire) à droite. Le halo
      //    prismatique des légendaires est retiré ici (legendaire: false) pour un rendu plus calme.
      const brasier = Kit.astre('betelgeuse', { taille: 300, pixel: PX, legendaire: false, phase: 0.3 });
      const tempete = Kit.astre('tempest', { taille: 360, pixel: PX, dore: true, phase: 0.1 });
      const neb = Kit.astre('attracteur', { taille: 300, pixel: PX, legendaire: false, phase: 0.6 });
      // (L'astre doré a déjà le halo d'or du jeu : pas de Kit.halo en plus, il ferait doublon.)
      Kit.poser(ctx, brasier, pos.brasier[0], pos.brasier[1]);
      Kit.poser(ctx, neb, pos.neb[0], pos.neb[1]);
      Kit.poser(ctx, tempete, pos.tempete[0], pos.tempete[1]);

      // 3. Une comète tramée qui traverse le ciel, en haut à gauche.
      Kit.trainee(ctx, 60, 60, 250, 120, { pixel: 3, queue: Kit.couleurFamille('comete'), epaisseur: 2 });

      // 4. Assombrir le haut sous le titre (dégradé tramé, jamais lisse).
      Kit.tramage(ctx, 0, 0, W, 90, { couleur: '#000000', sens: 'haut', de: 0, a: 0.8, pixel: 3 });

      // 5. Logo (police pixel du jeu) et textes (outils/textes.js, jamais en dur).
      Kit.poser(ctx, Kit.logo({ pixel: 10 }), W / 2, 74);
      Kit.ecrire(ctx, Kit.texte('accroche', s.lang), W / 2, 156, { taille: 27, poids: 500, align: 'centre', couleur: C.blanc, largeurMax: 900 });
      Kit.ecrire(ctx, Kit.texte('genre', s.lang), W / 2, 194, { taille: 15, poids: 600, align: 'centre', espacement: 0.28, couleur: C.or });
      Kit.ecrire(ctx, Kit.texte('chiffres', s.lang), W / 2, H - 28, { taille: 14, poids: 500, align: 'centre', espacement: 0.24, couleur: C.gris });
    }
  });

  // ─── Un GIF animé : l'astre tourne sur une boucle parfaite ────────
  Kit.scene({
    nom: 'exemple-gif-maelstrom-320',
    titre: 'Exemple : GIF animé (Maelström qui tourne)',
    usage: 'Démonstration de l’export GIF (30 images, boucle parfaite).',
    largeur: 320, hauteur: 320, langues: [], fond: '#000000',  // GIF : fond opaque obligatoire
    gif: { images: 30, delai: 8 },                               // delai en centièmes de seconde
    dessiner(ctx, s) {
      // s.t va de 0 à 1 (exclu) : on le donne comme phase, la boucle du jeu est parfaite.
      // Taille FIXE (Kit.astre + taille) : Kit.astreCadre recalculerait l'échelle à chaque image.
      Kit.etoiles(ctx, { pixel: 2, graine: 3, phase: s.t });
      Kit.poser(ctx, Kit.astre('maelstrom', { taille: 250, pixel: 3, phase: s.t, decalage: false }), 160, 160);
    }
  });
})();
