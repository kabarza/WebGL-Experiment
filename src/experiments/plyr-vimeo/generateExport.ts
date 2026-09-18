// ============================================================
// plyr-vimeo — Webflow JSON export generator
//
// Component shape:
//
//   Div "Plyr Vimeo Component"     ← outer wrapper
//     ├─ HtmlEmbed                  ← Plyr CDN <link> + boot script
//     └─ Div ".plyr-vimeo"          ← THE SLOT — duplicate for grids
//          ├─ Div ".plyr-vimeo-poster"   ← thumbnail layer (user-fillable)
//          └─ Div ".plyr-vimeo-play"     ← play button (user-restylable)
//               └─ HtmlEmbed (default SVG icon)
//          (a Plyr instance + iframe are mounted here at click time)
//
// Facade pattern: Plyr's CSS + JS aren't downloaded until a slot is
// actually clicked (or autoplay fires). On a grid of nine videos
// where the user only watches one, this saves ~50 KB of Plyr code
// and a CDN round-trip.
//
// Always-surfaced slot attributes (visible in Webflow's settings
// panel for every slot, regardless of value):
//
//   data-vimeo-url       — required; the video to play
//   data-autoplay        — "true" / "false"
//   data-show-title      — "true" / "false" (Vimeo's title overlay)
//   data-accent-color    — 6-char hex (no #) → --plyr-color-main
//
// Other settings live in a labeled DEFAULTS block at the top of the
// boot script (data-muted, data-loop, data-hide-controls,
// data-playsinline, data-reset-on-end, data-show-byline,
// data-show-portrait); per-slot overrides are still possible by
// adding the matching attribute on a slot.
// ============================================================

import type { DialConfig } from '../../core/Experiment.ts';
import { PLYR_CSS_URL, PLYR_JS_URL } from './helpers.ts';

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

// fill="currentColor" on the play triangle lets the boot script tint
// it from data-accent-color by setting `color` on the parent div.
const DEFAULT_PLAY_SVG = `<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" width="72" height="72" aria-hidden="true">
  <circle cx="40" cy="40" r="38" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.92)" stroke-width="2"/>
  <polygon points="33,25 33,55 60,40" fill="currentColor"/>
</svg>`;

function buildInlineEmbed(params: Record<string, unknown>): string {
  const muted = !!params.muted;
  const loop = !!params.loop;
  const playsinline = params.playsinline !== false;
  const hideControls = !!params.hideControls;
  const resetOnEnd = !!params.resetOnEnd;

  return `<link rel="stylesheet" href="${PLYR_CSS_URL}">
<script>
(function () {
  // ============================================================
  //  Plyr Vimeo player — page-wide defaults
  //
  //  These control behavior across every .plyr-vimeo slot on
  //  the page. To override one for a specific video, add the
  //  matching data-* attribute on that slot in Webflow:
  //    data-muted="true"          data-loop="true"
  //    data-hide-controls="true"  data-reset-on-end="true"
  //    data-playsinline           data-show-byline
  //    data-show-portrait
  //    data-poster                ("auto" | "none" | "https://...")
  //
  //  Posters: by default the script fetches Vimeo's thumbnail
  //  for each video and sets it as the poster's background image
  //  — but only when the poster element has no children. Drop a
  //  Webflow Image inside the poster to override; set
  //  data-poster="none" to disable thumbnails for a slot.
  // ============================================================
  var DEFAULTS = {
    muted:        ${muted},
    loop:         ${loop},
    hideControls: ${hideControls},
    resetOnEnd:   ${resetOnEnd},
    playsinline:  ${playsinline},
    showByline:   false,
    showPortrait: false,
    autoPoster:   true
  };
  // ============================================================
  var PLYR_CSS = ${JSON.stringify(PLYR_CSS_URL)};
  var PLYR_JS  = ${JSON.stringify(PLYR_JS_URL)};

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

  function ensureCss() {
    if (document.querySelector('link[data-plyr-vimeo-css]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = PLYR_CSS;
    l.setAttribute('data-plyr-vimeo-css', '');
    document.head.appendChild(l);
  }

  function loadPlyr(cb) {
    if (window.Plyr) { cb(); return; }
    var existing = document.querySelector('script[data-plyr-vimeo-js]');
    if (existing) {
      existing.addEventListener('load', cb, { once: true });
      return;
    }
    var s = document.createElement('script');
    s.src = PLYR_JS;
    s.async = true;
    s.setAttribute('data-plyr-vimeo-js', '');
    s.addEventListener('load', cb, { once: true });
    document.head.appendChild(s);
  }

  function readOpts(slot) {
    return {
      autoplay:     attrBool(slot, 'data-autoplay',       false),
      muted:        attrBool(slot, 'data-muted',          DEFAULTS.muted),
      loop:         attrBool(slot, 'data-loop',           DEFAULTS.loop),
      playsinline:  attrBool(slot, 'data-playsinline',    DEFAULTS.playsinline),
      hideControls: attrBool(slot, 'data-hide-controls',  DEFAULTS.hideControls),
      resetOnEnd:   attrBool(slot, 'data-reset-on-end',   DEFAULTS.resetOnEnd),
      showTitle:    attrBool(slot, 'data-show-title',     false),
      showByline:   attrBool(slot, 'data-show-byline',    DEFAULTS.showByline),
      showPortrait: attrBool(slot, 'data-show-portrait',  DEFAULTS.showPortrait),
      accentColor:  slot.getAttribute('data-accent-color') || ''
    };
  }

  function buildVimeoSrc(id, opts, forcedAutoplay) {
    var parts = [
      'title='    + (opts.showTitle ? 1 : 0),
      'byline='   + (opts.showByline ? 1 : 0),
      'portrait=' + (opts.showPortrait ? 1 : 0),
      'loop='     + (opts.loop ? 1 : 0),
      'speed=1',
      'transparent=0',
      'gesture=media',
      'dnt=1'
    ];
    if (forcedAutoplay || opts.autoplay) parts.push('autoplay=1');
    if (opts.muted) parts.push('muted=1');
    return 'https://player.vimeo.com/video/' + id + '?' + parts.join('&');
  }

  function mountPlyr(slot, opts, forcedAutoplay) {
    var url = slot.getAttribute('data-vimeo-url') || '';
    var id = parseVimeoId(url);
    if (!id) return;

    var target = document.createElement('div');
    target.className = 'plyr-vimeo-target plyr__video-embed';
    target.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    if (opts.accentColor) {
      target.style.setProperty('--plyr-color-main', opts.accentColor);
    }

    var iframe = document.createElement('iframe');
    iframe.allowFullscreen = true;
    iframe.setAttribute('allowtransparency', '');
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.src = buildVimeoSrc(id, opts, forcedAutoplay);
    target.appendChild(iframe);

    slot.appendChild(target);

    new window.Plyr(target, {
      autoplay: forcedAutoplay || opts.autoplay,
      muted: opts.muted,
      loop: { active: opts.loop },
      playsinline: opts.playsinline,
      controls: opts.hideControls
        ? []
        : ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'],
      resetOnEnd: opts.resetOnEnd,
      hideControls: opts.hideControls
    });
  }

  function play(slot) {
    if (slot.getAttribute('data-plyr-vimeo-playing') === '1') return;
    slot.setAttribute('data-plyr-vimeo-playing', '1');
    var opts = readOpts(slot);
    var poster = slot.querySelector('.plyr-vimeo-poster');
    if (poster) poster.style.display = 'none';
    var btn = slot.querySelector('.plyr-vimeo-play');
    if (btn) btn.style.display = 'none';
    slot.style.cursor = '';

    ensureCss();
    loadPlyr(function () { mountPlyr(slot, opts, true); });
  }

  function setPosterImage(poster, url) {
    poster.style.backgroundImage = "url('" + url.replace(/'/g, "\\\\'") + "')";
    poster.style.backgroundSize = 'cover';
    poster.style.backgroundPosition = 'center';
  }

  function loadPoster(slot, id) {
    var poster = slot.querySelector('.plyr-vimeo-poster');
    if (!poster) return;
    var attr = slot.getAttribute('data-poster');
    if (attr === 'none') return;
    if (attr && attr !== 'auto') {
      setPosterImage(poster, attr);
      return;
    }
    if (poster.children.length > 0) return;
    if (!DEFAULTS.autoPoster) return;

    var oembed =
      'https://vimeo.com/api/oembed.json?url=' +
      encodeURIComponent('https://vimeo.com/' + id) +
      '&width=1280';
    fetch(oembed)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.thumbnail_url) setPosterImage(poster, data.thumbnail_url);
      })
      .catch(function () { /* ignore */ });
  }

  function applyAccent(slot) {
    var accent = slot.getAttribute('data-accent-color') || '';
    if (!accent) return;
    var hex = accent.replace(/^#/, '').slice(0, 6);
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return;
    var btn = slot.querySelector('.plyr-vimeo-play');
    if (btn) btn.style.color = '#' + hex;
  }

  function initOne(slot) {
    if (slot.getAttribute('data-plyr-vimeo-init') === '1') return;
    var url = slot.getAttribute('data-vimeo-url') || '';
    var id = parseVimeoId(url);
    if (!id) return;
    slot.setAttribute('data-plyr-vimeo-init', '1');

    applyAccent(slot);
    loadPoster(slot, id);

    if (attrBool(slot, 'data-autoplay', false)) {
      play(slot);
      return;
    }
    slot.style.cursor = 'pointer';
    slot.addEventListener('click', function () { play(slot); });
  }

  function initAll() {
    var nodes = document.querySelectorAll('.plyr-vimeo[data-vimeo-url]');
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

  // Sensible defaults: 16:9, full width, 8px radius, black backdrop.
  // Edit any of these on .plyr-vimeo directly in Webflow's Style panel.
  const slotStyleLess =
    'position: relative; width: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: 8px; background: #000;';

  const posterStyleLess =
    'position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none;';

  const playStyleLess =
    'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;';

  const json = {
    type: '@webflow/XscpData',
    payload: {
      nodes: [
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
            displayName: 'Plyr Vimeo Component',
            attr: { id: '' },
            xattr: [],
            search: { exclude: false },
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
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
            displayName: 'Plyr Embed (init script)',
            attr: { id: '' },
            xattr: [],
            visibility: {
              conditions: [],
              keepInHtml: { tag: 'False', val: {} },
            },
          },
        },
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
          name: 'plyr-vimeo',
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
          name: 'plyr-vimeo-poster',
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
          name: 'plyr-vimeo-play',
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
