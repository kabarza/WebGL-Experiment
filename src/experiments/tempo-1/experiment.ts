// ============================================================
// Tempo-1 — WebGL2 Experiment
// Layered effect: aurora gradient + ring (FBO) + dots (gl.POINTS) + lens flare + film grain
// Performance: ring gradient cached in FBO (renders once), dots as point sprites
// ============================================================

import type {
  Experiment,
  ExperimentGLContext,
  ExperimentInstance,
} from '../../core/Experiment.ts';
import { DialStore } from 'dialkit';
import { FullscreenQuadGL } from '../../core/FullscreenQuadGL.ts';
import { meta } from './meta.ts';
import { controls } from './params.ts';
import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';
import ringBaseFrag from './ring-base.frag';
import dotsVert from './dots.vert';
import dotsFrag from './dots.frag';

const MAX_FLARES = 8;
const MAX_DOTS = 300;
const GOLDEN_ANGLE = 2.399963;

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
  ];
}

function mkShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
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
}

function mkProgram(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  return prog;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

async function initGL(ctx: ExperimentGLContext): Promise<ExperimentInstance> {
  const { gl, canvas, params } = ctx;

  // ── Programs ─────────────────────────────────────────────────
  const ringBaseProg = mkProgram(gl, vertGLSL, ringBaseFrag);
  const mainProg     = mkProgram(gl, vertGLSL, fragGLSL);
  const dotsProg     = mkProgram(gl, dotsVert, dotsFrag);

  const quad = new FullscreenQuadGL(gl);

  // ── Ring-base program uniforms (RU) ──────────────────────────
  const RU: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['u_resolution', 'u_ringCenter', 'u_ringRadius', 'u_ringEdge']) {
    RU[n] = gl.getUniformLocation(ringBaseProg, n);
  }

  // ── Main program uniforms (U) ─────────────────────────────────
  const U: Record<string, WebGLUniformLocation | null> = {};
  const uniformNames = [
    'u_time', 'u_resolution',
    // Layer toggles
    'u_auroraOn', 'u_ringOn', 'u_flareOn', 'u_grainOn',
    // Aurora Gradient
    'u_auroraScale', 'u_auroraSpeed', 'u_auroraWarp',
    'u_auroraIntensity', 'u_auroraBlend',
    'u_auroraOffsetX', 'u_auroraOffsetY',
    'u_col1', 'u_col2', 'u_col3',
    // Ring (FBO texture + opacity only)
    'u_ringTex', 'u_ringOpacity',
    // Lens Flare
    'u_flareIntensity', 'u_flareSpread', 'u_flareSoftness',
    'u_flareRainbow', 'u_flareCount', 'u_flareAngle', 'u_flareGlow',
    'u_flarePos[0]', 'u_flareParamsA[0]', 'u_flareParamsB[0]',
    // Film Grain
    'u_grainAmount', 'u_grainSize', 'u_grainSpeed',
    // Post
    'u_brightness', 'u_contrast', 'u_saturation', 'u_vignette',
    'u_bgColor',
  ];
  for (const n of uniformNames) {
    U[n] = gl.getUniformLocation(mainProg, n);
  }

  // ── Dots program uniforms (DU) ────────────────────────────────
  const DU: Record<string, WebGLUniformLocation | null> = {};
  for (const n of [
    'u_resolution', 'u_ringCenter', 'u_ringRadius', 'u_ringEdge',
    'u_dotSize', 'u_dotSpeed', 'u_dotBlink', 'u_dotRotate',
    'u_dotOpacity', 'u_time',
  ]) {
    DU[n] = gl.getUniformLocation(dotsProg, n);
  }

  // ── FBO state ─────────────────────────────────────────────────
  let ringFboTex: WebGLTexture | null = null;
  let ringFbo:    WebGLFramebuffer | null = null;
  let fboW = 0;
  let fboH = 0;
  let ringFboDirty = true;
  let lastRingGeom = { x: NaN, y: NaN, radius: NaN, edge: NaN };

  function createRingFBO(w: number, h: number): void {
    if (ringFboTex) gl.deleteTexture(ringFboTex);
    if (ringFbo)    gl.deleteFramebuffer(ringFbo);
    ringFboTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ringFboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    ringFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ringFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ringFboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    fboW = w;
    fboH = h;
  }

  function checkRingDirty(P: Record<string, unknown>): boolean {
    const g = {
      x: P.ringX as number,
      y: P.ringY as number,
      radius: P.ringRadius as number,
      edge: P.ringEdge as number,
    };
    if (
      g.x !== lastRingGeom.x || g.y !== lastRingGeom.y ||
      g.radius !== lastRingGeom.radius || g.edge !== lastRingGeom.edge
    ) {
      lastRingGeom = g;
      return true;
    }
    return false;
  }

  function renderRingFBO(P: Record<string, unknown>): void {
    gl.bindFramebuffer(gl.FRAMEBUFFER, ringFbo);
    gl.viewport(0, 0, fboW, fboH);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(ringBaseProg);
    gl.uniform2f(RU.u_resolution, fboW, fboH);
    gl.uniform2f(RU.u_ringCenter, P.ringX as number, P.ringY as number);
    gl.uniform1f(RU.u_ringRadius, P.ringRadius as number);
    gl.uniform1f(RU.u_ringEdge, P.ringEdge as number);
    quad.bind(ringBaseProg);
    quad.draw();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ── Dot VBO state ─────────────────────────────────────────────
  let dotVbo:  WebGLBuffer | null = null;
  let dotVao:  WebGLVertexArrayObject | null = null;
  let activeDotCount = 0;
  let lastDotCount = -1;

  function buildDotVBO(count: number): void {
    const N = Math.min(Math.max(count, 0), MAX_DOTS);
    activeDotCount = N;
    const data = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const fi = i;
      // Deterministic per-dot hash (mirrors shader hash21 convention)
      const h0 = Math.abs(Math.sin(fi * 127.1 + 311.7)) % 1;
      const h1 = Math.abs(Math.sin(fi * 269.5 + 183.3)) % 1;
      const h2 = Math.abs(Math.sin(fi * 419.2 +  71.1)) % 1;
      const h3 = Math.abs(Math.sin(fi * 537.9 + 253.6)) % 1;
      data[i * 4 + 0] = fi * GOLDEN_ANGLE + h0 * 0.5;  // a_angle
      data[i * 4 + 1] = (h1 - 0.5) * 2.0;               // a_rOffset [-1,1]
      data[i * 4 + 2] = 0.4 + h2 * 0.6;                 // a_size    [0.4,1.0]
      data[i * 4 + 3] = h3 * 6.2832;                     // a_phase   [0,TAU]
    }

    if (!dotVbo) dotVbo = gl.createBuffer();

    if (!dotVao) {
      dotVao = gl.createVertexArray();
      gl.bindVertexArray(dotVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, dotVbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      // stride = 4 floats × 4 bytes = 16 bytes
      const attribs: Array<[string, number]> = [
        ['a_angle',   0],
        ['a_rOffset', 4],
        ['a_size',    8],
        ['a_phase',  12],
      ];
      for (const [name, byteOffset] of attribs) {
        const loc = gl.getAttribLocation(dotsProg, name);
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 16, byteOffset);
        }
      }
      gl.bindVertexArray(null);
    } else {
      // VAO already configured — just refresh the buffer data
      gl.bindBuffer(gl.ARRAY_BUFFER, dotVbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
  }

  // ── Flare data arrays ─────────────────────────────────────────
  const flarePosData     = new Float32Array(MAX_FLARES * 2);
  const flareParamsAData = new Float32Array(MAX_FLARES * 4);
  const flareParamsBData = new Float32Array(MAX_FLARES * 3);

  // ── DialKit panel helpers ─────────────────────────────────────
  let panelIdCache: string | null | undefined;
  const getPanelId = (): string | null => {
    if (panelIdCache !== undefined) return panelIdCache;
    const panel = DialStore.getPanels().find((p) => p.name === meta.title);
    panelIdCache = panel?.id ?? null;
    return panelIdCache;
  };

  const updateDialValue = (path: string, value: unknown) => {
    const panelId = getPanelId();
    if (!panelId) return;
    DialStore.updateValue(
      panelId,
      path,
      value as import('dialkit').DialValue,
    );
  };

  let lastActionTs = 0;
  const handleActions = () => {
    const ts = asNumber(params._actionTs, 0);
    if (ts === lastActionTs) return;
    lastActionTs = ts;

    const action = String(params._action ?? '');
    const currentCount = Math.max(
      1,
      Math.min(MAX_FLARES, Math.round(asNumber(params.flareCount, 2))),
    );

    if (action === 'Lens Flare.Add Flare' && currentCount < MAX_FLARES) {
      const nextCount = currentCount + 1;
      params.flareCount = nextCount;
      params[`flare${nextCount}On`] = true;
      updateDialValue('Lens Flare.flareCount', nextCount);
      updateDialValue(`Flare ${nextCount}.flare${nextCount}On`, true);
    } else if (action === 'Lens Flare.Remove Flare' && currentCount > 1) {
      params[`flare${currentCount}On`] = false;
      const nextCount = currentCount - 1;
      params.flareCount = nextCount;
      updateDialValue(`Flare ${currentCount}.flare${currentCount}On`, false);
      updateDialValue('Lens Flare.flareCount', nextCount);
    }
  };

  // ── Initial setup ─────────────────────────────────────────────
  createRingFBO(canvas.width, canvas.height);
  const initDotCount = asNumber(params.dotCount, 120);
  buildDotVBO(initDotCount);
  lastDotCount = initDotCount;

  return {
    render(time: number, _deltaTime: number) {
      const P = params;
      handleActions();

      // ── Dirty checks ─────────────────────────────────────────
      if (checkRingDirty(P)) ringFboDirty = true;

      const newDotCount = asNumber(P.dotCount, 120);
      if (newDotCount !== lastDotCount) {
        buildDotVBO(newDotCount);
        lastDotCount = newDotCount;
      }

      const ringOn = asBool(P.ringOn, true);

      // ── Pass A: Ring FBO (conditional) ───────────────────────
      if (ringOn && ringFboDirty) {
        renderRingFBO(P);
        ringFboDirty = false;
      }

      // ── Pass B: Main fullscreen quad ──────────────────────────
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(mainProg);

      gl.uniform1f(U.u_time, time);
      gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

      // Layer toggles
      gl.uniform1f(U.u_auroraOn, P.auroraOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_ringOn, ringOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_flareOn, P.flareOn ? 1.0 : 0.0);
      gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);

      // Aurora Gradient
      gl.uniform1f(U.u_auroraScale, P.auroraScale as number);
      gl.uniform1f(U.u_auroraSpeed, P.auroraSpeed as number);
      gl.uniform1f(U.u_auroraWarp, P.auroraWarp as number);
      gl.uniform1f(U.u_auroraIntensity, P.auroraIntensity as number);
      gl.uniform1f(U.u_auroraBlend, P.auroraBlend as number);
      gl.uniform1f(U.u_auroraOffsetX, P.auroraOffsetX as number);
      gl.uniform1f(U.u_auroraOffsetY, P.auroraOffsetY as number);

      const c1 = hex2rgb(P.color1 as string);
      const c2 = hex2rgb(P.color2 as string);
      const c3 = hex2rgb(P.color3 as string);
      gl.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);
      gl.uniform3f(U.u_col2, c2[0], c2[1], c2[2]);
      gl.uniform3f(U.u_col3, c3[0], c3[1], c3[2]);

      // Ring (FBO texture + opacity)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ringFboTex);
      gl.uniform1i(U['u_ringTex'], 0);
      gl.uniform1f(U.u_ringOpacity, P.ringOpacity as number);

      // Lens Flare
      gl.uniform1f(U.u_flareIntensity, P.flareIntensity as number);
      gl.uniform1f(U.u_flareSpread, P.flareSpread as number);
      gl.uniform1f(U.u_flareSoftness, P.flareSoftness as number);
      gl.uniform1f(U.u_flareRainbow, P.flareRainbow as number);
      gl.uniform1f(
        U.u_flareCount,
        Math.max(1, Math.min(MAX_FLARES, Math.round(asNumber(P.flareCount, 2)))),
      );
      gl.uniform1f(U.u_flareAngle, P.flareAngle as number);
      gl.uniform1f(U.u_flareGlow, P.flareGlow as number);
      for (let i = 0; i < MAX_FLARES; i += 1) {
        const idx = i + 1;
        const o2 = i * 2;
        const o4 = i * 4;
        const o3 = i * 3;
        flarePosData[o2]         = asNumber(P[`flare${idx}X`], 0.66);
        flarePosData[o2 + 1]     = asNumber(P[`flare${idx}Y`], 0.55);
        flareParamsAData[o4]     = asNumber(P[`flare${idx}Intensity`], 1.0);
        flareParamsAData[o4 + 1] = asNumber(P[`flare${idx}Spread`], 1.0);
        flareParamsAData[o4 + 2] = asNumber(P[`flare${idx}Softness`], 1.0);
        flareParamsAData[o4 + 3] = asNumber(P[`flare${idx}Rainbow`], 1.0);
        flareParamsBData[o3]     = asNumber(P[`flare${idx}Glow`], 1.0);
        flareParamsBData[o3 + 1] = asNumber(P[`flare${idx}Angle`], 1.42);
        flareParamsBData[o3 + 2] = asBool(P[`flare${idx}On`], idx <= 2) ? 1.0 : 0.0;
      }
      gl.uniform2fv(U['u_flarePos[0]'], flarePosData);
      gl.uniform4fv(U['u_flareParamsA[0]'], flareParamsAData);
      gl.uniform3fv(U['u_flareParamsB[0]'], flareParamsBData);

      // Film Grain
      gl.uniform1f(U.u_grainAmount, P.grainAmount as number);
      gl.uniform1f(U.u_grainSize, P.grainSize as number);
      gl.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

      // Post Processing
      gl.uniform1f(U.u_brightness, P.brightness as number);
      gl.uniform1f(U.u_contrast, P.contrast as number);
      gl.uniform1f(U.u_saturation, P.saturation as number);
      gl.uniform1f(U.u_vignette, P.vignette as number);
      const bg = hex2rgb(P.bgColor as string);
      gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

      quad.bind(mainProg);
      quad.draw();

      // ── Pass C: Dot sprites (gl.POINTS, additive blend) ──────
      if (ringOn && activeDotCount > 0) {
        gl.useProgram(dotsProg);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);  // additive — star-over-dark look

        gl.uniform2f(DU.u_resolution, canvas.width, canvas.height);
        gl.uniform2f(DU.u_ringCenter, P.ringX as number, P.ringY as number);
        gl.uniform1f(DU.u_ringRadius, P.ringRadius as number);
        gl.uniform1f(DU.u_ringEdge, P.ringEdge as number);
        gl.uniform1f(DU.u_dotSize, asNumber(P.dotSize, 4.0));
        gl.uniform1f(DU.u_dotSpeed, asNumber(P.dotSpeed, 0.24));
        gl.uniform1f(DU.u_dotBlink, asBool(P.dotBlink, true) ? 1.0 : 0.0);
        gl.uniform1f(DU.u_dotRotate, asBool(P.dotRotate, false) ? 1.0 : 0.0);
        gl.uniform1f(DU.u_dotOpacity, P.ringOpacity as number);
        gl.uniform1f(DU.u_time, time);

        gl.bindVertexArray(dotVao);
        gl.drawArrays(gl.POINTS, 0, activeDotCount);
        gl.bindVertexArray(null);

        gl.disable(gl.BLEND);
      }
    },

    resize(_w: number, _h: number, _dpr: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      createRingFBO(canvas.width, canvas.height);
      ringFboDirty = true;
    },

    dispose() {
      gl.deleteProgram(mainProg);
      gl.deleteProgram(ringBaseProg);
      gl.deleteProgram(dotsProg);
      if (ringFboTex) gl.deleteTexture(ringFboTex);
      if (ringFbo)    gl.deleteFramebuffer(ringFbo);
      if (dotVbo)     gl.deleteBuffer(dotVbo);
      if (dotVao)     gl.deleteVertexArray(dotVao);
      quad.dispose();
    },
  };
}

export const tempo1Experiment: Experiment = {
  meta,
  controls,
  initGL: initGL,
};
