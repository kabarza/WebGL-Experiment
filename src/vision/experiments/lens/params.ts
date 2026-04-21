import type { ExperimentControls } from '../../../core/Experiment';
import { ACTIVATION_MODES } from '../../core/modes';

export const SHAPES = ['Circle', 'Hexagon', 'Diamond', 'Squircle', 'Star'] as const;
export type ShapeName = (typeof SHAPES)[number];

export const SHAPE_ID: Record<ShapeName, number> = {
  Circle: 0,
  Hexagon: 1,
  Diamond: 2,
  Squircle: 3,
  Star: 4,
};

// activationMode lives in dialConfig but is HIDDEN from the UI via the
// `visibility` rule below. Each preset declares its mode — so switching
// presets through the dropdown doubles as a mode switch. Keeping the value
// in dialConfig (rather than extracting it out) means it flows through
// DialKit's preset snapshot/restore and useExperimentParams sync like
// everything else.

export const controls: ExperimentControls = {
  defaults: {
    // Mode (hidden — driven by preset)
    activationMode: 'DoublePinch',

    // Shape
    shape: 'Circle' as ShapeName,
    sizeMultiplier: 0.7,

    // Distortion inside lens
    distortion: 0.45,
    chromaticAberration: 0.025,

    // Noise warp
    noiseWarp: 0.035,
    noiseScale: 6.0,
    noiseSpeed: 0.4,

    // Rim
    rimWidth: 0.08,
    rimColor: '#80d8ff',
    rimIntensity: 1.1,

    // Inner tint
    innerTint: '#ccf2ff',
    innerTintMix: 0.3,

    // Behavior
    activation: 0.12,
    decay: 0.6,
    clapPulseStrength: 1.0,
    stickyGraceMs: 1500,
    trackingSmoothMs: 140,
    oneHandSizeBase: 1.0,
    oneHandSizeRange: 3.0,

    // Anchor offset (NDC; +X = screen right, +Y = screen up). Default lifts
    // the lens above the thumb.
    offsetX: 0.0,
    offsetY: 0.35,
    offsetScale: 1.0,

    // Double-pinch tuning
    pinchActivate: 0.45,
    pinchRelease: 0.65,
    pinchDebounceMs: 50,
    doublePinchWindowMs: 2000,

    // Middle↔thumb → lens size mapping (DoublePinch mode)
    pinchSizeBase: 0.15,
    pinchSizeRange: 1.4,
  },
  dialConfig: {
    Shape: {
      activationMode: {
        type: 'select',
        options: [...ACTIVATION_MODES],
        default: 'DoublePinch',
      },
      shape: {
        type: 'select',
        options: [...SHAPES],
        default: 'Circle',
      },
      sizeMultiplier: [0.7, 0.1, 2.0, 0.02],
    },
    Anchor: {
      offsetX: [0.0, -1.0, 1.0, 0.01],
      offsetY: [0.35, -1.0, 1.0, 0.01],
      offsetScale: [1.0, 0.0, 2.0, 0.01],
    },
    Distortion: {
      distortion: [0.45, 0.0, 1.5, 0.01],
      chromaticAberration: [0.025, 0.0, 0.1, 0.001],
    },
    Warp: {
      noiseWarp: [0.035, 0.0, 0.2, 0.001],
      noiseScale: [6.0, 1.0, 20.0, 0.1],
      noiseSpeed: [0.4, 0.0, 3.0, 0.01],
    },
    Rim: {
      rimWidth: [0.08, 0.01, 0.3, 0.005],
      rimColor: '#80d8ff',
      rimIntensity: [1.1, 0.0, 3.0, 0.01],
    },
    Inner: {
      innerTint: '#ccf2ff',
      innerTintMix: [0.3, 0.0, 1.0, 0.01],
    },
    Behavior: {
      activation: [0.12, 0.02, 0.6, 0.01],
      decay: [0.6, 0.1, 2.0, 0.01],
      clapPulseStrength: [1.0, 0.0, 2.0, 0.01],
      stickyGraceMs: [1500, 200, 5000, 50],
      trackingSmoothMs: [140, 0, 500, 10],
    },
    'One-Hand Size': {
      oneHandSizeBase: [1.0, 0.0, 3.0, 0.05],
      oneHandSizeRange: [3.0, 0.0, 8.0, 0.1],
    },
    'Double-Pinch': {
      pinchActivate: [0.45, 0.05, 0.9, 0.01],
      pinchRelease: [0.65, 0.1, 1.5, 0.01],
      pinchDebounceMs: [50, 0, 300, 10],
      doublePinchWindowMs: [2000, 150, 3000, 10],
      pinchSizeBase: [0.15, 0.0, 1.0, 0.01],
      pinchSizeRange: [1.4, 0.0, 5.0, 0.05],
    },
  },

  // Hide the activationMode control (the preset dropdown drives it). The
  // `_never` key doesn't exist in params so `lhs === rhs` is always false,
  // which the visibility applier treats as "hide this row".
  visibility: {
    activationMode: { when: '_never', is: true },
  },

  presets: {
    Clap: {
      activationMode: 'Clap',
      shape: 'Circle',
      sizeMultiplier: 0.7,
      distortion: 0.45,
      chromaticAberration: 0.025,
      noiseWarp: 0.035,
      noiseScale: 6.0,
      noiseSpeed: 0.4,
      rimWidth: 0.08,
      rimColor: '#80d8ff',
      rimIntensity: 1.1,
      innerTint: '#ccf2ff',
      innerTintMix: 0.3,
      offsetX: 0.0,
      offsetY: 0.0,
      offsetScale: 1.0,
    },
    DoublePinch: {
      activationMode: 'DoublePinch',
      shape: 'Star',
      sizeMultiplier: 0.9,
      distortion: 0.55,
      chromaticAberration: 0.035,
      noiseWarp: 0.05,
      noiseScale: 7.0,
      noiseSpeed: 0.55,
      rimWidth: 0.1,
      rimColor: '#ff9ecb',
      rimIntensity: 1.4,
      innerTint: '#ffd4ea',
      innerTintMix: 0.45,
      offsetX: 0.0,
      offsetY: 0.35,
      offsetScale: 1.0,
    },
  },
};
