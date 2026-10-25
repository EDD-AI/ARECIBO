# ORBITE — feuille de route jusqu'au Play Store

Ce document reste en fond jusqu'au lancement : les **règles permanentes** s'appliquent à chaque
nouvelle version, la **checklist** se coche au fur et à mesure.
(moi) = dans le code · (toi) = compte, carte, téléphone ou décision du propriétaire.

## Règles permanentes (à respecter dans chaque version)

1. **Jamais payer pour gagner.** Les graines de vie accélèrent la création et paient les
   cosmétiques, jamais la force en partie. L'Affrontement et le classé restent équitables.
2. **Biens numériques = Google Play Billing** dans l'appli Android (pas de Stripe dans l'appli).
   Tout crédit de graines achetées passe par une vérification côté serveur.
3. **Le jeu reste jouable sans payer**, et on gagne des graines en jouant.
4. **Pas de nouveau mode visible d'emblée.** Chaque nouveauté se débloque en jouant : le premier
   lancement doit rester simple (un parcours, un mode-vitrine).
5. **Données personnelles minimales.** Tout ce que le jeu collecte est déclaré dans la politique
   de confidentialité et le formulaire « Sécurité des données ». Le compte se supprime depuis le jeu.
6. **Public 13 ans et plus** : pas de publicité ciblée, pas de contenu qui ferait basculer le jeu
   dans les règles des jeux pour enfants.
7. **Cinq langues** (fr, en, es, de, pt) pour tout texte affiché : `tools/i18n-check.js` doit
   rester à 0 manquant.
8. **Licences propres.** Sons, musiques, polices et images : CC0, OFL ou faits maison, crédités.
   Aucune marque ni nom réel imité.
9. **Performances d'un téléphone moyen.** Fluide, sans chauffe ni batterie vidée : chaque écran
   animé se met en pause quand il n'est plus visible.
10. **Sauvegardes sûres.** Aucune version ne casse une sauvegarde existante (migrations).
11. **Tests verts avant chaque publication** : `node --test orbite/tests/*.test.mjs`.
12. **Hors ligne.** Le jeu solo marche sans réseau ; le cache du service worker change à chaque
    version.

## Checklist

### Phase 1 · Le jeu prêt à être montré
- [ ] (moi) Les 10 premières minutes : un seul parcours au premier lancement (réveil → première
      partie guidée → menu), les autres modes se débloquent progressivement.
- [x] (moi) Menu simplifié avec un mode-vitrine clair : **Jouer = le duel** (v68), la mêlée à 8 et
      le jeu en ligne dans Multijoueur.
- [ ] (toi + moi) Contenu de la campagne en v1 : ère I + les 4 chapitres de l'ère II, avec une fin
      « à suivre ». *Masquée au menu pendant le travail sur le duel.*
      - [x] Ère I · La Poussière
      - [x] Ère II · chapitre 1 · L'Essaim
      - [x] Ère II · chapitre 2 · Le Cœur
      - [x] Ère II · chapitre 3 · La Sculpture
      - [ ] Ère II · chapitre 4 · Le Grand Impact (+ choix du destin)
- [ ] (toi) Publier les règles Firestore (`firebase/firestore.rules`) dans la console Firebase
      (nécessaire depuis la v68 pour les duels en ligne : champ `size`).
- [ ] (toi + moi) Faire jouer le duel aux testeurs : placement, formations, durée (~12 cycles).
- [ ] (moi) Supprimer son compte depuis le jeu (et ses données en ligne).
- [ ] (moi) Remontée des erreurs (plantages chez les joueurs).
- [ ] (toi + moi) Performances testées sur un téléphone moyen ou ancien ; mode économie si besoin.

### Phase 2 · L'appli Android
- [ ] (moi) Emballage Android (Bubblewrap, format TWA) : icônes adaptatives, démarrage, plein écran.
- [ ] (toi + moi) Nom de domaine propre (ex. `orbite.app`) avec `/.well-known/assetlinks.json`.
- [ ] (moi) Achats de graines via Google Play Billing (API Digital Goods).
- [ ] (toi + moi) Vérification des achats côté serveur (Firebase en formule Blaze).
- [ ] (moi) Niveau d'API Android exigé par Google au moment de la publication.

### Phase 3 · La fiche et l'administratif
- [ ] (toi) Compte développeur Google Play (25 $), identité, profil de paiement.
- [ ] (moi → toi) Politique de confidentialité en ligne.
- [ ] (moi → toi) Formulaire « Sécurité des données » et questionnaire de classification (13+).
- [ ] (moi) Visuels : icône 512 px, bannière 1024×500, 6 à 8 captures légendées.
- [ ] (moi) Bande-annonce de 30 s (la poussière qui devient un astre).
- [ ] (moi) Textes de la fiche (courte et longue) dans les 5 langues.
- [ ] (toi) Vérifier que le nom « ORBITE » est libre (Play Store, marques).
- [ ] (moi) Vérifier toutes les licences et mettre à jour les crédits.

### Phase 4 · Tests et lancement
- [x] (toi) Testeurs trouvés : un Discord de bêta-testeurs (largement plus de 12).
- [ ] (toi) Test fermé : au moins 12 testeurs inscrits pendant 14 jours d'affilée (exigé pour un
      nouveau compte développeur personnel). Ils doivent vraiment jouer : Google pose ensuite des
      questions sur le test (recrutement, retours, corrections) avant d'ouvrir la publication.
- [ ] (toi) Dès maintenant, faire tester la version web sur le Discord (lien du jeu) : un salon
      « bugs » et un salon « idées » ; noter la version (Paramètres) dans chaque retour.
- [ ] (moi) Corriger les retours des testeurs.
- [ ] (toi) Lancement test dans un ou deux pays (ex. France, Belgique).
- [ ] (moi) Suivre la rétention (J1, J7), les abandons et le nombre de parties.
- [ ] (toi) Lancement mondial.

### Après le lancement
- [ ] Un nouveau chapitre de la Genèse régulièrement.
- [ ] Événements limités et saisons de classé.
- [ ] Communauté (Discord) et réponses aux avis.
