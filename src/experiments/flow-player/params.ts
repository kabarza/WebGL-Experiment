import type { ExperimentControls } from '../../core/Experiment.ts';

// Default test video — known to be on a Vimeo Pro account, so
// `controls=0` actually hides Vimeo's native chrome and our custom UI
// can take over cleanly.
const DEFAULT_VIMEO_URL = 'https://vimeo.com/804853787';
// YouTube test video — Big Buck Bunny on Blender Foundation's channel.
// YouTube's `controls=0` works on every video (no tier gating).
const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

// What ships in the dial vs. what lives in the script's DEFAULTS:
//
//   Surfaced in the dial (and as data-* attributes on the slot,
//   editable per-instance in Webflow's settings panel):
//     videoUrl            ← Vimeo or YouTube URL
//     autoplay
//     showTitle           ← Vimeo's title overlay; "show suggested
//                           videos" on YouTube (their related-videos)
//     accentColor
//     consent             ← off | required (GDPR 2-click)
//
//   Less common (lives only in the script's DEFAULTS at the top of
//   the boot script; users who want per-video overrides can still
//   add the matching data-* attribute manually):
//     muted, loop, playsinline, showControls,
//     keyboardShortcuts, autoHide, idleTimeout
//
//   NOT in the dial — these are CSS on a Webflow class and edited
//   in the Designer Style panel:
//     aspect ratio, background, border radius, box shadow, etc.

export const controls: ExperimentControls = {
  defaults: {
    paused: false,
    speed: 1.0,

    // Source
    videoUrl: DEFAULT_VIMEO_URL,

    // Vimeo Pro tier flag. Default false → assume free Vimeo, render
    // Vimeo's native player and skip our custom UI (since `controls=0`
    // is silently ignored on free accounts and our bar would just
    // overlap theirs). Flip to true for videos hosted on Vimeo Plus /
    // Pro / Business / Premium where Vimeo respects controls=0 and
    // our UI takes over cleanly. Has no effect on YouTube — YouTube
    // always uses our custom UI.
    vimeoPro: false,

    // Style — two colors so the timeline thumb (the dot) can stand
    // out against the played-fill accent.
    accentColor: '#00b3ff',
    thumbColor: '#ffffff',

    // Player behavior
    autoplay: false,
    muted: false,
    loop: false,
    playsinline: true,
    showControls: true,
    showTitle: true,

    // GDPR consent. 'off' = single click → play (current behavior).
    // 'required' = first click shows a notice, accept persists in
    // localStorage so subsequent embeds skip the gate.
    consent: 'off',

    // Accessibility / UX defaults (not surfaced as slot attributes)
    keyboardShortcuts: true,
    autoHide: true,
    idleTimeout: 2.5,
  },

  dialConfig: {
    Source: {
      _collapsed: false,
      videoUrl: { type: 'text', default: DEFAULT_VIMEO_URL },
      vimeoPro: false,
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
    'Vimeo Pro (custom UI)': {
      videoUrl: DEFAULT_VIMEO_URL,
      vimeoPro: true,
      autoplay: false,
      showControls: true,
      showTitle: true,
      accentColor: '#00b3ff',
      thumbColor: '#ffffff',
      consent: 'off',
    },
    'Vimeo free (native UI)': {
      videoUrl: 'https://vimeo.com/1084537',
      vimeoPro: false,
      autoplay: false,
      showTitle: true,
      accentColor: '#00b3ff',
      consent: 'off',
    },
    'YouTube (custom UI)': {
      videoUrl: DEFAULT_YOUTUBE_URL,
      vimeoPro: false,
      autoplay: false,
      showControls: true,
      showTitle: true,
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
