// ============================================================
// Provider — common interface both Vimeo and YouTube implement.
//
// The control bar / keyboard handler / fullscreen manager all
// program against this interface and never branch on provider.
// Each implementation translates the unified surface into its
// provider's postMessage protocol.
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
  | 'tracks'
  | 'error';

export interface TextTrack {
  /** Stable id used by setTextTrack(). For Vimeo this is `${language}-${kind}`, for YouTube it's the languageCode. */
  id: string;
  /** Display label e.g. "English" / "Deutsch". */
  label: string;
  language: string;
  kind: 'captions' | 'subtitles';
}

export interface ProviderState {
  /** Player time in seconds. Updated by the provider on timeupdate. */
  currentTime: number;
  /** Video duration in seconds. May be 0 until durationchange fires. */
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
  iframe: HTMLIFrameElement;

  /** Resolves the first time the provider reports it's ready. */
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
  /** Vimeo-only (resolves to false on YouTube). */
  requestPictureInPicture(): Promise<boolean>;

  /** Returns the list of available text tracks. May be empty until ready. */
  getTextTracks(): TextTrack[];
  /** Pass a track id to enable, or null to turn captions off. */
  setTextTrack(id: string | null): void;
  /** Currently active track id, or null. */
  getActiveTextTrack(): string | null;

  /** Snapshot of the most recent state — useful when the UI rebuilds. */
  state: Readonly<ProviderState>;

  on(event: ProviderEvent, handler: (data?: unknown) => void): () => void;

  destroy(): void;
}
