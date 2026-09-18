// ============================================================
// flow-player-4 styles.
//
// V4 ships the entire runtime (JS + CSS) from a single CDN module.
// The Webflow tree only contains structural shells (`.vp-slot`,
// `.vp-poster`, `.vp-play`, and — in `uiMode=webflow` — the
// designer's hand-built bar). The bundle below injects every rule
// at boot time.
//
// State-attribute driven: icon visibility / hide-on-idle / volume
// glyph all key off `data-state`, `data-volume`,
// `data-controls-idle`, `data-fullscreen` on the slot. JS never
// touches classList; designers can target any state from Webflow
// Custom Code with the same selectors.
//
// Rules dropped vs v3:
//   - consent gate (no GDPR overlay in v4)
//   - captions toggle highlight
//   - <input type=range> styling (we use div scrubbers)
// ============================================================

export interface CssRule {
  selector: string;
  body: string;
}

/**
 * Token defaults applied to `.vp-slot`. Per-slot overrides via
 * data-accent-color / data-thumb-color, written by Player.applyColors.
 */
const SLOT_TOKENS: string = [
  'position: relative',
  'width: 100%',
  'aspect-ratio: 16 / 9',
  'overflow: hidden',
  'border-radius: 8px',
  'background: #000',
  'outline: none',
  '--vp-accent: #00b3ff',
  '--vp-thumb-color: #ffffff',
  '--vp-track-color: rgba(255, 255, 255, 0.18)',
  '--vp-buffer-color: rgba(255, 255, 255, 0.35)',
  '--vp-icon-color: #ffffff',
  '--vp-icon-hover-color: var(--vp-accent, #00b3ff)',
  '--vp-time-color: rgba(255, 255, 255, 0.85)',
  '--vp-tooltip-bg: rgba(15, 15, 18, 0.95)',
  '--vp-tooltip-color: #ffffff',
  '--vp-bar-bg: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0))',
  '--vp-bar-pad: 10px 12px',
  '--vp-bar-pad-top: 32px',
  '--vp-button-size: 36px',
  '--vp-button-radius: 6px',
  '--vp-thumb-size: 14px',
  '--vp-track-height: 4px',
  '--vp-menu-bg: rgba(15, 15, 18, 0.95)',
  '--vp-menu-color: #ffffff',
  '--vp-menu-radius: 6px',
].join('; ') + ';';

export const RULES: CssRule[] = [
  // ── Wrapper / poster / overlay play ──
  { selector: '.vp-slot', body: SLOT_TOKENS },
  { selector: '.vp-slot:focus-visible', body: 'outline: 2px solid var(--vp-accent); outline-offset: 2px;' },
  { selector: '.vp-poster', body: 'position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s ease;' },
  {
    selector: '.vp-play',
    body: 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: var(--vp-accent, #00b3ff); transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);',
  },
  { selector: '.vp-slot:hover .vp-play', body: 'transform: scale(1.06);' },

  // ── Control bar ──
  {
    selector: '.vp-controls',
    body: 'position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 6px; padding: var(--vp-bar-pad); padding-top: var(--vp-bar-pad-top); background: var(--vp-bar-bg); color: var(--vp-icon-color); font: 12px/1 system-ui, sans-serif; z-index: 5; flex-wrap: nowrap; transition: opacity 0.25s, transform 0.25s;',
  },
  { selector: '.vp-slot[data-controls-idle="true"] .vp-controls', body: 'opacity: 0; pointer-events: none; transform: translateY(8px);' },
  { selector: '.vp-controls--hidden', body: 'display: none;' },

  // ── Buttons (div[role=button]) ──
  {
    selector: '.vp-control',
    body: 'position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--vp-button-size); height: var(--vp-button-size); padding: 7px; background: transparent; color: inherit; cursor: pointer; border-radius: var(--vp-button-radius); transition: background 0.15s, color 0.15s, transform 0.1s; user-select: none;',
  },
  { selector: '.vp-control:hover', body: 'background: rgba(255, 255, 255, 0.14); color: var(--vp-icon-hover-color);' },
  { selector: '.vp-control:active', body: 'transform: scale(0.94);' },
  { selector: '.vp-control:focus-visible', body: 'outline: 2px solid var(--vp-accent); outline-offset: 2px;' },
  { selector: '.vp-control[hidden]', body: 'display: none;' },
  { selector: '.vp-control svg', body: 'width: 100%; height: 100%; fill: currentColor; pointer-events: none;' },

  // ── Tooltips ──
  {
    selector: '.vp-control[data-tooltip]::after',
    body: 'content: attr(data-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(2px); padding: 5px 8px; background: var(--vp-tooltip-bg); color: var(--vp-tooltip-color); font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; border-radius: 4px; pointer-events: none; opacity: 0; transition: opacity 0.12s, transform 0.12s; z-index: 4;',
  },
  {
    selector: '.vp-control:hover[data-tooltip]::after, .vp-control:focus-visible[data-tooltip]::after',
    body: 'opacity: 1; transform: translateX(-50%) translateY(0);',
  },

  // ── Play / pause icon swap (data-state on slot) ──
  { selector: '.vp-slot[data-state="playing"] .vp-icon-play', body: 'display: none;' },
  { selector: '.vp-slot:not([data-state="playing"]) .vp-icon-pause', body: 'display: none;' },

  // ── Volume icon swap (data-volume on slot) ──
  { selector: '.vp-slot[data-volume="full"] .vp-icon-vol-mid, .vp-slot[data-volume="full"] .vp-icon-vol-mute', body: 'display: none;' },
  { selector: '.vp-slot[data-volume="mid"] .vp-icon-vol-full, .vp-slot[data-volume="mid"] .vp-icon-vol-mute', body: 'display: none;' },
  { selector: '.vp-slot[data-volume="mute"] .vp-icon-vol-full, .vp-slot[data-volume="mute"] .vp-icon-vol-mid', body: 'display: none;' },

  // ── Fullscreen icon swap ──
  { selector: '.vp-slot:not([data-fullscreen="true"]) .vp-icon-fs-exit', body: 'display: none;' },
  { selector: '.vp-slot[data-fullscreen="true"] .vp-icon-fs-enter', body: 'display: none;' },

  // ── Volume group + div-based slider ──
  { selector: '.vp-volume-group', body: 'display: inline-flex; align-items: center; gap: 4px;' },
  {
    selector: '.vp-volume',
    body: 'position: relative; width: 0; opacity: 0; height: var(--vp-track-height); background: var(--vp-track-color); border-radius: 2px; cursor: pointer; transition: width 0.18s, opacity 0.18s; touch-action: none;',
  },
  { selector: '.vp-volume-group:hover .vp-volume, .vp-volume-group:focus-within .vp-volume', body: 'width: 70px; opacity: 1;' },
  { selector: '.vp-volume-fill', body: 'position: absolute; left: 0; top: 0; height: 100%; width: 0%; background: var(--vp-accent); border-radius: 2px; pointer-events: none;' },
  {
    selector: '.vp-volume-thumb',
    body: 'position: absolute; top: 50%; left: 0%; width: 10px; height: 10px; background: var(--vp-thumb-color); border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 1px 3px rgba(0,0,0,0.4);',
  },

  // ── Progress scrubber (div based — see Scrubber.ts) ──
  { selector: '.vp-scrub', body: 'position: relative; flex: 1; min-width: 60px; height: 18px; cursor: pointer; touch-action: none;' },
  {
    selector: '.vp-scrub::before',
    body: 'content: ""; position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height); background: var(--vp-track-color); border-radius: 2px; pointer-events: none;',
  },
  {
    selector: '.vp-scrub-buffered',
    body: 'position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height); width: 0%; background: var(--vp-buffer-color); border-radius: 2px; pointer-events: none; transition: width 0.1s linear;',
  },
  {
    selector: '.vp-scrub-played',
    body: 'position: absolute; left: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height); width: 0%; background: var(--vp-accent); border-radius: 2px; pointer-events: none;',
  },
  {
    selector: '.vp-scrub-thumb',
    body: 'position: absolute; top: 50%; left: 0%; width: var(--vp-thumb-size); height: var(--vp-thumb-size); background: var(--vp-thumb-color); border: 2px solid var(--vp-accent); border-radius: 50%; transform: translate(-50%, -50%); pointer-events: none; box-shadow: 0 1px 4px rgba(0,0,0,0.4); transition: transform 0.15s;',
  },
  { selector: '.vp-scrub:hover .vp-scrub-thumb, .vp-scrub.is-dragging .vp-scrub-thumb', body: 'transform: translate(-50%, -50%) scale(1.2);' },
  { selector: '.vp-scrub:focus-visible', body: 'outline: 2px solid var(--vp-accent); outline-offset: 2px; border-radius: 2px;' },

  // ── Time readout ──
  { selector: '.vp-time', body: 'flex: none; font-variant-numeric: tabular-nums; padding: 0 6px; color: var(--vp-time-color); user-select: none;' },
  { selector: '.vp-time-sep', body: 'opacity: 0.5;' },

  // ── Settings menu ──
  { selector: '.vp-settings', body: 'position: relative;' },
  {
    selector: '.vp-settings-menu',
    body: 'position: absolute; bottom: calc(100% + 12px); right: 0; min-width: 180px; max-height: 280px; overflow-y: auto; background: var(--vp-menu-bg); color: var(--vp-menu-color); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--vp-menu-radius); padding: 6px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45); animation: vp-pop 0.15s ease both; z-index: 6;',
  },
  { selector: '.vp-settings-menu[hidden]', body: 'display: none;' },
  { selector: '.vp-settings-section', body: 'display: flex; flex-direction: column; gap: 2px;' },
  { selector: '.vp-settings-list', body: 'display: flex; flex-direction: column; gap: 1px;' },
  { selector: '.vp-settings-heading', body: 'padding: 4px 10px 6px; font-size: 11px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;' },
  {
    selector: '.vp-settings-item',
    body: 'display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: transparent; color: inherit; font: 12px/1.2 inherit; text-align: left; cursor: pointer; border-radius: 4px; user-select: none;',
  },
  { selector: '.vp-settings-item:hover, .vp-settings-item:focus-visible', body: 'background: rgba(255, 255, 255, 0.1); outline: none;' },
  { selector: '.vp-settings-check', body: 'opacity: 0; width: 14px; height: 14px; flex: none;' },
  { selector: '.vp-settings-check svg', body: 'width: 100%; height: 100%; fill: var(--vp-accent);' },
  { selector: '.vp-settings-item[aria-checked="true"] .vp-settings-check', body: 'opacity: 1;' },

  // ── Pseudo-fullscreen (iOS Safari fallback) ──
  {
    selector: '.vp-pseudo-fullscreen',
    body: 'position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; aspect-ratio: auto !important; border-radius: 0 !important; z-index: 99999 !important;',
  },

  // ── Animations / responsive ──
  { selector: '@keyframes vp-pop', body: 'from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }' },
  {
    selector: '@media (pointer: coarse)',
    body: '.vp-control { width: 44px; height: 44px; padding: 11px; } .vp-scrub { height: 22px; } .vp-volume-group:not(:focus-within) .vp-volume { width: 0; }',
  },
];

export function renderCss(): string {
  return RULES.map((r) => `${r.selector} { ${r.body} }`).join('\n');
}

/**
 * Inject the runtime CSS once per page. Called from standalone.ts at boot.
 * Idempotent — multiple slot inits won't duplicate the style tag.
 */
export function injectRuntimeCss(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('vp-runtime-css')) return;
  const style = document.createElement('style');
  style.id = 'vp-runtime-css';
  style.textContent = renderCss();
  document.head.appendChild(style);
}
