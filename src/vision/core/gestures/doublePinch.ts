import type { TrackedHand } from '../types';
import { dist2d, handScale } from '../handMath';
import { HAND_LANDMARK } from '../types';

// DoublePinchDetector — "double-click" gesture for hand input.
//
// Two pinch pulses within `doubleWindowMs` toggle `active`. A pulse = the
// moment pinchDistance crosses below `activateThreshold`; the phase only
// flips back to 'open' once pinchDistance exceeds `releaseThreshold`
// (hysteresis keeps a single squeeze from registering twice).
//
// `pulseDebounceMs` is a short floor between consecutive pulses so jitter
// near the threshold can't count as a pair; it does NOT gate the
// closed→open transition.
//
// `pulseCount` and `minPinchRecent` are exposed so the HUD can show whether
// pulses are firing at all, and how low the pinch actually goes — so the
// user can calibrate their own thresholds.

export type DoublePinchPhase = 'open' | 'closed';

export interface DoublePinchState {
  active: boolean;
  toggleJustFired: boolean;
  armed: boolean;
  center: [number, number] | null;
  size: number;
  pinchDistance: number;
  sizeDistance: number;
  phase: DoublePinchPhase;
  msSincePulse: number;
  pulseCount: number;
  minPinchRecent: number;
  handsSeen: number;
}

export interface DoublePinchDetectorOptions {
  activateThreshold?: number;
  releaseThreshold?: number;
  doubleWindowMs?: number;
  pulseDebounceMs?: number;
  graceMs?: number;
  recentWindowMs?: number;
}

const DEFAULTS: Required<DoublePinchDetectorOptions> = {
  activateThreshold: 0.45,
  releaseThreshold: 0.65,
  doubleWindowMs: 2000,
  pulseDebounceMs: 50,
  graceMs: 500,
  recentWindowMs: 2000,
};

interface Sample {
  t: number;
  d: number;
}

export class DoublePinchDetector {
  private active = false;
  private phase: DoublePinchPhase = 'open';
  private lastPulseTime = -Infinity;
  private lastHandTime = -Infinity;
  private lastCenter: [number, number] = [0.5, 0.5];
  private lastSize = 0.2;
  private pulseCount = 0;
  private samples: Sample[] = [];
  private readonly opts: Required<DoublePinchDetectorOptions>;

  constructor(options: DoublePinchDetectorOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  setOptions(partial: Partial<DoublePinchDetectorOptions>): void {
    Object.assign(this.opts, partial);
  }

  update(hands: TrackedHand[], t: number): DoublePinchState {
    const hand = hands.find((h) => h.stableLabel === 'Primary') ?? hands[0];
    let toggleJustFired = false;
    let pinchDistance = 0;
    let sizeDistance = 0;

    if (hand) {
      const scale = Math.max(handScale(hand), 1e-4);
      const thumb = hand.landmarks[HAND_LANDMARK.THUMB_TIP];
      const index = hand.landmarks[HAND_LANDMARK.INDEX_TIP];
      const middle = hand.landmarks[HAND_LANDMARK.MIDDLE_TIP];
      pinchDistance = dist2d(thumb, index) / scale;
      sizeDistance = dist2d(thumb, middle) / scale;
      this.lastCenter = [thumb.x, thumb.y];
      this.lastSize = sizeDistance;
      this.lastHandTime = t;

      this.samples.push({ t, d: pinchDistance });
      const cutoff = t - this.opts.recentWindowMs;
      while (this.samples.length > 0 && this.samples[0].t < cutoff) {
        this.samples.shift();
      }

      if (this.phase === 'open' && pinchDistance < this.opts.activateThreshold) {
        this.phase = 'closed';
        const gap = t - this.lastPulseTime;
        if (gap < this.opts.pulseDebounceMs) {
          // Ignore: likely jitter crossing the threshold back and forth.
        } else if (gap <= this.opts.doubleWindowMs && this.lastPulseTime > -Infinity) {
          this.active = !this.active;
          toggleJustFired = true;
          this.lastPulseTime = -Infinity;
          this.pulseCount += 1;
          console.log(
            `[Lens] pulse #${this.pulseCount} · TOGGLE → ${this.active ? 'ON' : 'OFF'} (gap ${Math.round(gap)}ms, p·${pinchDistance.toFixed(2)})`,
          );
        } else {
          const gapLabel = Number.isFinite(gap) ? `${Math.round(gap)}ms too slow` : 'first pinch';
          this.lastPulseTime = t;
          this.pulseCount += 1;
          console.log(
            `[Lens] pulse #${this.pulseCount} · armed (${gapLabel}, window ${this.opts.doubleWindowMs}ms, p·${pinchDistance.toFixed(2)})`,
          );
        }
      } else if (this.phase === 'closed' && pinchDistance > this.opts.releaseThreshold) {
        this.phase = 'open';
      }

      if (
        this.lastPulseTime > -Infinity &&
        t - this.lastPulseTime > this.opts.doubleWindowMs
      ) {
        this.lastPulseTime = -Infinity;
      }
    } else if (this.active && t - this.lastHandTime > this.opts.graceMs) {
      this.active = false;
      this.phase = 'open';
      this.lastPulseTime = -Infinity;
    }

    let minPinchRecent = Infinity;
    for (const s of this.samples) {
      if (s.d < minPinchRecent) minPinchRecent = s.d;
    }

    const armed = this.lastPulseTime > -Infinity;
    const msSincePulse = armed ? t - this.lastPulseTime : Infinity;

    return {
      active: this.active,
      toggleJustFired,
      armed,
      center: this.active ? this.lastCenter : null,
      size: this.lastSize,
      pinchDistance,
      sizeDistance,
      phase: this.phase,
      msSincePulse,
      pulseCount: this.pulseCount,
      minPinchRecent,
      handsSeen: hands.length,
    };
  }

  reset(): void {
    this.active = false;
    this.phase = 'open';
    this.lastPulseTime = -Infinity;
    this.lastHandTime = -Infinity;
    this.pulseCount = 0;
    this.samples.length = 0;
  }
}
