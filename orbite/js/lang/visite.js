/* ORBITE — traductions de la visite de votre planète (v124) : l'amélioration du Marché, l'écran du
 * globe (tourner, zoomer, atterrir), les colonies de votre planète et leur cinématique.
 * Clé : le texte français exact.
 * Chaque ligne : français, anglais, espagnol, allemand, portugais. */
(function () {
  'use strict';
  const rows = [
    // Marché : Ma planète
    ['Visiter la planète', 'Visit the planet', 'Visitar el planeta', 'Planeten besuchen', 'Visitar o planeta'],
    ['Posez le pied sur votre planète : faites-la tourner, approchez-vous et bâtissez.', 'Set foot on your planet: spin it, zoom in and build.', 'Pisa tu planeta: hazlo girar, acércate y construye.', 'Betritt deinen Planeten: Dreh ihn, komm näher und baue.', 'Pise no seu planeta: gire-o, aproxime-se e construa.'],
    ['VISITER', 'VISIT', 'VISITAR', 'BESUCHEN', 'VISITAR'],
    // Écran du globe
    ['Ma planète', 'My planet', 'Mi planeta', 'Mein Planet', 'Meu planeta'],
    ['{n} / {max} colonies', '{n} / {max} colonies', '{n} / {max} colonias', '{n} / {max} Kolonien', '{n} / {max} colônias'],
    ['ATTERRIR ICI', 'LAND HERE', 'ATERRIZAR AQUÍ', 'HIER LANDEN', 'POUSAR AQUI'],
    ['S’APPROCHER', 'ZOOM IN', 'ACERCARSE', 'NÄHER RAN', 'APROXIMAR'],
    ['Atterrir à {nom}', 'Land at {nom}', 'Aterrizar en {nom}', 'In {nom} landen', 'Pousar em {nom}'],
    ['Glissez pour faire tourner · molette pour zoomer', 'Drag to spin · scroll to zoom', 'Arrastra para girar · rueda para hacer zoom', 'Ziehen zum Drehen · Mausrad zum Zoomen', 'Arraste para girar · roda para dar zoom'],
    ['Glissez pour faire tourner · pincez pour zoomer', 'Drag to spin · pinch to zoom', 'Arrastra para girar · pellizca para hacer zoom', 'Ziehen zum Drehen · mit zwei Fingern zoomen', 'Arraste para girar · pince para dar zoom'],
    ['Touchez une balise pour retourner dans une colonie.', 'Tap a beacon to return to a colony.', 'Toca una baliza para volver a una colonia.', 'Tippe auf ein Leuchtfeuer, um zu einer Kolonie zurückzukehren.', 'Toque num sinalizador para voltar a uma colônia.'],
    ['Approchez-vous d’une terre pour y fonder une colonie.', 'Get closer to land to found a colony there.', 'Acércate a tierra firme para fundar una colonia.', 'Komm näher an Land heran, um dort eine Kolonie zu gründen.', 'Aproxime-se de uma terra para fundar uma colônia.'],
    ['{sol} : vous pouvez fonder une colonie ici.', '{sol}: you can found a colony here.', '{sol}: puedes fundar una colonia aquí.', '{sol}: Hier kannst du eine Kolonie gründen.', '{sol}: você pode fundar uma colônia aqui.'],
    ['Trois colonies au plus sur votre planète : touchez une balise pour y retourner.', 'Three colonies at most on your planet: tap a beacon to go back to one.', 'Tres colonias como máximo en tu planeta: toca una baliza para volver a ella.', 'Höchstens drei Kolonien auf deinem Planeten: Tippe auf ein Leuchtfeuer, um zu einer zurückzukehren.', 'No máximo três colônias no seu planeta: toque num sinalizador para voltar a uma delas.'],
    ['Impossible de se poser sur l’océan.', 'You can’t land on the ocean.', 'No se puede aterrizar en el océano.', 'Auf dem Ozean kann man nicht landen.', 'Não é possível pousar no oceano.'],
    ['Votre colonie {nom} : ATTERRIR ICI pour y retourner.', 'Your colony {nom}: LAND HERE to go back to it.', 'Tu colonia {nom}: ATERRIZAR AQUÍ para volver a ella.', 'Deine Kolonie {nom}: HIER LANDEN, um zurückzukehren.', 'Sua colônia {nom}: POUSAR AQUI para voltar a ela.'],
    ['Trop près de {nom} : éloignez-vous un peu.', 'Too close to {nom}: move a little further away.', 'Demasiado cerca de {nom}: aléjate un poco.', 'Zu nah an {nom}: Entferne dich ein wenig.', 'Perto demais de {nom}: afaste-se um pouco.'],
    // Le sol sous le réticule
    ['Océan', 'Ocean', 'Océano', 'Ozean', 'Oceano'],
    ['Sable', 'Sand', 'Arena', 'Sand', 'Areia'],
    ['Prairie', 'Grassland', 'Pradera', 'Wiese', 'Pradaria'],
    ['Forêt', 'Forest', 'Bosque', 'Wald', 'Floresta'],
    ['Montagne', 'Mountain', 'Montaña', 'Gebirge', 'Montanha'],
    ['Glace', 'Ice', 'Hielo', 'Eis', 'Gelo'],
    // Noms des colonies
    ['Aube', 'Dawn', 'Alba', 'Morgenrot', 'Alvorada'],
    ['Havre', 'Haven', 'Refugio', 'Hafen', 'Refúgio'],
    ['Clairière', 'Glade', 'Claro', 'Lichtung', 'Clareira'],
    ['Rivage', 'Shore', 'Ribera', 'Ufer', 'Margem'],
    ['Zénith', 'Zenith', 'Cénit', 'Zenit', 'Zênite'],
    ['Alizé', 'Tradewind', 'Alisio', 'Passat', 'Alísio'],
    // Tutoriel
    ['Glissez pour faire <b>tourner</b> votre planète dans tous les sens, jusqu’aux pôles.', 'Drag to <b>spin</b> your planet in every direction, all the way to the poles.', 'Arrastra para hacer <b>girar</b> tu planeta en todas direcciones, hasta los polos.', 'Ziehe, um deinen Planeten in alle Richtungen zu <b>drehen</b>, bis zu den Polen.', 'Arraste para <b>girar</b> o seu planeta em todas as direções, até os polos.'],
    ['La <b>molette</b>, ou + et −, vous approche de la surface. Un double clic ramène à la vue d’ensemble.', 'The <b>mouse wheel</b>, or + and −, brings you closer to the surface. Double-click to return to the full view.', 'La <b>rueda</b>, o + y −, te acerca a la superficie. Un doble clic vuelve a la vista general.', 'Das <b>Mausrad</b> oder + und − bringt dich näher an die Oberfläche. Ein Doppelklick führt zurück zur Gesamtansicht.', 'A <b>roda do mouse</b>, ou + e −, aproxima você da superfície. Um clique duplo volta à visão geral.'],
    ['<b>Pincez</b>, ou touchez + et −, pour vous approcher de la surface. Touchez deux fois pour revenir à la vue d’ensemble.', '<b>Pinch</b>, or tap + and −, to get closer to the surface. Tap twice to return to the full view.', '<b>Pellizca</b>, o toca + y −, para acercarte a la superficie. Toca dos veces para volver a la vista general.', '<b>Spreize zwei Finger</b> oder tippe auf + und −, um näher an die Oberfläche zu kommen. Tippe zweimal, um zur Gesamtansicht zurückzukehren.', '<b>Pince</b>, ou toque em + e −, para se aproximar da superfície. Toque duas vezes para voltar à visão geral.'],
    ['Assez près, un réticule montre le sol. Sur la terre ferme, <b>ATTERRIR ICI</b> fonde une colonie, trois au plus. Pas sur l’océan !', 'Close enough, a reticle shows the ground. On solid land, <b>LAND HERE</b> founds a colony, three at most. Not on the ocean!', 'Lo bastante cerca, una retícula muestra el suelo. En tierra firme, <b>ATERRIZAR AQUÍ</b> funda una colonia, tres como máximo. ¡En el océano no!', 'Nah genug zeigt ein Fadenkreuz den Boden. Auf festem Land gründet <b>HIER LANDEN</b> eine Kolonie, höchstens drei. Nicht auf dem Ozean!', 'Perto o bastante, uma mira mostra o solo. Em terra firme, <b>POUSAR AQUI</b> funda uma colônia, no máximo três. No oceano, não!'],
    // Fonder une colonie
    ['NOUVELLE COLONIE', 'NEW COLONY', 'NUEVA COLONIA', 'NEUE KOLONIE', 'NOVA COLÔNIA'],
    ['Sol : {sol}. Un colonisateur s’y posera avec quatre colons, des réserves et des matériaux.', 'Ground: {sol}. A colonizer will land there with four colonists, supplies and materials.', 'Suelo: {sol}. Un colonizador aterrizará allí con cuatro colonos, reservas y materiales.', 'Boden: {sol}. Ein Kolonisator landet dort mit vier Siedlern, Vorräten und Material.', 'Solo: {sol}. Um colonizador vai pousar ali com quatro colonos, suprimentos e materiais.'],
    ['Colonie {n} sur {max} de votre planète.', 'Colony {n} of {max} on your planet.', 'Colonia {n} de {max} de tu planeta.', 'Kolonie {n} von {max} auf deinem Planeten.', 'Colônia {n} de {max} do seu planeta.'],
    ['FONDER LA COLONIE', 'FOUND THE COLONY', 'FUNDAR LA COLONIA', 'KOLONIE GRÜNDEN', 'FUNDAR A COLÔNIA'],
    // Cinématique de l'atterrissage
    ['Vos premiers colons se posent sur votre planète.', 'Your first colonists are landing on your planet.', 'Tus primeros colonos aterrizan en tu planeta.', 'Deine ersten Siedler landen auf deinem Planeten.', 'Seus primeiros colonos estão pousando no seu planeta.'],
    ['De nouveaux colons se posent sur votre planète, à {nom}.', 'New colonists are landing on your planet, at {nom}.', 'Nuevos colonos aterrizan en tu planeta, en {nom}.', 'Neue Siedler landen auf deinem Planeten, in {nom}.', 'Novos colonos estão pousando no seu planeta, em {nom}.']
  ];
  const langs = ['en', 'es', 'de', 'pt'];
  window.OrbiteI18n.add(Object.fromEntries(langs.map((l, i) => [l, Object.fromEntries(rows.map((r) => [r[0], r[i + 1]]))])));
})();
