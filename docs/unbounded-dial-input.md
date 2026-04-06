# Unbounded Dial Input — Implementation Reference

> How we added unbounded (no min/max) number controls to DialKit, the mistakes we made along the way, and the patterns that actually work.

---

## The Problem

DialKit's Slider component maps a handle position between a left edge (min) and a right edge (max). Every number becomes a bounded slider via `inferRange()` — even plain numbers get auto-assigned ranges like `{ min: 0, max: 150, step: 1 }`.

Some properties shouldn't have bounds. A camera offset, a noise seed, a position value — these need to go from -∞ to +∞. The Slider's entire mental model (`position on track = value`) doesn't apply when there are no edges.

## Architecture

### Where the code lives

DialKit is an npm dependency. We patch it at install time:

- **`scripts/patch-dialkit.sh`** — Runs via `postinstall`. Copies the patched React bundle and appends UB CSS.
- **`scripts/dialkit-patches/index.js.patched`** — Complete replacement for `node_modules/dialkit/dist/index.js`. Contains all store patches + the `UBControl` React component.
- **`scripts/dialkit-patches/ub.css`** — Appended to `node_modules/dialkit/dist/styles.css`.

### Three layers that need patching

This was our biggest repeated mistake. DialKit has **three separate code paths** for the same logic:

1. **`DialStoreClass` (the class)** — `parseConfig()`, `flattenValues()`, `isUBConfig()`. These are methods on the store class used internally.
2. **Standalone functions** — `buildResolvedValues()`, `isUBConfig()` (standalone version). Used by `useDialKit()` to resolve values back to the consumer.
3. **`renderControl()` in Panel** — The React switch statement that maps `control.type` to JSX. This is inside the `Panel` function component.

**If you only patch the store but not `renderControl()`, the config parses correctly but nothing renders.** If you only patch `renderControl()` but not the store, the config objects fall through to the folder handler and render as `{ type: "ub-5", default: 42, step: 1 }` with three child controls (Type, Default, Step).

### Critical mistake: Svelte vs React

DialKit ships both a Svelte and a React build. This project uses **React** via `useDialKit()` and `<DialRoot />`. The React renderer lives in `dist/index.js`. The Svelte renderer lives in `dist/svelte/components/ControlRenderer.svelte`.

We spent multiple iterations patching the Svelte `ControlRenderer.svelte` before realizing the app never reads it. The React bundle at `dist/index.js` has its own complete copy of everything — its own `parseConfig`, its own `flattenValues`, its own `renderControl` switch statement. **Always patch `dist/index.js`.**

## The Config Format

In `params.ts`, unbounded controls are declared as objects with a `type` string starting with `ub-`:

```ts
'Spring Slider': {
  springA: { type: 'ub-1', default: 25, step: 0.5 },
  springB: { type: 'ub-4', default: 50, step: 1 },
},
```

The store's `isUBConfig()` check:
```js
isUBConfig(value) {
  return typeof value === "object" && value !== null
    && "type" in value && typeof value.type === "string"
    && value.type.startsWith("ub-");
}
```

This must be checked **before** the generic `typeof value === "object"` folder fallback in both `parseConfig()` and `flattenValues()`. Order matters.

## The Three Control Families

### Spring Slider (`ub-1`, `ub-4`, `ub-7`, `ub-8`)

A center handle that you drag left/right. Quadratic acceleration — further from center = faster value change. On release, the handle springs back to center but the value stays. Each drag gesture accumulates.

| Variant | Handle at rest | Behavior |
|---------|---------------|----------|
| `ub-1` (Spring A) | Hidden | Basic quadratic drag |
| `ub-4` (Spring B) | Always visible (0.3 opacity) | Quadratic + momentum fling on release |
| `ub-7` (Spring C) | Hidden | Quadratic + auto-scroll zone past track edge |
| `ub-8` (Spring D) | Always visible | Quadratic + auto-scroll zone past track edge |

**Auto-scroll zone**: When the cursor passes the track edge (where the rubber band stretch starts), the value begins auto-incrementing continuously. Speed scales with distance past the edge. Cursor changes to `e-resize`/`w-resize`. Dragging back inside stops the auto-scroll and spring-animates the rubber band back.

### Scrub Field (`ub-2`, `ub-5`)

A flat row — no handle, no fill, no track. Drag horizontally to change the value. Vertical cursor position controls speed.

| Variant | Speed control |
|---------|--------------|
| `ub-2` (Scrub A) | 4 discrete zones: ×10, ×1, ×0.1, ×0.01 |
| `ub-5` (Scrub B) | Smooth exponential: cursor Y maps to ×0.001 through ×1000 |

A floating badge shows the current speed multiplier during drag.

### Ring Slider (`ub-3`, `ub-6`)

A scrolling number line with tick marks. Center hairline marks the current value. Drag to scroll the tape. Shift+scroll to zoom (change visible range = change precision).

| Variant | Hashmarks at rest | Behavior |
|---------|------------------|----------|
| `ub-3` (Ring A) | Hidden (appear on hover) | Basic drag |
| `ub-6` (Ring B) | Always visible | Drag + momentum fling on release |

## Matching the Original Slider

The UB controls reuse as much of the original Slider's code as possible. Key patterns taken directly from the Slider source:

### Handle dodge (valueDodge)

When the handle position overlaps the label or value text, it fades out and shrinks:

```js
const HANDLE_BUFFER = 8;
const leftThresh = (10 + labelWidth + HANDLE_BUFFER) / trackWidth * 100;
const rightThresh = (trackWidth - 10 - valueWidth - HANDLE_BUFFER) / trackWidth * 100;
const dodge = handlePct < leftThresh || handlePct > rightThresh;
const opacity = dodge ? 0.1 : isDragging ? 0.9 : 0.5;
const scaleY = isActive && dodge ? 0.75 : 1;
```

Fallback defaults (`30` / `78`) are needed for the first render before refs are measured.

### Handle animation via motion.div

The handle is a `motion.div` with the exact same spring transitions as the original:

```js
animate: {
  opacity: handleOpacity,
  scaleX: isActive ? 1 : 0.25,
  scaleY: isActive && dodge ? 0.75 : 1
},
transition: {
  scaleX: { type: "spring", visualDuration: 0.25, bounce: 0.15 },
  scaleY: { type: "spring", visualDuration: 0.2, bounce: 0.1 },
  opacity: { duration: 0.15 }
}
```

### Rubber band stretch

Track physically expands when dragging past edges. Same constants and formula:

```js
const DEAD_ZONE = 32;
const MAX_CURSOR_RANGE = 200;
const MAX_STRETCH = 8;

const overflow = Math.max(0, distancePast - DEAD_ZONE);
return sign * MAX_STRETCH * Math.sqrt(Math.min(overflow / MAX_CURSOR_RANGE, 1));
```

Spring-back on release: `{ type: "spring", visualDuration: 0.35, bounce: 0.15 }`

### Value editing pattern

The original Slider has a specific flow: hover the value text for 800ms → underline appears → cursor changes to `text` → click to enter edit mode. We replicate this exactly with `isValueHovered`, `isValueEditable`, and the `hoverTimeoutRef`.

### CSS class reuse

UB controls reuse these DialKit classes directly:
- `dialkit-slider-wrapper` — wrapper div with `position: relative; height: var(--dial-row-height)`
- `dialkit-slider-label` — label text positioning and style
- `dialkit-slider-value` / `dialkit-slider-value-editable` — value text with edit affordance
- `dialkit-slider-input` — text input for direct value entry
- `dialkit-slider-hashmark` / `dialkit-slider-hashmarks` — tick mark container and marks

New classes are only for elements the original doesn't have:
- `ub-spring`, `ub-spring__handle`, `ub-spring__notch`, `ub-spring__dot`
- `ub-zones`, `ub-zones__badge`
- `ub-tape`, `ub-tape__hairline`, `ub-tape__tick--major`

## Production Guard

DialKit 1.2 added a production guard in `DialRoot`:

```js
var isDevDefault = typeof process !== "undefined" && process?.env?.NODE_ENV
  ? process.env.NODE_ENV !== "production"
  : typeof import.meta !== "undefined" && import.meta.env?.MODE
    ? import.meta.env.MODE !== "production"
    : true;

function DialRoot({ productionEnabled = isDevDefault }) {
  if (!productionEnabled) return null;
```

On Vercel (NODE_ENV=production), DialRoot renders nothing by default. Fix:

```tsx
<DialRoot productionEnabled defaultOpen={window.innerWidth > 1000} />
```

## Mistakes Made (in order)

1. **Patched Svelte files instead of the React bundle.** Wasted multiple iterations before discovering `dist/index.js` has its own complete renderer.

2. **Patched only `dist/store/index.js` but not `dist/index.js`.** The store is a separate file, but the React bundle has its own copy of the store code inlined. Both need patching.

3. **Built 8 variants that all looked identical.** First attempt was 8 different drag behaviors inside the same `label + value` row. The user correctly pointed out they were visually indistinguishable — different invisible behaviors in the same visual shell is not UX exploration.

4. **Used hardcoded rgba values instead of CSS variables.** The original Slider uses `var(--dial-surface)`, `var(--dial-text-primary)`, etc. Early versions of UB CSS hardcoded colors, which broke visual consistency.

5. **Used plain divs instead of motion.div for the handle.** The spring feel was completely missing until we switched to the motion library's `animate`/`transition` system.

6. **Used CSS `:hover` for background changes.** The original Slider uses JS-driven class toggling (`isActive`). Mixing CSS `:hover` with JS state can cause subtle mismatches during pointer capture.

7. **Forgot the value editing hover-delay pattern.** Original requires 800ms hover before the value becomes clickable. Early UB versions let you click immediately with no visual hint.

8. **Auto-scroll direction flip bug.** Dragging from past the left edge directly to past the right edge (without re-entering the track) kept the old direction because the loop start was gated by `autoRef.current === 0`.

9. **Rubber band snap on re-entry.** When dragging back inside from the auto-scroll zone, the rubber band jumped to 0 instead of spring-animating back.

10. **No dodge fallback on first render.** The original Slider falls back to `leftThreshold = 30, rightThreshold = 78` before refs are measured. Without this, the handle overlaps text on first render.

11. **Didn't discover the production guard.** DialKit 1.2 added `productionEnabled` which defaults to `false` in production. DialRoot silently returns null. No error, no warning — just nothing renders.

## File Edit Workflow

Editing `node_modules/dialkit/dist/index.js` directly is fragile. The working approach:

1. Split the file around the UBControl function: `head -n {start} > /tmp/ub_top.js`, `tail -n +{end} > /tmp/ub_bottom.js`
2. Write the new middle section to `/tmp/ub_middle.js`
3. Concatenate: `cat /tmp/ub_top.js /tmp/ub_middle.js /tmp/ub_bottom.js > dist/index.js`
4. Syntax check: `node -c dist/index.js`
5. Build check: `npx vite build`
6. Save: `cp dist/index.js scripts/dialkit-patches/index.js.patched`

Always clear Vite's dependency cache after changing `node_modules`: `rm -rf node_modules/.vite`

The dev server must be fully restarted (not just HMR) to pick up node_modules changes.
