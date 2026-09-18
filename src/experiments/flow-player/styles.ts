// ============================================================
// flow-player styles.
//
// Two buckets:
//
//   WEBFLOW_CLASSES — simple, single-class rules. These ship in the
//     Webflow JSON's styles[] array, so designers find them in the
//     Style panel and edit like any other class. Visual concerns
//     only — colors via CSS variables, spacing, sizing.
//
//   INTERNAL_RULES — descendant selectors, pseudo-elements,
//     attribute-state rules, @keyframes, @media. These ship in a
//     <style> block inside the boot HtmlEmbed. They handle UI state
//     (icon swaps, tooltip positioning, hover reveal) and aren't
//     practically designer-editable, so we don't pollute the class
//     panel with them.
//
// All design tokens (color, sizing, radii, etc.) live as CSS custom
// properties on .vp-slot. Designers edit those in the Style panel
// to retheme everything; power users can drill into individual
// classes.
// ============================================================

export interface ClassRule {
  /** Plain class name without the leading dot. */
  name: string;
  styleLess: string;
}

export interface InternalRule {
  /** Full CSS selector or @-rule (e.g. ".vp-control:hover", "@keyframes vp-spin"). */
  selector: string;
  body: string;
}

// ── WEBFLOW CLASSES ─────────────────────────────────────────────

// Classes ship to Webflow's styles[] array IF AND ONLY IF an element
// in the Webflow tree uses them. Webflow tree-shakes unused class
// definitions — so .vp-controls, .vp-progress*, .vp-volume, etc.
// (used only by JS-rendered elements) MUST live in INTERNAL_RULES
// instead, otherwise Webflow drops them and our control bar lands in
// the DOM unstyled, gets clipped by the slot's overflow:hidden, and
// Vimeo's native chrome is what the visitor sees instead.
//
// Rule of thumb: if an element with this class exists as a node in
// the Webflow JSON, it goes here. Otherwise it goes in INTERNAL_RULES.

export const WEBFLOW_CLASSES: ClassRule[] = [
  // ── Slot — design tokens live here as CSS custom properties.
  // Edit any of these on .vp-slot in the Webflow Style panel to
  // retheme the player.
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
      // ── Color tokens
      '--vp-accent: #00b3ff',
      '--vp-thumb-color: #ffffff',
      '--vp-track-color: rgba(255, 255, 255, 0.18)',
      '--vp-buffer-color: rgba(255, 255, 255, 0.35)',
      '--vp-icon-color: #ffffff',
      '--vp-icon-hover-color: var(--vp-accent, #00b3ff)',
      '--vp-time-color: rgba(255, 255, 255, 0.85)',
      '--vp-tooltip-bg: rgba(15, 15, 18, 0.95)',
      '--vp-tooltip-color: #ffffff',
      // ── Layout tokens
      // Standard bottom-fade gradient. The custom control bar only
      // renders when the provider's native chrome is actually hidden
      // (YouTube always, Vimeo Pro when data-vimeo-pro="true"), so we
      // don't need to physically mask anything underneath.
      '--vp-bar-bg: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0))',
      '--vp-bar-pad: 10px 12px',
      '--vp-bar-pad-top: 32px',
      '--vp-button-size: 36px',
      '--vp-button-radius: 6px',
      '--vp-thumb-size: 14px',
      '--vp-track-height: 4px',
      // ── Menu tokens
      '--vp-menu-bg: rgba(15, 15, 18, 0.95)',
      '--vp-menu-color: #ffffff',
      '--vp-menu-radius: 6px',
    ].join('; ') + ';',
  },
  // ── Poster
  {
    name: 'vp-poster',
    styleLess:
      'position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s ease;',
  },
  // ── Big play overlay
  {
    name: 'vp-play',
    styleLess:
      'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: var(--vp-accent, #00b3ff); transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);',
  },
  // (vp-loading, vp-loading-spinner are runtime-only — moved to INTERNAL_RULES.)
  // ── Consent gate. display: none by default; JS sets display: flex
  // when this slot needs the gate. (Override-safe: !important on the
  // default to defeat host-platform CSS that might force display.)
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
  // (Control bar / progress / volume / time / settings / loading
  // classes are runtime-only — moved to INTERNAL_RULES so Webflow's
  // tree-shaker doesn't drop them. Edit colors via the CSS variables
  // on .vp-slot, edit layout via your own custom CSS in Webflow.)
];

// ── INTERNAL STATE / PSEUDO-ELEMENT / @-RULES ──────────────────
// Ship via the embed's <style> block, not as Webflow classes.
// These handle UI state changes that designers shouldn't have to
// touch.

export const INTERNAL_RULES: InternalRule[] = [
  // ── Loading spinner (runtime-only)
  {
    selector: '.vp-loading',
    body:
      'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 2;',
  },
  {
    selector: '.vp-loading-spinner',
    body:
      'width: 48px; height: 48px; border-radius: 50%; border: 3px solid var(--vp-track-color, rgba(255, 255, 255, 0.18)); border-top-color: var(--vp-accent, #00b3ff); animation: vp-spin 0.8s linear infinite;',
  },
  // ── Control bar wrapper (runtime-only). !important on the critical
  // positioning so host-platform CSS resets (Webflow's normalize, base
  // styles, anything user-added) can't accidentally hide our bar.
  {
    selector: '.vp-controls',
    body:
      'position: absolute !important; left: 0 !important; right: 0 !important; bottom: 0 !important; display: flex !important; align-items: center; gap: 6px; padding: var(--vp-bar-pad, 10px 12px); padding-top: var(--vp-bar-pad-top, 32px); background: var(--vp-bar-bg, linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0))); color: var(--vp-icon-color, #ffffff); font: 12px/1 system-ui, -apple-system, sans-serif; z-index: 5 !important; flex-wrap: nowrap; transition: opacity 0.25s ease, transform 0.25s ease; pointer-events: auto;',
  },
  // ── Buttons (runtime-only)
  {
    selector: '.vp-control',
    body:
      'position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; width: var(--vp-button-size, 36px); height: var(--vp-button-size, 36px); padding: 7px; border: 0; background: transparent; color: inherit; cursor: pointer; border-radius: var(--vp-button-radius, 6px);',
  },
  // ── Volume group + slider (runtime-only)
  {
    selector: '.vp-volume-group',
    body: 'display: inline-flex; align-items: center; gap: 4px; --vp-volume: 100%;',
  },
  {
    selector: '.vp-volume',
    body:
      'width: 0; opacity: 0; height: var(--vp-track-height, 4px); appearance: none; background: linear-gradient(to right, var(--vp-accent, #00b3ff) var(--vp-volume), var(--vp-track-color, rgba(255, 255, 255, 0.3)) var(--vp-volume)); border-radius: 2px; cursor: pointer; transition: width 0.18s ease, opacity 0.18s ease;',
  },
  // ── Progress (runtime-only)
  {
    selector: '.vp-progress',
    body:
      'position: relative; flex: 1; min-width: 60px; height: 18px; --vp-progress-frac: 0; --vp-buffer-frac: 0;',
  },
  {
    selector: '.vp-progress-track',
    body:
      'position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: var(--vp-track-height, 4px); background: var(--vp-track-color, rgba(255, 255, 255, 0.18)); border-radius: 2px; overflow: hidden; pointer-events: none;',
  },
  {
    selector: '.vp-progress-buffer',
    body:
      'position: absolute; left: 0; top: 0; height: 100%; width: calc(var(--vp-buffer-frac) * 100%); background: var(--vp-buffer-color, rgba(255, 255, 255, 0.35)); transition: width 0.1s linear;',
  },
  {
    selector: '.vp-progress-fill',
    body:
      'position: absolute; left: 0; top: 0; height: 100%; width: calc(var(--vp-progress-frac) * 100%); background: var(--vp-accent, #00b3ff);',
  },
  {
    selector: '.vp-progress-thumb',
    body:
      'position: absolute; top: 50%; left: calc(var(--vp-progress-frac) * (100% - var(--vp-thumb-size, 14px)) + var(--vp-thumb-size, 14px) / 2); transform: translate(-50%, -50%); width: var(--vp-thumb-size, 14px); height: var(--vp-thumb-size, 14px); background: var(--vp-thumb-color, #ffffff); border: 2px solid var(--vp-accent, #00b3ff); border-radius: 50%; pointer-events: none; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4); transition: transform 0.15s ease;',
  },
  {
    selector: '.vp-progress-range',
    body:
      'position: absolute; inset: 0; width: 100%; height: 100%; appearance: none; background: transparent; cursor: pointer; margin: 0; padding: 0; z-index: 1;',
  },
  // ── Time (runtime-only)
  {
    selector: '.vp-time',
    body:
      'flex: none; font-variant-numeric: tabular-nums; padding: 0 6px; color: var(--vp-time-color, rgba(255, 255, 255, 0.85)); user-select: none;',
  },
  // ── Settings popup (runtime-only)
  {
    selector: '.vp-settings',
    body: 'position: relative;',
  },
  {
    selector: '.vp-settings-menu',
    body:
      'position: absolute; bottom: calc(100% + 12px); right: 0; min-width: 180px; max-height: 280px; overflow-y: auto; background: var(--vp-menu-bg, rgba(15, 15, 18, 0.95)); color: var(--vp-menu-color, #fff); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: var(--vp-menu-radius, 6px); padding: 6px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);',
  },
  {
    selector: '.vp-settings-section',
    body: 'display: flex; flex-direction: column; gap: 2px;',
  },
  {
    selector: '.vp-settings-list',
    body: 'display: flex; flex-direction: column; gap: 1px;',
  },
  {
    selector: '.vp-settings-heading',
    body:
      'padding: 4px 10px 6px; font-size: 11px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;',
  },
  {
    selector: '.vp-settings-item',
    body:
      'display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; background: transparent; border: 0; color: inherit; font: 12px/1.2 inherit; text-align: left; cursor: pointer; border-radius: 4px;',
  },
  {
    selector: '.vp-settings-check',
    body: 'opacity: 0; width: 14px; height: 14px; flex: none;',
  },
  // ── Focus & hover states
  {
    selector: '.vp-slot:focus-visible',
    body: 'outline: 2px solid var(--vp-accent, #00b3ff); outline-offset: 2px;',
  },
  {
    selector: '.vp-slot:hover .vp-play',
    body: 'transform: scale(1.06);',
  },
  {
    selector: '.vp-controls--idle',
    body: 'opacity: 0; pointer-events: none; transform: translateY(8px);',
  },
  {
    selector: '.vp-controls--hidden',
    body: 'display: none;',
  },
  // Button states
  {
    selector: '.vp-control',
    body: 'transition: background 0.15s ease, color 0.15s ease, transform 0.1s ease;',
  },
  {
    selector: '.vp-control:hover',
    body: 'background: rgba(255, 255, 255, 0.14); color: var(--vp-icon-hover-color, var(--vp-accent, #00b3ff));',
  },
  {
    selector: '.vp-control:active',
    body: 'transform: scale(0.94);',
  },
  {
    selector: '.vp-control:focus-visible',
    body: 'outline: 2px solid var(--vp-accent, #00b3ff); outline-offset: 2px;',
  },
  {
    selector: '.vp-control[hidden]',
    body: 'display: none;',
  },
  {
    selector: '.vp-control svg',
    body: 'width: 100%; height: 100%; fill: currentColor;',
  },
  // Tooltips
  {
    selector: '.vp-control[data-tooltip]::after, .vp-settings-btn[data-tooltip]::after',
    body: 'content: attr(data-tooltip); position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(2px); padding: 5px 8px; background: var(--vp-tooltip-bg, rgba(15, 15, 18, 0.95)); color: var(--vp-tooltip-color, #fff); font-size: 11px; font-weight: 500; line-height: 1; white-space: nowrap; border-radius: 4px; pointer-events: none; opacity: 0; transition: opacity 0.12s ease, transform 0.12s ease; z-index: 4;',
  },
  {
    selector:
      '.vp-control:hover[data-tooltip]::after, .vp-control:focus-visible[data-tooltip]::after, .vp-settings-btn:hover[data-tooltip]::after',
    body: 'opacity: 1; transform: translateX(-50%) translateY(0);',
  },
  // Play / pause icon visibility
  {
    selector: '.vp-controls-play[aria-pressed="false"] .vp-icon-pause',
    body: 'display: none;',
  },
  {
    selector: '.vp-controls-play[aria-pressed="true"] .vp-icon-play',
    body: 'display: none;',
  },
  // Captions toggle highlight
  {
    selector: '.vp-captions[aria-pressed="true"]',
    body: 'background: rgba(255, 255, 255, 0.16); color: var(--vp-accent, #00b3ff);',
  },
  // Mute / volume icon visibility
  {
    selector:
      '.vp-mute[data-level="full"] .vp-icon-vol-mid, .vp-mute[data-level="full"] .vp-icon-vol-mute',
    body: 'display: none;',
  },
  {
    selector:
      '.vp-mute[data-level="mid"] .vp-icon-vol-full, .vp-mute[data-level="mid"] .vp-icon-vol-mute',
    body: 'display: none;',
  },
  {
    selector:
      '.vp-mute[data-level="mute"] .vp-icon-vol-full, .vp-mute[data-level="mute"] .vp-icon-vol-mid',
    body: 'display: none;',
  },
  // Fullscreen icon visibility
  {
    selector: '.vp-fullscreen[aria-pressed="false"] .vp-icon-fs-exit',
    body: 'display: none;',
  },
  {
    selector: '.vp-fullscreen[aria-pressed="true"] .vp-icon-fs-enter',
    body: 'display: none;',
  },
  // Volume slider — slide out on hover
  {
    selector: '.vp-volume-group:hover .vp-volume, .vp-volume-group:focus-within .vp-volume',
    body: 'width: 70px; opacity: 1;',
  },
  {
    selector: '.vp-volume::-webkit-slider-thumb',
    body:
      'appearance: none; width: 12px; height: 12px; background: var(--vp-thumb-color, #fff); border-radius: 50%; cursor: pointer;',
  },
  {
    selector: '.vp-volume::-moz-range-thumb',
    body:
      'width: 12px; height: 12px; background: var(--vp-thumb-color, #fff); border: 0; border-radius: 50%; cursor: pointer;',
  },
  // Range input invisible thumb (we render our own .vp-progress-thumb)
  {
    selector: '.vp-progress-range::-webkit-slider-thumb',
    body:
      'appearance: none; width: 16px; height: 16px; background: transparent; border: 0; cursor: pointer;',
  },
  {
    selector: '.vp-progress-range::-moz-range-thumb',
    body:
      'width: 16px; height: 16px; background: transparent; border: 0; cursor: pointer;',
  },
  // Hover scale on the custom thumb
  {
    selector: '.vp-progress:hover .vp-progress-thumb',
    body: 'transform: translate(-50%, -50%) scale(1.2);',
  },
  // Time separator
  {
    selector: '.vp-time-sep',
    body: 'opacity: 0.5;',
  },
  // Settings menu animation
  {
    selector: '.vp-settings-menu',
    body: 'animation: vp-pop 0.15s ease both;',
  },
  {
    selector: '.vp-settings-menu[hidden]',
    body: 'display: none;',
  },
  {
    selector: '.vp-settings-item:hover, .vp-settings-item:focus-visible',
    body: 'background: rgba(255, 255, 255, 0.1); outline: none;',
  },
  {
    selector: '.vp-settings-check svg',
    body: 'width: 100%; height: 100%; fill: var(--vp-accent, #00b3ff);',
  },
  {
    selector: '.vp-settings-item[aria-checked="true"] .vp-settings-check',
    body: 'opacity: 1;',
  },
  // Consent button hover
  {
    selector: '.vp-consent-accept:hover',
    body: 'filter: brightness(1.1);',
  },
  // Pseudo-fullscreen
  {
    selector: '.vp-pseudo-fullscreen',
    body:
      'position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; max-width: none !important; aspect-ratio: auto !important; border-radius: 0 !important; z-index: 99999 !important;',
  },
  // @-rules
  {
    selector: '@keyframes vp-spin',
    body: 'to { transform: rotate(360deg); }',
  },
  {
    selector: '@keyframes vp-pop',
    body:
      'from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); }',
  },
  {
    selector: '@media (pointer: coarse)',
    body:
      '.vp-control { width: 44px; height: 44px; padding: 11px; } .vp-progress { height: 22px; } .vp-volume-group:not(:focus-within) .vp-volume { width: 0; }',
  },
];

/** Render the full CSS for in-app preview (concatenates both buckets). */
export function renderCssBlock(): string {
  const classes = WEBFLOW_CLASSES.map((c) => `.${c.name} { ${c.styleLess} }`).join('\n');
  const internal = INTERNAL_RULES.map((r) => `${r.selector} { ${r.body} }`).join('\n');
  return `${classes}\n${internal}`;
}

/** CSS that ships in the embed's <style> block (internal rules only). */
export function renderInternalCss(): string {
  return INTERNAL_RULES.map((r) => `${r.selector} { ${r.body} }`).join('\n');
}
