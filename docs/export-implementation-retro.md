# Export Implementation Retrospective

> Mistakes, patterns, and takeaways from building the Webflow JSON export system (Phase 1 + DialKit standalone).

---

## Bugs Shipped & Root Causes

### 1. `[object Object]` in CONFIG block — broke the entire script silently

**What happened:** The live params object at export time contained runtime-only keys like `circleCenter: { x: 0.5, y: 0.5 }` that DialKit adds dynamically. `formatValue()` called `String()` on the object → `circleCenter: [object Object]` → invalid JavaScript → the entire IIFE died on parse.

**Root cause:** Used a **blocklist** (skip these specific keys) instead of a **whitelist** (only include these known keys). New params added at runtime slipped through.

**Fix:** Replaced the blocklist with `EXPORT_KEYS` — a Set of the ~28 param names the render loop actually reads. Added `isExportablePrimitive()` type guard that rejects anything that isn't `string | number | boolean`.

**Pattern:** When serializing a dynamic object into code, always whitelist what you include. Blocklists rot as the source object grows.

---

### 2. Canvas rendered at 0×0 pixels — nothing visible

**What happened:** The Webflow JSON created a wrapper div with no class/style. Canvas was `width: 100%; height: 100%` of a zero-height parent. WebGL drew to a 0×0 viewport — technically "working" but invisible.

**Root cause:** Assumed the user would style the wrapper in Webflow. A pasted component needs to be visually present immediately or it looks broken.

**Fix:** Added a `Flow Tempo Wrapper` style class with `position: relative; width: 100%; height: 100vh;` (responsive) or explicit pixel values (fixed).

**Pattern:** Exported components must render visibly with zero configuration. Default to `100vh` — the user can shrink it. An invisible component looks like a broken component.

---

### 3. Clipboard MIME type — Webflow ignored the paste

**What happened:** Used `navigator.clipboard.writeText(json)` which writes `text/plain`. Webflow Designer only recognizes paste data with MIME type `application/json`.

**Root cause:** Didn't research how Webflow's paste actually works before implementing. Assumed clipboard = text.

**Fix:** Used `document.execCommand('copy')` with a `ClipboardEvent` handler that calls `e.clipboardData.setData('application/json', json)`. This is the same technique used by Relume, Flowbase, and Finsweet's component libraries.

**Pattern:** When integrating with a third-party tool's clipboard, verify the exact MIME type and write mechanism first. The `navigator.clipboard` API only supports `text/plain` and `text/html` — anything else requires the legacy `execCommand` path.

---

### 4. `document.currentScript.parentElement` pointed to wrong element

**What happened:** In Webflow, the HtmlEmbed renders inside its own `<div class="w-embed">` wrapper. So `document.currentScript.parentElement` was the embed div, not our wrapper. `wrapper.querySelector("canvas")` found nothing.

**Root cause:** Assumed the script's parent was our wrapper div. Didn't account for Webflow adding an intermediate DOM node.

**Fix:** Walk up the DOM tree from `currentScript` looking for the canvas via `[data-flow-{slug}]` attribute. Fallback to global `querySelector`.

**Pattern:** Never assume parent element structure in third-party platforms. Use data attributes for targeting and walk/query the DOM defensively.

---

### 5. Export always used default values, not the user's tweaked params

**What happened:** User tweaked colors in DialKit, opened export, clicked Copy JSON — but the exported CONFIG had the original default values.

**Root cause:** `useExperimentParams` returns a **stable mutable ref** (same object reference, mutated in place by DialKit). The ExportPanel used `useMemo` with `params` as a dependency. Since the reference never changed, `useMemo` never recomputed. It cached the JSON from the first render with initial values.

**Fix:** Removed `useMemo`. Generate the JSON fresh at click time via `buildWebflowJSON()`, spreading the params (`{ ...params }`) to snapshot the current mutated values.

**Pattern:** `useMemo` and `useCallback` with mutable ref dependencies are traps. If the dependency is mutated in place (not replaced), React never sees a change. Generate on-demand instead of caching.

---

### 6. DialKit standalone bundle was a 404

**What happened:** The inline script had all the right code to detect `dialKit: true` and dynamically load `dialkit-standalone.js` from the CDN. But the file didn't exist — it had never been built or deployed. The `<script>` load silently failed.

**Root cause:** Implemented the *loading* code (Phase 1) without building the *loaded* code (Phase 2). Called it "wired up" when the other end of the wire went nowhere.

**Fix:** Built the standalone bundle: React + ReactDOM + DialKit + CSS in a single IIFE. CSS injected at runtime via a `<style>` tag prepended to the bundle. Added to the build pipeline.

**Pattern:** If code dynamically loads a resource, that resource must exist before you call the feature "done." A loading mechanism without the payload is a silent failure.

---

### 7. CSS extracted into separate file instead of inlined

**What happened:** Vite's library mode extracted DialKit's CSS into a separate `.css` file. The standalone bundle loaded without styles — unusable controls.

**Root cause:** `cssCodeSplit: false` tells Vite to combine all CSS into one file, but it still extracts it. Library mode doesn't inline CSS by default.

**Fix:** Post-build step reads the extracted CSS file, escapes it for template literal embedding, prepends a self-executing `<style>` injector to the JS bundle, then deletes the CSS file.

**Pattern:** For truly self-contained bundles (IIFE loaded via `<script>` tag), CSS must be injected at runtime. Vite doesn't do this natively in library mode — build a post-processing step.

---

## Webflow XscpData Format — Undocumented

The `@webflow/XscpData` clipboard format is not officially documented. Key findings from reverse engineering:

| Field | Notes |
|-------|-------|
| `type` | Must be `"@webflow/XscpData"` |
| `payload.nodes[]` | Array of elements. Types: `Block`, `DOM`, `HtmlEmbed` |
| `payload.nodes[]._id` | Random UUID, internally consistent. Webflow remaps on paste |
| `payload.nodes[].children` | Array of child `_id` references |
| `payload.nodes[].classes` | Array of style `_id` references |
| `payload.nodes[].data.tag` | For `DOM` type: the actual HTML tag (e.g. `"canvas"`) |
| `payload.nodes[].data.xattr` | Custom data attributes: `[{ name, value }]` |
| `payload.nodes[].data.attributes` | Also works for data attributes on DOM nodes |
| `payload.nodes[].v` | HtmlEmbed: the raw HTML content string |
| `payload.nodes[].data.embed.meta.html` | HtmlEmbed: same content, duplicated |
| `payload.styles[]` | Class definitions with `styleLess` (CSS property string) |
| `meta` | Zeroed counters (`droppedLinks`, `unlinkedSymbolCount`, etc.) |

**Clipboard write:** Must use `application/json` MIME type. `text/plain` is ignored by Webflow Designer.

**HtmlEmbed rendering:** Webflow wraps the content in `<div class="w-embed">`. The script is a child of this div, not a direct child of the parent Block.

**Node structure:** Match the full structure from real Webflow copies (include `devlink`, `displayName`, `attr`, `visibility`, etc.). Minimal structures sometimes work but can behave unpredictably.

---

## General Takeaways

1. **"It compiles" ≠ "it works."** TypeScript passing and Vite building mean nothing if the output doesn't function in the target environment. Test the actual end-to-end flow.

2. **Test with real data.** The `[object Object]` bug only appeared because the live params had dynamic runtime keys. Testing with static defaults would never catch it.

3. **Research the integration surface first.** The clipboard MIME type and DOM structure issues would've been caught in 10 minutes of research before writing any code.

4. **Mutable refs and React memoization don't mix.** If a value is mutated in place, React's dependency tracking is blind to it. Either replace the reference or generate on demand.

5. **Self-contained bundles need self-contained CSS.** Any externally loaded IIFE that renders UI must inline its styles. A separate CSS file requires the consumer to add a `<link>` tag — which defeats the purpose of a drop-in script.

6. **Whitelist > blocklist** for serialization boundaries. The set of valid keys is finite and known; the set of invalid keys grows unpredictably.

7. **Exported components must render visibly by default.** Zero-height containers, missing styles, or invisible canvases look like bugs to the user. Ship something visible, let them customize from there.
