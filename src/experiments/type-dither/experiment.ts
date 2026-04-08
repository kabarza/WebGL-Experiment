// ============================================================
// type dither — Canvas2D text + WebGL2 multi-mode dithering
// Renders user text to an offscreen canvas, then applies
// halftone / ordered / noise / crosshatch / scanline dithering
// via a fragment shader with palette mapping and effects.
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

// ── Helpers ─────────────────────────────────────────────────

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

const DITHER_MODES: Record<string, number> = {
  halftone: 0,
  ordered: 1,
  noise: 2,
  crosshatch: 3,
  scanline: 4,
};

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

// ── Text scene rendering (Canvas2D → luminance mask) ────────

function renderTextScene(
  ctx: CanvasRenderingContext2D,
  P: Record<string, unknown>,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Clear to black
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const text = (P.text as string) || '2048';
  const fontSize = (P.fontSize as number) || 280;
  const fontWeight = (P.fontWeight as string) || '900';
  const fontFamily = (P.fontFamily as string) || 'sans-serif';
  const textBlur = (P.textBlur as number) || 0;
  const glowOn = P.textGlow as boolean;
  const glowIntensity = (P.glowIntensity as number) || 0.6;
  const glowSize = (P.glowSize as number) || 40;

  // Scale relative to a 1000px reference height so the text
  // occupies the same proportion of the viewport regardless
  // of device-pixel-ratio or canvas size.
  const scale = h / 1000;
  const scaledFont = fontSize * scale;
  const scaledGlow = glowSize * scale;
  const scaledBlur = textBlur * scale;

  // Font setup
  ctx.font = `${fontWeight} ${scaledFont}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Split text into lines
  const lines = text.split('\n');
  const lineHeight = scaledFont * 1.15;
  const totalHeight = lines.length * lineHeight;
  const startY = (h - totalHeight) / 2 + lineHeight / 2;

  // Optional blur (softens text edges → beautiful dither transitions)
  if (scaledBlur > 0.5) {
    ctx.filter = `blur(${scaledBlur}px)`;
  }

  // Optional glow (shadow behind text)
  if (glowOn) {
    ctx.shadowColor = `rgba(255, 255, 255, ${glowIntensity})`;
    ctx.shadowBlur = scaledGlow;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  // Draw white text (luminance mask)
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, startY + i * lineHeight);
  }

  // Reset filters
  ctx.filter = 'none';
  ctx.shadowBlur = 0;
}

// ── Experiment init ─────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  // Shader program
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }

  const quad = new FullscreenQuadGL(gl);

  // ── Uniform locations ──────────────────────────────
  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time',
    'u_resolution',
    'u_scene',
    // Dither
    'u_ditherMode',
    'u_cellSize',
    'u_softness',
    'u_gridAngle',
    'u_gamma',
    'u_invert',
    // Palette
    'u_bgColor',
    'u_color1',
    'u_color2',
    'u_colorMix',
    // Wave
    'u_waveOn',
    'u_waveAmplitude',
    'u_waveFrequency',
    // Animation
    'u_animOn',
    'u_animSpeed',
    'u_animIntensity',
    // Effects
    'u_chromaticOn',
    'u_chromaticOffset',
    'u_vignetteOn',
    'u_vignetteStrength',
    'u_vignetteSize',
    'u_grainOn',
    'u_grainAmount',
    // Post
    'u_brightness',
    'u_contrast',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Offscreen scene canvas ─────────────────────────
  const sceneCanvas = document.createElement('canvas');
  const sceneCtx = sceneCanvas.getContext('2d')!;

  // ── Scene texture ──────────────────────────────────
  let sceneTexture: WebGLTexture | null = null;
  let texW = 0;
  let texH = 0;

  function initTexture(w: number, h: number) {
    sceneCanvas.width = w;
    sceneCanvas.height = h;
    if (sceneTexture) gl.deleteTexture(sceneTexture);
    sceneTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sceneCanvas,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
    texW = w;
    texH = h;
  }

  function uploadTexture() {
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      sceneCanvas,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // ── Text state (persisted to localStorage) ─────────
  const TEXT_KEY = 'type-dither/text';
  let currentText =
    localStorage.getItem(TEXT_KEY) || (params.text as string) || '2048';
  params.text = currentText;

  // ── Change tracking ────────────────────────────────
  let lastTextHash = '';
  function textHash(P: Record<string, unknown>): string {
    return `${P.text}|${P.fontSize}|${P.fontWeight}|${P.fontFamily}|${P.textBlur}|${P.textGlow}|${P.glowIntensity}|${P.glowSize}`;
  }

  // ── Action handling ────────────────────────────────
  let lastActionTs = 0;

  function handleActions() {
    const ts = (params._actionTs as number) ?? 0;
    if (ts === lastActionTs) return;
    lastActionTs = ts;

    const action = params._action as string;
    if (action === 'Text.Edit Text') {
      const result = window.prompt(
        'Enter text (use \\n for new lines):',
        currentText.replace(/\n/g, '\\n'),
      );
      if (result !== null) {
        currentText = result.replace(/\\n/g, '\n');
        params.text = currentText;
        try {
          localStorage.setItem(TEXT_KEY, currentText);
        } catch {
          /* quota */
        }
      }
    }
  }

  // ── Reset detection ────────────────────────────────
  let lastResetTs = 0;

  // ── Initial render ─────────────────────────────────
  initTexture(canvas.width, canvas.height);
  renderTextScene(sceneCtx, params);
  uploadTexture();
  lastTextHash = textHash(params);

  // ── Render / resize / dispose ──────────────────────
  return {
    render(time: number, _deltaTime: number) {
      const P = params;

      handleActions();

      // Detect "Reset to Defaults" → restore default text
      const resetTs = (P._resetTs as number) ?? 0;
      if (resetTs > lastResetTs) {
        lastResetTs = resetTs;
        currentText = '2048';
        P.text = currentText;
        try {
          localStorage.setItem(TEXT_KEY, currentText);
        } catch {
          /* quota */
        }
        lastTextHash = ''; // force re-render
      }

      // Re-render Canvas2D only when text params change
      const th = textHash(P);
      if (th !== lastTextHash) {
        renderTextScene(sceneCtx, P);
        uploadTexture();
        lastTextHash = th;
      }

      // ── Draw ──────────────────────────────────────
      gl.useProgram(prog);

      // Core
      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      // Scene texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
      gl.uniform1i(U.u_scene, 0);

      // Dither
      gl.uniform1f(
        U.u_ditherMode,
        DITHER_MODES[P.ditherMode as string] ?? 0,
      );
      gl.uniform1f(U.u_cellSize, P.cellSize as number);
      gl.uniform1f(U.u_softness, P.softness as number);
      gl.uniform1f(U.u_gridAngle, P.gridAngle as number);
      gl.uniform1f(U.u_gamma, P.gamma as number);
      gl.uniform1f(U.u_invert, P.invert ? 1.0 : 0.0);

      // Palette
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      const c1 = hex2rgb(P.color1 as string);
      gl.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
      const c2 = hex2rgb(P.color2 as string);
      gl.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
      gl.uniform1f(U.u_colorMix, P.colorMix as number);

      // Wave
      gl.uniform1f(U.u_waveOn, P.waveOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_waveAmplitude, P.waveAmplitude as number);
      gl.uniform1f(U.u_waveFrequency, P.waveFrequency as number);

      // Animation
      gl.uniform1f(U.u_animOn, P.animOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_animSpeed, P.animSpeed as number);
      gl.uniform1f(U.u_animIntensity, P.animIntensity as number);

      // Effects
      gl.uniform1f(U.u_chromaticOn, P.chromaticOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_chromaticOffset, P.chromaticOffset as number);
      gl.uniform1f(U.u_vignetteOn, P.vignetteOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_vignetteStrength, P.vignetteStrength as number);
      gl.uniform1f(U.u_vignetteSize, P.vignetteSize as number);
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);

      // Post
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);

      quad.bind(prog);
      quad.draw();
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (canvas.width !== texW || canvas.height !== texH) {
        initTexture(canvas.width, canvas.height);
        lastTextHash = ''; // force text re-render at new resolution
      }
    },

    dispose() {
      gl.deleteProgram(prog);
      if (sceneTexture) gl.deleteTexture(sceneTexture);
      quad.dispose();
    },
  };
}

export const typeDitherExperiment: Experiment = {
  meta,
  controls,
  initGL,
};
