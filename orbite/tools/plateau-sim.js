// Tournois reproductibles du prototype à plateau commun, sans navigateur.
'use strict';
const P = require('../js/plateau.js');
const B = require('../js/plateau-bot.js');
const { wilsonInterval } = require('./lib/statistiques.js');

function integer(value, label, min, max) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new RangeError(`${label} doit être un entier de ${min} à ${max}.`);
  }
  return result;
}

function parseArguments(argv) {
  const options = { games: 60, players: 2, seed: 'plateau-v1', policy: 'mixed', json: false, help: false };
  let positional = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--seed', '--players', '--policy'].includes(arg)) {
      const value = argv[++i];
      if (value == null || value.startsWith('--')) throw new Error(`Valeur manquante pour ${arg}.`);
      if (arg === '--players') options.players = integer(value, 'Le nombre de joueurs', 2, 6);
      else if (arg === '--policy') {
        if (!['mixed', ...B.POLICIES].includes(value)) throw new Error(`Politique inconnue : ${value}.`);
        options.policy = value;
      } else {
        if (!value.trim()) throw new Error('La graine ne peut pas être vide.');
        options.seed = value;
      }
    } else if (!arg.startsWith('-') && !positional) {
      options.games = integer(arg, 'Le nombre de parties', 1, Number.MAX_SAFE_INTEGER);
      positional = true;
    } else throw new Error(`Argument inconnu : ${arg}. Utiliser --help.`);
  }
  return options;
}

function simulatePrototypeGame({ seed, players = 2, policy = 'mixed', gameIndex = 0 } = {}) {
  if (typeof seed !== 'string' || !seed.trim()) throw new TypeError('Une graine explicite est requise.');
  integer(players, 'Le nombre de joueurs', 2, 6);
  if (!['mixed', ...B.POLICIES].includes(policy)) throw new Error(`Politique inconnue : ${policy}.`);
  const roster = Array.from({ length: players }, (_, i) => ({ id: 'p' + i, name: 'Bot ' + (i + 1), kind: 'bot' }));
  const policies = Object.fromEntries(roster.map((player, i) => [
    player.id, policy === 'mixed' ? B.POLICIES[(i + gameIndex) % B.POLICIES.length] : policy,
  ]));
  const state = P.newGame({ seed, players: roster });
  let rounds = 0;
  try {
    P.assertState(state);
    while (state.phase !== 'over' && rounds <= P.LIMITS.maxRounds) {
      for (const player of state.players) {
        if (player.hp <= 0 || player.locked) continue;
        const result = B.prepareTurn(state, player.id, { policy: policies[player.id] });
        if (!result.ok) throw new Error('Préparation du bot refusée : ' + JSON.stringify(result));
        P.assertState(state);
      }
      const resolution = P.resolveRound(state);
      if (!resolution.ok) throw new Error(resolution.error || 'Résolution refusée.');
      P.assertState(state);
      rounds++;
    }
    if (state.phase !== 'over' || !state.result) throw new Error('Le prototype n’a pas respecté sa borne de fin de partie.');
    return {
      seed, rounds, policies,
      result: JSON.parse(JSON.stringify(state.result)),
      players: state.players.map(player => ({
        id: player.id, family: player.family, hp: player.hp, score: player.score,
      })),
      state,
    };
  } catch (error) {
    error.message = `[graine=${seed}, manche=${state.round}] ${error.message}`;
    throw error;
  }
}

function runTournament({ games = 60, players = 2, seed = 'plateau-v1', policy = 'mixed' } = {}) {
  integer(games, 'Le nombre de parties', 1, Number.MAX_SAFE_INTEGER);
  const rows = [];
  const byPolicy = {};
  const byFocalPolicy = {};
  const bySeat = {};
  const reasons = {};
  const started = Date.now();
  let draws = 0, rounds = 0;
  for (let i = 0; i < games; i++) {
    const game = simulatePrototypeGame({ seed: seed + '-' + i, players, policy, gameIndex: i });
    const row = { seed: game.seed, rounds: game.rounds, policies: game.policies, result: game.result, players: game.players };
    rows.push(row);
    rounds += game.rounds;
    if (game.result.draw) draws++;
    reasons[game.result.reason] = (reasons[game.result.reason] || 0) + 1;
    for (const player of game.players) {
      const playerPolicy = game.policies[player.id];
      const win = !game.result.draw && game.result.winner === player.id;
      const record = byPolicy[playerPolicy] || (byPolicy[playerPolicy] = { appearances: 0, wins: 0, draws: 0 });
      record.appearances++;
      record.wins += Number(win);
      record.draws += Number(game.result.draw);
      const seat = bySeat[player.id] || (bySeat[player.id] = { games: 0, wins: 0 });
      seat.games++;
      seat.wins += Number(win);
      if (player.id === 'p0') {
        const focal = byFocalPolicy[playerPolicy] || (byFocalPolicy[playerPolicy] = { games: 0, wins: 0, draws: 0 });
        focal.games++;
        focal.wins += Number(win);
        focal.draws += Number(game.result.draw);
      }
    }
  }
  for (const record of Object.values(byPolicy)) {
    record.winRate = record.wins / record.appearances;
    record.winRate95 = null;
  }
  for (const record of [...Object.values(byFocalPolicy), ...Object.values(bySeat)]) {
    record.winRate = record.wins / record.games;
    record.winRate95 = wilsonInterval(record.wins, record.games);
  }
  return {
    schemaVersion: 1,
    scope: 'Prototype de plateau commun ; observations contre ces politiques, sans certification d’équilibre.',
    config: { games, players, seed, policy },
    completed: games,
    wins: games - draws,
    draws,
    drawRate: draws / games,
    averageRounds: rounds / games,
    reasons,
    byPolicy,
    byFocalPolicy,
    bySeat,
    notes: [
      'Toutes les conditions de fin du prototype, dont les parties nulles prévues à la limite, sont comptabilisées.',
      'Les observations des joueurs d’une même partie sont corrélées : aucun intervalle indépendant pour byPolicy.',
      'Les intervalles Wilson à 95 % des places et du joueur focal utilisent une observation par graine.',
      'Un taux de victoire dépend des adversaires, des familles et du nombre de joueurs ; il ne mesure pas la puissance intrinsèque d’une famille.',
    ],
    elapsedSeconds: (Date.now() - started) / 1000,
    games: rows,
  };
}

function formatReport(report) {
  const percent = value => (value * 100).toFixed(1) + ' %';
  const lines = [
    `${report.completed} parties du prototype à ${report.config.players} joueurs · ${report.averageRounds.toFixed(1)} manches en moyenne`,
    `${report.wins} victoires · ${report.draws} parties nulles (${percent(report.drawRate)})`,
    'Fins de partie : ' + JSON.stringify(report.reasons),
    'Politiques (observations corrélées dans une même partie) :',
  ];
  for (const [name, record] of Object.entries(report.byPolicy)) {
    lines.push(`  ${name} : ${record.wins}/${record.appearances} victoires (${percent(record.winRate)}), ${record.draws} observations de parties nulles`);
  }
  lines.push('Mesures exploratoires du prototype ; ces résultats ne certifient pas son équilibrage.');
  return lines.join('\n');
}

function help() {
  return 'Usage : node orbite/tools/plateau-sim.js [nombre] [--players 2..6] [--policy mixed|balanced|aggressive|control] [--seed texte] [--json]\n' +
    'Le mode mixed fait varier les politiques et leurs places entre les parties.\n';
}

if (require.main === module) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log(help());
    else {
      const report = runTournament(options);
      console.log(options.json ? JSON.stringify(report, null, 2) : formatReport(report));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { parseArguments, simulatePrototypeGame, runTournament, formatReport };
