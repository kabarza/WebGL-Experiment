// ============================================================
// angry-slider-1 — Angry Birds sliders, as a DOM experiment.
//
// There is no shader here. The WebGL canvas is just a colored
// backdrop (like plyr-vimeo); the whole piece is a real DOM
// settings panel with a 2D FX canvas on top for trajectories,
// stretch bands, smoke, ripples and flying knobs.
//
// One panel, five sliders in two groups:
//   - SLING (top group): grab the thumb, stretch anywhere,
//     release — it launches along a dotted trajectory that ends
//     exactly where the knob will land. While aiming, the value
//     field previews the landing value in the accent color.
//   - ROPE (bottom group): identical looks; grab the line
//     anywhere (filled or not) and pull to fling the knob, or
//     click to send it gliding.
//
// Landings animate only the progress fill (sharp S-curve) — the
// thumb snaps straight to its new home. With the Boom toggle on,
// every thumb is a bomb and every landing explodes. Physics is
// a shared fixed-timestep integrator, so dots are always exact.
// Sounds are synthesized in sound.ts; all knobs live in DialKit.
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import { Sfx } from './sound.ts';

// ── constants ────────────────────────────────────────────────

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const GRAVITY_BASE = 2600; // px/s² at gravity = 1
const LAUNCH_K = 6.0; // slingshot: stretch px → launch velocity
const GROUND_PAD = 12; // ground line inset from the bottom
const THUMB_R = 12; // canvas knob radius while stretched / flying
const PHYS_DT = 1 / 240; // fixed physics step — shared by dots & flight
const ANIM_DUR = 0.55; // S-curve fill tween duration
const BAND = 20; // half-height of the interactive band around a track line
const BOMB_COLOR = '#e5484d';

type Fmt = (v: number) => string;

interface WidgetDef {
  kind: 'sling' | 'rope';
  label: string;
  min: number;
  max: number;
  value: number;
  fmt: Fmt;
}

const WIDGET_DEFS: WidgetDef[] = [
  { kind: 'sling', label: 'Exposure', min: -5, max: 5, value: 0.4, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} EV` },
  { kind: 'sling', label: 'Field of view', min: 5, max: 120, value: 25, fmt: (v) => `${Math.round(v)}°` },
  { kind: 'rope', label: 'position', min: 0, max: 100, value: 33, fmt: (v) => `${Math.round(v)}%` },
  { kind: 'rope', label: 'samples / s', min: 1, max: 64, value: 8, fmt: (v) => `${Math.round(v)}` },
];

// ── CSS ──────────────────────────────────────────────────────

const CSS = `
.asl-root {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  font-family: ${FONT_STACK};
  touch-action: none;
}
.asl-panel {
  position: absolute;
  left: 50%;
  top: 17%;
  transform: translateX(-50%);
  width: min(860px, 78vw);
  pointer-events: auto;
}
.asl-row { margin-bottom: 54px; }
.asl-row.asl-gap { margin-top: 46px; }
.asl-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1.2;
}
.asl-head-left { display: flex; align-items: center; gap: 8px; }
.asl-label { color: #c7c7ce; }
.asl-value { color: #f4f4f6; font-variant-numeric: tabular-nums; transition: color 0.12s linear; }
.asl-ch { white-space: pre; }
.asl-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.2px;
  padding: 2px 6px 1px;
  border-radius: 4px;
  transform: translateY(-1px);
}
.asl-tag-sling { color: #ff8a80; background: rgba(226, 64, 47, 0.18); }
.asl-tag-rope { color: #c4c4cf; background: rgba(255, 255, 255, 0.08); }
.asl-track {
  position: relative;
  height: 16px;
  margin-top: 18px;
  touch-action: none;
}
.asl-track::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 8px;
  transform: translateY(-50%);
  background: linear-gradient(#5a5a64, #414149 60%, #333339);
  border: 1px solid rgba(0, 0, 0, 0.55);
  border-radius: 5px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    0 2px 5px rgba(0, 0, 0, 0.5);
}
/* While a rope is grabbed the straight line hands over to the canvas. */
.asl-track.asl-line-hidden::before {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
}
.asl-track.asl-line-hidden .asl-fill {
  opacity: 0;
}
.asl-fill {
  position: absolute;
  left: 0;
  top: 50%;
  height: 8px;
  transform: translateY(-50%);
  background: linear-gradient(#ef564a, #c22b22 60%, #a02018);
  border: 1px solid #6e130c;
  border-radius: 5px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    inset 0 -2px 0 rgba(0, 0, 0, 0.22),
    0 2px 5px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.asl-thumb {
  position: absolute;
  top: 50%;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #ffffff, #e3e3ea 45%, #b9b9c6 82%, #9c9caa);
  border: 1px solid rgba(0, 0, 0, 0.4);
  box-shadow:
    0 3px 8px rgba(0, 0, 0, 0.55),
    inset 0 -3px 5px rgba(0, 0, 0, 0.16),
    inset 0 2px 3px rgba(255, 255, 255, 0.9);
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.asl-thumb.asl-hidden { visibility: hidden; }
.asl-thumb.asl-boom {
  background: radial-gradient(circle at 32% 28%, #ff8a8c, #d92c34 62%, #a01820 92%);
  border: 1px solid rgba(0, 0, 0, 0.4);
  box-shadow:
    0 3px 8px rgba(229, 72, 77, 0.45),
    inset 0 -3px 5px rgba(0, 0, 0, 0.3),
    inset 0 2px 3px rgba(255, 255, 255, 0.5);
}
.asl-thumb.asl-boom::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 8px;
  width: 2px;
  height: 6px;
  background: #8a8a93;
  border-radius: 1px;
  transform: rotate(14deg);
  clip-path: none;
}
.asl-thumb.asl-boom::after {
  content: '';
  position: absolute;
  top: -7px;
  left: 9px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ffd166;
  box-shadow: 0 0 5px 1px rgba(255, 209, 102, 0.8);
  animation: asl-spark 0.45s infinite alternate;
  clip-path: none;
}
@keyframes asl-spark {
  from { opacity: 0.45; transform: scale(0.75); }
  to { opacity: 1; transform: scale(1.2); }
}
.asl-fx {
  position: absolute;
  inset: 0;
  /* Canvas is a replaced element — inset alone won't stretch it. */
  width: 100%;
  height: 100%;
  pointer-events: none;
}
`;

// ── types ────────────────────────────────────────────────────

interface LetterSpan {
  span: HTMLSpanElement;
  body: LetterBody | null;
}

interface LetterBody {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  a: number;
  va: number;
  font: string;
  color: string;
  age: number;
  alpha: number;
  asleep: boolean;
}

interface Widget {
  kind: 'sling' | 'rope';
  label: string;
  min: number;
  max: number;
  value: number; // logical value — the thumb position
  fillValue: number; // what the progress bar shows (tweens toward value)
  fillAnim: { from: number; to: number; t: number } | null;
  aimPredict: number | null; // landing preview while aiming (null = not aiming)
  aimDim: boolean; // dim the preview when the shot misses the track
  fmt: Fmt;
  root: HTMLDivElement;
  labelEl: HTMLSpanElement;
  valueEl: HTMLSpanElement;
  labelLetters: LetterSpan[];
  valueLetters: LetterSpan[];
  trackEl: HTMLDivElement;
  fillEl: HTMLDivElement;
  thumbEl: HTMLDivElement;
  trackX: number;
  trackY: number;
  trackW: number;
  squashT: number;
  lastFmt: string;
  lastRippleMs: number;
}

type Grab =
  | {
      kind: 'ss';
      w: Widget;
      anchorX: number;
      anchorY: number;
      startX: number;
      startY: number;
      curX: number;
      curY: number;
      stretched: boolean;
      grabValue: number;
    }
  | { kind: 'thumb-drag'; w: Widget }
  | {
      kind: 'rope';
      w: Widget;
      grabX: number;
      knobX0: number;
      startX: number;
      startY: number;
      curX: number;
      curY: number;
    };

interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: Widget;
  grabValue: number;
  phase: 'fly' | 'settle' | 'return';
  settleMs: number;
  retMs: number;
  retFrom: { x: number; y: number };
  trail: { x: number; y: number; a: number }[];
  acc: number;
  rot: number; // bomb tumble angle (radians)
}

interface Smoke {
  x: number;
  y: number;
  r: number;
  vr: number;
  a: number;
  da: number;
  vx: number;
  vy: number;
}

interface Ripple {
  x: number;
  y: number;
  r: number;
  a: number;
}

interface SimResult {
  pts: { x: number; y: number }[];
  landing: { x: number; y: number } | null;
  ground: { x: number; y: number } | null;
}

// ── helpers ──────────────────────────────────────────────────

function num(v: unknown, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Sharp S-curve with a playful overshoot at both ends. */
function easeInOutBack(x: number): number {
  const c2 = 1.70158 * 1.525;
  return x < 0.5
    ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
    : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
}

const hexCache = new Map<string, [number, number, number]>();
function hexToRgb(hex: string): [number, number, number] {
  const cached = hexCache.get(hex);
  if (cached) return cached;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const int = parseInt(h, 16);
  const rgb: [number, number, number] = Number.isFinite(int)
    ? [(int >> 16) & 255, (int >> 8) & 255, int & 255]
    : [139, 124, 246];
  hexCache.set(hex, rgb);
  return rgb;
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ── experiment ───────────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  // The WebGL canvas is just a colored backdrop. Make it inert.
  canvas.style.pointerEvents = 'none';
  const parent = canvas.parentElement ?? document.body;

  // ── style sheet (once) ──
  if (!document.querySelector('style[data-asl-css]')) {
    const style = document.createElement('style');
    style.setAttribute('data-asl-css', '');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // ── DOM scaffold ──
  const root = document.createElement('div');
  root.className = 'asl-root';
  const panel = document.createElement('div');
  panel.className = 'asl-panel';
  root.appendChild(panel);

  const fx = document.createElement('canvas');
  fx.className = 'asl-fx';
  root.appendChild(fx);
  parent.appendChild(root);

  const fctx = fx.getContext('2d')!;

  // ── state ──
  const sfx = new Sfx();
  const widgets: Widget[] = [];
  let grab: Grab | null = null;
  let proj: Projectile | null = null;

  const smoke: Smoke[] = [];
  const ripples: Ripple[] = [];

  let rootH = 0;
  let rootW = 0;
  let groundY = 0;
  let shakeAmp = 0;
  let shakeX = 0;
  let shakeY = 0;
  let fxDpr = 1;
  let lastKnockSfxMs = 0;
  let flightRectRefreshMs = 0;
  let lastWallSfxMs = 0;
  let boomThumbState = false;

  const letterRects = new Map<LetterSpan, { x: number; y: number; w: number; h: number }>();

  // ── letters ──────────────────────────────────────────────────

  function buildLetterSpans(container: HTMLElement, text: string): LetterSpan[] {
    container.textContent = '';
    return Array.from(text).map((ch) => {
      const s = document.createElement('span');
      s.className = 'asl-ch';
      s.textContent = ch;
      container.appendChild(s);
      return { span: s, body: null };
    });
  }

  function allLetters(): LetterSpan[] {
    const out: LetterSpan[] = [];
    for (const w of widgets) out.push(...w.labelLetters, ...w.valueLetters);
    return out;
  }

  function refreshLetterRects(): void {
    const rootRect = root.getBoundingClientRect();
    letterRects.clear();
    for (const ls of allLetters()) {
      if (ls.body) continue;
      const r = ls.span.getBoundingClientRect();
      letterRects.set(ls, {
        x: r.left - rootRect.left,
        y: r.top - rootRect.top,
        w: r.width,
        h: r.height,
      });
    }
  }

  function restoreLetter(ls: LetterSpan): void {
    ls.body = null;
    ls.span.style.visibility = '';
  }

  function restoreAllLetters(): void {
    for (const ls of allLetters()) restoreLetter(ls);
  }

  function knockLetter(ls: LetterSpan, ivx: number, ivy: number): void {
    if (ls.body) return;
    const rect = letterRects.get(ls);
    if (!rect) refreshLetterRects();
    const r = letterRects.get(ls);
    if (!r || r.w === 0) return;

    const cs = getComputedStyle(ls.span);
    const font =
      cs.font && cs.font !== '' ? cs.font : `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;

    ls.span.style.visibility = 'hidden';
    ls.body = {
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      vx: ivx * 0.5 + rand(-80, 80),
      vy: ivy * 0.45 - rand(120, 380),
      a: 0,
      va: rand(-7, 7),
      font,
      color: cs.color,
      age: 0,
      alpha: 1,
      asleep: false,
    };

    const now = performance.now();
    if (now - lastKnockSfxMs > 45) {
      lastKnockSfxMs = now;
      const speed = Math.hypot(ivx, ivy);
      sfx.knock(0.4 + 0.6 * Math.min(1, speed / 1200));
    }
  }

  function knockAllLetters(): void {
    refreshLetterRects();
    const letters = allLetters().filter((ls) => !ls.body);
    letters.forEach((ls, i) => {
      window.setTimeout(() => {
        knockLetter(ls, rand(-300, 300), rand(-640, -160));
      }, i * 36);
    });
  }

  // ── widget construction ─────────────────────────────────────

  function makeWidget(def: WidgetDef, gap: boolean): Widget {
    const rowEl = document.createElement('div');
    rowEl.className = gap ? 'asl-row asl-gap' : 'asl-row';

    const head = document.createElement('div');
    head.className = 'asl-head';
    const headLeft = document.createElement('div');
    headLeft.className = 'asl-head-left';
    const labelEl = document.createElement('span');
    labelEl.className = 'asl-label';
    const tag = document.createElement('span');
    tag.className = `asl-tag asl-tag-${def.kind}`;
    tag.textContent = def.kind.toUpperCase();
    headLeft.appendChild(labelEl);
    headLeft.appendChild(tag);
    const valueEl = document.createElement('span');
    valueEl.className = 'asl-value';
    head.appendChild(headLeft);
    head.appendChild(valueEl);

    const trackEl = document.createElement('div');
    trackEl.className = 'asl-track';
    const fillEl = document.createElement('div');
    fillEl.className = 'asl-fill';
    const thumbEl = document.createElement('div');
    thumbEl.className = 'asl-thumb';
    trackEl.appendChild(fillEl);
    trackEl.appendChild(thumbEl);

    rowEl.appendChild(head);
    rowEl.appendChild(trackEl);
    panel.appendChild(rowEl);

    const w: Widget = {
      kind: def.kind,
      label: def.label,
      min: def.min,
      max: def.max,
      value: def.value,
      fillValue: def.value,
      fillAnim: null,
      aimPredict: null,
      aimDim: false,
      fmt: def.fmt,
      root: rowEl,
      labelEl,
      valueEl,
      labelLetters: [],
      valueLetters: [],
      trackEl,
      fillEl,
      thumbEl,
      trackX: 0,
      trackY: 0,
      trackW: 0,
      squashT: 0,
      lastFmt: '',
      lastRippleMs: 0,
    };
    w.labelLetters = buildLetterSpans(labelEl, def.label);
    syncValueText(w, w.value, true);
    return w;
  }

  // ── value text / fill tween ─────────────────────────────────

  function valueToT(w: Widget, v: number): number {
    return clamp((v - w.min) / Math.max(1e-6, w.max - w.min), 0, 1);
  }

  function tToValue(w: Widget, t: number): number {
    return w.min + clamp(t, 0, 1) * (w.max - w.min);
  }

  function syncValueText(w: Widget, value: number, force = false): void {
    const fmt = w.fmt(value);
    if (!force && fmt === w.lastFmt) return;
    w.lastFmt = fmt;
    const fallen = w.valueLetters.filter((ls) => ls.body);
    w.valueLetters = buildLetterSpans(w.valueEl, fmt);
    if (fallen.length && w.valueLetters.length === fallen.length) {
      w.valueLetters.forEach((ls, i) => {
        if (fallen[i].body) {
          ls.body = fallen[i].body;
          ls.span.style.visibility = 'hidden';
        }
      });
    }
  }

  /**
   * Set a widget's value: the thumb snaps to its new home right away and
   * only the progress fill tweens there with a sharp S-curve.
   */
  function setValueAnimated(w: Widget, to: number): void {
    const target = clamp(to, w.min, w.max);
    w.value = target;
    syncValueText(w, target, true);
    w.fillAnim = { from: w.fillValue, to: target, t: 0 };
  }

  function stepFillAnims(dt: number): void {
    for (const w of widgets) {
      if (!w.fillAnim) continue;
      w.fillAnim.t += dt;
      const k = easeInOutBack(Math.min(1, w.fillAnim.t / ANIM_DUR));
      w.fillValue = w.fillAnim.from + (w.fillAnim.to - w.fillAnim.from) * k;
      if (w.fillAnim.t >= ANIM_DUR) {
        w.fillValue = w.fillAnim.to;
        w.fillAnim = null;
      }
    }
  }

  // ── geometry ────────────────────────────────────────────────

  function thumbHome(w: Widget): { x: number; y: number } {
    return { x: w.trackX + valueToT(w, w.value) * w.trackW, y: w.trackY };
  }

  function xToValue(w: Widget, x: number): number {
    return tToValue(w, (x - w.trackX) / Math.max(1, w.trackW));
  }

  function syncFxSize(): void {
    const fxRect = fx.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(fxRect.width));
    const h = Math.max(1, Math.round(fxRect.height));
    if (fx.width !== w * dpr || fx.height !== h * dpr || fxDpr !== dpr) {
      fx.width = w * dpr;
      fx.height = h * dpr;
      fxDpr = dpr;
    }
  }

  function layout(): void {
    const rootRect = root.getBoundingClientRect();
    rootW = rootRect.width;
    rootH = rootRect.height;
    groundY = rootH - GROUND_PAD;

    syncFxSize();

    for (const w of widgets) {
      const r = w.trackEl.getBoundingClientRect();
      w.trackX = r.left - rootRect.left;
      w.trackY = r.top - rootRect.top + r.height / 2;
      w.trackW = r.width;
    }
    refreshLetterRects();
  }

  function requestLayout(): void {
    window.setTimeout(layout, 0);
  }

  // ── physics params ───────────────────────────────────────────

  function pG(): number {
    return num(params.gravity, 1) * GRAVITY_BASE;
  }
  function pPower(): number {
    return num(params.launchPower, 1);
  }
  function pDrag(): number {
    return num(params.airDrag, 0.05);
  }
  function pRestitution(): number {
    return num(params.restitution, 0.5);
  }
  function pBoom(): boolean {
    return params.boom === true;
  }
  function accent(): string {
    return typeof params.accent === 'string' ? params.accent : '#8b7cf6';
  }
  function dotSpacing(): number {
    return clamp(num(params.dotSpacing, 0.035), 0.008, 0.5);
  }

  // ── effects ─────────────────────────────────────────────────

  function spawnSmoke(x: number, y: number, amount: number): void {
    const n = Math.round(Math.min(14, 2 + amount * 4));
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      smoke.push({
        x: x + rand(-14, 14),
        y: y - rand(0, 6),
        r: rand(4, 9),
        vr: rand(26, 62),
        a: rand(0.24, 0.42),
        da: rand(0.45, 0.8),
        vx: dir * rand(12, 70),
        vy: -rand(8, 46),
      });
    }
  }

  function addRipple(x: number, y: number, scale: number): void {
    if (!params.ripples) return;
    ripples.push({ x, y, r: 4 * scale, a: 0.9 });
  }

  // ── shared fixed-step integrator (dots + flight use this) ────

  function physStep(s: { x: number; y: number; vx: number; vy: number }): void {
    s.vy += pG() * PHYS_DT;
    const d = Math.max(0, 1 - pDrag() * PHYS_DT);
    s.vx *= d;
    s.vy *= d;
    s.x += s.vx * PHYS_DT;
    s.y += s.vy * PHYS_DT;

    if (params['Bounce Off Edges'] === true || params.bounceEdges === true) {
      const rest = pRestitution();
      if (s.x < THUMB_R) {
        s.x = THUMB_R;
        s.vx = Math.abs(s.vx) * rest;
        wallFx(THUMB_R, s.y);
      } else if (s.x > rootW - THUMB_R) {
        s.x = rootW - THUMB_R;
        s.vx = -Math.abs(s.vx) * rest;
        wallFx(rootW - THUMB_R, s.y);
      }
      if (s.y < THUMB_R) {
        s.y = THUMB_R;
        s.vy = Math.abs(s.vy) * rest;
        wallFx(s.x, THUMB_R);
      }
    }
  }

  function wallFx(x: number, y: number): void {
    addRipple(x, y, 0.8);
    const now = performance.now();
    if (now - lastWallSfxMs > 90) {
      lastWallSfxMs = now;
      sfx.thud(0.3);
    }
  }

  /** Predict the full trajectory — same integrator as the real flight. */
  function predict(
    x: number,
    y: number,
    vx: number,
    vy: number,
    stopY: number,
    rangeMin: number,
    rangeMax: number,
  ): SimResult {
    const result: SimResult = { pts: [], landing: null, ground: null };
    const s = { x, y, vx, vy };
    const spacing = dotSpacing();
    let acc = 0;
    for (let i = 0; i < 240 * 12; i++) {
      const prevY = s.y;
      physStep(s);
      acc += PHYS_DT;
      if (acc >= spacing) {
        acc = 0;
        result.pts.push({ x: s.x, y: s.y });
      }
      if (s.vy > 0 && (prevY - stopY) * (s.y - stopY) < 0 && s.x >= rangeMin && s.x <= rangeMax) {
        result.landing = { x: s.x, y: stopY };
        break;
      }
      if (s.y >= groundY - THUMB_R) {
        result.ground = { x: s.x, y: groundY - THUMB_R };
        break;
      }
    }
    return result;
  }

  // ── launch velocities ────────────────────────────────────────

  function ssVelocity(g: Extract<Grab, { kind: 'ss' }>): { vx: number; vy: number } {
    const draw = ssDrawPos(g);
    return {
      vx: (g.anchorX - draw.x) * LAUNCH_K * pPower(),
      vy: (g.anchorY - draw.y) * LAUNCH_K * pPower(),
    };
  }

  function ssDrawPos(g: Extract<Grab, { kind: 'ss' }>): { x: number; y: number } {
    let dx = g.curX - g.anchorX;
    let dy = g.curY - g.anchorY;
    const dist = Math.hypot(dx, dy);
    const max = num(params.maxStretch, 280);
    if (dist > max && dist > 0) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    return { x: g.anchorX + dx, y: g.anchorY + dy };
  }

  function ropeVelocity(g: Extract<Grab, { kind: 'rope' }>): { vx: number; vy: number } {
    const depth = g.curY - g.startY;
    const ratio = clamp(depth / num(params.maxStretch, 280), 0, 1);
    return {
      vx:
        (g.grabX - g.knobX0) * 4.5 * pPower() * (0.35 + 0.65 * ratio) -
        (g.curX - g.startX) * 2.0 * pPower(),
      vy: -depth * 8.0 * pPower(),
    };
  }

  /** Where the bend and the knob sit while a rope is stretched. The knob
   *  threads on the rope, so it rides the segment the bend is NOT on. */
  function ropeGeom(g: Extract<Grab, { kind: 'rope' }>): {
    bendX: number;
    bendY: number;
    knobX: number;
    knobY: number;
  } {
    const w = g.w;
    const bendX = clamp(g.curX, w.trackX, w.trackX + w.trackW);
    const bendY = g.curY;
    const knobX = g.knobX0;
    const x1 = w.trackX + w.trackW;
    let knobY: number;
    if (knobX <= bendX) {
      // knob on the straight left segment
      const t = (knobX - w.trackX) / Math.max(1, bendX - w.trackX);
      knobY = w.trackY + (bendY - w.trackY) * t;
    } else {
      // knob on the right segment, hanging lower the deeper the bend
      const t = (knobX - bendX) / Math.max(1, x1 - bendX);
      knobY = bendY + (w.trackY - bendY) * t;
    }
    return { bendX, bendY, knobX, knobY };
  }

  // ── pointer handling (centralized hit testing) ───────────────

  function pointerPos(e: PointerEvent): { x: number; y: number } {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  type Hit =
    | { type: 'thumb'; w: Widget }
    | { type: 'rope'; w: Widget }
    | { type: 'track'; w: Widget };

  /** Priority hit test — nearest/strongest target wins, so overlapping
   *  neighbors never fight over the pointer. Any point of a rope line is
   *  grabbable, filled or not; only the thumb itself drags the value. */
  function hitTest(p: { x: number; y: number }): Hit | null {
    let bestHit: Hit | null = null;
    let bestD = Infinity;
    for (const w of widgets) {
      const home = thumbHome(w);
      const d = Math.hypot(p.x - home.x, p.y - home.y);
      if (d < bestD) {
        bestD = d;
        bestHit = { type: 'thumb', w };
      }
    }
    if (bestHit && bestD < 18) return bestHit;
    // rope lines: grabbable anywhere in their band, filled or not
    for (const w of widgets) {
      if (w.kind === 'rope' && p.x >= w.trackX - 6 && p.x <= w.trackX + w.trackW + 6) {
        if (Math.abs(p.y - w.trackY) < BAND) return { type: 'rope', w };
      }
    }
    // sling tracks: click-to-set
    for (const w of widgets) {
      if (w.kind === 'sling' && p.x >= w.trackX - 8 && p.x <= w.trackX + w.trackW + 8) {
        if (Math.abs(p.y - w.trackY) < 13) return { type: 'track', w };
      }
    }
    return null;
  }

  function onRootDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const p = pointerPos(e);
    const h = hitTest(p);
    if (!h) return;
    e.preventDefault();
    sfx.ensure();

    if (h.type === 'thumb') {
      const home = thumbHome(h.w);
      h.w.fillAnim = null;
      if (h.w.kind === 'sling') {
        grab = {
          kind: 'ss',
          w: h.w,
          anchorX: home.x,
          anchorY: home.y,
          startX: p.x,
          startY: p.y,
          curX: p.x,
          curY: p.y,
          stretched: false,
          grabValue: h.w.value,
        };
      } else {
        grab = { kind: 'thumb-drag', w: h.w };
      }
    } else if (h.type === 'rope') {
      h.w.fillAnim = null;
      grab = {
        kind: 'rope',
        w: h.w,
        grabX: clamp(p.x, h.w.trackX, h.w.trackX + h.w.trackW),
        knobX0: thumbHome(h.w).x,
        startX: p.x,
        startY: p.y,
        curX: p.x,
        curY: p.y,
      };
      sfx.startCreak();
    } else {
      // sling track click — the fill glides to the clicked spot
      setValueAnimated(h.w, xToValue(h.w, p.x));
      sfx.tick();
      return;
    }
    document.body.style.cursor = 'grabbing';
  }

  function onPointerMove(e: PointerEvent): void {
    const p = pointerPos(e);

    if (!grab) {
      // Hover cursor — works anywhere on screen, no element edges involved.
      document.body.style.cursor = hitTest(p) ? 'grab' : '';
      return;
    }

    if (grab.kind === 'ss') {
      grab.curX = p.x;
      grab.curY = p.y;
      if (!grab.stretched) {
        const dx = p.x - grab.startX;
        const dy = p.y - grab.startY;
        // small threshold — the slingshot should catch almost immediately
        const offTrack = Math.abs(p.y - grab.anchorY) > 13 || Math.hypot(dx, dy) > 18;
        if (offTrack) {
          // Crossed into slingshot territory: freeze the slider at the
          // grabbed value (no tween — the fill only moves forward on
          // landing) and hand the thumb to the FX canvas.
          grab.w.value = grab.grabValue;
          grab.w.fillValue = grab.grabValue;
          grab.w.fillAnim = null;
          grab.stretched = true;
          grab.w.thumbEl.classList.add('asl-hidden');
          sfx.startCreak();
        } else {
          grab.w.value = xToValue(grab.w, p.x);
          grab.w.fillValue = grab.w.value;
        }
      }
    } else if (grab.kind === 'rope') {
      grab.curX = p.x;
      grab.curY = p.y;
    } else {
      grab.w.value = xToValue(grab.w, p.x);
      grab.w.fillValue = grab.w.value;
    }
  }

  function onPointerUp(): void {
    if (!grab) return;
    const g = grab;
    grab = null;
    document.body.style.cursor = '';

    if (g.kind === 'ss') {
      g.w.thumbEl.classList.remove('asl-hidden');
      if (g.stretched) {
        const v = ssVelocity(g);
        launch(g.anchorX, g.anchorY - 4, v.vx, v.vy, g.w, g.grabValue);
        sfx.stopCreak();
      } else {
        sfx.tick();
      }
    } else if (g.kind === 'rope') {
      sfx.stopCreak();
      const depth = g.curY - g.startY;
      const dx = g.curX - g.startX;
      if (depth > 14) {
        const v = ropeVelocity(g);
        // The knob flies from where it hangs on the stretched rope, so the
        // trajectory dots (drawn from the same point) stay exact.
        const geom = ropeGeom(g);
        launch(geom.knobX, geom.knobY, v.vx, v.vy, g.w, g.w.value);
        sfx.boing(0.8 + 0.4 * clamp(depth / num(params.maxStretch, 280), 0, 1));
      } else if (Math.abs(dx) < 8 && depth <= 14) {
        // rope click — glide the fill to the clicked spot
        setValueAnimated(g.w, xToValue(g.w, g.grabX));
        sfx.tick();
      }
    } else {
      sfx.tick();
    }
  }

  // ── launch / flight ─────────────────────────────────────────

  function launch(x: number, y: number, vx: number, vy: number, w: Widget, grabValue: number): void {
    proj = {
      x,
      y,
      vx,
      vy,
      w,
      grabValue,
      phase: 'fly',
      settleMs: 0,
      retMs: 0,
      retFrom: { x, y },
      trail: [],
      acc: 0,
      rot: 0,
    };
    flightRectRefreshMs = 0;
    sfx.whoosh(Math.min(1, Math.hypot(vx, vy) / 1800));
  }

  function endFlight(): void {
    proj = null;
  }

  function landOnTrack(): void {
    if (!proj) return;
    const w = proj.w;
    const x = proj.x;
    if (x < w.trackX - 12 || x > w.trackX + w.trackW + 12) return; // outside its span — keep flying

    // The ball IS the thumb: it sits at the landing spot immediately and
    // the progress fill tweens over to meet it.
    setValueAnimated(w, xToValue(w, x));
    w.squashT = 0.24;
    addRipple(x, w.trackY, 1.4);
    if (pBoom()) {
      // The explosion is its own event — no normal-landing sounds on top.
      explode(x, w.trackY);
    } else {
      sfx.tick();
      sfx.thud(0.25);
      if (params.screenShake) shakeAmp = Math.max(shakeAmp, 1.5);
    }
    endFlight();
  }

  function groundImpact(strength: number): void {
    if (!proj) return;
    if (params.groundSmoke) spawnSmoke(proj.x, groundY, strength * num(params.smokeAmount, 1));
    sfx.thud(Math.min(1, strength / 900));
    sfx.puff();
    if (params.screenShake) shakeAmp = Math.max(shakeAmp, Math.min(7, strength * 0.011));
    addRipple(proj.x, groundY, 1);
  }

  function stepProjectile(dt: number): void {
    if (!proj) return;

    if (proj.phase !== 'fly') {
      if (proj.phase === 'settle') {
        proj.settleMs += dt;
        proj.vx *= 0.9;
        proj.x += proj.vx * dt;
        if (proj.settleMs > 0.55) {
          proj.phase = 'return';
          proj.retMs = 0;
          proj.retFrom = { x: proj.x, y: proj.y };
        }
      } else {
        proj.retMs += dt;
        const t = Math.min(1, proj.retMs / 0.5);
        const home = { x: proj.w.trackX + valueToT(proj.w, proj.grabValue) * proj.w.trackW, y: proj.w.trackY };
        const e = easeOutCubic(t);
        proj.x = proj.retFrom.x + (home.x - proj.retFrom.x) * e;
        proj.y = proj.retFrom.y + (home.y - proj.retFrom.y) * e - Math.sin(t * Math.PI) * 26;
        if (t >= 1) endFlight();
      }
      return;
    }

    // Fly in fixed physics steps so the path matches the prediction dots
    // exactly. Effects (trail, letters) update per step.
    proj.acc += Math.min(dt, 1 / 30);
    while (proj && proj.phase === 'fly' && proj.acc >= PHYS_DT) {
      proj.acc -= PHYS_DT;
      const prevY = proj.y;
      physStep(proj);

      if (params.trail) {
        proj.trail.push({ x: proj.x, y: proj.y, a: 0.5 });
        if (proj.trail.length > 20) proj.trail.shift();
      }
      if (pBoom()) {
        // the bomb tumbles as it travels, fuse spinning with it
        proj.rot += ((Math.abs(proj.vx) + Math.abs(proj.vy)) / 130) * PHYS_DT * (proj.vx >= 0 ? 1 : -1);
      }

      if (params.knockLabels) {
        flightRectRefreshMs += PHYS_DT;
        if (flightRectRefreshMs > 0.5) {
          flightRectRefreshMs = 0;
          refreshLetterRects();
        }
        const r = THUMB_R * 1.2 + 2;
        for (const [ls, rect] of letterRects) {
          if (ls.body) continue;
          const cx = Math.max(rect.x, Math.min(proj.x, rect.x + rect.w));
          const cy = Math.max(rect.y, Math.min(proj.y, rect.y + rect.h));
          if ((proj.x - cx) ** 2 + (proj.y - cy) ** 2 < r * r) {
            knockLetter(ls, proj.vx, proj.vy);
            proj.vx *= 0.92;
            proj.vy *= 0.92;
          }
        }
      }

      // ripples when crossing any widget's line
      const nowMs = performance.now();
      for (const w of widgets) {
        if ((prevY - w.trackY) * (proj.y - w.trackY) < 0 && nowMs - w.lastRippleMs > 120) {
          w.lastRippleMs = nowMs;
          addRipple(proj.x, w.trackY, 1);
        }
      }

      // landing on the owner's own line
      if (proj.vy > 0 && (prevY - proj.w.trackY) * (proj.y - proj.w.trackY) < 0) {
        landOnTrack();
        if (!proj) return;
      }

      // ground
      if (proj.y + THUMB_R >= groundY) {
        if (pBoom()) {
          // Boom mode: no bounces — any landing explodes.
          explode(proj.x, groundY - THUMB_R);
          endFlight();
          return;
        }
        const impact = Math.abs(proj.vy);
        proj.y = groundY - THUMB_R;
        if (impact > 90 && pRestitution() > 0.02) {
          proj.vy = -impact * pRestitution();
          proj.vx *= 0.72;
          groundImpact(impact);
        } else {
          proj.vy = 0;
          proj.vx *= 0.9;
          if (impact > 30) groundImpact(impact);
          if (Math.abs(proj.vx) < 40) {
            proj.phase = 'settle';
            proj.settleMs = 0;
          }
        }
      }
    }

    if (proj) {
      for (const t of proj.trail) t.a -= 2.6 * dt;
    }
  }

  function stepLetters(dt: number): void {
    const g = pG();
    const restoreSec = num(params.letterRestore, 4);
    for (const ls of allLetters()) {
      const b = ls.body;
      if (!b) continue;
      b.age += dt;

      if (restoreSec > 0 && b.age > restoreSec) {
        b.alpha = Math.max(0, 1 - (b.age - restoreSec) / 0.45);
        if (b.alpha <= 0) {
          restoreLetter(ls);
          continue;
        }
      }

      if (b.asleep) continue;
      b.vy += g * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.va * dt;
      if (b.y + b.h >= groundY) {
        b.y = groundY - b.h;
        b.vy = -b.vy * 0.32;
        b.vx *= 0.72;
        b.va *= 0.55;
        if (Math.abs(b.vy) < 70) {
          b.vy = 0;
          b.asleep = true;
        }
      }
    }
  }

  function stepEffects(dt: number): void {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.r += s.vr * dt;
      s.a -= s.da * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy -= 14 * dt;
      if (s.a <= 0) smoke.splice(i, 1);
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.r += 300 * dt;
      r.a -= 3.2 * dt;
      if (r.a <= 0) ripples.splice(i, 1);
    }
    shakeAmp *= Math.exp(-7 * dt);
    if (shakeAmp < 0.1) shakeAmp = 0;
    shakeX = shakeAmp ? rand(-shakeAmp, shakeAmp) : 0;
    shakeY = shakeAmp ? rand(-shakeAmp, shakeAmp) * 0.6 : 0;

    for (const w of widgets) {
      if (w.squashT > 0) w.squashT = Math.max(0, w.squashT - dt);
    }
  }

  // ── explosion (Boom mode) ────────────────────────────────────

  function explode(x: number, y: number): void {
    refreshLetterRects();
    for (const ls of allLetters()) {
      const body = ls.body;
      const r = body
        ? { x: body.x, y: body.y, w: body.w, h: body.h }
        : letterRects.get(ls);
      if (!r) continue;
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const dx = cx - x;
      const dy = cy - y;
      const d = Math.max(24, Math.hypot(dx, dy));
      const f = Math.max(0.2, 1 - d / 1000);
      const imp = 1500 * f;
      const nx = dx / d;
      const ny = dy / d;
      if (body) {
        body.vx += nx * imp * 0.8;
        body.vy += ny * imp * 0.8 - 260 * f;
        body.asleep = false;
        body.va += rand(-6, 6);
      } else {
        knockLetter(ls, nx * imp * 1.3, ny * imp * 1.3 - 320 * f);
      }
    }
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1);
      const sp = rand(120, 320);
      smoke.push({
        x: x + Math.cos(a) * 10,
        y: y + Math.sin(a) * 10,
        r: rand(5, 11),
        vr: rand(30, 70),
        a: rand(0.3, 0.5),
        da: rand(0.5, 0.9),
        vx: Math.cos(a) * sp * 0.4,
        vy: Math.sin(a) * sp * 0.4 - 30,
      });
    }
    addRipple(x, y, 3);
    shakeAmp = Math.max(shakeAmp, 11);
    sfx.boom();
  }

  // ── actions ──────────────────────────────────────────────────

  let lastActionTs = 0;
  function handleActions(): void {
    const ts = num(params._actionTs, 0);
    if (ts === lastActionTs) return;
    lastActionTs = ts;
    const action = String(params._action ?? '');
    if (action.endsWith('Knock All Labels')) {
      sfx.ensure();
      knockAllLetters();
    } else if (action.endsWith('Bring Letters Back')) {
      restoreAllLetters();
    }
  }

  // ── drawing ──────────────────────────────────────────────────

  /** The bomb, drawn at any rotation so the fuse tumbles with it.
   *  Shaded like the handles: gloss on top, core shadow at the bottom. */
  function drawBomb(x: number, y: number, rot: number, scale = 1): void {
    const r = THUMB_R;
    fctx.save();
    fctx.translate(x, y);
    fctx.rotate(rot);
    fctx.scale(scale, scale);

    const grad = fctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#ff6b6e');
    grad.addColorStop(0.72, '#d92c34');
    fctx.fillStyle = grad;
    fctx.beginPath();
    fctx.arc(0, 0, r, 0, Math.PI * 2);
    fctx.fill();
    fctx.strokeStyle = 'rgba(0,0,0,0.45)';
    fctx.lineWidth = 1.5;
    fctx.stroke();

    // gloss highlight + bottom core shadow — the volumetric treatment
    fctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    fctx.beginPath();
    fctx.ellipse(-r * 0.32, -r * 0.42, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2);
    fctx.fill();
    fctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    fctx.beginPath();
    fctx.ellipse(0, r * 0.45, r * 0.62, r * 0.3, 0, 0, Math.PI * 2);
    fctx.fill();

    // fuse
    fctx.strokeStyle = '#8a8a93';
    fctx.lineWidth = 2;
    fctx.lineCap = 'round';
    fctx.beginPath();
    fctx.moveTo(0, -r + 1);
    fctx.quadraticCurveTo(3, -r - 4, 6, -r - 6);
    fctx.stroke();

    // spark (halo + core)
    fctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
    fctx.beginPath();
    fctx.arc(6, -r - 7, 5.5, 0, Math.PI * 2);
    fctx.fill();
    fctx.fillStyle = '#ffd166';
    fctx.beginPath();
    fctx.arc(6, -r - 7, 2.4, 0, Math.PI * 2);
    fctx.fill();

    fctx.restore();
  }

  function drawDots(pts: { x: number; y: number }[], fade: number, size: number): void {
    const color = accent();
    const n = pts.length;
    fctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      fctx.globalAlpha = 1 - t * (1 - fade);
      const r = (size / 2) * (1 - 0.35 * t);
      fctx.beginPath();
      fctx.arc(pts[i].x, pts[i].y, Math.max(0.6, r), 0, Math.PI * 2);
      fctx.fill();
    }
    fctx.globalAlpha = 1;
  }

  function drawStretchAndTrajectory(): void {
    if (!grab || grab.kind !== 'ss' || !grab.stretched) return;
    const g = grab;
    const draw = ssDrawPos(g);
    const color = accent();

    fctx.strokeStyle = rgba(color, 0.85);
    fctx.lineWidth = 2;
    // slingshot fork — the left dot sits exactly on the tip of the red
    // progress, the right one a full span to its right; bands attach at
    // the dot centers
    const forkL = g.anchorX;
    const forkR = g.anchorX + 18;
    for (const fx of [forkL, forkR]) {
      fctx.beginPath();
      fctx.moveTo(fx, g.anchorY);
      fctx.lineTo(draw.x, draw.y);
      fctx.stroke();
    }
    fctx.fillStyle = color;
    for (const fx of [forkL, forkR]) {
      fctx.beginPath();
      fctx.arc(fx, g.anchorY, 3, 0, Math.PI * 2);
      fctx.fill();
    }
    if (pBoom()) {
      drawBomb(draw.x, draw.y, 0, 1);
    } else {
      drawHandleBall(draw.x, draw.y);
    }

    const v = ssVelocity(g);
    // Launch point must match stepProjectile exactly: the knob snaps back
    // to the anchor fork and flies from there, 4px above the line.
    const sim = predict(g.anchorX, g.anchorY - 4, v.vx, v.vy, g.w.trackY, g.w.trackX - 12, g.w.trackX + g.w.trackW + 12);
    if (params.showTrajectory) {
      drawDots(sim.pts, num(params.dotFade, 0.12), num(params.dotSize, 3.4));
    }
    if (sim.landing) {
      g.w.aimPredict = xToValue(g.w, sim.landing.x);
      g.w.aimDim = false;
    } else if (sim.ground) {
      g.w.aimPredict = xToValue(g.w, sim.ground.x);
      g.w.aimDim = true;
    }
  }

  function drawRopeStretch(): void {
    if (!grab || grab.kind !== 'rope') return;
    const g = grab;
    const w = g.w;
    const depth = g.curY - g.startY;
    if (depth <= 6) return; // barely moved — still reads as the plain slider

    // The track line hands over to a rope that bends through the grab
    // point, colored exactly like the slider: fill-white up to the knob,
    // track-gray beyond it. The knob threads on the rope, so the path
    // through the bend depends on which side of the knob you grabbed.
    const { bendX, bendY, knobX, knobY } = ropeGeom(g);
    const x1 = w.trackX + w.trackW;

    fctx.lineCap = 'round';
    fctx.lineWidth = 3;
    if (bendX < knobX) {
      // grabbed on the progress side: the rope dives through the bend
      // BEFORE reaching the knob
      fctx.strokeStyle = '#d2392c';
      fctx.beginPath();
      fctx.moveTo(w.trackX, w.trackY);
      fctx.lineTo(bendX, bendY);
      fctx.lineTo(knobX, knobY);
      fctx.stroke();
      fctx.strokeStyle = '#4a4a54';
      fctx.beginPath();
      fctx.moveTo(knobX, knobY);
      fctx.lineTo(x1, w.trackY);
      fctx.stroke();
    } else {
      // grabbed on the slack side: progress runs straight to the knob
      fctx.strokeStyle = '#d2392c';
      fctx.beginPath();
      fctx.moveTo(w.trackX, w.trackY);
      fctx.lineTo(knobX, knobY);
      fctx.stroke();
      fctx.strokeStyle = '#4a4a54';
      fctx.beginPath();
      fctx.moveTo(knobX, knobY);
      fctx.lineTo(bendX, bendY);
      fctx.lineTo(x1, w.trackY);
      fctx.stroke();
    }

    // the knob rides the rope — a bomb when Boom is on, else the handle
    if (pBoom()) {
      drawBomb(knobX, knobY, 0, 0.85);
    } else {
      drawHandleBall(knobX, knobY, 0.85);
    }

    const v = ropeVelocity(g);
    // Launch point must match stepProjectile exactly: the knob flies from
    // where it hangs on the stretched rope.
    const sim = predict(knobX, knobY, v.vx, v.vy, w.trackY, w.trackX - 12, x1 + 12);
    if (params.showTrajectory) {
      drawDots(sim.pts, num(params.dotFade, 0.12), num(params.dotSize, 3.4));
    }
    if (sim.landing) {
      w.aimPredict = xToValue(w, sim.landing.x);
      w.aimDim = false;
    } else if (sim.ground) {
      w.aimPredict = xToValue(w, sim.ground.x);
      w.aimDim = true;
    }
  }

  function drawProjectile(): void {
    if (!proj) return;

    if (params.trail) {
      const color = pBoom() ? BOMB_COLOR : accent();
      fctx.fillStyle = color;
      for (const t of proj.trail) {
        if (t.a <= 0) continue;
        fctx.globalAlpha = t.a * 0.4;
        fctx.beginPath();
        fctx.arc(t.x, t.y, THUMB_R * 0.55, 0, Math.PI * 2);
        fctx.fill();
      }
      fctx.globalAlpha = 1;
    }

    // Boom mode: the same bomb you grabbed, tumbling in the air.
    if (pBoom()) {
      drawBomb(proj.x, proj.y, proj.rot, 1);
      return;
    }

    // otherwise: the white volumetric handle takes flight
    drawHandleBall(proj.x, proj.y);
  }

  /** The white shaded handle, drawn on canvas (in hand or in flight). */
  function drawHandleBall(x: number, y: number, scale = 1): void {
    const r = THUMB_R * scale;
    const grad = fctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#e3e3ea');
    grad.addColorStop(0.85, '#b9b9c6');
    grad.addColorStop(1, '#9c9caa');
    fctx.fillStyle = grad;
    fctx.beginPath();
    fctx.arc(x, y, r, 0, Math.PI * 2);
    fctx.fill();
    fctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    fctx.lineWidth = 1;
    fctx.stroke();
  }

  function drawLetters(): void {
    for (const ls of allLetters()) {
      const b = ls.body;
      if (!b) continue;
      fctx.save();
      fctx.globalAlpha = b.alpha;
      fctx.translate(b.x + b.w / 2, b.y + b.h / 2);
      fctx.rotate(b.a);
      fctx.font = b.font;
      fctx.fillStyle = b.color;
      fctx.textAlign = 'left';
      fctx.textBaseline = 'top';
      fctx.fillText(ls.span.textContent ?? '', -b.w / 2, -b.h / 2);
      fctx.restore();
    }
    fctx.globalAlpha = 1;
  }

  function drawSmokeAndRipples(): void {
    for (const s of smoke) {
      fctx.fillStyle = `rgba(152,152,162,${Math.max(0, s.a)})`;
      fctx.beginPath();
      fctx.ellipse(s.x, s.y, s.r, s.r * 0.72, 0, 0, Math.PI * 2);
      fctx.fill();
    }
    const color = accent();
    for (const r of ripples) {
      fctx.strokeStyle = rgba(color, Math.max(0, r.a) * 0.55);
      fctx.lineWidth = 1.5;
      fctx.beginPath();
      fctx.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, Math.PI * 2);
      fctx.stroke();
    }
  }

  function draw(): void {
    const bg = typeof params.bg === 'string' ? params.bg : '#17171a';
    const [r, g, b] = hexToRgb(bg);
    gl.clearColor(r / 255, g / 255, b / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    syncFxSize();
    fctx.setTransform(1, 0, 0, 1, 0, 0);
    fctx.clearRect(0, 0, fx.width, fx.height);
    fctx.setTransform(fxDpr, 0, 0, fxDpr, fxDpr * shakeX, fxDpr * shakeY);

    drawSmokeAndRipples();
    drawStretchAndTrajectory();
    drawRopeStretch();
    drawProjectile();
    drawLetters();
  }

  // ── DOM sync ─────────────────────────────────────────────────

  function syncDom(): void {
    const boom = pBoom();
    if (boom !== boomThumbState) {
      boomThumbState = boom;
      for (const w of widgets) {
        w.thumbEl.classList.toggle('asl-boom', boom);
      }
    }

    for (const w of widgets) {
      const grabbed = grab && grab.w === w && ((grab.kind === 'ss' && grab.stretched) || grab.kind === 'rope');
      const flying = proj && proj.w === w;
      w.thumbEl.classList.toggle('asl-hidden', !!(grabbed || flying));
      // While the rope is stretched, the canvas draws the bending rope in
      // place of the straight DOM line.
      const ropeStretched = !!(grab && grab.kind === 'rope' && grab.w === w && grab.curY - grab.startY > 6);
      w.trackEl.classList.toggle('asl-line-hidden', ropeStretched);

      const tFill = valueToT(w, w.fillValue);
      w.fillEl.style.width = `${tFill * 100}%`;
      const t = valueToT(w, w.value);
      w.thumbEl.style.left = `${t * 100}%`;

      let tx = 1;
      let ty = 1;
      if (w.squashT > 0 && params.squash) {
        const p = 1 - w.squashT / 0.24;
        const s = Math.sin(p * Math.PI) * (1 - p);
        tx = 1 + 0.5 * s;
        ty = 1 - 0.38 * s;
      }
      w.thumbEl.style.transform = `translate(-50%, -50%) scale(${tx.toFixed(3)}, ${ty.toFixed(3)})`;

      // Live landing preview inside the value field, tinted while aiming.
      if (w.aimPredict !== null) {
        syncValueText(w, w.aimPredict);
        w.valueEl.style.color = w.aimDim
          ? rgba(accent(), 0.55)
          : accent();
      } else {
        syncValueText(w, w.value);
        w.valueEl.style.color = '';
      }
    }
    panel.style.transform =
      shakeAmp > 0
        ? `translate(calc(-50% + ${shakeX.toFixed(2)}px), ${shakeY.toFixed(2)}px)`
        : 'translateX(-50%)';
  }

  // ── debug / verification hooks ───────────────────────────────

  function installDebugHook(): void {
    const hook = {
      widgets: () => widgets.map((w) => ({ kind: w.kind, label: w.label, value: w.value })),
      knockAll: () => {
        sfx.ensure();
        knockAllLetters();
      },
      restore: () => restoreAllLetters(),
      beginStretch: (index: number, dx = 0, dy = 0) => {
        const w = widgets[index];
        if (!w || w.kind !== 'sling') return;
        const home = thumbHome(w);
        refreshLetterRects();
        w.fillAnim = null;
        grab = {
          kind: 'ss',
          w,
          anchorX: home.x,
          anchorY: home.y,
          startX: home.x,
          startY: home.y,
          curX: home.x + dx,
          curY: home.y + dy,
          stretched: true,
          grabValue: w.value,
        };
        w.thumbEl.classList.add('asl-hidden');
        sfx.ensure();
        sfx.startCreak();
      },
      setStretch: (dx: number, dy: number) => {
        if (grab && grab.kind === 'ss') {
          grab.curX = grab.anchorX + dx;
          grab.curY = grab.anchorY + dy;
        }
      },
      releaseStretch: () => {
        if (grab && grab.kind === 'ss') {
          const g = grab;
          grab = null;
          g.w.thumbEl.classList.remove('asl-hidden');
          sfx.stopCreak();
          const v = ssVelocity(g);
          launch(g.anchorX, g.anchorY - 4, v.vx, v.vy, g.w, g.grabValue);
        }
      },
      beginRopePull: (index: number, dx = 0, dy = 0, t = 0.75) => {
        const w = widgets[index];
        if (!w || w.kind !== 'rope') return;
        const knobX = thumbHome(w).x;
        const grabX = clamp(w.trackX + (w.trackW - 40) * t, w.trackX, w.trackX + w.trackW);
        refreshLetterRects();
        w.fillAnim = null;
        grab = {
          kind: 'rope',
          w,
          grabX,
          knobX0: knobX,
          startX: grabX,
          startY: w.trackY,
          curX: grabX + dx,
          curY: w.trackY + dy,
        };
        sfx.ensure();
        sfx.startCreak();
      },
      releaseRope: () => onPointerUp(),
      ropeClick: (index: number, t: number) => {
        const w = widgets[index];
        if (w) setValueAnimated(w, tToValue(w, t));
        sfx.tick();
      },
      trackClick: (index: number, t: number) => {
        const w = widgets[index];
        if (w) setValueAnimated(w, tToValue(w, t));
        sfx.tick();
      },
      /** Prediction used by the dots — exposed for accuracy tests. */
      predictStretch: (index: number, dx: number, dy: number) => {
        const w = widgets[index];
        if (!w) return null;
        const home = thumbHome(w);
        const g: Extract<Grab, { kind: 'ss' }> = {
          kind: 'ss',
          w,
          anchorX: home.x,
          anchorY: home.y,
          startX: home.x,
          startY: home.y,
          curX: home.x + dx,
          curY: home.y + dy,
          stretched: true,
          grabValue: w.value,
        };
        const v = ssVelocity(g);
        const sim = predict(g.anchorX, g.anchorY - 4, v.vx, v.vy, w.trackY, w.trackX - 12, w.trackX + w.trackW + 12);
        return {
          landingX: sim.landing ? Math.round(sim.landing.x) : null,
          landingValue: sim.landing ? xToValue(w, sim.landing.x) : null,
          groundX: sim.ground ? Math.round(sim.ground.x) : null,
          dots: sim.pts.length,
        };
      },
      state: () => ({
        widgets: widgets.map((w) => ({ kind: w.kind, label: w.label, value: w.value })),
        grabbed: grab?.kind ?? null,
        proj: proj ? { phase: proj.phase, x: Math.round(proj.x), y: Math.round(proj.y) } : null,
        lettersKnocked: allLetters().filter((l) => l.body).length,
        smoke: smoke.length,
        ripples: ripples.length,
        sound: { ready: sfx.contextReady, voices: sfx.voices },
        cursor: document.body.style.cursor,
      }),
    };
    (window as unknown as Record<string, unknown>).__angrySlider = hook;
  }

  // ── listeners ────────────────────────────────────────────────

  root.addEventListener('pointerdown', onRootDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  let ropePlaced = false;
  for (const def of WIDGET_DEFS) {
    widgets.push(makeWidget(def, def.kind === 'rope' && !ropePlaced));
    if (def.kind === 'rope') ropePlaced = true;
  }
  installDebugHook();
  requestLayout();

  return {
    render(_time: number, dtRaw: number): void {
      handleActions();
      sfx.enabled = params.sound !== false;
      sfx.setVolume(num(params.volume, 0.7));

      // While holding, the grabbing cursor follows the pointer everywhere —
      // independent of which element the drag started on.
      if (grab) document.body.style.cursor = 'grabbing';

      // creak follows stretch distance
      if (grab && grab.kind === 'ss' && grab.stretched) {
        const draw = ssDrawPos(grab);
        sfx.updateCreak(
          Math.min(1, Math.hypot(draw.x - grab.anchorX, draw.y - grab.anchorY) / num(params.maxStretch, 280)),
        );
      } else if (grab && grab.kind === 'rope') {
        sfx.updateCreak(Math.min(1, Math.max(0, grab.curY - grab.startY) / num(params.maxStretch, 280)));
      }

      for (const w of widgets) {
        w.aimPredict = null;
        w.aimDim = false;
      }

      const dt = Math.min(dtRaw, 1 / 30);
      stepFillAnims(dt);
      stepProjectile(dt);
      stepLetters(dt);
      stepEffects(dt);

      draw();
      syncDom();
    },

    resize(): void {
      layout();
    },

    dispose(): void {
      root.removeEventListener('pointerdown', onRootDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.body.style.cursor = '';
      sfx.dispose();
      root.remove();
      // React StrictMode double-mounts: a stale first-instance dispose can
      // run after the second instance mounted. Only reset shared state when
      // no live instance owns the canvas. The debug hook is left in place —
      // the next init overwrites it.
      const otherRoot = canvas.parentElement?.querySelector(':scope > .asl-root');
      if (!otherRoot) {
        canvas.style.pointerEvents = '';
        delete (window as unknown as Record<string, unknown>).__angrySlider;
      }
    },
  };
}

export const angrySlider1Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
