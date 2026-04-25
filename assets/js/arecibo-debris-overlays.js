(function () {
  const debrisNoteToast = document.getElementById('debris-loot-toast');
  const debrisNoteButtons = Array.from(document.querySelectorAll('.debris-note'));
  const debrisToolboxButtons = Array.from(document.querySelectorAll('.debris-toolbox'));
  const collectedDebrisNotes = new Set();
  const collectedDebrisToolboxes = new Set();
  let debrisNoteToastTimer = 0;

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

  function openNotebookOverlay(clickedColor) {
    const overlay = document.getElementById('notebook-overlay');
    const stack = document.getElementById('notebook-stack');
    if (!overlay || !stack) return;

    stack.querySelectorAll('.notebook-open-img').forEach(el => el.remove());

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

  debrisNoteButtons.forEach(button => {
    button.addEventListener('click', () => handleDebrisNotebookClick(button));
  });

  debrisToolboxButtons.forEach(button => {
    button.addEventListener('click', () => handleDebrisToolboxClick(button));
  });

  window.closeNotebookOverlay = closeNotebookOverlay;
  window.closeToolboxOverlay = closeToolboxOverlay;
})();
