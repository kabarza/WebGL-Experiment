import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    // Aurora palette — deep indigo / cyan / violet
    color1: '#04080f',
    color2: '#0b2a3a',
    color3: '#0ef5c8',
    color4: '#8b5cf6',

    bgScale: 1.0,
    drift: 0.6,
    waveAmp: 0.55,

    effectMode: 'dither',
    effectMix: 0.85,
    ditherCell: 5,
    chromatic: 1.0,
    glow: 0.72,

    grainAmount: 0.04,
    vignette: 0.28,

    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Aurora: {
      color1: '#04080f',
      color2: '#0b2a3a',
      color3: '#0ef5c8',
      color4: '#8b5cf6',
      bgScale: [1.0, 0.3, 2.5, 0.01],
      drift: [0.6, 0, 1.8, 0.01],
      waveAmp: [0.55, 0, 1.4, 0.01],
    },
    Effects: {
      effectMode: {
        type: 'select',
        options: ['clean', 'dither', 'prism', 'streak'],
        default: 'dither',
      },
      effectMix: [0.85, 0, 1, 0.01],
      ditherCell: [5, 2, 24, 0.5],
      chromatic: [1.0, 0, 4, 0.01],
      glow: [0.72, 0, 2.0, 0.01],
    },
    Surface: {
      grainAmount: [0.04, 0, 0.18, 0.001],
      vignette: [0.28, 0, 0.9, 0.01],
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
    'Aurora Clean': {
      effectMode: 'clean',
      effectMix: 0.6,
      chromatic: 0.3,
      glow: 0.55,
      grainAmount: 0.025,
      vignette: 0.2,
    },
    'Prism Veil': {
      effectMode: 'prism',
      effectMix: 0.92,
      chromatic: 2.8,
      glow: 0.9,
      waveAmp: 0.7,
      drift: 0.9,
      grainAmount: 0.05,
    },
    'Signal Streak': {
      effectMode: 'streak',
      effectMix: 0.88,
      chromatic: 1.8,
      glow: 1.1,
      drift: 1.2,
      waveAmp: 0.65,
      grainAmount: 0.06,
      vignette: 0.35,
    },
    'Midnight Dither': {
      effectMode: 'dither',
      effectMix: 0.95,
      ditherCell: 4,
      chromatic: 1.4,
      glow: 0.8,
      color1: '#020408',
      color2: '#061420',
      color3: '#1af0b0',
      color4: '#a78bfa',
      grainAmount: 0.055,
    },
  },
};
