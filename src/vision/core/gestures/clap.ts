import type { TrackedHand } from '../types';
import { pickPair, wristDistance, wristMidpoint } from '../handMath';

export type ClapMode = 'idle' | 'active';

export interface ClapState {
  mode: ClapMode;
  clapJustFired: boolean;
  effectActive: boolean;
  effectCenter: [number, number] | null;
  effectSize: number;
  inwardVelocity: number;
  wristDistance: number;
  msSinceClap: number;
  msSincePairSeen: number;
  handsSeen: number;
}

export interface ClapDetectorOptions {
  clapDistanceThreshold?: number;
  inwardVelocityThreshold?: number;
  cooldownMs?: number;
  velocityWindowMs?: number;
  historyMs?: number;
  activeGraceMs?: number;
}

const DEFAULTS: Required<ClapDetectorOptions> = {
  clapDistanceThreshold: 0.25,
  inwardVelocityThreshold: 0.5,
  cooldownMs: 500,
  velocityWindowMs: 200,
  historyMs: 600,
  activeGraceMs: 600,
};

interface Sample {
  d: number;
  t: number;
}

export class ClapDetector {
  private mode: ClapMode = 'idle';
  private lastClapTime = -Infinity;
  private lastPairTime = -Infinity;
  private lastCenter: [number, number] = [0.5, 0.5];
  private lastSize = 0;
  private readonly history: Sample[] = [];
  private readonly opts: Required<ClapDetectorOptions>;

  constructor(options: ClapDetectorOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  update(hands: TrackedHand[], t: number): ClapState {
    const pair = pickPair(hands);
    let d = this.lastSize;
    let center: [number, number] = this.lastCenter;
    let inwardVelocity = 0;
    let clapJustFired = false;

    if (pair) {
      d = wristDistance(pair[0], pair[1]);
      center = wristMidpoint(pair[0], pair[1]);
      this.lastCenter = center;
      this.lastSize = d;
      this.lastPairTime = t;

      this.history.push({ d, t });
      const oldest = t - this.opts.historyMs;
      while (this.history.length > 1 && this.history[0].t < oldest) {
        this.history.shift();
      }

      const windowStart = t - this.opts.velocityWindowMs;
      const windowSample = this.history.find((s) => s.t >= windowStart) ?? this.history[0];
      const dt = Math.max((t - windowSample.t) / 1000, 1e-3);
      inwardVelocity = (windowSample.d - d) / dt;

      const canFire = t - this.lastClapTime > this.opts.cooldownMs;
      if (
        canFire &&
        d < this.opts.clapDistanceThreshold &&
        inwardVelocity > this.opts.inwardVelocityThreshold
      ) {
        clapJustFired = true;
        this.lastClapTime = t;
        this.mode = 'active';
      }
    } else {
      // Pair briefly lost. Keep the active effect alive for activeGraceMs so
      // a transient tracking glitch doesn't snap the lens off. After grace,
      // settle back to idle.
      if (this.mode === 'active' && t - this.lastPairTime < this.opts.activeGraceMs) {
        // hold prior center/size
      } else {
        this.mode = 'idle';
        this.history.length = 0;
      }
    }

    return {
      mode: this.mode,
      clapJustFired,
      effectActive: this.mode === 'active',
      effectCenter: this.mode === 'active' ? center : null,
      effectSize: d,
      inwardVelocity,
      wristDistance: d,
      msSinceClap: this.lastClapTime === -Infinity ? Infinity : t - this.lastClapTime,
      msSincePairSeen: this.lastPairTime === -Infinity ? Infinity : t - this.lastPairTime,
      handsSeen: hands.length,
    };
  }

  reset(): void {
    this.mode = 'idle';
    this.lastClapTime = -Infinity;
    this.lastPairTime = -Infinity;
    this.history.length = 0;
    this.lastCenter = [0.5, 0.5];
    this.lastSize = 0;
  }
}
