// ============================================================
// Scrubber — pure <div> + pointer math. Deliberately NOT an
// <input type="range">.
//
// Why: in v3, Webflow's data model rewrote our range input into
// a Block node with a tag override, which contributed to project
// corruption. A div-based scrubber survives Webflow round-trips
// cleanly and gives us full control over the visual layers
// (buffered bar, played bar, thumb).
//
// DOM layout (created by build()):
//   .vp-scrub                  (track, role="slider")
//     .vp-scrub-buffered       (0..buffered fraction)
//     .vp-scrub-played         (0..currentTime/duration)
//     .vp-scrub-thumb          (positioned at played fraction)
//
// All visual styling lives in styles.ts. Scrubber only writes
// inline width / transform values to the played/buffered/thumb
// elements.
// ============================================================

export interface ScrubberOptions {
  /** Called on each pointer move while dragging. Fraction is 0..1. */
  onScrub: (fraction: number) => void;
  /** Called on pointerup after a successful drag. */
  onCommit: (fraction: number) => void;
  /** Called when the user starts dragging (so the Player can pause). */
  onScrubStart?: () => void;
  /** Called when dragging ends. */
  onScrubEnd?: () => void;
}

export interface ScrubberHandle {
  root: HTMLDivElement;
  /** Update the visual position from external state (e.g. timeupdate). */
  setProgress(played: number, buffered: number): void;
  /** Whether the user is currently dragging. */
  isDragging(): boolean;
  destroy(): void;
}

export function createScrubber(opts: ScrubberOptions): ScrubberHandle {
  const root = document.createElement('div');
  root.className = 'vp-scrub';
  root.setAttribute('role', 'slider');
  root.setAttribute('aria-label', 'Seek');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-valuenow', '0');
  root.tabIndex = 0;

  const buffered = document.createElement('div');
  buffered.className = 'vp-scrub-buffered';
  const played = document.createElement('div');
  played.className = 'vp-scrub-played';
  const thumb = document.createElement('div');
  thumb.className = 'vp-scrub-thumb';

  root.append(buffered, played, thumb);

  let dragging = false;
  let activePointerId: number | null = null;

  function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function fractionFromPointer(clientX: number): number {
    const rect = root.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  }

  function paint(playedFrac: number, bufferedFrac: number): void {
    const p = clamp01(playedFrac);
    const b = clamp01(bufferedFrac);
    played.style.width = `${p * 100}%`;
    buffered.style.width = `${b * 100}%`;
    thumb.style.left = `${p * 100}%`;
    root.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    activePointerId = e.pointerId;
    root.setPointerCapture(e.pointerId);
    root.classList.add('is-dragging');
    opts.onScrubStart?.();
    const frac = fractionFromPointer(e.clientX);
    paint(frac, parseFloat(buffered.style.width || '0') / 100);
    opts.onScrub(frac);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    const frac = fractionFromPointer(e.clientX);
    paint(frac, parseFloat(buffered.style.width || '0') / 100);
    opts.onScrub(frac);
  }

  function endDrag(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    const frac = fractionFromPointer(e.clientX);
    dragging = false;
    activePointerId = null;
    try {
      root.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    root.classList.remove('is-dragging');
    opts.onCommit(frac);
    opts.onScrubEnd?.();
  }

  function onKeyDown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 0.05 : 0.01;
    const current = parseFloat(played.style.width || '0') / 100;
    let next = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp01(current + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp01(current - step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    else return;
    e.preventDefault();
    paint(next, parseFloat(buffered.style.width || '0') / 100);
    opts.onCommit(next);
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.addEventListener('keydown', onKeyDown);

  return {
    root,
    setProgress(playedFrac, bufferedFrac) {
      // Don't fight the user's drag.
      if (dragging) return;
      paint(playedFrac, bufferedFrac);
    },
    isDragging: () => dragging,
    destroy: () => {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', endDrag);
      root.removeEventListener('pointercancel', endDrag);
      root.removeEventListener('keydown', onKeyDown);
    },
  };
}
