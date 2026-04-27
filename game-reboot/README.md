# ARECIBO Reboot

Cette branche sert au virage du jeu.

On garde en place :

- `arecibo_menu.html`
- `arecibo_settings.html`
- `arecibo_intro.html`

Le reste du gameplay peut être repensé et reconstruit ici, sans perdre la base visuelle déjà validée.

## Intention

- conserver l'identité ARECIBO
- repartir sur une structure plus simple
- reconstruire les scènes, systèmes et boucles de jeu proprement
- garder le projet plus lisible pour les futures itérations

## Structure proposée

- `scenes/` : scènes de jeu principales
- `systems/` : logique gameplay, état, progression
- `ui/` : HUD, overlays, interactions
- `docs/` : notes de direction, flow, quêtes, intentions

## Note

L'ancien gameplay reste présent dans cette branche comme référence de travail, mais le reboot doit partir de ce dossier.
