/* ORBITE — traductions. Le français est la langue source : chaque texte français sert de clé, et
 * les fichiers js/lang/*.js ajoutent ses traductions (anglais, espagnol, allemand, portugais).
 * tr(texte, { n: 3 }) renvoie la traduction de la langue choisie, ou le français si elle manque,
 * et remplace {n} par la valeur donnée. Changer de langue enregistre le choix et recharge le jeu. */
(function () {
  'use strict';

  const LANGS = [
    { id: 'fr', name: 'Français' },
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Español' },
    { id: 'de', name: 'Deutsch' },
    { id: 'pt', name: 'Português' }
  ];
  const KEY = 'orbite.lang';
  const dict = { en: {}, es: {}, de: {}, pt: {} };

  function detect() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* stockage indisponible */ }
    if (saved && LANGS.some((l) => l.id === saved)) return saved;
    const nav = String((navigator.languages && navigator.languages[0]) || navigator.language || 'fr').slice(0, 2).toLowerCase();
    if (LANGS.some((l) => l.id === nav)) return nav;
    return 'en';
  }
  const lang = detect();
  document.documentElement.lang = lang;

  // maps : { en: { 'texte fr': 'text' }, es: {...}, ... }
  function add(maps) {
    for (const id of Object.keys(maps || {})) if (dict[id]) Object.assign(dict[id], maps[id]);
  }

  function tr(fr, vars) {
    if (fr == null) return fr;
    let s = String(fr);
    if (lang !== 'fr') {
      const hit = dict[lang][s];
      if (hit != null) s = hit;
    }
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m));
    return s;
  }

  // Traduit sur place des champs texte d'objets de données (cartes, lois, familles…).
  function localize(items, fields) {
    if (lang === 'fr' || !items) return;
    for (const it of Array.isArray(items) ? items : Object.values(items)) {
      if (!it || typeof it !== 'object') continue;
      for (const f of fields) if (typeof it[f] === 'string') it[f] = tr(it[f]);
    }
  }

  // Textes fixes de la page : data-t traduit le contenu (HTML compris), data-t-attr les attributs listés.
  function applyStatic(root) {
    if (lang === 'fr') return;
    for (const el of (root || document).querySelectorAll('[data-t]')) {
      if (el.__fr == null) el.__fr = el.innerHTML.trim();
      el.innerHTML = tr(el.__fr);
    }
    for (const el of (root || document).querySelectorAll('[data-t-attr]')) {
      for (const a of el.dataset.tAttr.split(/\s+/)) {
        const k = '__fr_' + a;
        if (el[k] == null) el[k] = el.getAttribute(a) || '';
        if (el[k]) el.setAttribute(a, tr(el[k]));
      }
    }
  }

  function setLang(id) {
    if (!LANGS.some((l) => l.id === id) || id === lang) return;
    try { localStorage.setItem(KEY, id); } catch (e) { /* stockage indisponible */ }
    location.reload();
  }

  window.OrbiteI18n = { LANGS, lang, add, tr, localize, applyStatic, setLang, dict };
  window.tr = tr;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyStatic());
  else applyStatic();
})();
