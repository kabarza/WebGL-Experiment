// ============================================================
// flow-player-2 runtime — binds an existing Webflow-built DOM tree
// (one .fp-wrapper) to a working video player.
//
// The DOM is the source of truth: every element the runtime cares
// about is found via [data-video="…"] selectors scoped to the
// wrapper. The runtime never injects markup OTHER than the iframe
// we mount when the source is a Vimeo or YouTube URL — in that
// case we hide the native <video> and route every control through
// the corresponding provider adapter.
//
// Visibility is governed by CSS rules that key off
// data-state / data-menu / data-volume / data-fullscreen on the
// wrapper, so designers can hide any control in Webflow and the
// runtime won't override their choice.
//
// Multiple wrappers on the same page are independent — there is
// zero cross-wrapper state.
// ============================================================

import { parseSource } from './helpers.ts';
import {
  createNativeMediaSource,
  createProviderMediaSource,
  type MediaSource,
} from './mediaSource.ts';

export interface RuntimeOptions {
  /** Skip seconds for back/forward buttons. Falls back to 10. */
  skipSeconds?: number;
  /** Idle ms before hiding the bar during playback. 0 disables. */
  idleTimeoutMs?: number;
}

const DEFAULTS: Required<RuntimeOptions> = {
  skipSeconds: 10,
  idleTimeoutMs: 2500,
};

type Off = () => void;

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = h ? String(m % 60).padStart(2, '0') : String(m);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function pickVolumeLevel(media: MediaSource): 'full' | 'mid' | 'mute' {
  if (media.muted || media.volume === 0) return 'mute';
  if (media.volume < 0.5) return 'mid';
  return 'full';
}

/**
 * Bind a single .fp-wrapper to a video player. Returns an
 * unbinder; call it to detach all listeners (used by the in-app
 * preview when the user changes a dial value).
 */
export function bindWrapper(
  wrapper: HTMLElement,
  options: RuntimeOptions = {},
): Off {
  if (wrapper.dataset.fpInit === '1') return () => {};
  wrapper.dataset.fpInit = '1';

  const opts = { ...DEFAULTS, ...options };
  const cleanups: Off[] = [];

  const find = <T extends Element = HTMLElement>(sel: string): T | null =>
    wrapper.querySelector<T>(sel);
  const findAll = <T extends Element = HTMLElement>(sel: string): T[] =>
    Array.from(wrapper.querySelectorAll<T>(sel));

  // The native <video> always exists in the markup. For Vimeo/YouTube
  // sources we hide it and mount an iframe alongside.
  const videoEl = find<HTMLVideoElement>('[data-video="video"]');
  if (!videoEl) return () => {};
  const video: HTMLVideoElement = videoEl;

  // Apply per-instance accent / track / buffer overrides from
  // data-* attributes on the wrapper (these live on the wrapper as
  // editable Webflow attrs).
  const setVar = (name: string, val: string | null): void => {
    if (!val) return;
    const hex = val.replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      wrapper.style.setProperty(name, '#' + hex);
    } else if (/^rgba?\(/.test(val) || /^[a-zA-Z]+$/.test(val)) {
      wrapper.style.setProperty(name, val);
    }
  };
  setVar('--fp-accent', wrapper.getAttribute('data-accent'));
  setVar('--fp-track', wrapper.getAttribute('data-track'));
  setVar('--fp-buffer', wrapper.getAttribute('data-buffer'));

  // Behavior flags.
  const attrBool = (name: string, fallback: boolean): boolean => {
    const v = wrapper.getAttribute(name);
    if (v === null) return fallback;
    return v === '' || v === 'true' || v === '1';
  };
  const wantAutoplay = attrBool('data-autoplay', false);
  const wantMuted = attrBool('data-muted', false);
  const wantLoop = attrBool('data-loop', false);
  const wantPlaysinline = attrBool('data-playsinline', true);

  // Poster (purely visual — applies regardless of source kind).
  const posterAttr = wrapper.getAttribute('data-poster');
  if (posterAttr) {
    const posterImg = find<HTMLImageElement>('[data-video="poster"] img');
    if (posterImg) posterImg.src = posterAttr;
  }

  // ── Resolve source kind ───────────────────────────────────
  // data-src on the wrapper wins; otherwise fall back to the first
  // <source> element's src (designers can author the URL either way).
  const srcAttr = wrapper.getAttribute('data-src') || '';
  const srcFromMarkup =
    video.querySelector<HTMLSourceElement>('source')?.getAttribute('src') || '';
  const sourceUrl = srcAttr || srcFromMarkup;
  const source = parseSource(sourceUrl);
  if (!source) {
    delete wrapper.dataset.fpInit;
    return () => {};
  }
  wrapper.dataset.provider = source.provider;

  // ── Build the MediaSource ─────────────────────────────────
  let media: MediaSource;
  if (source.provider === 'native') {
    // Native: ensure the <source> URL matches the wrapper's data-src.
    const sourceTag = video.querySelector<HTMLSourceElement>('source');
    if (sourceTag && srcAttr && sourceTag.getAttribute('src') !== srcAttr) {
      sourceTag.setAttribute('src', srcAttr);
      video.load();
    }
    if (wantMuted) video.muted = true;
    if (wantLoop) video.loop = true;
    if (wantPlaysinline) video.playsInline = true;
    media = createNativeMediaSource(video);
  } else {
    // Vimeo / YouTube: hide the <video>, mount an iframe in the same stage.
    video.style.display = 'none';
    const stage = video.parentElement || wrapper;
    media = createProviderMediaSource(source, {
      autoplay: wantAutoplay,
      muted: wantMuted,
      loop: wantLoop,
      playsinline: wantPlaysinline,
    });
    stage.appendChild(media.element);
    cleanups.push(() => {
      video.style.display = '';
    });
  }
  cleanups.push(() => media.destroy());

  // Quality menu — only meaningful for native sources. Hide the
  // section entirely otherwise.
  const qualitySection = (() => {
    const items = findAll<HTMLElement>('[data-video-quality]');
    if (items.length === 0) return null;
    return items[0].closest<HTMLElement>('.fp-menu-section');
  })();
  if (source.provider !== 'native' && qualitySection) {
    qualitySection.style.display = 'none';
    cleanups.push(() => {
      qualitySection.style.display = '';
    });
  }

  // ── Initial wrapper state ─────────────────────────────────
  wrapper.dataset.state = media.paused ? 'paused' : 'playing';
  wrapper.dataset.menu = 'closed';
  wrapper.dataset.volume = pickVolumeLevel(media);

  // ── State sync helpers ────────────────────────────────────
  function syncState(): void {
    if (media.ended) wrapper.dataset.state = 'ended';
    else if (media.paused) wrapper.dataset.state = 'paused';
    else wrapper.dataset.state = 'playing';
  }

  function syncProgress(): void {
    const dur = media.duration;
    const cur = media.currentTime;
    const frac = dur > 0 ? Math.min(1, cur / dur) : 0;
    wrapper.style.setProperty('--fp-progress-frac', String(frac));
    const ct = find('[data-video="current-time"]');
    if (ct) ct.textContent = fmtTime(cur);
  }

  function syncDuration(): void {
    const dt = find('[data-video="duration"]');
    if (dt) dt.textContent = fmtTime(media.duration);
  }

  function syncBuffer(): void {
    wrapper.style.setProperty('--fp-buffer-frac', String(media.buffered));
  }

  function syncVolume(): void {
    wrapper.dataset.volume = pickVolumeLevel(media);
    const slider = find<HTMLInputElement>('[data-video="volume-slider"]');
    const pct = media.muted ? 0 : Math.round(media.volume * 100);
    if (slider) {
      const sv = String(media.muted ? 0 : media.volume);
      if (slider.value !== sv) slider.value = sv;
    }
    wrapper.style.setProperty('--fp-volume', `${pct}%`);
  }

  // ── Wire media → DOM ──────────────────────────────────────
  cleanups.push(media.on('play', () => {
    wrapper.dataset.played = '1';
    syncState();
    if (opts.idleTimeoutMs > 0) startIdleTimer();
  }));
  cleanups.push(media.on('pause', () => {
    syncState();
    stopIdleTimer();
    wrapper.removeAttribute('data-idle');
  }));
  cleanups.push(media.on('ended', () => {
    syncState();
    stopIdleTimer();
    wrapper.removeAttribute('data-idle');
  }));
  cleanups.push(media.on('timeupdate', syncProgress));
  cleanups.push(media.on('durationchange', () => { syncDuration(); syncProgress(); }));
  cleanups.push(media.on('progress', syncBuffer));
  cleanups.push(media.on('volumechange', syncVolume));
  cleanups.push(media.on('ratechange', () => { /* speed label is updated on click */ }));

  syncDuration();
  syncProgress();
  syncBuffer();
  syncVolume();

  // ── Wire DOM → media ──────────────────────────────────────
  function bindClick(sel: string, handler: (e: Event) => void): void {
    const el = find(sel);
    if (!el) return;
    el.addEventListener('click', handler);
    cleanups.push(() => el.removeEventListener('click', handler));
  }

  const playClick = (e: Event): void => { e.preventDefault(); media.play(); };
  const pauseClick = (e: Event): void => { e.preventDefault(); media.pause(); };
  const replayClick = (e: Event): void => {
    e.preventDefault();
    media.seek(0);
    media.play();
  };
  const backClick = (e: Event): void => {
    e.preventDefault();
    media.seek(Math.max(0, media.currentTime - opts.skipSeconds));
  };
  const forwardClick = (e: Event): void => {
    e.preventDefault();
    const d = media.duration;
    media.seek(d > 0
      ? Math.min(d, media.currentTime + opts.skipSeconds)
      : media.currentTime + opts.skipSeconds);
  };
  const muteClick = (e: Event): void => {
    e.preventDefault();
    if (media.muted || media.volume === 0) {
      media.setMuted(false);
      if (media.volume === 0) media.setVolume(1);
    } else {
      media.setMuted(true);
    }
  };

  bindClick('[data-video="play"]', playClick);
  bindClick('[data-video="pause"]', pauseClick);
  bindClick('[data-video="replay"]', replayClick);
  bindClick('[data-video="back"]', backClick);
  bindClick('[data-video="forward"]', forwardClick);
  bindClick('[data-video="mute"]', muteClick);

  // Big-play overlay click → start playback.
  bindClick('[data-video="big-play"]', (e) => {
    e.preventDefault();
    media.play();
  });

  // Tap-anywhere on the native <video> toggles play/pause. (Iframe
  // captures its own clicks — for the provider path, the controls
  // bar buttons are the only click affordance, which matches Vimeo
  // and YouTube's "click iframe = native chrome" behavior we hid.)
  if (source.provider === 'native') {
    const videoTap = (e: Event): void => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-video="controls"]')) return;
      if (media.paused) media.play();
      else media.pause();
    };
    video.addEventListener('click', videoTap);
    cleanups.push(() => video.removeEventListener('click', videoTap));
  }

  // Volume slider.
  const slider = find<HTMLInputElement>('[data-video="volume-slider"]');
  if (slider) {
    const onInput = (): void => {
      const v = Math.max(0, Math.min(1, parseFloat(slider.value)));
      media.setVolume(v);
      if (v === 0) media.setMuted(true);
      else if (media.muted) media.setMuted(false);
    };
    slider.addEventListener('input', onInput);
    cleanups.push(() => slider.removeEventListener('input', onInput));
  }

  // Progress bar — pointer-driven scrub.
  const progress = find('[data-video="track"]');
  if (progress) {
    let dragging = false;
    const seekFromEvent = (clientX: number): void => {
      const r = progress.getBoundingClientRect();
      if (r.width <= 0) return;
      const frac = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const dur = media.duration;
      if (dur > 0) media.seek(frac * dur);
      // Optimistic visual update during drag (timeupdate fires lazily).
      wrapper.style.setProperty('--fp-progress-frac', String(frac));
    };
    const onDown = (e: PointerEvent): void => {
      dragging = true;
      progress.setPointerCapture(e.pointerId);
      seekFromEvent(e.clientX);
    };
    const onMove = (e: PointerEvent): void => {
      if (dragging) seekFromEvent(e.clientX);
    };
    const onUp = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      try { progress.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    progress.addEventListener('pointerdown', onDown);
    progress.addEventListener('pointermove', onMove);
    progress.addEventListener('pointerup', onUp);
    progress.addEventListener('pointercancel', onUp);
    cleanups.push(() => {
      progress.removeEventListener('pointerdown', onDown);
      progress.removeEventListener('pointermove', onMove);
      progress.removeEventListener('pointerup', onUp);
      progress.removeEventListener('pointercancel', onUp);
    });
  }

  // Settings menu toggle.
  const menuToggle = find('[data-video="menu-toggle"]');
  if (menuToggle) {
    const onToggle = (e: Event): void => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.dataset.menu = wrapper.dataset.menu === 'open' ? 'closed' : 'open';
    };
    menuToggle.addEventListener('click', onToggle);
    cleanups.push(() => menuToggle.removeEventListener('click', onToggle));
    const onDocClick = (e: MouseEvent): void => {
      if (!(e.target instanceof Node)) return;
      if (wrapper.contains(e.target)) return;
      wrapper.dataset.menu = 'closed';
    };
    document.addEventListener('click', onDocClick);
    cleanups.push(() => document.removeEventListener('click', onDocClick));
  }

  // Speed menu items.
  const speedItems = findAll<HTMLElement>('[data-video-speed]');
  for (const item of speedItems) {
    const onClick = (e: Event): void => {
      e.preventDefault();
      const rate = parseFloat(item.getAttribute('data-video-speed') || '1');
      if (Number.isFinite(rate) && rate > 0) {
        media.setPlaybackRate(rate);
        for (const it of speedItems) {
          it.setAttribute('aria-checked', it === item ? 'true' : 'false');
        }
        const label = find('[data-video="speed-text"]');
        if (label) {
          label.textContent = rate === 1 ? 'Normal' : `${rate}x`;
        }
      }
      wrapper.dataset.menu = 'closed';
    };
    item.addEventListener('click', onClick);
    cleanups.push(() => item.removeEventListener('click', onClick));
    if (Math.abs(parseFloat(item.getAttribute('data-video-speed') || '1') - 1) < 1e-6) {
      item.setAttribute('aria-checked', 'true');
    }
  }

  // Quality menu items — only for native sources (provider quality
  // is the provider's business).
  if (source.provider === 'native') {
    const qualityItems = findAll<HTMLElement>('[data-video-quality]');
    for (const item of qualityItems) {
      const onClick = (e: Event): void => {
        e.preventDefault();
        const q = item.getAttribute('data-video-quality') || '';
        const sourceTag = video.querySelector<HTMLSourceElement>(
          `source[data-video-src-quality="${q}"]`,
        );
        if (sourceTag) {
          const t = video.currentTime;
          const wasPlaying = !video.paused;
          const wasMuted = video.muted;
          const wasVol = video.volume;
          video.src = sourceTag.getAttribute('src') || '';
          video.muted = wasMuted;
          video.volume = wasVol;
          const onLoaded = (): void => {
            video.currentTime = t;
            if (wasPlaying) void video.play();
            video.removeEventListener('loadedmetadata', onLoaded);
          };
          video.addEventListener('loadedmetadata', onLoaded);
        }
        for (const it of qualityItems) {
          it.setAttribute('aria-checked', it === item ? 'true' : 'false');
        }
        const label = find('[data-video="quality-text"]');
        if (label) label.textContent = q;
        wrapper.dataset.menu = 'closed';
      };
      item.addEventListener('click', onClick);
      cleanups.push(() => item.removeEventListener('click', onClick));
    }
  }

  // Fullscreen — wrapper-level (preferred) and video-level (Safari iOS).
  function isFullscreen(): boolean {
    return document.fullscreenElement === wrapper;
  }
  const fullscreenClick = (e: Event): void => {
    e.preventDefault();
    if (isFullscreen()) {
      void document.exitFullscreen();
    } else if (wrapper.requestFullscreen) {
      void wrapper.requestFullscreen();
    } else if (source.provider === 'native') {
      const v = video as HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
      };
      v.webkitEnterFullscreen?.();
    }
  };
  bindClick('[data-video="fullscreen"]', fullscreenClick);
  bindClick('[data-video="minimize"]', fullscreenClick);
  const onFsChange = (): void => {
    if (isFullscreen()) wrapper.dataset.fullscreen = '1';
    else wrapper.removeAttribute('data-fullscreen');
  };
  document.addEventListener('fullscreenchange', onFsChange);
  cleanups.push(() => document.removeEventListener('fullscreenchange', onFsChange));

  // Idle-hide of the controls bar during playback.
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  function stopIdleTimer(): void {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }
  function startIdleTimer(): void {
    stopIdleTimer();
    if (opts.idleTimeoutMs <= 0) return;
    idleTimer = setTimeout(() => {
      if (!media.paused) wrapper.dataset.idle = '1';
    }, opts.idleTimeoutMs);
  }
  const wakeIdle = (): void => {
    wrapper.removeAttribute('data-idle');
    if (!media.paused) startIdleTimer();
  };
  wrapper.addEventListener('pointermove', wakeIdle);
  wrapper.addEventListener('pointerleave', () => {
    if (!media.paused && opts.idleTimeoutMs > 0) {
      wrapper.dataset.idle = '1';
    }
  });
  cleanups.push(() => {
    wrapper.removeEventListener('pointermove', wakeIdle);
  });

  // Autoplay if requested. Browser policy may block when not muted —
  // we don't force-mute, so the call is allowed to fail silently.
  if (wantAutoplay) {
    media.play();
  }

  return () => {
    stopIdleTimer();
    for (const fn of cleanups) fn();
    delete wrapper.dataset.fpInit;
    delete wrapper.dataset.played;
    delete wrapper.dataset.idle;
    delete wrapper.dataset.fullscreen;
    delete wrapper.dataset.provider;
  };
}

/** Bind every .fp-wrapper on the page. Idempotent. */
export function bindAll(options: RuntimeOptions = {}): void {
  const wrappers = document.querySelectorAll<HTMLElement>(
    '.fp-wrapper, [data-video="wrapper"]',
  );
  for (const w of wrappers) bindWrapper(w, options);
}
