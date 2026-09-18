// ============================================================
// BrandToolView — Figma-style board for the pattern engine.
//
// Infinite stage with multiple frames (each its own GL context +
// engine), a bottom tool bar (move / hand / frame / paint, image,
// play, grow ▾, export ▾) and a right design panel: frame geometry
// on top, DialKit below — bound to whichever frame is selected.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DialRoot, DialStore, useDialKitController, type DialConfig, type DialValue } from 'dialkit-next';
import 'dialkit-next/styles.css';
import './brand-tool.css';
import { brandTools, findBrandTool } from './registry.ts';
import type { BrandEngine } from './types.ts';
import type { PatternEngineBase } from './PatternEngineBase.ts';
import {
  MAX_FRAMES, MAX_ZOOM, MIN_ZOOM,
  boundsOf, fitViewTo, loadBoard, makeFrame, saveBoard, uid,
  type BoardState, type Frame, type View,
} from './frames.ts';
import { FrameView } from './FrameView.tsx';
import { Toolbar, type Tool } from './Toolbar.tsx';
import { Sidebar } from './Sidebar.tsx';
import { buildVisibilityCss } from './panelVisibility.ts';
import { ASPECTS, aspectOf } from './frames.ts';
import {
  buildSvg, copyText, downloadBlob, pixelsToPngBlob, stamp, svgToCssBackground, type ExportFormat,
} from './export.ts';

// ── DialKit helpers ──────────────────────────────────────────

function isTyped(spec: unknown): spec is { type: string } {
  return typeof spec === 'object' && spec !== null && !Array.isArray(spec) && 'type' in (spec as object);
}

function buildPathMap(config: Record<string, unknown>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const walk = (obj: Record<string, unknown>, prefix: string[]) => {
    for (const [k, spec] of Object.entries(obj)) {
      if (k === '_collapsed') continue;
      if (typeof spec === 'object' && spec !== null && !Array.isArray(spec) && !isTyped(spec)) {
        walk(spec as Record<string, unknown>, [...prefix, k]);
      } else if (!isTyped(spec) || spec.type !== 'action') {
        map.set(k, [...prefix, k]);
      }
    }
  };
  walk(config, []);
  return map;
}

function flatten(nested: Record<string, unknown>, out: Record<string, unknown> = {}): Record<string, unknown> {
  for (const [k, v] of Object.entries(nested)) {
    if (k === '_collapsed') continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && !isTyped(v)) flatten(v as Record<string, unknown>, out);
    else if (!isTyped(v) || v.type !== 'action') out[k] = v;
  }
  return out;
}

function nest(flat: Record<string, unknown>, pathMap: Map<string, string[]>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    const path = pathMap.get(k);
    if (!path) continue;
    let cur = out;
    for (let i = 0; i < path.length - 1; i++) cur = (cur[path[i]] ??= {}) as Record<string, unknown>;
    cur[path[path.length - 1]] = v;
  }
  return out;
}

function toPaths(values: Record<string, unknown>, pathMap: Map<string, string[]>): Record<string, DialValue> {
  const out: Record<string, DialValue> = {};
  for (const [k, v] of Object.entries(values)) {
    const path = pathMap.get(k);
    if (path) out[path.join('.')] = v as DialValue;
  }
  return out;
}

if (import.meta.env.DEV) (window as unknown as { __brandDialStore?: typeof DialStore }).__brandDialStore = DialStore;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── component ────────────────────────────────────────────────

interface BrandToolViewProps {
  slug?: string;
  onBack: () => void;
}

export function BrandToolView({ slug, onBack }: BrandToolViewProps) {
  const tool = findBrandTool(slug) ?? brandTools[0];
  const panelName = tool.title;
  const storageKey = `brand:${tool.slug}`;
  const boardKey = `brand:board:${tool.slug}`;

  // Frame geometry lives in the same panel as the pattern controls.
  const fullConfig = useMemo(() => ({
    Frame: {
      frameName: { type: 'text', default: 'Frame 1', placeholder: 'Name' },
      aspect: { type: 'select', options: ['Custom', ...ASPECTS.map((a) => a.id)], default: '16:9' },
      width: [1920, 64, 8192, 1],
      height: [1080, 64, 8192, 1],
      'Duplicate Frame': { type: 'action' },
      'Delete Frame': { type: 'action' },
    },
    ...tool.controls.dialConfig,
  }) as Record<string, Record<string, unknown>>, [tool]);
  const FRAME_KEYS = useMemo(() => new Set(['frameName', 'aspect', 'width', 'height']), []);
  const schema = useMemo(() => {
    const s: Record<string, unknown> = {};
    Object.entries(fullConfig).forEach(([folder, params], i) => {
      s[folder] = { _collapsed: i > 1, ...params };
    });
    return s as DialConfig;
  }, [fullConfig]);
  const pathMap = useMemo(() => buildPathMap(fullConfig), [fullConfig]);

  // ── Board state ────────────────────────────────────────────
  const [board, setBoard] = useState<BoardState>(() => {
    const loaded = loadBoard(boardKey);
    if (loaded && loaded.frames.length) {
      loaded.frames = loaded.frames.map((f, i) => makeFrame({ ...f, params: { ...tool.controls.defaults, ...f.params } }, i + 1));
      return loaded;
    }
    const first = makeFrame({ name: 'Frame 1', x: 0, y: 0, w: 1920, h: 1080, params: { ...tool.controls.defaults } }, 1);
    return { frames: [first], selectedId: first.id, view: { zoom: 0.4, x: 0, y: 0 } };
  });
  const { frames, selectedId, view } = board;
  const selected = frames.find((f) => f.id === selectedId) ?? null;
  const selectedRef = useRef<Frame | null>(selected);
  selectedRef.current = selected;
  const boardRef = useRef(board);
  boardRef.current = board;

  const setView = useCallback((fn: (v: View) => View) => setBoard((b) => ({ ...b, view: fn(b.view) })), []);
  const patchFrame = useCallback((id: string, patch: Partial<Frame>) => {
    setBoard((b) => ({ ...b, frames: b.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  }, []);
  const select = useCallback((id: string | null) => setBoard((b) => (b.selectedId === id ? b : { ...b, selectedId: id })), []);

  // Persist (debounced)
  useEffect(() => {
    const t = setTimeout(() => saveBoard(boardKey, board), 400);
    return () => clearTimeout(t);
  }, [board, boardKey]);

  // ── Engines ────────────────────────────────────────────────
  const enginesRef = useRef(new Map<string, BrandEngine>());
  const pushGeometryRef = useRef<(f: Frame) => void>(() => {});
  const imagesRef = useRef(new Map<string, { bmp: ImageBitmap; name: string }>());
  const [toolMode, setToolMode] = useState<Tool>('select');
  const toolRef = useRef(toolMode);
  toolRef.current = toolMode;
  const [error, setError] = useState<string | null>(null);
  const [, bump] = useState(0);

  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;
  const onEngine = useCallback((id: string, engine: BrandEngine | null) => {
    const map = enginesRef.current;
    if (engine) {
      map.set(id, engine);
      (engine as PatternEngineBase).brushEnabled = toolRef.current === 'select' && selectedIdRef.current === id;
      (engine as PatternEngineBase).onExtinct = (regrown) => {
        const name = boardRef.current.frames.find((f) => f.id === id)?.name ?? 'Frame';
        flash(regrown ? `${name}: pattern died out — regrowing` : `${name}: pattern died out — press R`);
      };
      const img = imagesRef.current.get(id);
      if (img) engine.setImage(img.bmp);
    } else {
      map.delete(id);
    }
  }, []);

  // Only the selected frame can be painted, and only with the Move tool
  useEffect(() => {
    for (const [id, e] of enginesRef.current) (e as PatternEngineBase).brushEnabled = toolMode === 'select' && id === selectedId;
  }, [toolMode, selectedId]);

  // One render loop for every frame
  useEffect(() => {
    let raf = 0;
    let disposed = false;
    let last = performance.now();
    let t = 0;
    const loop = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      for (const e of enginesRef.current.values()) {
        try { e.frame(t, dt); }
        catch (err) { setError(err instanceof Error ? err.message : String(err)); disposed = true; return; }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { disposed = true; cancelAnimationFrame(raf); };
  }, []);

  // ── Toast ──────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // ── DialKit — bound to the selected frame ──────────────────
  const panelId = useCallback(() => DialStore.getPanels().find((p) => p.name === panelName)?.id, [panelName]);
  const syncingRef = useRef(false);
  const lastPushedRef = useRef<string | null>(null);

  const resetFolder = useCallback((folder: string) => {
    const id = panelId();
    if (!id) return;
    const defaults = tool.controls.defaults;
    const updates: Record<string, DialValue> = {};
    for (const [key, path] of pathMap) {
      if (path[0] === folder && key in defaults) updates[path.join('.')] = defaults[key] as DialValue;
    }
    DialStore.updateValues(id, updates);
    const sel = selectedRef.current;
    if (sel) {
      for (const k of Object.keys(updates)) {
        const key = k.split('.').pop()!;
        sel.params[key] = defaults[key];
      }
      enginesRef.current.get(sel.id)?.reseed(imagesRef.current.has(sel.id) && sel.params.imageMode !== 'Off' ? 'image' : 'center');
    }
  }, [panelId, pathMap, tool.controls.defaults]);

  const frameActionsRef = useRef<{ add: () => void; duplicate: () => void; remove: () => void; upload: () => void; clearImage: () => void }>({
    add: () => {}, duplicate: () => {}, remove: () => {}, upload: () => {}, clearImage: () => {},
  });
  const onAction = useCallback((path: string) => {
    const leaf = path.split('.').pop() ?? path;
    const sel = selectedRef.current;
    const e = sel ? enginesRef.current.get(sel.id) : undefined;
    const fa = frameActionsRef.current;
    if (leaf === 'Duplicate Frame') { fa.duplicate(); return; }
    if (leaf === 'Delete Frame') { fa.remove(); return; }
    if (leaf === 'Upload Image') { fa.upload(); return; }
    if (leaf === 'Remove Image') { fa.clearImage(); return; }
    if (leaf === 'Reset All') {
      const id = panelId();
      if (id) { DialStore.clearActivePreset(id); DialStore.resetValues(id); }
      if (sel) Object.assign(sel.params, tool.controls.defaults);
      e?.reseed('center');
      return;
    }
    if (/^Reset /.test(leaf)) { resetFolder(leaf.slice(6).trim()); return; }
    if (!e || !sel) return;
    if (leaf === 'Reseed') e.reseed(imagesRef.current.has(sel.id) && sel.params.imageMode !== 'Off' ? 'image' : 'center');
    else if (leaf === 'Random Spots') e.reseed('random');
    else if (leaf === 'Clear') e.reseed('clear');
  }, [resetFolder, panelId, tool.controls.defaults]);

  const dial = useDialKitController(panelName, schema, { id: storageKey, persist: true, onAction });

  // Panel values → selected frame params (skip while we push a frame in)
  const flat = flatten(dial.values as unknown as Record<string, unknown>);
  // Only while the panel is bound to this frame (after its params were pushed)
  const bound = !syncingRef.current && !!selected && lastPushedRef.current === selected.id;
  if (bound && selected) {
    for (const [k, v] of Object.entries(flat)) if (!FRAME_KEYS.has(k)) selected.params[k] = v;
  }

  const setFlat = useCallback((values: Record<string, unknown>) => {
    if (selectedRef.current) Object.assign(selectedRef.current.params, values);
    dial.setValues(nest(values, pathMap) as Parameters<typeof dial.setValues>[0]);
  }, [dial, pathMap]);

  type Geom = { name: string; w: number; h: number; aspect: string };
  /** Last geometry the panel showed — diffs against it are panel-originated edits. */
  const panelGeomRef = useRef<Geom | null>(null);

  /** Push the selected frame's geometry into the Frame folder (board → panel). */
  const pushGeometry = useCallback((f: Frame) => {
    const id = panelId();
    if (!id) return;
    const g: Geom = { name: f.name, w: f.w, h: f.h, aspect: aspectOf(f) ?? 'Custom' };
    panelGeomRef.current = g;
    syncingRef.current = true;
    DialStore.updateValues(id, toPaths({ frameName: g.name, width: g.w, height: g.h, aspect: g.aspect }, pathMap));
    syncingRef.current = false;
  }, [panelId, pathMap]);
  pushGeometryRef.current = pushGeometry;

  // Frame folder → frame geometry (panel → board), only for panel-originated changes
  const lastPresetRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!bound || !selected) return;
    // A version was just loaded: versions describe the look, not the frame —
    // put the frame's own geometry back instead of syncing the loaded one.
    const id = panelId();
    const preset = id ? DialStore.getActivePresetId(id) : null;
    if (lastPresetRef.current !== undefined && preset !== lastPresetRef.current) {
      lastPresetRef.current = preset;
      pushGeometry(selected);
      return;
    }
    lastPresetRef.current = preset;

    const cur: Geom = {
      name: String(flat.frameName ?? ''),
      w: Math.round(Number(flat.width)),
      h: Math.round(Number(flat.height)),
      aspect: String(flat.aspect ?? 'Custom'),
    };
    const prev = panelGeomRef.current;
    panelGeomRef.current = cur;
    if (!prev) return;

    const patch: Partial<Frame> = {};
    if (cur.name !== prev.name && cur.name) patch.name = cur.name;
    if (cur.w !== prev.w && Number.isFinite(cur.w) && cur.w >= 64) patch.w = cur.w;
    if (cur.h !== prev.h && Number.isFinite(cur.h) && cur.h >= 64) patch.h = cur.h;
    if (cur.aspect !== prev.aspect) {
      const a = ASPECTS.find((x) => x.id === cur.aspect);
      if (a) {
        const nh = Math.round((patch.w ?? selected.w) * a.h / a.w);
        patch.h = nh;
        cur.h = nh;
        if (id) { syncingRef.current = true; DialStore.updateValue(id, 'Frame.height', nh); syncingRef.current = false; }
      }
    } else if ((patch.w !== undefined || patch.h !== undefined) && cur.aspect !== 'Custom') {
      const nw = patch.w ?? selected.w, nh = patch.h ?? selected.h;
      if (aspectOf({ w: nw, h: nh }) !== cur.aspect) {
        cur.aspect = 'Custom';
        if (id) { syncingRef.current = true; DialStore.updateValue(id, 'Frame.aspect', 'Custom'); syncingRef.current = false; }
      }
    }
    if (Object.keys(patch).length) patchFrame(selected.id, patch);
  }, [bound, selected, flat.frameName, flat.width, flat.height, flat.aspect, patchFrame, panelId, pushGeometry, dial.values]);

  // Selection change → push that frame's params into the panel
  useEffect(() => {
    const id = panelId();
    if (!id || !selected || lastPushedRef.current === selected.id) return;
    lastPushedRef.current = selected.id;
    syncingRef.current = true;
    DialStore.clearActivePreset(id);
    lastPresetRef.current = null;
    const aspect = aspectOf(selected) ?? 'Custom';
    panelGeomRef.current = { name: selected.name, w: selected.w, h: selected.h, aspect };
    DialStore.updateValues(id, toPaths({
      ...selected.params, frameName: selected.name, width: selected.w, height: selected.h, aspect,
    }, pathMap));
    syncingRef.current = false;
  }, [selected, panelId, pathMap, dial.values]);

  // Built-in presets → DialKit versions (seeded once, persisted)
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    const id = panelId();
    if (!id) return;
    seededRef.current = true;
    const flag = `${storageKey}:seeded:v2`;
    if (localStorage.getItem(flag)) return;
    // Re-seed once: earlier versions carried frame geometry in them.
    for (const pr of DialStore.getPresets(id)) DialStore.deletePreset(id, pr.id);
    const before = Object.fromEntries(
      Object.entries(DialStore.getValues(id)).filter(([path]) => !path.startsWith('Frame.')),
    );
    let firstId: string | null = null;
    for (const [name, values] of Object.entries(tool.controls.presets ?? {})) {
      DialStore.clearActivePreset(id);
      DialStore.updateValues(id, { ...before, ...toPaths(values as Record<string, unknown>, pathMap) });
      const pid = DialStore.savePreset(id, name);
      firstId ??= pid;
    }
    if (firstId) DialStore.loadPreset(id, firstId);
    else DialStore.updateValues(id, before);
    localStorage.setItem(flag, '1');
  }, [panelId, storageKey, tool, pathMap, dial.values]);

  // Contextual visibility — the panel reacts to the selection / modes.
  // Emitted as CSS so it is in force before DialKit measures folders.
  const selHasImage = !!(selected && imagesRef.current.has(selected.id));
  const visibilityCss = useMemo(() => {
    if (!selected) {
      return buildVisibilityCss(fullConfig, { hiddenKeys: [], hiddenFolders: Object.keys(fullConfig) });
    }
    // Actions live in the toolbar; the panel holds parameters only
    const hidden: string[] = ['Reseed', 'Random Spots', 'Clear', 'Reset All', 'paused'];
    const changed: string[] = [];
    const defaults = tool.controls.defaults;
    for (const [k, v] of Object.entries(flat)) {
      if (FRAME_KEYS.has(k) || !(k in defaults)) continue;
      const d = defaults[k];
      const same = typeof v === 'number' && typeof d === 'number'
        ? Math.abs(v - d) < 1e-9
        : typeof v === 'string' && typeof d === 'string' ? v.toLowerCase() === d.toLowerCase() : v === d;
      if (!same) changed.push(k);
    }
    if (!selHasImage) hidden.push('Remove Image', 'imageMode', 'imageInfluence', 'imageInvert', 'imageFill', 'imageBlend');
    if (flat.mapMode === 'None') hidden.push('mapFeed', 'mapKill', 'mapScale', 'mapAngle', 'mapDrift');
    if (!((flat.anisotropy as number) > 0)) hidden.push('flowAngle');
    const mode = flat.renderMode;
    if (mode !== 'Outline') hidden.push('lineWidth');
    if (mode !== 'Emboss') hidden.push('embossHeight', 'lightAngle');
    if (mode !== 'Dots') hidden.push('dotScale');
    return buildVisibilityCss(fullConfig, { hiddenKeys: hidden, changedKeys: changed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, selHasImage, JSON.stringify(flat), fullConfig, tool.controls.defaults, FRAME_KEYS]);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  useLayoutEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      styleRef.current.setAttribute('data-brand-visibility', '');
      document.head.appendChild(styleRef.current);
    }
    styleRef.current.textContent = visibilityCss;
  }, [visibilityCss]);
  useEffect(() => () => { styleRef.current?.remove(); styleRef.current = null; }, []);

  // Theme select ↔ colour controls
  const lastThemeRef = useRef<string>(String(flat.theme ?? 'Custom'));
  useEffect(() => {
    const theme = String(flat.theme ?? 'Custom');
    const def = tool.themes.find((t) => t.name === theme);
    if (theme !== lastThemeRef.current) {
      lastThemeRef.current = theme;
      if (def) setFlat(def.values);
      return;
    }
    if (def && Object.entries(def.values).some(([k, v]) => flat[k] !== v)) {
      lastThemeRef.current = 'Custom';
      setFlat({ theme: 'Custom' });
    }
  }, [flat.theme, flat.bgColor, flat.fgColor, flat.accentColor, flat.accentMix, tool.themes, setFlat, flat]);

  // ── Stage: view transform, pan / zoom ──────────────────────
  const stageRef = useRef<HTMLDivElement>(null);
  const spaceRef = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [ghost, setGhost] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const stageSize = () => {
    const s = stageRef.current;
    return { w: s?.clientWidth ?? 800, h: s?.clientHeight ?? 600 };
  };
  const toWorld = useCallback((sx: number, sy: number, v: View = boardRef.current.view) => {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      x: (sx - r.left - r.width / 2 - v.x) / v.zoom,
      y: (sy - r.top - r.height / 2 - v.y) / v.zoom,
    };
  }, []);

  const fitAll = useCallback(() => {
    const b = boundsOf(boardRef.current.frames);
    if (!b) return;
    const { w, h } = stageSize();
    setView(() => fitViewTo(b, w, h));
  }, [setView]);
  const zoomToSelection = useCallback(() => {
    const sel = selectedRef.current;
    if (!sel) { fitAll(); return; }
    const { w, h } = stageSize();
    setView(() => fitViewTo(sel, w, h, 100));
  }, [fitAll, setView]);
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current) return;
    fittedRef.current = true;
    const loaded = loadBoard(boardKey);
    if (!loaded) fitAll();
  }, [fitAll, boardKey]);

  const zoomAround = useCallback((factor: number, sx?: number, sy?: number) => {
    const stage = stageRef.current;
    setView((v) => {
      const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const k = zoom / v.zoom;
      if (!stage || sx === undefined || sy === undefined) return { zoom, x: v.x * k, y: v.y * k };
      const r = stage.getBoundingClientRect();
      const cx = sx - (r.left + r.width / 2);
      const cy = sy - (r.top + r.height / 2);
      return { zoom, x: cx + (v.x - cx) * k, y: cy + (v.y - cy) * k };
    });
  }, [setView]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAround(Math.exp(-e.deltaY * 0.004), e.clientX, e.clientY);
      else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAround, setView]);

  // ── Frame ops ──────────────────────────────────────────────
  const addFrame = useCallback((preset: { w: number; h: number } | null, at?: { x: number; y: number }) => {
    const b = boardRef.current;
    if (b.frames.length >= MAX_FRAMES) { flash(`Up to ${MAX_FRAMES} frames (one WebGL context each)`); return; }
    const sel = b.frames.find((f) => f.id === b.selectedId) ?? null;
    const w = preset?.w ?? sel?.w ?? 1920;
    const h = preset?.h ?? sel?.h ?? 1080;
    // Source of the look: the panel's current values
    const params = { ...tool.controls.defaults, ...(sel?.params ?? {}) };
    let x: number, y: number;
    if (at) { x = Math.round(at.x - w / 2); y = Math.round(at.y - h / 2); }
    else {
      const bounds = boundsOf(b.frames);
      x = bounds ? Math.round(bounds.x + bounds.w + 120) : 0;
      y = bounds ? Math.round(bounds.y) : 0;
    }
    const frame = makeFrame({ id: uid(), name: `Frame ${b.frames.length + 1}`, x, y, w, h, params }, b.frames.length + 1);
    setBoard((s) => ({ ...s, frames: [...s.frames, frame], selectedId: frame.id }));
    setToolMode('select');
    return frame;
  }, [flash, tool.controls.defaults]);

  const duplicateFrame = useCallback(() => {
    const b = boardRef.current;
    const sel = b.frames.find((f) => f.id === b.selectedId);
    if (!sel) return;
    if (b.frames.length >= MAX_FRAMES) { flash(`Up to ${MAX_FRAMES} frames (one WebGL context each)`); return; }
    const frame = makeFrame({
      id: uid(), name: `${sel.name} copy`, x: sel.x + sel.w + 120, y: sel.y, w: sel.w, h: sel.h, params: { ...sel.params },
    }, b.frames.length + 1);
    setBoard((s) => ({ ...s, frames: [...s.frames, frame], selectedId: frame.id }));
  }, [flash]);

  const deleteFrame = useCallback(() => {
    const b = boardRef.current;
    if (!b.selectedId) return;
    const id = b.selectedId;
    imagesRef.current.get(id)?.bmp.close();
    imagesRef.current.delete(id);
    setBoard((s) => {
      const frames = s.frames.filter((f) => f.id !== id);
      return { ...s, frames, selectedId: frames[frames.length - 1]?.id ?? null };
    });
  }, []);

  // ── Pointer interaction (capture so paint never fires for non-brush tools)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    type Drag =
      | { kind: 'pan'; id: number; sx: number; sy: number; vx: number; vy: number }
      | { kind: 'move'; id: number; frameId: string; sx: number; sy: number; fx: number; fy: number; moved: boolean }
      | { kind: 'draw'; id: number; ox: number; oy: number }
      | { kind: 'resize'; id: number; frameId: string; handle: string; sx: number; sy: number; f: { x: number; y: number; w: number; h: number } };
    let drag: Drag | null = null;

    const frameAt = (el: EventTarget | null): string | null =>
      (el as HTMLElement | null)?.closest?.('[data-frame-id]')?.getAttribute('data-frame-id') ?? null;

    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.bt-ui')) return;
      const t = toolRef.current;
      const pan = e.button === 1 || spaceRef.current;
      const fid = frameAt(e.target);
      const onLabel = !!(e.target as HTMLElement).closest?.('.bt-frame-label');
      const handle = (e.target as HTMLElement).getAttribute?.('data-handle');
      if (!pan && handle && fid) {
        e.stopPropagation(); e.preventDefault();
        const f = boardRef.current.frames.find((x) => x.id === fid)!;
        drag = { kind: 'resize', id: e.pointerId, frameId: fid, handle, sx: e.clientX, sy: e.clientY, f: { x: f.x, y: f.y, w: f.w, h: f.h } };
      } else if (pan) {
        e.stopPropagation(); e.preventDefault();
        const v = boardRef.current.view;
        drag = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      } else if (t === 'frame') {
        e.stopPropagation(); e.preventDefault();
        const w = toWorld(e.clientX, e.clientY);
        drag = { kind: 'draw', id: e.pointerId, ox: w.x, oy: w.y };
      } else if (fid && fid === boardRef.current.selectedId && !onLabel) {
        // Inside the selected frame: paint (alt = erase). Event reaches the canvas.
        const eng = enginesRef.current.get(fid) as PatternEngineBase | undefined;
        if (eng) eng.brushErase = e.altKey;
        return;
      } else if (fid) {
        // Unselected frame or its label: select + move
        e.stopPropagation(); e.preventDefault();
        const f = boardRef.current.frames.find((x) => x.id === fid)!;
        select(fid);
        drag = { kind: 'move', id: e.pointerId, frameId: fid, sx: e.clientX, sy: e.clientY, fx: f.x, fy: f.y, moved: false };
      } else {
        // Empty stage: deselect + pan
        e.stopPropagation(); e.preventDefault();
        select(null);
        const v = boardRef.current.view;
        drag = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y };
      }
      if (drag) {
        stage.dataset.drag = drag.kind;
        try { stage.setPointerCapture(e.pointerId); } catch { /* synthetic / already released */ }
        if (drag.kind === 'pan') stage.classList.add('panning');
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation();
      const d = drag;
      if (d.kind === 'pan') {
        setView((v) => ({ ...v, x: d.vx + e.clientX - d.sx, y: d.vy + e.clientY - d.sy }));
      } else if (d.kind === 'resize') {
        const z = boardRef.current.view.zoom;
        let dx = (e.clientX - d.sx) / z;
        let dy = (e.clientY - d.sy) / z;
        const { x, y, w, h } = d.f;
        const left = d.handle.includes('w'), top = d.handle.includes('n');
        if (e.shiftKey) {
          // keep aspect: follow the dominant axis
          const r = w / h;
          const sw = left ? -dx : dx, sh = top ? -dy : dy;
          if (Math.abs(sw) > Math.abs(sh) * r) { const nw = Math.max(64, w + sw); dy = (top ? -1 : 1) * (nw / r - h); dx = (left ? -1 : 1) * (nw - w); }
          else { const nh = Math.max(64, h + sh); dx = (left ? -1 : 1) * (nh * r - w); dy = (top ? -1 : 1) * (nh - h); }
        }
        let nw = Math.round(left ? w - dx : w + dx);
        let nh = Math.round(top ? h - dy : h + dy);
        nw = Math.max(64, nw); nh = Math.max(64, nh);
        patchFrame(d.frameId, {
          w: nw, h: nh,
          x: left ? Math.round(x + w - nw) : x,
          y: top ? Math.round(y + h - nh) : y,
        });
      } else if (d.kind === 'move') {
        const z = boardRef.current.view.zoom;
        const dx = (e.clientX - d.sx) / z;
        const dy = (e.clientY - d.sy) / z;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) d.moved = true;
        patchFrame(d.frameId, { x: Math.round(d.fx + dx), y: Math.round(d.fy + dy) });
      } else {
        const w = toWorld(e.clientX, e.clientY);
        setGhost({ x: Math.min(d.ox, w.x), y: Math.min(d.oy, w.y), w: Math.abs(w.x - d.ox), h: Math.abs(w.y - d.oy) });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      e.stopPropagation();
      const d = drag;
      drag = null;
      delete stage.dataset.drag;
      stage.classList.remove('panning');
      if (d.kind === 'resize') {
        const f = boardRef.current.frames.find((x) => x.id === d.frameId);
        if (f) pushGeometryRef.current(f);
      }
      if (d.kind === 'draw') {
        const w = toWorld(e.clientX, e.clientY);
        const gw = Math.abs(w.x - d.ox);
        const gh = Math.abs(w.y - d.oy);
        setGhost(null);
        if (gw > 40 && gh > 40) {
          const f = addFrame({ w: Math.round(gw), h: Math.round(gh) }, { x: (d.ox + w.x) / 2, y: (d.oy + w.y) / 2 });
          if (f) patchFrame(f.id, { x: Math.round(Math.min(d.ox, w.x)), y: Math.round(Math.min(d.oy, w.y)) });
        } else {
          addFrame(null, { x: d.ox, y: d.oy });
        }
      }
    };
    stage.addEventListener('pointerdown', onDown, true);
    stage.addEventListener('pointermove', onMove, true);
    stage.addEventListener('pointerup', onUp, true);
    stage.addEventListener('pointercancel', onUp, true);
    return () => {
      stage.removeEventListener('pointerdown', onDown, true);
      stage.removeEventListener('pointermove', onMove, true);
      stage.removeEventListener('pointerup', onUp, true);
      stage.removeEventListener('pointercancel', onUp, true);
    };
  }, [toWorld, select, patchFrame, setView, addFrame]);

  // ── Images (per frame, not persisted) ──────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadImageFile = useCallback(async (file: File) => {
    const sel = selectedRef.current;
    if (!file.type.startsWith('image/') || !sel) return;
    try {
      const bmp = await createImageBitmap(file);
      imagesRef.current.get(sel.id)?.bmp.close();
      imagesRef.current.set(sel.id, { bmp, name: file.name });
      const e = enginesRef.current.get(sel.id);
      e?.setImage(bmp);
      if (sel.params.imageMode === 'Off') setFlat({ imageMode: 'Mask' });
      e?.reseed('image');
      bump((n) => n + 1);
    } catch (err) {
      setError(`Could not load image: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [setFlat]);

  const clearImage = useCallback(() => {
    const sel = selectedRef.current;
    if (!sel) return;
    imagesRef.current.get(sel.id)?.bmp.close();
    imagesRef.current.delete(sel.id);
    enginesRef.current.get(sel.id)?.setImage(null);
    setFlat({ imageMode: 'Off', imageBlend: 0 });
    bump((n) => n + 1);
  }, [setFlat]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) loadImageFile(f);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadImageFile]);
  useEffect(() => () => { for (const i of imagesRef.current.values()) i.bmp.close(); }, []);

  // ── Keyboard ───────────────────────────────────────────────
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (e.key === ' ') { e.preventDefault(); if (!spaceRef.current) { spaceRef.current = true; setSpaceHeld(true); } return; }
      if ((e.metaKey || e.ctrlKey) && k === 'd') { e.preventDefault(); duplicateFrame(); return; }
      if (e.metaKey || e.ctrlKey) return;
      if (k === 'v') setToolMode('select');
      else if (k === 'f') setToolMode('frame');
      else if (k === 'r') onAction('Reseed');
      else if (k === 'c') onAction('Clear');
      else if (k === 'p') { const s = selectedRef.current; if (s) setFlat({ paused: !s.params.paused }); }
      else if (e.key === '0') fitAll();
      else if (e.key === '1') setView((v) => ({ ...v, zoom: 1 }));
      else if (e.key === '2') zoomToSelection();
      else if (e.key === '=' || e.key === '+') zoomAround(1.2);
      else if (e.key === '-') zoomAround(1 / 1.2);
      else if (e.key === 'Backspace' || e.key === 'Delete') deleteFrame();
      else if (e.key === 'Escape') { if (toolRef.current !== 'select') setToolMode('select'); else if (selectedRef.current) select(null); else onBack(); }
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === ' ') { spaceRef.current = false; setSpaceHeld(false); } };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp); };
  }, [onAction, setFlat, fitAll, zoomToSelection, zoomAround, duplicateFrame, deleteFrame, select, onBack, setView]);

  // ── Export (selected frame) ────────────────────────────────
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(1);
  const [detail, setDetail] = useState(0.5);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [busy, setBusy] = useState(false);

  const runExport = useCallback(async () => {
    const sel = selectedRef.current;
    const e = sel ? enginesRef.current.get(sel.id) : undefined;
    if (!sel || !e || busy) return;
    setBusy(true);
    const P = sel.params;
    const W = sel.w * scale, H = sel.h * scale;
    const base = `${sel.name.replace(/\s+/g, '-').toLowerCase()}-${stamp()}`;
    try {
      if (format === 'png' || format === 'png-mask') {
        const px = e.renderToPixels(W, H, { transparent: format === 'png-mask' });
        downloadBlob(`${base}${format === 'png-mask' ? '-mask' : ''}.png`, await pixelsToPngBlob(px, W, H));
        flash(`PNG ${W}×${H} saved`);
      } else {
        const kind = format === 'css' ? 'svg-mask' : format;
        const { svg, contours } = buildSvg(e, kind, {
          width: W, height: H,
          threshold: (P.threshold as number) ?? 0.5, invert: !!P.invert,
          fg: P.fgColor as string, bg: P.bgColor as string,
          tolerance: 0.1 + (1 - detail) * 1.4, strokeWidth,
        });
        if (format === 'css') {
          flash((await copyText(svgToCssBackground(svg, W, H))) ? `CSS snippet copied (${contours} shapes)` : 'Clipboard blocked');
        } else {
          downloadBlob(`${base}-${format.replace('svg-', '')}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
          flash(`SVG saved · ${contours} shapes`);
        }
      }
    } catch (err) {
      flash(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [busy, format, scale, detail, strokeWidth, flash]);

  frameActionsRef.current = {
    add: () => addFrame(null),
    duplicate: duplicateFrame,
    remove: deleteFrame,
    upload: () => fileInputRef.current?.click(),
    clearImage,
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={`brand-tool${spaceHeld ? ' space-held' : ''}`}>
      <div
        ref={stageRef}
        className={`bt-stage${dragOver ? ' drag-over' : ''}`}
        data-tool={toolMode}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) loadImageFile(f);
        }}
      >
        <div className="bt-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          {frames.map((f) => (
            <FrameView
              key={f.id}
              frame={f}
              zoom={view.zoom}
              selected={f.id === selectedId}
              tool={tool}
              onEngine={onEngine}
              onError={setError}
            />
          ))}
          {ghost && <div className="bt-ghost" style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h }} />}
        </div>
        {frames.length === 0 && <div className="bt-empty-stage">Press F, or pick a frame size from the toolbar, to start</div>}
        {dragOver && <div className="bt-drop-hint">{selected ? `Drop to seed “${selected.name}”` : 'Select a frame first'}</div>}
        {error && (
          <div className="bt-error bt-ui">
            <strong>Engine error</strong>
            <pre>{error}</pre>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) loadImageFile(f); e.target.value = ''; }}
      />

      <Toolbar
        tool={toolMode}
        setTool={setToolMode}
        hasSelection={!!selected}
        paused={!!selected?.params.paused}
        onTogglePause={() => { if (selected) setFlat({ paused: !selected.params.paused }); }}
        onGrow={onAction}
        onAddFrame={(preset) => addFrame(preset)}
        exportFormat={format}
        setExportFormat={setFormat}
        exportScale={scale}
        setExportScale={setScale}
        exportDetail={detail}
        setExportDetail={setDetail}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        exportSize={selected ? { w: selected.w, h: selected.h } : null}
        onExport={runExport}
        exporting={busy}
      />

      <Sidebar hasFrame={!!selected} frameCount={frames.length}>
        <div className="bt-panel-root">
          <DialRoot mode="inline" theme="dark" productionEnabled defaultOpen />
        </div>
      </Sidebar>

      {toast && <div className="bt-toast">{toast}</div>}
    </div>
  );
}
