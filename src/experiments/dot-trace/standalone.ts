// ============================================================
// dot trace — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

const REVEAL_MODES = ['Radial', 'Sweep Right', 'Sweep Down', 'Random', 'Spiral'];

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#0a0a0f',
        // Dots
        dotsOn: true,
        dotSize: 0.85,
        dotSpacing: 6,
        dotSoftness: 0.3,
        gridAngle: 0,
        luminanceGamma: 1.2,
        // Colors
        accent1: '#6432c8',
        accent2: '#9060d0',
        neutral: '#606080',
        colorThreshold: 0.15,
        colorMix: 1.0,
        // Playback / Reveal
        playMode: 'Auto Play',
        playSpeed: 0.12,
        looping: true,
        revealMode: 'Radial',
        revealOriginX: 0.5,
        revealOriginY: 0.5,
        revealSpread: 0.05,
        revealReverse: false,
        // Post
        brightness: 1.0,
        contrast: 1.2,
        postSaturation: 1.1,
        // Animation
        speed: 1.0,
      };

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

(function () {
  const wrapper = document.querySelector(
    '[data-webgl-experiment="dot-trace"]',
  );
  if (!wrapper) return;
  const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) {
    console.error('WebGL2 not available');
    return;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('WebGL: link error:', gl.getProgramInfoLog(prog));
    return;
  }

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

  // Uniform locations
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uHasTexture = gl.getUniformLocation(prog, 'u_hasTexture');
  const uTextureSize = gl.getUniformLocation(prog, 'u_textureSize');

  const uDotsOn = gl.getUniformLocation(prog, 'u_dotsOn');

  const uProgress = gl.getUniformLocation(prog, 'u_progress');
  const uRevealMode = gl.getUniformLocation(prog, 'u_revealMode');
  const uRevealOriginX = gl.getUniformLocation(prog, 'u_revealOriginX');
  const uRevealOriginY = gl.getUniformLocation(prog, 'u_revealOriginY');
  const uRevealSpread = gl.getUniformLocation(prog, 'u_revealSpread');
  const uRevealReverse = gl.getUniformLocation(prog, 'u_revealReverse');

  const uDotSize = gl.getUniformLocation(prog, 'u_dotSize');
  const uDotSpacing = gl.getUniformLocation(prog, 'u_dotSpacing');
  const uDotSoftness = gl.getUniformLocation(prog, 'u_dotSoftness');
  const uGridAngle = gl.getUniformLocation(prog, 'u_gridAngle');
  const uLuminanceGamma = gl.getUniformLocation(prog, 'u_luminanceGamma');

  const uBgColor = gl.getUniformLocation(prog, 'u_bgColor');
  const uAccent1 = gl.getUniformLocation(prog, 'u_accent1');
  const uAccent2 = gl.getUniformLocation(prog, 'u_accent2');
  const uNeutral = gl.getUniformLocation(prog, 'u_neutral');
  const uColorThreshold = gl.getUniformLocation(prog, 'u_colorThreshold');
  const uColorMix = gl.getUniformLocation(prog, 'u_colorMix');

  const uBrightness = gl.getUniformLocation(prog, 'u_brightness');
  const uContrast = gl.getUniformLocation(prog, 'u_contrast');
  const uPostSaturation = gl.getUniformLocation(prog, 'u_postSaturation');

  const BP = BAKED_PARAMS;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas!.getBoundingClientRect();
    canvas!.width = Math.floor(rect.width * dpr);
    canvas!.height = Math.floor(rect.height * dpr);
    gl!.viewport(0, 0, canvas!.width, canvas!.height);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let accTime = 0,
    lastTime = performance.now();
  let autoProgress = 0;

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt * ((BP.speed as number) ?? 1.0);

    // Auto-play
    if (BP.playMode === 'Auto Play') {
      autoProgress += dt * (BP.playSpeed as number);
      if (autoProgress > 1.0) {
        autoProgress = BP.looping ? 0.0 : 1.0;
      }
    }

    gl!.useProgram(prog);

    // Core
    gl!.uniform1f(uTime, accTime);
    gl!.uniform2f(uRes, canvas!.width, canvas!.height);

    // No texture in standalone
    gl!.uniform1f(uHasTexture, 0.0);
    gl!.uniform2f(uTextureSize, 1.0, 1.0);

    // Layer toggles
    gl!.uniform1f(uDotsOn, BP.dotsOn ? 1.0 : 0.0);

    // Reveal
    gl!.uniform1f(uProgress, autoProgress);
    gl!.uniform1f(
      uRevealMode,
      Math.max(REVEAL_MODES.indexOf(BP.revealMode as string), 0),
    );
    gl!.uniform1f(uRevealOriginX, BP.revealOriginX as number);
    gl!.uniform1f(uRevealOriginY, BP.revealOriginY as number);
    gl!.uniform1f(uRevealSpread, BP.revealSpread as number);
    gl!.uniform1f(uRevealReverse, BP.revealReverse ? 1.0 : 0.0);

    // Dither
    gl!.uniform1f(uDotSize, BP.dotSize as number);
    gl!.uniform1f(uDotSpacing, BP.dotSpacing as number);
    gl!.uniform1f(uDotSoftness, BP.dotSoftness as number);
    gl!.uniform1f(uGridAngle, BP.gridAngle as number);
    gl!.uniform1f(uLuminanceGamma, BP.luminanceGamma as number);

    // Colors
    const bg = hex2rgb(BP.bgColor as string);
    gl!.uniform3f(uBgColor, bg[0], bg[1], bg[2]);
    const a1 = hex2rgb(BP.accent1 as string);
    gl!.uniform3f(uAccent1, a1[0], a1[1], a1[2]);
    const a2 = hex2rgb(BP.accent2 as string);
    gl!.uniform3f(uAccent2, a2[0], a2[1], a2[2]);
    const nt = hex2rgb(BP.neutral as string);
    gl!.uniform3f(uNeutral, nt[0], nt[1], nt[2]);
    gl!.uniform1f(uColorThreshold, BP.colorThreshold as number);
    gl!.uniform1f(uColorMix, BP.colorMix as number);

    // Post
    gl!.uniform1f(uBrightness, BP.brightness as number);
    gl!.uniform1f(uContrast, BP.contrast as number);
    gl!.uniform1f(uPostSaturation, BP.postSaturation as number);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
