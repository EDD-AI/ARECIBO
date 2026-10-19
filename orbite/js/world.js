/* ORBITE — votre planète : un monde mort à faire renaître avec les poussières d'étoiles.
   Chaque amélioration demande un niveau de créateur et se paie au Marché stellaire.
   Les effets s'additionnent en canaux (0 à 1) que le moteur traduit en apparence. */
(function (root) {
  'use strict';

  const STAGES = [
    { id: 'reveil', name: 'Réveil', text: 'Rallumer le cœur de la planète.' },
    { id: 'eau', name: 'Eau', text: 'Apporter l’eau, le ciel et les saisons.' },
    { id: 'vie', name: 'Vie', text: 'Faire naître la vie, des algues aux forêts.' },
    { id: 'civil', name: 'Civilisation verte', text: 'Bâtir une civilisation propre, solaire et durable.' }
  ];

  const UPGRADES = [
    { id: 'coeur', stage: 0, lvl: 1, price: 30, name: 'Cœur rallumé', text: 'Le noyau se remet à chauffer : des lueurs de lave percent la face de nuit.', fx: { heat: 0.5 } },
    { id: 'volcans', stage: 0, lvl: 3, price: 50, name: 'Volcans', text: 'La croûte se fend et rougit, les volcans se réveillent.', fx: { heat: 0.5 } },
    { id: 'atmo', stage: 0, lvl: 6, price: 80, name: 'Atmosphère primitive', text: 'Un voile de gaz volcaniques entoure la planète.', fx: { air: 0.35 } },
    { id: 'cometes', stage: 1, lvl: 9, price: 110, name: 'Pluie de comètes', text: 'Des comètes de glace apportent l’eau : premiers lacs, premiers givres aux pôles.', fx: { water: 0.2, ice: 0.4 } },
    { id: 'pluies', stage: 1, lvl: 12, price: 140, name: 'Premières pluies', text: 'Les nuages se forment et la pluie refroidit la roche.', fx: { clouds: 0.35, water: 0.1 } },
    { id: 'mers', stage: 1, lvl: 16, price: 170, name: 'Mers', text: 'Les bassins se remplissent.', fx: { water: 0.3 } },
    { id: 'calottes', stage: 1, lvl: 20, price: 200, name: 'Calottes polaires', text: 'La glace s’installe aux pôles et sur les sommets.', fx: { ice: 0.6 } },
    { id: 'oceans', stage: 1, lvl: 25, price: 240, name: 'Océans', text: 'Les mers se rejoignent : la planète devient bleue.', fx: { water: 0.4 } },
    { id: 'cycle', stage: 1, lvl: 30, price: 270, name: 'Cycle de l’eau', text: 'Évaporation, nuages, pluies : le ciel s’anime.', fx: { clouds: 0.4 } },
    { id: 'ciel', stage: 1, lvl: 35, price: 300, name: 'Ciel bleu', text: 'L’air s’éclaircit et se teinte de bleu.', fx: { air: 0.65 } },
    { id: 'algues', stage: 2, lvl: 40, price: 330, name: 'Algues', text: 'La vie apparaît dans les eaux tièdes des côtes.', fx: { life: 0.1 } },
    { id: 'mousses', stage: 2, lvl: 46, price: 360, name: 'Mousses et lichens', text: 'Un premier vert gagne la roche nue.', fx: { life: 0.15 } },
    { id: 'forets', stage: 2, lvl: 53, price: 400, name: 'Forêts', text: 'Les continents se couvrent d’arbres.', fx: { life: 0.3 } },
    { id: 'prairies', stage: 2, lvl: 60, price: 440, name: 'Prairies', text: 'Les plaines fleurissent entre les forêts.', fx: { life: 0.2 } },
    { id: 'faune', stage: 2, lvl: 67, price: 480, name: 'Faune', text: 'Troupeaux, oiseaux, récifs : la planète respire.', fx: { life: 0.25, clouds: 0.25 } },
    { id: 'lune', stage: 2, lvl: 74, price: 520, name: 'Lune capturée', text: 'Une lune vient stabiliser les saisons et rythmer les marées.', fx: { moon: 1 } },
    { id: 'villages', stage: 3, lvl: 80, price: 560, name: 'Villages à éoliennes', text: 'Les premiers villages s’éclairent, alimentés par le vent.', fx: { cities: 0.1 } },
    { id: 'solaire', stage: 3, lvl: 86, price: 600, name: 'Fermes solaires', text: 'Des champs de panneaux captent la lumière de l’étoile.', fx: { cities: 0.15 } },
    { id: 'usines', stage: 3, lvl: 92, price: 650, name: 'Usines écologiques', text: 'Une industrie propre, sans fumée, qui recycle tout.', fx: { cities: 0.25 } },
    { id: 'satellites', stage: 3, lvl: 98, price: 700, name: 'Satellites solaires', text: 'Des centrales en orbite renvoient l’énergie vers le sol.', fx: { sats: 2 } },
    { id: 'villes', stage: 3, lvl: 104, price: 760, name: 'Villes lumière', text: 'De grandes villes vertes brillent sur la face de nuit.', fx: { cities: 0.5 } },
    { id: 'station', stage: 3, lvl: 110, price: 820, name: 'Station orbitale', text: 'Un port spatial pour voyager entre les mondes.', fx: { sats: 2 } },
    { id: 'anneau', stage: 3, lvl: 115, price: 900, name: 'Anneau solaire', text: 'Un anneau de panneaux entoure la planète.', fx: { ring: 1 } },
    { id: 'terre', stage: 3, lvl: 120, price: 1000, name: 'Terre nouvelle', text: 'Votre monde est pleinement vivant. Des comètes saluent sa renaissance.', fx: { halo: 1 } }
  ];
  const BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

  // Les améliorations s'achètent dans l'ordre : chacune ouvre la suivante.
  function owned(list) { return UPGRADES.filter((u) => list.includes(u.id)); }
  function next(list) { return UPGRADES.find((u) => !list.includes(u.id)) || null; }

  function channels(list) {
    const c = { heat: 0, air: 0, water: 0, ice: 0, clouds: 0, life: 0, cities: 0, moon: 0, sats: 0, ring: 0, halo: 0 };
    for (const u of owned(list)) for (const [k, v] of Object.entries(u.fx)) c[k] += v;
    for (const k of ['heat', 'air', 'water', 'ice', 'clouds', 'life', 'cities']) c[k] = Math.min(1, c[k]);
    return c;
  }

  function stageName(list) {
    const o = owned(list);
    if (!o.length) return 'Planète morte';
    if (o.length === UPGRADES.length) return 'Terre nouvelle';
    return STAGES[o[o.length - 1].stage].name;
  }

  root.OrbiteWorld = { STAGES, UPGRADES, BY_ID, owned, next, channels, stageName };
})(typeof window !== 'undefined' ? window : globalThis);
