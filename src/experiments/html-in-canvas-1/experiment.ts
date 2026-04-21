// ============================================================
// html-in-canvas 1 — WebGL2 + html-in-canvas beta API
//
// Requires Chrome Canary with:
//   chrome://flags/#canvas-draw-element  →  Enabled
//
// API surface used:
//   • canvas.setAttribute('layoutsubtree', '')
//   • canvas.requestPaint()
//   • canvas.addEventListener('paint', …)
//   • gl.texElementImage2D(…, element)
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

// ── html-in-canvas type augmentations ────────────────────────────────────────

interface HTMLCanvasElementHIC extends HTMLCanvasElement {
  onpaint: ((event: Event) => void) | null;
  requestPaint(): void;
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

// ── Effect-mode name → integer mapping ───────────────────────────────────────

const EFFECT_MODES: Record<string, number> = {
  clean: 0,
  dither: 1,
  prism: 2,
  streak: 3,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function hex2rgb(h: string): [number, number, number] {
  const hex = h.startsWith('#') ? h.slice(1) : h;
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function css(el: HTMLElement, styles: Record<string, string>) {
  for (const [k, v] of Object.entries(styles)) el.style.setProperty(k, v);
}

// ── HTML scene — real DOM inside the canvas ───────────────────────────────────

function createHtmlScene(canvas: HTMLCanvasElement) {
  const root    = document.createElement('section');
  const heading = document.createElement('h1');
  const copy    = document.createElement('p');

  root.dataset.experimentCanvasHtml = 'html-in-canvas-1';

  heading.textContent = 'HTML in Canvas';
  copy.textContent =
    'Selectable text. Real DOM. Rendered into WebGL via texElementImage2D — ' +
    'the html-in-canvas beta API lets you treat live HTML as a GPU texture.';

  css(root, {
    position:         'absolute',
    inset:            '0',
    display:          'flex',
    'flex-direction': 'column',
    'justify-content':'center',
    gap:              '20px',
    padding:          'clamp(32px, 7vw, 96px)',
    'box-sizing':     'border-box',
    background:       'transparent',
    color:            '#ffffff',
    'pointer-events': 'auto',
    'user-select':    'text',
    '-webkit-user-select': 'text',
    'text-rendering': 'geometricPrecision',
  });

  css(heading, {
    margin:          '0',
    'max-width':     '12ch',
    'font-family':   '"Inter", "Helvetica Neue", Arial, sans-serif',
    'font-size':     'clamp(60px, 9.5vw, 160px)',
    'font-weight':   '800',
    'line-height':   '0.92',
    'letter-spacing':'-0.03em',
    'text-wrap':     'balance',
    color:           'rgba(255, 255, 255, 0.97)',
  });

  css(copy, {
    margin:          '0',
    'max-width':     '46ch',
    'font-family':   '"Inter", "Helvetica Neue", Arial, sans-serif',
    'font-size':     'clamp(14px, 1.6vw, 20px)',
    'line-height':   '1.5',
    'letter-spacing':'0.01em',
    color:           'rgba(220, 240, 255, 0.75)',
    'text-wrap':     'pretty',
  });

  root.append(heading, copy);
  canvas.appendChild(root);

  return {
    root,
    dispose() { root.remove(); },
  };
}

// ── GL initialisation ─────────────────────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;
  const hicCanvas = canvas as HTMLCanvasElementHIC;
  const hicGL     = gl     as WebGL2RenderingContextHIC;

  // ── Feature detection ───────────────────────────────────────────────────────
  if (!('texElementImage2D' in gl) || !('requestPaint' in canvas)) {
    throw new Error(
      'html-in-canvas 1 needs Chrome Canary with ' +
      'chrome://flags/#canvas-draw-element enabled.',
    );
  }

  // ── Opt in: canvas subtree participates in layout + hit testing ─────────────
  canvas.setAttribute('layoutsubtree', '');

  // ── DOM scene ───────────────────────────────────────────────────────────────
  const htmlScene = createHtmlScene(canvas);

  // ── Shader program ──────────────────────────────────────────────────────────
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER,   vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }

  const quad = new FullscreenQuadGL(gl);

  // ── Uniform locations ───────────────────────────────────────────────────────
  const U: Record<string, WebGLUniformLocation | null> = {};
  for (const name of [
    'u_time', 'u_resolution', 'u_text',
    'u_color1', 'u_color2', 'u_color3', 'u_color4',
    'u_bgScale', 'u_drift', 'u_waveAmp',
    'u_effectMode', 'u_effectMix', 'u_ditherCell', 'u_chromatic', 'u_glow',
    'u_grainAmount', 'u_vignette',
  ]) {
    U[name] = gl.getUniformLocation(prog, name);
  }

  // ── Text texture ─────────────────────────────────────────────────────────────
  const textTexture = gl.createTexture();
  if (!textTexture) throw new Error('Failed to create text texture');

  gl.bindTexture(gl.TEXTURE_2D, textTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);

  // ── Paint lifecycle ───────────────────────────────────────────────────────────
  let textureReady    = false;
  let pendingPaintReq = false;

  const handlePaint = () => {
    // Upload the live DOM element as a GPU texture.
    // Use try/finally so pendingPaintReq is ALWAYS reset — if texElementImage2D
    // throws (e.g. snapshot not yet recorded on first paint), we can retry next
    // frame instead of being stuck forever.
    try {
      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      hicGL.texElementImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        htmlScene.root,
      );
      gl.bindTexture(gl.TEXTURE_2D, null);
      textureReady = true;
    } catch (e) {
      // Snapshot may not be ready yet — will retry via the next requestPaint()
      console.warn('[html-in-canvas-1] texElementImage2D error (retrying):', e);
    } finally {
      pendingPaintReq = false; // always ungate so requestPaint() can fire again
    }
  };

  canvas.addEventListener('paint', handlePaint as EventListener);

  function requestPaint() {
    if (pendingPaintReq) return;
    pendingPaintReq = true;
    hicCanvas.requestPaint();
  }

  // Double-rAF: wait for the browser to complete at least one layout pass so
  // the element is fully laid out before we ask for a snapshot.
  requestAnimationFrame(() => requestAnimationFrame(() => requestPaint()));

  // ── Experiment instance ───────────────────────────────────────────────────────
  return {
    render(time: number) {
      // Poll every frame until texture is ready — no tick throttle so we
      // catch the first valid snapshot as quickly as possible.
      if (!textureReady) {
        requestPaint();
      }

      gl.useProgram(prog);

      gl.uniform1f(U.u_time,       time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      const c1 = hex2rgb(params.color1 as string);
      const c2 = hex2rgb(params.color2 as string);
      const c3 = hex2rgb(params.color3 as string);
      const c4 = hex2rgb(params.color4 as string);
      gl.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
      gl.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);

      gl.uniform1f(U.u_bgScale,   params.bgScale  as number);
      gl.uniform1f(U.u_drift,     params.drift    as number);
      gl.uniform1f(U.u_waveAmp,   params.waveAmp  as number);

      gl.uniform1f(
        U.u_effectMode,
        EFFECT_MODES[(params.effectMode as string) ?? 'dither'] ?? 1,
      );
      gl.uniform1f(U.u_effectMix,   params.effectMix   as number);
      gl.uniform1f(U.u_ditherCell,  params.ditherCell  as number);
      gl.uniform1f(U.u_chromatic,   params.chromatic   as number);
      gl.uniform1f(U.u_glow,        params.glow        as number);
      gl.uniform1f(U.u_grainAmount, params.grainAmount as number);
      gl.uniform1f(U.u_vignette,    params.vignette    as number);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.uniform1i(U.u_text, 0);

      quad.bind(prog);
      quad.draw();
    },

    resize() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      requestPaint();
    },

    dispose() {
      canvas.removeEventListener('paint', handlePaint as EventListener);
      htmlScene.dispose();
      canvas.removeAttribute('layoutsubtree');
      gl.deleteTexture(textTexture);
      gl.deleteProgram(prog);
      quad.dispose();
    },
  };
}

export const htmlInCanvas1Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
