(function () {
  const debrisNoteToast = document.getElementById('debris-loot-toast');
  const debrisNoteButtons = Array.from(document.querySelectorAll('.debris-note'));
  const debrisToolboxButtons = Array.from(document.querySelectorAll('.debris-toolbox'));
  const toolboxOverlayPanel = document.querySelector('.toolbox-overlay-panel');
  const toolboxOverlayImage = document.getElementById('toolbox-overlay-image');
  const toolboxLock = document.getElementById('toolbox-lock');
  const toolboxLockStatus = document.getElementById('toolbox-lock-status');
  const toolboxLockWheels = Array.from(document.querySelectorAll('.toolbox-lock-wheel'));
  const collectedDebrisNotes = new Set();
  const collectedDebrisToolboxes = new Set();
  const toolboxLockTarget = '4569';
  const toolboxLockDigits = [0, 0, 0, 0];
  let debrisNoteToastTimer = 0;
  let toolboxUnlockAnnounced = false;

  function getMapMessage() {
    return document.getElementById('map-message');
  }

  function showDebrisLootToast(message) {
    if (!debrisNoteToast) return;
    debrisNoteToast.textContent = message;
    debrisNoteToast.classList.add('is-visible');
    window.clearTimeout(debrisNoteToastTimer);
    debrisNoteToastTimer = window.setTimeout(() => {
      debrisNoteToast.classList.remove('is-visible');
    }, 1800);
  }

  function clearNotebookStack(stack) {
    stack.querySelectorAll('.notebook-open-img, .notebook-cover-button').forEach(el => el.remove());
  }

  function showNotebookPages(clickedColor) {
    const overlay = document.getElementById('notebook-overlay');
    const stack = document.getElementById('notebook-stack');
    if (!overlay || !stack) return;

    clearNotebookStack(stack);

    const allColors = ['jaune', 'rouge', 'vert', 'noir'];
    const order = [
      clickedColor,
      ...allColors.filter(color => color !== clickedColor && collectedDebrisNotes.has(color))
    ];

    order.forEach((color, index) => {
      const img = document.createElement('img');
      img.className = 'notebook-open-img';
      img.src = `assets/carnets/carnet-${color}-ouvert.png`;
      img.onerror = () => { img.src = `assets/carnets/carnet-${color}-ferme.png`; };
      img.alt = `Carnet ${color} ouvert`;
      if (index > 0) {
        img.style.transform = `translate(calc(-50% - ${index * 52}px), calc(-50% + ${index * 22}px)) rotate(${-index * 4.5}deg) scale(${Math.max(0.58, 0.82 - index * 0.1)})`;
        img.style.opacity = String(Math.max(0.18, 0.55 - index * 0.12));
        img.style.filter = 'drop-shadow(0 22px 34px rgba(0,0,0,.34))';
      } else {
        img.style.zIndex = '30';
      }
      const closeBtn = stack.querySelector('.notebook-overlay-close');
      stack.insertBefore(img, closeBtn);
    });

    overlay.classList.add('is-open');
  }

  function openNotebookOverlay(clickedColor) {
    const overlay = document.getElementById('notebook-overlay');
    const stack = document.getElementById('notebook-stack');
    if (!overlay || !stack) return;

    clearNotebookStack(stack);

    const coverButton = document.createElement('button');
    coverButton.type = 'button';
    coverButton.className = 'notebook-cover-button';
    coverButton.setAttribute('aria-label', `Ouvrir le carnet ${clickedColor}`);

    const cover = document.createElement('img');
    cover.className = 'notebook-cover-img';
    cover.src = `assets/carnets/carnet-${clickedColor}-ferme.png`;
    cover.alt = `Couverture du carnet ${clickedColor}`;
    cover.onerror = () => { cover.src = `assets/carnets/carnet-${clickedColor}-ouvert.png`; };

    coverButton.appendChild(cover);
    coverButton.addEventListener('click', event => {
      event.stopPropagation();
      showNotebookPages(clickedColor);
    });

    const closeBtn = stack.querySelector('.notebook-overlay-close');
    stack.insertBefore(coverButton, closeBtn);
    overlay.classList.add('is-open');
  }

  function closeNotebookOverlay(event) {
    const overlay = document.getElementById('notebook-overlay');
    if (!overlay) return;
    if (!event || event.target === overlay) {
      overlay.classList.remove('is-open');
    }
  }

  function handleDebrisNotebookClick(button) {
    if (!button) return;
    const noteId = button.dataset.noteId || 'note';
    const noteLabel = button.dataset.noteLabel || 'Carnet';
    const mapMessage = getMapMessage();

    if (!collectedDebrisNotes.has(noteId)) {
      collectedDebrisNotes.add(noteId);
      button.classList.add('is-found');
      showDebrisLootToast(`${noteLabel} recupere`);
      if (mapMessage) {
        mapMessage.classList.remove('warn');
        mapMessage.textContent = `${noteLabel} recupere dans les debris.`;
      }
    }

    openNotebookOverlay(noteId);
  }

  function openToolboxOverlay() {
    const overlay = document.getElementById('toolbox-overlay');
    if (!overlay) return;
    overlay.classList.add('is-open');
    updateToolboxLockDisplay();
  }

  function closeToolboxOverlay(event) {
    const overlay = document.getElementById('toolbox-overlay');
    if (!overlay) return;
    if (!event || event.target === overlay) {
      overlay.classList.remove('is-open');
    }
  }

  function handleDebrisToolboxClick(button) {
    if (!button) return;
    const toolboxId = button.dataset.toolboxId || 'toolbox';
    const toolboxLabel = button.dataset.toolboxLabel || 'Boite a outils';
    const mapMessage = getMapMessage();

    if (!collectedDebrisToolboxes.has(toolboxId)) {
      collectedDebrisToolboxes.add(toolboxId);
      button.classList.add('is-found');
      showDebrisLootToast(`${toolboxLabel} recuperee`);
      if (mapMessage) {
        mapMessage.classList.remove('warn');
        mapMessage.textContent = `${toolboxLabel} reperee dans les debris.`;
      }
    }

    openToolboxOverlay();
  }

  function updateToolboxLockDisplay() {
    const combo = toolboxLockDigits.join('');
    const unlocked = combo === toolboxLockTarget;

    toolboxLockWheels.forEach((wheel, index) => {
      const digit = wheel.querySelector('span');
      if (digit) digit.textContent = String(toolboxLockDigits[index]);
      wheel.setAttribute('aria-label', `Chiffre ${index + 1} du cadenas : ${toolboxLockDigits[index]}`);
    });

    if (toolboxLockStatus) {
      toolboxLockStatus.textContent = unlocked ? 'CADENAS // OUVERT' : `CADENAS // ${combo}`;
      toolboxLockStatus.classList.toggle('is-unlocked', unlocked);
      toolboxLockStatus.classList.toggle('is-error', !unlocked && combo !== '0000');
    }

    if (toolboxLock) toolboxLock.classList.toggle('is-unlocked', unlocked);
    if (toolboxOverlayPanel) toolboxOverlayPanel.classList.toggle('is-unlocked', unlocked);
    if (toolboxOverlayImage) {
      toolboxOverlayImage.src = unlocked ? 'assets/toolbox/toolbox-open.png' : 'assets/toolbox/toolbox-closed.png';
      toolboxOverlayImage.alt = unlocked ? 'Boite a outils ouverte' : 'Boite a outils agrandie';
    }

    if (unlocked && !toolboxUnlockAnnounced) {
      toolboxUnlockAnnounced = true;
      showDebrisLootToast('Boite a outils deverrouillee');
      const mapMessage = getMapMessage();
      if (mapMessage) {
        mapMessage.classList.remove('warn');
        mapMessage.textContent = 'Boite a outils deverrouillee // combinaison validee.';
      }
    }
  }

  function rotateToolboxLockWheel(wheel, direction = 1) {
    if (!wheel || toolboxLock?.classList.contains('is-unlocked')) return;
    const index = Number(wheel.dataset.lockIndex);
    if (!Number.isInteger(index) || index < 0 || index >= toolboxLockDigits.length) return;

    toolboxLockDigits[index] = (toolboxLockDigits[index] + direction + 10) % 10;
    wheel.classList.add('is-spinning');
    window.setTimeout(() => wheel.classList.remove('is-spinning'), 120);
    updateToolboxLockDisplay();
  }

  debrisNoteButtons.forEach(button => {
    button.addEventListener('click', () => handleDebrisNotebookClick(button));
  });

  debrisToolboxButtons.forEach(button => {
    button.addEventListener('click', () => handleDebrisToolboxClick(button));
  });

  toolboxLockWheels.forEach(wheel => {
    wheel.addEventListener('click', event => {
      event.stopPropagation();
      rotateToolboxLockWheel(wheel, event.shiftKey ? -1 : 1);
    });
    wheel.addEventListener('contextmenu', event => {
      event.preventDefault();
      event.stopPropagation();
      rotateToolboxLockWheel(wheel, -1);
    });
  });

  updateToolboxLockDisplay();

  window.closeNotebookOverlay = closeNotebookOverlay;
  window.closeToolboxOverlay = closeToolboxOverlay;
})();
