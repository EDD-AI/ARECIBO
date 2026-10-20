// Le joueur « naïf » contre les bots (node orbite/tools/bots-mono.js 150) : il joue une seule
// famille, achète tout ce qui en est, monte de niveau dès qu'il peut et complète avec n'importe
// quoi. Pour chaque famille : sa part de victoires (12,5 % = autant que chaque bot).
const R = require('../js/rules.js');
const N = Number(process.argv[2] || 150);
const LAWS = { vie: 'symbiose', cristal: 'resonance', lune: 'marees', tempete: 'vents', glace: 'stase', mineral: 'gravite', neant: 'entropie', brasier: 'combustion', machine: 'ingenierie', comete: 'passage', envers: 'renversement', anomalie: 'chaos' };
function naive(st, p, fam) {
  const val = (u) => u.atk + u.hp + R.CARD[u.id].tier * 2 + (R.famOf(u) === fam ? 10 : 0) + (u.golden ? 6 : 0);
  const deploy = () => {
    for (let g = 0; g < 30; g++) {
      if (p.discover.length) { R.choose(st, Math.max(0, p.discover.findIndex((id) => R.CARD[id].fam === fam)), p); continue; }
      if (!p.hand.length) break;
      const u = p.hand.slice().sort((a, b) => val(b) - val(a))[0];
      if (p.board.length >= R.BOARD_MAX) { const weak = p.board.slice().sort((a, b) => val(a) - val(b))[0]; if (val(u) <= val(weak)) { R.sell(st, u.uid, p); continue; } R.sell(st, weak.uid, p); }
      if (u.kw.includes('arrimage') && p.board[0]) { R.play(st, u.uid, null, p.board[0].uid, p); continue; }
      R.play(st, u.uid, p.board.length, null, p);
    }
  };
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
const t0 = Date.now(), rows = [];
for (const [fam, law] of Object.entries(LAWS)) {
  const ranks = [];
  for (let i = 0; i < N; i++) {
    const st = R.newGame('mono-' + fam + '-' + i, law);
    for (let r = 0; r < 60 && !st.over; r++) { naive(st, st.players[0], fam); R.endTurn(st); }
    ranks.push(st.rank || st.players[0].rank);
  }
  const win = Math.round(ranks.filter((r) => r === 1).length / N * 100), avg = ranks.reduce((a, b) => a + b, 0) / N;
  rows.push([fam, win, avg]);
  console.log(`${fam.padEnd(9)} 1er ${String(win).padStart(2)} %  rang moyen ${avg.toFixed(2)}`);
}
console.log(`moyenne : ${(rows.reduce((s, r) => s + r[1], 0) / rows.length).toFixed(1)} % de victoires · ${N * rows.length} parties en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
