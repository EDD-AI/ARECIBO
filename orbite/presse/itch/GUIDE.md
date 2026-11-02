# Mettre ORBITE sur itch.io : le pas-à-pas

Page visée : **https://edda-studio.itch.io/orbite**. Compte : `edda-studio`.

## Ce qu’il te faut (déjà prêt)

| Quoi | Où |
|---|---|
| Le jeu (ZIP à téléverser, ~15 Mo, 158 fichiers) | `orbite-itch.zip` que je t’envoie ; refaisable avec `tools/itch-zip.sh` |
| Tous les textes de la page (EN + FR) | `presse/itch/PAGE.md` |
| Couverture 630×500 | la tienne, ou `presse/itch/couverture-bataille-630x500.png` / `couverture-trou-noir-630x500.png` |
| Bannière d’en-tête | `presse/visuels/orbite-banniere-4x1.png` |
| Captures conseillées (dans l’ordre) | `presse/captures/pc-4-combat-en.png`, `pc-3-creation-en.png`, `pc-1-menu-en.png`, `pc-6-codex-en.png`, `telephone-3-creation-en.png` |

Toutes ces images font moins de 3 Mo (limite d’itch.io par image).

## 1. Créer la page (en brouillon)

1. Sur itch.io, menu de ton compte → **Dashboard** → **Create new project**.
2. **Title** : `ORBITE`. **Project URL** : `orbite` (garde-le : les invitations envoyées depuis itch.io pointent vers cette adresse).
3. **Short description or tagline** : celle de `PAGE.md` (partie 1).
4. **Classification** : `Games`. **Kind of project** : **`HTML`**. **Release status** : `In development`.
5. **Pricing** : `No payments` (le plus simple) ou `$0 or donate` si tu veux accepter des dons.

## 2. Téléverser le jeu

1. **Uploads** → **Upload files** → choisis `orbite-itch.zip`.
2. Coche **This file will be played in the browser**.
3. **Embed options** :
   - **Embed in page**, taille du cadre **1280 × 720** (le jeu passe tout seul en version PC 16:9 ; plus petit, l’écran devient trop serré).
   - Coche **Mobile friendly**, orientation **Portrait** (sur téléphone, itch.io lance toujours le jeu en plein écran).
   - Coche **Fullscreen button**.
   - Laisse **décochée** la case **SharedArrayBuffer support** (elle couperait la connexion Google).
   - Pas de barres de défilement.

## 3. Remplir la page

1. **Description** : colle la partie 2 de `PAGE.md` (anglais puis français), copiée depuis un **aperçu** du fichier (sur GitHub ou dans VS Code), pour que les titres et le gras passent.
2. **Genre** : `Strategy`. **Tags** : les 10 de `PAGE.md` (prends la forme proposée par l’autocomplétion).
3. **AI generation disclosure** : à toi de répondre honnêtement (voir `PAGE.md`, partie 1 : tes visuels viennent d’images générées avec Higgsfield ; les astres du jeu sont dessinés par le code).
4. Langues, entrées (souris, tactile), nombre de joueurs : comme dans `PAGE.md`.
5. **Cover image** : ta couverture 630×500.
6. **Screenshots** : les 5 captures ci-dessus.
7. **Visibility** : **Draft** pour l’instant → **Save**.

## 4. L’habiller (Edit theme)

Sur la page, bouton **Edit theme** :
- **Banner** : `orbite-banniere-4x1.png`.
- Couleurs : fond `#000000`, texte `#e8ecf2`, liens et boutons `#f6c453` (l’or du jeu).
- **Screenshots** : `Sidebar` (sinon itch.io les cache quand le jeu est intégré).

## 5. Brancher la connexion Google (pour le mode en ligne)

Dans la **console Firebase** (projet `orbite-739f9`) → **Authentication** → **Settings** → **Authorized domains** → **Add domain** :
- `html-classic.itch.zone`
- `html.itch.zone`

(Ce sont les domaines qui servent les jeux sur itch.io. Rien d’autre à changer.)

## 6. Tester le brouillon, puis publier

1. Ouvre ta page en brouillon, lance le jeu : un duel solo, puis **Profil → connexion Google**, puis une partie en ligne avec un ami (invitation : il reçoit l’adresse de la page et le code).
2. Si la connexion Google refuse de marcher, dis-le-moi ; en attendant, retire la partie « Online / En ligne » de la description (voir `PAGE.md`, partie 4).
3. Tout va bien → **Visibility : Public** → Save. Publie ensuite le premier devlog (`PAGE.md`, partie 3).
4. Remarque : sur itch.io, la progression des joueurs est séparée de celle du site web (chaque site garde ses données) ; la connexion Google relie les deux.

## Mettre à jour le jeu plus tard

À chaque nouvelle version, je refabrique le ZIP (`tools/itch-zip.sh`) ; tu le téléverses à la place de l’ancien dans **Uploads** (supprime l’ancien fichier). Les sauvegardes des joueurs sont conservées.
