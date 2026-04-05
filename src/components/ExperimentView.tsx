// ============================================================
// ExperimentView — Canvas + overlay + controls + versioning + sharing
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { findExperiment } from '../experiments/registry.ts';
import { useExperiment } from '../hooks/useExperiment.ts';
import { useExperimentParams } from '../hooks/useExperimentParams.ts';
import { ShareButton } from './ShareButton.tsx';
import { ExportPanel } from './ExportPanel.tsx';
import { FpsCounter } from './FpsCounter.tsx';
import { VersionStore, type Version } from '../lib/versions.ts';
import { decodeParams } from '../lib/sharing.ts';
import { generateExport } from '../experiments/flow-field/generateExport.ts';

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
      ? `${experiment.meta.title} — WebGL Experiments`
      : 'WebGL Experiments';
    return () => {
      document.title = 'WebGL Experiments';
    };
  }, [experiment]);

  // Generate inline script for Webflow JSON export (flow-field only for now)
  const getInlineScript = useCallback(
    (currentParams: Record<string, unknown>) => {
      if (slug !== 'flow-field' || !experiment) return '';
      return generateExport({
        params: currentParams,
        dialConfig: experiment.controls.dialConfig,
        slug,
        experimentTitle: experiment.meta.title,
      });
    },
    [slug, experiment],
  );

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
              {slug === 'flow-field' && (
                <button
                  className="dock-btn"
                  onClick={() => {
                    history.pushState(null, '', `/experiment/${slug}/article`);
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  title="How it works"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2h10v12H3z" />
                    <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
                  </svg>
                </button>
              )}
              <button
                className="dock-btn"
                onClick={() => setExportOpen(true)}
                title="Export"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 10V2M5 5l3-3 3 3" />
                  <path d="M3 11v2h10v-2" />
                </svg>
              </button>
              <div className="dock-divider" />
              <FpsCounter />
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
            generateInlineScript={slug === 'flow-field' ? getInlineScript : undefined}
          />
        )}
    </motion.div>
  );
}
