// ============================================================
// Celestial Flare — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        bgColor: '#0a0a0f',
        noiseScale: 0.5, noiseSpeed: 0.03, noiseOctaves: 2,
        warpStrength: 1.5, warpScale: 0.5, warpSpeed: 0.3, waveIntensity: 0.7,
        color1: '#492d7b', color2: '#8c5a1c', color3: '#6b2a4a',
        blendWidth: 0.5, colorShift: 0.5,
        circleX: 0.5, circleY: 0.85,
        circleRadius: 0.25, circleEdge: 0.3,
        circleDensity: 5.0, circleParticleSize: 0.3,
        circleSpeed: 0.5, circleOpacity: 0.4,
        circleTrail: 0.5, circleTwinkle: 0.7,
        flareIntensity: 0.3, flareSpread: 1.0, flareLength: 1.0,
        flareRainbow: 0.7, flareCount: 4, flareSpeed: 0.5, flareAngle: 0.5,
        grainAmount: 0.08, grainSize: 1.5, grainSpeed: 30, grainVariation: 0.3,
        brightness: 1.0, contrast: 1.0, saturation: 1.2,
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
  const wrapper = document.querySelector('[data-webgl-experiment="celestial-flare"]');
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
    'u_noiseScale', 'u_noiseSpeed', 'u_noiseOctaves',
    'u_warpStrength', 'u_warpScale', 'u_warpSpeed', 'u_waveIntensity',
    'u_col1', 'u_col2', 'u_col3',
    'u_blendWidth', 'u_colorShift',
    'u_circlePos', 'u_circleRadius', 'u_circleEdge',
    'u_circleDensity', 'u_circleParticleSize', 'u_circleSpeed', 'u_circleOpacity',
    'u_circleTrail', 'u_circleTwinkle',
    'u_flareIntensity', 'u_flareSpread', 'u_flareLength',
    'u_flareRainbow', 'u_flareCount', 'u_flareSpeed', 'u_flareAngle',
    'u_grainAmount', 'u_grainSize', 'u_grainSpeed', 'u_grainVariation',
    'u_brightness', 'u_contrast', 'u_saturation', 'u_bgColor',
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
    accTime += dt;

    gl!.useProgram(prog);

    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    // Wave Gradient
    gl!.uniform1f(U.u_noiseScale, P.noiseScale as number);
    gl!.uniform1f(U.u_noiseSpeed, P.noiseSpeed as number);
    gl!.uniform1f(U.u_noiseOctaves, P.noiseOctaves as number);
    gl!.uniform1f(U.u_warpStrength, P.warpStrength as number);
    gl!.uniform1f(U.u_warpScale, P.warpScale as number);
    gl!.uniform1f(U.u_warpSpeed, P.warpSpeed as number);
    gl!.uniform1f(U.u_waveIntensity, P.waveIntensity as number);

    const c1 = hex2rgb(P.color1 as string);
    const c2 = hex2rgb(P.color2 as string);
    const c3 = hex2rgb(P.color3 as string);
    gl!.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);
    gl!.uniform3f(U.u_col2, c2[0], c2[1], c2[2]);
    gl!.uniform3f(U.u_col3, c3[0], c3[1], c3[2]);
    gl!.uniform1f(U.u_blendWidth, P.blendWidth as number);
    gl!.uniform1f(U.u_colorShift, P.colorShift as number);

    // Circle
    gl!.uniform2f(U.u_circlePos, P.circleX as number, P.circleY as number);
    gl!.uniform1f(U.u_circleRadius, P.circleRadius as number);
    gl!.uniform1f(U.u_circleEdge, P.circleEdge as number);
    gl!.uniform1f(U.u_circleDensity, P.circleDensity as number);
    gl!.uniform1f(U.u_circleParticleSize, P.circleParticleSize as number);
    gl!.uniform1f(U.u_circleSpeed, P.circleSpeed as number);
    gl!.uniform1f(U.u_circleOpacity, P.circleOpacity as number);
    gl!.uniform1f(U.u_circleTrail, (P.circleTrail ?? 0.5) as number);
    gl!.uniform1f(U.u_circleTwinkle, (P.circleTwinkle ?? 0.7) as number);

    // Flares
    gl!.uniform1f(U.u_flareIntensity, P.flareIntensity as number);
    gl!.uniform1f(U.u_flareSpread, P.flareSpread as number);
    gl!.uniform1f(U.u_flareLength, P.flareLength as number);
    gl!.uniform1f(U.u_flareRainbow, P.flareRainbow as number);
    gl!.uniform1f(U.u_flareCount, P.flareCount as number);
    gl!.uniform1f(U.u_flareSpeed, P.flareSpeed as number);
    gl!.uniform1f(U.u_flareAngle, P.flareAngle as number);

    // Grain
    gl!.uniform1f(U.u_grainAmount, P.grainAmount as number);
    gl!.uniform1f(U.u_grainSize, P.grainSize as number);
    gl!.uniform1f(U.u_grainSpeed, P.grainSpeed as number);
    gl!.uniform1f(U.u_grainVariation, P.grainVariation as number);

    // Post
    gl!.uniform1f(U.u_brightness, P.brightness as number);
    gl!.uniform1f(U.u_contrast, P.contrast as number);
    gl!.uniform1f(U.u_saturation, P.saturation as number);
    const bg = hex2rgb(P.bgColor as string);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
