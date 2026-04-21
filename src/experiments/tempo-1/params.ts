import type { ExperimentControls, VisibilityRule } from '../../core/Experiment.ts';

const MAX_FLARES = 8;

function flareDefaults(index: number) {
  const presets = [
    { x: 0.66, y: 0.52, angle: 1.48, intensity: 1.0, spread: 1.0, softness: 1.0, rainbow: 1.0, glow: 1.0 },
    { x: 0.60, y: 0.70, angle: 1.62, intensity: 0.72, spread: 0.85, softness: 1.2, rainbow: 0.9, glow: 0.8 },
    { x: 0.74, y: 0.58, angle: 1.36, intensity: 0.55, spread: 0.9, softness: 1.1, rainbow: 1.1, glow: 0.55 },
    { x: 0.68, y: 0.44, angle: 1.72, intensity: 0.5, spread: 1.1, softness: 0.9, rainbow: 0.75, glow: 0.5 },
    { x: 0.79, y: 0.66, angle: 1.28, intensity: 0.44, spread: 0.76, softness: 1.25, rainbow: 1.2, glow: 0.4 },
    { x: 0.58, y: 0.56, angle: 1.82, intensity: 0.4, spread: 1.35, softness: 1.0, rainbow: 0.65, glow: 0.4 },
    { x: 0.72, y: 0.78, angle: 1.5, intensity: 0.34, spread: 0.72, softness: 1.35, rainbow: 1.3, glow: 0.34 },
    { x: 0.84, y: 0.50, angle: 1.22, intensity: 0.28, spread: 0.9, softness: 1.55, rainbow: 0.8, glow: 0.3 },
  ] as const;
  return presets[index - 1];
}

const flareDefaultsMap = Object.fromEntries(
  Array.from({ length: MAX_FLARES }, (_, i) => {
    const idx = i + 1;
    const d = flareDefaults(idx);
    return [idx, {
      [`flare${idx}On`]: idx <= 2,
      [`flare${idx}X`]: d.x,
      [`flare${idx}Y`]: d.y,
      [`flare${idx}Angle`]: d.angle,
      [`flare${idx}Intensity`]: d.intensity,
      [`flare${idx}Spread`]: d.spread,
      [`flare${idx}Softness`]: d.softness,
      [`flare${idx}Rainbow`]: d.rainbow,
      [`flare${idx}Glow`]: d.glow,
    }];
  }),
) as Record<number, Record<string, unknown>>;

const perFlareDialConfig = Object.fromEntries(
  Array.from({ length: MAX_FLARES }, (_, i) => {
    const idx = i + 1;
    const d = flareDefaults(idx);
    return [
      `Flare ${idx}`,
      {
        [`flare${idx}On`]: idx <= 2,
        [`flare${idx}X`]: [d.x, 0, 1, 0.001],
        [`flare${idx}Y`]: [d.y, 0, 1, 0.001],
        [`flare${idx}Angle`]: { type: 'ub-3', default: d.angle, step: 0.01 },
        [`flare${idx}Intensity`]: [d.intensity, 0, 2, 0.01],
        [`flare${idx}Spread`]: [d.spread, 0.2, 2.5, 0.01],
        [`flare${idx}Softness`]: [d.softness, 0.25, 3, 0.01],
        [`flare${idx}Rainbow`]: [d.rainbow, 0, 2, 0.01],
        [`flare${idx}Glow`]: [d.glow, 0, 2, 0.01],
      },
    ];
  }),
) as Record<string, Record<string, unknown>>;

const perFlareVisibility: Record<string, VisibilityRule> = Object.fromEntries(
  Array.from({ length: MAX_FLARES - 1 }, (_, i) => {
    const idx = i + 2;
    const keys = [
      `flare${idx}On`,
      `flare${idx}X`,
      `flare${idx}Y`,
      `flare${idx}Angle`,
      `flare${idx}Intensity`,
      `flare${idx}Spread`,
      `flare${idx}Softness`,
      `flare${idx}Rainbow`,
      `flare${idx}Glow`,
    ];
    return keys.map((key) => [key, { when: 'flareCount', op: 'gte', is: idx }]);
  }).flat(),
) as Record<string, VisibilityRule>;

export const controls: ExperimentControls = {
  defaults: {
    // Background
    bgColor: '#16171c',

    // Aurora Gradient
    auroraOn: true,
    auroraScale: 1.05,
    auroraSpeed: 0.04,
    auroraWarp: 1.6,
    auroraIntensity: 0.62,
    auroraBlend: 0.66,
    auroraOffsetX: 0.0,
    auroraOffsetY: 0.0,

    // Aurora Colors — saturated enough to read on dark bg
    color1: '#8a5b72', // warm rose/magenta
    color2: '#3f3358', // deep violet
    color3: '#553325', // warm amber

    // Particle Ring — top-left, half cropped by edges
    ringOn: true,
    ringX: 0.11,
    ringY: 0.74,
    ringRadius: 0.34,
    ringEdge: 1.15,
    ringOpacity: 0.46,

    // Dots (gl.POINTS point sprites)
    dotCount: 120,
    dotSize: 4.0,
    dotBlink: true,
    dotRotate: false,
    dotSpeed: 0.24,

    // Lens Flare
    flareOn: true,
    flareIntensity: 0.12,
    flareSpread: 0.62,
    flareSoftness: 2.8,
    flareRainbow: 0.38,
    flareCount: 2,
    flareAngle: 1.42,
    flareGlow: 0.26,
    ...flareDefaultsMap[1],
    ...flareDefaultsMap[2],
    ...flareDefaultsMap[3],
    ...flareDefaultsMap[4],
    ...flareDefaultsMap[5],
    ...flareDefaultsMap[6],
    ...flareDefaultsMap[7],
    ...flareDefaultsMap[8],

    // Film Grain — single layer, no duplication
    grainOn: true,
    grainAmount: 0.028,
    grainSize: 1.7,
    grainSpeed: 24,

    // Post Processing
    brightness: 0.96,
    contrast: 1.18,
    saturation: 0.9,
    vignette: 0.42,

    // Animation
    speed: 1.0,
    paused: false,
  },

  dialConfig: {
    Colors: {
      bgColor: '#16171c',
      color1: '#8a5b72',
      color2: '#3f3358',
      color3: '#553325',
    },
    Aurora: {
      auroraOn: true,
      auroraScale: [1.05, 0.1, 5, 0.01],
      auroraSpeed: [0.04, 0, 0.5, 0.001],
      auroraWarp: [1.6, 0, 4, 0.01],
      auroraIntensity: [0.62, 0, 1, 0.01],
      auroraBlend: [0.66, 0, 1, 0.01],
      auroraOffsetX: { type: 'ub-2', default: 0.0, step: 0.01 },
      auroraOffsetY: { type: 'ub-2', default: 0.0, step: 0.01 },
    },
    'Particle Ring': {
      ringOn: true,
      ringX: { type: 'ub-2', default: 0.11, step: 0.01 },
      ringY: { type: 'ub-2', default: 0.74, step: 0.01 },
      ringRadius: [0.34, 0.01, 1, 0.01],
      ringEdge: [1.15, 0.01, 2, 0.01],
      ringOpacity: [0.46, 0, 1, 0.01],
      dotCount: [120, 50, 300, 1],
      dotSize: [4.0, 1.0, 16.0, 0.5],
      dotBlink: true,
      dotRotate: false,
      dotSpeed: [0.24, 0, 2, 0.01],
    },
    'Lens Flare': {
      flareOn: true,
      flareIntensity: [0.12, 0, 1, 0.01],
      flareSpread: [0.62, 0.1, 5, 0.01],
      flareSoftness: [2.8, 0.5, 8, 0.1],
      flareRainbow: [0.38, 0, 1, 0.01],
      flareCount: [2, 1, MAX_FLARES, 1],
      flareAngle: { type: 'ub-3', default: 1.42, step: 0.01 },
      flareGlow: [0.26, 0, 1, 0.01],
      'Add Flare': { type: 'action' },
      'Remove Flare': { type: 'action' },
    },
    ...perFlareDialConfig,
    'Film Grain': {
      grainOn: true,
      grainAmount: [0.028, 0, 0.3, 0.001],
      grainSize: [1.7, 0.5, 5, 0.1],
      grainSpeed: [24, 0, 60, 0.5],
    },
    Post: {
      brightness: [0.96, 0, 3, 0.01],
      contrast: [1.18, 0, 3, 0.01],
      saturation: [0.9, 0, 3, 0.01],
      vignette: [0.42, 0, 1, 0.01],
    },
    Animation: {
      speed: [1.0, 0, 5, 0.01],
      paused: false,
    },
  },

  visibility: {
    ...perFlareVisibility,
  },

  presets: {
    Midnight: {
      bgColor: '#050308',
      color1: '#6b2845',
      color2: '#1e1250',
      color3: '#2a1505',
      auroraScale: 1.2,
      auroraSpeed: 0.06,
      auroraWarp: 1.4,
      auroraIntensity: 0.7,
      auroraBlend: 0.55,
      flareIntensity: 0.07,
      flareSpread: 0.4,
      flareSoftness: 2.0,
      flareRainbow: 0.2,
      flareGlow: 0.15,
      brightness: 1.0,
      contrast: 1.1,
      saturation: 1.15,
      vignette: 0.3,
    },
    'Golden Hour': {
      bgColor: '#0a0500',
      color1: '#4a2a0a',
      color2: '#8c5a1c',
      color3: '#3a1a08',
      auroraScale: 1.8,
      auroraSpeed: 0.04,
      auroraWarp: 1.5,
      auroraIntensity: 0.65,
      auroraBlend: 0.7,
      flareIntensity: 0.08,
      flareSpread: 0.5,
      flareSoftness: 2.5,
      flareRainbow: 0.3,
      flareGlow: 0.2,
      brightness: 1.1,
      contrast: 1.2,
      saturation: 1.3,
      vignette: 0.4,
    },
    'Deep Space': {
      bgColor: '#030510',
      color1: '#0d1a40',
      color2: '#1a3a5c',
      color3: '#0a2030',
      auroraScale: 2.0,
      auroraSpeed: 0.03,
      auroraWarp: 0.8,
      auroraIntensity: 0.45,
      auroraBlend: 0.5,
      ringOpacity: 0.3,
      dotBlink: true,
      dotSpeed: 0.1,
      flareIntensity: 0.03,
      flareSpread: 0.3,
      flareSoftness: 3.0,
      flareRainbow: 0.15,
      brightness: 1.0,
      contrast: 1.0,
      saturation: 0.9,
      vignette: 0.5,
    },
  },
};
