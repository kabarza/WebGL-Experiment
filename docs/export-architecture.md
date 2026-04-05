# Export Architecture — Webflow Integration

> Comprehensive plan for the export system: Webflow JSON paste, inline IIFE generation, data-attribute overrides, DialKit in Webflow, and the tabbed export panel.

---

## Overview

The export system lets designers take a tweaked WebGL effect from our tool and drop it into Webflow with zero friction. Three export methods serve different workflows:

| Method | Who it's for | How it works |
|--------|-------------|-------------|
| **Webflow JSON** | Most users | Copy JSON, paste in Webflow — creates a ready-to-go component |
| **HTML Embed** | Manual users | Copy HTML snippet, paste into a Webflow custom code block |
| **MCP Instructions** | AI-assisted | Claude reads the instructions and builds the component via Webflow MCP tools |

After export, designers can customize the effect through four paths:

1. Edit the CONFIG block directly in the Webflow HtmlEmbed
2. Bind `data-flow-ft-*` attributes to Webflow Component Properties
3. Return to our tool, tweak in DialKit, use "Copy Config" to grab updated values
4. Enable DialKit inside Webflow (toggle `dialKit: true`), tweak live, then Copy Config

---

## Export Panel UI

The export modal uses **3 tabs** instead of the current stacked layout.

```
+-------------------------------------------------------+
|  Export to Webflow                              [x]    |
|-------------------------------------------------------|
|  Experiment: Flow Field                                |
|  Version:  [v1 - Emerald Flow  v]                      |
|                                                        |
|  Canvas Sizing:  (o) Responsive   ( ) Fixed            |
|-------------------------------------------------------|
|  [ Webflow JSON ]  [ HTML Embed ]  [ MCP ]             |
|-------------------------------------------------------|
|                                                        |
|  (tab content here)                                    |
|                                                        |
|  [ Copy JSON ]                                         |
+-------------------------------------------------------+
```

Version selector and sizing options sit at the top, shared across all tabs.

### Tab 1: Webflow JSON

Generates the `@webflow/XscpData` clipboard JSON. User copies it, pastes in Webflow, gets a full component. This is the primary export path.

### Tab 2: HTML Embed

The current HTML snippet (`<div><canvas><script src="...">`). Points to the hosted bundle URL. Good for manual Webflow custom code blocks or non-Webflow platforms.

### Tab 3: MCP Instructions

AI-readable step-by-step instructions for creating styles, elements, and components via Webflow MCP tools. For Claude-assisted workflows.

---

## Webflow JSON Structure

When pasted into Webflow, the JSON creates this component:

```
Div Block (wrapper)
  +-- Canvas (100% x 100%, data-flow-tempo attribute)
  +-- HtmlEmbed (<script> with full inline IIFE)
```

### JSON Format

The paste format is `@webflow/XscpData`. Node IDs are random UUIDs generated fresh each time the user copies (internally consistent within the JSON, Webflow remaps on paste).

```json
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [
      {
        "_id": "<wrapper-uuid>",
        "type": "Block",
        "tag": "div",
        "classes": [],
        "children": ["<canvas-uuid>", "<embed-uuid>"],
        "data": {
          "tag": "div",
          "text": false,
          "devlink": { "runtimeProps": {}, "slot": "" },
          "displayName": "",
          "attr": { "id": "" },
          "xattr": [],
          "search": { "exclude": false },
          "visibility": {
            "conditions": [],
            "keepInHtml": { "tag": "False", "val": {} }
          }
        }
      },
      {
        "_id": "<canvas-uuid>",
        "type": "DOM",
        "tag": "div",
        "classes": ["<canvas-style-uuid>"],
        "children": [],
        "data": {
          "tag": "canvas",
          "attributes": [
            { "name": "data-flow-tempo", "value": "" }
          ],
          "text": false,
          "slot": "",
          "visibility": {
            "conditions": [],
            "keepInHtml": { "tag": "False", "val": {} }
          }
        }
      },
      {
        "_id": "<embed-uuid>",
        "type": "HtmlEmbed",
        "tag": "div",
        "classes": [],
        "children": [],
        "v": "<script>...full inline IIFE...</script>",
        "data": {
          "search": { "exclude": true },
          "embed": {
            "type": "html",
            "meta": {
              "html": "<script>...full inline IIFE...</script>",
              "div": false,
              "script": true,
              "compilable": false,
              "iframe": false
            }
          },
          "insideRTE": false,
          "content": "",
          "devlink": { "runtimeProps": {}, "slot": "" },
          "displayName": "",
          "attr": { "id": "" },
          "xattr": [],
          "visibility": {
            "conditions": [],
            "keepInHtml": { "tag": "False", "val": {} }
          }
        }
      }
    ],
    "styles": [
      {
        "_id": "<canvas-style-uuid>",
        "fake": false,
        "type": "class",
        "name": "Canvas",
        "namespace": "",
        "comb": "",
        "styleLess": "width: 100%; height: 100%;",
        "variants": {},
        "children": [],
        "createdBy": "",
        "origin": null,
        "selector": null
      }
    ],
    "assets": [],
    "ix1": [],
    "ix2": {
      "interactions": [],
      "events": [],
      "actionLists": []
    }
  },
  "meta": {
    "droppedLinks": 0,
    "dynBindRemovedCount": 0,
    "dynListBindRemovedCount": 0,
    "paginationRemovedCount": 0,
    "universalBindingsRemovedCount": 0,
    "unlinkedSymbolCount": 0,
    "codeComponentsRemovedCount": 0
  }
}
```

### Responsive vs Fixed Sizing

The Canvas style and wrapper behavior change based on sizing mode:

- **Responsive:** Canvas style is `width: 100%; height: 100%;` — fills its parent container.
- **Fixed:** Canvas style adds explicit dimensions, e.g. `width: 800px; height: 600px;`.

---

## Inline IIFE Structure

The JavaScript inside the Webflow JSON's HtmlEmbed is a fully self-contained IIFE. No external dependencies. The complete structure:

```javascript
<script>
// =============================================
// Flowing — Flow Field v1
// =============================================
// Edit these values to customize the effect.
// Connect Webflow component properties to
// data-flow-ft-* attributes on the wrapper div.
// Set dialKit to true to load the visual editor.
// =============================================

const CONFIG = {
  // Colors (hex without #)
  bgColor: "0d0d10",
  color1: "492d7b",
  color2: "8c5a1c",
  color3: "381630",
  color4: "7b4cc0",
  highlightColor: "d4a0e8",

  // Noise
  noiseScale: 0.55,
  noiseSpeed: 0.037,
  noiseOctaves: 1,

  // Flow Field
  warpStrength: 1.86,
  warpScale: 0.58,
  warpSpeed: 0.454,
  warpDepth: 2,

  // Vignette
  vignetteRadius: 0.7,
  vignetteSoftness: 0.4,
  vignetteRoundness: 2.0,

  // Camera
  rotation: -0.17,
  zoom: 0.55,

  // Color Adjustments
  blendWidth: 0.55,
  colorShift: 0.82,
  saturation: 1.3,
  brightness: 1.0,
  contrast: 1.0,

  // Highlights
  highlightStr: 0.25,

  // Grain
  grainAmount: 0.089,
  grainScale: 10,
  grainSpeed: 60,

  // Mouse
  mouseStrength: 0.22,

  // Visual Editor (loads DialKit when true)
  dialKit: false,
};

// Dial config — ranges for the visual editor
const DIAL_CONFIG = {
  Background: {
    bgColor: "0d0d10",
  },
  "Noise Fill": {
    noiseScale: [0.55, 0.01, 5, 0.01],
    noiseSpeed: [0.037, 0, 1, 0.001],
    noiseOctaves: [1, 1, 6, 1],
  },
  "Flow Field": {
    warpStrength: [1.86, 0, 3, 0.01],
    warpScale: [0.58, 0.01, 3, 0.01],
    warpSpeed: [0.454, 0, 0.5, 0.001],
    warpDepth: [2, 0, 3, 1],
  },
  // ... all other folders from params.ts dialConfig
};

(function () {
  var wrapper = document.querySelector("[data-flow-tempo]");
  if (!wrapper) return;
  var canvas = wrapper.querySelector("canvas");
  if (!canvas) return;

  // ── Params: data attributes override CONFIG ──
  var P = {};
  for (var key in CONFIG) {
    P[key] = CONFIG[key];
    var kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    var attr = wrapper.getAttribute("data-flow-ft-" + kebab);
    if (attr !== null) {
      P[key] = typeof CONFIG[key] === "number" ? Number(attr) : attr;
    }
  }

  // ── Optional DialKit loading ──
  if (
    P.dialKit === true ||
    P.dialKit === "true" ||
    wrapper.getAttribute("data-flow-ft-dial-kit") === "true"
  ) {
    var s = document.createElement("script");
    s.src = "https://webgl-experiments.vercel.app/exports/dialkit-standalone.js";
    s.onload = function () {
      if (window.FlowDialKit) {
        window.FlowDialKit.create(P, DIAL_CONFIG, function (updated) {
          for (var k in updated) P[k] = updated[k];
        });
      }
    };
    document.head.appendChild(s);
  }

  // ── Color helper ──
  function hex2rgb(h) {
    if (h.charAt(0) === "#") h = h.slice(1);
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }

  // ── WebGL2 init ──
  var gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) return;

  // Shader source (inlined at build time)
  var VERT = `#version 300 es
    in vec2 a_position;
    out vec2 v_uv;
    void main() {
      v_uv = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }`;

  var FRAG = `...full fragment shader inlined...`;

  // Compile, link, setup VAO, uniform locations...
  // Mouse tracking (pointermove)...
  // ResizeObserver...
  // Render loop (reads from P every frame)...
})();
</script>
```

### Param Priority

When the standalone script initializes, params resolve in this order:

```
data-flow-ft-* attributes  (highest priority — Webflow Component Properties)
        |
        v
    CONFIG block            (editable in the HtmlEmbed code)
        |
        v
   Baked defaults           (fallback values in the IIFE)
```

This gives users three levels of control without any conflicts.

---

## Data Attribute Convention

All customizable params can be set via data attributes on the wrapper div. The standalone JS reads these at init time and overrides CONFIG values.

### Naming Rules

- **Prefix:** `data-flow-ft-`
- **Format:** kebab-case derived from the camelCase param name
- **Colors:** hex without `#` (e.g. `"492d7b"`)
- **Numbers:** string representation (parsed to Number)
- **Booleans:** `"true"` / `"false"`

### Full Attribute Map

| Param | Attribute | Type | Example |
|-------|-----------|------|---------|
| `bgColor` | `data-flow-ft-bg-color` | hex | `"0d0d10"` |
| `color1` | `data-flow-ft-color1` | hex | `"492d7b"` |
| `color2` | `data-flow-ft-color2` | hex | `"8c5a1c"` |
| `color3` | `data-flow-ft-color3` | hex | `"381630"` |
| `color4` | `data-flow-ft-color4` | hex | `"7b4cc0"` |
| `highlightColor` | `data-flow-ft-highlight-color` | hex | `"d4a0e8"` |
| `noiseScale` | `data-flow-ft-noise-scale` | number | `"0.55"` |
| `noiseSpeed` | `data-flow-ft-noise-speed` | number | `"0.037"` |
| `noiseOctaves` | `data-flow-ft-noise-octaves` | number | `"1"` |
| `warpStrength` | `data-flow-ft-warp-strength` | number | `"1.86"` |
| `warpScale` | `data-flow-ft-warp-scale` | number | `"0.58"` |
| `warpSpeed` | `data-flow-ft-warp-speed` | number | `"0.454"` |
| `warpDepth` | `data-flow-ft-warp-depth` | number | `"2"` |
| `vignetteRadius` | `data-flow-ft-vignette-radius` | number | `"0.7"` |
| `vignetteSoftness` | `data-flow-ft-vignette-softness` | number | `"0.4"` |
| `vignetteRoundness` | `data-flow-ft-vignette-roundness` | number | `"2.0"` |
| `rotation` | `data-flow-ft-rotation` | number | `"-0.17"` |
| `zoom` | `data-flow-ft-zoom` | number | `"0.55"` |
| `blendWidth` | `data-flow-ft-blend-width` | number | `"0.55"` |
| `colorShift` | `data-flow-ft-color-shift` | number | `"0.82"` |
| `saturation` | `data-flow-ft-saturation` | number | `"1.3"` |
| `brightness` | `data-flow-ft-brightness` | number | `"1.0"` |
| `contrast` | `data-flow-ft-contrast` | number | `"1.0"` |
| `highlightStr` | `data-flow-ft-highlight-str` | number | `"0.25"` |
| `grainAmount` | `data-flow-ft-grain-amount` | number | `"0.089"` |
| `grainScale` | `data-flow-ft-grain-scale` | number | `"10"` |
| `grainSpeed` | `data-flow-ft-grain-speed` | number | `"60"` |
| `mouseStrength` | `data-flow-ft-mouse-strength` | number | `"0.22"` |
| `dialKit` | `data-flow-ft-dial-kit` | boolean | `"true"` |

All ~25 params from the DialKit groups are exposed. The attribute map is auto-generated from the experiment's `params.ts` — no manual mapping needed.

### Webflow Component Properties

Users can bind these data attributes to Webflow Component Properties (number input, text input, color picker) for a native no-code editing experience. The wrapper div in the pasted component already has the `data-flow-tempo` identifier; users add `data-flow-ft-*` attributes as needed through Webflow's attribute panel or component property bindings.

---

## DialKit in Webflow

DialKit can be loaded inside a Webflow site for live parameter tweaking. It's off by default — the designer enables it by setting `dialKit: true` in CONFIG or `data-flow-ft-dial-kit="true"` on the wrapper div.

### How It Works

1. The standalone script detects `dialKit === true`
2. It dynamically loads `dialkit-standalone.js` from the CDN
3. This bundle contains React + ReactDOM + DialKit pre-packaged with a vanilla JS API
4. It creates the floating DialKit panel with all controls from `DIAL_CONFIG`
5. Param changes update the `P` object in real-time — the render loop picks them up immediately
6. A **"Copy Config"** button in the panel copies the current param values as a formatted CONFIG block
7. The designer pastes the new CONFIG over the old one in the HtmlEmbed to persist changes

### DialKit Standalone Bundle

A pre-built bundle hosted at `https://webgl-experiments.vercel.app/exports/dialkit-standalone.js`.

**Contents:**
- React + ReactDOM (production builds)
- DialKit library + styles (CSS injected at load time)
- Vanilla JS API wrapper

**Exposed API:**
```javascript
window.FlowDialKit = {
  /**
   * Create a DialKit panel connected to the experiment params.
   *
   * @param params    - The live params object (mutated in place by DialKit)
   * @param config    - DialKit folder config with ranges
   * @param onChange  - Called whenever a param value changes
   */
  create(params, config, onChange) { ... }
};
```

**Build script:** `scripts/build-dialkit-standalone.ts` — uses Vite library mode to bundle React + DialKit into a single IIFE with `window.FlowDialKit` global.

### Size Considerations

The DialKit standalone bundle will be ~120-150KB gzipped (React ~40KB + ReactDOM ~40KB + DialKit + styles). This is acceptable because:
- It only loads when the designer explicitly enables it
- It's for design-time tweaking, not end-user facing
- It's cached after first load

### Copy Config Button

The Copy Config button appears in the DialKit panel footer. When clicked, it copies the current params formatted as:

```javascript
const CONFIG = {
  bgColor: "0d0d10",
  color1: "492d7b",
  color2: "8c5a1c",
  // ... all params with current values
  dialKit: false,
};
```

Note: `dialKit` is always set to `false` in the copied CONFIG. The designer re-enables it manually if they need to tweak again. This prevents DialKit from loading on the published site.

---

## DialKit "Copy Config" in Our Tool

In addition to the Webflow DialKit, our tool's own DialKit panel also gets a **Copy Config** button. This supports the workflow:

1. Designer exports effect to Webflow (Webflow JSON paste)
2. Later, wants to change colors or tweak noise
3. Opens our tool, loads the same experiment, adjusts params in DialKit
4. Clicks "Copy Config" — gets the formatted CONFIG block on clipboard
5. Opens Webflow, edits the HtmlEmbed, pastes over the old CONFIG block

The format is identical to what the Webflow DialKit produces — a drop-in replacement for the CONFIG block at the top of the inline script.

---

## Post-Export Customization Paths

### Path 1: Edit CONFIG Directly

Open the HtmlEmbed code in Webflow Designer, find the CONFIG block at the top, change values. Simple and immediate.

### Path 2: Webflow Component Properties

Bind `data-flow-ft-*` attributes to Component Properties. Webflow's property panel then shows named inputs (sliders, number fields, text fields) that non-technical team members can adjust without touching code.

### Path 3: Re-export from Our Tool

Return to our tool, tweak in DialKit, click "Copy Config" to grab updated values. Paste into the Webflow HtmlEmbed.

### Path 4: DialKit in Webflow

Set `dialKit: true` in CONFIG. The floating control panel appears on the page. Tweak params live, then click "Copy Config" to persist. Set `dialKit: false` when done.

---

## File Structure

### New Files

```
src/
  experiments/
    flow-field/
      generateExport.ts           # Generates full inline IIFE string
  lib/
    webflow-json.ts               # Generates @webflow/XscpData JSON
scripts/
  build-dialkit-standalone.ts     # Builds dialkit-standalone.js bundle
```

### Modified Files

```
src/
  components/
    ExportPanel.tsx               # Tabbed layout, Webflow JSON tab
  lib/
    webflow-export.ts             # Updated inline script generation
  experiments/
    flow-field/
      standalone.ts               # Add data-attr reading + dialKit loading
```

---

## Per-Experiment Export Generator

Each experiment has a `generateExport.ts` file that produces the full inline IIFE as a string. This file imports the experiment's shaders (which Vite inlines as strings at build time) and constructs the complete self-contained script.

```
src/experiments/flow-field/generateExport.ts
```

**Responsibilities:**
- Import vertex and fragment shaders as raw strings
- Accept current params (from DialKit) + dial config (from params.ts)
- Return a complete `<script>...</script>` string containing:
  - Header comment with experiment name/version
  - CONFIG block populated with the passed params
  - DIAL_CONFIG block from the experiment's dialConfig
  - Data attribute reading logic
  - DialKit dynamic loading logic
  - Full WebGL2 init, shader compilation, VAO setup, uniforms, render loop
- Colors are stripped of `#` prefix before embedding

**Template approach:** The generator uses template literals to compose the output. Shader source strings are embedded verbatim. The CONFIG values come from the current DialKit state passed at export time.

The existing `standalone.ts` remains as the entry point for `build-export.ts` (hosted bundle builds). `generateExport.ts` is specifically for the inline Webflow JSON export path.

---

## Webflow JSON Generator

```
src/lib/webflow-json.ts
```

**Responsibilities:**
- Accept the inline script string (from `generateExport.ts`) and sizing options
- Generate fresh UUIDs for all nodes and styles
- Construct the `@webflow/XscpData` JSON with:
  - Wrapper div node (Block type)
  - Canvas node (DOM type with `data-flow-tempo` attribute)
  - HtmlEmbed node (with the inline script)
  - Canvas style (100% sizing or fixed dimensions)
  - Empty assets, ix1, ix2 sections
  - Meta section with zeroed counters
- Return the JSON as a string (for clipboard)

**UUID generation:** Uses `crypto.randomUUID()` with a fallback to a simple random hex generator for older browsers.

**Script escaping:** The inline script inside the HtmlEmbed's `v` field and `meta.html` field needs proper escaping for JSON embedding (newlines as `\n`, quotes escaped, etc.). `JSON.stringify` handles this when building the outer JSON.

---

## Implementation Phases

### Phase 1: Core Export

The foundation. Gets the Webflow JSON paste working end to end.

- [ ] **Tabbed ExportPanel** — Refactor ExportPanel.tsx from stacked sections to 3 tabs (Webflow JSON / HTML Embed / MCP). Shared version selector and sizing options at top.
- [ ] **`webflow-json.ts`** — New module that generates the `@webflow/XscpData` JSON structure. Takes inline script string + sizing options, returns clipboard-ready JSON string.
- [ ] **`generateExport.ts` for flow-field** — New file that imports shaders and returns the full inline IIFE string. Accepts current params and dial config.
- [ ] **CONFIG block generation** — The inline IIFE starts with a CONFIG block populated from the user's current DialKit values. Colors stripped of `#`.
- [ ] **Data attribute reading** — The IIFE reads `data-flow-ft-*` attributes from the wrapper div and overrides CONFIG values. Auto-derives kebab-case from camelCase param names.
- [ ] **`hex2rgb` update** — Support both `#rrggbb` and `rrggbb` formats in the color helper (for backward compat with hosted bundles + new no-hash convention).
- [ ] **Wire it up** — ExportPanel's Webflow JSON tab calls `generateExport()` with current params, passes result to `generateWebflowJSON()`, copy button puts it on clipboard.
- [ ] **Update standalone.ts** — Add data attribute reading logic so the hosted bundle (HTML Embed tab) also supports `data-flow-ft-*` overrides.

### Phase 2: DialKit in Webflow

The live tweaking experience inside Webflow.

- [ ] **`build-dialkit-standalone.ts`** — Build script that bundles React + ReactDOM + DialKit + CSS + vanilla API wrapper into a single IIFE. Output: `dist/exports/dialkit-standalone.js`.
- [ ] **Vanilla API wrapper** — `window.FlowDialKit.create(params, config, onChange)`. Creates a React root, renders DialKit panel, wires up param syncing and Copy Config button.
- [ ] **DialKit loading in IIFE** — The inline script checks `CONFIG.dialKit` / `data-flow-ft-dial-kit` and dynamically loads the standalone bundle if true.
- [ ] **DIAL_CONFIG embedding** — `generateExport.ts` includes the full dial config (folder structure with ranges) in the IIFE so the standalone DialKit knows all control definitions.
- [ ] **Copy Config button (Webflow DialKit)** — Button in the DialKit panel footer. Copies current params as a formatted CONFIG block. Always sets `dialKit: false` in output.
- [ ] **Copy Config button (our tool)** — Add the same button to our tool's DialKit panel. Same format, same behavior. Supports the "tweak in our tool, paste in Webflow" workflow.
- [ ] **Host the bundle** — Deploy `dialkit-standalone.js` alongside experiment bundles at `/exports/dialkit-standalone.js`. Add to Vercel config with appropriate cache headers.

### Phase 3: Template & Multi-Experiment Support

Scale the system to all experiments.

- [ ] **Export template** — Add `generateExport.ts` to the experiment template (`src/templates/experiment-template/`). New experiments get export support out of the box.
- [ ] **Update `new-experiment.ts`** — Scaffold script generates `generateExport.ts` with placeholder shader imports and WebGL setup.
- [ ] **Shared export utilities** — Extract common patterns (data-attr reading, DialKit loading, hex2rgb, resize observer, mouse tracking) into shared helper strings that `generateExport.ts` files can compose from.
- [ ] **Update `create-experiment.md` skill** — Document that new experiments need a `generateExport.ts` and what it should contain.

---

## Color Format

Colors throughout the export system use **hex without the `#` prefix**.

| Context | Format | Example |
|---------|--------|---------|
| CONFIG block | `"492d7b"` | `color1: "492d7b"` |
| Data attributes | `"492d7b"` | `data-flow-ft-color1="492d7b"` |
| Copy Config output | `"492d7b"` | Same as CONFIG |
| Internal processing | Both accepted | `hex2rgb` handles with/without `#` |

The `hex2rgb` helper in the IIFE strips `#` if present, so both formats work at runtime. This is for backward compatibility with the existing hosted bundles that use `#`-prefixed colors in BAKED_PARAMS.

---

## Open Questions

These are decisions that can be finalized during implementation:

1. **Canvas class naming** — Currently `"Canvas"` in the Webflow JSON. Should it be more specific (e.g. `"Flow Tempo Canvas"`) to avoid collisions with existing Webflow classes?

2. **Multiple experiments on one page** — The current selector is `[data-flow-tempo]` which would match all instances. Should we use `[data-flow-tempo="flow-field"]` (with the slug as the value) to support multiple different experiments on the same page?

3. **Wrapper class for sizing** — Should the wrapper div in the Webflow JSON have a class with the sizing styles, or just inline styles? A class is cleaner for Webflow users to override, but inline styles guarantee the sizing works without class conflicts.

4. **DIAL_CONFIG size** — For experiments with many controls, the DIAL_CONFIG block could be large. Should we only include it when `dialKit` is enabled in CONFIG? This would mean users who later want to enable DialKit would need to re-export.

5. **Script minification** — Should the inline IIFE in the Webflow JSON be minified? Smaller paste payload but harder to read/edit the CONFIG. Could offer both: "Copy JSON (readable)" and "Copy JSON (minified)".
