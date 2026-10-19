// Compositions hybrides (node orbite/tools/hybrides.js 3000) : dans chaque partie, la moitié des univers
// vise une seule famille (celle de sa loi), l'autre moitié deux familles (sa loi + une autre famille
// active). Tous jouent avec l'IA experte. Rang moyen attendu à égalité : 4,5.
const R = require('../js/rules.js');
const N = Number(process.argv[2] || 3000);
const res = { mono: [], duo: [] }, byPair = {};
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const s = R.newGame('hyb-' + g, R.LAWS[g % R.LAWS.length].id);
  s.players.forEach((p, i) => {
    p.skill = 1;
    p.pref = R.LAW[p.law].fam;
    p.pref2 = null;
    if ((i + g) % 2) {
      const others = s.families.filter((f) => f !== p.pref);
      p.pref2 = others[(g * 7 + i * 3) % others.length];
    }
  });
  while (!s.over && s.round < 60) { R.botTurn(s, s.players[0]); R.endTurn(s); }
  const alive = s.players.filter((p) => p.alive).sort((a, b) => b.hp - a.hp);
  let place = 1;
  for (const p of alive) p.rank = place++;
  for (const p of s.players) {
    if (p.pref2) {
      res.duo.push(p.rank);
      const k = [p.pref, p.pref2].sort().join(' + ');
      (byPair[k] = byPair[k] || []).push(p.rank);
    } else res.mono.push(p.rank);
  }
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const pct = (a, f) => Math.round(a.filter(f).length / a.length * 100);
const line = (k, v) => `${k.padEnd(22)} rang ${avg(v).toFixed(2)}  victoires ${String(pct(v, (r) => r === 1)).padStart(2)} %  top 3 ${String(pct(v, (r) => r <= 3)).padStart(2)} %  (n=${v.length})`;
console.log(line('une famille', res.mono));
console.log(line('deux familles', res.duo));
const pairs = Object.entries(byPair).filter(([, v]) => v.length >= 40).sort((a, b) => avg(a[1]) - avg(b[1]));
const viable = pairs.filter(([, v]) => avg(v) <= 4.75).length;
console.log(`duos jouables (rang ≤ 4,75) : ${viable} / ${pairs.length}`);
if (process.argv.includes('--detail')) pairs.forEach(([k, v]) => console.log('  ' + line(k, v)));
console.log(`${N} parties en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
