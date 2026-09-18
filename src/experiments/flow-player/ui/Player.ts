// ============================================================
// Player — top-level orchestrator that turns a slot element into
// a working video player.
//
// Responsibilities:
//   - read data-* attributes off the slot
//   - apply accent color
//   - load auto-poster
//   - on click (or autoplay): create iframe + provider, attach
//     control bar, bind keyboard, wire fullscreen, set up idle hide
//   - if data-consent="required" and not yet consented: show consent
//     gate first; on accept, proceed to load
// ============================================================

import type { VideoSource } from '../helpers.ts';
import { buildIframeSrc, parseVideoUrl } from '../helpers.ts';
import { createProvider } from '../providers/createProvider.ts';
import { createControlBar, setFullscreenState } from './ControlBar.ts';
import { createFullscreen } from './Fullscreen.ts';
import { bindKeyboard } from './Keyboard.ts';
import { showConsentGate, isConsented } from './ConsentGate.ts';
import { loadPoster } from './PosterLoader.ts';

interface PlayerOpts {
  /** Defaults baked into the boot script for less common settings. */
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

function applyColors(slot: HTMLElement): void {
  // Accent — used by the played-fill, focus rings, hover states,
  // and the big play triangle.
  const accent = slot.getAttribute('data-accent-color') || '';
  const accentHex = accent.replace(/^#/, '').slice(0, 6);
  if (/^[0-9a-fA-F]{6}$/.test(accentHex)) {
    slot.style.setProperty('--vp-accent', '#' + accentHex);
    const play = slot.querySelector<HTMLElement>('.vp-play');
    if (play) play.style.color = '#' + accentHex;
  }
  // Thumb — the scrubber dot and the volume thumb.
  const thumb = slot.getAttribute('data-thumb-color') || '';
  const thumbHex = thumb.replace(/^#/, '').slice(0, 6);
  if (/^[0-9a-fA-F]{6}$/.test(thumbHex)) {
    slot.style.setProperty('--vp-thumb-color', '#' + thumbHex);
  }
}

function bindIdleHide(
  slot: HTMLElement,
  bar: HTMLElement,
  enabled: boolean,
  delayMs: number,
): () => void {
  if (!enabled) return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  let hovering = false;
  let menuOpen = false;
  let paused = true;

  function show(): void {
    bar.classList.remove('vp-controls--idle');
  }
  function hide(): void {
    if (paused || hovering || menuOpen) return;
    bar.classList.add('vp-controls--idle');
  }
  function reset(): void {
    show();
    if (timer) clearTimeout(timer);
    timer = setTimeout(hide, delayMs);
  }

  function onPointer(): void {
    reset();
  }
  function onPointerEnter(): void {
    hovering = true;
    show();
  }
  function onPointerLeave(): void {
    hovering = false;
    reset();
  }
  function onPlay(): void {
    paused = false;
    reset();
  }
  function onPause(): void {
    paused = true;
    show();
  }

  // Track menu open state by watching aria-expanded on the trigger.
  const settingsBtn = bar.querySelector<HTMLButtonElement>('.vp-settings-btn');
  let observer: MutationObserver | null = null;
  if (settingsBtn) {
    observer = new MutationObserver(() => {
      menuOpen = settingsBtn.getAttribute('aria-expanded') === 'true';
      if (!menuOpen) reset();
    });
    observer.observe(settingsBtn, { attributes: true, attributeFilter: ['aria-expanded'] });
  }

  slot.addEventListener('pointermove', onPointer);
  slot.addEventListener('touchstart', onPointer, { passive: true });
  bar.addEventListener('pointerenter', onPointerEnter);
  bar.addEventListener('pointerleave', onPointerLeave);

  return () => {
    if (timer) clearTimeout(timer);
    observer?.disconnect();
    slot.removeEventListener('pointermove', onPointer);
    slot.removeEventListener('touchstart', onPointer);
    bar.removeEventListener('pointerenter', onPointerEnter);
    bar.removeEventListener('pointerleave', onPointerLeave);
    void onPlay;
    void onPause;
  };
}

export interface PlayerInstance {
  destroy(): void;
}

/**
 * Spin up the actual playing player. Three branches:
 *
 *   YouTube (any video):                    custom UI ✓
 *   Vimeo with data-vimeo-pro="true":       custom UI ✓
 *   Vimeo without data-vimeo-pro (default): native UI (just embed iframe)
 *
 * The native-UI branch exists because Vimeo's `controls=0` is silently
 * ignored on free-tier accounts (account-tier gated). Trying to overlay
 * our bar in that case results in two stacked control bars. So when we
 * can't reliably hide Vimeo's chrome, we just use it.
 */
export function startPlayer(
  slot: HTMLElement,
  source: VideoSource,
  opts: PlayerOpts,
): PlayerInstance {
  if (slot.dataset.vpPlaying === '1') return { destroy: () => {} };
  slot.dataset.vpPlaying = '1';

  const slotOpts = readSlotOpts(slot, opts.defaults);

  // Decide rendering mode.
  const useCustomUI =
    source.provider === 'youtube' || attrBool(slot, 'data-vimeo-pro', false);

  // Hide poster + overlay play button — user clicked play, we're loading.
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
    // Custom UI mode → ask provider to hide its chrome.
    // Native UI mode  → keep provider's chrome visible.
    showControls: useCustomUI ? false : true,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
  slot.appendChild(iframe);

  // Native UI branch: just the iframe. No provider, no control bar,
  // no keyboard, no fullscreen helper, no spinner. Vimeo handles all
  // of it. Lightweight.
  if (!useCustomUI) {
    return {
      destroy() {
        if (iframe.parentElement) iframe.parentElement.removeChild(iframe);
        slot.dataset.vpPlaying = '';
        if (poster) poster.style.display = '';
        if (overlayPlay) overlayPlay.style.display = '';
      },
    };
  }

  // ── Custom UI branch (YouTube + Vimeo Pro) ──

  const provider = createProvider(source.provider, iframe);
  provider.ready().then(() => {
    if (slotOpts.muted) provider.setMuted(true);
  });

  // Loading spinner — show during initial buffering and any subsequent
  // stalls. Use existing .vp-loading element if the user added one to
  // the slot in Webflow; otherwise create a default.
  let spinner = slot.querySelector<HTMLElement>('.vp-loading');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.className = 'vp-loading';
    spinner.innerHTML = '<span class="vp-loading-spinner"></span>';
    slot.appendChild(spinner);
  }
  spinner.style.display = '';
  // Hide spinner once the iframe starts playing.
  let firstPlayingFired = false;
  function hideSpinner(): void {
    if (spinner) spinner.style.display = 'none';
  }
  function showSpinner(): void {
    if (spinner) spinner.style.display = '';
  }
  const offBuffering = provider.on('buffering', showSpinner);
  const offPlaying = provider.on('playing', () => {
    firstPlayingFired = true;
    hideSpinner();
  });
  const offPlayHide = provider.on('play', () => {
    if (firstPlayingFired) hideSpinner();
  });
  const offPause = provider.on('pause', hideSpinner);

  // Fullscreen
  const fs = createFullscreen(slot, (active) => {
    setFullscreenState(controls.el, active);
  });

  // Control bar
  const controls = createControlBar({
    provider,
    providerName: source.provider,
    fullscreen: fs,
    showControls: slotOpts.showControls,
  });
  slot.appendChild(controls.el);

  // Keyboard shortcuts (only when slot can receive focus)
  let unbindKb = () => {};
  if (opts.defaults.keyboardShortcuts) {
    unbindKb = bindKeyboard(slot, provider, { fullscreen: fs });
  }

  // Idle-hide of the bar
  const unbindIdle = bindIdleHide(
    slot,
    controls.el,
    opts.defaults.autoHide && slotOpts.showControls,
    opts.defaults.idleTimeoutMs,
  );

  return {
    destroy() {
      offBuffering();
      offPlaying();
      offPlayHide();
      offPause();
      unbindIdle();
      unbindKb();
      fs.destroy();
      controls.destroy();
      provider.destroy();
      if (iframe.parentElement) iframe.parentElement.removeChild(iframe);
      if (spinner) spinner.style.display = 'none';
      slot.dataset.vpPlaying = '';
      if (poster) poster.style.display = '';
      if (overlayPlay) overlayPlay.style.display = '';
    },
  };
}

/**
 * Attach the player to a slot — either start playing immediately
 * (autoplay) or wait for the first user click. Handles GDPR consent
 * gating before any iframe is loaded.
 */
export function attachSlot(slot: HTMLElement, opts: PlayerOpts): PlayerInstance | null {
  if (slot.dataset.vpInit === '1') return null;
  const url = slot.getAttribute('data-vimeo-url')
    || slot.getAttribute('data-video-url')
    || slot.getAttribute('data-youtube-url')
    || '';
  const source = parseVideoUrl(url);
  if (!source) return null;
  slot.dataset.vpInit = '1';

  applyColors(slot);
  // Fire and forget — poster shows as soon as oEmbed responds.
  loadPoster(slot, source);

  const consentMode = (slot.getAttribute('data-consent') || 'off') as
    | 'off'
    | 'required';
  const wantsAutoplay = attrBool(slot, 'data-autoplay', false);

  function actuallyStart(): PlayerInstance | null {
    return startPlayer(slot, source!, opts);
  }

  // GDPR-blocking branch: if required and not yet consented, show gate.
  if (consentMode === 'required' && !isConsented(source.provider)) {
    let started: PlayerInstance | null = null;
    const cleanup = showConsentGate(slot, source.provider, () => {
      cleanup();
      started = actuallyStart();
    });
    return {
      destroy() {
        cleanup();
        started?.destroy();
      },
    };
  }

  if (wantsAutoplay) {
    return actuallyStart();
  }

  // Click-to-play (the default UX)
  let started: PlayerInstance | null = null;
  slot.style.cursor = 'pointer';
  function onClick(): void {
    started = actuallyStart();
  }
  slot.addEventListener('click', onClick, { once: true });
  return {
    destroy() {
      slot.removeEventListener('click', onClick);
      started?.destroy();
    },
  };
}

export const flowPlayerDefaults: PlayerOpts['defaults'] = {
  muted: false,
  loop: false,
  playsinline: true,
  showControls: true,
  keyboardShortcuts: true,
  autoHide: true,
  idleTimeoutMs: 2500,
};
