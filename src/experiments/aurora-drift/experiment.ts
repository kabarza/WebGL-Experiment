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
import { controls, MOUSE_MODE_ID, type MouseMode } from './params.ts';
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

  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time', 'u_resolution',
    'u_color1', 'u_color2', 'u_color3', 'u_color4', 'u_bgColor',
    'u_warpOn', 'u_warpStrength', 'u_warpScale', 'u_warpOctaves', 'u_seed', 'u_seedSpeed',
    'u_blobOn', 'u_blobSize', 'u_blobSpacing', 'u_blobRotation', 'u_blobSpread',
    'u_blobOffsetX', 'u_blobOffsetY', 'u_tileSpacing',
    'u_blobCount', 'u_blendSoftness', 'u_autoRotation',
    'u_colorShift',
    'u_zoom', 'u_offsetX', 'u_offsetY',
    'u_mouseOn', 'u_mousePos', 'u_mouseWind', 'u_mouseStr', 'u_mouseRadius',
    'u_mouseMode',
    'u_pulsePos', 'u_pulseStr', 'u_pulseAge', 'u_pulseSpeed', 'u_pulseWidth',
    'u_grainOn', 'u_grainAmount', 'u_grainScale', 'u_grainSpeed',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  // Breeze wind vector — accumulates velocity, decays each frame.
  // Lives here (not in JS input) so Breeze can recall recent motion
  // even after the user stops moving.
  let windX = 0;
  let windY = 0;

  // Click pulse state — triggered on pointer-down via isDown edge
  let pulseX = 0.5;
  let pulseY = 0.5;
  let pulseAge = 999;
  let pulseActive = false;
  let prevIsDown = false;
  let lastRenderTime = 0;

  return {
    render(time: number, _deltaTime: number) {
      const P = params;
      gl.useProgram(prog);

      const dt = Math.max(0, Math.min(time - lastRenderTime, 0.1));
      lastRenderTime = time;

      // Breeze — accumulate velocity into a decaying wind vector.
      // Normalized velocity is ~0..0.01 per frame; gain lifts it to visible range.
      const decay = Math.max(0, Math.min(0.995, P.mouseWindDecay as number));
      const gain = (P.mouseWindGain as number) ?? 3.0;
      windX = windX * decay + input.velocity.x * gain;
      windY = windY * decay + input.velocity.y * gain;

      // Click edge → start new pulse
      if (input.isDown && !prevIsDown) {
        pulseX = input.mouse.x;
        pulseY = input.mouse.y;
        pulseAge = 0;
        pulseActive = true;
      }
      prevIsDown = input.isDown;

      let currentPulseStr = 0;
      if (pulseActive) {
        pulseAge += dt;
        const pDecay = Math.max(P.pulseDecay as number, 0.001);
        const life = pulseAge / pDecay;
        if (life >= 1) {
          pulseActive = false;
        } else {
          const fade = 1 - life;
          currentPulseStr = (P.pulseStrength as number) * fade * fade * fade;
        }
      }

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      // Colors
      const c1 = hex2rgb(P.color1 as string);
      const c2 = hex2rgb(P.color2 as string);
      const c3 = hex2rgb(P.color3 as string);
      const c4 = hex2rgb(P.color4 as string);
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
      gl.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      gl.uniform1f(U.u_colorShift, P.colorShift as number);

      // Warp
      gl.uniform1f(U.u_warpOn, P.warpOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_warpStrength, P.warpStrength as number);
      gl.uniform1f(U.u_warpScale, P.warpScale as number);
      gl.uniform1f(U.u_warpOctaves, P.warpOctaves as number);
      gl.uniform1f(U.u_seed, P.seed as number);
      gl.uniform1f(U.u_seedSpeed, P.seedSpeed as number);

      // Blobs
      gl.uniform1f(U.u_blobOn, P.blobOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_blobCount, P.blobCount as number);
      gl.uniform1f(U.u_blobSize, P.blobSize as number);
      gl.uniform1f(U.u_blobSpacing, P.blobSpacing as number);
      gl.uniform1f(U.u_blendSoftness, P.blendSoftness as number);
      gl.uniform1f(U.u_blobRotation, P.blobRotation as number);
      gl.uniform1f(U.u_autoRotation, P.autoRotation as number);
      gl.uniform1f(U.u_blobSpread, P.blobSpread as number);
      gl.uniform1f(U.u_blobOffsetX, P.blobOffsetX as number);
      gl.uniform1f(U.u_blobOffsetY, P.blobOffsetY as number);
      gl.uniform1f(U.u_tileSpacing, P.tileSpacing as number);

      // Transform
      gl.uniform1f(U.u_zoom, P.zoom as number);
      gl.uniform1f(U.u_offsetX, P.offsetX as number);
      gl.uniform1f(U.u_offsetY, P.offsetY as number);

      // Mouse core
      const mouseOn = P.mouseOn as boolean;
      const modeName = (P.mouseMode as MouseMode) ?? 'Swell';
      const modeId = MOUSE_MODE_ID[modeName] ?? 0;
      gl.uniform1f(U.u_mouseOn, mouseOn ? 1.0 : 0.0);
      gl.uniform2f(U.u_mousePos, input.mouse.x, input.mouse.y);
      gl.uniform2f(U.u_mouseWind, windX, windY);
      gl.uniform1f(U.u_mouseStr, mouseOn ? (P.mouseStrength as number) : 0);
      gl.uniform1f(U.u_mouseRadius, P.mouseRadius as number);
      gl.uniform1f(U.u_mouseMode, modeId);

      // Click pulse
      gl.uniform2f(U.u_pulsePos, pulseX, pulseY);
      gl.uniform1f(U.u_pulseStr, mouseOn ? currentPulseStr : 0);
      gl.uniform1f(U.u_pulseAge, pulseAge);
      gl.uniform1f(U.u_pulseSpeed, P.pulseSpeed as number);
      gl.uniform1f(U.u_pulseWidth, P.pulseWidth as number);

      // Grain
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainScale, P.grainScale as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

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
