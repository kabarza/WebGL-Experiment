// ============================================================
// Webflow Export — HTML generation + bundle URL helpers
// ============================================================

const BASE_URL = import.meta.env?.VITE_BASE_URL || 'https://webgl-experiments.vercel.app';

export interface ExportOptions {
  slug: string;
  version: number;
  params: Record<string, unknown>;
  sizing: 'responsive' | 'fixed';
  fixedWidth?: number;
  fixedHeight?: number;
  inline?: boolean; // If true, include inline IIFE instead of script src
}

/**
 * Generate the hosted bundle URL for an experiment version.
 */
export function getBundleUrl(slug: string, version: number): string {
  return `${BASE_URL}/exports/${slug}-v${version}.js`;
}

/**
 * Generate the clipboard HTML for pasting into Webflow Custom Code embed.
 */
export function generateExportHTML(options: ExportOptions): string {
  const { slug, version, sizing, fixedWidth, fixedHeight } = options;
  const bundleUrl = getBundleUrl(slug, version);

  const wrapperStyle =
    sizing === 'responsive'
      ? 'position:relative;width:100%;height:100%;'
      : `position:relative;width:${fixedWidth ?? 800}px;height:${fixedHeight ?? 600}px;`;

  return [
    `<div data-webgl-experiment="${slug}" style="${wrapperStyle}">`,
    `  <canvas style="display:block;width:100%;height:100%;"></canvas>`,
    `  <script src="${bundleUrl}"></script>`,
    `</div>`,
  ].join('\n');
}

/**
 * Generate a baked standalone IIFE source string with params injected.
 * This is for the inline export variant (no external script dependency).
 */
export function generateInlineScript(
  slug: string,
  params: Record<string, unknown>,
): string {
  const paramsJSON = JSON.stringify(params, null, 2);

  return `(function() {
  var wrapper = document.querySelector('[data-webgl-experiment="${slug}"]');
  if (!wrapper) return;
  var canvas = wrapper.querySelector('canvas');
  if (!canvas) return;

  var params = ${paramsJSON};

  // WebGL2 init — this is a placeholder.
  // The real implementation is in the built standalone entry.
  console.log('WebGL: ${slug} loaded with params', params);
})();`;
}
