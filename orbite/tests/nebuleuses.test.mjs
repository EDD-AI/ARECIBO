// Tests des Nébuleuses (v107) : Vol de vie, vol de PV, vol d'astres déjà affrontés, PV rendus à
// l'univers et PV gardés pour toujours. node --test orbite/tests/nebuleuses.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const R = require('../js/rules.js');

let uidc = 0;
// Un astre hors réserve (pour les combats isolés, qui ne touchent pas à la réserve).
const unit = (id, row = 0, golden = false) => ({
  uid: 'n' + uidc++, id, golden, row, att: [],
  atk: R.CARD[id].atk * (golden ? 2 : 1), hp: R.CARD[id].hp * (golden ? 2 : 1), kw: (R.CARD[id].kw || []).slice()
});
const duel = (seed) => R.newGame(seed, 'siphon', { size: 2 });
const events = (r, t) => r.events.filter((e) => e.t === t);

test('la famille, sa loi, ses neuf astres et ses deux légendaires existent', () => {
  assert.ok(R.FAMILY_KEYS.includes('nebuleuse'));
  const cards = R.CARDS.filter((c) => c.fam === 'nebuleuse');
  assert.equal(cards.filter((c) => !c.legend).length, 9);
  assert.deepEqual(cards.filter((c) => c.legend).map((c) => c.id).sort(), ['attracteur', 'piliers']);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((t) => cards.some((c) => !c.legend && c.tier === t)), [true, true, true, true, true, true]);
  assert.equal(R.LAW.siphon.fam, 'nebuleuse');
  for (const c of cards) assert.equal(c.look.type, 'nebula', c.id + ' : rendu nébuleuse');
  assert.ok(R.KEYWORDS.voldevie);
});

test('Vol de vie : l’attaquant récupère les PV infligés, sans dépasser son maximum', () => {
  const s = duel('vdv');
  const A = s.players[0], B = s.players[1];
  // Voile 2/3 Vol de vie contre un Silex 1/4 : il perd 1 PV à la riposte et en récupère 2 (plafonné à 3).
  A.board = [unit('voile')];
  B.board = [unit('silex')];
  A.law = 'stase'; B.law = 'stase';
  const r = R.fight(s, A, B, 'vdv', true);
  const heals = events(r, 'heal').filter((e) => e.steal);
  assert.ok(heals.length > 0, 'au moins un Vol de vie');
  for (const h of heals) assert.ok(h.hp <= R.CARD.voile.hp, 'jamais au-delà du maximum');
});

test('Vol de vie sauve l’attaquant tombé à 0 sous la riposte', () => {
  const s = duel('sauve');
  const A = s.players[0], B = s.players[1];
  A.law = 'stase'; B.law = 'stase';
  // Voile 2/3 contre une Braise sans effet de début : 2 dégâts reçus, 2 infligés puis récupérés.
  const v = unit('voile'); v.hp = 2; v.atk = 2;
  const foe = unit('silex'); foe.atk = 2; foe.hp = 6; foe.kw = [];
  // Un astre de plus à l'arrière : le camp le plus nombreux attaque le premier.
  A.board = [v, unit('silex', 1)];
  B.board = [foe];
  const r = R.fight(s, A, B, 'sauve', true);
  const first = events(r, 'heal').find((e) => e.steal);
  assert.ok(first && first.hp > 0, 'remonté au-dessus de 0 PV');
});

test('Crabe vole des PV à chaque ennemi de l’avant ; Sablier en rend à l’univers', () => {
  const s = duel('crabe');
  const A = s.players[0], B = s.players[1];
  A.law = 'stase'; B.law = 'stase';
  A.board = [unit('crabe'), unit('sablier')];
  B.board = [unit('basalte'), unit('silex'), unit('monolithe')];
  const r = R.fight(s, A, B, 'crabe', true);
  assert.ok(events(r, 'drain').length >= 2, 'des PV volés à plusieurs ennemis');
  assert.ok(r.heal[0] > 0 && r.heal[0] <= 4, 'PV rendus à l’univers, 4 fois au plus');
  assert.equal(r.heal[1], 0);
});

test('Hélice : les PV volés par une Nébuleuse sont gardés pour toujours (+2, 3 fois par combat)', () => {
  const s = duel('helice');
  const A = s.players[0], B = s.players[1];
  A.law = 'stase'; B.law = 'stase';
  const crabe = unit('crabe');
  A.board = [crabe, unit('helice', 1)];
  B.board = [unit('basalte'), unit('silex'), unit('agate')];
  const before = crabe.hp;
  const r = R.fight(s, A, B, 'helice', true);
  const kept = events(r, 'keep').filter((e) => e.n > 0);
  assert.ok(kept.length >= 1);
  assert.ok(crabe.hp > before && crabe.hp <= before + 6, 'PV gardés sur l’astre du système, 3 fois 2 au plus');
});

test('Œil-de-Chat vole un astre déjà affronté, pris dans la réserve partagée', () => {
  const s = duel('vol');
  const p = s.players[0];
  const id = Object.keys(s.pool).find((k) => R.CARD[k].tier >= 4 && !R.CARD[k].legend && s.pool[k] > 0);
  p.foes = [id];
  p.lastFoe = [id];
  // L'Œil-de-Chat vient de la réserve, comme un achat.
  s.pool.oeilchat--;
  const eye = { uid: 'eye', id: 'oeilchat', golden: false, atk: 4, hp: 4, kw: [], att: [], row: 0 };
  p.hand.push(eye);
  const before = s.pool[id];
  const res = R.play(s, 'eye', 0, null, p);
  assert.ok(res.ok, res.reason);
  assert.ok(p.hand.some((u) => u.id === id), 'l’astre volé rejoint la main, même un gros');
  assert.equal(s.pool[id], before - 1, 'une copie quitte la réserve');
  assert.deepEqual(R.poolAudit(s), s.poolTotal, 'la réserve reste conservée');
});

test('sans astre affronté disponible, le vol prend un astre de la réserve à sa portée', () => {
  const s = duel('vol-vide');
  const p = s.players[0];
  p.foes = [];
  s.pool.hibou--;
  p.hand.push({ uid: 'owl', id: 'hibou', golden: false, atk: 3, hp: 2, kw: [], att: [], row: 0 });
  const n = p.hand.length;
  assert.ok(R.play(s, 'owl', 0, null, p).ok);
  assert.equal(p.hand.length, n, 'le Hibou part en jeu, un astre volé arrive');
  assert.deepEqual(R.poolAudit(s), s.poolTotal);
});

test('chacun se souvient des astres affrontés après un cycle', () => {
  const s = duel('memoire');
  for (let i = 0; i < 3 && !s.over; i++) { R.botTurn(s, s.players[0]); R.endTurn(s); }
  const p = s.players[0];
  assert.ok(Array.isArray(p.lastFoe) && Array.isArray(p.foes));
  assert.ok(p.foes.length >= p.lastFoe.length && p.foes.length <= 40);
});
