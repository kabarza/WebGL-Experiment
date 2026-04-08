// ============================================================
// type dither — Standalone IIFE entry for Webflow export
// Canvas2D text + WebGL2 multi-mode dithering, zero React deps
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BP: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#0a0a0f',
        text: '2048',
        fontSize: 280,
        fontWeight: '900',
        fontFamily: 'sans-serif',
        textBlur: 2,
        textGlow: true,
        glowIntensity: 0.6,
        glowSize: 40,
        ditherMode: 'halftone',
        cellSize: 6,
        softness: 0.3,
        gridAngle: 0,
        gamma: 1.2,
        invert: false,
        color1: '#c83264',
        color2: '#6432c8',
        colorMix: 1.0,
        waveOn: false,
        waveAmplitude: 8,
        waveFrequency: 3,
        animOn: true,
        animSpeed: 0.5,
        animIntensity: 0.3,
        chromaticOn: false,
        chromaticOffset: 1.0,
        vignetteOn: true,
        vignetteStrength: 0.4,
        vignetteSize: 0.9,
        grainOn: true,
        grainAmount: 0.03,
        brightness: 1.0,
        contrast: 1.2,
        speed: 1.0,
      };

const DITHER_MODES: Record<string, number> = {
  halftone: 0,
  ordered: 1,
  noise: 2,
  crosshatch: 3,
  scanline: 4,
};

function hex2rgb(h: string): [number, number, number] {
  if (h.charAt(0) === '#') h = h.slice(1);
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function mkShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    throw new Error(gl.getShaderInfoLog(s) || 'compile');
  }
  return s;
}

// ── Text rendering ──────────────────────────────────────────

function renderText(
  ctx: CanvasRenderingContext2D,
  P: Record<string, unknown>,
) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  const text = (P.text as string) || '2048';
  const fontSize = (P.fontSize as number) || 280;
  const fontWeight = (P.fontWeight as string) || '900';
  const fontFamily = (P.fontFamily as string) || 'sans-serif';
  const textBlur = (P.textBlur as number) || 0;
  const glowOn = P.textGlow as boolean;
  const glowIntensity = (P.glowIntensity as number) || 0.6;
  const glowSize = (P.glowSize as number) || 40;

  const scale = h / 1000;
  const sf = fontSize * scale;

  ctx.font = `${fontWeight} ${sf}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = text.split('\n');
  const lh = sf * 1.15;
  const startY = (h - lines.length * lh) / 2 + lh / 2;

  if (textBlur * scale > 0.5) ctx.filter = `blur(${textBlur * scale}px)`;

  if (glowOn) {
    ctx.shadowColor = `rgba(255,255,255,${glowIntensity})`;
    ctx.shadowBlur = glowSize * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, startY + i * lh);
  }

  ctx.filter = 'none';
  ctx.shadowBlur = 0;
}

// ── WebGL init ──────────────────────────────────────────────

(function () {
  const wrapper = document.querySelector(
    '[data-webgl-experiment="type-dither"]',
  );
  if (!wrapper) return;
  const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) return;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

  // Fullscreen quad
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Uniforms
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uScene = gl.getUniformLocation(prog, 'u_scene');
  const uDitherMode = gl.getUniformLocation(prog, 'u_ditherMode');
  const uCellSize = gl.getUniformLocation(prog, 'u_cellSize');
  const uSoftness = gl.getUniformLocation(prog, 'u_softness');
  const uGridAngle = gl.getUniformLocation(prog, 'u_gridAngle');
  const uGamma = gl.getUniformLocation(prog, 'u_gamma');
  const uInvert = gl.getUniformLocation(prog, 'u_invert');
  const uBg = gl.getUniformLocation(prog, 'u_bgColor');
  const uC1 = gl.getUniformLocation(prog, 'u_color1');
  const uC2 = gl.getUniformLocation(prog, 'u_color2');
  const uCMix = gl.getUniformLocation(prog, 'u_colorMix');
  const uWaveOn = gl.getUniformLocation(prog, 'u_waveOn');
  const uWaveAmp = gl.getUniformLocation(prog, 'u_waveAmplitude');
  const uWaveFreq = gl.getUniformLocation(prog, 'u_waveFrequency');
  const uAnimOn = gl.getUniformLocation(prog, 'u_animOn');
  const uAnimSpd = gl.getUniformLocation(prog, 'u_animSpeed');
  const uAnimInt = gl.getUniformLocation(prog, 'u_animIntensity');
  const uChromOn = gl.getUniformLocation(prog, 'u_chromaticOn');
  const uChromOff = gl.getUniformLocation(prog, 'u_chromaticOffset');
  const uVigOn = gl.getUniformLocation(prog, 'u_vignetteOn');
  const uVigStr = gl.getUniformLocation(prog, 'u_vignetteStrength');
  const uVigSz = gl.getUniformLocation(prog, 'u_vignetteSize');
  const uGrainOn = gl.getUniformLocation(prog, 'u_grainOn');
  const uGrainAmt = gl.getUniformLocation(prog, 'u_grainAmount');
  const uBright = gl.getUniformLocation(prog, 'u_brightness');
  const uContrast = gl.getUniformLocation(prog, 'u_contrast');

  // Offscreen text canvas + texture
  const sc = document.createElement('canvas');
  const sctx = sc.getContext('2d')!;
  let tex: WebGLTexture | null = null;

  function initTex(w: number, h: number) {
    sc.width = w;
    sc.height = h;
    if (tex) gl!.deleteTexture(tex);
    tex = gl!.createTexture();
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
    gl!.texImage2D(
      gl!.TEXTURE_2D,
      0,
      gl!.RGBA,
      gl!.RGBA,
      gl!.UNSIGNED_BYTE,
      sc,
    );
    gl!.bindTexture(gl!.TEXTURE_2D, null);
  }

  function uploadTex() {
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, 1);
    gl!.texSubImage2D(
      gl!.TEXTURE_2D,
      0,
      0,
      0,
      gl!.RGBA,
      gl!.UNSIGNED_BYTE,
      sc,
    );
    gl!.bindTexture(gl!.TEXTURE_2D, null);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas!.getBoundingClientRect();
    canvas!.width = Math.floor(rect.width * dpr);
    canvas!.height = Math.floor(rect.height * dpr);
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
    initTex(canvas!.width, canvas!.height);
    renderText(sctx, BP);
    uploadTex();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let accTime = 0;
  let lastTime = performance.now();

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt * ((BP.speed as number) ?? 1.0);

    gl!.useProgram(prog);

    gl!.uniform1f(uTime, accTime);
    gl!.uniform2f(uRes, canvas!.width, canvas!.height);

    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.uniform1i(uScene, 0);

    gl!.uniform1f(uDitherMode, DITHER_MODES[BP.ditherMode as string] ?? 0);
    gl!.uniform1f(uCellSize, BP.cellSize as number);
    gl!.uniform1f(uSoftness, BP.softness as number);
    gl!.uniform1f(uGridAngle, BP.gridAngle as number);
    gl!.uniform1f(uGamma, BP.gamma as number);
    gl!.uniform1f(uInvert, BP.invert ? 1.0 : 0.0);

    const bg = hex2rgb((BP.bgColor as string) || '#0a0a0f');
    gl!.uniform3f(uBg, bg[0], bg[1], bg[2]);
    const c1 = hex2rgb((BP.color1 as string) || '#c83264');
    gl!.uniform3f(uC1, c1[0], c1[1], c1[2]);
    const c2 = hex2rgb((BP.color2 as string) || '#6432c8');
    gl!.uniform3f(uC2, c2[0], c2[1], c2[2]);
    gl!.uniform1f(uCMix, BP.colorMix as number);

    gl!.uniform1f(uWaveOn, BP.waveOn ? 1.0 : 0.0);
    gl!.uniform1f(uWaveAmp, BP.waveAmplitude as number);
    gl!.uniform1f(uWaveFreq, BP.waveFrequency as number);

    gl!.uniform1f(uAnimOn, BP.animOn !== false ? 1.0 : 0.0);
    gl!.uniform1f(uAnimSpd, (BP.animSpeed as number) || 0.5);
    gl!.uniform1f(uAnimInt, (BP.animIntensity as number) || 0.3);

    gl!.uniform1f(uChromOn, BP.chromaticOn ? 1.0 : 0.0);
    gl!.uniform1f(uChromOff, (BP.chromaticOffset as number) || 1.0);
    gl!.uniform1f(uVigOn, BP.vignetteOn !== false ? 1.0 : 0.0);
    gl!.uniform1f(uVigStr, (BP.vignetteStrength as number) || 0.4);
    gl!.uniform1f(uVigSz, (BP.vignetteSize as number) || 0.9);
    gl!.uniform1f(uGrainOn, BP.grainOn !== false ? 1.0 : 0.0);
    gl!.uniform1f(uGrainAmt, (BP.grainAmount as number) || 0.03);

    gl!.uniform1f(uBright, (BP.brightness as number) || 1.0);
    gl!.uniform1f(uContrast, (BP.contrast as number) || 1.2);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
