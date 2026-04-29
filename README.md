# ARECIBO

Prototype navigateur de jeu narratif multijoueur SF pour Studio EDDA.

Le projet est maintenant dans une phase de **reboot propre** :
- on garde le **menu**
- on garde les **settings**
- on garde l'**intro**
- on garde la **DA / l'audio / les overlays**
- on reconstruit le coeur du jeu autour du nouvel ecran **MOTOMOTO**

## Etat actuel

Flow actif :

`Menu -> Intro -> Ecran MOTOMOTO -> Carte role -> Nouvelle boucle de jeu`

Pages encore utiles :
- `arecibo_menu.html` : menu principal
- `arecibo_intro.html` : intro textuelle + boot
- `arecibo_motomoto_screen.html` : nouvel ecran principal de partie
- `arecibo_role_card_preview.html` : preview / direction visuelle des cartes role
- `arecibo_lobby.html` : connexion / code de session
- `arecibo_settings.html` : page settings standalone

Pages legacy conservees comme reference visuelle / technique :
- `arecibo_game.html`
- `arecibo_game2.html`
- `arecibo_creation.html`
- `arecibo_minigame_defense.html`
- `arecibo_minigame_scan_operator.html`
- `arecibo_minigame_scan_partner.html`

Ces fichiers legacy ne sont pas la base du nouveau jeu. On les garde seulement comme banque d'idees ou de composants.

## Structure utile

### Pages
- `arecibo_menu.html`
- `arecibo_intro.html`
- `arecibo_lobby.html`
- `arecibo_motomoto_screen.html`
- `arecibo_role_card_preview.html`
- `arecibo_settings.html`

### Scripts partages
- `assets/theme-audio.js` : musique, ambiances, hover/click/start
- `assets/visual-settings.js` : etat du filtre pixel
- `assets/player-profile.js` : profil joueur

### Styles partagés
- `assets/terminal-filter.css`
- `assets/ingame-settings.css`

### Repertoires principaux
- `assets/audio/` : musiques, ambiances, effets
- `assets/backgrounds/` : fonds menu
- `assets/css/` : styles specifiques de pages/scenes
- `assets/js/` : logique specifique de pages/scenes
- `assets/animals/` : tetes / avatars
- `assets/black-hole-main/` : module trou noir du menu

## Convention de travail

Pour garder le repo lisible :
- tout nouveau systeme de jeu va dans une page / scene clairement nommee
- les nouveaux assets doivent aller dans un dossier explicite
- les prototypes temporaires doivent etre documentes ou supprimes vite
- les fichiers de test locaux ne doivent pas finir dans Git
- les textes visibles par le joueur doivent garder leurs accents

## Documentation

Voir aussi :
- [docs/PROJECT_STRUCTURE.md](C:\Users\Coco\Documents\Codex\ARECIBO-git\docs\PROJECT_STRUCTURE.md)

## Notes

Le nouveau jeu vise un format :
- navigateur
- multi joueur
- communication parallele sur Discord
- distribution automatique de roles
- arbitrage 100% gere par le jeu
