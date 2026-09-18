// ============================================================
// VimeoProvider — talks to player.vimeo.com via raw postMessage.
//
// No @vimeo/player SDK. The protocol is documented at
// https://github.com/vimeo/player.js#using-vimeo-player-without-the-library
// and stable.
//
// Outgoing messages: { method, value? } stringified.
// Incoming messages: { event?, method?, value? } where `event` is the
// event name we subscribed to via { method: 'addEventListener' }.
// ============================================================

import type { Provider, ProviderEvent, ProviderState, TextTrack } from './types.ts';

interface VimeoMessage {
  method?: string;
  event?: string;
  value?: unknown;
  data?: unknown;
}

interface VimeoTrack {
  language: string;
  kind: string;
  label: string;
  mode?: string; // 'showing' | 'disabled'
}

const SUBSCRIBED_EVENTS = [
  'play',
  'pause',
  'ended',
  'timeupdate',
  'progress',
  'volumechange',
  'playbackratechange',
  'loaded',
  'durationchange',
  'bufferstart',
  'bufferend',
  'texttrackchange',
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
  let tracks: VimeoTrack[] = [];
  let activeTrackId: string | null = null;
  function trackId(t: { language: string; kind: string }): string {
    return `${t.language}-${t.kind}`;
  }

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
      payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (!payload) return;

    // Player ready handshake — Vimeo posts { event: 'ready' } once. We
    // reply with addEventListener requests for everything we care about.
    if (payload.event === 'ready' || (payload.method === 'ping' && !isReady)) {
      isReady = true;
      for (const ev of SUBSCRIBED_EVENTS) send('addEventListener', ev);
      send('getDuration');
      send('getVolume');
      send('getMuted');
      send('getPlaybackRate');
      send('getTextTracks');
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
      case 'texttrackchange': {
        const d = payload.data as VimeoTrack | null | undefined;
        activeTrackId = d ? trackId(d) : null;
        emit('volumechange'); // piggyback as a state-changed nudge
        break;
      }
      case 'error':
        emit('error', payload.data);
        break;
      case 'loaded':
        // sometimes duration arrives via getDuration response below
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
    } else if (
      payload.method === 'getPlaybackRate' &&
      typeof payload.value === 'number'
    ) {
      state.playbackRate = payload.value;
      emit('ratechange');
    } else if (payload.method === 'getTextTracks' && Array.isArray(payload.value)) {
      tracks = (payload.value as VimeoTrack[]).filter(
        (t) => t.kind === 'captions' || t.kind === 'subtitles',
      );
      const showing = tracks.find((t) => t.mode === 'showing');
      activeTrackId = showing ? trackId(showing) : null;
      emit('tracks');
    }
  }

  window.addEventListener('message', handleMessage);

  return {
    iframe,
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
    requestPictureInPicture: async () => {
      // Vimeo's player exposes requestPictureInPicture via postMessage
      // method. The reply doesn't tell us success — we optimistically
      // return true. If the user has denied PiP for the page, the call
      // is silently ignored by Vimeo.
      send('requestPictureInPicture');
      return true;
    },
    getTextTracks: () =>
      tracks.map(
        (t): TextTrack => ({
          id: trackId(t),
          label: t.label || t.language,
          language: t.language,
          kind: t.kind === 'captions' ? 'captions' : 'subtitles',
        }),
      ),
    getActiveTextTrack: () => activeTrackId,
    setTextTrack: (id) => {
      if (!id) {
        send('disableTextTrack');
        activeTrackId = null;
        return;
      }
      const track = tracks.find((t) => trackId(t) === id);
      if (!track) return;
      send('enableTextTrack', { language: track.language, kind: track.kind });
      activeTrackId = id;
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
