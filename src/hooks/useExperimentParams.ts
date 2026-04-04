// ============================================================
// useExperimentParams — Bridge: DialKit controls → flat params object
// Maps DialKit-format config to a control panel and returns
// a mutable params object the experiment reads every frame.
// ============================================================

import { useDialKit, type DialConfig as DialKitConfig } from 'dialkit';
import { useRef, useEffect } from 'react';
import type { DialConfig } from '../core/Experiment.ts';

/**
 * Convert our DialConfig into DialKit's nested folder format.
 *
 * DialConfig format:
 *   { 'Noise Fill': { noiseScale: [0.4, 0.01, 5, 0.01], color1: '#1a6b42' } }
 *
 * DialKit expects:
 *   { 'Noise Fill': { _collapsed: true, noiseScale: [0.4, 0.01, 5, 0.01], color1: '#1a6b42' } }
 *
 * Our format is already 1:1 with DialKit — we just add _collapsed.
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
 * Flatten DialKit's returned nested object into a flat key-value map.
 * DialKit returns { 'Noise Fill': { noiseScale: 0.4, ... }, ... }
 * We need { noiseScale: 0.4, ... }
 */
function flattenDialValues(nested: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  for (const value of Object.values(nested)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === '_collapsed') continue;
        flat[k] = v;
      }
    }
  }

  return flat;
}

export function useExperimentParams(
  title: string,
  dialConfig: DialConfig | undefined,
  defaults: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  const schema = dialConfig ? dialConfigToDialKitSchema(dialConfig) : {};

  const dialValues = useDialKit(title, schema) as Record<string, unknown>;

  // Stable mutable ref — the experiment reads this every frame
  const paramsRef = useRef<Record<string, unknown>>({ ...defaults });

  // Sync DialKit values into the stable params object
  useEffect(() => {
    const current = paramsRef.current;
    const flat = flattenDialValues(dialValues);

    for (const [key, value] of Object.entries(flat)) {
      current[key] = value;
    }
  }, [dialValues]);

  // Apply overrides only when they change (version switch / shared URL)
  useEffect(() => {
    if (!overrides) return;
    const current = paramsRef.current;
    for (const [key, value] of Object.entries(overrides)) {
      current[key] = value;
    }
  }, [overrides]);

  return paramsRef.current;
}
