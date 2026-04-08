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
  'branchOn', 'branchScale', 'branchThickness', 'branchColor',
  'flowerOn', 'flowerSize', 'flowerColor', 'petalCount',
  'glowOn', 'glowIntensity', 'glowColor', 'glowRadius',
  'ditherOn', 'ditherSize',
  'seed', 'animSpeed', 'loop',
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
  var uRes = gl.getUniformLocation(prog, "u_resolution");
  var uScene = gl.getUniformLocation(prog, "u_scene");
  var uDitherOn = gl.getUniformLocation(prog, "u_ditherOn");
  var uDitherSize = gl.getUniformLocation(prog, "u_ditherSize");
  var uBg = gl.getUniformLocation(prog, "u_bgColor");

  // ── Seeded PRNG ──
  function mulberry32(seed) {
    var s = seed | 0;
    return function() {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function lerp2(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
  function bezAt(a,c,b,t) { return lerp2(lerp2(a,c,t),lerp2(c,b,t),t); }
  function bezTan(a,c,b,t) { var s=1-t; return [2*s*(c[0]-a[0])+2*t*(b[0]-c[0]),2*s*(c[1]-a[1])+2*t*(b[1]-c[1])]; }
  function splitBez(a,c,b,t) { var ac=lerp2(a,c,t),cb=lerp2(c,b,t); return {s:a,c:ac,e:lerp2(ac,cb,t)}; }
  function sst(e0,e1,x) { var t=Math.max(0,Math.min(1,(x-e0)/(e1-e0))); return t*t*(3-2*t); }

  // ── Tree generation ──
  function genTree(seed, scale) {
    var rng = mulberry32(Math.round(seed*1000));
    var stems = [];
    var n = 4 + Math.floor(rng()*3);
    for (var i=0;i<n;i++) {
      var side=rng(), o, ba;
      if (side<0.4) { o=[-0.03,0.15+rng()*0.6]; ba=-0.3+rng()*0.6; }
      else if (side<0.75) { o=[0.1+rng()*0.6,-0.03]; ba=Math.PI/2-0.4+rng()*0.8; }
      else { o=[1.03,0.2+rng()*0.5]; ba=Math.PI-0.3+rng()*0.6; }
      stems.push(mkBr(rng,o,ba+(rng()-0.5)*0.4,(0.25+rng()*0.35)*scale,1,0,0,scale));
    }
    return stems;
  }
  function mkBr(rng,start,angle,length,thick,depth,pg,scale) {
    var end=[start[0]+Math.cos(angle)*length,start[1]+Math.sin(angle)*length];
    var mid=lerp2(start,end,0.4+rng()*0.2);
    var perp=[-(end[1]-start[1]),end[0]-start[0]];
    var pl=Math.sqrt(perp[0]*perp[0]+perp[1]*perp[1])||1;
    var ctrl=[mid[0]+(perp[0]/pl)*length*(rng()-0.5)*0.3,mid[1]+(perp[1]/pl)*length*(rng()-0.5)*0.3];
    var go=Math.min(depth===0?pg+rng()*0.05:pg+0.15+rng()*0.1,0.85);
    var node={s:start,e:end,c:ctrl,th:thick,d:depth,go:go,ch:[],fl:[]};
    if(depth<3){var mc=depth===0?3+Math.floor(rng()*3):depth===1?2+Math.floor(rng()*2):1+Math.floor(rng()*2);
    for(var i=0;i<mc;i++){var t=0.25+rng()*0.6;var fp=bezAt(start,ctrl,end,t);var tan=bezTan(start,ctrl,end,t);
    node.ch.push(mkBr(rng,fp,Math.atan2(tan[1],tan[0])+(rng()-0.5)*1.3,length*(0.3+rng()*0.35),thick*(depth===0?0.55:0.5),depth+1,go+t*0.15,scale));}}
    if(depth>=1&&rng()>0.3)node.fl.push(mkFl(rng,end,thick,go+0.12));
    if(depth>=1&&rng()>0.5){var ft=0.4+rng()*0.4;node.fl.push(mkFl(rng,bezAt(start,ctrl,end,ft),thick*0.8,go+ft*0.08+0.1));}
    if(depth===0&&rng()>0.6){var ft2=0.5+rng()*0.3;node.fl.push(mkFl(rng,bezAt(start,ctrl,end,ft2),thick*0.7,go+ft2*0.1+0.15));}
    return node;
  }
  function mkFl(rng,center,sm,bo) {
    return {center:center,r:(0.018+rng()*0.018)*sm,pc:5,ph:rng()*Math.PI*2,bo:Math.min(bo,0.9),cv:0.75+rng()*0.5};
  }

  // ── Canvas2D rendering ──
  var sc = document.createElement("canvas");
  var sctx = sc.getContext("2d");
  var tex = null;
  function initTex(w,h) {
    sc.width=w; sc.height=h;
    if(tex) gl.deleteTexture(tex);
    tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sc);
    gl.bindTexture(gl.TEXTURE_2D,null);
  }
  function uploadTex() {
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,sc);
    gl.bindTexture(gl.TEXTURE_2D,null);
  }
  function drawBranches(ctx,nodes,progress,w,h,bt,color) {
    for(var i=0;i<nodes.length;i++){var n=nodes[i];
    var g=sst(n.go,n.go+0.12,progress); if(g<=0) continue;
    var s=[n.s[0]*w,n.s[1]*h],c=[n.c[0]*w,n.c[1]*h],e=[n.e[0]*w,n.e[1]*h];
    ctx.beginPath(); ctx.moveTo(s[0],s[1]);
    if(g>=0.99) ctx.quadraticCurveTo(c[0],c[1],e[0],e[1]);
    else{var p=splitBez(s,c,e,g); ctx.quadraticCurveTo(p.c[0],p.c[1],p.e[0],p.e[1]);}
    ctx.strokeStyle=color; ctx.lineWidth=Math.max(bt*n.th*(1-n.d*0.15),0.5); ctx.lineCap="round"; ctx.stroke();
    if(n.ch.length) drawBranches(ctx,n.ch,progress,w,h,bt,color);}
  }
  function drawFlowers(ctx,nodes,progress,w,h,sm,rgb) {
    for(var i=0;i<nodes.length;i++){var n=nodes[i];
    for(var j=0;j<n.fl.length;j++){var fl=n.fl[j];
    var bloom=sst(fl.bo,fl.bo+0.1,progress); if(bloom<=0) continue;
    var cx=fl.center[0]*w,cy=fl.center[1]*h,r=fl.r*h*sm*bloom;
    var rv=Math.min(1,rgb[0]*fl.cv),gv=Math.min(1,rgb[1]*fl.cv),bv=Math.min(1,rgb[2]*fl.cv);
    ctx.fillStyle="rgb("+Math.round(rv*255)+","+Math.round(gv*255)+","+Math.round(bv*255)+")";
    ctx.globalAlpha=0.85*bloom;
    for(var k=0;k<fl.pc;k++){var a=(k/fl.pc)*Math.PI*2+fl.ph;ctx.beginPath();ctx.arc(cx+Math.cos(a)*r*0.4,cy+Math.sin(a)*r*0.4,r*0.55,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=0.6*bloom;ctx.fillStyle="#1a1025";ctx.beginPath();ctx.arc(cx,cy,r*0.15,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}
    if(n.ch.length) drawFlowers(ctx,n.ch,progress,w,h,sm,rgb);}
  }
  function drawGlow(ctx,nodes,progress,w,h,sm,intensity,radius,glowRGB) {
    for(var i=0;i<nodes.length;i++){var n=nodes[i];
    for(var j=0;j<n.fl.length;j++){var fl=n.fl[j];
    var age=progress-fl.bo; if(age<0) continue;
    var peak=Math.exp(-Math.pow(Math.max(age-0.07,0),2)/0.003); if(peak<0.05) continue;
    var cx=fl.center[0]*w,cy=fl.center[1]*h,r=fl.r*h*sm*radius*3.5;
    var grad=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
    var gR=Math.round(glowRGB[0]*255),gG=Math.round(glowRGB[1]*255),gB=Math.round(glowRGB[2]*255);
    grad.addColorStop(0,"rgba("+gR+","+gG+","+gB+","+Math.min(peak*intensity*0.6,1)+")");
    grad.addColorStop(1,"rgba("+gR+","+gG+","+gB+",0)");
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();}
    if(n.ch.length) drawGlow(ctx,n.ch,progress,w,h,sm,intensity,radius,glowRGB);}
  }
  function renderScn(progress) {
    var w=sc.width,h=sc.height;
    sctx.fillStyle=P.bgColor.charAt(0)==="#"?"#"+P.bgColor.slice(1):("#"+P.bgColor);
    sctx.fillRect(0,0,w,h);
    var bt=(P.branchThickness||1)*h*0.008;
    var bc=P.branchColor.charAt(0)==="#"?P.branchColor:("#"+P.branchColor);
    if(P.branchOn!==false) drawBranches(sctx,tree,progress,w,h,bt,bc);
    var fc=hex2rgb(P.flowerColor||"6b4faa");
    if(P.flowerOn!==false&&P.glowOn!==false){sctx.save();sctx.globalCompositeOperation="lighter";
    drawGlow(sctx,tree,progress,w,h,P.flowerSize||1,P.glowIntensity||1.2,P.glowRadius||1,hex2rgb(P.glowColor||"aaddff"));sctx.restore();}
    if(P.flowerOn!==false) drawFlowers(sctx,tree,progress,w,h,P.flowerSize||1,fc);
  }

  var tree = genTree(P.seed || 42, P.branchScale || 1);
  var animSpd = P.animSpeed || 6;
  var doLoop = P.loop !== false;

  // Resize
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    initTex(Math.ceil(canvas.width/2), Math.ceil(canvas.height/2));
  }
  var ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // Render loop
  var accTime = 0;
  var lastTime = performance.now();
  var lastP = -1;

  function render() {
    var now = performance.now();
    var dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    accTime += dt;

    var progress = accTime / animSpd;
    if (doLoop) progress = progress % 1.0;
    else progress = Math.min(progress, 1.0);

    if (Math.abs(progress - lastP) > 0.0005) {
      renderScn(progress);
      uploadTex();
      lastP = progress;
    }

    gl.useProgram(prog);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uDitherOn, P.ditherOn !== false ? 1.0 : 0.0);
    gl.uniform1f(uDitherSize, P.ditherSize || 5);
    var bg = hex2rgb(P.bgColor || "12121a");
    gl.uniform3f(uBg, bg[0], bg[1], bg[2]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uScene, 0);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
</script>`;
}
