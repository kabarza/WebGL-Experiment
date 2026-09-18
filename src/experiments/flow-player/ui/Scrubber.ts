// ============================================================
// Scrubber — fully custom DOM, with a transparent <input type="range">
// on top to handle drag/keyboard/seek. The native range thumb is
// hidden; we render our own .vp-progress-thumb positioned by calc()
// so it never overflows the track edges.
//
// DOM:
//   .vp-progress (--vp-progress-frac, --vp-buffer-frac)
//     ├─ .vp-progress-track
//     │   ├─ .vp-progress-buffer (width = --vp-buffer-frac * 100%)
//     │   └─ .vp-progress-fill   (width = --vp-progress-frac * 100%)
//     ├─ .vp-progress-thumb       (left = clamp via calc)
//     └─ <input type="range">     (transparent, full-width, on top)
// ============================================================

import type { Provider } from '../providers/types.ts';

interface ScrubberHandles {
  el: HTMLElement;
  range: HTMLInputElement;
  destroy: () => void;
}

function fmt(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function createScrubber(provider: Provider): ScrubberHandles {
  const wrap = document.createElement('div');
  wrap.className = 'vp-progress';

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

  function setFrac(frac: number): void {
    wrap.style.setProperty('--vp-progress-frac', String(frac));
  }
  function setBufferFrac(frac: number): void {
    wrap.style.setProperty('--vp-buffer-frac', String(frac));
  }

  let dragging = false;
  let pauseOnRelease = false;

  function syncFromProvider(): void {
    if (dragging) return;
    const dur = provider.state.duration;
    const cur = provider.state.currentTime;
    const frac = dur > 0 ? cur / dur : 0;
    range.value = String(frac);
    range.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    range.setAttribute('aria-valuetext', `${fmt(cur)} of ${fmt(dur)}`);
    setFrac(frac);
  }

  function syncBuffered(): void {
    setBufferFrac(provider.state.buffered);
  }

  const offTime = provider.on('timeupdate', syncFromProvider);
  const offDur = provider.on('durationchange', syncFromProvider);
  const offProg = provider.on('progress', syncBuffered);

  range.addEventListener('pointerdown', () => {
    dragging = true;
    if (!provider.state.paused) {
      pauseOnRelease = true;
      provider.pause();
    }
  });
  function onRelease(): void {
    if (!dragging) return;
    dragging = false;
    if (pauseOnRelease) {
      pauseOnRelease = false;
      provider.play();
    }
  }
  range.addEventListener('pointerup', onRelease);
  range.addEventListener('pointercancel', onRelease);
  range.addEventListener('input', () => {
    const frac = Math.max(0, Math.min(1, Number(range.value)));
    setFrac(frac);
    range.setAttribute('aria-valuenow', String(Math.round(frac * 100)));
    if (provider.state.duration > 0) {
      const target = frac * provider.state.duration;
      provider.seek(target);
      range.setAttribute(
        'aria-valuetext',
        `${fmt(target)} of ${fmt(provider.state.duration)}`,
      );
    }
  });

  syncFromProvider();
  syncBuffered();

  return {
    el: wrap,
    range,
    destroy: () => {
      offTime();
      offDur();
      offProg();
    },
  };
}

export const formatTime = fmt;
