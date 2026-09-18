// ============================================================
// flow-player-4 — Webflow JSON export generator.
//
// V4 lessons baked in (vs v3 corruption incident):
//   1. NO tag overrides on Block nodes. Every node is tag='div'.
//      Buttons are div[role=button] tabindex=0. Sliders are div
//      stacks (.vp-scrub-played / .vp-scrub-buffered / .vp-scrub-thumb).
//   2. NO inline <script type="module"> with the bundle. We emit a
//      <script src="<CDN URL>" type="module"> tag pointing at the
//      jsDelivr-hosted flow-player-4.esm.js (a few hundred bytes
//      instead of ~47 KB).
//   3. Smaller tree. js mode: 3 visible nodes (slot/poster/play) +
//      2 embeds (pre-color script, bundle script) + wrapper = 6 nodes.
//      webflow mode: ~16 nodes total.
//   4. Slim style entries — just .vp-slot / .vp-poster / .vp-play
//      get bodies, so layout has correct aspect-ratio / positioning
//      before the bundle loads. All other rules ship in the bundle's
//      injected <style>.
//   5. Synchronous pre-color script kept (200 bytes inline) — applies
//      data-accent-color BEFORE first paint, killing the v3 FOUC.
// ============================================================

import type { DialConfig } from '../../core/Experiment.ts';
import { PLAY_TRIANGLE_BIG } from './icons.ts';
import { FLOW_PLAYER_4_BUNDLE_VERSION } from './standalone.ts';

export interface GenerateExportOptions {
  params: Record<string, unknown>;
  dialConfig: DialConfig;
  slug?: string;
  experimentTitle?: string;
  version?: string;
  /** Override the CDN URL (mostly for staging / local file testing). */
  bundleUrl?: string;
}

// Default — the public GitHub mirror, served via jsDelivr. Once the
// repo is published the URL becomes stable. Until then designers can
// override per-export via the dial.
const DEFAULT_BUNDLE_URL =
  'https://cdn.jsdelivr.net/gh/Kabarza/flow-player-cdn@main/flow-player-4.esm.js';

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface XscpNode {
  _id: string;
  type: string;
  tag: string;
  classes: string[];
  children: string[];
  v?: string;
  data: Record<string, unknown>;
}

interface XAttr {
  name: string;
  value: string;
}

/** All Block nodes use tag='div'. No tag overrides — that's the v3 lesson. */
function block(
  classes: string[],
  children: string[],
  displayName = '',
  xattr: XAttr[] = [],
): XscpNode {
  return {
    _id: uuid(),
    type: 'Block',
    tag: 'div',
    classes,
    children,
    data: {
      tag: 'div',
      text: false,
      devlink: { runtimeProps: {}, slot: '' },
      displayName,
      attr: { id: '' },
      xattr,
      search: { exclude: false },
      visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
    },
  };
}

function htmlEmbedNode(html: string, displayName = ''): XscpNode {
  return {
    _id: uuid(),
    type: 'HtmlEmbed',
    tag: 'div',
    classes: [],
    children: [],
    v: html,
    data: {
      search: { exclude: true },
      embed: {
        type: 'html',
        meta: {
          html,
          div: false,
          script: html.includes('<script'),
          compilable: false,
          iframe: false,
        },
      },
      insideRTE: false,
      content: '',
      devlink: { runtimeProps: {}, slot: '' },
      displayName,
      attr: { id: '' },
      xattr: [],
      visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
    },
  };
}

function textSpan(classes: string[], text: string, displayName = ''): XscpNode {
  return {
    _id: uuid(),
    type: 'Paragraph',
    tag: 'span',
    classes,
    children: [],
    data: {
      tag: 'span',
      text: { html: text, v: text },
      devlink: { runtimeProps: {}, slot: '' },
      displayName,
      attr: { id: '' },
      xattr: [],
      search: { exclude: false },
      visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
    },
  };
}

function buildSlotXAttrs(params: Record<string, unknown>): XAttr[] {
  const accent = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
  const thumb = String(params.thumbColor ?? '').replace(/^#/, '').slice(0, 6);
  const accentValid = /^[0-9a-fA-F]{6}$/.test(accent) ? accent : '';
  const thumbValid = /^[0-9a-fA-F]{6}$/.test(thumb) ? thumb : '';
  const uiMode = params.uiMode === 'webflow' ? 'webflow' : 'js';
  const vimeoMode =
    params.vimeoMode === 'custom' || params.vimeoMode === 'native' ? params.vimeoMode : 'auto';

  const attrs: XAttr[] = [
    { name: 'data-video-url', value: String(params.videoUrl ?? '') },
    { name: 'data-ui-mode', value: uiMode },
    { name: 'data-vimeo-mode', value: vimeoMode as string },
  ];
  if (params.autoplay) attrs.push({ name: 'data-autoplay', value: 'true' });
  if (params.showTitle) attrs.push({ name: 'data-show-title', value: 'true' });
  if (accentValid) attrs.push({ name: 'data-accent-color', value: accentValid });
  if (thumbValid) attrs.push({ name: 'data-thumb-color', value: thumbValid });
  if (params.posterUrl) attrs.push({ name: 'data-poster', value: String(params.posterUrl) });
  if (params.muted) attrs.push({ name: 'data-muted', value: 'true' });
  if (params.loop) attrs.push({ name: 'data-loop', value: 'true' });
  if (params.playsinline === false) attrs.push({ name: 'data-playsinline', value: 'false' });
  if (params.showControls === false) attrs.push({ name: 'data-show-controls', value: 'false' });
  return attrs;
}

// Synchronous pre-color script — runs during HTML parse before the
// bundle loads. Kills the FOUC where the play SVG would flash the
// default --vp-accent color.
const PRE_COLOR_SCRIPT = `<script>(function(){var s=document.querySelectorAll('.vp-slot[data-accent-color], .vp-slot[data-thumb-color]');for(var i=0;i<s.length;i++){var el=s[i];var a=el.getAttribute('data-accent-color');if(a&&/^[0-9a-fA-F]{6}$/.test(a))el.style.setProperty('--vp-accent','#'+a);var t=el.getAttribute('data-thumb-color');if(t&&/^[0-9a-fA-F]{6}$/.test(t))el.style.setProperty('--vp-thumb-color','#'+t);}})();</script>`;

function buildBundleScript(bundleUrl: string): string {
  return `<script type="module" src="${bundleUrl}" data-version="${FLOW_PLAYER_4_BUNDLE_VERSION}"></script>`;
}

interface StyleEntry {
  _id: string;
  name: string;
  styleLess: string;
  fake: boolean;
  type: string;
  namespace: string;
  comb: string;
  variants: Record<string, unknown>;
  children: unknown[];
  createdBy: string;
  origin: null;
  selector: null;
}

// Just the layout-critical class styles. The bundle's injected <style>
// carries everything else (hover, control bar, settings menu, scrubber, etc.).
// Keeping these here means the slot renders at the correct aspect-ratio
// and stacking order even on a slow network before the bundle loads.
const CRITICAL_STYLES: Array<{ name: string; styleLess: string }> = [
  {
    name: 'vp-slot',
    styleLess:
      'position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: #000; outline: none;',
  },
  {
    name: 'vp-poster',
    styleLess: 'position: absolute; inset: 0; pointer-events: none;',
  },
  {
    name: 'vp-play',
    styleLess:
      'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; color: #00b3ff;',
  },
];

// Webflow-mode classes are registered with empty bodies (bundle CSS
// handles visuals). Their existence in the style table lets designers
// see + override them in the Webflow Style panel.
const WEBFLOW_MODE_CLASS_NAMES = [
  'vp-controls',
  'vp-control',
  'vp-btn-play',
  'vp-btn-mute',
  'vp-btn-settings',
  'vp-btn-fullscreen',
  'vp-scrub',
  'vp-scrub-buffered',
  'vp-scrub-played',
  'vp-scrub-thumb',
  'vp-time',
  'vp-time-current',
  'vp-time-sep',
  'vp-time-duration',
  'vp-volume-group',
  'vp-volume',
  'vp-volume-fill',
  'vp-volume-thumb',
  'vp-settings',
  'vp-settings-menu',
];

type ClassIdFn = (name: string) => string[];

function buildStylesArray(uiMode: 'js' | 'webflow'): {
  styles: StyleEntry[];
  classId: ClassIdFn;
} {
  const map = new Map<string, string>();
  const styles: StyleEntry[] = [];

  const register = (name: string, styleLess: string): void => {
    const id = uuid();
    map.set(name, id);
    styles.push({
      _id: id,
      fake: false,
      type: 'class',
      name,
      namespace: '',
      comb: '',
      styleLess,
      variants: {},
      children: [],
      createdBy: '',
      origin: null,
      selector: null,
    });
  };

  for (const c of CRITICAL_STYLES) register(c.name, c.styleLess);
  if (uiMode === 'webflow') {
    for (const n of WEBFLOW_MODE_CLASS_NAMES) register(n, '');
  }

  return {
    styles,
    classId: (name) => {
      const id = map.get(name);
      return id ? [id] : [];
    },
  };
}

// Webflow-mode control bar — pure div tree, NO tag overrides anywhere.
// Visuals + interactivity come from the bundle (CSS + JS attach by class).
function buildWebflowControlBar(nodes: XscpNode[], classId: ClassIdFn): string {
  const cls = (...names: string[]): string[] => names.flatMap(classId);

  // Play button (div role=button)
  const playBtn = block(cls('vp-control', 'vp-btn-play'), [], 'Play / Pause', [
    { name: 'data-vp', value: 'play' },
    { name: 'role', value: 'button' },
    { name: 'tabindex', value: '0' },
    { name: 'aria-label', value: 'Play' },
  ]);
  nodes.push(playBtn);

  // Scrubber
  const scrubBuffered = block(cls('vp-scrub-buffered'), [], 'Buffered');
  nodes.push(scrubBuffered);
  const scrubPlayed = block(cls('vp-scrub-played'), [], 'Played');
  nodes.push(scrubPlayed);
  const scrubThumb = block(cls('vp-scrub-thumb'), [], 'Thumb');
  nodes.push(scrubThumb);
  const scrub = block(
    cls('vp-scrub'),
    [scrubBuffered._id, scrubPlayed._id, scrubThumb._id],
    'Scrubber',
    [
      { name: 'data-vp', value: 'progress' },
      { name: 'role', value: 'slider' },
      { name: 'tabindex', value: '0' },
      { name: 'aria-label', value: 'Seek' },
    ],
  );
  nodes.push(scrub);

  // Time
  const tCur = textSpan(cls('vp-time-current'), '0:00', 'Current time');
  nodes.push(tCur);
  const tSep = textSpan(cls('vp-time-sep'), ' / ', 'Separator');
  nodes.push(tSep);
  const tDur = textSpan(cls('vp-time-duration'), '0:00', 'Duration');
  nodes.push(tDur);
  const time = block(cls('vp-time'), [tCur._id, tSep._id, tDur._id], 'Time');
  nodes.push(time);

  // Volume group
  const muteBtn = block(cls('vp-control', 'vp-btn-mute'), [], 'Mute', [
    { name: 'data-vp', value: 'mute' },
    { name: 'role', value: 'button' },
    { name: 'tabindex', value: '0' },
    { name: 'aria-label', value: 'Mute' },
  ]);
  nodes.push(muteBtn);
  const volFill = block(cls('vp-volume-fill'), [], 'Volume fill');
  nodes.push(volFill);
  const volThumb = block(cls('vp-volume-thumb'), [], 'Volume thumb');
  nodes.push(volThumb);
  const volScrub = block(
    cls('vp-volume'),
    [volFill._id, volThumb._id],
    'Volume slider',
    [
      { name: 'data-vp', value: 'volume' },
      { name: 'role', value: 'slider' },
      { name: 'tabindex', value: '0' },
      { name: 'aria-label', value: 'Volume' },
    ],
  );
  nodes.push(volScrub);
  const volGroup = block(cls('vp-volume-group'), [muteBtn._id, volScrub._id], 'Volume group');
  nodes.push(volGroup);

  // Settings (trigger + empty menu container — bundle JS populates)
  const settingsBtn = block(cls('vp-control', 'vp-btn-settings'), [], 'Settings', [
    { name: 'data-vp', value: 'settings' },
    { name: 'role', value: 'button' },
    { name: 'tabindex', value: '0' },
    { name: 'aria-label', value: 'Settings' },
    { name: 'aria-haspopup', value: 'menu' },
    { name: 'aria-expanded', value: 'false' },
  ]);
  nodes.push(settingsBtn);
  const settingsMenu = block(cls('vp-settings-menu'), [], 'Settings menu (JS-populated)', [
    { name: 'role', value: 'menu' },
    { name: 'hidden', value: '' },
  ]);
  nodes.push(settingsMenu);
  const settings = block(cls('vp-settings'), [settingsBtn._id, settingsMenu._id], 'Settings');
  nodes.push(settings);

  // Fullscreen
  const fsBtn = block(cls('vp-control', 'vp-btn-fullscreen'), [], 'Fullscreen', [
    { name: 'data-vp', value: 'fullscreen' },
    { name: 'role', value: 'button' },
    { name: 'tabindex', value: '0' },
    { name: 'aria-label', value: 'Enter fullscreen' },
  ]);
  nodes.push(fsBtn);

  // Bar wrapper
  const bar = block(
    cls('vp-controls'),
    [playBtn._id, scrub._id, time._id, volGroup._id, settings._id, fsBtn._id],
    'Control bar',
    [{ name: 'role', value: 'group' }, { name: 'aria-label', value: 'Video controls' }],
  );
  nodes.push(bar);

  return bar._id;
}

export function generateWebflowJSON(options: GenerateExportOptions): string {
  const { params } = options;
  const uiMode = params.uiMode === 'webflow' ? 'webflow' : 'js';
  const bundleUrl = options.bundleUrl || DEFAULT_BUNDLE_URL;

  const { styles, classId } = buildStylesArray(uiMode);
  const cls = (...names: string[]): string[] => names.flatMap(classId);

  const nodes: XscpNode[] = [];

  // Poster
  const poster = block(cls('vp-poster'), [], 'Poster (auto-thumbnail)');
  nodes.push(poster);

  // Overlay play (SVG via embed — embed nodes are safe; no tag override needed)
  const playSvg = htmlEmbedNode(PLAY_TRIANGLE_BIG, 'Big play icon');
  nodes.push(playSvg);
  const playOverlay = block(cls('vp-play'), [playSvg._id], 'Big play button');
  nodes.push(playOverlay);

  // Webflow-mode bar
  let controlBarId: string | null = null;
  if (uiMode === 'webflow') {
    controlBarId = buildWebflowControlBar(nodes, classId);
  }

  // Slot
  const slotChildren = [poster._id, playOverlay._id];
  if (controlBarId) slotChildren.push(controlBarId);
  const slot = block(
    cls('vp-slot'),
    slotChildren,
    'Video Slot — duplicate me',
    buildSlotXAttrs(params),
  );
  nodes.push(slot);

  // Two tiny embeds:
  //   1. pre-color (200 bytes) — kills FOUC before bundle parses.
  //   2. bundle reference (~150 bytes) — <script src=CDN type=module>.
  // Order in the wrapper:
  //   slot (DOM exists)
  //   pre-color (finds slot, sets CSS vars before paint)
  //   bundle script (deferred module, hydrates everything)
  const preColorEmbed = htmlEmbedNode(PRE_COLOR_SCRIPT, 'Pre-color (FOUC fix)');
  nodes.push(preColorEmbed);
  const bundleEmbed = htmlEmbedNode(
    buildBundleScript(bundleUrl),
    'Flow Player 4 bundle (CDN)',
  );
  nodes.push(bundleEmbed);

  const wrapper = block(
    [],
    [slot._id, preColorEmbed._id, bundleEmbed._id],
    'Flow Player 4 Component',
  );
  nodes.push(wrapper);

  const json = {
    type: '@webflow/XscpData',
    payload: {
      nodes,
      styles,
      assets: [],
      ix1: [],
      ix2: { interactions: [], events: [], actionLists: [] },
    },
    meta: {
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      universalBindingsRemovedCount: 0,
      unlinkedSymbolCount: 0,
      codeComponentsRemovedCount: 0,
    },
  };

  return JSON.stringify(json);
}

/** HTML Embed export — for designers who paste a single embed into a
 *  Webflow Embed element instead of the full JSON. Shipped for parity
 *  with v3's export panel. */
export function generateExport(options: GenerateExportOptions): string {
  const bundleUrl = options.bundleUrl || DEFAULT_BUNDLE_URL;
  return `${PRE_COLOR_SCRIPT}\n${buildBundleScript(bundleUrl)}`;
}
