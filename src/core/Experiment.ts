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
  /** Hide the experiment from the gallery in production. Visible in dev. */
  draft?: boolean;
  /** Hide the article in production (experiment still ships). Visible in dev. */
  articleDraft?: boolean;
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
  op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
}

export interface LayerOrderEntry {
  id: string;
  label: string;
  color: string;
  orderKey: string;
}

export interface ExperimentControls {
  defaults: Record<string, unknown>;
  dialConfig: DialConfig;
  presets?: Record<string, Partial<Record<string, unknown>>>;
  /** Per-control conditional visibility rules. */
  visibility?: Record<string, VisibilityRule>;
  /** Draggable layer stack config — when present, the LayerStack UI is shown. */
  layerOrder?: LayerOrderEntry[];
  /**
   * When true, skip the auto-seeded "Defaults" version on first load —
   * the dial's version selector shows only the presets. The first
   * preset becomes active by default.
   */
  skipDefaultsVersion?: boolean;
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
