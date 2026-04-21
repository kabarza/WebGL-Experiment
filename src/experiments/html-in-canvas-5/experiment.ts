// ============================================================
// html-in-canvas 5 — Three.js + html-in-canvas beta API
// Aurora drift background, real DOM text with WebGL effects
// Controls via lil-gui (no DialKit)
// ============================================================

import * as THREE from 'three';
import GUI from 'lil-gui';
import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import fragGLSL from './shader.glsl';

// ── html-in-canvas type augmentations ─────────────────────────

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

// ── Constants ─────────────────────────────────────────────────

const VERT = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const EFFECT_MODES: Record<string, number> = {
  clean: 0,
  dither: 1,
  scanline: 2,
  ghost: 3,
  pixelate: 4,
  glitch: 5,
  halftone: 6,
  wave: 7,
};

// ── Helpers ───────────────────────────────────────────────────

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

// ── HTML scene (real DOM inside the canvas) ───────────────────

function createHtmlScene(canvas: HTMLCanvasElement) {
  const root = document.createElement('section');
  const heading = document.createElement('h1');
  const copy = document.createElement('p');

  root.dataset.experimentCanvasHtml = 'html-in-canvas-5';
  heading.textContent = 'Canvas Meets DOM';
  copy.textContent =
    'Select this text. It lives inside a <canvas> as real DOM, piped through Three.js shaders in real time. Aurora drifts behind, grain settles on top.';

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

// ── lil-gui setup ─────────────────────────────────────────────

function createGui(params: Record<string, unknown>): GUI {
  const gui = new GUI({ title: 'html-in-canvas 5' });

  const aurora = gui.addFolder('Aurora');
  aurora.addColor(params, 'color1').name('Color 1');
  aurora.addColor(params, 'color2').name('Color 2');
  aurora.addColor(params, 'color3').name('Color 3');
  aurora.addColor(params, 'color4').name('Color 4');
  aurora.add(params, 'bgScale', 0.3, 2.5, 0.01).name('BG Scale');
  aurora.add(params, 'drift', 0, 1.6, 0.01).name('Drift');
  aurora.add(params, 'waveAmount', 0, 1.2, 0.01).name('Wave');

  const fx = gui.addFolder('Effects');
  fx.add(params, 'effectMode', Object.keys(EFFECT_MODES)).name('Mode');
  fx.add(params, 'effectMix', 0, 1, 0.01).name('Mix');
  fx.add(params, 'ditherCell', 2, 20, 0.5).name('Dither Cell');
  fx.add(params, 'chromatic', 0, 3, 0.01).name('Chromatic');
  fx.add(params, 'textDistortion', 0, 1.2, 0.01).name('Distortion');
  fx.add(params, 'glow', 0, 1.5, 0.01).name('Glow');
  fx.add(params, 'pixelSize', 2, 32, 1).name('Pixel Size');
  fx.add(params, 'glitchIntensity', 0, 2, 0.01).name('Glitch');

  const surface = gui.addFolder('Surface');
  surface.add(params, 'grainAmount', 0, 0.16, 0.001).name('Grain');
  surface.add(params, 'vignette', 0, 0.8, 0.01).name('Vignette');

  const anim = gui.addFolder('Animation');
  anim.add(params, 'speed', 0, 4, 0.01).name('Speed');
  anim.add(params, 'paused').name('Paused');

  return gui;
}

// ── Fullscreen triangle (non-indexed — avoids drawElements) ───
//
// A single oversized triangle covers the entire viewport.
// Uses drawArrays(TRIANGLES, 0, 3) instead of drawElements,
// which avoids element-array-buffer binding issues when Three.js
// shares a GL context with the framework's renderer.

function createFullscreenTriangle(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  // Positions: one big triangle covering clip space [-1..1]
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
      3,
    ),
  );
  // UVs: [0,0]..[2,0]..[0,2] — the visible [0,1] region maps to the viewport
  geometry.setAttribute(
    'uv',
    new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2),
  );
  return geometry;
}

// ── Experiment init ───────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;
  const hicCanvas = canvas as HTMLCanvasElementHIC;
  const hicGL = gl as WebGL2RenderingContextHIC;

  if (!('texElementImage2D' in gl) || !('requestPaint' in canvas)) {
    throw new Error(
      'html-in-canvas 5 needs Chrome Canary with chrome://flags/#canvas-draw-element enabled.',
    );
  }

  // Set layoutsubtree before anything else
  canvas.setAttribute('layoutsubtree', '');

  // ── HTML scene ────────────────────────────────────────────
  const htmlScene = createHtmlScene(canvas);

  // ── Three.js renderer ─────────────────────────────────────
  // Let Three.js discover the existing WebGL2 context from the
  // canvas rather than passing it explicitly. This avoids some
  // internal-state initialisation mismatches.
  const threeRenderer = new THREE.WebGLRenderer({ canvas });
  threeRenderer.autoClear = true;

  // ── Scene & camera ────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ── Uniforms ──────────────────────────────────────────────
  const U = {
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
    u_text: { value: null as THREE.Texture | null },
    u_color1: { value: new THREE.Vector3() },
    u_color2: { value: new THREE.Vector3() },
    u_color3: { value: new THREE.Vector3() },
    u_color4: { value: new THREE.Vector3() },
    u_bgScale: { value: 1.0 },
    u_drift: { value: 0.65 },
    u_waveAmount: { value: 0.48 },
    u_effectMode: { value: 1 },
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

  // ── Material & fullscreen triangle ────────────────────────
  const material = new THREE.RawShaderMaterial({
    vertexShader: VERT,
    fragmentShader: fragGLSL,
    uniforms: U,
    depthTest: false,
    depthWrite: false,
  });

  const geometry = createFullscreenTriangle();
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // ── Text texture ──────────────────────────────────────────
  //
  // Create a raw GL texture that we manage ourselves via the
  // html-in-canvas texElementImage2D API. A companion Three.js
  // DataTexture lets us plug it into the uniform system; after
  // the first render we swap Three.js's auto-generated GL handle
  // with our manually-managed one.

  const glTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, glTex);
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

  const textTexture = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 0]),
    1,
    1,
    THREE.RGBAFormat,
  );
  textTexture.minFilter = THREE.LinearFilter;
  textTexture.magFilter = THREE.LinearFilter;
  textTexture.wrapS = THREE.ClampToEdgeWrapping;
  textTexture.wrapT = THREE.ClampToEdgeWrapping;
  textTexture.generateMipmaps = false;
  textTexture.needsUpdate = true;
  U.u_text.value = textTexture;

  // ── html-in-canvas paint cycle ────────────────────────────

  let textureReady = false;
  let pendingPaint = false;
  let lastPaintTick = -1;
  let textureInjected = false;

  const handlePaint = () => {
    // Ensure layoutsubtree is present (defensive — React StrictMode
    // unmount/remount or Three.js init may have stripped it).
    if (!canvas.hasAttribute('layoutsubtree')) {
      canvas.setAttribute('layoutsubtree', '');
    }

    const target = textureInjected ? glTex : null;
    if (!target) {
      pendingPaint = false;
      return;
    }

    try {
      gl.bindTexture(gl.TEXTURE_2D, target);
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
      // texElementImage2D can throw if the element isn't laid out yet;
      // we'll retry on the next paint cycle.
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

  // Kick off the first paint after layout settles
  requestAnimationFrame(() =>
    requestAnimationFrame(() => doRequestPaint()),
  );

  // ── lil-gui ───────────────────────────────────────────────
  const gui = createGui(params);

  // ── Experiment instance ───────────────────────────────────

  return {
    render(time: number) {
      // After the first Three.js render, the DataTexture gets a GL
      // handle. Swap it with our manually-managed html-in-canvas
      // texture so future binds use the live DOM snapshot.
      if (!textureInjected) {
        const props = (
          threeRenderer as unknown as {
            properties: { get(t: THREE.Texture): Record<string, unknown> };
          }
        ).properties.get(textTexture);
        if (props?.__webglTexture) {
          gl.deleteTexture(props.__webglTexture as WebGLTexture);
          props.__webglTexture = glTex;
          textureInjected = true;
          // Request paint now that the texture is wired up
          doRequestPaint();
        }
      }

      // Keep requesting paint until the HTML snapshot lands
      if (!textureReady) {
        const tick = Math.floor(time * 4.0);
        if (tick !== lastPaintTick) {
          lastPaintTick = tick;
          doRequestPaint();
        }
      }

      // Sync uniforms from live params
      U.u_time.value = time;

      const c1 = hex2rgb(params.color1 as string);
      const c2 = hex2rgb(params.color2 as string);
      const c3 = hex2rgb(params.color3 as string);
      const c4 = hex2rgb(params.color4 as string);
      U.u_color1.value.set(c1[0], c1[1], c1[2]);
      U.u_color2.value.set(c2[0], c2[1], c2[2]);
      U.u_color3.value.set(c3[0], c3[1], c3[2]);
      U.u_color4.value.set(c4[0], c4[1], c4[2]);

      U.u_bgScale.value = params.bgScale as number;
      U.u_drift.value = params.drift as number;
      U.u_waveAmount.value = params.waveAmount as number;
      U.u_effectMode.value =
        EFFECT_MODES[(params.effectMode as string) ?? 'clean'] ?? 0;
      U.u_effectMix.value = params.effectMix as number;
      U.u_ditherCell.value = params.ditherCell as number;
      U.u_chromatic.value = params.chromatic as number;
      U.u_textDistortion.value = params.textDistortion as number;
      U.u_glow.value = params.glow as number;
      U.u_pixelSize.value = params.pixelSize as number;
      U.u_glitchIntensity.value = params.glitchIntensity as number;
      U.u_grainAmount.value = params.grainAmount as number;
      U.u_vignette.value = params.vignette as number;

      // Reset Three.js's GL state cache before rendering so it
      // re-binds everything cleanly (needed when sharing a context
      // with the framework's renderer).
      threeRenderer.resetState();
      threeRenderer.render(scene, camera);
    },

    resize(width: number, height: number, dpr: number) {
      threeRenderer.setPixelRatio(dpr);
      threeRenderer.setSize(width / dpr, height / dpr, false);
      U.u_resolution.value.set(width, height);
      doRequestPaint();
    },

    dispose() {
      gui.destroy();
      canvas.removeEventListener('paint', handlePaint as EventListener);
      htmlScene.dispose();
      canvas.removeAttribute('layoutsubtree');
      gl.deleteTexture(glTex);
      textTexture.dispose();
      material.dispose();
      geometry.dispose();
      threeRenderer.dispose();
    },
  };
}

export const htmlInCanvas5Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
