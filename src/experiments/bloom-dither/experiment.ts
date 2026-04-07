// ============================================================
// Bloom Dither — WebGL2 Experiment
// Generative cherry blossom branches with halftone dithering
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

  // Uniform locations
  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time', 'u_resolution',
    // Layer toggles
    'u_branchOn', 'u_flowerOn', 'u_glowOn', 'u_ditherOn',
    // Branches
    'u_branchScale', 'u_branchThickness', 'u_branchColor',
    // Flowers
    'u_flowerSize', 'u_flowerColor', 'u_petalCount',
    // Glow
    'u_glowIntensity', 'u_glowColor', 'u_glowRadius',
    // Dither
    'u_ditherSize',
    // General
    'u_progress', 'u_seed', 'u_bgColor',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  let autoProgress = params.progress as number;

  return {
    render(time: number, deltaTime: number) {
      const P = params;
      gl.useProgram(prog);

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      // Layer toggles
      gl.uniform1f(U.u_branchOn, P.branchOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_flowerOn, P.flowerOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_glowOn, P.glowOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_ditherOn, P.ditherOn ? 1.0 : 0.0);

      // Branches
      gl.uniform1f(U.u_branchScale, P.branchScale as number);
      gl.uniform1f(U.u_branchThickness, P.branchThickness as number);
      const bc = hex2rgb(P.branchColor as string);
      gl.uniform3f(U.u_branchColor, bc[0], bc[1], bc[2]);

      // Flowers
      gl.uniform1f(U.u_flowerSize, P.flowerSize as number);
      const fc = hex2rgb(P.flowerColor as string);
      gl.uniform3f(U.u_flowerColor, fc[0], fc[1], fc[2]);
      gl.uniform1f(U.u_petalCount, P.petalCount as number);

      // Glow
      gl.uniform1f(U.u_glowIntensity, P.glowIntensity as number);
      const gc = hex2rgb(P.glowColor as string);
      gl.uniform3f(U.u_glowColor, gc[0], gc[1], gc[2]);
      gl.uniform1f(U.u_glowRadius, P.glowRadius as number);

      // Dither
      gl.uniform1f(U.u_ditherSize, P.ditherSize as number);

      // Animation — autoPlay drives progress from 0→1 over time
      if (P.autoPlay) {
        autoProgress = Math.min(1.0, autoProgress + deltaTime * (P.animSpeed as number));
        gl.uniform1f(U.u_progress, autoProgress);
      } else {
        autoProgress = P.progress as number;
        gl.uniform1f(U.u_progress, P.progress as number);
      }

      gl.uniform1f(U.u_seed, P.seed as number);
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

      quad.bind(prog);
      quad.draw();
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },

    dispose() {
      gl.deleteProgram(prog);
      quad.dispose();
    },
  };
}

export const bloomDitherExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
