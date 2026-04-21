import type { ExperimentControls } from '../../core/Experiment.ts';

export const MOUSE_MODES = ['Breeze', 'Swell', 'Tide', 'Parallax', 'Shimmer'] as const;
export type MouseMode = typeof MOUSE_MODES[number];

export const MOUSE_MODE_ID: Record<MouseMode, number> = {
  Breeze: 0,
  Swell: 1,
  Tide: 2,
  Parallax: 3,
  Shimmer: 4,
};

// The defaults below are the "Version 1" look in DialKit's version dropdown —
// presets in the `presets:` block offer named alternative palettes/moods.
// Never duplicate defaults as a named preset (DialKit would show two identical entries).
export const controls: ExperimentControls = {
  defaults: {
    speed: 1.0,
    paused: false,

    // Colors — "Harbor Dusk" feel: muted indigo, teal, mint, dusty rose
    color1: '#0c1a2e',
    color2: '#2d5b72',
    color3: '#a7e0cf',
    color4: '#e8a0b4',
    bgColor: '#040812',
    colorShift: 0.0,

    // Warp / displacement
    warpOn: true,
    warpStrength: 1.6,
    warpScale: 0.55,
    warpOctaves: 3,
    seed: 0.42,
    seedSpeed: 0.06,

    // Blobs
    blobOn: true,
    blobCount: 5,
    blobSize: 1.05,
    blobSpacing: 0.62,
    blobRotation: -0.3,
    blobSpread: 4.9,
    blobOffsetX: -0.35,
    blobOffsetY: -0.2,
    tileSpacing: 4.8,
    blendSoftness: 1.5,
    autoRotation: 0.008,

    // Transform
    zoom: 0.88,
    offsetX: -0.05,
    offsetY: -0.25,

    // Mouse — Swell by default: intensifies warp around cursor, no displacement
    mouseOn: true,
    mouseMode: 'Swell' as MouseMode,
    mouseStrength: 0.9,
    mouseRadius: 1.1,
    mouseWindDecay: 0.92,
    mouseWindGain: 3.0,

    // Click pulse (shockwave)
    pulseStrength: 0.45,
    pulseDecay: 1.4,
    pulseSpeed: 1.6,
    pulseWidth: 0.12,

    // Grain
    grainOn: true,
    grainAmount: 0.04,
    grainScale: 0.5,
    grainSpeed: 24.0,
  },

  dialConfig: {
    Colors: {
      color1: '#0c1a2e',
      color2: '#2d5b72',
      color3: '#a7e0cf',
      color4: '#e8a0b4',
      bgColor: '#040812',
      colorShift: [0.0, 0, 1, 0.001],
    },
    Warp: {
      warpOn: true,
      warpStrength: [1.6, 0, 8, 0.01],
      warpScale: [0.55, 0.05, 3, 0.01],
      warpOctaves: [3, 1, 6, 1],
      seed: { type: 'ub-2', default: 0.42, step: 0.01 },
      seedSpeed: [0.06, 0, 1, 0.001],
    },
    Blobs: {
      blobOn: true,
      blobCount: [5, 2, 6, 1],
      blobSize: [1.05, 0.1, 3, 0.01],
      blobSpacing: [0.62, 0, 2, 0.01],
      blendSoftness: [1.5, 0.05, 3, 0.01],
      blobRotation: [-0.3, -Math.PI, Math.PI, 0.01],
      autoRotation: [0.008, -0.5, 0.5, 0.001],
      blobSpread: [4.9, 0.1, 10, 0.01],
      blobOffsetX: { type: 'ub-2', default: -0.35, step: 0.01 },
      blobOffsetY: { type: 'ub-2', default: -0.2, step: 0.01 },
      tileSpacing: [4.8, 0.5, 10, 0.01],
    },
    Transform: {
      zoom: [0.88, 0.1, 5, 0.01],
      offsetX: { type: 'ub-2', default: -0.05, step: 0.01 },
      offsetY: { type: 'ub-2', default: -0.25, step: 0.01 },
    },
    Mouse: {
      mouseOn: true,
      mouseMode: {
        type: 'select',
        options: [...MOUSE_MODES],
        default: 'Swell',
      },
      mouseStrength: [0.9, 0, 3, 0.01],
      mouseRadius: [1.1, 0.2, 3, 0.01],
      mouseWindDecay: [0.92, 0.7, 0.995, 0.001],
      mouseWindGain: [3.0, 0, 10, 0.1],
    },
    Click: {
      pulseStrength: [0.45, 0, 2, 0.01],
      pulseDecay: [1.4, 0.2, 4, 0.01],
      pulseSpeed: [1.6, 0.2, 6, 0.01],
      pulseWidth: [0.12, 0.02, 0.5, 0.01],
    },
    Grain: {
      grainOn: true,
      grainAmount: [0.04, 0, 0.3, 0.001],
      grainScale: [0.5, 0.05, 5, 0.01],
      grainSpeed: [24, 0, 120, 0.1],
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
  },

  visibility: {
    mouseWindDecay: { when: 'mouseMode', is: 'Breeze' },
    mouseWindGain: { when: 'mouseMode', is: 'Breeze' },
  },

  // ── Presets — named palettes. All use Swell by default; adjust in the panel.
  // "Version 1" in the DialKit dropdown is the defaults (Harbor Dusk feel).
  presets: {
    'Boreal Green': {
      color1: '#062137', color2: '#0f6b5a', color3: '#8be6bf', color4: '#c47bcf',
      bgColor: '#02070f', colorShift: 0.0,
      warpStrength: 1.8, warpScale: 0.5, warpOctaves: 3, seed: 0.1, seedSpeed: 0.07,
      blobCount: 4, blobSize: 1.0, blobSpacing: 0.55, blendSoftness: 1.3,
      blobRotation: -0.25, autoRotation: 0.005, blobSpread: 5.0,
      blobOffsetX: -0.4, blobOffsetY: -0.15, tileSpacing: 4.6,
      zoom: 0.85, offsetX: -0.1, offsetY: -0.3, speed: 0.9,
      mouseMode: 'Swell', mouseStrength: 0.9, mouseRadius: 1.2,
    },
    'Arctic Glacier': {
      color1: '#0a1220', color2: '#1e3e5c', color3: '#8ec8e8', color4: '#dfeef9',
      bgColor: '#03070e', colorShift: 0.02,
      warpStrength: 1.5, warpScale: 0.45, warpOctaves: 3, seed: 0.5, seedSpeed: 0.05,
      blobCount: 4, blobSize: 1.15, blobSpacing: 0.52, blendSoftness: 1.7,
      blobRotation: -0.4, autoRotation: -0.01, blobSpread: 5.2,
      blobOffsetX: -0.2, blobOffsetY: 0.05, tileSpacing: 5.2,
      zoom: 0.82, offsetX: -0.05, offsetY: -0.2, speed: 0.7,
      mouseMode: 'Swell', mouseStrength: 0.7, mouseRadius: 1.3,
    },
    'Peach Blossom': {
      color1: '#1a0f24', color2: '#6b3c5e', color3: '#f4b8a4', color4: '#fde4b0',
      bgColor: '#0a0610', colorShift: 0.03,
      warpStrength: 1.7, warpScale: 0.55, warpOctaves: 3, seed: -0.2, seedSpeed: 0.08,
      blobCount: 5, blobSize: 1.0, blobSpacing: 0.6, blendSoftness: 1.4,
      blobRotation: 0.15, autoRotation: 0.012, blobSpread: 4.5,
      blobOffsetX: -0.25, blobOffsetY: -0.2, tileSpacing: 4.5,
      zoom: 0.8, offsetX: 0.0, offsetY: -0.25, speed: 0.9,
      mouseMode: 'Swell', mouseStrength: 0.9, mouseRadius: 1.1,
    },
    'Ember Glow': {
      color1: '#1a0a00', color2: '#7a2e0e', color3: '#e8a84c', color4: '#ffe0b2',
      bgColor: '#0a0500', colorShift: 0.0,
      warpStrength: 1.9, warpScale: 0.6, warpOctaves: 3, seed: 0.3, seedSpeed: 0.08,
      blobCount: 5, blobSize: 0.95, blobSpacing: 0.6, blendSoftness: 1.5,
      blobRotation: 0.2, autoRotation: 0.015, blobSpread: 4.2,
      blobOffsetX: -0.4, blobOffsetY: -0.1, tileSpacing: 4.0,
      zoom: 0.78, offsetX: 0.0, offsetY: -0.3, speed: 0.85,
      mouseMode: 'Swell', mouseStrength: 1.0, mouseRadius: 1.1,
    },
    'Mint Lilac': {
      color1: '#0b1418', color2: '#234a44', color3: '#b8ecd4', color4: '#dcc6ff',
      bgColor: '#040a0c', colorShift: 0.01,
      warpStrength: 1.6, warpScale: 0.5, warpOctaves: 3, seed: 0.25, seedSpeed: 0.06,
      blobCount: 4, blobSize: 1.1, blobSpacing: 0.58, blendSoftness: 1.55,
      blobRotation: -0.2, autoRotation: 0.007, blobSpread: 5.0,
      blobOffsetX: -0.3, blobOffsetY: -0.1, tileSpacing: 5.0,
      zoom: 0.85, offsetX: -0.08, offsetY: -0.22, speed: 0.85,
      mouseMode: 'Swell', mouseStrength: 0.85, mouseRadius: 1.1,
    },
    'Orchid Spark': {
      color1: '#140824', color2: '#3e1e5c', color3: '#b789d6', color4: '#7adbe6',
      bgColor: '#07040e', colorShift: 0.04,
      warpStrength: 1.8, warpScale: 0.55, warpOctaves: 4, seed: -0.1, seedSpeed: 0.07,
      blobCount: 5, blobSize: 1.0, blobSpacing: 0.6, blendSoftness: 1.45,
      blobRotation: 0.1, autoRotation: 0.01, blobSpread: 4.6,
      blobOffsetX: -0.3, blobOffsetY: -0.2, tileSpacing: 4.5,
      zoom: 0.82, offsetX: -0.05, offsetY: -0.28, speed: 1.0,
      mouseMode: 'Swell', mouseStrength: 0.95, mouseRadius: 1.1,
    },
    'Tide Pool': {
      color1: '#04202a', color2: '#0f586b', color3: '#7dd3c0', color4: '#e0c896',
      bgColor: '#020a10', colorShift: 0.02,
      warpStrength: 1.7, warpScale: 0.5, warpOctaves: 3, seed: 0.6, seedSpeed: 0.06,
      blobCount: 4, blobSize: 1.1, blobSpacing: 0.55, blendSoftness: 1.5,
      blobRotation: -0.35, autoRotation: -0.005, blobSpread: 5.3,
      blobOffsetX: -0.3, blobOffsetY: -0.05, tileSpacing: 5.0,
      zoom: 0.82, offsetX: -0.05, offsetY: -0.2, speed: 0.8,
      mouseMode: 'Swell', mouseStrength: 1.0, mouseRadius: 1.2,
    },
    'Rose Copper': {
      color1: '#1f0812', color2: '#782440', color3: '#e08058', color4: '#f4d090',
      bgColor: '#0b040a', colorShift: 0.0,
      warpStrength: 2.0, warpScale: 0.6, warpOctaves: 4, seed: -0.25, seedSpeed: 0.09,
      blobCount: 5, blobSize: 0.95, blobSpacing: 0.55, blendSoftness: 1.35,
      blobRotation: 0.25, autoRotation: 0.018, blobSpread: 4.0,
      blobOffsetX: -0.45, blobOffsetY: -0.1, tileSpacing: 4.0,
      zoom: 0.75, offsetX: 0.0, offsetY: -0.28, speed: 1.05,
      mouseMode: 'Swell', mouseStrength: 1.1, mouseRadius: 1.0,
    },
    'Velvet Rose': {
      color1: '#0a0514', color2: '#3a1a3c', color3: '#b86a8e', color4: '#d8c2d8',
      bgColor: '#030108', colorShift: 0.0,
      warpStrength: 1.55, warpScale: 0.48, warpOctaves: 3, seed: 0.15, seedSpeed: 0.05,
      blobCount: 4, blobSize: 1.1, blobSpacing: 0.58, blendSoftness: 1.6,
      blobRotation: -0.15, autoRotation: 0.005, blobSpread: 5.2,
      blobOffsetX: -0.3, blobOffsetY: -0.15, tileSpacing: 5.0,
      zoom: 0.86, offsetX: -0.08, offsetY: -0.22, speed: 0.75,
      mouseMode: 'Swell', mouseStrength: 0.8, mouseRadius: 1.1,
    },
    'Amber Glass': {
      color1: '#1a1208', color2: '#4a3820', color3: '#d8b070', color4: '#f4e4c8',
      bgColor: '#0a0805', colorShift: 0.0,
      warpStrength: 1.5, warpScale: 0.5, warpOctaves: 3, seed: 0.4, seedSpeed: 0.05,
      blobCount: 4, blobSize: 1.1, blobSpacing: 0.6, blendSoftness: 1.6,
      blobRotation: -0.5, autoRotation: -0.008, blobSpread: 5.5,
      blobOffsetX: -0.25, blobOffsetY: -0.05, tileSpacing: 5.5,
      zoom: 0.85, offsetX: -0.08, offsetY: -0.22, speed: 0.7,
      mouseMode: 'Swell', mouseStrength: 0.8, mouseRadius: 1.2,
    },
    'Nebula Drift': {
      color1: '#180a38', color2: '#5a2284', color3: '#60cce4', color4: '#f0b860',
      bgColor: '#05020e', colorShift: 0.06,
      warpStrength: 1.9, warpScale: 0.6, warpOctaves: 4, seed: -0.4, seedSpeed: 0.1,
      blobCount: 6, blobSize: 0.9, blobSpacing: 0.52, blendSoftness: 1.25,
      blobRotation: 0.3, autoRotation: 0.02, blobSpread: 4.1,
      blobOffsetX: 0.0, blobOffsetY: 0.0, tileSpacing: 3.9,
      zoom: 0.72, offsetX: 0.0, offsetY: -0.2, speed: 1.1,
      mouseMode: 'Swell', mouseStrength: 1.0, mouseRadius: 1.1,
    },
  },
};
