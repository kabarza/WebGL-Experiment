// ============================================================
// Export pipeline — PNG (opaque / transparent mask), SVG (fill,
// stroke, alpha mask), CSS background snippet, preset JSON.
// ============================================================

import type { BrandEngine } from './types.ts';
import { vectorizeField } from './vectorize.ts';

export type ExportFormat =
  | 'png'
  | 'png-mask'
  | 'svg-fill'
  | 'svg-stroke'
  | 'svg-mask'
  | 'css';

export const EXPORT_FORMATS: Array<{ id: ExportFormat; label: string; hint: string }> = [
  { id: 'png', label: 'PNG', hint: 'Flattened render, exactly what you see' },
  { id: 'png-mask', label: 'PNG · transparent', hint: 'Pattern on transparent background' },
  { id: 'svg-fill', label: 'SVG · shapes', hint: 'Filled vector shapes, editable in Figma/Illustrator' },
  { id: 'svg-stroke', label: 'SVG · lines', hint: 'Iso-lines as strokes (outline look)' },
  { id: 'svg-mask', label: 'SVG · mask', hint: 'Black shapes, transparent bg — use as CSS mask-image' },
  { id: 'css', label: 'CSS background', hint: 'Copies a background-image snippet with the SVG inlined' },
];

export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function pixelsToPngBlob(pixels: Uint8ClampedArray, width: number, height: number): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

export interface SvgOptions {
  width: number;
  height: number;
  threshold: number;
  invert: boolean;
  fg: string;
  bg: string;
  tolerance: number;
  strokeWidth: number;
}

function svgHeader(w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`;
}

export function buildSvg(
  engine: BrandEngine,
  kind: 'svg-fill' | 'svg-stroke' | 'svg-mask',
  o: SvgOptions,
): { svg: string; contours: number } {
  const field = engine.readField();
  const { d, contours } = vectorizeField(field, {
    threshold: o.threshold,
    width: o.width,
    height: o.height,
    tolerance: o.tolerance,
    smooth: true,
  });
  // Inverting a fill = evenodd with a covering rect prepended
  const rect = `M0 0H${o.width}V${o.height}H0Z`;
  let body: string;
  if (kind === 'svg-stroke') {
    body = `<path d="${d}" fill="none" stroke="${o.fg}" stroke-width="${o.strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>`;
    body = `<rect width="100%" height="100%" fill="${o.bg}"/>` + body;
  } else if (kind === 'svg-mask') {
    body = `<path d="${o.invert ? rect + d : d}" fill="#000" fill-rule="evenodd"/>`;
  } else {
    body = `<rect width="100%" height="100%" fill="${o.bg}"/>` +
      `<path d="${o.invert ? rect + d : d}" fill="${o.fg}" fill-rule="evenodd"/>`;
  }
  return { svg: `${svgHeader(o.width, o.height)}${body}</svg>`, contours };
}

export function svgToCssBackground(svg: string, width: number, height: number): string {
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
  return [
    `/* Generated pattern — ${width}×${height} tile */`,
    `.pattern {`,
    `  background-color: transparent;`,
    `  background-image: url("data:image/svg+xml,${encoded}");`,
    `  background-size: ${width}px ${height}px;`,
    `  background-repeat: no-repeat;`,
    `  background-position: center;`,
    `}`,
  ].join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
