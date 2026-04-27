(function () {
  const html = `
    <div id="settings-overlay" onclick="if(event.target===this)window.closeAreciboSettings()">
      <div class="settings-panel">
        <div class="sp-header">
          <button class="sp-close" type="button" data-settings-close>x</button>
          <span class="sp-title">MENU // SETTINGS //</span>
        </div>
        <div class="sp-body">
          <div>
            <div class="sp-section-label">Son</div>
            <div class="sp-slider-row">
              <span class="sp-slider-label">Volume général</span>
	              <input type="range" min="0" max="100" value="80" data-settings-value="sv1" data-audio-setting="master" data-default="80">
              <span class="sp-val" id="sv1">80%</span>
            </div>
            <div class="sp-slider-row">
              <span class="sp-slider-label">Musique</span>
	              <input type="range" min="0" max="100" value="60" data-settings-value="sv2" data-audio-setting="music" data-default="60">
              <span class="sp-val" id="sv2">60%</span>
            </div>
            <div class="sp-slider-row">
              <span class="sp-slider-label">Effets sonores</span>
	              <input type="range" min="0" max="100" value="60" data-settings-value="sv3" data-audio-setting="effects" data-default="60">
              <span class="sp-val" id="sv3">60%</span>
            </div>
          </div>
	          <div>
	            <div class="sp-section-label">Langues</div>
	            <div class="sp-lang-row">
	              <button class="lang-btn sel" type="button">FR</button>
	              <button class="lang-btn disabled" type="button" disabled aria-disabled="true" title="Bientot disponible">EN</button>
	              <button class="lang-btn disabled" type="button" disabled aria-disabled="true" title="Bientot disponible">SP</button>
	            </div>
	          </div>
	          <div>
	            <div class="sp-section-label">Filtre pixel</div>
	            <div class="sp-pixel-row" data-pixel-dither-group>
	              <button class="pixel-btn" type="button" data-pixel-dither="off">OFF</button>
	              <button class="pixel-btn" type="button" data-pixel-dither="normal">NORMAL</button>
	              <button class="pixel-btn sel" type="button" data-pixel-dither="strong">FORT</button>
	            </div>
	          </div>
	          <div>
            <div class="sp-section-label">Données</div>
            <div class="sp-toggle-row">
              <span class="sp-toggle-label">sauvegarde automatique</span>
              <div class="sp-toggle on" role="switch" aria-checked="true"></div>
            </div>
            <div class="sp-toggle-row">
              <span class="sp-toggle-label">Données de session</span>
              <div class="sp-toggle on" role="switch" aria-checked="true"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (!overlay) return;
    const panel = overlay.querySelector('.settings-panel');
    if (panel) panel.classList.remove('visible');
    setTimeout(() => overlay.classList.remove('open'), 320);
  }

	  function openSettings(event) {
	    if (event) event.preventDefault();
	    const overlay = document.getElementById('settings-overlay');
	    if (!overlay) return;
	    overlay.classList.add('open');
	    syncPixelDitherButtons(overlay);
	    setTimeout(() => overlay.querySelector('.settings-panel').classList.add('visible'), 10);
	  }

  function placeTab(tab) {
    const back = document.querySelector('.back-btn');
    if (!back) {
      tab.style.left = '5.8vw';
      tab.style.bottom = '6.8vh';
      return;
    }

    const rect = back.getBoundingClientRect();
    tab.style.left = `${Math.round(rect.right + 10)}px`;
    if (rect.top < window.innerHeight / 2) {
      tab.style.top = `${Math.round(rect.top)}px`;
    } else {
      tab.style.bottom = `${Math.max(24, Math.round(window.innerHeight - rect.bottom))}px`;
    }
  }

  function boot() {
    if (document.getElementById('settings-overlay')) return;
    document.body.insertAdjacentHTML('beforeend', html);

    const tab = document.createElement('button');
    tab.id = 'arecibo-settings-tab';
    tab.type = 'button';
    tab.textContent = '< SETTINGS';
    tab.addEventListener('click', openSettings);
    document.body.appendChild(tab);
    placeTab(tab);
    window.addEventListener('resize', () => placeTab(tab));

	    document.querySelector('[data-settings-close]').addEventListener('click', closeSettings);
	    document.querySelectorAll('[data-settings-value]').forEach(input => {
	      const fallback = Number(input.dataset.default || input.value || 0);
	      let value = fallback;
	      try {
	        const stored = Number(localStorage.getItem(`areciboAudioVolume:${input.dataset.audioSetting}`));
	        if (Number.isFinite(stored)) value = Math.max(0, Math.min(100, stored));
	      } catch (err) {}
	      input.value = value;
	      const valueNode = document.getElementById(input.dataset.settingsValue);
	      if (valueNode) valueNode.textContent = `${value}%`;
	      input.addEventListener('input', () => {
	        const liveValueNode = document.getElementById(input.dataset.settingsValue);
	        if (liveValueNode) liveValueNode.textContent = `${input.value}%`;
	        if (input.dataset.audioSetting) {
	          try { localStorage.setItem(`areciboAudioVolume:${input.dataset.audioSetting}`, String(input.value)); }
	          catch (err) {}
	          window.dispatchEvent(new CustomEvent('arecibo-audio-settings-change', {
	            detail: { setting: input.dataset.audioSetting, value: Number(input.value) || 0 }
	          }));
	        }
	      });
	    });
	    document.querySelectorAll('.sp-lang-row .lang-btn').forEach(button => {
	      button.addEventListener('click', () => {
	        if (button.disabled || button.classList.contains('disabled')) return;
	        button.closest('.sp-lang-row').querySelectorAll('.lang-btn').forEach(item => item.classList.remove('sel'));
	        button.classList.add('sel');
	      });
	    });
	    document.querySelectorAll('[data-pixel-dither-group] .pixel-btn').forEach(button => {
	      button.addEventListener('click', () => {
	        const row = button.closest('[data-pixel-dither-group]');
	        if (row) row.querySelectorAll('.pixel-btn').forEach(item => item.classList.remove('sel'));
	        button.classList.add('sel');
	        if (typeof window.setAreciboPixelDither === 'function') {
	          window.setAreciboPixelDither(button.dataset.pixelDither);
	        }
	      });
	    });
	    document.querySelectorAll('.sp-toggle').forEach(toggle => {
	      toggle.addEventListener('click', () => {
	        toggle.classList.toggle('on');
	        toggle.setAttribute('aria-checked', toggle.classList.contains('on') ? 'true' : 'false');
	      });
	    });
	    window.addEventListener('arecibo-pixel-dither-change', () => syncPixelDitherButtons(document));
	    document.addEventListener('keydown', event => {
	      if (event.key === 'Escape') closeSettings();
	    });
	    syncPixelDitherButtons(document);
	  }

	  function syncPixelDitherButtons(root) {
	    const current = typeof window.getAreciboPixelDither === 'function'
	      ? window.getAreciboPixelDither()
	      : 'strong';
	    (root || document).querySelectorAll('[data-pixel-dither-group] .pixel-btn').forEach(button => {
	      button.classList.toggle('sel', button.dataset.pixelDither === current);
	    });
	  }

  window.openAreciboSettings = openSettings;
  window.closeAreciboSettings = closeSettings;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
