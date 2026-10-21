# Tester ORBITE

## Version à ouvrir sur ordinateur

Le fichier autonome `ORBITE.html` contient le jeu, les images, les polices et les traductions. Il n’a besoin ni d’installation, ni de serveur, ni de connexion pour jouer contre l’IA ou à plusieurs sur le même appareil.

1. Enregistrer `ORBITE.html` sur l’ordinateur, ou extraire l’archive `ORBITE-test.zip`.
2. Ouvrir ce fichier dans Chrome, Edge ou Firefox.
3. Cliquer sur **Jouer contre l’IA**. Les réglages permettent aussi de préparer une partie de deux à six participants.

Dans la version du site, le bouton **Jouer** du menu ORBITE mène au même écran. Le nouveau plateau ne propose pas encore de parties entre appareils.

## Les premiers coups

Sélectionner un de ses astres, puis une case éclairée pour préparer son déplacement. **Attaquer** affiche les cibles à portée ; **Défendre** augmente l’armure pour cette manche. Chaque astre reçoit un seul ordre, modifiable avant le verrouillage. Les astres n’attaquent pas automatiquement.

Pour renforcer son armée, acheter un astre dans la boutique, puis le placer sur une case de déploiement près de son étoile. L’énergie se renouvelle à chaque manche : elle ne s’accumule pas. Trois exemplaires ordinaires identiques fusionnent en un astre doré dans la réserve.

Cliquer sur **Verrouiller mes ordres** pour lancer la résolution. Les mouvements et les attaques se résolvent ensemble, puis les anneaux tournent. **Passer** termine uniquement l’animation ; les règles donnent le même résultat.

Pour marquer, prévoir la position **après la rotation** sur un relais doré : chaque relais occupé rapporte une influence. L’anneau intérieur avance à chaque manche ; le médian une manche sur deux ; l’extérieur reste fixe. Une position sur un relais avant la rotation ne garantit donc pas un point.

Le premier à dix influences gagne, ou la dernière étoile en vie. Une égalité est possible. Les positions, les blessures et les achats persistent entre les manches.

## Reprendre et jouer entre amis

Le bouton **Reprendre la partie** retrouve la partie enregistrée dans le même navigateur. En jeu à plusieurs sur un appareil, passer celui-ci au joueur indiqué par l’écran privé. Les astres déployés sont publics ; les réserves, boutiques et ordres adverses restent masqués pendant la préparation.

Les valeurs sont encore expérimentales. Pour les premiers retours, relever la graine de la partie, le nombre de joueurs, la manche et le choix qui semblait impossible à contrer ou difficile à comprendre.

## Recréer le fichier autonome

Depuis la racine du dépôt :

```sh
node orbite/tools/export-plateau.js /chemin/de/sortie/ORBITE.html
```

Le moteur source reste dans `js/plateau.js` ; l’export ne modifie pas les pages du projet. Les règles détaillées sont dans [PLATEAU.md](PLATEAU.md).
