// ============================================================
// Bloom Dither — Inline IIFE generator for Webflow JSON export
// Produces a fully self-contained <script> string with:
//   - CONFIG block (user's current params)
//   - DIAL_CONFIG (control ranges for DialKit)
//   - Data attribute reading (data-flow-ft-*)
//   - DialKit dynamic loading
//   - Full WebGL2 init, shader compilation, render loop
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
function formatValue(value: string | number | boolean): string {
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
  'branchScale', 'branchThickness', 'branchColor',
  'flowerSize', 'flowerColor', 'petalCount',
  'glowIntensity', 'glowColor', 'glowRadius',
  'ditherSize',
  'seed', 'animSpeed',
  'dialKit',
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
    lines.push(`  ${key}: ${formatValue(value)},`);
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
  // Filter out folders that aren't relevant for export
  const skipFolders = new Set(['Animation', 'Seed']);

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
        // Strip hash from default if it's a color string
        const vals = value.map((v) => {
          if (typeof v === 'string') return `"${stripHash(v)}"`;
          return String(v);
        });
        entries.push(`      ${key}: [${vals.join(', ')}],`);
      }
      // Skip object-type entries (custom slider configs like { type: 'ub-1', ... })
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
    slug = 'bloom-dither',
    experimentTitle = 'Bloom Dither',
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
// data-flow-ft-* attributes on the wrapper div.
// Set dialKit to true to load the visual editor.
// =============================================

(function() {
  ${configBlock}

  ${dialConfigBlock}

  // Find canvas via data-flow-${slug} — scoped to parent wrapper
  var wrapper = document.currentScript ? document.currentScript.parentElement : null;
  if (wrapper) wrapper = wrapper.parentElement; // HtmlEmbed div → wrapper div
  var canvas = wrapper ? wrapper.querySelector("canvas[data-flow-${slug}]") : null;
  if (!canvas) canvas = document.querySelector("canvas[data-flow-${slug}]");
  if (!canvas) return;
  if (!wrapper) wrapper = canvas.parentElement;

  // ── Params: data attributes override CONFIG ──
  var P = {};
  for (var key in CONFIG) {
    P[key] = CONFIG[key];
    var kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    var attr = wrapper.getAttribute("data-flow-ft-" + kebab);
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
    wrapper.getAttribute("data-flow-ft-dial-kit") === "true"
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
    "u_time", "u_resolution",
    "u_branchOn", "u_flowerOn", "u_glowOn", "u_ditherOn",
    "u_branchScale", "u_branchThickness", "u_branchColor",
    "u_flowerSize", "u_flowerColor", "u_petalCount",
    "u_glowIntensity", "u_glowColor", "u_glowRadius",
    "u_ditherSize",
    "u_progress", "u_seed", "u_bgColor"
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

    var progress = Math.min(1.0, accTime * P.animSpeed);

    gl.useProgram(prog);

    gl.uniform1f(U.u_time, accTime);
    gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

    // Layer toggles — all on
    gl.uniform1f(U.u_branchOn, 1.0);
    gl.uniform1f(U.u_flowerOn, 1.0);
    gl.uniform1f(U.u_glowOn, 1.0);
    gl.uniform1f(U.u_ditherOn, 1.0);

    // Branches
    gl.uniform1f(U.u_branchScale, P.branchScale);
    gl.uniform1f(U.u_branchThickness, P.branchThickness);
    var bc = hex2rgb(P.branchColor);
    gl.uniform3f(U.u_branchColor, bc[0], bc[1], bc[2]);

    // Flowers
    gl.uniform1f(U.u_flowerSize, P.flowerSize);
    var fc = hex2rgb(P.flowerColor);
    gl.uniform3f(U.u_flowerColor, fc[0], fc[1], fc[2]);
    gl.uniform1f(U.u_petalCount, P.petalCount);

    // Glow
    gl.uniform1f(U.u_glowIntensity, P.glowIntensity);
    var gc = hex2rgb(P.glowColor);
    gl.uniform3f(U.u_glowColor, gc[0], gc[1], gc[2]);
    gl.uniform1f(U.u_glowRadius, P.glowRadius);

    // Dither
    gl.uniform1f(U.u_ditherSize, P.ditherSize);

    // General
    gl.uniform1f(U.u_progress, progress);
    gl.uniform1f(U.u_seed, P.seed);
    var bg = hex2rgb(P.bgColor);
    gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
</script>`;
}
