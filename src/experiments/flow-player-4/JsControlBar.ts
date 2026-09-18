// ============================================================
// JsControlBar — JS-rendered control bar. Used in uiMode='js'.
//
// V4 differences vs v3:
//   - All buttons are <div role="button" tabindex="0"> (Webflow's
//     data model corrupted v3 when we used <button>).
//   - Volume is a small div-based scrubber, not <input type=range>
//     (same reason).
//   - No restart, no captions, no PiP — dropped from v4 scope.
//
// Structure mirrors DomControlBar so the same CSS rules apply to
// both modes (`.vp-controls > .vp-control[data-vp=...]`).
// ============================================================

import type { Provider } from './providers/types.ts';
import { ICONS } from './icons.ts';
import { formatTime } from './helpers.ts';
import { createScrubber } from './Scrubber.ts';
import { createSettingsDom, bindSettings } from './Settings.ts';
import type { FullscreenController } from './Fullscreen.ts';
import type { StateBridge } from './StateBridge.ts';

interface Options {
  provider: Provider;
  fullscreen: FullscreenController;
  state: StateBridge;
  showControls: boolean;
}

interface Handles {
  el: HTMLElement;
  destroy(): void;
}

interface ButtonOptions {
  className: string;
  ariaLabel: string;
  tooltip: string;
  innerHTML: string;
  dataVp: string;
  onClick: () => void;
}

function makeButton(opts: ButtonOptions): HTMLDivElement {
  const el = document.createElement('div');
  el.className = opts.className;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', opts.ariaLabel);
  el.setAttribute('data-tooltip', opts.tooltip);
  el.setAttribute('data-vp', opts.dataVp);
  el.innerHTML = opts.innerHTML;
  el.addEventListener('click', opts.onClick);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      opts.onClick();
    }
  });
  return el;
}

function createVolumeSlider(provider: Provider): {
  root: HTMLDivElement;
  destroy(): void;
  sync(volume: number, muted: boolean): void;
} {
  const root = document.createElement('div');
  root.className = 'vp-volume';
  root.setAttribute('role', 'slider');
  root.setAttribute('aria-label', 'Volume');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.setAttribute('aria-valuenow', '100');
  root.tabIndex = 0;

  const fill = document.createElement('div');
  fill.className = 'vp-volume-fill';
  root.appendChild(fill);
  const thumb = document.createElement('div');
  thumb.className = 'vp-volume-thumb';
  root.appendChild(thumb);

  let dragging = false;
  let activePointerId: number | null = null;

  function clamp01(n: number): number {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }
  function fracFromX(clientX: number): number {
    const rect = root.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  }
  function commit(frac: number): void {
    provider.setVolume(frac);
    if (frac > 0 && provider.state.muted) provider.setMuted(false);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    activePointerId = e.pointerId;
    root.setPointerCapture(e.pointerId);
    commit(fracFromX(e.clientX));
    e.preventDefault();
  }
  function onPointerMove(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    commit(fracFromX(e.clientX));
  }
  function endDrag(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    activePointerId = null;
    try {
      root.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }
  function onKeyDown(e: KeyboardEvent): void {
    const step = e.shiftKey ? 0.1 : 0.05;
    const current = provider.state.volume;
    let next = current;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = clamp01(current + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = clamp01(current - step);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = 1;
    else return;
    e.preventDefault();
    commit(next);
  }

  root.addEventListener('pointerdown', onPointerDown);
  root.addEventListener('pointermove', onPointerMove);
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);
  root.addEventListener('keydown', onKeyDown);

  return {
    root,
    sync(volume, muted) {
      const v = muted ? 0 : clamp01(volume);
      fill.style.width = `${v * 100}%`;
      thumb.style.left = `${v * 100}%`;
      root.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    },
    destroy() {
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', endDrag);
      root.removeEventListener('pointercancel', endDrag);
      root.removeEventListener('keydown', onKeyDown);
    },
  };
}

export function createJsControlBar(opts: Options): Handles {
  const { provider, fullscreen, state, showControls } = opts;

  const bar = document.createElement('div');
  bar.className = 'vp-controls';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Video controls');
  if (!showControls) bar.classList.add('vp-controls--hidden');

  const cleanups: Array<() => void> = [];

  // ── Play / pause ──
  const playBtn = makeButton({
    className: 'vp-control vp-btn-play',
    ariaLabel: 'Play',
    tooltip: 'Play (Space)',
    innerHTML: `<span class="vp-icon-play">${ICONS.play}</span><span class="vp-icon-pause">${ICONS.pause}</span>`,
    dataVp: 'play',
    onClick: () => {
      if (provider.state.paused) provider.play();
      else provider.pause();
    },
  });
  playBtn.setAttribute('aria-pressed', 'false');
  cleanups.push(
    provider.on('play', () => {
      playBtn.setAttribute('aria-pressed', 'true');
      playBtn.setAttribute('aria-label', 'Pause');
      playBtn.setAttribute('data-tooltip', 'Pause (Space)');
      state.setState('playing');
    }),
  );
  cleanups.push(
    provider.on('pause', () => {
      playBtn.setAttribute('aria-pressed', 'false');
      playBtn.setAttribute('aria-label', 'Play');
      playBtn.setAttribute('data-tooltip', 'Play (Space)');
      state.setState('paused');
    }),
  );
  cleanups.push(
    provider.on('ended', () => {
      state.setState('ended');
    }),
  );
  bar.appendChild(playBtn);

  // ── Scrubber ──
  const scrubber = createScrubber({
    onScrub: (frac) => {
      const dur = provider.state.duration;
      if (dur > 0) currentEl.textContent = formatTime(frac * dur);
    },
    onCommit: (frac) => {
      const dur = provider.state.duration;
      if (dur > 0) provider.seek(frac * dur);
    },
    onScrubStart: () => {
      // Player may listen to data-state, but we leave that to provider events.
    },
  });
  bar.appendChild(scrubber.root);
  cleanups.push(() => scrubber.destroy());

  function syncScrubber(): void {
    const dur = provider.state.duration;
    if (dur > 0) {
      scrubber.setProgress(provider.state.currentTime / dur, provider.state.buffered);
    }
  }
  cleanups.push(provider.on('timeupdate', syncScrubber));
  cleanups.push(provider.on('progress', syncScrubber));

  // ── Time ──
  const time = document.createElement('div');
  time.className = 'vp-time';
  const currentEl = document.createElement('span');
  currentEl.className = 'vp-time-current';
  currentEl.textContent = '0:00';
  const sep = document.createElement('span');
  sep.className = 'vp-time-sep';
  sep.textContent = ' / ';
  const durationEl = document.createElement('span');
  durationEl.className = 'vp-time-duration';
  durationEl.textContent = '0:00';
  time.append(currentEl, sep, durationEl);
  bar.appendChild(time);

  function syncTime(): void {
    if (!scrubber.isDragging()) {
      currentEl.textContent = formatTime(provider.state.currentTime);
    }
    durationEl.textContent = formatTime(provider.state.duration);
  }
  cleanups.push(provider.on('timeupdate', syncTime));
  cleanups.push(provider.on('durationchange', syncTime));

  // ── Mute + volume ──
  const volWrap = document.createElement('div');
  volWrap.className = 'vp-volume-group';

  const muteBtn = makeButton({
    className: 'vp-control vp-btn-mute',
    ariaLabel: 'Mute',
    tooltip: 'Mute (M)',
    innerHTML: `<span class="vp-icon-vol-full">${ICONS.volumeFull}</span><span class="vp-icon-vol-mid">${ICONS.volumeMid}</span><span class="vp-icon-vol-mute">${ICONS.volumeMute}</span>`,
    dataVp: 'mute',
    onClick: () => provider.setMuted(!provider.state.muted),
  });
  muteBtn.setAttribute('aria-pressed', 'false');
  volWrap.appendChild(muteBtn);

  const volSlider = createVolumeSlider(provider);
  volWrap.appendChild(volSlider.root);
  cleanups.push(() => volSlider.destroy());
  bar.appendChild(volWrap);

  function syncVolume(): void {
    const level = state.setVolume(provider.state.volume, provider.state.muted);
    muteBtn.setAttribute('aria-pressed', level === 'mute' ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', level === 'mute' ? 'Unmute' : 'Mute');
    muteBtn.setAttribute('data-tooltip', level === 'mute' ? 'Unmute (M)' : 'Mute (M)');
    muteBtn.dataset.level = level;
    volSlider.sync(provider.state.volume, provider.state.muted);
  }
  cleanups.push(provider.on('volumechange', syncVolume));
  syncVolume();

  // ── Settings ──
  const settingsEls = createSettingsDom();
  bar.appendChild(settingsEls.wrap);
  cleanups.push(bindSettings(settingsEls, provider, state));

  // ── Fullscreen ──
  const fsBtn = makeButton({
    className: 'vp-control vp-btn-fullscreen',
    ariaLabel: 'Enter fullscreen',
    tooltip: 'Fullscreen (F)',
    innerHTML: `<span class="vp-icon-fs-enter">${ICONS.fullscreenEnter}</span><span class="vp-icon-fs-exit">${ICONS.fullscreenExit}</span>`,
    dataVp: 'fullscreen',
    onClick: () => void fullscreen.toggle(),
  });
  fsBtn.setAttribute('aria-pressed', 'false');
  bar.appendChild(fsBtn);

  return {
    el: bar,
    destroy: () => {
      for (const fn of cleanups) {
        try {
          fn();
        } catch {
          /* ignore */
        }
      }
    },
  };
}

export function setJsControlsFullscreen(bar: HTMLElement, active: boolean): void {
  const btn = bar.querySelector<HTMLElement>('.vp-btn-fullscreen');
  if (!btn) return;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  btn.setAttribute('data-tooltip', active ? 'Exit fullscreen (F)' : 'Fullscreen (F)');
}
