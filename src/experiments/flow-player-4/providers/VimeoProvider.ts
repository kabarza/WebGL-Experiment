// ============================================================
// VimeoProvider — talks to player.vimeo.com via raw postMessage.
//
// No @vimeo/player SDK. Protocol documented at
// https://github.com/vimeo/player.js#using-vimeo-player-without-the-library
//
// Outgoing: JSON.stringify({ method, value? })
// Incoming: { event?, method?, value?, data? }
// ============================================================

import type { Provider, ProviderEvent, ProviderState } from './types.ts';

interface VimeoMessage {
  method?: string;
  event?: string;
  value?: unknown;
  data?: unknown;
}

const SUBSCRIBED_EVENTS = [
  'play',
  'pause',
  'ended',
  'timeupdate',
  'progress',
  'volumechange',
  'playbackratechange',
  'durationchange',
  'bufferstart',
  'bufferend',
  'error',
] as const;

export function createVimeoProvider(iframe: HTMLIFrameElement): Provider {
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
  let isReady = false;

  function send(method: string, value?: unknown): void {
    if (!iframe.contentWindow) return;
    const msg: VimeoMessage = { method };
    if (value !== undefined) msg.value = value;
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

  function handleMessage(e: MessageEvent): void {
    if (e.source !== iframe.contentWindow) return;
    let payload: VimeoMessage;
    try {
      payload = typeof e.data === 'string' ? JSON.parse(e.data) : (e.data as VimeoMessage);
    } catch {
      return;
    }
    if (!payload) return;

    if (payload.event === 'ready' || (payload.method === 'ping' && !isReady)) {
      isReady = true;
      for (const ev of SUBSCRIBED_EVENTS) send('addEventListener', ev);
      send('getDuration');
      send('getVolume');
      send('getMuted');
      send('getPlaybackRate');
      readyResolve?.();
      emit('ready');
      return;
    }

    switch (payload.event) {
      case 'play':
        state.paused = false;
        emit('play');
        break;
      case 'pause':
        state.paused = true;
        emit('pause');
        break;
      case 'ended':
        state.paused = true;
        emit('ended');
        break;
      case 'timeupdate': {
        const d = payload.data as { seconds?: number; duration?: number } | undefined;
        if (d?.seconds != null) state.currentTime = d.seconds;
        if (d?.duration != null) state.duration = d.duration;
        emit('timeupdate');
        break;
      }
      case 'progress': {
        const d = payload.data as { percent?: number } | undefined;
        if (d?.percent != null) state.buffered = d.percent;
        emit('progress');
        break;
      }
      case 'durationchange': {
        const d = payload.data as { duration?: number } | undefined;
        if (d?.duration != null) state.duration = d.duration;
        emit('durationchange');
        break;
      }
      case 'volumechange': {
        const d = payload.data as { volume?: number } | undefined;
        if (d?.volume != null) state.volume = d.volume;
        emit('volumechange');
        break;
      }
      case 'playbackratechange': {
        const d = payload.data as { playbackRate?: number } | undefined;
        if (d?.playbackRate != null) state.playbackRate = d.playbackRate;
        emit('ratechange');
        break;
      }
      case 'bufferstart':
        emit('buffering');
        break;
      case 'bufferend':
        emit('playing');
        break;
      case 'error':
        emit('error', payload.data);
        break;
    }

    // Replies to one-shot getters
    if (payload.method === 'getDuration' && typeof payload.value === 'number') {
      state.duration = payload.value;
      emit('durationchange');
    } else if (payload.method === 'getVolume' && typeof payload.value === 'number') {
      state.volume = payload.value;
      emit('volumechange');
    } else if (payload.method === 'getMuted' && typeof payload.value === 'boolean') {
      state.muted = payload.value;
      emit('volumechange');
    } else if (payload.method === 'getPlaybackRate' && typeof payload.value === 'number') {
      state.playbackRate = payload.value;
      emit('ratechange');
    }
  }

  window.addEventListener('message', handleMessage);

  return {
    element: iframe,
    state,
    ready: () => readyPromise,
    play: () => send('play'),
    pause: () => send('pause'),
    seek: (seconds: number) => {
      state.currentTime = seconds;
      send('setCurrentTime', seconds);
    },
    setVolume: (v: number) => {
      state.volume = v;
      send('setVolume', v);
    },
    setMuted: (m: boolean) => {
      state.muted = m;
      send('setMuted', m);
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
      window.removeEventListener('message', handleMessage);
      handlers.clear();
    },
  };
}
