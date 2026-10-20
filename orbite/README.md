# ORBITE

Autobattler de planètes façon *Champs de bataille* (Hearthstone), pensé pour le téléphone.
On choisit une **loi** (elle donne un premier astre), on achète des planètes dans la **Création** (là où naissent les astres),
on compose un **système solaire** de 7 orbites, puis le système combat seul contre un des
**7 univers rivaux** (bots). Le dernier univers en vie gagne. Seuls les trois premiers gagnent
des **poussières d’étoiles**.

- `index.html` : le jeu (portrait, tactile, installable comme une application).
- `atelier.html` : le générateur de planètes (bouton GÉNÉRER, export PNG et GIF en boucle).

## Ouverture du jeu

1. Écran noir, **STUDIO EDDA** s’allume pixel par pixel.
2. Titre **ORBITE** sous une **éclipse** : une lune sombre glisse devant une étoile blanche jusqu’à
   ne laisser que la couronne, qui s’épanouit et scintille. « Touchez pour commencer » : la lune
   s’écarte d’un cheveu (anneau de diamant), un éclat jaillit, le titre éclate en pixels.
3. **Première fois seulement** : écran noir, sous-titre en bas « Réveillez-vous. Bonjour, créateur. »
4. **Menu** : **votre planète** se lève sur l’horizon et tourne très lentement, des poussières
   montent du sol, des étoiles filantes passent. La première fois, « Voilà votre terrain de jeu. »
   s’écrit au centre.
5. Menu : **Jouer solo**, **Multijoueur** (bientôt), **Marché stellaire**, **Paramètres**, et en
   haut à droite le **profil** (pseudo, niveau, avatar = votre planète). **Jouer solo** se déplie
   en accordéon sur **Campagne** et **Affrontement** (contre 7 univers) ; Multijoueur se replie
   dessous. Le menu reste rangé.

Les **Paramètres** restent courts : son, musique, **Tutoriels et aide**, installation et crédits.
La progression (niveau, poussières, planète, historique) ne peut pas être effacée depuis le jeu. **Tutoriels et aide** regroupe en un seul bouton :
- Comment jouer ;
- le guide du menu ;
- le tutoriel de partie ;
- les tutoriels de campagne ;
- l’introduction.

La vitesse des combats n’est pas réglable : tout le monde voit les combats au même rythme. Le
bouton « Passer » reste disponible pendant un combat.

## Campagne (démo · acte I)

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

- **Guide du menu** (première visite) : Jouer solo (ouvre Campagne et Affrontement), Marché
  stellaire et poussières d’étoiles, Profil, Paramètres.
- **Campagne** : le premier combat est guidé, et la carte en relief a son propre guide
  (`MAP_STEPS`).
- **Première partie guidée** :
  - le choix de la loi ;
  - les PV et l’énergie ;
  - lire une fiche puis acheter, et glisser l’astre de la main au système ;
  - l’ordre d’attaque et le combat ;
  - le calcul des dégâts ;
  - actualiser, geler, monter de niveau, vendre, le pouvoir et les rivaux ;
  - enfin, les astres dorés et le podium.
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

## Marché stellaire

Trois onglets :

- **Ma planète** : les 24 améliorations décrites plus haut.
- **Création** : la **Forge des mondes**, puis l’**Atelier des planètes** (`atelier.html`), le générateur pixel art avec export PNG et GIF.

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
- **Cosmétiques** : des **fonds animés** qui remplacent le noir pendant les parties, à **650
  poussières d’étoiles** chacun. Toucher un fond l’essaie aussitôt derrière l’écran du marché. Une
  fois acheté, il s’équipe ; « Noir » remet le fond d’origine. Les fonds disponibles :
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

## Profil

Bouton en haut à droite du menu, en trois onglets : **Profil**, **Amis** et **Classement**.

- **Profil** :
  - la carte « En ligne » (voir plus bas) ;
  - le pseudo modifiable et le tag à quatre chiffres (`Créateur#4821`), le niveau, la barre d’XP et
    votre planète ;
  - le classé, les statistiques et les 15 dernières parties.
- **Classé** (`js/classement.js`, testé). Chaque partie d’Affrontement compte, et un abandon vaut
  la 8e place.
  - 5 parties de placement fixent le départ : un rang moyen de 1 donne Planète I, de 8 donne zéro.
  - Ensuite, les points changent selon la place : +40, +28, +16, +6, −6, −14, −22, −30.
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
| Planète brisée (morceaux écartés, cœur qui brûle dans les fissures) | Vestige (violet), Géode (vert), Forge stellaire (orange) |
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

Paramètres → **Crédits** : Studio Edda, les sons de Kenney (CC0 et MIT, avec l’avis de licence
MIT), la police Chakra Petch (SIL Open Font License, embarquée dans `fonts/` avec sa licence). Détail des sons dans `audio/README.md`.

## Musique

Deux thèmes (Studio Edda, créés avec Suno), réencodés en MP3 128 kbit/s, qui se suivent l’un
après l’autre : **« Distant Earth »** (`audio/earth.mp3`), le thème principal, puis **« Orbiting
Wonder »** (`audio/menu.mp3`). La musique démarre au toucher sur le titre, accompagne l’accueil, le marché, le profil et
le choix de la loi, puis s’efface en fondu au début d’une partie (l’ambiance spatiale reprend). Il
passe par le graphe WebAudio pour des fondus fiables, y compris sur iPhone. Paramètres → Musique
le coupe sans couper les bruitages.

## Sons

Des sons naturels plutôt que des bips : impacts de pierre, éboulis, éclats de verre, gouttes,
déclics mécaniques, avec une touche sci-fi discrète. Tous viennent des packs gratuits de
**Kenney** (CC0), voir `audio/README.md`.

- **Ambiance** : un vent profond (l’ambiance extérieure de Kenney sans les oiseaux, descendue
  d’une quarte) et, au menu et en partie, des cristaux lointains qui tintent dans une grotte.
  Elle s’assombrit pendant les combats.
- **Combats** : souffle à chaque attaque, impacts de roche plus lourds selon les dégâts,
  bouclier de verre qui éclate, éboulis à la destruction, placés à gauche ou à droite selon la
  planète touchée.
- **Interface** : un déclic tiré parmi cinq (jamais deux fois le même de suite, à hauteur variable,
  parfois mêlé d’un petit caillou), survol à la souris, feuilles qui s’ouvrent, carillons de verre pour
  les niveaux et les astres dorés, petit refus quand une action est impossible.

Les sons se chargent quand la page est servie en HTTP(S). Ouverte directement depuis un fichier,
la page garde les anciens sons synthétisés.

## Lancer

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
| Univers par partie | 8 (vous + 7 bots) |
| Familles | 12 au total, **5 actives par partie** (dont celle de votre loi) + les neutres : 792 combinaisons |
| Lois | 15 : 12 de famille + 3 lois de vie neutres (Sacrifice 22 PV et +1 énergie par cycle, Endurance 45 PV, Phénix 25 PV et une renaissance à 15 PV), 3 proposées au départ ; les bots ne prennent que des lois de famille |
| Astres | 9 par famille + 8 neutres = **116**, + **6 légendaires** ; **53 achetables** dans une partie, plus les légendaires |
| Copies par astre | niveau 1 : 16 · 2 : 15 · 3 : 13 · 4 : 11 · 5 : 9 · 6 : 7 |
| Création | 3 / 4 / 4 / 5 / 5 / 6 astres selon le niveau (1 à 6) |
| Énergie | 3 au premier cycle, +1 par cycle, maximum 10 |
| Coûts | acheter 3 · vendre +1 · actualiser 1 · geler gratuit |
| Montée de niveau | 5 / 7 / 8 / 9 / 10, −1 à chaque cycle sans monter |
| Système / main | 7 orbites / 10 astres |
| PV de départ | 30 |
| Dégâts du perdant | niveau du gagnant + niveaux des astres survivants, **plafonnés à 10 tant que plus de 3 univers sont en vie** |
| Poussières d’étoiles | 1er : 100 · 2e : 60 · 3e : 30 · ensuite : 0 |

La **réserve est partagée** : les vitrines réservent les copies, les achats les retirent, la
vente et l’élimination les rendent. Quand un bot joue une famille, ses astres se raréfient.

**Trois copies** d’un même astre fusionnent en un **astre doré** (statistiques et effets
doublés). Quand vous en possédez déjà deux, la copie présente dans la Création scintille de
petites étoiles dorées : l’acheter déclenche la fusion. Le placer ouvre une **découverte** : un astre au choix parmi trois du niveau supérieur.
Chaque choix est encadré de la couleur de sa famille, avec son nom. Il indique aussi « Famille de
votre loi », ou combien d’astres de cette famille sont déjà dans votre système.

## Légendaires

Six astres **légendaires**, un par niveau, existent en **un seul exemplaire** par partie et sont présents
dans toutes les parties, quelles que soient les familles tirées. Ils ne se montrent que rarement : chaque
emplacement de la Création a 1 chance sur 14 d’en proposer un (de votre niveau ou moins), et une
découverte en glisse un parmi ses choix une fois sur trois. Ils ne fusionnent pas (un seul exemplaire).

| Niveau | Légendaire | Famille | Stats | Pouvoir |
|---|---|---|---|---|
| 1 | Primordia | Vie | 2/3 | Fin de cycle : tous vos autres astres gagnent +1 PV |
| 2 | Ouroboros | Envers | 3/3 | Renaissance ; en revenant, il gagne +3/+3 et Venin |
| 3 | Œil du Vide | Néant | 4/6 | Début de combat et Effondrement : anéantit l’ennemi le plus faible (99 dégâts) |
| 4 | Maelström | Tempête | 5/7 | Rafale ; après chacune de ses attaques, tous vos astres gagnent +1/+1 |
| 5 | Grand Attracteur | Neutre | 5/7 | Début de combat : chaque ennemi perd 1/1, il gagne tout ce qu’il a volé |
| 6 | Oméga | Neutre | 7/7 | Début de combat : vos autres astres gagnent +2/+2, les deux premiers Bouclier |

À l’écran : halo prismatique et deux anneaux d’étincelles arc-en-ciel qui tournent en sens contraires
(moteur de rendu), anneau irisé autour de l’astre, chiffres irisés. Quand une légendaire apparaît dans la
Création : éclat, carillon et « LÉGENDAIRE ! » ; quand on l’achète : l’écran s’illumine, trois anneaux
arc-en-ciel, grand accord et bannière à son nom. Sur 3 000 parties simulées, un système qui finit avec une
légendaire termine en moyenne 4,24e contre 4,57e sans.

## Alliance (compositions hybrides)

Un système qui réunit **deux familles d’au moins 3 astres chacune** forme une **Alliance**. Au début
de chaque combat, les astres de ces deux familles gagnent +1/+1 (`R.ALLIANCE`, `R.allianceOf`).
- **Pendant la création**, une étiquette dorée « ALLIANCE … » s’affiche à côté de « Votre
  système ». Une explication apparaît la première fois. Toucher l’étiquette ouvre la fiche des
  familles.
- **En combat**, « ALLIANCE · … » s’annonce au-dessus du système, puis chaque astre allié gagne son
  +1/+1.
- **Les bots** : environ 40 % d’entre eux visent une Alliance de deux familles, les autres une
  famille seule.
- **Ocre** (Minéral) renforce désormais un allié aléatoire de toute famille, et plus seulement un
  Minéral. Le Minéral devient ainsi un bon partenaire.

**Mesure** avec `node orbite/tools/hybrides.js 4000` : dans les mêmes parties, la moitié des univers
vise une famille et l’autre moitié deux.

| | Rang moyen avant | Rang moyen après |
|---|---|---|
| Une famille | 4,45 | 4,60 |
| Deux familles | 4,55 | 4,40 |
| Duos jouables (rang ≤ 4,75) | 50 / 66 | 62 / 66 |

Les deux styles mènent à la victoire. L’écart entre les lois (`tools/equilibrage.js`) reste le même.

## Familles

| Famille | Identité |
|---|---|
| Vie | Les Soleils font grandir les mondes *Habitables* à chaque fin de cycle (le « système de vie ») |
| Néant | Trous noirs et planètes mortes : chaque effondrement nourrit les autres |
| Envers | Le monde à l’envers : Renaissance, Venin, inversion Attaque/PV (planètes retournées) |
| Brasier | Lave et étoiles rouges : dégâts dès le début du combat |
| Glace | Boucliers, et de la force quand ils se brisent |
| Tempête | Géantes gazeuses : Rafale et attaque qui monte |
| Minéral | Remparts de roche qui accumulent les PV |
| Machine | Sondes et stations qui s’arriment entre elles (Arrimage) |
| Lunes | L’ordre compte : elles renforcent leurs voisins (loi des marées) |
| Comètes | Elles grandissent quand vous actualisez la Création et récompensent la vente (loi du passage : première actualisation gratuite) |
| Cristal | Résonance : chaque Cristal joué renforce les autres (loi de résonance) |
| Anomalies | Le hasard : astres aléatoires en main ou invoqués, découvertes, mots-clés aléatoires (loi du chaos) |

Mots-clés : Rempart, Bouclier, Rafale, Méga-rafale, Renaissance, Venin, Arrimage.

## Structure

| Fichier | Rôle |
|---|---|
| `js/campagne.js`, `js/campagne-ui.js` | Campagne : règles (cartes, ennemis, carte, combat) et interface (récit, dialogues, carte, combat) |
| `js/forge.js`, `js/forge-ui.js` | Forge des mondes : règles (paliers, prix, ajouts) et interface (onglet Création) |
| `js/classement.js` | Mode classé : placements, points, rangs et divisions |
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
| `tests/rules.test.mjs`, `tests/campagne.test.mjs`, `tests/forge.test.mjs` | Tests des règles, de la campagne et de la Forge |
| `tools/equilibrage.js` | Simulation de parties entre bots : classement moyen par loi, famille et astre |
| `tools/bots-duel.js` | Force des bots : IA experte contre IA de base dans les mêmes parties |
| `tools/hybrides.js` | Compositions hybrides : bots à une famille contre bots à deux familles, rang de chaque duo |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation sur téléphone et hors ligne |

## Tests

```
node --test orbite/tests/rules.test.mjs orbite/tests/campagne.test.mjs orbite/tests/forge.test.mjs orbite/tests/classement.test.mjs
```

Les tests vérifient la conservation de la réserve partagée à chaque action, les limites de main
et de système, la fusion dorée et la découverte, l’Arrimage, le gel, les mots-clés en combat,
le plafond de dégâts, le déterminisme et 160 parties complètes jouées par des bots.

## Équilibrage

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

Pistes essayées puis écartées, car neutres ou nuisibles : monter de niveau plus tôt (nettement
plus faible), pondérer la synergie de famille et réordonner le système.
