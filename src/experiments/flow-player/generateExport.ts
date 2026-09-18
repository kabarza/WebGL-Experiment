// ============================================================
// flow-player — Webflow JSON export generator.
//
// The bundle from ./standalone.ts is built ahead of time by
// scripts/build-export-esm.ts (run via predev / prebuild) into
// dist/exports/flow-player.esm.js, then inlined here as a string
// via Vite's `?raw` import.
//
// Component shape:
//
//   .vp-component (outer wrapper)
//     ├─ HtmlEmbed (bundled boot script + page-config block)
//     └─ .vp-slot [data-vimeo-url, ...] (the actual video frame)
//        ├─ .vp-poster
//        ├─ .vp-play (large SVG button)
//        └─ .vp-consent (hidden by default; shown only when
//                        data-consent="required" and not yet consented)
//           ├─ .vp-consent-inner
//           │  ├─ .vp-consent-title
//           │  ├─ .vp-consent-body
//           │  └─ .vp-consent-accept
//
// styles[] in the JSON includes class definitions for every .vp-*
// class — including the runtime control-bar classes — so designers
// can theme everything from Webflow's Style panel.
// ============================================================

import type { DialConfig } from '../../core/Experiment.ts';
import bundleSource from '../../../dist/exports/flow-player.esm.js?raw';
import { WEBFLOW_CLASSES, renderInternalCss } from './styles.ts';
import { PLAY_TRIANGLE_BIG } from './icons.ts';

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

/**
 * Always-surfaced slot attributes — these appear on every exported
 * slot regardless of dial value, so the Webflow attribute panel is
 * predictable and short.
 */
function buildSlotAttributes(
  params: Record<string, unknown>,
  defaultUrl: string,
): Array<{ name: string; value: string }> {
  const accent = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
  const accentValid = /^[0-9a-fA-F]{6}$/.test(accent) ? accent : '';
  const thumb = String(params.thumbColor ?? '').replace(/^#/, '').slice(0, 6);
  const thumbValid = /^[0-9a-fA-F]{6}$/.test(thumb) ? thumb : '';
  const consentMode = params.consent === 'required' ? 'required' : 'off';
  return [
    { name: 'data-vimeo-url', value: defaultUrl },
    { name: 'data-vimeo-pro', value: params.vimeoPro ? 'true' : 'false' },
    { name: 'data-autoplay', value: params.autoplay ? 'true' : 'false' },
    { name: 'data-show-title', value: params.showTitle ? 'true' : 'false' },
    { name: 'data-accent-color', value: accentValid },
    { name: 'data-thumb-color', value: thumbValid },
    { name: 'data-consent', value: consentMode },
  ];
}

/**
 * Page-level config block injected before the bundle runs. Carries
 * the less common settings the dial offers; runtime per-slot data-*
 * attributes still take precedence on a per-video basis.
 */
function buildConfigBlock(params: Record<string, unknown>): string {
  const muted = !!params.muted;
  const loop = !!params.loop;
  const playsinline = params.playsinline !== false;
  const showControls = params.showControls !== false;
  const keyboardShortcuts = params.keyboardShortcuts !== false;
  const autoHide = params.autoHide !== false;
  const idleTimeoutMs = Math.round(((params.idleTimeout as number) ?? 2.5) * 1000);

  return [
    `  muted: ${muted},`,
    `  loop: ${loop},`,
    `  playsinline: ${playsinline},`,
    `  showControls: ${showControls},`,
    `  keyboardShortcuts: ${keyboardShortcuts},`,
    `  autoHide: ${autoHide},`,
    `  idleTimeoutMs: ${idleTimeoutMs},`,
  ].join('\n');
}

function buildHtmlEmbedContent(params: Record<string, unknown>): string {
  // Internal-state CSS lives here in the embed (pseudo-elements,
  // descendant selectors, attribute-state rules, @keyframes, @media).
  // Designer-editable class rules ship via Webflow's styles[] instead.
  const internal = renderInternalCss();
  return `<style>
${internal}
</style>
<script type="module">
// ============================================================
// Flow Player — page-wide defaults
//
// These control behavior across every .vp-slot on the page.
// To override one for a specific video, add the matching data-*
// attribute on that slot in Webflow:
//   data-muted="true"     data-loop="true"
//   data-show-controls    data-playsinline
//   data-poster           ("auto" | "none" | "https://...")
// ============================================================
window.__FLOW_PLAYER_CONFIG__ = Object.assign(
  window.__FLOW_PLAYER_CONFIG__ || {},
  {
${buildConfigBlock(params)}
  }
);

${bundleSource}
</script>`;
}

/**
 * Translate the FLOW_PLAYER_CLASSES list into Webflow's styles[] array
 * format. Webflow doesn't support compound selectors / pseudo-classes
 * in its `name` field directly — for those we wrap in `selector` and
 * keep the class name as the simple form. (Verified empirically with
 * paste-from-Designer dumps.)
 */
function buildStylesArray(): unknown[] {
  // Only the WEBFLOW_CLASSES bucket — designer-editable simple class
  // rules. Internal state / pseudo-element / @-rules ship in the
  // embed's <style> block.
  return WEBFLOW_CLASSES.map((c) => ({
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
}

export function generateWebflowJSON(
  options: GenerateExportOptions & WebflowJSONOverrides,
): string {
  const { params } = options;

  const defaultUrl = String(params.videoUrl ?? 'https://vimeo.com/804853787');

  const wrapperId = uuid();
  const embedId = uuid();
  const slotId = uuid();
  const posterId = uuid();
  const playId = uuid();
  const playSvgEmbedId = uuid();
  const consentId = uuid();
  const consentInnerId = uuid();
  const consentTitleId = uuid();
  const consentBodyId = uuid();
  const consentAcceptId = uuid();

  const inlineEmbed = buildHtmlEmbedContent(params);
  const styles = buildStylesArray();

  // Map class name to a style id we'll reference from each node's classes array.
  const classMap = new Map<string, string>();
  for (const s of styles) {
    const obj = s as { name: string; selector: string | null; _id: string };
    if (!obj.selector) classMap.set(obj.name, obj._id);
  }
  const classId = (name: string): string[] => {
    const id = classMap.get(name);
    return id ? [id] : [];
  };

  const json = {
    type: '@webflow/XscpData',
    payload: {
      nodes: [
        // Outer wrapper (.vp-component)
        {
          _id: wrapperId,
          type: 'Block',
          tag: 'div',
          classes: classId('vp-component'),
          children: [embedId, slotId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Flow Player Component',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        // Boot script
        {
          _id: embedId,
          type: 'HtmlEmbed',
          tag: 'div',
          classes: [],
          children: [],
          v: inlineEmbed,
          data: {
            search: { exclude: true },
            embed: {
              type: 'html',
              meta: {
                html: inlineEmbed,
                div: false,
                script: true,
                compilable: false,
                iframe: false,
              },
            },
            insideRTE: false,
            content: '',
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Flow Player Embed (boot script)',
            attr: { id: '' },
            xattr: [],
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        // The slot — duplicate this for grids
        {
          _id: slotId,
          type: 'Block',
          tag: 'div',
          classes: classId('vp-slot'),
          children: [posterId, playId, consentId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Video Slot — duplicate me',
            attr: { id: '' },
            xattr: buildSlotAttributes(params, defaultUrl),
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        // Poster — auto-fetched thumbnail; user can override by dropping content inside
        {
          _id: posterId,
          type: 'Block',
          tag: 'div',
          classes: classId('vp-poster'),
          children: [],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Poster — auto-thumbnail (drop content here to override)',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        // Play overlay — big SVG button visible before playback
        {
          _id: playId,
          type: 'Block',
          tag: 'div',
          classes: classId('vp-play'),
          children: [playSvgEmbedId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Play button',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        {
          _id: playSvgEmbedId,
          type: 'HtmlEmbed',
          tag: 'div',
          classes: [],
          children: [],
          v: PLAY_TRIANGLE_BIG,
          data: {
            search: { exclude: true },
            embed: {
              type: 'html',
              meta: {
                html: PLAY_TRIANGLE_BIG,
                div: false,
                script: false,
                compilable: false,
                iframe: false,
              },
            },
            insideRTE: false,
            content: '',
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Play icon (SVG)',
            attr: { id: '' },
            xattr: [],
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        // GDPR consent gate. The .vp-consent class ships with
        // display:none — the boot script flips it to display:flex
        // only when consent is actually needed. Designers can edit
        // copy and styling here.
        {
          _id: consentId,
          type: 'Block',
          tag: 'div',
          classes: classId('vp-consent'),
          children: [consentInnerId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Consent gate (hidden until needed)',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        {
          _id: consentInnerId,
          type: 'Block',
          tag: 'div',
          classes: classId('vp-consent-inner'),
          children: [consentTitleId, consentBodyId, consentAcceptId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Consent content',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        {
          _id: consentTitleId,
          type: 'Heading',
          tag: 'h4',
          classes: classId('vp-consent-title'),
          children: [],
          data: {
            tag: 'h4',
            text: { html: 'Load video', v: 'Load video' },
            devlink: { runtimeProps: {}, slot: '' },
            displayName: '',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        {
          _id: consentBodyId,
          type: 'Paragraph',
          tag: 'p',
          classes: classId('vp-consent-body'),
          children: [],
          data: {
            tag: 'p',
            text: {
              html:
                'Loading the player will send your IP address and browser information to the video provider. They may set cookies and process this data per their privacy policy.',
              v:
                'Loading the player will send your IP address and browser information to the video provider. They may set cookies and process this data per their privacy policy.',
            },
            devlink: { runtimeProps: {}, slot: '' },
            displayName: '',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
        {
          _id: consentAcceptId,
          type: 'Block',
          tag: 'button',
          classes: classId('vp-consent-accept'),
          children: [],
          data: {
            tag: 'button',
            text: { html: 'Accept and play', v: 'Accept and play' },
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Accept button',
            attr: { id: '', type: 'button' },
            xattr: [],
            search: { exclude: false },
            visibility: { conditions: [], keepInHtml: { tag: 'False', val: {} } },
          },
        },
      ],
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
  return buildHtmlEmbedContent(options.params);
}
