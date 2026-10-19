// Équilibrage (node orbite/tools/equilibrage.js 3000) : parties entières jouées par les bots (le joueur 0 aussi, avec la même IA).
// Rang exact pour chaque univers éliminé ; les survivants quand la partie s'arrête sont classés par PV.
const R = require('../js/rules.js');
const N = Number(process.argv[2] || 3000);
const byLaw = {}, byLaw0 = {}, byFam = {}, byCard = {}, byNfam = {}, byTier = {};
let rounds = 0, golds = 0;
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const s = R.newGame('bal2-' + g, R.LAWS[g % R.LAWS.length].id);
  while (!s.over) { R.botTurn(s, s.players[0]); R.endTurn(s); }
  const alive = s.players.filter((p) => p.alive).sort((a, b) => b.hp - a.hp);
  let place = 1;
  for (const p of alive) if (!p.rank || p.alive) p.rank = place++;
  rounds += s.round;
  for (const p of s.players) {
    const rec = (m, k) => (m[k] = m[k] || []).push(p.rank);
    rec(byLaw, p.law);
    if (p.id === s.players[0].id) rec(byLaw0, p.law);
    const fams = {};
    for (const u of p.board) { const f = R.famOf(u); if (f !== 'neutre') fams[f] = (fams[f] || 0) + 1; if (u.golden) golds++; }
    const top = Object.entries(fams).sort((a, b) => b[1] - a[1])[0];
    rec(byFam, top && top[1] >= 3 ? top[0] : 'mixte');
    rec(byNfam, Object.keys(fams).length);
    rec(byTier, p.tier);
    for (const id of new Set(p.board.map((u) => u.id))) rec(byCard, id);
  }
}
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const pct = (a, f) => Math.round(a.filter(f).length / a.length * 100);
const line = (k, v) => `${k.padEnd(12)} rang moyen ${avg(v).toFixed(2)}  1er ${String(pct(v, (r) => r === 1)).padStart(2)} %  top 3 ${String(pct(v, (r) => r <= 3)).padStart(2)} %  (n=${v.length})`;
console.log(`${N} parties, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${(rounds / N).toFixed(1)} cycles en moyenne (jusqu'à la fin du joueur 0)`);
console.log('\n— Lois (joueur 0, rang exact) —');
for (const [k, v] of Object.entries(byLaw0).sort((a, b) => avg(a[1]) - avg(b[1]))) console.log(line(R.LAW[k].fam + '/' + k, v));
console.log('\n— Lois (tous les univers) —');
for (const [k, v] of Object.entries(byLaw).sort((a, b) => avg(a[1]) - avg(b[1]))) console.log(line(k, v));
console.log('\n— Famille dominante du système final (3 astres ou plus) —');
for (const [k, v] of Object.entries(byFam).sort((a, b) => avg(a[1]) - avg(b[1]))) console.log(line(k, v));
console.log('\n— Nombre de familles dans le système final —');
for (const [k, v] of Object.entries(byNfam).sort((a, b) => a[0] - b[0])) console.log(line(k + ' famille(s)', v));
console.log('\n— Astres (présents dans le système final, n ≥ 200) —');
const cards = Object.entries(byCard).filter(([, v]) => v.length >= 200).sort((a, b) => avg(a[1]) - avg(b[1]));
const show = ([k, v]) => `${R.CARD[k].name.padEnd(16)} ${R.CARD[k].fam.padEnd(8)} niv ${R.CARD[k].tier}  rang moyen ${avg(v).toFixed(2)}  (n=${v.length})`;
console.log('Les plus associés aux bons classements :');
cards.slice(0, 10).forEach((c) => console.log('  ' + show(c)));
console.log('Les plus associés aux mauvais classements :');
cards.slice(-10).forEach((c) => console.log('  ' + show(c)));
const rare = Object.keys(R.CARD).filter((id) => !R.CARD[id].token && (!byCard[id] || byCard[id].length < 200));
console.log('Peu joués par les bots (< 200 systèmes finaux) :', rare.map((id) => R.CARD[id].name).join(', ') || 'aucun');
console.log('\nAstres dorés dans les systèmes finaux :', (golds / (N * 8)).toFixed(2), 'par univers');
