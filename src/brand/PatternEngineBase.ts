// ============================================================
// PatternEngineBase — everything a reaction-diffusion style brand
// engine shares: simulation sizing, source image texture, pointer
// brush, the display pass, field readback and offscreen export.
// Subclasses implement the actual simulation step + seeding.
// ============================================================

import type { BrandEngine, BrandEngineContext, FieldReadback, SeedMode } from './types.ts';
import {
  compileProgram,
  Uniforms,
  probeFloat,
  PingPong,
  uploadImage,
  readTargetFloat,
  renderOffscreenRGBA8,
  FullscreenQuadGL,
  type FloatSupport,
} from './gl.ts';
import quadVert from './shaders/quad.vert';
import displayFrag from './shaders/display.frag';

export interface PointerState {
  x: number; // 0..1, left → right
  y: number; // 0..1, bottom → top
  px: number;
  py: number;
  down: boolean;
  over: boolean;
}

const RENDER_MODES = ['Flat', 'Outline', 'Emboss', 'Gradient', 'Dots'] as const;
const IMAGE_FILL = ['Through pattern', 'Tint pattern', 'Behind pattern'] as const;
export const QUALITY = [
  { label: 'Draft', factor: 0.25 },
  { label: 'Standard', factor: 0.5 },
  { label: 'Fine', factor: 1 },
  { label: 'Ultra', factor: 2 },
] as const;

export abstract class PatternEngineBase implements BrandEngine {
  protected gl: WebGL2RenderingContext;
  protected canvas: HTMLCanvasElement;
  protected params: Record<string, unknown>;
  protected logicalSize: (() => { width: number; height: number }) | null;
  protected fmt: FloatSupport;
  protected quad: FullscreenQuadGL;
  protected state!: PingPong;
  protected simW = 0;
  protected simH = 0;

  protected displayProg: WebGLProgram;
  protected displayU: Uniforms;

  protected image: { tex: WebGLTexture; width: number; height: number } | null = null;
  protected pointer: PointerState = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, down: false, over: false };
  protected pendingSeed: SeedMode | null = 'center';
  protected time = 0;

  private listeners: Array<[string, EventListener]> = [];
  private frameCount = 0;
  private lastExtinctTs = 0;
  /** Fired when the pattern has died out (all V ≈ 0). */
  onExtinct: ((regrown: boolean) => void) | null = null;

  /** Which channel of the state texture holds the displayable field. */
  protected abstract fieldChannel: [number, number, number, number];
  /** Field value range mapped to 0..1 for display. */
  protected abstract fieldRange: [number, number];
  /** Whether the state texture needs mip levels (multi-scale engines). */
  protected abstract needsMipmaps: boolean;

  constructor(ctx: BrandEngineContext) {
    this.gl = ctx.gl;
    this.canvas = ctx.canvas;
    this.params = ctx.params;
    this.logicalSize = ctx.logicalSize ?? null;
    this.fmt = probeFloat(this.gl);
    this.quad = new FullscreenQuadGL(this.gl);
    this.displayProg = compileProgram(this.gl, quadVert, displayFrag);
    this.displayU = new Uniforms(this.gl, this.displayProg);
    this.attachPointer();
  }

  // ── Subclass hooks ───────────────────────────────────────────
  protected abstract createPrograms(): void;
  /** Run one simulation step: read `state.read`, write `state.write`, swap. */
  protected abstract step(dt: number): void;
  /** Write the seed state into `state.write` then swap. */
  protected abstract seed(mode: SeedMode): void;
  /** Steps per frame — subclasses read their own param. */
  protected abstract stepsPerFrame(): number;

  // ── Sizing ───────────────────────────────────────────────────
  /** Sim texels per canvas pixel: quality ÷ pattern scale. */
  protected qualityFactor(): number {
    const q = this.params.quality as string | undefined;
    const quality = QUALITY.find((x) => x.label === q)?.factor ?? 0.5;
    const scale = Math.max(0.25, (this.params.patternScale as number) ?? 1);
    return quality / scale;
  }

  private lastFactor = 0;

  protected ensureSim(): void {
    const f = this.qualityFactor();
    const cap = 2048;
    const base = this.logicalSize?.() ?? { width: this.canvas.width, height: this.canvas.height };
    let w = Math.round(base.width * f);
    let h = Math.round(base.height * f);
    const m = Math.max(w, h);
    if (m > cap) { w = Math.round(w * cap / m); h = Math.round(h * cap / m); }
    w = Math.max(24, w);
    h = Math.max(24, h);
    if (this.state && w === this.simW && h === this.simH) return;
    const old = this.state;
    const oldW = this.simW;
    const oldH = this.simH;
    this.simW = w;
    this.simH = h;
    this.state = new PingPong(this.gl, this.fmt, w, h, { mipmap: this.needsMipmaps });
    if (old) {
      // Same texel density (canvas shape changed) → keep the pattern at its
      // size: crop / pad around the centre. Different density (pattern scale
      // or quality changed) → stretch, which is exactly the rescale wanted.
      const preserve = Math.abs(f - this.lastFactor) < 1e-6;
      this.blit(old.read.tex, this.state.write, preserve ? [w / oldW, h / oldH] : [1, 1]);
      this.state.swap();
      old.dispose();
    } else {
      this.pendingSeed = this.pendingSeed ?? 'center';
    }
    this.lastFactor = f;
  }

  private copyProg: WebGLProgram | null = null;
  /** Copy src into dst; `scale` > 1 pads (empty field), < 1 crops. */
  protected blit(
    src: WebGLTexture,
    dst: { fbo: WebGLFramebuffer; width: number; height: number },
    scale: [number, number] = [1, 1],
  ): void {
    const gl = this.gl;
    if (!this.copyProg) {
      this.copyProg = compileProgram(gl, quadVert, `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D u_src; uniform vec2 u_scale; uniform vec4 u_empty;
void main(){
  vec2 uv = (vUv - 0.5) * u_scale + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { o = u_empty; return; }
  o = texture(u_src, uv);
}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
    gl.viewport(0, 0, dst.width, dst.height);
    gl.useProgram(this.copyProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src);
    gl.uniform1i(gl.getUniformLocation(this.copyProg, 'u_src'), 0);
    gl.uniform2f(gl.getUniformLocation(this.copyProg, 'u_scale'), scale[0], scale[1]);
    const e = this.emptyState;
    gl.uniform4f(gl.getUniformLocation(this.copyProg, 'u_empty'), e[0], e[1], e[2], e[3]);
    this.quad.bind(this.copyProg);
    this.quad.draw();
  }

  /** Texel value of an empty (no pattern) cell — used when padding. */
  protected emptyState: [number, number, number, number] = [1, 0, 0, 1];

  /** Painting only happens when the host says the brush tool is active. */
  brushEnabled = true;
  /** Host-driven erase (e.g. alt-drag) regardless of the brushMode param. */
  brushErase = false;

  resize(_w: number, _h: number): void {
    if (this.state) this.ensureSim();
  }

  // ── Pointer brush ────────────────────────────────────────────
  private attachPointer(): void {
    const c = this.canvas;
    const p = this.pointer;
    const toUv = (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      p.px = p.x; p.py = p.y;
      p.x = (e.clientX - r.left) / Math.max(r.width, 1);
      p.y = 1 - (e.clientY - r.top) / Math.max(r.height, 1);
    };
    const on = (type: string, fn: EventListener) => {
      c.addEventListener(type, fn);
      this.listeners.push([type, fn]);
    };
    on('pointermove', ((e: PointerEvent) => { toUv(e); p.over = true; }) as EventListener);
    on('pointerdown', ((e: PointerEvent) => { toUv(e); p.px = p.x; p.py = p.y; p.down = true; c.setPointerCapture?.(e.pointerId); }) as EventListener);
    on('pointerup', (() => { p.down = false; }) as EventListener);
    on('pointercancel', (() => { p.down = false; }) as EventListener);
    on('pointerleave', (() => { p.over = false; p.down = false; }) as EventListener);
    on('touchmove', ((e: Event) => { e.preventDefault(); }) as EventListener);
  }

  // ── Image ────────────────────────────────────────────────────
  setImage(img: ImageBitmap | HTMLImageElement | null): void {
    const gl = this.gl;
    if (this.image) { gl.deleteTexture(this.image.tex); this.image = null; }
    if (img) this.image = uploadImage(gl, img);
  }

  protected bindImage(u: Uniforms, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.image?.tex ?? null);
    u.i('u_image', unit);
    u.f('u_hasImage', this.image ? 1 : 0);
    u.f2('u_imageSize', this.image?.width ?? 1, this.image?.height ?? 1);
    const inv = this.params.imageInvert ? 1 : 0;
    u.f('u_imageInvert', inv);
  }

  reseed(mode: SeedMode = 'center'): void {
    this.pendingSeed = mode;
  }

  // ── Frame ────────────────────────────────────────────────────
  frame(time: number, dt: number): void {
    const gl = this.gl;
    this.time = time;
    if (!this.state) this.createPrograms();
    this.ensureSim();

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    if (this.pendingSeed) {
      this.seed(this.pendingSeed);
      this.pendingSeed = null;
    }

    // A reset (from either params bridge) → fresh growth with the defaults
    const resetTs = (this.params._resetTs as number) ?? 0;
    if (resetTs && resetTs !== this.lastResetTs) {
      this.lastResetTs = resetTs;
      this.reseed('center');
    }

    // Transient actions forwarded from the params bridge
    const action = this.params._action as string | undefined;
    const ts = (this.params._actionTs as number) ?? 0;
    if (action && ts !== this.lastActionTs) {
      this.lastActionTs = ts;
      this.handleAction(action);
    }

    const paused = !!this.params.paused;
    if (!paused) {
      const n = this.stepsPerFrame();
      for (let i = 0; i < n; i++) this.step(dt);
      // Once a second, check whether the pattern has died out. Gray-Scott
      // cannot regrow from an empty field, so offer / perform a reseed.
      if (++this.frameCount % 60 === 0 && time - this.lastExtinctTs > 2.5) {
        if (this.isExtinct()) {
          this.lastExtinctTs = time;
          const auto = this.params.autoRegrow !== false;
          if (auto) this.reseed(this.image && this.params.imageMode !== 'Off' ? 'image' : 'center');
          this.onExtinct?.(auto);
        }
      }
    }

    // Display to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.drawDisplay(this.canvas.width, this.canvas.height, false);
    this.pointer.px = this.pointer.x;
    this.pointer.py = this.pointer.y;
  }

  private lastActionTs = 0;
  private lastResetTs = 0;
  protected handleAction(action: string): void {
    const leaf = action.split('.').pop() ?? action;
    if (/Reseed|Regrow/i.test(leaf)) this.reseed(this.image && this.params.imageMode !== 'Off' ? 'image' : 'center');
    else if (/Random/i.test(leaf)) this.reseed('random');
    else if (/Noise/i.test(leaf)) this.reseed('noise');
    else if (/Clear/i.test(leaf)) this.reseed('clear');
    else if (/Upload Image/i.test(leaf)) this.pickImage();
    else if (/Remove Image/i.test(leaf)) { this.setImage(null); this.params.imageMode = 'Off'; }
  }

  /** Gallery path: open a file picker and load the image into the engine. */
  protected pickImage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const bmp = await createImageBitmap(file);
        this.setImage(bmp);
        if (this.params.imageMode === 'Off') this.params.imageMode = 'Mask';
        this.reseed('image');
      } catch { /* unsupported file */ }
    };
    input.click();
  }

  protected drawDisplay(width: number, height: number, transparent: boolean): void {
    const gl = this.gl;
    const P = this.params;
    const u = this.displayU;
    gl.useProgram(this.displayProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.state.read.tex);
    u.i('u_field', 0);
    const [cr, cg, cb, ca] = this.fieldChannel;
    u.f4('u_channel', cr, cg, cb, ca);
    u.f2('u_fieldRange', this.fieldRange[0], this.fieldRange[1]);
    u.f2('u_texel', 1 / this.simW, 1 / this.simH);
    u.f2('u_resolution', width, height);

    this.bindImage(u, 1);
    u.f('u_imageFill', Math.max(0, IMAGE_FILL.indexOf(P.imageFill as typeof IMAGE_FILL[number])));
    u.f('u_imageBlend', (P.imageBlend as number) ?? 0);

    u.f('u_renderMode', Math.max(0, RENDER_MODES.indexOf(P.renderMode as typeof RENDER_MODES[number])));
    u.f('u_threshold', (P.threshold as number) ?? 0.5);
    u.f('u_softness', (P.softness as number) ?? 0.05);
    u.f('u_lineWidth', (P.lineWidth as number) ?? 0.05);
    u.f('u_embossHeight', (P.embossHeight as number) ?? 0.5);
    u.f('u_lightAngle', ((P.lightAngle as number) ?? 45) * Math.PI / 180);
    u.f('u_dotScale', (P.dotScale as number) ?? 8);
    u.f('u_invert', P.invert ? 1 : 0);
    u.f('u_transparent', transparent ? 1 : 0);
    u.f('u_grain', (P.grain as number) ?? 0);
    u.f('u_vignette', (P.vignette as number) ?? 0);
    u.rgb('u_bgColor', P.bgColor as string);
    u.rgb('u_fgColor', P.fgColor as string);
    u.rgb('u_accentColor', (P.accentColor as string) ?? (P.fgColor as string));
    u.f('u_accentMix', (P.accentMix as number) ?? 0);

    this.quad.bind(this.displayProg);
    this.quad.draw();
  }

  /** Cheap extinction test: max of the field over a coarse sample grid. */
  protected isExtinct(): boolean {
    const gl = this.gl;
    const { width, height } = this.state.read;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.state.read.fbo);
    const ch = Math.max(0, this.fieldChannel.indexOf(1));
    const isByte = this.fmt.type === gl.UNSIGNED_BYTE;
    const cols = 24, rows = 14;
    const buf = isByte ? new Uint8Array(4) : new Float32Array(4);
    let max = 0;
    for (let j = 0; j < rows; j++) {
      const y = Math.floor(((j + 0.5) / rows) * height);
      for (let i = 0; i < cols; i++) {
        const x = Math.floor(((i + 0.5) / cols) * width);
        gl.readPixels(x, y, 1, 1, gl.RGBA, isByte ? gl.UNSIGNED_BYTE : gl.FLOAT, buf);
        const v = isByte ? buf[ch] / 255 : buf[ch];
        if (v > max) max = v;
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const [lo, hi] = this.fieldRange;
    return (max - lo) / Math.max(hi - lo, 1e-5) < 0.03;
  }

  // ── Export hooks ─────────────────────────────────────────────
  readField(): FieldReadback {
    const ch = this.fieldChannel.indexOf(1) as 0 | 1 | 2 | 3;
    const raw = readTargetFloat(this.gl, this.state.read, this.fmt, ch < 0 ? 0 : ch);
    const [lo, hi] = this.fieldRange;
    const inv = 1 / Math.max(hi - lo, 1e-5);
    for (let i = 0; i < raw.length; i++) raw[i] = Math.min(1, Math.max(0, (raw[i] - lo) * inv));
    return { width: this.simW, height: this.simH, data: raw };
  }

  renderToPixels(width: number, height: number, opts: { transparent?: boolean } = {}): Uint8ClampedArray {
    const gl = this.gl;
    const px = renderOffscreenRGBA8(gl, width, height, () => {
      gl.disable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.drawDisplay(width, height, !!opts.transparent);
    });
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return px;
  }

  dispose(): void {
    const gl = this.gl;
    for (const [t, fn] of this.listeners) this.canvas.removeEventListener(t, fn);
    this.listeners = [];
    this.state?.dispose();
    if (this.image) gl.deleteTexture(this.image.tex);
    gl.deleteProgram(this.displayProg);
    if (this.copyProg) gl.deleteProgram(this.copyProg);
    this.quad.dispose();
  }
}

/** Shared render / colour / image control folders for both tools. */
export const sharedRenderDefaults = {
  renderMode: 'Flat',
  threshold: 0.5,
  softness: 0.06,
  lineWidth: 0.08,
  embossHeight: 0.6,
  lightAngle: 135,
  dotScale: 10,
  invert: false,
  grain: 0,
  vignette: 0,
  bgColor: '#0b0b0d',
  fgColor: '#f2efe8',
  accentColor: '#c8a2ff',
  accentMix: 0,
  imageMode: 'Off',
  imageInfluence: 0.6,
  imageInvert: false,
  imageFill: 'Through pattern',
  imageBlend: 0,
  brushOn: true,
  brushRadius: 0.04,
  brushMode: 'Add',
  theme: 'Custom',
  quality: 'Standard',
  patternScale: 1,
  autoRegrow: true,
  paused: false,
};

export const sharedRenderConfig = {
  Render: {
    renderMode: { type: 'select', options: [...RENDER_MODES], default: 'Flat' },
    threshold: [0.5, 0.05, 0.95, 0.001],
    softness: [0.06, 0.001, 0.4, 0.001],
    lineWidth: [0.08, 0.005, 0.4, 0.001],
    embossHeight: [0.6, 0, 2, 0.01],
    lightAngle: [135, 0, 360, 1],
    dotScale: [10, 3, 40, 0.5],
    invert: false,
    grain: [0, 0, 1, 0.01],
    vignette: [0, 0, 1, 0.01],
  },
  Colour: {
    theme: { type: 'select', options: ['Custom'], default: 'Custom' },
    bgColor: '#0b0b0d',
    fgColor: '#f2efe8',
    accentColor: '#c8a2ff',
    accentMix: [0, 0, 1, 0.01],
  },
  Image: {
    'Upload Image': { type: 'action' },
    'Remove Image': { type: 'action' },
    imageMode: { type: 'select', options: ['Off', 'Seed', 'Density map', 'Mask', 'Seed + Density'], default: 'Off' },
    imageInfluence: [0.6, 0, 1, 0.01],
    imageInvert: false,
    imageFill: { type: 'select', options: [...IMAGE_FILL], default: 'Through pattern' },
    imageBlend: [0, 0, 1, 0.01],
  },
  Brush: {
    brushOn: true,
    brushRadius: [0.04, 0.005, 0.25, 0.001],
    brushMode: { type: 'select', options: ['Add', 'Erase'], default: 'Add' },
  },
  Engine: {
    quality: { type: 'select', options: ['Draft', 'Standard', 'Fine', 'Ultra'], default: 'Standard' },
    patternScale: [1, 0.5, 16, 0.05],
    autoRegrow: true,
    paused: false,
    Reseed: { type: 'action' },
    'Random Spots': { type: 'action' },
    Clear: { type: 'action' },
    'Reset All': { type: 'action' },
  },
};

export const sharedVisibility = {
  lineWidth: { when: 'renderMode', is: 'Outline' },
  embossHeight: { when: 'renderMode', is: 'Emboss' },
  lightAngle: { when: 'renderMode', is: 'Emboss' },
  dotScale: { when: 'renderMode', is: 'Dots' },
} as const;

export const IMAGE_MODES = ['Off', 'Seed', 'Density map', 'Mask', 'Seed + Density'] as const;
export function imageModeIndex(v: unknown): number {
  const i = IMAGE_MODES.indexOf(v as typeof IMAGE_MODES[number]);
  return i < 0 ? 0 : i;
}
