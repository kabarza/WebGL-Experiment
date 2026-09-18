// ============================================================
// aurora-drift — Prompt export
// ============================================================

import type { PromptVariant } from '../../core/promptVariant.ts';
import shader from './shader.glsl';
import { MOUSE_MODE_ID, type MouseMode } from './params.ts';

const FRAMING =
  'Build a single React component called `AuroraDrift` that fills its parent and renders a full-screen WebGL fragment shader. No props, no controls, no UI — just the visual.';

function hexToRgbTuple(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return [round(r), round(g), round(b)];
}

function round(n: number, dp = 3): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/**
 * Map experiment params to the uniform block the prompt embeds.
 * Mirrors what AuroraDriftExperiment sets each frame, minus transient state
 * (pulse, mouse wind) which the prompt seeds at zero.
 */
function buildUniforms(p: Record<string, unknown>): Record<string, unknown> {
  const mouseMode = (p.mouseMode as MouseMode) ?? 'Swell';
  return {
    u_color1: hexToRgbTuple(p.color1 as string),
    u_color2: hexToRgbTuple(p.color2 as string),
    u_color3: hexToRgbTuple(p.color3 as string),
    u_color4: hexToRgbTuple(p.color4 as string),
    u_bgColor: hexToRgbTuple(p.bgColor as string),
    u_colorShift: p.colorShift,

    u_warpOn: p.warpOn ? 1 : 0,
    u_warpStrength: p.warpStrength,
    u_warpScale: p.warpScale,
    u_warpOctaves: p.warpOctaves,
    u_seed: p.seed,
    u_seedSpeed: p.seedSpeed,

    u_blobOn: p.blobOn ? 1 : 0,
    u_blobCount: p.blobCount,
    u_blobSize: p.blobSize,
    u_blobSpacing: p.blobSpacing,
    u_blendSoftness: p.blendSoftness,
    u_blobRotation: p.blobRotation,
    u_autoRotation: p.autoRotation,
    u_blobSpread: p.blobSpread,
    u_blobOffsetX: p.blobOffsetX,
    u_blobOffsetY: p.blobOffsetY,
    u_tileSpacing: p.tileSpacing,

    u_zoom: p.zoom,
    u_offsetX: p.offsetX,
    u_offsetY: p.offsetY,

    u_mouseOn: p.mouseOn ? 1 : 0,
    u_mouseMode: MOUSE_MODE_ID[mouseMode],
    u_mouseStr: p.mouseStrength,
    u_mouseRadius: p.mouseRadius,
    u_mouseWind: [0, 0],

    u_pulsePos: [0.5, 0.5],
    u_pulseStr: 0,
    u_pulseAge: 0,
    u_pulseSpeed: p.pulseSpeed,
    u_pulseWidth: p.pulseWidth,

    u_grainOn: p.grainOn ? 1 : 0,
    u_grainAmount: p.grainAmount,
    u_grainScale: p.grainSpeed === 0 ? p.grainScale : p.grainScale,
    u_grainSpeed: p.grainSpeed,

    speed: p.speed,
  };
}

function formatUniformsBlock(u: Record<string, unknown>): string {
  const lines: string[] = ['const U = {'];
  for (const [k, v] of Object.entries(u)) {
    let lit: string;
    if (Array.isArray(v)) {
      lit = `[${v.map((n) => (typeof n === 'number' ? n : JSON.stringify(n))).join(', ')}]`;
    } else if (typeof v === 'number') {
      lit = String(v);
    } else if (typeof v === 'string') {
      lit = JSON.stringify(v);
    } else if (typeof v === 'boolean') {
      lit = v ? '1' : '0';
    } else {
      lit = JSON.stringify(v);
    }
    lines.push(`  ${k}: ${lit},`);
  }
  lines.push('};');
  return lines.join('\n');
}

function buildMarkdown(uniforms: Record<string, unknown>, modeLabel: string): string {
  return `# Aurora Drift — Prompt (${modeLabel})

${FRAMING}

## Setup
- Plain \`<canvas>\` with WebGL1 context, full-bleed (\`position:absolute; inset:0; width:100%; height:100%\`).
- Resize via \`ResizeObserver\`; set \`canvas.width/height\` to \`clientWidth * dpr\` and \`clientHeight * dpr\` (cap dpr at 2). Update \`u_resolution\`.
- Vertex shader is a fullscreen triangle/quad passing \`vUv\` in \`[0,1]\`.
- \`requestAnimationFrame\` loop; \`u_time\` in seconds since mount, multiplied by \`U.speed\`.
- Track mouse on the canvas: store normalized \`[0..1]\` cursor in \`u_mousePos\` (default \`0.5, 0.5\`).
- Cleanup on unmount: cancel RAF, disconnect observer, delete GL resources.

## Uniforms

\`\`\`js
${formatUniformsBlock(uniforms)}
\`\`\`

## Fragment shader

\`\`\`glsl
${shader.trim()}
\`\`\`

## Acceptance
- Renders an animated aurora matching the look defined by the uniforms above.
- Cursor influences the field per the active \`u_mouseMode\` (1 = Swell: warp amplitude rises near cursor, no displacement).
- Resizes cleanly with the parent. No layout shift, no controls.
`;
}

export const promptVariants: PromptVariant[] = [
  {
    id: 'react-webgl',
    label: 'React + WebGL',
    build: (values, mode) => {
      const uniforms = buildUniforms(values);
      const modeLabel = mode === 'defaults' ? 'defaults' : 'current settings';
      return {
        markdown: buildMarkdown(uniforms, modeLabel),
        json: uniforms,
      };
    },
  },
];
