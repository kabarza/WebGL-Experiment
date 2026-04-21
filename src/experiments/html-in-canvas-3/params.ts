import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    color1: '#0a0612',
    color2: '#2d1b69',
    color3: '#8b5cf6',
    color4: '#f472b6',

    bgOn: true,
    bgScale: 1.0,
    drift: 0.65,
    waveAmount: 0.45,

    textFxOn: true,
    effectMode: 'dither',
    effectMix: 0.8,
    ditherCell: 5,
    chromatic: 0.9,
    textDistortion: 0.3,
    glow: 0.7,
    pixelSize: 4,

    grainOn: true,
    grainAmount: 0.04,
    vignette: 0.2,

    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Aurora: {
      bgOn: true,
      color1: '#0a0612',
      color2: '#2d1b69',
      color3: '#8b5cf6',
      color4: '#f472b6',
      bgScale: [1.0, 0.3, 2.5, 0.01],
      drift: [0.65, 0, 1.6, 0.01],
      waveAmount: [0.45, 0, 1.2, 0.01],
    },
    Effects: {
      textFxOn: true,
      effectMode: {
        type: 'select',
        options: ['clean', 'dither', 'scanline', 'ghost', 'pixelate', 'glitch'],
        default: 'dither',
      },
      effectMix: [0.8, 0, 1, 0.01],
      ditherCell: [5, 2, 20, 0.5],
      pixelSize: [4, 1, 16, 0.5],
      chromatic: [0.9, 0, 3, 0.01],
      textDistortion: [0.3, 0, 1.2, 0.01],
      glow: [0.7, 0, 1.5, 0.01],
    },
    Surface: {
      grainOn: true,
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
  },

  presets: {
    'Neon Editorial': {
      color1: '#0a0612',
      color2: '#2d1b69',
      color3: '#8b5cf6',
      color4: '#f472b6',
      effectMode: 'clean',
      effectMix: 0.55,
      chromatic: 0.35,
      textDistortion: 0.15,
      glow: 0.5,
      grainAmount: 0.03,
      vignette: 0.16,
    },
    'Signal Decay': {
      color1: '#060d12',
      color2: '#0c3a2e',
      color3: '#22d3ee',
      color4: '#facc15',
      effectMode: 'glitch',
      effectMix: 0.92,
      chromatic: 1.8,
      textDistortion: 0.6,
      glow: 0.9,
      drift: 0.9,
      waveAmount: 0.6,
      grainAmount: 0.06,
    },
    'Midnight Dither': {
      color1: '#020617',
      color2: '#1e1b4b',
      color3: '#6366f1',
      color4: '#a78bfa',
      effectMode: 'dither',
      effectMix: 0.85,
      ditherCell: 6,
      chromatic: 0.7,
      textDistortion: 0.25,
      glow: 0.65,
      drift: 0.5,
      waveAmount: 0.35,
      grainAmount: 0.045,
      vignette: 0.25,
    },
  },
};
