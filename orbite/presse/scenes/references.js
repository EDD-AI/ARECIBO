/* ORBITE — kit visuel, groupe « references » (agent fondations).
 * Références de style pour Midjourney : un astre du jeu par image, 1024 × 1024, noir pur, sans
 * texte, pixels nets (6 px d'écran par pixel d'astre, sauf mention). Exports : presse/png/references/.
 */
(function () {
  'use strict';
  const COTE = 1024, CADRE = 860;
  // [nom, astre, options de Kit.astre, titre]
  const REFS = [
    ['ref-01-planete-horizon', 'horizon', { stade: 'vie', canaux: { moon: 0 } }, 'La planète d’horizon du menu (le monde du joueur, stade Vie)'],
    ['ref-02-trou-noir-umbra', 'umbra', {}, 'Trou noir « Umbra » (Néant) : anneau de photons et disque d’accrétion'],
    ['ref-03-oeil-du-vide', 'oeilvide', { complet: true, legendaire: false }, 'Œil du Vide (légendaire du Néant), trou noir au disque turquoise'],
    ['ref-04-piliers-de-la-creation', 'piliers', { legendaire: false }, 'Piliers de la Création (légendaire des Nébuleuses)'],
    ['ref-05-grand-attracteur', 'attracteur', { legendaire: false }, 'Grand Attracteur (légendaire des Nébuleuses)'],
    ['ref-06-betelgeuse', 'betelgeuse', { legendaire: false }, 'Bételgeuse (légendaire du Brasier), étoile rouge et sa coquille'],
    ['ref-07-maelstrom-legendaire', 'maelstrom', { legendaire: true }, 'Maelström (légendaire de la Tempête) avec son halo de légendaire, comme en jeu'],
    ['ref-08-primordia', 'primordia', { legendaire: false }, 'Primordia (légendaire de la Vie), océan, anneau et deux lunes'],
    ['ref-09-cerveau-matriochka', 'matriochka', { legendaire: false }, 'Cerveau Matriochka (légendaire des Machines), station sphérique'],
    ['ref-10-tempest-dore', 'tempest', { dore: true }, 'Tempest (Tempête, niveau 6) en version dorée, halo d’or'],
    ['ref-11-nebuleuse-du-crabe', 'crabe', {}, 'Nébuleuse du Crabe (Nébuleuses, niveau 4)'],
    ['ref-12-singularite-nue', 'singnue', { legendaire: true }, 'Singularité nue (légendaire des Anomalies) avec son halo de légendaire']
  ];
  for (const [nom, id, opts, titre] of REFS) {
    Kit.scene({
      nom, titre, usage: 'Référence de style (Midjourney) : noir pur, sans texte, pixels nets.',
      largeur: COTE, hauteur: COTE, langues: [], fond: '#000000',
      dessiner(ctx) {
        const a = Kit.astreCadre(id, Object.assign({ pixel: 6, largeur: CADRE, hauteur: CADRE, phase: 0.15 }, opts));
        // Centre du dessin (pas du corps) au milieu : les anneaux et lunes restent dans l'image.
        const x = Math.round((COTE - a.width) / 2), y = Math.round((COTE - a.height) / 2);
        ctx.drawImage(a, x, y);
      }
    });
  }
})();
