// ============================================================
// Provider — common interface implemented by all four providers
// (Vimeo, YouTube, HLS, MP4). The control bar / keyboard handler /
// fullscreen manager all program against this interface and never
// branch on provider.
//
// Vimeo / YouTube implementations wrap an <iframe>; HLS / MP4
// implementations wrap a <video>. Either way, callers access the
// element through `.element` if they need it.
// ============================================================

export type ProviderEvent =
  | 'ready'
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'progress'
  | 'durationchange'
  | 'volumechange'
  | 'ratechange'
  | 'buffering'
  | 'playing'
  | 'error';

export type ProviderElement = HTMLIFrameElement | HTMLVideoElement;

export interface ProviderState {
  currentTime: number;
  duration: number;
  /** 0..1 fraction of the video that has been buffered ahead. */
  buffered: number;
  /** 0..1 volume. */
  volume: number;
  muted: boolean;
  paused: boolean;
  playbackRate: number;
}

export interface Provider {
  /** The DOM element this provider drives. <iframe> for Vimeo/YouTube,
   *  <video> for HLS/MP4. */
  element: ProviderElement;

  /** Resolves the first time the provider reports it's ready to play. */
  ready(): Promise<void>;

  play(): void;
  pause(): void;
  /** Seek to an absolute time, in seconds. */
  seek(seconds: number): void;
  /** 0..1 */
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** 0.25..2 */
  setPlaybackRate(rate: number): void;

  /** Snapshot of the most recent state — useful when the UI rebuilds. */
  state: Readonly<ProviderState>;

  on(event: ProviderEvent, handler: (data?: unknown) => void): () => void;

  destroy(): void;
}
