import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    speed: 0.6,
    paused: false,

    // ── Aurora Layer ──
    auroraOn: true,
    auroraOpacity: 1.0,
    color1: '#1a1040',
    color2: '#3a1a4a',
    color3: '#452030',
    color4: '#100808',
    warpStrength: 1.8,
    warpScale: 0.5,
    warpSpeed: 0.1,
    blobSize: 0.85,
    blobSpacing: 0.52,
    blobRotation: -0.38,
    blobSpread: 3.5,
    blobOffsetX: -0.8,
    blobOffsetY: 0.4,
    tileSpacing: 5.0,
    zoom: 0.6,
    auroraOffsetX: -0.3,
    auroraOffsetY: 0.25,

    // ── Image Layer ──
    imageOn: true,
    imageOpacity: 1.0,
    imageScale: 1.0,
    imageOffsetX: 0.0,
    imageOffsetY: 0.0,

    // ── Circle Layer ──
    circleOn: true,
    circleX: 0.25,
    circleY: 0.5,
    circleRadius: 0.35,
    circleEdge: 0.6,
    circleDensity: 2.5,
    circleParticleSize: 0.5,
    circleSpeed: 0.3,
    circleOpacity: 0.7,
    circleTrail: 0.0,
    circleTwinkle: 0.5,
    circleColor: '#d9d5cc',
    circleGlow: 0.2,

    // ── Film Grain ──
    grainOn: true,
    grainAmount: 0.08,
    grainSize: 1.5,
    grainSpeed: 24.0,

    // ── Layer Order (0 = bottom, 3 = top) ──
    auroraOrder: 0,
    imageOrder: 1,
    circleOrder: 2,
    grainOrder: 3,

    // ── Post ──
    bgColor: '#060410',
    brightness: 1.3,
    contrast: 1.2,
    saturation: 0.9,
  },

  dialConfig: {
    Aurora: {
      auroraOn: true,
      auroraOpacity: [1.0, 0, 1, 0.01],
      Colors: {
        _collapsed: true,
        color1: '#1a1040',
        color2: '#3a1a4a',
        color3: '#452030',
        color4: '#100808',
      },
      warpStrength: [1.8, 0, 5, 0.01],
      warpScale: [0.5, 0.05, 3, 0.01],
      warpSpeed: [0.1, 0, 0.5, 0.001],
      blobSize: [0.85, 0.1, 3, 0.01],
      blobSpacing: [0.52, 0, 2, 0.01],
      blobRotation: [-0.38, -Math.PI, Math.PI, 0.01],
      blobSpread: [3.5, 0.1, 10, 0.01],
      Position: {
        _collapsed: true,
        blobOffsetX: { type: 'ub-2', default: -0.8, step: 0.01 },
        blobOffsetY: { type: 'ub-2', default: 0.4, step: 0.01 },
        tileSpacing: [5.0, 0.5, 10, 0.01],
        zoom: [0.6, 0.1, 5, 0.01],
        auroraOffsetX: { type: 'ub-2', default: -0.3, step: 0.01 },
        auroraOffsetY: { type: 'ub-2', default: 0.25, step: 0.01 },
      },
    },
    Image: {
      imageOn: true,
      imageOpacity: [1.0, 0, 1, 0.01],
      imageScale: [1.0, 0.1, 5, 0.01],
      imageOffsetX: { type: 'ub-2', default: 0.0, step: 0.01 },
      imageOffsetY: { type: 'ub-2', default: 0.0, step: 0.01 },
      'Upload Image': { type: 'action' },
      'Remove Image': { type: 'action' },
    },
    Circle: {
      circleOn: true,
      circleOpacity: [0.7, 0, 1, 0.01],
      circleColor: '#d9d5cc',
      circleX: { type: 'ub-2', default: 0.25, step: 0.01 },
      circleY: { type: 'ub-2', default: 0.5, step: 0.01 },
      circleRadius: [0.35, 0.01, 1.5, 0.01],
      circleEdge: [0.6, 0.01, 2, 0.01],
      circleGlow: [0.2, 0, 1, 0.01],
      circleDensity: [2.5, 0.5, 12, 0.1],
      circleParticleSize: [0.5, 0.05, 2, 0.01],
      circleTrail: [0.0, 0, 1, 0.01],
      circleSpeed: [0.3, 0, 2, 0.01],
      circleTwinkle: [0.5, 0, 1, 0.01],
    },
    'Film Grain': {
      grainOn: true,
      grainAmount: [0.08, 0, 0.3, 0.001],
      grainSize: [1.5, 0.5, 5, 0.1],
      grainSpeed: [24.0, 0, 60, 0.5],
    },
    'Layer Order': {
      _collapsed: true,
      auroraOrder: [0, 0, 3, 1],
      imageOrder: [1, 0, 3, 1],
      circleOrder: [2, 0, 3, 1],
      grainOrder: [3, 0, 3, 1],
    },
    Post: {
      _collapsed: true,
      bgColor: '#060410',
      brightness: [1.3, 0, 3, 0.01],
      contrast: [1.2, 0, 3, 0.01],
      saturation: [0.9, 0, 3, 0.01],
    },
    Animation: {
      speed: [0.6, 0, 5, 0.01],
      paused: false,
    },
  },

  layerOrder: [
    { id: 'aurora', label: 'Aurora', color: '#3a1a4a', orderKey: 'auroraOrder' },
    { id: 'image', label: 'Image', color: '#666666', orderKey: 'imageOrder' },
    { id: 'circle', label: 'Circle', color: '#d9d5cc', orderKey: 'circleOrder' },
    { id: 'grain', label: 'Grain', color: '#555555', orderKey: 'grainOrder' },
  ],

  presets: {
    'Analog Dusk': {
      color1: '#1a1040', color2: '#3a1a4a', color3: '#452030', color4: '#100808',
      bgColor: '#060410', auroraOpacity: 1.0,
      warpStrength: 1.8, warpSpeed: 0.1, zoom: 0.6,
      circleX: 0.25, circleY: 0.5, circleOpacity: 0.7, circleGlow: 0.2,
      grainAmount: 0.08, brightness: 1.3, saturation: 0.9,
    },
    'Cold Void': {
      color1: '#0a0820', color2: '#181540', color3: '#201838', color4: '#060810',
      bgColor: '#030308', auroraOpacity: 0.85,
      warpStrength: 1.2, warpSpeed: 0.06, zoom: 0.5,
      circleColor: '#a0b0c0', circleOpacity: 0.5, circleGlow: 0.15,
      grainAmount: 0.06, brightness: 1.1, saturation: 0.6,
    },
    'Warm Film': {
      color1: '#201008', color2: '#3a1a10', color3: '#4a2820', color4: '#180808',
      bgColor: '#080404', auroraOpacity: 1.0,
      warpStrength: 2.2, warpSpeed: 0.08, zoom: 0.65,
      circleColor: '#e8c8a0', circleOpacity: 0.6, circleGlow: 0.25,
      grainAmount: 0.1, brightness: 1.4, saturation: 0.75, contrast: 1.3,
    },
  },
};
