// ============================================================
// FullscreenQuad — WebGPU fullscreen triangle-strip quad
// ============================================================

export class FullscreenQuad {
  private _vertexBuffer: GPUBuffer;
  private _pipeline: GPURenderPipeline | null = null;

  constructor(private device: GPUDevice) {
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);
    this._vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });
    new Float32Array(this._vertexBuffer.getMappedRange()).set(vertices);
    this._vertexBuffer.unmap();
  }

  createPipeline(
    vertexModule: GPUShaderModule,
    fragmentModule: GPUShaderModule,
    format: GPUTextureFormat,
    bindGroupLayout: GPUBindGroupLayout,
  ): GPURenderPipeline {
    this._pipeline = this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      vertex: {
        module: vertexModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 8,
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: 'float32x2',
          }],
        }],
      },
      fragment: {
        module: fragmentModule,
        entryPoint: 'fs_main',
        targets: [{ format }],
      },
      primitive: {
        topology: 'triangle-strip',
        stripIndexFormat: 'uint32',
      },
    });
    return this._pipeline;
  }

  draw(pass: GPURenderPassEncoder): void {
    pass.setVertexBuffer(0, this._vertexBuffer);
    pass.draw(4, 1, 0, 0);
  }

  dispose(): void {
    this._vertexBuffer.destroy();
  }
}
