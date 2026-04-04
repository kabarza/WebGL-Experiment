// ============================================================
// RenderLoop — RAF with delta-time, accumulated time, pause, speed
// ============================================================

export type RenderCallback = (time: number, deltaTime: number) => void;

export class RenderLoop {
  private _running = false;
  private _paused = false;
  private _speed = 1.0;
  private _accTime = 0;
  private _lastTime = 0;
  private _rafId = 0;
  private _callback: RenderCallback;

  constructor(callback: RenderCallback) {
    this._callback = callback;
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop(): void {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  private _tick = (): void => {
    if (!this._running) return;

    const now = performance.now();
    const dt = Math.min((now - this._lastTime) / 1000, 0.1); // cap to 100ms
    this._lastTime = now;

    if (!this._paused) {
      this._accTime += dt * this._speed;
    }

    this._callback(this._accTime, dt);
    this._rafId = requestAnimationFrame(this._tick);
  };

  get paused(): boolean { return this._paused; }
  set paused(v: boolean) { this._paused = v; }

  get speed(): number { return this._speed; }
  set speed(v: number) { this._speed = v; }

  get time(): number { return this._accTime; }
}
