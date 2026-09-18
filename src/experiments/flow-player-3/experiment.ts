// ============================================================
// flow-player-3 preview — mirrors what the Webflow export ships.
// Builds either the 5-node tree (Option 1) or the ~80-node tree
// (Option 2) from the same source of truth used by generateExport.
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import { PLAY_TRIANGLE_BIG, ICONS } from './icons.ts';
import { renderCssBlock } from './styles.ts';
import { attachSlot, flowPlayer3Defaults } from './ui/Player.ts';
import type { PlayerInstance } from './ui/Player.ts';

const STYLE_TAG_ID = 'flow-player-3-styles';

function ensureStyles(): void {
  let style = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    document.head.appendChild(style);
  }
  style.textContent = renderCssBlock();
}

function el(tag: string, className?: string, attrs?: Record<string, string>): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

/** Build the always-present nodes (poster + play overlay + consent + loading). */
function buildBaseStructure(slot: HTMLElement): void {
  const poster = el('div', 'vp-poster');
  slot.appendChild(poster);

  const play = el('div', 'vp-play');
  play.innerHTML = PLAY_TRIANGLE_BIG;
  slot.appendChild(play);

const consent = el('div', 'vp-consent');
  const inner = el('div', 'vp-consent-inner');
  const title = el('h4', 'vp-consent-title');
  title.textContent = 'Load video';
  const body = el('p', 'vp-consent-body');
  body.textContent =
    'Loading the player will send your IP address and browser information to the video provider.';
  const accept = el('button', 'vp-consent-accept', { type: 'button' });
  accept.textContent = 'Accept and play';
  inner.appendChild(title);
  inner.appendChild(body);
  inner.appendChild(accept);
  consent.appendChild(inner);
  slot.appendChild(consent);
}

/** Build the Webflow-elements control bar (Option 2 only). */
function buildOption2Controls(slot: HTMLElement): void {
  const bar = el('div', 'vp-controls', { role: 'group', 'aria-label': 'Video controls' });

  const btn = (cls: string, dataVp: string, ariaLabel: string, innerHtml: string): HTMLElement => {
    const b = el('button', `vp-control ${cls}`, {
      type: 'button',
      'aria-label': ariaLabel,
      'data-vp': dataVp,
    });
    b.innerHTML = innerHtml;
    return b;
  };

  // Play
  bar.appendChild(
    btn(
      'vp-btn-play',
      'play',
      'Play',
      `<span class="vp-icon-play">${ICONS.play}</span><span class="vp-icon-pause">${ICONS.pause}</span>`,
    ),
  );
  bar.appendChild(btn('vp-btn-restart', 'restart', 'Restart', ICONS.restart));

  // Progress
  const progress = el('div', 'vp-progress', { 'data-vp': 'progress' });
  const track = el('div', 'vp-progress-track');
  track.appendChild(el('div', 'vp-progress-buffer'));
  track.appendChild(el('div', 'vp-progress-fill'));
  progress.appendChild(track);
  progress.appendChild(el('div', 'vp-progress-thumb'));
  const range = el('input', 'vp-progress-range') as HTMLInputElement;
  range.type = 'range';
  range.min = '0';
  range.max = '1';
  range.step = '0.0001';
  range.value = '0';
  range.setAttribute('aria-label', 'Seek');
  progress.appendChild(range);
  bar.appendChild(progress);

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

  // Captions
  bar.appendChild(btn('vp-btn-captions', 'captions', 'Toggle captions', ICONS.captionsOn));

  // Volume group
  const vol = el('div', 'vp-volume-group');
  vol.appendChild(
    btn(
      'vp-btn-mute',
      'mute',
      'Mute',
      `<span class="vp-icon-vol-full">${ICONS.volumeFull}</span><span class="vp-icon-vol-mid">${ICONS.volumeMid}</span><span class="vp-icon-vol-mute">${ICONS.volumeMute}</span>`,
    ),
  );
  const volRange = el('input', 'vp-volume', { 'data-vp': 'volume' }) as HTMLInputElement;
  volRange.type = 'range';
  volRange.min = '0';
  volRange.max = '1';
  volRange.step = '0.01';
  volRange.value = '1';
  volRange.setAttribute('aria-label', 'Volume');
  vol.appendChild(volRange);
  bar.appendChild(vol);

  // Settings
  const settings = el('div', 'vp-settings');
  settings.appendChild(btn('vp-btn-settings', 'settings', 'Settings', ICONS.settings));
  const menu = el('div', 'vp-settings-menu', { role: 'menu' });
  (menu as HTMLDivElement).hidden = true;
  settings.appendChild(menu);
  bar.appendChild(settings);

  // PiP (Vimeo only — JS hides for YouTube)
  bar.appendChild(btn('vp-btn-pip', 'pip', 'Picture in picture', ICONS.pip));

  // Fullscreen
  bar.appendChild(
    btn(
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
  ensureStyles();

  const parent = canvas.parentElement ?? document.body;

  const root = document.createElement('div');
  root.className = 'flow-player-3-preview';
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
    Object.assign(slot.style, {
      position: 'relative',
      width: '100%',
      aspectRatio: '16 / 9',
    });

    slot.setAttribute('data-vimeo-url', String(params.videoUrl ?? ''));
    const uiMode = (params.uiMode as string) === 'webflow' ? 'webflow' : 'js';
    slot.setAttribute('data-ui-mode', uiMode);
    slot.setAttribute('data-vimeo-mode', String(params.vimeoMode ?? 'auto'));
    slot.setAttribute('data-autoplay', params.autoplay ? 'true' : 'false');
    slot.setAttribute('data-show-title', params.showTitle ? 'true' : 'false');
    const accent = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(accent)) slot.setAttribute('data-accent-color', accent);
    const thumb = String(params.thumbColor ?? '').replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(thumb)) slot.setAttribute('data-thumb-color', thumb);
    if (params.consent === 'required') slot.setAttribute('data-consent', 'required');
    if (params.muted) slot.setAttribute('data-muted', 'true');
    if (params.loop) slot.setAttribute('data-loop', 'true');
    if (params.playsinline === false) slot.setAttribute('data-playsinline', 'false');
    if (params.showControls === false) slot.setAttribute('data-show-controls', 'false');

    buildBaseStructure(slot);
    if (uiMode === 'webflow') buildOption2Controls(slot);

    wrapper.appendChild(slot);
    currentSlot = slot;

    currentInstance = attachSlot(slot, {
      defaults: {
        ...flowPlayer3Defaults,
        keyboardShortcuts: !!params.keyboardShortcuts,
        autoHide: !!params.autoHide,
        idleTimeoutMs:
          ((params.idleTimeout as number) ?? flowPlayer3Defaults.idleTimeoutMs / 1000) * 1000,
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

export const flowPlayer3Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
