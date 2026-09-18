import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    // Animation (consumed by the render loop)
    paused: false,
    speed: 1.0,

    // Look
    bg: '#0d0d10',
    accent: '#e2402f',

    // Physics
    gravity: 1.0,
    launchPower: 1.0,
    maxStretch: 280,
    restitution: 0.5,
    airDrag: 0.05,

    // Trajectory
    showTrajectory: true,
    dotSpacing: 0.035,
    dotFade: 0.12,
    dotSize: 3.4,

    // Destruction
    knockLabels: true,
    letterRestore: 4.0,
    groundSmoke: true,
    smokeAmount: 1.0,
    screenShake: true,
    squash: true,
    ripples: true,
    trail: true,
    bounceEdges: false,
    boom: false,

    // Sound
    sound: true,
    volume: 0.7,
  },

  dialConfig: {
    Look: {
      bg: '#0d0d10',
      accent: '#e2402f',
    },
    Physics: {
      gravity: [1.0, 0, 3, 0.01],
      launchPower: [1.0, 0.2, 3, 0.01],
      maxStretch: [280, 80, 600, 1],
      restitution: [0.5, 0, 0.95, 0.01],
      airDrag: [0.05, 0, 0.6, 0.01],
    },
    Trajectory: {
      showTrajectory: true,
      dotSpacing: [0.035, 0.01, 0.12, 0.001],
      dotFade: [0.12, 0, 1, 0.01],
      dotSize: [3.4, 1, 8, 0.1],
    },
    Destruction: {
      knockLabels: true,
      letterRestore: [4.0, 0, 12, 0.1],
      groundSmoke: true,
      smokeAmount: [1.0, 0, 3, 0.05],
      screenShake: true,
      squash: true,
      ripples: true,
      trail: true,
      'Bounce Off Edges': false,
      boom: false,
    },
    Sound: {
      sound: true,
      volume: [0.7, 0, 1, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 3, 0.01],
      paused: false,
    },
    Actions: {
      'Knock All Labels': { type: 'action' },
      'Bring Letters Back': { type: 'action' },
    },
  },

  presets: {
    Default: {},
    'Moon Gravity': {
      gravity: 0.35,
      restitution: 0.68,
      airDrag: 0.02,
      launchPower: 1.1,
    },
    'Heavy Iron': {
      gravity: 1.9,
      launchPower: 1.35,
      restitution: 0.18,
      smokeAmount: 1.8,
      maxStretch: 340,
    },
    'Rubber Kingdom': {
      gravity: 0.8,
      restitution: 0.85,
      launchPower: 1.2,
      'Bounce Off Edges': true,
    },
    'Silent Film': {
      sound: false,
      dotFade: 0.5,
    },
  },
};
