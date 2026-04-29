# Globe 1 — Learnings

> Real bugs we shipped while building the wireframe globe, what caused them, and how we fixed them. Kept short on purpose.

---

## 1. CSS2DRenderer silently clobbered our `labelOffsetY`

**What happened:** A slider for "label offset Y" did nothing. Labels stayed glued to the cross no matter what value we set.

**Root cause:** `CSS2DRenderer` writes `element.style.transform = 'translate(-50%, -50%) translate(Xpx, Ypx)'` to its target element **every frame**, to project a 3D world point to a screen pixel. Inline styles always beat CSS-class styles, so our class-level `transform: translateY(offset)` was overwritten 60 times a second.

**Fix:** Hand the renderer a **wrapper** `<div>`, put the styled `<span>` inside it. The wrapper gets the projection; the span keeps our offset.

**Pattern:** When a library writes inline `style` on an element, anything you set on that same element via class is at risk. Either wrap (so the renderer's target and your styling target are different elements) or use a property the library doesn't touch.

---

## 2. Country snap landed dead-centre between grid lines

**What happened:** With non-divisible-by-180 grid sizes (e.g. `lonSeg: 21`, `latSeg: 19`) every country ended up exactly halfway between meridians/parallels, regardless of snap mode.

**Root cause:** `snapLon` rounded to multiples of `step` starting from 0 (so 0, ±step, ±2·step, …). The actual grid is drawn at `-180 + k·step` for `k ∈ [0, lonSeg)`. Those two lattices only coincide when 180° is divisible by step (e.g. 24 segments → step 15° → snap targets match). For 21 segments, the snap targets and grid lines were offset by half a step.

**Fix:** Snap to the same expression used to draw the lines:
```ts
let k = Math.round((l + 180) / lonStep);
return -180 + k * lonStep;
```

**Pattern:** When two pieces of code refer to "the same set of points", derive them from the same expression. A constant-offset bug in one of them creates a parallel ghost lattice that's invisible until your inputs aren't round numbers.

---

## 3. Snake animation froze at the destination, never looped

**What happened:** Snake reached the end country, the trail sat there, and the next route never started.

**Root cause:** `tailDist = headDist - trailLen`. Once `headDist == totalDistance`, `tailDist == totalDistance - trailLen` — forever less than the completion threshold. The route never marked itself "done", `active` never went null, the next `begin()` call never fired.

**Fix:** Once the head arrives, switch the tail to constant-speed motion until *it* also reaches the end:
```ts
if (elapsed < journeyDuration) {
  tailDist = max(0, headDist - trailLen);
} else {
  const tAfter = elapsed - journeyDuration;
  tailDist = min(total, (total - trailLen) + tAfter * speed);
}
```

**Pattern:** When two values are coupled by a fixed offset and your completion check needs both to reach the same target, the trailing one will never get there without an explicit catch-up phase.

---

## 4. Snake trail was 1 px off from the cross at the limb

**What happened:** A subtle parallax — most visible near the edge of the visible disc — between the cross and the snake-trail point at the same lat/lon.

**Root cause:** Cross was placed at `radius * 1.005` (a "lift" originally meant to avoid z-fighting). Snake samples were at `radius * 1.0`. Two points along the same direction but different radii project to different screen pixels under perspective. The lift was also doing no z-fighting work because both materials use `depthTest: false`.

**Fix:** Single shared constant `MARKER_RADIUS = GLOBE_RADIUS = 1.0`. Cross and snake both use it. Z-ordering is handled by `renderOrder`, not by radial offset.

**Pattern:** When two visuals must occupy the same world point, derive both positions from the same constant. Subtle drift between two "should be the same" calculations becomes visible at oblique angles.

---

## 5. `Mesh.lookAt(0,0,0)` does not point +Z outward (despite my code comment claiming so)

**What happened:** I added a "tangent surface plane" mode for the cross. Wrote a comment saying `lookAt(0,0,0)` makes local +Z point outward along the surface normal. Verified later — that's wrong.

**Root cause:** `Object3D.lookAt` has different conventions for `Camera`/`Light` vs everything else. For `Mesh`, local **+Z points toward the target**. So `lookAt(0,0,0)` makes +Z point inward (toward sphere centre).

**Why it still works:** The plane uses `side: THREE.DoubleSide`, so it's visible from both faces. The plane lies tangent to the sphere regardless of which face is "outward".

**Pattern:** "Doesn't matter because of `DoubleSide`" is a legitimate fix, but the comment should say so. Don't write the wrong reason just because the visible result is right.

---

## 6. WebGL line width is permanently 1 CSS pixel

**What happened:** Tried to draw a thicker snake trail. `linewidth` on `LineBasicMaterial` did nothing.

**Root cause:** WebGL's `LINE` primitive width is implementation-defined; the spec only requires 1.0. Every desktop browser clamps to 1.0, regardless of what we pass to `gl.lineWidth`.

**Fix:** `Line2` from `three/examples/jsm/lines/`. Doesn't draw real lines — draws each segment as a screen-space quad. `LineMaterial.linewidth` is in CSS pixels, but you must keep `material.resolution` in sync with the canvas size.

**Pattern:** If a library function "doesn't seem to do anything", check whether the underlying graphics API actually supports it. WebGL has a few of these silently-unsupported parameters.

---

## 7. Inline UI in DialKit panel is a DOM hack

DialKit doesn't expose a public custom-control API. The country editor lives inside the panel by way of a `MutationObserver` that waits for the folder to render, finds it by title text, and appends our DOM. It works today and breaks if DialKit renames a CSS class. The proper long-term fix is a PR upstream that adds a `type: 'custom'` config variant (DialKit is MIT, on GitHub).
