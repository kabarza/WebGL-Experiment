# Flow Player — Plan

A branded video player for Webflow that wraps Vimeo + YouTube iframes
and ships custom controls. The goal is to deliver, with a single
copy-paste Webflow JSON, a polished player that designers can theme in
Webflow's Style panel and that behaves correctly regardless of the
host video's source or account tier.

## Architecture

```
flow-player/
├── meta.ts                  Slug + title + description (gallery card)
├── params.ts                Dial controls, defaults, presets
├── helpers.ts               URL parsing, oEmbed, buildIframeSrc
├── icons.ts                 Inline SVGs
├── styles.ts                CSS rules (split into Webflow-classes + internal)
├── standalone.ts            Bundle entry — runs at page load
├── experiment.ts            React preview (mirrors export 1:1)
├── generateExport.ts        Builds @webflow/XscpData JSON
├── providers/
│   ├── types.ts             Provider interface
│   ├── VimeoProvider.ts     Raw postMessage to player.vimeo.com
│   ├── YouTubeProvider.ts   Raw postMessage to youtube-nocookie.com
│   └── createProvider.ts
└── ui/
    ├── Player.ts            Orchestrator — facade, GDPR, mode decision
    ├── ControlBar.ts        Bottom control bar (play/scrub/time/vol/etc.)
    ├── Scrubber.ts          Track + buffer + fill + custom thumb
    ├── Settings.ts          Speed + captions menu
    ├── Keyboard.ts          Space / M / F / arrows / 0–9 shortcuts
    ├── Fullscreen.ts        Prefix-detection + pseudo-fullscreen fallback
    ├── ConsentGate.ts       GDPR 2-click + localStorage persistence
    └── PosterLoader.ts      oEmbed → background-image on .vp-poster
```

**Bundle size**: ~38 KB minified / ~10 KB gzipped. No runtime
dependencies. Bundled by `scripts/build-export-esm.ts` and inlined as
a string into the Webflow JSON HtmlEmbed.

**Webflow tree shape** (5 visible nodes per slot):
```
.vp-component  (wrapper)
├─ HtmlEmbed   (boot script + internal CSS)
└─ .vp-slot    [data-vimeo-url, data-vimeo-pro, data-autoplay,
                data-show-title, data-accent-color, data-thumb-color,
                data-consent]
   ├─ .vp-poster
   ├─ .vp-play (with SVG embed)
   └─ .vp-consent (display:none until needed)
      ├─ .vp-consent-title
      ├─ .vp-consent-body
      └─ .vp-consent-accept
```

The control bar (`.vp-controls` and ~15 sub-classes) is JS-rendered.
Its CSS ships in the embed's `<style>` block (NOT in Webflow's
`styles[]` array) so Webflow's tree-shaker can't drop classes that
aren't represented by tree nodes.

## Current state

| Area | Status |
|---|---|
| Vimeo + YouTube providers | ✓ via raw postMessage, no SDK |
| Hybrid UI strategy (`data-vimeo-pro` flag) | ✓ but should be auto-detected — see Agent 1 |
| Custom controls (play/skip/scrubber/time/mute/vol/settings/PiP/fullscreen) | ✓ |
| Restart, ±10s skip buttons | ✓ |
| Captions toggle + language picker | ✓ |
| Loading spinner | ✓ |
| Tooltips on hover | ✓ |
| Auto-fetched poster (Vimeo oEmbed / YouTube i.ytimg) | ✓ |
| GDPR consent gate | ✓ opt-in via `data-consent="required"` |
| Accent + thumb color tokens | ✓ via dial → `data-*` → CSS vars |
| Keyboard shortcuts | ✓ |
| Idle hide of bar | ✓ |
| Pseudo-fullscreen fallback (iOS) | ✓ |
| Version stamp on `<html>` | ✓ for diagnostics |

Known not-shipping:
- Hover-scrub preview thumbnails (needs server-side sprite pipeline)
- Custom WebVTT caption renderer (we use providers' native rendering)
- AirPlay (requires `<video>` element; iframes don't expose theirs)

## Decisions to make

1. **Vimeo tier handling.** Currently `data-vimeo-pro="true"` manual
   flag. Agent 1 found we can auto-detect via oEmbed's `account_type`
   and `is_plus`. Should we replace the manual flag with auto-detection?
2. **flow-player-2 positioning vs flow-player.** flow-player-2 now
   handles the same three source types (native HTML5, Vimeo iframe,
   YouTube iframe) — see Reconciliation below for the port. The
   remaining question is positioning, not scope: flow-player ships
   a small Webflow tree with a JS-rendered control bar (~5 nodes);
   flow-player-2 ships a big Webflow tree with every control as a
   designer-editable element (~80 nodes). Keep both? Pick one?
3. **Small ports from flow-player-2 → flow-player.** `skipSeconds`
   parameter, separate `bufferColor`, pointer-event drag math. Cheap
   to port.

---

## Findings

### Agent 1 — 2026-05-11 — Auto-detection of Vimeo tier via oEmbed

**Source case study:** [vds-iphone-player-2.webflow.io](https://vds-iphone-player-2.webflow.io/)
ships a custom-controlled Vimeo player. Investigation showed:

- Page loads
  `https://cdn.jsdelivr.net/gh/videsigns/webflow-tools@latest/Media%20Player/flowplayplus-dev.js`
  (~69 KB). Architecture: load Vimeo's Player SDK (~30 KB) +
  bind click/state handlers to Webflow elements that carry
  `f-data-video="play-button"` etc. attributes. Similar shape to
  flow-player-2 but for iframe source.
- **The reason their custom controls work** is the video they embed
  (ID `265111898`) is on a **Pro Vimeo account**. Confirmed via oEmbed.
  No magic — the same `controls=0` we use; the same Pro/free
  restriction. The library does not "solve" the free-tier problem.

**Key discovery — oEmbed exposes account tier.**
The Vimeo oEmbed endpoint returns `account_type` and `is_plus`:

```
Big Buck Bunny (free, 1084537):    account_type: "basic"   is_plus: 0
Pro test video (804853787):        account_type: "plus"    is_plus: 1
Site's video (265111898):          account_type: "pro"     is_plus: 0
```

Since flow-player already calls oEmbed on every Vimeo slot to fetch
the poster thumbnail (`PosterLoader.ts`), **we can read the same
response and decide UI mode automatically** — no manual flag needed.

**Recommendation:**
- Replace `data-vimeo-pro` with auto-detection in `PosterLoader.ts`
  → `Player.ts`. Cache the response.
- Keep a `data-vimeo-mode="auto" | "custom" | "native"` attribute as
  an override for edge cases (e.g., oEmbed unreachable, or user wants
  to force native UI even on Pro).
- Collapse the "Vimeo Pro" and "Vimeo free" presets into a single
  "Vimeo" preset — runtime figures out which UI to render.

This is the auto-detection user requested at the start of the
project (we previously claimed it wasn't possible — that was wrong).

**Implementation sketch (~30 lines of changes):**

```ts
// helpers.ts — extend ThumbnailResult
export interface ThumbnailResult {
  url: string;
  width?: number;
  height?: number;
  /** Vimeo only — null on YouTube. */
  accountType?: 'basic' | 'plus' | 'pro' | 'business' | 'premium';
  isPlus?: boolean;
}

// fetchThumbnail's Vimeo branch reads the same fields from oEmbed JSON

// PosterLoader.ts — already stores result; expose tier via a
// data-* attribute on the slot so Player.ts can read it after the
// fetch resolves

// Player.ts useCustomUI decision becomes:
const useCustomUI =
  source.provider === 'youtube'
  || slot.dataset.vimeoTier === 'pro' /* or plus|business|premium */
  || attrBool(slot, 'data-vimeo-mode', 'auto') === 'custom';
```

Async caveat: oEmbed is fetched after `initOne()` returns. The slot
might already have rendered its facade. Options:
- Block the click handler until oEmbed resolves (typically <300 ms)
- Show poster + play button immediately; on click, await tier check
  before deciding render mode

The second option keeps perceived load time fast. Recommended.

**Bonus from the same investigation** — flowplayplus's UI-as-Webflow-
elements approach is the same idea as flow-player-2 but for iframe
sources. We rejected this for flow-player because:
1. JS-rendering controls keeps the Webflow tree small (5 nodes vs ~80)
2. Iframe providers already brand their chrome (Vimeo logo etc.)
   regardless of how our controls are built; the win from edit-in-
   Designer is smaller for iframe sources than for HTML5 source
3. CSS variables on `.vp-slot` cover ~95% of the customization our
   users will actually want

No change recommended on that front. Keep JS-rendered control bar.

### Agent 2 — 2026-05-11 — Confirming the iframe question (vds-iphone-player-2 deep dive)

**Question this investigation answered:** _Does any production Webflow
video-player library actually render Vimeo or YouTube without an
iframe?_ Spent some time on the same site Agent 1 found —
[vds-iphone-player-2.webflow.io](https://vds-iphone-player-2.webflow.io/) —
this time inspecting the rendered DOM and the loader script in detail.

**Initial HTML payload is empty of media nodes.** `curl`'d the page
fresh: no `<video>`, no `<source>`, no `<iframe>` in the served HTML.
Just the controls UI as Webflow elements plus three `<script>` tags:

```
1. https://player.vimeo.com/api/player.js                    (Vimeo Player SDK — ~30 KB)
2. https://www.youtube.com/player_api                        (YT IFrame API)
3. https://cdn.jsdelivr.net/.../flowplayplus-dev.js          (flowplayplus, ~69 KB)
```

The first two are loaded by `flowplayplus-dev.js` itself (lines 1–17 of
that file): on load it appends `<script src="player.vimeo.com/api/player.js">`
and `<script src="youtube.com/player_api">` before its own tag, then waits
for them to initialise.

**The smoking gun (flowplayplus-dev.js:1361):**

```js
var video = new Vimeo.Player(vimeo, options);
```

`new Vimeo.Player(targetEl, options)` is the SDK's documented constructor.
**Under the hood it creates an `<iframe src="https://player.vimeo.com/video/{id}?...">`
inside the target element** and returns a JS handle for postMessage
control. YouTube path is identical — `new YT.Player(...)` injects an
iframe pointed at the embed URL. After the page hydrates, the DOM does
contain `<iframe>` elements; they just didn't ship in the static HTML.

**flowplayplus vs flow-player-2 — same shape, different plumbing:**

| | flowplayplus-dev | flow-player-2 |
|---|---|---|
| Iframe creation | Vimeo SDK / YT API does it | We do it (helpers.ts:buildIframeSrc) |
| iframe → JS bridge | SDK wrappers (`player.play()`, `player.on('timeupdate', …)`) | Raw postMessage to the iframe (providers/VimeoProvider.ts, YouTubeProvider.ts) |
| External `<script>` tags loaded | 2 (player.js + player_api) | 0 |
| Total bytes shipped | ~170 KB (flowplayplus 69 + Vimeo SDK 30 + YT IFrame API ~70) | ~24 KB (ours alone) |
| UI structure | Real Webflow elements w/ f-data-video attrs | JS-rendered control bar (flow-player), or Webflow elements (flow-player-2) |

**Conclusion: there is no Vimeo/YouTube playback without an iframe.**
Both providers gate direct stream URLs (Vimeo HLS, YouTube DASH manifests)
behind authenticated API calls and tier requirements. Every production
"custom Webflow video player" — flow-player, flow-player-2, flowplayplus,
plyr, video.js with the YT/Vimeo techs — ends up with an iframe in the
DOM. The visible custom UI is always an overlay driving that iframe via
postMessage. This puts a hard floor on what the project can promise.

**Implications for our roadmap:**

1. The flow-player-2 user-facing claim should be tightened from "no
   iframe" to "the iframe is hidden behind your Webflow-controlled UI."
   Anyone benchmarking us against flowplayplus will reach this
   conclusion on day one; we should beat them to it in the README.
2. **Our raw-postMessage approach is strictly better than the SDK route
   for our use case.** Saves ~75 KB on the wire (the two SDK scripts +
   their dependencies), and we don't inherit Vimeo/YouTube SDK API
   changes. Trade-off: we maintain the postMessage protocol ourselves
   — but that protocol has been stable for a decade (Vimeo's docs
   even point library authors at it as the "no-SDK" path).
3. **HLS / self-hosted source is the only real "no iframe" path.**
   If we want to offer that, it's `<video>` + `hls.js` (~50 KB) for
   `.m3u8` URLs. Worth scoping as a separate experiment (call it
   flow-player-3?) rather than bolting onto flow-player or
   flow-player-2 — its scope (streaming, ABR, captions sidecar) is
   different enough.

**No code changes recommended** from this investigation — the existing
Vimeo/YouTube provider implementation is correct as-is. Just docs.

### Reconciliation — 2026-05-11 — Agent 1 vs Agent 2

Agent 1 and Agent 2 each took a focused slice and left a few seams.
Resolving them here so a third reader can trust the doc end-to-end.

**1. flow-player-2's scope.** Agent 1 describes flow-player-2 as the
"HTML5 self-hosted" experiment (Decisions §2 pre-edit; lines in
Agent 1 about "iframe sources vs HTML5 source"). That was accurate
when Agent 1 wrote, but earlier today the Vimeo + YouTube providers
were ported into flow-player-2 (`providers/`, `mediaSource.ts`,
`helpers.ts`). flow-player-2 now sniffs the URL on bind, picks the
right adapter, and hides the unused element. So **flow-player-2 is
no longer HTML5-only** — it handles all three source kinds.
References in Agent 1's section to "flow-player-2 is for HTML5
source" should be read as historical context, not current state.

**2. Webflow-elements UI for iframe sources.** Agent 1 rejected this
approach _for flow-player_ on three grounds (small tree, redundant
custom chrome over provider chrome, CSS-vars cover 95%). Agent 2
then leveraged the same approach _in flow-player-2_ without
addressing the tension. Both can be right because **the two players
have different positioning**:

- **flow-player** — small footprint, fast designer install (5
  Webflow nodes), JS-rendered controls. Wins when the designer
  wants a polished player they don't expect to redesign.
- **flow-player-2** — big footprint, every control is a Webflow
  element the designer can restyle/hide/replace (~80 nodes).
  Wins when the designer wants to substantially redesign the
  player chrome.

This is the answer to Decisions §2 above: keep both, position them
explicitly. The "rejection" in Agent 1's section applies to
flow-player's positioning, not as a universal verdict.

**3. Agent 1's tier-detection finding is unaffected by Agent 2.**
Agent 2's investigation focused on the iframe question and did not
re-examine the Pro/free tier mechanics. Agent 1's recommendation
stands: auto-detect Vimeo tier via oEmbed `account_type` + `is_plus`
and route Pro/Plus/Business/Premium accounts through the custom UI,
basic accounts through Vimeo's native player. This applies to both
flow-player and (after the port) flow-player-2 — both should adopt
it before either ships.

**4. Byte-count footnote.** Agent 2's table originally listed the
flowplayplus stack as ~99 KB; updated above to ~170 KB to include
the YouTube IFrame API script (~70 KB) that flowplayplus also pulls
in. The "raw-postMessage saves ~75 KB" claim becomes "saves ~145 KB"
— makes the case stronger, not weaker.

## Open ports from flow-player-2 (not done)

| Item | Effort | Value |
|---|---|---|
| `skipSeconds` parameter (currently hardcoded 10s) | 10 min | low |
| Separate `bufferColor` CSS variable | 5 min | low |
| Pointer-event drag math instead of `<input type=range>` | 30 min | medium (smoother feel) |
| Volume-level → icon mapping (mute/mid/full) | 15 min | low (we have icons; mapping is hardcoded) |

Decide whether to port before final ship.

## Suggested roadmap

1. **Implement Agent 1's auto-detection.** Highest user-facing value.
   ~30 min of focused work.
2. **Decide on the four flow-player-2 ports.** If shipping soon,
   skip them. If polishing, port all four (~1 h total).
3. **Verify in Webflow** — paste the updated JSON, test with one Pro
   video, one free video, one YouTube video. Confirm tier auto-
   detection picks the right UI for each.
4. **Update bundle version stamp** to mark the auto-detection release.
5. **Document the slot attributes** in the export's HtmlEmbed header
   comment, so users pasting into Webflow see usage.
