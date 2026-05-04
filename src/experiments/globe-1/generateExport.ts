// ============================================================
// Globe 1 — Webflow JSON export generator
// ============================================================
//
// Globe 1 is a Three.js experiment (~140 KB gzip of library deps),
// so unlike the pure-WebGL2 experiments we do NOT inline everything
// into the HtmlEmbed. Instead we emit a tiny snippet that:
//   1) writes the user's current params to a window-scoped config
//      object so the hosted bundle picks them up at boot, and
//   2) loads the hosted IIFE (`globe-1-vN.js`) which does the real
//      work and reads window.__GLOBE_1_CONFIG__ as runtime overrides.
//
// The wrapper Block + Canvas Webflow nodes (built by webflow-json.ts)
// give us the structural shell; this generator only fills the
// HtmlEmbed body.

import type { DialConfig } from '../../core/Experiment.ts';

export interface GenerateExportOptions {
  params: Record<string, unknown>;
  dialConfig: DialConfig;
  slug?: string;
  experimentTitle?: string;
  version?: string;
}

// The hosted bundle URL. Mirrors `getBundleUrl` in src/lib/webflow-export.ts
// but inlined here so the generator stays self-contained.
const BASE_URL =
  (import.meta as ImportMeta & { env?: { VITE_BASE_URL?: string } })
    .env?.VITE_BASE_URL ?? 'https://webgl-experiments.vercel.app';

/**
 * Param keys the user can sensibly override per-deploy. Object/array
 * values (e.g. `dragSpring`, `snakeEase`) are excluded — those are
 * baked at build time, not at page time.
 */
const EXPORT_KEYS = new Set([
  // Background + colors
  'bgColor', 'lineColor', 'crossColor', 'labelColor', 'accentColor',
  // Globe geometry
  'lonSegments', 'latSegments', 'lineOpacity', 'lineWidth',
  // Layer toggles
  'showLines', 'showCountries', 'showLabels', 'showSnake', 'showSnakeIcon',
  // Camera
  'zoom', 'fov', 'basePitchDeg', 'baseYawDeg',
  // Snap + sizing
  'snapMode', 'crossSize', 'crossOnSurface', 'labelSize', 'labelOffsetY',
  // Interaction + auto-spin
  'dragSensitivity', 'autoSpin', 'autoSpinSpeed', 'autoSpinAxis', 'pauseSpinOnDrag',
  // Snake (numeric / primitive)
  'snakeIntervalMin', 'snakeIntervalMax', 'snakeSpeed', 'snakeLegMinDuration',
  'snakeWidth', 'snakeFlashDuration', 'snakeIntensity', 'snakeContinuous',
  'snakeTrailMin', 'snakeTrailLength', 'snakeTrailFollow', 'snakeTrailDetail',
  // Snake icon
  'snakeIconColor', 'snakeIconSize', 'snakeIconOpacity', 'snakeIconRotationOffset',
  // Scroll-driven pitch
  'scrollPitchEnabled', 'scrollPitchRangeDeg', 'scrollPitchSmoothing',
  // Country list (string JSON)
  'countriesJson',
]);

function isExportablePrimitive(value: unknown): value is string | number | boolean {
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

function buildConfigBlock(params: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (!EXPORT_KEYS.has(key)) continue;
    if (!isExportablePrimitive(value)) continue;
    if (typeof value === 'string') {
      // JSON.stringify handles quoting + escaping of country lists, etc.
      lines.push(`    ${key}: ${JSON.stringify(value)},`);
    } else {
      lines.push(`    ${key}: ${String(value)},`);
    }
  }
  return lines.join('\n');
}

export function generateExport(options: GenerateExportOptions): string {
  const {
    params,
    slug = 'globe-1',
    experimentTitle = 'Globe 1',
    version = 'v2',
  } = options;

  const configLines = buildConfigBlock(params);
  const bundleUrl = `${BASE_URL}/exports/${slug}-${version}.js`;

  return `<script>
// =============================================
// Flowing — ${experimentTitle} ${version}
// =============================================
// Globe 1 uses Three.js, so we don't inline the
// implementation. The line below pre-loads your
// dial settings into a window-scoped config that
// the hosted bundle reads at boot.
//
// To change a value: edit the line in this CONFIG
// block. To upgrade the bundle: bump the version
// at the bottom of this script (and ensure the
// matching globe-1-v{N}.js is hosted).
// =============================================
window.__GLOBE_1_CONFIG__ = Object.assign(
  window.__GLOBE_1_CONFIG__ || {},
  {
${configLines}
  }
);
</script>
<script src="${bundleUrl}" defer></script>`;
}
