# Sons d’ORBITE

Les bruitages viennent de packs de **Kenney** ([kenney.nl](https://kenney.nl)), libres de droits ;
les musiques, nappes et sons d’interface d’ARECIBO sont de **Victor Desrat** (sound design et
composition), pour Studio EDDA (voir plus bas).
Ils ont été coupés, normalisés et encodés en MP3 mono (96 kbit/s ; 56 kbit/s pour le vent) avec
ffmpeg. `js/sfx.js` les joue avec un léger hasard de hauteur et de volume, une réverbération de
grotte et un placement gauche/droite selon la planète concernée.

| Fichier | Origine | Usage dans le jeu |
|---|---|---|
| `click1`–`click5` | Interface Sounds · click_002, click_003, click_005, select_001, select_002 | boutons : un déclic tiré au hasard, jamais deux fois le même de suite |
| `tap` | UI Audio · click3 | boutons, si les déclics ne sont pas encore chargés |
| `hover` | UI Audio · rollover2 | survol à la souris |
| `type` | Interface Sounds · tick_004 | sous-titres tapés |
| `back` | Interface Sounds · back_002 | vente |
| `error` | Interface Sounds · error_004 | action refusée |
| `drop1`–`drop3` | Interface Sounds · drop_002 à drop_004 | achat, gouttes de l’ambiance |
| `pluck1`, `pluck2` | Interface Sounds · pluck_001, pluck_002 | bonus, planète soulevée |
| `glass1`–`glass6` | Interface Sounds · glass_001 à glass_006 | carillons (niveau, doré, victoire), gel, bouclier, cristaux de l’ambiance |
| `confirm`, `down` | Interface Sounds · confirmation_004, minimize_008 | victoire, défaite |
| `scratch` | Interface Sounds · scratch_005 | toxique |
| `roll` | Interface Sounds · scroll_002 (0,55 s) | actualiser la taverne |
| `place1`–`place4` | Starter Kit City Builder · placement-a à d | planète posée, impacts, ouverture et fermeture des fiches (joués plus aigus) |
| `crumble1`–`crumble4` | Starter Kit City Builder · removal-a à d | vente, gros impacts, destruction |
| `break`, `coin` | Starter Kit 3D Platformer · break, coin | destruction, poussières gagnées |
| `blast` | Starter Kit FPS · enemy_destroy | éclat lointain |
| `rise` | Interface Sounds · glass_004, réverbéré puis inversé | lancement du jeu, renaissance |
| `wind` | Starter Kit City Builder · ambience, oiseaux retirés (passe-bas), descendue d’une quarte | ambiance |

## Sons d’ARECIBO (Victor Desrat)

Sound design et composition : **Victor Desrat**, pour ARECIBO // Salvage Protocol (Studio EDDA) (`assets/audio/` à la racine du dépôt), repris dans ORBITE (v69).
Encodés avec ffmpeg :
- musiques : volume ramené à −16 LUFS, MP3 stéréo 112 kbit/s ;
- nappes : −24 LUFS, MP3 stéréo 64 kbit/s, 32 kHz ;
- effets : MP3 mono 96 kbit/s ;
- l’alarme est réduite à ses 3 premières secondes, avec un fondu.

| Fichier | Origine | Usage dans le jeu |
|---|---|---|
| `arecibo1`, `arecibo2` | Main Title 1, Main Title 2 | musique des menus, en alternance avec « Distant Earth » et « Orbiting Wonder » |
| `space1` | SD_AMB_SPACE_01 | nappe de la partie (achats) |
| `space3` | SD_AMB_SPACE_03 | nappe du combat |
| `space2` | SD_AMB_SPACE_02 | écran de fin de partie |
| `ship1` | SD_AMB_SHIP_01 | réveil et récits (comme l’intro d’ARECIBO) |
| `ship2` | SD_AMB_SHIP_02 | Création (forge, colonies, exploration, système) |
| `ship3` | SD_AMB_SHIP_03 | Multijoueur (salons) |
| `ui-click` | SD_UI_CLICK | boutons |
| `ui-hover1`–`3` | SD_UI_HOVER_01 à 03 | survol à la souris |
| `ui-text` | SD_UI_TEXT | sous-titres tapés |
| `ui-start` | SD_UI_START | « Touchez pour commencer » |
| `ui-on`, `ui-off` | SD_UI_TurnON, SD_UI_TurnOFF | ouverture et fermeture des grands écrans (Marché, Création, Profil, Multijoueur) |
| `ui-wrong` | SD_UI_WRONG | action refusée |
| `jingle` | SD_Jingle_Moto | victoire (1re place ou duel gagné) |
| `alarm` | SD_AMB_ALARM (3 s) | vos PV passent sous le quart, une fois par partie |

Les nappes sont lues par deux éléments audio qui se relaient en fondu de 3 s avant la fin du fichier,
sans être décodées en mémoire (`js/sfx.js`, `setBed`). Les sons de Kenney restent les secours et
les bruitages du jeu (impacts, cristaux, gouttes…).

## Licences

- **Interface Sounds** et **UI Audio** (Kenney) : CC0 1.0, domaine public. Copies prises dans les
  portages Godot de Hugo Locurcio : `github.com/Calinou/kenney-interface-sounds` et
  `github.com/Calinou/kenney-ui-audio`.
- **Starter Kit FPS** et **Starter Kit 3D Platformer** (Kenney) : le README de chaque kit indique
  que ses effets sonores sont sous CC0 (`github.com/KenneyNL`).
- **Starter Kit City Builder** (Kenney) : le dépôt est publié sous licence MIT, dont voici
  l’avis requis :

```
MIT License

Copyright (c) 2025 Kenney

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Merci à Kenney : [kenney.nl](https://kenney.nl).

Les anciens sons d’ouverture et de fermeture (`open_002`, `close_002`) et `enemy_hurt` ont été retirés :
leur hauteur glissait vers le haut ou vers le bas, ce qui sonnait comme un laser. Les fiches s’ouvrent
désormais sur un petit caillou posé (parfois un tintement de cristal), et le souffle des attaques est
un bruit filtré synthétisé, différent à chaque fois.
