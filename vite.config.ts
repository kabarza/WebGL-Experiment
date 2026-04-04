import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Vite plugin: WGSL loader with #include support
 *
 * Resolves `#include "name"` directives in .wgsl files by inlining
 * contents from src/shaders/lib/{name}.wgsl. Exports as JS string.
 * Supports HMR — shared lib changes trigger dependent module reload.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

function wgslIncludePlugin(): Plugin {
  const libDir = resolve(__dirname, 'src/shaders/lib');
  const includeRegex = /^#include\s+"([^"]+)"\s*$/gm;

  function resolveIncludes(source: string, filePath: string, seen: Set<string> = new Set()): string {
    return source.replace(includeRegex, (_match, name: string) => {
      const includePath = resolve(libDir, `${name}.wgsl`);
      if (seen.has(includePath)) {
        return `// [already included: ${name}]`;
      }
      if (!existsSync(includePath)) {
        throw new Error(`WGSL #include "${name}" not found at ${includePath} (referenced from ${filePath})`);
      }
      seen.add(includePath);
      const content = readFileSync(includePath, 'utf-8');
      return `// --- ${name}.wgsl ---\n${resolveIncludes(content, includePath, seen)}\n// --- end ${name}.wgsl ---`;
    });
  }

  return {
    name: 'vite-plugin-wgsl-include',
    enforce: 'pre',

    transform(code, id) {
      if (!id.endsWith('.wgsl')) return null;

      const resolved = resolveIncludes(code, id);
      return {
        code: `export default ${JSON.stringify(resolved)};`,
        map: null,
      };
    },

    handleHotUpdate({ file, server }) {
      if (file.endsWith('.wgsl') && file.startsWith(libDir)) {
        // A shared lib file changed — invalidate all .wgsl importers
        // so they re-transform with the updated #include contents.
        const affectedModules: Set<import('vite').ModuleNode> = new Set();
        for (const [, mod] of server.moduleGraph.idToModuleMap) {
          if (mod.file?.endsWith('.wgsl') && mod.file !== file) {
            affectedModules.add(mod);
          }
        }
        if (affectedModules.size > 0) {
          return [...affectedModules];
        }
      }
    },
  };
}

/**
 * Simple GLSL loader — exports .glsl files as JS strings
 */
function glslPlugin(): Plugin {
  return {
    name: 'vite-plugin-glsl',
    transform(code, id) {
      if (!id.endsWith('.glsl') && !id.endsWith('.vert') && !id.endsWith('.frag')) return null;
      return {
        code: `export default ${JSON.stringify(code)};`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), wgslIncludePlugin(), glslPlugin()],
  build: {
    target: 'es2022',
    minify: 'esbuild',
  },
  server: {
    open: true,
  },
});
