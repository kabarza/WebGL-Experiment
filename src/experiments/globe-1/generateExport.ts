// ============================================================
// Globe 1 — Webflow JSON export generator (ESM + CDN Three.js)
// ============================================================
//
// Globe 1 depends on Three.js (~140 KB gzip), so unlike the pure-WebGL2
// experiments we don't inline everything. The strategy:
//
//   1) Three.js + the four examples we use load from jsDelivr at runtime
//      via a <script type="importmap">, pinned to the same version we
//      developed against (so a future Three.js release can't silently
//      break the embed).
//   2) Our own app code (~32 KB raw / ~11 KB gzip) is inlined into the
//      Webflow JSON's HtmlEmbed as a <script type="module">. No Vercel
//      hosting required for the customer site.
//   3) Per-page params are written to window.__GLOBE_1_CONFIG__ before
//      the bundle runs; the bundle reads it as runtime overrides on top
//      of the dial defaults.
//
// The bundle is pre-built by `scripts/build-export-esm.ts` into
// `dist/exports/globe-1.esm.js`. Vite's `?raw` import inlines it as a
// string at React-app build time, so the browser never has to fetch
// our code from anywhere — it ships in the JSON.

import type { DialConfig } from '../../core/Experiment.ts';
// The pre-built ESM bundle, imported as a string at build time. If this
// errors with "file not found", run: npx tsx scripts/build-export-esm.ts --experiment=globe-1
import bundleSource from '../../../dist/exports/globe-1.esm.js?raw';

export interface GenerateExportOptions {
  params: Record<string, unknown>;
  dialConfig: DialConfig;
  slug?: string;
  experimentTitle?: string;
  version?: string;
}

// Pin Three.js to the same version this codebase develops against.
// Bumping this requires re-testing — Three.js is API-stable between
// minor versions but not always between majors.
const THREE_VERSION = '0.183.2';
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

// Param keys that are sensible to expose per-deploy (primitives only).
// Object/array values like `dragSpring` and `snakeEase` aren't worth
// editing in a Webflow textarea — the dial's already a better UI.
const EXPORT_KEYS = new Set([
  'bgColor', 'lineColor', 'crossColor', 'labelColor', 'accentColor',
  'lonSegments', 'latSegments', 'lineOpacity', 'lineWidth',
  'showLines', 'showCountries', 'showLabels', 'showSnake', 'showSnakeIcon',
  'zoom', 'fov', 'basePitchDeg', 'baseYawDeg',
  'snapMode', 'crossSize', 'crossOnSurface', 'labelSize', 'labelOffsetY',
  'dragSensitivity', 'autoSpin', 'autoSpinSpeed', 'autoSpinAxis', 'pauseSpinOnDrag',
  'snakeIntervalMin', 'snakeIntervalMax', 'snakeSpeed', 'snakeLegMinDuration',
  'snakeWidth', 'snakeFlashDuration', 'snakeIntensity', 'snakeContinuous',
  'snakeTrailMin', 'snakeTrailLength', 'snakeTrailFollow', 'snakeTrailDetail',
  'snakeIconColor', 'snakeIconSize', 'snakeIconOpacity', 'snakeIconRotationOffset',
  'scrollPitchEnabled', 'scrollPitchRangeDeg', 'scrollPitchSmoothing',
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
      lines.push(`    ${key}: ${JSON.stringify(value)},`);
    } else {
      lines.push(`    ${key}: ${String(value)},`);
    }
  }
  return lines.join('\n');
}

function buildImportmap(): string {
  const map = {
    imports: {
      'three': `${CDN}/build/three.module.js`,
      'three/examples/jsm/renderers/CSS2DRenderer.js':
        `${CDN}/examples/jsm/renderers/CSS2DRenderer.js`,
      'three/examples/jsm/lines/Line2.js':
        `${CDN}/examples/jsm/lines/Line2.js`,
      'three/examples/jsm/lines/LineGeometry.js':
        `${CDN}/examples/jsm/lines/LineGeometry.js`,
      'three/examples/jsm/lines/LineMaterial.js':
        `${CDN}/examples/jsm/lines/LineMaterial.js`,
    },
  };
  return JSON.stringify(map, null, 2);
}

export function generateExport(options: GenerateExportOptions): string {
  const { params, experimentTitle = 'Globe 1', version = 'v2' } = options;

  const configLines = buildConfigBlock(params);
  const importmap = buildImportmap();

  return `<script type="importmap">
${importmap}
</script>
<script type="module">
// =============================================
// Flowing — ${experimentTitle} ${version}
// =============================================
// Three.js loads from the jsDelivr CDN (pinned to v${THREE_VERSION}).
// Our app code is inlined below — no external hosting required.
// Edit the values in the CONFIG block to customize the embed.
// =============================================
window.__GLOBE_1_CONFIG__ = Object.assign(
  window.__GLOBE_1_CONFIG__ || {},
  {
${configLines}
  }
);

${bundleSource}
</script>`;
}
