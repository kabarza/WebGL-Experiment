// ============================================================
// Keyboard shortcuts. Bound to the slot (tabindex=0) so shortcuts
// only fire when the player has focus. Plyr-style key map.
//
// Note: V4 uses div[role=button], so the v3 HTMLButtonElement guard
// is replaced with a role-based check.
// ============================================================

import type { Provider } from './providers/types.ts';
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

function isFocusedRoleButton(): boolean {
  const a = document.activeElement;
  if (!(a instanceof HTMLElement)) return false;
  return a.getAttribute('role') === 'button';
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

  const clamp = (v: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, v));

  function handle(e: KeyboardEvent): void {
    if (isEditable(e.target)) return;
    if (!slot.contains(document.activeElement)) return;

    const dur = provider.state.duration;
    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        // Don't override Space/Enter on focused role=button (let it click).
        if (isFocusedRoleButton()) return;
        e.preventDefault();
        if (provider.state.paused) provider.play();
        else provider.pause();
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
        void opts.fullscreen.toggle();
        return;
    }

    if (/^[0-9]$/.test(e.key) && dur > 0) {
      e.preventDefault();
      const pct = Number(e.key) / 10;
      provider.seek(pct * dur);
    }
  }

  slot.addEventListener('keydown', handle);
  return () => slot.removeEventListener('keydown', handle);
}
