#!/usr/bin/env node
/* Exporte le plateau jouable dans un seul HTML, sans serveur ni dépendance. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };

function dataUrl(file) {
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) throw new Error('Format non pris en charge : ' + path.extname(file));
  return 'data:' + type + ';base64,' + fs.readFileSync(file).toString('base64');
}

function inlineStyles(file) {
  return fs.readFileSync(file, 'utf8').replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g, (full, quote, url) => {
    if (url.startsWith('#') || url.startsWith('data:')) return full;
    if (/^[a-z]+:/i.test(url) || url.startsWith('//')) throw new Error('Ressource distante inattendue : ' + url);
    return 'url("' + dataUrl(path.resolve(path.dirname(file), url)) + '")';
  });
}

function exportPlateau(output) {
  if (!output || path.extname(output).toLowerCase() !== '.html') throw new Error('Indiquez un fichier de sortie .html.');
  const destination = path.resolve(output);
  if (destination === path.join(ROOT, 'plateau.html') || destination === path.join(ROOT, 'index.html')) {
    throw new Error('La sortie ne doit pas remplacer une page source.');
  }
  let html = fs.readFileSync(path.join(ROOT, 'plateau.html'), 'utf8');
  html = html.replace(/<link\b[^>]*rel="manifest"[^>]*>\s*/g, '');
  html = html.replace(/<link\b[^>]*rel="icon"[^>]*href="([^"]+)"[^>]*>/g, (full, src) =>
    '<link rel="icon" href="' + dataUrl(path.join(ROOT, src)) + '">');
  html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (full, src) =>
    '<style>\n' + inlineStyles(path.join(ROOT, src)) + '\n</style>');
  html = html.replace(/<script\b[^>]*src="([^"]+)"[^>]*>\s*<\/script>/g, (full, src) => {
    const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
    if (/<\/script/i.test(code)) throw new Error('Fermeture de script inattendue dans ' + src);
    return '<script>\n' + code + '\n</script>';
  });
  const filename = encodeURIComponent(path.basename(destination)).replace(/'/g, '%27');
  html = html.replace(/href="index\.html"/g, 'href="' + filename + '"');
  html = html.replace('</head>', '<script>window.ORBITE_STANDALONE = true;</script>\n</head>');
  const license = fs.readFileSync(path.join(ROOT, 'fonts/OFL.txt'), 'utf8').replace(/-->/g, '-- >');
  html = html.replace('<!doctype html>', '<!doctype html>\n<!-- ORBITE — version autonome. Police Chakra Petch :\n' + license + '\n-->');
  if (/<script\b[^>]*src=|<link\b[^>]*rel="stylesheet"/i.test(html)) throw new Error('Une dépendance n’a pas été intégrée.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, html);
  return { path: destination, bytes: Buffer.byteLength(html) };
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
      console.log('Usage : node orbite/tools/export-plateau.js /chemin/ORBITE.html');
    } else {
      if (args.length !== 1) throw new Error('Usage : node orbite/tools/export-plateau.js /chemin/ORBITE.html');
      console.log(JSON.stringify(exportPlateau(args[0])));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { exportPlateau };
