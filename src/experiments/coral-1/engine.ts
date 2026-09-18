// ============================================================
// Coral-1 engine — Gray-Scott reaction-diffusion on a ping-pong
// half-float texture, with spatially varying feed/kill maps,
// anisotropic diffusion and image-driven seeding / density.
// ============================================================

import { PatternEngineBase, imageModeIndex } from '../../brand/PatternEngineBase.ts';
import { compileProgram, Uniforms } from '../../brand/gl.ts';
import type { BrandEngineContext, SeedMode } from '../../brand/types.ts';
import quadVert from '../../brand/shaders/quad.vert';
import simFrag from './sim.frag';
import seedFrag from './seed.frag';

export const MAP_MODES = ['None', 'Radial', 'Rotate', 'Swirl', 'Bubble', 'Ring', 'Sweep', 'Noise'] as const;
const SEED_INDEX: Record<SeedMode, number> = { center: 0, random: 1, image: 2, clear: 3, noise: 4 };

export class GrayScottEngine extends PatternEngineBase {
  protected fieldChannel: [number, number, number, number] = [0, 1, 0, 0];
  protected fieldRange: [number, number] = [0.0, 0.6];
  protected needsMipmaps = false;

  private simProg!: WebGLProgram;
  private simU!: Uniforms;
  private seedProg!: WebGLProgram;
  private seedU!: Uniforms;
  private seedCounter = 0;

  constructor(ctx: BrandEngineContext) {
    super(ctx);
    this.createPrograms();
  }

  protected createPrograms(): void {
    if (this.simProg) return;
    this.simProg = compileProgram(this.gl, quadVert, simFrag);
    this.simU = new Uniforms(this.gl, this.simProg);
    this.seedProg = compileProgram(this.gl, quadVert, seedFrag);
    this.seedU = new Uniforms(this.gl, this.seedProg);
  }

  protected stepsPerFrame(): number {
    return Math.max(1, Math.round((this.params.stepsPerFrame as number) ?? 10));
  }

  protected seed(mode: SeedMode): void {
    const gl = this.gl;
    const u = this.seedU;
    this.state.bindWrite();
    gl.useProgram(this.seedProg);
    u.f('u_mode', SEED_INDEX[mode] ?? 0);
    u.f('u_seed', (this.seedCounter++ * 17.13) % 100);
    u.f2('u_simSize', this.simW, this.simH);
    this.bindImage(u, 1);
    u.f('u_imageInfluence', (this.params.imageInfluence as number) ?? 0.6);
    this.quad.bind(this.seedProg);
    this.quad.draw();
    this.state.swap();
  }

  protected step(_dt: number): void {
    const gl = this.gl;
    const P = this.params;
    const u = this.simU;
    this.state.bindWrite();
    gl.useProgram(this.simProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.state.read.tex);
    u.i('u_state', 0);
    u.f2('u_texel', 1 / this.simW, 1 / this.simH);
    u.f2('u_simSize', this.simW, this.simH);
    u.f('u_time', this.time);

    u.f('u_feed', (P.feed as number) ?? 0.055);
    u.f('u_kill', (P.kill as number) ?? 0.062);
    u.f('u_dU', (P.dU as number) ?? 1.0);
    u.f('u_dV', (P.dV as number) ?? 0.5);
    u.f('u_dt', (P.dt as number) ?? 1.0);
    u.f('u_scale', 1.0);

    u.f('u_mapMode', Math.max(0, MAP_MODES.indexOf(P.mapMode as typeof MAP_MODES[number])));
    u.f('u_mapFeed', (P.mapFeed as number) ?? 0);
    u.f('u_mapKill', (P.mapKill as number) ?? 0);
    u.f('u_mapScale', (P.mapScale as number) ?? 1);
    u.f('u_mapAngle', ((P.mapAngle as number) ?? 0) * Math.PI / 180);
    u.f('u_mapDrift', (P.mapDrift as number) ?? 0);

    u.f('u_anisotropy', (P.anisotropy as number) ?? 0);
    u.f('u_flowAngle', ((P.flowAngle as number) ?? 0) * Math.PI / 180);

    this.bindImage(u, 1);
    u.f('u_imageMode', imageModeIndex(P.imageMode));
    u.f('u_imageInfluence', (P.imageInfluence as number) ?? 0.6);

    const p = this.pointer;
    const brushActive = this.brushEnabled && !!P.brushOn && p.down && p.over;
    u.f2('u_pointer', p.x, p.y);
    u.f('u_brush', brushActive ? ((P.brushMode === 'Erase') !== this.brushErase ? -1 : 1) : 0);
    u.f('u_brushRadius', (P.brushRadius as number) ?? 0.04);

    this.quad.bind(this.simProg);
    this.quad.draw();
    this.state.swap();
  }

  dispose(): void {
    super.dispose();
    this.gl.deleteProgram(this.simProg);
    this.gl.deleteProgram(this.seedProg);
  }
}
