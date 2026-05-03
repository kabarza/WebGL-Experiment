import type { ExperimentControls } from '../../core/Experiment.ts';

// Country list shape. The label sits centered below the cross at the
// global `labelOffsetY` distance (configured in the Countries panel).
export type Country = {
  name: string;
  lat: number;
  lon: number;
};
// 26-country layout matching the reference image. Coordinates are
// hand-picked so that under intersection-snap (lonSeg=21, latSeg=19)
// each country lands on a UNIQUE grid intersection — close-together
// values would otherwise collide on the same +. Tiers run roughly:
//   lat 60 → northern cap, 50 → UK/Baltics, 40/30 → central, 20 →
//   southern Europe, 10 → Mediterranean rim, 0 → Iberia, -5 → Italien.
export const DEFAULT_COUNTRIES: Country[] = [
  { name: 'NORWEGEN', lat: 60, lon: 5 },
  { name: 'SCHWEDEN', lat: 60, lon: 20 },
  { name: 'FINNLAND', lat: 60, lon: 37 },
  { name: 'IRLAND', lat: 50, lon: -40 },
  { name: 'ENGLAND', lat: 50, lon: -22 },
  { name: 'NIEDERLANDE', lat: 50, lon: -8 },
  { name: 'ESTLAND', lat: 50, lon: 37 },
  { name: 'BELGIEN', lat: 40, lon: -22 },
  { name: 'DEUTSCHLAND', lat: 40, lon: -8 },
  { name: 'POLEN', lat: 40, lon: 8 },
  { name: 'LETTLAND', lat: 40, lon: 37 },
  { name: 'LUXEMBURG', lat: 30, lon: -8 },
  { name: 'TSCHECHIEN', lat: 30, lon: 8 },
  { name: 'SLOWAKEI', lat: 30, lon: 20 },
  { name: 'LITAUEN', lat: 30, lon: 37 },
  { name: 'FRANKREICH', lat: 20, lon: -22 },
  { name: 'ÖSTERREICH', lat: 20, lon: 8 },
  { name: 'UNGARN', lat: 20, lon: 20 },
  { name: 'RUMÄNIEN', lat: 20, lon: 37 },
  { name: 'SCHWEIZ', lat: 10, lon: -8 },
  { name: 'SLOWENIEN', lat: 10, lon: 8 },
  { name: 'SERBIEN', lat: 10, lon: 20 },
  { name: 'TÜRKEI', lat: 10, lon: 37 },
  { name: 'PORTUGAL', lat: 0, lon: -40 },
  { name: 'SPANIEN', lat: 0, lon: -22 },
  { name: 'ITALIEN', lat: -5, lon: -8 },
];

export const SNAP_MODES = [
  'nearest line',
  'intersection',
  'meridian',
  'parallel',
  'free',
] as const;
export type SnapMode = (typeof SNAP_MODES)[number];

export const SPIN_AXES = ['Y (yaw)', 'X (pitch)', 'Both'] as const;
export type SpinAxis = (typeof SPIN_AXES)[number];

// Default DialKit spring config used for the drag spring-back.
// Resolved at runtime to { type:'spring', stiffness, damping, mass }.
const DEFAULT_DRAG_SPRING = {
  type: 'spring' as const,
  stiffness: 110,
  damping: 18,
  mass: 1,
};

// Spring/easing transition used for the snake's travel curve along
// the path. DialKit's transition control lets the user pick spring
// or cubic-bezier modes; the runtime maps either into a [0..1] curve.
const DEFAULT_SNAKE_EASE = {
  type: 'easing' as const,
  duration: 0.3,
  ease: [0.34, 0.45, 0.5, 1] as [number, number, number, number],
};

export const controls: ExperimentControls = {
  defaults: {
    bgColor: '#000000',
    lineColor: '#5a5a52',
    crossColor: '#ffffff',
    labelColor: '#cfcfcf',
    accentColor: '#ffffff',

    // Globe geometry
    lonSegments: 30,
    latSegments: 30,
    lineOpacity: 0.24,
    lineWidth: 2.0,

    // Layers
    showLines: true,
    showCountries: true,
    showLabels: true,
    showSnake: true,

    // Camera framing
    zoom: 0.84,
    basePitchDeg: 21,
    baseYawDeg: -10,
    fov: 25,

    // Snap behaviour
    snapMode: 'free' as SnapMode,
    crossSize: 0.055,
    crossOnSurface: true,
    labelSize: 10,
    labelOffsetY: 18,

    // Interaction
    dragSensitivity: 0.26,
    dragSpring: DEFAULT_DRAG_SPRING,
    autoSpin: false,
    autoSpinSpeed: 0.15,
    autoSpinAxis: 'Y (yaw)' as SpinAxis,
    pauseSpinOnDrag: true,

    // Snake animation
    // Per-leg duration is `legDistance / snakeSpeed`, clamped to at
    // least `snakeLegMinDuration` so very short legs don't zip past
    // before the eye can register them. Speed is in globe-radius units
    // per second.
    snakeIntervalMin: 0.1,
    snakeIntervalMax: 0.6,
    snakeSpeed: 0.44,
    snakeLegMinDuration: 0.6,
    snakeWidth: 1.0,
    snakeFlashDuration: 2.2,
    snakeIntensity: 0.1,
    snakeEase: DEFAULT_SNAKE_EASE,
    // When true, a finished route doesn't wind up + restart. Instead the
    // head pauses at the destination, then a new destination is appended
    // to the SAME path so the trail and head icon stay continuous.
    // The pause duration reuses snakeIntervalMin/Max.
    snakeContinuous: true,
    // Spring-tail dynamics.
    //   snakeTrailMin     — resting gap; the trail can't shrink below it.
    //   snakeTrailLength  — stretch cap; the trail can't grow past it.
    //   snakeTrailFollow  — tightness (0 = lazy/very stretchy, 1 = snappy).
    //   snakeTrailDetail  — number of vertices in the trail geometry. A
    //                       technical detail; raising it just adds more
    //                       sample points, it does NOT lengthen the trail.
    snakeTrailMin: 0.06,
    snakeTrailLength: 0.55,
    snakeTrailFollow: 0.45,
    snakeTrailDetail: 31,

    // Snake head icon (GPS arrow that rides the head, oriented by heading)
    showSnakeIcon: true,
    snakeIconColor: '#ffffff',
    snakeIconSize: 12,
    snakeIconOpacity: 1.0,
    snakeIconRotationOffset: 0,

    // Country list (JSON)
    countriesJson: JSON.stringify(DEFAULT_COUNTRIES, null, 2),
  },

  dialConfig: {
    Background: {
      bgColor: '#000000',
    },
    Globe: {
      _collapsed: false,
      showLines: true,
      lineColor: '#5a5a52',
      lineOpacity: [0.24, 0, 1, 0.01],
      lineWidth: [2.0, 0.5, 8, 0.1],
      lonSegments: [30, 6, 72, 1],
      latSegments: [30, 3, 36, 1],
    },
    Countries: {
      _collapsed: false,
      showCountries: true,
      showLabels: true,
      crossColor: '#ffffff',
      labelColor: '#cfcfcf',
      crossSize: [0.055, 0.01, 0.18, 0.005],
      crossOnSurface: true,
      labelSize: [10, 8, 22, 1],
      labelOffsetY: [18, -40, 60, 1],
      snapMode: {
        type: 'select',
        options: [...SNAP_MODES],
        default: 'free',
      },
      countriesJson: {
        type: 'text',
        default: JSON.stringify(DEFAULT_COUNTRIES, null, 2),
      },
    },
    Camera: {
      _collapsed: true,
      zoom: [0.84, 0.4, 2.5, 0.01],
      fov: [25, 12, 75, 0.5],
      basePitchDeg: [21, -90, 90, 0.5],
      baseYawDeg: [-10, -180, 180, 0.5],
    },
    Interaction: {
      _collapsed: false,
      dragSensitivity: [0.26, 0.05, 2.0, 0.01],
      dragSpring: DEFAULT_DRAG_SPRING,
      autoSpin: false,
      autoSpinSpeed: [0.15, -1.2, 1.2, 0.005],
      autoSpinAxis: {
        type: 'select',
        options: [...SPIN_AXES],
        default: 'Y (yaw)',
      },
      pauseSpinOnDrag: true,
    },
    Snake: {
      _collapsed: false,
      showSnake: true,
      snakeContinuous: true,
      accentColor: '#ffffff',
      snakeWidth: [1.0, 1, 12, 0.1],
      snakeIntervalMin: [0.1, 0.1, 8, 0.05],
      snakeIntervalMax: [0.6, 0.2, 12, 0.05],
      snakeSpeed: [0.44, 0.2, 6, 0.01],
      snakeLegMinDuration: [0.6, 0.0, 4.0, 0.05],
      snakeTrailMin: [0.06, 0.01, 1.0, 0.005],
      snakeTrailLength: [0.55, 0.05, 3.0, 0.01],
      snakeTrailFollow: [0.45, 0.05, 1.0, 0.01],
      snakeTrailDetail: [31, 4, 120, 1],
      snakeFlashDuration: [2.2, 0.1, 2.5, 0.05],
      snakeIntensity: [0.1, 0.1, 3.0, 0.01],
      snakeEase: DEFAULT_SNAKE_EASE,
    },
    'Snake Icon': {
      _collapsed: false,
      showSnakeIcon: true,
      snakeIconColor: '#ffffff',
      snakeIconSize: [12, 8, 80, 1],
      snakeIconOpacity: [1.0, 0, 1, 0.01],
      snakeIconRotationOffset: [0, -180, 180, 1],
    },
  },

  presets: {
    Default: {
      bgColor: '#000000',
      lineColor: '#5a5a52',
      lineOpacity: 0.45,
      lonSegments: 24,
      latSegments: 12,
      autoSpin: false,
      snapMode: 'nearest line',
      snakeIntervalMin: 0.6,
      snakeIntervalMax: 1.8,
      snakeSpeed: 1.6,
      snakeWidth: 3,
    },
    'Auto Spin': {
      autoSpin: true,
      autoSpinSpeed: 0.12,
      autoSpinAxis: 'Y (yaw)',
      pauseSpinOnDrag: true,
    },
    Dense: {
      lonSegments: 60,
      latSegments: 30,
      lineOpacity: 0.55,
      snakeSpeed: 2.4,
      snakeTrailDetail: 60,
    },
    Sparse: {
      lonSegments: 24,
      latSegments: 12,
      lineOpacity: 0.6,
      lineColor: '#3a3a36',
      snakeSpeed: 1.0,
      snakeTrailDetail: 18,
      snakeWidth: 2,
    },
    Cyan: {
      lineColor: '#1c4a52',
      crossColor: '#aef0ff',
      labelColor: '#aef0ff',
      accentColor: '#aef0ff',
      snakeIntensity: 1.6,
    },
    'Network Storm': {
      snakeIntervalMin: 0.15,
      snakeIntervalMax: 0.5,
      snakeSpeed: 3.5,
      snakeTrailDetail: 48,
      snakeWidth: 4,
      snakeIntensity: 2.0,
    },
  },
};
