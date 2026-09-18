// ============================================================
// flow-player — preview that mirrors the exported component 1:1.
//
// Same DOM, same data-* attributes, same Player.attachSlot logic
// as ./standalone.ts. The only difference: when dial values change,
// we rebuild the slot from scratch (matching "fresh page load"
// semantics). The CSS class library is injected once into the page
// via a <style> tag derived from styles.ts, so the preview looks
// identical to what Webflow renders with those classes.
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import { PLAY_TRIANGLE_BIG } from './icons.ts';
import { renderCssBlock } from './styles.ts';
import { attachSlot, flowPlayerDefaults } from './ui/Player.ts';
import type { PlayerInstance } from './ui/Player.ts';

const STYLE_TAG_ID = 'flow-player-styles';

function ensureStyles(): void {
  // HMR-safe: always re-render the content. Vite hot-reloads
  // styles.ts — without this, the cached <style> tag would keep
  // serving the old CSS until the user hard-refreshes.
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

  // Outer preview container (centered with padding). NOT part of the
  // exported component — this just frames the player nicely in the
  // gallery viewport.
  const root = document.createElement('div');
  root.className = 'flow-player-preview';
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '5vmin',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'vp-component';
  // Sizing applied inline in the preview to dodge flex-vs-class width
  // ambiguity (the .vp-component class sets `width: 100%; max-width: 1280px`
  // for the Webflow export context, where the wrapper sits in a normal
  // block flow. Here it's a flex item under root, and inline wins).
  Object.assign(wrapper.style, {
    position: 'relative',
    width: '100%',
    maxWidth: '1280px',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
    borderRadius: '8px',
  });
  root.appendChild(wrapper);

  parent.appendChild(root);

  let currentSlot: HTMLElement | null = null;
  let currentInstance: PlayerInstance | null = null;

  function rebuild(): void {
    currentInstance?.destroy();
    currentInstance = null;
    if (currentSlot && currentSlot.parentElement) {
      currentSlot.parentElement.removeChild(currentSlot);
    }

    const slot = document.createElement('div');
    slot.className = 'vp-slot';
    slot.tabIndex = 0;
    // Sizing applied inline in the preview to dodge any class-cascade
    // ambiguity. The class also sets these for the Webflow export.
    Object.assign(slot.style, {
      position: 'relative',
      width: '100%',
      aspectRatio: '16 / 9',
    });
    // Always-surfaced data attributes (same as the export ships).
    slot.setAttribute('data-vimeo-url', String(params.videoUrl ?? ''));
    slot.setAttribute('data-autoplay', params.autoplay ? 'true' : 'false');
    slot.setAttribute('data-show-title', params.showTitle ? 'true' : 'false');
    const accent = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(accent)) {
      slot.setAttribute('data-accent-color', accent);
    }
    const thumb = String(params.thumbColor ?? '').replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(thumb)) {
      slot.setAttribute('data-thumb-color', thumb);
    }
    if (params.consent === 'required') {
      slot.setAttribute('data-consent', 'required');
    }
    if (params.vimeoPro) {
      slot.setAttribute('data-vimeo-pro', 'true');
    }
    // Less common — only emit when the user has overridden the default.
    if (params.muted) slot.setAttribute('data-muted', 'true');
    if (params.loop) slot.setAttribute('data-loop', 'true');
    if (params.playsinline === false) {
      slot.setAttribute('data-playsinline', 'false');
    }
    if (params.showControls === false) {
      slot.setAttribute('data-show-controls', 'false');
    }

    const poster = document.createElement('div');
    poster.className = 'vp-poster';
    slot.appendChild(poster);

    const playOverlay = document.createElement('div');
    playOverlay.className = 'vp-play';
    playOverlay.innerHTML = PLAY_TRIANGLE_BIG;
    slot.appendChild(playOverlay);

    wrapper.appendChild(slot);
    currentSlot = slot;

    currentInstance = attachSlot(slot, {
      defaults: {
        ...flowPlayerDefaults,
        keyboardShortcuts: !!params.keyboardShortcuts,
        autoHide: !!params.autoHide,
        idleTimeoutMs:
          ((params.idleTimeout as number) ?? flowPlayerDefaults.idleTimeoutMs / 1000) * 1000,
      },
    });
  }

  rebuild();

  function snapshot(): string {
    return [
      params.videoUrl,
      params.vimeoPro,
      params.accentColor,
      params.thumbColor,
      params.autoplay,
      params.muted,
      params.loop,
      params.playsinline,
      params.showControls,
      params.showTitle,
      params.consent,
      params.keyboardShortcuts,
      params.autoHide,
      params.idleTimeout,
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
      currentInstance?.destroy();
      if (root.parentElement) root.parentElement.removeChild(root);
      canvas.style.pointerEvents = '';
    },
  };
}

export const flowPlayerExperiment: Experiment = {
  meta,
  controls,
  initGL,
};
