// ============================================================
// DraftBadge — Dev-only publish toggles for an experiment card.
//
// Shown only when import.meta.env.DEV is true. Two pills:
// "Experiment" (controls meta.draft) and "Article" (controls
// meta.articleDraft). Click flips the value via the dev-only
// /__draft endpoint, which patches the experiment's meta.ts on
// disk. Vite HMR picks up the rewrite and the gallery updates.
// ============================================================

import { useState } from 'react';

type DraftKey = 'draft' | 'articleDraft';

interface DraftBadgeProps {
  slug: string;
  hasArticle: boolean;
  draft: boolean;
  articleDraft: boolean;
}

async function postDraft(slug: string, key: DraftKey, value: boolean) {
  const res = await fetch('/__draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, key, value }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`draft toggle failed: ${res.status} ${txt}`);
  }
}

export function DraftBadge({ slug, hasArticle, draft, articleDraft }: DraftBadgeProps) {
  // Optimistic local state — the real source of truth is meta.ts, but
  // HMR roundtrip can take a tick, and this prevents the pill from
  // flicker-bouncing back to its old value while the file is being
  // patched.
  const [localDraft, setLocalDraft] = useState(draft);
  const [localArticleDraft, setLocalArticleDraft] = useState(articleDraft);
  const [busy, setBusy] = useState<DraftKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(key: DraftKey, current: boolean) {
    const next = !current;
    setBusy(key);
    setErr(null);
    if (key === 'draft') setLocalDraft(next);
    else setLocalArticleDraft(next);
    try {
      await postDraft(slug, key, next);
    } catch (e) {
      // Roll back optimistic update on failure
      if (key === 'draft') setLocalDraft(current);
      else setLocalArticleDraft(current);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="draft-badge"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      title={err ?? undefined}
    >
      <button
        type="button"
        className={`draft-pill${localDraft ? ' is-draft' : ' is-live'}`}
        onClick={(e) => {
          e.stopPropagation();
          if (busy !== 'draft') void toggle('draft', localDraft);
        }}
        disabled={busy === 'draft'}
        aria-label={`Experiment is ${localDraft ? 'draft (hidden in production)' : 'live'} — click to toggle`}
      >
        <span className="draft-pill-label">EXP</span>
        <span className="draft-pill-state">{localDraft ? 'draft' : 'live'}</span>
      </button>
      {hasArticle && (
        <button
          type="button"
          className={`draft-pill${localArticleDraft ? ' is-draft' : ' is-live'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (busy !== 'articleDraft') void toggle('articleDraft', localArticleDraft);
          }}
          disabled={busy === 'articleDraft'}
          aria-label={`Article is ${localArticleDraft ? 'draft (hidden in production)' : 'live'} — click to toggle`}
        >
          <span className="draft-pill-label">ART</span>
          <span className="draft-pill-state">{localArticleDraft ? 'draft' : 'live'}</span>
        </button>
      )}
    </div>
  );
}
