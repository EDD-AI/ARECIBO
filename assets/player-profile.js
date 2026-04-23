(function () {
  const PROFILE_KEY = 'areciboPlayerProfile';
  const NAME_KEY = 'areciboPlayerName';
  const HEAD_COUNT = 24;
  const DEFAULT_PROFILE = {
    name: 'COCO',
    headId: 1,
    primaryColor: '#fcfcfc',
    secondaryColor: '#2f2925'
  };

  const HEAD_CACHE = new Map();

  const PRIMARY_PALETTE = [
    '#fcfcfc',
    '#f7ffc3',
    '#f4d7b5',
    '#e7c298',
    '#f1b9aa',
    '#bcd4ff',
    '#d5c2ff',
    '#bdf0da',
    '#ffd487',
    '#f6a56f'
  ];

  const SECONDARY_PALETTE = [
    '#2f2925',
    '#5b4031',
    '#7d5a44',
    '#1f1f22',
    '#4d2b1e',
    '#204265',
    '#3d2a67',
    '#214c39',
    '#6e4f13',
    '#7c2620'
  ];

  function clampHeadId(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DEFAULT_PROFILE.headId;
    return Math.min(HEAD_COUNT, Math.max(1, Math.round(number)));
  }

  function normalizeHex(value, fallback) {
    const source = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(source)) return source.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(source)) {
      const [, r, g, b] = source;
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return fallback;
  }

  function sanitizeName(value) {
    const cleaned = String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 10)
      .toUpperCase();
    return cleaned || DEFAULT_PROFILE.name;
  }

  function headPath(headId) {
    return `assets/animals/head-${String(clampHeadId(headId)).padStart(2, '0')}.svg`;
  }

  function loadPlayerProfile() {
    let rawProfile = null;
    try {
      rawProfile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    } catch (error) {
      rawProfile = null;
    }
    const storedName = localStorage.getItem(NAME_KEY);
    return {
      name: sanitizeName(rawProfile && rawProfile.name ? rawProfile.name : storedName || DEFAULT_PROFILE.name),
      headId: clampHeadId(rawProfile && rawProfile.headId),
      primaryColor: normalizeHex(rawProfile && rawProfile.primaryColor, DEFAULT_PROFILE.primaryColor),
      secondaryColor: normalizeHex(rawProfile && rawProfile.secondaryColor, DEFAULT_PROFILE.secondaryColor)
    };
  }

  function savePlayerProfile(profile) {
    const normalized = {
      name: sanitizeName(profile && profile.name),
      headId: clampHeadId(profile && profile.headId),
      primaryColor: normalizeHex(profile && profile.primaryColor, DEFAULT_PROFILE.primaryColor),
      secondaryColor: normalizeHex(profile && profile.secondaryColor, DEFAULT_PROFILE.secondaryColor)
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
    localStorage.setItem(NAME_KEY, normalized.name);
    return normalized;
  }

  async function fetchHeadSvg(headId) {
    const path = headPath(headId);
    if (HEAD_CACHE.has(path)) return HEAD_CACHE.get(path);
    const request = fetch(path)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        return response.text();
      });
    HEAD_CACHE.set(path, request);
    return request;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function colorizeHeadSvg(source, profile) {
    const primary = normalizeHex(profile.primaryColor, DEFAULT_PROFILE.primaryColor);
    const secondary = normalizeHex(profile.secondaryColor, DEFAULT_PROFILE.secondaryColor);
    return source
      .replace(/<\?xml[^>]*>/i, '')
      .replace(/#fcfcfc/gi, primary)
      .replace(/#2f2925/gi, secondary)
      .trim();
  }

  async function renderHeadSvg(profile, options = {}) {
    const merged = {
      ...DEFAULT_PROFILE,
      ...profile
    };
    try {
      const source = await fetchHeadSvg(merged.headId);
      const className = options.className ? ` class="${escapeHtml(options.className)}"` : '';
      const label = options.label || merged.name || 'avatar';
      return colorizeHeadSvg(source, merged).replace(
        /<svg\b/i,
        `<svg${className} role="img" aria-label="${escapeHtml(label)}"`
      );
    } catch (error) {
      return `<span class="${escapeHtml(options.fallbackClass || '')}">${escapeHtml((merged.name || 'P').slice(0, 1))}</span>`;
    }
  }

  window.AreciboPlayerProfile = {
    PROFILE_KEY,
    NAME_KEY,
    HEAD_COUNT,
    PRIMARY_PALETTE,
    SECONDARY_PALETTE,
    DEFAULT_PROFILE,
    headPath,
    loadPlayerProfile,
    savePlayerProfile,
    fetchHeadSvg,
    renderHeadSvg
  };
})();
