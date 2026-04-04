# DialKit — Floating Control Panel for React

Use DialKit to add real-time parameter tweaking controls (sliders, toggles, color pickers, spring editors, selects, text inputs, action buttons) to any React component.

## When to Use
- User mentions DialKit, useDialKit, DialRoot
- User wants to add a control panel / parameter panel / tweaking UI
- User wants to wire up sliders, toggles, or color pickers to component props for live editing
- User says "add controls to this component" or "let me tweak these values"
- User wants to tune spring animations or Motion transitions with a GUI

## Setup

```bash
npm install dialkit motion
```

Add `<DialRoot />` to the root layout as a **sibling** of `{children}`:

```tsx
import { DialRoot } from 'dialkit'
import 'dialkit/styles.css'

export default function Layout({ children }) {
  return (
    <>
      {children}
      <DialRoot />
    </>
  )
}
```

## Usage

```tsx
import { useDialKit } from 'dialkit'

const params = useDialKit('Card', {
  blur: [24, 0, 100],          // slider: [default, min, max]
  columns: [3, 1, 6, 1],       // slider: [default, min, max, step]
  scale: 1.18,                  // slider: auto-inferred range
  color: '#ff5500',             // color picker
  visible: true,                // toggle
  title: 'Hello',               // text input
  layout: { type: 'select', options: ['stack', 'fan', 'grid'], default: 'stack' },
  spring: { type: 'spring', visualDuration: 0.3, bounce: 0.2 },
  reset: { type: 'action' },
  shadow: {                     // nested folder
    _collapsed: true,
    offsetY: [8, 0, 24],
    blur: [16, 0, 48],
  },
}, {
  onAction: (path) => {
    if (path === 'reset') resetDefaults()
  },
})
```

## Control Types

| Config Value | Control | Returns |
|---|---|---|
| `[default, min, max]` or `[default, min, max, step]` | Slider | `number` |
| Bare number (e.g. `1.2`) | Slider (auto-range) | `number` |
| `true` / `false` | Toggle | `boolean` |
| `'#hex'` string | Color picker | `string` |
| Non-hex string | Text input | `string` |
| `{ type: 'select', options: [...] }` | Select dropdown | `string` |
| `{ type: 'spring', ... }` | Spring editor | `SpringConfig` |
| `{ type: 'action' }` | Button | — (uses onAction callback) |
| Nested object | Collapsible folder | nested object |

## Auto-Inferred Slider Ranges (bare numbers)

| Value | Min/Max | Step |
|---|---|---|
| 0–1 | 0 to 1 | 0.01 |
| 0–10 | 0 to value×3 | 0.1 |
| 0–100 | 0 to value×3 | 1 |
| 100+ | 0 to value×3 | 10 |

## Key Details
- **Repo**: https://github.com/joshpuckett/dialkit
- **Peer dep**: `motion` (Motion for React)
- Spring configs pass directly to Motion's `transition` prop
- `_collapsed: true` in a folder starts it collapsed
- Panel toolbar has presets (save/load snapshots) and JSON copy
- Refer to `~/.claude/skills/dialkit.skill` for full API reference
