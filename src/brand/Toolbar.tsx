// ============================================================
// Bottom toolbar — Figma / tldraw style tool set with dropdowns.
// ============================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ASPECTS } from './frames.ts';
import { EXPORT_FORMATS, type ExportFormat } from './export.ts';

export type Tool = 'select' | 'frame';

export const I = {
  select: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l10 6.2-4.3.9L11.4 13l-1.7 1-2.7-3.9L4 13.2z" /></svg>,
  hand: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 8V3.5a1 1 0 0 1 2 0V7M7 6.5V2.8a1 1 0 0 1 2 0V7M9 6.8V3.6a1 1 0 0 1 2 0V8M11 7.6V5.2a1 1 0 0 1 2 0V10c0 2.5-1.8 4.5-4.5 4.5S4.6 13 4 11.2L2.7 8.6a1 1 0 0 1 1.7-1L5 8.8" /></svg>,
  frame: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 2v12M11 2v12M2 5h12M2 11h12" /></svg>,
  brush: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 2.5L7 9l-1.5-1.5L12 1z" /><path d="M5.5 9.5c-1.6 0-2.5 1-2.5 2.3 0 1-.5 1.6-1.3 1.9 2.9.9 5.3-.6 5.3-2.8L5.5 9.5z" /></svg>,
  image: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="10" rx="2" /><path d="M2 11l3.5-3.5 3 3 2-2L14 12" /><circle cx="10.5" cy="6.5" r="1" /></svg>,
  close: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>,
  pause: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="0.8" /><rect x="9" y="3" width="3" height="10" rx="0.8" /></svg>,
  play: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.2v9.6l7.5-4.8z" /></svg>,
  grow: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 8a5 5 0 1 1-1.5-3.6" /><path d="M13 3v3h-3" /></svg>,
  scatter: <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="4" cy="4" r="1.3" /><circle cx="11" cy="5" r="1.3" /><circle cx="7" cy="9" r="1.3" /><circle cx="12.5" cy="11.5" r="1.3" /><circle cx="4" cy="12" r="1.3" /></svg>,
  clear: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h10M6 5V3.5h4V5M5 5l.6 8h4.8L11 5" /></svg>,
  reset: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 1 0 1.5-3.6" /><path d="M3 3v3h3" /><path d="M8 5.5V8l1.8 1.2" /></svg>,
  export: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 10V2M5 5l3-3 3 3" /><path d="M3 11v2h10v-2" /></svg>,
  chevron: <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5L5 4l2.5 2.5" /></svg>,
  duplicate: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H11" /></svg>,
  trash: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h10M6 5V3.5h4V5M5 5l.6 8h4.8L11 5" /></svg>,
};

// ── Dropdown ─────────────────────────────────────────────────

export function Dropdown({
  trigger,
  children,
  align = 'center',
  width,
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'center' | 'left' | 'right';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="bt-dd" ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={`bt-dd-menu bt-dd-menu--${align}`} style={width ? { width } : undefined}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────

export interface ToolbarProps {
  tool: Tool;
  setTool: (t: Tool) => void;
  hasSelection: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onGrow: (action: 'Reseed' | 'Random Spots' | 'Clear' | 'Reset All') => void;
  onAddFrame: (preset: { w: number; h: number } | null) => void;
  exportFormat: ExportFormat;
  setExportFormat: (f: ExportFormat) => void;
  exportScale: number;
  setExportScale: (s: number) => void;
  exportDetail: number;
  setExportDetail: (d: number) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  exportSize: { w: number; h: number } | null;
  onExport: () => void;
  exporting: boolean;
}

export function Toolbar(p: ToolbarProps) {
  const toolBtn = (t: Tool, icon: ReactNode, label: string, key: string) => (
    <button
      className={`dock-btn${p.tool === t ? ' dock-btn--on' : ''}`}
      onClick={() => p.setTool(t)}
      title={`${label} (${key})`}
      aria-pressed={p.tool === t}
    >
      {icon}
    </button>
  );
  const isSvg = p.exportFormat.startsWith('svg') || p.exportFormat === 'css';

  return (
    <div className="bt-toolbar-wrap bt-ui">
      <nav className="chrome-dock bt-toolbar">
        {/* Canvas tools */}
        {toolBtn('select', I.select, 'Move', 'V')}
        <div className="bt-split">
          {toolBtn('frame', I.frame, 'Frame', 'F')}
          <Dropdown
            width={176}
            trigger={(open, toggle) => (
              <button className={`dock-btn bt-split-arrow${open ? ' dock-btn--on' : ''}`} onClick={toggle} title="Frame presets">{I.chevron}</button>
            )}
          >
            {(close) => (
              <>
                <div className="bt-dd-title">New frame</div>
                {ASPECTS.map((a) => (
                  <button key={a.id} className="bt-dd-item" onClick={() => { p.onAddFrame(a); close(); }}>
                    <span>{a.label}</span><span className="bt-dd-hint">{a.w} × {a.h}</span>
                  </button>
                ))}
                <button className="bt-dd-item" onClick={() => { p.onAddFrame(null); close(); }}>
                  <span>Same as selected</span>
                </button>
              </>
            )}
          </Dropdown>
        </div>
        <div className="dock-divider" />

        {/* Growth */}
        <button className="dock-btn" onClick={p.onTogglePause} disabled={!p.hasSelection} title={p.paused ? 'Play (P)' : 'Pause (P)'}>
          {p.paused ? I.play : I.pause}
        </button>
        <div className="bt-split">
          <button className="dock-btn" onClick={() => p.onGrow('Reseed')} disabled={!p.hasSelection} title="Regrow (R)">{I.grow}</button>
          <Dropdown
            width={200}
            trigger={(open, toggle) => (
              <button className={`dock-btn bt-split-arrow${open ? ' dock-btn--on' : ''}`} onClick={toggle} disabled={!p.hasSelection} title="Growth actions">{I.chevron}</button>
            )}
          >
            {(close) => (
              <>
                <button className="bt-dd-item" onClick={() => { p.onGrow('Reseed'); close(); }}>{I.grow}<span>Regrow</span><kbd>R</kbd></button>
                <button className="bt-dd-item" onClick={() => { p.onGrow('Random Spots'); close(); }}>{I.scatter}<span>Scatter seeds</span></button>
                <button className="bt-dd-item" onClick={() => { p.onGrow('Clear'); close(); }}>{I.clear}<span>Clear</span><kbd>C</kbd></button>
                <div className="bt-dd-sep" />
                <button className="bt-dd-item" onClick={() => { p.onGrow('Reset All'); close(); }}>{I.reset}<span>Reset all controls</span></button>
              </>
            )}
          </Dropdown>
        </div>
        <div className="dock-divider" />

        {/* Export */}
        <Dropdown
          width={260}
          align="right"
          trigger={(open, toggle) => (
            <button className={`dock-btn dock-btn--labeled${open ? ' dock-btn--on' : ''}`} onClick={toggle} disabled={!p.hasSelection} title="Export selected frame">
              {I.export}<span>Export</span>
            </button>
          )}
        >
          {() => (
            <div className="bt-export-menu">
              <div className="bt-dd-title">Export {p.exportSize ? `· ${p.exportSize.w * p.exportScale} × ${p.exportSize.h * p.exportScale}` : ''}</div>
              <label className="bt-field">
                <span>Format</span>
                <select value={p.exportFormat} onChange={(e) => p.setExportFormat(e.target.value as ExportFormat)}>
                  {EXPORT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </label>
              <div className="bt-field-hint">{EXPORT_FORMATS.find((f) => f.id === p.exportFormat)?.hint}</div>
              <label className="bt-field">
                <span>Scale</span>
                <div className="bt-seg">
                  {[1, 2, 3].map((s) => (
                    <button key={s} className={p.exportScale === s ? 'on' : ''} onClick={() => p.setExportScale(s)}>{s}×</button>
                  ))}
                </div>
              </label>
              {isSvg && (
                <label className="bt-field">
                  <span>Detail</span>
                  <input type="range" min={0} max={1} step={0.01} value={p.exportDetail} onChange={(e) => p.setExportDetail(Number(e.target.value))} />
                </label>
              )}
              {p.exportFormat === 'svg-stroke' && (
                <label className="bt-field">
                  <span>Stroke</span>
                  <input type="range" min={0.5} max={12} step={0.5} value={p.strokeWidth} onChange={(e) => p.setStrokeWidth(Number(e.target.value))} />
                </label>
              )}
              <button className="bt-primary" onClick={p.onExport} disabled={p.exporting}>
                {p.exporting ? 'Exporting…' : p.exportFormat === 'css' ? 'Copy CSS' : 'Download'}
              </button>
            </div>
          )}
        </Dropdown>
      </nav>
    </div>
  );
}
