// ============================================================
// ShareButton — Copies shareable URL with encoded params
// ============================================================

import { useState, useCallback } from 'react';
import { buildShareUrl } from '../lib/sharing.ts';

interface ShareButtonProps {
  slug: string;
  params: Record<string, unknown>;
}

export function ShareButton({ slug, params }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = buildShareUrl(slug, params);

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: prompt
      window.prompt('Copy this URL:', url);
    }
  }, [slug, params]);

  return (
    <button
      className={`dock-btn${copied ? ' dock-btn--active' : ''}`}
      onClick={handleShare}
      title={copied ? 'Copied!' : 'Copy shareable link'}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {copied ? (
          <path d="M4 8.5l2.5 2.5L12 5" />
        ) : (
          <>
            <rect x="6" y="6" width="7" height="7" rx="1.5" />
            <path d="M10 6V4.5A1.5 1.5 0 008.5 3h-5A1.5 1.5 0 002 4.5v5A1.5 1.5 0 004.5 11H6" />
          </>
        )}
      </svg>
    </button>
  );
}
