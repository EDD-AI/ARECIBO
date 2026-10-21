// Statistiques des simulations. Les observations corrélées d'une même partie
// ne doivent pas être présentées comme des essais de Bernoulli indépendants.
'use strict';

const Z_95 = 1.959963984540054;

function count(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} doit être un entier sûr positif ou nul.`);
  }
}

function wilsonInterval(wins, n) {
  count(n, 'n');
  count(wins, 'wins');
  if (wins > n) throw new RangeError('wins ne peut pas dépasser n.');
  if (n === 0) return null;

  const p = wins / n;
  const z2 = Z_95 * Z_95;
  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const margin = Z_95 * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denominator;
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function summarizeRanks(ranks, { independent = true } = {}) {
  if (!Array.isArray(ranks)) throw new TypeError('ranks doit être un tableau.');
  if (typeof independent !== 'boolean') throw new TypeError('independent doit être un booléen.');
  for (const rank of ranks) {
    if (!Number.isSafeInteger(rank) || rank < 1) {
      throw new RangeError('Chaque rang doit être un entier sûr strictement positif.');
    }
  }

  const n = ranks.length;
  const wins = ranks.filter(rank => rank === 1).length;
  const top3 = ranks.filter(rank => rank <= 3).length;
  return {
    n,
    meanRank: n ? ranks.reduce((sum, rank) => sum + rank, 0) / n : null,
    wins,
    winRate: n ? wins / n : null,
    top3,
    top3Rate: n ? top3 / n : null,
    winRate95: independent ? wilsonInterval(wins, n) : null,
  };
}

module.exports = { wilsonInterval, summarizeRanks };
