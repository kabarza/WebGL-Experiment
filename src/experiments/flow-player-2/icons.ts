// SVG icon strings shipped inside HtmlEmbed nodes in the Webflow
// JSON, and rendered with innerHTML in the in-app preview. Each
// uses currentColor so designers tint via the parent's CSS color.
//
// All icons share a 24×24 viewBox and the same visual weight so
// they line up cleanly in the controls bar. Stroke-based icons
// use stroke-width 2, round caps; fill-based icons use solid
// shapes. Both styles use `fill="currentColor"` or
// `stroke="currentColor"` so the wrapper's color rule controls
// every icon at once.

const STROKE_BASE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const ICON_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M7 5.3c0-1 1.1-1.6 1.9-1L19 11c.8.4.8 1.6 0 2L8.9 19.7c-.8.5-1.9-.1-1.9-1V5.3Z"/></svg>`;

export const ICON_PAUSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>`;

export const ICON_REPLAY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" ${STROKE_BASE} aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 4v5h-5"/></svg>`;

// "Back 10s" — counterclockwise arrow + 10 label.
export const ICON_BACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" ${STROKE_BASE} aria-hidden="true"><path d="M3 12a9 9 0 1 0 3.5-7.1"/><path d="M3 4v5h5"/><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">10</text></svg>`;

// "Forward 10s" — clockwise arrow + 10 label.
export const ICON_FORWARD = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" ${STROKE_BASE} aria-hidden="true"><path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 4v5h-5"/><text x="12" y="15.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor" stroke="none" font-family="system-ui,sans-serif">10</text></svg>`;

export const ICON_VOLUME_FULL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M3 9.4v5.2c0 .8.7 1.4 1.4 1.4h3.4l4.3 4.3c.6.6 1.6.2 1.6-.7V4.4c0-.9-1-1.3-1.6-.7L7.8 8H4.4C3.7 8 3 8.6 3 9.4Zm15.4-3.8a1 1 0 0 0-1.4 1.4 7 7 0 0 1 0 9.9 1 1 0 0 0 1.4 1.4 9 9 0 0 0 0-12.7Zm-2.8 2.8a1 1 0 0 0-1.4 1.4 3 3 0 0 1 0 4.2 1 1 0 0 0 1.4 1.4 5 5 0 0 0 0-7Z"/></svg>`;

export const ICON_VOLUME_MID = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M3 9.4v5.2c0 .8.7 1.4 1.4 1.4h3.4l4.3 4.3c.6.6 1.6.2 1.6-.7V4.4c0-.9-1-1.3-1.6-.7L7.8 8H4.4C3.7 8 3 8.6 3 9.4Zm12.6-1a1 1 0 0 0-1.4 1.4 3 3 0 0 1 0 4.2 1 1 0 0 0 1.4 1.4 5 5 0 0 0 0-7Z"/></svg>`;

export const ICON_VOLUME_MUTE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><path d="M3 9.4v5.2c0 .8.7 1.4 1.4 1.4h3.4l4.3 4.3c.6.6 1.6.2 1.6-.7V4.4c0-.9-1-1.3-1.6-.7L7.8 8H4.4C3.7 8 3 8.6 3 9.4ZM21.7 9.7a1 1 0 0 0-1.4-1.4l-2 2-2-2a1 1 0 0 0-1.4 1.4l2 2-2 2a1 1 0 0 0 1.4 1.4l2-2 2 2a1 1 0 0 0 1.4-1.4l-2-2 2-2Z"/></svg>`;

// Enter fullscreen — corner brackets pointing OUTWARD (expand).
export const ICON_FULLSCREEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" ${STROKE_BASE} aria-hidden="true"><path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M20 15v5h-5"/><path d="M4 15v5h5"/></svg>`;

// Exit fullscreen — corner brackets pointing INWARD (collapse).
export const ICON_MINIMIZE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" ${STROKE_BASE} aria-hidden="true"><path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M15 20v-5h5"/><path d="M9 20v-5H4"/></svg>`;

export const ICON_SETTINGS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>`;

export const ICON_CHECK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>`;
