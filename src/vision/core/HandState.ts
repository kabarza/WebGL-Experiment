import { OneEuroFilter, type OneEuroOptions } from './OneEuroFilter';
import type { Handedness, Landmark, StableLabel, TrackedHand } from './types';
import { HAND_LANDMARK } from './types';

export interface RawHand {
  landmarks: Landmark[];
  handedness: Handedness;
  confidence: number;
}

export interface HandStateOptions {
  maxHands?: number;
  matchDistance?: number;
  holdMs?: number;
  smoothing?: OneEuroOptions;
}

interface InternalHand extends TrackedHand {
  filters: OneEuroFilter[];
}

const DEFAULTS: Required<Omit<HandStateOptions, 'smoothing'>> & {
  smoothing: Required<OneEuroOptions>;
} = {
  maxHands: 2,
  matchDistance: 0.35,
  holdMs: 300,
  smoothing: { minCutoff: 1.2, beta: 0.02, dCutoff: 1.0 },
};

function wrist(h: { landmarks: Landmark[] }): Landmark {
  return h.landmarks[HAND_LANDMARK.WRIST];
}

function dist2d(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

let idCounter = 0;
function nextId(): string {
  return `hand-${++idCounter}`;
}

export class HandState {
  private hands: InternalHand[] = [];
  private readonly opts: typeof DEFAULTS;

  constructor(options: HandStateOptions = {}) {
    this.opts = {
      ...DEFAULTS,
      ...options,
      smoothing: { ...DEFAULTS.smoothing, ...(options.smoothing ?? {}) },
    };
  }

  update(raw: RawHand[], timestampMs: number): TrackedHand[] {
    const capped = raw.slice(0, this.opts.maxHands);

    // Greedy nearest-neighbor match on wrist position.
    const existing = [...this.hands];
    const matched = new Map<InternalHand, RawHand>();
    const unmatched = new Set(capped);

    const pairs: Array<{ tracked: InternalHand; candidate: RawHand; d: number }> = [];
    for (const tracked of existing) {
      for (const candidate of capped) {
        pairs.push({ tracked, candidate, d: dist2d(wrist(tracked), wrist(candidate)) });
      }
    }
    pairs.sort((a, b) => a.d - b.d);

    const usedTracked = new Set<InternalHand>();
    const usedCand = new Set<RawHand>();
    for (const p of pairs) {
      if (p.d > this.opts.matchDistance) break;
      if (usedTracked.has(p.tracked) || usedCand.has(p.candidate)) continue;
      matched.set(p.tracked, p.candidate);
      usedTracked.add(p.tracked);
      usedCand.add(p.candidate);
      unmatched.delete(p.candidate);
    }

    // Update matched hands: smooth new landmarks into their filters.
    for (const [tracked, candidate] of matched) {
      tracked.rawLandmarks = candidate.landmarks;
      tracked.landmarks = candidate.landmarks.map((lm, i) => {
        const fx = tracked.filters[i * 3];
        const fy = tracked.filters[i * 3 + 1];
        const fz = tracked.filters[i * 3 + 2];
        return {
          x: fx.filter(lm.x, timestampMs),
          y: fy.filter(lm.y, timestampMs),
          z: fz.filter(lm.z, timestampMs),
        };
      });
      tracked.handedness = candidate.handedness;
      tracked.confidence = candidate.confidence;
      tracked.lastSeen = timestampMs;
    }

    // Drop tracked hands that haven't been seen for holdMs.
    this.hands = existing.filter(
      (h) => matched.has(h) || timestampMs - h.lastSeen <= this.opts.holdMs,
    );

    // Assign stable labels to new candidates.
    const takenLabels = new Set<StableLabel>(this.hands.map((h) => h.stableLabel));
    for (const candidate of unmatched) {
      if (this.hands.length >= this.opts.maxHands) break;
      const label: StableLabel = takenLabels.has('Primary') ? 'Secondary' : 'Primary';
      takenLabels.add(label);
      const filters = Array.from(
        { length: candidate.landmarks.length * 3 },
        () => new OneEuroFilter(this.opts.smoothing),
      );
      const seeded = candidate.landmarks.map((lm, i) => ({
        x: filters[i * 3].filter(lm.x, timestampMs),
        y: filters[i * 3 + 1].filter(lm.y, timestampMs),
        z: filters[i * 3 + 2].filter(lm.z, timestampMs),
      }));
      this.hands.push({
        id: nextId(),
        stableLabel: label,
        handedness: candidate.handedness,
        landmarks: seeded,
        rawLandmarks: candidate.landmarks,
        confidence: candidate.confidence,
        firstSeen: timestampMs,
        lastSeen: timestampMs,
        filters,
      });
    }

    return this.snapshot();
  }

  snapshot(): TrackedHand[] {
    return this.hands.map(({ filters: _f, ...rest }) => ({ ...rest }));
  }

  getPair(): [TrackedHand, TrackedHand] | null {
    if (this.hands.length < 2) return null;
    const primary = this.hands.find((h) => h.stableLabel === 'Primary');
    const secondary = this.hands.find((h) => h.stableLabel === 'Secondary');
    if (!primary || !secondary) return null;
    return [primary, secondary];
  }

  reset(): void {
    this.hands = [];
  }
}
