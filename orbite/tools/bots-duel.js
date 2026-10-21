// Quatre IA expertes contre quatre IA de base, jusqu'au vrai classement final.
const { R, parseArguments, argumentHelp, simulateGame, runCli } = require('./lib/simulation.js');
const { summarizeRanks } = require('./lib/statistiques.js');

function compareBots(options) {
  const ranks = { 0: [], 1: [] };
  const truncated = [];
  let completed = 0, totalRounds = 0;
  for (let g = 0; g < options.games; g++) {
    const seed = `${options.seed}|bots-duel|${g}`;
    const result = simulateGame({
      seed, lawId: R.LAWS[g % R.LAWS.length].id,
      population: options.population, maxRounds: options.maxRounds,
      setup(state) {
        state.players.forEach((p, i) => { p.skill = (i + g) % 2; });
      },
    });
    if (!result.completed) { truncated.push(seed); continue; }
    completed++;
    totalRounds += result.rounds;
    for (const p of result.state.players) ranks[p.skill].push(p.rank);
  }
  return {
    schemaVersion: 1, experiment: 'bots-duel',
    parameters: { games: options.games, seed: options.seed, maxRounds: options.maxRounds, population: options.population, skills: [0, 1] },
    requestedGames: options.games, completedGames: completed, truncatedGames: truncated.length, truncatedSeeds: truncated,
    meanRounds: completed ? totalRounds / completed : null,
    groups: {
      basic: summarizeRanks(ranks[0], { independent: false }),
      expert: summarizeRanks(ranks[1], { independent: false }),
    },
    limitations: [
      'Chaque groupe contient quatre joueurs d’une même partie : ces observations sont corrélées et aucun intervalle binomial indépendant n’est calculé.',
      'La comparaison porte sur cette population de bots, et ne certifie pas l’équilibre des familles ni le futur plateau commun.',
      ...(completed < 100 ? ['Échantillon pilote : trop peu de parties pour une conclusion précise.'] : []),
    ],
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2), { defaultGames: 120 });
  if (options.help) {
    console.log(argumentHelp('bots-duel.js').replace(' [--skill 0|1]', '') + 'Ce test compare toujours quatre IA de niveau 0 à quatre IA de niveau 1.');
    return;
  }
  if (process.argv.includes('--skill')) throw new Error('bots-duel compare les niveaux 0 et 1 ; --skill ne s’applique pas à cette expérience.');
  const report = compareBots(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.completedGames}/${report.requestedGames} parties terminées ; ${report.truncatedGames} tronquées et exclues ; population ${options.population}.`);
    for (const [label, group] of [['experte', report.groups.expert], ['de base', report.groups.basic]]) {
      console.log(`${label.padEnd(8)} rang moyen ${group.meanRank == null ? 'indisponible' : group.meanRank.toFixed(2)} ; victoires ${group.winRate == null ? 'indisponible' : (group.winRate * 100).toFixed(1) + ' %'} ; n=${group.n}`);
    }
    for (const warning of report.limitations) console.log(warning);
  }
  if (report.truncatedGames) process.exitCode = 2;
}

if (require.main === module) runCli(main);
module.exports = { compareBots };
