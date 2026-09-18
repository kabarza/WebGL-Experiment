// ============================================================
// flow-player-2 DOM template builder.
//
// Same shape used by:
//   - the in-app preview (experiment.ts → builds real elements)
//   - the Webflow JSON export (generateExport.ts → emits node JSON)
//
// Keeping them in sync is the whole point of this experiment, so
// the structure and data-video attribute names live here. The
// preview builder produces real elements; the JSON generator
// hand-mirrors the same hierarchy and class names.
// ============================================================

import {
  ICON_BACK,
  ICON_CHECK,
  ICON_FORWARD,
  ICON_FULLSCREEN,
  ICON_MINIMIZE,
  ICON_PAUSE,
  ICON_PLAY,
  ICON_REPLAY,
  ICON_SETTINGS,
  ICON_VOLUME_FULL,
  ICON_VOLUME_MID,
  ICON_VOLUME_MUTE,
} from './icons.ts';

export interface BuildOptions {
  videoUrl: string;
  posterUrl: string;
  accentColor: string;
  trackColor: string;
  bufferColor: string;
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  playsinline: boolean;
}

/** Speed menu items shown to designers. */
export const SPEED_OPTIONS = [
  { rate: 0.5, label: '0.5x' },
  { rate: 1, label: 'Normal' },
  { rate: 1.25, label: '1.25x' },
  { rate: 1.5, label: '1.5x' },
  { rate: 2, label: '2x' },
] as const;

/** Quality menu items — designers can add more <source> elements
 *  with matching data-video-src-quality values to expand. */
export const QUALITY_OPTIONS = [{ value: '720p', label: '720p' }] as const;

function el(tag: string, className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

function setIcon(node: HTMLElement, svg: string): void {
  node.innerHTML = svg;
}

function setAttrs(
  node: HTMLElement,
  attrs: Record<string, string | boolean | undefined | null>,
): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === undefined || v === null) continue;
    node.setAttribute(k, v === true ? '' : String(v));
  }
}

/**
 * Build the full player DOM tree as actual HTMLElements. Used by
 * the in-app preview. Returns the wrapper.
 */
export function buildPreviewDom(opts: BuildOptions): HTMLElement {
  const wrapper = el('div', 'fp-wrapper');
  setAttrs(wrapper, {
    'data-video': 'wrapper',
    'data-src': opts.videoUrl,
    'data-poster': opts.posterUrl,
    'data-accent': opts.accentColor,
    'data-track': opts.trackColor,
    'data-buffer': opts.bufferColor,
    'data-autoplay': opts.autoplay ? 'true' : 'false',
    'data-muted': opts.muted ? 'true' : 'false',
    'data-loop': opts.loop ? 'true' : 'false',
    'data-playsinline': opts.playsinline ? 'true' : 'false',
  });
  wrapper.tabIndex = 0;

  // ── Stage ─────────────────────────────────────────────
  const stage = el('div', 'fp-stage');

  const video = document.createElement('video');
  video.className = 'fp-video';
  setAttrs(video, {
    'data-video': 'video',
    preload: 'metadata',
    crossorigin: 'anonymous',
  });
  if (opts.muted) video.muted = true;
  if (opts.loop) video.loop = true;
  video.playsInline = opts.playsinline;
  // <source> elements — designers can add more with data-video-src-quality.
  const source = document.createElement('source');
  setAttrs(source, {
    src: opts.videoUrl,
    type: 'video/mp4',
    'data-video-src-quality': '720p',
  });
  video.appendChild(source);
  stage.appendChild(video);

  const poster = el('div', 'fp-poster');
  poster.setAttribute('data-video', 'poster');
  const posterImg = document.createElement('img');
  posterImg.className = 'fp-poster-image';
  posterImg.alt = '';
  posterImg.src = opts.posterUrl;
  posterImg.loading = 'lazy';
  poster.appendChild(posterImg);
  stage.appendChild(poster);

  const bigPlay = el('div', 'fp-big-play');
  bigPlay.setAttribute('data-video', 'big-play');
  bigPlay.setAttribute('role', 'button');
  bigPlay.setAttribute('aria-label', 'Play');
  const bigCircle = el('div', 'fp-big-play-circle');
  const bigIcon = el('div', 'fp-big-play-icon');
  setIcon(bigIcon, ICON_PLAY);
  bigCircle.appendChild(bigIcon);
  bigPlay.appendChild(bigCircle);
  stage.appendChild(bigPlay);

  wrapper.appendChild(stage);

  // ── Controls bar ──────────────────────────────────────
  const controls = el('div', 'fp-controls');
  controls.setAttribute('data-video', 'controls');

  // Progress bar.
  const progress = el('div', 'fp-progress');
  progress.setAttribute('data-video', 'track');
  const progTrack = el('div', 'fp-progress-track');
  const progLoaded = el('div', 'fp-progress-loaded');
  progLoaded.setAttribute('data-video', 'loaded');
  const progFill = el('div', 'fp-progress-fill');
  progFill.setAttribute('data-video', 'progress');
  progTrack.appendChild(progLoaded);
  progTrack.appendChild(progFill);
  progress.appendChild(progTrack);
  const progThumb = el('div', 'fp-progress-thumb');
  progress.appendChild(progThumb);
  controls.appendChild(progress);

  // Row.
  const row = el('div', 'fp-controls-row');

  const left = el('div', 'fp-controls-group');

  // Play / pause / replay (all three present; CSS swaps them).
  const playBtn = el('button', 'fp-btn');
  setAttrs(playBtn, { 'data-video': 'play', type: 'button', 'aria-label': 'Play' });
  const playIcon = el('span', 'fp-icon');
  setIcon(playIcon, ICON_PLAY);
  playBtn.appendChild(playIcon);
  left.appendChild(playBtn);

  const pauseBtn = el('button', 'fp-btn');
  setAttrs(pauseBtn, { 'data-video': 'pause', type: 'button', 'aria-label': 'Pause' });
  const pauseIcon = el('span', 'fp-icon');
  setIcon(pauseIcon, ICON_PAUSE);
  pauseBtn.appendChild(pauseIcon);
  left.appendChild(pauseBtn);

  const replayBtn = el('button', 'fp-btn');
  setAttrs(replayBtn, { 'data-video': 'replay', type: 'button', 'aria-label': 'Replay' });
  const replayIcon = el('span', 'fp-icon');
  setIcon(replayIcon, ICON_REPLAY);
  replayBtn.appendChild(replayIcon);
  left.appendChild(replayBtn);

  // Skip back / forward.
  const backBtn = el('button', 'fp-btn');
  setAttrs(backBtn, { 'data-video': 'back', type: 'button', 'aria-label': 'Back 10s' });
  const backIcon = el('span', 'fp-icon');
  setIcon(backIcon, ICON_BACK);
  backBtn.appendChild(backIcon);
  left.appendChild(backBtn);

  const fwdBtn = el('button', 'fp-btn');
  setAttrs(fwdBtn, { 'data-video': 'forward', type: 'button', 'aria-label': 'Forward 10s' });
  const fwdIcon = el('span', 'fp-icon');
  setIcon(fwdIcon, ICON_FORWARD);
  fwdBtn.appendChild(fwdIcon);
  left.appendChild(fwdBtn);

  // Volume.
  const vol = el('div', 'fp-volume');
  const muteBtn = el('button', 'fp-btn');
  setAttrs(muteBtn, { 'data-video': 'mute', type: 'button', 'aria-label': 'Mute' });
  const volFull = el('span', 'fp-icon');
  volFull.setAttribute('data-video', 'volume-full');
  setIcon(volFull, ICON_VOLUME_FULL);
  const volMid = el('span', 'fp-icon');
  volMid.setAttribute('data-video', 'volume-mid');
  setIcon(volMid, ICON_VOLUME_MID);
  const volMute = el('span', 'fp-icon');
  volMute.setAttribute('data-video', 'volume-mute');
  setIcon(volMute, ICON_VOLUME_MUTE);
  muteBtn.appendChild(volFull);
  muteBtn.appendChild(volMid);
  muteBtn.appendChild(volMute);
  vol.appendChild(muteBtn);

  const slider = document.createElement('input');
  slider.className = 'fp-volume-slider';
  setAttrs(slider, {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
    value: '1',
    'data-video': 'volume-slider',
    'aria-label': 'Volume',
  });
  vol.appendChild(slider);
  left.appendChild(vol);

  // Time.
  const time = el('div', 'fp-time');
  const timeCurrent = el('span');
  timeCurrent.setAttribute('data-video', 'current-time');
  timeCurrent.textContent = '0:00';
  const timeDivider = el('span', 'fp-time-divider');
  timeDivider.textContent = '/';
  const timeDuration = el('span');
  timeDuration.setAttribute('data-video', 'duration');
  timeDuration.textContent = '0:00';
  time.appendChild(timeCurrent);
  time.appendChild(timeDivider);
  time.appendChild(timeDuration);
  left.appendChild(time);

  row.appendChild(left);

  // Right group.
  const right = el('div', 'fp-controls-group');

  // Settings menu.
  const menu = el('div', 'fp-menu');
  const menuToggle = el('button', 'fp-btn');
  setAttrs(menuToggle, { 'data-video': 'menu-toggle', type: 'button', 'aria-label': 'Settings' });
  const menuToggleIcon = el('span', 'fp-icon');
  setIcon(menuToggleIcon, ICON_SETTINGS);
  menuToggle.appendChild(menuToggleIcon);
  menu.appendChild(menuToggle);

  const menuList = el('div', 'fp-menu-list');
  menuList.setAttribute('data-video', 'menu-list');

  // Speed section.
  const speedSection = el('div', 'fp-menu-section');
  const speedHeading = el('div', 'fp-menu-heading');
  speedHeading.innerHTML = 'Speed: <span data-video="speed-text">Normal</span>';
  speedSection.appendChild(speedHeading);
  for (const opt of SPEED_OPTIONS) {
    const item = el('a', 'fp-menu-item');
    setAttrs(item, {
      href: '#',
      'data-video': 'menu-item',
      'data-video-speed': String(opt.rate),
      role: 'menuitemradio',
      'aria-checked': opt.rate === 1 ? 'true' : 'false',
    });
    const label = el('span');
    label.textContent = opt.label;
    item.appendChild(label);
    const check = el('span', 'fp-menu-check');
    check.setAttribute('data-video', 'menu-check');
    setIcon(check, ICON_CHECK);
    item.appendChild(check);
    speedSection.appendChild(item);
  }
  menuList.appendChild(speedSection);

  // Quality section.
  const qualitySection = el('div', 'fp-menu-section');
  const qualityHeading = el('div', 'fp-menu-heading');
  qualityHeading.innerHTML = 'Quality: <span data-video="quality-text">720p</span>';
  qualitySection.appendChild(qualityHeading);
  for (const opt of QUALITY_OPTIONS) {
    const item = el('a', 'fp-menu-item');
    setAttrs(item, {
      href: '#',
      'data-video': 'menu-item',
      'data-video-quality': opt.value,
      role: 'menuitemradio',
      'aria-checked': opt.value === '720p' ? 'true' : 'false',
    });
    const label = el('span');
    label.textContent = opt.label;
    item.appendChild(label);
    const check = el('span', 'fp-menu-check');
    check.setAttribute('data-video', 'menu-check');
    setIcon(check, ICON_CHECK);
    item.appendChild(check);
    qualitySection.appendChild(item);
  }
  menuList.appendChild(qualitySection);

  menu.appendChild(menuList);
  right.appendChild(menu);

  // Fullscreen / minimize.
  const fsBtn = el('button', 'fp-btn');
  setAttrs(fsBtn, { 'data-video': 'fullscreen', type: 'button', 'aria-label': 'Enter fullscreen' });
  const fsIcon = el('span', 'fp-icon');
  setIcon(fsIcon, ICON_FULLSCREEN);
  fsBtn.appendChild(fsIcon);
  right.appendChild(fsBtn);

  const minBtn = el('button', 'fp-btn');
  setAttrs(minBtn, { 'data-video': 'minimize', type: 'button', 'aria-label': 'Exit fullscreen' });
  const minIcon = el('span', 'fp-icon');
  setIcon(minIcon, ICON_MINIMIZE);
  minBtn.appendChild(minIcon);
  right.appendChild(minBtn);

  row.appendChild(right);

  controls.appendChild(row);
  wrapper.appendChild(controls);

  return wrapper;
}
