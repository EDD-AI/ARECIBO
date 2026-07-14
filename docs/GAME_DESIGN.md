# ARECIBO — Document de design

> Statut : draft de travail (juillet 2026). Ce document fige la vision du reboot
> autour de l'écran MOTOMOTO. Les sections marquées `[OUVERT]` restent à trancher.

## 1. Pitch

Un équipage d'animaux survivants doit tenir **25 minutes** à bord du vaisseau
MOTOMOTO, en route vers ARECIBO. Des événements tombent en continu ; chaque
joueur n'en voit qu'une partie sur son propre écran. Il faut parler (Discord)
pour reconstituer la vérité — et le Capitaine tranche, toujours.

Parfois, un joueur est **infecté par un alien** en cours de partie. Il doit le
cacher, et sa condition de victoire bascule : gagner en tant que xénomorphe.
Mais l'infection n'est pas systématique : le doute existe même quand tout le
monde est sain.

**Ce n'est pas un Loup-Garou** : pas de traître à la distribution. La paranoïa
naît en cours de partie, façon *The Thing* — celui qui ment était sincèrement
votre allié il y a cinq minutes.

## 2. Ton et lore

Triangle de références : **Zathura × Alien × Les Gardiens de la Galaxie.**

- **Zathura** — les événements comme des cartes tirées par le jeu lui-même :
  absurdes, implacables, on subit et on s'adapte. Le vaisseau est embarqué dans
  quelque chose qui le dépasse.
- **Alien** — la tension : le vaisseau qui craque, les sas, l'infection, le
  doute sur qui est encore « lui-même ».
- **Les Gardiens de la Galaxie** — l'équipage de bras cassés attachants,
  l'humour qui désamorce. C'est un jeu entre amis, pas un survival horror.

Principe d'écriture : des **références pop culture assumées** mais une
**identité propre** — les refs sont des clins d'œil dans les textes
d'événements, jamais le squelette du jeu. Textes joueur en français, avec
accents.

## 3. Le triangle d'information

Chaque rôle détient un axe de la décision. Personne ne peut jouer seul.

| Rôle | Ce qu'il voit | Ce qu'il ignore |
|---|---|---|
| **CAPITAINE** | Les événements et leurs options (le QUOI) | Où on est, l'état réel du vaisseau |
| **TIMONIER** | Les routes et directions possibles (le OÙ) | Le coût des options, l'état du vaisseau |
| **MATELOT** | L'état réel du vaisseau : coque, carburant, systèmes (le COMBIEN) | Les options, les routes ; aucun pouvoir de décision |

- Le Capitaine a tout le pouvoir et aucune information directe.
- Le Matelot a l'information vitale et aucun pouvoir.
- Le Timonier est le pivot spatial : sans lui, on choisit à l'aveugle.

À 4+ joueurs : plusieurs Matelots, chacun pouvant surveiller un sous-système
différent (coque / carburant / signal). `[OUVERT]` répartition exacte.

## 4. Boucle de jeu

1. Un **événement** tombe (avarie, débris, signal, ressource à récupérer…).
2. Chaque joueur reçoit **sa** version de l'info sur son écran.
3. Discussion libre sur Discord — le timer tourne, les jauges bougent.
4. Le **Capitaine tranche** parmi 2-3 options sur son écran.
5. Conséquences sur le vaisseau (coque / carburant / signal) — et parfois, en
   secret, un joueur exposé est **infecté**.
6. Retour en 1, jusqu'à 25:00.

Les jauges de la console centrale (coque, carburant, signal) sont le vrai
« score » de la partie.

## 5. L'infection

- L'infection survient **en cours de partie**, liée à une exposition : sortie
  en sas, contact avec un débris, événement particulier. Jamais à la
  distribution des rôles.
- Le joueur infecté **garde son poste et ses écrans**, mais sa condition de
  victoire bascule : faire tomber le vaisseau ou l'équipage.
- Son arme principale : **l'information qu'il est seul à voir**. Un Matelot
  infecté ment sur l'état du vaisseau, un Timonier infecté guide vers le
  danger, un Capitaine infecté choisit « mal » en toute plausibilité.
- Toutes les parties ne contiennent pas d'infection. Le groupe ne sait jamais
  s'il y a un xénomorphe à bord.

Les sas latéraux de l'écran MOTOMOTO sont le vecteur d'infection naturel :
sortir est parfois nécessaire (ressources, réparations), et celui qui sort
*pourrait* revenir changé. Personne ne sait ce qui s'est passé dehors, sauf lui.

## 6. Conditions de victoire

- **Équipage** : tenir jusqu'à 25:00 (et neutraliser le xénomorphe s'il y en a un).
- **Xénomorphe** : faire tomber le vaisseau (jauge critique) ou l'équipage
  avant la fin du timer.
- La **destitution du Capitaine** existe (déjà sur la carte de rôle) :
  l'équipage peut renverser un Capitaine qui a perdu sa confiance.
  `[OUVERT]` mécanique exacte (vote ? coût ?).

## 7. Questions ouvertes

1. `[OUVERT]` **Actions concrètes du xénomorphe** — mentir ne suffit pas.
   Pistes : fausser discrètement les infos affichées aux autres, aggraver en
   secret les conséquences d'un choix, infecter un deuxième joueur. À
   équilibrer pour ne pas devenir un Among Us (pas de kill direct ?).
2. `[OUVERT]` **Détection / test** — il faut un moyen coûteux de tester un
   joueur (scan médical qui consomme du carburant ? immobilise un poste 60 s ?).
   Un test gratuit tue le doute ; aucun test rend l'équipage impuissant.
3. `[OUVERT]` **Joueur éliminé / destitué** — éviter le spectateur qui s'ennuie
   15 minutes. Pistes : devient « conscience du vaisseau » avec infos à
   distiller, ou flotte dehors et communique par signaux dégradés.

## 7 bis. Interaction entre joueurs — le cœur du fun

Principe : **on ne parle que quand on se doit des choses.** Chaque
mécanique doit répondre à la question : « quelle phrase force-t-elle
à dire sur Discord ? »

1. **Un verbe par rôle** : les Matelots se déplacent physiquement dans
   les pièces (mini-jeux sur place — loin de son poste, on ne voit plus
   ses infos : savoir OU agir) ; le Timonier trace/exécute la route ;
   le Capitaine répartit l'énergie (moteurs/bouclier/signal — jamais
   assez pour tout, ses choix contraignent les actions des autres).
2. **L'information coûte** : codes à décoder à deux (l'un voit le code,
   l'autre a le manuel — façon Keep Talking) ; capteurs qui divergent
   par design → débats sincères où le xénomorphe peut se cacher.
3. **Enjeux personnels** : objectifs secrets innocents à chaque partie
   (finir avec du carburant en réserve, ouvrir le sas 2 fois, zéro
   éjection...) ; loot d'EVA privé (on déclare ce qu'on veut) ; jauges
   personnelles (O2, fatigue) et droit de refuser un ordre.
4. **Simultanéité** : deux incidents en même temps dans deux pièces →
   triage et délégation, les pics de conversation.
5. **Le xénomorphe laisse des traces** : sabotage avec indices
   physiques découvrables (fil coupé, porte entrouverte) → enquête
   spatiale et temporelle (« qui était en soute à la minute 4 ? »).

Ordre de prototypage : postes physiques + info au poste, puis
objectifs secrets + loot privé, puis double incident.

## 8. Exemples d'événements (ton à valider)

- **« Quelque chose a accroché la coque. »** Le Capitaine voit trois options
  (accélérer / couper les moteurs / envoyer quelqu'un voir). Le Matelot voit la
  coque perdre 2 % toutes les dix secondes. Le Timonier voit qu'un champ de
  débris arrive dans 40 secondes. Personne n'a le temps.
- **« Station-service orbitale abandonnée. »** Carburant gratuit… mais il faut
  ouvrir un sas et sortir. Qui y va ?
- **« Signal de détresse — ça ressemble à une voix connue. »** Répondre coûte
  du signal. Ignorer, personne ne saura jamais.

## 9. Rattachement technique

- Écran de jeu : `arecibo_motomoto_screen.html` + `assets/js/arecibo-motomoto-screen.js`
  + `assets/css/arecibo-motomoto-screen.css`
- Le timer 25:00, les rôles (CAPITAINE / TIMONIER / MATELOT), les cartes de
  rôle, les sas cliquables et l'overlay de fin existent déjà.
- Démo jouable solo : `arecibo_demo.html` + `assets/js/arecibo-demo.js`
  + `assets/css/arecibo-demo.css`. Le joueur est le Capitaine ; VEGA (Timonier),
  KESSEL et TILT (Matelots) sont simulés et transmettent leurs infos partielles
  dans un feed de comms. Moteur d'événements, infection, scan/éjection et
  fins multiples y sont implémentés en local (8 minutes par partie).
- À construire ensuite : le multijoueur réel (synchro entre écrans, un vrai
  joueur par rôle), en remplaçant l'équipage simulé par les autres joueurs.
