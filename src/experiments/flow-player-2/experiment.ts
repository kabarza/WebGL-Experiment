// ============================================================
// flow-player-2 — preview that mirrors the exported component 1:1.
//
// Same DOM, same data-video attributes, same runtime as the
// standalone bundle. When dial values change, we rebuild the
// wrapper from scratch (matches "fresh page load" semantics).
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import { renderCssBlock } from './styles.ts';
import { buildPreviewDom } from './dom.ts';
import { bindWrapper } from './runtime.ts';

const STYLE_TAG_ID = 'flow-player-2-styles';

function ensureStyles(): void {
  let style = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    document.head.appendChild(style);
  }
  style.textContent = renderCssBlock();
}

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  canvas.style.pointerEvents = 'none';
  gl.clearColor(0, 0, 0, 1);

  ensureStyles();

  const parent = canvas.parentElement ?? document.body;

  // Frame container — sits over the canvas in the gallery viewport.
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5vmin',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
  } as Partial<CSSStyleDeclaration>);

  // Outer holder mimics how a designer would wrap one .fp-wrapper.
  const holder = document.createElement('div');
  Object.assign(holder.style, {
    position: 'relative',
    width: '100%',
    maxWidth: '1280px',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
    borderRadius: '12px',
    overflow: 'visible',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(holder);
  parent.appendChild(root);

  let currentWrapper: HTMLElement | null = null;
  let unbind: (() => void) | null = null;

  function rebuild(): void {
    unbind?.();
    unbind = null;
    if (currentWrapper && currentWrapper.parentElement) {
      currentWrapper.parentElement.removeChild(currentWrapper);
    }
    const wrapper = buildPreviewDom({
      videoUrl: String(params.videoUrl ?? ''),
      posterUrl: String(params.posterUrl ?? ''),
      accentColor: String(params.accentColor ?? '#00b3ff'),
      trackColor: String(params.trackColor ?? '#ffffff'),
      bufferColor: String(params.bufferColor ?? '#9aa0a6'),
      autoplay: !!params.autoplay,
      muted: !!params.muted,
      loop: !!params.loop,
      playsinline: params.playsinline !== false,
    });
    holder.appendChild(wrapper);
    currentWrapper = wrapper;
    unbind = bindWrapper(wrapper, {
      skipSeconds: typeof params.skipSeconds === 'number' ? params.skipSeconds : 10,
    });
  }

  rebuild();

  function snapshot(): string {
    return [
      params.videoUrl,
      params.posterUrl,
      params.accentColor,
      params.trackColor,
      params.bufferColor,
      params.autoplay,
      params.muted,
      params.loop,
      params.playsinline,
      params.skipSeconds,
    ].join('|');
  }
  let lastSnapshot = snapshot();

  return {
    render(_time: number) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      const snap = snapshot();
      if (snap !== lastSnapshot) {
        lastSnapshot = snap;
        rebuild();
      }
    },
    resize(w: number, h: number, _dpr: number) {
      gl.viewport(0, 0, w, h);
    },
    dispose() {
      unbind?.();
      if (root.parentElement) root.parentElement.removeChild(root);
      canvas.style.pointerEvents = '';
    },
  };
}

export const flowPlayer2Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
