// ============================================================
// Globe 1 — Snake controller (Line2-based glowing trail)
// ============================================================
//
// A route is a sequence of "legs". In legacy mode each route has one
// leg; in continuous mode the head pauses at each destination and a
// new leg is appended to the same path so the trail flows seamlessly
// across the join.
//
// The tail is a damped harmonic oscillator pulled toward
//   target = headDist − minGap   (in travel + pause), or
//   target = headDist             (in wind-up, so the trail closes)
// and clamped so it never crosses the head and never lags more than
// maxGap behind it.

import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { buildSnakePath } from './helpers.ts';
import type { Country } from './params.ts';

export type SnakePhase = 'travel' | 'pause' | 'wind-up';

export interface SnakeRoute {
  endIdx: number;
  endCountry: Country;
  path: THREE.Vector3[];
  cumulative: number[];
  totalDistance: number;

  legStartDist: number;
  legEndDist: number;
  legStartTime: number;
  flashed: boolean;

  phase: SnakePhase;
  pauseUntil: number;

  tailDist: number;
  tailVel: number;
}

export interface SnakeUpdateOpts {
  continuous: boolean;
  pauseMin: number;
  pauseMax: number;
  countries: Country[];
  trailMin: number;       // resting gap (params.snakeTrailMin)
  trailLength: number;    // stretch cap (params.snakeTrailLength)
  trailFollow: number;    // tightness (params.snakeTrailFollow)
  legMinDuration: number; // floor on per-leg duration (params.snakeLegMinDuration)
}

export class SnakeController {
  line: Line2;
  geom: LineGeometry;
  material: LineMaterial;
  trailDetail: number; // vertex count along the trail (params.snakeTrailDetail)
  scratch: Float32Array;
  // Hoisted out of update() so we don't allocate every frame.
  colorScratch: Float32Array;
  active: SnakeRoute | null = null;
  scheduled: number | null = null;
  lastHeadDist = 0;

  // Reusable Vector3s for sampleAt() — mutated rather than allocated.
  private _sampleOut = new THREE.Vector3();
  private _sampleA = new THREE.Vector3();
  private _sampleB = new THREE.Vector3();

  constructor(trailDetail: number, accent: string) {
    this.trailDetail = trailDetail;
    this.scratch = new Float32Array(trailDetail * 3);
    this.colorScratch = new Float32Array(trailDetail * 3);
    this.geom = new LineGeometry();
    this.geom.setPositions(this.scratch);
    this.material = new LineMaterial({
      color: new THREE.Color(accent).getHex(),
      linewidth: 3,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      worldUnits: false,
      vertexColors: true,
      dashed: false,
      alphaToCoverage: true,
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
    // Mutate in place rather than allocating a new Color each frame.
    this.material.color.set(hex);
  }
  setTrailDetail(n: number) {
    if (n === this.trailDetail) return;
    this.trailDetail = n;
    this.scratch = new Float32Array(n * 3);
    this.colorScratch = new Float32Array(n * 3);
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

  appendLeg(now: number, countries: Country[]) {
    if (!this.active) return;
    const r = this.active;
    if (countries.length < 2) {
      this.enterWindup(now);
      return;
    }
    let next = Math.floor(Math.random() * countries.length);
    if (countries[r.endIdx] === r.endCountry && next === r.endIdx) {
      next = (next + 1) % countries.length;
    }
    const startCountry = r.endCountry;
    const endCountry = countries[next];
    const seg = buildSnakePath(startCountry, endCountry);
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

  // After many legs in continuous mode, trim the front of the path
  // since only the trail-window worth of points behind tail is needed.
  // Called occasionally rather than every leg to amortise the array
  // splicing cost.
  prunePath(safetyMargin = 1) {
    if (!this.active) return;
    const r = this.active;
    if (r.path.length < 600) return; // not worth pruning small paths
    const cutoff = Math.max(0, r.tailDist - safetyMargin);
    let firstKeep = 0;
    while (
      firstKeep < r.cumulative.length - 1 &&
      r.cumulative[firstKeep + 1] < cutoff
    ) {
      firstKeep++;
    }
    if (firstKeep < 1) return;
    r.path.splice(0, firstKeep);
    r.cumulative.splice(0, firstKeep);
  }

  private enterWindup(_now: number) {
    if (!this.active) return;
    this.active.phase = 'wind-up';
  }

  // Updates geometry. Returns destination index when an arrival event
  // fires (so the render loop can flash that country's marker).
  update(
    now: number,
    dt: number,
    speed: number,
    intensity: number,
    easing: (u: number) => number,
    opts: SnakeUpdateOpts,
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
      const legDuration = Math.max(
        opts.legMinDuration,
        legDist / Math.max(0.01, speed),
      );
      const elapsed = now - r.legStartTime;
      if (elapsed < legDuration) {
        headDist = r.legStartDist + easing(elapsed / legDuration) * legDist;
      } else {
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
        this.enterWindup(now);
      } else if (now >= r.pauseUntil) {
        this.appendLeg(now, opts.countries);
        headDist = r.legStartDist;
      }
    } else {
      // 'wind-up'
      headDist = r.legEndDist;
    }

    // ── Spring tail ──
    const minGap = Math.max(0.001, opts.trailMin);
    const maxGap = Math.max(minGap + 0.001, opts.trailLength);
    const stiffness = 10 + opts.trailFollow * 200;
    const damping = 0.7 * 2 * Math.sqrt(stiffness);
    const targetTail = (r.phase === 'wind-up') ? headDist : headDist - minGap;

    const STEPS = 4;
    const h = Math.max(1e-4, dt / STEPS);
    for (let s = 0; s < STEPS; s++) {
      const error = targetTail - r.tailDist;
      const accel = stiffness * error - damping * r.tailVel;
      r.tailVel += accel * h;
      r.tailDist += r.tailVel * h;
    }

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

    // Sample N points along path between tail..head into pre-allocated
    // buffers (no per-frame Float32Array allocation).
    const N = this.trailDetail;
    const positions = this.scratch;
    const colorArray = this.colorScratch;
    const baseCol = this.material.color;
    const sample = this._sampleOut;
    for (let i = 0; i < N; i++) {
      const tt = i / (N - 1);
      const d = THREE.MathUtils.lerp(r.tailDist, headDist, tt);
      this.sampleAt(d, sample);
      positions[i * 3 + 0] = sample.x;
      positions[i * 3 + 1] = sample.y;
      positions[i * 3 + 2] = sample.z;
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

  // Sample head + tangent. Mutates the supplied vectors.
  sampleHeadAndTangent(headOut: THREE.Vector3, tangentOut: THREE.Vector3): boolean {
    if (!this.active) return false;
    const total = this.active.totalDistance;
    const back = Math.min(0.04, total * 0.05);
    const headD = Math.min(total, Math.max(0, this.lastHeadDist));
    this.sampleAt(headD, headOut);
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
    this.sampleAt(aD, this._sampleA);
    this.sampleAt(bD, this._sampleB);
    tangentOut.copy(this._sampleB).sub(this._sampleA);
    return true;
  }

  // Mutates `out`; never allocates.
  sampleAt(d: number, out: THREE.Vector3): THREE.Vector3 {
    const r = this.active!;
    const cum = r.cumulative;
    if (d <= 0) return out.copy(r.path[0]);
    if (d >= cum[cum.length - 1]) return out.copy(r.path[r.path.length - 1]);
    let lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= d) lo = m;
      else hi = m;
    }
    const span = cum[hi] - cum[lo] || 1;
    const t = (d - cum[lo]) / span;
    return out.copy(r.path[lo]).lerp(r.path[hi], t);
  }

  dispose() {
    this.geom.dispose();
    this.material.dispose();
  }
}
