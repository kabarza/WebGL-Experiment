// ============================================================
// aurora drift — Inline IIFE generator for Webflow JSON export
// Mirrors standalone.ts but returns a self-contained <script> string.
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

function stripHash(value: unknown): unknown {
  if (typeof value === 'string' && value.startsWith('#') && (value.length === 7 || value.length === 4)) {
    return value.slice(1);
  }
  return value;
}

function isExportablePrimitive(value: unknown): value is string | number | boolean {
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

function formatValue(value: string | number | boolean): string {
  if (typeof value === 'string') return `"${stripHash(value)}"`;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// Only these keys are read by the inline IIFE below. Anything else is dropped.
const EXPORT_KEYS = new Set([
  'color1', 'color2', 'color3', 'color4', 'bgColor', 'colorShift',
  'warpOn', 'warpStrength', 'warpScale', 'warpOctaves', 'seed', 'seedSpeed',
  'blobOn', 'blobCount', 'blobSize', 'blobSpacing', 'blobRotation', 'blobSpread',
  'blobOffsetX', 'blobOffsetY', 'tileSpacing', 'blendSoftness', 'autoRotation',
  'zoom', 'offsetX', 'offsetY',
  'mouseOn', 'mouseMode', 'mouseStrength', 'mouseRadius',
  'mouseWindDecay', 'mouseWindGain',
  'pulseStrength', 'pulseDecay', 'pulseSpeed', 'pulseWidth',
  'grainOn', 'grainAmount', 'grainScale', 'grainSpeed',
  'speed',
  'dialKit',
]);

function buildConfigBlock(params: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (!EXPORT_KEYS.has(key)) continue;
    if (!isExportablePrimitive(value)) continue;
    lines.push(`  ${key}: ${formatValue(value)},`);
  }
  if (!lines.some((l) => l.trimStart().startsWith('dialKit'))) {
    lines.push(`  dialKit: false,`);
  }
  return `var CONFIG = {\n${lines.join('\n')}\n};`;
}

function buildDialConfigBlock(dialConfig: DialConfig): string {
  const skipFolders = new Set(['Spring Slider', 'Scrub Field', 'Ring Slider', 'Animation']);
  const folders: string[] = [];

  for (const [folderName, controls] of Object.entries(dialConfig)) {
    if (skipFolders.has(folderName)) continue;
    const entries: string[] = [];
    for (const [key, value] of Object.entries(controls)) {
      if (typeof value === 'string') {
        entries.push(`      ${key}: "${stripHash(value)}",`);
      } else if (typeof value === 'boolean') {
        entries.push(`      ${key}: ${value},`);
      } else if (Array.isArray(value)) {
        const vals = value.map((v) =>
          typeof v === 'string' ? `"${stripHash(v)}"` : String(v),
        );
        entries.push(`      ${key}: [${vals.join(', ')}],`);
      }
      // Skip object-type entries (select dropdowns, custom slider configs, etc.)
    }
    if (entries.length > 0) {
      folders.push(`    "${folderName}": {\n${entries.join('\n')}\n    },`);
    }
  }
  return `var DIAL_CONFIG = {\n${folders.join('\n')}\n  };`;
}

export function generateExport(options: GenerateExportOptions): string {
  const {
    params,
    dialConfig,
    slug = 'aurora-drift',
    experimentTitle = 'Aurora Drift',
    version = 'v1',
  } = options;

  const configBlock = buildConfigBlock(params);
  const dialConfigBlock = buildDialConfigBlock(dialConfig);

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

  var MOUSE_MODE_ID = { Breeze: 0, Swell: 1, Tide: 2, Parallax: 3, Shimmer: 4 };

  var wrapper = document.currentScript ? document.currentScript.parentElement : null;
  if (wrapper) wrapper = wrapper.parentElement;
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
      if (typeof CONFIG[key] === "number") P[key] = Number(attr);
      else if (typeof CONFIG[key] === "boolean" || attr === "true" || attr === "false") P[key] = attr === "true";
      else P[key] = attr;
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

  function hex2rgb(h) {
    if (h.charAt(0) === "#") h = h.slice(1);
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }

  var gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false });
  if (!gl) return;

  var VERT = \`${escapedVert}\`;
  var FRAG = \`${escapedFrag}\`;

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

  var U = {};
  var uNames = [
    "u_time", "u_resolution",
    "u_color1", "u_color2", "u_color3", "u_color4", "u_bgColor",
    "u_warpOn", "u_warpStrength", "u_warpScale", "u_warpOctaves", "u_seed", "u_seedSpeed",
    "u_blobOn", "u_blobSize", "u_blobSpacing", "u_blobRotation", "u_blobSpread",
    "u_blobOffsetX", "u_blobOffsetY", "u_tileSpacing",
    "u_blobCount", "u_blendSoftness", "u_autoRotation",
    "u_colorShift",
    "u_zoom", "u_offsetX", "u_offsetY",
    "u_mouseOn", "u_mousePos", "u_mouseWind", "u_mouseStr", "u_mouseRadius", "u_mouseMode",
    "u_pulsePos", "u_pulseStr", "u_pulseAge", "u_pulseSpeed", "u_pulseWidth",
    "u_grainOn", "u_grainAmount", "u_grainScale", "u_grainSpeed"
  ];
  for (var i = 0; i < uNames.length; i++) U[uNames[i]] = gl.getUniformLocation(prog, uNames[i]);

  // Mouse + wind state
  var mx = 0.5, my = 0.5, prevMx = 0.5, prevMy = 0.5;
  var windX = 0, windY = 0;
  var pulseX = 0.5, pulseY = 0.5, pulseAge = 999, pulseActive = false;

  canvas.addEventListener("pointermove", function(e) {
    var rect = canvas.getBoundingClientRect();
    mx = (e.clientX - rect.left) / rect.width;
    my = 1.0 - (e.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener("pointerdown", function() {
    pulseX = mx;
    pulseY = my;
    pulseAge = 0;
    pulseActive = true;
  });

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

  var accTime = 0;
  var lastTime = performance.now();

  function render() {
    var now = performance.now();
    var dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt * (P.speed != null ? P.speed : 1);

    // Wind vector — accumulate velocity, decay each frame
    var windDecay = Math.max(0, Math.min(0.995, P.mouseWindDecay != null ? P.mouseWindDecay : 0.92));
    var windGain = P.mouseWindGain != null ? P.mouseWindGain : 3.0;
    var vx = mx - prevMx;
    var vy = my - prevMy;
    prevMx = mx;
    prevMy = my;
    windX = windX * windDecay + vx * windGain;
    windY = windY * windDecay + vy * windGain;

    // Pulse decay
    var currentPulseStr = 0;
    if (pulseActive) {
      pulseAge += dt;
      var pDecay = Math.max(P.pulseDecay, 0.001);
      var life = pulseAge / pDecay;
      if (life >= 1) pulseActive = false;
      else {
        var fade = 1 - life;
        currentPulseStr = P.pulseStrength * fade * fade * fade;
      }
    }

    var mouseOn = P.mouseOn === true || P.mouseOn === "true";
    var modeId = MOUSE_MODE_ID[P.mouseMode] != null ? MOUSE_MODE_ID[P.mouseMode] : 2;

    gl.useProgram(prog);

    gl.uniform1f(U.u_time, accTime);
    gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

    var c1 = hex2rgb(P.color1), c2 = hex2rgb(P.color2), c3 = hex2rgb(P.color3), c4 = hex2rgb(P.color4);
    var bg = hex2rgb(P.bgColor);
    gl.uniform3f(U.u_color1, c1[0], c1[1], c1[2]);
    gl.uniform3f(U.u_color2, c2[0], c2[1], c2[2]);
    gl.uniform3f(U.u_color3, c3[0], c3[1], c3[2]);
    gl.uniform3f(U.u_color4, c4[0], c4[1], c4[2]);
    gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);
    gl.uniform1f(U.u_colorShift, P.colorShift);

    gl.uniform1f(U.u_warpOn, (P.warpOn === true || P.warpOn === "true") ? 1.0 : 0.0);
    gl.uniform1f(U.u_warpStrength, P.warpStrength);
    gl.uniform1f(U.u_warpScale, P.warpScale);
    gl.uniform1f(U.u_warpOctaves, P.warpOctaves);
    gl.uniform1f(U.u_seed, P.seed);
    gl.uniform1f(U.u_seedSpeed, P.seedSpeed);

    gl.uniform1f(U.u_blobOn, (P.blobOn === true || P.blobOn === "true") ? 1.0 : 0.0);
    gl.uniform1f(U.u_blobCount, P.blobCount);
    gl.uniform1f(U.u_blobSize, P.blobSize);
    gl.uniform1f(U.u_blobSpacing, P.blobSpacing);
    gl.uniform1f(U.u_blendSoftness, P.blendSoftness);
    gl.uniform1f(U.u_blobRotation, P.blobRotation);
    gl.uniform1f(U.u_autoRotation, P.autoRotation);
    gl.uniform1f(U.u_blobSpread, P.blobSpread);
    gl.uniform1f(U.u_blobOffsetX, P.blobOffsetX);
    gl.uniform1f(U.u_blobOffsetY, P.blobOffsetY);
    gl.uniform1f(U.u_tileSpacing, P.tileSpacing);

    gl.uniform1f(U.u_zoom, P.zoom);
    gl.uniform1f(U.u_offsetX, P.offsetX);
    gl.uniform1f(U.u_offsetY, P.offsetY);

    gl.uniform1f(U.u_mouseOn, mouseOn ? 1.0 : 0.0);
    gl.uniform2f(U.u_mousePos, mx, my);
    gl.uniform2f(U.u_mouseWind, windX, windY);
    gl.uniform1f(U.u_mouseStr, mouseOn ? P.mouseStrength : 0);
    gl.uniform1f(U.u_mouseRadius, P.mouseRadius);
    gl.uniform1f(U.u_mouseMode, modeId);

    gl.uniform2f(U.u_pulsePos, pulseX, pulseY);
    gl.uniform1f(U.u_pulseStr, mouseOn ? currentPulseStr : 0);
    gl.uniform1f(U.u_pulseAge, pulseAge);
    gl.uniform1f(U.u_pulseSpeed, P.pulseSpeed);
    gl.uniform1f(U.u_pulseWidth, P.pulseWidth);

    gl.uniform1f(U.u_grainOn, (P.grainOn === true || P.grainOn === "true") ? 1.0 : 0.0);
    gl.uniform1f(U.u_grainAmount, P.grainAmount);
    gl.uniform1f(U.u_grainScale, P.grainScale);
    gl.uniform1f(U.u_grainSpeed, P.grainSpeed);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
</script>`;
}
