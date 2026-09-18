// ============================================================
// Flare-4 — WebGL2 Experiment
// Layered composite: Aurora + Image + Circle + Film Grain
// with z-order reordering and image texture upload.
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
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

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

  // ── Uniform locations ──
  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time', 'u_resolution', 'u_bgColor',
    // Layer Order
    'u_orderAurora', 'u_orderImage', 'u_orderCircle', 'u_orderGrain',
    // Aurora
    'u_auroraOn', 'u_auroraOpacity',
    'u_color1', 'u_color2', 'u_color3', 'u_color4',
    'u_warpStrength', 'u_warpScale', 'u_warpSpeed',
    'u_blobSize', 'u_blobSpacing', 'u_blobRotation', 'u_blobSpread',
    'u_blobOffsetX', 'u_blobOffsetY', 'u_tileSpacing',
    'u_zoom', 'u_auroraOffsetX', 'u_auroraOffsetY',
    // Image
    'u_imageOn', 'u_imageOpacity', 'u_image', 'u_imageLoaded',
    'u_imageScale', 'u_imageOffsetX', 'u_imageOffsetY', 'u_imageAspect',
    // Circle
    'u_circleOn', 'u_circleOpacity', 'u_circlePos',
    'u_circleRadius', 'u_circleEdge', 'u_circleDensity',
    'u_circleParticleSize', 'u_circleSpeed',
    'u_circleTrail', 'u_circleTwinkle',
    'u_circleColor', 'u_circleGlow',
    // Grain
    'u_grainOn', 'u_grainAmount', 'u_grainSize', 'u_grainSpeed',
    // Post
    'u_brightness', 'u_contrast', 'u_saturation',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // ── Image texture ──
  const imageTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, imageTexture);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
    gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let imageLoaded = false;
  let imageAspect = 1.0;
  let lastImageElement: HTMLImageElement | null = null;

  // ── Action / reset state ──
  let lastActionTs = 0;
  let lastResetTs = 0;

  function clearImageTexture() {
    gl.bindTexture(gl.TEXTURE_2D, imageTexture);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    imageLoaded = false;
    lastImageElement = null;
  }

  return {
    render(time: number, _deltaTime: number) {
      const P = params;
      gl.useProgram(prog);

      // ── Handle actions (image upload / remove) ──
      const actionTs = P._actionTs as number | undefined;
      if (actionTs && actionTs !== lastActionTs) {
        lastActionTs = actionTs;
        const action = P._action as string;

        if (action === 'Image.Upload Image') {
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.onchange = () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const img = new Image();
            img.onload = () => { P._imageElement = img; };
            img.src = URL.createObjectURL(file);
          };
          fileInput.click();
        } else if (action === 'Image.Remove Image') {
          P._imageElement = null;
          clearImageTexture();
        }
      }

      // ── Handle reset ──
      const resetTs = P._resetTs as number | undefined;
      if (resetTs && resetTs !== lastResetTs) {
        lastResetTs = resetTs;
        P._imageElement = null;
        clearImageTexture();
      }

      // ── Upload image texture when it changes ──
      const imgEl = P._imageElement as HTMLImageElement | null;
      if (imgEl && imgEl !== lastImageElement) {
        lastImageElement = imgEl;
        imageAspect = imgEl.naturalWidth / imgEl.naturalHeight;
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA,
          gl.RGBA, gl.UNSIGNED_BYTE, imgEl,
        );
        imageLoaded = true;
      }

      // ── Set uniforms ──
      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

      // Layer Order
      gl.uniform1f(U.u_orderAurora, P.auroraOrder as number);
      gl.uniform1f(U.u_orderImage, P.imageOrder as number);
      gl.uniform1f(U.u_orderCircle, P.circleOrder as number);
      gl.uniform1f(U.u_orderGrain, P.grainOrder as number);

      // ── Aurora ──
      gl.uniform1f(U.u_auroraOn, P.auroraOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_auroraOpacity, P.auroraOpacity as number);

      const c1 = hex2rgb(P.color1 as string);
      const c2 = hex2rgb(P.color2 as string);
      const c3 = hex2rgb(P.color3 as string);
      const c4 = hex2rgb(P.color4 as string);
      gl.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
      gl.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);

      gl.uniform1f(U.u_warpStrength, P.warpStrength as number);
      gl.uniform1f(U.u_warpScale, P.warpScale as number);
      gl.uniform1f(U.u_warpSpeed, P.warpSpeed as number);

      gl.uniform1f(U.u_blobSize, P.blobSize as number);
      gl.uniform1f(U.u_blobSpacing, P.blobSpacing as number);
      gl.uniform1f(U.u_blobRotation, P.blobRotation as number);
      gl.uniform1f(U.u_blobSpread, P.blobSpread as number);
      gl.uniform1f(U.u_blobOffsetX, P.blobOffsetX as number);
      gl.uniform1f(U.u_blobOffsetY, P.blobOffsetY as number);
      gl.uniform1f(U.u_tileSpacing, P.tileSpacing as number);

      gl.uniform1f(U.u_zoom, P.zoom as number);
      gl.uniform1f(U.u_auroraOffsetX, P.auroraOffsetX as number);
      gl.uniform1f(U.u_auroraOffsetY, P.auroraOffsetY as number);

      // ── Image ──
      gl.uniform1f(U.u_imageOn, P.imageOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_imageOpacity, P.imageOpacity as number);
      gl.uniform1f(U.u_imageLoaded, imageLoaded ? 1.0 : 0.0);
      gl.uniform1f(U.u_imageScale, P.imageScale as number);
      gl.uniform1f(U.u_imageOffsetX, P.imageOffsetX as number);
      gl.uniform1f(U.u_imageOffsetY, P.imageOffsetY as number);
      gl.uniform1f(U.u_imageAspect, imageAspect);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imageTexture);
      gl.uniform1i(U.u_image, 0);

      // ── Circle ──
      gl.uniform1f(U.u_circleOn, P.circleOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_circleOpacity, P.circleOpacity as number);
      gl.uniform2f(U.u_circlePos, P.circleX as number, P.circleY as number);
      gl.uniform1f(U.u_circleRadius, P.circleRadius as number);
      gl.uniform1f(U.u_circleEdge, P.circleEdge as number);
      gl.uniform1f(U.u_circleDensity, P.circleDensity as number);
      gl.uniform1f(U.u_circleParticleSize, P.circleParticleSize as number);
      gl.uniform1f(U.u_circleSpeed, P.circleSpeed as number);
      gl.uniform1f(U.u_circleTrail, P.circleTrail as number);
      gl.uniform1f(U.u_circleTwinkle, P.circleTwinkle as number);
      gl.uniform1f(U.u_circleGlow, P.circleGlow as number);

      const cc = hex2rgb(P.circleColor as string);
      gl.uniform3f(U.u_circleColor, cc[0], cc[1], cc[2]);

      // ── Grain ──
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainSize, P.grainSize as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

      // ── Post ──
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_saturation, P.saturation as number);

      quad.bind(prog);
      quad.draw();
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    dispose() {
      gl.deleteProgram(prog);
      gl.deleteTexture(imageTexture);
      quad.dispose();
    },
  };
}

export const flare4Experiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
