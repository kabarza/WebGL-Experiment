// ============================================================
// Version Store — localStorage-backed parameter snapshots
// ============================================================

const STORAGE_PREFIX = 'webgl-versions';

export interface Version {
  id: string;
  name: string;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class VersionStore {
  private _slug: string;

  constructor(slug: string) {
    this._slug = slug;
    // Ensure the "Defaults" version always exists
    const versions = this._readAll();
    if (!versions.some((v) => v.name === 'Defaults')) {
      // Will be populated externally with experiment defaults
    }
  }

  private _storageKey(): string {
    return `${STORAGE_PREFIX}/${this._slug}`;
  }

  private _readAll(): Version[] {
    try {
      const raw = localStorage.getItem(this._storageKey());
      return raw ? (JSON.parse(raw) as Version[]) : [];
    } catch {
      return [];
    }
  }

  private _writeAll(versions: Version[]): void {
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify(versions));
    } catch {
      console.warn(`VersionStore: failed to save versions for "${this._slug}"`);
    }
  }

  getVersions(): Version[] {
    return this._readAll();
  }

  saveVersion(name: string, params: Record<string, unknown>): Version {
    const versions = this._readAll();
    const now = new Date().toISOString();
    const version: Version = {
      id: generateId(),
      name,
      params: { ...params },
      createdAt: now,
      updatedAt: now,
    };
    versions.push(version);
    this._writeAll(versions);
    return version;
  }

  updateVersion(id: string, params: Record<string, unknown>): void {
    const versions = this._readAll();
    const idx = versions.findIndex((v) => v.id === id);
    if (idx === -1) return;
    versions[idx].params = { ...params };
    versions[idx].updatedAt = new Date().toISOString();
    this._writeAll(versions);
  }

  deleteVersion(id: string): void {
    const versions = this._readAll().filter((v) => v.id !== id);
    this._writeAll(versions);
  }

  getActiveVersion(): string | null {
    try {
      return localStorage.getItem(`${this._storageKey()}/active`);
    } catch {
      return null;
    }
  }

  setActiveVersion(id: string): void {
    try {
      localStorage.setItem(`${this._storageKey()}/active`, id);
    } catch {
      // ignore
    }
  }

  /**
   * Seed the version store with a "Defaults" version and built-in presets.
   * Called once on first load when no versions exist yet.
   *
   * Pass `skipDefaults: true` to omit the "Defaults" version — the
   * first preset becomes active. Used by experiments whose dial
   * should only surface curated states (e.g., flow-player-2's
   * Vimeo / YouTube versions).
   */
  seedFromPresets(
    defaults: Record<string, unknown>,
    presets?: Record<string, Partial<Record<string, unknown>>>,
    options: { skipDefaults?: boolean } = {},
  ): void {
    let firstActiveId: string | null = null;

    if (!options.skipDefaults) {
      const defaultsVersion = this.saveVersion('Defaults', { ...defaults });
      firstActiveId = defaultsVersion.id;
    }

    if (presets) {
      for (const [name, overrides] of Object.entries(presets)) {
        const v = this.saveVersion(name, { ...defaults, ...overrides });
        if (firstActiveId === null) firstActiveId = v.id;
      }
    }

    if (firstActiveId !== null) this.setActiveVersion(firstActiveId);
  }
}
