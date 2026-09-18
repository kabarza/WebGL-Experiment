import type { ExperimentMeta } from '../../core/Experiment.ts';

export const meta: ExperimentMeta = {
  slug: 'vimeo-native',
  title: 'Vimeo Native',
  description:
    'Inline Vimeo player with zero external dependencies. Aspect ratio, autoplay, loop, mute, controls visibility, and accent color are all driven by Vimeo iframe URL params + CSS — no Plyr, no CDN script, no library to load. The Webflow component is ~600 bytes of HTML/CSS plus a tiny init script that reads `data-vimeo-url` from each instance.',
  tags: ['video', 'vimeo', 'native', 'iframe', 'webflow', 'no-deps'],
  date: '2026-05-06',
  hasArticle: false,
  draft: false,
};
