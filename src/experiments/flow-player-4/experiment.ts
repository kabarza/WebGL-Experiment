// ============================================================
// flow-player-4 preview — mirrors what the Webflow export ships.
// Builds the slot tree from the same source of truth used by
// generateExport, then hands it to Player.attachSlot for parity.
//
// V4 differences vs v3:
//   - No restart, captions, PiP, consent in the tree.
//   - div[role=button] instead of <button>.
//   - div-based scrubbers instead of <input type=range>.
//   - CSS injected via injectRuntimeCss (single bundle path).
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import { PLAY_TRIANGLE_BIG, ICONS } from './icons.ts';
import { injectRuntimeCss } from './styles.ts';
import { attachSlot, flowPlayer4Defaults, type PlayerInstance } from './Player.ts';

function el(tag: string, className?: string, attrs?: Record<string, string>): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function makeRoleButton(
  className: string,
  dataVp: string,
  ariaLabel: string,
  innerHtml: string,
): HTMLElement {
  const b = el('div', `vp-control ${className}`, {
    role: 'button',
    tabindex: '0',
    'aria-label': ariaLabel,
    'data-vp': dataVp,
  });
  b.innerHTML = innerHtml;
  return b;
}

/** Always-present slot structure: poster + overlay play. */
function buildBaseStructure(slot: HTMLElement): void {
  slot.appendChild(el('div', 'vp-poster'));
  const play = el('div', 'vp-play');
  play.innerHTML = PLAY_TRIANGLE_BIG;
  slot.appendChild(play);
}

/** Build the Webflow-elements control bar (uiMode=webflow only). */
function buildWebflowControls(slot: HTMLElement): void {
  const bar = el('div', 'vp-controls', { role: 'group', 'aria-label': 'Video controls' });

  // Play
  bar.appendChild(
    makeRoleButton(
      'vp-btn-play',
      'play',
      'Play',
      `<span class="vp-icon-play">${ICONS.play}</span><span class="vp-icon-pause">${ICONS.pause}</span>`,
    ),
  );

  // Scrubber (div-based)
  const scrub = el('div', 'vp-scrub', { 'data-vp': 'progress', role: 'slider', tabindex: '0' });
  scrub.appendChild(el('div', 'vp-scrub-buffered'));
  scrub.appendChild(el('div', 'vp-scrub-played'));
  scrub.appendChild(el('div', 'vp-scrub-thumb'));
  bar.appendChild(scrub);

  // Time
  const time = el('div', 'vp-time');
  const tCur = el('span', 'vp-time-current');
  tCur.textContent = '0:00';
  const tSep = el('span', 'vp-time-sep');
  tSep.textContent = ' / ';
  const tDur = el('span', 'vp-time-duration');
  tDur.textContent = '0:00';
  time.appendChild(tCur);
  time.appendChild(tSep);
  time.appendChild(tDur);
  bar.appendChild(time);

  // Volume group
  const vol = el('div', 'vp-volume-group');
  vol.appendChild(
    makeRoleButton(
      'vp-btn-mute',
      'mute',
      'Mute',
      `<span class="vp-icon-vol-full">${ICONS.volumeFull}</span><span class="vp-icon-vol-mid">${ICONS.volumeMid}</span><span class="vp-icon-vol-mute">${ICONS.volumeMute}</span>`,
    ),
  );
  const volScrub = el('div', 'vp-volume', { 'data-vp': 'volume', role: 'slider', tabindex: '0' });
  volScrub.appendChild(el('div', 'vp-volume-fill'));
  volScrub.appendChild(el('div', 'vp-volume-thumb'));
  vol.appendChild(volScrub);
  bar.appendChild(vol);

  // Settings
  const settings = el('div', 'vp-settings');
  settings.appendChild(makeRoleButton('vp-btn-settings', 'settings', 'Settings', ICONS.settings));
  const menu = el('div', 'vp-settings-menu', { role: 'menu' });
  (menu as HTMLDivElement).hidden = true;
  settings.appendChild(menu);
  bar.appendChild(settings);

  // Fullscreen
  bar.appendChild(
    makeRoleButton(
      'vp-btn-fullscreen',
      'fullscreen',
      'Enter fullscreen',
      `<span class="vp-icon-fs-enter">${ICONS.fullscreenEnter}</span><span class="vp-icon-fs-exit">${ICONS.fullscreenExit}</span>`,
    ),
  );

  slot.appendChild(bar);
}

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  canvas.style.pointerEvents = 'none';
  gl.clearColor(0, 0, 0, 1);
  injectRuntimeCss();

  const parent = canvas.parentElement ?? document.body;

  const root = document.createElement('div');
  root.className = 'flow-player-4-preview';
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

    slot.setAttribute('data-video-url', String(params.videoUrl ?? ''));
    const uiMode = (params.uiMode as string) === 'webflow' ? 'webflow' : 'js';
    slot.setAttribute('data-ui-mode', uiMode);
    slot.setAttribute('data-vimeo-mode', String(params.vimeoMode ?? 'auto'));
    if (params.autoplay) slot.setAttribute('data-autoplay', 'true');
    if (params.showTitle) slot.setAttribute('data-show-title', 'true');

    const accent = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(accent)) slot.setAttribute('data-accent-color', accent);
    const thumb = String(params.thumbColor ?? '').replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(thumb)) slot.setAttribute('data-thumb-color', thumb);

    if (params.posterUrl) slot.setAttribute('data-poster', String(params.posterUrl));
    if (params.muted) slot.setAttribute('data-muted', 'true');
    if (params.loop) slot.setAttribute('data-loop', 'true');
    if (params.playsinline === false) slot.setAttribute('data-playsinline', 'false');
    if (params.showControls === false) slot.setAttribute('data-show-controls', 'false');

    buildBaseStructure(slot);
    if (uiMode === 'webflow') buildWebflowControls(slot);

    wrapper.appendChild(slot);
    currentSlot = slot;

    currentInstance = attachSlot(slot, {
      defaults: {
        ...flowPlayer4Defaults,
        keyboardShortcuts: !!params.keyboardShortcuts,
      },
    });
  }

  rebuild();

  function snapshot(): string {
    return [
      params.videoUrl,
      params.uiMode,
      params.vimeoMode,
      params.accentColor,
      params.thumbColor,
      params.posterUrl,
      params.autoplay,
      params.muted,
      params.loop,
      params.playsinline,
      params.showControls,
      params.showTitle,
      params.keyboardShortcuts,
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

export const flowPlayer4Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
