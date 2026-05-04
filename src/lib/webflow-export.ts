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
}

/**
 * Generate the hosted bundle URL for an experiment version.
 */
export function getBundleUrl(slug: string, version: number): string {
  return `${BASE_URL}/exports/${slug}-v${version}.js`;
}

/**
 * Generate the clipboard HTML for pasting into Webflow Custom Code embed.
 * Uses the hosted bundle (external script src).
 */
export function generateExportHTML(options: ExportOptions): string {
  const { slug, version, sizing, fixedWidth, fixedHeight } = options;
  const bundleUrl = getBundleUrl(slug, version);

  // Responsive default: 1:1 aspect with a min-height so the wrapper
  // doesn't collapse to zero in flex sections / CMS contexts where
  // the parent has `height:auto`. `overflow:hidden` clips CSS2D
  // labels that drift outside during animation. The `aspect-ratio`
  // can be overridden by the consumer's own CSS.
  const wrapperStyle =
    sizing === 'responsive'
      ? 'position:relative;width:100%;aspect-ratio:1/1;min-height:320px;overflow:hidden;'
      : `position:relative;width:${fixedWidth ?? 800}px;height:${fixedHeight ?? 600}px;overflow:hidden;`;

  return [
    `<div data-webgl-experiment="${slug}" data-flow-tempo style="${wrapperStyle}">`,
    `  <canvas style="display:block;width:100%;height:100%;"></canvas>`,
    `  <script src="${bundleUrl}"></script>`,
    `</div>`,
  ].join('\n');
}

/**
 * Generate a formatted CONFIG block string from params.
 * Used by "Copy Config" in DialKit — both in-app and in Webflow.
 * Colors are output without '#' prefix for Webflow convention.
 * Only includes primitive values (string, number, boolean) — objects/arrays are skipped.
 */
export function generateConfigBlock(params: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      const stripped = value.startsWith('#') ? value.slice(1) : value;
      lines.push(`  ${key}: "${stripped}",`);
    } else if (typeof value === 'boolean') {
      lines.push(`  ${key}: ${value},`);
    } else if (typeof value === 'number') {
      lines.push(`  ${key}: ${value},`);
    }
    // Skip objects, arrays, undefined, functions — they aren't CONFIG values
  }

  // Always set dialKit to false in copied config
  lines.push(`  dialKit: false,`);

  return `const CONFIG = {\n${lines.join('\n')}\n};`;
}
