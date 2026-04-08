// ============================================================
// dot trace — WebGL2 Experiment
// Progressive SVG path animation. Parses uploaded SVG files,
// sorts paths into a natural draw order (branches → flowers),
// and animates each path with a scale-from-centre effect.
// Branches pop in sequentially (growing outward), flowers
// bloom with a softer overshoot animation.
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { FullscreenQuadGL } from '../../core/FullscreenQuadGL.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

const FIT_MODES = ['Fill', 'Contain', 'Cover'];

// ── Types ────────────────────────────────────────────

interface ParsedPath {
  d: string;
  fill: string;
  /** Centre x in SVG-pixel space */
  cx: number;
  /** Centre y in SVG-pixel space */
  cy: number;
  /** Normalised centre (0–1) for sorting */
  nx: number;
  ny: number;
  layer: 'bg' | 'branch' | 'flower';
  /** Pre-built Path2D for canvas drawing */
  path2d: Path2D;
  /** Normalised order 0–1 in the timeline */
  order: number;
}

// ── Easing ──────────────────────────────────────────

/** Quick pop-in for branches / background. */
function easeOutCubic(t: number): number {
  const t1 = 1 - t;
  return 1 - t1 * t1 * t1;
}

/** Bloom overshoot for flowers — scales past 1.0 then settles. */
function easeOutBack(t: number, overshoot: number): number {
  const t1 = t - 1;
  return 1 + t1 * t1 * ((overshoot + 1) * t1 + overshoot);
}

// ── SVG parsing helpers ─────────────────────────────

function classifyColor(fill: string): 'bg' | 'branch' | 'flower' {
  const hex = fill.toLowerCase();
  if (hex === '#0e0f12' || hex === '#000000' || hex === '#0a0a0f') return 'bg';
  if (hex === '#a2a2a2' || hex === '#808080' || hex === '#606060') return 'branch';
  return 'flower';
}

/** Average of all numeric coordinates in a path-d string. */
function extractCenter(
  d: string,
  svgW: number,
  svgH: number,
): { cx: number; cy: number; nx: number; ny: number } {
  const nums = d.match(/[\d]+\.?\d*/g);
  if (!nums || nums.length < 2) return { cx: 0, cy: 0, nx: 0, ny: 0 };

  let sumX = 0,
    sumY = 0,
    count = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = parseFloat(nums[i]);
    const y = parseFloat(nums[i + 1]);
    // Skip values that are clearly not coords (e.g. huge)
    if (x >= 0 && x <= svgW * 2 && y >= 0 && y <= svgH * 2) {
      sumX += x;
      sumY += y;
      count++;
    }
  }

  if (count === 0) return { cx: 0, cy: 0, nx: 0, ny: 0 };
  const cx = sumX / count;
  const cy = sumY / count;
  return { cx, cy, nx: cx / svgW, ny: cy / svgH };
}

/** Parse SVG string, sort paths by draw order, assign order values. */
function parseSVG(
  svgText: string,
  originX: number,
  originY: number,
): { paths: ParsedPath[]; width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return { paths: [], width: 1024, height: 1024 };

  const vb = svgEl.getAttribute('viewBox');
  let svgW = 1024,
    svgH = 1024;
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    svgW = parts[2] || 1024;
    svgH = parts[3] || 1024;
  } else {
    svgW = parseFloat(svgEl.getAttribute('width') ?? '1024');
    svgH = parseFloat(svgEl.getAttribute('height') ?? '1024');
  }

  const pathEls = doc.querySelectorAll('path');
  const raw: ParsedPath[] = [];

  for (const el of pathEls) {
    const d = el.getAttribute('d');
    const fill = el.getAttribute('fill') ?? '#000000';
    if (!d) continue;

    const center = extractCenter(d, svgW, svgH);
    raw.push({
      d,
      fill,
      cx: center.cx,
      cy: center.cy,
      nx: center.nx,
      ny: center.ny,
      layer: classifyColor(fill),
      path2d: new Path2D(d),
      order: 0,
    });
  }

  // ── Sort into draw order ──────────────────────────
  const dist = (p: ParsedPath) =>
    Math.sqrt((p.nx - originX) ** 2 + (p.ny - originY) ** 2);

  const bg = raw.filter((p) => p.layer === 'bg');
  const branch = raw.filter((p) => p.layer === 'branch');
  const flower = raw.filter((p) => p.layer === 'flower');

  bg.sort((a, b) => dist(a) - dist(b));
  branch.sort((a, b) => dist(a) - dist(b));
  flower.sort((a, b) => dist(a) - dist(b));

  // Interleave background + branches, then flowers
  const combined: ParsedPath[] = [];
  let bi = 0,
    bri = 0;
  const bgRatio = bg.length / Math.max(bg.length + branch.length, 1);

  while (bi < bg.length || bri < branch.length) {
    if (bi < bg.length && (bri >= branch.length || Math.random() < bgRatio)) {
      combined.push(bg[bi++]);
    } else if (bri < branch.length) {
      combined.push(branch[bri++]);
    }
  }
  combined.push(...flower);

  // Assign normalised order (0–1)
  const total = combined.length;
  for (let i = 0; i < total; i++) {
    combined[i].order = i / total;
  }

  return { paths: combined, width: svgW, height: svgH };
}

// ── WebGL helpers ───────────────────────────────────

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

function mkShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('Failed to create shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error(`Shader compile error: ${info}`);
  }
  return s;
}

// ── Main ────────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');

  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }

  const quad = new FullscreenQuadGL(gl);

  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time',
    'u_resolution',
    'u_texture',
    'u_hasTexture',
    'u_textureSize',
    'u_fitMode',
    'u_bgColor',
    'u_brightness',
    'u_contrast',
    'u_postSaturation',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Offscreen canvas for progressive drawing ──────
  const offscreen = document.createElement('canvas');
  const ctx2d = offscreen.getContext('2d')!;
  let texture: WebGLTexture | null = null;
  let textureWidth = 0;
  let textureHeight = 0;
  let hasTexture = false;

  // ── SVG state ─────────────────────────────────────
  let svgPaths: ParsedPath[] = [];
  let svgText = '';
  let lastOriginX = -1;
  let lastOriginY = -1;
  let lastProgress = -1;

  function uploadOffscreen() {
    if (!texture) texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
    hasTexture = true;
  }

  function loadSVG(text: string) {
    svgText = text;
    const ox = params.originX as number;
    const oy = params.originY as number;
    const result = parseSVG(text, ox, oy);

    svgPaths = result.paths;
    textureWidth = result.width;
    textureHeight = result.height;

    offscreen.width = result.width;
    offscreen.height = result.height;
    lastOriginX = ox;
    lastOriginY = oy;
    lastProgress = -1; // force redraw
  }

  /**
   * Draw all visible paths with per-path animation.
   *
   * Each path has an `order` (0–1). The path's local animation progress is:
   *   local = clamp((globalProgress - order) / transitionWidth, 0, 1)
   *
   * - Branches/bg: scale from centre with easeOutCubic
   * - Flowers:     scale from centre with easeOutBack (overshoot bloom)
   */
  function drawAnimated(
    progress: number,
    popDuration: number,
    bloomOvershoot: number,
  ) {
    ctx2d.clearRect(0, 0, offscreen.width, offscreen.height);

    const tw = Math.max(popDuration, 0.001);

    for (const p of svgPaths) {
      const local = Math.min(Math.max((progress - p.order) / tw, 0), 1);
      if (local <= 0) continue; // not yet visible

      let scale: number;
      if (p.layer === 'flower') {
        // Bloom with overshoot
        scale = easeOutBack(local, bloomOvershoot);
      } else {
        // Quick pop-in
        scale = easeOutCubic(local);
      }

      if (scale < 0.005) continue;

      ctx2d.save();
      ctx2d.translate(p.cx, p.cy);
      ctx2d.scale(scale, scale);
      ctx2d.translate(-p.cx, -p.cy);

      // Flowers: fade in opacity during first half of animation
      if (p.layer === 'flower' && local < 0.5) {
        ctx2d.globalAlpha = local * 2;
      }

      ctx2d.fillStyle = p.fill;
      ctx2d.fill(p.path2d);
      ctx2d.restore();

      // Reset alpha
      ctx2d.globalAlpha = 1;
    }
  }

  // ── File input ────────────────────────────────────
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.svg,image/svg+xml';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    loadSVG(text);
    fileInput.value = '';
  });

  // ── Actions ───────────────────────────────────────
  let lastActionTs = 0;

  function handleActions() {
    const ts = (params._actionTs as number) ?? 0;
    if (ts === lastActionTs) return;
    lastActionTs = ts;

    const action = params._action as string;
    if (action === 'Source.UploadSVG') {
      fileInput.click();
    } else if (action === 'Source.Take Snapshot') {
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `dot-trace-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        },
        'image/png',
      );
    }
  }

  // ── Auto-play ─────────────────────────────────────
  let autoProgress = 0;

  // ── Render ────────────────────────────────────────
  return {
    render(time: number, deltaTime: number) {
      const P = params;

      handleActions();

      // Re-sort if origin changed
      const ox = P.originX as number;
      const oy = P.originY as number;
      if (
        svgText &&
        (Math.abs(ox - lastOriginX) > 0.005 ||
          Math.abs(oy - lastOriginY) > 0.005)
      ) {
        loadSVG(svgText);
      }

      // Playback
      if (P.playMode === 'Auto Play') {
        autoProgress += deltaTime * (P.playSpeed as number);
        if (autoProgress > 1.0) {
          autoProgress = (P.looping as boolean) ? 0.0 : 1.0;
        }
      } else {
        autoProgress = P.progress as number;
      }

      // Redraw canvas when progress changes
      if (svgPaths.length > 0) {
        // Add a small epsilon to progress comparison to account for
        // the tail-end of animations (popDuration after the last path)
        const popDur = P.popDuration as number;
        const effectiveProgress = autoProgress + popDur;
        if (
          Math.abs(autoProgress - lastProgress) > 0.0005 ||
          effectiveProgress > lastProgress
        ) {
          drawAnimated(
            autoProgress,
            popDur,
            P.bloomOvershoot as number,
          );
          uploadOffscreen();
          lastProgress = autoProgress;
        }
      }

      gl.useProgram(prog);

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      if (hasTexture && texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(U.u_texture, 0);
      }
      gl.uniform1f(U.u_hasTexture, hasTexture ? 1.0 : 0.0);
      gl.uniform2f(U.u_textureSize, textureWidth, textureHeight);
      gl.uniform1f(
        U.u_fitMode,
        Math.max(FIT_MODES.indexOf(P.fitMode as string), 0),
      );

      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_postSaturation, P.postSaturation as number);

      quad.bind(prog);
      quad.draw();
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    dispose() {
      gl.deleteProgram(prog);
      if (texture) gl.deleteTexture(texture);
      quad.dispose();
      fileInput.remove();
    },
  };
}

export const dotTraceExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
