// ============================================================
// Coral-1 — gallery wrapper around the Gray-Scott brand engine.
// The full tool UI lives at /brand/coral-1.
// ============================================================

import type { Experiment, ExperimentGLContext, ExperimentInstance } from '../../core/Experiment.ts';
import type { BrandTool } from '../../brand/types.ts';
import { GrayScottEngine } from './engine.ts';
import { meta } from './meta.ts';
import { controls, themes } from './params.ts';

export const coral1Tool: BrandTool = {
  slug: meta.slug,
  title: 'Reaction Field',
  tagline: 'Gray-Scott growth · feed/kill maps · directional diffusion',
  controls,
  themes,
  createEngine: (ctx) => new GrayScottEngine(ctx),
};

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const engine = new GrayScottEngine({ gl: ctx.gl, canvas: ctx.canvas, params: ctx.params });
  return {
    render(time, dt) { engine.frame(time, dt); },
    resize(w, h) { ctx.gl.viewport(0, 0, ctx.canvas.width, ctx.canvas.height); engine.resize(w, h); },
    dispose() { engine.dispose(); },
  };
}

export const coral1Experiment: Experiment = { meta, controls, initGL };
