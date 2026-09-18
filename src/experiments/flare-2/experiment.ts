// ============================================================
// Flare-2 — WebGL2 Experiment
// Layered effect: base flare + aurora drift + ring particles +
// softened chromatic haze + single film grain pass
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
    'u_baseOn', 'u_auroraOn', 'u_ringOn', 'u_flareOn', 'u_grainOn',
    'u_bgColor', 'u_purpleColor', 'u_orangeColor',
    'u_baseCenter', 'u_baseRadius', 'u_baseSoftness',
    'u_purpleStrength', 'u_orangeStrength', 'u_emberWidth',
    'u_auroraColorA', 'u_auroraColorB',
    'u_auroraScale', 'u_auroraSpeed', 'u_auroraFlow',
    'u_auroraIntensity', 'u_auroraThreshold', 'u_auroraSoftness',
    'u_ringCenter', 'u_ringRadius', 'u_ringThickness',
    'u_ringDensity', 'u_ringSize', 'u_ringSpin', 'u_ringBlink', 'u_ringOpacity',
    'u_flareIntensity', 'u_flareSpread', 'u_flareSmear',
    'u_flareChromatic', 'u_flareAngle', 'u_flareDrift', 'u_flareGhostOpacity',
    'u_grainAmount', 'u_grainSize', 'u_grainSpeed',
    'u_brightness', 'u_contrast', 'u_saturation',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(prog, n);
  }

  return {
    render(time: number, _deltaTime: number) {
      const P = params;
      gl.useProgram(prog);

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      gl.uniform1f(U.u_baseOn, P.baseOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_auroraOn, P.auroraOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_ringOn, P.ringOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_flareOn, P.flareOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);

      const bg = hex2rgb(P.bgColor as string);
      const purple = hex2rgb(P.purpleColor as string);
      const orange = hex2rgb(P.orangeColor as string);
      const auroraA = hex2rgb(P.auroraColorA as string);
      const auroraB = hex2rgb(P.auroraColorB as string);

      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
      gl.uniform3f(U.u_purpleColor, purple[0], purple[1], purple[2]);
      gl.uniform3f(U.u_orangeColor, orange[0], orange[1], orange[2]);
      gl.uniform2f(U.u_baseCenter, P.baseCenterX as number, P.baseCenterY as number);
      gl.uniform1f(U.u_baseRadius, P.baseRadius as number);
      gl.uniform1f(U.u_baseSoftness, P.baseSoftness as number);
      gl.uniform1f(U.u_purpleStrength, P.purpleStrength as number);
      gl.uniform1f(U.u_orangeStrength, P.orangeStrength as number);
      gl.uniform1f(U.u_emberWidth, P.emberWidth as number);

      gl.uniform3f(U.u_auroraColorA, auroraA[0], auroraA[1], auroraA[2]);
      gl.uniform3f(U.u_auroraColorB, auroraB[0], auroraB[1], auroraB[2]);
      gl.uniform1f(U.u_auroraScale, P.auroraScale as number);
      gl.uniform1f(U.u_auroraSpeed, P.auroraSpeed as number);
      gl.uniform1f(U.u_auroraFlow, P.auroraFlow as number);
      gl.uniform1f(U.u_auroraIntensity, P.auroraIntensity as number);
      gl.uniform1f(U.u_auroraThreshold, P.auroraThreshold as number);
      gl.uniform1f(U.u_auroraSoftness, P.auroraSoftness as number);

      gl.uniform2f(U.u_ringCenter, P.ringX as number, P.ringY as number);
      gl.uniform1f(U.u_ringRadius, P.ringRadius as number);
      gl.uniform1f(U.u_ringThickness, P.ringThickness as number);
      gl.uniform1f(U.u_ringDensity, P.ringDensity as number);
      gl.uniform1f(U.u_ringSize, P.ringSize as number);
      gl.uniform1f(U.u_ringSpin, P.ringSpin as number);
      gl.uniform1f(U.u_ringBlink, P.ringBlink as number);
      gl.uniform1f(U.u_ringOpacity, P.ringOpacity as number);

      gl.uniform1f(U.u_flareIntensity, P.flareIntensity as number);
      gl.uniform1f(U.u_flareSpread, P.flareSpread as number);
      gl.uniform1f(U.u_flareSmear, P.flareSmear as number);
      gl.uniform1f(U.u_flareChromatic, P.flareChromatic as number);
      gl.uniform1f(U.u_flareAngle, P.flareAngle as number);
      gl.uniform1f(U.u_flareDrift, P.flareDrift as number);
      gl.uniform1f(U.u_flareGhostOpacity, P.flareGhostOpacity as number);

      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainSize, P.grainSize as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

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
      quad.dispose();
    },
  };
}

export const flare2Experiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
