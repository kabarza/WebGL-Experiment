// ============================================================
// DraftBadge — Dev-only publish toggle for an experiment card.
//
// One pill per card. States: "live" (visible in production) or
// "draft" (hidden in the gallery and article routes when built).
// Click flips the value via the dev-only /__draft endpoint, which
// patches the experiment's meta.ts on disk. Vite HMR re-imports
// the meta and the gallery re-renders.
//
// Article-level draft is still supported in the schema
// (meta.articleDraft) — flip it in meta.ts directly if you want to
// ship the experiment but keep the article hidden.
// ============================================================

import { useState } from 'react';

interface DraftBadgeProps {
  slug: string;
  draft: boolean;
}

async function postDraft(slug: string, value: boolean) {
  const res = await fetch('/__draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, key: 'draft', value }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`draft toggle failed: ${res.status} ${txt}`);
  }
}

export function DraftBadge({ slug, draft }: DraftBadgeProps) {
  // Optimistic local state — meta.ts is the source of truth, but
  // HMR roundtrip can take a tick and we don't want a flicker.
  const [localDraft, setLocalDraft] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !localDraft;
    setBusy(true);
    setErr(null);
    setLocalDraft(next);
    try {
      await postDraft(slug, next);
    } catch (e) {
      setLocalDraft(localDraft); // roll back on failure
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`draft-pill${localDraft ? ' is-draft' : ' is-live'}`}
      onClick={(e) => {
        e.stopPropagation();
        void toggle();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      disabled={busy}
      title={err ?? `Click to set ${localDraft ? 'live' : 'draft'}`}
      aria-label={`Experiment is ${localDraft ? 'draft (hidden in production)' : 'live'} — click to toggle`}
    >
      <span className="draft-pill-dot" aria-hidden="true" />
      {localDraft ? 'draft' : 'live'}
    </button>
  );
}
