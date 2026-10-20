// Vérifie les traductions (node orbite/tools/i18n-check.js [fichier.js …]) :
// chaque tr('…') des fichiers donnés (tous les js/*.js par défaut) doit avoir sa traduction dans les
// quatre langues, avec les mêmes {variables} et les mêmes balises HTML que le français.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const dict = { en: {}, es: {}, de: {}, pt: {} };
global.window = { OrbiteI18n: { add(maps) { for (const k of Object.keys(maps)) Object.assign(dict[k], maps[k]); } } };
for (const f of fs.readdirSync(path.join(root, 'js/lang'))) require(path.join(root, 'js/lang', f));

const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => path.join(root, 'js', f));
// Chaînes littérales passées à tr( : '…', "…" ou `…` sans ${}.
const RE = /\btr\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.|\$(?!\{))*)`)/g;
const unescape = (s) => s.replace(/\\(.)/g, (m, c) => (c === 'n' ? '\n' : c));
const keys = new Map();
for (const f of files) {
  const src = fs.readFileSync(path.resolve(f), 'utf8');
  let m;
  while ((m = RE.exec(src))) {
    const k = unescape(m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]);
    if (!keys.has(k)) keys.set(k, path.relative(root, path.resolve(f)));
  }
}
const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join(' ');
const tags = (s) => (s.match(/<\/?[a-z]+/gi) || []).map((t) => t.toLowerCase()).sort().join(' ');
let missing = 0, bad = 0;
for (const [k, where] of keys) {
  for (const l of Object.keys(dict)) {
    const v = dict[l][k];
    if (v == null) { missing++; if (missing <= 40) console.log(`MANQUE ${l} (${where}) : ${JSON.stringify(k).slice(0, 90)}`); continue; }
    if (vars(v) !== vars(k) || tags(v) !== tags(k)) { bad++; if (bad <= 40) console.log(`DIFFÉRENT ${l} : ${JSON.stringify(k).slice(0, 70)} → ${JSON.stringify(v).slice(0, 70)}`); }
  }
}
// Données traduites hors tr( : on vérifie aussi les clés du dictionnaire elles-mêmes.
for (const l of Object.keys(dict)) for (const [k, v] of Object.entries(dict[l])) {
  if (vars(v) !== vars(k) || tags(v) !== tags(k)) { bad++; if (bad <= 40) console.log(`DIFFÉRENT ${l} : ${JSON.stringify(k).slice(0, 70)} → ${JSON.stringify(v).slice(0, 70)}`); }
}
const sizes = Object.entries(dict).map(([l, d]) => `${l} ${Object.keys(d).length}`).join(', ');
console.log(`${keys.size} textes tr() vérifiés · entrées : ${sizes} · manquants ${missing} · différents ${bad}`);
process.exit(missing || bad ? 1 : 0);
