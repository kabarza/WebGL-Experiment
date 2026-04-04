// ============================================================
// Flow Field Experiment — WebGPU + WebGL2 fallback
// ============================================================

import type {
  Experiment,
  ExperimentContext,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { FullscreenQuad } from '../../core/FullscreenQuad.ts';
import { FullscreenQuadGL } from '../../core/FullscreenQuadGL.ts';
import { UniformBuffer } from '../../core/UniformBuffer.ts';
import type { UniformField } from '../../core/UniformBuffer.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import vertexShaderSrc from '../../shaders/lib/fullscreen-quad.wgsl';
import fragmentShaderSrc from './flow-field.wgsl';
import fragGLSL from './flow-field.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

// Uniform field layout — must match the WGSL struct exactly
const UNIFORM_FIELDS: UniformField[] = [
  { name: 'time', type: 'f32' },
  { name: 'resolution', type: 'vec2f' },
  { name: 'mouse', type: 'vec2f' },
  { name: 'noiseScale', type: 'f32' },
  { name: 'noiseSpeed', type: 'f32' },
  { name: 'noiseOctaves', type: 'f32' },
  { name: 'warpStrength', type: 'f32' },
  { name: 'warpScale', type: 'f32' },
  { name: 'warpSpeed', type: 'f32' },
  { name: 'warpDepth', type: 'f32' },
  { name: 'circleRadius', type: 'f32' },
  { name: 'circleSoft', type: 'f32' },
  { name: 'circlePos', type: 'vec2f' },
  { name: 'rotation', type: 'f32' },
  { name: 'zoom', type: 'f32' },
  { name: 'mouseStr', type: 'f32' },
  { name: 'col1', type: 'vec3f' },
  { name: 'col2', type: 'vec3f' },
  { name: 'col3', type: 'vec3f' },
  { name: 'col4', type: 'vec3f' },
  { name: 'saturation', type: 'f32' },
  { name: 'brightness', type: 'f32' },
  { name: 'contrast', type: 'f32' },
  { name: 'blendWidth', type: 'f32' },
  { name: 'colorShift', type: 'f32' },
  { name: 'highlightStr', type: 'f32' },
  { name: 'highlightColor', type: 'vec3f' },
  { name: 'grainAmt', type: 'f32' },
  { name: 'grainScale', type: 'f32' },
  { name: 'grainSpeed', type: 'f32' },
  { name: 'bgColor', type: 'vec3f' },
];

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

// ── WebGPU implementation ──────────────────────────────────

async function initWebGPU(ctx: ExperimentContext): Promise<ExperimentInstance> {
  const { device, context, format, canvas, params, input } = ctx;

  const uniforms = new UniformBuffer(device, UNIFORM_FIELDS);
  const quad = new FullscreenQuad(device);

  const vertexModule = device.createShaderModule({ code: vertexShaderSrc });
  const fragmentModule = device.createShaderModule({ code: fragmentShaderSrc });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.FRAGMENT,
      buffer: { type: 'uniform' },
    }],
  });

  const pipeline = quad.createPipeline(vertexModule, fragmentModule, format, bindGroupLayout);

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: uniforms.buffer },
    }],
  });

  let width = canvas.width;
  let height = canvas.height;

  function updateUniforms(time: number): void {
    const P = params;
    uniforms.set('time', time);
    uniforms.set('resolution', [width, height]);
    uniforms.set('mouse', [input.mouse.x, input.mouse.y]);
    uniforms.set('noiseScale', P.noiseScale as number);
    uniforms.set('noiseSpeed', P.noiseSpeed as number);
    uniforms.set('noiseOctaves', P.noiseOctaves as number);
    uniforms.set('warpStrength', P.warpStrength as number);
    uniforms.set('warpScale', P.warpScale as number);
    uniforms.set('warpSpeed', P.warpSpeed as number);
    uniforms.set('warpDepth', P.warpDepth as number);
    uniforms.set('circleRadius', P.circleRadius as number);
    uniforms.set('circleSoft', P.circleSoftness as number);
    const cc = P.circleCenter as { x: number; y: number };
    uniforms.set('circlePos', [cc.x, cc.y]);
    uniforms.set('rotation', P.rotation as number);
    uniforms.set('zoom', P.zoom as number);
    uniforms.set('mouseStr', P.mouseStrength as number);
    uniforms.set('col1', hex2rgb(P.color1 as string));
    uniforms.set('col2', hex2rgb(P.color2 as string));
    uniforms.set('col3', hex2rgb(P.color3 as string));
    uniforms.set('col4', hex2rgb(P.color4 as string));
    uniforms.set('saturation', P.saturation as number);
    uniforms.set('brightness', P.brightness as number);
    uniforms.set('contrast', P.contrast as number);
    uniforms.set('blendWidth', P.blendWidth as number);
    uniforms.set('colorShift', P.colorShift as number);
    uniforms.set('highlightStr', P.highlightStr as number);
    uniforms.set('highlightColor', hex2rgb(P.highlightColor as string));
    uniforms.set('grainAmt', P.grainAmount as number);
    uniforms.set('grainScale', P.grainScale as number);
    uniforms.set('grainSpeed', P.grainSpeed as number);
    uniforms.set('bgColor', hex2rgb(P.bgColor as string));
    uniforms.upload(device);
  }

  return {
    render(time: number, _deltaTime: number) {
      updateUniforms(time);

      const commandEncoder = device.createCommandEncoder();
      const textureView = context.getCurrentTexture().createView();
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        }],
      });

      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      quad.draw(renderPass);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
    },

    resize(w: number, h: number, _dpr: number) {
      width = w;
      height = h;
    },

    dispose() {
      uniforms.dispose();
      quad.dispose();
    },
  };
}

// ── WebGL fallback implementation ──────────────────────────

function mkShader(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
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

async function initWebGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
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
    'u_time', 'u_resolution', 'u_mouse',
    'u_noiseScale', 'u_noiseSpeed', 'u_noiseOctaves',
    'u_warpStrength', 'u_warpScale', 'u_warpSpeed', 'u_warpDepth',
    'u_circleRadius', 'u_circleSoft', 'u_circlePos',
    'u_rotation', 'u_zoom',
    'u_mouseStr', 'u_grainAmt', 'u_grainScale', 'u_grainSpeed', 'u_bgColor',
    'u_col1', 'u_col2', 'u_col3', 'u_col4',
    'u_saturation', 'u_brightness', 'u_contrast',
    'u_blendWidth', 'u_colorShift',
    'u_highlightStr', 'u_highlightColor',
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
      gl.uniform2f(U.u_mouse, input.mouse.x, input.mouse.y);

      gl.uniform1f(U.u_noiseScale, P.noiseScale as number);
      gl.uniform1f(U.u_noiseSpeed, P.noiseSpeed as number);
      gl.uniform1f(U.u_noiseOctaves, P.noiseOctaves as number);
      gl.uniform1f(U.u_warpStrength, P.warpStrength as number);
      gl.uniform1f(U.u_warpScale, P.warpScale as number);
      gl.uniform1f(U.u_warpSpeed, P.warpSpeed as number);
      gl.uniform1f(U.u_warpDepth, P.warpDepth as number);
      gl.uniform1f(U.u_circleRadius, P.circleRadius as number);
      gl.uniform1f(U.u_circleSoft, P.circleSoftness as number);
      const cc = P.circleCenter as { x: number; y: number };
      gl.uniform2f(U.u_circlePos, cc.x, cc.y);
      gl.uniform1f(U.u_rotation, P.rotation as number);
      gl.uniform1f(U.u_zoom, P.zoom as number);
      gl.uniform1f(U.u_mouseStr, P.mouseStrength as number);

      const c1 = hex2rgb(P.color1 as string);
      const c2 = hex2rgb(P.color2 as string);
      const c3 = hex2rgb(P.color3 as string);
      const c4 = hex2rgb(P.color4 as string);
      gl.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.u_col2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.u_col3, c3[0], c3[1], c3[2]);
      gl.uniform3f(U.u_col4, c4[0], c4[1], c4[2]);
      gl.uniform1f(U.u_saturation, P.saturation as number);
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_blendWidth, P.blendWidth as number);
      gl.uniform1f(U.u_colorShift, P.colorShift as number);
      gl.uniform1f(U.u_highlightStr, P.highlightStr as number);
      const hc = hex2rgb(P.highlightColor as string);
      gl.uniform3f(U.u_highlightColor, hc[0], hc[1], hc[2]);

      gl.uniform1f(U.u_grainAmt, P.grainAmount as number);
      gl.uniform1f(U.u_grainScale, P.grainScale as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

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

// ── Export experiment ───────────────────────────────────────

export const flowFieldExperiment: Experiment = {
  meta,
  controls,
  init: initWebGPU,
  initGL: initWebGL,
};
