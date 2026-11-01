// Tests de la modération de la discussion : node --test orbite/tests/moderation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const M = createRequire(import.meta.url)('../js/moderation.js');

test('les gros mots sont masqués, dans les cinq langues et leurs variantes', () => {
  assert.equal(M.soften('espèce de connard'), 'espèce de *******');
  assert.equal(M.soften('Va te faire enculer !'), 'Va te faire ******* !');
  assert.equal(M.soften('fuuuck this'), '****** this');
  assert.equal(M.soften('$h1t'), '****');
  assert.equal(M.soften('qué mierda'), 'qué ******');
  assert.equal(M.soften('so ein Arschloch'), 'so ein *********');
  assert.equal(M.soften('que porra é essa'), 'que ***** é essa');
  assert.equal(M.soften('merde!'), '*****!');
});

test('les messages normaux passent intacts (pas de faux positifs courants)', () => {
  for (const ok of ['Bonne chance !', 'Bien joué, joli combo', 'GG', 'Revanche ?', 'bien jugado con tus cometas', 'Constellation', 'contre-attaque', 'Concours', 'Scunthorpe', 'Klasse gespielt', 'boa sorte', 'Aïe !']) {
    assert.equal(M.soften(ok), ok, ok);
  }
});

test('les liens sont remplacés', () => {
  assert.equal(M.soften('va sur https://exemple.com/x stp'), 'va sur [lien] stp');
  assert.equal(M.soften('www.truc.fr'), '[lien]');
  assert.equal(M.soften('rejoins discord.gg/abc'), 'rejoins [lien]');
});
