// ============================================================
// Brand engine contract — what a generative tool must expose so
// the Brand Tool UI can drive it (simulate, render, ingest images,
// read the scalar field back for vectorisation, offscreen export).
// ============================================================

import type { ExperimentControls } from '../core/Experiment.ts';

export type SeedMode = 'center' | 'random' | 'image' | 'clear' | 'noise';

export interface FieldReadback {
  width: number;
  height: number;
  /** Row-major, bottom-up (GL order), values in 0..1. */
  data: Float32Array;
}

export interface BrandEngine {
  /** Advance the simulation (respecting params) and draw to the canvas. */
  frame(time: number, dt: number): void;
  /** Canvas drawing-buffer size changed. */
  resize(width: number, height: number): void;
  /** Replace (or clear) the source image the pattern reacts to. */
  setImage(image: ImageBitmap | HTMLImageElement | null): void;
  /** Re-initialise the simulation state. */
  reseed(mode?: SeedMode): void;
  /** Read the scalar pattern field at simulation resolution. */
  readField(): FieldReadback;
  /**
   * Render the current state into an offscreen target of the given
   * size and return RGBA8 pixels (top-down row order, ready for
   * ImageData). `transparent` outputs the pattern as alpha.
   */
  renderToPixels(width: number, height: number, opts?: { transparent?: boolean }): Uint8ClampedArray;
  dispose(): void;
}

export interface BrandEngineContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  /** Mutable params object — read every frame. */
  params: Record<string, unknown>;
  /**
   * Logical size of the artwork in px. The simulation resolution follows
   * this (× quality ÷ pattern scale), *not* the drawing buffer — so zooming
   * the view never rebuilds the field. Defaults to the canvas buffer size.
   */
  logicalSize?: () => { width: number; height: number };
}

export interface ThemePreset {
  name: string;
  values: Record<string, unknown>;
}

export interface BrandTool {
  slug: string;
  title: string;
  tagline: string;
  controls: ExperimentControls;
  /** Colour-only partial presets shown as theme chips. */
  themes: ThemePreset[];
  createEngine(ctx: BrandEngineContext): BrandEngine;
}
