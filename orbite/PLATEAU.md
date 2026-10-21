# ORBITE — le plateau commun

Le jeu se lance depuis **Jouer → Plateau commun**, directement avec `plateau.html`, ou avec le fichier autonome `ORBITE.html`. **Jouer contre l’IA** démarre un duel immédiatement ; les réglages permettent de personnaliser la partie. Le guide de premier test se trouve dans [`JOUER.md`](JOUER.md). Il est conçu d'abord pour le duel, avec les mêmes règles pour deux à six participants. On peut affronter les IA ou se passer l'appareil entre amis. Le jeu à distance de ce nouveau plateau n'est pas encore raccordé aux salons Firebase du mode classique.

Les chiffres ci-dessous sont des paramètres de prototype, pas un équilibrage certifié. Le moteur historique et ses sauvegardes sont conservés ; la campagne est retirée du menu principal pendant ce travail.

## Une manche

1. Acheter, vendre, fusionner et déployer ses astres près de son étoile.
2. Donner à chaque astre un ordre : déplacer, attaquer ou défendre. On peut changer ses ordres avant de les verrouiller.
3. Verrouiller son plan. Les plans des adversaires restent privés jusqu'à la résolution.
4. Résoudre ensemble les mouvements, puis les attaques. Les positions et les blessures persistent.
5. Faire tourner les orbites, compter les relais occupés, puis recevoir l'énergie de la prochaine manche.

En jeu local entre amis, un écran de passage masque les boutiques et les ordres avant de confier l'appareil au joueur suivant. Les positions sur le plateau sont publiques. L'IA prépare ses ordres à partir des informations auxquelles elle a droit.

## Le terrain et les objectifs

Le terrain comporte trois anneaux et six secteurs par participant. Chaque étoile possède une zone de déploiement sur l'anneau extérieur. Les astres peuvent changer d'anneau et se déplacer autour de celui-ci, dans la limite de leur mobilité et des cases occupées.

- L'orbite intérieure avance d'un secteur à chaque manche.
- L'orbite médiane avance d'un secteur les manches paires.
- L'orbite extérieure reste stable.

Les relais se trouvent sur l'orbite intérieure. Chaque relais occupé après la rotation donne un point d'influence. Le joueur doit donc prévoir où son astre terminera la manche, pas seulement sa case avant la rotation.

Une étoile commence avec 18 points de résistance. Détruire les étoiles adverses ou atteindre 10 points d'influence permet de gagner. Une victoire simultanée peut donner une partie nulle. La quarantième manche termine obligatoirement la partie ; à défaut de vainqueur selon les objectifs, elle est nulle. Le moteur ne désigne pas artificiellement un vainqueur selon les PV restants.

## Achats et composition

| Élément | Réglage initial |
|---|---|
| Familles | 5 parmi les 12 existantes, selon la graine |
| Énergie | 4 au départ, puis +1 par manche, maximum 10 ; remise à chaque manche |
| Sentinelle | 2 attaque, 8 PV, 1 armure, mobilité 1, portée 1 ; prix 3 |
| Frappeur | 3 attaque, 6 PV, mobilité 1, portée 1 ; prix 3 |
| Artilleur | 3 attaque, 4 PV, mobilité 1, portée 2 ; prix 4, niveau 2 |
| Passage au niveau 2 | 5 énergies ; ouvre les artilleurs et une quatrième offre |
| Actualisation | 1 énergie |
| Gel de la boutique | Gratuit |
| Armée / réserve personnelle | 7 astres déployés / 8 en réserve |
| Fusion | 3 exemplaires ordinaires identiques deviennent un doré |

Les boutiques et les armées consomment une réserve réellement partagée. Vendre, perdre un astre ou éliminer un joueur rend ses copies à cette réserve. Un astre doré représente trois copies et gagne 2 d'attaque et 3 PV maximum. La fusion peut libérer des cases et annule les ordres des astres consommés.

Le catalogue du prototype croise trois rôles et douze familles ; il ne prétend pas adapter automatiquement toutes les capacités des cartes du moteur classique. Chaque famille possède une propriété lisible : armure, mobilité, attaque, soutien, alignement, soin ou passage entre relais. Les bonus conditionnels sont bornés afin d'éviter une croissance sans limite.

## Les choix de combat

Défendre augmente l'armure de l'astre pour la manche. Les attaques ont une portée et une ligne de vue ; un astre sur le trajet peut bloquer un tir. Une cible qui quitte la portée pendant les mouvements ne peut pas être touchée arbitrairement.

Deux astres visant la même case vide empêchent tous deux leur déplacement : l'ordre des joueurs ne départage pas cette collision. Les dégâts sont calculés avant d'être appliqués, afin qu'un astre détruit pendant l'échange puisse tout de même porter l'attaque qu'il avait préparée.

La rotation, les lignes de tir, les soutiens et le contrôle des relais doivent permettre des sacrifices et des réponses tactiques. Le prototype doit encore être éprouvé face à des joueurs humains pour vérifier cette profondeur.

## Développement

- `js/plateau.js` : règles pures, commandes validées, résolution et sauvegardes.
- `js/plateau-bot.js` : préparation des achats et des ordres des IA.
- `js/plateau-ui.js`, `css/plateau.css`, `plateau.html` : interface du prototype.
- `js/lang/plateau.js` et `js/lang/plateau-menu.js` : traductions dans les cinq langues.
- `tests/plateau*.test.mjs` : tests des règles et des IA.
- `tools/plateau-sim.js` : simulations du nouveau plateau, séparées de celles du moteur classique.
- `tools/export-plateau.js` : export HTML autonome avec tous les scripts, styles, polices et icône intégrés.

La sauvegarde utilise la clé locale `orbite.plateau.v1`, distincte de la progression historique. Une sauvegarde incompatible doit être signalée avant tout remplacement volontaire. La simulation est déterministe pour une même graine et les mêmes commandes ; le hasard intervient dans la sélection des familles et les offres, pas dans la résolution des attaques.

## Mesures initiales

Le compteur `node orbite/tools/plateau-combinaisons.js --players 2 --units 7 --json` donne 6 435 choix de sept types distincts parmi les quinze types actifs. Si l’on place ensuite ces sept astres sur les 36 cases d’un plateau autrement vide, on obtient 270 735 296 832 000 arrangements nominaux. Ce sous-modèle ignore l’économie, l’accessibilité, les ennemis, les doublons et les symétries ; il ne constitue pas une estimation du nombre de stratégies ni une comparaison avec les échecs.

Avant les améliorations des IA de la version 67, le premier pilote de 300 parties à deux, trois, cinq et six joueurs termine sans violation d’invariant, avec 17 nulles. Toutes les fins sont liées aux relais. Le bot agressif ignore cet objectif et perd ses 281 apparitions ; seules huit parties comportent des dégâts d’étoile. C’est un signal à examiner sur les objectifs et les décisions des bots, sans attribuer automatiquement ce résultat à la puissance intrinsèque des familles. La méthode et les commandes de reproduction figurent dans [`tools/README.md`](tools/README.md).

## Premier test jouable — version 67

Le démarrage rapide lance immédiatement un duel contre l’IA. Le guide contextuel peut être masqué ; il accompagne sélection, premier ordre, achat, déploiement et verrouillage sans imposer ces choix. L’aperçu pointillé indique la position prévue après rotation.

La résolution révèle les ordres, puis montre mouvements, attaques, dérive et score. Le bouton **Passer la résolution** termine l’animation sans modifier son résultat. Le moteur sauvegarde la manche calculée avant l’animation : recharger à ce moment ne rejoue pas les dégâts. Le réglage système de réduction des mouvements supprime l’animation.

Les IA prévoient désormais quelques manches de déplacement, acceptent les détours et arbitrent entre dégâts utiles, défense et relais. Un nouveau pilote exploratoire de 60 parties (30 duels, 10 à trois, 10 à cinq et 10 à six) se termine sans violation d’invariant : 58 victoires et deux nulles au score. Les offensifs marquent dans 64 de leurs 67 apparitions, mais seules deux parties comportent des dégâts d’étoile. Le contrôle reste donc dominant dans cet échantillon ; les graines diffèrent du pilote initial et ne permettent pas une comparaison appariée.
