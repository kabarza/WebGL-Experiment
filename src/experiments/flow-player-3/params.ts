import type { ExperimentControls } from '../../core/Experiment.ts';

// Default test videos.
const DEFAULT_VIMEO_URL = 'https://vimeo.com/804853787';      // Pro tier
const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

// ── Surfacing model ────────────────────────────────────────────
//
//   Surfaced in DialKit (emitted as data-* on the slot, editable
//   per-instance in Webflow's Settings panel after paste):
//     videoUrl, uiMode, vimeoMode, autoplay, showTitle, accentColor,
//     thumbColor, bufferColor, consent, skipSeconds
//
//   Less common (live only in the boot script's DEFAULTS block;
//   per-slot overrides still possible via matching data-* attrs):
//     muted, loop, playsinline, showControls, keyboardShortcuts,
//     autoHide, idleTimeout, autoPoster
//
//   NOT in dial — CSS on Webflow classes, edited in Style panel:
//     aspect ratio, slot background, border radius, box shadow

export const controls: ExperimentControls = {
  defaults: {
    paused: false,
    speed: 1.0,

    // Source
    videoUrl: DEFAULT_VIMEO_URL,

    // UI mode toggle
    //   js      → control bar created at runtime, ~5 tree nodes
    //   webflow → all controls ship as Webflow tree nodes, ~80 nodes
    uiMode: 'js',

    // Vimeo render-mode override
    //   auto   → oEmbed tier decides custom vs native UI
    //   custom → force custom UI (overlap Vimeo's chrome on free)
    //   native → force Vimeo's native UI even on Pro+
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

    // GDPR consent. 'off' = single click → play.
    // 'required' = first click shows notice, accept persists in
    // localStorage so subsequent embeds skip the gate.
    consent: 'off',

    // UX defaults (not surfaced as slot attributes)
    keyboardShortcuts: true,
    autoHide: true,
    idleTimeout: 2.5,
  },

  dialConfig: {
    Source: {
      _collapsed: false,
      videoUrl: { type: 'text', default: DEFAULT_VIMEO_URL },
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
    Privacy: {
      _collapsed: false,
      consent: {
        type: 'select',
        options: ['off', 'required'],
        default: 'off',
      },
    },
    'Accessibility & UX': {
      _collapsed: true,
      keyboardShortcuts: true,
      autoHide: true,
      idleTimeout: [2.5, 0.5, 10, 0.1],
    },
  },

  presets: {
    'JS — Vimeo (auto-tier)': {
      videoUrl: DEFAULT_VIMEO_URL,
      uiMode: 'js',
      vimeoMode: 'auto',
      accentColor: '#00b3ff',
      thumbColor: '#ffffff',
      consent: 'off',
    },
    'JS — YouTube': {
      videoUrl: DEFAULT_YOUTUBE_URL,
      uiMode: 'js',
      vimeoMode: 'auto',
      accentColor: '#ff0000',
      thumbColor: '#ffffff',
      consent: 'off',
    },
    'Webflow elements — Vimeo (auto-tier)': {
      videoUrl: DEFAULT_VIMEO_URL,
      uiMode: 'webflow',
      vimeoMode: 'auto',
      accentColor: '#00b3ff',
      thumbColor: '#ffffff',
      consent: 'off',
    },
    'Webflow elements — YouTube': {
      videoUrl: DEFAULT_YOUTUBE_URL,
      uiMode: 'webflow',
      vimeoMode: 'auto',
      accentColor: '#ff0000',
      thumbColor: '#ffffff',
      consent: 'off',
    },
    'Showreel (autoplay loop muted)': {
      autoplay: true,
      muted: true,
      loop: true,
      showControls: false,
      showTitle: false,
      accentColor: '#ffffff',
      consent: 'off',
    },
    'GDPR-compliant hero': {
      autoplay: false,
      consent: 'required',
      showTitle: true,
      accentColor: '#00b3ff',
    },
  },
};
