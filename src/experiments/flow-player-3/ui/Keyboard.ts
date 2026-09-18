// ============================================================
// Keyboard shortcuts. Bound to the slot element with tabindex=0
// so listeners only fire when the player has focus. Plyr-style
// key map; non-editable-element guard so typing into a form on
// the same page never seeks the video.
// ============================================================

import type { Provider } from '../providers/types.ts';
import type { createFullscreen } from './Fullscreen.ts';

const SEEK_STEP = 10;
const VOLUME_STEP = 0.1;

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

interface KeyboardOptions {
  fullscreen: ReturnType<typeof createFullscreen>;
}

export function bindKeyboard(
  slot: HTMLElement,
  provider: Provider,
  opts: KeyboardOptions,
): () => void {
  if (!slot.hasAttribute('tabindex')) slot.setAttribute('tabindex', '0');

  function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }

  function handle(e: KeyboardEvent): void {
    // Don't hijack typing in unrelated form fields anywhere on the page.
    if (isEditable(e.target)) return;

    // Only fire when focus is inside the slot. (Tab into the player =
    // shortcuts active. Tab away = inactive.)
    if (!slot.contains(document.activeElement)) return;

    const dur = provider.state.duration;
    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        // Don't override Space/Enter on actual buttons inside the bar.
        if (
          document.activeElement instanceof HTMLButtonElement ||
          document.activeElement instanceof HTMLInputElement
        ) {
          return;
        }
        e.preventDefault();
        provider.state.paused ? provider.play() : provider.pause();
        return;
      case 'ArrowLeft':
        e.preventDefault();
        provider.seek(Math.max(0, provider.state.currentTime - SEEK_STEP));
        return;
      case 'ArrowRight':
        e.preventDefault();
        provider.seek(Math.min(dur || 0, provider.state.currentTime + SEEK_STEP));
        return;
      case 'ArrowUp':
        e.preventDefault();
        provider.setVolume(clamp(provider.state.volume + VOLUME_STEP, 0, 1));
        if (provider.state.muted) provider.setMuted(false);
        return;
      case 'ArrowDown':
        e.preventDefault();
        provider.setVolume(clamp(provider.state.volume - VOLUME_STEP, 0, 1));
        return;
      case 'm':
      case 'M':
        e.preventDefault();
        provider.setMuted(!provider.state.muted);
        return;
      case 'f':
      case 'F':
        e.preventDefault();
        opts.fullscreen.toggle();
        return;
    }

    // Number keys 0–9: seek to N×10%.
    if (/^[0-9]$/.test(e.key) && dur > 0) {
      e.preventDefault();
      const pct = Number(e.key) / 10;
      provider.seek(pct * dur);
    }
  }

  slot.addEventListener('keydown', handle);
  return () => slot.removeEventListener('keydown', handle);
}
