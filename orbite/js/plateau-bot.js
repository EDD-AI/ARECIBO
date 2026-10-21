/* ORBITE — politiques du prototype à plateau commun.
 * Les choix utilisent exclusivement la vue du joueur : aucune boutique,
 * réserve en main ou commande adverse cachée n'est consultée. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./plateau.js'));
  else root.OrbitePlateauBot = factory(root.OrbitePlateau);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (P) {
  'use strict';

  const POLICIES = ['balanced', 'aggressive', 'control'];
  const ARMY_MAX = P.LIMITS.armyCap;
  const BENCH_MAX = P.LIMITS.benchCap;
  const roles = {
    balanced: { sentinelle: 5, frappeur: 5, artilleur: 5 },
    aggressive: { sentinelle: 2, frappeur: 8, artilleur: 6 },
    control: { sentinelle: 8, frappeur: 3, artilleur: 6 },
  };
  const key = node => node.ring + ':' + node.sector;
  const mine = (view, pid) => view.players.find(player => player.id === pid);
  const unitsOf = (view, pid) => view.units.filter(unit => unit.owner === pid);
  const starNode = player => typeof player.home === 'number'
    ? { ring: 2, sector: player.home }
    : { ring: player.home.ring == null ? 2 : player.home.ring, sector: player.home.sector };

  function cardValue(view, pid, cardId, policy) {
    const card = P.CARDS[cardId];
    const own = unitsOf(view, pid);
    const player = mine(view, pid), family = player.family;
    const copies = own.filter(unit => unit.cardId === cardId && !unit.golden).length;
    const enemies = view.units.filter(unit => unit.owner !== pid && unit.node);
    const armor = enemies.some(unit => P.stats(view, unit).armor > 0);
    const threatened = enemies.some(unit => P.distance(view, unit.node, starNode(player)) <= 2);
    return (roles[policy][card.role] || 4) + card.tier * 2 +
      (card.family === family ? 2 : 0) + copies * 2 + (copies >= 2 ? 30 : 0) +
      (armor && card.family === 'envers' ? 2 : 0) + (threatened && card.role === 'sentinelle' ? 3 : 0);
  }

  function unitValue(view, pid, unit, policy) {
    const stats = P.stats(view, unit);
    return cardValue(view, pid, unit.cardId, policy) + (unit.golden ? 12 : 0) +
      stats.attack / 3 + stats.maxHp / 5 + stats.armor / 2;
  }

  function drifted(view, node) {
    const drift = P.nextDrift(view);
    return { ring: node.ring, sector: (node.sector + drift[node.ring]) % view.sectors };
  }

  function orderedNodes(view, pid, nodes) {
    const home = starNode(mine(view, pid)).sector;
    return nodes.slice().sort((a, b) => a.ring - b.ring ||
      (a.sector - home + view.sectors) % view.sectors -
      (b.sector - home + view.sectors) % view.sectors);
  }

  function pickGoal(view, pid, unit, policy, claimed, index) {
    const player = mine(view, pid);
    const enemyUnits = view.units.filter(other => other.owner !== pid && other.node);
    const threats = enemyUnits.filter(other => P.distance(view, other.node, starNode(player)) <= 2);
    const defenders = unitsOf(view, pid).filter(other => other.node).slice().sort((a, b) =>
      P.distance(view, a.node, starNode(player)) - P.distance(view, b.node, starNode(player)) || a.id.localeCompare(b.id));
    if (threats.length && defenders.slice(0, policy === 'control' ? 2 : 1).some(other => other.id === unit.id)) {
      const threat = threats.slice().sort((a, b) => P.distance(view, unit.node, a.node) - P.distance(view, unit.node, b.node) ||
        a.id.localeCompare(b.id))[0];
      return { type: 'unit', id: threat.id, node: threat.node, urgent: player.hp <= P.stats(view, threat).attack };
    }
    const leaders = view.players.filter(other => other.id !== pid && other.hp > 0 && other.score >= P.LIMITS.scoreToWin - 2);
    let contested = view.relays.filter(relay => enemyUnits.some(other =>
      leaders.some(leader => leader.id === other.owner) &&
      (P.distance(view, other.node, relay) <= 1 || key(drifted(view, other.node)) === key(relay))));
    if (!contested.length && leaders.some(other => other.score >= P.LIMITS.scoreToWin - 1)) contested = view.relays;
    const winning = player.score >= P.LIMITS.scoreToWin - 1;
    const card = P.CARDS[unit.cardId];
    // Même une politique offensive garde un éclaireur sur les objectifs. Les
    // autres astres exercent une pression sur les étoiles ou leurs défenseurs.
    const control = policy === 'control' || policy === 'balanced' && (card.role === 'sentinelle' || index % 3 === 0) ||
      policy === 'aggressive' && index === 0;
    let goals;
    if (winning || contested.length) goals = (winning ? view.relays : contested).map(node => ({ type: 'relay', node, urgent: true, winning }));
    else if (control) goals = view.relays.map(node => ({ type: 'relay', node, urgent: false }));
    else goals = view.players.filter(other => other.id !== pid && other.hp > 0)
      .map(other => ({ type: 'star', id: other.id, node: starNode(other), urgent: false }));
    if (!goals.length) goals = view.relays.map(node => ({ type: 'relay', node, urgent: false }));
    if (!goals.length) return { type: 'relay', node: unit.node, urgent: false };
    const home = starNode(player).sector;
    return goals.slice().sort((a, b) =>
      (P.distance(view, drifted(view, unit.node), a.node) + (claimed[key(a.node)] || 0) * 3) -
      (P.distance(view, drifted(view, unit.node), b.node) + (claimed[key(b.node)] || 0) * 3) ||
      (a.node.sector - home + view.sectors) % view.sectors - (b.node.sector - home + view.sectors) % view.sectors)[0];
  }

  function attackScore(view, pid, unit, target, policy, goal) {
    let attack = P.stats(view, unit).attack;
    if (target.type === 'star') {
      const enemy = view.players.find(player => player.id === target.id);
      return (enemy.hp <= attack ? 1000 : 0) + attack * 2 + (policy === 'aggressive' ? 18 : policy === 'balanced' ? 12 : 5);
    }
    const enemy = view.units.find(other => other.id === target.id);
    const stats = P.stats(view, enemy);
    const family = P.CARDS[unit.cardId].family;
    if (family === 'neant' && enemy.hp <= stats.maxHp / 2) attack++;
    const pierce = family === 'envers' ? 1 : 0;
    const damage = Math.max(0, attack - Math.max(0, stats.armor - pierce));
    const guarded = Math.max(0, attack - Math.max(0, stats.armor + 2 - pierce));
    if (!damage) return 0;
    // La garde adverse est cachée : tenir compte de sa possibilité, sans lire
    // son ordre. Un astre immobile peut bloquer une attaque de faible puissance.
    const expected = enemy.movedLastRound ? damage : (damage + guarded) / 2;
    const threat = P.distance(view, enemy.node, starNode(mine(view, pid))) <= 2;
    const blocking = goal.type === 'unit' && goal.id === enemy.id || key(enemy.node) === key(goal.node);
    const relay = view.relays.some(node => key(node) === key(enemy.node) || key(node) === key(drifted(view, enemy.node)));
    return expected * 2 + (enemy.hp <= guarded ? 22 : enemy.hp <= damage ? 7 : 0) +
      (threat ? 15 : 0) + (blocking ? 10 : 0) +
      (relay && goal.urgent ? 35 : 0) + (enemy.golden ? 4 : 0) + (policy === 'aggressive' ? 3 : 0);
  }

  function forecast(view, pid, unit, horizon) {
    const frames = [];
    let others = view.units.filter(other => other.node && other.id !== unit.id).map(other => ({ id: other.id, node: other.node }));
    frames.push(new Map(others.map(other => [key(other.node), other.id])));
    for (let turn = 0; turn < horizon; turn++) {
      const drift = [1, (view.round + turn) % 2 === 0 ? 1 : 0, 0];
      others = others.map(other => {
        const order = turn === 0 ? mine(view, pid).orders[other.id] : null;
        const node = order && order.type === 'move' ? order.to : other.node;
        return { id: other.id, node: { ring: node.ring, sector: (node.sector + drift[node.ring]) % view.sectors } };
      });
      frames.push(new Map(others.map(other => [key(other.node), other.id])));
    }
    return frames;
  }

  function reachable(view, unit, node, occupied) {
    const result = [node], seen = new Set([key(node)]), queue = [{ node, depth: 0 }];
    const limit = P.stats(view, unit).move;
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (current.depth >= limit) continue;
      const neighbors = [
        { ring: current.node.ring, sector: (current.node.sector + 1) % view.sectors },
        { ring: current.node.ring, sector: (current.node.sector + view.sectors - 1) % view.sectors },
        { ring: current.node.ring - 1, sector: current.node.sector },
        { ring: current.node.ring + 1, sector: current.node.sector },
      ];
      for (const next of neighbors) {
        const id = key(next);
        if (next.ring < 0 || next.ring >= P.LIMITS.ringCount || seen.has(id) || occupied.has(id)) continue;
        seen.add(id); result.push(next); queue.push({ node: next, depth: current.depth + 1 });
      }
    }
    if (P.CARDS[unit.cardId].family === 'anomalie' && view.relays.some(relay => key(relay) === key(node))) {
      for (const relay of view.relays) if (!seen.has(key(relay)) && !occupied.has(key(relay))) result.push(relay);
    }
    return result;
  }

  // Recherche temporelle bornée : quatre couches au maximum, une visite par
  // case et par couche (432 états au plus sur le plus grand plateau).
  function planMove(view, pid, unit, goal, reserved) {
    const horizon = 4, frames = forecast(view, pid, unit, horizon), range = P.stats(view, unit).range;
    const first = [unit.node, ...orderedNodes(view, pid, P.moves(view, unit.id).filter(node => !reserved.has(key(node))))];
    let frontier = new Map(), reached = null, best = { node: unit.node, cost: Infinity, arrival: horizon + 1, index: 0 };
    first.forEach((node, index) => {
      const after = drifted(view, node), id = key(after);
      if (!frontier.has(id)) frontier.set(id, { node: after, first: node, index });
    });
    function remaining(node, occupied) {
      const distance = P.distance(view, node, goal.node);
      if (goal.type === 'relay') return distance;
      if (goal.type === 'star') {
        const blocked = occupied.has(key(goal.node)) && key(node) !== key(goal.node);
        return Math.max(blocked ? 1 : 0, distance + 1 - range);
      }
      return Math.max(0, distance - range);
    }
    // Heuristique spatiale avec obstacles pour les chemins qui dépassent
    // l'horizon. La distance géométrique seule condamnerait les détours.
    const spatial = new Map([[key(goal.node), 0]]), queue = [goal.node];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      const neighbors = [
        { ring: node.ring, sector: (node.sector + 1) % view.sectors },
        { ring: node.ring, sector: (node.sector + view.sectors - 1) % view.sectors },
        { ring: node.ring - 1, sector: node.sector }, { ring: node.ring + 1, sector: node.sector },
      ];
      if (P.CARDS[unit.cardId].family === 'anomalie' && view.relays.some(relay => key(relay) === key(node))) neighbors.push(...view.relays);
      for (const next of neighbors) {
        const id = key(next);
        if (next.ring < 0 || next.ring >= P.LIMITS.ringCount || spatial.has(id) || frames[horizon].has(id)) continue;
        spatial.set(id, spatial.get(key(node)) + 1); queue.push(next);
      }
    }
    for (let turn = 1; turn <= horizon && frontier.size; turn++) {
      const next = new Map();
      for (const route of frontier.values()) {
        const distance = remaining(route.node, frames[turn]);
        if (distance === 0 && (!reached || turn < reached.arrival || turn === reached.arrival && route.index < reached.index)) {
          reached = { node: route.first, cost: turn, arrival: turn, index: route.index };
        }
        if (turn === horizon) {
          const spatialDistance = spatial.has(key(route.node)) ? spatial.get(key(route.node)) : Infinity;
          const reach = goal.type === 'unit' ? range : goal.type === 'star' ? range - 1 : 0;
          const cost = Math.max(0, spatialDistance - reach);
          if (cost < best.cost || cost === best.cost && route.index < best.index) {
            best = { node: route.first, cost, arrival: horizon + cost, index: route.index };
          }
        }
        if (turn === horizon) continue;
        const drift = [1, (view.round + turn) % 2 === 0 ? 1 : 0, 0];
        for (const destination of reachable(view, unit, route.node, frames[turn])) {
          const node = { ring: destination.ring, sector: (destination.sector + drift[destination.ring]) % view.sectors };
          const id = key(node);
          if (!next.has(id)) next.set(id, { node, first: route.first, index: route.index });
        }
      }
      frontier = next;
    }
    return reached || best;
  }

  function prepareTurn(state, pid, { policy = 'balanced' } = {}) {
    if (!POLICIES.includes(policy)) return { ok: false, error: 'Politique inconnue : ' + policy };
    if (!state || !Array.isArray(state.players) || !state.players.some(player => player.id === pid)) {
      return { ok: false, error: 'Un joueur bot valide est requis.' };
    }
    let view = P.view(state, pid);
    let player = mine(view, pid);
    if (!player || player.kind !== 'bot') return { ok: false, error: 'Un joueur bot valide est requis.' };
    if (view.phase !== 'planning' || player.hp <= 0 || player.locked) {
      return { ok: false, error: 'Ce joueur ne peut pas préparer de nouveaux ordres.' };
    }
    const actions = [];
    let failure = null;
    function apply(command) {
      const result = P.action(state, pid, command);
      if (!result.ok) {
        failure = { ok: false, error: result.error || 'Action du bot refusée.', command, actions, policy };
        return false;
      }
      actions.push(command);
      view = P.view(state, pid);
      player = mine(view, pid);
      return true;
    }

    function deployBench() {
      for (let step = 0; step < BENCH_MAX; step++) {
        const own = unitsOf(view, pid);
        const deployed = own.filter(unit => unit.node);
        const bench = own.filter(unit => !unit.node).sort((a, b) =>
          unitValue(view, pid, b, policy) - unitValue(view, pid, a, policy) || a.id.localeCompare(b.id));
        if (!bench.length) return true;
        if (deployed.length >= ARMY_MAX) {
          const weakest = deployed.slice().sort((a, b) => unitValue(view, pid, a, policy) - unitValue(view, pid, b, policy) ||
            a.id.localeCompare(b.id))[0];
          if (unitValue(view, pid, bench[0], policy) <= unitValue(view, pid, weakest, policy) + 2) return true;
          if (!apply({ type: 'sell', unitId: weakest.id })) return false;
        }
        const nodes = orderedNodes(view, pid, P.deployNodes(view, pid));
        if (!nodes.length) return true;
        nodes.sort((a, b) => {
          const da = Math.min(...view.relays.map(relay => P.distance(view, drifted(view, a), relay)));
          const db = Math.min(...view.relays.map(relay => P.distance(view, drifted(view, b), relay)));
          return da - db;
        });
        if (!apply({ type: 'deploy', unitId: bench[0].id, node: nodes[0] })) return false;
      }
      return true;
    }

    if (!deployBench()) return failure;
    if (player.tier === 1 && player.gold >= 5 && view.round >= 3 && unitsOf(view, pid).filter(unit => unit.node).length >= 3) {
      if (!apply({ type: 'upgrade' })) return failure;
    }
    let refreshed = false;
    for (let step = 0; step < 8; step++) {
      const own = unitsOf(view, pid);
      if (own.filter(unit => !unit.node).length >= BENCH_MAX) break;
      const full = own.filter(unit => unit.node).length >= ARMY_MAX;
      const candidates = player.shop.map((id, slot) => id ? { id, slot, value: cardValue(view, pid, id, policy) } : null)
        .filter(option => option && P.CARDS[option.id].cost <= player.gold)
        .filter(option => !full || own.filter(unit => unit.cardId === option.id && !unit.golden).length >= 2 ||
          own.some(unit => unit.node && !unit.golden && cardValue(view, pid, unit.cardId, policy) + 2 < option.value))
        .sort((a, b) => b.value - a.value || a.slot - b.slot);
      if (candidates.length) {
        if (!apply({ type: 'buy', slot: candidates[0].slot })) return failure;
        if (!deployBench()) return failure;
      } else {
        const cheapest = Math.min(...Object.values(P.CARDS).filter(card => card.tier <= player.tier).map(card => card.cost));
        if (!refreshed && player.gold >= cheapest + 1) {
          refreshed = true;
          if (!apply({ type: 'refresh' })) return failure;
        } else break;
      }
    }

    const planned = new Set();
    const claimed = {};
    const ids = unitsOf(view, pid).filter(unit => unit.node).map(unit => unit.id).sort();
    for (let index = 0; index < ids.length; index++) {
      const unit = view.units.find(other => other.id === ids[index]);
      const goal = pickGoal(view, pid, unit, policy, claimed, index);
      claimed[key(goal.node)] = (claimed[key(goal.node)] || 0) + 1;
      const route = planMove(view, pid, unit, goal, planned);
      const moving = key(route.node) !== key(unit.node);
      const captures = goal.type === 'relay' && key(drifted(view, route.node)) === key(goal.node);
      let moveValue = moving ? policy === 'control' ? 12 : policy === 'aggressive' ? 7 : 9 : 0;
      if (moving && goal.urgent) moveValue += route.arrival <= 2 ? 35 : 16 / route.arrival;
      if (moving && captures) moveValue += goal.winning ? 900 : goal.urgent ? 140 : policy === 'control' ? 35 : 25;
      const guardValue = !moving && captures && goal.winning && unit.hp <= 4 ? 40 : 0;
      const targets = P.targets(view, unit.id).slice().sort((a, b) =>
        attackScore(view, pid, unit, b, policy, goal) - attackScore(view, pid, unit, a, policy, goal) ||
        a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
      if (targets.length && attackScore(view, pid, unit, targets[0], policy, goal) > 0 &&
        attackScore(view, pid, unit, targets[0], policy, goal) >= Math.max(moveValue, guardValue)) {
        if (!apply({ type: 'order', unitId: unit.id, order: { type: 'attack', target: targets[0] } })) return failure;
        continue;
      }
      if (moving) {
        planned.add(key(route.node));
        if (!apply({ type: 'order', unitId: unit.id, order: { type: 'move', to: route.node } })) return failure;
      } else if (!apply({ type: 'order', unitId: unit.id, order: { type: 'guard' } })) return failure;
    }
    if (!apply({ type: 'lock' })) return failure;
    return { ok: true, policy, actions };
  }

  return { POLICIES, prepareTurn };
});
