// ============================================================
// App — Root component with History API routing
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { DialRoot } from 'dialkit';
import { Gallery } from './components/Gallery.tsx';
import { ExperimentView } from './components/ExperimentView.tsx';
import { FlowFieldArticle } from './components/FlowFieldArticle.tsx';
import { ArticlePage } from './components/ArticlePage.tsx';
import { ChromeProvider } from './components/ChromeContext.tsx';
import { ChromeDock } from './components/ChromeDock.tsx';
import { ControlTuner } from './components/ControlTuner.tsx';

export interface Route {
  type: 'gallery' | 'experiment' | 'article' | 'tuner';
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

  if (path === '/tuner') {
    return { type: 'tuner' };
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

  // Chrome state — lifted from individual views so the dock persists
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // Reset chrome state on route change
  useEffect(() => {
    setExportOpen(false);
    setOverlayVisible(true);
  }, [route.type, route.slug]);

  const navigateToGallery = useCallback(() => {
    history.pushState(null, '', '/');
    setRoute({ type: 'gallery' });
  }, []);

  const navigateToExperiment = useCallback((slug: string) => {
    history.pushState(null, '', `/experiment/${slug}`);
    setRoute({ type: 'experiment', slug });
  }, []);

  const navigateToArticle = useCallback((slug: string) => {
    history.pushState(null, '', `/experiment/${slug}/article`);
    setRoute({ type: 'article', slug });
  }, []);

  return (
    <ChromeProvider>
      <ChromeDock
        route={route}
        onBack={navigateToGallery}
        onNavigateExperiment={navigateToExperiment}
        onNavigateArticle={navigateToArticle}
        overlayVisible={overlayVisible}
        setExportOpen={setExportOpen}
      />
      <AnimatePresence mode="wait">
        {route.type === 'tuner' ? (
          <ControlTuner key="tuner" />
        ) : route.type === 'gallery' ? (
          <Gallery key="gallery" />
        ) : route.type === 'article' && route.slug ? (
          route.slug === 'flow-field' ? (
            <FlowFieldArticle key="article-flow-field" />
          ) : (
            <ArticlePage key={`article-${route.slug}`} slug={route.slug} />
          )
        ) : route.slug ? (
          <ExperimentView
            key={route.slug}
            slug={route.slug}
            sharedParams={route.params}
            onBack={navigateToGallery}
            setOverlayVisible={setOverlayVisible}
            exportOpen={exportOpen}
            setExportOpen={setExportOpen}
          />
        ) : null}
      </AnimatePresence>
      {(route.type === 'experiment' || route.type === 'tuner') && (
        <DialRoot productionEnabled defaultOpen={window.innerWidth > 1000} />
      )}
    </ChromeProvider>
  );
}
