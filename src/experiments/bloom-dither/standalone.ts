// ============================================================
// Bloom Dither — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#12121a',
        branchScale: 1.0, branchThickness: 1.0, branchColor: '#555568',
        flowerSize: 1.0, flowerColor: '#6b4faa', petalCount: 5,
        glowIntensity: 1.2, glowColor: '#aaddff', glowRadius: 1.0,
        ditherSize: 5.0,
        seed: 42.0, animSpeed: 0.15,
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
  const wrapper = document.querySelector('[data-webgl-experiment="bloom-dither"]');
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
    'u_branchOn', 'u_flowerOn', 'u_glowOn', 'u_ditherOn',
    'u_branchScale', 'u_branchThickness', 'u_branchColor',
    'u_flowerSize', 'u_flowerColor', 'u_petalCount',
    'u_glowIntensity', 'u_glowColor', 'u_glowRadius',
    'u_ditherSize',
    'u_progress', 'u_seed', 'u_bgColor',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  const P = BAKED_PARAMS;
  const animSpeed = (P.animSpeed as number) || 0.15;

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
    accTime += dt;

    const progress = Math.min(1.0, accTime * animSpeed);

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    // Layer toggles — all on
    gl!.uniform1f(U.u_branchOn, 1.0);
    gl!.uniform1f(U.u_flowerOn, 1.0);
    gl!.uniform1f(U.u_glowOn, 1.0);
    gl!.uniform1f(U.u_ditherOn, 1.0);

    // Branches
    gl!.uniform1f(U.u_branchScale, P.branchScale as number);
    gl!.uniform1f(U.u_branchThickness, P.branchThickness as number);
    const bc = hex2rgb(P.branchColor as string);
    gl!.uniform3f(U.u_branchColor, bc[0], bc[1], bc[2]);

    // Flowers
    gl!.uniform1f(U.u_flowerSize, P.flowerSize as number);
    const fc = hex2rgb(P.flowerColor as string);
    gl!.uniform3f(U.u_flowerColor, fc[0], fc[1], fc[2]);
    gl!.uniform1f(U.u_petalCount, P.petalCount as number);

    // Glow
    gl!.uniform1f(U.u_glowIntensity, P.glowIntensity as number);
    const gc = hex2rgb(P.glowColor as string);
    gl!.uniform3f(U.u_glowColor, gc[0], gc[1], gc[2]);
    gl!.uniform1f(U.u_glowRadius, P.glowRadius as number);

    // Dither
    gl!.uniform1f(U.u_ditherSize, P.ditherSize as number);

    // General
    gl!.uniform1f(U.u_progress, progress);
    gl!.uniform1f(U.u_seed, P.seed as number);
    const bg = hex2rgb(P.bgColor as string);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
