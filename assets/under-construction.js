(function () {
  if (document.getElementById('sp-uc-blurb')) return;
  function mountBlurb() {
    if (document.getElementById('sp-uc-blurb')) return;
    var style = document.createElement('style');
    style.textContent = [
      '#sp-uc-blurb {',
      '  position: relative;',
      '  z-index: 900;',
      '  width: fit-content;',
      '  max-width: calc(100% - 24px);',
      '  margin: 10px auto 4px;',
      '  padding: 6px 14px;',
      '  border-radius: 999px;',
      '  background: rgba(24, 10, 20, 0.82);',
      '  border: 1px solid rgba(255, 105, 180, 0.45);',
      '  box-shadow: 0 2px 12px rgba(255, 77, 166, 0.18);',
      '  color: #ffd6eb;',
      '  font: 500 12.5px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  letter-spacing: 0.02em;',
      '  text-align: center;',
      '  backdrop-filter: blur(8px);',
      '  -webkit-backdrop-filter: blur(8px);',
      '}',
      '#sp-uc-blurb strong { color: #ff6ec7; font-weight: 700; margin-right: 4px; }'
    ].join('\n');
    document.head.appendChild(style);
    var bar = document.createElement('div');
    bar.id = 'sp-uc-blurb';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<strong>✦ Under Construction:</strong> Early preview build — pages & links are actively being wired up.';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBlurb);
  } else {
    mountBlurb();
  }
})();
