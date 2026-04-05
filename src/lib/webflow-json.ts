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
  /** Canvas sizing mode */
  sizing: 'responsive' | 'fixed';
  /** Fixed width in px (only used when sizing === 'fixed') */
  fixedWidth?: number;
  /** Fixed height in px (only used when sizing === 'fixed') */
  fixedHeight?: number;
}

/**
 * Generate a random UUID.
 * Uses crypto.randomUUID() with fallback for older browsers.
 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: random hex UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generate the @webflow/XscpData JSON string for clipboard paste.
 *
 * Creates this component structure in Webflow:
 *   Div Block (wrapper, data-flow-tempo, position:relative + sized)
 *     +-- Canvas (100% x 100%, position:absolute fills wrapper)
 *     +-- HtmlEmbed (<script> with full inline IIFE)
 *
 * The wrapper has a default size (100% width, 100vh height for responsive,
 * or explicit px for fixed). The canvas absolutely fills the wrapper.
 * Users can resize the wrapper in Webflow to control the effect area.
 */
export function generateWebflowJSON(options: WebflowJSONOptions): string {
  const { inlineScript, sizing, fixedWidth = 800, fixedHeight = 600 } = options;

  // Fresh UUIDs for each copy — internally consistent, Webflow remaps on paste
  const wrapperId = uuid();
  const canvasId = uuid();
  const embedId = uuid();
  const wrapperStyleId = uuid();
  const canvasStyleId = uuid();

  // Wrapper style: provides the bounding box for the canvas
  const wrapperStyleLess =
    sizing === 'responsive'
      ? 'position: relative; width: 100%; height: 100vh;'
      : `position: relative; width: ${fixedWidth}px; height: ${fixedHeight}px;`;

  // Canvas style: absolutely positioned to fill the wrapper
  const canvasStyleLess =
    'position: absolute; left: 0; top: 0; right: 0; bottom: 0; width: 100%; height: 100%;';

  const json = {
    type: '@webflow/XscpData',
    payload: {
      nodes: [
        // Wrapper div block
        {
          _id: wrapperId,
          type: 'Block',
          tag: 'div',
          classes: [wrapperStyleId],
          children: [canvasId, embedId],
          data: {
            tag: 'div',
            text: false,
            xattr: [
              { name: 'data-flow-tempo', value: '' },
            ],
          },
        },
        // Canvas element (DOM type renders as <canvas> tag)
        {
          _id: canvasId,
          type: 'DOM',
          tag: 'div',
          classes: [canvasStyleId],
          children: [],
          data: {
            tag: 'canvas',
            text: false,
          },
        },
        // HtmlEmbed with inline script
        {
          _id: embedId,
          type: 'HtmlEmbed',
          tag: 'div',
          classes: [],
          children: [],
          v: inlineScript,
          data: {
            embed: {
              type: 'html',
              meta: {
                html: inlineScript,
                div: false,
              },
            },
          },
        },
      ],
      styles: [
        {
          _id: wrapperStyleId,
          fake: false,
          type: 'class',
          name: 'Flow Tempo Wrapper',
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
          name: 'Flow Tempo Canvas',
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
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
    },
  };

  return JSON.stringify(json);
}
