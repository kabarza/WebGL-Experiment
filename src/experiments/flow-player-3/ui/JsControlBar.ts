// ============================================================
// JsControlBar — Option 1: control bar created at runtime.
//
// Mirrors the structure that DomControlBar wires up from Webflow
// tree elements. Same class names, same data-vp attributes — so
// the CSS in the embed's <style> block works for both modes
// without branching.
// ============================================================

import type { Provider } from '../providers/types.ts';
import type { ProviderName } from '../helpers.ts';
import { ICONS } from '../icons.ts';
import { createScrubberDom, bindScrubber, formatTime } from './Scrubber.ts';
import { createSettingsDom, bindSettings } from './Settings.ts';
import type { FullscreenController } from './Fullscreen.ts';
import type { StateBridge } from './StateBridge.ts';

interface Options {
  provider: Provider;
  providerName: ProviderName;
  fullscreen: FullscreenController;
  state: StateBridge;
  showControls: boolean;
}

interface Handles {
  el: HTMLElement;
  destroy: () => void;
}

function makeButton(opts: {
  className: string;
  ariaLabel: string;
  tooltip: string;
  innerHTML: string;
  dataVp: string;
  onClick: () => void;
}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = opts.className;
  btn.setAttribute('aria-label', opts.ariaLabel);
  btn.setAttribute('data-tooltip', opts.tooltip);
  btn.setAttribute('data-vp', opts.dataVp);
  btn.innerHTML = opts.innerHTML;
  btn.addEventListener('click', opts.onClick);
  return btn;
}

export function createJsControlBar(opts: Options): Handles {
  const { provider, providerName, fullscreen, state, showControls } = opts;

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
      provider.state.paused ? provider.play() : provider.pause();
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

  // ── Restart ──
  bar.appendChild(
    makeButton({
      className: 'vp-control vp-btn-restart',
      ariaLabel: 'Restart',
      tooltip: 'Restart',
      innerHTML: ICONS.restart,
      dataVp: 'restart',
      onClick: () => provider.seek(0),
    }),
  );

  // ── Scrubber ──
  const scrubber = createScrubberDom();
  bar.appendChild(scrubber.wrap);
  cleanups.push(bindScrubber(scrubber, provider));

  // ── Time ──
  const time = document.createElement('div');
  time.className = 'vp-time';
  const current = document.createElement('span');
  current.className = 'vp-time-current';
  current.textContent = '0:00';
  const sep = document.createElement('span');
  sep.className = 'vp-time-sep';
  sep.textContent = ' / ';
  const duration = document.createElement('span');
  duration.className = 'vp-time-duration';
  duration.textContent = '0:00';
  time.appendChild(current);
  time.appendChild(sep);
  time.appendChild(duration);
  bar.appendChild(time);

  function syncTime(): void {
    current.textContent = formatTime(provider.state.currentTime);
    duration.textContent = formatTime(provider.state.duration);
  }
  cleanups.push(provider.on('timeupdate', syncTime));
  cleanups.push(provider.on('durationchange', syncTime));

  // ── Captions toggle ──
  const ccBtn = makeButton({
    className: 'vp-control vp-btn-captions',
    ariaLabel: 'Toggle captions',
    tooltip: 'Captions',
    innerHTML: ICONS.captionsOn,
    dataVp: 'captions',
    onClick: () => {
      const tracks = provider.getTextTracks();
      const active = provider.getActiveTextTrack();
      if (active) {
        provider.setTextTrack(null);
        ccBtn.setAttribute('aria-pressed', 'false');
      } else if (tracks.length) {
        provider.setTextTrack(tracks[0].id);
        ccBtn.setAttribute('aria-pressed', 'true');
      }
    },
  });
  ccBtn.setAttribute('aria-pressed', 'false');
  ccBtn.hidden = true;
  bar.appendChild(ccBtn);

  function syncCcVisibility(): void {
    const tracks = provider.getTextTracks();
    ccBtn.hidden = tracks.length === 0;
    const active = provider.getActiveTextTrack();
    ccBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
  cleanups.push(provider.on('tracks', syncCcVisibility));

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

  const volRange = document.createElement('input');
  volRange.type = 'range';
  volRange.className = 'vp-volume';
  volRange.setAttribute('data-vp', 'volume');
  volRange.min = '0';
  volRange.max = '1';
  volRange.step = '0.01';
  volRange.value = '1';
  volRange.setAttribute('aria-label', 'Volume');
  volRange.addEventListener('input', () => {
    const v = Number(volRange.value);
    provider.setVolume(v);
    if (v > 0 && provider.state.muted) provider.setMuted(false);
  });
  volWrap.appendChild(volRange);
  bar.appendChild(volWrap);

  function syncVolume(): void {
    const level = state.setVolume(provider.state.volume, provider.state.muted);
    muteBtn.setAttribute('aria-pressed', level === 'mute' ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', level === 'mute' ? 'Unmute' : 'Mute');
    muteBtn.setAttribute('data-tooltip', level === 'mute' ? 'Unmute (M)' : 'Mute (M)');
    muteBtn.dataset.level = level;
    if (!volRange.matches(':active')) {
      volRange.value = String(level === 'mute' ? 0 : provider.state.volume);
    }
    volWrap.style.setProperty('--vp-volume', `${(level === 'mute' ? 0 : provider.state.volume) * 100}%`);
  }
  cleanups.push(provider.on('volumechange', syncVolume));
  syncVolume();

  // ── Settings ──
  const settingsEls = createSettingsDom();
  bar.appendChild(settingsEls.wrap);
  cleanups.push(bindSettings(settingsEls, provider, state));

  // ── PiP (Vimeo only) ──
  if (providerName === 'vimeo') {
    bar.appendChild(
      makeButton({
        className: 'vp-control vp-btn-pip',
        ariaLabel: 'Picture in picture',
        tooltip: 'Picture in picture',
        innerHTML: ICONS.pip,
        dataVp: 'pip',
        onClick: () => {
          provider.requestPictureInPicture().catch(() => {});
        },
      }),
    );
  }

  // ── Fullscreen ──
  const fsBtn = makeButton({
    className: 'vp-control vp-btn-fullscreen',
    ariaLabel: 'Enter fullscreen',
    tooltip: 'Fullscreen (F)',
    innerHTML: `<span class="vp-icon-fs-enter">${ICONS.fullscreenEnter}</span><span class="vp-icon-fs-exit">${ICONS.fullscreenExit}</span>`,
    dataVp: 'fullscreen',
    onClick: () => fullscreen.toggle(),
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
  const btn = bar.querySelector<HTMLButtonElement>('.vp-btn-fullscreen');
  if (!btn) return;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');
  btn.setAttribute('data-tooltip', active ? 'Exit fullscreen (F)' : 'Fullscreen (F)');
}
