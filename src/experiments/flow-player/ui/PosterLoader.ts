// ============================================================
// Poster loader — auto-fetches a thumbnail for the video and
// applies it as a background image on the .vp-poster element.
//
// Skip rules (in order):
//   1. data-poster="none" → never fetch
//   2. data-poster="https://..." → use that URL directly
//   3. .vp-poster has child elements → user filled it themselves
//   4. otherwise: fetch from the provider's thumbnail endpoint
// ============================================================

import type { VideoSource } from '../helpers.ts';
import { fetchThumbnail } from '../helpers.ts';

function setBg(poster: HTMLElement, url: string): void {
  poster.style.backgroundImage = `url('${url.replace(/'/g, "\\'")}')`;
  poster.style.backgroundSize = 'cover';
  poster.style.backgroundPosition = 'center';
}

export async function loadPoster(slot: HTMLElement, source: VideoSource): Promise<void> {
  const poster = slot.querySelector<HTMLElement>('.vp-poster');
  if (!poster) return;

  const attr = slot.getAttribute('data-poster');
  if (attr === 'none') return;
  if (attr && attr !== 'auto') {
    setBg(poster, attr);
    return;
  }
  if (poster.children.length > 0) return;

  const result = await fetchThumbnail(source);
  if (result?.url) setBg(poster, result.url);
}
