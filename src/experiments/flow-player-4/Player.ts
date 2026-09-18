// ============================================================
// Player — top-level orchestrator.
//
// Per slot, decides:
//   1. Provider from the URL (vimeo / youtube / hls / mp4).
//   2. Whether to show our custom chrome:
//        youtube / hls / mp4    → always custom
//        vimeo + tier=pro+      → custom
//        vimeo + tier=basic     → native (free tier can't hide its UI)
//        data-vimeo-mode        → trump auto-decision
//   3. UI mode for the custom chrome:
//        data-ui-mode="webflow" → bind designer-built tree (DomControlBar)
//        else                   → render JS bar (JsControlBar)
//   4. The element to create:
//        vimeo / youtube → <iframe>
//        hls / mp4       → <video>
//
// No consent gate in v4 — designers can use a third-party consent
// manager + data-autoplay="false" if they need GDPR compliance.
// ============================================================

import type { VideoSource } from './helpers.ts';
import { buildIframeSrc, parseVideoUrl } from './helpers.ts';
import { createProvider } from './providers/createProvider.ts';
import { createStateBridge, type StateBridge } from './StateBridge.ts';
import { createJsControlBar, setJsControlsFullscreen } from './JsControlBar.ts';
import { bindDomControlBar, setDomControlsFullscreen } from './DomControlBar.ts';
import { createFullscreen } from './Fullscreen.ts';
import { bindKeyboard } from './Keyboard.ts';
import { loadPoster } from './PosterLoader.ts';

export interface PlayerDefaults {
  muted: boolean;
  loop: boolean;
  playsinline: boolean;
  showControls: boolean;
  keyboardShortcuts: boolean;
  autoHide: boolean;
  idleTimeoutMs: number;
}

interface PlayerOpts {
  defaults: PlayerDefaults;
}

function attrBool(el: HTMLElement, name: string, fallback: boolean): boolean {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  return v === '' || v === 'true' || v === '1';
}

function readSlotOpts(slot: HTMLElement, defaults: PlayerDefaults) {
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
 * Apply per-slot color tokens. A synchronous pre-paint script in the
 * Webflow export sets these vars before first paint to prevent the
 * blue-play-button flash (v3 FOUC). This runs again on init for
 * preview parity.
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
  state: StateBridge,
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
  slot.addEventListener('pointermove', reset);
  slot.addEventListener('touchstart', reset, { passive: true });
  return () => {
    if (timer) clearTimeout(timer);
    slot.removeEventListener('pointermove', reset);
    slot.removeEventListener('touchstart', reset);
  };
}

function createMediaElement(
  source: VideoSource,
  slotOpts: ReturnType<typeof readSlotOpts>,
  useCustomUI: boolean,
): HTMLIFrameElement | HTMLVideoElement {
  if (source.provider === 'vimeo' || source.provider === 'youtube') {
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
      showControls: !useCustomUI,
      origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
    return iframe;
  }

  // hls / mp4 → <video>
  const video = document.createElement('video');
  video.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;background:#000;z-index:1;object-fit:cover;';
  video.playsInline = slotOpts.playsinline;
  if (slotOpts.muted) video.muted = true;
  if (slotOpts.loop) video.loop = true;
  // Native controls only when the user explicitly opted out of our chrome.
  video.controls = !useCustomUI;
  return video;
}

export interface PlayerInstance {
  destroy(): void;
}

function startPlayer(
  slot: HTMLElement,
  source: VideoSource,
  opts: PlayerOpts,
  state: StateBridge,
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

  const media = createMediaElement(source, slotOpts, useCustomUI);
  slot.appendChild(media);

  // Native UI branch — Vimeo basic tier or designer opted out. No
  // provider, no control bar.
  if (!useCustomUI) {
    if (media instanceof HTMLVideoElement) {
      // Native <video> autoplay needs muted.
      if (slotOpts.autoplay) {
        if (!media.muted) media.muted = true;
        void media.play().catch(() => {});
      }
    }
    return {
      destroy() {
        if (media.parentElement) media.parentElement.removeChild(media);
        if (poster) poster.style.display = '';
        if (overlayPlay) overlayPlay.style.display = '';
      },
    };
  }

  // ── Custom UI branch ──
  const provider = createProvider(source, media);
  void provider.ready().then(() => {
    if (slotOpts.muted) provider.setMuted(true);
    // For <video> sources, click-to-play was already a user gesture so
    // play() is allowed unmuted. For autoplay, we muted above.
    provider.play();
  });

  const fs = createFullscreen(slot, state);

  let controls: { el: HTMLElement | null; destroy: () => void };
  let setControlsFullscreen: (active: boolean) => void;
  if (uiMode === 'webflow') {
    const handles = bindDomControlBar({ slot, provider, fullscreen: fs, state });
    controls = { el: handles.el, destroy: handles.destroy };
    setControlsFullscreen = (active) => setDomControlsFullscreen(controls.el, active);
  } else {
    const handles = createJsControlBar({
      provider,
      fullscreen: fs,
      state,
      showControls: slotOpts.showControls,
    });
    slot.appendChild(handles.el);
    controls = { el: handles.el, destroy: handles.destroy };
    setControlsFullscreen = (active) => setJsControlsFullscreen(handles.el, active);
  }

  // Fullscreen helper writes data-fullscreen; mirror to the bar.
  const fsObserver = new MutationObserver(() => {
    setControlsFullscreen(slot.getAttribute('data-fullscreen') === 'true');
  });
  fsObserver.observe(slot, { attributes: true, attributeFilter: ['data-fullscreen'] });

  let unbindKb = (): void => {};
  if (opts.defaults.keyboardShortcuts) {
    unbindKb = bindKeyboard(slot, provider, { fullscreen: fs });
  }

  const unbindIdle = bindIdleHide(
    slot,
    controls.el,
    state,
    opts.defaults.autoHide && slotOpts.showControls,
    opts.defaults.idleTimeoutMs,
  );

  // Buffering state passthrough — drives spinner CSS in some themes.
  const offBuffer = provider.on('buffering', () => state.setBuffering(true));
  const offPlaying = provider.on('playing', () => state.setBuffering(false));

  return {
    destroy() {
      fsObserver.disconnect();
      unbindIdle();
      unbindKb();
      offBuffer();
      offPlaying();
      fs.destroy();
      controls.destroy();
      provider.destroy();
      if (media.parentElement) media.parentElement.removeChild(media);
      if (poster) poster.style.display = '';
      if (overlayPlay) overlayPlay.style.display = '';
    },
  };
}

export function attachSlot(slot: HTMLElement, opts: PlayerOpts): PlayerInstance | null {
  const state = createStateBridge(slot);
  if (state.inited) return null;

  const url =
    slot.getAttribute('data-video-url') ||
    slot.getAttribute('data-vimeo-url') ||
    slot.getAttribute('data-youtube-url') ||
    '';
  const source = parseVideoUrl(url);
  if (!source) return null;

  state.setInit();
  state.setState('idle');

  applyColors(slot);

  // Kick off poster + Vimeo tier fetch in parallel.
  const posterPromise = loadPoster(slot, source, state);

  const wantsAutoplay = attrBool(slot, 'data-autoplay', false);
  const vimeoMode = (slot.getAttribute('data-vimeo-mode') || 'auto') as
    | 'auto'
    | 'custom'
    | 'native';

  async function decideAndStart(): Promise<PlayerInstance | null> {
    // Default: custom UI for everything we can fully control.
    let useCustomUI = source!.provider !== 'vimeo';
    if (source!.provider === 'vimeo') {
      if (vimeoMode === 'custom') useCustomUI = true;
      else if (vimeoMode === 'native') useCustomUI = false;
      else {
        const { tier } = await posterPromise;
        useCustomUI = !!tier && tier !== 'basic';
      }
    }
    return startPlayer(slot, source!, opts, state, useCustomUI);
  }

  let disposed = false;

  if (wantsAutoplay) {
    let started: PlayerInstance | null = null;
    void decideAndStart().then((p) => {
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

export const flowPlayer4Defaults: PlayerDefaults = {
  muted: false,
  loop: false,
  playsinline: true,
  showControls: true,
  keyboardShortcuts: true,
  autoHide: true,
  idleTimeoutMs: 2500,
};
