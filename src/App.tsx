// ============================================================
// App — Root component with History API routing
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'motion/react';
import { DialRoot } from 'dialkit';
import { Gallery } from './components/Gallery.tsx';
import { ExperimentView } from './components/ExperimentView.tsx';

interface Route {
  type: 'gallery' | 'experiment';
  slug?: string;
  params?: string; // base64 encoded params from share URL
}

function parseRoute(): Route {
  const path = window.location.pathname;
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

  return (
    <>
      <AnimatePresence mode="wait">
        {route.type === 'gallery' ? (
          <Gallery key="gallery" />
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
