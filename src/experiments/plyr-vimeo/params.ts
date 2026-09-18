import type { ExperimentControls } from '../../core/Experiment.ts';

const DEFAULT_VIMEO_URL = 'https://vimeo.com/1084537';

export const controls: ExperimentControls = {
  defaults: {
    paused: false,
    speed: 1.0,

    // Source
    vimeoUrl: DEFAULT_VIMEO_URL,

    // Plyr exposes --plyr-color-main on the player root. Unlike Vimeo's
    // free-tier player, Plyr always honors a custom accent color since
    // it renders its own UI on top of the iframe.
    accentColor: '#00b3ff',

    // Player behavior
    autoplay: false,
    muted: false,
    loop: false,
    playsinline: true,
    hideControls: false,
    resetOnEnd: false,
    showTitle: true,
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
      hideControls: false,
      resetOnEnd: false,
    },
    'Vimeo overlay': {
      _collapsed: true,
      showTitle: true,
    },
  },

  presets: {
    'Showreel (autoplay, muted, loop)': {
      autoplay: true,
      muted: true,
      loop: true,
      hideControls: true,
      accentColor: '#ffffff',
    },
    'Hero (clean controls)': {
      autoplay: false,
      muted: false,
      loop: false,
      hideControls: false,
      accentColor: '#00b3ff',
    },
    'Background ambient': {
      autoplay: true,
      muted: true,
      loop: true,
      hideControls: true,
      playsinline: true,
      accentColor: '#888888',
    },
  },
};
