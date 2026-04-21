import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#111217',
    speed: 1.0,
    paused: false,

    // Source
    fitMode: 'Fill',

    // Halftone
    numSquares: 60,
    depth: 10,
    sizeByLuma: true,
    fixedRadius: 0.47,
    useSourceColor: true,
    dotColor: '#ffffff',

    // Post
    brightness: 1.0,
    contrast: 1.2,
    postSaturation: 1.0,
  },

  dialConfig: {
    Source: {
      'Upload Asset': { type: 'action' },
      fitMode: {
        type: 'select',
        default: 'Fill',
        options: ['Fill', 'Contain', 'Cover'],
      },
      'Take Snapshot': { type: 'action' },
    },
    Halftone: {
      numSquares: 60,
      depth: [10, 1, 32, 1],
      sizeByLuma: true,
      fixedRadius: [0.47, 0.0, 0.5, 0.01],
      useSourceColor: true,
      dotColor: '#ffffff',
    },
    Colors: {
      bgColor: '#111217',
    },
    Post: {
      brightness: [1.0, 0, 3, 0.01],
      contrast: [1.2, 0, 3, 0.01],
      postSaturation: [1.0, 0, 3, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
  },

  visibility: {
    fixedRadius: { when: 'sizeByLuma', is: false },
    dotColor: { when: 'useSourceColor', is: false },
  },

  presets: {
    'Classic Halftone': {
      numSquares: 80,
      depth: 8,
      sizeByLuma: true,
      useSourceColor: false,
      dotColor: '#ffffff',
      bgColor: '#000000',
      contrast: 1.4,
    },
    'Color Mosaic': {
      numSquares: 40,
      depth: 16,
      sizeByLuma: true,
      useSourceColor: true,
      contrast: 1.1,
    },
    'Uniform Grid': {
      numSquares: 60,
      sizeByLuma: false,
      fixedRadius: 0.47,
      useSourceColor: true,
    },
    'Dense Dots': {
      numSquares: 150,
      depth: 6,
      sizeByLuma: true,
      useSourceColor: true,
      contrast: 1.3,
    },
  },
};
