import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { wilsonInterval, summarizeRanks } = require('../tools/lib/statistiques.js');

test('Wilson : intervalle centré à 50 %, valeurs de référence à 95 %', () => {
  const ci = wilsonInterval(50, 100);
  assert.ok(Math.abs(ci.low - 0.4038315303659956) < 1e-12);
  assert.ok(Math.abs(ci.high - 0.5961684696340044) < 1e-12);
  assert.ok(Math.abs(ci.low + ci.high - 1) < 1e-12);
});

test('Wilson : zéro victoire et toutes les victoires gardent une incertitude', () => {
  const zero = wilsonInterval(0, 10);
  const all = wilsonInterval(10, 10);
  assert.ok(Math.abs(zero.low) < 1e-15);
  assert.ok(zero.high > 0.27 && zero.high < 0.28);
  assert.ok(all.low > 0.72 && all.low < 0.73);
  assert.ok(Math.abs(all.high - 1) < 1e-15);
  assert.ok(Math.abs(zero.high + all.low - 1) < 1e-12);
});

test('Wilson : davantage d’essais resserre l’intervalle à proportion constante', () => {
  const small = wilsonInterval(5, 10);
  const large = wilsonInterval(500, 1000);
  assert.ok(large.low > small.low);
  assert.ok(large.high < small.high);
  assert.equal(wilsonInterval(0, 0), null);
});

test('résumé : moyenne, victoires et top 3 sans arrondir les taux', () => {
  const ranks = [1, 1, 2, 3, 8, 8];
  const before = ranks.slice();
  const result = summarizeRanks(ranks);
  assert.equal(result.n, 6);
  assert.equal(result.meanRank, 23 / 6);
  assert.equal(result.wins, 2);
  assert.equal(result.winRate, 1 / 3);
  assert.equal(result.top3, 4);
  assert.equal(result.top3Rate, 2 / 3);
  assert.ok(result.winRate95.low < result.winRate);
  assert.ok(result.winRate95.high > result.winRate);
  assert.deepEqual(ranks, before);
});

test('résumé vide : aucun résultat inventé et JSON sans NaN', () => {
  const expected = {
    n: 0, meanRank: null, wins: 0, winRate: null,
    top3: 0, top3Rate: null, winRate95: null,
  };
  assert.deepEqual(summarizeRanks([]), expected);
  assert.deepEqual(JSON.parse(JSON.stringify(summarizeRanks([]))), expected);
});

test('observations dépendantes : conserver les mesures, omettre l’intervalle indépendant', () => {
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8];
  const dependent = summarizeRanks(ranks, { independent: false });
  assert.equal(dependent.n, 8);
  assert.equal(dependent.meanRank, 4.5);
  assert.equal(dependent.winRate, 1 / 8);
  assert.equal(dependent.winRate95, null);
  assert.notEqual(summarizeRanks(ranks).winRate95, null);
});

test('entrées invalides : rejeter nombres négatifs, fractions et tailles incohérentes', () => {
  for (const [wins, n] of [[-1, 5], [1, -5], [6, 5], [1, 0], [0.5, 5], [1, 2.5], [NaN, 3], [0, Infinity], [0, Number.MAX_SAFE_INTEGER + 1]]) {
    assert.throws(() => wilsonInterval(wins, n), RangeError);
  }
  for (const ranks of [[0], [-1], [1.5], [NaN], [Infinity], [Number.MAX_SAFE_INTEGER + 1]]) {
    assert.throws(() => summarizeRanks(ranks), RangeError);
  }
  assert.throws(() => summarizeRanks('1,2'), TypeError);
  assert.throws(() => summarizeRanks([1], { independent: 'true' }), TypeError);
});
