// ============================================================
// useExperimentParams — Bridge: DialKit controls → flat params object
// Maps DialKit-format config to a control panel and returns
// a mutable params object the experiment reads every frame.
//
// Persists control changes to localStorage so they survive
// navigation (gallery ↔ experiment ↔ article). Includes a
// "Reset to Defaults" action inside the DialKit panel.
// ============================================================

import {
  useDialKit,
  DialStore,
  type DialConfig as DialKitConfig,
} from 'dialkit';
import { useRef, useEffect, useCallback, useState } from 'react';
import type { DialConfig, VisibilityRule } from '../core/Experiment.ts';
import {
  saveParamCache,
  loadParamCache,
  clearParamCache,
} from '../lib/paramCache.ts';

// ── helpers ──────────────────────────────────────────────────

/**
 * Convert our DialConfig into DialKit's nested folder format.
 * Adds `_collapsed: true` to each folder.
 */
function dialConfigToDialKitSchema(config: DialConfig): DialKitConfig {
  const schema: DialKitConfig = {};

  for (const [folderName, params] of Object.entries(config)) {
    schema[folderName] = {
      _collapsed: true,
      ...params,
    } as DialKitConfig;
  }

  return schema;
}

/**
 * Check whether a config value is a typed object config
 * (ub-*, select, color, text, action, spring, easing).
 */
function isTypedConfig(spec: unknown): spec is { type: string; [k: string]: unknown } {
  return (
    typeof spec === 'object' &&
    spec !== null &&
    !Array.isArray(spec) &&
    'type' in spec &&
    typeof (spec as Record<string, unknown>).type === 'string'
  );
}

/**
 * Inject cached / override values into the DialConfig so that
 * DialKit initialises with the persisted state, not the defaults.
 *
 * Handles every config shape that DialKit supports:
 *  - [default, min, max, step]   → replace index 0
 *  - plain number/boolean/string → replace directly
 *  - { type: 'ub-*', default }  → replace .default
 *  - { type: 'select', default } → replace .default
 *  - { type: 'color', default }  → replace .default
 *  - { type: 'text', default }   → replace .default
 *  - { type: 'spring|easing' }   → replace entire value
 *  - { type: 'action' }          → skip (not a value)
 *  - nested sub-folder object    → recurse
 */
function applyValuesToConfig(
  config: DialConfig,
  values: Record<string, unknown>,
): DialConfig {
  const result: DialConfig = {};

  for (const [folderName, folderParams] of Object.entries(config)) {
    result[folderName] = applyToFolder(
      folderParams as Record<string, unknown>,
      values,
    );
  }

  return result;
}

function applyToFolder(
  folder: Record<string, unknown>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, spec] of Object.entries(folder)) {
    const cached = values[key];

    // Slider tuple: [default, min, max, step?]
    if (
      Array.isArray(spec) &&
      spec.length <= 4 &&
      typeof spec[0] === 'number'
    ) {
      out[key] =
        cached !== undefined ? [cached, ...spec.slice(1)] : spec;
      continue;
    }

    // Typed object config
    if (isTypedConfig(spec)) {
      const t = spec.type;

      // Action — no user value, pass through
      if (t === 'action') {
        out[key] = spec;
        continue;
      }

      // Spring / easing — replace the whole transition config
      if (t === 'spring' || t === 'easing') {
        out[key] = cached !== undefined ? cached : spec;
        continue;
      }

      // ub-*, select, color, text — replace the .default field
      if (cached !== undefined) {
        out[key] = { ...spec, default: cached };
      } else {
        out[key] = spec;
      }
      continue;
    }

    // Plain primitives (number, boolean, hex string)
    if (
      typeof spec === 'number' ||
      typeof spec === 'boolean' ||
      typeof spec === 'string'
    ) {
      out[key] = cached !== undefined ? cached : spec;
      continue;
    }

    // Nested sub-folder — recurse
    if (typeof spec === 'object' && spec !== null) {
      out[key] = applyToFolder(spec as Record<string, unknown>, values);
      continue;
    }

    // Fallback
    out[key] = spec;
  }

  return out;
}

/**
 * Extract flat default values from the dialConfig, matching exactly
 * what DialKit's flattenValues produces. Used by Reset to Defaults
 * so the restored values are bit-identical to DialKit's initial state.
 */
function extractDialDefaults(config: DialConfig): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  function walk(obj: Record<string, unknown>): void {
    for (const [key, spec] of Object.entries(obj)) {
      if (key === '_collapsed') continue;

      // Slider tuple
      if (
        Array.isArray(spec) &&
        spec.length <= 4 &&
        typeof spec[0] === 'number'
      ) {
        flat[key] = spec[0];
        continue;
      }

      // Typed config
      if (isTypedConfig(spec)) {
        const t = spec.type;
        if (t === 'action') continue;
        if (t === 'spring' || t === 'easing') {
          flat[key] = spec;
          continue;
        }
        if (t === 'select') {
          const opts = spec.options as (string | { value: string })[];
          const first = opts?.[0];
          flat[key] =
            spec.default ??
            (typeof first === 'string' ? first : first?.value);
          continue;
        }
        if (t === 'color') {
          flat[key] = spec.default ?? '#000000';
          continue;
        }
        if (t === 'text') {
          flat[key] = spec.default ?? '';
          continue;
        }
        // ub-* and ub-t*
        if (t.startsWith('ub-')) {
          flat[key] = spec.default ?? (t.match(/^ub-t/) ? false : 0);
          continue;
        }
        continue;
      }

      // Plain primitives
      if (
        typeof spec === 'number' ||
        typeof spec === 'boolean' ||
        typeof spec === 'string'
      ) {
        flat[key] = spec;
        continue;
      }

      // Nested sub-folder — recurse
      if (typeof spec === 'object' && spec !== null) {
        walk(spec as Record<string, unknown>);
        continue;
      }
    }
  }

  for (const folderParams of Object.values(config)) {
    walk(folderParams as Record<string, unknown>);
  }

  return flat;
}

/**
 * Flatten DialKit's returned nested object into a flat key-value map.
 * DialKit returns `{ 'Noise Fill': { noiseScale: 0.4, ... }, ... }`
 * We need        `{ noiseScale: 0.4, ... }`
 */
function flattenDialValues(
  nested: Record<string, unknown>,
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  for (const [, value] of Object.entries(nested)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      // Skip action configs — they are not experiment params
      if (obj.type === 'action') continue;

      for (const [k, v] of Object.entries(obj)) {
        if (k === '_collapsed') continue;
        flat[k] = v;
      }
    }
  }

  return flat;
}

/**
 * Build the DialKit path for a param key given the original DialConfig.
 * DialKit paths are `FolderName.key` (or `Folder.Sub.key` for nested).
 */
function buildPathMap(config: DialConfig): Map<string, string> {
  const map = new Map<string, string>();

  function walk(obj: Record<string, unknown>, prefix: string): void {
    for (const [key, spec] of Object.entries(obj)) {
      if (key === '_collapsed') continue;
      const path = prefix ? `${prefix}.${key}` : key;

      // Nested sub-folder — recurse
      if (
        typeof spec === 'object' &&
        spec !== null &&
        !Array.isArray(spec) &&
        !isTypedConfig(spec)
      ) {
        walk(spec as Record<string, unknown>, path);
        continue;
      }

      // Leaf control — record mapping
      map.set(key, path);
    }
  }

  for (const [folderName, params] of Object.entries(config)) {
    walk(params as Record<string, unknown>, folderName);
  }

  return map;
}

// ── hook ─────────────────────────────────────────────────────

export interface UseExperimentParamsResult {
  params: Record<string, unknown>;
}

export function useExperimentParams(
  title: string,
  dialConfig: DialConfig | undefined,
  defaults: Record<string, unknown>,
  slug: string,
  overrides?: Record<string, unknown>,
  visibility?: Record<string, VisibilityRule>,
): UseExperimentParamsResult {
  // ── Compute the DialKit-derived defaults ONCE ──────────────
  const [dialDefaults] = useState(() =>
    dialConfig ? extractDialDefaults(dialConfig) : defaults,
  );

  // ── Path map for programmatic DialStore updates ────────────
  const [pathMap] = useState(() =>
    dialConfig ? buildPathMap(dialConfig) : new Map<string, string>(),
  );

  // ── Compute initial config ONCE, baking in cached values ───
  const [initialConfig] = useState(() => {
    const cached = loadParamCache(slug);
    // Priority: explicit overrides (shared URL / non-default version) > cache > raw config
    const initial = overrides ?? cached;
    if (!dialConfig || !initial) return dialConfig;
    return applyValuesToConfig(dialConfig, initial);
  });

  const schema = initialConfig
    ? dialConfigToDialKitSchema(initialConfig)
    : {};

  // ── Stable refs ────────────────────────────────────────────
  const slugRef = useRef(slug);
  slugRef.current = slug;
  const dialConfigRef = useRef(dialConfig);
  dialConfigRef.current = dialConfig;

  // ── "Reset to Defaults" action ─────────────────────────────
  const handleAction = useCallback(
    (action: string) => {
      if (action !== 'Settings.Reset to Defaults') {
        // Forward experiment-specific actions via the mutable params object
        // so the experiment's render loop can react to them.
        paramsRef.current._action = action;
        paramsRef.current._actionTs = Date.now();
        return;
      }

      // Clear the localStorage cache
      clearParamCache(slugRef.current);

      // Find our panel and reset every value through DialStore
      const panels = DialStore.getPanels();
      const panel = panels.find((p) => p.name === title);
      if (!panel) return;

      for (const [key, defaultValue] of Object.entries(dialDefaults)) {
        const path = pathMap.get(key);
        if (path) {
          DialStore.updateValue(
            panel.id,
            path,
            defaultValue as import('dialkit').DialValue,
          );
        }
      }

      // Signal reset to experiments so they can clear transient state
      // (uploaded assets, video elements, etc.)
      paramsRef.current._resetTs = Date.now();
    },
    [title, pathMap, dialDefaults],
  );

  // Append the reset action inside a folder
  const schemaWithAction: DialKitConfig = {
    ...schema,
    Settings: {
      'Reset to Defaults': { type: 'action' as const },
    } as unknown as DialKitConfig,
  };

  // ── DialKit hook ───────────────────────────────────────────
  const dialValues = useDialKit(title, schemaWithAction, {
    onAction: handleAction,
  }) as Record<string, unknown>;

  // ── Stable mutable ref — the experiment reads this every frame ──
  const paramsRef = useRef<Record<string, unknown>>({ ...defaults });

  // ── Track active DialKit preset ─────────────────────────────
  // `undefined` = not yet observed (skip first run); `null` = DialKit has no active preset
  const lastPresetIdRef = useRef<string | null | undefined>(undefined);

  // Sync DialKit values → paramsRef + persist to localStorage
  useEffect(() => {
    const current = paramsRef.current;
    const flat = flattenDialValues(dialValues);

    for (const [key, value] of Object.entries(flat)) {
      current[key] = value;
    }

    // Expose active DialKit preset ID so experiments can key
    // per-preset storage (e.g. uploaded assets per preset).
    const panels = DialStore.getPanels();
    const panel = panels.find((p) => p.name === title);
    if (panel) {
      const presetId = DialStore.getActivePresetId(panel.id);
      const prevPresetId = lastPresetIdRef.current;
      current._presetId = presetId ?? '';

      // Signal preset change so experiments can react.
      // Skip the very first observation (prevPresetId === undefined).
      if (prevPresetId !== undefined && presetId !== prevPresetId) {
        current._prevPresetId = prevPresetId ?? '';
        current._presetChanged = Date.now();
      }
      lastPresetIdRef.current = presetId;
    }

    // Only cache keys that are actual experiment params (skip actions, etc.)
    const toCache: Record<string, unknown> = {};
    for (const key of Object.keys(dialDefaults)) {
      if (key in current) toCache[key] = current[key];
    }
    saveParamCache(slugRef.current, toCache);
  }, [dialValues, dialDefaults, title]);

  // Apply explicit overrides when they change (version switch / shared URL)
  useEffect(() => {
    if (!overrides) return;
    const current = paramsRef.current;
    for (const [key, value] of Object.entries(overrides)) {
      current[key] = value;
    }
  }, [overrides]);

  // ── Conditional visibility ────────────────────────────────
  // Hide / show DialKit controls based on the current value of
  // a controlling param (e.g. hide "progress" when playMode is
  // "Auto Play").
  const visibilityRef = useRef(visibility);
  visibilityRef.current = visibility;

  useEffect(() => {
    const rules = visibilityRef.current;
    if (!rules) return;

    // DialKit formats camelCase keys into Title Case labels.
    const formatLabel = (key: string) =>
      key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();

    // Collect all label elements inside DialKit panels.
    const labelSelectors = [
      '.dialkit-slider-label',
      '.dialkit-labeled-control-label',
      '.dialkit-select-label',
    ];

    // Walk the wrapper classes to find the hide-able row element.
    const wrapperClasses = [
      'dialkit-slider-wrapper',
      'dialkit-labeled-control',
      'dialkit-select-row',
    ];

    function findControlRow(label: string): HTMLElement | null {
      for (const sel of labelSelectors) {
        const els = document.querySelectorAll<HTMLElement>(sel);
        for (const el of els) {
          if (el.textContent?.trim() === label) {
            // Walk up to the wrapper row
            let node: HTMLElement | null = el;
            while (node) {
              if (wrapperClasses.some((c) => node!.classList.contains(c))) return node;
              node = node.parentElement;
            }
          }
        }
      }
      return null;
    }

    const rulesEntries = Object.entries(rules!);

    function applyVisibility() {
      const params = paramsRef.current;
      for (const [key, rule] of rulesEntries) {
        const label = formatLabel(key);
        const row = findControlRow(label);
        if (row) {
          const visible = params[rule.when] === rule.is;
          row.style.display = visible ? '' : 'none';
        }
      }
    }

    // Apply immediately and on every DialStore change.
    // Small delay to let Svelte render first.
    const timer = setTimeout(applyVisibility, 50);

    const panels = DialStore.getPanels();
    const panel = panels.find((p) => p.name === title);
    const unsub = panel
      ? DialStore.subscribe(panel.id, applyVisibility)
      : undefined;

    return () => {
      clearTimeout(timer);
      unsub?.();
    };
  }, [title, dialValues]);

  return { params: paramsRef.current };
}
