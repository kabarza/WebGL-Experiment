// ============================================================
// vimeo-native helpers — pure URL building, no library.
// Shared by the React preview and the Webflow JSON export.
// ============================================================

/**
 * Pull the numeric video ID out of any common Vimeo URL form:
 *   https://vimeo.com/76979871
 *   https://vimeo.com/channels/staffpicks/76979871
 *   https://player.vimeo.com/video/76979871
 *   76979871
 */
export function parseVimeoId(input: string): string {
  if (!input) return '';
  const s = input.trim();
  if (/^\d+$/.test(s)) return s;
  const player = s.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (player) return player[1];
  const generic = s.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i);
  if (generic) return generic[1];
  const lastDigits = s.match(/(\d{6,})/);
  return lastDigits ? lastDigits[1] : '';
}

export function parseAspectRatio(input: string): { w: number; h: number } {
  const m = input?.match(/^(\d+)\s*:\s*(\d+)$/);
  if (!m) return { w: 16, h: 9 };
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return { w: 16, h: 9 };
  return { w, h };
}

export interface VimeoOptions {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsinline?: boolean;
  showControls?: boolean;
  showTitle?: boolean;
  showByline?: boolean;
  showPortrait?: boolean;
  accentColor?: string;
}

/**
 * Build the player.vimeo.com URL. Every behavior flag the user can
 * toggle in the dial maps to one Vimeo URL parameter — no JS player
 * library required.
 */
export function buildVimeoSrc(id: string, opts: VimeoOptions): string {
  if (!id) return '';
  const p = new URLSearchParams();
  if (opts.autoplay) p.set('autoplay', '1');
  if (opts.muted) p.set('muted', '1');
  if (opts.loop) p.set('loop', '1');
  p.set('controls', opts.showControls === false ? '0' : '1');
  p.set('playsinline', opts.playsinline === false ? '0' : '1');
  p.set('title', opts.showTitle ? '1' : '0');
  p.set('byline', opts.showByline ? '1' : '0');
  p.set('portrait', opts.showPortrait ? '1' : '0');
  // Vimeo accepts the accent color as a 6-char hex without the leading "#".
  if (opts.accentColor) {
    const hex = opts.accentColor.replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(hex)) p.set('color', hex);
  }
  // dnt=1 skips the analytics ping for "I'm just embedding" cases.
  p.set('dnt', '1');
  return `https://player.vimeo.com/video/${id}?${p.toString()}`;
}
