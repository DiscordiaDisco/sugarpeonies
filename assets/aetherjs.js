/*!
 * Aether + Auto-Populating Gimbal Companion (/assets/aether.js)
 * Contract: sugarpeonies_aether_state | window.AETHER_MENU | [data-gimbal-label]
 */
(() => {
  "use strict";
  if (window.__AETHER_MOUNTED__) return;
  window.__AETHER_MOUNTED__ = true;

  const STORAGE_KEY = "sugarpeonies_aether_state";
  const CX = 230, CY = 230, VIEWBOX_SIZE = 460;
  const ORB_SIZE = 86, ORB_HALF = 43, PEEK_VISIBLE = 34;
  const MAGNET_THRESHOLD = 52;
  const DEFAULT_PALETTE = ["#22d3ee", "#ff3bd4", "#c084fc", "#34d399", "#fb923c", "#f472b6", "#38bdf8", "#a78bfa"];

  const RINGS = {
    outer:  { rIn: 152, rOut: 202, gap: 3 },
    middle: { rIn: 100, rOut: 146, gap: 4 },
    inner:  { rIn: 46,  rOut: 94,  gap: 3.5 }
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp  = (a, b, t) => a + (b - a) * t;
  const slug  = (s, i) => String(s || `item-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `item-${i}`;

  // =========================================================================
  // 1. MENU RESOLUTION (window.AETHER_MENU -> DOM Auto-Discovery -> Fallback)
  // =========================================================================
  const FALLBACK_MENU = {
    outer: [
      {
        id: "home", label: "Home", color: "#ff3bd4", href: "/",
        children: [
          { id: "home-top", label: "Welcome", href: "/#top" },
          { id: "home-featured", label: "Featured", href: "/#featured" },
          { id: "home-updates", label: "Updates", href: "/#updates" }
        ]
      },
      {
        id: "linkin", label: "Linkin.Love", color: "#22d3ee", href: "/linkin",
        children: [
          { id: "linkin-app", label: "Launch", href: "/linkin" },
          { id: "linkin-faq", label: "Linkin FAQ", href: "/linkin/faq" },
          { id: "linkin-guide", label: "Guide", href: "/linkin#guide" }
        ]
      },
      {
        id: "assets", label: "Assets", color: "#c084fc", href: "/assets",
        children: [
          { id: "assets-ui", label: "UI Kits", href: "/assets#ui" },
          { id: "assets-art", label: "Art", href: "/assets#art" }
        ]
      },
      {
        id: "about", label: "About", color: "#34d399", href: "/about",
        children: [
          { id: "about-studio", label: "Studio", href: "/about" },
          { id: "about-contact", label: "Contact", href: "/about#contact" }
        ]
      }
    ]
  };

  function normalizeNodes(list, prefix = "n") {
    if (!Array.isArray(list)) return [];
    return list.map((raw, i) => {
      const label = String(raw.label ?? raw.name ?? `Item ${i + 1}`);
      const id = String(raw.id || `${prefix}-${slug(label, i)}`);
      return {
        id,
        label,
        sublabel: raw.sublabel ? String(raw.sublabel) : undefined,
        color: raw.color || undefined,
        href: raw.href || undefined,
        onSelect: typeof raw.onSelect === "function" ? raw.onSelect : undefined,
        element: raw.element || undefined,
        children: Array.isArray(raw.children) ? normalizeNodes(raw.children, id) : undefined
      };
    });
  }

  function discoverDomMenu() {
    const els = Array.from(document.querySelectorAll("[data-gimbal-label]"));
    if (!els.length) return null;

    const buckets = { outer: [], middle: [], inner: [] };
    const byId = new Map();
    const pendingParents = [];

    els.forEach((el, idx) => {
      const label = (el.getAttribute("data-gimbal-label") || el.textContent || "").trim();
      if (!label) return;
      const ring = (el.getAttribute("data-gimbal-ring") || "outer").toLowerCase();
      const targetRing = ["outer", "middle", "inner"].includes(ring) ? ring : "outer";
      const id = el.getAttribute("data-gimbal-id") || el.id || `${targetRing}-${slug(label, idx)}`;
      const href = el.getAttribute("data-gimbal-href") || el.getAttribute("href") || undefined;
      const color = el.getAttribute("data-gimbal-color") || undefined;
      const parentId = el.getAttribute("data-gimbal-parent") || null;

      const node = {
        id,
        label,
        sublabel: el.getAttribute("data-gimbal-sub") || undefined,
        color,
        href,
        element: el,
        onSelect: (n) => {
          if (n.href) return; // href navigation handled by router
          if (n.element) {
            if (typeof n.element.click === "function") n.element.click();
            if (n.element.scrollIntoView) n.element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        },
        children: undefined
      };

      byId.set(id, node);
      if (parentId) {
        pendingParents.push({ node, parentId });
      } else {
        buckets[targetRing].push(node);
      }
    });

    pendingParents.forEach(({ node, parentId }) => {
      const p = byId.get(parentId);
      if (p) {
        if (!p.children) p.children = [];
        p.children.push(node);
      } else {
        buckets.middle.push(node);
      }
    });

    if (!buckets.outer.length && !buckets.middle.length && !buckets.inner.length) return null;
    return buckets;
  }

  function resolveMenuSource(customMenu = null) {
    let raw = customMenu || window.AETHER_MENU || discoverDomMenu() || FALLBACK_MENU;
    if (Array.isArray(raw)) raw = { outer: raw };
    return {
      outer:  normalizeNodes(raw.outer  || [], "o"),
      middle: normalizeNodes(raw.middle || [], "m"),
      inner:  normalizeNodes(raw.inner  || [], "i")
    };
  }

  // =========================================================================
  // 2. PERSISTENT STATE (sugarpeonies_aether_state)
  // =========================================================================
  function defaultState() {
    return {
      x: Math.max(180, window.innerWidth - 180),
      y: Math.max(180, window.innerHeight - 180),
      size: window.innerWidth < 600 ? 290 : 340,
      dock: null,
      minimized: true,
      activeRingIds: [null, null, null]
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const s = JSON.parse(raw);
      if (typeof s.x === "number" && Number.isFinite(s.x)) base.x = s.x;
      if (typeof s.y === "number" && Number.isFinite(s.y)) base.y = s.y;
      if (typeof s.size === "number" && Number.isFinite(s.size)) base.size = clamp(s.size, 210, 480);
      if (["left", "right", "top", "bottom", null].includes(s.dock)) base.dock = s.dock;
      if (typeof s.minimized === "boolean") base.minimized = s.minimized;
      if (Array.isArray(s.activeRingIds)) {
        base.activeRingIds = [s.activeRingIds[0] || null, s.activeRingIds[1] || null, s.activeRingIds[2] || null];
      }
    } catch (_) {}
    return base;
  }

  let state = loadState();
  let menu = resolveMenuSource();
  const rot = { outer: 0, middle: 0, inner: 0 };

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        x: Math.round(state.x),
        y: Math.round(state.y),
        size: Math.round(state.size),
        dock: state.dock,
        minimized: state.minimized,
        activeRingIds: state.activeRingIds
      }));
    } catch (_) {}
  }

  // Compute active list & index for each ring dynamically (supports hierarchical children OR flat rings)
  function computeActiveRings(ids = state.activeRingIds) {
    const outerList = menu.outer;
    let oIdx = outerList.findIndex(n => n.id === ids[0]);
    if (oIdx < 0) oIdx = outerList.length ? 0 : -1;
    const oNode = oIdx >= 0 ? outerList[oIdx] : null;

    const middleList = (oNode && oNode.children && oNode.children.length) ? oNode.children : menu.middle;
    let mIdx = middleList.findIndex(n => n.id === ids[1]);
    if (mIdx < 0) mIdx = middleList.length ? 0 : -1;
    const mNode = mIdx >= 0 ? middleList[mIdx] : null;

    const innerList = (mNode && mNode.children && mNode.children.length) ? mNode.children : menu.inner;
    let iIdx = innerList.findIndex(n => n.id === ids[2]);
    if (iIdx < 0) iIdx = innerList.length ? 0 : -1;
    const iNode = iIdx >= 0 ? innerList[iIdx] : null;

    return {
      outer:  { list: outerList,  idx: oIdx, node: oNode },
      middle: { list: middleList, idx: mIdx, node: mNode },
      inner:  { list: innerList,  idx: iIdx, node: iNode }
    };
  }

  // =========================================================================
  // 3. DOM INJECTION (ZERO HOST HTML REQUIRED)
  // =========================================================================
  function mountDOM() {
    const html = `
      <div class="aether-magnet-rail left"   id="aetherRailLeft"></div>
      <div class="aether-magnet-rail right"  id="aetherRailRight"></div>
      <div class="aether-magnet-rail top"    id="aetherRailTop"></div>
      <div class="aether-magnet-rail bottom" id="aetherRailBottom"></div>

      <div class="aether-companion-root aether-no-anim" id="aetherCompanionRoot" aria-label="Floating Gimbal Menu">
        <div class="aether-gimbal-glass"></div>
        <div class="aether-halo-wrap">
          <div class="aether-gimbal-tilt" id="aetherGimbalTilt">
            <svg class="aether-gimbal-svg" id="aetherGimbalSvg" viewBox="0 0 460 460">
              <defs>
                <filter id="aetherGimbalNeon" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <linearGradient id="aetherSightBeam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.42" />
                  <stop offset="100%" stop-color="#ff3bd4" stop-opacity="0" />
                </linearGradient>
              </defs>
              <circle cx="230" cy="230" r="222" fill="none" stroke="rgba(255,59,212,0.45)" stroke-width="1.3" class="aether-chassis-grab" filter="url(#aetherGimbalNeon)" />
              <circle cx="230" cy="230" r="218" fill="none" stroke="rgba(34,211,238,0.18)" stroke-width="0.7" pointer-events="none" />
              <g id="aetherBezelTicks" pointer-events="none"></g>
              <polygon points="216,18 244,18 234,185 226,185" fill="url(#aetherSightBeam)" pointer-events="none" />
              <polygon points="230,22 225,12 235,12" fill="#22d3ee" pointer-events="none" />
              <g class="aether-ring-group" id="aetherRingOuter"></g>
              <g class="aether-ring-group" id="aetherRingMiddle"></g>
              <g class="aether-ring-group" id="aetherRingInner"></g>
              <g id="aetherCoreHub" style="cursor:pointer;" filter="url(#aetherGimbalNeon)">
                <circle cx="230" cy="230" r="39" fill="rgba(12,8,24,0.62)" stroke="#ff3bd4" stroke-width="1.3" />
                <text x="230" y="223" class="aether-label-main" style="font-size:9px; fill:#22d3ee;">AETHER</text>
                <text x="230" y="237" class="aether-label-sub" id="aetherCoreLabel" style="font-size:8px; fill:#f5d0fe;">SPIN</text>
              </g>
            </svg>
          </div>
          <button class="aether-nub-btn aether-nub-collapse" id="aetherCollapseBtn" type="button" title="Collapse to Aether (Right-Click / Pinch-In)">—</button>
          <div class="aether-nub-btn aether-nub-resize" id="aetherResizeNub" title="Drag to resize (or Pinch)">⤢</div>
          <div class="aether-whisper" id="aetherWhisper">Drag rim to move · Right-click or pinch to tuck</div>
        </div>
      </div>

      <div class="aether-orb aether-no-anim" id="aetherOrb" data-stage="awake" role="button" tabindex="0" aria-label="Aether the Neon Gimbal Kitty — Click to open navigation">
        <div class="aether-frosted-lens"></div>
        <div class="aether-stage-wrap">
          <canvas class="aether-canvas" id="aetherCanvas" width="230" height="230"></canvas>
          <svg class="aether-svg" viewBox="0 0 200 200">
            <defs>
              <filter id="aetherNeonTube" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.1" result="b1" />
                <feGaussianBlur stdDeviation="4.6" result="b2" />
                <feMerge><feMergeNode in="b2" /><feMergeNode in="b1" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <mask id="aetherOccludeHead" maskUnits="userSpaceOnUse" x="-120" y="-120" width="440" height="440">
                <rect x="-120" y="-120" width="440" height="440" fill="white" />
                <circle id="aetherHeadMaskHole" cx="100" cy="100" r="37.5" fill="black" />
              </mask>
              <clipPath id="aetherLeftEyeClip">
                <path d="M 90 110 C 79 110, 67 104, 60 95 C 56 91, 54 87, 55 85 C 57 87, 60 88, 63 89 C 61 86, 61 84, 62 83 C 64 86, 67 88, 70 89 C 80 92, 87 100, 90 110 Z" />
              </clipPath>
              <clipPath id="aetherRightEyeClip">
                <path d="M 110 110 C 121 110, 133 104, 140 95 C 144 91, 146 87, 145 85 C 143 87, 140 88, 137 89 C 139 86, 139 84, 138 83 C 136 86, 133 88, 130 89 C 120 92, 113 100, 110 110 Z" />
              </clipPath>
            </defs>
            <g filter="url(#aetherNeonTube)" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <g class="aether-body-layer" mask="url(#aetherOccludeHead)">
                <path id="aetherLegFF"   stroke="#ff3bd4" stroke-width="1.35" opacity="0.78" />
                <path id="aetherLegHF"   stroke="#ff3bd4" stroke-width="1.35" opacity="0.78" />
                <path id="aetherTail"    stroke="#ff3bd4" stroke-width="1.5" />
                <path id="aetherTailC"   stroke="#22d3ee" stroke-width="1.0" opacity="0.7" />
                <path id="aetherSpine"   stroke="#ff3bd4" stroke-width="1.55" />
                <path id="aetherBelly"   stroke="#ff3bd4" stroke-width="1.5" />
                <path id="aetherLegFN"   stroke="#ff3bd4" stroke-width="1.55" />
                <path id="aetherLegHN"   stroke="#ff3bd4" stroke-width="1.55" />
                <g id="aetherBreathWisps" stroke="#22d3ee" stroke-width="1.15" opacity="0">
                  <line x1="30" y1="104" x2="21" y2="100" />
                  <line x1="28" y1="110" x2="18" y2="110" />
                  <line x1="30" y1="116" x2="22" y2="120" />
                </g>
              </g>
              <g id="aetherHeadGroup">
                <circle cx="100" cy="100" r="38" stroke="#ff3bd4" stroke-width="1.6" />
                <g class="aether-ears-whiskers">
                  <path d="M 67.5 80.5 Q 62 56 62 43 Q 73 51 86 64.5" stroke="#ff3bd4" stroke-width="1.6" />
                  <path d="M 132.5 80.5 Q 138 56 138 43 Q 127 51 114 64.5" stroke="#ff3bd4" stroke-width="1.6" />
                  <path d="M 71 76 Q 66.5 58 66.5 50 Q 75 56 82 65.5" stroke="#22d3ee" stroke-width="1.15" />
                  <path d="M 129 76 Q 133.5 58 133.5 50 Q 125 56 118 65.5" stroke="#22d3ee" stroke-width="1.15" />
                  <g stroke="#ff5ee0" stroke-width="1.05" opacity="0.88">
                    <path d="M 63 111 Q 50 109 37 111" /><path d="M 64 116 Q 50 115 36 119" /><path d="M 66 121 Q 53 121 41 126" />
                    <path d="M 137 111 Q 150 109 163 111" /><path d="M 136 116 Q 150 115 164 119" /><path d="M 134 121 Q 147 121 159 126" />
                    <circle cx="63" cy="111" r="0.9" fill="#ff5ee0" stroke="none" />
                    <circle cx="137" cy="111" r="0.9" fill="#ff5ee0" stroke="none" />
                  </g>
                </g>
                <g>
                  <path class="aether-nose" d="M 96.5 113 Q 100 112.2 103.5 113 L 100 116.8 Z" fill="#ff5ee0" stroke="#ff5ee0" stroke-width="0.6" />
                  <g class="aether-mouth-rest" stroke="#ff5ee0" stroke-width="1.35">
                    <path d="M 91.5 121.5 Q 95.8 125.5 100 121.5 Q 104.2 125.5 108.5 121.5" />
                    <path d="M 105.2 123 L 106.7 127 L 108.1 122.3" fill="rgba(255,59,212,0.18)" stroke-width="1.15" />
                  </g>
                  <g class="aether-mouth-yawn">
                    <ellipse id="aetherYawnOval" cx="100" cy="123" rx="3.8" ry="4.8" fill="rgba(255,59,212,0.12)" stroke="#ff5ee0" stroke-width="1.35" />
                    <path d="M 102.4 119.5 L 103.4 122 L 104.1 120" stroke="#ff5ee0" stroke-width="1" />
                  </g>
                  <g class="aether-eyes-open">
                    <g class="aether-eyes-blink">
                      <g clip-path="url(#aetherLeftEyeClip)">
                        <g id="aetherIrisLeft">
                          <g transform="rotate(-12 76 98)">
                            <path fill="rgba(34, 211, 238, 0.24)" fill-rule="evenodd" stroke="#38f2ff" stroke-width="1.25"
                              d="M 76 87.5 C 82 87.5, 84 93, 84 98 C 84 103, 82 108.5, 76 108.5 C 70 108.5, 68 103, 68 98 C 68 93, 70 87.5, 76 87.5 Z
                                 M 76 91 Q 78.8 98 76 105 Q 73.2 98 76 91 Z" />
                            <path d="M 76 91 Q 78.8 98 76 105 Q 73.2 98 76 91 Z" fill="none" stroke="#7cf3ff" stroke-width="0.9" />
                          </g>
                        </g>
                      </g>
                      <path d="M 90 110 C 79 110, 67 104, 60 95 C 56 91, 54 87, 55 85 C 57 87, 60 88, 63 89 C 61 86, 61 84, 62 83 C 64 86, 67 88, 70 89 C 80 92, 87 100, 90 110 Z" fill="none" stroke="#22d3ee" stroke-width="1.35" />
                      <g clip-path="url(#aetherRightEyeClip)">
                        <g id="aetherIrisRight">
                          <g transform="rotate(12 124 98)">
                            <path fill="rgba(34, 211, 238, 0.24)" fill-rule="evenodd" stroke="#38f2ff" stroke-width="1.25"
                              d="M 124 87.5 C 130 87.5, 132 93, 132 98 C 132 103, 130 108.5, 124 108.5 C 118 108.5, 116 103, 116 98 C 116 93, 118 87.5, 124 87.5 Z
                                 M 124 91 Q 126.8 98 124 105 Q 121.2 98 124 91 Z" />
                            <path d="M 124 91 Q 126.8 98 124 105 Q 121.2 98 124 91 Z" fill="none" stroke="#7cf3ff" stroke-width="0.9" />
                          </g>
                        </g>
                      </g>
                      <path d="M 110 110 C 121 110, 133 104, 140 95 C 144 91, 146 87, 145 85 C 143 87, 140 88, 137 89 C 139 86, 139 84, 138 83 C 136 86, 133 88, 130 89 C 120 92, 113 100, 110 110 Z" fill="none" stroke="#22d3ee" stroke-width="1.35" />
                    </g>
                  </g>
                  <g class="aether-eyes-happy" stroke="#22d3ee" stroke-width="1.55">
                    <path d="M 90 108 C 82 95, 70 90, 60 95 C 56 91, 54 87, 55 85 C 57 87, 60 88, 63 89 C 61 86, 61 84, 62 83" />
                    <path d="M 110 108 C 118 95, 130 90, 140 95 C 144 91, 146 87, 145 85 C 143 87, 140 88, 137 89 C 139 86, 139 84, 138 83" />
                  </g>
                  <g class="aether-eyes-closed" stroke="#22d3ee" stroke-width="1.55">
                    <path d="M 90 110 C 79 110, 67 104, 60 95 C 56 91, 54 87, 55 85 C 57 87, 60 88, 63 89 C 61 86, 61 84, 62 83" />
                    <path d="M 110 110 C 121 110, 133 104, 140 95 C 144 91, 146 87, 145 85 C 143 87, 140 88, 137 89 C 139 86, 139 84, 138 83" />
                  </g>
                </g>
              </g>
              <g class="aether-peek-paw" fill="none" stroke="#ff3bd4" stroke-width="1.3">
                <ellipse cx="74" cy="136" rx="6" ry="4.5" />
                <circle cx="71.8" cy="135.5" r="0.8" fill="#22d3ee" stroke="none" />
                <circle cx="74"   cy="134.2" r="0.8" fill="#22d3ee" stroke="none" />
                <circle cx="76.2" cy="135.5" r="0.8" fill="#22d3ee" stroke="none" />
              </g>
            </g>
          </svg>
        </div>
        <div class="aether-tip" id="aetherTip">Aether</div>
      </div>
    `;
    const host = document.createElement("div");
    host.id = "aetherSiteHost";
    host.innerHTML = html;
    document.body.appendChild(host);
  }

  // =========================================================================
  // 4. FLEXIBLE N-SECTOR SVG GIMBAL RENDERER
  // =========================================================================
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  function polarToXY(cx, cy, r, degFromTop) {
    const rad = (degFromTop - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeWedge(cx, cy, rIn, rOut, startDeg, endDeg) {
    const p1 = polarToXY(cx, cy, rOut, startDeg), p2 = polarToXY(cx, cy, rOut, endDeg);
    const p3 = polarToXY(cx, cy, rIn, endDeg),   p4 = polarToXY(cx, cy, rIn, startDeg);
    const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${rOut} ${rOut} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)} A ${rIn} ${rIn} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)} Z`;
  }

  function shortestAngle(current, targetIdx, count) {
    if (count <= 1) return 0;
    const step = 360 / count;
    const targetMod = -targetIdx * step;
    return current + (((targetMod - current) % 360 + 540) % 360 - 180);
  }

  function shortLabel(text, count) {
    const maxLen = count >= 8 ? 8 : count >= 6 ? 10 : 13;
    return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
  }

  function initCompanion() {
    mountDOM();

    const companionRoot = document.getElementById("aetherCompanionRoot");
    const aetherOrb     = document.getElementById("aetherOrb");
    const irisLeft      = document.getElementById("aetherIrisLeft");
    const irisRight     = document.getElementById("aetherIrisRight");
    const gimbalSvg     = document.getElementById("aetherGimbalSvg");
    const gimbalTilt    = document.getElementById("aetherGimbalTilt");
    const ringOuterEl   = document.getElementById("aetherRingOuter");
    const ringMiddleEl  = document.getElementById("aetherRingMiddle");
    const ringInnerEl   = document.getElementById("aetherRingInner");
    const coreLabelEl   = document.getElementById("aetherCoreLabel");
    const whisperEl     = document.getElementById("aetherWhisper");
    const aetherTipEl   = document.getElementById("aetherTip");

    const rails = {
      left: document.getElementById("aetherRailLeft"), right: document.getElementById("aetherRailRight"),
      top:  document.getElementById("aetherRailTop"),  bottom: document.getElementById("aetherRailBottom")
    };
    const highlightRail = (edge) => { for (const [k, el] of Object.entries(rails)) el.classList.toggle("active", k === edge); };

    // Static bezel ticks
    const bezelTicks = document.getElementById("aetherBezelTicks");
    for (let d = 0; d < 360; d += 6) {
      const major = d % 30 === 0;
      const p1 = polarToXY(CX, CY, major ? 206 : 209, d), p2 = polarToXY(CX, CY, 214, d);
      bezelTicks.appendChild(svgEl("line", {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: major ? "rgba(255,59,212,0.45)" : "rgba(34,211,238,0.16)",
        "stroke-width": major ? 1.1 : 0.7
      }));
    }

    // Dynamic Ring Renderer (supports 0, 1, 2, 3, 4, 5, 6, 8+ sectors cleanly!)
    function renderRing(container, ringKey, items, activeIdx, previewIdx, ringRot, fillBase, accentColor) {
      const { rIn, rOut, gap } = RINGS[ringKey];
      const count = items.length;
      container.innerHTML = "";
      container.style.transform = `rotate(${ringRot}deg)`;

      if (count === 0) {
        container.appendChild(svgEl("circle", {
          cx: CX, cy: CY, r: (rIn + rOut) / 2,
          fill: "none", stroke: "rgba(255,255,255,0.06)", "stroke-width": 1, "stroke-dasharray": "4 6"
        }));
        return;
      }

      const step = 360 / count;
      const fontSize = count >= 8 ? "8.5px" : count >= 6 ? "9.5px" : "10.5px";

      items.forEach((item, idx) => {
        const midDeg = idx * step;
        const halfSpan = count === 1 ? 178 : step / 2 - gap / 2;
        const startDeg = midDeg - halfSpan;
        const endDeg   = midDeg + halfSpan;
        const isSelected = idx === activeIdx;
        const isScrub    = idx === previewIdx;
        const nodeColor  = item.color || accentColor;

        container.appendChild(svgEl("path", {
          d: describeWedge(CX, CY, rIn, rOut, startDeg, endDeg),
          class: `aether-wedge ${isSelected ? "active" : ""} ${isScrub ? "scrub-target" : ""}`,
          fill: isSelected ? `${nodeColor}2b` : fillBase,
          stroke: isSelected ? nodeColor : "rgba(255,255,255,0.12)",
          "stroke-width": isSelected ? 1.45 : 0.8
        }));

        const labelPos = polarToXY(CX, CY, (rIn + rOut) / 2, midDeg);
        const labelGroup = svgEl("g", {
          class: "aether-upright-label",
          style: `transform: rotate(${-ringRot}deg); transform-origin: ${labelPos.x}px ${labelPos.y}px;`
        });

        if (item.sublabel) {
          const t1 = svgEl("text", { x: labelPos.x, y: labelPos.y - 5, class: "aether-label-sub", style: `fill:${nodeColor};` });
          t1.textContent = item.sublabel;
          const t2 = svgEl("text", { x: labelPos.x, y: labelPos.y + 6, class: "aether-label-main", style: `font-size:${fontSize};` });
          t2.textContent = shortLabel(item.label, count);
          labelGroup.append(t1, t2);
        } else {
          const t = svgEl("text", { x: labelPos.x, y: labelPos.y, class: "aether-label-main", style: `font-size:${fontSize};` });
          t.textContent = shortLabel(item.label, count);
          labelGroup.appendChild(t);
        }
        container.appendChild(labelGroup);
      });
    }

    function updateGimbalUI(previewIds = null) {
      const rings = computeActiveRings(previewIds || state.activeRingIds);
      const activeNode = rings.inner.node || rings.middle.node || rings.outer.node;
      const accent = (rings.outer.node && rings.outer.node.color)
        || (rings.middle.node && rings.middle.node.color)
        || DEFAULT_PALETTE[Math.max(0, rings.outer.idx) % DEFAULT_PALETTE.length];

      companionRoot.style.setProperty("--aether-accent", accent);
      aetherOrb.style.setProperty("--aether-accent", accent);

      renderRing(ringOuterEl,  "outer",  rings.outer.list,  rings.outer.idx,  previewIds ? rings.outer.idx  : -1, rot.outer,  "rgba(23,15,46,0.34)", accent);
      renderRing(ringMiddleEl, "middle", rings.middle.list, rings.middle.idx, previewIds ? rings.middle.idx : -1, rot.middle, "rgba(18,12,38,0.34)", accent);
      renderRing(ringInnerEl,  "inner",  rings.inner.list,  rings.inner.idx,  previewIds ? rings.inner.idx  : -1, rot.inner,  "rgba(13,8,28,0.38)",  accent);

      const trail = [rings.outer.node, rings.middle.node, rings.inner.node].filter(Boolean).map(n => n.label);
      const trailText = trail.join(" › ") || "Menu";
      coreLabelEl.textContent = activeNode ? shortLabel(activeNode.label, 8) : "SPIN";
      whisperEl.textContent = trailText;
      aetherTipEl.textContent = `Aether · ${trailText}`;
    }

    function navigateNode(node, ringKey) {
      if (!node) return;
      if (node.onSelect) node.onSelect(node, { ring: ringKey, state: { ...state } });
      if (node.href) {
        if (node.href.startsWith("#")) {
          const target = document.querySelector(node.href);
          if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          window.location.assign(node.href);
        }
      }
    }

    function selectRingIndex(ringKey, idx, fromScrub = false) {
      const rings = computeActiveRings(state.activeRingIds);
      const targetList = rings[ringKey].list;
      if (!targetList.length || idx < 0 || idx >= targetList.length) return;

      const picked = targetList[idx];
      const wasAlreadySelected = state.activeRingIds[["outer", "middle", "inner"].indexOf(ringKey)] === picked.id;

      if (ringKey === "outer") {
        state.activeRingIds[0] = picked.id;
        const mList = (picked.children && picked.children.length) ? picked.children : menu.middle;
        state.activeRingIds[1] = mList.length ? mList[0].id : null;
        const m0 = mList[0];
        const iList = (m0 && m0.children && m0.children.length) ? m0.children : menu.inner;
        state.activeRingIds[2] = iList.length ? iList[0].id : null;
      } else if (ringKey === "middle") {
        state.activeRingIds[1] = picked.id;
        const iList = (picked.children && picked.children.length) ? picked.children : menu.inner;
        state.activeRingIds[2] = iList.length ? iList[0].id : null;
      } else {
        state.activeRingIds[2] = picked.id;
      }

      const next = computeActiveRings(state.activeRingIds);
      rot.outer  = shortestAngle(rot.outer,  Math.max(0, next.outer.idx),  Math.max(1, next.outer.list.length));
      rot.middle = shortestAngle(rot.middle, Math.max(0, next.middle.idx), Math.max(1, next.middle.list.length));
      rot.inner  = shortestAngle(rot.inner,  Math.max(0, next.inner.idx),  Math.max(1, next.inner.list.length));

      saveState();
      updateGimbalUI();

      // Navigate immediately if leaf, or if re-tapping an already-active parent with href, or if onSelect exists
      const hasChildren = picked.children && picked.children.length > 0;
      if (fromScrub || !hasChildren || wasAlreadySelected || ringKey === "inner") {
        navigateNode(picked, ringKey);
      } else if (picked.onSelect && !picked.href) {
        picked.onSelect(picked, { ring: ringKey, state: { ...state } });
      }
    }

    // =========================================================================
    // 5. GEOMETRY & DOCKING
    // =========================================================================
    function applyGeometry() {
      const margin = 12;
      if (!state.minimized) {
        const half = state.size / 2;
        const cx = clamp(state.x, half + margin, window.innerWidth - half - margin);
        const cy = clamp(state.y, half + margin, window.innerHeight - half - margin);
        companionRoot.style.width  = `${state.size}px`;
        companionRoot.style.height = `${state.size}px`;
        companionRoot.style.left   = `${cx - half}px`;
        companionRoot.style.top    = `${cy - half}px`;
      } else {
        aetherOrb.classList.remove("docked", "dock-left", "dock-right", "dock-top", "dock-bottom");
        if (state.dock) {
          aetherOrb.classList.add("docked", `dock-${state.dock}`);
          const tucked = ORB_SIZE - PEEK_VISIBLE;
          if (state.dock === "left") {
            state.y = clamp(state.y, ORB_HALF + margin, window.innerHeight - ORB_HALF - margin);
            aetherOrb.style.left = `${-tucked}px`; aetherOrb.style.top = `${state.y - ORB_HALF}px`;
          } else if (state.dock === "right") {
            state.y = clamp(state.y, ORB_HALF + margin, window.innerHeight - ORB_HALF - margin);
            aetherOrb.style.left = `${window.innerWidth - PEEK_VISIBLE}px`; aetherOrb.style.top = `${state.y - ORB_HALF}px`;
          } else if (state.dock === "top") {
            state.x = clamp(state.x, ORB_HALF + margin, window.innerWidth - ORB_HALF - margin);
            aetherOrb.style.left = `${state.x - ORB_HALF}px`; aetherOrb.style.top = `${-tucked}px`;
          } else if (state.dock === "bottom") {
            state.x = clamp(state.x, ORB_HALF + margin, window.innerWidth - ORB_HALF - margin);
            aetherOrb.style.left = `${state.x - ORB_HALF}px`; aetherOrb.style.top = `${window.innerHeight - PEEK_VISIBLE}px`;
          }
        } else {
          state.x = clamp(state.x, ORB_HALF + margin, window.innerWidth - ORB_HALF - margin);
          state.y = clamp(state.y, ORB_HALF + margin, window.innerHeight - ORB_HALF - margin);
          aetherOrb.style.left = `${state.x - ORB_HALF}px`; aetherOrb.style.top = `${state.y - ORB_HALF}px`;
        }
      }
    }

    function setMinimized(shouldMinimize) {
      clearStageTimers();
      autoSequenceLock = false;
      lastInteractionTime = Date.now();
      state.minimized = shouldMinimize;
      if (shouldMinimize) {
        companionRoot.classList.add("is-hidden");
        aetherOrb.classList.remove("is-hidden");
        setAetherStage("awake");
        spawnGasBurst("condense");
      } else {
        aetherOrb.classList.add("is-hidden");
        companionRoot.classList.remove("is-hidden");
      }
      applyGeometry();
      saveState();
    }

    // =========================================================================
    // 6. AETHER KITTY ANIMATION ENGINE (ORGANIC CUBIC BEZIERS + SMOKE + GAZE)
    // =========================================================================
    const aetherCanvas     = document.getElementById("aetherCanvas");
    const ctx              = aetherCanvas.getContext("2d");
    const aetherHeadGroup  = document.getElementById("aetherHeadGroup");
    const headMaskHole     = document.getElementById("aetherHeadMaskHole");
    const yawnOval         = document.getElementById("aetherYawnOval");
    const breathWisps      = document.getElementById("aetherBreathWisps");
    const pathLegFF        = document.getElementById("aetherLegFF");
    const pathLegHF        = document.getElementById("aetherLegHF");
    const pathTail         = document.getElementById("aetherTail");
    const pathTailC        = document.getElementById("aetherTailC");
    const pathSpine        = document.getElementById("aetherSpine");
    const pathBelly        = document.getElementById("aetherBelly");
    const pathLegFN        = document.getElementById("aetherLegFN");
    const pathLegHN        = document.getElementById("aetherLegHN");

    function lerpBezierPath(a, b, t) {
      const n = a.map((v, i) => lerp(v, b[i], t));
      let d = `M ${n[0].toFixed(1)} ${n[1].toFixed(1)}`;
      for (let i = 2; i < n.length; i += 6) {
        d += ` C ${n[i].toFixed(1)} ${n[i+1].toFixed(1)}, ${n[i+2].toFixed(1)} ${n[i+3].toFixed(1)}, ${n[i+4].toFixed(1)} ${n[i+5].toFixed(1)}`;
      }
      return d;
    }

    const STRETCH_A = {
      head: [-22, 6, 0.66, -4],
      spine: [88,88, 108,82, 128,74, 146,84, 152,88, 155,95, 152,104],
      belly: [76,120, 88,128, 104,124, 118,112, 124,107, 128,108, 130,114],
      legFN: [84,116, 74,129, 54,132, 36,132, 30,132, 30,137, 37,137, 56,137, 74,135, 92,124],
      legFF: [76,116, 66,126, 52,128, 42,128, 37,128, 37,132, 43,132, 56,132, 68,130, 82,122],
      legHN: [130,114, 126,124, 126,131, 124,136, 120,138, 122,141, 129,140, 134,134, 136,122, 140,108],
      legHF: [152,104, 155,116, 152,126, 148,134, 144,136, 145,139, 152,138, 156,130, 158,116, 152,100],
      tail:  [146,84, 162,64, 158,38, 142,32, 133,29, 127,36, 133,42],
      tailC: [148,80, 160,62, 155,41, 142,35]
    };

    const STRETCH_B = {
      head: [-27, 12, 0.66, -14],
      spine: [84,92, 108,94, 130,70, 148,80, 155,85, 157,94, 154,104],
      belly: [70,126, 86,135, 106,126, 120,110, 126,105, 130,107, 132,114],
      legFN: [80,120, 68,133, 46,135, 25,135, 19,135, 19,140, 27,140, 50,139, 72,136, 90,126],
      legFF: [72,120, 60,130, 44,131, 32,131, 27,131, 27,135, 34,135, 48,135, 64,132, 80,124],
      legHN: [132,114, 128,125, 128,132, 126,137, 122,139, 124,142, 131,141, 136,134, 138,120, 142,106],
      legHF: [154,104, 157,116, 154,127, 150,135, 146,137, 147,140, 154,139, 158,130, 160,114, 154,98],
      tail:  [148,80, 166,58, 160,30, 144,26, 135,24, 129,31, 136,37],
      tailC: [150,76, 163,56, 157,34, 144,29]
    };

    const WALK_A = {
      head: [-28, -2, 0.62, -2],
      spine: [84,88, 96,94, 114,93, 132,93, 144,93, 150,97, 152,105],
      belly: [74,114, 74,123, 78,127, 84,127, 98,129, 116,128, 128,122],
      legFN: [84,124, 80,131, 77,136, 78,141, 79,144, 84,144, 86,140, 88,135, 91,130, 93,124],
      legFF: [86,125, 85,134, 83,142, 79,146, 75,148, 80,150, 87,148, 90,141, 92,133, 95,125],
      legHN: [128,122, 126,131, 128,139, 124,146, 120,148, 125,150, 132,148, 136,139, 142,132, 148,122],
      legHF: [152,105, 156,118, 150,129, 146,136, 142,142, 142,148, 148,148, 154,145, 158,128, 154,108],
      tail:  [150,98, 168,94, 176,72, 170,54, 165,40, 152,38, 144,46],
      tailC: [152,94, 166,88, 172,70, 167,54]
    };

    const WALK_B = {
      head: [-26, 0, 0.62, 2],
      spine: [86,90, 98,95, 115,94, 132,94, 144,94, 150,98, 152,106],
      belly: [76,116, 76,124, 80,128, 86,128, 100,130, 116,128, 128,123],
      legFN: [84,125, 83,134, 81,142, 77,146, 73,148, 78,150, 85,148, 89,141, 91,133, 94,125],
      legFF: [88,124, 84,131, 81,136, 82,141, 83,144, 88,144, 90,140, 92,135, 94,130, 96,124],
      legHN: [128,123, 130,132, 134,139, 132,146, 128,148, 133,150, 139,148, 142,139, 148,131, 150,118],
      legHF: [152,106, 154,119, 146,129, 138,136, 134,142, 134,148, 140,148, 146,144, 152,126, 152,106],
      tail:  [150,99, 166,95, 173,73, 166,55, 161,42, 148,40, 141,49],
      tailC: [152,95, 164,89, 169,71, 164,55]
    };

    const CURL_DOWN = {
      head: [-20, 18, 0.65, 8],
      spine: [90,104, 104,102, 124,102, 138,108, 148,113, 154,122, 152,134],
      belly: [78,134, 82,142, 92,144, 104,144, 118,144, 132,144, 142,142],
      legFN: [84,132, 76,136, 70,140, 72,144, 74,147, 82,147, 88,145, 94,143, 96,138, 96,134],
      legFF: [88,134, 82,138, 78,141, 80,144, 82,146, 88,146, 92,144, 96,142, 98,138, 98,134],
      legHN: [122,134, 116,138, 114,143, 118,146, 122,148, 132,148, 138,145, 144,141, 148,134, 146,124],
      legHF: [148,124, 152,132, 150,140, 144,144, 140,146, 144,148, 149,146, 153,142, 155,133, 152,126],
      tail:  [152,134, 158,144, 148,151, 132,150, 118,149, 108,148, 100,145],
      tailC: [150,136, 153,144, 144,149, 130,148]
    };

    function applyBodyBlend(a, b, t) {
      pathSpine.setAttribute("d",  lerpBezierPath(a.spine, b.spine, t));
      pathBelly.setAttribute("d",  lerpBezierPath(a.belly, b.belly, t));
      pathLegFN.setAttribute("d",  lerpBezierPath(a.legFN, b.legFN, t));
      pathLegFF.setAttribute("d",  lerpBezierPath(a.legFF, b.legFF, t));
      pathLegHN.setAttribute("d",  lerpBezierPath(a.legHN, b.legHN, t));
      pathLegHF.setAttribute("d",  lerpBezierPath(a.legHF, b.legHF, t));
      pathTail.setAttribute("d",   lerpBezierPath(a.tail,  b.tail,  t));
      pathTailC.setAttribute("d",  lerpBezierPath(a.tailC, b.tailC, t));
      return {
        tx: lerp(a.head[0], b.head[0], t),
        ty: lerp(a.head[1], b.head[1], t),
        ts: lerp(a.head[2], b.head[2], t),
        tr: lerp(a.head[3], b.head[3], t)
      };
    }

    const gasParticles = [];
    function spawnGasBurst(kind) {
      const count = kind === "dissipate" ? 38 : kind === "nose" ? 12 : 24;
      for (let i = 0; i < count; i++) {
        const color = Math.random() < 0.42 ? "34, 211, 238" : "255, 59, 212";
        let x = 115, y = 115, vx = 0, vy = 0;
        if (kind === "nose") {
          x = 115 + (Math.random() - 0.5) * 6; y = 130 + (Math.random() - 0.5) * 4;
          vx = 0.35 + Math.random() * 0.55; vy = -0.25 - Math.random() * 0.45;
        } else if (kind === "dissipate") {
          const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 38;
          x = 115 + Math.cos(a) * r; y = 115 + Math.sin(a) * r;
          vx = 0.34 + Math.random() * 0.78; vy = -0.22 - Math.random() * 0.65;
        } else {
          const a = Math.random() * Math.PI * 2, r = 64 + Math.random() * 24;
          x = 115 + Math.cos(a) * r; y = 115 + Math.sin(a) * r;
          vx = -Math.cos(a) * (0.65 + Math.random() * 0.5); vy = -Math.sin(a) * (0.65 + Math.random() * 0.5);
        }
        gasParticles.push({
          x, y, vx, vy, r: (kind === "dissipate" ? 1.6 : 1.3) + Math.random() * 2.2,
          alpha: 0.85, decay: 0.011 + Math.random() * 0.011, wobble: Math.random() * Math.PI * 2, color
        });
      }
    }

    const gazeTarget = { x: 0, y: 0 }, gazeCurrent = { x: 0, y: 0 };
    let lastGazeInputAt = performance.now();

    function aimGazeAt(clientX, clientY) {
      lastGazeInputAt = performance.now();
      const rect = aetherOrb.getBoundingClientRect();
      const orbCx = rect.left + rect.width / 2, orbCy = rect.top + rect.height / 2;
      const dx = clientX - orbCx, dy = clientY - orbCy, dist = Math.hypot(dx, dy);
      if (dist < 4) { gazeTarget.x = 0; gazeTarget.y = 0; }
      else {
        const s = Math.min(1, dist / 220);
        gazeTarget.x = (dx / dist) * 7.8 * s;
        gazeTarget.y = (dy / dist) * 5.5 * s;
      }
    }

    const headAnim = { x: 0, y: 0, scale: 1, rot: 0 };
    let stageEnteredAt = performance.now();
    let mode = null;

    function renderKineticFrame(now) {
      ctx.clearRect(0, 0, 230, 230);
      const stage = aetherOrb.getAttribute("data-stage");

      if (state.minimized && stage === "sleep" && Math.random() < 0.12) {
        const angle = -0.7 + Math.random() * 1.4;
        gasParticles.push({
          x: 115 + Math.cos(angle) * 42, y: 115 + Math.sin(angle) * 42,
          vx: 0.28 + Math.random() * 0.35, vy: -0.18 - Math.random() * 0.25,
          r: 1.4 + Math.random() * 1.6, alpha: 0.55, decay: 0.008,
          wobble: Math.random() * Math.PI * 2, color: Math.random() < 0.5 ? "34, 211, 238" : "255, 59, 212"
        });
      }

      for (let i = gasParticles.length - 1; i >= 0; i--) {
        const p = gasParticles[i];
        p.wobble += 0.08;
        p.x += p.vx + Math.sin(p.wobble) * 0.16;
        p.y += p.vy + Math.cos(p.wobble * 0.8) * 0.12;
        p.alpha -= p.decay;
        if (p.alpha <= 0) { gasParticles.splice(i, 1); continue; }
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.2);
        grad.addColorStop(0, `rgba(${p.color}, ${p.alpha.toFixed(2)})`);
        grad.addColorStop(0.5, `rgba(${p.color}, ${(p.alpha * 0.35).toFixed(2)})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2); ctx.fill();
      }

      if (now - lastGazeInputAt > 7000 && stage === "awake") {
        gazeTarget.x = lerp(gazeTarget.x, 0, 0.015);
        gazeTarget.y = lerp(gazeTarget.y, 0, 0.015);
      }
      gazeCurrent.x = lerp(gazeCurrent.x, gazeTarget.x, 0.18);
      gazeCurrent.y = lerp(gazeCurrent.y, gazeTarget.y, 0.18);
      const irisTx = `translate(${gazeCurrent.x.toFixed(2)} ${gazeCurrent.y.toFixed(2)})`;
      irisLeft.setAttribute("transform", irisTx);
      irisRight.setAttribute("transform", irisTx);

      const elapsed = (now - stageEnteredAt) / 1000;
      let targetHead = { tx: 0, ty: 0, ts: 1, tr: 0 };

      if (stage === "stretch") {
        const loop = (elapsed % 3.8) / 3.8;
        const reach = 0.5 - 0.5 * Math.cos(loop * Math.PI * 2);
        const yawnAmt = clamp(Math.sin(clamp((loop - 0.2) / 0.58, 0, 1) * Math.PI), 0, 1);
        targetHead = applyBodyBlend(STRETCH_A, STRETCH_B, reach);
        yawnOval.setAttribute("rx", (2.6 + 1.8 * yawnAmt).toFixed(2));
        yawnOval.setAttribute("ry", (1.6 + 3.8 * yawnAmt).toFixed(2));
        breathWisps.setAttribute("opacity", (yawnAmt * 0.9).toFixed(2));
      } else if (stage === "turning") {
        breathWisps.setAttribute("opacity", "0");
        const cycle = (elapsed % 4.6) / 4.6;
        if (cycle < 0.62) {
          const walkBlend = 0.5 - 0.5 * Math.cos((cycle / 0.62) * Math.PI * 4);
          targetHead = applyBodyBlend(WALK_A, WALK_B, walkBlend);
        } else {
          const lieT = clamp((cycle - 0.62) / 0.3, 0, 1);
          const lieEase = lieT * lieT * (3 - 2 * lieT);
          targetHead = applyBodyBlend(WALK_A, CURL_DOWN, lieEase);
        }
      } else {
        breathWisps.setAttribute("opacity", "0");
      }

      headAnim.x     = lerp(headAnim.x, targetHead.tx, 0.14);
      headAnim.y     = lerp(headAnim.y, targetHead.ty, 0.14);
      headAnim.scale = lerp(headAnim.scale, targetHead.ts, 0.14);
      headAnim.rot   = lerp(headAnim.rot, targetHead.tr, 0.14);

      const cx = 100 + headAnim.x, cy = 100 + headAnim.y;
      aetherHeadGroup.setAttribute("transform",
        `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${headAnim.rot.toFixed(2)}) scale(${headAnim.scale.toFixed(4)}) translate(-100 -100)`
      );
      headMaskHole.setAttribute("cx", cx.toFixed(2));
      headMaskHole.setAttribute("cy", cy.toFixed(2));
      headMaskHole.setAttribute("r", (37.6 * headAnim.scale).toFixed(2));

      requestAnimationFrame(renderKineticFrame);
    }
    requestAnimationFrame(renderKineticFrame);

    let stageTimers = [], lastInteractionTime = Date.now(), autoSequenceLock = false;
    function clearStageTimers() { stageTimers.forEach(t => clearTimeout(t)); stageTimers = []; }

    function setAetherStage(stageName) {
      const prev = aetherOrb.getAttribute("data-stage");
      if (prev !== stageName) stageEnteredAt = performance.now();
      aetherOrb.setAttribute("data-stage", stageName);
      if (stageName === "sleep" && prev !== "sleep") {
        spawnGasBurst("dissipate");
        stageTimers.push(setTimeout(() => {
          if (aetherOrb.getAttribute("data-stage") === "sleep") spawnGasBurst("nose");
        }, 850));
      } else if (stageName === "awake" && prev !== "awake") {
        spawnGasBurst("condense");
      }
    }

    setInterval(() => {
      if (!state.minimized || mode || autoSequenceLock) return;
      const idleSec = (Date.now() - lastInteractionTime) / 1000;
      if (idleSec > 16 && aetherOrb.getAttribute("data-stage") === "awake") {
        autoSequenceLock = true;
        setAetherStage("stretch");
        stageTimers.push(setTimeout(() => { if (state.minimized && !mode) setAetherStage("turning"); }, 3900));
        stageTimers.push(setTimeout(() => { if (state.minimized && !mode) setAetherStage("sleep"); autoSequenceLock = false; }, 8500));
      }
    }, 3000);

    // =========================================================================
    // 7. INTERACTIONS: SCRUB, MOVE, RESIZE, PINCH, FLICK-DOCK, GAZE
    // =========================================================================
    const activePointers = new Map();
    let pinchState = null, dragCtx = {};

    function pointerToPolar(clientX, clientY) {
      const rect = gimbalSvg.getBoundingClientRect(), scale = VIEWBOX_SIZE / rect.width;
      const x = (clientX - rect.left) * scale - CX, y = (clientY - rect.top) * scale - CY;
      return { r: Math.hypot(x, y), deg: ((Math.atan2(y, x) * 180 / Math.PI) + 90 + 360) % 360 };
    }

    function hitTestRing(r, deg) {
      let ringKey = null;
      if (r >= 150 && r <= 204) ringKey = "outer";
      else if (r >= 98 && r < 150) ringKey = "middle";
      else if (r >= 44 && r < 98) ringKey = "inner";
      if (!ringKey) return null;

      const rings = computeActiveRings(state.activeRingIds);
      const count = rings[ringKey].list.length;
      if (count === 0) return null;
      if (count === 1) return { ringKey, idx: 0 };

      const step = 360 / count;
      const localDeg = ((deg - rot[ringKey]) % 360 + 360) % 360;
      return { ringKey, idx: Math.round(localDeg / step) % count };
    }

    function startPinchIfTwoPointers() {
      if (activePointers.size !== 2) return false;
      const pts = [...activePointers.values()];
      mode = "pinch";
      companionRoot.classList.remove("is-scrubbing", "dragging-window");
      aetherOrb.classList.remove("dragging-window");
      highlightRail(null);
      pinchState = { startDist: Math.max(Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), 10), startSize: state.size, triggered: false };
      return true;
    }

    function detectMagneticEdge(cx, cy, vx = 0, vy = 0) {
      const dLeft = cx - ORB_HALF, dRight = window.innerWidth - (cx + ORB_HALF);
      const dTop = cy - ORB_HALF, dBottom = window.innerHeight - (cy + ORB_HALF);
      if (Math.hypot(vx, vy) > 0.52) {
        if (vx < -0.42 && dLeft < 145) return "left";
        if (vx >  0.42 && dRight < 145) return "right";
        if (vy < -0.42 && dTop < 145) return "top";
        if (vy >  0.42 && dBottom < 145) return "bottom";
      }
      const hits = [
        { edge: "left", d: dLeft }, { edge: "right", d: dRight },
        { edge: "top", d: dTop },   { edge: "bottom", d: dBottom }
      ].filter(c => c.d <= MAGNET_THRESHOLD);
      return hits.length ? hits.sort((a, b) => a.d - b.d)[0].edge : null;
    }

    companionRoot.addEventListener("pointerdown", (e) => {
      if (e.button === 2) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (startPinchIfTwoPointers() || e.target.closest("#aetherCollapseBtn")) return;

      if (e.target.closest("#aetherResizeNub")) {
        mode = "resize"; companionRoot.setPointerCapture(e.pointerId); companionRoot.classList.add("dragging-window");
        dragCtx = { startX: e.clientX, startY: e.clientY, startSize: state.size }; return;
      }
      if (e.target.closest("#aetherCoreHub")) { mode = "core"; return; }

      const { r, deg } = pointerToPolar(e.clientX, e.clientY), hit = hitTestRing(r, deg);
      if (hit) {
        mode = "scrub"; companionRoot.setPointerCapture(e.pointerId);
        dragCtx = {
          moved: false, startX: e.clientX, startY: e.clientY,
          downRing: hit.ringKey, downIdx: hit.idx,
          previewIds: [...state.activeRingIds],
          scrubRing: hit.ringKey, scrubIdx: hit.idx
        };
      } else if (r > 204 && r <= 232) {
        mode = "move-gimbal"; companionRoot.setPointerCapture(e.pointerId); companionRoot.classList.add("dragging-window");
        const rect = companionRoot.getBoundingClientRect();
        dragCtx = { startX: e.clientX, startY: e.clientY, startCx: rect.left + rect.width / 2, startCy: rect.top + rect.height / 2 };
      }
    });

    companionRoot.addEventListener("pointermove", (e) => {
      if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === "pinch" && activePointers.size === 2 && pinchState && !pinchState.triggered) {
        const pts = [...activePointers.values()];
        const ratio = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / pinchState.startDist;
        if (ratio < 0.58) { pinchState.triggered = true; setMinimized(true); }
        else { state.size = clamp(pinchState.startSize * ratio, 210, 480); applyGeometry(); saveState(); }
        return;
      }
      if (mode === "move-gimbal") {
        state.dock = null;
        state.x = dragCtx.startCx + (e.clientX - dragCtx.startX);
        state.y = dragCtx.startCy + (e.clientY - dragCtx.startY);
        applyGeometry(); return;
      }
      if (mode === "resize") {
        state.size = clamp(dragCtx.startSize + ((e.clientX - dragCtx.startX) + (e.clientY - dragCtx.startY)) * 1.1, 210, 480);
        applyGeometry(); return;
      }
      if (mode === "scrub") {
        if (!dragCtx.moved && Math.hypot(e.clientX - dragCtx.startX, e.clientY - dragCtx.startY) > 7) {
          dragCtx.moved = true; companionRoot.classList.add("is-scrubbing");
        }
        if (!dragCtx.moved) return;

        const { r, deg } = pointerToPolar(e.clientX, e.clientY), hit = hitTestRing(r, deg);
        if (!hit) return;

        const rings = computeActiveRings(dragCtx.previewIds);
        const list = rings[hit.ringKey].list;
        const picked = list[hit.idx];
        if (!picked) return;

        const rIdx = ["outer", "middle", "inner"].indexOf(hit.ringKey);
        if (dragCtx.previewIds[rIdx] !== picked.id) {
          dragCtx.previewIds[rIdx] = picked.id;
          if (hit.ringKey === "outer") {
            const mList = (picked.children && picked.children.length) ? picked.children : menu.middle;
            dragCtx.previewIds[1] = mList[0] ? mList[0].id : null;
            const iList = (mList[0] && mList[0].children && mList[0].children.length) ? mList[0].children : menu.inner;
            dragCtx.previewIds[2] = iList[0] ? iList[0].id : null;
          } else if (hit.ringKey === "middle") {
            const iList = (picked.children && picked.children.length) ? picked.children : menu.inner;
            dragCtx.previewIds[2] = iList[0] ? iList[0].id : null;
          }
          dragCtx.scrubRing = hit.ringKey;
          dragCtx.scrubIdx = hit.idx;
          updateGimbalUI(dragCtx.previewIds);
        }
      }
    });

    function endCompanionPointer(e) {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2 && mode === "pinch") { mode = null; pinchState = null; return; }
      companionRoot.classList.remove("is-scrubbing", "dragging-window");
      if (mode === "move-gimbal" || mode === "resize") {
        const rect = companionRoot.getBoundingClientRect();
        state.x = rect.left + rect.width / 2; state.y = rect.top + rect.height / 2; saveState();
      } else if (mode === "core") {
        // Spin to a random node across current menu!
        if (menu.outer.length) {
          const o = menu.outer[Math.floor(Math.random() * menu.outer.length)];
          const mList = (o.children && o.children.length) ? o.children : menu.middle;
          const m = mList.length ? mList[Math.floor(Math.random() * mList.length)] : null;
          const iList = (m && m.children && m.children.length) ? m.children : menu.inner;
          const inn = iList.length ? iList[Math.floor(Math.random() * iList.length)] : null;
          state.activeRingIds = [o.id, m ? m.id : null, inn ? inn.id : null];
          const next = computeActiveRings(state.activeRingIds);
          rot.outer  = shortestAngle(rot.outer,  Math.max(0, next.outer.idx),  Math.max(1, next.outer.list.length));
          rot.middle = shortestAngle(rot.middle, Math.max(0, next.middle.idx), Math.max(1, next.middle.list.length));
          rot.inner  = shortestAngle(rot.inner,  Math.max(0, next.inner.idx),  Math.max(1, next.inner.list.length));
          saveState(); updateGimbalUI();
        }
      } else if (mode === "scrub") {
        if (dragCtx.moved) {
          state.activeRingIds = [...dragCtx.previewIds];
          const next = computeActiveRings(state.activeRingIds);
          rot.outer  = shortestAngle(rot.outer,  Math.max(0, next.outer.idx),  Math.max(1, next.outer.list.length));
          rot.middle = shortestAngle(rot.middle, Math.max(0, next.middle.idx), Math.max(1, next.middle.list.length));
          rot.inner  = shortestAngle(rot.inner,  Math.max(0, next.inner.idx),  Math.max(1, next.inner.list.length));
          saveState(); updateGimbalUI();
          navigateNode(next[dragCtx.scrubRing].node, dragCtx.scrubRing);
        } else {
          selectRingIndex(dragCtx.downRing, dragCtx.downIdx, false);
        }
      }
      mode = null;
    }
    companionRoot.addEventListener("pointerup", endCompanionPointer);
    companionRoot.addEventListener("pointercancel", endCompanionPointer);

    // Aether Orb Events
    aetherOrb.addEventListener("pointerdown", (e) => {
      if (e.button === 2) return;
      clearStageTimers(); autoSequenceLock = false; lastInteractionTime = Date.now();
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (startPinchIfTwoPointers()) return;
      mode = "move-orb"; aetherOrb.setPointerCapture(e.pointerId);
      const rect = aetherOrb.getBoundingClientRect();
      dragCtx = {
        moved: false, startX: e.clientX, startY: e.clientY,
        startCx: rect.left + rect.width / 2, startCy: rect.top + rect.height / 2,
        lastX: e.clientX, lastY: e.clientY, lastT: performance.now(), vx: 0, vy: 0
      };
    });

    aetherOrb.addEventListener("pointermove", (e) => {
      if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (mode === "pinch" && activePointers.size === 2 && pinchState && !pinchState.triggered) {
        const pts = [...activePointers.values()];
        if (Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) / pinchState.startDist > 1.45) {
          pinchState.triggered = true; setMinimized(false);
        }
        return;
      }
      if (mode === "move-orb") {
        if (!dragCtx.moved && Math.hypot(e.clientX - dragCtx.startX, e.clientY - dragCtx.startY) > 6) {
          dragCtx.moved = true; state.dock = null; setAetherStage("awake");
          aetherOrb.classList.add("dragging-window");
          aetherOrb.classList.remove("docked", "dock-left", "dock-right", "dock-top", "dock-bottom");
        }
        if (dragCtx.moved) {
          const now = performance.now(), dt = Math.max(now - dragCtx.lastT, 8);
          dragCtx.vx = (e.clientX - dragCtx.lastX) / dt; dragCtx.vy = (e.clientY - dragCtx.lastY) / dt;
          dragCtx.lastX = e.clientX; dragCtx.lastY = e.clientY; dragCtx.lastT = now;
          state.x = clamp(dragCtx.startCx + (e.clientX - dragCtx.startX), ORB_HALF, window.innerWidth - ORB_HALF);
          state.y = clamp(dragCtx.startCy + (e.clientY - dragCtx.startY), ORB_HALF, window.innerHeight - ORB_HALF);
          aetherOrb.style.left = `${state.x - ORB_HALF}px`; aetherOrb.style.top = `${state.y - ORB_HALF}px`;
          highlightRail(detectMagneticEdge(state.x, state.y, dragCtx.vx, dragCtx.vy));
        }
      }
    });

    function endOrbPointer(e) {
      activePointers.delete(e.pointerId);
      aetherOrb.classList.remove("dragging-window"); highlightRail(null);
      if (mode === "pinch") { if (activePointers.size < 2) { mode = null; pinchState = null; } return; }
      if (mode === "move-orb") {
        if (!dragCtx.moved) setMinimized(false);
        else {
          const edge = detectMagneticEdge(state.x, state.y, dragCtx.vx, dragCtx.vy);
          state.dock = edge;
          if (edge === "left") state.x = PEEK_VISIBLE;
          if (edge === "right") state.x = window.innerWidth - PEEK_VISIBLE;
          if (edge === "top") state.y = PEEK_VISIBLE;
          if (edge === "bottom") state.y = window.innerHeight - PEEK_VISIBLE;
          applyGeometry(); setAetherStage(edge ? "sleep" : "awake"); saveState();
        }
      }
      mode = null;
    }
    aetherOrb.addEventListener("pointerup", endOrbPointer);
    aetherOrb.addEventListener("pointercancel", endOrbPointer);

    aetherOrb.addEventListener("pointerenter", () => {
      if (autoSequenceLock) return;
      lastInteractionTime = Date.now();
      if (aetherOrb.getAttribute("data-stage") === "sleep") setAetherStage("awake");
    });

    aetherOrb.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMinimized(false); }
    });

    companionRoot.addEventListener("contextmenu", (e) => { e.preventDefault(); setMinimized(true); });
    aetherOrb.addEventListener("contextmenu", (e) => { e.preventDefault(); setMinimized(false); });
    document.getElementById("aetherCollapseBtn").addEventListener("click", () => setMinimized(true));

    function handleTrackpadPinch(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (!state.minimized) {
        state.size -= e.deltaY * 2.2;
        if (state.size < 185) { state.size = 290; setMinimized(true); }
        else { state.size = clamp(state.size, 210, 480); applyGeometry(); saveState(); }
      } else if (e.deltaY < -6) setMinimized(false);
    }
    companionRoot.addEventListener("wheel", handleTrackpadPinch, { passive: false });
    aetherOrb.addEventListener("wheel", handleTrackpadPinch, { passive: false });

    window.addEventListener("pointerdown", (e) => {
      if (!e.target.closest("#aetherOrb") && state.minimized) {
        lastInteractionTime = Date.now();
        aimGazeAt(e.clientX, e.clientY);
      }
    });

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse") {
        if (!state.minimized && !mode) {
          const rect = companionRoot.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const nx = (e.clientX - rect.left) / rect.width - 0.5, ny = (e.clientY - rect.top) / rect.height - 0.5;
            gimbalTilt.style.transform = `rotateX(${(-ny * 10).toFixed(2)}deg) rotateY(${(nx * 10).toFixed(2)}deg)`;
          } else gimbalTilt.style.transform = "rotateX(0deg) rotateY(0deg)";
        }
        if (state.minimized && aetherOrb.getAttribute("data-stage") === "awake") aimGazeAt(e.clientX, e.clientY);
      }
    });

    window.addEventListener("resize", applyGeometry);

    // =========================================================================
    // 8. BOOT AT SAVED COORDINATES & EXPOSE PUBLIC API
    // =========================================================================
    const initialRings = computeActiveRings(state.activeRingIds);
    state.activeRingIds = [
      initialRings.outer.node  ? initialRings.outer.node.id  : null,
      initialRings.middle.node ? initialRings.middle.node.id : null,
      initialRings.inner.node  ? initialRings.inner.node.id  : null
    ];
    rot.outer  = initialRings.outer.list.length  > 1 ? -Math.max(0, initialRings.outer.idx)  * (360 / initialRings.outer.list.length)  : 0;
    rot.middle = initialRings.middle.list.length > 1 ? -Math.max(0, initialRings.middle.idx) * (360 / initialRings.middle.list.length) : 0;
    rot.inner  = initialRings.inner.list.length  > 1 ? -Math.max(0, initialRings.inner.idx)  * (360 / initialRings.inner.list.length)  : 0;

    if (state.minimized) {
      companionRoot.classList.add("is-hidden");
      aetherOrb.classList.remove("is-hidden");
      setAetherStage(state.dock ? "sleep" : "awake");
    } else {
      aetherOrb.classList.add("is-hidden");
      companionRoot.classList.remove("is-hidden");
    }

    applyGeometry();
    updateGimbalUI();

    // Remove boot transition lock on next animation frame so saved spot mounts instantaneously
    requestAnimationFrame(() => {
      companionRoot.classList.remove("aether-no-anim");
      aetherOrb.classList.remove("aether-no-anim");
    });

    window.AetherGimbal = {
      open: () => setMinimized(false),
      close: () => setMinimized(true),
      setStage: (stage) => { if (!state.minimized) setMinimized(true); setAetherStage(stage); },
      setMenu: (customMenu) => {
        menu = resolveMenuSource(customMenu);
        const r = computeActiveRings(state.activeRingIds);
        state.activeRingIds = [
          r.outer.node ? r.outer.node.id : null,
          r.middle.node ? r.middle.node.id : null,
          r.inner.node ? r.inner.node.id : null
        ];
        rot.outer  = shortestAngle(rot.outer,  Math.max(0, r.outer.idx),  Math.max(1, r.outer.list.length));
        rot.middle = shortestAngle(rot.middle, Math.max(0, r.middle.idx), Math.max(1, r.middle.list.length));
        rot.inner  = shortestAngle(rot.inner,  Math.max(0, r.inner.idx),  Math.max(1, r.inner.list.length));
        updateGimbalUI();
      },
      refresh: () => window.AetherGimbal.setMenu(null),
      getState: () => ({ ...state })
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCompanion);
  } else {
    initCompanion();
  }
})();