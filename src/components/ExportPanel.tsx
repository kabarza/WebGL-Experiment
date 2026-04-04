// ============================================================
// ExportPanel — Webflow export modal (Tier 1: Clipboard HTML)
// ============================================================

import { useState, useCallback } from 'react';
import type { Experiment } from '../core/Experiment.ts';
import type { Version } from '../lib/versions.ts';
import { generateExportHTML, getBundleUrl } from '../lib/webflow-export.ts';
import { buildExportPlan, generateMCPInstructions } from '../lib/webflow-mcp.ts';

interface ExportPanelProps {
  slug: string;
  experiment: Experiment;
  params: Record<string, unknown>;
  versions: Version[];
  activeVersionId: string | null;
  onClose: () => void;
}

export function ExportPanel({
  slug,
  experiment,
  params,
  versions,
  activeVersionId,
  onClose,
}: ExportPanelProps) {
  const [sizing, setSizing] = useState<'responsive' | 'fixed'>('responsive');
  const [fixedWidth, setFixedWidth] = useState(800);
  const [fixedHeight, setFixedHeight] = useState(600);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(
    () => {
      const idx = versions.findIndex((v) => v.id === activeVersionId);
      return idx >= 0 ? idx : 0;
    },
  );

  const versionNumber = selectedVersionIdx + 1;
  const bundleUrl = getBundleUrl(slug, versionNumber);

  const html = generateExportHTML({
    slug,
    version: versionNumber,
    params,
    sizing,
    fixedWidth,
    fixedHeight,
  });

  const mcpPlan = buildExportPlan(slug, bundleUrl);
  const mcpInstructions = generateMCPInstructions(mcpPlan);

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

  return (
    <div className="export-backdrop" onClick={onClose}>
      <div className="export-panel" onClick={(e) => e.stopPropagation()}>
        <div className="export-header">
          <h2 className="export-title">Export to Webflow</h2>
          <button className="export-close" onClick={onClose}>
            x
          </button>
        </div>

        <div className="export-body">
          {/* Experiment info */}
          <div className="export-section">
            <label className="export-label">Experiment</label>
            <p className="export-value">{experiment.meta.title}</p>
          </div>

          {/* Version selector */}
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
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sizing */}
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

          {/* HTML Preview */}
          <div className="export-section">
            <label className="export-label">HTML Embed</label>
            <pre className="export-code">{html}</pre>
            <button
              className="export-btn"
              onClick={() => copyToClipboard(html, 'html')}
            >
              {copied === 'html' ? 'Copied!' : 'Copy HTML'}
            </button>
          </div>

          {/* Bundle URL */}
          <div className="export-section">
            <label className="export-label">Bundle URL</label>
            <code className="export-url">{bundleUrl}</code>
            <button
              className="export-btn export-btn--secondary"
              onClick={() => copyToClipboard(bundleUrl, 'url')}
            >
              {copied === 'url' ? 'Copied!' : 'Copy URL'}
            </button>
          </div>

          {/* MCP Instructions */}
          <div className="export-section">
            <label className="export-label">
              Webflow MCP Push (Direct to Designer)
            </label>
            <pre className="export-code export-code--mcp">
              {mcpInstructions}
            </pre>
            <button
              className="export-btn export-btn--secondary"
              onClick={() => copyToClipboard(mcpInstructions, 'mcp')}
            >
              {copied === 'mcp' ? 'Copied!' : 'Copy MCP Instructions'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
