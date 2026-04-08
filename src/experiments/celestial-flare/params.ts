import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#00040f',

    waveOn: true,
    noiseScale: 2.93,
    noiseSpeed: 0.517,
    noiseOctaves: 3,
    warpStrength: 1.85,
    warpScale: 0.48,
    warpSpeed: 0.113,
    waveIntensity: 0.25,

    color1: '#000000',
    color2: '#593e03',
    color3: '#09a2aa',
    blendWidth: 1.73,
    colorShift: 1.99,

    circleOn: true,
    circleX: 0.5,
    circleY: 1.17,
    circleRadius: 0.45,
    circleEdge: 1,
    circleDensity: 1.7,
    circleParticleSize: 0.55,
    circleSpeed: 0.44,
    circleOpacity: 0.61,
    circleTrail: 0.5,
    circleTwinkle: 0.7,

    flareOn: true,
    flareIntensity: 0.63,
    flareSpread: 0.78,
    flareLength: 0.83,
    flareRainbow: 0.37,
    flareCount: 3,
    flareSpeed: 0,
    flareAngle: 15.54,

    grainOn: true,
    grainAmount: 0.041,
    grainSize: 2,
    grainSpeed: 33.5,
    grainVariation: 0.3,

    brightness: 3,
    contrast: 1.37,
    saturation: 1.09,

    speed: 1.83,
    paused: false,
  },

  dialConfig: {
    Background: {
      bgColor: '#00040f',
    },
    'Wave Gradient': {
      waveOn: true,
      noiseScale: [2.93, 0.01, 5, 0.01],
      noiseSpeed: [0.517, 0, 1, 0.001],
      noiseOctaves: [3, 1, 6, 1],
      warpStrength: [1.85, 0, 3, 0.01],
      warpScale: [0.48, 0.01, 3, 0.01],
      warpSpeed: [0.113, 0, 0.5, 0.001],
      waveIntensity: [0.25, 0, 1, 0.01],
    },
    Colors: {
      color1: '#000000',
      color2: '#593e03',
      color3: '#09a2aa',
      blendWidth: [1.73, 0, 2, 0.01],
      colorShift: [1.99, 0, 3, 0.01],
    },
    Circle: {
      circleOn: true,
      circleX: { type: 'ub-2', default: 0.5, step: 0.01 },
      circleY: { type: 'ub-2', default: 1.17, step: 0.01 },
      circleRadius: [0.45, 0.01, 1, 0.01],
      circleEdge: [1, 0.01, 1, 0.01],
      circleDensity: [1.7, 1, 20, 0.1],
      circleParticleSize: [0.55, 0.01, 1, 0.01],
      circleSpeed: [0.44, 0, 2, 0.01],
      circleOpacity: [0.61, 0, 1, 0.01],
      circleTrail: [0.5, 0, 1, 0.01],
      circleTwinkle: [0.7, 0, 1, 0.01],
    },
    'Lens Flares': {
      flareOn: true,
      flareIntensity: [0.63, 0, 1, 0.01],
      flareSpread: [0.78, 0.1, 5, 0.01],
      flareLength: [0.83, 0.1, 3, 0.01],
      flareRainbow: [0.37, 0, 1, 0.01],
      flareCount: [3, 1, 8, 1],
      flareSpeed: [0, 0, 3, 0.01],
      flareAngle: { type: 'ub-3', default: 15.54, step: 0.01 },
    },
    'Film Grain': {
      grainOn: true,
      grainAmount: [0.041, 0, 0.5, 0.001],
      grainSize: [2, 0.5, 5, 0.1],
      grainSpeed: [33.5, 0, 60, 0.5],
      grainVariation: [0.3, 0, 1, 0.01],
    },
    Post: {
      brightness: [3, 0, 3, 0.01],
      contrast: [1.37, 0, 3, 0.01],
      saturation: [1.09, 0, 3, 0.01],
    },
    Animation: {
      speed: [1.83, 0, 5, 0.01],
      paused: false,
    },
  },

  presets: {
    'Deep Space': {
      color1: '#1a1a5e', color2: '#2b1a4e', color3: '#0d3b66',
      bgColor: '#050510', waveIntensity: 0.6,
      flareRainbow: 0.9, saturation: 1.5,
    },
    'Golden Hour': {
      color1: '#8c5a1c', color2: '#cc7722', color3: '#6b3a1a',
      bgColor: '#0a0500', waveIntensity: 0.8,
      flareRainbow: 0.3, flareIntensity: 0.4,
    },
    'Neon Dreams': {
      color1: '#6b2fa0', color2: '#e04080', color3: '#2060c0',
      bgColor: '#050008', waveIntensity: 0.9,
      saturation: 1.8, brightness: 1.2, flareRainbow: 1.0,
    },
  },
};
