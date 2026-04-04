// ============================================================
// WebGL2 Fallback Renderer — context creation, viewport, resize
// ============================================================

export class WebGLRenderer {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;

  private _width = 0;
  private _height = 0;
  private _dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      // Try WebGL1 as last resort
      const gl1 = canvas.getContext('webgl', {
        antialias: false,
        alpha: false,
      });
      if (!gl1) throw new Error('Neither WebGL2 nor WebGL are available');
      this.gl = gl1 as unknown as WebGL2RenderingContext;
    } else {
      this.gl = gl;
    }
    this.resize();
  }

  resize(): void {
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._width = Math.floor(window.innerWidth * this._dpr);
    this._height = Math.floor(window.innerHeight * this._dpr);

    this.canvas.width = this._width;
    this.canvas.height = this._height;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.gl.viewport(0, 0, this._width, this._height);
  }

  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get dpr(): number { return this._dpr; }

  dispose(): void {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}
