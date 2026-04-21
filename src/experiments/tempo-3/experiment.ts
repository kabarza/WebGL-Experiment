// ============================================================
// Tempo-3 — WebGL2 Composite Analog Lens-Flare Effect
// 5 layers: base gradient, aurora noise, particle ring,
//           chromatic dispersion, film grain
// Single draw call, all layers in one fragment shader.
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
    'u_time', 'u_resolution',
    // Base Gradient
    'u_baseOn', 'u_baseOpacity',
    'u_baseWarpStrength', 'u_baseWarpSpeed', 'u_baseNoiseScale',
    'u_baseColorTemp', 'u_baseFalloff', 'u_baseBrightness',
    // Aurora Noise
    'u_auroraOn', 'u_auroraOpacity',
    'u_auroraSpeed', 'u_auroraScale',
    'u_auroraWarp', 'u_auroraSaturation',
    // Particle Ring
    'u_ringOn', 'u_ringOpacity',
    'u_ringPos', 'u_ringRadius', 'u_ringEdgeWidth',
    'u_ringDensity', 'u_ringParticleSize',
    'u_ringMode', 'u_ringSpeed', 'u_ringPulseRate',
    // Lens Flare
    'u_flareOn', 'u_flareOpacity',
    'u_flareCount', 'u_flareSpread', 'u_flareLength',
    'u_flareDispersion', 'u_flareDesaturation', 'u_flareAngle',
    // Film Grain
    'u_grainOn', 'u_grainIntensity', 'u_grainScale',
    // Post
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

      // ── Base Gradient ──
      gl.uniform1f(U.u_baseOn, P.baseOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_baseOpacity, P.baseOpacity as number);
      gl.uniform1f(U.u_baseWarpStrength, P.baseWarpStrength as number);
      gl.uniform1f(U.u_baseWarpSpeed, P.baseWarpSpeed as number);
      gl.uniform1f(U.u_baseNoiseScale, P.baseNoiseScale as number);
      gl.uniform1f(U.u_baseColorTemp, P.baseColorTemp as number);
      gl.uniform1f(U.u_baseFalloff, P.baseFalloff as number);
      gl.uniform1f(U.u_baseBrightness, P.baseBrightness as number);

      // ── Aurora Noise ──
      gl.uniform1f(U.u_auroraOn, P.auroraOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_auroraOpacity, P.auroraOpacity as number);
      gl.uniform1f(U.u_auroraSpeed, P.auroraSpeed as number);
      gl.uniform1f(U.u_auroraScale, P.auroraScale as number);
      gl.uniform1f(U.u_auroraWarp, P.auroraWarp as number);
      gl.uniform1f(U.u_auroraSaturation, P.auroraSaturation as number);

      // ── Particle Ring ──
      gl.uniform1f(U.u_ringOn, P.ringOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_ringOpacity, P.ringOpacity as number);
      gl.uniform2f(U.u_ringPos, P.ringX as number, P.ringY as number);
      gl.uniform1f(U.u_ringRadius, P.ringRadius as number);
      gl.uniform1f(U.u_ringEdgeWidth, P.ringEdgeWidth as number);
      gl.uniform1f(U.u_ringDensity, P.ringDensity as number);
      gl.uniform1f(U.u_ringParticleSize, P.ringParticleSize as number);
      gl.uniform1f(U.u_ringMode, P.ringMode as number);
      gl.uniform1f(U.u_ringSpeed, P.ringSpeed as number);
      gl.uniform1f(U.u_ringPulseRate, P.ringPulseRate as number);

      // ── Lens Flare ──
      gl.uniform1f(U.u_flareOn, P.flareOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_flareOpacity, P.flareOpacity as number);
      gl.uniform1f(U.u_flareCount, P.flareCount as number);
      gl.uniform1f(U.u_flareSpread, P.flareSpread as number);
      gl.uniform1f(U.u_flareLength, P.flareLength as number);
      gl.uniform1f(U.u_flareDispersion, P.flareDispersion as number);
      gl.uniform1f(U.u_flareDesaturation, P.flareDesaturation as number);
      gl.uniform1f(U.u_flareAngle, P.flareAngle as number);

      // ── Film Grain ──
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainIntensity, P.grainIntensity as number);
      gl.uniform1f(U.u_grainScale, P.grainScale as number);

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
      quad.dispose();
    },
  };
}

export const tempo3Experiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
