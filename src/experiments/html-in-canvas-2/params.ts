import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    color1: '#08131d',
    color2: '#0f6b78',
    color3: '#92f1c4',
    color4: '#ff7a59',
    bgScale: 1.0,
    drift: 0.72,
    waveAmount: 0.42,

    effectMode: 'dither',
    effectMix: 0.82,
    ditherCell: 6,
    chromatic: 0.85,
    textDistortion: 0.36,
    glow: 0.78,

    grainAmount: 0.045,
    vignette: 0.22,

    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Aurora: {
      color1: '#08131d',
      color2: '#0f6b78',
      color3: '#92f1c4',
      color4: '#ff7a59',
      bgScale: [1.0, 0.4, 2.2, 0.01],
      drift: [0.72, 0, 1.6, 0.01],
      waveAmount: [0.42, 0, 1.2, 0.01],
    },
    Effects: {
      effectMode: {
        type: 'select',
        options: ['clean', 'dither', 'scanline', 'ghost'],
        default: 'dither',
      },
      effectMix: [0.82, 0, 1, 0.01],
      ditherCell: [6, 2, 20, 0.5],
      chromatic: [0.85, 0, 3, 0.01],
      textDistortion: [0.36, 0, 1.2, 0.01],
      glow: [0.78, 0, 1.5, 0.01],
    },
    Surface: {
      grainAmount: [0.045, 0, 0.16, 0.001],
      vignette: [0.22, 0, 0.8, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 4, 0.01],
      paused: false,
    },
  },

  visibility: {
    ditherCell: { when: 'effectMode', is: 'dither' },
  },

  presets: {
    'Editorial Drift': {
      effectMode: 'clean',
      effectMix: 0.58,
      chromatic: 0.35,
      textDistortion: 0.18,
      glow: 0.5,
      grainAmount: 0.03,
      vignette: 0.16,
    },
    'Signal Bloom': {
      effectMode: 'scanline',
      effectMix: 0.9,
      chromatic: 1.2,
      textDistortion: 0.5,
      glow: 0.95,
      waveAmount: 0.56,
      grainAmount: 0.055,
    },
    'Broken Proof': {
      effectMode: 'ghost',
      effectMix: 0.88,
      chromatic: 1.6,
      textDistortion: 0.74,
      glow: 1.05,
      drift: 1.0,
      waveAmount: 0.68,
    },
  },
};
