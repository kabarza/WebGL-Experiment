// ============================================================
// useExperiment — Bridge: React → Vanilla Engine
// Creates canvas renderer, initializes experiment, manages lifecycle
// ============================================================

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Renderer } from '../core/Renderer.ts';
import { WebGLRenderer } from '../core/WebGLRenderer.ts';
import { RenderLoop } from '../core/RenderLoop.ts';
import { InputManager } from '../core/InputManager.ts';
import type { Experiment, ExperimentInstance } from '../core/Experiment.ts';

interface UseExperimentResult {
  instance: ExperimentInstance | null;
  error: string | null;
  loading: boolean;
}

export function useExperiment(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  experiment: Experiment | undefined,
  params: Record<string, unknown>,
): UseExperimentResult {
  const [instance, setInstance] = useState<ExperimentInstance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep stable refs for mutable state the render loop accesses
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!experiment || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let disposed = false;
    let renderer: Renderer | WebGLRenderer | null = null;
    let loop: RenderLoop | null = null;
    let input: InputManager | null = null;
    let inst: ExperimentInstance | null = null;

    setLoading(true);
    setError(null);

    async function init() {
      input = new InputManager(canvas);

      // Try WebGPU first, then WebGL fallback
      try {
        const gpuRenderer = new Renderer(canvas);
        const ok = await gpuRenderer.init();

        if (ok) {
          renderer = gpuRenderer;
          inst = await experiment!.init({
            device: gpuRenderer.device,
            context: gpuRenderer.context,
            format: gpuRenderer.format,
            canvas,
            params: paramsRef.current,
            input: input.state,
          });
        } else if (experiment!.initGL) {
          console.warn('WebGPU not available, falling back to WebGL');
          gpuRenderer.dispose();
          const glRenderer = new WebGLRenderer(canvas);
          renderer = glRenderer;
          inst = await experiment!.initGL({
            gl: glRenderer.gl,
            canvas,
            params: paramsRef.current,
            input: input.state,
          });
        } else {
          throw new Error('WebGPU not available and no WebGL fallback');
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
        return;
      }

      if (disposed) {
        inst?.dispose();
        renderer?.dispose();
        input?.dispose();
        return;
      }

      // Render loop
      let thumbnailCaptured = false;
      loop = new RenderLoop((time, dt) => {
        input!.update();

        const p = paramsRef.current;
        loop!.paused = p.paused as boolean ?? false;
        loop!.speed = p.speed as number ?? 1.0;

        if (!loop!.paused) {
          inst!.render(time, dt);

          // Capture thumbnail after first rendered frame
          if (!thumbnailCaptured && time > 0.1) {
            thumbnailCaptured = true;
            try {
              const dataUrl = canvas.toDataURL('image/webp', 0.8);
              localStorage.setItem(`tempo-thumb/${experiment!.meta.slug}`, dataUrl);
            } catch {
              // Canvas may be tainted or toDataURL unsupported
            }
          }
        }
      });

      // Resize handler
      const onResize = () => {
        if (renderer) {
          renderer.resize();
          inst!.resize(renderer.width, renderer.height, renderer.dpr);
        }
      };
      window.addEventListener('resize', onResize);
      onResize();

      loop.start();

      if (!disposed) {
        setInstance(inst);
        setLoading(false);
      }

      // Return cleanup that will be called in the outer cleanup
      return () => {
        window.removeEventListener('resize', onResize);
      };
    }

    let cleanupResize: (() => void) | undefined;
    init().then((fn) => {
      cleanupResize = fn;
    });

    return () => {
      disposed = true;
      cleanupResize?.();
      loop?.stop();
      inst?.dispose();
      input?.dispose();
      renderer?.dispose();
      setInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment, canvasRef]);

  return { instance, error, loading };
}
