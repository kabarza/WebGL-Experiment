// ============================================================
// ArticlePage — Generic article shell with empty state
// Used for experiments that have hasArticle: true but no
// dedicated article component yet.
// ============================================================

import { motion } from 'motion/react';
import { findExperiment } from '../experiments/registry.ts';

interface ArticlePageProps {
  slug: string;
}

export function ArticlePage({ slug }: ArticlePageProps) {
  const experiment = findExperiment(slug);
  const title = experiment?.meta.title ?? slug;

  return (
    <motion.div
      className="article-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <header className="article-hero">
        <p className="article-hero-eyebrow">Deep Dive</p>
        <h1>{title}</h1>
        <p className="article-hero-lead">
          Article coming soon.
        </p>
      </header>

      <div className="article-body">
        <div className="article-empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.15 }}>
            <rect x="8" y="4" width="32" height="40" rx="3" />
            <path d="M16 16h16M16 23h12M16 30h8" />
          </svg>
          <p>This article is a blank canvas — content will be added here.</p>
        </div>
      </div>
    </motion.div>
  );
}
