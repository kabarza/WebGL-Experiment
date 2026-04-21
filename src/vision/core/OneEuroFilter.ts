// One-Euro filter — adaptive low-pass for noisy interactive signals.
// Casiez, Roussel, Vogel. "1€ filter: a simple speed-based low-pass filter
// for noisy input in interactive systems" (CHI 2012).

class LowPass {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    this.s = this.y === null ? value : alpha * value + (1 - alpha) * (this.s as number);
    this.y = value;
    return this.s;
  }

  hasRaw(): boolean {
    return this.y !== null;
  }

  lastRaw(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

function alphaFrom(cutoff: number, dtSeconds: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtSeconds);
}

export interface OneEuroOptions {
  minCutoff?: number;
  beta?: number;
  dCutoff?: number;
}

export class OneEuroFilter {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  private readonly x = new LowPass();
  private readonly dx = new LowPass();
  private lastMs: number | null = null;

  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 }: OneEuroOptions = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  filter(value: number, timestampMs: number): number {
    const dt = this.lastMs === null ? 1 / 60 : Math.max((timestampMs - this.lastMs) / 1000, 1e-6);
    this.lastMs = timestampMs;

    const prev = this.x.hasRaw() ? this.x.lastRaw() : value;
    const dvalue = (value - prev) / dt;
    const edx = this.dx.filter(dvalue, alphaFrom(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFrom(cutoff, dt));
  }

  reset(): void {
    this.x.reset();
    this.dx.reset();
    this.lastMs = null;
  }
}
