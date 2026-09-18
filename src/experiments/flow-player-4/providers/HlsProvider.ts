// ============================================================
// HlsProvider — wraps a <video> element and (when needed) the
// hls.js library lazy-loaded from jsDelivr.
//
// Safari supports HLS natively — we just set video.src = url and
// it works. Every other browser needs hls.js to demux the MPEG-TS
// segments into MSE buffers. The library is ~30 KB gzipped and
// only fetched when we actually have an HLS source.
//
// This is the same approach Osmo uses on the BunnyCDN flow.
// ============================================================

import type { Provider, ProviderEvent, ProviderState } from './types.ts';

const HLS_CDN_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';

// Type stub for the hls.js global. We treat it as `unknown` and
// narrow at the call sites — avoids needing @types/hls.js.
interface HlsLib {
  isSupported(): boolean;
  new (config?: unknown): HlsInstance;
}
interface HlsInstance {
  loadSource(url: string): void;
  attachMedia(video: HTMLVideoElement): void;
  destroy(): void;
  on(event: string, cb: (evt: unknown, data: unknown) => void): void;
}

declare global {
  interface Window {
    Hls?: HlsLib;
  }
}

let hlsLoadPromise: Promise<HlsLib | null> | null = null;

function loadHlsLib(): Promise<HlsLib | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);
  if (hlsLoadPromise) return hlsLoadPromise;
  hlsLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-vp-hls]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Hls ?? null), { once: true });
      existing.addEventListener('error', () => resolve(null), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = HLS_CDN_URL;
    s.async = true;
    s.setAttribute('data-vp-hls', '');
    s.addEventListener('load', () => resolve(window.Hls ?? null), { once: true });
    s.addEventListener('error', () => resolve(null), { once: true });
    document.head.appendChild(s);
  });
  return hlsLoadPromise;
}

export function createHlsProvider(video: HTMLVideoElement, url: string): Provider {
  const handlers = new Map<ProviderEvent, Set<(data?: unknown) => void>>();
  const state: ProviderState = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: video.volume ?? 1,
    muted: video.muted ?? false,
    paused: video.paused !== false,
    playbackRate: video.playbackRate ?? 1,
  };

  let readyResolve: (() => void) | null = null;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
  let readyFired = false;
  let hls: HlsInstance | null = null;

  function emit(event: ProviderEvent, data?: unknown): void {
    const set = handlers.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(data);
      } catch {
        /* ignore */
      }
    }
  }

  function readBuffered(): number {
    if (!video.buffered.length || !video.duration) return 0;
    return video.buffered.end(video.buffered.length - 1) / video.duration;
  }

  function markReady(): void {
    if (readyFired) return;
    readyFired = true;
    readyResolve?.();
    emit('ready');
  }

  // Wire video element events to the unified ProviderEvent surface.
  function onLoadedMeta(): void {
    state.duration = video.duration;
    markReady();
    emit('durationchange');
  }
  function onTimeUpdate(): void {
    state.currentTime = video.currentTime;
    emit('timeupdate');
  }
  function onProgress(): void {
    state.buffered = readBuffered();
    emit('progress');
  }
  function onPlay(): void {
    state.paused = false;
    emit('play');
  }
  function onPlaying(): void {
    emit('playing');
  }
  function onPause(): void {
    state.paused = true;
    emit('pause');
  }
  function onEnded(): void {
    state.paused = true;
    emit('ended');
  }
  function onVolumeChange(): void {
    state.volume = video.volume;
    state.muted = video.muted;
    emit('volumechange');
  }
  function onRateChange(): void {
    state.playbackRate = video.playbackRate;
    emit('ratechange');
  }
  function onWaiting(): void {
    emit('buffering');
  }
  function onError(): void {
    emit('error', video.error);
  }

  video.addEventListener('loadedmetadata', onLoadedMeta);
  video.addEventListener('timeupdate', onTimeUpdate);
  video.addEventListener('progress', onProgress);
  video.addEventListener('play', onPlay);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('pause', onPause);
  video.addEventListener('ended', onEnded);
  video.addEventListener('volumechange', onVolumeChange);
  video.addEventListener('ratechange', onRateChange);
  video.addEventListener('waiting', onWaiting);
  video.addEventListener('error', onError);

  // Attach the source. Safari handles HLS natively; everywhere else
  // we lazy-load hls.js.
  const canPlayNative =
    typeof video.canPlayType === 'function' &&
    video.canPlayType('application/vnd.apple.mpegurl') !== '';

  if (canPlayNative) {
    video.src = url;
  } else {
    loadHlsLib().then((Hls) => {
      if (!Hls || !Hls.isSupported()) {
        // Last-resort fallback: try native anyway. If it fails,
        // the video element will fire `error`.
        video.src = url;
        return;
      }
      hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
    });
  }

  return {
    element: video,
    state,
    ready: () => readyPromise,
    play: () => {
      void video.play().catch(() => {
        // Autoplay blocked, etc. — swallow.
      });
    },
    pause: () => video.pause(),
    seek: (seconds: number) => {
      state.currentTime = seconds;
      try {
        video.currentTime = seconds;
      } catch {
        /* may throw if metadata not loaded yet */
      }
    },
    setVolume: (v: number) => {
      state.volume = v;
      video.volume = Math.max(0, Math.min(1, v));
    },
    setMuted: (m: boolean) => {
      state.muted = m;
      video.muted = m;
    },
    setPlaybackRate: (rate: number) => {
      state.playbackRate = rate;
      video.playbackRate = rate;
    },
    on: (event, handler) => {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
      };
    },
    destroy: () => {
      video.removeEventListener('loadedmetadata', onLoadedMeta);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ratechange', onRateChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onError);
      try {
        hls?.destroy();
      } catch {
        /* ignore */
      }
      handlers.clear();
    },
  };
}
