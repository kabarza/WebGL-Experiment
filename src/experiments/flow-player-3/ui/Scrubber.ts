// ============================================================
// Scrubber — drives a progress bar from provider state.
//
// Same DOM shape in both UI modes:
//   .vp-progress
//   ├ .vp-progress-track
//   │ ├ .vp-progress-buffer  (width via --vp-buffer-frac)
//   │ └ .vp-progress-fill    (width via --vp-progress-frac)
//   ├ .vp-progress-thumb     (left via calc on --vp-progress-frac)
//   └ <input type="range">   (transparent, handles drag/keyboard)
//
// Option 1 (JsControlBar) creates these elements at runtime.
// Option 2 (DomControlBar) finds them in the Webflow tree and just
// passes them in. Either way, the same wiring logic applies.
// ============================================================

import type { Provider } from '../providers/types.ts';

export interface ScrubberElements {
  wrap: HTMLElement;
  range: HTMLInputElement;
}

/**
 * Build the scrubber DOM from scratch and return its container +
 * inputs. Used by Option 1.
 */
export function createScrubberDom(): ScrubberElements {
  const wrap = document.createElement('div');
  wrap.className = 'vp-progress';
  wrap.setAttribute('data-vp', 'progress');

  const track = document.createElement('div');
  track.className = 'vp-progress-track';
  wrap.appendChild(track);

  const buffer = document.createElement('div');
  buffer.className = 'vp-progress-buffer';
  track.appendChild(buffer);

  const fill = document.createElement('div');
  fill.className = 'vp-progress-fill';
  track.appendChild(fill);

  const thumb = document.createElement('div');
  thumb.className = 'vp-progress-thumb';
  wrap.appendChild(thumb);

  const range = document.createElement('input');
  range.className = 'vp-progress-range';
  range.type = 'range';
  range.min = '0';
  range.max = '1';
  range.step = '0.0001';
  range.value = '0';
  range.setAttribute('role', 'slider');
  range.setAttribute('aria-label', 'Seek');
  range.setAttribute('aria-valuemin', '0');
  range.setAttribute('aria-valuemax', '100');
  range.setAttribute('aria-valuenow', '0');
  range.setAttribute('aria-valuetext', '0:00 of 0:00');
  wrap.appendChild(range);

  return { wrap, range };
}

/**
 * Wire an existing scrubber DOM (either created above or pre-shipped
 * as Webflow tree nodes) to provider state + seek events.
 */
export function bindScrubber(
  els: ScrubberElements,
  provider: Provider,
): () => void {
  const { wrap, range } = els;
  let dragging = false;
  let pauseOnRelease = false;

  function setFrac(frac: number): void {
    wrap.style.setProperty('--vp-progress-frac', String(frac));
  }
  function setBufferFrac(frac: number): void {
    wrap.style.setProperty('--vp-buffer-frac', String(frac));
  }

  function syncFromProvider(): void {
    if (dragging) return;
    const dur = provider.state.duration;
    const cur = provider.state.currentTime;
    const frac = dur > 0 ? cur / dur : 0;
    range.value = String(frac);
    range.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    range.setAttribute('aria-valuetext', `${formatTime(cur)} of ${formatTime(dur)}`);
    setFrac(frac);
  }
  function syncBuffered(): void {
    setBufferFrac(provider.state.buffered);
  }

  const offTime = provider.on('timeupdate', syncFromProvider);
  const offDur = provider.on('durationchange', syncFromProvider);
  const offProg = provider.on('progress', syncBuffered);

  const onDown = (): void => {
    dragging = true;
    if (!provider.state.paused) {
      pauseOnRelease = true;
      provider.pause();
    }
  };
  const onRelease = (): void => {
    if (!dragging) return;
    dragging = false;
    if (pauseOnRelease) {
      pauseOnRelease = false;
      provider.play();
    }
  };
  const onInput = (): void => {
    const frac = Math.max(0, Math.min(1, Number(range.value)));
    setFrac(frac);
    range.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    if (provider.state.duration > 0) {
      const target = frac * provider.state.duration;
      provider.seek(target);
      range.setAttribute('aria-valuetext', `${formatTime(target)} of ${formatTime(provider.state.duration)}`);
    }
  };
  range.addEventListener('pointerdown', onDown);
  range.addEventListener('pointerup', onRelease);
  range.addEventListener('pointercancel', onRelease);
  range.addEventListener('input', onInput);

  syncFromProvider();
  syncBuffered();

  return () => {
    offTime();
    offDur();
    offProg();
    range.removeEventListener('pointerdown', onDown);
    range.removeEventListener('pointerup', onRelease);
    range.removeEventListener('pointercancel', onRelease);
    range.removeEventListener('input', onInput);
  };
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
