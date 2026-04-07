// ============================================================
// Dither Forge — Inline IIFE generator for Webflow JSON export
// Produces a fully self-contained <script> string with:
//   - CONFIG block (user's current params)
//   - DIAL_CONFIG (control ranges for DialKit)
//   - Data attribute reading (data-flow-df-*)
//   - DialKit dynamic loading
//   - Full WebGL2 init, shader compilation, render loop
//   - FIT_MODES / GLYPH_SHAPES lookup maps
//   - Mouse tracking (pointermove, pointerenter, pointerleave)
// ============================================================

import fragGLSL from './shader.glsl';
import vertGLSL from '../../shaders/glsl/fullscreen-quad.vert';
import type { DialConfig } from '../../core/Experiment.ts';

export interface GenerateExportOptions {
  params: Record<string, unknown>;
  dialConfig: DialConfig;
  slug?: string;
  experimentTitle?: string;
  version?: string;
}

/**
 * Strip '#' prefix from hex color strings.
 */
function stripHash(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('#') && (value.length === 7 || value.length === 4)) {
    return value.slice(1);
  }
  return value;
}

/**
 * Check if a value is a simple primitive safe for CONFIG embedding.
 * Objects, arrays, functions, undefined etc. are NOT safe.
 */
function isExportablePrimitive(value: unknown): value is string | number | boolean {
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

/**
 * Format a JS value for embedding in the CONFIG block.
 */
function formatValue(value: string | number | boolean, key: string): string {
  // glyphShape is a string enum — keep as string
  if (key === 'glyphShape' && typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'string') {
    return `"${stripHash(value)}"`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * The set of param keys that the inline IIFE actually uses.
 * Only these get written into CONFIG. Everything else is skipped.
 */
const EXPORT_KEYS = new Set([
  'bgColor',
  'glyphSize', 'glyphSpacing', 'glyphSoftness', 'gridAngle',
  'luminanceGamma', 'glyphShape', 'invert',
  'accent1', 'accent2', 'accent3', 'neutral',
  'colorThreshold', 'colorMix', 'glyphHueJitter', 'glyphBrightJitter',
  'edgeOn', 'edgeThreshold', 'edgeWidth', 'edgeColor', 'edgeOpacity',
  'mouseOn', 'mouseRadius', 'mouseOpacity',
  'mouseSizeBoost', 'mouseBrightBoost', 'mouseSatBoost',
  'mouseColorShift', 'mouseReveal',
  'chromaticOn', 'chromaticOffset',
  'vignetteOn', 'vignetteStrength', 'vignetteSize',
  'grainOn', 'grainAmount', 'grainSpeed',
  'ditherOn',
  'animOn', 'animSpeed', 'animJitter', 'animPulse',
  'brightness', 'contrast', 'postSaturation',
  'dialKit',
]);

/** Boolean param keys — written as true/false literals in CONFIG */
const BOOLEAN_KEYS = new Set([
  'invert', 'ditherOn', 'edgeOn', 'mouseOn',
  'chromaticOn', 'vignetteOn', 'grainOn', 'animOn',
]);

/**
 * Build the CONFIG block string from current params.
 * Colors are stored without '#' prefix.
 * Only includes keys that the IIFE actually reads — everything else is dropped.
 */
function buildConfigBlock(params: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (!EXPORT_KEYS.has(key)) continue;
    if (!isExportablePrimitive(value)) continue;

    // Force booleans for toggle keys even if they arrive as something else
    if (BOOLEAN_KEYS.has(key)) {
      lines.push(`  ${key}: ${value ? 'true' : 'false'},`);
    } else {
      lines.push(`  ${key}: ${formatValue(value, key)},`);
    }
  }

  // Ensure dialKit is always present and false
  if (!lines.some((l) => l.trimStart().startsWith('dialKit'))) {
    lines.push(`  dialKit: false,`);
  }

  return `var CONFIG = {\n${lines.join('\n')}\n};`;
}

/**
 * Build the DIAL_CONFIG block for the visual editor.
 * Serializes folder structure with ranges.
 */
function buildDialConfigBlock(dialConfig: DialConfig): string {
  // Filter out folders that aren't relevant for inline export
  const skipFolders = new Set(['Spring Slider', 'Scrub Field', 'Ring Slider', 'Animation', 'Seed', 'Source']);

  const folders: string[] = [];

  for (const [folderName, controls] of Object.entries(dialConfig)) {
    if (skipFolders.has(folderName)) continue;

    const entries: string[] = [];
    for (const [key, value] of Object.entries(controls)) {
      if (typeof value === 'string') {
        // Color — strip hash
        entries.push(`      ${key}: "${stripHash(value)}",`);
      } else if (typeof value === 'boolean') {
        entries.push(`      ${key}: ${value},`);
      } else if (Array.isArray(value)) {
        // Range: [default, min, max, step]
        const vals = value.map((v) => {
          if (typeof v === 'string') return `"${stripHash(v)}"`;
          return String(v);
        });
        entries.push(`      ${key}: [${vals.join(', ')}],`);
      }
      // Skip object-type entries (custom slider configs, select, action)
    }

    if (entries.length > 0) {
      folders.push(`    "${folderName}": {\n${entries.join('\n')}\n    },`);
    }
  }

  return `var DIAL_CONFIG = {\n${folders.join('\n')}\n  };`;
}

/**
 * Generate the complete inline IIFE as a <script> string.
 * This is the JavaScript that goes inside the Webflow JSON HtmlEmbed.
 */
export function generateExport(options: GenerateExportOptions): string {
  const {
    params,
    dialConfig,
    slug = 'dither-forge',
    experimentTitle = 'Dither Forge',
    version = 'v1',
  } = options;

  const configBlock = buildConfigBlock(params);
  const dialConfigBlock = buildDialConfigBlock(dialConfig);

  // Escape backticks and ${} in shader source for embedding in template literal
  const escapedVert = vertGLSL
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
  const escapedFrag = fragGLSL
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');

  return `<script>
// =============================================
// Flowing — ${experimentTitle} ${version}
// =============================================
// Edit these values to customize the effect.
// Connect Webflow component properties to
// data-flow-${slug}-* attributes on the wrapper div.
// Set dialKit to true to load the visual editor.
// =============================================

(function() {
  ${configBlock}

  ${dialConfigBlock}

  var FIT_MODES = { cover: 0, contain: 1, fill: 2 };
  var GLYPH_SHAPES = { circle: 0, diamond: 1, cross: 2, line: 3 };

  // Find canvas via data-flow-${slug} — scoped to parent wrapper
  var wrapper = document.currentScript ? document.currentScript.parentElement : null;
  if (wrapper) wrapper = wrapper.parentElement; // HtmlEmbed div -> wrapper div
  var canvas = wrapper ? wrapper.querySelector("canvas[data-flow-${slug}]") : null;
  if (!canvas) canvas = document.querySelector("canvas[data-flow-${slug}]");
  if (!canvas) return;
  if (!wrapper) wrapper = canvas.parentElement;

  // ── Params: data attributes override CONFIG ──
  var P = {};
  for (var key in CONFIG) {
    P[key] = CONFIG[key];
    var kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    var attr = wrapper.getAttribute("data-flow-${slug}-" + kebab);
    if (attr !== null) {
      if (typeof CONFIG[key] === "number") {
        P[key] = Number(attr);
      } else if (typeof CONFIG[key] === "boolean" || CONFIG[key] === "true" || CONFIG[key] === "false") {
        P[key] = attr === "true";
      } else {
        P[key] = attr;
      }
    }
  }

  // ── Optional DialKit loading ──
  if (
    P.dialKit === true ||
    P.dialKit === "true" ||
    wrapper.getAttribute("data-flow-${slug}-dial-kit") === "true"
  ) {
    var s = document.createElement("script");
    s.src = "https://webgl-experiments.vercel.app/exports/dialkit-standalone.js";
    s.onload = function() {
      if (window.FlowDialKit) {
        window.FlowDialKit.create(P, DIAL_CONFIG, function(updated) {
          for (var k in updated) P[k] = updated[k];
        });
      }
    };
    document.head.appendChild(s);
  }

  // ── Color helper ──
  function hex2rgb(h) {
    if (h.charAt(0) === "#") h = h.slice(1);
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }

  // ── Mouse tracking ──
  var mouseX = 0.5, mouseY = 0.5, isOver = false;
  canvas.addEventListener("pointermove", function(e) {
    var rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) / rect.width;
    mouseY = 1.0 - (e.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener("pointerenter", function() { isOver = true; });
  canvas.addEventListener("pointerleave", function() { isOver = false; });

  // ── WebGL2 init ──
  var gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false
  });
  if (!gl) return;

  var VERT = \`${escapedVert}\`;

  var FRAG = \`${escapedFrag}\`;

  // Compile shader
  function mkShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Shader error:", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = mkShader(gl.VERTEX_SHADER, VERT);
  var fs = mkShader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(prog));
    return;
  }

  // Fullscreen quad
  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "a_pos");
  if (aPos === -1) aPos = gl.getAttribLocation(prog, "a_position");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Uniform locations
  var U = {};
  var uNames = [
    "u_time", "u_resolution", "u_hasTexture", "u_textureSize", "u_fitMode",
    "u_mouse", "u_mouseOver",
    "u_mouseOn", "u_mouseRadius", "u_mouseOpacity",
    "u_mouseSizeBoost", "u_mouseBrightBoost", "u_mouseSatBoost",
    "u_mouseColorShift", "u_mouseReveal",
    "u_ditherOn", "u_edgeOn", "u_animOn", "u_chromaticOn", "u_vignetteOn", "u_grainOn",
    "u_glyphSize", "u_glyphSpacing", "u_glyphSoftness",
    "u_gridAngle", "u_luminanceGamma", "u_glyphShape", "u_invert",
    "u_bgColor", "u_accent1", "u_accent2", "u_accent3", "u_neutral",
    "u_colorThreshold", "u_colorMix", "u_glyphHueJitter", "u_glyphBrightJitter",
    "u_edgeThreshold", "u_edgeWidth", "u_edgeColor", "u_edgeOpacity",
    "u_chromaticOffset", "u_vignetteStrength", "u_vignetteSize",
    "u_grainAmount", "u_grainSpeed",
    "u_animSpeed", "u_animJitter", "u_animPulse",
    "u_brightness", "u_contrast", "u_postSaturation"
  ];
  for (var i = 0; i < uNames.length; i++) {
    U[uNames[i]] = gl.getUniformLocation(prog, uNames[i]);
  }

  // Resize
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  var ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Render loop
  var accTime = 0;
  var lastTime = performance.now();

  function render() {
    var now = performance.now();
    var dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt;

    gl.useProgram(prog);

    // Core
    gl.uniform1f(U.u_time, accTime);
    gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

    // No texture in inline export
    gl.uniform1f(U.u_hasTexture, 0.0);
    gl.uniform2f(U.u_textureSize, 1.0, 1.0);
    gl.uniform1f(U.u_fitMode, FIT_MODES[P.fitMode] || 0);

    // Mouse
    gl.uniform2f(U.u_mouse, mouseX, mouseY);
    gl.uniform1f(U.u_mouseOver, isOver ? 1.0 : 0.0);
    gl.uniform1f(U.u_mouseOn, P.mouseOn ? 1.0 : 0.0);
    gl.uniform1f(U.u_mouseRadius, P.mouseRadius);
    gl.uniform1f(U.u_mouseOpacity, P.mouseOpacity);
    gl.uniform1f(U.u_mouseSizeBoost, P.mouseSizeBoost);
    gl.uniform1f(U.u_mouseBrightBoost, P.mouseBrightBoost);
    gl.uniform1f(U.u_mouseSatBoost, P.mouseSatBoost);
    gl.uniform1f(U.u_mouseColorShift, P.mouseColorShift);
    gl.uniform1f(U.u_mouseReveal, P.mouseReveal);

    // Layer toggles
    gl.uniform1f(U.u_ditherOn, P.ditherOn ? 1.0 : 0.0);
    gl.uniform1f(U.u_edgeOn, P.edgeOn ? 1.0 : 0.0);
    gl.uniform1f(U.u_animOn, P.animOn ? 1.0 : 0.0);
    gl.uniform1f(U.u_chromaticOn, P.chromaticOn ? 1.0 : 0.0);
    gl.uniform1f(U.u_vignetteOn, P.vignetteOn ? 1.0 : 0.0);
    gl.uniform1f(U.u_grainOn, P.grainOn ? 1.0 : 0.0);

    // Dither
    gl.uniform1f(U.u_glyphSize, P.glyphSize);
    gl.uniform1f(U.u_glyphSpacing, P.glyphSpacing);
    gl.uniform1f(U.u_glyphSoftness, P.glyphSoftness);
    gl.uniform1f(U.u_gridAngle, P.gridAngle);
    gl.uniform1f(U.u_luminanceGamma, P.luminanceGamma);
    gl.uniform1f(U.u_glyphShape, GLYPH_SHAPES[P.glyphShape] || 0);
    gl.uniform1f(U.u_invert, P.invert ? 1.0 : 0.0);

    // Palette (colors via hex2rgb)
    var bg = hex2rgb(P.bgColor);
    gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
    var a1 = hex2rgb(P.accent1);
    gl.uniform3f(U.u_accent1, a1[0], a1[1], a1[2]);
    var a2 = hex2rgb(P.accent2);
    gl.uniform3f(U.u_accent2, a2[0], a2[1], a2[2]);
    var a3 = hex2rgb(P.accent3);
    gl.uniform3f(U.u_accent3, a3[0], a3[1], a3[2]);
    var nt = hex2rgb(P.neutral);
    gl.uniform3f(U.u_neutral, nt[0], nt[1], nt[2]);
    gl.uniform1f(U.u_colorThreshold, P.colorThreshold);
    gl.uniform1f(U.u_colorMix, P.colorMix);
    gl.uniform1f(U.u_glyphHueJitter, P.glyphHueJitter);
    gl.uniform1f(U.u_glyphBrightJitter, P.glyphBrightJitter);

    // Edges
    gl.uniform1f(U.u_edgeThreshold, P.edgeThreshold);
    gl.uniform1f(U.u_edgeWidth, P.edgeWidth);
    var ec = hex2rgb(P.edgeColor);
    gl.uniform3f(U.u_edgeColor, ec[0], ec[1], ec[2]);
    gl.uniform1f(U.u_edgeOpacity, P.edgeOpacity);

    // Chromatic
    gl.uniform1f(U.u_chromaticOffset, P.chromaticOffset);

    // Vignette
    gl.uniform1f(U.u_vignetteStrength, P.vignetteStrength);
    gl.uniform1f(U.u_vignetteSize, P.vignetteSize);

    // Grain
    gl.uniform1f(U.u_grainAmount, P.grainAmount);
    gl.uniform1f(U.u_grainSpeed, P.grainSpeed);

    // Animation
    gl.uniform1f(U.u_animSpeed, P.animSpeed);
    gl.uniform1f(U.u_animJitter, P.animJitter);
    gl.uniform1f(U.u_animPulse, P.animPulse);

    // Post
    gl.uniform1f(U.u_brightness, P.brightness);
    gl.uniform1f(U.u_contrast, P.contrast);
    gl.uniform1f(U.u_postSaturation, P.postSaturation);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
</script>`;
}
