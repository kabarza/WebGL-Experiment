// ============================================================
// Celestial Flare — WebGL2 Experiment
// Layered effect: wave gradient + particle circle + lens flares + film grain
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
    'u_waveOn', 'u_circleOn', 'u_flareOn', 'u_grainOn',
    // Wave Gradient
    'u_noiseScale', 'u_noiseSpeed', 'u_noiseOctaves',
    'u_warpStrength', 'u_warpScale', 'u_warpSpeed', 'u_waveIntensity',
    'u_col1', 'u_col2', 'u_col3',
    'u_blendWidth', 'u_colorShift',
    // Circle
    'u_circlePos', 'u_circleRadius', 'u_circleEdge',
    'u_circleDensity', 'u_circleParticleSize', 'u_circleSpeed', 'u_circleOpacity',
    'u_circleTrail', 'u_circleTwinkle',
    // Flares
    'u_flareIntensity', 'u_flareSpread', 'u_flareLength',
    'u_flareRainbow', 'u_flareCount', 'u_flareSpeed', 'u_flareAngle',
    // Grain
    'u_grainAmount', 'u_grainSize', 'u_grainSpeed', 'u_grainVariation',
    // Post
    'u_brightness', 'u_contrast', 'u_saturation', 'u_bgColor',
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

      // Layer toggles
      gl.uniform1f(U.u_waveOn, P.waveOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_circleOn, P.circleOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_flareOn, P.flareOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);

      // Wave Gradient
      gl.uniform1f(U.u_noiseScale, P.noiseScale as number);
      gl.uniform1f(U.u_noiseSpeed, P.noiseSpeed as number);
      gl.uniform1f(U.u_noiseOctaves, P.noiseOctaves as number);
      gl.uniform1f(U.u_warpStrength, P.warpStrength as number);
      gl.uniform1f(U.u_warpScale, P.warpScale as number);
      gl.uniform1f(U.u_warpSpeed, P.warpSpeed as number);
      gl.uniform1f(U.u_waveIntensity, P.waveIntensity as number);

      const c1 = hex2rgb(P.color1 as string);
      const c2 = hex2rgb(P.color2 as string);
      const c3 = hex2rgb(P.color3 as string);
      gl.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.u_col2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.u_col3, c3[0], c3[1], c3[2]);
      gl.uniform1f(U.u_blendWidth, P.blendWidth as number);
      gl.uniform1f(U.u_colorShift, P.colorShift as number);

      // Circle
      gl.uniform2f(U.u_circlePos, P.circleX as number, P.circleY as number);
      gl.uniform1f(U.u_circleRadius, P.circleRadius as number);
      gl.uniform1f(U.u_circleEdge, P.circleEdge as number);
      gl.uniform1f(U.u_circleDensity, P.circleDensity as number);
      gl.uniform1f(U.u_circleParticleSize, P.circleParticleSize as number);
      gl.uniform1f(U.u_circleSpeed, P.circleSpeed as number);
      gl.uniform1f(U.u_circleOpacity, P.circleOpacity as number);
      gl.uniform1f(U.u_circleTrail, P.circleTrail as number);
      gl.uniform1f(U.u_circleTwinkle, P.circleTwinkle as number);

      // Flares
      gl.uniform1f(U.u_flareIntensity, P.flareIntensity as number);
      gl.uniform1f(U.u_flareSpread, P.flareSpread as number);
      gl.uniform1f(U.u_flareLength, P.flareLength as number);
      gl.uniform1f(U.u_flareRainbow, P.flareRainbow as number);
      gl.uniform1f(U.u_flareCount, P.flareCount as number);
      gl.uniform1f(U.u_flareSpeed, P.flareSpeed as number);
      gl.uniform1f(U.u_flareAngle, P.flareAngle as number);

      // Grain
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainSize, P.grainSize as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);
      gl.uniform1f(U.u_grainVariation, P.grainVariation as number);

      // Post
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_saturation, P.saturation as number);
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

export const celestialFlareExperiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
