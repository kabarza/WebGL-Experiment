// ============================================================
// ExportPanel — Tabbed export modal (Webflow JSON / HTML / MCP)
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import type { Experiment } from '../core/Experiment.ts';
import type { Version } from '../lib/versions.ts';
import { generateExportHTML, getBundleUrl } from '../lib/webflow-export.ts';
import { buildExportPlan, generateMCPInstructions } from '../lib/webflow-mcp.ts';
import { generateWebflowJSON } from '../lib/webflow-json.ts';

type ExportTab = 'webflow-json' | 'html-embed' | 'mcp';

interface ExportPanelProps {
  slug: string;
  experiment: Experiment;
  params: Record<string, unknown>;
  versions: Version[];
  activeVersionId: string | null;
  onClose: () => void;
  /** Optional: generate inline IIFE for Webflow JSON tab */
  generateInlineScript?: (params: Record<string, unknown>) => string;
}

export function ExportPanel({
  slug,
  experiment,
  params,
  versions,
  activeVersionId,
  onClose,
  generateInlineScript,
}: ExportPanelProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>('webflow-json');
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

  // Webflow JSON tab content
  const webflowJSON = useMemo(() => {
    if (!generateInlineScript) return null;
    const inlineScript = generateInlineScript(params);
    return generateWebflowJSON({
      inlineScript,
      slug,
      sizing,
      fixedWidth,
      fixedHeight,
    });
  }, [generateInlineScript, params, slug, sizing, fixedWidth, fixedHeight]);

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
  ];

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
                {webflowJSON ? (
                  <>
                    <p className="export-hint">
                      Click the button below, then paste directly into Webflow Designer (Ctrl/Cmd+V on the canvas). Creates a ready-to-go component with canvas + inline script.
                    </p>
                    <div className="export-json-summary">
                      <span>@webflow/XscpData</span>
                      <span className="export-json-size">
                        {(webflowJSON.length / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <button
                      className="export-btn export-btn--primary"
                      onClick={() => copyWebflowJSON(webflowJSON, 'json')}
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
          </div>
        </div>
      </div>
    </div>
  );
}
