// ============================================================
// ExportPanel — Tabbed export modal (Webflow JSON / HTML / MCP)
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import type { Experiment } from '../core/Experiment.ts';
import type { Version } from '../lib/versions.ts';
import type { PromptMode, PromptVariant } from '../core/promptVariant.ts';
import { generateExportHTML, getBundleUrl } from '../lib/webflow-export.ts';
import { buildExportPlan, generateMCPInstructions } from '../lib/webflow-mcp.ts';
import { generateWebflowJSON } from '../lib/webflow-json.ts';

type ExportTab = 'webflow-json' | 'html-embed' | 'mcp' | 'prompt';
type PromptFormat = 'markdown' | 'json';

interface ExportPanelProps {
  slug: string;
  experiment: Experiment;
  params: Record<string, unknown>;
  versions: Version[];
  activeVersionId: string | null;
  onClose: () => void;
  /** Optional: generate inline IIFE for Webflow JSON tab */
  generateInlineScript?: (params: Record<string, unknown>) => string;
  /**
   * Optional: build the entire @webflow/XscpData JSON payload for this
   * experiment. When provided, this takes precedence over the standard
   * canvas-shaped wrapper used by `generateInlineScript`. Use it for
   * non-canvas experiments (e.g. DOM-based components) that need a
   * different node tree.
   */
  generateFullWebflowJSON?: (
    params: Record<string, unknown>,
    options: { sizing: 'responsive' | 'fixed'; fixedWidth: number; fixedHeight: number },
  ) => string;
  /** Optional: portable prompt variants for the Prompt tab */
  promptVariants?: PromptVariant[];
}

export function ExportPanel({
  slug,
  experiment,
  params,
  versions,
  activeVersionId,
  onClose,
  generateInlineScript,
  generateFullWebflowJSON,
  promptVariants,
}: ExportPanelProps) {
  const hasPromptVariants = !!promptVariants && promptVariants.length > 0;
  const [activeTab, setActiveTab] = useState<ExportTab>('webflow-json');
  const [promptVariantId, setPromptVariantId] = useState<string>(
    () => promptVariants?.[0]?.id ?? '',
  );
  const [promptMode, setPromptMode] = useState<PromptMode>('current');
  const [promptFormat, setPromptFormat] = useState<PromptFormat>('markdown');
  const [sizing, setSizing] = useState<'responsive' | 'fixed'>('responsive');
  const [fixedWidth, setFixedWidth] = useState(800);
  const [fixedHeight, setFixedHeight] = useState(600);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(() => {
    const idx = versions.findIndex((v) => v.id === activeVersionId);
    return idx >= 0 ? idx : 0;
  });

  const versionNumber = selectedVersionIdx + 1;
  const bundleUrl = getBundleUrl(slug, versionNumber);

  // HTML Embed tab content
  const html = generateExportHTML({
    slug,
    version: versionNumber,
    params,
    sizing,
    fixedWidth,
    fixedHeight,
  });

  // MCP tab content
  const mcpPlan = buildExportPlan(slug, bundleUrl);
  const mcpInstructions = generateMCPInstructions(mcpPlan);

  /**
   * Build Webflow JSON fresh from the live (mutated) params object.
   * Called at click time so it always reads the latest DialKit values.
   * (params is a stable mutable ref — useMemo would never recompute.)
   */
  const buildWebflowJSON = useCallback((): string | null => {
    // Per-experiment full JSON generator wins (for DOM-based experiments
    // that need a non-canvas node tree).
    if (generateFullWebflowJSON) {
      return generateFullWebflowJSON({ ...params }, { sizing, fixedWidth, fixedHeight });
    }
    if (!generateInlineScript) return null;
    // Spread to snapshot the current mutable values
    const inlineScript = generateInlineScript({ ...params });
    return generateWebflowJSON({
      inlineScript,
      slug,
      sizing,
      fixedWidth,
      fixedHeight,
    });
  }, [generateInlineScript, generateFullWebflowJSON, params, slug, sizing, fixedWidth, fixedHeight]);

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        window.prompt('Copy:', text);
      }
    },
    [],
  );

  /**
   * Copy JSON to clipboard with application/json MIME type.
   * Webflow Designer only recognizes paste data in this format —
   * plain text clipboard won't work.
   */
  const copyWebflowJSON = useCallback(
    (json: string, label: string) => {
      const handler = (e: ClipboardEvent) => {
        e.clipboardData?.setData('application/json', json);
        e.preventDefault();
      };
      document.addEventListener('copy', handler);
      document.execCommand('copy');
      document.removeEventListener('copy', handler);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    },
    [],
  );

  const tabs: { id: ExportTab; label: string }[] = [
    { id: 'webflow-json', label: 'Webflow JSON' },
    { id: 'html-embed', label: 'HTML Embed' },
    { id: 'mcp', label: 'MCP' },
    ...(hasPromptVariants ? [{ id: 'prompt' as const, label: 'Prompt' }] : []),
  ];

  // Build prompt output for the active variant, mode, and format.
  // Snapshot params at render time so toggling Defaults/Current is fresh.
  const activeVariant = useMemo(
    () => promptVariants?.find((v) => v.id === promptVariantId),
    [promptVariants, promptVariantId],
  );
  const promptOutput = useMemo(() => {
    if (!activeVariant) return null;
    const values =
      promptMode === 'defaults'
        ? experiment.controls.defaults
        : { ...params };
    return activeVariant.build(values, promptMode);
  }, [activeVariant, promptMode, params, experiment.controls.defaults]);

  const promptText =
    promptOutput == null
      ? ''
      : promptFormat === 'markdown'
      ? promptOutput.markdown
      : JSON.stringify(promptOutput.json, null, 2);

  return (
    <div className="export-backdrop" onClick={onClose}>
      <div className="export-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="export-header">
          <h2 className="export-title">Export to Webflow</h2>
          <button className="export-close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="export-body">
          {/* Shared: Experiment info */}
          <div className="export-section">
            <label className="export-label">Experiment</label>
            <p className="export-value">{experiment.meta.title}</p>
          </div>

          {/* Shared: Version selector */}
          {versions.length > 0 && (
            <div className="export-section">
              <label className="export-label">Version</label>
              <select
                className="export-select"
                value={selectedVersionIdx}
                onChange={(e) =>
                  setSelectedVersionIdx(Number(e.target.value))
                }
              >
                {versions.map((v, i) => (
                  <option key={v.id} value={i}>
                    v{i + 1} — {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Shared: Sizing */}
          <div className="export-section">
            <label className="export-label">Canvas Sizing</label>
            <div className="export-radio-group">
              <label>
                <input
                  type="radio"
                  name="sizing"
                  checked={sizing === 'responsive'}
                  onChange={() => setSizing('responsive')}
                />
                Responsive (100% x 100%)
              </label>
              <label>
                <input
                  type="radio"
                  name="sizing"
                  checked={sizing === 'fixed'}
                  onChange={() => setSizing('fixed')}
                />
                Fixed
              </label>
            </div>
            {sizing === 'fixed' && (
              <div className="export-fixed-inputs">
                <input
                  type="number"
                  value={fixedWidth}
                  onChange={(e) => setFixedWidth(Number(e.target.value))}
                  placeholder="Width"
                />
                <span>x</span>
                <input
                  type="number"
                  value={fixedHeight}
                  onChange={(e) => setFixedHeight(Number(e.target.value))}
                  placeholder="Height"
                />
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="export-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`export-tab${activeTab === tab.id ? ' export-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="export-tab-content">
            {/* Tab 1: Webflow JSON */}
            {activeTab === 'webflow-json' && (
              <>
                {generateInlineScript || generateFullWebflowJSON ? (
                  <>
                    <p className="export-hint">
                      Click the button below, then paste directly into Webflow Designer (Ctrl/Cmd+V on the canvas). Creates a ready-to-go component with canvas + inline script.
                    </p>
                    <button
                      className="export-btn export-btn--primary"
                      onClick={() => {
                        const json = buildWebflowJSON();
                        if (json) copyWebflowJSON(json, 'json');
                      }}
                    >
                      {copied === 'json' ? 'Copied to clipboard!' : 'Copy Webflow JSON'}
                    </button>
                  </>
                ) : (
                  <p className="export-hint">
                    Webflow JSON export is not available for this experiment yet. Use the HTML Embed tab instead.
                  </p>
                )}
              </>
            )}

            {/* Tab 2: HTML Embed */}
            {activeTab === 'html-embed' && (
              <>
                <p className="export-hint">
                  Paste this HTML into a Webflow Custom Code block or any HTML embed. Uses the hosted bundle from CDN.
                </p>
                <pre className="export-code">{html}</pre>
                <button
                  className="export-btn"
                  onClick={() => copyToClipboard(html, 'html')}
                >
                  {copied === 'html' ? 'Copied!' : 'Copy HTML'}
                </button>
                <div className="export-section" style={{ marginTop: 16 }}>
                  <label className="export-label">Bundle URL</label>
                  <code className="export-url">{bundleUrl}</code>
                  <button
                    className="export-btn export-btn--secondary"
                    onClick={() => copyToClipboard(bundleUrl, 'url')}
                  >
                    {copied === 'url' ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              </>
            )}

            {/* Tab 3: MCP Instructions */}
            {activeTab === 'mcp' && (
              <>
                <p className="export-hint">
                  Copy these instructions for Claude to build the component via Webflow MCP tools.
                </p>
                <pre className="export-code export-code--mcp">
                  {mcpInstructions}
                </pre>
                <button
                  className="export-btn export-btn--secondary"
                  onClick={() => copyToClipboard(mcpInstructions, 'mcp')}
                >
                  {copied === 'mcp' ? 'Copied!' : 'Copy MCP Instructions'}
                </button>
              </>
            )}

            {/* Tab 4: Prompt */}
            {activeTab === 'prompt' && hasPromptVariants && promptOutput && (
              <>
                <p className="export-hint">
                  Copy a portable prompt for rebuilding this experiment outside the project — paste into Claude, Webflow AI, or any code-gen tool.
                </p>

                {promptVariants!.length > 1 && (
                  <div className="export-section">
                    <label className="export-label">Variant</label>
                    <select
                      className="export-select"
                      value={promptVariantId}
                      onChange={(e) => setPromptVariantId(e.target.value)}
                    >
                      {promptVariants!.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="export-section">
                  <label className="export-label">Values</label>
                  <div className="export-radio-group">
                    <label>
                      <input
                        type="radio"
                        name="prompt-mode"
                        checked={promptMode === 'defaults'}
                        onChange={() => setPromptMode('defaults')}
                      />
                      Defaults
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="prompt-mode"
                        checked={promptMode === 'current'}
                        onChange={() => setPromptMode('current')}
                      />
                      Current settings
                    </label>
                  </div>
                </div>

                <div className="export-section">
                  <label className="export-label">Format</label>
                  <div className="export-radio-group">
                    <label>
                      <input
                        type="radio"
                        name="prompt-format"
                        checked={promptFormat === 'markdown'}
                        onChange={() => setPromptFormat('markdown')}
                      />
                      Markdown
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="prompt-format"
                        checked={promptFormat === 'json'}
                        onChange={() => setPromptFormat('json')}
                      />
                      JSON values
                    </label>
                  </div>
                </div>

                <pre className="export-code">{promptText}</pre>
                <button
                  className="export-btn"
                  onClick={() => copyToClipboard(promptText, 'prompt')}
                >
                  {copied === 'prompt' ? 'Copied!' : 'Copy Prompt'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
