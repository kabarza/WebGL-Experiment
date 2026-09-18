// ============================================================
// plyr-vimeo helpers — shared by the React preview and the
// inline script written into the Webflow JSON export.
// ============================================================

// Pin Plyr to a known-good version. Bumping this requires re-testing.
export const PLYR_VERSION = '3.7.8';
export const PLYR_CSS_URL = `https://cdn.plyr.io/${PLYR_VERSION}/plyr.css`;
export const PLYR_JS_URL = `https://cdn.plyr.io/${PLYR_VERSION}/plyr.polyfilled.js`;

/**
 * Pull the numeric video ID out of any common Vimeo URL form:
 *   https://vimeo.com/76979871
 *   https://vimeo.com/channels/staffpicks/76979871
 *   https://vimeo.com/76979871/abc123          (private hash, ignored)
 *   https://player.vimeo.com/video/76979871
 *   76979871
 * Returns '' if no ID is found.
 */
export function parseVimeoId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;

  // player.vimeo.com/video/<id>
  const playerMatch = trimmed.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (playerMatch) return playerMatch[1];

  // vimeo.com/<...>/<id>  or  vimeo.com/<id>
  const allDigits = trimmed.match(/vimeo\.com\/(?:[^/]+\/)*(\d+)/i);
  if (allDigits) return allDigits[1];

  // Fallback: last digit run in the string.
  const lastDigits = trimmed.match(/(\d{6,})/);
  return lastDigits ? lastDigits[1] : '';
}

/** "16:9" → { w: 16, h: 9 }. Falls back to 16:9 on bad input. */
export function parseAspectRatio(input: string): { w: number; h: number } {
  const m = input?.match(/^(\d+)\s*:\s*(\d+)$/);
  if (!m) return { w: 16, h: 9 };
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return { w: 16, h: 9 };
  return { w, h };
}
