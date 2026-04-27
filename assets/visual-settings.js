(function () {
  const PIXEL_DITHER_KEY = 'areciboPixelDither';
  const VALID_PIXEL_DITHER = new Set(['off', 'normal', 'strong']);

  function normalizePixelDither(mode) {
    return VALID_PIXEL_DITHER.has(mode) ? mode : 'strong';
  }

  function readPixelDither() {
    try {
      return normalizePixelDither(localStorage.getItem(PIXEL_DITHER_KEY));
    } catch (err) {
      return 'strong';
    }
  }

  function applyPixelDither(mode) {
    const normalized = normalizePixelDither(mode);
    document.documentElement.dataset.pixelDither = normalized;
    return normalized;
  }

  window.getAreciboPixelDither = function () {
    return readPixelDither();
  };

  window.setAreciboPixelDither = function (mode) {
    const normalized = applyPixelDither(mode);
    try {
      localStorage.setItem(PIXEL_DITHER_KEY, normalized);
    } catch (err) {}
    window.dispatchEvent(new CustomEvent('arecibo-pixel-dither-change', {
      detail: { mode: normalized }
    }));
    return normalized;
  };

  applyPixelDither(readPixelDither());
})();
