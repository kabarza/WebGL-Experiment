// ============================================================
// WebGPU Renderer — device lifecycle, canvas context, resize
// ============================================================

export class Renderer {
  device!: GPUDevice;
  context!: GPUCanvasContext;
  format!: GPUTextureFormat;
  canvas: HTMLCanvasElement;

  private _width = 0;
  private _height = 0;
  private _dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  async init(): Promise<boolean> {
    if (!navigator.gpu) return false;

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) return false;

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque',
    });

    this.resize();
    return true;
  }

  resize(): void {
    this._dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._width = Math.floor(window.innerWidth * this._dpr);
    this._height = Math.floor(window.innerHeight * this._dpr);

    this.canvas.width = this._width;
    this.canvas.height = this._height;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
  }

  get width(): number { return this._width; }
  get height(): number { return this._height; }
  get dpr(): number { return this._dpr; }

  getCurrentTextureView(): GPUTextureView {
    return this.context.getCurrentTexture().createView();
  }

  dispose(): void {
    this.device?.destroy();
  }
}
