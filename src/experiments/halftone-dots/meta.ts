import type { ExperimentMeta } from '../../core/Experiment.ts';

export const meta: ExperimentMeta = {
  slug: 'halftone-dots',
  title: 'halftone dots',
  description:
    'Halftone dot grid effect. Divides a source image into a grid of anti-aliased circles — radius driven by pixel luminance or fixed. Mouse wheel controls grid density.',
  tags: ['halftone', 'shader', 'image-processing', 'sdf'],
  date: '2026-04-13',
  hasArticle: false,
};
