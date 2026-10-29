// Politique d'achat naïve contre la population choisie, parties terminées jusqu'au vainqueur.
const { R, parseArguments, argumentHelp, simulateGame, runCli } = require('./lib/simulation.js');
const { summarizeRanks } = require('./lib/statistiques.js');
const LAWS = { vie: 'symbiose', cristal: 'resonance', lune: 'marees', tempete: 'vents', glace: 'stase', mineral: 'gravite', neant: 'entropie', brasier: 'combustion', machine: 'ingenierie', comete: 'passage', envers: 'renversement', anomalie: 'chaos', nebuleuse: 'siphon' };
function naive(st, p, fam) {
  const val = (u) => u.atk + u.hp + R.CARD[u.id].tier * 2 + (R.famOf(u) === fam ? 10 : 0) + (u.golden ? 6 : 0);
  const deploy = () => {
    for (let g = 0; g < 30; g++) {
      if (p.discover.length) { R.choose(st, Math.max(0, p.discover.findIndex((id) => R.CARD[id].fam === fam)), p); continue; }
      if (!p.hand.length) break;
      const u = p.hand.slice().sort((a, b) => val(b) - val(a))[0];
      if (p.board.length >= R.BOARD_MAX) { const weak = p.board.slice().sort((a, b) => val(a) - val(b))[0]; if (val(u) <= val(weak)) { R.sell(st, u.uid, p); continue; } R.sell(st, weak.uid, p); }
      const host = u.kw.includes('arrimage') && p.board.find(target => R.canMagnet(u, target));
      if (host) { R.play(st, u.uid, null, host.uid, p); continue; }
      R.play(st, u.uid, p.board.length, null, p);
    }
  };
  // Relique (cycles 4 et 8) : la première proposée.
  if (p.relicChoice && p.relicChoice.length) R.chooseRelic(st, 0, p);
  for (let g = 0; g < 40; g++) {
    deploy();
    const slot = p.shop.findIndex((id) => id && R.CARD[id].fam === fam);
    if (slot >= 0 && R.canBuy(st, slot, p).ok) { R.buy(st, slot, p); continue; }
    if (p.gold >= R.upgradeCost(p) && p.tier < 6 && st.round >= 2) { R.upgrade(st, p); continue; }
    if (p.board.length + p.hand.length < R.BOARD_MAX) { const any = p.shop.findIndex((id) => id); if (any >= 0 && R.canBuy(st, any, p).ok) { R.buy(st, any, p); continue; } }
    if (p.gold >= 4) { R.roll(st, p); continue; }
    break;
  }
  deploy();
}
function compareMono(options) {
  const families = {}, truncated = [];
  let completed = 0, totalRounds = 0;
  for (const [family, law] of Object.entries(LAWS)) {
    const ranks = [];
    let familyTruncated = 0;
    for (let i = 0; i < options.games; i++) {
      const seed = `${options.seed}|bots-mono|${family}|${i}`;
      const result = simulateGame({
        seed, lawId: law, skill: options.skill, population: options.population,
        maxRounds: options.maxRounds, takeTurn: (state, player) => naive(state, player, family),
      });
      if (!result.completed) { truncated.push(seed); familyTruncated++; continue; }
      completed++;
      totalRounds += result.rounds;
      ranks.push(result.state.players[0].rank);
    }
    families[family] = { ...summarizeRanks(ranks), requestedGames: options.games, truncatedGames: familyTruncated };
  }
  return {
    schemaVersion: 1, experiment: 'bots-mono',
    parameters: { gamesPerFamily: options.games, seed: options.seed, maxRounds: options.maxRounds, population: options.population, opponentSkill: options.skill },
    requestedGames: options.games * Object.keys(LAWS).length,
    completedGames: completed, truncatedGames: truncated.length, truncatedSeeds: truncated,
    meanRounds: completed ? totalRounds / completed : null,
    families,
    limitations: [
      'La politique naïve est comparée aux bots indiqués ; elle ne mesure pas la meilleure stratégie possible d’une famille.',
      'La politique naïve choisit désormais un hôte compatible pour l’Arrimage ; les anciens résultats pouvaient inclure des actions d’arrimage refusées et ne sont pas directement comparables.',
      'Les intervalles de Wilson à 95 % concernent les résultats du joueur focal, un par partie, pas les huit joueurs supposés indépendants.',
      'Les lois associées aux familles diffèrent : leurs effets et ceux des familles ne sont pas isolés.',
      ...(options.games < 100 ? ['Échantillon pilote par famille : trop peu de parties pour une conclusion précise.'] : []),
    ],
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2), { defaultGames: 10 });
  if (options.help) {
    console.log(argumentHelp('bots-mono.js').replace('[nombre]', '[nombre-par-famille]') + 'Le nombre demandé est répété pour chacune des 12 familles.');
    return;
  }
  const report = compareMono(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.completedGames}/${report.requestedGames} parties terminées ; ${report.truncatedGames} tronquées et exclues ; population ${options.population}, IA adverse ${options.skill}.`);
    for (const [family, summary] of Object.entries(report.families)) {
      const interval = summary.winRate95;
      console.log(`${family.padEnd(10)} rang ${summary.meanRank == null ? 'indisponible' : summary.meanRank.toFixed(2)} ; victoires ${summary.winRate == null ? 'indisponible' : (summary.winRate * 100).toFixed(1) + ' %'} ; IC95 ${interval ? '[' + (interval.low * 100).toFixed(1) + ', ' + (interval.high * 100).toFixed(1) + '] %' : 'indisponible'} ; n=${summary.n}`);
    }
    for (const warning of report.limitations) console.log(warning);
  }
  if (report.truncatedGames) process.exitCode = 2;
}

if (require.main === module) runCli(main);
module.exports = { LAWS, naive, compareMono };
