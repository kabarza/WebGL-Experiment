// ============================================================
// MediaSource — unified surface over the native <video> element
// and the iframe Vimeo/YouTube providers. The runtime only talks
// to this interface, so it never branches on source kind.
//
// Two adapters:
//   NativeMediaSource — wraps an HTMLVideoElement (mp4/webm/etc).
//   ProviderMediaSource — wraps a Vimeo or YouTube Provider.
//
// Both expose the same getters, setters, and event subscriptions.
// ============================================================

import { createProvider } from './providers/createProvider.ts';
import type { Provider, ProviderEvent } from './providers/types.ts';
import { buildIframeSrc, type ProviderName } from './helpers.ts';

export type MediaEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'durationchange'
  | 'progress'
  | 'volumechange'
  | 'ratechange';

export interface MediaSource {
  /** The element actually painted into the stage (video or iframe). */
  readonly element: HTMLElement;

  readonly currentTime: number;
  readonly duration: number;
  /** 0..1 fraction of the timeline buffered ahead of the playhead. */
  readonly buffered: number;
  readonly volume: number;
  readonly muted: boolean;
  readonly paused: boolean;
  readonly ended: boolean;
  readonly playbackRate: number;

  play(): void;
  pause(): void;
  seek(seconds: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  setPlaybackRate(r: number): void;

  on(event: MediaEvent, handler: () => void): () => void;

  destroy(): void;
}

// ── Native (HTML5 <video>) adapter ───────────────────────────

export function createNativeMediaSource(video: HTMLVideoElement): MediaSource {
  const cleanups: Array<() => void> = [];

  function bufferedFrac(): number {
    const dur = video.duration;
    if (!Number.isFinite(dur) || dur <= 0) return 0;
    let end = 0;
    for (let i = 0; i < video.buffered.length; i++) {
      end = Math.max(end, video.buffered.end(i));
    }
    return Math.min(1, end / dur);
  }

  return {
    element: video,
    get currentTime() { return video.currentTime; },
    get duration() { return Number.isFinite(video.duration) ? video.duration : 0; },
    get buffered() { return bufferedFrac(); },
    get volume() { return video.volume; },
    get muted() { return video.muted; },
    get paused() { return video.paused; },
    get ended() { return video.ended; },
    get playbackRate() { return video.playbackRate; },

    play() { void video.play().catch(() => { /* policy block — ignore */ }); },
    pause() { video.pause(); },
    seek(seconds) { video.currentTime = seconds; },
    setVolume(v) {
      video.volume = Math.max(0, Math.min(1, v));
      if (video.volume === 0) video.muted = true;
      else if (video.muted) video.muted = false;
    },
    setMuted(m) { video.muted = m; },
    setPlaybackRate(r) { video.playbackRate = r; },

    on(event, handler) {
      video.addEventListener(event, handler);
      return () => video.removeEventListener(event, handler);
    },

    destroy() {
      for (const fn of cleanups) fn();
    },
  };
}

// ── Provider (Vimeo / YouTube iframe) adapter ────────────────

export interface ProviderMediaSourceOptions {
  /** Initial flags to seed the iframe URL. */
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsinline?: boolean;
}

export function createProviderMediaSource(
  source: { provider: ProviderName; id: string },
  opts: ProviderMediaSourceOptions = {},
): MediaSource {
  const iframe = document.createElement('iframe');
  iframe.allowFullscreen = true;
  iframe.setAttribute(
    'allow',
    'autoplay; encrypted-media; fullscreen; picture-in-picture',
  );
  // Fill the same box the <video> would occupy — runtime drops it
  // into the stage right after the <video> and hides the latter.
  iframe.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;';
  iframe.src = buildIframeSrc(source, {
    ...opts,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  });

  const provider: Provider = createProvider(source.provider, iframe);

  // Apply initial flags once the provider is ready.
  void provider.ready().then(() => {
    if (opts.muted) provider.setMuted(true);
  });

  // The MediaEvent set is a strict subset of ProviderEvent so we
  // can pass the name through. (`progress` and `durationchange`
  // exist on both, etc.)
  return {
    element: iframe,
    get currentTime() { return provider.state.currentTime; },
    get duration() { return provider.state.duration; },
    get buffered() { return provider.state.buffered; },
    get volume() { return provider.state.volume; },
    get muted() { return provider.state.muted; },
    get paused() { return provider.state.paused; },
    get ended() { return provider.state.paused && provider.state.currentTime >= provider.state.duration && provider.state.duration > 0; },
    get playbackRate() { return provider.state.playbackRate; },

    play() { provider.play(); },
    pause() { provider.pause(); },
    seek(seconds) { provider.seek(seconds); },
    setVolume(v) { provider.setVolume(Math.max(0, Math.min(1, v))); },
    setMuted(m) { provider.setMuted(m); },
    setPlaybackRate(r) { provider.setPlaybackRate(r); },

    on(event, handler) {
      // MediaEvent ⊂ ProviderEvent — passthrough.
      return provider.on(event as ProviderEvent, handler);
    },

    destroy() {
      provider.destroy();
      if (iframe.parentElement) iframe.parentElement.removeChild(iframe);
    },
  };
}
