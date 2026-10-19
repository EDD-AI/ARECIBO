# ORBITE

Autobattler de planètes façon *Champs de bataille* (Hearthstone), pensé pour le téléphone.
On choisit une **loi** (elle donne un premier astre), on achète des planètes dans la **taverne**,
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
   haut à droite le **profil** (pseudo, niveau, avatar = votre planète).

Les **Paramètres** gèrent le son, la vitesse des combats, l’atelier, les crédits, et permettent de
revoir l’introduction.

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

## Profil

Bouton en haut à droite du menu :

- **Pseudo** modifiable et tag à quatre chiffres (`Créateur#4821`), niveau, barre d’XP, votre planète.
- **Classé** (à venir avec le multijoueur) : 5 parties de placement puis un rang mondial, de la
  Poussière à la Singularité : Poussière, Astéroïde, Lune, Planète, Géante, Étoile, Nébuleuse,
  Pulsar (divisions I à III) et **Singularité** pour le top 500 mondial. Pour l’instant : « Non classé ».
- **Statistiques** : parties, victoires, podiums, rang moyen, meilleur rang, combats gagnés, astres
  dorés, cycles joués, poussières gagnées, loi favorite.
- **Dernières parties** : les 15 dernières (rang, loi, cycles, date).

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
- **Toucher un astre** ouvre sa fiche : effet expliqué, termes définis (Naissance, Fin de cycle,
  Habitable…). En combat, chez un rival ou en fin de partie, une fiche rapide s’affiche à côté.
- Les astres qui laissent des **Débris** en s’effondrant (Cendre, Nyx, Ossuaire, et Relais qui
  laisse une Sonde) les projettent depuis leurs restes ; Linceul double ces effets.

## Crédits

Paramètres → **Crédits** : Studio Edda, les sons de Kenney (CC0 et MIT, avec l’avis de licence
MIT), la police Chakra Petch (SIL Open Font License). Détail des sons dans `audio/README.md`.

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
- **Interface** : déclics, survol à la souris, feuilles qui s’ouvrent, carillons de verre pour
  les niveaux et les astres dorés, petit refus quand une action est impossible.

Les sons se chargent quand la page est servie en HTTP(S). Ouverte directement depuis un fichier,
la page garde les anciens sons synthétisés.

## Lancer

Les pages fonctionnent en ouvrant directement `index.html` ou `atelier.html` dans un navigateur
récent (WebGL2 requis). Pour l’installer sur un téléphone (mode hors ligne, plein écran), il faut
la servir en HTTPS, par exemple via GitHub Pages, puis « Ajouter à l’écran d’accueil ».

En local avec un serveur : `python3 -m http.server 8080` dans `orbite/`, puis
`http://localhost:8080/`.

## Règles (paramètres actuels)

| Élément | Valeur |
|---|---|
| Univers par partie | 8 (vous + 7 bots) |
| Familles | 12 au total, **5 actives par partie** (dont celle de votre loi) + les neutres : 792 combinaisons |
| Lois | 12 (une par famille), 3 proposées au départ |
| Astres | 9 par famille + 8 neutres = **116**, dont **53 achetables** dans une partie |
| Copies par astre | niveau 1 : 16 · 2 : 15 · 3 : 13 · 4 : 11 · 5 : 9 · 6 : 7 |
| Taverne | 3 / 4 / 4 / 5 / 5 / 6 astres selon le niveau (1 à 6) |
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
doublés). Le placer ouvre une **découverte** : un astre au choix parmi trois du niveau supérieur.

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
| Comètes | Elles grandissent quand vous actualisez la taverne et récompensent la vente (loi du passage : première actualisation gratuite) |
| Cristal | Résonance : chaque Cristal joué renforce les autres (loi de résonance) |
| Anomalies | Le hasard : astres aléatoires en main ou invoqués, découvertes, mots-clés aléatoires (loi du chaos) |

Mots-clés : Rempart, Bouclier, Rafale, Méga-rafale, Renaissance, Venin, Arrimage.

## Structure

| Fichier | Rôle |
|---|---|
| `js/rules.js` | Règles pures et déterministes : catalogue, lois, taverne, fusion, combat (journal d’événements), bots |
| `js/energy.js` | Sphères d’énergie des lois : petites sphères pixel art animées selon la famille (souffle, vortex, bascule, flammes, facettes, bandes, roche, grille) |
| `js/world.js` | Votre planète : les 24 améliorations, leurs ères, niveaux, prix et effets |
| `js/planet-engine.js` | Génome des planètes : une graine → astre, palette, nuages, anneaux, lunes, nom et fiche |
| `js/planet-renderer.js` | Rendu WebGL2 pixel art (tramage, palettes à décalage de teinte) + encodeur GIF |
| `js/stage.js` | Couche WebGL plein écran du jeu : dessine chaque planète à la position de son élément HTML, particules |
| `js/game.js` | Interface du jeu : écrans, glisser-déposer, animations, lecture des combats |
| `js/sfx.js` | Moteur sonore WebAudio : échantillons, réverbération, ambiance par écran, coupable dans les paramètres |
| `audio/` | Sons Kenney (CC0) préparés pour le jeu ; sources, traitements et licences dans `audio/README.md` |
| `js/atelier.js` | Page générateur |
| `css/` | Styles du jeu et de l’atelier |
| `tests/rules.test.mjs` | Tests des règles |
| `tools/equilibrage.js` | Simulation de parties entre bots : classement moyen par loi, famille et astre |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation sur téléphone et hors ligne |

## Tests

```
node --test orbite/tests/rules.test.mjs
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
