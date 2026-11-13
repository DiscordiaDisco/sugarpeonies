(() => {
  'use strict';
  if (document.getElementById('spUnderConstructionModal')) return;

  function mountModal() {
    if (document.getElementById('spUnderConstructionModal')) return;

    const style = document.createElement('style');
    style.id = 'spUnderConstructionStyles';
    style.textContent = `
      #spUnderConstructionModal {
        position: fixed;
        inset: 0;
        background: rgba(3, 3, 6, 0.78);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        box-sizing: border-box;
      }
      #spUnderConstructionModal.sp-active {
        opacity: 1;
        visibility: visible;
      }
      .sp-modal-card {
        background: linear-gradient(155deg, rgba(22, 10, 18, 0.97) 0%, rgba(9, 4, 11, 0.98) 100%);
        border: 1px solid rgba(255, 42, 133, 0.45);
        box-shadow:
          0 0 24px rgba(255, 42, 133, 0.32),
          0 0 54px rgba(255, 0, 127, 0.16),
          inset 0 0 18px rgba(255, 42, 133, 0.08),
          0 22px 48px rgba(0, 0, 0, 0.88);
        border-radius: 20px;
        max-width: 430px;
        width: 100%;
        padding: 30px 24px 24px;
        position: relative;
        color: #fff5fa;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        box-sizing: border-box;
        transform: scale(0.92) translateY(12px);
        transition: transform 0.32s cubic-bezier(0.2, 1.15, 0.3, 1);
      }
      #spUnderConstructionModal.sp-active .sp-modal-card {
        transform: scale(1) translateY(0);
      }
      .sp-modal-close-btn {
        position: absolute;
        top: 12px;
        right: 14px;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 42, 133, 0.28);
        color: #ff7eb3;
        font-size: 20px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.18s, color 0.18s, transform 0.18s, border-color 0.18s;
        padding: 0;
      }
      .sp-modal-close-btn:hover,
      .sp-modal-close-btn:focus-visible {
        background: rgba(255, 42, 133, 0.2);
        border-color: #ff2a85;
        color: #ffffff;
        transform: scale(1.08);
        outline: none;
      }
      .sp-modal-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(255, 42, 133, 0.14);
        border: 1px solid rgba(255, 42, 133, 0.45);
        color: #ff7eb3;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 14px;
        box-shadow: 0 0 12px rgba(255, 42, 133, 0.25);
      }
      .sp-modal-title {
        font-size: 1.55rem;
        font-weight: 800;
        letter-spacing: 0.02em;
        color: #ffffff;
        text-shadow:
          0 0 10px rgba(255, 42, 133, 0.8),
          0 0 24px rgba(255, 0, 127, 0.5);
        margin: 0 0 10px 0;
        line-height: 1.25;
      }
      .sp-modal-body {
        font-size: 0.92rem;
        line-height: 1.6;
        color: #e5b9d3;
        margin: 0 0 22px 0;
      }
      .sp-modal-enter-btn {
        width: 100%;
        min-height: 48px;
        padding: 13px 20px;
        border-radius: 999px;
        background: linear-gradient(135deg, #ff2a85 0%, #ff007f 100%);
        border: 1px solid #ff7eb3;
        color: #ffffff;
        font-weight: 700;
        font-size: 0.95rem;
        letter-spacing: 0.04em;
        cursor: pointer;
        box-shadow:
          0 0 18px rgba(255, 42, 133, 0.45),
          0 4px 16px rgba(0, 0, 0, 0.4);
        transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .sp-modal-enter-btn:hover,
      .sp-modal-enter-btn:focus-visible {
        transform: translateY(-2px);
        filter: brightness(1.1);
        box-shadow:
          0 0 26px rgba(255, 42, 133, 0.65),
          0 6px 20px rgba(0, 0, 0, 0.5);
        outline: none;
      }
      .sp-modal-enter-btn:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);

    const backdrop = document.createElement('div');
    backdrop.id = 'spUnderConstructionModal';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'spModalTitle');

    backdrop.innerHTML = `
      <div class="sp-modal-card">
        <button type="button" class="sp-modal-close-btn" id="spModalCloseBtn" aria-label="Close modal">&times;</button>
        <div class="sp-modal-badge">🌸 // ACTIVE PREVIEW &#10024;</div>
        <h2 class="sp-modal-title" id="spModalTitle">Under Construction</h2>
        <p class="sp-modal-body">
          Sugar Peonies is currently under active construction. You are previewing live interface prototypes, multimodal engineering notes, and responsive components.
        </p>
        <button type="button" class="sp-modal-enter-btn" id="spModalEnterBtn">
          <span>Enter Preview</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    `;

    document.body.appendChild(backdrop);

    function dismiss() {
      backdrop.classList.remove('sp-active');
      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
      }, 300);
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) dismiss();
    });

    const closeBtn = document.getElementById('spModalCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', dismiss);

    const enterBtn = document.getElementById('spModalEnterBtn');
    if (enterBtn) enterBtn.addEventListener('click', dismiss);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('sp-active')) {
        dismiss();
      }
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        backdrop.classList.add('sp-active');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountModal);
  } else {
    mountModal();
  }
})();
