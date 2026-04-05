// ============================================================
// build-dialkit-standalone — Bundles React + DialKit into a
// single IIFE with window.FlowDialKit API for Webflow use
//
// CSS is injected into the JS bundle at runtime via a <style> tag.
//
// Usage: npx tsx scripts/build-dialkit-standalone.ts
// Output: dist/exports/dialkit-standalone.js
// ============================================================

import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'dist/exports');
const entry = resolve(root, 'src/lib/dialkit-standalone-entry.tsx');

console.log('Building DialKit standalone bundle...');
console.log(`  Entry: ${entry}`);
console.log(`  Output: dist/exports/dialkit-standalone.js`);

await build({
  root,
  configFile: false,
  plugins: [react()],
  build: {
    lib: {
      entry,
      formats: ['iife'],
      name: 'FlowDialKitBundle',
      fileName: () => 'dialkit-standalone.js',
    },
    outDir,
    emptyOutDir: false,
    minify: 'esbuild',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

// ── Post-build: inline CSS into the JS bundle ──
const jsPath = resolve(outDir, 'dialkit-standalone.js');

// Find any .css file in the output directory
const cssFile = readdirSync(outDir).find((f) => f.endsWith('.css'));
if (cssFile) {
  const cssPath = resolve(outDir, cssFile);
  const css = readFileSync(cssPath, 'utf-8');
  const js = readFileSync(jsPath, 'utf-8');

  // Escape for template literal embedding
  const escaped = css
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  const injector = `(function(){var s=document.createElement("style");s.textContent=\`${escaped}\`;document.head.appendChild(s)})();\n`;

  writeFileSync(jsPath, injector + js);
  unlinkSync(cssPath);
  console.log(`  CSS inlined from ${cssFile} (${(css.length / 1024).toFixed(1)} KB)`);
}

const finalSize = readFileSync(jsPath).length;
console.log(`\nDone! Bundle: dist/exports/dialkit-standalone.js (${(finalSize / 1024).toFixed(0)} KB)`);
