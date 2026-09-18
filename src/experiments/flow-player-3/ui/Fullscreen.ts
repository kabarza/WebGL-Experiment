// ============================================================
// Fullscreen — standard API + vendor-prefix detection + a CSS
// fallback for browsers that won't fullscreen an iframe (iOS
// Safari + YouTube). Writes data-fullscreen on the slot via the
// StateBridge so CSS can react.
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
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return;
      }
      if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
        return;
      }
      if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen();
        return;
      }
      if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
        return;
      }
    } catch {
      // Fall through to pseudo-fullscreen.
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
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return;
      }
      if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
        return;
      }
      if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen();
        return;
      }
      if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
        return;
      }
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
    if (e.key === 'Escape' && pseudoActive) exit();
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
