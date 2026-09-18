# Brand Tool — reaction-diffusion pattern generator

Route: `/brand` (or `/brand/coral-1`). The same engine is also a regular gallery experiment (`/experiment/coral-1`); the dock links the two views (**Brand Tool** ↔ **Experiment**).

## Engine — Coral-1 · Reaction Field

Gray-Scott reaction-diffusion on a ping-pong RGBA16F texture (9-point Laplacian). Signature controls:

- **Reaction** — feed, kill, dU, dV, dt, steps per frame
- **Variation** — spatial feed/kill maps (radial / rotate / swirl / bubble / ring / sweep / noise) so one canvas grows spots → worms → mazes
- **Direction** — anisotropic diffusion along an angle
- **Image** — an uploaded image can seed, densify (dark = dense), or mask the growth, and be composited back through / tinted by / behind the pattern
- **Render** — Flat / Outline (constant-width) / Emboss / Gradient / Dots, grain, vignette
- **Colour** — theme select (applies bg/fg/accent; flips to *Custom* when you edit a colour) + the colours themselves
- **Engine** — *Quality* (sim texels per canvas pixel: 0.5×–2×, so the display never upsamples a small buffer), *Pattern Scale* (stencil spacing — feature size without changing resolution), *Auto Regrow*, Reseed / Random Spots / Clear

Gray-Scott cannot regrow from an empty field; if feed/kill changes kill the pattern, the engine detects it (coarse readback once a second) and reseeds when *Auto Regrow* is on, with a toast either way.

## Brand tool UI (`src/brand/`)

Figma-style board (conventions from Figma / tldraw / Excalidraw): flat `#1e1e1e` stage, bottom-centre tool bar, one right-hand design panel.

- **Frames** (`frames.ts`, `FrameView.tsx`): up to 8 canvases, each with its own WebGL context, engine and `params`. The simulation resolution follows the frame's *logical* size (× quality ÷ pattern scale), never the zoomed drawing buffer — zooming only changes display resolution. Board persists under `brand:board:<slug>` (images are per frame, not persisted).
- **Interaction** (one Move tool, no hand/brush modes): click a frame or its label to select; drag an unselected frame or any label to move; **drag inside the selected frame to paint** (⌥ = erase); drag empty stage, space-drag or middle-drag to pan; wheel pans, ⌘/ctrl-wheel or pinch zooms. Frame tool `F`: click for a default frame, drag for a custom size, dropdown for presets. `0` fit all · `1` 100 % · `2` zoom to selection · ⌘D duplicate · ⌫ delete · `P` pause · `R` regrow · `C` clear.
- **Tool bar** (`Toolbar.tsx`): Move `V` · Frame `F` ▾ │ Play/Pause · Grow ▾ (Regrow, Scatter, Clear, Reset all) │ Export ▾ (format, scale, detail, download). The tool bar is the *only* place for actions in the brand tool — the Engine folder's Reseed / Random Spots / Clear / Reset All / Paused rows are hidden there (the gallery experiment still shows them).
- **Resize**: drag a selected frame's corner handles (⇧ keeps the aspect). Board-side edits (drag, resize) are pushed into the Frame folder; panel edits flow to the board only when they originate in the panel (diffed against the last panel snapshot), so the two never fight.
- **Changed-value dots**: a blue dot marks any control whose value differs from the engine default (generated CSS, same mechanism as hiding).
- **Design panel** (`Sidebar.tsx` shell + DialKit inline): a single DialKit panel carries everything, bound to the selected frame. The **Frame** folder (name, aspect preset, width, height, Duplicate / Delete / Add) is synced both ways with the board; changing the aspect keeps the width and keeps the pattern's scale (sim is cropped/padded, not stretched). The **Image** folder has Upload / Remove actions and only shows its controls when the frame has an image. Mode-dependent controls (map*, flow angle, line width, emboss, dots) hide when irrelevant.
- **Contextual visibility** (`panelVisibility.ts`): DialKit 1.4 re-registers when its config changes, but prunes values *and saved versions* for controls that are absent. So the config stays static and rows/folders are hidden via generated `nth-child` CSS (injected in a layout effect, so it is in force before DialKit measures a folder's open animation). With no selection only the Frame folder's "Add Frame" remains. Uploading an image defaults the mode to *Mask*.
- Built-in presets are seeded once as DialKit versions (persisted under `dialkit:brand:<slug>`); versions load into the selected frame. Versions describe the *look* only: when one is loaded the frame's own name/size are restored into the Frame folder (DialKit snapshots every control, including the Frame folder, so this is handled explicitly). Seed flag `…:seeded:v2` re-seeded once to drop geometry baked into older versions.
- **Pattern Scale** (Engine, 0.5–16×) sets simulation resolution relative to the frame; the display reconstructs the field with a bicubic B-spline so large patterns stay smooth. Quality: Draft ¼ · Standard ½ · Fine 1 · Ultra 2 texels per frame px.

## Why two DialKits

The gallery runs the repo's **patched DialKit 1.2.0** (custom `ub-*` controls, `seedPresets`) — a whole-bundle patch that can't be bumped in place. The brand tool uses **`dialkit-next`** (npm alias of `dialkit@1.4.3`) with `useDialKitController` + `persist`. `BrandToolView` is lazy-loaded so the 1.4 CSS only ships on `/brand`.

## Adding an engine

1. Extend `PatternEngineBase` (`src/brand/`), implement `createPrograms / step / seed / stepsPerFrame`, set `fieldChannel`, `fieldRange`, `needsMipmaps`.
2. Export a `BrandTool` from the experiment folder and add it to `src/brand/registry.ts`.
3. Spread `sharedRenderDefaults` / `sharedRenderConfig` into the controls so Render / Colour / Image / Brush / Engine stay consistent.
