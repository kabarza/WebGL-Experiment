// ============================================================
// App — Root component with History API routing
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { DialRoot } from 'dialkit';
import { Gallery } from './components/Gallery.tsx';
import { ExperimentView } from './components/ExperimentView.tsx';
import { FlowFieldArticle } from './components/FlowFieldArticle.tsx';
import { CelestialFlareArticle } from './components/CelestialFlareArticle.tsx';
import { Globe1Article } from './components/Globe1Article.tsx';
import { AuroraDriftArticle } from './components/AuroraDriftArticle.tsx';
import { ClapLensArticle } from './components/ClapLensArticle.tsx';
import { ArticlePage } from './components/ArticlePage.tsx';
import { isArticleVisible } from './experiments/registry.ts';
import { ChromeProvider } from './components/ChromeContext.tsx';
import { ChromeDock } from './components/ChromeDock.tsx';
import { ControlTuner } from './components/ControlTuner.tsx';
import { VisionView } from './vision/components/VisionView.tsx';
import { findVisionExperiment } from './vision/registry.ts';

export interface Route {
  type: 'gallery' | 'experiment' | 'article' | 'tuner' | 'vision';
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

  const visionMatch = path.match(/^\/vision\/([^?]+)$/);
  if (visionMatch) {
    return { type: 'vision', slug: visionMatch[1] };
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
    const isVision = !!findVisionExperiment(slug);
    const path = isVision ? `/vision/${slug}` : `/experiment/${slug}`;
    history.pushState(null, '', path);
    setRoute({ type: isVision ? 'vision' : 'experiment', slug });
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
        ) : route.type === 'vision' && route.slug ? (
          <VisionView
            key={`vision-${route.slug}`}
            slug={route.slug}
            onBack={navigateToGallery}
          />
        ) : route.type === 'article' && route.slug && isArticleVisible(route.slug) ? (
          route.slug === 'flow-field' ? (
            <FlowFieldArticle key="article-flow-field" />
          ) : route.slug === 'celestial-flare' ? (
            <CelestialFlareArticle key="article-celestial-flare" />
          ) : route.slug === 'aurora-drift' ? (
            <AuroraDriftArticle key="article-aurora-drift" />
          ) : route.slug === 'lens' ? (
            <ClapLensArticle key="article-lens" />
          ) : route.slug === 'globe-1' ? (
            <Globe1Article key="article-globe-1" />
          ) : (
            <ArticlePage key={`article-${route.slug}`} slug={route.slug} />
          )
        ) : route.type === 'article' ? (
          // Article hidden (draft) in production — fall back to gallery.
          <Gallery key="gallery-fallback" />
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
      {(route.type === 'experiment' || route.type === 'tuner' || route.type === 'vision') && (
        <DialRoot productionEnabled defaultOpen={window.innerWidth > 1000} />
      )}
    </ChromeProvider>
  );
}
