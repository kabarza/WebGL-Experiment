import type { ExperimentMeta } from '../../core/Experiment.ts';

export const meta: ExperimentMeta = {
  slug: 'flow-player-4',
  title: 'Flow Player 4',
  description:
    'Branded video player for Webflow with four source types — Vimeo, YouTube, HLS streaming (.m3u8 via hls.js), and plain MP4/WebM. URL auto-detection picks the right provider. Designer chooses JS-rendered or Webflow-elements UI mode in DialKit. Distributed as a small JSON paste + a CDN-hosted runtime — no project-corrupting tree gymnastics. Consolidates everything learned from v1/v2/v3 plus the working patterns from flowplayplus and Osmo.',
  tags: ['video', 'vimeo', 'youtube', 'hls', 'webflow', 'player'],
  date: '2026-05-16',
  hasArticle: false,
  draft: false,
};
