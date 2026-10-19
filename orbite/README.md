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
2. Titre **ORBITE**, un astéroïde gravite autour ; « Touchez pour commencer ». Au toucher, le titre
   éclate en pixels.
3. **Première fois seulement** : écran noir, sous-titre en bas « Réveillez-vous. Bonjour, créateur. »
4. **Menu** : une planète géante se lève sur l’horizon et tourne très lentement, des poussières
   montent du sol, des étoiles filantes passent. La première fois, « Voilà votre terrain de jeu. »
   s’écrit au centre.
5. Menu : **Jouer solo**, **Multijoueur** (bientôt), **Marché stellaire**, **Paramètres**.

Le **Marché stellaire** dépense les poussières d’étoiles : chaque achat débloque un nouvel
**horizon** (la planète du menu). Les **Paramètres** gèrent le son, la vitesse des combats,
l’atelier, et permettent de revoir l’introduction.

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
| Familles | 8 au total, **5 actives par partie** (dont celle de votre loi) + les neutres |
| Astres | 9 par famille + 8 neutres = **80**, dont **53 achetables** dans une partie |
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

Mots-clés : Rempart, Bouclier, Rafale, Méga-rafale, Renaissance, Venin, Arrimage.

## Structure

| Fichier | Rôle |
|---|---|
| `js/rules.js` | Règles pures et déterministes : catalogue, lois, taverne, fusion, combat (journal d’événements), bots |
| `js/planet-engine.js` | Génome des planètes : une graine → astre, palette, nuages, anneaux, lunes, nom et fiche |
| `js/planet-renderer.js` | Rendu WebGL2 pixel art (tramage, palettes à décalage de teinte) + encodeur GIF |
| `js/stage.js` | Couche WebGL plein écran du jeu : dessine chaque planète à la position de son élément HTML, particules |
| `js/game.js` | Interface du jeu : écrans, glisser-déposer, animations, lecture des combats |
| `js/sfx.js` | Moteur sonore WebAudio : échantillons, réverbération, ambiance par écran, coupable dans les paramètres |
| `audio/` | Sons Kenney (CC0) préparés pour le jeu ; sources, traitements et licences dans `audio/README.md` |
| `js/atelier.js` | Page générateur |
| `css/` | Styles du jeu et de l’atelier |
| `tests/rules.test.mjs` | Tests des règles |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation sur téléphone et hors ligne |

## Tests

```
node --test orbite/tests/rules.test.mjs
```

Les tests vérifient la conservation de la réserve partagée à chaque action, les limites de main
et de système, la fusion dorée et la découverte, l’Arrimage, le gel, les mots-clés en combat,
le plafond de dégâts, le déterminisme et 160 parties complètes jouées par des bots.

## Équilibrage

Initial, réglé sur des parties simulées entre bots (rang moyen de chaque famille entre ~3,6 et
~5,3 pour une moyenne idéale de 4,5). Les bots jouent simplement : un vrai joueur exploitera
mieux les placements et les synergies.
