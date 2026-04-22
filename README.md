# ARECIBO — Salvage Protocol

> Jeu navigateur coop d'extraction et exploration spatiale.

## Concept

L'événement
En 1974, les humains envoient le message d'Arecibo dans l'espace. Un acte d'espoir. Une bouteille jetée dans l'infini. Ce qu'ils ne savent pas, c'est qu'un trou noir se trouve sur la trajectoire du signal. Le message est aspiré. Disparu. Enfermé dans la singularité.
Mais un trou noir n'efface pas — il compresse, stocke, retient. Le message d'Arecibo existe encore, quelque part dans le champ gravitationnel, émettant une fréquence infime, indéchiffrable depuis la Terre.
L'équipage
Avant d'envoyer des hommes, on a envoyé des animaux. Des chiens, des singes, des chats. Laïka. Ham. Félicette. Des corps sacrifiés au nom de la science, expédiés dans le vide sans billet retour.
Certains sont morts. Certains ont disparu. Mais quelques-uns du programme MOTOMOTO ont survécu — récupérés, soignés, entraînés. Ils ont appris à piloter, à réparer, à survivre dans l'espace. Pas parce qu'ils ont choisi. Parce qu'ils n'avaient pas d'autre endroit où aller.
Ce sont des animaux en combinaison d'astronaute. Ni héros, ni martyrs. Juste les seuls disponibles pour une mission que personne d'autre ne voulait faire.
La mission
Le MOTOMOTO dérive vers le trou noir. Pas assez vite — le trou noir aspire tout autour de lui, et le vaisseau manque de carburant, de pièces, de temps. L'équipage sort en extraction pour récupérer ce qui traîne sur leur passage : des carcasses de sondes perdues, des débris de satellites, des fragments sur de petites planètes condamnées elles aussi à être englouties.
Chaque objet récupéré permet au MOTOMOTO d'avancer encore un peu. De se rapprocher suffisamment du trou noir pour capter la fréquence du message d'Arecibo et en extraire les données avant que tout disparaisse.
Avant que le trou noir n'aspire tout. Y compris eux.
## Stack

- HTML / CSS / JS vanilla (front)
- Esthétique SF vintage retrofuturiste (Alien 1979, 2001)
- Fonts : Power Grotesk (logo) · Degular (titres) · Pixelify Sans (UI pixel)
- Palette : #F7FFC3 (cream) · #FA5A1F (orange) · #000 (bg)

## Fichiers

```
/
├── index.html              → Séquence de boot (terminal)
├── arecibo_menu.html       → Menu principal
├── arecibo_intro.html      → Générique lore + terminal MOTOMOTO
├── arecibo_game.html       → Prototype session SOLO
├── arecibo_creation.html   → Création de personnage (mise de côté)
├── arecibo_lobby.html      → Lobby multijoueur (WIP)
├── assets/backgrounds/starfield.png → Background étoilé
└── fonts/
    ├── PowerGrotesk-Regular.woff2
    ├── Degular-Black.woff2
    └── Degular-Bold.woff2
```

## Flow

`Boot terminal` → `Menu` → `Solo (session directe)` ou `Multi (lobby)` → `Session extraction`

## Studio EDDA — 2026
