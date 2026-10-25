const { R, POPULATIONS, positiveInteger, simulateGame, addRank } = require('./simulation.js');
const { summarizeRanks } = require('./statistiques.js');

function summarizeGroups(groups, independent) {
  return Object.fromEntries(Object.entries(groups).map(([key, ranks]) => [key, summarizeRanks(ranks, { independent })]));
}

function dominantFamily(player) {
  const counts = {};
  for (const unit of player.board) {
    const family = R.famOf(unit);
    if (family !== 'neutre') counts[family] = (counts[family] || 0) + 1;
  }
  const first = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  // Deux familles d'au moins 3 astres : un mélange, compté à part plutôt qu'au nom d'une seule.
  const duo = Object.entries(counts).filter(([, n]) => n >= 3).map(([f]) => f).sort();
  const dominant = duo.length >= 2 ? `duo:${duo.slice(0, 2).join('+')}` : first && first[1] >= 3 ? first[0] : 'mixte';
  return { dominant, count: Object.keys(counts).length };
}

function runBalance(options = {}) {
  if (typeof options.seed !== 'string' || !options.seed.trim()) throw new TypeError('Une graine explicite est requise pour le rapport.');
  if (!POPULATIONS.includes(options.population)) throw new TypeError('Une population explicite est requise pour le rapport.');
  if (![0, 1].includes(options.skill)) throw new TypeError('Un niveau d’IA explicite (0 ou 1) est requis pour le rapport.');
  options = {
    ...options,
    games: positiveInteger(options.games, 'Le nombre de parties'),
    maxRounds: positiveInteger(options.maxRounds, 'La limite de manches'),
  };
  const byLawFocal = Object.fromEntries(R.LAWS.map(law => [law.id, []]));
  const byLawAll = Object.fromEntries(R.LAWS.map(law => [law.id, []]));
  const byFamilyFocal = {}, byFamilyAll = {}, byCard = {}, byFamilyCount = {}, byTier = {}, bySeat = {};
  const truncated = [];
  let completed = 0, rounds = 0, goldens = 0, playerCount = 0;
  const start = Date.now();
  for (let game = 0; game < options.games; game++) {
    const seed = `${options.seed}-${game}`;
    const lawId = R.LAWS[game % R.LAWS.length].id;
    const result = simulateGame({ ...options, seed, lawId });
    if (!result.completed) {
      truncated.push({ seed, lawId, rounds: result.rounds, remainingPlayers: R.alivePlayers(result.state).length, diagnostics: result.diagnostics });
      continue;
    }
    const state = result.state;
    completed++;
    rounds += result.rounds;
    addRank(byLawFocal, state.players[0].law, state.players[0].rank);
    addRank(byFamilyFocal, dominantFamily(state.players[0]).dominant, state.players[0].rank);
    state.players.forEach((player, seat) => {
      playerCount++;
      addRank(byLawAll, player.law, player.rank);
      addRank(bySeat, String(seat), player.rank);
      const family = dominantFamily(player);
      addRank(byFamilyAll, family.dominant, player.rank);
      addRank(byFamilyCount, String(family.count), player.rank);
      addRank(byTier, String(player.tier), player.rank);
      for (const id of new Set(player.board.map(unit => unit.id))) addRank(byCard, id, player.rank);
      goldens += player.board.filter(unit => unit.golden).length;
    });
  }
  const lawsFocal = summarizeGroups(byLawFocal, true);
  const lowSampleLaws = Object.entries(lawsFocal).filter(([, stats]) => stats.n < 30).map(([id]) => id);
  return {
    schemaVersion: 1,
    scope: 'Mêlée à huit participants ; ne valide pas le duel.',
    settings: { games: options.games, seed: options.seed, maxRounds: options.maxRounds, skill: options.skill, population: options.population },
    counts: { requested: options.games, completed, truncated: truncated.length, failed: 0 },
    durationMs: Date.now() - start,
    meanRounds: completed ? rounds / completed : null,
    goldensPerPlayer: playerCount ? goldens / playerCount : null,
    laws: { focal: lawsFocal, allPlayers: summarizeGroups(byLawAll, false) },
    dominantFamilies: { focal: summarizeGroups(byFamilyFocal, true), allPlayers: summarizeGroups(byFamilyAll, false) },
    seats: summarizeGroups(bySeat, true),
    finalFamilyCounts: summarizeGroups(byFamilyCount, false),
    finalTiers: summarizeGroups(byTier, false),
    cardAssociations: summarizeGroups(byCard, false),
    truncatedGames: truncated,
    warnings: [
      'Les observations des huit joueurs d’une même partie sont corrélées. Les intervalles à 95 % sont limités aux lignes avec une observation par partie (joueur0 ou siège donné).',
      'Les compositions sont celles de l’élimination ou de la victoire. La présence d’un astre dans une composition gagnante ne mesure pas son effet causal.',
      'La sélection des cinq familles reste conditionnée par la loi du joueur0. Les lois des adversaires de la population balanced sont réparties parmi les lois éligibles, lois neutres comprises.',
      'Un bon résultat contre ces bots ne prouve pas qu’une stratégie soit dominante contre des humains ou d’autres politiques.',
      ...(options.population === 'game' ? ['Population game : préférences de familles et distribution FAM_POWER du jeu conservées ; ce tournoi ne mesure pas isolément la force des familles.'] : []),
      ...(lowSampleLaws.length ? [`Échantillon exploratoire : moins de 30 observations indépendantes pour ${lowSampleLaws.length} lois. Aucun verdict automatique d’équilibrage.`] : []),
      ...(truncated.length ? ['Certaines parties sont inachevées et exclues des statistiques. Cette exclusion peut biaiser le rapport ; augmenter la limite et relancer avant toute conclusion.'] : []),
    ],
  };
}

function formatPercent(value) { return value == null ? '—' : `${(value * 100).toFixed(1)} %`; }

function formatRow(label, stats) {
  const interval = stats.winRate95;
  const uncertainty = interval ? ` ; intervalle 95 % ${formatPercent(interval.low)}–${formatPercent(interval.high)}` : '';
  return `${label.padEnd(22)} rang ${stats.meanRank == null ? '—' : stats.meanRank.toFixed(2)} ; victoires ${formatPercent(stats.winRate)} ; top 3 ${formatPercent(stats.top3Rate)} ; n=${stats.n}${uncertainty}`;
}

function formatBalance(report) {
  const lines = [
    `${report.counts.completed}/${report.counts.requested} parties terminées ; ${report.counts.truncated} inachevées ; ${(report.durationMs / 1000).toFixed(1)} s`,
    `Population ${report.settings.population} ; IA ${report.settings.skill} ; graine ${report.settings.seed}`,
    `Durée moyenne : ${report.meanRounds == null ? '—' : report.meanRounds.toFixed(1)} manches jusqu’au vrai vainqueur.`,
    '', 'Lois du joueur0 : une observation indépendante par partie',
  ];
  const sorted = entries => Object.entries(entries).sort((a, b) => (a[1].meanRank ?? Infinity) - (b[1].meanRank ?? Infinity));
  for (const [id, stats] of sorted(report.laws.focal)) lines.push(formatRow(id, stats));
  lines.push('', 'Famille dominante ou duo de familles : observations descriptives de tous les joueurs, sans intervalle indépendant');
  for (const [id, stats] of sorted(report.dominantFamilies.allPlayers)) lines.push(formatRow(id, stats));
  lines.push('', 'Sièges : une observation par siège et par partie');
  for (const [id, stats] of Object.entries(report.seats)) lines.push(formatRow(`siège ${id}`, stats));
  const cards = sorted(report.cardAssociations).filter(([, stats]) => stats.n >= 200);
  lines.push('', 'Associations entre astres et classement (au moins 200 présences ; aucune causalité établie)');
  if (!cards.length) lines.push('Échantillon insuffisant pour afficher des comparaisons d’astres.');
  else for (const [id, stats] of [...cards.slice(0, 10), ...cards.slice(10).slice(-10)]) lines.push(formatRow(R.CARD[id].name, stats));
  lines.push('', ...report.warnings.map(warning => `Note : ${warning}`));
  return lines.join('\n');
}

module.exports = { runBalance, formatBalance, dominantFamily };
