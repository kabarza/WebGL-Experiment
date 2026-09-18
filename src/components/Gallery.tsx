// ============================================================
// Gallery — Grid of ExperimentCards with Experiments/Vision tabs
// ============================================================

import { useState } from 'react';
import { motion } from 'motion/react';
import { experiments } from '../experiments/registry.ts';
import { visionExperiments } from '../vision/registry.ts';
import { ExperimentCard } from './ExperimentCard.tsx';

type Tab = 'experiments' | 'vision';

interface GalleryProps {
  onOpenBrand?: () => void;
}

export function Gallery({ onOpenBrand }: GalleryProps = {}) {
  const [tab, setTab] = useState<Tab>('experiments');

  const items = tab === 'experiments' ? experiments : visionExperiments;
  const routePrefix = tab === 'experiments' ? '/experiment' : '/vision';

  return (
    <motion.div
      className="gallery"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      <header className="gallery-header">
        <h1 className="gallery-title">Experiments</h1>
        <p className="gallery-subtitle">WebGPU Experiment Showcase</p>
        {onOpenBrand && (
          <button className="gallery-brand-link" onClick={onOpenBrand}>
            Open Brand Tool →
          </button>
        )}
      </header>
      <div className="gallery-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'experiments'}
          className={`gallery-tab${tab === 'experiments' ? ' active' : ''}`}
          onClick={() => setTab('experiments')}
        >
          Experiments
        </button>
        <button
          role="tab"
          aria-selected={tab === 'vision'}
          className={`gallery-tab${tab === 'vision' ? ' active' : ''}`}
          onClick={() => setTab('vision')}
        >
          Vision
        </button>
      </div>
      {items.length === 0 ? (
        <p className="gallery-subtitle" style={{ padding: '24px 0' }}>
          No experiments yet in this category.
        </p>
      ) : (
        <div className="gallery-grid">
          {items.map((exp) => (
            <ExperimentCard
              key={exp.meta.slug}
              meta={exp.meta}
              onClick={() => {
                history.pushState(null, '', `${routePrefix}/${exp.meta.slug}`);
                window.dispatchEvent(new PopStateEvent('popstate'));
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
