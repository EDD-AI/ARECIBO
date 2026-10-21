// Quatre stratégies mono-famille contre quatre stratégies à deux familles.
const { R, parseArguments, argumentHelp, simulateGame, addRank, runCli } = require('./lib/simulation.js');
const { summarizeRanks } = require('./lib/statistiques.js');

function compareHybrids(options) {
  const ranks = { mono: [], duo: [] }, pairRanks = {};
  const truncated = [];
  let completed = 0, totalRounds = 0;
  for (let g = 0; g < options.games; g++) {
    const seed = `${options.seed}|hybrides|${g}`;
    const result = simulateGame({
      seed, lawId: R.LAWS[g % R.LAWS.length].id, skill: options.skill,
      population: options.population, maxRounds: options.maxRounds,
      setup(state) {
        state.players.forEach((p, i) => {
          const family = R.LAW[p.law].fam;
          p.pref = family === 'neutre' ? state.families[(g + i) % state.families.length] : family;
          p.pref2 = null;
          p.measureGroup = (i + g) % 2 ? 'duo' : 'mono';
          if (p.measureGroup === 'duo') {
            const others = state.families.filter(f => f !== p.pref);
            p.pref2 = others[(g * 7 + i * 3) % others.length];
            p.measurePair = [p.pref, p.pref2].sort().join(' + ');
          }
        });
      },
    });
    if (!result.completed) { truncated.push(seed); continue; }
    completed++;
    totalRounds += result.rounds;
    for (const p of result.state.players) {
      ranks[p.measureGroup].push(p.rank);
      if (p.measurePair) addRank(pairRanks, p.measurePair, p.rank);
    }
  }
  return {
    schemaVersion: 1, experiment: 'hybrides',
    parameters: { games: options.games, seed: options.seed, maxRounds: options.maxRounds, population: options.population, skill: options.skill },
    requestedGames: options.games, completedGames: completed, truncatedGames: truncated.length, truncatedSeeds: truncated,
    meanRounds: completed ? totalRounds / completed : null,
    groups: {
      mono: summarizeRanks(ranks.mono, { independent: false }),
      duo: summarizeRanks(ranks.duo, { independent: false }),
    },
    pairs: Object.fromEntries(Object.entries(pairRanks).sort(([a], [b]) => a.localeCompare(b)).map(([pair, samples]) => [pair, summarizeRanks(samples, { independent: false })])),
    limitations: [
      'Les groupes décrivent les préférences initiales des bots, pas une obligation sur leur composition finale.',
      'Les observations des joueurs d’une même partie sont corrélées ; aucun intervalle binomial indépendant n’est calculé.',
      'Les résultats par duo sont descriptifs : un seuil de rang moyen ne prouve pas qu’un duo est viable ou équilibré.',
      ...(completed < 100 ? ['Échantillon pilote : trop peu de parties pour une conclusion précise.'] : []),
    ],
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2), { defaultGames: 120, detail: true });
  if (options.help) { console.log(argumentHelp('hybrides.js').replace('[nombre]', '[nombre] [--detail]')); return; }
  const report = compareHybrids(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    const line = (label, group) => `${label.padEnd(24)} rang ${group.meanRank == null ? 'indisponible' : group.meanRank.toFixed(2)} ; victoires ${group.winRate == null ? 'indisponible' : (group.winRate * 100).toFixed(1) + ' %'} ; n=${group.n}`;
    console.log(`${report.completedGames}/${report.requestedGames} parties terminées ; ${report.truncatedGames} tronquées et exclues ; population ${options.population}, IA ${options.skill}.`);
    console.log(line('une famille', report.groups.mono));
    console.log(line('deux familles', report.groups.duo));
    console.log(`${Object.keys(report.pairs).length} duos observés ; ${Object.values(report.pairs).filter(p => p.n >= 40).length} avec au moins 40 observations.`);
    if (options.detail) for (const [pair, summary] of Object.entries(report.pairs)) console.log(line(pair, summary));
    for (const warning of report.limitations) console.log(warning);
  }
  if (report.truncatedGames) process.exitCode = 2;
}

if (require.main === module) runCli(main);
module.exports = { compareHybrids };
