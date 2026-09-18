// ============================================================
// YouTubeProvider — talks to youtube-nocookie.com via raw
// postMessage, no IFrame Player API script.
//
// Protocol (undocumented but stable, used by the IFrame API itself):
//
//   Outgoing:
//     { event: 'command', func: 'playVideo', args: [] }
//
//   Incoming events of interest:
//     { event: 'onReady' }
//     { event: 'onStateChange', info: -1|0|1|2|3|5 }
//     { event: 'infoDelivery', info: { currentTime, duration, ... } }
//     { event: 'onError', info: <number> }
//
// YouTube does NOT post timeupdate events — we poll `infoDelivery`
// while the player is in PLAYING state by sending `getCurrentTime`
// at 250ms intervals. (Plyr polls at 50ms; we go cheaper since
// the scrubber updates feel fine at 250ms and it's nicer to mobile
// CPUs.)
// ============================================================

import type { Provider, ProviderEvent, ProviderState, TextTrack } from './types.ts';

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
  let tracks: TextTrack[] = [];
  let activeTrackId: string | null = null;

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
      // listening = true so our reply is delivered as `infoDelivery`
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
      payload = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (!payload) return;

    if (payload.event === 'onReady') {
      // YT only sends onReady after we send 'listening' — kick that off
      // once iframe load fires, see below. After ready, request initial
      // state so the UI has something to render before any state change.
      send('getDuration');
      send('getVolume');
      send('isMuted');
      send('getPlaybackRate');
      send('getOptions', 'captions');
      readyResolve?.();
      emit('ready');
      return;
    }

    if (payload.event === 'onApiChange') {
      // Captions module loaded — query available tracks now.
      send('getOption', 'captions', 'tracklist');
      send('getOption', 'captions', 'track');
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
      return;
    }

    // Replies to getOption requests for captions
    if (payload.event === 'infoDelivery' && payload.info) {
      const info = payload.info as Record<string, unknown>;
      if (Array.isArray(info.tracklist)) {
        const list = info.tracklist as Array<{
          languageCode?: string;
          languageName?: string;
          displayName?: string;
        }>;
        tracks = list
          .filter((t) => !!t.languageCode)
          .map(
            (t): TextTrack => ({
              id: t.languageCode!,
              label: t.displayName || t.languageName || t.languageCode!,
              language: t.languageCode!,
              kind: 'captions',
            }),
          );
        emit('tracks');
      }
      if (info.track && typeof info.track === 'object') {
        const t = info.track as { languageCode?: string };
        activeTrackId = t.languageCode || null;
      }
    }
  }

  window.addEventListener('message', handleMessage);

  // The YouTube iframe doesn't begin emitting events until we send a
  // `listening` message after it has loaded. Send once on load (and
  // again as a fallback after a delay in case the load event fired
  // before our listener registered).
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
    iframe,
    state,
    ready: () => readyPromise,
    play: () => send('playVideo'),
    pause: () => send('pauseVideo'),
    seek: (seconds: number) => {
      state.currentTime = seconds;
      // allowSeekAhead = true so seeks past buffered content actually move.
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
    requestPictureInPicture: async () => {
      // YouTube's IFrame API does not expose PiP. Browsers can offer
      // it manually via right-click on some setups, but no JS hook.
      return false;
    },
    getTextTracks: () => tracks.slice(),
    getActiveTextTrack: () => activeTrackId,
    setTextTrack: (id) => {
      if (!id) {
        // YT module: setOption(captions, track, {}) clears the active track.
        send('unloadModule', 'captions');
        send('loadModule', 'captions');
        activeTrackId = null;
        return;
      }
      send('setOption', 'captions', 'track', { languageCode: id });
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
      stopPolling();
      window.removeEventListener('message', handleMessage);
      handlers.clear();
    },
  };
}

