// ============================================================
// createProvider — factory that builds the right Provider for a
// given source. The caller (Player orchestrator) is responsible
// for having already created the right DOM element:
//
//   vimeo / youtube → <iframe> (src already set via buildIframeSrc)
//   hls / mp4       → <video>  (src not yet set; provider sets it)
//
// Keeping element creation outside the factory lets the Player
// own the element lifecycle (mount/unmount, sizing, attrs) without
// the provider knowing about layout.
// ============================================================

import type { VideoSource } from '../helpers.ts';
import { createVimeoProvider } from './VimeoProvider.ts';
import { createYouTubeProvider } from './YouTubeProvider.ts';
import { createHlsProvider } from './HlsProvider.ts';
import { createMp4Provider } from './Mp4Provider.ts';
import type { Provider } from './types.ts';

export function createProvider(
  source: VideoSource,
  element: HTMLIFrameElement | HTMLVideoElement,
): Provider {
  switch (source.provider) {
    case 'vimeo':
      if (!(element instanceof HTMLIFrameElement)) {
        throw new Error('Vimeo provider requires an <iframe> element');
      }
      return createVimeoProvider(element);

    case 'youtube':
      if (!(element instanceof HTMLIFrameElement)) {
        throw new Error('YouTube provider requires an <iframe> element');
      }
      return createYouTubeProvider(element);

    case 'hls':
      if (!(element instanceof HTMLVideoElement)) {
        throw new Error('HLS provider requires a <video> element');
      }
      return createHlsProvider(element, source.url);

    case 'mp4':
      if (!(element instanceof HTMLVideoElement)) {
        throw new Error('MP4 provider requires a <video> element');
      }
      return createMp4Provider(element, source.url);

    default: {
      const _exhaustive: never = source.provider;
      throw new Error(`Unknown provider: ${String(_exhaustive)}`);
    }
  }
}
