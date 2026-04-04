// ============================================================
// InputManager — Mouse/touch → normalized coords, lerp smoothing
// ============================================================

export interface InputState {
  mouse: { x: number; y: number };
  velocity: { x: number; y: number };
  isOver: boolean;
  isDown: boolean;
}

export class InputManager {
  private _target = { x: 0.5, y: 0.5 };
  private _current = { x: 0.5, y: 0.5 };
  private _prev = { x: 0.5, y: 0.5 };
  private _smoothing: number;
  private _element: HTMLElement;
  private _bound = {
    onPointerMove: this._onPointerMove.bind(this),
    onPointerDown: this._onPointerDown.bind(this),
    onPointerUp: this._onPointerUp.bind(this),
    onPointerEnter: this._onPointerEnter.bind(this),
    onPointerLeave: this._onPointerLeave.bind(this),
    onTouchMove: this._onTouchMove.bind(this),
  };

  /** Stable object — pass this reference to the experiment once.
   *  Properties are mutated in-place by update(). */
  readonly state: InputState = {
    mouse: { x: 0.5, y: 0.5 },
    velocity: { x: 0, y: 0 },
    isOver: false,
    isDown: false,
  };

  constructor(element: HTMLElement, smoothing = 0.04) {
    this._element = element;
    this._smoothing = smoothing;
    this._attach();
  }

  private _attach(): void {
    const el = this._element;
    el.addEventListener('pointermove', this._bound.onPointerMove);
    el.addEventListener('pointerdown', this._bound.onPointerDown);
    el.addEventListener('pointerup', this._bound.onPointerUp);
    el.addEventListener('pointerenter', this._bound.onPointerEnter);
    el.addEventListener('pointerleave', this._bound.onPointerLeave);
    el.addEventListener('touchmove', this._bound.onTouchMove, { passive: false });
  }

  private _onPointerMove(e: PointerEvent): void {
    this._target.x = e.clientX / window.innerWidth;
    this._target.y = 1.0 - e.clientY / window.innerHeight;
  }

  private _onPointerDown(): void {
    this.state.isDown = true;
  }

  private _onPointerUp(): void {
    this.state.isDown = false;
  }

  private _onPointerEnter(): void {
    this.state.isOver = true;
  }

  private _onPointerLeave(): void {
    this.state.isOver = false;
    this.state.isDown = false;
  }

  private _onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const t = e.touches[0];
    if (t) {
      this._target.x = t.clientX / window.innerWidth;
      this._target.y = 1.0 - t.clientY / window.innerHeight;
    }
  }

  /** Call once per frame to update smoothed values */
  update(): void {
    this._prev.x = this._current.x;
    this._prev.y = this._current.y;

    this._current.x += (this._target.x - this._current.x) * this._smoothing;
    this._current.y += (this._target.y - this._current.y) * this._smoothing;

    this.state.mouse.x = this._current.x;
    this.state.mouse.y = this._current.y;
    this.state.velocity.x = this._current.x - this._prev.x;
    this.state.velocity.y = this._current.y - this._prev.y;
  }

  dispose(): void {
    const el = this._element;
    el.removeEventListener('pointermove', this._bound.onPointerMove);
    el.removeEventListener('pointerdown', this._bound.onPointerDown);
    el.removeEventListener('pointerup', this._bound.onPointerUp);
    el.removeEventListener('pointerenter', this._bound.onPointerEnter);
    el.removeEventListener('pointerleave', this._bound.onPointerLeave);
    el.removeEventListener('touchmove', this._bound.onTouchMove);
  }
}
