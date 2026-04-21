// ============================================================
// type are — HTML-in-Canvas + WebGL2 multi-mode dithering
//
// Uses the new HTML-in-Canvas API (chrome://flags/#canvas-draw-element)
// to render real CSS-styled text as a WebGL texture via
// texElementImage2D, then applies dithering shaders.
//
// Falls back to Canvas2D text rendering when the API is absent.
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

// ── HTML-in-Canvas API type extensions ─────────────────────
// Behind chrome://flags/#canvas-draw-element in Chromium

interface HTMLCanvasElementHIC extends HTMLCanvasElement {
  layoutSubtree: boolean;
  onpaint: ((event: Event) => void) | null;
  requestPaint(): void;
  getElementTransform(
    element: Element,
    drawTransform: DOMMatrix,
  ): DOMMatrix;
}

interface WebGL2RenderingContextHIC extends WebGL2RenderingContext {
  texElementImage2D(
    target: GLenum,
    level: GLint,
    internalformat: GLint,
    format: GLenum,
    type: GLenum,
    element: Element,
  ): void;
}

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

// ── Canvas2D fallback text rendering ───────────────────────

function renderTextFallback(
  ctx: CanvasRenderingContext2D,
  P: Record<string, unknown>,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const text = (P.text as string) || 'GODSPEED';
  const fontSize = (P.fontSize as number) || 260;
  const fontWeight = (P.fontWeight as string) || '900';
  const fontFamily = (P.fontFamily as string) || 'sans-serif';
  const textBlur = (P.textBlur as number) || 0;
  const glowOn = P.textGlow as boolean;
  const glowIntensity = (P.glowIntensity as number) || 0.5;
  const glowSize = (P.glowSize as number) || 30;

  const scale = h / 1000;
  const scaledFont = fontSize * scale;
  const scaledGlow = glowSize * scale;
  const scaledBlur = textBlur * scale;
  const letterSpacing = ((P.letterSpacing as number) || 0) * scale;

  ctx.font = `${fontWeight} ${scaledFont}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lineHeight = scaledFont * ((P.lineHeight as number) || 1.1);
  const totalHeight = lines.length * lineHeight;
  const startY = (h - totalHeight) / 2 + lineHeight / 2;

  if (scaledBlur > 0.5) {
    ctx.filter = `blur(${scaledBlur}px)`;
  }

  if (glowOn) {
    ctx.shadowColor = `rgba(255, 255, 255, ${glowIntensity})`;
    ctx.shadowBlur = scaledGlow;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.fillStyle = '#ffffff';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const transform = (P.textTransform as string) || 'none';
    if (transform === 'uppercase') line = line.toUpperCase();
    else if (transform === 'lowercase') line = line.toLowerCase();

    if (letterSpacing > 0.5) {
      // Manual letter spacing (Canvas2D doesn't support it natively)
      const chars = [...line];
      const totalW =
        ctx.measureText(line).width + letterSpacing * (chars.length - 1);
      let x = w / 2 - totalW / 2;
      for (const ch of chars) {
        ctx.fillText(ch, x + ctx.measureText(ch).width / 2, startY + i * lineHeight);
        x += ctx.measureText(ch).width + letterSpacing;
      }
    } else {
      ctx.fillText(line, w / 2, startY + i * lineHeight);
    }
  }

  ctx.filter = 'none';
  ctx.shadowBlur = 0;
}

// ── HTML-in-Canvas: build the styled text element ──────────

function buildTextElement(): HTMLDivElement {
  const container = document.createElement('div');
  container.dataset.typeAre = 'root';
  container.style.cssText = `
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000000;
    overflow: hidden;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  `;

  const inner = document.createElement('div');
  inner.dataset.typeAre = 'text';
  inner.style.cssText = `
    color: #ffffff;
    text-align: center;
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 90%;
    padding: 0 5%;
    box-sizing: border-box;
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  `;

  container.appendChild(inner);
  return container;
}

function updateTextElement(
  container: HTMLDivElement,
  P: Record<string, unknown>,
) {
  const inner = container.querySelector('[data-type-are="text"]') as HTMLDivElement;
  if (!inner) return;

  let text = (P.text as string) || 'GODSPEED';
  const transform = (P.textTransform as string) || 'none';
  if (transform === 'uppercase') text = text.toUpperCase();
  else if (transform === 'lowercase') text = text.toLowerCase();

  inner.textContent = text;

  const fontSize = (P.fontSize as number) || 260;
  const fontWeight = (P.fontWeight as string) || '900';
  const fontFamily = (P.fontFamily as string) || 'sans-serif';
  const letterSpacing = (P.letterSpacing as number) || 0;
  const lineHeight = (P.lineHeight as number) || 1.1;
  const textBlur = (P.textBlur as number) || 0;
  const glowOn = P.textGlow as boolean;
  const glowIntensity = (P.glowIntensity as number) || 0.5;
  const glowSize = (P.glowSize as number) || 30;
  const textStroke = (P.textStroke as number) || 0;
  const textStrokeColor = (P.textStrokeColor as string) || '#ffffff';

  // Build CSS text-shadow for glow
  let textShadow = 'none';
  if (glowOn) {
    const alpha = glowIntensity;
    textShadow = [
      `0 0 ${glowSize * 0.3}px rgba(255,255,255,${alpha})`,
      `0 0 ${glowSize * 0.6}px rgba(255,255,255,${alpha * 0.6})`,
      `0 0 ${glowSize}px rgba(255,255,255,${alpha * 0.3})`,
    ].join(', ');
  }

  // Build CSS filter for blur
  const filter = textBlur > 0.5 ? `blur(${textBlur}px)` : 'none';

  // Stroke (webkit)
  const stroke = textStroke > 0
    ? `-webkit-text-stroke: ${textStroke}px ${textStrokeColor};`
    : '';

  inner.style.cssText = `
    color: #ffffff;
    text-align: center;
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 90%;
    padding: 0 5%;
    box-sizing: border-box;
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
    font-size: ${fontSize}px;
    font-weight: ${fontWeight};
    font-family: ${fontFamily};
    letter-spacing: ${letterSpacing}px;
    line-height: ${lineHeight};
    text-shadow: ${textShadow};
    filter: ${filter};
    ${stroke}
  `;
}

// ── Experiment init ─────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  // ── Detect HTML-in-Canvas support ──────────────────
  const hicSupported = 'texElementImage2D' in gl;
  const hicCanvas = canvas as unknown as HTMLCanvasElementHIC;
  const hicGL = gl as unknown as WebGL2RenderingContextHIC;

  // ── HTML-in-Canvas: set up DOM ─────────────────────
  let textContainer: HTMLDivElement | null = null;
  let snapshotReady = false;

  // ── Canvas2D fallback ──────────────────────────────
  let sceneCanvas: HTMLCanvasElement | null = null;
  let sceneCtx: CanvasRenderingContext2D | null = null;

  /**
   * Sync the child element's CSS transform so the browser
   * aligns hit-testing (text selection, cursor, a11y) with
   * the drawn location.  For WebGL the spec provides
   * canvas.getElementTransform(element, drawTransform).
   *
   * Our fullscreen-quad draws the element at the canvas origin
   * scaled to fill, so the draw transform is just the
   * CSS-to-grid DPR scale.
   */
  function syncTransform() {
    if (!textContainer) return;
    try {
      const dpr = canvas.width / (canvas.clientWidth || 1);
      const drawTransform = new DOMMatrix([dpr, 0, 0, dpr, 0, 0]);
      const cssTransform = hicCanvas.getElementTransform(
        textContainer,
        drawTransform,
      );
      textContainer.style.transform = cssTransform.toString();
    } catch {
      // API not ready yet or element not snapshotted — no-op
    }
  }

  if (hicSupported) {
    // Enable layoutsubtree on the canvas
    hicCanvas.layoutSubtree = true;

    // Build and append the text element
    textContainer = buildTextElement();
    canvas.appendChild(textContainer);
    updateTextElement(textContainer, params);

    // Listen for paint events — marks snapshot as ready
    // and syncs the hit-test transform
    hicCanvas.onpaint = () => {
      snapshotReady = true;
      syncTransform();
    };

    // Request initial paint
    hicCanvas.requestPaint();
  } else {
    // Fallback: offscreen Canvas2D
    sceneCanvas = document.createElement('canvas');
    sceneCtx = sceneCanvas.getContext('2d')!;
  }

  // ── Shader program ─────────────────────────────────
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
    'u_ditherMode',
    'u_cellSize',
    'u_softness',
    'u_gridAngle',
    'u_gamma',
    'u_invert',
    'u_bgColor',
    'u_color1',
    'u_color2',
    'u_colorMix',
    'u_waveOn',
    'u_waveAmplitude',
    'u_waveFrequency',
    'u_animOn',
    'u_animSpeed',
    'u_animIntensity',
    'u_chromaticOn',
    'u_chromaticOffset',
    'u_vignetteOn',
    'u_vignetteStrength',
    'u_vignetteSize',
    'u_grainOn',
    'u_grainAmount',
    'u_brightness',
    'u_contrast',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Scene texture ──────────────────────────────────
  let sceneTexture: WebGLTexture | null = null;
  let texW = 0;
  let texH = 0;

  function initTexture(w: number, h: number) {
    if (!hicSupported) {
      sceneCanvas!.width = w;
      sceneCanvas!.height = h;
    }

    if (sceneTexture) gl.deleteTexture(sceneTexture);
    sceneTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    if (hicSupported) {
      // Allocate empty texture — texElementImage2D will fill it
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, null,
      );
    } else {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas!,
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    texW = w;
    texH = h;
  }

  function uploadTexture() {
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);

    if (hicSupported && snapshotReady && textContainer) {
      // HTML-in-Canvas: capture the styled HTML element as a texture
      try {
        hicGL.texElementImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
          textContainer,
        );
      } catch {
        // Snapshot not ready yet — skip this frame
      }
    } else if (!hicSupported && sceneCtx) {
      // Canvas2D fallback
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texSubImage2D(
        gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas!,
      );
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // ── Change tracking ────────────────────────────────
  let lastTextHash = '';
  function textHash(P: Record<string, unknown>): string {
    return [
      P.text, P.fontSize, P.fontWeight, P.fontFamily,
      P.letterSpacing, P.lineHeight, P.textTransform,
      P.textBlur, P.textGlow, P.glowIntensity, P.glowSize,
      P.textStroke, P.textStrokeColor,
    ].join('|');
  }

  // ── Reset detection ────────────────────────────────
  let lastResetTs = 0;

  // ── Initial render ─────────────────────────────────
  initTexture(canvas.width, canvas.height);

  if (!hicSupported && sceneCtx) {
    renderTextFallback(sceneCtx, params);
    uploadTexture();
  }

  lastTextHash = textHash(params);

  // ── Render / resize / dispose ──────────────────────
  return {
    render(time: number, _deltaTime: number) {
      const P = params;

      // Detect "Reset to Defaults"
      const resetTs = (P._resetTs as number) ?? 0;
      if (resetTs > lastResetTs) {
        lastResetTs = resetTs;
        lastTextHash = ''; // force re-render
      }

      // Re-render text only when params change
      const th = textHash(P);
      if (th !== lastTextHash) {
        if (hicSupported && textContainer) {
          updateTextElement(textContainer, P);
          hicCanvas.requestPaint();
        } else if (sceneCtx) {
          renderTextFallback(sceneCtx, P);
        }
        lastTextHash = th;
      }

      // Upload texture
      uploadTexture();

      // ── Draw ──────────────────────────────────────
      gl.useProgram(prog);

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
      gl.uniform1i(U.u_scene, 0);

      // Dither
      gl.uniform1f(U.u_ditherMode, DITHER_MODES[P.ditherMode as string] ?? 0);
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

        if (hicSupported && textContainer) {
          // Resize the HTML container to match canvas CSS size
          textContainer.style.width = `${canvas.clientWidth}px`;
          textContainer.style.height = `${canvas.clientHeight}px`;
          syncTransform();
          hicCanvas.requestPaint();
        } else if (sceneCtx) {
          renderTextFallback(sceneCtx, params);
          uploadTexture();
        }

        lastTextHash = ''; // force re-render
      }
    },

    dispose() {
      gl.deleteProgram(prog);
      if (sceneTexture) gl.deleteTexture(sceneTexture);
      quad.dispose();

      // Clean up HTML-in-Canvas DOM
      if (textContainer) {
        textContainer.remove();
        textContainer = null;
      }
      if (hicSupported) {
        hicCanvas.layoutSubtree = false;
        hicCanvas.onpaint = null;
      }
    },
  };
}

export const typeAreExperiment: Experiment = {
  meta,
  controls,
  initGL,
};
