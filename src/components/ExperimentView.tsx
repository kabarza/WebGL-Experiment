// ============================================================
// ExperimentView — Canvas + overlay + controls + versioning + sharing
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { findExperiment } from '../experiments/registry.ts';
import { useExperiment } from '../hooks/useExperiment.ts';
import { useExperimentParams } from '../hooks/useExperimentParams.ts';
import { useChrome } from './ChromeContext.tsx';
import { ExportPanel } from './ExportPanel.tsx';
import { VersionStore, type Version } from '../lib/versions.ts';
import { decodeParams } from '../lib/sharing.ts';
import { generateExport } from '../experiments/flow-field/generateExport.ts';

interface ExperimentViewProps {
  slug: string;
  sharedParams?: string;
  onBack: () => void;
  setOverlayVisible: React.Dispatch<React.SetStateAction<boolean>>;
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
}

export function ExperimentView({
  slug,
  sharedParams,
  onBack,
  setOverlayVisible,
  exportOpen,
  setExportOpen,
}: ExperimentViewProps) {
  const experiment = findExperiment(slug);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { shareDataRef } = useChrome();

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
  const { params } = useExperimentParams(
    experiment?.meta.title ?? 'Controls',
    experiment?.controls.dialConfig,
    experiment?.controls.defaults ?? {},
    slug,
    overrides,
  );
  const { error, loading } = useExperiment(canvasRef, experiment, params);

  // Register share data with chrome context (read at click time by dock)
  useEffect(() => {
    shareDataRef.current = { slug, params };
    return () => { shareDataRef.current = null; };
  }, [slug, params, shareDataRef]);

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
  }, [onBack, params, exportOpen, setExportOpen, setOverlayVisible]);

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
