// ============================================================
// Globe 1 — Pure math/util helpers shared by gallery + standalone
// No DOM, no class state. Side-effect free.
// ============================================================

import * as THREE from 'three';
import type { Country, SnapMode } from './params.ts';

// ── Constants ─────────────────────────────────────────────────

export const GLOBE_RADIUS = 1.0;
// Crosses and snake-path samples both live on this exact shell so
// they project to identical screen pixels at any view angle.
export const MARKER_RADIUS = GLOBE_RADIUS;

// ── Resolved DialKit transition types ─────────────────────────

export interface SpringValue {
  type: 'spring';
  stiffness?: number;
  damping?: number;
  mass?: number;
}
export interface EasingValue {
  type: 'easing';
  duration: number;
  ease: [number, number, number, number];
}
export interface SnakeSpringValue {
  type: 'spring';
  visualDuration?: number;
  bounce?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
}
export type TransitionValue = EasingValue | SnakeSpringValue;

// ── Coordinate conversion ─────────────────────────────────────

export function latLonToVec3(
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

// Snap a point's lat/lon according to one of five modes. Snap targets
// match the actual drawn lattice (-180+k·step / -90+k·step), so 21×19
// grids land on the lines instead of dead-centre between them.
export function snapCountry(
  latDeg: number,
  lonDeg: number,
  lonSeg: number,
  latSeg: number,
  mode: SnapMode,
): { lat: number; lon: number } {
  const lonStep = 360 / lonSeg;
  const latStep = 180 / latSeg;
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

// ── Grid + path geometry ──────────────────────────────────────

// Build the grid as one continuous polyline per meridian and parallel.
// Returns a flat list of polylines so the renderer can put each one in
// its own Line2 — that way LineMaterial only puts caps at the two real
// ends of each line, instead of at every internal sub-segment join
// (which would render as visible dots).
export function buildGridPolylines(lonSeg: number, latSeg: number): Float32Array[] {
  const radius = GLOBE_RADIUS;
  const subdiv = 64;
  const polylines: Float32Array[] = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < lonSeg; i++) {
    const lon = -180 + (360 * i) / lonSeg;
    const pts = new Float32Array((subdiv + 1) * 3);
    for (let j = 0; j <= subdiv; j++) {
      const lat = -90 + 180 * (j / subdiv);
      latLonToVec3(lat, lon, radius, tmp);
      pts[j * 3 + 0] = tmp.x;
      pts[j * 3 + 1] = tmp.y;
      pts[j * 3 + 2] = tmp.z;
    }
    polylines.push(pts);
  }
  for (let i = 1; i < latSeg; i++) {
    const lat = -90 + (180 * i) / latSeg;
    const pts = new Float32Array((subdiv + 1) * 3);
    for (let j = 0; j <= subdiv; j++) {
      const lon = -180 + 360 * (j / subdiv);
      latLonToVec3(lat, lon, radius, tmp);
      pts[j * 3 + 0] = tmp.x;
      pts[j * 3 + 1] = tmp.y;
      pts[j * 3 + 2] = tmp.z;
    }
    polylines.push(pts);
  }
  return polylines;
}

// L-shaped path: travel meridian (lon fixed) then parallel (lat fixed).
// Picks the shorter longitude direction.
export function buildSnakePath(
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

// ── Easing ────────────────────────────────────────────────────

// Cubic-bezier easing: solves x(t)=u via Newton, returns y(t).
export function cubicBezier(c1x: number, c1y: number, c2x: number, c2y: number) {
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

// Spring response → 0..1 normalised curve.
export function springEase(visualDuration: number, bounce: number) {
  const dur = Math.max(0.05, visualDuration);
  const b = Math.min(0.99, Math.max(0, bounce));
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

export function makeEaseFn(cfg: TransitionValue | undefined): (u: number) => number {
  if (!cfg) return (u) => u;
  if (cfg.type === 'easing' && cfg.ease) {
    return cubicBezier(cfg.ease[0], cfg.ease[1], cfg.ease[2], cfg.ease[3]);
  }
  if (cfg.type === 'spring') {
    return springEase(cfg.visualDuration ?? 0.5, cfg.bounce ?? 0);
  }
  return (u) => u;
}

// ── Cross texture (used by both Sprite + tangent-plane modes) ─

export function makeCrossTexture(): THREE.Texture {
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

// ── Country list parse ───────────────────────────────────────

export function parseCountries(json: string, fallback: Country[]): Country[] {
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

// ── Reduced motion preference ────────────────────────────────

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
