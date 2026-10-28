import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Les scripts du lancement restent lisibles par les téléphones anciens (iOS 12, Safari 12) : pas de
// « a?.b » ni de « a ?? b ». Un seul de ces signes empêche tout le fichier de se charger, et le jeu
// reste noir. online.js (le jeu en ligne, à part) n'est pas concerné : sans lui, le solo marche.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map((m) => m[1]).filter((s) => !/^https?:|online\.js$/.test(s));
const MODERN = /[\w)\]]\?\.[\w$[(]|[\w)\]]\s*\?\?\s*[\w$'"([]/;

test('scripts du lancement sans syntaxe ES2020', () => {
  assert.ok(scripts.includes('js/game.js'));
  for (const src of scripts) {
    const lines = readFileSync(new URL('../' + src, import.meta.url), 'utf8').split('\n');
    lines.forEach((line, i) => {
      const code = line.replace(/^\s*\/\/.*$|\s\/\/\s.*$/, '');
      assert.ok(!MODERN.test(code), `${src}:${i + 1} utilise ?. ou ?? : ${line.trim().slice(0, 90)}`);
    });
  }
});

test('filet de secours présent et version de la page à jour', () => {
  assert.match(html, /window\.__orbiteRescue = rescue/);
  const game = readFileSync(new URL('../js/game.js', import.meta.url), 'utf8');
  const v = Number(/const VERSION = (\d+);/.exec(game)[1]);
  assert.equal(Number(/name="orbite-version" content="(\d+)"/.exec(html)[1]), v, 'balise orbite-version');
  assert.equal(JSON.parse(readFileSync(new URL('../version.json', import.meta.url), 'utf8')).v, v, 'version.json');
  assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), new RegExp(`'orbite-v${v}'`), 'cache de sw.js');
});
