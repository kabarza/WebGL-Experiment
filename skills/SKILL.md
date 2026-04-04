---
name: dialkit
description: >
  How to use DialKit, a floating control panel library for React that provides sliders, toggles, color pickers, spring editors, select dropdowns, text inputs, and action buttons wired directly to UI values. Use this skill whenever the user mentions DialKit, useDialKit, DialRoot, wants to add real-time parameter tweaking controls to a React component, wants to tune spring animations or Motion transitions with a GUI, or asks about adding a control panel / parameter panel / tweaking UI to their React project. Also use this skill when the user wants to wire up sliders, toggles, or color pickers to component props for live editing, or when they mention "dialing in" interface values. Even if the user just says "add controls to this component" or "let me tweak these values in real time", this skill is likely the right fit.
---

# DialKit

DialKit is a floating control panel for React. It gives you sliders, toggles, color pickers, spring editors, select dropdowns, text inputs, and action buttons that wire directly to your UI values. It auto-detects control types from your config, is fully typed, and includes built-in presets and JSON export.

- **Repo**: https://github.com/joshpuckett/dialkit
- **Docs**: https://joshpuckett.me/dialkit
- **License**: MIT
- **Peer dependency**: `motion` (Motion for React)

---

## Installation

```bash
npm install dialkit motion
```

Then add `<DialRoot />` to the root layout as a **sibling** of `{children}` (not wrapping it), and import the stylesheet:

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

That's it. Now `useDialKit` is available in any component.

---

## Usage

Call `useDialKit(name, config, options?)` in any component. Each call creates a collapsible folder in the floating panel with controls auto-generated from the config object.

```tsx
import { useDialKit } from 'dialkit'
import { motion } from 'motion/react'

function Card() {
  const params = useDialKit('Card', {
    blur: [24, 0, 100],       // slider: [default, min, max]
    opacity: [0.8, 0, 1],
    columns: [3, 1, 6, 1],    // slider: [default, min, max, step]
    scale: 1.18,               // slider: auto-inferred range
    color: '#ff5500',          // color picker
    visible: true,             // toggle

    // Nested objects become collapsible folders
    shadow: {
      _collapsed: true,        // starts collapsed
      offsetY: [8, 0, 24],
      blur: [16, 0, 48],
    },

    // Spring editor with live curve preview
    spring: {
      type: 'spring',
      visualDuration: 0.3,
      bounce: 0.2,
    },
  })

  return (
    <motion.div
      style={{
        filter: `blur(${params.blur}px)`,
        opacity: params.visible ? params.opacity : 0,
        color: params.color,
        boxShadow: `0 ${params.shadow.offsetY}px ${params.shadow.blur}px rgba(0,0,0,0.2)`,
      }}
      animate={{ scale: params.scale }}
      transition={params.spring}
    />
  )
}
```

---

## Control Types

The config object determines what controls appear in the panel. DialKit auto-detects the control type from the shape of the value.

### Slider

Numbers create sliders. Three definition styles:

**Explicit range**: `[default, min, max]`
```ts
blur: [24, 0, 100]
```

**Explicit range with step**: `[default, min, max, step]`
```ts
blur: [24, 0, 100, 5]    // snaps in increments of 5
```

**Auto-inferred from a bare number**:
```ts
scale: 1.2
```

When using a bare number, DialKit infers min, max, and step based on the value:

| Value range | Inferred min/max     | Step |
|-------------|----------------------|------|
| 0-1         | 0 to 1               | 0.01 |
| 0-10        | 0 to value x 3       | 0.1  |
| 0-100       | 0 to value x 3       | 1    |
| 100+        | 0 to value x 3       | 10   |

When `step` is omitted from the array form, it's inferred from the range using the same logic.

Sliders support click-to-snap (with spring animation), drag with rubber-band overflow, and direct text editing (hover the value for 800ms, then click to type).

**Returns:** `number`

### Toggle

```ts
enabled: true
darkMode: false
```

Booleans create an Off/On segmented control.

**Returns:** `boolean`

### Text

```ts
title: 'Hello'                                                     // auto-detected
subtitle: { type: 'text', default: '', placeholder: 'Enter...' }   // explicit with placeholder
```

Non-hex strings are auto-detected as text inputs. Use the explicit form for a placeholder or empty default.

**Returns:** `string`

### Color

```ts
color: '#ff5500'                            // auto-detected from hex string
bg: { type: 'color', default: '#000' }      // explicit
```

Hex strings (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) are auto-detected as color pickers. Each color control has a text display (click to edit hex) and a swatch button that opens the native color picker.

**Returns:** `string` (hex color)

### Select

```ts
layout: {
  type: 'select',
  options: ['stack', 'fan', 'grid'],
  default: 'stack',
}
```

Options can be plain strings or `{ value, label }` objects for custom display text:

```ts
shape: {
  type: 'select',
  options: [
    { value: 'portrait', label: 'Portrait' },
    { value: 'square', label: 'Square' },
    { value: 'landscape', label: 'Landscape' },
  ],
  default: 'portrait',
}
```

If `default` is omitted, the first option is selected.

**Returns:** `string` (the selected option's value)

### Spring

Creates a visual spring editor with a live animation curve preview. Two modes are available, toggled in the UI:

**Time mode (simpler)**:
```ts
spring: { type: 'spring', visualDuration: 0.3, bounce: 0.2 }
```
`visualDuration` ranges 0.1-1s, `bounce` ranges 0-1. Ideal for most animations.

**Physics mode (more control)**:
```ts
spring: { type: 'spring', stiffness: 200, damping: 25, mass: 1 }
```
`stiffness` 1-1000, `damping` 1-100, `mass` 0.1-10. Full control over spring dynamics.

The returned config object is passed directly to Motion's `transition` prop:

```tsx
const p = useDialKit('Card', {
  spring: { type: 'spring', visualDuration: 0.5, bounce: 0.04 },
  x: [0, -200, 200],
})

<motion.div animate={{ x: p.x }} transition={p.spring} />
```

**Returns:** `SpringConfig` (pass directly to Motion)

### Action

```ts
const p = useDialKit('Controls', {
  shuffle: { type: 'action' },
  reset: { type: 'action', label: 'Reset All' },
}, {
  onAction: (path) => {
    if (path === 'shuffle') shuffleItems()
    if (path === 'reset') resetToDefaults()
  },
})
```

Action buttons trigger callbacks without storing any value. The `label` defaults to the formatted key name (camelCase becomes Title Case). Multiple adjacent actions are grouped vertically.

### Folder

Any nested plain object becomes a collapsible folder. Folders can nest arbitrarily deep.

```ts
shadow: {
  blur: [10, 0, 50],
  opacity: [0.25, 0, 1],
  color: '#000000',
}

// Access nested values:
params.shadow.blur     // number
params.shadow.color    // string
```

Folders are open by default. Add `_collapsed: true` to start a folder closed. This is a reserved metadata key that controls the UI only and won't appear in returned values.

```ts
shadow: {
  _collapsed: true,    // folder starts closed
  blur: [10, 0, 50],
  opacity: [0.25, 0, 1],
}
```

---

## API Reference

### useDialKit

```ts
const params = useDialKit(name, config, options?)
```

| Param           | Type                      | Description                                  |
|-----------------|---------------------------|----------------------------------------------|
| `name`          | `string`                  | Panel folder title displayed in the UI       |
| `config`        | `DialConfig`              | Parameter definitions (see Control Types)    |
| `options.onAction` | `(path: string) => void` | Callback when action buttons are clicked    |

Returns a fully typed reactive object matching your config shape with live values. Updating a control in the UI immediately updates the returned values.

### DialRoot

```tsx
<DialRoot position="top-right" />
```

| Prop       | Type                                                              | Default       |
|------------|-------------------------------------------------------------------|---------------|
| `position` | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'`   | `'top-right'` |

Mount once at your app root as a sibling of `{children}`, not wrapping it. The panel renders via a portal on `document.body`. It collapses to a small icon button and expands to 280px wide on click.

---

## Panel Toolbar

When the panel is open, the toolbar provides:

- **Presets**: A version dropdown for saving and loading parameter snapshots. Click "+" to save the current state as a new version. Select a version to load it. Changes auto-save to the active version. "Version 1" always represents the original defaults.
- **Copy**: Exports the current values as JSON to your clipboard.

---

## TypeScript Types

All config and value types are exported:

```ts
import type {
  SpringConfig,
  ActionConfig,
  SelectConfig,
  ColorConfig,
  TextConfig,
  DialConfig,
  DialValue,
  ResolvedValues,
  ControlMeta,
  PanelConfig,
  Preset,
} from 'dialkit'
```

Return values are fully typed: `params.blur` infers as `number`, `params.color` as `string`, `params.spring` as `SpringConfig`, `params.shadow` as a nested object, etc.

---

## Full Example

```tsx
import { useDialKit } from 'dialkit'
import { motion } from 'motion/react'

function PhotoStack() {
  const p = useDialKit('Photo Stack', {
    // Text inputs
    title: 'Japan',
    subtitle: { type: 'text', default: 'December 2025', placeholder: 'Enter subtitle...' },

    // Color pickers
    accentColor: '#c41e3a',
    shadowTint: { type: 'color', default: '#000000' },

    // Select dropdown
    layout: { type: 'select', options: ['stack', 'fan', 'grid'], default: 'stack' },

    // Grouped sliders in a folder
    backPhoto: {
      offsetX: [239, 0, 400],
      offsetY: [0, 0, 150],
      scale: [0.7, 0.5, 0.95],
      overlayOpacity: [0.6, 0, 1],
    },

    // Spring config for Motion
    transitionSpring: { type: 'spring', visualDuration: 0.5, bounce: 0.04 },

    // Toggle
    darkMode: false,

    // Action buttons
    next: { type: 'action' },
    previous: { type: 'action' },
  }, {
    onAction: (action) => {
      if (action === 'next') goNext()
      if (action === 'previous') goPrevious()
    },
  })

  return (
    <motion.div
      animate={{ x: p.backPhoto.offsetX }}
      transition={p.transitionSpring}
      style={{ color: p.accentColor }}
    >
      <h1>{p.title}</h1>
      <p>{p.subtitle}</p>
    </motion.div>
  )
}
```

---

## Common Patterns

### Adding DialKit to an existing animation

When a user has an existing component with animations and wants to add live tweaking:
1. Identify the hardcoded values (spring params, offsets, colors, etc.)
2. Replace them with a `useDialKit` config using sensible defaults matching the current values
3. Wire the returned params into the component's style/animate/transition props

### Organizing controls with folders

Group related controls into nested objects. For example, put shadow-related sliders in a `shadow: {}` folder. Use `_collapsed: true` for secondary controls to keep the panel tidy.

### Using spring configs with Motion

The spring config returned by `useDialKit` can be passed directly to Motion's `transition` prop. Start with Time mode (`visualDuration` + `bounce`) for simplicity. Use Physics mode (`stiffness` + `damping` + `mass`) when you need finer control.
