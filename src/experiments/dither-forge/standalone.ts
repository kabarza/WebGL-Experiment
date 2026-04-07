// ============================================================
// dither forge — Standalone IIFE entry for Webflow export
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
        speed: 1.0,
        fitMode: 'fill',
        // Dither
        ditherOn: true,
        glyphSize: 0.85,
        glyphSpacing: 6,
        glyphSoftness: 0.3,
        gridAngle: 0,
        luminanceGamma: 1.2,
        glyphShape: 'circle',
        invert: false,
        // Palette
        accent1: '#c83264',
        accent2: '#6432c8',
        accent3: '#e0a0c0',
        neutral: '#808080',
        colorThreshold: 0.15,
        colorMix: 1.0,
        glyphHueJitter: 0.15,
        glyphBrightJitter: 0.2,
        // Edges
        edgeOn: true,
        edgeThreshold: 0.12,
        edgeWidth: 1.5,
        edgeColor: '#404050',
        edgeOpacity: 0.5,
        // Mouse
        mouseOn: true,
        mouseRadius: 0.2,
        mouseOpacity: 0.8,
        mouseSizeBoost: 0.5,
        mouseBrightBoost: 1.0,
        mouseSatBoost: 0.5,
        mouseColorShift: 0.3,
        mouseReveal: 0.0,
        // Effects
        chromaticOn: false,
        chromaticOffset: 1.0,
        vignetteOn: true,
        vignetteStrength: 0.4,
        vignetteSize: 0.9,
        grainOn: true,
        grainAmount: 0.03,
        grainSpeed: 30,
        // Animation
        animOn: true,
        animSpeed: 0.5,
        animJitter: 0.3,
        animPulse: 0.2,
        // Post
        brightness: 1.0,
        contrast: 1.2,
        postSaturation: 1.1,
      };

const FIT_MODES: Record<string, number> = { cover: 0, contain: 1, fill: 2 };
const GLYPH_SHAPES: Record<string, number> = {
  circle: 0,
  diamond: 1,
  cross: 2,
  line: 3,
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
    '[data-webgl-experiment="dither-forge"]',
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
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uMouseOver = gl.getUniformLocation(prog, 'u_mouseOver');

  const uMouseOn = gl.getUniformLocation(prog, 'u_mouseOn');
  const uMouseRadius = gl.getUniformLocation(prog, 'u_mouseRadius');
  const uMouseOpacity = gl.getUniformLocation(prog, 'u_mouseOpacity');
  const uMouseSizeBoost = gl.getUniformLocation(prog, 'u_mouseSizeBoost');
  const uMouseBrightBoost = gl.getUniformLocation(prog, 'u_mouseBrightBoost');
  const uMouseSatBoost = gl.getUniformLocation(prog, 'u_mouseSatBoost');
  const uMouseColorShift = gl.getUniformLocation(prog, 'u_mouseColorShift');
  const uMouseReveal = gl.getUniformLocation(prog, 'u_mouseReveal');

  const uDitherOn = gl.getUniformLocation(prog, 'u_ditherOn');
  const uEdgeOn = gl.getUniformLocation(prog, 'u_edgeOn');
  const uAnimOn = gl.getUniformLocation(prog, 'u_animOn');
  const uChromaticOn = gl.getUniformLocation(prog, 'u_chromaticOn');
  const uVignetteOn = gl.getUniformLocation(prog, 'u_vignetteOn');
  const uGrainOn = gl.getUniformLocation(prog, 'u_grainOn');

  const uGlyphSize = gl.getUniformLocation(prog, 'u_glyphSize');
  const uGlyphSpacing = gl.getUniformLocation(prog, 'u_glyphSpacing');
  const uGlyphSoftness = gl.getUniformLocation(prog, 'u_glyphSoftness');
  const uGridAngle = gl.getUniformLocation(prog, 'u_gridAngle');
  const uLuminanceGamma = gl.getUniformLocation(prog, 'u_luminanceGamma');
  const uGlyphShape = gl.getUniformLocation(prog, 'u_glyphShape');
  const uInvert = gl.getUniformLocation(prog, 'u_invert');

  const uBgColor = gl.getUniformLocation(prog, 'u_bgColor');
  const uAccent1 = gl.getUniformLocation(prog, 'u_accent1');
  const uAccent2 = gl.getUniformLocation(prog, 'u_accent2');
  const uAccent3 = gl.getUniformLocation(prog, 'u_accent3');
  const uNeutral = gl.getUniformLocation(prog, 'u_neutral');
  const uColorThreshold = gl.getUniformLocation(prog, 'u_colorThreshold');
  const uColorMix = gl.getUniformLocation(prog, 'u_colorMix');
  const uGlyphHueJitter = gl.getUniformLocation(prog, 'u_glyphHueJitter');
  const uGlyphBrightJitter = gl.getUniformLocation(
    prog,
    'u_glyphBrightJitter',
  );

  const uEdgeThreshold = gl.getUniformLocation(prog, 'u_edgeThreshold');
  const uEdgeWidth = gl.getUniformLocation(prog, 'u_edgeWidth');
  const uEdgeColor = gl.getUniformLocation(prog, 'u_edgeColor');
  const uEdgeOpacity = gl.getUniformLocation(prog, 'u_edgeOpacity');

  const uChromaticOffset = gl.getUniformLocation(prog, 'u_chromaticOffset');
  const uVignetteStrength = gl.getUniformLocation(prog, 'u_vignetteStrength');
  const uVignetteSize = gl.getUniformLocation(prog, 'u_vignetteSize');
  const uGrainAmount = gl.getUniformLocation(prog, 'u_grainAmount');
  const uGrainSpeed = gl.getUniformLocation(prog, 'u_grainSpeed');

  const uAnimSpeed = gl.getUniformLocation(prog, 'u_animSpeed');
  const uAnimJitter = gl.getUniformLocation(prog, 'u_animJitter');
  const uAnimPulse = gl.getUniformLocation(prog, 'u_animPulse');

  const uBrightness = gl.getUniformLocation(prog, 'u_brightness');
  const uContrast = gl.getUniformLocation(prog, 'u_contrast');
  const uPostSaturation = gl.getUniformLocation(prog, 'u_postSaturation');

  const BP = BAKED_PARAMS;

  // Mouse tracking
  let mouseX = 0.5,
    mouseY = 0.5,
    isOver = false;
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = (e.clientX - r.left) / r.width;
    mouseY = 1.0 - (e.clientY - r.top) / r.height;
  });
  canvas.addEventListener('pointerenter', () => (isOver = true));
  canvas.addEventListener('pointerleave', () => (isOver = false));

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

    gl!.uniform1f(uHasTexture, 0.0);
    gl!.uniform2f(uTextureSize, 1.0, 1.0);
    gl!.uniform1f(uFitMode, FIT_MODES[BP.fitMode as string] ?? 0);

    gl!.uniform2f(uMouse, mouseX, mouseY);
    gl!.uniform1f(uMouseOver, isOver ? 1.0 : 0.0);

    // Mouse interaction
    gl!.uniform1f(uMouseOn, BP.mouseOn ? 1.0 : 0.0);
    gl!.uniform1f(uMouseRadius, BP.mouseRadius as number);
    gl!.uniform1f(uMouseOpacity, BP.mouseOpacity as number);
    gl!.uniform1f(uMouseSizeBoost, BP.mouseSizeBoost as number);
    gl!.uniform1f(uMouseBrightBoost, BP.mouseBrightBoost as number);
    gl!.uniform1f(uMouseSatBoost, BP.mouseSatBoost as number);
    gl!.uniform1f(uMouseColorShift, BP.mouseColorShift as number);
    gl!.uniform1f(uMouseReveal, BP.mouseReveal as number);

    // Toggles
    gl!.uniform1f(uDitherOn, BP.ditherOn ? 1.0 : 0.0);
    gl!.uniform1f(uEdgeOn, BP.edgeOn ? 1.0 : 0.0);
    gl!.uniform1f(uAnimOn, BP.animOn ? 1.0 : 0.0);
    gl!.uniform1f(uChromaticOn, BP.chromaticOn ? 1.0 : 0.0);
    gl!.uniform1f(uVignetteOn, BP.vignetteOn ? 1.0 : 0.0);
    gl!.uniform1f(uGrainOn, BP.grainOn ? 1.0 : 0.0);

    // Dither
    gl!.uniform1f(uGlyphSize, BP.glyphSize as number);
    gl!.uniform1f(uGlyphSpacing, BP.glyphSpacing as number);
    gl!.uniform1f(uGlyphSoftness, BP.glyphSoftness as number);
    gl!.uniform1f(uGridAngle, BP.gridAngle as number);
    gl!.uniform1f(uLuminanceGamma, BP.luminanceGamma as number);
    gl!.uniform1f(uGlyphShape, GLYPH_SHAPES[BP.glyphShape as string] ?? 0);
    gl!.uniform1f(uInvert, BP.invert ? 1.0 : 0.0);

    // Palette
    const bg = hex2rgb(BP.bgColor as string);
    gl!.uniform3f(uBgColor, bg[0], bg[1], bg[2]);
    const a1 = hex2rgb(BP.accent1 as string);
    gl!.uniform3f(uAccent1, a1[0], a1[1], a1[2]);
    const a2 = hex2rgb(BP.accent2 as string);
    gl!.uniform3f(uAccent2, a2[0], a2[1], a2[2]);
    const a3 = hex2rgb(BP.accent3 as string);
    gl!.uniform3f(uAccent3, a3[0], a3[1], a3[2]);
    const nt = hex2rgb(BP.neutral as string);
    gl!.uniform3f(uNeutral, nt[0], nt[1], nt[2]);
    gl!.uniform1f(uColorThreshold, BP.colorThreshold as number);
    gl!.uniform1f(uColorMix, BP.colorMix as number);
    gl!.uniform1f(uGlyphHueJitter, BP.glyphHueJitter as number);
    gl!.uniform1f(uGlyphBrightJitter, BP.glyphBrightJitter as number);

    // Edges
    gl!.uniform1f(uEdgeThreshold, BP.edgeThreshold as number);
    gl!.uniform1f(uEdgeWidth, BP.edgeWidth as number);
    const ec = hex2rgb(BP.edgeColor as string);
    gl!.uniform3f(uEdgeColor, ec[0], ec[1], ec[2]);
    gl!.uniform1f(uEdgeOpacity, BP.edgeOpacity as number);

    // Effects
    gl!.uniform1f(uChromaticOffset, BP.chromaticOffset as number);
    gl!.uniform1f(uVignetteStrength, BP.vignetteStrength as number);
    gl!.uniform1f(uVignetteSize, BP.vignetteSize as number);
    gl!.uniform1f(uGrainAmount, BP.grainAmount as number);
    gl!.uniform1f(uGrainSpeed, BP.grainSpeed as number);

    // Animation
    gl!.uniform1f(uAnimSpeed, BP.animSpeed as number);
    gl!.uniform1f(uAnimJitter, BP.animJitter as number);
    gl!.uniform1f(uAnimPulse, BP.animPulse as number);

    // Post
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
