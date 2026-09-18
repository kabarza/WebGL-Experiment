// ============================================================
// flow-player-2 helpers — URL parsing for native HTML5 sources,
// Vimeo, and YouTube. Adapted from flow-player but kept separate
// so flow-player-2 can evolve independently.
// ============================================================

export type ProviderName = 'vimeo' | 'youtube';

/** Source kind we'll feed to the runtime. */
export type SourceKind =
  | { provider: 'native'; src: string }
  | { provider: ProviderName; id: string };

/**
 * Parse a freeform URL into a typed source. Recognises:
 *
 *   YouTube:
 *     https://www.youtube.com/watch?v=jNQXAC9IVRw
 *     https://youtu.be/jNQXAC9IVRw
 *     https://www.youtube.com/embed/jNQXAC9IVRw
 *     https://www.youtube.com/shorts/jNQXAC9IVRw
 *
 *   Vimeo:
 *     https://vimeo.com/76979871
 *     https://vimeo.com/channels/staffpicks/76979871
 *     https://player.vimeo.com/video/76979871
 *
 *   Native:
 *     anything else (mp4, webm, mov, m3u8, blob:, etc.)
 *
 * Bare digits or 11-char IDs are NOT auto-classified — too easy to
 * misfire on a path that just happens to have digits. Always pass a
 * full URL.
 */
export function parseSource(input: string): SourceKind | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // YouTube
  let m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/))([\w-]{11})/i,
  );
  if (m) return { provider: 'youtube', id: m[1] };

  // Vimeo
  m = s.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (m) return { provider: 'vimeo', id: m[1] };
  m = s.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i);
  if (m) return { provider: 'vimeo', id: m[1] };

  // Anything else — assume native HTML5 source URL.
  return { provider: 'native', src: s };
}

interface IframeOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsinline?: boolean;
  /** When set, used as the iframe origin (helps YouTube allow API). */
  origin?: string;
}

/**
 * Build the iframe URL for a Vimeo or YouTube source. We always
 * disable native chrome (controls=0) — flow-player-2's UI is the
 * Webflow-built bar, not whatever the provider would render.
 */
export function buildIframeSrc(
  source: { provider: ProviderName; id: string },
  opts: IframeOptions = {},
): string {
  if (source.provider === 'vimeo') {
    const p = new URLSearchParams();
    if (opts.autoplay) p.set('autoplay', '1');
    if (opts.muted) p.set('muted', '1');
    if (opts.loop) p.set('loop', '1');
    p.set('controls', '0');
    p.set('playsinline', opts.playsinline === false ? '0' : '1');
    p.set('title', '0');
    p.set('byline', '0');
    p.set('portrait', '0');
    p.set('dnt', '1');
    return `https://player.vimeo.com/video/${source.id}?${p.toString()}`;
  }
  // YouTube — youtube-nocookie domain by default for lighter privacy load.
  const p = new URLSearchParams();
  p.set('enablejsapi', '1');
  if (opts.origin) p.set('origin', opts.origin);
  if (opts.autoplay) p.set('autoplay', '1');
  if (opts.muted) p.set('mute', '1');
  if (opts.loop) {
    p.set('loop', '1');
    p.set('playlist', source.id);
  }
  p.set('controls', '0');
  p.set('playsinline', opts.playsinline === false ? '0' : '1');
  p.set('rel', '0');
  p.set('modestbranding', '1');
  return `https://www.youtube-nocookie.com/embed/${source.id}?${p.toString()}`;
}
