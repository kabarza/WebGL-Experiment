// ============================================================
// UniformBuffer — Typed GPU uniform buffer, set by name
// ============================================================

export type UniformType = 'f32' | 'vec2f' | 'vec3f' | 'vec4f';

export interface UniformField {
  name: string;
  type: UniformType;
}

const TYPE_SIZE: Record<UniformType, number> = {
  f32: 4,
  vec2f: 8,
  vec3f: 12,
  vec4f: 16,
};

// WGSL alignment rules (std140-like)
const TYPE_ALIGN: Record<UniformType, number> = {
  f32: 4,
  vec2f: 8,
  vec3f: 16, // vec3 aligns to 16 in WGSL
  vec4f: 16,
};

interface FieldInfo {
  offset: number;
  size: number;
  type: UniformType;
}

export class UniformBuffer {
  private _buffer: GPUBuffer;
  private _data: ArrayBuffer;
  private _view: DataView;
  private _fields: Map<string, FieldInfo>;
  private _dirty = true;
  readonly byteLength: number;

  constructor(device: GPUDevice, fields: UniformField[]) {
    this._fields = new Map();

    // Compute layout with proper alignment
    let offset = 0;
    for (const field of fields) {
      const align = TYPE_ALIGN[field.type];
      const size = TYPE_SIZE[field.type];

      // Align offset
      offset = Math.ceil(offset / align) * align;

      this._fields.set(field.name, { offset, size, type: field.type });
      offset += size;
    }

    // Total size must be multiple of 16 (struct alignment)
    this.byteLength = Math.ceil(offset / 16) * 16;
    this._data = new ArrayBuffer(this.byteLength);
    this._view = new DataView(this._data);

    this._buffer = device.createBuffer({
      size: this.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  set(name: string, value: number | number[] | Float32Array): void {
    const info = this._fields.get(name);
    if (!info) return;

    if (typeof value === 'number') {
      this._view.setFloat32(info.offset, value, true);
    } else {
      for (let i = 0; i < value.length; i++) {
        this._view.setFloat32(info.offset + i * 4, value[i], true);
      }
    }
    this._dirty = true;
  }

  upload(device: GPUDevice): void {
    if (!this._dirty) return;
    device.queue.writeBuffer(this._buffer, 0, this._data);
    this._dirty = false;
  }

  get buffer(): GPUBuffer {
    return this._buffer;
  }

  dispose(): void {
    this._buffer.destroy();
  }
}
