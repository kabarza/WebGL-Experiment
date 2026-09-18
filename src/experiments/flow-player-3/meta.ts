import type { ExperimentMeta } from '../../core/Experiment.ts';

export const meta: ExperimentMeta = {
  slug: 'flow-player-3',
  title: 'Flow Player 3',
  description:
    'Branded Vimeo + YouTube player. Toggle between JS-rendered controls (small Webflow tree, theme via CSS variables) and Webflow-elements controls (every button is a tree node, designer-editable). Auto-detects Vimeo account tier via oEmbed and falls back to the native player on free accounts. No SDKs — raw postMessage, ~12 KB gzipped.',
  tags: ['video', 'vimeo', 'youtube', 'player', 'webflow', 'gdpr'],
  date: '2026-05-13',
  hasArticle: false,
  draft: false,
};
