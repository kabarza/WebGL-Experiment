// ============================================================
// App — Root component with hash-based routing
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
  const hash = window.location.hash.slice(1) || '/';
  const match = hash.match(/^\/experiment\/([^?]+)(?:\?(.*))?$/);

  if (match) {
    const slug = match[1];
    const searchParams = new URLSearchParams(match[2] || '');
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
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigateToGallery = useCallback(() => {
    window.location.hash = '/';
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
