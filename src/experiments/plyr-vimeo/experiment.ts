// ============================================================
// plyr-vimeo — Inline Vimeo video player, powered by Plyr.io
//
// This is a "DOM experiment" — there's no shader. The framework
// hands us a WebGL canvas; we just clear it to the configured
// background and overlay a real DOM <iframe> player on top of it.
// The whole point of this experiment is the Webflow JSON export
// in `generateExport.ts`. The preview just lets you click around
// the live player to verify the component you're about to ship.
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import {
  PLYR_CSS_URL,
  PLYR_JS_URL,
  parseVimeoId,
} from './helpers.ts';

declare global {
  interface Window {
    Plyr?: new (target: string | HTMLElement, options?: Record<string, unknown>) => {
      destroy: () => void;
      play?: () => Promise<void>;
      muted?: boolean;
      loop?: boolean;
    };
  }
}

interface PlyrInstance {
  destroy: () => void;
}

function ensurePlyrCss(): void {
  if (document.querySelector(`link[data-plyr-vimeo-css]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = PLYR_CSS_URL;
  link.setAttribute('data-plyr-vimeo-css', '');
  document.head.appendChild(link);
}

function ensurePlyrJs(): Promise<void> {
  if (window.Plyr) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-plyr-vimeo-js]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Plyr failed to load')), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PLYR_JS_URL;
    script.async = true;
    script.setAttribute('data-plyr-vimeo-js', '');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Plyr failed to load')), { once: true });
    document.head.appendChild(script);
  });
}

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  // The canvas is just a colored backdrop. Make it visible but inert.
  canvas.style.pointerEvents = 'none';

  // Mount the Plyr player into the canvas's parent so it overlays the WebGL
  // surface. The parent already has position:relative + inset:0 from
  // ExperimentView, so absolute positioning here lays out cleanly.
  const parent = canvas.parentElement ?? document.body;

  const root = document.createElement('div');
  root.className = 'plyr-vimeo-preview';
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

  // Hardcoded preview frame — 16:9, black, 8px radius. These three
  // values aren't dial controls because they're edited on the slot's
  // Webflow class directly in the Designer, not via this app.
  const frame = document.createElement('div');
  frame.className = 'plyr-vimeo-frame';
  Object.assign(frame.style, {
    position: 'relative',
    width: '100%',
    maxWidth: '1280px',
    aspectRatio: '16 / 9',
    background: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
  });
  root.appendChild(frame);

  // The Plyr container that Plyr will upgrade into a player.
  // Plyr's "data attributes" mode: provider + embed-id, no manual iframe.
  const plyrEl = document.createElement('div');
  plyrEl.className = 'plyr__video-embed';
  plyrEl.id = `plyr-vimeo-preview-${Math.random().toString(36).slice(2, 8)}`;
  Object.assign(plyrEl.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
  });
  frame.appendChild(plyrEl);

  parent.appendChild(root);

  ensurePlyrCss();
  await ensurePlyrJs();

  let plyr: PlyrInstance | null = null;
  let lastVimeoId = '';
  let lastAccentColor = '';
  let lastAutoplay: boolean | undefined;
  let lastMuted: boolean | undefined;
  let lastLoop: boolean | undefined;
  let lastPlaysinline: boolean | undefined;
  let lastHideControls: boolean | undefined;
  let lastResetOnEnd: boolean | undefined;
  let lastShowTitle: boolean | undefined;
  let lastVimeoUrl = '';

  function createPlayer(vimeoId: string): void {
    if (!window.Plyr) return;
    plyrEl.innerHTML = '';
    const iframe = document.createElement('iframe');
    const titleFlag = params.showTitle ? 1 : 0;
    iframe.src = `https://player.vimeo.com/video/${vimeoId}?loop=${params.loop ? 1 : 0}&byline=0&portrait=0&title=${titleFlag}&speed=1&transparent=0&gesture=media`;
    iframe.allowFullscreen = true;
    iframe.setAttribute('allowtransparency', '');
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    plyrEl.appendChild(iframe);

    plyr = new window.Plyr(plyrEl, {
      autoplay: !!params.autoplay,
      muted: !!params.muted,
      loop: { active: !!params.loop },
      playsinline: !!params.playsinline,
      controls: params.hideControls
        ? []
        : ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
      resetOnEnd: !!params.resetOnEnd,
      hideControls: !!params.hideControls,
    });
  }

  return {
    render(_time: number) {
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Accent color — applied via CSS variable on the Plyr root.
      // Plyr uses --plyr-color-main for its play button, progress bar,
      // and other accent elements. Updates take effect immediately
      // without re-creating the player.
      const accent = (params.accentColor as string) ?? '#00b3ff';
      if (accent !== lastAccentColor) {
        frame.style.setProperty('--plyr-color-main', accent);
        plyrEl.style.setProperty('--plyr-color-main', accent);
        lastAccentColor = accent;
      }

      // Source URL — re-create the player if the Vimeo video or any
      // option that's baked into the iframe URL changes.
      const url = (params.vimeoUrl as string) ?? '';
      const vimeoId = parseVimeoId(url);

      const optsChanged =
        lastAutoplay !== params.autoplay ||
        lastMuted !== params.muted ||
        lastLoop !== params.loop ||
        lastPlaysinline !== params.playsinline ||
        lastHideControls !== params.hideControls ||
        lastResetOnEnd !== params.resetOnEnd ||
        lastShowTitle !== params.showTitle;

      if (vimeoId && (vimeoId !== lastVimeoId || optsChanged || url !== lastVimeoUrl)) {
        try {
          plyr?.destroy();
        } catch {
          /* ignore */
        }
        plyr = null;
        createPlayer(vimeoId);
        lastVimeoId = vimeoId;
        lastVimeoUrl = url;
        lastAutoplay = params.autoplay as boolean;
        lastShowTitle = params.showTitle as boolean;
        lastMuted = params.muted as boolean;
        lastLoop = params.loop as boolean;
        lastPlaysinline = params.playsinline as boolean;
        lastHideControls = params.hideControls as boolean;
        lastResetOnEnd = params.resetOnEnd as boolean;
      }
    },

    resize(w: number, h: number, _dpr: number) {
      gl.viewport(0, 0, w, h);
    },

    dispose() {
      try {
        plyr?.destroy();
      } catch {
        /* ignore */
      }
      plyr = null;
      if (root.parentElement) root.parentElement.removeChild(root);
      canvas.style.pointerEvents = '';
    },
  };
}

export const plyrVimeoExperiment: Experiment = {
  meta,
  controls,
  initGL,
};
