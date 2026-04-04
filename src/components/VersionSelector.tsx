// ============================================================
// VersionSelector — Dropdown for saved parameter versions
// ============================================================

import { useState, useRef, useEffect } from 'react';
import type { Version } from '../lib/versions.ts';

interface VersionSelectorProps {
  versions: Version[];
  activeVersionId: string | null;
  onSave: (name: string) => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

export function VersionSelector({
  versions,
  activeVersionId,
  onSave,
  onSwitch,
  onDelete,
}: VersionSelectorProps) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowInput(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeVersion = versions.find((v) => v.id === activeVersionId);

  return (
    <div className="version-selector" ref={ref}>
      <button
        className="toolbar-btn"
        onClick={() => setOpen(!open)}
        title="Versions"
      >
        {activeVersion ? activeVersion.name : 'Versions'}
        <span className="version-count">{versions.length}</span>
      </button>

      {open && (
        <div className="version-dropdown">
          {versions.map((v) => (
            <div
              key={v.id}
              className={`version-item${v.id === activeVersionId ? ' active' : ''}`}
            >
              <button
                className="version-name"
                onClick={() => {
                  onSwitch(v.id);
                  setOpen(false);
                }}
              >
                {v.name}
              </button>
              {v.name !== 'Defaults' && (
                <button
                  className="version-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(v.id);
                  }}
                  title="Delete version"
                >
                  x
                </button>
              )}
            </div>
          ))}

          <div className="version-divider" />

          {showInput ? (
            <form
              className="version-new-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim()) {
                  onSave(newName.trim());
                  setNewName('');
                  setShowInput(false);
                  setOpen(false);
                }
              }}
            >
              <input
                type="text"
                className="version-new-input"
                placeholder="Version name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="version-new-save">
                Save
              </button>
            </form>
          ) : (
            <button
              className="version-new-btn"
              onClick={() => setShowInput(true)}
            >
              + New Version
            </button>
          )}
        </div>
      )}
    </div>
  );
}
