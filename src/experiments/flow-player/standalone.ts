// ============================================================
// flow-player standalone — entry point that runs once on the
// Webflow page. Bundled to dist/exports/flow-player.esm.js by
// scripts/build-export-esm.ts and inlined into the Webflow JSON
// HtmlEmbed.
//
// Page-level config (rare overrides) can be set on
// `window.__FLOW_PLAYER_CONFIG__` before this module evaluates;
// per-slot config lives on the slot's data-* attributes.
// ============================================================

import { attachSlot, flowPlayerDefaults } from './ui/Player.ts';

// Bundle version stamp — increment when fixing a bug that requires
// users to re-paste the Webflow JSON. Visible in the page DOM after
// the boot script runs, so you can tell at a glance whether a live
// site has the latest version.
const FLOW_PLAYER_BUNDLE_VERSION = '2026-05-09-hybrid-vimeo-pro-flag';

declare global {
  interface Window {
    __FLOW_PLAYER_CONFIG__?: {
      muted?: boolean;
      loop?: boolean;
      playsinline?: boolean;
      showControls?: boolean;
      keyboardShortcuts?: boolean;
      autoHide?: boolean;
      idleTimeoutMs?: number;
    };
  }
}

const config = (typeof window !== 'undefined' && window.__FLOW_PLAYER_CONFIG__) || {};
const defaults = { ...flowPlayerDefaults, ...config };

function initAll(): void {
  document.documentElement.setAttribute('data-flow-player-version', FLOW_PLAYER_BUNDLE_VERSION);
  const slots = document.querySelectorAll<HTMLElement>('.vp-slot[data-vimeo-url], .vp-slot[data-video-url], .vp-slot[data-youtube-url]');
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
