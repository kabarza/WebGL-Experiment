// ============================================================
// Core barrel exports
// ============================================================

export type {
  Experiment,
  ExperimentMeta,
  ExperimentControls,
  ExperimentContext,
  ExperimentGLContext,
  ExperimentInstance,
  DialConfig,
} from './Experiment.ts';

export { Renderer } from './Renderer.ts';
export { WebGLRenderer } from './WebGLRenderer.ts';
export { RenderLoop } from './RenderLoop.ts';
export { InputManager } from './InputManager.ts';
export { FullscreenQuad } from './FullscreenQuad.ts';
export { FullscreenQuadGL } from './FullscreenQuadGL.ts';
export { UniformBuffer } from './UniformBuffer.ts';
export type { UniformField, UniformType } from './UniformBuffer.ts';
