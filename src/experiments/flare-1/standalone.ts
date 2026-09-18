// ============================================================
// Flare-1 — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// Three-pass: ring FBO (cached) + main quad + dot sprites
// ============================================================

import fragGLSL     from './shader.glsl';
import vertGLSL     from '../../shaders/glsl/fullscreen-quad.vert';
import ringBaseFrag from './ring-base.frag';
import dotsVert     from './dots.vert';
import dotsFrag     from './dots.frag';

declare const __BAKED_PARAMS__: Record<string, unknown>;
const MAX_FLARES = 8;
const MAX_DOTS   = 300;
const GOLDEN_ANGLE = 2.399963;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#16171c',
        auroraOn: true,
        auroraScale: 1.05,
        auroraSpeed: 0.04,
        auroraWarp: 1.6,
        auroraIntensity: 0.62,
        auroraBlend: 0.66,
        auroraOffsetX: 0.0,
        auroraOffsetY: 0.0,
        color1: '#8a5b72',
        color2: '#3f3358',
        color3: '#553325',
        ringOn: true,
        ringX: 0.11,
        ringY: 0.74,
        ringRadius: 0.34,
        ringEdge: 1.15,
        ringOpacity: 0.46,
        dotCount: 120,
        dotSize: 4.0,
        dotBlink: true,
        dotRotate: false,
        dotSpeed: 0.24,
        flareOn: true,
        flareIntensity: 0.12,
        flareSpread: 0.62,
        flareSoftness: 2.8,
        flareRainbow: 0.38,
        flareCount: 2,
        flareAngle: 1.42,
        flareGlow: 0.26,
        flare1On: true,
        flare1X: 0.66,
        flare1Y: 0.52,
        flare1Angle: 1.48,
        flare1Intensity: 1.0,
        flare1Spread: 1.0,
        flare1Softness: 1.0,
        flare1Rainbow: 1.0,
        flare1Glow: 1.0,
        flare2On: true,
        flare2X: 0.6,
        flare2Y: 0.7,
        flare2Angle: 1.62,
        flare2Intensity: 0.72,
        flare2Spread: 0.85,
        flare2Softness: 1.2,
        flare2Rainbow: 0.9,
        flare2Glow: 0.8,
        flare3On: false,
        flare3X: 0.74,
        flare3Y: 0.58,
        flare3Angle: 1.36,
        flare3Intensity: 0.55,
        flare3Spread: 0.9,
        flare3Softness: 1.1,
        flare3Rainbow: 1.1,
        flare3Glow: 0.55,
        flare4On: false,
        flare4X: 0.68,
        flare4Y: 0.44,
        flare4Angle: 1.72,
        flare4Intensity: 0.5,
        flare4Spread: 1.1,
        flare4Softness: 0.9,
        flare4Rainbow: 0.75,
        flare4Glow: 0.5,
        flare5On: false,
        flare5X: 0.79,
        flare5Y: 0.66,
        flare5Angle: 1.28,
        flare5Intensity: 0.44,
        flare5Spread: 0.76,
        flare5Softness: 1.25,
        flare5Rainbow: 1.2,
        flare5Glow: 0.4,
        flare6On: false,
        flare6X: 0.58,
        flare6Y: 0.56,
        flare6Angle: 1.82,
        flare6Intensity: 0.4,
        flare6Spread: 1.35,
        flare6Softness: 1.0,
        flare6Rainbow: 0.65,
        flare6Glow: 0.4,
        flare7On: false,
        flare7X: 0.72,
        flare7Y: 0.78,
        flare7Angle: 1.5,
        flare7Intensity: 0.34,
        flare7Spread: 0.72,
        flare7Softness: 1.35,
        flare7Rainbow: 1.3,
        flare7Glow: 0.34,
        flare8On: false,
        flare8X: 0.84,
        flare8Y: 0.5,
        flare8Angle: 1.22,
        flare8Intensity: 0.28,
        flare8Spread: 0.9,
        flare8Softness: 1.55,
        flare8Rainbow: 0.8,
        flare8Glow: 0.3,
        grainOn: true,
        grainAmount: 0.028,
        grainSize: 1.7,
        grainSpeed: 24,
        brightness: 0.96,
        contrast: 1.18,
        saturation: 0.9,
        vignette: 0.42,
        speed: 1.0,
      };

function hex2rgb(h: string): [number, number, number] {
  if (h.charAt(0) === '#') h = h.slice(1);
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function mkShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
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

function mkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const prog = gl.createProgram()!;
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

(function () {
  const wrapper = document.querySelector('[data-webgl-experiment="flare-1"]');
  if (!wrapper) return;
  const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const _gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!_gl) { console.error('WebGL2 not available'); return; }
  // Re-assign so TypeScript knows gl is non-null in all closures below
  const gl: WebGL2RenderingContext = _gl;

  // ── Programs ──────────────────────────────────────────────────
  const ringBaseProg = mkProgram(gl, vertGLSL, ringBaseFrag);
  const mainProg     = mkProgram(gl, vertGLSL, fragGLSL);
  const dotsProg     = mkProgram(gl, dotsVert, dotsFrag);

  // ── Fullscreen quad (shared by ring-base and main passes) ─────
  const quadVao = gl.createVertexArray()!;
  gl.bindVertexArray(quadVao);
  const quadBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  function bindQuad(prog: WebGLProgram): void {
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  // ── Ring-base uniforms ────────────────────────────────────────
  const RU: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['u_resolution', 'u_ringCenter', 'u_ringRadius', 'u_ringEdge']) {
    RU[n] = gl.getUniformLocation(ringBaseProg, n);
  }

  // ── Main program uniforms ─────────────────────────────────────
  const U: Record<string, WebGLUniformLocation | null> = {};
  const names = [
    'u_time', 'u_resolution',
    'u_auroraOn', 'u_ringOn', 'u_flareOn', 'u_grainOn',
    'u_auroraScale', 'u_auroraSpeed', 'u_auroraWarp',
    'u_auroraIntensity', 'u_auroraBlend',
    'u_auroraOffsetX', 'u_auroraOffsetY',
    'u_col1', 'u_col2', 'u_col3',
    'u_ringTex', 'u_ringOpacity',
    'u_flareIntensity', 'u_flareSpread', 'u_flareSoftness',
    'u_flareRainbow', 'u_flareCount', 'u_flareAngle', 'u_flareGlow',
    'u_flarePos[0]', 'u_flareParamsA[0]', 'u_flareParamsB[0]',
    'u_grainAmount', 'u_grainSize', 'u_grainSpeed',
    'u_brightness', 'u_contrast', 'u_saturation', 'u_vignette',
    'u_bgColor',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(mainProg, n);

  // ── Dots program uniforms ─────────────────────────────────────
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
      x: P.ringX as number, y: P.ringY as number,
      radius: P.ringRadius as number, edge: P.ringEdge as number,
    };
    if (g.x !== lastRingGeom.x || g.y !== lastRingGeom.y ||
        g.radius !== lastRingGeom.radius || g.edge !== lastRingGeom.edge) {
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
    bindQuad(ringBaseProg);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ── Dot VBO ───────────────────────────────────────────────────
  let dotVbo: WebGLBuffer | null = null;
  let dotVao: WebGLVertexArrayObject | null = null;
  let activeDotCount = 0;
  let lastDotCount = -1;

  function buildDotVBO(count: number): void {
    const N = Math.min(Math.max(count, 0), MAX_DOTS);
    activeDotCount = N;
    const data = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const h0 = Math.abs(Math.sin(i * 127.1 + 311.7)) % 1;
      const h1 = Math.abs(Math.sin(i * 269.5 + 183.3)) % 1;
      const h2 = Math.abs(Math.sin(i * 419.2 +  71.1)) % 1;
      const h3 = Math.abs(Math.sin(i * 537.9 + 253.6)) % 1;
      data[i * 4 + 0] = i * GOLDEN_ANGLE + h0 * 0.5;
      data[i * 4 + 1] = (h1 - 0.5) * 2.0;
      data[i * 4 + 2] = 0.4 + h2 * 0.6;
      data[i * 4 + 3] = h3 * 6.2832;
    }
    if (!dotVbo) dotVbo = gl.createBuffer();
    if (!dotVao) {
      dotVao = gl.createVertexArray();
      gl.bindVertexArray(dotVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, dotVbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const attribs: Array<[string, number]> = [
        ['a_angle',   0],
        ['a_rOffset', 4],
        ['a_size',    8],
        ['a_phase',  12],
      ];
      for (const [attrName, byteOffset] of attribs) {
        const loc = gl.getAttribLocation(dotsProg, attrName);
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 16, byteOffset);
        }
      }
      gl.bindVertexArray(null);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, dotVbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
  }

  const BP = BAKED_PARAMS;
  const flarePosData     = new Float32Array(MAX_FLARES * 2);
  const flareParamsAData = new Float32Array(MAX_FLARES * 4);
  const flareParamsBData = new Float32Array(MAX_FLARES * 3);

  // ── Resize ────────────────────────────────────────────────────
  function resize(): void {
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas!.getBoundingClientRect();
    canvas!.width  = Math.floor(rect.width * dpr);
    canvas!.height = Math.floor(rect.height * dpr);
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
    createRingFBO(canvas!.width, canvas!.height);
    ringFboDirty = true;
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // ── Initial dot build ─────────────────────────────────────────
  const initDotCount = asNumber(BP.dotCount, 120);
  buildDotVBO(initDotCount);
  lastDotCount = initDotCount;

  // ── Render loop ───────────────────────────────────────────────
  let accTime = 0;
  let lastTime = performance.now();

  function render(): void {
    const now = performance.now();
    const dt  = Math.min((now - lastTime) / 1000, 0.1);
    lastTime  = now;
    accTime  += dt * asNumber(BP.speed, 1.0);

    const P = BP;

    // Dirty checks
    if (checkRingDirty(P)) ringFboDirty = true;
    const newDotCount = asNumber(P.dotCount, 120);
    if (newDotCount !== lastDotCount) {
      buildDotVBO(newDotCount);
      lastDotCount = newDotCount;
    }

    const ringOn = asBool(P.ringOn, true);

    // Pass A — ring FBO (conditional)
    if (ringOn && ringFboDirty) {
      renderRingFBO(P);
      ringFboDirty = false;
    }

    // Pass B — main fullscreen quad
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
    gl!.useProgram(mainProg);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    gl!.uniform1f(U.u_auroraOn, asBool(P.auroraOn, true) ? 1.0 : 0.0);
    gl!.uniform1f(U.u_ringOn, ringOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_flareOn, asBool(P.flareOn, true) ? 1.0 : 0.0);
    gl!.uniform1f(U.u_grainOn, asBool(P.grainOn, true) ? 1.0 : 0.0);

    gl!.uniform1f(U.u_auroraScale, P.auroraScale as number);
    gl!.uniform1f(U.u_auroraSpeed, P.auroraSpeed as number);
    gl!.uniform1f(U.u_auroraWarp, P.auroraWarp as number);
    gl!.uniform1f(U.u_auroraIntensity, P.auroraIntensity as number);
    gl!.uniform1f(U.u_auroraBlend, P.auroraBlend as number);
    gl!.uniform1f(U.u_auroraOffsetX, P.auroraOffsetX as number);
    gl!.uniform1f(U.u_auroraOffsetY, P.auroraOffsetY as number);

    const c1 = hex2rgb(P.color1 as string);
    const c2 = hex2rgb(P.color2 as string);
    const c3 = hex2rgb(P.color3 as string);
    gl!.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);
    gl!.uniform3f(U.u_col2, c2[0], c2[1], c2[2]);
    gl!.uniform3f(U.u_col3, c3[0], c3[1], c3[2]);

    // Ring texture
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, ringFboTex);
    gl!.uniform1i(U['u_ringTex'], 0);
    gl!.uniform1f(U.u_ringOpacity, P.ringOpacity as number);

    // Flare
    gl!.uniform1f(U.u_flareIntensity, P.flareIntensity as number);
    gl!.uniform1f(U.u_flareSpread, P.flareSpread as number);
    gl!.uniform1f(U.u_flareSoftness, P.flareSoftness as number);
    gl!.uniform1f(U.u_flareRainbow, P.flareRainbow as number);
    gl!.uniform1f(U.u_flareCount, Math.max(1, Math.min(MAX_FLARES, Math.round(asNumber(P.flareCount, 2)))));
    gl!.uniform1f(U.u_flareAngle, P.flareAngle as number);
    gl!.uniform1f(U.u_flareGlow, P.flareGlow as number);
    for (let i = 0; i < MAX_FLARES; i += 1) {
      const idx = i + 1;
      const o2 = i * 2; const o4 = i * 4; const o3 = i * 3;
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
    gl!.uniform2fv(U['u_flarePos[0]'], flarePosData);
    gl!.uniform4fv(U['u_flareParamsA[0]'], flareParamsAData);
    gl!.uniform3fv(U['u_flareParamsB[0]'], flareParamsBData);

    // Grain
    gl!.uniform1f(U.u_grainAmount, P.grainAmount as number);
    gl!.uniform1f(U.u_grainSize, P.grainSize as number);
    gl!.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

    // Post
    gl!.uniform1f(U.u_brightness, P.brightness as number);
    gl!.uniform1f(U.u_contrast, P.contrast as number);
    gl!.uniform1f(U.u_saturation, P.saturation as number);
    gl!.uniform1f(U.u_vignette, P.vignette as number);
    const bg = hex2rgb(P.bgColor as string);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

    bindQuad(mainProg);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

    // Pass C — dot sprites
    if (ringOn && activeDotCount > 0) {
      gl!.useProgram(dotsProg);
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE);

      gl!.uniform2f(DU.u_resolution, canvas!.width, canvas!.height);
      gl!.uniform2f(DU.u_ringCenter, P.ringX as number, P.ringY as number);
      gl!.uniform1f(DU.u_ringRadius, P.ringRadius as number);
      gl!.uniform1f(DU.u_ringEdge, P.ringEdge as number);
      gl!.uniform1f(DU.u_dotSize, asNumber(P.dotSize, 4.0));
      gl!.uniform1f(DU.u_dotSpeed, asNumber(P.dotSpeed, 0.24));
      gl!.uniform1f(DU.u_dotBlink, asBool(P.dotBlink, true) ? 1.0 : 0.0);
      gl!.uniform1f(DU.u_dotRotate, asBool(P.dotRotate, false) ? 1.0 : 0.0);
      gl!.uniform1f(DU.u_dotOpacity, P.ringOpacity as number);
      gl!.uniform1f(DU.u_time, accTime);

      gl!.bindVertexArray(dotVao);
      gl!.drawArrays(gl!.POINTS, 0, activeDotCount);
      gl!.bindVertexArray(null);
      gl!.disable(gl!.BLEND);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
