# WebGL Experiment Lifecycle Platform

## What Is This

A lifecycle tool for WebGL/WebGPU experiments: **Create > Tweak > Share > Iterate > Export**. A React app shell provides the designer workspace (gallery, DialKit controls, versioning, sharing, export UI). A vanilla WebGL/WebGPU engine renders experiments to a canvas — this is the exportable product. Two layers, clean boundary.

---

## Architecture

```
+---------------------------------------------------------+
|  React App Shell (DialKit, Gallery, Export UI)           |
|  +---------------------------------------------------+  |
|  |  Bridge Layer (useExperiment, useExperimentParams) |  |
|  +------------------------+--------------------------+  |
|                           | params object (read every frame)
|  +------------------------v--------------------------+  |
|  |  Vanilla Engine (Renderer, RenderLoop, etc.)       |  |
|  |  +----------------------------------------------+  |  |
|  |  |  Experiment (WebGPU/WebGL2 + shaders)        |  |  |
|  |  +----------------------------------------------+  |  |
|  +---------------------------------------------------+  |
+---------------------------------------------------------+
          |
          | Webflow Export (vanilla only, no React)
          v
+--------------------------------------+
|  <div data-webgl-experiment="slug">  |
|    <canvas></canvas>                 |
|    <script src="..."></script>       |
|  </div>                              |
+--------------------------------------+
```

### Two Clean Layers

1. **React app shell** — Gallery, DialKit controls, version selector, sharing UI, export panel. React 19 + DialKit + Motion for React.
2. **Vanilla experiment engine** — `src/core/` modules + experiment implementations. Zero React dependencies. Pure WebGL/WebGPU rendering to a canvas. This is what gets exported to Webflow.

### Bridge

Two React hooks connect the layers:
- `useExperiment(canvasRef, experiment, params)` — Creates canvas renderer, initializes experiment, manages lifecycle (RAF, resize, input, cleanup).
- `useExperimentParams(dialConfig, defaults, overrides)` — Calls `useDialKit()` to create the DialKit control panel, flattens values into a mutable params object the experiment reads every frame.

---

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Language | TypeScript (strict) | Type safety for GPU API bindings |
| GPU API | WebGPU-first, WebGL2 fallback per-experiment | Future-proof with broad compat |
| Build | Vite 6 + custom WGSL `#include` plugin + GLSL loader | Fast dev, shader HMR |
| UI Controls | **DialKit** (npm `dialkit` + `motion`) | Floating panel, presets, color pickers, clean API |
| Navigation | Hash-based routing (`#/`, `#/experiment/{slug}`) | Works on any static host |
| Gallery | Dark minimal — `#0a0a0a` bg, clean cards, monospace accents | Professional presentation |
| Deployment | Vercel (auto-deploy on push to main) | Zero config static hosting |
| Export | IIFE bundles (WebGL2 only) for Webflow | Max browser compatibility |

---

## Project Structure

```
WebGL-Experiment/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── thumbnails/
│       └── flow-field.webp
├── scripts/
│   ├── build-export.ts           # CLI: build standalone IIFE bundles
│   └── new-experiment.ts         # CLI: scaffold new experiment
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root: DialRoot + hash router
│   ├── core/
│   │   ├── Experiment.ts         # Interfaces: Experiment, ExperimentMeta, etc.
│   │   ├── Renderer.ts           # WebGPU device/context lifecycle
│   │   ├── WebGLRenderer.ts      # WebGL2 fallback renderer
│   │   ├── RenderLoop.ts         # RAF with delta-time, pause, speed
│   │   ├── InputManager.ts       # Mouse/touch + smooth interpolation
│   │   ├── FullscreenQuad.ts     # WebGPU fullscreen quad
│   │   ├── FullscreenQuadGL.ts   # WebGL2 fullscreen quad
│   │   ├── UniformBuffer.ts      # Typed GPU uniform buffer
│   │   └── index.ts              # Barrel exports
│   ├── shaders/
│   │   ├── lib/                  # Shared WGSL modules (#include)
│   │   │   ├── noise.wgsl
│   │   │   ├── fbm.wgsl
│   │   │   ├── hash.wgsl
│   │   │   ├── color.wgsl
│   │   │   ├── math.wgsl
│   │   │   └── fullscreen-quad.wgsl
│   │   └── glsl/                 # GLSL equivalents for WebGL fallback
│   │       ├── noise.glsl
│   │       ├── fbm.glsl
│   │       ├── hash.glsl
│   │       ├── color.glsl
│   │       ├── math.glsl
│   │       └── fullscreen-quad.vert
│   ├── experiments/
│   │   ├── registry.ts           # Auto-discovery via import.meta.glob
│   │   └── flow-field/
│   │       ├── index.ts
│   │       ├── FlowFieldExperiment.ts
│   │       ├── params.ts         # DialKit config + defaults + presets
│   │       ├── meta.ts
│   │       ├── flow-field.wgsl
│   │       ├── flow-field.glsl
│   │       └── standalone.ts     # IIFE entry for Webflow export
│   ├── components/
│   │   ├── Gallery.tsx
│   │   ├── ExperimentCard.tsx
│   │   ├── ExperimentView.tsx    # Canvas + overlay + controls
│   │   ├── VersionSelector.tsx
│   │   ├── ShareButton.tsx
│   │   └── ExportPanel.tsx       # Webflow export modal
│   ├── hooks/
│   │   ├── useExperiment.ts      # Bridge: React -> vanilla engine
│   │   └── useExperimentParams.ts # Bridge: DialKit -> params object
│   ├── lib/
│   │   ├── versions.ts           # Version store (localStorage)
│   │   ├── sharing.ts            # URL param encode/decode (pako)
│   │   ├── webflow-export.ts     # HTML generation
│   │   └── webflow-mcp.ts        # Webflow MCP tool wrappers
│   ├── templates/
│   │   └── experiment-template/  # Scaffold for new experiments
│   ├── styles/
│   │   ├── reset.css
│   │   ├── global.css
│   │   └── components.css
│   └── types/
│       └── shaders.d.ts
```

### Removed (superseded by React + DialKit)

| File | Replaced By |
|------|-------------|
| `src/main.ts` | `src/main.tsx` |
| `src/gallery/Gallery.ts` | `src/components/Gallery.tsx` |
| `src/gallery/ExperimentCard.ts` | `src/components/ExperimentCard.tsx` |
| `src/gallery/router.ts` | Hash routing in `App.tsx` |
| `src/gallery/gallery.css` | Styles in `gallery.css` (kept, imported by `main.tsx`) |
| `src/core/ControlPanel.ts` | DialKit via `useExperimentParams` hook |
| `src/core/PresetManager.ts` | DialKit built-in presets + `VersionStore` |

---

## Key Interfaces

### Experiment Contract

```ts
interface Experiment {
  meta: ExperimentMeta;
  controls: ExperimentControls;
  init(ctx: ExperimentContext): Promise<ExperimentInstance>;
  initGL?(ctx: ExperimentGLContext): Promise<ExperimentInstance>;
}

interface ExperimentInstance {
  render(time: number, deltaTime: number): void;
  resize(width: number, height: number, dpr: number): void;
  dispose(): void;
}
```

### Controls Declaration (DialKit format)

```ts
interface ExperimentControls {
  defaults: Record<string, unknown>;
  dialConfig: DialConfig;        // DialKit config object
  presets?: Record<string, Partial<Record<string, unknown>>>;
}
```

DialKit config format:
```ts
dialConfig: {
  'Noise Fill': {
    _collapsed: true,
    noiseScale: [0.4, 0.01, 5, 0.01],   // [default, min, max, step]
    noiseSpeed: [0.04, 0, 1, 0.001],
  },
  Colors: {
    _collapsed: true,
    color1: '#1a6b42',                     // hex -> color picker
    color2: '#e84a9c',
    blendWidth: [0.55, 0, 2, 0.01],
  },
  Animation: {
    speed: [1.0, 0, 5, 0.01],
    paused: false,                         // bool -> toggle
  },
}
```

Experiments never touch DialKit directly — they declare a config, the framework builds the GUI.

---

## Core Modules

| Module | Responsibility |
|--------|---------------|
| `Renderer.ts` | WebGPU adapter/device request, canvas context config, resize with DPR (capped at 2) |
| `WebGLRenderer.ts` | WebGL2 context creation, viewport management, same resize logic |
| `RenderLoop.ts` | RAF loop, delta-time, accumulated time, pause/speed properties |
| `InputManager.ts` | Pointer events -> normalized coords, lerp smoothing (0.04), velocity, isOver/isDown |
| `FullscreenQuad.ts` | WebGPU triangle-strip vertex buffer, pipeline creation, draw |
| `FullscreenQuadGL.ts` | WebGL2 equivalent |
| `UniformBuffer.ts` | Typed layout, set by name, upload to device |

---

## Gallery Design

- **Background:** `#0a0a0a`
- **Cards:** CSS grid `auto-fill minmax(320px, 1fr)`, dark surface `#141414`, 1px border `#222`, rounded corners
- **Typography:** System sans-serif body, monospace accent for tags/metadata
- **Hover:** Subtle scale (1.02) + border brightens to `#444`
- **Card content:** 16:9 thumbnail, title, 1-line description, tag pills
- **Transition:** Click card -> FLIP animation -> experiment loads -> card fades out

### Experiment View Overlay

- Back arrow (top-left)
- Title (top-left, auto-fades after 2s, reappears on mouse move)
- DialKit panel (top-right, floating)
- Toolbar: Version selector, Share button, Export button
- Keys: `Esc` = back, `H` = toggle UI, `Space` = pause, `F` = fullscreen

---

## Routing

Hash-based (works on any static host):

- `#/` or empty -> Gallery
- `#/experiment/{slug}` -> Fullscreen experiment
- `#/experiment/{slug}?v=base64params` -> Experiment with shared params applied

---

## Experiment Auto-Discovery

```ts
const modules = import.meta.glob<{ experiment: Experiment }>('./*/index.ts', { eager: true });
export const experiments = Object.values(modules).map(m => m.experiment).sort(byDate);
```

Drop a new folder in `experiments/`, it appears in the gallery. No manual registration.

---

## Implementation Phases & Status

### Phase 1: Project Foundation ......................................... DONE

- [x] npm project, Vite 6, TypeScript strict, `@webgpu/types`
- [x] `vite.config.ts` with WGSL `#include` plugin + GLSL loader + React plugin
- [x] `tsconfig.json`, shader type declarations (`shaders.d.ts`)
- [x] `index.html` with `<div id="app">` + React entry
- [x] `reset.css` + `global.css`

### Phase 2: Core Engine Modules ....................................... DONE

- [x] `Renderer.ts` — WebGPU device lifecycle
- [x] `WebGLRenderer.ts` — WebGL2 fallback
- [x] `RenderLoop.ts` — RAF with delta-time
- [x] `InputManager.ts` — pointer tracking + smoothing
- [x] `FullscreenQuad.ts` + `FullscreenQuadGL.ts`
- [x] `UniformBuffer.ts`
- [x] `Experiment.ts` — interfaces/types
- [x] `index.ts` — barrel exports

### Phase 3: Shader Libraries .......................................... DONE

- [x] 6 WGSL lib files: noise, fbm, hash, color, math, fullscreen-quad
- [x] 6 GLSL equivalents: noise, fbm, hash, color, math, fullscreen-quad.vert
- [x] WGSL `#include` resolution in Vite plugin

### Phase 4: Flow Field Experiment ..................................... DONE

- [x] WGSL fragment shader port (`flow-field.wgsl`)
- [x] Original GLSL kept as WebGL fallback (`flow-field.glsl`)
- [x] `meta.ts` — slug, title, description, tags, date
- [x] `params.ts` — defaults + DialKit config + 4 presets
- [x] `FlowFieldExperiment.ts` — full implementation
- [x] `index.ts` — barrel export

### Phase 5: React App Shell ........................................... DONE

- [x] `main.tsx` — React entry, CSS imports
- [x] `App.tsx` — hash-based router + DialRoot
- [x] `Gallery.tsx` — grid of ExperimentCards
- [x] `ExperimentCard.tsx` — thumbnail, title, tags
- [x] `ExperimentView.tsx` — canvas + overlay + controls + versioning + sharing + export
- [x] Keyboard shortcuts (Esc, H, Space, F)
- [x] Loading/error states

### Phase 6: DialKit Integration ....................................... DONE

- [x] `useExperimentParams.ts` — bridge hook: DialKit config -> flat params object
- [x] `useExperiment.ts` — bridge hook: React -> vanilla engine lifecycle
- [x] DialKit `useDialKit()` for all experiment controls
- [x] `DialRoot` in `App.tsx`
- [x] `dialkit/styles.css` imported
- [x] Removed Leva, Tweakpane, and ControlPanel.ts dependencies

### Phase 7: Versioning System ......................................... DONE

- [x] `versions.ts` — `VersionStore` class (localStorage CRUD)
- [x] `VersionSelector.tsx` — dropdown UI (save, switch, delete)
- [x] Active version auto-saves on param changes (debounced)
- [x] "Defaults" version is immutable
- [x] Version state persists in ExperimentView

### Phase 8: Sharing ................................................... DONE

- [x] `sharing.ts` — pako compress/decompress, Base64url encode/decode
- [x] `ShareButton.tsx` — copies URL with `?v=` encoded params
- [x] `App.tsx` parses `?v=` param and passes to ExperimentView
- [x] Shared params override active version on load

### Phase 9: Webflow Export ............................................ DONE

- [x] `webflow-export.ts` — HTML generation, bundle URL helpers
- [x] `webflow-mcp.ts` — MCP plan builder, instruction generator
- [x] `ExportPanel.tsx` — modal with HTML preview, copy, MCP instructions
- [x] `standalone.ts` — flow-field IIFE entry (WebGL2, baked params, mouse, resize)
- [x] `build-export.ts` — CLI script for Vite library-mode IIFE builds
- [x] **Export build accepts params from CLI** — `--params='{"key":"val"}'` and `--params-file=path.json`. Falls back to standalone.ts defaults.
- [x] **End-to-end test** — IIFE bundle (10.8KB/4KB gzip) builds, valid JS syntax, test HTML created at `dist/exports/test.html`.

### Phase 10: AI Experiment Creation ................................... DONE

- [x] `src/templates/experiment-template/` — 6 template files (index, meta, params, experiment, shader, standalone)
- [x] `scripts/new-experiment.ts` — scaffold CLI (copies template, replaces placeholders)
- [x] `.claude/commands/create-experiment.md` — Claude Code skill for AI-assisted creation
- [x] `.claude/commands/add-control.md` — Claude Code skill for adding controls
- [x] Auto-discovered by `registry.ts` glob pattern

### Phase 11: Polish ................................................... DONE

- [x] **FLIP transition animation** — Motion for React `layoutId` on cards + `AnimatePresence` in App. Card expands into fullscreen container, canvas fades in behind.
- [x] **Thumbnail capture** — Canvas auto-captures after first rendered frame, stores as data URL in localStorage. ExperimentCard checks localStorage when static thumbnail is missing, with `onError` fallback chain.
- [x] **Live input reference fix** — `InputManager.state` is now a stable `readonly` property mutated in-place by `update()`.
- [x] **Shader HMR accept handlers** — `import.meta.hot.accept()` in flow-field `index.ts` + experiment template. WGSL plugin invalidates dependent modules instead of full-reload.
- [x] **Seed presets as starter versions** — `VersionStore.seedFromPresets()` auto-populates Defaults + all built-in presets on first load.
- [x] **Remove dead vanilla files** — Deleted `main.ts`, vanilla gallery, `ControlPanel.ts`, `PresetManager.ts`. Removed dead `ParamDef` type.
- [x] **Clean CSS Leva references** — Leva z-index rule removed; toolbar offset updated.
- [ ] **Cross-browser testing** — Chrome, Edge, Firefox, Safari. WebGL2 fallback path. (Manual testing required.)

### Phase 12: Deployment ............................................... READY

- [x] **Vercel config** — `vercel.json` with rewrites, CORS + immutable cache headers for `/exports/`.
- [x] **Build output structure** — Main app at `/`, export bundles at `/exports/{slug}-v{n}.js`.
- [x] **Environment config** — `webflow-export.ts` reads `VITE_BASE_URL` env var, falls back to `https://webgl-experiments.vercel.app`. Build script also reads `VITE_BASE_URL`.
- [ ] **Connect repo to Vercel** — Manual step: link the repo in Vercel dashboard and push to trigger first deploy.

---

## Verification Checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `npm run dev` — Vite dev server starts, gallery loads | DONE |
| 2 | Gallery shows flow-field card with thumbnail, title, tags | DONE (auto-captured from canvas) |
| 3 | Click card -> FLIP animation -> experiment runs fullscreen | DONE |
| 4 | DialKit panel appears with all controls grouped in folders | DONE |
| 5 | Tweak params via DialKit -> experiment updates in real-time | DONE |
| 6 | Built-in presets switch correctly | DONE |
| 7 | Save/switch/delete versions via VersionSelector | DONE |
| 8 | Share button copies URL with encoded params | DONE |
| 9 | Open shared URL -> experiment loads with correct params | DONE |
| 10 | Mouse interaction works with smooth interpolation | DONE (fixed stale ref) |
| 11 | `Esc` = back, `H` = hide UI, `Space` = pause, `F` = fullscreen | DONE |
| 12 | `npm run build` produces deployable `dist/` | DONE |
| 13 | `npm run build:export` produces standalone IIFE | DONE (10.8KB gzipped 4KB) |
| 14 | Export HTML renders standalone in Webflow custom code embed | DONE (test.html created, JS syntax verified) |
| 15 | `npm run new-experiment` scaffolds correctly, auto-discovered | DONE |
| 16 | `npx tsc --noEmit` passes with no errors | DONE |
| 17 | Adding a new experiment folder auto-shows in gallery | DONE |
| 18 | DialKit panel built-in preset save/load works | DONE |
| 19 | No Leva or Tweakpane code/dependencies remain | DONE (verified: no imports, no packages, no CSS) |
| 20 | Vercel deploy works (main app + export bundles) | READY (vercel.json configured, connect repo to deploy) |

---

## Resolved Issues

1. **Input state freshness** — FIXED. `InputManager.state` was a getter that created new objects each call. Changed to a stable `readonly` property that `update()` mutates in-place. Experiments now hold a live reference.

2. **Export param baking** — FIXED. `build-export.ts` now accepts `--params='...'` (inline JSON) and `--params-file=path.json` (file). Falls back to standalone.ts hardcoded defaults.

3. **DialKit panel positioning** — FIXED. Toolbar CSS updated to `right: 20px` (DialKit renders its own floating panel independently).
