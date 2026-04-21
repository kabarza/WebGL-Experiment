// ============================================================
// aurora drift — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const MOUSE_MODE_ID: Record<string, number> = {
  Breeze: 0,
  Swell: 1,
  Tide: 2,
  Parallax: 3,
  Shimmer: 4,
};

const DEFAULT_MODE_ID = MOUSE_MODE_ID.Swell;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        color1: '#0c1a2e',
        color2: '#2d5b72',
        color3: '#a7e0cf',
        color4: '#e8a0b4',
        bgColor: '#040812',
        colorShift: 0.0,
        warpOn: true,
        warpStrength: 1.6,
        warpScale: 0.55,
        warpOctaves: 3,
        seed: 0.42,
        seedSpeed: 0.06,
        blobOn: true,
        blobCount: 5,
        blobSize: 1.05,
        blobSpacing: 0.62,
        blobRotation: -0.3,
        blobSpread: 4.9,
        blobOffsetX: -0.35,
        blobOffsetY: -0.2,
        tileSpacing: 4.8,
        blendSoftness: 1.5,
        autoRotation: 0.008,
        zoom: 0.88,
        offsetX: -0.05,
        offsetY: -0.25,
        mouseOn: true,
        mouseMode: 'Swell',
        mouseStrength: 0.9,
        mouseRadius: 1.1,
        mouseWindDecay: 0.92,
        mouseWindGain: 3.0,
        pulseStrength: 0.45,
        pulseDecay: 1.4,
        pulseSpeed: 1.6,
        pulseWidth: 0.12,
        grainOn: true,
        grainAmount: 0.04,
        grainScale: 0.5,
        grainSpeed: 24.0,
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

  const U: Record<string, WebGLUniformLocation | null> = {};
  const names = [
    'u_time', 'u_resolution',
    'u_color1', 'u_color2', 'u_color3', 'u_color4', 'u_bgColor',
    'u_warpOn', 'u_warpStrength', 'u_warpScale', 'u_warpOctaves', 'u_seed', 'u_seedSpeed',
    'u_blobOn', 'u_blobSize', 'u_blobSpacing', 'u_blobRotation', 'u_blobSpread',
    'u_blobOffsetX', 'u_blobOffsetY', 'u_tileSpacing',
    'u_blobCount', 'u_blendSoftness', 'u_autoRotation',
    'u_colorShift',
    'u_zoom', 'u_offsetX', 'u_offsetY',
    'u_mouseOn', 'u_mousePos', 'u_mouseWind', 'u_mouseStr', 'u_mouseRadius',
    'u_mouseMode',
    'u_pulsePos', 'u_pulseStr', 'u_pulseAge', 'u_pulseSpeed', 'u_pulseWidth',
    'u_grainOn', 'u_grainAmount', 'u_grainScale', 'u_grainSpeed',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  const BP = BAKED_PARAMS;
  const mouseEnabled = BP.mouseOn as boolean;
  const modeId = MOUSE_MODE_ID[(BP.mouseMode as string) ?? 'Swell'] ?? DEFAULT_MODE_ID;

  // Mouse tracking
  let mx = 0.5, my = 0.5;
  let prevMx = 0.5, prevMy = 0.5;
  let windX = 0, windY = 0;

  // Click pulse tracking
  let pulseX = 0.5, pulseY = 0.5, pulseAge = 999, pulseActive = false;

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mx = (e.clientX - rect.left) / rect.width;
    my = 1.0 - (e.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener('pointerdown', () => {
    pulseX = mx;
    pulseY = my;
    pulseAge = 0;
    pulseActive = true;
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
  const windDecay = Math.max(0, Math.min(0.995, (BP.mouseWindDecay as number) ?? 0.92));
  const windGain = (BP.mouseWindGain as number) ?? 3.0;

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt * (BP.speed as number);

    // Wind vector: accumulate velocity, decay each frame
    const vx = mx - prevMx;
    const vy = my - prevMy;
    prevMx = mx;
    prevMy = my;
    windX = windX * windDecay + vx * windGain;
    windY = windY * windDecay + vy * windGain;

    // Pulse decay
    let currentPulseStr = 0;
    if (pulseActive) {
      pulseAge += dt;
      const decay = Math.max(BP.pulseDecay as number, 0.001);
      const life = pulseAge / decay;
      if (life >= 1) {
        pulseActive = false;
      } else {
        const fade = 1 - life;
        currentPulseStr = (BP.pulseStrength as number) * fade * fade * fade;
      }
    }

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    // Colors
    const c1 = hex2rgb(BP.color1 as string);
    const c2 = hex2rgb(BP.color2 as string);
    const c3 = hex2rgb(BP.color3 as string);
    const c4 = hex2rgb(BP.color4 as string);
    const bg = hex2rgb(BP.bgColor as string);
    gl!.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
    gl!.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
    gl!.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
    gl!.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
    gl!.uniform1f(U.u_colorShift, BP.colorShift as number);

    // Warp
    gl!.uniform1f(U.u_warpOn, BP.warpOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_warpStrength, BP.warpStrength as number);
    gl!.uniform1f(U.u_warpScale, BP.warpScale as number);
    gl!.uniform1f(U.u_warpOctaves, BP.warpOctaves as number);
    gl!.uniform1f(U.u_seed, BP.seed as number);
    gl!.uniform1f(U.u_seedSpeed, BP.seedSpeed as number);

    // Blobs
    gl!.uniform1f(U.u_blobOn, BP.blobOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_blobCount, BP.blobCount as number);
    gl!.uniform1f(U.u_blobSize, BP.blobSize as number);
    gl!.uniform1f(U.u_blobSpacing, BP.blobSpacing as number);
    gl!.uniform1f(U.u_blendSoftness, BP.blendSoftness as number);
    gl!.uniform1f(U.u_blobRotation, BP.blobRotation as number);
    gl!.uniform1f(U.u_autoRotation, BP.autoRotation as number);
    gl!.uniform1f(U.u_blobSpread, BP.blobSpread as number);
    gl!.uniform1f(U.u_blobOffsetX, BP.blobOffsetX as number);
    gl!.uniform1f(U.u_blobOffsetY, BP.blobOffsetY as number);
    gl!.uniform1f(U.u_tileSpacing, BP.tileSpacing as number);

    // Transform
    gl!.uniform1f(U.u_zoom, BP.zoom as number);
    gl!.uniform1f(U.u_offsetX, BP.offsetX as number);
    gl!.uniform1f(U.u_offsetY, BP.offsetY as number);

    // Mouse core
    gl!.uniform1f(U.u_mouseOn, mouseEnabled ? 1.0 : 0.0);
    gl!.uniform2f(U.u_mousePos, mx, my);
    gl!.uniform2f(U.u_mouseWind, windX, windY);
    gl!.uniform1f(U.u_mouseStr, mouseEnabled ? (BP.mouseStrength as number) : 0);
    gl!.uniform1f(U.u_mouseRadius, BP.mouseRadius as number);
    gl!.uniform1f(U.u_mouseMode, modeId);

    // Click pulse
    gl!.uniform2f(U.u_pulsePos, pulseX, pulseY);
    gl!.uniform1f(U.u_pulseStr, mouseEnabled ? currentPulseStr : 0);
    gl!.uniform1f(U.u_pulseAge, pulseAge);
    gl!.uniform1f(U.u_pulseSpeed, BP.pulseSpeed as number);
    gl!.uniform1f(U.u_pulseWidth, BP.pulseWidth as number);

    // Grain
    gl!.uniform1f(U.u_grainOn, BP.grainOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_grainAmount, BP.grainAmount as number);
    gl!.uniform1f(U.u_grainScale, BP.grainScale as number);
    gl!.uniform1f(U.u_grainSpeed, BP.grainSpeed as number);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
