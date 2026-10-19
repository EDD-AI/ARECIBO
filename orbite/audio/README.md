# Sons d’ORBITE

Tous les sons viennent de packs de **Kenney** ([kenney.nl](https://kenney.nl)), libres de droits.
Ils ont été coupés, normalisés et encodés en MP3 mono (96 kbit/s ; 56 kbit/s pour le vent) avec
ffmpeg. `js/sfx.js` les joue avec un léger hasard de hauteur et de volume, une réverbération de
grotte et un placement gauche/droite selon la planète concernée.

| Fichier | Origine | Usage dans le jeu |
|---|---|---|
| `click1`–`click5` | Interface Sounds · click_002, click_003, click_005, select_001, select_002 | boutons : un déclic tiré au hasard, jamais deux fois le même de suite |
| `tap` | UI Audio · click3 | boutons, si les déclics ne sont pas encore chargés |
| `hover` | UI Audio · rollover2 | survol à la souris |
| `type` | Interface Sounds · tick_004 | sous-titres tapés |
| `open`, `close`, `back` | Interface Sounds · open_002, close_002, back_002 | feuilles, vente, souffle des attaques (`open` ralenti) |
| `error` | Interface Sounds · error_004 | action refusée |
| `drop1`–`drop3` | Interface Sounds · drop_002 à drop_004 | achat, gouttes de l’ambiance |
| `pluck1`, `pluck2` | Interface Sounds · pluck_001, pluck_002 | bonus, planète soulevée |
| `glass1`–`glass6` | Interface Sounds · glass_001 à glass_006 | carillons (niveau, doré, victoire), gel, bouclier, cristaux de l’ambiance |
| `confirm`, `down` | Interface Sounds · confirmation_004, minimize_008 | victoire, défaite |
| `scratch` | Interface Sounds · scratch_005 | venin |
| `roll` | Interface Sounds · scroll_002 (0,55 s) | actualiser la taverne |
| `place1`–`place4` | Starter Kit City Builder · placement-a à d | planète posée, impacts |
| `crumble1`–`crumble4` | Starter Kit City Builder · removal-a à d | vente, gros impacts, destruction |
| `break`, `coin` | Starter Kit 3D Platformer · break, coin | destruction, poussières gagnées |
| `blast`, `zap` | Starter Kit FPS · enemy_destroy, enemy_hurt | éclat lointain, touche sci-fi des impacts |
| `rise` | Interface Sounds · glass_004, réverbéré puis inversé | lancement du jeu, renaissance |
| `wind` | Starter Kit City Builder · ambience, oiseaux retirés (passe-bas), descendue d’une quarte | ambiance |

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
