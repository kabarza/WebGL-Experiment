// ============================================================
// Flow Field — Standalone IIFE entry for Webflow export
// WebGL2 only (max compatibility), zero React dependencies
// Supports data-flow-ft-* attribute overrides
// ============================================================

import fragGLSL from './flow-field.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

// Baked params — injected at export build time via define
declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        // Fallback defaults
        bgColor: '#0d0d10',
        noiseScale: 0.4, noiseSpeed: 0.04, noiseOctaves: 2,
        warpStrength: 0.3, warpScale: 0.55, warpSpeed: 0.04, warpDepth: 2,
        vignetteRadius: 0.7, vignetteSoftness: 0.4, vignetteRoundness: 100,
        rotation: 0, zoom: 1.0,
        color1: '#1a6b42', color2: '#e84a9c', color3: '#c88aeb', color4: '#2d7a4f',
        blendWidth: 0.55, colorShift: 0.4,
        saturation: 1.3, brightness: 1.0, contrast: 1.0,
        highlightStr: 0.25, highlightColor: '#d4a0e8',
        grainAmount: 0.1, grainScale: 2.0, grainSpeed: 12.0,
        mouseStrength: 0.12,
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
  // Find canvas via data-flow-flow-field, then resolve wrapper
  let canvas = document.querySelector('canvas[data-flow-flow-field]') as HTMLCanvasElement | null;
  let wrapper: Element | null = canvas ? canvas.parentElement : null;

  // Fallback: legacy selectors
  if (!canvas) {
    wrapper = document.querySelector('[data-webgl-experiment="flow-field"]')
      || document.querySelector('[data-flow-tempo]');
    canvas = wrapper?.querySelector('canvas') as HTMLCanvasElement | null;
  }
  if (!canvas) return;

  // ── Params: data attributes override BAKED_PARAMS ──
  const P: Record<string, unknown> = {};
  for (const key in BAKED_PARAMS) {
    P[key] = BAKED_PARAMS[key];
    const kebab = key.replace(/([A-Z])/g, '-$1').toLowerCase();
    const attr = wrapper?.getAttribute('data-flow-ft-' + kebab) ?? null;
    if (attr !== null) {
      if (typeof BAKED_PARAMS[key] === 'number') {
        P[key] = Number(attr);
      } else if (typeof BAKED_PARAMS[key] === 'boolean') {
        P[key] = attr === 'true';
      } else {
        P[key] = attr;
      }
    }
  }

  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) {
    console.error('WebGL2 not available');
    return;
  }

  // Build program
  const prog = gl.createProgram()!;
  gl.attachShader(prog, mkShader(gl, gl.VERTEX_SHADER, vertGLSL));
  gl.attachShader(prog, mkShader(gl, gl.FRAGMENT_SHADER, fragGLSL));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('WebGL: Program link error:', gl.getProgramInfoLog(prog));
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
  const U: Record<string, WebGLUniformLocation | null> = {};
  const names = [
    'u_time', 'u_resolution', 'u_mousePos', 'u_mouseTrailPos', 'u_mouseVel',
    'u_noiseScale', 'u_noiseSpeed', 'u_noiseOctaves',
    'u_warpStrength', 'u_warpScale', 'u_warpSpeed', 'u_warpDepth',
    'u_vignetteRadius', 'u_vignetteSoft', 'u_vignetteRound',
    'u_rotation', 'u_zoom', 'u_mouseStr',
    'u_mouseRadius', 'u_mouseSoftness', 'u_mouseTrailStr',
    'u_grainAmt', 'u_grainScale', 'u_grainSpeed', 'u_bgColor',
    'u_col1', 'u_col2', 'u_col3', 'u_col4',
    'u_saturation', 'u_brightness', 'u_contrast',
    'u_blendWidth', 'u_colorShift',
    'u_highlightStr', 'u_highlightColor',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  // Mouse tracking
  let mx = 0.5, my = 0.5;
  let tmx = 0.5, tmy = 0.5;
  let mVel = 0;
  let prevMx = 0.5, prevMy = 0.5;

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

    // Smooth mouse trail
    const smoothing = 0.067;
    tmx += (mx - tmx) * smoothing;
    tmy += (my - tmy) * smoothing;

    // Mouse velocity
    const dx = mx - prevMx;
    const dy = my - prevMy;
    mVel = mVel * 0.9 + Math.sqrt(dx * dx + dy * dy) * 0.1;
    prevMx = mx;
    prevMy = my;

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);
    gl!.uniform2f(U.u_mousePos, mx, my);
    gl!.uniform2f(U.u_mouseTrailPos, tmx, tmy);
    gl!.uniform1f(U.u_mouseVel, mVel);

    gl!.uniform1f(U.u_noiseScale, P.noiseScale as number);
    gl!.uniform1f(U.u_noiseSpeed, P.noiseSpeed as number);
    gl!.uniform1f(U.u_noiseOctaves, P.noiseOctaves as number);
    gl!.uniform1f(U.u_warpStrength, P.warpStrength as number);
    gl!.uniform1f(U.u_warpScale, P.warpScale as number);
    gl!.uniform1f(U.u_warpSpeed, P.warpSpeed as number);
    gl!.uniform1f(U.u_warpDepth, P.warpDepth as number);
    gl!.uniform1f(U.u_vignetteRadius, P.vignetteRadius as number);
    gl!.uniform1f(U.u_vignetteSoft, P.vignetteSoftness as number);
    gl!.uniform1f(U.u_vignetteRound, P.vignetteRoundness as number);
    gl!.uniform1f(U.u_rotation, P.rotation as number);
    gl!.uniform1f(U.u_zoom, P.zoom as number);
    gl!.uniform1f(U.u_mouseStr, P.mouseStrength as number);
    gl!.uniform1f(U.u_mouseRadius, 0.49);
    gl!.uniform1f(U.u_mouseSoftness, 0.39);
    gl!.uniform1f(U.u_mouseTrailStr, 0.53);

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
