// ============================================================
// html-in-canvas-3 — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

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
  pixelate: 4,
  glitch: 5,
};

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        color1: '#0a0612',
        color2: '#2d1b69',
        color3: '#8b5cf6',
        color4: '#f472b6',
        bgOn: true,
        bgScale: 1.0,
        drift: 0.65,
        waveAmount: 0.45,
        textFxOn: true,
        effectMode: 'dither',
        effectMix: 0.8,
        ditherCell: 5,
        chromatic: 0.9,
        textDistortion: 0.3,
        glow: 0.7,
        pixelSize: 4,
        grainOn: true,
        grainAmount: 0.04,
        vignette: 0.2,
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

(function () {
  const wrapper = document.querySelector(
    '[data-webgl-experiment="html-in-canvas-3"]',
  );
  if (!wrapper) return;
  const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const hicCanvas = canvas as HTMLCanvasElementHIC;

  if (!('requestPaint' in canvas)) {
    console.error(
      'html-in-canvas-3 needs Chrome Canary with chrome://flags/#canvas-draw-element enabled.',
    );
    return;
  }

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
  }) as WebGL2RenderingContextHIC | null;
  if (!gl) {
    console.error('WebGL2 not available');
    return;
  }

  if (!('texElementImage2D' in gl)) {
    console.error('texElementImage2D not available');
    return;
  }

  canvas.setAttribute('layoutsubtree', '');

  // ── HTML scene ──────────────────────────────────────────
  const root = document.createElement('section');
  const heading = document.createElement('h1');
  const copy = document.createElement('p');

  root.dataset.experimentCanvasHtml = 'html-in-canvas-3';
  heading.textContent = 'Infinite Canvas';
  copy.textContent =
    'Live DOM text, rendered through WebGL shaders. Selectable. Copyable. Alive.';

  setStyles(root, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    'flex-direction': 'column',
    'justify-content': 'center',
    gap: '20px',
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
    'max-width': '12ch',
    'font-family':
      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    'font-size': 'clamp(64px, 10vw, 172px)',
    'font-weight': '700',
    'line-height': '0.92',
    'letter-spacing': '-0.02em',
    'text-wrap': 'balance',
    color: 'rgba(255, 255, 255, 0.98)',
  });

  setStyles(copy, {
    margin: '0',
    'max-width': '42ch',
    'font-family': '"Avenir Next", "Segoe UI", sans-serif',
    'font-size': 'clamp(15px, 2vw, 22px)',
    'line-height': '1.5',
    'letter-spacing': '0.01em',
    color: 'rgba(255, 255, 255, 0.78)',
    'text-wrap': 'pretty',
  });

  root.append(heading, copy);
  canvas.appendChild(root);

  // ── Shader program ──────────────────────────────────────
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('WebGL: link error:', gl.getProgramInfoLog(prog));
    return;
  }

  // Fullscreen quad
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Uniform locations
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uText = gl.getUniformLocation(prog, 'u_text');
  const uColor1 = gl.getUniformLocation(prog, 'u_color1');
  const uColor2 = gl.getUniformLocation(prog, 'u_color2');
  const uColor3 = gl.getUniformLocation(prog, 'u_color3');
  const uColor4 = gl.getUniformLocation(prog, 'u_color4');
  const uBgOn = gl.getUniformLocation(prog, 'u_bgOn');
  const uBgScale = gl.getUniformLocation(prog, 'u_bgScale');
  const uDrift = gl.getUniformLocation(prog, 'u_drift');
  const uWaveAmount = gl.getUniformLocation(prog, 'u_waveAmount');
  const uTextFxOn = gl.getUniformLocation(prog, 'u_textFxOn');
  const uEffectMode = gl.getUniformLocation(prog, 'u_effectMode');
  const uEffectMix = gl.getUniformLocation(prog, 'u_effectMix');
  const uDitherCell = gl.getUniformLocation(prog, 'u_ditherCell');
  const uChromatic = gl.getUniformLocation(prog, 'u_chromatic');
  const uTextDistortion = gl.getUniformLocation(prog, 'u_textDistortion');
  const uGlow = gl.getUniformLocation(prog, 'u_glow');
  const uPixelSize = gl.getUniformLocation(prog, 'u_pixelSize');
  const uGrainOn = gl.getUniformLocation(prog, 'u_grainOn');
  const uGrainAmount = gl.getUniformLocation(prog, 'u_grainAmount');
  const uVignette = gl.getUniformLocation(prog, 'u_vignette');

  // Text texture
  const textTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, textTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.bindTexture(gl.TEXTURE_2D, null);

  let textureReady = false;
  let pendingPaint = false;
  let lastPaintTick = -1;

  const handlePaint = () => {
    if (!canvas!.hasAttribute('layoutsubtree')) {
      canvas!.setAttribute('layoutsubtree', '');
    }
    try {
      gl!.bindTexture(gl!.TEXTURE_2D, textTexture);
      gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
      gl!.texElementImage2D(
        gl!.TEXTURE_2D,
        0,
        gl!.RGBA,
        gl!.RGBA,
        gl!.UNSIGNED_BYTE,
        root,
      );
      gl!.bindTexture(gl!.TEXTURE_2D, null);
      textureReady = true;
    } catch (e) {
      console.warn('texElementImage2D:', e);
    }
    pendingPaint = false;
  };

  canvas.addEventListener('paint', handlePaint as EventListener);

  function doRequestPaint() {
    if (pendingPaint) return;
    pendingPaint = true;
    hicCanvas.requestPaint();
  }

  // Wait two frames for layout to settle
  requestAnimationFrame(() =>
    requestAnimationFrame(() => doRequestPaint()),
  );

  // ── Resize ──────────────────────────────────────────────
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas!.getBoundingClientRect();
    canvas!.width = Math.floor(rect.width * dpr);
    canvas!.height = Math.floor(rect.height * dpr);
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
    doRequestPaint();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ── Render loop ─────────────────────────────────────────
  const BP = BAKED_PARAMS;
  let accTime = 0;
  let lastTime = performance.now();

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt;

    if (!textureReady) {
      const nowTick = Math.floor(accTime * 4.0);
      if (nowTick !== lastPaintTick) {
        lastPaintTick = nowTick;
        doRequestPaint();
      }
    }

    gl!.useProgram(prog);
    gl!.uniform1f(uTime, accTime);
    gl!.uniform2f(uRes, canvas!.width, canvas!.height);

    const c1 = hex2rgb(BP.color1 as string);
    const c2 = hex2rgb(BP.color2 as string);
    const c3 = hex2rgb(BP.color3 as string);
    const c4 = hex2rgb(BP.color4 as string);
    gl!.uniform3f(uColor1, c1[0], c1[1], c1[2]);
    gl!.uniform3f(uColor2, c2[0], c2[1], c2[2]);
    gl!.uniform3f(uColor3, c3[0], c3[1], c3[2]);
    gl!.uniform3f(uColor4, c4[0], c4[1], c4[2]);

    gl!.uniform1f(uBgOn, BP.bgOn ? 1.0 : 0.0);
    gl!.uniform1f(uBgScale, BP.bgScale as number);
    gl!.uniform1f(uDrift, BP.drift as number);
    gl!.uniform1f(uWaveAmount, BP.waveAmount as number);

    gl!.uniform1f(uTextFxOn, BP.textFxOn ? 1.0 : 0.0);
    gl!.uniform1f(
      uEffectMode,
      EFFECT_MODES[(BP.effectMode as string) ?? 'clean'] ?? 0,
    );
    gl!.uniform1f(uEffectMix, BP.effectMix as number);
    gl!.uniform1f(uDitherCell, BP.ditherCell as number);
    gl!.uniform1f(uChromatic, BP.chromatic as number);
    gl!.uniform1f(uTextDistortion, BP.textDistortion as number);
    gl!.uniform1f(uGlow, BP.glow as number);
    gl!.uniform1f(uPixelSize, BP.pixelSize as number);

    gl!.uniform1f(uGrainOn, BP.grainOn ? 1.0 : 0.0);
    gl!.uniform1f(uGrainAmount, BP.grainAmount as number);
    gl!.uniform1f(uVignette, BP.vignette as number);

    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, textTexture);
    gl!.uniform1i(uText, 0);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
