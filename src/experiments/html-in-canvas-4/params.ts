import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    color1: '#0a0f1e',
    color2: '#1a3a6e',
    color3: '#7be0c4',
    color4: '#f26d4f',
    bgScale: 1.0,
    drift: 0.65,
    waveAmount: 0.48,

    effectMode: 'dither',
    effectMix: 0.85,
    ditherCell: 5,
    chromatic: 0.7,
    textDistortion: 0.3,
    glow: 0.7,
    pixelSize: 8,
    glitchIntensity: 0.6,

    grainAmount: 0.04,
    vignette: 0.2,

    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Aurora: {
      color1: '#0a0f1e',
      color2: '#1a3a6e',
      color3: '#7be0c4',
      color4: '#f26d4f',
      bgScale: [1.0, 0.3, 2.5, 0.01],
      drift: [0.65, 0, 1.6, 0.01],
      waveAmount: [0.48, 0, 1.2, 0.01],
    },
    Effects: {
      effectMode: {
        type: 'select',
        options: ['clean', 'dither', 'scanline', 'ghost', 'pixelate', 'glitch'],
        default: 'dither',
      },
      effectMix: [0.85, 0, 1, 0.01],
      ditherCell: [5, 2, 20, 0.5],
      chromatic: [0.7, 0, 3, 0.01],
      textDistortion: [0.3, 0, 1.2, 0.01],
      glow: [0.7, 0, 1.5, 0.01],
      pixelSize: [8, 2, 32, 1],
      glitchIntensity: [0.6, 0, 2, 0.01],
    },
    Surface: {
      grainAmount: [0.04, 0, 0.16, 0.001],
      vignette: [0.2, 0, 0.8, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 4, 0.01],
      paused: false,
    },
  },

  visibility: {
    ditherCell: { when: 'effectMode', is: 'dither' },
    pixelSize: { when: 'effectMode', is: 'pixelate' },
    glitchIntensity: { when: 'effectMode', is: 'glitch' },
  },

  presets: {
    'Midnight Dither': {
      color1: '#0a0f1e',
      color2: '#1a3a6e',
      color3: '#7be0c4',
      color4: '#f26d4f',
      effectMode: 'dither',
      effectMix: 0.85,
      ditherCell: 5,
      chromatic: 0.7,
      textDistortion: 0.3,
      glow: 0.7,
      grainAmount: 0.04,
      vignette: 0.2,
    },
    'Signal Decay': {
      color1: '#060a12',
      color2: '#2d1854',
      color3: '#e08bf7',
      color4: '#ff6b35',
      effectMode: 'glitch',
      effectMix: 0.9,
      glitchIntensity: 0.85,
      chromatic: 1.4,
      textDistortion: 0.6,
      glow: 0.9,
      drift: 0.9,
      waveAmount: 0.6,
      grainAmount: 0.06,
    },
    'Clean Editorial': {
      color1: '#0d1117',
      color2: '#1b3a4b',
      color3: '#a6e3d8',
      color4: '#f8f0e3',
      effectMode: 'clean',
      effectMix: 0.5,
      chromatic: 0.2,
      textDistortion: 0.1,
      glow: 0.45,
      grainAmount: 0.025,
      vignette: 0.15,
    },
  },
};
