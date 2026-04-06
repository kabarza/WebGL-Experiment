// ============================================================
// Param Cache — lightweight localStorage persistence for live
// experiment params. Survives navigation without debounce.
// ============================================================

const PREFIX = 'webgl-live';

export function saveParamCache(
  slug: string,
  params: Record<string, unknown>,
): void {
  try {
    localStorage.setItem(`${PREFIX}/${slug}`, JSON.stringify(params));
  } catch {
    /* quota exceeded — silently drop */
  }
}

export function loadParamCache(
  slug: string,
): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}/${slug}`);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function clearParamCache(slug: string): void {
  try {
    localStorage.removeItem(`${PREFIX}/${slug}`);
  } catch {
    /* ignore */
  }
}
