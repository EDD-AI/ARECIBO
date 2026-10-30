import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer as tcpServer } from 'node:net';
import { createServer as httpServer } from 'node:http';
import { createHash, createVerify, generateKeyPairSync } from 'node:crypto';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { signerJwt, jetonOAuth, parseArgs, main, TOKEN_URL, SCOPE } from '../tools/rapports.mjs';

// Signaler un bug (v121) : les règles Firestore des rapports et du créateur, essayées pour de vrai dans
// l'émulateur Firestore (Java), puis le module du jeu (js/rapports.js) et l'outil de Claude
// (tools/rapports.mjs) contre ce même émulateur. Sans Java ou sans l'émulateur, ces essais sont sautés.
// Le vrai code créateur n'apparaît nulle part : l'empreinte des règles est remplacée, le temps du test,
// par celle d'un code d'essai.

const root = fileURLToPath(new URL('../', import.meta.url));
const RULES = readFileSync(join(root, 'firebase/firestore.rules'), 'utf8');
const HASH = '3cbd5100482381349aae3b30d9c5c9f1651329f6d0bcf316561306382ffb3db2';
const TEST_CODE = 'CODE-ESSAI-ORBITE';
const PROJECT = 'demo-rapports';

function findJar() {
  if (process.env.FIRESTORE_EMULATOR_JAR) return existsSync(process.env.FIRESTORE_EMULATOR_JAR) ? process.env.FIRESTORE_EMULATOR_JAR : null;
  const dir = join(homedir(), '.cache/firebase/emulators');
  let files = [];
  try { files = readdirSync(dir).filter((f) => /^cloud-firestore-emulator-.*\.jar$/.test(f)).sort(); } catch (err) { return null; }
  return files.length ? join(dir, files[files.length - 1]) : null;
}
const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
const JAR = findJar();
const SKIP = java.error || java.status !== 0 ? 'Java est absent : essais de l’émulateur sautés.' : !JAR ? 'Émulateur Firestore absent (~/.cache/firebase/emulators) : essais sautés.' : false;

test('le jeu et les règles partagent la même empreinte du code créateur, et seulement elle', () => {
  const game = readFileSync(join(root, 'js/game.js'), 'utf8');
  assert.equal((RULES.match(new RegExp(HASH, 'g')) || []).length, 1);
  assert.equal(/const CREATOR_CODE = '([0-9a-f]{64})'/.exec(game)[1], HASH);
  assert.equal(/hashing\.sha256\(request\.resource\.data\.cle\)\.toHexString\(\)\.lower\(\) == '([0-9a-f]{64})'/.exec(RULES)[1], HASH);
});

test('tools/rapports.mjs : aide en français et arguments vérifiés', () => {
  const env = Object.assign({}, process.env);
  delete env.HTTPS_PROXY; delete env.https_proxy;
  const r = spawnSync(process.execPath, [join(root, 'tools/rapports.mjs'), '--help'], { encoding: 'utf8', env, timeout: 20000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /les bugs signalés par les joueurs/);
  assert.match(r.stdout, /ORBITE_FIREBASE_SA/);
  assert.deepEqual(parseArgs([]), { cmd: 'list', ids: [], tous: false, max: 50, json: false, captures: null, projet: null, aide: false });
  assert.equal(parseArgs(['regle', 'a', 'b']).ids.length, 2);
  assert.equal(parseArgs(['--tous', '--max', '5']).max, 5);
  assert.throws(() => parseArgs(['regle']), /au moins un identifiant/);
  assert.throws(() => parseArgs(['--max', 'x']), /--max/);
  assert.throws(() => parseArgs(['--rien']), /Option inconnue/);
  const bad = spawnSync(process.execPath, [join(root, 'tools/rapports.mjs'), 'effacer'], { encoding: 'utf8', env, timeout: 20000 });
  assert.equal(bad.status, 2);
});

test('tools/rapports.mjs : JWT RS256 du compte de service échangé contre un jeton OAuth', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = { client_email: 'rapports@demo.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), private_key_id: 'cle-1', project_id: PROJECT };
  const jwt = signerJwt(sa, Date.UTC(2026, 9, 30));
  const [h, c, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'RS256', typ: 'JWT', kid: 'cle-1' });
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.iss, sa.client_email);
  assert.equal(claims.scope, SCOPE);
  assert.equal(claims.aud, TOKEN_URL);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${c}`).verify(publicKey, Buffer.from(s, 'base64url')));
  // Un faux serveur OAuth vérifie la signature et répond par un jeton.
  const srv = httpServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const p = new URLSearchParams(body);
      const [a, b, sig] = String(p.get('assertion')).split('.');
      const ok = p.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer' && createVerify('RSA-SHA256').update(`${a}.${b}`).verify(publicKey, Buffer.from(sig, 'base64url'));
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ok ? { access_token: 'jeton-oauth', expires_in: 3600 } : { error: 'invalid_grant' }));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    assert.equal(await jetonOAuth(sa, { url: `http://127.0.0.1:${srv.address().port}/token` }), 'jeton-oauth');
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' });
    await assert.rejects(jetonOAuth(Object.assign({}, sa, { private_key: other }), { url: `http://127.0.0.1:${srv.address().port}/token` }), /Jeton OAuth refusé \(400\)/);
  } finally { srv.close(); }
});

// ─── Avec l'émulateur ───────────────────────────────────────
const freePort = () => new Promise((res) => { const s = tcpServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// Jeton non signé : l'émulateur l'accepte et en tire request.auth.
function jwt(uid) {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: uid, user_id: uid, iat: now, auth_time: now, exp: now + 3600, firebase: { sign_in_provider: 'google.com', identities: {} } })}.`;
}
const val = (v) => (typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v } : Number.isInteger(v) ? { integerValue: String(v) } : Array.isArray(v) ? { arrayValue: v.length ? { values: v.map(val) } : {} } : { doubleValue: v });
const fieldsOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));
let n = 0;
const newId = () => ('rapport' + String(++n).padStart(4, '0') + 'ABCDEFGHIJKLMNO').slice(0, 20);
const VALID = { texte: 'Le bouton COMBATTRE ne répond plus.', version: 121, ecran: 'game', langue: 'fr', appareil: 'Mozilla/5.0 (iPhone)', taille: '390x844@2', erreurs: ['TypeError: x is undefined (game.js:42)'], regle: false };
const CAPTURE = 'data:image/jpeg;base64,' + Buffer.from('une capture d’essai').toString('base64');

describe('règles, jeu et outil contre l’émulateur Firestore', { skip: SKIP }, () => {
  let emu, base, docs, log = '';
  const url = (p) => `${docs}${p}`;
  async function req(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(url(path), { method, headers, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }
  function commit(path, data, token, stamp = 'cree') {
    const w = { update: { name: `projects/${PROJECT}/databases/(default)/documents/${path}`, fields: fieldsOf(data) }, currentDocument: { exists: false } };
    if (stamp) w.updateTransforms = [{ fieldPath: stamp, setToServerValue: 'REQUEST_TIME' }];
    return req('POST', ':commit', { writes: [w] }, token);
  }
  const report = (patch, token) => commit('rapports/' + newId(), Object.assign({}, VALID, patch), token);
  const query = (token, q) => req('POST', ':runQuery', { structuredQuery: Object.assign({ from: [{ collectionId: 'rapports' }] }, q || {}) }, token);
  const owner = 'owner';

  before(async () => {
    const port = await freePort();
    emu = spawn('java', ['-jar', JAR, '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    emu.stdout.on('data', (d) => { log += d; });
    emu.stderr.on('data', (d) => { log += d; });
    process.on('exit', () => { try { emu.kill('SIGKILL'); } catch (err) { /* déjà arrêté */ } });
    base = `http://127.0.0.1:${port}`;
    docs = `${base}/v1/projects/${PROJECT}/databases/(default)/documents`;
    const t0 = Date.now();
    for (;;) {
      try { if ((await fetch(base + '/')).ok) break; } catch (err) { /* pas encore prêt */ }
      if (Date.now() - t0 > 90000 || emu.exitCode != null) throw new Error('L’émulateur ne démarre pas :\n' + log.slice(-2000));
      await new Promise((r) => setTimeout(r, 250));
    }
    // Les règles du dépôt, avec l'empreinte d'un code d'essai à la place de celle du vrai code.
    const rules = RULES.replace(HASH, createHash('sha256').update(TEST_CODE).digest('hex'));
    const res = await fetch(`${base}/emulator/v1/projects/${PROJECT}:securityRules`, { method: 'PUT', body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }) });
    assert.equal(res.status, 200, await res.text());
  });
  after(async () => {
    if (!emu || emu.exitCode != null) return;
    const done = new Promise((r) => emu.once('exit', r));
    emu.kill('SIGTERM');
    await Promise.race([done, new Promise((r) => setTimeout(r, 5000))]);
    if (emu.exitCode == null) emu.kill('SIGKILL');
  });

  test('un rapport valide part sans compte, avec ou sans capture', async () => {
    assert.equal((await report({})).status, 200);
    assert.equal((await report({ capture: CAPTURE, etat: 'duel · cycle 3 · 42 PV', pseudo: 'Nova' })).status, 200);
    assert.equal((await report({ erreurs: [] })).status, 200);
    assert.equal((await report({ texte: 'é'.repeat(1000) })).status, 200, '1000 caractères accentués');
    // Capture à la limite : 600 000 caractères.
    assert.equal((await report({ capture: 'data:image/jpeg;base64,' + 'A'.repeat(600000 - 23) })).status, 200);
  });

  test('les rapports mal formés sont refusés', async () => {
    const bad = {
      'texte vide': { texte: '' },
      'texte trop long': { texte: 'x'.repeat(1001) },
      'texte non textuel': { texte: 12 },
      'capture trop grande': { capture: 'data:image/jpeg;base64,' + 'A'.repeat(600001 - 23) },
      'capture PNG': { capture: 'data:image/png;base64,AAAA' },
      'capture qui n’est pas une image': { capture: 'javascript:alert(1)' },
      'clé en trop': { piege: 'x' },
      'version texte': { version: '121' },
      'version nulle': { version: 0 },
      'écran trop long': { ecran: 'x'.repeat(25) },
      'appareil trop long': { appareil: 'x'.repeat(301) },
      'six erreurs': { erreurs: ['a', 'b', 'c', 'd', 'e', 'f'] },
      'erreur trop longue': { erreurs: ['a', 'x'.repeat(301)] },
      'erreur non textuelle': { erreurs: ['a', 3] },
      'erreurs non liste': { erreurs: 'boom' },
      'état trop long': { etat: 'x'.repeat(301) },
      'pseudo trop long': { pseudo: 'x'.repeat(17) },
      'déjà réglé': { regle: true }
    };
    for (const [name, patch] of Object.entries(bad)) assert.equal((await report(patch)).status, 403, name);
    const missing = Object.assign({}, VALID);
    delete missing.version;
    assert.equal((await commit('rapports/' + newId(), missing)).status, 403, 'version absente');
    assert.equal((await commit('rapports/' + newId(), VALID, null, null)).status, 403, 'sans heure du serveur');
    assert.equal((await commit('rapports/' + newId(), Object.assign({}, VALID, { cree: 5 }), null, null)).status, 403, 'heure inventée');
    assert.equal((await commit('rapports/court', VALID)).status, 403, 'identifiant hors format');
    // Renvoyer le même rapport : il existe déjà, rien n'est écrasé.
    const id = newId();
    assert.equal((await commit('rapports/' + id, VALID)).status, 200);
    assert.equal((await commit('rapports/' + id, Object.assign({}, VALID, { texte: 'remplacé' }))).status, 409);
  });

  test('uid : absent, ou celui du compte connecté, jamais celui d’un autre', async () => {
    assert.equal((await report({ uid: 'joueur-1' }, jwt('joueur-1'))).status, 200);
    assert.equal((await report({}, jwt('joueur-1'))).status, 200);
    assert.equal((await report({ uid: 'joueur-2' }, jwt('joueur-1'))).status, 403, 'uid usurpé');
    assert.equal((await report({ uid: 'joueur-1' })).status, 403, 'uid sans compte');
  });

  test('admins : créé seulement avec le bon code, par soi-même ; lisible par soi seul', async () => {
    assert.equal((await commit('admins/chef', { cle: 'MAUVAIS-CODE' }, jwt('chef'), null)).status, 403, 'mauvais code');
    assert.equal((await commit('admins/chef', { cle: TEST_CODE.toLowerCase() }, jwt('chef'), null)).status, 403, 'code en minuscules');
    assert.equal((await commit('admins/chef', { cle: TEST_CODE }, null, null)).status, 403, 'sans compte');
    assert.equal((await commit('admins/chef', { cle: TEST_CODE }, jwt('pirate'), null)).status, 403, 'pour un autre');
    assert.equal((await commit('admins/chef', { cle: TEST_CODE, role: 'x' }, jwt('chef'), null)).status, 403, 'clé en trop');
    assert.equal((await commit('admins/chef', { cle: TEST_CODE }, jwt('chef'), null)).status, 200, 'bon code');
    assert.equal((await req('GET', '/admins/chef', null, jwt('chef'))).status, 200);
    assert.equal((await req('GET', '/admins/chef', null, jwt('pirate'))).status, 403);
    assert.equal((await req('GET', '/admins/chef')).status, 403);
    assert.equal((await req('GET', '/admins/inconnu', null, jwt('inconnu'))).status, 404);
    assert.equal((await req('PATCH', '/admins/chef', { fields: { cle: val('AUTRE') } }, jwt('chef'))).status, 403, 'pas de modification');
    assert.equal((await req('DELETE', '/admins/chef', null, jwt('chef'))).status, 403, 'pas de suppression');
  });

  test('lecture, liste, réglage et suppression : le créateur seulement', async () => {
    const id = newId();
    assert.equal((await commit('rapports/' + id, VALID)).status, 200);
    // Un joueur, connecté ou non, ne lit rien.
    assert.equal((await req('GET', '/rapports/' + id)).status, 403);
    assert.equal((await req('GET', '/rapports/' + id, null, jwt('joueur-1'))).status, 403);
    assert.equal((await query(jwt('joueur-1'), { limit: 5 })).status, 403);
    assert.equal((await query(null, { limit: 5 })).status, 403);
    assert.equal((await req('PATCH', `/rapports/${id}?updateMask.fieldPaths=regle`, { fields: { regle: val(true) } }, jwt('joueur-1'))).status, 403);
    assert.equal((await req('DELETE', '/rapports/' + id, null, jwt('joueur-1'))).status, 403);
    // Le créateur (admins/chef, créé au test précédent) lit tout et règle.
    if ((await req('GET', '/admins/chef', null, jwt('chef'))).status === 404) await commit('admins/chef', { cle: TEST_CODE }, jwt('chef'), null);
    const one = await req('GET', '/rapports/' + id, null, jwt('chef'));
    assert.equal(one.status, 200);
    assert.ok(one.data.fields.cree.timestampValue, 'heure du serveur');
    const all = await query(jwt('chef'), { orderBy: [{ field: { fieldPath: 'cree' }, direction: 'DESCENDING' }], limit: 100 });
    assert.equal(all.status, 200);
    assert.ok(all.data.filter((r) => r.document).length >= 5);
    assert.equal((await req('PATCH', `/rapports/${id}?updateMask.fieldPaths=regle`, { fields: { regle: val(true) } }, jwt('chef'))).status, 200);
    assert.equal((await req('PATCH', `/rapports/${id}?updateMask.fieldPaths=texte`, { fields: { texte: val('modifié') } }, jwt('chef'))).status, 403, 'le texte ne change pas');
    assert.equal((await req('PATCH', `/rapports/${id}?updateMask.fieldPaths=regle`, { fields: { regle: val('oui') } }, jwt('chef'))).status, 403, 'regle booléen');
    assert.equal((await req('DELETE', '/rapports/' + id, null, jwt('chef'))).status, 200);
  });

  // ─── js/rapports.js, chargé comme dans le jeu (fenêtre simulée) ───
  function game(opts = {}) {
    const listeners = {}, store = new Map();
    const w = {
      console, URL, crypto: globalThis.crypto,
      fetch: opts.fetch || ((u, o) => fetch(u, o)),
      setTimeout: () => 0, clearTimeout: () => {},
      navigator: { userAgent: 'Mozilla/5.0 (essai)', onLine: opts.onLine !== false },
      localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } },
      document: { readyState: 'complete', getElementById: () => null, querySelector: () => null, addEventListener() {} },
      addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
      innerWidth: 390, innerHeight: 844, devicePixelRatio: 2,
      ORBITE_FIREBASE: { projectId: PROJECT, apiKey: 'cle-publique-essai' },
      ORBITE_FIREBASE_EMULATOR: { host: '127.0.0.1', port: Number(new URL(base).port) },
      OrbiteI18n: { lang: 'fr' },
      tr: (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s),
      OrbiteOnline: opts.online,
      __orbite: opts.orbite
    };
    w.window = w;
    vm.createContext(w);
    vm.runInContext(readFileSync(join(root, 'js/rapports.js'), 'utf8'), w, { filename: 'js/rapports.js' });
    return { w, R: w.OrbiteRapports, store, fire: (t, e) => (listeners[t] || []).forEach((f) => f(e)) };
  }
  const plain = (x) => JSON.parse(JSON.stringify(x));
  async function readBack(id) {
    const r = await req('GET', '/rapports/' + id, null, owner);
    assert.equal(r.status, 200, 'rapport introuvable : ' + id);
    return r.data.fields;
  }
  const lastId = async () => {
    const r = await query(owner, { orderBy: [{ field: { fieldPath: 'cree' }, direction: 'DESCENDING' }], limit: 1 });
    return r.data[0].document.name.split('/').pop();
  };

  test('js/rapports.js : le rapport du jeu (erreurs, partie, capture) passe les règles', async () => {
    const orbite = { version: 121, ui: { screen: 'game', state: { size: 2, round: 3, phase: 'shop', families: ['glace', 'feu'], players: [{ hp: 42, law: 'gravite' }] } } };
    const g = game({ orbite });
    g.fire('error', { message: 'TypeError: x is undefined', filename: 'https://edd-ai.github.io/ARECIBO/orbite/js/game.js?v=121', lineno: 42 });
    g.fire('error', { message: 'TypeError: x is undefined', filename: 'https://edd-ai.github.io/ARECIBO/orbite/js/game.js?v=121', lineno: 42 });
    g.fire('unhandledrejection', { reason: { message: 'réseau coupé' } });
    for (let i = 0; i < 6; i++) g.fire('error', { message: 'Erreur ' + i, filename: '', lineno: 0 });
    assert.equal(g.R.erreurs().length, 5, 'les 5 dernières');
    const g2 = game({ orbite });
    g2.fire('error', { message: 'TypeError: x is undefined', filename: 'https://h/js/game.js?v=1', lineno: 42 });
    g2.fire('error', { message: 'TypeError: x is undefined', filename: 'https://h/js/game.js?v=1', lineno: 42 });
    g2.fire('unhandledrejection', { reason: { message: 'réseau coupé' } });
    assert.deepEqual(plain(g2.R.erreurs()), ['TypeError: x is undefined (game.js:42) (×2)', 'promesse : réseau coupé']);
    g2.store.set('orbite.pseudo', 'Nova');
    assert.equal(await g2.R.envoyer('Le combat ne démarre pas.', CAPTURE), 'envoye');
    const f = await readBack(await lastId());
    assert.equal(f.texte.stringValue, 'Le combat ne démarre pas.');
    assert.equal(f.version.integerValue, '121');
    assert.equal(f.ecran.stringValue, 'game');
    assert.equal(f.langue.stringValue, 'fr');
    assert.equal(f.taille.stringValue, '390x844@2');
    assert.equal(f.pseudo.stringValue, 'Nova');
    assert.equal(f.capture.stringValue, CAPTURE);
    assert.equal(f.etat.stringValue, 'duel · cycle 3 · 42 PV · familles glace/feu · loi gravite · phase shop');
    assert.deepEqual(f.erreurs.arrayValue.values.map((v) => v.stringValue), ['TypeError: x is undefined (game.js:42) (×2)', 'promesse : réseau coupé']);
    assert.equal(f.regle.booleanValue, false);
    assert.ok(f.cree.timestampValue);
    assert.equal(f.uid, undefined, 'sans compte, pas d’uid');
    // Au menu : pas de partie jointe ; un texte trop long est coupé à 1000 caractères.
    const g3 = game({ orbite: { version: 121, ui: { screen: 'menu', state: orbite.ui.state } } });
    assert.equal(await g3.R.envoyer('y'.repeat(1500)), 'envoye');
    const f3 = await readBack(await lastId());
    assert.equal(f3.etat, undefined);
    assert.equal(f3.texte.stringValue.length, 1000);
    assert.equal(f3.capture, undefined);
  });

  test('js/rapports.js : joueur connecté, son uid part avec le rapport', async () => {
    const online = { configured: true, state: { status: 'signedIn' }, idToken: async () => jwt('joueur-9'), uid: () => 'joueur-9', on() {} };
    const g = game({ online, orbite: { version: 121, ui: { screen: 'menu' } } });
    assert.equal(await g.R.envoyer('Avec mon compte.'), 'envoye');
    const f = await readBack(await lastId());
    assert.equal(f.uid.stringValue, 'joueur-9');
  });

  test('js/rapports.js : hors ligne, le rapport attend (3 au plus, une capture) puis repart', async () => {
    const g = game({ onLine: false, orbite: { version: 121, ui: { screen: 'menu' } } });
    assert.equal(await g.R.envoyer('Premier, hors ligne.', CAPTURE), 'attente');
    assert.equal(g.R.enAttente().length, 1);
    assert.ok(g.store.has('orbite.rapports.envoi'), 'heure du dernier envoi notée');
    for (let i = 2; i <= 4; i++) await g.R.envoyer('Rapport ' + i + ', hors ligne.', CAPTURE);
    const wait = plain(g.R.enAttente());
    assert.equal(wait.length, 3, '3 au plus');
    assert.deepEqual(wait.map((x) => x.data.texte), ['Rapport 2, hors ligne.', 'Rapport 3, hors ligne.', 'Rapport 4, hors ligne.']);
    assert.deepEqual(wait.map((x) => !!x.data.capture), [false, false, true], 'une seule capture gardée');
    // Retour du réseau.
    g.w.navigator.onLine = true;
    assert.equal(await g.R.renvoyer(), 3);
    assert.equal(g.R.enAttente().length, 0);
    for (const x of wait) assert.equal((await readBack(x.id)).texte.stringValue, x.data.texte);
    // Renvoyer deux fois le même rapport ne crée pas de doublon (réponse « existe déjà » = reçu).
    g.store.set('orbite.rapports', JSON.stringify([wait[0]]));
    assert.equal(await g.R.renvoyer(), 1);
    assert.equal(g.R.enAttente().length, 0);
  });

  test('js/rapports.js : réseau coupé ou serveur en panne, puis abandon après 5 refus', async () => {
    let mode = 'reseau';
    const fakeFetch = async (u, o) => {
      if (mode === 'reseau') throw new TypeError('Failed to fetch');
      if (mode === 'panne') return new Response(JSON.stringify({ error: { code: 503 } }), { status: 503 });
      return fetch(u, o);
    };
    const g = game({ fetch: fakeFetch, orbite: { version: 121, ui: { screen: 'menu' } } });
    assert.equal(await g.R.envoyer('Réseau coupé.'), 'attente');
    assert.equal(await g.R.renvoyer(), 0);
    assert.equal(g.R.enAttente()[0].essais, 1, 'une panne de réseau ne compte pas');
    mode = 'panne';
    for (let i = 0; i < 3; i++) await g.R.renvoyer();
    assert.equal(g.R.enAttente()[0].essais, 4);
    mode = 'ok';
    assert.equal(await g.R.renvoyer(), 1, 'il finit par partir');
    mode = 'panne';
    assert.equal(await g.R.envoyer('Serveur en panne.'), 'plus-tard');
    for (let i = 0; i < 4; i++) await g.R.renvoyer();
    assert.equal(g.R.enAttente().length, 0, 'abandonné après 5 refus');
  });

  test('js/rapports.js : le code créateur crée admins/{uid}, après la connexion s’il le faut', async () => {
    const calls = [];
    const api = { toast: (t) => calls.push('toast:' + t), closeSheet: () => calls.push('close'), openSheet: (h) => calls.push('sheet:' + h), icon: () => '' };
    const fns = [];
    const online = { configured: true, state: { status: 'signedOut' }, idToken: async () => jwt('createur-1'), uid: () => 'createur-1', on: (f) => { fns.push(f); return () => {}; } };
    const g = game({ online, orbite: { version: 121, ui: { screen: 'menu' }, api } });
    assert.equal(g.R.createur(), false);
    await g.R.devenirCreateur(TEST_CODE);
    assert.ok(calls.some((c) => c.startsWith('sheet:') && c.includes('MODE CRÉATEUR')), 'demande la connexion');
    assert.equal((await req('GET', '/admins/createur-1', null, owner)).status, 404);
    // La connexion aboutit : le mode créateur s'active tout seul.
    online.state.status = 'signedIn';
    fns.forEach((f) => f(online.state));
    for (let i = 0; i < 50 && !g.R.createur(); i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(g.R.createur(), true);
    assert.equal((await req('GET', '/admins/createur-1', null, owner)).data.fields.cle.stringValue, TEST_CODE);
    assert.ok(calls.some((c) => c.startsWith('toast:Mode créateur activé')));
    // Sur un autre appareil, déjà créateur : rien à recréer.
    const g2 = game({ online, orbite: { version: 121, ui: { screen: 'menu' }, api } });
    await g2.R.devenirCreateur(TEST_CODE);
    assert.equal(g2.R.createur(), true);
    // Un compte qui n'a pas le droit (code refusé par les règles) n'active rien.
    const other = { configured: true, state: { status: 'signedIn' }, idToken: async () => jwt('intrus'), uid: () => 'intrus', on() {} };
    const g3 = game({ online: other, orbite: { version: 121, ui: { screen: 'menu' }, api } });
    await g3.R.devenirCreateur('FAUX-CODE');
    assert.equal(g3.R.createur(), false);
  });

  // ─── tools/rapports.mjs ───
  test('tools/rapports.mjs : liste, captures, JSON, réglé, rouvert', async () => {
    const env = { FIRESTORE_EMULATOR_HOST: new URL(base).host };
    const lines = [];
    const out = (s) => lines.push(String(s));
    assert.equal(await main(['--projet', PROJECT, '--max', '1000'], env, out), 0);
    const text = lines.join('\n');
    assert.match(text, /Le combat ne démarre pas\./);
    assert.match(text, /Capture : oui \(\d+ Ko\)/);
    assert.match(text, /à régler/);
    // Captures enregistrées en fichiers.
    const dir = mkdtempSync(join(tmpdir(), 'orbite-captures-'));
    try {
      lines.length = 0;
      assert.equal(await main(['--projet', PROJECT, '--max', '1000', '--json', '--captures', dir], env, out), 0);
      const json = JSON.parse(lines.join('\n'));
      const withCap = json.rapports.filter((r) => r.capture);
      assert.ok(withCap.length >= 1);
      assert.ok(json.rapports.every((r) => !r.regle));
      const one = withCap.find((r) => r.texte === 'Le combat ne démarre pas.');
      assert.equal(readFileSync(one.capture.fichier, 'utf8'), 'une capture d’essai');
      // Réglé : il sort de la liste, mais reste avec --tous.
      lines.length = 0;
      assert.equal(await main(['regle', one.id, '--projet', PROJECT], env, out), 0);
      assert.match(lines.join('\n'), new RegExp(`Réglé : ${one.id}`));
      lines.length = 0;
      await main(['--projet', PROJECT, '--max', '1000', '--json'], env, out);
      assert.ok(!JSON.parse(lines.join('\n')).rapports.some((r) => r.id === one.id));
      lines.length = 0;
      await main(['list', '--tous', '--projet', PROJECT, '--max', '1000', '--json'], env, out);
      assert.equal(JSON.parse(lines.join('\n')).rapports.find((r) => r.id === one.id).regle, true);
      lines.length = 0;
      assert.equal(await main(['rouvrir', one.id, '--projet', PROJECT], env, out), 0);
      assert.equal((await req('GET', '/rapports/' + one.id, null, owner)).data.fields.regle.booleanValue, false);
      await assert.rejects(main(['regle', 'inexistant0000000000', '--projet', PROJECT], env, out), /Firestore a répondu (404|400)/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
    // La vraie commande, lancée comme Claude le fera.
    const cli = spawnSync(process.execPath, [join(root, 'tools/rapports.mjs'), '--projet', PROJECT, '--max', '2'], { encoding: 'utf8', env: Object.assign({}, process.env, env), timeout: 30000 });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /#1 · [A-Za-z0-9]{20} · /);
  });
});
