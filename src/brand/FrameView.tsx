// ============================================================
// FrameView — one canvas on the board. Owns its WebGL context and
// engine, keeps the drawing buffer in step with the on-screen size,
// and draws the Figma-style label / selection outline.
// ============================================================

import { useEffect, useRef } from 'react';
import type { Frame } from './frames.ts';
import type { BrandEngine, BrandTool } from './types.ts';

const BUFFER_CAP = 2048;

interface FrameViewProps {
  frame: Frame;
  zoom: number;
  selected: boolean;
  tool: BrandTool;
  onEngine: (id: string, engine: BrandEngine | null) => void;
  onError: (msg: string) => void;
}

export function FrameView({ frame, zoom, selected, tool, onEngine, onError }: FrameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BrandEngine | null>(null);
  const sizeRef = useRef({ width: frame.w, height: frame.h });
  sizeRef.current = { width: frame.w, height: frame.h };

  // Engine lifecycle (one GL context per frame)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) { onError('WebGL2 is required for the brand tool.'); return; }
    let engine: BrandEngine;
    try {
      if (!canvas.width) { canvas.width = 960; canvas.height = 540; }
      engine = tool.createEngine({ gl, canvas, params: frame.params, logicalSize: () => sizeRef.current });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      return;
    }
    engineRef.current = engine;
    onEngine(frame.id, engine);
    return () => {
      onEngine(frame.id, null);
      engine.dispose();
      engineRef.current = null;
    };
    // frame.params is a stable reference for the frame's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.id, tool]);

  // Drawing buffer follows on-screen size (debounced while zooming)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const t = setTimeout(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let w = frame.w * zoom * dpr;
      let h = frame.h * zoom * dpr;
      const m = Math.max(w, h);
      if (m > BUFFER_CAP) { w *= BUFFER_CAP / m; h *= BUFFER_CAP / m; }
      w = Math.max(48, Math.round(w));
      h = Math.max(48, Math.round(h));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        engineRef.current?.resize(w, h);
      }
    }, 120);
    return () => clearTimeout(t);
  }, [frame.w, frame.h, zoom]);

  const hairline = 1 / zoom;

  return (
    <div
      className={`bt-frame${selected ? ' selected' : ''}`}
      data-frame-id={frame.id}
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        outlineWidth: selected ? 2 * hairline : hairline,
      }}
    >
      <div
        className="bt-frame-label"
        style={{ transform: `translateY(-100%) scale(${hairline})`, marginTop: -6 * hairline }}
      >
        {frame.name}
      </div>
      <canvas ref={canvasRef} className="bt-canvas" />
      {selected && ['nw', 'ne', 'sw', 'se'].map((h) => (
        <div
          key={h}
          className={`bt-handle bt-handle--${h}`}
          data-handle={h}
          style={{ width: 8 * hairline, height: 8 * hairline, borderWidth: hairline, margin: -4 * hairline }}
        />
      ))}
    </div>
  );
}
