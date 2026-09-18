# Flow Player 3 — Plan

A branded Vimeo + YouTube player for Webflow. **Two UI modes** the
designer toggles in DialKit. Auto-detects Vimeo account tier. One
copy-paste Webflow JSON ships everything the chosen mode needs.

This is a **new experiment** alongside flow-player and flow-player-2;
flow-player-3 will be the recommended canonical version going forward
but the others stay for reference and fallback until 3 is verified
shipping.

---

## Scope (locked)

- **Providers:** Vimeo + YouTube only. No HTML5, no HLS.
  HTML5/self-hosted is a niche use case for typical Webflow customers
  (~95% upload to Vimeo or YouTube); flow-player-2 already covers it
  if anyone needs it. We can add to flow-player-3 later if demand
  shows up.
- **Two UI modes**, toggled in DialKit:
  - **Option 1 — JS-rendered** (default): control bar created at
    runtime. ~5 Webflow tree nodes per slot. Theme via CSS variables.
  - **Option 2 — Webflow elements**: every button, label, slider
    thumb, menu item ships as a Webflow tree node (~80+ per slot).
    Designer-editable via the Style panel like any other element.
- **Both modes** support both providers (Vimeo Pro/Plus/Business/
  Premium + YouTube). Free Vimeo always falls back to Vimeo's native
  UI regardless of toggle.
- **State management in Option 2:** `data-state` / `data-volume` /
  `data-menu-open` / `data-fullscreen` etc. on the wrapper. CSS
  reacts. JS only writes `textContent` and `data-*` attributes —
  never touches `classList`.
- **Auto-tier detection:** oEmbed call (already happens for the
  poster) carries `account_type` + `is_plus`; runtime uses it to
  pick custom UI vs Vimeo's native UI.
- **Plumbing:** Raw postMessage. No Vimeo Player SDK, no YouTube
  IFrame API script. Saves ~145 KB vs the SDK route (per Agent 2
  in `flow-player-plan.md`).

## Relationship to flow-player and flow-player-2

Three players in the repo. Different positioning:

| | Audience | Tree size | UI flexibility | Status |
|---|---|---|---|---|
| **flow-player** | Polished small-footprint embed | 5 nodes | CSS variables | Reference / fallback |
| **flow-player-2** | Designer wants to redesign every button | ~80 nodes | Full Webflow Designer | Reference / power-user |
| **flow-player-3** | Both — pick at export time | 5 OR ~80 (user toggle) | CSS vars OR full Designer | **Recommended new component** |

flow-player-3 unifies what was previously a fork between flow-player
and flow-player-2. After flow-player-3 is verified shipping in real
Webflow projects, we revisit deleting flow-player. flow-player-2
likely stays since its tree shape is its identity — keeping it as a
"pure Webflow elements" reference doesn't cost much.

---

## Architecture

```
flow-player-3/
├── meta.ts                  Slug + title + description (gallery card)
├── params.ts                Dial controls, defaults, presets
├── helpers.ts               URL parsing, oEmbed (incl. account_type)
├── icons.ts                 Inline SVGs (used by both UI modes)
├── styles.ts                CSS: WEBFLOW_CLASSES vs INTERNAL_RULES
├── standalone.ts            Bundle entry — runs at page load
├── experiment.ts            React preview — toggles modes via dial
├── generateExport.ts        Webflow JSON — emits different trees per mode
├── providers/
│   ├── types.ts             Provider interface
│   ├── VimeoProvider.ts     Raw postMessage to player.vimeo.com
│   ├── YouTubeProvider.ts   Raw postMessage to youtube-nocookie.com
│   └── createProvider.ts
└── ui/
    ├── Player.ts            Top-level orchestrator (mode-aware)
    ├── JsControlBar.ts      Option 1 — creates control bar at runtime
    ├── DomControlBar.ts     Option 2 — wires Webflow tree elements
    ├── StateBridge.ts       Shared — writes data-state / data-volume
    ├── Scrubber.ts          Mode-agnostic — both modes call this
    ├── Settings.ts          Speed + captions menu
    ├── Keyboard.ts          Space / M / F / arrows / 0–9
    ├── Fullscreen.ts        Vendor prefix + pseudo-fullscreen fallback
    ├── ConsentGate.ts       GDPR — same for both modes
    └── PosterLoader.ts      oEmbed → poster bg + cached tier
```

**Bundle size target:** ~12–15 KB gzipped (vs flow-player's ~10 KB).
Single bundle, mode-aware at runtime — both `JsControlBar` and
`DomControlBar` import; `Player.ts` reads `data-ui-mode` and calls one
or the other.

---

## Webflow tree shape — Option 1 (5 nodes)

```
.vp-component
├ HtmlEmbed (boot script + internal CSS)
└ .vp-slot
  [data-vimeo-url] [data-ui-mode="js"] [data-vimeo-mode="auto"]
  [data-autoplay] [data-show-title] [data-accent-color]
  [data-thumb-color] [data-consent]
  ├ .vp-poster
  └ .vp-play (with SVG embed inside)
```

Control bar created by JS. CSS variables on `.vp-slot` drive theme.
Editing path:
1. DialKit at export time → sets initial DEFAULTS
2. Edit values in the embed's `DEFAULTS = { ... }` block after pasting
3. Edit CSS variables on `.vp-slot` in Webflow Style panel
   (`--vp-accent`, `--vp-thumb-color`, `--vp-bar-bg`, etc.)

## Webflow tree shape — Option 2 (~80 nodes)

```
.vp-component
├ HtmlEmbed (boot script + internal CSS)
└ .vp-slot [data-ui-mode="webflow"] + same data-* attrs as Option 1
  ├ .vp-poster
  │ └ (user content OR JS-set background image)
  ├ .vp-play (overlay before playback)
  │ └ HtmlEmbed (default SVG, replaceable)
  ├ .vp-consent (display:none until needed)
  │ ├ .vp-consent-inner
  │ │ ├ .vp-consent-title (Heading)
  │ │ ├ .vp-consent-body (Paragraph)
  │ │ └ .vp-consent-accept (Button)
  ├ .vp-loading (display:none until buffering)
  │ └ .vp-loading-spinner
  └ .vp-controls
    ├ .vp-btn-play [data-vp="play"]
    │ ├ .vp-icon-play (HtmlEmbed SVG)
    │ └ .vp-icon-pause (HtmlEmbed SVG)
    ├ .vp-btn-restart [data-vp="restart"]
    │ └ HtmlEmbed SVG
    ├ .vp-btn-rewind [data-vp="rewind"]
    │ └ HtmlEmbed SVG
    ├ .vp-btn-forward [data-vp="forward"]
    │ └ HtmlEmbed SVG
    ├ .vp-progress [data-vp="progress"]
    │ ├ .vp-progress-track
    │ │ ├ .vp-progress-buffer
    │ │ └ .vp-progress-fill
    │ └ .vp-progress-thumb
    ├ .vp-time
    │ ├ .vp-time-current  ← JS sets textContent
    │ ├ .vp-time-sep      ← static " / "
    │ └ .vp-time-duration ← JS sets textContent
    ├ .vp-btn-captions [data-vp="captions"] (hidden when no tracks)
    │ └ HtmlEmbed SVG
    ├ .vp-volume-group
    │ ├ .vp-btn-mute [data-vp="mute"]
    │ │ ├ .vp-icon-vol-full
    │ │ ├ .vp-icon-vol-mid
    │ │ └ .vp-icon-vol-mute
    │ └ .vp-volume [data-vp="volume"]
    │   ├ .vp-volume-track
    │   ├ .vp-volume-fill
    │   └ .vp-volume-thumb
    ├ .vp-settings
    │ ├ .vp-btn-settings [data-vp="settings"]
    │ │ └ HtmlEmbed SVG
    │ └ .vp-settings-menu (display:none until open)
    │   ├ .vp-settings-section [data-section="speed"]
    │   │ ├ .vp-settings-heading "Speed"
    │   │ └ .vp-settings-list
    │   │   ├ .vp-settings-item [data-speed="0.5"]
    │   │   ├ .vp-settings-item [data-speed="0.75"]
    │   │   ├ .vp-settings-item [data-speed="1"] [aria-checked="true"]
    │   │   ├ .vp-settings-item [data-speed="1.25"]
    │   │   ├ .vp-settings-item [data-speed="1.5"]
    │   │   ├ .vp-settings-item [data-speed="1.75"]
    │   │   └ .vp-settings-item [data-speed="2"]
    │   └ .vp-settings-section [data-section="captions"]
    │     ├ .vp-settings-heading "Captions"
    │     └ .vp-settings-list
    │       ├ .vp-settings-item [data-track-id=""] "Off"
    │       └ .vp-settings-item-template [data-track-template]
    │         ← invisible template, JS clones for each language
    ├ .vp-btn-pip [data-vp="pip"] (hidden for YouTube)
    │ └ HtmlEmbed SVG
    └ .vp-btn-fullscreen [data-vp="fullscreen"]
      ├ .vp-icon-fs-enter
      └ .vp-icon-fs-exit
```

**Dynamic content rule:** anything JS needs to update per frame
(time text, scrubber width, thumb position, volume fill) lives as
`textContent` on existing nodes or as CSS variables on the wrapper.
JS only appends DOM for captions language items (template clone).

---

## State management — data-attributes on wrapper

In Option 2, JS writes these attributes on `.vp-slot`:

| Attribute | Values | When |
|---|---|---|
| `data-state` | `idle` \| `playing` \| `paused` \| `ended` | Playback state changes |
| `data-loading` | `true` \| absent | During buffering |
| `data-volume` | `mute` \| `mid` \| `full` | Volume level changes (derived from muted + volume) |
| `data-fullscreen` | `true` \| absent | Native or pseudo-fullscreen entered |
| `data-menu-open` | `true` \| absent | Settings menu visible |
| `data-controls-idle` | `true` \| absent | Idle-hide timer triggered |
| `data-vimeo-tier` | `basic` \| `plus` \| `pro` \| `business` \| `premium` | Set by oEmbed |
| `data-vp-init` | `1` | Once provider attached |
| `data-vp-playing` | `1` | Once iframe loaded after first click |

CSS rules in the embed `<style>` block provide the default behavior
(e.g., `[data-state="playing"] .vp-icon-play { display: none }`).
Designers add their own rules in Webflow's Custom Code block on top.

Option 1 internally tracks the same state, but applies it via
JS-rendered DOM directly. Same `StateBridge.ts` module abstracts
both — Option 2's bridge writes data-attrs; Option 1's bridge directly
manipulates the elements it owns.

---

## Vimeo tier auto-detection

(Mechanism documented in `docs/flow-player-plan.md`, Agent 1.
Summary here for completeness.)

1. On `attachSlot()`, the boot script calls Vimeo's oEmbed endpoint
   for the URL — same fetch we already do for the poster thumbnail.
2. Response includes `account_type` (`basic` | `plus` | `pro` |
   `business` | `premium`) and `is_plus` (0/1).
3. We cache the result and set `data-vimeo-tier` on the slot.
4. Render-mode decision:

```ts
const useCustomUI =
  source.provider === 'youtube'
  || (source.provider === 'vimeo'
      && tier !== 'basic'
      && slot.dataset.vimeoMode !== 'native')
  || slot.dataset.vimeoMode === 'custom'; // manual override
```

5. If `useCustomUI` is false, we just embed the Vimeo iframe with
   Vimeo's native chrome and skip the custom UI entirely.
6. If true, we proceed with the chosen UI mode (Option 1 or 2).

**Async caveat:** oEmbed resolves after ~200–400ms. We show poster +
play overlay immediately; on first click, await the tier check before
deciding render mode. Zero perceived delay unless the user clicks
faster than oEmbed resolves.

**Manual override** via `data-vimeo-mode`:
- `auto` (default) — let oEmbed decide
- `custom` — force our custom UI even on free (will overlap Vimeo's
  chrome — useful for testing or if you accept the masking)
- `native` — force Vimeo's native UI even on Pro

---

## Thumbnail handling

**Both modes** ship a `.vp-poster` div in the Webflow tree.

1. **Auto** (default): `PosterLoader` reads provider thumbnail
   - Vimeo: oEmbed `thumbnail_url` (single fetch carries tier info too)
   - YouTube: `https://i.ytimg.com/vi/{id}/hqdefault.jpg`
2. Apply as `background-image` on `.vp-poster`
3. **User override**: drop a Webflow Image (or any content) inside
   `.vp-poster` → `poster.children.length > 0` → JS skips auto-fetch
4. **Explicit override per slot**: `data-poster="https://..."` or
   `data-poster="none"`

---

## DialKit controls (params.ts)

Surfaced in the dial (and emitted as `data-*` attributes on the slot):

| Param | Type | Default | Becomes |
|---|---|---|---|
| `videoUrl` | text | Pro test URL | `data-vimeo-url` |
| `uiMode` | select: `js` / `webflow` | `js` | `data-ui-mode` |
| `vimeoMode` | select: `auto` / `custom` / `native` | `auto` | `data-vimeo-mode` |
| `autoplay` | bool | `false` | `data-autoplay` |
| `showTitle` | bool | `true` | `data-show-title` |
| `accentColor` | hex | `#00b3ff` | `data-accent-color` |
| `thumbColor` | hex | `#ffffff` | `data-thumb-color` |
| `bufferColor` | hex | rgba(255,255,255,0.35) | `data-buffer-color` |
| `consent` | select: `off` / `required` | `off` | `data-consent` |
| `skipSeconds` | slider | `10` | `data-skip-seconds` |

DEFAULTS block (in boot script, edited in HtmlEmbed for Option 1 or
in Webflow Style panel for Option 2):
- `muted`, `loop`, `playsinline`, `showControls`, `showByline`,
  `showPortrait`, `keyboardShortcuts`, `autoHide`, `idleTimeout`,
  `autoPoster`

Presets (versions in the dropdown):

1. **JS — Vimeo (auto-tier)** ← default
2. **JS — YouTube**
3. **Webflow — Vimeo (auto-tier)**
4. **Webflow — YouTube**
5. **Showreel** (autoplay + muted + loop, controls hidden)
6. **GDPR-compliant hero** (consent gate enabled)

---

## Bundle strategy

**One bundle, mode-aware.** The runtime imports both `JsControlBar`
and `DomControlBar`. At boot, `Player.ts` reads `data-ui-mode` on the
slot and calls one or the other. Both share `Scrubber.ts`,
`Settings.ts`, `Keyboard.ts`, etc.

Estimated size:
- Shared code (providers, helpers, state bridge, scrubber math): ~7 KB gz
- JS control bar (DOM creation): ~3 KB gz
- DOM control bar (query + wire): ~2 KB gz
- **Total: ~12 KB gzipped** (vs flow-player's ~10 KB)

Trade-off accepted: 2 KB extra for the dual-mode logic. Far better
than two separate bundles to maintain.

---

## Roadmap

1. **Scaffold** the directory + files. Copy from flow-player what's
   reusable (providers, helpers, Player skeleton).
2. **Port helpers.ts** with oEmbed tier extraction. Add cache on slot
   dataset.
3. **Build `StateBridge.ts`** — central place for data-attribute
   writes. Used by both UI modes.
4. **Build `JsControlBar.ts`** — basically flow-player's ControlBar
   with class-toggle replaced by StateBridge writes.
5. **Build `DomControlBar.ts`** — selectors over the Webflow tree,
   click handlers, same StateBridge writes.
6. **Build `generateExport.ts`** — branch on `uiMode`, emit correct
   tree shape and styles bucket.
7. **Build `experiment.ts`** — preview both modes, toggle in dial
   rebuilds the slot DOM.
8. **Wire into `ExperimentView` + `package.json` predev** like the
   others.
9. **Verify** at `/experiment/flow-player-3` with all presets.
10. **Paste-test** the exported JSON in a Webflow staging page for
    both modes + Pro Vimeo + free Vimeo + YouTube. Document edge
    cases in this PLAN's Findings section.

---

## Open questions to revisit

- **Captions tracks in Option 2.** Dynamic per video. Plan is one
  invisible template `.vp-settings-item-template`, JS clones for
  each language. Confirm UX before final. Alternative: pre-ship 3
  placeholder language items, hide unused.
- **Settings menu placement at edges.** When the menu opens near the
  right edge of the slot, it overflows. Need viewport-aware
  positioning. Easy in Option 1, awkward in Option 2 (designer-
  positioned + JS measurement).
- **Mobile touch UX.** Different idle-hide rules on touch vs mouse.
  Currently single rule.
- **Free Vimeo + Option 2.** When tier is `basic`, we fall back to
  Vimeo's native UI. That means the 80 Webflow nodes designer carefully
  styled are unused for that slot. Acceptable? Or warn the designer
  at export time if uiMode=webflow and the URL is on a free account?

---

## Findings

(Append-only research log; same convention as `flow-player-plan.md`.)

### Inherited from flow-player — Agent 1 + Agent 2 (2026-05-11)

See `docs/flow-player-plan.md` for the full research log. Two key
findings carried into flow-player-3:

1. **Vimeo tier auto-detection via oEmbed** (Agent 1). The endpoint
   we already call for the poster carries `account_type` + `is_plus`.
   We use this to pick custom UI vs native UI without a manual flag.

2. **Raw postMessage saves ~145 KB vs SDKs** (Agent 2). The
   videsigns/flowplayplus library on `vds-iphone-player-2.webflow.io`
   loads Vimeo Player SDK (~30 KB) + YouTube IFrame API (~70 KB) +
   their own glue (~69 KB) — total ~170 KB. Our raw-postMessage
   approach ships in ~24 KB total. The postMessage protocol has been
   stable for ~a decade; trade-off accepted.

3. **All Vimeo / YouTube playback flows ultimately use an iframe**
   (Agent 2). flowplayplus, Plyr, video.js — every "custom Webflow
   video player" ends up with a `<iframe>` injected by the page. Our
   approach is the same; we just skip the SDK middleman.

### Agent 3 — Decisions locking flow-player-3 scope

After re-reading the two prior agents and discussing live with the
user:
- HTML5 / self-hosted source: **out of scope for v1**. Niche for the
  Webflow audience (~95% upload to Vimeo or YouTube). flow-player-2
  covers it if anyone needs it.
- HLS streaming: out of scope. Even more niche.
- Two UI modes (JS / Webflow elements): **in scope**, headline feature.
- Auto-tier detection: **in scope** as default behavior.
- Manual override `data-vimeo-mode`: kept for edge cases.
- flow-player-3 positioned as the new canonical version; flow-player
  to be revisited for deletion after verification; flow-player-2 to
  stay as a power-user variant.
