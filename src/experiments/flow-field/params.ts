import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#0d0d10',

    noiseScale: 0.40,
    noiseSpeed: 0.04,
    noiseOctaves: 2,

    warpStrength: 0.30,
    warpScale: 0.55,
    warpSpeed: 0.04,
    warpDepth: 2,

    circleRadius: 0.85,
    circleSoftness: 0.35,
    circleCenter: { x: 0.5, y: 0.5 },

    rotation: 0,
    zoom: 1.0,

    color1: '#d4a030',
    color2: '#8c5a1c',
    color3: '#381630',
    color4: '#7b4cc0',
    blendWidth: 0.55,
    colorShift: 0.4,
    saturation: 1.3,
    brightness: 1.0,
    contrast: 1.0,

    highlightStr: 0.25,
    highlightColor: '#d4a0e8',

    grainAmount: 0.10,
    grainScale: 2.0,
    grainSpeed: 12.0,

    mouseStrength: 0.12,
    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Background: {
      bgColor: '#0d0d10',
    },
    'Noise Fill': {
      noiseScale: [0.40, 0.01, 5, 0.01],
      noiseSpeed: [0.04, 0, 1, 0.001],
      noiseOctaves: [2, 1, 6, 1],
    },
    'Flow Field': {
      warpStrength: [0.30, 0, 3, 0.01],
      warpScale: [0.55, 0.01, 3, 0.01],
      warpSpeed: [0.04, 0, 0.5, 0.001],
      warpDepth: [2, 0, 3, 1],
    },
    'Circle Mask': {
      circleRadius: [0.85, 0, 3, 0.01],
      circleSoftness: [0.35, 0, 2, 0.01],
    },
    Camera: {
      rotation: [0, -Math.PI, Math.PI, 0.01],
      zoom: [1.0, 0.1, 5, 0.01],
    },
    Colors: {
      color1: '#d4a030',
      color2: '#8c5a1c',
      color3: '#381630',
      color4: '#7b4cc0',
      blendWidth: [0.55, 0, 2, 0.01],
      colorShift: [0.4, 0, 3, 0.01],
      saturation: [1.3, 0, 3, 0.01],
      brightness: [1.0, 0, 3, 0.01],
      contrast: [1.0, 0, 3, 0.01],
    },
    'Wave Highlights': {
      highlightStr: [0.25, 0, 1, 0.01],
      highlightColor: '#d4a0e8',
    },
    Grain: {
      grainAmount: [0.10, 0, 0.5, 0.001],
      grainScale: [2.0, 0.5, 10, 0.1],
      grainSpeed: [12.0, 0, 60, 0.5],
    },
    Mouse: {
      mouseStrength: [0.12, 0, 1, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
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
