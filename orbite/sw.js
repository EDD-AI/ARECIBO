/* ORBITE — service worker : le jeu reste jouable hors ligne une fois installé. */
// Garder ce numéro égal à VERSION dans js/game.js et à version.json.
const CACHE = 'orbite-v98';
const SHELL = [
  './',
  './index.html',
  './atelier.html',
  './batisseur.html',
  './manifest.webmanifest',
  './version.json',
  './css/fonts.css',
  './css/game.css',
  './css/desk.css',
  './fonts/chakra-petch-400.woff2',
  './fonts/chakra-petch-500.woff2',
  './fonts/chakra-petch-600.woff2',
  './fonts/px-arcade.woff2',
  './fonts/px-terminal.woff2',
  './fonts/px-serigraphie.woff2',
  './fonts/px-pixel.woff2',
  './fonts/px-stade.woff2',
  './fonts/px-mini.woff2',
  './fonts/px-matrice.woff2',
  './fonts/px-cathode.woff2',
  './css/atelier.css',
  './css/batisseur.css',
  './js/zoom-fix.js',
  './js/i18n.js',
  './js/lang/regles.js',
  './js/lang/jeu.js',
  './js/lang/campagne.js',
  './js/lang/interface.js',
  './js/planet-engine.js',
  './js/planet-renderer.js',
  './js/stage.js',
  './js/eveil.js',
  './js/sfx.js',
  './js/rules.js',
  './js/world.js',
  './js/energy.js',
  './js/game.js',
  './js/campagne.js',
  './js/campagne-ui.js',
  './js/classement.js',
  './js/online-config.js',
  './js/online.js',
  './js/online-ui.js',
  './js/multi.js',
  './js/multi-ui.js',
  './js/chat.js',
  './js/invaders.js',
  './js/missions.js',
  './js/rover.js',
  './js/succes.js',
  './js/forge.js',
  './js/forge-ui.js',
  './js/atelier.js',
  './js/building-engine.js',
  './js/batiments/habitat.js',
  './js/batiments/vie-energie.js',
  './js/batiments/industrie-logistique.js',
  './js/batiments/science-defense.js',
  './js/building-renderer.js',
  './js/batisseur.js',
  './js/colonie-jeu.js',
  './js/colonie-ui.js',
  './js/exploration.js',
  './js/exploration-ui.js',
  './js/genese.js',
  './js/genese-ui.js',
  './js/essaim.js',
  './js/essaim-ui.js',
  './js/coeur.js',
  './js/coeur-ui.js',
  './js/sculpture.js',
  './js/sculpture-ui.js',
  './js/lang/batiments.js',
  './js/lang/succes.js',
  './js/lang/genese.js',
  './js/lang/duel.js',
  './js/lang/position.js',
  './js/lang/eveil.js',
  './js/lang/contenu.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './audio/back.mp3',
  './audio/blast.mp3',
  './audio/break.mp3',
  './audio/coin.mp3',
  './audio/confirm.mp3',
  './audio/crumble1.mp3',
  './audio/crumble2.mp3',
  './audio/crumble3.mp3',
  './audio/crumble4.mp3',
  './audio/down.mp3',
  './audio/drop1.mp3',
  './audio/drop2.mp3',
  './audio/drop3.mp3',
  './audio/error.mp3',
  './audio/glass1.mp3',
  './audio/glass2.mp3',
  './audio/glass3.mp3',
  './audio/glass4.mp3',
  './audio/glass5.mp3',
  './audio/glass6.mp3',
  './audio/hover.mp3',
  './audio/place1.mp3',
  './audio/place2.mp3',
  './audio/place3.mp3',
  './audio/place4.mp3',
  './audio/pluck1.mp3',
  './audio/pluck2.mp3',
  './audio/rise.mp3',
  './audio/roll.mp3',
  './audio/scratch.mp3',
  './audio/tap.mp3',
  './audio/type.mp3',
  './audio/wind.mp3',
  './audio/earth.mp3',
  './audio/menu.mp3',
  './audio/click1.mp3',
  './audio/click2.mp3',
  './audio/click3.mp3',
  './audio/click4.mp3',
  './audio/click5.mp3',
  // Musiques et sons d'ARECIBO (Studio Edda).
  './audio/arecibo1.mp3',
  './audio/arecibo2.mp3',
  './audio/space1.mp3',
  './audio/space2.mp3',
  './audio/space3.mp3',
  './audio/ship1.mp3',
  './audio/ship2.mp3',
  './audio/ship3.mp3',
  './audio/ui-click.mp3',
  './audio/ui-hover1.mp3',
  './audio/ui-hover2.mp3',
  './audio/ui-hover3.mp3',
  './audio/ui-text.mp3',
  './audio/ui-start.mp3',
  './audio/ui-on.mp3',
  './audio/ui-off.mp3',
  './audio/ui-wrong.mp3',
  './audio/jingle.mp3',
  './audio/alarm.mp3'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' : la copie hors ligne vient du serveur, jamais d'une page restée dans le cache
  // du navigateur (une page index.html périmée avec des scripts récents empêcherait le lancement).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Les lecteurs audio demandent des morceaux de fichier (en-tête Range) : hors ligne, on découpe
// la copie complète du cache, sinon Safari refuse de jouer la musique.
async function fromCache(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (!hit) return (await caches.match('./index.html')) || Response.error();
  const range = req.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return hit;
  const buf = await hit.arrayBuffer();
  const start = m[1] ? Number(m[1]) : Math.max(0, buf.byteLength - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes'
    }
  });
}

// Réseau d'abord (pour recevoir les mises à jour), cache en secours. Les fichiers du jeu sont
// toujours revalidés auprès du serveur (cache: 'no-cache') : le cache HTTP du navigateur ne peut
// pas resservir une ancienne version.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const same = new URL(e.request.url).origin === location.origin;
  // Les serveurs extérieurs (Firebase, connexion Google) passent sans le service worker.
  if (!same) return;
  // Les navigations gardent la requête d'origine (redirections de GitHub Pages).
  const net = same && e.request.mode !== 'navigate'
    ? fetch(e.request.url, { cache: 'no-cache', headers: e.request.headers, credentials: 'same-origin' })
    : fetch(e.request);
  e.respondWith(
    net
      .then((res) => {
        if (res.status === 200 && same) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => fromCache(e.request))
  );
});
