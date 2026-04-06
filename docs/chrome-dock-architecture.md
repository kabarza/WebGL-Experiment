# Chrome Dock Architecture

How the persistent floating navigation works across views.

## Overview

The app has a single floating toolbar (the "chrome dock") that persists across route transitions. It lives outside `AnimatePresence` in `App.tsx`, so it never unmounts when the page content fades in/out. Only its _contents_ change based on the current route.

```
App.tsx
  ChromeProvider          ← context for cross-component state
    ChromeDock             ← always mounted, reads route
    AnimatePresence
      Gallery | ExperimentView | FlowFieldArticle | ArticlePage | ControlTuner
    DialRoot               ← mounted on experiment + tuner routes
```

## File map

| File | Role |
|---|---|
| `components/ChromeDock.tsx` | The persistent toolbar. Reads route to decide which buttons render. |
| `components/ChromeContext.tsx` | React context bridging the dock and the active view. |
| `components/ExperimentView.tsx` | Canvas + WebGL. Registers share data with context. No nav markup. |
| `components/FlowFieldArticle.tsx` | Rich article. Registers TOC sections + scroll callback with context. No nav markup. |
| `components/ArticlePage.tsx` | Generic empty-state article for experiments without a dedicated article. |
| `gallery/gallery.css` | Styles for `.chrome-dock-wrapper`, `.chrome-dock`, `.dock-btn`, `.dock-divider`. |
| `styles/article.css` | Styles for `.article-toc-*` dropdown, toggle, anchor. |

## Route types and dock behavior

| Route | Dock visible | Buttons shown |
|---|---|---|
| `gallery` | No | — |
| `experiment` | Yes (unless H-key hides overlay) | Back, Share, Article (if `hasArticle`), Export, divider, FPS |
| `article` | Yes | Back, Share, Diamond (view experiment), divider + TOC toggle (if sections exist) |
| `tuner` | No | — |

## ChromeContext

The context carries four things. The split between reactive state and refs is intentional to avoid unnecessary re-renders.

### Reactive (triggers dock re-render)

- **`activeSection`** / `setActiveSection` — which article section is in the viewport. The TOC dropdown highlights the active item.
- **`tocSections`** / `setTocSections` — array of `{ id, label }`. Articles register their sections on mount and clear them on unmount. The dock only shows the TOC toggle when this array is non-empty.

### Imperative (refs, no re-render)

- **`scrollToSectionRef`** — a callback the dock calls when a TOC item is clicked. The article component writes its own `scrollTo` function here on mount.
- **`shareDataRef`** — `{ slug, params }` written by `ExperimentView` so the dock's share button can read the current params at click time without re-rendering on every param change.

## State ownership

Some state that previously lived inside individual views got lifted to `App.tsx` so the dock can interact with it:

| State | Lives in | Why |
|---|---|---|
| `overlayVisible` | `App.tsx` | Dock reads it to hide itself on H-key. ExperimentView writes it via `setOverlayVisible` prop. |
| `exportOpen` | `App.tsx` | Dock's export button sets it. ExperimentView reads it to render `ExportPanel`. |
| `tocOpen`, `copied` | `ChromeDock.tsx` | Transient UI state, only the dock needs it. Reset on route change. |
| `activeSection`, `tocSections` | `ChromeContext` | Article writes, dock reads. |

## How a new article gets its nav

1. Set `hasArticle: true` in the experiment's `meta.ts` (the template does this by default).
2. The dock auto-shows the article icon button for that experiment — no hardcoded slug checks.
3. The gallery card auto-shows the "How it works" link.
4. Navigating to `/experiment/{slug}/article` renders:
   - A dedicated component if one exists (currently only `FlowFieldArticle`)
   - The generic `ArticlePage` empty state otherwise
5. To add TOC navigation to a new article, call `setTocSections(sections)` and register a `scrollToSectionRef` on mount. The dock's TOC toggle appears automatically.

## z-index layering

```
300  .chrome-dock-wrapper  (dock always on top)
200  .error-screen, .loading-screen
101  (legacy, unused)
 10  .article-toc (fixed sidebar)
  5  article body content
```

The dock intentionally sits above error/loading screens so you can always navigate away from a broken experiment.

## CSS classes

### Dock (gallery.css)

- `.chrome-dock-wrapper` — fixed position container, `top: 16px; left: 16px`.
- `.chrome-dock` — the pill: flexbox, `border-radius: 100px`, dark glass background.
- `.dock-btn` — 30x30 circle button with hover/active states.
- `.dock-btn--active` — bright text color (used for copy-success and TOC-open).
- `.dock-divider` — 1px vertical separator.

### TOC dropdown (article.css)

- `.article-toc-anchor` — `position: relative` wrapper around the TOC button, positions the dropdown.
- `.article-toc-toggle` — the TOC button itself. Hidden via `display: none !important` at `>=1320px` (when sidebar TOC is visible).
- `.article-toc-divider` — the divider before the TOC button. Also hidden at `>=1320px`.
- `.article-toc-dropdown` — absolutely positioned panel, `border-radius: 14px`, animated with framer-motion (scale from 0.92, origin top-left, 180ms S-curve ease).

## Adding a new view to the dock

1. Add the route type to the `Route` interface in `App.tsx` and `ChromeDock.tsx`.
2. In `ChromeDock.tsx`, add the visibility condition (e.g. `if (route.type === 'newview') return null` to hide, or add buttons inside the `<nav>`).
3. If the view needs to communicate with the dock, add a field to `ChromeContext`.
