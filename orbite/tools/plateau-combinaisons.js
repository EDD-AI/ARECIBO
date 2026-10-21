// Sous-modèles exacts du prototype ; ne confond pas dénombrement et profondeur.
'use strict';
const P = require('../js/plateau.js');
const { binomial, placements } = require('./combinaisons.js');

function bounded(value, label, low, high) {
  if (typeof value === 'string' && !value.trim()) throw new RangeError(`${label} invalide.`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < low || n > high) throw new RangeError(`${label} doit être un entier de ${low} à ${high}.`);
  return n;
}

function computePlateauCombinations({ players = 2, units = P.LIMITS.armyCap, seed = 'plateau-combinaisons-v1' } = {}) {
  players = bounded(players, 'Le nombre de joueurs', 2, 6);
  units = bounded(units, 'Le nombre d’astres', 0, P.LIMITS.armyCap);
  if (typeof seed !== 'string' || !seed.trim()) throw new Error('Une graine non vide est requise.');
  const state = P.newGame({ seed, players: Array.from({ length: players }, (_, i) => ({ id: 'p' + i, name: 'Joueur ' + (i + 1), kind: 'bot' })) });
  const types = Object.keys(state.poolTotal).length;
  const cells = state.sectors * P.LIMITS.ringCount;
  const selections = binomial(types, units);
  const positions = placements(cells, units);
  const openingPlans = state.players.map(player => {
    const perUnit = state.units.filter(unit => unit.owner === player.id && unit.node).map(unit => ({
      unitId: unit.id,
      moves: P.moves(state, unit.id).length,
      attacks: P.targets(state, unit.id).length,
      guards: 1,
    }));
    return {
      playerId: player.id,
      perUnit,
      orderCombinations: perUnit.reduce((n, unit) => n * BigInt(unit.moves + unit.attacks + unit.guards), 1n).toString(),
    };
  });
  return {
    schemaVersion: 1,
    scope: 'Prototype à plateau commun ; sous-modèles combinatoires, pas un nombre de stratégies viables.',
    settings: { players, units, seed },
    catalogue: { families: P.FAMILIES.length, roles: P.ROLES.length, totalTypes: Object.keys(P.CARDS).length, activeFamilies: state.activeFamilies, nominalTypesPerGame: types },
    board: { rings: P.LIMITS.ringCount, sectors: state.sectors, cells },
    distinctArmyModel: {
      description: 'Une seule armée de types tous distincts, placée sur un plateau autrement vide.',
      unorderedTypeSelections: selections.toString(),
      placementsPerSelection: positions.toString(),
      nominalArrangements: (selections * positions).toString(),
    },
    openingPlans,
    limitations: [
      'Le modèle d’armée ignore les achats, prix, niveaux, accès aux cases, ennemis et réserves déjà consommées.',
      'Il distingue toutes les cases et identités, sans déduire les positions équivalentes par rotation ou symétrie.',
      'Il exclut les doublons, fusions dorées, blessures et historiques.',
      'Les plans d’ouverture comptent une garde ou un ordre légal par astre dans l’état initial fixé, sans achats ni déploiements.',
      'Des plans différents peuvent aboutir au même résultat ; collisions, déplacements adverses et rotation influencent leur résolution.',
      'Ces valeurs ne mesurent ni la diversité des stratégies gagnantes, ni l’équilibrage, ni la profondeur du jeu.',
    ],
  };
}

function main(argv) {
  const options = {};
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') json = true;
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage : node orbite/tools/plateau-combinaisons.js [--players 2..6] [--units 0..7] [--seed texte] [--json]');
      return;
    } else if (['--players', '--units', '--seed'].includes(arg)) {
      const value = argv[++i];
      if (value == null || value.startsWith('--')) throw new Error(`Valeur manquante pour ${arg}.`);
      options[arg.slice(2)] = value;
    } else throw new Error(`Argument inconnu : ${arg}.`);
  }
  const report = computePlateauCombinations(options);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.settings.players} joueurs, ${report.board.cells} cases ; ${report.catalogue.nominalTypesPerGame} types parmi ${report.catalogue.totalTypes}.`);
    console.log(`Sous-modèle de ${report.settings.units} types distincts : ${report.distinctArmyModel.unorderedTypeSelections} sélections, ${report.distinctArmyModel.placementsPerSelection} placements par sélection.`);
    for (const row of report.openingPlans) console.log(`${row.playerId} : ${row.orderCombinations} plans nominaux à l’ouverture, avant achats.`);
    for (const limitation of report.limitations) console.log('Note : ' + limitation);
  }
}

if (require.main === module) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { computePlateauCombinations };
