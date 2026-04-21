// ============================================================
// Tempo-2 — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#171514',
        baseOn: true,
        purpleColor: '#6d4aa7',
        orangeColor: '#b0672d',
        baseCenterX: 0.6,
        baseCenterY: 0.56,
        baseRadius: 1.02,
        baseSoftness: 0.18,
        purpleStrength: 0.22,
        orangeStrength: 0.13,
        emberWidth: 0.22,
        auroraOn: true,
        auroraColorA: '#7c52c4',
        auroraColorB: '#bf6d34',
        auroraScale: 0.96,
        auroraSpeed: 0.05,
        auroraFlow: 0.16,
        auroraIntensity: 0.035,
        auroraThreshold: 0.64,
        auroraSoftness: 0.06,
        ringOn: true,
        ringX: 0.12,
        ringY: 0.26,
        ringRadius: 0.23,
        ringThickness: 0.018,
        ringDensity: 0.82,
        ringSize: 0.6,
        ringSpin: 0.04,
        ringBlink: 0.74,
        ringOpacity: 0.24,
        flareOn: true,
        flareIntensity: 0.22,
        flareSpread: 0.92,
        flareSmear: 1.36,
        flareChromatic: 0.12,
        flareAngle: -0.18,
        flareDrift: 0.08,
        flareGhostOpacity: 0.22,
        grainOn: true,
        grainAmount: 0.022,
        grainSize: 1.1,
        grainSpeed: 18,
        brightness: 0.95,
        contrast: 1.04,
        saturation: 0.76,
        speed: 0.42,
        paused: false,
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

(function () {
  const wrapper = document.querySelector('[data-webgl-experiment="tempo-2"]');
  if (!wrapper) return;
  const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  if (!gl) { console.error('WebGL2 not available'); return; }

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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Uniform locations
  const U: Record<string, WebGLUniformLocation | null> = {};
  const names = [
    'u_time', 'u_resolution',
    'u_baseOn', 'u_auroraOn', 'u_ringOn', 'u_flareOn', 'u_grainOn',
    'u_bgColor', 'u_purpleColor', 'u_orangeColor',
    'u_baseCenter', 'u_baseRadius', 'u_baseSoftness',
    'u_purpleStrength', 'u_orangeStrength', 'u_emberWidth',
    'u_auroraColorA', 'u_auroraColorB',
    'u_auroraScale', 'u_auroraSpeed', 'u_auroraFlow',
    'u_auroraIntensity', 'u_auroraThreshold', 'u_auroraSoftness',
    'u_ringCenter', 'u_ringRadius', 'u_ringThickness',
    'u_ringDensity', 'u_ringSize', 'u_ringSpin', 'u_ringBlink', 'u_ringOpacity',
    'u_flareIntensity', 'u_flareSpread', 'u_flareSmear',
    'u_flareChromatic', 'u_flareAngle', 'u_flareDrift', 'u_flareGhostOpacity',
    'u_grainAmount', 'u_grainSize', 'u_grainSpeed',
    'u_brightness', 'u_contrast', 'u_saturation',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  const P = BAKED_PARAMS;

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

  let accTime = 0, lastTime = performance.now();
  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (!(P.paused as boolean)) {
      accTime += dt * ((P.speed as number) ?? 1.0);
    }

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    gl!.uniform1f(U.u_baseOn, P.baseOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_auroraOn, P.auroraOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_ringOn, P.ringOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_flareOn, P.flareOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);

    const bg = hex2rgb(P.bgColor as string);
    const purple = hex2rgb(P.purpleColor as string);
    const orange = hex2rgb(P.orangeColor as string);
    const auroraA = hex2rgb(P.auroraColorA as string);
    const auroraB = hex2rgb(P.auroraColorB as string);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
    gl!.uniform3f(U.u_purpleColor, purple[0], purple[1], purple[2]);
    gl!.uniform3f(U.u_orangeColor, orange[0], orange[1], orange[2]);
    gl!.uniform2f(U.u_baseCenter, P.baseCenterX as number, P.baseCenterY as number);
    gl!.uniform1f(U.u_baseRadius, P.baseRadius as number);
    gl!.uniform1f(U.u_baseSoftness, P.baseSoftness as number);
    gl!.uniform1f(U.u_purpleStrength, P.purpleStrength as number);
    gl!.uniform1f(U.u_orangeStrength, P.orangeStrength as number);
    gl!.uniform1f(U.u_emberWidth, P.emberWidth as number);

    gl!.uniform3f(U.u_auroraColorA, auroraA[0], auroraA[1], auroraA[2]);
    gl!.uniform3f(U.u_auroraColorB, auroraB[0], auroraB[1], auroraB[2]);
    gl!.uniform1f(U.u_auroraScale, P.auroraScale as number);
    gl!.uniform1f(U.u_auroraSpeed, P.auroraSpeed as number);
    gl!.uniform1f(U.u_auroraFlow, P.auroraFlow as number);
    gl!.uniform1f(U.u_auroraIntensity, P.auroraIntensity as number);
    gl!.uniform1f(U.u_auroraThreshold, P.auroraThreshold as number);
    gl!.uniform1f(U.u_auroraSoftness, P.auroraSoftness as number);

    gl!.uniform2f(U.u_ringCenter, P.ringX as number, P.ringY as number);
    gl!.uniform1f(U.u_ringRadius, P.ringRadius as number);
    gl!.uniform1f(U.u_ringThickness, P.ringThickness as number);
    gl!.uniform1f(U.u_ringDensity, P.ringDensity as number);
    gl!.uniform1f(U.u_ringSize, P.ringSize as number);
    gl!.uniform1f(U.u_ringSpin, P.ringSpin as number);
    gl!.uniform1f(U.u_ringBlink, P.ringBlink as number);
    gl!.uniform1f(U.u_ringOpacity, P.ringOpacity as number);

    gl!.uniform1f(U.u_flareIntensity, P.flareIntensity as number);
    gl!.uniform1f(U.u_flareSpread, P.flareSpread as number);
    gl!.uniform1f(U.u_flareSmear, P.flareSmear as number);
    gl!.uniform1f(U.u_flareChromatic, P.flareChromatic as number);
    gl!.uniform1f(U.u_flareAngle, P.flareAngle as number);
    gl!.uniform1f(U.u_flareDrift, P.flareDrift as number);
    gl!.uniform1f(U.u_flareGhostOpacity, P.flareGhostOpacity as number);

    gl!.uniform1f(U.u_grainAmount, P.grainAmount as number);
    gl!.uniform1f(U.u_grainSize, P.grainSize as number);
    gl!.uniform1f(U.u_grainSpeed, P.grainSpeed as number);

    gl!.uniform1f(U.u_brightness, P.brightness as number);
    gl!.uniform1f(U.u_contrast, P.contrast as number);
    gl!.uniform1f(U.u_saturation, P.saturation as number);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
