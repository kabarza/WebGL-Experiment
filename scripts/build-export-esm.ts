// ============================================================
// build-export-esm — Build a tiny ESM bundle with Three.js EXTERNAL
//
// Used by experiments that depend on Three.js, so the Webflow JSON
// export can inline our app code (~20 KB) and load Three.js from a
// CDN via importmap, instead of shipping a 540 KB self-contained
// bundle from Vercel.
//
// Output: dist/exports/<slug>.esm.js
//
// Usage: npx tsx scripts/build-export-esm.ts --experiment=globe-1
// ============================================================

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
const flags: Record<string, string> = {};
for (const arg of args) {
  const eqIdx = arg.indexOf('=');
  if (arg.startsWith('--') && eqIdx > 2) {
    flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
  }
}

const experiment = flags.experiment || flags.exp;
if (!experiment) {
  console.error('Usage: npx tsx scripts/build-export-esm.ts --experiment=<slug>');
  process.exit(1);
}

const entry = resolve(root, `src/experiments/${experiment}/standalone.ts`);
if (!existsSync(entry)) {
  console.error(`Standalone entry not found: ${entry}`);
  process.exit(1);
}

const outName = `${experiment}.esm`;

console.log(`Building ESM export: ${experiment}`);
console.log(`  Entry: ${entry}`);
console.log(`  Output: dist/exports/${outName}.js`);

await build({
  root,
  configFile: false,
  define: {
    // ESM bundle has no baked params — runtime CONFIG block + per-wrapper
    // data attributes are the only override mechanisms.
    __BAKED_PARAMS__: '{}',
  },
  build: {
    lib: {
      entry,
      formats: ['es'],
      fileName: () => `${outName}.js`,
    },
    outDir: resolve(root, 'dist/exports'),
    emptyOutDir: false,
    minify: 'esbuild',
    rollupOptions: {
      // Three.js (and its examples we use) stays external. The browser
      // will resolve these bare specifiers via the <script type="importmap">
      // emitted by generateExport.ts.
      external: [
        'three',
        'three/examples/jsm/renderers/CSS2DRenderer.js',
        'three/examples/jsm/lines/Line2.js',
        'three/examples/jsm/lines/LineGeometry.js',
        'three/examples/jsm/lines/LineMaterial.js',
      ],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

console.log(`\nDone! Bundle: dist/exports/${outName}.js`);
console.log(`Inline this into the Webflow JSON HtmlEmbed via generateExport.ts.`);
