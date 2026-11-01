/* ORBITE — traductions de la reprise d'une partie en ligne (v134) : quitter sans abandonner,
 * REJOINDRE LA PARTIE, rattrapage des cycles joués pendant l'absence.
 * Clé : le texte français exact. Chaque ligne : français, anglais, espagnol, allemand, portugais. */
(function () {
  'use strict';
  const rows = [
    ['MENU PRINCIPAL (PARTIE EN COURS)', 'MAIN MENU (GAME IN PROGRESS)', 'MENÚ PRINCIPAL (PARTIDA EN CURSO)', 'HAUPTMENÜ (PARTIE LÄUFT)', 'MENU PRINCIPAL (PARTIDA EM ANDAMENTO)'],
    ['QUITTER LA PARTIE ?', 'LEAVE THE GAME?', '¿SALIR DE LA PARTIDA?', 'PARTIE VERLASSEN?', 'SAIR DA PARTIDA?'],
    ['Votre univers continue de se battre sans vous, avec votre dernier système. Revenez quand vous voulez : REJOINDRE LA PARTIE, au menu principal.', 'Your universe keeps fighting without you, with your last system. Come back whenever you like: REJOIN GAME, on the main menu.', 'Tu universo sigue luchando sin ti, con tu último sistema. Vuelve cuando quieras: VOLVER A LA PARTIDA, en el menú principal.', 'Dein Universum kämpft ohne dich weiter, mit deinem letzten System. Komm zurück, wann du willst: ZURÜCK ZUR PARTIE, im Hauptmenü.', 'Seu universo continua lutando sem você, com seu último sistema. Volte quando quiser: VOLTAR À PARTIDA, no menu principal.'],
    ['RESTER', 'STAY', 'QUEDARSE', 'BLEIBEN', 'FICAR'],
    ['ABANDONNER ?', 'FORFEIT?', '¿ABANDONAR?', 'AUFGEBEN?', 'ABANDONAR?'],
    ['Vous prenez la dernière place encore en jeu, sans récompense, et ne pourrez plus revenir dans cette partie.', 'You take the last place still in play, with no reward, and can no longer come back to this game.', 'Te quedas con el último puesto aún en juego, sin recompensa, y ya no podrás volver a esta partida.', 'Du bekommst den letzten noch offenen Platz, ohne Belohnung, und kannst nicht mehr in diese Partie zurück.', 'Você fica com o último lugar ainda em jogo, sem recompensa, e não poderá mais voltar a esta partida.'],
    ['ABANDONNER', 'FORFEIT', 'ABANDONAR', 'AUFGEBEN', 'ABANDONAR'],
    ['Duel en ligne', 'Online duel', 'Duelo en línea', 'Online-Duell', 'Duelo online'],
    ['Mêlée en ligne', 'Online melee', 'Batalla en línea', 'Online-Gefecht', 'Batalha online'],
    ['{mode} · cycle {c} · {hp} PV', '{mode} · cycle {c} · {hp} HP', '{mode} · ciclo {c} · {hp} PV', '{mode} · Zyklus {c} · {hp} LP', '{mode} · ciclo {c} · {hp} PV'],
    ['REJOINDRE LA PARTIE', 'REJOIN GAME', 'VOLVER A LA PARTIDA', 'ZURÜCK ZUR PARTIE', 'VOLTAR À PARTIDA'],
    ['PARTIE EN COURS', 'GAME IN PROGRESS', 'PARTIDA EN CURSO', 'LAUFENDE PARTIE', 'PARTIDA EM ANDAMENTO'],
    ['PARTIE EN LIGNE EN COURS', 'ONLINE GAME IN PROGRESS', 'PARTIDA EN LÍNEA EN CURSO', 'LAUFENDE ONLINE-PARTIE', 'PARTIDA ONLINE EM ANDAMENTO'],
    ['Votre univers se bat toujours', 'Your universe is still fighting', 'Tu universo sigue luchando', 'Dein Universum kämpft noch', 'Seu universo ainda está lutando'],
    ['Pendant votre absence, il combat avec votre dernier système. Revenez avant qu’il ne tombe !', 'While you are away, it fights with your last system. Come back before it falls!', 'Mientras no estás, lucha con tu último sistema. ¡Vuelve antes de que caiga!', 'Während du weg bist, kämpft es mit deinem letzten System. Komm zurück, bevor es fällt!', 'Enquanto você está fora, ele luta com seu último sistema. Volte antes que ele caia!'],
    ['PLUS TARD', 'LATER', 'MÁS TARDE', 'SPÄTER', 'MAIS TARDE'],
    ['Abandonner la partie', 'Forfeit the game', 'Abandonar la partida', 'Partie aufgeben', 'Abandonar a partida'],
    ['RECONNEXION…', 'RECONNECTING…', 'RECONECTANDO…', 'VERBINDE NEU…', 'RECONECTANDO…'],
    ['Retour dans votre partie en ligne.', 'Back to your online game.', 'Volviendo a tu partida en línea.', 'Zurück in deine Online-Partie.', 'Voltando à sua partida online.'],
    ['Connectez-vous avec Google (Multijoueur) pour rejoindre la partie.', 'Sign in with Google (Multiplayer) to rejoin the game.', 'Inicia sesión con Google (Multijugador) para volver a la partida.', 'Melde dich mit Google an (Mehrspieler), um zur Partie zurückzukehren.', 'Entre com o Google (Multijogador) para voltar à partida.'],
    ['Cette partie a été lancée avec un autre compte Google.', 'This game was started with another Google account.', 'Esta partida se inició con otra cuenta de Google.', 'Diese Partie wurde mit einem anderen Google-Konto gestartet.', 'Esta partida foi iniciada com outra conta do Google.'],
    ['DE RETOUR', 'BACK IN THE GAME', 'DE VUELTA', 'ZURÜCK', 'DE VOLTA'],
    ['{n} cycle(s) joué(s) sans vous · cycle {c}', '{n} cycle(s) played without you · cycle {c}', '{n} ciclo(s) jugado(s) sin ti · ciclo {c}', '{n} Zyklus/Zyklen ohne dich gespielt · Zyklus {c}', '{n} ciclo(s) jogado(s) sem você · ciclo {c}'],
    ['Cycle {c} : la partie continue.', 'Cycle {c}: the game goes on.', 'Ciclo {c}: la partida continúa.', 'Zyklus {c}: Die Partie geht weiter.', 'Ciclo {c}: a partida continua.'],
    ['Connexion impossible : réessayez dans un instant.', 'Cannot connect: try again in a moment.', 'No se puede conectar: inténtalo de nuevo en un momento.', 'Keine Verbindung: Versuche es gleich noch einmal.', 'Não foi possível conectar: tente de novo em instantes.'],
    ['UN INSTANT…', 'ONE MOMENT…', 'UN MOMENTO…', 'EINEN MOMENT…', 'UM INSTANTE…']
  ];
  const langs = ['en', 'es', 'de', 'pt'];
  window.OrbiteI18n.add(Object.fromEntries(langs.map((l, i) => [l, Object.fromEntries(rows.map((r) => [r[0], r[i + 1]]))])));
})();
