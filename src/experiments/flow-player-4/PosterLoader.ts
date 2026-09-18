// ============================================================
// PosterLoader — fetches provider thumbnail. For Vimeo, oEmbed
// also exposes the account tier which we feed into the StateBridge
// so the Player can auto-decide whether to overlay our chrome.
//
// Skip rules:
//   data-poster="none"       → never set a bg
//   data-poster="<url>"      → use the url; still resolve tier
//   .vp-poster has children  → don't overwrite
//   otherwise                → fetch + apply
//
// For HLS/MP4 sources we have no oEmbed; the caller is expected to
// either provide data-poster or leave it blank.
// ============================================================

import type { VideoSource } from './helpers.ts';
import { fetchThumbnail } from './helpers.ts';
import type { StateBridge } from './StateBridge.ts';

function setBg(poster: HTMLElement, url: string): void {
  poster.style.backgroundImage = `url('${url.replace(/'/g, "\\'")}')`;
  poster.style.backgroundSize = 'cover';
  poster.style.backgroundPosition = 'center';
}

export interface PosterResult {
  tier?: string;
}

export async function loadPoster(
  slot: HTMLElement,
  source: VideoSource,
  state: StateBridge,
): Promise<PosterResult> {
  const poster = slot.querySelector<HTMLElement>('.vp-poster');
  const attr = slot.getAttribute('data-poster');

  // For HLS/MP4 there's no oEmbed lookup; helpers.fetchThumbnail
  // returns null for those providers.
  const result = await fetchThumbnail(source).catch(() => null);

  if (result?.accountType) {
    state.setVimeoTier(result.accountType);
  }

  if (!poster) return { tier: result?.accountType };
  if (attr === 'none') return { tier: result?.accountType };
  if (attr && attr !== 'auto') {
    setBg(poster, attr);
    return { tier: result?.accountType };
  }
  if (poster.children.length > 0) return { tier: result?.accountType };
  if (result?.url) setBg(poster, result.url);

  return { tier: result?.accountType };
}
