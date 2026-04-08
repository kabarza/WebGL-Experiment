// ============================================================
// dot trace — Standalone IIFE entry for Webflow export
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
        fitMode: 'Fill',
        brightness: 1.0,
        contrast: 1.2,
        postSaturation: 1.1,
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
  const uFitMode = gl.getUniformLocation(prog, 'u_fitMode');
  const uBgColor = gl.getUniformLocation(prog, 'u_bgColor');
  const uBrightness = gl.getUniformLocation(prog, 'u_brightness');
  const uContrast = gl.getUniformLocation(prog, 'u_contrast');
  const uPostSaturation = gl.getUniformLocation(prog, 'u_postSaturation');

  const BP = BAKED_PARAMS;
  const FIT_MODES = ['Fill', 'Contain', 'Cover'];

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

  function render() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt * ((BP.speed as number) ?? 1.0);

    gl!.useProgram(prog);

    gl!.uniform1f(uTime, accTime);
    gl!.uniform2f(uRes, canvas!.width, canvas!.height);

    // No texture in standalone (SVG upload is interactive only)
    gl!.uniform1f(uHasTexture, 0.0);
    gl!.uniform2f(uTextureSize, 1.0, 1.0);
    gl!.uniform1f(
      uFitMode,
      Math.max(FIT_MODES.indexOf(BP.fitMode as string), 0),
    );

    const bg = hex2rgb(BP.bgColor as string);
    gl!.uniform3f(uBgColor, bg[0], bg[1], bg[2]);

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
