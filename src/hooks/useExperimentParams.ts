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
import type { DialConfig } from '../core/Experiment.ts';
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
 * Inject cached / override values into the DialConfig so that
 * DialKit initialises with the persisted state, not the defaults.
 *
 * For sliders `[default, min, max, step]` the first element is replaced.
 * For booleans, strings (colours) etc. the value is replaced directly.
 */
function applyOverridesToConfig(
  config: DialConfig,
  overrides: Record<string, unknown>,
): DialConfig {
  const result: DialConfig = {};

  for (const [folderName, params] of Object.entries(config)) {
    const folder: Record<string, unknown> = {};

    for (const [key, spec] of Object.entries(
      params as Record<string, unknown>,
    )) {
      const cached = overrides[key];

      if (cached !== undefined) {
        if (
          Array.isArray(spec) &&
          spec.length <= 4 &&
          typeof spec[0] === 'number'
        ) {
          // Slider tuple — replace default (index 0), keep min/max/step
          folder[key] = [cached, ...spec.slice(1)];
        } else {
          // Colour, boolean, string, etc.
          folder[key] = cached;
        }
      } else {
        folder[key] = spec;
      }
    }

    result[folderName] = folder;
  }

  return result;
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

  for (const value of Object.values(nested)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Skip action configs — they are not experiment params
      const obj = value as Record<string, unknown>;
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
 * DialKit paths are `FolderName.key`.
 */
function buildPathMap(config: DialConfig): Map<string, string> {
  const map = new Map<string, string>();
  for (const [folderName, params] of Object.entries(config)) {
    for (const key of Object.keys(params as Record<string, unknown>)) {
      map.set(key, `${folderName}.${key}`);
    }
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
): UseExperimentParamsResult {
  // ── Compute initial config ONCE, baking in cached values ───
  const [initialConfig] = useState(() => {
    const cached = loadParamCache(slug);
    // Priority: explicit overrides (version / shared URL) > cache > defaults
    const initial = overrides ?? cached;
    if (!dialConfig || !initial) return dialConfig;
    return applyOverridesToConfig(dialConfig, initial);
  });

  const schema = initialConfig
    ? dialConfigToDialKitSchema(initialConfig)
    : {};

  // ── Stable refs for defaults & original config ─────────────
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const dialConfigRef = useRef(dialConfig);
  dialConfigRef.current = dialConfig;
  const slugRef = useRef(slug);
  slugRef.current = slug;

  // ── Path map for programmatic DialStore updates ────────────
  const [pathMap] = useState(() =>
    dialConfig ? buildPathMap(dialConfig) : new Map<string, string>(),
  );

  // ── "Reset to Defaults" action ─────────────────────────────
  const handleAction = useCallback(
    (action: string) => {
      if (action !== 'Reset to Defaults') return;

      const cfg = dialConfigRef.current;
      const defs = defaultsRef.current;
      if (!cfg) return;

      // Clear the localStorage cache
      clearParamCache(slugRef.current);

      // Find our panel and reset every value through DialStore
      const panels = DialStore.getPanels();
      const panel = panels.find((p) => p.name === title);
      if (!panel) return;

      for (const [key, defaultValue] of Object.entries(defs)) {
        const path = pathMap.get(key);
        if (path) {
          DialStore.updateValue(
            panel.id,
            path,
            defaultValue as import('dialkit').DialValue,
          );
        }
      }
    },
    [title, pathMap],
  );

  // Append the reset action to the schema
  const schemaWithAction: DialKitConfig = {
    ...schema,
    'Reset to Defaults': { type: 'action' as const } as unknown as DialKitConfig,
  };

  // ── DialKit hook ───────────────────────────────────────────
  const dialValues = useDialKit(title, schemaWithAction, {
    onAction: handleAction,
  }) as Record<string, unknown>;

  // ── Stable mutable ref — the experiment reads this every frame ──
  const paramsRef = useRef<Record<string, unknown>>({ ...defaults });

  // Sync DialKit values → paramsRef + persist to localStorage
  useEffect(() => {
    const current = paramsRef.current;
    const flat = flattenDialValues(dialValues);

    for (const [key, value] of Object.entries(flat)) {
      current[key] = value;
    }

    // Only cache keys present in defaults (skip actions, etc.)
    const defs = defaultsRef.current;
    const toCache: Record<string, unknown> = {};
    for (const key of Object.keys(defs)) {
      if (key in current) toCache[key] = current[key];
    }
    saveParamCache(slugRef.current, toCache);
  }, [dialValues]);

  // Apply explicit overrides when they change (version switch / shared URL)
  useEffect(() => {
    if (!overrides) return;
    const current = paramsRef.current;
    for (const [key, value] of Object.entries(overrides)) {
      current[key] = value;
    }
  }, [overrides]);

  return { params: paramsRef.current };
}
