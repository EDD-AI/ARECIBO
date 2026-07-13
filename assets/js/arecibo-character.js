/* ─── ARECIBO — ÉDITEUR DE PERSONNAGE ─────────────────────────────
   S'appuie sur assets/player-profile.js (AreciboPlayerProfile).
   Flow : menu → cette page (?next=join | ?next=host&sessionCode=XXXX)
   → lobby (join) ou intro (host). Sans param : retour menu. */

(() => {
  const api = window.AreciboPlayerProfile;
  if (!api) return;

  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '';
  const sessionCode = params.get('sessionCode') || '';

  const $ = id => document.getElementById(id);
  const idCardPortrait = $('idCardPortrait');
  const idCardName = $('idCardName');
  const idCardTrait = $('idCardTrait');
  const idCardSerial = $('idCardSerial');
  const idCardHeadNum = $('idCardHeadNum');
  const nameInput = $('nameInput');
  const headsGrid = $('headsGrid');
  const primarySwatches = $('primarySwatches');
  const secondarySwatches = $('secondarySwatches');
  const headPrev = $('headPrev');
  const headNext = $('headNext');
  const randomBtn = $('randomBtn');
  const backBtn = $('backBtn');
  const validateBtn = $('validateBtn');
  const transition = $('transition');
  const cursor = $('cursor');
  const starsCanvas = $('charStars');
  const characterSub = $('characterSub');

  let profile = api.loadPlayerProfile();
  let renderToken = 0;

  // Un « dossier » par tête : du pur flavor, déterministe.
  const TRAITS = [
    'Dort les yeux ouverts. L’équipage a arrêté de vérifier.',
    'A survécu à trois naufrages. N’en parle jamais. Fredonne beaucoup.',
    'Compte les rations. Toutes les rations. Même les vôtres.',
    'Ancien mineur de la Ceinture. Entend les métaux « chanter ».',
    'A un plan d’évasion pour chaque pièce. Y compris celle-ci.',
    'Parle aux machines. Jure que la console lui répond.',
    'Champion de bras de fer du secteur 7. Personne n’a vérifié.',
    'Note tout dans un carnet rouge. Le carnet a disparu.',
    'Refuse de tourner le dos aux sas. Sans explication.',
    'Cuisine des choses avec les rations. Des choses.',
    'A déjà vu ARECIBO. Enfin, c’est ce qui est écrit ici.',
    'Ne cligne des yeux qu’une fois par minute. Chronométré.',
    'Collectionne les boulons des vaisseaux qu’il a quittés.',
    'Chante en travaillant. L’équipage préfère les avaries.',
    'Peut dormir n’importe où. Surtout pendant les briefings.',
    'Répare les objets en les frappant deux fois. Jamais trois.',
    'A nommé chaque extincteur du bord. Les présente aux nouveaux.',
    'Lit l’avenir dans le marc de café synthétique.',
    'N’a jamais perdu au poker. N’a jamais montré ses cartes.',
    'Croit que le vide « écoute ». Chuchote près des hublots.',
    'Tient un registre des bruits suspects. 4 812 entrées.',
    'Sourit pendant les alarmes. C’est pire que tout.',
    'Garde une clé de 12 sur lui. « Au cas où. » Quel cas ?',
    'Dernier membre d’un équipage dont personne n’a entendu parler.'
  ];

  function playClick() {
    if (typeof window.playAreciboClickSound === 'function') window.playAreciboClickSound();
  }

  function serialFor(profileData) {
    let hash = 0;
    const source = `${profileData.name}-${profileData.headId}`;
    for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) % 9973;
    return `AR-REG-${String(hash).padStart(4, '0')}`;
  }

  function renderPortrait() {
    const token = ++renderToken;
    api.renderHeadSvg(profile, { label: profile.name }).then(svg => {
      if (token !== renderToken || !idCardPortrait) return;
      idCardPortrait.innerHTML = svg;
    }).catch(() => {});
  }

  function syncCard() {
    if (idCardName) idCardName.textContent = profile.name;
    if (idCardTrait) idCardTrait.textContent = TRAITS[(profile.headId - 1) % TRAITS.length];
    if (idCardSerial) idCardSerial.textContent = serialFor(profile);
    if (idCardHeadNum) idCardHeadNum.textContent = `${String(profile.headId).padStart(2, '0')}/${api.HEAD_COUNT}`;
    document.querySelectorAll('.head-choice').forEach(btn => {
      btn.classList.toggle('sel', Number(btn.dataset.headId) === profile.headId);
    });
    document.querySelectorAll('#primarySwatches .swatch').forEach(btn => {
      btn.classList.toggle('sel', btn.dataset.color === profile.primaryColor);
    });
    document.querySelectorAll('#secondarySwatches .swatch').forEach(btn => {
      btn.classList.toggle('sel', btn.dataset.color === profile.secondaryColor);
    });
    renderPortrait();
    save();
  }

  function save() {
    profile = api.savePlayerProfile(profile);
  }

  function setHead(headId) {
    const count = api.HEAD_COUNT;
    profile.headId = ((headId - 1 + count) % count) + 1;
    syncCard();
  }

  function buildHeadsGrid() {
    if (!headsGrid) return;
    for (let i = 1; i <= api.HEAD_COUNT; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'head-choice';
      btn.dataset.headId = String(i);
      btn.setAttribute('aria-label', `Tête ${i}`);
      const img = document.createElement('img');
      img.src = api.headPath(i);
      img.alt = '';
      img.loading = 'lazy';
      btn.appendChild(img);
      btn.addEventListener('click', () => {
        playClick();
        setHead(i);
      });
      headsGrid.appendChild(btn);
    }
  }

  function buildSwatches(container, palette, key) {
    if (!container) return;
    palette.forEach(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.dataset.color = color;
      btn.style.setProperty('--swatch', color);
      btn.setAttribute('aria-label', `Couleur ${color}`);
      btn.addEventListener('click', () => {
        playClick();
        profile[key] = color;
        syncCard();
      });
      container.appendChild(btn);
    });
  }

  function randomize() {
    profile.headId = 1 + Math.floor(Math.random() * api.HEAD_COUNT);
    profile.primaryColor = api.PRIMARY_PALETTE[Math.floor(Math.random() * api.PRIMARY_PALETTE.length)];
    profile.secondaryColor = api.SECONDARY_PALETTE[Math.floor(Math.random() * api.SECONDARY_PALETTE.length)];
    syncCard();
  }

  function navigateOut(url) {
    if (transition) transition.classList.add('active');
    window.setTimeout(() => { window.location.href = url; }, 420);
  }

  function destination() {
    if (next === 'join') return 'arecibo_lobby.html?v=multi-join';
    if (next === 'host' && sessionCode) {
      return `arecibo_intro.html?v=reboot-intro&sessionCode=${encodeURIComponent(sessionCode)}&mode=host`;
    }
    if (next === 'demo') return 'arecibo_demo.html';
    return 'arecibo_menu.html';
  }

  function bind() {
    if (nameInput) {
      nameInput.value = profile.name;
      nameInput.addEventListener('input', () => {
        profile.name = nameInput.value;
        const normalized = api.savePlayerProfile(profile);
        profile = { ...profile, name: normalized.name };
        if (idCardName) idCardName.textContent = normalized.name;
        if (idCardSerial) idCardSerial.textContent = serialFor(normalized);
      });
      nameInput.addEventListener('blur', () => {
        profile = api.loadPlayerProfile();
        nameInput.value = profile.name;
        syncCard();
      });
    }

    if (headPrev) headPrev.addEventListener('click', () => { playClick(); setHead(profile.headId - 1); });
    if (headNext) headNext.addEventListener('click', () => { playClick(); setHead(profile.headId + 1); });
    if (randomBtn) randomBtn.addEventListener('click', () => { playClick(); randomize(); });
    if (backBtn) backBtn.addEventListener('click', () => { playClick(); navigateOut('arecibo_menu.html'); });
    if (validateBtn) {
      validateBtn.addEventListener('click', () => {
        save();
        if (typeof window.playAreciboStartSound === 'function') window.playAreciboStartSound();
        navigateOut(destination());
      });
    }

    window.addEventListener('keydown', event => {
      if (document.activeElement === nameInput) return;
      if (event.key === 'ArrowLeft') setHead(profile.headId - 1);
      if (event.key === 'ArrowRight') setHead(profile.headId + 1);
    });

    window.addEventListener('mousemove', event => {
      if (!cursor) return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
  }

  // Fond étoilé discret.
  function drawStars() {
    if (!starsCanvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    starsCanvas.width = width * ratio;
    starsCanvas.height = height * ratio;
    const ctx = starsCanvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const count = Math.floor((width * height) / 6200);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = 0.16 + Math.random() * 0.5;
      ctx.fillStyle = '#f7ffc3';
      const size = Math.random() > 0.85 ? 2 : 1;
      ctx.fillRect(Math.random() * width, Math.random() * height, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function init() {
    if (characterSub && next === 'host' && sessionCode) {
      characterSub.textContent = `SESSION ${sessionCode} // IDENTIFIEZ-VOUS AVANT L'EMBARQUEMENT`;
    } else if (characterSub && next === 'join') {
      characterSub.textContent = 'IDENTIFIEZ-VOUS AVANT DE REJOINDRE L’ÉQUIPAGE';
    }
    buildHeadsGrid();
    buildSwatches(primarySwatches, api.PRIMARY_PALETTE, 'primaryColor');
    buildSwatches(secondarySwatches, api.SECONDARY_PALETTE, 'secondaryColor');
    bind();
    drawStars();
    syncCard();
  }

  window.addEventListener('resize', drawStars);
  init();
})();
