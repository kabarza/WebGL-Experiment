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
import { LayerStack } from './LayerStack.tsx';
import { VersionStore, type Version } from '../lib/versions.ts';
import { decodeParams } from '../lib/sharing.ts';
import { generateExport as generateFlowField } from '../experiments/flow-field/generateExport.ts';
import { generateExport as generateBloomDither } from '../experiments/bloom-dither/generateExport.ts';
import { generateExport as generateCelestialFlare } from '../experiments/celestial-flare/generateExport.ts';
import { generateExport as generateDitherForge } from '../experiments/dither-forge/generateExport.ts';
import { generateExport as generateDotTrace } from '../experiments/dot-trace/generateExport.ts';
import { generateExport as generateAuroraDrift } from '../experiments/aurora-drift/generateExport.ts';
import { generateExport as generateGlobe1 } from '../experiments/globe-1/generateExport.ts';
import {
  generateExport as generatePlyrVimeo,
  generateWebflowJSON as generatePlyrVimeoJSON,
} from '../experiments/plyr-vimeo/generateExport.ts';
import {
  generateExport as generateVimeoNative,
  generateWebflowJSON as generateVimeoNativeJSON,
} from '../experiments/vimeo-native/generateExport.ts';
import {
  generateExport as generateFlowPlayer,
  generateWebflowJSON as generateFlowPlayerJSON,
} from '../experiments/flow-player/generateExport.ts';
import {
  generateExport as generateFlowPlayer2,
  generateWebflowJSON as generateFlowPlayer2JSON,
} from '../experiments/flow-player-2/generateExport.ts';
import {
  generateExport as generateFlowPlayer3,
  generateWebflowJSON as generateFlowPlayer3JSON,
} from '../experiments/flow-player-3/generateExport.ts';
import {
  generateExport as generateFlowPlayer4,
  generateWebflowJSON as generateFlowPlayer4JSON,
} from '../experiments/flow-player-4/generateExport.ts';
import type { GenerateExportOptions } from '../experiments/flow-field/generateExport.ts';
import type { PromptVariant } from '../core/promptVariant.ts';
import { promptVariants as auroraDriftPromptVariants } from '../experiments/aurora-drift/prompt.ts';

const EXPORT_GENERATORS: Record<string, (opts: GenerateExportOptions) => string> = {
  'flow-field': generateFlowField,
  'bloom-dither': generateBloomDither,
  'celestial-flare': generateCelestialFlare,
  'dither-forge': generateDitherForge,
  'dot-trace': generateDotTrace,
  'aurora-drift': generateAuroraDrift,
  'globe-1': generateGlobe1,
  'plyr-vimeo': generatePlyrVimeo,
  'vimeo-native': generateVimeoNative,
  'flow-player': generateFlowPlayer,
  'flow-player-2': generateFlowPlayer2,
  'flow-player-3': generateFlowPlayer3,
  'flow-player-4': generateFlowPlayer4,
};

/**
 * Per-experiment full Webflow JSON generators. When an experiment
 * registers here, the export panel uses this builder instead of the
 * canvas-shaped wrapper. Use for DOM-based experiments.
 */
const FULL_JSON_GENERATORS: Record<
  string,
  (
    params: Record<string, unknown>,
    options: { sizing: 'responsive' | 'fixed'; fixedWidth: number; fixedHeight: number },
  ) => string
> = {
  'plyr-vimeo': (params, opts) =>
    generatePlyrVimeoJSON({
      params,
      dialConfig: {},
      sizing: opts.sizing,
      fixedWidth: opts.fixedWidth,
      fixedHeight: opts.fixedHeight,
    }),
  'vimeo-native': (params, opts) =>
    generateVimeoNativeJSON({
      params,
      dialConfig: {},
      sizing: opts.sizing,
      fixedWidth: opts.fixedWidth,
      fixedHeight: opts.fixedHeight,
    }),
  'flow-player': (params, opts) =>
    generateFlowPlayerJSON({
      params,
      dialConfig: {},
      sizing: opts.sizing,
      fixedWidth: opts.fixedWidth,
      fixedHeight: opts.fixedHeight,
    }),
  'flow-player-2': (params, opts) =>
    generateFlowPlayer2JSON({
      params,
      dialConfig: {},
      sizing: opts.sizing,
      fixedWidth: opts.fixedWidth,
      fixedHeight: opts.fixedHeight,
    }),
  'flow-player-3': (params, opts) =>
    generateFlowPlayer3JSON({
      params,
      dialConfig: {},
      sizing: opts.sizing,
      fixedWidth: opts.fixedWidth,
      fixedHeight: opts.fixedHeight,
    }),
  'flow-player-4': (params, _opts) =>
    generateFlowPlayer4JSON({
      params,
      dialConfig: {},
    }),
};

const PROMPT_VARIANTS: Record<string, PromptVariant[]> = {
  'aurora-drift': auroraDriftPromptVariants,
};

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
      s.seedFromPresets(
        experiment.controls.defaults,
        experiment.controls.presets,
        { skipDefaults: experiment.controls.skipDefaultsVersion },
      );
    }
    return s;
  });
  const [versions, setVersions] = useState<Version[]>(() => store.getVersions());
  const [activeVersionId] = useState<string | null>(
    () => store.getActiveVersion(),
  );

  // Decode shared params if present
  const decodedShared = sharedParams ? decodeParams(sharedParams) : null;

  // Determine which overrides to use.
  // Only pass explicit overrides for shared URLs and non-Default versions.
  // For the normal case (Defaults version), let the param cache handle persistence.
  const activeVersion = activeVersionId
    ? versions.find((v) => v.id === activeVersionId)
    : null;
  const isDefaultVersion = !activeVersion || activeVersion.name === 'Defaults';
  const overrides = decodedShared ?? (!isDefaultVersion ? activeVersion?.params : undefined);

  // Bridge hooks
  const { params } = useExperimentParams(
    experiment?.meta.title ?? 'Controls',
    experiment?.controls.dialConfig,
    experiment?.controls.defaults ?? {},
    slug,
    overrides,
    experiment?.controls.visibility,
    experiment?.controls.presets,
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
      // Filter out non-serializable and transient underscore-prefixed values
      // (DOM elements, stale actions, etc.) before saving to version store.
      const serializable: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) {
        if (k.startsWith('_')) continue;
        if (v instanceof Element || typeof v === 'function') continue;
        serializable[k] = v;
      }
      store.updateVersion(activeVersionId, serializable);
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

  // Generate inline script for Webflow JSON export
  const hasExportGenerator = slug in EXPORT_GENERATORS;
  const getInlineScript = useCallback(
    (currentParams: Record<string, unknown>) => {
      const gen = EXPORT_GENERATORS[slug];
      if (!gen || !experiment) return '';
      return gen({
        params: currentParams,
        dialConfig: experiment.controls.dialConfig,
        slug,
        experimentTitle: experiment.meta.title,
      });
    },
    [slug, experiment],
  );

  const hasFullJSONGenerator = slug in FULL_JSON_GENERATORS;
  const getFullWebflowJSON = useCallback(
    (
      currentParams: Record<string, unknown>,
      opts: { sizing: 'responsive' | 'fixed'; fixedWidth: number; fixedHeight: number },
    ) => {
      const gen = FULL_JSON_GENERATORS[slug];
      if (!gen) return '';
      return gen(currentParams, opts);
    },
    [slug],
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
            generateInlineScript={hasExportGenerator ? getInlineScript : undefined}
            generateFullWebflowJSON={hasFullJSONGenerator ? getFullWebflowJSON : undefined}
            promptVariants={PROMPT_VARIANTS[slug]}
          />
        )}

        {experiment.controls.layerOrder && (
          <LayerStack
            params={params}
            panelName={experiment.meta.title}
            layers={experiment.controls.layerOrder}
          />
        )}
    </motion.div>
  );
}
