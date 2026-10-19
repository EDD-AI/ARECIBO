// Équilibrage de la campagne : une IA simple joue des expéditions complètes.
// node orbite/tools/campagne-sim.js [parties]
const C = require('../js/campagne.js');
const N = Number(process.argv[2] || 2000);

// IA de combat : pouvoirs d'abord, se protège si l'attaque annoncée dépasse le Bouclier, sinon frappe
// l'ennemi le plus faible. Elle joue moins bien qu'un humain attentif.
function playTurn(run) {
  const c = run.combat;
  for (let guard = 0; guard < 30 && c.energy >= 0; guard++) {
    if (run.over || c.done) return;
    const incoming = C.alive(c).reduce((s, u) => { const i = C.intentOf(run, u); return s + (i.atk || 0) * (i.hits || 0); }, 0);
    const playable = c.hand.filter((k) => C.costOf(k) <= c.energy);
    if (!playable.length) return;
    const def = (k) => C.CARDS[k.id];
    const score = (k) => {
      const d = def(k);
      if (d.type === 'pouvoir') return 100;
      if (k.id === 'etincelle' || k.id === 'aurore') return 90;
      if (d.type === 'defense' && incoming > c.block) return 60 + (d.ops[0][1][k.up ? 1 : 0] || 0);
      if (d.type === 'attaque') return 40 + C.costOf(k);
      if (k.id === 'photosynthese') return run.hp < run.maxHp - 6 ? 50 : 1;
      return 5;
    };
    playable.sort((a, b) => score(b) - score(a));
    const k = playable[0];
    if (score(k) < 5) return;
    // Un joueur attentif abat d'abord les lunes que Kronos s'apprête à dévorer.
    const foes = C.alive(c);
    const boss = foes.find((u) => C.ENEMIES[u.id].boss);
    const devour = boss && C.intentOf(run, boss).kinds.includes('devour');
    const target = (devour && foes.find((u) => C.ENEMIES[u.id].minion)) || foes.slice().sort((a, b) => a.hp - b.hp)[0];
    const r = C.play(run, k.uid, target && target.uid);
    if (!r.ok) return;
  }
}

function playRun(seed) {
  const run = C.newRun(seed);
  let steps = 0;
  while (!run.over && steps++ < 200) {
    const opts = C.choices(run);
    if (!opts.length) break;
    // Préfère les sanctuaires quand les PV sont bas, évite les élites si faible.
    const nodes = opts.map((id) => C.nodeById(run, id));
    nodes.sort((a, b) => pref(run, b) - pref(run, a));
    const res = C.enter(run, nodes[0].id);
    if (res.kind === 'combat') {
      let turns = 0;
      while (!run.over && !run.combat.done && turns++ < 60) { playTurn(run); if (!run.over && !run.combat.done) C.endTurn(run); }
      if (run.over) break;
      const r = C.rewards(run);
      const best = r.cards.find((id) => ['eruption', 'meteores', 'noyau', 'tectonique', 'lune', 'croute', 'supernova', 'champ', 'abysse'].includes(id)) || r.cards[0];
      C.takeCard(run, best);
    } else if (res.kind === 'event') {
      const out = C.resolveEvent(run, run.hp > 30 ? 0 : 1);
      if (out.pending === 'remove') { const s = run.deck.find((d) => d.id === 'atmosphere') || run.deck[0]; C.removeCard(run, s.uid); }
    } else if (res.kind === 'rest') {
      if (run.hp < run.maxHp * 0.6) C.rest(run, 'repos');
      else { const d = C.upgradable(run).find((x) => C.CARDS[x.id].type !== 'defense') || C.upgradable(run)[0]; if (d) C.upgrade(run, d.uid); }
    }
  }
  return run;
}
function pref(run, n) {
  const low = run.hp < run.maxHp * 0.45;
  return { rest: low ? 5 : 1, combat: 3, event: 2.5, elite: low ? 0 : 2, boss: 9 }[n.type];
}

const out = { wins: 0, floors: [], diedTo: {}, hpAtBoss: [], deck: [] };
for (let i = 0; i < N; i++) {
  const run = playRun(1000 + i * 7919);
  if (run.won) out.wins++;
  out.floors.push(run.floor);
  if (!run.won) {
    const n = run.node ? C.nodeById(run, run.node) : null;
    const k = n ? (n.type === 'boss' ? 'Kronos' : n.type + ' r' + n.row) : '?';
    out.diedTo[k] = (out.diedTo[k] || 0) + 1;
  }
  out.deck.push(run.deck.length);
}
const avg = (a) => (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1);
console.log(`${N} expéditions · victoires ${(out.wins / N * 100).toFixed(1)} % · étage moyen ${avg(out.floors)} · cartes ${avg(out.deck)}`);
console.log('Défaites :', Object.entries(out.diedTo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / N * 100).toFixed(1)} %`).join(' · '));
