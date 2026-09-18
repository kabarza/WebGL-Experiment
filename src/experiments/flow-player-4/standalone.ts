// ============================================================
// flow-player-4 standalone — the CDN bundle entry.
//
// Bundled to dist/exports/flow-player-4.esm.js, hosted on
// jsDelivr from the public GitHub mirror. The Webflow JSON paste
// only carries a tiny tree (.vp-slot + data-* attrs) and a
// <script type="module" src="...flow-player-4.esm.js"></script>.
//
// Per-slot config is on data-* attributes on .vp-slot. Page-level
// overrides for defaults: set window.__FLOW_PLAYER_4_CONFIG__ before
// this module evaluates.
// ============================================================

import { attachSlot, flowPlayer4Defaults, type PlayerDefaults } from './Player.ts';
import { injectRuntimeCss } from './styles.ts';

export const FLOW_PLAYER_4_BUNDLE_VERSION = '2026-05-18-v4-init';

declare global {
  interface Window {
    __FLOW_PLAYER_4_CONFIG__?: Partial<PlayerDefaults>;
    __FLOW_PLAYER_4__?: {
      version: string;
      attach(slot: HTMLElement): void;
    };
  }
}

const config =
  (typeof window !== 'undefined' && window.__FLOW_PLAYER_4_CONFIG__) || {};
const defaults: PlayerDefaults = { ...flowPlayer4Defaults, ...config };

function attachOne(slot: HTMLElement): void {
  attachSlot(slot, { defaults });
}

function initAll(): void {
  injectRuntimeCss();
  document.documentElement.setAttribute(
    'data-flow-player-4-version',
    FLOW_PLAYER_4_BUNDLE_VERSION,
  );
  const slots = document.querySelectorAll<HTMLElement>(
    '.vp-slot[data-video-url], .vp-slot[data-vimeo-url], .vp-slot[data-youtube-url]',
  );
  for (const slot of slots) {
    attachOne(slot);
  }
}

if (typeof window !== 'undefined') {
  window.__FLOW_PLAYER_4__ = {
    version: FLOW_PLAYER_4_BUNDLE_VERSION,
    attach: attachOne,
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
}
