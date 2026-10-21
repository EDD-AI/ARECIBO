// Contrats et scénarios du plateau commun : node --test orbite/tests/plateau.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const P = createRequire(import.meta.url)('../js/plateau.js');

function game(count = 2, families = ['lune']) {
  return P.newGame({
    seed: 'plateau-tests',
    players: Array.from({ length: count }, (_, i) => ({
      id: `p${i}`, name: `Joueur ${i}`, kind: 'human', family: families[i % families.length],
    })),
  });
}

const player = (state, id = 'p0') => state.players.find(p => p.id === id);
const unit = (state, id) => state.units.find(u => u.id === id);
const owned = (state, id = 'p0') => state.units.filter(u => u.owner === id);
const piece = (state, id = 'p0', role = 'frappeur') => owned(state, id).find(u => P.CARDS[u.cardId].role === role);
const card = (family, role = 'frappeur') => Object.values(P.CARDS).find(c => c.family === family && c.role === role);
const hasNode = (nodes, ring, sector) => nodes.some(n => n.ring === ring && n.sector === sector);

function act(state, id, command) {
  const result = P.action(state, id, command);
  assert.equal(result.ok, true, result.error || JSON.stringify(command));
  P.assertState(state);
  return result;
}

function refused(state, id, command) {
  const before = P.serialize(state);
  const result = P.action(state, id, command);
  assert.equal(result.ok, false, JSON.stringify(command));
  assert.equal(typeof result.error, 'string');
  assert.ok(result.error.length);
  assert.equal(P.serialize(state), before, 'un refus doit préserver tout l’état, y compris les compteurs');
}

function emptyBoard(state) {
  for (const u of state.units) u.node = null;
  P.assertState(state);
}

function offer(state, id, cardId) {
  const p = player(state, id);
  const old = p.shop[0];
  if (old !== cardId) {
    if (old) state.pool[old]++;
    assert.ok(state.pool[cardId] > 0, 'la fixture doit réserver une copie disponible');
    state.pool[cardId]--;
    p.shop[0] = cardId;
  }
  P.assertState(state);
}

function purchase(state, id, cardId) {
  const p = player(state, id);
  p.tier = Math.max(p.tier, P.CARDS[cardId].tier);
  while (p.shop.length < (p.tier === 2 ? 4 : 3)) p.shop.push(null);
  p.gold = 10;
  offer(state, id, cardId);
  const previous = new Set(state.units.map(u => u.id));
  act(state, id, { type: 'buy', slot: 0 });
  return owned(state, id).find(u => !previous.has(u.id));
}

function lockAll(state) {
  for (const p of state.players) if (p.hp > 0 && !p.locked) act(state, p.id, { type: 'lock' });
}

function resolve(state) {
  lockAll(state);
  const result = P.resolveRound(state);
  assert.equal(result.ok, true, result.error);
  P.assertState(state);
  // Les scénarios de victoire, de score ex aequo et de nulle doivent aussi
  // produire des sauvegardes terminales que la validation stricte accepte.
  if (result.over) assert.deepEqual(P.restore(P.serialize(state)), state);
  return result;
}

function conserved(state) {
  P.assertState(state);
  const copies = { ...state.pool };
  for (const p of state.players) for (const id of p.shop) if (id) copies[id]++;
  for (const u of state.units) copies[u.cardId] += u.golden ? 3 : 1;
  assert.deepEqual(copies, state.poolTotal, 'boutiques, astres et réserve doivent conserver toutes les copies');
}

test('géométrie et départ : de deux à six joueurs, étoiles, relais et unités distinctes', () => {
  for (const count of [2, 3, 5, 6]) {
    const state = game(count);
    assert.equal(state.v, 1);
    assert.equal(state.round, 1);
    assert.equal(state.players.length, count);
    assert.equal(state.sectors, 6 * count);
    assert.equal(state.units.length, 2 * count);
    assert.equal(new Set(state.units.map(u => u.id)).size, state.units.length);
    assert.deepEqual(state.players.map(p => p.home), Array.from({ length: count }, (_, i) => 6 * i));
    assert.ok(state.players.every(p => p.hp === 18 && p.gold === 4 && p.score === 0 && !p.locked));
    assert.equal(state.result, null);
    conserved(state);
  }
});

test('création : refuser les formats, identités et types de joueurs invalides', () => {
  for (const count of [0, 1, 7]) assert.throws(() => game(count));
  const valid = [{ id: 'a', name: 'A', kind: 'human' }, { id: 'b', name: 'B', kind: 'bot' }];
  assert.throws(() => P.newGame({ seed: 'invalid', players: [valid[0], { ...valid[1], id: 'a' }] }));
  assert.throws(() => P.newGame({ seed: 'invalid', players: [valid[0], { ...valid[1], kind: 'unknown' }] }));
  assert.throws(() => P.newGame({ seed: 'invalid', players: [valid[0], { ...valid[1], family: 'unknown' }] }));
});

test('catalogue : douze familles et trois rôles, avec coûts et portées explicites', () => {
  const cards = Object.values(P.CARDS);
  assert.equal(cards.length, 36);
  assert.equal(new Set(cards.map(c => c.family)).size, 12);
  for (const family of new Set(cards.map(c => c.family))) {
    assert.deepEqual(cards.filter(c => c.family === family).map(c => c.role).sort(), ['artilleur', 'frappeur', 'sentinelle']);
  }
  const sentinel = card('lune', 'sentinelle'), striker = card('lune'), gunner = card('lune', 'artilleur');
  assert.deepEqual([sentinel.attack, sentinel.maxHp, sentinel.armor, sentinel.move, sentinel.range, sentinel.cost, sentinel.tier], [2, 8, 1, 1, 1, 3, 1]);
  assert.deepEqual([striker.attack, striker.maxHp, striker.armor, striker.move, striker.range, striker.cost], [3, 6, 0, 1, 1, 3]);
  assert.deepEqual([gunner.attack, gunner.maxHp, gunner.armor, gunner.move, gunner.range, gunner.cost, gunner.tier], [3, 4, 0, 1, 2, 4, 2]);
});

test('authentification et refus : impossible de vendre ou commander l’astre d’un autre joueur', () => {
  const state = game();
  const enemy = piece(state, 'p1');
  refused(state, 'missing', { type: 'lock' });
  refused(state, 'p0', { type: 'sell', unitId: enemy.id });
  refused(state, 'p0', { type: 'order', unitId: enemy.id, order: { type: 'guard' } });
  refused(state, 'p0', { type: 'order', unitId: 'missing', order: { type: 'guard' } });
  refused(state, 'p0', { type: 'unknown' });
  enemy.node = null;
  P.assertState(state);
  refused(state, 'p0', { type: 'deploy', unitId: enemy.id, node: P.deployNodes(state, 'p0')[0] });
});

test('achats et déploiements : coût réel, case occupée, zone de départ et réserve', () => {
  const state = game();
  const p = player(state);
  const id = p.shop[0], cost = P.CARDS[id].cost;
  const before = p.gold;
  const purchased = new Set(state.units.map(u => u.id));
  act(state, p.id, { type: 'buy', slot: 0 });
  const u = owned(state).find(u => !purchased.has(u.id));
  assert.ok(u);
  assert.equal(u.node, null);
  assert.equal(player(state).gold, before - cost);
  conserved(state);
  refused(state, p.id, { type: 'deploy', unitId: u.id, node: { ring: 0, sector: p.home } });
  refused(state, p.id, { type: 'deploy', unitId: u.id, node: piece(state).node });
  const destination = P.deployNodes(state, p.id)[0];
  assert.ok(destination);
  act(state, p.id, { type: 'deploy', unitId: u.id, node: destination });
  assert.deepEqual(unit(state, u.id).node, destination);
  refused(state, p.id, { type: 'deploy', unitId: u.id, node: destination });
  conserved(state);
});

test('boutique : une actualisation coûte une énergie et un refus ne consomme pas le hasard', () => {
  const state = game();
  const p = player(state), before = p.gold;
  act(state, p.id, { type: 'refresh' });
  assert.equal(player(state).gold, before - 1);
  conserved(state);
  player(state).gold = 0;
  refused(state, p.id, { type: 'refresh' });
  refused(state, p.id, { type: 'buy', slot: 0 });
  refused(state, p.id, { type: 'buy', slot: -1 });
  refused(state, p.id, { type: 'buy', slot: 999 });
});

test('gel et manche suivante : conserver la boutique et renouveler le budget', () => {
  const state = game(), p = player(state);
  emptyBoard(state);
  const shop = p.shop.slice();
  act(state, p.id, { type: 'freeze' });
  player(state).gold = 0;
  resolve(state);
  assert.equal(state.round, 2);
  assert.equal(player(state).gold, 5);
  assert.deepEqual(player(state).shop, shop);
  conserved(state);
});

test('fusion : trois achats d’un même artilleur donnent un doré et la vente rend trois copies', () => {
  const state = game(), p = player(state);
  const id = card(p.family, 'artilleur').id;
  purchase(state, p.id, id);
  purchase(state, p.id, id);
  const golden = purchase(state, p.id, id);
  const matching = owned(state).filter(u => u.cardId === id);
  assert.equal(matching.length, 1);
  assert.equal(golden.golden, true);
  assert.equal(golden.hp, P.stats(state, golden).maxHp);
  conserved(state);
  const poolBefore = state.pool[id];
  act(state, p.id, { type: 'sell', unitId: golden.id });
  assert.equal(state.pool[id], poolBefore + 3);
  assert.ok(!state.units.some(u => u.id === golden.id));
  conserved(state);
});

test('banc plein : refus atomique d’un achat, mais fusion possible avec suppression des anciens ordres', () => {
  const state = game(), starter = piece(state, 'p0', 'sentinelle');
  const ids = [starter.cardId, ...Object.keys(state.pool).filter(id => id !== starter.cardId).slice(0, 7)];
  for (const id of ids) purchase(state, 'p0', id);
  assert.equal(owned(state).filter(u => !u.node).length, 8);
  const ninth = Object.keys(state.pool).find(id => !ids.includes(id));
  player(state).gold = 10;
  offer(state, 'p0', ninth);
  refused(state, 'p0', { type: 'buy', slot: 0 });
  conserved(state);

  act(state, 'p0', { type: 'order', unitId: starter.id, order: { type: 'guard' } });
  offer(state, 'p0', starter.cardId);
  act(state, 'p0', { type: 'buy', slot: 0 });
  assert.ok(!unit(state, starter.id), 'la copie déployée fait partie de la fusion');
  assert.equal(Object.hasOwn(player(state).orders, starter.id), false);
  assert.equal(owned(state).filter(u => !u.node).length, 8);
  assert.equal(owned(state).filter(u => u.cardId === starter.cardId && u.golden).length, 1);
  conserved(state);
});

test('armée pleine : refuser un huitième déploiement puis le permettre après une vente', () => {
  const state = game();
  const startingCards = new Set(owned(state).map(u => u.cardId));
  const ids = Object.keys(state.pool).filter(id => !startingCards.has(id)).slice(0, 6);
  for (let i = 0; i < 4; i++) {
    const u = purchase(state, 'p0', ids[i]);
    u.node = { ring: 0, sector: i };
    P.assertState(state);
  }
  const seventh = purchase(state, 'p0', ids[4]);
  act(state, 'p0', { type: 'deploy', unitId: seventh.id, node: { ring: 2, sector: 0 } });
  assert.equal(owned(state).filter(u => u.node).length, 7);
  const eighth = purchase(state, 'p0', ids[5]);
  unit(state, seventh.id).node = { ring: 0, sector: 4 };
  P.assertState(state);
  refused(state, 'p0', { type: 'deploy', unitId: eighth.id, node: { ring: 2, sector: 0 } });
  act(state, 'p0', { type: 'sell', unitId: seventh.id });
  act(state, 'p0', { type: 'deploy', unitId: eighth.id, node: { ring: 2, sector: 0 } });
  assert.equal(owned(state).filter(u => u.node).length, 7);
  conserved(state);
});

test('verrouillage : tous les joueurs doivent verrouiller et les ordres deviennent immuables', () => {
  const state = game(), u = piece(state);
  const before = P.serialize(state);
  assert.equal(P.resolveRound(state).ok, false);
  assert.equal(P.serialize(state), before);
  act(state, 'p0', { type: 'order', unitId: u.id, order: { type: 'guard' } });
  act(state, 'p0', { type: 'lock' });
  for (const command of [
    { type: 'buy', slot: 0 }, { type: 'sell', unitId: u.id }, { type: 'refresh' }, { type: 'freeze' },
    { type: 'upgrade' }, { type: 'clearOrders' }, { type: 'order', unitId: u.id, order: { type: 'guard' } },
  ]) refused(state, 'p0', command);
  const halfLocked = P.serialize(state);
  assert.equal(P.resolveRound(state).ok, false);
  assert.equal(P.serialize(state), halfLocked);
  act(state, 'p1', { type: 'lock' });
  assert.equal(P.resolveRound(state).ok, true);
  conserved(state);
});

test('ordres : effacer ses propres ordres et refuser les mouvements hors géométrie', () => {
  const state = game(), u = piece(state);
  act(state, 'p0', { type: 'order', unitId: u.id, order: { type: 'guard' } });
  act(state, 'p0', { type: 'clearOrders' });
  assert.deepEqual(player(state).orders, {});
  for (const node of [{ ring: -1, sector: 0 }, { ring: 3, sector: 0 }, { ring: 2, sector: state.sectors }, { ring: 2, sector: 1.5 }]) {
    refused(state, 'p0', { type: 'order', unitId: u.id, order: { type: 'move', to: node } });
  }
  conserved(state);
});

test('distance : voisinage circulaire et passages entre anneaux', () => {
  const state = game();
  assert.equal(P.distance(state, { ring: 2, sector: 0 }, { ring: 2, sector: state.sectors - 1 }), 1);
  assert.equal(P.distance(state, { ring: 0, sector: 4 }, { ring: 2, sector: 4 }), 2);
  assert.equal(P.distance(state, { ring: 1, sector: 3 }, { ring: 1, sector: 3 }), 0);
});

test('collisions : deux mouvements vers la même case vide sont tous deux annulés', () => {
  const state = game();
  emptyBoard(state);
  const a = piece(state), b = piece(state, 'p1');
  a.node = { ring: 2, sector: 0 };
  b.node = { ring: 2, sector: 2 };
  P.assertState(state);
  for (const u of [a, b]) act(state, u.owner, { type: 'order', unitId: u.id, order: { type: 'move', to: { ring: 2, sector: 1 } } });
  resolve(state);
  assert.deepEqual(unit(state, a.id).node, { ring: 2, sector: 0 });
  assert.deepEqual(unit(state, b.id).node, { ring: 2, sector: 2 });
  assert.equal(unit(state, a.id).movedLastRound, false);
  assert.equal(unit(state, b.id).movedLastRound, false);
});

test('collisions : trois prétendants et l’ordre des tableaux ne favorisent aucun joueur', () => {
  const state = game(3);
  emptyBoard(state);
  const units = [piece(state), piece(state, 'p1'), piece(state, 'p2')];
  units[0].node = { ring: 2, sector: 0 };
  units[1].node = { ring: 2, sector: 2 };
  units[2].node = { ring: 1, sector: 1 };
  const before = new Map(units.map(u => [u.id, { ...u.node }]));
  for (const u of units) act(state, u.owner, { type: 'order', unitId: u.id, order: { type: 'move', to: { ring: 2, sector: 1 } } });
  const reversed = P.restore(P.serialize(state));
  reversed.players.reverse();
  reversed.units.reverse();
  resolve(state);
  resolve(reversed);
  for (const u of units) {
    assert.deepEqual(unit(state, u.id).node, before.get(u.id));
    assert.deepEqual(unit(reversed, u.id).node, unit(state, u.id).node);
  }
});

test('combats simultanés : un astre détruit inflige quand même son attaque prévue', () => {
  const state = game();
  emptyBoard(state);
  const a = piece(state), b = piece(state, 'p1');
  a.node = { ring: 2, sector: 0 };
  b.node = { ring: 2, sector: 1 };
  a.hp = b.hp = 3;
  for (const [u, target] of [[a, b], [b, a]]) {
    act(state, u.owner, { type: 'order', unitId: u.id, order: { type: 'attack', target: { type: 'unit', id: target.id } } });
  }
  resolve(state);
  assert.ok(!state.units.some(u => u.id === a.id || u.id === b.id));
  conserved(state);
});

test('la portée est réévaluée après les déplacements simultanés', () => {
  const state = game();
  emptyBoard(state);
  const attacker = piece(state), target = piece(state, 'p1');
  attacker.node = { ring: 2, sector: 0 };
  target.node = { ring: 2, sector: 1 };
  const hp = target.hp;
  act(state, attacker.owner, { type: 'order', unitId: attacker.id, order: { type: 'attack', target: { type: 'unit', id: target.id } } });
  act(state, target.owner, { type: 'order', unitId: target.id, order: { type: 'move', to: { ring: 2, sector: 2 } } });
  resolve(state);
  assert.equal(unit(state, target.id).hp, hp);
  assert.deepEqual(unit(state, target.id).node, { ring: 2, sector: 2 });
});

test('artillerie : un allié bloque le tir et une diagonale ne devient pas une ligne de vue', () => {
  const state = game();
  const gunner = purchase(state, 'p0', card('lune', 'artilleur').id);
  emptyBoard(state);
  const blocker = piece(state, 'p0', 'sentinelle'), target = piece(state, 'p1');
  gunner.node = { ring: 2, sector: 0 };
  blocker.node = { ring: 2, sector: 1 };
  target.node = { ring: 2, sector: 2 };
  P.assertState(state);
  assert.ok(!P.targets(state, gunner.id).some(t => t.type === 'unit' && t.id === target.id));
  refused(state, 'p0', { type: 'order', unitId: gunner.id, order: { type: 'attack', target: { type: 'unit', id: target.id } } });
  blocker.node = null;
  assert.ok(P.targets(state, gunner.id).some(t => t.type === 'unit' && t.id === target.id));
  target.node = { ring: 1, sector: 1 };
  assert.ok(!P.targets(state, gunner.id).some(t => t.type === 'unit' && t.id === target.id));
});

test('dérive : rotation intérieure chaque manche, médiane une manche sur deux, extérieure fixe', () => {
  const state = game();
  assert.deepEqual(P.nextDrift(state), [1, 0, 0]);
  emptyBoard(state);
  state.round = 2;
  assert.deepEqual(P.nextDrift(state), [1, 1, 0]);
  const a = piece(state), b = piece(state, 'p1'), c = piece(state, 'p0', 'sentinelle');
  a.node = { ring: 0, sector: state.sectors - 1 };
  b.node = { ring: 1, sector: state.sectors - 1 };
  c.node = { ring: 2, sector: state.sectors - 1 };
  resolve(state);
  assert.deepEqual(unit(state, a.id).node, { ring: 0, sector: 0 });
  assert.deepEqual(unit(state, b.id).node, { ring: 1, sector: 0 });
  assert.deepEqual(unit(state, c.id).node, { ring: 2, sector: state.sectors - 1 });
  assert.deepEqual(P.nextDrift(state), [1, 0, 0]);
});

test('relais : le contrôle est évalué après la dérive, même sans ordre', () => {
  const state = game();
  emptyBoard(state);
  piece(state).node = { ring: 0, sector: 2 };
  player(state).score = 9;
  const result = resolve(state);
  assert.equal(player(state).score, 10);
  assert.equal(result.over, true);
  assert.equal(result.winner, 'p0');
  assert.equal(result.draw, false);
});

test('victoire simultanée : deux joueurs atteignant le même score gagnant font partie nulle', () => {
  const state = game();
  emptyBoard(state);
  piece(state).node = { ring: 0, sector: 2 };
  piece(state, 'p1').node = { ring: 0, sector: 8 };
  for (const p of state.players) p.score = 9;
  const result = resolve(state);
  assert.equal(result.over, true);
  assert.equal(result.draw, true);
  assert.equal(result.winner, null);
});

test('étoiles : distance supplémentaire, élimination, restitution des copies et fin définitive', () => {
  const state = game();
  emptyBoard(state);
  const attacker = piece(state), rival = player(state, 'p1');
  attacker.node = { ring: 2, sector: rival.home };
  rival.hp = 1;
  assert.ok(P.targets(state, attacker.id).some(t => t.type === 'star' && t.id === rival.id));
  refused(state, 'p0', { type: 'order', unitId: attacker.id, order: { type: 'attack', target: { type: 'star', id: 'p0' } } });
  act(state, 'p0', { type: 'order', unitId: attacker.id, order: { type: 'attack', target: { type: 'star', id: rival.id } } });
  const result = resolve(state);
  assert.equal(result.over, true);
  assert.equal(result.winner, 'p0');
  assert.equal(player(state, rival.id).hp, 0);
  assert.equal(owned(state, 'p1').length, 0);
  conserved(state);
  refused(state, 'p0', { type: 'refresh' });
  const before = P.serialize(state);
  assert.equal(P.resolveRound(state).ok, false);
  assert.equal(P.serialize(state), before);
});

test('destruction simultanée des deux étoiles : aucun premier joueur artificiel', () => {
  const state = game();
  emptyBoard(state);
  for (const [id, enemy] of [['p0', 'p1'], ['p1', 'p0']]) {
    const u = piece(state, id);
    u.node = { ring: 2, sector: player(state, enemy).home };
    player(state, id).hp = 1;
    act(state, id, { type: 'order', unitId: u.id, order: { type: 'attack', target: { type: 'star', id: enemy } } });
  }
  const result = resolve(state);
  assert.equal(result.over, true);
  assert.equal(result.draw, true);
  assert.equal(result.winner, null);
  assert.ok(state.players.every(p => p.hp === 0));
  conserved(state);
});

test('limite : la quarantième manche est jouée puis la partie est déclarée nulle', () => {
  const state = game();
  emptyBoard(state);
  state.round = 39;
  const penultimate = resolve(state);
  assert.equal(penultimate.over, false);
  assert.equal(state.round, 40);
  const last = resolve(state);
  assert.equal(last.over, true);
  assert.equal(last.draw, true);
  assert.equal(last.winner, null);
});

test('passifs simples : armure Minéral, attaque Brasier et déplacement Tempête', () => {
  const mineral = game(2, ['mineral']);
  assert.equal(P.stats(mineral, piece(mineral, 'p0', 'sentinelle')).armor, 2);
  const fire = game(2, ['brasier']);
  assert.equal(P.stats(fire, piece(fire)).attack, 4);
  const storm = game(2, ['tempete']);
  emptyBoard(storm);
  const u = piece(storm);
  u.node = { ring: 2, sector: 0 };
  assert.equal(P.stats(storm, u).move, 2);
  assert.ok(hasNode(P.moves(storm, u.id), 2, 2));
});

test('Machine : plusieurs voisins d’un autre rôle donnent un seul bonus d’attaque', () => {
  const state = game(2, ['machine']);
  const extra = purchase(state, 'p0', card('machine', 'sentinelle').id);
  emptyBoard(state);
  const actor = piece(state), support = piece(state, 'p0', 'sentinelle');
  actor.node = { ring: 2, sector: 1 };
  support.node = { ring: 2, sector: 0 };
  extra.node = { ring: 2, sector: 2 };
  P.assertState(state);
  assert.equal(P.stats(state, actor).attack, 4);
  support.node = extra.node = null;
  assert.equal(P.stats(state, actor).attack, 3);
});

test('Cristal : deux alliés alignés ne cumulent pas le bonus de conjonction', () => {
  const state = game(2, ['cristal']);
  const extra = purchase(state, 'p0', card('cristal', 'sentinelle').id);
  emptyBoard(state);
  const actor = piece(state), support = piece(state, 'p0', 'sentinelle');
  actor.node = { ring: 2, sector: 1 };
  support.node = { ring: 1, sector: 1 };
  extra.node = { ring: 0, sector: 1 };
  P.assertState(state);
  assert.equal(P.stats(state, actor).attack, 4);
  support.node = extra.node = null;
  assert.equal(P.stats(state, actor).attack, 3);
});

test('Glace : deux gardes voisins donnent une seule armure à l’allié protégé', () => {
  const state = game(2, ['glace', 'lune']);
  const extra = purchase(state, 'p0', card('glace', 'sentinelle').id);
  emptyBoard(state);
  const target = piece(state), support = piece(state, 'p0', 'sentinelle'), attacker = piece(state, 'p1');
  target.node = { ring: 2, sector: 1 };
  support.node = { ring: 2, sector: 0 };
  extra.node = { ring: 2, sector: 2 };
  attacker.node = { ring: 1, sector: 1 };
  for (const u of [support, extra]) act(state, 'p0', { type: 'order', unitId: u.id, order: { type: 'guard' } });
  act(state, 'p1', { type: 'order', unitId: attacker.id, order: { type: 'attack', target: { type: 'unit', id: target.id } } });
  resolve(state);
  assert.equal(unit(state, target.id).hp, 4, '3 dégâts de base moins une armure ; les deux gardes ne donnent pas deux armures');
});

test('Vie : la garde soigne le survivant après les dégâts et ne ressuscite pas un astre détruit', () => {
  for (const hp of [1, 3]) {
    const state = game(2, ['vie', 'brasier']);
    emptyBoard(state);
    const target = piece(state, 'p0', 'sentinelle'), attacker = piece(state, 'p1');
    target.node = { ring: 2, sector: 0 };
    attacker.node = { ring: 2, sector: 1 };
    target.hp = hp;
    act(state, 'p0', { type: 'order', unitId: target.id, order: { type: 'guard' } });
    act(state, 'p1', { type: 'order', unitId: attacker.id, order: { type: 'attack', target: { type: 'unit', id: target.id } } });
    resolve(state);
    if (hp === 1) assert.ok(!state.units.some(u => u.id === target.id));
    else assert.equal(unit(state, target.id).hp, 4, '4 attaque − (1 armure + 2 garde), puis soin de 2');
    conserved(state);
  }
});

test('Lune : la garde soigne un voisin sans dépasser ses PV maximaux', () => {
  const state = game();
  emptyBoard(state);
  const support = piece(state, 'p0', 'sentinelle'), target = piece(state);
  support.node = { ring: 2, sector: 0 };
  target.node = { ring: 2, sector: 1 };
  target.hp = P.stats(state, target).maxHp;
  act(state, 'p0', { type: 'order', unitId: support.id, order: { type: 'guard' } });
  resolve(state);
  assert.equal(unit(state, target.id).hp, P.stats(state, unit(state, target.id)).maxHp);
  unit(state, target.id).hp -= 2;
  act(state, 'p0', { type: 'order', unitId: support.id, order: { type: 'guard' } });
  resolve(state);
  assert.equal(unit(state, target.id).hp, P.stats(state, unit(state, target.id)).maxHp - 1);
});

test('Lune : deux gardes voisins ne doublent pas le soin', () => {
  const state = game(), extra = purchase(state, 'p0', card('lune', 'sentinelle').id);
  emptyBoard(state);
  const target = piece(state), support = piece(state, 'p0', 'sentinelle');
  target.node = { ring: 2, sector: 1 };
  target.hp = 3;
  support.node = { ring: 2, sector: 0 };
  extra.node = { ring: 2, sector: 2 };
  for (const u of [support, extra]) act(state, 'p0', { type: 'order', unitId: u.id, order: { type: 'guard' } });
  resolve(state);
  assert.equal(unit(state, target.id).hp, 4);
  conserved(state);
});

test('Envers ignore une armure et Néant renforce seulement une attaque contre une cible affaiblie', () => {
  const inverse = game(2, ['envers', 'mineral']);
  emptyBoard(inverse);
  const a = piece(inverse), b = piece(inverse, 'p1', 'sentinelle');
  a.node = { ring: 2, sector: 0 };
  b.node = { ring: 2, sector: 1 };
  act(inverse, 'p0', { type: 'order', unitId: a.id, order: { type: 'attack', target: { type: 'unit', id: b.id } } });
  resolve(inverse);
  assert.equal(unit(inverse, b.id).hp, 6, 'attaque 3 contre armure 2 dont une est ignorée');
  for (const hp of [4, 5]) {
    const state = game(2, ['neant', 'lune']);
    emptyBoard(state);
    const attacker = piece(state), target = piece(state, 'p1', 'sentinelle');
    attacker.node = { ring: 2, sector: 0 };
    target.node = { ring: 2, sector: 1 };
    target.hp = hp;
    act(state, 'p0', { type: 'order', unitId: attacker.id, order: { type: 'attack', target: { type: 'unit', id: target.id } } });
    resolve(state);
    assert.equal(unit(state, target.id).hp, hp === 4 ? 1 : 3);
  }
});

test('Comète : la dérive seule ne donne pas le bonus d’un déplacement ordonné', () => {
  const state = game(2, ['comete']);
  emptyBoard(state);
  const u = piece(state);
  u.node = { ring: 0, sector: 0 };
  resolve(state);
  assert.equal(unit(state, u.id).movedLastRound, false);
  assert.equal(P.stats(state, unit(state, u.id)).attack, 3);
  unit(state, u.id).node = { ring: 2, sector: 0 };
  act(state, 'p0', { type: 'order', unitId: u.id, order: { type: 'move', to: { ring: 2, sector: 1 } } });
  resolve(state);
  assert.equal(unit(state, u.id).movedLastRound, true);
  assert.equal(P.stats(state, unit(state, u.id)).attack, 4);
  resolve(state);
  assert.equal(unit(state, u.id).movedLastRound, false);
  assert.equal(P.stats(state, unit(state, u.id)).attack, 3);
});

test('Anomalie : un relais permet de rejoindre un autre relais libre, mais pas occupé', () => {
  const state = game(2, ['anomalie']);
  emptyBoard(state);
  const u = piece(state), blocker = piece(state, 'p1');
  u.node = { ring: 0, sector: 3 };
  assert.ok(hasNode(P.moves(state, u.id), 0, 9));
  blocker.node = { ring: 0, sector: 9 };
  assert.ok(!hasNode(P.moves(state, u.id), 0, 9));
});

test('reprise : JSON et restauration préservent les ordres, le hasard et la résolution', () => {
  const original = game();
  const u = piece(original);
  act(original, 'p0', { type: 'order', unitId: u.id, order: { type: 'guard' } });
  act(original, 'p0', { type: 'freeze' });
  const resumed = P.restore(P.serialize(original));
  const fromObject = P.restore(JSON.parse(P.serialize(original)));
  assert.deepEqual(fromObject, original);
  assert.notEqual(fromObject, original);
  const first = resolve(original), second = resolve(resumed);
  assert.deepEqual(second, first);
  assert.equal(P.serialize(resumed), P.serialize(original));
  act(original, 'p0', { type: 'refresh' });
  act(resumed, 'p0', { type: 'refresh' });
  assert.equal(P.serialize(resumed), P.serialize(original));
});

test('restauration : rejeter une version inconnue, un stock altéré et des occupations dupliquées', () => {
  const original = game();
  const corrupt = (change) => {
    const state = JSON.parse(P.serialize(original));
    change(state);
    assert.throws(() => P.restore(state));
  };
  corrupt(s => { s.v = 999; });
  corrupt(s => { s.pool[Object.keys(s.pool)[0]] = -1; });
  corrupt(s => { s.units[1].id = s.units[0].id; });
  corrupt(s => { s.units[1].node = { ...s.units[0].node }; });
  corrupt(s => { s.units[0].node = { ring: 5, sector: 0 }; });
  corrupt(s => { s.players[0].gold = -1; });
});

test('restauration : rejeter une fin fabriquée et un vainqueur incompatible avec la partie', () => {
  const initial = game();
  const reject = (state, label) => {
    assert.throws(() => P.assertState(state), Error, label);
    assert.throws(() => P.restore(state), Error, label);
    assert.throws(() => P.restore(JSON.stringify(state)), Error, label);
  };
  for (const reason of ['stars', 'score', 'round-limit', 'mutual-destruction']) {
    const state = JSON.parse(P.serialize(initial));
    const draw = reason === 'round-limit' || reason === 'mutual-destruction';
    state.phase = 'over';
    state.result = {
      reason, draw, winner: draw ? null : 'p0',
      winners: draw ? [] : ['p0'], winnerIds: draw ? [] : ['p0'],
    };
    reject(state, `aucune condition de fin ${reason} n’est remplie sur le plateau initial`);
  }

  const won = game();
  emptyBoard(won);
  const attacker = piece(won);
  attacker.node = { ring: 2, sector: player(won, 'p1').home };
  player(won, 'p1').hp = 1;
  act(won, 'p0', { type: 'order', unitId: attacker.id, order: { type: 'attack', target: { type: 'star', id: 'p1' } } });
  const result = resolve(won);
  assert.equal(result.reason, 'stars');
  assert.equal(result.winner, 'p0');

  const wrongWinner = JSON.parse(P.serialize(won));
  wrongWinner.result.winner = 'p1';
  reject(wrongWinner, 'winner doit être cohérent avec winners');
  const defeatedWinner = JSON.parse(P.serialize(won));
  defeatedWinner.result.winner = 'p1';
  defeatedWinner.result.winners = ['p1'];
  defeatedWinner.result.winnerIds = ['p1'];
  reject(defeatedWinner, 'le joueur éliminé ne peut être déclaré vainqueur');
  const wrongAlias = JSON.parse(P.serialize(won));
  wrongAlias.result.winnerIds = ['p1'];
  reject(wrongAlias, 'winnerIds doit désigner les mêmes vainqueurs');
});

test('vue du joueur : cacher boutiques, ordres et bancs adverses sans exposer réserve ou hasard', () => {
  const state = game();
  const enemyBench = purchase(state, 'p1', card('lune', 'sentinelle').id);
  const ownBench = purchase(state, 'p0', card('lune', 'sentinelle').id);
  const enemyDeployed = piece(state, 'p1');
  act(state, 'p1', { type: 'order', unitId: enemyDeployed.id, order: { type: 'guard' } });
  const before = P.serialize(state), view = P.view(state, 'p0');
  assert.deepEqual(player(view).shop, player(state).shop);
  assert.equal(player(view, 'p1').shop, null);
  assert.deepEqual(player(view, 'p1').orders, {});
  assert.ok(view.units.some(u => u.id === ownBench.id));
  assert.ok(view.units.some(u => u.id === enemyDeployed.id));
  assert.ok(!view.units.some(u => u.id === enemyBench.id));
  for (const key of ['pool', 'poolTotal', 'rc']) assert.equal(Object.hasOwn(view, key), false);
  player(view).gold = 0;
  view.units[0].hp = 1;
  assert.equal(P.serialize(state), before, 'modifier une vue ne doit pas modifier la partie');
});
