// ============================================================
// LayerStack — Draggable layer z-order reorder panel
// Pointer-event based drag for smooth, performant reordering.
// Updates layer order params through DialStore for persistence.
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { DialStore } from 'dialkit';
import type { LayerOrderEntry } from '../core/Experiment.ts';
import './layer-stack.css';

interface LayerStackProps {
  params: Record<string, unknown>;
  panelName: string;
  layers: LayerOrderEntry[];
}

interface DragState {
  layerId: string;
  startY: number;
  startIndex: number;
  currentY: number;
}

/**
 * Build an ordered list of layers sorted by their current order value
 * (highest order = top of visual stack = first in the list).
 */
function getSortedLayers(
  layers: LayerOrderEntry[],
  params: Record<string, unknown>,
): LayerOrderEntry[] {
  return [...layers].sort((a, b) => {
    const orderA = (params[a.orderKey] as number) ?? 0;
    const orderB = (params[b.orderKey] as number) ?? 0;
    return orderB - orderA; // highest order first (top of stack)
  });
}

export function LayerStack({ params, panelName, layers }: LayerStackProps) {
  // Local order state — sorted top-to-bottom (highest order first)
  const [sortedLayers, setSortedLayers] = useState(() =>
    getSortedLayers(layers, params),
  );
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemHeight = 36;

  // Re-sync from params when they change externally (e.g. preset switch)
  const lastPresetRef = useRef<unknown>(params._presetChanged);
  useEffect(() => {
    if (params._presetChanged !== lastPresetRef.current) {
      lastPresetRef.current = params._presetChanged;
      setSortedLayers(getSortedLayers(layers, params));
    }
  }, [params._presetChanged, layers, params]);

  // Re-sync on reset
  const lastResetRef = useRef<unknown>(params._resetTs);
  useEffect(() => {
    if (params._resetTs !== lastResetRef.current) {
      lastResetRef.current = params._resetTs;
      setSortedLayers(getSortedLayers(layers, params));
    }
  }, [params._resetTs, layers, params]);

  /**
   * Apply new order to params + DialStore for persistence.
   * `orderedLayers` is top-to-bottom (index 0 = highest z).
   */
  const applyOrder = useCallback(
    (orderedLayers: LayerOrderEntry[]) => {
      const maxOrder = orderedLayers.length - 1;

      // Find the DialKit panel
      const panels = DialStore.getPanels();
      const panel = panels.find((p) => p.name === panelName);

      for (let i = 0; i < orderedLayers.length; i++) {
        const layer = orderedLayers[i];
        const orderValue = maxOrder - i; // top = highest number

        // Update params directly (immediate GPU effect)
        params[layer.orderKey] = orderValue;

        // Update DialStore for persistence
        if (panel) {
          const path = `Layer Order.${layer.orderKey}`;
          DialStore.updateValue(
            panel.id,
            path,
            orderValue as unknown as import('dialkit').DialValue,
          );
        }
      }
    },
    [params, panelName],
  );

  // ── Pointer handlers (drag) ──

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, layerId: string) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const index = sortedLayers.findIndex((l) => l.id === layerId);
      setDragState({
        layerId,
        startY: e.clientY,
        startIndex: index,
        currentY: e.clientY,
      });
      setDropIndex(index);
    },
    [sortedLayers],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState) return;

      const dy = e.clientY - dragState.startY;
      const newIndex = Math.max(
        0,
        Math.min(
          sortedLayers.length - 1,
          dragState.startIndex + Math.round(dy / itemHeight),
        ),
      );

      setDragState((prev) => prev ? { ...prev, currentY: e.clientY } : null);
      setDropIndex(newIndex);
    },
    [dragState, sortedLayers.length],
  );

  const handlePointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (!dragState || dropIndex === null) {
        setDragState(null);
        setDropIndex(null);
        return;
      }

      // Reorder: remove dragged item and insert at drop position
      const newOrder = [...sortedLayers];
      const [moved] = newOrder.splice(dragState.startIndex, 1);
      newOrder.splice(dropIndex, 0, moved);

      setSortedLayers(newOrder);
      applyOrder(newOrder);

      setDragState(null);
      setDropIndex(null);
    },
    [dragState, dropIndex, sortedLayers, applyOrder],
  );

  // Compute drag offset for the dragged item
  const dragOffset = dragState ? dragState.currentY - dragState.startY : 0;

  return (
    <div className="layer-stack">
      <div className="layer-stack-header">
        <span className="layer-stack-title">Layers</span>
        <span className="layer-stack-hint">drag to reorder</span>
      </div>
      <div
        className="layer-stack-list"
        ref={listRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Drop indicator */}
        {dragState && dropIndex !== null && (
          <div
            className="layer-stack-drop-indicator"
            style={{
              top: dropIndex * itemHeight + 4,
              opacity: dropIndex !== dragState.startIndex ? 1 : 0,
            }}
          />
        )}

        {sortedLayers.map((layer, index) => {
          const isDragging = dragState?.layerId === layer.id;
          const maxOrder = sortedLayers.length - 1;
          const orderValue = maxOrder - index;

          return (
            <div
              key={layer.id}
              className={`layer-item ${isDragging ? 'layer-item--dragging' : ''}`}
              style={{
                transform: isDragging
                  ? `translateY(${dragOffset}px)`
                  : undefined,
                transition: isDragging ? 'none' : 'transform 150ms ease',
                zIndex: isDragging ? 10 : 1,
              }}
              onPointerDown={(e) => handlePointerDown(e, layer.id)}
            >
              {/* Drag handle (6 dots) */}
              <div className="layer-item-handle">
                <div className="layer-item-handle-dots">
                  <div className="layer-item-handle-dot" />
                  <div className="layer-item-handle-dot" />
                </div>
                <div className="layer-item-handle-dots">
                  <div className="layer-item-handle-dot" />
                  <div className="layer-item-handle-dot" />
                </div>
                <div className="layer-item-handle-dots">
                  <div className="layer-item-handle-dot" />
                  <div className="layer-item-handle-dot" />
                </div>
              </div>

              {/* Color indicator */}
              <div
                className="layer-item-color"
                style={{ background: layer.color }}
              />

              {/* Label */}
              <span className="layer-item-label">{layer.label}</span>

              {/* Order badge */}
              <span className="layer-item-order">{orderValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
