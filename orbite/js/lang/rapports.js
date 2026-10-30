/* ORBITE — traductions de « Signaler un bug » (v121) : le bouton « ? », la fiche du joueur et la
 * lecture des rapports par le créateur (js/rapports.js).
 * Clé : le texte français exact.
 * Chaque ligne : français, anglais, espagnol, allemand, portugais. */
(function () {
  'use strict';
  const rows = [
    // Le bouton et la fiche du joueur
    ['Signaler un bug', 'Report a bug', 'Informar de un error', 'Fehler melden', 'Relatar um bug'],
    ['SIGNALER UN BUG', 'REPORT A BUG', 'INFORMAR DE UN ERROR', 'FEHLER MELDEN', 'RELATAR UM BUG'],
    ['Votre message part directement à l’équipe d’ORBITE.', 'Your message goes straight to the ORBITE team.', 'Tu mensaje llega directamente al equipo de ORBITE.', 'Deine Nachricht geht direkt an das ORBITE-Team.', 'Sua mensagem vai direto para a equipe do ORBITE.'],
    ['Que s’est-il passé ? Que faisiez-vous ?', 'What happened? What were you doing?', '¿Qué ha pasado? ¿Qué estabas haciendo?', 'Was ist passiert? Was hast du gerade gemacht?', 'O que aconteceu? O que você estava fazendo?'],
    ['Votre message', 'Your message', 'Tu mensaje', 'Deine Nachricht', 'Sua mensagem'],
    ['AJOUTER UNE CAPTURE', 'ADD A SCREENSHOT', 'AÑADIR UNA CAPTURA', 'SCREENSHOT HINZUFÜGEN', 'ADICIONAR UMA CAPTURA'],
    ['facultatif', 'optional', 'opcional', 'optional', 'opcional'],
    ['Préparation de la capture…', 'Preparing the screenshot…', 'Preparando la captura…', 'Screenshot wird vorbereitet…', 'Preparando a captura…'],
    ['Voir la capture', 'View the screenshot', 'Ver la captura', 'Screenshot ansehen', 'Ver a captura'],
    ['RETIRER LA CAPTURE', 'REMOVE THE SCREENSHOT', 'QUITAR LA CAPTURA', 'SCREENSHOT ENTFERNEN', 'REMOVER A CAPTURA'],
    ['Image illisible : essayez une autre capture.', 'Unreadable image: try another screenshot.', 'Imagen ilegible: prueba otra captura.', 'Bild nicht lesbar: Versuch einen anderen Screenshot.', 'Imagem ilegível: tente outra captura.'],
    ['Joint automatiquement : version, écran, appareil, langue, taille d’écran, dernières erreurs, partie en cours et pseudo.', 'Attached automatically: version, screen, device, language, screen size, latest errors, current game and username.', 'Se adjunta automáticamente: versión, pantalla, dispositivo, idioma, tamaño de pantalla, últimos errores, partida en curso y apodo.', 'Automatisch angehängt: Version, Bildschirm, Gerät, Sprache, Bildschirmgröße, letzte Fehler, laufende Partie und Spielername.', 'Anexado automaticamente: versão, tela, aparelho, idioma, tamanho da tela, últimos erros, partida em andamento e apelido.'],
    ['Joint automatiquement : version, écran, appareil, langue, taille d’écran, dernières erreurs, partie en cours, pseudo et compte en ligne.', 'Attached automatically: version, screen, device, language, screen size, latest errors, current game, username and online account.', 'Se adjunta automáticamente: versión, pantalla, dispositivo, idioma, tamaño de pantalla, últimos errores, partida en curso, apodo y cuenta en línea.', 'Automatisch angehängt: Version, Bildschirm, Gerät, Sprache, Bildschirmgröße, letzte Fehler, laufende Partie, Spielername und Online-Konto.', 'Anexado automaticamente: versão, tela, aparelho, idioma, tamanho da tela, últimos erros, partida em andamento, apelido e conta online.'],
    ['Décrivez le problème en quelques mots.', 'Describe the problem in a few words.', 'Describe el problema en pocas palabras.', 'Beschreibe das Problem in ein paar Worten.', 'Descreva o problema em poucas palavras.'],
    ['Un rapport par minute : réessayez dans {n} s.', 'One report per minute: try again in {n} s.', 'Un informe por minuto: vuelve a intentarlo en {n} s.', 'Ein Bericht pro Minute: Versuch es in {n} s noch einmal.', 'Um relatório por minuto: tente de novo em {n} s.'],
    ['ENVOI…', 'SENDING…', 'ENVIANDO…', 'WIRD GESENDET…', 'ENVIANDO…'],
    // Après l'envoi
    ['MERCI !', 'THANK YOU!', '¡GRACIAS!', 'DANKE!', 'OBRIGADO!'],
    ['DÉSOLÉ', 'SORRY', 'LO SENTIMOS', 'TUT UNS LEID', 'DESCULPE'],
    ['Votre rapport est bien parti. Il aide à corriger ORBITE.', 'Your report has been sent. It helps us fix ORBITE.', 'Tu informe se ha enviado. Nos ayuda a corregir ORBITE.', 'Dein Bericht wurde gesendet. Er hilft uns, ORBITE zu verbessern.', 'Seu relatório foi enviado. Ele nos ajuda a corrigir o ORBITE.'],
    ['Pas de réseau pour l’instant : il partira dès que vous serez en ligne.', 'No connection right now: it will be sent as soon as you are online.', 'Sin conexión por ahora: se enviará en cuanto estés en línea.', 'Gerade keine Verbindung: Er wird gesendet, sobald du online bist.', 'Sem conexão no momento: ele será enviado assim que você estiver online.'],
    ['Envoi impossible pour le moment : il repartira tout seul plus tard.', 'It cannot be sent right now: it will be sent automatically later.', 'No se puede enviar por ahora: se enviará solo más tarde.', 'Senden gerade nicht möglich: Er wird später automatisch gesendet.', 'Não é possível enviar agora: ele será enviado sozinho mais tarde.'],
    ['Envoi impossible, et cet appareil n’a pas pu le garder : réessayez plus tard.', 'It could not be sent, and this device could not keep it: try again later.', 'No se pudo enviar y este dispositivo no pudo guardarlo: inténtalo más tarde.', 'Senden nicht möglich, und dieses Gerät konnte ihn nicht speichern: Versuch es später noch einmal.', 'Não foi possível enviar, e este aparelho não conseguiu guardá-lo: tente mais tarde.'],
    ['Rapport en attente envoyé. Merci !', 'Pending report sent. Thank you!', 'Informe pendiente enviado. ¡Gracias!', 'Wartender Bericht gesendet. Danke!', 'Relatório pendente enviado. Obrigado!'],
    ['{n} rapports en attente envoyés. Merci !', '{n} pending reports sent. Thank you!', '{n} informes pendientes enviados. ¡Gracias!', '{n} wartende Berichte gesendet. Danke!', '{n} relatórios pendentes enviados. Obrigado!'],
    // Le mode créateur
    ['MODE CRÉATEUR', 'CREATOR MODE', 'MODO CREADOR', 'SCHÖPFERMODUS', 'MODO CRIADOR'],
    ['Code créateur reconnu. Connectez-vous au compte en ligne : le mode créateur s’activera tout seul.', 'Creator code recognized. Sign in to your online account: creator mode will then turn on by itself.', 'Código de creador reconocido. Inicia sesión en la cuenta en línea: el modo creador se activará solo.', 'Schöpfercode erkannt. Melde dich beim Online-Konto an: Der Schöpfermodus schaltet sich dann von selbst ein.', 'Código de criador reconhecido. Entre na conta online: o modo criador será ativado sozinho.'],
    ['Mode créateur indisponible : le jeu en ligne n’est pas configuré.', 'Creator mode unavailable: online play is not set up.', 'Modo creador no disponible: el juego en línea no está configurado.', 'Schöpfermodus nicht verfügbar: Das Online-Spiel ist nicht eingerichtet.', 'Modo criador indisponível: o jogo online não está configurado.'],
    ['Connexion au compte impossible pour le moment.', 'Your account cannot be reached right now.', 'No se puede acceder a la cuenta por ahora.', 'Das Konto ist gerade nicht erreichbar.', 'Não é possível acessar a conta agora.'],
    ['Le serveur a refusé le mode créateur.', 'The server refused creator mode.', 'El servidor ha rechazado el modo creador.', 'Der Server hat den Schöpfermodus abgelehnt.', 'O servidor recusou o modo criador.'],
    ['Mode créateur activé : les rapports de bugs sont dans les Paramètres.', 'Creator mode on: bug reports are in the Settings.', 'Modo creador activado: los informes de errores están en los Ajustes.', 'Schöpfermodus aktiv: Die Fehlerberichte sind in den Einstellungen.', 'Modo criador ativado: os relatórios de bugs estão nas Configurações.'],
    // Les rapports, côté créateur
    ['RAPPORTS DE BUGS', 'BUG REPORTS', 'INFORMES DE ERRORES', 'FEHLERBERICHTE', 'RELATÓRIOS DE BUGS'],
    ['{n} à régler', '{n} to fix', '{n} por resolver', '{n} offen', '{n} a resolver'],
    ['tout est réglé', 'all fixed', 'todo resuelto', 'alles erledigt', 'tudo resolvido'],
    ['Aucun rapport pour l’instant.', 'No reports yet.', 'Aún no hay informes.', 'Noch keine Berichte.', 'Nenhum relatório por enquanto.'],
    ['Connectez-vous au compte en ligne pour lire les rapports.', 'Sign in to your online account to read the reports.', 'Inicia sesión en la cuenta en línea para leer los informes.', 'Melde dich beim Online-Konto an, um die Berichte zu lesen.', 'Entre na conta online para ler os relatórios.'],
    ['Accès refusé : ce compte n’est pas celui du créateur.', 'Access denied: this is not the creator’s account.', 'Acceso denegado: esta no es la cuenta del creador.', 'Zugriff verweigert: Das ist nicht das Konto des Schöpfers.', 'Acesso negado: esta não é a conta do criador.'],
    ['Impossible de lire les rapports pour le moment.', 'The reports cannot be read right now.', 'No se pueden leer los informes por ahora.', 'Die Berichte können gerade nicht gelesen werden.', 'Não é possível ler os relatórios agora.'],
    ['Impossible de modifier ce rapport pour le moment.', 'This report cannot be changed right now.', 'No se puede modificar este informe por ahora.', 'Dieser Bericht kann gerade nicht geändert werden.', 'Não é possível alterar este relatório agora.'],
    ['ACTUALISER', 'REFRESH', 'ACTUALIZAR', 'AKTUALISIEREN', 'ATUALIZAR'],
    ['anonyme', 'anonymous', 'anónimo', 'anonym', 'anônimo'],
    ['RÉGLÉ', 'FIXED', 'RESUELTO', 'ERLEDIGT', 'RESOLVIDO'],
    ['ROUVRIR', 'REOPEN', 'REABRIR', 'WIEDER ÖFFNEN', 'REABRIR'],
    ['COPIER POUR CLAUDE', 'COPY FOR CLAUDE', 'COPIAR PARA CLAUDE', 'FÜR CLAUDE KOPIEREN', 'COPIAR PARA O CLAUDE'],
    ['TÉLÉCHARGER LA CAPTURE', 'DOWNLOAD THE SCREENSHOT', 'DESCARGAR LA CAPTURA', 'SCREENSHOT HERUNTERLADEN', 'BAIXAR A CAPTURA'],
    ['Détails techniques', 'Technical details', 'Detalles técnicos', 'Technische Details', 'Detalhes técnicos'],
    ['Langue', 'Language', 'Idioma', 'Sprache', 'Idioma'],
    ['Taille d’écran', 'Screen size', 'Tamaño de pantalla', 'Bildschirmgröße', 'Tamanho da tela'],
    ['Appareil', 'Device', 'Dispositivo', 'Gerät', 'Aparelho'],
    ['Erreurs', 'Errors', 'Errores', 'Fehler', 'Erros'],
    ['aucune', 'none', 'ninguno', 'keine', 'nenhum'],
    ['Compte', 'Account', 'Cuenta', 'Konto', 'Conta'],
    ['Identifiant', 'ID', 'Identificador', 'Kennung', 'Identificador'],
    ['Copié : collez-le dans votre conversation avec Claude.', 'Copied: paste it into your conversation with Claude.', 'Copiado: pégalo en tu conversación con Claude.', 'Kopiert: Füge es in dein Gespräch mit Claude ein.', 'Copiado: cole na sua conversa com o Claude.'],
    ['Copie impossible sur cet appareil.', 'Copying is not possible on this device.', 'No se puede copiar en este dispositivo.', 'Kopieren ist auf diesem Gerät nicht möglich.', 'Não é possível copiar neste aparelho.']
  ];
  const langs = ['en', 'es', 'de', 'pt'];
  window.OrbiteI18n.add(Object.fromEntries(langs.map((l, i) => [l, Object.fromEntries(rows.map((r) => [r[0], r[i + 1]]))])));
})();
