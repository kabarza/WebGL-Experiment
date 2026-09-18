import type { ExperimentMeta } from '../../core/Experiment.ts';

export const meta: ExperimentMeta = {
  slug: 'flow-player-2',
  title: 'Flow Player 2',
  description:
    'HTML5-native video player whose entire UI lives as Webflow elements — play/pause buttons, progress bar, time labels, settings menu, even both icon states all sit in the canvas as real nodes you can restyle, hide, or replace from the Designer. The runtime script just listens to data-video="…" attributes and flips a data-state on the wrapper; CSS does the rest. Multiple instances on a page are independent. Designed to drop in the Webflow JSON via the paste flow.',
  tags: ['video', 'html5', 'player', 'webflow', 'multi-instance'],
  date: '2026-05-07',
  hasArticle: false,
  draft: false,
};
