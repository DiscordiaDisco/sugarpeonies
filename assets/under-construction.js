(function () {
  if (document.getElementById('sp-uc-blurb')) return;
  function injectBlurb() {
    if (document.getElementById('sp-uc-blurb') || !document.body) return;
    var style = document.createElement('style');
    style.textContent = '#sp-uc-blurb{width:100%;box-sizing:border-box;background:rgba(20,10,18,0.88);border-bottom:1px solid rgba(255,92,175,0.35);color:#ffd6eb;font-family:system-ui,-apple-system,sans-serif;font-size:12.5px;line-height:1.4;padding:6px 14px;text-align:center;letter-spacing:0.02em;z-index:20;position:relative;}#sp-uc-blurb strong{color:#ff5caf;font-weight:600;}';
    document.head.appendChild(style);
    var bar = document.createElement('div');
    bar.id = 'sp-uc-blurb';
    bar.setAttribute('role', 'status');
    bar.innerHTML = '<strong>Under Construction:</strong> Sugar Peonies is currently being dressed &amp; wired up — pardon our dust while we finish building.';
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBlurb);
  } else {
    injectBlurb();
  }
})();
