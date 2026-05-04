// ============================================================
// Globe 1 — Scroll-driven pitch tracker
// ============================================================
//
// Maps the wrapper element's intersection with the viewport to a
// signed pitch offset (radians). Returned as a 4th rotation term
// for `world.rotation.x`, on top of base + drag + auto-spin.
//
// Designed primarily for the standalone Webflow embed but also works
// in the gallery (the article page scrolls). When `enabled` is false
// the tracker is dormant — no listeners attached, currentPitch eases
// back to 0 and stays there.

import * as THREE from 'three';
import { prefersReducedMotion } from './helpers.ts';

export interface ScrollPitchOpts {
  enabled: boolean;
  rangeDeg: number;   // total swing top→bottom of viewport
  smoothing: number;  // exponential decay rate (1/s); larger = snappier
}

export interface ScrollPitchTracker {
  currentPitch: number;
  update(dt: number, opts: ScrollPitchOpts): void;
  dispose(): void;
}

export function createScrollPitchTracker(wrapper: HTMLElement): ScrollPitchTracker {
  let target = 0;
  let current = 0;
  let attached = false;
  let dirty = true;

  const reduced = prefersReducedMotion();

  const onScrollOrResize = () => { dirty = true; };

  function attach() {
    if (attached) return;
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    attached = true;
    dirty = true;
  }
  function detach() {
    if (!attached) return;
    window.removeEventListener('scroll', onScrollOrResize);
    window.removeEventListener('resize', onScrollOrResize);
    attached = false;
  }

  function recompute(rangeDeg: number) {
    const rect = wrapper.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    // 0 when the wrapper top hits the viewport bottom, 1 when the
    // wrapper bottom hits the viewport top.
    const raw = (vh - rect.top) / Math.max(1, vh + rect.height);
    const t = Math.max(0, Math.min(1, raw));
    const rangeRad = THREE.MathUtils.degToRad(rangeDeg);
    target = (t - 0.5) * rangeRad;
  }

  return {
    get currentPitch() { return current; },
    set currentPitch(v: number) { current = v; },
    update(dt: number, opts: ScrollPitchOpts) {
      if (!opts.enabled || reduced) {
        // Decay back to 0 and detach if it was previously enabled.
        target = 0;
        if (attached) detach();
      } else {
        if (!attached) attach();
        if (dirty) {
          recompute(opts.rangeDeg);
          dirty = false;
        }
      }
      // Exponential filter so a fast scroll doesn't snap.
      const k = Math.max(0.1, opts.smoothing);
      const alpha = 1 - Math.exp(-dt * k);
      current += (target - current) * alpha;
    },
    dispose() {
      detach();
    },
  };
}
