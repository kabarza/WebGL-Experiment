import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#0a0a0f',
    text: '2048',
    fontSize: 280,
    fontWeight: '900',
    fontFamily: 'sans-serif',
    textBlur: 2,
    textGlow: true,
    glowIntensity: 0.6,
    glowSize: 40,

    // Dither
    ditherMode: 'halftone',
    cellSize: 6,
    softness: 0.3,
    gridAngle: 0,
    gamma: 1.2,
    invert: false,

    // Palette
    color1: '#c83264',
    color2: '#6432c8',
    colorMix: 1.0,

    // Wave
    waveOn: false,
    waveAmplitude: 8,
    waveFrequency: 3,

    // Animation
    animOn: true,
    animSpeed: 0.5,
    animIntensity: 0.3,

    // Effects
    chromaticOn: false,
    chromaticOffset: 1.0,
    vignetteOn: true,
    vignetteStrength: 0.4,
    vignetteSize: 0.9,
    grainOn: true,
    grainAmount: 0.03,

    // Post
    brightness: 1.0,
    contrast: 1.2,

    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Text: {
      'Edit Text': { type: 'action' },
      fontSize: [280, 50, 500, 1],
      fontWeight: {
        type: 'select',
        options: ['400', '600', '700', '900'],
        default: '900',
      },
      fontFamily: {
        type: 'select',
        options: ['sans-serif', 'serif', 'monospace'],
        default: 'sans-serif',
      },
      textBlur: [2, 0, 20, 0.5],
      textGlow: true,
      glowIntensity: [0.6, 0, 1, 0.01],
      glowSize: [40, 0, 100, 1],
    },
    Dither: {
      ditherMode: {
        type: 'select',
        options: ['halftone', 'ordered', 'noise', 'crosshatch', 'scanline'],
        default: 'halftone',
      },
      cellSize: [6, 2, 24, 0.5],
      softness: [0.3, 0, 1, 0.01],
      gridAngle: [0, 0, 90, 1],
      gamma: [1.2, 0.2, 4, 0.01],
      invert: false,
    },
    Palette: {
      bgColor: '#0a0a0f',
      color1: '#c83264',
      color2: '#6432c8',
      colorMix: [1.0, 0, 2, 0.01],
    },
    Wave: {
      waveOn: false,
      waveAmplitude: [8, 0, 30, 0.5],
      waveFrequency: [3, 0.5, 10, 0.1],
    },
    Animation: {
      animOn: true,
      animSpeed: [0.5, 0, 3, 0.01],
      animIntensity: [0.3, 0, 1, 0.01],
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
    Effects: {
      chromaticOn: false,
      chromaticOffset: [1.0, 0.1, 5, 0.1],
      vignetteOn: true,
      vignetteStrength: [0.4, 0, 1, 0.01],
      vignetteSize: [0.9, 0.3, 2, 0.01],
      grainOn: true,
      grainAmount: [0.03, 0, 0.2, 0.001],
    },
    Post: {
      brightness: [1.0, 0, 3, 0.01],
      contrast: [1.2, 0, 3, 0.01],
    },
  },

  visibility: {
    glowIntensity: { when: 'textGlow', is: true },
    glowSize: { when: 'textGlow', is: true },
    waveAmplitude: { when: 'waveOn', is: true },
    waveFrequency: { when: 'waveOn', is: true },
    chromaticOffset: { when: 'chromaticOn', is: true },
  },

  presets: {
    'Neon Matrix': {
      ditherMode: 'ordered',
      color1: '#00ff88',
      color2: '#0066ff',
      bgColor: '#050510',
      cellSize: 4,
      chromaticOn: true,
      chromaticOffset: 1.5,
      textGlow: true,
      glowIntensity: 0.8,
      glowSize: 50,
      textBlur: 3,
      brightness: 1.3,
      contrast: 1.4,
    },
    'Ink Sketch': {
      ditherMode: 'crosshatch',
      color1: '#e0e0e0',
      color2: '#808080',
      bgColor: '#0c0c0c',
      cellSize: 8,
      textGlow: false,
      textBlur: 1,
      vignetteStrength: 0.3,
      grainAmount: 0.02,
      animIntensity: 0.1,
    },
    'CRT Terminal': {
      ditherMode: 'scanline',
      color1: '#33ff33',
      color2: '#ffaa00',
      bgColor: '#0a0a05',
      cellSize: 4,
      vignetteStrength: 0.6,
      vignetteSize: 0.7,
      grainOn: true,
      grainAmount: 0.05,
      textGlow: true,
      glowIntensity: 0.5,
      glowSize: 20,
      textBlur: 1,
      contrast: 1.4,
    },
    'Noise Dissolve': {
      ditherMode: 'noise',
      color1: '#ff6040',
      color2: '#ffcc20',
      bgColor: '#08060a',
      cellSize: 3,
      textGlow: true,
      glowIntensity: 0.7,
      glowSize: 60,
      textBlur: 4,
      animOn: true,
      animSpeed: 1.5,
      animIntensity: 0.6,
      waveOn: true,
      waveAmplitude: 5,
      waveFrequency: 2,
    },
  },
};
