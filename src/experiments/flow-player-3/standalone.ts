// ============================================================
// flow-player-3 standalone — runs once on the Webflow page.
// Bundled to dist/exports/flow-player-3.esm.js and inlined into
// the Webflow JSON HtmlEmbed.
//
// Per-slot config lives on data-* attributes. Page-level overrides
// for less common defaults can be set on window.__FLOW_PLAYER_3_CONFIG__
// before this module evaluates.
// ============================================================

import { attachSlot, flowPlayer3Defaults } from './ui/Player.ts';

declare global {
  interface Window {
    __FLOW_PLAYER_3_CONFIG__?: Partial<typeof flowPlayer3Defaults>;
  }
}

const FLOW_PLAYER_3_BUNDLE_VERSION = '2026-05-16-fouc-fix';

const config =
  (typeof window !== 'undefined' && window.__FLOW_PLAYER_3_CONFIG__) || {};
const defaults = { ...flowPlayer3Defaults, ...config };

function initAll(): void {
  document.documentElement.setAttribute(
    'data-flow-player-3-version',
    FLOW_PLAYER_3_BUNDLE_VERSION,
  );
  const slots = document.querySelectorAll<HTMLElement>(
    '.vp-slot[data-vimeo-url], .vp-slot[data-video-url], .vp-slot[data-youtube-url]',
  );
  for (const slot of slots) {
    attachSlot(slot, { defaults });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
}
