#!/usr/bin/env node
/* ORBITE — kit visuel : export des scènes en PNG (ou GIF) à la taille EXACTE.
 *
 *   node presse/outils/exporter.cjs --port 8810 --groupe exemple [--scene carte] [--lang fr|en]
 *        [--sortie <dossier>] [--frais] [--manifeste]
 *
 *   --port      port du serveur HTTP lancé à la racine du jeu (/home/user/ARECIBO/orbite)
 *   --groupe    fichier de scènes presse/scenes/<groupe>.js
 *   --scene     une seule scène (sinon toutes celles du groupe) ; plusieurs : --scene a,b
 *   --lang      une seule langue (sinon toutes celles de chaque scène)
 *   --sortie    dossier de sortie (brouillons : un dossier du scratchpad) ; par défaut
 *               presse/png/<groupe>/, et alors png/manifest.json est réécrit
 *   --frais     recharge la page pour chaque image (plus lent ; isole les scènes)
 *   --manifeste réécrit seulement png/manifest.json (aucun rendu)
 *
 * Chaque image est écrite dans un fichier temporaire puis renommée (jamais de fichier à moitié
 * écrit). png/manifest.json est reconstruit en parcourant png/ (fichier temporaire + renommage,
 * relu ensuite pour rattraper un export concurrent d'un autre agent).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const PRESSE = path.resolve(__dirname, '..');
const PNG = path.join(PRESSE, 'png');

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2);
    const v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
    o[key] = v;
  }
  return o;
}

// ─── Dimensions d'un PNG / GIF (lecture de l'en-tête) ─────────────
function dims(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(32);
  fs.readSync(fd, b, 0, 32, 0);
  fs.closeSync(fd);
  if (b.slice(1, 4).toString() === 'PNG') return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20), alpha: b[25] === 6 || b[25] === 4 };
  if (b.slice(0, 3).toString() === 'GIF') return { largeur: b.readUInt16LE(6), hauteur: b.readUInt16LE(8), alpha: false };
  return null;
}

// Écriture atomique : fichier temporaire du même dossier, puis renommage.
function ecrireAtomique(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), '.' + path.basename(file) + '.' + process.pid + '.' + Date.now() + '.tmp');
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

// ─── Manifeste ────────────────────────────────────────────────────
function parcourir(dir, rel, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) parcourir(p, r, out);
    else if (/\.(png|gif)$/i.test(e.name)) out.push({ p, r });
  }
  return out;
}
function construireManifeste() {
  const fichiers = parcourir(PNG, '', []).map(({ p, r }) => {
    const st = fs.statSync(p);
    const d = dims(p) || {};
    const dossier = r.includes('/') ? r.split('/')[0] : '';
    const m = /-(fr|en)\.(png|gif)$/i.exec(r);
    let info = {};
    try { info = (JSON.parse(fs.readFileSync(path.join(PNG, dossier, '_infos.json'), 'utf8'))[path.basename(r)]) || {}; } catch (err) { info = {}; }
    return {
      chemin: r, dossier, nom: path.basename(r), type: r.toLowerCase().endsWith('.gif') ? 'gif' : 'png',
      // transparent : d'après le fond de la scène (un PNG du kit est toujours RGBA, même opaque).
      largeur: d.largeur || 0, hauteur: d.hauteur || 0, transparent: info.transparent != null ? !!info.transparent : !!d.alpha,
      octets: st.size, lang: m ? m[1].toLowerCase() : null,
      titre: info.titre || '', usage: info.usage || '', apercu: info.apercu || 'sombre', modifie: st.mtime.toISOString()
    };
  }).sort((a, b) => (a.dossier.localeCompare(b.dossier) || a.nom.localeCompare(b.nom)));
  const dossiers = [...new Set(fichiers.map((f) => f.dossier))];
  return { genere: new Date().toISOString(), total: fichiers.length, dossiers, fichiers };
}
function ecrireManifeste() {
  // Réécrit puis relit : si un autre export a ajouté un fichier entre-temps, on recommence.
  for (let k = 0; k < 4; k++) {
    const m = construireManifeste();
    ecrireAtomique(path.join(PNG, 'manifest.json'), JSON.stringify(m, null, 1) + '\n');
    const again = construireManifeste();
    const sig = (x) => x.fichiers.map((f) => f.chemin + ':' + f.octets).join('|');
    if (sig(again) === sig(m)) return m;
  }
  return null;
}
function ecrireInfos(groupe, infos) {
  const file = path.join(PNG, groupe, '_infos.json');
  let cur = {};
  try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) { cur = {}; }
  Object.assign(cur, infos);
  ecrireAtomique(file, JSON.stringify(cur, null, 1) + '\n');
}

// ─── Rendu ────────────────────────────────────────────────────────
async function main() {
  const o = args();
  if (o.manifeste) {
    const m = ecrireManifeste();
    console.log('manifest.json : ' + (m ? m.total + ' fichiers' : 'échec'));
    return;
  }
  const port = o.port, groupe = o.groupe;
  if (!port || !groupe) {
    console.error('Usage : node presse/outils/exporter.cjs --port <p> --groupe <g> [--scene <s>] [--lang fr|en] [--sortie <dossier>] [--frais]');
    process.exit(2);
  }
  if (!fs.existsSync(path.join(PRESSE, 'scenes', groupe + '.js'))) {
    console.error('Fichier de scènes introuvable : presse/scenes/' + groupe + '.js');
    process.exit(2);
  }
  const sortie = o.sortie ? path.resolve(o.sortie) : path.join(PNG, groupe);
  const officiel = !o.sortie;
  const { chromium } = require('/opt/node22/lib/node_modules/playwright');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const base = `http://localhost:${port}/presse/outils/rendu.html?groupe=${encodeURIComponent(groupe)}`;
  let page = null;
  const erreurs = [];
  async function ouvrir() {
    if (page) await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => erreurs.push(String(e && e.stack || e)));
    page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__pret === true || !!window.__erreur, null, { timeout: 120000 });
    const err = await page.evaluate(() => window.__erreur);
    if (err) throw new Error('Chargement du groupe « ' + groupe + ' » : ' + err);
  }
  let code = 0;
  try {
    const t0 = Date.now();
    await ouvrir();
    let scenes = await page.evaluate(() => Kit.listeScenes());
    if (o.scene && o.scene !== true) {
      const voulu = String(o.scene).split(',');
      const inconnues = voulu.filter((n) => !scenes.some((s) => s.nom === n));
      if (inconnues.length) throw new Error('Scène(s) inconnue(s) : ' + inconnues.join(', ') + ' (groupe : ' + scenes.map((s) => s.nom).join(', ') + ')');
      scenes = scenes.filter((s) => voulu.includes(s.nom));
    }
    const infos = {};
    let n = 0;
    for (const s of scenes) {
      for (const f of s.fichiers) {
        if (o.lang && o.lang !== true && f.lang && f.lang !== o.lang) continue;
        if (o.frais && n > 0) await ouvrir();
        const t1 = Date.now();
        erreurs.length = 0;
        const file = path.join(sortie, f.fichier);
        let buf;
        if (s.gif) {
          const b64 = await page.evaluate(async ({ nom, lang }) => Kit.blobBase64(await Kit.rendreGif(nom, lang)), { nom: s.nom, lang: f.lang });
          buf = Buffer.from(b64, 'base64');
        } else {
          const res = await page.evaluate(async ({ nom, lang }) => {
            const r = await Kit.rendreScene(nom, lang);
            return { dom: r.dom, url: r.dom ? null : r.canvas.toDataURL('image/png') };
          }, { nom: s.nom, lang: f.lang });
          if (res.dom) {
            // Scène avec des éléments HTML dans #calque : capture de la zone à la taille exacte.
            await page.setViewportSize({ width: s.largeur, height: s.hauteur });
            const el = await page.$('#scene');
            buf = await el.screenshot({ omitBackground: s.fond === 'transparent', animations: 'disabled' });
          } else {
            buf = Buffer.from(res.url.split(',')[1], 'base64');
          }
        }
        if (erreurs.length) throw new Error('Erreur dans la scène « ' + s.nom + ' » (' + (f.lang || '-') + ') :\n' + erreurs.join('\n'));
        ecrireAtomique(file, buf);
        const d = dims(file);
        if (!d || d.largeur !== s.largeur || d.hauteur !== s.hauteur) {
          throw new Error(f.fichier + ' : taille ' + (d ? d.largeur + '×' + d.hauteur : '?') + ' au lieu de ' + s.largeur + '×' + s.hauteur);
        }
        infos[f.fichier] = { titre: s.titre, usage: s.usage, scene: s.nom, transparent: s.fond === 'transparent', apercu: s.apercu === 'clair' ? 'clair' : 'sombre' };
        n++;
        console.log(`✔ ${path.relative(process.cwd(), file)}  ${s.largeur}×${s.hauteur}  ${(buf.length / 1024).toFixed(0)} Ko  ${((Date.now() - t1) / 1000).toFixed(1)} s`);
      }
    }
    if (!n) console.log('Aucune image exportée (vérifier --scene / --lang).');
    if (officiel && n) {
      ecrireInfos(groupe, infos);
      const m = ecrireManifeste();
      console.log('manifest.json : ' + (m ? m.total + ' fichiers' : 'non vérifié'));
    }
    console.log(`${n} image(s) en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  } catch (err) {
    console.error('✘ ' + (err && err.message || err));
    code = 1;
  } finally {
    await browser.close();
  }
  process.exit(code);
}
main();
