// Dénombrements du catalogue actuel : node orbite/tools/combinaisons.js [--json] [--units N].
// Ces calculs ne dénombrent ni les états de partie atteignables ni les stratégies viables.
'use strict';

const R = require('../js/rules.js');

function nonnegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} doit être un entier positif ou nul, représentable exactement.`);
  }
}

/** Nombre de sous-ensembles de k éléments parmi n ; 0 si k > n. */
function binomial(n, k) {
  nonnegativeInteger(n, 'n');
  nonnegativeInteger(k, 'k');
  if (k > n) return 0n;
  const count = Math.min(k, n - k);
  let result = 1n;
  for (let i = 1; i <= count; i++) {
    result = result * BigInt(n - count + i) / BigInt(i);
  }
  return result;
}

/** Nombre d'arrangements ordonnés de k éléments distincts parmi n ; 0 si k > n. */
function placements(n, k) {
  nonnegativeInteger(n, 'n');
  nonnegativeInteger(k, 'k');
  if (k > n) return 0n;
  let result = 1n;
  for (let i = 0; i < k; i++) result *= BigInt(n - i);
  return result;
}

/** Les dénombrements exacts sont des chaînes décimales pour permettre JSON.stringify. */
function computeCombinationsReport({ units = R.BOARD_MAX } = {}) {
  nonnegativeInteger(units, 'units');
  if (units > R.BOARD_MAX) {
    throw new RangeError(`units ne peut pas dépasser la capacité actuelle du système (${R.BOARD_MAX}).`);
  }

  const regular = R.CARDS.filter((c) => !c.legend && !c.token);
  const legendary = R.CARDS.filter((c) => c.legend && !c.token);
  const tokens = R.CARDS.filter((c) => c.token);
  const regularByFamily = Object.fromEntries(R.FAMILY_KEYS.map((fam) => [
    fam, regular.filter((c) => c.fam === fam).length,
  ]));
  const neutralRegular = regular.filter((c) => c.fam === 'neutre').length;
  // Lire la sélection et les identités de réserve du moteur, sans simuler de partie.
  const reference = R.newGame('combinaisons-reference', R.LAWS[0].id);
  const active = reference.families.length;
  const poolIds = Object.keys(reference.pool);
  const familySizes = Object.values(regularByFamily).sort((a, b) => a - b);
  const sum = (list) => list.reduce((total, n) => total + n, 0);
  const commonTypes = neutralRegular + legendary.length;
  const minPoolTypes = commonTypes + sum(familySizes.slice(0, active));
  const maxPoolTypes = commonTypes + sum(familySizes.slice(familySizes.length - active));

  return {
    schemaVersion: 1,
    scope: 'Dénombrements exacts du catalogue et d’un sous-modèle nominal, pas des états de jeu légaux.',
    catalogue: {
      totalTypes: R.CARDS.length,
      regularTypes: regular.length,
      legendaryTypes: legendary.length,
      tokenTypes: tokens.length,
      playableFamilies: R.FAMILY_KEYS.length,
      laws: R.LAWS.length,
      neutralRegularTypes: neutralRegular,
      regularTypesByFamily: regularByFamily,
    },
    families: {
      activePerGame: active,
      possibleSelections: binomial(R.FAMILY_KEYS.length, active).toString(),
      selectionsWithSpecifiedNonNeutralFamily: binomial(R.FAMILY_KEYS.length - 1, active - 1).toString(),
      fixedFamilyCondition: 'La loi non neutre du joueur impose sa famille dans le solo actuel.',
    },
    nominalPool: {
      referenceFamilies: reference.families.slice(),
      regularTypes: poolIds.filter((id) => !R.CARD[id].legend && !R.CARD[id].token).length,
      legendaryTypes: poolIds.filter((id) => R.CARD[id].legend).length,
      totalTypes: poolIds.length,
      uniformSizeAcrossFamilySelections: minPoolTypes === maxPoolTypes,
      minTypesAcrossFamilySelections: minPoolTypes,
      maxTypesAcrossFamilySelections: maxPoolTypes,
      description: 'Identités de la réserve nominale : familles retenues, neutres et toutes les légendaires ; jetons exclus.',
    },
    distinctIdentityModel: {
      units,
      currentBoardCapacity: R.BOARD_MAX,
      catalogueTypes: poolIds.length,
      unorderedSelections: binomial(poolIds.length, units).toString(),
      ordersPerSelection: placements(units, units).toString(),
      orderedArrangements: placements(poolIds.length, units).toString(),
      description: 'Choisir des identités toutes différentes dans le catalogue nominal, puis les ordonner dans la ligne actuelle.',
    },
    limitations: [
      'Le sous-modèle ignore les doublons, les fusions dorées, les statistiques accumulées, les mots-clés et les arrimages.',
      'Les niveaux accessibles, coûts, probabilités de tirage, réserves déjà consommées et historiques d’achat ne sont pas pris en compte.',
      'Les légendaires sont incluses dans le catalogue nominal, mais leur rareté et leur exemplaire unique limitent leur disponibilité.',
      'Toutes les permutations sont distinguées ; certaines peuvent être tactiquement équivalentes.',
      'Ces nombres ne mesurent ni les états légalement atteignables, ni les déroulements possibles, ni le nombre de stratégies compétitives ou la profondeur.',
      'Le futur plateau commun n’est pas modélisé : ses dimensions et ses règles restent à définir.',
    ],
  };
}

function parseArguments(args) {
  const options = { json: false, help: false, units: R.BOARD_MAX };
  let hasUnits = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--units' || arg.startsWith('--units=')) {
      if (hasUnits) throw new Error('--units doit être fourni une seule fois.');
      hasUnits = true;
      const value = arg === '--units' ? args[++i] : arg.slice('--units='.length);
      if (value == null || !/^(0|[1-9]\d*)$/.test(value)) {
        throw new Error('--units attend un entier positif ou nul.');
      }
      options.units = Number(value);
      nonnegativeInteger(options.units, 'units');
      if (options.units > R.BOARD_MAX) {
        throw new Error(`--units doit être compris entre 0 et ${R.BOARD_MAX}.`);
      }
    } else throw new Error(`Argument inconnu : ${arg}`);
  }
  return options;
}

function humanReport(report) {
  const count = (n) => BigInt(n).toLocaleString('fr-FR');
  const c = report.catalogue, f = report.families, pool = report.nominalPool, m = report.distinctIdentityModel;
  return [
    'ORBITE — catalogue actuel et combinaisons nominales',
    report.scope,
    '',
    `Catalogue : ${c.regularTypes} identités ordinaires, ${c.legendaryTypes} légendaires, ${c.tokenTypes} jetons ; ${c.totalTypes} au total.`,
    `${c.playableFamilies} familles jouables ; ${c.laws} lois.`,
    `${f.activePerGame} familles par partie : ${count(f.possibleSelections)} sélections de familles.`,
    `Avec une famille non neutre imposée : ${count(f.selectionsWithSpecifiedNonNeutralFamily)} sélections.`,
    `Réserve nominale de référence : ${pool.regularTypes} identités ordinaires + ${pool.legendaryTypes} légendaires = ${pool.totalTypes}.`,
    ...(pool.uniformSizeAcrossFamilySelections ? [] : [
      `La taille du catalogue dépend des familles : ${pool.minTypesAcrossFamilySelections} à ${pool.maxTypesAcrossFamilySelections} identités.`,
    ]),
    '',
    `Sous-modèle : ${m.units} identités distinctes parmi ${m.catalogueTypes}, sans contraintes d’acquisition.`,
    `Sélections sans ordre : ${count(m.unorderedSelections)}.`,
    `Ordres par sélection : ${count(m.ordersPerSelection)}.`,
    `Arrangements nominaux ordonnés : ${count(m.orderedArrangements)}.`,
    '',
    'Limites :',
    ...report.limitations.map((s) => `- ${s}`),
  ].join('\n');
}

module.exports = { binomial, placements, computeCombinationsReport };

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(`Usage : node orbite/tools/combinaisons.js [--json] [--units N]\n\nN : de 0 à ${R.BOARD_MAX}, ${R.BOARD_MAX} par défaut. Dénombrement d’un sous-modèle nominal du jeu actuel ; aucun nouveau plateau n’est imposé.`);
    } else {
      const report = computeCombinationsReport({ units: options.units });
      console.log(options.json ? JSON.stringify(report, null, 2) : humanReport(report));
    }
  } catch (error) {
    console.error(`Erreur : ${error.message}`);
    process.exitCode = 1;
  }
}
