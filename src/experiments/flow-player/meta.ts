import type { ExperimentMeta } from '../../core/Experiment.ts';

export const meta: ExperimentMeta = {
  slug: 'flow-player',
  title: 'Flow Player',
  description:
    'Branded video player for Vimeo and YouTube — custom controls, accent theming, optional GDPR 2-click consent. No third-party JS library, no streaming/DRM scaffolding (the iframes carry that). Designed for Webflow: pre-play layers (poster, play button, consent notice) live as Webflow elements; the runtime control bar is JS-rendered but every part is a Webflow class so designers can theme it from the Style panel.',
  tags: ['video', 'vimeo', 'youtube', 'player', 'webflow', 'gdpr'],
  date: '2026-05-06',
  hasArticle: false,
  draft: false,
};
