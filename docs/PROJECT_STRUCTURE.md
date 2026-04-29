# ARECIBO - Structure projet

## 1. Ce qu'on edite en priorite

### Menu / entree
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\arecibo_menu.html`
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\arecibo_intro.html`
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\arecibo_lobby.html`

### Nouvelle base de partie
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\arecibo_motomoto_screen.html`
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\assets\css\arecibo-motomoto-screen.css`
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\assets\js\arecibo-motomoto-screen.js`

### Systemes partages
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\assets\theme-audio.js`
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\assets\visual-settings.js`
- `C:\Users\Coco\Documents\Codex\ARECIBO-git\assets\terminal-filter.css`

## 2. Répertoires assets

### Audio
- `assets/audio/music/`
- `assets/audio/ambience/`
- `assets/audio/effects/`

### UI / decors
- `assets/backgrounds/`
- `assets/animals/`
- `assets/multiplayer/`

### Scenes / gameplay legacy
- `assets/debris-scene/`
- `assets/debris-loot/`
- `assets/sas-repair/`
- `assets/carnets/`
- `assets/toolbox/`
- `assets/boite-a-outil/`
- `assets/expedition-result/`

## 3. Legacy / archives techniques

Ces fichiers existent encore mais ne doivent plus etre la base du nouveau jeu :
- `arecibo_game.html`
- `arecibo_game2.html`
- `arecibo_creation.html`
- `arecibo_minigame_defense.html`
- `arecibo_minigame_scan_operator.html`
- `arecibo_minigame_scan_partner.html`
- `assets/js/arecibo-game.js`
- `assets/js/arecibo-debris-overlays.js`
- `assets/css/arecibo-game.css`
- `assets/css/arecibo-expedition.css`

## 4. Problemes de structure encore presents

### Doublons / noms a surveiller
- `assets/toolbox/` et `assets/boite-a-outil/`
- plusieurs PNG "motomoto" a bien garder coherents
- plusieurs scenes legacy encore a la racine

### A nettoyer plus tard
- regrouper les scenes legacy dans un dossier `legacy/`
- renommer certains assets en anglais coherent ou francais coherent, mais pas les deux melanges
- unifier les conventions de nommage :
  - soit `kebab-case`
  - soit prefixes de scene

## 5. Règle pratique

Quand on ajoute quelque chose :
- un nouvel ecran => 1 HTML clair
- sa logique => 1 JS dedie
- son style => 1 CSS dedie
- ses assets => 1 dossier explicite si besoin
- les textes de jeu / UI FR doivent garder leurs accents

Objectif : retrouver un systeme en moins de 10 secondes sans relire tout le repo.
