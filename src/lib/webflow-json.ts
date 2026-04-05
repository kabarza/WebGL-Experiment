// ============================================================
// Webflow JSON — Generates @webflow/XscpData clipboard JSON
// Creates a paste-ready component: wrapper div + canvas + script
//
// Must be copied to clipboard with MIME type "application/json"
// for Webflow Designer to recognize it on paste.
// ============================================================

export interface WebflowJSONOptions {
  /** Full inline <script>...</script> string from generateExport() */
  inlineScript: string;
  /** Experiment slug (e.g. "flow-field") — used for class names and data attributes */
  slug: string;
  /** Canvas sizing mode */
  sizing: 'responsive' | 'fixed';
  /** Fixed width in px (only used when sizing === 'fixed') */
  fixedWidth?: number;
  /** Fixed height in px (only used when sizing === 'fixed') */
  fixedHeight?: number;
}

/**
 * Generate a random UUID.
 */
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
 * Generate the @webflow/XscpData JSON string for clipboard paste.
 *
 * Creates:
 *   Div Block  (class: "{slug}", e.g. "flow-field")
 *     +-- Canvas  (class: "canvas-{slug}", data-flow-{slug} attribute)
 *     +-- HtmlEmbed  (no class, contains the inline IIFE)
 */
export function generateWebflowJSON(options: WebflowJSONOptions): string {
  const { inlineScript, slug, sizing, fixedWidth = 800, fixedHeight = 600 } = options;

  const wrapperId = uuid();
  const canvasId = uuid();
  const embedId = uuid();
  const wrapperStyleId = uuid();
  const canvasStyleId = uuid();

  // Wrapper: user controls sizing in Webflow, we just set position:relative
  const wrapperStyleLess =
    sizing === 'responsive'
      ? 'position: relative; width: 100%; height: 100vh;'
      : `position: relative; width: ${fixedWidth}px; height: ${fixedHeight}px;`;

  const canvasStyleLess = 'position: absolute; left: 0%; top: 0%; right: 0%; bottom: 0%; width: 100%; height: 100%;';

  const wrapperClassName = slug;
  const canvasClassName = `canvas-${slug}`;
  const canvasDataAttr = `data-flow-${slug}`;

  const json = {
    type: '@webflow/XscpData',
    payload: {
      nodes: [
        // Wrapper div
        {
          _id: wrapperId,
          type: 'Block',
          tag: 'div',
          classes: [wrapperStyleId],
          children: [canvasId, embedId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: '',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
        // Canvas
        {
          _id: canvasId,
          type: 'DOM',
          tag: 'div',
          classes: [canvasStyleId],
          children: [],
          data: {
            tag: 'canvas',
            attributes: [
              { name: canvasDataAttr, value: '' },
            ],
            text: false,
            slot: '',
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
        // HtmlEmbed
        {
          _id: embedId,
          type: 'HtmlEmbed',
          tag: 'div',
          classes: [],
          children: [],
          v: inlineScript,
          data: {
            search: { exclude: true },
            embed: {
              type: 'html',
              meta: {
                html: inlineScript,
                div: false,
                script: true,
                compilable: false,
                iframe: false,
              },
            },
            insideRTE: false,
            content: '',
            devlink: { runtimeProps: {}, slot: '' },
            displayName: '',
            attr: { id: '' },
            xattr: [],
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
      ],
      styles: [
        {
          _id: wrapperStyleId,
          fake: false,
          type: 'class',
          name: wrapperClassName,
          namespace: '',
          comb: '',
          styleLess: wrapperStyleLess,
          variants: {},
          children: [],
          createdBy: '',
          origin: null,
          selector: null,
        },
        {
          _id: canvasStyleId,
          fake: false,
          type: 'class',
          name: canvasClassName,
          namespace: '',
          comb: '',
          styleLess: canvasStyleLess,
          variants: {},
          children: [],
          createdBy: '',
          origin: null,
          selector: null,
        },
      ],
      assets: [],
      ix1: [],
      ix2: {
        interactions: [],
        events: [],
        actionLists: [],
      },
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
