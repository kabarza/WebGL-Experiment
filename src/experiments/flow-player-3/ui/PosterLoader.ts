// ============================================================
// PosterLoader — fetches provider thumbnail + (for Vimeo) the
// account tier in a single oEmbed call.
//
// Skip rules:
//   1. data-poster="none" → never fetch
//   2. data-poster="https://..." → use directly, still fetch tier
//   3. .vp-poster has child elements → don't overwrite poster
//   4. otherwise: fetch + apply
// ============================================================

import type { VideoSource } from '../helpers.ts';
import { fetchThumbnail } from '../helpers.ts';
import type { StateBridge } from './StateBridge.ts';

function setBg(poster: HTMLElement, url: string): void {
  poster.style.backgroundImage = `url('${url.replace(/'/g, "\\'")}')`;
  poster.style.backgroundSize = 'cover';
  poster.style.backgroundPosition = 'center';
}

export interface PosterResult {
  /** Vimeo account tier, when known. Used by Player to decide UI mode. */
  tier?: string;
}

export async function loadPoster(
  slot: HTMLElement,
  source: VideoSource,
  state: StateBridge,
): Promise<PosterResult> {
  const poster = slot.querySelector<HTMLElement>('.vp-poster');
  const attr = slot.getAttribute('data-poster');

  // Even when poster is overridden, we still want the tier info for
  // Vimeo. Fire the fetch regardless; only apply the bg when allowed.
  const fetchPromise = fetchThumbnail(source);

  const result = await fetchPromise;
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
