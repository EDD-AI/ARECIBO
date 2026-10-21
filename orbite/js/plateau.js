/* ORBITE — prototype de plateau commun. Statistiques de départ, non équilibrées.
 * Moteur pur : état JSON, actions transactionnelles et ordres simultanés.
 * Géométrie : trois anneaux reliés radialement, secteurs circulaires. Les étoiles
 * sont hors grille, reliées à la case extérieure de leur secteur d'origine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OrbitePlateau = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const FAMILIES = [
    { id: 'vie', name: 'Vie', color: '#5fd35a', description: 'Garde : récupère 2 PV après le combat.' },
    { id: 'neant', name: 'Néant', color: '#9a6bff', description: '+1 attaque contre un astre à la moitié de ses PV ou moins.' },
    { id: 'envers', name: 'Envers', color: '#ff4f6d', description: 'Ignore 1 point d’armure lors des attaques.' },
    { id: 'brasier', name: 'Brasier', color: '#ff8a2a', description: '+1 attaque.' },
    { id: 'glace', name: 'Glace', color: '#8be6ff', description: 'Garde : +1 armure aux voisins alliés. Non cumulable.' },
    { id: 'tempete', name: 'Tempête', color: '#2fd6b0', description: '+1 déplacement, sans traverser les astres.' },
    { id: 'mineral', name: 'Minéral', color: '#b8743f', description: '+1 armure.' },
    { id: 'machine', name: 'Machine', color: '#9fb3c8', description: '+1 attaque près d’un allié d’un autre rôle. Non cumulable.' },
    { id: 'lune', name: 'Lunes', color: '#ffd447', description: 'Garde : soigne 1 PV aux voisins alliés après le combat. Non cumulable.' },
    { id: 'comete', name: 'Comètes', color: '#4f7bff', description: '+1 attaque après un déplacement ordonné à la manche précédente.' },
    { id: 'cristal', name: 'Cristal', color: '#ff6fd8', description: '+1 attaque avec un Cristal allié du même secteur sur un autre anneau.' },
    { id: 'anomalie', name: 'Anomalies', color: '#c8ff3a', description: 'Depuis un relais, peut se déplacer vers un autre relais vide.' },
  ];
  const ROLES = [
    { id: 'sentinelle', name: 'Sentinelle', description: 'Protège les accès.', attack: 2, maxHp: 8, armor: 1, move: 1, range: 1, cost: 3, tier: 1 },
    { id: 'frappeur', name: 'Frappeur', description: 'Combat au contact.', attack: 3, maxHp: 6, armor: 0, move: 1, range: 1, cost: 3, tier: 1 },
    { id: 'artilleur', name: 'Artilleur', description: 'Tire à deux cases en ligne de vue.', attack: 3, maxHp: 4, armor: 0, move: 1, range: 2, cost: 4, tier: 2 },
  ];
  const CARDS = {};
  for (const family of FAMILIES) for (const role of ROLES) {
    const id = family.id + '-' + role.id;
    CARDS[id] = Object.assign({}, role, { id, family: family.id, role: role.id, name: role.name + ' · ' + family.name });
  }
  const FAMILY_IDS = FAMILIES.map((f) => f.id);
  const COPIES = 12, MAX_GOLD = 10, BENCH_MAX = 8, ARMY_MAX = 7, SCORE_GOAL = 10, ROUND_LIMIT = 40;
  const LIMITS = Object.freeze({ armyCap: ARMY_MAX, benchCap: BENCH_MAX, maxRounds: ROUND_LIMIT, scoreToWin: SCORE_GOAL, starHp: 18, ringCount: 3, copiesPerCard: COPIES, maxGold: MAX_GOLD, ARMY_MAX, BENCH_MAX });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fail = (error) => ({ ok: false, error });
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const integer = (n) => Number.isSafeInteger(n);
  const playerOf = (s, id) => s.players.find((p) => p.id === id);
  const unitOf = (s, id) => s.units.find((u) => u.id === id);
  const alivePlayers = (s) => s.players.filter((p) => p.hp > 0);
  const cardOf = (u) => CARDS[u.cardId];
  const wrap = (s, n) => ((n % s.sectors) + s.sectors) % s.sectors;
  const nodeKey = (node) => node == null ? '' : node.ring + ':' + node.sector;
  const validNode = (s, n) => !!n && integer(n.ring) && n.ring >= 0 && n.ring < 3 && integer(n.sector) && n.sector >= 0 && n.sector < s.sectors;
  const occupied = (s, node) => s.units.find((u) => u.node && nodeKey(u.node) === nodeKey(node));
  const neighbors = (s, n) => [
    { ring: n.ring, sector: wrap(s, n.sector - 1) },
    { ring: n.ring, sector: wrap(s, n.sector + 1) },
    { ring: n.ring - 1, sector: n.sector },
    { ring: n.ring + 1, sector: n.sector },
  ].filter((node) => validNode(s, node));

  function hash(str) {
    let n = 2166136261;
    for (let i = 0; i < str.length; i++) n = Math.imul(n ^ str.charCodeAt(i), 16777619);
    n ^= n >>> 16; n = Math.imul(n, 0x7feb352d); n ^= n >>> 15;
    return n >>> 0;
  }
  function random(s) { return hash(s.seed + '|' + s.rc++) / 4294967296; }
  function shuffled(list, seed) {
    const r = { seed, rc: 0 }, out = list.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random(r) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  function distance(s, a, b) {
    if (!validNode(s, a) || !validNode(s, b)) return Infinity;
    const d = Math.abs(a.sector - b.sector);
    return Math.abs(a.ring - b.ring) + Math.min(d, s.sectors - d);
  }
  function stats(s, u) {
    const c = u && cardOf(u);
    if (!c) throw new Error('Astre inconnu.');
    const out = { attack: c.attack + (u.golden ? 2 : 0), maxHp: c.maxHp + (u.golden ? 3 : 0), armor: c.armor, move: c.move, range: c.range, cost: c.cost };
    if (c.family === 'mineral') out.armor++;
    if (c.family === 'tempete') out.move++;
    if (c.family === 'brasier') out.attack++;
    if (c.family === 'comete' && u.movedLastRound) out.attack++;
    if (u.node && c.family === 'machine' && s.units.some((v) => v.id !== u.id && v.owner === u.owner && v.node && cardOf(v).role !== c.role && distance(s, u.node, v.node) === 1)) out.attack++;
    if (u.node && c.family === 'cristal' && s.units.some((v) => v.id !== u.id && v.owner === u.owner && v.node && cardOf(v).family === 'cristal' && v.node.sector === u.node.sector && v.node.ring !== u.node.ring)) out.attack++;
    return out;
  }
  function deployNodes(s, pid) {
    const p = playerOf(s, pid);
    if (!p || p.hp <= 0) return [];
    return [-1, 0, 1].map((d) => ({ ring: 2, sector: wrap(s, p.home + d) })).filter((n) => !occupied(s, n));
  }
  function moves(s, uid) {
    const u = unitOf(s, uid);
    if (!u || !u.node || playerOf(s, u.owner).hp <= 0) return [];
    const seen = new Set([nodeKey(u.node)]), result = [], queue = [{ node: u.node, steps: 0 }];
    const limit = stats(s, u).move;
    while (queue.length) {
      const { node, steps } = queue.shift();
      if (steps >= limit) continue;
      for (const next of neighbors(s, node)) {
        const key = nodeKey(next);
        if (seen.has(key) || occupied(s, next)) continue;
        seen.add(key); result.push(next); queue.push({ node: next, steps: steps + 1 });
      }
    }
    if (cardOf(u).family === 'anomalie' && s.relays.some((n) => nodeKey(n) === nodeKey(u.node))) {
      for (const relay of s.relays) if (!seen.has(nodeKey(relay)) && !occupied(s, relay)) result.push(clone(relay));
    }
    return result.sort((a, b) => a.ring - b.ring || a.sector - b.sector);
  }
  function clearLine(s, from, to, range) {
    const d = distance(s, from, to);
    if (d < 1 || d > range || (from.ring !== to.ring && from.sector !== to.sector)) return false;
    if (d === 1) return true;
    if (from.sector === to.sector) {
      const step = Math.sign(to.ring - from.ring);
      for (let r = from.ring + step; r !== to.ring; r += step) if (occupied(s, { ring: r, sector: from.sector })) return false;
    } else {
      const positive = wrap(s, to.sector - from.sector), negative = wrap(s, from.sector - to.sector);
      const step = positive <= negative ? 1 : -1;
      for (let i = 1; i < d; i++) if (occupied(s, { ring: from.ring, sector: wrap(s, from.sector + step * i) })) return false;
    }
    return true;
  }
  function canReachStar(s, u, p) {
    const approach = { ring: 2, sector: p.home };
    const d = distance(s, u.node, approach) + 1;
    if (d > stats(s, u).range) return false;
    // À portée deux, la case extérieure du secteur d'origine constitue l'intermédiaire.
    return d === 1 || (distance(s, u.node, approach) === 1 && !occupied(s, approach));
  }
  function targets(s, uid) {
    const u = unitOf(s, uid);
    if (!u || !u.node || playerOf(s, u.owner).hp <= 0) return [];
    const range = stats(s, u).range;
    const found = s.units.filter((v) => v.owner !== u.owner && v.node && clearLine(s, u.node, v.node, range)).map((v) => ({ type: 'unit', id: v.id }));
    for (const p of s.players) if (p.id !== u.owner && p.hp > 0 && canReachStar(s, u, p)) found.push({ type: 'star', id: p.id });
    return found.sort((a, b) => compare(a.type, b.type) || compare(a.id, b.id));
  }
  function draw(s, tier) {
    const ids = Object.keys(s.pool).filter((id) => s.pool[id] > 0 && CARDS[id].tier <= tier).sort();
    const total = ids.reduce((sum, id) => sum + s.pool[id], 0);
    if (!total) return null;
    let r = random(s) * total;
    for (const id of ids) { r -= s.pool[id]; if (r < 0) { s.pool[id]--; return id; } }
    throw new Error('Tirage de réserve incohérent.');
  }
  function releaseShop(s, p) { for (const id of p.shop) if (id) s.pool[id]++; p.shop = []; }
  function fillShop(s, p) {
    const size = p.tier === 2 ? 4 : 3;
    while (p.shop.length < size) p.shop.push(null);
    for (let i = 0; i < size; i++) if (p.shop[i] === null) p.shop[i] = draw(s, p.tier);
  }
  function removeOrders(s, ids) { for (const p of s.players) for (const id of ids) delete p.orders[id]; }
  function removeUnit(s, u, events) {
    s.pool[u.cardId] += u.golden ? 3 : 1;
    s.units = s.units.filter((v) => v.id !== u.id);
    removeOrders(s, [u.id]);
    if (events) events.push({ t: 'die', unitId: u.id, owner: u.owner, node: clone(u.node) });
  }
  function makeUnit(s, owner, cardId, golden, node) {
    let id;
    do { id = 'u' + s.nextUnitId++; } while (unitOf(s, id));
    const u = { id, owner, cardId, golden: !!golden, hp: CARDS[cardId].maxHp + (golden ? 3 : 0), node: node ? clone(node) : null, movedLastRound: false };
    s.units.push(u);
    return u;
  }
  function fuse(s, owner, cardId) {
    const normal = s.units.filter((u) => u.owner === owner && u.cardId === cardId && !u.golden).sort((a, b) => compare(a.id, b.id));
    const fused = [];
    while (normal.length >= 3) {
      const consumed = normal.splice(0, 3), ids = consumed.map((u) => u.id);
      s.units = s.units.filter((u) => !ids.includes(u.id));
      removeOrders(s, ids);
      fused.push(makeUnit(s, owner, cardId, true, null).id);
    }
    return fused;
  }
  function newGame(options) {
    const o = options || {}, inputs = o.players;
    if (!Array.isArray(inputs) || inputs.length < 2 || inputs.length > 6) throw new Error('Le plateau accueille de 2 à 6 joueurs.');
    const seed = String(o.seed === undefined ? 'orbite-plateau' : o.seed);
    const ids = new Set(), requested = [];
    for (const p of inputs) {
      if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || !['human', 'bot'].includes(p.kind)) throw new Error('Joueur invalide ou identifiant dupliqué.');
      ids.add(p.id);
      if (p.family !== undefined) {
        if (!FAMILY_IDS.includes(p.family)) throw new Error('Famille inconnue.');
        if (!requested.includes(p.family)) requested.push(p.family);
      }
    }
    if (requested.length > 5) throw new Error('Cinq familles au maximum peuvent être présentes.');
    const active = requested.concat(shuffled(FAMILY_IDS.filter((id) => !requested.includes(id)), seed + '|families').slice(0, 5 - requested.length));
    const s = { v: 1, seed, round: 1, phase: 'planning', sectors: 6 * inputs.length, activeFamilies: active, relays: [], players: [], units: [], pool: {}, poolTotal: {}, rc: 0, nextUnitId: 1, result: null };
    for (const family of active) for (const role of ROLES) s.pool[family + '-' + role.id] = COPIES;
    s.poolTotal = Object.assign({}, s.pool);
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i], family = input.family || active[i % active.length];
      const p = { id: input.id, name: String(input.name || input.id), kind: input.kind, family, home: 6 * i, hp: 18, score: 0, gold: 4, tier: 1, shop: [], frozen: false, locked: false, orders: {} };
      s.players.push(p);
      for (const [role, delta] of [['sentinelle', -1], ['frappeur', 1]]) {
        const id = family + '-' + role;
        s.pool[id]--;
        makeUnit(s, p.id, id, false, { ring: 2, sector: wrap(s, p.home + delta) });
      }
      s.relays.push({ ring: 0, sector: 3 + 6 * i });
    }
    for (const p of s.players) fillShop(s, p);
    assertState(s);
    return s;
  }
  function orderError(s, p, u, order, reachable) {
    if (!order || typeof order !== 'object') return 'Ordre invalide.';
    if (order.type === 'guard') return null;
    if (order.type === 'move') {
      if (!validNode(s, order.to)) return 'Destination invalide.';
      if (reachable && !moves(s, u.id).some((n) => nodeKey(n) === nodeKey(order.to))) return 'Déplacement impossible.';
      return null;
    }
    if (order.type === 'attack') {
      const t = order.target;
      if (!t || !['unit', 'star'].includes(t.type) || typeof t.id !== 'string' || !t.id) return 'Cible invalide.';
      if (reachable && !targets(s, u.id).some((v) => v.type === t.type && v.id === t.id)) return 'Cible hors de portée ou protégée.';
      return null;
    }
    return 'Type d’ordre inconnu.';
  }
  function applyAction(s, pid, c) {
    const p = playerOf(s, pid);
    if (s.phase !== 'planning') return fail('La partie est terminée.');
    if (!p || p.hp <= 0) return fail('Joueur absent ou éliminé.');
    if (p.locked) return fail('Les ordres sont déjà verrouillés.');
    if (!c || typeof c !== 'object') return fail('Commande invalide.');
    if (c.type === 'buy') {
      if (!integer(c.slot) || c.slot < 0 || c.slot >= p.shop.length || !p.shop[c.slot]) return fail('Offre indisponible.');
      const id = p.shop[c.slot], card = CARDS[id];
      if (p.gold < card.cost) return fail('Énergie insuffisante.');
      p.gold -= card.cost; p.shop[c.slot] = null;
      const u = makeUnit(s, pid, id, false, null), fused = fuse(s, pid, id);
      if (s.units.filter((v) => v.owner === pid && !v.node).length > BENCH_MAX) return fail('Réserve personnelle pleine.');
      return { ok: true, unitId: u.id, fused };
    }
    if (['deploy', 'sell', 'order', 'cancelOrder'].includes(c.type)) {
      const u = unitOf(s, c.unitId);
      if (!u || u.owner !== pid) return fail('Cet astre ne vous appartient pas.');
      if (c.type === 'sell') {
        removeUnit(s, u); p.gold = Math.min(MAX_GOLD, p.gold + 1);
        return { ok: true };
      }
      if (c.type === 'deploy') {
        if (u.node) return fail('Cet astre est déjà déployé.');
        if (s.units.filter((v) => v.owner === pid && v.node).length >= ARMY_MAX) return fail('Sept astres déployés au maximum.');
        if (!validNode(s, c.node) || !deployNodes(s, pid).some((n) => nodeKey(n) === nodeKey(c.node))) return fail('Déploiement impossible hors des accès de votre étoile.');
        u.node = clone(c.node);
        return { ok: true };
      }
      if (!u.node) return fail('Un astre en réserve ne reçoit pas d’ordre.');
      if (c.type === 'cancelOrder') {
        if (!own(p.orders, u.id)) return fail('Cet astre n’a pas d’ordre.');
        delete p.orders[u.id]; return { ok: true };
      }
      const error = orderError(s, p, u, c.order, true);
      if (error) return fail(error);
      if (c.order.type === 'move') p.orders[u.id] = { type: 'move', to: { ring: c.order.to.ring, sector: c.order.to.sector } };
      else if (c.order.type === 'attack') p.orders[u.id] = { type: 'attack', target: { type: c.order.target.type, id: c.order.target.id } };
      else p.orders[u.id] = { type: 'guard' };
      return { ok: true };
    }
    if (c.type === 'refresh') {
      if (p.gold < 1) return fail('Énergie insuffisante.');
      p.gold--; releaseShop(s, p); fillShop(s, p); return { ok: true };
    }
    if (c.type === 'freeze') { p.frozen = !p.frozen; return { ok: true, frozen: p.frozen }; }
    if (c.type === 'upgrade') {
      if (p.tier >= 2) return fail('Niveau maximal atteint.');
      if (p.gold < 5) return fail('Énergie insuffisante.');
      p.gold -= 5; p.tier = 2; fillShop(s, p); return { ok: true };
    }
    if (c.type === 'clearOrders') { p.orders = {}; return { ok: true }; }
    if (c.type === 'lock') { p.locked = true; return { ok: true }; }
    return fail('Commande inconnue.');
  }
  // Après un succès, relire les joueurs et astres depuis state : leurs objets peuvent
  // être remplacés. Un refus conserve intégralement l'état et son compteur de hasard.
  function commit(state, next) { for (const k of Object.keys(state)) delete state[k]; Object.assign(state, next); }
  function action(state, pid, command) {
    try {
      const next = clone(state), result = applyAction(next, pid, command);
      if (!result.ok) return result;
      assertState(next); commit(state, next); return result;
    } catch (error) { return fail(error.message || 'État invalide.'); }
  }
  const nextDrift = (s) => [1, s.round % 2 === 0 ? 1 : 0, 0];
  // Même décision pour la résolution et la validation d'une sauvegarde terminale.
  function outcome(s) {
    const alive = alivePlayers(s);
    if (!alive.length) return { winners: [], draw: true, reason: 'mutual-destruction' };
    if (alive.length === 1) return { winners: [alive[0].id], draw: false, reason: 'stars' };
    if (alive.some((p) => p.score >= SCORE_GOAL)) {
      const best = Math.max(...alive.map((p) => p.score));
      const winners = alive.filter((p) => p.score === best).map((p) => p.id).sort();
      return { winners, draw: winners.length > 1, reason: 'score' };
    }
    return s.round >= ROUND_LIMIT ? { winners: [], draw: true, reason: 'round-limit' } : null;
  }
  function finish(s, events, winners, draw, reason) {
    s.phase = 'over';
    s.result = { winner: !draw && winners.length === 1 ? winners[0] : null, winners: winners.slice(), winnerIds: winners.slice(), draw, reason };
    events.push(Object.assign({ t: 'end' }, s.result));
  }
  function resolve(s) {
    if (s.phase !== 'planning') return fail('La partie est terminée.');
    if (!alivePlayers(s).every((p) => p.locked)) return fail('Tous les joueurs doivent verrouiller leurs ordres.');
    const events = [], ordered = s.units.filter((u) => u.node).slice().sort((a, b) => compare(a.id, b.id));
    const orders = new Map(ordered.map((u) => [u.id, playerOf(s, u.owner).orders[u.id]]));
    const proposals = new Map(), destinations = new Map(), moved = new Set();
    // L'accessibilité est évaluée sur le même plateau initial pour tous les déplacements.
    for (const u of ordered) {
      const order = orders.get(u.id);
      if (!order || order.type !== 'move') continue;
      const legal = moves(s, u.id).some((n) => nodeKey(n) === nodeKey(order.to));
      if (!legal) { events.push({ t: 'move', unitId: u.id, owner: u.owner, from: clone(u.node), to: clone(order.to), ok: false, reason: 'blocked' }); continue; }
      proposals.set(u.id, order.to);
      const key = nodeKey(order.to);
      destinations.set(key, (destinations.get(key) || 0) + 1);
    }
    for (const u of ordered) if (proposals.has(u.id)) {
      const to = proposals.get(u.id), collision = destinations.get(nodeKey(to)) > 1;
      events.push({ t: 'move', unitId: u.id, owner: u.owner, from: clone(u.node), to: clone(to), ok: !collision, reason: collision ? 'collision' : null });
      if (!collision) { u.node = clone(to); moved.add(u.id); }
    }
    const guard = new Set(ordered.filter((u) => orders.get(u.id) && orders.get(u.id).type === 'guard').map((u) => u.id));
    const ice = new Set();
    for (const u of ordered) if (guard.has(u.id) && cardOf(u).family === 'glace') {
      for (const v of ordered) if (v.owner === u.owner && v.id !== u.id && distance(s, u.node, v.node) === 1) ice.add(v.id);
    }
    const damageUnits = new Map(), damageStars = new Map();
    // Les tirs sont tous calculés avant d'appliquer les dégâts : un astre détruit tire aussi.
    for (const u of ordered) {
      const order = orders.get(u.id);
      if (!order || order.type !== 'attack') continue;
      const t = order.target;
      if (!targets(s, u.id).some((v) => v.type === t.type && v.id === t.id)) {
        events.push({ t: 'hit', unitId: u.id, owner: u.owner, target: clone(t), n: 0, ok: false, reason: 'out-of-range' }); continue;
      }
      let n = stats(s, u).attack;
      if (t.type === 'unit') {
        const target = unitOf(s, t.id), ts = stats(s, target);
        if (cardOf(u).family === 'neant' && target.hp <= ts.maxHp / 2) n++;
        const armor = ts.armor + (guard.has(target.id) ? 2 : 0) + (ice.has(target.id) ? 1 : 0);
        n = Math.max(0, n - Math.max(0, armor - (cardOf(u).family === 'envers' ? 1 : 0)));
        damageUnits.set(t.id, (damageUnits.get(t.id) || 0) + n);
      } else damageStars.set(t.id, (damageStars.get(t.id) || 0) + n);
      events.push({ t: 'hit', unitId: u.id, owner: u.owner, target: clone(t), n, ok: true });
    }
    for (const [id, n] of damageUnits) unitOf(s, id).hp -= n;
    for (const [id, n] of damageStars) playerOf(s, id).hp = Math.max(0, playerOf(s, id).hp - n);
    for (const u of ordered) if (u.hp <= 0) removeUnit(s, u, events);
    for (const p of s.players) if (p.hp <= 0) {
      for (const u of s.units.filter((v) => v.owner === p.id)) removeUnit(s, u, events);
      releaseShop(s, p); p.orders = {}; p.gold = 0; p.locked = true; p.frozen = false;
    }
    const healing = new Map(), lunar = new Set();
    for (const u of s.units) if (u.node && guard.has(u.id)) {
      if (cardOf(u).family === 'vie') healing.set(u.id, (healing.get(u.id) || 0) + 2);
      if (cardOf(u).family === 'lune') for (const v of s.units) if (v.node && v.owner === u.owner && v.id !== u.id && distance(s, u.node, v.node) === 1) lunar.add(v.id);
    }
    for (const id of lunar) healing.set(id, (healing.get(id) || 0) + 1);
    for (const [id, n] of healing) {
      const u = unitOf(s, id), before = u.hp;
      u.hp = Math.min(stats(s, u).maxHp, u.hp + n);
      if (u.hp > before) events.push({ t: 'heal', unitId: id, owner: u.owner, n: u.hp - before });
    }
    for (const u of s.units) u.movedLastRound = moved.has(u.id);
    const drift = nextDrift(s);
    for (const u of s.units) if (u.node && drift[u.node.ring]) {
      const from = clone(u.node);
      u.node.sector = wrap(s, u.node.sector + drift[u.node.ring]);
      events.push({ t: 'drift', unitId: u.id, owner: u.owner, from, to: clone(u.node) });
    }
    for (const relay of s.relays) {
      const u = occupied(s, relay);
      if (u) { const p = playerOf(s, u.owner); p.score++; events.push({ t: 'score', owner: p.id, playerId: p.id, n: 1, score: p.score, node: clone(relay) }); }
    }
    for (const p of s.players) p.orders = {};
    const alive = alivePlayers(s);
    const ending = outcome(s);
    if (ending) finish(s, events, ending.winners, ending.draw, ending.reason);
    else {
      s.round++;
      for (const p of alive.slice().sort((a, b) => compare(a.id, b.id))) {
        p.gold = Math.min(MAX_GOLD, 4 + s.round - 1); p.locked = false;
        if (!p.frozen) releaseShop(s, p);
        p.frozen = false; fillShop(s, p);
      }
    }
    return Object.assign({ ok: true, events, over: s.phase === 'over', result: s.result }, s.result || { winner: null, winners: [], winnerIds: [], draw: false, reason: null });
  }
  function resolveRound(state) {
    try {
      const next = clone(state), result = resolve(next);
      if (!result.ok) return result;
      assertState(next); commit(state, next); return result;
    } catch (error) { return fail(error.message || 'Résolution impossible.'); }
  }
  function poolAudit(s) {
    const total = Object.assign({}, s.pool);
    for (const p of s.players) if (Array.isArray(p.shop)) for (const id of p.shop) if (id) total[id] = (total[id] || 0) + 1;
    for (const u of s.units) total[u.cardId] = (total[u.cardId] || 0) + (u.golden ? 3 : 1);
    return total;
  }
  function assertState(s) {
    const check = (ok, message) => { if (!ok) throw new Error('Plateau invalide : ' + message); };
    check(s && typeof s === 'object' && s.v === 1, 'version');
    check(typeof s.seed === 'string' && integer(s.round) && s.round >= 1 && s.round <= ROUND_LIMIT, 'graine ou manche');
    check(['planning', 'over'].includes(s.phase), 'phase');
    check(Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= 6 && s.sectors === 6 * s.players.length, 'joueurs ou secteurs');
    check(Array.isArray(s.activeFamilies) && s.activeFamilies.length === 5 && new Set(s.activeFamilies).size === 5 && s.activeFamilies.every((id) => FAMILY_IDS.includes(id)), 'familles');
    check(integer(s.rc) && s.rc >= 0 && integer(s.nextUnitId) && s.nextUnitId >= 1, 'compteurs');
    check(Array.isArray(s.units) && Array.isArray(s.relays) && s.relays.length === Math.max(2, s.players.length), 'astres ou relais');
    check(s.relays.every((n) => validNode(s, n) && n.ring === 0 && n.sector % 6 === 3) && new Set(s.relays.map(nodeKey)).size === s.relays.length, 'positions des relais');
    const ids = new Set(), homes = new Set(), unitIds = new Set(), nodes = new Set();
    for (const p of s.players) {
      check(p && typeof p.id === 'string' && p.id && !ids.has(p.id) && typeof p.name === 'string' && ['human', 'bot'].includes(p.kind), 'identité de joueur');
      ids.add(p.id);
      check(integer(p.home) && p.home >= 0 && p.home < s.sectors && p.home % 6 === 0 && !homes.has(p.home), 'origine'); homes.add(p.home);
      check(s.activeFamilies.includes(p.family), 'famille de joueur');
      check(integer(p.hp) && p.hp >= 0 && p.hp <= 18 && integer(p.score) && p.score >= 0 && integer(p.gold) && p.gold >= 0 && p.gold <= MAX_GOLD && [1, 2].includes(p.tier), 'ressources');
      check(typeof p.locked === 'boolean' && typeof p.frozen === 'boolean' && p.orders && typeof p.orders === 'object' && !Array.isArray(p.orders), 'verrouillage ou ordres');
      check(Array.isArray(p.shop) && p.shop.length === (p.hp > 0 ? (p.tier === 2 ? 4 : 3) : 0), 'boutique');
      for (const id of p.shop) check(id === null || (own(CARDS, id) && s.activeFamilies.includes(CARDS[id].family) && CARDS[id].tier <= p.tier), 'offre');
    }
    for (const u of s.units) {
      check(u && typeof u.id === 'string' && u.id && !unitIds.has(u.id), 'identifiant d’astre'); unitIds.add(u.id);
      check(ids.has(u.owner) && playerOf(s, u.owner).hp > 0 && own(CARDS, u.cardId) && s.activeFamilies.includes(CARDS[u.cardId].family), 'propriétaire ou catalogue');
      check(typeof u.golden === 'boolean' && typeof u.movedLastRound === 'boolean' && integer(u.hp) && u.hp > 0 && u.hp <= stats(s, u).maxHp, 'PV ou fusion');
      check(u.node === null || validNode(s, u.node), 'case');
      if (u.node) { check(!nodes.has(nodeKey(u.node)), 'case occupée deux fois'); nodes.add(nodeKey(u.node)); }
    }
    for (const p of s.players) {
      check(s.units.filter((u) => u.owner === p.id && u.node).length <= ARMY_MAX && s.units.filter((u) => u.owner === p.id && !u.node).length <= BENCH_MAX, 'limite d’astres');
      for (const [id, order] of Object.entries(p.orders)) {
        const u = unitOf(s, id);
        check(p.hp > 0 && u && u.owner === p.id && u.node && !orderError(s, p, u, order, false), 'ordre');
      }
    }
    check(s.pool && s.poolTotal && typeof s.pool === 'object' && typeof s.poolTotal === 'object', 'réserve');
    const expected = s.activeFamilies.flatMap((family) => ROLES.map((role) => family + '-' + role.id)).sort();
    check(JSON.stringify(Object.keys(s.pool).sort()) === JSON.stringify(expected) && JSON.stringify(Object.keys(s.poolTotal).sort()) === JSON.stringify(expected), 'types de la réserve');
    const total = poolAudit(s);
    for (const id of expected) check(s.poolTotal[id] === COPIES && integer(s.pool[id]) && s.pool[id] >= 0 && total[id] === COPIES, 'conservation de ' + id);
    check(s.phase === 'planning' ? s.result === null : !!s.result && typeof s.result.draw === 'boolean' && Array.isArray(s.result.winners) && typeof s.result.reason === 'string', 'résultat');
    if (s.phase === 'over') {
      check(s.result.winners.every((id) => ids.has(id)) && new Set(s.result.winners).size === s.result.winners.length, 'vainqueurs');
      check(s.result.draw ? s.result.winner === null : s.result.winners.length === 1 && s.result.winner === s.result.winners[0], 'victoire');
      check(['stars', 'score', 'round-limit', 'mutual-destruction'].includes(s.result.reason), 'fin');
      const ending = outcome(s);
      check(ending && s.result.reason === ending.reason && s.result.draw === ending.draw && JSON.stringify(s.result.winners.slice().sort()) === JSON.stringify(ending.winners), 'résultat incompatible avec les étoiles, scores ou manche');
      if (own(s.result, 'winnerIds')) check(Array.isArray(s.result.winnerIds) && JSON.stringify(s.result.winnerIds.slice().sort()) === JSON.stringify(ending.winners), 'alias des vainqueurs');
    }
    return true;
  }
  function view(s, pid) {
    if (!playerOf(s, pid)) throw new Error('Joueur inconnu.');
    const publicState = clone(s);
    publicState.units = publicState.units.filter((u) => u.owner === pid || u.node);
    for (const p of publicState.players) if (p.id !== pid) { p.shop = null; p.orders = {}; }
    delete publicState.pool; delete publicState.poolTotal; delete publicState.rc; delete publicState.nextUnitId;
    return publicState;
  }
  function serialize(s) { assertState(s); return JSON.stringify(s); }
  function restore(saved) {
    const s = typeof saved === 'string' ? JSON.parse(saved) : clone(saved);
    assertState(s); return s;
  }

  return { FAMILIES, ROLES, CARDS, LIMITS, newGame, stats, action, moves, targets, deployNodes, resolveRound, view, serialize, restore, assertState, poolAudit, nodeKey, distance, nextDrift };
});
