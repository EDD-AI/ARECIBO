// Force des bots (node orbite/tools/bots-duel.js 1500) : dans chaque partie, la moitié des univers
// joue avec l'IA experte (skill 1), l'autre moitié avec l'IA de base (skill 0). Rang moyen attendu
// à égalité : 4,5. Plus il est bas, plus l'IA experte est forte.
const R = require('../js/rules.js');
const N = Number(process.argv[2] || 1500);
const ranks = { 0: [], 1: [] };
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const s = R.newGame('duel-' + g, R.LAWS[g % R.LAWS.length].id);
  s.players.forEach((p, i) => { p.skill = (i + g) % 2; });
  while (!s.over && s.round < 60) { R.botTurn(s, s.players[0]); R.endTurn(s); }
  const alive = s.players.filter((p) => p.alive).sort((a, b) => b.hp - a.hp);
  let place = 1;
  for (const p of alive) p.rank = place++;
  for (const p of s.players) ranks[p.skill].push(p.rank);
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (a, f) => Math.round(a.filter(f).length / a.length * 100);
for (const k of [1, 0]) console.log(`${k ? 'experte' : 'de base'}  rang moyen ${avg(ranks[k]).toFixed(2)}  1er ${pct(ranks[k], (r) => r === 1)} %  top 3 ${pct(ranks[k], (r) => r <= 3)} %`);
console.log(`${N} parties en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
