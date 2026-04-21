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

const EFFECT_MODES: Record<string, number> = {
  clean: 0,
  dither: 1,
  scanline: 2,
  ghost: 3,
};

function mkShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function hex2rgb(h: string): [number, number, number] {
  const hex = h.startsWith('#') ? h.slice(1) : h;
  return [
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

function setStyles(el: HTMLElement, styles: Record<string, string>) {
  for (const [key, value] of Object.entries(styles)) {
    el.style.setProperty(key, value);
  }
}

function createHtmlScene(canvas: HTMLCanvasElement) {
  const root = document.createElement('section');
  const heading = document.createElement('h1');
  const copy = document.createElement('p');

  root.dataset.experimentCanvasHtml = 'html-in-canvas-2';
  heading.textContent = 'HTML-in-Canvas 2';
  copy.textContent =
    'Selectable canvas typography, laid out as real DOM, then piped through texElementImage2D for live WebGL filtering.';

  setStyles(root, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    'flex-direction': 'column',
    'justify-content': 'center',
    gap: '18px',
    padding: 'clamp(28px, 6vw, 80px)',
    'box-sizing': 'border-box',
    background: 'transparent',
    color: '#ffffff',
    'pointer-events': 'auto',
    'user-select': 'text',
    'text-rendering': 'geometricPrecision',
    '-webkit-user-select': 'text',
  });

  setStyles(heading, {
    margin: '0',
    'max-width': '10ch',
    'font-family': '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    'font-size': 'clamp(72px, 11vw, 182px)',
    'font-weight': '700',
    'line-height': '0.9',
    'letter-spacing': '0',
    'text-wrap': 'balance',
    color: 'rgba(255, 255, 255, 0.98)',
  });

  setStyles(copy, {
    margin: '0',
    'max-width': '44ch',
    'font-family': '"Avenir Next", "Segoe UI", sans-serif',
    'font-size': 'clamp(16px, 2vw, 24px)',
    'line-height': '1.45',
    'letter-spacing': '0',
    color: 'rgba(255, 255, 255, 0.8)',
    'text-wrap': 'pretty',
  });

  root.append(heading, copy);
  canvas.appendChild(root);

  return {
    root,
    dispose() {
      root.remove();
    },
  };
}

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;
  const hicCanvas = canvas as HTMLCanvasElementHIC;
  const hicGL = gl as WebGL2RenderingContextHIC;

  if (!('texElementImage2D' in gl) || !('requestPaint' in canvas)) {
    throw new Error(
      'html-in-canvas 2 needs Chrome Canary with chrome://flags/#canvas-draw-element enabled.',
    );
  }

  canvas.setAttribute('layoutsubtree', '');

  const htmlScene = createHtmlScene(canvas);

  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }

  const quad = new FullscreenQuadGL(gl);

  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time',
    'u_resolution',
    'u_text',
    'u_color1',
    'u_color2',
    'u_color3',
    'u_color4',
    'u_bgScale',
    'u_drift',
    'u_waveAmount',
    'u_effectMode',
    'u_effectMix',
    'u_ditherCell',
    'u_chromatic',
    'u_textDistortion',
    'u_glow',
    'u_grainAmount',
    'u_vignette',
  ];
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(prog, name);
  }

  const textTexture = gl.createTexture();
  if (!textTexture) throw new Error('Failed to create text texture');

  gl.bindTexture(gl.TEXTURE_2D, textTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_2D, null);

  let textureReady = false;
  let pendingPaint = false;
  let lastPaintTick = -1;

  const handlePaint = () => {
    if (!canvas.hasAttribute('layoutsubtree')) {
      canvas.setAttribute('layoutsubtree', '');
    }
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
      console.warn('[html-in-canvas-2] texElementImage2D error (retrying):', e);
    }
    pendingPaint = false;
  };

  canvas.addEventListener('paint', handlePaint as EventListener);

  function doRequestPaint() {
    if (pendingPaint) return;
    pendingPaint = true;
    hicCanvas.requestPaint();
  }

  requestAnimationFrame(() =>
    requestAnimationFrame(() => doRequestPaint()),
  );

  return {
    render(time: number) {
      if (!textureReady) {
        const tick = Math.floor(time * 4.0);
        if (tick !== lastPaintTick) {
          lastPaintTick = tick;
          doRequestPaint();
        }
      }

      gl.useProgram(prog);

      gl.uniform1f(uniforms.u_time, time);
      gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);

      const c1 = hex2rgb(params.color1 as string);
      const c2 = hex2rgb(params.color2 as string);
      const c3 = hex2rgb(params.color3 as string);
      const c4 = hex2rgb(params.color4 as string);
      gl.uniform3f(uniforms.u_color1, c1[0], c1[1], c1[2]);
      gl.uniform3f(uniforms.u_color2, c2[0], c2[1], c2[2]);
      gl.uniform3f(uniforms.u_color3, c3[0], c3[1], c3[2]);
      gl.uniform3f(uniforms.u_color4, c4[0], c4[1], c4[2]);

      gl.uniform1f(uniforms.u_bgScale, params.bgScale as number);
      gl.uniform1f(uniforms.u_drift, params.drift as number);
      gl.uniform1f(uniforms.u_waveAmount, params.waveAmount as number);
      gl.uniform1f(
        uniforms.u_effectMode,
        EFFECT_MODES[(params.effectMode as string) ?? 'clean'] ?? 0,
      );
      gl.uniform1f(uniforms.u_effectMix, params.effectMix as number);
      gl.uniform1f(uniforms.u_ditherCell, params.ditherCell as number);
      gl.uniform1f(uniforms.u_chromatic, params.chromatic as number);
      gl.uniform1f(uniforms.u_textDistortion, params.textDistortion as number);
      gl.uniform1f(uniforms.u_glow, params.glow as number);
      gl.uniform1f(uniforms.u_grainAmount, params.grainAmount as number);
      gl.uniform1f(uniforms.u_vignette, params.vignette as number);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textTexture);
      gl.uniform1i(uniforms.u_text, 0);

      quad.bind(prog);
      quad.draw();
    },

    resize() {
      gl.viewport(0, 0, canvas.width, canvas.height);
      textureReady = false;
      doRequestPaint();
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

export const htmlInCanvas2Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
