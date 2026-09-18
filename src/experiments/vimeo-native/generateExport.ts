// ============================================================
// vimeo-native — Webflow JSON export generator (no libraries).
//
// Component shape:
//
//   Div "Vimeo Component"          ← outer wrapper
//     ├─ HtmlEmbed                  ← boot script (one per page)
//     └─ Div ".vimeo-native"        ← THE SLOT — duplicate for grids
//          ├─ Div ".vimeo-native-poster"   ← thumbnail layer (user-fillable)
//          └─ Div ".vimeo-native-play"     ← play button (user-restylable)
//               └─ HtmlEmbed (default SVG icon)
//          (an iframe is appended here at click time)
//
// Facade pattern: the iframe is NOT loaded on page render. The
// poster + play button sit on top. On the first click anywhere on
// the slot, the script injects the iframe with `autoplay=1` and
// hides the poster + button. If `data-autoplay="true"` is set on
// the slot, the iframe loads immediately. This keeps initial page
// weight small even with a grid of videos.
//
// Always-surfaced slot attributes (visible in Webflow's settings
// panel for every slot, regardless of value):
//
//   data-vimeo-url       — required; the video to play
//   data-autoplay        — "true" / "false"
//   data-show-title      — "true" / "false"
//   data-accent-color    — 6-char hex (no #)
//
// Less common settings (data-muted, data-loop, data-show-controls,
// data-show-byline, data-show-portrait, data-playsinline) are NOT
// emitted on the slot by default. They live in a clearly-labeled
// DEFAULTS block at the top of the boot script. A user who wants
// to override one for a specific video can still add the matching
// data-* attribute manually.
// ============================================================

import type { DialConfig } from '../../core/Experiment.ts';

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
 * Always-surfaced slot attributes. These appear on every exported
 * slot, regardless of the dial value, so users have a stable, short
 * list in the Webflow settings panel.
 */
function buildSlotAttributes(
  params: Record<string, unknown>,
  defaultUrl: string,
): Array<{ name: string; value: string }> {
  const accent = String(params.accentColor ?? '').replace(/^#/, '').slice(0, 6);
  const accentValid = /^[0-9a-fA-F]{6}$/.test(accent) ? accent : '';
  return [
    { name: 'data-vimeo-url', value: defaultUrl },
    { name: 'data-autoplay', value: params.autoplay ? 'true' : 'false' },
    { name: 'data-show-title', value: params.showTitle ? 'true' : 'false' },
    { name: 'data-accent-color', value: accentValid },
  ];
}

/**
 * Default SVG play icon. Lives inside `.vimeo-native-play` as an
 * HtmlEmbed so the user can edit it (or replace the whole block
 * with a Webflow Image / Lottie / whatever).
 *
 * The play triangle uses `fill="currentColor"` so the boot script
 * can tint it from the slot's `data-accent-color` attribute by
 * setting `color` on the parent `.vimeo-native-play` div. The
 * darker circle behind it stays semi-transparent black for
 * contrast on any background.
 */
const DEFAULT_PLAY_SVG = `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72" aria-hidden="true">
  <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.92)" stroke-width="2"/>
  <polygon points="33,25 33,55 60,40" fill="currentColor"/>
</svg>`;

function buildInlineEmbed(params: Record<string, unknown>): string {
  // These dial values get baked into the DEFAULTS block at the top
  // of the boot script. A user editing the script later can change
  // them in one place; per-video overrides via data-* attributes on
  // the slot still win when present.
  const muted = !!params.muted;
  const loop = !!params.loop;
  const playsinline = params.playsinline !== false;
  const showControls = params.showControls !== false;
  const showByline = !!params.showByline;
  const showPortrait = !!params.showPortrait;

  return `<script>
(function () {
  // ============================================================
  //  Vimeo player — page-wide defaults
  //
  //  These control behavior across every .vimeo-native slot on
  //  the page. To override one for a specific video, add the
  //  matching data-* attribute on that slot in Webflow:
  //    data-muted="true"     data-loop="true"
  //    data-show-controls    data-show-byline
  //    data-show-portrait    data-playsinline
  //    data-poster           ("auto" | "none" | "https://...")
  //
  //  Posters: by default the script fetches Vimeo's thumbnail
  //  for each video and sets it as the poster's background image
  //  — but only when the poster element has no children. If you
  //  drop a Webflow Image inside the poster, the auto fetch is
  //  skipped (your content wins). Set data-poster="none" on a
  //  slot to disable thumbnails entirely, or pass a URL to use
  //  your own image.
  // ============================================================
  var DEFAULTS = {
    muted:        ${muted},
    loop:         ${loop},
    showControls: ${showControls},
    showByline:   ${showByline},
    showPortrait: ${showPortrait},
    playsinline:  ${playsinline},
    autoPoster:   true
  };
  // ============================================================

  function parseVimeoId(input) {
    if (!input) return '';
    var s = String(input).trim();
    if (/^\\d+$/.test(s)) return s;
    var m = s.match(/player\\.vimeo\\.com\\/video\\/(\\d+)/i);
    if (m) return m[1];
    m = s.match(/vimeo\\.com\\/(?:[^/]+\\/)*(\\d+)/i);
    if (m) return m[1];
    m = s.match(/(\\d{6,})/);
    return m ? m[1] : '';
  }

  function attrBool(el, name, fallback) {
    var v = el.getAttribute(name);
    if (v === null) return fallback;
    return v === '' || v === 'true' || v === '1';
  }

  function readOpts(slot) {
    return {
      autoplay:     attrBool(slot, 'data-autoplay',      false),
      muted:        attrBool(slot, 'data-muted',         DEFAULTS.muted),
      loop:         attrBool(slot, 'data-loop',          DEFAULTS.loop),
      playsinline:  attrBool(slot, 'data-playsinline',   DEFAULTS.playsinline),
      showControls: attrBool(slot, 'data-show-controls', DEFAULTS.showControls),
      showTitle:    attrBool(slot, 'data-show-title',    false),
      showByline:   attrBool(slot, 'data-show-byline',   DEFAULTS.showByline),
      showPortrait: attrBool(slot, 'data-show-portrait', DEFAULTS.showPortrait),
      accentColor:  slot.getAttribute('data-accent-color') || ''
    };
  }

  function buildSrc(id, opts, forcedAutoplay) {
    var p = new URLSearchParams();
    if (forcedAutoplay || opts.autoplay) p.set('autoplay', '1');
    if (opts.muted) p.set('muted', '1');
    if (opts.loop) p.set('loop', '1');
    p.set('controls', opts.showControls ? '1' : '0');
    p.set('playsinline', opts.playsinline ? '1' : '0');
    p.set('title', opts.showTitle ? '1' : '0');
    p.set('byline', opts.showByline ? '1' : '0');
    p.set('portrait', opts.showPortrait ? '1' : '0');
    if (opts.accentColor) {
      var hex = opts.accentColor.replace(/^#/, '').slice(0, 6);
      if (/^[0-9a-fA-F]{6}$/.test(hex)) p.set('color', hex);
    }
    p.set('dnt', '1');
    return 'https://player.vimeo.com/video/' + id + '?' + p.toString();
  }

  function play(slot) {
    if (slot.getAttribute('data-vimeo-playing') === '1') return;
    var url = slot.getAttribute('data-vimeo-url') || '';
    var id = parseVimeoId(url);
    if (!id) return;
    var opts = readOpts(slot);

    var iframe = document.createElement('iframe');
    iframe.allowFullscreen = true;
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;';
    // Click → force autoplay; the user gesture allows it. Direct
    // autoplay from page load passes opts.autoplay through unchanged.
    iframe.src = buildSrc(id, opts, true);
    slot.appendChild(iframe);

    var poster = slot.querySelector('.vimeo-native-poster');
    if (poster) poster.style.display = 'none';
    var btn = slot.querySelector('.vimeo-native-play');
    if (btn) btn.style.display = 'none';
    slot.style.cursor = '';
    slot.setAttribute('data-vimeo-playing', '1');
  }

  function setPosterImage(poster, url) {
    poster.style.backgroundImage = "url('" + url.replace(/'/g, "\\\\'") + "')";
    poster.style.backgroundSize = 'cover';
    poster.style.backgroundPosition = 'center';
  }

  function loadPoster(slot, id) {
    var poster = slot.querySelector('.vimeo-native-poster');
    if (!poster) return;

    // Per-slot override beats everything.
    var attr = slot.getAttribute('data-poster');
    if (attr === 'none') return;
    if (attr && attr !== 'auto') {
      setPosterImage(poster, attr);
      return;
    }

    // Skip auto-thumbnail when the user has filled the poster with
    // their own content (Webflow Image, gradient, anything).
    if (poster.children.length > 0) return;

    if (!DEFAULTS.autoPoster) return;

    // Vimeo oEmbed: returns thumbnail_url for the video. Pass width
    // so we get a 1280px thumbnail instead of the 640px default.
    // CORS is allowed by Vimeo on this endpoint.
    var oembed =
      'https://vimeo.com/api/oembed.json?url=' +
      encodeURIComponent('https://vimeo.com/' + id) +
      '&width=1280';

    fetch(oembed)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.thumbnail_url) setPosterImage(poster, data.thumbnail_url);
      })
      .catch(function () { /* ignore — leaves the poster blank */ });
  }

  function applyAccent(slot) {
    var accent = slot.getAttribute('data-accent-color') || '';
    if (!accent) return;
    var hex = accent.replace(/^#/, '').slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return;
    // The default play SVG uses fill="currentColor" on the play
    // triangle, so setting CSS color on the parent tints the icon.
    var btn = slot.querySelector('.vimeo-native-play');
    if (btn) btn.style.color = '#' + hex;
  }

  function initOne(slot) {
    if (slot.getAttribute('data-vimeo-init') === '1') return;
    var url = slot.getAttribute('data-vimeo-url') || '';
    var id = parseVimeoId(url);
    if (!id) return;
    slot.setAttribute('data-vimeo-init', '1');

    applyAccent(slot);
    loadPoster(slot, id);

    if (attrBool(slot, 'data-autoplay', false)) {
      // Autoplay: skip the poster, load the iframe immediately.
      play(slot);
      return;
    }
    // Otherwise: wait for a click on the slot.
    slot.style.cursor = 'pointer';
    slot.addEventListener('click', function () { play(slot); });
  }

  function initAll() {
    var nodes = document.querySelectorAll('.vimeo-native[data-vimeo-url]');
    for (var i = 0; i < nodes.length; i++) initOne(nodes[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
</script>`;
}

export function generateWebflowJSON(
  options: GenerateExportOptions & WebflowJSONOverrides,
): string {
  const { params } = options;

  const defaultUrl = String(params.vimeoUrl ?? 'https://vimeo.com/1084537');

  const wrapperId = uuid();
  const embedId = uuid();
  const slotId = uuid();
  const posterId = uuid();
  const playId = uuid();
  const playSvgEmbedId = uuid();

  const slotStyleId = uuid();
  const posterStyleId = uuid();
  const playStyleId = uuid();

  const inlineEmbed = buildInlineEmbed(params);

  // Slot — sensible CSS defaults: 16:9, full width, 8px radius,
  // black backdrop. Edit any of these on the .vimeo-native class
  // directly in Webflow's Style panel — no need to round-trip
  // through this app to change them.
  const slotStyleLess =
    'position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: #000;';

  // Poster — thumbnail layer the user fills with content (image,
  // gradient, video poster, anything Webflow can put in a div).
  // pointer-events: none so clicks fall through to the slot's click
  // handler. The user can override this with their own class if they
  // want a clickable thumbnail interaction (e.g. a CMS link).
  const posterStyleLess =
    'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;';

  // Play button — flex-centered on top of the poster. Same
  // pointer-events: none rule (clicks travel to the slot).
  const playStyleLess =
    'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;';

  const json = {
    type: '@webflow/XscpData',
    payload: {
      nodes: [
        // Outer wrapper — neutral container.
        {
          _id: wrapperId,
          type: 'Block',
          tag: 'div',
          classes: [],
          children: [embedId, slotId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Vimeo Component',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
        // Boot script — runs once for the whole page.
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
            displayName: 'Vimeo Embed (init script)',
            attr: { id: '' },
            xattr: [],
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
        // The slot — always carries the four promoted attributes.
        {
          _id: slotId,
          type: 'Block',
          tag: 'div',
          classes: [slotStyleId],
          children: [posterId, playId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Vimeo Video — duplicate me',
            attr: { id: '' },
            xattr: buildSlotAttributes(params, defaultUrl),
            search: { exclude: false },
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
        // Poster — empty by default; user drops a Webflow Image (or
        // any content) inside in the Designer.
        {
          _id: posterId,
          type: 'Block',
          tag: 'div',
          classes: [posterStyleId],
          children: [],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Poster — drop a thumbnail image here',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
        // Play button — restylable wrapper around a default SVG icon.
        {
          _id: playId,
          type: 'Block',
          tag: 'div',
          classes: [playStyleId],
          children: [playSvgEmbedId],
          data: {
            tag: 'div',
            text: false,
            devlink: { runtimeProps: {}, slot: '' },
            displayName: 'Play button',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
        // SVG icon embed inside the play button. User can edit it
        // here, or remove this embed and add a Webflow Image instead.
        {
          _id: playSvgEmbedId,
          type: 'HtmlEmbed',
          tag: 'div',
          classes: [],
          children: [],
          v: DEFAULT_PLAY_SVG,
          data: {
            search: { exclude: true },
            embed: {
              type: 'html',
              meta: {
                html: DEFAULT_PLAY_SVG,
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
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
      ],
      styles: [
        {
          _id: slotStyleId,
          fake: false,
          type: 'class',
          name: 'vimeo-native',
          namespace: '',
          comb: '',
          styleLess: slotStyleLess,
          variants: {},
          children: [],
          createdBy: '',
          origin: null,
          selector: null,
        },
        {
          _id: posterStyleId,
          fake: false,
          type: 'class',
          name: 'vimeo-native-poster',
          namespace: '',
          comb: '',
          styleLess: posterStyleLess,
          variants: {},
          children: [],
          createdBy: '',
          origin: null,
          selector: null,
        },
        {
          _id: playStyleId,
          fake: false,
          type: 'class',
          name: 'vimeo-native-play',
          namespace: '',
          comb: '',
          styleLess: playStyleLess,
          variants: {},
          children: [],
          createdBy: '',
          origin: null,
          selector: null,
        },
      ],
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
  return buildInlineEmbed(options.params);
}
