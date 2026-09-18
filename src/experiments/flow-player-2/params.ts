import type { ExperimentControls } from '../../core/Experiment.ts';

// Same defaults as flow-player so swapping between the two
// experiments doesn't change the test footage. Vimeo URL is the
// Pro test video; YouTube URL is Big Buck Bunny on Blender's
// channel.
const DEFAULT_VIMEO_URL = 'https://vimeo.com/804853787';
const DEFAULT_YOUTUBE_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const DEFAULT_POSTER_URL = 'https://media.w3.org/2010/05/sintel/poster.png';

// What ships in the dial vs. what lives directly on the Webflow nodes:
//
//   Surfaced in the dial — these become attributes/text on the slot
//   so designers can edit per-instance in the Webflow Designer:
//     videoUrl, posterUrl, accentColor, trackColor, bufferColor,
//     autoplay, muted, loop, playsinline, skipSeconds
//
//   NOT in the dial — these are CSS on .fp-* classes, edited in the
//   Webflow Style panel: bar height, button size, radius, paddings,
//   background, blur. Tokens default to a clean dark scheme that the
//   designer can retheme by overriding CSS variables on .fp-wrapper.

export const controls: ExperimentControls = {
  defaults: {
    paused: false,
    speed: 1.0,

    videoUrl: DEFAULT_VIMEO_URL,
    posterUrl: DEFAULT_POSTER_URL,

    accentColor: '#00b3ff',
    trackColor: '#ffffff',
    bufferColor: '#9aa0a6',

    autoplay: false,
    muted: false,
    loop: false,
    playsinline: true,
    skipSeconds: 10,
  },

  dialConfig: {
    Source: {
      _collapsed: false,
      videoUrl: { type: 'text', default: DEFAULT_VIMEO_URL },
      posterUrl: { type: 'text', default: DEFAULT_POSTER_URL },
    },
    Style: {
      _collapsed: false,
      accentColor: '#00b3ff',
      trackColor: '#ffffff',
      bufferColor: '#9aa0a6',
    },
    Behavior: {
      _collapsed: false,
      autoplay: false,
      muted: false,
      loop: false,
      playsinline: true,
      skipSeconds: [10, 1, 60, 1],
    },
  },

  // No "Defaults" version — the dial's version selector shows
  // exactly two curated states the user can flip between.
  skipDefaultsVersion: true,
  presets: {
    Vimeo: {
      videoUrl: DEFAULT_VIMEO_URL,
    },
    YouTube: {
      videoUrl: DEFAULT_YOUTUBE_URL,
      accentColor: '#ff0000',
    },
  },
};
