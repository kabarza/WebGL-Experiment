// ============================================================
// Flow Field — Standalone IIFE entry for Webflow export
// WebGL2 only (max compatibility), zero React dependencies
// ============================================================

import fragGLSL from './flow-field.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

// Baked params — injected at export build time via define
declare const __TEMPO_BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __TEMPO_BAKED_PARAMS__ !== 'undefined'
    ? __TEMPO_BAKED_PARAMS__
    : {
        // Fallback defaults
        bgColor: '#0d0d10',
        noiseScale: 0.4, noiseSpeed: 0.04, noiseOctaves: 2,
        warpStrength: 0.3, warpScale: 0.55, warpSpeed: 0.04, warpDepth: 2,
        circleRadius: 0.85, circleSoftness: 0.35,
        circleCenter: { x: 0.5, y: 0.5 },
        rotation: 0, zoom: 1.0,
        color1: '#1a6b42', color2: '#e84a9c', color3: '#c88aeb', color4: '#2d7a4f',
        blendWidth: 0.55, colorShift: 0.4,
        saturation: 1.3, brightness: 1.0, contrast: 1.0,
        highlightStr: 0.25, highlightColor: '#d4a0e8',
        grainAmount: 0.1, grainScale: 2.0, grainSpeed: 12.0,
        mouseStrength: 0.12,
      };

function hex2rgb(h: string): [number, number, number] {
  return [
    parseInt(h.slice(1, 3), 16) / 255,
    parseInt(h.slice(3, 5), 16) / 255,
    parseInt(h.slice(5, 7), 16) / 255,
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
  const wrapper = document.querySelector('[data-tempo-experiment="flow-field"]');
  if (!wrapper) return;
  const canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) {
    console.error('Tempo: WebGL2 not available');
    return;
  }

  // Build program
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Tempo: Program link error:', gl.getProgramInfoLog(prog));
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
  const aPos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Uniform locations
  const U: Record<string, WebGLUniformLocation | null> = {};
  const names = [
    'u_time', 'u_resolution', 'u_mouse',
    'u_noiseScale', 'u_noiseSpeed', 'u_noiseOctaves',
    'u_warpStrength', 'u_warpScale', 'u_warpSpeed', 'u_warpDepth',
    'u_circleRadius', 'u_circleSoft', 'u_circlePos',
    'u_rotation', 'u_zoom', 'u_mouseStr',
    'u_grainAmt', 'u_grainScale', 'u_grainSpeed', 'u_bgColor',
    'u_col1', 'u_col2', 'u_col3', 'u_col4',
    'u_saturation', 'u_brightness', 'u_contrast',
    'u_blendWidth', 'u_colorShift',
    'u_highlightStr', 'u_highlightColor',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  const P = BAKED_PARAMS;

  // Mouse tracking
  let mx = 0.5, my = 0.5;
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mx = (e.clientX - rect.left) / rect.width;
    my = 1.0 - (e.clientY - rect.top) / rect.height;
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
    accTime += dt;

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);
    gl!.uniform2f(U.u_mouse, mx, my);

    gl!.uniform1f(U.u_noiseScale, P.noiseScale as number);
    gl!.uniform1f(U.u_noiseSpeed, P.noiseSpeed as number);
    gl!.uniform1f(U.u_noiseOctaves, P.noiseOctaves as number);
    gl!.uniform1f(U.u_warpStrength, P.warpStrength as number);
    gl!.uniform1f(U.u_warpScale, P.warpScale as number);
    gl!.uniform1f(U.u_warpSpeed, P.warpSpeed as number);
    gl!.uniform1f(U.u_warpDepth, P.warpDepth as number);
    gl!.uniform1f(U.u_circleRadius, P.circleRadius as number);
    gl!.uniform1f(U.u_circleSoft, P.circleSoftness as number);
    const cc = P.circleCenter as { x: number; y: number };
    gl!.uniform2f(U.u_circlePos, cc.x, cc.y);
    gl!.uniform1f(U.u_rotation, P.rotation as number);
    gl!.uniform1f(U.u_zoom, P.zoom as number);
    gl!.uniform1f(U.u_mouseStr, P.mouseStrength as number);

    const c1 = hex2rgb(P.color1 as string);
    const c2 = hex2rgb(P.color2 as string);
    const c3 = hex2rgb(P.color3 as string);
    const c4 = hex2rgb(P.color4 as string);
    gl!.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);
    gl!.uniform3f(U.u_col2, c2[0], c2[1], c2[2]);
    gl!.uniform3f(U.u_col3, c3[0], c3[1], c3[2]);
    gl!.uniform3f(U.u_col4, c4[0], c4[1], c4[2]);
    gl!.uniform1f(U.u_saturation, P.saturation as number);
    gl!.uniform1f(U.u_brightness, P.brightness as number);
    gl!.uniform1f(U.u_contrast, P.contrast as number);
    gl!.uniform1f(U.u_blendWidth, P.blendWidth as number);
    gl!.uniform1f(U.u_colorShift, P.colorShift as number);
    gl!.uniform1f(U.u_highlightStr, P.highlightStr as number);
    const hc = hex2rgb(P.highlightColor as string);
    gl!.uniform3f(U.u_highlightColor, hc[0], hc[1], hc[2]);
    gl!.uniform1f(U.u_grainAmt, P.grainAmount as number);
    gl!.uniform1f(U.u_grainScale, P.grainScale as number);
    gl!.uniform1f(U.u_grainSpeed, P.grainSpeed as number);
    const bg = hex2rgb(P.bgColor as string);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
