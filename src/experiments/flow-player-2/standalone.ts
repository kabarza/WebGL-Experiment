// ============================================================
// flow-player-2 standalone — entry point that runs once on the
// Webflow page. Bundled to dist/exports/flow-player-2.esm.js by
// scripts/build-export-esm.ts and inlined into the Webflow JSON
// HtmlEmbed.
//
// The DOM is built in Webflow (the JSON paste creates real
// nodes). This script just walks every .fp-wrapper and binds the
// runtime to it. Idempotent: safe to load twice.
// ============================================================

import { bindAll, type RuntimeOptions } from './runtime.ts';

declare global {
  interface Window {
    __FLOW_PLAYER_2_CONFIG__?: RuntimeOptions;
  }
}

const config =
  (typeof window !== 'undefined' && window.__FLOW_PLAYER_2_CONFIG__) || {};

function init(): void {
  bindAll(config);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
