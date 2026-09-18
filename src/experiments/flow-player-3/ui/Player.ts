// ============================================================
// Player — top-level orchestrator.
//
// Decisions made here:
//   1. Parse the slot's data-vimeo-url, detect provider.
//   2. Fetch poster + (for Vimeo) account tier in one oEmbed call.
//   3. Decide UI mode based on:
//      - source.provider === 'youtube'   → custom UI
//      - source.provider === 'vimeo' && tier !== 'basic' → custom UI
//      - data-vimeo-mode override        → trump everything
//      - else                            → native UI (just embed iframe)
//   4. If custom: pick JsControlBar vs DomControlBar from data-ui-mode.
//   5. Wire fullscreen + keyboard + idle hide + consent.
// ============================================================

import type { VideoSource } from '../helpers.ts';
import { buildIframeSrc, parseVideoUrl } from '../helpers.ts';
import { createProvider } from '../providers/createProvider.ts';
import { createStateBridge } from './StateBridge.ts';
import { createJsControlBar, setJsControlsFullscreen } from './JsControlBar.ts';
import { bindDomControlBar, setDomControlsFullscreen } from './DomControlBar.ts';
import { createFullscreen } from './Fullscreen.ts';
import { bindKeyboard } from './Keyboard.ts';
import { showConsentGate, isConsented } from './ConsentGate.ts';
import { loadPoster } from './PosterLoader.ts';

interface PlayerOpts {
  defaults: {
    muted: boolean;
    loop: boolean;
    playsinline: boolean;
    showControls: boolean;
    keyboardShortcuts: boolean;
    autoHide: boolean;
    idleTimeoutMs: number;
  };
}

function attrBool(el: HTMLElement, name: string, fallback: boolean): boolean {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  return v === '' || v === 'true' || v === '1';
}

function readSlotOpts(slot: HTMLElement, defaults: PlayerOpts['defaults']) {
  return {
    autoplay: attrBool(slot, 'data-autoplay', false),
    muted: attrBool(slot, 'data-muted', defaults.muted),
    loop: attrBool(slot, 'data-loop', defaults.loop),
    playsinline: attrBool(slot, 'data-playsinline', defaults.playsinline),
    showControls: attrBool(slot, 'data-show-controls', defaults.showControls),
    showTitle: attrBool(slot, 'data-show-title', false),
    showRelated: attrBool(slot, 'data-show-related', false),
    accentColor: slot.getAttribute('data-accent-color') || '',
  };
}

/**
 * Apply per-slot color tokens. The big play SVG uses fill="currentColor"
 * and inherits color via the CSS cascade from .vp-play → var(--vp-accent),
 * so setting the variable on the slot is enough — no need to write
 * play.style.color directly.
 *
 * Note: a synchronous pre-color script in the Webflow export sets these
 * variables before the browser's first paint, eliminating the FOUC where
 * the play button would briefly flash the default accent color. This
 * function runs again on init for completeness / preview parity.
 */
function applyColors(slot: HTMLElement): void {
  const accent = slot.getAttribute('data-accent-color') || '';
  const accentHex = accent.replace(/^#/, '').slice(0, 6);
  if (/^[0-9a-fA-F]{6}$/.test(accentHex)) {
    slot.style.setProperty('--vp-accent', '#' + accentHex);
  }
  const thumb = slot.getAttribute('data-thumb-color') || '';
  const thumbHex = thumb.replace(/^#/, '').slice(0, 6);
  if (/^[0-9a-fA-F]{6}$/.test(thumbHex)) {
    slot.style.setProperty('--vp-thumb-color', '#' + thumbHex);
  }
}

function bindIdleHide(
  slot: HTMLElement,
  bar: HTMLElement | null,
  state: ReturnType<typeof createStateBridge>,
  enabled: boolean,
  delayMs: number,
): () => void {
  if (!enabled || !bar) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  function show(): void {
    state.setControlsIdle(false);
  }
  function hide(): void {
    if (state.state !== 'playing' || state.menuOpen) return;
    state.setControlsIdle(true);
  }
  function reset(): void {
    show();
    if (timer) clearTimeout(timer);
    timer = setTimeout(hide, delayMs);
  }
  function onPointer(): void {
    reset();
  }
  slot.addEventListener('pointermove', onPointer);
  slot.addEventListener('touchstart', onPointer, { passive: true });
  return () => {
    if (timer) clearTimeout(timer);
    slot.removeEventListener('pointermove', onPointer);
    slot.removeEventListener('touchstart', onPointer);
  };
}

export interface PlayerInstance {
  destroy(): void;
}

function startPlayer(
  slot: HTMLElement,
  source: VideoSource,
  opts: PlayerOpts,
  state: ReturnType<typeof createStateBridge>,
  useCustomUI: boolean,
): PlayerInstance {
  if (state.playing) return { destroy: () => {} };
  state.setPlaying();

  const slotOpts = readSlotOpts(slot, opts.defaults);
  const uiMode: 'js' | 'webflow' =
    slot.getAttribute('data-ui-mode') === 'webflow' ? 'webflow' : 'js';

  // Hide poster + overlay play.
  const poster = slot.querySelector<HTMLElement>('.vp-poster');
  if (poster) poster.style.display = 'none';
  const overlayPlay = slot.querySelector<HTMLElement>('.vp-play');
  if (overlayPlay) overlayPlay.style.display = 'none';

  // Build iframe
  const iframe = document.createElement('iframe');
  iframe.allowFullscreen = true;
  iframe.setAttribute(
    'allow',
    'autoplay; encrypted-media; fullscreen; picture-in-picture',
  );
  iframe.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;z-index:1;';
  iframe.src = buildIframeSrc(source, {
    ...slotOpts,
    autoplay: true,
    showControls: useCustomUI ? false : true,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  slot.appendChild(iframe);

  // Native UI branch — just embed iframe, no provider wiring.
  if (!useCustomUI) {
    return {
      destroy() {
        if (iframe.parentElement) iframe.parentElement.removeChild(iframe);
        if (poster) poster.style.display = '';
        if (overlayPlay) overlayPlay.style.display = '';
      },
    };
  }

  // ── Custom UI branch ──
  const provider = createProvider(source.provider, iframe);
  provider.ready().then(() => {
    if (slotOpts.muted) provider.setMuted(true);
  });

  const fs = createFullscreen(slot, state);

  // Choose control bar implementation
  let controls: { el: HTMLElement | null; destroy: () => void };
  let setControlsFullscreen: (active: boolean) => void;
  if (uiMode === 'webflow') {
    const handles = bindDomControlBar({
      slot,
      provider,
      providerName: source.provider,
      fullscreen: fs,
      state,
    });
    controls = { el: handles.el, destroy: handles.destroy };
    setControlsFullscreen = (active: boolean) => setDomControlsFullscreen(controls.el, active);
  } else {
    const handles = createJsControlBar({
      provider,
      providerName: source.provider,
      fullscreen: fs,
      state,
      showControls: slotOpts.showControls,
    });
    slot.appendChild(handles.el);
    controls = { el: handles.el, destroy: handles.destroy };
    setControlsFullscreen = (active: boolean) => setJsControlsFullscreen(handles.el, active);
  }

  // Wire fullscreen → controls visual state
  const offFs = (() => {
    // Fullscreen helper already writes data-fullscreen. We additionally
    // update the bar's button state.
    const observer = new MutationObserver(() => {
      setControlsFullscreen(slot.getAttribute('data-fullscreen') === 'true');
    });
    observer.observe(slot, { attributes: true, attributeFilter: ['data-fullscreen'] });
    return () => observer.disconnect();
  })();

  // Keyboard shortcuts
  let unbindKb = () => {};
  if (opts.defaults.keyboardShortcuts) {
    unbindKb = bindKeyboard(slot, provider, { fullscreen: fs });
  }

  // Idle hide
  const unbindIdle = bindIdleHide(
    slot,
    controls.el,
    state,
    opts.defaults.autoHide && slotOpts.showControls,
    opts.defaults.idleTimeoutMs,
  );

  return {
    destroy() {
      offFs();
      unbindIdle();
      unbindKb();
      fs.destroy();
      controls.destroy();
      provider.destroy();
      if (iframe.parentElement) iframe.parentElement.removeChild(iframe);
      if (poster) poster.style.display = '';
      if (overlayPlay) overlayPlay.style.display = '';
    },
  };
}

export function attachSlot(slot: HTMLElement, opts: PlayerOpts): PlayerInstance | null {
  const state = createStateBridge(slot);
  if (state.inited) return null;

  const url = slot.getAttribute('data-vimeo-url')
    || slot.getAttribute('data-video-url')
    || slot.getAttribute('data-youtube-url')
    || '';
  const source = parseVideoUrl(url);
  if (!source) return null;

  state.setInit();
  state.setState('idle');

  applyColors(slot);
  // Kick off poster + tier fetch in parallel — we don't await.
  const posterPromise = loadPoster(slot, source, state);

  const consentMode = (slot.getAttribute('data-consent') || 'off') as 'off' | 'required';
  const wantsAutoplay = attrBool(slot, 'data-autoplay', false);
  const vimeoMode = (slot.getAttribute('data-vimeo-mode') || 'auto') as
    | 'auto'
    | 'custom'
    | 'native';

  async function decideAndStart(): Promise<PlayerInstance | null> {
    let useCustomUI = source!.provider === 'youtube';
    if (source!.provider === 'vimeo') {
      if (vimeoMode === 'custom') useCustomUI = true;
      else if (vimeoMode === 'native') useCustomUI = false;
      else {
        // auto — wait for tier info
        const { tier } = await posterPromise;
        useCustomUI = !!tier && tier !== 'basic';
      }
    }
    return startPlayer(slot, source!, opts, state, useCustomUI);
  }

  // disposed flag covers all three branches below: GDPR, autoplay,
  // and click-to-play. Each races an in-flight decideAndStart() that
  // resolves after destroy() may have been called. The flag lets the
  // resolved value clean itself up immediately instead of orphaning.
  let disposed = false;

  // GDPR-blocking branch
  if (consentMode === 'required' && !isConsented(source.provider)) {
    let started: PlayerInstance | null = null;
    const cleanup = showConsentGate(slot, source.provider, async () => {
      cleanup();
      started = await decideAndStart();
      if (disposed) started?.destroy();
    });
    return {
      destroy() {
        disposed = true;
        cleanup();
        started?.destroy();
      },
    };
  }

  if (wantsAutoplay) {
    let started: PlayerInstance | null = null;
    decideAndStart().then((p) => {
      started = p;
      if (disposed) started?.destroy();
    });
    return {
      destroy() {
        disposed = true;
        started?.destroy();
      },
    };
  }

  // Click-to-play (default)
  let started: PlayerInstance | null = null;
  slot.style.cursor = 'pointer';
  async function onClick(): Promise<void> {
    started = await decideAndStart();
    if (disposed) started?.destroy();
  }
  slot.addEventListener('click', onClick, { once: true });
  return {
    destroy() {
      disposed = true;
      slot.removeEventListener('click', onClick);
      started?.destroy();
    },
  };
}

export const flowPlayer3Defaults: PlayerOpts['defaults'] = {
  muted: false,
  loop: false,
  playsinline: true,
  showControls: true,
  keyboardShortcuts: true,
  autoHide: true,
  idleTimeoutMs: 2500,
};
