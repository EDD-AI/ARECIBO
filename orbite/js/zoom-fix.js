/* ORBITE — positions sous le zoom de l'écran de PC (v96, revu en v97).
 * Sur PC, les écrans sont agrandis par la propriété CSS zoom (css/desk.css). Les navigateurs récents
 * (Chrome 128+, Firefox 126+) mesurent alors les éléments en vrais pixels de l'écran ; Safari (et les
 * Chrome plus anciens) renvoient des mesures divisées par le zoom. Le jeu dessine les astres, le guide
 * et les animations à partir de ces mesures : chez eux, tout était décalé. Ici, on détecte l'ancien
 * comportement et l'on remet getBoundingClientRect en vrais pixels.
 *
 * v97 : Safari donne pour zoom, dans getComputedStyle, le zoom cumulé de l'élément (et non le sien) :
 * multiplier les zooms des parents zoomait plusieurs fois. Dans le jeu, aucun écran zoomé n'est dans
 * un autre : le zoom d'un élément est donc le plus grand de ceux de sa chaîne de parents, quelle que
 * soit la façon dont le navigateur l'écrit. Et la correction est vérifiée sur une sonde avant d'être
 * appliquée : si elle ne retombe pas juste, on ne touche à rien. */
(function () {
  'use strict';
  if (typeof Element === 'undefined' || typeof DOMRect === 'undefined') return;
  const native = Element.prototype.getBoundingClientRect;
  // Le zoom d'un élément : le plus grand de sa chaîne (relu une fois par image, les astres d'une même
  // liste partagent leurs parents).
  let gen = 0;
  const cache = new WeakMap();
  function ownZoom(e) {
    const c = cache.get(e);
    if (c && c.gen === gen) return c.z;
    const z = parseFloat(getComputedStyle(e).zoom) || 1;
    cache.set(e, { gen, z });
    return z;
  }
  function zoomOf(el) {
    let z = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) z = Math.max(z, ownZoom(e));
    return z;
  }
  // Sonde : un parent zoomé ×2 et, dedans, un carré de 10 px (20 vrais pixels de large).
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;zoom:2;visibility:hidden;pointer-events:none';
  probe.innerHTML = '<div style="width:10px;height:10px;margin-left:5px"></div>';
  (document.body || document.documentElement).appendChild(probe);
  const kid = probe.firstChild;
  const r = native.call(kid);
  const legacy = r.width > 0 && r.width < 15;
  const fixed = legacy ? r.width * zoomOf(kid) : 0;
  probe.remove();
  window.ORBITE_ZOOM = { legacy, width: r.width, fixed };
  if (!legacy || Math.abs(fixed - 20) > 1) return;
  const tick = () => { gen++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  Element.prototype.getBoundingClientRect = function () {
    const b = native.call(this);
    const z = zoomOf(this);
    return z === 1 ? b : new DOMRect(b.left * z, b.top * z, b.width * z, b.height * z);
  };
  window.ORBITE_ZOOM_FIX = true;
})();
