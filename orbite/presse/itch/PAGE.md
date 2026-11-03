# ORBITE · textes de la page itch.io

Tous les textes de la page, prêts à copier-coller : les champs du formulaire (partie 1), la description
complète en anglais puis en français (partie 2) et un premier devlog (partie 3). Chaque chiffre et chaque
nom vient du code du jeu (version PRE.ALPHA 1.40) : voir l’annexe en bas.

## Mode d’emploi

- **Coller la description.** L’éditeur de description d’itch.io est un éditeur visuel. Ouvre ce fichier
  dans un aperçu Markdown (VS Code : Ctrl+Maj+V, ou la page du fichier sur GitHub), puis copie le texte
  **rendu** entre les repères « DÉBUT » et « FIN » : titres, gras et listes passent tels quels. Si tu
  colles le Markdown brut, les `**` et les `###` s’afficheront.
- **Images.** Le texte se suffit à lui-même. Si tu veux illustrer la description, insère tes propres
  images (bouton image de l’éditeur) entre les sections, en 630 px de large au plus.
- **Typographie.** Les espaces insécables du français sont déjà dans le texte (invisibles) : insécable
  avant « : » et dans les guillemets, fine insécable avant « ; ! ? ». Ne les remplace pas.
- **Marques.** La page ne cite aucun autre jeu ni aucune marque. Les seuls noms extérieurs sont ceux des
  crédits, recopiés de l’écran des crédits du jeu (ils sont exigés par les licences). Le mode en ligne
  passe par un compte Google, mais la page dit seulement « connectez-vous depuis votre profil » : ajoute
  « avec votre compte Google » si tu préfères le dire.
- **Lien vers la version web** (partie 2, « Play anywhere ») : facultatif. Garde-le si tu veux que les
  joueurs puissent installer ORBITE comme une appli ; sinon, prends la phrase de remplacement indiquée.

---

## 1. Champs de la page

- **Title** : `ORBITE`
- **Project URL** : `orbite-game` (adresse : `https://edda-studio.itch.io/orbite-game`). Garde bien
  `orbite-game` : depuis la version 140, les invitations envoyées depuis itch.io renvoient à cette adresse.
- **Short description or tagline** (une seule par page ; l’anglais conseillé, la page est bilingue) :
  - EN (82 caractères) : `Build the mightiest solar system in the universe. A cosmic pixel-art auto-battler.`
  - FR (97 caractères) : `Composez le système solaire le plus puissant de l’univers. Un auto-battler cosmique en pixel art.`
  - FR court (58 caractères) : `Composez le système solaire le plus puissant de l’univers.`
- **Classification** : `Games`
- **Kind of project** : `HTML` (le jeu se joue dans le navigateur)
- **Release status** : `In development`. Le jeu se présente lui-même comme « prototype jouable en
  construction » et « PRE.ALPHA » (écran des crédits).
- **Pricing** : `$0 or donate` (gratuit, dons possibles). Laisser le don suggéré vide ou mettre un petit
  montant, à ton choix.
- **Genre** : `Strategy`
- **Tags** (10, tous des tags courants d’itch.io ; je n’ai pas pu vérifier leur fréquence en ligne,
  itch.io est bloqué ici : prends la forme que propose l’autocomplétion) :
  `auto-battler`, `strategy`, `pixel-art`, `space`, `sci-fi`, `multiplayer`, `pvp`, `singleplayer`,
  `procedural-generation`, `mobile`
- **Languages** : English, French, Spanish, German, Portuguese. Le portugais du jeu est celui du Brésil
  (« você », « celular », « tela » dans `js/lang/`) : si itch.io distingue les variantes, choisis
  Portuguese (Brazil).
- **Platforms** : rien à cocher pour un jeu HTML (itch.io affiche « Play in browser »). Dans les options
  d’intégration, cocher **Mobile friendly**, orientation **Portrait** (le jeu est pensé en portrait sur
  téléphone : `manifest.webmanifest` ; sur PC, il passe tout seul en écran large).
- **Inputs** : `Mouse`, `Touchscreen` (le clavier n’est pas nécessaire).
- **Nombre de joueurs** : 1 à 8. Solo contre l’IA (duel ou mêlée à 8) ; en ligne, duel à 2 ou mêlée
  jusqu’à 8. Si itch.io propose le champ « Multiplayer », cocher **Server-based networked multiplayer** ;
  « Player count » : 1 à 8.
- **Accessibilité** (si le champ est proposé) : **Interactive tutorial** (le premier duel est guidé pas
  à pas).
- **AI generation disclosure** (champ d’itch.io, facultatif pour un jeu mais conseillé) : à remplir
  toi-même, honnêtement. Les faits : tes visuels (`presse/visuels/`) et les deux propositions de
  couverture (`presse/itch/couverture-*.png`) viennent d’images générées avec Higgsfield (Nano Banana) ;
  si tu les mets sur la page, la réponse honnête est **oui, Graphics**. Les astres et l’interface du jeu,
  eux, sont dessinés par le code du jeu (pas d’IA générative). Pour le reste (musique, textes), c’est toi
  qui sais.
- **Community** : activer les commentaires si tu gardes la phrase « leave a comment » de la description.

---

## 2. Description complète

<!-- DÉBUT de la description à copier -->

*Version française plus bas.*

**Build the mightiest solar system in the universe.**

ORBITE is a cosmic auto-battler in pixel art. Buy orbs (planets, moons, comets, stars, black holes),
place them on two rows, form families, pick a law, and watch your system clash with rival systems,
cycle after cycle. Last one standing wins.

Free, in your browser, on phone or PC.


### How to play




1. **Pick a law.** Three laws are offered at the start. Each one shapes your game and gives you your
   first orb.
2. **Buy orbs** in the Creation, where orbs are born. An orb costs 3 energy. You get 3 energy on the
   first cycle, one more each cycle, up to 10. Refresh the offer for 1, freeze it for free, or level up
   the Creation to reach stronger orbs.
3. **Place them on two rows.** The front row attacks and takes the hits. The back row stays safe and
   moves up once the front has fallen. Each front-row orb strikes the enemy right in front of it: no
   random targets, your placement decides.
4. **Form families, or mix them.** Two or more orbs of the same family in the same row form a formation
   (levels I and II). Each family has one bonus in the front row and another in the back. Three different
   families in one row form a **Mix**, some orbs belong to two families, and placement combos link
   families together (Ice in front of Blaze makes Steam…).
5. **Fuse.** Three copies of the same orb fuse into a **golden orb**: stats and effects doubled, and you
   pick one of three orbs from the next level up.
6. **Let them fight.** Combat plays out on its own. In a duel, the first universe at 0 HP loses. In a
   melee, the last one standing wins.

Your first duel is guided step by step.

### What makes ORBITE different

- **Placement is everything.** Rows and columns both matter. **Range** orbs fire from the back row,
  **Breach** orbs strike the enemy back row, **Guard** orbs shut Breach down.
- **13 phenomena.** Some placements transform an orb at the start of combat. Two Void orbs, one behind
  the other: a black hole. Two Blaze orbs: a supernova. A Moon in front of a Sun: an eclipse.
- **No two games alike.** Each game draws 5 of the 13 families (1,287 combinations) and one cosmic event
  out of 11. At cycles 4 and 8, you choose a relic. At cycle 6, every law awakens and gets stronger.
- **A shared pool.** Everyone buys from the same stock of copies. If a rival plays your family, your
  orbs get scarcer.
- **Every orb is drawn live.** The game’s own planet engine renders each orb in pixel art, in real
  time: gas giants, broken planets, comets with their tails, ring-worlds, nebulae of drifting gas.


### Families and content

**13 families**, 9 orbs each, plus 12 neutral orbs found in every game:

- **Life**: Suns make Habitable worlds grow at each end of cycle.
- **Void**: black holes and dead planets. Every collapse feeds the others.
- **Reverse**: the world upside down. Rebirth, Toxic and swapped stats.
- **Blaze**: lava and red stars. Damage before the very first blow.
- **Ice**: shields of ice, and strength when they shatter.
- **Storm**: gas giants. Flurry, and attack that rises with every hit.
- **Mineral**: rock Bulwarks that pile up hit points.
- **Machine**: probes and stations that dock with one another.
- **Moons**: satellites that strengthen their neighbors. Order matters.
- **Comets**: they grow when you refresh the Creation and reward selling.
- **Crystal**: resonance. Each Crystal played strengthens the others.
- **Anomalies**: chaos. Random orbs, discoveries and unexpected keywords.
- **Nebulae**: gas clouds that drain enemy life and steal the orbs they have met.

**144 orbs**, including **15 legendaries**. A legendary exists in a single copy per game, and it rarely
shows up: Primordia, Ouroboros, Eye of the Void, Maelstrom, Great Attractor, Omega, Blood Moon, Pangaea,
Oumuamua, Betelgeuse, Absolute Prism, Absolute Zero, Matrioshka Brain, Naked Singularity, Pillars of
Creation.

**16 laws**: one per family (Symbiosis, Entropy, Reversal, Combustion, Stasis, Winds, Gravity, Tides,
Passage, Resonance, Chaos, the Siphon, Engineering), plus three neutral life laws that play with your
starting HP: Sacrifice, Endurance and the Phoenix.

**11 cosmic events**, one per game: Meteor Shower, Abundance, Fertile Creation, Cosmic Recycling,
Expansion, Revelation, Age of Legends, Solar Wind, Aurora, Spring Tide, Instability.

**12 relics**: Treasure, Spyglass, Trading Post, Momentum, Banner, Spearhead, Bastion, Reserve, Aegis,
Sting, Star Ember, Alchemy.

**11 keywords**: Bulwark, Shield, Flurry, Mega-flurry, Rebirth, Toxic, Docking, Lifesteal, Range, Breach,
Guard.

The **Codex** collects every orb you meet, along with all the laws, relics and events.


### Modes

- **Duel**: 1 vs 1 against the AI, the heart of the game. 60 HP each.
- **Melee**: you against 7 rival universes.
- **Daily Challenge**: the same duel for everyone that day. Same families, same three laws offered, same
  rival, same event. One attempt, a score, and a daily leaderboard when you are signed in.
- **Daily missions**: three goals every day (easy, medium, hard), rewarded with stardust.


### Online

Sign in from your profile to play online:

- **Find a game**: a ranked duel or an 8-player melee. If the table isn’t full after 40 seconds, rival
  universes (bots) take the empty seats.
- **Play with friends**: add friends with their friend code, challenge them to a duel, or set up a
  private melee for up to 8 and add bots if you like. Games with at least 2 human players count for
  ranked.
- **Ranked**: 5 placement games, then 9 ranks: Dust, Asteroid, Moon, Planet, Giant, Star, Nebula, Pulsar
  and Singularity, with divisions III, II and I. Each rank has its own pixel emblem.
- **Also**: free chat with a profanity filter, spectating once you are knocked out, and rejoining an
  online game in progress if you get disconnected.
- **Cloud save**: your progress follows you to another device.

### Progression

- **Creator level.** Every finished game earns experience. Each new level gives 25 stardust.
- **My planet.** The planet turning behind the menu is yours. It starts dead and black. At the Star
  Market, spend stardust on 25 upgrades across four eras (Awakening, Water, Life, Green Civilization),
  each one tied to a creator level, until it becomes a New Earth. Along the way, you can visit it: spin
  the globe, zoom in, and land to found up to three colonies.
- **My system.** Buy and upgrade the whole solar system around your planet, from a red Sun to Pluto.
  Your friends can visit it.
- **Creation.** Once your planet reaches the Green Civilization, a new mode opens: forge worlds, build a
  colony in real time, send a rover on expeditions.
- **Cosmetics.** 6 animated game backgrounds, 11 profile frames, profile pictures, and 8 pixel fonts
  for your name. Other players see them online.
- **102 achievements.**

### Play anywhere

- In your browser, on phone or PC. Touch or mouse.
- On a phone, the game is made for portrait mode. On a PC, it switches to a wide layout.
- 5 languages: English, French, Spanish, German and Portuguese. ORBITE picks your device’s language on
  first launch; change it any time in Settings.
- The solo modes need no account.
- ORBITE is also an installable web app. Open it at https://edd-ai.github.io/ARECIBO/orbite/ and add
  it to your home screen: it then runs full screen, even offline.

### Pre-alpha

ORBITE is in pre-alpha: a playable prototype under construction. Balance, content and visuals may
change from one version to the next, and you may run into bugs.

**Found a bug?** Tap the round **?** button at the bottom of the screen, in the menu or during a game.
Describe the problem, add a screenshot if you like, and send. No account needed: your message goes
straight to the ORBITE team. The form lists the technical details sent with it (version, screen,
device, language, recent errors, a summary of the current game, your nickname). Offline? The report
waits on your device and goes out on its own later.

You can also leave a comment below.

### Credits

**Team**
- Direction: Studio EDDA
- Design: Corentin Flatres
- Sound design: Victor Desrat
- Composer: Victor Desrat

**Music and sound**
- Archives: Music, ambiences and sounds from ARECIBO // Salvage Protocol
- Menu themes: “Distant Earth”, “Orbiting Wonder” · Victor Desrat
- Sound effects: Kenney · kenney.nl · CC0, MIT

**Technology**
- Planets: ORBITE planet engine, pixel art computed live (WebGL2)
- Font: Chakra Petch · Cadson Demak · SIL Open Font License

**Licenses**: Interface Sounds and UI Audio (CC0), sounds from the FPS and 3D Platformer Starter Kits
(CC0) and the City Builder Starter Kit (MIT license). Copies taken from Hugo Locurcio’s ports. SIL Open
Font License, bundled with the game. The full MIT notice is in the game: Settings, Credits, Licenses.

---

## FRANÇAIS

**Composez le système solaire le plus puissant de l’univers.**

ORBITE est un auto-battler cosmique en pixel art. Achetez des astres (planètes, lunes, comètes, étoiles,
trous noirs), placez-les sur deux rangées, formez des familles, choisissez une loi, et regardez votre
système affronter les systèmes rivaux, cycle après cycle. Le dernier debout gagne.

Gratuit, dans votre navigateur, sur téléphone ou sur PC.


### Comment jouer




1. **Choisissez une loi.** Trois lois vous sont proposées au départ. Chacune oriente votre partie et
   vous donne votre premier astre.
2. **Achetez des astres** dans la Création, là où naissent les astres. Un astre coûte 3 énergies. Vous
   en avez 3 au premier cycle, une de plus à chaque cycle, jusqu’à 10. Actualisez l’offre pour 1,
   gelez-la gratuitement, ou montez la Création de niveau pour atteindre des astres plus puissants.
3. **Placez-les sur deux rangées.** L’avant attaque et encaisse. L’arrière reste à l’abri et avance
   quand l’avant est tombé. Chaque astre de l’avant frappe l’ennemi en face de lui : aucune cible au
   hasard, c’est le placement qui décide.
4. **Formez des familles, ou mélangez-les.** Deux astres ou plus d’une même famille dans la même
   rangée forment une formation (niveaux I et II). Chaque famille a un bonus à l’avant et un autre à
   l’arrière. Trois familles différentes dans une rangée forment un **Mélange**, certains astres ont deux
   familles, et des combos de placement relient les familles (la Glace devant un Brasier : Vapeur…).
5. **Fusionnez.** Trois copies d’un même astre fusionnent en un **astre doré** : statistiques et effets
   doublés, et vous choisissez un astre parmi trois du niveau supérieur.
6. **Laissez-les combattre.** Le combat se joue tout seul. En duel, le premier univers à 0 PV perd. En
   mêlée, le dernier debout gagne.

Votre premier duel est guidé pas à pas.

### Ce qui rend ORBITE unique

- **Le placement décide de tout.** Les rangées comptent, les colonnes aussi. Les astres à **Portée**
  tirent depuis l’arrière, ceux à **Percée** frappent l’arrière ennemi, la **Garde** bloque la Percée.
- **13 phénomènes.** Certains placements transforment un astre au début du combat. Deux astres du
  Néant l’un derrière l’autre : un trou noir. Deux du Brasier : une supernova. Une Lune devant un
  Soleil : une éclipse.
- **Aucune partie ne se ressemble.** Chaque partie tire 5 des 13 familles (1 287 combinaisons) et un
  événement cosmique parmi 11. Aux cycles 4 et 8, vous choisissez une relique. Au cycle 6, chaque loi
  s’éveille et devient plus forte.
- **Une réserve partagée.** Tout le monde achète dans le même stock de copies. Si un rival joue votre
  famille, vos astres se raréfient.
- **Chaque astre est dessiné en direct.** Le moteur de planètes du jeu peint chaque astre en pixel art,
  en temps réel : géantes gazeuses, planètes brisées, comètes et leur queue, anneaux-mondes, nébuleuses
  de gaz qui dérive.


### Familles et contenu

**13 familles**, de 9 astres chacune, plus 12 astres neutres présents dans toutes les parties :

- **Vie** : les Soleils font grandir les mondes Habitables à chaque fin de cycle.
- **Néant** : trous noirs et planètes mortes. Chaque effondrement nourrit les autres.
- **Envers** : le monde à l’envers. Renaissance, Toxique et inversion des statistiques.
- **Brasier** : lave et étoiles rouges. Des dégâts avant même le premier coup.
- **Glace** : boucliers de glace, et de la force quand ils se brisent.
- **Tempête** : géantes gazeuses. Rafale, et une attaque qui monte à chaque coup.
- **Minéral** : remparts de roche qui accumulent les points de vie.
- **Machine** : sondes et stations qui s’arriment les unes aux autres.
- **Lunes** : des satellites qui renforcent leurs voisins. L’ordre compte.
- **Comètes** : elles grandissent quand vous actualisez la Création et récompensent la vente.
- **Cristal** : résonance. Chaque Cristal joué renforce les autres.
- **Anomalies** : le chaos. Astres aléatoires, découvertes et mots-clés imprévus.
- **Nébuleuses** : des nuages de gaz qui aspirent la vie des ennemis et volent les astres qu’ils ont
  croisés.

**144 astres**, dont **15 légendaires**. Une légendaire n’existe qu’en un seul exemplaire par partie, et
elle se montre rarement : Primordia, Ouroboros, Œil du Vide, Maelström, Grand Attracteur, Oméga, Lune de
sang, Pangée, Oumuamua, Bételgeuse, Prisme absolu, Zéro absolu, Cerveau Matriochka, Singularité nue,
Piliers de la Création.

**16 lois** : une par famille (symbiose, entropie, renversement, combustion, stase, vents, gravité,
marées, passage, résonance, chaos, siphon, ingénierie), plus trois lois de vie neutres qui jouent sur vos
PV de départ : sacrifice, endurance et phénix.

**11 événements cosmiques**, un par partie : Pluie de météores, Abondance, Création féconde, Recyclage
cosmique, Expansion, Révélation, Ère des légendes, Vent solaire, Aurore, Grande marée, Instabilité.

**12 reliques** : Trésor, Longue-vue, Comptoir, Élan, Bannière, Fer de lance, Bastion, Réserve, Égide,
Dard, Braise d’étoile, Alchimie.

**11 mots-clés** : Rempart, Bouclier, Rafale, Méga-rafale, Renaissance, Toxique, Arrimage, Vol de vie,
Portée, Percée, Garde.

Le **Codex** rassemble chaque astre croisé en partie, avec toutes les lois, les reliques et les
événements.


### Modes

- **Duel** : 1 contre 1 face à l’IA, le cœur du jeu. 60 PV chacun.
- **Mêlée** : vous contre 7 univers rivaux.
- **Défi du jour** : le même duel pour tout le monde ce jour-là. Mêmes familles, mêmes trois lois
  proposées, même rival, même événement. Une seule tentative, un score, et un classement du jour si
  vous êtes connecté.
- **Missions du jour** : trois objectifs chaque jour (facile, moyen, difficile), récompensés en
  poussières d’étoiles.


### En ligne

Connectez-vous depuis votre profil pour jouer en ligne :

- **Trouver une partie** : un duel ou une mêlée à 8, en classé. Si la table n’est pas pleine au bout de
  40 secondes, des univers rivaux (des bots) prennent les places libres.
- **Entre amis** : ajoutez vos amis avec leur code ami, défiez-les en duel, ou créez une mêlée privée
  jusqu’à 8, avec des bots si vous voulez. Les parties à 2 joueurs humains ou plus comptent pour le
  classé.
- **Classé** : 5 parties de placement, puis 9 rangs : Poussière, Astéroïde, Lune, Planète, Géante,
  Étoile, Nébuleuse, Pulsar et Singularité, avec les divisions III, II et I. Chaque rang a son emblème
  en pixels.
- **Et aussi** : une discussion libre avec filtre des grossièretés, le mode spectateur une fois éliminé,
  et une partie en ligne qui se rejoint si vous êtes déconnecté.
- **Sauvegarde en ligne** : votre progression vous suit sur un autre appareil.

### Progression

- **Niveau du créateur.** Chaque partie terminée rapporte de l’expérience. Chaque niveau offre 25
  poussières d’étoiles.
- **Ma planète.** La planète qui tourne derrière le menu est la vôtre. Au départ, elle est morte et
  noire. Au Marché stellaire, vos poussières d’étoiles achètent 25 améliorations en quatre ères (Réveil,
  Eau, Vie, Civilisation verte), chacune liée à un niveau de créateur, jusqu’à la Terre nouvelle. En
  chemin, vous pourrez la visiter : faire tourner le globe, zoomer, et atterrir pour fonder jusqu’à
  trois colonies.
- **Mon système.** Achetez et améliorez tout le système solaire autour de votre planète, du Soleil
  rouge à Pluton. Vos amis peuvent le visiter.
- **Création.** Quand votre planète atteint la Civilisation verte, un nouveau mode s’ouvre : forger
  des mondes, bâtir une colonie en temps réel, envoyer un rover en expédition.
- **Cosmétiques.** 6 fonds animés de partie, 11 cadres de profil, des photos de profil et 8 polices
  pixel pour votre pseudo. Les autres joueurs les voient en ligne.
- **102 succès.**

### Jouer partout

- Dans votre navigateur, sur téléphone ou sur PC. Au doigt ou à la souris.
- Sur téléphone, le jeu est pensé en portrait. Sur PC, il passe en écran large.
- 5 langues : français, anglais, espagnol, allemand et portugais. ORBITE prend la langue de votre
  appareil au premier lancement ; elle se change à tout moment dans les Paramètres.
- Les modes solo ne demandent aucun compte.
- ORBITE est aussi une application web installable. Ouvrez-la à l’adresse
  https://edd-ai.github.io/ARECIBO/orbite/ et ajoutez-la à votre écran d’accueil : elle se lance
  alors en plein écran, même hors ligne.

### Pré-alpha

ORBITE est en pré-alpha : un prototype jouable en construction. L’équilibre, le contenu et les visuels
peuvent changer d’une version à l’autre, et vous croiserez peut-être des bugs.

**Un bug ?** Touchez le bouton rond **?** en bas de l’écran, au menu ou en partie. Décrivez le problème,
ajoutez une capture si vous voulez, et envoyez. Pas besoin de compte : votre message part directement à
l’équipe d’ORBITE. La fiche liste ce qui l’accompagne (version, écran, appareil, langue, dernières
erreurs, résumé de la partie en cours, pseudo). Hors ligne ? Le rapport attend sur votre appareil et
part tout seul plus tard.

Vous pouvez aussi laisser un commentaire ci-dessous.

### Crédits

**Équipe**
- Direction : Studio EDDA
- Design : Corentin Flatres
- Sound design : Victor Desrat
- Compositeur : Victor Desrat

**Musique et son**
- Archives : Musiques, nappes et sons d’ARECIBO // Salvage Protocol
- Thèmes du menu : « Distant Earth », « Orbiting Wonder » · Victor Desrat
- Bruitages : Kenney · kenney.nl · CC0, MIT

**Technique**
- Planètes : Moteur de planètes d’ORBITE, pixel art calculé en direct (WebGL2)
- Police : Chakra Petch · Cadson Demak · SIL Open Font License

**Licences** : Interface Sounds et UI Audio (CC0), sons des Starter Kits FPS et 3D Platformer (CC0) et du
Starter Kit City Builder (licence MIT). Copies issues des portages de Hugo Locurcio. SIL Open Font
License, embarquée dans le jeu. L’avis MIT complet est dans le jeu : Paramètres, Crédits, Licences.

<!-- FIN de la description à copier -->

**Phrase de remplacement sans le lien vers la version web** (à mettre à la place de la dernière puce
de « Play anywhere » / « Jouer partout ») :
- EN : `Your progress is saved on your device. Sign in to keep it online too.`
- FR : `Votre progression est gardée sur votre appareil. Connectez-vous pour la garder aussi en ligne.`

---

## 3. Premier devlog (annonce)

### English

**Title:** `ORBITE is now on itch.io`

ORBITE is a cosmic auto-battler in pixel art, and you can now play it right here, free, in your browser.

The idea is simple. Buy orbs (planets, moons, comets, stars, black holes), place them on two rows, and
let your system fight. The front row attacks the enemy facing it; the back row waits its turn. Two orbs
of the same family in the same row form a formation. Three copies of an orb fuse into a golden one. Last
one standing wins.

**In this version:**
- 13 families and 144 orbs, including 15 legendaries
- 16 laws, 11 cosmic events, 12 relics
- Duel and 8-player melee against the AI, a daily challenge and daily missions
- Online play with friends, and ranked games with 9 ranks
- 5 languages: English, French, Spanish, German, Portuguese

ORBITE is in pre-alpha, so expect rough edges. If something goes wrong, tap the round **?** button at
the bottom of the screen: your report comes straight to us.

Thanks for playing!
Studio EDDA

### Français

**Titre :** `ORBITE arrive sur itch.io`

ORBITE est un auto-battler cosmique en pixel art, et il se joue maintenant ici, gratuitement, dans votre
navigateur.

L’idée est simple. Achetez des astres (planètes, lunes, comètes, étoiles, trous noirs), placez-les sur
deux rangées, et laissez votre système combattre. L’avant attaque l’ennemi en face ; l’arrière attend
son tour. Deux astres d’une même famille dans la même rangée forment une formation. Trois copies d’un
astre fusionnent en un astre doré. Le dernier debout gagne.

**Dans cette version :**
- 13 familles et 144 astres, dont 15 légendaires
- 16 lois, 11 événements cosmiques, 12 reliques
- Duel et mêlée à 8 contre l’IA, défi du jour et missions du jour
- Parties en ligne entre amis, et classé en 9 rangs
- 5 langues : français, anglais, espagnol, allemand, portugais

ORBITE est en pré-alpha : tout n’est pas encore poli. Si quelque chose ne va pas, touchez le bouton rond
**?** en bas de l’écran : votre rapport nous arrive directement.

Merci de jouer !
Studio EDDA

---

## 4. À vérifier avant de publier (toi)

Rien de tout cela n’a pu être testé d’ici : le réseau du conteneur bloque itch.io et le SDK Firebase.

1. **Le mode en ligne sur itch.io.** Sur itch.io, le jeu tourne dans un cadre servi par
   `html-classic.itch.zone` (ou `html.itch.zone`). La connexion Google passe par Firebase Authentication,
   qui n’accepte que les domaines autorisés : dans la console Firebase, Authentication, Paramètres,
   **Domaines autorisés**, ajoute `html-classic.itch.zone` et `html.itch.zone`. Laisse décochée la case
   « SharedArrayBuffer » d’itch.io (elle couperait la fenêtre de connexion). Puis teste la connexion sur
   la page en brouillon. Si elle ne marche pas, retire de la description la partie **Online / En ligne**,
   les mots « when you are signed in / si vous êtes connecté » du défi du jour, et la ligne « Online
   play… / Parties en ligne… » du devlog.
2. **Les bugs signalés.** Ils partent dans Firebase, avec les règles Firestore que tu as déjà publiées.
   Si tu modifies un jour les règles, garde la partie des rapports.
3. **La sauvegarde.** Les joueurs d’itch.io auront une progression séparée de celle de la version web :
   le navigateur range les données par adresse. La sauvegarde en ligne (connexion) relie les deux.
4. **La boutique de graines.** Le jeu montre des paquets de graines de vie avec des prix, et annonce que
   l’achat arrive dans une prochaine version (rien n’est encaissé aujourd’hui). La page n’en parle pas ;
   à toi de voir si tu veux le préciser.
5. **Les commentaires.** Active-les (Community) si tu gardes « You can also leave a comment below ».
6. **Crédits.** L’écran des crédits du jeu ne nomme pas les 8 polices pixel des pseudos (Press Start 2P,
   VT323, Silkscreen, Pixelify Sans, Jersey 10, Tiny5, Doto, Workbench ; SIL OFL, détail dans
   `fonts/PIXEL-FONTS.txt`). La page reprend l’écran des crédits tel quel ; leurs licences voyagent avec
   le jeu (`fonts/OFL.txt`).

---

## Annexe : d’où viennent les chiffres (vérifiés le 3 novembre 2026, version 140)

- 13 familles : `FAMILY_KEYS` dans `js/rules.js` ; noms et phrases d’identité : `FAMILIES` (anglais :
  `js/lang/regles.js`).
- 144 astres = 13 × 9 + 12 neutres + 15 légendaires : `CARDS` dans `js/rules.js`, sans les 2 jetons
  (`token`) ; c’est aussi le compteur du Codex (`codexCards` dans `js/game.js`).
- 15 légendaires (`legend: true`), un seul exemplaire par partie : `newGame` (`state.pool[c.id] = 1`).
- 5 familles par partie : `ACTIVE_FAMILIES` ; 1 287 = combinaisons de 5 parmi 13.
- 16 lois, 3 proposées, lois de vie (`hp`) : `LAWS` ; éveil au cycle 6 : `AWAKE_ROUND`.
- 11 événements : `EVENTS` ; 12 reliques aux cycles 4 et 8 : `RELICS`, `RELIC_ROUNDS`.
- 13 phénomènes : `PHENOMENA` ; 11 mots-clés : `KEYWORDS` (dont Portée, Percée, Garde : `POSITION_KW`).
- Coûts : `BUY_COST` 3, `ROLL_COST` 1 ; énergie `min(10, cycle + 2)` (`MAX_GOLD`) ; vente `sellGain`.
- Deux rangées de 4 : `ROW_MAX` ; formation dès 2 astres : `FORM_MIN`, niveaux I et II : `FORM_LVL_MAX` ; Mélange dès 3 familles : `MIX_MIN` ; 7 astres à deux familles : `fam2`.
- Doré : trois copies, statistiques doublées (`makeUnit`), découverte au niveau supérieur (`dtier`),
  3 choix (4 avec Révélation) : `openDiscover`.
- Duel à 60 PV : `START_HP` 30 × `DUEL.hp` 2 ; mêlée à 8 : `PLAYERS`.
- Menus Solo (Duel, Mêlée contre 7 univers, Défi du jour) : `index.html` ; libellés anglais :
  `js/lang/`.
- Défi du jour, missions du jour (3 par jour) : `README.md`, `js/missions.js`.
- En ligne : bots après 40 s (`WAIT_MS`, `js/multi.js`) ; classé : 5 placements, 9 rangs, divisions
  III à I (`PLACEMENTS`, `TIERS`, `DIVS` dans `js/classement.js`).
- 25 poussières par niveau : `LEVEL_GIFT` (`js/game.js`) ; 25 améliorations de la planète, 4 ères,
  dernière au niveau 120 : `js/world.js`.
- Mon système : 10 astres, du Soleil à Pluton : `BODIES` (`js/systeme.js`).
- Cosmétiques : 6 fonds animés (`SKIES`), 11 cadres (`FRAMES`), 8 polices (`FONTS`), photos de profil
  (`AVATARS`) : `js/game.js`.
- 102 succès : `S.LIST` (`js/succes.js`, test `tests/succes.test.mjs`).
- 5 langues : `LANGS` dans `js/i18n.js`.
- Crédits : `creditsLines` et `openCredits` dans `js/game.js`, lus à l’écran en anglais et en français.
- Bouton « ? » et ce qui accompagne un rapport : `js/rapports.js`, `README.md` (Signaler un bug, v121).
