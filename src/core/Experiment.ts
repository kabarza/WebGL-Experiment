// ============================================================
// Experiment interfaces — the contract every experiment implements
// ============================================================

export interface ExperimentMeta {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  thumbnail?: string;
  date: string; // ISO date for sorting
  hasArticle?: boolean;
}

export type DialConfig = Record<string, Record<string, unknown>>;

/**
 * Visibility rule: a control is shown only when another param
 * matches a specific value.
 *
 * Example: `{ when: 'playMode', is: 'Manual' }` → control visible
 * only when `playMode === 'Manual'`.
 */
export interface VisibilityRule {
  when: string;
  is: unknown;
}

export interface ExperimentControls {
  defaults: Record<string, unknown>;
  dialConfig: DialConfig;
  presets?: Record<string, Partial<Record<string, unknown>>>;
  /** Per-control conditional visibility rules. */
  visibility?: Record<string, VisibilityRule>;
}

export interface ExperimentContext {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  canvas: HTMLCanvasElement;
  params: Record<string, unknown>;
  input: {
    mouse: { x: number; y: number };
    velocity: { x: number; y: number };
    isOver: boolean;
    isDown: boolean;
  };
}

export interface ExperimentGLContext {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  params: Record<string, unknown>;
  input: {
    mouse: { x: number; y: number };
    velocity: { x: number; y: number };
    isOver: boolean;
    isDown: boolean;
  };
}

export interface ExperimentInstance {
  render(time: number, deltaTime: number): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}

export interface Experiment {
  meta: ExperimentMeta;
  controls: ExperimentControls;
  init?(ctx: ExperimentContext): Promise<ExperimentInstance>;
  initGL?(ctx: ExperimentGLContext): Promise<ExperimentInstance>;
}
