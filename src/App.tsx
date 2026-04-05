// ============================================================
// App — Root component with History API routing
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { DialRoot } from 'dialkit';
import { Gallery } from './components/Gallery.tsx';
import { ExperimentView } from './components/ExperimentView.tsx';
import { FlowFieldArticle } from './components/FlowFieldArticle.tsx';

interface Route {
  type: 'gallery' | 'experiment' | 'article';
  slug?: string;
  params?: string; // base64 encoded params from share URL
}

function parseRoute(): Route {
  const path = window.location.pathname;

  // Check article route first: /experiment/{slug}/article
  const articleMatch = path.match(/^\/experiment\/([^/]+)\/article$/);
  if (articleMatch) {
    return { type: 'article', slug: articleMatch[1] };
  }

  const match = path.match(/^\/experiment\/([^?]+)$/);
  if (match) {
    const slug = match[1];
    const searchParams = new URLSearchParams(window.location.search);
    return {
      type: 'experiment',
      slug,
      params: searchParams.get('v') || undefined,
    };
  }

  return { type: 'gallery' };
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  const navigateToGallery = useCallback(() => {
    history.pushState(null, '', '/');
    setRoute({ type: 'gallery' });
  }, []);

  const navigateToExperiment = useCallback((slug: string) => {
    history.pushState(null, '', `/experiment/${slug}`);
    setRoute({ type: 'experiment', slug });
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {route.type === 'gallery' ? (
          <Gallery key="gallery" />
        ) : route.type === 'article' && route.slug ? (
          <FlowFieldArticle
            key={`article-${route.slug}`}
            onBack={navigateToGallery}
            onViewExperiment={() => navigateToExperiment(route.slug!)}
          />
        ) : route.slug ? (
          <ExperimentView
            key={route.slug}
            slug={route.slug}
            sharedParams={route.params}
            onBack={navigateToGallery}
          />
        ) : null}
      </AnimatePresence>
      {route.type === 'experiment' && <DialRoot />}
    </>
  );
}
