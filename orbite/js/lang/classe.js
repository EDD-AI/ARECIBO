/* ORBITE — traductions du classé (v129) : TROUVER UNE PARTIE, l'écran de recherche, le classé entre
 * amis et les emblèmes de rang. Clé : le texte français exact.
 * Chaque ligne : français, anglais, espagnol, allemand, portugais. */
(function () {
  'use strict';
  const rows = [
    // Multijoueur : TROUVER UNE PARTIE
    ['VOTRE RANG', 'YOUR RANK', 'TU RANGO', 'DEIN RANG', 'SEU RANQUE'],
    ['Votre rang après {n} parties classées.', 'Your rank after {n} ranked games.', 'Tu rango tras {n} partidas clasificatorias.', 'Dein Rang nach {n} Ranglistenspielen.', 'Seu ranque após {n} partidas ranqueadas.'],
    ['Mode de jeu', 'Game mode', 'Modo de juego', 'Spielmodus', 'Modo de jogo'],
    ['1 CONTRE 1', '1 VS 1', '1 CONTRA 1', '1 GEGEN 1', '1 CONTRA 1'],
    ['MÊLÉE', 'MELEE', 'BATALLA', 'GEFECHT', 'BATALHA'],
    ['À 8 JOUEURS', '8 PLAYERS', '8 JUGADORES', '8 SPIELER', '8 JOGADORES'],
    ['TROUVER UNE PARTIE', 'FIND A GAME', 'BUSCAR PARTIDA', 'PARTIE FINDEN', 'ENCONTRAR PARTIDA'],
    ['DUEL CLASSÉ', 'RANKED DUEL', 'DUELO CLASIFICATORIO', 'RANGLISTEN-DUELL', 'DUELO RANQUEADO'],
    ['MÊLÉE CLASSÉE', 'RANKED MELEE', 'BATALLA CLASIFICATORIA', 'RANGLISTEN-GEFECHT', 'BATALHA RANQUEADA'],
    ['Face à des créateurs de votre rang. Personne au bout de 40 s ? Des univers rivaux complètent la table.', 'Against creators of your rank. Nobody after 40 s? Rival universes fill the table.', 'Contra creadores de tu rango. ¿Nadie tras 40 s? Universos rivales completan la mesa.', 'Gegen Schöpfer deines Rangs. Nach 40 s niemand da? Rivalisierende Universen füllen den Tisch.', 'Contra criadores do seu ranque. Ninguém após 40 s? Universos rivais completam a mesa.'],
    ['Classé aussi entre amis, dès 2 joueurs humains. Seul face aux bots, la partie ne compte pas.', 'Ranked with friends too, from 2 human players. Alone against bots, the game doesn’t count.', 'También clasificatoria entre amigos, desde 2 jugadores humanos. Solo contra bots, la partida no cuenta.', 'Auch unter Freunden gewertet, ab 2 menschlichen Spielern. Allein gegen Bots zählt die Partie nicht.', 'Ranqueada também entre amigos, a partir de 2 jogadores humanos. Sozinho contra bots, a partida não conta.'],
    ['Code de sa partie', 'Their game code', 'Código de su partida', 'Code seiner Partie', 'Código da partida dele'],
    // L'écran de recherche
    ['RECHERCHE…', 'SEARCHING…', 'BUSCANDO…', 'SUCHE…', 'PROCURANDO…'],
    ['JOUEURS TROUVÉS', 'PLAYERS FOUND', 'JUGADORES ENCONTRADOS', 'SPIELER GEFUNDEN', 'JOGADORES ENCONTRADOS'],
    ['Table complète : la partie commence…', 'Table full: the game is starting…', 'Mesa completa: la partida comienza…', 'Tisch voll: Die Partie beginnt…', 'Mesa completa: a partida vai começar…'],
    ['Personne dans {n} s ? Un univers rival prend la place.', 'Nobody in {n} s? A rival universe takes the seat.', '¿Nadie en {n} s? Un universo rival ocupa el lugar.', 'In {n} s niemand da? Ein rivalisierendes Universum übernimmt den Platz.', 'Ninguém em {n} s? Um universo rival assume o lugar.'],
    ['Places libres dans {n} s ? Des univers rivaux complètent la table.', 'Seats still free in {n} s? Rival universes fill the table.', '¿Plazas libres en {n} s? Universos rivales completan la mesa.', 'In {n} s noch Plätze frei? Rivalisierende Universen füllen den Tisch.', 'Lugares livres em {n} s? Universos rivais completam a mesa.'],
    ['Rang recherché : {a}', 'Rank searched: {a}', 'Rango buscado: {a}', 'Gesuchter Rang: {a}', 'Ranque procurado: {a}'],
    ['Rangs recherchés : {a} – {b}', 'Ranks searched: {a} – {b}', 'Rangos buscados: {a} – {b}', 'Gesuchte Ränge: {a} – {b}', 'Ranques procurados: {a} – {b}'],
    // Classé entre amis
    ['PAS ENCORE CLASSÉE', 'NOT RANKED YET', 'AÚN NO CLASIFICATORIA', 'NOCH NICHT GEWERTET', 'AINDA NÃO RANQUEADA'],
    ['Elle compte pour le classement de chaque joueur : points gagnés ou perdus selon la place.', 'It counts for every player’s rank: points won or lost depending on placement.', 'Cuenta para la clasificación de cada jugador: puntos ganados o perdidos según el puesto.', 'Sie zählt für die Wertung jedes Spielers: Punkte gewonnen oder verloren je nach Platz.', 'Conta para o ranking de cada jogador: pontos ganhos ou perdidos conforme a posição.'],
    ['Il faut au moins 2 joueurs humains : les bots ne comptent pas.', 'At least 2 human players are needed: bots don’t count.', 'Hacen falta al menos 2 jugadores humanos: los bots no cuentan.', 'Es braucht mindestens 2 menschliche Spieler: Bots zählen nicht.', 'São necessários pelo menos 2 jogadores humanos: bots não contam.'],
    ['Partie entre amis non classée : il faut au moins 2 joueurs humains.', 'Unranked friends game: at least 2 human players are needed.', 'Partida entre amigos sin clasificar: hacen falta al menos 2 jugadores humanos.', 'Freundespartie ohne Wertung: Es braucht mindestens 2 menschliche Spieler.', 'Partida entre amigos sem ranking: são necessários pelo menos 2 jogadores humanos.'],
    ['Les parties en ligne comptent : la recherche classée, et les parties entre amis à 2 joueurs humains ou plus. Après {n} parties de placement, votre rang monte à chaque podium et descend dans les dernières places.', 'Online games count: ranked search, and friends games with 2 or more human players. After {n} placement games, your rank goes up with every podium and down in the last places.', 'Cuentan las partidas en línea: la búsqueda clasificatoria y las partidas entre amigos con 2 jugadores humanos o más. Tras {n} partidas de colocación, tu rango sube con cada podio y baja en los últimos puestos.', 'Online-Partien zählen: die Ranglistensuche und Freundespartien mit 2 oder mehr menschlichen Spielern. Nach {n} Einstufungspartien steigt dein Rang mit jedem Podestplatz und sinkt auf den letzten Plätzen.', 'As partidas online contam: a busca ranqueada e as partidas entre amigos com 2 ou mais jogadores humanos. Após {n} partidas de colocação, seu ranque sobe a cada pódio e desce nas últimas posições.'],
    // Emblèmes et fin de partie
    ['placement', 'placement', 'colocación', 'Einstufung', 'colocação'],
    ['Placement {a} / {b}', 'Placement {a} / {b}', 'Colocación {a} / {b}', 'Einstufung {a} / {b}', 'Colocação {a} / {b}'],
    ['PLACEMENT {a} / {b}', 'PLACEMENT {a} / {b}', 'COLOCACIÓN {a} / {b}', 'EINSTUFUNG {a} / {b}', 'COLOCAÇÃO {a} / {b}'],
    ['CLASSÉ ENTRE AMIS', 'RANKED WITH FRIENDS', 'CLASIFICATORIA ENTRE AMIGOS', 'GEWERTET UNTER FREUNDEN', 'RANQUEADA ENTRE AMIGOS'],
    ['Encore {n} parties pour obtenir votre rang.', '{n} more games to earn your rank.', 'Faltan {n} partidas para obtener tu rango.', 'Noch {n} Partien bis zu deinem Rang.', 'Faltam {n} partidas para obter seu ranque.'],
    ['Encore 1 partie pour obtenir votre rang.', '1 more game to earn your rank.', 'Falta 1 partida para obtener tu rango.', 'Noch 1 Partie bis zu deinem Rang.', 'Falta 1 partida para obter seu ranque.'],
    ['PLACÉ EN {rank}', 'PLACED IN {rank}', 'COLOCADO EN {rank}', 'EINGESTUFT: {rank}', 'COLOCADO EM {rank}'],
    ['Votre rang se dévoile…', 'Your rank is being revealed…', 'Tu rango se revela…', 'Dein Rang wird enthüllt…', 'Seu ranque está sendo revelado…'],
    ['RANG OBTENU !', 'RANK EARNED!', '¡RANGO OBTENIDO!', 'RANG ERREICHT!', 'RANQUE OBTIDO!'],
    ['DIVISION SUPÉRIEURE !', 'DIVISION UP!', '¡SUBES DE DIVISIÓN!', 'DIVISION AUFGESTIEGEN!', 'SUBIU DE DIVISÃO!'],
    ['division inférieure', 'division down', 'bajas de división', 'Division abgestiegen', 'caiu de divisão']
  ];
  const langs = ['en', 'es', 'de', 'pt'];
  window.OrbiteI18n.add(Object.fromEntries(langs.map((l, i) => [l, Object.fromEntries(rows.map((r) => [r[0], r[i + 1]]))])));
})();
