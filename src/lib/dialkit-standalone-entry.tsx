// ============================================================
// DialKit Standalone Entry — vanilla JS API for Webflow
// Bundled into a single IIFE with React + ReactDOM + DialKit
// Exposes window.FlowDialKit.create(params, config, onChange)
// ============================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { DialRoot, useDialKit } from 'dialkit';
import 'dialkit/styles.css';

interface DialConfig {
  [key: string]: unknown;
}

/**
 * Bridge component: renders DialKit panel and syncs values
 * back to the caller's params object via onChange callback.
 */
function DialKitBridge({
  params,
  config,
  onChange,
}: {
  params: Record<string, unknown>;
  config: DialConfig;
  onChange?: (updated: Record<string, unknown>) => void;
}) {
  const values = useDialKit('Flow Tempo', config as Parameters<typeof useDialKit>[1]);

  // Flatten nested folder values and sync to params + call onChange
  React.useEffect(() => {
    const flat: Record<string, unknown> = {};
    for (const folderValues of Object.values(values)) {
      if (folderValues && typeof folderValues === 'object' && !Array.isArray(folderValues)) {
        for (const [k, v] of Object.entries(folderValues as Record<string, unknown>)) {
          if (k === '_collapsed') continue;
          flat[k] = v;
        }
      }
    }

    // Update the live params object in place
    for (const [k, v] of Object.entries(flat)) {
      params[k] = v;
    }

    if (onChange) onChange(flat);
  }, [values, params, onChange]);

  return <DialRoot position="top-right" defaultOpen theme="dark" />;
}

/**
 * Copy Config button — copies current params as a formatted CONFIG block.
 */
function copyConfig(params: Record<string, unknown>) {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      const stripped = value.startsWith('#') ? value.slice(1) : value;
      lines.push(`  ${key}: "${stripped}",`);
    } else if (typeof value === 'number') {
      lines.push(`  ${key}: ${value},`);
    } else if (typeof value === 'boolean') {
      lines.push(`  ${key}: ${value},`);
    }
  }
  lines.push(`  dialKit: false,`);
  const block = `var CONFIG = {\n${lines.join('\n')}\n};`;

  navigator.clipboard.writeText(block).catch(() => {
    window.prompt('Copy CONFIG:', block);
  });
}

// ── Exposed vanilla API ──
(window as unknown as Record<string, unknown>).FlowDialKit = {
  create(
    params: Record<string, unknown>,
    config: DialConfig,
    onChange?: (updated: Record<string, unknown>) => void,
  ) {
    // Create container
    const container = document.createElement('div');
    container.id = 'flow-dialkit-root';
    document.body.appendChild(container);

    // Add copy config button styles
    const style = document.createElement('style');
    style.textContent = `
      #flow-dialkit-copy-btn {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 99999;
        background: rgba(255,255,255,0.1);
        border: 1px solid rgba(255,255,255,0.2);
        color: #fff;
        padding: 8px 16px;
        border-radius: 6px;
        font-family: monospace;
        font-size: 11px;
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition: all 0.15s;
      }
      #flow-dialkit-copy-btn:hover {
        background: rgba(255,255,255,0.18);
        border-color: rgba(255,255,255,0.35);
      }
    `;
    document.head.appendChild(style);

    // Add copy button
    const btn = document.createElement('button');
    btn.id = 'flow-dialkit-copy-btn';
    btn.textContent = 'Copy Config';
    btn.onclick = () => {
      copyConfig(params);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Config'; }, 1500);
    };
    document.body.appendChild(btn);

    // Mount React
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <DialKitBridge params={params} config={config} onChange={onChange} />
      </React.StrictMode>,
    );
  },
};
