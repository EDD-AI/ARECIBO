#!/usr/bin/env node
// ORBITE — lire les bugs signalés par les joueurs (bouton « ? » du jeu, v121), pour Claude ou le créateur.
// Node 22, aucune dépendance. Les rapports sont dans Firestore (collection « rapports ») : rien n'est
// jamais écrit dans le dépôt, qui est public. Aide : node orbite/tools/rapports.mjs --help
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'https://www.googleapis.com/auth/datastore';
const JPEG = 'data:image/jpeg;base64,';
const CONFIG = fileURLToPath(new URL('../js/online-config.js', import.meta.url));

export const AIDE = `ORBITE — les bugs signalés par les joueurs (bouton « ? » du jeu, collection Firestore « rapports »).

Utilisation, depuis la racine du dépôt :
  node orbite/tools/rapports.mjs                         les rapports non réglés, du plus récent au plus ancien
  node orbite/tools/rapports.mjs list --tous             tous les rapports, réglés compris
  node orbite/tools/rapports.mjs --captures <dossier>    enregistre aussi les captures d'écran (<id>.jpg)
  node orbite/tools/rapports.mjs regle <id> [<id>…]      marque des rapports comme réglés
  node orbite/tools/rapports.mjs rouvrir <id> [<id>…]    les remet à régler

Options :
  --tous                 inclure les rapports déjà réglés
  --max <n>              au plus n rapports (50 par défaut)
  --captures <dossier>   écrire les captures d'écran dans ce dossier (créé au besoin, hors du dépôt de préférence)
  --json                 sortie JSON (sans les images)
  --projet <id>          projet Firebase (sinon : celui du compte de service, puis js/online-config.js)
  -h, --help             cette aide

Accès :
  ORBITE_FIREBASE_SA        le JSON d'une clé de compte de service (console Firebase → Paramètres du
                            projet → Comptes de service → Générer une nouvelle clé privée)
  ORBITE_FIREBASE_SA_FILE   ou le chemin de ce fichier JSON
  FIRESTORE_EMULATOR_HOST   ex. 127.0.0.1:8085 : parler à l'émulateur local (aucune clé nécessaire)

La clé du compte de service ouvre toute la base : ne la mettez jamais dans le dépôt (il est public).
Dans Claude Code, ajoutez-la aux variables d'environnement de l'environnement (réglages), pas au code.
Derrière un proxy (variable HTTPS_PROXY), l'outil se relance avec NODE_USE_ENV_PROXY=1.`;

// ─── Arguments ──────────────────────────────────────────────
export function parseArgs(argv) {
  const o = { cmd: 'list', ids: [], tous: false, max: 50, json: false, captures: null, projet: null, aide: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help' || a === 'aide' || a === 'help') o.aide = true;
    else if (a === '--tous') o.tous = true;
    else if (a === '--json') o.json = true;
    else if (a === '--max') o.max = Number(argv[++i]);
    else if (a === '--captures') o.captures = argv[++i] || '';
    else if (a === '--projet') o.projet = argv[++i] || '';
    else if (a.startsWith('--')) throw new Error(`Option inconnue : ${a}`);
    else rest.push(a);
  }
  if (rest.length) {
    o.cmd = rest[0];
    o.ids = rest.slice(1);
  }
  if (!['list', 'regle', 'rouvrir'].includes(o.cmd)) throw new Error(`Commande inconnue : ${o.cmd}`);
  if (o.cmd !== 'list' && !o.ids.length) throw new Error(`« ${o.cmd} » attend au moins un identifiant de rapport.`);
  if (!Number.isInteger(o.max) || o.max < 1 || o.max > 1000) throw new Error('--max attend un nombre entier de 1 à 1000.');
  if (o.captures === '') throw new Error('--captures attend un dossier.');
  if (o.projet === '') throw new Error('--projet attend un identifiant de projet.');
  return o;
}

// ─── Accès à Firestore ──────────────────────────────────────
export function lireCompte(env) {
  let raw = env.ORBITE_FIREBASE_SA;
  if (!raw && env.ORBITE_FIREBASE_SA_FILE) raw = readFileSync(env.ORBITE_FIREBASE_SA_FILE, 'utf8');
  if (!raw) return null;
  let sa;
  try { sa = JSON.parse(raw); } catch (err) { throw new Error('Le compte de service n’est pas un JSON lisible (ORBITE_FIREBASE_SA ou ORBITE_FIREBASE_SA_FILE).'); }
  if (!sa.client_email || !sa.private_key) throw new Error('Le compte de service doit contenir client_email et private_key.');
  return sa;
}
const b64url = (s) => Buffer.from(s).toString('base64url');
// JWT signé RS256 avec la clé privée du compte de service (portée : Firestore).
export function signerJwt(sa, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id }));
  const body = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(sa.private_key).toString('base64url');
  return `${head}.${body}.${sig}`;
}
// Échange le JWT contre un jeton d'accès OAuth.
export async function jetonOAuth(sa, opts = {}) {
  const res = await fetch(opts.url || TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signerJwt(sa, opts.now) }).toString()
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Jeton OAuth refusé (${res.status}) : ${data.error_description || data.error || 'réponse inattendue'}`);
  return data.access_token;
}
function projetDuJeu() {
  try { return (/projectId:\s*'([^']+)'/.exec(readFileSync(CONFIG, 'utf8')) || [])[1] || null; } catch (err) { return null; }
}
// { base, headers } : l'émulateur (jeton « owner ») ou Firestore avec un compte de service.
export async function connexion(env, opts = {}) {
  const emu = env.FIRESTORE_EMULATOR_HOST;
  const sa = emu ? null : lireCompte(env);
  const projet = opts.projet || (sa && sa.project_id) || env.GCLOUD_PROJECT || projetDuJeu();
  if (!projet) throw new Error('Projet Firebase inconnu : passez --projet <id>.');
  const db = `projects/${projet}/databases/(default)/documents`;
  if (emu) return { projet, db, base: `http://${emu}/v1/${db}`, headers: { Authorization: 'Bearer owner' } };
  if (!sa) throw new Error('Aucun accès : définissez ORBITE_FIREBASE_SA (le JSON du compte de service) ou ORBITE_FIREBASE_SA_FILE (son chemin). Voir --help.');
  const token = await jetonOAuth(sa, { url: opts.tokenUrl });
  return { projet, db, base: `https://firestore.googleapis.com/v1/${db}`, headers: { Authorization: `Bearer ${token}` } };
}
async function appel(cx, method, path, body) {
  const res = await fetch(cx.base + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, cx.headers), body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && data.error ? data.error.message || data.error.status : res.statusText;
    const err = new Error(`Firestore a répondu ${res.status} : ${String(msg).trim()}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
export function depuisValeur(x) {
  if (!x) return null;
  if ('stringValue' in x) return x.stringValue;
  if ('integerValue' in x) return Number(x.integerValue);
  if ('doubleValue' in x) return x.doubleValue;
  if ('booleanValue' in x) return x.booleanValue;
  if ('timestampValue' in x) return x.timestampValue;
  if ('nullValue' in x) return null;
  if ('arrayValue' in x) return (x.arrayValue.values || []).map(depuisValeur);
  if ('mapValue' in x) return depuisChamps(x.mapValue.fields || {});
  return null;
}
export function depuisChamps(f) {
  const o = {};
  for (const k of Object.keys(f || {})) o[k] = depuisValeur(f[k]);
  return o;
}
const rapportDe = (doc) => Object.assign({ id: doc.name.split('/').pop() }, depuisChamps(doc.fields));

// Les rapports, du plus récent au plus ancien : non réglés (tous, jusqu'à 1000), ou les derniers.
export async function lister(cx, { tous = false, max = 50 } = {}) {
  const q = { from: [{ collectionId: 'rapports' }] };
  if (tous) Object.assign(q, { orderBy: [{ field: { fieldPath: 'cree' }, direction: 'DESCENDING' }], limit: max });
  else Object.assign(q, { where: { fieldFilter: { field: { fieldPath: 'regle' }, op: 'EQUAL', value: { booleanValue: false } } }, limit: 1000 });
  const rows = await appel(cx, 'POST', ':runQuery', { structuredQuery: q });
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r.document).map((r) => rapportDe(r.document));
  list.sort((a, b) => String(b.cree || '').localeCompare(String(a.cree || '')));
  return list.slice(0, max);
}
export async function marquer(cx, id, regle) {
  await appel(cx, 'PATCH', `/rapports/${encodeURIComponent(id)}?updateMask.fieldPaths=regle&currentDocument.exists=true`, { fields: { regle: { booleanValue: regle } } });
}

// ─── Affichage ──────────────────────────────────────────────
const nomVersion = (v) => `${Math.floor(v / 100)}.${String(v % 100).padStart(2, '0')}`;
const date = (iso) => (iso ? String(iso).slice(0, 16).replace('T', ' ') + ' UTC' : '?');
const ko = (s) => Math.round(s.length * 3 / 4 / 1024);
export function captureDe(r) { return typeof r.capture === 'string' && r.capture.startsWith(JPEG) ? r.capture : ''; }
export function texteRapport(r, i, fichier) {
  const cap = captureDe(r);
  const lignes = [
    `#${i + 1} · ${r.id} · ${date(r.cree)} · version ${nomVersion(r.version | 0)} (${r.version | 0}) · écran ${r.ecran || '?'} · ${r.regle ? 'RÉGLÉ' : 'à régler'}`,
    `   Pseudo : ${r.pseudo || '(inconnu)'} · compte : ${r.uid || '(sans compte)'} · langue : ${r.langue || '?'} · taille d’écran : ${r.taille || '?'}`,
    `   Appareil : ${r.appareil || '?'}`,
    `   Partie : ${r.etat || '(hors partie)'}`,
    `   Erreurs : ${r.erreurs && r.erreurs.length ? '' : 'aucune'}`
  ];
  for (const e of r.erreurs || []) lignes.push(`     - ${e}`);
  lignes.push(`   Capture : ${cap ? `oui (${ko(cap)} Ko)${fichier ? ` → ${fichier}` : ' · --captures <dossier> pour l’enregistrer'}` : 'non'}`);
  lignes.push('   Message :');
  for (const l of String(r.texte || '').split('\n')) lignes.push(`     ${l}`);
  return lignes.join('\n');
}
export function jsonRapport(r, fichier) {
  const cap = captureDe(r);
  const o = Object.assign({}, r);
  delete o.capture;
  o.capture = cap ? { ko: ko(cap), fichier: fichier || null } : null;
  return o;
}

// ─── Programme ──────────────────────────────────────────────
export async function main(argv, env = process.env, out = console.log) {
  let o;
  try { o = parseArgs(argv); } catch (err) { out(`${err.message}\n\n${AIDE}`); return 2; }
  if (o.aide) { out(AIDE); return 0; }
  const cx = await connexion(env, { projet: o.projet });
  if (o.cmd === 'regle' || o.cmd === 'rouvrir') {
    for (const id of o.ids) {
      await marquer(cx, id, o.cmd === 'regle');
      out(`${o.cmd === 'regle' ? 'Réglé' : 'Rouvert'} : ${id}`);
    }
    return 0;
  }
  const list = await lister(cx, { tous: o.tous, max: o.max });
  const fichiers = {};
  if (o.captures) {
    const dir = resolve(o.captures);
    mkdirSync(dir, { recursive: true });
    for (const r of list) {
      const cap = captureDe(r);
      if (!cap) continue;
      fichiers[r.id] = join(dir, `${r.id}.jpg`);
      writeFileSync(fichiers[r.id], Buffer.from(cap.slice(JPEG.length), 'base64'));
    }
  }
  if (o.json) { out(JSON.stringify({ projet: cx.projet, tous: o.tous, rapports: list.map((r) => jsonRapport(r, fichiers[r.id])) }, null, 2)); return 0; }
  if (!list.length) { out(o.tous ? 'Aucun rapport.' : 'Aucun rapport à régler.'); return 0; }
  out(list.map((r, i) => texteRapport(r, i, fichiers[r.id])).join('\n\n'));
  const n = list.filter((r) => !r.regle).length;
  out(`\n${list.length} rapport${list.length > 1 ? 's' : ''}${o.tous ? `, dont ${n} à régler` : ' à régler'} (projet ${cx.projet}). Marquer réglé : node orbite/tools/rapports.mjs regle <id>`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Le fetch de Node ignore HTTPS_PROXY sans NODE_USE_ENV_PROXY=1 (Node 22.21 et plus) : on se relance.
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy && !process.env.NODE_USE_ENV_PROXY && !process.env.FIRESTORE_EMULATOR_HOST) {
    const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: Object.assign({}, process.env, { NODE_USE_ENV_PROXY: '1' }) });
    process.exit(r.status == null ? 1 : r.status);
  }
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (err) => {
    console.error(`Erreur : ${err.message}`);
    process.exitCode = 1;
  });
}
