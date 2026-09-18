// ============================================================
// flow-player-2 — Webflow JSON export generator.
//
// Webflow's @webflow/XscpData paste format is undocumented. From
// inspecting working pastes, we know that `Block` nodes are happy
// with `tag: 'div'` (and a couple of other container tags), but
// rejecting Block nodes with native HTML5 tags like `<video>`,
// `<source>`, `<img>`, `<input type="range">` will crash the
// Designer outright. The conservative path — and the one FlowPlay
// uses on its reference site too — is:
//
//   * Block (div) for every visible Webflow node (designer can
//     restyle, hide, rename, replace).
//   * HtmlEmbed for the irreducibly-native pieces (the <video>
//     itself, the <img>, the range input, every SVG icon, and
//     the boot script).
//
// The component shape stays the same:
//
//   .fp-wrapper [data-video="wrapper"]
//     ├─ HtmlEmbed (boot script + state CSS)
//     ├─ .fp-stage
//     │   ├─ HtmlEmbed (<video data-video="video"><source/></video>)
//     │   ├─ .fp-poster [data-video="poster"]
//     │   │   └─ HtmlEmbed (<img>)
//     │   └─ .fp-big-play [data-video="big-play"]
//     │        └─ .fp-big-play-circle
//     │            └─ .fp-big-play-icon
//     │                └─ HtmlEmbed (play SVG)
//     └─ .fp-controls [data-video="controls"]
//         ├─ .fp-progress [data-video="track"]
//         │   ├─ .fp-progress-track
//         │   │   ├─ .fp-progress-loaded [data-video="loaded"]
//         │   │   └─ .fp-progress-fill   [data-video="progress"]
//         │   └─ .fp-progress-thumb
//         └─ .fp-controls-row
//             ├─ .fp-controls-group (left: play/pause/replay/back/fwd/volume/time)
//             └─ .fp-controls-group (right: settings/fullscreen/minimize)
//
// Every clickable button is a Block(div) with role="button" and a
// data-video attribute the runtime listens to. The runtime never
// sets inline display:none on these — visibility is governed by
// CSS rules that key off data-state / data-menu / data-fullscreen
// / data-volume on the wrapper. So if a designer hides any
// control in Webflow, the runtime won't override their choice.
// ============================================================

import type { DialConfig } from '../../core/Experiment.ts';
import bundleSource from '../../../dist/exports/flow-player-2.esm.js?raw';
import { WEBFLOW_CLASSES, renderStateCss } from './styles.ts';
import { QUALITY_OPTIONS, SPEED_OPTIONS } from './dom.ts';
import {
  ICON_BACK,
  ICON_CHECK,
  ICON_FORWARD,
  ICON_FULLSCREEN,
  ICON_MINIMIZE,
  ICON_PAUSE,
  ICON_PLAY,
  ICON_REPLAY,
  ICON_SETTINGS,
  ICON_VOLUME_FULL,
  ICON_VOLUME_MID,
  ICON_VOLUME_MUTE,
} from './icons.ts';

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
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface WebflowNode {
  _id: string;
  type: string;
  tag?: string;
  classes: string[];
  children: string[];
  v?: string;
  data: Record<string, unknown>;
}

interface WebflowStyle {
  _id: string;
  fake: boolean;
  type: 'class';
  name: string;
  namespace: string;
  comb: string;
  styleLess: string;
  variants: Record<string, unknown>;
  children: string[];
  createdBy: string;
  origin: null;
  selector: null;
}

const baseData = (
  displayName: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> => ({
  tag: 'div',
  text: false,
  devlink: { runtimeProps: {}, slot: '' },
  displayName,
  attr: { id: '' },
  xattr: [],
  search: { exclude: false },
  visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
  ...extras,
});

const xattr = (
  pairs: Array<{ name: string; value: string }>,
): Array<{ name: string; value: string }> =>
  pairs.filter(
    (p) => p.value !== '' && p.value !== undefined && p.value !== null,
  );

function escapeHtmlAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function buildVideoEmbedHtml(
  videoUrl: string,
  opts: { muted: boolean; loop: boolean; playsinline: boolean },
): string {
  const flags = [
    'class="fp-video"',
    'data-video="video"',
    'preload="metadata"',
    'crossorigin="anonymous"',
    opts.playsinline ? 'playsinline' : '',
    opts.muted ? 'muted' : '',
    opts.loop ? 'loop' : '',
  ].filter(Boolean).join(' ');
  return `<video ${flags}>
  <source src="${escapeHtmlAttr(videoUrl)}" type="video/mp4" data-video-src-quality="720p">
</video>`;
}

function buildPosterEmbedHtml(posterUrl: string): string {
  return `<img class="fp-poster-image" src="${escapeHtmlAttr(posterUrl)}" alt="" loading="lazy">`;
}

function buildVolumeSliderHtml(): string {
  return `<input type="range" class="fp-volume-slider" min="0" max="1" step="0.01" value="1" data-video="volume-slider" aria-label="Volume">`;
}

function buildBootEmbedHtml(params: Record<string, unknown>): string {
  const skipSeconds = Math.max(1, Number(params.skipSeconds) || 10);
  const idleTimeoutMs = 2500;

  // Internal state CSS — too descendant-y / pseudo-y / @-rule-y for
  // Webflow's class panel. Lives in the boot embed's <style> block.
  const stateCss = renderStateCss();

  return `<style>
${stateCss}
</style>
<script type="module">
// ============================================================
// Flow Player 2 — page-wide defaults
//
// Override per-instance with attributes on the .fp-wrapper:
//   data-src="…"           data-poster="…"
//   data-accent="#hex"     data-track="rgba(...)"
//   data-buffer="rgba(...)"
//   data-autoplay="true"   data-muted="true"   data-loop="true"
// ============================================================
window.__FLOW_PLAYER_2_CONFIG__ = Object.assign(
  window.__FLOW_PLAYER_2_CONFIG__ || {},
  {
    skipSeconds: ${skipSeconds},
    idleTimeoutMs: ${idleTimeoutMs},
  }
);

${bundleSource}
</script>`;
}

function buildClassStyles(): { styles: WebflowStyle[]; idByName: Map<string, string> } {
  const idByName = new Map<string, string>();
  const styles: WebflowStyle[] = WEBFLOW_CLASSES.map((c) => {
    const id = uuid();
    idByName.set(c.name, id);
    return {
      _id: id,
      fake: false,
      type: 'class' as const,
      name: c.name,
      namespace: '',
      comb: '',
      styleLess: c.styleLess,
      variants: {},
      children: [],
      createdBy: '',
      origin: null,
      selector: null,
    };
  });
  return { styles, idByName };
}

export function generateWebflowJSON(
  options: GenerateExportOptions & WebflowJSONOverrides,
): string {
  const { params } = options;

  const videoUrl = String(params.videoUrl ?? '');
  const posterUrl = String(params.posterUrl ?? '');
  const accent = String(params.accentColor ?? '');
  const track = String(params.trackColor ?? '');
  const buffer = String(params.bufferColor ?? '');

  const { styles, idByName } = buildClassStyles();
  const cls = (name: string): string[] => {
    const id = idByName.get(name);
    return id ? [id] : [];
  };

  // ── Build the node graph by appending to a flat list. Order
  // doesn't matter for Webflow — children references are by id,
  // but we keep the wrapper first as the entry point.
  const nodes: WebflowNode[] = [];
  const newId = (): string => uuid();

  /**
   * Emit a Block (div) node. Every Webflow-visible element in this
   * component goes through here — that way we never accidentally
   * emit a Block with a non-whitelisted tag.
   */
  function block(
    className: string,
    displayName: string,
    children: string[],
    opts: {
      attrs?: Array<{ name: string; value: string }>;
      htmlAttrs?: Record<string, string>;
    } = {},
  ): string {
    const id = newId();
    nodes.push({
      _id: id,
      type: 'Block',
      tag: 'div',
      classes: cls(className),
      children,
      data: {
        ...baseData(displayName),
        attr: { id: '', ...(opts.htmlAttrs || {}) },
        xattr: opts.attrs ? xattr(opts.attrs) : [],
      },
    });
    return id;
  }

  /** Emit an HtmlEmbed (raw HTML — used for SVGs, video, img, range, scripts). */
  function htmlEmbed(html: string, displayName: string, isScript = false): string {
    const id = newId();
    nodes.push({
      _id: id,
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
            script: isScript,
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
    });
    return id;
  }

  /** Build a div that acts like a button. Designers can restyle in
   * the Style panel; runtime listens for clicks via data-video. */
  function btn(
    role: string,
    iconSvg: string,
    displayName: string,
    ariaLabel: string,
    extraIcons: Array<{ embed: string; role: string; name: string }> = [],
  ): string {
    const iconEmbedId = htmlEmbed(iconSvg, `${displayName} icon`);
    const iconWrapId = block('fp-icon', `${displayName} icon wrap`, [iconEmbedId]);
    const children: string[] = [iconWrapId];
    for (const extra of extraIcons) {
      const eId = htmlEmbed(extra.embed, `${extra.name} icon`);
      const wId = block('fp-icon', `${extra.name} icon wrap`, [eId], {
        attrs: [{ name: 'data-video', value: extra.role }],
      });
      children.push(wId);
    }
    return block('fp-btn', displayName, children, {
      attrs: [
        { name: 'data-video', value: role },
        { name: 'role', value: 'button' },
        { name: 'aria-label', value: ariaLabel },
        { name: 'tabindex', value: '0' },
      ],
    });
  }

  /** Single text-bearing div (used for time labels and menu labels). */
  function textBlock(className: string, displayName: string, text: string): string {
    const id = newId();
    nodes.push({
      _id: id,
      type: 'Block',
      tag: 'div',
      classes: cls(className),
      children: [],
      data: {
        ...baseData(displayName),
        text: { html: text, v: text },
      },
    });
    return id;
  }

  /** Same as textBlock but adds a data-video attribute — used for
   *  current-time / duration / speed-text / quality-text spans. */
  function dynamicTextBlock(
    className: string,
    displayName: string,
    text: string,
    dataVideo: string,
  ): string {
    const id = newId();
    nodes.push({
      _id: id,
      type: 'Block',
      tag: 'div',
      classes: cls(className),
      children: [],
      data: {
        ...baseData(displayName),
        text: { html: text, v: text },
        xattr: [{ name: 'data-video', value: dataVideo }],
      },
    });
    return id;
  }

  // ── Stage children ─────────────────────────────────────
  // The <video><source/></video> block lives inside an HtmlEmbed —
  // Webflow's Block can't carry tag="video". Designers can edit the
  // src here, or override per-instance via data-src on the wrapper.
  const videoEmbedId = htmlEmbed(
    buildVideoEmbedHtml(videoUrl, {
      muted: !!params.muted,
      loop: !!params.loop,
      playsinline: params.playsinline !== false,
    }),
    'Video element (HTML5 <video>)',
  );

  // Poster — div with class fp-poster wrapping an <img> embed.
  // Designers can replace the embed with a Webflow Image element.
  const posterImgEmbedId = htmlEmbed(
    buildPosterEmbedHtml(posterUrl),
    'Poster image (replace with a Webflow Image if you prefer)',
  );
  const posterId = block('fp-poster', 'Poster', [posterImgEmbedId], {
    attrs: [{ name: 'data-video', value: 'poster' }],
  });

  // Big play overlay — a real div wrapping an icon embed.
  const bigPlaySvgId = htmlEmbed(ICON_PLAY, 'Big play icon');
  const bigPlayIconWrapId = block('fp-big-play-icon', 'Big play icon wrap', [bigPlaySvgId]);
  const bigPlayCircleId = block('fp-big-play-circle', 'Big play circle', [bigPlayIconWrapId]);
  const bigPlayId = block('fp-big-play', 'Big play overlay', [bigPlayCircleId], {
    attrs: [
      { name: 'data-video', value: 'big-play' },
      { name: 'role', value: 'button' },
      { name: 'aria-label', value: 'Play' },
    ],
  });

  const stageId = block('fp-stage', 'Stage', [videoEmbedId, posterId, bigPlayId]);

  // ── Progress bar ───────────────────────────────────────
  const progLoadedId = block('fp-progress-loaded', 'Buffered fill', [], {
    attrs: [{ name: 'data-video', value: 'loaded' }],
  });
  const progFillId = block('fp-progress-fill', 'Played fill', [], {
    attrs: [{ name: 'data-video', value: 'progress' }],
  });
  const progTrackId = block('fp-progress-track', 'Track', [progLoadedId, progFillId]);
  const progThumbId = block('fp-progress-thumb', 'Thumb', []);
  const progressId = block('fp-progress', 'Progress bar', [progTrackId, progThumbId], {
    attrs: [{ name: 'data-video', value: 'track' }],
  });

  // ── Left controls group ────────────────────────────────
  const playBtnId = btn('play', ICON_PLAY, 'Play', 'Play');
  const pauseBtnId = btn('pause', ICON_PAUSE, 'Pause', 'Pause');
  const replayBtnId = btn('replay', ICON_REPLAY, 'Replay', 'Replay');
  const backBtnId = btn('back', ICON_BACK, 'Back 10s', 'Back 10 seconds');
  const fwdBtnId = btn('forward', ICON_FORWARD, 'Forward 10s', 'Forward 10 seconds');

  // Volume — mute button has THREE icons (full / mid / mute), CSS
  // shows the matching one based on data-volume on the wrapper.
  const muteBtnId = btn(
    'mute',
    ICON_VOLUME_FULL,
    'Mute',
    'Toggle mute',
    [
      { embed: ICON_VOLUME_MID, role: 'volume-mid', name: 'Volume mid' },
      { embed: ICON_VOLUME_MUTE, role: 'volume-mute', name: 'Volume mute' },
    ],
  );
  // Mark the first icon (rendered by btn) as the volume-full icon
  // — patch the data-video on its wrap. The btn helper put it on
  // the first child of the button.
  {
    const muteNode = nodes.find((n) => n._id === muteBtnId);
    if (muteNode) {
      const firstWrapId = muteNode.children[0];
      const wrap = nodes.find((n) => n._id === firstWrapId);
      if (wrap) {
        const data = wrap.data as Record<string, unknown> & {
          xattr?: Array<{ name: string; value: string }>;
        };
        data.xattr = [{ name: 'data-video', value: 'volume-full' }];
      }
    }
  }

  const volumeSliderEmbedId = htmlEmbed(
    buildVolumeSliderHtml(),
    'Volume slider (range input)',
  );
  const volumeGroupId = block('fp-volume', 'Volume', [muteBtnId, volumeSliderEmbedId]);

  // Time display.
  const timeCurrentId = dynamicTextBlock('', 'Current time', '0:00', 'current-time');
  const timeDividerId = textBlock('fp-time-divider', 'Divider', '/');
  const timeDurationId = dynamicTextBlock('', 'Duration', '0:00', 'duration');
  const timeId = block('fp-time', 'Time', [timeCurrentId, timeDividerId, timeDurationId]);

  const leftId = block('fp-controls-group', 'Left controls', [
    playBtnId,
    pauseBtnId,
    replayBtnId,
    backBtnId,
    fwdBtnId,
    volumeGroupId,
    timeId,
  ]);

  // ── Right controls group: menu + fullscreen toggles ────
  const menuToggleId = btn('menu-toggle', ICON_SETTINGS, 'Settings toggle', 'Settings');

  // Speed section.
  function buildMenuItem(
    displayName: string,
    label: string,
    attrs: Array<{ name: string; value: string }>,
  ): string {
    const labelId = textBlock('', `${displayName} label`, label);
    const checkSvgId = htmlEmbed(ICON_CHECK, `${displayName} check icon`);
    const checkId = block('fp-menu-check', `${displayName} check`, [checkSvgId], {
      attrs: [{ name: 'data-video', value: 'menu-check' }],
    });
    return block('fp-menu-item', displayName, [labelId, checkId], {
      attrs: [
        { name: 'data-video', value: 'menu-item' },
        { name: 'role', value: 'menuitemradio' },
        ...attrs,
      ],
      htmlAttrs: { tabindex: '0' },
    });
  }

  const speedHeadingId = (() => {
    const labelId = textBlock('', 'Speed label', 'Speed: ');
    const valueId = dynamicTextBlock('', 'Speed value', 'Normal', 'speed-text');
    return block('fp-menu-heading', 'Speed heading', [labelId, valueId]);
  })();
  const speedItemIds = SPEED_OPTIONS.map((opt) =>
    buildMenuItem(`Speed ${opt.label}`, opt.label, [
      { name: 'data-video-speed', value: String(opt.rate) },
      { name: 'aria-checked', value: opt.rate === 1 ? 'true' : 'false' },
    ]),
  );
  const speedSectionId = block('fp-menu-section', 'Speed section', [
    speedHeadingId,
    ...speedItemIds,
  ]);

  // Quality section.
  const qualityHeadingId = (() => {
    const labelId = textBlock('', 'Quality label', 'Quality: ');
    const valueId = dynamicTextBlock('', 'Quality value', '720p', 'quality-text');
    return block('fp-menu-heading', 'Quality heading', [labelId, valueId]);
  })();
  const qualityItemIds = QUALITY_OPTIONS.map((opt) =>
    buildMenuItem(`Quality ${opt.label}`, opt.label, [
      { name: 'data-video-quality', value: opt.value },
      { name: 'aria-checked', value: opt.value === '720p' ? 'true' : 'false' },
    ]),
  );
  const qualitySectionId = block('fp-menu-section', 'Quality section', [
    qualityHeadingId,
    ...qualityItemIds,
  ]);

  const menuListId = block('fp-menu-list', 'Menu list', [speedSectionId, qualitySectionId], {
    attrs: [{ name: 'data-video', value: 'menu-list' }],
  });
  const menuId = block('fp-menu', 'Settings menu', [menuToggleId, menuListId]);

  const fsBtnId = btn('fullscreen', ICON_FULLSCREEN, 'Fullscreen', 'Enter fullscreen');
  const minBtnId = btn('minimize', ICON_MINIMIZE, 'Minimize', 'Exit fullscreen');

  const rightId = block('fp-controls-group', 'Right controls', [menuId, fsBtnId, minBtnId]);

  // ── Controls bar / wrapper ─────────────────────────────
  const rowId = block('fp-controls-row', 'Controls row', [leftId, rightId]);
  const controlsId = block('fp-controls', 'Controls bar', [progressId, rowId], {
    attrs: [{ name: 'data-video', value: 'controls' }],
  });

  const bootEmbedId = htmlEmbed(
    buildBootEmbedHtml(params),
    'Flow Player 2 boot script',
    true,
  );

  const wrapperId = block('fp-wrapper', 'Flow Player — duplicate me', [
    bootEmbedId,
    stageId,
    controlsId,
  ], {
    attrs: [
      { name: 'data-video', value: 'wrapper' },
      { name: 'data-src', value: videoUrl },
      { name: 'data-poster', value: posterUrl },
      { name: 'data-accent', value: accent },
      { name: 'data-track', value: track },
      { name: 'data-buffer', value: buffer },
      { name: 'data-autoplay', value: params.autoplay ? 'true' : 'false' },
      { name: 'data-muted', value: params.muted ? 'true' : 'false' },
      { name: 'data-loop', value: params.loop ? 'true' : 'false' },
      ...(params.playsinline === false
        ? [{ name: 'data-playsinline', value: 'false' }]
        : []),
    ],
    htmlAttrs: { tabindex: '0' },
  });

  // Wrapper first (Webflow's paste expects the root entry point at
  // index 0); rest in build order.
  const orderedNodes = [
    ...nodes.filter((n) => n._id === wrapperId),
    ...nodes.filter((n) => n._id !== wrapperId),
  ];

  const json = {
    type: '@webflow/XscpData',
    payload: {
      nodes: orderedNodes,
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

/** Inline-embed only (HTML Embed tab — no Webflow envelope). */
export function generateExport(options: GenerateExportOptions): string {
  return buildBootEmbedHtml(options.params);
}
