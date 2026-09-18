// ============================================================
// DomControlBar — Option 2: finds existing Webflow tree elements
// and wires them up. No DOM creation. Each element is queried by
// its `[data-vp="<role>"]` attribute (same convention as the
// flowplayplus library on vds-iphone-player-2).
//
// If an element is missing from the slot, the corresponding feature
// is silently skipped — designers can hide individual controls just
// by deleting them in the Webflow Designer.
//
// Settings menu items are still JS-rendered (into the .vp-settings-menu
// container shipped in the tree) because captions tracks are dynamic
// per video and speed selection state flips at runtime.
// ============================================================

import type { Provider } from '../providers/types.ts';
import type { ProviderName } from '../helpers.ts';
import { bindScrubber, formatTime } from './Scrubber.ts';
import { bindSettings } from './Settings.ts';
import type { FullscreenController } from './Fullscreen.ts';
import type { StateBridge } from './StateBridge.ts';

interface Options {
  slot: HTMLElement;
  provider: Provider;
  providerName: ProviderName;
  fullscreen: FullscreenController;
  state: StateBridge;
}

interface Handles {
  el: HTMLElement | null;
  destroy: () => void;
}

function $byVp<T extends HTMLElement = HTMLElement>(
  root: HTMLElement,
  role: string,
): T | null {
  return root.querySelector<T>(`[data-vp="${role}"]`);
}

export function bindDomControlBar(opts: Options): Handles {
  const { slot, provider, providerName, fullscreen, state } = opts;
  const bar = slot.querySelector<HTMLElement>('.vp-controls');
  if (!bar) {
    return { el: null, destroy: () => {} };
  }

  const cleanups: Array<() => void> = [];

  // ── Play / pause toggle ──
  const playBtn = $byVp<HTMLButtonElement>(bar, 'play');
  if (playBtn) {
    const onClick = () => {
      provider.state.paused ? provider.play() : provider.pause();
    };
    playBtn.addEventListener('click', onClick);
    cleanups.push(() => playBtn.removeEventListener('click', onClick));
    cleanups.push(
      provider.on('play', () => {
        playBtn.setAttribute('aria-pressed', 'true');
        playBtn.setAttribute('aria-label', 'Pause');
        state.setState('playing');
      }),
    );
    cleanups.push(
      provider.on('pause', () => {
        playBtn.setAttribute('aria-pressed', 'false');
        playBtn.setAttribute('aria-label', 'Play');
        state.setState('paused');
      }),
    );
  }
  cleanups.push(provider.on('ended', () => state.setState('ended')));

  // ── Restart ──
  const restartBtn = $byVp<HTMLButtonElement>(bar, 'restart');
  if (restartBtn) {
    const fn = () => provider.seek(0);
    restartBtn.addEventListener('click', fn);
    cleanups.push(() => restartBtn.removeEventListener('click', fn));
  }

  // ── Scrubber ──
  const progressWrap = $byVp<HTMLElement>(bar, 'progress');
  const range = progressWrap?.querySelector<HTMLInputElement>('.vp-progress-range');
  if (progressWrap && range) {
    cleanups.push(bindScrubber({ wrap: progressWrap, range }, provider));
  }

  // ── Time ──
  const currentEl = bar.querySelector<HTMLElement>('.vp-time-current');
  const durationEl = bar.querySelector<HTMLElement>('.vp-time-duration');
  if (currentEl || durationEl) {
    const syncTime = () => {
      if (currentEl) currentEl.textContent = formatTime(provider.state.currentTime);
      if (durationEl) durationEl.textContent = formatTime(provider.state.duration);
    };
    cleanups.push(provider.on('timeupdate', syncTime));
    cleanups.push(provider.on('durationchange', syncTime));
  }

  // ── Captions toggle ──
  const ccBtn = $byVp<HTMLButtonElement>(bar, 'captions');
  if (ccBtn) {
    ccBtn.hidden = true;
    const onClick = () => {
      const tracks = provider.getTextTracks();
      const active = provider.getActiveTextTrack();
      if (active) {
        provider.setTextTrack(null);
        ccBtn.setAttribute('aria-pressed', 'false');
      } else if (tracks.length) {
        provider.setTextTrack(tracks[0].id);
        ccBtn.setAttribute('aria-pressed', 'true');
      }
    };
    ccBtn.addEventListener('click', onClick);
    cleanups.push(() => ccBtn.removeEventListener('click', onClick));
    cleanups.push(
      provider.on('tracks', () => {
        const tracks = provider.getTextTracks();
        ccBtn.hidden = tracks.length === 0;
        const active = provider.getActiveTextTrack();
        ccBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }),
    );
  }

  // ── Mute + volume ──
  const volGroup = bar.querySelector<HTMLElement>('.vp-volume-group');
  const muteBtn = $byVp<HTMLButtonElement>(bar, 'mute');
  const volRange = $byVp<HTMLInputElement>(bar, 'volume');
  if (muteBtn) {
    const onClick = () => provider.setMuted(!provider.state.muted);
    muteBtn.addEventListener('click', onClick);
    cleanups.push(() => muteBtn.removeEventListener('click', onClick));
  }
  if (volRange) {
    const onInput = () => {
      const v = Number(volRange.value);
      provider.setVolume(v);
      if (v > 0 && provider.state.muted) provider.setMuted(false);
    };
    volRange.addEventListener('input', onInput);
    cleanups.push(() => volRange.removeEventListener('input', onInput));
  }
  const syncVolume = () => {
    const level = state.setVolume(provider.state.volume, provider.state.muted);
    if (muteBtn) {
      muteBtn.setAttribute('aria-pressed', level === 'mute' ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', level === 'mute' ? 'Unmute' : 'Mute');
      muteBtn.dataset.level = level;
    }
    if (volRange && !volRange.matches(':active')) {
      volRange.value = String(level === 'mute' ? 0 : provider.state.volume);
    }
    if (volGroup) {
      volGroup.style.setProperty('--vp-volume', `${(level === 'mute' ? 0 : provider.state.volume) * 100}%`);
    }
  };
  cleanups.push(provider.on('volumechange', syncVolume));
  syncVolume();

  // ── Settings ──
  const settingsWrap = bar.querySelector<HTMLElement>('.vp-settings');
  const settingsTrigger = settingsWrap?.querySelector<HTMLButtonElement>(
    '[data-vp="settings"]',
  );
  const settingsMenu = settingsWrap?.querySelector<HTMLDivElement>('.vp-settings-menu');
  if (settingsWrap && settingsTrigger && settingsMenu) {
    cleanups.push(
      bindSettings(
        { wrap: settingsWrap, trigger: settingsTrigger, menu: settingsMenu },
        provider,
        state,
      ),
    );
  }

  // ── PiP — hide for YouTube ──
  const pipBtn = $byVp<HTMLButtonElement>(bar, 'pip');
  if (pipBtn) {
    if (providerName !== 'vimeo') {
      pipBtn.hidden = true;
    } else {
      const onClick = () => {
        provider.requestPictureInPicture().catch(() => {});
      };
      pipBtn.addEventListener('click', onClick);
      cleanups.push(() => pipBtn.removeEventListener('click', onClick));
    }
  }

  // ── Fullscreen ──
  const fsBtn = $byVp<HTMLButtonElement>(bar, 'fullscreen');
  if (fsBtn) {
    const onClick = () => fullscreen.toggle();
    fsBtn.addEventListener('click', onClick);
    cleanups.push(() => fsBtn.removeEventListener('click', onClick));
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
  const btn = bar.querySelector<HTMLButtonElement>('[data-vp="fullscreen"]');
  if (!btn) return;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
}
