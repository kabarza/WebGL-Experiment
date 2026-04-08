// ============================================================
// aurora drift — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        color1: '#16254b',
        color2: '#23418a',
        color3: '#aadfd9',
        color4: '#e64f0f',
        warpOn: true,
        warpStrength: 3.34,
        warpScale: 0.5,
        seed: -0.12,
        blobOn: true,
        blobSize: 0.75,
        blobSpacing: 0.52,
        blobRotation: -0.38,
        blobSpread: 4.52,
        blobOffsetX: -0.77,
        blobOffsetY: -0.21,
        tileSpacing: 4.27,
        zoom: 0.72,
        offsetX: -0.28,
        offsetY: -0.44,
        mouseOn: true,
        grainOn: true,
        grainAmount: 0.04,
        grainScale: 0.5,
        speed: 1.0,
      };

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

function hex2rgb(h: string): [number, number, number] {
  if (h.charAt(0) === '#') h = h.slice(1);
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

(function () {
  const wrapper = document.querySelector('[data-webgl-experiment="aurora-drift"]');
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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Uniform locations
  const U: Record<string, WebGLUniformLocation | null> = {};
  const names = [
    'u_time', 'u_resolution',
    'u_color1', 'u_color2', 'u_color3', 'u_color4',
    'u_warpOn', 'u_warpStrength', 'u_warpScale', 'u_seed',
    'u_blobOn', 'u_blobSize', 'u_blobSpacing', 'u_blobRotation',
    'u_blobSpread', 'u_blobOffsetX', 'u_blobOffsetY', 'u_tileSpacing',
    'u_zoom', 'u_offsetX', 'u_offsetY',
    'u_grainOn', 'u_grainAmount', 'u_grainScale',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  const BP = BAKED_PARAMS;

  // Mouse → displacement / seed smoothing
  const defaultDisp = BP.warpStrength as number;
  const defaultSeed = BP.seed as number;
  let smoothDisp = defaultDisp;
  let smoothSeed = defaultSeed;
  let targetDisp = defaultDisp;
  let targetSeed = defaultSeed;
  const mouseEnabled = BP.mouseOn as boolean;

  canvas.addEventListener('pointermove', (e) => {
    if (!mouseEnabled) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    targetDisp = mx * 5.0;
    targetSeed = my * 2.0 - 1.0;
  });
  canvas.addEventListener('pointerleave', () => {
    targetDisp = defaultDisp;
    targetSeed = defaultSeed;
  });

  // Resize
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

  // Render loop
  let accTime = 0;
  let lastTime = performance.now();

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt * (BP.speed as number);

    // Smooth mouse modulation
    smoothDisp += (targetDisp - smoothDisp) * 0.1;
    smoothSeed += (targetSeed - smoothSeed) * 0.1;

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    // Colors
    const c1 = hex2rgb(BP.color1 as string);
    const c2 = hex2rgb(BP.color2 as string);
    const c3 = hex2rgb(BP.color3 as string);
    const c4 = hex2rgb(BP.color4 as string);
    gl!.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
    gl!.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
    gl!.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
    gl!.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);

    // Warp (displacement driven by smoothed mouse)
    gl!.uniform1f(U.u_warpOn, BP.warpOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_warpStrength, smoothDisp);
    gl!.uniform1f(U.u_warpScale, BP.warpScale as number);
    gl!.uniform1f(U.u_seed, smoothSeed);

    // Blobs
    gl!.uniform1f(U.u_blobOn, BP.blobOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_blobSize, BP.blobSize as number);
    gl!.uniform1f(U.u_blobSpacing, BP.blobSpacing as number);
    gl!.uniform1f(U.u_blobRotation, BP.blobRotation as number);
    gl!.uniform1f(U.u_blobSpread, BP.blobSpread as number);
    gl!.uniform1f(U.u_blobOffsetX, BP.blobOffsetX as number);
    gl!.uniform1f(U.u_blobOffsetY, BP.blobOffsetY as number);
    gl!.uniform1f(U.u_tileSpacing, BP.tileSpacing as number);

    // Transform
    gl!.uniform1f(U.u_zoom, BP.zoom as number);
    gl!.uniform1f(U.u_offsetX, BP.offsetX as number);
    gl!.uniform1f(U.u_offsetY, BP.offsetY as number);

    // Grain
    gl!.uniform1f(U.u_grainOn, BP.grainOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_grainAmount, BP.grainAmount as number);
    gl!.uniform1f(U.u_grainScale, BP.grainScale as number);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
