import type { ExperimentControls } from '../../core/Experiment.ts';

export const controls: ExperimentControls = {
  defaults: {
    speed: 1.0,
    paused: false,

    // ── Base Gradient (Flare Layer) ──
    baseOn: true,
    baseOpacity: 1.0,
    baseWarpStrength: 2.0,
    baseWarpSpeed: 0.08,
    baseNoiseScale: 1.8,
    baseColorTemp: 0.25,
    baseFalloff: 1.1,
    baseBrightness: 1.4,

    // ── Aurora Noise Layer ──
    auroraOn: true,
    auroraOpacity: 0.15,
    auroraSpeed: 0.06,
    auroraScale: 1.2,
    auroraWarp: 0.4,
    auroraSaturation: 0.3,

    // ── Particle Ring ──
    ringOn: true,
    ringOpacity: 0.25,
    ringX: 0.2,
    ringY: 0.55,
    ringRadius: 0.2,
    ringEdgeWidth: 0.012,
    ringDensity: 8.0,
    ringParticleSize: 0.5,
    ringMode: 0.0,
    ringSpeed: 0.12,
    ringPulseRate: 2.0,

    // ── Lens Flare / Chromatic Dispersion ──
    flareOn: true,
    flareOpacity: 0.06,
    flareCount: 3,
    flareSpread: 0.6,
    flareLength: 0.5,
    flareDispersion: 0.15,
    flareDesaturation: 0.7,
    flareAngle: 0.8,

    // ── Film Grain ──
    grainOn: true,
    grainIntensity: 0.07,
    grainScale: 1.5,

    // ── Post ──
    brightness: 1.0,
    contrast: 1.15,
    saturation: 0.85,
  },

  dialConfig: {
    'Base Gradient': {
      baseOn: true,
      baseOpacity: [1.0, 0, 1, 0.01],
      baseWarpStrength: [2.0, 0, 4, 0.01],
      baseWarpSpeed: [0.08, 0, 0.5, 0.001],
      baseNoiseScale: [1.8, 0.5, 5, 0.01],
      baseColorTemp: [0.25, 0, 1, 0.01],
      baseFalloff: [1.1, 0.3, 3, 0.01],
      baseBrightness: [1.4, 0, 3, 0.01],
    },
    'Aurora Noise': {
      auroraOn: true,
      auroraOpacity: [0.15, 0, 0.5, 0.01],
      auroraSpeed: [0.06, 0, 0.5, 0.001],
      auroraScale: [1.2, 0.2, 4, 0.01],
      auroraWarp: [0.4, 0, 2, 0.01],
      auroraSaturation: [0.3, 0, 1, 0.01],
    },
    'Particle Ring': {
      ringOn: true,
      ringOpacity: [0.25, 0, 0.8, 0.01],
      ringX: { type: 'ub-2', default: 0.2, step: 0.01 },
      ringY: { type: 'ub-2', default: 0.55, step: 0.01 },
      ringRadius: [0.2, 0.05, 0.6, 0.01],
      ringEdgeWidth: [0.012, 0.002, 0.06, 0.001],
      ringDensity: [8.0, 1, 15, 0.1],
      ringParticleSize: [0.5, 0.1, 1.5, 0.01],
      ringMode: [0.0, 0, 1, 1],
      ringSpeed: [0.12, 0, 1, 0.01],
      ringPulseRate: [2.0, 0.5, 8, 0.1],
    },
    'Lens Flare': {
      flareOn: true,
      flareOpacity: [0.06, 0, 0.3, 0.01],
      flareCount: [3, 1, 6, 1],
      flareSpread: [0.6, 0.1, 3, 0.01],
      flareLength: [0.5, 0.1, 2, 0.01],
      flareDispersion: [0.15, 0, 0.5, 0.01],
      flareDesaturation: [0.7, 0, 1, 0.01],
      flareAngle: { type: 'ub-3', default: 0.8, step: 0.01 },
    },
    'Film Grain': {
      grainOn: true,
      grainIntensity: [0.07, 0, 0.2, 0.001],
      grainScale: [1.5, 0.5, 5, 0.1],
    },
    Post: {
      brightness: [1.0, 0, 2, 0.01],
      contrast: [1.15, 0, 2, 0.01],
      saturation: [0.85, 0, 2, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 3, 0.01],
      paused: false,
    },
  },

  presets: {
    'Analog Dusk': {
      baseWarpStrength: 2.0, baseColorTemp: 0.25,
      baseFalloff: 1.1, baseBrightness: 1.4,
      auroraOpacity: 0.15,
      ringOpacity: 0.25, flareOpacity: 0.06,
      grainIntensity: 0.07, saturation: 0.85,
    },
    'Warm Film': {
      baseColorTemp: 0.7, baseBrightness: 1.6,
      baseFalloff: 0.9, baseWarpStrength: 1.5,
      auroraOpacity: 0.1, auroraSaturation: 0.2,
      flareOpacity: 0.1, flareDispersion: 0.2,
      grainIntensity: 0.09, saturation: 0.7,
      contrast: 1.3,
    },
    'Cold Void': {
      baseColorTemp: 0.0, baseBrightness: 0.8,
      baseFalloff: 1.5, baseWarpStrength: 2.5,
      auroraOpacity: 0.2, auroraSaturation: 0.5,
      ringOpacity: 0.15, flareOpacity: 0.03,
      grainIntensity: 0.05, saturation: 0.6,
      brightness: 0.85,
    },
  },
};
