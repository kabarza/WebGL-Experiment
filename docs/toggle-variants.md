# Toggle Variants — Custom Animated Toggles for DialKit

> Custom segmented Off/On toggle controls with a directional liquid-blob stretch animation, built as patched extensions to DialKit.

---

## Overview

DialKit ships with a built-in toggle that renders booleans as a `SegmentedControl` with Off/On buttons and a sliding pill indicator. We extended this with custom toggle variants that add a liquid-stretch animation and visual styling options, without modifying DialKit's original toggle at all.

The variants live entirely in the patch system (`scripts/dialkit-patches/`) and register as `ub-t*` types — the same pattern used for the custom unbounded slider controls (`ub-1` through `ub-8`).

### Current variants

| Type | Name | Description |
|------|------|-------------|
| `ub-t1` | Clean Liquid | Exact DialKit segmented look with liquid animation |
| `ub-t6` | Warm Accent | Orange pill Off, green pill On — color signals state |
| `ub-t12` | Green Accent | Green pill on On, snappy fast animation |
| `ub-t11` | Jade Refined | Bordered, padded, jade green tint + glow — all values via CSS custom properties |

---

## Architecture

### How it plugs into DialKit

```
params.ts (dialConfig)                         →  DialStore.parseConfig()  →  renderControl()  →  ToggleVariant
{ type: 'ub-t1', default: false }                 isUBConfig() ✓              switch case         shared JSX
```

Three touch points in the patched bundle (`scripts/dialkit-patches/index.js.patched`):

1. **`isUBConfig()`** — Already checks `value.type.startsWith("ub-")`, so `ub-t*` types flow through automatically. No change needed.
2. **`flattenValues()`** — Extracts `value.default` for UB configs. Stores the boolean as-is.
3. **`renderControl()` switch** — Added: `case "ub-t1": case "ub-t6": case "ub-t11": case "ub-t12":` that renders `<ToggleVariant>`.

### File locations

| File | What it contains |
|------|-----------------|
| `scripts/dialkit-patches/index.js.patched` | `ToggleVariant` component + switch cases |
| `scripts/dialkit-patches/ub.css` | All toggle CSS (shared base + per-variant overrides via CSS custom properties) |
| `scripts/patch-dialkit.sh` | Copies patched JS and appends CSS to DialKit's installed dist |

### How patching works

```sh
# patch-dialkit.sh runs on `npm install` via postinstall hook
cp "$PATCHES/index.js.patched" "$DIST/index.js"   # full bundle replacement
cat "$PATCHES/ub.css" >> "$DIST/styles.css"        # CSS appended
```

**On DialKit updates:** Run `npm install`, the postinstall hook applies patches. If DialKit changed the `Toggle` component signature, the `renderControl` switch, or `parseConfig` — the patched bundle needs rebasing. The toggle variants are self-contained and unlikely to conflict.

---

## CSS Custom Properties

All visual parameters are centralized as CSS custom properties on `.dialkit-root` in `ub.css`. This means every value is tunable live in devtools and there are zero magic numbers scattered across rules.

### Jade toggle properties

```css
.dialkit-root {
  --ub-jade-padding: 3px;
  --ub-jade-border-radius: 11px;
  --ub-jade-border-width: 1px;
  --ub-jade-pill-radius: 8px;
  --ub-jade-btn-pad-v: 7px;
  --ub-jade-btn-pad-h: 11px;
  --ub-jade-pill-bg: rgba(80, 200, 140, 0.16);
  --ub-jade-pill-glow: 0 0 6px rgba(80, 200, 140, 0.06);
  --ub-jade-text-color: rgba(110, 220, 170, 0.95);
  --ub-jade-border-color: rgba(80, 200, 140, 0.18);
  --ub-jade-pill-transition: 0.35s;
  --ub-jade-anim-duration: 580ms;
  --ub-jade-ease: cubic-bezier(0.25, 0.75, 0.3, 1);
}
```

### Warm toggle properties

```css
.dialkit-root {
  --ub-warm-padding: 2px;
  --ub-warm-border-radius: 10px;
  --ub-warm-pill-radius: 7px;
  --ub-warm-pill-bg: rgba(255, 170, 80, 0.18);
  --ub-warm-pill-glow: none;
  --ub-warm-text-color: rgba(255, 195, 130, 0.95);
  --ub-warm-pill-transition: 0.35s;
  --ub-warm-anim-duration: 540ms;
  --ub-warm-ease: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Why this matters

Before the refactor, every variant had hardcoded pixel values and colors spread across multiple rules. Changing the jade pill radius meant finding it in three places. Now you change `--ub-jade-pill-radius` in one place and every rule that references it updates. This also means the UB controls (spring slider, scrub field, ring slider) follow the same pattern — their handle, notch, and dot dimensions are all `--ub-*` properties on `.dialkit-root`.

---

## The Animation System

### Two-layer design

The animation uses CSS transitions and `@keyframes` working together:

- **Base layer (inline styles):** The pill's `left` and `width` are set directly via `element.style` in a `useLayoutEffect` that runs on every `checked` state change. This positions the pill on the active button synchronously before paint.
- **Animation layer (keyframes):** A temporary `.tv-liquid` class triggers a `@keyframes` animation that takes over `left`, `width`, and `transform` — deforming the pill through a stretched midpoint before landing at the destination.

When the animation finishes, JS removes the `.tv-liquid` class. The pill is already at its correct final position via the inline styles, so there's no visual jump.

### The three-stop keyframe structure

```css
@keyframes tv-blob {
  0%   { left: var(--tv-sl); width: var(--tv-sw); transform: scaleY(1); }
  62%  { left: var(--tv-ml); width: var(--tv-mw); transform: scaleY(0.88); }
  100% { left: var(--tv-el); width: var(--tv-ew); transform: scaleY(1); }
}
```

- **0%** — Pill at start button, normal size
- **62%** — Pill stretched wide across both buttons (directional), squashed vertically
- **100%** — Pill at destination, normal size

The peak stretch at 62% (not 50%) means the pill holds its deformed shape past center, then contracts quickly on landing — like a water droplet. If you put it at 50% it feels mechanical.

Each variant can override the animation by targeting `.tv-t{N}-pill.tv-liquid` with a different duration, easing, or even a completely different keyframe set.

### Directional stretch math

The stretch is directional — the trailing edge barely moves while the leading edge races ahead:

```js
var bias = 0.1;  // trailing edge holds back at 10% of button width
if (goingRight) {
  midL = sL + sW * bias;           // trailing left barely moved
  midR = eL + eW * (1 - bias);     // leading right raced ahead
} else {
  midL = eL + eW * bias;           // reverse direction
  midR = sL + sW * (1 - bias);
}
var midW = midR - midL;
```

These computed values are injected as CSS custom properties (`--tv-sl`, `--tv-sw`, `--tv-ml`, `--tv-mw`, `--tv-el`, `--tv-ew`) on the pill element, then consumed by the keyframes.

### JS orchestration

```
1. User clicks → handleToggle()
2. Measure start button (current) and end button (destination) positions
3. Compute directional midpoint stretch values
4. Set --tv-sl/sw/ml/mw/el/ew as inline CSS custom properties on pill
5. Remove .tv-liquid class
6. Force reflow: void pill.offsetWidth
7. Add .tv-liquid class → triggers @keyframes
8. Call onChange(next) → React re-renders → useLayoutEffect positions pill at destination
9. setTimeout removes .tv-liquid after animation duration + 40ms buffer
```

The `useLayoutEffect` fires synchronously before paint, setting the pill's inline `left`/`width` to the destination button. The keyframes' final frame matches exactly — seamless handoff when the class is removed.

### Reduced motion

Animations are disabled when `prefers-reduced-motion: reduce` is set — JS checks before adding the class, CSS has a fallback:

```css
@media (prefers-reduced-motion: reduce) {
  .tv-liquid { animation: none !important; }
}
```

---

## Lessons Learned & Pitfalls

### 1. Vite dependency cache

**Problem:** After patching `node_modules/dialkit/dist/index.js`, the dev server still serves the old code.

**Why:** Vite pre-bundles dependencies into `node_modules/.vite/deps/`. The cached bundle is stale.

**Fix:** Always delete `node_modules/.vite` after patching, then restart the dev server.

```sh
rm -rf node_modules/.vite && sh scripts/patch-dialkit.sh
```

### 2. First-click animation ghost

**Problem:** On the first click after page load, the pill visually jumps — a "ghost" of the old position flashes before the animation plays.

**Root cause (first attempt):** Used a `hasAnimated` ref that started `false` and was set to `true` after the first render. This skipped the first animation, causing a position snap visible as a flash.

**Fix:** Replaced `hasAnimated` with a `mounted` ref set to `true` inside `useLayoutEffect` — after the pill has been measured and positioned on mount. On the very first click, `mounted.current` is already `true`, so the animation plays immediately.

### 3. Compounding padding — don't fight the base

**Problem:** A bordered variant had uneven spacing between border and pill on different sides.

**Root cause:** The shared `.tv-seg` has `padding: 2px` and `.tv-pill` uses `top: 2px; bottom: 2px` relative to the content box. Adding extra padding on the variant compounded on top of the base, creating asymmetric gaps because the pill's JS-measured `left` position was in a different coordinate context than the CSS `top/bottom`.

**The wrong approaches we tried:**

```css
/* WRONG — resets base, then re-adds. Creates coordinate mismatches. */
.tv-t11 { padding: 0; }
.tv-t11-pill { top: 2px; bottom: 2px; left: 2px; right: 2px; }
.tv-t11-btn { margin: 2px; }

/* WRONG — align-self: stretch + flex: 1 on buttons. Unpredictable sizing. */
.tv-t11 { padding: 4px; gap: 2px; align-self: stretch; }
.tv-t11-btn { flex: 1; padding: 0 10px; }

/* WRONG — stripped row padding via :has(). Too invasive, breaks layout. */
.dialkit-labeled-control:has(.tv-t11) { padding: 0; }
```

**What actually works:** Use the variant's own padding to set the gap. Override the pill's `top`/`bottom` to match. The pill's `left` comes from JS measuring `btn.offsetLeft`, which naturally includes the container's padding — so horizontal spacing is automatic:

```css
.tv-t11 {
  border: var(--ub-jade-border-width) solid var(--dial-border);
  border-radius: var(--ub-jade-border-radius);
  padding: var(--ub-jade-padding);
}
.tv-t11-pill {
  top: var(--ub-jade-padding);
  bottom: var(--ub-jade-padding);
  border-radius: var(--ub-jade-pill-radius);
}
```

The pill's left/right are handled by JS. The variant padding controls the vertical gap. The border-radius is derived from the outer radius minus border minus padding.

### 4. Nested border-radius math

```
innerRadius = outerRadius - borderWidth - padding
```

Example with jade: `11px outer - 1px border - 3px padding ≈ 7-8px inner`. If this is wrong the inner corners look either too sharp or overflow the outer curve.

### 5. Right-side alignment

The row `.dialkit-labeled-control` has `padding: 2px 10px 2px 12px`. The base `.tv-seg` has `margin-right: -6px` to compensate (same as DialKit's `.dialkit-segmented`). For bordered variants, the border itself provides a visual edge, so the default margin is usually fine. Only override if the variant needs to sit flush against the row edge.

### 6. Centralize values as CSS custom properties

**Before (scattered magic numbers):**
```css
.tv-t11 { border-radius: 11px; padding: 3px; }
.tv-t11-pill { top: 3px; bottom: 3px; border-radius: 8px; }
.tv-t11-btn { padding: 7px 11px; }
```

**After (single source of truth):**
```css
.dialkit-root {
  --ub-jade-padding: 3px;
  --ub-jade-border-radius: 11px;
  --ub-jade-pill-radius: 8px;
  --ub-jade-btn-pad-v: 7px;
  --ub-jade-btn-pad-h: 11px;
}
.tv-t11 { border-radius: var(--ub-jade-border-radius); padding: var(--ub-jade-padding); }
.tv-t11-pill { top: var(--ub-jade-padding); bottom: var(--ub-jade-padding); border-radius: var(--ub-jade-pill-radius); }
.tv-t11-btn { padding: var(--ub-jade-btn-pad-v) var(--ub-jade-btn-pad-h); }
```

This matters because: (a) you can tweak any value in devtools instantly, (b) there's exactly one place to change each number, (c) it's self-documenting — `--ub-jade-pill-radius` is clearer than a bare `8px`.

### 7. Toggle vs. button behavior

**Problem:** Each button ("Off", "On") sent its value to the handler, and the handler checked `if (next === checked) return`. Clicking the already-active button did nothing.

**Fix:** Both buttons call the same `handleToggle()` which always flips to `!checked`. Clicking anywhere on the toggle always toggles.

### 8. ub.css duplication on repeated patching

`patch-dialkit.sh` does `cat ub.css >> styles.css`. Run it twice and the CSS is appended twice. No functional breakage but the file grows.

**Awareness:** Always start from a clean DialKit dist before patching. The postinstall hook handles this naturally on `npm install`, but manual re-patching during dev can accumulate duplicates.

### 9. Animation timing must match cleanup timeout

The JS cleanup timeout (`TV_CLEANUP_MS`) must be >= the longest animation duration + a buffer. If a fast variant (380ms) finishes but the cleanup is set to 580ms, the class lingers. Not harmful but wasteful. If the cleanup is shorter than the animation, the class is removed mid-animation causing a jump.

### 10. Iterate with the base, not against it

The biggest time sink was trying to create spacing by overriding base styles — resetting padding to 0, adding margins to buttons, stripping row padding with `:has()`. Every override created a new spacing inconsistency somewhere else.

The pattern that works: set the variant's container padding to the desired gap, set the pill's `top`/`bottom` to match that same padding value, let JS handle `left`/`width` naturally. Everything else inherits from the base.

---

## Adding a New Toggle Variant

### 1. Choose a type name

Use `ub-t{N}` (next unused number). The `ub-` prefix flows through DialKit's `isUBConfig()` automatically.

### 2. Add CSS custom properties to `.dialkit-root` in `ub.css`

```css
.dialkit-root {
  --ub-myvariant-padding: 3px;
  --ub-myvariant-border-radius: 10px;
  --ub-myvariant-pill-radius: 7px;
  /* ... */
}
```

### 3. Add CSS rules referencing those properties

```css
.tv-t{N} {
  border: 1px solid var(--dial-border);
  border-radius: var(--ub-myvariant-border-radius);
  padding: var(--ub-myvariant-padding);
}
.tv-t{N}-pill {
  top: var(--ub-myvariant-padding);
  bottom: var(--ub-myvariant-padding);
  border-radius: var(--ub-myvariant-pill-radius);
}
.tv-t{N}[data-checked="true"] .tv-t{N}-pill {
  background: var(--ub-myvariant-pill-bg);
}
.tv-t{N}[data-checked="true"] .tv-btn[data-active="true"] {
  color: var(--ub-myvariant-text-color);
}
/* Optional: custom animation timing */
.tv-t{N}-pill.tv-liquid {
  animation: tv-blob var(--ub-myvariant-anim-duration) var(--ub-myvariant-ease) both;
}
```

### 4. Add to the switch in `index.js.patched`

```js
case "ub-t1": case "ub-t6": case "ub-t11": case "ub-t12": case "ub-t{N}":
```

### 5. Add to experiment params

```ts
myToggle: { type: 'ub-t{N}', default: false },
```

### 6. Rebuild

```sh
rm -rf node_modules/.vite
sh scripts/patch-dialkit.sh
# restart dev server
```

---

## CSS Class Reference

| Class | Element | Purpose |
|-------|---------|---------|
| `.tv-seg` | Container | Shared segmented control layout (mirrors `.dialkit-segmented`) |
| `.tv-pill` | Pill | Sliding indicator background |
| `.tv-btn` | Button | Off/On button text |
| `.tv-liquid` | Pill | Temporary class — triggers the blob animation |
| `.tv-t{N}` | Container | Variant-specific container overrides |
| `.tv-t{N}-pill` | Pill | Variant-specific pill overrides |
| `.tv-t{N}-btn` | Button | Variant-specific button overrides |

### CSS custom properties (set by JS during animation)

| Property | Description |
|----------|-------------|
| `--tv-sl` | Start left position (px) |
| `--tv-sw` | Start width (px) |
| `--tv-ml` | Midpoint left position (px) — stretched |
| `--tv-mw` | Midpoint width (px) — stretched |
| `--tv-el` | End left position (px) |
| `--tv-ew` | End width (px) |

### Data attributes

| Attribute | Element | Values | Purpose |
|-----------|---------|--------|---------|
| `data-checked` | `.tv-seg` | `"true"` / `"false"` | Current toggle state, used for CSS color shifts |
| `data-active` | `.tv-btn` | `"true"` / `"false"` | Which button is the active one |
