/* ORBITE — kit visuel : boîte à outils commune des scènes (bannières, couvertures, réseaux).
 *
 * Dépend de (dans cet ordre) : ../../js/planet-engine.js, ../../js/planet-renderer.js,
 * ../../js/rules.js, ../../js/world.js, glyphes.js, textes.js, puis ce fichier. Les traductions du
 * jeu (../../js/lang/regles.js, duel.js, jeu.js) peuvent être chargées APRÈS : elles remplissent le
 * dictionnaire anglais du kit (noms des astres en anglais).
 *
 * Tout le rendu des astres passe par le VRAI moteur du jeu, dans UN SEUL contexte WebGL hors écran
 * réutilisé (Chrome limite le nombre de contextes) : on dessine l'astre en basse résolution, on le
 * recopie dans une toile 2D, agrandi d'un facteur ENTIER au plus proche voisin.
 * Documentation : l'en-tête de chaque fonction ci-dessous (et la documentation remise aux agents).
 * Ce dossier outils/ n'est modifié que par l'agent « fondations ».
 */
(function (root) {
  'use strict';

  const OP = root.OrbitePlanets;
  const R = root.OrbiteRules;
  const GL = root.KitGlyphes;
  const TX = root.KitTextes;
  const WORLD = root.OrbiteWorld;
  if (!OP || !OP.Renderer) throw new Error('Kit : charger planet-engine.js et planet-renderer.js avant kit.js');
  if (!R) throw new Error('Kit : charger rules.js avant kit.js');
  if (!GL || !TX) throw new Error('Kit : charger glyphes.js et textes.js avant kit.js');

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const SCRIPT = document.currentScript ? document.currentScript.src : location.href;
  const RACINE = new URL('../../', SCRIPT).href; // racine du jeu (…/orbite/)

  // ─── Dictionnaire anglais (rempli par les fichiers js/lang/*.js du jeu) ──────
  const DICO = { en: {} };
  if (!root.OrbiteI18n) {
    root.OrbiteI18n = {
      kit: true,
      add(maps) { if (maps && maps.en) Object.assign(DICO.en, maps.en); }
    };
  }
  function tr(fr, lang) {
    lang = lang || Kit.lang || 'fr';
    if (lang === 'fr' || fr == null) return fr;
    const t = DICO[lang] && DICO[lang][fr];
    return t != null ? t : fr;
  }

  // ─── Couleurs ─────────────────────────────────────────────────
  const COULEURS = {
    noir: '#000000',
    fond: '#05060a',      // noir spatial le plus clair autorisé
    blanc: '#e8ecf2',     // texte
    gris: '#8a94a6',      // texte secondaire
    or: '#f6c453',        // accent (légendaires, appel à jouer) = --gold du jeu
    encre: '#f1ecda',     // --ink du jeu (texte de l'interface)
    pur: '#ffffff'        // blanc du logo du jeu
  };
  const hexRgb = (h) => {
    const s = String(h).replace('#', '');
    const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };
  const rgbHex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const css = (c) => (Array.isArray(c) ? `rgb(${c[0]},${c[1]},${c[2]})` : c);

  // ─── Familles, cartes, légendaires ────────────────────────────
  const FAMILLES = R.FAMILY_KEYS.map((cle) => ({
    cle,
    nom: R.FAMILIES[cle].name,
    nomEn: TX.FAMILLES_EN[cle] || R.FAMILIES[cle].name,
    couleur: R.FAMILIES[cle].color
  }));
  function famille(cle) {
    const f = R.FAMILIES[cle];
    if (!f) throw new Error('Kit.famille : famille inconnue « ' + cle + ' » (clés : ' + R.FAMILY_KEYS.join(', ') + ', neutre)');
    return { cle, nom: f.name, nomEn: TX.FAMILLES_EN[cle] || f.name, couleur: f.color, texte: f.text };
  }
  const couleurFamille = (cle) => famille(cle).couleur;
  function nomFamille(cle, lang) {
    const f = famille(cle);
    return (lang || Kit.lang) === 'en' ? f.nomEn : f.nom;
  }
  // Cartes du catalogue (jetons exclus sauf { jetons: true }).
  function cartes(f) {
    f = f || {};
    return R.CARDS.filter((c) => (f.jetons || !c.token)
      && (f.famille == null || c.fam === f.famille)
      && (f.legendaire == null || !!c.legend === !!f.legendaire)
      && (f.niveau == null || c.tier === f.niveau)
      && (f.type == null || c.look.type === f.type));
  }
  function carte(id) {
    const c = R.CARD[id];
    if (!c) throw new Error('Kit.carte : astre inconnu « ' + id + ' »');
    return c;
  }
  const LEGENDAIRES = R.CARDS.filter((c) => c.legend && !c.token).map((c) => c.id);
  const nom = (id, lang) => tr(carte(id).name, lang);

  // ─── Textes (outils/textes.js) ────────────────────────────────
  function entree(cle) {
    const e = TX.T[cle];
    if (!e) throw new Error('Kit.texte : clé inconnue « ' + cle + ' » (clés : ' + Object.keys(TX.T).join(', ') + ')');
    return e;
  }
  function texte(cle, lang) {
    const e = entree(cle), v = e[lang || Kit.lang || 'fr'] != null ? e[lang || Kit.lang || 'fr'] : e.fr;
    return Array.isArray(v) ? v.join(TX.SEP) : v;
  }
  function liste(cle, lang) {
    const e = entree(cle), v = e[lang || Kit.lang || 'fr'] != null ? e[lang || Kit.lang || 'fr'] : e.fr;
    return Array.isArray(v) ? v.slice() : [v];
  }

  // ─── Aléatoire et tramage ─────────────────────────────────────
  const rng = (graine) => OP.makeRng(OP.hashSeed(typeof graine === 'string' ? OP.hashString(graine) : (graine >>> 0), 77));
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  // Seuil de Bayer 4 × 4 (le même que les shaders du jeu) : un pixel est allumé si intensité > seuil.
  const bayer = (x, y) => (BAYER[(((x % 4) + 4) % 4) + (((y % 4) + 4) % 4) * 4] + 0.5) / 16;
  // n tons d'une couleur, du plus sombre (fondu vers « fond ») au plus vif.
  function tons(couleur, n, fondC, haut) {
    const c = hexRgb(couleur), f = hexRgb(fondC || '#000000'), h = haut == null ? 1 : haut;
    const out = [];
    for (let i = 1; i <= n; i++) {
      const k = h * Math.pow(i / n, 1.15);
      out.push(rgbHex(f.map((v, j) => v + (c[j] - v) * k)));
    }
    return out;
  }
  // Tramage ordonné entre paliers : intensité k (0–1) → indice de ton (-1 = rien) sur n paliers.
  function palier(k, n, x, y) {
    const lv = clamp(k, 0, 1) * n, b = Math.floor(lv);
    const r = b + (lv - b > bayer(x, y) ? 1 : 0);
    return Math.min(n, r) - 1;
  }

  // ─── Moteur WebGL unique ──────────────────────────────────────
  let moteurGL = null;
  function moteur() {
    if (!moteurGL) {
      const c = document.createElement('canvas');
      c.width = c.height = 16;
      const r = new OP.Renderer(c, { transparent: true, preserve: true });
      c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); moteurGL = null; });
      moteurGL = { c, r };
    }
    return moteurGL;
  }
  const MAX_GL = 4096;
  // Toile 2D 1:1 de travail (copie du WebGL pour lire les pixels).
  function copie2D(src, w, h) {
    const t = document.createElement('canvas');
    t.width = w; t.height = h;
    const g = t.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    return t;
  }
  function toile(w, h) {
    const t = document.createElement('canvas');
    t.width = Math.max(1, Math.round(w));
    t.height = Math.max(1, Math.round(h));
    const g = t.getContext('2d');
    g.imageSmoothingEnabled = false;
    return t;
  }

  // ─── Génomes (comme OrbiteStage.genome, js/stage.js) ──────────
  const genomes = new Map();
  function lookDe(x, o) {
    if (x && typeof x === 'object') return x;
    if (typeof x === 'string') {
      if (PRESETS[x]) return PRESETS[x](o || {});
      return carte(x).look;
    }
    throw new Error('Kit.astre : donner un identifiant de carte (R.CARDS) ou un look { type, seed, … }');
  }
  // complet : décor « plein écran » (look.full du jeu : pas de version compacte des cartes).
  function genome(x, complet, o) {
    const look = lookDe(x, o);
    const key = JSON.stringify(look) + (complet ? '|full' : '');
    let g = genomes.get(key);
    if (!g) {
      const full = !!look.full || !!complet;
      if (look.living) g = OP.livingWorld(look.seed, look.living, { light: look.light });
      else g = OP.generate(look.seed, {
        type: look.type, compact: !full, facet: look.facet || 'off',
        ring: !!look.ring, debris: !!look.debris, moons: look.moons || 0, shell: !!look.shell,
        starClass: look.starClass, hueShift: look.hueShift, mood: look.mood,
        caps: look.caps, light: look.light, shape: look.shape || 'aucune', warm: look.warm, coreHue: look.coreHue,
        disk: look.disk, hot: look.hot, pitch: look.pitch, lens: look.lens, diskScale: look.diskScale, neb: look.neb, station: look.station, crescent: look.crescent, glow: look.glow,
        craters: look.craters, maria: look.maria, lights: look.lights, storm: look.storm, bands: look.bands, corona: look.corona, flare: look.flare, moonKind: look.moonKind,
        heat: look.heat, heart: look.heart, icecaps: look.icecaps, canyons: look.canyons, dust: look.dust, veil: look.veil, lightning: look.lightning,
        volcanoes: look.volcanoes, aurora: look.aurora, cyan: look.cyan, ringLook: look.ringLook, moonPlane: look.moonPlane, axis: look.axis, spin: look.spin, plain: look.plain
      });
      g.flip = !!look.flip;
      genomes.set(key, g);
    }
    return g;
  }

  // ─── Échelle : rayon en pixels d'astre et facteur entier ──────
  // taille : côté (px écran) du cadre de l'astre, comme l'élément data-planet du jeu : le corps
  // y tient avec son décor (rayon = cadre / 2 / étendue, étendue bornée à 1,12–1,75 comme le jeu ;
  // un anneau très large peut déborder du cadre, comme en jeu).
  // pixel : px écran par pixel d'astre (entier). Par défaut : taille / 110 arrondi, entre 3 et 8.
  function pixelAuto(taille) { return clamp(Math.round(taille / 110), 3, 8); }
  function echelle(x, o) {
    o = o || {};
    const g = x && x.body ? x : genome(x, o.complet, o);
    const ajuste = o.ajuste === 'corps' ? 1 : clamp(g.extent.x, 1.12, 1.75);
    let pixel = o.pixel ? Math.max(1, Math.round(o.pixel)) : 0;
    let rayon;
    if (o.rayon) {
      rayon = o.rayon;
      if (!pixel) pixel = pixelAuto(rayon * 2 * ajuste * 4);
    } else if (o.rayonEcran) {
      if (!pixel) pixel = pixelAuto(o.rayonEcran * 2 * ajuste);
      rayon = o.rayonEcran / pixel;
    } else {
      const taille = o.taille || 256;
      if (!pixel) pixel = pixelAuto(taille);
      rayon = (taille / 2 / pixel) / ajuste;
    }
    rayon = Math.max(3, rayon);
    return { pixel, rayon, rayonEcran: rayon * pixel, ajuste, cadre: Math.round(2 * rayon * ajuste * pixel) };
  }

  // Étendue maximale dessinée (en rayons du corps) : décor + halos + étincelles.
  function etendueDessin(g, o) {
    const b = g.body;
    let e = Math.max(g.extent.x, g.extent.y);
    if (o.dore) e = Math.max(e, 1.78);
    if (o.legendaire) e = Math.max(e, 1.82);
    if (b.glow) e = Math.max(e, b.glow + 0.15);
    if (o.halo) e = Math.max(e, 1 + o.halo + 0.1);
    if (o.bouclier) e = Math.max(e, 1.35);
    if (o.fantome) e = Math.max(e, 1.5);
    if (!g.compact) e = Math.max(e, 2.4);
    if (b.corona) e = Math.max(e, 1 + b.corona.len * 1.6);
    return e + 0.05;
  }

  // ─── Kit.astre ────────────────────────────────────────────────
  // x : identifiant de carte (R.CARDS, ex. 'betelgeuse'), préréglage ('horizon', 'trou-noir', …)
  //     ou look { type, seed, … } (mêmes champs que card.look).
  // o : voir la documentation (taille, pixel, rayon, rayonEcran, phase, decalage, dore, legendaire,
  //     flip, nu, lumiere, halo, dim, gel, bouclier, fantome, orient, complet, ajuste, coupe).
  // Rend : une toile 2D nette (fond transparent), recadrée au plus près, avec .kit = { cx, cy (centre
  // du corps en px de la toile), pixel, rayon (px d'astre), rayonEcran, boite {x,y,w,h} (carré du
  // corps), genome }.
  function astre(x, o) {
    o = Object.assign({}, typeof x === 'string' && PRESETS[x] ? PRESETS[x].opts : {}, o || {});
    const id = typeof x === 'string' && !PRESETS[x] ? x : null;
    const c = id ? carte(id) : null;
    if (o.legendaire == null) o.legendaire = !!(c && c.legend);
    const g = genome(x, o.complet, o);
    const E = echelle(g, o);
    const Rr = E.rayon, px = E.pixel;
    const half = Math.ceil(Rr * etendueDessin(g, o)) + 4;
    const size = 2 * half;
    if (size > MAX_GL) throw new Error('Kit.astre : astre trop grand (' + size + ' px d’astre). Augmenter « pixel » ou réduire la taille.');
    const { c: cv, r } = moteur();
    r.resize(size, size);
    r.clear();
    const t = o.phase == null ? 0.15 : o.phase;
    const phase = o.decalage === false ? ((t % 1) + 1) % 1 : (((t + (g.seed % 997) / 997) % 1) + 1) % 1;
    const st = { reveal: 1, phase, flash: 0, dim: o.dim == null ? 1 : o.dim, flip: 1 };
    if (o.halo) r.haloPass(4, half, half, Rr, 1 + o.halo, [1 + o.halo, 0.85, 0, 0], g.body.pal, 12, g.body.seed, o.lumiere || g.light, st);
    r.drawSystem(g, {
      cx: half, cy: half, R: Rr, phase,
      dim: st.dim, flip: o.flip != null ? !!o.flip : g.flip,
      golden: !!o.dore, legend: !!o.legendaire, shield: !!o.bouclier, ghost: !!o.fantome,
      frost: o.gel || 0, orient: o.orient || null, bare: !!o.nu, light: o.lumiere || null
    });
    // Coupe (comme data-clip de l'horizon du menu) : rien sous la ligne y = centre - coupe × rayon.
    if (o.coupe != null) {
      const gl = r.gl;
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(0, 0, size, Math.max(0, Math.floor(half + o.coupe * Rr)));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.disable(gl.SCISSOR_TEST);
    }
    // Recadrage au plus près des pixels dessinés.
    const t1 = copie2D(cv, size, size);
    const d = t1.getContext('2d').getImageData(0, 0, size, size).data;
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (let y = 0; y < size; y++) {
      for (let xx = 0; xx < size; xx++) {
        if (d[(y * size + xx) * 4 + 3]) {
          if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) { x0 = y0 = half; x1 = y1 = half; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const out = toile(bw * px, bh * px);
    out.getContext('2d').drawImage(t1, x0, y0, bw, bh, 0, 0, bw * px, bh * px);
    const cx = (half - x0) * px, cy = (half - y0) * px;
    out.kit = {
      type: 'astre', id, cx, cy, pixel: px, rayon: Rr, rayonEcran: Rr * px,
      boite: { x: cx - Rr * px, y: cy - Rr * px, w: 2 * Rr * px, h: 2 * Rr * px },
      genome: g
    };
    return out;
  }

  // Le plus grand rendu d'un astre (tout son décor compris : anneaux, lunes, halos) qui tient dans
  // largeur × hauteur px, à pixel fixe. o : options de Kit.astre + { largeur, hauteur } (défaut 512).
  // Quelques rendus d'essai (rapides une fois le shader compilé). PAS pour une animation : la
  // taille trouvée dépend de la phase (position des lunes) ; dans un GIF, utiliser Kit.astre avec
  // une taille fixe (ou appeler astreCadre une fois à t = 0 et réutiliser son .kit.rayon).
  function astreCadre(x, o) {
    o = Object.assign({}, o || {});
    const Wm = o.largeur || 512, Hm = o.hauteur || Wm;
    delete o.rayon; delete o.rayonEcran;
    let taille = Math.min(Wm, Hm), best = null;
    for (let k = 0; k < 6; k++) {
      const a = astre(x, Object.assign({}, o, { taille }));
      const r = Math.min(Wm / a.width, Hm / a.height);
      if (r >= 1) best = a;
      if (r >= 1 && r < 1.04) break;
      taille = Math.max(8, Math.floor(taille * (r >= 1 ? Math.min(r, 1.25) * 0.995 : r * 0.985)));
    }
    return best || astre(x, Object.assign({}, o, { taille: Math.max(8, taille) }));
  }

  // ─── Préréglages ──────────────────────────────────────────────
  // Lumière de l'horizon du menu (js/game.js, HZ_LIGHT) et graines des planètes des joueurs.
  const HZ_LIGHT = [-0.55, 0.62, 0.55];
  const WORLD_SEEDS = [5002, 5008, 5016, 5045];
  // Étapes de la planète du joueur (js/world.js) → liste d'améliorations achetées.
  function amelioration(stade) {
    if (!WORLD) return [];
    const U = WORLD.UPGRADES;
    const jusqua = { morte: -1, reveil: 0, eau: 1, vie: 2, civil: 3, terre: 4 }[stade];
    if (jusqua == null) throw new Error('Kit.horizon : stade inconnu « ' + stade + ' » (morte, reveil, eau, vie, civil, terre)');
    if (jusqua === 4) return U.map((u) => u.id);
    if (jusqua === 3) return U.filter((u) => u.id !== 'terre').map((u) => u.id);
    return U.filter((u) => u.stage <= jusqua).map((u) => u.id);
  }
  function lookHorizon(o) {
    o = o || {};
    const list = amelioration(o.stade || 'vie');
    const ch = Object.assign(WORLD ? WORLD.channels(list) : {}, o.canaux || {});
    return { seed: o.graine || WORLD_SEEDS[0], living: ch, full: true, light: o.lumiere || HZ_LIGHT };
  }
  const PRESETS = {
    // Grande planète d'horizon du menu (génome « horizon » du jeu), au stade « vie » par défaut.
    horizon: Object.assign((o) => lookHorizon(o), { opts: { ajuste: 'corps', halo: 0.16, phase: 0.05, decalage: false, orient: { lat: 0.45, lon: 0.3 } } }),
    // Trou noir : « Umbra » (Néant), anneau de photons et disque bleu, version carte (la plus lisible
    // en grand ; les autres : 'neant' disque d'or, 'oeilvide' turquoise avec complet: true,
    // 'evenement' vert-jaune, 'abysse' sans disque).
    'trou-noir': Object.assign(() => carte('umbra').look, { opts: {} }),
    // Bételgeuse (légendaire du Brasier).
    betelgeuse: Object.assign(() => carte('betelgeuse').look, { opts: { legendaire: true } }),
    // Nébuleuse : les Piliers de la Création (légendaire des Nébuleuses).
    nebuleuse: Object.assign(() => carte('piliers').look, { opts: { legendaire: true } }),
    // Éclipse de l'écran titre (js/game.js : title-star, title-moon).
    'titre-etoile': Object.assign(() => ({ type: 'star', seed: 4242, starClass: 'étoile blanche', full: true, moons: 0, ring: false, debris: false }), { opts: {} }),
    'titre-lune': Object.assign(() => ({ type: 'moon', seed: 31, full: true, moons: 0, ring: false, debris: false }), { opts: {} })
  };

  // Planète d'horizon : o.stade ('morte', 'reveil', 'eau', 'vie' [défaut], 'civil', 'terre'),
  // o.graine (5002 [défaut], 5008, 5016, 5045 : les quatre planètes possibles des joueurs),
  // o.canaux (remplace des canaux de js/world.js, ex. { ring: 1 } anneau solaire, { moon: 0 } sans
  // lune, { sats: 2 }, { clouds: 0.5 }), o.lumiere ([-0.55, 0.62, 0.55] comme au menu), o.halo (0,16
  // comme au menu), o.coupe (ex. 0.3 :
  // seul le dôme au-dessus de la ligne d'horizon du menu reste), plus les options de Kit.astre.
  // Par défaut le rayon vaut o.taille / 2 (ajuste: 'corps', comme data-fit="body" au menu).
  // Vue par défaut : orient { lat: 0.45, lon: 0.3 } (le pôle nord éclairé tourné vers nous, comme le
  // dôme visible au menu) : en globe entier, l'axe naturel montre sinon une calotte sud grise dans
  // l'ombre. orient: null rend l'axe et la rotation du jeu (à préférer avec « coupe »).
  function horizon(o) {
    return astre('horizon', o || {});
  }
  const trouNoir = (o) => astre(o && o.id ? o.id : 'trou-noir', Object.assign({}, o || {}));
  const etoile = (o) => astre(o && o.id ? o.id : 'betelgeuse', Object.assign({}, o || {}));
  const nebuleuse = (o) => astre(o && o.id ? o.id : 'nebuleuse', Object.assign({}, o || {}));

  // ─── Poser une toile du kit ───────────────────────────────────
  // ancrage : 'centre' (centre du corps pour un astre, de la boîte pour un mot), 'haut', 'bas',
  // 'gauche', 'droite', 'haut-gauche', 'haut-droite', 'bas-gauche', 'bas-droite' (bords de la
  // boîte .kit.boite). Positions arrondies au pixel : rien n'est jamais rééchantillonné.
  function poser(ctx, img, x, y, ancrage) {
    const k = img.kit || { cx: img.width / 2, cy: img.height / 2, boite: { x: 0, y: 0, w: img.width, h: img.height } };
    const b = k.boite || { x: 0, y: 0, w: img.width, h: img.height };
    const a = ancrage || 'centre';
    let ax = k.cx, ay = k.cy;
    if (a.includes('gauche')) ax = b.x;
    if (a.includes('droite')) ax = b.x + b.w;
    if (a.startsWith('haut')) ay = b.y;
    if (a.startsWith('bas')) ay = b.y + b.h;
    if (a === 'haut' || a === 'bas') ax = b.x + b.w / 2;
    if (a === 'gauche' || a === 'droite') ay = b.y + b.h / 2;
    const was = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    const dx = Math.round(x - ax), dy = Math.round(y - ay);
    ctx.drawImage(img, dx, dy);
    ctx.imageSmoothingEnabled = was;
    return { x: dx + b.x, y: dy + b.y, w: b.w, h: b.h };
  }
  function dessinerAstre(ctx, x, cx, cy, o) {
    const a = astre(x, o);
    poser(ctx, a, cx, cy, 'centre');
    return a;
  }

  // ─── Fond étoilé (comme le jeu : js/stage.js) ─────────────────
  // o : { x, y, largeur, hauteur (zone, défaut : toute la toile), pixel (2), graine (0x0b17),
  //       densite (1 = densité du jeu : une étoile pour 1800 px²), eclat (0,85 comme le jeu),
  //       phase (scintillement, 0), croix (true : garde les rares étoiles en croix du jeu),
  //       eviter : [{ x, y, r }] (disques sans étoiles, en px de la toile) }
  function etoiles(ctx, o) {
    o = o || {};
    const X = o.x || 0, Y = o.y || 0;
    const Wd = o.largeur || ctx.canvas.width - X, Hd = o.hauteur || ctx.canvas.height - Y;
    const px = Math.max(1, Math.round(o.pixel || 2));
    const w = Math.ceil(Wd / px), h = Math.ceil(Hd / px);
    if (w > MAX_GL || h > MAX_GL) throw new Error('Kit.etoiles : zone trop grande pour ce pixel');
    const n = Math.min(5800, Math.round((Wd * Hd) / 1800 * (o.densite == null ? 1 : o.densite)));
    const field = OP.makeStarfield(o.graine == null ? 0x0b17 : o.graine, n);
    field.theme = { top: [0, 0, 0], bot: [0, 0, 0], stars: [[255, 255, 255], [196, 214, 255], [255, 226, 200]] };
    field.nebula = null;
    // Fond sobre du jeu (js/stage.js) : des points fins et pâles, très peu d'étoiles en croix
    // (≈ 1 % de petites croix). croix: false les retire toutes.
    field.stars.forEach((st, i) => {
      if (st.kind === 3 || (st.kind === 2 && (i % 4 || o.croix === false))) st.kind = 1;
      if (st.kind === 1 && i % 3) st.kind = 0;
      st.dim *= 0.75;
    });
    const ev = (o.eviter || []).map((e) => ({ x: (e.x - X) / px, y: h - (e.y - Y) / px, r: e.r / px }));
    const skip = ev.length ? (sx, sy) => ev.some((e) => (sx - e.x) ** 2 + (sy - e.y) ** 2 < e.r * e.r) : null;
    const { c: cv, r } = moteur();
    r.resize(w, h);
    r.clear();
    const ph = o.phase || 0;
    r.drawStars(field, ph, { reveal: 1, phase: ph, flash: 0, dim: o.eclat == null ? 0.85 : o.eclat, flip: 1 }, n, skip);
    const t1 = copie2D(cv, w, h);
    const was = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(t1, 0, 0, w, h, X, Y, w * px, h * px);
    ctx.imageSmoothingEnabled = was;
    return n;
  }

  // Remplit la toile (ou une zone) d'une couleur pleine.
  function fond(ctx, couleur, zone) {
    const z = zone || { x: 0, y: 0, w: ctx.canvas.width, h: ctx.canvas.height };
    ctx.save();
    ctx.fillStyle = css(couleur || COULEURS.noir);
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.restore();
  }

  // ─── Mots en pixels (police du logo) ──────────────────────────
  // Rend une toile avec le mot dessiné en cellules carrées de o.pixel px.
  // o : { pixel (8), couleur ('#ffffff'), espace (1 colonne entre lettres), interligne (3 lignes),
  //       lueur (null | true | { couleur, rayon: 2.5 (cellules), force: 0.55, grain: pixel/2 }),
  //       ombre (null | true | { couleur: '#000', dx: 1, dy: 1 } en cellules),
  //       contour (null | true | { couleur: '#000', epaisseur: 1 } en cellules),
  //       couleurs (fonction (col, lig, lettre, i) → couleur, pour des dégradés en paliers) }
  // Texte sur plusieurs lignes : séparer par « \n » (chaque ligne est centrée).
  function cellulesMot(texte, espace, interligne) {
    const lignes = String(texte).toUpperCase().replace(/Œ/g, 'OE').replace(/Æ/g, 'AE').split('\n');
    const rows = lignes.map((l) => {
      let xx = 0;
      const cells = [];
      [...l].forEach((ch, i) => {
        const gph = GL.glyphe(ch);
        gph.forEach((row, yy) => [...row].forEach((b, k) => { if (b === '1') cells.push([xx + k, yy, ch, i]); }));
        xx += gph[0].length + espace;
      });
      return { w: Math.max(0, xx - espace), cells };
    });
    const W = Math.max(...rows.map((r) => r.w));
    const all = [];
    rows.forEach((r, li) => {
      const off = Math.floor((W - r.w) / 2);
      for (const c of r.cells) all.push([c[0] + off, c[1] + li * (7 + interligne), c[2], c[3]]);
    });
    return { w: W, h: rows.length * 7 + (rows.length - 1) * interligne, cells: all };
  }
  function motPixel(texte, o) {
    o = o || {};
    const px = Math.max(1, Math.round(o.pixel || 8));
    const M = cellulesMot(texte, o.espace == null ? 1 : o.espace, o.interligne == null ? 3 : o.interligne);
    // Lueur par défaut : bleu pâle pour un mot blanc (la lumière des étoiles), sinon la couleur du mot.
    const blanc = !o.couleur || /^#?(fff|ffffff|e8ecf2|f1ecda)$/i.test(String(o.couleur));
    const lueur = o.lueur ? Object.assign({ couleur: blanc ? '#8fa8ff' : o.couleur, rayon: 2, force: 0.7, eclat: 0.6, tons: 3, fond: '#000000', grain: Math.max(1, Math.round(px / 2)) }, o.lueur === true ? {} : o.lueur) : null;
    const ombre = o.ombre ? Object.assign({ couleur: '#000000', dx: 1, dy: 1 }, o.ombre === true ? {} : o.ombre) : null;
    const contour = o.contour ? Object.assign({ couleur: '#000000', epaisseur: 1 }, o.contour === true ? {} : o.contour) : null;
    // Marge (en cellules) pour la lueur, l'ombre et le contour.
    let mg = 0;
    if (lueur) mg = Math.max(mg, Math.ceil(lueur.rayon) + 1);
    if (ombre) mg = Math.max(mg, Math.abs(ombre.dx), Math.abs(ombre.dy));
    if (contour) mg = Math.max(mg, contour.epaisseur);
    const Wc = M.w + 2 * mg, Hc = M.h + 2 * mg;
    const out = toile(Wc * px, Hc * px);
    const g = out.getContext('2d');
    const set = new Set(M.cells.map((c) => (c[0] + mg) + ',' + (c[1] + mg)));
    if (lueur) {
      // Lueur tramée : pixels de lueur (grain) allumés par un seuil de Bayer selon la distance aux lettres.
      const gr = Math.max(1, Math.round(lueur.grain));
      const gw = Math.ceil(Wc * px / gr), gh = Math.ceil(Hc * px / gr);
      const pts = M.cells.map((c) => [c[0] + mg + 0.5, c[1] + mg + 0.5]);
      const T = tons(lueur.couleur, lueur.tons, lueur.fond, lueur.eclat);
      for (let yy = 0; yy < gh; yy++) {
        for (let xx = 0; xx < gw; xx++) {
          const cxp = (xx + 0.5) * gr / px, cyp = (yy + 0.5) * gr / px;
          if (set.has(Math.floor(cxp) + ',' + Math.floor(cyp))) continue;
          let dmin = 1e9;
          for (const p of pts) {
            const dx = Math.max(0, Math.abs(cxp - p[0]) - 0.5), dy = Math.max(0, Math.abs(cyp - p[1]) - 0.5);
            const dd = dx * dx + dy * dy;
            if (dd < dmin) dmin = dd;
          }
          const dist = Math.sqrt(dmin);
          if (dist >= lueur.rayon) continue;
          const i = palier(lueur.force * Math.pow(1 - dist / lueur.rayon, 1.4), lueur.tons, xx, yy);
          if (i < 0) continue;
          g.fillStyle = T[i];
          g.fillRect(xx * gr, yy * gr, gr, gr);
        }
      }
    }
    if (contour) {
      g.fillStyle = css(contour.couleur);
      const e = contour.epaisseur;
      for (const c of M.cells) g.fillRect((c[0] + mg - e) * px, (c[1] + mg - e) * px, (2 * e + 1) * px, (2 * e + 1) * px);
    }
    if (ombre) {
      g.fillStyle = css(ombre.couleur);
      for (const c of M.cells) g.fillRect((c[0] + mg + ombre.dx) * px, (c[1] + mg + ombre.dy) * px, px, px);
    }
    for (const c of M.cells) {
      g.fillStyle = css(o.couleurs ? o.couleurs(c[0], c[1], c[2], c[3]) : (o.couleur || COULEURS.pur));
      g.fillRect((c[0] + mg) * px, (c[1] + mg) * px, px, px);
    }
    out.kit = {
      type: 'mot', texte, pixel: px, cellules: { w: M.w, h: M.h },
      boite: { x: mg * px, y: mg * px, w: M.w * px, h: M.h * px },
      cx: mg * px + (M.w * px) / 2, cy: mg * px + (M.h * px) / 2
    };
    return out;
  }
  const logo = (o) => motPixel('ORBITE', o);
  // Largeur (px) du mot pour un pixel donné, et pixel entier le plus grand qui tient dans une largeur.
  const largeurMot = (texte, pixel, espace) => cellulesMot(texte, espace == null ? 1 : espace, 3).w * (pixel || 1);
  const pixelPourLargeur = (texte, largeur, espace) => Math.max(1, Math.floor(largeur / cellulesMot(texte, espace == null ? 1 : espace, 3).w));

  // ─── Polices et texte (Chakra Petch) ──────────────────────────
  const POLICES = [
    ['Chakra Petch', 'fonts/chakra-petch-400.woff2', '400'],
    ['Chakra Petch', 'fonts/chakra-petch-500.woff2', '500'],
    ['Chakra Petch', 'fonts/chakra-petch-600.woff2', '600'],
    ['ORB Arcade', 'fonts/px-arcade.woff2', '400'],
    ['ORB Terminal', 'fonts/px-terminal.woff2', '400'],
    ['ORB Serigraphie', 'fonts/px-serigraphie.woff2', '400'],
    ['ORB Pixel', 'fonts/px-pixel.woff2', '400'],
    ['ORB Stade', 'fonts/px-stade.woff2', '400'],
    ['ORB Mini', 'fonts/px-mini.woff2', '400'],
    ['ORB Matrice', 'fonts/px-matrice.woff2', '400'],
    ['ORB Cathode', 'fonts/px-cathode.woff2', '400']
  ];
  let pretP = null;
  // Kit.pret() : promesse résolue quand toutes les polices du kit sont chargées (à attendre avant de
  // mesurer ou d'écrire du texte ; rendu.html l'attend avant chaque scène).
  function pret() {
    if (!pretP) {
      pretP = Promise.all(POLICES.map(([fam, url, w]) => {
        const f = new FontFace(fam, `url(${RACINE + url}) format('woff2')`, { weight: w, style: 'normal' });
        document.fonts.add(f);
        return f.load().catch((err) => { console.error('Police introuvable : ' + url, err); });
      })).then(() => document.fonts.ready);
    }
    return pretP;
  }
  const ALIAS_POLICE = { chakra: 'Chakra Petch', arcade: 'ORB Arcade', terminal: 'ORB Terminal', serigraphie: 'ORB Serigraphie', pixel: 'ORB Pixel', stade: 'ORB Stade', mini: 'ORB Mini', matrice: 'ORB Matrice', cathode: 'ORB Cathode' };
  function styleTexte(ctx, o) {
    const fam = ALIAS_POLICE[o.police] || o.police || 'Chakra Petch';
    const taille = o.taille || 24;
    ctx.font = `${o.poids || 500} ${taille}px "${fam}"`;
    ctx.letterSpacing = ((o.espacement == null ? 0 : o.espacement) * taille) + 'px';
    ctx.fontKerning = 'normal';
    ctx.textBaseline = o.base || 'alphabetic';
    ctx.textAlign = 'left';
    return taille;
  }
  // Largeur d'une ligne (sans l'espacement ajouté après la dernière lettre).
  function largeurLigne(ctx, s, o) {
    const taille = styleTexte(ctx, o);
    const sp = (o.espacement || 0) * taille;
    const n = [...s].length;
    return Math.max(0, ctx.measureText(s).width - (n ? sp : 0));
  }
  function couper(ctx, texte, o) {
    const paras = String(texte).split('\n');
    if (!o.largeurMax) return paras;
    const out = [];
    for (const p of paras) {
      const mots = p.split(' ');
      let ligne = '';
      for (const m of mots) {
        const essai = ligne ? ligne + ' ' + m : m;
        if (ligne && largeurLigne(ctx, essai, o) > o.largeurMax) { out.push(ligne); ligne = m; }
        else ligne = essai;
      }
      out.push(ligne);
    }
    return out;
  }
  // Kit.ecrire(ctx, texte, x, y, o) : écrit du texte (Chakra Petch par défaut).
  // o : { taille (24 px), poids (400 | 500 | 600), couleur (blanc #e8ecf2), espacement (em, 0 ;
  //       titres : 0.2 à 0.3), align ('gauche' | 'centre' | 'droite'), base ('alphabetic' | 'top' |
  //       'middle'), police ('chakra' [défaut] | 'arcade' | 'terminal' | 'pixel' | 'stade' | …),
  //       largeurMax (px : retour à la ligne aux espaces normales, jamais aux insécables),
  //       interligne (1,3 × taille), majuscules (false), opacite (1),
  //       ombre (null | { couleur, dx, dy } : ombre nette, sans flou) }
  // Rend : { x, y, w, h, lignes } (boîte approximative du texte écrit).
  function ecrire(ctx, texte, x, y, o) {
    o = Object.assign({}, o || {});
    let s = String(texte);
    if (o.majuscules) s = s.toUpperCase();
    ctx.save();
    const taille = styleTexte(ctx, o);
    const lignes = couper(ctx, s, o);
    const lh = (o.interligne || 1.3) * taille;
    const al = o.align === 'centre' || o.align === 'center' ? 'c' : o.align === 'droite' || o.align === 'right' ? 'r' : 'l';
    let wmax = 0;
    if (o.opacite != null) ctx.globalAlpha = o.opacite;
    lignes.forEach((l, i) => {
      const w = largeurLigne(ctx, l, o);
      styleTexte(ctx, o);
      wmax = Math.max(wmax, w);
      const lx = al === 'c' ? x - w / 2 : al === 'r' ? x - w : x;
      const ly = y + i * lh;
      if (o.ombre) {
        ctx.fillStyle = css(o.ombre.couleur || '#000');
        ctx.fillText(l, Math.round(lx + (o.ombre.dx || 0)), Math.round(ly + (o.ombre.dy == null ? 2 : o.ombre.dy)));
      }
      ctx.fillStyle = css(o.couleur || COULEURS.blanc);
      ctx.fillText(l, Math.round(lx), Math.round(ly));
    });
    ctx.restore();
    const x0 = al === 'c' ? x - wmax / 2 : al === 'r' ? x - wmax : x;
    return { x: x0, y, w: wmax, h: lh * (lignes.length - 1) + taille, lignes };
  }
  function mesurer(ctx, texte, o) {
    ctx.save();
    o = Object.assign({}, o || {});
    let s = String(texte);
    if (o.majuscules) s = s.toUpperCase();
    styleTexte(ctx, o);
    const lignes = couper(ctx, s, o);
    const w = Math.max(...lignes.map((l) => largeurLigne(ctx, l, o)));
    const taille = o.taille || 24;
    ctx.restore();
    return { w, h: (o.interligne || 1.3) * taille * (lignes.length - 1) + taille, lignes };
  }
  // Plus grande taille (px entiers) pour qu'un texte tienne dans largeurMax (sur une ligne).
  function tailleQuiTient(ctx, texte, largeurMax, o) {
    o = Object.assign({}, o || {});
    let lo = 4, hi = o.tailleMax || 400;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (mesurer(ctx, texte, Object.assign({}, o, { taille: mid, largeurMax: 0 })).w <= largeurMax) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  // Logo + sous-titre « STUDIO EDDA » (Chakra Petch, petit, très espacé), centrés. Après Kit.pret().
  // o : options de Kit.logo (pixel, couleur, lueur, ombre, contour) +
  //     sousTitre ('STUDIO EDDA'), couleurSousTitre (gris #8a94a6), tailleSousTitre (auto : ~2,1 cellules),
  //     espacementSousTitre (0,42 em), ecart (px entre logo et sous-titre, auto : 2,2 cellules),
  //     poidsSousTitre (500).
  function logoStudio(o) {
    o = o || {};
    const L = logo(o);
    const px = L.kit.pixel;
    const st = o.sousTitre == null ? TX.T.studio.fr : o.sousTitre;
    const tst = o.tailleSousTitre || Math.max(9, Math.round(px * 2.1));
    const sp = o.espacementSousTitre == null ? 0.42 : o.espacementSousTitre;
    const ecart = o.ecart == null ? Math.round(px * 2.2) : o.ecart;
    const tmp = toile(4, 4).getContext('2d');
    const m = mesurer(tmp, st, { taille: tst, espacement: sp, poids: o.poidsSousTitre || 500 });
    const lb = L.kit.boite;
    const W = Math.max(L.width, Math.ceil(m.w) + 4);
    const capH = Math.round(tst * 0.72); // hauteur des capitales de Chakra Petch
    const H = lb.y + lb.h + ecart + capH + Math.max(L.height - lb.y - lb.h, 2);
    const out = toile(W, H);
    const g = out.getContext('2d');
    const lx = Math.round((W - L.width) / 2);
    g.drawImage(L, lx, 0);
    ecrire(g, st, W / 2, lb.y + lb.h + ecart + capH, { taille: tst, espacement: sp, align: 'centre', couleur: o.couleurSousTitre || COULEURS.gris, poids: o.poidsSousTitre || 500 });
    out.kit = { type: 'logo-studio', pixel: px, boite: { x: Math.min(lx + lb.x, (W - m.w) / 2), y: lb.y, w: Math.max(lb.w, m.w), h: lb.h + ecart + capH }, cx: W / 2, cy: lb.y + (lb.h + ecart + capH) / 2, logo: { x: lx + lb.x, y: lb.y, w: lb.w, h: lb.h } };
    return out;
  }

  // ─── Effets pixel tramés ──────────────────────────────────────
  // Tous en blocs de o.pixel px alignés sur la grille (0, 0) de la toile, tramage de Bayer 4 × 4.
  const grille = (v, p) => Math.floor(v / p);

  // Halo rond tramé par paliers de tons (comme les halos du jeu, sans dégradé lisse).
  // o : { rayon (px écran, 80), couleur (or), coeur (couleur du palier le plus vif, option),
  //   force (0,7 : intensité au centre, 0–1), tons (3 paliers), fond (couleur vers laquelle les
  //   tons s'assombrissent, '#000'), pixel (3), profil (1,5 : chute), vide (0 : rayon intérieur
  //   laissé vide, px écran, pour entourer un astre) }
  function halo(ctx, x, y, o) {
    o = o || {};
    const p = Math.max(1, Math.round(o.pixel || 3)), rr = o.rayon || 80, f = o.force == null ? 0.7 : o.force;
    const pr = o.profil || 1.5, vide = o.vide || 0, n = Math.max(1, o.tons || 3);
    const T = tons(o.couleur || COULEURS.or, n, o.fond);
    if (o.coeur) T[n - 1] = css(o.coeur);
    ctx.save();
    for (let gy = grille(y - rr, p); gy <= grille(y + rr, p); gy++) {
      for (let gx = grille(x - rr, p); gx <= grille(x + rr, p); gx++) {
        const d = Math.hypot((gx + 0.5) * p - x, (gy + 0.5) * p - y);
        if (d >= rr || d < vide) continue;
        const i = palier(f * Math.pow(1 - (d - vide) / (rr - vide), pr), n, gx, gy);
        if (i < 0) continue;
        ctx.fillStyle = T[i];
        ctx.fillRect(gx * p, gy * p, p, p);
      }
    }
    ctx.restore();
  }

  // Traînée (comète, tir) de (x0, y0) — la queue — à (x1, y1) — la tête. Paliers de tons tramés
  // de la couleur de queue (sombre, au bout) à la couleur de tête.
  // o : { pixel (3), couleur (tête, '#ffffff'), queue (couleur du bout de la queue, '#4f7bff'),
  //   epaisseur (1 : en pixels, la queue s'affine), tete (3 : éclat en croix à la tête, 0 = sans),
  //   tons (4), fond ('#000') }
  function trainee(ctx, x0, y0, x1, y1, o) {
    o = o || {};
    const p = Math.max(1, Math.round(o.pixel || 3));
    const L = Math.hypot(x1 - x0, y1 - y0) / p;
    const n = Math.max(2, Math.ceil(L * 2));
    const ep = o.epaisseur || 1, nt = o.tons || 4;
    const cT = hexRgb(o.couleur || '#ffffff'), cQ = hexRgb(o.queue || '#4f7bff'), cF = hexRgb(o.fond || '#000000');
    // Tons : du fond vers la queue puis vers la tête.
    const T = [];
    for (let i = 1; i <= nt; i++) {
      const u = i / nt;
      const c = u < 0.5 ? cF.map((v, j) => v + (cQ[j] - v) * (u / 0.5)) : cQ.map((v, j) => v + (cT[j] - v) * ((u - 0.5) / 0.5));
      T.push(rgbHex(c));
    }
    const vu = new Map();
    for (let i = 0; i <= n; i++) {
      const t = i / n; // 0 = queue, 1 = tête
      const gx = grille(x0 + (x1 - x0) * t, p), gy = grille(y0 + (y1 - y0) * t, p);
      const w = Math.max(1, Math.round(ep * (0.4 + 0.6 * t)));
      for (let a = -Math.floor((w - 1) / 2); a <= Math.floor(w / 2); a++) {
        for (let b = -Math.floor((w - 1) / 2); b <= Math.floor(w / 2); b++) {
          const key = (gx + a) + ',' + (gy + b);
          const k = Math.pow(t, 1.1) * (a || b ? 0.8 : 1);
          const idx = palier(k, nt, gx + a, gy + b);
          if (idx > (vu.has(key) ? vu.get(key) : -1)) vu.set(key, idx);
        }
      }
    }
    ctx.save();
    for (const [key, idx] of vu) {
      if (idx < 0) continue;
      const [gx, gy] = key.split(',').map(Number);
      ctx.fillStyle = T[idx];
      ctx.fillRect(gx * p, gy * p, p, p);
    }
    ctx.restore();
    if (o.tete !== 0) eclat(ctx, x1, y1, { pixel: p, taille: o.tete || 3, couleur: '#ffffff', forme: 'plus' });
  }

  // Éclat (étoile en croix, comme les grandes étoiles du jeu).
  // o : { pixel (3), taille (5 : 3, 5, 7, 9 pixels de branche à branche), couleur ('#ffffff'),
  //   halo (couleur des diagonales, option), forme ('etoile' [croix + diagonales] | 'plus') }
  function eclat(ctx, x, y, o) {
    o = o || {};
    const p = Math.max(1, Math.round(o.pixel || 3));
    const n = Math.max(1, Math.round(o.taille || 5)), h = Math.floor(n / 2);
    const gx = grille(x, p), gy = grille(y, p);
    ctx.save();
    ctx.fillStyle = css(o.couleur || '#ffffff');
    for (let k = -h; k <= h; k++) {
      ctx.fillRect((gx + k) * p, gy * p, p, p);
      ctx.fillRect(gx * p, (gy + k) * p, p, p);
    }
    if (o.forme !== 'plus' && h >= 2) {
      ctx.fillStyle = css(o.halo || o.couleur || '#ffffff');
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) ctx.fillRect((gx + a) * p, (gy + b) * p, p, p);
    }
    ctx.restore();
  }

  // Impact : gerbe de pixels autour d'un point (déterministe).
  // o : { pixel (3), rayon (60 px écran), couleurs (['#ffffff', '#ffd27a', '#ff9a3c']), n (36),
  //   graine (1), anneau (true : un cercle tramé au rayon), eclat (true : éclat blanc au centre) }
  function impact(ctx, x, y, o) {
    o = o || {};
    const p = Math.max(1, Math.round(o.pixel || 3)), rr = o.rayon || 60;
    const cols = (o.couleurs || ['#ffffff', '#ffd27a', '#ff9a3c']).map(css);
    const rnd = rng(o.graine == null ? 1 : o.graine);
    ctx.save();
    const n = o.n || 36;
    for (let i = 0; i < n; i++) {
      const a = rnd.range(0, Math.PI * 2), d = rr * Math.pow(rnd.next(), 0.6);
      const s = rnd.chance(0.25) ? 2 : 1;
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(grille(x + Math.cos(a) * d, p) * p, grille(y + Math.sin(a) * d, p) * p, s * p, s * p);
      // petite traînée vers le centre
      if (d > rr * 0.4 && rnd.chance(0.5)) {
        const d2 = d - p * 1.5;
        ctx.fillRect(grille(x + Math.cos(a) * d2, p) * p, grille(y + Math.sin(a) * d2, p) * p, p, p);
      }
    }
    if (o.anneau !== false) {
      ctx.fillStyle = cols[0];
      const m = Math.max(12, Math.round((2 * Math.PI * rr) / p));
      for (let i = 0; i < m; i++) {
        if (bayer(i, 1) > 0.55) continue;
        const a = (i / m) * Math.PI * 2;
        ctx.fillRect(grille(x + Math.cos(a) * rr, p) * p, grille(y + Math.sin(a) * rr, p) * p, p, p);
      }
    }
    if (o.eclat !== false) eclat(ctx, x, y, { pixel: p, taille: 7, couleur: '#ffffff', halo: cols[1] || cols[0] });
    ctx.restore();
  }

  // Dégradé TRAMÉ (pas de dégradé lisse) d'une couleur sur un rectangle : pour assombrir le bas
  // d'un visuel sous un texte, fondre un bord… o : { couleur ('#000'), de (0 : opacité au départ),
  // a (1 : à l'arrivée), sens ('bas' : de haut en bas | 'haut' | 'droite' | 'gauche' | 'centre' :
  // du centre vers les bords), pixel (3), courbe (1) }
  function tramage(ctx, x, y, w, h, o) {
    o = o || {};
    const p = Math.max(1, Math.round(o.pixel || 3));
    const de = o.de == null ? 0 : o.de, a = o.a == null ? 1 : o.a, cb = o.courbe || 1;
    ctx.save();
    ctx.fillStyle = css(o.couleur || '#000000');
    const gx0 = grille(x, p), gy0 = grille(y, p), gx1 = Math.ceil((x + w) / p), gy1 = Math.ceil((y + h) / p);
    for (let gy = gy0; gy < gy1; gy++) {
      for (let gx = gx0; gx < gx1; gx++) {
        const u = ((gx + 0.5) * p - x) / w, v = ((gy + 0.5) * p - y) / h;
        let t;
        switch (o.sens || 'bas') {
          case 'haut': t = 1 - v; break;
          case 'droite': t = u; break;
          case 'gauche': t = 1 - u; break;
          case 'centre': t = Math.min(1, Math.hypot(u - 0.5, v - 0.5) * 2); break;
          default: t = v;
        }
        const k = de + (a - de) * Math.pow(clamp(t, 0, 1), cb);
        if (k > bayer(gx, gy)) ctx.fillRect(gx * p, gy * p, p, p);
      }
    }
    ctx.restore();
  }

  // Sol d'horizon du menu (js/game.js, layoutMenu) : une ligne de crête en marches de pixels, noire,
  // dont le bord est éclairé au milieu (couleur de l'atmosphère de la planète d'horizon).
  // o : { y (ligne d'horizon, px), largeur (toile), hauteur (jusqu'en bas), pixel (2), couleur
  //   ('#020407'), bord (couleur du liseré ; défaut : celle de l'atmosphère de l'horizon), centre
  //   (x du liseré le plus vif, milieu), demi (demi-largeur éclairée, largeur × 0,4), graine (1) }
  function sol(ctx, o) {
    o = o || {};
    const W = o.largeur || ctx.canvas.width, H = o.hauteur || ctx.canvas.height;
    const p = Math.max(1, Math.round(o.pixel || 2));
    const y0 = o.y == null ? Math.round(H * 0.66) : o.y;
    let bord = o.bord;
    if (!bord) { const g = genome(lookHorizon(o)); bord = g.body.pal[12][3]; }
    const rnd = rng(o.graine == null ? 1 : o.graine);
    const cx = o.centre == null ? W / 2 : o.centre, demi = o.demi || W * 0.4;
    ctx.save();
    let yy = 4;
    const step = 3;
    for (let gx = 0; gx * p < W; gx += step) {
      if (rnd.next() < 0.35) yy = clamp(yy + (rnd.next() < 0.5 ? -1 : 1), 1, 8);
      const x = gx * p, top = y0 - 4 * p + yy * p;
      ctx.fillStyle = css(o.couleur || '#020407');
      ctx.fillRect(x, top, step * p, H - top);
      const lit = Math.max(0, 1 - Math.abs(x - cx) / demi);
      if (lit > 0.05) {
        ctx.globalAlpha = lit * 0.9;
        ctx.fillStyle = css(bord);
        ctx.fillRect(x, top, step * p, p);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  // ─── Scènes ───────────────────────────────────────────────────
  // Kit.scene({ nom, largeur, hauteur, dessiner, langues, fond, fichier, titre, usage, gif })
  // (voir la documentation). Enregistrée dans le groupe en cours de chargement (Kit.groupe).
  const SCENES = [];
  function scene(def) {
    if (!def || !def.nom || !def.largeur || !def.hauteur || typeof def.dessiner !== 'function') {
      throw new Error('Kit.scene : il faut { nom, largeur, hauteur, dessiner(ctx, s) }');
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(def.nom)) throw new Error('Kit.scene : nom « ' + def.nom + ' » : minuscules, chiffres et tirets seulement');
    const sc = Object.assign({ langues: ['fr', 'en'], fond: '#000000' }, def);
    sc.groupe = def.groupe || Kit.groupe || 'divers';
    if (sc.langues == null) sc.langues = [];
    if (SCENES.some((s) => s.nom === sc.nom && s.groupe === sc.groupe)) throw new Error('Kit.scene : « ' + sc.nom + ' » existe déjà dans le groupe ' + sc.groupe);
    SCENES.push(sc);
    return sc;
  }
  function trouverScene(nom) {
    const s = SCENES.find((x) => x.nom === nom);
    if (!s) throw new Error('Scène inconnue : « ' + nom + ' » (scènes : ' + SCENES.map((x) => x.nom).join(', ') + ')');
    return s;
  }
  function fichierDe(sc, lang) {
    const ext = sc.gif ? '.gif' : '.png';
    const base = sc.fichier ? sc.fichier(lang) : (lang ? sc.nom + '-' + lang : sc.nom);
    return base.replace(/\.(png|gif)$/i, '') + ext;
  }
  function listeScenes() {
    return SCENES.map((s) => ({
      nom: s.nom, groupe: s.groupe, largeur: s.largeur, hauteur: s.hauteur, titre: s.titre || '', usage: s.usage || '', apercu: s.apercu || 'sombre',
      langues: s.langues.slice(), gif: s.gif || null, fond: s.fond,
      fichiers: (s.langues.length ? s.langues : [null]).map((l) => ({ lang: l, fichier: fichierDe(s, l) }))
    }));
  }
  // Prépare la page (#scene, #toile, #calque) à la taille de la scène et la dessine.
  async function rendreScene(nom, lang, o) {
    o = o || {};
    const sc = trouverScene(nom);
    Kit.lang = lang || 'fr';
    document.documentElement.lang = Kit.lang;
    await pret();
    let zone = document.getElementById('scene');
    if (!zone) {
      zone = document.createElement('div');
      zone.id = 'scene';
      zone.innerHTML = '<canvas id="toile"></canvas><div id="calque"></div>';
      document.body.appendChild(zone);
    }
    const cv = document.getElementById('toile'), calque = document.getElementById('calque');
    // La page a pu être ouverte en mode liste (rendu.html?groupe=…) : on montre la zone de la scène.
    zone.style.display = '';
    for (const el of document.querySelectorAll('.liste, .err')) el.remove();
    window.scrollTo(0, 0);
    zone.style.width = sc.largeur + 'px';
    zone.style.height = sc.hauteur + 'px';
    cv.width = sc.largeur;
    cv.height = sc.hauteur;
    calque.innerHTML = '';
    document.body.style.background = sc.fond === 'transparent' ? 'transparent' : css(sc.fond);
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, sc.largeur, sc.hauteur);
    ctx.imageSmoothingEnabled = false;
    if (sc.fond && sc.fond !== 'transparent') fond(ctx, sc.fond);
    await sc.dessiner(ctx, { lang: lang || null, t: o.t || 0, largeur: sc.largeur, hauteur: sc.hauteur, calque, scene: sc, kit: Kit });
    await document.fonts.ready;
    const imgs = [...calque.querySelectorAll('img')];
    await Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
    return { canvas: cv, dom: calque.childElementCount > 0, scene: sc, fichier: fichierDe(sc, lang || null) };
  }
  // GIF animé d'une scène qui a { gif: { images (24), delai (8 centièmes de s), echelle (1) } } :
  // dessiner(ctx, s) est appelé pour s.t = 0, 1/n, … (n-1)/n. Rend un Blob image/gif (fond opaque).
  async function rendreGif(nom, lang) {
    const sc = trouverScene(nom);
    const G = Object.assign({ images: 24, delai: 8, echelle: 1 }, sc.gif || {});
    const frames = [];
    for (let i = 0; i < G.images; i++) {
      const r = await rendreScene(nom, lang, { t: i / G.images });
      frames.push(r.canvas.getContext('2d').getImageData(0, 0, sc.largeur, sc.hauteur).data);
    }
    return encoderGif(frames, sc.largeur, sc.hauteur, { delai: G.delai, echelle: G.echelle });
  }
  // Encodeur GIF du jeu (OP.encodeGif, palette ≤ 256, boucle infinie, sans transparence).
  // frames : tableaux RGBA (de haut en bas) w × h ; o : { delai (centièmes de s), echelle (entier) }.
  const encoderGif = (frames, w, h, o) => OP.encodeGif(frames, w, h, { scale: (o && o.echelle) || 1, delay: (o && o.delai) || 8 });
  const blobBase64 = (blob) => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1]);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });

  // ─── Export public ────────────────────────────────────────────
  const Kit = {
    lang: 'fr', groupe: null, RACINE,
    // données
    COULEURS, FAMILLES, LEGENDAIRES, faits: TX.faits, R, OP,
    famille, couleurFamille, nomFamille, cartes, carte, nom, tr, texte, liste,
    // astres
    genome, echelle, astre, astreCadre, poser, dessinerAstre, horizon, trouNoir, etoile, nebuleuse, PRESETS,
    HZ_LIGHT, WORLD_SEEDS, ameliorations: amelioration, moteur,
    // fonds
    etoiles, fond, sol,
    // logo et texte
    motPixel, logo, logoStudio, largeurMot, pixelPourLargeur, pret, ecrire, mesurer, tailleQuiTient,
    // effets
    halo, trainee, eclat, impact, tramage, bayer, rng, tons, palier,
    // couleurs
    hexRgb, rgbHex, css,
    // toiles
    toile,
    // scènes
    scene, listeScenes, rendreScene, rendreGif, encoderGif, blobBase64, fichierDe, trouverScene,
    _SCENES: SCENES
  };
  root.Kit = Kit;
})(window);
