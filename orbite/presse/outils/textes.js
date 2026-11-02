/* ORBITE — kit visuel : TOUS les textes des visuels, en français et en anglais.
 *
 * Seule source des chaînes : les scènes les lisent avec Kit.texte(cle, lang) ou Kit.liste(cle, lang)
 * et ne les recopient jamais en dur. Les chiffres viennent de js/rules.js quand il est chargé
 * (window.OrbiteRules) : 140 astres, 13 familles, 15 légendaires, 16 lois… Ils restent justes si
 * le jeu change. Sans rules.js, les valeurs de secours ci-dessous (vérifiées le 2 novembre 2026).
 *
 * Typographie française : espace insécable (U+00A0) avant « : » et à l'intérieur des guillemets,
 * espace fine insécable (U+202F) avant « ; ! ? », apostrophe ’. Dans les listes, « · » est
 * précédé d'une insécable (jamais de ligne qui commence par un point médian).
 * Interdits (brief) : aucun autre jeu ni marque, aucun numéro de version, aucune adresse web,
 * aucune note ni récompense inventée.
 */
(function (root) {
  'use strict';

  const NB = ' ';      // espace insécable
  const FINE = ' ';    // espace fine insécable
  const SEP = NB + '· ';    // séparateur de liste : « A · B » sans · en début de ligne

  // ─── Faits calculés depuis js/rules.js ────────────────────────
  const R = root.OrbiteRules;
  const faits = (function () {
    const f = { astres: 140, familles: 13, legendaires: 15, lois: 16, evenements: 11, reliques: 12, joueursMelee: 8 };
    if (!R) return f;
    const vraies = R.CARDS.filter((c) => !c.token);
    f.astres = vraies.length;
    f.familles = R.FAMILY_KEYS.length;
    f.legendaires = vraies.filter((c) => c.legend).length;
    f.lois = R.LAWS.length;
    if (R.EVENTS) f.evenements = R.EVENTS.length;
    if (R.RELICS) f.reliques = R.RELICS.length;
    return f;
  })();

  // ─── Textes ───────────────────────────────────────────────────
  // Une entrée = { fr, en } (chaîne) ou { fr: [..], en: [..] } (liste, lue avec Kit.liste ; Kit.texte
  // la joint avec « · »).
  const T = {
    // Identité
    titre: { fr: 'ORBITE', en: 'ORBITE' },
    studio: { fr: 'STUDIO EDDA', en: 'STUDIO EDDA' },
    statut: { fr: 'PRÉ-ALPHA', en: 'PRE-ALPHA' },

    // Accroche principale (phrase : casse normale)
    accroche: {
      fr: 'Composez le système solaire le plus puissant de l’univers.',
      en: 'Build the mightiest solar system in the universe.'
    },
    // Genre (titres : MAJUSCULES)
    genre: { fr: 'AUTO-BATTLER COSMIQUE EN PIXEL ART', en: 'COSMIC PIXEL-ART AUTO-BATTLER' },
    // Appel à jouer
    appel: { fr: 'JOUER GRATUITEMENT', en: 'PLAY FREE' },
    // Plateformes
    plateformes: { fr: ['NAVIGATEUR', 'MOBILE', 'PC'], en: ['BROWSER', 'MOBILE', 'PC'] },
    // Modes
    modes: {
      fr: ['DUEL 1' + NB + 'CONTRE' + NB + '1', 'MÊLÉE À' + NB + '8', 'EN LIGNE ENTRE AMIS', 'CLASSÉ'],
      en: ['1V1 DUELS', '8-PLAYER MELEE', 'PLAY WITH FRIENDS', 'RANKED']
    },
    // Chiffres (calculés depuis rules.js)
    chiffres: {
      fr: [faits.astres + NB + 'ASTRES', faits.familles + NB + 'FAMILLES', faits.legendaires + NB + 'LÉGENDAIRES'],
      en: [faits.astres + NB + 'ORBS', faits.familles + NB + 'FAMILIES', faits.legendaires + NB + 'LEGENDARIES']
    },
    // Verbes
    verbes: { fr: ['ACHETEZ', 'PLACEZ', 'AFFRONTEZ'], en: ['BUY', 'PLACE', 'CLASH'] },

    // Compléments sûrs (faits du brief), pour les visuels qui en ont besoin
    gratuit: { fr: 'GRATUIT', en: 'FREE' },
    sansTelechargement: { fr: 'Jouable tout de suite dans le navigateur, sans téléchargement.', en: 'Play right away in your browser, no download.' },
    navigateurSansTelechargement: { fr: 'DANS LE NAVIGATEUR' + SEP + 'SANS TÉLÉCHARGEMENT', en: 'IN YOUR BROWSER' + SEP + 'NO DOWNLOAD' },
    legendaire: { fr: 'LÉGENDAIRE', en: 'LEGENDARY' },
    legendaires: { fr: 'LÉGENDAIRES', en: 'LEGENDARIES' },
    dore: { fr: 'DORÉ', en: 'GOLDEN' },
    famille: { fr: 'FAMILLE', en: 'FAMILY' },
    familles: { fr: 'FAMILLES', en: 'FAMILIES' },
    astres: { fr: 'ASTRES', en: 'ORBS' },
    lois: { fr: faits.lois + NB + 'LOIS', en: faits.lois + NB + 'LAWS' },
    // « Le dernier debout gagne. »
    dernierDebout: { fr: 'Le dernier debout gagne.', en: 'Last one standing wins.' },
    // Phrase d'explication courte (brief : « Le jeu »)
    pitch: {
      fr: 'Achetez des astres, placez-les sur deux rangées, formez des familles, choisissez une loi'
        + ' et affrontez les systèmes rivaux, manche après manche.',
      en: 'Buy orbs, place them on two rows, build families, pick a law'
        + ' and clash with rival systems, round after round.'
    },
    rangs: {
      fr: ['POUSSIÈRE', 'ASTÉROÏDE', 'LUNE', 'PLANÈTE', 'GÉANTE', 'ÉTOILE', 'NÉBULEUSE', 'PULSAR', 'SINGULARITÉ'],
      en: ['DUST', 'ASTEROID', 'MOON', 'PLANET', 'GIANT', 'STAR', 'NEBULA', 'PULSAR', 'SINGULARITY']
    },
    defiDuJour: { fr: 'DÉFI DU JOUR', en: 'DAILY CHALLENGE' },
    missions: { fr: 'MISSIONS', en: 'MISSIONS' },
    trouverPartie: { fr: 'TROUVER UNE PARTIE', en: 'FIND A GAME' }
  };

  // Noms des familles (FR : R.FAMILIES ; EN : traductions du jeu, js/lang/regles.js et duel.js).
  const FAMILLES_EN = {
    vie: 'Life', neant: 'Void', envers: 'Reverse', brasier: 'Blaze', glace: 'Ice', tempete: 'Storm',
    mineral: 'Mineral', machine: 'Machine', lune: 'Moons', comete: 'Comets', cristal: 'Crystal',
    anomalie: 'Anomalies', nebuleuse: 'Nebulae', neutre: 'Neutral'
  };

  root.KitTextes = { T, faits, FAMILLES_EN, NB, FINE, SEP };
})(typeof window !== 'undefined' ? window : globalThis);
