# Experiment Learnings — General

> Patterns that have come up more than once across experiments. Cheap-to-read reminders, not deep technical guides — for those, see the per-experiment retros.

---

## When to use a fragment shader vs a Three.js scene

- **Fragment shader on a fullscreen quad** — best for procedural visuals (noise, aurora, halftone) where every pixel is computed from math. Cheap, precise, parallel. But terrible for: text labels, mouse-picking specific objects, dragging things around.
- **Three.js scene** — best when you need real geometry, real text, picking, or a camera you can move. Pay the overhead in exchange for free matrix/projection plumbing and HTML overlays via `CSS2DRenderer`.
- **Don't pick wrong**: trying to draw crisp text in a fragment shader, or trying to do procedural noise in 3D meshes, both fight the medium.

---

## Layering / draw order

- For overlapping transparent objects, prefer **`depthTest: false` + explicit `renderOrder`** over radial offsets or z-axis tricks. Radial offsets re-introduce parallax (see globe-1 #4); explicit order is unambiguous.
- WebGL renders transparents in `painterSortStable` order: `groupOrder` → `renderOrder` → material id → distance. Higher `renderOrder` draws on top. The sort already runs every frame; setting `renderOrder` is essentially free.

---

## When two visuals must align, share the source

When two objects are supposed to occupy "the same point", derive both positions from the **same expression and the same constants**. Subtle drift between two parallel calculations is invisible head-on and shows up obviously at oblique angles. (Globe 1 hit this twice: snap lattice vs grid lattice, and cross radius vs snake radius.)

---

## Inline styles always beat CSS classes

If a library writes `element.style.foo = ...`, your CSS-class rule for `foo` on the same element is dead. Wrap the element so the library's target and your styling target are different — or use a property the library doesn't touch.

---

## WebGL silent gotchas

- **`gl.lineWidth(...)` is clamped to 1 on the web.** Use `Line2` if you need thicker.
- **`depthTest: false` also disables depth writes**, regardless of `depthWrite`. Don't rely on `depthWrite: true + depthTest: false` to write depth — it won't.
- **`THREE.Sprite` is billboarded**: always faces the camera. Its `scale.z` is unused. World-units sizing is the default but can be screen-stable if `sizeAttenuation: false`.
- **`Mesh.lookAt(target)` orients local +Z toward the target** (the opposite of `Camera.lookAt`). If you assumed the camera convention applies, your meshes are facing inside-out.

---

## Math.round() in JavaScript

`Math.round(0.5)` is `1`, `Math.round(-0.5)` is `0`. It rounds half-toward-positive-infinity. When snapping symmetric ranges around zero (lat/lon), this asymmetry can produce surprising results at exact midpoints. When precision matters, use `(l + offset) / step` math instead of relying on `round` on the raw value.

---

## Spring physics for UI

- **Semi-implicit Euler** (update v from x, then x from new v) is more stable than explicit Euler for harmonic oscillators. Sub-step it (e.g. 4×) so a frame-time spike (tab refocus, GC pause) doesn't blow up the spring.
- Stable region for sub-step `h`: roughly `h · √(k/m) < 2`. At default UI stiffness (~100) this is comfortable; at extreme stiffness (>10,000) 4 sub-steps is no longer safe.
- DialKit ships a `spring` transition control with `stiffness`, `damping`, `mass`, `bounce`, `visualDuration` — re-use it; don't write your own slider trio.

---

## Cubic-bezier easing

To use `cubic-bezier(c1x, c1y, c2x, c2y)` as `y(u)`: solve `x(t) = u` for `t` (Newton, ~6 iterations from initial guess `t = u`), then return `y(t)`. The browser's reference implementation uses 4 + bisection fallback; 6 is safer. Newton can stall if the user picks control points outside [0,1] (non-monotonic `x(t)`); DialKit's UI clamps to [0,1] so this is latent rather than active.

---

## `import.meta.env.DEV` is a build-time constant

Vite substitutes `import.meta.env.DEV` with the literal `true` (in dev) or `false` (in build) at compile time. The minifier folds branches like `if (import.meta.env.DEV) {...}` into dead code in production. Useful for: gating draft visibility, dev-only debug overlays, dev-only toolbars. The dead branch's source still ends up in the bundle if it's reached via `import` — true exclusion needs a Vite plugin.

---

## DialKit doesn't expose custom-control APIs (in v1.2)

If you need a control type DialKit doesn't ship (e.g. a list editor with drag-reorder), the practical options are:

1. **DOM injection** — wait for the panel to mount, append your own DOM. Works today, fragile to internal class-name changes. ✅ globe-1 uses this for the country editor.
2. **`patch-package`** — apply a small patch on `npm install`. Less brittle than DOM injection if you only need one tweak.
3. **Fork** — last resort. You own the maintenance burden.
4. **PR upstream** — DialKit is MIT, public repo at `github.com/joshpuckett/dialkit`. The clean long-term answer.

---

## Standalone export checklist

Every experiment ships two runtimes: the React-based dev experience (`experiment.ts`) and the IIFE-bundled standalone (`standalone.ts`) used for Webflow embeds. Anything you change in one, you must mirror in the other:

- Country/data defaults
- Math constants (e.g. `MARKER_RADIUS`)
- Bug fixes (snap lattice, snake-tail catch-up, parallax)
- Any DialKit-resolved config defaults (the standalone reads `BAKED_PARAMS`, not DialKit)

The four-file contract in the [create-experiment skill](../skills/SKILL.md) is real: a uniform name in `shader.glsl` that's not also in `experiment.ts`, `params.ts`, **and** `standalone.ts` is a silent bug.

---

## Drafts, dev preview, and Vercel

- `meta.draft: true` hides an experiment from the production gallery and from article routes (registry filter + `isArticleVisible`). Drafts still render in dev (`npm run dev`) and at direct URLs.
- The `DraftBadge` pill in the gallery (dev-only) flips this flag by *editing the `meta.ts` file on disk* via a Vite middleware. Pushed to git → Vercel respects on next build.
- Drafts still ship as JS bytes in the production bundle. For text-only experiments this is fine; for heavy assets a build-time exclusion plugin would be needed (not yet built).
