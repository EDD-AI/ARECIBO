// Tournois hors interface. Les règles du jeu restent celles de rules.js.
const assert = require('node:assert/strict');
const R = require('../../js/rules.js');

const POPULATIONS = ['balanced', 'game'];

function positiveInteger(value, label) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`${label} doit être un entier strictement positif.`);
  return n;
}

function parseArguments(argv, { defaultGames = 120, detail = false } = {}) {
  const options = { games: defaultGames, seed: 'balance-v1', maxRounds: 80, population: 'balanced', skill: 1, json: false, detail: false, help: false };
  let positional = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--detail' && detail) options.detail = true;
    else if (['--seed', '--max-rounds', '--population', '--skill'].includes(arg)) {
      const value = argv[++i];
      if (value == null || value.startsWith('--')) throw new Error(`Valeur manquante pour ${arg}.`);
      if (arg === '--seed') {
        if (!value.trim()) throw new Error('La graine ne peut pas être vide.');
        options.seed = value;
      } else if (arg === '--max-rounds') options.maxRounds = positiveInteger(value, arg);
      else if (arg === '--population') {
        if (!POPULATIONS.includes(value)) throw new Error(`Population inconnue : ${value}. Choisir balanced ou game.`);
        options.population = value;
      } else {
        if (!['0', '1'].includes(value)) throw new Error('--skill accepte seulement 0 ou 1.');
        options.skill = Number(value);
      }
    } else if (!arg.startsWith('-') && !positional) {
      options.games = positiveInteger(arg, 'Le nombre de parties');
      positional = true;
    } else throw new Error(`Argument inconnu : ${arg}. Utiliser --help.`);
  }
  return options;
}

function argumentHelp(command) {
  return `Usage : node orbite/tools/${command} [nombre] [--json] [--seed texte] [--max-rounds 80] [--population balanced|game] [--skill 0|1]\n` +
    'balanced : lois adverses réparties sans les poids FAM_POWER, même IA et même préférence de départ.\n' +
    'game : distribution des adversaires du jeu actuel ; même niveau d’IA, préférences et tempéraments du jeu conservés.\n' +
    'Les simulations atteignant la limite sont signalées et exclues des statistiques de parties terminées.\n';
}

function seedOffset(seed, modulo) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % modulo;
}

function createSimulation({ seed, lawId, skill = 1, population = 'balanced' }) {
  if (typeof seed !== 'string' || !seed) throw new TypeError('Une graine explicite est requise.');
  if (typeof lawId !== 'string' || !Object.prototype.hasOwnProperty.call(R.LAW, lawId)) throw new TypeError(`Loi inconnue : ${lawId}.`);
  if (![0, 1].includes(skill)) throw new RangeError('Le niveau d’IA doit être 0 ou 1.');
  if (!POPULATIONS.includes(population)) throw new TypeError(`Population inconnue : ${population}.`);
  let state = R.newGame(seed, lawId);
  if (population === 'balanced') {
    // Conserve la sélection de familles conditionnée par la loi du joueur0, comme dans le jeu.
    // Chaque loi éligible a une chance identique d'entrer dans le roster ; ce n'est pas une
    // preuve de force intrinsèque des familles, et les lois neutres restent éligibles.
    const families = state.families;
    const eligible = R.LAWS.filter(l => l.fam === 'neutre' || families.includes(l.fam));
    const offset = seedOffset(seed + '|roster', eligible.length);
    const botLaws = Array.from({ length: state.players.length - 1 }, (_, i) => eligible[(offset + i) % eligible.length].id);
    state = R.newGame(seed, lawId, { families, botLaws });
    state.players.forEach((p, i) => {
      p.greed = 0;
      p.pref = R.LAW[p.law].fam === 'neutre' ? families[(offset + i) % families.length] : R.LAW[p.law].fam;
      p.pref2 = null;
    });
  }
  for (const p of state.players) p.skill = skill;
  return state;
}

function auditState(state) {
  assert.deepEqual(R.poolAudit(state), state.poolTotal, 'La réserve doit être conservée.');
  for (const count of Object.values(state.pool)) assert.ok(Number.isInteger(count) && count >= 0, 'Stock invalide.');
  const ids = new Set();
  for (const p of state.players) {
    if (!p.alive) continue;
    assert.ok(p.board.length <= R.BOARD_MAX, 'Plateau trop grand.');
    assert.ok(p.hand.length <= R.HAND_MAX, 'Main trop grande.');
    assert.ok(Number.isFinite(p.gold) && p.gold >= 0, 'Énergie invalide.');
    assert.ok(Number.isFinite(p.hp) && p.hp > 0, 'Joueur vivant sans PV.');
    for (const u of p.board.concat(p.hand)) {
      assert.ok(!ids.has(u.uid), 'Identifiant d’astre dupliqué.');
      ids.add(u.uid);
      assert.ok(Number.isFinite(u.atk) && u.atk >= 0 && Number.isFinite(u.hp) && u.hp > 0, 'Statistiques d’astre invalides.');
    }
  }
}

// Observations d'historique uniquement : une série d'égalités ne prouve pas
// que la partie est bloquée, ni qu'une règle ou une stratégie est défectueuse.
function historyDiagnostics(history = []) {
  if (!Array.isArray(history)) throw new TypeError('L’historique doit être un tableau.');
  const diagnostics = {
    consecutiveDrawRounds: 0,
    drawRounds: 0,
    drawCombats: 0,
    decisiveCombats: 0,
    lastDecisiveCombatRound: null,
    lastEliminationRound: null,
  };
  for (const entry of history) {
    const results = Array.isArray(entry.results) ? entry.results : [];
    const fallen = Array.isArray(entry.fallen) ? entry.fallen : [];
    for (const result of results) {
      if (result.winner === -1) diagnostics.drawCombats++;
      else if (result.winner === 0 || result.winner === 1) {
        diagnostics.decisiveCombats++;
        diagnostics.lastDecisiveCombatRound = entry.round;
      }
    }
    if (fallen.length) diagnostics.lastEliminationRound = entry.round;
    const drawRound = results.length > 0 && fallen.length === 0 &&
      results.every(result => result.winner === -1 && !(result.damage > 0));
    if (drawRound) {
      diagnostics.drawRounds++;
      diagnostics.consecutiveDrawRounds++;
    } else diagnostics.consecutiveDrawRounds = 0;
  }
  return diagnostics;
}

function simulateGame({ seed, lawId, skill = 1, population = 'balanced', maxRounds = 80, setup, takeTurn } = {}) {
  positiveInteger(maxRounds, 'La limite de manches');
  const state = createSimulation({ seed, lawId, skill, population });
  if (setup) setup(state);
  let rounds = 0;
  try {
    auditState(state);
    while (!state.over && rounds < maxRounds) {
      if (state.players[0].alive) {
        (takeTurn || R.botTurn)(state, state.players[0]);
        auditState(state);
      }
      const result = R.endTurn(state, { observer: true });
      assert.equal(result.ok, true, result.error || 'La manche n’a pas pu être résolue.');
      auditState(state);
      rounds++;
    }
    const completed = state.over && R.alivePlayers(state).length <= 1;
    if (completed) {
      assert.deepEqual(state.players.map(p => p.rank).sort((a, b) => a - b), state.players.map((_, i) => i + 1), 'Classement final incomplet ou dupliqué.');
    }
    return {
      state, completed, rounds, reason: completed ? 'finished' : 'round-limit',
      diagnostics: historyDiagnostics(state.history),
    };
  } catch (error) {
    error.message = `[graine=${seed}, manche=${state.round}] ${error.message}`;
    throw error;
  }
}

function addRank(map, key, rank) {
  if (!map[key]) map[key] = [];
  map[key].push(rank);
}

function runCli(main) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { R, POPULATIONS, positiveInteger, parseArguments, argumentHelp, createSimulation, auditState, historyDiagnostics, simulateGame, addRank, runCli };
