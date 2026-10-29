# ORBITE

Jeu de stratégie de planètes, pensé pour le téléphone. Le cœur du jeu est le **duel** : un contre un,
cycle après cycle. On choisit une **loi** (elle donne un premier astre), on achète des planètes dans la
**Création** (là où naissent les astres), puis on les **place sur deux rangées** : l’avant attaque et
encaisse, l’arrière reste à l’abri et avance quand l’avant tombe. Chaque astre de l’avant frappe
l’ennemi **en face** de lui, sans hasard : le placement décide. Deux astres d’une même famille dans la
même rangée forment une **formation**. Le système combat ensuite seul ; le premier à 0 PV perd.

La **mêlée à 8** (contre 7 univers rivaux) suit les mêmes règles ; hors ligne, elle est dans
**Jouer → Solo**, et en ligne dans **Jouer → Multijoueur**, avec les duels en ligne. Chaque partie a
son **événement cosmique**, on choisit des **reliques** aux cycles 4 et 8, et les **lois s’éveillent**
au cycle 6 (v84). La campagne (la Genèse) est masquée au menu ; son code et sa progression sont
conservés.

> **Vers le Play Store** : les règles à respecter dans chaque version et la checklist de lancement
> sont dans [`LANCEMENT.md`](LANCEMENT.md).

- `index.html` : le jeu (portrait, tactile, installable comme une application).
- `atelier.html` : le générateur de planètes (bouton GÉNÉRER, export PNG et GIF en boucle).
- `batisseur.html` : le générateur de bâtiments de colonie (dômes, serres, forages, fusées…), export PNG.

## Ouverture du jeu

1. Écran noir, **STUDIO EDDA** s’allume pixel par pixel.
2. Titre **ORBITE** sous une **éclipse** : une lune sombre glisse devant une étoile blanche jusqu’à
   ne laisser que la couronne, qui s’épanouit et scintille. « Touchez pour commencer » : la lune
   s’écarte d’un cheveu (anneau de diamant), un éclat jaillit, le titre éclate en pixels.
3. **Première fois seulement, le réveil** (v73, `js/eveil.js`) : sur fond noir, une **entité
   numérique** se compose de minuscules caractères (silhouette éclairée, cœur et yeux lumineux,
   pluie de données, jambes qui se défont en caractères), entourée de blocs de données qui
   clignotent (hexadécimal, binaire, `ORBITE.SYS`, `ARECIBO//1974`…). Elle dit « Réveillez-vous.
   Bonjour, créateur. » : à chaque lettre, sa bouche s’anime, des lignes de son corps glissent et
   un bloc surgit. Puis elle s’effondre en tourbillon vers son cœur, un éclair blanc, et c’est le
   **big bang numérique** : rayons de caractères, onde de choc. Les caractères retombent en une
   **planète ASCII** ombrée qui tourne (continents, océans, nuages), entourée d’étoiles éparses :
   « Vous venez de créer un monde. » Toucher l’écran passe la scène. Rendu sur un canvas 2D, grille
   de caractères copiés depuis un atlas, environ 30 images par seconde. « Revoir l’introduction »
   (Tutoriels) la rejoue.
4. **Menu** : **votre planète** se lève sur l’horizon et tourne très lentement, des poussières
   montent du sol, des étoiles filantes passent. La première fois, « Voilà votre terrain de jeu. »
   s’écrit au centre.
5. Menu (v84), rangé en pages, chacune avec son bouton **Retour** :
   - page principale : **Jouer**, **Codex**, **Création**, **Marché stellaire**, **Paramètres**, et en
     haut à droite le **profil** (pseudo, niveau, avatar = votre planète) ;
   - **Jouer** → **Solo** (contre l’IA) ou **Multijoueur** (en ligne, entre amis : duels et mêlée à 8) ;
   - **Solo** → **Duel** (1 contre 1), **Mêlée** (contre 7 univers) et **Défi du jour**. Duel et mêlée
     reprennent la partie solo en cours, quel que soit son mode.

   L’écran du menu ne défile jamais (la planète déborde en bas) : le focus suit la page sans le faire
   glisser.

Les **Paramètres** restent courts : son, musique, **Tutoriels et aide**, installation et crédits.
La progression (niveau, poussières, planète, historique) ne peut pas être effacée depuis le jeu. **Tutoriels et aide** regroupe en un seul bouton :
- Comment jouer ;
- le guide du menu ;
- le tutoriel de partie ;
- les tutoriels de campagne ;
- l’introduction.

La vitesse des combats n’est pas réglable : tout le monde voit les combats au même rythme. Le
bouton « Passer » reste disponible pendant un combat.

## Campagne : la Genèse (masquée au menu)

Bouton **CAMPAGNE · LA GENÈSE**. Comme dans Spore, on commence minuscule et on grandit d’étape en
étape. Chaque ère a son propre gameplay, et ce qu’on fait dans l’une change la suivante. Ici, on
ne passe pas d’une cellule à une créature : on passe d’une poussière à un astre, puis à un
système solaire vivant.

| Ère | Équivalent Spore | Gameplay | État |
|---|---|---|---|
| I · La Poussière | Cellule | Le grain dérive vu du dessus, absorbe plus petit que lui, fuit plus gros, se façonne | **jouable** |
| II · L’Astéroïde | Créature | 4 chapitres : l’Essaim, le Cœur, la Sculpture, le Grand Impact | **chapitres 1 à 3 jouables** |
| III · La Planète | Tribu | Modeler la surface : océans, volcans, atmosphère ; parer les bombardements | à venir |
| IV · Le Système | Civilisation | Allumer ou capturer un soleil, placer lunes et planètes en orbite | à venir |
| V · La Vie | Espace | Rendre le monde vivable (température, air, eau), faire naître la vie, puis la Colonie | à venir |

**Récit d’ouverture.**
- Les phrases du réveil (« Vous êtes un Créateur. Et un Créateur doit créer. ») restent, puis la
  poussière converge.
- Elle ne forme plus une planète, seulement **un petit grain de roche**.
- Titre : « ÈRE I · LA POUSSIÈRE ».

**Ère I, la Poussière** (`js/genese.js` pour les règles, `js/genese-ui.js` pour l’écran) :
- **Déplacement, tout au doigt.** Le grain suit le doigt tant qu’il reste posé sur l’écran ; un
  toucher bref l’envoie à cet endroit, où il s’arrête. Une petite mire montre où il va (au clavier :
  flèches ou ZQSD).
- **Absorber.**
  - Tout ce qui est plus petit que le grain s’absorbe : glace (bleue), roche (orange), gaz
    (violet, mou : il s’absorbe jusqu’à 1,4 fois sa taille).
  - Les astres plus gros sont cerclés de rouge et vous heurtent. Certains rocs sombres, les
    *chasseurs*, vous poursuivent, plus lentement que vous ne fuyez.
  - Des comètes traversent : on les absorbe si on est plus gros qu’elles, sinon elles font mal.
- **Paliers de masse.**
  - Grain → Gravier → Caillou → Rocher → Bloc → planétésimal (fin de l’ère).
  - **On se voit grossir.** La caméra reste fixe pendant un palier : le grain grossit à l’écran
    (jusqu’à deux fois sa taille). Au palier suivant, elle recule lentement : on redevient petit
    dans un monde plus vaste, et l’ancien danger devient de la nourriture.
  - Le grain s’arrondit en grossissant, comme les vrais astres.
- **Le fond se dévoile avec la croissance.** Au départ, c’est presque le noir, avec quelques
  étoiles. Ensuite :
  - les étoiles se multiplient et la nébuleuse s’allume ;
  - des plans flous en parallaxe apparaissent : la matière des tailles qu’on a dépassées dérive
    derrière, plus floue et plus lente à mesure qu’elle est loin ;
  - très loin surgissent, palier après palier, des amas d’étoiles, des galaxies, des planètes
    géantes et des étoiles.
- **Façonnage** (l’éditeur de Spore) :
  - Il s’ouvre à chaque palier, et à tout moment avec le bouton ✦.
  - On y dépense les **étincelles ✦** gagnées en absorbant. Un emplacement de plus par palier.
  - Retirer une pièce rend tout son prix.
  - 10 pièces en 5 familles. 4 sont connues dès le départ ; les 6 autres se découvrent en
    touchant des **fragments d’astres** dorés (une flèche les signale au bord de l’écran) :

  | Famille | Pièces |
  |---|---|
  | Mouvement | Jets de gaz, Éruption (bouton de poussée), Voile solaire |
  | Capture | Champ magnétique, Noyau dense |
  | Défense | Croûte épaisse, Bouclier de givre |
  | Attaque | Pointes de roche (briser plus gros pendant une Éruption), Décharge (bouton) |
  | Sens | Œil stellaire |
- **Régime → nature** (comme le régime alimentaire de Spore). Les régions de la nébuleuse sont
  teintées par leur matière dominante. Ce qu’on absorbe décide de la nature future, affichée en
  bas à gauche (« Vers… ») :

  | Ce qui domine (≥ 50 %) | Nature |
  |---|---|
  | Glace | Monde d’eau |
  | Roche | Monde de feu |
  | Gaz | Géante puis étoile |
  | Équilibre | **Monde vivant** |
- **Style → trait** (les cartes de conséquence de Spore), gardé pour l’ère suivante :

  | Style de jeu | Trait |
  |---|---|
  | 12 astres brisés ou plus | Prédateur |
  | 2 au plus | Paisible |
  | Entre les deux | Adaptable |
- **Mort.** Le grain se disperse puis se reforme, 15 % plus petit.
- **Fin de l’ère.**
  - Cinématique : le **planétésimal** apparaît, puis le trait est annoncé.
  - Ce n’est pas encore une planète, mais un gros rocher irrégulier dont la matière dépend du
    régime :

    | Régime | Planétésimal |
    |---|---|
    | Glace | bloc de glace bleu-blanc |
    | Roche | bloc de pierre sombre aux reflets rougeâtres |
    | Gaz | roc violacé nimbé de débris |
    | Équilibre | deux blocs soudés, mêlés de roche et de glace |
  - Les ambiances de couleur `p-glace`, `p-roche`, `p-gaz` et `p-mixte` sont dans
    `js/planet-engine.js`.
  - +3 graines de vie.
  - Le menu propose ensuite de rejouer l’ère I en attendant l’ère II.
- **Durée et sauvegarde.**
  - Une ère I dure environ 5 à 10 minutes (simulée par un joueur automatique dans
    `tests/genese.test.mjs`).
  - Sauvegarde dans `orbite.genese` : le grain est gardé, la nébuleuse se régénère autour.

**Ère II, chapitre 1 · L’Essaim** (`js/essaim.js` pour les règles, `js/essaim-ui.js` pour
l’écran) :
- **Accès** : quand l’ère I est terminée, le bouton Campagne propose l’ère II. Le planétésimal
  garde sa composition et son trait.
- **Orbites.** Le planétésimal tourne autour d’une jeune étoile, dans une ceinture de rochers qui
  suivent tous leur orbite.
  - Sans doigt, l’assistance d’orbite vous range sur une orbite circulaire ; doigt posé, on se
    propulse vers lui.
  - La lueur de l’étoile éclaire chaque astre du bon côté, et votre orbite est tracée en pointillé.
  - Bouton **Poussée** : un élan, toutes les 4 s.
- **Capturer** (voie paisible) : glisser à côté d’un rocher plus petit, sans le toucher et
  presque à la même vitesse. Un lien se tisse en 1,6 s (1 s pour un Paisible de l’ère I) et le
  rocher devient une **lune**.
  - Les lunes parent un choc chacune (puis 8 s de repos).
  - Elles balaient les petits rochers qu’elles touchent et grossissent, jusqu’à 70 % de votre
    masse.
  - Leur nombre maximal grandit avec vous (8 au plus).
- **Percuter** (voie prédatrice) : foncer dans un rocher plus petit l’absorbe d’un coup.
  - L’impact chauffe, selon la vitesse et la taille du rocher. Au-delà de 80, la croûte se
    fissure et vous perdez de la solidité.
  - À bout : vous perdez 15 % de masse et la moitié de vos lunes.
  - Les rochers plus gros (cerclés de rouge) blessent.
- **Rivales.** Vesta, Pallas et Hygie (des protoplanètes) grandissent aussi, jusqu’à 4, 9 et 18.
  - Plus grosses que vous, elles vous attirent (effet de fronde) et vous arrachent de la masse au
    contact.
  - Plus petites, on les absorbe, ou on les capture (si vous pesez 1,6 fois leur masse) : elles
    deviennent une grande lune.
- **Comètes** : elles traversent la ceinture et apportent de la glace, mais blessent, sauf si une
  lune les pare.
- **Fin du chapitre** : devenir le **système le plus massif de la ceinture** (vous et vos lunes),
  d’une masse d’au moins 26 et 1,25 fois la plus grosse rivale.
  - Trait du chapitre : Prédateur, Paisible ou Adaptable, selon la masse gagnée en percutant ou en
    capturant.
  - +3 graines de vie.
- **Durée** : 3 à 10 minutes selon le style (simulée par trois joueurs automatiques).
- Sauvegarde dans `orbite.genese.essaim`. Tests : `tests/essaim.test.mjs`.

**Ère II, chapitre 2 · Le Cœur** (`js/coeur.js` pour les règles, `js/coeur-ui.js` pour
l’écran) :
- **La coupe.** L’astre est vu en coupe, en gros pixels (64 × 64) : fer gris sombre, roche brune,
  glace bleue, gaz violet, quelques grains radioactifs verts. Au départ, tout est mélangé.
- **Chauffer.** Doigt posé, on chauffe à cet endroit, tant qu’il reste de l’énergie (environ
  70 s de doigt posé). La chaleur se répand, se perd par la surface, et rougeoit à l’écran.
  - Les grains radioactifs chauffent seuls, et les lunes de l’Essaim chauffent par les marées.
  - Les impacts de l’Essaim ont réchauffé le cœur au départ.
  - Un Adaptable a plus d’énergie.
- **Se ranger.** Là où la matière a fondu (glace 10, roche 32, fer 42), la plus dense coule
  vers le centre, par l’une de ses voisines plus profondes : le fer forme le noyau, la roche le
  manteau, la glace et le gaz remontent. La barre « Couches rangées » mesure le tri.
- **Ménager la surface** (surchauffe au-delà de 88, juste sous le bord) :
  - roche fondue dessous → éruption, la croûte se perce ;
  - glace → elle bout et devient du gaz : plus d’air, moins d’océans ;
  - gaz → il s’échappe dans l’espace.
- **Fin du chapitre** : à partir de 50 % de couches rangées, le bouton « Laisser refroidir »
  termine ; sinon le chapitre finit quand l’énergie est épuisée et l’astre refroidi.
  - Le bilan prépare la suite : champ magnétique (fort, faible ou aucun selon le fer au centre),
    croûte (solide ou volcanique), eau (océans, glace profonde ou sec), atmosphère (primitive
    ou aucune).
  - +3 graines de vie.
- **Durée** : 2 à 4 minutes. Sauvegarde dans `orbite.genese.coeur`. Tests : `tests/coeur.test.mjs`.

**Ère II, chapitre 3 · La Sculpture** (`js/sculpture.js` pour les règles, `js/sculpture-ui.js`
pour l’écran) :
- **L’astre en grand.** Il est dessiné en pixel art (112 × 112) et tourne lentement sur lui-même :
  - silhouette bosselée tant qu’il n’est pas rond ;
  - relief éclairé par la lumière ;
  - mers d’eau (si le Cœur a donné des océans) ou de lave (croûte volcanique) au fond des
    bassins ;
  - glace, volcans qui luisent, nuages et halo si le Cœur a donné une atmosphère.
- **La carte.** L’astre est une carte de hauteurs (longitude × latitude, 128 × 64) en deux
  couches : la **forme** (ses grosses bosses, sa silhouette) et le **relief** sculpté.
- **Outils** (un à la fois, au doigt) :

  | Outil | Effet |
  |---|---|
  | ✋ Tourner | fait tourner l’astre (glisser) |
  | ☄ Impact | creuse un cratère ; un impact = un bassin |
  | ⛰ Soulever | maintenu : élève des montagnes |
  | 〰 Lisser | maintenu : la gravité arrondit la forme |
  | 🜂 Volcan | un cône et sa lave |
  | ❄ Glace | maintenu : pose une calotte |

  - Le Volcan est libre avec une croûte volcanique ou un monde de feu, sinon limité à 2.
  - La Glace n’est disponible qu’avec de l’eau.
  - La gravité arrondit aussi l’astre toute seule, lentement.
- **Objectifs** :
  - arrondir l’astre (85 %), creuser deux bassins, dresser des montagnes (3 % de la surface) ;
  - plus un objectif selon le chemin : trois volcans (croûte volcanique ou monde de feu), des
    calottes de glace (3 %, si de l’eau), sinon un volcan.
- **Fin.** « C’est une planète » termine.
  - Bilan, puis cinématique (« quelque chose de très grand approche… ») et +3 graines de vie.
- Sauvegarde dans `orbite.genese.sculpture`. Tests : `tests/sculpture.test.mjs`.

### Ancienne campagne de cartes (désactivée)

Le code de la démo en *deck builder* (ci-dessous) reste dans `js/campagne.js` et
`js/campagne-ui.js`, mais n’est plus accessible depuis le menu.

Un mode solo raconté, en *deck builder* à la Slay the Spire, où l’on meurt et recommence.

**Histoire.** Vous vous réveillez dans le vide, en Créateur. La poussière converge et forme un
premier monde minuscule, que vous devez faire grandir jusqu’à vaincre **Kronos**, la géante qui
dévore ses lunes. Des phrases tapées sur fond noir posent le récit : réveil, arrivée devant
Kronos, victoire, défaite.

**Dialogues.** Des cinématiques font parler d’autres Créateurs. Le vôtre est toujours à gauche,
en silhouette noire à capuche éclairée en contre-jour : sans visage, sans couleur, nommé « ??? ».
Face à lui :
- **Vela, la Tisseuse d’étoiles** (liseré violet, couronne d’étoiles) : elle vous rencontre après
  votre première victoire, revient avant Kronos, et après la victoire elle annonce l’acte II ;
- **L’Ancien** (liseré ambre, bâton), un Créateur dévoré par Kronos : il apparaît dans un mystère
  et donne un conseil pour le combat.

Le récit d’ouverture, la rencontre avec Vela et le dialogue avant Kronos reviennent à **chaque nouvelle
campagne** (le bouton Passer les saute). Les silhouettes sont générées en pixel art (`figureSvg` dans
`js/campagne-ui.js`).

**Carte des chemins : un ciel en relief.** Les 9 étages sont posés dans un espace en perspective.
Chaque rangée s’éloigne vers l’horizon où attend Kronos. Chaque astre flotte à sa propre hauteur et
à sa propre distance : près de vous, ils sont grands et nets ; au loin, petits et voilés de brume.
Des galaxies, une géante à anneaux et des astres errants peuplent les côtés.
- **Glisser vers le haut** fait avancer le regard dans le ciel, avec de l’inertie. Les routes sont
  en pointillés, épaisses au premier plan et fines au loin. Celles qui partent de votre monde
  brillent et défilent.
- **Toucher un astre entouré** fait voyager votre monde le long de la route : une traînée d’étoiles
  le suit et la caméra l’accompagne, aussi sur les côtés. On choisit sa boucle : affronter, tenter
  un mystère, se reposer ou défier un astre puissant, jusqu’à Kronos.
- **Tutoriel de la carte** (première visite, `MAP_STEPS`) : les étapes, les routes, les types
  d’astres, puis glisser pour regarder et toucher un astre pour partir.
- Le code est dans `js/campagne-ui.js` (`worldLayout`, `project`, `placeMap`, `goNode`). Le fond
  est un ciel dédié (mode 7 de `FS_SKY`), qui défile lentement avec la caméra.

Les étapes :
- **Affrontement** : astres errants (poussière, cailloux, comète, lune morte, météore, planète naine) ;
- **Astre puissant** : Géante rouge, astéroïdes jumeaux ; ils donnent un **vestige** ;
- **Mystère** : événement raconté, avec un choix ;
- **Sanctuaire** : se reposer (+30 % PV) ou façonner (améliorer une carte) ;
- **Kronos** : appelle ses lunes, les dévore pour se soigner et se renforcer. Frappez les lunes
  d’abord.

**Combat.** Au tour par tour, avec 3 énergies, 5 cartes en main et l’**intention** de chaque ennemi
affichée au-dessus de lui.
- Toucher une carte la sélectionne. La toucher de nouveau la joue, ou bien on touche l’astre à viser.
- **Bouclier** : absorbe les dégâts jusqu’au tour suivant.
- **Masse** : dégâts en plus.
- **Fissure** : +50 % de dégâts subis.
- **Érosion** : −25 % de dégâts infligés.
- **Brûlure** : perte de PV chaque tour.
- Il y a 24 cartes (attaque, défense, création, pouvoir), toutes améliorables (« + »), et 6 vestiges.

**Votre monde change avec vos cartes** (`worldChannels`) : magma, eau, nuages, puis la vie. Il suit
le moteur de la planète du menu.

**Récompenses.** Une expédition rapporte de l’**expérience** au Créateur (étages, astres puissants,
victoire) et des **poussières d’étoiles**. La partie en cours est sauvegardée, et un tutoriel guide
le premier combat.

Les règles sont pures et testées (`js/campagne.js`, `tests/campagne.test.mjs`). L’IA d’équilibrage
(`node tools/campagne-sim.js 2000`) gagne environ 21 % de ses expéditions en jouant sans finesse ;
un joueur qui lit les intentions fait nettement mieux.

## Tutoriel

Pensé pour quelqu’un qui n’a jamais joué à un jeu de ce genre. Un « coach » assombrit l’écran,
éclaire ce qu’il faut toucher, montre le geste avec un doigt animé (toucher ou glisser) et explique
en une phrase. Il avance quand le joueur fait l’action demandée, ou sur « SUIVANT ».

- **Guide du menu** (première visite) : Jouer (le duel), Multijoueur (duels en ligne et mêlée à
  8), Création, Marché stellaire et poussières d’étoiles, Profil, Paramètres.
- **Campagne** : le premier combat est guidé, et la carte en relief a son propre guide
  (`MAP_STEPS`).
- **Premier duel guidé** :
  - le choix de la loi ;
  - les PV et l’énergie ;
  - lire une fiche puis acheter, et glisser l’astre de la main vers l’avant ou l’arrière ;
  - les deux rangées (l’avant attaque l’ennemi en face, l’arrière avance) et le combat ;
  - le calcul des dégâts, puis les formations ;
  - actualiser, geler, monter de niveau, vendre, le pouvoir, et le système du rival à contrer ;
  - enfin, les astres dorés et les poussières du duel gagné.
- « Passer le tutoriel » est proposé à chaque étape. Paramètres → **Tutoriels et aide** les
  relance : guide du menu, tutoriel de partie (la prochaine partie est alors guidée) et tutoriels
  de campagne (premier combat et carte).

Le coach se trouve dans `js/game.js` (`coachStart`, étapes `MENU_STEPS`, `LAW_STEPS`,
`GAME_STEPS`). Le jeu lui signale ses actions par `tuto('fiche' | 'achat' | 'placer' | 'combat' | 'cycle'…)`.

## Effets de fin de cycle

**Bonus pendant la création.** Chaque bonus de statistiques (Naissance, fin de cycle, pouvoir…)
se voit et s’entend, astre par astre :
- les chiffres repartent de leur valeur d’avant l’effet, puis montent en grossissant en vert ;
- « +1 ⚔ / +1 ♥ » s’élève au-dessus de l’astre, qui sautille dans un anneau de particules ;
- un tintement cristallin monte d’un ton à chaque astre renforcé d’affilée : « tous vos astres
  +1 » s’entend comme une gamme. Un malus s’affiche en rouge.

- **Gel** : la glace prend les astres de la Création un à un, de gauche à droite, avec un craquement
  cristallin. Une coque pixel art facettée monte du bas (mode 6 du shader de halo) et les couleurs
  virent au bleu givré (`uFrost`). Au dégel, la glace éclate.
- **Dégâts** : à la fin d’un combat, chaque astre survivant du vainqueur tire une comète vers les PV
  du perdant, puis le niveau de création frappe en dernier. Un grand compteur grimpe à chaque impact.
  Les PV de la cible défilent ensuite jusqu’à leur nouvelle valeur.

## Votre planète : le jeu dans le jeu

La planète du menu est la vôtre. Au départ elle est **morte et noire**. Au **Marché stellaire**,
les poussières d’étoiles achètent des **améliorations** qui la font renaître ; chacune demande un
**niveau de créateur**. Elles s’achètent dans l’ordre (`js/world.js`) :

| Ère | Améliorations (niveau requis) |
|---|---|
| Réveil | Cœur rallumé (1), Volcans (3), Atmosphère primitive (6) |
| Eau | Pluie de comètes (9), Premières pluies (12), Mers (16), Calottes polaires (20), Océans (25), Cycle de l’eau (30), Ciel bleu (35) |
| Vie | Algues (40), Mousses et lichens (46), Forêts (53), Prairies (60), Faune (67), Lune capturée (74) |
| Civilisation verte | Villages à éoliennes (80), Fermes solaires (86), Usines écologiques (92), Satellites solaires (98), Villes lumière (104), Station orbitale (110), Anneau solaire (115), Terre nouvelle (120) |

24 améliorations, 10 110 poussières au total. Le moteur garde la même géographie (tirée du tag du
joueur) et fait varier la roche, la lave sur la face de nuit, le niveau des mers, les calottes, les
nuages, l’atmosphère, la végétation, les lumières des villes, puis ajoute lune, satellites et
anneau (`livingWorld` dans `js/planet-engine.js`). Au niveau 120 elle ressemble à la Terre.

Quand les trois premières ères sont faites (dernière amélioration : Lune capturée), la planète arrive à la
**civilisation verte** (`OrbiteWorld.civil`) : le bouton **Création** apparaît alors au menu (v87).

## Graines de vie

La monnaie rare du jeu (icône de graine verte), à côté des poussières d’étoiles dans les en-têtes.
Elle accélère la création et paie les cosmétiques, **jamais la force en partie** : l’Affrontement
reste équitable.

- **En gagner sans payer** :
  - +1 pour chaque victoire (1re place), en solo ou en ligne ;
  - +2 tous les 5 niveaux ;
  - +1 pour des ruines anciennes trouvées en expédition ;
  - les succès.
- **Les dépenser** :

  | Usage | Coût |
  |---|---|
  | Booster un bâtiment de la colonie (production ×2 pendant 24 h, fiche du bâtiment) | 1 |
  | Accélérer le temps de la colonie (toucher « SOL n ») : +6 h | 1 |
  | Accélérer le temps de la colonie : +24 h | 3 |
  | Faire grandir une planète de la Forge d’une taille | 1 |
  | Recharger le rover quand sa batterie est vide | 1 |
  | Un cosmétique : fond animé ou cadre de profil (ou 2 000 poussières ; 1 200 et 6 graines avant la v90) | 10 |

- **Boutique** (Marché stellaire → GRAINES) : une vitrine animée (la graine flotte dans son halo),
  une **offre de bienvenue** unique (40 graines pour 1,99 €, le double du tarif de base), puis
  quatre paquets illustrés en pixel art, de la graine à l’arbre : Poignée 10 (0,99 €), Bourgeon
  55 (4,99 €, +10 %, « populaire »), Jardin 120 (9,99 €, +20 %) et Forêt sacrée 260 (19,99 €,
  +30 %, « meilleure offre », cadre doré animé). Suivent ce qu’elles permettent, avec leur prix, et
  comment en gagner en jouant. Le paiement réel n’est pas encore branché : il faut un prestataire (Stripe,
  Google Play) et un serveur qui crédite les graines. En attendant, le bouton l’annonce.
- Stockées dans `orbite.graines` (synchronisées avec la sauvegarde en ligne).

## Succès

Profil → **SUCCÈS** : 100 objectifs en 10 catégories, chacun rapporte de 1 à 5 graines de vie
(206 en tout). Une annonce animée s’affiche au déblocage.

| Catégorie | Nombre | Exemples |
|---|---|---|
| Affrontement | 22 | parties jouées (1 → 500), victoires (1 → 100), podiums, combats gagnés, astres dorés |
| Familles | 24 | « Champion » (gagner avec une majorité de la famille) et « Fidèle » (10 parties avec elle), pour les 12 familles |
| Lois | 5 | jouer les 15 lois, gagner avec 5 lois, gagner avec la Loi du sacrifice, de l’endurance, du phénix après renaissance |
| Légendaires | 7 | en posséder un, puis chacun des 6 en fin de partie |
| Exploits | 7 | gagner sans perdre un combat, avec 3 PV ou moins, en 12 cycles ; 7 astres, 3 dorés, deux formations |
| En ligne | 10 | première partie, victoire, 10 parties, partie privée, placement, rangs Lune → Singularité |
| Création | 5 | débloquer, semer 3 graines, taille 15, allumer l’étoile, 6 mondes en orbite |
| Colonie | 9 | tour de contrôle, 10 / 25 bâtiments, 10 / 25 / 50 colons, 400 de recherche, tout le terrain, 20 arbres |
| Expédition | 6 | partir, 5 / 25 découvertes, ruines, 200 cases de la base, 100 tronçons |
| Divers | 5 | mener sa planète à la civilisation verte, niveaux 10 / 25 / 50 / 75 |

La plupart se lisent dans les données déjà enregistrées (statistiques, Forge, colonies, planète,
classement) : un joueur existant débloque d’un coup ce qu’il a déjà accompli. Ce que le jeu ne
gardait pas (famille majoritaire, exploits d’une partie) est compté en fin de partie, dans
`orbite.succes.c` ; les succès obtenus sont dans `orbite.succes`. Code : `js/succes.js`,
traductions : `js/lang/succes.js`, tests : `tests/succes.test.mjs`.

## Marché stellaire

Deux onglets : **Ma planète** (les 24 améliorations décrites plus haut) et **Cosmétiques**.

**Cosmétiques** (prix relevés en v90 : **2 000 poussières d’étoiles ou 10 graines de vie** chacun) :
- **Fonds animés** : six décors de partie (Nébuleuse pourpre, Aurore boréale, Galaxie spirale, Voie
  lactée, Trou noir, Piliers de la création).
- **Cadres de profil** (v90) : Couronne d’or, Aurore, Braises, Givre, Néant et Cosmos. Un contour
  animé (outline et lueur, sans décaler la mise en page) et quatre rivets en pixels aux coins, autour
  du bouton profil du menu et de l’en-tête du profil. Le cadre équipé (`frame` dans
  `orbite.cosmetiques`) est publié dans `forge.frame` du profil public, que les règles Firestore
  laissent libre : vos amis le voient dans leur liste d’amis, le classement et votre fiche, sans
  règle à republier. « Sans cadre » le retire.

## Création

Bouton du menu principal, juste au-dessus du Marché stellaire. Il **n’apparaît qu’une fois la planète
arrivée à la civilisation verte** au Marché stellaire (v87 ; avant, la Création s’achetait 1 000 poussières
d’étoiles). Le Marché l’annonce sur l’ère Civilisation verte, un message salue l’ouverture, et le bouton porte
« NOUVEAU » jusqu’à la première visite. Celle-ci ouvre une cinématique (le vide, une étincelle qui devient une
étoile, « Créateur, des mondes n’attendent que vous »), puis l’écran Création, où l’on bâtit sa civilisation :
on sème sa graine dans la **Forge des mondes**. Le guide du menu ne présente la Création que si le bouton
est là.

C’est un jeu en plusieurs étapes : faire grandir sa planète, descendre à sa surface, voir la vie y
apparaître (« un colonisateur »), puis bâtir une colonie autonome en temps réel (voir **Colonie**).
L’**Atelier des planètes** (`atelier.html`) et le **Bâtisseur de colonies** (`batisseur.html`) ne sont
plus dans le menu, mais leurs moteurs servent à ce jeu et les pages restent accessibles par leur adresse.

Paramètres → **Code cadeau** : un code donne des poussières d’étoiles une fois par appareil (seule
l’empreinte SHA-256 des codes est publiée).

### Forge des mondes

Une collection de planètes à façonner soi-même avec les poussières d’étoiles, en plus de « Ma
planète ».
- **Semer une graine** : la première est offerte. Les suivantes coûtent 30, 80, 150, 250 puis 400
  poussières, pour 6 mondes au plus.
- **Nourrir** fait grandir le monde d’un palier, et il grossit à l’écran. Il y a 15 paliers, de plus
  en plus chers : 3, 4, 5, 7, 9, 12, 16, 21, 28, 36, 46, 58, 72, 90 et 110, soit 517 poussières pour
  un monde complet.
- **Chaque palier ouvre un emplacement.** Chaque ajout en prend un et se paie :
  - ceinture de débris (10) ;
  - facettes (10) ;
  - silhouette (12) : double, brisée, amas, bloc, monolithe, diamant ou tore ;
  - anneau (15) ;
  - jusqu’à trois lunes (12, 20, 30) ;
  - coque de lumière (25).

  Certains ajouts demandent une taille minimale. Retirer un ajout est gratuit et libère sa place,
  sans remboursement.
- **Nature** : la première est offerte au premier repas, la changer coûte 6 + 2 × taille. Le cristal
  demande une taille 3, la géante gazeuse une taille 6.
- **Personnaliser la planète** : nature, teinte, ajouts et relief sont regroupés dans un volet
  repliable, fermé par défaut ; il reste ouvert tant que la nature n’est pas choisie.
- **Teinte** : 12 teintes à 2 poussières, montrées par de vraies mini-planètes.
- **Remodeler le relief** (3) redessine les continents.
- **Renommer** est gratuit.

**Mon système.** Il s’ouvre quand un monde atteint la taille 5.
- **L’étoile** : on l’allume (40 poussières). On change ensuite sa lumière, de 15 à 30 poussières :
  naine rouge, étoile orange, naine jaune, étoile blanche, géante bleue ou étoile exotique. On peut
  la faire grandir 4 fois (25, 50, 90 et 150).
- **Les orbites** : chaque monde forgé (une fois sa nature choisie) prend une des 6 orbites,
  gratuitement. Choisir une orbite occupée échange les deux mondes.
- **L’écran** : les mondes tournent sur des orbites inclinées, les plus proches plus vite, et
  passent devant ou derrière l’étoile. Toucher l’étoile change sa lumière ou la fait grandir.
  Toucher un monde permet de le déplacer ou de revenir le façonner.
- Les données (étoile + mondes) tiennent dans `orbite.forge`, prêtes à être partagées quand les
  visites entre amis arriveront.

Les règles sont dans `js/forge.js` (testées par `tests/forge.test.mjs`) et l’interface dans
`js/forge-ui.js`. La collection est enregistrée dans `orbite.forge`. Une liste qui défile et porte
`data-clipbox` empêche ses astres de déborder sur l’en-tête : le moteur reçoit un cadre (`bound`).
- **Cosmétiques** : des **fonds animés** qui remplacent le noir pendant les parties, à **1 200
  poussières d’étoiles** ou **6 graines de vie** chacun. Toucher un fond l’essaie aussitôt derrière l’écran du marché. Une
  fois acheté, il s’équipe ; « Noir » remet le fond d’origine. En partie (v79), le fond est assombri
  (30 % de sa lumière) et désaturé (45 % de ses couleurs, `uSat` du rendu) pour que les astres et
  les textes restent lisibles ; il garde tout son éclat dans le marché. Les fonds disponibles :
  - **Nébuleuse pourpre** : nuages roses et violets, filaments sombres, cœur brûlant ;
  - **Aurore boréale** : voiles verts et roses au-dessus de montagnes, reflétés dans un lac ;
  - **Galaxie spirale** : cœur doré, bras bleus et roses ;
  - **Voie lactée** : bande laiteuse et étoiles filantes jaillies d’un même point ;
  - **Trou noir** : disque d’accrétion brûlant, lumière courbée ;
  - **Piliers de la création** : colonnes de gaz sombre aux bords embrasés.

  Ce sont de vrais *splash arts* peints en pixel art par `FS_SKY` (`js/planet-renderer.js`). Ils sont
  calculés à mi-résolution dans une texture, rafraîchie toutes les 50 ms, puis agrandie : c’est
  léger pour le téléphone. Ils sont tramés en paliers de couleur pour le rendu pixel, et assombris
  en partie pour garder les astres lisibles. Ils sont enregistrés dans `orbite.cosmetiques`.

### Colonie

Un monde forgé de **taille 8** ou plus (sauf une géante gazeuse, qui n’a pas de sol) affiche le
bouton **DESCENDRE À LA SURFACE** dans la Forge.
- **La descente** : la planète grossit jusqu’à remplir l’écran, puis le sol apparaît.
- **Le colonisateur** : la première fois, une cinématique (« Créateur… On dirait qu’il y a de la vie
  sur l’une de vos créations. ») fait atterrir une fusée avec 4 colons, 400 matériaux et 100 d’eau,
  d’oxygène et de nourriture.
- **Le terrain** : 128 × 128 cases en vue isométrique, avec des gisements de **glace** (taches
  claires) et de **minerai** (taches sombres). Glisser pour se déplacer, + et − pour zoomer.
- **Construire** : choisir un bâtiment dans les onglets (habitat, services, support vital, énergie,
  industrie, logistique, science, défense), toucher le terrain, puis **CONSTRUIRE**. Le calque est
  vert si la place convient, rouge sinon, avec la raison. La **tour de contrôle**, offerte, vient en
  premier. Les extracteurs d’eau se posent sur la glace, les forages et mines sur le minerai. Toucher
  un bâtiment ouvre sa fiche : rendement, et démolition (la moitié des matériaux revient).
- **Prix** : des matériaux selon l’importance du bâtiment ; les paliers avancés coûtent en plus des
  poussières d’étoiles (40 au palier 3, 150 au palier 4).
- **Zone de la colonie** : on construit dans une zone de 64 × 64 cases au départ, balisée par des
  bornes lumineuses ; le terrain au-delà est assombri. Le bouton **⤢** l’agrandit par paliers :
  80 (150 matériaux), 96 (250 + 30 poussières), 112 (350 + 60), puis tout le terrain, 128 × 128
  (500 + 120). La première tache de glace et de minerai tombe toujours dans la zone de départ.
- **Rovers** : on les voit rouler en temps réel, jaunes, avec un nuage de poussière derrière eux.
  - Le rover de la tour part récupérer des matériaux dans la zone et revient chargé de sable.
  - Chaque forage, mine ou extracteur a son transporteur, qui fait la navette avec la tour et
    revient chargé de minerai ou de glace.
  - Ils contournent les bâtiments et préfèrent l’espace dégagé.
  - Ils sont dessinés par-dessus le terrain plusieurs fois par seconde, avec un tampon de
    profondeur, sans recalculer la scène.
- **Matériaux** : les rovers de la tour de contrôle en récupèrent 1 par sol, donc la colonie n’est
  jamais bloquée. Toucher la case **MATÉRIAUX** ouvre la **navette de ravitaillement** : 100 matériaux
  pour 25 poussières d’étoiles, dans la limite du stockage. Forages et mines sur le minerai en
  produisent bien plus, et démolir rend la moitié du prix.
- **Recherche** : 19 bâtiments au départ, puis des paliers à 40, 150 et 400 de recherche.
- **Temps réel** : 1 sol = 1 minute, même appli fermée (rattrapé au retour, trois jours au plus).
  Chaque colon consomme 1 d’eau, d’oxygène et de nourriture par sol. Les bâtiments produisent
  selon leurs ouvriers (des drones assurent 30 % sans eux) et l’énergie disponible. Des colons
  arrivent s’il y a des logements libres et des réserves (tous les 3 sols, ou 2 par sol avec un
  spatioport). En cas de pénurie, ils repartent un par sol. Les tempêtes de poussière (rares,
  12 sols) réduisent le solaire à 35 %.
- **Tutoriel** en 6 étapes à la première visite, puis un conseil après la tour de contrôle.
- **Pépinière** (support vital, 40 de recherche) : la prairie et les arbres gagnent la terre ocre
  autour d’elle, en temps réel.
  - **Croissance** : elle avance d’un sol par sol si la pépinière a des ouvriers, de l’énergie et
    de l’eau ; sinon elle ralentit ou s’arrête.
  - **La prairie** : le front avance d’une case toutes les 4 heures, en langues irrégulières, jusqu’à
    30 cases (5 jours). L’herbe sort clairsemée, devient une prairie au bout de 12 heures, puis
    dense par endroits après un jour et demi.
  - **Les arbres** : ils sortent 1 à 3 jours après l’herbe, en bosquets. Pousse, jeune arbre, puis
    arbre adulte un à deux jours plus tard.
  - **Limites** : jamais sur la glace, le minerai ni sous un bâtiment ; construire sur la prairie
    la recouvre.
  - **Effet** : la verdure produit de l’oxygène (une case d’herbe sur 200, un arbre sur 10 : environ
    +13 à pleine étendue).
  - **Fiche** : toucher la pépinière montre les cases verdies, le nombre d’arbres et le temps restant.

- **Couleur du sol** : la teinte choisie dans la Forge s’applique aussi au sol de la colonie et de
  l’expédition (rotation de teinte, saturation un peu adoucie).
- **Expédition** : avec un **rover** (ou un garage) construit, le bouton **EXPÉDITION** lance le
  rover explorateur hors de la base.
  - **Un monde infini** : il se génère par tronçons de 32 × 32 cases à partir de la graine de la
    colonie. Les tronçons se chargent autour du rover à mesure qu’il avance et sortent du sol en
    s’élevant, comme dans Minecraft.
  - **Le relief** : plaines, dunes, mesas en terrasses, montagnes aux sommets givrés, canyons à
    sec, cratères à rebords. Les falaises montrent leurs strates, et on trouve des plaques de glace
    et de minerai.
  - **Se déplacer** : toucher le terrain envoie le rover. Il trouve son chemin sans gravir plus de
    2 voxels par case. ⌂ le ramène à la base.
  - **Les découvertes** (un tronçon sur trois) se ramassent en passant dessus ; un fanion reste à
    leur place :

    | Découverte | Gain |
    |---|---|
    | Météorite | 70 matériaux |
    | Sonde abandonnée | 35 recherche |
    | Géode de cristal | 15 poussières |
    | Poche de glace | 60 eau |
    | Épave de rover | 45 matériaux |
    | Ruines anciennes (rares) | 90 recherche + 25 poussières + 1 graine de vie |

  - **La batterie** : 100 points, environ 300 cases ; chaque banque de batteries de la colonie
    ajoute 40 points. Vide, le rover est remorqué à la base, où il se recharge.
  - Règles dans `js/exploration.js` (testées par `tests/exploration.test.mjs`), écran dans
    `js/exploration-ui.js`.

Les règles sont dans `js/colonie-jeu.js` (testées par `tests/colonie.test.mjs`), l’écran dans
`js/colonie-ui.js`. Les colonies sont enregistrées dans `orbite.colonies`.

## Profil

Bouton en haut à droite du menu, en trois onglets : **Profil**, **Amis** et **Classement**.

- **Profil** :
  - la carte « En ligne » (voir plus bas) ;
  - le pseudo modifiable et le tag à quatre chiffres (`Créateur#4821`), le niveau, la barre d’XP et
    votre planète ;
  - le classé, les statistiques et les 15 dernières parties.
- **Classé** (`js/classement.js`, testé). Seules les **parties classées en ligne** (Multijoueur)
  comptent, et un abandon vaut la 8e place. Le solo contre les univers rivaux, la campagne et les
  parties privées ne changent pas les points.
  - 5 parties de placement fixent le départ : un rang moyen de 1 donne Planète I, de 8 donne zéro.
  - Ensuite, les points changent selon la place : +32, +18, +4, −6, −12, −18, −24, −30, ajustés
    selon le niveau de la partie (écart avec la moyenne des points des autres créateurs, 1 point
    par tranche de 25, ±8 au plus). Battre des créateurs mieux classés rapporte plus, et perdre
    contre eux coûte moins. Le 1er gagne toujours (10 au moins), le 2e aussi (4 au moins). Le 3e
    gagne un peu, ou rien dans une partie plus faible que lui. Les places 4 à 8 perdent toujours.
  - 9 rangs : Poussière, Astéroïde, Lune, Planète, Géante, Étoile, Nébuleuse, Pulsar, chacun en
    divisions III, II, I de 100 points, puis **Singularité** dès 2 400 points.
  - L’écran de fin affiche le gain (« +28 points · Lune II », « RANG SUPÉRIEUR ! »).
- **Statistiques** : parties, victoires, podiums, rang moyen, meilleur rang, combats gagnés, astres
  dorés, cycles joués, poussières gagnées, loi favorite.

## Langues

Le jeu existe en **français, anglais, espagnol, allemand et portugais** : Paramètres → Langue. Au premier
lancement, il prend la langue du téléphone (anglais si elle n’est pas proposée). Changer de langue
redémarre le jeu dans la nouvelle langue, la partie en cours reprend là où elle était.

- `js/i18n.js` : le français est la langue source et chaque texte français sert de clé ; `tr('…', { n })`
  renvoie la traduction (ou le français s’il en manque une) ; `data-t` / `data-t-attr` traduisent les textes
  fixes de `index.html`.
- `js/lang/*.js` : les dictionnaires par zone — `regles.js` (astres, lois, familles, mots-clés, rangs, Forge),
  `jeu.js` (interface d’Affrontement), `campagne.js`, `interface.js` (page, Forge, mode en ligne).
- Les données des règles restent en français dans `rules.js` et `campagne.js` (les tests tournent en
  français) ; l’interface les traduit sur place au démarrage. Les sauvegardes ne contiennent que des
  identifiants, jamais de texte traduit.
- `node tools/i18n-check.js` vérifie que chaque texte a sa traduction dans les quatre langues, avec les
  mêmes variables et les mêmes balises.

Chaque loi a aussi sa **sphère d’énergie** à la silhouette de sa famille : fleur (Vie), vortex (Néant),
triangle renversé (Envers), flamme (Brasier), hexagone (Glace), ovale (Tempête), bloc (Minéral),
engrenage (Machine), croissant (Lunes), comète (Comètes), losange (Cristal), forme mouvante (Anomalies),
sphère (Neutre), et les treize couleurs de familles sont nettement distinctes.

## Multijoueur

Bouton **MULTIJOUEUR** du menu (connexion Google requise, voir « Mode en ligne »).

- **Duel en ligne** : « Rechercher un duel » cherche un créateur de votre rang ; personne au bout de
  40 secondes ? Un univers rival (bot) prend la place. « Défier un ami » crée un duel privé avec un
  code. **Envoyer le lien** (v74) partage `…/orbite/#rejoindre=CODE` : l’ami qui le touche arrive,
  après l’ouverture du jeu, dans le Multijoueur avec le code prêt ; une fois connecté avec Google, il
  rejoint la partie tout seul (le code attend dans la session si la connexion recharge la page). Un
  lien touché pendant que le jeu est ouvert marche aussi. Un duel classé compte comme une 2e place s’il est gagné (+18 points de base) et une 6e s’il
  est perdu (−18). Le salon porte `size: 2` (`MP.seatsOf`) ; les règles Firestore l’acceptent depuis
  la v68. Si les règles publiées sont plus anciennes et refusent ce champ, le salon est recréé
  sans lui (v75) : la graine du duel commence par « D », ce qui suffit à le reconnaître. Le duel
  entre amis marche donc sans republier les règles.
- **Défier un ami depuis sa liste** (v88) : « Défier un ami » ouvre la liste de vos amis (Profil →
  Amis), ceux en ligne d’abord. En toucher un crée le duel privé et lui envoie le défi : chez lui,
  une bulle « NOM vous défie en duel ! » s’affiche en haut de l’écran, où qu’il soit (sauf en pleine
  partie en ligne), avec **REJOINDRE** ; le défi est aussi listé en tête de l’écran Multijoueur
  (« Défis reçus »). Une bulle fermée ne revient pas. Le salon de l’hôte annonce « Défi envoyé »,
  puis « NOM est là : lancez la partie ! ». « Par un lien » garde l’ancienne invitation, et le lien
  reste proposé si l’ami est hors ligne. Le bouton **DÉFIER** existe aussi dans Profil → Amis.
  - **Sans nouvelle règle Firestore** : l’hôte publie le défi dans sa présence (`profiles/{uid}.where`,
    12 caractères au plus, permis depuis la v52) : le code de la partie suivi du code ami de l’invité.
    Les autres présences sont des mots en minuscules (`menu`, `game`, `lobby`, `multi`). Chaque
    joueur suit en direct ses amis (`onSnapshot` sur `friends` puis sur le profil de chacun,
    `OrbiteOnline.friendProfiles`) ; `OrbiteOnline.invites()` rend les défis qui portent son code,
    d’un ami vu il y a moins de 5 minutes.
  - Le défi n’est publié que tant que le salon attend l’ami (`syncInvite`, js/multi-ui.js) : il tombe
    dès que l’ami arrive, que la partie commence ou que l’hôte s’en va.
- **Discussion** (v77, `js/chat.js`) : dans le salon d’attente et pendant la partie (bouton bulle en
  haut, à côté du minuteur, avec une pastille quand un message arrive). Depuis la v81, un message
  reçu s’affiche en grosse bulle en haut de l’écran de l’autre (nom en doré, texte en grand, trois
  au plus, 4,5 s) ; la toucher ouvre la discussion. Six messages rapides (« Bonne chance ! », « Bien joué ! », « Aïe ! », « Joli combo ! »,
  « GG », « Revanche ? »), affichés dans la langue de chacun ; texte libre (120 caractères) seulement
  entre amis, en partie privée. Un message par seconde au plus. Les 40 derniers messages vivent dans
  le salon (champ `chat` de `matches/{id}`, que ses membres peuvent modifier) : aucune règle
  Firestore à republier.
- **Menu de la partie pendant un combat** (v77) : couper le son et « Comment jouer » marchent même
  en plein combat (en ligne, on ne peut pas le passer) ; quitter attend la fin du combat. Au retour
  au menu, plus rien ne reste « occupé » : les Paramètres répondent toujours.
- **Mêlée à 8 hors ligne** : la carte en bas de l’écran Multijoueur, sans connexion.
- **Mêlée classée** : recherche de créateurs de votre rang.
  - La tolérance s’élargit d’un rang toutes les 10 secondes ; on rejoint le salon en attente le
    plus ancien.
  - Au bout de 40 secondes, ou à 8 joueurs, la partie commence. Les places libres sont tenues par
    des univers rivaux (bots).
  - Le résultat compte pour le classement (c’est le seul mode qui en donne).
- **Mêlée privée** : « Créer une mêlée privée » donne un **code de session** de 6 caractères, à
  partager. Les amis le saisissent dans « Rejoindre un ami ». L’hôte lance quand il veut ; les places
  libres vont aux bots. Une partie privée ne compte pas pour le classement.
- **Qui affronte qui** (v79, façon Battlegrounds, `planPairs` dans `js/rules.js`), en mêlée solo
  comme en ligne : pas un tirage au hasard. Chaque cycle, les paires sont choisies pour que chacun
  affronte d’abord ceux qu’il n’a pas croisés depuis le plus longtemps (jamais deux fois de suite
  tant que 4 univers ou plus sont en vie), puis ceux qu’il a le moins affrontés ; l’univers en trop
  affronte le fantôme du dernier éliminé, à tour de rôle. Les paires sont fixées dès la boutique :
  la barre des rivaux annonce « Prochain : NOM », la liste le marque PROCHAIN ADVERSAIRE avec son
  dernier système déjà ouvert. En ligne, elles ne dépendent que de la graine, du cycle, des univers
  en vie et des rencontres passées (`state.met`) : tous les téléphones trouvent les mêmes.
- **Les 5 dernières secondes** (en ligne, v79) : un cadre rouge léger palpite et tremble autour de
  l’écran, le téléphone vibre à chaque seconde, jusqu’au combat.
- **Déroulement** :
  - Chacun choisit une loi parmi trois, en 20 secondes, dans les familles de la partie (les mêmes
    pour tous). Depuis la v89, chaque loi montre la forme de son énergie, comme en solo ; la liste
    n’est dessinée qu’une fois, seul le compte à rebours change (`renderLaws`, js/multi-ui.js).
  - Personne ne peut passer : un minuteur commun cadence la partie. La boutique est courte au
    début pour jouer vite (v80) : 25 s au cycle 1, 35 s au cycle 2, 50 s au cycle 3, puis 60 s,
    65 s, 70 s et 75 s au plus ; le bouton de combat affiche le compte à rebours et le tour
    se termine pour tous à zéro. Les combats ne se passent pas ; 25 s leur sont réservées avant la
    boutique suivante. On ne peut passer qu’en solo, contre les bots.
- **Sous le capot** (`js/multi.js`, règles dans `js/rules.js`) :
  - Chaque téléphone joue sa propre boutique. À la fin du tour, il publie son plateau.
  - L’hôte rassemble les plateaux des humains et ceux des bots dans un document de manche, écrit
    une seule fois. Un joueur en retard de plus de 20 s garde son plateau précédent.
  - Chaque téléphone résout alors la manche à l’identique (`mpResolve`) : mêmes paires, mêmes
    combats (graine commune, état de combat neuf). Les PV sont donc les mêmes partout. On voit
    toujours son combat de son côté (`mirror`).
  - Si l’hôte est éliminé ou se tait plus de 30 s, un autre humain prend le relais.
- **Données** : `matches/{id}` (salon), `matches/{id}/posts/{uid}` (plateaux),
  `matches/{id}/rounds/{r}` (manches). Les règles de sécurité sont dans `firebase/firestore.rules`.
  Tests : `tests/multi.test.mjs`.

## Mode en ligne (Firebase)

Le jeu reste entièrement jouable hors ligne. Le mode en ligne s’active quand `js/online-config.js`
contient la configuration Firebase du projet ; sinon, le Profil annonce « bientôt ».

- **Connexion avec Google**, dans le Profil. Le jeu passe par une fenêtre Google et, si elle est
  bloquée, par une redirection.
- **Sauvegarde en ligne** (`saves/{uid}`) : toutes les clés `orbite.*` sauf la partie et
  l’expédition en cours.
  - L’envoi se fait à la connexion, toutes les 20 s si quelque chose a changé, et au passage en
    arrière-plan.
  - Sur un nouvel appareil, la progression revient du nuage. Si les deux ont avancé, la plus avancée
    l’emporte d’elle-même. On ne demande au joueur de choisir que si chacune est en avance sur un
    point.
- **Profil public** (`profiles/{uid}`) : pseudo, tag, code ami, niveau, classé, parties, victoires,
  planète et système de la Forge.
- **Amis** (`friends/{a_b}`). Chaque joueur a un **code ami** de 6 caractères.
  - On ajoute un ami avec son code ; il accepte ou refuse, et une pastille signale les demandes.
  - Depuis la liste, **Visiter** ouvre son système de la Forge en lecture seule.
- **Présence** : connecté, chaque joueur signale où il est (menu, partie, partie en ligne), à chaque
  changement et au moins une fois par minute (`seen`, `where`). Dans Amis : point vert « En ligne »,
  point doré « En partie » ou « En partie en ligne », sinon « Vu il y a… ».
- **Classement** : le **monde** (les 50 meilleurs classés) ou **vos amis**. Toucher un joueur ouvre
  sa fiche et permet de visiter son système.
- **Sécurité** (`firebase/firestore.rules`) : chacun n’écrit que ses propres documents, avec des
  champs vérifiés. Une amitié ne s’accepte que par celui qui l’a reçue.

**Mise en service, une seule fois, par le propriétaire du jeu :**
1. Sur console.firebase.google.com, **Ajouter un projet** (par exemple « orbite »). Google Analytics
   n’est pas nécessaire.
2. **Authentication** → Commencer → **Google** → Activer → choisir l’e-mail d’assistance →
   Enregistrer.
3. **Authentication** → Paramètres → **Domaines autorisés** → Ajouter `edd-ai.github.io`.
4. **Firestore Database** → Créer une base → mode production, région `europe-west9` (Paris).
5. **Firestore** → **Règles** : coller le contenu de `firebase/firestore.rules` → Publier.
6. **Paramètres du projet** (roue dentée) → Vos applications → **Web** (`</>`) → nom « ORBITE »
   (sans Hosting). Copier l’objet `firebaseConfig` dans `js/online-config.js`, à la place de
   `null`.

**Tests contre les émulateurs** : `firebase emulators:start --project demo-orbite` dans `firebase/`.
Le module accepte `window.ORBITE_FIREBASE_EMULATOR = { auth, host, port }`, qui ouvre aussi une
connexion Google simulée pour les tests.

## Niveau du créateur

Chaque partie terminée rapporte de l’**expérience**, en plus des poussières d’étoiles :

| Source | XP |
|---|---|
| Classement | 1er 120 · 2e 90 · 3e 70 · 4e 55 · 5e 40 · 6e 30 · 7e 20 · 8e 10 |
| Cycles tenus | 5 par cycle |
| Partie abandonnée | aucune |

Il faut 80 XP pour passer au niveau 2, puis 5 de plus à chaque niveau (85, 90, 95…) : environ
44 600 XP, soit près de 300 parties, pour le niveau 120. Chaque niveau offre **25 poussières
d’étoiles** et peut ouvrir une amélioration de votre planète. Le niveau s’affiche au profil ; la barre se
remplit en fin de partie. À chaque niveau franchi, une planète apparaît, tremble, se charge puis
**explose** (éclair blanc, onde de choc, éclats de roche) et le nouveau niveau naît de ses débris.

## Lire un astre

- Sous chaque astre : l’épée donne son **Attaque**, le cœur ses **PV**.
- En haut à droite : le crâne signale un effet d’**Effondrement** (quand l’astre est détruit),
  l’étincelle un autre effet ; les autres icônes sont ses mots-clés.
- **Toucher un astre** ouvre sa fiche : pouvoir encadré à la couleur de sa famille, termes définis
  (Naissance, Fin de cycle, Habitable…). La fiche s’ouvre sur le « click » qui suit le toucher, pour
  que ce click ne la referme pas aussitôt. En combat, chez un rival ou en fin de partie, une fiche rapide s’affiche à côté.
- Les astres qui laissent des **Débris** en s’effondrant (Cendre, Nyx, Ossuaire, et Relais qui
  laisse une Sonde) les projettent depuis leurs restes ; Linceul double ces effets.

## Formes des astres

Toutes les familles ne sont pas des sphères, pour que chaque astre se reconnaisse d’un coup d’œil.
Le moteur trace ces formes par marche de rayon (`shapeSDF` dans `js/planet-renderer.js`) ; la
fiche de chaque astre les choisit avec `look.shape` dans `js/rules.js`.

| Forme | Astres |
|---|---|
| Comète (noyau de glace, queue soufflée à l’opposé de l’étoile) | Halley, Encke, Hale-Bopp, Hyakutake ; Météore et Ison en feu |
| Planète brisée (morceaux écartés, cœur qui brûle dans les fissures) | Vestige (violet), Géode (vert), Forge stellaire (orange), Sérac (glace, cœur bleu) |
| Astéroïde double (deux lobes soudés) | Tchouri, Agate, Écho, Ossuaire, Comète (glace) |
| Amas de cristaux (piquants) | Améthyste, Obsidienne (verre noir), Spore (Envers) |
| Bipyramide | Diamant, Saphir, Émeraude, Foreuse, Sonde |
| Bloc (cube arrondi) ou monolithe (dalle) | Basalte, Prisme, Sentinelle, Tesseract ; Monolithe, Quartz |
| Anneau-monde (tore) | Station, Paradoxe |
| Éclipse (disque noir et couronne) | Éclipse |
| Croissant (éclairé par l’arrière) | Séléné, Luna, Nyx |
| Radiotélescope (parabole tournée vers le ciel, récepteur, pile) | Arecibo |
| Sphère et anneau, sphère dans une coque | Relais ; Dyson |

Dans l’atelier, ces formes apparaissent aussi au hasard (une fois sur cinq pour les astéroïdes,
lunes, cristaux, machines…), et « Comète » et « Éclipse » rejoignent la liste des natures.

## Crédits

Paramètres → **Crédits** ouvre un écran plein aux couleurs d’ORBITE (v85, auparavant copié
d’ARECIBO) : le même ciel où les étoiles scintillent et des poussières montent, le titre
« CRÉDITS » en pixels comme sur l’écran titre, la police Chakra Petch et les teintes du jeu. Rien
ne défile jamais : si la page dépasse (petit téléphone, langue plus longue), elle se réduit juste
assez pour tenir (`creditsFit`).

- **Sous le titre** : ORBITE, prototype jouable en construction, avec la version (« PRE.ALPHA n »).
- **Équipe** : Direction Studio EDDA, Design Corentin Flatres, Sound design et Compositeur
  Victor Desrat.
- **Musique et son** : les musiques, nappes et sons d’ARECIBO, les thèmes du menu et les bruitages
  de Kenney (CC0, MIT). **Technique** : le moteur de planètes et la police Chakra Petch (SIL OFL).
- **Licences** : un bouton en bas ouvre une seconde page avec l’avis MIT et le détail des licences.

Détail des sons dans `audio/README.md`. Le numéro de version s’affiche toujours « PRE.ALPHA n »
(titre, bas du menu, Paramètres).

## Musique

**Lecteur du menu** (v89) : en bas du menu, ◀ et ▶ changent de morceau, le bouton du milieu lance ou
met en pause, et le nom du morceau s’affiche (un petit égaliseur en pixels bouge pendant la lecture).
Les quatre morceaux s’appellent **ARECIBO** (le thème de l’ancien jeu), **Odyssée**, **Space Marianne**
et **Nuclear** (`TRACKS` dans js/sfx.js, dans cet ordre : arecibo1, earth, arecibo2, menu). Le morceau
choisi est retenu (`orbite.piste`). Lancer la lecture rallume le son s’il était coupé, et remet la
musique à 60 % si son curseur était à zéro.


Quatre thèmes, qui se suivent l’un après l’autre :
1. le **thème principal d’ARECIBO** (`audio/arecibo1.mp3`), composé par **Victor Desrat** ;
2. **« Distant Earth »** (`audio/earth.mp3`) ;
3. le **second thème d’ARECIBO** (`audio/arecibo2.mp3`), de Victor Desrat ;
4. **« Orbiting Wonder »** (`audio/menu.mp3`).

« Distant Earth » et « Orbiting Wonder » (Studio EDDA) ont été créés avec Suno. La musique démarre au toucher sur
le titre et accompagne l’accueil, le marché, le profil et le choix de la loi. Elle s’efface en
fondu au début d’une partie, et l’ambiance spatiale reprend. Elle passe par le graphe WebAudio pour
des fondus fiables, y compris sur iPhone.

**Volumes** (v86) : Paramètres et le menu de partie ont deux curseurs, **Musique** et **Effets**
(0 à 100 %, par pas de 5). La musique passe par `musicGain`, réglé à `MUSIC_VOL × volume` ; les
bruitages, la réverbération, l’ambiance et les nappes passent par `fxMaster` (js/sfx.js). Les deux
réglages sont gardés sur l’appareil (`orbite.volMusique`, `orbite.volSons`). Mettre la musique à 0
la coupe, comme l’ancien bouton Musique ; la remonter la relance. Le bouton Son coupe tout.

## Sons

Des sons naturels plutôt que des bips : impacts de pierre, éboulis, éclats de verre, gouttes,
déclics mécaniques, avec une touche sci-fi discrète. Les bruitages viennent des packs gratuits de
**Kenney** (CC0) ; l’interface, les nappes et les musiques d’ARECIBO sont de Victor Desrat. Voir
`audio/README.md`.

- **Sons d’ARECIBO** (v69) :
  - nappes d’espace pendant la partie et le combat ;
  - nappes de vaisseau au réveil, dans la Création et le Multijoueur ;
  - déclic des boutons, survol, texte qui s’écrit, son de démarrage, erreur ;
  - allumage et extinction des grands écrans ;
  - jingle de victoire, et alarme quand vos PV passent sous le quart.

  Détail dans `audio/README.md`.
- **Ambiance** : un vent profond (l’ambiance extérieure de Kenney sans les oiseaux, descendue
  d’une quarte) et, au menu et en partie, des cristaux lointains qui tintent dans une grotte.
  Elle s’assombrit pendant les combats.
- **Combats** : souffle à chaque attaque, impacts de roche plus lourds selon les dégâts,
  bouclier de verre qui éclate, éboulis à la destruction, placés à gauche ou à droite selon la
  planète touchée.
- **Interface** : un déclic tiré parmi cinq (jamais deux fois le même de suite, à hauteur variable,
  parfois mêlé d’un petit caillou), survol à la souris, feuilles qui s’ouvrent, carillons de verre pour
  les niveaux, petit refus quand une action est impossible.
- **Fusion dorée** (v82, `SFX.fusion`, réservé aux trios depuis la v83) : un chœur d’âmes synthétisé
  (`choir`, js/sfx.js) monte pendant que les trois astres convergent (« ou… »), s’ouvre sur l’éclat
  doré (« aah ») avec une couronne de cristaux et un halo aigu, puis se perd dans la réverbération.
  Accord majeur sur la note du cristal (glass1, environ 1922 Hz), trois octaves plus bas. Les autres
  récompenses (boosts, succès, campagne) gardent le carillon de `SFX.golden`.

Les sons se chargent quand la page est servie en HTTP(S). Ouverte directement depuis un fichier,
la page garde les anciens sons synthétisés.

## Jeu caché : INVADERS (v89)

Le code Konami ouvre un Space Invaders en pixels, aux couleurs d’ORBITE, au menu comme en pleine
partie (`js/invaders.js`) :
- au clavier : ↑ ↑ ↓ ↓ ← → ← → B A ;
- au doigt : glisser vers le haut, le haut, le bas, le bas, la gauche, la droite, la gauche, la
  droite, puis toucher deux fois l’écran (2,5 s au plus entre deux gestes).

Cinq rangées de huit envahisseurs (30, 20 et 10 points), une soucoupe mystère (50 à 300), quatre
abris qui s’effritent, trois vies, des vagues de plus en plus rapides. Au clavier : ← → (ou A/Q et
D) pour bouger, Espace pour tirer, P pour la pause, Échap pour quitter. Au doigt : glisser bouge le
vaisseau, le tir part tout seul. Les sons sont synthétisés (`SFX.chip`, `SFX.hiss`) et suivent le
curseur des effets. Le terrain fait 192 × 240 pixels, agrandis d’un nombre entier de pixels de la
toile pour rester nets. En partie en ligne, le temps de boutique reste affiché en haut. Le meilleur
score est gardé dans `orbite.invaders`.

## Sur un écran de PC (16:9, v81)

Sur un grand écran horizontal (au moins 900 × 540 et plus large que 1,2 fois la hauteur : PC,
tablette tenue en largeur), `deskFit` (js/game.js) pose `body.desk` et `--z`, le zoom qui ramène
l’écran à une hauteur virtuelle de 800 px (1,35 en 1080p, 1,8 en 1440p ; jamais moins de 1).
`css/desk.css` :
- **La partie en largeur, sur trois colonnes** : à gauche les rivaux en permanence (classement avec
  PV, prochain adversaire en doré, et le dernier système du rival ou du prochain adversaire sous les
  yeux), au centre la Création, l’énergie, le système et la main (astres jusqu’à 100 px virtuels),
  à droite la loi et le bouton de combat. En combat, le système adverse prend la place de la
  Création.
- **Les autres écrans** (menu, lois, multijoueur, marché, profil, fin, Création, fiches, messages)
  sont agrandis du même zoom. Les tailles calculées en JavaScript pour un écran zoomé se comptent
  en pixels virtuels (`viewW`, `viewH`) ; les bulles posées sur la page (chiffres, aide d’un astre,
  tutoriel) prennent le même zoom (`placeAt`).
- La toile 3D, elle, compte en pixels réels : ce qu’on lui donne en pixels virtuels est multiplié
  par `ui.z` (v82 : la ligne où la planète du menu passe sous le sol, les poussières de l’horizon).
- Sur téléphone, rien ne change.
- Sur la pastille sombre du menu, les poussières restent lisibles devant une planète claire (v83).

## Shaders sous Windows (v83)

Sous Windows, les navigateurs traduisent WebGL en Direct3D, dont le compilateur déroule et inline
tout. Le shader des astres (`FS_BODY`) réunit tous les types de planètes et le tracé des
astéroïdes : d’un bloc, il se compilait en près d’une minute (55 s mesurées sur une RTX 3070), et
Opera, Brave ou Firefox se figeaient puis tombaient (Chrome s’en sortait grâce à son cache de
shaders). Depuis la v83, `Renderer.variant` (js/planet-renderer.js) fabrique une variante par type
et forme d’astéroïde (`uType`, `uShape` deviennent des constantes), et une par ciel animé (`uSky`) :
de 0,1 à 3,5 s chacune, compilées seulement quand le jeu en a besoin. Dans le jeu (`async`), elles
se compilent en arrière-plan avec `KHR_parallel_shader_compile` : un astre apparaît une à deux
secondes plus tard au lieu de bloquer la page. L’atelier garde une compilation immédiate (exports).

## Lancer

**Page restée en cache** (v71) : après une mise à jour, un téléphone peut garder l’ancienne page
`index.html` et charger les nouveaux scripts. La page porte sa version
(`<meta name="orbite-version">`). Si elle ne correspond pas à `VERSION` dans `js/game.js`, le jeu
se recharge une fois sur la page à jour (`?v=N`), au lieu de planter. Les écouteurs d’éléments ne
plantent plus si un élément manque. Le service worker télécharge sa copie hors ligne en
contournant le cache du navigateur (`cache: 'reload'`).
À chaque version, augmenter ensemble : `VERSION` (js/game.js), `version.json`, le cache de `sw.js`
et la balise `orbite-version` d’index.html (`tests/compat.test.mjs` le vérifie).

**Téléphones anciens et écran de secours** (v72) : les scripts du lancement n’utilisent ni `a?.b`
ni `a ?? b`, qu’un iPhone resté sous iOS 12 ou 13 ne sait pas lire (un seul de ces signes empêche
tout le fichier de se charger). `tests/compat.test.mjs` le vérifie ; seul `online.js` (le jeu en
ligne, à part) y échappe. Si aucun écran ne s’affiche malgré tout, un petit script d’index.html,
écrit à l’ancienne, montre « ORBITE N’A PAS PU DÉMARRER », l’erreur, la version et le navigateur,
avec un bouton **RÉPARER ET RELANCER** : il redemande les fichiers au serveur, retire le service
worker et sa copie hors ligne, puis relance. La progression (stockage local) n’est pas touchée.

Les pages fonctionnent en ouvrant directement `index.html` ou `atelier.html` dans un navigateur
récent (WebGL2 requis).

### Sur téléphone, hors ligne

ORBITE est une application web installable. Servie en HTTPS (GitHub Pages par exemple), elle
s’installe depuis le navigateur, puis se lance depuis son icône, en plein écran et sans réseau :

- **iPhone** : Safari → Partager → *Sur l’écran d’accueil* → Ajouter.
- **Android** : Chrome → menu ⋮ → *Installer l’application*.

Paramètres → **Installer sur le téléphone** propose l’installation (Android) ou rappelle ces
étapes (iPhone). Au premier lancement, `sw.js` met en cache tout le jeu : pages, scripts, police,
icônes, sons et musique. Ensuite, tout marche en mode avion. Le service worker sert les morceaux
de fichier demandés par le lecteur audio, ce qu’exige Safari pour la musique. En ligne, il prend
toujours la version du réseau, si bien que les mises à jour arrivent seules. La progression reste
sur l’appareil.

**Mises à jour.** Une appli installée qu’on rouvre est souvent juste réveillée par le téléphone,
sans recharger la page. Le jeu compare donc sa version (`VERSION` dans `js/game.js`) à
`version.json` en ligne, au démarrage, à chaque retour au premier plan et toutes les 15 minutes.
Si la version en ligne est plus récente, la page se recharge, mais seulement au menu. Pendant une
partie, une campagne ou l’écran de fin (gain d’expérience, passage de niveau), le rechargement
attend le retour au menu, et la partie reste sauvegardée. Les poussières du classement et le cadeau
de chaque niveau franchi sont versés dès l’arrivée sur l’écran de fin : l’animation ne fait que les
afficher.

**Reprise rapide.** Sur iPhone, une appli web installée est souvent fermée par le système quand on
passe à une autre appli. Le jeu enregistre donc l’écran ouvert (`orbite.session`) et sauvegarde la
partie et la campagne dès qu’il passe en arrière-plan. S’il redémarre dans la demi-heure, il saute
l’introduction et reprend directement :
- la partie en cours ;
- la campagne en cours ;
- l’écran de fin d’une partie terminée pendant la fermeture, avec ses récompenses ;
- ou le menu.

Si iOS retire le contexte WebGL en arrière-plan, le moteur de rendu est recréé à son retour
(`stage.restore`) au lieu de laisser un écran noir. Le service worker revalide
chaque fichier auprès du serveur, pour que le cache du navigateur ne resserve jamais une ancienne
version. La version s’affiche sur l’écran-titre, en bas du menu et en bas des Paramètres.

**À chaque mise en ligne**, augmenter ensemble `VERSION` (`js/game.js`), `version.json` et le nom
du cache dans `sw.js`.

En local avec un serveur : `python3 -m http.server 8080` dans `orbite/`, puis
`http://localhost:8080/`.

## Règles (paramètres actuels)

| Élément | Valeur |
|---|---|
| Univers par partie | **duel : 2** (vous + 1 rival) · mêlée : 8 (vous + 7 bots) |
| Familles | 12 au total, **5 actives par partie** (dont celle de votre loi) + les neutres : 792 combinaisons |
| Lois | 15 : 12 de famille + 3 lois de vie neutres (Sacrifice 22 PV et +1 énergie par cycle, Endurance 45 PV, Phénix 25 PV et une renaissance à 15 PV), 3 proposées au départ ; les bots ne prennent que des lois de famille |
| Astres | 9 par famille + 8 neutres = **116**, + **6 légendaires** ; **53 achetables** dans une partie, plus les légendaires |
| Copies par astre | niveau 1 : 16 · 2 : 15 · 3 : 13 · 4 : 11 · 5 : 9 · 6 : 7 |
| Création | 3 / 4 / 4 / 5 / 5 / 6 astres selon le niveau (1 à 6) |
| Énergie | 3 au premier cycle, +1 par cycle, maximum 10 |
| Coûts | acheter 3 · vendre +1 (+2 pour un astre doré, v89) · actualiser 1 · geler gratuit |
| Montée de niveau | 5 / 7 / 8 / 9 / 10, −1 à chaque cycle sans monter |
| Système / main | **2 rangées de 4** (7 astres au plus) / 10 astres |
| PV de départ | 30, **doublés en duel** (60 ; les lois de vie aussi : 44, 90, 50 et renaissance à 30) |
| Dégâts du perdant | niveau du gagnant + niveaux des astres survivants, **plafonnés à 10 en mêlée tant que plus de 3 univers sont en vie** |
| Poussières d’étoiles | duel gagné : 40 · perdu : 10 · mêlée : 1er 100 · 2e 60 · 3e 30 · ensuite 0 |
| Expérience | duel : 80 (victoire) ou 25, + 5 par cycle · mêlée : selon la place, + 5 par cycle |
| Événement cosmique (v84) | 1 par partie parmi 11, tiré de la graine, le même pour tous les univers |
| Reliques (v84) | 1 au choix parmi 3 au début des cycles 4 et 8 (12 reliques, jamais deux fois la même) |
| Éveil des lois (v84) | au début du cycle 6, chaque loi passe à sa version éveillée |

La **réserve est partagée** : les vitrines réservent les copies, les achats les retirent, la
vente et l’élimination les rendent. Quand un bot joue une famille, ses astres se raréfient.

**Trois copies** d’un même astre fusionnent en un **astre doré** (statistiques et effets
doublés). Quand vous en possédez déjà deux, la copie présente dans la Création scintille de
petites étoiles dorées : l’acheter déclenche la fusion. Un astre ajouté à la main par un effet
(Fluctuation, Multivers) fusionne de la même façon s’il complète un trio (v82). Le placer ouvre une **découverte** : un astre au choix parmi trois du niveau supérieur.
Chaque choix est encadré de la couleur de sa famille, avec son nom. Il indique aussi « Famille de
votre loi », ou combien d’astres de cette famille sont déjà dans votre système.

## Événements, reliques et éveil des lois (v84)

Trois couches qui font qu’aucune partie ne ressemble à la précédente. Tout est dans `js/rules.js`
(`EVENTS`, `RELICS`, `AWAKE_ROUND`), testé dans `tests/contenu.test.mjs`. Le bouton **✺** du haut de
l’écran (à côté des familles) montre l’événement, vos reliques (et celles du rival en duel) et votre
loi.

**Événement cosmique.** Une règle spéciale par partie, tirée de la graine (`eventFor(seed)`) : en
ligne, tous les téléphones trouvent le même. Il est annoncé dès le choix de la loi, puis en grand au
début de la partie.

| Événement | Effet |
|---|---|
| Pluie de météores | les astres de niveau 1 achetés gagnent +1/+1 |
| Abondance | +1 énergie à chaque cycle pour tous |
| Création féconde | la Création propose un astre de plus |
| Recyclage cosmique | vendre rapporte 1 énergie de plus |
| Expansion | monter de niveau coûte 1 de moins |
| Révélation | les découvertes proposent 4 astres |
| Ère des légendes | légendaires 5 fois plus fréquentes dans la Création (3 fois dans les découvertes) |
| Vent solaire | début de combat : chaque camp inflige 1 dégât à tout l’avant adverse |
| Aurore | début de combat : le premier astre de chaque camp gagne Bouclier |
| Grande marée | fin de cycle : l’astre le plus faible de chaque système gagne +1/+1 |
| Instabilité | début de combat : deux astres de chaque camp gagnent un mot-clé aléatoire |

**Reliques.** Au début des cycles 4 et 8, une fenêtre propose trois reliques ; le combat attend le
choix (en ligne, la fin du temps prend la première). Les bots choisissent seuls (`botRelic`,
d’après les mesures de la v85, voir plus bas). Les
reliques de combat voyagent avec le plateau publié en ligne (`snapshotOf`), comme l’éveil.

| Relique | Effet |
|---|---|
| Trésor | +1 énergie à chaque cycle |
| Longue-vue | la Création propose un astre de plus (7 au plus) |
| Comptoir | vendre rapporte 1 énergie de plus |
| Élan | monter de niveau coûte 1 de moins |
| Bannière | fin de cycle : un astre de votre famille la plus nombreuse gagne +1/+1 |
| Fer de lance | début de combat : l’avant gagne +1/+0 |
| Bastion | début de combat : les Remparts gagnent +0/+3 |
| Réserve | quand l’arrière avance, ses astres gagnent +2/+2 |
| Égide | début de combat : le premier astre gagne Bouclier |
| Dard | début de combat : l’astre le plus fort gagne Toxique |
| Braise d’étoile | début de combat : l’astre le plus faible gagne Renaissance |
| Alchimie | début de combat : les astres dorés gagnent +2/+2 |

**Éveil des lois.** Au début du cycle 6, chaque loi s’éveille (`p.awake`) : bannière « LOI
ÉVEILLÉE », gerbe d’étincelles, et le bouton de la loi passe en doré. L’écran du choix de la loi
montre déjà l’éveil de chacune.

| Loi | Éveillée |
|---|---|
| Symbiose | les deux astres les plus faibles gagnent +1/+1 (au lieu de +0/+1 pour un seul) |
| Entropie | les astres du Néant gagnent +1/+1 (au lieu de +1/+0) |
| Renversement | le pouvoir donne +2/+2 |
| Combustion | 3 dégâts à deux ennemis |
| Stase | Bouclier aux trois premiers astres |
| Vents | l’attaquant gagne +2/+1 |
| Gravité | les Remparts gagnent +1/+2 |
| Marées | les deux voisins de chaque Lune gagnent +1 PV |
| Passage | deux actualisations gratuites par cycle |
| Résonance | tous les autres Cristaux gagnent +1/+1 |
| Chaos | deux alliés gagnent un mot-clé |
| Ingénierie | le pouvoir devient gratuit |
| Sacrifice | 2 énergies de plus par cycle, même au maximum |
| Endurance | début de combat : l’avant gagne +0/+2 |
| Phénix | début de combat : l’astre le plus faible gagne Renaissance |

Les anciennes sauvegardes continuent : sans `relics`, `awake` ni `event`, rien ne casse
(`freeRoll` est relu pour la loi du passage).

## Défi du jour (v84)

**Jouer → Solo → Défi du jour** : un duel avec la même graine pour tout le monde ce jour-là
(`DEFI-AAAA-MM-JJ`) : mêmes familles, mêmes trois lois proposées, même rival et même événement. Une
seule tentative : la partie commencée compte, même abandonnée. Score : victoire 1000 + 5 par PV
restant + 10 par cycle d’avance sur le 30e ; défaite 20 par cycle tenu + 3 par PV pris au rival.
Bonus : +50 poussières pour une victoire, +10 sinon.

Connecté avec Google, le score part dans Firestore (`daily/{date}_{uid}`, écrit une seule fois) et
« Classement du jour » montre les 50 meilleurs. Hors ligne, il repart à la prochaine ouverture du
défi. **Les règles Firestore doivent être republiées** (`firebase/firestore.rules`, bloc
`match /daily/{id}`) pour que le classement fonctionne ; sans elles, le défi reste jouable et le score
reste sur l’appareil.

## Codex (v84)

**Codex** au menu principal : quatre onglets.
- **Astres** : les 122 astres par famille (et les légendaires), du niveau 1 au 6. Un astre se dévoile
  quand on le croise en partie (Création, découverte, système d’un rival) ; on le touche pour lire sa
  fiche. Le compteur en haut montre la progression (`orbite.codex`).
- **Lois**, **Reliques**, **Événements** : tout le contenu, avec l’éveil de chaque loi.

## Bâtisseur de colonies

`batisseur.html` génère des bâtiments de colonie en **voxels pixel art isométriques**, dans l’esprit de
Surviving Mars ou StarCraft, une graine à la fois (la même graine donne toujours le même bâtiment).
On y accède depuis l’écran **Création** du menu principal.

**68 bâtiments en 8 catégories**, chacun avec son **économie** (logements, emplois, énergie, eau,
oxygène, nourriture, recherche, matériaux ; chaque colon consomme 1 d’eau, 1 d’oxygène et 1 de nourriture) :

| Catégorie | Bâtiments |
|---|---|
| Habitat | dôme d’habitat, quartier résidentiel, modules, immeuble modulaire, capsules, habitat semi-enterré, arcologie, dortoir, villas sous dôme |
| Services | tour de contrôle (commandement), hôpital, académie, cantine, parc sous dôme, arène, marché (un pour tant d’habitants) |
| Support vital | serre, ferme verticale, aquaculture, électrolyseur d’oxygène, extracteur de glace, recycleur d’eau, MOXIE, champignonnière, condenseur atmosphérique, réservoirs |
| Énergie | champ solaire, éolienne, réacteur, géothermie, tokamak, tour solaire à héliostats, batteries, RTG, centrale au méthane |
| Industrie | forage, raffinerie, mine à ciel ouvert, fonderie, imprimante 3D géante, usine robotique, briqueterie de régolithe, usine chimique, concasseur |
| Logistique | aire de lancement, fusée, hangar, rover, spatioport, entrepôt, garage, dépôt de carburant, gare maglev, camion minier, drone de livraison |
| Science | laboratoire, antenne parabolique, observatoire, station radar, station météo, relais de communication, laboratoire de biologie, centre de données |
| Défense | tourelle, générateur de bouclier, blockhaus, poste de garde |

Une trentaine sont **animés** (pales, paraboles, radars, forages, fumées, vapeur, bras robots, rame maglev,
plasma du tokamak, héliostats…). Les bâtiments sont répartis dans `js/batiments/*.js` et s’enregistrent
auprès du moteur (`OrbiteBuildings.register`).

**Colonie** (petite 80, moyenne 112, grande 144 cases) : une colonie **autonome** planifiée.
- Le commandement, le port spatial et les communications d’abord, puis des logements par étapes ; à chaque
  étape le planificateur comble les déficits (énergie, oxygène, eau, nourriture) avec les producteurs les
  plus rentables pour leur taille, ajoute les services selon la population, de l’industrie, de la science,
  de la défense, des stockages et des véhicules.
- Chaque bâtiment est posé dès qu’il est choisi, près de l’ancre de sa zone (habitat et services au
  centre, support vital autour, énergie à l’est, industrie à l’ouest sur les gisements, port au sud,
  science au nord-est, défense aux angles) ; s’il ne rentre pas, le plan change. Plusieurs plans, du plus
  ambitieux au plus modeste, sont essayés : on garde le premier où tout le monde vit.
- Réseaux : routes de régolithe tassé, tubes pressurisés entre habitats et services, lignes électriques
  sur pylônes depuis les centrales, conduites d’eau et d’oxygène vers les réservoirs ; gisements de glace
  et de minerai peints sous les extracteurs et les mines.
- La page affiche le bilan : colons, emplois, énergie, eau, oxygène, nourriture, recherche, matériaux.

- **Rendu** (`js/building-renderer.js`) : chaque voxel est un cube de 4 × 4 pixels ; dessus clair, flanc
  droit éclairé, flanc gauche dans l’ombre, ombres portées vers l’avant gauche (soleil à l’arrière droit),
  occlusion ambiante, texture tramée du sol, verre translucide avec reflets, balises et feux qui clignotent,
  vue tournable d’un quart de tour (bouton TOURNER ou touche R).
- **Animations** (boucle de 3 s) : les pales des éoliennes tournent, la parabole pivote sur son mât, la tête
  du forage monte et descend, le bras radar de la tour balaie, la fumée sort des cheminées de la
  raffinerie, la vapeur monte du réacteur et s’échappe au pied des fusées ; dans une colonie, tout bouge
  ensemble. Le temps est un paramètre du moteur (`generate(type, graine, { t })`), la disposition ne
  change pas d’une image à l’autre.
- **Sols** : Mars, Lune, Glace, Soufre, Volcan ; **couleurs d’accent** : orange, rouge, sarcelle, jaune, bleu.
- **Moteur** (`js/building-engine.js`) : pur et déterministe, testé sous Node (`tests/batiments.test.mjs`) ;
  `OrbiteBuildings.generate(type, graine)` renvoie le modèle en voxels, réutilisable plus tard dans le jeu.

## Légendaires

Six astres **légendaires**, un par niveau, existent en **un seul exemplaire** par partie et sont présents
dans toutes les parties, quelles que soient les familles tirées. Ils ne se montrent que rarement : chaque
emplacement de la Création a 1 chance sur 100 d’en proposer un (de votre niveau ou moins), et une
découverte en glisse un parmi ses choix dans 7 % des cas. On en croise un dans environ 3 parties sur
10, et on en possède un dans 1 partie sur 10 seulement. Ils ne fusionnent pas (un seul exemplaire).

| Niveau | Légendaire | Famille | Stats | Pouvoir |
|---|---|---|---|---|
| 1 | Primordia | Vie | 2/3 | Fin de cycle : tous vos autres astres gagnent +1 PV |
| 2 | Ouroboros | Envers | 3/3 | Renaissance ; en revenant, il gagne +3/+3 et Toxique |
| 3 | Œil du Vide | Néant | 4/6 | Début de combat et Effondrement : anéantit l’ennemi le plus faible (99 dégâts) |
| 4 | Maelström | Tempête | 5/7 | Rafale ; après chacune de ses attaques, tous vos astres gagnent +1/+1 |
| 5 | Grand Attracteur | Neutre | 5/7 | Début de combat : chaque ennemi perd 1/1, il gagne tout ce qu’il a volé |
| 6 | Oméga | Neutre | 7/7 | Début de combat : vos autres astres gagnent +2/+2, les deux premiers Bouclier |

À l’écran : halo prismatique et deux anneaux d’étincelles arc-en-ciel qui tournent en sens contraires
(moteur de rendu) et chiffres irisés. Quand une légendaire apparaît dans la
Création : éclat, carillon et « LÉGENDAIRE ! » ; quand on l’achète : l’écran s’illumine, trois anneaux
arc-en-ciel, grand accord et bannière à son nom. Sur 3 000 parties simulées, un système qui finit avec une
légendaire termine en moyenne 4,24e contre 4,57e sans.

## Placement et formations (v68)

Le système a **deux rangées de 4 places** (`R.ROW_MAX`), 7 astres au plus. On glisse un astre vers la
moitié haute (l’**avant**) ou basse (l’**arrière**) ; la rangée visée s’éclaire. Rangée pleine : un
astre déplacé **échange** sa place avec celui qu’il vise (`R.move`), un nouvel astre est refusé. La
fiche d’un astre propose aussi « Passer à l’avant / à l’arrière ». Les anciennes sauvegardes sont
rangées seules : au-delà de 4, les derniers astres passent à l’arrière (`R.layout`, `R.arrange`).

**Combat** (`R.fight`) :
- Seul l’**avant** attaque, de gauche à droite, et seul l’avant ennemi peut être attaqué.
- Chaque attaquant frappe l’ennemi **en face** de lui. Les rangées sont centrées, comme à l’écran ;
  à égalité, celui qui a le moins de PV. Les **Remparts** de l’avant sont visés d’abord. Plus aucun
  hasard dans les cibles (il en reste dans certains effets d’astres et de lois).
- Quand l’avant est tombé, l’**arrière avance** (« VOTRE ARRIÈRE AVANCE ») et devient l’avant.
  Un système rangé tout à l’arrière avance dès le début.
- Les effets des astres (Naissance, début de combat, Effondrement…) agissent depuis les deux rangées.
  « Voisins », « à gauche » et « à droite » s’entendent dans la même rangée. Un astre invoqué naît
  dans la rangée de celui qui s’effondre.

**Formations** (`R.FORMATIONS`, `R.formationsOf`) : au moins **2 astres d’une même famille dans la
même rangée**. Niveau I à 2 astres, II à 3, III à 4. Chaque famille a un effet à l’avant et un autre
à l’arrière (n = niveau). Elles remplacent l’Alliance.

| Famille | À l’avant (les astres de la formation) | À l’arrière |
|---|---|---|
| Vie | +n/+n | après chaque attaque de votre avant, l’attaquant récupère 2n PV |
| Néant | quand l’un d’eux s’effondre, les autres +n/+n | quand un astre de l’avant s’effondre, +n/+n |
| Envers | +n/+n, les n premiers gagnent Renaissance | les n ennemis de l’avant les plus offensifs échangent Attaque et PV |
| Brasier | chacun inflige 2n dégâts à l’ennemi en face | 2n dégâts à l’ennemi de l’avant qui a le moins de PV |
| Glace | +n/+n, les n premiers gagnent Bouclier | les ennemis de l’avant perdent 2n Attaque |
| Tempête | +n/+2n, puis +n Attaque après chacune de leurs attaques | votre avant gagne +n/+2n, le premier Rafale |
| Minéral | +n/+2n, le plus robuste gagne Rempart | votre avant gagne +n/+2n |
| Machine | +2n Attaque | chacun donne ses mots-clés et +n/+n à l’astre de l’avant juste devant lui |
| Lunes | leurs voisins de rangée +n/+n | l’astre de l’avant juste devant chacune +2n/+2n |
| Comètes | +n Attaque, elles attaquent avant le reste de l’avant | quand l’avant est tombé, elles avancent avec +2n/+n |
| Cristal | +n/+n, le double avec une formation de Cristal à l’arrière | tous vos Cristaux +n/+n |
| Anomalies | n mots-clés aléatoires chacun | n astres de l’avant gagnent un mot-clé aléatoire |

À l’écran : étiquettes colorées à côté de « Votre système » (toucher pour la fiche « Vos formations »
et les effets de chaque famille), un trait de la couleur de la famille sous chaque astre d’une
formation, et en combat l’annonce « BRASIER II · AVANT » au-dessus de ses astres.

**L’arrière au combat** (v70, `R.POSITION_KW`) : trois mots-clés de position, portés par 23 astres.
- **Portée** : l’astre attaque aussi depuis l’arrière, et sa cible ne riposte pas. Aube, Braise,
  Magma, Géante, Sélène, Europe, Prisme, Satellite et Nimbus.
- **Percée** : l’astre frappe l’arrière ennemi en priorité. Météore, Encke, Ison, Spore, Zéphyr et
  Éclipse.
- **Garde** : tant qu’il tient à l’avant, l’ennemi ne peut pas frapper votre arrière avec Percée.
  Silex, Basalte, Monolithe, Station, Sentinelle, Banquise, Luna et Titania.

Ces mots-clés se contrent les uns les autres. Les tireurs à Portée tiennent l’arrière ; la Percée les
atteint ; la Garde la bloque ; et la Garde, à l’avant, encaisse les tirs sans riposter. Une petite
icône les signale sur l’astre (cible, flèche, tour). Le tir à Portée s’anime comme un trait lancé
depuis l’arrière.

**Phénomènes** (v70, `R.PHENOMENA`, `R.phenomenaOf`) : des combinaisons de placement qui
transforment un astre au début du combat. « Juste derrière » : l’astre de l’arrière dans la même
colonne (rangées centrées, comme à l’écran ; à égalité, celui de gauche). Les colonnes comptent
donc autant que les rangées.

| Phénomène | Placement | Effet |
|---|---|---|
| Accrétion | un Minéral juste derrière n’importe quel astre de l’avant | il grossit : +2/+5 (+3/+7 si c’est aussi un Minéral) |
| Trou noir | Néant devant, Néant juste derrière | l’astre devient un trou noir : Rempart, +1/+1 à chaque effondrement |
| Supernova | Brasier devant, Brasier juste derrière | en s’effondrant, il explose : 4 dégâts à tout l’avant ennemi |
| Éclipse | Lune devant, Soleil juste derrière | l’ennemi en face de la Lune perd la moitié de son Attaque |
| Zone habitable | astre de Vie devant, Soleil juste derrière | +2/+3 et Renaissance |
| Queue de comète | Comète devant, Comète juste derrière | Rafale et +2 Attaque |
| Halo | Glace devant, Glace juste derrière | les deux gagnent Bouclier |
| Jumeaux | Envers devant, Envers juste derrière | les deux gagnent Renaissance |
| Œil du cyclone | Tempête devant, Tempête juste derrière | Rafale, ou Méga-rafale |
| Prisme | un Cristal entre deux Cristaux de sa rangée | +2/+2 par voisin et Bouclier |

À l’écran : les astres concernés portent un cercle doré en pointillé. Le nom du phénomène s’ajoute
aux étiquettes de « Votre système » (« ✦ TROU NOIR »). La fiche des familles liste tous les
phénomènes, ceux qui sont actifs en premier. En combat, l’astre se transforme :
- l’accrétion le fait grossir ;
- le trou noir prend l’aspect d’un trou noir ;
- la supernova le fait luire, puis exploser.

Les bots essaient tous les ordres de leurs rangées pour déclencher le plus de phénomènes
(`alignPhenomena`).

**Repérage** : chaque joueur voit le système que son rival a joué au dernier combat (`p.seen`).
En duel, la barre du haut montre le rival, ses PV et « voir son système ». Les bots se placent
contre ces mêmes systèmes vus, jamais contre votre système du moment (`botArrange` : quelques
placements candidats, chacun mis à l’épreuve par des combats simulés).

**Équilibre des familles en duel** (v70, 80 duels par famille, IA experte des deux côtés, taux de
victoire selon la famille de la loi). Avant la v70, l’écart allait de 22 % (Minéral) à 62 %
(Anomalies). Après les mots-clés de position, les phénomènes et le réglage des formations :

| Vie | Cristal | Néant | Tempête | Minéral | Anomalies | Lunes | Machine | Envers | Glace | Comètes | Brasier |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 57 % | 56 % | 51 % | 46 % | 46 % | 46 % | 43 % | 41 % | 40 % | 40 % | 39 % | 38 % |

Chaque mesure a environ ±5,5 points de bruit. La Loi des vents (Tempête) donne désormais +1/+1
après chaque attaque, au lieu de +1 Attaque.

**Mesures** (scripts de simulation, IA experte des deux côtés) : un duel dure en moyenne 11,7
cycles (9 à 15 pour 80 % des parties) et finit vers le niveau 5 ; environ 2,9 formations par combat ;
l’arrière avance dans 83 % des combats. Le placement pèse : à IA égale, un joueur qui replace ses
astres au hasard passe de 45 % à 34 % de victoires.

## Familles

| Famille | Identité |
|---|---|
| Vie | Les Soleils font grandir les mondes *Habitables* à chaque fin de cycle (le « système de vie ») |
| Néant | Trous noirs et planètes mortes : chaque effondrement nourrit les autres |
| Envers | Le monde à l’envers : Renaissance, Toxique, inversion Attaque/PV (planètes retournées) |
| Brasier | Lave et étoiles rouges : dégâts dès le début du combat |
| Glace | Boucliers, et de la force quand ils se brisent |
| Tempête | Géantes gazeuses : Rafale et attaque qui monte |
| Minéral | Remparts de roche qui accumulent les PV |
| Machine | Sondes et stations qui s’arriment entre elles (Arrimage) |
| Lunes | L’ordre compte : elles renforcent leurs voisins (loi des marées) |
| Comètes | Elles grandissent quand vous actualisez la Création et récompensent la vente (loi du passage : première actualisation gratuite) |
| Cristal | Résonance : chaque Cristal joué renforce les autres (loi de résonance) |
| Anomalies | Le hasard : astres aléatoires en main ou invoqués, découvertes, mots-clés aléatoires (loi du chaos) |

Mots-clés : Rempart, Bouclier, Rafale, Méga-rafale, Renaissance, Toxique, Arrimage.

## Structure

| Fichier | Rôle |
|---|---|
| `js/campagne.js`, `js/campagne-ui.js` | Campagne : règles (cartes, ennemis, carte, combat) et interface (récit, dialogues, carte, combat) |
| `js/forge.js`, `js/forge-ui.js` | Forge des mondes : règles (paliers, prix, ajouts) et interface (écran Création) |
| `js/colonie-jeu.js`, `js/colonie-ui.js` | Colonie : règles et simulation en temps réel, écran de la surface (construction, réserves, tutoriel) |
| `js/classement.js` | Mode classé : placements, points, rangs et divisions |
| `js/genese.js`, `js/genese-ui.js` | La Genèse (campagne façon Spore) : règles de l’ère I et son écran pixel art, Façonnage, récits |
| `js/essaim.js`, `js/essaim-ui.js` | Genèse, ère II, chapitre 1 « L’Essaim » : orbites, captures, impacts, rivales, et son écran |
| `js/coeur.js`, `js/coeur-ui.js` | Genèse, ère II, chapitre 2 « Le Cœur » : l’astre en coupe, chaleur, tri des couches, bilan |
| `js/sculpture.js`, `js/sculpture-ui.js` | Genèse, ère II, chapitre 3 « La Sculpture » : l’astre en grand, outils de modelage, objectifs |
| `js/succes.js` | Les 100 succès : catalogue, progression, déblocage, onglet du Profil |
| `js/multi.js`, `js/multi-ui.js` | Multijoueur : salons, recherche classée, codes de session, manches en ligne, et leur écran |
| `js/exploration.js`, `js/exploration-ui.js` | Expédition : monde infini généré par tronçons autour du rover, découvertes |
| `js/online-config.js`, `js/online.js`, `js/online-ui.js` | Mode en ligne : configuration Firebase, connexion, sauvegarde, amis, classement, et leur interface |
| `firebase/` | Règles de sécurité Firestore et configuration des émulateurs |
| `js/rules.js` | Règles pures et déterministes : catalogue, lois, création, fusion, combat (journal d’événements), bots |
| `js/energy.js` | Sphères d’énergie des lois : petites sphères pixel art animées selon la famille (souffle, vortex, bascule, flammes, facettes, bandes, roche, grille) |
| `js/world.js` | Votre planète : les 24 améliorations, leurs ères, niveaux, prix et effets |
| `js/planet-engine.js` | Génome des planètes : une graine → astre, palette, nuages, anneaux, lunes, nom et fiche |
| `js/planet-renderer.js` | Rendu WebGL2 pixel art (tramage, palettes à décalage de teinte) + encodeur GIF |
| `js/stage.js` | Couche WebGL plein écran du jeu : dessine chaque planète à la position de son élément HTML, particules |
| `js/game.js` | Interface du jeu : écrans, glisser-déposer, animations, lecture des combats |
| `js/sfx.js` | Moteur sonore WebAudio : échantillons, réverbération, ambiance par écran, coupable dans les paramètres |
| `audio/` | Sons Kenney (CC0) préparés pour le jeu ; sources, traitements et licences dans `audio/README.md` |
| `js/atelier.js` | Page générateur |
| `css/` | Styles du jeu et de l’atelier ; `css/fonts.css` déclare la police embarquée |
| `fonts/` | Chakra Petch (woff2, latin) et sa licence SIL OFL |
| `tests/*.test.mjs` | Tests des règles, de la campagne, de la Forge, du classement, des bâtiments et de la colonie |
| `tools/equilibrage.js` | Simulation de parties entre bots : classement moyen par loi, famille et astre |
| `tools/bots-duel.js` | Force des bots : IA experte contre IA de base dans les mêmes parties |
| `tools/bots-mono.js` | Le joueur « tout dans une famille » contre les bots : sa part de victoires par famille |
| `tools/hybrides.js` | Compositions hybrides : bots à une famille contre bots à deux familles, rang de chaque duo |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation sur téléphone et hors ligne |

## Tests

```
node --test orbite/tests/*.test.mjs
```

Les tests vérifient la conservation de la réserve partagée à chaque action, les limites de main
et de système, la fusion dorée et la découverte, l’Arrimage, le gel, les mots-clés en combat,
le plafond de dégâts, le déterminisme et 160 parties complètes jouées par des bots.

## Équilibrage

Les outils de mesure ont été corrigés pour utiliser des IA comparables et poursuivre les parties jusqu’au vrai classement final. Voir [les commandes et les limites des mesures](tools/README.md). Les chiffres historiques ci-dessous précèdent cette correction et ne sont pas directement comparables aux nouveaux rapports.

Réglé sur des parties entières simulées entre 8 bots : `node orbite/tools/equilibrage.js 6000`
(environ 40 secondes). Idéal : rang moyen 4,5 et 12,5 % de victoires.

| Mesure (6 000 parties) | Avant | Après |
|---|---|---|
| Rang moyen des lois (tous les univers) | 3,51 (Symbiose) à 5,21 (Ingénierie) | 4,20 à 4,85 |
| Victoires de la meilleure loi | 26 % (Symbiose) | 16 % |
| Rang moyen par famille dominante | 3,16 (Vie) à 5,57 (Machine) | 3,67 (Vie) à 4,58 (Machine) |

Changements : Symbiose (+1 PV seulement), Éden, Terra et Genèse affaiblis ; Entropie ne renforce
plus que le Néant ; Gravité (+0/+1) et Colosse (+1/+1) affaiblis ; Tempête, Machine, Envers et
Brasier renforcés (statistiques, Titan +2/+1, Foreuse +1/+2, Sondes 3/3). Les systèmes sans famille
dominante restent plus faibles (rang 5,05), ce qui récompense l’engagement dans une famille.
La Vie reste la plus forte (20 % de victoires). Les bots jouent simplement : un vrai joueur
exploitera mieux les placements et les synergies, d’autres familles peuvent donc ressortir.

Avec les 12 familles (6 000 parties) : rang moyen des lois de 4,18 (Ingénierie) à 4,91 (Gravité),
familles dominantes de 3,68 (Vie) à 4,55 (Anomalies), Comètes à 4,35. Les bots actualisent
davantage quand ils ont des Comètes et utilisent l’actualisation gratuite de la loi du passage.

**IA experte (v17).** Les 7 bots d’une partie jouent avec l’IA experte (`skill: 1`) :
- ils montent de niveau plus tard : ils remplissent d’abord leur système, puis investissent
  l’énergie restante ;
- à partir du cycle 4, ils suivent la famille qui domine déjà leur système ;
- ils gèlent un marché qui contient une copie d’un astre qu’ils possèdent ou un astre de leur
  famille ;
- ils actualisent davantage au niveau 4 et plus.

Mesuré avec `node orbite/tools/bots-duel.js 3000`, dans les mêmes parties, IA experte contre IA de
base : rang moyen 3,67 contre 5,33, et 18 % de victoires contre 7 %. Un joueur qui joue comme
l’ancienne IA passe d’un rang moyen de 4,03 à 5,46 face aux nouveaux bots.

**IA experte (v51).** Mesuré avec `node orbite/tools/bots-mono.js 150` : un joueur « naïf » qui
joue une seule famille et achète tout ce qui en est battait trop facilement les bots (Vie 39 % de
victoires, Cristal 28 %, Lune 28 %). Les bots (réglages `BOT` dans `js/rules.js`) :
- **choisissent plutôt les familles fortes en solo** (`FAM_POWER`, mesuré par le même outil). Une
  famille faible seule (Brasier, Machine, Comètes, Envers, Anomalies) s’allie à la plus forte de la
  partie ;
- **s’engagent dans leur famille** : sa valeur grandit avec le nombre de ses astres déjà possédés ;
- **réfléchissent à leurs achats** : leurs 4 meilleures options sont jouées sur une copie de la
  partie (effets à l’achat, triplés et découvertes compris). Le plateau obtenu affronte ensuite en
  combats simulés celui de 3 rivaux.

Résultat : le joueur naïf gagne 13 % des parties en Cristal (12,5 % = autant que chaque bot), 19 % en
Vie, 11 % en Lune, et 6 % en moyenne sur les 12 familles. Avec `node orbite/tools/bots-duel.js 600`,
l’IA experte fait 1re dans 19 % des parties, contre 6 % pour l’IA de base. Un tour de bots coûte
environ 40 ms.

Pistes essayées puis écartées, car neutres ou nuisibles : monter de niveau plus tôt (nettement
plus faible) et réordonner le système.

**Cristaux allégés (v90).** Les joueurs trouvaient la composition « tout Cristal » au-dessus. Mesuré en
duel (joueur naïf qui n’achète qu’une famille contre l’IA experte, 200 à 300 duels par famille) : les
Cristaux gagnaient 73 % de leurs duels, les autres familles de 33 à 53 % (sauf Machine, Comètes et
Envers, plus difficiles à jouer naïvement). Aucune carte seule n’en était responsable (en couper une
ne changeait que 1 à 3 points) : c’est l’empilement des bonus permanents à chaque Cristal joué, avec
la Loi de résonance. Changements : Quartz 3 fois au plus, Opale 4 fois au plus (`u.res`), Rubis
+1/+1, Émeraude +1 Attaque, Cœur de cristal +1/+1, Diamant +1/+1, Saphir 3 Cristaux au plus,
Améthyste +1 PV ; Loi de résonance : +1 PV à un autre Cristal (éveillée : +1/+1 à un autre Cristal).
Résultat : 57 % en duel (Minéral 54 %, Néant 50 %) ; en mêlée à 8 (`tools/bots-mono.js 20`), rang
moyen 4,65 au lieu de 3,50.

**Reliques et éveil des lois (v84).** Mesuré avec `node orbite/tools/equilibrage.js 240 --seed v84
--json`, avant et après (sans événement cosmique, que les outils ne tirent pas) : le rang moyen des
lois va de 3,17 (Résonance) à 5,62 (Sacrifice) avant, de 3,43 (Entropie) à 5,50 (Sacrifice) après.
L’écart ne se creuse pas ; une partie dure 14,9 cycles au lieu de 14,8. Avec environ 100 parties
par loi, les écarts de moins de 0,3 rang restent dans le bruit.

**Force des reliques et choix des bots (v85).** 1 200 mêlées avec événements, où chaque relique
était tirée au hasard (script à part, hors du dépôt) : aucune relique n’est trop forte. Au cycle 4,
le rang moyen va de 4,24 (Réserve, Dard) à 4,79 (Bastion) pour 4,50 attendu ; au cycle 8, de 4,14
(Comptoir) à 4,48 (Élan) pour 4,29 ; la marge est d’environ ±0,16. Aucun événement ne change
l’ordre des lois (Résonance et Entropie en tête, Sacrifice dernière) ni la durée des parties
(14,2 à 15,0 cycles). Les bots prenaient surtout Trésor (24 %) et Fer de lance (18 %), moyennes,
et presque jamais Comptoir ni Réserve. Leur table suit maintenant ces mesures (Dard, Comptoir,
Égide, puis Réserve au cycle 4 ; Bastion seulement avec des Remparts). Sur 1 800 mêlées où la
moitié des places garde l’ancienne table, la nouvelle finit 0,18 rang plus haut (±0,08) et gagne
13,2 % des parties contre 11,8 %.
