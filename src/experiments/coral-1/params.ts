import type { ExperimentControls } from '../../core/Experiment.ts';
import {
  sharedRenderDefaults,
  sharedRenderConfig,
  sharedVisibility,
} from '../../brand/PatternEngineBase.ts';
import type { ThemePreset } from '../../brand/types.ts';

const THEME_NAMES = ['Custom', 'Mono Dark', 'Paper', 'Lavender', 'Ember', 'Blueprint', 'Moss'];

export const controls: ExperimentControls = {
  defaults: {
    feed: 0.0545,
    kill: 0.062,
    dU: 1.0,
    dV: 0.5,
    dt: 1.0,
    stepsPerFrame: 12,

    mapMode: 'None',
    mapFeed: 0.01,
    mapKill: 0.004,
    mapScale: 1,
    mapAngle: 0,
    mapDrift: 0,

    anisotropy: 0,
    flowAngle: 0,

    ...sharedRenderDefaults,
  },

  // Folder order = priority in the panel. Engine stays last and open.
  dialConfig: {
    Reaction: {
      // Ranges are clamped to the band where Gray-Scott actually produces
      // patterns — outside it the field dies or saturates instantly.
      feed: [0.0545, 0.01, 0.1, 0.0001],
      kill: [0.062, 0.04, 0.072, 0.0001],
      dU: [1.0, 0.4, 1.0, 0.01],
      dV: [0.5, 0.15, 0.6, 0.01],
      dt: [1.0, 0.5, 1.2, 0.01],
      stepsPerFrame: [12, 1, 40, 1],
      'Reset Reaction': { type: 'action' },
    },
    Render: sharedRenderConfig.Render,
    Image: sharedRenderConfig.Image,
    Variation: {
      mapMode: { type: 'select', options: ['None', 'Radial', 'Rotate', 'Swirl', 'Bubble', 'Ring', 'Sweep', 'Noise'], default: 'None' },
      mapFeed: [0.01, -0.03, 0.03, 0.0005],
      mapKill: [0.004, -0.02, 0.02, 0.0005],
      mapScale: [1, 0.1, 4, 0.01],
      mapAngle: [0, 0, 360, 1],
      mapDrift: [0, 0, 2, 0.01],
    },
    Direction: {
      anisotropy: [0, 0, 1, 0.01],
      flowAngle: [0, 0, 360, 1],
    },
    Colour: {
      ...sharedRenderConfig.Colour,
      theme: { type: 'select', options: THEME_NAMES, default: 'Custom' },
    },
    Brush: sharedRenderConfig.Brush,
    Engine: {
      _collapsed: false,
      ...sharedRenderConfig.Engine,
    },
  },

  visibility: {
    ...sharedVisibility,
    mapFeed: { when: 'mapMode', is: 'None', op: 'neq' },
    mapKill: { when: 'mapMode', is: 'None', op: 'neq' },
    mapScale: { when: 'mapMode', is: 'None', op: 'neq' },
    mapAngle: { when: 'mapMode', is: 'None', op: 'neq' },
    mapDrift: { when: 'mapMode', is: 'None', op: 'neq' },
    flowAngle: { when: 'anisotropy', is: 0, op: 'gt' },
  },

  presets: {
    'Coral': {
      feed: 0.0545, kill: 0.062, renderMode: 'Flat', threshold: 0.3, softness: 0.04,
      mapMode: 'None', anisotropy: 0,
      bgColor: '#0b0b0d', fgColor: '#f2efe8', accentMix: 0,
    },
    'Ink Lines': {
      feed: 0.034, kill: 0.0595, renderMode: 'Outline', threshold: 0.3, lineWidth: 0.05, softness: 0.03,
      mapMode: 'None', anisotropy: 0.15, flowAngle: 90,
      bgColor: '#0f0f10', fgColor: '#ffffff', accentMix: 0,
    },
    'Embossed Lab': {
      feed: 0.058, kill: 0.0625, renderMode: 'Emboss', threshold: 0.32, softness: 0.12,
      embossHeight: 0.9, lightAngle: 120, mapMode: 'None',
      bgColor: '#e8e8ee', fgColor: '#16163a', accentColor: '#3c4fd8', accentMix: 0.55,
    },
    'Mitosis': {
      feed: 0.0367, kill: 0.0649, renderMode: 'Flat', threshold: 0.28, softness: 0.05,
      mapMode: 'None', bgColor: '#0b0b0d', fgColor: '#f2efe8',
    },
    'Worms': {
      feed: 0.078, kill: 0.061, renderMode: 'Flat', threshold: 0.25, softness: 0.05,
      mapMode: 'None', bgColor: '#f4f1ea', fgColor: '#15151a',
    },
    'Labyrinth': {
      feed: 0.029, kill: 0.057, renderMode: 'Flat', threshold: 0.3, softness: 0.04,
      mapMode: 'None', bgColor: '#0b0b0d', fgColor: '#f2efe8',
    },
    'Solitons': {
      feed: 0.03, kill: 0.062, renderMode: 'Flat', threshold: 0.3, softness: 0.06,
      mapMode: 'None', bgColor: '#0e0b1a', fgColor: '#e9dcff', accentColor: '#7b4cc0', accentMix: 0.5,
    },
    'Pattern Atlas': {
      feed: 0.046, kill: 0.06, mapMode: 'Radial', mapFeed: 0.022, mapKill: 0.004, mapScale: 1.1,
      renderMode: 'Flat', threshold: 0.3, softness: 0.04,
      bgColor: '#0b0b0d', fgColor: '#f2efe8',
    },
    'Swirl Field': {
      feed: 0.04, kill: 0.06, mapMode: 'Swirl', mapFeed: 0.016, mapKill: 0.003, mapScale: 0.8, mapDrift: 0.3,
      renderMode: 'Gradient', accentColor: '#ff4d1c', fgColor: '#ffb173', bgColor: '#140b08', accentMix: 0.6,
    },
  },
};

export const themes: ThemePreset[] = [
  { name: 'Mono Dark', values: { bgColor: '#0b0b0d', fgColor: '#f2efe8', accentColor: '#f2efe8', accentMix: 0 } },
  { name: 'Paper', values: { bgColor: '#f4f1ea', fgColor: '#15151a', accentColor: '#15151a', accentMix: 0 } },
  { name: 'Lavender', values: { bgColor: '#0e0b1a', fgColor: '#e9dcff', accentColor: '#7b4cc0', accentMix: 0.5 } },
  { name: 'Ember', values: { bgColor: '#140b08', fgColor: '#ffb173', accentColor: '#ff4d1c', accentMix: 0.6 } },
  { name: 'Blueprint', values: { bgColor: '#0a1a3a', fgColor: '#dfe9ff', accentColor: '#4f7cff', accentMix: 0.4 } },
  { name: 'Moss', values: { bgColor: '#0d1410', fgColor: '#d8f0c8', accentColor: '#3f8f52', accentMix: 0.5 } },
];
