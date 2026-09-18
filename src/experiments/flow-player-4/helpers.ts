// ============================================================
// flow-player-4 helpers — URL detection (4 source types),
// Vimeo oEmbed (with account tier), and iframe URL building.
// Shared by the React preview and the boot script.
// ============================================================

export type ProviderName = 'vimeo' | 'youtube' | 'hls' | 'mp4';

export type VimeoAccountTier =
  | 'basic' // free — `controls=0` ignored, native UI must show
  | 'plus'
  | 'pro'
  | 'business'
  | 'premium';

export interface VideoSource {
  provider: ProviderName;
  /** Numeric Vimeo ID, YouTube 11-char ID, or full URL (for HLS / MP4). */
  id: string;
  /** The original URL the user gave us. */
  url: string;
}

/**
 * Detect provider from a URL and extract the relevant id.
 * Returns null when the URL doesn't match any recognised pattern.
 *
 * Order of detection matters:
 *   YouTube first (distinctive 11-char ID + youtube.com / youtu.be)
 *   Vimeo (vimeo.com + numeric ID, or just digits)
 *   HLS (anything ending in .m3u8)
 *   MP4 (anything ending in .mp4 / .webm / .mov)
 */
export function parseVideoUrl(input: string): VideoSource | null {
  if (!input) return null;
  const s = input.trim();

  // YouTube
  let m = s.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/|v\/))([\w-]{11})/i,
  );
  if (m) return { provider: 'youtube', id: m[1], url: s };
  if (/^[\w-]{11}$/.test(s)) return { provider: 'youtube', id: s, url: s };

  // Vimeo
  m = s.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (m) return { provider: 'vimeo', id: m[1], url: s };
  m = s.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i);
  if (m) return { provider: 'vimeo', id: m[1], url: s };
  if (/^\d{6,}$/.test(s)) return { provider: 'vimeo', id: s, url: s };

  // HLS
  if (/\.m3u8(\?|#|$)/i.test(s)) return { provider: 'hls', id: s, url: s };

  // MP4 / WebM / MOV — accept any URL ending in those extensions
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(s)) {
    return { provider: 'mp4', id: s, url: s };
  }

  // Fallback: if it's an absolute URL but no extension match, assume MP4
  // (don't bother if it's not even http/s).
  if (/^https?:\/\//.test(s)) return { provider: 'mp4', id: s, url: s };

  return null;
}

export interface ThumbnailResult {
  url: string;
  width?: number;
  height?: number;
  /**
   * Vimeo only. The account tier of the video owner — drives the
   * decision between our custom UI and Vimeo's native player. `basic`
   * accounts can't hide their native chrome via controls=0, so we
   * fall back to their player for those.
   */
  accountType?: VimeoAccountTier;
  isPlus?: boolean;
}

/**
 * Fetch poster thumbnail + (for Vimeo) the account tier.
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
  if (source.provider === 'vimeo') {
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
  // HLS / MP4 — no auto-thumbnail. Caller uses data-poster if set.
  return null;
}

function isVimeoTier(s: string | undefined): s is VimeoAccountTier {
  return s === 'basic' || s === 'plus' || s === 'pro' || s === 'business' || s === 'premium';
}

export interface VideoOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsinline?: boolean;
  /**
   * When false, we tell the provider to hide its native chrome so our
   * custom UI can take over. When true, we let the provider show its
   * own controls (free Vimeo case).
   */
  showControls?: boolean;
  showTitle?: boolean;
  accentColor?: string;
  origin?: string;
}

/** Build the iframe src for Vimeo / YouTube. HLS / MP4 don't use iframes. */
export function buildIframeSrc(source: VideoSource, opts: VideoOptions): string {
  if (source.provider === 'vimeo') {
    const p = new URLSearchParams();
    if (opts.autoplay) p.set('autoplay', '1');
    if (opts.muted) p.set('muted', '1');
    if (opts.loop) p.set('loop', '1');
    p.set('controls', opts.showControls === false ? '0' : '1');
    if (opts.showControls === false) {
      // Aggressively hide Vimeo's overlays. transparent=0 is the
      // undocumented one Plyr discovered helps the most. Pro+ only
      // — free accounts ignore these.
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
  if (source.provider === 'youtube') {
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
    p.set('rel', '0');
    p.set('modestbranding', '1');
    return `https://www.youtube-nocookie.com/embed/${source.id}?${p.toString()}`;
  }
  // HLS / MP4 — caller doesn't use this; <video src=...> uses the URL directly.
  return source.url;
}

/** Format seconds as `m:ss` or `h:mm:ss`. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}
