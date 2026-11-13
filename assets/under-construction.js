(() => {
  'use strict';
  if (document.getElementById('spUnderConstructionBanner')) return;

  function mountBanner() {
    if (document.getElementById('spUnderConstructionBanner')) return;

    const style = document.createElement('style');
    style.id = 'spUnderConstructionStyles';
    style.textContent = `
      #spUnderConstructionBanner {
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9000;
        pointer-events: none;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 5px 14px;
        background: rgba(14, 8, 20, 0.78);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 42, 133, 0.42);
        border-radius: 999px;
        box-shadow: 0 0 14px rgba(255, 42, 133, 0.22), 0 2px 10px rgba(0, 0, 0, 0.55);
        color: #ff7eb3;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        white-space: nowrap;
        user-select: none;
        -webkit-user-select: none;
        transition: opacity 0.3s ease;
      }
      #spUnderConstructionBanner .sp-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ff2a85;
        box-shadow: 0 0 6px #ff2a85;
        display: inline-block;
        animation: spPulse 2s infinite ease-in-out;
      }
      @keyframes spPulse {
        0%, 100% { opacity: 1; transform: scale(1);
        }
        50% { opacity: 0.45; transform: scale(0.8);
        }
      }
    `;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'spUnderConstructionBanner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.innerHTML = '<span class="sp-dot"></span><span>Under Construction &mdash; Preview Build</span>';

    document.body.appendChild(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountBanner);
  } else {
    mountBanner();
  }
})();
