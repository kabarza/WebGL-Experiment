import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    speed: 1.0,
    paused: false,

    // Colors (same as reference)
    color1: '#16254b',
    color2: '#23418a',
    color3: '#aadfd9',
    color4: '#e64f0f',

    // Warp / displacement
    warpOn: true,
    warpStrength: 3.34,
    warpScale: 0.5,
    seed: -0.12,

    // Blobs
    blobOn: true,
    blobSize: 0.75,
    blobSpacing: 0.52,
    blobRotation: -0.38,
    blobSpread: 4.52,
    blobOffsetX: -0.77,
    blobOffsetY: -0.21,
    tileSpacing: 4.27,

    // Transform
    zoom: 0.72,
    offsetX: -0.28,
    offsetY: -0.44,

    // Mouse
    mouseOn: true,

    // Grain
    grainOn: true,
    grainAmount: 0.04,
    grainScale: 0.5,
  },

  dialConfig: {
    Colors: {
      color1: '#16254b',
      color2: '#23418a',
      color3: '#aadfd9',
      color4: '#e64f0f',
    },
    Warp: {
      warpOn: true,
      warpStrength: [3.34, 0, 8, 0.01],
      warpScale: [0.5, 0.05, 3, 0.01],
      seed: { type: 'ub-2', default: -0.12, step: 0.01 },
    },
    Blobs: {
      blobOn: true,
      blobSize: [0.75, 0.1, 3, 0.01],
      blobSpacing: [0.52, 0, 2, 0.01],
      blobRotation: [- 0.38, -Math.PI, Math.PI, 0.01],
      blobSpread: [4.52, 0.1, 10, 0.01],
      blobOffsetX: { type: 'ub-2', default: -0.77, step: 0.01 },
      blobOffsetY: { type: 'ub-2', default: -0.21, step: 0.01 },
      tileSpacing: [4.27, 0.5, 10, 0.01],
    },
    Transform: {
      zoom: [0.72, 0.1, 5, 0.01],
      offsetX: { type: 'ub-2', default: -0.28, step: 0.01 },
      offsetY: { type: 'ub-2', default: -0.44, step: 0.01 },
    },
    Mouse: {
      mouseOn: true,
    },
    Grain: {
      grainOn: true,
      grainAmount: [0.04, 0, 0.3, 0.001],
      grainScale: [0.5, 0.05, 5, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
  },

  presets: {
    'Deep Current': {
      color1: '#16254b',
      color2: '#23418a',
      color3: '#aadfd9',
      color4: '#e64f0f',
      warpStrength: 3.34,
      warpScale: 0.5,
      seed: -0.12,
      blobSize: 0.75,
      blobSpacing: 0.52,
      blobRotation: -0.38,
      blobSpread: 4.52,
      blobOffsetX: -0.77,
      blobOffsetY: -0.21,
      tileSpacing: 4.27,
      zoom: 0.72,
      offsetX: -0.28,
      offsetY: -0.44,
      speed: 1.0,
    },
    'Ember Glow': {
      color1: '#1a0a00',
      color2: '#7a2e0e',
      color3: '#e8a84c',
      color4: '#ffe0b2',
      warpStrength: 2.8,
      warpScale: 0.6,
      seed: 0.3,
      blobSize: 0.9,
      blobSpacing: 0.6,
      blobRotation: 0.2,
      blobSpread: 3.8,
      blobOffsetX: -0.5,
      blobOffsetY: -0.1,
      tileSpacing: 3.8,
      zoom: 0.65,
      offsetX: 0.0,
      offsetY: -0.3,
      speed: 0.8,
    },
    'Deep Frost': {
      color1: '#0a0e1a',
      color2: '#1a3a5c',
      color3: '#8ec8e8',
      color4: '#e0f0ff',
      warpStrength: 2.0,
      warpScale: 0.4,
      seed: 0.5,
      blobSize: 1.0,
      blobSpacing: 0.45,
      blobRotation: -0.6,
      blobSpread: 5.0,
      blobOffsetX: -0.3,
      blobOffsetY: 0.1,
      tileSpacing: 5.0,
      zoom: 0.8,
      offsetX: -0.1,
      offsetY: -0.2,
      speed: 0.6,
    },
  },
};
