// ============================================================
// Globe 1 — Three.js wireframe globe with snake network animation
// ============================================================

import * as THREE from 'three';
import {
  CSS2DObject,
  CSS2DRenderer,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { DialStore } from 'dialkit';
import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { meta } from './meta.ts';
import { controls, DEFAULT_COUNTRIES, type Country, type SnapMode } from './params.ts';

// ── Constants ─────────────────────────────────────────────────

const GLOBE_RADIUS = 1.0;
// Crosses and snake-path samples both live on this exact shell so
// they project to identical screen pixels at any view angle. Z-fighting
// with the wireframe is prevented by `depthTest: false` + renderOrder
// rather than a radial lift, which would re-introduce parallax.
const MARKER_RADIUS = GLOBE_RADIUS;
const STYLE_ID = 'globe-1-css';

// ── Types for resolved DialKit configs ────────────────────────

interface SpringValue {
  type: 'spring';
  stiffness?: number;
  damping?: number;
  mass?: number;
}
interface EasingValue {
  type: 'easing';
  duration: number;
  ease: [number, number, number, number];
}
interface SnakeSpringValue {
  type: 'spring';
  visualDuration?: number;
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}
type TransitionValue = EasingValue | SnakeSpringValue;

// ── Helpers ───────────────────────────────────────────────────

function latLonToVec3(
  latDeg: number,
  lonDeg: number,
  radius: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const c = Math.cos(lat);
  out.set(c * Math.sin(lon) * radius, Math.sin(lat) * radius, c * Math.cos(lon) * radius);
  return out;
}

// Snap a point's lat/lon according to one of five modes.
// "nearest line" picks the axis where the snap distance is smaller,
// preserving the other coordinate exactly. This avoids collapsing
// multiple nearby countries onto the same intersection.
function snapCountry(
  latDeg: number,
  lonDeg: number,
  lonSeg: number,
  latSeg: number,
  mode: SnapMode,
): { lat: number; lon: number } {
  const lonStep = 360 / lonSeg;
  const latStep = 180 / latSeg;

  // Match the actual grid lattice exactly:
  //  meridians at  -180 + k·lonStep   for k ∈ [0, lonSeg)
  //  parallels at  -90  + k·latStep   for k ∈ [1, latSeg)   (skip poles)
  const snapLon = (l: number) => {
    let k = Math.round((l + 180) / lonStep);
    k = ((k % lonSeg) + lonSeg) % lonSeg;
    return -180 + k * lonStep;
  };
  const snapLat = (l: number) => {
    const k = Math.max(1, Math.min(latSeg - 1, Math.round((l + 90) / latStep)));
    return -90 + k * latStep;
  };

  if (mode === 'free') return { lat: latDeg, lon: lonDeg };
  if (mode === 'meridian') return { lat: latDeg, lon: snapLon(lonDeg) };
  if (mode === 'parallel') return { lat: snapLat(latDeg), lon: lonDeg };
  if (mode === 'intersection')
    return { lat: snapLat(latDeg), lon: snapLon(lonDeg) };
  // 'nearest line'
  const sLat = snapLat(latDeg);
  const sLon = snapLon(lonDeg);
  const dLat = Math.abs(latDeg - sLat);
  const dLon = Math.abs(lonDeg - sLon);
  return dLat <= dLon
    ? { lat: sLat, lon: lonDeg }
    : { lat: latDeg, lon: sLon };
}

function buildGridPositions(lonSeg: number, latSeg: number): Float32Array {
  const radius = GLOBE_RADIUS;
  const subdiv = 64;
  const pairs: number[] = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < lonSeg; i++) {
    const lon = -180 + (360 * i) / lonSeg;
    let prev: THREE.Vector3 | null = null;
    for (let j = 0; j <= subdiv; j++) {
      const lat = -90 + 180 * (j / subdiv);
      latLonToVec3(lat, lon, radius, tmp);
      if (prev) pairs.push(prev.x, prev.y, prev.z, tmp.x, tmp.y, tmp.z);
      prev = prev ? prev.copy(tmp) : tmp.clone();
    }
  }
  for (let i = 1; i < latSeg; i++) {
    const lat = -90 + (180 * i) / latSeg;
    let prev: THREE.Vector3 | null = null;
    for (let j = 0; j <= subdiv; j++) {
      const lon = -180 + 360 * (j / subdiv);
      latLonToVec3(lat, lon, radius, tmp);
      if (prev) pairs.push(prev.x, prev.y, prev.z, tmp.x, tmp.y, tmp.z);
      prev = prev ? prev.copy(tmp) : tmp.clone();
    }
  }
  return new Float32Array(pairs);
}

function makeCrossTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, size, size);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.5;
  const mid = size / 2;
  const arm = size * 0.32;
  g.beginPath();
  g.moveTo(mid - arm, mid);
  g.lineTo(mid + arm, mid);
  g.moveTo(mid, mid - arm);
  g.lineTo(mid, mid + arm);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

// L-shaped path: traverse meridian from (latA,lonA) → (latB,lonA),
// then parallel from (latB,lonA) → (latB,lonB). Picks shorter
// longitude direction.
function buildSnakePath(
  start: Country,
  end: Country,
  samples = 80,
): THREE.Vector3[] {
  const path: THREE.Vector3[] = [];
  const seg1 = Math.max(4, Math.round(samples * 0.5));
  for (let i = 0; i <= seg1; i++) {
    const t = i / seg1;
    const lat = THREE.MathUtils.lerp(start.lat, end.lat, t);
    path.push(latLonToVec3(lat, start.lon, MARKER_RADIUS));
  }
  let dLon = end.lon - start.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const seg2 = Math.max(4, Math.round(samples * 0.5));
  for (let i = 1; i <= seg2; i++) {
    const t = i / seg2;
    path.push(latLonToVec3(end.lat, start.lon + dLon * t, MARKER_RADIUS));
  }
  return path;
}

// Cubic-bezier easing: solves x(t)=u via Newton, returns y(t).
function cubicBezier(c1x: number, c1y: number, c2x: number, c2y: number) {
  const cx = (t: number) => 3 * (1 - t) * (1 - t) * t * c1x + 3 * (1 - t) * t * t * c2x + t * t * t;
  const cy = (t: number) => 3 * (1 - t) * (1 - t) * t * c1y + 3 * (1 - t) * t * t * c2y + t * t * t;
  return (u: number) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 6; i++) {
      const x = cx(t);
      const dx = 3 * (1 - t) * (1 - t) * c1x +
        6 * (1 - t) * t * (c2x - c1x) +
        3 * t * t * (1 - c2x);
      if (Math.abs(dx) < 1e-6) break;
      t -= (x - u) / dx;
      if (t < 0) t = 0;
      if (t > 1) t = 1;
    }
    return cy(t);
  };
}

// Spring response → 0..1 normalised curve. Models a damped harmonic
// oscillator settling at 1; clamped so the snake head never overshoots
// the path length.
function springEase(visualDuration: number, bounce: number) {
  const dur = Math.max(0.05, visualDuration);
  const b = Math.min(0.99, Math.max(0, bounce));
  // Framer-Motion-style mapping: bounce 0 = critical, bounce 1 = bouncy.
  const zeta = Math.max(0.05, 1 - b);
  const omega = (2 * Math.PI) / dur;
  return (u: number) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const t = u * dur;
    let x: number;
    if (zeta >= 1) {
      x = 1 - (1 + omega * t) * Math.exp(-omega * t);
    } else {
      const root = Math.sqrt(1 - zeta * zeta);
      const omegaD = omega * root;
      const env = Math.exp(-zeta * omega * t);
      x = 1 - env * (Math.cos(omegaD * t) + (zeta / root) * Math.sin(omegaD * t));
    }
    return Math.min(1, Math.max(0, x));
  };
}

function makeEaseFn(cfg: TransitionValue | undefined): (u: number) => number {
  if (!cfg) return (u) => u;
  if (cfg.type === 'easing' && cfg.ease) {
    return cubicBezier(cfg.ease[0], cfg.ease[1], cfg.ease[2], cfg.ease[3]);
  }
  if (cfg.type === 'spring') {
    return springEase(cfg.visualDuration ?? 0.5, cfg.bounce ?? 0);
  }
  return (u) => u;
}

function ensureStyles(labelColor: string, fontSizePx: number, offsetYPx: number) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = `
    .globe-1-label-root {
      display: inline-block;
      position: relative;
      pointer-events: none;
      transform: translateY(${offsetYPx}px);
      font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      font-size: ${fontSizePx}px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: ${labelColor};
      white-space: nowrap;
      transition: opacity 200ms ease, color 240ms ease;
      text-align: center;
      line-height: 1;
      will-change: opacity;
    }
    .globe-1-label-root.is-flash {
      color: #ffffff;
      text-shadow: 0 0 12px rgba(255,255,255,0.75);
    }
  `;
}

// ── Country marker ────────────────────────────────────────────

// Shared planar geometry used by the surface-cross variant. Re-using
// one instance across all markers keeps the GPU upload cheap.
const SURFACE_CROSS_GEOMETRY = new THREE.PlaneGeometry(1, 1);

class CountryMarker {
  group = new THREE.Group();
  cross: THREE.Sprite | THREE.Mesh;
  material: THREE.SpriteMaterial | THREE.MeshBasicMaterial;
  label: CSS2DObject;
  labelEl: HTMLElement;
  flashUntil = 0;
  basePosition = new THREE.Vector3();
  surface: boolean;

  constructor(country: Country, crossTex: THREE.Texture, surface: boolean) {
    this.surface = surface;

    if (surface) {
      // Tangent plane: a small textured quad whose +Z aligns with the
      // sphere's surface normal at the country's position. The cross
      // therefore lies flat on the sphere and foreshortens toward the
      // limb instead of billboarding to camera.
      const m = new THREE.MeshBasicMaterial({
        map: crossTex,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      this.material = m;
      this.cross = new THREE.Mesh(SURFACE_CROSS_GEOMETRY, m);
    } else {
      const m = new THREE.SpriteMaterial({
        map: crossTex,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      });
      this.material = m;
      this.cross = new THREE.Sprite(m);
    }
    this.cross.scale.set(0.05, 0.05, 1);
    this.cross.renderOrder = 4;

    // CSS2DRenderer assigns its own inline `transform` to the
    // CSS2DObject element each frame, which would clobber our
    // labelOffsetY. So the projected element is a wrapper, and the
    // styled label sits inside it where our transform survives.
    const labelWrap = document.createElement('div');
    labelWrap.style.pointerEvents = 'none';
    this.labelEl = document.createElement('span');
    this.labelEl.className = 'globe-1-label-root';
    this.labelEl.textContent = country.name;
    labelWrap.appendChild(this.labelEl);
    this.label = new CSS2DObject(labelWrap);

    this.group.add(this.cross);
    this.group.add(this.label);
  }

  setPosition(latDeg: number, lonDeg: number) {
    latLonToVec3(latDeg, lonDeg, MARKER_RADIUS, this.basePosition);
    this.group.position.copy(this.basePosition);
    if (this.surface) {
      // For Mesh (unlike Camera), Object3D.lookAt orients local +Z
      // toward the target — so lookAt(0,0,0) makes +Z point inward
      // along the sphere normal. The plane therefore lies tangent to
      // the sphere; which face is outward doesn't matter because we
      // use side: DoubleSide on the material.
      this.cross.lookAt(0, 0, 0);
    }
  }
  setColors(crossHex: string, labelHex: string) {
    this.material.color.set(crossHex);
    this.labelEl.style.color = labelHex;
  }
  setSize(size: number) {
    this.cross.scale.set(size, size, 1);
  }
  setVisible(v: boolean) {
    this.cross.visible = v;
  }
  setLabelVisible(v: boolean) {
    this.labelEl.style.visibility = v ? 'visible' : 'hidden';
  }
  setOpacity(o: number) {
    this.material.opacity = o;
    this.labelEl.style.opacity = String(o);
  }
  flash(now: number, duration: number) {
    this.flashUntil = now + duration;
    this.labelEl.classList.add('is-flash');
  }
  updateFlash(now: number, duration: number, baseHex: string, accentHex: string) {
    if (this.flashUntil <= 0) return;
    const remaining = this.flashUntil - now;
    if (remaining <= 0) {
      this.flashUntil = 0;
      this.material.color.set(baseHex);
      this.labelEl.classList.remove('is-flash');
      return;
    }
    const t = remaining / duration;
    const c = new THREE.Color(baseHex).lerp(new THREE.Color(accentHex), t);
    this.material.color.copy(c);
  }
  // Used by the front/back visibility test in the render loop.
  getSpriteWorldPos(out: THREE.Vector3): THREE.Vector3 {
    return this.cross.getWorldPosition(out);
  }
  dispose() {
    this.material.dispose();
    if (this.labelEl.parentElement) this.labelEl.parentElement.removeChild(this.labelEl);
  }
}

// ── Snake controller (Line2 for visible thick lines) ──────────
//
// A route is a sequence of "legs", each from one country to the next.
// In legacy (one-shot) mode every route has exactly one leg, then the
// snake winds up and `active` flips to null so the render loop can
// schedule the next route.
//
// In continuous mode the head pauses at each destination and a new leg
// is appended to the same `path` array. The trail (a fixed-length
// window behind the head) flows seamlessly across the join because the
// head's distance keeps growing along the same cumulative-length axis.
// The path arrays grow over time — for typical session lengths this is
// negligible (≈3KB/leg), so there's no pruning here.

type SnakePhase = 'travel' | 'pause' | 'wind-up';

interface SnakeRoute {
  endIdx: number;
  // Tracked separately from endIdx so that if the user edits the
  // country list mid-flight, we can still build the next leg from the
  // exact lat/lon the head actually arrived at.
  endCountry: Country;
  path: THREE.Vector3[];
  cumulative: number[];
  totalDistance: number;

  // Current leg: head travels legStartDist → legEndDist over legDuration
  // (recomputed each frame from the live speed param so the user can
  // dial speed mid-flight).
  legStartDist: number;
  legEndDist: number;
  legStartTime: number;
  flashed: boolean;

  phase: SnakePhase;
  // Valid when phase === 'pause'.
  pauseUntil: number;

  // Spring-tail state. tailDist is the position of the trail's back
  // end along the cumulative-length axis; tailVel is its rate of change
  // (units/sec). The tail is a damped harmonic oscillator pulled toward
  //   target = headDist − minGap   (in travel + pause), or
  //   target = headDist             (in wind-up, so the trail closes)
  // and clamped so it never crosses the head and never lags more than
  // maxGap behind it.
  tailDist: number;
  tailVel: number;
}

class SnakeController {
  line: Line2;
  geom: LineGeometry;
  material: LineMaterial;
  trailLength: number;
  scratch: Float32Array;
  active: SnakeRoute | null = null;
  scheduled: number | null = null; // absolute time, null = not scheduled
  // Last computed head distance along the active path. Used by the
  // snake icon to compute a stable head position + tangent without
  // having to re-derive timing inside the icon.
  lastHeadDist = 0;

  constructor(trailLength: number, accent: string) {
    this.trailLength = trailLength;
    this.scratch = new Float32Array(trailLength * 3);
    this.geom = new LineGeometry();
    this.geom.setPositions(this.scratch);
    this.material = new LineMaterial({
      color: new THREE.Color(accent).getHex(),
      linewidth: 3, // CSS pixels (Line2 supports this)
      transparent: true,
      depthTest: false,
      depthWrite: false,
      worldUnits: false,
      vertexColors: true, // we colour each vertex for fade-out tail
      dashed: false,
      alphaToCoverage: false,
    });
    this.material.blending = THREE.AdditiveBlending;
    this.material.resolution.set(window.innerWidth, window.innerHeight);

    this.line = new Line2(this.geom, this.material);
    this.line.computeLineDistances();
    this.line.renderOrder = 5;
    this.line.frustumCulled = false;
    this.line.visible = false;
  }

  setResolution(w: number, h: number) {
    this.material.resolution.set(w, h);
  }
  setWidth(w: number) {
    this.material.linewidth = w;
  }
  setAccentColor(hex: string) {
    this.material.color = new THREE.Color(hex);
  }
  setTrailLength(n: number) {
    if (n === this.trailLength) return;
    this.trailLength = n;
    this.scratch = new Float32Array(n * 3);
  }

  schedule(now: number, intervalMin: number, intervalMax: number) {
    const wait = intervalMin + Math.random() * Math.max(0, intervalMax - intervalMin);
    this.scheduled = now + wait;
  }

  begin(now: number, countries: Country[]) {
    if (countries.length < 2) return;
    const s = Math.floor(Math.random() * countries.length);
    let e = Math.floor(Math.random() * countries.length);
    if (e === s) e = (e + 1) % countries.length;
    const path = buildSnakePath(countries[s], countries[e]);
    const cumulative: number[] = [0];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += path[i].distanceTo(path[i - 1]);
      cumulative.push(total);
    }
    this.active = {
      endIdx: e,
      endCountry: countries[e],
      path,
      cumulative,
      totalDistance: total,
      legStartDist: 0,
      legEndDist: total,
      legStartTime: now,
      flashed: false,
      phase: 'travel',
      pauseUntil: 0,
      tailDist: 0,
      tailVel: 0,
    };
    this.lastHeadDist = 0;
    this.line.visible = true;
  }

  // Append a new leg from the current end country to a randomly picked
  // other country. Path / cumulative arrays grow; the head's distance
  // axis is shared, so the trail flows seamlessly across the join.
  appendLeg(now: number, countries: Country[]) {
    if (!this.active) return;
    const r = this.active;
    if (countries.length < 2) {
      // Can't continue — fall through to wind-up so the route ends
      // gracefully and the next `begin()` can start fresh.
      this.enterWindup(now);
      return;
    }
    let next = Math.floor(Math.random() * countries.length);
    // Avoid same destination AND, when the previous endIdx is still
    // valid in the (possibly edited) list, avoid that one too.
    if (countries[r.endIdx] === r.endCountry && next === r.endIdx) {
      next = (next + 1) % countries.length;
    }
    const startCountry = r.endCountry;
    const endCountry = countries[next];
    const seg = buildSnakePath(startCountry, endCountry);
    // seg[0] coincides with the existing path's last point (within
    // float precision, since both come from the same lat/lon). Skip it
    // so we don't insert a zero-length segment.
    let cum = r.totalDistance;
    for (let i = 1; i < seg.length; i++) {
      cum += seg[i].distanceTo(seg[i - 1]);
      r.path.push(seg[i]);
      r.cumulative.push(cum);
    }
    r.legStartDist = r.totalDistance;
    r.legEndDist = cum;
    r.totalDistance = cum;
    r.endIdx = next;
    r.endCountry = endCountry;
    r.legStartTime = now;
    r.flashed = false;
    r.phase = 'travel';
  }

  private enterWindup(_now: number) {
    if (!this.active) return;
    const r = this.active;
    r.phase = 'wind-up';
    // Spring tail keeps its current state; only the target switches
    // (head − minGap → head), so the closing motion looks like a
    // continuation, not a jump.
  }

  // Update geometry. Returns destination index when an arrival event
  // fires (so the render loop can flash that country's marker).
  update(
    now: number,
    dt: number,
    speed: number,
    intensity: number,
    easing: (u: number) => number,
    opts: {
      continuous: boolean;
      pauseMin: number;
      pauseMax: number;
      countries: Country[];
      trailMin: number;
      trailMax: number;
      trailFollow: number;
      // Floor on per-leg duration. Without this, very short legs (two
      // close countries) finish too fast for the eye to register; with
      // it, short legs are slowed down while long legs still scale
      // distance-by-speed as before.
      legMinDuration: number;
    },
  ): number {
    if (!this.active) {
      this.line.visible = false;
      return -1;
    }
    const r = this.active;
    let arrived = -1;

    // ── Head ──
    let headDist: number;
    if (r.phase === 'travel') {
      const legDist = r.legEndDist - r.legStartDist;
      // Strictly distance-based: time = distance / speed. Then floor
      // by legMinDuration so very short legs aren't visually rushed.
      const legDuration = Math.max(
        opts.legMinDuration,
        legDist / Math.max(0.01, speed),
      );
      const elapsed = now - r.legStartTime;
      if (elapsed < legDuration) {
        headDist = r.legStartDist + easing(elapsed / legDuration) * legDist;
      } else {
        // Arrived at this leg's destination.
        headDist = r.legEndDist;
        if (!r.flashed) {
          r.flashed = true;
          arrived = r.endIdx;
        }
        if (opts.continuous) {
          const wait =
            opts.pauseMin +
            Math.random() * Math.max(0, opts.pauseMax - opts.pauseMin);
          r.phase = 'pause';
          r.pauseUntil = now + wait;
        } else {
          this.enterWindup(now);
        }
      }
    } else if (r.phase === 'pause') {
      headDist = r.legEndDist;
      if (!opts.continuous) {
        // User toggled continuous off mid-pause — wind up cleanly.
        this.enterWindup(now);
      } else if (now >= r.pauseUntil) {
        this.appendLeg(now, opts.countries);
        // appendLeg sets phase to 'travel' (or 'wind-up' if it bailed).
        // Either way, head is still at the leg-join distance.
        headDist = r.legStartDist;
      }
    } else {
      // 'wind-up' — head holds at end while spring tail closes the gap.
      headDist = r.legEndDist;
    }

    // ── Spring tail ──
    // Map the single follow knob to a stiffness/damping pair. We pick
    // damping ≈ 0.7× critical so the tail very slightly overshoots
    // before settling — that lift is what kills the "robotic" feel,
    // because the tail keeps ghosting forward briefly when the head
    // stops, instead of locking into place.
    const minGap = Math.max(0.001, opts.trailMin);
    const maxGap = Math.max(minGap + 0.001, opts.trailMax);
    const stiffness = 10 + opts.trailFollow * 200;
    const damping = 0.7 * 2 * Math.sqrt(stiffness);
    const targetTail = (r.phase === 'wind-up') ? headDist : headDist - minGap;

    // Sub-step the spring so behaviour stays stable when dt is large
    // (e.g. tab refocus). 4 steps is plenty for this stiffness range.
    const STEPS = 4;
    const h = Math.max(1e-4, dt / STEPS);
    for (let s = 0; s < STEPS; s++) {
      const error = targetTail - r.tailDist;
      const accel = stiffness * error - damping * r.tailVel;
      r.tailVel += accel * h;
      r.tailDist += r.tailVel * h;
    }

    // Clamp gap to [minGap, maxGap] in non-wind-up phases. In wind-up
    // we let the tail drive all the way up to the head.
    if (r.phase === 'wind-up') {
      if (r.tailDist > headDist) {
        r.tailDist = headDist;
        if (r.tailVel > 0) r.tailVel = 0;
      }
    } else {
      if (r.tailDist > headDist - minGap) {
        r.tailDist = headDist - minGap;
        if (r.tailVel > 0) r.tailVel = 0;
      }
      if (r.tailDist < headDist - maxGap) {
        r.tailDist = headDist - maxGap;
        if (r.tailVel < 0) r.tailVel = 0;
      }
    }
    if (r.tailDist < 0) {
      r.tailDist = 0;
      if (r.tailVel < 0) r.tailVel = 0;
    }

    // Sample N points along path between tail..head.
    const N = this.trailLength;
    const positions = this.scratch;
    const colorArray = new Float32Array(N * 3);
    const baseCol = this.material.color;
    for (let i = 0; i < N; i++) {
      const tt = i / (N - 1);
      const d = THREE.MathUtils.lerp(r.tailDist, headDist, tt);
      const p = this.sampleAt(d);
      positions[i * 3 + 0] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const a = Math.pow(tt, 1.4);
      colorArray[i * 3 + 0] = baseCol.r * intensity * (0.25 + 1.5 * a);
      colorArray[i * 3 + 1] = baseCol.g * intensity * (0.25 + 1.5 * a);
      colorArray[i * 3 + 2] = baseCol.b * intensity * (0.25 + 1.5 * a);
    }
    this.geom.setPositions(positions);
    this.geom.setColors(colorArray);
    this.line.computeLineDistances();

    this.lastHeadDist = headDist;

    if (r.phase === 'wind-up' && r.tailDist >= r.legEndDist - 1e-3) {
      this.active = null;
      this.line.visible = false;
    }
    return arrived;
  }

  // Sample a stable tangent direction near the head. Looks slightly
  // forward at the very start of a route (when headDist ≈ 0 there is
  // no behind-point), and slightly backward otherwise. Returns false
  // when no route is active.
  sampleHeadAndTangent(headOut: THREE.Vector3, tangentOut: THREE.Vector3): boolean {
    if (!this.active) return false;
    const total = this.active.totalDistance;
    const back = Math.min(0.04, total * 0.05);
    const headD = Math.min(total, Math.max(0, this.lastHeadDist));
    headOut.copy(this.sampleAt(headD));
    let aD: number;
    let bD: number;
    if (headD < back) {
      aD = headD;
      bD = Math.min(total, headD + back);
    } else {
      aD = Math.max(0, headD - back);
      bD = headD;
    }
    if (bD - aD < 1e-5) {
      tangentOut.set(0, 0, 0);
      return true;
    }
    const a = this.sampleAt(aD);
    const b = this.sampleAt(bD);
    tangentOut.copy(b).sub(a);
    return true;
  }

  sampleAt(d: number): THREE.Vector3 {
    const r = this.active!;
    const cum = r.cumulative;
    if (d <= 0) return r.path[0];
    if (d >= cum[cum.length - 1]) return r.path[r.path.length - 1];
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= d) lo = m;
      else hi = m;
    }
    const span = cum[hi] - cum[lo] || 1;
    const t = (d - cum[lo]) / span;
    return new THREE.Vector3().lerpVectors(r.path[lo], r.path[hi], t);
  }

  dispose() {
    this.geom.dispose();
    this.material.dispose();
  }
}

// ── Snake head icon (GPS arrow) ───────────────────────────────
//
// HTML/SVG element mounted as a CSS2DObject and parented to `world`,
// so its world matrix tracks the globe rotation. Each frame we:
//   1. position it at the snake head's local position (same space as
//      the path samples), and
//   2. rotate the inner element by the screen-space heading of the
//      path tangent — atan2(dx, dy) on NDC deltas, where +y is up so
//      "moving up the screen" = 0° (clockwise from up).
//
// The bundled GPS arrow points up-right (≈2 o'clock). To make 0°
// rotation mean "north", a -45° rotation is baked into the SVG via a
// <g transform>; the inner SVG runs `overflow: visible` so the rotated
// arrow isn't clipped by the original viewBox.
const ICON_STYLE_ID = 'globe-1-snake-icon-css';
const SNAKE_ICON_SVG_PATH =
  'M443.537,3.805c-3.84-3.84-9.686-4.893-14.625-2.613L7.553,195.239' +
  'c-4.827,2.215-7.807,7.153-7.535,12.459c0.254,5.305,3.727,9.908,8.762,11.63' +
  'l129.476,44.289c21.349,7.314,38.125,24.089,45.438,45.438l44.321,129.509' +
  'c1.72,5.018,6.325,8.491,11.63,8.762c5.306,0.271,10.244-2.725,12.458-7.535' +
  'L446.15,18.429C448.428,13.491,447.377,7.644,443.537,3.805z';

function ensureSnakeIconStyles() {
  if (document.getElementById(ICON_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = ICON_STYLE_ID;
  el.textContent = `
    .globe-1-snake-icon {
      pointer-events: none;
      will-change: opacity;
    }
    .globe-1-snake-icon-rotor {
      display: block;
      transform-origin: 50% 50%;
      will-change: transform;
      line-height: 0;
    }
    .globe-1-snake-icon-svg {
      display: block;
      overflow: visible;
    }
  `;
  document.head.appendChild(el);
}

class SnakeIcon {
  el: HTMLElement;
  rotor: HTMLElement;
  svgEl: SVGSVGElement;
  pathEl: SVGPathElement;
  obj: CSS2DObject;
  size = 22;
  rotationOffsetDeg = 0;
  lastHeadingDeg = 0;

  constructor() {
    ensureSnakeIconStyles();
    const wrap = document.createElement('div');
    wrap.className = 'globe-1-snake-icon';

    this.rotor = document.createElement('div');
    this.rotor.className = 'globe-1-snake-icon-rotor';

    const svgNS = 'http://www.w3.org/2000/svg';
    this.svgEl = document.createElementNS(svgNS, 'svg');
    this.svgEl.setAttribute('viewBox', '0 0 447.342 447.342');
    this.svgEl.setAttribute('class', 'globe-1-snake-icon-svg');
    this.svgEl.setAttribute('xmlns', svgNS);

    const g = document.createElementNS(svgNS, 'g');
    // -45° around the path's bbox center makes the default arrow point
    // up (north). The rotated tail extends outside the viewBox; the
    // SVG's overflow:visible style lets it render anyway.
    g.setAttribute('transform', 'rotate(-45 223.671 223.671)');

    this.pathEl = document.createElementNS(svgNS, 'path');
    this.pathEl.setAttribute('d', SNAKE_ICON_SVG_PATH);
    this.pathEl.setAttribute('fill', 'currentColor');
    g.appendChild(this.pathEl);
    this.svgEl.appendChild(g);

    this.rotor.appendChild(this.svgEl);
    wrap.appendChild(this.rotor);
    this.el = wrap;

    this.obj = new CSS2DObject(wrap);
    this.applySize();
  }

  setSize(px: number) {
    if (px === this.size) return;
    this.size = px;
    this.applySize();
  }
  private applySize() {
    this.svgEl.setAttribute('width', String(this.size));
    this.svgEl.setAttribute('height', String(this.size));
  }
  setColor(hex: string) {
    this.el.style.color = hex;
  }
  setRotationOffset(deg: number) {
    this.rotationOffsetDeg = deg;
    this.applyRotation();
  }
  setHeading(deg: number) {
    this.lastHeadingDeg = deg;
    this.applyRotation();
  }
  private applyRotation() {
    this.rotor.style.transform = `rotate(${this.lastHeadingDeg + this.rotationOffsetDeg}deg)`;
  }
  setOpacity(o: number) {
    this.el.style.opacity = String(o);
  }
  setVisible(v: boolean) {
    this.el.style.visibility = v ? 'visible' : 'hidden';
  }
  setLocalPosition(p: THREE.Vector3) {
    this.obj.position.copy(p);
  }
  dispose() {
    if (this.el.parentElement) this.el.parentElement.removeChild(this.el);
  }
}

// ── Inline country editor (lives inside the DialKit panel) ────
//
// Replaces the cramped DialKit text input for `countriesJson` with
// a draggable list of rows — one per country — that writes back
// into the same `countriesJson` value via DialStore so the rest of
// the system (cache, presets, baked export) stays unaware. Mounts
// inside the Countries folder content so the globe stays visible.

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
    /* Hide the original tiny countriesJson text-input row */
    .globe-1-editor-hide { display: none !important; }
  `;
  document.head.appendChild(el);
}

interface InlineEditorHandle {
  destroy(): void;
}

function mountInlineCountriesEditor(
  panelTitle: string,
  defaultsFallback: Country[],
): InlineEditorHandle {
  ensureEditorStyles();

  let mounted = false;
  let editorEl: HTMLElement | null = null;
  let unsubscribe: (() => void) | null = null;
  let listEl: HTMLDivElement | null = null;
  let countries: Country[] = [];
  // The JSON we last pushed — when DialStore echoes the same value back
  // through subscribe() we skip the rebuild that would steal focus.
  let lastSelfPushedJson = '';
  let panelId: string | null = null;
  let hiddenRow: HTMLElement | null = null;

  // Read the current countriesJson value from DialStore.
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
    head.innerHTML =
      '<span>Name</span><span>Lat</span><span>Lon</span>';
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

    // Find the Countries folder by its title text.
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

    // Hide the existing tiny countriesJson text input row.
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

    // Initialise from the live value (cached / preset) or fall back.
    const initialJson = readCurrentJson();
    countries = parseCountries(initialJson, defaultsFallback);
    lastSelfPushedJson = JSON.stringify(countries, null, 2);

    editorEl = buildEditor();
    content.appendChild(editorEl);
    renderRows();

    // Keep the editor in sync with external value changes (preset
    // load, Reset to Defaults, version switch). Ignore echoes from
    // our own pushJson() calls.
    unsubscribe = DialStore.subscribe(panel.id, () => {
      const incoming = readCurrentJson();
      if (incoming === lastSelfPushedJson) return;
      const next = parseCountries(incoming, defaultsFallback);
      // Only rebuild rows if the structure changed (length / order)
      // or values changed; cheap shallow diff.
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

  // The DialKit panel can mount asynchronously (React effects, lazy
  // folders). Watch the DOM until it appears, then tear down the
  // observer. Also run once eagerly in case it's already there.
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

// ── Init ──────────────────────────────────────────────────────

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { canvas, params } = ctx;

  ensureStyles(
    (params.labelColor as string) ?? '#cfcfcf',
    (params.labelSize as number) ?? 11,
    (params.labelOffsetY as number) ?? 14,
  );

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.autoClear = true;
  renderer.setClearColor('#000000', 1);

  const labelRenderer = new CSS2DRenderer();
  Object.assign(labelRenderer.domElement.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    userSelect: 'none',
  });
  const overlayParent = canvas.parentElement ?? document.body;
  overlayParent.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20);
  camera.position.set(0, 0, 4.5);

  const world = new THREE.Group();
  scene.add(world);

  // Dark fill sphere (slightly inside the wireframe) so back-side
  // lines show through faintly.
  const haloGeom = new THREE.SphereGeometry(GLOBE_RADIUS * 0.998, 64, 32);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.92,
  });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  world.add(halo);

  // Wireframe (LineSegments — many tiny segments, default 1px is fine)
  const lineGeom = new THREE.BufferGeometry();
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x5a5a52,
    transparent: true,
    opacity: 0.45,
  });
  const wireframe = new THREE.LineSegments(lineGeom, lineMat);
  world.add(wireframe);

  let currentLonSeg = -1;
  let currentLatSeg = -1;
  function rebuildGrid(lonSeg: number, latSeg: number) {
    if (lonSeg === currentLonSeg && latSeg === currentLatSeg) return;
    currentLonSeg = lonSeg;
    currentLatSeg = latSeg;
    lineGeom.setAttribute(
      'position',
      new THREE.BufferAttribute(buildGridPositions(lonSeg, latSeg), 3),
    );
    lineGeom.computeBoundingSphere();
  }

  // Markers
  const crossTex = makeCrossTexture();
  let countryList: Country[] = parseCountries(
    params.countriesJson as string,
    DEFAULT_COUNTRIES,
  );
  let snappedCountries: Country[] = countryList;
  const markers: CountryMarker[] = [];
  let lastSnapMode: SnapMode | '' = '';
  let lastCountriesJson = params.countriesJson as string;
  let lastSurface = !!params.crossOnSurface;

  function rebuildMarkers() {
    for (const m of markers) {
      world.remove(m.group);
      m.dispose();
    }
    markers.length = 0;
    const lonSeg = Math.max(3, Math.round(params.lonSegments as number));
    const latSeg = Math.max(2, Math.round(params.latSegments as number));
    const mode = (params.snapMode as SnapMode) ?? 'nearest line';
    const surface = !!params.crossOnSurface;
    lastSurface = surface;
    snappedCountries = countryList.map((c) => ({
      name: c.name,
      ...snapCountry(c.lat, c.lon, lonSeg, latSeg, mode),
    }));
    for (const c of snappedCountries) {
      const m = new CountryMarker(c, crossTex, surface);
      m.setPosition(c.lat, c.lon);
      m.setColors(params.crossColor as string, params.labelColor as string);
      m.setSize(params.crossSize as number);
      world.add(m.group);
      markers.push(m);
    }
  }

  // Snake (Line2)
  const snake = new SnakeController(
    params.snakeTrailDetail as number,
    params.accentColor as string,
  );
  world.add(snake.line);

  // Snake head icon — parented to `world` so its position auto-tracks
  // the globe rotation. Hidden by default; shown only while a snake
  // route is active and on the front side of the globe.
  const snakeIcon = new SnakeIcon();
  snakeIcon.setColor(params.snakeIconColor as string);
  snakeIcon.setSize(params.snakeIconSize as number);
  snakeIcon.setRotationOffset(params.snakeIconRotationOffset as number);
  snakeIcon.setVisible(false);
  world.add(snakeIcon.obj);

  // Initial build
  rebuildGrid(
    Math.round(params.lonSegments as number),
    Math.round(params.latSegments as number),
  );
  rebuildMarkers();
  lastSnapMode = (params.snapMode as SnapMode) ?? 'nearest line';

  // ── Drag interaction ──────────────────────────────────────
  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };
  // Drag offsets relative to base orientation (spring tracks these to zero).
  let yawOffset = 0;
  let pitchOffset = 0;
  let yawVel = 0;
  let pitchVel = 0;
  // Auto-spin accumulators (independent of drag spring).
  let autoYaw = 0;
  let autoPitch = 0;

  const handlePointerDown = (e: PointerEvent) => {
    isDragging = true;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    yawVel = 0;
    pitchVel = 0;
    canvas.setPointerCapture?.(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer.x = e.clientX;
    lastPointer.y = e.clientY;
    const sens = (params.dragSensitivity as number) * 0.005;
    yawOffset += dx * sens;
    pitchOffset += dy * sens;
    pitchOffset = THREE.MathUtils.clamp(pitchOffset, -Math.PI * 0.55, Math.PI * 0.55);
  };
  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    canvas.style.cursor = 'grab';
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerUp);

  // ── Visibility (front/back of globe) ──────────────────────
  const _wp = new THREE.Vector3();
  // Scratch vectors for the snake icon's per-frame projection. Allocated
  // once here so the render loop never churns the GC.
  const _iconHead = new THREE.Vector3();
  const _iconTangent = new THREE.Vector3();
  const _iconHeadWorld = new THREE.Vector3();
  const _iconTipWorld = new THREE.Vector3();
  const _iconCenterView = new THREE.Vector3();
  function updateMarkerVisibility() {
    camera.updateMatrixWorld();
    const mInv = camera.matrixWorldInverse;
    const centerZ = new THREE.Vector3(0, 0, 0).applyMatrix4(mInv).z;
    for (const m of markers) {
      m.getSpriteWorldPos(_wp);
      const z = _wp.applyMatrix4(mInv).z;
      const limb = (z - centerZ) / GLOBE_RADIUS; // -1..+1
      const op = THREE.MathUtils.smoothstep(limb, 0.05, 0.35);
      m.setOpacity(op);
      m.setVisible(op > 0.02);
      m.setLabelVisible(op > 0.05);
    }
  }

  // ── Resize ────────────────────────────────────────────────
  function doResize(w: number, h: number, dpr: number) {
    const cssW = w / dpr;
    const cssH = h / dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / Math.max(1, cssH);
    camera.updateProjectionMatrix();
    labelRenderer.setSize(cssW, cssH);
    snake.setResolution(cssW * dpr, cssH * dpr);
  }

  // ── Inline DialKit-panel country editor ───────────────────
  // Mounts a draggable row editor inside the Countries folder and
  // hides the original tiny `countriesJson` text input. Writes
  // through DialStore so cache / presets / baked export keep working.
  const inlineEditor = mountInlineCountriesEditor(meta.title, DEFAULT_COUNTRIES);

  // ── Render loop ───────────────────────────────────────────
  let lastTime = -1;
  let scheduledOnce = false;

  return {
    render(time: number) {
      const dt = lastTime < 0 ? 1 / 60 : Math.min(time - lastTime, 0.1);
      lastTime = time;

      // Sync grid density / snap mode / country list (rebuild on change)
      const lonSeg = Math.max(3, Math.round(params.lonSegments as number));
      const latSeg = Math.max(2, Math.round(params.latSegments as number));
      const snapMode = ((params.snapMode as SnapMode) ?? 'nearest line') as SnapMode;
      const currentJson = params.countriesJson as string;
      let needsMarkers = false;
      if (lonSeg !== currentLonSeg || latSeg !== currentLatSeg) {
        rebuildGrid(lonSeg, latSeg);
        needsMarkers = true;
      }
      if (snapMode !== lastSnapMode) {
        lastSnapMode = snapMode;
        needsMarkers = true;
      }
      if (currentJson !== lastCountriesJson) {
        lastCountriesJson = currentJson;
        countryList = parseCountries(currentJson, DEFAULT_COUNTRIES);
        needsMarkers = true;
      }
      const surface = !!params.crossOnSurface;
      if (surface !== lastSurface) needsMarkers = true;
      if (needsMarkers) rebuildMarkers();

      // Sync snake config
      const trail = Math.max(4, Math.round(params.snakeTrailDetail as number));
      if (trail !== snake.trailLength) snake.setTrailLength(trail);
      snake.setAccentColor(params.accentColor as string);
      snake.setWidth(params.snakeWidth as number);

      // Sync line / cross / label colors
      lineMat.color.set(params.lineColor as string);
      lineMat.opacity = params.lineOpacity as number;
      const cs = params.crossSize as number;
      for (const m of markers) {
        m.setColors(params.crossColor as string, params.labelColor as string);
        m.setSize(cs);
      }
      ensureStyles(
        params.labelColor as string,
        params.labelSize as number,
        params.labelOffsetY as number,
      );

      // FOV / zoom
      const fov = params.fov as number;
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const zoom = params.zoom as number;
      camera.position.setLength(4.5 / Math.max(0.01, zoom));

      // Layer toggles
      wireframe.visible = (params.showLines as boolean) !== false;
      const showCountries = (params.showCountries as boolean) !== false;
      const showLabels = (params.showLabels as boolean) !== false;
      for (const m of markers) {
        m.group.visible = showCountries;
        m.labelEl.style.display = showLabels ? '' : 'none';
      }
      const showSnake = (params.showSnake as boolean) !== false;

      // Background
      renderer.setClearColor(params.bgColor as string, 1);
      haloMat.color.set(params.bgColor as string);

      // Auto spin (independent of drag spring — accumulates always
      // unless paused while dragging).
      const spinPaused =
        (params.pauseSpinOnDrag as boolean) !== false && isDragging;
      if ((params.autoSpin as boolean) && !spinPaused) {
        const speed = params.autoSpinSpeed as number;
        const axis = params.autoSpinAxis as string;
        if (axis === 'X (pitch)') autoPitch += speed * dt;
        else if (axis === 'Both') {
          autoYaw += speed * dt;
          autoPitch += speed * dt * 0.4;
        } else autoYaw += speed * dt;
      }

      // Drag spring: ease drag offsets toward 0 when not dragging.
      if (!isDragging) {
        const sp = (params.dragSpring as unknown as SpringValue) ?? { type: 'spring' };
        const stiffness = sp.stiffness ?? 110;
        const damping = sp.damping ?? 18;
        const mass = Math.max(0.05, sp.mass ?? 1);
        // Sub-step physics so behaviour stays stable when dt is large.
        const steps = 4;
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          const aYaw = (-stiffness * yawOffset - damping * yawVel) / mass;
          const aPitch = (-stiffness * pitchOffset - damping * pitchVel) / mass;
          yawVel += aYaw * h;
          pitchVel += aPitch * h;
          yawOffset += yawVel * h;
          pitchOffset += pitchVel * h;
        }
        if (
          Math.abs(yawOffset) < 1e-4 && Math.abs(pitchOffset) < 1e-4 &&
          Math.abs(yawVel) < 1e-4 && Math.abs(pitchVel) < 1e-4
        ) {
          yawOffset = pitchOffset = yawVel = pitchVel = 0;
        }
      }

      // Apply rotations: base + drag offset + auto spin offset.
      const basePitch = THREE.MathUtils.degToRad(params.basePitchDeg as number);
      const baseYaw = THREE.MathUtils.degToRad(params.baseYawDeg as number);
      world.rotation.set(
        basePitch + pitchOffset + autoPitch,
        baseYaw + yawOffset + autoYaw,
        0,
      );

      // Snake animation
      if (showSnake) {
        if (!snake.active) {
          if (!scheduledOnce) {
            snake.schedule(
              time,
              params.snakeIntervalMin as number,
              params.snakeIntervalMax as number,
            );
            scheduledOnce = true;
          } else if (snake.scheduled !== null && time >= snake.scheduled) {
            snake.scheduled = null;
            snake.begin(time, snappedCountries);
          }
        }
        const easeCfg = params.snakeEase as unknown as TransitionValue | undefined;
        const ease = makeEaseFn(easeCfg);
        const continuous = (params.snakeContinuous as boolean) === true;
        const arrived = snake.update(
          time,
          dt,
          params.snakeSpeed as number,
          params.snakeIntensity as number,
          ease,
          {
            continuous,
            pauseMin: params.snakeIntervalMin as number,
            pauseMax: params.snakeIntervalMax as number,
            countries: snappedCountries,
            trailMin: params.snakeTrailMin as number,
            trailMax: params.snakeTrailLength as number,
            trailFollow: params.snakeTrailFollow as number,
            legMinDuration: params.snakeLegMinDuration as number,
          },
        );
        if (arrived >= 0 && arrived < markers.length) {
          markers[arrived].flash(time, params.snakeFlashDuration as number);
          // Only schedule a fresh route in legacy mode — in continuous
          // mode the controller appends the next leg internally.
          if (!continuous) {
            snake.schedule(
              time,
              params.snakeIntervalMin as number,
              params.snakeIntervalMax as number,
            );
          }
        }
      } else {
        snake.active = null;
        snake.line.visible = false;
      }

      // Marker flash decay
      for (const m of markers) {
        m.updateFlash(
          time,
          params.snakeFlashDuration as number,
          params.crossColor as string,
          params.accentColor as string,
        );
      }

      camera.updateMatrixWorld();
      // The world group's matrix is normally refreshed inside
      // renderer.render(); refresh it here so the icon's projection
      // uses this frame's rotation, not last frame's.
      world.updateMatrixWorld();
      updateMarkerVisibility();

      // Snake head icon — sync style every frame, then drive it from
      // the snake's current head + tangent. Heading is the screen-space
      // angle of the tangent, in CSS rotation convention (clockwise
      // from "up"): atan2(dx_ndc, dy_ndc).
      snakeIcon.setColor(params.snakeIconColor as string);
      snakeIcon.setSize(params.snakeIconSize as number);
      snakeIcon.setRotationOffset(params.snakeIconRotationOffset as number);
      const showIcon =
        showSnake &&
        (params.showSnakeIcon as boolean) !== false &&
        !!snake.active;
      if (showIcon && snake.active) {
        const headLocal = _iconHead;
        const tangentLocal = _iconTangent;
        const ok = snake.sampleHeadAndTangent(headLocal, tangentLocal);
        if (ok) {
          snakeIcon.setLocalPosition(headLocal);

          // Project head + (head + tangent) to NDC; the tangent is in
          // local space but we need world space, so push both points
          // through world.matrixWorld first.
          _iconHeadWorld.copy(headLocal).applyMatrix4(world.matrixWorld);
          _iconTipWorld.copy(headLocal).add(tangentLocal).applyMatrix4(world.matrixWorld);
          const headNDC = _iconHeadWorld.clone().project(camera);
          const tipNDC = _iconTipWorld.clone().project(camera);
          const dx = tipNDC.x - headNDC.x;
          const dy = tipNDC.y - headNDC.y;
          if (Math.hypot(dx, dy) > 1e-5) {
            const headingDeg = Math.atan2(dx, dy) * 180 / Math.PI;
            snakeIcon.setHeading(headingDeg);
          }

          // Visibility (front-of-globe + opacity) using the same limb
          // test as country markers so the icon hides when the head
          // wraps to the back hemisphere.
          const headView = _iconHeadWorld.applyMatrix4(camera.matrixWorldInverse);
          const centerView = _iconCenterView
            .set(0, 0, 0)
            .applyMatrix4(world.matrixWorld)
            .applyMatrix4(camera.matrixWorldInverse);
          const limb = (headView.z - centerView.z) / GLOBE_RADIUS;
          const op = THREE.MathUtils.smoothstep(limb, 0.05, 0.35) *
            (params.snakeIconOpacity as number);
          snakeIcon.setOpacity(op);
          snakeIcon.setVisible(op > 0.02);
        } else {
          snakeIcon.setVisible(false);
        }
      } else {
        snakeIcon.setVisible(false);
      }

      renderer.resetState();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    },

    resize(w: number, h: number, dpr: number) {
      doResize(w, h, dpr);
    },

    dispose() {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      canvas.style.cursor = '';

      inlineEditor.destroy();

      for (const m of markers) {
        world.remove(m.group);
        m.dispose();
      }
      markers.length = 0;

      world.remove(snakeIcon.obj);
      snakeIcon.dispose();

      snake.dispose();
      lineGeom.dispose();
      lineMat.dispose();
      haloGeom.dispose();
      haloMat.dispose();
      crossTex.dispose();

      if (labelRenderer.domElement.parentElement) {
        labelRenderer.domElement.parentElement.removeChild(labelRenderer.domElement);
      }
      renderer.dispose();
    },
  };
}

function parseCountries(json: string, fallback: Country[]): Country[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return fallback;
    const out: Country[] = [];
    for (const item of parsed) {
      if (
        item &&
        typeof item.name === 'string' &&
        typeof item.lat === 'number' &&
        typeof item.lon === 'number'
      ) {
        out.push({ name: item.name, lat: item.lat, lon: item.lon });
      }
    }
    return out.length ? out : fallback;
  } catch {
    return fallback;
  }
}

export const globe1Experiment: Experiment = {
  meta,
  controls,
  initGL,
};
