// ============================================================
// Flare-1 — Inline IIFE generator for Webflow JSON export
// Produces a fully self-contained <script> string with:
//   - CONFIG block (user's current params)
//   - DIAL_CONFIG (control ranges for DialKit)
//   - Data attribute reading (data-flow-ft-*)
//   - DialKit dynamic loading
//   - Full WebGL2 init: ring FBO + main quad + dot sprites
// ============================================================

import fragGLSL     from './shader.glsl';
import vertGLSL     from '../../shaders/glsl/fullscreen-quad.vert';
import ringBaseFrag from './ring-base.frag';
import dotsVert     from './dots.vert';
import dotsFrag     from './dots.frag';
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

const EXPORT_KEYS = new Set([
  'bgColor',
  'auroraScale', 'auroraSpeed', 'auroraWarp',
  'auroraIntensity', 'auroraBlend',
  'auroraOffsetX', 'auroraOffsetY',
  'color1', 'color2', 'color3',
  'ringX', 'ringY', 'ringRadius', 'ringEdge', 'ringOpacity',
  'dotCount', 'dotSize', 'dotBlink', 'dotRotate', 'dotSpeed',
  'flareIntensity', 'flareSpread', 'flareSoftness',
  'flareRainbow', 'flareCount', 'flareAngle', 'flareGlow',
  'grainAmount', 'grainSize', 'grainSpeed',
  'brightness', 'contrast', 'saturation', 'vignette',
  'dialKit',
]);
for (let i = 1; i <= 8; i += 1) {
  EXPORT_KEYS.add(`flare${i}On`);
  EXPORT_KEYS.add(`flare${i}X`);
  EXPORT_KEYS.add(`flare${i}Y`);
  EXPORT_KEYS.add(`flare${i}Angle`);
  EXPORT_KEYS.add(`flare${i}Intensity`);
  EXPORT_KEYS.add(`flare${i}Spread`);
  EXPORT_KEYS.add(`flare${i}Softness`);
  EXPORT_KEYS.add(`flare${i}Rainbow`);
  EXPORT_KEYS.add(`flare${i}Glow`);
}

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
        const vals = value.map((v) => {
          if (typeof v === 'string') return `"${stripHash(v)}"`;
          return String(v);
        });
        entries.push(`      ${key}: [${vals.join(', ')}],`);
      }
    }
    if (entries.length > 0) {
      folders.push(`    "${folderName}": {\n${entries.join('\n')}\n    },`);
    }
  }

  return `var DIAL_CONFIG = {\n${folders.join('\n')}\n  };`;
}

function esc(src: string): string {
  return src
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

export function generateExport(options: GenerateExportOptions): string {
  const {
    params,
    dialConfig,
    slug = 'flare-1',
    experimentTitle = 'Flare-1',
    version = 'v1',
  } = options;

  const configBlock     = buildConfigBlock(params);
  const dialConfigBlock = buildDialConfigBlock(dialConfig);

  const escapedVert     = esc(vertGLSL);
  const escapedFrag     = esc(fragGLSL);
  const escapedRingBase = esc(ringBaseFrag);
  const escapedDotsVert = esc(dotsVert);
  const escapedDotsFrag = esc(dotsFrag);

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

  // ── Helpers ──
  function hex2rgb(h) {
    if (h.charAt(0) === "#") h = h.slice(1);
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255
    ];
  }
  function num(v, fb) {
    if (typeof v === "number" && isFinite(v)) return v;
    var p = Number(v); return isFinite(p) ? p : fb;
  }
  function bool(v, fb) { return typeof v === "boolean" ? v : fb; }

  // ── WebGL2 init ──
  var gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false
  });
  if (!gl) return;

  var MAX_FLARES   = 8;
  var MAX_DOTS     = 300;
  var GOLDEN_ANGLE = 2.399963;

  var VERT      = \`${escapedVert}\`;
  var FRAG      = \`${escapedFrag}\`;
  var RING_BASE = \`${escapedRingBase}\`;
  var DOTS_VERT = \`${escapedDotsVert}\`;
  var DOTS_FRAG = \`${escapedDotsFrag}\`;

  function mkShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error("Shader error:", gl.getShaderInfoLog(s));
      gl.deleteShader(s); return null;
    }
    return s;
  }
  function mkProg(vert, frag) {
    var vs = mkShader(gl.VERTEX_SHADER, vert);
    var fs = mkShader(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("Link error:", gl.getProgramInfoLog(prog)); return null;
    }
    return prog;
  }

  var ringBaseProg = mkProg(VERT, RING_BASE);
  var mainProg     = mkProg(VERT, FRAG);
  var dotsProg     = mkProg(DOTS_VERT, DOTS_FRAG);
  if (!ringBaseProg || !mainProg || !dotsProg) return;

  // Fullscreen quad buffer (shared by ring-base and main passes)
  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

  function bindQuad(prog) {
    var loc = gl.getAttribLocation(prog, "a_pos");
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }

  // Ring-base uniforms
  var RU = {};
  ["u_resolution","u_ringCenter","u_ringRadius","u_ringEdge"].forEach(function(n) {
    RU[n] = gl.getUniformLocation(ringBaseProg, n);
  });

  // Main program uniforms
  var U = {};
  [
    "u_time","u_resolution",
    "u_auroraOn","u_ringOn","u_flareOn","u_grainOn",
    "u_auroraScale","u_auroraSpeed","u_auroraWarp",
    "u_auroraIntensity","u_auroraBlend",
    "u_auroraOffsetX","u_auroraOffsetY",
    "u_col1","u_col2","u_col3",
    "u_ringTex","u_ringOpacity",
    "u_flareIntensity","u_flareSpread","u_flareSoftness",
    "u_flareRainbow","u_flareCount","u_flareAngle","u_flareGlow",
    "u_flarePos[0]","u_flareParamsA[0]","u_flareParamsB[0]",
    "u_grainAmount","u_grainSize","u_grainSpeed",
    "u_brightness","u_contrast","u_saturation","u_vignette","u_bgColor"
  ].forEach(function(n) { U[n] = gl.getUniformLocation(mainProg, n); });

  // Dots program uniforms
  var DU = {};
  ["u_resolution","u_ringCenter","u_ringRadius","u_ringEdge",
   "u_dotSize","u_dotSpeed","u_dotBlink","u_dotRotate",
   "u_dotOpacity","u_time"].forEach(function(n) {
    DU[n] = gl.getUniformLocation(dotsProg, n);
  });

  // ── FBO ──
  var ringFboTex = null, ringFbo = null, fboW = 0, fboH = 0;
  var ringFboDirty = true;
  var lastRingGeom = { x: NaN, y: NaN, radius: NaN, edge: NaN };

  function createRingFBO(w, h) {
    if (ringFboTex) gl.deleteTexture(ringFboTex);
    if (ringFbo)    gl.deleteFramebuffer(ringFbo);
    ringFboTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ringFboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    ringFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ringFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ringFboTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    fboW = w; fboH = h;
  }

  function checkRingDirty(p) {
    var g = { x: p.ringX, y: p.ringY, radius: p.ringRadius, edge: p.ringEdge };
    if (g.x !== lastRingGeom.x || g.y !== lastRingGeom.y ||
        g.radius !== lastRingGeom.radius || g.edge !== lastRingGeom.edge) {
      lastRingGeom = g; return true;
    }
    return false;
  }

  function renderRingFBO(p) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, ringFbo);
    gl.viewport(0, 0, fboW, fboH);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(ringBaseProg);
    gl.uniform2f(RU.u_resolution, fboW, fboH);
    gl.uniform2f(RU.u_ringCenter, p.ringX, p.ringY);
    gl.uniform1f(RU.u_ringRadius, p.ringRadius);
    gl.uniform1f(RU.u_ringEdge, p.ringEdge);
    bindQuad(ringBaseProg);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ── Dot VBO ──
  var dotVbo = null, dotVao = null, activeDotCount = 0, lastDotCount = -1;

  function buildDotVBO(count) {
    var N = Math.min(Math.max(count, 0), MAX_DOTS);
    activeDotCount = N;
    var data = new Float32Array(N * 4);
    for (var i = 0; i < N; i++) {
      var h0 = Math.abs(Math.sin(i * 127.1 + 311.7)) % 1;
      var h1 = Math.abs(Math.sin(i * 269.5 + 183.3)) % 1;
      var h2 = Math.abs(Math.sin(i * 419.2 +  71.1)) % 1;
      var h3 = Math.abs(Math.sin(i * 537.9 + 253.6)) % 1;
      data[i*4+0] = i * GOLDEN_ANGLE + h0 * 0.5;
      data[i*4+1] = (h1 - 0.5) * 2.0;
      data[i*4+2] = 0.4 + h2 * 0.6;
      data[i*4+3] = h3 * 6.2832;
    }
    if (!dotVbo) dotVbo = gl.createBuffer();
    if (!dotVao) {
      dotVao = gl.createVertexArray();
      gl.bindVertexArray(dotVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, dotVbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      var attribs = [["a_angle",0],["a_rOffset",4],["a_size",8],["a_phase",12]];
      attribs.forEach(function(a) {
        var loc = gl.getAttribLocation(dotsProg, a[0]);
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 16, a[1]);
        }
      });
      gl.bindVertexArray(null);
    } else {
      gl.bindBuffer(gl.ARRAY_BUFFER, dotVbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    }
  }

  var flarePosData     = new Float32Array(MAX_FLARES * 2);
  var flareParamsAData = new Float32Array(MAX_FLARES * 4);
  var flareParamsBData = new Float32Array(MAX_FLARES * 3);

  // ── Resize ──
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width  * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    createRingFBO(canvas.width, canvas.height);
    ringFboDirty = true;
  }
  var ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Initial dot build
  var initDots = num(P.dotCount, 120);
  buildDotVBO(initDots);
  lastDotCount = initDots;

  // ── Render loop ──
  var accTime = 0, lastTime = performance.now();

  function render() {
    var now = performance.now();
    var dt  = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt;

    if (checkRingDirty(P)) ringFboDirty = true;
    var newDots = num(P.dotCount, 120);
    if (newDots !== lastDotCount) { buildDotVBO(newDots); lastDotCount = newDots; }

    var ringOn = bool(P.ringOn, true);

    // Pass A — ring FBO (conditional)
    if (ringOn && ringFboDirty) { renderRingFBO(P); ringFboDirty = false; }

    // Pass B — main quad
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(mainProg);

    gl.uniform1f(U.u_time, accTime);
    gl.uniform2f(U.u_resolution, canvas.width, canvas.height);

    gl.uniform1f(U.u_auroraOn,  bool(P.auroraOn,  true)  ? 1 : 0);
    gl.uniform1f(U.u_ringOn,    ringOn                    ? 1 : 0);
    gl.uniform1f(U.u_flareOn,   bool(P.flareOn,   true)  ? 1 : 0);
    gl.uniform1f(U.u_grainOn,   bool(P.grainOn,   true)  ? 1 : 0);

    gl.uniform1f(U.u_auroraScale,     P.auroraScale);
    gl.uniform1f(U.u_auroraSpeed,     P.auroraSpeed);
    gl.uniform1f(U.u_auroraWarp,      P.auroraWarp);
    gl.uniform1f(U.u_auroraIntensity, P.auroraIntensity);
    gl.uniform1f(U.u_auroraBlend,     P.auroraBlend);
    gl.uniform1f(U.u_auroraOffsetX,   P.auroraOffsetX);
    gl.uniform1f(U.u_auroraOffsetY,   P.auroraOffsetY);

    var c1 = hex2rgb(P.color1), c2 = hex2rgb(P.color2), c3 = hex2rgb(P.color3);
    gl.uniform3f(U.u_col1, c1[0], c1[1], c1[2]);
    gl.uniform3f(U.u_col2, c2[0], c2[1], c2[2]);
    gl.uniform3f(U.u_col3, c3[0], c3[1], c3[2]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ringFboTex);
    gl.uniform1i(U["u_ringTex"], 0);
    gl.uniform1f(U.u_ringOpacity, P.ringOpacity);

    gl.uniform1f(U.u_flareIntensity, P.flareIntensity);
    gl.uniform1f(U.u_flareSpread,    P.flareSpread);
    gl.uniform1f(U.u_flareSoftness,  P.flareSoftness);
    gl.uniform1f(U.u_flareRainbow,   P.flareRainbow);
    gl.uniform1f(U.u_flareCount, Math.max(1, Math.min(MAX_FLARES, Math.round(num(P.flareCount, 2)))));
    gl.uniform1f(U.u_flareAngle, P.flareAngle);
    gl.uniform1f(U.u_flareGlow,  P.flareGlow);
    for (var fi = 0; fi < MAX_FLARES; fi++) {
      var idx = fi + 1, o2 = fi*2, o4 = fi*4, o3 = fi*3;
      flarePosData[o2]     = num(P["flare"+idx+"X"], 0.66);
      flarePosData[o2+1]   = num(P["flare"+idx+"Y"], 0.55);
      flareParamsAData[o4]   = num(P["flare"+idx+"Intensity"], 1.0);
      flareParamsAData[o4+1] = num(P["flare"+idx+"Spread"],    1.0);
      flareParamsAData[o4+2] = num(P["flare"+idx+"Softness"],  1.0);
      flareParamsAData[o4+3] = num(P["flare"+idx+"Rainbow"],   1.0);
      flareParamsBData[o3]   = num(P["flare"+idx+"Glow"],      1.0);
      flareParamsBData[o3+1] = num(P["flare"+idx+"Angle"],     1.42);
      flareParamsBData[o3+2] = bool(P["flare"+idx+"On"], idx <= 2) ? 1.0 : 0.0;
    }
    gl.uniform2fv(U["u_flarePos[0]"],     flarePosData);
    gl.uniform4fv(U["u_flareParamsA[0]"], flareParamsAData);
    gl.uniform3fv(U["u_flareParamsB[0]"], flareParamsBData);

    gl.uniform1f(U.u_grainAmount, P.grainAmount);
    gl.uniform1f(U.u_grainSize,   P.grainSize);
    gl.uniform1f(U.u_grainSpeed,  P.grainSpeed);

    gl.uniform1f(U.u_brightness, P.brightness);
    gl.uniform1f(U.u_contrast,   P.contrast);
    gl.uniform1f(U.u_saturation, P.saturation);
    gl.uniform1f(U.u_vignette,   P.vignette);
    var bg = hex2rgb(P.bgColor);
    gl.uniform3f(U.u_bgColor, bg[0], bg[1], bg[2]);

    bindQuad(mainProg);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass C — dot sprites
    if (ringOn && activeDotCount > 0) {
      gl.useProgram(dotsProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      gl.uniform2f(DU.u_resolution, canvas.width, canvas.height);
      gl.uniform2f(DU.u_ringCenter, P.ringX, P.ringY);
      gl.uniform1f(DU.u_ringRadius, P.ringRadius);
      gl.uniform1f(DU.u_ringEdge,   P.ringEdge);
      gl.uniform1f(DU.u_dotSize,    num(P.dotSize,  4.0));
      gl.uniform1f(DU.u_dotSpeed,   num(P.dotSpeed, 0.24));
      gl.uniform1f(DU.u_dotBlink,   bool(P.dotBlink,  true)  ? 1.0 : 0.0);
      gl.uniform1f(DU.u_dotRotate,  bool(P.dotRotate, false) ? 1.0 : 0.0);
      gl.uniform1f(DU.u_dotOpacity, P.ringOpacity);
      gl.uniform1f(DU.u_time, accTime);

      gl.bindVertexArray(dotVao);
      gl.drawArrays(gl.POINTS, 0, activeDotCount);
      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
</script>`;
}
