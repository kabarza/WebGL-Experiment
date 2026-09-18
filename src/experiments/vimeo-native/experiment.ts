// ============================================================
// vimeo-native — preview that mirrors the exported component 1:1
//
// The DOM and boot logic here are deliberately identical to what
// `generateExport.ts` writes into the Webflow JSON:
//
//   .vimeo-native (slot, position:relative, 16:9, black, 8px radius)
//     ├─ .vimeo-native-poster (auto-fills with Vimeo's thumbnail)
//     └─ .vimeo-native-play   (centered SVG, currentColor on triangle)
//
// Behavior is identical too: poster + play button until the user
// clicks (or autoplay fires), at which point the iframe is created
// with autoplay=1, the poster + button hide, the iframe takes over.
//
// Difference vs. production: the preview rebuilds the slot whenever
// any dial value changes. That's the "fresh page load" semantic —
// what a visitor would see if you republished with the new values
// right now. No mid-flight reconfiguration; matches Webflow exactly.
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import { parseVimeoId, buildVimeoSrc } from './helpers.ts';

// Same SVG that the export ships. fill="currentColor" on the play
// triangle lets the boot logic tint it from data-accent-color.
const PLAY_SVG = `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72" aria-hidden="true">
  <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.92)" stroke-width="2"/>
  <polygon points="33,25 33,55 60,40" fill="currentColor"/>
</svg>`;

interface SlotOpts {
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  playsinline: boolean;
  showControls: boolean;
  showTitle: boolean;
  showByline: boolean;
  showPortrait: boolean;
  accentColor: string;
}

function attrBool(el: HTMLElement, name: string, fallback: boolean): boolean {
  const v = el.getAttribute(name);
  if (v === null) return fallback;
  return v === '' || v === 'true' || v === '1';
}

function readOpts(slot: HTMLElement): SlotOpts {
  return {
    autoplay:     attrBool(slot, 'data-autoplay',      false),
    muted:        attrBool(slot, 'data-muted',         false),
    loop:         attrBool(slot, 'data-loop',          false),
    playsinline:  attrBool(slot, 'data-playsinline',   true),
    showControls: attrBool(slot, 'data-show-controls', true),
    showTitle:    attrBool(slot, 'data-show-title',    false),
    showByline:   attrBool(slot, 'data-show-byline',   false),
    showPortrait: attrBool(slot, 'data-show-portrait', false),
    accentColor:  slot.getAttribute('data-accent-color') || '',
  };
}

function applyAccent(slot: HTMLElement): void {
  const accent = slot.getAttribute('data-accent-color') || '';
  const hex = accent.replace(/^#/, '').slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return;
  const btn = slot.querySelector<HTMLElement>('.vimeo-native-play');
  if (btn) btn.style.color = '#' + hex;
}

function loadPoster(slot: HTMLElement, id: string): void {
  const poster = slot.querySelector<HTMLElement>('.vimeo-native-poster');
  if (!poster) return;
  if (poster.children.length > 0) return;
  const oembed =
    'https://vimeo.com/api/oembed.json?url=' +
    encodeURIComponent('https://vimeo.com/' + id) +
    '&width=1280';
  fetch(oembed)
    .then((r) => (r.ok ? r.json() : null))
    .then((data: { thumbnail_url?: string } | null) => {
      if (!data?.thumbnail_url) return;
      poster.style.backgroundImage = `url('${data.thumbnail_url.replace(/'/g, "\\'")}')`;
      poster.style.backgroundSize = 'cover';
      poster.style.backgroundPosition = 'center';
    })
    .catch(() => {
      /* ignore — poster stays blank */
    });
}

function play(slot: HTMLElement): void {
  if (slot.getAttribute('data-vimeo-playing') === '1') return;
  const url = slot.getAttribute('data-vimeo-url') || '';
  const id = parseVimeoId(url);
  if (!id) return;
  const opts = readOpts(slot);

  const iframe = document.createElement('iframe');
  iframe.allowFullscreen = true;
  iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
  iframe.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;';
  // Force autoplay on click/init since the user gesture allows it.
  iframe.src = buildVimeoSrc(id, { ...opts, autoplay: true });
  slot.appendChild(iframe);

  const poster = slot.querySelector<HTMLElement>('.vimeo-native-poster');
  if (poster) poster.style.display = 'none';
  const btn = slot.querySelector<HTMLElement>('.vimeo-native-play');
  if (btn) btn.style.display = 'none';
  slot.style.cursor = '';
  slot.setAttribute('data-vimeo-playing', '1');
}

function bootSlot(slot: HTMLElement): void {
  const url = slot.getAttribute('data-vimeo-url') || '';
  const id = parseVimeoId(url);
  if (!id) return;

  applyAccent(slot);
  loadPoster(slot, id);

  if (attrBool(slot, 'data-autoplay', false)) {
    play(slot);
    return;
  }
  slot.style.cursor = 'pointer';
  slot.addEventListener('click', () => play(slot));
}

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  canvas.style.pointerEvents = 'none';
  gl.clearColor(0, 0, 0, 1);

  const parent = canvas.parentElement ?? document.body;

  // Outer preview container — centers the component in the viewport
  // and adds a soft shadow. Not part of what ships to Webflow; the
  // exported component leaves layout decisions to the user.
  const root = document.createElement('div');
  root.className = 'vimeo-native-preview';
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

  // Wrapper sized to a sensible max width for the preview. In Webflow
  // the user controls the wrapper size with their own layout.
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    width: '100%',
    maxWidth: '1280px',
    boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
    borderRadius: '8px',
  });
  root.appendChild(wrapper);

  parent.appendChild(root);

  // Slot rebuild — destroys any in-flight iframe + listeners and
  // creates a fresh slot with the current dial values baked in as
  // data-* attributes. Mirrors what a visitor sees on a fresh page
  // load with those settings.
  let currentSlot: HTMLElement | null = null;

  function buildSlot(): void {
    if (currentSlot && currentSlot.parentElement) {
      currentSlot.parentElement.removeChild(currentSlot);
    }

    const slot = document.createElement('div');
    slot.className = 'vimeo-native';
    Object.assign(slot.style, {
      position: 'relative',
      width: '100%',
      aspectRatio: '16 / 9',
      background: '#000',
      borderRadius: '8px',
      overflow: 'hidden',
    });

    // The four always-surfaced attributes (same as the export).
    slot.setAttribute('data-vimeo-url', String(params.vimeoUrl ?? ''));
    slot.setAttribute('data-autoplay', params.autoplay ? 'true' : 'false');
    slot.setAttribute('data-show-title', params.showTitle ? 'true' : 'false');
    const accentHex = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
    if (/^[0-9a-fA-F]{6}$/.test(accentHex)) {
      slot.setAttribute('data-accent-color', accentHex);
    }

    // Non-promoted attributes — in the export these have built-in
    // defaults inside the boot script's DEFAULTS block. Here we
    // emit them as data-* attrs so readOpts() can read them, only
    // when the dial value differs from the script's built-in default.
    if (params.muted) slot.setAttribute('data-muted', 'true');
    if (params.loop) slot.setAttribute('data-loop', 'true');
    if (params.playsinline === false) slot.setAttribute('data-playsinline', 'false');
    if (params.showControls === false) slot.setAttribute('data-show-controls', 'false');
    if (params.showByline) slot.setAttribute('data-show-byline', 'true');
    if (params.showPortrait) slot.setAttribute('data-show-portrait', 'true');

    const poster = document.createElement('div');
    poster.className = 'vimeo-native-poster';
    Object.assign(poster.style, {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
    });
    slot.appendChild(poster);

    const playBtn = document.createElement('div');
    playBtn.className = 'vimeo-native-play';
    Object.assign(playBtn.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
    });
    playBtn.innerHTML = PLAY_SVG;
    slot.appendChild(playBtn);

    wrapper.appendChild(slot);
    currentSlot = slot;

    bootSlot(slot);
  }

  buildSlot();

  // Snapshot the dial values the slot was built from — when any of
  // them change, rebuild. Cheap string compare each frame.
  function paramSnapshot(): string {
    return [
      params.vimeoUrl,
      params.accentColor,
      params.autoplay,
      params.muted,
      params.loop,
      params.playsinline,
      params.showControls,
      params.showTitle,
      params.showByline,
      params.showPortrait,
    ].join('|');
  }
  let lastSnapshot = paramSnapshot();

  return {
    render(_time: number) {
      gl.clear(gl.COLOR_BUFFER_BIT);
      const snap = paramSnapshot();
      if (snap !== lastSnapshot) {
        lastSnapshot = snap;
        buildSlot();
      }
    },

    resize(w: number, h: number, _dpr: number) {
      gl.viewport(0, 0, w, h);
    },

    dispose() {
      if (root.parentElement) root.parentElement.removeChild(root);
      canvas.style.pointerEvents = '';
    },
  };
}

export const vimeoNativeExperiment: Experiment = {
  meta,
  controls,
  initGL,
};
