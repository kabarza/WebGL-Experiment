// ============================================================
// flow-player-3 styles.
//
// Two buckets:
//   WEBFLOW_CLASSES_ALWAYS  → 5-node tree (Option 1 + Option 2)
//   WEBFLOW_CLASSES_OPTION_2 → ~75 extra nodes (Option 2 only)
//   INTERNAL_RULES → embed <style> block (state-driven CSS)
//
// State-attribute driven: icon visibility / hide-on-idle keys off
// `data-state`, `data-volume`, `data-controls-idle`,
// `data-fullscreen` on the slot. JS never touches classList; designers
// can target any state from Webflow Custom Code with the same selectors.
// ============================================================

export interface ClassRule {
  name: string;
  styleLess: string;
}

export interface InternalRule {
  selector: string;
  body: string;
}

export const WEBFLOW_CLASSES_ALWAYS: ClassRule[] = [
  {
    name: 'vp-slot',
    styleLess: [
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
    ].join('; ') + ';',
  },
  {
    name: 'vp-poster',
    styleLess:
      'position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s ease;',
  },
  {
    name: 'vp-play',
    styleLess:
      'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: var(--vp-accent, #00b3ff); transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);',
  },
  {
    name: 'vp-consent',
    styleLess:
      'position: absolute; inset: 0; display: none; align-items: center; justify-content: center; padding: 24px; background: rgba(15, 15, 18, 0.92); color: #fff; z-index: 3;',
  },
  {
    name: 'vp-consent-inner',
    styleLess:
      'max-width: 420px; text-align: center; display: flex; flex-direction: column; gap: 12px;',
  },
  {
    name: 'vp-consent-title',
    styleLess: 'margin: 0; font-size: 16px; font-weight: 600; color: #fff;',
  },
  {
    name: 'vp-consent-body',
    styleLess: 'margin: 0; font-size: 13px; line-height: 1.5; color: rgba(255, 255, 255, 0.85);',
  },
  {
    name: 'vp-consent-accept',
    styleLess:
      'align-self: center; padding: 10px 18px; border: 0; border-radius: var(--vp-button-radius, 6px); background: var(--vp-accent, #00b3ff); color: #ffffff; font-size: 13px; font-weight: 600; cursor: pointer;',
  },
];

export const WEBFLOW_CLASSES_OPTION_2: ClassRule[] = [
  {
    name: 'vp-controls',
    styleLess:
      'position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 6px; padding: var(--vp-bar-pad, 10px 12px); padding-top: var(--vp-bar-pad-top, 32px); background: var(--vp-bar-bg); color: var(--vp-icon-color, #fff); font: 12px/1 system-ui, sans-serif; z-index: 5; flex-wrap: nowrap;',
  },
  {
    name: 'vp-control',
    styleLess:
      'position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--vp-button-size, 36px); height: var(--vp-button-size, 36px); padding: 7px; border: 0; background: transparent; color: inherit; cursor: pointer; border-radius: var(--vp-button-radius, 6px);',
  },
  {
    name: 'vp-progress',
    styleLess: 'position: relative; flex: 1; min-width: 60px; height: 18px;',
  },
  {
    name: 'vp-time',
    styleLess: 'flex: none; font-variant-numeric: tabular-nums; padding: 0 6px; color: var(--vp-time-color); user-select: none;',
  },
  {
    name: 'vp-volume-group',
    styleLess: 'display: inline-flex; align-items: center; gap: 4px;',
  },
  {
    name: 'vp-settings',
    styleLess: 'position: relative;',
  },
];

export const INTERNAL_RULES: InternalRule[] = [
  { selector: '.vp-slot:focus-visible', body: 'outline: 2px solid var(--vp-accent); outline-offset: 2px;' },
  { selector: '.vp-slot:hover .vp-play', body: 'transform: scale(1.06);' },

  // Loading spinner
  // Control bar
  { selector: '.vp-controls', body: 'position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: center; gap: 6px; padding: var(--vp-bar-pad); padding-top: var(--vp-bar-pad-top); background: var(--vp-bar-bg); color: var(--vp-icon-color); font: 12px/1 system-ui, sans-serif; z-index: 5; flex-wrap: nowrap; transition: opacity 0.25s, transform 0.25s;' },
  { selector: '.vp-slot[data-controls-idle="true"] .vp-controls', body: 'opacity: 0; pointer-events: none; transform: translateY(8px);' },
  { selector: '.vp-controls--hidden', body: 'display: none;' },

  // Buttons
  { selector: '.vp-control', body: 'position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--vp-button-size); height: var(--vp-button-size); padding: 7px; border: 0; background: transparent; color: inherit; cursor: pointer; border-radius: var(--vp-button-radius); transition: background 0.15s, color 0.15s, transform 0.1s;' },
  { selector: '.vp-control:hover', body: 'background: rgba(255, 255, 255, 0.14); color: var(--vp-icon-hover-color);' },
  { selector: '.vp-control:active', body: 'transform: scale(0.94);' },
  { selector: '.vp-control:focus-visible', body: 'outline: 2px solid var(--vp-accent); outline-offset: 2px;' },
  { selector: '.vp-control[hidden]', body: 'display: none;' },
  { selector: '.vp-control svg', body: 'width: 100%; height: 100%; fill: currentColor;' },

  // Tooltips
  { selector: '.vp-control[data-tooltip]::after', body: 'content: attr(data-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(2px); padding: 5px 8px; background: var(--vp-tooltip-bg); color: var(--vp-tooltip-color); font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; border-radius: 4px; pointer-events: none; opacity: 0; transition: opacity 0.12s, transform 0.12s; z-index: 4;' },
  { selector: '.vp-control:hover[data-tooltip]::after, .vp-control:focus-visible[data-tooltip]::after', body: 'opacity: 1; transform: translateX(-50%) translateY(0);' },

  // Play/pause icon swap — keys off data-state on the slot
  { selector: '.vp-slot[data-state="playing"] .vp-icon-play', body: 'display: none;' },
  { selector: '.vp-slot:not([data-state="playing"]) .vp-icon-pause', body: 'display: none;' },

  // Captions toggle highlight
  { selector: '.vp-btn-captions[aria-pressed="true"]', body: 'background: rgba(255, 255, 255, 0.16); color: var(--vp-accent);' },

  // Volume icon swap — keys off data-volume on the slot
  { selector: '.vp-slot[data-volume="full"] .vp-icon-vol-mid, .vp-slot[data-volume="full"] .vp-icon-vol-mute', body: 'display: none;' },
  { selector: '.vp-slot[data-volume="mid"] .vp-icon-vol-full, .vp-slot[data-volume="mid"] .vp-icon-vol-mute', body: 'display: none;' },
  { selector: '.vp-slot[data-volume="mute"] .vp-icon-vol-full, .vp-slot[data-volume="mute"] .vp-icon-vol-mid', body: 'display: none;' },

  // Fullscreen icon swap
  { selector: '.vp-slot:not([data-fullscreen="true"]) .vp-icon-fs-exit', body: 'display: none;' },
  { selector: '.vp-slot[data-fullscreen="true"] .vp-icon-fs-enter', body: 'display: none;' },

  // Volume group + slider
  { selector: '.vp-volume-group', body: 'display: inline-flex; align-items: center; gap: 4px; --vp-volume: 100%;' },
  { selector: '.vp-volume', body: 'width: 0; opacity: 0; height: var(--vp-track-height); appearance: none; background: linear-gradient(to right, var(--vp-accent) var(--vp-volume), var(--vp-track-color) var(--vp-volume)); border-radius: 2px; cursor: pointer; transition: width 0.18s, opacity 0.18s;' },
  { selector: '.vp-volume-group:hover .vp-volume, .vp-volume-group:focus-within .vp-volume', body: 'width: 70px; opacity: 1;' },
  { selector: '.vp-volume::-webkit-slider-thumb', body: 'appearance: none; width: 12px; height: 12px; background: var(--vp-thumb-color); border-radius: 50%; cursor: pointer;' },
  { selector: '.vp-volume::-moz-range-thumb', body: 'width: 12px; height: 12px; background: var(--vp-thumb-color); border: 0; border-radius: 50%; cursor: pointer;' },

  // Progress
  { selector: '.vp-progress', body: 'position: relative; flex: 1; min-width: 60px; height: 18px; --vp-progress-frac: 0; --vp-buffer-frac: 0;' },
  { selector: '.vp-progress-track', body: 'position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height); background: var(--vp-track-color); border-radius: 2px; overflow: hidden; pointer-events: none;' },
  { selector: '.vp-progress-buffer', body: 'position: absolute; left: 0; top: 0; height: 100%; width: calc(var(--vp-buffer-frac) * 100%); background: var(--vp-buffer-color); transition: width 0.1s linear;' },
  { selector: '.vp-progress-fill', body: 'position: absolute; left: 0; top: 0; height: 100%; width: calc(var(--vp-progress-frac) * 100%); background: var(--vp-accent);' },
  { selector: '.vp-progress-thumb', body: 'position: absolute; top: 50%; left: calc(var(--vp-progress-frac) * (100% - var(--vp-thumb-size)) + var(--vp-thumb-size) / 2); transform: translate(-50%, -50%); width: var(--vp-thumb-size); height: var(--vp-thumb-size); background: var(--vp-thumb-color); border: 2px solid var(--vp-accent); border-radius: 50%; pointer-events: none; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); transition: transform 0.15s;' },
  { selector: '.vp-progress-range', body: 'position: absolute; inset: 0; width: 100%; height: 100%; appearance: none; background: transparent; cursor: pointer; margin: 0; padding: 0; z-index: 1;' },
  { selector: '.vp-progress-range::-webkit-slider-thumb', body: 'appearance: none; width: 16px; height: 16px; background: transparent; border: 0; cursor: pointer;' },
  { selector: '.vp-progress-range::-moz-range-thumb', body: 'width: 16px; height: 16px; background: transparent; border: 0; cursor: pointer;' },
  { selector: '.vp-progress:hover .vp-progress-thumb', body: 'transform: translate(-50%, -50%) scale(1.2);' },

  // Time
  { selector: '.vp-time', body: 'flex: none; font-variant-numeric: tabular-nums; padding: 0 6px; color: var(--vp-time-color); user-select: none;' },
  { selector: '.vp-time-sep', body: 'opacity: 0.5;' },

  // Settings menu
  { selector: '.vp-settings', body: 'position: relative;' },
  { selector: '.vp-settings-menu', body: 'position: absolute; bottom: calc(100% + 12px); right: 0; min-width: 180px; max-height: 280px; overflow-y: auto; background: var(--vp-menu-bg); color: var(--vp-menu-color); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--vp-menu-radius); padding: 6px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45); animation: vp-pop 0.15s ease both;' },
  { selector: '.vp-settings-menu[hidden]', body: 'display: none;' },
  { selector: '.vp-settings-section', body: 'display: flex; flex-direction: column; gap: 2px;' },
  { selector: '.vp-settings-list', body: 'display: flex; flex-direction: column; gap: 1px;' },
  { selector: '.vp-settings-heading', body: 'padding: 4px 10px 6px; font-size: 11px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;' },
  { selector: '.vp-settings-item', body: 'display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: transparent; border: 0; color: inherit; font: 12px/1.2 inherit; text-align: left; cursor: pointer; border-radius: 4px;' },
  { selector: '.vp-settings-item:hover, .vp-settings-item:focus-visible', body: 'background: rgba(255, 255, 255, 0.1); outline: none;' },
  { selector: '.vp-settings-check', body: 'opacity: 0; width: 14px; height: 14px; flex: none;' },
  { selector: '.vp-settings-check svg', body: 'width: 100%; height: 100%; fill: var(--vp-accent);' },
  { selector: '.vp-settings-item[aria-checked="true"] .vp-settings-check', body: 'opacity: 1;' },

  // Consent button
  { selector: '.vp-consent-accept:hover', body: 'filter: brightness(1.1);' },

  // Pseudo-fullscreen
  { selector: '.vp-pseudo-fullscreen', body: 'position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; aspect-ratio: auto !important; border-radius: 0 !important; z-index: 99999 !important;' },

  // @-rules
{ selector: '@keyframes vp-pop', body: 'from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }' },
  { selector: '@media (pointer: coarse)', body: '.vp-control { width: 44px; height: 44px; padding: 11px; } .vp-progress { height: 22px; } .vp-volume-group:not(:focus-within) .vp-volume { width: 0; }' },
];

export function renderCssBlock(): string {
  const classes = [...WEBFLOW_CLASSES_ALWAYS, ...WEBFLOW_CLASSES_OPTION_2]
    .map((c) => `.${c.name} { ${c.styleLess} }`)
    .join('\n');
  const internal = INTERNAL_RULES.map((r) => `${r.selector} { ${r.body} }`).join('\n');
  return `${classes}\n${internal}`;
}

export function renderInternalCss(): string {
  return INTERNAL_RULES.map((r) => `${r.selector} { ${r.body} }`).join('\n');
}
