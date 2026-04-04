// ============================================================
// Experiment auto-discovery via import.meta.glob
// Drop a new folder in experiments/, it appears automatically.
// ============================================================

import type { Experiment } from '../core/Experiment.ts';

const modules = import.meta.glob<{ experiment: Experiment }>(
  './*/index.ts',
  { eager: true },
);

export const experiments: Experiment[] = Object.values(modules)
  .map((m) => m.experiment)
  .sort((a, b) => b.meta.date.localeCompare(a.meta.date));

export function findExperiment(slug: string): Experiment | undefined {
  return experiments.find((e) => e.meta.slug === slug);
}
