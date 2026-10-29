// Équilibrage des familles en duel (v107) : l'IA experte joue chaque famille (sa loi) contre une IA
// experte, N duels par famille ; 50 % = exactement la moyenne. node orbite/tools/familles.js 200 [fam,…]
const R = require('../js/rules.js');
const N = Number(process.argv[2]) || 200;
const only = (process.argv[3] || '').split(',').filter(Boolean);
const rows = [];
for (const law of R.LAWS.filter((l) => l.fam !== 'neutre' && (!only.length || only.includes(l.fam)))) {
  let wins = 0;
  for (let g = 0; g < N; g++) {
    const s = R.newGame('fam-' + law.id + '-' + g, law.id, { size: 2 });
    s.players[0].skill = 1;
    for (let i = 0; i < 80 && !s.over; i++) { R.botTurn(s, s.players[0]); R.endTurn(s); }
    if (s.rank === 1) wins++;
  }
  rows.push([law.fam, wins / N]);
}
rows.sort((a, b) => b[1] - a[1]);
for (const [fam, w] of rows) console.log(fam.padEnd(10), String(Math.round(w * 100)).padStart(3) + ' %', '± ' + Math.round(100 * 1.96 * Math.sqrt(w * (1 - w) / N)));
