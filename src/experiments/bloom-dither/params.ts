import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#12121a',

    branchOn: true,
    branchScale: 1.0,
    branchThickness: 1.0,
    branchColor: '#555568',

    flowerOn: true,
    flowerSize: 1.0,
    flowerColor: '#6b4faa',
    petalCount: 5,

    glowOn: true,
    glowIntensity: 1.2,
    glowColor: '#aaddff',
    glowRadius: 1.0,

    ditherOn: true,
    ditherSize: 5.0,

    progress: 1.0,
    seed: 42.0,

    autoPlay: false,
    animSpeed: 0.15,
    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Background: {
      bgColor: '#12121a',
    },
    Branches: {
      branchOn: true,
      branchScale: [1.0, 0.3, 3.0, 0.01],
      branchThickness: [1.0, 0.1, 3.0, 0.01],
      branchColor: '#555568',
    },
    Flowers: {
      flowerOn: true,
      flowerSize: [1.0, 0.1, 3.0, 0.01],
      flowerColor: '#6b4faa',
      petalCount: [5, 3, 8, 1],
    },
    Glow: {
      glowOn: true,
      glowIntensity: [1.2, 0, 5, 0.01],
      glowColor: '#aaddff',
      glowRadius: [1.0, 0.1, 3.0, 0.01],
    },
    Dither: {
      ditherOn: true,
      ditherSize: [5.0, 2.0, 15.0, 0.5],
    },
    Animation: {
      progress: [1.0, 0, 1, 0.001],
      autoPlay: false,
      animSpeed: [0.15, 0.01, 1.0, 0.01],
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
    Seed: {
      seed: { type: 'ub-2', default: 42.0, step: 0.1 },
    },
  },

  presets: {
    'Night Garden': {
      bgColor: '#12121a',
      branchColor: '#555568',
      flowerColor: '#6b4faa',
      glowColor: '#aaddff',
      glowIntensity: 1.2,
      ditherSize: 5.0,
      seed: 42.0,
    },
    'Cherry Blush': {
      bgColor: '#1a1015',
      branchColor: '#6b5555',
      flowerColor: '#cc5588',
      glowColor: '#ffddee',
      glowIntensity: 1.5,
      ditherSize: 4.0,
      seed: 17.3,
    },
    'Frost Bloom': {
      bgColor: '#0a1520',
      branchColor: '#445566',
      flowerColor: '#4488bb',
      glowColor: '#ccffff',
      glowIntensity: 2.0,
      ditherSize: 6.0,
      seed: 73.1,
    },
  },
};
