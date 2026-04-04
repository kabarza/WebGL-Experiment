// ============================================================
// build-export — CLI script for building standalone IIFE bundles
// Usage: npx tsx scripts/build-export.ts --experiment=flow-field --version=1
// ============================================================

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
const flags: Record<string, string> = {};
for (const arg of args) {
  const eqIdx = arg.indexOf('=');
  if (arg.startsWith('--') && eqIdx > 2) {
    flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
  }
}

const experiment = flags.experiment || flags.exp;
const version = parseInt(flags.version || '1', 10);

if (!experiment) {
  console.error('Usage: npx tsx scripts/build-export.ts --experiment=<slug> [--version=<n>] [--params=\'{"key":"val"}\'] [--params-file=path.json]');
  process.exit(1);
}

const entry = resolve(root, `src/experiments/${experiment}/standalone.ts`);
if (!existsSync(entry)) {
  console.error(`Standalone entry not found: ${entry}`);
  process.exit(1);
}

// Load baked params from (in priority order):
// 1. --params='{"key":"val"}' CLI flag (inline JSON)
// 2. --params-file=path.json CLI flag (JSON file)
// 3. Experiment defaults (standalone.ts fallback)
let bakedParams: Record<string, unknown> = {};

if (flags.params) {
  try {
    bakedParams = JSON.parse(flags.params);
    console.log('  Params: from --params CLI flag');
  } catch (e) {
    console.error(`Invalid JSON in --params: ${e}`);
    process.exit(1);
  }
} else if (flags['params-file']) {
  const paramsPath = resolve(root, flags['params-file']);
  if (!existsSync(paramsPath)) {
    console.error(`Params file not found: ${paramsPath}`);
    process.exit(1);
  }
  try {
    bakedParams = JSON.parse(readFileSync(paramsPath, 'utf-8'));
    console.log(`  Params: from ${flags['params-file']}`);
  } catch (e) {
    console.error(`Invalid JSON in params file: ${e}`);
    process.exit(1);
  }
} else {
  console.log('  Params: using standalone.ts fallback defaults');
}

const outName = `${experiment}-v${version}`;

console.log(`Building export: ${experiment} v${version}`);
console.log(`  Entry: ${entry}`);
console.log(`  Output: dist/exports/${outName}.js`);

await build({
  root,
  configFile: false,
  plugins: [
    // Inline WGSL/GLSL loader
    {
      name: 'glsl-loader',
      transform(code, id) {
        if (id.endsWith('.glsl') || id.endsWith('.vert') || id.endsWith('.frag')) {
          return { code: `export default ${JSON.stringify(code)};`, map: null };
        }
        if (id.endsWith('.wgsl')) {
          return { code: `export default ${JSON.stringify(code)};`, map: null };
        }
        return null;
      },
    },
  ],
  define: {
    __BAKED_PARAMS__: JSON.stringify(bakedParams),
  },
  build: {
    lib: {
      entry,
      formats: ['iife'],
      name: `Experiment${experiment.split('-').map((w: string) => w[0].toUpperCase() + w.slice(1)).join('')}`,
      fileName: () => `${outName}.js`,
    },
    outDir: resolve(root, 'dist/exports'),
    emptyOutDir: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

const baseUrl = process.env.VITE_BASE_URL || 'https://webgl-experiments.vercel.app';
console.log(`\nDone! Bundle: dist/exports/${outName}.js`);
console.log(`Deploy URL: ${baseUrl}/exports/${outName}.js`);
