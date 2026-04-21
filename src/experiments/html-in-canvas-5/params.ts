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

  // Controls provided by lil-gui inside the experiment — empty dialConfig
  // suppresses DialKit's parameter panel.
  dialConfig: {},
};
