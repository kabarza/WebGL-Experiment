// ============================================================
// ControlBar — JS-rendered, themed via Webflow classes.
//
// Layout (left → right):
//   [▶ play] [⏪ -10s] [⏩ +10s] [progress] [time] [CC] [🔊 mute][volume] [⚙] [PiP] [⛶]
//
// Toggle buttons follow Plyr's pattern: one <button> + multiple SVG
// icons; CSS shows one based on aria-pressed. Tooltips are rendered
// via a CSS pseudo-element driven by data-tooltip on each button.
// ============================================================

import type { Provider } from '../providers/types.ts';
import type { ProviderName } from '../helpers.ts';
import { ICONS } from '../icons.ts';
import { createScrubber, formatTime } from './Scrubber.ts';
import { createSettings } from './Settings.ts';
import type { createFullscreen } from './Fullscreen.ts';

interface ControlBarOptions {
  provider: Provider;
  providerName: ProviderName;
  fullscreen: ReturnType<typeof createFullscreen>;
  showControls: boolean;
}

interface ControlBarHandles {
  el: HTMLElement;
  destroy: () => void;
}

const SKIP_SECONDS = 10;

function makeButton(opts: {
  className: string;
  ariaLabel: string;
  tooltip: string;
  innerHTML: string;
  onClick: () => void;
}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = opts.className;
  btn.setAttribute('aria-label', opts.ariaLabel);
  btn.setAttribute('data-tooltip', opts.tooltip);
  btn.innerHTML = opts.innerHTML;
  btn.addEventListener('click', opts.onClick);
  return btn;
}

export function createControlBar(opts: ControlBarOptions): ControlBarHandles {
  const { provider, providerName, fullscreen, showControls } = opts;

  const bar = document.createElement('div');
  bar.className = 'vp-controls';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Video controls');
  if (!showControls) bar.classList.add('vp-controls--hidden');

  const cleanups: Array<() => void> = [];

  // ── Play / pause toggle ──
  const playBtn = makeButton({
    className: 'vp-control vp-controls-play',
    ariaLabel: 'Play',
    tooltip: 'Play (Space)',
    innerHTML: `<span class="vp-icon-play">${ICONS.play}</span><span class="vp-icon-pause">${ICONS.pause}</span>`,
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
    }),
  );
  cleanups.push(
    provider.on('pause', () => {
      playBtn.setAttribute('aria-pressed', 'false');
      playBtn.setAttribute('aria-label', 'Play');
      playBtn.setAttribute('data-tooltip', 'Play (Space)');
    }),
  );
  bar.appendChild(playBtn);

  // ── Restart ──
  const restartBtn = makeButton({
    className: 'vp-control vp-restart',
    ariaLabel: 'Restart',
    tooltip: 'Restart',
    innerHTML: ICONS.restart,
    onClick: () => provider.seek(0),
  });
  bar.appendChild(restartBtn);

  // ── Skip back / forward 10s ──
  const rewindBtn = makeButton({
    className: 'vp-control vp-rewind',
    ariaLabel: `Rewind ${SKIP_SECONDS} seconds`,
    tooltip: `Rewind ${SKIP_SECONDS}s (←)`,
    innerHTML: ICONS.rewind10,
    onClick: () => {
      provider.seek(Math.max(0, provider.state.currentTime - SKIP_SECONDS));
    },
  });
  bar.appendChild(rewindBtn);

  const forwardBtn = makeButton({
    className: 'vp-control vp-forward',
    ariaLabel: `Forward ${SKIP_SECONDS} seconds`,
    tooltip: `Forward ${SKIP_SECONDS}s (→)`,
    innerHTML: ICONS.forward10,
    onClick: () => {
      const dur = provider.state.duration || Infinity;
      provider.seek(Math.min(dur, provider.state.currentTime + SKIP_SECONDS));
    },
  });
  bar.appendChild(forwardBtn);

  // ── Scrubber ──
  const scrubber = createScrubber(provider);
  bar.appendChild(scrubber.el);
  cleanups.push(scrubber.destroy);

  // ── Time display ──
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
    className: 'vp-control vp-captions',
    ariaLabel: 'Toggle captions',
    tooltip: 'Captions',
    innerHTML: ICONS.captionsOn,
    onClick: () => {
      const tracks = provider.getTextTracks();
      const active = provider.getActiveTextTrack();
      if (active) {
        provider.setTextTrack(null);
        ccBtn.setAttribute('aria-pressed', 'false');
      } else if (tracks.length) {
        // Pick the first track — usually the matched-language track.
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

  // ── Mute toggle + volume slider ──
  const volumeWrap = document.createElement('div');
  volumeWrap.className = 'vp-volume-group';

  const muteBtn = makeButton({
    className: 'vp-control vp-mute',
    ariaLabel: 'Mute',
    tooltip: 'Mute (M)',
    innerHTML: `<span class="vp-icon-vol-full">${ICONS.volumeFull}</span><span class="vp-icon-vol-mid">${ICONS.volumeMid}</span><span class="vp-icon-vol-mute">${ICONS.volumeMute}</span>`,
    onClick: () => {
      provider.setMuted(!provider.state.muted);
    },
  });
  muteBtn.setAttribute('aria-pressed', 'false');
  volumeWrap.appendChild(muteBtn);

  const volRange = document.createElement('input');
  volRange.type = 'range';
  volRange.className = 'vp-volume';
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
  volumeWrap.appendChild(volRange);
  bar.appendChild(volumeWrap);

  function syncVolume(): void {
    const muted = provider.state.muted || provider.state.volume === 0;
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    muteBtn.setAttribute('data-tooltip', muted ? 'Unmute (M)' : 'Mute (M)');
    muteBtn.dataset.level = muted
      ? 'mute'
      : provider.state.volume < 0.5
        ? 'mid'
        : 'full';
    if (!volRange.matches(':active')) {
      volRange.value = String(muted ? 0 : provider.state.volume);
    }
    volumeWrap.style.setProperty(
      '--vp-volume',
      `${(muted ? 0 : provider.state.volume) * 100}%`,
    );
  }
  cleanups.push(provider.on('volumechange', syncVolume));
  syncVolume();

  // ── Settings menu (speed + captions) ──
  const settings = createSettings(provider);
  bar.appendChild(settings.menu);
  cleanups.push(settings.destroy);

  // ── Picture-in-Picture (Vimeo only) ──
  if (providerName === 'vimeo') {
    const pipBtn = makeButton({
      className: 'vp-control vp-pip',
      ariaLabel: 'Picture in picture',
      tooltip: 'Picture in picture',
      innerHTML: ICONS.pip,
      onClick: () => {
        provider.requestPictureInPicture().catch(() => {
          /* iframe denied */
        });
      },
    });
    bar.appendChild(pipBtn);
  }

  // ── Fullscreen toggle ──
  const fsBtn = makeButton({
    className: 'vp-control vp-fullscreen',
    ariaLabel: 'Enter fullscreen',
    tooltip: 'Fullscreen (F)',
    innerHTML: `<span class="vp-icon-fs-enter">${ICONS.fullscreenEnter}</span><span class="vp-icon-fs-exit">${ICONS.fullscreenExit}</span>`,
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

export function setFullscreenState(bar: HTMLElement, active: boolean): void {
  const btn = bar.querySelector<HTMLButtonElement>('.vp-fullscreen');
  if (!btn) return;
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.setAttribute(
    'aria-label',
    active ? 'Exit fullscreen' : 'Enter fullscreen',
  );
  btn.setAttribute(
    'data-tooltip',
    active ? 'Exit fullscreen (F)' : 'Fullscreen (F)',
  );
}
