import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#0d0d10',

    noiseScale: 1.44,
    noiseSpeed: 0.037,
    noiseOctaves: 1,

    warpStrength: 1.68,
    warpScale: 0.58,
    warpSpeed: 0.454,
    warpDepth: 2,

    vignetteRadius: 1.24,
    vignetteSoftness: 0.19,
    vignetteRoundness: 100,

    rotation: -0.17,
    zoom: 0.55,

    color1: '#492d7b',
    color2: '#8c5a1c',
    color3: '#381630',
    color4: '#7b4cc0',
    blendWidth: 0.97,
    colorShift: 1.08,
    saturation: 1.32,
    brightness: 1.06,
    contrast: 1.09,

    highlightStr: 0.25,
    highlightColor: '#d4a0e8',

    grainAmount: 0.027,
    grainScale: 10,
    grainSpeed: 60,

    mouseEnabled: false,
    mouseStrength: 0.22,
    mouseRadius: 0.49,
    mouseSoftness: 0.39,
    mouseTrailSmoothing: 0.067,
    mouseTrailStr: 0.53,
    speed: 0.16,
    paused: false,
  },

  dialConfig: {
    Background: {
      bgColor: '#0d0d10',
    },
    'Noise Fill': {
      noiseScale: [1.44, 0.01, 5, 0.01],
      noiseSpeed: [0.037, 0, 1, 0.001],
      noiseOctaves: [1, 1, 6, 1],
    },
    'Flow Field': {
      warpStrength: [1.68, 0, 3, 0.01],
      warpScale: [0.58, 0.01, 3, 0.01],
      warpSpeed: [0.454, 0, 0.5, 0.001],
      warpDepth: [2, 0, 3, 1],
    },
    Vignette: {
      vignetteRadius: [1.24, 0, 2, 0.01],
      vignetteSoftness: [0.19, 0, 1, 0.01],
      vignetteRoundness: [100, 0, 100, 1],
    },
    Camera: {
      rotation: [-0.17, -Math.PI, Math.PI, 0.01],
      zoom: [0.55, 0.1, 5, 0.01],
    },
    Colors: {
      color1: '#492d7b',
      color2: '#8c5a1c',
      color3: '#381630',
      color4: '#7b4cc0',
      blendWidth: [0.97, 0, 2, 0.01],
      colorShift: [1.08, 0, 3, 0.01],
      saturation: [1.32, 0, 3, 0.01],
      brightness: [1.06, 0, 3, 0.01],
      contrast: [1.09, 0, 3, 0.01],
    },
    'Wave Highlights': {
      highlightStr: [0.25, 0, 1, 0.01],
      highlightColor: '#d4a0e8',
    },
    Grain: {
      grainAmount: [0.027, 0, 0.5, 0.001],
      grainScale: [10, 0.5, 10, 0.1],
      grainSpeed: [60, 0, 60, 0.5],
    },
    Mouse: {
      mouseEnabled: false,
      mouseStrength: [0.22, 0, 1, 0.01],
      mouseRadius: [0.49, 0.01, 1.5, 0.01],
      mouseSoftness: [0.39, 0.01, 0.5, 0.01],
      mouseTrailSmoothing: [0.067, 0.001, 0.1, 0.001],
      mouseTrailStr: [0.53, 0, 1, 0.01],
    },
    Animation: {
      speed: [0.16, 0, 5, 0.01],
      paused: false,
    },
    'UI Experiment': {
      'Spring Slider': {
        springA: { type: 'ub-1', default: 25, step: 0.5 },
        springB: { type: 'ub-4', default: 50, step: 1 },
        springC: { type: 'ub-7', default: 0, step: 0.5 },
        springD: { type: 'ub-8', default: 100, step: 1 },
      },
      'Scrub Field': {
        scrubA: { type: 'ub-2', default: 0.5, step: 0.01 },
        scrubB: { type: 'ub-5', default: 10, step: 0.1 },
      },
      'Ring Slider': {
        ringA: { type: 'ub-3', default: 200, step: 1 },
        ringB: { type: 'ub-6', default: 100, step: 1 },
      },
      'Toggle Variants': {
        dialKitDefault: true,
        cleanLiquid:  { type: 'ub-t1', default: false },
        warmAccent:   { type: 'ub-t6', default: true },
        greenAccent:  { type: 'ub-t12', default: false },
        jadeRefined:  { type: 'ub-t11', default: true },
      },
    },
  },

  presets: {
    'Emerald Flow': {
      color1: '#d4a030', color2: '#8c5a1c', color3: '#381630', color4: '#7b4cc0',
      noiseScale: 0.4, warpStrength: 0.3, blendWidth: 0.55,
      highlightStr: 0.25, highlightColor: '#d4a0e8',
    },
    'Deep Ocean': {
      color1: '#0a2463', color2: '#1e6091', color3: '#168aad', color4: '#34a0a4',
      noiseScale: 0.35, warpStrength: 0.45, blendWidth: 0.4,
      highlightStr: 0.15, highlightColor: '#76c893',
      bgColor: '#050a14',
    },
    'Sunset': {
      color1: '#ff6b35', color2: '#f7c59f', color3: '#efefd0', color4: '#004e89',
      noiseScale: 0.5, warpStrength: 0.25, blendWidth: 0.7,
      highlightStr: 0.3, highlightColor: '#ffd700',
      bgColor: '#1a0a00',
    },
    'Monochrome': {
      color1: '#111111', color2: '#444444', color3: '#888888', color4: '#cccccc',
      noiseScale: 0.45, warpStrength: 0.35, blendWidth: 0.5,
      saturation: 0, highlightStr: 0.4, highlightColor: '#ffffff',
      bgColor: '#000000',
    },
  },
};
