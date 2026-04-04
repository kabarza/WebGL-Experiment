import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#0a0a0a',
    speed: 1.0,
    paused: false,
    // Add experiment-specific defaults here
  },

  dialConfig: {
    Background: {
      bgColor: '#0a0a0a',
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
    // Add experiment-specific control groups here
  },

  presets: {},
};
