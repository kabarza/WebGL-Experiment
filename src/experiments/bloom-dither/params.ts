import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#12121a',

    branchOn: true,
    branchScale: 1.81,
    branchThickness: 3,
    branchColor: '#555568',

    flowerOn: true,
    flowerSize: 2.62,
    flowerColor: '#6b4faa',
    petalCount: 8,

    glowOn: true,
    glowIntensity: 2.24,
    glowColor: '#b2a8ff',
    glowRadius: 1.42,

    ditherOn: true,
    ditherSize: 5.0,

    playMode: 'Auto Play',
    progress: 0.723,
    animSpeed: 6.5,
    loop: true,

    seed: 55.3,

    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Background: {
      bgColor: '#12121a',
    },
    Branches: {
      branchOn: true,
      branchScale: [1.81, 0.3, 3.0, 0.01],
      branchThickness: [3, 0.1, 3.0, 0.01],
      branchColor: '#555568',
    },
    Flowers: {
      flowerOn: true,
      flowerSize: [2.62, 0.1, 3.0, 0.01],
      flowerColor: '#6b4faa',
      petalCount: [8, 3, 8, 1],
    },
    Glow: {
      glowOn: true,
      glowIntensity: [2.24, 0, 5, 0.01],
      glowColor: '#b2a8ff',
      glowRadius: [1.42, 0.1, 3.0, 0.01],
    },
    Dither: {
      ditherOn: true,
      ditherSize: [5.0, 2.0, 15.0, 0.5],
    },
    Playback: {
      playMode: {
        type: 'select',
        options: ['Manual', 'Auto Play'],
        default: 'Auto Play',
      },
      progress: [0.723, 0, 1, 0.001],
      animSpeed: [6.5, 1.0, 30.0, 0.5],
      loop: true,
    },
    Seed: {
      seed: { type: 'ub-2', default: 55.3, step: 0.1 },
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
  },

  visibility: {
    progress: { when: 'playMode', is: 'Manual' },
    animSpeed: { when: 'playMode', is: 'Auto Play' },
    loop: { when: 'playMode', is: 'Auto Play' },
  },

  presets: {
    'Night Garden': {
      bgColor: '#12121a',
      branchColor: '#555568',
      flowerColor: '#6b4faa',
      glowColor: '#b2a8ff',
      glowIntensity: 2.24,
      ditherSize: 5.0,
      seed: 55.3,
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
