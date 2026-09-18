// ============================================================
// flow-player helpers — URL parsing and thumbnail lookup, shared
// by the React preview and the boot-script-as-string used in the
// Webflow JSON export.
// ============================================================

export type ProviderName = 'vimeo' | 'youtube';

export interface VideoSource {
  provider: ProviderName;
  /** Numeric Vimeo ID, or YouTube 11-char ID. */
  id: string;
}

/**
 * Parse a freeform URL into a provider + ID. Recognises:
 *
 *   Vimeo:
 *     https://vimeo.com/76979871
 *     https://vimeo.com/channels/staffpicks/76979871
 *     https://player.vimeo.com/video/76979871
 *     76979871
 *
 *   YouTube:
 *     https://www.youtube.com/watch?v=jNQXAC9IVRw
 *     https://youtu.be/jNQXAC9IVRw
 *     https://www.youtube.com/embed/jNQXAC9IVRw
 *     https://www.youtube.com/shorts/jNQXAC9IVRw
 *     jNQXAC9IVRw   (bare 11-char ID)
 *
 * Returns null if the URL doesn't match a recognised provider.
 */
export function parseVideoUrl(input: string): VideoSource | null {
  if (!input) return null;
  const s = input.trim();

  // YouTube — try first, since the 11-char ID pattern is more
  // distinctive than Vimeo's "any digits" pattern.
  let m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/))([\w-]{11})/i,
  );
  if (m) return { provider: 'youtube', id: m[1] };
  if (/^[\w-]{11}$/.test(s)) return { provider: 'youtube', id: s };

  // Vimeo
  m = s.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (m) return { provider: 'vimeo', id: m[1] };
  m = s.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i);
  if (m) return { provider: 'vimeo', id: m[1] };
  if (/^\d{6,}$/.test(s)) return { provider: 'vimeo', id: s };

  return null;
}

export interface ThumbnailResult {
  url: string;
  width?: number;
  height?: number;
}

/**
 * Fetch a poster thumbnail for the given video. For YouTube we use
 * the well-known i.ytimg.com URL pattern (no API call needed). For
 * Vimeo we hit the oEmbed endpoint, which returns a CDN URL plus
 * dimensions. Returns null when nothing is available — caller should
 * leave the poster blank.
 *
 * `widthHint` is only used by Vimeo (oEmbed accepts a width param).
 * YouTube's URL pattern picks the best size automatically.
 */
export async function fetchThumbnail(
  source: VideoSource,
  widthHint = 1280,
): Promise<ThumbnailResult | null> {
  if (source.provider === 'youtube') {
    // i.ytimg.com hosts canonical thumbnails. maxresdefault is 1280
    // wide when available; falls back to hqdefault automatically
    // by browser if maxres 404s? No — the server returns a 120px
    // placeholder image (not a 404), so the browser thinks it
    // succeeded. We use hqdefault as a safer default; users can
    // override via data-poster if they want maxres.
    return {
      url: `https://i.ytimg.com/vi/${source.id}/hqdefault.jpg`,
      width: 480,
      height: 360,
    };
  }
  try {
    const oembed =
      'https://vimeo.com/api/oembed.json?url=' +
      encodeURIComponent('https://vimeo.com/' + source.id) +
      `&width=${widthHint}`;
    const r = await fetch(oembed);
    if (!r.ok) return null;
    const data = (await r.json()) as {
      thumbnail_url?: string;
      thumbnail_width?: number;
      thumbnail_height?: number;
    };
    if (!data.thumbnail_url) return null;
    return {
      url: data.thumbnail_url,
      width: data.thumbnail_width,
      height: data.thumbnail_height,
    };
  } catch {
    return null;
  }
}

/**
 * Build the iframe URL for a given source, with the user's options
 * folded into provider-specific query params.
 *
 * Both providers accept very similar flags but spell them differently
 * — this is the one place the difference is encoded. Callers pass the
 * same option object regardless of provider.
 */
export interface VideoOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsinline?: boolean;
  showControls?: boolean;
  showTitle?: boolean;
  /** YouTube-only: show "More videos" suggestions at the end. */
  showRelated?: boolean;
  accentColor?: string;
  /** When set, used as the iframe origin (helps YouTube allow API). */
  origin?: string;
}

export function buildIframeSrc(
  source: VideoSource,
  opts: VideoOptions,
): string {
  if (source.provider === 'vimeo') {
    const p = new URLSearchParams();
    if (opts.autoplay) p.set('autoplay', '1');
    if (opts.muted) p.set('muted', '1');
    if (opts.loop) p.set('loop', '1');
    // The full set of "hide Vimeo's UI" flags. controls=0 hides the
    // bottom control bar; the rest cover overlays Vimeo paints on top
    // of the video (title, byline, portrait/avatar, share button,
    // related-videos prompt, speed picker). When our custom UI runs,
    // we pass showControls=false so all of these go to 0.
    p.set('controls', opts.showControls === false ? '0' : '1');
    if (opts.showControls === false) {
      p.set('title', '0');
      p.set('byline', '0');
      p.set('portrait', '0');
      p.set('share', '0');
      p.set('speed', '0');
      p.set('keyboard', '0');
      p.set('pip', '0');
      // Plyr's discovery (issue #697) — undocumented `transparent=0`
      // is the only flag that helps suppress Vimeo's UI on free
      // accounts. Doesn't fully hide it (only Pro+ tiers respect
      // controls=0), but combined with our opaque control bar
      // overlay, it's the best we can do without paying Vimeo.
      p.set('transparent', '0');
    } else {
      p.set('title', opts.showTitle ? '1' : '0');
      p.set('byline', '0');
      p.set('portrait', '0');
    }
    p.set('playsinline', opts.playsinline === false ? '0' : '1');
    if (opts.accentColor) {
      const hex = opts.accentColor.replace(/^#/, '').slice(0, 6);
      if (/^[0-9a-fA-F]{6}$/.test(hex)) p.set('color', hex);
    }
    p.set('dnt', '1');
    return `https://player.vimeo.com/video/${source.id}?${p.toString()}`;
  }
  // YouTube
  const p = new URLSearchParams();
  // enablejsapi=1 lets the IFrame API talk to it via postMessage.
  p.set('enablejsapi', '1');
  if (opts.origin) p.set('origin', opts.origin);
  if (opts.autoplay) p.set('autoplay', '1');
  if (opts.muted) p.set('mute', '1'); // YT spells it different
  if (opts.loop) {
    // YouTube's loop only works with playlist=<same id> set as well.
    p.set('loop', '1');
    p.set('playlist', source.id);
  }
  p.set('controls', opts.showControls === false ? '0' : '1');
  p.set('playsinline', opts.playsinline === false ? '0' : '1');
  p.set('rel', opts.showRelated ? '1' : '0');
  p.set('modestbranding', '1');
  // Use youtube-nocookie.com when consent matters? We default to the
  // privacy-enhanced domain to reduce GDPR exposure even when the
  // consent gate isn't enabled.
  return `https://www.youtube-nocookie.com/embed/${source.id}?${p.toString()}`;
}

/** Test-friendly noop, helps make ESM import not collapse to {} when tree-shaken in odd setups. */
export const _flowPlayerHelpersMarker = true;
