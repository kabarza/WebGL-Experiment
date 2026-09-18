// ============================================================
// Mp4Provider — wraps a plain <video> element. No library, no
// streaming format gymnastics. Just sets video.src and listens
// to the standard HTMLMediaElement events.
//
// Suitable for self-hosted .mp4 / .webm / .mov files.
// ============================================================

import type { Provider, ProviderEvent, ProviderState } from './types.ts';

export function createMp4Provider(video: HTMLVideoElement, url: string): Provider {
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

  video.src = url;

  return {
    element: video,
    state,
    ready: () => readyPromise,
    play: () => {
      void video.play().catch(() => {
        /* autoplay blocked, etc. */
      });
    },
    pause: () => video.pause(),
    seek: (seconds: number) => {
      state.currentTime = seconds;
      try {
        video.currentTime = seconds;
      } catch {
        /* ignore */
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
      handlers.clear();
    },
  };
}
