import type { VisionExperimentDefinition } from './core/VisionExperiment';
import { lens } from './experiments/lens/experiment';

export const visionExperiments: VisionExperimentDefinition[] = [lens];

export function findVisionExperiment(slug: string): VisionExperimentDefinition | undefined {
  return visionExperiments.find((e) => e.meta.slug === slug);
}
