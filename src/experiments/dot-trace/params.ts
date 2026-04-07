import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#0a0a0f',
    speed: 1.0,
    paused: false,

    // Dots
    dotsOn: true,
    dotSize: 0.85,
    dotSpacing: 6,
    dotSoftness: 0.3,
    gridAngle: 0,
    luminanceGamma: 1.2,

    // Colors
    accent1: '#6432c8',
    accent2: '#9060d0',
    neutral: '#606080',
    colorThreshold: 0.15,
    colorMix: 1.0,

    // Source
    fitMode: 'Fill',

    // Playback / Reveal
    playMode: 'Auto Play',
    progress: 0,
    playSpeed: 0.12,
    looping: true,
    revealMode: 'Radial',
    revealOriginX: 0.5,
    revealOriginY: 0.5,
    revealSpread: 0.05,
    revealReverse: false,

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
    Playback: {
      playMode: {
        type: 'select',
        default: 'Auto Play',
        options: ['Manual', 'Auto Play'],
      },
      progress: [0, 0, 1, 0.001],
      playSpeed: [0.12, 0.01, 1, 0.01],
      looping: true,
    },
    Reveal: {
      revealMode: {
        type: 'select',
        default: 'Radial',
        options: ['Radial', 'Sweep Right', 'Sweep Down', 'Random', 'Spiral'],
      },
      revealOriginX: [0.5, 0, 1, 0.01],
      revealOriginY: [0.5, 0, 1, 0.01],
      revealSpread: [0.05, 0.001, 0.3, 0.001],
      revealReverse: false,
    },
    Dither: {
      dotsOn: true,
      dotSize: [0.85, 0.05, 1.0, 0.01],
      dotSpacing: [6, 2, 24, 0.5],
      dotSoftness: [0.3, 0, 1, 0.01],
      gridAngle: [0, 0, 90, 1],
      luminanceGamma: [1.2, 0.2, 4, 0.01],
    },
    Colors: {
      bgColor: '#0a0a0f',
      accent1: '#6432c8',
      accent2: '#9060d0',
      neutral: '#606080',
      colorThreshold: [0.15, 0, 1, 0.01],
      colorMix: [1.0, 0, 2, 0.01],
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
    'Violet Bloom': {
      accent1: '#6432c8',
      accent2: '#9060d0',
      neutral: '#606080',
      bgColor: '#0a0a0f',
      revealMode: 'Radial',
      dotSpacing: 6,
      dotSize: 0.85,
    },
    'Sakura Sweep': {
      accent1: '#e04080',
      accent2: '#ff6090',
      neutral: '#505050',
      bgColor: '#0d0a0c',
      revealMode: 'Sweep Right',
      dotSpacing: 5,
      dotSize: 0.8,
      playSpeed: 0.08,
    },
    'Scatter Dust': {
      accent1: '#3040b0',
      accent2: '#6080e0',
      neutral: '#404060',
      bgColor: '#050510',
      revealMode: 'Random',
      revealSpread: 0.01,
      dotSpacing: 4,
      dotSize: 0.75,
    },
  },
};
