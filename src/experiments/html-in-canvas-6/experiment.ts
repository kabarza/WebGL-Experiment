// ============================================================
// html-in-canvas 6 — Three.js + html-in-canvas beta API
// Aurora drift background, real DOM text with WebGL effects
// ============================================================

import * as THREE from 'three';
import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import fragGLSL from './shader.glsl';

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

const VERTEX_SHADER = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

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

  root.dataset.experimentCanvasHtml = 'html-in-canvas-6';
  heading.textContent = 'Rendered in Canvas';
  copy.textContent =
    'This is real HTML — selectable, accessible — rendered through WebGL via the html-in-canvas API and Three.js. Aurora drifts behind, grain settles on top.';

  setStyles(root, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    'flex-direction': 'column',
    'justify-content': 'center',
    gap: '20px',
    padding: 'clamp(32px, 6vw, 80px)',
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
    'letter-spacing': '0',
    color: 'rgba(255, 255, 255, 0.78)',
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
      'html-in-canvas 6 needs Chrome Canary with chrome://flags/#canvas-draw-element enabled.',
    );
  }

  // Set layoutsubtree FIRST — before appending children or any GL ops
  canvas.setAttribute('layoutsubtree', '');

  const htmlScene = createHtmlScene(canvas);

  // ── Three.js setup ─────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.autoClear = true;

  // Re-assert layoutsubtree after setSize (canvas.width assignment resets state)
  canvas.setAttribute('layoutsubtree', '');

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ── Text texture ───────────────────────────────────────
  // Three.js allocates textures with texStorage2D (immutable), but
  // texElementImage2D needs texImage2D (mutable). So we create a raw
  // GL texture and inject it into Three.js's property store.
  const textTex = new THREE.Texture();
  textTex.minFilter = THREE.LinearFilter;
  textTex.magFilter = THREE.LinearFilter;
  textTex.generateMipmaps = false;
  // Keep version at 0 — prevents Three.js from uploading/overwriting

  const rawGLTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, rawGLTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  // Mutable storage — texElementImage2D can reallocate
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.bindTexture(gl.TEXTURE_2D, null);

  // Inject raw texture into Three.js so it binds it for u_text
  const texProps = renderer.properties.get(textTex) as Record<string, unknown>;
  texProps.__webglTexture = rawGLTexture;
  texProps.__webglInit = true;

  const uniforms = {
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
    u_text: { value: textTex },
    u_color1: { value: new THREE.Color() },
    u_color2: { value: new THREE.Color() },
    u_color3: { value: new THREE.Color() },
    u_color4: { value: new THREE.Color() },
    u_bgScale: { value: 1.0 },
    u_drift: { value: 0.6 },
    u_waveAmount: { value: 0.5 },
    u_effectMode: { value: 0 },
    u_effectMix: { value: 0.85 },
    u_ditherCell: { value: 5 },
    u_chromatic: { value: 0.7 },
    u_textDistortion: { value: 0.3 },
    u_glow: { value: 0.7 },
    u_pixelSize: { value: 8 },
    u_glitchIntensity: { value: 0.6 },
    u_grainAmount: { value: 0.04 },
    u_vignette: { value: 0.2 },
  };

  const material = new THREE.RawShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: fragGLSL,
    uniforms,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
  });

  // Non-indexed geometry avoids glDrawElements issues after resetState
  const geom = new THREE.BufferGeometry();
  // prettier-ignore
  geom.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, -1, 0,   1, -1, 0,  -1, 1, 0,
    -1,  1, 0,   1, -1, 0,   1, 1, 0,
  ], 3));
  // prettier-ignore
  geom.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0,  1, 0,  0, 1,
    0, 1,  1, 0,  1, 1,
  ], 2));

  const quad = new THREE.Mesh(geom, material);
  scene.add(quad);

  // ── html-in-canvas paint lifecycle ─────────────────────
  let textureReady = false;
  let pendingPaintRequest = false;
  let lastPaintTick = -1;

  const handlePaint = () => {
    gl.bindTexture(gl.TEXTURE_2D, rawGLTexture);
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
    pendingPaintRequest = false;
  };

  canvas.addEventListener('paint', handlePaint as EventListener);

  function requestPaint() {
    if (pendingPaintRequest) return;
    pendingPaintRequest = true;
    hicCanvas.requestPaint();
  }

  requestAnimationFrame(() => requestPaint());

  return {
    render(time: number) {
      if (!textureReady) {
        const nowTick = Math.floor(time * 4.0);
        if (nowTick !== lastPaintTick) {
          lastPaintTick = nowTick;
          requestPaint();
        }
      }

      // Sync uniforms from params
      const P = params;
      uniforms.u_time.value = time;
      uniforms.u_resolution.value.set(canvas.width, canvas.height);

      const c1 = hex2rgb(P.color1 as string);
      const c2 = hex2rgb(P.color2 as string);
      const c3 = hex2rgb(P.color3 as string);
      const c4 = hex2rgb(P.color4 as string);
      uniforms.u_color1.value.setRGB(c1[0], c1[1], c1[2]);
      uniforms.u_color2.value.setRGB(c2[0], c2[1], c2[2]);
      uniforms.u_color3.value.setRGB(c3[0], c3[1], c3[2]);
      uniforms.u_color4.value.setRGB(c4[0], c4[1], c4[2]);

      uniforms.u_bgScale.value = P.bgScale as number;
      uniforms.u_drift.value = P.drift as number;
      uniforms.u_waveAmount.value = P.waveAmount as number;
      uniforms.u_effectMode.value =
        EFFECT_MODES[(P.effectMode as string) ?? 'clean'] ?? 0;
      uniforms.u_effectMix.value = P.effectMix as number;
      uniforms.u_ditherCell.value = P.ditherCell as number;
      uniforms.u_chromatic.value = P.chromatic as number;
      uniforms.u_textDistortion.value = P.textDistortion as number;
      uniforms.u_glow.value = P.glow as number;
      uniforms.u_pixelSize.value = P.pixelSize as number;
      uniforms.u_glitchIntensity.value = P.glitchIntensity as number;
      uniforms.u_grainAmount.value = P.grainAmount as number;
      uniforms.u_vignette.value = P.vignette as number;

      // Reset Three.js cached state (paint handler modifies GL state
      // between frames) then render
      renderer.resetState();
      renderer.render(scene, camera);
    },

    resize(width: number, height: number) {
      renderer.setSize(width, height, false);
      // Re-assert after setSize — canvas.width assignment can reset state
      canvas.setAttribute('layoutsubtree', '');
      requestPaint();
    },

    dispose() {
      canvas.removeEventListener('paint', handlePaint as EventListener);
      htmlScene.dispose();
      canvas.removeAttribute('layoutsubtree');
      material.dispose();
      geom.dispose();
      gl.deleteTexture(rawGLTexture);
      textTex.dispose();
      renderer.dispose();
    },
  };
}

export const htmlInCanvas6Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
