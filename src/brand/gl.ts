// ============================================================
// Small WebGL2 toolkit shared by the brand engines:
// program compilation, float render targets, ping-pong buffers,
// image textures and pixel readback.
// ============================================================

import { FullscreenQuadGL } from '../core/FullscreenQuadGL.ts';

export function compileProgram(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error('Failed to create shader');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`Shader compile error: ${info}`);
    }
    return s;
  };
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  const vs = mk(gl.VERTEX_SHADER, vert);
  const fs = mk(gl.FRAGMENT_SHADER, frag);
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

/** Lazily-resolved uniform locations keyed by name. */
export class Uniforms {
  private cache = new Map<string, WebGLUniformLocation | null>();
  constructor(private gl: WebGL2RenderingContext, private prog: WebGLProgram) {}
  loc(name: string): WebGLUniformLocation | null {
    let l = this.cache.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.prog, name);
      this.cache.set(name, l);
    }
    return l;
  }
  f(name: string, v: number) { this.gl.uniform1f(this.loc(name), v); }
  i(name: string, v: number) { this.gl.uniform1i(this.loc(name), v); }
  f2(name: string, a: number, b: number) { this.gl.uniform2f(this.loc(name), a, b); }
  f3(name: string, a: number, b: number, c: number) { this.gl.uniform3f(this.loc(name), a, b, c); }
  f4(name: string, a: number, b: number, c: number, d: number) { this.gl.uniform4f(this.loc(name), a, b, c, d); }
  rgb(name: string, hex: string) { const [r, g, b] = hexToRgb(hex); this.f3(name, r, g, b); }
  tex(name: string, unit: number, tex: WebGLTexture | null, target = this.gl.TEXTURE_2D) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(target, tex);
    this.i(name, unit);
  }
}

export function hexToRgb(h: string): [number, number, number] {
  if (typeof h !== 'string' || h.length < 7) return [0, 0, 0];
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

export interface FloatSupport {
  internalFormat: number;
  type: number;
  mipmaps: boolean;
}

/** Pick the best renderable float format. RGBA16F is enough for RD. */
export function probeFloat(gl: WebGL2RenderingContext): FloatSupport {
  const ext = gl.getExtension('EXT_color_buffer_float');
  if (ext) {
    return { internalFormat: gl.RGBA16F, type: gl.HALF_FLOAT, mipmaps: true };
  }
  // Fallback — 8-bit, still works (lower fidelity, no fine gradients).
  return { internalFormat: gl.RGBA8, type: gl.UNSIGNED_BYTE, mipmaps: true };
}

export interface RenderTarget {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}

export function createTarget(
  gl: WebGL2RenderingContext,
  fmt: FloatSupport,
  width: number,
  height: number,
  opts: { linear?: boolean; mipmap?: boolean; wrap?: number } = {},
): RenderTarget {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error('Failed to create render target');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texStorage2D(
    gl.TEXTURE_2D,
    opts.mipmap ? Math.floor(Math.log2(Math.max(width, height))) + 1 : 1,
    fmt.internalFormat,
    width,
    height,
  );
  const filter = opts.linear === false ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mipmap ? gl.LINEAR_MIPMAP_LINEAR : filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  const wrap = opts.wrap ?? gl.REPEAT;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
  }
  return { tex, fbo, width, height };
}

export function deleteTarget(gl: WebGL2RenderingContext, t: RenderTarget | null) {
  if (!t) return;
  gl.deleteTexture(t.tex);
  gl.deleteFramebuffer(t.fbo);
}

/** Two float targets that swap every step. */
export class PingPong {
  read: RenderTarget;
  write: RenderTarget;
  constructor(
    private gl: WebGL2RenderingContext,
    fmt: FloatSupport,
    public width: number,
    public height: number,
    opts: { mipmap?: boolean; wrap?: number } = {},
  ) {
    this.read = createTarget(gl, fmt, width, height, opts);
    this.write = createTarget(gl, fmt, width, height, opts);
  }
  swap() { const t = this.read; this.read = this.write; this.write = t; }
  bindWrite() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.write.fbo);
    this.gl.viewport(0, 0, this.width, this.height);
  }
  dispose() { deleteTarget(this.gl, this.read); deleteTarget(this.gl, this.write); }
}

export function uploadImage(
  gl: WebGL2RenderingContext,
  img: ImageBitmap | HTMLImageElement,
): { tex: WebGLTexture; width: number; height: number } {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create texture');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
  const w = 'width' in img ? img.width : 1;
  const h = 'height' in img ? img.height : 1;
  return { tex, width: w, height: h };
}

/** Read a float target back as 0..1 floats (GL bottom-up order). */
export function readTargetFloat(
  gl: WebGL2RenderingContext,
  target: RenderTarget,
  fmt: FloatSupport,
  channel: 0 | 1 | 2 | 3,
): Float32Array {
  const { width, height } = target;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
  const out = new Float32Array(width * height);
  if (fmt.type === gl.UNSIGNED_BYTE) {
    const buf = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    for (let i = 0; i < out.length; i++) out[i] = buf[i * 4 + channel] / 255;
  } else {
    // Half-float targets read back as FLOAT on every WebGL2 impl that
    // supports EXT_color_buffer_float.
    const buf = new Float32Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buf);
    for (let i = 0; i < out.length; i++) out[i] = buf[i * 4 + channel];
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return out;
}

/** Render into an RGBA8 target of the given size and return top-down pixels. */
export function renderOffscreenRGBA8(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  draw: () => void,
): Uint8ClampedArray {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) throw new Error('Failed to create export target');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, width, height);
  draw();
  const buf = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteTexture(tex);
  gl.deleteFramebuffer(fbo);
  // Flip vertically → top-down
  const out = new Uint8ClampedArray(buf.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) {
    out.set(buf.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  }
  return out;
}

export { FullscreenQuadGL };
