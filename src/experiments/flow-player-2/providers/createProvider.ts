import type { Provider } from './types.ts';
import type { ProviderName } from '../helpers.ts';
import { createVimeoProvider } from './VimeoProvider.ts';
import { createYouTubeProvider } from './YouTubeProvider.ts';

export function createProvider(
  name: ProviderName,
  iframe: HTMLIFrameElement,
): Provider {
  return name === 'vimeo' ? createVimeoProvider(iframe) : createYouTubeProvider(iframe);
}
