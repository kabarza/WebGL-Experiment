// ============================================================
// Gallery — Grid of ExperimentCards (React)
// ============================================================

import { motion } from 'motion/react';
import { experiments } from '../experiments/registry.ts';
import { ExperimentCard } from './ExperimentCard.tsx';

export function Gallery() {
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
      </header>
      <div className="gallery-grid">
        {experiments.map((exp) => (
          <ExperimentCard
            key={exp.meta.slug}
            meta={exp.meta}
            onClick={() => {
              history.pushState(null, '', `/experiment/${exp.meta.slug}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
