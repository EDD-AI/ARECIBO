/* ORBITE — kit visuel, groupe « ia » : fonds générés par IA (Higgsfield, Nano Banana 2.1, avec de
 * vrais rendus du jeu comme références de style), remis sur une grille de pixels (presse/ia/fonds.py),
 * puis le VRAI logo ORBITE et les textes du kit posés par-dessus (une IA écrit mal les lettres).
 * Exporter : node presse/outils/exporter.cjs --port <p> --groupe ia
 */
(function () {
  'use strict';
  const C = Kit.COULEURS;

  // Le fond préparé à la taille exacte de la scène (presse/ia/fonds/<nom>.png), sans lissage.
  function fondImage(ctx, nom) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { ctx.imageSmoothingEnabled = false; ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height); res(); };
      img.onerror = () => rej(new Error('fond introuvable : ' + nom));
      img.src = '../ia/fonds/' + nom + '.png?v=' + Date.now();
    });
  }
  // Une ombre portée nette sous le texte, pour qu'il se lise sur un fond chargé.
  const OMBRE = { couleur: '#000000', dx: 0, dy: 3 };

  // ─── En-tête X / Twitter 1500 × 500 : deux camps d'astres, le titre au milieu ───
  Kit.scene({
    nom: 'ia-x-entete-1500x500', titre: 'En-tête X (fond IA : deux camps)', usage: 'Bannière de profil X / Twitter.',
    largeur: 1500, hauteur: 500, langues: ['fr', 'en'], fond: '#000000',
    async dessiner(ctx, s) {
      const W = s.largeur;
      await fondImage(ctx, 'x-entete-1500x500');
      // Bande centrale : l'essentiel entre y 60 et 440 (mobile), rien sous l'avatar (bas gauche).
      Kit.poser(ctx, Kit.logo({ pixel: 12 }), W / 2, 205);
      Kit.ecrire(ctx, Kit.texte('genre', s.lang), W / 2, 296, { taille: 17, poids: 600, align: 'centre', espacement: 0.3, couleur: C.or, ombre: OMBRE });
      Kit.ecrire(ctx, Kit.texte('accroche', s.lang), W / 2, 336, { taille: 22, poids: 500, align: 'centre', couleur: C.blanc, largeurMax: 620, ombre: OMBRE });
    }
  });

  // ─── Bannière de page itch.io 960 × 300 ───
  Kit.scene({
    nom: 'ia-itch-banniere-960x300', titre: 'Bannière itch.io (fond IA : deux camps)', usage: 'En-tête de la page itch.io.',
    largeur: 960, hauteur: 300, langues: ['fr', 'en'], fond: '#000000',
    async dessiner(ctx, s) {
      const W = s.largeur;
      await fondImage(ctx, 'itch-banniere-960x300');
      Kit.poser(ctx, Kit.logo({ pixel: 9 }), W / 2, 126);
      Kit.ecrire(ctx, Kit.texte('genre', s.lang), W / 2, 196, { taille: 13, poids: 600, align: 'centre', espacement: 0.3, couleur: C.or, ombre: OMBRE });
    }
  });

  // ─── Story / Reels / TikTok 1080 × 1920 : piliers de la Création et planète d'horizon ───
  Kit.scene({
    nom: 'ia-story-1080x1920', titre: 'Story 9:16 (fond IA : piliers et horizon)', usage: 'Stories, Reels, TikTok.',
    largeur: 1080, hauteur: 1920, langues: ['fr', 'en'], fond: '#000000',
    async dessiner(ctx, s) {
      const W = s.largeur;
      await fondImage(ctx, 'story-1080x1920');
      // Tout le texte dans le noir du haut (zone sûre : sous les 250 px du haut) ; le fond a été
      // descendu pour lui faire de la place (presse/ia/fonds.py, descendre).
      Kit.poser(ctx, Kit.logo({ pixel: 18 }), W / 2, 330);
      Kit.ecrire(ctx, Kit.texte('accroche', s.lang), W / 2, 446, { taille: 36, poids: 500, align: 'centre', couleur: C.blanc, largeurMax: 820, ombre: OMBRE });
      Kit.ecrire(ctx, Kit.texte('appel', s.lang), W / 2, 588, { taille: 34, poids: 600, align: 'centre', espacement: 0.24, couleur: C.or, ombre: OMBRE });
      Kit.ecrire(ctx, Kit.liste('plateformes', s.lang).join(' · '), W / 2, 634, { taille: 20, poids: 500, align: 'centre', espacement: 0.3, couleur: C.gris, ombre: OMBRE });
    }
  });

  // ─── Fond d'écran de téléphone 1170 × 2532, sans texte ───
  Kit.scene({
    nom: 'ia-fond-ecran-telephone-1170x2532', titre: 'Fond d’écran téléphone (IA, sans texte)', usage: 'Fond d’écran à offrir aux joueurs.',
    largeur: 1170, hauteur: 2532, langues: [], fond: '#000000',
    async dessiner(ctx) { await fondImage(ctx, 'fond-ecran-telephone-1170x2532'); }
  });

  // ─── Instagram carré 1080 × 1080 : le logo au cœur du trou noir ───
  Kit.scene({
    nom: 'ia-instagram-carre-1080x1080', titre: 'Instagram carré (fond IA : trou noir)', usage: 'Publication carrée (Instagram, Facebook).',
    largeur: 1080, hauteur: 1080, langues: ['fr', 'en'], fond: '#000000',
    async dessiner(ctx, s) {
      await fondImage(ctx, 'instagram-carre-1080x1080');
      // Le centre de l'anneau du trou noir dans l'image (mesuré sur la source 2000 × 2000).
      const cx = 1080 * 0.49, cy = 1080 * 0.505;
      Kit.poser(ctx, Kit.logo({ pixel: 9 }), cx, cy - 18);
      Kit.ecrire(ctx, Kit.texte('genre', s.lang), cx, cy + 48, { taille: 12, poids: 600, align: 'centre', espacement: 0.2, couleur: C.or, largeurMax: 420 });
    }
  });

  // ─── Miniature YouTube 1280 × 720 : la bataille d'astres ───
  Kit.scene({
    nom: 'ia-youtube-miniature-1280x720', titre: 'Miniature YouTube (fond IA : bataille)', usage: 'Miniature de vidéo (coin bas-droit libre).',
    largeur: 1280, hauteur: 720, langues: ['fr', 'en'], fond: '#000000',
    async dessiner(ctx, s) {
      const W = s.largeur;
      await fondImage(ctx, 'youtube-miniature-1280x720');
      Kit.tramage(ctx, 0, 0, W, 250, { couleur: '#000000', sens: 'haut', de: 0, a: 0.9, pixel: 4 });
      Kit.poser(ctx, Kit.logo({ pixel: 14 }), W / 2, 92);
      Kit.ecrire(ctx, Kit.texte('genre', s.lang), W / 2, 178, { taille: 24, poids: 600, align: 'centre', espacement: 0.24, couleur: C.or, ombre: OMBRE });
    }
  });

  // ─── Publication X / Facebook / Bluesky 1600 × 900 ───
  Kit.scene({
    nom: 'ia-x-publication-1600x900', titre: 'Publication 16:9 (fond IA : bataille)', usage: 'Publication X, Facebook, Bluesky, Mastodon.',
    largeur: 1600, hauteur: 900, langues: ['fr', 'en'], fond: '#000000',
    async dessiner(ctx, s) {
      const W = s.largeur;
      await fondImage(ctx, 'x-publication-1600x900');
      Kit.tramage(ctx, 0, 0, W, 300, { couleur: '#000000', sens: 'haut', de: 0, a: 0.9, pixel: 4 });
      Kit.poser(ctx, Kit.logo({ pixel: 16 }), W / 2, 110);
      Kit.ecrire(ctx, Kit.texte('accroche', s.lang), W / 2, 214, { taille: 30, poids: 500, align: 'centre', couleur: C.blanc, largeurMax: 1100, ombre: OMBRE });
    }
  });
})();
