// ============================================================
// YouTubeProvider — talks to youtube-nocookie.com via raw
// postMessage, no IFrame Player API script.
//
// YouTube does NOT emit timeupdate. We poll getCurrentTime every
// 250ms while in PLAYING state.
// ============================================================

import type { Provider, ProviderEvent, ProviderState } from './types.ts';

const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

interface YouTubeMessage {
  event?: string;
  info?: unknown;
  channel?: string;
}

export function createYouTubeProvider(iframe: HTMLIFrameElement): Provider {
  const handlers = new Map<ProviderEvent, Set<(data?: unknown) => void>>();
  const state: ProviderState = {
    currentTime: 0,
    duration: 0,
    buffered: 0,
    volume: 1,
    muted: false,
    paused: true,
    playbackRate: 1,
  };

  let readyResolve: (() => void) | null = null;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function send(func: string, ...args: unknown[]): void {
    if (!iframe.contentWindow) return;
    const msg = { event: 'command', func, args };
    iframe.contentWindow.postMessage(JSON.stringify(msg), '*');
  }

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

  function startPolling(): void {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      send('getCurrentTime');
      send('getVideoLoadedFraction');
    }, 250);
  }
  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function handleMessage(e: MessageEvent): void {
    if (e.source !== iframe.contentWindow) return;
    let payload: YouTubeMessage;
    try {
      payload = typeof e.data === 'string' ? JSON.parse(e.data) : (e.data as YouTubeMessage);
    } catch {
      return;
    }
    if (!payload) return;

    if (payload.event === 'onReady') {
      send('getDuration');
      send('getVolume');
      send('isMuted');
      send('getPlaybackRate');
      readyResolve?.();
      emit('ready');
      return;
    }

    if (payload.event === 'onStateChange') {
      const code = payload.info as number;
      if (code === YT_STATE.PLAYING) {
        state.paused = false;
        startPolling();
        emit('playing');
        emit('play');
      } else if (code === YT_STATE.PAUSED) {
        state.paused = true;
        stopPolling();
        emit('pause');
      } else if (code === YT_STATE.ENDED) {
        state.paused = true;
        stopPolling();
        emit('ended');
      } else if (code === YT_STATE.BUFFERING) {
        emit('buffering');
      }
      return;
    }

    if (payload.event === 'infoDelivery' && payload.info) {
      const info = payload.info as Record<string, unknown>;
      let changed = false;
      if (typeof info.currentTime === 'number') {
        state.currentTime = info.currentTime;
        changed = true;
      }
      if (typeof info.duration === 'number') {
        state.duration = info.duration;
        emit('durationchange');
      }
      if (typeof info.videoLoadedFraction === 'number') {
        state.buffered = info.videoLoadedFraction;
        emit('progress');
      }
      if (typeof info.volume === 'number') {
        state.volume = info.volume / 100;
        emit('volumechange');
      }
      if (typeof info.muted === 'boolean') {
        state.muted = info.muted;
        emit('volumechange');
      }
      if (typeof info.playbackRate === 'number') {
        state.playbackRate = info.playbackRate;
        emit('ratechange');
      }
      if (changed) emit('timeupdate');
      return;
    }

    if (payload.event === 'onError') {
      emit('error', payload.info);
    }
  }

  window.addEventListener('message', handleMessage);

  function announceListening(): void {
    if (!iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'listening', id: 'flow-player' }),
      '*',
    );
  }
  iframe.addEventListener('load', announceListening, { once: true });
  setTimeout(announceListening, 500);

  return {
    element: iframe,
    state,
    ready: () => readyPromise,
    play: () => send('playVideo'),
    pause: () => send('pauseVideo'),
    seek: (seconds: number) => {
      state.currentTime = seconds;
      send('seekTo', seconds, true);
    },
    setVolume: (v: number) => {
      state.volume = v;
      send('setVolume', Math.round(v * 100));
    },
    setMuted: (m: boolean) => {
      state.muted = m;
      send(m ? 'mute' : 'unMute');
    },
    setPlaybackRate: (rate: number) => {
      state.playbackRate = rate;
      send('setPlaybackRate', rate);
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
      stopPolling();
      window.removeEventListener('message', handleMessage);
      handlers.clear();
    },
  };
}
