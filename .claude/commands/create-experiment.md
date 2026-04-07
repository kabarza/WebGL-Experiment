# Create New WebGL Experiment

Create a complete WebGL experiment from a description of the desired visual effect. The experiment includes a shader, DialKit controls, a Webflow-ready standalone export, and optionally a technical article.

## Input

$ARGUMENTS — A description of the desired visual effect

## Steps

### 1. Scaffold

Generate a short name from the description (2–3 words) and run:

```bash
npx tsx scripts/new-experiment.ts --name "<name>"
```

This creates `src/experiments/<slug>/` with six files. **Read all of them before editing.**

### 2. Plan the effect

Before writing code, decide:
- What distinct visual layers compose the effect — each gets a boolean toggle uniform
- What should be adjustable at runtime — these become DialKit controls
- Plan 2–3 preset configurations that showcase different moods of the effect

### 3. Write the shader (`shader.glsl`)

The template provides `varying vec2 vUv` (0–1), `u_time`, and `u_resolution`. Add `uniform` declarations for every tunable parameter you planned.

**Conventions:**
- Prefix all uniforms with `u_`
- Boolean toggles are `uniform float` (0.0 / 1.0), not `bool`
- Colors are `uniform vec3` (RGB 0–1, converted from hex in JS)

**Shared utilities** — `src/shaders/glsl/` has reusable functions (`hash.glsl`, `noise.glsl`, `fbm.glsl`). GLSL has no imports — copy what you need into your shader.

### 4. Wire controls (`params.ts`)

Add defaults and DialKit controls for every tunable parameter. Group controls into logical folders.

**Control type cheat sheet:**

| Config | Control | Returns |
|--------|---------|---------|
| `[default, min, max]` or `[default, min, max, step]` | Slider | `number` |
| `true` / `false` | Toggle | `boolean` |
| `'#hexcolor'` | Color picker | `string` |
| `{ type: 'ub-N', default: val, step: s }` | Unbounded N-way dial | `number` |
| Nested object with `_collapsed: true` | Collapsible folder | — |

Include 2–3 presets in the `presets` field.

### 5. Bridge uniforms (`experiment.ts`)

For every uniform in the shader:
1. Get its location: `gl.getUniformLocation(prog, 'u_name')`
2. Set it each frame in `render()`: `gl.uniform1f(loc, params.name)`

The template only wires `u_time` and `u_resolution` — you must add every experiment-specific uniform.

Colors come from DialKit as hex strings — convert to RGB floats before passing to `gl.uniform3f`.

### 6. Wire the export (`standalone.ts`)

The standalone entry is a self-contained IIFE for embedding in Webflow. It mirrors experiment.ts but reads from `BAKED_PARAMS` instead of DialKit.

**You must:**
1. Add all uniform locations after the existing `uTime` and `uRes`
2. Set all uniforms in the render function from `BAKED_PARAMS`
3. Fill in complete fallback defaults in the `BAKED_PARAMS` ternary — the template only has `bgColor`, add every parameter

### 7. Set metadata (`meta.ts`)

The scaffold fills in slug, title, and date. Write an accurate `description` and `tags` array. Set `hasArticle: true` only if creating an article (step 8).

### 8. Create the article (when requested)

If an article is requested, create `src/components/<PascalName>Article.tsx` and register it in routing.

**Follow the pattern** in `FlowFieldArticle.tsx` or `CelestialFlareArticle.tsx`:
- `CodeBlock` helper for annotated shader snippets
- SVG diagram components for visual explanations
- `useChrome()` hook with `setActiveArticle('<slug>')`
- Motion wrapper with `className="article-page"`
- CSS classes: `article-hero`, `article-hero-eyebrow`, `article-hero-lead`, `article-body`, `article-section`, `article-section-title`, `article-lead`, `article-diagram-wrapper`, `article-code-figure`

**Register the route** in `src/App.tsx`:
1. Import the component at the top of the file
2. Add a condition in the article routing chain (before the `ArticlePage` fallback, around line 100):
   ```tsx
   ) : route.slug === '<slug>' ? (
     <<Name>Article key="article-<slug>" />
   ```
3. Set `hasArticle: true` in `meta.ts`

### 9. Verify

```bash
npm run typecheck && npm run dev
```

Open `/experiment/<slug>` and verify the effect renders, controls work, and presets switch correctly. If an article was created, check `/experiment/<slug>/article`.

---

## The four-file contract

Every parameter flows through four files that **must stay in sync**:

| File | Role | Example |
|------|------|---------|
| `shader.glsl` | GPU declaration | `uniform float u_foo;` |
| `params.ts` | UI config + default | `foo: [0.5, 0, 1, 0.01]` |
| `experiment.ts` | JS→GPU bridge | `gl.uniform1f(U.uFoo, P.foo)` |
| `standalone.ts` | Export bridge | `gl.uniform1f(uFoo, BP.foo)` |

A mismatch in any file is a **silent failure** — uniforms default to 0 with no error. **Always cross-check all four files after adding or renaming a uniform.**

## Layer toggle convention

Every distinct visual layer gets a boolean toggle — costs nothing when on, makes debugging trivial:

| File | What to add |
|------|-------------|
| `params.ts` | `layerOn: true` in defaults + at top of the layer's dialConfig group |
| `shader.glsl` | `uniform float u_layerOn;` with `if (u_layerOn > 0.5) { ... }` wrapping the layer |
| `experiment.ts` | `gl.uniform1f(U.uLayerOn, P.layerOn ? 1.0 : 0.0);` |
| `standalone.ts` | `gl.uniform1f(uLayerOn, BP.layerOn ? 1.0 : 0.0);` |

## Mouse / pointer input (optional)

The experiment context provides an `input` object with `mouse`, `velocity`, `isOver`, and `isDown`. Destructure it from `ctx` if needed. See `flow-field/FlowFieldExperiment.ts` for a full example.

Standalone exports have no InputManager — add pointer listeners manually if needed.

## Reference experiments

- **`celestial-flare/`** — WebGL-only, multi-layer compositing with layer toggles
- **`flow-field/`** — Dual WebGPU+WebGL, mouse interaction, domain warp, presets
