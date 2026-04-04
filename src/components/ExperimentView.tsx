// ============================================================
// ExperimentView — Canvas + overlay + controls + versioning + sharing
// ============================================================

import { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { findExperiment } from '../experiments/registry.ts';
import { useExperiment } from '../hooks/useExperiment.ts';
import { useExperimentParams } from '../hooks/useExperimentParams.ts';
import { ShareButton } from './ShareButton.tsx';
import { ExportPanel } from './ExportPanel.tsx';
import { VersionStore, type Version } from '../lib/versions.ts';
import { decodeParams } from '../lib/sharing.ts';

interface ExperimentViewProps {
  slug: string;
  sharedParams?: string;
  onBack: () => void;
}

export function ExperimentView({ slug, sharedParams, onBack }: ExperimentViewProps) {
  const experiment = findExperiment(slug);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  // Version management — seed presets on first load
  const [store] = useState(() => {
    const s = new VersionStore(slug);
    if (experiment && s.getVersions().length === 0) {
      s.seedFromPresets(experiment.controls.defaults, experiment.controls.presets);
    }
    return s;
  });
  const [versions, setVersions] = useState<Version[]>(() => store.getVersions());
  const [activeVersionId] = useState<string | null>(
    () => store.getActiveVersion(),
  );

  // Decode shared params if present
  const decodedShared = sharedParams ? decodeParams(sharedParams) : null;

  // Determine which overrides to use
  const activeVersion = activeVersionId
    ? versions.find((v) => v.id === activeVersionId)
    : null;
  const overrides = decodedShared ?? activeVersion?.params;

  // Bridge hooks
  const params = useExperimentParams(
    experiment?.meta.title ?? 'Controls',
    experiment?.controls.dialConfig,
    experiment?.controls.defaults ?? {},
    overrides,
  );
  const { error, loading } = useExperiment(canvasRef, experiment, params);

  // Auto-save active version on param changes (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!activeVersionId || decodedShared) return;
    const ver = versions.find((v) => v.id === activeVersionId);
    if (ver?.name === 'Defaults') return;

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      store.updateVersion(activeVersionId, { ...params });
      setVersions(store.getVersions());
    }, 1000);

    return () => clearTimeout(saveTimeoutRef.current);
  }, [params, activeVersionId, store, versions, decodedShared]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (exportOpen) {
          setExportOpen(false);
        } else {
          onBack();
        }
      } else if (e.key === 'h' || e.key === 'H') {
        setOverlayVisible((v) => !v);
      } else if (e.key === ' ') {
        e.preventDefault();
        params.paused = !params.paused;
      } else if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onBack, params, exportOpen]);

  // Set document title
  useEffect(() => {
    document.title = experiment
      ? `${experiment.meta.title} — Tempo`
      : 'Tempo';
    return () => {
      document.title = 'Tempo — WebGPU Experiments';
    };
  }, [experiment]);

  if (!experiment) {
    return (
      <div className="error-screen">
        <p>Experiment &ldquo;{slug}&rdquo; not found</p>
        <button onClick={onBack}>Back to Gallery</button>
      </div>
    );
  }

  return (
    <motion.div
      className="experiment-view"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
          }}
        />

        {loading && (
          <div className="loading-screen">
            <p>Loading...</p>
          </div>
        )}

        {error && (
          <div className="error-screen">
            <p>Failed to initialize experiment</p>
            <p className="error-detail">{error}</p>
            <button onClick={onBack}>Back to Gallery</button>
          </div>
        )}

        {overlayVisible && (
          <div className="experiment-chrome">
            <nav className="chrome-dock">
              <button className="dock-btn" onClick={onBack} title="Back to gallery">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-1px' }}>
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </button>
              <ShareButton slug={slug} params={params} />
              <button
                className="dock-btn"
                onClick={() => setExportOpen(true)}
                title="Export"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v8M5 7l3 3 3-3" />
                  <path d="M3 11v2h10v-2" />
                </svg>
              </button>
            </nav>
          </div>
        )}

        {exportOpen && (
          <ExportPanel
            slug={slug}
            experiment={experiment}
            params={params}
            versions={versions}
            activeVersionId={activeVersionId}
            onClose={() => setExportOpen(false)}
          />
        )}
    </motion.div>
  );
}
