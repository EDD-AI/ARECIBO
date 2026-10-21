/* ORBITE — plateau commun : préparation, achats et ordres simultanés. */
(function () {
  'use strict';
  const P = window.OrbitePlateau;
  const tr = window.tr || ((text, vars) => String(text).replace(/\{(\w+)\}/g, (_, key) => vars && vars[key] != null ? vars[key] : `{${key}}`));
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SAVE_KEY = 'orbite.plateau.v1';
  const OWNER_COLORS = ['#ecc579', '#74bfe5', '#c28de0', '#88c89d', '#e89880', '#93a4e9'];
  const ROLE_SYMBOLS = { sentinelle: '⬡', frappeur: '▲', artilleur: '✣' };
  const ui = { state: null, activePlayerId: null, selected: null, mode: 'move', privacy: false, resolving: false, zoom: 1, lastEvents: [], lastRound: null, saveAvailable: false, saveInvalid: false, guideDismissed: false, guide: {}, playback: null };
  let toastTimer, botTimer, playbackTimer, playbackToken = 0, storageWarned = false;
  if (!P) { $('setup-screen').hidden = true; $('load-error').hidden = false; return; }
  const families = Object.fromEntries(P.FAMILIES.map(family => [family.id, family]));
  const roleNames = { sentinelle: 'Sentinelle', frappeur: 'Frappeur', artilleur: 'Artilleur' };
  const familyNames = { vie: 'Vie', neant: 'Néant', envers: 'Envers', brasier: 'Brasier', glace: 'Glace', tempete: 'Tempête', mineral: 'Minéral', machine: 'Machine', lune: 'Lunes', comete: 'Comètes', cristal: 'Cristal', anomalie: 'Anomalies' };
  const familyDescriptions = Object.fromEntries(P.FAMILIES.map(family => [family.id, family.description]));

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4200);
  }
  function familyLabel(id) { return tr(familyNames[id] || families[id]?.name || id); }
  function roleLabel(id) { return tr(roleNames[id] || id); }
  function cardOf(unit) { return P.CARDS[unit.cardId]; }
  function unitLabel(unit) { const card = cardOf(unit); return `${roleLabel(card.role)} · ${familyLabel(card.family)}${unit.golden ? ' ★' : ''}`; }
  function colorOfUnit(unit) { return families[cardOf(unit).family]?.color || '#91a9bd'; }
  function playerOf(id) { return ui.state?.players.find(player => player.id === id); }
  function ownerColor(id) { const index = ui.state ? ui.state.players.findIndex(player => player.id === id) : 0; return OWNER_COLORS[Math.max(0, index) % OWNER_COLORS.length]; }
  function alive(player) { return player.hp > 0 && player.alive !== false; }
  function activePlayer() { return playerOf(ui.activePlayerId); }
  function editable() { const player = activePlayer(); return !!player && player.kind === 'human' && alive(player) && !player.locked && ui.state.phase === 'planning' && !ui.resolving && !ui.privacy; }
  function selectedUnit() { return ui.state?.units.find(unit => unit.id === ui.selected); }
  function key(node) { return `${node.ring}:${node.sector}`; }
  function sameNode(a, b) { return !!a && !!b && a.ring === b.ring && a.sector === b.sector; }
  function freshSeed() {
    const bytes = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else bytes[0] = Date.now() >>> 0;
    return `orbite-${bytes[0].toString(36)}`;
  }

  function save() {
    if (!ui.state) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ uiVersion: 1, game: P.serialize(ui.state), activePlayerId: ui.activePlayerId, privacy: ui.privacy, lastEvents: ui.lastEvents, lastRound: ui.lastRound, guideDismissed: ui.guideDismissed, guide: ui.guide }));
      ui.saveAvailable = true;
      ui.saveInvalid = false;
    } catch (error) {
      if (!storageWarned) { storageWarned = true; toast(tr('La sauvegarde locale est indisponible dans ce navigateur.')); }
    }
  }
  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      ui.saveAvailable = true;
      const saved = JSON.parse(raw);
      if (saved.uiVersion !== 1 || typeof saved.game !== 'string') throw new Error('Incompatible save');
      const state = P.restore(saved.game);
      if (!state || !Array.isArray(state.players)) throw new Error('Invalid save');
      ui.state = state;
      ui.activePlayerId = state.players.some(player => player.id === saved.activePlayerId) ? saved.activePlayerId : state.players[0].id;
      ui.privacy = saved.privacy === true;
      ui.lastEvents = Array.isArray(saved.lastEvents) ? saved.lastEvents : [];
      ui.lastRound = Number.isInteger(saved.lastRound) ? saved.lastRound : null;
      ui.guideDismissed = saved.guideDismissed === true;
      ui.guide = saved.guide && typeof saved.guide === 'object' ? saved.guide : {};
    } catch (error) { ui.saveInvalid = true; }
  }

  function buildPlayers(includeFamily = true) {
    const count = Number($('player-count').value);
    return Array.from({ length: count }, (_, index) => {
      const nameInput = document.querySelector(`[data-name="${index}"]`);
      const kindInput = document.querySelector(`[data-kind="${index}"]`);
      const kind = index === 0 ? 'human' : kindInput?.value === 'human' ? 'human' : 'bot';
      const name = (nameInput?.value || '').trim().slice(0, 20) || tr(kind === 'human' ? 'Joueur {n}' : 'IA {n}', { n: index + 1 });
      const player = { id: `p${index + 1}`, name, kind };
      if (index === 0 && includeFamily && $('starting-family').value) player.family = $('starting-family').value;
      return player;
    });
  }
  function renderPlayerSettings() {
    const old = buildPlayers(false);
    const count = Number($('player-count').value);
    $('player-settings').innerHTML = Array.from({ length: count }, (_, index) => {
      const before = old[index];
      const kind = index === 0 ? 'human' : before?.kind || 'bot';
      const name = before?.name || tr(index ? 'IA {n}' : 'Joueur {n}', { n: index + 1 });
      return `<div class="player-setting"><input data-name="${index}" maxlength="20" value="${esc(name)}" aria-label="${esc(tr('Joueur {n}', { n: index + 1 }))}"><select data-kind="${index}" aria-label="${esc(tr('Joueurs'))}" ${index === 0 ? 'disabled' : ''}><option value="human" ${kind === 'human' ? 'selected' : ''}>${esc(tr('Sur cet appareil'))}</option><option value="bot" ${kind === 'bot' ? 'selected' : ''}>${esc(tr('Adversaire IA'))}</option></select></div>`;
    }).join('');
    updateStartingFamilies();
  }
  function updateStartingFamilies() {
    const previous = $('starting-family').value;
    try {
      const probe = P.newGame({ seed: $('game-seed').value.trim() || 'orbite', players: buildPlayers(false) });
      $('starting-family').innerHTML = probe.activeFamilies.map(id => `<option value="${esc(id)}">${esc(familyLabel(id))}</option>`).join('');
      if (probe.activeFamilies.includes(previous)) $('starting-family').value = previous;
    } catch (error) { console.warn('ORBITE setup:', error.message); }
  }
  function showSetup() {
    clearTimeout(botTimer);
    clearTimeout(playbackTimer);
    playbackToken++;
    ui.playback = null;
    ui.resolving = false;
    $('setup-screen').hidden = false;
    $('game-screen').hidden = true;
    $('privacy-screen').hidden = true;
    $('saved-game-panel').hidden = !ui.saveAvailable;
    $('saved-game-message').textContent = tr(ui.saveInvalid ? 'Cette sauvegarde est incompatible. Vous pouvez démarrer une nouvelle partie.' : 'Une partie locale est disponible.');
    $('resume-game').hidden = ui.saveInvalid || !ui.state;
    $('replace-save-note').hidden = !ui.saveAvailable;
  }
  function startGame(quick = false) {
    try {
      const seed = quick ? freshSeed() : $('game-seed').value.trim() || freshSeed();
      const players = quick ? [{ id: 'p1', name: tr('Joueur {n}', { n: 1 }), kind: 'human' }, { id: 'p2', name: tr('IA {n}', { n: 2 }), kind: 'bot' }] : buildPlayers();
      ui.state = P.newGame({ seed, players });
      ui.activePlayerId = ui.state.players.find(player => player.kind === 'human')?.id || ui.state.players[0].id;
      ui.selected = null;
      ui.mode = 'move';
      ui.privacy = false;
      ui.resolving = false;
      ui.lastEvents = [];
      ui.lastRound = null;
      ui.zoom = 1;
      ui.guideDismissed = false;
      ui.guide = {};
      ui.playback = null;
      clearTimeout(playbackTimer);
      playbackToken++;
      save();
      render();
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (error) { console.error(error); toast(tr('Le plateau ne peut pas être chargé.')); }
  }
  function resumeGame() {
    if (!ui.state || ui.saveInvalid) return;
    ui.selected = null;
    const human = ui.state.players.find(player => player.kind === 'human' && alive(player) && !player.locked);
    if (!activePlayer() || !alive(activePlayer())) ui.activePlayerId = human?.id || ui.state.players.find(alive)?.id || ui.state.players[0].id;
    const manyHumans = ui.state.players.filter(player => player.kind === 'human' && alive(player)).length > 1;
    if (manyHumans && ui.state.phase !== 'over' && human) ui.privacy = true;
    render();
    if (!human && ui.state.phase === 'planning') queueResolution();
  }

  function action(command, { selectNew = false } = {}) {
    if (!editable()) return false;
    const beforeIds = selectNew ? new Set(ui.state.units.map(unit => unit.id)) : null;
    const result = P.action(ui.state, ui.activePlayerId, command);
    if (!result?.ok) { toast(tr(result?.error || 'Action impossible. Choisissez une case autorisée.')); return false; }
    if (selectNew) {
      const fresh = ui.state.units.find(unit => unit.owner === ui.activePlayerId && !beforeIds.has(unit.id));
      if (fresh) { ui.selected = fresh.id; ui.mode = fresh.node ? 'move' : 'deploy'; }
    }
    if (ui.selected && !selectedUnit()) ui.selected = null;
    const progress = ui.guide[ui.activePlayerId] || (ui.guide[ui.activePlayerId] = {});
    if (command.type === 'buy') progress.bought = true;
    if (command.type === 'deploy') progress.deployed = true;
    if (command.type === 'order') progress.ordered = true;
    save();
    render();
    const feedback = command.type === 'buy' ? 'Astre acheté. Placez-le près de votre étoile.' : command.type === 'deploy' ? 'Astre déployé.' : command.type === 'order' ? command.order.type === 'move' ? 'Déplacement préparé.' : command.order.type === 'attack' ? 'Attaque préparée.' : 'Défense préparée.' : null;
    if (feedback) toast(tr(feedback));
    return true;
  }
  function selectUnit(id) {
    const unit = ui.state.units.find(candidate => candidate.id === id);
    if (!unit || unit.owner !== ui.activePlayerId) return;
    ui.selected = id;
    ui.mode = unit.node ? 'move' : 'deploy';
    const progress = ui.guide[ui.activePlayerId] || (ui.guide[ui.activePlayerId] = {});
    progress.selected = true;
    save();
    render();
  }

  const RADII = [96, 162, 226];
  function point(node) {
    const angle = node.sector / ui.state.sectors * Math.PI * 2 - Math.PI / 2;
    return { x: 320 + Math.cos(angle) * RADII[node.ring], y: 320 + Math.sin(angle) * RADII[node.ring] };
  }
  function starPoint(player) {
    const angle = player.home / ui.state.sectors * Math.PI * 2 - Math.PI / 2;
    return { x: 320 + Math.cos(angle) * 287, y: 320 + Math.sin(angle) * 287 };
  }
  function planetSvg(unit, cx, cy, radius) {
    const card = cardOf(unit), color = colorOfUnit(unit);
    const hash = String(unit.cardId).split('').reduce((n, c) => n + c.charCodeAt(0), 0);
    const bands = [0, 1, 2].map(i => {
      const y = cy - radius * .6 + i * radius * .5;
      const offset = ((hash + i * 3) % 5 - 2) * radius * .12;
      return `<path d="M${cx - radius} ${y}h${radius * 2}" stroke="#ffffff" stroke-opacity="${.07 + i * .025}" stroke-width="${radius * .22}" transform="translate(${offset} 0)"/>`;
    }).join('');
    return `<defs><clipPath id="clip-${esc(unit.id)}"><circle cx="${cx}" cy="${cy}" r="${radius}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${radius}" fill="${esc(color)}"/><g clip-path="url(#clip-${esc(unit.id)})" shape-rendering="crispEdges">${bands}<path d="M${cx + radius * .15} ${cy - radius}q${radius * .6} ${radius} ${-radius * .15} ${radius * 2}h${radius}v${-radius * 2}" fill="#000000" fill-opacity=".33"/></g>${unit.golden ? `<circle cx="${cx}" cy="${cy}" r="${radius + 3}" fill="none" stroke="#ecc579" stroke-width="1.5"/>` : ''}<text class="unit-role" x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(ROLE_SYMBOLS[card.role] || '•')}</text>`;
  }
  function renderBoard(view) {
    const selected = view.units.find(unit => unit.id === ui.selected);
    const canEdit = editable();
    const moveNodes = canEdit && selected?.node && ui.mode === 'move' ? P.moves(ui.state, selected.id) : [];
    const ownDeployed = view.units.filter(unit => unit.owner === ui.activePlayerId && unit.node).length;
    const deployNodes = canEdit && selected && !selected.node && ownDeployed < 7 ? P.deployNodes(ui.state, ui.activePlayerId) : [];
    const legalNodes = new Set([...moveNodes, ...deployNodes].map(key));
    const targets = canEdit && selected?.node && ui.mode === 'attack' ? P.targets(ui.state, selected.id) : [];
    const legalTargets = new Set(targets.map(target => `${target.type}:${target.id}`));
    const onBoard = new Map(view.units.filter(unit => unit.node).map(unit => [key(unit.node), unit]));
    const relays = new Set(view.relays.map(key));
    const current = view.players.find(player => player.id === ui.activePlayerId);
    const unitRadius = Math.max(8, Math.min(18, 96 * Math.PI / view.sectors * .72));
    let svg = '<defs><marker id="order-tip" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#ecc579"/></marker></defs>';
    for (let sector = 0; sector < view.sectors; sector++) {
      const first = point({ ring: 0, sector }), last = point({ ring: 2, sector });
      svg += `<line class="sector-line" x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}"/>`;
    }
    svg += RADII.map(radius => `<circle class="board-orbit" cx="320" cy="320" r="${radius}"/>`).join('');
    svg += `<circle cx="320" cy="320" r="29" fill="#ecc57908" stroke="#ecc57922"/><circle cx="320" cy="320" r="14" fill="#ecc579"/><circle cx="320" cy="320" r="20" fill="none" stroke="#ecc57933" stroke-dasharray="2 5"/><text x="320" y="360" text-anchor="middle" fill="#7f91a4" font-size="9" letter-spacing="2">ORBITE</text>`;
    for (let ring = 0; ring < 3; ring++) for (let sector = 0; sector < view.sectors; sector++) {
      const node = { ring, sector }, nk = key(node), pos = point(node), unit = onBoard.get(nk);
      const own = unit && unit.owner === ui.activePlayerId;
      const order = ui.playback ? ui.playback.snapshot.players.find(player => player.id === unit?.owner)?.orders?.[unit?.id] : own ? current.orders?.[unit.id] : null;
      const nodeRadius = ring === 0 ? unitRadius + 3 : Math.min(22, unitRadius + 4);
      const classes = [legalNodes.has(nk) ? 'legal-move' : '', unit?.id === selected?.id ? 'selected' : '', unit && legalTargets.has(`unit:${unit.id}`) ? 'legal-target' : '', order ? 'queued' : ''].filter(Boolean).join(' ');
      const label = unit ? `${unitLabel(unit)} · ${unit.hp} ${tr('PV')} · ${playerOf(unit.owner)?.name || ''}` : `${tr('Case')} ${ring + 1} / ${sector + 1}${relays.has(nk) ? ` · ${tr('Relais')}` : ''}`;
      svg += `<g role="button" tabindex="0" data-node="${nk}" data-testid="board-node" class="${classes}" aria-label="${esc(label)}" style="--owner:${esc(unit ? ownerColor(unit.owner) : '#54697e')}"><title>${esc(label)}</title><circle class="board-cell" cx="${pos.x}" cy="${pos.y}" r="${nodeRadius}"/>`;
      if (relays.has(nk)) svg += `<rect class="relay-cell" x="${pos.x - nodeRadius * .72}" y="${pos.y - nodeRadius * .72}" width="${nodeRadius * 1.44}" height="${nodeRadius * 1.44}" rx="2" transform="rotate(45 ${pos.x} ${pos.y})"/>`;
      if (unit) {
        svg += `<g data-visual-unit="${esc(unit.id)}"><circle class="unit-owner" cx="${pos.x}" cy="${pos.y}" r="${unitRadius + 4}"/>${planetSvg(unit, pos.x, pos.y, unitRadius)}<text class="unit-hp" x="${pos.x + unitRadius * .8}" y="${pos.y + unitRadius + 5}" text-anchor="middle">${Math.max(0, unit.hp)}</text></g>`;
        if (order?.type === 'guard') svg += `<circle class="guard-ring" cx="${pos.x}" cy="${pos.y}" r="${unitRadius + 8}"/>`;
      }
      svg += '</g>';
    }
    for (const player of view.players) {
      const pos = starPoint(player), anchor = point({ ring: 2, sector: player.home });
      const target = legalTargets.has(`star:${player.id}`) ? 'legal-target' : '';
      svg += `<g role="button" tabindex="0" data-star="${esc(player.id)}" class="${target}" aria-label="${esc(`${player.name} · ${tr('Étoile')} · ${player.hp} ${tr('PV')}`)}" style="--owner:${esc(ownerColor(player.id))};opacity:${alive(player) ? 1 : .3}"><line pointer-events="none" x1="${anchor.x}" y1="${anchor.y}" x2="${pos.x}" y2="${pos.y}" stroke="${esc(ownerColor(player.id))}" stroke-opacity=".4" stroke-dasharray="3 5"/><circle class="star-rim" cx="${pos.x}" cy="${pos.y}" r="19"/><path d="M${pos.x} ${pos.y - 11}l3.1 7.9 7.9 3.1-7.9 3.1-3.1 7.9-3.1-7.9-7.9-3.1 7.9-3.1z" fill="${esc(ownerColor(player.id))}"/><text class="core-hp" x="${pos.x}" y="${pos.y + 34}" text-anchor="middle">${Math.max(0, player.hp)}</text></g>`;
    }
    const revealedOrders = ui.playback ? Object.assign({}, ...ui.playback.snapshot.players.map(player => player.orders || {})) : current.orders || {};
    for (const [unitId, order] of Object.entries(revealedOrders)) {
      const unit = view.units.find(candidate => candidate.id === unitId);
      if (!unit?.node || !order) continue;
      const from = point(unit.node);
      let to = order.type === 'move' ? point(order.to) : null;
      if (order.type === 'attack') {
        const targetUnit = view.units.find(candidate => candidate.id === order.target.id);
        const targetPlayer = view.players.find(candidate => candidate.id === order.target.id);
        if (order.target.type === 'unit' && targetUnit?.node) to = point(targetUnit.node);
        if (order.target.type === 'star' && targetPlayer) to = starPoint(targetPlayer);
      }
      if (to && (!ui.playback || ui.playback.step < 2)) svg += `<path class="move-arrow ${order.type === 'attack' ? 'attack-arrow' : ''}" d="M${from.x} ${from.y}L${to.x} ${to.y}" marker-end="url(#order-tip)"/>`;
    }
    if (canEdit && selected?.node) {
      const order = current.orders?.[selected.id];
      const planned = order?.type === 'move' ? order.to : selected.node;
      const drift = P.nextDrift(ui.state)[planned.ring];
      if (drift) {
        const from = point(planned), to = point({ ring: planned.ring, sector: (planned.sector + drift) % view.sectors });
        svg += `<g class="drift-preview" pointer-events="none"><path d="M${from.x} ${from.y}A${RADII[planned.ring]} ${RADII[planned.ring]} 0 0 1 ${to.x} ${to.y}"/><circle cx="${to.x}" cy="${to.y}" r="${unitRadius + 8}"/><text x="${to.x}" y="${to.y + 4}" text-anchor="middle">↻</text><title>${esc(tr('Après la rotation'))}</title></g>`;
      }
    }
    if (ui.playback?.step === 2) {
      for (const event of ui.playback.events.filter(event => event.t === 'hit')) {
        const unit = view.units.find(unit => unit.id === event.unitId);
        const targetUnit = event.target.type === 'unit' ? view.units.find(unit => unit.id === event.target.id) : null;
        const targetPlayer = event.target.type === 'star' ? view.players.find(player => player.id === event.target.id) : null;
        if (!unit?.node || (!targetUnit?.node && !targetPlayer)) continue;
        const from = point(unit.node), to = targetUnit ? point(targetUnit.node) : starPoint(targetPlayer);
        svg += `<g class="combat-effect" pointer-events="none"><line class="hit-beam ${event.ok ? '' : 'missed-beam'}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/><circle class="hit-burst" cx="${to.x}" cy="${to.y}" r="${unitRadius + 9}"/><text class="hit-number" x="${to.x}" y="${to.y - 25}" text-anchor="middle">${event.ok ? `−${event.n}` : '↗'}</text></g>`;
      }
    }
    $('battle-board').innerHTML = svg;
    $('battle-board').style.width = `${ui.zoom * 100}%`;
    $('zoom-out').disabled = ui.zoom <= 1;
    $('zoom-in').disabled = ui.zoom >= 2.5;
  }

  function renderPlayers(view) {
    $('players-strip').innerHTML = view.players.map(player => `<div data-player-chip="${esc(player.id)}" class="player-chip ${player.id === ui.activePlayerId ? 'active' : ''} ${alive(player) ? '' : 'dead'}" style="--owner:${esc(ownerColor(player.id))}"><div class="player-name"><i class="owner-dot"></i><span>${esc(player.name)}</span>${player.locked ? '<span class="locked-badge" aria-hidden="true">✓</span>' : ''}</div><div class="resources"><span class="resource-heart" title="${esc(tr('Étoile'))}">✦ ${Math.max(0, player.hp)}</span><span class="resource-score" title="${esc(tr('Influence'))}">◇ ${player.score} / 10</span></div></div>`).join('');
  }
  function renderInspector(view) {
    const unit = view.units.find(candidate => candidate.id === ui.selected && candidate.owner === ui.activePlayerId);
    if (!unit) { $('unit-inspector').innerHTML = `<p class="muted">${esc(tr('Sélectionnez un astre pour préparer son ordre.'))}</p>`; return; }
    const card = cardOf(unit), stats = P.stats(ui.state, selectedUnit());
    const disabled = editable() ? '' : 'disabled';
    const order = activePlayer().orders?.[unit.id];
    $('unit-inspector').innerHTML = `<div class="unit-details-heading"><i class="family-token" style="--family:${esc(colorOfUnit(unit))}"></i><div><p class="unit-details-name">${esc(unitLabel(unit))}</p><p class="unit-details-sub">${esc(unit.node ? `${tr('Anneau')} ${unit.node.ring + 1} · ${tr('Secteur')} ${unit.node.sector + 1}` : tr('Cet astre attend dans votre réserve.'))}</p></div><div class="unit-statline"><span title="${esc(tr('Attaque'))}">⚔ ${stats.attack}</span><span title="${esc(tr('PV'))}">♥ ${unit.hp}/${stats.maxHp}</span><span title="${esc(tr('Armure'))}">⬡ ${stats.armor}</span></div></div><p class="family-description">${esc(tr(familyDescriptions[card.family] || ''))}</p><div class="unit-actionbar">${unit.node ? `<button type="button" data-unit-action="move" class="small-button ${ui.mode === 'move' ? 'selected-action' : ''}" ${disabled}>${esc(tr('Déplacer'))} · ${stats.move}</button><button type="button" data-unit-action="attack" class="small-button ${ui.mode === 'attack' ? 'selected-action' : ''}" ${disabled}>${esc(tr('Attaquer'))} · ${stats.range}</button><button type="button" data-unit-action="guard" data-testid="guard-unit" class="small-button ${order?.type === 'guard' ? 'selected-action' : ''}" ${disabled}>${esc(tr('Défendre'))}</button>${order ? `<button type="button" data-unit-action="cancel" class="small-button" ${disabled}>${esc(tr('Annuler l’ordre'))}</button>` : ''}` : ''}<button type="button" data-unit-action="sell" class="small-button sell-button" ${disabled}>${esc(tr('Vendre · +1'))}</button></div><p class="selection-hint">${esc(tr(!unit.node ? 'Choisissez une case près de votre étoile.' : ui.mode === 'attack' ? 'Choisissez une cible à portée.' : 'Choisissez une case autorisée.'))}</p>${unit.node && (ui.mode === 'attack' || P.nextDrift(ui.state)[(order?.type === 'move' ? order.to : unit.node).ring]) ? `<p class="rotation-hint">↻ ${esc(tr(ui.mode === 'attack' ? 'La cible peut se déplacer avant votre attaque.' : 'Les cases pointillées indiquent votre position après la rotation.'))}</p>` : ''}`;
  }
  function renderBench(view) {
    const bench = view.units.filter(unit => unit.owner === ui.activePlayerId && !unit.node);
    $('reserve-count').textContent = `${bench.length} / 8`;
    $('bench-units').innerHTML = bench.length ? bench.map(unit => `<button type="button" class="bench-unit ${unit.id === ui.selected ? 'selected' : ''} ${unit.golden ? 'golden' : ''}" data-bench="${esc(unit.id)}" data-testid="bench-unit" aria-label="${esc(unitLabel(unit))}"><i class="family-token" style="--family:${esc(colorOfUnit(unit))}"></i><span>${esc(roleLabel(cardOf(unit).role))}${unit.golden ? ' ★' : ''}</span></button>`).join('') : `<p class="muted">${esc(tr('Aucun astre en réserve.'))}</p>`;
  }
  function renderMarket(view) {
    const player = view.players.find(candidate => candidate.id === ui.activePlayerId);
    const canEdit = editable();
    $('energy-wallet').textContent = `⚡ ${player.gold}`;
    $('refresh-shop').disabled = !canEdit || player.gold < 1;
    $('freeze-shop').disabled = !canEdit;
    $('freeze-shop').classList.toggle('active', !!player.frozen);
    $('freeze-shop').textContent = tr(player.frozen ? 'Dégeler' : 'Geler');
    $('upgrade-shop').textContent = tr(player.tier >= 2 ? 'Niveau maximal' : 'Débloquer les artilleurs · 5');
    $('upgrade-shop').disabled = !canEdit || player.gold < 5 || player.tier >= 2;
    const bench = view.units.filter(unit => unit.owner === player.id && !unit.node);
    $('shop-cards').innerHTML = Array.isArray(player.shop) ? player.shop.map((id, slot) => {
      const card = P.CARDS[id];
      if (!card) return `<div class="shop-empty">—</div>`;
      const family = families[card.family];
      const stats = P.stats(ui.state, { cardId: id, golden: false, node: null, movedLastRound: false });
      const matching = view.units.filter(unit => unit.owner === player.id && unit.cardId === id && !unit.golden);
      const fitsBench = bench.length < 8 || (matching.length >= 2 && matching.some(unit => !unit.node));
      return `<article class="shop-card"><i class="family-token" style="--family:${esc(family?.color || '#8ca6ba')}"></i><div class="card-copy"><h3>${esc(roleLabel(card.role))} · ${esc(familyLabel(card.family))}</h3><p>⚔ ${stats.attack} &nbsp; ♥ ${stats.maxHp} &nbsp; ${esc(tr('Portée'))} ${stats.range}</p></div><button type="button" class="buy-button" data-buy="${slot}" data-testid="shop-buy" aria-label="${esc(`${tr('Acheter')} ${roleLabel(card.role)} · ${familyLabel(card.family)} · ${card.cost}`)}" ${!canEdit || player.gold < card.cost || !fitsBench ? 'disabled' : ''}>${card.cost} ⚡</button></article>`;
    }).join('') : '';
  }
  function orderLabel(order) {
    if (order.type === 'guard') return tr('Défendre');
    if (order.type === 'move') return `${tr('Déplacer')} → ${order.to.ring + 1}/${order.to.sector + 1}`;
    if (order.type === 'attack') return tr('Attaquer');
    return '';
  }
  function renderOrders(view) {
    const player = view.players.find(candidate => candidate.id === ui.activePlayerId);
    const orders = Object.entries(player.orders || {}).filter(([id]) => view.units.some(unit => unit.id === id));
    $('orders-list').innerHTML = orders.length ? orders.map(([id, order]) => {
      const unit = view.units.find(candidate => candidate.id === id);
      return `<div class="order-row" style="--family:${esc(colorOfUnit(unit))}"><i></i><span>${esc(roleLabel(cardOf(unit).role))} · ${esc(orderLabel(order))}</span><button type="button" data-cancel="${esc(id)}" aria-label="${esc(tr('Annuler l’ordre'))}" ${editable() ? '' : 'disabled'}>×</button></div>`;
    }).join('') : `<p class="muted">${esc(tr('Aucun ordre préparé.'))}</p>`;
    $('clear-orders').disabled = !editable() || !orders.length;
    $('lock-turn').disabled = !editable();
    $('lock-turn').textContent = tr(ui.resolving ? 'Résolution' : player.locked ? 'Ordres verrouillés' : 'Verrouiller mes ordres');
    const observing = !ui.state.players.some(candidate => candidate.kind === 'human' && alive(candidate));
    $('turn-note').textContent = ui.resolving ? tr('Les adversaires préparent leurs ordres…') : observing || !alive(player) ? tr('Votre étoile a été détruite. Vous observez la suite.') : tr('{n} ordres préparés', { n: orders.length });
  }
  function renderLog() {
    const events = ui.lastEvents;
    $('resolution-panel').hidden = !events.length || !!ui.playback;
    $('resolution-round').textContent = ui.lastRound ? tr('Manche {n}', { n: ui.lastRound }) : '';
    const count = (...types) => events.filter(event => types.includes(event.t || event.type)).length;
    const lines = [];
    const moved = events.filter(event => event.t === 'move' && event.ok).length;
    if (moved) lines.push(tr('{n} déplacements résolus.', { n: moved }));
    if (events.some(event => event.t === 'move' && event.reason === 'collision')) lines.push(tr('Les mouvements vers une même case sont annulés.'));
    if (count('hit', 'attack', 'damage')) lines.push(tr('{n} attaques résolues.', { n: count('hit', 'attack', 'damage') }));
    if (count('die', 'death')) lines.push(tr('{n} astres détruits.', { n: count('die', 'death') }));
    if (count('drift')) lines.push(tr('Les orbites avancent.'));
    if (count('score')) lines.push(tr('Les relais rapportent de l’influence.'));
    const gained = events.filter(event => event.t === 'score' && event.owner === ui.activePlayerId).reduce((n, event) => n + event.n, 0);
    const lost = events.filter(event => event.t === 'hit' && event.ok && event.target.type === 'star' && event.target.id === ui.activePlayerId).reduce((n, event) => n + event.n, 0);
    if (gained) lines.push(tr('Vous gagnez {n} influence(s).', { n: gained }));
    if (lost) lines.push(tr('Votre étoile perd {n} PV.', { n: lost }));
    if (!lines.length) lines.push(tr('Les ordres ont été résolus.'));
    $('resolution-log').innerHTML = lines.map(line => `<li>${esc(line)}</li>`).join('');
  }
  function renderEnd() {
    const over = ui.state.phase === 'over' && !ui.playback;
    $('game-screen').classList.toggle('match-over', over);
    $('end-panel').hidden = !over;
    if (!over) return;
    const result = ui.state.result || {};
    const winnerId = result.winner || (Array.isArray(result.winners) && result.winners.length === 1 ? result.winners[0] : null);
    const name = playerOf(winnerId)?.name;
    $('end-title').textContent = name && !result.draw ? tr('Victoire de {name}', { name }) : tr('Partie nulle');
    $('end-detail').textContent = tr(result.reason === 'round-limit' ? 'Après 40 manches sans vainqueur, la partie est nulle.' : result.reason === 'score' ? 'Objectif d’influence atteint.' : result.reason === 'mutual-destruction' ? 'Les dernières étoiles ont été détruites ensemble.' : 'La dernière étoile reste en vie.');
  }

  function renderGuide(view) {
    const visible = !ui.guideDismissed && !ui.resolving && view.phase !== 'over' && alive(activePlayer());
    $('turn-guide').hidden = !visible;
    $('show-guide').hidden = !ui.guideDismissed || ui.resolving || view.phase === 'over';
    if (!visible) return;
    const progress = ui.guide[ui.activePlayerId] || {};
    const selected = view.units.find(unit => unit.id === ui.selected && unit.owner === ui.activePlayerId);
    const own = view.players.find(player => player.id === ui.activePlayerId);
    let step = 1, hint = 'Choisissez un de vos astres.';
    if (view.round > 1 && !selected) { step = 1; hint = 'Préparez la manche suivante.'; }
    else if (selected && !selected.node) { step = 4; hint = 'Placez votre achat sur une case près de votre étoile.'; }
    else if (selected?.node && (view.round === 1 ? !progress.ordered : !own.orders?.[selected.id])) { step = 2; hint = ui.mode === 'attack' ? 'Choisissez une cible à portée.' : 'Les cases bleues indiquent ses déplacements possibles.'; }
    else if (progress.ordered && !progress.bought && own.gold >= 3) { step = 3; hint = 'Achetez un astre pour renforcer votre flotte.'; }
    else if (progress.bought && !progress.deployed && view.units.some(unit => unit.owner === own.id && !unit.node)) { step = 4; hint = 'Placez votre achat sur une case près de votre étoile.'; }
    else if (progress.ordered || progress.deployed) { step = 5; hint = 'Verrouillez vos ordres quand votre plan est prêt.'; }
    $('guide-step').textContent = step;
    $('guide-text').textContent = tr(hint);
  }

  function renderPlayback() {
    const playback = ui.playback;
    $('playback-panel').hidden = !playback;
    $('game-screen').classList.toggle('playing-resolution', !!playback);
    if (!playback) return;
    const titles = ['Ordres révélés', 'Déplacements', 'Attaques', 'Rotation des orbites', 'Contrôle des relais'];
    const descriptions = ['Votre plan est prêt.', 'Les déplacements sont résolus ensemble.', 'Les attaques frappent simultanément.', 'Les orbites avancent : vérifiez les nouveaux alignements.', 'Les relais contrôlés rapportent de l’influence.'];
    $('playback-title').textContent = tr(titles[playback.step]);
    $('playback-description').textContent = tr(descriptions[playback.step]);
    $('playback-panel').dataset.step = playback.step;
    $('playback-panel').querySelectorAll('.playback-steps i').forEach((dot, i) => dot.classList.toggle('active', i < playback.step));
  }

  function render() {
    if (!ui.state) { showSetup(); return; }
    $('setup-screen').hidden = true;
    $('load-error').hidden = true;
    $('privacy-screen').hidden = !ui.privacy;
    $('game-screen').hidden = ui.privacy;
    if (ui.privacy) {
      const name = activePlayer()?.name || '';
      $('privacy-title').textContent = tr('Passez l’appareil à {name}', { name });
      $('privacy-confirm').textContent = tr('Je suis {name}', { name });
      return;
    }
    const displayState = ui.playback?.snapshot || ui.state;
    const view = P.view(displayState, ui.activePlayerId);
    $('round-label').textContent = tr('Manche {n}', { n: view.round });
    $('phase-label').textContent = tr(view.phase === 'over' ? 'Fin de partie' : ui.resolving ? 'Résolution' : 'Préparation');
    $('active-player-label').textContent = activePlayer()?.name || '';
    const drift = P.nextDrift(displayState);
    $('drift-label').textContent = `I +${drift[0]} · II +${drift[1]} · III +${drift[2]}`;
    const deployed = view.units.filter(unit => unit.owner === ui.activePlayerId && unit.node).length;
    $('fleet-count').textContent = tr('{n} / 7 astres', { n: deployed });
    renderPlayers(view);
    renderBoard(view);
    renderInspector(view);
    renderBench(view);
    renderMarket(view);
    renderOrders(view);
    renderLog();
    renderEnd();
    renderGuide(view);
    renderPlayback();
  }
  function nextHuman() { return ui.state.players.find(player => alive(player) && player.kind === 'human' && !player.locked); }
  function lockTurn() {
    if (!editable()) return;
    const result = P.action(ui.state, ui.activePlayerId, { type: 'lock' });
    if (!result.ok) { toast(tr(result.error || 'Action impossible. Choisissez une case autorisée.')); return; }
    ui.selected = null;
    const next = nextHuman();
    if (next) { ui.activePlayerId = next.id; ui.privacy = true; save(); render(); }
    else { save(); queueResolution(); }
  }
  function queueResolution() {
    if (!ui.state || ui.state.phase === 'over' || ui.resolving) return;
    ui.privacy = false;
    ui.resolving = true;
    render();
    clearTimeout(botTimer);
    botTimer = setTimeout(resolve, 350);
  }
  function finishPlayback() {
    if (!ui.playback) return;
    playbackToken++;
    clearTimeout(playbackTimer);
    for (const animation of ui.playback.animations || []) animation.cancel();
    ui.playback = null;
    ui.selected = null;
    ui.resolving = false;
    const livingHumans = ui.state.players.filter(player => player.kind === 'human' && alive(player));
    ui.activePlayerId = livingHumans[0]?.id || ui.state.players.find(alive)?.id || ui.state.players[0].id;
    ui.privacy = ui.state.phase !== 'over' && livingHumans.length > 1;
    save();
    render();
    if (ui.state.phase === 'planning' && !livingHumans.length) botTimer = setTimeout(queueResolution, 1100);
  }
  function animateTravel(events, duration) {
    for (const event of events) {
      if (event.ok === false || !event.from || !event.to || sameNode(event.from, event.to)) continue;
      const visual = [...$('battle-board').querySelectorAll('[data-visual-unit]')].find(element => element.dataset.visualUnit === event.unitId);
      if (!visual?.animate) continue;
      const from = point(event.from), to = point(event.to);
      const animation = visual.animate([{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` }, { transform: 'translate(0, 0)' }], { duration, easing: 'cubic-bezier(.25,.75,.25,1)', fill: 'none' });
      ui.playback.animations.push(animation);
    }
  }
  async function playResolution() {
    if (!ui.playback) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { finishPlayback(); return; }
    const token = ++playbackToken;
    const wait = duration => new Promise(resolveWait => { playbackTimer = setTimeout(resolveWait, duration); });
    const ongoing = () => ui.playback && playbackToken === token;
    const playback = ui.playback, snapshot = playback.snapshot, events = playback.events;
    render();
    await wait(400);
    if (!ongoing()) return;
    playback.step = 1;
    const moves = events.filter(event => event.t === 'move');
    for (const event of moves) {
      const unit = snapshot.units.find(unit => unit.id === event.unitId);
      if (unit && event.ok) unit.node = { ...event.to };
    }
    render();
    animateTravel(moves, 650);
    for (const event of moves.filter(event => !event.ok)) {
      const unit = snapshot.units.find(unit => unit.id === event.unitId);
      const element = unit?.node && $('battle-board').querySelector(`[data-node="${key(unit.node)}"]`);
      element?.classList.add('blocked-move');
    }
    await wait(750);
    if (!ongoing()) return;
    playback.step = 2;
    render();
    await wait(800);
    if (!ongoing()) return;
    for (const event of events.filter(event => event.t === 'hit' && event.ok)) {
      const target = event.target.type === 'unit' ? snapshot.units.find(unit => unit.id === event.target.id) : snapshot.players.find(player => player.id === event.target.id);
      if (target) target.hp = Math.max(0, target.hp - event.n);
    }
    const removed = new Set(events.filter(event => event.t === 'die').map(event => event.unitId));
    snapshot.units = snapshot.units.filter(unit => !removed.has(unit.id));
    for (const event of events.filter(event => event.t === 'heal')) {
      const unit = snapshot.units.find(unit => unit.id === event.unitId);
      if (unit) unit.hp += event.n;
    }
    playback.step = 3;
    const drift = events.filter(event => event.t === 'drift');
    for (const event of drift) {
      const unit = snapshot.units.find(unit => unit.id === event.unitId);
      if (unit) unit.node = { ...event.to };
    }
    render();
    animateTravel(drift, 650);
    await wait(750);
    if (!ongoing()) return;
    playback.step = 4;
    for (const event of events.filter(event => event.t === 'score')) {
      const player = snapshot.players.find(player => player.id === event.owner);
      if (player) player.score = event.score;
    }
    render();
    for (const id of new Set(events.filter(event => event.t === 'score').map(event => event.owner))) {
      [...$('players-strip').querySelectorAll('[data-player-chip]')].find(element => element.dataset.playerChip === id)?.classList.add('score-gained');
    }
    await wait(650);
    if (ongoing()) finishPlayback();
  }

  function resolve() {
    if (document.hidden) { botTimer = setTimeout(resolve, 500); return; }
    try {
      if (nextHuman()) { ui.resolving = false; render(); return; }
      const completedRound = ui.state.round;
      for (const player of ui.state.players) {
        if (!alive(player) || player.kind !== 'bot' || player.locked) continue;
        if (!window.OrbitePlateauBot?.prepareTurn) throw new Error('Bot unavailable');
        const outcome = window.OrbitePlateauBot.prepareTurn(ui.state, player.id, { policy: 'balanced' });
        if (!outcome?.ok) throw new Error('Bot cannot prepare turn');
      }
      const snapshot = JSON.parse(JSON.stringify(ui.state));
      const outcome = P.resolveRound(ui.state);
      if (!outcome.ok) throw new Error('Round cannot resolve');
      ui.lastEvents = Array.isArray(outcome.events) ? outcome.events : [];
      ui.lastRound = completedRound;
      ui.selected = null;
      ui.playback = { snapshot, events: ui.lastEvents, step: 0, animations: [] };
      // Only the completed engine state is persisted; playback never changes it.
      save();
      playResolution().catch(error => { console.error('ORBITE playback:', error); finishPlayback(); });
    } catch (error) {
      console.error('ORBITE resolution:', error);
      ui.resolving = false;
      ui.playback = null;
      render();
      toast(tr('Le jeu n’a pas pu résoudre cette manche. Rechargez pour reprendre la sauvegarde.'));
    }
  }

  function handleBoard(event) {
    const hit = event.target.closest('[data-node], [data-star]');
    if (!hit || !editable()) return;
    const unit = selectedUnit();
    if (hit.dataset.star) {
      if (unit?.node && ui.mode === 'attack') action({ type: 'order', unitId: unit.id, order: { type: 'attack', target: { type: 'star', id: hit.dataset.star } } });
      return;
    }
    const [ring, sector] = hit.dataset.node.split(':').map(Number), node = { ring, sector };
    const occupant = ui.state.units.find(candidate => candidate.node && sameNode(candidate.node, node));
    if (occupant?.owner === ui.activePlayerId) { selectUnit(occupant.id); return; }
    if (!unit) return;
    if (!unit.node) action({ type: 'deploy', unitId: unit.id, node });
    else if (ui.mode === 'attack' && occupant) action({ type: 'order', unitId: unit.id, order: { type: 'attack', target: { type: 'unit', id: occupant.id } } });
    else if (ui.mode === 'move') action({ type: 'order', unitId: unit.id, order: { type: 'move', to: node } });
  }

  $('game-seed').value = freshSeed();
  renderPlayerSettings();
  readSave();
  showSetup();
  $('language-select').value = window.OrbiteI18n?.lang || 'fr';
  document.title = `ORBITE · ${tr('Plateau commun')}`;
  $('language-select').addEventListener('change', event => { save(); window.OrbiteI18n?.setLang(event.target.value); });
  $('player-count').addEventListener('change', renderPlayerSettings);
  $('player-settings').addEventListener('change', event => {
    const select = event.target.closest('[data-kind]');
    if (!select) return;
    const index = Number(select.dataset.kind), input = document.querySelector(`[data-name="${index}"]`);
    const names = [tr('Joueur {n}', { n: index + 1 }), tr('IA {n}', { n: index + 1 })];
    if (input && names.includes(input.value.trim())) input.value = names[select.value === 'human' ? 0 : 1];
    updateStartingFamilies();
  });
  $('game-seed').addEventListener('change', updateStartingFamilies);
  $('new-seed').addEventListener('click', () => { $('game-seed').value = freshSeed(); updateStartingFamilies(); });
  $('start-game').addEventListener('click', () => startGame(false));
  $('quick-play').addEventListener('click', () => startGame(true));
  $('hide-guide').addEventListener('click', () => { ui.guideDismissed = true; save(); render(); });
  $('show-guide').addEventListener('click', () => { ui.guideDismissed = false; save(); render(); });
  $('skip-resolution').addEventListener('click', finishPlayback);
  $('resume-game').addEventListener('click', resumeGame);
  $('new-game').addEventListener('click', () => { $('game-seed').value = freshSeed(); updateStartingFamilies(); showSetup(); });
  $('play-again').addEventListener('click', () => { $('game-seed').value = freshSeed(); updateStartingFamilies(); showSetup(); });
  $('privacy-confirm').addEventListener('click', () => { ui.privacy = false; save(); render(); });
  $('lock-turn').addEventListener('click', lockTurn);
  $('refresh-shop').addEventListener('click', () => action({ type: 'refresh' }));
  $('freeze-shop').addEventListener('click', () => action({ type: 'freeze' }));
  $('upgrade-shop').addEventListener('click', () => action({ type: 'upgrade' }));
  $('clear-orders').addEventListener('click', () => action({ type: 'clearOrders' }));
  $('shop-cards').addEventListener('click', event => { const button = event.target.closest('[data-buy]'); if (button) action({ type: 'buy', slot: Number(button.dataset.buy) }, { selectNew: true }); });
  $('bench-units').addEventListener('click', event => { const button = event.target.closest('[data-bench]'); if (button) selectUnit(button.dataset.bench); });
  $('unit-inspector').addEventListener('click', event => {
    const button = event.target.closest('[data-unit-action]'), unit = selectedUnit();
    if (!button || !unit || !editable()) return;
    const type = button.dataset.unitAction;
    if (type === 'move' || type === 'attack') { ui.mode = type; render(); }
    else if (type === 'guard') action({ type: 'order', unitId: unit.id, order: { type: 'guard' } });
    else if (type === 'cancel') action({ type: 'cancelOrder', unitId: unit.id });
    else if (type === 'sell') action({ type: 'sell', unitId: unit.id });
  });
  $('orders-list').addEventListener('click', event => { const button = event.target.closest('[data-cancel]'); if (button) action({ type: 'cancelOrder', unitId: button.dataset.cancel }); });
  $('battle-board').addEventListener('click', handleBoard);
  $('battle-board').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleBoard(event); } });
  $('zoom-in').addEventListener('click', () => { ui.zoom = Math.min(2.5, ui.zoom + .5); render(); });
  $('zoom-out').addEventListener('click', () => { ui.zoom = Math.max(1, ui.zoom - .5); render(); });
  $('help-open').addEventListener('click', () => $('help-dialog').showModal());
  $('help-close').addEventListener('click', () => $('help-dialog').close());
  $('help-dialog').addEventListener('click', event => { if (event.target === $('help-dialog')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
  if (!window.ORBITE_STANDALONE && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
