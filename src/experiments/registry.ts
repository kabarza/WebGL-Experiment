// ============================================================
// Experiment auto-discovery via import.meta.glob
// Drop a new folder in experiments/, it appears automatically.
// ============================================================

import type { Experiment } from '../core/Experiment.ts';

const modules = import.meta.glob<{ experiment: Experiment }>(
  './*/index.ts',
  { eager: true },
);

// All discovered experiments, including drafts. Useful in dev for the
// publish-toggle UI; production code paths should use `experiments`.
export const allExperiments: Experiment[] = Object.values(modules)
  .map((m) => m.experiment)
  .sort((a, b) => b.meta.date.localeCompare(a.meta.date));

// Production-visible experiments. Drafts are stripped from the
// gallery in `npm run build` because Vite substitutes
// `import.meta.env.DEV` with the literal `false`, which the
// minifier folds into the filter.
export const experiments: Experiment[] = allExperiments.filter(
  (e) => import.meta.env.DEV || !e.meta.draft,
);

export function findExperiment(slug: string): Experiment | undefined {
  return experiments.find((e) => e.meta.slug === slug);
}

/** True if the article for this experiment should render right now. */
export function isArticleVisible(slug: string): boolean {
  const exp = allExperiments.find((e) => e.meta.slug === slug);
  if (!exp || !exp.meta.hasArticle) return false;
  if (import.meta.env.DEV) return true;
  return !exp.meta.draft && !exp.meta.articleDraft;
}
