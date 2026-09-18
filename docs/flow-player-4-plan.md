# Flow Player 4 — Plan

A branded multi-source video player for Webflow. Supports **Vimeo,
YouTube, HLS streaming, and self-hosted MP4** behind a single URL-
detection-based API. Designer picks **JS-rendered or Webflow-elements
UI mode** in DialKit. Distributed as a small JSON paste + a CDN-hosted
runtime — no project-corrupting tree gymnastics.

v4 is the consolidation of every lesson from v1, v2, v3 + the working
patterns from flowplayplus (vds-iphone-player-2.webflow.io) and Osmo's
HLS player.

---

## Lessons captured from the previous three players

### What v1 (flow-player) got right
- Provider abstraction over Vimeo + YouTube via raw postMessage (no SDKs, no
  CDN dependency for SDKs, no async script-load races).
- StateBridge pattern: data-attributes on the wrapper, CSS reacts. Designers
  can target every state from Webflow Custom Code.
- Auto-tier detection via Vimeo's oEmbed `account_type` field.
- ~10–12 KB gzipped bundle.

### What v2 (flow-player-2) added
- HTML5 `<video>` provider for self-hosted MP4.
- Settled the "UI as Webflow elements" pattern: every button is a real
  Webflow tree node with `f-data-video="<role>"` attributes; the runtime
  binds click handlers and writes data-state.

### What v3 (flow-player-3) tried and failed
- Combined both UI modes (JS / Webflow tree) behind a DialKit toggle.
- Aggressive @webflow/XscpData JSON paste: ~80 tree nodes, tag overrides
  on Block elements (`tag: 'button'`, `tag: 'input'`), a 47 KB
  `<script type="module">` inline in an HtmlEmbed.
- **Result: corrupted Webflow projects on paste.** Project couldn't be
  reopened. Webflow's data layer choked on the combination of tag
  overrides + node count + payload size.

### External references
- **flowplayplus** (videsigns/webflow-tools): designer manually builds
  elements in Webflow with `f-data-video="<role>"` attributes, then
  pastes ONE `<script src="https://cdn.jsdelivr.net/...">` from
  Footer Code. Zero JSON paste. The library is hosted on jsDelivr.
- **Osmo Advanced Player**: similar to v4's target. Ships a Webflow
  Cloneable / clipboard paste of a SMALL tree (~10–15 nodes, plain
  divs only, no tag overrides) + custom JS pasted into an HtmlEmbed
  (~10 KB inline, well under the 50K limit) + custom CSS in another
  HtmlEmbed. HLS via hls.js loaded from CDN. Bunny.net hosts the
  `.m3u8` segments.

### What v4 ports forward
- Provider interface from v3
- Custom controls UI (play/pause, scrubber, volume, fullscreen, tooltips,
  keyboard shortcuts, settings menu with speed picker)
- Auto-tier detection from v3 (Agent 1's finding)
- StateBridge from v3
- "UI as Webflow elements" pattern from v2 (but with a much smaller,
  safer tree)

### What v4 fixes
- **No tag overrides anywhere** — every Webflow node uses its canonical
  `type`. No more `Block` masquerading as `<button>` or `<input>`.
- **Small tree, both modes** — Option 1 = 5 nodes, Option 2 = ~20 nodes
  (was 80 in v3).
- **Bundle hosted on CDN (jsDelivr)** — HtmlEmbed in the JSON paste
  contains a single `<script src="https://cdn.jsdelivr.net/.../flow-player-4.js" defer>`,
  ~200 chars. No more 50K-per-embed wrestling.
- **Scrubber: custom drag math on a div, not `<input type=range>`** —
  removes the tag-override hack while keeping the click-vs-drag UX.
- **Lazy load hls.js** — only fetch the ~30 KB streaming library when
  an `.m3u8` source is detected.

---

## Scope (locked from Q&A)

### Providers (all four)
- **Vimeo** — iframe + postMessage, auto-tier detect (Pro / Plus /
  Business / Premium → custom UI, free → native UI fallback).
- **YouTube** — iframe + postMessage. Always custom UI.
- **HLS** (`.m3u8`) — `<video>` element + lazy-loaded `hls.js` via
  jsDelivr (Safari uses native HLS support, no library needed).
- **MP4 / WebM** (plain `<video>` URL) — `<video>` element directly,
  no library.

URL auto-detection chooses the provider:
```
youtube.com / youtu.be    → YouTube
vimeo.com                 → Vimeo
*.m3u8                    → HLS
*.mp4 / *.webm / direct   → MP4
```

### UI modes (toggle via DialKit)
- **`js` (default)** — control bar built at runtime. ~5–8 node Webflow
  tree.
- **`webflow`** — control bar elements ship as Webflow tree nodes.
  ~20 nodes max (vs v3's 80). Plain `<div>` types only. Designer can
  click any control in the Navigator and restyle in the Style panel.

### Features kept from v3
- Vimeo auto-tier detection (Agent 1's oEmbed finding)
- Settings menu with playback-speed picker
- Keyboard shortcuts (Space / M / F / arrows / 0–9)
- Tooltips on every button (CSS pseudo-elements)
- Play / pause toggle
- Scrubber with track + buffer fill + draggable thumb
- Time display
- Mute toggle + volume slider (3-state icon)
- Fullscreen toggle + iOS pseudo-fullscreen fallback
- Auto-thumbnail (Vimeo oEmbed / YouTube i.ytimg / poster image for HLS+MP4)
- Two color tokens (`--vp-accent`, `--vp-thumb-color`) plus ~10 more
  theming CSS variables on `.vp-slot`

### Features dropped from v3 (saves ~3 KB gzipped)
- GDPR consent gate — not requested for v4, can add later
- Captions toggle + caption-language picker — most marketing/hero videos
  don't have captions; can add in v4.1 if needed
- PiP button — Vimeo-only via API; users can still trigger via right-
  click on `<video>` for HLS/MP4
- Restart button — scrubber to 0 does the same
- Loading spinner — providers show their own buffering UI
- Idle-hide controls — bar stays visible; less code, predictable UX
- Skip ±10s buttons — keyboard arrows still seek if shortcuts are on

### Bundle target
- ~10–14 KB gzipped (Vimeo + YouTube + MP4 always loaded)
- +30 KB gzipped only when an HLS source is detected (hls.js lazy-loaded)

---

## Architecture

```
flow-player-4/
├── meta.ts                  Slug + title + description (gallery card)
├── params.ts                Dial controls, defaults, presets
├── helpers.ts               URL parsing, source detection, oEmbed (incl. tier)
├── icons.ts                 Inline SVGs (used by both UI modes)
├── styles.ts                CSS: WEBFLOW_CLASSES vs INTERNAL_RULES
├── standalone.ts            Bundle entry — runs at page load
├── experiment.ts            React preview — mirrors the export
├── generateExport.ts        Webflow JSON paste output (small, safe)
├── providers/
│   ├── types.ts             Provider interface
│   ├── VimeoProvider.ts     Raw postMessage to player.vimeo.com
│   ├── YouTubeProvider.ts   Raw postMessage to youtube-nocookie.com
│   ├── HlsProvider.ts       <video> + lazy-loaded hls.js
│   ├── Mp4Provider.ts       Plain <video> for direct MP4/WebM
│   └── createProvider.ts    URL → provider name → instance
└── ui/
    ├── Player.ts            Top-level orchestrator (mode-aware)
    ├── JsControlBar.ts      Option 1 — creates control bar at runtime
    ├── DomControlBar.ts     Option 2 — wires Webflow tree elements
    ├── StateBridge.ts       Shared — writes data-state / data-volume
    ├── Scrubber.ts          Custom div-based drag (no <input type=range>)
    ├── Settings.ts          Speed picker
    ├── Keyboard.ts          Space / M / F / arrows / 0–9
    ├── Fullscreen.ts        Vendor prefix + pseudo-fullscreen fallback
    └── PosterLoader.ts      oEmbed (Vimeo) / i.ytimg (YT) / data-poster (HLS/MP4)
```

**Bundle outputs:**
- `dist/flow-player-4/flow-player-4.js` — the core runtime, all providers
  baked in except HLS (~12 KB gzipped target)
- `hls.js` — fetched on demand from jsDelivr when needed
  (`https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js`)

**Distribution:**
- Bundle is published to a dedicated public GitHub repo (e.g.
  `github.com/<you>/flow-player`). jsDelivr serves it from
  `https://cdn.jsdelivr.net/gh/<you>/flow-player@<tag>/dist/flow-player-4.js`.
- Version-pinned via Git tags. Users get bug fixes when we push a new
  tag without re-pasting.

---

## Webflow tree shape — Option 1 (5 nodes, paste-safe)

```
.vp-component (Block)
├ HtmlEmbed  <script src="https://cdn.jsdelivr.net/.../flow-player-4.js" defer></script>
└ .vp-slot (Block)
  [data-video-url] [data-ui-mode="js"] [data-vimeo-mode="auto"]
  [data-autoplay] [data-show-title] [data-accent-color]
  [data-thumb-color]
  ├ .vp-poster (Block)
  └ .vp-play (Block) → contains an HtmlEmbed with the big play SVG
```

All five elements are plain `<div>` (Webflow `Block`). The HtmlEmbed
holds the script reference (one line, ~200 chars), not the bundle.

## Webflow tree shape — Option 2 (~20 nodes, paste-safe)

Same wrapper / slot / poster / play as Option 1, plus the bar:

```
.vp-slot
├ .vp-poster
├ .vp-play
└ .vp-controls (Block)
  ├ .vp-btn-play (Block, role=button) → HtmlEmbed with both icons
  ├ .vp-progress (Block) → contains track + buffer + fill + thumb
  │  ├ .vp-progress-track (Block) → buffer + fill children
  │  │  ├ .vp-progress-buffer (Block)
  │  │  └ .vp-progress-fill (Block)
  │  └ .vp-progress-thumb (Block)
  ├ .vp-time (Block) → 3 inline text spans (rendered via Webflow Text Block)
  │  ├ .vp-time-current (Text Block)
  │  ├ .vp-time-sep (Text Block)
  │  └ .vp-time-duration (Text Block)
  ├ .vp-volume-group (Block)
  │  ├ .vp-btn-mute (Block, role=button) → HtmlEmbed with 3 icon variants
  │  └ .vp-volume (Block) → custom drag div, not <input type=range>
  ├ .vp-settings (Block)
  │  ├ .vp-btn-settings (Block, role=button) → HtmlEmbed
  │  └ .vp-settings-menu (Block, display:none until open) → JS clones items
  └ .vp-btn-fullscreen (Block, role=button) → HtmlEmbed with 2 icons
```

Counts as **17 Webflow Block nodes + 5 HtmlEmbeds + 3 Text Block nodes
= 25 elements total**. v3 was 80. The difference:
- Buttons are styled `<div role="button" tabindex="0">`, NOT `<button>`
  (no tag override).
- Scrubber thumb + range are div-based with custom JS drag, NOT
  `<input type=range>`.
- Settings menu items (7 speed options) are JS-rendered into the menu
  container at runtime. Designer styles the `.vp-settings-item` class,
  not each item individually.

**Why this is safe:** every node is canonical Webflow `Block` or
`HtmlEmbed`. No `tag` overrides, no `attr.type='range'`. Webflow's
data layer treats it as a normal page structure.

---

## State management — same as v3 (data-attributes on wrapper)

JS only writes `textContent` and `data-*`. Never `classList`.

| Attribute | Values | When |
|---|---|---|
| `data-state` | `idle` \| `playing` \| `paused` \| `ended` | Playback state |
| `data-volume` | `mute` \| `mid` \| `full` | Volume level (derived) |
| `data-fullscreen` | `true` \| absent | Native or pseudo-fullscreen |
| `data-menu-open` | `true` \| absent | Settings menu visible |
| `data-vimeo-tier` | `basic` \| `plus` \| `pro` \| `business` \| `premium` | Set by oEmbed (Vimeo only) |
| `data-vp-init` | `1` | Provider attached |
| `data-vp-playing` | `1` | Iframe / video element created |

CSS rules in the embed's `<style>` block default the visual response;
designers add their own rules in Webflow Custom Code on top.

---

## URL → provider detection

```ts
function detectProvider(url: string): ProviderName | null {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'mp4';
  return null;
}
```

If the URL doesn't match any pattern (e.g. a relative path), the slot
stays in `idle` state and doesn't try to load. Designer fixes the URL.

---

## Vimeo tier auto-detection (carried from v3 Agent 1)

1. `PosterLoader` calls Vimeo oEmbed (same call we already use for the
   poster). Response includes `account_type`.
2. Cached on the slot as `data-vimeo-tier`.
3. Render-mode decision when the user clicks play:
   - YouTube / HLS / MP4 → always custom UI
   - Vimeo + tier ≠ `basic` → custom UI (controls=0 actually works)
   - Vimeo + tier === `basic` → native UI (Vimeo's chrome will show
     regardless; don't try to fight it)
   - `data-vimeo-mode="custom"` or `"native"` → manual override

---

## DialKit controls (params.ts)

Always-surfaced (in dial + as data-* attributes on the slot):

| Param | Type | Default | Becomes |
|---|---|---|---|
| `videoUrl` | text | Pro Vimeo test URL | `data-video-url` |
| `uiMode` | select: `js` / `webflow` | `js` | `data-ui-mode` |
| `vimeoMode` | select: `auto` / `custom` / `native` | `auto` | `data-vimeo-mode` |
| `autoplay` | bool | `false` | `data-autoplay` |
| `showTitle` | bool | `true` | `data-show-title` |
| `accentColor` | hex | `#00b3ff` | `data-accent-color` |
| `thumbColor` | hex | `#ffffff` | `data-thumb-color` |
| `posterUrl` | text | `''` | `data-poster` (HLS/MP4 only — URL of a poster image; ignored for Vimeo/YouTube which auto-fetch) |

DEFAULTS block (in boot script, edited inline after paste):
- `muted`, `loop`, `playsinline`, `showControls`, `keyboardShortcuts`,
  `autoPoster`

Presets (versions in the dropdown):
1. **Vimeo (auto-tier)** ← default, JS mode
2. **YouTube** — JS mode
3. **HLS (Mux test stream)** — JS mode
4. **MP4 (W3C Sintel trailer)** — JS mode
5. **Webflow elements — Vimeo** — webflow mode
6. **Webflow elements — YouTube** — webflow mode
7. **Showreel (autoplay + loop + muted, controls hidden)**

---

## Distribution model

### Webflow JSON paste — what ships

A small, safe @webflow/XscpData JSON:

**Tree:** 5 nodes (Option 1) or ~25 nodes (Option 2). All `type: 'Block'`,
`'HtmlEmbed'`, or `'Text Block'`. No tag overrides.

**Styles array:** `.vp-slot` + 4–8 other simple class rules. References
to style _ids in each node's `classes[]` (lesson from v3's class-id bug).

**HtmlEmbed contents:**
- ONE inline `<style>` block with the runtime CSS for internal-state
  rules (~5 KB, well under 50 KB)
- ONE `<script src="https://cdn.jsdelivr.net/gh/<you>/flow-player@<tag>/dist/flow-player-4.js" defer></script>`
  reference (~200 chars)
- ONE optional inline `<script>` with the small pre-color FOUC fix
  (~600 bytes) — kept inline because it runs synchronously during
  parse and is too small to justify a separate fetch

Each HtmlEmbed is well under Webflow's 50K-per-embed limit. No more
50K-dance, no inline 47 KB bundle.

### Runtime hosting — jsDelivr from a public GitHub repo

1. You create a public GitHub repo, e.g. `github.com/<you>/flow-player`.
2. We push the build output (`dist/flow-player-4.js` + sourcemap) into
   that repo. Initial structure:

   ```
   github.com/<you>/flow-player
   ├── README.md
   ├── package.json (optional)
   ├── dist/
   │   ├── flow-player-4.js
   │   └── flow-player-4.js.map
   └── tags: v1.0.0, v1.0.1, ...
   ```

3. Each release: bump the version, push tag `v1.x.x`. jsDelivr picks it
   up automatically.

4. Sites that pasted `@latest` get updates automatically. Sites that
   pinned `@v1.0.0` stay frozen until they re-paste.

5. Recommend version pinning (`@v1.0.0`) for production sites,
   `@latest` for development.

### What the user pastes into Webflow

Exactly two things, both via Webflow's clipboard JSON paste flow:

1. **The component** (one Cmd+V on the canvas) — the small JSON paste
   with the wrapper, slot, and HtmlEmbed(s).
2. **(One-time per Webflow project)** — nothing! The component is
   self-contained; no separate setup step needed.

Per-video: change `data-video-url` on the slot. URL detection handles
the rest. Provider, UI mode, accent color all flow through data-*.

---

## Build & deployment workflow

### One-time setup (you, the user)
1. Create the public GitHub repo (e.g. `<you>/flow-player`).
2. Tell me the repo URL.
3. I update `generateExport.ts` with the jsDelivr URL pattern.

### Each release (us, after code change)
1. `npm run build:flow-player-4` builds `dist/exports/flow-player-4.js`.
2. `npm run publish:flow-player-4` copies the bundle + sourcemap to the
   external repo, commits, pushes, tags. (Or you do this manually.)
3. jsDelivr serves the new version within a few minutes.

We add a build script for step 1 (modify existing `scripts/build-export-esm.ts`)
and a small publish helper for step 2 (uses local git + cp).

---

## Roadmap

1. **Scaffold** `flow-player-4/` — meta, params, index, helpers, icons,
   styles skeleton. Copy what's reusable from v3 (providers/, ui/Keyboard,
   ui/Fullscreen, ui/PosterLoader, ui/StateBridge).
2. **Rewrite Scrubber** — custom div-based drag math, no `<input type=range>`.
3. **Add HlsProvider + Mp4Provider** — new files. URL detection in
   helpers.ts.
4. **Adapt JsControlBar + DomControlBar** — same look as v3, but
   buttons are `<div role="button">` not `<button>`.
5. **Rewrite generateExport.ts** — small tree, no tag overrides,
   external CDN script reference. Lessons from v3's corruption baked in.
6. **Wire into ExperimentView + package.json predev** like the others.
7. **Verify at /experiment/flow-player-4** — all four providers,
   both UI modes, all presets.
8. **Initial publish to jsDelivr** — first tag, smoke-test the URL.
9. **Paste-test in a clean Webflow project** — confirm zero corruption,
   verify version stamp on `<html>`, confirm `data-flow-player-4-version`.

---

## Open questions to revisit before final ship

- **Repo name + URL** — the user will create the public repo; once
  named, plug into generateExport.ts.
- **Public HLS test stream choice** — Apple's BipBop or Mux's public
  test stream. Pick one when scaffolding.
- **`role="button"` vs Webflow's actual Button element** — Webflow
  has a Button block type. Need to verify that `type: 'FormButtonInput'`
  (or equivalent) accepts custom `data-*` attributes via xattr without
  corruption. Test in a clean project before committing.
- **Mobile touch UX** — different idle-hide timing on touch vs mouse?
  Not in v4 scope; revisit if real-world feedback asks for it.

---

## Findings

(Append-only research log; same convention as flow-player-plan.md and
flow-player-3-plan.md.)

### Inherited from v1, v2, v3 (full history)

- **Vimeo tier auto-detection via oEmbed** (Agent 1, May 11). The
  endpoint we already call for the poster carries `account_type` and
  `is_plus`. Auto-route Pro/Plus/Business/Premium → custom UI; basic →
  native UI. No manual flag needed.
- **Raw postMessage saves ~145 KB vs SDK route** (Agent 2, May 11).
  flowplayplus's stack is ~170 KB (Vimeo SDK + YouTube IFrame API +
  their glue). Ours is ~12 KB with the same surface.
- **Every Vimeo / YouTube playback path uses an iframe** (Agent 2).
  Including Plyr, flowplayplus, video.js — there's no escape on the
  client side. Our raw postMessage is the same model, just without
  the SDK middleman.
- **Webflow JSON paste corruption causes** (May 13–16, learned the
  hard way from v3):
  - Tag overrides on Block nodes (`tag: 'button'`, `tag: 'input'`) is
    the largest single contributor. Avoid completely.
  - Tree size matters; ~80 nodes is too many; ~25 is fine.
  - Inline `<script type="module">` of ~47 KB pushes Webflow's
    paste API into its failure mode. External CDN reference avoids
    this entirely.

### Agent 4 — 2026-05-16 — Osmo HLS + flowplayplus model

User's video deep-dive on Osmo's HLS player (BunnyCDN-served `.m3u8`)
informed v4's scope:
- HLS streaming is the right tech for self-hosted video — adaptive
  bitrate, segment streaming, ~0.5s startup vs Vimeo's 2–5s.
- BunnyCDN charges ~$1/month for typical small-site bandwidth vs
  Vimeo Plus's $7/mo per account.
- Osmo's distribution model is: Webflow Cloneable + paste a small
  custom JS (453 lines, ~10 KB) + CSS, plus a `<script src>` for
  hls.js from jsDelivr.
- Tree shape: smaller than v3 (~10–15 plain divs), no tag overrides,
  no big inline bundles. This is exactly what v4 needs.

### Agent 5 — 2026-05-16 — Scope locking for v4

Following user Q&A:
- All four providers in v4 (Vimeo + YouTube + HLS + MP4).
- Both UI modes (JS + Webflow tree), DialKit toggle.
- JSON paste only, simple safe tree, CDN-hosted runtime.
- jsDelivr from a public GitHub repo for distribution.
- Drop GDPR, captions, PiP, restart, loading spinner, idle-hide from
  v3 → reduces bundle ~3 KB gz. Add HLS/MP4 + hls.js lazy load.
- HLS test stream: Mux or Apple public stream. MP4 test: W3C Sintel
  trailer (same as flow-player-2 uses).
