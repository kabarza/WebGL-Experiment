// ============================================================
// flow-player-2 styles.
//
// Two buckets, same pattern as flow-player:
//
//   WEBFLOW_CLASSES — designer-editable single-class rules. Ship in
//     the Webflow JSON's styles[] array, so they show up in the
//     Style panel like any other class. Visual concerns only —
//     all colors via CSS variables on .fp-wrapper.
//
//   STATE_RULES — descendant selectors, attribute-state rules,
//     pseudo-elements, @-rules. These ship in a small <style> block
//     inside the boot embed and govern the play/pause icon swap,
//     menu open/closed, fullscreen icon, etc. Designers shouldn't
//     have to touch them.
// ============================================================

export interface ClassRule {
  name: string;
  styleLess: string;
}

export interface StateRule {
  selector: string;
  body: string;
}

// ── WEBFLOW CLASSES ─────────────────────────────────────────────

export const WEBFLOW_CLASSES: ClassRule[] = [
  // Outer wrapper — design tokens live here as CSS custom properties.
  // Override any of these on .fp-wrapper in the Webflow Style panel
  // to retheme every instance on the page.
  {
    name: 'fp-wrapper',
    styleLess: [
      'position: relative',
      'display: block',
      'width: 100%',
      'aspect-ratio: 16 / 9',
      'overflow: hidden',
      'border-radius: 12px',
      'background: #000',
      'color: #ffffff',
      'font: 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif',
      // Color tokens
      '--fp-accent: #00b3ff',
      '--fp-track: rgba(255, 255, 255, 0.25)',
      '--fp-buffer: rgba(255, 255, 255, 0.45)',
      '--fp-thumb: #ffffff',
      '--fp-text: #ffffff',
      '--fp-bar-bg: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0))',
      '--fp-menu-bg: rgba(20, 22, 26, 0.96)',
      // Sizing tokens
      '--fp-btn-size: 40px',
      '--fp-icon-size: 22px',
      '--fp-track-h: 4px',
      '--fp-thumb-size: 14px',
    ].join('; ') + ';',
  },
  // Stage — holds the <video>, poster, big-play overlay.
  {
    name: 'fp-stage',
    styleLess:
      'position: absolute; inset: 0; display: block; width: 100%; height: 100%;',
  },
  {
    name: 'fp-video',
    styleLess:
      'position: absolute; inset: 0; width: 100%; height: 100%; display: block; background: #000;',
  },
  {
    name: 'fp-poster',
    styleLess:
      'position: absolute; inset: 0; display: block; width: 100%; height: 100%; pointer-events: none;',
  },
  {
    name: 'fp-poster-image',
    styleLess:
      'width: 100%; height: 100%; object-fit: cover; display: block;',
  },
  // Big centered play overlay shown before first play.
  {
    name: 'fp-big-play',
    styleLess:
      'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 100%);',
  },
  {
    name: 'fp-big-play-circle',
    styleLess:
      'display: inline-flex; align-items: center; justify-content: center; width: 96px; height: 96px; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: var(--fp-accent, #00b3ff); border: 2px solid rgba(255, 255, 255, 0.92);',
  },
  {
    name: 'fp-big-play-icon',
    styleLess:
      'width: 42px; height: 42px; display: inline-flex; padding-left: 4px;',
  },
  // Controls bar.
  {
    name: 'fp-controls',
    styleLess:
      'position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 6px; padding: 28px 14px 12px; color: var(--fp-text, #fff); background: var(--fp-bar-bg, linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0)));',
  },
  // Progress bar.
  {
    name: 'fp-progress',
    styleLess:
      'position: relative; width: 100%; height: 16px; cursor: pointer; --fp-progress-frac: 0; --fp-buffer-frac: 0;',
  },
  {
    name: 'fp-progress-track',
    styleLess:
      'position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); height: var(--fp-track-h, 4px); background: var(--fp-track, rgba(255,255,255,0.25)); border-radius: 999px; overflow: hidden;',
  },
  {
    name: 'fp-progress-loaded',
    styleLess:
      'position: absolute; left: 0; top: 0; height: 100%; width: calc(var(--fp-buffer-frac) * 100%); background: var(--fp-buffer, rgba(255,255,255,0.45));',
  },
  {
    name: 'fp-progress-fill',
    styleLess:
      'position: absolute; left: 0; top: 0; height: 100%; width: calc(var(--fp-progress-frac) * 100%); background: var(--fp-accent, #00b3ff);',
  },
  {
    name: 'fp-progress-thumb',
    styleLess:
      'position: absolute; top: 50%; left: calc(var(--fp-progress-frac) * 100%); width: var(--fp-thumb-size, 14px); height: var(--fp-thumb-size, 14px); transform: translate(-50%, -50%); background: var(--fp-thumb, #fff); border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.4);',
  },
  // Controls row (left + right groups).
  {
    name: 'fp-controls-row',
    styleLess:
      'display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%;',
  },
  {
    name: 'fp-controls-group',
    styleLess: 'display: flex; align-items: center; gap: 4px;',
  },
  // Buttons.
  {
    name: 'fp-btn',
    styleLess:
      'position: relative; display: inline-flex; align-items: center; justify-content: center; width: var(--fp-btn-size, 40px); height: var(--fp-btn-size, 40px); padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; border-radius: 8px;',
  },
  {
    name: 'fp-icon',
    styleLess:
      'display: inline-flex; align-items: center; justify-content: center; width: var(--fp-icon-size, 22px); height: var(--fp-icon-size, 22px); pointer-events: none;',
  },
  // Volume.
  {
    name: 'fp-volume',
    styleLess:
      'display: inline-flex; align-items: center; gap: 4px; --fp-volume: 100%;',
  },
  {
    name: 'fp-volume-slider',
    styleLess:
      'width: 0; opacity: 0; height: var(--fp-track-h, 4px); appearance: none; -webkit-appearance: none; background: linear-gradient(to right, var(--fp-accent, #00b3ff) var(--fp-volume), var(--fp-track, rgba(255,255,255,0.3)) var(--fp-volume)); border-radius: 999px; cursor: pointer; transition: width 0.18s ease, opacity 0.18s ease; margin: 0; padding: 0;',
  },
  // Time.
  {
    name: 'fp-time',
    styleLess:
      'display: inline-flex; align-items: center; gap: 4px; padding: 0 8px; font-variant-numeric: tabular-nums; user-select: none; color: var(--fp-text, #fff);',
  },
  {
    name: 'fp-time-divider',
    styleLess: 'opacity: 0.55;',
  },
  // Settings menu.
  {
    name: 'fp-menu',
    styleLess: 'position: relative; display: inline-flex;',
  },
  {
    name: 'fp-menu-list',
    styleLess:
      'position: absolute; right: 0; bottom: calc(100% + 10px); min-width: 180px; padding: 8px; display: flex; flex-direction: column; gap: 6px; background: var(--fp-menu-bg, rgba(20,22,26,0.96)); color: var(--fp-text, #fff); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.45);',
  },
  {
    name: 'fp-menu-section',
    styleLess: 'display: flex; flex-direction: column; gap: 2px;',
  },
  {
    name: 'fp-menu-heading',
    styleLess:
      'padding: 4px 10px 6px; font-size: 11px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;',
  },
  {
    name: 'fp-menu-item',
    styleLess:
      'display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 10px; background: transparent; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; border-radius: 6px; text-decoration: none;',
  },
  {
    name: 'fp-menu-check',
    styleLess: 'width: 14px; height: 14px; opacity: 0; flex: none; color: var(--fp-accent, #00b3ff);',
  },
];

// ── STATE RULES (ship in the embed's <style> block) ────────────

export const STATE_RULES: StateRule[] = [
  // Native fullscreen takes the wrapper to 100×100vw/vh — guarantee
  // controls layer on top.
  {
    selector: '.fp-wrapper:fullscreen',
    body: 'border-radius: 0;',
  },
  // The <video> stays full-bleed.
  {
    selector: '.fp-wrapper video',
    body: 'object-fit: contain;',
  },
  // ── State-driven hides ────────────────────────────────
  // !important so designer-edited Webflow classes (which set
  // display: inline-flex on .fp-btn etc) can never undo these.
  // The runtime-set data-* on the wrapper is the source of truth.
  {
    selector: '.fp-wrapper[data-state="playing"] [data-video="big-play"], .fp-wrapper[data-played="1"] [data-video="big-play"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper[data-played="1"] [data-video="poster"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper[data-state="playing"] [data-video="play"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper:not([data-state="playing"]) [data-video="pause"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper:not([data-state="ended"]) [data-video="replay"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper:not([data-fullscreen="1"]) [data-video="minimize"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper[data-fullscreen="1"] [data-video="fullscreen"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper:not([data-volume="full"]) [data-video="volume-full"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper:not([data-volume="mid"]) [data-video="volume-mid"]',
    body: 'display: none !important;',
  },
  {
    selector: '.fp-wrapper:not([data-volume="mute"]) [data-video="volume-mute"]',
    body: 'display: none !important;',
  },
  // Menu list — closed by default at runtime (the wrapper carries
  // data-menu="closed" on init). Designers see the list expanded in
  // the Designer because no attribute is set there.
  {
    selector: '.fp-wrapper[data-menu="closed"] [data-video="menu-list"]',
    body: 'display: none !important;',
  },
  // Active menu item.
  {
    selector: '.fp-wrapper [data-video="menu-item"][aria-checked="true"] [data-video="menu-check"]',
    body: 'opacity: 1;',
  },
  // ── Hover / focus affordances ─────────────────────────
  {
    selector: '.fp-btn:hover',
    body: 'background: rgba(255, 255, 255, 0.12);',
  },
  {
    selector: '.fp-btn:focus-visible',
    body: 'outline: 2px solid var(--fp-accent, #00b3ff); outline-offset: 2px;',
  },
  {
    selector: '.fp-menu-item:hover',
    body: 'background: rgba(255, 255, 255, 0.08);',
  },
  // Volume slider expands on hover/focus.
  {
    selector: '.fp-volume:hover .fp-volume-slider, .fp-volume:focus-within .fp-volume-slider',
    body: 'width: 70px; opacity: 1;',
  },
  // Range thumb (volume).
  {
    selector: '.fp-volume-slider::-webkit-slider-thumb',
    body: 'appearance: none; width: 12px; height: 12px; background: var(--fp-thumb, #fff); border-radius: 50%; border: 0; cursor: pointer;',
  },
  {
    selector: '.fp-volume-slider::-moz-range-thumb',
    body: 'width: 12px; height: 12px; background: var(--fp-thumb, #fff); border-radius: 50%; border: 0; cursor: pointer;',
  },
  // Progress hover-grow.
  {
    selector: '.fp-progress:hover .fp-progress-thumb',
    body: 'transform: translate(-50%, -50%) scale(1.25);',
  },
  // Idle-hide of the controls bar (added by JS during playback).
  {
    selector: '.fp-controls',
    body: 'transition: opacity 0.25s ease, transform 0.25s ease;',
  },
  {
    selector: '.fp-wrapper[data-idle="1"] .fp-controls',
    body: 'opacity: 0; pointer-events: none; transform: translateY(8px);',
  },
];

export function renderCssBlock(): string {
  const classes = WEBFLOW_CLASSES.map((c) => `.${c.name} { ${c.styleLess} }`).join('\n');
  const state = STATE_RULES.map((r) => `${r.selector} { ${r.body} }`).join('\n');
  return `${classes}\n${state}`;
}

export function renderStateCss(): string {
  return STATE_RULES.map((r) => `${r.selector} { ${r.body} }`).join('\n');
}
