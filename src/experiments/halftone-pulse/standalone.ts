// ============================================================
// Halftone Pulse — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#0a0a12',
        fitMode: 'Fill',
        texInfluence: 0.5,
        useSourceColor: true,
        numSquares: 40,
        baseRadius: 0.35,
        texWarpOn: true,
        texWarpScale: 3.0,
        texWarpSpeed: 0.3,
        texWarpStrength: 0.5,
        noiseOn: true,
        noiseScale: 2.0,
        noiseSpeed: 0.3,
        noiseStrength: 0.15,
        noise2On: true,
        noise2Scale: 5.0,
        noise2Speed: 0.8,
        noise2Strength: 0.1,
        pulseOn: true,
        pulseRate: 1.0,
        pulseDepth: 0.2,
        pulseWave: 0.0,
        colorOn: true,
        colorA: '#ffffff',
        colorB: '#4a9eff',
        dotColor: '#ffffff',
        colorSpeed: 0.5,
        colorAngle: 0.0,
        colorNoiseAmt: 0.3,
        mouseNoiseBoost: 0.5,
        mouseRepel: 0.0,
        mouseRadius: 0.3,
        brightness: 1.0,
        contrast: 1.2,
        postSaturation: 1.0,
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
  const wrapper = document.querySelector('[data-webgl-experiment="halftone-pulse"]');
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
    'u_texture', 'u_hasTexture', 'u_textureSize', 'u_fitMode',
    'u_texInfluence', 'u_useSourceColor',
    'u_numSquares', 'u_baseRadius',
    'u_noiseOn', 'u_noiseScale', 'u_noiseSpeed', 'u_noiseStrength',
    'u_noise2On', 'u_noise2Scale', 'u_noise2Speed', 'u_noise2Strength',
    'u_texWarpOn', 'u_texWarpScale', 'u_texWarpSpeed', 'u_texWarpStrength',
    'u_pulseOn', 'u_pulseRate', 'u_pulseDepth', 'u_pulseWave',
    'u_colorOn', 'u_colorA', 'u_colorB', 'u_colorSpeed', 'u_colorAngle', 'u_colorNoiseAmt',
    'u_mousePos', 'u_mouseNoiseBoost', 'u_mouseRepel', 'u_mouseRadius',
    'u_bgColor', 'u_dotColor',
    'u_brightness', 'u_contrast', 'u_postSaturation',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  const P = BAKED_PARAMS;

  // Mouse tracking
  let mx = 0.5, my = 0.5;
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas!.getBoundingClientRect();
    mx = (e.clientX - rect.left) / rect.width;
    my = 1.0 - (e.clientY - rect.top) / rect.height;
  });

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

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    // No texture in standalone — procedural only
    gl!.uniform1f(U.u_hasTexture, 0.0);
    gl!.uniform2f(U.u_textureSize, 1.0, 1.0);
    gl!.uniform1f(U.u_fitMode, 0.0);
    gl!.uniform1f(U.u_texInfluence, P.texInfluence as number);
    gl!.uniform1f(U.u_useSourceColor, 0.0);

    // Grid
    gl!.uniform1f(U.u_numSquares, P.numSquares as number);
    gl!.uniform1f(U.u_baseRadius, P.baseRadius as number);

    // Noise 1
    gl!.uniform1f(U.u_noiseOn, (P.noiseOn as boolean) ? 1.0 : 0.0);
    gl!.uniform1f(U.u_noiseScale, P.noiseScale as number);
    gl!.uniform1f(U.u_noiseSpeed, P.noiseSpeed as number);
    gl!.uniform1f(U.u_noiseStrength, P.noiseStrength as number);

    // Noise 2 (flow)
    gl!.uniform1f(U.u_noise2On, (P.noise2On as boolean) ? 1.0 : 0.0);
    gl!.uniform1f(U.u_noise2Scale, P.noise2Scale as number);
    gl!.uniform1f(U.u_noise2Speed, P.noise2Speed as number);
    gl!.uniform1f(U.u_noise2Strength, P.noise2Strength as number);

    // Texture warp
    gl!.uniform1f(U.u_texWarpOn, (P.texWarpOn as boolean) ? 1.0 : 0.0);
    gl!.uniform1f(U.u_texWarpScale, P.texWarpScale as number);
    gl!.uniform1f(U.u_texWarpSpeed, P.texWarpSpeed as number);
    gl!.uniform1f(U.u_texWarpStrength, P.texWarpStrength as number);

    // Pulse
    gl!.uniform1f(U.u_pulseOn, (P.pulseOn as boolean) ? 1.0 : 0.0);
    gl!.uniform1f(U.u_pulseRate, P.pulseRate as number);
    gl!.uniform1f(U.u_pulseDepth, P.pulseDepth as number);
    gl!.uniform1f(U.u_pulseWave, P.pulseWave as number);

    // Color
    gl!.uniform1f(U.u_colorOn, (P.colorOn as boolean) ? 1.0 : 0.0);
    const cA = hex2rgb(P.colorA as string);
    gl!.uniform3f(U.u_colorA, cA[0], cA[1], cA[2]);
    const cB = hex2rgb(P.colorB as string);
    gl!.uniform3f(U.u_colorB, cB[0], cB[1], cB[2]);
    gl!.uniform1f(U.u_colorSpeed, P.colorSpeed as number);
    gl!.uniform1f(U.u_colorAngle, P.colorAngle as number);
    gl!.uniform1f(U.u_colorNoiseAmt, P.colorNoiseAmt as number);

    // Mouse
    gl!.uniform2f(U.u_mousePos, mx, my);
    gl!.uniform1f(U.u_mouseNoiseBoost, P.mouseNoiseBoost as number);
    gl!.uniform1f(U.u_mouseRepel, P.mouseRepel as number);
    gl!.uniform1f(U.u_mouseRadius, P.mouseRadius as number);

    // Colors / background
    const bg = hex2rgb(P.bgColor as string);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
    const dc = hex2rgb(P.dotColor as string);
    gl!.uniform3f(U.u_dotColor, dc[0], dc[1], dc[2]);

    // Post
    gl!.uniform1f(U.u_brightness, P.brightness as number);
    gl!.uniform1f(U.u_contrast, P.contrast as number);
    gl!.uniform1f(U.u_postSaturation, P.postSaturation as number);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
