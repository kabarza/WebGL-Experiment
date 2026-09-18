import type { ExperimentControls } from '../../core/Experiment.ts';

// Default test sources for each provider — pickable via the version dropdown.
const DEFAULT_VIMEO_URL = 'https://vimeo.com/804853787'; // known Pro
const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const DEFAULT_HLS_URL =
  'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8';
const DEFAULT_MP4_URL = 'https://media.w3.org/2010/05/sintel/trailer.mp4';

// ── Surfacing model ───────────────────────────────────────────
//
//   Surfaced in DialKit (emitted as data-* on the slot, editable
//   per-instance in Webflow's Settings panel after paste):
//     videoUrl, uiMode, vimeoMode, autoplay, showTitle,
//     accentColor, thumbColor, posterUrl
//
//   Less common (live only in the boot script's DEFAULTS; per-slot
//   overrides still possible by adding the matching data-* attribute):
//     muted, loop, playsinline, showControls, keyboardShortcuts
//
//   NOT in the dial — CSS on Webflow classes, editable in Designer's
//   Style panel: aspect ratio, slot background, border radius, etc.

export const controls: ExperimentControls = {
  defaults: {
    paused: false,
    speed: 1.0,

    // Source — URL auto-detection picks the right provider
    videoUrl: DEFAULT_VIMEO_URL,

    // UI mode toggle
    //   js      → control bar created at runtime (~5 tree nodes)
    //   webflow → control bar elements as Webflow tree nodes (~25 nodes)
    uiMode: 'js',

    // Vimeo render-mode override (only meaningful for Vimeo sources)
    //   auto   → oEmbed tier decides (free → native, Pro+ → custom)
    //   custom → force custom UI even on free Vimeo (chrome will overlap)
    //   native → force Vimeo's native player even on Pro
    vimeoMode: 'auto',

    // Style
    accentColor: '#00b3ff',
    thumbColor: '#ffffff',

    // Player behavior
    autoplay: false,
    muted: false,
    loop: false,
    playsinline: true,
    showControls: true,
    showTitle: true,

    // Poster URL — used by HLS / MP4 providers (Vimeo / YouTube
    // auto-fetch from their oEmbed / i.ytimg endpoints, this is
    // ignored). Blank string → no poster.
    posterUrl: '',

    // UX defaults (not surfaced as slot attributes)
    keyboardShortcuts: true,
  },

  dialConfig: {
    Source: {
      _collapsed: false,
      videoUrl: { type: 'text', default: DEFAULT_VIMEO_URL },
      posterUrl: { type: 'text', default: '' },
      uiMode: {
        type: 'select',
        options: ['js', 'webflow'],
        default: 'js',
      },
      vimeoMode: {
        type: 'select',
        options: ['auto', 'custom', 'native'],
        default: 'auto',
      },
    },
    Style: {
      _collapsed: false,
      accentColor: '#00b3ff',
      thumbColor: '#ffffff',
    },
    Behavior: {
      _collapsed: false,
      autoplay: false,
      muted: false,
      loop: false,
      playsinline: true,
      showControls: true,
      showTitle: true,
    },
    'Accessibility & UX': {
      _collapsed: true,
      keyboardShortcuts: true,
    },
  },

  presets: {
    'Vimeo (auto-tier)': {
      videoUrl: DEFAULT_VIMEO_URL,
      uiMode: 'js',
      vimeoMode: 'auto',
    },
    'YouTube': {
      videoUrl: DEFAULT_YOUTUBE_URL,
      uiMode: 'js',
      accentColor: '#ff0000',
    },
    'HLS (Mux test stream)': {
      videoUrl: DEFAULT_HLS_URL,
      uiMode: 'js',
    },
    'MP4 (W3C Sintel)': {
      videoUrl: DEFAULT_MP4_URL,
      uiMode: 'js',
    },
    'Webflow elements — Vimeo': {
      videoUrl: DEFAULT_VIMEO_URL,
      uiMode: 'webflow',
      vimeoMode: 'auto',
    },
    'Webflow elements — YouTube': {
      videoUrl: DEFAULT_YOUTUBE_URL,
      uiMode: 'webflow',
      accentColor: '#ff0000',
    },
    'Showreel (autoplay loop muted)': {
      videoUrl: DEFAULT_MP4_URL,
      autoplay: true,
      muted: true,
      loop: true,
      showControls: false,
    },
  },
};
