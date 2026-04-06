// ============================================================
// ExperimentCard — Thumbnail, title, description, tags
// ============================================================

import { useState } from 'react';
import type { ExperimentMeta } from '../core/Experiment.ts';

function getCachedThumbnail(slug: string): string | null {
  try {
    return localStorage.getItem(`webgl-thumb/${slug}`);
  } catch {
    return null;
  }
}

interface ExperimentCardProps {
  meta: ExperimentMeta;
  onClick: () => void;
}

export function ExperimentCard({ meta, onClick }: ExperimentCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const cachedThumb = getCachedThumbnail(meta.slug);
  const thumbSrc = imgFailed ? cachedThumb : (meta.thumbnail ?? cachedThumb);

  return (
    <article
      className="experiment-card"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {thumbSrc ? (
        <div className="card-thumbnail">
          <img
            src={thumbSrc}
            alt={meta.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        </div>
      ) : (
        <div className="card-thumbnail card-thumbnail--placeholder">
          <span>{meta.title[0]}</span>
        </div>
      )}
      <div className="card-body">
        <h3 className="card-title">{meta.title}</h3>
        <p className="card-description">{meta.description}</p>
        <div className="card-tags">
          {meta.tags.map((tag) => (
            <span key={tag} className="card-tag">
              {tag}
            </span>
          ))}
        </div>
        {meta.hasArticle && (
          <button
            className="card-article-link"
            onClick={(e) => {
              e.stopPropagation();
              history.pushState(null, '', `/experiment/${meta.slug}/article`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          >
            How it works
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}
