// ============================================================
// aurora drift — WebGL2 Experiment
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
  const { gl, canvas, params, input } = ctx;

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
    'u_color1', 'u_color2', 'u_color3', 'u_color4',
    'u_warpOn', 'u_warpStrength', 'u_warpScale', 'u_seed',
    'u_blobOn', 'u_blobSize', 'u_blobSpacing', 'u_blobRotation',
    'u_blobSpread', 'u_blobOffsetX', 'u_blobOffsetY', 'u_tileSpacing',
    'u_zoom', 'u_offsetX', 'u_offsetY',
    'u_grainOn', 'u_grainAmount', 'u_grainScale',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // Mouse → displacement/seed smoothing
  let smoothDisp = params.warpStrength as number;
  let smoothSeed = params.seed as number;

  return {
    render(time: number, _deltaTime: number) {
      const P = params;
      gl.useProgram(prog);

      // Mouse modulates warpStrength and seed (like the reference)
      const mouseOn = P.mouseOn as boolean;
      const defaultDisp = P.warpStrength as number;
      const defaultSeed = P.seed as number;

      if (mouseOn && input.isOver) {
        // X → displacement (0–5), Y → seed (-1 to 1)
        smoothDisp += (input.mouse.x * 5.0 - smoothDisp) * 0.1;
        smoothSeed += ((input.mouse.y * 2.0 - 1.0) - smoothSeed) * 0.1;
      } else {
        smoothDisp += (defaultDisp - smoothDisp) * 0.1;
        smoothSeed += (defaultSeed - smoothSeed) * 0.1;
      }

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      // Colors
      const c1 = hex2rgb(P.color1 as string);
      const c2 = hex2rgb(P.color2 as string);
      const c3 = hex2rgb(P.color3 as string);
      const c4 = hex2rgb(P.color4 as string);
      gl.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
      gl.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);

      // Warp (displacement driven by smoothed mouse)
      gl.uniform1f(U.u_warpOn, P.warpOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_warpStrength, smoothDisp);
      gl.uniform1f(U.u_warpScale, P.warpScale as number);
      gl.uniform1f(U.u_seed, smoothSeed);

      // Blobs
      gl.uniform1f(U.u_blobOn, P.blobOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_blobSize, P.blobSize as number);
      gl.uniform1f(U.u_blobSpacing, P.blobSpacing as number);
      gl.uniform1f(U.u_blobRotation, P.blobRotation as number);
      gl.uniform1f(U.u_blobSpread, P.blobSpread as number);
      gl.uniform1f(U.u_blobOffsetX, P.blobOffsetX as number);
      gl.uniform1f(U.u_blobOffsetY, P.blobOffsetY as number);
      gl.uniform1f(U.u_tileSpacing, P.tileSpacing as number);

      // Transform
      gl.uniform1f(U.u_zoom, P.zoom as number);
      gl.uniform1f(U.u_offsetX, P.offsetX as number);
      gl.uniform1f(U.u_offsetY, P.offsetY as number);

      // Grain
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainScale, P.grainScale as number);

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

export const auroraDriftExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
