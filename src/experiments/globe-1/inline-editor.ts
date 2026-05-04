// ============================================================
// Globe 1 — Inline DialKit-panel country editor
// ============================================================
//
// DialKit doesn't expose a public custom-control API, so we MutationObserve
// for the panel's DOM, find the Countries folder by title, and append a
// per-row editor that writes back into `Countries.countriesJson` via
// DialStore. Cache, presets, and baked export remain unaware.

import { DialStore } from 'dialkit';
import { parseCountries } from './helpers.ts';
import type { Country } from './params.ts';

const EDITOR_STYLE_ID = 'globe-1-editor-css';

function ensureEditorStyles() {
  if (document.getElementById(EDITOR_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = EDITOR_STYLE_ID;
  el.textContent = `
    .globe-1-editor {
      margin: 6px 0 4px;
      padding: 8px;
      border: 1px solid var(--dial-border, #2a2a2a);
      border-radius: var(--dial-radius, 8px);
      background: var(--dial-surface-subtle, rgba(255,255,255,0.02));
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    }
    .globe-1-editor-head,
    .globe-1-editor-row {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
      gap: 6px;
      align-items: center;
    }
    .globe-1-editor-head {
      padding: 0 2px 6px;
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--dial-text-tertiary, #707070);
      border-bottom: 1px solid var(--dial-border, #2a2a2a);
      margin-bottom: 6px;
    }
    .globe-1-editor-row {
      position: relative;
      padding: 3px 0;
    }
    .globe-1-editor-input {
      background: var(--dial-surface, #0e0e0e);
      border: 1px solid var(--dial-border, #2a2a2a);
      color: var(--dial-text-primary, #e6e6e6);
      border-radius: 5px;
      padding: 5px 7px;
      font-family: inherit;
      font-size: 11px;
      outline: none;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .globe-1-editor-input:focus {
      border-color: var(--dial-border-hover, #4d4d4d);
      background: var(--dial-surface-hover, #131313);
    }
    .globe-1-editor-row .globe-1-editor-input[type="number"] { text-align: right; }
    .globe-1-editor-delete {
      position: absolute;
      top: 50%;
      right: -10px;
      transform: translate(50%, -50%);
      width: 14px;
      height: 14px;
      padding: 0;
      background: var(--dial-surface, #1a1a1a);
      border: 1px solid var(--dial-border, #2a2a2a);
      color: var(--dial-text-tertiary, #888);
      border-radius: 50%;
      font-size: 10px;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transition: opacity 120ms ease, color 120ms ease, background 120ms ease;
      display: flex; align-items: center; justify-content: center;
    }
    .globe-1-editor-row:hover .globe-1-editor-delete { opacity: 1; }
    .globe-1-editor-delete:hover {
      color: #ff8a8a;
      background: #2a1818;
      border-color: #5a2828;
    }
    .globe-1-editor-add {
      margin-top: 8px;
      width: 100%;
      background: var(--dial-surface, #232323);
      color: var(--dial-text-secondary, #c0c0c0);
      border: 1px dashed var(--dial-border, #333);
      border-radius: 6px;
      padding: 6px 10px;
      font-family: inherit; font-size: 11px;
      letter-spacing: 0.06em;
      cursor: pointer;
    }
    .globe-1-editor-add:hover {
      background: var(--dial-surface-hover, #2c2c2c);
      color: var(--dial-text-primary, #fff);
      border-color: var(--dial-border-hover, #444);
    }
    .globe-1-editor-hide { display: none !important; }
  `;
  document.head.appendChild(el);
}

export interface InlineEditorHandle {
  destroy(): void;
}

export function mountInlineCountriesEditor(
  panelTitle: string,
  defaultsFallback: Country[],
): InlineEditorHandle {
  ensureEditorStyles();

  let mounted = false;
  let editorEl: HTMLElement | null = null;
  let unsubscribe: (() => void) | null = null;
  let listEl: HTMLDivElement | null = null;
  let countries: Country[] = [];
  let lastSelfPushedJson = '';
  let panelId: string | null = null;
  let hiddenRow: HTMLElement | null = null;

  function readCurrentJson(): string {
    if (!panelId) return '';
    try {
      const value = DialStore.getValue(panelId, 'Countries.countriesJson');
      return typeof value === 'string' ? value : '';
    } catch {
      return '';
    }
  }

  function pushJson() {
    if (!panelId) return;
    const json = JSON.stringify(countries, null, 2);
    lastSelfPushedJson = json;
    try {
      DialStore.updateValue(
        panelId,
        'Countries.countriesJson',
        json as unknown as import('dialkit').DialValue,
      );
    } catch {
      /* swallow — DialStore may not be ready yet */
    }
  }

  function buildRow(idx: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'globe-1-editor-row';
    row.dataset.idx = String(idx);

    const c = countries[idx];
    const nameI = mkInput('text', c.name, 'name');
    const latI = mkInput('number', c.lat, 'lat');
    const lonI = mkInput('number', c.lon, 'lon');

    const del = document.createElement('button');
    del.className = 'globe-1-editor-delete';
    del.type = 'button';
    del.title = 'Remove';
    del.textContent = '×';
    del.addEventListener('click', () => {
      countries.splice(idx, 1);
      renderRows();
      pushJson();
    });

    row.append(nameI, latI, lonI, del);
    return row;
  }

  function mkInput(
    type: 'text' | 'number',
    value: string | number,
    field: 'name' | 'lat' | 'lon',
  ): HTMLInputElement {
    const i = document.createElement('input');
    i.className = 'globe-1-editor-input';
    i.type = type;
    i.value = String(value);
    if (type === 'number') i.step = 'any';
    i.dataset.field = field;
    i.addEventListener('input', () => {
      const row = i.closest('.globe-1-editor-row') as HTMLElement | null;
      const idx = row ? Number(row.dataset.idx) : -1;
      if (idx < 0 || idx >= countries.length) return;
      if (field === 'name') {
        countries[idx] = { ...countries[idx], name: i.value };
      } else {
        const v = parseFloat(i.value);
        const num = Number.isFinite(v) ? v : 0;
        countries[idx] = { ...countries[idx], [field]: num };
      }
      pushJson();
    });
    return i;
  }

  function renderRows() {
    if (!listEl) return;
    listEl.innerHTML = '';
    for (let i = 0; i < countries.length; i++) {
      listEl.appendChild(buildRow(i));
    }
  }

  function buildEditor(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'globe-1-editor';

    const head = document.createElement('div');
    head.className = 'globe-1-editor-head';
    head.innerHTML = '<span>Name</span><span>Lat</span><span>Lon</span>';
    wrap.appendChild(head);

    listEl = document.createElement('div');
    listEl.className = 'globe-1-editor-list';
    wrap.appendChild(listEl);

    const add = document.createElement('button');
    add.className = 'globe-1-editor-add';
    add.type = 'button';
    add.textContent = '+ Add country';
    add.addEventListener('click', () => {
      countries.push({ name: 'NEW', lat: 0, lon: 0 });
      renderRows();
      pushJson();
    });
    wrap.appendChild(add);

    return wrap;
  }

  function tryMount() {
    if (mounted) return true;

    const panels = DialStore.getPanels() as { id: string; name: string }[];
    const panel = panels.find((p) => p.name === panelTitle);
    if (!panel) return false;
    panelId = panel.id;

    const folders = document.querySelectorAll<HTMLElement>('.dialkit-folder');
    let countriesFolder: HTMLElement | null = null;
    for (const f of Array.from(folders)) {
      const t = f.querySelector('.dialkit-folder-title');
      if (t && t.textContent && t.textContent.trim() === 'Countries') {
        countriesFolder = f;
        break;
      }
    }
    if (!countriesFolder) return false;
    const content = countriesFolder.querySelector(
      '.dialkit-folder-content',
    ) as HTMLElement | null;
    if (!content) return false;

    const labels = content.querySelectorAll<HTMLElement>('.dialkit-text-label');
    for (const l of Array.from(labels)) {
      if (l.textContent && l.textContent.trim() === 'Countries Json') {
        const row =
          (l.closest('.dialkit-text-control') ??
            l.closest('.dialkit-labeled-control')) as HTMLElement | null;
        if (row) {
          row.classList.add('globe-1-editor-hide');
          hiddenRow = row;
        }
        break;
      }
    }

    const initialJson = readCurrentJson();
    countries = parseCountries(initialJson, defaultsFallback);
    lastSelfPushedJson = JSON.stringify(countries, null, 2);

    editorEl = buildEditor();
    content.appendChild(editorEl);
    renderRows();

    unsubscribe = DialStore.subscribe(panel.id, () => {
      const incoming = readCurrentJson();
      if (incoming === lastSelfPushedJson) return;
      const next = parseCountries(incoming, defaultsFallback);
      const changed =
        next.length !== countries.length ||
        next.some(
          (c, i) =>
            c.name !== countries[i]?.name ||
            c.lat !== countries[i]?.lat ||
            c.lon !== countries[i]?.lon,
        );
      if (!changed) return;
      countries = next;
      lastSelfPushedJson = JSON.stringify(countries, null, 2);
      renderRows();
    });

    mounted = true;
    return true;
  }

  if (!tryMount()) {
    const observer = new MutationObserver(() => {
      if (tryMount()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return {
      destroy() {
        observer.disconnect();
        unsubscribe?.();
        editorEl?.remove();
        hiddenRow?.classList.remove('globe-1-editor-hide');
      },
    };
  }

  return {
    destroy() {
      unsubscribe?.();
      editorEl?.remove();
      hiddenRow?.classList.remove('globe-1-editor-hide');
    },
  };
}
