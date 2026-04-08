import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#0a0a0f',
    speed: 1.0,
    paused: false,

    // Source
    fitMode: 'Fill',

    // Playback & Reveal
    playMode: 'Auto Play',
    progress: 0,
    playSpeed: 0.12,
    looping: true,
    originX: 0.5,
    originY: 1.0,
    popDuration: 0.03,
    bloomOvershoot: 1.5,

    // Post
    brightness: 1.0,
    contrast: 1.2,
    postSaturation: 1.1,
  },

  dialConfig: {
    Source: {
      'UploadSVG': { type: 'action' },
      fitMode: {
        type: 'select',
        default: 'Fill',
        options: ['Fill', 'Contain', 'Cover'],
      },
      'Take Snapshot': { type: 'action' },
    },
    'Playback & Reveal': {
      playMode: {
        type: 'select',
        default: 'Auto Play',
        options: ['Manual', 'Auto Play'],
      },
      progress: [0, 0, 1, 0.001],
      playSpeed: [0.12, 0.01, 1, 0.01],
      looping: true,
      originX: [0.5, 0, 1, 0.01],
      originY: [1.0, 0, 1, 0.01],
      popDuration: [0.03, 0.005, 0.15, 0.001],
      bloomOvershoot: [1.5, 0, 3, 0.1],
    },
    Colors: {
      bgColor: '#0a0a0f',
    },
    Post: {
      brightness: [1.0, 0, 3, 0.01],
      contrast: [1.2, 0, 3, 0.01],
      postSaturation: [1.1, 0, 3, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
  },

  visibility: {
    progress: { when: 'playMode', is: 'Manual' },
    playSpeed: { when: 'playMode', is: 'Auto Play' },
    looping: { when: 'playMode', is: 'Auto Play' },
  },

  presets: {
    'Slow Bloom': {
      playSpeed: 0.06,
      originX: 0.5,
      originY: 1.0,
      popDuration: 0.05,
      bloomOvershoot: 2.0,
    },
    'Quick Draw': {
      playSpeed: 0.25,
      originX: 0.5,
      originY: 0.5,
      popDuration: 0.02,
      bloomOvershoot: 1.0,
    },
  },
};
