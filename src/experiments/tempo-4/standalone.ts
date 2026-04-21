// ============================================================
// Tempo-4 — Standalone IIFE entry for Webflow export
// WebGL2 only, zero React dependencies
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';

declare const __BAKED_PARAMS__: Record<string, unknown>;

const BAKED_PARAMS: Record<string, unknown> =
  typeof __BAKED_PARAMS__ !== 'undefined'
    ? __BAKED_PARAMS__
    : {
        speed: 0.6,
        bgColor: '#060410',
        auroraOn: true, auroraOpacity: 1.0,
        color1: '#1a1040', color2: '#3a1a4a', color3: '#452030', color4: '#100808',
        warpStrength: 1.8, warpScale: 0.5, warpSpeed: 0.1,
        blobSize: 0.85, blobSpacing: 0.52, blobRotation: -0.38, blobSpread: 3.5,
        blobOffsetX: -0.8, blobOffsetY: 0.4, tileSpacing: 5.0,
        zoom: 0.6, auroraOffsetX: -0.3, auroraOffsetY: 0.25,
        imageOn: false, imageOpacity: 1.0, imageScale: 1.0,
        imageOffsetX: 0.0, imageOffsetY: 0.0,
        circleOn: true, circleX: 0.25, circleY: 0.5,
        circleRadius: 0.35, circleEdge: 0.6, circleDensity: 2.5,
        circleParticleSize: 0.5, circleSpeed: 0.3,
        circleOpacity: 0.7, circleTrail: 0.0, circleTwinkle: 0.5,
        circleColor: '#d9d5cc', circleGlow: 0.2,
        grainOn: true, grainAmount: 0.08, grainSize: 1.5, grainSpeed: 24.0,
        auroraOrder: 0, imageOrder: 1, circleOrder: 2, grainOrder: 3,
        brightness: 1.3, contrast: 1.2, saturation: 0.9,
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
  const wrapper = document.querySelector('[data-webgl-experiment="tempo-4"]');
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
    'u_time', 'u_resolution', 'u_bgColor',
    'u_orderAurora', 'u_orderImage', 'u_orderCircle', 'u_orderGrain',
    'u_auroraOn', 'u_auroraOpacity',
    'u_color1', 'u_color2', 'u_color3', 'u_color4',
    'u_warpStrength', 'u_warpScale', 'u_warpSpeed',
    'u_blobSize', 'u_blobSpacing', 'u_blobRotation', 'u_blobSpread',
    'u_blobOffsetX', 'u_blobOffsetY', 'u_tileSpacing',
    'u_zoom', 'u_auroraOffsetX', 'u_auroraOffsetY',
    'u_imageOn', 'u_imageOpacity', 'u_image', 'u_imageLoaded',
    'u_imageScale', 'u_imageOffsetX', 'u_imageOffsetY', 'u_imageAspect',
    'u_circleOn', 'u_circleOpacity', 'u_circlePos',
    'u_circleRadius', 'u_circleEdge', 'u_circleDensity',
    'u_circleParticleSize', 'u_circleSpeed',
    'u_circleTrail', 'u_circleTwinkle',
    'u_circleColor', 'u_circleGlow',
    'u_grainOn', 'u_grainAmount', 'u_grainSize', 'u_grainSpeed',
    'u_brightness', 'u_contrast', 'u_saturation',
  ];
  for (const n of names) U[n] = gl.getUniformLocation(prog, n);

  // 1x1 transparent texture placeholder
  const imageTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, imageTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,0]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

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

  let accTime = 0, lastTime = performance.now();

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt * (BP.speed as number);

    gl!.useProgram(prog);
    gl!.uniform1f(U.u_time, accTime);
    gl!.uniform2f(U.u_resolution, canvas!.width, canvas!.height);

    const bg = hex2rgb(BP.bgColor as string);
    gl!.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

    gl!.uniform1f(U.u_orderAurora, BP.auroraOrder as number);
    gl!.uniform1f(U.u_orderImage, BP.imageOrder as number);
    gl!.uniform1f(U.u_orderCircle, BP.circleOrder as number);
    gl!.uniform1f(U.u_orderGrain, BP.grainOrder as number);

    // Aurora
    gl!.uniform1f(U.u_auroraOn, BP.auroraOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_auroraOpacity, BP.auroraOpacity as number);
    const c1 = hex2rgb(BP.color1 as string), c2 = hex2rgb(BP.color2 as string);
    const c3 = hex2rgb(BP.color3 as string), c4 = hex2rgb(BP.color4 as string);
    gl!.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
    gl!.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
    gl!.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
    gl!.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);
    gl!.uniform1f(U.u_warpStrength, BP.warpStrength as number);
    gl!.uniform1f(U.u_warpScale, BP.warpScale as number);
    gl!.uniform1f(U.u_warpSpeed, BP.warpSpeed as number);
    gl!.uniform1f(U.u_blobSize, BP.blobSize as number);
    gl!.uniform1f(U.u_blobSpacing, BP.blobSpacing as number);
    gl!.uniform1f(U.u_blobRotation, BP.blobRotation as number);
    gl!.uniform1f(U.u_blobSpread, BP.blobSpread as number);
    gl!.uniform1f(U.u_blobOffsetX, BP.blobOffsetX as number);
    gl!.uniform1f(U.u_blobOffsetY, BP.blobOffsetY as number);
    gl!.uniform1f(U.u_tileSpacing, BP.tileSpacing as number);
    gl!.uniform1f(U.u_zoom, BP.zoom as number);
    gl!.uniform1f(U.u_auroraOffsetX, BP.auroraOffsetX as number);
    gl!.uniform1f(U.u_auroraOffsetY, BP.auroraOffsetY as number);

    // Image (disabled in standalone)
    gl!.uniform1f(U.u_imageOn, 0.0);
    gl!.uniform1f(U.u_imageOpacity, 0.0);
    gl!.uniform1f(U.u_imageLoaded, 0.0);
    gl!.uniform1f(U.u_imageScale, 1.0);
    gl!.uniform1f(U.u_imageOffsetX, 0.0);
    gl!.uniform1f(U.u_imageOffsetY, 0.0);
    gl!.uniform1f(U.u_imageAspect, 1.0);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, imageTex);
    gl!.uniform1i(U.u_image, 0);

    // Circle
    gl!.uniform1f(U.u_circleOn, BP.circleOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_circleOpacity, BP.circleOpacity as number);
    gl!.uniform2f(U.u_circlePos, BP.circleX as number, BP.circleY as number);
    gl!.uniform1f(U.u_circleRadius, BP.circleRadius as number);
    gl!.uniform1f(U.u_circleEdge, BP.circleEdge as number);
    gl!.uniform1f(U.u_circleDensity, BP.circleDensity as number);
    gl!.uniform1f(U.u_circleParticleSize, BP.circleParticleSize as number);
    gl!.uniform1f(U.u_circleSpeed, BP.circleSpeed as number);
    gl!.uniform1f(U.u_circleTrail, BP.circleTrail as number);
    gl!.uniform1f(U.u_circleTwinkle, BP.circleTwinkle as number);
    gl!.uniform1f(U.u_circleGlow, BP.circleGlow as number);
    const cc = hex2rgb(BP.circleColor as string);
    gl!.uniform3f(U.u_circleColor, cc[0], cc[1], cc[2]);

    // Grain
    gl!.uniform1f(U.u_grainOn, BP.grainOn ? 1.0 : 0.0);
    gl!.uniform1f(U.u_grainAmount, BP.grainAmount as number);
    gl!.uniform1f(U.u_grainSize, BP.grainSize as number);
    gl!.uniform1f(U.u_grainSpeed, BP.grainSpeed as number);

    // Post
    gl!.uniform1f(U.u_brightness, BP.brightness as number);
    gl!.uniform1f(U.u_contrast, BP.contrast as number);
    gl!.uniform1f(U.u_saturation, BP.saturation as number);

    gl!.bindVertexArray(vao);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    gl!.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
})();
