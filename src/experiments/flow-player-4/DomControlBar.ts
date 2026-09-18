// ============================================================
// DomControlBar — uiMode='webflow'. Wires up control elements
// designers built by hand in the Webflow tree, looked up by
// `[data-vp="<role>"]`. No DOM creation.
//
// Recognised roles (all optional — omit one to hide that feature):
//   data-vp="play"        toggle play/pause
//   data-vp="progress"    scrubber wrapper; first child .vp-scrub-played /
//                         .vp-scrub-buffered / .vp-scrub-thumb get updated
//   data-vp="mute"        toggle mute
//   data-vp="volume"      volume slider wrapper (same layout as progress)
//   data-vp="settings"    settings trigger (menu is .vp-settings-menu inside .vp-settings)
//   data-vp="fullscreen"  toggle fullscreen
//
// V4 differences vs v3:
//   - No captions, restart, PiP wiring.
//   - Progress + Volume use div-based scrubbers (.vp-scrub-* / .vp-volume-*),
//     not <input type=range>.
// ============================================================

import type { Provider } from './providers/types.ts';
import { formatTime } from './helpers.ts';
import { bindSettings } from './Settings.ts';
import type { FullscreenController } from './Fullscreen.ts';
import type { StateBridge } from './StateBridge.ts';

interface Options {
  slot: HTMLElement;
  provider: Provider;
  fullscreen: FullscreenController;
  state: StateBridge;
}

interface Handles {
  el: HTMLElement | null;
  destroy(): void;
}

function $byVp<T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
): T | null {
  return root.querySelector<T>(`[data-vp="${role}"]`);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Pointer-driven horizontal slider helper, shared by progress + volume. */
function bindHorizontalSlider(
  track: HTMLElement,
  opts: {
    onScrub?: (frac: number) => void;
    onCommit: (frac: number) => void;
    onScrubStart?: () => void;
    onScrubEnd?: () => void;
  },
): { isDragging(): boolean; destroy(): void } {
  let dragging = false;
  let activePointerId: number | null = null;

  function frac(clientX: number): number {
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return clamp01((clientX - rect.left) / rect.width);
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    activePointerId = e.pointerId;
    track.setPointerCapture(e.pointerId);
    track.classList.add('is-dragging');
    opts.onScrubStart?.();
    opts.onScrub?.(frac(e.clientX));
    e.preventDefault();
  }
  function onPointerMove(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    opts.onScrub?.(frac(e.clientX));
  }
  function endDrag(e: PointerEvent): void {
    if (!dragging || e.pointerId !== activePointerId) return;
    const f = frac(e.clientX);
    dragging = false;
    activePointerId = null;
    try {
      track.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    track.classList.remove('is-dragging');
    opts.onCommit(f);
    opts.onScrubEnd?.();
  }

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  return {
    isDragging: () => dragging,
    destroy: () => {
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', endDrag);
      track.removeEventListener('pointercancel', endDrag);
    },
  };
}

export function bindDomControlBar(opts: Options): Handles {
  const { slot, provider, fullscreen, state } = opts;
  const bar = slot.querySelector<HTMLElement>('.vp-controls');
  if (!bar) return { el: null, destroy: () => {} };

  const cleanups: Array<() => void> = [];
  const off = (fn: () => void): void => {
    cleanups.push(fn);
  };

  // ── Play / pause ──
  const playBtn = $byVp(bar, 'play');
  if (playBtn) {
    const onClick = (): void => {
      if (provider.state.paused) provider.play();
      else provider.pause();
    };
    playBtn.addEventListener('click', onClick);
    off(() => playBtn.removeEventListener('click', onClick));
    off(
      provider.on('play', () => {
        playBtn.setAttribute('aria-pressed', 'true');
        playBtn.setAttribute('aria-label', 'Pause');
        state.setState('playing');
      }),
    );
    off(
      provider.on('pause', () => {
        playBtn.setAttribute('aria-pressed', 'false');
        playBtn.setAttribute('aria-label', 'Play');
        state.setState('paused');
      }),
    );
  }
  off(provider.on('ended', () => state.setState('ended')));

  // ── Scrubber ──
  const progressWrap = $byVp(bar, 'progress');
  if (progressWrap) {
    const played = progressWrap.querySelector<HTMLElement>('.vp-scrub-played');
    const buffered = progressWrap.querySelector<HTMLElement>('.vp-scrub-buffered');
    const thumb = progressWrap.querySelector<HTMLElement>('.vp-scrub-thumb');

    const slider = bindHorizontalSlider(progressWrap, {
      onScrub: (frac) => {
        if (played) played.style.width = `${frac * 100}%`;
        if (thumb) thumb.style.left = `${frac * 100}%`;
      },
      onCommit: (frac) => {
        const dur = provider.state.duration;
        if (dur > 0) provider.seek(frac * dur);
      },
    });
    off(() => slider.destroy());

    const sync = (): void => {
      if (slider.isDragging()) return;
      const dur = provider.state.duration;
      if (dur > 0) {
        const p = provider.state.currentTime / dur;
        if (played) played.style.width = `${p * 100}%`;
        if (thumb) thumb.style.left = `${p * 100}%`;
      }
      if (buffered) buffered.style.width = `${provider.state.buffered * 100}%`;
    };
    off(provider.on('timeupdate', sync));
    off(provider.on('progress', sync));
  }

  // ── Time ──
  const currentEl = bar.querySelector<HTMLElement>('.vp-time-current');
  const durationEl = bar.querySelector<HTMLElement>('.vp-time-duration');
  if (currentEl || durationEl) {
    const sync = (): void => {
      if (currentEl) currentEl.textContent = formatTime(provider.state.currentTime);
      if (durationEl) durationEl.textContent = formatTime(provider.state.duration);
    };
    off(provider.on('timeupdate', sync));
    off(provider.on('durationchange', sync));
  }

  // ── Mute + volume ──
  const muteBtn = $byVp(bar, 'mute');
  if (muteBtn) {
    const onClick = (): void => provider.setMuted(!provider.state.muted);
    muteBtn.addEventListener('click', onClick);
    off(() => muteBtn.removeEventListener('click', onClick));
  }

  const volWrap = $byVp(bar, 'volume');
  const volFill = volWrap?.querySelector<HTMLElement>('.vp-volume-fill');
  const volThumb = volWrap?.querySelector<HTMLElement>('.vp-volume-thumb');
  if (volWrap) {
    const slider = bindHorizontalSlider(volWrap, {
      onScrub: (frac) => {
        provider.setVolume(frac);
        if (frac > 0 && provider.state.muted) provider.setMuted(false);
      },
      onCommit: (frac) => {
        provider.setVolume(frac);
        if (frac > 0 && provider.state.muted) provider.setMuted(false);
      },
    });
    off(() => slider.destroy());
  }

  const syncVolume = (): void => {
    const level = state.setVolume(provider.state.volume, provider.state.muted);
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', level === 'mute' ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', level === 'mute' ? 'Unmute' : 'Mute');
      muteBtn.dataset.level = level;
    }
    const v = level === 'mute' ? 0 : provider.state.volume;
    if (volFill) volFill.style.width = `${v * 100}%`;
    if (volThumb) volThumb.style.left = `${v * 100}%`;
  };
  off(provider.on('volumechange', syncVolume));
  syncVolume();

  // ── Settings ──
  const settingsWrap = bar.querySelector<HTMLElement>('.vp-settings');
  const settingsTrigger = settingsWrap?.querySelector<HTMLElement>('[data-vp="settings"]');
  const settingsMenu = settingsWrap?.querySelector<HTMLElement>('.vp-settings-menu');
  if (settingsWrap && settingsTrigger && settingsMenu) {
    off(
      bindSettings(
        { wrap: settingsWrap, trigger: settingsTrigger, menu: settingsMenu },
        provider,
        state,
      ),
    );
  }

  // ── Fullscreen ──
  const fsBtn = $byVp(bar, 'fullscreen');
  if (fsBtn) {
    const onClick = (): void => void fullscreen.toggle();
    fsBtn.addEventListener('click', onClick);
    off(() => fsBtn.removeEventListener('click', onClick));
  }

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

export function setDomControlsFullscreen(bar: HTMLElement | null, active: boolean): void {
  if (!bar) return;
  const btn = bar.querySelector<HTMLElement>('[data-vp="fullscreen"]');
  if (!btn) return;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
}
