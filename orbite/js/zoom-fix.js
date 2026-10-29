/* ORBITE — positions sous le zoom de l'écran de PC (v96).
 * Sur PC, les écrans sont agrandis par la propriété CSS zoom (css/desk.css). Les navigateurs récents
 * (Chrome 128+, Firefox 126+) mesurent alors les éléments en vrais pixels de l'écran ; Safari (et les
 * Chrome plus anciens) renvoient des mesures divisées par le zoom de l'élément. Le jeu dessine les
 * astres, le guide et les animations à partir de ces mesures : chez eux, tout était décalé. Ici, on
 * détecte l'ancien comportement et l'on remet getBoundingClientRect en vrais pixels. */
(function () {
  'use strict';
  if (typeof Element === 'undefined' || typeof DOMRect === 'undefined') return;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:10px;height:10px;zoom:2;visibility:hidden;pointer-events:none';
  (document.body || document.documentElement).appendChild(probe);
  const legacy = probe.getBoundingClientRect().width < 15;
  probe.remove();
  if (!legacy) return;
  const native = Element.prototype.getBoundingClientRect;
  // Le zoom propre de chaque élément, relu une fois par image : les astres d'une même liste partagent
  // leurs parents.
  let gen = 0;
  const cache = new WeakMap();
  const tick = () => { gen++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  function ownZoom(e) {
    const c = cache.get(e);
    if (c && c.gen === gen) return c.z;
    const z = parseFloat(getComputedStyle(e).zoom) || 1;
    cache.set(e, { gen, z });
    return z;
  }
  function zoomOf(el) {
    let z = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) z *= ownZoom(e);
    return z;
  }
  Element.prototype.getBoundingClientRect = function () {
    const r = native.call(this);
    const z = zoomOf(this);
    return z === 1 ? r : new DOMRect(r.left * z, r.top * z, r.width * z, r.height * z);
  };
  window.ORBITE_ZOOM_FIX = true;
})();
