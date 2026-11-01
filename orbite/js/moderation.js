/* ORBITE — modération légère de la discussion en ligne (v133) : en partie classée, on parle à des
 * inconnus. Les gros mots courants (français, anglais, espagnol, allemand, portugais) sont masqués
 * par des étoiles, et les liens remplacés par [lien]. Le filtre s'applique à l'envoi et à
 * l'affichage (un ancien client ou un message trafiqué est filtré aussi chez celui qui le lit).
 * Règles pures, testables sous Node (tests/moderation.test.mjs). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OrbiteModeration = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // Mots entiers (après normalisation : minuscules, sans accents, chiffres « leet » remplacés,
  // lettres répétées plus de deux fois réduites à une).
  const WORDS = [
    // français
    'conne', 'connard', 'connards', 'connasse', 'salope', 'salopes', 'salaud', 'pute', 'putes', 'putain', 'merde', 'merdes', 'merdique',
    'nique', 'niquer', 'niques', 'ntm', 'fdp', 'tg', 'batard', 'batards', 'pd', 'pede', 'pedes', 'tapette', 'enfoire', 'enfoires', 'abruti',
    'debile', 'mongol', 'gogol', 'chier', 'bite', 'couille', 'couilles', 'cul', 'pouffiasse', 'grognasse', 'bouffon', 'triso', 'trisomique',
    // anglais
    'fuck', 'fucks', 'fucked', 'fucking', 'fucker', 'fuckers', 'shit', 'shits', 'shitty', 'bitch', 'bitches', 'asshole', 'assholes', 'bastard',
    'dick', 'dickhead', 'cunt', 'cunts', 'motherfucker', 'retard', 'retarded', 'slut', 'sluts', 'whore', 'whores', 'fag', 'fags', 'faggot',
    'nigger', 'niggers', 'nigga', 'niggas', 'wtf', 'stfu', 'kys',
    // espagnol
    'puta', 'putas', 'puto', 'putos', 'mierda', 'cabron', 'cabrones', 'gilipollas', 'pendejo', 'pendejos', 'joder', 'jodete', 'cono', 'maricon',
    'maricones', 'zorra', 'imbecil', 'idiota', 'estupido',
    // allemand
    'scheisse', 'scheiss', 'arschloch', 'hurensohn', 'fotze', 'wichser', 'schlampe', 'ficken', 'fick', 'missgeburt', 'spast', 'spasti', 'hure',
    // portugais
    'porra', 'caralho', 'merda', 'viado', 'foda', 'foder', 'fodase', 'otario', 'buceta', 'vagabunda', 'babaca', 'arrombado'
  ];
  // Débuts de mots (couvrent les variantes : enculé, enculer, niquez, fucktard…).
  const STEMS = ['encul', 'nique', 'fuck', 'putain', 'connar', 'connas', 'salop', 'bitch', 'motherf', 'nigg', 'faggot', 'hurens', 'arschl', 'gilipoll', 'caralh'];
  const BAD = new Set(WORDS);
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

  function norm(w) {
    let s = String(w).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
    s = s.replace(/[013457@$]/g, (c) => LEET[c] || c);
    return s.replace(/(.)\1{2,}/g, '$1');
  }
  const bad = (w) => { const n = norm(w); return n.length > 1 && (BAD.has(n) || STEMS.some((p) => n.startsWith(p))); };

  // Le texte avec ses gros mots en étoiles et ses liens remplacés.
  function soften(text) {
    let s = String(text || '');
    s = s.replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[lien]').replace(/\b[\w-]+\.(?:com|fr|net|org|io|gg|be|ch|ca|de|es|pt|br|xyz|ru|me|tv|co)(?:\/\S*)?/gi, '[lien]');
    // Les mots : lettres (accents compris), chiffres et symboles « leet » collés.
    return s.replace(/[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ffß0-9@$]+/g, (w) => (/[A-Za-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u00ffß]/.test(w) && bad(w) ? '*'.repeat(w.length) : w));
  }

  return { soften, bad };
});
