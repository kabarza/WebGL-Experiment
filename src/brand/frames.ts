// ============================================================
// Board model — frames (canvases) on an infinite stage, the view
// transform and persistence. Engines / GL state live elsewhere; a
// frame's `params` object is shared by reference with its engine.
// ============================================================

export interface Frame {
  id: string;
  name: string;
  /** World-space position of the top-left corner (px at 100 %). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Mutable, flat parameter object read by the engine every frame. */
  params: Record<string, unknown>;
}

export interface View {
  zoom: number;
  /** Screen offset of the world origin relative to the stage centre. */
  x: number;
  y: number;
}

export interface BoardState {
  frames: Frame[];
  selectedId: string | null;
  view: View;
}

export const ASPECTS: Array<{ id: string; label: string; w: number; h: number }> = [
  { id: '16:9', label: '16 : 9', w: 1920, h: 1080 },
  { id: '3:2', label: '3 : 2', w: 1800, h: 1200 },
  { id: '1:1', label: '1 : 1', w: 1600, h: 1600 },
  { id: '4:5', label: '4 : 5', w: 1440, h: 1800 },
  { id: '9:16', label: '9 : 16', w: 1080, h: 1920 },
  { id: '21:9', label: '21 : 9', w: 2520, h: 1080 },
];

export const MAX_FRAMES = 8; // each frame owns a WebGL context
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function aspectOf(f: { w: number; h: number }): string | null {
  return ASPECTS.find((a) => Math.abs(a.w / a.h - f.w / f.h) < 0.002)?.id ?? null;
}

export function makeFrame(
  partial: Partial<Omit<Frame, 'params'>> & { params: Record<string, unknown> },
  index: number,
): Frame {
  return {
    id: partial.id ?? uid(),
    name: partial.name ?? `Frame ${index}`,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    w: partial.w ?? 1920,
    h: partial.h ?? 1080,
    params: partial.params,
  };
}

export function loadBoard(key: string): BoardState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoardState;
    if (!Array.isArray(parsed.frames)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveBoard(key: string, state: BoardState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* quota — ignore */
  }
}

/** Bounds of a set of frames in world space. */
export function boundsOf(frames: Frame[]): { x: number; y: number; w: number; h: number } | null {
  if (!frames.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of frames) {
    x0 = Math.min(x0, f.x); y0 = Math.min(y0, f.y);
    x1 = Math.max(x1, f.x + f.w); y1 = Math.max(y1, f.y + f.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** View that fits `b` into a stage of the given size with padding. */
export function fitViewTo(
  b: { x: number; y: number; w: number; h: number },
  stageW: number,
  stageH: number,
  pad = 80,
): View {
  const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min((stageW - pad * 2) / b.w, (stageH - pad * 2) / b.h)));
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  return { zoom, x: -cx * zoom, y: -cy * zoom };
}
