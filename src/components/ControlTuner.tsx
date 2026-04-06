// ============================================================
// ControlTuner — Live tuning page for custom DialKit controls
// Two DialKit panels: "Controls Preview" has the live controls,
// "Tuning" has sliders that drive CSS vars + window.__UB_TUNING__
// ============================================================

import { useDialKit, type DialConfig } from 'dialkit';
import { useEffect } from 'react';

// The controls we want to display — rendered as real UB components
const previewConfig: DialConfig = {
  'Spring C': {
    springC: { type: 'ub-7', default: 0, step: 0.5 },
  },
  'Spring D': {
    springD: { type: 'ub-8', default: 100, step: 1 },
  },
  'Jade Refined': {
    jadeToggle: { type: 'ub-t11', default: true },
  },
  'Warm Accent': {
    warmToggle: { type: 'ub-t6', default: false },
  },
};

// Tuning parameters — standard sliders that drive the controls
const tuningConfig: DialConfig = {
  'Spring Handle': {
    handleWidth: [3, 1, 8, 0.5],
    handleHeight: [20, 8, 36, 1],
    handleRestOpacity: [0.3, 0, 1, 0.01],
    handleHoverOpacity: [0.5, 0, 1, 0.01],
    handleDragOpacity: [0.9, 0, 1, 0.01],
    handleDodgeOpacity: [0.1, 0, 1, 0.01],
    handleDodgeScaleY: [0.75, 0.1, 1, 0.01],
  },
  'Handle Animation': {
    _collapsed: true,
    scaleXDuration: [0.25, 0.05, 1, 0.01],
    scaleXBounce: [0.15, 0, 0.5, 0.01],
    scaleYDuration: [0.2, 0.05, 1, 0.01],
    scaleYBounce: [0.1, 0, 0.5, 0.01],
    opacityDuration: [0.15, 0.01, 0.5, 0.01],
  },
  'Spring Layout': {
    _collapsed: true,
    borderRadius: [8, 0, 20, 1],
    notchHeight: [14, 0, 30, 1],
    notchWidth: [1, 0, 4, 0.5],
    dotWidth: [1, 0, 4, 0.5],
    dotHeight: [8, 2, 20, 1],
    bgTransition: [0.15, 0, 0.5, 0.01],
  },
  'Auto-Scroll Zone': {
    _collapsed: true,
    speedMultiplier: [2, 0.1, 10, 0.1],
    speedExponent: [1.5, 0.5, 3, 0.1],
    speedDivisor: [50, 10, 200, 5],
    maxSpeed: [100, 10, 500, 10],
  },
  'Rubber Band': {
    _collapsed: true,
    deadZone: [32, 0, 80, 1],
    maxStretch: [8, 1, 24, 0.5],
    maxCursorRange: [200, 50, 500, 10],
    springDuration: [0.35, 0.1, 1, 0.01],
    springBounce: [0.15, 0, 0.5, 0.01],
  },
  'Drag Physics': {
    _collapsed: true,
    quadraticExponent: [2, 1, 4, 0.1],
    dragScale: [0.5, 0.05, 2, 0.05],
    editHoverDelay: [800, 100, 2000, 50],
  },
  'Jade Toggle': {
    _collapsed: true,
    jadePadding: [3, 0, 8, 1],
    jadeBorderRadius: [11, 0, 24, 1],
    jadeBorderWidth: [1, 0, 3, 0.5],
    jadePillRadius: [8, 0, 20, 1],
    jadeBtnPadV: [7, 2, 16, 1],
    jadeBtnPadH: [11, 4, 24, 1],
    jadePillAlpha: [0.16, 0, 0.5, 0.01],
    jadeGlowAlpha: [0.06, 0, 0.3, 0.01],
    jadeGlowSize: [6, 0, 20, 1],
    jadeTextAlpha: [0.95, 0.3, 1, 0.01],
    jadeBorderAlpha: [0.18, 0, 0.5, 0.01],
    jadeR: [80, 0, 255, 1],
    jadeG: [200, 0, 255, 1],
    jadeB: [140, 0, 255, 1],
    jadeTextR: [110, 0, 255, 1],
    jadeTextG: [220, 0, 255, 1],
    jadeTextB: [170, 0, 255, 1],
    jadePillTransition: [0.35, 0.05, 1, 0.01],
    jadeAnimDuration: [580, 100, 1200, 10],
    jadeEase1: [0.25, 0, 1, 0.01],
    jadeEase2: [0.75, 0, 1, 0.01],
    jadeEase3: [0.3, 0, 1, 0.01],
    jadeEase4: [1, 0, 1, 0.01],
    jadeBias: [0.1, 0, 0.5, 0.01],
  },
  'Warm Toggle': {
    _collapsed: true,
    warmPadding: [2, 0, 8, 1],
    warmBorderRadius: [10, 0, 24, 1],
    warmPillRadius: [7, 0, 20, 1],
    warmPillAlpha: [0.18, 0, 0.5, 0.01],
    warmTextAlpha: [0.95, 0.3, 1, 0.01],
    warmR: [255, 0, 255, 1],
    warmG: [170, 0, 255, 1],
    warmB: [80, 0, 255, 1],
    warmTextR: [255, 0, 255, 1],
    warmTextG: [195, 0, 255, 1],
    warmTextB: [130, 0, 255, 1],
    warmPillTransition: [0.35, 0.05, 1, 0.01],
    warmAnimDuration: [540, 100, 1200, 10],
    warmEase1: [0.4, 0, 1, 0.01],
    warmEase2: [0, 0, 1, 0.01],
    warmEase3: [0.2, 0, 1, 0.01],
    warmEase4: [1, 0, 1, 0.01],
    warmBias: [0.1, 0, 0.5, 0.01],
  },
};

function flattenDialValues(nested: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const value of Object.values(nested)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === '_collapsed') continue;
        flat[k] = v;
      }
    }
  }
  return flat;
}

export function ControlTuner() {
  // Register the preview controls — DialKit renders them in the panel
  useDialKit('Controls Preview', previewConfig);

  // Register the tuning sliders
  const tuningRaw = useDialKit('Tuning', tuningConfig);
  const t = flattenDialValues(tuningRaw as Record<string, unknown>) as Record<string, number>;

  // Bridge: tuning values → CSS custom properties (visual params)
  useEffect(() => {
    // Find the dialkit-root — may not exist on first render
    const roots = document.querySelectorAll('.dialkit-root');
    if (roots.length === 0) return;
    const root = roots[0] as HTMLElement;

    try {
      // Spring visual
      root.style.setProperty('--ub-handle-width', `${t.handleWidth ?? 3}px`);
      root.style.setProperty('--ub-handle-height', `${t.handleHeight ?? 20}px`);
      root.style.setProperty('--ub-border-radius', `${t.borderRadius ?? 8}px`);
      root.style.setProperty('--ub-notch-height', `${t.notchHeight ?? 14}px`);
      root.style.setProperty('--ub-notch-width', `${t.notchWidth ?? 1}px`);
      root.style.setProperty('--ub-dot-width', `${t.dotWidth ?? 1}px`);
      root.style.setProperty('--ub-dot-height', `${t.dotHeight ?? 8}px`);
      root.style.setProperty('--ub-bg-transition', `${t.bgTransition ?? 0.15}s`);

      // Jade toggle visual
      const jr = t.jadeR ?? 80, jg = t.jadeG ?? 200, jb = t.jadeB ?? 140;
      root.style.setProperty('--ub-jade-padding', `${t.jadePadding ?? 3}px`);
      root.style.setProperty('--ub-jade-border-radius', `${t.jadeBorderRadius ?? 11}px`);
      root.style.setProperty('--ub-jade-border-width', `${t.jadeBorderWidth ?? 1}px`);
      root.style.setProperty('--ub-jade-pill-radius', `${t.jadePillRadius ?? 8}px`);
      root.style.setProperty('--ub-jade-btn-pad-v', `${t.jadeBtnPadV ?? 7}px`);
      root.style.setProperty('--ub-jade-btn-pad-h', `${t.jadeBtnPadH ?? 11}px`);
      root.style.setProperty('--ub-jade-pill-bg', `rgba(${jr}, ${jg}, ${jb}, ${t.jadePillAlpha ?? 0.16})`);
      root.style.setProperty('--ub-jade-pill-glow', `0 0 ${t.jadeGlowSize ?? 6}px rgba(${jr}, ${jg}, ${jb}, ${t.jadeGlowAlpha ?? 0.06})`);
      root.style.setProperty('--ub-jade-text-color', `rgba(${t.jadeTextR ?? 110}, ${t.jadeTextG ?? 220}, ${t.jadeTextB ?? 170}, ${t.jadeTextAlpha ?? 0.95})`);
      root.style.setProperty('--ub-jade-border-color', `rgba(${jr}, ${jg}, ${jb}, ${t.jadeBorderAlpha ?? 0.18})`);
      root.style.setProperty('--ub-jade-pill-transition', `${t.jadePillTransition ?? 0.35}s`);
      root.style.setProperty('--ub-jade-anim-duration', `${t.jadeAnimDuration ?? 580}ms`);
      root.style.setProperty('--ub-jade-ease', `cubic-bezier(${t.jadeEase1 ?? 0.25}, ${t.jadeEase2 ?? 0.75}, ${t.jadeEase3 ?? 0.3}, ${t.jadeEase4 ?? 1})`);

      // Warm toggle visual
      const wr = t.warmR ?? 255, wg = t.warmG ?? 170, wb = t.warmB ?? 80;
      root.style.setProperty('--ub-warm-padding', `${t.warmPadding ?? 2}px`);
      root.style.setProperty('--ub-warm-border-radius', `${t.warmBorderRadius ?? 10}px`);
      root.style.setProperty('--ub-warm-pill-radius', `${t.warmPillRadius ?? 7}px`);
      root.style.setProperty('--ub-warm-pill-bg', `rgba(${wr}, ${wg}, ${wb}, ${t.warmPillAlpha ?? 0.18})`);
      root.style.setProperty('--ub-warm-text-color', `rgba(${t.warmTextR ?? 255}, ${t.warmTextG ?? 195}, ${t.warmTextB ?? 130}, ${t.warmTextAlpha ?? 0.95})`);
      root.style.setProperty('--ub-warm-pill-transition', `${t.warmPillTransition ?? 0.35}s`);
      root.style.setProperty('--ub-warm-anim-duration', `${t.warmAnimDuration ?? 540}ms`);
      root.style.setProperty('--ub-warm-ease', `cubic-bezier(${t.warmEase1 ?? 0.4}, ${t.warmEase2 ?? 0}, ${t.warmEase3 ?? 0.2}, ${t.warmEase4 ?? 1})`);
    } catch (e) {
      // CSS var setting can't really fail, but guard anyway
    }
  }, [t]);

  // Bridge: tuning values → window.__UB_TUNING__ (behavioral params)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__UB_TUNING__ = {
      handleRestOpacity: t.handleRestOpacity,
      handleHoverOpacity: t.handleHoverOpacity,
      handleDragOpacity: t.handleDragOpacity,
      handleDodgeOpacity: t.handleDodgeOpacity,
      handleDodgeScaleY: t.handleDodgeScaleY,
      scaleXDuration: t.scaleXDuration,
      scaleXBounce: t.scaleXBounce,
      scaleYDuration: t.scaleYDuration,
      scaleYBounce: t.scaleYBounce,
      opacityDuration: t.opacityDuration,
      speedMultiplier: t.speedMultiplier,
      speedExponent: t.speedExponent,
      speedDivisor: t.speedDivisor,
      maxSpeed: t.maxSpeed,
      deadZone: t.deadZone,
      maxStretch: t.maxStretch,
      maxCursorRange: t.maxCursorRange,
      springDuration: t.springDuration,
      springBounce: t.springBounce,
      quadraticExponent: t.quadraticExponent,
      dragScale: t.dragScale,
      editHoverDelay: t.editHoverDelay,
      bias: t.jadeBias ?? t.warmBias,
    };
  }, [t]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#111',
    }}>
      <div style={{
        color: 'rgba(255,255,255,0.3)', fontSize: 14,
        fontFamily: 'system-ui, sans-serif', textAlign: 'center', lineHeight: 1.6,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
          Control Tuner
        </div>
        <div>Open the DialKit panel →</div>
        <div style={{ marginTop: 4 }}>
          <strong>Controls Preview</strong> — the 4 live controls
        </div>
        <div>
          <strong>Tuning</strong> — sliders that drive their styling
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
          CSS vars update instantly. JS behavioral params update on next interaction.
        </div>
      </div>
    </div>
  );
}
