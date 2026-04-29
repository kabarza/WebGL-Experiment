import type { ExperimentControls } from '../../core/Experiment.ts';

// Country list shape. The label sits centered below the cross at the
// global `labelOffsetY` distance (configured in the Countries panel).
export type Country = {
  name: string;
  lat: number;
  lon: number;
};
// Cluster scaled tighter around its centre and shifted slightly north
// from the previous defaults. Free-snap mode keeps the labels at these
// exact lat/lon rather than locking onto the 15° grid intersections.
export const DEFAULT_COUNTRIES: Country[] = [
  { name: 'NORWEGEN', lat: 57, lon: 0 },
  { name: 'NIEDERLANDE', lat: 48, lon: -10 },
  { name: 'BELGIEN', lat: 38, lon: -20 },
  { name: 'DEUTSCHLAND', lat: 38, lon: 18 },
  { name: 'LUXEMBURG', lat: 28, lon: -10 },
  { name: 'FRANKREICH', lat: 20, lon: -28 },
  { name: 'SCHWEIZ', lat: 10, lon: 0 },
  { name: 'ÖSTERREICH', lat: 20, lon: 28 },
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
    lonSegments: 21,
    latSegments: 19,
    lineOpacity: 0.45,
    lineWidth: 1.0,

    // Layers
    showLines: true,
    showCountries: true,
    showLabels: true,
    showSnake: true,

    // Camera framing
    zoom: 0.84,
    basePitchDeg: 25,
    baseYawDeg: -10,
    fov: 25,

    // Snap behaviour
    snapMode: 'intersection' as SnapMode,
    crossSize: 0.045,
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
    snakeIntervalMin: 0.1,
    snakeIntervalMax: 0.6,
    snakeSpeed: 0.82,
    snakeTrailLength: 93,
    snakeWidth: 1.0,
    snakeFlashDuration: 1.6,
    snakeIntensity: 0.1,
    snakeEase: DEFAULT_SNAKE_EASE,

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
      lineOpacity: [0.45, 0, 1, 0.01],
      lineWidth: [1.0, 0.5, 4, 0.1],
      lonSegments: [21, 6, 72, 1],
      latSegments: [19, 3, 36, 1],
    },
    Countries: {
      _collapsed: false,
      showCountries: true,
      showLabels: true,
      crossColor: '#ffffff',
      labelColor: '#cfcfcf',
      crossSize: [0.045, 0.01, 0.18, 0.005],
      crossOnSurface: true,
      labelSize: [10, 8, 22, 1],
      labelOffsetY: [18, -40, 60, 1],
      snapMode: {
        type: 'select',
        options: [...SNAP_MODES],
        default: 'intersection',
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
      basePitchDeg: [25, -90, 90, 0.5],
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
      accentColor: '#ffffff',
      snakeWidth: [1.0, 1, 12, 0.1],
      snakeIntervalMin: [0.1, 0.1, 8, 0.05],
      snakeIntervalMax: [0.6, 0.2, 12, 0.05],
      snakeSpeed: [0.82, 0.2, 6, 0.01],
      snakeTrailLength: [93, 4, 120, 1],
      snakeFlashDuration: [1.6, 0.1, 2.5, 0.05],
      snakeIntensity: [0.1, 0.1, 3.0, 0.01],
      snakeEase: DEFAULT_SNAKE_EASE,
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
      snakeTrailLength: 60,
    },
    Sparse: {
      lonSegments: 24,
      latSegments: 12,
      lineOpacity: 0.6,
      lineColor: '#3a3a36',
      snakeSpeed: 1.0,
      snakeTrailLength: 18,
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
      snakeTrailLength: 48,
      snakeWidth: 4,
      snakeIntensity: 2.0,
    },
  },
};
