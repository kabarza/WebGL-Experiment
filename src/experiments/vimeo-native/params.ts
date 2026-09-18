import type { ExperimentControls } from '../../core/Experiment.ts';

const DEFAULT_VIMEO_URL = 'https://vimeo.com/1084537';

// Aspect ratio, background, and border radius are NOT in the dial
// because they're plain CSS on the .vimeo-native Webflow class —
// edit them directly in the Webflow Designer.
//
// Vimeo's accent color (the URL `color=` parameter) is a Plus/Pro
// feature on Vimeo's side. For free-tier videos Vimeo ignores it and
// the player UI stays default blue. We still pass the parameter
// through (it's free if you're on a paid Vimeo plan), and we *also*
// apply the accent color to our own play-button SVG via the
// data-accent-color attribute — so the dial always has visible
// effect on the published component, regardless of Vimeo plan.

export const controls: ExperimentControls = {
  defaults: {
    paused: false,
    speed: 1.0,

    // Source
    vimeoUrl: DEFAULT_VIMEO_URL,

    // Style
    accentColor: '#00b3ff',

    // Player behavior
    autoplay: false,
    muted: false,
    loop: false,
    playsinline: true,
    showControls: true,
    showTitle: true,
    showByline: false,
    showPortrait: false,
  },

  dialConfig: {
    Source: {
      _collapsed: false,
      vimeoUrl: { type: 'text', default: DEFAULT_VIMEO_URL },
    },
    Style: {
      _collapsed: false,
      accentColor: '#00b3ff',
    },
    Behavior: {
      _collapsed: false,
      autoplay: false,
      muted: false,
      loop: false,
      playsinline: true,
      showControls: true,
    },
    'Vimeo overlay': {
      _collapsed: true,
      showTitle: true,
      showByline: false,
      showPortrait: false,
    },
  },

  presets: {
    'Hero (clean controls)': {
      autoplay: false,
      muted: false,
      loop: false,
      showControls: true,
      accentColor: '#00b3ff',
    },
    'Showreel (autoplay loop muted)': {
      autoplay: true,
      muted: true,
      loop: true,
      showControls: false,
      accentColor: '#ffffff',
    },
    'Background ambient': {
      autoplay: true,
      muted: true,
      loop: true,
      showControls: false,
    },
  },
};
