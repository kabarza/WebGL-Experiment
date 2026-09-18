// ============================================================
// flow-player-3 — Webflow JSON export generator.
// Branches on params.uiMode to emit either the 5-node Option 1 tree
// or the ~80-node Option 2 tree.
// ============================================================

import type { DialConfig } from '../../core/Experiment.ts';
import bundleSource from '../../../dist/exports/flow-player-3.esm.js?raw';
import { WEBFLOW_CLASSES_ALWAYS, WEBFLOW_CLASSES_OPTION_2, renderInternalCss } from './styles.ts';
import { PLAY_TRIANGLE_BIG, ICONS } from './icons.ts';

export interface GenerateExportOptions {
  params: Record<string, unknown>;
  dialConfig: DialConfig;
  slug?: string;
  experimentTitle?: string;
  version?: string;
}

interface WebflowJSONOverrides {
  sizing?: 'responsive' | 'fixed';
  fixedWidth?: number;
  fixedHeight?: number;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── Node builders ──

interface XscpNode {
  _id: string;
  type: string;
  tag: string;
  classes: string[];
  children: string[];
  v?: string;
  data: Record<string, unknown>;
}

function block(
  classes: string[],
  children: string[],
  displayName = '',
  xattr: Array<{ name: string; value: string }> = [],
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

function buttonNode(
  classes: string[],
  children: string[],
  dataVp: string,
  ariaLabel: string,
  displayName: string,
): XscpNode {
  const n = block(classes, children, displayName);
  n.tag = 'button';
  n.data.tag = 'button';
  (n.data.attr as Record<string, string>) = { id: '', type: 'button' };
  (n.data.xattr as Array<{ name: string; value: string }>) = [
    { name: 'data-vp', value: dataVp },
    { name: 'aria-label', value: ariaLabel },
  ];
  return n;
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

function textBlock(tag: string, classes: string[], text: string, displayName = ''): XscpNode {
  return {
    _id: uuid(),
    type: tag === 'h4' || tag === 'h3' ? 'Heading' : 'Paragraph',
    tag,
    classes,
    children: [],
    data: {
      tag,
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

function buildSlotAttributes(
  params: Record<string, unknown>,
  defaultUrl: string,
): Array<{ name: string; value: string }> {
  const accent = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
  const accentValid = /^[0-9a-fA-F]{6}$/.test(accent) ? accent : '';
  const thumb = String(params.thumbColor ?? '').replace(/^#/, '').slice(0, 6);
  const thumbValid = /^[0-9a-fA-F]{6}$/.test(thumb) ? thumb : '';
  const uiMode = params.uiMode === 'webflow' ? 'webflow' : 'js';
  const vimeoMode =
    params.vimeoMode === 'custom' || params.vimeoMode === 'native' ? params.vimeoMode : 'auto';
  const consentMode = params.consent === 'required' ? 'required' : 'off';
  return [
    { name: 'data-vimeo-url', value: defaultUrl },
    { name: 'data-ui-mode', value: uiMode },
    { name: 'data-vimeo-mode', value: vimeoMode as string },
    { name: 'data-autoplay', value: params.autoplay ? 'true' : 'false' },
    { name: 'data-show-title', value: params.showTitle ? 'true' : 'false' },
    { name: 'data-accent-color', value: accentValid },
    { name: 'data-thumb-color', value: thumbValid },
    { name: 'data-consent', value: consentMode },
  ];
}

function buildConfigBlock(params: Record<string, unknown>): string {
  const muted = !!params.muted;
  const loop = !!params.loop;
  const playsinline = params.playsinline !== false;
  const showControls = params.showControls !== false;
  const keyboardShortcuts = params.keyboardShortcuts !== false;
  const autoHide = params.autoHide !== false;
  const idleTimeoutMs = Math.round(((params.idleTimeout as number) ?? 2.5) * 1000);
  const skipSeconds = Number(params.skipSeconds ?? 10);
  return [
    `  muted: ${muted},`,
    `  loop: ${loop},`,
    `  playsinline: ${playsinline},`,
    `  showControls: ${showControls},`,
    `  keyboardShortcuts: ${keyboardShortcuts},`,
    `  autoHide: ${autoHide},`,
    `  idleTimeoutMs: ${idleTimeoutMs},`,
    `  skipSeconds: ${skipSeconds},`,
  ].join('\n');
}

function buildStyleEmbedContent(): string {
  return `<style>\n${renderInternalCss()}\n</style>`;
}

/**
 * Synchronous pre-color script — runs during HTML parse (NOT deferred,
 * NOT a module). Its job is to read each slot's `data-accent-color` /
 * `data-thumb-color` attributes and apply them as inline CSS variables
 * BEFORE the browser first paints. Eliminates the FOUC where the play
 * button would flash the default accent color (#00b3ff) before the
 * module bundle finished loading and updated the variables.
 *
 * MUST be placed AFTER the slot in the wrapper's children — the slot
 * has to be in the DOM by the time this script executes.
 */
function buildPreColorEmbedContent(): string {
  return `<script>
(function(){
  var slots = document.querySelectorAll('.vp-slot[data-accent-color], .vp-slot[data-thumb-color]');
  for (var i = 0; i < slots.length; i++) {
    var s = slots[i];
    var a = s.getAttribute('data-accent-color');
    if (a && /^[0-9a-fA-F]{6}$/.test(a)) s.style.setProperty('--vp-accent', '#' + a);
    var t = s.getAttribute('data-thumb-color');
    if (t && /^[0-9a-fA-F]{6}$/.test(t)) s.style.setProperty('--vp-thumb-color', '#' + t);
  }
})();
</script>`;
}

function buildScriptEmbedContent(params: Record<string, unknown>): string {
  return `<script type="module">
// ============================================================
// Flow Player 3 — page-wide defaults
// Override per-video with data-* attributes on the .vp-slot
// element. UI mode is per-slot via data-ui-mode="js" | "webflow".
// ============================================================
window.__FLOW_PLAYER_3_CONFIG__ = Object.assign(
  window.__FLOW_PLAYER_3_CONFIG__ || {},
  {
${buildConfigBlock(params)}
  }
);

${bundleSource}
</script>`;
}

/** Kept for the HTML Embed export tab — combined output. */
function buildHtmlEmbedContent(params: Record<string, unknown>): string {
  return `${buildStyleEmbedContent()}\n${buildScriptEmbedContent(params)}`;
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

function buildStylesArray(uiMode: 'js' | 'webflow'): {
  styles: StyleEntry[];
  classId: (name: string) => string[];
} {
  const classes =
    uiMode === 'webflow'
      ? [...WEBFLOW_CLASSES_ALWAYS, ...WEBFLOW_CLASSES_OPTION_2]
      : WEBFLOW_CLASSES_ALWAYS;
  const styles: StyleEntry[] = classes.map((c) => ({
    _id: uuid(),
    fake: false,
    type: 'class',
    name: c.name,
    namespace: '',
    comb: '',
    styleLess: c.styleLess,
    variants: {},
    children: [],
    createdBy: '',
    origin: null,
    selector: null,
  }));
  const map = new Map<string, string>();
  for (const s of styles) map.set(s.name, s._id);
  return {
    styles,
    classId: (name: string) => {
      const id = map.get(name);
      return id ? [id] : [];
    },
  };
}

// ── Option 2 tree builder ──
//
// Builds and pushes the control-bar subtree into `nodes`. Returns
// the bar's root node id so the slot can reference it.

type ClassIdFn = (name: string) => string[];

function buildOption2Tree(nodes: XscpNode[], classId: ClassIdFn): string {
  const cls = (...names: string[]): string[] => names.flatMap(classId);
  // ── Buttons with icon embeds ──
  const playEmbed = htmlEmbedNode(
    `<span class="vp-icon-play">${ICONS.play}</span><span class="vp-icon-pause">${ICONS.pause}</span>`,
    'Play/Pause icons',
  );
  nodes.push(playEmbed);
  const playBtn = buttonNode(
    cls('vp-control', 'vp-btn-play'),
    [playEmbed._id],
    'play',
    'Play',
    'Play / Pause',
  );
  nodes.push(playBtn);

  const restartEmbed = htmlEmbedNode(ICONS.restart, 'Restart icon');
  nodes.push(restartEmbed);
  const restartBtn = buttonNode(
    cls('vp-control', 'vp-btn-restart'),
    [restartEmbed._id],
    'restart',
    'Restart',
    'Restart',
  );
  nodes.push(restartBtn);

  // ── Progress ──
  const buffer = block(cls('vp-progress-buffer'), [], 'Buffer fill');
  nodes.push(buffer);
  const fill = block(cls('vp-progress-fill'), [], 'Played fill');
  nodes.push(fill);
  const track = block(cls('vp-progress-track'), [buffer._id, fill._id], 'Progress track');
  nodes.push(track);
  const thumb = block(cls('vp-progress-thumb'), [], 'Scrubber thumb');
  nodes.push(thumb);

  // The native range input — we use a Block with tag override for simplicity.
  const range = block(cls('vp-progress-range'), [], 'Seek input (transparent)');
  range.tag = 'input';
  (range.data as Record<string, unknown>).tag = 'input';
  (range.data.attr as Record<string, string>) = {
    id: '',
    type: 'range',
    min: '0',
    max: '1',
    step: '0.0001',
    value: '0',
  };
  (range.data.xattr as Array<{ name: string; value: string }>) = [
    { name: 'aria-label', value: 'Seek' },
    { name: 'role', value: 'slider' },
  ];
  nodes.push(range);

  const progress = block(
    cls('vp-progress'),
    [track._id, thumb._id, range._id],
    'Progress (data-vp="progress")',
  );
  (progress.data.xattr as Array<{ name: string; value: string }>) = [
    { name: 'data-vp', value: 'progress' },
  ];
  nodes.push(progress);

  // ── Time ──
  const tCur = textBlock('span', cls('vp-time-current'), '0:00', 'Current time');
  nodes.push(tCur);
  const tSep = textBlock('span', cls('vp-time-sep'), ' / ', 'Separator');
  nodes.push(tSep);
  const tDur = textBlock('span', cls('vp-time-duration'), '0:00', 'Duration');
  nodes.push(tDur);
  const time = block(cls('vp-time'), [tCur._id, tSep._id, tDur._id], 'Time display');
  nodes.push(time);

  // ── Captions toggle ──
  const ccEmbed = htmlEmbedNode(ICONS.captionsOn, 'Captions icon');
  nodes.push(ccEmbed);
  const ccBtn = buttonNode(
    cls('vp-control', 'vp-btn-captions'),
    [ccEmbed._id],
    'captions',
    'Toggle captions',
    'Captions',
  );
  nodes.push(ccBtn);

  // ── Volume group ──
  const muteEmbed = htmlEmbedNode(
    `<span class="vp-icon-vol-full">${ICONS.volumeFull}</span><span class="vp-icon-vol-mid">${ICONS.volumeMid}</span><span class="vp-icon-vol-mute">${ICONS.volumeMute}</span>`,
    'Volume icons',
  );
  nodes.push(muteEmbed);
  const muteBtn = buttonNode(
    cls('vp-control', 'vp-btn-mute'),
    [muteEmbed._id],
    'mute',
    'Mute',
    'Mute',
  );
  nodes.push(muteBtn);

  const volumeRange = block(cls('vp-volume'), [], 'Volume slider');
  volumeRange.tag = 'input';
  (volumeRange.data as Record<string, unknown>).tag = 'input';
  (volumeRange.data.attr as Record<string, string>) = {
    id: '',
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
    value: '1',
  };
  (volumeRange.data.xattr as Array<{ name: string; value: string }>) = [
    { name: 'data-vp', value: 'volume' },
    { name: 'aria-label', value: 'Volume' },
  ];
  nodes.push(volumeRange);

  const volGroup = block(
    cls('vp-volume-group'),
    [muteBtn._id, volumeRange._id],
    'Volume group',
  );
  nodes.push(volGroup);

  // ── Settings ──
  const settingsEmbed = htmlEmbedNode(ICONS.settings, 'Settings icon');
  nodes.push(settingsEmbed);
  const settingsBtn = buttonNode(
    cls('vp-control', 'vp-btn-settings'),
    [settingsEmbed._id],
    'settings',
    'Settings',
    'Settings',
  );
  nodes.push(settingsBtn);
  const settingsMenu = block(cls('vp-settings-menu'), [], 'Settings menu (JS-populated)');
  (settingsMenu.data.xattr as Array<{ name: string; value: string }>) = [
    { name: 'role', value: 'menu' },
    { name: 'hidden', value: '' },
  ];
  nodes.push(settingsMenu);
  const settings = block(
    cls('vp-settings'),
    [settingsBtn._id, settingsMenu._id],
    'Settings',
  );
  nodes.push(settings);

  // ── PiP (Vimeo only — JS hides for YouTube) ──
  const pipEmbed = htmlEmbedNode(ICONS.pip, 'PiP icon');
  nodes.push(pipEmbed);
  const pipBtn = buttonNode(
    cls('vp-control', 'vp-btn-pip'),
    [pipEmbed._id],
    'pip',
    'Picture in picture',
    'PiP',
  );
  nodes.push(pipBtn);

  // ── Fullscreen ──
  const fsEmbed = htmlEmbedNode(
    `<span class="vp-icon-fs-enter">${ICONS.fullscreenEnter}</span><span class="vp-icon-fs-exit">${ICONS.fullscreenExit}</span>`,
    'Fullscreen icons',
  );
  nodes.push(fsEmbed);
  const fsBtn = buttonNode(
    cls('vp-control', 'vp-btn-fullscreen'),
    [fsEmbed._id],
    'fullscreen',
    'Enter fullscreen',
    'Fullscreen',
  );
  nodes.push(fsBtn);

  // ── Bar wrapper ──
  const bar = block(
    cls('vp-controls'),
    [
      playBtn._id,
      restartBtn._id,
      progress._id,
      time._id,
      ccBtn._id,
      volGroup._id,
      settings._id,
      pipBtn._id,
      fsBtn._id,
    ],
    'Control bar',
  );
  nodes.push(bar);

  return bar._id;
}

export function generateWebflowJSON(
  options: GenerateExportOptions & WebflowJSONOverrides,
): string {
  const { params } = options;

  const defaultUrl = String(params.videoUrl ?? 'https://vimeo.com/804853787');
  const uiMode = params.uiMode === 'webflow' ? 'webflow' : 'js';
  const styleEmbedHtml = buildStyleEmbedContent();
  const preColorEmbedHtml = buildPreColorEmbedContent();
  const scriptEmbedHtml = buildScriptEmbedContent(params);

  // Build the styles array FIRST so we know each class's _id. The
  // classes field on each node must reference style _ids, not names.
  const { styles, classId } = buildStylesArray(uiMode);
  const cls = (...names: string[]): string[] => names.flatMap(classId);

  const nodes: XscpNode[] = [];

  // Always: poster, play overlay, consent gate
  const poster = block(cls('vp-poster'), [], 'Poster (auto-thumbnail)');
  nodes.push(poster);

  const playSvg = htmlEmbedNode(PLAY_TRIANGLE_BIG, 'Big play icon');
  nodes.push(playSvg);
  const playOverlay = block(cls('vp-play'), [playSvg._id], 'Big play button');
  nodes.push(playOverlay);

  const consentTitle = textBlock('h4', cls('vp-consent-title'), 'Load video', 'Consent title');
  nodes.push(consentTitle);
  const consentBody = textBlock(
    'p',
    cls('vp-consent-body'),
    'Loading the player will send your IP address and browser information to the video provider.',
    'Consent body',
  );
  nodes.push(consentBody);
  const consentAccept = block(cls('vp-consent-accept'), [], 'Accept button');
  consentAccept.tag = 'button';
  (consentAccept.data as Record<string, unknown>).tag = 'button';
  (consentAccept.data.attr as Record<string, string>) = { id: '', type: 'button' };
  (consentAccept.data as Record<string, unknown>).text = {
    html: 'Accept and play',
    v: 'Accept and play',
  };
  nodes.push(consentAccept);
  const consentInner = block(
    cls('vp-consent-inner'),
    [consentTitle._id, consentBody._id, consentAccept._id],
    'Consent content',
  );
  nodes.push(consentInner);
  const consent = block(
    cls('vp-consent'),
    [consentInner._id],
    'Consent gate (hidden by default)',
  );
  nodes.push(consent);

  // Option 2: also add the full control bar tree
  let controlBarId: string | null = null;
  if (uiMode === 'webflow') {
    controlBarId = buildOption2Tree(nodes, classId);
  }

  // Slot
  const slotChildren = [poster._id, playOverlay._id, consent._id];
  if (controlBarId) slotChildren.push(controlBarId);
  const slot = block(cls('vp-slot'), slotChildren, 'Video Slot — duplicate me');
  (slot.data.xattr as Array<{ name: string; value: string }>) = buildSlotAttributes(
    params,
    defaultUrl,
  );
  nodes.push(slot);

  // Three HtmlEmbed nodes:
  //   1. styleEmbed  — <style>…</style>, parsed first
  //   2. preColorEmbed — synchronous <script> that pre-applies the per-
  //      slot accent / thumb colors as CSS variables BEFORE the browser
  //      paints. Placed AFTER the slot so the script can find it. This
  //      kills the blue-flash FOUC on the play button.
  //   3. scriptEmbed — <script type="module"> with the full bundle.
  //      Deferred; runs after parse completes.
  //
  // Each embed stays under Webflow's 50K char-per-embed limit
  // (style ~10 KB, pre-color ~600 bytes, bundle ~47 KB).
  const styleEmbed = htmlEmbedNode(styleEmbedHtml, 'Flow Player 3 styles');
  nodes.push(styleEmbed);
  const preColorEmbed = htmlEmbedNode(
    preColorEmbedHtml,
    'Flow Player 3 pre-color (FOUC fix)',
  );
  nodes.push(preColorEmbed);
  const scriptEmbed = htmlEmbedNode(scriptEmbedHtml, 'Flow Player 3 boot script');
  nodes.push(scriptEmbed);

  // Wrapper children order matters: styles first (parsed → applied),
  // then the slot (in DOM), then the pre-color script (finds slot,
  // sets inline CSS vars before paint), then the deferred bundle.
  const wrapper = block(
    [],
    [styleEmbed._id, slot._id, preColorEmbed._id, scriptEmbed._id],
    'Flow Player 3 Component',
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

export function generateExport(options: GenerateExportOptions): string {
  return buildHtmlEmbedContent(options.params);
}
