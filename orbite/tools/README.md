# Mesurer les règles et l’équilibrage d’ORBITE

Outils de mesure du moteur d’ORBITE (`js/rules.js`). Node.js suffit ; aucune dépendance n’est à installer. Ces outils jouent la **mêlée à huit** ; le duel se mesure avec les tests (`tests/rules.test.mjs`, « duel »).

## Mêlée à huit

Depuis la racine du dépôt :

```sh
# Petit tournoi exploratoire, jusqu’au vrai vainqueur de chaque partie.
node orbite/tools/equilibrage.js 120 --seed essai-1

# Rapport exploitable pour comparer et archiver des essais.
node orbite/tools/equilibrage.js 120 --seed essai-1 --json > /tmp/orbite-equilibrage.json

# Catalogue et dénombrements exacts d’un sous-modèle clairement délimité.
node orbite/tools/combinaisons.js
node orbite/tools/combinaisons.js --units 2 --json

# Expériences de politiques différentes.
node orbite/tools/bots-duel.js 120 --seed bots-1 --json
node orbite/tools/hybrides.js 120 --seed compositions-1 --detail
node orbite/tools/bots-mono.js 10 --seed mono-1 --json
```

Pour `bots-mono`, le nombre est répété pour chacune des douze familles : 10 signifie 120 parties. Les autres commandes prennent un nombre total de parties. Les valeurs par défaut sont exploratoires, sans verdict automatique sur les familles.

## Ce qui est mesuré

- La même IA est utilisée par tous dans le tournoi général, y compris le joueur0. `--skill 0` utilise la politique de base ; `--skill 1`, celle experte. `bots-duel` compare volontairement les deux et rejette ce paramètre.
- Le mode d’observation poursuit la partie après la mort du joueur0, jusqu’au dernier survivant. Tous les rangs publiés sont définitifs. Le jeu dans le navigateur garde son comportement habituel.
- À chaque manche, la réserve, les identifiants, les limites de main/plateau et les statistiques valides sont contrôlés. Une violation fait échouer la commande avec sa graine et sa manche.
- Les paramètres et la graine sont inclus dans les rapports JSON. Même version du moteur et mêmes paramètres donnent les mêmes décisions et résultats ; le temps d’exécution peut varier.
- Une Alliance est séparée d’une famille dominante ; ses performances ne sont pas attribuées arbitrairement à une seule famille.

## Populations et biais

`--population balanced` est le défaut des mesures. Il répartit les lois adverses parmi celles éligibles, lois neutres comprises, sans les poids `FAM_POWER`. Tous démarrent avec le même niveau d’IA et sans préférence secondaire ni tempérament différent. La sélection des familles reste conditionnée par la loi du joueur0 : ce n’est pas une expérience isolant parfaitement la puissance d’une famille.

`--population game` conserve la distribution de lois, les préférences et les tempéraments du jeu, tout en donnant aussi la bonne IA au joueur0. Il mesure la performance contre cette population particulière.

Les politiques expertes et de base n’utilisent pas les mêmes décisions. Les expériences de stratégies décrivent leurs préférences, sans garantir qu’un bot réalisera effectivement une composition donnée. La politique naïve de `bots-mono` choisit désormais un hôte compatible pour l’Arrimage.

## Parties inachevées et erreurs

La limite par défaut est de 80 manches (`--max-rounds N`). Une partie qui atteint cette limite reste inachevée : elle est comptée, sa graine est conservée et elle est exclue des statistiques. Aucun classement selon les PV restants n’est inventé. L’exclusion peut biaiser les résultats : augmenter la limite et rejouer avant de conclure.

Codes de sortie : 0 si toutes les parties demandées sont terminées, 1 si argument invalide ou erreur d’exécution/invariant, 2 si au moins une partie reste inachevée. Le JSON d’une commande terminant avec le code 2 reste lisible. Une erreur n’est jamais convertie en partie gagnée ou perdue.

## Interpréter les résultats

Les intervalles de Wilson à 95 % concernent seulement les lignes comportant une observation par partie, comme les lois du joueur0 ou un siège donné. Les huit joueurs d’une même partie sont corrélés : leurs statistiques groupées restent descriptives et n’affichent pas cet intervalle. Un échantillon vide donne un taux inconnu (`null`), jamais un faux 0 %.

Les associations entre cartes présentes à la fin et classement ne sont pas des effets causaux. Les cartes tardives, leur rareté, la survie et les habitudes des bots influencent ces associations. Un intervalle étroit ne corrige pas ces biais. Les rangs par famille et les duos ne sont donc pas automatiquement classés comme équilibrés ou trop forts.

Les anciens tableaux d’équilibrage du README et les rapports produits avant cette correction utilisent une méthode différente : arrêt au joueur0, rangs estimés des survivants et populations différentes. Ils ne sont pas directement comparables aux nouveaux rapports.

L’outil de combinaisons distingue identités, sélections de familles et arrangements nominaux. Il ne compte pas les états réellement accessibles, ni les stratégies viables, ni la profondeur. Les coûts, doublons, fusions, améliorations et historiques demandent un modèle plus complet.

## Cas limite détecté pendant la validation

Un pilote de 120 parties expertes (`--seed validation-fiabilite-1`) a terminé 119 parties et signalé une partie inachevée. Celle-ci a encore deux survivants après 120 manches. À la manche 80, les deux bots ont enchaîné 57 égalités : leurs effets de combat détruisent les deux plateaux avant la première attaque, sans dégâts aux étoiles. Il s’agit d’une impasse observée entre ces politiques, pas d’une preuve qu’aucune décision humaine ne pourrait l’éviter.

Reproduction ciblée :

```sh
node - <<'JS'
const { simulateGame } = require('./orbite/tools/lib/simulation.js');
const result = simulateGame({
  seed: 'validation-fiabilite-1-97', lawId: 'marees',
  population: 'balanced', skill: 1, maxRounds: 80,
});
console.log({ completed: result.completed, rounds: result.rounds, diagnostics: result.diagnostics });
JS
```

Les diagnostics comptent les combats et les égalités consécutives sans les transformer automatiquement en victoire ou en partie nulle définitive. Une règle de fin adaptée aux égalités répétées reste à concevoir ; attribuer la victoire selon les PV aurait masqué ce problème.

## Vérifications

```sh
node --test --test-concurrency=3 orbite/tests/*.test.mjs
node orbite/tools/i18n-check.js
```

Les tests `rules.test.mjs` couvrent aussi les rangées, le ciblage en face, les formations et le duel. Les prochains réglages devront comparer plusieurs politiques de placement et des graines de validation distinctes, en duel comme en mêlée.
