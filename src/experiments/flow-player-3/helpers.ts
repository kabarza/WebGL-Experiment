// ============================================================
// flow-player-3 helpers — URL parsing, oEmbed (with tier!),
// iframe URL building. Shared by the React preview and the
// boot script that ships in the Webflow JSON.
// ============================================================

export type ProviderName = 'vimeo' | 'youtube';

export type VimeoAccountTier =
  | 'basic'      // free — `controls=0` ignored, native UI must show
  | 'plus'
  | 'pro'
  | 'business'
  | 'premium';

export interface VideoSource {
  provider: ProviderName;
  /** Numeric Vimeo ID, or YouTube 11-char ID. */
  id: string;
}

export function parseVideoUrl(input: string): VideoSource | null {
  if (!input) return null;
  const s = input.trim();

  // YouTube first — 11-char ID pattern is more distinctive than Vimeo's "any digits"
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
  /**
   * Vimeo only. The account tier of the video owner — drives the
   * decision between our custom UI and Vimeo's native player. `basic`
   * accounts can't hide their native chrome via `controls=0`, so we
   * fall back to their player for those.
   */
  accountType?: VimeoAccountTier;
  isPlus?: boolean;
}

/**
 * Fetch poster thumbnail + (for Vimeo) the account tier.
 *
 * Vimeo oEmbed returns:
 *   thumbnail_url, thumbnail_width, thumbnail_height, account_type, is_plus
 * YouTube uses i.ytimg.com URL pattern — no tier check needed since
 * `controls=0` is honored on every YouTube video.
 *
 * Returns null on failure; caller leaves the poster blank.
 */
export async function fetchThumbnail(
  source: VideoSource,
  widthHint = 1280,
): Promise<ThumbnailResult | null> {
  if (source.provider === 'youtube') {
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
      account_type?: string;
      is_plus?: number;
    };
    if (!data.thumbnail_url) return null;
    const tier = isVimeoTier(data.account_type) ? data.account_type : undefined;
    return {
      url: data.thumbnail_url,
      width: data.thumbnail_width,
      height: data.thumbnail_height,
      accountType: tier,
      isPlus: data.is_plus === 1,
    };
  } catch {
    return null;
  }
}

function isVimeoTier(s: string | undefined): s is VimeoAccountTier {
  return (
    s === 'basic' || s === 'plus' || s === 'pro' || s === 'business' || s === 'premium'
  );
}

export interface VideoOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsinline?: boolean;
  /**
   * When false, we tell the provider to hide its native chrome so
   * our custom UI can take over. When true, we let the provider
   * show its own controls (free Vimeo case).
   */
  showControls?: boolean;
  showTitle?: boolean;
  showRelated?: boolean;
  accentColor?: string;
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
    p.set('controls', opts.showControls === false ? '0' : '1');
    if (opts.showControls === false) {
      // Aggressively hide every overlay element Vimeo paints. Plyr's
      // discovery: `transparent=0` is the undocumented flag that
      // helps the most. (Only Pro+ accounts honor any of these.)
      p.set('title', '0');
      p.set('byline', '0');
      p.set('portrait', '0');
      p.set('share', '0');
      p.set('speed', '0');
      p.set('keyboard', '0');
      p.set('pip', '0');
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
  p.set('enablejsapi', '1');
  if (opts.origin) p.set('origin', opts.origin);
  if (opts.autoplay) p.set('autoplay', '1');
  if (opts.muted) p.set('mute', '1');
  if (opts.loop) {
    p.set('loop', '1');
    p.set('playlist', source.id);
  }
  p.set('controls', opts.showControls === false ? '0' : '1');
  p.set('playsinline', opts.playsinline === false ? '0' : '1');
  p.set('rel', opts.showRelated ? '1' : '0');
  p.set('modestbranding', '1');
  return `https://www.youtube-nocookie.com/embed/${source.id}?${p.toString()}`;
}
