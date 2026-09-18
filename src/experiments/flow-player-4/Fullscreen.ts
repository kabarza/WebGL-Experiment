// ============================================================
// Fullscreen — standard API + vendor-prefix detection + a CSS
// pseudo-fullscreen fallback (iOS Safari refuses to fullscreen
// arbitrary elements containing iframes). Writes data-fullscreen
// on the slot via the StateBridge.
// ============================================================

import type { StateBridge } from './StateBridge.ts';

interface PrefixedDocument extends Document {
  webkitFullscreenElement?: Element;
  mozFullScreenElement?: Element;
  msFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
  mozCancelFullScreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

const PSEUDO_CLASS = 'vp-pseudo-fullscreen';

export function createFullscreen(slot: HTMLElement, state: StateBridge) {
  const doc = document as PrefixedDocument;
  let pseudoActive = false;

  function isNativeActive(): boolean {
    return !!(
      document.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );
  }
  function isActive(): boolean {
    return isNativeActive() || pseudoActive;
  }

  async function enter(): Promise<void> {
    const el = slot as PrefixedElement;
    try {
      if (el.requestFullscreen) return void (await el.requestFullscreen());
      if (el.webkitRequestFullscreen) return void (await el.webkitRequestFullscreen());
      if (el.mozRequestFullScreen) return void (await el.mozRequestFullScreen());
      if (el.msRequestFullscreen) return void (await el.msRequestFullscreen());
    } catch {
      /* fall through to pseudo */
    }
    pseudoActive = true;
    slot.classList.add(PSEUDO_CLASS);
    state.setFullscreen(true);
  }

  async function exit(): Promise<void> {
    if (pseudoActive) {
      pseudoActive = false;
      slot.classList.remove(PSEUDO_CLASS);
      state.setFullscreen(false);
      return;
    }
    try {
      if (document.exitFullscreen) return void (await document.exitFullscreen());
      if (doc.webkitExitFullscreen) return void (await doc.webkitExitFullscreen());
      if (doc.mozCancelFullScreen) return void (await doc.mozCancelFullScreen());
      if (doc.msExitFullscreen) return void (await doc.msExitFullscreen());
    } catch {
      /* ignore */
    }
  }

  function handleNativeChange(): void {
    state.setFullscreen(isNativeActive());
  }
  document.addEventListener('fullscreenchange', handleNativeChange);
  document.addEventListener('webkitfullscreenchange', handleNativeChange);
  document.addEventListener('mozfullscreenchange', handleNativeChange);
  document.addEventListener('MSFullscreenChange', handleNativeChange);

  function handleEsc(e: KeyboardEvent): void {
    if (e.key === 'Escape' && pseudoActive) void exit();
  }
  document.addEventListener('keydown', handleEsc);

  return {
    isActive,
    toggle: () => (isActive() ? exit() : enter()),
    enter,
    exit,
    destroy: () => {
      document.removeEventListener('fullscreenchange', handleNativeChange);
      document.removeEventListener('webkitfullscreenchange', handleNativeChange);
      document.removeEventListener('mozfullscreenchange', handleNativeChange);
      document.removeEventListener('MSFullscreenChange', handleNativeChange);
      document.removeEventListener('keydown', handleEsc);
      if (pseudoActive) slot.classList.remove(PSEUDO_CLASS);
    },
  };
}

export type FullscreenController = ReturnType<typeof createFullscreen>;
